---
title: "Lesson 53 · FastAPI with JavaScript Frontend"
description: "Set up CORS in FastAPI, serve a static SPA, exchange JSON with fetch(), and understand CSRF considerations for JS-driven frontends."
---

# Lesson 53 · FastAPI with JavaScript Frontend

> **Section:** 🖥️ Frontend Integrations &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

- [ ] Enable CORS in FastAPI with `CORSMiddleware`
- [ ] Serve a static Single Page Application via `StaticFiles`
- [ ] Use `fetch()` in JavaScript to call FastAPI endpoints
- [ ] Exchange typed JSON with Pydantic request/response models
- [ ] Understand CSRF risks and mitigations for JS frontends
- [ ] Build a minimal SPA that reads from a `/api/` prefix

---

## 📖 Introduction

FastAPI excels as a JSON backend. Pairing it with a lightweight JavaScript frontend — plain JS, Vue, or React — gives you a modern SPA architecture with full Python on the server. The critical enabler is **CORS** (Cross-Origin Resource Sharing), which controls which browser origins may call your API.

---

## 1. CORS Setup in FastAPI

=== "Middleware"
    ```python
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000",   # dev React / Vue
                        "https://myapp.example.com"],  # production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    ```

=== "CORS header table"
    | Header | What it does |
    |--------|-------------|
    | `Access-Control-Allow-Origin` | Permitted origin(s) |
    | `Access-Control-Allow-Methods` | GET, POST, … |
    | `Access-Control-Allow-Headers` | Content-Type, Authorization, … |
    | `Access-Control-Allow-Credentials` | Allow cookies / auth headers |

=== "Preflight flow"
    ```
    Browser                     FastAPI
      |-- OPTIONS /api/users -------> |
      |<-- 200 + CORS headers -------|
      |-- GET  /api/users  --------> |
      |<-- 200 JSON response --------|
    ```

!!! warning "Never use `allow_origins=['*']` with `allow_credentials=True`"
    Browsers reject that combination. Use explicit origins when cookies or auth headers are involved.

---

## 2. Serving Static Files

=== "StaticFiles mount"
    ```python
    from fastapi.staticfiles import StaticFiles

    # Mount the React/Vue build directory at /
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")

    # API routes must be registered BEFORE the static mount
    @app.get("/api/health")
    def health():
        return {"status": "ok"}
    ```

=== "Project layout"
    ```
    project/
    ├── main.py           # FastAPI app
    ├── frontend/
    │   └── dist/         # built SPA (npm run build)
    │       ├── index.html
    │       └── assets/
    └── routers/
        └── users.py
    ```

!!! tip "Register API routes first"
    FastAPI matches routes in registration order. If you mount `/` first, the `StaticFiles` handler will capture every request — including your `/api/…` routes.

---

## 3. fetch() from JavaScript to FastAPI

=== "GET request"
    ```js
    // Fetch a list of users
    async function loadUsers() {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const users = await res.json();
      users.forEach(u => console.log(u.name));
    }
    loadUsers();
    ```

=== "POST with JSON body"
    ```js
    async function createUser(name, email) {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const created = await res.json();
      console.log("Created:", created.id);
    }
    ```

=== "FastAPI side"
    ```python
    from fastapi import FastAPI
    from pydantic import BaseModel
    from typing import List

    class User(BaseModel):
        id: int
        name: str
        email: str

    fake_db: List[User] = [
        User(id=1, name="Alice", email="alice@example.com"),
        User(id=2, name="Bob",   email="bob@example.com"),
    ]

    @app.get("/api/users", response_model=List[User])
    def list_users():
        return fake_db

    @app.post("/api/users", response_model=User, status_code=201)
    def create_user(user: User):
        fake_db.append(user)
        return user
    ```

---

## 4. Building a Minimal SPA

