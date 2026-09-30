---
title: "Lesson 26 · Notes REST API with Auth"
description: "Combine JWT authentication with CRUD for a notes API. Learn protected routes, note ownership, token creation and verification, and the response envelope pattern."
---

# Lesson 26 · Notes REST API with Auth

> **Section:** 🌐 Real-World API Projects &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~75 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain how JWT (JSON Web Token) authentication protects API routes
- [ ] Create and verify tokens that carry a `user_id` claim
- [ ] Link notes to users via a `user_id` field
- [ ] Enforce ownership — only the note's author can edit or delete it
- [ ] Use the response envelope pattern (`{"data": ..., "error": null}`)

---

## 📖 Introduction

A notes API is an ideal project for learning auth because every operation needs ownership enforcement: you can read anyone's public notes, but you can only edit or delete your own. JWT tokens make this easy — the token itself carries the `user_id`, so no database lookup is needed to identify the caller.

!!! info "JWT in the browser demo"
    Real JWT creation uses the `PyJWT` library and a secret key. In this lesson we simulate tokens with base64-encoded dicts so everything runs in the browser without external dependencies. The patterns are identical to real JWT usage.

---

## 1. How JWTs Work (Simplified)

A JWT has three base64-encoded parts separated by dots: `header.payload.signature`.

=== "Python"
    ```python
    import json
    import base64

    def encode_token(payload: dict) -> str:
        """Simulate JWT encoding (no signature — demo only)."""
        data = json.dumps(payload).encode()
        return base64.urlsafe_b64encode(data).decode().rstrip("=")

    def decode_token(token: str) -> dict:
        """Simulate JWT decoding."""
        # Add padding back
        padding = 4 - len(token) % 4
        padded = token + "=" * (padding % 4)
        data = base64.urlsafe_b64decode(padded)
        return json.loads(data)

    # Create a token for user 42
    token = encode_token({"user_id": 42, "role": "user"})
    print("Token:", token[:30] + "...")

    # Verify and extract claims
    claims = decode_token(token)
    print("user_id:", claims["user_id"])
    print("role:   ", claims["role"])
    ```
=== "Output"
    ```
    Token: eyJ1c2VyX2lkIjogNDIsICJyb2xl...
    user_id: 42
    role:    user
    ```

!!! warning "Never use this in production!"
    The demo above has **no signature**. A real JWT uses HMAC-SHA256 to sign the payload so it cannot be forged. Always use `PyJWT` with a strong secret key in production.

---

## 2. Note Ownership Model

Each note belongs to a user via `user_id`:

=== "Python"
    ```python
    notes = {
        "1": {"id": "1", "user_id": 1, "title": "Shopping list",   "body": "Milk, eggs",    "private": False},
        "2": {"id": "2", "user_id": 1, "title": "Work meeting",    "body": "9am standup",   "private": True},
        "3": {"id": "3", "user_id": 2, "title": "Recipe ideas",    "body": "Pasta bake",    "private": False},
        "4": {"id": "4", "user_id": 2, "title": "Secret project",  "body": "Top secret...", "private": True},
        "5": {"id": "5", "user_id": 3, "title": "Book notes",      "body": "Chapter 3...",  "private": False},
    }

    def get_user_notes(notes_db: dict, user_id: int) -> list:
        return [n for n in notes_db.values() if n["user_id"] == user_id]

    user1_notes = get_user_notes(notes, 1)
    user2_notes = get_user_notes(notes, 2)

    print(f"User 1 has {len(user1_notes)} notes")
    print(f"User 2 has {len(user2_notes)} notes")
    ```
=== "Output"
    ```
    User 1 has 2 notes
    User 2 has 2 notes
    ```

---

## 3. Protected Routes and Ownership Checks

=== "Python"
    ```python
    def check_ownership(note: dict, caller_user_id: int) -> bool:
        """Return True if the caller owns the note."""
        return note["user_id"] == caller_user_id

    def update_note(notes_db, note_id, caller_id, new_body):
        """Update a note — only the owner can do this."""
        note = notes_db.get(note_id)
        if not note:
            return {"error": "Note not found", "status": 404}
        if not check_ownership(note, caller_id):
            return {"error": "Forbidden — not your note", "status": 403}
        note["body"] = new_body
        return {"data": note, "error": None, "status": 200}

    notes_db = {
        "10": {"id": "10", "user_id": 5, "title": "My note", "body": "Original text"},
    }

    # Owner updates their own note
    print(update_note(notes_db, "10", caller_id=5, new_body="Updated!"))

    # Different user tries to update
    print(update_note(notes_db, "10", caller_id=99, new_body="Hacked!"))
    ```
=== "Output"
    ```
    {'data': {'id': '10', 'user_id': 5, 'title': 'My note', 'body': 'Updated!'}, 'error': None, 'status': 200}
    {'error': 'Forbidden — not your note', 'status': 403}
    ```

!!! tip "403 vs 404 for hidden resources"
    Returning `404` (not found) instead of `403` (forbidden) for private resources is a security best practice — it doesn't reveal whether the resource exists to an unauthorised caller.

---

## 4. The Response Envelope Pattern

Wrap every API response in a consistent envelope:

