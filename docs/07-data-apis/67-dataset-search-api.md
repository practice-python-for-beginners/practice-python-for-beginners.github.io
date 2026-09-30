---
title: "Lesson 67 · API for Dataset Search"
description: "Implement full-text search on a dataset using difflib, build relevance scoring, combine AND/OR filters, add pagination, highlight matched terms, and sort by relevance."
---

# Lesson 67 · API for Dataset Search

> **Section:** 📊 Data APIs, CSV/JSON Exports & Visualization &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Perform full-text search across a list of dicts using exact and substring matching
- [ ] Use `difflib.get_close_matches` and `SequenceMatcher` for fuzzy matching
- [ ] Assign relevance scores to search results
- [ ] Combine filter conditions with AND / OR logic
- [ ] Implement offset-based pagination on search results
- [ ] Highlight matching terms in a search result snippet

---

## 📖 Introduction

Search is one of the most common features in data APIs — from product catalogues to knowledge bases. For small to medium datasets (up to ~50 000 records) you can deliver excellent search performance with pure Python and no external search engine.

This lesson builds a full search function: match → score → filter → paginate → highlight.

!!! info "No extra installs needed"
    All examples use Python's stdlib `difflib` module. For production-scale search, consider Elasticsearch, MeiliSearch, or PostgreSQL full-text search.

---

## 1. Basic Full-Text Search

Start with a simple substring search across one or more fields:

=== "Python"
    ```python
    ARTICLES = [
        {"id": 1, "title": "Python Basics",        "tags": ["python", "beginner"]},
        {"id": 2, "title": "Advanced Python Tips",  "tags": ["python", "advanced"]},
        {"id": 3, "title": "JavaScript for Beginners", "tags": ["js", "beginner"]},
        {"id": 4, "title": "Data Science with Python", "tags": ["python", "data"]},
        {"id": 5, "title": "REST API Design",        "tags": ["api", "design"]},
    ]

    def search(query: str, dataset: list, fields: list[str]) -> list[dict]:
        q = query.lower()
        results = []
        for item in dataset:
            searchable = " ".join(str(item.get(f, "")) for f in fields).lower()
            if q in searchable:
                results.append(item)
        return results

    hits = search("python", ARTICLES, fields=["title", "tags"])
    for h in hits:
        print(h["id"], h["title"])
    ```
=== "Output"
    ```
    1 Python Basics
    2 Advanced Python Tips
    4 Data Science with Python
    ```

---

## 2. Relevance Scoring

Rank results by how many fields contain the query, and how prominently:

=== "Python"
    ```python
    def scored_search(query: str, dataset: list, fields: list[str]) -> list[dict]:
        q = query.lower()
        results = []

        for item in dataset:
            score = 0
            for field in fields:
                text = str(item.get(field, "")).lower()
                # Exact start of field → highest relevance
                if text.startswith(q):
                    score += 10
                # Exact word match → medium relevance
                elif f" {q} " in f" {text} ":
                    score += 5
                # Substring match → low relevance
                elif q in text:
                    score += 2

            if score > 0:
                results.append({**item, "_score": score})

        return sorted(results, key=lambda r: r["_score"], reverse=True)

    for r in scored_search("python", ARTICLES, ["title", "tags"]):
        print(f"[{r['_score']:2d}] {r['title']}")
    ```
=== "Output"
    ```
    [12] Python Basics
    [ 7] Advanced Python Tips
    [ 7] Data Science with Python
    ```

---

## 3. Fuzzy Matching with `difflib`

Fuzzy matching catches typos and near-matches:

=== "get_close_matches"
    ```python
    from difflib import get_close_matches

    topics = ["Python Basics", "Python Advanced", "JavaScript", "Data Science", "REST APIs"]

    def fuzzy_search(query: str, items: list[str], n=5, cutoff=0.5) -> list[str]:
        return get_close_matches(query, items, n=n, cutoff=cutoff)

    print(fuzzy_search("Phyton"))        # typo: ['Python Basics', 'Python Advanced']
    print(fuzzy_search("java script"))   # spaced: ['JavaScript']
    print(fuzzy_search("REST"))          # prefix: ['REST APIs']
    ```
=== "SequenceMatcher score"
    ```python
    from difflib import SequenceMatcher

    def similarity(a: str, b: str) -> float:
        return SequenceMatcher(None, a.lower(), b.lower()).ratio()

    titles = ["Python Basics", "Advanced Python", "JavaScript Basics", "Data Science"]
    query  = "python basics"

    ranked = sorted(titles, key=lambda t: similarity(query, t), reverse=True)
    for t in ranked:
        print(f"{similarity(query, t):.2f}  {t}")
    ```
=== "Output"
    ```
    1.00  Python Basics
    0.62  Advanced Python
    0.46  JavaScript Basics
    0.38  Data Science
    ```

