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
    acted = await act_on_daily_proposal(ProposalActionIn(action="wear", date=date_str), user=user)
    assert acted["worn"] is True
    
    # Act on proposal: like
    acted_like = await act_on_daily_proposal(ProposalActionIn(action="like", date=date_str), user=user)
    assert acted_like["liked"] is True

