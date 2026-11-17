"""security_validator.py — Centralized validation for network requests and file paths.

Provides protection against:
1. Server-Side Request Forgery (SSRF): blocks loopback, internal Docker networks,
   private subnets (RFC 1918), link-local/cloud-metadata addresses (169.254.0.0/16),
   and reserved IP ranges.
2. Directory Traversal / Arbitrary File Access: verifies file paths stay within
   designated storage directories.
"""
from __future__ import annotations

from dataclasses import dataclass
import ipaddress
import logging
import os
from pathlib import Path
import socket
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

logger = logging.getLogger("dressapp.security_validator")

# Known internal hostnames on docker bridge / VPS
BLOCKED_HOSTNAMES = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "eyes",
    "backend",
    "mongo",
    "caddy",
    "frontend",
    "metadata",
    "metadata.google.internal",
    "instance-data",
}


class SafeFetchError(ValueError):
    """Raised when an external HTTP fetch violates SSRF or size limits."""


@dataclass
class SafeFetchResult:
    """Normalized HTTP response returned by :func:`safe_fetch_external`."""

    status_code: int
    headers: dict[str, str]
    content: bytes
    url: str
    encoding: str = "utf-8"
    _raw_text: str | None = None

    @property
    def text(self) -> str:
        if self._raw_text is not None:
            return self._raw_text
        return self.content.decode(self.encoding or "utf-8", errors="replace")

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            req = httpx.Request("GET", self.url)
            resp = httpx.Response(self.status_code, request=req)
            raise httpx.HTTPStatusError(
                f"HTTP {self.status_code} for {self.url}",
                request=req,
                response=resp,
            )


