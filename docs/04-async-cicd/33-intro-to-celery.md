---
title: "Lesson 33 · Introduction to Celery"
description: "Learn how to offload work to distributed Celery workers: define tasks with @celery.task, send them with .delay() and .apply_async(), handle retries, and schedule periodic jobs with Celery Beat."
---

# Lesson 33 · Introduction to Celery

> **Section:** ⚡ Async, CI/CD, Docker &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain what Celery is and why you need a broker
- [ ] Define Celery tasks with the `@celery.task` decorator
- [ ] Send tasks asynchronously with `.delay()` and `.apply_async()`
- [ ] Retrieve task results via `AsyncResult`
- [ ] Configure automatic retries on failure
- [ ] Schedule periodic tasks with Celery Beat

---

## 📖 Introduction

FastAPI's `BackgroundTasks` is great for quick, lightweight post-response work. But what if you need to **process thousands of emails**, **generate PDFs**, or **run nightly reports** — surviving app restarts, distributed across many servers?

That's where **Celery** comes in. Celery is a battle-tested **distributed task queue** that separates your web process from your worker processes, connected through a **message broker** (Redis or RabbitMQ).

!!! info "The Celery Architecture"
    **Producer** (your Flask/FastAPI app) sends a task message → **Broker** (Redis) stores it → **Worker** picks it up and executes it → **Result backend** (Redis/DB) stores the return value.

---

## 1. Core Concepts: Broker, Worker, Task

Before writing code, understand the three key players:

| Component | Role | Common Choice |
|-----------|------|--------------|
| **Broker** | Message queue — stores task messages | Redis, RabbitMQ |
| **Worker** | Process that consumes and executes tasks | `celery -A app worker` |
| **Result Backend** | Stores return values and task state | Redis, PostgreSQL |
| **Beat** | Scheduler that sends periodic tasks | Built into Celery |

=== "Python"
    ```python
    # celery_app.py — create the Celery application
    from celery import Celery

    app = Celery(
        "myproject",
        broker="redis://localhost:6379/0",       # where tasks are queued
        backend="redis://localhost:6379/1",      # where results are stored
    )

    app.conf.update(
        task_serializer="json",
        result_expires=3600,   # results expire after 1 hour
    )
    ```
=== "Output"
    ```
    # Start a worker in your terminal:
    # $ celery -A celery_app worker --loglevel=info
    #
    # [2024-01-15 10:00:00] celery@hostname ready.
    # Listening on queues: celery
    ```

!!! tip "Redis as broker"
    Redis is the most common Celery broker — it's simple to install (`pip install redis`) and fast. For production at scale, RabbitMQ provides more advanced routing features.

---

## 2. Defining Tasks with `@celery.task`

Decorate any function with `@app.task` to make it a Celery task. The function can be called normally *or* sent to a worker.

=== "Python"
    ```python
    from celery_app import app   # your Celery instance

    @app.task
    def send_email(to: str, subject: str, body: str) -> str:
        # This runs inside a Celery worker process
        import smtplib
        # ... send the email
        return f"Email sent to {to}"

    @app.task
    def resize_image(image_path: str, width: int, height: int) -> str:
        # Simulate image processing
        print(f"Resizing {image_path} to {width}x{height}")
        return f"{image_path}_resized.jpg"

    @app.task
    def calculate_report(user_id: int) -> dict:
        # Heavy computation — perfect for a worker
        total_orders = 142   # imagine a real DB query
        revenue = 15800.50
        return {"user_id": user_id, "orders": total_orders, "revenue": revenue}
    ```
=== "Output"
    ```
    # Calling normally (synchronous, for testing):
    result = send_email.run("alice@example.com", "Hello", "Body text")
    print(result)   # Email sent to alice@example.com
    ```

---

## 3. `.delay()` and `.apply_async()` — Sending Tasks

Instead of calling a task function directly, use `.delay()` or `.apply_async()` to send it to the broker.

=== "Python"
    ```python
    # .delay() — shorthand, positional args only
    task = send_email.delay("alice@example.com", "Welcome!", "Hi Alice!")
    print(task.id)     # UUID of the task
    print(task.status) # PENDING → STARTED → SUCCESS / FAILURE

    # .apply_async() — full control
    task = send_email.apply_async(
        args=["bob@example.com"],
        kwargs={"subject": "Reset", "body": "Click here"},
        countdown=300,          # delay execution by 5 minutes
        expires=3600,           # discard if not consumed within 1 hour
        queue="email_queue",    # route to a specific worker queue
        priority=9,             # 0 (low) to 9 (high)
    )
    ```
=== "Output"
    ```
    # task.id  → "b6b1f3e2-84c9-4e12-a8b3-c22d1f7e9a01"
    # task.status → "PENDING"
    # (worker picks it up and sets status to SUCCESS)
    ```

| Method | Syntax | Use when |
|--------|--------|---------|
| `.delay(*args)` | Short form | Simple, no options needed |
| `.apply_async(args, kwargs, ...)` | Full form | Need countdown, priority, ETA, queue |
| `.run(*args)` | Sync, no broker | Local testing only |

---

## 4. Retrieving Results

Use `AsyncResult` to poll or wait for a task's outcome:

=== "Python"
    ```python
    from celery.result import AsyncResult

    # Send a task
    task = calculate_report.delay(user_id=42)

    # Check later (non-blocking)
    result = AsyncResult(task.id)
    print(result.state)    # "PENDING", "STARTED", "SUCCESS", "FAILURE"
    print(result.ready())  # True once finished

    # Block until done (use with caution — ties up your request thread)
    data = result.get(timeout=30)   # raises TimeoutError if > 30s
    print(data)
    # {"user_id": 42, "orders": 142, "revenue": 15800.5}
    ```