=== "Python"
    ```python
    def make_response(data=None, error=None, status=200) -> dict:
        return {"data": data, "error": error, "status": status}

    def get_note(notes_db: dict, note_id: str, caller_id: int) -> dict:
        note = notes_db.get(note_id)
        if not note:
            return make_response(error="Note not found", status=404)
        if note.get("private") and note["user_id"] != caller_id:
            return make_response(error="Forbidden", status=403)
        return make_response(data=note)

    notes_db = {
        "1": {"id": "1", "user_id": 1, "title": "Public note",  "body": "Hello", "private": False},
        "2": {"id": "2", "user_id": 1, "title": "Private note", "body": "Secret", "private": True},
    }

    # Public note — any user can read
    print(get_note(notes_db, "1", caller_id=99))

    # Private note — owner can read
    print(get_note(notes_db, "2", caller_id=1))

    # Private note — stranger blocked
    print(get_note(notes_db, "2", caller_id=99))
    ```
=== "Output"
    ```
    {'data': {'id': '1', 'user_id': 1, 'title': 'Public note', 'body': 'Hello', 'private': False}, 'error': None, 'status': 200}
    {'data': {'id': '2', 'user_id': 1, 'title': 'Private note', 'body': 'Secret', 'private': True}, 'error': None, 'status': 200}
    {'data': None, 'error': 'Forbidden', 'status': 403}
    ```

---

## 5. Creating and Deleting Notes with Auth

=== "Python"
    ```python
    import json, base64

    def decode_token(token):
        padding = 4 - len(token) % 4
        padded  = token + "=" * (padding % 4)
        return json.loads(base64.urlsafe_b64decode(padded))

    notes_store = {}
    _next_id    = [1]

    def create_note(token: str, title: str, body: str, private=False) -> dict:
        claims = decode_token(token)
        note_id = str(_next_id[0])
        _next_id[0] += 1
        note = {"id": note_id, "user_id": claims["user_id"],
                "title": title, "body": body, "private": private}
        notes_store[note_id] = note
        return {"data": note, "error": None, "status": 201}

    # Simulate a token for user 7
    import json, base64
    payload = json.dumps({"user_id": 7}).encode()
    token   = base64.urlsafe_b64encode(payload).decode().rstrip("=")

    result = create_note(token, "My First Note", "Hello, world!")
    print(result["data"])
    print(f"Stored {len(notes_store)} note(s)")
    ```
=== "Output"
    ```
    {'id': '1', 'user_id': 7, 'title': 'My First Note', 'body': 'Hello, world!', 'private': False}
    Stored 1 note(s)
    ```

!!! note "In production use PyJWT"
    ```python
    import jwt
    token  = jwt.encode({"user_id": 7}, SECRET_KEY, algorithm="HS256")
    claims = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    ```

---

## 💻 Try It Yourself

Simulate note ownership check — given a note's `user_id` and a token's `user_id`, print `"allowed"` or `"denied"`:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import json, base64

def decode_token(token):
    padding = 4 - len(token) % 4
    padded  = token + "=" * (padding % 4)
    return json.loads(base64.urlsafe_b64decode(padded))

def check_access(note_user_id, token):
    claims = decode_token(token)
    return "allowed" if claims["user_id"] == note_user_id else "denied"

# Create tokens for two users
def make_token(user_id):
    payload = json.dumps({"user_id": user_id}).encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")

note = {"id": "5", "user_id": 3, "title": "Private"}

owner_token    = make_token(3)   # same as note owner
stranger_token = make_token(9)   # different user

print(check_access(note["user_id"], owner_token))
print(check_access(note["user_id"], stranger_token))
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Filter Notes by User

Filter the notes list to show only notes owned by `user_id=2` and print the count.

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">notes = [
    {"id": "1", "user_id": 1, "title": "Note A"},
    {"id": "2", "user_id": 2, "title": "Note B"},
    {"id": "3", "user_id": 1, "title": "Note C"},
    {"id": "4", "user_id": 2, "title": "Note D"},
    {"id": "5", "user_id": 3, "title": "Note E"},
]

# Filter notes where user_id == 2 and print the count
</code></pre>
</div>

---

### Challenge 2 — Decode a Token

Decode the token below and print the `user_id` value it contains.

<div class="pyodide-runner" data-mode="challenge" data-expected="42">
<pre><code class="language-python">import json, base64

token = base64.urlsafe_b64encode(json.dumps({"user_id": 42, "role": "admin"}).encode()).decode().rstrip("=")

# Decode the token and print its user_id
</code></pre>
</div>

---

## 📚 Further Reading

- [JWT.io — JWT Debugger and Introduction](https://jwt.io/introduction)
- [Real Python — Token-Based Authentication with Flask](https://realpython.com/token-based-authentication-with-flask/)
- [OWASP — REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

---

!!! success "Lesson Complete 🎉"
    You now understand how to combine JWT auth with note ownership, protect routes, return consistent envelope responses, and prevent unauthorised access to private resources.

[⬅️ Lesson 25 · Book Library API](25-book-library-api.md){ .md-button } [➡️ Lesson 27 · Image Upload API](27-image-upload-api.md){ .md-button .md-button--primary }
