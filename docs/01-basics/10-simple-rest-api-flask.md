---
title: "Lesson 10 · Simple REST API with Flask"
description: "Build your first REST API using Flask — routes, JSON responses, request data, status codes, and running a dev server."
---

# Lesson 10 · Simple REST API with Flask

> **Section:** 🧱 Python Basics &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Install Flask and create a minimal app
- [ ] Define routes with `@app.route()` for different HTTP methods
- [ ] Return JSON responses with `jsonify()`
- [ ] Read path parameters and query strings from requests
- [ ] Return correct HTTP status codes
- [ ] Test your API with `curl` or a REST client

---

## 📖 Introduction

**Flask** is a lightweight Python web framework. It's the fastest way to turn your Python knowledge into a working HTTP API. In this lesson you'll build a simple in-memory to-do list API with full CRUD operations.

Install: `pip install flask`

---

## 1. Minimal Flask App

```python
# app.py
from flask import Flask

app = Flask(__name__)

@app.route("/")
def index():
    return {"message": "Hello from Flask!"}

if __name__ == "__main__":
    app.run(debug=True)
```

Run it:
```bash
python app.py
# * Running on http://127.0.0.1:5000
```

Visit `http://127.0.0.1:5000/` — you'll see the JSON response in your browser.

---

## 2. Routes and HTTP Methods

```python
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route("/hello", methods=["GET"])
def hello():
    return jsonify({"message": "Hello, World!"})

@app.route("/hello/<name>", methods=["GET"])
def hello_name(name):
    return jsonify({"message": f"Hello, {name}!"})

@app.route("/echo", methods=["POST"])
def echo():
    data = request.get_json()       # parse JSON body
    return jsonify({"you_sent": data}), 201
```

!!! tip "`jsonify()` vs returning a dict"
    In Flask 2+, returning a plain dict or list from a route function auto-converts to JSON.
    `jsonify()` is still preferred because it lets you set status codes and headers explicitly.

---

## 3. Building a CRUD In-Memory API

Let's build a to-do list API. All data lives in a Python list (no database yet — that's Section 2).

```python
from flask import Flask, jsonify, request, abort

app = Flask(__name__)

# In-memory store
todos = [
    {"id": 1, "title": "Learn Python",  "done": True},
    {"id": 2, "title": "Build an API",  "done": False},
    {"id": 3, "title": "Write tests",   "done": False},
]
next_id = 4

def find_todo(todo_id):
    return next((t for t in todos if t["id"] == todo_id), None)


# ── GET all ──────────────────────────────────────────────────
@app.route("/todos", methods=["GET"])
def get_todos():
    done_filter = request.args.get("done")     # ?done=true
    if done_filter is not None:
        flag = done_filter.lower() == "true"
        return jsonify([t for t in todos if t["done"] == flag])
    return jsonify(todos)


# ── GET one ──────────────────────────────────────────────────
@app.route("/todos/<int:todo_id>", methods=["GET"])
def get_todo(todo_id):
    todo = find_todo(todo_id)
    if todo is None:
        abort(404, description=f"Todo {todo_id} not found")
    return jsonify(todo)


# ── POST (create) ─────────────────────────────────────────────
@app.route("/todos", methods=["POST"])
def create_todo():
    global next_id
    data = request.get_json()
    if not data or "title" not in data:
        abort(400, description="'title' field is required")
    new_todo = {"id": next_id, "title": data["title"], "done": False}
    todos.append(new_todo)
    next_id += 1
    return jsonify(new_todo), 201


# ── PATCH (update) ────────────────────────────────────────────
@app.route("/todos/<int:todo_id>", methods=["PATCH"])
def update_todo(todo_id):
    todo = find_todo(todo_id)
    if todo is None:
        abort(404)
    data = request.get_json() or {}
    if "title" in data:
        todo["title"] = data["title"]
    if "done" in data:
        todo["done"] = bool(data["done"])
    return jsonify(todo)


# ── DELETE ────────────────────────────────────────────────────
@app.route("/todos/<int:todo_id>", methods=["DELETE"])
def delete_todo(todo_id):
    todo = find_todo(todo_id)
    if todo is None:
        abort(404)
    todos.remove(todo)
    return "", 204


# ── Error handlers ────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": str(e)}), 404

@app.errorhandler(400)
def bad_request(e):
    return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(debug=True)
```

---

## 4. Testing with `curl`

```bash
# Get all todos
curl http://localhost:5000/todos

# Get todos where done=false
curl "http://localhost:5000/todos?done=false"

# Get one todo
curl http://localhost:5000/todos/1

# Create a new todo
curl -X POST http://localhost:5000/todos \
     -H "Content-Type: application/json" \
     -d '{"title": "Deploy to production"}'

# Mark todo 2 as done
curl -X PATCH http://localhost:5000/todos/2 \
     -H "Content-Type: application/json" \
     -d '{"done": true}'

# Delete todo 3
curl -X DELETE http://localhost:5000/todos/3
```

---

## 5. Project Structure

A clean Flask project follows this layout:

```
my-api/
├── app.py          ← application factory & entry point
├── routes/
│   ├── __init__.py
│   └── todos.py    ← route handlers in Blueprints
├── models/
│   └── todo.py     ← data classes / ORM models
├── requirements.txt
└── README.md
```

We'll expand this structure in Section 2 when we add a database.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate the Flask in-memory CRUD logic without running a server

todos = [
    {"id": 1, "title": "Learn Python",  "done": True},
    {"id": 2, "title": "Build an API",  "done": False},
]

def get_todos(done=None):
    if done is None:
        return todos
    return [t for t in todos if t["done"] == done]

def create_todo(title):
    new_id = max(t["id"] for t in todos) + 1
    todo = {"id": new_id, "title": title, "done": False}
    todos.append(todo)
    return todo

print("All todos:")
for t in get_todos():
    status = "✅" if t["done"] else "⬜"
    print(f"  {status} [{t['id']}] {t['title']}")

created = create_todo("Write unit tests")
print(f"\nCreated: {created}")

print("\nPending todos:")
for t in get_todos(done=False):
    print(f"  ⬜ [{t['id']}] {t['title']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Route Logic

Simulate a GET route: given the list of todos below, filter and print only todos where `done` is `False`. Each on its own line in format `ID: title`.

Expected output:
```
2: Build an API
3: Write tests
```

<div class="pyodide-runner" data-mode="challenge" data-expected="2: Build an API
3: Write tests">
<pre><code class="language-python">todos = [
    {"id": 1, "title": "Learn Python",  "done": True},
    {"id": 2, "title": "Build an API",  "done": False},
    {"id": 3, "title": "Write tests",   "done": False},
]

# Print pending todos in format "ID: title"
</code></pre>
</div>

---

## 📚 Further Reading

- [Flask Quickstart (flask.palletsprojects.com)](https://flask.palletsprojects.com/en/latest/quickstart/)
- [Flask Tutorial — Real Python](https://realpython.com/flask-by-example-part-1-project-setup/)
- [REST API Design Best Practices](https://realpython.com/api-integration-in-python/)

---

!!! success "Section 1 Complete! 🐍🎉"
    You've completed the entire **Python Basics** section. You can now write structured Python code, handle errors, read/write files, and build a working REST API. Time to add a database!

[⬅️ Lesson 9 · HTTP & Requests](09-http-and-requests.md){ .md-button } [➡️ Section 2 · Lesson 11 · Flask CRUD App](../02-databases/11-flask-crud-app.md){ .md-button .md-button--primary }
