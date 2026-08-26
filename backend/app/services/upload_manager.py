"""upload_manager.py — Object-storage abstraction for DressApp media.

Production backend (Cloudflare R2 / any S3-compatible bucket):
  Set the five R2_* env vars in /srv/AI-Stylist/deploy/.env.
  Files are uploaded to R2 and a public CDN URL is returned.

Development fallback (local disk):
  When R2_ACCESS_KEY_ID is absent, bytes are written to
  backend/static/uploads/ and a /static/uploads/<path> URL is returned.
  This mirrors the previous stub behaviour so dev setups need no changes.

Migration note:
  Existing items with inline base64 data-URLs continue to work unchanged.
  New items saved after this change will carry CDN URLs instead.
  A one-off backfill script can migrate old items later if required.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

import aiofiles

logger = logging.getLogger(__name__)

# Local-disk fallback directory (mirrors previous stub behaviour).
_BUCKET_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "static", "uploads")
os.makedirs(_BUCKET_DIR, exist_ok=True)

# Public alias — used by closet_service.read_image_bytes_from_url to resolve
# /static/uploads/ URL paths back to local file paths during development.
BUCKET_DIR = _BUCKET_DIR


def _r2_configured() -> bool:
    """Return True iff the R2 env vars are all present."""
    from app.config import settings
    return bool(
        settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_ENDPOINT_URL
    )


def _make_key(extension: str) -> str:
    """Generate a deterministic, collision-resistant object key."""
    today = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    return f"items/{today}/{uuid.uuid4().hex}.{extension}"


async def _upload_to_r2(file_bytes: bytes, mime_type: str, key: str) -> str:
    """Upload *file_bytes* to R2 and return the public CDN URL.

    Uses ``aioboto3`` (async wrapper around botocore/boto3).

    Raises on upload failure — caller should catch and fall back.
    """
    try:
        import aioboto3  # type: ignore[import]
    except ImportError as exc:
        raise RuntimeError(
            "aioboto3 is not installed — cannot upload to R2. "
            "Add 'aioboto3' to requirements.txt."
        ) from exc

    from app.config import settings

    session = aioboto3.Session()
    async with session.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    ) as s3:
        await s3.put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=file_bytes,
            ContentType=mime_type,
            # R2 serves objects via the public bucket domain; no ACL needed.
            # For AWS S3, add: ACL="public-read"
        )

    public_base = settings.R2_PUBLIC_URL or f"{settings.R2_ENDPOINT_URL}/{settings.R2_BUCKET_NAME}"
    return f"{public_base.rstrip('/')}/{key}"


async def _upload_to_local(file_bytes: bytes, extension: str, key: str) -> str:
    """Write *file_bytes* to the local static/uploads directory.

    Returns a /static/uploads/<key> URL path that FastAPI's StaticFiles
    middleware serves from the same backend process.
    """
    local_path = os.path.join(_BUCKET_DIR, key.replace("/", os.sep))
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    async with aiofiles.open(local_path, "wb") as f:
        await f.write(file_bytes)
    return f"/static/uploads/{key}"


class UploadManager:
    """Async, provider-agnostic media uploader.

    ``upload_bytes`` is the single entry point for the whole backend.
    It selects R2 or local disk based on whether the R2 env vars are set,
    so no call-site changes are needed when toggling providers.
    """

    @staticmethod
    async def upload_bytes(file_bytes: bytes, mime_type: str, extension: str) -> str:
        """Upload *file_bytes* and return a public URL.

        Args:
            file_bytes:  Raw binary content.
            mime_type:   MIME type string, e.g. ``"image/webp"``.
            extension:   File extension WITHOUT leading dot, e.g. ``"webp"``.

        Returns:
            A full URL string — either a CDN URL (R2) or a /static/... path (local).
        """
        key = _make_key(extension)

        if _r2_configured():
            try:
                url = await _upload_to_r2(file_bytes, mime_type, key)
                logger.debug("UploadManager: R2 upload ok key=%s", key)
                return url
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "UploadManager: R2 upload failed (%s); falling back to local disk", exc
                )

        # Fall back to local disk (dev or R2 outage).
        url = await _upload_to_local(file_bytes, extension, key)
        logger.debug("UploadManager: local upload key=%s", key)
        return url

    @staticmethod
    def get_public_url(key: str) -> str:
        """Reconstruct the public URL for an already-uploaded key."""
        from app.config import settings
        if _r2_configured() and settings.R2_PUBLIC_URL:
            return f"{settings.R2_PUBLIC_URL.rstrip('/')}/{key}"
        return f"/static/uploads/{key}"
