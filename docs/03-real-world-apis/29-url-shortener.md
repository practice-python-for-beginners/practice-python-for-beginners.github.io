---
title: "Lesson 29 · URL Shortener API"
description: "Build a URL shortener with short code generation, a long→short mapping store, redirect tracking, expiry, custom aliases, and collision handling."
---

# Lesson 29 · URL Shortener API

> **Section:** 🌐 Real-World API Projects &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Generate short alphanumeric codes using `random` and `string` modules
- [ ] Store and look up `long_url → short_code` mappings in a dict
- [ ] Describe how a redirect endpoint returns HTTP 302
- [ ] Track click counts per short URL
- [ ] Handle collisions, expiry, and custom aliases

---

## 📖 Introduction

A URL shortener is a classic system design project — it requires thinking about uniqueness, collisions, expiry, and redirects. Services like bit.ly and TinyURL do exactly this at scale. In this lesson you build a fully functional shortener using only the Python standard library, ready to be wrapped in any web framework.

!!! info "Redirects need a web framework"
    HTTP 302 redirects require a running web server. In this lesson we focus on the data layer — generating codes, storing mappings, and tracking clicks. The redirect logic is shown as a commented Flask example.

---

## 1. Generating Short Codes

=== "Python"
    ```python
    import random
    import string

    ALPHABET = string.ascii_letters + string.digits   # a-z A-Z 0-9

    def generate_code(length: int = 6) -> str:
        """Generate a random alphanumeric short code."""
        return "".join(random.choices(ALPHABET, k=length))

    # Generate 5 sample codes
    for _ in range(5):
        print(generate_code())
    ```
=== "Output"
    ```
    aB3xR9
    Kz7mWq
    pL2nYc
    dG8vTe
    hF5oUj
    ```

!!! tip "Why 6 characters?"
    6 characters from 62 possibilities gives 62⁶ ≈ 56 billion unique codes — more than enough for most apps. Increase to 8 characters for very large scale.

---

## 2. Hash-Based Short Codes

Using `hashlib` creates deterministic codes — the same URL always gets the same code:

=== "Python"
    ```python
    import hashlib

    def hash_url(long_url: str, length: int = 6) -> str:
        """Deterministic short code from URL hash."""
        digest = hashlib.md5(long_url.encode()).hexdigest()
        return digest[:length]

    urls = [
        "https://python.org",
        "https://realpython.com/python-requests/",
        "https://docs.python.org/3/library/hashlib.html",
    ]

    for url in urls:
        code = hash_url(url)
        print(f"{code}  →  {url}")
    ```
=== "Output"
    ```
    2ac49f  →  https://python.org
    4e5d9a  →  https://realpython.com/python-requests/
    8c7b1f  →  https://docs.python.org/3/library/hashlib.html
    ```

!!! warning "Hash collisions are real"
    Two different URLs can produce the same 6-character hash prefix. Always check for collisions before saving — fall back to a longer prefix or a random code if a collision is detected.

---

## 3. Storing Mappings and Tracking Clicks

=== "Python"
    ```python
    import random, string, time

    store = {}   # short_code → {"long_url", "clicks", "created_at", "expires_at"}

    def shorten(long_url: str, custom_alias: str = None,
                ttl_seconds: int = None) -> dict:
        """Store a URL and return its short code."""
        code = custom_alias or _unique_code()
        if code in store:
            if custom_alias:
                return {"error": f"Alias '{code}' already taken"}
            code = _unique_code()   # retry on collision

        expires = time.time() + ttl_seconds if ttl_seconds else None
        store[code] = {
            "long_url":   long_url,
            "clicks":     0,
            "created_at": time.time(),
            "expires_at": expires,
        }
        return {"code": code, "short_url": f"https://sho.rt/{code}"}

    def _unique_code(length=6):
        alph = string.ascii_letters + string.digits
        for _ in range(10):           # up to 10 attempts
            code = "".join(random.choices(alph, k=length))
            if code not in store:
                return code
        raise RuntimeError("Could not generate unique code")

    r1 = shorten("https://python.org")
    r2 = shorten("https://realpython.com", custom_alias="rpy")
    print(r1)
    print(r2)
    ```
=== "Output"
    ```
    {'code': 'aB3xR9', 'short_url': 'https://sho.rt/aB3xR9'}
    {'code': 'rpy', 'short_url': 'https://sho.rt/rpy'}
    ```

---

## 4. The Redirect Lookup (With Click Tracking)

