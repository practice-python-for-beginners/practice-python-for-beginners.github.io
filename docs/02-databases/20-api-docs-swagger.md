---
title: "Lesson 20 · API Documentation with Swagger"
description: "Master interactive OpenAPI documentation in FastAPI — customize Swagger UI, Redoc, tags, descriptions, response models, and openapi.json."
---

# Lesson 20 · API Documentation with Swagger

> **Section:** 🗄️ Databases, ORMs & Auth &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Explain the OpenAPI specification standard and its role in modern API engineering
- [ ] Understand how FastAPI automatically compiles endpoints and Pydantic schemas into `openapi.json`
- [ ] Group and describe routes using `tags`, docstrings, summaries, and descriptions
- [ ] Add rich metadata (license, contact info, versioning, terms) to the root `FastAPI` application instance
- [ ] Export the generated `openapi.json` schema to generate client SDKs

---

## 📖 Introduction

Documenting REST APIs manually in static wikis or Markdown files is notoriously error-prone and quickly drifts out of sync with code changes. 

The **OpenAPI Specification** (formerly Swagger) solves this by defining an industry-standard, machine-readable JSON/YAML schema for describing REST APIs. FastAPI reads your Python type hints and docstrings to generate an interactive **Swagger UI** (`/docs`) and **ReDoc** (`/redoc`) instantly with zero manual documentation upkeep.

---

## 1. What is the OpenAPI Specification?

An OpenAPI document describes:
- Available endpoints (`/items`, `/users`) and supported HTTP methods (`GET`, `POST`)
- Required and optional headers, path parameters, and query parameters
- Request and response body structures (powered by JSON Schema)
- HTTP status codes (`200`, `201`, `400`, `404`, `422`, `500`)
- Security schemes (`Bearer JWT`, `OAuth2`, `API Key`)

```
FastAPI Code + Pydantic Models  ──►  Auto-generated openapi.json  ──►  Swagger UI (/docs)
                                                                  ──►  ReDoc (/redoc)
                                                                  ──►  Client SDK Generators
```

---

## 2. Enriching API Metadata in FastAPI

You can customize title, description (with Markdown support), version, terms of service, and license details when initializing `FastAPI`:

=== "Python (`main.py`)"
```python
from fastapi import FastAPI

tags_metadata = [
    {
        "name": "Users",
        "description": "Operations to register, authenticate, and manage user accounts.",
    },
    {
        "name": "Inventory",
        "description": "Manage catalog products, stock levels, and category groupings.",
    },
]

app = FastAPI(
    title="Acme Commerce API",
    description="""
    ## Acme Commerce RESTful API
    This API provides complete inventory management and authentication features.

    ### Key Features
    * 🔐 **JWT Bearer Token** Authentication
    * 📦 **Product Catalog** with category filtering
    * ⚡ **High performance** ASGI pipeline
    """,
    version="2.1.0",
    terms_of_service="https://example.com/terms/",
    contact={
        "name": "Acme API Support Team",
        "url": "https://example.com/support",
        "email": "api-support@example.com",
    },
    license_info={
        "name": "Apache 2.0",
        "url": "https://www.apache.org/licenses/LICENSE-2.0.html",
    },
    openapi_tags=tags_metadata
)
```

---

## 3. Documenting Routes, Summaries & Status Codes

FastAPI uses route decorators and Python docstrings to populate endpoint documentation:

=== "Python"
```python
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

class Product(BaseModel):
    name: str = Field(..., example="Ergonomic Chair")
    price: float = Field(..., gt=0, example=249.99)
    in_stock: bool = Field(True, example=True)

@app.post(
    "/products/",
    response_model=Product,
    status_code=status.HTTP_201_CREATED,
    tags=["Inventory"],
    summary="Create a new catalog product",
    response_description="The freshly created product record."
)
def create_product(product: Product):
    """
    Register a new product in the commerce catalog:

    - **name**: Descriptive name of product
    - **price**: Cost in USD (must be > 0)
    - **in_stock**: Current warehouse availability flag
    """
    return product
```

=== "Output"
```json
// Auto-generated OpenAPI JSON segment
{
  "summary": "Create a new catalog product",
  "description": "Register a new product in the commerce catalog:\n\n- **name**: Descriptive name...\n- **price**: Cost in USD...",
  "tags": ["Inventory"],
  "responses": {
    "201": {
      "description": "The freshly created product record."
    }
  }
}
```

---

## 4. Exporting OpenAPI JSON

You can export the auto-generated JSON spec to generate client libraries (e.g. in TypeScript, Kotlin, Swift):

=== "Python (`export_openapi.py`)"
```python
import json
from main import app

with open("openapi.json", "w") as f:
    json.dump(app.openapi(), f, indent=2)

print("Saved openapi.json successfully!")
```

---

## 💻 Try It Yourself

Build and inspect a mock OpenAPI specification block in pure Python:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Pure Python simulation of OpenAPI schema metadata builder
def build_openapi_spec(title: str, version: str, description: str) -> dict:
    return {
        "openapi": "3.1.0",
        "info": {
            "title": title,
            "version": version,
            "description": description
        },
        "paths": {
            "/api/health": {
                "get": {
                    "summary": "Health check",
                    "responses": {"200": {"description": "OK"}}
                }
            }
        }
    }

spec = build_openapi_spec("Acme Store API", "1.0.0", "FastAPI Reference API")
print(f"API Title: {spec['info']['title']} (v{spec['info']['version']})")
print(f"Registered Endpoints: {list(spec['paths'].keys())}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Mock OpenAPI Info Block

Write a function `build_info(title, version)` that returns a dictionary `{"info": {"title": title, "version": version}}`. Create a mock info block with title `"My API"` and version `"1.0.0"`, then print only the title field.

Expected output:
```
My API
```

<div class="pyodide-runner" data-mode="challenge" data-expected="My API">
<pre><code class="language-python">def build_info(title, version):
    return {"info": {"title": title, "version": version}}

spec = build_info("My API", "1.0.0")
# Print the title from the spec info block
print(spec["info"]["title"])
</code></pre>
</div>

---

## 📚 Further Reading

- [FastAPI Metadata and Docs URLs](https://fastapi.tiangolo.com/tutorial/metadata/)
- [OpenAPI Specification (OAS 3.1)](https://spec.openapis.org/oas/latest.html)
- [Swagger UI & OpenAPI Tools](https://swagger.io/tools/swagger-ui/)

---

!!! success "Section 2 Complete! 🗄️🎉"
    Congratulations! You have completed **Section 2: Databases, ORMs & Authentication**. You now possess strong backend engineering skills spanning relational databases (SQLite, SQLAlchemy), document databases (MongoDB), JWT token security, and modern FastAPI architectures with auto-generating Swagger documentation.

[⬅️ Lesson 19 · FastAPI JWT Authentication](19-fastapi-jwt-auth.md){ .md-button } [➡️ Section 3 · Lesson 21 · Weather API](../03-real-world-apis/21-weather-api.md){ .md-button .md-button--primary }
