---
title: "Lesson 12 · Connecting Flask to SQLite"
description: "Learn how to integrate SQLite databases with Flask using the built-in sqlite3 module, application contexts, and parameterized SQL queries."
---

# Lesson 12 · Connecting Flask to SQLite

> **Section:** 🗄️ Databases, ORMs & Auth &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Explain how SQLite operates as a serverless, file-based relational database
- [ ] Connect to SQLite using Python's built-in `sqlite3` standard library module
- [ ] Manage per-request database connections cleanly using Flask's `g` object and `teardown_appcontext`
- [ ] Execute parameterized queries (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) safely to prevent SQL injection
- [ ] Map database rows to JSON-serializable Python dictionaries using `sqlite3.Row`

---

## 📖 Introduction

In-memory data vanishes whenever your application server restarts. To build production-grade web applications, you need persistent storage. **SQLite** is a lightweight, zero-configuration SQL database engine built directly into Python through the standard `sqlite3` module.

SQLite stores entire relational databases in a single standalone file on disk, making it the ideal database for development, prototyping, and lightweight production applications.

---

## 1. Getting Started with Python's `sqlite3`

Because `sqlite3` is part of Python's standard library, no external package installation is necessary.

=== "Python"
```python
import sqlite3

# Connect to a file database (or ":memory:" for a temporary database)
conn = sqlite3.connect("app.db")
cursor = conn.cursor()

# Create table
cursor.execute("""
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    age INTEGER
)
""")

# Insert row with parameterized placeholders (? prevents SQL Injection)
cursor.execute(
    "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
    ("Alice Smith", "alice@example.com", 28)
)
conn.commit()

# Query rows
cursor.execute("SELECT id, name, email, age FROM users")
rows = cursor.fetchall()
for row in rows:
    print(row)

conn.close()
```

=== "Output"
```
(1, 'Alice Smith', 'alice@example.com', 28)
```

!!! warning "Always Use Parameterized Queries"
    Never format SQL using Python string interpolation (`f"SELECT * FROM users WHERE name = '{name}'"`). String formatting exposes your API to **SQL Injection attacks**. Always pass values as tuple arguments using `?` placeholders.

---

## 2. Managing Connections with Flask `g` and `teardown_appcontext`

Opening a new database connection for every function and failing to close it leads to connection leaks. Flask provides the `g` object (a thread-safe global namespace for the current request) and `teardown_appcontext` to manage connection lifecycles automatically.

=== "Python (`db.py`)"
```python
import sqlite3
from flask import g, current_app

DATABASE = "database.db"

def get_db():
    """Open a new database connection if there is none yet for the current application context."""
    if "db" not in g:
        g.db = sqlite3.connect(
            DATABASE,
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        # Enable column name access: row["name"] instead of row[0]
        g.db.row_factory = sqlite3.Row
    return g.db

def close_db(e=None):
    """Close the database connection at the end of the request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db():
    """Create initial tables."""
    db = get_db()
    db.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        age INTEGER NOT NULL
    )
    """)
    db.commit()
```

---

## 3. Building Users CRUD with Flask & SQLite

Here is how to combine connection helpers with Flask routes for complete database-backed CRUD functionality:

=== "Python (`app.py`)"
```python
from flask import Flask, jsonify, request, abort
import sqlite3
from db import get_db, close_db, init_db

app = Flask(__name__)
app.teardown_appcontext(close_db)

# Helper function to convert sqlite3.Row to dict
def dict_from_row(row):
    return dict(row) if row else None

# READ ALL
@app.route("/users", methods=["GET"])
def list_users():
    db = get_db()
    cursor = db.execute("SELECT id, name, email, age FROM users")
    users = [dict(row) for row in cursor.fetchall()]
    return jsonify(users), 200

# READ ONE
@app.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    db = get_db()
    row = db.execute("SELECT id, name, email, age FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        abort(404, description=f"User {user_id} not found")
    return jsonify(dict(row)), 200

# CREATE
@app.route("/users", methods=["POST"])
def create_user():
    data = request.get_json() or {}
    if not all(k in data for k in ("name", "email", "age")):
        abort(400, description="name, email, and age are required")
    
    db = get_db()
    try:
        cursor = db.execute(
            "INSERT INTO users (name, email, age) VALUES (?, ?, ?)",
            (data["name"], data["email"], data["age"])
        )
        db.commit()
        new_id = cursor.lastrowid
        return jsonify({"id": new_id, "name": data["name"], "email": data["email"], "age": data["age"]}), 201
    except sqlite3.IntegrityError:
        abort(409, description="Email already exists")

# UPDATE
@app.route("/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    data = request.get_json() or {}
    db = get_db()
    cursor = db.execute(
        "UPDATE users SET name = ?, age = ? WHERE id = ?",
        (data.get("name"), data.get("age"), user_id)
    )
    db.commit()
    if cursor.rowcount == 0:
        abort(404, description=f"User {user_id} not found")
    return jsonify({"message": "User updated successfully"}), 200

# DELETE
@app.route("/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    db = get_db()
    cursor = db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    if cursor.rowcount == 0:
        abort(404, description=f"User {user_id} not found")
    return "", 204

if __name__ == "__main__":
    with app.app_context():
        init_db()
    app.run(debug=True)
```

