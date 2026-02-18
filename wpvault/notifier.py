import os
import html
import requests
from dotenv import load_dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"


def notify(message: str) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return
    try:
        requests.post(
            TELEGRAM_API_URL,
            json={
                "chat_id": TELEGRAM_CHAT_ID,
                "text": message,
                "parse_mode": "HTML"
            },
            timeout=10
        )
    except Exception:
        pass


def notify_new_plugin(name: str, version: str, category: str) -> None:
    message = (
        f"<b>New Plugin Added</b>\n"
        f"Name: {html.escape(name)}\n"
        f"Version: {html.escape(version)}\n"
        f"Category: {html.escape(category)}"
    )
    notify(message)


def notify_updated_plugin(name: str, old_version: str, new_version: str) -> None:
    message = (
        f"<b>Plugin Updated</b>\n"
        f"Name: {html.escape(name)}\n"
        f"Version: {html.escape(old_version)} -> {html.escape(new_version)}"
    )
    notify(message)


def notify_sync_summary(new: int, updated: int, failed: int, duplicate: int) -> None:
    message = (
        f"<b>Sync Complete</b>\n"
        f"New: {new}\n"
        f"Updated: {updated}\n"
        f"Failed: {failed}\n"
        f"Skipped: {duplicate}"
    )
    notify(message)


def notify_session_refreshed() -> None:
    message = (
        "<b>Session Refreshed</b>\n"
        "Successfully re-logged into PluginsForWP"
    )
    notify(message)


def notify_session_failed() -> None:
    message = (
        "<b>Session Failed</b>\n"
        "Could not log into PluginsForWP - manual intervention needed"
    )
    notify(message)


def notify_corrupt_file(slug: str) -> None:
    message = (
        f"<b>Corrupt File Detected</b>\n"
        f"Plugin: {html.escape(slug)}\n"
        f"File deleted, skipping upload"
    )
    notify(message)


def notify_payment_received(email: str, amount: str) -> None:
    parts = (email or "").split("@")
    if len(parts) == 2 and parts[0]:
        masked = parts[0][:2] + "***@" + parts[1]
    else:
        masked = "***"

    message = (
        f"<b>Payment Received</b>\n"
        f"User: {html.escape(masked)}\n"
        f"Amount: ${html.escape(str(amount))}\n"
        f"Plan activated!"
    )
    notify(message)
