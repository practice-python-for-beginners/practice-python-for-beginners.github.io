---
title: "Lesson 55 · Flask Dashboard with Charts"
description: "Build a multi-chart Flask dashboard by serving Chart.js data from Flask routes and rendering bar, line, and doughnut charts in Jinja2 templates."
---

# Lesson 55 · Flask Dashboard with Charts

> **Section:** 🖥️ Frontend Integrations &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

- [ ] Include Chart.js via CDN in a Flask template
- [ ] Serve chart data as JSON from a Flask route
- [ ] Build Chart.js configuration dicts in Python and pass them to Jinja2
- [ ] Render bar, line, and doughnut charts on the same page
- [ ] Use `fetch()` to load chart data asynchronously
- [ ] Style multiple chart types with consistent colour palettes

---

## 📖 Introduction

**Chart.js** is a lightweight JavaScript charting library that renders to an HTML `<canvas>` element. Flask is responsible for the data — it exposes `/api/chart-data` endpoints that return JSON. Jinja2 wires it all together at page load. The result is a fully dynamic dashboard with zero front-end framework overhead.

---

## 1. Chart.js Basics

=== "CDN include"
    ```html
    <!-- Add before </body> in your base.html -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
    ```

=== "Canvas element"
    ```html
    <div style="max-width: 600px;">
      <canvas id="salesChart"></canvas>
    </div>

    <script>
      const ctx = document.getElementById("salesChart").getContext("2d");
      new Chart(ctx, {
        type: "bar",
        data: {
          labels: ["Jan", "Feb", "Mar"],
          datasets: [{
            label: "Sales",
            data: [12000, 18500, 15200],
            backgroundColor: "rgba(59,130,212,0.7)",
          }]
        },
        options: { responsive: true }
      });
    </script>
    ```

=== "Chart types"
    | `type` | Use for |
    |--------|---------|
    | `bar` | Category comparisons |
    | `line` | Time series / trends |
    | `doughnut` | Part-to-whole (prettier than pie) |
    | `radar` | Multi-dimensional comparison |
    | `scatter` | Correlation between two variables |

---

## 2. Flask Routes Returning Chart JSON

=== "Data route"
    ```python
    from flask import Flask, jsonify, render_template
    import random

    app = Flask(__name__)

    @app.route("/api/sales")
    def sales_data():
        data = {
            "labels": ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
            "datasets": [{
                "label": "Revenue",
                "data": [random.randint(10_000, 30_000) for _ in range(6)],
                "borderColor": "#3b82d4",
                "backgroundColor": "rgba(59,130,212,0.2)",
                "fill": True,
            }]
        }
        return jsonify(data)

    @app.route("/dashboard")
    def dashboard():
        return render_template("dashboard.html")
    ```

=== "Inline data injection"
    ```python
    import json

    @app.route("/dashboard")
    def dashboard():
        chart_data = {
            "labels": ["Jan", "Feb", "Mar"],
            "values": [12000, 18500, 15200],
        }
        # Pass as JSON string so Jinja2 can inject it directly
        return render_template("dashboard.html",
                               chart_data=json.dumps(chart_data))
    ```

!!! tip "Async vs inline"
    Inline injection is simpler for a single chart. For dashboards with many charts, use async `/api/` routes so the page loads immediately and data fills in progressively.

---

## 3. Jinja2 Template with Chart.js

=== "dashboard.html"
    ```html+jinja
    {% extends "base.html" %}
    {% block title %}Dashboard{% endblock %}

    {% block content %}
    <h1>Sales Dashboard</h1>

    <div class="chart-grid">
      <div class="chart-card">
        <h2>Monthly Revenue</h2>
        <canvas id="revenueChart"></canvas>
      </div>
      <div class="chart-card">
        <h2>Category Split</h2>
        <canvas id="categoryChart"></canvas>
      </div>
    </div>

    <script>
    // Revenue line chart (async)
    fetch("/api/sales")
      .then(r => r.json())
      .then(data => {
        new Chart(document.getElementById("revenueChart"), {
          type: "line", data: data,
          options: { responsive: true }
        });
      });

    // Category doughnut (inline data from Jinja2)
    const catData = {{ chart_data | safe }};
    new Chart(document.getElementById("categoryChart"), {
      type: "doughnut",
      data: {
        labels: catData.labels,
        datasets: [{ data: catData.values,
                     backgroundColor: ["#3b82d4","#7c5cd8","#22c55e","#f59e0b"] }]
      }
    });
    </script>
    {% endblock %}
    ```

---

## 4. Building Config Dicts in Python

