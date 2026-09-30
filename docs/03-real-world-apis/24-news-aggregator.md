---
title: "Lesson 24 · News Aggregator API"
description: "Fetch news headlines by topic and country, parse article data, sort by date, deduplicate, and build a /news endpoint with search functionality."
---

# Lesson 24 · News Aggregator API

> **Section:** 🌐 Real-World API Projects &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain how News API (newsapi.org) structures its response
- [ ] Parse article fields: `title`, `author`, `publishedAt`, `url`
- [ ] Sort articles by publication date (newest first)
- [ ] Deduplicate articles by URL to avoid repeats
- [ ] Build a `/news` endpoint that supports a keyword search parameter

---

## 📖 Introduction

News aggregation is a great real-world project: it combines HTTP fetching, JSON parsing, filtering, sorting, and search in one place. The **News API** (newsapi.org) returns up to 100 articles per request in a consistent JSON format. In this lesson we'll model that format with mock data and build a small but production-quality aggregator.

!!! info "Free tier limits"
    The News API free tier allows 100 requests/day and delays articles by 24 hours. For higher volume, use the paid plan or consider RSS feeds as a free alternative.

---

## 1. Understanding the News API Response

A successful response from News API looks like this:

=== "Python"
    ```python
    mock_api_response = {
        "status": "ok",
        "totalResults": 3,
        "articles": [
            {
                "title":       "Python 3.13 Released",
                "author":      "Jane Smith",
                "publishedAt": "2024-11-15T10:00:00Z",
                "url":         "https://example.com/python-313",
                "source":      {"name": "TechNews"},
                "description": "The latest Python release brings major speed improvements.",
            },
            {
                "title":       "Top Python Frameworks in 2024",
                "author":      "John Doe",
                "publishedAt": "2024-11-14T08:30:00Z",
                "url":         "https://example.com/python-frameworks",
                "source":      {"name": "DevBlog"},
                "description": "A roundup of popular Python web frameworks.",
            },
        ]
    }

    for article in mock_api_response["articles"]:
        print(f"[{article['publishedAt'][:10]}] {article['title']}")
        print(f"  By {article['author']} — {article['source']['name']}")
    ```
=== "Output"
    ```
    [2024-11-15] Python 3.13 Released
      By Jane Smith — TechNews
    [2024-11-14] Top Python Frameworks in 2024
      By John Doe — DevBlog
    ```

!!! tip "Use `publishedAt[:10]` for dates"
    `publishedAt` is an ISO 8601 timestamp. Slicing the first 10 characters gives a clean `YYYY-MM-DD` date string — no `datetime` import needed for display.

---

## 2. Sorting Articles by Date

ISO 8601 timestamps sort correctly as plain strings:

=== "Python"
    ```python
    articles = [
        {"title": "Article C", "publishedAt": "2024-11-10T09:00:00Z"},
        {"title": "Article A", "publishedAt": "2024-11-15T10:00:00Z"},
        {"title": "Article B", "publishedAt": "2024-11-12T14:30:00Z"},
        {"title": "Article D", "publishedAt": "2024-11-08T07:00:00Z"},
    ]

    sorted_articles = sorted(articles,
                             key=lambda a: a["publishedAt"],
                             reverse=True)   # newest first

    print("Sorted (newest first):")
    for a in sorted_articles:
        print(f"  {a['publishedAt'][:10]}  {a['title']}")
    ```
=== "Output"
    ```
    Sorted (newest first):
      2024-11-15  Article A
      2024-11-12  Article B
      2024-11-10  Article C
      2024-11-08  Article D
    ```

---

## 3. Deduplication by URL

News APIs sometimes return the same article from different sources. Deduplicate by URL:

=== "Python"
    ```python
    def deduplicate(articles: list) -> list:
        """Remove duplicate articles, keeping only the first occurrence per URL."""
        seen = set()
        unique = []
        for article in articles:
            url = article.get("url", "")
            if url and url not in seen:
                seen.add(url)
                unique.append(article)
        return unique

    raw = [
        {"title": "Python News",   "url": "https://example.com/a"},
        {"title": "Python Update", "url": "https://example.com/b"},
        {"title": "Python News",   "url": "https://example.com/a"},  # duplicate
    ]

    clean = deduplicate(raw)
    print(f"Before: {len(raw)}  After: {len(clean)}")
    for a in clean:
        print(f"  {a['title']}")
    ```
=== "Output"
    ```
    Before: 3  After: 2
      Python News
      Python Update
    ```

!!! warning "Don't deduplicate on title alone"
    The same story may have different titles on different sites. URL is the most reliable deduplication key.

---

## 4. Keyword Search in Articles

