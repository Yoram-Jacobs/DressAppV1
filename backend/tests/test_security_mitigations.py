"""test_security_mitigations.py — Comprehensive tests for DressApp security architecture remediations.

Covers:
1. SSRF prevention (is_safe_external_url)
2. Directory Traversal prevention (is_safe_file_path)
3. OAuth Mobile Return URL allowlisting (_validate_return_url)
4. Internal Token fail-closed authentication (verify_internal_token)
5. Retirement of Dev-Bypass & Production lock
"""
import pytest
from unittest.mock import patch
from pathlib import Path
from fastapi import HTTPException

from app.services.security_validator import is_safe_external_url, is_safe_file_path
from app.api.v1.google_auth import _validate_return_url
from app.api.v1.internal import verify_internal_token
from app.api.v1.auth import router as auth_router
from app.config import settings


# ---------------------------------------------------------------------------
# 1. SSRF & Scheme Validation
# ---------------------------------------------------------------------------
def test_ssrf_prohibited_hostnames():
    assert is_safe_external_url("http://localhost/test") is False
    assert is_safe_external_url("http://127.0.0.1:8001/api/v1/health") is False
    assert is_safe_external_url("http://0.0.0.0:27017") is False
    assert is_safe_external_url("http://eyes:7860/predict") is False
    assert is_safe_external_url("http://mongo:27017") is False
    assert is_safe_external_url("http://backend:8001") is False
    assert is_safe_external_url("http://caddy:80") is False


def test_ssrf_prohibited_ip_ranges():
    # Cloud metadata (AWS / GCP / Azure / DigitalOcean / Hetzner)
    assert is_safe_external_url("http://169.254.169.254/latest/meta-data/") is False
    # RFC 1918 Private networks
    assert is_safe_external_url("http://10.0.0.1/admin") is False
    assert is_safe_external_url("http://192.168.1.1/router") is False
    assert is_safe_external_url("http://172.16.0.5:8080") is False
    assert is_safe_external_url("http://172.28.0.2:27017") is False  # Docker bridge default subnet


def test_ssrf_prohibited_schemes_and_payloads():
    assert is_safe_external_url("file:///etc/passwd") is False
    assert is_safe_external_url("gopher://127.0.0.1:25") is False
    assert is_safe_external_url("ftp://example.com/test.jpg") is False
    assert is_safe_external_url("javascript:alert(1)") is False
    assert is_safe_external_url("http://example.com\r\nHost: evil.com") is False
    assert is_safe_external_url("") is False
    assert is_safe_external_url(None) is False


def test_ssrf_permitted_public_urls():
    # Public domains resolving to non-private IPs
    assert is_safe_external_url("https://example.com/photo.jpg") is True
    assert is_safe_external_url("https://images.unsplash.com/photo-12345") is True


# ---------------------------------------------------------------------------
# 2. Path Traversal Validation
# ---------------------------------------------------------------------------
def test_path_traversal_blocking(tmp_path):
    base_dir = tmp_path / "uploads"
    base_dir.mkdir()
    safe_file = base_dir / "items" / "2026" / "photo.webp"
    safe_file.parent.mkdir(parents=True)
    safe_file.write_text("ok")

    # Safe path within base_dir
    assert is_safe_file_path(base_dir, safe_file) is True

    # Traversal attempt escaping base_dir
    escaped_path = base_dir / ".." / "secret.env"
    assert is_safe_file_path(base_dir, escaped_path) is False

    deep_escape = base_dir / "items" / ".." / ".." / ".." / "etc" / "passwd"
    assert is_safe_file_path(base_dir, deep_escape) is False


# ---------------------------------------------------------------------------
# 3. OAuth Mobile Return URL Validation
# ---------------------------------------------------------------------------
def test_oauth_return_url_allowlist():
    # Valid mobile schemes
    assert _validate_return_url("dressapp://auth/callback") == "dressapp://auth/callback"
    assert _validate_return_url("exp://192.168.1.15:8081") == "exp://192.168.1.15:8081"
    assert _validate_return_url("exps://expo.dev/@test/dressapp") == "exps://expo.dev/@test/dressapp"

    # Malicious or untrusted targets
    assert _validate_return_url("https://attacker.com/steal#token=") is None
    assert _validate_return_url("http://evil.com") is None
    assert _validate_return_url("javascript:alert(1)") is None
    assert _validate_return_url("dressapp://auth/callback\r\nInjected: True") is None
    assert _validate_return_url("") is None
    assert _validate_return_url(None) is None


# ---------------------------------------------------------------------------
# 4. Internal API Fail-Closed Authentication
# ---------------------------------------------------------------------------
def test_verify_internal_token_fail_closed_when_unset():
    with patch.object(settings, "EYES_API_TOKEN", ""):
        with pytest.raises(HTTPException) as exc_info:
            verify_internal_token("Bearer any-token")
        assert exc_info.value.status_code == 503
        assert "unconfigured" in exc_info.value.detail.lower()


def test_verify_internal_token_auth_checks():
    test_secret = "test-secret-internal-token-12345"
    with patch.object(settings, "EYES_API_TOKEN", test_secret):
        # Missing header
        with pytest.raises(HTTPException) as exc1:
            verify_internal_token(None)
        assert exc1.value.status_code == 401

        # Invalid header format
        with pytest.raises(HTTPException) as exc2:
            verify_internal_token("Basic token123")
        assert exc2.value.status_code == 401

        # Incorrect token
        with pytest.raises(HTTPException) as exc3:
            verify_internal_token("Bearer wrong-token")
        assert exc3.value.status_code == 403

        # Correct token
        assert verify_internal_token(f"Bearer {test_secret}") is True


# ---------------------------------------------------------------------------
# 5. Dev Bypass Retirement
# ---------------------------------------------------------------------------
def test_dev_bypass_permanently_retired():
    assert settings.ALLOW_DEV_BYPASS is False
    # Ensure route is not registered on the auth router
    registered_routes = [route.path for route in auth_router.routes]
    assert "/auth/dev-bypass" not in registered_routes
    assert "/dev-bypass" not in registered_routes
