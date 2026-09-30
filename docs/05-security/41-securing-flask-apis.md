---
title: "Lesson 41 · Securing Flask APIs"
description: "Learn how to protect Flask APIs from common vulnerabilities: input sanitization, CORS, HTTPS enforcement, secret management, and SQL injection prevention."
---

# Lesson 41 · Securing Flask APIs

> **Section:** Security, Webhooks & Microservices &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** 35 min

## 🎯 Learning Objectives

- [ ] Understand the OWASP Top 10 vulnerabilities relevant to Flask APIs
- [ ] Sanitize user input with `html.escape` and the `bleach` library
- [ ] Configure CORS correctly using `flask-cors`
- [ ] Enforce HTTPS and apply request size limits
- [ ] Manage secret keys safely with environment variables
- [ ] Prevent SQL injection using parameterized queries

## 📖 Introduction

Every API exposed to the internet is a potential attack surface. The **OWASP Top 10** is the industry-standard list of the most critical web application security risks. Flask, being a micro-framework, ships with almost no security defaults — that responsibility falls on you, the developer.

In this lesson you will learn the practical defences every Flask API should have before it goes to production: sanitizing untrusted input, restricting cross-origin requests, forcing HTTPS, capping payload sizes, keeping secrets out of source code, and writing queries that cannot be hijacked.

!!! warning "Security is not optional"
    A single unguarded endpoint can expose your entire database or allow attackers to run arbitrary code on behalf of your users. Treat each topic in this lesson as a production requirement, not a nice-to-have.

---

## 1. OWASP Top 10 Relevance for Flask APIs

The five OWASP risks that bite Flask APIs most often are:

| # | Risk | Flask Manifestation |
|---|------|---------------------|
| A01 | Broken Access Control | Missing `@login_required`, no role checks |
| A03 | Injection | Unsanitized SQL strings, shell commands |
| A05 | Security Misconfiguration | `DEBUG=True` in production, no HTTPS |
| A07 | Identification & Auth Failures | Weak secrets, tokens in URL params |
| A09 | Security Logging Failures | No audit trail for sensitive actions |

