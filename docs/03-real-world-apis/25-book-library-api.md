---
title: "Lesson 25 · Book Library API"
description: "Design a book resource with full CRUD, search by author and title, ISBN validation, checkout/return availability tracking, and filtering."
---

# Lesson 25 · Book Library API

> **Section:** 🌐 Real-World API Projects &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Design a `Book` resource schema with id, title, author, isbn, year, and available fields
- [ ] Implement full CRUD operations on an in-memory book store
- [ ] Search books by author or title (case-insensitive)
- [ ] Validate ISBN-13 format with a check-digit algorithm
- [ ] Implement checkout and return operations with availability tracking

---

## 📖 Introduction

A library API is a practical project for modelling a domain resource with real business rules: ISBN validation, availability tracking, and constrained updates (you can't delete a checked-out book). It extends the basic CRUD pattern with domain logic that mirrors production applications.

!!! info "In-memory store"
    Books are stored in a plain dict. Checkout state is tracked with a boolean `available` field. In production you would add a `loans` table to track who has which book and when it is due back.

---

## 1. The Book Resource Schema

=== "Python"
    ```python
    def new_book(id_: str, title: str, author: str,
                 isbn: str, year: int) -> dict:
        return {
            "id":        id_,
            "title":     title,
            "author":    author,
            "isbn":      isbn,
            "year":      year,
            "available": True,       # True = on the shelf; False = checked out
        }

    library = {}

    books_data = [
        ("1", "1984",                  "George Orwell",  "978-0451524935", 1949),
        ("2", "Animal Farm",           "George Orwell",  "978-0451526342", 1945),
        ("3", "The Hobbit",            "J.R.R. Tolkien", "978-0618260300", 1937),
        ("4", "Brave New World",       "Aldous Huxley",  "978-0060850524", 1932),
        ("5", "Fahrenheit 451",        "Ray Bradbury",   "978-1451673319", 1953),
    ]

    for b in books_data:
        library[b[0]] = new_book(*b)

    print(f"Library contains {len(library)} books")
    for b in library.values():
        print(f"  [{b['id']}] {b['title']} — {b['author']} ({b['year']})")
    ```
=== "Output"
    ```
    Library contains 5 books
      [1] 1984 — George Orwell (1949)
      [2] Animal Farm — George Orwell (1945)
      [3] The Hobbit — J.R.R. Tolkien (1937)
      [4] Brave New World — Aldous Huxley (1932)
      [5] Fahrenheit 451 — Ray Bradbury (1953)
    ```

!!! tip "Use ISBN-13 for modern books"
    ISBN-10 is deprecated. Prefer ISBN-13 (`978-...`) for all new entries. Both have check-digit validation algorithms that let you catch typos before saving.

---

## 2. Search by Author and Title

=== "Python"
    ```python
    def search_books(library: dict, query: str,
                     field: str = "any") -> list:
        """Search books by title, author, or both (field='any')."""
        q = query.lower()
        results = []
        for book in library.values():
            title_match  = q in book["title"].lower()
            author_match = q in book["author"].lower()
            if field == "title" and title_match:
                results.append(book)
            elif field == "author" and author_match:
                results.append(book)
            elif field == "any" and (title_match or author_match):
                results.append(book)
        return results

    orwell_books = search_books(library, "orwell", field="author")
    print(f"Books by Orwell: {len(orwell_books)}")
    for b in orwell_books:
        print(f"  {b['title']} ({b['year']})")
    ```
=== "Output"
    ```
    Books by Orwell: 2
      1984 (1949)
      Animal Farm (1945)
    ```

---

## 3. ISBN-13 Validation

ISBN-13 uses a weighted check digit: multiply alternating digits by 1 and 3, sum them, and check the last digit makes the total a multiple of 10.

=== "Python"
    ```python
    def validate_isbn13(isbn: str) -> bool:
        """Validate an ISBN-13 number (with or without hyphens)."""
        digits = isbn.replace("-", "").replace(" ", "")
        if len(digits) != 13 or not digits.isdigit():
            return False
        total = sum(
            int(d) * (1 if i % 2 == 0 else 3)
            for i, d in enumerate(digits)
        )
        return total % 10 == 0

    test_cases = [
        ("978-0451524935", True),    # 1984 — valid
        ("978-0451524936", False),   # wrong check digit
        ("978-06182603",   False),   # too short
        ("978-0618260300", True),    # The Hobbit — valid
    ]

    for isbn, expected in test_cases:
        result = validate_isbn13(isbn)
        status = "✅" if result == expected else "❌"
        print(f"{status} {isbn}: {result}")
    ```
=== "Output"
    ```
    ✅ 978-0451524935: True
    ✅ 978-0451524936: False
    ✅ 978-06182603: False
    ✅ 978-0618260300: True
    ```

!!! warning "Always validate before saving"
    An invalid ISBN in your database creates silent data quality problems. Validate on the way in, not on the way out.

---

## 4. Checkout and Return

=== "Python"
    ```python
    def checkout(library: dict, book_id: str) -> dict:
        book = library.get(book_id)
        if not book:
            return {"success": False, "error": "Book not found"}
        if not book["available"]:
            return {"success": False, "error": "Book already checked out"}
        book["available"] = False
        return {"success": True, "book": book["title"]}

    def return_book(library: dict, book_id: str) -> dict:
        book = library.get(book_id)
        if not book:
            return {"success": False, "error": "Book not found"}
        if book["available"]:
            return {"success": False, "error": "Book is not checked out"}
        book["available"] = True
        return {"success": True, "book": book["title"]}

    # Check out "1984"
    result = checkout(library, "1")
    print(result)
    print("Available:", library["1"]["available"])

    # Try to check it out again
    print(checkout(library, "1"))

    # Return it
    print(return_book(library, "1"))
    ```
=== "Output"
    ```
    {'success': True, 'book': '1984'}
    Available: False
    {'success': False, 'error': 'Book already checked out'}
    {'success': True, 'book': '1984'}
    ```

---

## 5. Filtering Available Books

=== "Python"
    ```python
    def get_available(library: dict) -> list:
        return [b for b in library.values() if b["available"]]

    def get_checked_out(library: dict) -> list:
        return [b for b in library.values() if not b["available"]]

    # Check out two books
    library["1"]["available"] = False
    library["3"]["available"] = False

    available    = get_available(library)
    checked_out  = get_checked_out(library)

    print(f"Available   : {len(available)}")
    print(f"Checked out : {len(checked_out)}")
    for b in checked_out:
        print(f"  📖 {b['title']}")
    ```
=== "Output"
    ```
    Available   : 3
    Checked out : 2
      📖 1984
      📖 The Hobbit
    ```

!!! note "Extending to a loans system"
    In production, replace the boolean `available` field with a `loans` table that stores `(book_id, user_id, checked_out_at, due_date, returned_at)`. This lets you track history and send overdue reminders.

---

## 💻 Try It Yourself

Book library demo — search for a book and simulate a checkout:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">library = {
    "1": {"id": "1", "title": "1984",         "author": "George Orwell",  "available": True},
    "2": {"id": "2", "title": "Animal Farm",  "author": "George Orwell",  "available": True},
    "3": {"id": "3", "title": "The Hobbit",   "author": "J.R.R. Tolkien", "available": True},
}

