---
title: "Lesson 50 · API Gateway with FastAPI"
description: "Build a FastAPI API gateway that routes requests to backend microservices, injects correlation IDs, enforces rate limits, and aggregates responses."
---

# Lesson 50 · API Gateway with FastAPI

> **Section:** Security, Webhooks & Microservices &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** 45 min

## 🎯 Learning Objectives

- [ ] Explain what an API gateway does and why you need one
- [ ] Proxy requests to backend services using `httpx` in FastAPI
- [ ] Implement route matching to dispatch requests to the correct service
- [ ] Inject `X-Request-ID` correlation ID headers into every upstream call
- [ ] Build an aggregation endpoint that calls multiple services in parallel
- [ ] Add rate limiting and auth at the gateway layer

## 📖 Introduction

An **API gateway** is the single entry point through which all client requests pass. It handles cross-cutting concerns — routing, authentication, rate limiting, logging, and header injection — so that each backend service doesn't have to implement them independently.

In this lesson you'll build a FastAPI gateway from scratch: a proxy that routes incoming requests to the correct microservice, stamps every call with a correlation ID for tracing, and provides an aggregation endpoint that fans out to multiple services and merges the results.

!!! info "Production gateways"
    Tools like Kong, Traefik, AWS API Gateway, and NGINX Plus are production-grade gateways. Building one in FastAPI is excellent for learning and for internal developer portals, but evaluate dedicated tools before exposing to the internet at scale.

---

## 1. What an API Gateway Does

=== "Responsibilities"
    | Concern | Without gateway | With gateway |
    |---------|----------------|--------------|
    | Authentication | Every service implements its own | Gateway validates, passes identity |
    | Rate limiting | Duplicated logic | Single enforcement point |
    | SSL termination | Each service needs certs | Gateway handles TLS |
    | Routing | Clients know every service URL | Clients talk to one URL |
    | Logging | Fragmented across services | Centralised request log |
    | CORS | Each service configures it | One place |

=== "Request flow"
    ```
    Client
      │  GET /api/orders/123
      ▼
    ┌─────────────────────────────────────────┐
    │           FastAPI Gateway               │
    │  1. Authenticate (validate JWT/API key) │
    │  2. Rate-limit check                    │
    │  3. Inject X-Request-ID header          │
    │  4. Match route → orders-service        │
    │  5. Proxy request                       │
    │  6. Log result                          │
    └─────────────────────────────────────────┘
                        │
              orders-service:8002
    ```

---

## 2. Route Matching & Proxying

=== "Route registry"
    ```python
    # gateway/routes.py
    ROUTES: dict[str, str] = {
        "/api/users":    "http://auth-service:8001",
        "/api/orders":   "http://orders-service:8002",
        "/api/payments": "http://payments-service:8003",
        "/api/products": "http://products-service:8004",
    }

    def resolve_backend(path: str) -> str | None:
        """Return the backend URL for the given path prefix, or None."""
        for prefix, backend in ROUTES.items():
            if path.startswith(prefix):
                return backend + path
        return None
    ```

=== "Proxy handler"
    ```python
    from fastapi import FastAPI, Request, HTTPException
    from fastapi.responses import Response
    import httpx, uuid

    app = FastAPI()
    _client = httpx.AsyncClient(timeout=10.0)

    @app.api_route("/{path:path}", methods=["GET","POST","PUT","PATCH","DELETE"])
    async def proxy(path: str, request: Request):
        full_path = "/" + path
        backend_url = resolve_backend(full_path)
        if not backend_url:
            raise HTTPException(status_code=404, detail="No route found")

        correlation_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

        headers = dict(request.headers)
        headers["X-Request-ID"] = correlation_id
        headers["X-Forwarded-By"] = "fastapi-gateway"

        body = await request.body()
        upstream = await _client.request(
            method=request.method,
            url=backend_url,
            headers=headers,
            content=body,
            params=dict(request.query_params),
        )
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            headers={"X-Request-ID": correlation_id},
            media_type=upstream.headers.get("content-type"),
        )
    ```

