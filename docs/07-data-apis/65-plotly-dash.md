---
title: "Lesson 65 · Plotly Dash Dashboard API"
description: "Build interactive Python dashboards with Plotly Dash: app layout, dcc.Graph, callbacks, Input/Output, multi-page apps, and deployment strategies."
---

# Lesson 65 · Plotly Dash Dashboard API

> **Section:** 📊 Data APIs, CSV/JSON Exports & Visualization &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain what Plotly Dash is and how it differs from Flask
- [ ] Build a Dash app layout with `html.Div` and `dcc.Graph`
- [ ] Write a reactive callback using `@app.callback`, `Input`, and `Output`
- [ ] Update a chart when a dropdown or slider changes
- [ ] Structure a multi-page Dash app
- [ ] Deploy a Dash app to a cloud platform

---

## 📖 Introduction

**Plotly Dash** is a Python framework for building interactive, browser-based data dashboards — without writing JavaScript. A Dash app is a web server (built on Flask) that renders a React.js frontend automatically from your Python layout code.

The magic of Dash is its **reactive callback system**: Python functions are automatically called whenever a user interacts with a widget, and the output is pushed back to the browser. This makes it ideal for data exploration dashboards, BI tools, and monitoring apps.

!!! info "Install Dash"
    ```bash
    pip install dash plotly pandas
    ```
    The browser runner uses pure stdlib to simulate callback logic. Install Dash locally to build real dashboards.

---

## 1. Dash App Structure Overview

=== "Minimal Dash app"
    ```python
    from dash import Dash, html, dcc
    import plotly.express as px
    import pandas as pd

    app = Dash(__name__)

    # --- Layout ---
    app.layout = html.Div([
        html.H1("Sales Dashboard"),
        dcc.Graph(id="sales-chart"),
    ])

    # --- Callback ---
    @app.callback(
        Output("sales-chart", "figure"),   # what to update
        Input("year-dropdown", "value"),   # what triggers the update
    )
    def update_chart(selected_year):
        # Filter data and return a Plotly figure
        df = pd.DataFrame({"month": ["Jan","Feb","Mar"], "sales": [400,350,510]})
        return px.bar(df, x="month", y="sales", title=f"Sales {selected_year}")

    if __name__ == "__main__":
        app.run(debug=True)
    ```
=== "Component tree"
    ```
    html.Div (root)
    ├── html.H1  "Sales Dashboard"
    ├── dcc.Dropdown  id="year-dropdown"  ← Input
    └── dcc.Graph    id="sales-chart"     ← Output
    ```

| Component | Module | Purpose |
|---|---|---|
| `html.Div`, `html.H1`, `html.P` | `dash.html` | Standard HTML elements |
| `dcc.Graph` | `dash.dcc` | Renders a Plotly figure |
| `dcc.Dropdown` | `dash.dcc` | Selection widget |
| `dcc.Slider` | `dash.dcc` | Numeric slider |
| `dcc.DatePickerRange` | `dash.dcc` | Date range picker |

---

## 2. Layout with `html.Div` and `dcc.Graph`

=== "Python"
    ```python
    from dash import Dash, html, dcc
    import plotly.graph_objects as go

    app = Dash(__name__)

    # Initial figure
    fig = go.Figure(go.Bar(
        x=["Alice", "Bob", "Carol"],
        y=[72000, 85000, 90000],
        marker_color=["#3b82d4", "#7c5cd8", "#22c55e"],
    ))
    fig.update_layout(title="Employee Salaries", yaxis_title="Salary ($)")

    app.layout = html.Div(
        style={"fontFamily": "sans-serif", "maxWidth": "900px", "margin": "auto"},
        children=[
            html.H1("HR Dashboard", style={"textAlign": "center"}),
            html.P("Select filters to explore the data."),
            dcc.Dropdown(
                id="dept-filter",
                options=[
                    {"label": "All",         "value": "all"},
                    {"label": "Engineering", "value": "Eng"},
                    {"label": "HR",          "value": "HR"},
                ],
                value="all",
                clearable=False,
            ),
            dcc.Graph(id="salary-chart", figure=fig),
        ],
    )
    ```

!!! tip "Inline styles vs CSS classes"
    For simple dashboards use `style={}` dicts. For larger apps, place CSS in `assets/style.css` — Dash loads all files in the `assets/` folder automatically.

---

## 3. Callbacks — `@app.callback`

A callback maps one or more **Input** component properties to one or more **Output** component properties.

=== "Single input, single output"
    ```python
    from dash import Dash, html, dcc, Input, Output
    import plotly.express as px
    import pandas as pd

    EMPLOYEES = pd.DataFrame({
        "name": ["Alice","Bob","Carol","Dave","Eve"],
        "dept": ["Eng","HR","Eng","Sales","HR"],
        "salary": [60000, 72000, 90000, 55000, 68000],
        "year": [2022, 2022, 2023, 2023, 2023],
    })

    app = Dash(__name__)

    app.layout = html.Div([
        dcc.Dropdown(
            id="year-dd",
            options=[{"label": y, "value": y} for y in [2022, 2023]],
            value=2023,
        ),
        dcc.Graph(id="bar"),
    ])

    @app.callback(Output("bar", "figure"), Input("year-dd", "value"))
    def update_bar(year):
        filtered = EMPLOYEES[EMPLOYEES["year"] == year]
        return px.bar(filtered, x="name", y="salary", color="dept",
                      title=f"Salaries — {year}")
    ```
