---
title: "Lesson 49 · Load Testing APIs with Locust"
description: "Write Locust load tests, run them headlessly, interpret RPS and percentile metrics, and find performance bottlenecks in your API."
---

# Lesson 49 · Load Testing APIs with Locust

> **Section:** Security, Webhooks & Microservices &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** 30 min

## 🎯 Learning Objectives

- [ ] Explain why load testing is essential before going to production
- [ ] Write a Locust `User` class with `@task` decorators and `wait_time`
- [ ] Run Locust in headless mode with `--headless` and interpret the output
- [ ] Understand RPS, p50, p95, and p99 response time percentiles
- [ ] Compute percentiles programmatically using `statistics` (stdlib)
- [ ] Identify common API bottlenecks from load test results

## 📖 Introduction

A load test answers one question: *what happens when many users hit your API at once?* Without load testing, you find out in production — often at the worst possible time.

**Locust** is a Python-native load testing tool. You write test scripts in pure Python, run them from the CLI or a web UI, and get real-time charts of requests per second, response time percentiles, and failure rates.

This lesson teaches you the Locust mental model, how to write a realistic Locustfile, and — using only the stdlib — how to compute the key percentile metrics yourself.

!!! note "Installing Locust"
    ```bash
    pip install locust
    ```

---

## 1. Why Load Test?

=== "What you discover"
    | Finding | Without load test | With load test |
    |---------|------------------|----------------|
    | DB connection pool exhaustion | Discovered by users | Fixed before launch |
    | N+1 query slowdown under load | Random complaints | Pinpointed to endpoint |
    | Memory leak over time | Gradual degradation | Caught in 30-min soak test |
    | Third-party API rate limits | Surprise outage | Handled proactively |

=== "Types of load tests"
    ```
    Load test     — ramp up to expected peak, hold, ramp down
    Stress test   — push beyond peak to find breaking point
    Soak test     — run at normal load for hours (catches memory leaks)
    Spike test    — sudden 10× burst, then back to normal
    ```

!!! tip "Test in a staging environment"
    Never run a load test against production unless you have a plan to handle the traffic and a way to stop it instantly.

---

## 2. Writing a Locustfile

=== "Minimal Locustfile"
    ```python
    # locustfile.py
    from locust import HttpUser, task, between

    class APIUser(HttpUser):
        wait_time = between(0.5, 2)  # seconds between tasks

        @task(3)  # weight 3 — called 3× as often as weight-1 tasks
        def list_items(self):
            self.client.get("/api/items")

        @task(1)
        def get_item(self):
            self.client.get("/api/items/42")

        @task(1)
        def create_item(self):
            self.client.post(
                "/api/items",
                json={"name": "Widget", "price": 9.99},
                headers={"Authorization": "Bearer test-token"},
            )
    ```

=== "On-start authentication"
    ```python
    class AuthenticatedUser(HttpUser):
        wait_time = between(1, 3)
        token: str = ""

        def on_start(self):
            """Runs once per simulated user when they 'log in'."""
            resp = self.client.post(
                "/auth/token",
                data={"username": "testuser", "password": "testpass"},
            )
            self.token = resp.json()["access_token"]

        @task
        def get_profile(self):
            self.client.get(
                "/api/me",
                headers={"Authorization": f"Bearer {self.token}"},
            )
    ```

=== "Custom failure handling"
    ```python
    @task
    def search(self):
        with self.client.get(
            "/api/search?q=widget",
            catch_response=True,
        ) as response:
            if response.elapsed.total_seconds() > 2.0:
                response.failure("Response too slow")
            elif response.status_code != 200:
                response.failure(f"HTTP {response.status_code}")
            else:
                response.success()
    ```

---

## 3. Running Locust

=== "Web UI mode"
    ```bash
    locust -f locustfile.py --host http://localhost:8000
    # Open http://localhost:8089 — set user count and spawn rate
    ```

=== "Headless (CI/CD)"
    ```bash
    locust \
      -f locustfile.py \
      --host http://localhost:8000 \
      --headless \
      --users 100 \
      --spawn-rate 10 \
      --run-time 60s \
      --csv results
    # Generates results_stats.csv, results_failures.csv, results_history.csv
    ```

=== "Docker headless"
    ```bash
    docker run --rm \
      -v $(pwd):/mnt/locust \
      locustio/locust \
      -f /mnt/locust/locustfile.py \
      --headless -u 50 -r 5 --run-time 30s \
      --host http://host.docker.internal:8000
    ```

---

## 4. Interpreting Results

=== "Key metrics"
    | Metric | Meaning | Healthy target |
    |--------|---------|---------------|
    | RPS | Requests per second | Depends on SLA |
    | p50 (median) | 50% of requests faster than this | < 200 ms |
    | p95 | 95% of requests faster than this | < 1 s |
    | p99 | 99% of requests faster than this | < 2 s |
    | Failure % | Requests that returned non-2xx | < 0.1% |

