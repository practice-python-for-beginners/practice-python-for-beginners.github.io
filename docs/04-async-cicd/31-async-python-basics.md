---
title: "Lesson 31 · Async Python Basics"
description: "Master Python's async/await syntax, the event loop, coroutines, asyncio.gather(), and why async programming is essential for high-performance I/O-bound applications."
---

# Lesson 31 · Async Python Basics

> **Section:** ⚡ Async, CI/CD, Docker &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain what the event loop is and why it matters
- [ ] Write `async def` functions (coroutines) and `await` expressions
- [ ] Run a coroutine with `asyncio.run()`
- [ ] Use `asyncio.gather()` to run tasks concurrently
- [ ] Describe the difference between coroutines and regular functions
- [ ] Identify when async is beneficial (I/O-bound) vs when it isn't (CPU-bound)

---

## 📖 Introduction

Most Python code runs **synchronously** — one line at a time, waiting for each operation to finish before moving on. That works fine for calculations, but it's wasteful when your program spends most of its time *waiting* — for a database query, an HTTP response, or a file read.

**Async programming** lets Python do other work while it waits, squeezing much more throughput from a single thread.

!!! info "Async vs Threads vs Processes"
    Python has three concurrency models: **asyncio** (single-threaded cooperative multitasking), **threading** (OS threads, limited by the GIL for CPU work), and **multiprocessing** (true parallelism for CPU-bound work). Async shines for I/O-bound tasks like web requests and DB queries.

---

## 1. The Event Loop Concept

The **event loop** is the engine that drives async code. It maintains a queue of tasks and switches between them whenever one is *awaiting* something — giving control back to the loop while the I/O completes.

| Concept | Description |
|---------|-------------|
| **Event loop** | Central scheduler — runs coroutines and callbacks |
| **Coroutine** | An `async def` function — pauses at `await` |
| **Task** | A coroutine scheduled on the loop via `asyncio.create_task()` |
| **Future** | A low-level object representing a pending result |
| **`await`** | Pauses the current coroutine until the awaited thing completes |

=== "Python"
    ```python
    import asyncio

    async def greet(name: str, delay: float):
        await asyncio.sleep(delay)          # non-blocking sleep
        print(f"Hello, {name}!")

    async def main():
        # Run two greetings concurrently
        await asyncio.gather(
            greet("Alice", 0.2),
            greet("Bob",   0.1),
        )

    asyncio.run(main())
    ```
=== "Output"
    ```
    Hello, Bob!
    Hello, Alice!
    ```

!!! tip "Order is not guaranteed"
    Bob greets first because his delay (0.1 s) is shorter — both coroutines run *concurrently*, not sequentially.

---

## 2. `async def` and `await` Syntax

Any function defined with `async def` becomes a **coroutine function**. Calling it returns a *coroutine object* — it does **not** run immediately. You must `await` it (or schedule it as a task).

=== "Python"
    ```python
    import asyncio

    # Regular function — runs immediately when called
    def sync_fetch(url: str) -> str:
        return f"<html from {url}>"

    # Coroutine — suspends while "fetching"
    async def async_fetch(url: str) -> str:
        await asyncio.sleep(0.5)   # simulate network latency
        return f"<html from {url}>"

    async def main():
        result = await async_fetch("https://example.com")
        print(result)

    asyncio.run(main())
    ```
=== "Output"
    ```
    <html from https://example.com>
    ```

!!! warning "Forgetting `await`"
    Calling `async_fetch("url")` without `await` returns a coroutine *object*, not a result.
    Python will warn: `RuntimeWarning: coroutine 'async_fetch' was never awaited`.

---

## 3. `asyncio.gather()` — Running Tasks Concurrently

`asyncio.gather()` schedules multiple coroutines and waits for *all* of them to complete, collecting their return values.

=== "Python"
    ```python
    import asyncio
    import time

    async def fetch(site: str, delay: float) -> str:
        await asyncio.sleep(delay)
        return f"✓ {site}"

    async def main():
        start = time.perf_counter()

        results = await asyncio.gather(
            fetch("api.github.com",    0.3),
            fetch("api.openai.com",    0.5),
            fetch("jsonplaceholder",   0.2),
        )

        elapsed = time.perf_counter() - start
        for r in results:
            print(r)
        print(f"Total time: {elapsed:.1f}s")   # ~0.5s, not 1.0s

    asyncio.run(main())
    ```
=== "Output"
    ```
    ✓ api.github.com
    ✓ api.openai.com
    ✓ jsonplaceholder
    Total time: 0.5s
    ```

!!! info "Sequential vs Concurrent"
    Running the same three fetches sequentially would take 0.3 + 0.5 + 0.2 = **1.0 s**. With `gather()` the wall-clock time is only **0.5 s** (the longest single task).

---

## 4. `asyncio.sleep()` vs `time.sleep()`

This is a critical distinction:

| Function | Blocks event loop? | Use in |
|----------|-------------------|--------|
| `time.sleep(n)` | ✅ Yes — freezes everything | Sync code |
| `asyncio.sleep(n)` | ❌ No — yields control | Async coroutines |

