"""Regression tests for P0 security, authentication, SSRF, content-type, and ownership hardening."""

from __future__ import annotations

import base64
import hashlib
import hmac
import io
import os
import sys
import types
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET", "pytest-p0-security-hardening-secret-123456")

from tests.test_p0_remediations import _FakeCollection, _FakeDB  # noqa: E402


class _StatusChecksCursor:
    def __init__(self, docs: list[dict]) -> None:
        self._docs = docs

    async def to_list(self, limit: int) -> list[dict]:
        return list(self._docs[:limit])


class _StatusChecksCollection:
    def __init__(self) -> None:
        self.docs: list[dict] = []

    async def insert_one(self, doc: dict) -> SimpleNamespace:
        self.docs.append(dict(doc))
        return SimpleNamespace(inserted_id=doc.get("id") or len(self.docs))

    def find(self, *_args, **_kwargs) -> _StatusChecksCursor:
        return _StatusChecksCursor([{k: v for k, v in d.items() if k != "_id"} for d in self.docs])


def _ensure_optional_cv2_stub() -> None:
    if "cv2" in sys.modules:
        return
    try:
        import cv2  # noqa: F401
    except ImportError:
        # Lightweight Windows test Python lacks binary cv2; never wrap C extensions like numpy in patch.dict(sys.modules).
        sys.modules["cv2"] = types.ModuleType("cv2")


def _make_png_bytes(color=(30, 80, 140, 255), size=(16, 16)) -> bytes:
    im = Image.new("RGBA", size, color)
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


VALID_PNG = _make_png_bytes()
VALID_PNG_B64 = base64.b64encode(VALID_PNG).decode("ascii")


# ---------------------------------------------------------------------------
# 1. image_generation.py: Auth & SSRF
# ---------------------------------------------------------------------------
def test_image_generation_requires_admin_and_blocks_ssrf() -> None:
    from app.api.v1 import image_generation as ig_api
    from app.services.auth import require_admin

    app = FastAPI()
    app.include_router(ig_api.router, prefix="/api/v1")
    client = TestClient(app)

    # Unauthenticated -> 401
    assert client.get("/api/v1/image-generation/health?provider=mock").status_code == 401
    assert (
        client.post(
            "/api/v1/image-generation/test",
            data={"prompt": "shirt", "provider": "mock"},
        ).status_code
        == 401
    )

    # Non-admin -> 403 (via get_current_user with roles=['user'])
    from app.services.auth import get_current_user

    app.dependency_overrides[get_current_user] = lambda: {"id": "u1", "roles": ["user"]}
    assert (
        client.post(
            "/api/v1/image-generation/test",
            data={"prompt": "shirt", "provider": "mock"},
        ).status_code
        == 403
    )
    app.dependency_overrides.clear()

    # Admin + SSRF URL -> 400 before any network fetch
    app.dependency_overrides[require_admin] = lambda: {"id": "admin-1", "roles": ["admin"]}
    ssrf_resp = client.post(
        "/api/v1/image-generation/test",
        data={
            "prompt": "edit blazer",
            "provider": "mock",
            "image_url": "http://169.254.169.254/latest/meta-data/",
        },
    )
    assert ssrf_resp.status_code == 400
    assert "prohibited" in ssrf_resp.json()["detail"].lower()

    # Admin + safe external image fetch succeeds when mocked
    fake_fetch = SimpleNamespace(
        status_code=200,
        headers={"content-type": "image/png"},
        content=VALID_PNG,
    )
    with (
        patch.object(ig_api, "is_safe_external_url", return_value=True),
        patch.object(ig_api, "safe_fetch_external", AsyncMock(return_value=fake_fetch)),
        patch.object(ig_api.UploadManager, "upload_bytes", AsyncMock(return_value="/static/uploads/mock.png")),
    ):
        ok_resp = client.post(
            "/api/v1/image-generation/test",
            data={
                "prompt": "clean shirt",
                "provider": "mock",
                "image_url": "https://cdn.example.com/shirt.png",
            },
        )
        assert ok_resp.status_code == 200
        assert ok_resp.json()["image_url"] == "/static/uploads/mock.png"


