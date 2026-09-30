---
title: "Lesson 2 · Strings & Numbers"
description: "Master Python string methods, f-strings, slicing, and numeric operations including math functions."
---

# Lesson 2 · Strings & Numbers

> **Section:** 🧱 Python Basics &nbsp;|&nbsp; **Difficulty:** ⭐☆☆☆☆ &nbsp;|&nbsp; **Time:** ~40 minutes

---

## 🎯 Learning Objectives

- [ ] Create and manipulate strings using built-in methods
- [ ] Use f-strings for clean string formatting
- [ ] Slice strings to extract substrings
- [ ] Perform arithmetic and use the `math` module
- [ ] Understand integer vs float arithmetic

---

## 📖 Introduction

Two of the most fundamental data types you'll work with constantly are **strings** (text) and **numbers** (integers and floats). Python has an incredibly rich set of built-in tools for both.

---

## 1. String Basics

A string is a sequence of characters. You can use single `'`, double `"`, or triple `"""` quotes.

=== "Python"
    ```python
    name = "Python"
    print(len(name))          # 6 — length of string
    print(name.upper())       # PYTHON
    print(name.lower())       # python
    print(name.startswith("Py"))  # True
    print(name.replace("P", "J")) # Jython
    ```
=== "Output"
    ```
    6
    PYTHON
    python
    True
    Jython
    ```

---

## 2. String Methods Cheatsheet

| Method | What it does | Example |
|--------|-------------|---------|
| `.strip()` | Remove leading/trailing whitespace | `"  hi  ".strip()` → `"hi"` |
| `.split(sep)` | Split into a list | `"a,b,c".split(",")` → `["a","b","c"]` |
| `.join(list)` | Join list into string | `"-".join(["a","b"])` → `"a-b"` |
| `.find(sub)` | Index of first occurrence | `"hello".find("l")` → `2` |
| `.count(sub)` | Count occurrences | `"banana".count("a")` → `3` |
| `.isdigit()` | Check if all chars are digits | `"123".isdigit()` → `True` |
| `.capitalize()` | First char upper, rest lower | `"hELLO".capitalize()` → `"Hello"` |
| `.title()` | Title-case each word | `"my name".title()` → `"My Name"` |

---

## 3. String Slicing

Strings are zero-indexed sequences — you can slice them like lists.

```
Index:   0  1  2  3  4  5  6  7  8  9
String:  P  y  t  h  o  n  i  s  !  !
```

=== "Python"
    ```python
    s = "Python is fun!"

    print(s[0])        # P       — first character
    print(s[-1])       # !       — last character
    print(s[0:6])      # Python  — chars 0 to 5
    print(s[7:])       # is fun! — from index 7 to end
    print(s[:6])       # Python  — from start to 5
    print(s[::2])      # Pto s u! — every 2nd char
    print(s[::-1])     # !nuf si nohtyP — reversed
    ```
=== "Output"
    ```
    P
    !
    Python
    is fun!
    Python
    Pto sfn
    !nuf si nohtyP
    ```

---

## 4. f-Strings (Formatted String Literals)

f-strings are the modern, readable way to embed variables and expressions inside strings.

=== "Python"
    ```python
    name = "Alice"
    age = 30
    pi = 3.14159

    # Basic embedding
    print(f"My name is {name} and I am {age} years old.")

    # Expressions inside braces
    print(f"Next year I'll be {age + 1}.")

    # Number formatting
    print(f"Pi to 2 decimal places: {pi:.2f}")
    print(f"Pi as percentage: {pi:.1%}")

    # Width and alignment
    print(f"{'Left':<10}|{'Right':>10}|{'Center':^10}")
    ```
=== "Output"
    ```
    My name is Alice and I am 30 years old.
    Next year I'll be 31.
    Pi to 2 decimal places: 3.14
    Pi as percentage: 314.2%
    Left      |     Right|  Center  
    ```

!!! tip "f-string format spec cheatsheet"
    - `:.2f` — 2 decimal places (float)
    - `:,` — thousands separator (`1000000` → `1,000,000`)
    - `:>10` — right-align in 10 chars
    - `:<10` — left-align in 10 chars
    - `:^10` — center in 10 chars
    - `:05d` — zero-pad integer to 5 digits

---

## 5. Numbers: int, float, and the math Module

=== "Integers"
    ```python
    a = 1_000_000   # underscores improve readability
    b = 0xFF        # hexadecimal literal → 255
    c = 0b1010      # binary literal      → 10
    d = 0o17        # octal literal       → 15

    print(a, b, c, d)
    print(abs(-42))         # 42 — absolute value
    print(pow(2, 10))       # 1024 — same as 2**10
    print(divmod(17, 5))    # (3, 2) — quotient and remainder
    ```
=== "Floats & math"
    ```python
    import math

    print(round(3.7))           # 4
    print(round(3.14159, 2))    # 3.14
    print(math.floor(3.9))      # 3
    print(math.ceil(3.1))       # 4
    print(math.sqrt(144))       # 12.0
    print(math.log(100, 10))    # 2.0 — log base 10
    print(math.pi)              # 3.141592653589793
    print(math.inf)             # inf
    ```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">sentence = "  Hello, World! Python is amazing.  "

# Clean and analyse the string
cleaned = sentence.strip()
words = cleaned.split()
word_count = len(words)
upper = cleaned.upper()

print(f"Cleaned: '{cleaned}'")
print(f"Word count: {word_count}")
print(f"Upper: {upper}")
print(f"Contains 'Python': {'Python' in cleaned}")
print(f"Reversed: {cleaned[::-1]}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Reverse & Count

Write code that prints the **reverse** of the string `"Hello, Python!"` and then prints how many times the letter `"l"` appears in it.

Expected output:
```
!nohtyP ,olleH
3
```

<div class="pyodide-runner" data-mode="challenge" data-expected="!nohtyP ,olleH
3">
<pre><code class="language-python">s = "Hello, Python!"
# Print the reverse of s, then the count of "l"
</code></pre>
</div>

---

### Challenge 2 — Number Formatting

Given `price = 1234567.891`, print it formatted as a currency string with 2 decimal places and a thousands separator.

Expected output:
```
Price: $1,234,567.89
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Price: $1,234,567.89">
<pre><code class="language-python">price = 1234567.891
# Print: Price: $1,234,567.89
</code></pre>
</div>

---

## 📚 Further Reading

- [Python String Methods (docs.python.org)](https://docs.python.org/3/library/stdtypes.html#string-methods)
- [f-Strings Guide — Real Python](https://realpython.com/python-f-strings/)
- [math module (docs.python.org)](https://docs.python.org/3/library/math.html)

---

!!! success "Lesson Complete 🎉"
    You can now slice, format, and manipulate strings like a pro, and handle numbers with precision.

[⬅️ Lesson 1 · Python Basics & Syntax](01-python-basics-and-syntax.md){ .md-button } [➡️ Lesson 3 · Data Structures](03-data-structures.md){ .md-button .md-button--primary }
