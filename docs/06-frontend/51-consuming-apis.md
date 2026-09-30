---
title: "Lesson 51 · Consuming APIs with Python"
description: "Master pagination, retries, rate-limit handling, response caching, and building a reusable API client class with dataclasses."
---

# Lesson 51 · Consuming APIs with Python

> **Section:** 🖥️ Frontend Integrations &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

- [ ] Handle paginated APIs using `next` page URLs
- [ ] Retry failed requests with exponential back-off
- [ ] Read and respect `X-RateLimit-*` headers
- [ ] Cache responses to avoid redundant network calls
- [ ] Build a reusable `APIClient` class with session reuse
- [ ] Type API responses with `dataclasses`

---

## 📖 Introduction

Calling a single endpoint is easy. Production-grade API consumption means dealing with pages of results, transient failures, rate limits, and repeated identical queries. This lesson shows you the patterns that make the difference between a fragile script and a robust integration.

---

## 1. Pagination Patterns

=== "Cursor / next-URL"
    ```python
    import requests

    def fetch_all_pages(start_url: str, token: str) -> list:
        results = []
        url = start_url
        session = requests.Session()
        session.headers["Authorization"] = f"Bearer {token}"

        while url:
            resp = session.get(url, timeout=10)
            resp.raise_for_status()
            body = resp.json()
            results.extend(body["items"])
            url = body.get("next")   # None on last page

        return results
    ```

=== "Offset / page number"
    ```python
    import requests

    def fetch_by_page(base_url: str, page_size: int = 20) -> list:
        results, page = [], 1
        while True:
            resp = requests.get(base_url, params={"page": page, "per_page": page_size}, timeout=10)
            resp.raise_for_status()
            items = resp.json()
            if not items:
                break
            results.extend(items)
            page += 1
        return results
    ```

=== "Pagination table"
    | Style | `next` field | Stop condition |
    |-------|-------------|----------------|
    | Cursor | URL or token | `next` is `null` |
    | Page number | none | empty array returned |
    | Link header | `Link: <url>; rel="next"` | no `rel="next"` in header |

!!! tip "Prefer cursor pagination"
    Cursor-based APIs are safe when records are inserted between pages; offset pagination may skip or duplicate items.

---

## 2. Retrying Failed Requests

=== "Manual back-off"
    ```python
    import time, requests

    def get_with_retry(url: str, retries: int = 3, backoff: float = 1.0):
        for attempt in range(retries):
            try:
                resp = requests.get(url, timeout=10)
                resp.raise_for_status()
                return resp.json()
            except requests.exceptions.RequestException as exc:
                if attempt == retries - 1:
                    raise
                wait = backoff * (2 ** attempt)
                print(f"Attempt {attempt+1} failed ({exc}). Retrying in {wait}s…")
                time.sleep(wait)
    ```

=== "HTTPAdapter + Retry"
    ```python
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    import requests

    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session = requests.Session()
    session.mount("https://", adapter)
    session.mount("http://",  adapter)

    resp = session.get("https://api.example.com/data", timeout=10)
    ```

!!! warning "Retry on 429"
    Always include `429 Too Many Requests` in your `status_forcelist` and honour the `Retry-After` header value.

---

## 3. Rate-Limit Headers

=== "Reading headers"
    ```python
    resp = requests.get("https://api.example.com/endpoint", timeout=10)

    remaining = int(resp.headers.get("X-RateLimit-Remaining", 1))
    reset_at   = int(resp.headers.get("X-RateLimit-Reset",     0))

    if remaining == 0:
        import time
        sleep_for = max(0, reset_at - time.time())
        print(f"Rate-limited. Sleeping {sleep_for:.1f}s")
        time.sleep(sleep_for)
    ```

=== "Rate-limit header table"
    | Header | Meaning |
    |--------|---------|
    | `X-RateLimit-Limit` | Max requests per window |
    | `X-RateLimit-Remaining` | Requests left in this window |
    | `X-RateLimit-Reset` | Unix timestamp when window resets |
    | `Retry-After` | Seconds to wait (on 429) |

---

## 4. Response Caching

