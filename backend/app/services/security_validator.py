"""security_validator.py — Centralized validation for network requests and file paths.

Provides protection against:
1. Server-Side Request Forgery (SSRF): blocks loopback, internal Docker networks,
   private subnets (RFC 1918), link-local/cloud-metadata addresses (169.254.0.0/16),
   and reserved IP ranges.
2. Directory Traversal / Arbitrary File Access: verifies file paths stay within
   designated storage directories.
"""
from __future__ import annotations

import ipaddress
import logging
import os
from pathlib import Path
import socket
from urllib.parse import urlparse

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
    "metadata.google.internal",
    "instance-data",
}


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
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast or ip.is_unspecified:
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
                if (
                    ip_obj.is_private
                    or ip_obj.is_loopback
                    or ip_obj.is_link_local
                    or ip_obj.is_reserved
                    or ip_obj.is_multicast
                    or ip_obj.is_unspecified
                ):
                    logger.warning("SSRF blocked: resolved hostname '%s' to prohibited IP '%s'", hostname, ip_str)
                    return False
            except ValueError:
                return False

        return True
    except Exception as exc:
        logger.warning("Error evaluating URL safety for '%s': %s", url_str, exc)
        return False


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
