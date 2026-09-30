---
title: "Lesson 13 · Introduction to SQLAlchemy"
description: "Master Object-Relational Mapping (ORM) in Flask using Flask-SQLAlchemy — define models, query records, handle relationships, and manage transactions."
---

# Lesson 13 · Introduction to SQLAlchemy

> **Section:** 🗄️ Databases, ORMs & Auth &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Explain the concept of an Object-Relational Mapper (ORM) and its advantages over raw SQL
- [ ] Configure `Flask-SQLAlchemy` in a modern Flask application
- [ ] Define database tables as Python classes with `db.Model` and typed columns
- [ ] Perform full CRUD operations with `db.session.add()`, `db.session.commit()`, and query filters
- [ ] Model one-to-many database relationships using `db.relationship()` and foreign keys

---

## 📖 Introduction

While raw SQL queries work, writing raw string statements throughout your application codebase introduces repetitive boilerplate, parsing overhead, and database lock-in. 

An **Object-Relational Mapper (ORM)** bridges the gap between object-oriented Python code and relational database tables. With SQLAlchemy, tables become Python classes, rows become class instances, and queries become clean Python method calls.

Install: `pip install flask-sqlalchemy`

---

## 1. What is an ORM?

An ORM translates Python objects into SQL statements behind the scenes:

```
  Python Objects                SQLAlchemy ORM                 Relational DB
+----------------+          +--------------------+          +----------------+
|  User(name=    |  <====>  | Translates models, |  <====>  | users table:   |
|   "Alice")     |          | sessions & queries |          | id | name | age|
+----------------+          +--------------------+          +----------------+
```

Key advantages include:
- **Portability:** Switch between SQLite, PostgreSQL, and MySQL simply by changing the connection URL.
- **Productivity:** Autocompletion, type hinting, and reusable query logic.
- **Safety:** Automatic parameterization protects against SQL injection vulnerabilities.

---

## 2. Setting Up Flask-SQLAlchemy & Defining Models

=== "Python"
```python
from flask import Flask
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
# Database connection URI (sqlite:///project.db creates a file in the instance folder)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///app.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# Define Model (Table: users)
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    age = db.Column(db.Integer, nullable=False)

    # 1-to-many relationship with Post model
    posts = db.relationship("Post", backref="author", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email, "age": self.age}

# Define Child Model (Table: posts)
class Post(db.Model):
    __tablename__ = "posts"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

# Create tables in database
with app.app_context():
    db.create_all()
```

!!! tip "Database Migrations"
    In production applications, use `Flask-Migrate` (Alembic) to handle database schema changes instead of repeatedly calling `db.create_all()`.

---

## 3. CRUD Operations with SQLAlchemy Sessions

SQLAlchemy uses a unit-of-work pattern known as the **Session** (`db.session`) to track changes and commit transactions.

=== "Python"
```python
from flask import jsonify, request, abort

# CREATE (Insert)
@app.route("/users", methods=["POST"])
def create_user():
    data = request.get_json()
    new_user = User(name=data["name"], email=data["email"], age=data["age"])
    db.session.add(new_user)
    db.session.commit()
    return jsonify(new_user.to_dict()), 201

# READ ALL (Select)
@app.route("/users", methods=["GET"])
def get_users():
    # Filter by min_age if provided: /users?min_age=25
    min_age = request.args.get("min_age", type=int)
    if min_age is not None:
        users = User.query.filter(User.age >= min_age).order_by(User.name).all()
    else:
        users = User.query.order_by(User.id).all()
    return jsonify([u.to_dict() for u in users]), 200

# READ ONE
@app.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict()), 200

# UPDATE
@app.route("/users/<int:user_id>", methods=["PUT"])
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    user.name = data.get("name", user.name)
    user.age = data.get("age", user.age)
    db.session.commit()
    return jsonify(user.to_dict()), 200

# DELETE
@app.route("/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return "", 204
```

=== "Output"
```json
// Example User Dict
{
  "age": 28,
  "email": "alice@example.com",
  "id": 1,
  "name": "Alice"
}
```

---

## 4. Modeling One-to-Many Relationships

In relational modeling, parent rows often link to multiple child records (e.g., one User has many Posts).

=== "Python"
```python
# Creating user with related posts
user = User(name="Alice", email="alice@test.com", age=28)
post1 = Post(title="First Post", content="Hello world!", author=user)
post2 = Post(title="SQLAlchemy Guide", content="ORMs are awesome", author=user)

db.session.add(user)
db.session.add_all([post1, post2])
db.session.commit()

# Accessing related items seamlessly
for post in user.posts:
    print(f"Title: {post.title} by {post.author.name}")
```

=== "Output"
```
Title: First Post by Alice
Title: SQLAlchemy Guide by Alice
```

---

## 💻 Try It Yourself

Simulate ORM class models and session query methods using pure Python:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Pure Python simulation of an ORM Model and Query pattern
class MockUser:
    def __init__(self, id, name, email, age):
        self.id = id
        self.name = name
        self.email = email
        self.age = age

class MockSession:
    def __init__(self):
        self._records = []

    def add(self, entity):
        self._records.append(entity)

    def query_all(self):
        return self._records

    def filter_by_min_age(self, min_age):
        return [r for r in self._records if r.age >= min_age]

# Simulate DB Session
session = MockSession()
session.add(MockUser(1, "Alice", "alice@example.com", 28))
session.add(MockUser(2, "Bob", "bob@example.com", 22))
session.add(MockUser(3, "Carol", "carol@example.com", 31))

print("All Users:")
for u in session.query_all():
    print(f" - {u.name} (age {u.age})")

print("\nUsers Age >= 25:")
for u in session.filter_by_min_age(25):
    print(f" - {u.name} ({u.age})")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Query All User Names

Using the user models below, iterate over all users in the collection and print each user's `name` on its own line.

Expected output:
```
Alice
Bob
Carol
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Alice
Bob
Carol">
<pre><code class="language-python">class User:
    def __init__(self, id, name, age):
        self.id = id
        self.name = name
        self.age = age

users = [
    User(1, "Alice", 28),
    User(2, "Bob", 22),
    User(3, "Carol", 31)
]

# Query and print each user's name
for u in users:
    print(u.name)
</code></pre>
</div>

---

### Challenge 2 — Filter Users by Age > 25

Iterate through the `users` list and print the names of only those users whose `age` is strictly greater than `25`.

Expected output:
```
Alice
Carol
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Alice
Carol">
<pre><code class="language-python">class User:
    def __init__(self, id, name, age):
        self.id = id
        self.name = name
        self.age = age

users = [
    User(1, "Alice", 28),
    User(2, "Bob", 22),
    User(3, "Carol", 31)
]

# Filter users where age > 25 and print their names
for u in users:
    if u.age > 25:
        print(u.name)
</code></pre>
</div>

---

## 📚 Further Reading

- [Flask-SQLAlchemy Documentation](https://flask-sqlalchemy.palletsprojects.com/)
- [SQLAlchemy 2.0 Unified Tutorial](https://docs.sqlalchemy.org/en/20/tutorial/)
- [Flask-Migrate (Database Schema Migrations)](https://flask-migrate.readthedocs.io/)

---

!!! success "Lesson Complete 🎉"
    You've learned how to leverage SQLAlchemy to manage models, execute typed queries, and handle table relationships. In the next lesson, we will explore user authentication, password hashing, and session management!

[⬅️ Lesson 12 · Connecting Flask to SQLite](12-flask-sqlite.md){ .md-button } [➡️ Lesson 14 · Flask Authentication Basics](14-flask-auth-basics.md){ .md-button .md-button--primary }
