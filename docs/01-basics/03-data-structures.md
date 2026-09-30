---
title: "Lesson 3 · Data Structures"
description: "Learn Python's four built-in collection types: lists, tuples, sets, and dictionaries — with real-world examples and interactive exercises."
---

# Lesson 3 · Data Structures

> **Section:** 🧱 Python Basics &nbsp;|&nbsp; **Difficulty:** ⭐⭐☆☆☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

- [ ] Create and manipulate **lists** (ordered, mutable sequences)
- [ ] Use **tuples** for immutable ordered data
- [ ] Use **sets** for unique collections and set operations
- [ ] Use **dictionaries** to store key-value pairs
- [ ] Choose the right structure for the job

---

## 📖 Introduction

Python has four powerful built-in collection types. Knowing when to use each one is a core Python skill.

| Type | Ordered | Mutable | Duplicates | Syntax |
|------|---------|---------|------------|--------|
| `list` | ✅ | ✅ | ✅ | `[1, 2, 3]` |
| `tuple` | ✅ | ❌ | ✅ | `(1, 2, 3)` |
| `set` | ❌ | ✅ | ❌ | `{1, 2, 3}` |
| `dict` | ✅ (3.7+) | ✅ | keys: ❌ | `{"a": 1}` |

---

## 1. Lists

Lists are the workhorse of Python. They're ordered, mutable (changeable), and can hold any mix of types.

=== "Creating & Indexing"
    ```python
    fruits = ["apple", "banana", "cherry"]

    print(fruits[0])     # apple
    print(fruits[-1])    # cherry
    print(fruits[1:])    # ['banana', 'cherry']

    fruits[1] = "blueberry"
    print(fruits)        # ['apple', 'blueberry', 'cherry']
    ```
=== "Common Methods"
    ```python
    nums = [3, 1, 4, 1, 5, 9, 2, 6]

    nums.append(7)          # add to end
    nums.insert(0, 0)       # insert at index
    nums.remove(1)          # remove first occurrence of 1
    popped = nums.pop()     # remove & return last item
    nums.sort()             # sort in place
    nums.reverse()          # reverse in place

    print(nums)
    print(len(nums))        # length
    print(sum(nums))        # sum
    print(min(nums), max(nums))
    ```
=== "List Comprehensions"
    ```python
    # Traditional loop
    squares = []
    for i in range(1, 6):
        squares.append(i ** 2)

    # List comprehension — same result, one line
    squares = [i ** 2 for i in range(1, 6)]
    print(squares)           # [1, 4, 9, 16, 25]

    # With a condition
    evens = [i for i in range(20) if i % 2 == 0]
    print(evens)             # [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]
    ```

---

## 2. Tuples

Tuples are like lists but **immutable** — once created, they can't be changed. Use them for data that shouldn't be modified (coordinates, RGB colours, database rows).

```python
point = (3, 7)
rgb   = (255, 128, 0)
person = ("Alice", 30, "Engineer")

x, y = point          # tuple unpacking
name, age, job = person

print(f"x={x}, y={y}")
print(f"{name} is {age} and works as {job}")

# Tuples can be used as dict keys (lists cannot)
locations = {(40.7, -74.0): "New York", (51.5, -0.1): "London"}
print(locations[(40.7, -74.0)])
```

!!! info "When to use tuples vs lists"
    - **Tuple** → fixed collection, return multiple values from a function, dict keys
    - **List** → collection you'll modify (append, sort, remove)

---

## 3. Sets

Sets store **unique** values with no guaranteed order. Ideal for deduplication and set math.

=== "Python"
    ```python
    # Duplicate values are automatically removed
    tags = {"python", "flask", "python", "api", "flask"}
    print(tags)    # {'python', 'flask', 'api'} — unordered, unique

    a = {1, 2, 3, 4}
    b = {3, 4, 5, 6}

    print(a | b)   # union        {1, 2, 3, 4, 5, 6}
    print(a & b)   # intersection {3, 4}
    print(a - b)   # difference   {1, 2}
    print(a ^ b)   # symmetric diff {1, 2, 5, 6}
    print(3 in a)  # True
    ```
=== "Output"
    ```
    {'python', 'api', 'flask'}
    {1, 2, 3, 4, 5, 6}
    {3, 4}
    {1, 2}
    {1, 2, 5, 6}
    True
    ```

---

## 4. Dictionaries

Dictionaries store data as **key → value** pairs. Keys must be unique and immutable (strings, numbers, tuples).

=== "Basics"
    ```python
    student = {
        "name": "Alice",
        "age": 21,
        "grades": [88, 92, 79],
        "active": True
    }

    print(student["name"])              # Alice
    print(student.get("gpa", "N/A"))   # N/A — safe default

    student["gpa"] = 3.8               # add/update key
    del student["active"]              # delete key

    print(student.keys())
    print(student.values())
    print(student.items())             # list of (key, value) tuples
    ```
=== "Looping"
    ```python
    inventory = {"apple": 5, "banana": 12, "cherry": 3}

    for item, qty in inventory.items():
        status = "low" if qty < 5 else "ok"
        print(f"{item:<10} qty={qty:>3}  [{status}]")

    # Dict comprehension
    doubled = {k: v * 2 for k, v in inventory.items()}
    print(doubled)
    ```
=== "Nested dicts"
    ```python
    users = {
        "alice": {"age": 30, "role": "admin"},
        "bob":   {"age": 25, "role": "user"},
    }

    for username, info in users.items():
        print(f"{username}: age={info['age']}, role={info['role']}")
    ```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">words = ["banana", "apple", "cherry", "apple", "banana", "date", "banana"]

# Count occurrences using a dict
freq = {}
for word in words:
    freq[word] = freq.get(word, 0) + 1

# Sort by frequency descending
sorted_freq = sorted(freq.items(), key=lambda x: x[1], reverse=True)

print("Word frequencies:")
for word, count in sorted_freq:
    print(f"  {word:<10} {'#' * count} ({count})")

# Unique words
print(f"\nUnique words: {sorted(set(words))}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — List Comprehension

Use a list comprehension to create a list of all numbers from 1 to 20 that are **divisible by 3**. Print the list.

Expected output:
```
[3, 6, 9, 12, 15, 18]
```

<div class="pyodide-runner" data-mode="challenge" data-expected="[3, 6, 9, 12, 15, 18]">
<pre><code class="language-python"># Create a list of numbers 1-20 divisible by 3
</code></pre>
</div>

---

### Challenge 2 — Dictionary Lookup

Given the dictionary below, print the **average grade** rounded to 1 decimal place.

Expected output:
```
Average: 85.3
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Average: 85.3">
<pre><code class="language-python">grades = {"Alice": 92, "Bob": 78, "Charlie": 88, "Diana": 83}
# Print the average of the values, rounded to 1 decimal
</code></pre>
</div>

---

## 📚 Further Reading

- [Python Lists (docs.python.org)](https://docs.python.org/3/tutorial/datastructures.html)
- [Dictionaries — Real Python](https://realpython.com/python-dicts/)
- [Sets — Real Python](https://realpython.com/python-sets/)

---

!!! success "Lesson Complete 🎉"
    You now know all four core Python collection types. Lists and dicts will be your most-used tools.

[⬅️ Lesson 2 · Strings & Numbers](02-strings-and-numbers.md){ .md-button } [➡️ Lesson 4 · Functions & Modules](04-functions-and-modules.md){ .md-button .md-button--primary }