!!! tip "Start with a checklist"
    Run [Safety](https://pypi.org/project/safety/) against your `requirements.txt` to catch known CVEs before you even think about logic flaws.

---

## 2. Input Sanitization

Never trust data from the outside world. Always sanitize before storing, rendering, or processing.

=== "html.escape (stdlib)"
    ```python
    import html

    # Reflect user input safely in an HTML context
    user_input = "<script>alert('xss')</script>"
    safe = html.escape(user_input)
    print(safe)
    # &lt;script&gt;alert('xss')&lt;/script&gt;
    ```

=== "bleach (third-party)"
    ```python
    # pip install bleach
    import bleach

    # Strip all tags except an allowed subset
    dirty = '<b>Hello</b> <script>bad()</script> world'
    clean = bleach.clean(dirty, tags=['b'], strip=True)
    print(clean)
    # <b>Hello</b>  world
    ```

=== "Flask route example"
    ```python
    from flask import Flask, request, jsonify
    import html

    app = Flask(__name__)

    @app.post("/comments")
    def add_comment():
        data = request.get_json(silent=True) or {}
        text = html.escape(str(data.get("text", "")))
        # Store `text` in DB — safe from XSS
        return jsonify({"stored": text}), 201
    ```

!!! danger "Never use `Markup()` on unsanitized input"
    Flask's `Markup` class marks a string as safe for rendering. Wrapping user input in `Markup()` without escaping first is an XSS vulnerability.

---

## 3. CORS Configuration

Cross-Origin Resource Sharing controls which domains can call your API from a browser. By default Flask allows nothing — `flask-cors` lets you configure it precisely.

=== "Restrictive CORS (production)"
    ```python
    # pip install flask-cors
    from flask import Flask
    from flask_cors import CORS

    app = Flask(__name__)

    # Only allow requests from your frontend origin
    CORS(app, origins=["https://app.example.com"],
         methods=["GET", "POST"],
         allow_headers=["Content-Type", "Authorization"])
    ```

=== "Per-route CORS"
    ```python
    from flask_cors import cross_origin

    @app.route("/public-data")
    @cross_origin(origins="*")   # Public endpoint — any origin OK
    def public_data():
        return {"data": "open"}
    ```

=== "What to avoid"
    ```python
    # ❌ Never do this in production
    CORS(app)  # Allows ANY origin — CSRF-like attacks possible

    # ✅ Always be explicit
    CORS(app, origins=["https://myapp.com"])
    ```

| Setting | Safe value | Risky value |
|---------|-----------|-------------|
| `origins` | `["https://yourdomain.com"]` | `"*"` |
| `supports_credentials` | `False` unless needed | `True` with `origins="*"` |
| `max_age` | `600` (10 min preflight cache) | Very large values |

---

## 4. HTTPS Enforcement & Request Size Limits

=== "Force HTTPS with Talisman"
    ```python
    # pip install flask-talisman
    from flask import Flask
    from flask_talisman import Talisman

    app = Flask(__name__)
    Talisman(app,
             force_https=True,
             strict_transport_security=True,
             content_security_policy=False)  # configure CSP separately
    ```

=== "Request size limit"
    ```python
    from flask import Flask, request, abort

    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024  # 1 MB

    @app.errorhandler(413)
    def too_large(e):
        return {"error": "Payload too large (max 1 MB)"}, 413
    ```

=== "Behind a proxy (Render, Heroku)"
    ```python
    from werkzeug.middleware.proxy_fix import ProxyFix

    app.wsgi_app = ProxyFix(app.wsgi_app,
                             x_for=1, x_proto=1, x_host=1)
    # Now request.is_secure reflects the real protocol
    ```

---

## 5. Secret Key Management & SQL Injection Prevention

=== "Environment-based secrets"
    ```python
    import os
    from flask import Flask

    app = Flask(__name__)

    # ✅ Read from environment — never hard-code
    app.config["SECRET_KEY"] = os.environ["FLASK_SECRET_KEY"]
    app.config["DATABASE_URL"] = os.environ["DATABASE_URL"]

    # Use python-dotenv in development:
    # pip install python-dotenv
    # from dotenv import load_dotenv; load_dotenv()
    ```

=== "Parameterized SQL (sqlite3)"
    ```python
    import sqlite3

    conn = sqlite3.connect("users.db")

    # ❌ Vulnerable: f-string interpolation
    # username = "' OR '1'='1"
    # cursor.execute(f"SELECT * FROM users WHERE name='{username}'")

    # ✅ Safe: parameterized query
    username = request.args.get("name", "")
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE name = ?", (username,))
    rows = cursor.fetchall()
    ```

=== "Password validation"
    ```python
    import re

    def is_strong_password(pwd: str) -> bool:
        """Min 8 chars, at least one digit, one uppercase."""
        if len(pwd) < 8:
            return False
        if not re.search(r"[A-Z]", pwd):
            return False
        if not re.search(r"\d", pwd):
            return False
        return True

    print(is_strong_password("Secure123"))   # True
    print(is_strong_password("weakpass"))    # False
    ```

!!! note "Use an ORM for full protection"
    SQLAlchemy and Flask-SQLAlchemy use parameterized queries automatically when you use the ORM layer. Raw `text()` queries still require `:param` binding.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">

```python
import html

def sanitize(user_input: str) -> str:
    """Escape HTML special characters to prevent XSS."""
    return html.escape(user_input)

# Test with various inputs
inputs = [
    "<script>alert('xss')</script>",
    "<img src=x onerror=alert(1)>",
    "Hello, <b>world</b>!",
    "Normal text — no escaping needed",
]

for text in inputs:
    print(f"Raw:       {text}")
    print(f"Sanitized: {sanitize(text)}")
    print()
```

</div>

---

## 🏋️ Challenges

**Challenge 1 — Sanitize an XSS payload**

<div class="pyodide-runner" data-mode="challenge" data-expected="&lt;script&gt;alert('xss')&lt;/script&gt;">

```python
import html

payload = "<script>alert('xss')</script>"
# TODO: sanitize `payload` using html.escape and print the result
```

</div>

---

**Challenge 2 — Password strength validator**

<div class="pyodide-runner" data-mode="challenge" data-expected="True">

```python
import re

def is_strong_password(pwd: str) -> bool:
    # TODO: return True if pwd has >= 8 chars, at least one digit,
    #       and at least one uppercase letter
    pass

print(is_strong_password("Secure123"))
```

</div>

---

## 📚 Further Reading

- [OWASP Top 10 (2021)](https://owasp.org/Top10/)
- [Flask Security Considerations — Official Docs](https://flask.palletsprojects.com/en/latest/security/)
- [Python `html` module — stdlib docs](https://docs.python.org/3/library/html.html)

---

!!! success "Lesson 41 complete!"
    You can now sanitize user input, configure CORS, enforce HTTPS, cap request sizes, manage secrets safely, and write injection-proof queries in Flask.

[⬅️ Previous Lesson](../04-async-cicd/40-deploying-flask-fastapi.md){ .md-button } [➡️ Next Lesson](42-securing-fastapi.md){ .md-button .md-button--primary }
