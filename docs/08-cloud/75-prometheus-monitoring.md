---
title: "Lesson 75 · Monitoring APIs with Prometheus"
description: "Instrument Python web services with Prometheus and Grafana: master Counter, Gauge, Histogram, and Summary metric types, expose a /metrics scrape endpoint, implement RED method monitoring, and write alerting rules."
---

# Lesson 75 · Monitoring APIs with Prometheus

> **Section:** ☁️ Cloud, Serverless & Event-Driven Systems &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Distinguish between the four core Prometheus metric types (Counter, Gauge, Histogram, Summary)
- [ ] Instrument Flask and FastAPI applications using the `prometheus-client` library
- [ ] Expose an OpenMetrics-compliant `/metrics` endpoint for Prometheus server scraping
- [ ] Apply the **RED Method** (Rate, Errors, Duration) for holistic API observability
- [ ] Configure Prometheus scrape jobs in `prometheus.yml` and visualize dashboards in Grafana
- [ ] Calculate percentiles (p50, p90, p95, p99) and write automated alerting rules

---

## 📖 Introduction

In production environments, APIs must be continuously monitored for performance regressions, error spikes, and saturation. **Prometheus** is an open-source, time-series metrics collection system that periodically pulls (scrapes) structured metrics over HTTP from registered targets.

When combined with **Grafana**, Prometheus metrics provide real-time dashboards and alerting capabilities when services experience anomalous behavior.

```
┌─────────────────────┐       HTTP Scrape /metrics (every 15s)      ┌──────────────────┐
│ Python API Service  │◄─────────────────────────────────────────────┤ Prometheus Server│
│ (prometheus-client) │                                              └────────┬─────────┘
└─────────────────────┘                                                       │ PromQL
                                                                              ▼
                                                                     ┌──────────────────┐
                                                                     │ Grafana Dashboard│
                                                                     │ & Alertmanager   │
                                                                     └──────────────────┘
```

---

## 1. The Four Core Metric Types

Prometheus defines four metric primitives:

| Metric Type | Behavior | Example Use Case |
|---|---|---|
| **Counter** | Monotonically increasing number (only resets on restart) | Total HTTP requests, total errors |
| **Gauge** | Value that goes up or down arbitrarily | Memory usage, active connected WebSocket clients |
| **Histogram** | Samples observations into configurable buckets | HTTP request duration, database query latency |
| **Summary** | Computes streaming quantiles over sliding time windows | Exact p95/p99 latency with client-side overhead |

=== "metric_definitions.py"
    ```python
    from prometheus_client import Counter, Gauge, Histogram, Summary

    # 1. Counter: Tracks total requests with labels
    REQUEST_COUNT = Counter(
        "http_requests_total",
        "Total number of HTTP requests processed",
        ["method", "endpoint", "status_code"]
    )

    # 2. Gauge: Tracks current active background workers or queue depth
    ACTIVE_WORKERS = Gauge(
        "background_active_workers",
        "Current number of executing background threads"
    )

    # 3. Histogram: Measures request latency in seconds
    REQUEST_LATENCY = Histogram(
        "http_request_duration_seconds",
        "HTTP request latency in seconds",
        ["endpoint"],
        buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
    )

    # 4. Summary: Sliding quantile measurement
    DB_QUERY_TIME = Summary(
        "db_query_duration_seconds",
        "Time spent executing database queries"
    )
    ```

---

## 2. Instrumenting Flask & FastAPI Applications

Exposing metrics involves registering middleware to measure incoming requests and exposing the `/metrics` endpoint.

=== "FastAPI Middleware"
    ```python
    import time
    from fastapi import FastAPI, Request, Response
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

    app = FastAPI()

    HTTP_REQUESTS = Counter(
        "http_requests_total",
        "Total HTTP Requests",
        ["method", "endpoint", "status"]
    )
    HTTP_DURATION = Histogram(
        "http_request_duration_seconds",
        "HTTP Request Duration",
        ["endpoint"]
    )

    @app.middleware("http")
    async def prometheus_middleware(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time
        
        endpoint = request.url.path
        if endpoint != "/metrics":
            HTTP_REQUESTS.labels(
                method=request.method,
                endpoint=endpoint,
                status=response.status_code
            ).inc()
            HTTP_DURATION.labels(endpoint=endpoint).observe(duration)
            
        return response

    @app.get("/metrics")
    def metrics():
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
    ```
=== "Flask Implementation"
    ```python
    from flask import Flask, request, Response
    import time
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

    app = Flask(__name__)
    REQUEST_LATENCY = Histogram("flask_req_latency", "Latency", ["route"])

    @app.before_request
    def start_timer():
        request.start_time = time.time()

    @app.after_request
    def record_metrics(response):
        if request.path != "/metrics":
            duration = time.time() - request.start_time
            REQUEST_LATENCY.labels(route=request.path).observe(duration)
        return response

    @app.get("/metrics")
    def prometheus_endpoint():
        return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)
    ```

---

## 3. The RED Method and PromQL Queries

The **RED Method** is the gold standard for monitoring microservices:

