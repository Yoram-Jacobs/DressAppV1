"""/api/v1/wiki — localized markdown documentation endpoints."""
from __future__ import annotations

import logging
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wiki", tags=["wiki"])

_THIS_PATH = Path(__file__).resolve()
WIKI_DIR = _THIS_PATH.parents[4] / "wiki"
if not WIKI_DIR.exists():
    WIKI_DIR = _THIS_PATH.parents[3] / "wiki"


@router.get("/{lang}/{topic}", response_class=PlainTextResponse)
async def get_wiki_doc(lang: str, topic: str) -> str:
    """Retrieve markdown guide for a specific topic in the requested language.
    
    Falls back to English ('en') if requested language translation is missing.
    """
    topic_clean = topic.replace(".md", "").strip()
    lang_clean = lang.strip().lower()

    target_file = WIKI_DIR / lang_clean / f"{topic_clean}.md"
    if target_file.is_file():
        try:
            return target_file.read_text(encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to read wiki file %s: %s", target_file, exc)

    # Fallback to English
    fallback_file = WIKI_DIR / "en" / f"{topic_clean}.md"
    if fallback_file.is_file():
        try:
            return fallback_file.read_text(encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to read fallback wiki file %s: %s", fallback_file, exc)

    # Fallback search if topic name has slight differences (e.g. hyphens vs underscores)
    alt_name = topic_clean.replace("-", "_")
    alt_file = WIKI_DIR / "en" / f"{alt_name}.md"
    if alt_file.is_file():
        try:
            return alt_file.read_text(encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to read alt wiki file %s: %s", alt_file, exc)

    alt_dash = topic_clean.replace("_", "-")
    alt_dash_file = WIKI_DIR / "en" / f"{alt_dash}.md"
    if alt_dash_file.is_file():
        try:
            return alt_dash_file.read_text(encoding="utf-8")
        except Exception as exc:
            logger.warning("Failed to read alt dash wiki file %s: %s", alt_dash_file, exc)

    raise HTTPException(status_code=404, detail=f"Wiki topic '{topic_clean}' not found.")
