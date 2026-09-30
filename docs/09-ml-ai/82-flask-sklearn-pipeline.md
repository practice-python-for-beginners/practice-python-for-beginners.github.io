---
title: "Lesson 82 · Flask + Scikit-Learn Pipeline"
description: "Build an end-to-end ML pipeline with scikit-learn and serve predictions via Flask."
---

# Lesson 82 · Flask + Scikit-Learn Pipeline

> **Section:** 🧠 ML & AI &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

- [ ] Build a `Pipeline` with preprocessing and a classifier
- [ ] Use `ColumnTransformer` for mixed feature types
- [ ] Serialise and deserialise the pipeline with `joblib`
- [ ] Serve predictions through a Flask `/predict` route
- [ ] Handle unseen categories at inference time

---

## 📖 Introduction

A scikit-learn `Pipeline` chains preprocessing steps and a model into a single object that can be trained, evaluated, saved, and loaded as one unit. This prevents data leakage and makes deployment clean.

---

## 1. Building a Pipeline

=== "Python"
    ```python
    from sklearn.pipeline import Pipeline
    from sklearn.compose import ColumnTransformer
    from sklearn.preprocessing import StandardScaler, OneHotEncoder
    from sklearn.ensemble import RandomForestClassifier
    import pandas as pd

    # Example: predict loan approval
    numeric_features  = ["age", "income", "loan_amount"]
    categorical_features = ["employment_type"]

    preprocessor = ColumnTransformer([
        ("num", StandardScaler(),   numeric_features),
        ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
    ])

    pipeline = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier",   RandomForestClassifier(n_estimators=100, random_state=42)),
    ])
    ```
=== "Train & Evaluate"
    ```python
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    print(classification_report(y_test, y_pred))
    ```

---

## 2. Min-Max Scaling Explained

Before passing numeric features to many models, you normalise them to [0, 1]:

```
x_scaled = (x - x_min) / (x_max - x_min)
```

=== "Python"
    ```python
    def min_max_scale(values):
        lo, hi = min(values), max(values)
        return [(v - lo) / (hi - lo) for v in values]

    data = [10, 20, 30, 40, 50]
    scaled = min_max_scale(data)
    print(scaled)
    # [0.0, 0.25, 0.5, 0.75, 1.0]
    ```
=== "Output"
    ```
    [0.0, 0.25, 0.5, 0.75, 1.0]
    ```

---

## 3. Flask Serving

```python
from flask import Flask, request, jsonify
import joblib, pandas as pd

app = Flask(__name__)
pipeline = joblib.load("loan_pipeline.joblib")

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()
    df = pd.DataFrame([data])
    prediction = pipeline.predict(df)[0]
    proba = pipeline.predict_proba(df)[0]
    return jsonify({
        "approved": bool(prediction),
        "confidence": round(float(max(proba)), 4),
    })
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">def min_max_scale(values):
    lo, hi = min(values), max(values)
    if hi == lo:
        return [0.0] * len(values)
    return [(v - lo) / (hi - lo) for v in values]

def one_hot_encode(values):
    categories = sorted(set(values))
    return {cat: [1 if v == cat else 0 for v in values] for cat in categories}

data = [10, 20, 30, 40, 50]
scaled = min_max_scale(data)
print("Min-Max Scaled:", scaled)

labels = ["cat", "dog", "cat", "bird"]
encoded = one_hot_encode(labels)
print("\nOne-Hot Encoded:")
for cat, vec in encoded.items():
    print(f"  {cat}: {vec}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Min-Max Scaling

Min-max scale `[10, 20, 30, 40, 50]` and print the scaled value at index 2 (value 30).

Expected output:
```
0.5
```

<div class="pyodide-runner" data-mode="challenge" data-expected="0.5">
<pre><code class="language-python">data = [10, 20, 30, 40, 50]
# Min-max scale the list and print the value at index 2
</code></pre>
</div>

---

### Challenge 2 — Unique Categories

Count the number of unique categories in `["cat", "dog", "cat", "bird"]` and print the count.

Expected output:
```
3
```

<div class="pyodide-runner" data-mode="challenge" data-expected="3">
<pre><code class="language-python">labels = ["cat", "dog", "cat", "bird"]
# Print the number of unique categories
</code></pre>
</div>

---

## 📚 Further Reading

- [scikit-learn Pipelines](https://scikit-learn.org/stable/modules/pipeline.html)
- [ColumnTransformer docs](https://scikit-learn.org/stable/modules/generated/sklearn.compose.ColumnTransformer.html)
- [Flask ML serving — Towards Data Science](https://towardsdatascience.com/deploying-a-machine-learning-model-as-a-rest-api-4a03b865c166)

---

!!! success "Lesson Complete 🎉"
    Pipelines are the professional way to build ML models — they keep preprocessing and prediction together.

[⬅️ Lesson 81 · ML Model API](81-ml-model-api.md){ .md-button } [➡️ Lesson 83 · Deploy ML with FastAPI](83-deploy-ml-fastapi.md){ .md-button .md-button--primary }
