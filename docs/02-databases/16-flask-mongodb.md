---
title: "Lesson 16 · Flask with MongoDB"
description: "Build flexible document-based backends in Flask using MongoDB and PyMongo — document schemas, BSON ObjectId serialization, and filtering."
---

# Lesson 16 · Flask with MongoDB

> **Section:** 🗄️ Databases, ORMs & Auth &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Compare Relational (SQL) and NoSQL Document-oriented databases
- [ ] Connect Flask to a MongoDB cluster using `pymongo` and `Flask-PyMongo`
- [ ] Perform document CRUD operations (`insert_one`, `find`, `find_one`, `update_one`, `delete_one`)
- [ ] Handle BSON `ObjectId` conversion and JSON serialization cleanly
- [ ] Implement query filters and projections for nested document structures

---

## 📖 Introduction

Relational databases require predefined table schemas with strict column types and foreign key constraints. When building applications with deeply nested attributes, rapidly changing data requirements, or catalog-style listings, **NoSQL document databases** like **MongoDB** provide exceptional flexibility.

In MongoDB, data is stored as JSON-like documents called **BSON** (Binary JSON) organized into collections rather than rigid tables.

Install: `pip install pymongo flask-pymongo`

---

## 1. Relational vs NoSQL Document Databases

| Feature | Relational (PostgreSQL, SQLite) | Document NoSQL (MongoDB) |
| :--- | :--- | :--- |
| **Data Unit** | Row / Record | Document (JSON/BSON) |
| **Grouping** | Table | Collection |
| **Schema** | Rigid, requires migrations | Flexible / Dynamic |
| **Relationships** | Foreign Keys & SQL `JOIN` | Embedded documents or references |
| **Best For** | Financial transactions, strict schemas | Catalogs, event logs, dynamic attributes |

---

## 2. Connecting Flask to MongoDB

=== "Python"
```python
from flask import Flask, jsonify, request, abort
from pymongo import MongoClient
from bson.objectid import ObjectId

app = Flask(__name__)

# Connect to local or cloud MongoDB instance
client = MongoClient("mongodb://localhost:27017/")
db = client["store_db"]
products_collection = db["products"]

# Helper to serialize MongoDB documents to JSON
def serialize_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc
```

!!! info "What is BSON ObjectId?"
    MongoDB automatically generates a unique 12-byte identifier stored under `_id` as an `ObjectId("64af...")` instance. Because standard Python `json.dumps()` cannot serialize `ObjectId` objects directly, you must convert `_id` to a string before returning JSON.

---

## 3. CRUD Operations with PyMongo

=== "Python"
```python
# CREATE (insert_one)
@app.route("/api/products", methods=["POST"])
def create_product():
    data = request.get_json() or {}
    if "name" not in data or "price" not in data:
        abort(400, description="name and price required")

    new_product = {
        "name": data["name"],
        "price": float(data["price"]),
        "active": data.get("active", True),
        "tags": data.get("tags", [])
    }
    result = products_collection.insert_one(new_product)
    new_product["id"] = str(result.inserted_id)
    return jsonify(serialize_doc(new_product)), 201

# READ ALL with Filter (find)
@app.route("/api/products", methods=["GET"])
def get_products():
    active_param = request.args.get("active")
    query = {}
    if active_param is not None:
        query["active"] = active_param.lower() == "true"

    docs = products_collection.find(query)
    return jsonify([serialize_doc(doc) for doc in docs]), 200

# READ ONE (find_one)
@app.route("/api/products/<product_id>", methods=["GET"])
def get_product(product_id):
    try:
        doc = products_collection.find_one({"_id": ObjectId(product_id)})
    except Exception:
        abort(400, description="Invalid ObjectId format")

    if not doc:
        abort(404, description="Product not found")
    return jsonify(serialize_doc(doc)), 200

# UPDATE (update_one with $set)
@app.route("/api/products/<product_id>", methods=["PATCH"])
def update_product(product_id):
    data = request.get_json() or {}
    try:
        oid = ObjectId(product_id)
    except Exception:
        abort(400, description="Invalid ObjectId")

    update_fields = {}
    if "name" in data: update_fields["name"] = data["name"]
    if "price" in data: update_fields["price"] = float(data["price"])
    if "active" in data: update_fields["active"] = bool(data["active"])

    result = products_collection.update_one({"_id": oid}, {"$set": update_fields})
    if result.matched_count == 0:
        abort(404, description="Product not found")

    updated_doc = products_collection.find_one({"_id": oid})
    return jsonify(serialize_doc(updated_doc)), 200

# DELETE (delete_one)
@app.route("/api/products/<product_id>", methods=["DELETE"])
def delete_product(product_id):
    try:
        result = products_collection.delete_one({"_id": ObjectId(product_id)})
    except Exception:
        abort(400, description="Invalid ObjectId")

    if result.deleted_count == 0:
        abort(404, description="Product not found")
    return "", 204
```

