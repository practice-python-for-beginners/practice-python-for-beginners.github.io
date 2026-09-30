---
title: "Lesson 42 · Securing FastAPI Applications"
description: "Secure FastAPI with OAuth2 scopes, Pydantic validation, CORS, security headers, parameterized queries, and API key authentication."
---

# Lesson 42 · Securing FastAPI Applications

> **Section:** Security, Webhooks & Microservices &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** 35 min

## 🎯 Learning Objectives

- [ ] Implement API key authentication with FastAPI's `Security` utilities
- [ ] Use Pydantic models to validate and reject malformed input automatically
- [ ] Configure CORS with `fastapi.middleware.cors`
- [ ] Add security headers (HSTS, X-Content-Type-Options) with middleware
- [ ] Prevent SQL injection using parameterized queries in `databases` / `sqlite3`
- [ ] Understand OAuth2 scopes for fine-grained authorization

## 📖 Introduction

FastAPI gives you a head-start on security: Pydantic validates every incoming payload automatically, OpenAPI docs surface your auth schemes, and the `fastapi.security` module provides ready-made OAuth2/API-key helpers. But defaults are not enough — you still need to actively configure CORS, add security headers, manage secrets, and protect your database layer.

This lesson walks through the layers of defence from the network edge (headers, CORS, HTTPS) down to the database (parameterized queries), with runnable examples for each.

!!! info "FastAPI ≥ 0.95 uses `Annotated` for dependencies"
    Examples below use `Annotated[str, Depends(...)]` — the modern style. Both the old `= Depends(...)` and the new style are functionally identical.

---

## 1. API Key Authentication

API keys are the simplest authentication scheme: a shared secret the client sends in a header (preferred) or query parameter (less safe).

=== "Header-based API key"
    ```python
    from fastapi import FastAPI, Security, HTTPException, status
    from fastapi.security import APIKeyHeader

    app = FastAPI()
    api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

    VALID_KEYS = {"sk-abc123", "sk-xyz789"}

    async def verify_key(key: str = Security(api_key_header)):
        if key not in VALID_KEYS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid or missing API key",
            )
        return key

    @app.get("/secure-data", dependencies=[Security(verify_key)])
    async def secure_data():
        return {"data": "only for authorised clients"}
    ```

=== "Query param key (less safe)"
    ```python
    from fastapi.security import APIKeyQuery

    api_key_query = APIKeyQuery(name="api_key", auto_error=False)

    async def verify_query_key(key: str = Security(api_key_query)):
        if key not in VALID_KEYS:
            raise HTTPException(status_code=403, detail="Forbidden")
        return key
    # ⚠️ Keys in URLs appear in server logs and browser history
    ```

=== "Pure Python check (stdlib)"
    ```python
    # Simulating the check without FastAPI
    VALID_KEYS = {"sk-abc123", "sk-xyz789"}

    def check_api_key(headers: dict) -> str:
        key = headers.get("X-API-Key", "")
        if key in VALID_KEYS:
            return "authorized"
        return "unauthorized"

    print(check_api_key({"X-API-Key": "sk-abc123"}))  # authorized
    print(check_api_key({"X-API-Key": "bad-key"}))    # unauthorized
    ```

---

## 2. OAuth2 Scopes

OAuth2 scopes let you express *what* a token is allowed to do — not just *who* it belongs to.

=== "Scope-guarded endpoint"
    ```python
    from fastapi import FastAPI, Security
    from fastapi.security import OAuth2PasswordBearer, SecurityScopes

    oauth2 = OAuth2PasswordBearer(
        tokenUrl="token",
        scopes={"read:items": "Read items", "write:items": "Create/update items"},
    )

    async def current_user(
        security_scopes: SecurityScopes,
        token: str = Security(oauth2, scopes=["read:items"]),
    ):
        # In production: decode JWT, verify expiry, check scopes
        ...

    @app.get("/items", dependencies=[Security(current_user, scopes=["read:items"])])
    async def list_items():
        return [{"id": 1}]
    ```

=== "Scope table"
    | Scope | Meaning |
    |-------|---------|
    | `read:users` | List / get users |
    | `write:users` | Create / update users |
    | `admin` | All operations |

---

## 3. Pydantic Input Validation

FastAPI uses Pydantic v2 for request body validation. Any field that fails validation returns a 422 automatically — no manual checks needed.

