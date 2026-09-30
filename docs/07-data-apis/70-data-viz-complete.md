---
title: "Lesson 70 · Complete Data Visualization App"
description: "Build a full-stack data app: Flask API with multiple chart endpoints, Plotly frontend, API-driven filtering, PNG export, auto-refresh with JS setInterval, and deployment on Render."
---

# Lesson 70 · Complete Data Visualization App

> **Section:** 📊 Data APIs, CSV/JSON Exports & Visualization &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Architect a full-stack data app with a Flask API backend and Plotly/Chart.js frontend
- [ ] Serve multiple chart types (line, bar, pie) from one Flask app
- [ ] Accept API query parameters to filter chart data server-side
- [ ] Export any chart as a PNG via a `/chart/png` endpoint
- [ ] Auto-refresh chart data with `setInterval` in JavaScript
- [ ] Deploy the complete app to Render.com

---

## 📖 Introduction

This final lesson in Section 7 ties everything together into a **production-grade, full-stack data visualization app**. You will build a Flask backend that exposes:

- `/api/data` — filtered raw data as JSON
- `/api/chart/sales` — Chart.js-ready JSON
- `/api/chart/png` — Matplotlib chart as a downloadable PNG
- A Jinja2 HTML page that renders charts and auto-refreshes every 30 seconds

!!! info "Install dependencies"
    ```bash
    pip install flask pandas matplotlib plotly
    ```
    The browser runner uses only stdlib. Install the packages locally to run the complete app.

---

## 1. Project Architecture

=== "Directory structure"
    ```
    data-viz-app/
    ├── app.py                  ← Flask app + all routes
    ├── data/
    │   └── sales.csv           ← Source data
    ├── pipeline.py             ← Pure data transformation functions
    ├── templates/
    │   └── dashboard.html      ← Jinja2 template
    ├── static/
    │   └── dashboard.js        ← Frontend chart logic
    ├── requirements.txt
    └── render.yaml             ← Render deployment config
    ```
=== "Request flow"
    ```
    Browser → GET /dashboard
                ↓
            Jinja2 template (HTML + Chart.js)
                ↓
            fetch("/api/chart/sales?period=monthly")
                ↓
            Flask → pipeline.py → JSON response
                ↓
            Chart.js renders the chart
                ↓
            setInterval(fetch, 30000)  ← auto-refresh
    ```

---

## 2. The Flask Backend

=== "app.py"
    ```python
    from flask import Flask, jsonify, render_template, request, Response
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import io, json
    from pipeline import load_data, filter_data, build_chart_data

    app = Flask(__name__)

    @app.get("/")
    def dashboard():
        return render_template("dashboard.html")

    @app.get("/api/data")
    def api_data():
        period = request.args.get("period", "monthly")
        region = request.args.get("region")
        df     = load_data()
        df     = filter_data(df, period=period, region=region)
        return jsonify(df.to_dict(orient="records"))

    @app.get("/api/chart/sales")
    def api_chart_sales():
        period = request.args.get("period", "monthly")
        region = request.args.get("region")
        df     = load_data()
        df     = filter_data(df, period=period, region=region)
        return jsonify(build_chart_data(df))

    @app.get("/api/chart/png")
    def api_chart_png():
        period = request.args.get("period", "monthly")
        df     = load_data()
        df     = filter_data(df, period=period)

        labels = list(df["period"])
        values = list(df["revenue"])

        fig, ax = plt.subplots(figsize=(10, 5))
        ax.plot(labels, values, marker="o", linewidth=2, color="#3b82d4")
        ax.fill_between(range(len(labels)), values, alpha=0.15, color="#3b82d4")
        ax.set_title(f"Revenue — {period.title()}")
        ax.set_ylabel("Revenue ($)")
        plt.xticks(rotation=45)
        plt.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=120)
        plt.close(fig)
        buf.seek(0)

        return Response(
            buf.read(),
            mimetype="image/png",
            headers={"Content-Disposition": "attachment; filename=chart.png"},
        )
    ```
