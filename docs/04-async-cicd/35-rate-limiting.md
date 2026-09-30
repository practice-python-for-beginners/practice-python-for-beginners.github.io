---
title: "Lesson 35 · Rate Limiting API Requests"
description: "Protect your Python APIs from abuse with the token bucket algorithm, sliding window counters, Flask-Limiter integration, and proper 429 Too Many Requests responses."
---

# Lesson 35 · Rate Limiting API Requests

> **Section:** ⚡ Async, CI/CD, Docker &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain why rate limiting protects your API
- [ ] Implement the token bucket algorithm in Python
- [ ] Understand the sliding window counter approach
- [ ] Integrate Flask-Limiter for per-route limits
- [ ] Return proper `429 Too Many Requests` responses with headers
- [ ] Apply per-user vs per-IP rate limiting strategies

---

## 📖 Introduction

Without rate limiting, a single misbehaving client — or an accidental infinite loop in someone's integration — can bring your API to its knees. **Rate limiting** enforces a maximum number of requests per client within a time window.

It's not just about abuse prevention: it creates **fair usage**, protects your database from query storms, and enables tiered pricing (free vs. paid tiers with different limits).

!!! info "Common rate limiting strategies"
    **Fixed window**: reset counter every N seconds. Simple, but has "burst" edge cases at window boundaries. **Sliding window**: smoother, no boundary bursts. **Token bucket**: allows short bursts up to a capacity, then drains at a steady rate. **Leaky bucket**: smooths all traffic to a steady output rate.

---

## 1. Why Rate Limit? Threats and Use Cases

| Threat | Without Rate Limiting | With Rate Limiting |
|--------|----------------------|-------------------|
| Brute-force login | Unlimited attempts | Max 5 attempts / minute / IP |
| Web scraping | Full site scraped | 100 requests / hour / key |
| DDoS amplification | Service goes down | 429 returned, load capped |
| Runaway client bug | DB overwhelmed | Client blocked after threshold |
| Billing / tiers | All users equal | Free: 100/day, Pro: 10,000/day |

=== "Python"
    ```python
    # What a rate-limited response looks like
    # HTTP/1.1 429 Too Many Requests
    # X-RateLimit-Limit: 100
    # X-RateLimit-Remaining: 0
    # X-RateLimit-Reset: 1705316400
    # Retry-After: 42
    # Content-Type: application/json

    # {"error": "rate_limit_exceeded", "message": "Too many requests. Try again in 42 seconds."}
    ```
=== "Output"
    ```
    429 Too Many Requests
    Retry-After: 42
    ```

