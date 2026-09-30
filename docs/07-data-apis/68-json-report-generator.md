---
title: "Lesson 68 · JSON Report Generator API"
description: "Generate structured JSON reports with summary and detail sections, aggregate data from multiple sources, add datetime timestamps, build a /report endpoint, and implement report caching."
---

# Lesson 68 · JSON Report Generator API

> **Section:** 📊 Data APIs, CSV/JSON Exports & Visualization &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Design a structured JSON report with `summary` and `detail` sections
- [ ] Aggregate data from multiple in-memory sources into one report object
- [ ] Add ISO 8601 timestamps to reports using `datetime`
- [ ] Build a `/report` Flask endpoint that returns the report as JSON
- [ ] Compare pretty-printed vs compact JSON output
- [ ] Cache expensive reports in memory to avoid recomputation on every request

---

## 📖 Introduction

A **JSON report** is a structured snapshot of computed data — a summary of KPIs at the top, detailed breakdowns below, and metadata (generated timestamp, filters applied) alongside. They are the backbone of automated dashboards, scheduled emails, and BI integrations.

The report generator pattern: collect data → transform → assemble report dict → serialize to JSON.

!!! info "No extra installs needed"
    All examples use only Python's stdlib (`json`, `datetime`) and optionally Flask. The browser runner uses only stdlib.

---

## 1. Designing the Report Structure

A well-structured report is self-describing. Establish a consistent schema early:

=== "Report schema"
    ```python
    report = {
        # --- Metadata ---
        "report_id":   "sales-2024-06",
        "title":       "Monthly Sales Report — June 2024",
        "generated_at": "2024-06-30T23:59:00Z",
        "filters":     {"month": 6, "year": 2024},

        # --- Summary KPIs ---
        "summary": {
            "total_revenue":  125_000.00,
            "order_count":    342,
            "avg_order_value": 365.50,
            "top_product":    "Widget Pro",
        },

        # --- Detail sections ---
        "by_product": [
            {"product": "Widget Pro", "units": 120, "revenue": 60_000},
            {"product": "Gadget X",   "units": 90,  "revenue": 45_000},
            {"product": "Doohickey",  "units": 132, "revenue": 20_000},
        ],
        "by_region": [
            {"region": "North",  "revenue": 55_000},
            {"region": "South",  "revenue": 40_000},
            {"region": "East",   "revenue": 30_000},
        ],
    }
    ```
=== "Schema rules"
    ```
    ✅ Always include generated_at (ISO 8601 UTC)
    ✅ summary section for quick KPI display
    ✅ detail sections as arrays of dicts
    ✅ Use snake_case keys throughout
    ✅ Include the filters that produced this report
    ❌ Don't nest more than 3 levels deep
    ❌ Don't mix arrays and dicts at the same level
    ```

---

## 2. Aggregating Data from Multiple Sources

=== "Python"
    ```python
    from datetime import datetime, timezone

    ORDERS = [
        {"id": 1, "product": "Widget Pro", "region": "North", "amount": 500.0,  "month": 6},
        {"id": 2, "product": "Gadget X",   "region": "South", "amount": 250.0,  "month": 6},
        {"id": 3, "product": "Widget Pro", "region": "North", "amount": 500.0,  "month": 6},
        {"id": 4, "product": "Doohickey",  "region": "East",  "amount": 75.0,   "month": 6},
        {"id": 5, "product": "Gadget X",   "region": "North", "amount": 250.0,  "month": 6},
    ]

    def build_report(orders: list, month: int, year: int) -> dict:
        filtered = [o for o in orders if o["month"] == month]

        # Summary
        total_revenue   = sum(o["amount"] for o in filtered)
        order_count     = len(filtered)
        avg_order_value = total_revenue / order_count if order_count else 0

        # By product
        products = {}
        for o in filtered:
            p = products.setdefault(o["product"], {"units": 0, "revenue": 0.0})
            p["units"]   += 1
            p["revenue"] += o["amount"]
        by_product = [{"product": k, **v} for k, v in products.items()]
        top_product = max(by_product, key=lambda x: x["revenue"])["product"] if by_product else None

        # By region
        regions = {}
        for o in filtered:
            regions[o["region"]] = regions.get(o["region"], 0.0) + o["amount"]
        by_region = [{"region": k, "revenue": v} for k, v in regions.items()]

        return {
            "report_id":   f"sales-{year}-{month:02d}",
            "title":       f"Monthly Sales Report — {year}-{month:02d}",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "filters":     {"month": month, "year": year},
            "summary": {
                "total_revenue":   round(total_revenue, 2),
                "order_count":     order_count,
                "avg_order_value": round(avg_order_value, 2),
                "top_product":     top_product,
            },
            "by_product": sorted(by_product, key=lambda x: x["revenue"], reverse=True),
            "by_region":  sorted(by_region,  key=lambda x: x["revenue"], reverse=True),
        }

    import json
    report = build_report(ORDERS, month=6, year=2024)
    print(json.dumps(report, indent=2))
    ```

---

## 3. The `/report` Flask Endpoint

=== "Flask"
    ```python
    from flask import Flask, jsonify, request
    from datetime import datetime, timezone

    app = Flask(__name__)

    # In-memory cache: {cache_key: (timestamp, report)}
    _CACHE: dict = {}
    CACHE_TTL = 300  # seconds

    @app.get("/report/sales")
    def sales_report():
        month = int(request.args.get("month", datetime.now().month))
        year  = int(request.args.get("year",  datetime.now().year))

        cache_key = f"sales-{year}-{month}"
        now = datetime.now(timezone.utc).timestamp()

        # Return cached version if fresh
        if cache_key in _CACHE:
            cached_at, cached_report = _CACHE[cache_key]
            if now - cached_at < CACHE_TTL:
                cached_report["_cached"] = True
                return jsonify(cached_report)

        # Build fresh report
        report = build_report(ORDERS, month=month, year=year)
        _CACHE[cache_key] = (now, report)
        return jsonify(report)
    ```
