---
title: "Lesson 62 · Exporting Data to CSV & JSON"
description: "Generate CSV with the csv module, produce JSON with the json module, stream large file downloads in Flask, set correct content-type headers, and build a file download endpoint."
---

# Lesson 62 · Exporting Data to CSV & JSON

> **Section:** 📊 Data APIs, CSV/JSON Exports & Visualization &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Generate well-formed CSV using `csv.DictWriter` and `StringIO`
- [ ] Produce compact and pretty-printed JSON with the `json` module
- [ ] Set the correct `Content-Type` and `Content-Disposition` headers for file downloads
- [ ] Build a Flask endpoint that streams a large CSV using `Response` and a generator
- [ ] Understand when to use CSV vs JSON for different consumers

---

## 📖 Introduction

Two of the most requested features in any data API are **CSV export** (for spreadsheet users) and **JSON export** (for downstream services). Python's stdlib handles both — `csv` for tabular text files and `json` for structured data — without any third-party dependency.

In a web API context the key challenges are:
- Building the file content in-memory without writing to disk.
- Telling the browser it is a downloadable file (`Content-Disposition: attachment`).
- Streaming large exports so you don't load millions of rows into RAM at once.

!!! info "No extra installs needed"
    All examples in this lesson use only Python's standard library (`csv`, `json`, `io`) and Flask. The browser runner uses only `csv`, `json`, and `io`.

---

## 1. Generating CSV with `csv.DictWriter`

The `csv` module writes rows from dictionaries, automatically handling quoting and escaping.

=== "Python"
    ```python
    import csv, io

    rows = [
        {"name": "Alice", "age": 28, "city": "New York"},
        {"name": "Bob",   "age": 35, "city": "Chicago, IL"},   # comma in value — auto-quoted
        {"name": "Carol", "age": 32, "city": "Los Angeles"},
    ]

    # Write to an in-memory string buffer
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["name", "age", "city"])
    writer.writeheader()
    writer.writerows(rows)

    csv_string = buf.getvalue()
    print(csv_string)
    ```
=== "Output"
    ```
    name,age,city
    Alice,28,New York
    Bob,35,"Chicago, IL"
    Carol,32,Los Angeles
    ```

!!! tip "Always write the header first"
    `writeheader()` must be called before `writerows()` otherwise the first data row becomes the header.

| Parameter | Purpose | Example |
|---|---|---|
| `fieldnames` | Column order | `["id","name","score"]` |
| `delimiter` | Separator character | `delimiter="\t"` for TSV |
| `quotechar` | Quote character | `quotechar='"'` (default) |
| `extrasaction` | Ignore or raise on extra keys | `extrasaction="ignore"` |

---

## 2. Generating JSON — Pretty-Print vs Compact

=== "Pretty-print"
    ```python
    import json

    data = {
        "employees": [
            {"name": "Alice", "age": 28},
            {"name": "Bob",   "age": 35},
        ],
        "total": 2,
    }

    # Human-readable, 2-space indent
    pretty = json.dumps(data, indent=2)
    print(pretty)
    print("Size:", len(pretty), "chars")
    ```
=== "Compact"
    ```python
    import json

    data = {
        "employees": [
            {"name": "Alice", "age": 28},
            {"name": "Bob",   "age": 35},
        ],
        "total": 2,
    }

    # Compact — smallest possible output (no extra spaces)
    compact = json.dumps(data, separators=(",", ":"))
    print(compact)
    print("Size:", len(compact), "chars")
    ```
=== "Custom types"
    ```python
    import json
    from datetime import datetime, date

    class DateEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, (datetime, date)):
                return obj.isoformat()
            return super().default(obj)

    data = {"event": "launch", "date": date(2024, 6, 1)}
    print(json.dumps(data, cls=DateEncoder))
    # {"event": "launch", "date": "2024-06-01"}
    ```

---

## 3. Flask File-Download Endpoints

=== "CSV download"
    ```python
    from flask import Flask, Response
    import csv, io

    app = Flask(__name__)

    EMPLOYEES = [
        {"name": "Alice", "age": 28, "dept": "Eng"},
        {"name": "Bob",   "age": 35, "dept": "HR"},
        {"name": "Carol", "age": 32, "dept": "Eng"},
    ]

    @app.get("/export/csv")
    def export_csv():
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=["name", "age", "dept"])
        writer.writeheader()
        writer.writerows(EMPLOYEES)

        return Response(
            buf.getvalue(),
            mimetype="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=employees.csv"
            },
        )
    ```
