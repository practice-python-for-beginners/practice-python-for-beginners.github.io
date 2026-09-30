---
title: "Lesson 92 · Role-Based Access Control API"
description: "Implement RBAC in Python APIs — define roles and permissions, build permission-check middleware, protect routes with decorators, and maintain an audit log."
---

# Lesson 92 · Role-Based Access Control API

> **Section:** 🏢 Enterprise Architecture &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~90 minutes

---

## 🎯 Learning Objectives

- [ ] Define roles, permissions, and user-role assignments in code
- [ ] Build a permission-check function that handles multiple roles
- [ ] Implement a route-protection decorator using RBAC rules
- [ ] Design hierarchical permissions with parent roles
- [ ] Record all permission changes in an append-only audit log
- [ ] Integrate RBAC with a JWT-authenticated FastAPI application

---

## 📖 Introduction

**Role-Based Access Control (RBAC)** is the industry-standard model for managing who can do what in your application. Instead of assigning permissions directly to individual users, you assign permissions to *roles* and then assign roles to users. This keeps permission management tractable as your user base grows.

The three core concepts are **Permissions** (e.g., `posts:write`), **Roles** (e.g., `editor`), and **Assignments** (user → role). This lesson builds a complete, production-ready RBAC system from scratch.

---

## 1. Defining Roles and Permissions

=== "Flat RBAC"
    ```python
    # Permissions are strings in "resource:action" format.
    # Roles hold a set of permissions.

    PERMISSIONS = {
        "admin": {
            "users:read", "users:write", "users:delete",
            "posts:read", "posts:write", "posts:delete",
            "settings:read", "settings:write",
        },
        "editor": {
            "posts:read", "posts:write",
            "users:read",
        },
        "viewer": {
            "posts:read",
            "users:read",
        },
    }

    def has_permission(user_roles: list[str], required: str) -> bool:
        """Return True if any of the user's roles grants the required permission."""
        for role in user_roles:
            if required in PERMISSIONS.get(role, set()):
                return True
        return False

    # Usage
    print(has_permission(["editor"], "posts:write"))   # True
    print(has_permission(["viewer"], "posts:delete"))  # False
    ```

=== "Hierarchical RBAC"
    ```python
    # Roles can inherit from parent roles.
    # admin inherits from editor, editor inherits from viewer.

    ROLE_HIERARCHY = {
        "admin":  ["editor"],   # admin inherits all editor perms
        "editor": ["viewer"],   # editor inherits all viewer perms
        "viewer": [],
    }

    ROLE_DIRECT_PERMISSIONS = {
        "admin":  {"users:delete", "settings:write"},
        "editor": {"posts:write"},
        "viewer": {"posts:read", "users:read"},
    }

    def resolve_permissions(role: str, _seen: set = None) -> set:
        """Recursively collect all permissions for a role."""
        if _seen is None:
            _seen = set()
        if role in _seen:
            return set()
        _seen.add(role)
        perms = set(ROLE_DIRECT_PERMISSIONS.get(role, set()))
        for parent in ROLE_HIERARCHY.get(role, []):
            perms |= resolve_permissions(parent, _seen)
        return perms

    print(resolve_permissions("admin"))
    # {'users:delete', 'settings:write', 'posts:write', 'posts:read', 'users:read'}
    ```

| Role | Direct Permissions | Inherited Permissions |
|---|---|---|
| viewer | posts:read, users:read | — |
| editor | posts:write | posts:read, users:read |
| admin | users:delete, settings:write | All editor + viewer perms |

---

## 2. User-Role Assignment

```python
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class User:
    id: str
    username: str
    email: str
    roles: list[str] = field(default_factory=list)

# In-memory store (replace with DB in production)
USERS: dict[str, User] = {
    "u1": User("u1", "alice",  "alice@example.com",  roles=["admin"]),
    "u2": User("u2", "bob",    "bob@example.com",    roles=["editor"]),
    "u3": User("u3", "charlie","charlie@example.com", roles=["viewer"]),
}

def assign_role(user_id: str, role: str, assigned_by: str) -> None:
    """Assign a role to a user and record in audit log."""
    user = USERS[user_id]
    if role not in user.roles:
        user.roles.append(role)
        audit_log(
            action="role_assigned",
            user_id=user_id,
            role=role,
            performed_by=assigned_by,
        )

def revoke_role(user_id: str, role: str, revoked_by: str) -> None:
    """Remove a role from a user and record in audit log."""
    user = USERS[user_id]
    if role in user.roles:
        user.roles.remove(role)
        audit_log(
            action="role_revoked",
            user_id=user_id,
            role=role,
            performed_by=revoked_by,
        )
```

---

## 3. Permission Check Middleware

```python
from fastapi import FastAPI, Request, HTTPException, Depends
from functools import wraps

app = FastAPI()

# ── Dependency: get current user from JWT (simplified) ────────
def get_current_user(request: Request) -> User:
    # In production: decode JWT, look up user in DB
    user_id = request.headers.get("X-User-ID", "u3")
    user = USERS.get(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ── Dependency factory: require a specific permission ─────────
def require_permission(permission: str):
    def dependency(user: User = Depends(get_current_user)):
        if not has_permission(user.roles, permission):
            raise HTTPException(
                status_code=403,
                detail=f"Permission denied: '{permission}' required"
            )
        return user
    return Depends(dependency)

# ── Protected routes ──────────────────────────────────────────
@app.get("/posts")
async def list_posts(user = require_permission("posts:read")):
    return {"user": user.username, "posts": ["Post 1", "Post 2"]}

@app.post("/posts")
async def create_post(user = require_permission("posts:write")):
    return {"user": user.username, "created": True}

@app.delete("/posts/{post_id}")
async def delete_post(post_id: int, user = require_permission("posts:delete")):
    return {"user": user.username, "deleted": post_id}
```

