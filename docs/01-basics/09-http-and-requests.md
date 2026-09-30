---
title: "Lesson 9 · HTTP & the Requests Library"
description: "Understand HTTP methods, status codes, headers, and use Python's requests library to call real-world web APIs."
---

# Lesson 9 · HTTP & the Requests Library

> **Section:** 🧱 Python Basics &nbsp;|&nbsp; **Difficulty:** ⭐⭐☆☆☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

- [ ] Understand HTTP methods: GET, POST, PUT, PATCH, DELETE
- [ ] Read and interpret HTTP status codes
- [ ] Use `requests.get()` and `requests.post()` to call APIs
- [ ] Pass query parameters, headers, and JSON bodies
- [ ] Handle errors and timeouts gracefully

---

## 📖 Introduction

HTTP (HyperText Transfer Protocol) is the language of the web. Every time your browser loads a page or your app calls an API, it speaks HTTP. The `requests` library makes it simple to use HTTP from Python.

Install: `pip install requests`

---

## 1. HTTP at a Glance

=== "Methods"
    | Method | Purpose |
    |--------|---------|
    | `GET` | Retrieve data |
    | `POST` | Create new resource |
    | `PUT` | Replace a resource entirely |
    | `PATCH` | Update part of a resource |
    | `DELETE` | Remove a resource |

=== "Status Codes"
    | Code | Meaning |
    |------|---------|
    | `200 OK` | Request succeeded |
    | `201 Created` | Resource was created |
    | `204 No Content` | Success, no body returned |
    | `400 Bad Request` | Client sent invalid data |
    | `401 Unauthorized` | Authentication required |
    | `403 Forbidden` | Authenticated but not allowed |
    | `404 Not Found` | Resource doesn't exist |
    | `422 Unprocessable` | Validation failed |
    | `500 Internal Server Error` | Server crashed |

=== "Anatomy of a Request"
    ```
    GET /api/users?role=admin HTTP/1.1
    Host: api.example.com
    Authorization: Bearer eyJhbGciOi...
    Accept: application/json
    ```

    - **Method** — what to do
    - **Path** — which resource
    - **Query string** — `?key=value` filters
    - **Headers** — metadata (auth token, content type)
    - **Body** — data sent with POST/PUT (JSON, form data)

---

## 2. GET Requests

```python
import requests

# Simple GET
response = requests.get("https://httpbin.org/get")
print(response.status_code)          # 200
print(response.headers["Content-Type"])
data = response.json()               # parse JSON body
print(data["url"])

# With query parameters
params = {"q": "python", "page": 1, "per_page": 5}
response = requests.get("https://httpbin.org/get", params=params)
# URL becomes: https://httpbin.org/get?q=python&page=1&per_page=5
print(response.url)
```

---

## 3. POST Requests with JSON Body

```python
import requests

payload = {
    "title": "My first post",
    "body":  "Hello from Python!",
    "userId": 1,
}

response = requests.post(
    "https://jsonplaceholder.typicode.com/posts",
    json=payload,   # automatically sets Content-Type: application/json
)

print(response.status_code)     # 201 Created
created = response.json()
print(created["id"])            # 101
print(created["title"])
```

---

## 4. Headers & Authentication

```python
import requests

headers = {
    "Authorization": "Bearer YOUR_TOKEN_HERE",
    "Accept":        "application/json",
    "User-Agent":    "MyPythonApp/1.0",
}

response = requests.get(
    "https://httpbin.org/headers",
    headers=headers,
)
print(response.json())

# Basic auth
response = requests.get(
    "https://httpbin.org/basic-auth/user/pass",
    auth=("user", "pass"),
)
print(response.status_code)  # 200
```

---

## 5. Error Handling & Timeouts

```python
import requests
from requests.exceptions import Timeout, ConnectionError, HTTPError

def fetch_user(user_id):
    url = f"https://jsonplaceholder.typicode.com/users/{user_id}"
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()   # raises HTTPError for 4xx/5xx
        return response.json()
    except Timeout:
        print("Request timed out")
    except ConnectionError:
        print("Network connection failed")
    except HTTPError as e:
        print(f"HTTP error {e.response.status_code}: {e}")
    return None

user = fetch_user(1)
if user:
    print(f"User: {user['name']} <{user['email']}>")

# 404 example
not_found = fetch_user(9999)
```

!!! tip "Always set a timeout"
    Without `timeout=N`, your code can hang forever if a server never responds. 5–10 seconds is a sensible default.

---

## 6. Sessions (Reuse Connections & Headers)

```python
import requests

# A Session reuses connections and stores headers/cookies across requests
session = requests.Session()
session.headers.update({
    "Authorization": "Bearer MY_TOKEN",
    "User-Agent":    "MyApp/1.0",
})

# All requests in this session share the headers above
r1 = session.get("https://httpbin.org/get")
r2 = session.get("https://httpbin.org/get")
print(r1.status_code, r2.status_code)
session.close()
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import json

# Simulate an HTTP response (requests not available in browser)
mock_response = {
    "userId": 1,
    "id": 1,
    "title": "sunt aut facere repellat provident occaecati",
    "body": "quia et suscipit\nsuscipit recusandae..."
}

# Pretend we got this from: requests.get("https://jsonplaceholder.typicode.com/posts/1").json()
post = mock_response

print(f"Post ID  : {post['id']}")
print(f"Author ID: {post['userId']}")
print(f"Title    : {post['title'][:40]}...")
print(f"Body     : {post['body'][:50]}...")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — URL Builder

Write a function `build_url(base, **params)` that returns a URL with query parameters appended. For `build_url("https://api.example.com/search", q="python", page=2)` print:

Expected output:
```
https://api.example.com/search?q=python&page=2
```

<div class="pyodide-runner" data-mode="challenge" data-expected="https://api.example.com/search?q=python&page=2">
<pre><code class="language-python">def build_url(base, **params):
    # Build and return the URL with query string
    pass

print(build_url("https://api.example.com/search", q="python", page=2))
</code></pre>
</div>

---

## 📚 Further Reading

- [requests library docs](https://requests.readthedocs.io/)
- [HTTP Methods — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods)
- [HTTP Status Codes — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

---

!!! success "Lesson Complete 🎉"
    You now speak HTTP — the backbone of every web API. Next: build your own!

[⬅️ Lesson 8 · JSON & YAML](08-json-and-yaml.md){ .md-button } [➡️ Lesson 10 · Simple REST API with Flask](10-simple-rest-api-flask.md){ .md-button .md-button--primary }
