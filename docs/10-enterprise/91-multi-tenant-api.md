---
title: "Lesson 91 · Multi-Tenant API Architecture"
description: "Design and implement multi-tenant APIs — shared-DB vs schema-per-tenant vs DB-per-tenant, tenant resolution, row-level security, and onboarding flows."
---

# Lesson 91 · Multi-Tenant API Architecture

> **Section:** 🏢 Enterprise Architecture &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~90 minutes

---

## 🎯 Learning Objectives

- [ ] Compare the three major multi-tenancy isolation models
- [ ] Resolve tenant identity from subdomains, headers, and JWT claims
- [ ] Implement row-level security with a `tenant_id` column
- [ ] Build tenant isolation middleware that injects context per request
- [ ] Design a safe tenant onboarding flow with schema provisioning
- [ ] Understand the trade-offs of each isolation strategy for cost and compliance

---

## 📖 Introduction

**Multi-tenancy** means a single running instance of your application serves multiple independent customers (tenants). Each tenant's data must be completely isolated from every other tenant's, yet the infrastructure is shared. Getting this wrong is catastrophic — a data leak between tenants can end a SaaS business overnight.

There are three main isolation strategies, each with a different trade-off between isolation strength, operational complexity, and cost. This lesson covers all three, shows how to resolve which tenant is making a request, and walks through the row-level security and middleware patterns you'll use every day.

---

## 1. Isolation Models

=== "Shared Database (tenant_id column)"
    ```python
    # The most common and cost-effective model.
    # Every table has a tenant_id column. All tenants live in the same DB.

    # SQLAlchemy model example
    from sqlalchemy import Column, String, Integer, ForeignKey
    from sqlalchemy.orm import DeclarativeBase

    class Base(DeclarativeBase):
        pass

    class Post(Base):
        __tablename__ = "posts"
        id        = Column(Integer, primary_key=True)
        tenant_id = Column(String, nullable=False, index=True)
        title     = Column(String, nullable=False)
        body      = Column(String)

    # ALWAYS filter by tenant_id in every query
    def get_posts(db_session, tenant_id: str):
        return db_session.query(Post).filter(Post.tenant_id == tenant_id).all()
    ```

=== "Schema per Tenant (PostgreSQL)"
    ```python
    # Each tenant gets their own PostgreSQL schema.
    # Tables are identical but namespaced: acme.posts, globex.posts
    # Strong isolation without separate DB costs.

    def set_tenant_schema(connection, tenant_slug: str):
        """Set search_path so all queries hit the right schema."""
        connection.execute(f"SET search_path TO {tenant_slug}, public")

    def provision_tenant_schema(connection, tenant_slug: str):
        """Create schema and run migrations for a new tenant."""
        connection.execute(f"CREATE SCHEMA IF NOT EXISTS {tenant_slug}")
        # run Alembic migrations targeting this schema
        connection.execute(f"""
            CREATE TABLE IF NOT EXISTS {tenant_slug}.posts (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                body TEXT
            )
        """)
    ```

=== "Database per Tenant"
    ```python
    # Full isolation — every tenant has their own database.
    # Most expensive, but required for compliance (HIPAA, SOC2 strict).

    TENANT_DB_URLS = {
        "acme":   "postgresql://user:pass@db-acme/acme_db",
        "globex": "postgresql://user:pass@db-globex/globex_db",
    }

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    _engines = {}

    def get_tenant_session(tenant_id: str):
        if tenant_id not in _engines:
            url = TENANT_DB_URLS[tenant_id]
            _engines[tenant_id] = create_engine(url, pool_size=5)
        Session = sessionmaker(bind=_engines[tenant_id])
        return Session()
    ```

| Strategy | Isolation | Cost | Complexity | Best For |
|---|---|---|---|---|
| Shared DB | Low | Lowest | Low | Early-stage SaaS |
| Schema per tenant | Medium | Low | Medium | Mid-market B2B |
| DB per tenant | High | High | High | Enterprise / compliance |

---

## 2. Tenant Resolution

