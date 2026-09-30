---
title: "Lesson 61 · Data Analysis API with Pandas"
description: "Master Pandas Series and DataFrame, read CSV/JSON, filter with boolean indexing, use groupby and aggregation, describe() for summary stats, merge/join, and build a /stats endpoint that returns DataFrame.describe() as JSON."
---

# Lesson 61 · Data Analysis API with Pandas

> **Section:** 📊 Data APIs, CSV/JSON Exports & Visualization &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Create and manipulate Pandas `Series` and `DataFrame` objects
- [ ] Read data from CSV and JSON files into a DataFrame
- [ ] Filter rows using boolean indexing
- [ ] Aggregate data with `groupby()` and summary functions
- [ ] Generate descriptive statistics with `describe()`
- [ ] Merge and join DataFrames
- [ ] Build a `/stats` Flask endpoint that returns `describe()` output as JSON

---

## 📖 Introduction

**Pandas** is the cornerstone library for data manipulation in Python. It provides two primary data structures — `Series` (one-dimensional) and `DataFrame` (two-dimensional table) — that make reading, filtering, aggregating, and exporting data intuitive and fast.

When you expose data through a REST API, Pandas becomes an essential middle layer: read from a database or CSV, transform in memory, then serialize to JSON for the response.

!!! info "Install Pandas"
    ```bash
    pip install pandas
    ```
    The interactive runner below uses pure stdlib so it works in the browser. Install Pandas locally to follow the full examples.

---

## 1. Series and DataFrame Basics

A `Series` is a labeled one-dimensional array. A `DataFrame` is a collection of `Series` sharing the same index — think of it as a spreadsheet in code.

=== "Python"
    ```python
    import pandas as pd

    # --- Series ---
    temps = pd.Series([22.1, 19.8, 25.3, 23.0], name="temperature")
    print(temps)
    print("Mean:", temps.mean())

    # --- DataFrame ---
    data = {
        "name":   ["Alice", "Bob", "Carol", "Dave"],
        "age":    [28, 35, 32, 41],
        "salary": [60000, 72000, 90000, 55000],
        "dept":   ["Eng", "HR", "Eng", "Sales"],
    }
    df = pd.DataFrame(data)
    print(df)
    print(df.dtypes)
    ```
=== "Output"
    ```
    0    22.1
    1    19.8
    2    25.3
    3    23.0
    Name: temperature, dtype: float64
    Mean: 22.55

       name  age  salary   dept
    0  Alice   28   60000    Eng
    1    Bob   35   72000     HR
    2  Carol   32   90000    Eng
    3   Dave   41   55000  Sales

    name      object
    age        int64
    salary     int64
    dept      object
    dtype: object
    ```

!!! tip "Quick DataFrame inspection"
    Use `df.head()`, `df.tail()`, `df.shape`, `df.columns`, and `df.info()` to get an immediate overview of any DataFrame.

---

## 2. Reading CSV & JSON and Boolean Indexing

=== "Read CSV"
    ```python
    import pandas as pd

    # Read from a file path
    df = pd.read_csv("employees.csv")

    # Or from a URL
    df = pd.read_csv("https://example.com/data.csv")

    # Useful parameters
    df = pd.read_csv(
        "employees.csv",
        usecols=["name", "age", "salary"],   # only load these columns
        dtype={"salary": float},              # enforce types
        parse_dates=["hire_date"],            # auto-parse dates
    )
    print(df.head())
    ```
=== "Read JSON"
    ```python
    import pandas as pd

    # From a JSON file
    df = pd.read_json("employees.json")

    # From a JSON string
    import json
    records = '[{"name":"Alice","age":28},{"name":"Bob","age":35}]'
    df = pd.read_json(records)
    print(df)
    ```
=== "Boolean Indexing"
    ```python
    import pandas as pd

    data = {"name": ["Alice","Bob","Carol","Dave"],
            "age":  [28, 35, 32, 41],
            "salary": [60000, 72000, 90000, 55000],
            "dept": ["Eng","HR","Eng","Sales"]}
    df = pd.DataFrame(data)

    # Single condition
    senior = df[df["age"] > 30]
    print(senior[["name", "age"]])

    # Multiple conditions (use & and |, wrap each in parentheses)
    eng_senior = df[(df["dept"] == "Eng") & (df["salary"] > 65000)]
    print(eng_senior)
    ```

| Method | Purpose |
|---|---|
| `df[mask]` | Filter rows where boolean mask is `True` |
| `df.query("age > 30")` | SQL-style string query |
| `df.loc[mask, cols]` | Filter rows and select columns by label |
| `df.iloc[0:5]` | Select rows by integer position |

---

## 3. GroupBy and Aggregation

`groupby()` splits the DataFrame into groups, applies an aggregation function, and combines the results.

=== "Python"
    ```python
    import pandas as pd

    data = {"name": ["Alice","Bob","Carol","Dave","Eve"],
            "dept": ["Eng","HR","Eng","Sales","HR"],
            "salary": [60000, 72000, 90000, 55000, 68000]}
    df = pd.DataFrame(data)

    # Mean salary per department
    print(df.groupby("dept")["salary"].mean())

    # Multiple aggregations at once
    summary = df.groupby("dept")["salary"].agg(["mean","min","max","count"])
    print(summary)

    # Group by multiple columns
    df["bonus"] = df["salary"] * 0.1
    print(df.groupby("dept")[["salary","bonus"]].sum())
    ```
=== "Output"
    ```
    dept
    Eng      75000.0
    HR       70000.0
    Sales    55000.0
    Name: salary, dtype: float64

              mean    min    max  count
    dept
    Eng    75000.0  60000  90000      2
    HR     70000.0  68000  72000      2
    Sales  55000.0  55000  55000      1
    ```