!!! tip "Rate limit headers"
    Always include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` in every response — not just when limiting. Clients use these to self-throttle.

---

## 2. Token Bucket Algorithm

The token bucket is the most widely used algorithm. Imagine a bucket that holds a maximum of `capacity` tokens. Tokens are added at a steady `refill_rate`. Each request consumes one token.

=== "Python"
    ```python
    import time

    class TokenBucket:
        def __init__(self, capacity: int, refill_rate: float):
            """
            capacity: max tokens (burst size)
            refill_rate: tokens added per second
            """
            self.capacity = capacity
            self.tokens = capacity
            self.refill_rate = refill_rate
            self.last_refill = time.monotonic()

        def _refill(self) -> None:
            now = time.monotonic()
            elapsed = now - self.last_refill
            added = elapsed * self.refill_rate
            self.tokens = min(self.capacity, self.tokens + added)
            self.last_refill = now

        def consume(self) -> bool:
            """Returns True if request is allowed, False if rate-limited."""
            self._refill()
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            return False

    bucket = TokenBucket(capacity=5, refill_rate=1.0)   # 5 burst, 1/sec

    for i in range(8):
        allowed = bucket.consume()
        status = "✓ allowed" if allowed else "✗ rate limited"
        print(f"Request {i+1}: {status}  (tokens: {bucket.tokens:.1f})")
    ```
=== "Output"
    ```
    Request 1: ✓ allowed  (tokens: 4.0)
    Request 2: ✓ allowed  (tokens: 3.0)
    Request 3: ✓ allowed  (tokens: 2.0)
    Request 4: ✓ allowed  (tokens: 1.0)
    Request 5: ✓ allowed  (tokens: 0.0)
    Request 6: ✗ rate limited  (tokens: 0.0)
    Request 7: ✗ rate limited  (tokens: 0.0)
    Request 8: ✗ rate limited  (tokens: 0.0)
    ```

---

## 3. Sliding Window Counter

The sliding window counts requests in a rolling time period, avoiding the edge-case burst at fixed window boundaries.

=== "Python"
    ```python
    import time
    from collections import deque

    class SlidingWindowRateLimiter:
        def __init__(self, max_requests: int, window_seconds: int):
            self.max_requests = max_requests
            self.window = window_seconds
            self.requests = deque()   # timestamps of recent requests

        def is_allowed(self) -> bool:
            now = time.monotonic()
            cutoff = now - self.window

            # Remove timestamps older than the window
            while self.requests and self.requests[0] < cutoff:
                self.requests.popleft()

            if len(self.requests) < self.max_requests:
                self.requests.append(now)
                return True
            return False

    limiter = SlidingWindowRateLimiter(max_requests=3, window_seconds=10)

    results = [limiter.is_allowed() for _ in range(5)]
    for i, allowed in enumerate(results, 1):
        print(f"Request {i}: {'✓ allowed' if allowed else '✗ blocked'}")
    ```
=== "Output"
    ```
    Request 1: ✓ allowed
    Request 2: ✓ allowed
    Request 3: ✓ allowed
    Request 4: ✗ blocked
    Request 5: ✗ blocked
    ```

| Algorithm | Burst handling | Memory | Accuracy |
|-----------|---------------|--------|---------|
| Fixed window | Edge-case burst | O(1) | Good |
| Sliding window | Smooth | O(n requests) | Excellent |
| Token bucket | Allows bursts | O(1) | Excellent |
| Leaky bucket | No burst | O(1) | Excellent |

---

## 4. Flask-Limiter Integration

`Flask-Limiter` makes it trivial to add per-route rate limits, backed by Redis for distributed deployments.

=== "Python"
    ```python
    from flask import Flask, jsonify
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address

    app = Flask(__name__)

    limiter = Limiter(
        app=app,
        key_func=get_remote_address,        # limit by client IP
        default_limits=["200/day", "50/hour"],
        storage_uri="redis://localhost:6379",  # use Redis for distributed apps
    )

    @app.route("/api/search")
    @limiter.limit("10/minute")   # override global limit for this route
    def search():
        return jsonify({"results": []})

    @app.route("/api/login", methods=["POST"])
    @limiter.limit("5/minute; 20/hour")   # brute-force protection
    def login():
        return jsonify({"token": "..."})

    @app.errorhandler(429)
    def rate_limit_handler(e):
        return jsonify({
            "error": "rate_limit_exceeded",
            "message": str(e.description),
        }), 429
    ```
=== "Output"
    ```
    # Normal request:
    # HTTP 200 OK
    # X-RateLimit-Limit: 10
    # X-RateLimit-Remaining: 9

    # After 10 requests in one minute:
    # HTTP 429 Too Many Requests
    # {"error": "rate_limit_exceeded", ...}
    ```

!!! warning "Use Redis in production"
    Flask-Limiter defaults to in-memory storage. In a multi-process/multi-server deployment, each process has its own counter — the limit is effectively multiplied by the number of workers. Always use `storage_uri="redis://..."` in production.

---

## 5. Per-User vs Per-IP Rate Limiting

Different strategies suit different contexts:

=== "Python"
    ```python
    from flask import Flask, request, g
    from flask_limiter import Limiter

    app = Flask(__name__)

    def get_limit_key():
        """Use authenticated user ID if available, else fall back to IP."""
        # In a real app, decode JWT from Authorization header
        user_id = request.headers.get("X-User-ID")
        if user_id:
            return f"user:{user_id}"
        return f"ip:{request.remote_addr}"

    limiter = Limiter(
        app=app,
        key_func=get_limit_key,
        storage_uri="redis://localhost:6379",
    )

    @app.route("/api/data")
    @limiter.limit("1000/hour")   # per authenticated user or per IP
    def get_data():
        return {"data": "..."}

    # Tiered limits based on user plan:
    def get_plan_limit():
        plan = request.headers.get("X-Plan", "free")
        return "100/day" if plan == "free" else "10000/day"

    @app.route("/api/export")
    @limiter.limit(get_plan_limit)   # dynamic limit from function
    def export():
        return {"export": "..."}
    ```
=== "Output"
    ```
    # Free tier user: 100 requests/day
    # Pro tier user:  10,000 requests/day
    # Per-user limits are fairer than per-IP (shared office/NAT)
    ```

---

## 💻 Try It Yourself

Implement the token bucket rate limiter and test 5 requests against a limit of 3.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import time

class TokenBucket:
    def __init__(self, capacity, refill_rate):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate
        self.last_refill = time.monotonic()

    def _refill(self):
        now = time.monotonic()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

    def consume(self):
        self._refill()
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False

# 3 tokens capacity, refills 1 per second
bucket = TokenBucket(capacity=3, refill_rate=1.0)

allowed_count = 0
for i in range(1, 6):
    result = bucket.consume()
    if result:
        allowed_count += 1
    status = "✓ ALLOWED" if result else "✗ BLOCKED"
    print(f"Request {i}: {status}  (tokens remaining: {bucket.tokens:.1f})")

print(f"\nTotal allowed: {allowed_count}/5")
print(f"Total blocked: {5 - allowed_count}/5")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count Allowed Requests

Simulate 5 requests with a token bucket that has a limit (capacity) of 3. Print how many were allowed.

Expected output:
```
3
```

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">tokens = 3
allowed = 0

for _ in range(5):
    if tokens > 0:
        tokens -= 1
        allowed += 1

print(allowed)
</code></pre>
</div>

---

### Challenge 2 — Simulate Refill

After all tokens are consumed, simulate a refill back to capacity 3 and print "refilled".

Expected output:
```
refilled
```

<div class="pyodide-runner" data-mode="challenge" data-expected="refilled">
<pre><code class="language-python">capacity = 3
tokens = 0   # bucket is empty

# Simulate time passing and bucket refilling to capacity
tokens = capacity

if tokens == capacity:
    print("refilled")
</code></pre>
</div>

---

## 📚 Further Reading

- [Flask-Limiter — Official Docs](https://flask-limiter.readthedocs.io/)
- [Rate Limiting Algorithms — Cloudflare Blog](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/)
- [HTTP 429 Too Many Requests — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)

---

!!! success "Lesson Complete 🎉"
    You can now implement rate limiting with the token bucket algorithm, integrate Flask-Limiter,
    and return proper 429 responses with rate limit headers. Your APIs are safer!

[⬅️ Lesson 34 · Caching with Redis](34-caching-redis.md){ .md-button }
[➡️ Lesson 36 · Logging & Monitoring](36-logging-monitoring.md){ .md-button .md-button--primary }
