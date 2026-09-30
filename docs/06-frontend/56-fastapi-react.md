---
title: "Lesson 56 · FastAPI Dashboard with React"
description: "Architect a React + FastAPI application with CORS, useEffect data fetching, useState, a data table component, and deploying the React build as FastAPI static files."
---

# Lesson 56 · FastAPI Dashboard with React

> **Section:** 🖥️ Frontend Integrations &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~65 minutes

---

## 🎯 Learning Objectives

- [ ] Understand the React + FastAPI full-stack architecture
- [ ] Configure CORS correctly for React dev-server vs production
- [ ] Fetch data from FastAPI using `useEffect` and `useState`
- [ ] Build a reusable data table component
- [ ] Use `REACT_APP_API_URL` for environment-aware API calls
- [ ] Deploy the React build as FastAPI static files

---

## 📖 Introduction

React handles the view layer entirely in the browser; FastAPI handles data, business logic, and persistence on the server. The two halves communicate over a clean JSON API. This separation means you can replace either side independently and scale them differently.

---

## 1. Architecture Overview

=== "Request flow"
    ```
    Browser (React SPA)
        │
        │  fetch("/api/users")       ← same origin in production
        │  fetch("http://localhost:8000/api/users")  ← dev (CORS needed)
        ▼
    FastAPI (Python)
        │
        ├── /api/*  → JSON responses
        └── /*      → StaticFiles (React build)
    ```

=== "Project layout"
    ```
    project/
    ├── backend/
    │   ├── main.py
    │   └── routers/
    │       └── users.py
    └── frontend/
        ├── src/
        │   ├── App.jsx
        │   ├── components/
        │   │   └── DataTable.jsx
        │   └── index.js
        └── package.json
    ```

=== "CORS for dev"
    ```python
    from fastapi.middleware.cors import CORSMiddleware

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000"],  # React dev server
        allow_methods=["*"],
        allow_headers=["*"],
    )
    ```

---

## 2. FastAPI Data Endpoints

=== "Users router"
    ```python
    # routers/users.py
    from fastapi import APIRouter
    from pydantic import BaseModel
    from typing import List

    router = APIRouter(prefix="/api")

    class User(BaseModel):
        id: int
        name: str
        email: str
        active: bool = True

    USERS: List[User] = [
        User(id=1, name="Alice", email="alice@example.com", active=True),
        User(id=2, name="Bob",   email="bob@example.com",   active=False),
        User(id=3, name="Carol", email="carol@example.com", active=True),
        User(id=4, name="Dave",  email="dave@example.com",  active=True),
        User(id=5, name="Eve",   email="eve@example.com",   active=False),
    ]

    @router.get("/users", response_model=List[User])
    def list_users(active: bool | None = None):
        if active is not None:
            return [u for u in USERS if u.active == active]
        return USERS
    ```

=== "main.py"
    ```python
    from fastapi import FastAPI
    from fastapi.staticfiles import StaticFiles
    from routers.users import router

    app = FastAPI()
    app.include_router(router)  # /api/users — must come before static mount

    app.mount("/", StaticFiles(directory="frontend/build", html=True), name="spa")
    ```

---

## 3. React: useEffect & useState

=== "Fetching users"
    ```jsx
    import { useState, useEffect } from "react";

    const API = process.env.REACT_APP_API_URL || "";

    function UserList() {
      const [users, setUsers] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);

      useEffect(() => {
        fetch(`${API}/api/users`)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(data => { setUsers(data); setLoading(false); })
          .catch(err => { setError(err.message); setLoading(false); });
      }, []);  // [] = run once on mount

      if (loading) return <p>Loading…</p>;
      if (error)   return <p>Error: {error}</p>;
      return <DataTable rows={users} />;
    }
    ```

=== "useEffect timing"
    ```
    Component mounts
        └─► useEffect callback fires
                └─► fetch() → promise
                        └─► .then(setUsers)  → re-render with data
    ```

!!! tip "Empty dependency array `[]`"
    Pass an empty array as the second argument to run the effect only once (on mount). Omitting it runs on every render — that causes infinite loops with data-fetching effects.

---

## 4. DataTable Component

