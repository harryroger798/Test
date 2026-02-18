import os
import hmac
import hashlib
import requests
from dotenv import load_dotenv

import database
import notifier

load_dotenv()

BTCPAY_URL = os.getenv("BTCPAY_URL", "")
BTCPAY_API_KEY = os.getenv("BTCPAY_API_KEY", "")
BTCPAY_STORE_ID = os.getenv("BTCPAY_STORE_ID", "")
BTCPAY_WEBHOOK_SECRET = os.getenv("BTCPAY_WEBHOOK_SECRET", "")
BASE_URL = os.getenv("BASE_URL", "")


def create_invoice(user_id: str, amount_usd: float, plan_days: int = 365) -> dict:
    try:
        url = f"{BTCPAY_URL}/api/v1/stores/{BTCPAY_STORE_ID}/invoices"
        headers = {
            "Authorization": f"token {BTCPAY_API_KEY}",
            "Content-Type": "application/json"
        }
        body = {
            "amount": str(amount_usd),
            "currency": "USD",
            "metadata": {
                "user_id": user_id,
                "plan_days": plan_days
            },
            "checkout": {
                "redirectURL": f"{BASE_URL}/dashboard"
            }
        }

        response = requests.post(url, json=body, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()

        invoice_id = data.get("id", "")
        checkout_url = data.get("checkoutLink", "")

        database.create_order(user_id, invoice_id, amount_usd, plan_days)

        return {
            "invoice_id": invoice_id,
            "checkout_url": checkout_url
        }
    except Exception as e:
        return {"error": str(e)}


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    try:
        expected = hmac.new(
            BTCPAY_WEBHOOK_SECRET.encode("utf-8"),
            payload,
            hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(f"sha256={expected}", signature)
    except Exception:
        return False


def handle_webhook(payload: dict, raw_body: bytes, signature: str) -> bool:
    if not verify_webhook_signature(raw_body, signature):
        return False

    try:
        invoice_id = payload.get("invoiceId", "")
        event_type = payload.get("type", "")

        if event_type == "InvoiceSettled":
            order = database.get_order_by_invoice(invoice_id)
            if order:
                user_id = order.get("user_id", "")
                plan_days = order.get("plan_duration_days", 365)
                amount = order.get("amount_usd", 0)

                database.upgrade_user_plan(user_id, plan_days)
                database.update_order_status(invoice_id, "paid")

                user = database.get_user_by_id(user_id)
                if user:
                    notifier.notify_payment_received(
                        user.get("email", ""),
                        str(amount)
                    )

        elif event_type == "InvoiceExpired":
            database.update_order_status(invoice_id, "expired")

        return True
    except Exception:
        return False
