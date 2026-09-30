---
title: "Lesson 11 · Flask CRUD App"
description: "Master CRUD operations in Flask by building a structured in-memory Contacts API with Blueprints, routing, request parsing, and curl testing."
---

# Lesson 11 · Flask CRUD App

> **Section:** 🗄️ Databases, ORMs & Auth &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Explain the core CRUD paradigm (**C**reate, **R**ead, **U**pdate, **D**elete) and map it to HTTP verbs
- [ ] Build a modular Flask Contacts API using in-memory Python structures
- [ ] Implement `GET`, `POST`, `PUT`, and `DELETE` endpoints with proper status codes
- [ ] Structure large Flask applications using `Blueprint`
- [ ] Test endpoints using `curl` command-line requests

---

## 📖 Introduction

Every database-driven backend revolves around **CRUD**: creating, reading, updating, and deleting data records. When designing RESTful web services, we map these database operations directly to standard HTTP methods:

- **Create** $\rightarrow$ `POST /contacts` (201 Created)
- **Read** $\rightarrow$ `GET /contacts` or `GET /contacts/<id>` (200 OK)
- **Update** $\rightarrow$ `PUT /contacts/<id>` or `PATCH /contacts/<id>` (200 OK)
- **Delete** $\rightarrow$ `DELETE /contacts/<id>` (204 No Content or 200 OK)

In this lesson, you will build a clean Contacts REST API and learn how to keep your routes organized as your codebase grows using Flask **Blueprints**.

---

## 1. What is CRUD & RESTful Mapping?

In HTTP APIs, resources are represented as nouns (e.g., `/contacts`), and the HTTP method defines the action to execute.

| Operation | HTTP Method | Route | Description | Status Code |
| :--- | :--- | :--- | :--- | :--- |
| **Create** | `POST` | `/contacts` | Add a new contact record | `201 Created` |
| **Read (All)** | `GET` | `/contacts` | Fetch list of contacts | `200 OK` |
| **Read (One)** | `GET` | `/contacts/<id>` | Fetch contact by ID | `200 OK` / `404 Not Found` |
| **Update** | `PUT` | `/contacts/<id>` | Replace an entire contact record | `200 OK` / `404 Not Found` |
| **Delete** | `DELETE` | `/contacts/<id>` | Remove a contact | `204 No Content` / `404 Not Found` |

!!! info "PUT vs PATCH"
    `PUT` is typically used to replace the entire resource, whereas `PATCH` applies partial updates. For simple CRUD APIs, both patterns are common.

---

## 2. In-Memory Contacts API Implementation

Before introducing database engines, managing state with Python dictionaries allows us to focus entirely on route handling and response structure.

=== "Python"
```python
from flask import Flask, jsonify, request, abort

app = Flask(__name__)

# In-memory storage table
contacts = [
    {"id": 1, "name": "Alice Smith", "email": "alice@example.com", "phone": "555-0101"},
    {"id": 2, "name": "Bob Jones", "email": "bob@example.com", "phone": "555-0102"},
    {"id": 3, "name": "Carol White", "email": "carol@example.com", "phone": "555-0103"}
]
next_id = 4

def find_contact(contact_id):
    return next((c for c in contacts if c["id"] == contact_id), None)

# READ ALL (with optional query filter)
@app.route("/contacts", methods=["GET"])
def get_contacts():
    query = request.args.get("name")
    if query:
        filtered = [c for c in contacts if query.lower() in c["name"].lower()]
        return jsonify(filtered), 200
    return jsonify(contacts), 200

# READ ONE
@app.route("/contacts/<int:contact_id>", methods=["GET"])
def get_contact(contact_id):
    contact = find_contact(contact_id)
    if contact is None:
        abort(404, description=f"Contact {contact_id} not found")
    return jsonify(contact), 200

# CREATE
@app.route("/contacts", methods=["POST"])
def create_contact():
    global next_id
    data = request.get_json()
    if not data or "name" not in data or "email" not in data:
        abort(400, description="Fields 'name' and 'email' are required")
    
    new_contact = {
        "id": next_id,
        "name": data["name"],
        "email": data["email"],
        "phone": data.get("phone", "")
    }
    contacts.append(new_contact)
    next_id += 1
    return jsonify(new_contact), 201

# UPDATE
@app.route("/contacts/<int:contact_id>", methods=["PUT"])
def update_contact(contact_id):
    contact = find_contact(contact_id)
    if contact is None:
        abort(404, description=f"Contact {contact_id} not found")
    
    data = request.get_json() or {}
    contact["name"] = data.get("name", contact["name"])
    contact["email"] = data.get("email", contact["email"])
    contact["phone"] = data.get("phone", contact["phone"])
    return jsonify(contact), 200

# DELETE
@app.route("/contacts/<int:contact_id>", methods=["DELETE"])
def delete_contact(contact_id):
    contact = find_contact(contact_id)
    if contact is None:
        abort(404, description=f"Contact {contact_id} not found")
    contacts.remove(contact)
    return "", 204

if __name__ == "__main__":
    app.run(debug=True)
```

=== "Output"
```json
// Example GET /contacts/1 response
{
  "email": "alice@example.com",
  "id": 1,
  "name": "Alice Smith",
  "phone": "555-0101"
}
```

---

## 3. Organizing Routes with Blueprints

