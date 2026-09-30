---
title: "Lesson 27 · Image Upload API"
description: "Handle file uploads in Flask, validate extensions, generate unique filenames with UUID, enforce size limits, serve static files, and return image URLs."
---

# Lesson 27 · Image Upload API

> **Section:** 🌐 Real-World API Projects &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Receive file uploads in Flask via `request.files`
- [ ] Validate allowed file extensions (`.jpg`, `.png`, `.gif`, `.webp`)
- [ ] Generate unique, collision-free filenames using `uuid`
- [ ] Enforce a maximum file size and return a `413` error if exceeded
- [ ] Serve uploaded files as static assets and return a public URL

---

## 📖 Introduction

File uploads are a common requirement — profile photos, document attachments, product images. The core challenges are security (only allow safe file types), uniqueness (avoid filename collisions), and size limits (protect server storage). This lesson covers all three, plus the full Flask route implementation.

!!! info "Browser demo uses simulation"
    File I/O and Flask are not available in Pyodide. All examples demonstrate the logic (extension checking, filename generation, size validation) using Python's standard library so you can follow along in the browser.

---

## 1. Validating File Extensions

Never trust the client-supplied filename extension. Check it server-side:

=== "Python"
    ```python
    import os

    ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}

    def allowed_extension(filename: str) -> bool:
        """Return True if the file extension is in the allowed set."""
        if "." not in filename:
            return False
        ext = filename.rsplit(".", 1)[1].lower()
        return ext in ALLOWED_EXTENSIONS

    test_files = [
        "photo.jpg",      # ✅
        "image.PNG",      # ✅ (lowercased)
        "document.pdf",   # ❌
        "script.php",     # ❌ dangerous!
        "noextension",    # ❌
        "avatar.webp",    # ✅
    ]

    for f in test_files:
        status = "✅" if allowed_extension(f) else "❌"
        print(f"{status} {f}")
    ```
=== "Output"
    ```
    ✅ photo.jpg
    ✅ image.PNG
    ❌ document.pdf
    ❌ script.php
    ❌ noextension
    ✅ avatar.webp
    ```

!!! warning "Do not trust the MIME type from the client"
    A malicious user can send a PHP file with `Content-Type: image/jpeg`. Always check the extension server-side, and for stronger security use the `python-magic` library to inspect the actual file bytes.

---

## 2. Generating Unique Filenames with UUID

=== "Python"
    ```python
    import uuid
    import os

    def secure_filename_with_uuid(original_filename: str) -> str:
        """Generate a safe, unique filename preserving the extension."""
        if "." not in original_filename:
            raise ValueError("No file extension found")
        ext = original_filename.rsplit(".", 1)[1].lower()
        unique_name = f"{uuid.uuid4().hex}.{ext}"
        return unique_name

    originals = ["My Photo!.jpg", "Holiday (2024).PNG", "profile pic.jpeg"]
    for name in originals:
        safe = secure_filename_with_uuid(name)
        print(f"Original: {name:25}  →  {safe}")
    ```
=== "Output"
    ```
    Original: My Photo!.jpg              →  3f7a1c8b2e4d9a0f5b6c.jpg
    Original: Holiday (2024).PNG         →  8d2e5c9f1a3b7e4d0c6f.png
    Original: profile pic.jpeg           →  1a9c4f7d2b8e5a3c0d9f.jpeg
    ```

!!! tip "Why UUIDs?"
    UUID4 generates a random 128-bit value — the probability of a collision across a billion uploads is astronomically low. It also makes filenames completely opaque, preventing users from guessing others' files.

---

## 3. Slugifying Filenames (Keeping the Original Name)

Sometimes you want to keep the human-readable name. Slug it to make it URL-safe:

=== "Python"
    ```python
    import re, uuid

    def slugify(text: str) -> str:
        """Convert a string to a URL-safe slug."""
        text = text.lower()
        text = re.sub(r"[^\w\s-]", "", text)   # remove non-word chars
        text = re.sub(r"[\s_-]+", "-", text)    # replace spaces/underscores
        text = text.strip("-")
        return text

    def build_filename(original: str) -> str:
        name, ext = original.rsplit(".", 1)
        slug  = slugify(name)
        short = uuid.uuid4().hex[:8]            # 8-char prefix for uniqueness
        return f"{short}-{slug}.{ext.lower()}"

    examples = ["My Photo!.jpg", "Hello World.jpeg", "Profile Pic 2024.PNG"]
    for name in examples:
        print(build_filename(name))
    ```
=== "Output"
    ```
    3f7a1c8b-my-photo.jpg
    8d2e5c9f-hello-world.jpeg
    1a9c4f7d-profile-pic-2024.png
    ```

---

## 4. File Size Limits

