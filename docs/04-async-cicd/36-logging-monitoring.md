---
title: "Lesson 36 · Logging & Monitoring"
description: "Set up Python's logging module with multiple handlers, structured JSON logging, rotating file logs, request logging middleware for Flask, and health check endpoints."
---

# Lesson 36 · Logging & Monitoring

> **Section:** ⚡ Async, CI/CD, Docker &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Configure Python's `logging` module with levels and handlers
- [ ] Write logs to both the console and a rotating file
- [ ] Format logs with timestamps, levels, and module names
- [ ] Emit structured JSON logs for machine parsing
- [ ] Add request logging middleware to a Flask app
- [ ] Build a `/health` endpoint to verify app status

---

## 📖 Introduction

`print()` is fine for scripts but it fails you in production: no timestamps, no severity levels, no file output, no filtering, and no structured format for log aggregation tools. Python's built-in **`logging`** module solves all of this.

Good logging makes the difference between a mystery outage and a five-minute root cause analysis.

!!! info "The logging hierarchy"
    Python loggers form a tree. A logger named `"myapp.db"` is a child of `"myapp"`, which is a child of the root logger. Log records propagate up the tree unless `propagate=False` is set. This lets you configure one parent logger and have all children inherit its handlers.

---

## 1. Log Levels and Basic Setup

Python defines five standard log levels, in increasing severity:

| Level | Value | When to use |
|-------|-------|-------------|
| `DEBUG` | 10 | Detailed diagnostic info (dev only) |
| `INFO` | 20 | Normal operation events |
| `WARNING` | 30 | Something unexpected but recoverable |
| `ERROR` | 40 | A failure that needs attention |
| `CRITICAL` | 50 | System-level failure, may crash |

=== "Python"
    ```python
    import logging

    # Configure once at app startup
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    logger = logging.getLogger("myapp")

    logger.debug("Loading configuration from .env")
    logger.info("Server started on port 8000")
    logger.warning("Database pool at 90% capacity")
    logger.error("Failed to connect to Redis: Connection refused")
    logger.critical("Out of disk space — shutting down")
    ```
=== "Output"
    ```
    2024-01-15 10:30:00 | DEBUG    | myapp | Loading configuration from .env
    2024-01-15 10:30:00 | INFO     | myapp | Server started on port 8000
    2024-01-15 10:30:00 | WARNING  | myapp | Database pool at 90% capacity
    2024-01-15 10:30:00 | ERROR    | myapp | Failed to connect to Redis: Connection refused
    2024-01-15 10:30:00 | CRITICAL | myapp | Out of disk space — shutting down
    ```

!!! tip "Never use `logging.basicConfig()` in library code"
    `basicConfig()` is for application entry points. Libraries should only add a `NullHandler` to their logger — let the application decide where logs go.

---

## 2. Handlers — Console, File, and Rotating File

Handlers send log records to their destinations. You can attach multiple handlers to a logger.

=== "Python"
    ```python
    import logging
    from logging.handlers import RotatingFileHandler

    logger = logging.getLogger("myapp")
    logger.setLevel(logging.DEBUG)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 1. Console handler — show INFO+ in terminal
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)

    # 2. Rotating file handler — DEBUG+ to file, max 5MB, keep 3 backups
    file_handler = RotatingFileHandler(
        "app.log",
        maxBytes=5 * 1024 * 1024,   # 5 MB
        backupCount=3,
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)

    logger.addHandler(console_handler)
    logger.addHandler(file_handler)

    logger.info("Application started")
    logger.debug("This goes to file only (DEBUG < INFO console threshold)")
    logger.warning("This goes to both console and file")
    ```
=== "Output"
    ```
    # Console (INFO and above):
    2024-01-15 10:30:00 | INFO     | myapp:8 | Application started
    2024-01-15 10:30:00 | WARNING  | myapp:9 | This goes to both console and file

    # app.log (DEBUG and above — includes the DEBUG line)
    ```

---

## 3. Structured JSON Logging

Log aggregators (Datadog, Splunk, ELK) parse structured logs automatically. JSON format makes filtering, searching, and alerting trivial.

=== "Python"
    ```python
    import logging
    import json
    import datetime

    class JSONFormatter(logging.Formatter):
        def format(self, record: logging.LogRecord) -> str:
            log_entry = {
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
                "level": record.levelname,
                "logger": record.name,
                "message": record.getMessage(),
                "module": record.module,
                "line": record.lineno,
            }
            # Attach extra fields if provided
            if hasattr(record, "request_id"):
                log_entry["request_id"] = record.request_id
            if hasattr(record, "user_id"):
                log_entry["user_id"] = record.user_id
            if record.exc_info:
                log_entry["exception"] = self.formatException(record.exc_info)
            return json.dumps(log_entry)

    logger = logging.getLogger("api")
    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

    # Log with extra context
    logger.info("User login", extra={"request_id": "req-123", "user_id": 42})
    ```
=== "Output"
    ```json
    {"timestamp": "2024-01-15T10:30:00Z", "level": "INFO", "logger": "api",
     "message": "User login", "module": "app", "line": 30,
     "request_id": "req-123", "user_id": 42}
    ```

!!! note "python-json-logger library"
    For production, use `python-json-logger` (`pip install python-json-logger`) — it handles edge cases and supports custom fields more robustly than a DIY formatter.

---

