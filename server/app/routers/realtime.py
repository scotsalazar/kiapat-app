"""Realtime endpoints exposing websocket feeds for inventory and pricing updates."""

from __future__ import annotations

import asyncio
from typing import Any, Dict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..notifier import inventory_notifier

router = APIRouter(prefix="/api/realtime", tags=["realtime"])


@router.websocket("/updates")
async def realtime_updates(websocket: WebSocket) -> None:
    """Forward inventory update events to connected websocket clients."""
    await websocket.accept()
    queue = await inventory_notifier.subscribe()
    try:
        while True:
            message: Dict[str, Any] = await queue.get()
            await websocket.send_json(message)
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        await inventory_notifier.unsubscribe(queue)