---

## 4. Route Protection Decorator

```python
# Decorator pattern — useful outside FastAPI (e.g. Flask, scripts).

def requires(permission: str):
    """Decorator that guards a function with a permission check."""
    def decorator(func):
        @wraps(func)
        def wrapper(user_roles: list[str], *args, **kwargs):
            if not has_permission(user_roles, permission):
                raise PermissionError(
                    f"Access denied: '{permission}' required, "
                    f"roles {user_roles} are insufficient."
                )
            return func(user_roles, *args, **kwargs)
        return wrapper
    return decorator

@requires("posts:delete")
def delete_post(user_roles: list[str], post_id: int):
    print(f"Post {post_id} deleted by user with roles {user_roles}")

# Works for admin
delete_post(["admin"], 42)       # ✓ Post 42 deleted

# Raises PermissionError for viewer
try:
    delete_post(["viewer"], 42)
except PermissionError as e:
    print(f"Blocked: {e}")
```

---

## 5. Audit Log for Permission Changes

```python
import json
from datetime import datetime, timezone

_AUDIT_LOG: list[dict] = []

def audit_log(**kwargs) -> None:
    """Append an immutable audit entry."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **kwargs,
    }
    _AUDIT_LOG.append(entry)

def get_audit_log(user_id: str = None) -> list[dict]:
    """Query audit log, optionally filtered by user."""
    if user_id:
        return [e for e in _AUDIT_LOG if e.get("user_id") == user_id]
    return list(_AUDIT_LOG)

# Simulate some activity
audit_log(action="login",        user_id="u2", ip="1.2.3.4")
audit_log(action="role_assigned",user_id="u2", role="editor", performed_by="u1")
audit_log(action="post_deleted", user_id="u2", resource="post:99")

print("Audit entries for bob:")
for entry in get_audit_log("u2"):
    print(f"  [{entry['timestamp']}] {entry['action']}")
```

!!! tip "Audit logs must be append-only"
    Never update or delete audit log entries. In production, write to an immutable store (S3, CloudWatch Logs, or a DB table with no UPDATE/DELETE grants for the app user).

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Implement a simple permission checker

PERMISSIONS = {
    "admin":  {"users:read", "users:write", "users:delete",
               "posts:read", "posts:write", "posts:delete"},
    "editor": {"posts:read", "posts:write", "users:read"},
    "viewer": {"posts:read", "users:read"},
}

def has_permission(user_roles: list, required: str) -> bool:
    for role in user_roles:
        if required in PERMISSIONS.get(role, set()):
            return True
    return False

# Test all roles against all permissions
test_cases = [
    (["admin"],  "posts:delete"),
    (["editor"], "posts:write"),
    (["editor"], "posts:delete"),
    (["viewer"], "posts:read"),
    (["viewer"], "posts:write"),
]

for roles, perm in test_cases:
    result = has_permission(roles, perm)
    indicator = "✅" if result else "❌"
    print(f"{indicator} {roles[0]:8s} → {perm:20s} : {result}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Editor Permission Check

Check if role `"editor"` has the `"posts:write"` permission and print the result.

Expected output:
```
True
```

<div class="pyodide-runner" data-mode="challenge" data-expected="True">
<pre><code class="language-python">PERMISSIONS = {
    "admin":  {"users:read", "users:write", "users:delete",
               "posts:read", "posts:write", "posts:delete"},
    "editor": {"posts:read", "posts:write", "users:read"},
    "viewer": {"posts:read", "users:read"},
}

def has_permission(user_roles: list, required: str) -> bool:
    for role in user_roles:
        if required in PERMISSIONS.get(role, set()):
            return True
    return False

# Check if editor has posts:write and print the result
</code></pre>
</div>

---

### Challenge 2 — Viewer Delete Permission Check

Check if role `"viewer"` has the `"posts:delete"` permission and print the result.

Expected output:
```
False
```

<div class="pyodide-runner" data-mode="challenge" data-expected="False">
<pre><code class="language-python">PERMISSIONS = {
    "admin":  {"users:read", "users:write", "users:delete",
               "posts:read", "posts:write", "posts:delete"},
    "editor": {"posts:read", "posts:write", "users:read"},
    "viewer": {"posts:read", "users:read"},
}

def has_permission(user_roles: list, required: str) -> bool:
    for role in user_roles:
        if required in PERMISSIONS.get(role, set()):
            return True
    return False

# Check if viewer has posts:delete and print the result
</code></pre>
</div>

---

## 📚 Further Reading

- [NIST RBAC Standard (SP 800-162)](https://csrc.nist.gov/publications/detail/sp/800-162/final)
- [FastAPI Security — OAuth2 with Scopes](https://fastapi.tiangolo.com/advanced/security/oauth2-scopes/)
- [Building RBAC in Python — Real Python](https://realpython.com/python-access-control/)

---

[⬅️ Lesson 91 · Multi-Tenant API Architecture](91-multi-tenant-api.md){ .md-button } [➡️ Lesson 93 · API Versioning & Documentation](93-api-versioning.md){ .md-button .md-button--primary }
