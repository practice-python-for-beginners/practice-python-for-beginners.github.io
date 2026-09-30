---
title: "Lesson 90 · MLOps Basics for Python APIs"
description: "Learn MLOps: track experiments with MLflow, manage model registry, detect data drift, and set up retraining pipelines."
---

# Lesson 90 · MLOps Basics for Python APIs

> **Section:** 🧠 ML & AI &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Understand the MLOps lifecycle (data → train → validate → deploy → monitor)
- [ ] Track experiments with MLflow (metrics, params, artifacts)
- [ ] Use the MLflow model registry (staging → production)
- [ ] Detect data drift between training and serving data
- [ ] Set up automated retraining triggers

---

## 📖 Introduction

MLOps brings DevOps practices to machine learning: versioning, testing, monitoring, and automated deployment. Without it, models silently degrade as the world changes. This lesson covers the key tools and patterns.

---

## 1. MLflow Experiment Tracking

```python
import mlflow
import mlflow.sklearn
from sklearn.linear_model import LogisticRegression
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

mlflow.set_experiment("iris-classifier")

with mlflow.start_run(run_name="lr-C0.1"):
    # Log hyperparameters
    C = 0.1
    mlflow.log_param("C", C)
    mlflow.log_param("solver", "lbfgs")

    # Train
    X, y = load_iris(return_X_y=True)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
    model = LogisticRegression(C=C, max_iter=200)
    model.fit(X_train, y_train)

    # Log metrics
    acc = accuracy_score(y_test, model.predict(X_test))
    mlflow.log_metric("accuracy", acc)

    # Log model artifact
    mlflow.sklearn.log_model(model, "model")
    print(f"Accuracy: {acc:.4f}  run_id: {mlflow.active_run().info.run_id}")
```

!!! tip "View experiments in the MLflow UI"
    ```bash
    mlflow ui
    # Open http://127.0.0.1:5000
    ```
    Compare runs, chart metrics over time, and promote the best model to the registry.

---

## 2. Model Registry

```python
import mlflow

client = mlflow.tracking.MlflowClient()

# Register a model from a run
run_id = "abc123"
model_uri = f"runs:/{run_id}/model"
mv = mlflow.register_model(model_uri, "IrisClassifier")

# Transition stage
client.transition_model_version_stage(
    name="IrisClassifier",
    version=mv.version,
    stage="Production",
)

# Load the production model
prod_model = mlflow.sklearn.load_model("models:/IrisClassifier/Production")
```

---

## 3. Data Drift Detection

Models degrade when the real-world data distribution changes from what was seen during training.

=== "KS Test (statistical)"
    ```python
    from scipy import stats

    # Training distribution
    train_ages = [25, 30, 35, 28, 32, 27, 33, 29, 31, 26]
    # Serving distribution (shifted older)
    serve_ages = [45, 50, 48, 52, 47, 55, 49, 51, 53, 46]

    stat, p_value = stats.ks_2samp(train_ages, serve_ages)
    drift = p_value < 0.05
    print(f"KS stat: {stat:.4f}, p-value: {p_value:.4f}")
    print(f"Drift detected: {drift}")
    ```
=== "Mean shift (simple)"
    ```python
    def detect_drift(train_data, new_data, threshold=0.1):
        train_mean = sum(train_data) / len(train_data)
        new_mean   = sum(new_data)   / len(new_data)
        relative_shift = abs(new_mean - train_mean) / (abs(train_mean) or 1)
        return relative_shift > threshold, round(relative_shift, 4)

    drifted, shift = detect_drift([30, 32, 28], [45, 50, 48])
    print(f"Drift: {drifted}, shift: {shift:.1%}")
    ```

---

## 4. Automated Retraining

```python
import schedule, time

def check_drift_and_retrain():
    new_data = fetch_recent_serving_data()
    drifted, shift = detect_drift(TRAIN_BASELINE, new_data)
    if drifted:
        print(f"⚠️  Drift detected ({shift:.1%}). Triggering retraining…")
        train_and_register_new_model()
    else:
        print(f"✅ No drift ({shift:.1%}). Model OK.")

# Run daily at midnight
schedule.every().day.at("00:00").do(check_drift_and_retrain)
while True:
    schedule.run_pending()
    time.sleep(60)
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python"># Simulate MLflow-style experiment tracking

class Experiment:
    def __init__(self, name):
        self.name  = name
        self.runs  = []

    def log_run(self, run_id, params, metrics):
        self.runs.append({"run_id": run_id, "params": params, "metrics": metrics})

    def best_run(self, metric="accuracy"):
        return max(self.runs, key=lambda r: r["metrics"].get(metric, 0))

# Simulate 3 training runs
exp = Experiment("iris-classifier")
exp.log_run("run_001", {"C": 0.01}, {"accuracy": 0.87, "f1": 0.86})
exp.log_run("run_002", {"C": 0.10}, {"accuracy": 0.95, "f1": 0.94})
exp.log_run("run_003", {"C": 1.00}, {"accuracy": 0.93, "f1": 0.92})

best = exp.best_run("accuracy")
print(f"Best run: {best['run_id']}")
print(f"  Accuracy: {best['metrics']['accuracy']}")
print(f"  Params:   {best['params']}")

# Drift detection
def detect_drift(baseline, new_data, threshold=10):
    baseline_mean = sum(baseline) / len(baseline)
    new_mean      = sum(new_data) / len(new_data)
    shift = abs(new_mean - baseline_mean)
    return shift > threshold, round(shift, 2)

baseline_ages = [25, 28, 30, 27, 32]
current_ages  = [45, 50, 48, 52, 47]
drifted, shift = detect_drift(baseline_ages, current_ages)
print(f"\nAge distribution drift: {drifted} (shift={shift})")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Best Run

From the mock runs list, find the run with the highest accuracy and print its `run_id`.

Expected output:
```
run_002
```

<div class="pyodide-runner" data-mode="challenge" data-expected="run_002">
<pre><code class="language-python">runs = [
    {"run_id": "run_001", "accuracy": 0.87},
    {"run_id": "run_002", "accuracy": 0.95},
    {"run_id": "run_003", "accuracy": 0.93},
]
# Find the run with the highest accuracy and print its run_id
</code></pre>
</div>

---

### Challenge 2 — Drift Detection

The baseline mean is `30`. New data is `[45, 50, 55]` with mean `50`. Since `|50 - 30| = 20 > 10`, print `"drift detected"`.

Expected output:
```
drift detected
```

<div class="pyodide-runner" data-mode="challenge" data-expected="drift detected">
<pre><code class="language-python">baseline_mean = 30
new_data = [45, 50, 55]
threshold = 10

new_mean = sum(new_data) / len(new_data)
if abs(new_mean - baseline_mean) > threshold:
    print("drift detected")
else:
    print("no drift")
</code></pre>
</div>

---

## 📚 Further Reading

- [MLflow Documentation](https://mlflow.org/docs/latest/index.html)
- [MLOps on AWS — SageMaker Pipelines](https://docs.aws.amazon.com/sagemaker/latest/dg/pipelines-overview.html)
- [Data Drift with Evidently AI](https://www.evidentlyai.com/)

---

!!! success "Section 9 Complete! 🧠🎉"
    You've completed the Machine Learning & AI section. You can now train, deploy, and monitor ML models via production-ready APIs.

[⬅️ Lesson 89 · AI Chatbot API](89-ai-chatbot-api.md){ .md-button } [➡️ Section 10 · Lesson 91 · Multi-Tenant Architecture](../10-enterprise/91-multi-tenant-api.md){ .md-button .md-button--primary }
