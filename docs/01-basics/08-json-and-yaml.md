---
title: "Lesson 8 · Working with JSON & YAML"
description: "Parse, generate, and validate JSON and YAML — the two most common formats for APIs, configs, and data exchange."
---

# Lesson 8 · Working with JSON & YAML

> **Section:** 🧱 Python Basics &nbsp;|&nbsp; **Difficulty:** ⭐⭐☆☆☆ &nbsp;|&nbsp; **Time:** ~40 minutes

---

## 🎯 Learning Objectives

- [ ] Use `json.loads()`, `json.dumps()`, `json.load()`, `json.dump()` fluently
- [ ] Handle JSON edge cases: `None`/`null`, custom types, pretty-printing
- [ ] Parse and write YAML using `PyYAML`
- [ ] Understand when to use JSON vs YAML
- [ ] Validate JSON structure with assertions

---

## 📖 Introduction

**JSON** (JavaScript Object Notation) is the lingua franca of web APIs. Every time your Python code calls a web API or sends data to a frontend, it's almost certainly using JSON. **YAML** is preferred for human-readable configuration files (Docker Compose, GitHub Actions, Kubernetes).

---

## 1. JSON — Full Reference

=== "Python ↔ JSON types"
    | Python | JSON |
    |--------|------|
    | `dict` | object `{}` |
    | `list`, `tuple` | array `[]` |
    | `str` | string `""` |
    | `int`, `float` | number |
    | `True` / `False` | `true` / `false` |
    | `None` | `null` |

=== "Parsing (loads / load)"
    ```python
    import json

    # From string
    raw = '{"name": "Alice", "age": 30, "active": true, "score": null}'
    data = json.loads(raw)
    print(data["name"])    # Alice
    print(data["active"])  # True  ← Python bool, not string
    print(data["score"])   # None  ← Python None, not string

    # From file
    with open("data.json", "r", encoding="utf-8") as f:
        config = json.load(f)
    ```
=== "Serialising (dumps / dump)"
    ```python
    import json
    from datetime import date

    user = {"name": "Bob", "joined": "2024-01-15", "scores": [95, 88, 72]}

    # Pretty-print with indentation
    print(json.dumps(user, indent=2))

    # Compact (for APIs)
    print(json.dumps(user, separators=(",", ":")))

    # Sort keys alphabetically
    print(json.dumps(user, indent=2, sort_keys=True))
    ```

---

## 2. Handling Custom Types

By default, `json.dumps()` can't serialize types like `datetime`. Use a custom encoder.

```python
import json
from datetime import datetime, date

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)

event = {
    "title": "Python Workshop",
    "date": date(2024, 6, 15),
    "created_at": datetime.now(),
}

print(json.dumps(event, cls=DateTimeEncoder, indent=2))
```

---

## 3. YAML — The Config Language

YAML is a superset of JSON with a cleaner syntax. Install: `pip install pyyaml`

=== "YAML vs JSON (same data)"
    ```yaml
    # config.yaml
    server:
      host: localhost
      port: 5000
      debug: true
    database:
      url: sqlite:///app.db
      pool_size: 5
    allowed_origins:
      - http://localhost:3000
      - https://myapp.com
    ```
    vs JSON:
    ```json
    {
      "server": {"host": "localhost", "port": 5000, "debug": true},
      "database": {"url": "sqlite:///app.db", "pool_size": 5},
      "allowed_origins": ["http://localhost:3000", "https://myapp.com"]
    }
    ```
=== "Python: read YAML"
    ```python
    import yaml

    with open("config.yaml", "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    print(config["server"]["port"])          # 5000
    print(config["allowed_origins"][0])      # http://localhost:3000
    ```
=== "Python: write YAML"
    ```python
    import yaml

    settings = {
        "app_name": "MyAPI",
        "version": "1.0.0",
        "features": ["auth", "caching", "logging"],
    }

    yaml_str = yaml.dump(settings, default_flow_style=False)
    print(yaml_str)

    with open("settings.yaml", "w", encoding="utf-8") as f:
        yaml.dump(settings, f, default_flow_style=False)
    ```

!!! warning "Use `yaml.safe_load()`, not `yaml.load()`"
    `yaml.load()` can execute arbitrary Python — it's a security risk. Always use `yaml.safe_load()`.

---

## 4. JSON as API Response Pattern

In Flask/FastAPI you'll constantly convert between Python dicts and JSON. Here's the pattern:

```python
import json

def make_response(success, data=None, error=None):
    """Standard API response envelope."""
    payload = {"success": success}
    if data is not None:
        payload["data"] = data
    if error is not None:
        payload["error"] = error
    return json.dumps(payload, indent=2)

print(make_response(True, data={"user_id": 42, "name": "Alice"}))
print(make_response(False, error="User not found"))
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import json

api_response = '''
{
  "status": "ok",
  "count": 3,
  "users": [
    {"id": 1, "name": "Alice", "active": true},
    {"id": 2, "name": "Bob",   "active": false},
    {"id": 3, "name": "Carol", "active": true}
  ]
}
'''

data = json.loads(api_response)
active_users = [u["name"] for u in data["users"] if u["active"]]

print(f"Status: {data['status']}")
print(f"Total users: {data['count']}")
print(f"Active users: {', '.join(active_users)}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — JSON Extraction

Parse the JSON string below and print the title of the **second** book.

Expected output:
```
Clean Code
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Clean Code">
<pre><code class="language-python">import json

library = '{"books": [{"title": "Python Crash Course"}, {"title": "Clean Code"}, {"title": "The Pragmatic Programmer"}]}'

# Parse and print the title of the second book
</code></pre>
</div>

---

## 📚 Further Reading

- [json module (docs.python.org)](https://docs.python.org/3/library/json.html)
- [PyYAML docs](https://pyyaml.org/wiki/PyYAMLDocumentation)
- [JSON vs YAML — comparison](https://realpython.com/python-yaml/)

---

!!! success "Lesson Complete 🎉"
    JSON and YAML are in every Python web project. These skills unlock Lesson 9's API work.

[⬅️ Lesson 7 · Intro to OOP](07-intro-to-oop.md){ .md-button } [➡️ Lesson 9 · HTTP & Requests](09-http-and-requests.md){ .md-button .md-button--primary }
