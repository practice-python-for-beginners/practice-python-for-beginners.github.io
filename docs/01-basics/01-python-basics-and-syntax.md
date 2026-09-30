---
title: "Lesson 1 · Python Basics & Syntax"
description: "Learn Python's core syntax: variables, data types, operators, print/input, and your first if/elif/else block — with live in-browser code examples."
---

# Lesson 1 · Python Basics & Syntax

> **Section:** 🧱 Python Basics &nbsp;|&nbsp; **Difficulty:** ⭐☆☆☆☆ &nbsp;|&nbsp; **Time:** ~45 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Declare variables and understand Python's dynamic typing
- [ ] Identify and use Python's built-in data types (`int`, `float`, `str`, `bool`, `None`)
- [ ] Use arithmetic, comparison, and logical operators
- [ ] Write and call `print()` and `input()`
- [ ] Write a basic `if / elif / else` conditional block
- [ ] Recognise and fix the most common beginner errors

---

## 📖 Introduction

Python is one of the most popular programming languages in the world — used everywhere from web development and data science to machine learning and automation. One reason for its popularity is its **readable, English-like syntax**.

Let's start at the very beginning.

!!! info "No installation needed"
    Every code block on this page has a **▶ Run** button. Click it to execute Python directly in your browser — no setup required!

---

## 1. Variables & Assignment

A **variable** is a named container that holds a value. In Python you create a variable simply by assigning a value to it — no `var`, `let`, or type declaration needed.

```python
# This is a comment — Python ignores everything after #

name = "Alice"       # str  (text)
age  = 25            # int  (whole number)
height = 1.68        # float (decimal)
is_student = True    # bool (True or False)
nothing = None       # NoneType (absence of value)

print(name, age, height, is_student, nothing)
```

!!! tip "Naming conventions"
    Use `snake_case` for variable names (`user_name`, not `UserName` or `userName`).
    Names are **case-sensitive**: `age`, `Age`, and `AGE` are three different variables.

Try it yourself — change the values and hit Run:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">name = "Alice"
age  = 25
height = 1.68
is_student = True

print(f"Name: {name}")
print(f"Age: {age}")
print(f"Height: {height}m")
print(f"Is a student: {is_student}")
</code></pre>
</div>

---

## 2. Built-in Data Types

Python has several built-in data types. Here are the ones you'll use most often:

=== "Strings"
    ```python
    # Strings — text wrapped in quotes (single or double)
    greeting = "Hello, World!"
    language = 'Python'

    # Multi-line strings use triple quotes
    bio = """
    My name is Alice.
    I am learning Python.
    """

    print(greeting)
    print(language)
    print(bio)
    ```
    ```
    Hello, World!
    Python

    My name is Alice.
    I am learning Python.

    ```

=== "Numbers"
    ```python
    # int — whole numbers (no decimal point)
    apples = 5
    temperature = -3

    # float — numbers with a decimal point
    pi = 3.14159
    price = 9.99

    print(type(apples))       # <class 'int'>
    print(type(pi))           # <class 'float'>
    print(apples + pi)        # 8.14159
    ```
    ```
    <class 'int'>
    <class 'float'>
    8.14159
    ```

=== "Booleans"
    ```python
    # bool — either True or False (capital T and F!)
    is_raining = False
    has_umbrella = True

    # Booleans are the result of comparisons
    print(5 > 3)          # True
    print(10 == 20)       # False
    print(is_raining and has_umbrella)  # False
    ```
    ```
    True
    False
    False
    ```

=== "Type Conversion"
    ```python
    # Convert between types with int(), float(), str(), bool()
    x = "42"          # This is a string "42"
    y = int(x)        # Now it's the integer 42
    z = float(y)      # Now it's 42.0

    print(type(x), x)   # <class 'str'>  42
    print(type(y), y)   # <class 'int'>  42
    print(type(z), z)   # <class 'float'> 42.0

    # Check the type of any value
    print(isinstance(y, int))   # True
    ```
    ```
    <class 'str'> 42
    <class 'int'> 42
    <class 'float'> 42.0
    True
    ```

---

## 3. Operators

### Arithmetic Operators

| Operator | Meaning | Example | Result |
|----------|---------|---------|--------|
| `+` | Addition | `3 + 2` | `5` |
| `-` | Subtraction | `10 - 4` | `6` |
| `*` | Multiplication | `3 * 4` | `12` |
| `/` | Division (float) | `7 / 2` | `3.5` |
| `//` | Floor division | `7 // 2` | `3` |
| `%` | Modulo (remainder) | `7 % 2` | `1` |
| `**` | Exponentiation | `2 ** 8` | `256` |

=== "Python"
    ```python
    a, b = 15, 4

    print(f"{a} + {b}  = {a + b}")
    print(f"{a} - {b}  = {a - b}")
    print(f"{a} * {b}  = {a * b}")
    print(f"{a} / {b}  = {a / b}")
    print(f"{a} // {b} = {a // b}")
    print(f"{a} % {b}  = {a % b}")
    print(f"{a} ** {b} = {a ** b}")
    ```
=== "Output"
    ```
    15 + 4  = 19
    15 - 4  = 11
    15 * 4  = 60
    15 / 4  = 3.75
    15 // 4 = 3
    15 % 4  = 3
    15 ** 4 = 50625
    ```

