"""Regression tests for P1 QA remediations (QA-13, QA-18, QA-19, QA-21)."""

from __future__ import annotations

import importlib.util
import io
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

import pytest
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


def _get_nested(doc: dict[str, Any], dotted_key: str, default: Any = None) -> tuple[bool, Any]:
    cur: Any = doc
    for part in dotted_key.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return False, default
        cur = cur[part]
    return True, cur


def _set_nested(doc: dict[str, Any], dotted_key: str, value: Any) -> None:
    parts = dotted_key.split(".")
    cur = doc
    for part in parts[:-1]:
        if part not in cur or not isinstance(cur[part], dict):
            cur[part] = {}
        cur = cur[part]
    cur[parts[-1]] = value


def _unset_nested(doc: dict[str, Any], dotted_key: str) -> None:
    parts = dotted_key.split(".")
    cur = doc
    for part in parts[:-1]:
        if not isinstance(cur, dict) or part not in cur:
            return
        cur = cur[part]
    if isinstance(cur, dict):
        cur.pop(parts[-1], None)


def _matches_filter(doc: dict[str, Any], flt: dict[str, Any]) -> bool:
    for key, expected in (flt or {}).items():
        if key == "$or":
            if not any(_matches_filter(doc, branch) for branch in expected):
                return False
            continue
        exists, actual = _get_nested(doc, key)
        if isinstance(expected, dict):
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$ne" in expected and actual == expected["$ne"]:
                return False
        else:
            if not exists or actual != expected:
                return False
    return True


class _FakeCursor:
    def __init__(self, docs: list[dict[str, Any]]) -> None:
        self._docs = list(docs)
        self._idx = 0

    def sort(self, keys: Any, direction: int | None = None) -> "_FakeCursor":
        if isinstance(keys, str):
            spec = [(keys, direction or 1)]
        else:
            spec = list(keys)
        for field, order in reversed(spec):
            self._docs.sort(
                key=lambda d: str(d.get(field) or ""),
                reverse=(order == -1),
            )
        return self

    def limit(self, n: int) -> "_FakeCursor":
        self._docs = self._docs[:n]
        return self

    def skip(self, n: int) -> "_FakeCursor":
        self._docs = self._docs[n:]
        return self

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        return list(self._docs[:length]) if length is not None else list(self._docs)

    def __aiter__(self) -> "_FakeCursor":
        self._idx = 0
        return self

    async def __anext__(self) -> dict[str, Any]:
        if self._idx >= len(self._docs):
            raise StopAsyncIteration
        item = self._docs[self._idx]
        self._idx += 1
        return item


class _FakeCollection:
    def __init__(self, docs: list[dict[str, Any]] | None = None) -> None:
        self.docs: list[dict[str, Any]] = list(docs or [])
        self.delete_called = False

    def find(self, flt: dict[str, Any] | None = None, _proj: Any = None) -> _FakeCursor:
        matched = [dict(d) for d in self.docs if _matches_filter(d, flt or {})]
        return _FakeCursor(matched)

    async def find_one(self, flt: dict[str, Any], _proj: Any = None) -> dict[str, Any] | None:
        for d in self.docs:
            if _matches_filter(d, flt):
                return dict(d)
        return None

    async def count_documents(self, flt: dict[str, Any] | None = None) -> int:
        return sum(1 for d in self.docs if _matches_filter(d, flt or {}))

    async def update_one(self, flt: dict[str, Any], update: dict[str, Any], upsert: bool = False) -> SimpleNamespace:
        matched = 0
        for d in self.docs:
            if _matches_filter(d, flt):
                matched += 1
                for k, v in (update.get("$set") or {}).items():
                    _set_nested(d, k, v)
                for k in (update.get("$unset") or {}).keys():
                    _unset_nested(d, k)
                break
        return SimpleNamespace(matched_count=matched, modified_count=matched)

    async def update_many(self, flt: dict[str, Any], update: dict[str, Any]) -> SimpleNamespace:
        modified = 0
        for d in self.docs:
            if _matches_filter(d, flt):
                modified += 1
                for k, v in (update.get("$set") or {}).items():
                    _set_nested(d, k, v)
                for k in (update.get("$unset") or {}).keys():
                    _unset_nested(d, k)
        return SimpleNamespace(matched_count=modified, modified_count=modified)

    async def delete_many(self, flt: dict[str, Any]) -> SimpleNamespace:
        self.delete_called = True
        before = len(self.docs)
        self.docs = [d for d in self.docs if not _matches_filter(d, flt)]
        return SimpleNamespace(deleted_count=before - len(self.docs))


class _FakeDB:
    def __init__(self, items: list[dict[str, Any]], users: list[dict[str, Any]]) -> None:
        self.closet_items = _FakeCollection(items)
        self.users = _FakeCollection(users)


