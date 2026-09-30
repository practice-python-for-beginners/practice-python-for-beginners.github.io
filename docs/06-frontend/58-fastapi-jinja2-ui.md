---
title: "Lesson 58 · FastAPI UI with Jinja2"
description: "Build server-rendered HTML pages from FastAPI using Jinja2Templates, TemplateResponse, static files, mixed HTML/API routes, and HTMX for partial page updates."
---

# Lesson 58 · FastAPI UI with Jinja2

> **Section:** 🖥️ Frontend Integrations &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

- [ ] Set up `Jinja2Templates` in FastAPI
- [ ] Return `TemplateResponse` from route handlers
- [ ] Pass a typed context dict to templates
- [ ] Serve static files alongside HTML routes
- [ ] Mix `/api/…` JSON routes with `/…` HTML routes
- [ ] Use HTMX to update page fragments without a full reload

---

## 📖 Introduction

FastAPI is not just for JSON APIs. With `Jinja2Templates` and `TemplateResponse` you can serve fully rendered HTML pages — the same way Flask does. Add **HTMX** (a tiny JS library) and you get SPA-like partial page updates without writing a single line of JavaScript yourself.

Install: `pip install fastapi jinja2 python-multipart`

---

## 1. Jinja2Templates Setup

=== "app setup"
    ```python
    from fastapi import FastAPI, Request
    from fastapi.templating import Jinja2Templates
    from fastapi.staticfiles import StaticFiles

    app = FastAPI()
    app.mount("/static", StaticFiles(directory="static"), name="static")
    templates = Jinja2Templates(directory="templates")
    ```

=== "Project layout"
    ```
    project/
    ├── main.py
    ├── static/
    │   ├── css/style.css
    │   └── js/htmx.min.js
    └── templates/
        ├── base.html
        ├── index.html
        └── partials/
            └── product_row.html
    ```

=== "base.html"
    ```html+jinja
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <title>{% block title %}App{% endblock %}</title>
      <link rel="stylesheet" href="{{ request.url_for('static', path='css/style.css') }}">
      <script src="{{ request.url_for('static', path='js/htmx.min.js') }}" defer></script>
    </head>
    <body>
      {% block content %}{% endblock %}
    </body>
    </html>
    ```

!!! info "request must be in context"
    FastAPI requires you to pass `request` explicitly in the template context. Jinja2Templates uses it for `request.url_for()`.

---

## 2. TemplateResponse

=== "HTML route"
    ```python
    from fastapi import FastAPI, Request
    from fastapi.responses import HTMLResponse
    from fastapi.templating import Jinja2Templates
    from typing import List

    templates = Jinja2Templates(directory="templates")

    @app.get("/", response_class=HTMLResponse)
    async def index(request: Request):
        return templates.TemplateResponse(
            "index.html",
            {"request": request, "title": "Home", "user": None},
        )

    @app.get("/products", response_class=HTMLResponse)
    async def products(request: Request):
        items = await fetch_products()   # your DB query
        return templates.TemplateResponse(
            "products.html",
            {"request": request, "products": items},
        )
    ```

=== "Context typing"
    ```python
    from dataclasses import dataclass
    from typing import Any

    @dataclass
    class TemplateContext:
        request: Any          # FastAPI Request
        title: str = "App"
        user: dict | None = None

    # Usage
    ctx = TemplateContext(request=request, title="Products", user=current_user)
    return templates.TemplateResponse("products.html", vars(ctx))
    ```

---

## 3. Template Context

=== "index.html"
    ```html+jinja
    {% extends "base.html" %}

    {% block title %}{{ title }} — My Store{% endblock %}

    {% block content %}
    <h1>Products</h1>
    <table id="product-table">
      <thead><tr><th>Name</th><th>Price</th><th>Action</th></tr></thead>
      <tbody>
      {% for p in products %}
        <tr>
          <td>{{ p.name }}</td>
          <td>${{ "%.2f" | format(p.price) }}</td>
          <td>
            <button hx-delete="/products/{{ p.id }}"
                    hx-target="closest tr"
                    hx-swap="outerHTML">Delete</button>
          </td>
        </tr>
      {% endfor %}
      </tbody>
    </table>
    {% endblock %}
    ```

=== "Context values"
    | Key | Type | Notes |
    |----|------|-------|
    | `request` | `Request` | **Required** by Jinja2Templates |
    | `products` | `list[dict]` | Domain data |
    | `title` | `str` | Page title |
    | `flash` | `str \| None` | One-time message |

---

## 4. Mixing API and HTML Routes

