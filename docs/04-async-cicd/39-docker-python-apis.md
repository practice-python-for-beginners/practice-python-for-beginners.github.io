---
title: "Lesson 39 · Docker for Python APIs"
description: "Containerize your Python APIs with Docker: write a Dockerfile, understand image layers, use .dockerignore, build multi-stage images, and orchestrate Flask+Redis with docker-compose."
---

# Lesson 39 · Docker for Python APIs

> **Section:** ⚡ Async, CI/CD, Docker &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain the difference between Docker images and containers
- [ ] Write a `Dockerfile` for a Python API (`FROM`, `WORKDIR`, `COPY`, `RUN`, `CMD`)
- [ ] Create a `.dockerignore` to keep images small
- [ ] Build and run a Docker image with `docker build` and `docker run`
- [ ] Understand how layer caching speeds up rebuilds
- [ ] Write a multi-stage Dockerfile to separate build from runtime
- [ ] Orchestrate Flask + Redis with `docker-compose.yml`

---

## 📖 Introduction

"It works on my machine" is a joke until it's production at 3 AM. **Docker** solves this by packaging your application with all its dependencies into a **container** — a lightweight, isolated environment that runs identically everywhere.

For Python APIs, Docker means: no more conflicting package versions, instant scaling, and reproducible deployments.

!!! info "Image vs Container"
    An **image** is a read-only snapshot — like a class definition. A **container** is a running instance of that image — like an object. You can run many containers from one image.

---

## 1. Docker Core Concepts

| Concept | Description |
|---------|-------------|
| **Image** | Read-only template built from a `Dockerfile` |
| **Container** | Running instance of an image |
| **Layer** | Each Dockerfile instruction adds a cached layer |
| **Registry** | Image storage — Docker Hub, GHCR, ECR |
| **Dockerfile** | Blueprint that describes how to build an image |
| **docker-compose** | Orchestrate multiple containers as one service |

=== "Python"
    ```bash
    # Common Docker commands
    docker build -t myapp:latest .        # build from Dockerfile in current dir
    docker run -p 5000:5000 myapp:latest  # run container, map port 5000
    docker ps                             # list running containers
    docker ps -a                          # list all containers (incl. stopped)
    docker logs <container_id>            # view container output
    docker exec -it <id> /bin/bash        # open shell inside container
    docker stop <container_id>            # stop a running container
    docker rm <container_id>              # delete a stopped container
    docker rmi myapp:latest               # delete an image
    ```
=== "Output"
    ```
    $ docker ps
    CONTAINER ID  IMAGE          COMMAND               PORTS                  STATUS
    a3f2b1c9d4e5  myapp:latest   "gunicorn app:app"   0.0.0.0:5000->5000/tcp  Up 2 hours
    ```

---

## 2. Writing a `Dockerfile` for a Python API

The `Dockerfile` lives at the root of your project. Each instruction creates a new **layer**:

=== "Python"
    ```dockerfile
    # Dockerfile

    # 1. Base image — official Python slim (smaller than full)
    FROM python:3.11-slim

    # 2. Set working directory inside the container
    WORKDIR /app

    # 3. Copy only requirements first (better layer caching)
    COPY requirements.txt .

    # 4. Install dependencies
    RUN pip install --no-cache-dir -r requirements.txt

    # 5. Copy the rest of the application code
    COPY . .

    # 6. Expose the port the app runs on (documentation only)
    EXPOSE 5000

    # 7. Set environment variables
    ENV FLASK_ENV=production \
        PYTHONDONTWRITEBYTECODE=1 \
        PYTHONUNBUFFERED=1

    # 8. Start command (overridable at runtime)
    CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]
    ```
=== "Output"
    ```
    $ docker build -t myflaskapp:latest .
    [1/5] FROM python:3.11-slim
    [2/5] WORKDIR /app
    [3/5] COPY requirements.txt .
    [4/5] RUN pip install --no-cache-dir -r requirements.txt
    [5/5] COPY . .
    Successfully built a1b2c3d4e5f6
    Successfully tagged myflaskapp:latest
    ```

