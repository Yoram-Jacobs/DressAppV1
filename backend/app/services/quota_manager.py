"""quota_manager.py - Backward-compatible wrapper delegating to credit_manager.py"""
from typing import Any, Dict, Tuple
from app.services.credit_manager import (
    CreditQuotaStatus,
    QuotaExhaustionError,
    check_operation_quota,
    execute_with_quotas,
    check_quota_status,
    get_quota_config,
)