=== "Model with constraints"
    ```python
    from pydantic import BaseModel, Field, field_validator
    import re

    class UserCreate(BaseModel):
        username: str = Field(min_length=3, max_length=30, pattern=r"^\w+$")
        email: str = Field(pattern=r"^[^@]+@[^@]+\.[^@]+$")
        password: str = Field(min_length=8)

        @field_validator("password")
        @classmethod
        def strong_password(cls, v: str) -> str:
            if not re.search(r"[A-Z]", v):
                raise ValueError("Need at least one uppercase letter")
            if not re.search(r"\d", v):
                raise ValueError("Need at least one digit")
            return v
    ```

=== "Simulated Pydantic-like check (stdlib)"
    ```python
    REQUIRED_FIELDS = {"username", "email", "password"}

    def validate_payload(data: dict) -> str:
        missing = REQUIRED_FIELDS - data.keys()
        if missing:
            return f"invalid: missing {missing}"
        return "valid"

    print(validate_payload({"username": "alice", "email": "a@b.com", "password": "P@ss1"}))
    # valid
    ```

---

## 4. CORS & Security Headers

=== "CORS middleware"
    ```python
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://app.example.com"],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    )
    ```

=== "Security headers middleware"
    ```python
    from starlette.middleware.base import BaseHTTPMiddleware
    from starlette.requests import Request

    class SecurityHeadersMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request: Request, call_next):
            response = await call_next(request)
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains"
            )
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
            return response

    app.add_middleware(SecurityHeadersMiddleware)
    ```

=== "Header reference"
    | Header | Purpose |
    |--------|---------|
    | `Strict-Transport-Security` | Force HTTPS for 2 years |
    | `X-Content-Type-Options: nosniff` | Prevent MIME sniffing |
    | `X-Frame-Options: DENY` | Block clickjacking |
    | `Content-Security-Policy` | Restrict resource origins |

---

## 5. Parameterized Queries & Secret Management

=== "Parameterized queries"
    ```python
    import sqlite3

    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE users (id INTEGER, name TEXT, email TEXT)")

    # ✅ Safe — user-supplied data never touches the SQL string
    def get_user_by_email(email: str):
        cur = conn.execute(
            "SELECT id, name FROM users WHERE email = ?", (email,)
        )
        return cur.fetchone()
    ```

=== "Secrets via environment"
    ```python
    import os
    from pydantic_settings import BaseSettings  # pip install pydantic-settings

    class Settings(BaseSettings):
        database_url: str
        secret_key: str
        api_key_salt: str

        class Config:
            env_file = ".env"

    settings = Settings()  # Reads from env vars or .env file
    ```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">

```python
# Simulate API key validation without FastAPI
VALID_KEYS = {"sk-abc123", "sk-xyz789", "sk-prod001"}

def check_api_key(headers: dict) -> str:
    key = headers.get("X-API-Key", "")
    if key in VALID_KEYS:
        return "authorized"
    return "unauthorized"

# Test cases
test_requests = [
    {"X-API-Key": "sk-abc123"},
    {"X-API-Key": "sk-hacker"},
    {"X-API-Key": "sk-xyz789"},
    {},  # Missing header
]

for req in test_requests:
    result = check_api_key(req)
    key = req.get("X-API-Key", "(none)")
    print(f"Key: {key:20s} → {result}")
```

</div>

---

## 🏋️ Challenges

**Challenge 1 — Whitelist check**

<div class="pyodide-runner" data-mode="challenge" data-expected="True">

```python
VALID_KEYS = {"sk-abc123", "sk-xyz789"}

key = "sk-abc123"
# TODO: print True if `key` is in VALID_KEYS, else False
```

</div>

---

**Challenge 2 — Required fields validation**

<div class="pyodide-runner" data-mode="challenge" data-expected="valid">

```python
REQUIRED_FIELDS = {"username", "email", "password"}

payload = {"username": "alice", "email": "alice@example.com", "password": "Secure1"}

# TODO: print "valid" if all required fields are present, else "invalid"
```

</div>

---

## 📚 Further Reading

- [FastAPI Security — Official Docs](https://fastapi.tiangolo.com/tutorial/security/)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [Pydantic v2 Validators](https://docs.pydantic.dev/latest/concepts/validators/)

---

!!! success "Lesson 42 complete!"
    You can now authenticate FastAPI routes with API keys and OAuth2 scopes, validate input with Pydantic, configure CORS and security headers, and write safe parameterized queries.

[⬅️ Previous Lesson](41-securing-flask-apis.md){ .md-button } [➡️ Next Lesson](43-webhooks-flask.md){ .md-button .md-button--primary }
