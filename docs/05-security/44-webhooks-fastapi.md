---
title: "Lesson 44 · Webhook Events with FastAPI"
description: "Handle webhook events asynchronously in FastAPI using BackgroundTasks, event dispatchers, queues, and replay capability."
---

# Lesson 44 · Webhook Events with FastAPI

> **Section:** Security, Webhooks & Microservices &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** 30 min

## 🎯 Learning Objectives

- [ ] Write an async webhook handler in FastAPI using `BackgroundTasks`
- [ ] Route incoming events to the correct handler using a dispatcher dict
- [ ] Handle common event types: `created`, `updated`, `deleted`
- [ ] Store events in an in-memory queue for replay and auditing
- [ ] Understand why `async def` matters for webhook throughput
- [ ] Implement a basic replay endpoint to reprocess stored events

## 📖 Introduction

FastAPI is a natural fit for webhooks: its async request handling means your endpoint can accept a new request while the previous one's background task is still running, making it far more scalable under provider retry bursts than a synchronous Flask handler.

This lesson focuses on the *internal architecture* of a webhook processor — how to route different event types cleanly, store events for replay, and leverage `BackgroundTasks` without reaching for a full message broker.

!!! tip "When to upgrade to a real queue"
    `BackgroundTasks` is tied to the process. If your container restarts while a task is in-flight, the task is lost. Use Celery or ARQ when you need durability guarantees.

---

## 1. Async Webhook Handler with BackgroundTasks

=== "Basic async handler"
    ```python
    from fastapi import FastAPI, BackgroundTasks, Request
    from fastapi.responses import JSONResponse

    app = FastAPI()

    async def process_event(event_type: str, payload: dict):
        """Runs after the response is sent."""
        print(f"[BACKGROUND] Processing {event_type}: {payload}")

    @app.post("/webhooks")
    async def receive_webhook(
        request: Request, background_tasks: BackgroundTasks
    ):
        payload = await request.json()
        event_type = request.headers.get("X-Event-Type", "unknown")

        background_tasks.add_task(process_event, event_type, payload)

        return JSONResponse({"status": "accepted"}, status_code=202)
    ```

=== "Async vs sync handlers"
    ```python
    # ✅ async: non-blocking — other requests can run while this awaits IO
    async def process_event(event_type: str, payload: dict):
        await asyncio.sleep(0)  # yield control
        ...

    # ✅ sync: runs in a thread pool — fine for CPU or blocking IO
    def process_event_sync(event_type: str, payload: dict):
        time.sleep(0.1)  # blocking — FastAPI moves it to a thread
        ...
    ```

---

## 2. Event Dispatcher Pattern

A dispatcher maps event type strings to handler callables, keeping each handler small and single-purpose.

=== "Dispatcher dict"
    ```python
    from typing import Callable

    async def handle_order_created(payload: dict):
        order_id = payload.get("id")
        print(f"Order created: #{order_id}")

    async def handle_order_updated(payload: dict):
        print(f"Order {payload.get('id')} updated")

    async def handle_order_deleted(payload: dict):
        print(f"Order {payload.get('id')} deleted")

    EVENT_HANDLERS: dict[str, Callable] = {
        "order.created": handle_order_created,
        "order.updated": handle_order_updated,
        "order.deleted": handle_order_deleted,
    }

    async def dispatch(event_type: str, payload: dict):
        handler = EVENT_HANDLERS.get(event_type)
        if handler:
            await handler(payload)
        else:
            print(f"No handler for event: {event_type}")
    ```

=== "FastAPI route using dispatcher"
    ```python
    @app.post("/webhooks")
    async def receive_webhook(request: Request, background_tasks: BackgroundTasks):
        payload = await request.json()
        event_type = payload.get("type", "unknown")
        background_tasks.add_task(dispatch, event_type, payload)
        return {"status": "accepted"}
    ```

=== "Simulated dispatcher (stdlib)"
    ```python
    # No FastAPI needed — pure Python simulation
    outputs = []

    def handle_order_created(payload):
        msg = f"Order created: #{payload['id']}"
        outputs.append(msg)
        return msg

    def handle_order_updated(payload):
        return f"Order {payload['id']} updated"

    HANDLERS = {
        "order.created": handle_order_created,
        "order.updated": handle_order_updated,
    }

    def dispatch(event_type: str, payload: dict):
        handler = HANDLERS.get(event_type)
        return handler(payload) if handler else "no handler"

    print(dispatch("order.created", {"id": 1001}))
    # Order created: #1001
    ```

---

## 3. Event Storage & Replay

Storing every incoming event lets you replay them if a handler fails or you deploy a new handler.

