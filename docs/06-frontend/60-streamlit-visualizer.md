---
title: "Lesson 60 · Streamlit API Data Visualizer"
description: "Build a full Streamlit data visualizer: cache API fetches with @st.cache_data, display DataFrames, render Plotly charts, filter with widgets, download CSV, and deploy on Streamlit Cloud."
---

# Lesson 60 · Streamlit API Data Visualizer

> **Section:** 🖥️ Frontend Integrations &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Fetch API data in Streamlit with `@st.cache_data`
- [ ] Display and filter a pandas DataFrame in the UI
- [ ] Render an interactive Plotly chart with `st.plotly_chart`
- [ ] Use widgets to drive live filtering of data
- [ ] Offer a one-click CSV download with `st.download_button`
- [ ] Deploy an app to Streamlit Community Cloud

---

## 📖 Introduction

Combining Streamlit with a live data API gives you a fully interactive data-exploration tool in pure Python. `@st.cache_data` prevents redundant network calls; pandas powers the filtering; Plotly makes the charts interactive. The whole app can be deployed publicly in minutes via Streamlit Cloud.

Install: `pip install streamlit pandas plotly requests`

---

## 1. Fetching API Data with @st.cache_data

=== "Cached fetch"
    ```python
    import streamlit as st
    import requests
    import pandas as pd

    @st.cache_data(ttl=300)  # cache 5 minutes
    def load_stock_data(symbol: str) -> pd.DataFrame:
        url = f"https://api.example.com/stocks/{symbol}/history"
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return pd.DataFrame(resp.json()["prices"])

    df = load_stock_data("AAPL")
    st.dataframe(df)
    ```

=== "Cache behaviour"
    ```
    First call  → network request → result stored in cache
    Next 5 min  → same args → return cached result instantly
    After 5 min → cache expires → fresh network request
    User changes symbol → new cache key → fresh network request
    ```

=== "Cache options"
    | Parameter | Default | Meaning |
    |-----------|---------|---------|
    | `ttl` | `None` (forever) | Time-to-live in seconds |
    | `max_entries` | `None` | Max cache entries |
    | `show_spinner` | `True` | Show loading indicator |

!!! warning "@st.cache_data vs @st.cache_resource"
    Use `@st.cache_data` for data (DataFrames, dicts, plain Python objects). Use `@st.cache_resource` for shared resources (DB connections, ML models) that should not be pickled.

---

## 2. Displaying DataFrames

=== "Basic display"
    ```python
    import streamlit as st
    import pandas as pd

    df = pd.DataFrame({
        "date":  ["2024-01-01", "2024-01-02", "2024-01-03"],
        "close": [150.0,        152.5,         149.8],
        "volume": [1_200_000,   980_000,        1_450_000],
    })

    st.dataframe(df, use_container_width=True)
    st.metric("Latest close", f"${df['close'].iloc[-1]:.2f}")
    ```

=== "Column config"
    ```python
    st.dataframe(
        df,
        column_config={
            "close":  st.column_config.NumberColumn("Close ($)", format="$%.2f"),
            "volume": st.column_config.NumberColumn("Volume",    format="%d"),
            "date":   st.column_config.DateColumn("Date"),
        },
        hide_index=True,
    )
    ```

---

## 3. Plotly Charts in Streamlit

=== "Line chart"
    ```python
    import plotly.express as px
    import streamlit as st

    fig = px.line(
        df,
        x="date",
        y="close",
        title="Stock Closing Price",
        labels={"close": "Price ($)", "date": "Date"},
        markers=True,
    )
    fig.update_layout(hovermode="x unified")
    st.plotly_chart(fig, use_container_width=True)
    ```

=== "Multiple traces"
    ```python
    import plotly.graph_objects as go

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=df["date"], y=df["close"],
                             name="Close", mode="lines+markers"))
    fig.add_trace(go.Bar(x=df["date"], y=df["volume"],
                         name="Volume", yaxis="y2", opacity=0.3))
    fig.update_layout(
        title="Price & Volume",
        yaxis2=dict(overlaying="y", side="right"),
    )
    st.plotly_chart(fig, use_container_width=True)
    ```

!!! tip "use_container_width=True"
    Always pass this flag so the chart fills the column it lives in instead of overflowing on narrow screens.

---

## 4. Filtering Data with Widgets

=== "Sidebar filters"
    ```python
    import streamlit as st
    import pandas as pd

    df = load_all_data()  # your data source

    with st.sidebar:
        st.header("Filters")
        date_from = st.date_input("From date")
        date_to   = st.date_input("To date")
        min_val   = st.slider("Min closing price", 0, 500, 100)

    # Apply filters reactively
    mask = (
        (pd.to_datetime(df["date"]) >= pd.to_datetime(date_from)) &
        (pd.to_datetime(df["date"]) <= pd.to_datetime(date_to)) &
        (df["close"] >= min_val)
    )
    filtered = df[mask]

    st.write(f"Showing {len(filtered)} of {len(df)} records")
    st.dataframe(filtered)
    ```

