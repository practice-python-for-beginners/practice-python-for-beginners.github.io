---
title: "Lesson 83 · Deploying ML Models with FastAPI"
description: "Serve ML models at scale using FastAPI — batch prediction, model warm-up, versioning, and Dockerised deployment."
---

# Lesson 83 · Deploying ML Models with FastAPI

> **Section:** 🧠 ML & AI &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

- [ ] Load a model once at startup using FastAPI's `lifespan`
- [ ] Build single and batch prediction endpoints
- [ ] Return versioned responses with `response_model`
- [ ] Add `/health` and `/ready` probes
- [ ] Containerise the serving app with Docker

---

## 📖 Introduction

FastAPI is the preferred framework for ML serving due to its automatic OpenAPI docs, Pydantic validation, async support, and high throughput. This lesson shows how to take a trained model all the way to a production-ready containerised service.

---

## 1. Model Warm-Up with Lifespan

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
import joblib

model = None   # global reference

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    model = joblib.load("model_v1.joblib")
    print("Model loaded.")
    yield
    model = None   # cleanup on shutdown

app = FastAPI(lifespan=lifespan)
```

!!! tip "Why lifespan?"
    Startup events load the model **once** when the server starts, not on every request. This keeps latency low.

---

## 2. Batch Prediction

=== "Python"
    ```python
    from pydantic import BaseModel
    from typing import List
    import numpy as np

    class PredictRequest(BaseModel):
        inputs: List[List[float]]

    class PredictResponse(BaseModel):
        predictions: List[float]
        model_version: str = "v1"

    @app.post("/v1/predict/batch", response_model=PredictResponse)
    async def predict_batch(body: PredictRequest):
        X = np.array(body.inputs)
        preds = model.predict(X).tolist()
        return PredictResponse(predictions=preds)
    ```
=== "Request JSON"
    ```json
    {
      "inputs": [
        [5.1, 3.5, 1.4, 0.2],
        [6.2, 2.8, 4.8, 1.8]
      ]
    }
    ```

---

## 3. Health & Readiness Probes

```python
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/ready")
def ready():
    if model is None:
        return {"status": "not ready"}, 503
    return {"status": "ready", "model": "v1"}
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">def mock_model_predict(x):
    """Simulate y = 2x + 1."""
    return 2 * x + 1

inputs = [1, 2, 3, 4, 5]
predictions = [mock_model_predict(x) for x in inputs]

print("Batch predictions:")
for x, y in zip(inputs, predictions):
    print(f"  x={x}  →  y={y}")

print(f"\nSum of predictions: {sum(predictions)}")
print(f"Mean prediction: {sum(predictions)/len(predictions)}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Batch Sum

Apply the model `y = x * 2 + 1` to inputs `[1, 2, 3, 4, 5]`. Print the **sum** of all predictions.

Expected output:
```
35
```

<div class="pyodide-runner" data-mode="challenge" data-expected="35">
<pre><code class="language-python">inputs = [1, 2, 3, 4, 5]
# Apply y = x*2 + 1 to each input and print the sum
</code></pre>
</div>

---

### Challenge 2 — Input Validation

Count how many inputs in `[1, 2, -3, 4]` are **valid** (positive numbers).

Expected output:
```
3
```

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">inputs = [1, 2, -3, 4]
# Count and print the number of positive inputs
</code></pre>
</div>

---

## 📚 Further Reading

- [FastAPI Lifespan Events](https://fastapi.tiangolo.com/advanced/events/)
- [Deploying ML with Docker — Real Python](https://realpython.com/docker-in-action-fitter-happier-more-productive/)
- [ML Deployment Patterns — Chip Huyen](https://huyenchip.com/2020/06/22/mlops.html)

---

!!! success "Lesson Complete 🎉"
    You can now deploy any ML model as a production-ready FastAPI service with health checks and batch support.

[⬅️ Lesson 82 · Flask + Scikit-Learn](82-flask-sklearn-pipeline.md){ .md-button } [➡️ Lesson 84 · Sentiment Analysis](84-sentiment-analysis-api.md){ .md-button .md-button--primary }
