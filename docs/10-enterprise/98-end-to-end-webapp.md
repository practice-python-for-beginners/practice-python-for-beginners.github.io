---
title: "Lesson 98 · End-to-End Web Application"
description: "Build a complete full-stack application — React + FastAPI + PostgreSQL + Redis + Celery, Docker Compose dev environment, CI/CD pipeline, feature flags, and integration testing."
---

# Lesson 98 · End-to-End Web Application

> **Section:** 🏢 Enterprise Architecture &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~90 minutes

---

## 🎯 Learning Objectives

- [ ] Design a full-stack architecture with clear service boundaries
- [ ] Scaffold a production-ready project directory layout
- [ ] Configure a multi-service Docker Compose development environment
- [ ] Manage environment-specific configuration with Pydantic Settings
- [ ] Build a GitHub Actions CI/CD pipeline with lint, test, and deploy stages
- [ ] Implement simple feature flags to roll out features gradually

---

## 📖 Introduction

A production web application is never just a single Python file. It combines a frontend, an API, a database, a cache, a task queue, and CI/CD infrastructure. This lesson ties together everything learned in the course and shows how all the pieces fit together in a single, coherent project.

You'll see the full stack from `docker-compose up` on a developer's laptop to a GitHub Actions pipeline that pushes to production — and how feature flags let you deploy code without releasing features.

---

## 1. Full-Stack Architecture

```
┌────────────────────────────────────────────────────────────┐
│                        INTERNET                            │
└───────────────────────────┬────────────────────────────────┘
                            │ HTTPS
                ┌───────────▼───────────┐
                │   Nginx (port 443)    │  ← TLS termination
                │   Static file cache   │
                └──────┬───────┬────────┘
                       │       │
           ┌───────────▼──┐ ┌──▼────────────────┐
           │  React App   │ │  FastAPI (port 8000)│
           │ (static HTML)│ │  Gunicorn + Uvicorn │
           └──────────────┘ └────┬──────┬─────────┘
                                 │      │
                    ┌────────────▼──┐ ┌─▼───────────────┐
                    │  PostgreSQL   │ │  Redis           │
                    │  (port 5432)  │ │  cache + broker  │
                    └───────────────┘ └──────┬───────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  Celery Worker  │
                                    │  (background    │
                                    │   tasks)        │
                                    └─────────────────┘
```

---

## 2. Project Layout

```
myapp/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              ← FastAPI app factory
│   │   ├── config.py            ← Pydantic Settings
│   │   ├── database.py          ← SQLAlchemy engine + session
│   │   ├── models/              ← SQLAlchemy ORM models
│   │   │   ├── user.py
│   │   │   └── post.py
│   │   ├── schemas/             ← Pydantic request/response schemas
│   │   │   ├── user.py
│   │   │   └── post.py
│   │   ├── routers/             ← FastAPI route handlers
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   └── posts.py
│   │   ├── services/            ← Business logic (no HTTP concerns)
│   │   │   ├── auth_service.py
│   │   │   └── post_service.py
│   │   ├── tasks/               ← Celery tasks
│   │   │   └── email_tasks.py
│   │   └── middleware/
│   │       ├── auth.py
│   │       └── logging.py
│   ├── alembic/                 ← DB migrations
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   └── test_posts.py
│   ├── Dockerfile
│   ├── gunicorn.conf.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/                 ← API client (axios)
│   │   └── components/
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml           ← local dev environment
├── docker-compose.prod.yml      ← production overrides
├── .github/
│   └── workflows/
│       └── ci.yml               ← CI/CD pipeline
└── README.md
```

---

## 3. Docker Compose Dev Environment

```yaml
# docker-compose.yml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB:       myapp_db
      POSTGRES_USER:     myapp
      POSTGRES_PASSWORD: secret
    ports: ["5432:5432"]
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  backend:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql://myapp:secret@postgres/myapp_db
      REDIS_URL:    redis://redis:6379/0
      SECRET_KEY:   dev-secret-key-not-for-production
      DEBUG:        "true"
    volumes:
      - ./backend:/app   # hot-reload in development
    depends_on:
      - postgres
      - redis

  worker:
    build: ./backend
    command: celery -A app.tasks worker --loglevel=info
    environment:
      DATABASE_URL: postgresql://myapp:secret@postgres/myapp_db
      REDIS_URL:    redis://redis:6379/0
    depends_on:
      - redis
      - postgres

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    volumes:
      - ./frontend/src:/app/src  # hot-reload

volumes:
  postgres_data:
```

---

## 4. Configuration with Pydantic Settings