=== "Python"
    ```python
    def search_articles(articles: list, query: str) -> list:
        """Filter articles whose title or description contains the query."""
        q = query.lower()
        return [
            a for a in articles
            if q in a.get("title", "").lower()
            or q in a.get("description", "").lower()
        ]

    articles = [
        {"title": "Python 3.13 Released",         "description": "Speed improvements in CPython."},
        {"title": "Top Python Frameworks 2024",    "description": "Flask, Django, FastAPI comparison."},
        {"title": "JavaScript Trends in 2024",     "description": "Node.js and React updates."},
        {"title": "Learn Python Data Science",     "description": "NumPy, Pandas, and Matplotlib."},
    ]

    results = search_articles(articles, "python")
    print(f"Found {len(results)} articles for 'python':")
    for a in results:
        print(f"  {a['title']}")
    ```
=== "Output"
    ```
    Found 3 articles for 'python':
      Python 3.13 Released
      Top Python Frameworks 2024
      Learn Python Data Science
    ```

---

## 5. Building the `/news` Endpoint

=== "Python"
    ```python
    ARTICLES = [
        {"title": "Python 3.13 Released",      "author": "Jane Smith",  "publishedAt": "2024-11-15T10:00:00Z", "url": "https://example.com/1"},
        {"title": "Top Python Frameworks",     "author": "John Doe",    "publishedAt": "2024-11-14T08:30:00Z", "url": "https://example.com/2"},
        {"title": "JavaScript vs Python",      "author": "Alice Brown",  "publishedAt": "2024-11-13T12:00:00Z", "url": "https://example.com/3"},
        {"title": "Python for Data Science",   "author": "Jane Smith",  "publishedAt": "2024-11-12T09:00:00Z", "url": "https://example.com/4"},
    ]

    def handle_news(params: dict) -> dict:
        query   = params.get("q", "")
        limit   = int(params.get("limit", 10))
        results = ARTICLES

        if query:
            q = query.lower()
            results = [a for a in results if q in a["title"].lower()]

        results = sorted(results, key=lambda a: a["publishedAt"], reverse=True)
        results = results[:limit]

        return {"status": "ok", "count": len(results), "articles": results}

    resp = handle_news({"q": "python", "limit": 3})
    print(f"Results: {resp['count']}")
    for a in resp["articles"]:
        print(f"  {a['publishedAt'][:10]}  {a['title']}")
    ```
=== "Output"
    ```
    Results: 3
      2024-11-15  Python 3.13 Released
      2024-11-14  Top Python Frameworks
      2024-11-12  Python for Data Science
    ```

---

## 💻 Try It Yourself

Print the top 3 article titles from a mock list, sorted by date (newest first):

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">articles = [
    {"title": "Python Wins Language of the Year", "author": "Jane Smith",  "publishedAt": "2024-11-15T10:00:00Z"},
    {"title": "FastAPI 1.0 Launches",             "author": "Bob Lee",     "publishedAt": "2024-11-10T08:00:00Z"},
    {"title": "Top Python Frameworks 2024",       "author": "Alice Wang",  "publishedAt": "2024-11-13T12:00:00Z"},
    {"title": "Python vs JavaScript in 2024",     "author": "Carol James", "publishedAt": "2024-11-08T07:30:00Z"},
]

sorted_articles = sorted(articles, key=lambda a: a["publishedAt"], reverse=True)

print("Top 3 Articles:")
for a in sorted_articles[:3]:
    print(f"  [{a['publishedAt'][:10]}] {a['title']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count Python Articles

Filter articles whose title contains `"Python"` and print the count.

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">articles = [
    {"title": "Python 3.13 Released",    "publishedAt": "2024-11-15T10:00:00Z"},
    {"title": "JavaScript ES2024 Guide", "publishedAt": "2024-11-14T09:00:00Z"},
    {"title": "Rust vs Python Speed",    "publishedAt": "2024-11-13T11:00:00Z"},
    {"title": "Go Language Update",      "publishedAt": "2024-11-12T08:00:00Z"},
]

# Filter articles with "Python" in the title and print the count
</code></pre>
</div>

---

### Challenge 2 — Author of the Most Recent Article

Print the author of the most recently published article.

<div class="pyodide-runner" data-mode="challenge" data-expected="Jane Smith">
<pre><code class="language-python">articles = [
    {"title": "Article A", "author": "Bob Lee",    "publishedAt": "2024-11-10T08:00:00Z"},
    {"title": "Article B", "author": "Jane Smith", "publishedAt": "2024-11-15T10:00:00Z"},
    {"title": "Article C", "author": "Alice Wang",  "publishedAt": "2024-11-12T12:00:00Z"},
]

# Find and print the author of the most recent article
</code></pre>
</div>

---

## 📚 Further Reading

- [News API Official Documentation](https://newsapi.org/docs)
- [Real Python — Working with JSON in Python](https://realpython.com/python-json/)
- [Python `datetime` for ISO 8601 Parsing](https://docs.python.org/3/library/datetime.html#datetime.datetime.fromisoformat)

---

!!! success "Lesson Complete 🎉"
    You can now fetch, parse, sort, deduplicate, and search news articles — building blocks for any content aggregation app.

[⬅️ Lesson 23 · Currency Converter](23-currency-converter.md){ .md-button } [➡️ Lesson 25 · Book Library API](25-book-library-api.md){ .md-button .md-button--primary }