=== "pipeline.py"
    ```python
    import pandas as pd

    MOCK_DATA = [
        {"period": "Jan", "revenue": 420, "region": "North"},
        {"period": "Feb", "revenue": 380, "region": "North"},
        {"period": "Mar", "revenue": 510, "region": "South"},
        {"period": "Apr", "revenue": 465, "region": "North"},
        {"period": "May", "revenue": 530, "region": "South"},
        {"period": "Jun", "revenue": 490, "region": "East"},
    ]

    def load_data() -> pd.DataFrame:
        return pd.DataFrame(MOCK_DATA)

    def filter_data(df: pd.DataFrame, period=None, region=None) -> pd.DataFrame:
        if region:
            df = df[df["region"] == region]
        return df

    def build_chart_data(df: pd.DataFrame) -> dict:
        return {
            "type": "line",
            "data": {
                "labels": list(df["period"]),
                "datasets": [{
                    "label": "Revenue ($)",
                    "data":  list(df["revenue"]),
                    "borderColor": "#3b82d4",
                    "backgroundColor": "rgba(59,130,212,0.1)",
                    "tension": 0.3,
                    "fill": True,
                }]
            },
            "options": {
                "responsive": True,
                "plugins": {"title": {"display": True, "text": "Monthly Revenue"}},
            }
        }
    ```

---

## 3. The Jinja2 Dashboard Template

=== "templates/dashboard.html"
    ```html
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Sales Dashboard</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body { font-family: sans-serif; max-width: 960px; margin: 2rem auto; }
        .controls { display: flex; gap: 1rem; margin-bottom: 1rem; }
        .card { background: #f7f8fa; border: 1px solid #e5e7eb;
                border-radius: 8px; padding: 1rem; }
      </style>
    </head>
    <body>
      <h1>📊 Sales Dashboard</h1>

      <div class="controls">
        <select id="region-filter">
          <option value="">All Regions</option>
          <option value="North">North</option>
          <option value="South">South</option>
          <option value="East">East</option>
        </select>
        <a id="export-png" href="/api/chart/png">⬇ Export PNG</a>
        <span id="last-updated" style="color:#57606a;font-size:13px"></span>
      </div>

      <div class="card">
        <canvas id="salesChart"></canvas>
      </div>

      <script src="/static/dashboard.js"></script>
    </body>
    </html>
    ```
=== "static/dashboard.js"
    ```javascript
    let chart = null;

    function buildQueryString() {
      const region = document.getElementById("region-filter").value;
      return region ? `?region=${encodeURIComponent(region)}` : "";
    }

    function updateExportLink(qs) {
      document.getElementById("export-png").href = `/api/chart/png${qs}`;
    }

    async function refreshChart() {
      const qs  = buildQueryString();
      const res = await fetch(`/api/chart/sales${qs}`);
      const cfg = await res.json();

      if (chart) {
        chart.data    = cfg.data;
        chart.options = cfg.options;
        chart.update();
      } else {
        chart = new Chart(document.getElementById("salesChart"), cfg);
      }

      document.getElementById("last-updated").textContent =
        `Last updated: ${new Date().toLocaleTimeString()}`;
      updateExportLink(qs);
    }

    // Initial load + auto-refresh every 30 s
    refreshChart();
    setInterval(refreshChart, 30_000);
    document.getElementById("region-filter").addEventListener("change", refreshChart);
    ```

---

## 4. API Query Parameters for Filtering

| Parameter | Type | Default | Example |
|---|---|---|---|
| `period` | string | `"monthly"` | `?period=weekly` |
| `region` | string | (all) | `?region=North` |
| `start` | ISO date | (all) | `?start=2024-01-01` |
| `end` | ISO date | (all) | `?end=2024-06-30` |

=== "Flask — date range filter"
    ```python
    from datetime import datetime

    @app.get("/api/chart/sales")
    def api_chart_sales():
        start  = request.args.get("start")
        end    = request.args.get("end")
        region = request.args.get("region")

        df = load_data()

        if region:
            df = df[df["region"] == region]
        if start:
            df = df[df["date"] >= datetime.fromisoformat(start)]
        if end:
            df = df[df["date"] <= datetime.fromisoformat(end)]

        return jsonify(build_chart_data(df))
    ```

---

## 5. Deployment on Render

=== "render.yaml"
    ```yaml
    services:
      - type: web
        name: data-viz-app
        env: python
        buildCommand: pip install -r requirements.txt
        startCommand: gunicorn app:app --bind 0.0.0.0:$PORT
        envVars:
          - key: FLASK_ENV
            value: production
    ```