## 4. Request Logging Middleware in Flask

Log every incoming request and response automatically:

=== "Python"
    ```python
    import logging
    import time
    import uuid
    from flask import Flask, request, g

    app = Flask(__name__)
    logger = logging.getLogger("api.access")

    @app.before_request
    def before_request():
        g.start_time = time.perf_counter()
        g.request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:8])

    @app.after_request
    def after_request(response):
        elapsed_ms = (time.perf_counter() - g.start_time) * 1000
        logger.info(
            "%s %s %s %.1fms",
            request.method,
            request.path,
            response.status_code,
            elapsed_ms,
            extra={
                "request_id": g.request_id,
                "method": request.method,
                "path": request.path,
                "status": response.status_code,
                "duration_ms": round(elapsed_ms, 1),
            },
        )
        response.headers["X-Request-ID"] = g.request_id
        return response
    ```
=== "Output"
    ```
    GET /api/users 200 12.4ms
    POST /api/login 200 45.2ms
    GET /api/missing 404 2.1ms
    ```

---

## 5. Health Check Endpoints

A `/health` endpoint lets load balancers, Kubernetes, and monitoring tools verify your app is alive and all dependencies are reachable.

=== "Python"
    ```python
    import logging
    from flask import Flask, jsonify
    import time

    app = Flask(__name__)
    logger = logging.getLogger("health")
    start_time = time.time()

    @app.route("/health")
    def health():
        """Basic liveness check."""
        return jsonify({"status": "ok", "uptime": time.time() - start_time}), 200

    @app.route("/health/ready")
    def readiness():
        """Readiness — check all dependencies."""
        checks = {}

        # Check database
        try:
            # db.execute("SELECT 1")  ← real check
            checks["database"] = "ok"
        except Exception as e:
            checks["database"] = f"error: {e}"

        # Check Redis
        try:
            # redis_client.ping()  ← real check
            checks["redis"] = "ok"
        except Exception as e:
            checks["redis"] = f"error: {e}"

        all_ok = all(v == "ok" for v in checks.values())
        status_code = 200 if all_ok else 503

        logger.info("Readiness check: %s", checks)
        return jsonify({"status": "ready" if all_ok else "degraded", "checks": checks}), status_code
    ```
=== "Output"
    ```json
    # GET /health
    {"status": "ok", "uptime": 3600.5}

    # GET /health/ready
    {"status": "ready", "checks": {"database": "ok", "redis": "ok"}}
    ```

---

## 💻 Try It Yourself

Set up the logging module, emit messages at different levels, and capture them with a list handler.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import logging

# Custom handler that stores log records in a list
class ListHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.records = []

    def emit(self, record):
        self.records.append(self.format(record))

# Set up logger
logger = logging.getLogger("demo")
logger.setLevel(logging.DEBUG)

handler = ListHandler()
handler.setFormatter(logging.Formatter("%(levelname)s: %(message)s"))
logger.addHandler(handler)

# Emit messages at all levels
logger.debug("Loading config...")
logger.info("Server started on port 8000")
logger.warning("Memory usage above 80%")
logger.error("Failed to open config file")

# Display captured log messages
print("=== Captured log messages ===")
for record in handler.records:
    print(record)

print(f"\nTotal messages captured: {len(handler.records)}")
warning_plus = sum(1 for r in handler.records if r.startswith(("WARNING", "ERROR", "CRITICAL")))
print(f"WARNING+ messages: {warning_plus}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Log and Capture

Create a logger, log the message `"server started"` at INFO level, capture it, and print the message text only.

Expected output:
```
server started
```

<div class="pyodide-runner" data-mode="challenge" data-expected="server started">
<pre><code class="language-python">import logging

class ListHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.records = []
    def emit(self, record):
        self.records.append(record.getMessage())

logger = logging.getLogger("challenge1")
logger.setLevel(logging.DEBUG)
handler = ListHandler()
logger.addHandler(handler)

logger.info("server started")

print(handler.records[0])
</code></pre>
</div>

---

### Challenge 2 — Count WARNING+ Messages

Given a mock log list, count how many entries are at WARNING level or above.

Expected output:
```
2
```

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">log_entries = [
    {"level": "DEBUG",   "message": "Connecting to DB"},
    {"level": "INFO",    "message": "Server ready"},
    {"level": "WARNING", "message": "High memory usage"},
    {"level": "ERROR",   "message": "DB query timeout"},
    {"level": "DEBUG",   "message": "Cache miss"},
]

HIGH_LEVELS = {"WARNING", "ERROR", "CRITICAL"}
count = sum(1 for entry in log_entries if entry["level"] in HIGH_LEVELS)
print(count)
</code></pre>
</div>

---

## 📚 Further Reading

- [Python `logging` — Official HOWTO](https://docs.python.org/3/howto/logging.html)
- [structlog — Structured Logging for Python](https://www.structlog.org/)
- [12-Factor App — Logs](https://12factor.net/logs)

---

!!! success "Lesson Complete 🎉"
    You can now configure multi-handler loggers, emit structured JSON logs, add request logging
    middleware, and build readiness health checks. Your production app will be fully observable!

[⬅️ Lesson 35 · Rate Limiting API Requests](35-rate-limiting.md){ .md-button }
[➡️ Lesson 37 · Automated Testing with Pytest](37-testing-pytest.md){ .md-button .md-button--primary }
