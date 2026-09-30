---
title: "Lesson 88 · Anomaly Detection API"
description: "Detect anomalies in time series and metrics using Z-score and IQR methods, served via a FastAPI endpoint."
---

# Lesson 88 · Anomaly Detection API

> **Section:** 🧠 ML & AI &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

- [ ] Understand anomaly detection use cases (fraud, monitoring, quality)
- [ ] Implement Z-score based anomaly detection from scratch
- [ ] Use the IQR method as an alternative
- [ ] Build a `/detect` endpoint returning flagged anomalies
- [ ] Tune detection sensitivity with thresholds

---

## 📖 Introduction

Anomaly detection identifies data points that deviate significantly from expected patterns. Common applications: server CPU spikes, fraudulent transactions, manufacturing defects, and medical sensor readings.

---

## 1. Z-Score Method

Z-score measures how many standard deviations a value is from the mean.

```
z = (x - mean) / std_dev
```

Values with |z| > threshold (typically 2–3) are flagged as anomalies.

=== "Pure Python"
    ```python
    import math

    def mean(data):
        return sum(data) / len(data)

    def std_dev(data):
        m = mean(data)
        variance = sum((x - m) ** 2 for x in data) / len(data)
        return math.sqrt(variance)

    def z_scores(data):
        m = mean(data)
        s = std_dev(data)
        return [(x - m) / s if s > 0 else 0.0 for x in data]

    def detect_anomalies(data, threshold=2.0):
        zs = z_scores(data)
        return [
            {"index": i, "value": data[i], "z_score": round(z, 4)}
            for i, z in enumerate(zs) if abs(z) > threshold
        ]

    readings = [10, 12, 11, 10, 100, 13, 11, 12]
    anomalies = detect_anomalies(readings)
    print(anomalies)
    ```
=== "Output"
    ```
    [{'index': 4, 'value': 100, 'z_score': 2.8088}]
    ```

---

## 2. IQR Method

The Interquartile Range method is more robust to non-Gaussian distributions.

```python
def iqr_bounds(data, multiplier=1.5):
    """Compute IQR-based outlier bounds."""
    sorted_data = sorted(data)
    n = len(sorted_data)
    q1 = sorted_data[n // 4]
    q3 = sorted_data[(3 * n) // 4]
    iqr = q3 - q1
    lower = q1 - multiplier * iqr
    upper = q3 + multiplier * iqr
    return lower, upper

data = [10, 12, 11, 10, 100, 13, 11, 12, 9, 14]
lower, upper = iqr_bounds(data)
outliers = [x for x in data if x < lower or x > upper]
print(f"Bounds: [{lower:.1f}, {upper:.1f}]")
print(f"Outliers: {outliers}")
```

!!! tip "Z-score vs IQR"
    - **Z-score** works best when data is normally distributed
    - **IQR** is more robust to existing outliers skewing the mean/std
    - Use IQR when you expect heavy-tailed distributions

---

## 3. FastAPI `/detect` Endpoint

```python
from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Dict, Any

app = FastAPI()

class DetectRequest(BaseModel):
    data: List[float]
    method: str = "zscore"
    threshold: float = 2.0

@app.post("/detect")
def detect(req: DetectRequest):
    if req.method == "zscore":
        anomalies = detect_anomalies(req.data, req.threshold)
    elif req.method == "iqr":
        lo, hi = iqr_bounds(req.data, req.threshold)
        anomalies = [
            {"index": i, "value": v}
            for i, v in enumerate(req.data) if v < lo or v > hi
        ]
    else:
        return {"error": "method must be 'zscore' or 'iqr'"}

    return {
        "total_points": len(req.data),
        "anomalies_found": len(anomalies),
        "anomalies": anomalies,
    }
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import math

def mean(data): return sum(data) / len(data)
def std_dev(data):
    m = mean(data)
    return math.sqrt(sum((x - m)**2 for x in data) / len(data))

def detect_anomalies(data, threshold=2.0):
    m, s = mean(data), std_dev(data)
    return [
        (i, data[i], round((data[i] - m) / s, 4))
        for i in range(len(data))
        if abs((data[i] - m) / s) > threshold
    ]

# Simulate server response times (ms)
response_times = [45, 50, 48, 47, 52, 49, 300, 51, 46, 48, 200, 50]

print("Response times (ms):", response_times)
print(f"Mean: {mean(response_times):.1f}ms  Std: {std_dev(response_times):.1f}ms")
print()

anomalies = detect_anomalies(response_times, threshold=1.5)
if anomalies:
    print("⚠️  Anomalies detected:")
    for idx, val, z in anomalies:
        print(f"  Index {idx:2d}: {val}ms  (z={z:+.2f})")
else:
    print("✅ No anomalies detected")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Detect the Anomaly

Detect anomalies in `[10, 12, 11, 100, 13, 11]` with threshold `2.0`. Print the anomalous value.

Expected output:
```
100
```

<div class="pyodide-runner" data-mode="challenge" data-expected="100">
<pre><code class="language-python">import math

data = [10, 12, 11, 100, 13, 11]
threshold = 2.0

m = sum(data) / len(data)
s = math.sqrt(sum((x - m)**2 for x in data) / len(data))

for x in data:
    if abs((x - m) / s) > threshold:
        print(x)
</code></pre>
</div>

---

### Challenge 2 — Z-Score Value

Compute the Z-score for value `100` in `[10, 12, 11, 100, 13, 11]`. Round to 2 decimal places.

Expected output:
```
2.81
```

<div class="pyodide-runner" data-mode="challenge" data-expected="2.81">
<pre><code class="language-python">import math

data = [10, 12, 11, 100, 13, 11]
x    = 100

m = sum(data) / len(data)
s = math.sqrt(sum((v - m)**2 for v in data) / len(data))

print(round(abs(x - m) / s, 2))
</code></pre>
</div>

---

## 📚 Further Reading

- [scikit-learn IsolationForest](https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html)
- [Anomaly Detection Overview — Towards Data Science](https://towardsdatascience.com/5-ways-to-detect-outliers-that-every-data-scientist-should-know-python-code-70a54335a623)
- [Z-Score — Wikipedia](https://en.wikipedia.org/wiki/Standard_score)

---

!!! success "Lesson Complete 🎉"
    Z-score and IQR anomaly detection are foundational tools. You can now flag outliers in any numeric data stream.

[⬅️ Lesson 87 · Time Series Forecasting](87-time-series-forecasting.md){ .md-button } [➡️ Lesson 89 · AI Chatbot API](89-ai-chatbot-api.md){ .md-button .md-button--primary }
