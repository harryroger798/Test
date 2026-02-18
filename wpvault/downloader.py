import os
import time
from dotenv import load_dotenv

load_dotenv()

TMP_DIR = os.getenv("TMP_DIR", "/tmp/downloads")


def download_plugin(page_url: str, slug: str) -> str | None:
    import session_manager
    import database

    os.makedirs(TMP_DIR, exist_ok=True)

    browser = None
    try:
        browser, context, page = session_manager.get_authenticated_page()
        if not page:
            database.log_sync(slug, "failed", "Could not get authenticated session")
            return None

        page.goto(page_url, wait_until="networkidle", timeout=60000)
        page.wait_for_timeout(3000)

        download_link = None

        selectors = [
            'a[href*=".zip"]',
            'a.download',
            'a[class*="download"]',
            'a:has-text("Download")',
            'a:has-text("download")',
            'button:has-text("Download")',
            'a[href*="download"]',
        ]

        for selector in selectors:
            try:
                element = page.query_selector(selector)
                if element:
                    download_link = element
                    break
            except Exception:
                continue

        if not download_link:
            database.log_sync(slug, "failed", f"No download link found on {page_url}")
            browser.close()
            return None

        timestamp = int(time.time())
        filename = f"{slug}-{timestamp}.zip"
        filepath = os.path.join(TMP_DIR, filename)

        try:
            with page.expect_download(timeout=60000) as download_info:
                download_link.click()
            download = download_info.value
            download.save_as(filepath)
        except Exception:
            href = download_link.get_attribute("href")
            if href and href.endswith(".zip"):
                import requests
                cookies = context.cookies()
                cookie_dict = {c["name"]: c["value"] for c in cookies}
                response = requests.get(href, cookies=cookie_dict, stream=True, timeout=120)
                if response.status_code == 200:
                    with open(filepath, "wb") as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                else:
                    database.log_sync(slug, "failed", f"HTTP {response.status_code} downloading {href}")
                    browser.close()
                    return None
            else:
                database.log_sync(slug, "failed", f"Download failed for {page_url}")
                browser.close()
                return None

        browser.close()

        if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
            return filepath
        else:
            database.log_sync(slug, "failed", f"Downloaded file is empty for {slug}")
            return None

    except Exception as e:
        if browser:
            try:
                browser.close()
            except Exception:
                pass
        try:
            import database
            database.log_sync(slug, "failed", f"Exception: {str(e)}")
        except Exception:
            pass
        return None
