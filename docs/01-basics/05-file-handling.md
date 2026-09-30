---
title: "Lesson 5 · File Handling"
description: "Read and write text files, CSV files, and JSON files using Python's built-in tools."
---

# Lesson 5 · File Handling

> **Section:** 🧱 Python Basics &nbsp;|&nbsp; **Difficulty:** ⭐⭐☆☆☆ &nbsp;|&nbsp; **Time:** ~45 minutes

---

## 🎯 Learning Objectives

- [ ] Open, read, and write text files with `open()`
- [ ] Use the `with` statement for safe file handling
- [ ] Read and write CSV files with the `csv` module
- [ ] Work with JSON files using the `json` module
- [ ] Navigate file paths with `pathlib`

---

## 📖 Introduction

Almost every real application needs to read from or write to files — configuration, data exports, logs, and more. Python makes this straightforward with built-in tools.

---

## 1. Opening Files with `open()`

| Mode | Meaning |
|------|---------|
| `"r"` | Read (default) |
| `"w"` | Write (overwrites existing) |
| `"a"` | Append (adds to end) |
| `"x"` | Create new (fails if exists) |
| `"rb"` / `"wb"` | Binary read/write |

Always use the `with` statement — it guarantees the file is closed even if an error occurs.

=== "Writing"
    ```python
    with open("greeting.txt", "w", encoding="utf-8") as f:
        f.write("Hello, World!\n")
        f.write("Python file handling is easy.\n")
    print("File written.")
    ```
=== "Reading (all at once)"
    ```python
    with open("greeting.txt", "r", encoding="utf-8") as f:
        content = f.read()
    print(content)
    ```
=== "Reading line by line"
    ```python
    with open("greeting.txt", "r", encoding="utf-8") as f:
        for i, line in enumerate(f, start=1):
            print(f"Line {i}: {line.rstrip()}")
    ```
=== "Appending"
    ```python
    with open("greeting.txt", "a", encoding="utf-8") as f:
        f.write("Appended line.\n")
    ```

!!! warning "Always specify encoding"
    Always pass `encoding="utf-8"` to avoid platform-specific encoding bugs.

---

## 2. Working with CSV Files

CSV (Comma-Separated Values) is the most common data exchange format.

=== "Writing CSV"
    ```python
    import csv

    students = [
        ["Alice", 92, "A"],
        ["Bob",   78, "C"],
        ["Carol", 85, "B"],
    ]

    with open("students.csv", "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Name", "Score", "Grade"])  # header
        writer.writerows(students)
    print("CSV written.")
    ```
=== "Reading CSV"
    ```python
    import csv

    with open("students.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            print(f"{row['Name']}: {row['Score']} ({row['Grade']})")
    ```

!!! tip "Use `DictReader` for readable code"
    `csv.DictReader` gives you each row as a dictionary keyed by the header row — much more readable than index-based access.

---

## 3. Working with JSON Files

JSON is the standard format for APIs and configuration files.

=== "Writing JSON"
    ```python
    import json

    config = {
        "host": "localhost",
        "port": 5000,
        "debug": True,
        "allowed_origins": ["http://localhost:3000"]
    }

    with open("config.json", "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    print("JSON written.")
    ```
=== "Reading JSON"
    ```python
    import json

    with open("config.json", "r", encoding="utf-8") as f:
        config = json.load(f)

    print(f"Host: {config['host']}")
    print(f"Port: {config['port']}")
    print(f"Debug: {config['debug']}")
    ```
=== "JSON string conversion"
    ```python
    import json

    # dict → JSON string
    data = {"name": "Alice", "scores": [90, 85, 92]}
    json_str = json.dumps(data, indent=2)
    print(json_str)

    # JSON string → dict
    parsed = json.loads(json_str)
    print(type(parsed), parsed["name"])
    ```

---

## 4. `pathlib` — Modern Path Handling

`pathlib.Path` is the modern, object-oriented way to work with file system paths.

```python
from pathlib import Path

# Create path objects
base = Path(".")
data_dir = base / "data"         # / operator joins paths
file_path = data_dir / "out.txt"

# Create directory if needed
data_dir.mkdir(exist_ok=True)

# Write and read
file_path.write_text("Hello from pathlib!\n", encoding="utf-8")
print(file_path.read_text(encoding="utf-8"))

# Inspect paths
print(file_path.name)      # out.txt
print(file_path.stem)      # out
print(file_path.suffix)    # .txt
print(file_path.exists())  # True
print(file_path.stat().st_size)  # size in bytes

# List all .txt files in a directory
for txt in base.glob("*.txt"):
    print(txt)
```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import json

# Simulate reading/writing JSON in memory
data = {
    "students": [
        {"name": "Alice", "grade": 92},
        {"name": "Bob",   "grade": 78},
        {"name": "Carol", "grade": 85},
    ]
}

# Serialise
json_str = json.dumps(data, indent=2)
print("JSON output:")
print(json_str)

# Parse back and compute average
parsed = json.loads(json_str)
grades = [s["grade"] for s in parsed["students"]]
avg = sum(grades) / len(grades)
print(f"\nAverage grade: {avg:.1f}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — JSON Round-Trip

Create a dictionary with your name, age, and a list of 3 hobbies. Serialize it to a JSON string, parse it back, then print the first hobby.

Expected output (example):
```
First hobby: reading
```

<div class="pyodide-runner" data-mode="challenge" data-expected="First hobby: reading">
<pre><code class="language-python">import json

person = {
    "name": "Alice",
    "age": 25,
    "hobbies": ["reading", "coding", "hiking"]
}

# Serialize to JSON string, parse back, print first hobby
</code></pre>
</div>

---

## 📚 Further Reading

- [Reading and Writing Files (docs.python.org)](https://docs.python.org/3/tutorial/inputoutput.html#reading-and-writing-files)
- [csv module (docs.python.org)](https://docs.python.org/3/library/csv.html)
- [json module (docs.python.org)](https://docs.python.org/3/library/json.html)
- [pathlib — Real Python](https://realpython.com/python-pathlib/)

---

!!! success "Lesson Complete 🎉"
    You can now read, write, and process text, CSV, and JSON files — essential for every real application.

[⬅️ Lesson 4 · Functions & Modules](04-functions-and-modules.md){ .md-button } [➡️ Lesson 6 · Exception Handling](06-exception-handling.md){ .md-button .md-button--primary }
