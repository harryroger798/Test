import os
import hmac
import hashlib
import uuid
import time
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
PAYMENT_TOLERANCE = float(os.getenv("PAYMENT_TOLERANCE", "0.000005"))
ORDER_EXPIRY_MINUTES = int(os.getenv("ORDER_EXPIRY_MINUTES", "60"))

_btc_price_cache: dict = {"price": 0.0, "ts": 0.0}
_tx_cache: dict = {"txs": [], "ts": 0.0}


def get_btc_price() -> float:
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
        order = database.create_order(user_id, invoice_id, amount_usd, plan_days, btc_amount)
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


def get_wallet_transactions() -> list:
    now = time.time()
    if _tx_cache["txs"] and now - _tx_cache["ts"] < 30:
        return _tx_cache["txs"]
    apis = [
        f"https://mempool.space/api/address/{BTC_WALLET_ADDRESS}/txs",
        f"https://blockstream.info/api/address/{BTC_WALLET_ADDRESS}/txs",
    ]
    for api_url in apis:
        try:
            resp = requests.get(api_url, timeout=15)
            if resp.status_code == 200:
                txs = resp.json()
                _tx_cache["txs"] = txs
                _tx_cache["ts"] = now
                return txs
        except Exception:
            continue
    return _tx_cache["txs"]


def _satoshis_to_btc(sats: int) -> float:
    return sats / 100_000_000


def _get_received_amount(tx: dict) -> float:
    total = 0
    for vout in tx.get("vout", []):
        addr = vout.get("scriptpubkey_address", "")
        if addr == BTC_WALLET_ADDRESS:
            total += vout.get("value", 0)
    return _satoshis_to_btc(total)


def check_pending_payments() -> int:
    pending = database.get_pending_orders()
    if not pending:
        return 0
    txs = get_wallet_transactions()
    if not txs:
        logger.info("No transactions found for wallet")
        return 0
    confirmed_count = 0
    now_ts = time.time()
    for order in pending:
        order_btc = order.get("btc_amount", 0)
        if order_btc <= 0:
            continue
        created = order.get("created_at", "")
        if created:
            from datetime import datetime
            try:
                order_time = datetime.fromisoformat(created).timestamp()
                if now_ts - order_time > ORDER_EXPIRY_MINUTES * 60:
                    invoice_id = order.get("btcpay_invoice_id", "")
                    database.update_order_status(invoice_id, "expired")
                    logger.info("Order %s expired", invoice_id)
                    continue
            except (ValueError, TypeError):
                pass
        for tx in txs:
            received = _get_received_amount(tx)
            if received <= 0:
                continue
            if abs(received - order_btc) <= PAYMENT_TOLERANCE:
                invoice_id = order.get("btcpay_invoice_id", "")
                confirmations = tx.get("status", {}).get("confirmed", False)
                if confirmations:
                    if confirm_order(invoice_id):
                        confirmed_count += 1
                        logger.info(
                            "Payment confirmed for order %s: %.8f BTC (tx: %s)",
                            invoice_id, received, tx.get("txid", "unknown")
                        )
                else:
                    logger.info(
                        "Unconfirmed tx found for order %s: %.8f BTC (tx: %s)",
                        invoice_id, received, tx.get("txid", "unknown")
                    )
                break
    return confirmed_count


def get_order_status(invoice_id: str) -> dict:
    order = database.get_order_by_invoice(invoice_id)
    if not order:
        return {"status": "not_found"}
    status = order.get("status", "pending")
    result = {"status": status, "invoice_id": invoice_id}
    if status == "pending":
        txs = get_wallet_transactions()
        order_btc = order.get("btc_amount", 0)
        for tx in txs:
            received = _get_received_amount(tx)
            if received > 0 and abs(received - order_btc) <= PAYMENT_TOLERANCE:
                confirmed = tx.get("status", {}).get("confirmed", False)
                result["tx_found"] = True
                result["txid"] = tx.get("txid", "")
                result["confirmed"] = confirmed
                if confirmed:
                    confirm_order(invoice_id)
                    result["status"] = "paid"
                break
    return result


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
