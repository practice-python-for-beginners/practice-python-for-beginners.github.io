---
title: "Lesson 63 · REST API Data Visualization"
description: "Build Chart.js-ready JSON from Flask/FastAPI, format time series data, configure stacked charts, embed charts in Jinja2 templates, and serve multiple datasets from a single endpoint."
---

# Lesson 63 · REST API Data Visualization

> **Section:** 📊 Data APIs, CSV/JSON Exports & Visualization &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Describe the Chart.js configuration object structure
- [ ] Return chart-ready JSON from a Flask or FastAPI endpoint
- [ ] Format time series data as ISO date strings in labels
- [ ] Configure stacked bar charts with multiple datasets
- [ ] Embed a Chart.js chart into a Jinja2 HTML template
- [ ] Serve multiple chart datasets from a single `/chart-data` endpoint

---

## 📖 Introduction

Frontend chart libraries (Chart.js, ApexCharts, ECharts) all expect data in a specific JSON structure. Rather than generating HTML on the server, the modern approach is a **clean API separation**: the Python backend exposes a `/chart-data` endpoint that returns the labels and datasets, and the JavaScript frontend renders the chart.

This keeps your backend logic testable, your chart independently updatable, and your API reusable by multiple clients (web, mobile, reports).

!!! info "Chart.js quick install"
    ```html
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    ```
    No pip install needed — Chart.js runs in the browser.

---

## 1. Chart.js Config Structure

Every Chart.js chart is configured with a single JavaScript object:

=== "Minimal bar chart config"
    ```javascript
    const config = {
      type: "bar",          // "line" | "bar" | "pie" | "doughnut" | "radar"
      data: {
        labels: ["Jan", "Feb", "Mar", "Apr"],
        datasets: [{
          label: "Monthly Sales",
          data: [420, 380, 510, 465],
          backgroundColor: "rgba(59, 130, 212, 0.6)",
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: "2024 Sales Overview" }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    };
    ```
=== "Python dict equivalent"
    ```python
    chart_config = {
        "type": "bar",
        "data": {
            "labels": ["Jan", "Feb", "Mar", "Apr"],
            "datasets": [{
                "label": "Monthly Sales",
                "data": [420, 380, 510, 465],
                "backgroundColor": "rgba(59,130,212,0.6)",
            }]
        },
        "options": {
            "responsive": True,
            "plugins": {
                "title": {"display": True, "text": "2024 Sales Overview"}
            },
        }
    }
    ```

| Key | Purpose |
|---|---|
| `type` | Chart type (`bar`, `line`, `pie`, …) |
| `data.labels` | X-axis categories or time points |
| `data.datasets[].data` | Array of numeric values |
| `data.datasets[].label` | Legend label for this series |
| `options` | Responsive, scales, plugins config |

---

## 2. Returning Chart-Ready JSON from Flask

=== "Flask endpoint"
    ```python
    from flask import Flask, jsonify

    app = Flask(__name__)

    MONTHLY_SALES = {
        "Jan": 420, "Feb": 380, "Mar": 510,
        "Apr": 465, "May": 530, "Jun": 490,
    }

    @app.get("/chart-data/sales")
    def chart_data_sales():
        labels = list(MONTHLY_SALES.keys())
        values = list(MONTHLY_SALES.values())

        return jsonify({
            "type": "bar",
            "data": {
                "labels": labels,
                "datasets": [{
                    "label": "Monthly Sales ($)",
                    "data": values,
                    "backgroundColor": "rgba(59,130,212,0.6)",
                    "borderColor": "rgba(59,130,212,1)",
                    "borderWidth": 1,
                }]
            }
        })
    ```
=== "FastAPI endpoint"
    ```python
    from fastapi import FastAPI

    app = FastAPI()

    MONTHLY_SALES = {
        "Jan": 420, "Feb": 380, "Mar": 510,
        "Apr": 465, "May": 530, "Jun": 490,
    }

    @app.get("/chart-data/sales")
    def chart_data_sales():
        labels = list(MONTHLY_SALES.keys())
        values = list(MONTHLY_SALES.values())

        return {
            "type": "bar",
            "data": {
                "labels": labels,
                "datasets": [{
                    "label": "Monthly Sales ($)",
                    "data": values,
                }]
            }
        }
    ```

---

## 3. Time Series Data Formatting

Chart.js works best with ISO date strings when using the `time` scale adapter.

=== "Python — generate time series"
    ```python
    from flask import Flask, jsonify
    from datetime import date, timedelta

    app = Flask(__name__)

    def daily_sales_data(start: date, days: int):
        """Generate fake daily sales data."""
        import random
        random.seed(42)
        return [
            {"x": (start + timedelta(days=i)).isoformat(),
             "y": random.randint(200, 600)}
            for i in range(days)
        ]

    @app.get("/chart-data/time-series")
    def time_series():
        data = daily_sales_data(date(2024, 1, 1), 30)
        return jsonify({
            "type": "line",
            "data": {
                "datasets": [{
                    "label": "Daily Sales",
                    "data": data,       # [{x: "2024-01-01", y: 342}, ...]
                }]
            },
            "options": {
                "scales": {
                    "x": {"type": "time", "time": {"unit": "day"}}
                }
            }
        })
    ```
