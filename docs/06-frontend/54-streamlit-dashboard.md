---
title: "Lesson 54 · Streamlit Dashboard"
description: "Build interactive data dashboards in pure Python using Streamlit widgets, layouts, charts, and session state."
---

# Lesson 54 · Streamlit Dashboard

> **Section:** 🖥️ Frontend Integrations &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

- [ ] Understand Streamlit's Python-only frontend model
- [ ] Use `st.title`, `st.write`, and `st.dataframe` to display data
- [ ] Add interactive widgets: `st.slider`, `st.selectbox`, `st.button`
- [ ] Arrange components with `st.columns` and `st.sidebar`
- [ ] Display a line chart with `st.line_chart`
- [ ] Persist values across reruns with `st.session_state`

---

## 📖 Introduction

**Streamlit** turns a Python script into a live web app. Every time a widget changes, Streamlit reruns the script top-to-bottom and re-renders the result — no JavaScript, no HTML, no CSS required. It is the fastest path from a pandas DataFrame to a shareable dashboard.

Install: `pip install streamlit`  
Run: `streamlit run app.py`

---

## 1. Core Display Functions

=== "Text & data"
    ```python
    import streamlit as st
    import pandas as pd

    st.title("Sales Dashboard")
    st.write("Welcome! This dashboard shows **monthly sales**.")

    df = pd.DataFrame({
        "Month": ["Jan", "Feb", "Mar", "Apr"],
        "Sales": [12000, 18500, 15200, 22000],
    })

    st.dataframe(df)              # interactive table
    st.table(df)                  # static table
    st.metric("Total Sales", f"${df['Sales'].sum():,}", delta="+8%")
    ```

=== "Media"
    ```python
    st.image("logo.png", width=200)
    st.video("https://example.com/demo.mp4")
    st.audio("sound.wav")
    ```

=== "Markdown & code"
    ```python
    st.markdown("## Section Title")
    st.markdown("> Blockquote text here")
    st.code('print("Hello, Streamlit!")', language="python")
    ```

!!! tip "st.write() is a Swiss-army knife"
    `st.write()` accepts strings, dicts, DataFrames, Matplotlib figures, and more — it picks the right renderer automatically.

---

## 2. Widgets

=== "Slider & selectbox"
    ```python
    import streamlit as st

    age_range = st.slider("Age range", 18, 65, (25, 45))
    # Returns tuple (min_val, max_val)

    department = st.selectbox("Department", ["Engineering", "Sales", "HR", "Finance"])

    show_inactive = st.checkbox("Show inactive users", value=False)
    ```

=== "Text & number inputs"
    ```python
    name    = st.text_input("Search name", placeholder="Alice…")
    budget  = st.number_input("Max budget ($)", min_value=0, max_value=100_000, step=500)
    date    = st.date_input("Report date")
    ```

=== "Button & download"
    ```python
    if st.button("Refresh data"):
        st.write("Data refreshed!")

    csv = df.to_csv(index=False).encode("utf-8")
    st.download_button("Download CSV", csv, "data.csv", "text/csv")
    ```

| Widget | Returns |
|--------|---------|
| `st.slider` | int / float / tuple |
| `st.selectbox` | selected value |
| `st.checkbox` | bool |
| `st.text_input` | str |
| `st.button` | bool (True once clicked) |

---

## 3. Layout

=== "Columns"
    ```python
    import streamlit as st

    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("Users", 1_240, "+12")

    with col2:
        st.metric("Revenue", "$48,200", "+5%")

    with col3:
        st.metric("Churn", "3.2%", "-0.4%")
    ```

=== "Sidebar"
    ```python
    with st.sidebar:
        st.header("Filters")
        region = st.selectbox("Region", ["All", "North", "South", "East", "West"])
        year   = st.slider("Year", 2020, 2025, 2024)
    ```

=== "Expander & tabs"
    ```python
    with st.expander("Raw data"):
        st.dataframe(df)

    tab1, tab2 = st.tabs(["Chart", "Table"])
    with tab1:
        st.line_chart(df.set_index("Month")["Sales"])
    with tab2:
        st.table(df)
    ```

---

## 4. Charts

