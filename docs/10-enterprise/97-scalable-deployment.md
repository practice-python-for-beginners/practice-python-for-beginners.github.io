---
title: "Lesson 97 · Scalable Clustered API Deployment"
description: "Deploy Python APIs at scale — Gunicorn worker classes, Nginx reverse proxy, horizontal scaling with Kubernetes, zero-downtime rolling updates, and auto-scaling."
---

# Lesson 97 · Scalable Clustered API Deployment

> **Section:** 🏢 Enterprise Architecture &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~90 minutes

---

## 🎯 Learning Objectives

- [ ] Choose the right Gunicorn worker class for sync, threaded, and async apps
- [ ] Configure Nginx as a reverse proxy with upstream keepalive
- [ ] Scale horizontally using Kubernetes Deployments
- [ ] Implement zero-downtime deployments with rolling update strategy
- [ ] Simulate round-robin load balancing and request distribution
- [ ] Configure Horizontal Pod Autoscaler (HPA) based on CPU metrics

---

## 📖 Introduction

A single-process Python application is limited to one CPU core and will struggle under load. Real production deployments use multiple processes (Gunicorn workers), multiple machines (horizontal scaling), and a reverse proxy (Nginx) to distribute load across them. When combined with Kubernetes, this stack can auto-scale from 2 to 50 pods in seconds based on real traffic — and deploy new versions without any downtime.

This lesson covers the complete deployment stack, from Gunicorn process model to Kubernetes autoscaling.

---

## 1. Gunicorn Workers and Worker Classes

=== "Worker Classes"
    ```python
    # Gunicorn spawns N worker processes that each handle requests independently.
    # The WORKER CLASS determines how each worker handles concurrency.

    # ── sync (default) ─────────────────────────────────────────
    # One request at a time per worker. Simple and safe.
    # Use for: CPU-bound workloads, simple Flask apps.
    # gunicorn -w 4 app:app

    # ── gthread ────────────────────────────────────────────────
    # Multiple threads per worker. Good for I/O-bound sync code.
    # gunicorn -w 4 --worker-class=gthread --threads=4 app:app

    # ── gevent ─────────────────────────────────────────────────
    # Green threads via cooperative coroutines. High concurrency.
    # gunicorn -w 4 --worker-class=gevent --worker-connections=1000 app:app

    # ── uvicorn.workers.UvicornWorker (for FastAPI / ASGI) ─────
    # Async worker using uvicorn event loop. Best for FastAPI.
    # gunicorn -w 4 --worker-class=uvicorn.workers.UvicornWorker app:app

    WORKER_SELECTION = {
        "Flask (sync)":           "gunicorn -w {cpu*2+1} app:app",
        "Flask (I/O heavy)":      "gunicorn -w {cpu*2+1} --worker-class=gevent app:app",
        "FastAPI (async)":        "gunicorn -w {cpu*2+1} --worker-class=uvicorn.workers.UvicornWorker app:app",
        "Django (sync)":          "gunicorn -w {cpu*2+1} --worker-class=gthread --threads=4 mysite.wsgi:application",
    }
    ```

=== "Optimal Worker Count"
    ```python
    import os

    def recommended_workers(worker_class: str = "sync") -> int:
        """
        Recommended Gunicorn worker count formula.
        For CPU-bound:  workers = cpu_count * 2 + 1
        For I/O-bound:  workers = cpu_count (use gevent or gthread instead)
        """
        cpu_count = os.cpu_count() or 1
        if worker_class in ("sync", "gthread", "uvicorn"):
            return cpu_count * 2 + 1
        elif worker_class == "gevent":
            # gevent handles concurrency internally — fewer processes
            return cpu_count
        return cpu_count * 2 + 1

    cpus = os.cpu_count() or 1
    print(f"Machine CPUs: {cpus}")
    print(f"Sync workers:    {recommended_workers('sync')}")
    print(f"Uvicorn workers: {recommended_workers('uvicorn')}")
    print(f"Gevent workers:  {recommended_workers('gevent')}")
    ```

=== "gunicorn.conf.py"
    ```python
    # gunicorn.conf.py — production configuration file
    import multiprocessing

    # Worker settings
    workers = multiprocessing.cpu_count() * 2 + 1
    worker_class = "uvicorn.workers.UvicornWorker"
    worker_connections = 1000
    threads = 1

    # Binding
    bind = "0.0.0.0:8000"

    # Timeouts
    timeout = 30          # kill worker if request takes longer
    keepalive = 5         # keep alive connections for 5s

    # Logging
    accesslog = "-"       # stdout
    errorlog  = "-"       # stderr
    loglevel  = "info"
    access_log_format = '%(h)s %(r)s %(s)s %(b)s %(M)sms'

    # Lifecycle hooks
    def on_starting(server):
        print("Gunicorn starting...")

    def post_fork(server, worker):
        print(f"Worker {worker.pid} forked")
    ```

---

## 2. Nginx as Reverse Proxy

```nginx
# /etc/nginx/conf.d/myapp.conf

upstream myapp {
    # Round-robin across 3 Gunicorn processes
    server 127.0.0.1:8001;
    server 127.0.0.1:8002;
    server 127.0.0.1:8003;
    keepalive 32;   # keep 32 idle connections per upstream
}

server {
    listen 80;
    server_name api.example.com;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # Proxy to Gunicorn cluster
    location / {
        proxy_pass         http://myapp;
        proxy_http_version 1.1;
        proxy_set_header   Connection        "";
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    # Serve static files directly (bypass Python)
    location /static/ {
        alias /app/static/;
        expires 7d;
    }
}
```