# ---------------------------------------------------------------------------
# 2. trends.py: image-proxy auth/allowlist + raster Content-Type & XSS blocking
# ---------------------------------------------------------------------------
def test_trends_image_proxy_blocks_unregistered_urls_and_svg_html_xss() -> None:
    from app.api.v1 import trends as trends_api
    from app.config import settings
    from app.services.auth import get_current_user_optional

    trends_api._proxy_rate_buckets.clear()
    fake_db = _FakeDB()
    fake_db.trend_reports = MagicMock()
    fake_db.trend_reports.find_one = AsyncMock(return_value=None)

    app = FastAPI()
    app.include_router(trends_api.router, prefix="/api/v1")
    active_user = [None]
    app.dependency_overrides[get_current_user_optional] = lambda: active_user[0]

    with patch.object(trends_api, "get_db", return_value=fake_db):
        client = TestClient(app)

        # Unauthenticated & unregistered external URL -> 403
        unauth = client.get("/api/v1/trends/image-proxy?url=https://evil.example/xss.html")
        assert unauth.status_code == 403

        # Authenticated caller requesting SVG -> 415 rejected
        active_user[0] = {"id": "u-trend"}
        svg_fetch = SimpleNamespace(
            status_code=200,
            headers={"content-type": "image/svg+xml"},
            content=b'<svg onload="alert(1)"></svg>',
        )
        with (
            patch("app.services.security_validator.is_safe_external_url", return_value=True),
            patch("app.services.security_validator.safe_fetch_external", AsyncMock(return_value=svg_fetch)),
        ):
            svg_resp = client.get("/api/v1/trends/image-proxy?url=https://cdn.example.com/evil.svg")
            assert svg_resp.status_code == 415

        # Authenticated caller requesting HTML masquerading as PNG -> 415 rejected
        fake_png_fetch = SimpleNamespace(
            status_code=200,
            headers={"content-type": "image/png"},
            content=b"<html><script>alert(1)</script></html>",
        )
        with (
            patch("app.services.security_validator.is_safe_external_url", return_value=True),
            patch("app.services.security_validator.safe_fetch_external", AsyncMock(return_value=fake_png_fetch)),
        ):
            bad_bytes = client.get("/api/v1/trends/image-proxy?url=https://cdn.example.com/bad.png")
            assert bad_bytes.status_code == 415

        # Unauthenticated caller WITH valid HMAC sig + real raster PNG -> 200 + sandbox CSP + nosniff
        active_user[0] = None
        target_url = "https://cdn.example.com/runway.png"
        sig = hmac.new(
            settings.JWT_SECRET.encode("utf-8"),
            f"trend_img:{target_url}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()[:32]
        good_fetch = SimpleNamespace(
            status_code=200,
            headers={"content-type": "image/png"},
            content=VALID_PNG,
        )
        with (
            patch("app.services.security_validator.is_safe_external_url", return_value=True),
            patch("app.services.security_validator.safe_fetch_external", AsyncMock(return_value=good_fetch)),
        ):
            ok = client.get(f"/api/v1/trends/image-proxy?url={target_url}&sig={sig}")
            assert ok.status_code == 200
            assert ok.headers["content-type"].startswith("image/png")
            assert ok.headers["x-content-type-options"] == "nosniff"
            assert "sandbox" in ok.headers["content-security-policy"]
            assert "access-control-allow-origin" not in {k.lower() for k in ok.headers}


# ---------------------------------------------------------------------------
# 3. dressing_room.py: Auth + traversal protection on avatar_id / template_id / filename
# ---------------------------------------------------------------------------
def test_dressing_room_requires_auth_and_blocks_traversal() -> None:
    from app.api.v1 import dressing_room as dr_api
    from app.services.auth import get_current_user

    app = FastAPI()
    app.include_router(dr_api.router, prefix="/api/v1")
    client = TestClient(app)

    # All 3 routes reject unauthenticated calls -> 401
    assert client.post("/api/v1/dressing-room/avatar", json={}).status_code == 401
    assert client.post("/api/v1/dressing-room/fit-outfit", json={"avatar_id": "avatar_female_1234", "items": []}).status_code == 401
    assert client.get("/api/v1/dressing-room/models/avatar_female_1234.glb").status_code == 401

    app.dependency_overrides[get_current_user] = lambda: {"id": "u-dr"}

    # Traversal avatar_id -> 422 Pydantic pattern rejection
    bad_avatar = client.post(
        "/api/v1/dressing-room/fit-outfit",
        json={"avatar_id": "../../backend/.env", "items": []},
    )
    assert bad_avatar.status_code == 422

    # Traversal template_id -> 400
    bad_tpl = client.post(
        "/api/v1/dressing-room/fit-outfit",
        json={
            "avatar_id": "avatar_female_aa16",
            "items": [{"category": "top", "layer_index": 1, "template_id": "../../../secret"}],
        },
    )
    assert bad_tpl.status_code == 400

    # Invalid model filename -> 400
    bad_file = client.get("/api/v1/dressing-room/models/secret.env")
    assert bad_file.status_code == 400


# ---------------------------------------------------------------------------
# 4. outfits.py: Share-card ownership check & raster image validation
# ---------------------------------------------------------------------------
def test_outfits_share_card_ownership_and_validation() -> None:
    from app.api.v1 import outfits as outfits_api
    from app.services.auth import get_current_user

    fake_db = _FakeDB()
    fake_db.outfits = _FakeCollection([{"id": "out-owned", "user_id": "owner-1"}])
    fake_db.shared_outfits = _FakeCollection(
        [
            {"id": "sh-1", "owner_id": "owner-1", "outfit": {"name": "Look"}},
            {"id": "sh-legacy-no-owner", "outfit": {"name": "Legacy"}},
        ]
    )

    active_user = [{"id": "attacker-2"}]
    app = FastAPI()
    app.include_router(outfits_api.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: active_user[0]

    with patch.object(outfits_api, "get_db", return_value=fake_db):
        client = TestClient(app)

        # Attacker cannot overwrite owner-1's shared outfit share-card -> 403
        idor = client.post(
            "/api/v1/outfits/sh-1/share-card",
            json={"image_b64": f"data:image/png;base64,{VALID_PNG_B64}"},
        )
        assert idor.status_code == 403
        assert "share_card_b64" not in fake_db.shared_outfits.docs[0]

        # Attacker cannot overwrite ownerless legacy shared outfit -> 403 (fail closed)
        idor_legacy = client.post(
            "/api/v1/outfits/sh-legacy-no-owner/share-card",
            json={"image_b64": VALID_PNG_B64},
        )
        assert idor_legacy.status_code == 403

        # Legitimate owner CAN update share card, and SVG/non-image is blocked -> 415/400
        active_user[0] = {"id": "owner-1"}
        svg_b64 = base64.b64encode(b"<svg><script>alert(1)</script></svg>").decode("ascii")
        bad_svg = client.post(
            "/api/v1/outfits/sh-1/share-card",
            json={"image_b64": f"data:image/svg+xml;base64,{svg_b64}"},
        )
        assert bad_svg.status_code == 415

        ok = client.post(
            "/api/v1/outfits/sh-1/share-card",
            json={"image_b64": f"data:image/png;base64,{VALID_PNG_B64}"},
        )
        assert ok.status_code == 200
        assert fake_db.shared_outfits.docs[0]["share_card_b64"].startswith("data:image/png;base64,")

        # Serving image includes nosniff + sandbox CSP
        img_resp = client.get("/api/v1/outfits/sh-1/share-card/image")
        assert img_resp.status_code == 200
        assert img_resp.headers["x-content-type-options"] == "nosniff"
        assert "sandbox" in img_resp.headers["content-security-policy"]


def test_share_outfit_card_ownership_validation_and_nosniff() -> None:
    from app.api.v1 import share as share_api
    from app.services.auth import get_current_user

    svg_b64 = base64.b64encode(b"<svg><script>alert(1)</script></svg>").decode("ascii")
    fake_db = _FakeDB()
    fake_db.outfits = _FakeCollection([{"id": "out-owned", "user_id": "owner-1"}])
    fake_db.shared_outfits = _FakeCollection(
        [
            {"id": "sh-1", "owner_id": "owner-1", "outfit": {"name": "Look"}},
            {"id": "sh-legacy-no-owner", "outfit": {"name": "Legacy"}},
            {
                "id": "sh-legacy-svg",
                "owner_id": "owner-1",
                "outfit": {"name": "OldSVG"},
                "share_card_b64": f"data:image/svg+xml;base64,{svg_b64}",
            },
        ]
    )

    app = FastAPI()
    app.include_router(share_api.router, prefix="/api/v1")

    with patch.object(share_api, "get_db", return_value=fake_db):
        client = TestClient(app)

        # Unauthenticated upload -> 401
        assert (
            client.post(
                "/api/v1/share/outfit/sh-1/share-card",
                json={"image_b64": f"data:image/png;base64,{VALID_PNG_B64}"},
            ).status_code
            == 401
        )

        # Attacker IDOR on another owner's shared outfit -> 403
        active_user = [{"id": "attacker-2"}]
        app.dependency_overrides[get_current_user] = lambda: active_user[0]
        assert (
            client.post(
                "/api/v1/share/outfit/sh-1/share-card",
                json={"image_b64": f"data:image/png;base64,{VALID_PNG_B64}"},
            ).status_code
            == 403
        )
        assert "share_card_b64" not in fake_db.shared_outfits.docs[0]

        # Attacker overwrite of ownerless legacy doc -> 403
        assert (
            client.post(
                "/api/v1/share/outfit/sh-legacy-no-owner/share-card",
                json={"image_b64": VALID_PNG_B64},
            ).status_code
            == 403
        )

        # Owner uploading SVG -> 415, oversized -> 413
        active_user[0] = {"id": "owner-1"}
        assert (
            client.post(
                "/api/v1/share/outfit/sh-1/share-card",
                json={"image_b64": f"data:image/svg+xml;base64,{svg_b64}"},
            ).status_code
            == 415
        )
        huge_b64 = base64.b64encode(b"A" * (2 * 1024 * 1024 + 64)).decode("ascii")
        assert (
            client.post(
                "/api/v1/share/outfit/sh-1/share-card",
                json={"image_b64": huge_b64},
            ).status_code
            == 413
        )

        # Owner uploading valid PNG succeeds and image endpoint serves PNG + nosniff + sandbox CSP
        ok = client.post(
            "/api/v1/share/outfit/sh-1/share-card",
            json={"image_b64": f"data:image/png;base64,{VALID_PNG_B64}"},
        )
        assert ok.status_code == 200
        img_resp = client.get("/api/v1/share/outfit/sh-1/image")
        assert img_resp.status_code == 200
        assert img_resp.headers["content-type"].startswith("image/png")
        assert img_resp.headers["x-content-type-options"] == "nosniff"
        assert "sandbox" in img_resp.headers["content-security-policy"]

        # Legacy stored SVG fails closed when requested -> 404
        assert client.get("/api/v1/share/outfit/sh-legacy-svg/image").status_code == 404


# ---------------------------------------------------------------------------
# 5. ads.py: Admin-disable bypass lock, funded activation & regex escaping
# ---------------------------------------------------------------------------
def test_ads_ownership_disable_lock_credit_gate_and_regex_escape() -> None:
    from app.api.v1 import ads as ads_api
    from app.services.auth import get_current_user

    fake_db = _FakeDB()
    fake_db.ad_campaigns.docs.append(
        {
            "id": "camp-disabled",
            "owner_id": "pro-1",
            "status": "disabled",
            "currency": "USD",
            "creative": {"headline": "Old"},
        }
    )
    fake_db.ad_campaigns.docs.append(
        {
            "id": "camp-draft",
            "owner_id": "pro-1",
            "status": "draft",
            "currency": "USD",
            "creative": {"headline": "Draft"},
        }
    )

    app = FastAPI()
    app.include_router(ads_api.router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id": "pro-1",
        "professional": {"is_professional": True, "profession": "Stylist"},
    }

    with patch.object(ads_api, "get_db", return_value=fake_db):
        client = TestClient(app)

        # Unsafe javascript: URL in creative is rejected -> 422
        xss_ad = client.post(
            "/api/v1/promotions/campaigns",
            json={
                "name": "Bad Ad",
                "creative": {"headline": "Click", "cta_url": "javascript:alert(1)"},
            },
        )
        assert xss_ad.status_code == 422

        # Owner cannot reactivate an admin-disabled campaign -> 403
        reactivate = client.patch(
            "/api/v1/promotions/campaigns/camp-disabled",
            json={"status": "active"},
        )
        assert reactivate.status_code == 403

        # Activating a draft campaign with 0 ad credits -> 402
        unfunded = client.patch(
            "/api/v1/promotions/campaigns/camp-draft",
            json={"status": "active"},
        )
        assert unfunded.status_code == 402

        # With positive credits -> succeeds -> status becomes active
        fake_db.user_credits.docs.append({"user_id": "pro-1", "currency": "USD", "balance_cents": 500})
        funded = client.patch(
            "/api/v1/promotions/campaigns/camp-draft",
            json={"status": "active"},
        )
        assert funded.status_code == 200
        assert funded.json()["status"] == "active"

        # Regex metacharacters in region/country are escaped cleanly
        flt = ads_api._eligible_filter("IL.*", "Tel (Aviv)+")
        country_rx = flt["$and"][2]["$or"][2]["target_country"]["$regex"]
        region_rx = flt["$and"][3]["$or"][2]["target_region"]["$regex"]
        assert country_rx == r"^IL\.\*$"
        assert region_rx == r"Tel\ \(Aviv\)\+"


# ---------------------------------------------------------------------------
# 6. service.py & server.py: /api/status admin lock + /models/generate-3d auth & 413 bound
# ---------------------------------------------------------------------------
def test_service_and_server_status_require_auth() -> None:
    # Stub missing binary cv2 without patch.dict(sys.modules), so numpy isn't evicted and reloaded twice.
    _ensure_optional_cv2_stub()
    import service as tryon_svc
    from app.services.auth import get_current_user, require_admin

    svc_app = FastAPI()
    svc_app.include_router(tryon_svc.router)
    svc_client = TestClient(svc_app)

    # Unauthenticated generate-3d -> 401
    resp = svc_client.post(
        "/api/v1/models/generate-3d",
        files={"file": ("garment.png", VALID_PNG, "image/png")},
    )
    assert resp.status_code == 401

    # Authenticated generate-3d oversized (> 15 MB) -> 413
    svc_app.dependency_overrides[get_current_user] = lambda: {"id": "u-3d"}
    big_bytes = b"\x89PNG\r\n\x1a\n" + (b"0" * (15 * 1024 * 1024 + 64))
    oversized = svc_client.post(
        "/api/v1/models/generate-3d",
        files={"file": ("huge.png", big_bytes, "image/png")},
    )
    assert oversized.status_code == 413

    import server as srv_mod

    srv_mod.app.dependency_overrides.clear()
    try:
        srv_client = TestClient(srv_mod.app)
        assert srv_client.get("/api/status").status_code == 401
        assert srv_client.post("/api/status", json={"client_name": "attacker"}).status_code == 401

        srv_mod.app.dependency_overrides[get_current_user] = lambda: {"id": "u1", "roles": ["user"]}
        assert srv_client.get("/api/status").status_code == 403
        assert srv_client.post("/api/status", json={"client_name": "u1"}).status_code == 403
        srv_mod.app.dependency_overrides.clear()

        fake_db = _FakeDB()
        fake_db.status_checks = _StatusChecksCollection()
        srv_mod.app.dependency_overrides[require_admin] = lambda: {"id": "admin-1", "roles": ["admin"]}
        with patch.object(srv_mod, "get_db", return_value=fake_db):
            post_ok = srv_client.post("/api/status", json={"client_name": "health-bot"})
            assert post_ok.status_code == 200
            get_ok = srv_client.get("/api/status")
            assert get_ok.status_code == 200
            assert len(get_ok.json()) == 1
    finally:
        srv_mod.app.dependency_overrides.clear()
