---
title: "Lesson 32 · FastAPI Background Tasks"
description: "Learn how to use FastAPI's BackgroundTasks to run work after returning a response, understand the difference between background tasks and async tasks, and know when to reach for Celery."
---

# Lesson 32 · FastAPI Background Tasks

> **Section:** ⚡ Async, CI/CD, Docker &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain what a background task is and why it's useful
- [ ] Add background tasks with `BackgroundTasks.add_task()`
- [ ] Pass arguments to a background task function
- [ ] Distinguish between FastAPI background tasks, async tasks, and Celery workers
- [ ] Identify realistic use cases: email, audit logging, cleanup jobs
- [ ] Know the limitations of FastAPI background tasks

---

## 📖 Introduction

A common web-app pattern is: **respond immediately, then do more work**. When a user signs up, you want to return `201 Created` right away — and *then* send a welcome email. Making the user wait for the email delivery would feel slow and fragile.

FastAPI's `BackgroundTasks` solves this elegantly: tasks run **after** the HTTP response has been sent, in the same process, without a separate queue.

!!! info "What are Background Tasks good for?"
    Background tasks are ideal for *fast, ancillary* work: sending emails, writing audit logs, updating a cache, firing a webhook. For long-running or distributed work (image processing, PDF generation), use **Celery** instead.

---

## 1. `BackgroundTasks` — The Basics

FastAPI injects a `BackgroundTasks` object into your route. Call `add_task(fn, *args, **kwargs)` to register work. FastAPI runs the tasks once the response is sent.

=== "Python"
    ```python
    from fastapi import FastAPI, BackgroundTasks

    app = FastAPI()

    def send_welcome_email(email: str) -> None:
        # Runs AFTER the response is returned to the client
        print(f"Sending welcome email to {email}...")
        # smtplib.sendmail(...)  ← real implementation here

    @app.post("/register")
    async def register_user(
        email: str,
        background_tasks: BackgroundTasks,
    ):
        # 1. Do fast, critical work (save to DB)
        print(f"User {email} saved to database.")

        # 2. Schedule non-critical work to run after response
        background_tasks.add_task(send_welcome_email, email)

        # 3. Respond immediately
        return {"message": "Registered! Check your inbox."}
    ```
=== "Output"
    ```
    # On POST /register?email=alice@example.com
    # Response returned instantly:
    {"message": "Registered! Check your inbox."}

    # Then, after response:
    User alice@example.com saved to database.
    Sending welcome email to alice@example.com...
    ```

!!! tip "Dependency injection"
    FastAPI automatically provides `BackgroundTasks` — just declare it as a parameter in your route function. No import of a global queue needed.

---

## 2. Adding Multiple Tasks

You can call `add_task()` multiple times. Tasks run sequentially, in the order they were added.

=== "Python"
    ```python
    from fastapi import FastAPI, BackgroundTasks
    import datetime

    app = FastAPI()

    def write_audit_log(user_id: int, action: str) -> None:
        timestamp = datetime.datetime.utcnow().isoformat()
        print(f"[AUDIT] {timestamp} | user={user_id} action={action}")

    def update_user_stats(user_id: int) -> None:
        print(f"[STATS] Recalculating stats for user {user_id}")

    def invalidate_cache(key: str) -> None:
        print(f"[CACHE] Invalidating key: {key}")

    @app.put("/users/{user_id}")
    async def update_user(user_id: int, background_tasks: BackgroundTasks):
        # Main work: update DB record (not shown)

        # Schedule multiple background tasks
        background_tasks.add_task(write_audit_log, user_id, "profile_updated")
        background_tasks.add_task(update_user_stats, user_id)
        background_tasks.add_task(invalidate_cache, f"user:{user_id}")

        return {"message": "User updated."}
    ```
=== "Output"
    ```
    # After response is sent:
    [AUDIT] 2024-01-15T10:30:00 | user=42 action=profile_updated
    [STATS] Recalculating stats for user 42
    [CACHE] Invalidating key: user:42
    ```

!!! note "Tasks run in the same process"
    Background tasks share memory with the main app. This is great for simplicity but means if your app crashes, queued tasks are lost. For durability, use Celery with a persistent broker.

---

## 3. Async vs Sync Background Task Functions

FastAPI handles both `async def` and regular `def` task functions correctly:

| Function type | FastAPI behaviour |
|--------------|------------------|
| `async def task()` | Awaited in the event loop |
| `def task()` | Run in a threadpool (via `run_in_executor`) |

=== "Python"
    ```python
    import asyncio
    from fastapi import FastAPI, BackgroundTasks

    app = FastAPI()

    # Sync task — FastAPI runs it in a thread pool
    def sync_log(message: str) -> None:
        print(f"[SYNC LOG] {message}")

    # Async task — FastAPI awaits it in the event loop
    async def async_notify(user_id: int) -> None:
        await asyncio.sleep(0.01)   # simulate async I/O
        print(f"[ASYNC NOTIFY] User {user_id} notified")

    @app.post("/action")
    async def do_action(background_tasks: BackgroundTasks):
        background_tasks.add_task(sync_log, "action performed")
        background_tasks.add_task(async_notify, 99)
        return {"ok": True}
    ```
=== "Output"
    ```
    [SYNC LOG] action performed
    [ASYNC NOTIFY] User 99 notified
    ```

---

## 4. Background Tasks vs Async Tasks vs Celery

Understanding the hierarchy helps you choose the right tool:

