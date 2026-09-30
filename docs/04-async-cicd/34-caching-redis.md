---
title: "Lesson 34 · Caching with Redis"
description: "Speed up your Python APIs by implementing the cache-aside pattern with Redis, setting TTL expiry, avoiding cache stampedes, and building a memoize decorator."
---

# Lesson 34 · Caching with Redis

> **Section:** ⚡ Async, CI/CD, Docker &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain why caching reduces database load and improves response times
- [ ] Use Redis data types: strings, hashes, and lists
- [ ] Implement the cache-aside pattern with `redis-py`
- [ ] Set TTL (time-to-live) expiry on cached entries
- [ ] Understand cache invalidation strategies
- [ ] Build a `@memoize` decorator using a dict-based cache

---

## 📖 Introduction

Databases are slow compared to in-memory stores. When 10,000 users request the same product listing every minute, running the same SQL query repeatedly wastes CPU, memory, and time.

**Caching** stores the result of expensive operations so future requests can be served instantly. **Redis** is the industry-standard in-memory data store for this job — blazing fast, supports rich data types, and allows automatic key expiry.

!!! info "Redis vs Memcached"
    Redis supports richer data types (lists, hashes, sorted sets, pub/sub), persistence, and replication. Memcached is simpler and pure cache-only. For most Python projects, **Redis is the better default**.

---

## 1. Redis Data Types for Caching

Redis is not just a key-value store — it supports several data structures:

| Type | Redis command | Python usage |
|------|--------------|-------------|
| **String** | `SET key val` / `GET key` | Cache a serialised JSON response |
| **Hash** | `HSET key field val` | Cache an object with multiple fields |
| **List** | `LPUSH key val` / `LRANGE` | Cache recent activity feeds |
| **Sorted Set** | `ZADD key score member` | Leaderboards, rate limiting |
| **TTL** | `EXPIRE key seconds` | Any type — auto-delete after N seconds |

=== "Python"
    ```python
    import redis
    import json

    r = redis.Redis(host="localhost", port=6379, decode_responses=True)

    # --- String: cache a JSON API response ---
    r.set("product:42", json.dumps({"id": 42, "name": "Widget", "price": 9.99}))
    r.expire("product:42", 300)   # expire in 5 minutes

    raw = r.get("product:42")
    product = json.loads(raw)
    print(product["name"])    # Widget

    # --- Hash: cache a user profile ---
    r.hset("user:7", mapping={"name": "Alice", "email": "alice@example.com", "score": "100"})
    r.expire("user:7", 600)

    name = r.hget("user:7", "name")
    print(name)    # Alice
    ```
=== "Output"
    ```
    Widget
    Alice
    ```

!!! tip "Always serialize complex objects"
    Redis stores strings. Use `json.dumps()` / `json.loads()` for dicts and lists, or `pickle` for arbitrary Python objects (use pickle carefully — it can execute code on deserialization).

---

## 2. The Cache-Aside Pattern

Cache-aside (also called "lazy loading") is the most common caching strategy:

1. **Check cache** — if the key exists, return it (cache hit)
2. **On miss** — query the database, store in cache, return result

=== "Python"
    ```python
    import redis
    import json
    import time

    r = redis.Redis(host="localhost", port=6379, decode_responses=True)

    def get_product(product_id: int) -> dict:
        cache_key = f"product:{product_id}"

        # Step 1: Check cache
        cached = r.get(cache_key)
        if cached:
            print(f"  [CACHE HIT] {cache_key}")
            return json.loads(cached)

        # Step 2: Cache miss — query the "database"
        print(f"  [CACHE MISS] {cache_key} — querying DB...")
        time.sleep(0.05)   # simulate slow DB query
        product = {"id": product_id, "name": f"Product {product_id}", "price": 19.99}

        # Step 3: Store in cache with TTL
        r.setex(cache_key, 300, json.dumps(product))   # setex = SET + EXPIRE

        return product

    p = get_product(42)   # miss — hits DB
    p = get_product(42)   # hit — served from Redis
    print(p["name"])
    ```