| `difflib` function | Use case |
|---|---|
| `get_close_matches(w, possibilities)` | Fast fuzzy match — returns top-n strings |
| `SequenceMatcher(None, a, b).ratio()` | Numeric similarity 0.0–1.0 |
| `Differ().compare(a, b)` | Line-by-line diff |

---

## 4. Filter Combinations — AND / OR

=== "Python"
    ```python
    def filter_search(dataset, query=None, tags=None, mode="AND"):
        """
        mode="AND" → record must match ALL conditions
        mode="OR"  → record must match ANY condition
        """
        results = []
        for item in dataset:
            conditions = []

            if query:
                text = (item.get("title", "") + " " +
                        " ".join(item.get("tags", []))).lower()
                conditions.append(query.lower() in text)

            if tags:
                item_tags = set(item.get("tags", []))
                conditions.append(bool(item_tags & set(tags)))

            if not conditions:
                results.append(item)
            elif mode == "AND" and all(conditions):
                results.append(item)
            elif mode == "OR" and any(conditions):
                results.append(item)

        return results

    # AND: articles tagged "python" AND matching "basics"
    print(filter_search(ARTICLES, query="basics", tags=["python"], mode="AND"))
    # OR: articles tagged "python" OR matching "api"
    print(filter_search(ARTICLES, query="api", tags=["python"], mode="OR"))
    ```

---

## 5. Pagination and Highlighting

=== "Pagination"
    ```python
    def paginate(results: list, page: int = 1, per_page: int = 10) -> dict:
        total  = len(results)
        start  = (page - 1) * per_page
        end    = start + per_page
        return {
            "page":       page,
            "per_page":   per_page,
            "total":      total,
            "pages":      -(-total // per_page),  # ceiling division
            "results":    results[start:end],
        }

    all_results = scored_search("python", ARTICLES, ["title"])
    page1 = paginate(all_results, page=1, per_page=2)
    print(page1)
    ```
=== "Highlighting"
    ```python
    def highlight(text: str, query: str, tag="**") -> str:
        """Wrap every occurrence of query with tag markers."""
        import re
        pattern = re.compile(re.escape(query), re.IGNORECASE)
        return pattern.sub(lambda m: f"{tag}{m.group()}{tag}", text)

    print(highlight("Python Basics and Advanced Python", "python"))
    # **Python** Basics and Advanced **Python**
    ```

!!! tip "Flask search endpoint"
    ```python
    @app.get("/search")
    def search_endpoint():
        q    = request.args.get("q", "")
        page = int(request.args.get("page", 1))
        hits = scored_search(q, ARTICLES, ["title", "tags"])
        return jsonify(paginate(hits, page=page, per_page=5))
    ```

---

## 💻 Try It Yourself

Use `difflib.get_close_matches` to implement a simple search function.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">from difflib import get_close_matches, SequenceMatcher

topics = [
    "Python Basics",
    "Python Advanced",
    "JavaScript Fundamentals",
    "Data Science with Python",
    "REST API Design",
    "Machine Learning",
]

def search(query, items, cutoff=0.4):
    close = get_close_matches(query, items, n=5, cutoff=cutoff)
    # Also include exact substring matches not caught by fuzzy
    exact = [t for t in items if query.lower() in t.lower()]
    combined = list(dict.fromkeys(exact + close))  # deduplicate, preserve order
    return combined

print("Search 'python':", search("python", topics))
print("Search 'Phyton':", search("Phyton", topics))
print("Search 'API':",    search("API", topics))
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Match Count

Search for `"python"` (case-insensitive substring) in the titles list and print the count of matches.

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">topics = [
    "Python Basics",
    "JavaScript Tutorial",
    "Advanced Python",
    "REST API Design",
    "Data Engineering",
]

# Count how many titles contain "python" (case-insensitive) and print the count
</code></pre>
</div>

### Challenge 2 — Top Result

Rank titles by similarity to `"Python Basics"` using `SequenceMatcher` and print the title with the highest similarity score.

<div class="pyodide-runner" data-mode="challenge" data-expected="Python Basics">
<pre><code class="language-python">from difflib import SequenceMatcher

titles = [
    "JavaScript Tutorial",
    "Python Basics",
    "Advanced Python Techniques",
    "REST API Design",
]

query = "Python Basics"

# Rank by SequenceMatcher similarity and print the top result title
</code></pre>
</div>

---

## 📚 Further Reading

- [Python `difflib` documentation](https://docs.python.org/3/library/difflib.html)
- [Building a Simple Search Engine in Python](https://realpython.com/python-search-engines/)
- [MeiliSearch — Fast Search for Python Apps](https://www.meilisearch.com/docs/learn/getting_started/installation)

---

!!! success "Lesson Complete 🎉"
    You now have a fully functional dataset search API: exact match, fuzzy match with `difflib`, relevance scoring, AND/OR filters, pagination, and term highlighting — all in pure Python.

[⬅️ Lesson 66 · CSV Uploader API](66-csv-uploader-api.md){ .md-button } [➡️ Lesson 68 · JSON Report Generator](68-json-report-generator.md){ .md-button .md-button--primary }
