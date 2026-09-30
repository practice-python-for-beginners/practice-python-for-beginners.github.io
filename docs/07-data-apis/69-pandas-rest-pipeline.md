---
title: "Lesson 69 · Pandas to REST API Pipeline"
description: "Build a complete data transformation pipeline: read source data, apply Pandas filter/transform/aggregate steps, convert DataFrames to JSON responses, validate with Pydantic, test pipelines, and cache results."
---

# Lesson 69 · Pandas to REST API Pipeline

> **Section:** 📊 Data APIs, CSV/JSON Exports & Visualization &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Design a multi-step Pandas transformation pipeline (filter → transform → aggregate)
- [ ] Convert a Pandas DataFrame to a JSON-serializable structure
- [ ] Validate API response shapes with Pydantic models
- [ ] Write unit tests for pipeline functions
- [ ] Cache transformed DataFrames to avoid re-running expensive computations
- [ ] Use list comprehensions to replicate a pipeline without Pandas (for tests)

---

## 📖 Introduction

A **data pipeline** is a sequence of deterministic transformations: raw data goes in, clean/aggregated data comes out. When you wire this pipeline into a REST API, each endpoint becomes a thin wrapper around a pipeline step.

The pattern in this lesson is: **Source** (CSV/DB) → **Filter** → **Transform** → **Aggregate** → **Serialize** → **Respond**.

!!! info "Install dependencies"
    ```bash
    pip install pandas pydantic flask
    ```
    The browser runner simulates the full pipeline with pure Python list comprehensions — no Pandas required.

---

## 1. Reading Source Data

=== "From CSV"
    ```python
    import pandas as pd

    df = pd.read_csv("employees.csv")
    print(df.head())
    print(df.shape)        # (rows, cols)
    print(df.dtypes)
    ```
=== "From SQLite"
    ```python
    import pandas as pd
    import sqlite3

    conn = sqlite3.connect("hr.db")
    df   = pd.read_sql("SELECT * FROM employees", conn)
    conn.close()
    print(df.head())
    ```
=== "From a list of dicts"
    ```python
    import pandas as pd

    RAW = [
        {"name": "Alice", "dept": "Eng",   "age": 28, "salary": 60000},
        {"name": "Bob",   "dept": "HR",    "age": 35, "salary": 72000},
        {"name": "Carol", "dept": "Eng",   "age": 32, "salary": 90000},
        {"name": "Dave",  "dept": "Sales", "age": 41, "salary": 55000},
        {"name": "Eve",   "dept": "HR",    "age": 29, "salary": 68000},
    ]

    df = pd.DataFrame(RAW)
    print(df)
    ```

---

## 2. Filter → Transform → Aggregate

Build each step as a pure function that takes and returns a DataFrame:

=== "Python"
    ```python
    import pandas as pd

    RAW = [
        {"name": "Alice", "dept": "Eng",   "age": 28, "salary": 60000},
        {"name": "Bob",   "dept": "HR",    "age": 35, "salary": 72000},
        {"name": "Carol", "dept": "Eng",   "age": 32, "salary": 90000},
        {"name": "Dave",  "dept": "Sales", "age": 41, "salary": 55000},
        {"name": "Eve",   "dept": "HR",    "age": 29, "salary": 68000},
    ]

    def load() -> pd.DataFrame:
        return pd.DataFrame(RAW)

    def filter_senior(df: pd.DataFrame, min_age: int = 30) -> pd.DataFrame:
        return df[df["age"] >= min_age].copy()

    def apply_raise(df: pd.DataFrame, pct: float = 0.10) -> pd.DataFrame:
        df = df.copy()
        df["salary"] = (df["salary"] * (1 + pct)).round(2)
        return df

    def aggregate_by_dept(df: pd.DataFrame) -> pd.DataFrame:
        return (
            df.groupby("dept")["salary"]
              .agg(avg_salary="mean", headcount="count")
              .reset_index()
        )

    # Chain the pipeline
    result = aggregate_by_dept(apply_raise(filter_senior(load())))
    print(result)
    ```
=== "Output"
    ```
        dept  avg_salary  headcount
    0    Eng     99000.0          1   # Carol after 10% raise
    1     HR     79200.0          1   # Bob after 10% raise
    2  Sales     60500.0          1   # Dave after 10% raise
    ```

!!! tip "Chaining with `pipe()`"
    ```python
    result = (
        load()
        .pipe(filter_senior, min_age=30)
        .pipe(apply_raise, pct=0.10)
        .pipe(aggregate_by_dept)
    )
    ```

---

## 3. DataFrame → JSON for API Response

=== "to_dict / to_json"
    ```python
    import pandas as pd

    df = pd.DataFrame({"dept": ["Eng","HR"], "avg_salary": [99000, 79200]})

    # Most common: list of record dicts
    records = df.to_dict(orient="records")
    print(records)
    # [{'dept': 'Eng', 'avg_salary': 99000}, {'dept': 'HR', 'avg_salary': 79200}]

    # As JSON string (handles NaN → null automatically)
    json_str = df.to_json(orient="records")
    print(json_str)

    # Index-keyed dict
    print(df.to_dict(orient="index"))
    ```
=== "Flask endpoint"
    ```python
    from flask import Flask, jsonify, request
    import pandas as pd

    app = Flask(__name__)

    @app.get("/pipeline/dept-summary")
    def dept_summary():
        min_age = int(request.args.get("min_age", 25))
        pct     = float(request.args.get("raise_pct", 0.10))

        result = (
            load()
            .pipe(filter_senior, min_age=min_age)
            .pipe(apply_raise, pct=pct)
            .pipe(aggregate_by_dept)
        )

        return jsonify(result.to_dict(orient="records"))
    ```

---

## 4. Pydantic Schema Validation