=== "JSON download"
    ```python
    from flask import Flask, Response
    import json

    app = Flask(__name__)

    EMPLOYEES = [
        {"name": "Alice", "age": 28},
        {"name": "Bob",   "age": 35},
    ]

    @app.get("/export/json")
    def export_json():
        payload = json.dumps(EMPLOYEES, indent=2)
        return Response(
            payload,
            mimetype="application/json",
            headers={
                "Content-Disposition": "attachment; filename=employees.json"
            },
        )
    ```

---

## 4. Streaming Large CSV Exports

For large datasets (millions of rows) loading everything into memory before responding is impractical. Flask's `Response` accepts a **generator** so rows are written and flushed incrementally.

=== "Python"
    ```python
    from flask import Flask, Response
    import csv, io

    app = Flask(__name__)

    def generate_rows(n=1_000_000):
        """Yield n fake employee rows."""
        for i in range(n):
            yield {"id": i, "name": f"Employee-{i}", "salary": 50000 + i}

    def stream_csv(row_iter):
        """Yield CSV lines one row at a time."""
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=["id", "name", "salary"])
        writer.writeheader()
        yield buf.getvalue()

        for row in row_iter:
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=["id", "name", "salary"])
            writer.writerow(row)
            yield buf.getvalue()

    @app.get("/export/large-csv")
    def large_csv():
        return Response(
            stream_csv(generate_rows()),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=large.csv"},
        )
    ```
=== "Why streaming matters"
    ```
    Without streaming:
      All 1 000 000 rows → RAM → send
      Peak memory: ~200 MB

    With streaming:
      Row 1 → send
      Row 2 → send
      ...
      Peak memory: ~1 KB (just the current row)
    ```

!!! warning "Disable buffering for true streaming"
    Some WSGI servers (e.g. Gunicorn) buffer responses. Set `RESPONSE_ALREADY_CLOSED = False` or use `stream_with_context` from Flask to ensure chunks are flushed immediately.

---

## 5. Content-Type Headers Reference

| Format | `Content-Type` | Download header |
|---|---|---|
| CSV | `text/csv` | `Content-Disposition: attachment; filename=data.csv` |
| JSON | `application/json` | `Content-Disposition: attachment; filename=data.json` |
| NDJSON | `application/x-ndjson` | One JSON object per line |
| TSV | `text/tab-separated-values` | Tab-delimited CSV |

!!! note "Inline vs attachment"
    `Content-Disposition: inline` tells the browser to try to display the file. `attachment` forces a download dialog. Always use `attachment` for CSV and JSON API exports.

---

## 💻 Try It Yourself

Build a CSV string from a list of dicts using `csv.DictWriter` and `StringIO`.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import csv, io

orders = [
    {"order_id": 1, "product": "Widget", "qty": 3, "price": 9.99},
    {"order_id": 2, "product": "Gadget", "qty": 1, "price": 24.99},
    {"order_id": 3, "product": "Doohickey", "qty": 5, "price": 4.49},
]

buf = io.StringIO()
writer = csv.DictWriter(buf, fieldnames=["order_id", "product", "qty", "price"])
writer.writeheader()
writer.writerows(orders)

csv_output = buf.getvalue()
print(csv_output)

lines = csv_output.strip().split("\n")
print(f"Lines (including header): {len(lines)}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Line Count

Generate a CSV string from 3 data rows using `csv.DictWriter` and print the total number of lines (including the header row).

<div class="pyodide-runner" data-mode="challenge" data-expected="4">
<pre><code class="language-python">import csv, io

rows = [
    {"name": "Alice", "score": 88},
    {"name": "Bob",   "score": 92},
    {"name": "Carol", "score": 75},
]

# Write to StringIO with DictWriter, then count lines and print the count
</code></pre>
</div>

### Challenge 2 — JSON Size

Compute the total character length of a compact JSON dump of the given dictionary and print it.

<div class="pyodide-runner" data-mode="challenge" data-expected="67">
<pre><code class="language-python">import json

data = {"name": "Alice", "age": 28, "city": "New York", "active": True}

# Dump as compact JSON (no spaces) and print the character count
</code></pre>
</div>

---

## 📚 Further Reading

- [Python `csv` module documentation](https://docs.python.org/3/library/csv.html)
- [Python `json` module documentation](https://docs.python.org/3/library/json.html)
- [Flask Streaming — Official Docs](https://flask.palletsprojects.com/en/latest/patterns/streaming/)

---

!!! success "Lesson Complete 🎉"
    You can now generate CSV and JSON exports in-memory, set the right download headers, and stream large files from a Flask endpoint without blowing up your server's RAM.

[⬅️ Lesson 61 · Pandas](61-data-analysis-pandas.md){ .md-button } [➡️ Lesson 63 · REST API Visualization](63-rest-api-visualization.md){ .md-button .md-button--primary }
