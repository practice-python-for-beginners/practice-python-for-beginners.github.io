---
title: "Lesson 93 · API Versioning & Documentation"
description: "Master API versioning strategies — URL path, header, and query-param versioning, managing breaking changes, deprecation headers, and generating OpenAPI changelogs."
---

# Lesson 93 · API Versioning & Documentation

> **Section:** 🏢 Enterprise Architecture &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~75 minutes

---

## 🎯 Learning Objectives

- [ ] Compare URL-path, header, and query-param versioning strategies
- [ ] Distinguish breaking from non-breaking API changes
- [ ] Implement a version router that serves both v1 and v2 handlers
- [ ] Add deprecation headers to warn clients of upcoming changes
- [ ] Write a migration guide and changelog in OpenAPI format
- [ ] Use FastAPI's router prefix feature to manage versioned routes cleanly

---

## 📖 Introduction

APIs evolve. Endpoints change, response schemas are refactored, and fields get renamed. Without a versioning strategy, every change risks breaking your clients. A good API versioning system lets you introduce new behaviour in `v2` while keeping `v1` stable for existing consumers, giving them a migration window instead of a surprise outage.

This lesson covers every major versioning strategy, how to detect and communicate breaking changes, and how to maintain clean documentation as your API grows.

---

## 1. Versioning Strategies Compared

=== "URL Path (/v1/, /v2/)"
    ```python
    from fastapi import FastAPI, APIRouter

    app = FastAPI(title="My API")

    # v1 router — legacy, stable
    v1 = APIRouter(prefix="/v1", tags=["v1"])

    @v1.get("/users")
    async def get_users_v1():
        return [{"id": 1, "name": "Alice"}]   # flat schema

    # v2 router — new format
    v2 = APIRouter(prefix="/v2", tags=["v2"])

    @v2.get("/users")
    async def get_users_v2():
        return {                               # paginated schema
            "data": [{"id": 1, "name": "Alice", "email": "alice@example.com"}],
            "total": 1,
            "page": 1,
        }

    app.include_router(v1)
    app.include_router(v2)
    # GET /v1/users  → old flat list
    # GET /v2/users  → new paginated envelope
    ```

=== "Accept-Version Header"
    ```python
    from fastapi import FastAPI, Request, Header, HTTPException
    from typing import Annotated

    app = FastAPI()

    @app.get("/users")
    async def get_users(
        accept_version: Annotated[str, Header()] = "1"
    ):
        if accept_version == "2":
            return {
                "data": [{"id": 1, "name": "Alice"}],
                "total": 1,
            }
        elif accept_version == "1":
            return [{"id": 1, "name": "Alice"}]
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported version: {accept_version}")
    # Client sends: Accept-Version: 2
    ```

=== "Query Parameter (?version=)"
    ```python
    from fastapi import FastAPI, Query

    app = FastAPI()

    @app.get("/users")
    async def get_users(version: str = Query("1")):
        handlers = {
            "1": lambda: [{"id": 1, "name": "Alice"}],
            "2": lambda: {"data": [{"id": 1, "name": "Alice"}], "total": 1},
        }
        handler = handlers.get(version)
        if not handler:
            from fastapi import HTTPException
            raise HTTPException(400, f"Unknown API version: {version}")
        return handler()
    # GET /users?version=2
    ```

| Strategy | Discoverability | Caching | REST Purity | Best For |
|---|---|---|---|---|
| URL Path `/v2/` | High | Easy | Moderate | Public APIs |
| Header `Accept-Version` | Low | Hard | High | Internal / B2B APIs |
| Query param `?version=2` | Medium | Easy | Low | Simple / legacy APIs |

---

## 2. Breaking vs Non-Breaking Changes

=== "Breaking Changes"
    ```python
    # Changes that BREAK existing clients — require a new major version.

    # v1 response schema
    v1_user = {"id": 1, "name": "Alice Liddell"}

    # v2 response schema — BREAKING: "name" removed, split into first/last
    v2_user = {"id": 1, "first_name": "Alice", "last_name": "Liddell"}

    # Other breaking changes:
    # - Removing a required field
    # - Changing a field's type (string → int)
    # - Changing an endpoint's HTTP method
    # - Changing authentication requirements
    # - Removing an endpoint entirely

    BREAKING_CHANGES = [
        "Removed field: 'name' (replaced by 'first_name' + 'last_name')",
        "Changed type of 'age' from string to integer",
        "Removed endpoint: DELETE /users/bulk",
    ]
    ```

=== "Non-Breaking Changes"
    ```python
    # Changes that are SAFE — existing clients keep working.

    # v1 response schema
    v1_user = {"id": 1, "name": "Alice"}

    # v1.1 response schema — NON-BREAKING: only added optional fields
    v1_1_user = {
        "id": 1,
        "name": "Alice",
        "email": "alice@example.com",   # new optional field ✓
        "created_at": "2024-01-01",     # new optional field ✓
    }

    # Other non-breaking changes:
    # - Adding new optional response fields
    # - Adding new optional request parameters
    # - Adding a new endpoint
    # - Expanding an enum (add new values, don't remove existing)
    ```

!!! warning "Additive vs destructive"
    Adding new optional fields to responses is always safe — clients ignore unknown fields. Removing or renaming any field is always breaking, no matter how minor it seems.

---

## 3. Version Router (Pure Python)

