---
title: "Lesson 96 · Health Check & Status Endpoints"
description: "Design production-grade /health endpoints — liveness vs readiness probes, dependency checks for DB and Redis, status aggregation, and Kubernetes probe configuration."
---

# Lesson 96 · Health Check & Status Endpoints

> **Section:** 🏢 Enterprise Architecture &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Distinguish liveness, readiness, and startup probes in Kubernetes
- [ ] Design a `/health` endpoint with a consistent JSON schema
- [ ] Implement checks for PostgreSQL, Redis, and third-party service connectivity
- [ ] Aggregate dependency statuses into `healthy`, `degraded`, or `unhealthy`
- [ ] Return appropriate HTTP status codes (200, 503)
- [ ] Configure Kubernetes `livenessProbe` and `readinessProbe` in YAML

---

## 📖 Introduction

A **health check endpoint** is one of the most operationally important parts of your API — yet it's often the last thing developers think about. Load balancers, Kubernetes, and monitoring systems all use `/health` to decide whether to route traffic to your application. A well-designed health endpoint that checks all dependencies can prevent your app from accepting requests it cannot successfully serve.

This lesson covers the Kubernetes probe model, a battle-tested health response schema, and idiomatic Python implementations for checking every common dependency.

---

## 1. Liveness vs Readiness vs Startup Probes

=== "Probe Types Explained"
    ```python
    # Kubernetes has three types of probes:
    #
    # LIVENESS  ─ "Is the process alive? Should I restart it?"
    #   • Returns 200 if the process is running and not deadlocked.
    #   • Should be FAST and LIGHTWEIGHT — never check external deps.
    #   • Failure triggers a container restart.
    #
    # READINESS ─ "Is the app ready to serve traffic?"
    #   • Returns 200 only if ALL dependencies (DB, cache, etc.) are up.
    #   • Failure removes the pod from the Service endpoints (no traffic).
    #   • Does NOT restart the container.
    #
    # STARTUP   ─ "Has the app finished starting up?"
    #   • Used for slow-starting containers.
    #   • Liveness/readiness probes are disabled until startup succeeds.

    PROBE_SUMMARY = {
        "liveness":  {"checks": ["process_alive"], "failure": "restart"},
        "readiness": {"checks": ["db", "redis", "queue"], "failure": "remove_from_lb"},
        "startup":   {"checks": ["migrations_complete"], "failure": "wait"},
    }
    ```

=== "FastAPI Implementation"
    ```python
    from fastapi import FastAPI, Response

    app = FastAPI()

    # ── Liveness — always fast, never checks external deps ────
    @app.get("/health/live", tags=["health"])
    async def liveness():
        return {"status": "alive", "service": "myapp"}

    # ── Readiness — checks all dependencies ───────────────────
    @app.get("/health/ready", tags=["health"])
    async def readiness(response: Response):
        checks = await run_all_checks()
        overall = aggregate_status(checks)
        if overall == "unhealthy":
            response.status_code = 503
        return {
            "status":  overall,
            "checks":  checks,
        }

    # ── Detailed status page (for humans + monitoring) ────────
    @app.get("/health", tags=["health"])
    async def health(response: Response):
        checks = await run_all_checks()
        overall = aggregate_status(checks)
        if overall == "unhealthy":
            response.status_code = 503
        return build_health_response(overall, checks)
    ```

---

## 2. Dependency Checks

=== "PostgreSQL Check"
    ```python
    import time
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError

    async def check_postgres(session) -> dict:
        start = time.monotonic()
        try:
            await session.execute(text("SELECT 1"))
            return {
                "status":      "healthy",
                "latency_ms":  round((time.monotonic() - start) * 1000, 1),
            }
        except OperationalError as e:
            return {
                "status":  "unhealthy",
                "error":   str(e)[:120],
            }
    ```

=== "Redis Check"
    ```python
    import time
    import redis.asyncio as aioredis

    async def check_redis(redis_client) -> dict:
        start = time.monotonic()
        try:
            pong = await redis_client.ping()
            return {
                "status":     "healthy" if pong else "unhealthy",
                "latency_ms": round((time.monotonic() - start) * 1000, 1),
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error":  str(e)[:120],
            }
    ```

=== "External API Check"
    ```python
    import urllib.request
    import time

    def check_external_api(url: str, timeout: float = 3.0) -> dict:
        """Check an external service by hitting its own /health endpoint."""
        start = time.monotonic()
        try:
            with urllib.request.urlopen(url, timeout=timeout) as resp:
                ok = 200 <= resp.status < 300
                return {
                    "status":      "healthy" if ok else "degraded",
                    "http_status": resp.status,
                    "latency_ms":  round((time.monotonic() - start) * 1000, 1),
                }
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)[:120]}
    ```

---

## 3. Status Aggregation

```python
# Status priority: unhealthy > degraded > healthy
STATUS_PRIORITY = {"unhealthy": 2, "degraded": 1, "healthy": 0}

def aggregate_status(checks: dict) -> str:
    """Return the worst status across all checks."""
    if not checks:
        return "healthy"
    worst = max(
        (v.get("status", "healthy") for v in checks.values()),
        key=lambda s: STATUS_PRIORITY.get(s, 0)
    )
    return worst

def build_health_response(overall: str, checks: dict) -> dict:
    """Build a standardised health response body."""
    import time
    return {
        "status":    overall,
        "timestamp": time.time(),
        "version":   "2.0.0",
        "checks":    checks,
        "summary": {
            "total":     len(checks),
            "healthy":   sum(1 for v in checks.values() if v.get("status") == "healthy"),
            "degraded":  sum(1 for v in checks.values() if v.get("status") == "degraded"),
            "unhealthy": sum(1 for v in checks.values() if v.get("status") == "unhealthy"),
        },
    }

# Example
checks = {
    "postgres": {"status": "healthy",   "latency_ms": 4.2},
    "redis":    {"status": "degraded",  "latency_ms": 180.5, "note": "high latency"},
    "s3":       {"status": "healthy",   "latency_ms": 35.0},
}
print("Overall:", aggregate_status(checks))   # degraded
print(build_health_response(aggregate_status(checks), checks))
```