=== "Python"
    ```python
    MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024   # 5 MB

    def check_size(file_bytes: bytes) -> dict:
        size = len(file_bytes)
        if size > MAX_FILE_SIZE_BYTES:
            return {
                "ok": False,
                "error": f"File too large: {size / 1024 / 1024:.1f} MB (max 5 MB)",
                "status": 413,
            }
        return {"ok": True, "size_kb": round(size / 1024, 1), "status": 200}

    # Simulate files of different sizes
    small  = b"x" * (2 * 1024 * 1024)       # 2 MB
    large  = b"x" * (8 * 1024 * 1024)       # 8 MB

    print(check_size(small))
    print(check_size(large))
    ```
=== "Output"
    ```
    {'ok': True, 'size_kb': 2048.0, 'status': 200}
    {'ok': False, 'error': 'File too large: 8.0 MB (max 5 MB)', 'status': 413}
    ```

!!! note "Flask's `MAX_CONTENT_LENGTH`"
    In a real Flask app set `app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024`. Flask will automatically return a `413 Request Entity Too Large` before your route handler even runs.

---

## 5. The Full Upload Endpoint (Flask Pattern)

=== "Python"
    ```python
    # This shows the Flask pattern — does not run in Pyodide
    # from flask import Flask, request, jsonify
    # import os, uuid

    UPLOAD_FOLDER    = "uploads/"
    ALLOWED          = {"jpg", "jpeg", "png", "gif", "webp"}
    MAX_SIZE         = 5 * 1024 * 1024
    BASE_URL         = "https://api.example.com/static/uploads"

    def handle_upload(filename: str, file_bytes: bytes) -> dict:
        """Simulate the upload route logic."""
        # 1. Validate extension
        if "." not in filename or filename.rsplit(".", 1)[1].lower() not in ALLOWED:
            return {"error": "File type not allowed", "status": 415}

        # 2. Check size
        if len(file_bytes) > MAX_SIZE:
            return {"error": "File too large", "status": 413}

        # 3. Generate safe filename
        ext       = filename.rsplit(".", 1)[1].lower()
        safe_name = f"{uuid.uuid4().hex}.{ext}"

        # 4. (Would save to disk here)
        # filepath = os.path.join(UPLOAD_FOLDER, safe_name)
        # with open(filepath, "wb") as f:
        #     f.write(file_bytes)

        return {
            "filename": safe_name,
            "url":      f"{BASE_URL}/{safe_name}",
            "size_kb":  round(len(file_bytes) / 1024, 1),
            "status":   201,
        }

    import uuid
    result = handle_upload("avatar.jpg", b"x" * 102400)   # 100 KB
    print(result["url"])
    print(result["size_kb"], "KB")
    ```
=== "Output"
    ```
    https://api.example.com/static/uploads/3f7a1c8b2e4d9a0f5b6c.jpg
    100.0 KB
    ```

---

## 💻 Try It Yourself

Simulate filename sanitization — take `"My Photo!.jpg"`, slugify it, add a UUID prefix, and print the result:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import re, uuid

def slugify(text):
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")

def build_filename(original):
    name, ext = original.rsplit(".", 1)
    slug  = slugify(name)
    short = uuid.uuid4().hex[:8]
    return f"{short}-{slug}.{ext.lower()}"

filename = build_filename("My Photo!.jpg")
print(filename)
print("Has UUID prefix:", len(filename.split("-")[0]) == 8)
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Validate Extension

Check that `"photo.PNG"` is an allowed image extension and print `True`.

<div class="pyodide-runner" data-mode="challenge" data-expected="True">
<pre><code class="language-python">ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}

filename = "photo.PNG"

# Check if filename has an allowed extension and print True or False
</code></pre>
</div>

---

### Challenge 2 — Safe Filename Format Check

Generate a safe filename from `"Hello World.jpeg"` and print `"valid"` if it ends with `.jpeg` and contains a `-` separator.

<div class="pyodide-runner" data-mode="challenge" data-expected="valid">
<pre><code class="language-python">import re, uuid

def build_filename(original):
    name, ext = original.rsplit(".", 1)
    text = name.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text).strip("-")
    short = uuid.uuid4().hex[:8]
    return f"{short}-{text}.{ext.lower()}"

filename = build_filename("Hello World.jpeg")

# Print "valid" if filename ends with ".jpeg" and contains "-"
</code></pre>
</div>

---

## 📚 Further Reading

- [Flask Uploading Files — Official Docs](https://flask.palletsprojects.com/en/3.0.x/patterns/fileuploads/)
- [UUID Module — Python Docs](https://docs.python.org/3/library/uuid.html)
- [OWASP — File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)

---

!!! success "Lesson Complete 🎉"
    You can now validate file types, generate safe unique filenames, enforce size limits, and structure a production-ready upload endpoint.

[⬅️ Lesson 26 · Notes API with Auth](26-notes-api-auth.md){ .md-button } [➡️ Lesson 28 · Email Sender Service](28-email-sender.md){ .md-button .md-button--primary }