=== "Simulated route resolver (stdlib)"
    ```python
    ROUTES = {
        "/api/users":    "users-service",
        "/api/orders":   "orders-service",
        "/api/payments": "payments-service",
    }

    def resolve_service(path: str) -> str:
        for prefix, service in ROUTES.items():
            if path.startswith(prefix):
                return service
        return "not-found"

    print(resolve_service("/api/orders/123"))    # orders-service
    print(resolve_service("/api/payments/pay1")) # payments-service
    ```

---

## 3. Correlation ID Injection

Every request that enters the gateway gets a correlation ID stamped into the headers. Every service it touches logs that ID — allowing you to reconstruct the full journey of any request.

=== "Middleware approach"
    ```python
    import uuid
    from starlette.middleware.base import BaseHTTPMiddleware

    class CorrelationIDMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            # Honour existing ID (from client or another gateway hop)
            cid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
            # Make it available to route handlers
            request.state.correlation_id = cid
            response = await call_next(request)
            response.headers["X-Request-ID"] = cid
            return response

    app.add_middleware(CorrelationIDMiddleware)
    ```

=== "Logging with correlation ID"
    ```python
    import logging

    logger = logging.getLogger("gateway")

    @app.api_route("/{path:path}", methods=["GET","POST","PUT","PATCH","DELETE"])
    async def proxy(path: str, request: Request):
        cid = request.state.correlation_id
        logger.info("Proxying %s %s  cid=%s", request.method, path, cid)
        ...
    ```

=== "Simulated header injection (stdlib)"
    ```python
    import uuid

    def inject_correlation_id(headers: dict) -> dict:
        if "X-Request-ID" not in headers:
            headers["X-Request-ID"] = str(uuid.uuid4())
        return headers

    request_headers = {"Content-Type": "application/json"}
    updated = inject_correlation_id(request_headers)

    key_present = "X-Request-ID" in updated
    print(f"X-Request-ID: {'present' if key_present else 'missing'}")
    ```

---

## 4. Aggregation Endpoint

An aggregation endpoint fans out to several services in parallel and merges their responses — useful for dashboard endpoints that need data from multiple domains.

=== "Parallel fan-out"
    ```python
    import asyncio
    import httpx

    async def aggregate_dashboard(user_id: int, cid: str) -> dict:
        """Fetch user profile, recent orders, and balance concurrently."""
        headers = {"X-Request-ID": cid}
        async with httpx.AsyncClient(timeout=5.0) as client:
            profile_task = client.get(
                f"http://auth-service/users/{user_id}", headers=headers
            )
            orders_task = client.get(
                f"http://orders-service/orders?user_id={user_id}", headers=headers
            )
            balance_task = client.get(
                f"http://payments-service/balance/{user_id}", headers=headers
            )
            profile, orders, balance = await asyncio.gather(
                profile_task, orders_task, balance_task,
                return_exceptions=True,
            )

        return {
            "profile": profile.json() if not isinstance(profile, Exception) else None,
            "orders":  orders.json()  if not isinstance(orders, Exception)  else None,
            "balance": balance.json() if not isinstance(balance, Exception)  else None,
        }
    ```

=== "Graceful partial failure"
    ```python
    # asyncio.gather(return_exceptions=True) means one failed service
    # doesn't kill the whole aggregation — you get partial data instead.

    results = await asyncio.gather(
        fetch_profile(user_id),
        fetch_orders(user_id),
        fetch_balance(user_id),
        return_exceptions=True,
    )

    data = {}
    keys = ["profile", "orders", "balance"]
    for key, result in zip(keys, results):
        data[key] = None if isinstance(result, Exception) else result
    ```

---

## 5. Rate Limiting at the Gateway

=== "Token bucket (in-memory)"
    ```python
    import time
    from collections import defaultdict

    RATE = 100  # requests per minute per client
    buckets: dict[str, list[float]] = defaultdict(list)

    def is_rate_limited(client_ip: str) -> bool:
        now = time.time()
        window = now - 60   # 60-second sliding window
        # Remove timestamps older than the window
        buckets[client_ip] = [t for t in buckets[client_ip] if t > window]
        if len(buckets[client_ip]) >= RATE:
            return True
        buckets[client_ip].append(now)
        return False
    ```

