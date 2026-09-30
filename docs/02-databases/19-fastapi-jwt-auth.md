---
title: "Lesson 19 · FastAPI JWT Authentication"
description: "Master OAuth2 password flow and JWT authentication in FastAPI using Depends, passlib, OAuth2PasswordBearer, and token verification."
---

# Lesson 19 · FastAPI JWT Authentication

> **Section:** 🗄️ Databases, ORMs & Auth &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~75 minutes

---

## 🎯 Learning Objectives

- [ ] Implement OAuth2 Password Flow using FastAPI's `OAuth2PasswordBearer` and `OAuth2PasswordRequestForm`
- [ ] Hash and verify passwords using `pwd_context` (bcrypt / passlib)
- [ ] Create and sign JWT access tokens with expiration claims
- [ ] Inject authenticated user models into endpoints using FastAPI's `Depends()` dependency injection
- [ ] Test authenticated endpoints in Swagger UI with interactive Bearer token authorization

---

## 📖 Introduction

FastAPI features a first-class **Dependency Injection** system (`Depends`) that simplifies authentication workflows. Rather than writing custom decorators, you declare security dependencies directly in your route signatures.

FastAPI also seamlessly integrates with **OAuth2 Password Flow**, meaning that Swagger UI (`/docs`) displays an **Authorize 🔓** button that allows you to log in, obtain a JWT token, and test protected endpoints directly within your browser.

Install: `pip install "python-jose[cryptography]" "passlib[bcrypt]"` or `pip install pyjwt pwdlib`

---

## 1. Password Hashing and Token Helpers

=== "Python (`auth.py`)"
```python
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
import jwt

SECRET_KEY = "fastapi-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
```

---

## 2. Dependency Injection with `OAuth2PasswordBearer`

The `OAuth2PasswordBearer` class tells FastAPI where clients submit their username and password to receive a token.

=== "Python (`dependencies.py`)"
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from auth import SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

fake_users_db = {
    "alice": {"username": "alice", "email": "alice@example.com", "role": "admin"},
    "bob": {"username": "bob", "email": "bob@example.com", "role": "user"}
}

def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None or username not in fake_users_db:
            raise credentials_exception
    except (jwt.PyJWTError, Exception):
        raise credentials_exception

    return fake_users_db[username]
```

---

## 3. Login and Protected Endpoints

=== "Python (`main.py`)"
```python
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from auth import verify_password, get_password_hash, create_access_token
from dependencies import get_current_user

app = FastAPI(title="FastAPI JWT Authentication")

users_db = {
    "bob": {
        "username": "bob",
        "hashed_password": get_password_hash("secret123"),
        "email": "bob@example.com"
    }
}

# ── LOGIN / TOKEN GENERATION ─────────────────────────────────
@app.post("/token")
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = users_db.get(form_data.username)
    if not user or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user["username"]})
    return {"access_token": access_token, "token_type": "bearer"}

# ── PROTECTED ENDPOINTS ──────────────────────────────────────
@app.get("/users/me")
def read_users_me(current_user: dict = Depends(get_current_user)):
    return current_user

@app.get("/admin/stats")
def read_admin_stats(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin privilege required")
    return {"active_users": 1500, "server_load": "12%"}
```

=== "Output"
```json
// GET /users/me with Bearer token
{
  "email": "bob@example.com",
  "role": "user",
  "username": "bob"
}
```

!!! tip "Swagger UI Authorize Button"
    Because `tokenUrl="token"` is configured, navigating to `/docs` provides a working authentication pop-up where you can log in as `bob` and execute queries seamlessly.

---

## 💻 Try It Yourself

Simulate decoding claims and reading the `sub` subject claim in pure Python:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Pure Python simulation of JWT token payload unpacking
import json
import base64

def simulate_jwt(sub: str, role: str) -> str:
    payload = {"sub": sub, "role": role, "exp": 9999999999}
    encoded = base64.b64encode(json.dumps(payload).encode()).decode()
    return f"header.{encoded}.signature"

def decode_sub(token: str) -> str:
    encoded_payload = token.split(".")[1]
    data = json.loads(base64.b64decode(encoded_payload.encode()).decode())
    return data["sub"]

token = simulate_jwt("bob", "developer")
print("Issued Token:", token)
print("Extracted Subject:", decode_sub(token))
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Decode Subject Claim

Given the simulated token payload string below, decode the Base64 JSON and print the `sub` field.

Expected output:
```
bob
```

<div class="pyodide-runner" data-mode="challenge" data-expected="bob">
<pre><code class="language-python">import json
import base64

# Base64 payload: {"sub": "bob", "role": "developer"}
encoded_payload = "eyJzdWIiOiAiYm9iIiwgInJvbGUiOiAiZGV2ZWxvcGVyIn0="

# Decode payload and print sub field
payload = json.loads(base64.b64decode(encoded_payload.encode()).decode())
print(payload["sub"])
</code></pre>
</div>

---

## 📚 Further Reading

- [FastAPI OAuth2 with Password and Bearer](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/)
- [Passlib Password Hashing Library](https://passlib.readthedocs.io/)
- [Python JOSE Documentation](https://python-jose.readthedocs.io/)

---

!!! success "Lesson Complete 🎉"
    You've secured FastAPI endpoints using dependency injection and OAuth2 JWT authentication! In our final lesson of Section 2, we will explore OpenAPI and Swagger documentation customization.

[⬅️ Lesson 18 · FastAPI CRUD App](18-fastapi-crud-app.md){ .md-button } [➡️ Lesson 20 · API Documentation with Swagger](20-api-docs-swagger.md){ .md-button .md-button--primary }