=== "DataTable.jsx"
    ```jsx
    export default function DataTable({ rows, columns }) {
      if (!rows.length) return <p>No data.</p>;

      // Auto-detect columns from first row if not provided
      const cols = columns || Object.keys(rows[0]);

      return (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {cols.map(c => (
                <th key={c} style={{ borderBottom: "2px solid #e5e7eb", padding: "0.5rem" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {cols.map(c => (
                  <td key={c} style={{ padding: "0.5rem", borderBottom: "1px solid #f0f0f0" }}>
                    {String(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    ```

=== "Usage"
    ```jsx
    <DataTable rows={users} columns={["id", "name", "email", "active"]} />
    ```

---

## 5. Deploying React Build as FastAPI Static Files

=== "Build and deploy"
    ```bash
    # 1. Build React
    cd frontend
    REACT_APP_API_URL="" npm run build   # empty = same-origin in prod

    # 2. Copy build output
    cp -r build ../backend/frontend/build

    # 3. Start FastAPI
    cd ../backend
    uvicorn main:app --host 0.0.0.0 --port 8000
    ```

=== "Dockerfile"
    ```dockerfile
    FROM node:20 AS frontend-build
    WORKDIR /app/frontend
    COPY frontend/package*.json ./
    RUN npm ci
    COPY frontend/ .
    RUN npm run build

    FROM python:3.12-slim
    WORKDIR /app
    COPY backend/ .
    COPY --from=frontend-build /app/frontend/build ./frontend/build
    RUN pip install -r requirements.txt
    CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
    ```

| Stage | Responsibility |
|-------|----------------|
| Node build | Transpile & bundle React → `build/` |
| Python runtime | Serve API + static files |

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate React state update cycle in pure Python
users_from_api = [
    {"id": 1, "name": "Alice", "active": True},
    {"id": 2, "name": "Bob",   "active": False},
    {"id": 3, "name": "Carol", "active": True},
    {"id": 4, "name": "Dave",  "active": True},
    {"id": 5, "name": "Eve",   "active": False},
]

# Simulate: setUsers(data)  then render
state = {"users": [], "loading": True}
state["users"] = users_from_api
state["loading"] = False

print(f"Loading: {state['loading']}")
print(f"Users in state: {len(state['users'])}")
for u in state["users"]:
    status = "✓" if u["active"] else "✗"
    print(f"  [{status}] {u['id']}: {u['name']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count Active Users

Simulate fetching 5 users and filtering to only `active=True`. Print the count.

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">api_response = [
    {"id": 1, "name": "Alice", "active": True},
    {"id": 2, "name": "Bob",   "active": False},
    {"id": 3, "name": "Carol", "active": True},
    {"id": 4, "name": "Dave",  "active": True},
    {"id": 5, "name": "Eve",   "active": False},
]

# Filter active users and print the count
active_count = 0  # your code here

print(active_count)
</code></pre>
</div>

---

### Challenge 2 — Sort Alphabetically

Sort the users by name alphabetically and print the first name.

<div class="pyodide-runner" data-mode="challenge" data-expected="Alice">
<pre><code class="language-python">users = [
    {"id": 3, "name": "Carol"},
    {"id": 1, "name": "Alice"},
    {"id": 2, "name": "Bob"},
]

# Sort by name and print the first name
sorted_users = []  # your code here

print(sorted_users[0]["name"])
</code></pre>
</div>

---

## 📚 Further Reading

- [React — useEffect](https://react.dev/reference/react/useEffect)
- [FastAPI — Bigger Applications](https://fastapi.tiangolo.com/tutorial/bigger-applications/)
- [Create React App — Environment Variables](https://create-react-app.dev/docs/adding-custom-environment-variables/)

---

!!! success "Lesson Complete 🎉"
    You can now architect, build, and deploy a full-stack React + FastAPI application. Next: wire up full CRUD operations from Flask HTML forms!

[⬅️ Lesson 55 · Flask Dashboard with Charts](55-flask-charts-dashboard.md){ .md-button } [➡️ Lesson 57 · Flask CRUD Frontend](57-flask-crud-frontend.md){ .md-button .md-button--primary }