=== "Output"
    ```
    [CACHE MISS] product:42 — querying DB...
    [CACHE HIT] product:42
    Product 42
    ```

| Strategy | Description | Best for |
|----------|-------------|---------|
| **Cache-aside** | App manages cache explicitly | General purpose |
| **Write-through** | Write to cache AND DB simultaneously | Strong consistency |
| **Write-behind** | Write to cache first, DB later async | High write throughput |
| **Read-through** | Cache fetches from DB automatically | Simplified app code |

---

## 3. TTL Expiry and Cache Invalidation

TTL (time-to-live) automatically deletes stale entries. Manual invalidation deletes entries when the underlying data changes.

=== "Python"
    ```python
    import redis

    r = redis.Redis(host="localhost", port=6379, decode_responses=True)

    # Set with TTL
    r.setex("session:abc123", 1800, "user_id=42")   # expires in 30 min
    print(r.ttl("session:abc123"))   # 1800 (seconds remaining)

    # Check if key exists
    print(r.exists("session:abc123"))   # 1 (truthy)

    # Manual invalidation when data changes
    def update_product(product_id: int, new_data: dict):
        # 1. Write to database (not shown)
        # 2. Invalidate the cache
        r.delete(f"product:{product_id}")
        print(f"Cache invalidated for product:{product_id}")

    update_product(42, {"name": "New Widget", "price": 12.99})
    print(r.exists("product:42"))   # 0 — key was deleted
    ```
=== "Output"
    ```
    1800
    1
    Cache invalidated for product:42
    0
    ```

!!! warning "Cache invalidation is hard"
    Phil Karlton famously said: *"There are only two hard things in computer science: cache invalidation and naming things."* Common bugs: forgetting to invalidate on update, or invalidating too aggressively and defeating the cache's purpose.

---

## 4. The `@memoize` Decorator Pattern

For function-level caching (not HTTP responses), a `@memoize` decorator is elegant:

=== "Python"
    ```python
    import functools
    import time

    def memoize(ttl_seconds: int = 60):
        """Decorator that caches function results in memory with TTL."""
        cache = {}

        def decorator(func):
            @functools.wraps(func)
            def wrapper(*args):
                key = args
                now = time.time()

                if key in cache:
                    result, timestamp = cache[key]
                    if now - timestamp < ttl_seconds:
                        print(f"  [CACHE HIT] {func.__name__}{args}")
                        return result

                print(f"  [COMPUTING] {func.__name__}{args}")
                result = func(*args)
                cache[key] = (result, now)
                return result

            return wrapper
        return decorator

    @memoize(ttl_seconds=10)
    def expensive_query(user_id: int) -> dict:
        time.sleep(0.1)   # simulate DB latency
        return {"user_id": user_id, "orders": 42}

    result1 = expensive_query(7)   # computed
    result2 = expensive_query(7)   # cache hit
    result3 = expensive_query(9)   # computed (different arg)

    print(result1)
    ```
=== "Output"
    ```
    [COMPUTING] expensive_query(7,)
    [CACHE HIT] expensive_query(7,)
    [COMPUTING] expensive_query(9,)
    {'user_id': 7, 'orders': 42}
    ```

!!! note "functools.lru_cache for simple cases"
    Python's built-in `@functools.lru_cache(maxsize=128)` provides LRU (Least Recently Used) caching with no TTL. Use it for pure functions that don't need expiry.

---

## 5. Avoiding Cache Stampede

When a popular key expires, hundreds of requests simultaneously miss the cache and hammer the DB — a **cache stampede**. The solution: **probabilistic early expiration** or a **lock**.

