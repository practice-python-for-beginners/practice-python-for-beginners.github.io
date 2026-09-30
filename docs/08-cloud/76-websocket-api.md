---
title: "Lesson 76 · Building a WebSocket API"
description: "Build full-duplex real-time APIs using WebSockets and FastAPI: manage persistent client connections, implement room and channel broadcasting, handle client heartbeats, and scale horizontally across multiple instances using Redis Pub/Sub."
---

# Lesson 76 · Building a WebSocket API

> **Section:** ☁️ Cloud, Serverless & Event-Driven Systems &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Contrast traditional HTTP request/response polling with persistent bidirectional WebSockets
- [ ] Implement asynchronous WebSocket endpoints with FastAPI (`WebSocket` and `WebSocketDisconnect`)
- [ ] Architect a Connection Manager to track active sessions, rooms, and channels
- [ ] Broadcast real-time JSON payloads to all clients or specific room subscribers
- [ ] Handle client reconnection strategies, ping/pong heartbeats, and graceful disconnections
- [ ] Scale WebSocket backends across multiple server instances using Redis Pub/Sub

---

## 📖 Introduction

Standard HTTP is unidirectional and request-driven: the client sends a request and the server sends a response, closing or idling the TCP connection. For live applications—such as trading tickers, multiplayer games, real-time collaboration tools, and live chat—polling creates massive HTTP header overhead and latency.

The **WebSocket Protocol (`ws://` and `wss://`)** provides a persistent, full-duplex, bidirectional communication channel over a single TCP connection initiated through an HTTP Upgrade handshake.

```
Client                                                  FastAPI Server
  │                                                            │
  ├──────── HTTP GET /ws (Upgrade: websocket) ────────────────►│ (Handshake)
  │◄─────── HTTP 101 Switching Protocols ──────────────────────┤
  │                                                            │
  │════════════════ Persistent Full-Duplex TCP ════════════════│
  │                                                            │
  ├──────── JSON Frame (client msg) ──────────────────────────►│
  │◄─────── JSON Frame (server broadcast) ─────────────────────┤
  │◄─────── Ping Frame ────────────────────────────────────────┤ (Heartbeat)
  ├──────── Pong Frame ───────────────────────────────────────►│
```

---

## 1. FastAPI WebSocket Endpoints

FastAPI provides first-class support for WebSockets built on top of Starlette and `asyncio`.

=== "main.py"
    ```python
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect
    import json

    app = FastAPI()

    @app.websocket("/ws/echo")
    async def echo_endpoint(websocket: WebSocket):
        # 1. Accept connection handshake
        await websocket.accept()
        print(f"Client connected: {websocket.client.host}")
        
        try:
            while True:
                # 2. Wait for incoming text or JSON frames
                data = await websocket.receive_text()
                print(f"Received: {data}")
                
                # 3. Send response back to this client
                response = {"echo": data, "status": "delivered"}
                await websocket.send_text(json.dumps(response))
        except WebSocketDisconnect:
            print("Client disconnected cleanly")
    ```
=== "Client JavaScript (Browser)"
    ```javascript
    const socket = new WebSocket("ws://localhost:8000/ws/echo");

    socket.onopen = () => {
      console.log("Connected to WebSocket server");
      socket.send(JSON.stringify({ message: "Hello Server!" }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Message from server:", data);
    };

    socket.onclose = () => console.log("Connection closed");
    ```

---

## 2. Managing Connections and Broadcasting

In a multi-user application, the server needs to keep track of active sockets, organize them into rooms (channels), and broadcast events to all subscribers.

=== "connection_manager.py"
    ```python
    from fastapi import WebSocket
    from typing import Dict, List

    class ConnectionManager:
        def __init__(self):
            # Map room_id -> list of active WebSockets
            self.rooms: Dict[str, List[WebSocket]] = {}

        async def connect(self, room_id: str, websocket: WebSocket):
            await websocket.accept()
            if room_id not in self.rooms:
                self.rooms[room_id] = []
            self.rooms[room_id].append(websocket)

        def disconnect(self, room_id: str, websocket: WebSocket):
            if room_id in self.rooms and websocket in self.rooms[room_id]:
                self.rooms[room_id].remove(websocket)
                if not self.rooms[room_id]:
                    del self.rooms[room_id]

        async def broadcast_to_room(self, room_id: str, message: dict):
            if room_id in self.rooms:
                for connection in self.rooms[room_id]:
                    await connection.send_json(message)

    manager = ConnectionManager()
    ```
=== "Room Chat Endpoint"
    ```python
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect
    from connection_manager import manager

    app = FastAPI()

    @app.websocket("/ws/chat/{room_id}/{username}")
    async def chat_endpoint(websocket: WebSocket, room_id: str, username: str):
        await manager.connect(room_id, websocket)
        await manager.broadcast_to_room(room_id, {
            "type": "user_joined",
            "username": username,
            "room": room_id
        })
        
        try:
            while True:
                msg = await websocket.receive_text()
                await manager.broadcast_to_room(room_id, {
                    "type": "chat_message",
                    "username": username,
                    "text": msg
                })
        except WebSocketDisconnect:
            manager.disconnect(room_id, websocket)
            await manager.broadcast_to_room(room_id, {
                "type": "user_left",
                "username": username
            })
    ```