def search_by_author(lib, author_query):
    q = author_query.lower()
    return [b for b in lib.values() if q in b["author"].lower()]

def checkout(lib, book_id):
    if book_id in lib and lib[book_id]["available"]:
        lib[book_id]["available"] = False
        return True
    return False

orwell = search_by_author(library, "orwell")
print(f"Found {len(orwell)} books by Orwell:")
for b in orwell:
    print(f"  {b['title']}")

checkout(library, "1")
print(f"\nAfter checkout — '1984' available: {library['1']['available']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count Orwell Books

Search the library for books by `"Orwell"` and print the count.

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">library = [
    {"title": "1984",          "author": "George Orwell"},
    {"title": "Animal Farm",   "author": "George Orwell"},
    {"title": "The Hobbit",    "author": "J.R.R. Tolkien"},
    {"title": "Fahrenheit 451","author": "Ray Bradbury"},
]

# Count books where the author contains "Orwell" and print the count
</code></pre>
</div>

---

### Challenge 2 — Check Out a Book

Set `available` to `False` for the book with id `"2"` and print its available status.

<div class="pyodide-runner" data-mode="challenge" data-expected="False">
<pre><code class="language-python">library = {
    "1": {"title": "1984",        "available": True},
    "2": {"title": "Animal Farm", "available": True},
    "3": {"title": "The Hobbit",  "available": True},
}

# Check out book "2" (set available to False) and print its available value
</code></pre>
</div>

---

## 📚 Further Reading

- [ISBN-13 Check Digit Algorithm (Wikipedia)](https://en.wikipedia.org/wiki/International_Standard_Book_Number#ISBN-13_check_digit_calculation)
- [RESTful API Design — Resources and Collections](https://restfulapi.net/resource-naming/)
- [Real Python — Flask REST API Tutorial](https://realpython.com/flask-connexion-rest-api/)

---

!!! success "Lesson Complete 🎉"
    You've built a fully featured book library API with ISBN validation, search, and checkout logic — a pattern directly applicable to any inventory or asset-tracking system.

[⬅️ Lesson 24 · News Aggregator](24-news-aggregator.md){ .md-button } [➡️ Lesson 26 · Notes API with Auth](26-notes-api-auth.md){ .md-button .md-button--primary }
