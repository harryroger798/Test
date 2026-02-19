import os
import hmac
import hashlib
import uuid
import logging
import requests
from dotenv import load_dotenv

import database
import notifier

logger = logging.getLogger(__name__)

load_dotenv()

BTC_WALLET_ADDRESS = os.getenv(
    "BTC_WALLET_ADDRESS",
    "bc1p5uc6872g3myx0d5ctptqarp0z674cvwpmdsgnzcfwqld5hph5shsvp8dse",
)
BTCPAY_WEBHOOK_SECRET = os.getenv("BTCPAY_WEBHOOK_SECRET", "")
BASE_URL = os.getenv("BASE_URL", "")

_btc_price_cache: dict = {"price": 0.0, "ts": 0.0}


def get_btc_price() -> float:
    import time
    now = time.time()
    if _btc_price_cache["price"] > 0 and now - _btc_price_cache["ts"] < 300:
        return _btc_price_cache["price"]
    try:
        resp = requests.get(
            "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
            timeout=10,
        )
        price = resp.json()["bitcoin"]["usd"]
        _btc_price_cache["price"] = float(price)
        _btc_price_cache["ts"] = now
        return float(price)
    except Exception:
        try:
            resp = requests.get(
                "https://api.coinbase.com/v2/prices/BTC-USD/spot",
                timeout=10,
            )
            price = resp.json()["data"]["amount"]
            _btc_price_cache["price"] = float(price)
            _btc_price_cache["ts"] = now
            return float(price)
        except Exception:
            return _btc_price_cache["price"] if _btc_price_cache["price"] > 0 else 97000.0


def usd_to_btc(amount_usd: float) -> float:
    price = get_btc_price()
    if price <= 0:
        return 0.0
    return round(amount_usd / price, 8)


def create_invoice(user_id: str, amount_usd: float, plan_days: int = 365) -> dict:
    try:
        if amount_usd <= 0 or plan_days <= 0:
            return {"error": "Invalid amount or plan duration"}
        btc_amount = usd_to_btc(amount_usd)
        if btc_amount <= 0:
            return {"error": "Could not fetch BTC price"}
        invoice_id = f"wp_{uuid.uuid4().hex[:12]}"
        order = database.create_order(user_id, invoice_id, amount_usd, plan_days)
        if not order:
            return {"error": "Failed to create order"}
        return {
            "invoice_id": invoice_id,
            "btc_address": BTC_WALLET_ADDRESS,
            "btc_amount": btc_amount,
            "usd_amount": amount_usd,
            "btc_price": get_btc_price(),
        }
    except Exception as e:
        logger.exception("create_invoice error")
        return {"error": str(e)}


def confirm_order(invoice_id: str) -> bool:
    order = database.get_order_by_invoice(invoice_id)
    if not order:
        return False
    if order.get("status") == "paid":
        return True
    user_id = order.get("user_id", "")
    plan_days = order.get("plan_duration_days", 365)
    amount = order.get("amount_usd", 0)
    if not database.update_order_status(invoice_id, "paid"):
        return False
    if not database.upgrade_user_plan(user_id, plan_days):
        database.update_order_status(invoice_id, "error")
        return False
    user = database.get_user_by_id(user_id)
    if user:
        notifier.notify_payment_received(user.get("email", ""), str(amount))
    return True


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    try:
        if not BTCPAY_WEBHOOK_SECRET:
            return False
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
            return confirm_order(invoice_id)
        elif event_type == "InvoiceExpired":
            order = database.get_order_by_invoice(invoice_id)
            if order and order.get("status") != "paid":
                database.update_order_status(invoice_id, "expired")
        return True
    except Exception:
        return False