| Tool | Where it runs | Survives crash? | Distributed? | Best for |
|------|--------------|-----------------|-------------|---------|
| `BackgroundTasks` | Same process, after response | ❌ No | ❌ No | Emails, logs, quick jobs |
| `asyncio.create_task()` | Same event loop | ❌ No | ❌ No | In-flight concurrent I/O |
| **Celery** | Separate worker process | ✅ Yes (broker) | ✅ Yes | Long jobs, retries, schedules |

=== "Python"
    ```python
    # When to use each:

    # 1. BackgroundTasks — simple post-response work
    @app.post("/upload")
    async def upload(bg: BackgroundTasks):
        bg.add_task(notify_user, "Upload complete!")
        return {"status": "uploaded"}

    # 2. asyncio.create_task() — concurrent I/O within a request
    @app.get("/dashboard")
    async def dashboard():
        users_task = asyncio.create_task(fetch_users())
        stats_task = asyncio.create_task(fetch_stats())
        users, stats = await asyncio.gather(users_task, stats_task)
        return {"users": users, "stats": stats}

    # 3. Celery — heavyweight, distributed work
    @celery.task(bind=True, max_retries=3)
    def generate_report(self, report_id: int):
        ...   # runs in a separate worker process
    ```
=== "Output"
    ```
    # Each pattern serves a different need —
    # choose based on durability, scale, and complexity requirements.
    ```

!!! warning "Don't use BackgroundTasks for heavy work"
    Long-running background tasks hold up the Uvicorn worker. Use Celery if a task takes more than a few seconds.

---

## 5. Realistic Example — Audit Logging Middleware

A common pattern is combining a background task with request middleware to log every API call asynchronously.

=== "Python"
    ```python
    from fastapi import FastAPI, Request, BackgroundTasks
    import time

    app = FastAPI()

    def log_request(method: str, path: str, status: int, ms: float):
        print(f"[ACCESS] {method} {path} → {status} ({ms:.1f}ms)")

    @app.middleware("http")
    async def logging_middleware(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000

        # We can't inject BackgroundTasks in middleware directly,
        # so we use a simple background coroutine instead:
        import asyncio
        asyncio.ensure_future(
            asyncio.coroutine(log_request)(
                request.method, request.url.path,
                response.status_code, elapsed_ms
            )
        )
        return response
    ```
=== "Output"
    ```
    [ACCESS] GET /users → 200 (12.4ms)
    [ACCESS] POST /register → 201 (8.1ms)
    ```

---

## 💻 Try It Yourself

Simulate a FastAPI background task queue using a plain Python list — add tasks and "execute" them without any web framework.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import time

# Simulate FastAPI's BackgroundTasks
class BackgroundTaskQueue:
    def __init__(self):
        self._tasks = []

    def add_task(self, fn, *args, **kwargs):
        self._tasks.append((fn, args, kwargs))
        print(f"  [queued] {fn.__name__}({', '.join(str(a) for a in args)})")

    def run_all(self):
        print("\n--- Running background tasks ---")
        for fn, args, kwargs in self._tasks:
            fn(*args, **kwargs)
        print("--- All background tasks done ---")

def send_email(to: str, subject: str):
    print(f"  EMAIL → {to}: {subject}")

def write_log(user_id: int, action: str):
    print(f"  LOG   → user={user_id} action={action}")

def invalidate_cache(key: str):
    print(f"  CACHE → invalidate '{key}'")

# Simulate a request handler
bg = BackgroundTaskQueue()
print("=== Handling POST /register ===")
print("  Saving user to database...")

bg.add_task(send_email, "alice@example.com", "Welcome!")
bg.add_task(write_log, 42, "register")
bg.add_task(invalidate_cache, "user:list")

print("  Response sent: 201 Created")
bg.run_all()
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count Queued Tasks

Simulate adding 3 background tasks to a queue and print the total count.

Expected output:
```
3
```

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">task_queue = []

def dummy_task(name):
    pass

task_queue.append(("send_email", "alice@example.com"))
task_queue.append(("write_log", "user:42"))
task_queue.append(("invalidate_cache", "session:abc"))

print(len(task_queue))
</code></pre>
</div>

---

### Challenge 2 — Run All Tasks

Simulate running all queued tasks and print the completion message.

Expected output:
```
all tasks complete
```

<div class="pyodide-runner" data-mode="challenge" data-expected="all tasks complete">
<pre><code class="language-python">tasks = [
    lambda: None,  # simulate send_email
    lambda: None,  # simulate write_log
    lambda: None,  # simulate push_notification
]

for task in tasks:
    task()  # run each task

print("all tasks complete")
</code></pre>
</div>

---

## 📚 Further Reading

- [FastAPI Background Tasks — Official Docs](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [FastAPI Bigger Applications — Lifespan & Tasks](https://fastapi.tiangolo.com/advanced/events/)
- [Celery vs FastAPI Background Tasks (comparison)](https://testdriven.io/blog/fastapi-and-celery/)

---

!!! success "Lesson Complete 🎉"
    You can now use `BackgroundTasks` to send emails, write logs, and fire webhooks without slowing
    down your API responses. Next up: the full power of Celery for distributed task queues!

[⬅️ Lesson 31 · Async Python Basics](31-async-python-basics.md){ .md-button }
[➡️ Lesson 33 · Introduction to Celery](33-intro-to-celery.md){ .md-button .md-button--primary }
