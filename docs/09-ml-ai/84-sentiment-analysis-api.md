---
title: "Lesson 84 · Sentiment Analysis API"
description: "Build a sentiment analysis REST API using rule-based methods and Hugging Face transformers."
---

# Lesson 84 · Sentiment Analysis API

> **Section:** 🧠 ML & AI &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

- [ ] Understand NLP preprocessing (tokenise, clean, vectorise)
- [ ] Implement a rule-based sentiment scorer
- [ ] Use Hugging Face `pipeline("sentiment-analysis")` for deep learning
- [ ] Build a `/sentiment` endpoint accepting text input
- [ ] Return confidence scores alongside labels

---

## 📖 Introduction

Sentiment analysis classifies text as positive, negative, or neutral. It powers product reviews, social media monitoring, and customer support routing. This lesson shows both a simple rule-based approach and a production-grade transformer model.

---

## 1. Rule-Based Sentiment

Simple but fast — great for small vocab or filtering before a heavier model.

=== "Python"
    ```python
    POSITIVE = {"great","amazing","excellent","good","fantastic","love","best"}
    NEGATIVE = {"bad","terrible","awful","horrible","poor","worst","hate"}

    def analyse(text):
        tokens = text.lower().split()
        pos = sum(1 for t in tokens if t.strip(".,!?") in POSITIVE)
        neg = sum(1 for t in tokens if t.strip(".,!?") in NEGATIVE)
        if pos > neg:   return "positive", pos, neg
        if neg > pos:   return "negative", pos, neg
        return "neutral", pos, neg

    label, pos, neg = analyse("This product is great and amazing!")
    print(f"Sentiment: {label}  (+{pos} / -{neg})")
    ```
=== "Output"
    ```
    Sentiment: positive  (+2 / -0)
    ```

---

## 2. Hugging Face Transformer Model

```python
from transformers import pipeline

# Load once at startup
sentiment_pipeline = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english",
)

result = sentiment_pipeline("I absolutely loved this restaurant!")
print(result)
# [{'label': 'POSITIVE', 'score': 0.9998}]

# Batch analysis
texts = [
    "The service was terrible.",
    "Best purchase I've ever made!",
    "It's okay, nothing special.",
]
results = sentiment_pipeline(texts)
for text, r in zip(texts, results):
    print(f"{r['label']:9s} ({r['score']:.2f})  {text[:40]}")
```

---

## 3. FastAPI `/sentiment` Endpoint

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()
# sentiment_pipeline loaded at startup via lifespan

class SentimentRequest(BaseModel):
    text: str
    model: str = "transformer"

@app.post("/sentiment")
def sentiment(body: SentimentRequest):
    if body.model == "rule":
        label, pos, neg = analyse(body.text)
        return {"label": label, "positive_words": pos, "negative_words": neg}
    result = sentiment_pipeline(body.text)[0]
    return {"label": result["label"].lower(), "score": round(result["score"], 4)}
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">POSITIVE_WORDS = {"great", "amazing", "excellent", "good",
                  "fantastic", "love", "best", "wonderful"}
NEGATIVE_WORDS = {"bad", "terrible", "awful", "horrible",
                  "poor", "worst", "hate", "dreadful"}

def analyse_sentiment(text):
    tokens = [t.strip(".,!?;:'\"").lower() for t in text.split()]
    pos = sum(1 for t in tokens if t in POSITIVE_WORDS)
    neg = sum(1 for t in tokens if t in NEGATIVE_WORDS)
    if pos > neg:
        return "positive", pos, neg
    elif neg > pos:
        return "negative", pos, neg
    return "neutral", pos, neg

reviews = [
    "This product is absolutely wonderful and fantastic!",
    "Terrible quality, awful customer service, I hate it.",
    "It arrived on time.",
    "Best purchase ever, I love it!",
]

for review in reviews:
    label, pos, neg = analyse_sentiment(review)
    print(f"[{label:9s}] +{pos}/-{neg}  {review[:45]}...")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count Positives

Count how many positive words from the set `{"great","amazing","wonderful","good"}` appear in `"This is great and amazing!"`.

Expected output:
```
2
```

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">POSITIVE = {"great", "amazing", "wonderful", "good"}
text = "This is great and amazing!"
# Count positive words in text and print
</code></pre>
</div>

---

### Challenge 2 — Overall Sentiment

Given a text that produces **3 positive** and **1 negative** keyword match, print the overall sentiment.

Expected output:
```
positive
```

<div class="pyodide-runner" data-mode="challenge" data-expected="positive">
<pre><code class="language-python">pos_count = 3
neg_count = 1

if pos_count > neg_count:
    print("positive")
elif neg_count > pos_count:
    print("negative")
else:
    print("neutral")
</code></pre>
</div>

---

## 📚 Further Reading

- [Hugging Face Sentiment Pipeline](https://huggingface.co/docs/transformers/main_classes/pipelines)
- [NLTK VADER Sentiment](https://www.nltk.org/api/nltk.sentiment.vader.html)
- [NLP with Python — Real Python](https://realpython.com/natural-language-processing-spacy-python/)

---

!!! success "Lesson Complete 🎉"
    Sentiment analysis is one of the most practical NLP tasks. You now know both rule-based and transformer approaches.

[⬅️ Lesson 83 · Deploy ML with FastAPI](83-deploy-ml-fastapi.md){ .md-button } [➡️ Lesson 85 · Image Classifier API](85-image-classifier-api.md){ .md-button .md-button--primary }
