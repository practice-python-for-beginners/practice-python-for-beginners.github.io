---
title: "Lesson 99 · Realtime Dashboard with FastAPI & Vue"
description: "Build a live dashboard using Server-Sent Events and WebSockets — FastAPI SSE with StreamingResponse, Vue 3 EventSource API, live chart updates, and connection management."
---

# Lesson 99 · Realtime Dashboard with FastAPI & Vue

> **Section:** 🏢 Enterprise Architecture &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~90 minutes

---

## 🎯 Learning Objectives

- [ ] Compare Server-Sent Events (SSE) and WebSockets for real-time dashboards
- [ ] Implement SSE streaming with FastAPI's `StreamingResponse`
- [ ] Build a Vue 3 EventSource client that reconnects on disconnect
- [ ] Broadcast periodic metrics to all connected clients
- [ ] Manage a connection registry to prevent memory leaks
- [ ] Format SSE events correctly and handle client disconnects gracefully

---

## 📖 Introduction

Dashboards that show live metrics — CPU usage, active users, revenue counters — need a way to push updates from the server to the browser without the browser polling every second. Two technologies solve this: **Server-Sent Events (SSE)** for simple one-way streams, and **WebSockets** for bidirectional communication.

SSE is the right choice for most dashboards: it's simpler, works over HTTP/1.1, auto-reconnects in the browser, and needs no special infrastructure. WebSockets are only needed when the browser also needs to send data back on the same channel (chat, collaborative editing).

---

## 1. SSE vs WebSockets

=== "Comparison"
    ```python
    # Server-Sent Events (SSE):
    # ✓ Simple — just an HTTP response that never ends
    # ✓ Auto-reconnects in every browser
    # ✓ Works through HTTP/1.1 proxies without config
    # ✓ Uses standard text/event-stream content-type
    # ✗ One-way only: server → client
    # ✗ Limited to text data (JSON is fine)

    # WebSockets:
    # ✓ Bidirectional: both sides can send at any time
    # ✓ Binary frames for efficient data (images, protobufs)
    # ✓ Lower overhead after handshake
    # ✗ Requires WebSocket-aware proxies / load balancers
    # ✗ No built-in reconnection (must implement manually)
    # ✗ More complex server and client code

    CHOOSE = {
        "dashboard metrics":      "SSE",
        "chat application":       "WebSocket",
        "live log viewer":        "SSE",
        "collaborative document": "WebSocket",
        "notification feed":      "SSE",
        "multiplayer game":       "WebSocket",
    }
    ```

=== "SSE Wire Format"
    ```
    # SSE is plain text over HTTP. Each event is separated by a blank line.
    # Field types: data, event, id, retry

    data: {"cpu": 42.5, "ts": 1706000000}

    event: alert
    data: {"message": "CPU spike detected", "level": "warning"}
    id: evt-42

    data: {"cpu": 38.1, "ts": 1706000001}

    # The browser's EventSource reconnects using the Last-Event-ID header.
    # retry: 3000   ← tell client to reconnect after 3 seconds if disconnected
    ```

---

## 2. FastAPI SSE Endpoint

```python
import asyncio
import json
import time
import random
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

app = FastAPI()

async def generate_metrics(request: Request):
    """
    Async generator that yields SSE-formatted metric events.
    Stops when the client disconnects.
    """
    event_id = 0
    while True:
        # Check if client has disconnected
        if await request.is_disconnected():
            print("Client disconnected")
            break

        # Build metrics payload
        metrics = {
            "ts":          time.time(),
            "cpu_pct":     round(random.uniform(10, 90), 1),
            "mem_mb":      round(random.uniform(200, 800), 0),
            "req_per_sec": random.randint(50, 500),
        }

        # Format as SSE event
        yield f"id: {event_id}\n"
        yield f"data: {json.dumps(metrics)}\n"
        yield "\n"           # blank line terminates the event

        event_id += 1
        await asyncio.sleep(1)  # push one update per second

@app.get("/metrics/stream")
async def metrics_stream(request: Request):
    return StreamingResponse(
        generate_metrics(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",  # disable Nginx buffering
        },
    )
```

---

## 3. Broadcasting to Multiple Clients

```python
import asyncio
from typing import AsyncGenerator

class ConnectionManager:
    """Registry of active SSE connections."""
    def __init__(self):
        self._queues: list[asyncio.Queue] = []

    def connect(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._queues.append(q)
        print(f"Client connected. Total: {len(self._queues)}")
        return q

    def disconnect(self, q: asyncio.Queue):
        self._queues.remove(q)
        print(f"Client disconnected. Total: {len(self._queues)}")

    async def broadcast(self, data: dict):
        """Send data to all connected clients."""
        msg = f"data: {json.dumps(data)}\n\n"
        dead = []
        for q in self._queues:
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                dead.append(q)   # slow client — disconnect
        for q in dead:
            self.disconnect(q)

manager = ConnectionManager()

@app.get("/events")
async def event_stream(request: Request):
    q = manager.connect()
    async def stream() -> AsyncGenerator[str, None]:
        try:
            while not await request.is_disconnected():
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=1.0)
                    yield msg
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"  # prevent proxy timeout
        finally:
            manager.disconnect(q)
    return StreamingResponse(stream(), media_type="text/event-stream")

# Background task — push metrics to all clients every second
@app.on_event("startup")
async def start_broadcaster():
    asyncio.create_task(broadcast_loop())

async def broadcast_loop():
    while True:
        metrics = {
            "ts": time.time(),
            "cpu": round(random.uniform(10, 90), 1),
            "active_users": random.randint(100, 1000),
        }
        await manager.broadcast(metrics)
        await asyncio.sleep(1)
```