### Comparison Operators

```python
x = 10
print(x == 10)   # True  — equal to
print(x != 5)    # True  — not equal to
print(x > 7)     # True  — greater than
print(x < 7)     # False — less than
print(x >= 10)   # True  — greater than or equal
print(x <= 9)    # False — less than or equal
```

### Logical Operators

```python
a = True
b = False

print(a and b)   # False — both must be True
print(a or b)    # True  — at least one must be True
print(not a)     # False — flips the boolean
```

!!! warning "Common mistake: `=` vs `==`"
    `=` **assigns** a value. `==` **compares** two values.
    ```python
    x = 5      # ✅ assignment
    x == 5     # ✅ comparison (returns True)
    if x = 5:  # ❌ SyntaxError!
    ```

---

## 4. `print()` and `input()`

`print()` outputs values to the screen. `input()` pauses and waits for the user to type something.

=== "Python"
    ```python
    # print() can take multiple values separated by commas
    print("Hello", "World", 42)

    # sep changes the separator (default is a space)
    print("2024", "01", "15", sep="-")

    # end changes what's printed at the end (default is newline \n)
    print("Loading", end="")
    print("...", end="\n")

    # f-strings are the modern way to embed variables
    name = "Bob"
    score = 97.5
    print(f"{name} scored {score:.1f}%")
    ```
=== "Output"
    ```
    Hello World 42
    2024-01-15
    Loading...
    Bob scored 97.5%
    ```

!!! note "`input()` in the browser runner"
    The live runner on this page uses **Pyodide** (Python in WebAssembly). The `input()` function
    is not supported in the browser environment. For `input()` examples, run them locally with
    `python script.py` in your terminal.

---

## 5. Conditional Statements (`if / elif / else`)

Conditionals let your program make decisions.

=== "Python"
    ```python
    score = 78

    if score >= 90:
        grade = "A"
    elif score >= 80:
        grade = "B"
    elif score >= 70:
        grade = "C"
    elif score >= 60:
        grade = "D"
    else:
        grade = "F"

    print(f"Score: {score} → Grade: {grade}")
    ```
=== "Output"
    ```
    Score: 78 → Grade: C
    ```

!!! warning "Indentation is not optional"
    Python uses **indentation** (4 spaces) to define code blocks — there are no `{ }` braces.
    Every line inside an `if` block must be indented consistently.
    ```python
    if True:
        print("This works")   # ✅
      print("This breaks")    # ❌ IndentationError
    ```

Try it — change the value of `score` and re-run:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">score = 78   # ← change this value and click Run

if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
elif score >= 60:
    grade = "D"
else:
    grade = "F"

print(f"Score: {score} → Grade: {grade}")
</code></pre>
</div>

---

## 6. Common Beginner Mistakes

??? bug "Mistake 1: Using a variable before assigning it"
    ```python
    print(result)   # ❌ NameError: name 'result' is not defined
    result = 42
    print(result)   # ✅
    ```

??? bug "Mistake 2: Wrong indentation"
    ```python
    for i in range(3):
    print(i)   # ❌ IndentationError — must be indented
        print(i)  # ✅
    ```

??? bug "Mistake 3: Comparing strings with wrong case"
    ```python
    answer = input("Yes or No? ")
    if answer == "yes":    # ❌ won't match "Yes" or "YES"
        print("Great!")

    if answer.lower() == "yes":   # ✅ case-insensitive
        print("Great!")
    ```

??? bug "Mistake 4: Integer division when float expected"
    ```python
    print(7 / 2)    # 3.5  ✅
    print(7 // 2)   # 3    (floor division — may not be what you want)
    ```

---

## 🏋️ Challenges

Test your understanding! Write the code in the editor, click **✅ Check Answer**, and get instant feedback.

### Challenge 1 — Hello, Python!

Write a single line of code that prints exactly:

```
Hello, Python!
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Hello, Python!">
<pre><code class="language-python"># Write your solution below:
</code></pre>
</div>

---

### Challenge 2 — Grade Calculator

Complete the code so that when `score = 85`, it prints exactly:

```
Grade: B
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Grade: B">
<pre><code class="language-python">score = 85

# Write your if/elif/else block below:
# Then print the result like: Grade: B
</code></pre>
</div>

---

### Challenge 3 — Type Conversion

The variable `x` is the string `"7"`. Convert it to an integer, multiply by `6`, and print the result.

Expected output:
```
42
```

<div class="pyodide-runner" data-mode="challenge" data-expected="42">
<pre><code class="language-python">x = "7"

# Convert x to int, multiply by 6, and print the result
</code></pre>
</div>

---

## 📚 Further Reading

- [Official Python Tutorial — An Informal Introduction](https://docs.python.org/3/tutorial/introduction.html)
- [Real Python — Python Basics](https://realpython.com/python-basics/)
- [Python Operators (W3Schools)](https://www.w3schools.com/python/python_operators.asp)
- [f-Strings — A Modern Approach](https://realpython.com/python-f-strings/)

---

!!! success "Lesson Complete 🎉"
    You now understand Python variables, data types, operators, `print()`, and conditionals.
    That's the foundation everything else builds on!

[➡️ Lesson 2 · Strings & Numbers](02-strings-and-numbers.md){ .md-button .md-button--primary }
