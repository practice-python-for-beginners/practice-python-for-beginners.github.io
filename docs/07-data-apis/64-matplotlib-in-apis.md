---
title: "Lesson 64 · Integrating Matplotlib in APIs"
description: "Render Matplotlib charts to PNG in-memory using BytesIO, return them as Flask responses with image/png content type, style with plt.style, and compare saving to file vs streaming."
---

# Lesson 64 · Integrating Matplotlib in APIs

> **Section:** 📊 Data APIs, CSV/JSON Exports & Visualization &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Render a Matplotlib chart to an in-memory PNG using `BytesIO`
- [ ] Return the PNG as a Flask `Response` with the correct `image/png` content type
- [ ] Create bar, line, and pie charts with Matplotlib
- [ ] Apply a consistent style with `plt.style.use()`
- [ ] Explain the difference between saving to a file and streaming to a response
- [ ] Avoid common pitfalls (thread safety, figure leaks)

---

## 📖 Introduction

Matplotlib is the go-to library for scientific and statistical plotting in Python. In an API context, you don't write a PNG to disk — you render it into an in-memory bytes buffer, then stream those bytes directly as the HTTP response.

The client (browser, frontend app, or report generator) receives a standard image that can be displayed in an `<img>` tag or embedded in a PDF.

!!! info "Install Matplotlib"
    ```bash
    pip install matplotlib
    ```
    The browser runner below uses only stdlib arithmetic so it works without Matplotlib. Install it locally to follow all examples.

---

## 1. Rendering to BytesIO

The key pattern is: **create figure → draw → save to BytesIO → seek(0) → return**.

=== "Python"
    ```python
    import matplotlib
    matplotlib.use("Agg")       # Non-interactive backend — required for servers
    import matplotlib.pyplot as plt
    import io

    def make_bar_chart(labels, values, title="Chart"):
        fig, ax = plt.subplots(figsize=(8, 4))
        ax.bar(labels, values, color="#3b82d4")
        ax.set_title(title)
        ax.set_ylabel("Value")
        ax.grid(axis="y", linestyle="--", alpha=0.5)

        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", dpi=100)
        plt.close(fig)           # ← ALWAYS close to free memory
        buf.seek(0)
        return buf

    # Usage
    img_buf = make_bar_chart(
        labels=["Alice", "Bob", "Carol"],
        values=[72000, 85000, 90000],
        title="Salaries"
    )
    # img_buf.read() → raw PNG bytes
    ```
=== "Why Agg backend?"
    ```
    matplotlib.use("Agg") switches to the
    Anti-Grain Geometry (Agg) renderer.

    ✅ No display required — works on servers
    ✅ Thread-safe for multi-request environments
    ✅ Produces identical output on all platforms
    ❌ Cannot show interactive windows (plt.show() is a no-op)

    Always set this BEFORE importing pyplot.
    ```

!!! warning "Always call `plt.close(fig)`"
    Matplotlib keeps an internal registry of open figures. Forgetting `plt.close()` in a server context leaks memory on every request. Pass the specific `fig` object to close only that figure.

---

## 2. Flask Endpoint Returning PNG

=== "Flask"
    ```python
    from flask import Flask, Response
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import io

    app = Flask(__name__)

    DATA = {"Alice": 72000, "Bob": 85000, "Carol": 90000, "Dave": 55000}

    @app.get("/chart/bar")
    def bar_chart():
        fig, ax = plt.subplots(figsize=(7, 4))
        ax.bar(list(DATA.keys()), list(DATA.values()), color="#3b82d4")
        ax.set_title("Employee Salaries")
        ax.set_ylabel("Salary ($)")

        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight", dpi=100)
        plt.close(fig)
        buf.seek(0)

        return Response(buf.read(), mimetype="image/png")
    ```
=== "HTML usage"
    ```html
    <!-- Embed the chart directly in an img tag -->
    <img src="/chart/bar" alt="Bar Chart" width="700">

    <!-- Or as a Base64 data URI (useful for embedding in JSON) -->
    <script>
      fetch("/chart/bar")
        .then(r => r.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          document.getElementById("chart").src = url;
        });
    </script>
    ```

---

## 3. Bar, Line, and Pie Chart Examples

=== "Bar chart"
    ```python
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import io

    def bar_chart(categories, values):
        fig, ax = plt.subplots()
        bars = ax.bar(categories, values, color=["#3b82d4","#7c5cd8","#22c55e","#f59e0b"])
        ax.bar_label(bars, fmt="%.0f")      # value labels on top
        ax.set_ylim(0, max(values) * 1.2)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return buf
    ```
