---
title: "Lesson 17 · Introduction to FastAPI"
description: "Discover FastAPI — automatic interactive docs, type hints, high performance async routing, and Pydantic schema validation."
---

# Lesson 17 · Introduction to FastAPI

> **Section:** 🗄️ Databases, ORMs & Auth &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Compare FastAPI and Flask regarding asynchronous execution, type safety, and automatic documentation
- [ ] Install FastAPI and Uvicorn to run an ASGI web server
- [ ] Define path operations using `@app.get()`, `@app.post()`, and parameter decorators
- [ ] Validate incoming request payloads with Pydantic `BaseModel` classes
- [ ] Explore interactive OpenAPI documentation generated automatically at `/docs` (Swagger UI) and `/redoc`

---

## 📖 Introduction

**FastAPI** is a high-performance web framework designed for building modern APIs with Python 3.8+ using standard Python type hints. While Flask has long been Python's favorite minimalist framework, FastAPI introduces built-in data validation via **Pydantic**, native asynchronous (`async`/`await`) support, and automatic interactive Swagger documentation out of the box.

Install: `pip install "fastapi[standard]"` or `pip install fastapi uvicorn`

---

## 1. FastAPI vs Flask

| Feature | Flask | FastAPI |
| :--- | :--- | :--- |
| **Server Interface** | WSGI (Synchronous by default) | ASGI (Native `async`/`await` support) |
| **Data Validation** | Manual / Custom validation logic | Automatic with Pydantic type annotations |
| **Interactive Docs** | Requires manual Swagger plugins | Automatic `/docs` (Swagger) & `/redoc` |
| **Performance** | Standard Python performance | Near NodeJS and Go speeds (powered by Starlette) |

---

## 2. Minimal FastAPI Application

=== "Python (`main.py`)"
```python
from fastapi import FastAPI

app = FastAPI(
    title="My Store API",
    description="Getting started with modern FastAPI backends",
    version="1.0.0"
)

@app.get("/")
def read_root():
    return {"message": "Hello from FastAPI!"}

@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "query": q}
```

=== "Command"
```bash
# Run using Uvicorn ASGI server
uvicorn main:app --reload --port 8000
```

Visit `http://127.0.0.1:8000/docs` to test endpoints interactively via Swagger UI.

---

## 3. Pydantic Models for Request Validation

Pydantic models define the structure, types, and constraints of JSON data payloads.

=== "Python"
```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI()

class Item(BaseModel):
    name: str = Field(..., min_length=1, description="Item display name")
    description: str | None = None
    price: float = Field(..., gt=0, description="Price must be greater than zero")
    tax: float = 0.0

@app.post("/items/", status_code=201)
def create_item(item: Item):
    total = item.price + item.tax
    return {
        "item": item.model_dump(),
        "total_price": round(total, 2)
    }
```

=== "Output"
```json
// POST /items/ with {"name": "Wireless Mouse", "price": 24.99, "tax": 2.50}
{
  "item": {
    "description": null,
    "name": "Wireless Mouse",
    "price": 24.99,
    "tax": 2.5
  },
  "total_price": 27.49
}
```

!!! tip "Automatic 422 Unprocessable Entity"
    If a client sends an invalid payload (e.g., `price: "free"`), FastAPI automatically intercepts it and returns a descriptive `422 Unprocessable Entity` error detailing the invalid field.

---

## 4. Path and Query Parameters with Type Hints

FastAPI differentiates path and query parameters by inspection:

=== "Python"
```python
@app.get("/categories/{category}/items")
def filter_items(
    category: str,                 # Path parameter (in route URL)
    limit: int = 10,               # Query parameter (?limit=10)
    in_stock_only: bool = True     # Query parameter (?in_stock_only=false)
):
    return {
        "category": category,
        "limit": limit,
        "in_stock_only": in_stock_only
    }
```

---

## 💻 Try It Yourself

Simulate Pydantic schema validation using pure Python dataclasses and validation checks:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Pure Python simulation of Pydantic model validation
class MockItem:
    def __init__(self, name: str, price: float, description: str = None):
        if not isinstance(name, str) or len(name) < 1:
            raise ValueError("name must be a non-empty string")
        if not isinstance(price, (int, float)) or price <= 0:
            raise ValueError("price must be a positive number")
        self.name = name
        self.price = float(price)
        self.description = description

    def dict(self):
        return {"name": self.name, "price": self.price}

# Validate creation
item = MockItem(name="Mechanical Keyboard", price=89.99)
print("Validated Model Output:", item.dict())
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Simulate Pydantic Model Validation

Create an `Item` class simulator with `name` ("Widget") and `price` (9.99). Call `.dict()` on the item instance and print the dictionary output.

Expected output:
```
{'name': 'Widget', 'price': 9.99}
```

<div class="pyodide-runner" data-mode="challenge" data-expected="{'name': 'Widget', 'price': 9.99}">
<pre><code class="language-python">class Item:
    def __init__(self, name: str, price: float):
        self.name = str(name)
        self.price = float(price)

    def dict(self):
        return {"name": self.name, "price": self.price}

# Create Item with name 'Widget' and price 9.99, then print its dict
item = Item("Widget", 9.99)
print(item.dict())
</code></pre>
</div>

---

## 📚 Further Reading

- [FastAPI Official Tutorial](https://fastapi.tiangolo.com/tutorial/)
- [Pydantic V2 Documentation](https://docs.pydantic.dev/latest/)
- [Uvicorn ASGI Server](https://www.uvicorn.org/)

---

!!! success "Lesson Complete 🎉"
    You've learned the fundamentals of FastAPI and schema validation! Next, we will build a full CRUD API using FastAPI and Pydantic models.

[⬅️ Lesson 16 · Flask with MongoDB](16-flask-mongodb.md){ .md-button } [➡️ Lesson 18 · FastAPI CRUD App](18-fastapi-crud-app.md){ .md-button .md-button--primary }