=== "Query parameters"
    ```bash
    # Default (current month/year)
    curl http://localhost:5000/report/sales

    # Specific month
    curl "http://localhost:5000/report/sales?month=3&year=2024"
    ```

---

## 4. Pretty-Print vs Compact JSON

=== "Python"
    ```python
    import json

    report = {"title": "Sales Q2", "summary": {"revenue": 125000, "orders": 342}}

    # Pretty — human-readable (use for debugging, documentation)
    pretty = json.dumps(report, indent=2)
    print("Pretty size:", len(pretty), "chars")
    print(pretty)

    # Compact — minimal whitespace (use for API responses)
    compact = json.dumps(report, separators=(",", ":"))
    print("\nCompact size:", len(compact), "chars")
    print(compact)

    # Sorted keys — deterministic output (useful for testing/caching)
    sorted_out = json.dumps(report, sort_keys=True, indent=2)
    print("\nSorted keys:")
    print(sorted_out)
    ```
=== "Size comparison"
    ```
    Pretty:  ~120 chars  (readable, good for logs)
    Compact: ~85 chars   (20–30% smaller, good for APIs)
    ```

!!! tip "Flask always returns compact JSON"
    `flask.jsonify()` returns compact JSON by default. To pretty-print in development, set `app.config["JSONIFY_PRETTYPRINT_REGULAR"] = True`.

---

## 5. Report Caching Strategies

| Strategy | Implementation | TTL |
|---|---|---|
| In-memory dict | `_CACHE[key] = (timestamp, data)` | Seconds/minutes |
| `functools.lru_cache` | `@lru_cache(maxsize=128)` | Process lifetime |
| Flask-Caching | `@cache.cached(timeout=300)` | Configurable |
| Redis | `redis.setex(key, ttl, json_data)` | Distributed, persistent |

=== "lru_cache example"
    ```python
    from functools import lru_cache

    @lru_cache(maxsize=32)
    def get_report(month: int, year: int) -> str:
        """Returns report as a JSON string. Cached by (month, year)."""
        report = build_report(ORDERS, month=month, year=year)
        return json.dumps(report)

    # First call: builds report
    r1 = get_report(6, 2024)
    # Second call with same args: returns cached result instantly
    r2 = get_report(6, 2024)
    print("Same object:", r1 is r2)   # True
    ```

---

## 💻 Try It Yourself

Build a sales report dict from a list of orders and print the total revenue.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">from datetime import datetime, timezone

orders = [
    {"product": "Widget Pro", "amount": 500.0,  "region": "North"},
    {"product": "Gadget X",   "amount": 250.0,  "region": "South"},
    {"product": "Widget Pro", "amount": 500.0,  "region": "North"},
    {"product": "Doohickey",  "amount": 75.0,   "region": "East"},
]

total_revenue = sum(o["amount"] for o in orders)
order_count   = len(orders)

products = {}
for o in orders:
    products[o["product"]] = products.get(o["product"], 0) + o["amount"]

report = {
    "generated_at":  datetime.now(timezone.utc).isoformat(),
    "summary": {
        "total_revenue":   round(total_revenue, 2),
        "order_count":     order_count,
        "avg_order_value": round(total_revenue / order_count, 2),
    },
    "by_product": sorted(
        [{"product": k, "revenue": v} for k, v in products.items()],
        key=lambda x: x["revenue"], reverse=True
    ),
}

print(f"Total revenue: ${report['summary']['total_revenue']:.2f}")
print(f"Orders:        {report['summary']['order_count']}")
print("Top products:")
for p in report["by_product"]:
    print(f"  {p['product']}: ${p['revenue']:.2f}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Total Revenue

Compute total revenue from the list of orders and print it as an integer.

<div class="pyodide-runner" data-mode="challenge" data-expected="425">
<pre><code class="language-python">orders = [
    {"amount": 100},
    {"amount": 250},
    {"amount": 75},
]

# Compute total revenue (sum of all amounts) and print it
</code></pre>
</div>

### Challenge 2 — Orders Above Threshold

Count how many orders have an amount strictly above $100 and print the count.

<div class="pyodide-runner" data-mode="challenge" data-expected="1">
<pre><code class="language-python">orders = [
    {"amount": 100},
    {"amount": 250},
    {"amount": 75},
]

# Count orders with amount > 100 and print the count
</code></pre>
</div>

---

## 📚 Further Reading

- [Python `datetime` — Working with Dates and Times](https://docs.python.org/3/library/datetime.html)
- [Python `json` module documentation](https://docs.python.org/3/library/json.html)
- [Flask-Caching — Extension for Flask](https://flask-caching.readthedocs.io/)

---

!!! success "Lesson Complete 🎉"
    You can now generate structured JSON reports with summary KPIs, detailed breakdowns, timestamps, and caching — everything needed to power a dashboard or scheduled report endpoint.

[⬅️ Lesson 67 · Dataset Search API](67-dataset-search-api.md){ .md-button } [➡️ Lesson 69 · Pandas to REST Pipeline](69-pandas-rest-pipeline.md){ .md-button .md-button--primary }