!!! tip "Copy requirements.txt before code"
    Layer caching means if `requirements.txt` hasn't changed, Docker reuses the cached `pip install` layer. Copying code after dependencies means code changes don't trigger a reinstall.

---

## 3. `.dockerignore` — Keep Images Small

Like `.gitignore`, `.dockerignore` prevents unnecessary files from entering the image:

=== "Python"
    ```
    # .dockerignore

    # Version control
    .git
    .gitignore

    # Python artifacts
    __pycache__/
    *.pyc
    *.pyo
    *.pyd
    .Python
    *.egg-info/
    dist/
    build/

    # Virtual environments
    venv/
    .venv/
    env/

    # Testing
    .pytest_cache/
    .coverage
    htmlcov/
    tests/

    # Development files
    .env
    .env.local
    *.log
    Dockerfile
    docker-compose.yml
    README.md
    docs/
    ```
=== "Output"
    ```
    # Without .dockerignore: image size 1.2 GB
    # With .dockerignore:    image size 180 MB  ← 85% smaller
    ```

!!! warning "Never include `.env` in your image"
    Secrets baked into a Docker image are a serious security risk — they appear in `docker history` and can be extracted. Always pass secrets via environment variables at runtime.

---

## 4. Multi-Stage Builds

Multi-stage builds separate the *build environment* (with compilers and dev tools) from the *runtime environment* (lean, production-only):

=== "Python"
    ```dockerfile
    # Multi-stage Dockerfile

    # ---- Stage 1: Build ----
    FROM python:3.11 AS builder

    WORKDIR /app
    COPY requirements.txt .

    # Install to a local directory (no system install)
    RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

    # ---- Stage 2: Runtime ----
    FROM python:3.11-slim AS runtime

    WORKDIR /app

    # Copy only installed packages from builder
    COPY --from=builder /install /usr/local

    # Copy application code
    COPY app/ ./app/
    COPY gunicorn.conf.py .

    ENV PYTHONUNBUFFERED=1

    EXPOSE 8000
    CMD ["gunicorn", "-c", "gunicorn.conf.py", "app.main:app"]
    ```
=== "Output"
    ```
    # Single-stage build: 920 MB  (includes gcc, headers, etc.)
    # Multi-stage build:  145 MB  ← 84% smaller!

    $ docker images
    REPOSITORY  TAG      SIZE
    myapp       latest   145MB
    ```

!!! note "Multi-stage is the production standard"
    Build tools like `gcc`, `rustc`, and header files are needed to compile Python extensions but shouldn't ship in production. Multi-stage builds remove them automatically.

---

## 5. `docker-compose.yml` — Flask + Redis

`docker-compose` defines and runs multi-container applications with one command:

=== "Python"
    ```yaml
    # docker-compose.yml

    version: "3.9"

    services:
      web:
        build: .
        ports:
          - "5000:5000"
        environment:
          - FLASK_ENV=development
          - REDIS_URL=redis://redis:6379/0
          - DATABASE_URL=postgresql://user:pass@db:5432/mydb
        depends_on:
          - redis
          - db
        volumes:
          - .:/app   # mount code for development hot-reload

      redis:
        image: redis:7-alpine
        ports:
          - "6379:6379"
        volumes:
          - redis_data:/data

      db:
        image: postgres:15-alpine
        environment:
          POSTGRES_USER: user
          POSTGRES_PASSWORD: pass
          POSTGRES_DB: mydb
        volumes:
          - postgres_data:/var/lib/postgresql/data

    volumes:
      redis_data:
      postgres_data:
    ```