=== "FastAPI dependency"
    ```python
    from fastapi import Request, HTTPException

    async def rate_limit(request: Request):
        ip = request.client.host
        if is_rate_limited(ip):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded",
                headers={"Retry-After": "60"},
            )
    ```

| Header | Meaning |
|--------|---------|
| `X-RateLimit-Limit` | Max requests per window |
| `X-RateLimit-Remaining` | Requests left this window |
| `X-RateLimit-Reset` | Unix timestamp when window resets |
| `Retry-After` | Seconds until next request allowed (429 response) |

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">

```python
import uuid

# Simulate the gateway route resolver and correlation ID injection
ROUTES = {
    "/api/users":    "users-service",
    "/api/orders":   "orders-service",
    "/api/payments": "payments-service",
    "/api/products": "products-service",
}

def resolve_service(path: str) -> str:
    for prefix, service in ROUTES.items():
        if path.startswith(prefix):
            return service
    return "not-found"

def process_request(path: str, headers: dict) -> dict:
    service = resolve_service(path)
    if service == "not-found":
        return {"status": 404, "error": "No route found"}

    # Inject correlation ID
    cid = headers.get("X-Request-ID") or str(uuid.uuid4())
    upstream_headers = {**headers, "X-Request-ID": cid, "X-Forwarded-By": "gateway"}

    return {
        "status": 200,
        "routed_to": service,
        "correlation_id": cid,
        "upstream_headers": upstream_headers,
    }

# Simulate incoming requests
test_paths = [
    ("/api/orders/123",        {}),
    ("/api/users/42",          {"X-Request-ID": "client-provided-id"}),
    ("/api/payments/tx-001",   {}),
    ("/api/unknown/resource",  {}),
]

for path, hdrs in test_paths:
    result = process_request(path, hdrs)
    cid = result.get("correlation_id", "N/A")
    service = result.get("routed_to", "N/A")
    status = result["status"]
    print(f"[{status}] {path:30s} → {service:20s}  cid={cid[:8]}…")
```

</div>

---

## 🏋️ Challenges

**Challenge 1 — Route a path to the correct service**

<div class="pyodide-runner" data-mode="challenge" data-expected="orders-service">

```python
ROUTES = {
    "/api/users":    "users-service",
    "/api/orders":   "orders-service",
    "/api/payments": "payments-service",
}

def resolve_service(path: str) -> str:
    for prefix, service in ROUTES.items():
        if path.startswith(prefix):
            return service
    return "not-found"

# TODO: resolve "/api/orders/123" and print the service name
```

</div>

---

**Challenge 2 — Inject a correlation ID header**

<div class="pyodide-runner" data-mode="challenge" data-expected="X-Request-ID: present">

```python
import uuid

def inject_correlation_id(headers: dict) -> dict:
    # TODO: add "X-Request-ID" to headers if not already present
    #       (use str(uuid.uuid4()) as the value)
    pass

headers = {"Content-Type": "application/json"}
updated = inject_correlation_id(headers)

# print "X-Request-ID: present" if the key exists, else "X-Request-ID: missing"
key_status = "present" if "X-Request-ID" in (updated or {}) else "missing"
print(f"X-Request-ID: {key_status}")
```

</div>

---

## 📚 Further Reading

- [FastAPI — Behind a Proxy](https://fastapi.tiangolo.com/advanced/behind-a-proxy/)
- [httpx — Async HTTP client](https://www.python-httpx.org/)
- [Kong API Gateway — Open Source](https://konghq.com/products/kong-gateway)

---

!!! success "Lesson 50 complete — and Section 5 complete!"
    You've built a FastAPI API gateway that routes requests, injects correlation IDs, aggregates responses from multiple services in parallel, and applies rate limiting. You've completed the entire Security, Webhooks & Microservices section!

[⬅️ Previous Lesson](49-load-testing-locust.md){ .md-button } [➡️ Next Section](../06-frontend/index.md){ .md-button .md-button--primary }