# ---------------------------------------------------------------------------
# QA-13: Honest sustainability carbon estimation & historical CPW trajectory
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_qa13_sustainability_stats_real_cpw_and_material_co2() -> None:
    from app.api.v1.closet import search_stats

    now = datetime.now(timezone.utc)
    two_months_ago = (now - timedelta(days=62)).isoformat()
    one_month_ago = (now - timedelta(days=32)).isoformat()
    today_iso = now.isoformat()

    fake_items = [
        {
            "id": "item-1",
            "user_id": "u-13",
            "category": "Outerwear",
            "sub_category": "Coat",
            "fabric_materials": [{"name": "Wool", "pct": 100}],
            "price_cents": 20000,
            "wear_count": 4,
            "created_at": two_months_ago,
            "wear_history": [two_months_ago, one_month_ago, today_iso, today_iso],
            "from_receipt": True,
        },
        {
            "id": "item-2",
            "user_id": "u-13",
            "category": "Top",
            "sub_category": "T-Shirt",
            "fabric_materials": [{"name": "Cotton", "pct": 100}],
            "dpp_data": {"carbon_footprint": "4.5 kg CO2e"},
            "price_cents": 4000,
            "wear_count": 4,
            "created_at": two_months_ago,
            "wear_history": [two_months_ago, one_month_ago, today_iso, today_iso],
            "from_receipt": False,
        },
        {
            "id": "archived-item",
            "user_id": "u-13",
            "archived": True,
            "category": "Footwear",
            "price_cents": 90000,
            "wear_count": 0,
            "created_at": two_months_ago,
        },
    ]
    fake_db = _FakeDB(fake_items, [])

    with patch.object(search_stats, "get_db", return_value=fake_db):
        res = await search_stats.get_sustainability_stats(user={"id": "u-13"})

    assert res["cpw_is_simulated"] is False
    assert res["utilisation_pct"] == 100
    assert res["intake_breakdown"] == {"receipt": 1, "manual": 1}
    # Explicit DPP item = 4.5 kg + Wool Coat (1.0 * 19.0 = 19.0 kg) => 23.5 kg total
    assert res["dpp_items_count"] == 1
    assert res["dpp_carbon_sum"] == pytest.approx(4.5, abs=0.1)
    assert res["carbon_sum"] == pytest.approx(23.5, abs=0.1)
    assert res["carbon_is_estimated"] is True
    # Current CPW = $240 / 8 wears = $30.00 (archived $900 item ignored)
    assert res["current_cpw"] == pytest.approx(30.0, abs=0.01)
    assert len(res["cpw_trend"]) == 6
    assert res["cpw_trend"][-1]["cpw"] == pytest.approx(30.0, abs=0.01)
    # Earlier months before any item existed have item_count=0 and cpw=0 (NOT synthetic 1+i*0.15)
    assert res["cpw_trend"][0]["item_count"] == 0
    assert res["cpw_trend"][0]["cpw"] == 0.0


# ---------------------------------------------------------------------------
# QA-18: Eyes schema & SubCategoryTaxonomy synchronized with vision/llm.py
# ---------------------------------------------------------------------------

def test_qa18_eyes_schema_matches_llm_garment_schema() -> None:
    from app.services.vision.llm import _GARMENT_OBJECT_SCHEMA

    eyes_path = ROOT / "inference-server" / "eyes" / "main.py"
    spec = importlib.util.spec_from_file_location("dressapp_eyes_main_test", eyes_path)
    assert spec is not None and spec.loader is not None
    eyes_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(eyes_mod)

    eyes_subs = set(eyes_mod.DEFAULT_GARMENT_SCHEMA["properties"]["sub_category"]["enum"])
    llm_subs = set(_GARMENT_OBJECT_SCHEMA["properties"]["sub_category"]["enum"])
    assert llm_subs.issubset(eyes_subs), f"Missing sub_categories in Eyes schema: {llm_subs - eyes_subs}"

    for expected_prop in ("fit", "pattern", "fabric_materials", "dress_code"):
        assert expected_prop in eyes_mod.DEFAULT_GARMENT_SCHEMA["properties"]

    eyes_dress_codes = set(eyes_mod.DEFAULT_GARMENT_SCHEMA["properties"]["dress_code"]["enum"])
    assert "traditional" in eyes_dress_codes
    assert "enum" in eyes_mod.DEFAULT_GARMENT_SCHEMA["properties"]["pattern"]
    assert "enum" in eyes_mod.DEFAULT_GARMENT_SCHEMA["properties"]["fabric_materials"]["items"]["properties"]["name"]


# ---------------------------------------------------------------------------
# QA-19: Outfit composer dedup signature includes silhouette, fabric, fit & visual hash
# ---------------------------------------------------------------------------

