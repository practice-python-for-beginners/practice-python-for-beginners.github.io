---
title: "Lesson 77 · FastAPI with GraphQL"
description: "Build flexible APIs with GraphQL and FastAPI using Strawberry: define strongly typed Query and Mutation schemas, implement resolvers, resolve nested types, and contrast GraphQL with traditional REST."
---

# Lesson 77 · FastAPI with GraphQL

> **Section:** ☁️ Cloud, Serverless & Event-Driven Systems &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Contrast GraphQL architecture with traditional REST (eliminating over-fetching and under-fetching)
- [ ] Define Python type-annotated schemas with Strawberry GraphQL
- [ ] Implement query resolvers with arguments and filtering
- [ ] Build mutation resolvers to handle create, update, and delete operations
- [ ] Model nested relationship types and understand the N+1 query problem
- [ ] Mount a Strawberry GraphQL schema onto a FastAPI application with GraphiQL IDE

---

## 📖 Introduction

In standard REST APIs, endpoints are resource-centric (`/users/1`, `/users/1/posts`). Clients frequently face **over-fetching** (downloading 50 unwanted fields) or **under-fetching** (requiring multiple waterfall roundtrips to assemble relational data).

**GraphQL** exposes a single HTTP endpoint (`/graphql`) accepting structured queries where the client requests *only* the exact fields and nested relationships needed.

```
REST: Multiple Roundtrips
Client ──► GET /users/12 ──────► Receives full User object
Client ──► GET /users/12/orders ► Receives full Orders array

GraphQL: Single Query Document
POST /graphql:
query { user(id: 12) { name, orders { total, status } } }
       └──► Returns exactly matching nested JSON in 1 response!
```

---

## 1. GraphQL Fundamentals and Strawberry Setup

**Strawberry GraphQL** is the modern Python code-first GraphQL library utilizing Python 3.10+ dataclasses and type annotations.

=== "Schema Definition"
    ```python
    import strawberry
    from typing import List, Optional

    @strawberry.type
    class Author:
        id: int
        name: str
        email: str

    @strawberry.type
    class Book:
        id: int
        title: str
        published_year: int
        author: Author

    # Sample in-memory database
    AUTHORS_DB = {1: Author(id=1, name="Guido van Rossum", email="guido@python.org")}
    BOOKS_DB = [
        Book(id=101, title="Python Tutorial", published_year=1995, author=AUTHORS_DB[1])
    ]
    ```
=== "Mounting with FastAPI"
    ```python
    from fastapi import FastAPI
    import strawberry
    from strawberry.fastapi import GraphQLRouter
    from typing import List

    @strawberry.type
    class Query:
        @strawberry.field
        def books(self) -> List[Book]:
            return BOOKS_DB

        @strawberry.field
        def book(self, id: int) -> Optional[Book]:
            for b in BOOKS_DB:
                if b.id == id:
                    return b
            return None

    schema = strawberry.Schema(query=Query)
    graphql_app = GraphQLRouter(schema)

    app = FastAPI()
    app.include_router(graphql_app, prefix="/graphql")
    ```

---

## 2. Mutations and Input Types

While queries fetch data, **Mutations** represent operations that modify state (POST/PUT/DELETE equivalents).

=== "Mutations and Inputs"
    ```python
    import strawberry
    from typing import Optional

    @strawberry.input
    class BookInput:
        title: str
        published_year: int
        author_id: int

    @strawberry.type
    class Mutation:
        @strawberry.mutation
        def create_book(self, input_data: BookInput) -> Book:
            author = AUTHORS_DB.get(input_data.author_id)
            if not author:
                raise Exception("Author does not exist")
                
            new_book = Book(
                id=len(BOOKS_DB) + 101,
                title=input_data.title,
                published_year=input_data.published_year,
                author=author
            )
            BOOKS_DB.append(new_book)
            return new_book

    schema = strawberry.Schema(query=Query, mutation=Mutation)
    ```
