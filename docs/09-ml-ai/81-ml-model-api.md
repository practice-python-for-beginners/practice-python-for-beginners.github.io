---
title: "Lesson 81 · Machine Learning Model API"
description: "Serve a trained scikit-learn model via a REST API — lifecycle, serialisation, prediction endpoint, and input validation."
---

# Lesson 81 · Machine Learning Model API

> **Section:** 🧠 ML & AI &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Understand the ML lifecycle: train → save → serve → monitor
- [ ] Serialise a scikit-learn model with `joblib`
- [ ] Build a `/predict` endpoint in FastAPI
- [ ] Validate input features with Pydantic
- [ ] Version models and handle schema changes

---

## 📖 Introduction

Training a model is only half the job. The other half is making it available to applications via an API. This lesson covers the complete path from a trained scikit-learn model to a production FastAPI prediction service.

---

## 1. The ML API Lifecycle

```
Collect data → Feature engineering → Train model → Evaluate
     → Serialise with joblib → Load in API → /predict endpoint
     → Monitor drift → Retrain
```

---

## 2. Training & Saving a Model

=== "Train"
    ```python
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import LogisticRegression
    from sklearn.datasets import load_iris
    import joblib

    X, y = load_iris(return_X_y=True)

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",    LogisticRegression(max_iter=200)),
    ])
    pipeline.fit(X, y)

    joblib.dump(pipeline, "model_v1.joblib")
    print("Model saved.")
    ```
=== "Load & Predict"
    ```python
    import joblib
    import numpy as np

    pipeline = joblib.load("model_v1.joblib")

    sample = [[5.1, 3.5, 1.4, 0.2]]   # sepal_l, sepal_w, petal_l, petal_w
    prediction = pipeline.predict(sample)
    proba = pipeline.predict_proba(sample)

    print(f"Predicted class: {prediction[0]}")
    print(f"Probabilities: {proba[0].round(3)}")
    ```

---

## 3. FastAPI Prediction Endpoint

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import joblib
import numpy as np

app = FastAPI(title="Iris Classifier API")

# Load model once at startup
model = joblib.load("model_v1.joblib")
LABELS = ["setosa", "versicolor", "virginica"]

class IrisFeatures(BaseModel):
    sepal_length: float = Field(..., gt=0, le=10, example=5.1)
    sepal_width:  float = Field(..., gt=0, le=10, example=3.5)
    petal_length: float = Field(..., gt=0, le=10, example=1.4)
    petal_width:  float = Field(..., gt=0, le=10, example=0.2)

class PredictionResponse(BaseModel):
    prediction: str
    confidence: float
    model_version: str = "v1"

@app.post("/predict", response_model=PredictionResponse)
def predict(features: IrisFeatures):
    X = [[features.sepal_length, features.sepal_width,
          features.petal_length, features.petal_width]]
    pred   = model.predict(X)[0]
    proba  = model.predict_proba(X)[0]
    return PredictionResponse(
        prediction=LABELS[pred],
        confidence=round(float(proba[pred]), 4),
    )
```

!!! tip "Load the model once"
    Never call `joblib.load()` inside the route function — that would reload from disk on every request. Load at module level or use FastAPI's `lifespan` startup hook.

---

## 4. Model Versioning

```python
import os

MODEL_VERSION = os.getenv("MODEL_VERSION", "v1")
model = joblib.load(f"model_{MODEL_VERSION}.joblib")

@app.get("/model/info")
def model_info():
    return {"version": MODEL_VERSION, "classes": LABELS}
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate a linear model prediction without sklearn

def predict(x, slope=2.5, intercept=1.0):
    """Simple linear model: y = slope * x + intercept."""
    return slope * x + intercept

# Simulate a small dataset
xs = [1, 2, 3, 4, 5]
ys = [predict(x) for x in xs]

print("x  →  prediction")
for x, y in zip(xs, ys):
    print(f"{x}  →  {y}")

# MSE calculation
actuals   = [3.5, 5.9, 8.1, 11.0, 13.5]
preds     = [predict(x) for x in xs]
mse = sum((a - p) ** 2 for a, p in zip(actuals, preds)) / len(actuals)
print(f"\nMSE vs mock actuals: {mse:.4f}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Linear Prediction

Using `slope = 2` and `intercept = 1`, predict `y` for `x = 6` and print the result.

Expected output:
```
13
```

<div class="pyodide-runner" data-mode="challenge" data-expected="13">
<pre><code class="language-python">slope = 2
intercept = 1
x = 6
# Compute y = slope * x + intercept and print
</code></pre>
</div>

---

### Challenge 2 — MSE

Compute the **Mean Squared Error** for `predictions = [10, 20, 30]` vs `actuals = [12, 18, 32]`. Round to 2 decimal places.

Expected output:
```
2.67
```

<div class="pyodide-runner" data-mode="challenge" data-expected="2.67">
<pre><code class="language-python">predictions = [10, 20, 30]
actuals     = [12, 18, 32]
# Compute MSE and print rounded to 2 dp
</code></pre>
</div>

---

## 📚 Further Reading

- [scikit-learn — Model Persistence](https://scikit-learn.org/stable/model_persistence.html)
- [FastAPI — Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Serving ML Models — Real Python](https://realpython.com/fastapi-python-web-apis/)

---

!!! success "Lesson Complete 🎉"
    You can now take any trained model and expose it as a production API endpoint.

[⬅️ Lesson 80 · Event-Driven Pub/Sub](../08-cloud/80-event-driven-pubsub.md){ .md-button } [➡️ Lesson 82 · Flask + Scikit-Learn](82-flask-sklearn-pipeline.md){ .md-button .md-button--primary }