Validate the shape of API responses before returning them:

=== "Python"
    ```python
    from pydantic import BaseModel
    from typing import List

    class DeptSummary(BaseModel):
        dept:       str
        avg_salary: float
        headcount:  int

    class PipelineResponse(BaseModel):
        data:    List[DeptSummary]
        count:   int
        filters: dict

    # Validate the pipeline output
    raw_records = result.to_dict(orient="records")
    validated   = PipelineResponse(
        data    = raw_records,
        count   = len(raw_records),
        filters = {"min_age": 30, "raise_pct": 0.10},
    )
    print(validated.model_dump_json(indent=2))
    ```
=== "FastAPI with Pydantic"
    ```python
    from fastapi import FastAPI
    from pydantic import BaseModel
    from typing import List

    app = FastAPI()

    class DeptSummary(BaseModel):
        dept: str
        avg_salary: float
        headcount: int

    @app.get("/pipeline/dept-summary", response_model=List[DeptSummary])
    def dept_summary(min_age: int = 25, raise_pct: float = 0.10):
        result = (
            load()
            .pipe(filter_senior, min_age=min_age)
            .pipe(apply_raise, pct=raise_pct)
            .pipe(aggregate_by_dept)
        )
        return result.to_dict(orient="records")
    ```

---

## 5. Pipeline Testing and Caching

=== "Unit tests"
    ```python
    import pandas as pd

    def test_filter_senior():
        df = pd.DataFrame({"age": [25, 30, 35], "salary": [50000, 60000, 70000]})
        result = filter_senior(df, min_age=30)
        assert len(result) == 2
        assert result["age"].min() >= 30

    def test_apply_raise():
        df = pd.DataFrame({"salary": [100_000]})
        result = apply_raise(df, pct=0.10)
        assert result["salary"].iloc[0] == 110_000.0

    test_filter_senior()
    test_apply_raise()
    print("All tests passed ✅")
    ```
=== "Caching with joblib"
    ```python
    from joblib import Memory
    import pandas as pd

    memory = Memory(location=".cache/", verbose=0)

    @memory.cache
    def expensive_aggregation(csv_path: str, min_age: int) -> list:
        df = pd.read_csv(csv_path)
        result = (
            df.pipe(filter_senior, min_age=min_age)
              .pipe(apply_raise)
              .pipe(aggregate_by_dept)
        )
        return result.to_dict(orient="records")
    ```

---

## 💻 Try It Yourself

Implement a data transformation pipeline using list comprehensions — filter, transform, aggregate.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">employees = [
    {"name": "Alice", "dept": "Eng",   "age": 28, "salary": 60000},
    {"name": "Bob",   "dept": "HR",    "age": 35, "salary": 72000},
    {"name": "Carol", "dept": "Eng",   "age": 32, "salary": 90000},
    {"name": "Dave",  "dept": "Sales", "age": 41, "salary": 55000},
    {"name": "Eve",   "dept": "HR",    "age": 29, "salary": 68000},
]

# Step 1: Filter (age > 25)
filtered = [e for e in employees if e["age"] > 25]

# Step 2: Transform (apply 10% salary raise)
transformed = [{**e, "salary": e["salary"] * 1.1} for e in filtered]

# Step 3: Aggregate (mean salary by dept)
depts = set(e["dept"] for e in transformed)
summary = {}
for dept in sorted(depts):
    group = [e["salary"] for e in transformed if e["dept"] == dept]
    summary[dept] = round(sum(group) / len(group), 1)

print("Pipeline result (mean salary after 10% raise, age > 25):")
for dept, avg in summary.items():
    print(f"  {dept:6s}: ${avg:,.1f}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Full Pipeline

Run the pipeline: filter `age > 25`, apply a 10% salary raise, compute the mean salary across filtered + raised records. Print the result.

<div class="pyodide-runner" data-mode="challenge" data-expected="77000.0">
<pre><code class="language-python">employees = [
    {"name": "Alice", "dept": "Eng",   "age": 28, "salary": 60000},
    {"name": "Bob",   "dept": "HR",    "age": 35, "salary": 72000},
    {"name": "Carol", "dept": "Eng",   "age": 32, "salary": 90000},
    {"name": "Dave",  "dept": "Sales", "age": 41, "salary": 55000},
    {"name": "Eve",   "dept": "HR",    "age": 29, "salary": 68000},
]

# Step 1: filter age > 25
# Step 2: multiply each salary by 1.1
# Step 3: compute mean salary across all filtered+raised records
# Print the mean salary as a float (e.g. 77000.0)
</code></pre>
</div>

### Challenge 2 — Unique Departments

Count the number of unique departments in the dataset and print the count.

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">employees = [
    {"name": "Alice", "dept": "Eng"},
    {"name": "Bob",   "dept": "HR"},
    {"name": "Carol", "dept": "Eng"},
    {"name": "Dave",  "dept": "Sales"},
    {"name": "Eve",   "dept": "HR"},
]

# Count unique departments and print the count
</code></pre>
</div>

---

## 📚 Further Reading

- [Pandas — `pipe()` for Method Chaining](https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.pipe.html)
- [Pydantic — Data Validation with Python](https://docs.pydantic.dev/latest/)
- [FastAPI — Response Model](https://fastapi.tiangolo.com/tutorial/response-model/)

---

!!! success "Lesson Complete 🎉"
    You now have a fully structured, testable, and cacheable Pandas-to-REST pipeline. Each step is an independent, pure function — easy to test, easy to replace, and easy to expose through a Flask or FastAPI endpoint.

[⬅️ Lesson 68 · JSON Report Generator](68-json-report-generator.md){ .md-button } [➡️ Lesson 70 · Complete Data Visualization App](70-data-viz-complete.md){ .md-button .md-button--primary }