=== "Multiple inputs"
    ```python
    @app.callback(
        Output("chart", "figure"),
        Input("year-dd", "value"),
        Input("dept-dd", "value"),
    )
    def update_chart(year, dept):
        df = EMPLOYEES.copy()
        if year:
            df = df[df["year"] == year]
        if dept and dept != "all":
            df = df[df["dept"] == dept]
        return px.bar(df, x="name", y="salary", title="Filtered Results")
    ```

---

## 4. Multi-Page Dash Apps

=== "Project structure"
    ```
    app/
    ├── app.py          ← Dash app instance (shared)
    ├── pages/
    │   ├── home.py
    │   ├── sales.py
    │   └── hr.py
    └── assets/
        └── style.css
    ```
=== "Using dash.page_registry (Dash ≥ 2.5)"
    ```python
    # app.py
    from dash import Dash, html, dcc, page_container
    app = Dash(__name__, use_pages=True)

    app.layout = html.Div([
        html.Nav([
            dcc.Link("Home",  href="/"),
            dcc.Link("Sales", href="/sales"),
            dcc.Link("HR",    href="/hr"),
        ]),
        page_container,   # renders the current page
    ])

    if __name__ == "__main__":
        app.run(debug=True)

    # pages/sales.py
    from dash import register_page, html, dcc
    import plotly.express as px

    register_page(__name__, path="/sales", name="Sales")

    layout = html.Div([
        html.H2("Sales Overview"),
        dcc.Graph(figure=px.line(x=[1,2,3], y=[100,200,150])),
    ])
    ```

---

## 5. Deploying Dash

=== "Gunicorn (production)"
    ```bash
    # Install Gunicorn
    pip install gunicorn

    # Run (expose the `server` attribute)
    gunicorn app:server --bind 0.0.0.0:8050 --workers 4
    ```
    ```python
    # In app.py expose the underlying Flask server:
    app = Dash(__name__)
    server = app.server   # ← this is what Gunicorn binds to
    ```
=== "Render.com"
    ```yaml
    # render.yaml
    services:
      - type: web
        name: my-dash-app
        env: python
        buildCommand: pip install -r requirements.txt
        startCommand: gunicorn app:server
        envVars:
          - key: PYTHON_VERSION
            value: 3.11.0
    ```
=== "Dockerfile"
    ```dockerfile
    FROM python:3.11-slim
    WORKDIR /app
    COPY requirements.txt .
    RUN pip install -r requirements.txt
    COPY . .
    EXPOSE 8050
    CMD ["gunicorn", "app:server", "--bind", "0.0.0.0:8050"]
    ```

!!! warning "Dash callbacks are not thread-safe by default"
    Use `prevent_initial_call=True` on callbacks that shouldn't fire on page load. For shared mutable state between callbacks, use a server-side cache (Redis) rather than global Python variables.

---

## 💻 Try It Yourself

Simulate Dash callback logic in pure Python — given a year filter, count matching records.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">records = [
    {"name": "Alice", "year": 2022, "value": 80},
    {"name": "Bob",   "year": 2023, "value": 90},
    {"name": "Carol", "year": 2023, "value": 85},
    {"name": "Dave",  "year": 2023, "value": 80},
    {"name": "Eve",   "year": 2022, "value": 75},
]

def callback_filter(year):
    """Simulate a Dash callback: filter data by year."""
    filtered = [r for r in records if r["year"] == year]
    count = len(filtered)
    avg   = sum(r["value"] for r in filtered) / count if filtered else 0
    return {"count": count, "avg_value": round(avg, 1)}

result_2023 = callback_filter(2023)
result_2022 = callback_filter(2022)

print(f"2023: count={result_2023['count']}, avg={result_2023['avg_value']}")
print(f"2022: count={result_2022['count']}, avg={result_2022['avg_value']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Callback Record Count

Simulate a Dash callback: filter the records list by `year == 2023` and print the count of matching records.

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">records = [
    {"name": "Alice", "year": 2022, "value": 80},
    {"name": "Bob",   "year": 2023, "value": 90},
    {"name": "Carol", "year": 2023, "value": 85},
    {"name": "Dave",  "year": 2023, "value": 80},
    {"name": "Eve",   "year": 2022, "value": 75},
]

# Filter for year == 2023 and print the count of matching records
</code></pre>
</div>

### Challenge 2 — Callback Average

Using the same records filtered for `year == 2023`, compute and print the average value.

<div class="pyodide-runner" data-mode="challenge" data-expected="85.0">
<pre><code class="language-python">records = [
    {"name": "Alice", "year": 2022, "value": 80},
    {"name": "Bob",   "year": 2023, "value": 90},
    {"name": "Carol", "year": 2023, "value": 85},
    {"name": "Dave",  "year": 2023, "value": 80},
    {"name": "Eve",   "year": 2022, "value": 75},
]

# Filter for year == 2023, compute mean value, print as float (e.g. 85.0)
</code></pre>
</div>

---

## 📚 Further Reading

- [Plotly Dash — Official Documentation](https://dash.plotly.com/)
- [Dash — Basic Callbacks Tutorial](https://dash.plotly.com/basic-callbacks)
- [Deploying Dash — Render & Heroku](https://dash.plotly.com/deployment)

---

!!! success "Lesson Complete 🎉"
    You now know how to build a reactive Dash dashboard, wire up callbacks to update charts from user inputs, structure multi-page apps, and deploy to production with Gunicorn.

[⬅️ Lesson 64 · Matplotlib in APIs](64-matplotlib-in-apis.md){ .md-button } [➡️ Lesson 66 · CSV Uploader API](66-csv-uploader-api.md){ .md-button .md-button--primary }
