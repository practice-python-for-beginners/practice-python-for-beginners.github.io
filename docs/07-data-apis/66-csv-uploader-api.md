---
title: "Lesson 66 · CSV Data Uploader API"
description: "Accept file uploads in Flask/FastAPI, validate CSV structure and required columns, parse with csv.DictReader, perform row-level validation, return structured errors, and track upload progress."
---

# Lesson 66 · CSV Data Uploader API

> **Section:** 📊 Data APIs, CSV/JSON Exports & Visualization &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Accept multipart file uploads in Flask and FastAPI
- [ ] Validate that a CSV has the required columns
- [ ] Parse uploaded CSV content with `csv.DictReader`
- [ ] Validate individual rows (type checks, range checks)
- [ ] Return structured validation errors in a JSON response
- [ ] Store valid rows in memory and report upload statistics

---

## 📖 Introduction

CSV upload is a staple of data entry workflows — bulk employee imports, product catalogue updates, grade submissions. A robust uploader does more than just save the file; it **validates**, **reports errors row by row**, and only persists records that pass every check.

This lesson builds a complete upload pipeline: receive → parse → validate → store → respond.

!!! info "No extra installs for the runner"
    The interactive runner uses only Python's `csv` and `io` stdlib modules. Flask/FastAPI examples require those packages installed locally.

---

## 1. Accepting File Uploads in Flask

=== "Flask endpoint"
    ```python
    from flask import Flask, request, jsonify
    import csv, io

    app = Flask(__name__)

    @app.post("/upload/csv")
    def upload_csv():
        if "file" not in request.files:
            return jsonify({"error": "No file part in request"}), 400

        f = request.files["file"]

        if f.filename == "":
            return jsonify({"error": "No file selected"}), 400

        if not f.filename.endswith(".csv"):
            return jsonify({"error": "Only .csv files are accepted"}), 415

        # Decode bytes → string → parse
        content = f.stream.read().decode("utf-8")
        reader  = csv.DictReader(io.StringIO(content))
        rows    = list(reader)

        return jsonify({"rows_received": len(rows), "columns": reader.fieldnames})
    ```
=== "FastAPI endpoint"
    ```python
    from fastapi import FastAPI, UploadFile, HTTPException
    import csv, io

    app = FastAPI()

    @app.post("/upload/csv")
    async def upload_csv(file: UploadFile):
        if not file.filename.endswith(".csv"):
            raise HTTPException(415, "Only .csv files are accepted")

        content = (await file.read()).decode("utf-8")
        reader  = csv.DictReader(io.StringIO(content))
        rows    = list(reader)

        return {"rows_received": len(rows), "columns": list(reader.fieldnames or [])}
    ```
=== "curl test"
    ```bash
    curl -X POST http://localhost:5000/upload/csv \
         -F "file=@employees.csv"
    ```

---

## 2. Validating CSV Structure (Required Columns)

Before processing rows, confirm the header matches the expected schema.

=== "Python"
    ```python
    import csv, io

    REQUIRED_COLUMNS = {"name", "age", "email", "salary"}

    def validate_columns(csv_string: str) -> tuple[bool, list[str]]:
        reader = csv.DictReader(io.StringIO(csv_string))
        if not reader.fieldnames:
            return False, ["CSV file is empty or has no header row"]

        present  = set(reader.fieldnames)
        missing  = REQUIRED_COLUMNS - present
        extra    = present - REQUIRED_COLUMNS

        errors = []
        if missing:
            errors.append(f"Missing columns: {sorted(missing)}")
        return len(errors) == 0, errors

    # Test
    good_csv = "name,age,email,salary\nAlice,28,alice@x.com,60000"
    bad_csv  = "name,age\nAlice,28"

    ok, errs = validate_columns(good_csv)
    print("Good CSV:", ok, errs)

    ok, errs = validate_columns(bad_csv)
    print("Bad CSV:", ok, errs)
    ```
=== "Output"
    ```
    Good CSV: True []
    Bad CSV: False ["Missing columns: ['email', 'salary']"]
    ```

| Check | Code |
|---|---|
| Required columns present | `REQUIRED - set(fieldnames)` |
| No extra unexpected columns | `set(fieldnames) - REQUIRED` |
| Non-empty file | `if not reader.fieldnames` |
| Header row count | `len(reader.fieldnames) > 0` |

---

## 3. Row-Level Validation

=== "Python"
    ```python
    import csv, io

    def validate_row(row: dict, row_num: int) -> list[dict]:
        """Return a list of error dicts for this row."""
        errors = []

        # Name must be non-empty
        if not row.get("name", "").strip():
            errors.append({"row": row_num, "field": "name", "error": "Name is required"})

        # Age must be an integer in range 18–99
        try:
            age = int(row.get("age", ""))
            if not (18 <= age <= 99):
                errors.append({"row": row_num, "field": "age",
                               "error": f"Age {age} is out of range 18–99"})
        except ValueError:
            errors.append({"row": row_num, "field": "age",
                           "error": f"Age '{row.get('age')}' is not an integer"})

        # Salary must be a positive number
        try:
            salary = float(row.get("salary", ""))
            if salary <= 0:
                errors.append({"row": row_num, "field": "salary",
                               "error": "Salary must be positive"})
        except ValueError:
            errors.append({"row": row_num, "field": "salary",
                           "error": "Salary must be a number"})

        return errors
    ```
