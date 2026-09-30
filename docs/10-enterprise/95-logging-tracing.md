---
title: "Lesson 95 · Unified Logging & Tracing"
description: "Implement structured JSON logging, correlation IDs, and distributed tracing with OpenTelemetry — integrate with Jaeger, ELK stack, and Sentry for full observability."
---

# Lesson 95 · Unified Logging & Tracing

> **Section:** 🏢 Enterprise Architecture &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~90 minutes

---

## 🎯 Learning Objectives

- [ ] Emit structured JSON logs instead of plain-text log lines
- [ ] Generate and propagate correlation IDs across service boundaries
- [ ] Understand OpenTelemetry's spans-and-traces model
- [ ] Instrument a FastAPI app with automatic tracing
- [ ] Aggregate logs with the ELK stack (Elasticsearch + Logstash + Kibana)
- [ ] Capture and alert on exceptions with Sentry

---

## 📖 Introduction

When something goes wrong in production, you have minutes — not hours — to diagnose the cause. Plain-text logs are unqueryable at scale. A request that touches 5 microservices leaves fragments scattered across 5 log streams. **Structured logging** makes every log event a machine-readable JSON record. **Distributed tracing** stitches those fragments back together into a single end-to-end trace.

This lesson builds a complete observability stack: JSON logs → correlation IDs → OpenTelemetry traces → Jaeger UI.

---

## 1. Structured JSON Logging

=== "Basic Setup"
    ```python
    import logging
    import json
    import sys
    from datetime import datetime, timezone

    class JSONFormatter(logging.Formatter):
        """Format log records as single-line JSON objects."""

        def format(self, record: logging.LogRecord) -> str:
            log_entry = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level":     record.levelname,
                "logger":    record.name,
                "message":   record.getMessage(),
                "module":    record.module,
                "line":      record.lineno,
            }
            # Include exception info if present
            if record.exc_info:
                log_entry["exception"] = self.formatException(record.exc_info)
            # Include any extra fields
            for key, value in record.__dict__.items():
                if key not in logging.LogRecord.__dict__ and not key.startswith("_"):
                    log_entry[key] = value
            return json.dumps(log_entry)

    def get_logger(name: str) -> logging.Logger:
        logger = logging.getLogger(name)
        logger.setLevel(logging.DEBUG)
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)
        return logger

    log = get_logger("myapp")
    log.info("Server started", extra={"port": 8000, "workers": 4})
    log.warning("High memory usage", extra={"used_mb": 1800, "limit_mb": 2048})
    ```

=== "structlog (recommended)"
    ```python
    # pip install structlog
    import structlog

    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.BoundLogger,
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
    )

    log = structlog.get_logger()
    log.info("user_login", user_id="u42", ip="1.2.3.4")
    log.error("db_query_failed", query="SELECT *", error="timeout", duration_ms=5001)
    ```

---

## 2. Correlation IDs

```python
import uuid
import logging
from contextvars import ContextVar

# Per-request context variable — thread-safe and async-safe
_correlation_id: ContextVar[str] = ContextVar("correlation_id", default="")

def get_correlation_id() -> str:
    return _correlation_id.get()

def set_correlation_id(cid: str = None) -> str:
    cid = cid or str(uuid.uuid4())
    _correlation_id.set(cid)
    return cid

# ── FastAPI middleware ─────────────────────────────────────────
from fastapi import Request, Response
from fastapi.middleware.base import BaseHTTPMiddleware

class CorrelationIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Accept from upstream (e.g. load balancer) or generate new
        cid = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        set_correlation_id(cid)
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = cid  # echo back
        return response

# ── Logger that auto-injects correlation ID ───────────────────
class CorrelatingLogger:
    def __init__(self, name: str):
        self._log = logging.getLogger(name)

    def _emit(self, level: str, message: str, **kwargs):
        record = {
            "level":          level,
            "message":        message,
            "correlation_id": get_correlation_id(),
            **kwargs,
        }
        import json
        print(json.dumps(record))

    def info(self, msg, **kw):  self._emit("INFO",  msg, **kw)
    def error(self, msg, **kw): self._emit("ERROR", msg, **kw)
    def warn(self, msg, **kw):  self._emit("WARN",  msg, **kw)

log = CorrelatingLogger("myapp")
set_correlation_id("req-abc-123")
log.info("Processing payment", user_id="u42", amount=99.99)
log.error("Payment gateway timeout", gateway="stripe", timeout_ms=5000)
```

---

## 3. OpenTelemetry — Spans and Traces

=== "Concepts"
    ```python
    # A TRACE is the complete journey of a single request through your system.
    # A SPAN is one unit of work within that trace (one DB query, one HTTP call).
    #
    # Spans form a tree:
    #
    # [Trace: req-abc-123]
    #   ├── [Span: FastAPI request handler]     0–120ms
    #   │     ├── [Span: auth middleware]        0–5ms
    #   │     ├── [Span: db.query users]        10–55ms
    #   │     └── [Span: redis.get cache]       60–65ms
    #   └── [Span: Celery task: send_email]   150–950ms

    # Key attributes on a span:
    SPAN_ATTRIBUTES = {
        "http.method":      "GET",
        "http.url":         "https://api.example.com/users",
        "http.status_code": 200,
        "db.system":        "postgresql",
        "db.statement":     "SELECT * FROM users WHERE id = $1",
        "net.peer.name":    "db.internal",
    }
    ```

