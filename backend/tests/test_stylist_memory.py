import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient

from app.services.auth import get_current_user
from server import app
from app.services.stylist_memory import (
    create_session,
    list_sessions,
    get_session,
    delete_session,
    append_message,
    full_history,
)

client = TestClient(app)


@pytest.fixture
def mock_user():
    return {"id": "user_stylist_1", "email": "stylist@example.com", "preferred_language": "en"}


@pytest.mark.anyio
async def test_session_lifecycle():
    sessions_db = {}
    messages_db = []

    mock_db = MagicMock()
    mock_db.stylist_sessions = MagicMock()
    mock_db.stylist_messages = MagicMock()

    async def mock_insert(collection, doc):
        if collection == mock_db.stylist_sessions:
            sessions_db[doc["id"]] = doc
        elif collection == mock_db.stylist_messages:
            messages_db.append(doc)
        return doc

    async def mock_find_one(collection, query, **kwargs):
        if collection == mock_db.stylist_sessions:
            for s in sessions_db.values():
                if query.get("id") and s.get("id") == query["id"]:
                    return s
                if query.get("user_id") and s.get("user_id") == query["user_id"]:
                    return s
        return None

    async def mock_find_many(collection, query, sort=None, limit=50):
        if collection == mock_db.stylist_sessions:
            res = [s for s in sessions_db.values() if s.get("user_id") == query.get("user_id")]
            return res[:limit]
        elif collection == mock_db.stylist_messages:
            res = [m for m in messages_db if m.get("session_id") == query.get("session_id")]
            return res[:limit]
        return []

    async def mock_update_one(filter_q, update_q):
        s_id = filter_q.get("id")
        if s_id in sessions_db:
            if "$set" in update_q:
                sessions_db[s_id].update(update_q["$set"])
            if "$inc" in update_q:
                for k, v in update_q["$inc"].items():
                    sessions_db[s_id][k] = sessions_db[s_id].get(k, 0) + v
        return MagicMock(modified_count=1)

    mock_db.stylist_sessions.update_one = AsyncMock(side_effect=mock_update_one)
    mock_db.stylist_sessions.find_one = AsyncMock(side_effect=lambda q, **kw: sessions_db.get(q.get("id")))
    mock_db.stylist_messages.update_one = AsyncMock()

    with patch("app.services.stylist_memory.get_db", return_value=mock_db), \
         patch("app.services.repos.insert", side_effect=mock_insert), \
         patch("app.services.repos.find_one", side_effect=mock_find_one), \
         patch("app.services.repos.find_many", side_effect=mock_find_many):

        # 1. Create session
        sess = await create_session("user_stylist_1", title="Initial chat")
        assert sess["id"] in sessions_db
        assert sess["user_id"] == "user_stylist_1"

        # 2. Append user message
        user_msg = await append_message(
            session_id=sess["id"],
            role="user",
            input_modality="text",
            transcript="What should I wear today?",
        )
        assert len(messages_db) == 1
        assert sessions_db[sess["id"]]["snippet"] == "What should I wear today?"
        assert sessions_db[sess["id"]]["turns"] == 1

        # 3. Append assistant message
        asst_msg = await append_message(
            session_id=sess["id"],
            role="assistant",
            input_modality="text",
            transcript="I suggest a casual blue shirt with white trousers.",
            assistant_payload={"outfit_recommendations": [{"name": "Blue Look"}]},
        )
        assert len(messages_db) == 2
        assert sessions_db[sess["id"]]["turns"] == 2

        # 4. List sessions
        listed = await list_sessions("user_stylist_1")
        assert len(listed) == 1
        assert listed[0]["id"] == sess["id"]

        # 5. Full history
        history = await full_history(sess["id"])
        assert len(history) == 2
        assert history[0]["transcript"] == "What should I wear today?"
        assert history[1]["transcript"] == "I suggest a casual blue shirt with white trousers."


