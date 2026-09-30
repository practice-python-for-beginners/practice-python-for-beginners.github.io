---
title: "Lesson 14 · Flask Authentication Basics"
description: "Implement secure user registration, password hashing with Werkzeug, cookie-based sessions, and custom login decorators in Flask."
---

# Lesson 14 · Flask Authentication Basics

> **Section:** 🗄️ Databases, ORMs & Auth &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Explain why plaintext passwords must never be stored in databases
- [ ] Hash and verify passwords using `werkzeug.security` (`generate_password_hash`, `check_password_hash`)
- [ ] Build user registration and login endpoints with state verification
- [ ] Manage user login states using encrypted Flask cookie sessions
- [ ] Write a custom `@login_required` route decorator to protect sensitive endpoints
- [ ] Implement a clean logout endpoint that terminates user sessions

---

## 📖 Introduction

Authentication confirms a user's identity before granting access to protected data or actions. A fundamental rule of web security is: **never store plaintext passwords in a database**. If an attacker breaches the database, raw passwords would immediately compromise user accounts across every platform.

Instead, passwords must be securely salted and hashed using cryptographic algorithms like PBKDF2 or Scrypt. In this lesson, you will learn how to hash passwords, authenticate users, and manage sessions in Flask.

---

## 1. Password Hashing with Werkzeug

Flask includes **Werkzeug**, which provides built-in cryptographic password hashing utilities:

=== "Python"
```python
from werkzeug.security import generate_password_hash, check_password_hash

# 1. Hashing during user registration
password = "supersecretpassword123"
hashed = generate_password_hash(password, method="scrypt")
print("Hashed password:", hashed)

# 2. Verifying during user login
is_correct = check_password_hash(hashed, "supersecretpassword123")
print("Correct password check:", is_correct)  # True

is_wrong = check_password_hash(hashed, "wrongpassword")
print("Wrong password check:", is_wrong)      # False
```

=== "Output"
```
Hashed password: scrypt:32768:8:1$u7iH...$e2b9c7...
Correct password check: True
Wrong password check: False
```

!!! info "Salting & Rainbow Tables"
    `generate_password_hash()` automatically generates a unique cryptographic **salt** for every hash. This ensures that two users with the identical password will have completely different stored hashes, defending against precomputed dictionary (rainbow table) attacks.

---

## 2. Managing Sessions in Flask

Flask provides a secure, cryptographically signed client-side cookie mechanism via the `session` dictionary. To use sessions, you must configure a `SECRET_KEY`.

=== "Python"
```python
import os
from flask import Flask, session

app = Flask(__name__)
# Cryptographic secret used to sign session cookies
app.secret_key = os.urandom(24)

@app.route("/set-session")
def set_session():
    session["user_id"] = 42
    session["username"] = "alice"
    return {"message": "Session initialized"}

@app.route("/get-session")
def get_session():
    username = session.get("username", "Guest")
    return {"logged_in_as": username}

@app.route("/clear-session")
def clear_session():
    session.clear()
    return {"message": "Logged out successfully"}
```

---

## 3. Building Registration, Login, and Logout Routes

Here is a complete authentication workflow using an in-memory user repository:

=== "Python"
```python
from flask import Flask, request, jsonify, session, abort
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "development-secret-key-change-in-prod"

users_db = {}  # username -> {"username": str, "password_hash": str}

# REGISTRATION
@app.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        abort(400, description="Username and password are required")
    if username in users_db:
        abort(409, description="Username already registered")

    users_db[username] = {
        "username": username,
        "password_hash": generate_password_hash(password)
    }
    return jsonify({"message": f"User {username} registered successfully"}), 201

# LOGIN
@app.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username", "")
    password = data.get("password", "")

    user = users_db.get(username)
    if not user or not check_password_hash(user["password_hash"], password):
        abort(401, description="Invalid username or password")

    # Store user identity in the signed session cookie
    session["username"] = username
    return jsonify({"message": f"Welcome back, {username}!"}), 200

# LOGOUT
@app.route("/auth/logout", methods=["POST"])
def logout():
    session.pop("username", None)
    return jsonify({"message": "Successfully logged out"}), 200
```

---

## 4. Protecting Routes with a `@login_required` Decorator

Using Python decorators allows you to protect sensitive routes without duplicating authentication checks in every endpoint function.

=== "Python"
```python
from functools import wraps

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "username" not in session:
            abort(401, description="Authentication required to access this resource")
        return f(*args, **kwargs)
    return decorated_function

# PROTECTED ROUTE
@app.route("/api/dashboard", methods=["GET"])
@login_required
def dashboard():
    current_user = session["username"]
    return jsonify({
        "status": "success",
        "secret_data": f"Confidential dashboard payload for {current_user}"
    }), 200
```

=== "Output"
```json
// GET /api/dashboard when not logged in -> 401 Unauthorized
{
  "error": "401 Unauthorized: Authentication required to access this resource"
}
```

---

## 💻 Try It Yourself

Simulate a hashing and verification routine with custom Python string transformations:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simplified demonstration of password hashing and verification
import hashlib

def hash_pw(password: str, salt: str = "custom_salt_99") -> str:
    combined = (password + salt).encode("utf-8")
    return hashlib.sha256(combined).hexdigest()

def verify_pw(password: str, stored_hash: str, salt: str = "custom_salt_99") -> bool:
    return hash_pw(password, salt) == stored_hash

# Registration
user_password = "mySecretPassword123"
stored = hash_pw(user_password)
print(f"Stored Hash: {stored[:24]}...")

# Login verification
print("Correct Password Match:", verify_pw("mySecretPassword123", stored))
print("Incorrect Password Match:", verify_pw("wrongGuess", stored))
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Hash & Verify Password

Using Python's standard `hashlib` module, hash the string `"mySecretPass"` with SHA-256 and test if verifying the exact same input string matches the resulting hash. Print the boolean `True`.

Expected output:
```
True
```

<div class="pyodide-runner" data-mode="challenge" data-expected="True">
<pre><code class="language-python">import hashlib

def mock_hash(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def mock_verify(pw, expected_hash):
    return mock_hash(pw) == expected_hash

hashed = mock_hash("mySecretPass")
# Verify and print the boolean result
result = mock_verify("mySecretPass", hashed)
print(result)
</code></pre>
</div>

---

## 📚 Further Reading

- [Werkzeug Security Helpers Documentation](https://werkzeug.palletsprojects.com/en/latest/utils/#module-werkzeug.security)
- [Flask Session Management](https://flask.palletsprojects.com/en/latest/quickstart/#sessions)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

!!! success "Lesson Complete 🎉"
    You've mastered cookie session authentication and cryptographic password hashing in Flask! In the next lesson, we will transition to stateless token authentication using JSON Web Tokens (JWT).

[⬅️ Lesson 13 · Introduction to SQLAlchemy](13-intro-to-sqlalchemy.md){ .md-button } [➡️ Lesson 15 · Flask JWT Authentication](15-flask-jwt-auth.md){ .md-button .md-button--primary }
