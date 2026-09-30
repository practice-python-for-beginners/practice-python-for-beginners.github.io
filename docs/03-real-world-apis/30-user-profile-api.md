---
title: "Lesson 30 · User Profile Management API"
description: "Build a user profile resource with PATCH partial updates, email uniqueness, avatar URL validation, profile completion percentage, and public vs private field control."
---

# Lesson 30 · User Profile Management API

> **Section:** 🌐 Real-World API Projects &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Design a `UserProfile` resource with all standard fields
- [ ] Implement `PATCH` for partial updates (only update fields provided)
- [ ] Enforce email uniqueness across all profiles
- [ ] Compute a profile completion percentage from filled fields
- [ ] Separate public-facing fields from private (internal) fields

---

## 📖 Introduction

User profiles are ubiquitous — every app that has accounts needs one. The interesting challenges are partial updates (`PATCH` vs `PUT`), uniqueness constraints on mutable fields like email, computed attributes like completion percentage, and carefully controlling which fields are returned in public API responses versus internal ones.

!!! info "Profile completeness drives engagement"
    LinkedIn, GitHub, and most social platforms show a profile strength indicator. Users with complete profiles are significantly more engaged — computing and surfacing this score is genuinely valuable product work.

---

## 1. The User Profile Schema

=== "Python"
    ```python
    from datetime import datetime

    def new_profile(user_id: int, name: str, email: str) -> dict:
        """Create a new user profile with defaults."""
        return {
            # Core fields
            "id":         user_id,
            "name":       name,
            "email":      email,
            # Optional profile fields
            "bio":        None,
            "avatar_url": None,
            "location":   None,
            "website":    None,
            # Metadata
            "created_at": datetime.utcnow().isoformat(),
            "is_public":  True,
            # Private (never returned in public API)
            "_password_hash": None,
            "_login_count":   0,
        }

    profile = new_profile(1, "Alice Zhang", "alice@example.com")
    # Public fields only
    public_fields = {k: v for k, v in profile.items() if not k.startswith("_")}
    for k, v in public_fields.items():
        print(f"  {k:12}: {v}")
    ```
=== "Output"
    ```
      id          : 1
      name        : Alice Zhang
      email       : alice@example.com
      bio         : None
      avatar_url  : None
      location    : None
      website     : None
      created_at  : 2024-11-15T10:00:00
      is_public   : True
    ```

!!! tip "Use underscore prefix for private fields"
    Prefixing internal-only fields with `_` is a Python convention for "not part of the public API". Strip them before returning responses.

---

## 2. PATCH — Partial Updates

`PATCH` updates only the fields supplied in the request body. `PUT` replaces the entire resource.

=== "Python"
    ```python
    PATCHABLE = {"name", "bio", "avatar_url", "location", "website", "is_public"}

    def patch_profile(profile: dict, updates: dict) -> dict:
        """Apply partial updates — only patch allowed fields."""
        applied = {}
        rejected = {}

        for key, value in updates.items():
            if key in PATCHABLE:
                profile[key] = value
                applied[key] = value
            else:
                rejected[key] = "Field is read-only or unknown"

        return {
            "updated": applied,
            "rejected": rejected,
            "profile": {k: v for k, v in profile.items()
                        if not k.startswith("_")},
        }

    profile = new_profile(2, "Bob Lee", "bob@example.com")

    result = patch_profile(profile, {
        "bio":        "Python developer at a fintech startup.",
        "location":   "London, UK",
        "id":         999,       # should be rejected
        "created_at": "hacked",  # should be rejected
    })

    print("Applied :", result["updated"])
    print("Rejected:", result["rejected"])
    ```
=== "Output"
    ```
    Applied : {'bio': 'Python developer at a fintech startup.', 'location': 'London, UK'}
    Rejected: {'id': 'Field is read-only or unknown', 'created_at': 'Field is read-only or unknown'}
    ```

!!! warning "Validate values, not just field names"
    PATCH should also validate the data type and format of new values. For example, `avatar_url` should be a valid URL, and `name` should not be an empty string.

---

## 3. Email Uniqueness Check

=== "Python"
    ```python
    import re

    profiles_db = {}
    EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$")

    def update_email(profiles: dict, user_id: int, new_email: str) -> dict:
        """Update email with format validation and uniqueness check."""
        if not EMAIL_REGEX.match(new_email):
            return {"error": "Invalid email format", "status": 400}

        # Check if another user already has this email
        existing = next(
            (p for p in profiles.values()
             if p["email"] == new_email and p["id"] != user_id),
            None
        )
        if existing:
            return {"error": "Email already in use", "status": 409}

        profiles[user_id]["email"] = new_email
        return {"status": 200, "email": new_email}

    profiles_db = {
        1: {"id": 1, "name": "Alice", "email": "alice@example.com"},
        2: {"id": 2, "name": "Bob",   "email": "bob@example.com"},
    }

    print(update_email(profiles_db, 2, "newemail@example.com"))   # OK
    print(update_email(profiles_db, 2, "alice@example.com"))       # conflict
    print(update_email(profiles_db, 2, "notanemail"))              # invalid
    ```
=== "Output"
    ```
    {'status': 200, 'email': 'newemail@example.com'}
    {'error': 'Email already in use', 'status': 409}
    {'error': 'Invalid email format', 'status': 400}
    ```