| Overall Status | HTTP Code | Meaning |
|---|---|---|
| `healthy` | 200 | All checks pass — route traffic |
| `degraded` | 200 | Some checks degraded — still serving |
| `unhealthy` | 503 | Critical check failed — stop routing |

---

## 4. Complete Health Endpoint

```python
import asyncio
import time
from fastapi import FastAPI, Response

app = FastAPI()

async def run_all_checks() -> dict:
    """Run all dependency checks concurrently."""
    results = await asyncio.gather(
        check_postgres_mock(),
        check_redis_mock(),
        check_celery_mock(),
        check_storage_mock(),
        return_exceptions=True,
    )
    labels = ["postgres", "redis", "celery", "storage"]
    checks = {}
    for label, result in zip(labels, results):
        if isinstance(result, Exception):
            checks[label] = {"status": "unhealthy", "error": str(result)}
        else:
            checks[label] = result
    return checks

async def check_postgres_mock(): return {"status": "healthy",   "latency_ms": 4}
async def check_redis_mock():    return {"status": "healthy",   "latency_ms": 1}
async def check_celery_mock():   return {"status": "degraded",  "latency_ms": 220}
async def check_storage_mock():  return {"status": "healthy",   "latency_ms": 15}

@app.get("/health")
async def health_check(response: Response):
    start = time.monotonic()
    checks = await run_all_checks()
    overall = aggregate_status(checks)
    if overall == "unhealthy":
        response.status_code = 503
    return {
        **build_health_response(overall, checks),
        "response_time_ms": round((time.monotonic() - start) * 1000, 1),
    }
```

---

## 5. Kubernetes Probe Configuration

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: myapp
          image: myapp:2.0.0
          ports:
            - containerPort: 8000

          # STARTUP — give the app 60s to start before liveness kicks in
          startupProbe:
            httpGet:
              path: /health/live
              port: 8000
            failureThreshold: 12
            periodSeconds: 5

          # LIVENESS — restart if unresponsive
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8000
            initialDelaySeconds: 10
            periodSeconds: 15
            timeoutSeconds: 3
            failureThreshold: 3

          # READINESS — remove from load balancer if deps are down
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 2
```

!!! note "Probe endpoint performance"
    Readiness probes fire every 10 seconds per pod. For a 10-pod deployment, that's 60 requests/minute just from Kubernetes. Keep each check under 100ms and run them concurrently with `asyncio.gather`.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate a health check system — run checks on mock services and aggregate status

import time

def check_service(name: str, healthy: bool, latency_ms: int) -> dict:
    """Simulate a health check returning a status dict."""
    return {
        "status":     "healthy" if healthy else "unhealthy",
        "latency_ms": latency_ms,
    }

STATUS_PRIORITY = {"unhealthy": 2, "degraded": 1, "healthy": 0}

def aggregate_status(checks: dict) -> str:
    return max(
        (v["status"] for v in checks.values()),
        key=lambda s: STATUS_PRIORITY.get(s, 0)
    )

# Simulate 4 checks
checks = {
    "postgres": check_service("postgres", healthy=True,  latency_ms=4),
    "redis":    check_service("redis",    healthy=True,  latency_ms=1),
    "celery":   check_service("celery",   healthy=True,  latency_ms=8),
    "storage":  check_service("storage",  healthy=True,  latency_ms=12),
}

for name, result in checks.items():
    indicator = "✅" if result["status"] == "healthy" else "❌"
    print(f"{indicator} {name:10s} {result['status']:10s} {result['latency_ms']}ms")

print(f"\nOverall status: {aggregate_status(checks)}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Degraded Aggregate

Aggregate 4 service checks where 1 check fails. Print the overall status.

Expected output:
```
degraded
```

<div class="pyodide-runner" data-mode="challenge" data-expected="degraded">
<pre><code class="language-python">STATUS_PRIORITY = {"unhealthy": 2, "degraded": 1, "healthy": 0}

checks = {
    "postgres": {"status": "healthy"},
    "redis":    {"status": "degraded"},   # one check is degraded
    "celery":   {"status": "healthy"},
    "storage":  {"status": "healthy"},
}

def aggregate_status(checks):
    return max(
        (v["status"] for v in checks.values()),
        key=lambda s: STATUS_PRIORITY.get(s, 0)
    )

# Print the overall aggregated status
</code></pre>
</div>

---

### Challenge 2 — Total Check Duration

Compute the total health check response time from 3 check durations `[10, 25, 5]` ms and print the total.

Expected output:
```
40
```

<div class="pyodide-runner" data-mode="challenge" data-expected="40">
<pre><code class="language-python">check_durations = [10, 25, 5]  # milliseconds for each check

# Compute and print the total response time
</code></pre>
</div>

---

## 📚 Further Reading

- [Kubernetes Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Health Check Response Format for HTTP APIs (IETF Draft)](https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check)
- [FastAPI Background Tasks & Lifespan Events](https://fastapi.tiangolo.com/advanced/events/)

---

[⬅️ Lesson 95 · Unified Logging & Tracing](95-logging-tracing.md){ .md-button } [➡️ Lesson 97 · Scalable Clustered API Deployment](97-scalable-deployment.md){ .md-button .md-button--primary }
