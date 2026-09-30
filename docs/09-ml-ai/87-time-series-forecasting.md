---
title: "Lesson 87 · Time Series Forecasting API"
description: "Build a time series forecasting API using moving averages, exponential smoothing, and a /forecast endpoint."
---

# Lesson 87 · Time Series Forecasting API

> **Section:** 🧠 ML & AI &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Identify trend, seasonality, and noise in time series
- [ ] Implement simple moving average and exponential smoothing
- [ ] Understand Prophet / LSTM for production forecasting
- [ ] Build a `/forecast` endpoint returning N future points
- [ ] Evaluate forecasts with MAPE

---

## 📖 Introduction

Time series forecasting predicts future values based on historical patterns. Applications include demand forecasting, stock prices, server load, and energy consumption. This lesson builds simple forecasting algorithms from scratch and exposes them via a FastAPI endpoint.

---

## 1. Time Series Components

```
Value
  │       /\        /\
  │      /  \  /\  /  \
  │─────/────\/──\/────── trend (long-term direction)
  │   seasonality + noise
  └──────────────────── Time
```

| Component | Description | Example |
|---|---|---|
| **Trend** | Long-term direction | Sales growing 5% per month |
| **Seasonality** | Repeating cycles | More sales in December |
| **Noise** | Random variation | Day-to-day fluctuations |

---

## 2. Moving Average

A moving average smooths out noise by averaging a window of recent values.

=== "Python"
    ```python
    def moving_average(data, window):
        """Compute simple moving average with given window size."""
        if len(data) < window:
            raise ValueError(f"Need at least {window} data points")
        return [
            sum(data[i : i + window]) / window
            for i in range(len(data) - window + 1)
        ]

    sales = [10, 12, 11, 14, 13, 16, 15, 18, 17, 20]
    ma3   = moving_average(sales, 3)
    print("3-period MA:", [round(v, 2) for v in ma3])
    ```
=== "Output"
    ```
    3-period MA: [11.0, 12.33, 12.67, 14.33, 14.67, 16.33, 16.67, 18.33]
    ```

---

## 3. Exponential Smoothing

Exponential smoothing gives more weight to recent observations. Alpha (α) controls how fast the weight decays.

```python
def exponential_smoothing(data, alpha=0.3):
    """Simple exponential smoothing. alpha: smoothing factor 0 < α < 1."""
    smoothed = [data[0]]   # initialise with first value
    for i in range(1, len(data)):
        s = alpha * data[i] + (1 - alpha) * smoothed[-1]
        smoothed.append(round(s, 4))
    return smoothed

temps = [20, 22, 19, 25, 23, 27, 26, 28]
print(exponential_smoothing(temps, alpha=0.4))
```

!!! tip "Choosing alpha"
    - **High alpha (0.7–0.9)** → reacts quickly to changes, more noise
    - **Low alpha (0.1–0.3)** → smoother, lags behind real changes
    - Use cross-validation on holdout data to tune alpha.

---

## 4. FastAPI `/forecast` Endpoint

```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI()

class ForecastRequest(BaseModel):
    data: List[float]
    method: str = "moving_average"
    window: int = 3
    steps: int = 5

@app.post("/forecast")
def forecast(req: ForecastRequest):
    if req.method == "moving_average":
        last_ma = sum(req.data[-req.window:]) / req.window
        future  = [round(last_ma, 2)] * req.steps
    elif req.method == "exp_smoothing":
        smoothed = exponential_smoothing(req.data)
        last     = smoothed[-1]
        future   = [round(last, 2)] * req.steps
    else:
        return {"error": f"Unknown method: {req.method}"}

    return {
        "method":    req.method,
        "historical_last_5": req.data[-5:],
        "forecast":  future,
        "steps":     req.steps,
    }
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">def moving_average(data, window):
    return [
        sum(data[i:i+window]) / window
        for i in range(len(data) - window + 1)
    ]

def mape(actuals, predictions):
    """Mean Absolute Percentage Error."""
    errors = [abs((a - p) / a) for a, p in zip(actuals, predictions) if a != 0]
    return round(sum(errors) / len(errors) * 100, 2)

sales = [100, 110, 108, 115, 112, 120, 118, 125, 122, 130]
ma3   = moving_average(sales, 3)

print("Sales data:   ", sales)
print("3-period MA:  ", [round(v, 1) for v in ma3])

# Evaluate: compare MA predictions to actual (offset by window)
actuals     = sales[2:]   # starts from index 2 (first full window)
predictions = ma3

error = mape(actuals, predictions)
print(f"\nMAPE: {error:.2f}%")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Last Moving Average

Compute the 3-period moving average for `[10, 20, 30, 40, 50]` and print the **last** MA value.

Expected output:
```
40.0
```

<div class="pyodide-runner" data-mode="challenge" data-expected="40.0">
<pre><code class="language-python">data = [10, 20, 30, 40, 50]
window = 3
# Compute 3-period MA and print the last value
</code></pre>
</div>

---

### Challenge 2 — MAPE

Compute the Mean Absolute Percentage Error for predictions `[100, 110, 120]` vs actuals `[100, 100, 130]`. Round to 2 decimal places.

Expected output:
```
5.05
```

<div class="pyodide-runner" data-mode="challenge" data-expected="5.05">
<pre><code class="language-python">actuals     = [100, 100, 130]
predictions = [100, 110, 120]
# Compute MAPE = mean(|actual - pred| / actual) * 100, rounded to 2 dp
</code></pre>
</div>

---

## 📚 Further Reading

- [Prophet — Facebook Forecasting Library](https://facebook.github.io/prophet/)
- [Time Series Analysis — Towards Data Science](https://towardsdatascience.com/the-complete-guide-to-time-series-analysis-and-forecasting-70d476bfe775)
- [statsmodels — Exponential Smoothing](https://www.statsmodels.org/stable/tsa.html)

---

!!! success "Lesson Complete 🎉"
    You can now implement moving averages and exponential smoothing and build a forecasting API endpoint.

[⬅️ Lesson 86 · Recommendation System](86-recommendation-system.md){ .md-button } [➡️ Lesson 88 · Anomaly Detection](88-anomaly-detection-api.md){ .md-button .md-button--primary }