=== "Full upload pipeline"
    ```python
    def process_upload(csv_string: str) -> dict:
        reader     = csv.DictReader(io.StringIO(csv_string))
        valid_rows = []
        all_errors = []

        for i, row in enumerate(reader, start=2):   # row 1 = header
            row_errors = validate_row(row, i)
            if row_errors:
                all_errors.extend(row_errors)
            else:
                valid_rows.append(row)

        return {
            "valid_count":   len(valid_rows),
            "invalid_count": len(all_errors),
            "errors":        all_errors,
            "data":          valid_rows,
        }
    ```

---

## 4. Returning Validation Errors as JSON

=== "Flask — full endpoint"
    ```python
    from flask import Flask, request, jsonify
    import csv, io

    app = Flask(__name__)
    REQUIRED = {"name", "age", "salary"}

    @app.post("/upload/employees")
    def upload_employees():
        f = request.files.get("file")
        if not f:
            return jsonify({"error": "No file uploaded"}), 400

        content = f.stream.read().decode("utf-8")
        reader  = csv.DictReader(io.StringIO(content))

        # Column validation
        missing = REQUIRED - set(reader.fieldnames or [])
        if missing:
            return jsonify({"error": f"Missing columns: {sorted(missing)}"}), 422

        valid, errors = [], []
        for i, row in enumerate(reader, 2):
            try:
                validated = {
                    "name":   row["name"].strip(),
                    "age":    int(row["age"]),
                    "salary": float(row["salary"]),
                }
                valid.append(validated)
            except (ValueError, KeyError) as e:
                errors.append({"row": i, "error": str(e)})

        return jsonify({
            "accepted": len(valid),
            "rejected": len(errors),
            "errors":   errors,
        }), 200 if not errors else 207   # 207 Multi-Status
    ```

!!! note "HTTP 207 Multi-Status"
    Return `207` when some rows were accepted and some were rejected. Return `422 Unprocessable Entity` when the entire file is structurally invalid.

---

## 5. Progress Tracking for Large Uploads

=== "Server-Sent Events (SSE)"
    ```python
    from flask import Flask, Response, request
    import csv, io, json, time

    app = Flask(__name__)

    @app.post("/upload/progress")
    def upload_with_progress():
        content = request.files["file"].stream.read().decode("utf-8")
        rows    = list(csv.DictReader(io.StringIO(content)))
        total   = len(rows)

        def generate():
            for i, row in enumerate(rows, 1):
                time.sleep(0.01)   # simulate processing
                pct = round(i / total * 100)
                yield f"data: {json.dumps({'processed': i, 'total': total, 'pct': pct})}\n\n"
            yield f"data: {json.dumps({'status': 'done', 'total': total})}\n\n"

        return Response(generate(), mimetype="text/event-stream")
    ```

---

## 💻 Try It Yourself

Validate a CSV string: check required columns, count valid vs invalid rows.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import csv, io

csv_data = """name,age,salary
Alice,28,60000
Bob,abc,72000
Carol,32,90000
Dave,,55000"""

REQUIRED = {"name", "age", "salary"}

reader = csv.DictReader(io.StringIO(csv_data))
missing_cols = REQUIRED - set(reader.fieldnames or [])
if missing_cols:
    print(f"Missing columns: {missing_cols}")
else:
    valid, invalid = 0, 0
    for i, row in enumerate(reader, 2):
        try:
            int(row["age"])
            float(row["salary"])
            valid += 1
        except (ValueError, TypeError):
            print(f"  Row {i} invalid: age={row['age']!r}, salary={row['salary']!r}")
            invalid += 1

    print(f"\nValid rows:   {valid}")
    print(f"Invalid rows: {invalid}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Invalid Row Count

Parse a CSV string with 3 data rows where 1 row has a missing `age` field. Print `"1 invalid row"`.

<div class="pyodide-runner" data-mode="challenge" data-expected="1 invalid row">
<pre><code class="language-python">import csv, io

csv_data = """name,age,score
Alice,28,85
Bob,,90
Carol,32,78"""

# Parse with DictReader; a row is invalid if age is missing or not an int
# Print: "1 invalid row"  (or "N invalid rows")
</code></pre>
</div>

### Challenge 2 — Average Score

Parse the CSV and compute the average value of the `score` column across all rows.

<div class="pyodide-runner" data-mode="challenge" data-expected="85.0">
<pre><code class="language-python">import csv, io

csv_data = """name,score
Alice,80
Bob,90
Carol,85"""

# Parse with DictReader, compute average of "score", print as float (e.g. 85.0)
</code></pre>
</div>

---

## 📚 Further Reading

- [Python `csv.DictReader` documentation](https://docs.python.org/3/library/csv.html#csv.DictReader)
- [Flask — File Uploads](https://flask.palletsprojects.com/en/latest/patterns/fileuploads/)
- [FastAPI — Request Files](https://fastapi.tiangolo.com/tutorial/request-files/)

---

!!! success "Lesson Complete 🎉"
    You can now build a production-quality CSV upload endpoint: validate structure, validate each row, collect structured errors, store valid records, and report results — all without writing a single file to disk.

[⬅️ Lesson 65 · Plotly Dash](65-plotly-dash.md){ .md-button } [➡️ Lesson 67 · Dataset Search API](67-dataset-search-api.md){ .md-button .md-button--primary }