```python
# backend/app/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    # App
    app_name:    str = "MyApp"
    debug:       bool = False
    secret_key:  str
    api_version: str = "v2"

    # Database
    database_url: str
    db_pool_size: int = 10
    db_max_overflow: int = 20

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Feature flags
    feature_new_dashboard: bool = False
    feature_ai_suggestions: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",          # load from .env file
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def db_name(self) -> str:
        """Extract database name from URL."""
        return self.database_url.split("/")[-1]

@lru_cache
def get_settings() -> Settings:
    """Cached settings — reads from environment/file once."""
    return Settings()

# Usage in routes:
# from app.config import get_settings
# settings = get_settings()
# print(settings.db_name)  # "myapp_db"
```

---

## 5. CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
        options: --health-cmd pg_isready
      redis:
        image: redis:7
        ports: ["6379:6379"]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }

      - run: pip install -r backend/requirements.txt

      - name: Lint
        run: |
          ruff check backend/
          mypy backend/app/ --ignore-missing-imports

      - name: Test
        run: pytest backend/tests/ -v --cov=app --cov-report=xml
        env:
          DATABASE_URL: postgresql://test:test@localhost/test_db
          REDIS_URL:    redis://localhost:6379/0
          SECRET_KEY:   test-secret

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build & push Docker image
        run: |
          docker build -t myapp:${{ github.sha }} ./backend
          docker push registry.example.com/myapp:${{ github.sha }}
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/myapp myapp=registry.example.com/myapp:${{ github.sha }}
          kubectl rollout status deployment/myapp
```

!!! tip "Feature flags"
    Use `settings.feature_new_dashboard` checks in your route handlers to conditionally enable unreleased features for specific users or tenants. This lets you merge incomplete features to `main` without exposing them to users, enabling trunk-based development.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate the complete app request lifecycle
# auth check → business logic → cache → DB → response

def middleware_pipeline(layers: list, request: dict) -> dict:
    """Run request through a list of middleware layers."""
    context = dict(request)
    for layer in layers:
        result = layer(context)
        if result.get("error"):
            return result
        context.update(result)
    return {"status": "ok", "data": context}

def auth_layer(ctx):
    if not ctx.get("token"):
        return {"error": "Unauthorized"}
    ctx["user_id"] = "u42"
    print("✓ Auth layer: user authenticated")
    return ctx

def validate_layer(ctx):
    if not ctx.get("payload"):
        return {"error": "Invalid payload"}
    print("✓ Validate layer: payload valid")
    return ctx

def cache_layer(ctx):
    ctx["cache_hit"] = False   # simulate cache miss
    print("✓ Cache layer: cache miss, fetching from DB")
    return ctx

def db_layer(ctx):
    ctx["db_result"] = {"id": 1, "name": "Alice"}
    print("✓ DB layer: fetched from database")
    return ctx

# Simulate a request through all 4 layers
request = {"token": "Bearer abc123", "payload": {"action": "get_user"}}
result = middleware_pipeline([auth_layer, validate_layer, cache_layer, db_layer], request)
print(f"\nFinal response: {result['db_result']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Middleware Pipeline

Simulate a request through 4 middleware layers (auth, validate, cache, db). If all layers pass, print `"all layers passed"`.

Expected output:
```
all layers passed
```

<div class="pyodide-runner" data-mode="challenge" data-expected="all layers passed">
<pre><code class="language-python">def run_layer(name: str, should_pass: bool) -> bool:
    return should_pass

layers = [
    ("auth",     True),
    ("validate", True),
    ("cache",    True),
    ("db",       True),
]

# Run all layers; if all pass, print "all layers passed"
</code></pre>
</div>

---

### Challenge 2 — App Configuration

Generate app configuration from an environment variables dict and print the database name.

Expected output:
```
myapp_db
```

<div class="pyodide-runner" data-mode="challenge" data-expected="myapp_db">
<pre><code class="language-python">env = {
    "DATABASE_URL": "postgresql://user:pass@localhost/myapp_db",
    "REDIS_URL":    "redis://localhost:6379/0",
    "SECRET_KEY":   "super-secret",
    "DEBUG":        "false",
}

# Extract the database name from DATABASE_URL and print it
# The DB name is the last segment after the final "/"
</code></pre>
</div>

---

## 📚 Further Reading

- [FastAPI Full Stack Project Template](https://github.com/tiangolo/full-stack-fastapi-template)
- [Docker Compose for Development — Docker Docs](https://docs.docker.com/compose/use-cases/production/)
- [Pydantic Settings Management](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)

---

[⬅️ Lesson 97 · Scalable Clustered API Deployment](97-scalable-deployment.md){ .md-button } [➡️ Lesson 99 · Realtime Dashboard with FastAPI & Vue](99-realtime-dashboard.md){ .md-button .md-button--primary }