=== "Output format"
    ```json
    {
      "type": "line",
      "data": {
        "datasets": [{
          "label": "Daily Sales",
          "data": [
            {"x": "2024-01-01", "y": 342},
            {"x": "2024-01-02", "y": 518},
            {"x": "2024-01-03", "y": 267}
          ]
        }]
      }
    }
    ```

---

## 4. Stacked Charts & Multiple Datasets

=== "Stacked bar chart"
    ```python
    from flask import Flask, jsonify

    app = Flask(__name__)

    @app.get("/chart-data/stacked")
    def stacked():
        labels = ["Q1", "Q2", "Q3", "Q4"]
        return jsonify({
            "type": "bar",
            "data": {
                "labels": labels,
                "datasets": [
                    {"label": "Product A", "data": [120, 150, 180, 200],
                     "backgroundColor": "rgba(59,130,212,0.7)"},
                    {"label": "Product B", "data": [90,  110, 130, 160],
                     "backgroundColor": "rgba(124,92,216,0.7)"},
                    {"label": "Product C", "data": [60,  80,  100, 120],
                     "backgroundColor": "rgba(34,197,94,0.7)"},
                ]
            },
            "options": {
                "scales": {
                    "x": {"stacked": True},
                    "y": {"stacked": True}
                }
            }
        })
    ```

---

## 5. Embedding Charts in Jinja2 Templates

=== "Flask + Jinja2 template"
    ```python
    # app.py
    from flask import Flask, render_template, jsonify
    app = Flask(__name__)

    @app.get("/dashboard")
    def dashboard():
        return render_template("dashboard.html")

    @app.get("/api/chart-data")
    def api_chart_data():
        return jsonify({"labels": ["Jan","Feb","Mar"],
                        "values": [420, 380, 510]})
    ```
=== "templates/dashboard.html"
    ```html
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sales Dashboard</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    </head>
    <body>
      <canvas id="salesChart" width="800" height="400"></canvas>

      <script>
        fetch("/api/chart-data")
          .then(r => r.json())
          .then(d => {
            new Chart(document.getElementById("salesChart"), {
              type: "bar",
              data: {
                labels: d.labels,
                datasets: [{ label: "Sales", data: d.values }]
              }
            });
          });
      </script>
    </body>
    </html>
    ```

!!! tip "Pass initial data to avoid an extra request"
    Use `{{ chart_data | tojson }}` in the template to embed data directly in the HTML for the first render, then refresh via `fetch` for subsequent updates.

---

## 💻 Try It Yourself

Build a chart data dictionary from a list of monthly sales tuples and print the January value.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">monthly_sales = [
    ("Jan", 420), ("Feb", 380), ("Mar", 510),
    ("Apr", 465), ("May", 530), ("Jun", 490),
]

labels  = [m[0] for m in monthly_sales]
values  = [m[1] for m in monthly_sales]

chart_data = {
    "type": "bar",
    "data": {
        "labels": labels,
        "datasets": [{"label": "Monthly Sales", "data": values}]
    }
}

jan_index = chart_data["data"]["labels"].index("Jan")
jan_value = chart_data["data"]["datasets"][0]["data"][jan_index]
print(f"January sales: {jan_value}")
print(f"Labels: {chart_data['data']['labels']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Peak Month

Find the month name with the highest sales value in the dict and print it.

<div class="pyodide-runner" data-mode="challenge" data-expected="March">
<pre><code class="language-python">sales = {
    "January": 420,
    "February": 380,
    "March": 610,
    "April": 465,
    "May": 530,
}

# Print the name of the month with the highest sales
</code></pre>
</div>

### Challenge 2 — Total Sales

Compute and print the total sales across all months.

<div class="pyodide-runner" data-mode="challenge" data-expected="1550">
<pre><code class="language-python">sales = {
    "Jan": 420,
    "Feb": 380,
    "Mar": 310,
    "Apr": 440,
}

# Print the total of all monthly sales values
</code></pre>
</div>

---

## 📚 Further Reading

- [Chart.js — Getting Started](https://www.chartjs.org/docs/latest/getting-started/)
- [Chart.js — Time Scale](https://www.chartjs.org/docs/latest/axes/cartesian/time.html)
- [Flask — Rendering Templates](https://flask.palletsprojects.com/en/latest/quickstart/#rendering-templates)

---

!!! success "Lesson Complete 🎉"
    You can now build Chart.js-ready JSON from a Python backend, format time series data, configure stacked charts, and embed live charts in Jinja2 templates with a single `fetch` call.

[⬅️ Lesson 62 · Exporting CSV & JSON](62-exporting-csv-json.md){ .md-button } [➡️ Lesson 64 · Matplotlib in APIs](64-matplotlib-in-apis.md){ .md-button .md-button--primary }