def _is_prohibited_ip(ip_obj: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Return True if the IP is loopback, private, link-local, multicast, reserved, or IPv4-mapped unsafe."""
    mapped = getattr(ip_obj, "ipv4_mapped", None)
    if mapped is not None and _is_prohibited_ip(mapped):
        return True
    return bool(
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_link_local
        or ip_obj.is_reserved
        or ip_obj.is_multicast
        or ip_obj.is_unspecified
    )


def is_safe_external_url(url: str | None) -> bool:
    """Verify that a URL is safe to fetch via HTTP/HTTPS from the backend.

    Rejects:
    - Non-HTTP/HTTPS schemes (e.g. file://, gopher://, ftp://)
    - Loopback, RFC 1918 private, link-local (cloud metadata), and reserved IPs
    - Known internal docker network hosts
    - Malformed URLs or failed DNS resolutions
    """
    if not url or not isinstance(url, str):
        return False

    url_str = url.strip()
    if "\n" in url_str or "\r" in url_str or "\t" in url_str:
        return False

    try:
        parsed = urlparse(url_str)
        if parsed.scheme.lower() not in ("http", "https"):
            logger.warning("SSRF blocked: non-http(s) scheme '%s' in %s", parsed.scheme, url_str)
            return False

        hostname = parsed.hostname
        if not hostname:
            return False

        host_lower = hostname.lower().strip(".")
        if host_lower in BLOCKED_HOSTNAMES or host_lower.endswith(".local") or host_lower.endswith(".internal"):
            logger.warning("SSRF blocked: prohibited internal hostname '%s'", hostname)
            return False

        # Attempt to parse as literal IP address
        try:
            ip = ipaddress.ip_address(host_lower)
            if _is_prohibited_ip(ip):
                logger.warning("SSRF blocked: literal prohibited IP '%s'", ip)
                return False
        except ValueError:
            # Not an IP literal, resolve via DNS
            pass

        # Resolve hostname via DNS and check all resolved IP addresses
        try:
            addr_info = socket.getaddrinfo(host_lower, None, socket.AF_UNSPEC, socket.SOCK_STREAM)
        except (socket.gaierror, socket.herror, OSError) as exc:
            logger.debug("DNS resolution failed for '%s': %s", host_lower, exc)
            return False

        if not addr_info:
            return False

        for family, _, _, _, sockaddr in addr_info:
            ip_str = sockaddr[0]
            try:
                ip_obj = ipaddress.ip_address(ip_str)
                if _is_prohibited_ip(ip_obj):
                    logger.warning("SSRF blocked: resolved hostname '%s' to prohibited IP '%s'", hostname, ip_str)
                    return False
            except ValueError:
                return False

        return True
    except Exception as exc:
        logger.warning("Error evaluating URL safety for '%s': %s", url_str, exc)
        return False


async def safe_fetch_external(
    url: str,
    *,
    client: httpx.AsyncClient | None = None,
    headers: dict[str, str] | None = None,
    timeout: float | httpx.Timeout = 15.0,
    max_redirects: int = 5,
    max_bytes: int = 10_000_000,
    allow_internal: bool = False,
) -> SafeFetchResult:
    """Fetch a remote URL with initial + per-hop SSRF validation and bounded streaming bytes."""
    current_url = (url or "").strip()
    if not current_url:
        raise SafeFetchError("Empty external URL")

    async def _perform(active_client: httpx.AsyncClient) -> SafeFetchResult:
        target = current_url
        is_real_httpx = getattr(type(active_client), "__module__", "").startswith("httpx")

        for _hop in range(max_redirects + 1):
            if not allow_internal and not is_safe_external_url(target):
                raise SafeFetchError(f"Blocked unsafe external URL: {target[:120]}")

            if is_real_httpx:
                stream_kwargs: dict[str, Any] = {"follow_redirects": False}
                if headers is not None and client is not None:
                    stream_kwargs["headers"] = headers
                async with active_client.stream("GET", target, **stream_kwargs) as resp:
                    if resp.status_code in (301, 302, 303, 307, 308):
                        location = resp.headers.get("location")
                        if not location:
                            raise SafeFetchError(f"Redirect without Location header from {target[:120]}")
                        target = urljoin(target, location.strip())
                        continue

                    cl_header = (resp.headers.get("content-length") or "").strip()
                    if cl_header.isdigit() and int(cl_header) > max_bytes:
                        raise SafeFetchError(
                            f"Remote response too large ({int(cl_header)} > {max_bytes} bytes)"
                        )

                    buf = bytearray()
                    async for chunk in resp.aiter_bytes():
                        buf.extend(chunk)
                        if len(buf) > max_bytes:
                            raise SafeFetchError(
                                f"Remote response exceeded maximum {max_bytes} bytes"
                            )

                    resp_headers = {k.lower(): v for k, v in resp.headers.items()}
                    return SafeFetchResult(
                        status_code=resp.status_code,
                        headers=resp_headers,
                        content=bytes(buf),
                        url=str(resp.url or target),
                        encoding=resp.encoding or "utf-8",
                    )
            else:
                # Test double / injected AsyncMock path preserves unit test compatibility
                req_kwargs: dict[str, Any] = {}
                if headers and client is not None:
                    req_kwargs["headers"] = headers
                resp = await active_client.get(target, **req_kwargs)
                if resp.status_code in (301, 302, 303, 307, 308):
                    location = (resp.headers or {}).get("location") or (resp.headers or {}).get("Location")
                    if not location:
                        raise SafeFetchError(f"Redirect without Location header from {target[:120]}")
                    target = urljoin(target, str(location).strip())
                    continue

                raw_bytes = getattr(resp, "content", b"")
                if raw_bytes is None:
                    raw_bytes = b""
                if isinstance(raw_bytes, str):
                    raw_bytes = raw_bytes.encode("utf-8")
                if len(raw_bytes) > max_bytes:
                    raise SafeFetchError(
                        f"Remote response exceeded maximum {max_bytes} bytes"
                    )

                resp_headers = {str(k).lower(): v for k, v in dict(getattr(resp, "headers", {}) or {}).items()}
                raw_text = getattr(resp, "text", None)
                return SafeFetchResult(
                    status_code=int(resp.status_code),
                    headers=resp_headers,
                    content=bytes(raw_bytes),
                    url=str(getattr(resp, "url", None) or target),
                    encoding=getattr(resp, "encoding", None) or "utf-8",
                    _raw_text=raw_text if isinstance(raw_text, str) else None,
                )

        raise SafeFetchError(f"Exceeded max redirects ({max_redirects}) for {current_url[:120]}")

    if client is not None:
        return await _perform(client)

    client_kwargs: dict[str, Any] = {"timeout": timeout, "follow_redirects": False}
    if headers is not None:
        client_kwargs["headers"] = headers
    async with httpx.AsyncClient(**client_kwargs) as new_client:
        return await _perform(new_client)


def is_safe_file_path(base_dir: str | Path, target_path: str | Path) -> bool:
    """Verify that target_path strictly resolves within base_dir.

    Prevents directory traversal attacks via '../' segments or symlinks.
    """
    try:
        base = Path(base_dir).resolve()
        target = Path(target_path).resolve()
        return os.path.commonpath([str(base), str(target)]) == str(base)
    except Exception as exc:
        logger.warning("Error evaluating path safety for '%s' in '%s': %s", target_path, base_dir, exc)
        return False


MAX_SHARE_CARD_BYTES = 2 * 1024 * 1024  # 2 MB cap
ALLOWED_SHARE_CARD_FORMATS = frozenset({"PNG", "JPEG", "WEBP"})
_SHARE_CARD_MIME_BY_FORMAT = {
    "PNG": "image/png",
    "JPEG": "image/jpeg",
    "WEBP": "image/webp",
}


def _detect_share_card_format(img_bytes: bytes) -> str | None:
    """Verify binary payload is a valid PNG/JPEG/WEBP image and return its format name."""
    import io
    from PIL import Image, UnidentifiedImageError

    try:
        with Image.open(io.BytesIO(img_bytes)) as im:
            fmt = (im.format or "").upper()
            im.verify()
        return fmt if fmt in ALLOWED_SHARE_CARD_FORMATS else None
    except (UnidentifiedImageError, Exception):
        return None


def validate_share_card_b64(raw_b64: str) -> str:
    """Validate and bound a base64-encoded raster share-card image (PNG, JPEG, or WebP)."""
    import base64
    from fastapi import HTTPException

    if not raw_b64 or not isinstance(raw_b64, str):
        raise HTTPException(status_code=400, detail="image_b64 is required")
    payload = raw_b64.strip()
    if payload.startswith("data:"):
        header, sep, b64_part = payload.partition(",")
        if not sep or ";base64" not in header.lower():
            raise HTTPException(status_code=400, detail="Malformed image data URL")
        mime_part = header[5:].split(";", 1)[0].strip().lower()
        if mime_part not in {"image/png", "image/jpeg", "image/jpg", "image/webp"}:
            raise HTTPException(status_code=415, detail="Only PNG, JPEG, and WebP share cards are allowed")
        payload = b64_part.strip()
    if len(payload) > (MAX_SHARE_CARD_BYTES * 4 // 3) + 64:
        raise HTTPException(status_code=413, detail="Share card exceeds maximum 2 MB limit")
    try:
        img_bytes = base64.b64decode(payload, validate=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 share card payload") from exc
    if len(img_bytes) > MAX_SHARE_CARD_BYTES:
        raise HTTPException(status_code=413, detail="Share card exceeds maximum 2 MB limit")
    fmt = _detect_share_card_format(img_bytes)
    if fmt is None:
        # Distinguish syntactically corrupt images vs unsupported formats where detectable
        import io
        from PIL import Image, UnidentifiedImageError

        try:
            with Image.open(io.BytesIO(img_bytes)) as im:
                im.verify()
        except (UnidentifiedImageError, Exception) as exc:
            raise HTTPException(status_code=400, detail="Share card payload is not a valid raster image") from exc
        raise HTTPException(status_code=415, detail="Unsupported share card image format")
    return raw_b64.strip()


def decode_share_card_image(raw_b64: str) -> tuple[bytes, str]:
    """Decode and raster-verify stored share card bytes and return (bytes, safe_media_type)."""
    import base64
    from fastapi import HTTPException

    b64_data = str(raw_b64 or "").strip()
    if "," in b64_data:
        b64_data = b64_data.split(",", 1)[1].strip()
    if not b64_data or len(b64_data) > (MAX_SHARE_CARD_BYTES * 4 // 3) + 1024:
        raise HTTPException(status_code=404, detail="Invalid share card image")
    try:
        img_bytes = base64.b64decode(b64_data)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Invalid share card image") from exc
    fmt = _detect_share_card_format(img_bytes)
    if fmt is None:
        raise HTTPException(status_code=404, detail="Invalid share card image")
    return img_bytes, _SHARE_CARD_MIME_BY_FORMAT[fmt]
