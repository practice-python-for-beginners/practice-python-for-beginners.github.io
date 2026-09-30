---
title: "Lesson 52 · Building a Simple Flask Frontend"
description: "Learn Jinja2 templating, template inheritance, url_for(), static files, flash messages, and WTForms basics inside Flask."
---

# Lesson 52 · Building a Simple Flask Frontend

> **Section:** 🖥️ Frontend Integrations &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

- [ ] Use `{{ }}` and `{% %}` Jinja2 syntax to render dynamic HTML
- [ ] Implement template inheritance with `base.html` and `{% block %}`
- [ ] Pass data from Flask routes to templates with `render_template()`
- [ ] Generate URLs safely using `url_for()`
- [ ] Serve static CSS/JS files from the `static/` folder
- [ ] Send flash messages across redirects
- [ ] Build a basic form with WTForms

---

## 📖 Introduction

Flask's built-in template engine is **Jinja2** — a fast, expressive language that lets you embed Python-like expressions directly in HTML. Combined with template inheritance, `url_for()`, and Flash messages, you have everything you need to build a fully dynamic multi-page web application without a separate JavaScript framework.

---

## 1. Jinja2 Basics

=== "Syntax overview"
    ```html+jinja
    <!-- Output a variable -->
    <h1>Hello, {{ username }}!</h1>

    <!-- Conditional -->
    {% if user.is_admin %}
      <span class="badge">Admin</span>
    {% endif %}

    <!-- Loop -->
    <ul>
    {% for item in items %}
      <li>{{ item.name }} — {{ item.price | round(2) }}</li>
    {% endfor %}
    </ul>
    ```

=== "Filters"
    | Filter | Example | Output |
    |--------|---------|--------|
    | `upper` | `{{ "hello" \| upper }}` | `HELLO` |
    | `lower` | `{{ "WORLD" \| lower }}` | `world` |
    | `length` | `{{ items \| length }}` | `5` |
    | `default` | `{{ val \| default("N/A") }}` | `N/A` if falsy |
    | `truncate` | `{{ text \| truncate(20) }}` | First 20 chars |

=== "Flask route"
    ```python
    from flask import Flask, render_template

    app = Flask(__name__)

    @app.route("/")
    def index():
        items = [{"name": "Widget", "price": 9.99},
                 {"name": "Gadget", "price": 19.50}]
        return render_template("index.html", items=items, username="Alice")
    ```

!!! tip "Auto-escaping"
    Jinja2 escapes HTML by default — `<script>` in a variable becomes `&lt;script&gt;`. Use `{{ var | safe }}` only for trusted content.

---

## 2. Template Inheritance

=== "base.html"
    ```html+jinja
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>{% block title %}My Site{% endblock %}</title>
      <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
    </head>
    <body>
      <nav><a href="{{ url_for('index') }}">Home</a></nav>
      <main>
        {% block content %}{% endblock %}
      </main>
      <footer>© 2025 My App</footer>
    </body>
    </html>
    ```

=== "page.html (child)"
    ```html+jinja
    {% extends "base.html" %}

    {% block title %}Products — My Site{% endblock %}

    {% block content %}
    <h1>Products</h1>
    <ul>
      {% for p in products %}
        <li><a href="{{ url_for('product_detail', id=p.id) }}">{{ p.name }}</a></li>
      {% endfor %}
    </ul>
    {% endblock %}
    ```

=== "Project layout"
    ```
    myapp/
    ├── app.py
    ├── static/
    │   ├── css/style.css
    │   └── js/main.js
    └── templates/
        ├── base.html
        ├── index.html
        └── products.html
    ```

---

## 3. url_for() and Static Files

=== "url_for() examples"
    ```python
    from flask import url_for

    # In a route function or template:
    url_for("index")                          # "/"
    url_for("product_detail", id=42)          # "/products/42"
    url_for("static", filename="css/style.css")  # "/static/css/style.css"
    ```

=== "Serving static files"
    ```python
    # Flask serves everything in static/ automatically at /static/<path>
    # In templates use url_for to avoid hardcoding paths:

    # CSS
    # <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">

    # JS (before </body>)
    # <script src="{{ url_for('static', filename='js/main.js') }}"></script>
    ```

!!! info "Why url_for()?"
    Hard-coded paths break when you deploy behind a sub-path (e.g. `/myapp/`). `url_for()` always produces the correct absolute path.

---

## 4. Flash Messages