=== "Output"
```json
// Example GET /users
[
  {
    "age": 28,
    "email": "alice@example.com",
    "id": 1,
    "name": "Alice Smith"
  }
]
```

!!! tip "row_factory = sqlite3.Row"
    Setting `conn.row_factory = sqlite3.Row` makes cursor results behave like mapping dictionaries, allowing both key-based indexing (`row["name"]`) and conversion to dicts (`dict(row)`).

---

## 4. Initializing Database from SQL Scripts

For complex initial schemas, keep your SQL in a separate file (e.g. `schema.sql`) and load it during startup:

=== "SQL (`schema.sql`)"
```sql
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    age INTEGER NOT NULL
);

INSERT INTO users (name, email, age) VALUES
    ('Alice Smith', 'alice@example.com', 28),
    ('Bob Jones', 'bob@example.com', 22),
    ('Carol White', 'carol@example.com', 31);
```

=== "Python CLI Command"
```python
def init_db_from_file():
    db = get_db()
    with current_app.open_resource("schema.sql", mode="r") as f:
        db.cursor().executescript(f.read())
    db.commit()
```

---

## 💻 Try It Yourself

Execute SQLite queries using an in-memory database instance directly in the browser runner:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import sqlite3

# Create an in-memory SQLite database
conn = sqlite3.connect(":memory:")
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

# Set up schema and seed records
cursor.execute("""
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER NOT NULL
)
""")

users_to_add = [
    ("Alice", 28),
    ("Bob", 22),
    ("Carol", 31)
]
cursor.executemany("INSERT INTO users (name, age) VALUES (?, ?)", users_to_add)
conn.commit()

# Query all records
cursor.execute("SELECT id, name, age FROM users ORDER BY age DESC")
for row in cursor.fetchall():
    print(f"User #{row['id']}: {row['name']} ({row['age']} yrs)")

conn.close()
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count Users in Database

Write a SQL query using `SELECT COUNT(*) FROM users` on the in-memory SQLite database below, fetch the result, and print only the count integer.

Expected output:
```
3
```

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">import sqlite3

conn = sqlite3.connect(":memory:")
cursor = conn.cursor()
cursor.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)")
cursor.executemany("INSERT INTO users VALUES (?, ?, ?)", [
    (1, "Alice", 28),
    (2, "Bob", 22),
    (3, "Carol", 31)
])
conn.commit()

# Execute count query and print total count
cursor.execute("SELECT COUNT(*) FROM users")
count = cursor.fetchone()[0]
print(count)
</code></pre>
</div>

---

### Challenge 2 — Query Users Older Than 25

Query the users table for all users with `age > 25`, ordered by `id ASC`, and print each user's name on a new line.

Expected output:
```
Alice
Carol
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Alice
Carol">
<pre><code class="language-python">import sqlite3

conn = sqlite3.connect(":memory:")
cursor = conn.cursor()
cursor.execute("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, age INTEGER)")
cursor.executemany("INSERT INTO users VALUES (?, ?, ?)", [
    (1, "Alice", 28),
    (2, "Bob", 22),
    (3, "Carol", 31)
])
conn.commit()

# Select users with age > 25 ordered by id and print their names
cursor.execute("SELECT name FROM users WHERE age > 25 ORDER BY id ASC")
for row in cursor.fetchall():
    print(row[0])
</code></pre>
</div>

---

## 📚 Further Reading

- [Python `sqlite3` Standard Library Documentation](https://docs.python.org/3/library/sqlite3.html)
- [Flask SQLite Database Tutorial Pattern](https://flask.palletsprojects.com/en/latest/tutorial/database/)
- [SQL Injection Prevention Cheat Sheet (OWASP)](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

---

!!! success "Lesson Complete 🎉"
    You've connected Flask to a persistent SQLite database with safe query parameters and connection pooling conventions. Next, let's explore Object-Relational Mapping (ORM) with SQLAlchemy!

[⬅️ Lesson 11 · Flask CRUD App](11-flask-crud-app.md){ .md-button } [➡️ Lesson 13 · Introduction to SQLAlchemy](13-intro-to-sqlalchemy.md){ .md-button .md-button--primary }
