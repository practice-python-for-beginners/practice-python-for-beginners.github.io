---
title: "Lesson 57 · Flask CRUD Frontend"
description: "Build a full Create-Read-Update-Delete web interface with HTML forms, WTForms validation, CSRF protection, the PRG pattern, and Bootstrap 5 styling."
---

# Lesson 57 · Flask CRUD Frontend

> **Section:** 🖥️ Frontend Integrations &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Build HTML forms that POST data to Flask routes
- [ ] Validate form input with WTForms validators
- [ ] Display field-level error messages in templates
- [ ] Apply the Post-Redirect-Get (PRG) pattern to prevent duplicate submissions
- [ ] Protect forms with Flask-WTF CSRF tokens
- [ ] Style forms with Bootstrap 5 classes
- [ ] Add client-side HTML5 validation attributes

---

## 📖 Introduction

Every real application needs CRUD — Create, Read, Update, Delete. In a Flask server-rendered app, this flows through HTML forms, WTForms validation, flash messages, and the PRG pattern. Getting these right means fewer bugs, no duplicate submissions, and a secure, polished user experience.

Install: `pip install flask flask-wtf wtforms[email] email-validator`

---

## 1. HTML Forms in Flask

=== "Basic form"
    ```html+jinja
    <!-- templates/users/create.html -->
    <form method="POST" action="{{ url_for('users.create') }}">
      {{ form.hidden_tag() }}  {# CSRF token #}

      <div class="mb-3">
        {{ form.name.label(class="form-label") }}
        {{ form.name(class="form-control", placeholder="Full name") }}
      </div>

      <div class="mb-3">
        {{ form.email.label(class="form-label") }}
        {{ form.email(class="form-control", type="email") }}
      </div>

      <button type="submit" class="btn btn-primary">Create User</button>
      <a href="{{ url_for('users.list') }}" class="btn btn-secondary">Cancel</a>
    </form>
    ```

=== "Flask route"
    ```python
    from flask import Blueprint, render_template, redirect, url_for, flash
    from .forms import UserForm
    from .models import User, db

    users_bp = Blueprint("users", __name__, url_prefix="/users")

    @users_bp.route("/new", methods=["GET", "POST"])
    def create():
        form = UserForm()
        if form.validate_on_submit():
            user = User(name=form.name.data, email=form.email.data)
            db.session.add(user)
            db.session.commit()
            flash(f"User '{user.name}' created!", "success")
            return redirect(url_for("users.list"))   # PRG pattern
        return render_template("users/create.html", form=form)
    ```

---

## 2. WTForms Validation

=== "Form class"
    ```python
    from flask_wtf import FlaskForm
    from wtforms import StringField, SelectField, TextAreaField, SubmitField
    from wtforms.validators import DataRequired, Email, Length, Optional, URL

    class UserForm(FlaskForm):
        name  = StringField("Full Name", validators=[
            DataRequired(message="Name is required"),
            Length(min=2, max=100),
        ])
        email = StringField("Email", validators=[
            DataRequired(message="Email is required"),
            Email(message="Invalid email address"),
        ])
        role  = SelectField("Role", choices=[
            ("viewer", "Viewer"), ("editor", "Editor"), ("admin", "Admin")
        ])
        bio   = TextAreaField("Bio", validators=[Optional(), Length(max=500)])
        submit = SubmitField("Save")
    ```

=== "Built-in validators"
    | Validator | Behaviour |
    |-----------|-----------|
    | `DataRequired()` | Non-empty, non-whitespace value |
    | `Email()` | Valid email format |
    | `Length(min, max)` | String length bounds |
    | `NumberRange(min, max)` | Numeric bounds |
    | `Regexp(pattern)` | Regex match |
    | `EqualTo("field")` | Confirm-password style match |

=== "Template errors"
    ```html+jinja
    {{ form.email(class="form-control" + (" is-invalid" if form.email.errors else "")) }}
    {% for error in form.email.errors %}
      <div class="invalid-feedback">{{ error }}</div>
    {% endfor %}
    ```

!!! tip "validate_on_submit()"
    This helper returns `True` only when the request is a POST **and** all validators pass. For GET requests it always returns `False`, so you can share the same route for rendering the empty form and handling the submission.

---

## 3. Post-Redirect-Get (PRG) Pattern

=== "Why PRG?"
    ```
    Without PRG:
        POST /users/new → 200 (renders success page)
        User hits F5 → browser re-submits POST → duplicate record!

    With PRG:
        POST /users/new → 302 redirect → GET /users/
        User hits F5 → browser re-issues GET → safe
    ```

