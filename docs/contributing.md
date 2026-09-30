---
title: Contributing
description: How to contribute lessons, code examples, and improvements to Practice Python for Beginners.
---

# Contributing to Practice Python for Beginners

Thank you for your interest in contributing! Every lesson, fix, and improvement makes this platform better for thousands of learners.

---

## 🚀 Quick Start (Local Development)

### Prerequisites

- Python 3.9+
- Git

### Setup

```bash
# 1. Fork and clone the repo
git clone https://github.com/YOUR-USERNAME/practice-python-for-beginners.github.io.git
cd practice-python-for-beginners.github.io

# 2. Create a virtual environment
python -m venv .venv
source .venv/bin/activate      # macOS/Linux
.venv\Scripts\activate         # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start local dev server
mkdocs serve
```

Open `http://127.0.0.1:8000` in your browser. The site live-reloads on every file save.

---

## 📝 Writing a Lesson

Each lesson is a Markdown file under `docs/<section>/`. Use the following structure:

```markdown
---
title: "Lesson N · Your Lesson Title"
description: "One-line description for SEO and nav tooltips."
---

# Lesson N · Your Lesson Title

> **Section:** Section Name &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆

## 🎯 Learning Objectives
- What the learner will be able to do after this lesson

## 📖 Introduction
Narrative explanation...

## 💻 Code Example
Use tabbed code blocks (see below)

## 🏋️ Challenge
Interactive challenge block (see below)

## 📚 Further Reading
- [Resource Name](URL)

---
[⬅️ Previous Lesson](prev.md){ .md-button } [➡️ Next Lesson](next.md){ .md-button .md-button--primary }
```

---

## 💡 Markdown Tips

### Tabbed Code with Output

````markdown
=== "Python"
    ```python
    name = "Alice"
    print(f"Hello, {name}!")
    ```
=== "Output"
    ```
    Hello, Alice!
    ```
````

### Admonitions

```markdown
!!! tip "Pro Tip"
    Use f-strings instead of `.format()` for readability.

!!! warning "Watch out"
    Python is case-sensitive. `Name` and `name` are different variables.

!!! note
    You can nest code blocks inside admonitions.
```

### Pyodide Live Runner

```html
<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">
print("Hello, World!")
</code></pre>
</div>
```

### Interactive Challenge

```html
<div class="pyodide-runner" data-mode="challenge" data-expected="Hello, World!">
<pre><code class="language-python">
# Write a print statement that outputs: Hello, World!
</code></pre>
</div>
```

---

## 🔁 Contribution Workflow

1. **Fork** the repo on GitHub
2. **Create a branch**: `git checkout -b lesson/42-securing-flask`
3. **Write your lesson** following the template above
4. **Preview locally** with `mkdocs serve`
5. **Open a Pull Request** against the `main` branch
6. A maintainer will review and merge

---

## ✅ Contribution Checklist

Before opening a PR, ensure:

- [ ] Lesson file is in the correct section folder with the correct filename (e.g. `42-securing-flask-apis.md`)
- [ ] Frontmatter `title` and `description` are filled in
- [ ] All 5 sections are present (Learning Objectives, Introduction, Code Example, Challenge, Further Reading)
- [ ] Code blocks are tested and working
- [ ] Prev/Next navigation buttons have correct relative paths
- [ ] `mkdocs build` runs without errors or warnings

---

## 🤝 Code of Conduct

Be kind, inclusive, and constructive. We welcome contributors of all skill levels. See [Contributor Covenant](https://www.contributor-covenant.org/) for the full code of conduct.
