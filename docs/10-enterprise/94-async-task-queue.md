---
title: "Lesson 94 · Asynchronous Task Queue System"
description: "Build production-grade async task queues with Celery and Redis — task states, chaining, priority queues, retry strategies, and monitoring with Flower."
---

# Lesson 94 · Asynchronous Task Queue System

> **Section:** 🏢 Enterprise Architecture &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~90 minutes

---

## 🎯 Learning Objectives

- [ ] Identify which workloads belong in a task queue vs direct request handling
- [ ] Understand Celery's architecture — broker, worker, result backend
- [ ] Manage task lifecycle states: PENDING, STARTED, SUCCESS, FAILURE, RETRY
- [ ] Chain, group, and chord tasks for complex pipelines
- [ ] Implement priority queues to process urgent tasks first
- [ ] Monitor task queues with Flower and handle dead-letter tasks

---

## 📖 Introduction

Some work is too slow for a synchronous HTTP request. Sending emails, generating PDFs, processing images, and running ML inference all take too long to make a user wait. The solution is an **asynchronous task queue**: the API accepts the request instantly, enqueues the work, returns a job ID, and a background worker processes the task at its own pace.

**Celery** is Python's most popular task queue library. Combined with **Redis** as both a message broker and result backend, it provides a scalable, reliable system for handling millions of background jobs.

---

## 1. When to Use Task Queues

=== "Good Candidates"
    ```python
    # Workloads that should ALWAYS be offloaded to a task queue:

    ASYNC_CANDIDATES = {
        "email_notifications":  "Sending email via SMTP/SendGrid — 100ms–2s",
        "pdf_generation":       "Rendering invoice/report PDFs — 1–10s",
        "image_processing":     "Resizing/converting uploaded images — 0.5–5s",
        "data_exports":         "Generating CSV/Excel exports — 1–30s",
        "webhook_delivery":     "Delivering webhooks with retry — variable",
        "ml_inference":         "Running model predictions on batches — variable",
        "search_indexing":      "Re-indexing full-text search after writes",
        "third_party_api_calls":"External API calls that may be slow or unreliable",
    }

    for task, reason in ASYNC_CANDIDATES.items():
        print(f"✓ {task}: {reason}")
    ```

=== "Celery Setup"
    ```python
    # requirements.txt
    # celery==5.3.*
    # redis==5.0.*

    # celery_app.py
    from celery import Celery

    app = Celery(
        "myapp",
        broker="redis://localhost:6379/0",
        backend="redis://localhost:6379/1",
    )

    app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        task_acks_late=True,          # re-queue on worker crash
        worker_prefetch_multiplier=1, # one task at a time per worker
    )
    ```

=== "Starting Workers"
    ```bash
    # Start a Celery worker
    celery -A celery_app worker --loglevel=info --concurrency=4

    # Start a dedicated worker for high-priority tasks
    celery -A celery_app worker --queues=urgent --concurrency=2 --loglevel=info

    # Beat scheduler (for periodic tasks)
    celery -A celery_app beat --loglevel=info

    # Monitor with Flower
    pip install flower
    celery -A celery_app flower --port=5555
    # Open http://localhost:5555
    ```

---

## 2. Defining and Calling Tasks

```python
from celery import Celery
from celery.utils.log import get_task_logger

app = Celery("myapp", broker="redis://localhost:6379/0", backend="redis://localhost:6379/1")
logger = get_task_logger(__name__)

# ── Basic task ────────────────────────────────────────────────
@app.task(bind=True, name="send_email")
def send_email(self, to: str, subject: str, body: str):
    logger.info(f"Sending email to {to}")
    # call your SMTP/SendGrid library here
    return {"status": "sent", "to": to}

# ── Task with retry ───────────────────────────────────────────
@app.task(
    bind=True,
    name="call_external_api",
    max_retries=3,
    default_retry_delay=30,  # seconds
)
def call_external_api(self, url: str, payload: dict):
    try:
        import urllib.request, json
        data = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=data, method="POST")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as exc:
        logger.warning(f"API call failed: {exc}. Retrying...")
        raise self.retry(exc=exc)

# ── Dispatching tasks ─────────────────────────────────────────
# Fire-and-forget
send_email.delay("user@example.com", "Welcome!", "Hello there!")

# With explicit queue
send_email.apply_async(
    args=["user@example.com", "Report Ready", "Your report is attached."],
    queue="email",
    countdown=60,   # delay 60 seconds
)

# Retrieve result
result = send_email.apply_async(args=["a@b.com", "Test", "Body"])
print(result.id)      # task UUID
print(result.status)  # PENDING / STARTED / SUCCESS / FAILURE
```

---

## 3. Task States

```python
# Task lifecycle:
#
#   [PENDING] → [STARTED] → [SUCCESS]
#                    ↘ → [FAILURE]
#                    ↘ → [RETRY] → [STARTED] → ...

from celery.result import AsyncResult

def poll_task(task_id: str) -> dict:
    """Poll a task and return its current state."""
    result = AsyncResult(task_id, app=app)
    info = {
        "task_id": task_id,
        "status": result.status,
    }
    if result.status == "SUCCESS":
        info["result"] = result.result
    elif result.status == "FAILURE":
        info["error"] = str(result.result)
        info["traceback"] = result.traceback
    elif result.status == "STARTED":
        info["meta"] = result.info  # custom progress metadata
    return info

# FastAPI endpoint to check task status
from fastapi import FastAPI
api = FastAPI()

@api.get("/tasks/{task_id}")
async def get_task_status(task_id: str):
    return poll_task(task_id)

@api.post("/export")
async def start_export(format: str = "csv"):
    task = generate_export.delay(format=format)
    return {"task_id": task.id, "status_url": f"/tasks/{task.id}"}
```

