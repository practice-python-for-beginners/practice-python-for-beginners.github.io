---
title: "Lesson 47 · Microservices Basics in Python"
description: "Understand monolith vs microservices, single responsibility, inter-service communication patterns, API gateways, service discovery, and the real drawbacks of microservices."
---

# Lesson 47 · Microservices Basics in Python

> **Section:** Security, Webhooks & Microservices &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** 45 min

## 🎯 Learning Objectives

- [ ] Compare monolith and microservice architectures and choose between them
- [ ] Apply the single responsibility principle to service boundaries
- [ ] Choose between synchronous HTTP and asynchronous messaging for inter-service communication
- [ ] Understand API gateway and service discovery patterns
- [ ] Simulate a circuit breaker in plain Python
- [ ] List the genuine drawbacks of microservices you must plan for

## 📖 Introduction

A **microservice** is a small, independently deployable service that owns exactly one business capability. Instead of one giant application, you have a constellation of small services that communicate over a network.

Microservices are not a silver bullet. They trade monolith complexity (big codebase) for distributed system complexity (network failures, eventual consistency, operational overhead). This lesson teaches you when microservices are worth it, how the pieces fit together, and the most important pattern for keeping them resilient: the circuit breaker.

!!! warning "Don't start with microservices"
    Build a well-structured monolith first. Split into services only when a specific service needs independent scaling, a different tech stack, or a different release cadence than the rest.

---

## 1. Monolith vs Microservices

=== "Monolith"
    ```python
    # Everything in one Flask/FastAPI app
    # auth.py, orders.py, payments.py all imported together

    from flask import Flask
    from auth import auth_bp
    from orders import orders_bp
    from payments import payments_bp

    app = Flask(__name__)
    app.register_blueprint(auth_bp)
    app.register_blueprint(orders_bp)
    app.register_blueprint(payments_bp)
    ```

=== "Microservices"
    ```
    ┌─────────────────────────────────────────┐
    │              API Gateway :8000          │
    └───┬──────────────┬──────────────────────┘
        │              │
    ┌───▼───┐      ┌───▼────┐      ┌──────────┐
    │ Auth  │      │ Orders │      │ Payments │
    │ :8001 │      │ :8002  │      │ :8003    │
    └───────┘      └───┬────┘      └──────────┘
                       │ async message
                   ┌───▼──────┐
                   │ Inventory│
                   │  :8004   │
                   └──────────┘
    ```

=== "Comparison table"
    | Dimension | Monolith | Microservices |
    |-----------|----------|---------------|
    | Deployment | Deploy whole app | Deploy each service independently |
    | Scaling | Scale whole app | Scale hot services only |
    | Tech stack | One stack | Per-service (polyglot) |
    | Testing | Straightforward | Complex (need mocks / test doubles) |
    | Latency | Function call | Network round-trip |
    | Good for | Early-stage, small team | Large team, varied scaling needs |

---

## 2. Single Responsibility for Services

Each service should own exactly one bounded context. Signs a service is doing too much:

- It imports models from another service's database
- Its name contains "and" ("auth and user management")
- Two different teams argue about who owns a feature in it

=== "Well-scoped service"
    ```python
    # orders-service: ONLY responsible for order lifecycle
    # ✅ Creates, reads, updates, cancels orders
    # ✅ Emits order.* events
    # ❌ Does NOT handle payments (that's payments-service)
    # ❌ Does NOT send emails (that's notifications-service)

    class OrdersService:
        def create_order(self, items, user_id): ...
        def get_order(self, order_id): ...
        def cancel_order(self, order_id): ...
        def list_orders(self, user_id): ...
    ```

=== "Poorly scoped service"
    ```python
    # ❌ Too broad — this is just the monolith with a different name
    class EverythingService:
        def create_order(self): ...
        def send_email(self): ...       # belongs in notifications
        def charge_card(self): ...      # belongs in payments
        def update_inventory(self): ... # belongs in inventory
    ```

---

## 3. Inter-Service Communication

=== "Synchronous HTTP"
    ```python
    # Service A calls Service B and waits for response
    # Good for: queries (need an answer before continuing)
    # Risk: cascading failures if B is slow or down

    import httpx

    async def get_user(user_id: int) -> dict:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"http://auth-service/users/{user_id}")
            resp.raise_for_status()
            return resp.json()
    ```

=== "Asynchronous messaging"
    ```python
    # Service A publishes an event; B consumes it later
    # Good for: commands (fire-and-forget), eventual consistency
    # Benefit: A doesn't wait; B can be temporarily down

    async def on_order_created(order: dict):
        # Publish to message broker; inventory-service will pick it up
        await publish("order.created", order)
        # We return immediately — no waiting for inventory
    ```

=== "When to use each"
    | Use sync HTTP when | Use async messaging when |
    |--------------------|--------------------------|
    | You need the result now | You can tolerate eventual consistency |
    | Real-time user query | Background task / notification |
    | Simple request/response | High-volume event stream |

---

## 4. API Gateway & Service Discovery

=== "API Gateway pattern"
    ```python
    # The gateway is the single entry point for external clients
    # It handles: routing, auth, rate limiting, logging, SSL termination

    ROUTES = {
        "/api/users":    "http://auth-service:8001",
        "/api/orders":   "http://orders-service:8002",
        "/api/payments": "http://payments-service:8003",
    }

    async def gateway_handler(path: str, request):
        for prefix, backend in ROUTES.items():
            if path.startswith(prefix):
                return await forward(backend + path, request)
        return 404
    ```