=== "Implementation"
    ```python
    @users_bp.route("/new", methods=["GET", "POST"])
    def create():
        form = UserForm()
        if form.validate_on_submit():
            # ... save to DB ...
            flash("User created!", "success")
            return redirect(url_for("users.list"))  # ← the redirect
        # Validation failed: re-render form with errors
        return render_template("users/create.html", form=form)
    ```

---

## 4. CSRF Protection with Flask-WTF

=== "Setup"
    ```python
    from flask import Flask
    from flask_wtf.csrf import CSRFProtect

    app = Flask(__name__)
    app.config["SECRET_KEY"] = "your-secret-key-here"
    app.config["WTF_CSRF_ENABLED"] = True   # default True

    csrf = CSRFProtect(app)
    ```

=== "Exempt an API route"
    ```python
    from flask_wtf.csrf import csrf_exempt

    @app.route("/api/webhook", methods=["POST"])
    @csrf_exempt
    def webhook():
        # Webhook payloads come from external services — no CSRF token
        return {"ok": True}
    ```

!!! warning "Secret key in production"
    Set `SECRET_KEY` from an environment variable, not from source code. A leaked secret key means forged sessions and bypassed CSRF protection.

---

## 5. Bootstrap 5 Form Styling & Client-Side Validation

=== "Bootstrap classes"
    ```html+jinja
    <div class="mb-3">
      <label class="form-label">Email</label>
      <input type="email" name="email" class="form-control"
             required minlength="5" maxlength="254"
             placeholder="you@example.com">
      <div class="valid-feedback">Looks good!</div>
      <div class="invalid-feedback">Please enter a valid email.</div>
    </div>
    ```

=== "Activate Bootstrap validation"
    ```html
    <!-- Enable HTML5 constraint validation + Bootstrap styles -->
    <form class="needs-validation" novalidate>
      ...
    </form>
    <script>
    document.querySelectorAll(".needs-validation").forEach(form => {
      form.addEventListener("submit", e => {
        if (!form.checkValidity()) {
          e.preventDefault();
          e.stopPropagation();
        }
        form.classList.add("was-validated");
      });
    });
    </script>
    ```

| HTML5 attribute | Validates |
|-----------------|-----------|
| `required` | Non-empty |
| `type="email"` | Email format |
| `minlength` / `maxlength` | String length |
| `pattern` | Regex |
| `min` / `max` | Number range |

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate WTForms-style validation in pure Python
def validate_form(data: dict) -> dict:
    errors = {}

    if not data.get("name", "").strip():
        errors["name"] = "name is required"

    email = data.get("email", "").strip()
    if not email:
        errors["email"] = "email is required"
    elif "@" not in email or "." not in email.split("@")[-1]:
        errors["email"] = "invalid email format"

    return errors

# Test 1: missing name
errors = validate_form({"name": "", "email": "alice@example.com"})
print("Test 1 errors:", errors)

# Test 2: invalid email
errors = validate_form({"name": "Alice", "email": "not-an-email"})
print("Test 2 errors:", errors)

# Test 3: valid form
errors = validate_form({"name": "Alice", "email": "alice@example.com"})
print("Test 3 errors:", errors if errors else "none — form is valid")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Missing Email

Validate a form dict that is missing the `email` field. Print the error message.

<div class="pyodide-runner" data-mode="challenge" data-expected="email is required">
<pre><code class="language-python">def validate_form(data: dict) -> dict:
    errors = {}
    if not data.get("name", "").strip():
        errors["name"] = "name is required"
    if not data.get("email", "").strip():
        errors["email"] = "email is required"
    return errors

form_data = {"name": "Alice"}  # no email

errors = validate_form(form_data)
# Print the email error message
print(errors.get("email", ""))
</code></pre>
</div>

---

### Challenge 2 — Valid Email Check

Check whether an email string is valid. Print `True` for a valid email.

<div class="pyodide-runner" data-mode="challenge" data-expected="True">
<pre><code class="language-python">def is_valid_email(email: str) -> bool:
    # Simple validation: must have @ and a dot after @
    pass  # your code here

result = is_valid_email("alice@example.com")
print(result)
</code></pre>
</div>

---

## 📚 Further Reading

- [Flask-WTF documentation](https://flask-wtf.readthedocs.io/)
- [WTForms validators](https://wtforms.readthedocs.io/en/stable/validators/)
- [Bootstrap 5 — Forms](https://getbootstrap.com/docs/5.3/forms/overview/)

---

!!! success "Lesson Complete 🎉"
    You can now build validated, CSRF-protected, Bootstrap-styled CRUD forms in Flask. Next: achieve the same server-rendered UI in FastAPI with Jinja2 and HTMX!

[⬅️ Lesson 56 · FastAPI Dashboard with React](56-fastapi-react.md){ .md-button } [➡️ Lesson 58 · FastAPI UI with Jinja2](58-fastapi-jinja2-ui.md){ .md-button .md-button--primary }
