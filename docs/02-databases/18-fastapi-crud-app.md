---
title: "Lesson 18 · FastAPI CRUD App"
description: "Build a complete CRUD API with FastAPI — request/response models, query parameters, HTTPException, status codes, and type safety."
---

# Lesson 18 · FastAPI CRUD App

> **Section:** 🗄️ Databases, ORMs & Auth &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Construct a full RESTful CRUD API using FastAPI and Python dictionary storage
- [ ] Define separated Pydantic schemas for resource creation, update, and response serialisation
- [ ] Implement query parameters with default values and optional filters
- [ ] Raise descriptive `HTTPException` responses with standard HTTP status codes
- [ ] Restrict and shape returned JSON output with `response_model`

---

## 📖 Introduction

With FastAPI, building robust CRUD operations is remarkably clean and expressive. FastAPI relies on Python type annotations and Pydantic models to parse incoming JSON, validate fields, format outgoing responses, and document status codes in the OpenAPI schema simultaneously.

In this lesson, you will create a complete items inventory API featuring validation, error handling, and response shaping.

---

## 1. Defining Pydantic Schemas

Separating input schemas (e.g. `ItemCreate`, `ItemUpdate`) from output schemas (`ItemResponse`) ensures sensitive or internal database fields are never improperly exposed or modified.

=== "Python (`schemas.py`)"
```python
from pydantic import BaseModel, Field

class ItemBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    category: str = Field(..., example="electronics")
    price: float = Field(..., gt=0.0)

class ItemCreate(ItemBase):
    pass

class ItemUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    price: float | None = Field(None, gt=0.0)

class ItemResponse(ItemBase):
    id: int

    class Config:
        from_attributes = True
```

---

## 2. Implementing the CRUD Operations

=== "Python (`main.py`)"
```python
from fastapi import FastAPI, HTTPException, status, Query
from schemas import ItemCreate, ItemUpdate, ItemResponse

app = FastAPI(title="Inventory API")

# In-memory item storage
items_db: dict[int, dict] = {
    1: {"id": 1, "name": "Widget", "category": "tools", "price": 19.99},
    2: {"id": 2, "name": "Gadget", "category": "electronics", "price": 49.99},
    3: {"id": 3, "name": "Screwdriver", "category": "tools", "price": 8.50}
}
next_item_id = 4

# ── READ ALL (with query filtering) ──────────────────────────
@app.get("/items/", response_model=list[ItemResponse], status_code=status.HTTP_200_OK)
def get_items(
    category: str | None = Query(None, description="Filter items by category"),
    min_price: float | None = Query(None, ge=0.0)
):
    results = list(items_db.values())
    if category:
        results = [i for i in results if i["category"].lower() == category.lower()]
    if min_price is not None:
        results = [i for i in results if i["price"] >= min_price]
    return results

# ── READ ONE ─────────────────────────────────────────────────
@app.get("/items/{item_id}", response_model=ItemResponse)
def get_item(item_id: int):
    if item_id not in items_db:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with ID {item_id} not found"
        )
    return items_db[item_id]

# ── CREATE ───────────────────────────────────────────────────
@app.post("/items/", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(payload: ItemCreate):
    global next_item_id
    new_item = {"id": next_item_id, **payload.model_dump()}
    items_db[next_item_id] = new_item
    next_item_id += 1
    return new_item

# ── UPDATE ───────────────────────────────────────────────────
@app.patch("/items/{item_id}", response_model=ItemResponse)
def update_item(item_id: int, payload: ItemUpdate):
    if item_id not in items_db:
        raise HTTPException(status_code=404, detail="Item not found")

    stored_item = items_db[item_id]
    update_data = payload.model_dump(exclude_unset=True)
    stored_item.update(update_data)
    return stored_item

# ── DELETE ───────────────────────────────────────────────────
@app.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int):
    if item_id not in items_db:
        raise HTTPException(status_code=404, detail="Item not found")
    del items_db[item_id]
    return None
```

=== "Output"
```json
// GET /items/?category=tools
[
  {
    "category": "tools",
    "id": 1,
    "name": "Widget",
    "price": 19.99
  },
  {
    "category": "tools",
    "id": 3,
    "name": "Screwdriver",
    "price": 8.5
  }
]
```

!!! tip "exclude_unset=True"
    `payload.model_dump(exclude_unset=True)` only includes fields explicitly passed by the caller in the request body, ignoring default `None` values during partial updates.

---

## 3. Testing FastAPI Routes

FastAPI pairs with `httpx` and `pytest` for streamlined API testing:

=== "Python (`test_main.py`)"
```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_create_and_read_item():
    response = client.post("/items/", json={"name": "Hammer", "category": "tools", "price": 12.00})
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Hammer"

    get_resp = client.get(f"/items/{data['id']}")
    assert get_resp.status_code == 200
```

---

## 💻 Try It Yourself

Simulate FastAPI category querying and dictionary filtering in pure Python:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># In-memory dictionary CRUD simulation
inventory = {
    1: {"id": 1, "name": "Widget", "category": "tools", "price": 19.99},
    2: {"id": 2, "name": "Gadget", "category": "electronics", "price": 49.99},
    3: {"id": 3, "name": "Drill", "category": "tools", "price": 89.00}
}

def filter_items(category=None, min_price=None):
    items = list(inventory.values())
    if category:
        items = [i for i in items if i["category"] == category]
    if min_price:
        items = [i for i in items if i["price"] >= min_price]
    return items

print("Tools over $50:")
for item in filter_items(category="tools", min_price=50):
    print(f" - {item['name']}: ${item['price']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Filter Items by Category

Filter the `items` list below to find all items where `category` is `"featured"`, and print each matching item's `name` on its own line.

Expected output:
```
Widget
Gadget
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Widget
Gadget">
<pre><code class="language-python">items = [
    {"id": 1, "name": "Widget", "category": "featured"},
    {"id": 2, "name": "Gadget", "category": "featured"},
    {"id": 3, "name": "Tool", "category": "standard"}
]

# Print names of items with category 'featured'
for item in items:
    if item["category"] == "featured":
        print(item["name"])
</code></pre>
</div>

---

## 📚 Further Reading

- [FastAPI Query Parameters and String Validations](https://fastapi.tiangolo.com/tutorial/query-params-str-validations/)
- [Response Model & Status Codes](https://fastapi.tiangolo.com/tutorial/response-model/)
- [Testing FastAPI with TestClient](https://fastapi.tiangolo.com/tutorial/testing/)

---

!!! success "Lesson Complete 🎉"
    You've built a full CRUD API in FastAPI with Pydantic request and response models! Next, let's secure FastAPI endpoints using OAuth2 password flow and JWT tokens.

[⬅️ Lesson 17 · Introduction to FastAPI](17-intro-to-fastapi.md){ .md-button } [➡️ Lesson 19 · FastAPI JWT Authentication](19-fastapi-jwt-auth.md){ .md-button .md-button--primary }
