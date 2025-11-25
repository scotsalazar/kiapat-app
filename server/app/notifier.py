"""Utility module providing an in-process publish/subscribe helper for
broadcasting inventory and pricing changes to connected clients."""

from __future__ import annotations

import asyncio
from threading import Lock
from typing import Any, Dict, Set

import anyio


class RealtimeNotifier:
    """Simple broker that fans out JSON-serialisable payloads to subscribers."""

    def __init__(self) -> None:
        self._subscribers: Set[asyncio.Queue[Dict[str, Any]]] = set()
        self._lock = Lock()

    async def subscribe(self) -> asyncio.Queue[Dict[str, Any]]:
        """Register a subscriber and return its queue for incoming messages."""
        queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()
        with self._lock:
            self._subscribers.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[Dict[str, Any]]) -> None:
        """Remove a subscriber queue from the registry."""
        with self._lock:
            self._subscribers.discard(queue)

    async def _broadcast(self, message: Dict[str, Any]) -> None:
        with self._lock:
            subscribers = list(self._subscribers)
        for queue in subscribers:
            await queue.put(message)

    def publish(self, message: Dict[str, Any]) -> None:
        """Publish a message to all subscribers, regardless of context."""
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            anyio.from_thread.run(self._broadcast, message)
        else:
            loop.create_task(self._broadcast(message))


inventory_notifier = RealtimeNotifier()
"""Singleton notifier used across the application."""