=== "index.html"
    ```html
    <!DOCTYPE html>
    <html>
    <head><title>Users</title></head>
    <body>
      <h1>Users</h1>
      <ul id="user-list"></ul>
      <script>
        fetch("/api/users")
          .then(r => r.json())
          .then(users => {
            const ul = document.getElementById("user-list");
            users.forEach(u => {
              const li = document.createElement("li");
              li.textContent = `${u.id} — ${u.name}`;
              ul.appendChild(li);
            });
          });
      </script>
    </body>
    </html>
    ```

=== "Environment variable"
    ```js
    // .env (Create React App)
    REACT_APP_API_URL=http://localhost:8000

    // Usage in JS
    const API = process.env.REACT_APP_API_URL;
    const res = await fetch(`${API}/api/users`);
    ```

---

## 5. CSRF Considerations

=== "Why JS frontends are safer"
    ```
    Traditional form POST  → needs CSRF token (browser sends cookie automatically)
    fetch() with JSON body → browser won't auto-send a cross-origin JSON POST
                             → CSRF risk is lower for JSON APIs
    ```

=== "Still protect cookie auth"
    ```python
    # If you use cookie-based sessions, add a CSRF check:
    from fastapi import Header, HTTPException

    @app.post("/api/sensitive")
    def sensitive(x_csrf_token: str = Header(...)):
        if x_csrf_token != expected_token():
            raise HTTPException(status_code=403, detail="CSRF check failed")
    ```

| Auth method | CSRF risk | Mitigation |
|-------------|-----------|------------|
| JWT in `Authorization` header | Low | n/a |
| Cookie session | High | CSRF tokens or `SameSite=Strict` |
| API key in header | Low | n/a |

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate a fetch-like call in pure Python
import json

def mock_fetch(url: str, method: str = "GET", body: dict = None) -> dict:
    """Simulate an HTTP exchange without a real server."""
    db = [
        {"id": 1, "name": "Alice"},
        {"id": 2, "name": "Bob"},
        {"id": 3, "name": "Carol"},
    ]
    if url == "/api/users" and method == "GET":
        return {"status": 200, "data": db}
    if url == "/api/users" and method == "POST":
        new_user = {**body, "id": len(db) + 1}
        db.append(new_user)
        return {"status": 201, "data": new_user}
    return {"status": 404, "data": {"error": "not found"}}

response = mock_fetch("/api/users")
print(f"Status : {response['status']}")
print(f"Users  : {len(response['data'])}")
for user in response["data"]:
    print(f"  {user['id']}: {user['name']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count Users

Simulate a fetch to `/api/users`, parse the mock response, and print the count of users.

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">mock_response = {
    "status": 200,
    "data": [
        {"id": 1, "name": "Alice"},
        {"id": 2, "name": "Bob"},
        {"id": 3, "name": "Carol"},
    ]
}

# Parse the response and print the count of users
count = 0  # your code here

print(count)
</code></pre>
</div>

---

### Challenge 2 — Build a Query String

Build a URL query string from a dict and print it.

<div class="pyodide-runner" data-mode="challenge" data-expected="name=Alice&age=30">
<pre><code class="language-python">params = {"name": "Alice", "age": 30}

# Build "key=value&key=value" string from the dict
query_string = ""  # your code here

print(query_string)
</code></pre>
</div>

---

## 📚 Further Reading

- [FastAPI CORS documentation](https://fastapi.tiangolo.com/tutorial/cors/)
- [FastAPI StaticFiles](https://fastapi.tiangolo.com/tutorial/static-files/)
- [MDN — Using the Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)

---

!!! success "Lesson Complete 🎉"
    You can now wire a JavaScript frontend to FastAPI cleanly and securely. Next: build a data dashboard without any JavaScript at all — with Streamlit!

[⬅️ Lesson 52 · Building a Simple Flask Frontend](52-flask-frontend.md){ .md-button } [➡️ Lesson 54 · Streamlit Dashboard](54-streamlit-dashboard.md){ .md-button .md-button--primary }