---

## 4. Task Chaining, Groups, and Chords

=== "chain — sequential pipeline"
    ```python
    from celery import chain

    # Tasks run in sequence: result of each is passed to the next.
    pipeline = chain(
        fetch_data.s(source="postgres"),
        transform_data.s(schema="v2"),
        load_data.s(destination="bigquery"),
    )
    result = pipeline.delay()
    print(result.get())  # result of load_data
    ```

=== "group — parallel fan-out"
    ```python
    from celery import group

    # All tasks run in parallel, results collected in a list.
    job = group(
        send_email.s("alice@example.com", "Hi", "Body"),
        send_email.s("bob@example.com",   "Hi", "Body"),
        send_email.s("carol@example.com", "Hi", "Body"),
    )
    result = job.apply_async()
    results = result.get()  # list of three results
    ```

=== "chord — fan-out + callback"
    ```python
    from celery import chord

    # Run tasks in parallel, then call a callback with all results.
    job = chord(
        [
            process_chunk.s(chunk) for chunk in split_into_chunks(large_dataset)
        ],
        aggregate_results.s()  # called with list of all chunk results
    )
    final_result = job.delay()
    ```

---

## 5. Priority Queues and Monitoring

```python
# Define queues with priorities in celery config
from kombu import Queue, Exchange

app.conf.task_queues = (
    Queue("urgent",  Exchange("urgent"),  routing_key="urgent",  queue_arguments={"x-max-priority": 10}),
    Queue("default", Exchange("default"), routing_key="default", queue_arguments={"x-max-priority": 5}),
    Queue("bulk",    Exchange("bulk"),    routing_key="bulk",    queue_arguments={"x-max-priority": 1}),
)
app.conf.task_default_queue = "default"

# Route tasks to specific queues
app.conf.task_routes = {
    "send_email":        {"queue": "urgent"},
    "generate_report":   {"queue": "bulk"},
    "process_thumbnail": {"queue": "default"},
}

# Send with priority override
send_email.apply_async(args=[...], priority=9)  # 0=low, 9=highest
```

!!! info "Flower — Real-time task monitoring"
    Flower provides a web dashboard at `http://localhost:5555` showing active workers, task throughput, failure rates, and the ability to revoke or retry individual tasks. It's invaluable in production.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Implement a complete task queue system with priority deque (pure stdlib)
from collections import deque
import heapq

class PriorityTaskQueue:
    """Min-heap priority queue — lower number = higher priority."""
    def __init__(self):
        self._heap = []
        self._counter = 0  # tiebreaker for equal priorities

    def enqueue(self, name: str, priority: int):
        heapq.heappush(self._heap, (priority, self._counter, name))
        self._counter += 1

    def dequeue(self):
        if not self._heap:
            return None
        priority, _, name = heapq.heappop(self._heap)
        return name, priority

    def __len__(self):
        return len(self._heap)

# Enqueue tasks
q = PriorityTaskQueue()
tasks = [
    ("send_report",       3),
    ("urgent_alert",      1),
    ("process_thumbnail", 2),
    ("bulk_export",       4),
    ("urgent_email",      1),
]

for name, priority in tasks:
    q.enqueue(name, priority)
    print(f"Enqueued: {name} (priority={priority})")

print(f"\nProcessing {len(q)} tasks in priority order:")
while len(q):
    name, priority = q.dequeue()
    print(f"  → [{priority}] {name}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Priority Queue Processing

Enqueue tasks with priorities `[3, 1, 2, 1]` named `["send_report", "urgent", "process", "urgent2"]`. Process them in priority order and print the name of the **first** task dequeued.

Expected output:
```
urgent
```

<div class="pyodide-runner" data-mode="challenge" data-expected="urgent">
<pre><code class="language-python">import heapq

class PriorityTaskQueue:
    def __init__(self):
        self._heap = []
        self._counter = 0
    def enqueue(self, name, priority):
        heapq.heappush(self._heap, (priority, self._counter, name))
        self._counter += 1
    def dequeue(self):
        priority, _, name = heapq.heappop(self._heap)
        return name, priority

q = PriorityTaskQueue()
tasks = [("send_report", 3), ("urgent", 1), ("process", 2), ("urgent2", 1)]
for name, priority in tasks:
    q.enqueue(name, priority)

# Dequeue and print the FIRST task name processed
</code></pre>
</div>

---

### Challenge 2 — Simulate a Task Chain

Simulate a task pipeline of 3 tasks that run in sequence. Each task receives the result of the previous one. Print `"pipeline complete"` when all three finish.

Expected output:
```
pipeline complete
```

<div class="pyodide-runner" data-mode="challenge" data-expected="pipeline complete">
<pre><code class="language-python">def task_fetch(data=None):
    return {"raw": [1, 2, 3, 4, 5]}

def task_transform(data):
    return {"processed": [x * 2 for x in data["raw"]]}

def task_load(data):
    return {"loaded": len(data["processed"]), "status": "ok"}

# Run the 3 tasks in a chain and print "pipeline complete" when done
</code></pre>
</div>

---

## 📚 Further Reading

- [Celery Documentation — Tasks](https://docs.celeryq.dev/en/stable/userguide/tasks.html)
- [Celery Canvas — Workflows (chain, group, chord)](https://docs.celeryq.dev/en/stable/userguide/canvas.html)
- [Monitoring with Flower](https://flower.readthedocs.io/en/latest/)

---

[⬅️ Lesson 93 · API Versioning & Documentation](93-api-versioning.md){ .md-button } [➡️ Lesson 95 · Unified Logging & Tracing](95-logging-tracing.md){ .md-button .md-button--primary }
