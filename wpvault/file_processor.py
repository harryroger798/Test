import os
import re
import hashlib
import zipfile

import database
import notifier


def process_file(filepath: str, slug: str) -> dict | None:
    try:
        with zipfile.ZipFile(filepath, "r") as zf:
            bad_file = zf.testzip()
            if bad_file is not None:
                os.remove(filepath)
                database.log_sync(slug, "corrupt", f"Corrupt entry: {bad_file}")
                notifier.notify_corrupt_file(slug)
                return None
    except zipfile.BadZipFile:
        os.remove(filepath)
        database.log_sync(slug, "corrupt", "File is not a valid ZIP")
        notifier.notify_corrupt_file(slug)
        return None
    except Exception as e:
        os.remove(filepath)
        database.log_sync(slug, "corrupt", f"ZIP check error: {str(e)}")
        notifier.notify_corrupt_file(slug)
        return None

    sha256_hash = _calculate_sha256(filepath)

    existing = database.get_plugin_by_slug(slug)
    if existing and existing.get("file_hash") == sha256_hash:
        database.log_sync(slug, "duplicate", "File hash matches existing version")
        try:
            os.remove(filepath)
        except Exception:
            pass
        return None

    version = _extract_version(filepath, slug)

    file_size = os.path.getsize(filepath)

    return {
        "slug": slug,
        "version": version,
        "file_hash": sha256_hash,
        "file_size_bytes": file_size,
    }


def _calculate_sha256(filepath: str) -> str:
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            sha256.update(chunk)
    return sha256.hexdigest()


def _extract_version(filepath: str, slug: str) -> str:
    filename = os.path.basename(filepath)
    version_match = re.search(r"-(\d+\.\d+(?:\.\d+)*)", filename)
    if version_match:
        return version_match.group(1)

    try:
        with zipfile.ZipFile(filepath, "r") as zf:
            names = zf.namelist()

            readme_candidates = [
                n for n in names
                if n.lower().endswith("readme.txt")
            ]
            for readme in readme_candidates:
                try:
                    content = zf.read(readme).decode("utf-8", errors="ignore")
                    stable_match = re.search(r"Stable\s+tag:\s*(\S+)", content, re.IGNORECASE)
                    if stable_match:
                        return stable_match.group(1)
                except Exception:
                    continue

            php_candidates = [
                n for n in names
                if n.endswith(f"{slug}.php") or n.endswith("/plugin.php") or n.endswith("/style.css")
            ]
            for php_file in php_candidates:
                try:
                    content = zf.read(php_file).decode("utf-8", errors="ignore")
                    ver_match = re.search(r"Version:\s*(\S+)", content, re.IGNORECASE)
                    if ver_match:
                        return ver_match.group(1)
                except Exception:
                    continue
    except Exception:
        pass

    return "unknown"