=== "Sample CSV output"
    ```
    Name               # reqs  # fails  avg(ms)  min   max   p50  p95  p99
    GET /api/items       4820       0      43      12   890    38   89  312
    POST /api/items      1607       3      91      18  2100    72  201  834
    ```

=== "Reading the distribution"
    ```
    p50 = 38 ms  → half your users wait ≤ 38 ms
    p95 = 89 ms  → 19 out of 20 users wait ≤ 89 ms
    p99 = 312 ms → 1 in 100 users waits up to 312 ms

    If p99 > 2 s, investigate:
    - Slow DB queries (EXPLAIN ANALYZE)
    - Missing indexes
    - N+1 queries (SQLAlchemy eager loading)
    - Memory pressure / GC pauses
    ```

---

## 5. Computing Percentiles in Python

=== "statistics.quantiles (Python 3.8+)"
    ```python
    import statistics

    latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

    # quantiles(data, n=100) returns 99 cut points (p1 through p99)
    qs = statistics.quantiles(latencies, n=100)
    p50 = qs[49]   # index 49 = 50th percentile
    p95 = qs[94]   # index 94 = 95th percentile
    p99 = qs[98]   # index 98 = 99th percentile

    print(f"p50={p50}  p95={p95}  p99={p99}")
    ```

=== "Manual calculation"
    ```python
    def percentile(data: list[float], p: float) -> float:
        """Linear interpolation percentile (same as numpy default)."""
        sorted_data = sorted(data)
        n = len(sorted_data)
        index = (p / 100) * (n - 1)
        lower = int(index)
        upper = min(lower + 1, n - 1)
        frac = index - lower
        return sorted_data[lower] + frac * (sorted_data[upper] - sorted_data[lower])

    latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    print(percentile(latencies, 50))   # 55.0
    print(percentile(latencies, 95))   # 95.0
    print(percentile(latencies, 99))   # 99.0
    ```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">

```python
import random
import statistics

def percentile(data: list, p: float) -> float:
    """Linear interpolation percentile."""
    sorted_data = sorted(data)
    n = len(sorted_data)
    index = (p / 100) * (n - 1)
    lower = int(index)
    upper = min(lower + 1, n - 1)
    frac = index - lower
    return sorted_data[lower] + frac * (sorted_data[upper] - sorted_data[lower])

# Simulate a load test with 200 requests and realistic latencies
random.seed(42)
latencies = []
for _ in range(200):
    # Most requests fast; a few slow (long tail)
    if random.random() < 0.95:
        latencies.append(random.uniform(20, 150))
    else:
        latencies.append(random.uniform(500, 2000))

p50 = percentile(latencies, 50)
p95 = percentile(latencies, 95)
p99 = percentile(latencies, 99)
rps = 200 / 60  # simulated: 200 requests over 60 seconds

print(f"Simulated load test — 200 requests over 60s")
print(f"RPS:  {rps:.1f}")
print(f"p50:  {p50:.0f} ms")
print(f"p95:  {p95:.0f} ms")
print(f"p99:  {p99:.0f} ms")
print(f"Max:  {max(latencies):.0f} ms")

verdict = "✅ Within SLA" if p95 < 1000 else "❌ p95 exceeds 1s SLA"
print(f"\n{verdict}")
```

</div>

---

## 🏋️ Challenges

**Challenge 1 — Compute p50 of a latency list**

<div class="pyodide-runner" data-mode="challenge" data-expected="55.0">

```python
def percentile(data, p):
    sorted_data = sorted(data)
    n = len(sorted_data)
    index = (p / 100) * (n - 1)
    lower = int(index)
    upper = min(lower + 1, n - 1)
    frac = index - lower
    return sorted_data[lower] + frac * (sorted_data[upper] - sorted_data[lower])

latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

# TODO: compute p50 of latencies and print it
```

</div>

---

**Challenge 2 — Compute p95 of the same list**

<div class="pyodide-runner" data-mode="challenge" data-expected="95.0">

```python
def percentile(data, p):
    sorted_data = sorted(data)
    n = len(sorted_data)
    index = (p / 100) * (n - 1)
    lower = int(index)
    upper = min(lower + 1, n - 1)
    frac = index - lower
    return sorted_data[lower] + frac * (sorted_data[upper] - sorted_data[lower])

latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

# TODO: compute p95 of latencies and print it
```

</div>

---

## 📚 Further Reading

- [Locust Documentation](https://docs.locust.io/en/stable/)
- [Python `statistics` module — Official Docs](https://docs.python.org/3/library/statistics.html)
- [Google SRE Book — Chapter 26: Data Processing Pipelines](https://sre.google/sre-book/data-processing-pipelines/)

---

!!! success "Lesson 49 complete!"
    You can now write Locust user classes, run headless load tests in CI, compute p50/p95/p99 latency percentiles, and read a results table to find the endpoints that need optimization.

[⬅️ Previous Lesson](48-inter-service-comm.md){ .md-button } [➡️ Next Lesson](50-api-gateway-fastapi.md){ .md-button .md-button--primary }
