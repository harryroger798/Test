import re
import xml.etree.ElementTree as ET
import feedparser
import requests
from urllib.parse import urlparse

import database
import downloader
import file_processor
import storage
import notifier


def scrape_plugin_list() -> list:
    items = {}

    try:
        feed = feedparser.parse("https://pluginsforwp.com/feed/")
        for entry in feed.entries:
            url = entry.get("link", "")
            if not url:
                continue
            slug = _extract_slug(url)
            if not slug:
                continue

            category = ""
            if hasattr(entry, "tags") and entry.tags:
                category = entry.tags[0].get("term", "")

            thumbnail = ""
            if hasattr(entry, "media_content") and entry.media_content:
                thumbnail = entry.media_content[0].get("url", "")

            is_plugin = "/themes/" not in url

            items[slug] = {
                "slug": slug,
                "source_url": url,
                "name": entry.get("title", slug),
                "description": entry.get("summary", ""),
                "thumbnail_url": thumbnail,
                "category": category,
                "is_plugin": is_plugin,
            }
    except Exception:
        pass

    try:
        response = requests.get("https://pluginsforwp.com/sitemap.xml", timeout=30)
        if response.status_code == 200:
            root = ET.fromstring(response.text)
            ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}

            sitemap_urls = []
            for sitemap in root.findall(".//sm:sitemap/sm:loc", ns):
                sitemap_urls.append(sitemap.text)

            loc_urls = []
            for loc in root.findall(".//sm:url/sm:loc", ns):
                loc_urls.append(loc.text)

            for sub_url in sitemap_urls:
                try:
                    sub_resp = requests.get(sub_url, timeout=30)
                    if sub_resp.status_code == 200:
                        sub_root = ET.fromstring(sub_resp.text)
                        for loc in sub_root.findall(".//sm:url/sm:loc", ns):
                            loc_urls.append(loc.text)
                except Exception:
                    continue

            for url in loc_urls:
                if "/plugins/" not in url and "/themes/" not in url:
                    continue
                slug = _extract_slug(url)
                if not slug or slug in items:
                    continue

                is_plugin = "/themes/" not in url
                name = slug.replace("-", " ").title()

                items[slug] = {
                    "slug": slug,
                    "source_url": url,
                    "name": name,
                    "description": "",
                    "thumbnail_url": "",
                    "category": "",
                    "is_plugin": is_plugin,
                }
    except Exception:
        pass

    return list(items.values())


def _extract_slug(url: str) -> str:
    parsed = urlparse(url)
    path = parsed.path.strip("/")
    parts = path.split("/")
    if len(parts) >= 2:
        return parts[-1] if parts[-1] else parts[-2]
    elif len(parts) == 1:
        return parts[0]
    return ""


def process_single_item(item: dict) -> str:
    slug = item.get("slug", "")
    source_url = item.get("source_url", "")
    name = item.get("name", slug)

    try:
        existing = database.get_plugin_by_slug(slug)

        filepath = downloader.download_plugin(source_url, slug)
        if not filepath:
            return "failed"

        result = file_processor.process_file(filepath, slug)
        if not result:
            return "duplicate"

        version = result.get("version", "unknown")
        file_hash = result.get("file_hash", "")
        file_size = result.get("file_size_bytes", 0)

        object_key = f"plugins/{slug}/{slug}-{version}.zip"

        upload_ok = storage.upload_file(filepath, object_key)
        if not upload_ok:
            database.log_sync(slug, "failed", "Upload to storage failed")
            return "failed"

        if existing and existing.get("file_key") and existing.get("file_hash") != file_hash:
            old_key = existing.get("file_key", "")
            if old_key:
                storage.delete_file(old_key)

        plugin_data = {
            "slug": slug,
            "name": name,
            "description": item.get("description", ""),
            "version": version,
            "category": item.get("category", ""),
            "source_url": source_url,
            "file_key": object_key,
            "file_hash": file_hash,
            "file_size_bytes": file_size,
            "thumbnail_url": item.get("thumbnail_url", ""),
            "is_plugin": 1 if item.get("is_plugin", True) else 0,
        }

        if existing:
            old_version = existing.get("version", "unknown")
            database.update_plugin(slug, plugin_data)
            database.log_sync(slug, "updated", f"Updated from {old_version} to {version}")
            notifier.notify_updated_plugin(name, old_version, version)
            status = "updated"
        else:
            database.insert_plugin(plugin_data)
            database.log_sync(slug, "new", f"New plugin added: {name} v{version}")
            notifier.notify_new_plugin(name, version, item.get("category", ""))
            status = "new"

        try:
            import os
            os.remove(filepath)
        except Exception:
            pass

        return status

    except Exception as e:
        database.log_sync(slug, "failed", f"Exception: {str(e)}")
        return "failed"


def run_sync() -> dict:
    counts = {"new": 0, "updated": 0, "duplicate": 0, "failed": 0}

    items = scrape_plugin_list()
    for item in items:
        result = process_single_item(item)
        if result in counts:
            counts[result] += 1

    notifier.notify_sync_summary(
        counts["new"],
        counts["updated"],
        counts["failed"],
        counts["duplicate"]
    )

    return counts