=== "Widget → chart pipeline"
    ```
    User moves slider (min_val = 140)
        → Streamlit reruns script
        → mask recomputed
        → filtered DataFrame rebuilt
        → chart re-rendered with new data
    ```

---

## 5. CSV Download and Streamlit Cloud Deployment

=== "Download button"
    ```python
    import streamlit as st

    csv = filtered.to_csv(index=False).encode("utf-8")

    st.download_button(
        label="📥 Download filtered data as CSV",
        data=csv,
        file_name="stock_data_filtered.csv",
        mime="text/csv",
    )
    ```

=== "requirements.txt"
    ```
    streamlit>=1.32
    pandas>=2.0
    plotly>=5.18
    requests>=2.31
    ```

=== "Deploying to Streamlit Cloud"
    ```
    1. Push your app to a public GitHub repo
    2. Go to https://share.streamlit.io/
    3. Click "New app" → select repo, branch, main file
    4. Add secrets (API keys) in the Secrets panel
    5. Click Deploy — live URL in ~2 minutes
    ```

| Setting | Where to configure |
|---------|-------------------|
| API keys / tokens | Streamlit Cloud Secrets → `st.secrets["MY_KEY"]` |
| Python version | `runtime.txt` → `python-3.11` |
| Extra packages | `packages.txt` for system deps (e.g. `libpq-dev`) |

!!! info "Secrets in local dev"
    Create `.streamlit/secrets.toml` locally with `MY_KEY = "value"`. Add it to `.gitignore` — never commit secrets.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate a Streamlit data visualization pipeline in pure Python
mock_stock_data = [
    {"date": "2024-01-01", "close": 148.5,  "volume": 1_200_000},
    {"date": "2024-01-02", "close": 152.0,  "volume":   980_000},
    {"date": "2024-01-03", "close": 149.8,  "volume": 1_450_000},
    {"date": "2024-01-04", "close": 155.3,  "volume": 1_100_000},
    {"date": "2024-01-05", "close": 157.1,  "volume":   870_000},
]

# Load data (simulate @st.cache_data)
data = mock_stock_data

# Compute basic stats
closes   = [r["close"] for r in data]
avg_close = sum(closes) / len(closes)
min_close = min(closes)
max_close = max(closes)

print(f"Records  : {len(data)}")
print(f"Avg close: ${avg_close:.1f}")
print(f"Min close: ${min_close:.1f}")
print(f"Max close: ${max_close:.1f}")

# Apply a filter: close > 150
filtered = [r for r in data if r["close"] > 150]
print(f"\nRecords with close > $150: {len(filtered)}")
for r in filtered:
    print(f"  {r['date']}: ${r['close']:.1f}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Average Closing Price

Compute the average closing price from mock stock data and print it rounded to 1 decimal place.

<div class="pyodide-runner" data-mode="challenge" data-expected="152.4">
<pre><code class="language-python">stock_data = [
    {"date": "2024-01-01", "close": 148.5},
    {"date": "2024-01-02", "close": 152.0},
    {"date": "2024-01-03", "close": 149.8},
    {"date": "2024-01-04", "close": 155.3},
    {"date": "2024-01-05", "close": 157.1},
    {"date": "2024-01-06", "close": 154.2},
    {"date": "2024-01-07", "close": 151.7},
]

# Compute average closing price and print rounded to 1dp
avg = 0.0  # your code here

print(round(avg, 1))
</code></pre>
</div>

---

### Challenge 2 — Filter High Values

Filter records where `close > 150` and print the count.

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">stock_data = [
    {"date": "2024-01-01", "close": 148.5},
    {"date": "2024-01-02", "close": 152.0},
    {"date": "2024-01-03", "close": 149.8},
    {"date": "2024-01-04", "close": 155.3},
    {"date": "2024-01-05", "close": 147.6},
]

# Count records where close > 150
count = 0  # your code here

print(count)
</code></pre>
</div>

---

## 📚 Further Reading

- [Streamlit — st.cache_data](https://docs.streamlit.io/library/api-reference/performance/st.cache_data)
- [Plotly Express documentation](https://plotly.com/python/plotly-express/)
- [Streamlit Community Cloud](https://docs.streamlit.io/streamlit-community-cloud/get-started)

---

!!! success "Section Complete 🎉"
    Congratulations — you've completed Section 6: Frontend Integrations & Dashboards! You can now consume APIs, build Flask and FastAPI frontends, create React-powered SPAs, wire up AJAX, build Streamlit dashboards, and deploy them all to the cloud.

[⬅️ Lesson 59 · Flask APIs with AJAX](59-flask-ajax.md){ .md-button } [➡️ Section 7 · Data APIs & Processing](../07-data-apis/index.md){ .md-button .md-button--primary }
