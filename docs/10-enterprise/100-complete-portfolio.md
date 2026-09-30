---
title: "Lesson 100 · Complete Portfolio API Project"
description: "Capstone project — build a production-ready portfolio API combining JWT auth, RBAC, PostgreSQL, Redis, Celery, logging, Prometheus metrics, Docker, CI/CD, and OpenAPI documentation."
---

# Lesson 100 · Complete Portfolio API Project

> **Section:** 🏢 Enterprise Architecture &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~120 minutes

---

## 🎯 Learning Objectives

- [ ] Assemble all course components into a single coherent portfolio project
- [ ] Design an ASCII architecture diagram and file structure checklist
- [ ] Integrate JWT auth, RBAC, SQLAlchemy, Redis, and Celery in one app
- [ ] Expose Prometheus metrics from FastAPI using `prometheus_fastapi_instrumentator`
- [ ] Containerise the full stack with Docker and automate with GitHub Actions CI/CD
- [ ] Write and run an end-to-end integration test suite against the live app

---

## 📖 Introduction

This is the capstone of the entire 100-lesson journey. You are now going to bring together every major technique learned in this course — authentication, authorisation, databases, caching, background tasks, observability, and deployment — into a single production-grade portfolio project.

A portfolio API is not a toy. It demonstrates to any future employer or collaborator that you can design, build, secure, observe, and ship real Python software. The project is intentionally comprehensive: every component you add is a skill you can point to in an interview.

---

## 1. Architecture Diagram

```
                        ╔══════════════════════════════╗
                        ║   Portfolio API — v2.0.0     ║
                        ╚══════════════╤═══════════════╝
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
    ┌─────────▼──────────┐  ┌──────────▼─────────┐  ┌─────────▼──────────┐
    │   Nginx / Caddy    │  │  FastAPI + Gunicorn │  │   Celery Workers   │
    │   TLS, rate limit  │  │  JWT + RBAC auth    │  │   Email, reports   │
    │   static serving   │  │  REST + OpenAPI     │  │   image processing │
    └────────────────────┘  └──────┬─────┬────────┘  └────────┬───────────┘
                                   │     │                     │
                    ┌──────────────▼──┐  │  ┌─────────────────▼──────────┐
                    │  PostgreSQL 16  │  │  │  Redis 7                   │
                    │  Users, posts   │  │  │  Cache + Celery broker     │
                    │  Alembic mig.   │  │  │  Session store             │
                    └─────────────────┘  │  └────────────────────────────┘
                                         │
               ┌──────────────────────────▼──────────────────────────────┐
               │                  Observability                          │
               │  Prometheus metrics  │  Jaeger tracing  │  Sentry errors│
               └──────────────────────────────────────────────────────────┘
```

---

## 2. Project File Structure

```
portfolio-api/
├── app/
│   ├── __init__.py
│   ├── main.py                  ← FastAPI app factory, lifespan
│   ├── config.py                ← Pydantic Settings (env-driven)
│   ├── database.py              ← SQLAlchemy async engine + session
│   │
│   ├── auth/
│   │   ├── jwt.py               ← Token create/verify
│   │   ├── rbac.py              ← Role/permission definitions
│   │   └── dependencies.py      ← FastAPI Depends guards
│   │
│   ├── models/                  ← SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── post.py
│   │   └── audit_log.py
│   │
│   ├── schemas/                 ← Pydantic v2 request/response models
│   │   ├── user.py
│   │   └── post.py
│   │
│   ├── routers/                 ← Route handlers (thin controllers)
│   │   ├── auth.py              ← POST /auth/login, /auth/refresh
│   │   ├── users.py             ← CRUD /users
│   │   └── posts.py             ← CRUD /posts
│   │
│   ├── services/                ← Business logic (testable, no HTTP)
│   │   ├── user_service.py
│   │   ├── post_service.py
│   │   └── cache_service.py     ← Redis cache helpers
│   │
│   ├── tasks/                   ← Celery tasks
│   │   ├── celery_app.py
│   │   └── email_tasks.py
│   │
│   └── middleware/
│       ├── logging.py           ← Structured JSON + correlation IDs
│       └── metrics.py           ← Prometheus counters + histograms
│
├── alembic/                     ← Database migrations
│   └── versions/
│
├── tests/
│   ├── conftest.py              ← Fixtures: test DB, test client
│   ├── test_auth.py
│   ├── test_users.py
│   ├── test_posts.py
│   └── integration/
│       └── test_full_flow.py    ← End-to-end: register → login → CRUD
│
├── k8s/                         ← Kubernetes manifests
│   ├── deployment.yaml
│   ├── service.yaml
│   └── hpa.yaml
│
├── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
├── gunicorn.conf.py
├── pyproject.toml               ← ruff, mypy, pytest config
└── README.md
```