=== "In-memory event log"
    ```python
    import collections
    import datetime

    event_log: list[dict] = []

    async def store_and_dispatch(event_type: str, payload: dict):
        event = {
            "id": len(event_log) + 1,
            "type": event_type,
            "payload": payload,
            "received_at": datetime.datetime.utcnow().isoformat(),
            "processed": False,
        }
        event_log.append(event)
        await dispatch(event_type, payload)
        event["processed"] = True
    ```

=== "Replay endpoint"
    ```python
    @app.post("/webhooks/replay/{event_id}")
    async def replay_event(event_id: int, background_tasks: BackgroundTasks):
        event = next((e for e in event_log if e["id"] == event_id), None)
        if not event:
            return {"error": "Event not found"}, 404
        background_tasks.add_task(dispatch, event["type"], event["payload"])
        return {"status": "replaying", "event_id": event_id}
    ```

=== "Event log query"
    ```python
    @app.get("/webhooks/events")
    async def list_events(event_type: str | None = None):
        if event_type:
            return [e for e in event_log if e["type"] == event_type]
        return event_log
    ```

---

## 4. Event Queue with collections.deque

For a simple producer/consumer separation, `collections.deque` works well within a single process.

=== "Bounded queue"
    ```python
    import collections
    import asyncio

    event_queue: collections.deque = collections.deque(maxlen=1000)

    async def enqueue(event: dict):
        event_queue.appendleft(event)

    async def worker():
        while True:
            if event_queue:
                event = event_queue.pop()
                await dispatch(event["type"], event["payload"])
            else:
                await asyncio.sleep(0.1)  # idle wait
    ```

=== "Starting the worker with lifespan"
    ```python
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        task = asyncio.create_task(worker())
        yield
        task.cancel()

    app = FastAPI(lifespan=lifespan)
    ```

---

## 5. Event Routing Table

| Event Pattern | Example Types | Handler Strategy |
|---------------|---------------|-----------------|
| `<resource>.<action>` | `order.created`, `user.deleted` | Dict dispatcher |
| Wildcard `order.*` | `order.created`, `order.updated` | Prefix match |
| Versioned `v2.order.created` | Multi-version streams | Version router → sub-dispatcher |
| Priority events | `payment.failed` | Separate high-priority queue |

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">

```python
import collections

# Simulated event dispatcher
event_log = []

def handle_order_created(payload):
    return f"Order created: #{payload['id']}"

def handle_order_updated(payload):
    return f"Order {payload['id']} updated to status: {payload.get('status','?')}"

def handle_order_deleted(payload):
    return f"Order {payload['id']} deleted"

HANDLERS = {
    "order.created": handle_order_created,
    "order.updated": handle_order_updated,
    "order.deleted": handle_order_deleted,
}

def dispatch(event_type, payload):
    handler = HANDLERS.get(event_type)
    result = handler(payload) if handler else f"No handler for: {event_type}"
    event_log.append({"type": event_type, "result": result})
    return result

# Simulate incoming webhook events
events = [
    ("order.created", {"id": 1001}),
    ("order.updated", {"id": 1001, "status": "shipped"}),
    ("order.created", {"id": 1002}),
    ("payment.received", {"amount": 49.99}),
    ("order.deleted", {"id": 1001}),
]

for etype, payload in events:
    print(dispatch(etype, payload))

print(f"\nTotal events logged: {len(event_log)}")
```

</div>

---

## 🏋️ Challenges

**Challenge 1 — Dispatch order.created**

<div class="pyodide-runner" data-mode="challenge" data-expected="Order created: #1001">

```python
def handle_order_created(payload):
    return f"Order created: #{payload['id']}"

HANDLERS = {"order.created": handle_order_created}

def dispatch(event_type, payload):
    handler = HANDLERS.get(event_type)
    return handler(payload) if handler else "no handler"

# TODO: dispatch "order.created" with payload {"id": 1001} and print the result
```

</div>

---

**Challenge 2 — Count events in a log**

<div class="pyodide-runner" data-mode="challenge" data-expected="5">

```python
event_log = [
    {"type": "order.created", "id": 1},
    {"type": "order.updated", "id": 2},
    {"type": "order.created", "id": 3},
    {"type": "order.deleted", "id": 4},
    {"type": "payment.received", "id": 5},
]

# TODO: print the total number of events in event_log
```

</div>

---

## 📚 Further Reading

- [FastAPI Background Tasks — Official Docs](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Webhook.site — Test webhooks without a server](https://webhook.site/)
- [CloudEvents Specification — Standardised event format](https://cloudevents.io/)

---

!!! success "Lesson 44 complete!"
    You can now build async webhook receivers in FastAPI, route events through a dispatcher, store events for replay, and use a bounded queue for producer/consumer separation.

[⬅️ Previous Lesson](43-webhooks-flask.md){ .md-button } [➡️ Next Lesson](45-rabbitmq-queues.md){ .md-button .md-button--primary }