- **Rate:** How many requests per second is the service handling?
- **Errors:** How many requests are failing per second?
- **Duration:** How long do requests take to complete (latency)?

```
RED PromQL Cheat Sheet:
Rate:     sum(rate(http_requests_total[5m])) by (endpoint)
Errors:   sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100
Duration: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))
```

=== "prometheus.yml Config"
    ```yaml
    global:
      scrape_interval: 15s

    scrape_configs:
      - job_name: "python-api"
        metrics_path: "/metrics"
        static_configs:
          - targets: ["web-api:8000"]
    ```
=== "Alerting Rules (alerts.yml)"
    ```yaml
    groups:
      - name: api_alerts
        rules:
          - alert: HighErrorRate
            expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
            for: 2m
            labels:
              severity: critical
            annotations:
              summary: "API Error rate exceeds 5% on {{ $labels.endpoint }}"

          - alert: HighLatencyP95
            expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 1.0
            for: 3m
            labels:
              severity: warning
            annotations:
              summary: "p95 Latency higher than 1.0s"
    ```

---

## 4. Understanding Percentiles and Histograms

A common mistake is using arithmetic averages for latency. An average hides tail-latency outliers (e.g., 99 fast requests taking 10ms and 1 stuck request taking 10,000ms averages to ~110ms, concealing the severe degradation).

| Metric | Meaning | Why It Matters |
|---|---|---|
| **p50 (Median)** | 50% of requests are faster than this value | Represents typical user experience |
| **p95** | 95% of requests are faster than this value | Standard SLA performance benchmark |
| **p99** | 99% of requests are faster than this value | Identifies extreme bottlenecks and tail latency |

---

## 💻 Try It Yourself

Simulate in-memory Prometheus metric collection: record requests, count errors, track latency samples, and compute RED metrics.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">class PrometheusSimulator:
    def __init__(self):
        self.request_counts = {"2xx": 0, "4xx": 0, "5xx": 0}
        self.latencies = []

    def record_request(self, status_code, latency_ms):
        if 200 <= status_code < 400:
            self.request_counts["2xx"] += 1
        elif 400 <= status_code < 500:
            self.request_counts["4xx"] += 1
        else:
            self.request_counts["5xx"] += 1
        self.latencies.append(latency_ms)

    def get_summary(self):
        total = sum(self.request_counts.values())
        errors = self.request_counts["5xx"]
        error_rate = (errors / total * 100) if total > 0 else 0.0
        
        sorted_lat = sorted(self.latencies)
        p95_idx = int(0.95 * len(sorted_lat)) - 1
        p95_val = sorted_lat[max(0, p95_idx)] if sorted_lat else 0.0
        
        return {
            "total_requests": total,
            "error_rate_pct": f"{error_rate:.1f}%",
            "p95_latency_ms": f"{p95_val:.1f}ms"
        }

metrics = PrometheusSimulator()

# Simulate traffic: 95 successful fast calls, 5 slow 500 errors
for _ in range(95):
    metrics.record_request(200, latency_ms=15.2)
for _ in range(5):
    metrics.record_request(500, latency_ms=450.0)

summary = metrics.get_summary()
print("Prometheus RED Metrics Summary:")
print(f"Total Requests : {summary['total_requests']}")
print(f"Error Rate %   : {summary['error_rate_pct']}")
print(f"p95 Latency    : {summary['p95_latency_ms']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Compute Error Rate

Given a total of 100 requests where 5 returned HTTP 500 status, calculate the error rate percentage and print it formatted as `"5.0%"`.

<div class="pyodide-runner" data-mode="challenge" data-expected="5.0%">
<pre><code class="language-python">total_requests = 100
error_count = 5

# Calculate error_rate = (error_count / total_requests) * 100
# Print error_rate formatted with 1 decimal place and a '%' sign
</code></pre>
</div>

### Challenge 2 — Compute p95 Response Time

Calculate the 95th percentile (p95) value from a sorted list of 100 response time measurements (indices 0 to 99, where p95 corresponds to index `94`) and print it as a float formatted to 1 decimal place (`"95.0"`).

<div class="pyodide-runner" data-mode="challenge" data-expected="95.0">
<pre><code class="language-python"># List of 100 response times from 1.0 to 100.0
latencies = [float(i) for i in range(1, 101)]

# Find the 95th percentile value (latencies[94])
# Print the float formatted to 1 decimal place, e.g. f"{val:.1f}"
</code></pre>
</div>

---

## 📚 Further Reading

- [Official Prometheus Python Client](https://github.com/prometheus/client_python)
- [The RED Method for Monitoring Microservices](https://grafana.com/blog/2018/08/02/the-red-method-how-to-instrument-your-services/)
- [PromQL Basics Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)

---

!!! success "Lesson Complete 🎉"
    You understand how to instrument Python APIs with Prometheus metric types, expose scraping endpoints, implement the RED monitoring framework, and calculate percentiles.

[⬅️ Lesson 74 · Cloud Storage File API](74-cloud-storage-api.md){ .md-button } [➡️ Lesson 76 · Building a WebSocket API](76-websocket-api.md){ .md-button .md-button--primary }
