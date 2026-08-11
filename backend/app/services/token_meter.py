"""token_meter.py - Backward-compatible wrapper delegating to credit_manager.py"""
from enum import Enum
from typing import Any, Dict
from app.services.credit_manager import (
    TokenMeter,
    estimate_token_cost,
)

class OperationType(str, Enum):
    AUTO_TAGGING = "auto_tagging"
    OUTFIT_RECOMMENDATION = "outfit_recommendation"
    STYLIST_CHAT = "stylist_chat"
    BOOKMARKLET_MIGRATION = "bookmarklet_migration"
    BODY_MEASUREMENT = "body_measurement"
    BACKGROUND_REMOVAL = "background_removal"


class Provider(str, Enum):
    GEMINI_FLASH = "gemini-flash"
    GEMINI_PRO = "gemini-pro"
    CLAUDE_HAIKU = "claude-haiku"
    CLAUDE_SONNET = "claude-sonnet"
    GPT4O = "gpt4o"
