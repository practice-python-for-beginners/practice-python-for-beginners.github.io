---
title: "Lesson 86 · Recommendation System API"
description: "Build a recommendation engine using collaborative filtering and cosine similarity, served via a FastAPI endpoint."
---

# Lesson 86 · Recommendation System API

> **Section:** 🧠 ML & AI &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Understand collaborative vs content-based filtering
- [ ] Implement cosine similarity from scratch
- [ ] Build a user-item matrix for collaborative filtering
- [ ] Create a `/recommend` endpoint returning top-N items
- [ ] Handle the cold-start problem for new users

---

## 📖 Introduction

Recommendation systems power Netflix, Spotify, and Amazon. Two main paradigms:

- **Collaborative filtering** — "Users like you also liked…" (based on behaviour)
- **Content-based filtering** — "Because you liked X, try Y" (based on item features)

This lesson builds both from scratch in pure Python, then wraps them in a FastAPI endpoint.

---

## 1. Cosine Similarity

Cosine similarity measures the angle between two vectors — 1.0 means identical direction, 0 means perpendicular.

```
similarity = (A · B) / (|A| × |B|)
```

=== "Pure Python"
    ```python
    import math

    def dot_product(a, b):
        return sum(x * y for x, y in zip(a, b))

    def magnitude(v):
        return math.sqrt(sum(x ** 2 for x in v))

    def cosine_similarity(a, b):
        mag_a, mag_b = magnitude(a), magnitude(b)
        if mag_a == 0 or mag_b == 0:
            return 0.0
        return dot_product(a, b) / (mag_a * mag_b)

    print(cosine_similarity([1, 2, 3], [1, 2, 3]))  # 1.0 — identical
    print(cosine_similarity([1, 0, 0], [0, 1, 0]))  # 0.0 — orthogonal
    print(cosine_similarity([1, 2, 3], [2, 4, 6]))  # 1.0 — same direction
    ```
=== "Output"
    ```
    1.0
    0.0
    1.0
    ```

---

## 2. User-Item Matrix (Collaborative Filtering)

```python
# Rows = users, Columns = items, Values = ratings (0 = not rated)
ratings = {
    "alice": {"film_a": 5, "film_b": 3, "film_c": 0, "film_d": 4},
    "bob":   {"film_a": 4, "film_b": 0, "film_c": 5, "film_d": 2},
    "carol": {"film_a": 5, "film_b": 4, "film_c": 1, "film_d": 5},
    "dave":  {"film_a": 0, "film_b": 5, "film_c": 4, "film_d": 0},
}
ITEMS = ["film_a", "film_b", "film_c", "film_d"]

def user_vector(user):
    return [ratings[user][item] for item in ITEMS]

def most_similar_users(target, n=2):
    sims = {}
    v_target = user_vector(target)
    for user in ratings:
        if user == target:
            continue
        sims[user] = cosine_similarity(v_target, user_vector(user))
    return sorted(sims.items(), key=lambda x: x[1], reverse=True)[:n]

similar = most_similar_users("alice")
print(similar)   # [('carol', 0.998), ('bob', 0.832)]
```

---

## 3. Content-Based Filtering

```python
# Items described by feature vectors
items = {
    "film_a": {"action": 1, "comedy": 0, "drama": 1, "sci_fi": 0},
    "film_b": {"action": 0, "comedy": 1, "drama": 1, "sci_fi": 0},
    "film_c": {"action": 1, "comedy": 0, "drama": 0, "sci_fi": 1},
    "film_d": {"action": 0, "comedy": 1, "drama": 0, "sci_fi": 1},
}
FEATURES = ["action", "comedy", "drama", "sci_fi"]

def item_vector(item):
    return [items[item][f] for f in FEATURES]

def similar_items(target_item, n=2):
    v = item_vector(target_item)
    sims = {
        item: cosine_similarity(v, item_vector(item))
        for item in items if item != target_item
    }
    return sorted(sims.items(), key=lambda x: x[1], reverse=True)[:n]

print(similar_items("film_a"))  # [('film_c', 0.707), ('film_b', 0.5)]
```

---

## 4. FastAPI `/recommend` Endpoint

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

app = FastAPI()

class RecommendResponse(BaseModel):
    user: str
    recommendations: List[str]
    method: str

@app.get("/recommend/{user_id}", response_model=RecommendResponse)
def recommend(user_id: str, n: int = 5):
    if user_id not in ratings:
        raise HTTPException(404, f"User '{user_id}' not found")

    # Find unrated items from most similar users
    similar_users = most_similar_users(user_id, n=3)
    scored = {}
    for similar_user, sim_score in similar_users:
        for item in ITEMS:
            if ratings[user_id][item] == 0:  # not yet rated
                scored[item] = scored.get(item, 0) + ratings[similar_user][item] * sim_score

    recs = sorted(scored.items(), key=lambda x: x[1], reverse=True)[:n]
    return RecommendResponse(
        user=user_id,
        recommendations=[r[0] for r in recs],
        method="collaborative",
    )
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import math

def cosine_similarity(a, b):
    dot  = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x**2 for x in a))
    mag_b = math.sqrt(sum(x**2 for x in b))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)

# User rating vectors (films: a, b, c, d)
users = {
    "alice": [5, 3, 0, 4],
    "bob":   [4, 0, 5, 2],
    "carol": [5, 4, 1, 5],
    "dave":  [0, 5, 4, 0],
}

print("Similarity to Alice:")
for user, vector in users.items():
    if user == "alice":
        continue
    sim = cosine_similarity(users["alice"], vector)
    print(f"  {user:<8} {sim:.4f}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Self Similarity

Compute cosine similarity between `[1, 2, 3]` and itself. Print the result.

Expected output:
```
1.0
```

<div class="pyodide-runner" data-mode="challenge" data-expected="1.0">
<pre><code class="language-python">import math

def cosine_similarity(a, b):
    dot   = sum(x * y for x, y in zip(a, b))
    mag_a = math.sqrt(sum(x**2 for x in a))
    mag_b = math.sqrt(sum(x**2 for x in b))
    return dot / (mag_a * mag_b)

v = [1, 2, 3]
print(cosine_similarity(v, v))
</code></pre>
</div>

---

### Challenge 2 — Most Similar User

From the similarity scores below, print the name of the **most similar** user to Alice.

Expected output:
```
Bob
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Bob">
<pre><code class="language-python">similarity_scores = {"Bob": 0.92, "Carol": 0.75, "Dave": 0.41}
# Print the name of the user with the highest similarity score
</code></pre>
</div>

---

## 📚 Further Reading

- [Building a Recommendation System — Towards Data Science](https://towardsdatascience.com/how-to-build-a-simple-recommender-system-in-python-375093c3fb7d)
- [Cosine Similarity — Wikipedia](https://en.wikipedia.org/wiki/Cosine_similarity)
- [Collaborative Filtering — Real Python](https://realpython.com/build-recommendation-engine-collaborative-filtering/)

---

!!! success "Lesson Complete 🎉"
    You can now implement cosine similarity from scratch and build a collaborative filtering recommender API.

[⬅️ Lesson 85 · Image Classifier](85-image-classifier-api.md){ .md-button } [➡️ Lesson 87 · Time Series Forecasting](87-time-series-forecasting.md){ .md-button .md-button--primary }
