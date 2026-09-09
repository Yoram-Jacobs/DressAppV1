"""Tests for sync service and version vector tracking."""
import pytest
import asyncio
from app.services.sync_service import (
    increment_sync_version,
    get_user_sync_status,
    broadcast_sync_event,
    register_subscriber,
    unregister_subscriber,
)

@pytest.mark.anyio
async def test_sync_version_increment():
    user_id = "test_user_sync_123"
    
    # Initial status
    status = await get_user_sync_status(user_id)
    assert "versions" in status
    assert "profile" in status["versions"]
    
    # Increment profile
    v1 = await increment_sync_version(user_id, "profile")
    assert v1 >= 1
    
    # Status reflects new version
    status2 = await get_user_sync_status(user_id)
    assert status2["versions"]["profile"] == v1
    
    # Increment closet
    v_closet = await increment_sync_version(user_id, "closet")
    assert v_closet >= 1


@pytest.mark.anyio
async def test_sync_broadcast_and_queue():
    user_id = "test_user_stream_456"
    
    # Register subscriber
    queue = await register_subscriber(user_id)
    
    try:
        # Broadcast event
        await broadcast_sync_event(user_id, "profile_updated", {"field": "avatar_url"})
        
        # Verify event in queue
        msg = await asyncio.wait_for(queue.get(), timeout=2.0)
        assert "event: sync" in msg
        assert "profile_updated" in msg
        assert "avatar_url" in msg
    finally:
        await unregister_subscriber(user_id, queue)


@pytest.mark.anyio
async def test_daily_proposal_generation_and_action():
    from app.api.v1.daily_proposals import _generate_and_save_daily_proposal, act_on_daily_proposal, ProposalActionIn
    user = {"id": "test_user_daily_789"}
    date_str = "2026-09-03"
    
    proposal = await _generate_and_save_daily_proposal(user, date_str, force=True)
    assert proposal["date"] == date_str
    assert proposal["user_id"] == user["id"]
    assert proposal["worn"] is False
    assert proposal["liked"] is False
    
    # Act on proposal: wear
    acted = await act_on_daily_proposal(ProposalActionIn(action="wear", proposal_id=proposal["id"], date=date_str), user=user)
    assert acted["worn"] is True
    
    # Act on proposal: like
    acted_like = await act_on_daily_proposal(ProposalActionIn(action="like", proposal_id=proposal["id"], date=date_str), user=user)
    assert acted_like["liked"] is True


@pytest.mark.anyio
async def test_daily_proposal_custom_tag_and_intermediate_purge():
    from app.api.v1.daily_proposals import (
        _generate_and_save_daily_proposal,
        _resolve_effective_style,
        act_on_daily_proposal,
        ProposalActionIn,
    )
    from app.services.stylist_scheduler_brain import calculate_garment_style_score
    from app.db.database import get_db

    db = get_db()
    user_id = "test_user_custom_work_999"
    user = {
        "id": user_id,
        "scheduler_settings": {
            "style_option": "custom",
            "custom_style": "עבודה",
        },
    }
    date_str = "2026-09-04"

    # Verify style resolution
    effective = _resolve_effective_style(user)
    assert effective == "עבודה"

    # Test scoring with Hebrew work tag
    work_item = {
        "id": "work_shirt_1",
        "title": "חולצה מכופתרת לעבודה",
        "category": "top",
        "tags": ["עבודה"],
        "dress_code": "business",
    }
    casual_item = {
        "id": "beach_tank_1",
        "title": "גופיית חוף",
        "category": "top",
        "tags": ["ים", "קיץ"],
    }
    work_score = calculate_garment_style_score(work_item, "עבודה")
    casual_score = calculate_garment_style_score(casual_item, "עבודה")
    assert work_score > casual_score
    assert work_score >= 50
    assert casual_score <= 0

    # Populate closet with test items
    await db.closet_items.insert_many([
        {"id": "top_w1", "user_id": user_id, "category": "top", "title": "White Work Shirt", "tags": ["עבודה"]},
        {"id": "top_w2", "user_id": user_id, "category": "top", "title": "Blue Office Shirt", "tags": ["work"]},
        {"id": "bot_w1", "user_id": user_id, "category": "bottom", "title": "Black Work Trousers", "tags": ["עבודה"]},
        {"id": "bot_w2", "user_id": user_id, "category": "bottom", "title": "Navy Chinos", "tags": ["business"]},
        {"id": "shoe_w1", "user_id": user_id, "category": "shoes", "title": "Leather Oxford Shoes", "tags": ["formal"]},
        {"id": "shoe_w2", "user_id": user_id, "category": "shoes", "title": "Smart Loafers", "tags": ["work"]},
    ])

    try:
        # Generate Look 1
        p1 = await _generate_and_save_daily_proposal(user, date_str, force=True)
        assert p1["id"] is not None
        assert len(p1["items"]) >= 2
        p1_item_ids = {it["id"] for it in p1["items"]}

        # Generate Look 2 (New Look)
        p2 = await _generate_and_save_daily_proposal(user, date_str, force=True)
        assert p2["id"] != p1["id"]
        p2_item_ids = {it["id"] for it in p2["items"]}
        # Verify that Look 2 uses diverse items
        assert p2_item_ids != p1_item_ids

        # Verify both proposals exist in DB before wearing
        count_before = await db.daily_proposals.count_documents({"user_id": user_id, "date": date_str})
        assert count_before >= 2

        # Wear Look 2
        await act_on_daily_proposal(ProposalActionIn(action="wear", proposal_id=p2["id"], date=date_str), user=user)

        # Verify intermediate proposals were purged: only worn proposal remains
        remaining = await db.daily_proposals.find({"user_id": user_id, "date": date_str}).to_list(10)
        assert len(remaining) == 1
        assert remaining[0]["id"] == p2["id"]
        assert remaining[0]["worn"] is True
    finally:
        await db.closet_items.delete_many({"user_id": user_id})
        await db.daily_proposals.delete_many({"user_id": user_id})