---

## 4. Profile Completion Percentage

=== "Python"
    ```python
    COMPLETION_FIELDS = ["name", "email", "bio", "avatar_url", "location", "website"]

    def completion_pct(profile: dict) -> str:
        """Return completion as a percentage string like '67%'."""
        filled = sum(1 for f in COMPLETION_FIELDS if profile.get(f))
        pct    = round(filled / len(COMPLETION_FIELDS) * 100)
        return f"{pct}%"

    profiles_test = [
        {"name": "Alice", "email": "a@ex.com", "bio": "Dev",   "avatar_url": "https://ex.com/a.jpg", "location": None,       "website": None},
        {"name": "Bob",   "email": "b@ex.com", "bio": None,    "avatar_url": None,                    "location": "London",   "website": "https://bob.dev"},
        {"name": "Carol", "email": "c@ex.com", "bio": "PM",    "avatar_url": "https://ex.com/c.jpg",  "location": "Berlin",   "website": "https://carol.io"},
    ]

    for p in profiles_test:
        print(f"  {p['name']:6}: {completion_pct(p)}")
    ```
=== "Output"
    ```
      Alice : 67%
      Bob   : 67%
      Carol : 100%
    ```

!!! note "Weight important fields higher"
    In a real app you might give `avatar_url` and `bio` more weight than `website`. A weighted completion score encourages users to fill in the most impactful fields first.

---

## 5. Public vs Private Field Masking

=== "Python"
    ```python
    PUBLIC_FIELDS  = {"id", "name", "bio", "avatar_url", "location", "website", "created_at"}
    PRIVATE_FIELDS = {"email", "is_public", "_password_hash", "_login_count"}

    def public_view(profile: dict) -> dict:
        """Strip private and internal fields for public API response."""
        return {k: v for k, v in profile.items() if k in PUBLIC_FIELDS}

    def mask_email(email: str) -> str:
        """Show only first char and domain: a****@example.com"""
        local, domain = email.split("@")
        return f"{local[0]}****@{domain}"

    profile = {
        "id": 1, "name": "Alice Zhang", "email": "alice@example.com",
        "bio": "Python developer", "avatar_url": "https://example.com/alice.jpg",
        "location": "London", "website": None,
        "created_at": "2024-01-15", "is_public": True,
        "_password_hash": "hashed!", "_login_count": 42,
    }

    pub = public_view(profile)
    print("Public view:", list(pub.keys()))
    print("Masked email:", mask_email(profile["email"]))
    ```
=== "Output"
    ```
    Public view: ['id', 'name', 'bio', 'avatar_url', 'location', 'website', 'created_at']
    Masked email: a****@example.com
    ```

---

## 💻 Try It Yourself

Compute profile completion percentage based on filled fields:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">COMPLETION_FIELDS = ["name", "email", "bio", "avatar_url", "location", "website"]

def completion_pct(profile):
    filled = sum(1 for f in COMPLETION_FIELDS if profile.get(f))
    pct    = round(filled / len(COMPLETION_FIELDS) * 100)
    return f"{pct}%"

profiles = [
    {"name": "Alice", "email": "alice@ex.com", "bio": "Dev",  "avatar_url": "https://ex.com/a.jpg", "location": "NYC",    "website": "https://alice.dev"},
    {"name": "Bob",   "email": "bob@ex.com",   "bio": None,   "avatar_url": None,                   "location": None,     "website": None},
    {"name": "Carol", "email": "carol@ex.com", "bio": "PM",   "avatar_url": "https://ex.com/c.jpg", "location": "Berlin", "website": None},
]

for p in profiles:
    print(f"{p['name']}: {completion_pct(p)}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Compute Completion Percentage

A profile has 4 of 6 fields filled. Print its completion percentage as `"67%"`.

<div class="pyodide-runner" data-mode="challenge" data-expected="67%">
<pre><code class="language-python">COMPLETION_FIELDS = ["name", "email", "bio", "avatar_url", "location", "website"]

profile = {
    "name":       "Alice",
    "email":      "alice@example.com",
    "bio":        "Python developer",
    "avatar_url": "https://example.com/alice.jpg",
    "location":   None,
    "website":    None,
}

# Compute and print the completion percentage (e.g. "67%")
</code></pre>
</div>

---

### Challenge 2 — Mask an Email Address

Mask `"alice@example.com"` to show only the first character before `@`, like `"a****@example.com"`.

<div class="pyodide-runner" data-mode="challenge" data-expected="a****@example.com">
<pre><code class="language-python">email = "alice@example.com"

# Mask the email to show: a****@example.com
</code></pre>
</div>

---

## 📚 Further Reading

- [REST API Design — PATCH vs PUT (Phil Sturgeon)](https://apisyouwonthate.com/blog/put-vs-patch-vs-json-patch/)
- [OWASP — API Security — Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/)
- [Real Python — Flask User Authentication](https://realpython.com/flask-google-login/)

---

!!! success "Lesson Complete 🎉"
    You've completed Section 3! You can now build a production-quality user profile API with partial updates, uniqueness checks, computed attributes, and safe public/private field separation.

[⬅️ Lesson 29 · URL Shortener](29-url-shortener.md){ .md-button } [➡️ Section 4 — Async & CI/CD](../04-async-cicd/index.md){ .md-button .md-button--primary }
