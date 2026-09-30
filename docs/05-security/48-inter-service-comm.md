---
title: "Lesson 48 · Inter-Service Communication"
description: "Master service-to-service communication: sync HTTP, async event buses, gRPC overview, service contracts, versioning, exponential backoff retries, and correlation IDs."
---

# Lesson 48 · Inter-Service Communication

> **Section:** Security, Webhooks & Microservices &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** 45 min

## 🎯 Learning Objectives

- [ ] Implement synchronous HTTP calls between services using `httpx`
- [ ] Design async event-based communication via a message bus
- [ ] Understand the gRPC protocol and when it beats REST
- [ ] Define service contracts with shared Pydantic schemas
- [ ] Handle API versioning without breaking existing consumers
- [ ] Implement exponential backoff retry with jitter
- [ ] Generate and propagate correlation IDs for distributed tracing

## 📖 Introduction

In a microservices system, every service call is a network call. Networks fail, slow down, and time out. This lesson focuses on the engineering discipline that makes inter-service communication robust: retrying with backoff so you don't overload failing services, propagating correlation IDs so you can trace a request across 10 services, versioning contracts so you can evolve services independently, and choosing the right transport (REST, async events, or gRPC) for each type of interaction.

!!! tip "Two rules of distributed systems"
    1. Anything that can fail will fail — plan retries and circuit breakers.
    2. You cannot know the order events arrive — design for idempotency.

---

## 1. Synchronous HTTP with httpx

`httpx` is the modern async-capable alternative to `requests` for service-to-service calls.

=== "Async client (best practice)"
    ```python
    # pip install httpx
    import httpx
    from contextlib import asynccontextmanager

    # ✅ Reuse a single client instance — avoids TCP overhead per call
    _client: httpx.AsyncClient | None = None

    async def get_client() -> httpx.AsyncClient:
        global _client
        if _client is None:
            _client = httpx.AsyncClient(
                timeout=httpx.Timeout(connect=2.0, read=10.0),
                limits=httpx.Limits(max_connections=100),
            )
        return _client

    async def fetch_user(user_id: int) -> dict:
        client = await get_client()
        resp = await client.get(f"http://auth-service/users/{user_id}")
        resp.raise_for_status()
        return resp.json()
    ```

=== "Header propagation"
    ```python
    async def fetch_user(user_id: int, correlation_id: str) -> dict:
        client = await get_client()
        resp = await client.get(
            f"http://auth-service/users/{user_id}",
            headers={
                "X-Request-ID":     correlation_id,
                "X-Caller-Service": "orders-service",
            },
        )
        resp.raise_for_status()
        return resp.json()
    ```

---

## 2. Exponential Backoff with Jitter

Retrying immediately after a failure hammers an already-struggling service. Backoff spaces retries out exponentially; jitter randomises them to avoid synchronised retry storms.

=== "Implementation"
    ```python
    import time
    import random

    def retry_with_backoff(fn, max_attempts: int = 5, base: float = 0.5):
        """
        Retry fn up to max_attempts times.
        Delay = base * 2^attempt + random jitter (0–1 s)
        """
        for attempt in range(1, max_attempts + 1):
            try:
                return fn()
            except Exception as e:
                if attempt == max_attempts:
                    raise
                delay = base * (2 ** attempt) + random.uniform(0, 1)
                print(f"Attempt {attempt} failed: {e}. Retrying in {delay:.2f}s …")
                time.sleep(delay)
    ```

=== "Simulated retry (no sleep for testing)"
    ```python
    def retry_no_sleep(fn, max_attempts: int = 5):
        for attempt in range(1, max_attempts + 1):
            try:
                return fn(), attempt
            except Exception as e:
                if attempt == max_attempts:
                    raise
        # unreachable

    attempt_counter = 0

    def succeeds_on_third():
        global attempt_counter
        attempt_counter += 1
        if attempt_counter < 3:
            raise ConnectionError("service down")
        return "ok"

    result, attempts = retry_no_sleep(succeeds_on_third)
    print(f"success on attempt {attempts}")   # success on attempt 3
    ```

=== "Backoff schedule"
    | Attempt | base=0.5s | Delay range (with jitter) |
    |---------|-----------|--------------------------|
    | 1 | 1 s | 1.0 – 2.0 s |
    | 2 | 2 s | 2.0 – 3.0 s |
    | 3 | 4 s | 4.0 – 5.0 s |
    | 4 | 8 s | 8.0 – 9.0 s |

---

## 3. Async Event Bus

For decoupled, fire-and-forget communication, services emit events onto a shared bus rather than calling each other directly.

=== "In-process event bus (for testing)"
    ```python
    import asyncio
    from collections import defaultdict
    from typing import Callable, Awaitable

    Subscriber = Callable[[dict], Awaitable[None]]

    class EventBus:
        def __init__(self):
            self._handlers: dict[str, list[Subscriber]] = defaultdict(list)

        def subscribe(self, event: str, handler: Subscriber):
            self._handlers[event].append(handler)

        async def publish(self, event: str, payload: dict):
            handlers = self._handlers.get(event, [])
            await asyncio.gather(*[h(payload) for h in handlers])

    bus = EventBus()
    ```

=== "Services wired to the bus"
    ```python
    async def on_order_created(payload: dict):
        print(f"[inventory] reserving items for order {payload['id']}")

    async def on_order_created_notify(payload: dict):
        print(f"[email] notifying customer for order {payload['id']}")

    bus.subscribe("order.created", on_order_created)
    bus.subscribe("order.created", on_order_created_notify)

    # Orders service publishes
    await bus.publish("order.created", {"id": 1001, "user_id": 42})
    ```

