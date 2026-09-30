---
title: "Lesson 46 · Redis Pub/Sub with FastAPI"
description: "Publish and subscribe to real-time messages with Redis pub/sub, integrate with FastAPI Server-Sent Events, and learn channel naming conventions."
---

# Lesson 46 · Redis Pub/Sub with FastAPI

> **Section:** Security, Webhooks & Microservices &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** 35 min

## 🎯 Learning Objectives

- [ ] Explain the Redis pub/sub model and how it differs from message queues
- [ ] Publish messages to named Redis channels from Python
- [ ] Subscribe to channels and receive messages in real time
- [ ] Identify real-world use cases: notifications, chat, live dashboards
- [ ] Integrate Redis pub/sub with FastAPI's Server-Sent Events (SSE)
- [ ] Apply channel naming conventions for maintainable systems

## 📖 Introduction

**Redis pub/sub** is a fire-and-forget messaging system built into Redis. Publishers send messages to *channels*; every subscriber currently listening on that channel receives a copy instantly. Unlike RabbitMQ queues, messages are *not* stored — if a subscriber is offline when a message is published, it misses it.

This makes Redis pub/sub perfect for ephemeral, real-time broadcast use cases: push notifications, live chat, online presence indicators, and streaming API results to a browser via **Server-Sent Events (SSE)**.

!!! info "Running Redis locally"
    ```bash
    docker run -d --name redis -p 6379:6379 redis:7-alpine
    ```

---

## 1. Core Pub/Sub Concepts

=== "Publish / subscribe model"
    ```
    Publisher                  Redis               Subscribers
    ─────────                  ─────               ───────────
    r.publish("alerts",        ──→  channel        ──→ subscriber A
              "server down")        "alerts"       ──→ subscriber B
                                                   ──→ subscriber C
    ```

=== "Key differences from queues"
    | Feature | Redis Pub/Sub | RabbitMQ Queue |
    |---------|--------------|----------------|
    | Message persistence | ❌ fire-and-forget | ✅ durable |
    | Offline consumer support | ❌ misses messages | ✅ messages wait |
    | Fan-out | ✅ native | ✅ via fanout exchange |
    | Delivery guarantee | best-effort | at-least-once with ACK |
    | Typical use case | real-time notifications | async job processing |

---

## 2. Publishing Messages

=== "Synchronous publish (redis-py)"
    ```python
    # pip install redis
    import redis

    r = redis.Redis(host="localhost", port=6379, decode_responses=True)

    # Publish to a channel — returns subscriber count
    receivers = r.publish("alerts", "server down")
    print(f"Message delivered to {receivers} subscriber(s)")
    ```

=== "Async publish (redis.asyncio)"
    ```python
    import redis.asyncio as aioredis

    async def publish_alert(message: str):
        r = aioredis.Redis(host="localhost", decode_responses=True)
        count = await r.publish("alerts", message)
        await r.aclose()
        return count
    ```

=== "Simulated publish (stdlib — no Redis needed)"
    ```python
    # Simulate pub/sub with a dict of subscriber callbacks
    import collections

    channels: dict[str, list] = collections.defaultdict(list)

    def subscribe(channel: str, callback):
        channels[channel].append(callback)

    def publish(channel: str, message: str) -> int:
        subscribers = channels.get(channel, [])
        for callback in subscribers:
            callback(message)
        return len(subscribers)
    ```

---

## 3. Subscribing and Receiving

=== "Blocking subscriber (redis-py)"
    ```python
    import redis, threading

    r = redis.Redis(decode_responses=True)
    pubsub = r.pubsub()
    pubsub.subscribe("alerts", "orders")

    def listener():
        for message in pubsub.listen():
            if message["type"] == "message":
                channel = message["channel"]
                data = message["data"]
                print(f"[{channel}] {data}")

    thread = threading.Thread(target=listener, daemon=True)
    thread.start()
    ```

=== "Pattern subscription"
    ```python
    # Subscribe to all channels matching a pattern
    pubsub.psubscribe("order.*")   # matches order.created, order.shipped ...
    pubsub.psubscribe("user.*")
    ```

=== "Async subscriber"
    ```python
    import redis.asyncio as aioredis

    async def listen_forever():
        r = aioredis.Redis(decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe("notifications")

        async for message in pubsub.listen():
            if message["type"] == "message":
                print(f"Received: {message['data']}")
    ```

---

## 4. FastAPI + Server-Sent Events

SSE lets a server push data to a browser over a single long-lived HTTP connection — no WebSocket needed.

