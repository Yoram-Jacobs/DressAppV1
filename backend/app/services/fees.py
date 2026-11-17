"""Marketplace fee math aligned with live PayPal processing rates.

Keeps marketplace pricing logic in one place so listing net-payout previews
and actual PayPal checkout/payout math always agree.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.config import settings


@dataclass
class FeeBreakdown:
    gross_cents: int
    stripe_fee_cents: int  # Backward-compatible field populated with PayPal processing fee
    net_after_stripe_cents: int
    platform_fee_percent: float
    platform_fee_cents: int
    seller_net_cents: int
    platform_fee_applied_after: str = "paypal_processing_fee"
    processing_fee_cents: int | None = None

    def __post_init__(self) -> None:
        if self.processing_fee_cents is None:
            self.processing_fee_cents = self.stripe_fee_cents

    def to_dict(self) -> dict:
        return self.__dict__.copy()


def compute_fees(gross_cents: int) -> FeeBreakdown:
    if gross_cents < 0:
        raise ValueError("gross_cents must be non-negative")
    if gross_cents == 0:
        processing_fee = 0
    else:
        processing_pct = settings.PAYPAL_PROCESSING_FEE_PERCENT / 100.0
        processing_fixed = settings.PAYPAL_PROCESSING_FEE_FIXED_CENTS
        processing_fee = int(round(gross_cents * processing_pct)) + processing_fixed

    net_after_processing = max(gross_cents - processing_fee, 0)
    platform_pct = settings.PAYPAL_PLATFORM_FEE_PERCENT
    platform_fee = int(round(net_after_processing * (platform_pct / 100.0)))
    seller_net = max(net_after_processing - platform_fee, 0)

    return FeeBreakdown(
        gross_cents=gross_cents,
        stripe_fee_cents=processing_fee,
        processing_fee_cents=processing_fee,
        net_after_stripe_cents=net_after_processing,
        platform_fee_percent=platform_pct,
        platform_fee_cents=platform_fee,
        seller_net_cents=seller_net,
        platform_fee_applied_after="paypal_processing_fee",
    )