@pytest.mark.anyio
async def test_stylist_history_endpoint(mock_user):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        mock_sess = {
            "id": "sess_abc",
            "user_id": "user_stylist_1",
            "title": "Summer Outfits",
            "turns": 2,
            "snippet": "Show me summer dresses",
        }
        mock_msgs = [
            {"id": "m1", "session_id": "sess_abc", "role": "user", "transcript": "Show me summer dresses"},
            {"id": "m2", "session_id": "sess_abc", "role": "assistant", "transcript": "Here are 3 summer options:"},
        ]

        with patch("app.api.v1.stylist.get_session", new_callable=AsyncMock) as mock_get_s, \
             patch("app.api.v1.stylist.full_history", new_callable=AsyncMock) as mock_hist:
            mock_get_s.return_value = mock_sess
            mock_hist.return_value = mock_msgs

            resp = client.get("/api/v1/stylist/history?session_id=sess_abc")
            assert resp.status_code == 200
            data = resp.json()
            assert data["session_id"] == "sess_abc"
            assert len(data["messages"]) == 2
            assert data["messages"][0]["transcript"] == "Show me summer dresses"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_event_proposal_persists_session_and_messages(mock_user):
    """Verify that POST /outfits/proposal/event creates and persists a session and turns in stylist memory."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        fake_advice = {
            "reasoning_summary": "Here are 3 refined looks for your job interview at Intel.",
            "outfit_recommendations": [{"name": "Smart casual blazer", "items": []}],
        }
        fake_session = {
            "id": "sess_event_123",
            "user_id": "user_stylist_1",
            "title": "Job interview",
            "turns": 2,
            "snippet": 'Suggest event outfits for "Job interview"',
        }

        with patch("app.api.v1.outfits.generate_event_proposals", new_callable=AsyncMock) as mock_gen, \
             patch("app.services.stylist_memory.create_session", new_callable=AsyncMock) as mock_create_s, \
             patch("app.services.stylist_memory.get_session", new_callable=AsyncMock) as mock_get_s, \
             patch("app.services.stylist_memory.append_message", new_callable=AsyncMock) as mock_append_m:

            mock_gen.return_value = fake_advice
            mock_create_s.return_value = fake_session
            mock_get_s.return_value = fake_session
            mock_append_m.side_effect = [
                {"id": "msg_user_1", "role": "user"},
                {"id": "msg_asst_1", "role": "assistant"},
            ]

            payload = {
                "event_name": "Job interview",
                "location": "Intel Offices, Raanana",
                "date": "10/08/2026",
                "time": "01:00 PM",
                "prompt": "Smart casual.",
            }

            resp = client.post("/api/v1/outfits/proposal/event", json=payload)
            assert resp.status_code == 200
            data = resp.json()

            # Verify advice and session are returned
            assert "advice" in data
            assert "session" in data
            assert data["session"]["id"] == "sess_event_123"
            assert data["session"]["title"] == "Job interview"

            # Verify session was created and both messages (user + assistant) were appended
            assert mock_create_s.called
            assert mock_append_m.call_count == 2

            # Check user message arguments
            user_call_kwargs = mock_append_m.call_args_list[0].kwargs
            assert user_call_kwargs["role"] == "user"
            assert 'Job interview' in user_call_kwargs["transcript"]
            assert 'Intel Offices, Raanana' in user_call_kwargs["transcript"]
            assert 'Smart casual.' in user_call_kwargs["transcript"]

            # Check assistant message arguments
            asst_call_kwargs = mock_append_m.call_args_list[1].kwargs
            assert asst_call_kwargs["role"] == "assistant"
            assert asst_call_kwargs["assistant_payload"]["source_workflow"] == "event"
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_scheduled_proposal_persists_session_and_messages(mock_user):
    """Verify that POST /outfits/proposal/scheduled creates and persists a session and turns."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        fake_advice = {
            "reasoning_summary": "Here are tomorrow's scheduled daily looks.",
            "outfit_recommendations": [],
        }
        fake_session = {
            "id": "sess_sched_456",
            "user_id": "user_stylist_1",
            "title": "Daily suggestion: casual/daily dress",
            "turns": 2,
        }

        with patch("app.api.v1.outfits.generate_scheduled_proposals", new_callable=AsyncMock) as mock_gen, \
             patch("app.services.stylist_memory.create_session", new_callable=AsyncMock) as mock_create_s, \
             patch("app.services.stylist_memory.get_session", new_callable=AsyncMock) as mock_get_s, \
             patch("app.services.stylist_memory.append_message", new_callable=AsyncMock) as mock_append_m:

            mock_gen.return_value = fake_advice
            mock_create_s.return_value = fake_session
            mock_get_s.return_value = fake_session
            mock_append_m.side_effect = [
                {"id": "msg_user_sched", "role": "user"},
                {"id": "msg_asst_sched", "role": "assistant"},
            ]

            resp = client.post("/api/v1/outfits/proposal/scheduled", json={})
            assert resp.status_code == 200
            data = resp.json()

            assert "advice" in data
            assert "session" in data
            assert data["session"]["id"] == "sess_sched_456"
            assert mock_append_m.call_count == 2
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_ensure_complete_outfit_handles_unhashable_and_malformed_ids():
    """Verify that _ensure_complete_outfit does not raise TypeError on list or dict closet_item_id."""
    from app.services.stylist_scheduler_brain import _ensure_complete_outfit

    raw_closet = [
        {
            "id": "11111111-2222-3333-4444-555555555555",
            "title": "White Button-up Shirt",
            "category": "top",
            "dress_code": "business",
        },
        {
            "id": "22222222-3333-4444-5555-666666666666",
            "title": "Black Trousers",
            "category": "bottom",
            "dress_code": "business",
        },
        {
            "id": "33333333-4444-5555-6666-777777777777",
            "title": "Oxford Shoes",
            "category": "footwear",
            "dress_code": "business",
        },
    ]

    proposal = {
        "items": [
            {"closet_item_id": ["11111111-2222-3333-4444-555555555555"], "role": "top"},
            {"closet_item_id": {"id": "22222222-3333-4444-5555-666666666666"}, "role": "bottom"},
            {"closet_item_id": "33333333-4444", "role": "shoes"},  # Truncated UUID prefix
            {"closet_item_id": ["invalid_list_item"], "role": "accessory"},
            {"closet_item_id": None, "role": "accessory"},
        ]
    }

    # Should execute cleanly without raising TypeError: unhashable type: 'list'
    _ensure_complete_outfit(proposal, raw_closet)

    assert len(proposal["items"]) >= 3
    ids = [it["closet_item_id"] for it in proposal["items"]]
    assert "11111111-2222-3333-4444-555555555555" in ids
    assert "22222222-3333-4444-5555-666666666666" in ids
    assert "33333333-4444-5555-6666-777777777777" in ids