=== "GraphQL Mutation Payload"
    ```graphql
    mutation {
      createBook(inputData: {
        title: "Fluent Python",
        publishedYear: 2022,
        authorId: 1
      }) {
        id
        title
        author {
          name
        }
      }
    }
    ```

---

## 3. Resolving Nested Relationships and the N+1 Problem

When resolving related entities (e.g., getting 50 books and each book fetches an author query), executing a separate database query per item results in **N+1 queries**. Use **DataLoader** batches to aggregate queries into a single `SELECT * FROM authors WHERE id IN (...)`.

```
N+1 Query Issue:    1 (fetch books) + 50 (fetch each author individually) = 51 queries!
DataLoader Batch:   1 (fetch books) + 1 (batch fetch all authors)        = 2 queries!
```

=== "DataLoader Example"
    ```python
    from strawberry.dataloader import DataLoader
    from typing import List

    async def load_authors_batch(keys: List[int]) -> List[Author]:
        # Single batch query to DB: SELECT * FROM authors WHERE id IN (keys)
        return [AUTHORS_DB.get(k) for k in keys]

    author_loader = DataLoader(load_fn=load_authors_batch)
    ```

---

## 4. REST vs GraphQL Comparison

| Dimension | REST | GraphQL |
|---|---|---|
| Endpoints | Multiple (`/users`, `/items`) | Single (`/graphql`) |
| Data Transfer | Fixed shape per endpoint | Dynamic shape selected by client |
| Over-fetching | High (returns full entity) | Zero (only specified fields returned) |
| HTTP Method | GET, POST, PUT, DELETE, PATCH | POST (or GET for cached queries) |
| Tooling | OpenAPI / Swagger | GraphiQL, Apollo Studio |

---

## 💻 Try It Yourself

Simulate a lightweight GraphQL query resolver that extracts only requested fields from a data dictionary based on a field selection list.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># In-memory GraphQL Resolver Simulator
user_db = {
    "id": 1,
    "name": "Guido van Rossum",
    "email": "guido@python.org",
    "country": "Netherlands",
    "role": "Creator of Python"
}

def resolve_graphql_fields(entity, requested_fields):
    return {field: entity[field] for field in requested_fields if field in entity}

# Client specifies exact fields wanted
query_fields = ["name", "role"]
result = resolve_graphql_fields(user_db, query_fields)

print("Client Requested Fields:", query_fields)
print("Resolved GraphQL Result :", result)
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Resolve User Fields

Given the mock user dictionary, resolve the requested fields `["name", "email"]` and print each field's value on its own line (first the name, then the email).

<div class="pyodide-runner" data-mode="challenge" data-expected="Alice&#10;alice@example.com">
<pre><code class="language-python">user = {
    "name": "Alice",
    "email": "alice@example.com",
    "age": 30,
    "role": "Developer"
}

# Resolve the requested fields: ["name", "email"]
# Print user["name"], then print user["email"]
</code></pre>
</div>

### Challenge 2 — Count Schema Types

Given a mock GraphQL schema definition dictionary with registered types, count and print the total number of type definitions registered.

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">schema_types = {
    "User": ["id", "name", "email"],
    "Order": ["id", "amount", "status"],
    "Product": ["id", "title", "price"]
}

# Print the count of keys in schema_types
</code></pre>
</div>

---

## 📚 Further Reading

- [Strawberry GraphQL Official Documentation](https://strawberry.rocks/)
- [GraphQL Specification Official Website](https://graphql.org/learn/)
- [FastAPI + Strawberry Integration Guide](https://strawberry.rocks/docs/integrations/fastapi)

---

!!! success "Lesson Complete 🎉"
    You now understand the architecture of GraphQL, schema typing with Strawberry, queries, mutations, DataLoader patterns, and mounting GraphQL routers in FastAPI.

[⬅️ Lesson 76 · Building a WebSocket API](76-websocket-api.md){ .md-button } [➡️ Lesson 78 · Payment Integration API](78-payment-integration.md){ .md-button .md-button--primary }