=== "Output"
    ```
    PENDING
    False

    # ... worker runs the task ...

    SUCCESS
    True
    {"user_id": 42, "orders": 142, "revenue": 15800.5}
    ```

!!! warning "Don't call `.get()` inside a task"
    Waiting for a task result inside another Celery task can cause **deadlocks** if the worker pool is fully occupied. Use callbacks or `chord`/`chain` primitives instead.

---

## 5. Retries and Periodic Tasks with Celery Beat

Real-world tasks fail — networks go down, APIs rate-limit you. Celery's `self.retry()` handles this gracefully.

=== "Python"
    ```python
    import requests
    from celery_app import app

    @app.task(bind=True, max_retries=3, default_retry_delay=60)
    def fetch_stock_price(self, ticker: str) -> float:
        try:
            resp = requests.get(f"https://api.example.com/stock/{ticker}", timeout=5)
            resp.raise_for_status()
            return resp.json()["price"]
        except requests.RequestException as exc:
            # Retry after 60 seconds, up to 3 times
            raise self.retry(exc=exc)

    # Celery Beat — periodic tasks (celeryconfig.py)
    from celery.schedules import crontab

    app.conf.beat_schedule = {
        "refresh-stock-prices": {
            "task": "tasks.fetch_stock_price",
            "schedule": crontab(minute="*/5"),   # every 5 minutes
            "args": ("AAPL",),
        },
        "daily-report": {
            "task": "tasks.calculate_report",
            "schedule": crontab(hour=6, minute=0),   # 6:00 AM daily
            "args": (1,),
        },
    }
    ```
=== "Output"
    ```
    # Start the beat scheduler:
    # $ celery -A celery_app beat --loglevel=info
    #
    # [2024-01-15 06:00:00] Sending due task daily-report (tasks.calculate_report)
    # [2024-01-15 06:05:00] Sending due task refresh-stock-prices
    ```

---

## 💻 Try It Yourself

Simulate a Celery task queue using Python's `collections.deque` — enqueue tasks, process them like a worker would, and track results.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">from collections import deque

# Simulate the broker queue
broker_queue = deque()
results = {}

def enqueue(task_id, fn, *args):
    """Simulate .delay() — push task onto the broker."""
    broker_queue.append((task_id, fn, args))
    print(f"  [QUEUED] task_id={task_id}: {fn.__name__}{args}")

def run_worker():
    """Simulate a Celery worker consuming the queue."""
    print("\n--- Worker started ---")
    while broker_queue:
        task_id, fn, args = broker_queue.popleft()
        try:
            result = fn(*args)
            results[task_id] = ("SUCCESS", result)
            print(f"  [SUCCESS] {task_id}: {result}")
        except Exception as e:
            results[task_id] = ("FAILURE", str(e))
            print(f"  [FAILURE] {task_id}: {e}")
    print("--- Worker idle ---")

# Define some tasks
def send_email(to, subject):
    return f"Sent '{subject}' to {to}"

def resize_image(path, size):
    return f"Resized {path} to {size}px"

def generate_report(user_id):
    return f"Report for user {user_id}: 142 orders"

# Enqueue tasks (like calling .delay())
enqueue("t001", send_email, "alice@example.com", "Welcome")
enqueue("t002", resize_image, "photo.jpg", 800)
enqueue("t003", generate_report, 42)
enqueue("t004", send_email, "bob@example.com", "Reset Password")

# Run worker
run_worker()

print(f"\nTotal tasks processed: {len(results)}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Process All Tasks

Simulate a task queue with 4 tasks, process all of them, and print the total number processed.

Expected output:
```
4
```

<div class="pyodide-runner" data-mode="challenge" data-expected="4">
<pre><code class="language-python">from collections import deque

queue = deque(["task_send_email", "task_resize_image", "task_report", "task_notify"])
processed = 0

while queue:
    task = queue.popleft()
    processed += 1   # simulate processing

print(processed)
</code></pre>
</div>

---

### Challenge 2 — Simulate Task Retry

Simulate a task that fails twice then succeeds on the third attempt. Print the outcome message.

Expected output:
```
succeeded after 3 attempts
```

<div class="pyodide-runner" data-mode="challenge" data-expected="succeeded after 3 attempts">
<pre><code class="language-python">attempts = 0
max_retries = 3
succeeded = False

for attempt in range(1, max_retries + 1):
    attempts += 1
    if attempt < 3:
        pass  # simulate failure (first 2 attempts)
    else:
        succeeded = True
        break

if succeeded:
    print(f"succeeded after {attempts} attempts")
</code></pre>
</div>

---

## 📚 Further Reading

- [Celery — Official Documentation](https://docs.celeryq.dev/en/stable/)
- [Real Python — Celery & Django: A Practical Guide](https://realpython.com/asynchronous-tasks-with-django-and-celery/)
- [Flower — Real-time Celery Monitoring](https://flower.readthedocs.io/en/latest/)

---

!!! success "Lesson Complete 🎉"
    You now understand Celery's architecture, how to define and send tasks, handle retries,
    and schedule periodic jobs with Celery Beat. Time to make your app lightning fast!

[⬅️ Lesson 32 · FastAPI Background Tasks](32-fastapi-background-tasks.md){ .md-button }
[➡️ Lesson 34 · Caching with Redis](34-caching-redis.md){ .md-button .md-button--primary }