!!! tip "Nginx + Gunicorn vs direct Uvicorn"
    Never expose Uvicorn directly to the internet. Nginx handles TLS termination, static files, rate limiting, and request buffering far more efficiently than Python. Always put Nginx (or a load balancer) in front.

---

## 3. Horizontal Scaling with Kubernetes

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge:        1    # allow 1 extra pod during update
      maxUnavailable:  0    # never take a pod down before the new one is up
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: myapp:2.0.0
          ports:
            - containerPort: 8000
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "1000m"
              memory: "512Mi"
          readinessProbe:
            httpGet: { path: /health/ready, port: 8000 }
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: myapp-svc
spec:
  selector:
    app: myapp
  ports:
    - port: 80
      targetPort: 8000
  type: ClusterIP
```

---

## 4. Zero-Downtime Deploys and HPA

=== "Rolling Update"
    ```bash
    # Deploy new image version with zero downtime
    kubectl set image deployment/myapp myapp=myapp:2.1.0

    # Watch the rolling update in real time
    kubectl rollout status deployment/myapp

    # Roll back if something goes wrong
    kubectl rollout undo deployment/myapp

    # View rollout history
    kubectl rollout history deployment/myapp
    ```

=== "Horizontal Pod Autoscaler"
    ```yaml
    # kubernetes/hpa.yaml
    apiVersion: autoscaling/v2
    kind: HorizontalPodAutoscaler
    metadata:
      name: myapp-hpa
    spec:
      scaleTargetRef:
        apiVersion: apps/v1
        kind: Deployment
        name: myapp
      minReplicas: 2
      maxReplicas: 20
      metrics:
        - type: Resource
          resource:
            name: cpu
            target:
              type: Utilization
              averageUtilization: 70    # scale up when avg CPU > 70%
        - type: Resource
          resource:
            name: memory
            target:
              type: Utilization
              averageUtilization: 80
    ```

---

## 5. Load Balancing Algorithms

```python
# Pure-Python simulation of common load-balancing algorithms.

class RoundRobinBalancer:
    """Distribute requests evenly across workers in rotation."""
    def __init__(self, workers: int):
        self.workers = workers
        self._next = 0
        self.counts = [0] * workers

    def route(self) -> int:
        worker = self._next % self.workers
        self.counts[worker] += 1
        self._next += 1
        return worker

class LeastConnectionsBalancer:
    """Route each request to the worker with fewest active connections."""
    def __init__(self, workers: int):
        self.workers = workers
        self.active = [0] * workers

    def route(self) -> int:
        worker = self.active.index(min(self.active))
        self.active[worker] += 1
        return worker

    def done(self, worker: int):
        self.active[worker] = max(0, self.active[worker] - 1)

# Demonstrate round-robin distribution
balancer = RoundRobinBalancer(workers=3)
for i in range(9):
    w = balancer.route()
    print(f"Request {i+1} → Worker {w}")

print(f"\nDistribution: {balancer.counts}")
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate load balancing — distribute N requests across M workers using round-robin

def round_robin(num_requests: int, num_workers: int) -> list:
    """Return request counts per worker after round-robin distribution."""
    counts = [0] * num_workers
    for i in range(num_requests):
        counts[i % num_workers] += 1
    return counts

# Test different request/worker configurations
for requests, workers in [(9, 3), (7, 3), (10, 4), (13, 5)]:
    dist = round_robin(requests, workers)
    print(f"{requests} requests / {workers} workers → {dist} (total={sum(dist)})")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Round-Robin Distribution

Distribute 7 requests across 3 workers using round-robin. Print the request counts per worker as a list.

Expected output:
```
[3, 2, 2]
```

<div class="pyodide-runner" data-mode="challenge" data-expected="[3, 2, 2]">
<pre><code class="language-python">def round_robin(num_requests: int, num_workers: int) -> list:
    counts = [0] * num_workers
    for i in range(num_requests):
        counts[i % num_workers] += 1
    return counts

# Distribute 7 requests across 3 workers and print the result
</code></pre>
</div>

---

### Challenge 2 — Worker Capacity Planning

Compute the minimum number of workers required to handle 1000 requests/second if each worker can handle 250 requests/second.

Expected output:
```
4
```

<div class="pyodide-runner" data-mode="challenge" data-expected="4">
<pre><code class="language-python">import math

total_rps = 1000
worker_capacity_rps = 250

# Compute and print the minimum number of workers needed
</code></pre>
</div>

---

## 📚 Further Reading

- [Gunicorn Documentation — Workers](https://docs.gunicorn.org/en/stable/design.html)
- [Kubernetes Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Nginx Reverse Proxy for Python — DigitalOcean](https://www.digitalocean.com/community/tutorials/how-to-serve-flask-applications-with-gunicorn-and-nginx-on-ubuntu-22-04)

---

[⬅️ Lesson 96 · Health Check & Status Endpoints](96-health-check-endpoints.md){ .md-button } [➡️ Lesson 98 · End-to-End Web Application](98-end-to-end-webapp.md){ .md-button .md-button--primary }