=== "Python"
    ```python
    import time

    def resolve(code: str) -> dict:
        """Look up a short code and track the click."""
        entry = store.get(code)
        if not entry:
            return {"error": "Short URL not found", "status": 404}

        # Check expiry
        if entry["expires_at"] and time.time() > entry["expires_at"]:
            del store[code]
            return {"error": "Short URL has expired", "status": 410}

        entry["clicks"] += 1
        return {
            "long_url": entry["long_url"],
            "clicks":   entry["clicks"],
            "status":   302,
        }

    # Simulate clicks
    for _ in range(3):
        result = resolve("rpy")
        print(f"Redirect to: {result['long_url']}  (clicks: {result['clicks']})")

    # Non-existent code
    print(resolve("xxxxxx"))
    ```
=== "Output"
    ```
    Redirect to: https://realpython.com  (clicks: 1)
    Redirect to: https://realpython.com  (clicks: 2)
    Redirect to: https://realpython.com  (clicks: 3)
    {'error': 'Short URL not found', 'status': 404}
    ```

!!! note "Flask redirect pattern"
    ```python
    from flask import redirect, abort
    @app.get("/<code>")
    def redirect_url(code):
        result = resolve(code)
        if result.get("status") != 302:
            abort(result["status"])
        return redirect(result["long_url"], code=302)
    ```

---

## 5. Analytics Summary

=== "Python"
    ```python
    def analytics() -> dict:
        """Return aggregate stats across all short URLs."""
        total_urls   = len(store)
        total_clicks = sum(e["clicks"] for e in store.values())
        top_urls     = sorted(store.items(),
                               key=lambda kv: kv[1]["clicks"],
                               reverse=True)[:3]
        return {
            "total_urls":   total_urls,
            "total_clicks": total_clicks,
            "top_urls": [
                {"code": k, "clicks": v["clicks"], "url": v["long_url"]}
                for k, v in top_urls
            ],
        }

    stats = analytics()
    print(f"Total URLs  : {stats['total_urls']}")
    print(f"Total clicks: {stats['total_clicks']}")
    print("Top URLs:")
    for u in stats["top_urls"]:
        print(f"  {u['code']}  {u['clicks']} clicks  {u['url']}")
    ```
=== "Output"
    ```
    Total URLs  : 2
    Total clicks: 3
    Top URLs:
      rpy  3 clicks  https://realpython.com
      aB3xR9  0 clicks  https://python.org
    ```

---

## 💻 Try It Yourself

Generate a 6-char alphanumeric short code and confirm it has length 6:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import random, string

ALPHABET = string.ascii_letters + string.digits

def generate_code(length=6):
    return "".join(random.choices(ALPHABET, k=length))

code = generate_code()
print(f"Short code : {code}")
print(f"Length     : {len(code)}")
print(f"Is length 6: {len(code) == 6}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — URL Lookup

Given a dict of short → long URLs, look up `"abc123"` and print the destination URL.

<div class="pyodide-runner" data-mode="challenge" data-expected="https://python.org">
<pre><code class="language-python">url_store = {
    "abc123": {"long_url": "https://python.org",      "clicks": 5},
    "xyz789": {"long_url": "https://realpython.com",  "clicks": 8},
    "hello1": {"long_url": "https://flask.palletsprojects.com", "clicks": 2},
}

# Look up "abc123" and print its long_url
</code></pre>
</div>

---

### Challenge 2 — Total Clicks

Count the total clicks across all entries in the analytics dict and print the number.

<div class="pyodide-runner" data-mode="challenge" data-expected="15">
<pre><code class="language-python">analytics = {
    "abc123": {"long_url": "https://python.org",     "clicks": 5},
    "xyz789": {"long_url": "https://realpython.com", "clicks": 8},
    "hello1": {"long_url": "https://flask.palletsprojects.com", "clicks": 2},
}

# Sum the clicks across all entries and print the total
</code></pre>
</div>

---

## 📚 Further Reading

- [Real Python — Build a URL Shortener with FastAPI](https://realpython.com/build-a-python-url-shortener-with-fastapi/)
- [Python `hashlib` Module — Official Docs](https://docs.python.org/3/library/hashlib.html)
- [System Design — URL Shortener (Educative)](https://www.educative.io/courses/grokking-the-system-design-interview/m2ygV4E81AR)

---

!!! success "Lesson Complete 🎉"
    You've built a fully functional URL shortener with code generation, collision handling, click tracking, expiry, and analytics — ready to be wrapped in any web framework.

[⬅️ Lesson 28 · Email Sender](28-email-sender.md){ .md-button } [➡️ Lesson 30 · User Profile API](30-user-profile-api.md){ .md-button .md-button--primary }