def test_qa19_signature_distinguishes_distinct_solid_garments_and_dedups_duplicates() -> None:
    from app.services import outfit_composer

    buf_a = io.BytesIO()
    im_a = Image.new("RGB", (32, 32), (10, 10, 10))
    for x in range(8, 24):
        for y in range(4, 28):
            im_a.putpixel((x, y), (30, 30, 30))
    im_a.save(buf_a, format="PNG")

    buf_b = io.BytesIO()
    im_b = Image.new("RGB", (32, 32), (10, 10, 10))
    for x in range(2, 30):
        for y in range(2, 16):
            im_b.putpixel((x, y), (45, 45, 45))
    im_b.save(buf_b, format="PNG")

    fp_a = outfit_composer._image_perceptual_fingerprint(buf_a.getvalue())
    fp_b = outfit_composer._image_perceptual_fingerprint(buf_b.getvalue())
    assert fp_a != fp_b

    sig_tee = outfit_composer._signature_for(
        "top", "black", "solid",
        sub_category="T-Shirt", material="Cotton", fit="slim", image_fingerprint=fp_a,
    )
    sig_blouse = outfit_composer._signature_for(
        "top", "black", "solid",
        sub_category="Blouse", material="Silk", fit="loose", image_fingerprint=fp_b,
    )
    sig_tee_dup = outfit_composer._signature_for(
        "top", "black", "solid",
        sub_category="T-Shirt", material="Cotton", fit="slim", image_fingerprint=fp_a,
    )

    assert sig_tee != sig_blouse
    assert sig_tee == sig_tee_dup

    survivors, rejects = outfit_composer._dedup_candidates([
        {"candidate_id": "c1", "title": "Black Tee", "_signature": sig_tee, "quality_score": 0.9},
        {"candidate_id": "c2", "title": "Black Tee Copy", "_signature": sig_tee_dup, "quality_score": 0.6},
        {"candidate_id": "c3", "title": "Black Silk Blouse", "_signature": sig_blouse, "quality_score": 0.85},
    ])
    assert {c["candidate_id"] for c in survivors} == {"c1", "c3"}
    assert [r["candidate_id"] for r in rejects] == ["c2"]


# ---------------------------------------------------------------------------
# QA-21: Soft-archive on plan demotion + automatic restore on upgrade
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_qa21_soft_archive_on_demote_and_restore_on_upgrade() -> None:
    from app.services.billing_service import demote_user_to_free_plan
    from app.api.v1 import ai_credits
    from app.api.v1.closet import items as closet_items_api

    user_doc = {
        "id": "u-21",
        "closet_capacity_bonus": 10,  # effective limit = 110
        "subscription": {"plan_type": "manager", "is_active": True},
        "ai_configuration": {"subscription": {"plan_type": "manager", "is_active": True}},
        "credit_buckets": [],
    }
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    # 115 items: newest 110 stay active, oldest 5 get archived (never deleted!)
    docs = [
        {
            "id": f"item-{i:03d}",
            "user_id": "u-21",
            "title": f"Garment {i}",
            "created_at": (base + timedelta(hours=i)).isoformat(),
        }
        for i in range(115)
    ]
    fake_db = _FakeDB(docs, [user_doc])

    demote_res = await demote_user_to_free_plan(fake_db, dict(user_doc))
    assert fake_db.closet_items.delete_called is False
    assert len(fake_db.closet_items.docs) == 115
    assert demote_res["archived_closet_items_count"] == 5
    assert demote_res["remaining_closet_items_count"] == 110
    # Referral capacity bonus must be preserved!
    assert fake_db.users.docs[0]["closet_capacity_bonus"] == 10

    active_count = await fake_db.closet_items.count_documents({"user_id": "u-21", "archived": {"$ne": True}})
    archived_docs = [d for d in fake_db.closet_items.docs if d.get("archived")]
    assert active_count == 110
    assert len(archived_docs) == 5
    assert all(d.get("archived_reason") == "plan_demotion" for d in archived_docs)

    # list_items excludes archived items by default
    with patch.object(closet_items_api, "get_db", return_value=fake_db):
        listed = await closet_items_api.list_items(
            user={"id": "u-21"},
            source=None,
            category=None,
            search=None,
            marketplace_intent=None,
            updated_after=None,
            ids_only=True,
            limit=2000,
            skip=0,
        )
    assert listed["total"] == 110
    assert len(listed["ids"]) == 110

    # Upgrading back to Pro automatically unarchives plan_demotion items
    with patch.object(ai_credits, "get_db", return_value=fake_db):
        upg_res = await ai_credits.upgrade_subscription(
            {"plan_type": "pro"},
            user={"id": "u-21"},
        )
    assert upg_res["success"] is True
    assert upg_res["restored_closet_items_count"] == 5
    active_after = await fake_db.closet_items.count_documents({"user_id": "u-21", "archived": {"$ne": True}})
    assert active_after == 115
    assert all(not d.get("archived") and "archived_reason" not in d for d in fake_db.closet_items.docs)
