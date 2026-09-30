---
title: "Lesson 40 · Deploying Flask/FastAPI on Cloud"
description: "Deploy your Python APIs to production: compare cloud platforms, configure gunicorn workers, manage environment variables, set up health checks, achieve zero-downtime deploys, and monitor uptime."
---

# Lesson 40 · Deploying Flask/FastAPI on Cloud

> **Section:** ⚡ Async, CI/CD, Docker &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Compare cloud deployment options (Render, Railway, Fly.io, Heroku)
- [ ] Write a `Procfile` and configure gunicorn start commands
- [ ] Load environment variables securely in production
- [ ] Calculate the recommended number of gunicorn workers for a server
- [ ] Configure health check endpoints for zero-downtime deploys
- [ ] Monitor uptime with external tools like UptimeRobot

---

## 📖 Introduction

Your Flask or FastAPI app runs perfectly locally — now it's time to make it available to the world. Deploying to the cloud means choosing a platform, configuring a production WSGI/ASGI server, managing secrets, and setting up monitoring.

This lesson walks you through every step, from platform choice to production-grade configuration.

!!! info "WSGI vs ASGI"
    **Flask** uses the **WSGI** standard (synchronous). Production WSGI servers: `gunicorn`, `uWSGI`. **FastAPI** uses **ASGI** (async). Production ASGI servers: `uvicorn`, `hypercorn`. Both can sit behind a reverse proxy like **Nginx** or a cloud load balancer.

---

## 1. Deployment Platform Comparison

| Platform | Free Tier | Docker | Custom Domains | Best For |
|----------|-----------|--------|----------------|---------|
| **Render** | ✅ Generous | ✅ Yes | ✅ Yes | Simplest DX, auto-deploys from GitHub |
| **Railway** | ✅ $5/month credit | ✅ Yes | ✅ Yes | Fast deploys, great for Postgres/Redis |
| **Fly.io** | ✅ Limited | ✅ Yes | ✅ Yes | Global edge, machines near users |
| **Heroku** | ❌ Paid only | ✅ Yes | ✅ Yes | Mature ecosystem, many add-ons |
| **AWS ECS** | ❌ Complex | ✅ Yes | ✅ Yes | Enterprise scale, full control |
| **Google Cloud Run** | ✅ Yes | ✅ Yes | ✅ Yes | Serverless containers, pay-per-request |

=== "Python"
    ```yaml
    # render.yaml — Render Blueprint (Infrastructure-as-Code)

    services:
      - type: web
        name: myflaskapp
        env: python
        region: oregon
        plan: free
        buildCommand: pip install -r requirements.txt
        startCommand: gunicorn --bind 0.0.0.0:$PORT --workers 2 app:app
        envVars:
          - key: FLASK_ENV
            value: production
          - key: DATABASE_URL
            fromDatabase:
              name: mydb
              property: connectionString
          - key: SECRET_KEY
            generateValue: true   # Render generates a random value

    databases:
      - name: mydb
        plan: free
    ```
=== "Output"
    ```
    # render.yaml deploys automatically on git push to main.
    # Render provides:
    # - Automatic HTTPS
    # - Custom domains
    # - Zero-downtime deploys with health checks
    # - Automatic Postgres and Redis add-ons
    ```

!!! tip "Start with Render or Railway"
    Both offer free tiers, automatic GitHub deploys, and one-click Postgres/Redis. They're the fastest path from local to production for indie projects.

---

## 2. `Procfile` and Start Commands

A `Procfile` tells cloud platforms how to start your app. It's a simple text file at the project root:

=== "Python"
    ```
    # Procfile — used by Heroku, Render, Railway, and others

    # Flask with gunicorn
    web: gunicorn --bind 0.0.0.0:$PORT --workers 4 --timeout 120 app:app

    # FastAPI with uvicorn
    web: uvicorn main:app --host 0.0.0.0 --port $PORT --workers 4

    # Worker process (optional — Celery)
    worker: celery -A tasks worker --loglevel=info --concurrency=2
    ```
=== "Output"
    ```
    # Platform reads Procfile and starts:
    # $ gunicorn --bind 0.0.0.0:10000 --workers 4 app:app

    # Logs appear in the platform dashboard:
    # [INFO] Starting gunicorn 21.2.0
    # [INFO] Listening at: http://0.0.0.0:10000
    # [INFO] Booting worker with pid: 42
    # [INFO] Booting worker with pid: 43
    ```

