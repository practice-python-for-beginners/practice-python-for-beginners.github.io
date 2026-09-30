---
title: "Lesson 15 · Flask JWT Authentication"
description: "Master stateless token authentication in Flask using PyJWT — token creation, signature verification, expiration handling, and protected routes."
---

# Lesson 15 · Flask JWT Authentication

> **Section:** 🗄️ Databases, ORMs & Auth &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~75 minutes

---

## 🎯 Learning Objectives

- [ ] Explain what a JSON Web Token (JWT) is and understand its 3 components (Header, Payload, Signature)
- [ ] Encode and issue signed access tokens using `PyJWT` with expiration timestamps
- [ ] Parse and verify incoming JWT tokens sent via the `Authorization: Bearer <token>` header
- [ ] Write a custom token protection decorator for Flask endpoints
- [ ] Handle token expiration errors (`jwt.ExpiredSignatureError`) and invalid token exceptions

---

## 📖 Introduction

While cookie-based sessions work well for traditional web pages rendered on the server, modern architectures (single-page applications, mobile apps, and microservices) require **stateless authentication**.

With **JSON Web Tokens (JWT)**, the server does not store active session records in memory or a database. Instead, the server issues a signed, cryptographically tamper-proof token upon successful login. The client includes this token in the `Authorization` header of subsequent HTTP requests.

Install: `pip install pyjwt`

---

## 1. Anatomy of a JSON Web Token

A JWT is a string of three Base64URL-encoded segments separated by dots (`.`):

$$\text{Header}.\text{Payload}.\text{Signature}$$

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlcm5hbWUiOiJhbGljZSIsImV4cCI6MTcxOTU0MzIwMH0.d4c9f1a...
\_________________  ________________/\_________________________  ________________________/\___________  ___________/
                  v                                            v                                      v
          1. Header (Algorithm)                        2. Payload (Claims)                    3. Cryptographic Signature
```

1. **Header:** Algorithm used (e.g., `HS256`, `RS256`) and token type (`JWT`).
2. **Payload:** Claims containing user identity and metadata (e.g., `user_id`, `exp` expiration timestamp).
3. **Signature:** `HMAC-SHA256(base64(header) + "." + base64(payload), SECRET_KEY)`. Prevents tampering because modifying payload changes signature validation.

!!! warning "Payloads are Readable!"
    JWT payloads are Base64URL encoded, **not encrypted**. Anyone can decode and read claims inside the token. Never store sensitive secrets like database passwords or private keys in the payload.

---

## 2. Encoding and Decoding Tokens with PyJWT

=== "Python"
```python
import jwt
import datetime

SECRET_KEY = "super-secret-jwt-signing-key"

# 1. Create a signed token with 15-minute expiration
payload = {
    "user_id": 101,
    "username": "alice",
    "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15),
    "iat": datetime.datetime.now(datetime.timezone.utc)
}

token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
print("Generated Token:\n", token)

# 2. Decode and verify signature
try:
    decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    print("\nDecoded Claims:", decoded)
    print("Logged-in user:", decoded["username"])
except jwt.ExpiredSignatureError:
    print("Token has expired!")
except jwt.InvalidTokenError:
    print("Invalid or tampered token!")
```

=== "Output"
```
Generated Token:
 eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxMDEsInVzZXJuYW1lIjoiYWxpY2Ui...

Decoded Claims: {'user_id': 101, 'username': 'alice', 'exp': 1719543200, 'iat': 1719542300}
Logged-in user: alice
```

---

## 3. Protecting Flask Routes with JWT Decorators

To authenticate incoming requests, the client sends the token in the `Authorization` header:

```http
Authorization: Bearer <token_string>
```

=== "Python (`auth.py`)"
```python
from functools import wraps
from flask import request, jsonify, g
import jwt

SECRET_KEY = "your-app-secret-key"

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"error": "Authorization header missing"}), 401

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Invalid Authorization format. Use: Bearer <token>"}), 401

        token = parts[1]
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            # Attach payload to Flask's request context g
            g.current_user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired. Please log in again."}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid or forged token"}), 401

        return f(*args, **kwargs)
    return decorated
```

---

## 4. Full Flask JWT Authentication Example

=== "Python (`app.py`)"
```python
from flask import Flask, request, jsonify, g
import jwt
import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from auth import token_required, SECRET_KEY

app = Flask(__name__)

# Sample User Table
users = {
    "alice": {
        "id": 1,
        "username": "alice",
        "password_hash": generate_password_hash("password123")
    }
}

# ── LOGIN ROUTE ──────────────────────────────────────────────
@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    username = data.get("username")
    password = data.get("password")

    user = users.get(username)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    payload = {
        "sub": user["id"],
        "username": user["username"],
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
    }
    access_token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return jsonify({"access_token": access_token, "token_type": "Bearer"}), 200

# ── PROTECTED ME ROUTE ───────────────────────────────────────
@app.route("/api/me", methods=["GET"])
@token_required
def me():
    # g.current_user is set by token_required
    return jsonify({
        "user_id": g.current_user["sub"],
        "username": g.current_user["username"]
    }), 200

if __name__ == "__main__":
    app.run(debug=True)
```

=== "Output"
```json
// POST /api/auth/login Response
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer"
}
```

---

## 💻 Try It Yourself

Simulate token creation and claim extraction using pure Python and dictionary serialization:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Pure Python simulation of JWT token payload unpacking
import json
import base64

def mock_create_token(username, user_id):
    payload = {"sub": user_id, "username": username, "role": "admin"}
    payload_json = json.dumps(payload)
    encoded = base64.b64encode(payload_json.encode()).decode()
    return f"header.{encoded}.signature"

def mock_decode_token(token):
    parts = token.split(".")
    payload_raw = base64.b64decode(parts[1].encode()).decode()
    return json.loads(payload_raw)

# Issue mock token
token = mock_create_token("alice", 101)
print("Simulated Token:", token)

# Validate & read claims
claims = mock_decode_token(token)
print(f"Authenticated as: {claims['username']} (ID: {claims['sub']})")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Decode JWT Payload

Given the simulated token payload string below, parse and print the `username` field.

Expected output:
```
alice
```

<div class="pyodide-runner" data-mode="challenge" data-expected="alice">
<pre><code class="language-python">import json
import base64

# Base64 encoded payload: {"sub": 42, "username": "alice", "exp": 9999999999}
encoded_payload = "eyJzdWIiOiA0MiwgInVzZXJuYW1lIjogImFsaWNlIiwgImV4cCI6IDk5OTk5OTk5OTl9"

# Decode base64 and parse json, then print username
decoded_json = json.loads(base64.b64decode(encoded_payload.encode()).decode())
print(decoded_json["username"])
</code></pre>
</div>

---

## 📚 Further Reading

- [PyJWT Documentation](https://pyjwt.readthedocs.io/)
- [JWT.io — Token Debugger & Visualizer](https://jwt.io/)
- [RFC 7519 — JSON Web Token (JWT) Standard](https://datatracker.ietf.org/doc/html/rfc7519)

---

!!! success "Lesson Complete 🎉"
    You've implemented stateless JWT authentication for REST APIs! Next, we will step outside relational databases and explore document storage using MongoDB with Flask.

[⬅️ Lesson 14 · Flask Authentication Basics](14-flask-auth-basics.md){ .md-button } [➡️ Lesson 16 · Flask with MongoDB](16-flask-mongodb.md){ .md-button .md-button--primary }