=== "Dual endpoints"
    ```python
    from fastapi.responses import HTMLResponse
    from fastapi import Request
    from typing import List

    # JSON API — for JS / mobile clients
    @app.get("/api/products", response_model=List[Product])
    async def api_products():
        return await get_all_products()

    # HTML page — for server-rendered browsers
    @app.get("/products", response_class=HTMLResponse)
    async def html_products(request: Request):
        products = await get_all_products()
        return templates.TemplateResponse(
            "products.html",
            {"request": request, "products": products},
        )
    ```

!!! tip "Content negotiation"
    You can serve both from one route by inspecting the `Accept` header: if it contains `text/html` return `TemplateResponse`; otherwise return JSON.

---

## 5. HTMX for Partial Page Updates

=== "HTMX concept"
    ```html
    <!-- HTMX makes ANY element issue HTTP requests -->
    <!-- No JavaScript needed beyond loading htmx.min.js -->

    <!-- Load /products/search?q=... and swap result into #results -->
    <input type="search" name="q"
           hx-get="/products/search"
           hx-trigger="keyup changed delay:300ms"
           hx-target="#results"
           hx-swap="innerHTML">

    <div id="results"></div>
    ```

=== "FastAPI partial route"
    ```python
    @app.get("/products/search", response_class=HTMLResponse)
    async def search_products(request: Request, q: str = ""):
        results = await find_products(q)
        # Return only the table rows fragment, not a full page
        return templates.TemplateResponse(
            "partials/product_rows.html",
            {"request": request, "products": results},
        )
    ```

=== "partials/product_rows.html"
    ```html+jinja
    {% for p in products %}
    <tr>
      <td>{{ p.name }}</td>
      <td>${{ "%.2f" | format(p.price) }}</td>
    </tr>
    {% else %}
    <tr><td colspan="2">No results.</td></tr>
    {% endfor %}
    ```

| HTMX attribute | Behaviour |
|----------------|-----------|
| `hx-get` | Send GET on trigger |
| `hx-post` | Send POST on trigger |
| `hx-target` | CSS selector for swap destination |
| `hx-swap` | How to update: `innerHTML`, `outerHTML`, `beforeend` |
| `hx-trigger` | Event(s) that fire the request |

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate Jinja2 template rendering with context in pure Python
def render(template: str, context: dict) -> str:
    """Very simplified Jinja2-like renderer."""
    result = template
    for key, value in context.items():
        if isinstance(value, list):
            rows = "\n".join(
                f"  <tr><td>{item['name']}</td><td>${item['price']:.2f}</td></tr>"
                for item in value
            )
            result = result.replace("{{ " + key + " }}", rows)
        else:
            result = result.replace("{{ " + key + " }}", str(value))
    return result

template = "<h1>{{ title }}</h1>\n<table>\n{{ products }}\n</table>"
context = {
    "title": "Products",
    "products": [
        {"name": "Widget", "price": 9.99},
        {"name": "Gadget", "price": 24.50},
        {"name": "Doohickey", "price": 4.99},
    ],
}

output = render(template, context)
print(output)
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Rendered Item Count

Render a product list template and count the number of `<tr>` lines in the output.

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">products = [
    {"name": "Widget",    "price": 9.99},
    {"name": "Gadget",    "price": 24.50},
    {"name": "Doohickey", "price": 4.99},
]

# Build one "<tr>…</tr>" string per product, count them
rows = []
for p in products:
    pass  # add each row to the list

print(len(rows))
</code></pre>
</div>

---

### Challenge 2 — Conditional Template Block

Print `"Premium"` if a product's price is over 100, otherwise `"Standard"`.

<div class="pyodide-runner" data-mode="challenge" data-expected="Premium">
<pre><code class="language-python">product = {"name": "Pro Widget", "price": 149.99}

# Print "Premium" if price > 100, else "Standard"
label = ""  # your code here

print(label)
</code></pre>
</div>

---

## 📚 Further Reading

- [FastAPI — Jinja2 Templates](https://fastapi.tiangolo.com/advanced/templates/)
- [HTMX documentation](https://htmx.org/docs/)
- [FastAPI StaticFiles](https://fastapi.tiangolo.com/tutorial/static-files/)

---

!!! success "Lesson Complete 🎉"
    You can now build server-rendered FastAPI apps with Jinja2 and sprinkle in HTMX for interactive updates. Next: add async AJAX calls to a Flask backend!

[⬅️ Lesson 57 · Flask CRUD Frontend](57-flask-crud-frontend.md){ .md-button } [➡️ Lesson 59 · Integrating Flask APIs with AJAX](59-flask-ajax.md){ .md-button .md-button--primary }