=== "Output"
    ```
    $ docker-compose up
    Creating network "myapp_default" with the default driver
    Creating myapp_redis_1 ... done
    Creating myapp_db_1    ... done
    Creating myapp_web_1   ... done

    myapp_web_1    | [INFO] Starting gunicorn on 0.0.0.0:5000
    myapp_redis_1  | * Ready to accept connections
    myapp_db_1     | LOG: database system is ready to accept connections
    ```

---

## 💻 Try It Yourself

Simulate Docker's layer-by-layer build process in Python — each "instruction" prints its step, just like a real `docker build`.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import time

# Simulate a Dockerfile
dockerfile = [
    ("FROM",     "python:3.11-slim",                 "Pulling base image..."),
    ("WORKDIR",  "/app",                              "Setting working directory"),
    ("COPY",     "requirements.txt .",               "Copying requirements.txt"),
    ("RUN",      "pip install -r requirements.txt",  "Installing 12 packages..."),
    ("COPY",     ". .",                               "Copying application code"),
    ("EXPOSE",   "5000",                              "Exposing port 5000"),
    ("CMD",      "gunicorn app:app",                  "Setting start command"),
]

print("=== Building Docker image: myflaskapp:latest ===\n")
cached_layers = {"FROM python:3.11-slim", "pip install -r requirements.txt"}

for step, (instruction, arg, description) in enumerate(dockerfile, 1):
    total = len(dockerfile)
    tag = arg if instruction != "RUN" else arg

    if tag in cached_layers:
        status = "CACHED"
    else:
        status = "DONE"

    print(f"Step {step}/{total}: {instruction} {arg}")
    print(f"  ---> {description}")
    print(f"  ---> [{status}]\n")

print("Successfully built a1b2c3d4e5f6")
print("Successfully tagged myflaskapp:latest")

run_instructions = [i for i, _, _ in dockerfile if i == "RUN"]
print(f"\nTotal RUN instructions: {len(run_instructions)}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count RUN Commands

Given a list of Dockerfile instructions, count how many are `RUN` commands.

Expected output:
```
2
```

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">dockerfile_instructions = [
    "FROM python:3.11-slim",
    "WORKDIR /app",
    "COPY requirements.txt .",
    "RUN pip install --no-cache-dir -r requirements.txt",
    "COPY . .",
    "RUN adduser --disabled-password appuser",
    "EXPOSE 5000",
    "CMD gunicorn app:app",
]

run_count = sum(1 for line in dockerfile_instructions if line.startswith("RUN"))
print(run_count)
</code></pre>
</div>

---

### Challenge 2 — Find Host Port

Given a docker-compose ports config dictionary, print the host port for the `"web"` service.

Expected output:
```
5000
```

<div class="pyodide-runner" data-mode="challenge" data-expected="5000">
<pre><code class="language-python">services = {
    "web": {
        "image": "myapp:latest",
        "ports": ["5000:5000"],   # "host_port:container_port"
    },
    "redis": {
        "image": "redis:alpine",
        "ports": ["6379:6379"],
    },
    "db": {
        "image": "postgres:15",
        "ports": ["5432:5432"],
    },
}

web_ports = services["web"]["ports"][0]       # "5000:5000"
host_port = web_ports.split(":")[0]           # "5000"
print(host_port)
</code></pre>
</div>

---

## 📚 Further Reading

- [Docker Official Python Guide](https://docs.docker.com/language/python/)
- [Docker Compose — Getting Started](https://docs.docker.com/compose/gettingstarted/)
- [Best Practices for Python Dockerfiles (Snyk)](https://snyk.io/blog/best-practices-containerizing-python-docker/)

---

!!! success "Lesson Complete 🎉"
    You can now write production-quality Dockerfiles, use multi-stage builds, create `.dockerignore`,
    and orchestrate Flask + Redis + Postgres with docker-compose. Ship anywhere!

[⬅️ Lesson 38 · CI with GitHub Actions](38-ci-github-actions.md){ .md-button }
[➡️ Lesson 40 · Deploying Flask/FastAPI on Cloud](40-deploying-flask-fastapi.md){ .md-button .md-button--primary }
