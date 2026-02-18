import os
import json
import logging
from contextlib import contextmanager
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

PLUGINSFORWP_EMAIL = os.getenv("PLUGINSFORWP_EMAIL", "")
PLUGINSFORWP_PASSWORD = os.getenv("PLUGINSFORWP_PASSWORD", "")
SESSION_FILE = os.getenv("SESSION_FILE", "/home/app/session.json")
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def login_and_save_session() -> bool:
    import notifier
    try:
        from playwright.sync_api import sync_playwright
        from playwright_stealth import stealth_sync

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1920, "height": 1080}
            )
            page = context.new_page()
            stealth_sync(page)

            page.goto("https://pluginsforwp.com/login", wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(2000)

            page.fill("input[name='edd_user_login']", PLUGINSFORWP_EMAIL)
            page.fill("input[name='edd_user_pass']", PLUGINSFORWP_PASSWORD)
            page.click("input[type='submit']")

            page.wait_for_load_state("networkidle", timeout=30000)
            page.wait_for_timeout(3000)

            current_url = page.url
            page_content = page.content()

            login_success = (
                "my-account" in current_url
                or "dashboard" in current_url
                or "purchase_history" in current_url
                or "edd_user_login" not in page_content
                or "Log out" in page_content
                or "logout" in page_content.lower()
            )

            if login_success:
                cookies = context.cookies()
                session_dir = os.path.dirname(SESSION_FILE)
                if session_dir:
                    os.makedirs(session_dir, exist_ok=True)
                with open(SESSION_FILE, "w") as f:
                    json.dump(cookies, f, indent=2)
                notifier.notify_session_refreshed()
                browser.close()
                return True
            else:
                notifier.notify_session_failed()
                browser.close()
                return False

    except Exception:
        logger.exception("Login failed")
        try:
            import notifier
            notifier.notify_session_failed()
        except Exception:
            logger.exception("Failed to send session failure notification")
        return False


def load_session(context) -> bool:
    try:
        if not os.path.exists(SESSION_FILE):
            return False
        with open(SESSION_FILE, "r") as f:
            cookies = json.load(f)
        context.add_cookies(cookies)
        return True
    except Exception:
        return False


def is_session_valid() -> bool:
    try:
        from playwright.sync_api import sync_playwright
        from playwright_stealth import stealth_sync

        if not os.path.exists(SESSION_FILE):
            return False

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1920, "height": 1080}
            )
            load_session(context)
            page = context.new_page()
            stealth_sync(page)

            page.goto("https://pluginsforwp.com/my-account/", wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)

            current_url = page.url
            page_content = page.content()

            is_valid = (
                "login" not in current_url
                and (
                    "my-account" in current_url
                    or "purchase_history" in current_url
                    or "Log out" in page_content
                    or "logout" in page_content.lower()
                )
            )

            browser.close()
            return is_valid

    except Exception:
        return False


@contextmanager
def get_authenticated_page():
    from playwright.sync_api import sync_playwright
    from playwright_stealth import stealth_sync

    if not is_session_valid():
        success = login_and_save_session()
        if not success:
            yield None, None, None, None
            return

    p = None
    browser = None
    try:
        p = sync_playwright().start()
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={"width": 1920, "height": 1080}
        )
        load_session(context)
        page = context.new_page()
        stealth_sync(page)
        yield p, browser, context, page
    except Exception:
        logger.exception("Failed to create authenticated page")
        yield None, None, None, None
    finally:
        try:
            if browser:
                browser.close()
        except Exception:
            pass
        try:
            if p:
                p.stop()
        except Exception:
            pass
