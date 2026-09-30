---
title: "Lesson 85 · Image Classifier API"
description: "Build an image classification REST API using a pretrained CNN model — preprocessing, inference, and streaming results."
---

# Lesson 85 · Image Classifier API

> **Section:** 🧠 ML & AI &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐⭐⭐ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

- [ ] Understand CNN architecture basics (conv, pool, flatten, dense)
- [ ] Load a pretrained model (MobileNetV2) with TensorFlow/Keras
- [ ] Preprocess uploaded images for inference
- [ ] Build a `/classify` endpoint accepting image uploads
- [ ] Return top-N predictions with confidence scores

---

## 📖 Introduction

Image classification maps an input image to a category label. Pretrained CNNs like MobileNetV2 are trained on ImageNet's 1,000 categories and can be used as-is or fine-tuned. This lesson shows how to wrap one in a FastAPI endpoint.

---

## 1. Loading a Pretrained Model

```python
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications.mobilenet_v2 import (
    preprocess_input, decode_predictions
)
import numpy as np
from PIL import Image

# Load once at startup
model = MobileNetV2(weights="imagenet")
```

---

## 2. Image Preprocessing

Every pretrained model expects a specific input shape and pixel range.

=== "Python"
    ```python
    def preprocess_image(img_path: str, target_size=(224, 224)):
        img   = Image.open(img_path).convert("RGB")
        img   = img.resize(target_size)
        arr   = np.array(img, dtype=np.float32)
        arr   = np.expand_dims(arr, axis=0)          # add batch dim
        arr   = preprocess_input(arr)                 # scale to [-1, 1]
        return arr

    arr = preprocess_image("dog.jpg")
    print(arr.shape)   # (1, 224, 224, 3)
    ```
=== "Raw normalisation"
    ```python
    def normalise_pixels(pixel_values):
        """Scale 0-255 uint8 pixels to 0.0-1.0 float."""
        return [v / 255.0 for v in pixel_values]

    pixels = [0, 128, 255]
    print(normalise_pixels(pixels))  # [0.0, 0.5019..., 1.0]
    ```

---

## 3. FastAPI Classify Endpoint

```python
from fastapi import FastAPI, UploadFile, File
import io, numpy as np
from PIL import Image

app = FastAPI()

@app.post("/classify")
async def classify(file: UploadFile = File(...), top_n: int = 5):
    contents = await file.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB").resize((224, 224))
    arr = preprocess_input(np.expand_dims(np.array(img, dtype=np.float32), 0))

    preds = model.predict(arr)
    decoded = decode_predictions(preds, top=top_n)[0]

    return {
        "filename": file.filename,
        "predictions": [
            {"label": label, "description": desc, "confidence": round(float(score), 4)}
            for _, label, desc, score in [(None, *d) for d in decoded]  # unpack
        ]
    }
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">def normalise(pixel_values):
    """Normalise 0-255 pixels to 0.0-1.0."""
    return [v / 255.0 for v in pixel_values]

def argmax(values):
    """Return index of max value."""
    return values.index(max(values))

# Simulate a small image patch (3 pixels)
pixels = [0, 128, 255]
normed = normalise(pixels)
print("Normalised pixels:", [round(v, 4) for v in normed])

# Simulate model output probabilities for 3 classes
class_probs = [0.05, 0.90, 0.05]
top_class = argmax(class_probs)
class_names = ["cat", "dog", "bird"]
print(f"\nTop prediction: {class_names[top_class]} ({class_probs[top_class]*100:.1f}%)")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Normalise

Normalise the pixel value `128` from the range `0–255` to `0.0–1.0` and print the result.

Expected output:
```
0.5019607843137255
```

<div class="pyodide-runner" data-mode="challenge" data-expected="0.5019607843137255">
<pre><code class="language-python">pixel = 128
# Normalise from 0-255 to 0.0-1.0 and print
</code></pre>
</div>

---

### Challenge 2 — Argmax

Find the index of the maximum value in `[0.1, 0.7, 0.2]` and print it.

Expected output:
```
1
```

<div class="pyodide-runner" data-mode="challenge" data-expected="1">
<pre><code class="language-python">probs = [0.1, 0.7, 0.2]
# Print the index of the maximum value
</code></pre>
</div>

---

## 📚 Further Reading

- [Keras MobileNetV2](https://keras.io/api/applications/mobilenet/#mobilenetv2-function)
- [Image Classification — TensorFlow tutorial](https://www.tensorflow.org/tutorials/images/classification)
- [FastAPI File Uploads](https://fastapi.tiangolo.com/tutorial/request-files/)

---

!!! success "Lesson Complete 🎉"
    You can now wrap any image classification model in a FastAPI endpoint — extendable to object detection and segmentation.

[⬅️ Lesson 84 · Sentiment Analysis](84-sentiment-analysis-api.md){ .md-button } [➡️ Lesson 86 · Recommendation System](86-recommendation-system.md){ .md-button .md-button--primary }