=== "Instrumentation"
    ```python
    # pip install opentelemetry-api opentelemetry-sdk
    # pip install opentelemetry-instrumentation-fastapi
    # pip install opentelemetry-exporter-jaeger

    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.exporter.jaeger.thrift import JaegerExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

    # Configure Jaeger exporter
    jaeger_exporter = JaegerExporter(
        agent_host_name="localhost",
        agent_port=6831,
    )

    provider = TracerProvider()
    provider.add_span_processor(BatchSpanProcessor(jaeger_exporter))
    trace.set_tracer_provider(provider)

    tracer = trace.get_tracer("myapp")

    # Auto-instrument FastAPI
    from fastapi import FastAPI
    app = FastAPI()
    FastAPIInstrumentor.instrument_app(app)

    # Manual spans for custom operations
    @app.get("/users/{user_id}")
    async def get_user(user_id: str):
        with tracer.start_as_current_span("db.fetch_user") as span:
            span.set_attribute("db.system", "postgresql")
            span.set_attribute("user.id", user_id)
            user = await fetch_user_from_db(user_id)
            return user
    ```

---

## 4. Log Aggregation — ELK Stack

```yaml
# docker-compose.yml — ELK stack for local development
version: "3.8"
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.12.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports: ["9200:9200"]

  logstash:
    image: docker.elastic.co/logstash/logstash:8.12.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    ports: ["5044:5044"]

  kibana:
    image: docker.elastic.co/kibana/kibana:8.12.0
    ports: ["5601:5601"]
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
```

```python
# Ship Python logs to Logstash via TCP (JSON over socket)
import logging
import logstash  # pip install python-logstash

logger = logging.getLogger("myapp")
logger.addHandler(logstash.TCPLogstashHandler("localhost", 5044, version=1))
logger.setLevel(logging.INFO)

logger.info("Request processed", extra={
    "user_id": "u42",
    "duration_ms": 45,
    "endpoint": "/api/users",
})
```

---

## 5. Error Tracking with Sentry

```python
# pip install sentry-sdk[fastapi]
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

sentry_sdk.init(
    dsn="https://<key>@sentry.io/<project>",
    integrations=[
        FastApiIntegration(transaction_style="endpoint"),
        SqlalchemyIntegration(),
        CeleryIntegration(),
    ],
    traces_sample_rate=0.2,   # 20% of requests traced
    profiles_sample_rate=0.1, # 10% profiled
    environment="production",
    release="myapp@2.0.0",
)

# Sentry captures unhandled exceptions automatically.
# Manually capture handled exceptions with context:
try:
    result = dangerous_operation()
except ValueError as e:
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("operation", "dangerous_operation")
        scope.set_user({"id": "u42", "email": "user@example.com"})
        sentry_sdk.capture_exception(e)
```

!!! tip "Sentry performance monitoring"
    Set `traces_sample_rate` to 0.05–0.2 in production to avoid billing surprises. For critical paths, force sampling with `sentry_sdk.start_transaction(sampled=True)`.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Implement structured JSON logging with correlation IDs
import json
import uuid
from datetime import datetime, timezone

class StructuredLogger:
    def __init__(self, service: str):
        self.service = service
        self._correlation_id = None

    def set_correlation_id(self, cid: str = None):
        self._correlation_id = cid or str(uuid.uuid4())

    def _log(self, level: str, message: str, **fields):
        entry = {
            "timestamp":      datetime.now(timezone.utc).isoformat(),
            "level":          level,
            "service":        self.service,
            "message":        message,
            "correlation_id": self._correlation_id,
            **fields,
        }
        print(json.dumps(entry))

    def info(self, msg, **kw):  self._log("INFO",  msg, **kw)
    def warn(self, msg, **kw):  self._log("WARN",  msg, **kw)
    def error(self, msg, **kw): self._log("ERROR", msg, **kw)

log = StructuredLogger("payment-service")
log.set_correlation_id("req-abc-123")

log.info("Payment request received", user_id="u42", amount=99.99, currency="USD")
log.info("Card tokenised", token="tok_****1234")
log.warn("High latency detected", gateway="stripe", latency_ms=1800)
log.error("Payment failed", reason="insufficient_funds", attempts=1)
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Create a Structured Log Entry

Create a log entry dict with `timestamp`, `level`, `message`, and `correlation_id`, then print just the `level` value.

Expected output:
```
ERROR
```

<div class="pyodide-runner" data-mode="challenge" data-expected="ERROR">
<pre><code class="language-python">from datetime import datetime, timezone

# Create a log entry dict with these keys:
# timestamp, level="ERROR", message="Database connection failed", correlation_id="abc-123"
# Then print the level value only
</code></pre>
</div>

---

### Challenge 2 — Compute Trace Duration

Given a trace with 3 spans of durations `[10, 25, 5]` milliseconds, compute the total duration and print it in the format `"40ms"`.

Expected output:
```
40ms
```

<div class="pyodide-runner" data-mode="challenge" data-expected="40ms">
<pre><code class="language-python">spans = [
    {"name": "auth_check",  "duration_ms": 10},
    {"name": "db_query",    "duration_ms": 25},
    {"name": "redis_cache", "duration_ms": 5},
]

# Compute total duration and print in format "Xms"
</code></pre>
</div>

---

## 📚 Further Reading

- [OpenTelemetry Python Documentation](https://opentelemetry-python.readthedocs.io/en/latest/)
- [structlog — Structured Logging for Python](https://www.structlog.org/en/stable/)
- [Sentry SDK for Python](https://docs.sentry.io/platforms/python/)

---

[⬅️ Lesson 94 · Asynchronous Task Queue System](94-async-task-queue.md){ .md-button } [➡️ Lesson 96 · Health Check & Status Endpoints](96-health-check-endpoints.md){ .md-button .md-button--primary }