=== "Output"
```json
// Example GET /api/products response
[
  {
    "active": true,
    "id": "651a2bc39f4e2a10d9841a01",
    "name": "Wireless Mechanical Keyboard",
    "price": 89.99,
    "tags": ["electronics", "peripherals"]
  }
]
```

---

## 4. Query Operators & Projections

MongoDB provides expressive query operators for filtering and nesting:

=== "Python"
```python
# Price greater than 50 ($gt) and contains tag "electronics"
query = {
    "price": {"$gt": 50.0},
    "tags": "electronics"
}

# Projection: 1 includes field, 0 excludes field
projection = {"name": 1, "price": 1, "_id": 0}

filtered_items = list(products_collection.find(query, projection))
```

=== "Output"
```python
[
    {"name": "Wireless Mechanical Keyboard", "price": 89.99}
]
```

---

## 💻 Try It Yourself

Simulate MongoDB collection operations and document querying using pure Python:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Pure Python simulation of MongoDB Collection and $set updates
class MockMongoCollection:
    def __init__(self):
        self.docs = []

    def insert_one(self, doc):
        doc["_id"] = f"64a{len(self.docs) + 1:04d}"
        self.docs.append(doc)
        return doc["_id"]

    def find(self, filter_dict=None):
        if not filter_dict:
            return self.docs
        return [
            d for d in self.docs 
            if all(d.get(k) == v for k, v in filter_dict.items())
        ]

db_collection = MockMongoCollection()
db_collection.insert_one({"name": "Laptop Stand", "price": 29.99, "active": True})
db_collection.insert_one({"name": "USB Cable", "price": 9.99, "active": False})
db_collection.insert_one({"name": "Mousepad", "price": 14.99, "active": True})

print("Active Items in Collection:")
for item in db_collection.find({"active": True}):
    print(f" - [{item['_id']}] {item['name']} (${item['price']})")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Filter Documents with `active=True`

Given the list of document dictionaries below, count the number of documents where `active` is `True` and print only the resulting count integer.

Expected output:
```
2
```

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">documents = [
    {"_id": "64a0001", "name": "Laptop Stand", "price": 29.99, "active": True},
    {"_id": "64a0002", "name": "USB Cable", "price": 9.99, "active": False},
    {"_id": "64a0003", "name": "Mousepad", "price": 14.99, "active": True}
]

# Count documents where active is True and print count
active_count = sum(1 for doc in documents if doc.get("active") is True)
print(active_count)
</code></pre>
</div>

---

## 📚 Further Reading

- [PyMongo Official Documentation](https://pymongo.readthedocs.io/)
- [MongoDB Manual — Query Operators](https://www.mongodb.com/docs/manual/reference/operator/query/)
- [Flask-PyMongo Bridge](https://flask-pymongo.readthedocs.io/)

---

!!! success "Lesson Complete 🎉"
    You've built document APIs using Flask and MongoDB! Now, let's venture into the modern asynchronous Python ecosystem with **FastAPI**.

[⬅️ Lesson 15 · Flask JWT Authentication](15-flask-jwt-auth.md){ .md-button } [➡️ Lesson 17 · Introduction to FastAPI](17-intro-to-fastapi.md){ .md-button .md-button--primary }