=== "Python"
    ```python
    import redis
    import json
    import time
    import threading

    r = redis.Redis(host="localhost", port=6379, decode_responses=True)
    _lock = threading.Lock()

    def get_with_lock(key: str, compute_fn, ttl: int = 300):
        """Cache-aside with mutex to prevent stampede."""
        value = r.get(key)
        if value:
            return json.loads(value)

        with _lock:
            # Double-check after acquiring lock
            value = r.get(key)
            if value:
                return json.loads(value)

            # We hold the lock — only one thread computes
            result = compute_fn()
            r.setex(key, ttl, json.dumps(result))
            return result

    def fetch_leaderboard():
        time.sleep(0.1)   # simulate slow query
        return [{"rank": 1, "user": "Alice", "score": 9850}]

    data = get_with_lock("leaderboard", fetch_leaderboard, ttl=60)
    print(data[0]["user"])   # Alice
    ```
=== "Output"
    ```
    Alice
    ```

---

## 💻 Try It Yourself

Implement a simple dict-based LRU cache decorator and demonstrate cache hits vs misses.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import time
import functools

def simple_cache(maxsize=8):
    """Simple LRU-style memoize using an OrderedDict."""
    from collections import OrderedDict

    def decorator(func):
        cache = OrderedDict()

        @functools.wraps(func)
        def wrapper(*args):
            if args in cache:
                cache.move_to_end(args)  # mark as recently used
                print(f"  HIT  {func.__name__}{args} = {cache[args]}")
                return cache[args]

            result = func(*args)
            cache[args] = result
            if len(cache) > maxsize:
                cache.popitem(last=False)  # evict oldest
            print(f"  MISS {func.__name__}{args} = {result}")
            return result

        return wrapper
    return decorator

@simple_cache(maxsize=4)
def square(n):
    return n * n

@simple_cache(maxsize=4)
def greet(name):
    return f"Hello, {name}!"

print("=== Testing square() ===")
square(3)
square(5)
square(3)   # cache hit

print("\n=== Testing greet() ===")
greet("Alice")
greet("Bob")
greet("Alice")  # cache hit
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count Cache Hits

Implement a simple memoize cache and count how many times results are served from the cache (hits).

Expected output:
```
3
```

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">cache = {}
hits = 0

def cached_double(n):
    global hits
    if n in cache:
        hits += 1
        return cache[n]
    cache[n] = n * 2
    return cache[n]

# Call the function multiple times
cached_double(5)   # miss
cached_double(5)   # hit
cached_double(3)   # miss
cached_double(3)   # hit
cached_double(7)   # miss
cached_double(7)   # hit

print(hits)
</code></pre>
</div>

---

### Challenge 2 — Count Non-Expired Entries

Given a cache with timestamps and a TTL of 60 seconds, count how many entries have NOT expired.

Expected output:
```
2
```

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">import time

now = time.time()
TTL = 60

# (key, stored_at_seconds_ago)
cache_entries = [
    ("product:1", now - 30),   # 30 seconds old — NOT expired
    ("product:2", now - 90),   # 90 seconds old — EXPIRED
    ("product:3", now - 45),   # 45 seconds old — NOT expired
    ("product:4", now - 120),  # 120 seconds old — EXPIRED
]

valid = sum(1 for key, ts in cache_entries if (now - ts) < TTL)
print(valid)
</code></pre>
</div>

---

## 📚 Further Reading

- [redis-py — Official Python Client](https://redis-py.readthedocs.io/en/stable/)
- [Redis Caching Patterns (Redis Docs)](https://redis.io/docs/manual/patterns/)
- [Python `functools.lru_cache` — Official Docs](https://docs.python.org/3/library/functools.html#functools.lru_cache)

---

!!! success "Lesson Complete 🎉"
    You can now implement cache-aside with Redis, set TTL expiry, invalidate stale data, and
    build a memoize decorator — critical skills for building fast, scalable Python APIs!

[⬅️ Lesson 33 · Introduction to Celery](33-intro-to-celery.md){ .md-button }
[➡️ Lesson 35 · Rate Limiting API Requests](35-rate-limiting.md){ .md-button .md-button--primary }
