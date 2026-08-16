"""
Real-time Alert and Telemetry WebSocket Connection Manager.
"""

from typing import List, Set
from fastapi import WebSocket
import json

class WebSocketManager:
    def __init__(self):
        self.live_connections: Set[WebSocket] = set()
        self.alert_connections: Set[WebSocket] = set()

    async def connect_live(self, websocket: WebSocket):
        await websocket.accept()
        self.live_connections.add(websocket)

    def disconnect_live(self, websocket: WebSocket):
        self.live_connections.discard(websocket)

    async def connect_alerts(self, websocket: WebSocket):
        await websocket.accept()
        self.alert_connections.add(websocket)

    def disconnect_alerts(self, websocket: WebSocket):
        self.alert_connections.discard(websocket)

    async def broadcast_live(self, message: dict):
        dead = []
        payload = json.dumps(message)
        for ws in self.live_connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.live_connections.discard(ws)

    async def broadcast_alert(self, message: dict):
        dead = []
        payload = json.dumps(message)
        for ws in self.alert_connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.alert_connections.discard(ws)

ws_manager = WebSocketManager()