=== "Service discovery"
    ```python
    # Services register themselves; consumers look them up
    # Consul, Kubernetes DNS, AWS Cloud Map

    # Kubernetes DNS: each service gets a DNS name automatically
    # orders-service.production.svc.cluster.local

    # Environment-variable injection (simple, no registry needed)
    import os
    AUTH_URL   = os.getenv("AUTH_SERVICE_URL",   "http://auth:8001")
    ORDERS_URL = os.getenv("ORDERS_SERVICE_URL", "http://orders:8002")
    ```

---

## 5. Circuit Breaker Pattern

When a downstream service is failing, a circuit breaker stops sending it requests and returns fast errors instead — preventing cascading failures.

=== "States"
    ```
    CLOSED  → requests flow normally
       ↓ (N failures in window)
    OPEN    → fail fast — no requests sent
       ↓ (after timeout)
    HALF-OPEN → try one request
       ↓ success          ↓ failure
    CLOSED               OPEN
    ```

=== "Python implementation"
    ```python
    class CircuitBreaker:
        def __init__(self, threshold: int = 3, timeout: float = 30):
            self.threshold = threshold
            self.timeout = timeout
            self.failures = 0
            self.state = "CLOSED"
            self._opened_at = 0

        def call(self, fn, *args, **kwargs):
            import time
            if self.state == "OPEN":
                if time.time() - self._opened_at > self.timeout:
                    self.state = "HALF-OPEN"
                else:
                    raise Exception("circuit open")
            try:
                result = fn(*args, **kwargs)
                self.failures = 0
                self.state = "CLOSED"
                return result
            except Exception:
                self.failures += 1
                if self.failures >= self.threshold:
                    self.state = "OPEN"
                    self._opened_at = __import__("time").time()
                raise
    ```

=== "Simulated usage"
    ```python
    cb = CircuitBreaker(threshold=3)

    def flaky_service():
        raise ConnectionError("service unavailable")

    for i in range(5):
        try:
            cb.call(flaky_service)
        except Exception as e:
            print(f"Attempt {i+1}: {e}")
    # Attempt 4+: circuit open (fast fail)
    ```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">

```python
# Simulate two microservices communicating via a mock message bus
message_bus = []

class AuthService:
    def validate_token(self, token: str) -> dict | None:
        if token == "valid-token":
            return {"user_id": 42, "role": "customer"}
        return None

class OrderService:
    def create_order(self, user: dict, items: list) -> dict:
        order = {"order_id": 1001, "user_id": user["user_id"], "items": items}
        message_bus.append({"event": "order.created", "data": order})
        return order

class InventoryService:
    def on_order_created(self, order: dict):
        reserved = [item["sku"] for item in order["items"]]
        print(f"Inventory reserved: {reserved}")

# Wire up services
auth    = AuthService()
orders  = OrderService()
inventory = InventoryService()

# Simulate a request flowing through services
token = "valid-token"
user = auth.validate_token(token)

if user:
    order = orders.create_order(user, [{"sku": "WIDGET-A", "qty": 2}])
    print(f"Order created: #{order['order_id']} for user {order['user_id']}")

# Process bus events
for msg in message_bus:
    if msg["event"] == "order.created":
        inventory.on_order_created(msg["data"])

print(f"\nBus events: {[m['event'] for m in message_bus]}")
```

</div>

---

## 🏋️ Challenges

**Challenge 1 — Route through 3 services**

<div class="pyodide-runner" data-mode="challenge" data-expected="processed by: auth, order, payment">

```python
pipeline = ["auth", "order", "payment"]

# TODO: simulate passing a request through each service in pipeline
# and print "processed by: auth, order, payment"
```

</div>

---

**Challenge 2 — Circuit breaker opens after 3 failures**

<div class="pyodide-runner" data-mode="challenge" data-expected="circuit open">

```python
class CircuitBreaker:
    def __init__(self, threshold=3):
        self.threshold = threshold
        self.failures = 0
        self.state = "CLOSED"

    def call(self, fn):
        if self.state == "OPEN":
            raise Exception("circuit open")
        try:
            return fn()
        except Exception as e:
            self.failures += 1
            if self.failures >= self.threshold:
                self.state = "OPEN"
            raise

def always_fails():
    raise ConnectionError("down")

cb = CircuitBreaker(threshold=3)

# TODO: call cb.call(always_fails) in a loop until the circuit opens,
# then print the exception message "circuit open"
```

</div>

---

## 📚 Further Reading

- [Martin Fowler — Microservices](https://martinfowler.com/articles/microservices.html)
- [Martin Fowler — Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Sam Newman — Building Microservices (book overview)](https://samnewman.io/books/building_microservices/)

---

!!! success "Lesson 47 complete!"
    You can now assess when microservices are appropriate, design services with single responsibility, choose between sync and async communication, implement an API gateway, and protect downstream calls with a circuit breaker.

[⬅️ Previous Lesson](46-redis-pubsub.md){ .md-button } [➡️ Next Lesson](48-inter-service-comm.md){ .md-button .md-button--primary }
