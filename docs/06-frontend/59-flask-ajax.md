---
title: "Lesson 59 · Integrating Flask APIs with AJAX"
description: "Learn AJAX concepts, compare jQuery vs fetch(), send JSON from JavaScript to Flask, handle CORS, return HTML fragments or JSON, and handle errors with loading spinners."
---

# Lesson 59 · Integrating Flask APIs with AJAX

> **Section:** 🖥️ Frontend Integrations &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

- [ ] Understand the AJAX model (async page updates without a full reload)
- [ ] Compare `jQuery.ajax()` with the native `fetch()` API
- [ ] POST JSON from JavaScript to a Flask route
- [ ] Return JSON vs HTML fragments from Flask AJAX endpoints
- [ ] Enable CORS for cross-origin AJAX requests using Flask-CORS
- [ ] Implement a loading spinner while awaiting responses
- [ ] Handle AJAX errors gracefully in the browser

---

## 📖 Introduction

**AJAX** (Asynchronous JavaScript and XML) lets the browser send HTTP requests and update parts of a page without navigating away. Modern code uses `fetch()` rather than jQuery, and JSON rather than XML — but the core concept is the same: update the UI without a full page reload.

---

## 1. AJAX Concept

=== "Traditional vs AJAX"
    ```
    Traditional form submit:
        User clicks Submit
        → Browser sends full POST
        → Server returns entire new HTML page
        → Browser reloads ← slow, loses scroll position

    AJAX:
        User clicks Search
        → JavaScript sends GET /api/search?q=…
        → Server returns JSON (or HTML fragment)
        → JavaScript updates only the <div id="results"> ← fast
    ```

=== "Use cases"
    | Use case | AJAX benefit |
    |----------|-------------|
    | Live search | Filter results as you type |
    | Infinite scroll | Load next page on scroll |
    | Like / favourite | Toggle state without reload |
    | Auto-save draft | Background save every 30s |
    | Chart refresh | Re-fetch data without page reload |

---

## 2. jQuery $.ajax vs fetch()

=== "fetch() — modern"
    ```js
    // GET
    fetch("/api/items")
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => renderItems(data))
      .catch(err => showError(err.message));

    // POST with JSON body
    fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Widget", price: 9.99 }),
    })
      .then(res => res.json())
      .then(item => appendItem(item));
    ```

=== "jQuery $.ajax"
    ```js
    // GET
    $.ajax({
      url: "/api/items",
      method: "GET",
      success: data => renderItems(data),
      error: (xhr, status, err) => showError(err),
    });

    // POST with JSON
    $.ajax({
      url: "/api/items",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ name: "Widget", price: 9.99 }),
      success: item => appendItem(item),
    });
    ```

=== "Comparison"
    | Feature | `fetch()` | `$.ajax` |
    |---------|-----------|---------|
    | Dependency | None (built-in) | jQuery required |
    | Promise-based | Yes | Deferred (jQuery) |
    | Stream support | Yes | No |
    | Error on 4xx/5xx | **No** — must check `res.ok` | Yes |
    | Browser support | IE11+ (polyfill) | All |

!!! warning "fetch() does NOT reject on 4xx/5xx"
    Always check `if (!res.ok) throw new Error(...)` — a 404 or 500 still resolves the promise without throwing.

---

## 3. Sending JSON from JS to Flask

=== "JavaScript (fetch)"
    ```js
    async function createItem(name, price) {
      const res = await fetch("/api/items", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, price }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Server error");
      }
      return await res.json();
    }
    ```

=== "Flask endpoint"
    ```python
    from flask import Flask, request, jsonify

    app = Flask(__name__)

    @app.route("/api/items", methods=["POST"])
    def create_item():
        data = request.get_json()
        if not data or "name" not in data:
            return jsonify({"detail": "name is required"}), 400
        item = {"id": 42, "name": data["name"], "price": data.get("price", 0)}
        return jsonify(item), 201
    ```

---

## 4. Handling CORS

=== "Flask-CORS setup"
    ```python
    from flask import Flask
    from flask_cors import CORS

    app = Flask(__name__)
    CORS(app, origins=["http://localhost:3000", "https://myapp.example.com"])
    ```

=== "Per-route CORS"
    ```python
    from flask_cors import cross_origin

    @app.route("/api/public")
    @cross_origin()   # allow all origins for this route only
    def public_endpoint():
        return jsonify({"data": "public"})
    ```