=== "Subdomain Resolution"
    ```python
    # acme.myapp.com → tenant "acme"
    # globex.myapp.com → tenant "globex"

    def resolve_tenant_from_host(host: str) -> str | None:
        """Extract tenant slug from subdomain."""
        parts = host.split(".")
        # e.g. ["acme", "myapp", "com"]
        if len(parts) >= 3:
            return parts[0]
        return None  # no subdomain → no tenant

    # FastAPI middleware
    from fastapi import Request
    async def tenant_middleware(request: Request, call_next):
        host = request.headers.get("host", "")
        tenant = resolve_tenant_from_host(host)
        if tenant is None:
            from fastapi.responses import JSONResponse
            return JSONResponse({"error": "Tenant not found"}, status_code=400)
        request.state.tenant_id = tenant
        return await call_next(request)
    ```

=== "Header Resolution"
    ```python
    # Client sends: X-Tenant-ID: acme
    # Useful for API-to-API calls or when subdomains aren't practical.

    from fastapi import Request, HTTPException

    async def tenant_middleware(request: Request, call_next):
        tenant_id = request.headers.get("X-Tenant-ID")
        if not tenant_id:
            raise HTTPException(status_code=400, detail="X-Tenant-ID header required")
        # Optionally validate against a known tenant registry
        if not is_valid_tenant(tenant_id):
            raise HTTPException(status_code=404, detail="Tenant not found")
        request.state.tenant_id = tenant_id
        return await call_next(request)

    def is_valid_tenant(tenant_id: str) -> bool:
        valid = {"acme", "globex", "initech", "umbrella"}
        return tenant_id in valid
    ```

=== "JWT Claim Resolution"
    ```python
    # JWT payload contains: {"sub": "user@acme.com", "tenant_id": "acme", ...}
    # The most secure method — tenant is cryptographically asserted.

    import json, base64

    def decode_jwt_payload(token: str) -> dict:
        """Decode JWT payload without verification (for demo only)."""
        parts = token.split(".")
        # Add padding
        payload_b64 = parts[1] + "=="
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        return json.loads(payload_bytes)

    def resolve_tenant_from_jwt(authorization: str) -> str | None:
        if not authorization.startswith("Bearer "):
            return None
        token = authorization[7:]
        payload = decode_jwt_payload(token)
        return payload.get("tenant_id")
    ```

---

## 3. Row-Level Security

=== "Application-Level RLS"
    ```python
    # Always inject tenant_id into every query.
    # Use a context variable so the filter is automatic.

    from contextvars import ContextVar

    _current_tenant: ContextVar[str] = ContextVar("current_tenant")

    class TenantSession:
        """Wraps SQLAlchemy session to auto-filter by tenant."""
        def __init__(self, session, tenant_id: str):
            self._session = session
            self._tenant_id = tenant_id

        def query(self, model):
            return (
                self._session.query(model)
                .filter(model.tenant_id == self._tenant_id)
            )

        def add(self, obj):
            obj.tenant_id = self._tenant_id  # auto-stamp
            self._session.add(obj)
            return obj
    ```

=== "PostgreSQL Row-Level Security"
    ```sql
    -- Enable RLS on the posts table
    ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

    -- Create a policy: users can only see their own tenant's rows
    CREATE POLICY tenant_isolation ON posts
        USING (tenant_id = current_setting('app.tenant_id'));

    -- In your Python code, set the session variable before any query:
    -- connection.execute("SET app.tenant_id = 'acme'")
    -- Now ALL queries on posts are automatically filtered — no app-level filter needed.
    ```

!!! warning "Never trust the client"
    Never let the client supply their own `tenant_id` in request bodies for data operations. Always derive `tenant_id` from the authenticated session (JWT claim or server-side session).

---

## 4. Tenant Isolation Middleware

```python
from fastapi import FastAPI, Request, Depends, HTTPException
from typing import Annotated

app = FastAPI()

# ── Middleware: resolve + validate tenant ──────────────────────
@app.middleware("http")
async def tenant_context_middleware(request: Request, call_next):
    # Try header first, fall back to subdomain
    tenant_id = (
        request.headers.get("X-Tenant-ID")
        or resolve_tenant_from_host(request.headers.get("host", ""))
    )
    if not tenant_id:
        from fastapi.responses import JSONResponse
        return JSONResponse({"error": "Cannot resolve tenant"}, status_code=400)

    request.state.tenant_id = tenant_id
    response = await call_next(request)
    response.headers["X-Tenant-ID"] = tenant_id  # echo back for debug
    return response

# ── Dependency: get tenant from request state ──────────────────
def get_tenant(request: Request) -> str:
    return request.state.tenant_id

TenantDep = Annotated[str, Depends(get_tenant)]

# ── Route: auto-scoped to tenant ───────────────────────────────
@app.get("/posts")
async def list_posts(tenant_id: TenantDep):
    # All DB calls use tenant_id — isolation is guaranteed
    return {"tenant": tenant_id, "posts": fetch_posts(tenant_id)}
```