---

## 3. Heartbeats and Client Reconnection Strategy

WebSocket connections traverse NAT gateways, firewalls, and proxies (such as Nginx or AWS ALB), which terminate connections that are idle for more than 60 seconds.

| Mechanism | Sender | Frequency | Purpose |
|---|---|---|---|
| **Ping/Pong Frames** | Server / Client | Every 25–30s | Keeps TCP connection active across load balancers |
| **Exponential Backoff** | Client | After drop (1s, 2s, 4s, 8s) | Prevents thundering herd on server restarts |
| **Close Codes** | Both | On termination | 1000 (Normal), 1001 (Going away), 1008 (Policy violation) |

=== "Client Exponential Backoff"
    ```javascript
    let retries = 0;
    function connect() {
      const ws = new WebSocket("wss://api.example.com/ws/live");
      
      ws.onopen = () => {
        retries = 0; // Reset backoff on successful connect
      };

      ws.onclose = () => {
        const timeout = Math.min(10000, (2 ** retries) * 1000);
        retries++;
        console.log(`Reconnecting in ${timeout}ms...`);
        setTimeout(connect, timeout);
      };
    }
    ```

---

## 4. Scaling WebSockets with Redis Pub/Sub

When scaling your API across multiple server instances behind a load balancer, client A on Instance 1 cannot directly communicate with client B on Instance 2. A centralized **Redis Pub/Sub** message bus solves this.

```
Instance 1 (Client A) ──► Publish to Redis ──► Redis Pub/Sub Channel
                                                    │
                                                    ▼
Instance 2 (Client B) ◄── Broadcast to Socket ◄── Consumed by Redis Worker
```

=== "Redis Pub/Sub Broker"
    ```python
    import asyncio
    import redis.asyncio as redis
    import json

    redis_client = redis.from_url("redis://localhost:6379")

    async def start_redis_listener(manager, room_id: str):
        pubsub = redis_client.pubsub()
        await pubsub.subscribe(f"chat:{room_id}")
        
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                await manager.broadcast_to_room(room_id, data)
    ```

---

## 💻 Try It Yourself

Simulate an in-memory WebSocket broker managing client registrations, broadcasts, and cleanup.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">class MockWebSocketConnection:
    def __init__(self, client_id):
        self.client_id = client_id
        self.inbox = []

    def send_message(self, message):
        self.inbox.append(message)

class WebSocketBroker:
    def __init__(self):
        self.clients = {}

    def register(self, client_id):
        conn = MockWebSocketConnection(client_id)
        self.clients[client_id] = conn
        return conn

    def unregister(self, client_id):
        if client_id in self.clients:
            del self.clients[client_id]

    def broadcast(self, payload):
        delivered = 0
        for conn in self.clients.values():
            conn.send_message(payload)
            delivered += 1
        return delivered

broker = WebSocketBroker()
c1 = broker.register("user_101")
c2 = broker.register("user_102")
c3 = broker.register("user_103")

count = broker.broadcast({"event": "price_update", "symbol": "AAPL", "price": 182.50})
print(f"Active connections: {len(broker.clients)}")
print(f"Message broadcasted to {count} connected clients.")
print(f"Client 101 inbox: {c1.inbox[0]}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Broadcast Recipient Count

Simulate registering 4 client connections to a WebSocket broker, broadcast an announcement message, and print the total number of recipients that received the message.

<div class="pyodide-runner" data-mode="challenge" data-expected="4">
<pre><code class="language-python">clients = ["client_a", "client_b", "client_c", "client_d"]
inboxes = {c: [] for c in clients}

message = {"event": "server_maintenance", "in": "10m"}

# Deliver message to all client inboxes in inboxes dict
# Print the count of clients that received the message
</code></pre>
</div>

### Challenge 2 — Connection Disconnect Cleanup

Simulate client disconnection cleanup: start with 4 connected clients in a set, remove one client (`"client_b"`), and print the remaining client count.

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">active_connections = {"client_a", "client_b", "client_c", "client_d"}

# Remove "client_b" from active_connections
# Print the number of remaining active connections
</code></pre>
</div>

---

## 📚 Further Reading

- [FastAPI WebSocket Documentation](https://fastapi.tiangolo.com/advanced/websockets/)
- [MDN WebSockets API Guide](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
- [Scaling WebSockets with Redis Pub/Sub](https://redis.io/docs/interact/pubsub/)

---

!!! success "Lesson Complete 🎉"
    You understand the fundamentals of full-duplex WebSocket APIs, implementing connection managers with FastAPI, organizing channels, and scaling with Redis Pub/Sub.

[⬅️ Lesson 75 · Monitoring APIs with Prometheus](75-prometheus-monitoring.md){ .md-button } [➡️ Lesson 77 · FastAPI with GraphQL](77-fastapi-graphql.md){ .md-button .md-button--primary }