---

## 4. gRPC Overview

gRPC is Google's RPC framework: strongly typed, binary-serialised (protobuf), and significantly faster than REST/JSON for high-frequency internal calls.

=== "When to choose gRPC"
    | Factor | REST/JSON | gRPC |
    |--------|-----------|------|
    | Human readability | ✅ | ❌ (binary) |
    | Payload size | Larger | ~5× smaller |
    | Streaming | Limited (SSE/WS) | Native (4 modes) |
    | Client codegen | Optional | Required (.proto → stub) |
    | Browser support | ✅ native | ⚠️ needs grpc-web |
    | Use case | Public APIs, webhooks | Internal high-throughput RPCs |

=== "Proto definition"
    ```protobuf
    // users.proto
    syntax = "proto3";

    service UserService {
      rpc GetUser (GetUserRequest) returns (UserResponse);
    }

    message GetUserRequest { int32 user_id = 1; }
    message UserResponse   { int32 id = 1; string name = 2; string email = 3; }
    ```

=== "Python gRPC client (stub)"
    ```python
    # pip install grpcio grpcio-tools
    # python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. users.proto

    import grpc
    import users_pb2, users_pb2_grpc

    channel = grpc.insecure_channel("auth-service:50051")
    stub = users_pb2_grpc.UserServiceStub(channel)
    response = stub.GetUser(users_pb2.GetUserRequest(user_id=42))
    print(response.name)
    ```

---

## 5. Service Contracts, Versioning & Correlation IDs

=== "Shared Pydantic schema"
    ```python
    # shared/schemas/order.py — imported by both orders-service and payments-service
    from pydantic import BaseModel

    class OrderCreatedEvent(BaseModel):
        order_id: int
        user_id: int
        total_cents: int
        currency: str = "USD"
        items: list[dict]
    ```

=== "URL versioning"
    ```python
    from fastapi import FastAPI, APIRouter

    app = FastAPI()

    v1 = APIRouter(prefix="/v1")
    v2 = APIRouter(prefix="/v2")

    @v1.get("/orders/{id}")
    async def get_order_v1(id: int):
        return {"id": id, "status": "shipped"}   # old shape

    @v2.get("/orders/{id}")
    async def get_order_v2(id: int):
        return {"order_id": id, "state": "shipped", "eta": "2025-08-01"}  # new shape

    app.include_router(v1)
    app.include_router(v2)
    ```

=== "Correlation IDs"
    ```python
    import uuid

    def new_correlation_id() -> str:
        """Generate a UUID4 correlation ID — 36 characters."""
        return str(uuid.uuid4())

    cid = new_correlation_id()
    print(f"X-Request-ID: {cid}")
    print(f"Length: {len(cid)}")   # 36
    # Propagate in outgoing headers:
    # headers["X-Request-ID"] = cid
    ```

!!! info "Correlation ID format"
    UUID4 (`xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`) is 36 characters. Loggers should output the CID on every line so you can `grep` a full request trace across services.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">

```python
import time
import random

# Exponential backoff retry without real sleeping
call_log = []

def retry_with_backoff(fn, max_attempts=5, base=0.5):
    for attempt in range(1, max_attempts + 1):
        try:
            result = fn()
            call_log.append({"attempt": attempt, "success": True})
            return result, attempt
        except Exception as e:
            call_log.append({"attempt": attempt, "success": False, "error": str(e)})
            if attempt == max_attempts:
                raise
            delay = base * (2 ** attempt)
            # Skip actual sleep for the demo
            print(f"  Attempt {attempt} failed — would wait {delay:.1f}s")

# Simulate a function that fails twice then succeeds
failures = 0
def flaky():
    global failures
    failures += 1
    if failures < 3:
        raise ConnectionError("connection refused")
    return "200 OK"

result, n = retry_with_backoff(flaky)
print(f"\nResult: {result}")
print(f"Succeeded on attempt: {n}")
print("\nCall log:")
for entry in call_log:
    status = "✅" if entry["success"] else "❌"
    print(f"  {status} Attempt {entry['attempt']}: {entry.get('error', 'success')}")
```

</div>

---

## 🏋️ Challenges

**Challenge 1 — Retry with backoff, succeed on attempt 3**

<div class="pyodide-runner" data-mode="challenge" data-expected="success on attempt 3">

```python
attempt_count = 0

def flaky_service():
    global attempt_count
    attempt_count += 1
    if attempt_count < 3:
        raise ConnectionError("down")
    return "ok"

def retry(fn, max_attempts=5):
    for attempt in range(1, max_attempts + 1):
        try:
            fn()
            return attempt
        except Exception:
            if attempt == max_attempts:
                raise

# TODO: call retry(flaky_service) and print "success on attempt <n>"
```

</div>

---

**Challenge 2 — Generate a UUID4 correlation ID and verify its length**

<div class="pyodide-runner" data-mode="challenge" data-expected="36">

```python
import uuid

# TODO: generate a UUID4 string and print its length
```

</div>

---

## 📚 Further Reading

- [httpx — Async HTTP client](https://www.python-httpx.org/)
- [gRPC Python Quick Start](https://grpc.io/docs/languages/python/quickstart/)
- [AWS — Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)

---

!!! success "Lesson 48 complete!"
    You can now call services with httpx, retry with exponential backoff, design an async event bus, evaluate gRPC vs REST, version service contracts, and propagate correlation IDs for distributed tracing.

[⬅️ Previous Lesson](47-microservices-basics.md){ .md-button } [➡️ Next Lesson](49-load-testing-locust.md){ .md-button .md-button--primary }