!!! note "PORT environment variable"
    Cloud platforms assign a port dynamically via the `$PORT` (or `%PORT%` on Windows) environment variable. Never hardcode port 5000 — always bind to `0.0.0.0:$PORT`.

---

## 3. Environment Variables and Secret Management

Never commit secrets to git. Use platform dashboards to set environment variables:

=== "Python"
    ```python
    # config.py — load config from environment
    import os
    from dataclasses import dataclass, field

    @dataclass
    class Config:
        # Required — raise immediately if missing
        database_url: str = field(
            default_factory=lambda: os.environ["DATABASE_URL"]
        )
        secret_key: str = field(
            default_factory=lambda: os.environ["SECRET_KEY"]
        )

        # Optional with defaults
        redis_url: str = field(
            default_factory=lambda: os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        )
        debug: bool = field(
            default_factory=lambda: os.environ.get("DEBUG", "false").lower() == "true"
        )
        workers: int = field(
            default_factory=lambda: int(os.environ.get("WEB_CONCURRENCY", "2"))
        )

    # Usage
    config = Config()
    print(f"Connecting to: {config.database_url[:30]}...")
    print(f"Debug mode: {config.debug}")
    print(f"Workers: {config.workers}")
    ```
=== "Output"
    ```
    Connecting to: postgresql://user:***@db.render.com...
    Debug mode: False
    Workers: 4
    ```

!!! warning "Never use `DEBUG=True` in production"
    Flask's debug mode exposes an interactive debugger in the browser. Anyone with network access can execute arbitrary Python code. Always set `FLASK_ENV=production` and `DEBUG=False`.

---

## 4. Gunicorn for Production — Workers and Binding

`gunicorn` is the battle-tested WSGI server for Flask. Choosing the right number of workers is critical:

| Setting | Formula / Rule | Explanation |
|---------|---------------|-------------|
| `--workers` | `2 * CPU_count + 1` | For I/O-bound apps |
| `--threads` | `2–4` per worker | For mixed workloads |
| `--timeout` | `120` | Kill workers that hang |
| `--bind` | `0.0.0.0:$PORT` | Listen on all interfaces |
| `--worker-class` | `sync` / `gevent` / `uvicorn.workers.UvicornWorker` | Sync, async, ASGI |

=== "Python"
    ```python
    # gunicorn.conf.py — configuration file (preferred over CLI flags)
    import os
    import multiprocessing

    # Binding
    host = os.environ.get("HOST", "0.0.0.0")
    port = os.environ.get("PORT", "8000")
    bind = f"{host}:{port}"

    # Workers: 2 × CPUs + 1
    workers = int(os.environ.get("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))

    # Worker class
    worker_class = "sync"   # use "uvicorn.workers.UvicornWorker" for FastAPI

    # Timeouts
    timeout = 120
    graceful_timeout = 30
    keepalive = 5

    # Logging
    accesslog = "-"    # stdout
    errorlog = "-"     # stderr
    loglevel = "info"

    # Start with:
    # $ gunicorn -c gunicorn.conf.py app:app
    print(f"Starting gunicorn: {workers} workers bound to {bind}")
    ```
=== "Output"
    ```
    Starting gunicorn: 5 workers bound to 0.0.0.0:8000
    [INFO] Arbiter booted
    [INFO] Listening at: http://0.0.0.0:8000
    ```

---

## 5. Zero-Downtime Deploys and Uptime Monitoring

Production deployments should be invisible to users — no dropped requests, no downtime.

=== "Python"
    ```python
    # Health check endpoint (Flask example)
    # Cloud platforms poll this before routing traffic to the new version
    from flask import Flask, jsonify
    import time

    app = Flask(__name__)
    start_time = time.time()

    @app.route("/health")
    def health():
        return jsonify({
            "status": "ok",
            "version": "2.1.4",
            "uptime_seconds": round(time.time() - start_time),
        }), 200

    # gunicorn graceful reload — sends SIGHUP to master
    # $ kill -HUP $(cat gunicorn.pid)
    # Workers finish current requests, then restart with new code

    # Zero-downtime deploy checklist:
    # 1. Build new Docker image
    # 2. Run database migrations (backwards-compatible only!)
    # 3. Deploy new containers (platform handles traffic switchover)
    # 4. Health check endpoint returns 200
    # 5. Old containers receive SIGTERM, finish in-flight requests, exit
    ```