---

## 3. Core Application Bootstrap

```python
# app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.config import get_settings
from app.database import init_db
from app.middleware.logging import StructuredLoggingMiddleware
from app.routers import auth, users, posts

settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    await init_db()               # run Alembic migrations
    yield
    # cleanup connections here

app = FastAPI(
    title="Portfolio API",
    version="2.0.0",
    description="Production-ready Python API — capstone project.",
    lifespan=lifespan,
)

# ── Middleware (order matters: first added = outermost) ────────
app.add_middleware(StructuredLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Prometheus metrics ─────────────────────────────────────────
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# ── Routers ───────────────────────────────────────────────────
app.include_router(auth.router,  prefix="/auth",  tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(posts.router, prefix="/posts", tags=["posts"])

@app.get("/health/live")
async def liveness():
    return {"status": "alive"}
```

---

## 4. Implementation Checklist

=== "Phase 1 — Core"
    ```python
    PHASE_1 = {
        "environment":    ["Pydantic Settings", ".env file", "per-environment overrides"],
        "database":       ["SQLAlchemy async", "Alembic migrations", "connection pooling"],
        "auth":           ["JWT access + refresh tokens", "bcrypt password hashing"],
        "rbac":           ["admin/editor/viewer roles", "permission decorator"],
        "crud":           ["users CRUD", "posts CRUD", "pagination + filtering"],
        "validation":     ["Pydantic v2 schemas", "custom validators", "error responses"],
    }

    for phase, items in PHASE_1.items():
        print(f"[Phase 1] {phase}:")
        for item in items:
            print(f"  ☐ {item}")
    ```

=== "Phase 2 — Scale"
    ```python
    PHASE_2 = {
        "caching":        ["Redis GET/SET helpers", "cache-aside pattern", "TTL strategy"],
        "tasks":          ["Celery app", "email task", "report generation task"],
        "observability":  ["JSON logging", "correlation IDs", "Prometheus metrics"],
        "tracing":        ["OpenTelemetry setup", "Jaeger exporter", "manual spans"],
    }

    for phase, items in PHASE_2.items():
        print(f"[Phase 2] {phase}:")
        for item in items:
            print(f"  ☐ {item}")
    ```

=== "Phase 3 — Production"
    ```python
    PHASE_3 = {
        "docker":         ["Dockerfile", "docker-compose.yml", "multi-stage build"],
        "kubernetes":     ["Deployment", "Service", "HPA", "liveness/readiness probes"],
        "ci_cd":          ["GitHub Actions lint", "test stage", "build + push", "k8s deploy"],
        "testing":        ["pytest fixtures", "unit tests", "integration tests"],
        "documentation":  ["OpenAPI tags", "response schemas", "README.md"],
    }

    for phase, items in PHASE_3.items():
        print(f"[Phase 3] {phase}:")
        for item in items:
            print(f"  ☐ {item}")
    ```

---

## 5. Integration Test Example