=== "SSE endpoint"
    ```python
    from fastapi import FastAPI
    from fastapi.responses import StreamingResponse
    import redis.asyncio as aioredis
    import asyncio

    app = FastAPI()

    async def event_generator(channel: str):
        r = aioredis.Redis(decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    yield f"data: {data}\n\n"   # SSE format
        finally:
            await r.aclose()

    @app.get("/stream/{channel}")
    async def stream(channel: str):
        return StreamingResponse(
            event_generator(channel),
            media_type="text/event-stream",
        )
    ```

=== "Browser client"
    ```javascript
    const source = new EventSource("/stream/alerts");
    source.onmessage = (event) => {
        console.log("Alert:", event.data);
        document.getElementById("alerts").textContent += event.data + "\n";
    };
    ```

=== "Heartbeat to prevent timeout"
    ```python
    async def event_generator_with_heartbeat(channel: str):
        r = aioredis.Redis(decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe(channel)

        async for message in pubsub.listen():
            if message["type"] == "message":
                yield f"data: {message['data']}\n\n"
            else:
                yield ": heartbeat\n\n"   # comment line keeps connection alive
            await asyncio.sleep(0)
    ```

---

## 5. Channel Naming Conventions

Consistent naming makes your pub/sub topology navigable and pattern-subscribable.

| Convention | Example | Notes |
|------------|---------|-------|
| `<resource>.<event>` | `order.shipped` | Most common |
| `<tenant>:<resource>.<event>` | `acme:order.shipped` | Multi-tenant |
| `<env>.<resource>.<event>` | `prod.order.shipped` | Environment isolation |
| `user:<id>.notifications` | `user:42.notifications` | Per-user channels |

```python
def channel_name(resource: str, event: str, tenant: str = "default") -> str:
    return f"{tenant}:{resource}.{event}"

print(channel_name("order", "shipped", "acme"))
# acme:order.shipped
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">

```python
import collections

# Simulate Redis pub/sub with plain Python
channels = collections.defaultdict(list)
message_log = []

def subscribe(channel: str, name: str):
    """Register a named subscriber on a channel."""
    channels[channel].append(name)

def publish(channel: str, message: str) -> int:
    """Broadcast message to all subscribers; return count notified."""
    subscribers = channels.get(channel, [])
    for sub in subscribers:
        message_log.append({"subscriber": sub, "channel": channel, "message": message})
    return len(subscribers)

# Set up subscribers
subscribe("alerts",        "dashboard")
subscribe("alerts",        "email-service")
subscribe("alerts",        "pager-duty")
subscribe("order.created", "inventory-service")
subscribe("order.created", "email-service")

# Publish messages
print(f"Published to 'alerts': {publish('alerts', 'server down')} notified")
print(f"Published to 'order.created': {publish('order.created', 'order #1001')} notified")
print(f"Published to 'payments': {publish('payments', 'no one listening')} notified")

print(f"\nTotal deliveries logged: {len(message_log)}")
for entry in message_log:
    print(f"  [{entry['channel']}] → {entry['subscriber']}: {entry['message']}")
```

</div>

---

## 🏋️ Challenges

**Challenge 1 — Count subscribers notified**

<div class="pyodide-runner" data-mode="challenge" data-expected="3">

```python
import collections

channels = collections.defaultdict(list)

def subscribe(channel, name):
    channels[channel].append(name)

def publish(channel, message):
    return len(channels.get(channel, []))

subscribe("alerts", "service-a")
subscribe("alerts", "service-b")
subscribe("alerts", "service-c")

# TODO: publish "disk full" to "alerts" and print the count of subscribers notified
```

</div>

---

**Challenge 2 — Format a message with a prefix**

<div class="pyodide-runner" data-mode="challenge" data-expected="ALERT: server down">

```python
def format_alert(message: str) -> str:
    # TODO: return the message prefixed with "ALERT: "
    pass

print(format_alert("server down"))
```

</div>

---

## 📚 Further Reading

- [Redis Pub/Sub — Official Docs](https://redis.io/docs/manual/pubsub/)
- [redis-py Pub/Sub Guide](https://redis-py.readthedocs.io/en/stable/advanced_features.html#publish-subscribe)
- [Server-Sent Events — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

!!! success "Lesson 46 complete!"
    You can now publish and subscribe to Redis channels, integrate pub/sub with FastAPI SSE endpoints, and apply channel naming conventions for a maintainable real-time messaging layer.

[⬅️ Previous Lesson](45-rabbitmq-queues.md){ .md-button } [➡️ Next Lesson](47-microservices-basics.md){ .md-button .md-button--primary }