!!! note "Named aggregations (Pandas ≥ 0.25)"
    ```python
    df.groupby("dept").agg(
        avg_salary=("salary", "mean"),
        headcount=("name", "count")
    )
    ```

---

## 4. `describe()` and Merging DataFrames

=== "describe()"
    ```python
    import pandas as pd

    data = {"age": [28, 35, 32, 41, 29],
            "salary": [60000, 72000, 90000, 55000, 68000]}
    df = pd.DataFrame(data)

    stats = df.describe()
    print(stats)

    # Convert to dict for API response
    stats_dict = stats.to_dict()
    print(stats_dict)
    ```
=== "Merge / Join"
    ```python
    import pandas as pd

    employees = pd.DataFrame({
        "emp_id": [1, 2, 3],
        "name": ["Alice", "Bob", "Carol"],
        "dept_id": [10, 20, 10],
    })
    departments = pd.DataFrame({
        "dept_id": [10, 20],
        "dept_name": ["Engineering", "HR"],
    })

    # Inner join (only matching rows)
    merged = pd.merge(employees, departments, on="dept_id", how="inner")
    print(merged)

    # Left join (keep all employees, even if no dept match)
    merged_left = pd.merge(employees, departments, on="dept_id", how="left")
    print(merged_left)
    ```

---

## 5. Building a `/stats` Flask Endpoint

This pattern is the core of a data API — transform with Pandas, serialize with `.to_json()`.

=== "Flask endpoint"
    ```python
    from flask import Flask, jsonify
    import pandas as pd, json

    app = Flask(__name__)

    EMPLOYEES = [
        {"name": "Alice", "age": 28, "salary": 60000, "dept": "Eng"},
        {"name": "Bob",   "age": 35, "salary": 72000, "dept": "HR"},
        {"name": "Carol", "age": 32, "salary": 90000, "dept": "Eng"},
        {"name": "Dave",  "age": 41, "salary": 55000, "dept": "Sales"},
    ]

    @app.get("/stats")
    def stats():
        df = pd.DataFrame(EMPLOYEES)
        # describe() only works on numeric columns by default
        description = df.describe().to_dict()
        return jsonify(description)

    @app.get("/stats/by-dept")
    def stats_by_dept():
        df = pd.DataFrame(EMPLOYEES)
        result = (
            df.groupby("dept")["salary"]
              .agg(mean="mean", min="min", max="max", count="count")
              .reset_index()
              .to_dict(orient="records")
        )
        return jsonify(result)
    ```
=== "Sample /stats response"
    ```json
    {
      "age":    {"count":4,"mean":34,"std":5.5,"min":28,"25%":30.5,"50%":33.5,"75%":37,"max":41},
      "salary": {"count":4,"mean":69250,"std":14731,"min":55000,...,"max":90000}
    }
    ```

!!! warning "NaN values break `jsonify`"
    Pandas uses `float('nan')` for missing data which is not valid JSON. Use `df.fillna(0)` or `df.dropna()` before calling `.to_dict()`, or serialize with `df.to_json()` which handles NaN automatically.

---

## 💻 Try It Yourself

Compute summary statistics (mean, min, max) on a list of employee dicts — **no Pandas needed**.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">employees = [
    {"name": "Alice", "age": 28, "salary": 60000},
    {"name": "Bob",   "age": 35, "salary": 72000},
    {"name": "Carol", "age": 32, "salary": 90000},
    {"name": "Dave",  "age": 41, "salary": 55000},
]

def describe(data, field):
    values = [row[field] for row in data]
    n = len(values)
    mean = sum(values) / n
    return {
        "count": n,
        "mean":  round(mean, 2),
        "min":   min(values),
        "max":   max(values),
    }

print("Age stats:   ", describe(employees, "age"))
print("Salary stats:", describe(employees, "salary"))
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Mean Age

Compute the mean age from the list of dicts and print the result.

<div class="pyodide-runner" data-mode="challenge" data-expected="32.5">
<pre><code class="language-python">people = [
    {"name": "Alice", "age": 28},
    {"name": "Bob",   "age": 35},
    {"name": "Carol", "age": 32},
    {"name": "Dave",  "age": 35},
]

# Compute mean age and print it (one decimal place)
</code></pre>
</div>

### Challenge 2 — Highest Earner

Find and print the name of the person with the highest salary.

<div class="pyodide-runner" data-mode="challenge" data-expected="Carol">
<pre><code class="language-python">employees = [
    {"name": "Alice", "salary": 60000},
    {"name": "Bob",   "salary": 72000},
    {"name": "Carol", "salary": 90000},
    {"name": "Dave",  "salary": 55000},
]

# Print the name of the employee with the max salary
</code></pre>
</div>

---

## 📚 Further Reading

- [Pandas Official Documentation — 10 Minutes to Pandas](https://pandas.pydata.org/docs/user_guide/10min.html)
- [Real Python — Pandas DataFrames 101](https://realpython.com/pandas-dataframe/)
- [Pandas GroupBy: Your Guide to Grouping Data in Python](https://realpython.com/pandas-groupby/)

---

!!! success "Lesson Complete 🎉"
    You can now load, filter, aggregate, and describe data with Pandas, and expose those results through a Flask `/stats` endpoint as JSON.

[⬅️ Lesson 60](../06-frontend/60-frontend-complete.md){ .md-button } [➡️ Lesson 62 · Exporting CSV & JSON](62-exporting-csv-json.md){ .md-button .md-button--primary }