```python
# tests/integration/test_full_flow.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_full_user_flow(client: AsyncClient):
    """End-to-end: register → login → create post → read post → delete."""

    # 1. Register a new user
    resp = await client.post("/users", json={
        "username": "alice", "email": "alice@test.com", "password": "Secret123!"
    })
    assert resp.status_code == 201
    user_id = resp.json()["id"]

    # 2. Login and get JWT
    resp = await client.post("/auth/login", data={
        "username": "alice", "password": "Secret123!"
    })
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create a post
    resp = await client.post("/posts", json={"title": "Hello", "body": "World"}, headers=headers)
    assert resp.status_code == 201
    post_id = resp.json()["id"]

    # 4. Read the post back
    resp = await client.get(f"/posts/{post_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "Hello"

    # 5. Delete the post
    resp = await client.delete(f"/posts/{post_id}", headers=headers)
    assert resp.status_code == 204

    # 6. Confirm deleted
    resp = await client.get(f"/posts/{post_id}", headers=headers)
    assert resp.status_code == 404

    print("Full flow: PASS ✅")
```

!!! tip "Where to host your portfolio"
    Push your portfolio API to GitHub with a live demo on Railway, Render, or Fly.io. Add a badge to your README showing CI passing. This is the most concrete evidence of Python mastery you can show in an interview.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate the complete portfolio system — run through all major components
# and print a system status report

import json
from datetime import datetime, timezone

COMPONENTS = {
    "jwt_auth":    {"status": "ok", "version": "python-jose 3.3"},
    "rbac":        {"status": "ok", "roles": ["admin", "editor", "viewer"]},
    "postgresql":  {"status": "ok", "pool_size": 10, "latency_ms": 4},
    "redis_cache": {"status": "ok", "hit_rate": "87%"},
    "celery":      {"status": "ok", "workers": 4, "queue_depth": 0},
    "prometheus":  {"status": "ok", "endpoint": "/metrics"},
}

def system_status_report(components: dict) -> dict:
    total = len(components)
    healthy = sum(1 for v in components.values() if v["status"] == "ok")
    return {
        "timestamp":  datetime.now(timezone.utc).isoformat(),
        "service":    "Portfolio API",
        "version":    "2.0.0",
        "components": {k: v["status"] for k, v in components.items()},
        "summary": {
            "total":   total,
            "healthy": healthy,
            "score":   f"{(healthy / total * 100):.0f}%",
        }
    }

report = system_status_report(COMPONENTS)
print(json.dumps(report, indent=2))
print(f"\nSystem Health: {report['summary']['score']} ({report['summary']['healthy']}/{report['summary']['total']} components)")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Compute System Health Score

Given a component checks dict with 5 of 6 components passing, compute the health score as a percentage and print it.

Expected output:
```
83%
```

<div class="pyodide-runner" data-mode="challenge" data-expected="83%">
<pre><code class="language-python">component_checks = {
    "database":  True,
    "cache":     True,
    "auth":      True,
    "queue":     True,
    "metrics":   True,
    "tracing":   False,   # this one is failing
}

# Compute health score: passing / total * 100, rounded down
# Print as "XX%"
</code></pre>
</div>

---

### Challenge 2 — Portfolio Component Count

Build a portfolio project summary dict that contains the 6 core system components and print the total component count.

Expected output:
```
6
```

<div class="pyodide-runner" data-mode="challenge" data-expected="6">
<pre><code class="language-python">portfolio = {
    "auth":       "JWT + RBAC",
    "database":   "PostgreSQL + SQLAlchemy",
    "cache":      "Redis",
    "queue":      "Celery",
    "logging":    "Structured JSON + OpenTelemetry",
    "deployment": "Docker + Kubernetes + GitHub Actions",
}

# Print the number of components in the portfolio
</code></pre>
</div>

---

## 📚 Further Reading

- [FastAPI Production Checklist](https://fastapi.tiangolo.com/deployment/concepts/)
- [Prometheus Python Client](https://github.com/prometheus/client_python)
- [Twelve-Factor App Methodology](https://12factor.net/)

---

!!! success "🏁 Congratulations! You've completed all 100 lessons!"
    You have mastered Python from basics to enterprise architecture. You are now equipped to build, deploy, and scale production-grade Python applications. Go build something amazing! 🐍🚀

    [🏠 Back to Home](../../index.md){ .md-button .md-button--primary }
    [📖 Contributing](../../contributing.md){ .md-button }