As applications grow, keeping all routes in a single `app.py` file creates merge conflicts and reduces maintainability. Flask **Blueprints** allow you to group related routes into separate modules.

```
contacts-app/
├── app.py
└── routes/
    ├── __init__.py
    └── contacts.py
```

=== "Python (`routes/contacts.py`)"
```python
from flask import Blueprint, jsonify, request, abort

contacts_bp = Blueprint("contacts", __name__, url_prefix="/api/contacts")

contacts = [
    {"id": 1, "name": "Alice Smith", "email": "alice@example.com"}
]

@contacts_bp.route("", methods=["GET"])
def get_all():
    return jsonify(contacts), 200

@contacts_bp.route("/<int:contact_id>", methods=["GET"])
def get_one(contact_id):
    contact = next((c for c in contacts if c["id"] == contact_id), None)
    if not contact:
        abort(404, description="Contact not found")
    return jsonify(contact), 200
```

=== "Python (`app.py`)"
```python
from flask import Flask
from routes.contacts import contacts_bp

app = Flask(__name__)
# Register the Blueprint with the main application instance
app.register_blueprint(contacts_bp)

if __name__ == "__main__":
    app.run(debug=True)
```

!!! tip "URL Prefixes"
    Specifying `url_prefix="/api/contacts"` on the Blueprint means `@contacts_bp.route("")` handles `/api/contacts` and `@contacts_bp.route("/<int:contact_id>")` handles `/api/contacts/1`.

---

## 4. Testing Endpoints with `curl`

You can test each CRUD operation directly from your terminal using `curl`:

=== "Commands"
```bash
# 1. Read all contacts
curl -i http://localhost:5000/contacts

# 2. Filter contacts by name query
curl -i "http://localhost:5000/contacts?name=Alice"

# 3. Create a new contact
curl -i -X POST http://localhost:5000/contacts \
  -H "Content-Type: application/json" \
  -d '{"name": "David Miller", "email": "david@example.com", "phone": "555-0104"}'

# 4. Update contact ID 1
curl -i -X PUT http://localhost:5000/contacts/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice Johnson", "email": "alice.j@example.com"}'

# 5. Delete contact ID 2
curl -i -X DELETE http://localhost:5000/contacts/2
```

=== "Output"
```http
HTTP/1.0 201 CREATED
Content-Type: application/json
Content-Length: 79
Server: Werkzeug/3.0.0 Python/3.11.0

{
  "email": "david@example.com",
  "id": 4,
  "name": "David Miller",
  "phone": "555-0104"
}
```

---

## 💻 Try It Yourself

Run and experiment with pure Python CRUD operations directly in your browser:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># In-memory CRUD simulation
contacts = [
    {"id": 1, "name": "Alice Smith", "email": "alice@example.com"},
    {"id": 2, "name": "Bob Jones", "email": "bob@example.com"},
]
next_id = 3

def create_contact(name, email):
    global next_id
    contact = {"id": next_id, "name": name, "email": email}
    contacts.append(contact)
    next_id += 1
    return contact

def find_contact(contact_id):
    return next((c for c in contacts if c["id"] == contact_id), None)

def update_contact(contact_id, **kwargs):
    contact = find_contact(contact_id)
    if contact:
        contact.update(kwargs)
    return contact

# Perform CRUD actions
new_user = create_contact("Charlie Brown", "charlie@example.com")
print(f"Created: {new_user['name']} (ID: {new_user['id']})")

updated = update_contact(1, email="alice.new@example.com")
print(f"Updated Contact 1: {updated['email']}")

print(f"Total contacts: {len(contacts)}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Substring Filter

Filter the `contacts` list to find the first contact whose `name` contains the substring `"Alice"`, and print just their name.

Expected output:
```
Alice
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Alice">
<pre><code class="language-python">contacts = [
    {"id": 1, "name": "Alice Smith", "email": "alice@example.com"},
    {"id": 2, "name": "Bob Jones", "email": "bob@example.com"},
    {"id": 3, "name": "Carol White", "email": "carol@example.com"}
]

# Find contact containing "Alice" and print their first name or full name matching "Alice"
target = next(c["name"].split()[0] for c in contacts if "Alice" in c["name"])
print(target)
</code></pre>
</div>

---

### Challenge 2 — Count Total Records

Count the total number of contacts present in the database list and print the integer number.

Expected output:
```
3
```

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">contacts = [
    {"id": 1, "name": "Alice Smith", "email": "alice@example.com"},
    {"id": 2, "name": "Bob Jones", "email": "bob@example.com"},
    {"id": 3, "name": "Carol White", "email": "carol@example.com"}
]

# Print the total count of contacts
print(len(contacts))
</code></pre>
</div>

---

## 📚 Further Reading

- [Flask Blueprints Documentation](https://flask.palletsprojects.com/en/latest/blueprints/)
- [RESTful API Designing Guidelines](https://restfulapi.net/)
- [HTTP Status Codes Reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)

---

!!! success "Lesson Complete 🎉"
    You've built a full CRUD API using Flask routing patterns and Blueprints! In the next lesson, we will replace in-memory data structures with a real SQLite relational database.

[⬅️ Section 1 · Lesson 10 · Simple REST API with Flask](../01-basics/10-simple-rest-api-flask.md){ .md-button } [➡️ Lesson 12 · Connecting Flask to SQLite](12-flask-sqlite.md){ .md-button .md-button--primary }
