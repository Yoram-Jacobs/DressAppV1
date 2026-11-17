"""Shared offline pytest configuration & async mongomock database isolation."""

from __future__ import annotations

import os
from typing import Any

import mongomock
import pytest

# Force test environment and non-SRV local Mongo URI before importing app modules
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("JWT_SECRET", "pytest-local-test-secret-0123456789abcdef")
if "mongodb+srv://" in os.environ.get("MONGO_URL", ""):
    os.environ["MONGO_URL"] = "mongodb://localhost:27017"


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


class _AsyncMockCursor:
    def __init__(self, cursor: Any) -> None:
        self._cursor = cursor
        self._iter: Any = None

    def sort(self, key_or_list: Any, direction: int | None = None) -> "_AsyncMockCursor":
        if direction is not None:
            self._cursor = self._cursor.sort(key_or_list, direction)
        else:
            self._cursor = self._cursor.sort(key_or_list)
        return self

    def skip(self, n: int) -> "_AsyncMockCursor":
        self._cursor = self._cursor.skip(n)
        return self

    def limit(self, n: int) -> "_AsyncMockCursor":
        self._cursor = self._cursor.limit(n)
        return self

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        docs = list(self._cursor)
        if length is not None and length >= 0:
            return docs[:length]
        return docs

    def __aiter__(self) -> "_AsyncMockCursor":
        self._iter = iter(self._cursor)
        return self

    async def __anext__(self) -> dict[str, Any]:
        if self._iter is None:
            self._iter = iter(self._cursor)
        try:
            return next(self._iter)
        except StopIteration as exc:
            raise StopAsyncIteration from exc


class _AsyncMockCommandCursor:
    def __init__(self, cursor: Any) -> None:
        self._docs = list(cursor)
        self._idx = 0

    async def to_list(self, length: int | None = None) -> list[dict[str, Any]]:
        if length is not None and length >= 0:
            return list(self._docs[:length])
        return list(self._docs)

    def __aiter__(self) -> "_AsyncMockCommandCursor":
        self._idx = 0
        return self

    async def __anext__(self) -> dict[str, Any]:
        if self._idx >= len(self._docs):
            raise StopAsyncIteration
        item = self._docs[self._idx]
        self._idx += 1
        return item


class _AsyncMockCollection:
    def __init__(self, coll: Any) -> None:
        self._coll = coll

    def find(self, *args: Any, **kwargs: Any) -> _AsyncMockCursor:
        return _AsyncMockCursor(self._coll.find(*args, **kwargs))

    def aggregate(self, *args: Any, **kwargs: Any) -> _AsyncMockCommandCursor:
        return _AsyncMockCommandCursor(self._coll.aggregate(*args, **kwargs))

    async def find_one(self, *args: Any, **kwargs: Any) -> Any:
        return self._coll.find_one(*args, **kwargs)

    async def insert_one(self, *args: Any, **kwargs: Any) -> Any:
        return self._coll.insert_one(*args, **kwargs)

    async def insert_many(self, *args: Any, **kwargs: Any) -> Any:
        return self._coll.insert_many(*args, **kwargs)

    async def update_one(self, *args: Any, **kwargs: Any) -> Any:
        return self._coll.update_one(*args, **kwargs)

    async def update_many(self, *args: Any, **kwargs: Any) -> Any:
        return self._coll.update_many(*args, **kwargs)

    async def replace_one(self, *args: Any, **kwargs: Any) -> Any:
        return self._coll.replace_one(*args, **kwargs)

    async def find_one_and_update(self, *args: Any, **kwargs: Any) -> Any:
        return self._coll.find_one_and_update(*args, **kwargs)

    async def find_one_and_delete(self, *args: Any, **kwargs: Any) -> Any:
        return self._coll.find_one_and_delete(*args, **kwargs)

    async def delete_one(self, *args: Any, **kwargs: Any) -> Any:
        return self._coll.delete_one(*args, **kwargs)

    async def delete_many(self, *args: Any, **kwargs: Any) -> Any:
        return self._coll.delete_many(*args, **kwargs)

    async def count_documents(self, *args: Any, **kwargs: Any) -> int:
        return int(self._coll.count_documents(*args, **kwargs))

    async def distinct(self, *args: Any, **kwargs: Any) -> list[Any]:
        return list(self._coll.distinct(*args, **kwargs))

    async def create_index(self, *args: Any, **kwargs: Any) -> Any:
        return self._coll.create_index(*args, **kwargs)

    async def drop_index(self, *args: Any, **kwargs: Any) -> Any:
        try:
            return self._coll.drop_index(*args, **kwargs)
        except Exception:
            return None

    async def index_information(self) -> dict[str, Any]:
        return dict(self._coll.index_information())


class _AsyncMockDatabase:
    def __init__(self, db: Any) -> None:
        self._db = db

    def __getattr__(self, name: str) -> _AsyncMockCollection:
        return _AsyncMockCollection(self._db[name])

    def __getitem__(self, name: str) -> _AsyncMockCollection:
        return _AsyncMockCollection(self._db[name])

    async def command(self, cmd: str, *args: Any, **kwargs: Any) -> dict[str, Any]:
        if cmd == "ping":
            return {"ok": 1.0}
        return {"ok": 1.0}

    async def list_collection_names(self) -> list[str]:
        return list(self._db.list_collection_names())


class _AsyncMockClient:
    def __init__(self) -> None:
        self._sync_client = mongomock.MongoClient()

    def __getitem__(self, name: str) -> _AsyncMockDatabase:
        return _AsyncMockDatabase(self._sync_client[name])

    def __getattr__(self, name: str) -> _AsyncMockDatabase:
        return _AsyncMockDatabase(self._sync_client[name])

    def close(self) -> None:
        self._sync_client.close()


_TEST_MONGO_CLIENT = _AsyncMockClient()


@pytest.fixture(autouse=True)
def _isolate_test_mongodb(monkeypatch: pytest.MonkeyPatch) -> Any:
    """Keep offline unit tests isolated from remote MongoDB Atlas clusters."""
    from app.config import settings
    from app.db import database

    if "mongodb+srv://" in (settings.MONGO_URL or ""):
        monkeypatch.setattr(settings, "MONGO_URL", "mongodb://localhost:27017")

    _TEST_MONGO_CLIENT._sync_client.drop_database(settings.DB_NAME)
    monkeypatch.setattr(database, "_create_client", lambda: _TEST_MONGO_CLIENT)
    monkeypatch.setattr(database, "_client", _TEST_MONGO_CLIENT)
    monkeypatch.setattr(database, "_clients_by_loop", {})
    yield
    _TEST_MONGO_CLIENT._sync_client.drop_database(settings.DB_NAME)
    monkeypatch.setattr(database, "_clients_by_loop", {})