=== "Simple in-memory cache"
    ```python
    import hashlib, json, requests
    from functools import lru_cache

    _cache: dict = {}

    def cached_get(url: str, **params) -> dict:
        key = hashlib.md5((url + json.dumps(params, sort_keys=True)).encode()).hexdigest()
        if key not in _cache:
            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            _cache[key] = resp.json()
        return _cache[key]
    ```

=== "requests-cache library"
    ```python
    import requests_cache

    # Cache all responses for 5 minutes in an SQLite db
    requests_cache.install_cache("api_cache", expire_after=300)

    import requests
    resp = requests.get("https://api.example.com/items")  # cached after first call
    ```

---

## 5. API Client Class with Dataclasses

=== "Client class"
    ```python
    import requests
    from dataclasses import dataclass, field
    from typing import List

    @dataclass
    class Item:
        id: int
        name: str
        tags: List[str] = field(default_factory=list)

    class APIClient:
        def __init__(self, base_url: str, token: str):
            self._base = base_url.rstrip("/")
            self._session = requests.Session()
            self._session.headers.update({
                "Authorization": f"Bearer {token}",
                "Accept": "application/json",
            })

        def get_items(self, page: int = 1) -> List[Item]:
            resp = self._session.get(f"{self._base}/items", params={"page": page}, timeout=10)
            resp.raise_for_status()
            return [Item(**raw) for raw in resp.json()["items"]]

        def close(self):
            self._session.close()
    ```

=== "Usage"
    ```python
    client = APIClient("https://api.example.com", token="abc123")
    try:
        items = client.get_items(page=1)
        for item in items:
            print(item.name, item.tags)
    finally:
        client.close()
    ```

!!! info "Dataclass benefits"
    `@dataclass` gives you free `__repr__`, `__eq__`, and type hints. Use `dacite` or `pydantic` for nested, validated payloads.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate parsing paginated API responses (no network needed)
pages = [
    {"items": [{"id": i, "tag": "python"} for i in range(1, 6)],  "next": "page2"},
    {"items": [{"id": i, "tag": "web"}    for i in range(6, 11)], "next": "page3"},
    {"items": [{"id": i, "tag": "api"}    for i in range(11, 14)],"next": None},
]

def simulate_paginated_fetch(pages):
    all_items = []
    for page in pages:
        all_items.extend(page["items"])
        if not page["next"]:
            break
    return all_items

results = simulate_paginated_fetch(pages)
print(f"Total items fetched: {len(results)}")
for item in results[:3]:
    print(f"  id={item['id']}, tag={item['tag']}")
print("  ...")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Total Item Count

Process 3 pages of mock API data (5 + 5 + 3 items). Print the total item count.

<div class="pyodide-runner" data-mode="challenge" data-expected="13">
<pre><code class="language-python">pages = [
    {"items": list(range(5)),  "next": True},
    {"items": list(range(5)),  "next": True},
    {"items": list(range(3)),  "next": None},
]

total = 0
for page in pages:
    # Add your code here
    pass

print(total)
</code></pre>
</div>

---

### Challenge 2 — Unique Tags

Extract all unique tags from a list of mock API objects and print them sorted, one per line.

<div class="pyodide-runner" data-mode="challenge" data-expected="api
python
web">
<pre><code class="language-python">mock_objects = [
    {"id": 1, "tags": ["python", "web"]},
    {"id": 2, "tags": ["api", "python"]},
    {"id": 3, "tags": ["web", "api"]},
]

# Collect all unique tags and print sorted
unique_tags = set()
for obj in mock_objects:
    pass  # fill this in

for tag in sorted(unique_tags):
    print(tag)
</code></pre>
</div>

---

## 📚 Further Reading

- [requests — Advanced Usage](https://requests.readthedocs.io/en/latest/user/advanced/)
- [urllib3 Retry utility](https://urllib3.readthedocs.io/en/stable/reference/urllib3.util.retry.html)
- [Python dataclasses — official docs](https://docs.python.org/3/library/dataclasses.html)

---

!!! success "Lesson Complete 🎉"
    You can now consume paginated APIs reliably, handle failures gracefully, and model responses with dataclasses. Next: render that data in a real Flask frontend!

[⬅️ Section 5 · Security](../05-security/index.md){ .md-button } [➡️ Lesson 52 · Building a Simple Flask Frontend](52-flask-frontend.md){ .md-button .md-button--primary }