---

## 5. Tenant Onboarding Flow

```python
import re
from dataclasses import dataclass, field
from datetime import datetime

@dataclass
class Tenant:
    id: str
    name: str
    slug: str
    plan: str = "starter"
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    active: bool = True

TENANT_REGISTRY: dict[str, Tenant] = {}

def slugify(name: str) -> str:
    """Convert company name to URL-safe slug."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")

def onboard_tenant(name: str, plan: str = "starter") -> Tenant:
    """
    Onboarding steps:
    1. Validate uniqueness
    2. Create tenant record
    3. Provision DB schema / tables
    4. Create admin user
    5. Send welcome email
    """
    slug = slugify(name)
    if slug in TENANT_REGISTRY:
        raise ValueError(f"Tenant '{slug}' already exists")

    tenant = Tenant(id=f"t_{slug}", name=name, slug=slug, plan=plan)
    TENANT_REGISTRY[slug] = tenant

    # Step 3 — in production, run Alembic migrations here
    print(f"[DB]    Provisioned schema for '{slug}'")
    # Step 4
    print(f"[AUTH]  Created admin user admin@{slug}.myapp.com")
    # Step 5
    print(f"[EMAIL] Welcome email sent to admin@{slug}.myapp.com")

    return tenant

# Example
t = onboard_tenant("Acme Corp", plan="pro")
print(f"Tenant created: {t.id} | slug={t.slug}")
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate tenant isolation — filter shared data by tenant_id

records = [
    {"tenant_id": "acme",   "id": 1, "resource": "invoice-001"},
    {"tenant_id": "globex", "id": 2, "resource": "invoice-002"},
    {"tenant_id": "acme",   "id": 3, "resource": "invoice-003"},
    {"tenant_id": "initech","id": 4, "resource": "invoice-004"},
    {"tenant_id": "acme",   "id": 5, "resource": "invoice-005"},
    {"tenant_id": "globex", "id": 6, "resource": "invoice-006"},
]

def get_tenant_records(data: list, tenant_id: str) -> list:
    """Simulate row-level security filter."""
    return [r for r in data if r["tenant_id"] == tenant_id]

for tenant in ["acme", "globex", "initech"]:
    results = get_tenant_records(records, tenant)
    print(f"Tenant '{tenant}': {len(results)} record(s)")
    for r in results:
        print(f"  → {r['resource']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count Tenant Records

Filter all records for tenant `"acme"` from the mixed list and print the count of matching records.

Expected output:
```
3
```

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">records = [
    {"tenant_id": "acme",   "resource": "invoice-001"},
    {"tenant_id": "globex", "resource": "invoice-002"},
    {"tenant_id": "acme",   "resource": "invoice-003"},
    {"tenant_id": "initech","resource": "invoice-004"},
    {"tenant_id": "acme",   "resource": "invoice-005"},
    {"tenant_id": "globex", "resource": "invoice-006"},
]

# Filter for "acme" and print the count
</code></pre>
</div>

---

### Challenge 2 — Extract Tenant from JWT Payload

Given a mock JWT payload dict, extract and print the `tenant_id` claim.

Expected output:
```
globex
```

<div class="pyodide-runner" data-mode="challenge" data-expected="globex">
<pre><code class="language-python">import json, base64

# Mock JWT token (header.payload.signature)
payload_data = {"sub": "user@globex.com", "tenant_id": "globex", "role": "admin"}
payload_b64 = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).decode().rstrip("=")
mock_token = f"eyJhbGciOiJIUzI1NiJ9.{payload_b64}.fakesignature"

# Decode the payload and print the tenant_id
</code></pre>
</div>

---

## 📚 Further Reading

- [Multi-Tenancy Patterns — Microsoft Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/overview)
- [Row-Level Security in PostgreSQL](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Building Multi-Tenant Applications with FastAPI](https://fastapi.tiangolo.com/advanced/middleware/)

---

[⬅️ Section 9 · Lesson 90](../09-ml-ai/90-mlops-deployment.md){ .md-button } [➡️ Lesson 92 · Role-Based Access Control API](92-rbac-api.md){ .md-button .md-button--primary }