---

## 4. Vue 3 EventSource Client

```javascript
// frontend/src/composables/useMetricsStream.ts
import { ref, onMounted, onUnmounted } from 'vue'

export function useMetricsStream() {
  const metrics = ref({ cpu: 0, mem_mb: 0, req_per_sec: 0 })
  const connected = ref(false)
  let source: EventSource | null = null

  function connect() {
    source = new EventSource('/metrics/stream')

    source.onopen = () => {
      connected.value = true
      console.log('SSE connected')
    }

    source.onmessage = (event) => {
      const data = JSON.parse(event.data)
      metrics.value = data
    }

    // Listen for named events
    source.addEventListener('alert', (event: MessageEvent) => {
      const alert = JSON.parse(event.data)
      console.warn('Alert:', alert.message)
    })

    source.onerror = () => {
      connected.value = false
      // EventSource automatically reconnects — no need to do it manually
    }
  }

  onMounted(connect)
  onUnmounted(() => source?.close())

  return { metrics, connected }
}
```

```vue
<!-- frontend/src/components/MetricsDashboard.vue -->
<template>
  <div class="dashboard">
    <div class="metric-card">
      <h3>CPU Usage</h3>
      <div class="value">{{ metrics.cpu_pct }}%</div>
    </div>
    <div class="metric-card">
      <h3>Memory</h3>
      <div class="value">{{ metrics.mem_mb }} MB</div>
    </div>
    <div class="metric-card">
      <h3>Requests/sec</h3>
      <div class="value">{{ metrics.req_per_sec }}</div>
    </div>
    <span :class="connected ? 'dot-green' : 'dot-red'">
      {{ connected ? 'Live' : 'Reconnecting...' }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { useMetricsStream } from '@/composables/useMetricsStream'
const { metrics, connected } = useMetricsStream()
</script>
```

---

## 5. Moving Average for Smoothed Metrics

```python
from collections import deque

class MovingAverage:
    """Compute a rolling average over the last N readings."""
    def __init__(self, window: int):
        self.window = window
        self._data: deque[float] = deque(maxlen=window)

    def update(self, value: float) -> float:
        self._data.append(value)
        return self.average

    @property
    def average(self) -> float:
        if not self._data:
            return 0.0
        return round(sum(self._data) / len(self._data), 2)

# Simulate 10 CPU readings and show 3-sample moving average
cpu_readings = [45, 52, 38, 60, 72, 55, 48, 65, 70, 58]
ma = MovingAverage(window=3)

print(f"{'Reading':>8} {'Smoothed':>10}")
print("-" * 20)
for reading in cpu_readings:
    smoothed = ma.update(reading)
    print(f"{reading:>8} {smoothed:>10.2f}")
```

!!! note "SSE keepalives"
    Some proxies and load balancers (Nginx, AWS ALB) will close idle connections. Send a comment line (`: keepalive\n\n`) every 15–30 seconds to keep the connection alive without triggering a client event.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate SSE data generation — produce 5 metrics events and format as SSE strings
import json
import time

def generate_sse_events(count: int) -> list[str]:
    """Generate SSE-formatted event strings."""
    events = []
    for i in range(count):
        payload = {
            "id":    i,
            "cpu":   round(40 + i * 2.5, 1),
            "users": 100 + i * 10,
        }
        # SSE format: "data: {json}\n\n"
        sse = f"data: {json.dumps(payload)}"
        events.append(sse)
    return events

events = generate_sse_events(5)
for i, event in enumerate(events, 1):
    print(f"Event {i}: {event}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Format SSE Events

Format 3 events as SSE strings `"data: {json}"` and print the count of formatted strings produced.

Expected output:
```
3
```

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">import json

payloads = [
    {"metric": "cpu",     "value": 42.5},
    {"metric": "memory",  "value": 512},
    {"metric": "req_sec", "value": 250},
]

# Format each payload as "data: {json}" and count the results
# Print the count
</code></pre>
</div>

---

### Challenge 2 — Moving Average

Simulate 5 metric readings `[10, 8, 6, 9, 8]` and compute the moving average of the **last 3** readings. Print the result rounded to 2 decimal places.

Expected output:
```
8.33
```

<div class="pyodide-runner" data-mode="challenge" data-expected="8.33">
<pre><code class="language-python">readings = [10, 8, 6, 9, 8]

# Compute the moving average of the last 3 readings
# Round to 2 decimal places and print
</code></pre>
</div>

---

## 📚 Further Reading

- [Server-Sent Events — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/)
- [Vue 3 Composition API — Composables](https://vuejs.org/guide/reusability/composables.html)

---

[⬅️ Lesson 98 · End-to-End Web Application](98-end-to-end-webapp.md){ .md-button } [➡️ Lesson 100 · Complete Portfolio API Project](100-complete-portfolio.md){ .md-button .md-button--primary }