!!! info "Install Flask-CORS"
    `pip install flask-cors`  
    Needed only when your JavaScript runs on a **different origin** (different port = different origin in development).

---

## 5. JSON vs HTML Fragments, Spinners, and Error Handling

=== "Return HTML fragment"
    ```python
    from flask import render_template_string

    @app.route("/api/search")
    def search():
        q = request.args.get("q", "")
        results = [r for r in ITEMS if q.lower() in r["name"].lower()]
        # Return an HTML table body fragment
        rows = "".join(f"<tr><td>{r['name']}</td></tr>" for r in results)
        return rows, 200, {"Content-Type": "text/html"}
    ```

=== "Loading spinner"
    ```js
    async function search(q) {
      const spinner = document.getElementById("spinner");
      const results = document.getElementById("results");

      spinner.style.display = "block";
      results.innerHTML = "";

      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        results.innerHTML = await res.text();   // HTML fragment
      } catch (err) {
        results.innerHTML = `<p class="error">${err.message}</p>`;
      } finally {
        spinner.style.display = "none";
      }
    }
    ```

=== "Error types"
    | Error | Where it happens | How to handle |
    |-------|-----------------|---------------|
    | Network error | `.catch()` | Show "offline" message |
    | 4xx status | `!res.ok` | Show validation errors |
    | 5xx status | `!res.ok` | Show "try again" message |
    | JSON parse error | `.json()` throws | Catch and show raw text |

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate an AJAX request/response cycle in pure Python
import json

def mock_ajax(method: str, url: str, data: dict = None) -> dict:
    """Simulate a Flask AJAX handler."""
    db = [
        {"id": 1, "name": "Python Tutorial"},
        {"id": 2, "name": "Web Dev Basics"},
        {"id": 3, "name": "FastAPI Guide"},
        {"id": 4, "name": "Flask Patterns"},
        {"id": 5, "name": "Async Python"},
    ]
    if method == "GET" and url.startswith("/api/search"):
        q = url.split("q=")[-1] if "q=" in url else ""
        results = [item for item in db if q.lower() in item["name"].lower()]
        return {"status": 200, "data": results}
    if method == "POST" and url == "/api/items":
        new_item = {**data, "id": len(db) + 1}
        return {"status": 201, "data": new_item}
    return {"status": 404, "data": {"error": "not found"}}

# Simulate a live search
response = mock_ajax("GET", "/api/search?q=python")
print(f"Status: {response['status']}")
print(f"Results: {len(response['data'])}")
for item in response["data"]:
    print(f"  {item['id']}: {item['name']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Build AJAX Request Dict

Build an AJAX-style request dict with `method`, `url`, and `data`, then print the URL.

<div class="pyodide-runner" data-mode="challenge" data-expected="/api/search">
<pre><code class="language-python"># Build a request dict and print the url value
request = {}  # your code here — set method, url, data

print(request.get("url", ""))
</code></pre>
</div>

---

### Challenge 2 — Parse AJAX Response

Parse a mock AJAX JSON response and print the result count.

<div class="pyodide-runner" data-mode="challenge" data-expected="5">
<pre><code class="language-python">mock_response = {
    "status": 200,
    "data": [
        {"id": 1, "name": "Python Tutorial"},
        {"id": 2, "name": "Web Dev Basics"},
        {"id": 3, "name": "FastAPI Guide"},
        {"id": 4, "name": "Flask Patterns"},
        {"id": 5, "name": "Async Python"},
    ]
}

# Print the count of results in data
count = 0  # your code here

print(count)
</code></pre>
</div>

---

## 📚 Further Reading

- [MDN — Using Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [Flask-CORS documentation](https://flask-cors.readthedocs.io/)
- [MDN — AJAX Getting Started](https://developer.mozilla.org/en-US/docs/Web/Guide/AJAX/Getting_Started)

---

!!! success "Lesson Complete 🎉"
    You can now wire up async AJAX interactions between a JavaScript frontend and Flask backend. Time for the capstone: a Streamlit API Data Visualizer!

[⬅️ Lesson 58 · FastAPI UI with Jinja2](58-fastapi-jinja2-ui.md){ .md-button } [➡️ Lesson 60 · Streamlit API Data Visualizer](60-streamlit-visualizer.md){ .md-button .md-button--primary }