=== "Line chart"
    ```python
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import io

    def line_chart(x, y, xlabel="Month", ylabel="Sales"):
        fig, ax = plt.subplots(figsize=(9, 4))
        ax.plot(x, y, marker="o", linewidth=2, color="#3b82d4")
        ax.fill_between(x, y, alpha=0.15, color="#3b82d4")
        ax.set_xlabel(xlabel)
        ax.set_ylabel(ylabel)
        ax.grid(True, linestyle="--", alpha=0.4)
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return buf
    ```
=== "Pie chart"
    ```python
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import io

    def pie_chart(labels, sizes):
        fig, ax = plt.subplots(figsize=(6, 6))
        ax.pie(sizes, labels=labels, autopct="%1.1f%%",
               colors=["#3b82d4","#7c5cd8","#22c55e"])
        ax.set_title("Market Share")
        buf = io.BytesIO()
        fig.savefig(buf, format="png", bbox_inches="tight")
        plt.close(fig)
        buf.seek(0)
        return buf
    ```

---

## 4. Styling with `plt.style`

=== "Python"
    ```python
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # List all available styles
    print(plt.style.available)

    # Apply a style globally (before creating figures)
    plt.style.use("seaborn-v0_8-whitegrid")

    # Or use as a context manager for one chart only
    with plt.style.context("dark_background"):
        fig, ax = plt.subplots()
        ax.plot([1, 2, 3], [4, 2, 5])
        fig.savefig("dark_chart.png")
        plt.close(fig)
    ```
=== "Popular styles"
    | Style | Character |
    |---|---|
    | `seaborn-v0_8-whitegrid` | Clean white background, grid lines |
    | `seaborn-v0_8-darkgrid` | Dark grey background, grid lines |
    | `ggplot` | R-style with coloured background |
    | `dark_background` | Pure dark theme |
    | `bmh` | Bayesian methods for hackers |

---

## 5. File Save vs Stream Comparison

| Approach | Use case | Pros | Cons |
|---|---|---|---|
| `fig.savefig("chart.png")` | Batch reports, scheduled exports | Simple code | Disk I/O, file management |
| `fig.savefig(BytesIO)` + HTTP response | API endpoint | No disk, instant | Lives in RAM |
| Base64-encode BytesIO → JSON | Embed in JSON response | Single API call | Larger payload (~33% overhead) |

=== "Base64 in JSON"
    ```python
    import base64, io, matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from flask import Flask, jsonify

    app = Flask(__name__)

    @app.get("/chart/base64")
    def chart_base64():
        fig, ax = plt.subplots()
        ax.plot([1, 2, 3], [4, 2, 5])
        buf = io.BytesIO()
        fig.savefig(buf, format="png")
        plt.close(fig)
        buf.seek(0)
        encoded = base64.b64encode(buf.read()).decode("utf-8")
        return jsonify({"image": f"data:image/png;base64,{encoded}"})
    ```

---

## 💻 Try It Yourself

Simulate chart data preparation: compute normalized values for a pie chart (percentages that sum to 100).

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">categories = {"Python": 50, "JavaScript": 30, "Java": 20}

total = sum(categories.values())
normalized = {k: round(v / total * 100, 1) for k, v in categories.items()}

print("Pie chart data (normalized):")
for label, pct in normalized.items():
    bar = "█" * int(pct // 5)
    print(f"  {label:15s} {pct:5.1f}%  {bar}")

print(f"\nTotal: {sum(normalized.values())}%")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Category Percentage

Given category counts, compute and print the percentage for "Python" (e.g. `50.0%`).

<div class="pyodide-runner" data-mode="challenge" data-expected="50.0%">
<pre><code class="language-python">counts = {"Python": 50, "JS": 30, "Java": 20}

# Compute the percentage for "Python" and print like: 50.0%
</code></pre>
</div>

### Challenge 2 — Top Category

Sort categories by count descending and print the name of the category with the highest count.

<div class="pyodide-runner" data-mode="challenge" data-expected="Python">
<pre><code class="language-python">counts = {"JS": 30, "Python": 50, "Java": 20}

# Print the name of the category with the highest count
</code></pre>
</div>

---

## 📚 Further Reading

- [Matplotlib — Image Tutorial](https://matplotlib.org/stable/gallery/images_contours_and_fields/image_demo.html)
- [Matplotlib — Saving Figures](https://matplotlib.org/stable/api/_as_gen/matplotlib.pyplot.savefig.html)
- [Flask — Returning non-HTML responses](https://flask.palletsprojects.com/en/latest/quickstart/#about-responses)

---

!!! success "Lesson Complete 🎉"
    You can now render any Matplotlib chart to an in-memory PNG and stream it from a Flask endpoint — no disk writes, no temp files, production-ready.

[⬅️ Lesson 63 · REST API Visualization](63-rest-api-visualization.md){ .md-button } [➡️ Lesson 65 · Plotly Dash](65-plotly-dash.md){ .md-button .md-button--primary }