=== "Route code"
    ```python
    from flask import Flask, redirect, url_for, flash, render_template

    app = Flask(__name__)
    app.secret_key = "change-me-in-production"

    @app.route("/save", methods=["POST"])
    def save():
        # ... save logic ...
        flash("Record saved successfully!", "success")
        return redirect(url_for("index"))

    @app.route("/delete/<int:id>", methods=["POST"])
    def delete(id):
        flash(f"Item {id} deleted.", "warning")
        return redirect(url_for("index"))
    ```

=== "base.html (display flashes)"
    ```html+jinja
    {% with messages = get_flashed_messages(with_categories=True) %}
      {% for category, message in messages %}
        <div class="alert alert-{{ category }}">{{ message }}</div>
      {% endfor %}
    {% endwith %}
    ```

| Category | Bootstrap class | Use for |
|----------|-----------------|---------|
| `success` | `alert-success` | Saved, created |
| `warning` | `alert-warning` | Deleted, changed |
| `danger` | `alert-danger` | Errors |
| `info` | `alert-info` | Neutral notices |

---

## 5. WTForms Basics

=== "Form definition"
    ```python
    from flask_wtf import FlaskForm
    from wtforms import StringField, SubmitField
    from wtforms.validators import DataRequired, Email

    class ContactForm(FlaskForm):
        name  = StringField("Name",  validators=[DataRequired()])
        email = StringField("Email", validators=[DataRequired(), Email()])
        submit = SubmitField("Send")
    ```

=== "Route with form"
    ```python
    from flask import render_template, redirect, url_for, flash

    @app.route("/contact", methods=["GET", "POST"])
    def contact():
        form = ContactForm()
        if form.validate_on_submit():
            flash(f"Thanks, {form.name.data}!", "success")
            return redirect(url_for("index"))
        return render_template("contact.html", form=form)
    ```

=== "Template"
    ```html+jinja
    <form method="POST">
      {{ form.hidden_tag() }}   {# CSRF token #}
      <div>
        {{ form.name.label }}
        {{ form.name(class="form-control") }}
        {% for error in form.name.errors %}
          <span class="error">{{ error }}</span>
        {% endfor %}
      </div>
      {{ form.submit(class="btn btn-primary") }}
    </form>
    ```

!!! warning "CSRF protection"
    `{{ form.hidden_tag() }}` renders a hidden CSRF token. Without it, `validate_on_submit()` returns `False` on every POST.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate Jinja2 template rendering in pure Python
def render_template(template: str, context: dict) -> str:
    result = template
    for key, value in context.items():
        if isinstance(value, list):
            items_html = "\n".join(f"  <li>{v}</li>" for v in value)
            result = result.replace("{{ " + key + " }}", items_html)
        else:
            result = result.replace("{{ " + key + " }}", str(value))
    return result

template = "Hello, {{ username }}! You have {{ count }} messages."
context  = {"username": "Alice", "count": 5}

output = render_template(template, context)
print(output)

list_template = "<ul>\n{{ items }}\n</ul>"
list_ctx = {"items": ["Python", "Flask", "Jinja2"]}
print(render_template(list_template, list_ctx))
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Render a Greeting

Use the mock `render_template` function to produce `Hello, Alice!`.

<div class="pyodide-runner" data-mode="challenge" data-expected="Hello, Alice!">
<pre><code class="language-python">def render_template(template: str, context: dict) -> str:
    for key, value in context.items():
        template = template.replace("{{ " + key + " }}", str(value))
    return template

# Your code: define template and context, then print the result
template = ""   # fill in
context  = {}   # fill in

print(render_template(template, context))
</code></pre>
</div>

---

### Challenge 2 — Render a List

Render a list of 3 items as bullet-point lines and print the number of output lines.

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">items = ["Python", "Flask", "Jinja2"]

# Render each item as "- item" and print the count of lines
lines = []
for item in items:
    pass  # build the lines list

print(len(lines))
</code></pre>
</div>

---

## 📚 Further Reading

- [Jinja2 Template Designer Docs](https://jinja.palletsprojects.com/en/3.1.x/templates/)
- [Flask — Templating](https://flask.palletsprojects.com/en/3.0.x/templating/)
- [Flask-WTF documentation](https://flask-wtf.readthedocs.io/)

---

!!! success "Lesson Complete 🎉"
    You can now build multi-page Flask apps with inheritance, dynamic data, flash messages, and validated forms. Next: serve a JavaScript SPA from FastAPI!

[⬅️ Lesson 51 · Consuming APIs with Python](51-consuming-apis.md){ .md-button } [➡️ Lesson 53 · FastAPI with JavaScript Frontend](53-fastapi-js-frontend.md){ .md-button .md-button--primary }
