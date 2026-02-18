import json
import logging
import os
import re
import time
from urllib.parse import urlparse

from dotenv import load_dotenv

import database
import downloader
import file_processor
import storage
import notifier

load_dotenv()
logger = logging.getLogger(__name__)

EDD_API_BASE = "https://pluginsforwp.com/edd-api/v2/products/"
PLUGINSFORWP_API_KEY = os.getenv("PLUGINSFORWP_API_KEY", "")
PRODUCTS_PER_PAGE = 50
MAX_PAGES = 500


def _strip_html(text: str) -> str:
    clean = re.sub(r"<[^>]+>", "", text or "")
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def _fetch_api_page(page_num: int, per_page: int = 20) -> list:
    import requests as req

    try:
        resp = req.get(
            EDD_API_BASE,
            params={"key": PLUGINSFORWP_API_KEY, "number": per_page, "page": page_num},
            timeout=30,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json",
            },
        )
        if resp.status_code == 200:
            data = resp.json()
            return data.get("products", [])
        logger.warning("API returned status %d for page %d", resp.status_code, page_num)
    except Exception:
        logger.warning("requests fetch failed for page %d, trying Playwright", page_num)

    return _fetch_api_page_playwright(page_num, per_page)


def _fetch_api_page_playwright(page_num: int, per_page: int = 20) -> list:
    from playwright.sync_api import sync_playwright
    from playwright_stealth import stealth_sync

    api_url = f"{EDD_API_BASE}?key={PLUGINSFORWP_API_KEY}&number={per_page}&page={page_num}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        stealth_sync(page)

        page.goto(api_url, wait_until="domcontentloaded", timeout=60000)

        for _ in range(30):
            page.wait_for_timeout(2000)
            body_text = page.inner_text("body").strip()
            if body_text.startswith("{") and '"products"' in body_text:
                break

        body_text = page.inner_text("body").strip()
        browser.close()

        if body_text.startswith("{"):
            data = json.loads(body_text)
            return data.get("products", [])

    return []


def scrape_plugin_list() -> list:
    items = {}

    if not PLUGINSFORWP_API_KEY:
        logger.error("PLUGINSFORWP_API_KEY not set")
        return []

    page_num = 1
    while True:
        try:
            products = _fetch_api_page(page_num, PRODUCTS_PER_PAGE)
        except Exception:
            logger.exception("Failed to fetch API page %d", page_num)
            break

        if not products:
            break

        for product in products:
            try:
                info = product.get("info", {})
                slug = info.get("slug", "")
                if not slug or slug in items:
                    continue

                source_url = info.get("permalink", "") or info.get("link", "")
                if not source_url:
                    continue

                name = info.get("title", slug.replace("-", " ").title())
                description = _strip_html(info.get("content", ""))
                thumbnail = info.get("thumbnail", "")

                categories = info.get("category", [])
                category = ""
                for cat in categories:
                    cat_name = cat.get("name", "")
                    if cat_name and cat_name not in ("Basic Item",):
                        category = cat_name
                        break

                is_plugin = True
                for cat in categories:
                    if cat.get("slug") == "themes":
                        is_plugin = False
                        break

                items[slug] = {
                    "slug": slug,
                    "source_url": source_url,
                    "name": name,
                    "description": description,
                    "thumbnail_url": thumbnail,
                    "category": category,
                    "is_plugin": is_plugin,
                }
            except Exception:
                logger.exception("Failed to parse product in page %d", page_num)
                continue

        if len(products) < PRODUCTS_PER_PAGE:
            break

        page_num += 1
        if page_num > MAX_PAGES:
            logger.info("Reached MAX_PAGES limit (%d)", MAX_PAGES)
            break
        time.sleep(1)

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

        try:
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

            old_key_to_delete = ""
            if existing and existing.get("file_key") and existing.get("file_hash") != file_hash:
                old_key_to_delete = existing.get("file_key", "") or ""

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
                if not database.update_plugin(slug, plugin_data):
                    storage.delete_file(object_key)
                    database.log_sync(slug, "failed", "DB update failed")
                    return "failed"
                if old_key_to_delete:
                    storage.delete_file(old_key_to_delete)
                database.log_sync(slug, "updated", f"Updated from {old_version} to {version}")
                notifier.notify_updated_plugin(name, old_version, version)
                status = "updated"
            else:
                if not database.insert_plugin(plugin_data):
                    storage.delete_file(object_key)
                    database.log_sync(slug, "failed", "DB insert failed")
                    return "failed"
                database.log_sync(slug, "new", f"New plugin added: {name} v{version}")
                notifier.notify_new_plugin(name, version, item.get("category", ""))
                status = "new"

            return status
        finally:
            try:
                import os
                if filepath and os.path.exists(filepath):
                    os.remove(filepath)
            except Exception:
                pass

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