=== "Output"
    ```json
    # GET /health
    {
      "status": "ok",
      "version": "2.1.4",
      "uptime_seconds": 86400
    }
    ```

!!! info "UptimeRobot — free external monitoring"
    Configure UptimeRobot (free tier: 50 monitors, 5-minute checks) to hit your `/health` endpoint and alert you via email, Slack, or SMS if it returns anything other than 200.

---

## 💻 Try It Yourself

Simulate loading production environment configuration from a dictionary — mimicking how cloud platforms inject environment variables at container startup.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import os

# Simulate what cloud platforms inject as environment variables
simulated_env = {
    "DATABASE_URL":  "postgresql://app_user:s3cr3t@db.render.com:5432/myappdb",
    "REDIS_URL":     "redis://red-abc123.upstash.io:6379",
    "SECRET_KEY":    "super-secret-key-32chars-minimum",
    "PORT":          "10000",
    "FLASK_ENV":     "production",
    "WEB_CONCURRENCY": "4",
    "DEBUG":         "false",
}

# Override os.environ for this demo
os.environ.update(simulated_env)

# Config loader
def get_config():
    return {
        "database_url": os.environ["DATABASE_URL"],
        "redis_url":    os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
        "secret_key":   os.environ["SECRET_KEY"],
        "port":         int(os.environ.get("PORT", "8000")),
        "env":          os.environ.get("FLASK_ENV", "development"),
        "workers":      int(os.environ.get("WEB_CONCURRENCY", "2")),
        "debug":        os.environ.get("DEBUG", "false").lower() == "true",
    }

config = get_config()

print("=== Production Configuration ===")
# Mask the password in the DB URL
db_safe = config["database_url"].split("@")[1]
print(f"  database:   postgresql://***@{db_safe}")
print(f"  redis:      {config['redis_url'][:30]}...")
print(f"  port:       {config['port']}")
print(f"  workers:    {config['workers']}")
print(f"  env:        {config['env']}")
print(f"  debug:      {config['debug']}")

# Calculate gunicorn workers for a 2-CPU machine
cpus = 2
recommended_workers = 2 * cpus + 1
print(f"\nRecommended workers for {cpus}-CPU machine: {recommended_workers}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Calculate Gunicorn Workers

Compute the recommended number of gunicorn workers for a 2-CPU machine using the formula `2 * CPU_count + 1`. Print the result in the format shown.

Expected output:
```
5 workers
```

<div class="pyodide-runner" data-mode="challenge" data-expected="5 workers">
<pre><code class="language-python">cpu_count = 2
workers = 2 * cpu_count + 1
print(f"{workers} workers")
</code></pre>
</div>

---

### Challenge 2 — Validate DATABASE_URL

Check that a `DATABASE_URL` string starts with `"postgresql://"` and print the boolean result.

Expected output:
```
True
```

<div class="pyodide-runner" data-mode="challenge" data-expected="True">
<pre><code class="language-python">database_url = "postgresql://user:password@db.render.com:5432/myapp"

is_valid = database_url.startswith("postgresql://")
print(is_valid)
</code></pre>
</div>

---

## 📚 Further Reading

- [Render — Deploy a Flask App](https://render.com/docs/deploy-flask)
- [Gunicorn — Configuration Overview](https://docs.gunicorn.org/en/stable/configure.html)
- [The Twelve-Factor App — Config](https://12factor.net/config)

---

!!! success "Lesson Complete — Section 4 Done! 🎉"
    You've completed the entire **Async, CI/CD, Docker & Deployment** section!
    You can now deploy production-grade Python APIs to the cloud with gunicorn, health checks,
    proper secret management, and zero-downtime rolling deploys. You're production-ready!

[⬅️ Lesson 39 · Docker for Python APIs](39-docker-python-apis.md){ .md-button }
[➡️ Section 5 · Security](../05-security/index.md){ .md-button .md-button--primary }