=== "requirements.txt"
    ```
    flask>=3.0
    pandas>=2.0
    matplotlib>=3.8
    plotly>=5.0
    gunicorn>=21.0
    ```
=== "Dockerfile (alternative)"
    ```dockerfile
    FROM python:3.11-slim
    WORKDIR /app
    COPY requirements.txt .
    RUN pip install --no-cache-dir -r requirements.txt
    COPY . .
    EXPOSE 8000
    ENV FLASK_ENV=production
    CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:8000", "--workers", "2"]
    ```

!!! warning "Set `matplotlib.use('Agg')` before any other matplotlib import"
    On Render.com there is no display server. If you forget to set the Agg backend the app will crash on the first `/chart/png` request with `_tkinter.TclError: no display name`.

---

## 💻 Try It Yourself

Simulate the complete data pipeline — load, filter, aggregate, format for chart, print chart title.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">sales_data = [
    {"period": "Jan", "revenue": 420, "region": "North"},
    {"period": "Feb", "revenue": 380, "region": "South"},
    {"period": "Mar", "revenue": 510, "region": "North"},
    {"period": "Apr", "revenue": 465, "region": "East"},
    {"period": "May", "revenue": 530, "region": "North"},
    {"period": "Jun", "revenue": 490, "region": "South"},
]

# Step 1: filter (North region only)
filtered = [r for r in sales_data if r["region"] == "North"]

# Step 2: aggregate (total revenue per period)
labels  = [r["period"] for r in filtered]
values  = [r["revenue"] for r in filtered]

# Step 3: build chart config
chart = {
    "type": "line",
    "data": {
        "labels":   labels,
        "datasets": [{"label": "Revenue — North", "data": values}],
    },
    "options": {"plugins": {"title": {"display": True, "text": "North Region Revenue"}}}
}

title = chart["options"]["plugins"]["title"]["text"]
total = sum(chart["data"]["datasets"][0]["data"])
print(f"Chart title : {title}")
print(f"Periods     : {labels}")
print(f"Total revenue: ${total:,}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Trend Direction

Given monthly revenue data, determine whether the overall trend is `"upward"` or `"downward"` (compare last value to first) and print it.

<div class="pyodide-runner" data-mode="challenge" data-expected="upward">
<pre><code class="language-python">monthly = [
    {"month": "Jan", "revenue": 300},
    {"month": "Feb", "revenue": 350},
    {"month": "Mar", "revenue": 410},
]

# Compare first and last revenue values, print "upward" or "downward"
</code></pre>
</div>

### Challenge 2 — Chart Labels

Build the Chart.js labels and datasets list from monthly sales data and print the labels list.

<div class="pyodide-runner" data-mode="challenge" data-expected="['Jan', 'Feb', 'Mar']">
<pre><code class="language-python">monthly = [
    {"month": "Jan", "revenue": 420},
    {"month": "Feb", "revenue": 380},
    {"month": "Mar", "revenue": 510},
]

# Build a list of month names (labels) and print it
</code></pre>
</div>

---

## 📚 Further Reading

- [Render.com — Deploying Python Web Services](https://render.com/docs/web-services)
- [Chart.js — Chart Update (live data)](https://www.chartjs.org/docs/latest/developers/updates.html)
- [Flask — Application Factory Pattern](https://flask.palletsprojects.com/en/latest/patterns/appfactories/)

---

!!! success "Section 7 Complete! 🎉"
    You have completed the entire **Data APIs, CSV/JSON Exports & Visualization** section. You can now:

    - Analyse data with Pandas and expose results through REST endpoints
    - Export CSV and JSON from any endpoint with correct headers
    - Render Chart.js, Matplotlib, and Plotly Dash charts from Python
    - Upload, validate, and search CSV datasets via APIs
    - Generate structured JSON reports with caching
    - Build and deploy a full-stack data visualization app

[⬅️ Lesson 69 · Pandas to REST Pipeline](69-pandas-rest-pipeline.md){ .md-button } [➡️ Section 8 · Cloud & Infrastructure](../08-cloud/index.md){ .md-button .md-button--primary }