```python
# A pure-Python version router — demonstrates the routing logic clearly.

ROUTES: dict[str, dict[str, callable]] = {
    "v1": {
        "/users": lambda: [{"id": 1, "name": "Alice"}],
        "/posts": lambda: [{"id": 1, "title": "Hello World"}],
    },
    "v2": {
        "/users": lambda: {"data": [{"id": 1, "name": "Alice", "email": "a@b.com"}], "total": 1},
        "/posts": lambda: {"data": [{"id": 1, "title": "Hello World", "author": "Alice"}], "total": 1},
        "/tags":  lambda: {"data": ["python", "fastapi"], "total": 2},  # new in v2
    },
}

def route_request(version: str, path: str):
    """Route a request to the correct version handler."""
    version_routes = ROUTES.get(version)
    if not version_routes:
        raise ValueError(f"Unknown API version: {version}")
    handler = version_routes.get(path)
    if not handler:
        # Fall back to previous version if available
        for v in sorted(ROUTES.keys(), reverse=True):
            if v <= version and path in ROUTES[v]:
                handler = ROUTES[v][path]
                break
    if not handler:
        raise ValueError(f"Route '{path}' not found in {version}")
    return handler.__name__, handler()

handler_name, result = route_request("v2", "/users")
print(f"Handler: {handler_name}")
print(f"Result:  {result}")
```

---

## 4. Deprecation Headers

```python
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import datetime

app = FastAPI()

SUNSET_DATE = "2025-12-31"

@app.get("/v1/users")
async def get_users_v1_deprecated():
    response = JSONResponse(content=[{"id": 1, "name": "Alice"}])
    # Standard deprecation headers
    response.headers["Deprecation"] = "true"
    response.headers["Sunset"]      = SUNSET_DATE
    response.headers["Link"]        = '</v2/users>; rel="successor-version"'
    response.headers["Warning"]     = (
        f'299 - "This endpoint is deprecated and will be removed on {SUNSET_DATE}. '
        f'Please migrate to /v2/users."'
    )
    return response

# After the sunset date, return 410 Gone:
@app.get("/v1/posts")
async def get_posts_v1_sunsetted():
    today = datetime.date.today().isoformat()
    if today > "2025-12-31":
        return JSONResponse(
            status_code=410,
            content={"error": "This API version has been retired. Use /v2/posts."}
        )
    return [{"id": 1, "title": "Legacy post"}]
```

---

## 5. OpenAPI Changelog & Migration Guide

```python
# Embed version metadata directly in your FastAPI app's OpenAPI spec.

from fastapi import FastAPI

app = FastAPI(
    title="My Production API",
    version="2.0.0",
    description="""
## Changelog

### v2.0.0 (2024-06-01) — Breaking Changes
- **BREAKING**: `GET /users` now returns a paginated envelope `{data, total, page}` instead of a flat array.
- **BREAKING**: User `name` field split into `first_name` and `last_name`.
- **NEW**: `GET /tags` endpoint added.
- **NEW**: `email` field added to user response.

### v1.x Migration Guide
Replace `response[i].name` with `response.data[i].first_name + " " + response.data[i].last_name`.
Replace `response` (array) with `response.data` (paginated items).

### v1.0.0 (2023-01-01) — Initial Release
""",
    openapi_tags=[
        {"name": "v1", "description": "⚠️ Deprecated — sunset 2025-12-31"},
        {"name": "v2", "description": "✅ Current stable version"},
    ],
)
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate version routing — given a version string and route registry,
# print which handler is used

ROUTES = {
    "v1": {
        "/users": "get_users_v1",
        "/posts": "get_posts_v1",
    },
    "v2": {
        "/users": "get_users_v2",
        "/posts": "get_posts_v2",
        "/tags":  "get_tags_v2",
    },
}

def route_request(version: str, path: str) -> str:
    """Return the handler name for a given version and path."""
    version_routes = ROUTES.get(version)
    if not version_routes:
        return f"ERROR: unknown version {version}"
    handler = version_routes.get(path)
    if not handler:
        return f"ERROR: {path} not found in {version}"
    return handler

# Test routing
for ver in ["v1", "v2"]:
    for path in ["/users", "/posts", "/tags"]:
        result = route_request(ver, path)
        print(f"{ver} {path:12s} → {result}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Version Route Lookup

Route a request for `v2` of the `/users` endpoint and print the handler name.

Expected output:
```
get_users_v2
```

<div class="pyodide-runner" data-mode="challenge" data-expected="get_users_v2">
<pre><code class="language-python">ROUTES = {
    "v1": {"/users": "get_users_v1", "/posts": "get_posts_v1"},
    "v2": {"/users": "get_users_v2", "/posts": "get_posts_v2"},
}

def route_request(version: str, path: str) -> str:
    return ROUTES.get(version, {}).get(path, "NOT_FOUND")

# Print the handler name for v2 /users
</code></pre>
</div>

---

### Challenge 2 — Detect Breaking Change

Compare v1 and v2 response schemas. If a required field present in v1 is missing from v2, print `"breaking change"`.

Expected output:
```
breaking change
```

<div class="pyodide-runner" data-mode="challenge" data-expected="breaking change">
<pre><code class="language-python">v1_schema = {"id", "name", "email"}          # required fields in v1
v2_schema = {"id", "first_name", "last_name", "email"}  # v2 response fields

# A breaking change occurs when a v1 required field is absent in v2
# "name" was in v1 but is not in v2

# Detect and print "breaking change" if any v1 field is missing from v2
</code></pre>
</div>

---

## 📚 Further Reading

- [REST API Versioning Strategies — Stripe Engineering](https://stripe.com/blog/api-versioning)
- [Sunset HTTP Header (RFC 8594)](https://www.rfc-editor.org/rfc/rfc8594)
- [FastAPI — Bigger Applications with Multiple Files](https://fastapi.tiangolo.com/tutorial/bigger-applications/)

---

[⬅️ Lesson 92 · Role-Based Access Control API](92-rbac-api.md){ .md-button } [➡️ Lesson 94 · Asynchronous Task Queue System](94-async-task-queue.md){ .md-button .md-button--primary }