=== "Python"
    ```python
    import asyncio

    async def bad_sleep():
        import time
        time.sleep(1)        # ❌ blocks the entire event loop!
        print("bad done")

    async def good_sleep():
        await asyncio.sleep(1)   # ✅ yields to event loop
        print("good done")

    # asyncio.sleep is the correct choice inside coroutines
    asyncio.run(good_sleep())
    ```
=== "Output"
    ```
    good done
    ```

!!! warning "Never call `time.sleep()` inside a coroutine"
    It blocks the entire event loop — no other coroutine can run while it sleeps.
    Always use `await asyncio.sleep()` inside async code.

---

## 5. Coroutines vs Regular Functions — When to Use Async

Async is **not always better**. Understanding the trade-off is key.

| Scenario | Best Approach | Why |
|----------|--------------|-----|
| HTTP requests (many) | `asyncio` + `httpx`/`aiohttp` | I/O-bound — waiting on network |
| Database queries | `asyncio` + `asyncpg`/`aiomysql` | I/O-bound — waiting on DB |
| File reads/writes | `asyncio` + `aiofiles` | I/O-bound |
| CPU calculations (sorting, maths) | `multiprocessing` | CPU-bound — async won't help |
| Simple scripts | Regular functions | Overhead not worth it |
| Web frameworks | FastAPI / Starlette | Built for async natively |

=== "Python"
    ```python
    import asyncio

    async def pipeline():
        """Realistic async pipeline: fetch → process → store"""

        print("1. Fetching data...")
        await asyncio.sleep(0.2)   # simulate HTTP call
        data = [1, 2, 3, 4, 5]

        print("2. Processing data...")
        # CPU work — no await needed, it's fast
        result = sum(x ** 2 for x in data)

        print("3. Storing result...")
        await asyncio.sleep(0.1)   # simulate DB write
        print(f"   Stored: {result}")

    asyncio.run(pipeline())
    ```
=== "Output"
    ```
    1. Fetching data...
    2. Processing data...
    3. Storing result...
       Stored: 55
    ```

---

## 💻 Try It Yourself

This runner uses `threading` to *simulate* concurrent async behaviour (asyncio requires a running event loop which Pyodide handles differently). The logic mirrors `asyncio.gather()` semantics exactly.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import threading
import time

def simulate_fetch(name, delay, results, index):
    """Simulates an async coroutine using a thread."""
    time.sleep(delay)
    results[index] = f"✓ fetched {name} in {delay}s"

tasks = [
    ("users-api",    0.3),
    ("products-api", 0.5),
    ("orders-api",   0.2),
]

results = [None] * len(tasks)
threads = []

start = time.time()

# Launch all "coroutines" concurrently
for i, (name, delay) in enumerate(tasks):
    t = threading.Thread(target=simulate_fetch, args=(name, delay, results, i))
    threads.append(t)
    t.start()

# Wait for all to complete (like asyncio.gather)
for t in threads:
    t.join()

elapsed = time.time() - start

for r in results:
    print(r)

sequential_total = sum(d for _, d in tasks)
print(f"\nSequential would take: {sequential_total:.1f}s")
print(f"Concurrent took:       {elapsed:.1f}s")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Sequential vs Parallel Timing

Given a list of simulated fetch times `[0.1, 0.2, 0.3]`, calculate the sequential total (sum) and the parallel time (max). Print the result in the exact format shown.

Expected output:
```
Sequential: 0.6s, Parallel: 0.3s
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Sequential: 0.6s, Parallel: 0.3s">
<pre><code class="language-python">fetch_times = [0.1, 0.2, 0.3]

# Calculate sequential total and parallel max
sequential = sum(fetch_times)
parallel = max(fetch_times)

print(f"Sequential: {sequential:.1f}s, Parallel: {parallel:.1f}s")
</code></pre>
</div>

---

### Challenge 2 — Count Coroutines

A mock module exports a list of names. Count how many represent coroutines (names that start with `"coro_"`).

Expected output:
```
3
```

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">module_exports = ["coro_fetch", "helper_parse", "coro_store", "Config", "coro_notify", "run_server"]

coroutine_count = sum(1 for name in module_exports if name.startswith("coro_"))
print(coroutine_count)
</code></pre>
</div>

---

## 📚 Further Reading

- [Python asyncio — Official Docs](https://docs.python.org/3/library/asyncio.html)
- [Real Python — Async IO in Python: A Complete Walkthrough](https://realpython.com/async-io-python/)
- [Python Concurrency: The Tricky Bits (Brandon Rhodes)](https://python.haas.homelinux.net/)

---

!!! success "Lesson Complete 🎉"
    You now understand coroutines, the event loop, `asyncio.run()`, and `asyncio.gather()`.
    These are the building blocks for high-performance Python web services!

[⬅️ Lesson 30 · WebSockets & Real-Time](../03-real-world-apis/30-websockets-realtime.md){ .md-button }
[➡️ Lesson 32 · FastAPI Background Tasks](32-fastapi-background-tasks.md){ .md-button .md-button--primary }