=== "Built-in charts"
    ```python
    import pandas as pd, streamlit as st

    df = pd.DataFrame({
        "date":  pd.date_range("2024-01", periods=12, freq="MS"),
        "sales": [10, 14, 12, 18, 21, 19, 24, 22, 26, 28, 25, 30],
    }).set_index("date")

    st.line_chart(df)
    st.bar_chart(df)
    st.area_chart(df)
    ```

=== "Plotly"
    ```python
    import plotly.express as px, streamlit as st

    fig = px.scatter(df, x="Month", y="Sales", color="Region",
                     title="Sales by Region")
    st.plotly_chart(fig, use_container_width=True)
    ```

!!! info "Plotly vs built-in"
    `st.line_chart` is instant for exploratory work. `st.plotly_chart` gives you tooltips, zoom, colour control, and multi-trace charts.

---

## 5. Session State

=== "Persisting values"
    ```python
    import streamlit as st

    if "count" not in st.session_state:
        st.session_state.count = 0

    if st.button("Increment"):
        st.session_state.count += 1

    st.write(f"Button clicked {st.session_state.count} times")
    ```

=== "Caching data fetches"
    ```python
    import streamlit as st
    import pandas as pd

    @st.cache_data(ttl=300)   # cache for 5 minutes
    def load_data(url: str) -> pd.DataFrame:
        return pd.read_csv(url)

    df = load_data("https://example.com/data.csv")
    st.dataframe(df)
    ```

!!! warning "Session state is per browser tab"
    Each connected client has its own `st.session_state` — it is not shared across users. Use a database for shared state.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate Streamlit widget state in pure Python
state = {
    "age_min": 20,
    "age_max": 50,
    "department": "Engineering",
    "show_inactive": False,
}

users = [
    {"name": "Alice", "age": 28, "dept": "Engineering", "active": True},
    {"name": "Bob",   "age": 35, "dept": "Sales",       "active": True},
    {"name": "Carol", "age": 42, "dept": "Engineering", "active": False},
    {"name": "Dave",  "age": 55, "dept": "HR",          "active": True},
    {"name": "Eve",   "age": 31, "dept": "Engineering", "active": True},
]

def apply_filters(users, state):
    result = [u for u in users
              if state["age_min"] <= u["age"] <= state["age_max"]
              and u["dept"] == state["department"]]
    if not state["show_inactive"]:
        result = [u for u in result if u["active"]]
    return result

filtered = apply_filters(users, state)
print(f"Filter: dept={state['department']}, age={state['age_min']}-{state['age_max']}")
print(f"Matching users: {len(filtered)}")
for u in filtered:
    status = "active" if u["active"] else "inactive"
    print(f"  {u['name']} (age {u['age']}) — {status}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Filter by Age

From a mock state dict, compute the number of users whose age is between 25 and 35 (inclusive).

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">state = {"age_min": 25, "age_max": 35}

users = [
    {"name": "Alice", "age": 28},
    {"name": "Bob",   "age": 22},
    {"name": "Carol", "age": 35},
    {"name": "Dave",  "age": 40},
]

# Count users within the age range in state
count = 0  # your code here

print(count)
</code></pre>
</div>

---

### Challenge 2 — Simulate selectbox

Pick the correct option from a list and print it.

<div class="pyodide-runner" data-mode="challenge" data-expected="option B">
<pre><code class="language-python">options = ["option A", "option B", "option C"]
selected_index = 1  # simulate user selecting index 1

# Print the selected option
selected = None  # your code here

print(selected)
</code></pre>
</div>

---

## 📚 Further Reading

- [Streamlit documentation](https://docs.streamlit.io/)
- [Streamlit session_state](https://docs.streamlit.io/library/api-reference/session-state)
- [Streamlit Community Cloud deployment](https://docs.streamlit.io/streamlit-community-cloud)

---

!!! success "Lesson Complete 🎉"
    You can now build fully interactive dashboards with zero JavaScript. Next: add charts to a traditional Flask app using Chart.js!

[⬅️ Lesson 53 · FastAPI with JavaScript Frontend](53-fastapi-js-frontend.md){ .md-button } [➡️ Lesson 55 · Flask Dashboard with Charts](55-flask-charts-dashboard.md){ .md-button .md-button--primary }
