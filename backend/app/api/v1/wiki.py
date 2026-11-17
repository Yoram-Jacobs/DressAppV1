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


def _resolve_safe_wiki_file(rel_dir: str, stem: str) -> Path | None:
    """Resolve a wiki markdown file strictly inside ``WIKI_DIR``."""
    base_dir = WIKI_DIR.resolve()
    try:
        candidate = (base_dir / rel_dir / f"{stem}.md").resolve()
    except (OSError, ValueError):
        return None
    if not candidate.is_relative_to(base_dir):
        return None
    return candidate if candidate.is_file() else None


@router.get("/{lang}/{topic}", response_class=PlainTextResponse)
async def get_wiki_doc(lang: str, topic: str) -> str:
    """Retrieve markdown guide for a specific topic in the requested language.
    
    Falls back to English ('en') if requested language translation is missing.
    """
    topic_clean = topic.replace(".md", "").strip()
    lang_clean = lang.strip().lower()
    if (
        not lang_clean
        or not topic_clean
        or "/" in lang_clean
        or "\\" in lang_clean
        or ".." in lang_clean
        or "/" in topic_clean
        or "\\" in topic_clean
        or ".." in topic_clean
    ):
        raise HTTPException(status_code=400, detail="Invalid wiki topic or language.")

    candidates = [
        _resolve_safe_wiki_file(lang_clean, topic_clean),
        _resolve_safe_wiki_file("en", topic_clean),
        _resolve_safe_wiki_file("en", topic_clean.replace("-", "_")),
        _resolve_safe_wiki_file("en", topic_clean.replace("_", "-")),
    ]
    for target_file in candidates:
        if target_file is not None:
            try:
                return target_file.read_text(encoding="utf-8")
            except Exception as exc:
                logger.warning("Failed to read wiki file %s: %s", target_file, exc)

    raise HTTPException(status_code=404, detail=f"Wiki topic '{topic_clean}' not found.")