=== "Helper function"
    ```python
    PALETTE = ["#3b82d4", "#7c5cd8", "#22c55e", "#f59e0b", "#ef4444"]

    def bar_chart_config(labels: list, datasets: list) -> dict:
        """Build a Chart.js bar chart configuration dict."""
        return {
            "type": "bar",
            "data": {
                "labels": labels,
                "datasets": [
                    {
                        "label": ds["label"],
                        "data":  ds["data"],
                        "backgroundColor": PALETTE[i % len(PALETTE)],
                    }
                    for i, ds in enumerate(datasets)
                ],
            },
            "options": {
                "responsive": True,
                "plugins": {"legend": {"position": "top"}},
            },
        }
    ```

=== "Usage"
    ```python
    config = bar_chart_config(
        labels=["Q1", "Q2", "Q3", "Q4"],
        datasets=[
            {"label": "Sales",   "data": [120, 145, 132, 178]},
            {"label": "Returns", "data": [12,  18,  10,  22]},
        ]
    )
    # Pass as JSON to template
    return render_template("report.html", config=json.dumps(config))
    ```

---

## 5. Multiple Chart Types on One Page

=== "Layout"
    ```css
    /* static/css/style.css */
    .chart-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.5rem;
    }
    .chart-card {
      background: #f7f8fa;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 1rem;
    }
    ```

=== "Four charts example"
    ```python
    @app.route("/full-dashboard")
    def full_dashboard():
        charts = {
            "revenue": json.dumps(build_revenue_line()),
            "categories": json.dumps(build_category_doughnut()),
            "monthly": json.dumps(build_monthly_bar()),
            "trend": json.dumps(build_trend_radar()),
        }
        return render_template("full_dashboard.html", **charts)
    ```

| Chart | Best for | Avoid when |
|-------|----------|------------|
| Bar | Comparing groups | > 15 categories |
| Line | Time series | Unordered categories |
| Doughnut | Proportions | > 7 slices |
| Radar | Multi-metric comparison | Many axes |

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate building a Chart.js config dict in Python
PALETTE = ["#3b82d4", "#7c5cd8", "#22c55e", "#f59e0b"]

def build_chart_config(chart_type, labels, datasets):
    return {
        "type": chart_type,
        "data": {
            "labels": labels,
            "datasets": [
                {
                    "label": ds["label"],
                    "data": ds["data"],
                    "backgroundColor": PALETTE[i % len(PALETTE)],
                }
                for i, ds in enumerate(datasets)
            ],
        },
        "options": {"responsive": True},
    }

config = build_chart_config(
    chart_type="bar",
    labels=["Jan", "Feb", "Mar", "Apr"],
    datasets=[
        {"label": "Sales",   "data": [120, 145, 132, 178]},
        {"label": "Returns", "data": [12,  18,  10,  22]},
    ],
)

print("Chart type:", config["type"])
print("Labels:", config["data"]["labels"])
print("Datasets:", len(config["data"]["datasets"]))
for ds in config["data"]["datasets"]:
    print(f"  {ds['label']}: sum={sum(ds['data'])}, color={ds['backgroundColor']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Sum of Data

Build a chart config with labels `["Jan","Feb","Mar"]` and data `[100, 200, 150]`. Print the sum of the data values.

<div class="pyodide-runner" data-mode="challenge" data-expected="450">
<pre><code class="language-python">config = {
    "labels": ["Jan", "Feb", "Mar"],
    "datasets": [{"label": "Revenue", "data": [100, 200, 150]}],
}

# Compute and print the sum of all data values across datasets
total = 0  # your code here

print(total)
</code></pre>
</div>

---

### Challenge 2 — Dataset Count

Print the number of datasets in a mock chart config that has two datasets.

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">config = {
    "type": "bar",
    "data": {
        "labels": ["Q1", "Q2", "Q3"],
        "datasets": [
            {"label": "Sales",   "data": [100, 120, 90]},
            {"label": "Returns", "data": [10,  15,  8]},
        ],
    },
}

# Print the number of datasets
count = 0  # your code here

print(count)
</code></pre>
</div>

---

## 📚 Further Reading

- [Chart.js documentation](https://www.chartjs.org/docs/latest/)
- [Flask jsonify](https://flask.palletsprojects.com/en/3.0.x/api/#flask.json.jsonify)
- [Chart.js — Configuration](https://www.chartjs.org/docs/latest/configuration/)

---

!!! success "Lesson Complete 🎉"
    You can now build multi-chart Flask dashboards with clean data routes and Chart.js rendering. Next: level up with a React frontend backed by FastAPI!

[⬅️ Lesson 54 · Streamlit Dashboard](54-streamlit-dashboard.md){ .md-button } [➡️ Lesson 56 · FastAPI Dashboard with React](56-fastapi-react.md){ .md-button .md-button--primary }
