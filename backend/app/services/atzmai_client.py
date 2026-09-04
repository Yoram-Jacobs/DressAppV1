import logging
import uuid
from typing import Any, Dict, List, Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

class AtzmaiError(Exception):
    def __init__(self, status_code: int, body: Any):
        self.status_code = status_code
        self.body = body
        super().__init__(f"Atzmai API error {status_code}: {body}")

def _headers() -> Dict[str, str]:
    return {
        "x-api-key": settings.ATZMAI_API_KEY,
        "x-client-secret": settings.ATZMAI_CLIENT_SECRET,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

def _base_url() -> str:
    return settings.ATZMAI_BASE_URL.rstrip("/")

def is_mock_mode() -> bool:
    # Fallback to mock mode if credentials are at their default values or if explicitly mocked
    return (
        settings.PAYPAL_MOCK_MODE
        or settings.ATZMAI_API_KEY == "test_api_key_public"
        or settings.ATZMAI_CLIENT_SECRET == "clientSecret"
    )

async def get_usd_to_ils_rate() -> float:
    """Fetch USD to ILS exchange rate using a public API. Fallback to 3.70."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://open.er-api.com/v6/latest/USD", timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                rate = data.get("rates", {}).get("ILS")
                if rate:
                    return float(rate)
    except Exception as e:
        logger.warning(f"Failed to fetch live USD to ILS exchange rate: {e}. Using fallback 3.70.")
    return 3.70

async def generate_payment_link(
    items: List[Dict[str, Any]],
    customer_name: str,
    email: str,
    phone: Optional[str] = None,
    language: str = "he",
    redirect_url: Optional[str] = None,
    fail_redirect_url: Optional[str] = None,
    callback_url: Optional[str] = None,
    atzmai_client_id: Optional[str] = None,
    currency: str = "USD",
) -> Dict[str, Any]:
    if currency.upper() == "USD":
        rate = await get_usd_to_ils_rate()
        logger.info(f"Converting USD to ILS at rate {rate} for generate_payment_link")
        new_items = []
        for item in items:
            new_items.append({
                **item,
                "amount": round(item.get("amount", 0) * rate, 2),
                "description": f"{item.get('description', '')} (Converted USD->ILS)"
            })
        items = new_items
        currency = "ILS"

    if is_mock_mode():
        import urllib.parse
        payment_id = f"mock_atz_{uuid.uuid4().hex[:16]}"
        total_amount = sum(item.get("amount", 0) for item in items)
        description_str = ", ".join(item.get("description", "") for item in items)
        mock_url = (
            f"{settings.APP_PUBLIC_URL}/mock-atzmai-payment-link"
            f"?payment_id={payment_id}"
            f"&redirect_url={urllib.parse.quote(redirect_url or '')}"
            f"&fail_redirect_url={urllib.parse.quote(fail_redirect_url or redirect_url or '')}"
            f"&callback_url={urllib.parse.quote(callback_url or '')}"
            f"&amount={total_amount:.2f}"
            f"&description={urllib.parse.quote(description_str)}"
        )
        logger.info(f"[ATZMAI MOCK] generate_payment_link url={mock_url}")
        return {
            "header": {
                "requestId": "mock-req-123",
                "responseId": "mock-res-123",
                "responseServerTime": "2026-07-31T20:00:00.000Z"
            },
            "body": {
                "url": mock_url,
                "atzmai_payment_id": payment_id
            }
        }

    url = f"{_base_url()}/payments/generatePaymentLink"
    payload = {
        "items": items,
        "customerName": customer_name,
        "email": email,
        "phone": phone or "",
        "language": language,
        "currency": currency.upper(),
        "currencyCode": currency.upper(),
        "currencyId": 2 if currency.upper() == "USD" else 1,
    }
    if redirect_url:
        payload["redirectURL"] = redirect_url
    if fail_redirect_url:
        payload["failRedirectURL"] = fail_redirect_url
    if callback_url:
        payload["callbackUrl"] = callback_url
    if atzmai_client_id:
        payload["atzmaiClientId"] = atzmai_client_id

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=_headers(), json=payload, timeout=30.0)
        if resp.status_code != 200:
            logger.error(f"Atzmai payment link generation failed: {resp.status_code} - {resp.text}")
            raise AtzmaiError(resp.status_code, resp.json() if resp.headers.get("content-type") == "application/json" else resp.text)
        return resp.json()

async def generate_recurring_payment_link(
    amount: float,
    description: str,
    email: str,
    phone: str,
    customer_name: str,
    recurring_period: int,  # 1 - Daily, 2 - Weekly, 3 - Monthly, 4 - Yearly
    payments_count: int,
    start_date: str,  # Format DD/MM/YYYY
    redirect_url: Optional[str] = None,
    callback_url: Optional[str] = None,
    atzmai_client_id: Optional[str] = None,
    currency: str = "USD",
) -> Dict[str, Any]:
    if currency.upper() == "USD":
        rate = await get_usd_to_ils_rate()
        logger.info(f"Converting USD to ILS at rate {rate} for generate_recurring_payment_link")
        amount = round(amount * rate, 2)
        currency = "ILS"

    if is_mock_mode():
        import urllib.parse
        payment_id = f"mock_atz_rec_{uuid.uuid4().hex[:16]}"
        mock_url = (
            f"{settings.APP_PUBLIC_URL}/mock-atzmai-payment-link"
            f"?payment_id={payment_id}"
            f"&redirect_url={urllib.parse.quote(redirect_url or '')}"
            f"&fail_redirect_url={urllib.parse.quote(redirect_url or '')}"
            f"&callback_url={urllib.parse.quote(callback_url or '')}"
            f"&amount={amount:.2f}"
            f"&description={urllib.parse.quote(description)}"
            f"&method=recurring"
        )
        logger.info(f"[ATZMAI MOCK] generate_recurring_payment_link url={mock_url}")
        return {
            "header": {
                "requestId": "mock-req-123",
                "responseId": "mock-res-123",
                "responseServerTime": "2026-07-31T20:00:00.000Z"
            },
            "body": {
                "url": mock_url,
                "atzmai_payment_id": payment_id
            }
        }

    url = f"{_base_url()}/payments/generateRecurringPaymentLink"
    payload = {
        "amount": amount,
        "description": description,
        "email": email,
        "phone": phone,
        "customerName": customer_name,
        "recurringPeriod": recurring_period,
        "paymentsCount": payments_count,
        "startDate": start_date,
        "currency": currency.upper(),
        "currencyCode": currency.upper(),
        "currencyId": 2 if currency.upper() == "USD" else 1,
    }
    if redirect_url:
        payload["redirectURL"] = redirect_url
    if callback_url:
        payload["callbackUrl"] = callback_url
    if atzmai_client_id:
        payload["atzmaiClientId"] = atzmai_client_id

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=_headers(), json=payload, timeout=30.0)
        if resp.status_code != 200:
            logger.error(f"Atzmai recurring payment link generation failed: {resp.status_code} - {resp.text}")
            raise AtzmaiError(resp.status_code, resp.json() if resp.headers.get("content-type") == "application/json" else resp.text)
        return resp.json()

async def generate_bit_payment_link(
    amount: float,
    description: str,
    customer_name: str,
    phone: str,
    email: str,
    language: str = "he",
    callback_url: Optional[str] = None,
    atzmai_client_id: Optional[str] = None,
    currency: str = "USD",
) -> Dict[str, Any]:
    if currency.upper() == "USD":
        rate = await get_usd_to_ils_rate()
        logger.info(f"Converting USD to ILS at rate {rate} for generate_bit_payment_link")
        amount = round(amount * rate, 2)
        currency = "ILS"

    if is_mock_mode():
        import urllib.parse
        payment_id = f"mock_atz_bit_{uuid.uuid4().hex[:16]}"
        mock_url = (
            f"{settings.APP_PUBLIC_URL}/mock-atzmai-payment-link"
            f"?payment_id={payment_id}"
            f"&redirect_url={urllib.parse.quote(callback_url or '')}"
            f"&fail_redirect_url={urllib.parse.quote(callback_url or '')}"
            f"&callback_url={urllib.parse.quote(callback_url or '')}"
            f"&amount={amount:.2f}"
            f"&description={urllib.parse.quote(description)}"
            f"&method=bit"
        )
        logger.info(f"[ATZMAI MOCK] generate_bit_payment_link url={mock_url}")
        return {
            "header": {
                "requestId": "mock-req-123",
                "responseId": "mock-res-123",
                "responseServerTime": "2026-07-31T20:00:00.000Z"
            },
            "body": {
                "url": mock_url,
                "atzmai_payment_id": payment_id
            }
        }

    url = f"{_base_url()}/payments/generateBitPaymentLink"
    payload = {
        "amount": amount,
        "description": description,
        "customerName": customer_name,
        "phone": phone,
        "email": email,
        "language": language,
        "currency": currency.upper(),
        "currencyCode": currency.upper(),
        "currencyId": 2 if currency.upper() == "USD" else 1,
    }
    if callback_url:
        payload["callbackUrl"] = callback_url
    if atzmai_client_id:
        payload["atzmaiClientId"] = atzmai_client_id

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=_headers(), json=payload, timeout=30.0)
        if resp.status_code != 200:
            logger.error(f"Atzmai Bit payment link generation failed: {resp.status_code} - {resp.text}")
            raise AtzmaiError(resp.status_code, resp.json() if resp.headers.get("content-type") == "application/json" else resp.text)
        return resp.json()

async def cancel_subscription(
    atzmai_payment_id: str,
) -> Dict[str, Any]:
    if is_mock_mode():
        logger.info(f"[ATZMAI MOCK] cancel_subscription id={atzmai_payment_id}")
        return {
            "header": {
                "requestId": "mock-req-123",
                "responseId": "mock-res-123",
                "responseServerTime": "2026-07-31T20:00:00.000Z"
            },
            "body": {
                "result": 0
            }
        }

    url = f"{_base_url()}/payments/cancelSubscription"
    payload = {
        "atzmaiPaymentId": atzmai_payment_id,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, headers=_headers(), json=payload, timeout=30.0)
        if resp.status_code != 200:
            logger.error(f"Atzmai cancel subscription failed: {resp.status_code} - {resp.text}")
            raise AtzmaiError(resp.status_code, resp.json() if resp.headers.get("content-type") == "application/json" else resp.text)
        return resp.json()


async def get_invoices(agent_id: int, size: int = 10) -> Dict[str, Any]:
    if is_mock_mode():
        logger.info(f"[ATZMAI MOCK] get_invoices agent_id={agent_id} size={size}")
        return {
            "header": {
                "requestId": "mock-req-123",
                "responseId": f"mock-res-{uuid.uuid4().hex[:12]}",
                "responseServerTime": "2026-07-31T20:00:00.000Z"
            },
            "body": {
                "list": [
                    {
                        "totalAmount": 9.99,
                        "date": "2026-08-01T00:00:00.000Z",
                        "number": 100001,
                        "customer": "DressApp User"
                    }
                ]
            }
        }

    url = f"{_base_url()}/invoices/getInvoices"
    params = {"agentID": agent_id, "size": size}
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_headers(), params=params, timeout=30.0)
        if resp.status_code != 200:
            logger.error(f"Atzmai get_invoices failed: {resp.status_code} - {resp.text}")
            raise AtzmaiError(resp.status_code, resp.json() if resp.headers.get("content-type") == "application/json" else resp.text)
        return resp.json()


async def get_invoice_pdf(agent_id: int, invoice_id: int) -> Dict[str, Any]:
    if is_mock_mode():
        logger.info(f"[ATZMAI MOCK] get_invoice_pdf agent_id={agent_id} invoice_id={invoice_id}")
        return {
            "header": {
                "requestId": "mock-req-123",
                "responseId": f"mock-res-{uuid.uuid4().hex[:12]}",
                "responseServerTime": "2026-07-31T20:00:00.000Z"
            },
            "body": {
                "url": "https://example.com/mock-invoice.pdf"
            }
        }

    url = f"{_base_url()}/invoices/getInvoicePDF"
    params = {"agentID": agent_id, "invoiceID": invoice_id}
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_headers(), params=params, timeout=30.0)
        if resp.status_code != 200:
            logger.error(f"Atzmai get_invoice_pdf failed: {resp.status_code} - {resp.text}")
            raise AtzmaiError(resp.status_code, resp.json() if resp.headers.get("content-type") == "application/json" else resp.text)
        return resp.json()


async def get_receipts(agent_id: int, size: int = 10) -> Dict[str, Any]:
    if is_mock_mode():
        logger.info(f"[ATZMAI MOCK] get_receipts agent_id={agent_id} size={size}")
        return {
            "header": {
                "requestId": "mock-req-123",
                "responseId": f"mock-res-{uuid.uuid4().hex[:12]}",
                "responseServerTime": "2026-07-31T20:00:00.000Z"
            },
            "body": {
                "list": [
                    {
                        "invoiceID": "1-100001",
                        "totalAmount": 9.99,
                        "date": "2026-08-01T00:00:00.000Z",
                        "number": 200001,
                        "customer": "DressApp User"
                    }
                ]
            }
        }

    url = f"{_base_url()}/receipts/getReceipts"
    params = {"agentID": agent_id, "size": size}
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_headers(), params=params, timeout=30.0)
        if resp.status_code != 200:
            logger.error(f"Atzmai get_receipts failed: {resp.status_code} - {resp.text}")
            raise AtzmaiError(resp.status_code, resp.json() if resp.headers.get("content-type") == "application/json" else resp.text)
        return resp.json()


async def get_receipt_pdf(agent_id: int, receipt_id: int) -> Dict[str, Any]:
    if is_mock_mode():
        logger.info(f"[ATZMAI MOCK] get_receipt_pdf agent_id={agent_id} receipt_id={receipt_id}")
        return {
            "header": {
                "requestId": "mock-req-123",
                "responseId": f"mock-res-{uuid.uuid4().hex[:12]}",
                "responseServerTime": "2026-07-31T20:00:00.000Z"
            },
            "body": {
                "url": "https://example.com/mock-receipt.pdf"
            }
        }

    url = f"{_base_url()}/receipts/getReceiptPDF"
    params = {"agentID": agent_id, "receiptID": receipt_id}
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=_headers(), params=params, timeout=30.0)
        if resp.status_code != 200:
            logger.error(f"Atzmai get_receipt_pdf failed: {resp.status_code} - {resp.text}")
            raise AtzmaiError(resp.status_code, resp.json() if resp.headers.get("content-type") == "application/json" else resp.text)
        return resp.json()
