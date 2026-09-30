---
title: "Lesson 4 · Functions & Modules"
description: "Define reusable functions, understand scope, use *args/**kwargs, and organise code into modules and packages."
---

# Lesson 4 · Functions & Modules

> **Section:** 🧱 Python Basics &nbsp;|&nbsp; **Difficulty:** ⭐⭐☆☆☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

- [ ] Define functions with `def`, parameters, and return values
- [ ] Use default arguments, `*args`, and `**kwargs`
- [ ] Understand local vs global scope
- [ ] Write lambda functions
- [ ] Import from the standard library and your own modules

---

## 📖 Introduction

Functions let you **write code once and reuse it many times**. Modules let you **organise code into files**. Together they're the foundation of every real Python project.

---

## 1. Defining Functions

```python
def greet(name, greeting="Hello"):
    """Return a greeting string. (This is a docstring.)"""
    return f"{greeting}, {name}!"

print(greet("Alice"))              # Hello, Alice!
print(greet("Bob", "Good morning"))# Good morning, Bob!
```

!!! tip "Always write a docstring"
    A docstring (the `"""..."""` right after `def`) documents what your function does.
    Tools like `help()`, IDEs, and documentation generators use them.

---

## 2. Return Values

Functions return `None` by default. Use `return` to send a value back.

=== "Single return"
    ```python
    def square(n):
        return n ** 2

    result = square(5)
    print(result)   # 25
    ```
=== "Multiple returns"
    ```python
    def min_max(numbers):
        return min(numbers), max(numbers)

    lo, hi = min_max([3, 1, 8, 2, 5])
    print(f"Min: {lo}, Max: {hi}")  # Min: 1, Max: 8
    ```

---

## 3. `*args` and `**kwargs`

Use `*args` to accept any number of positional arguments, and `**kwargs` for keyword arguments.

=== "Python"
    ```python
    def total(*args):
        """Sum any number of values."""
        return sum(args)

    print(total(1, 2, 3))           # 6
    print(total(10, 20, 30, 40))    # 100

    def profile(**kwargs):
        """Print key=value pairs."""
        for key, value in kwargs.items():
            print(f"  {key}: {value}")

    profile(name="Alice", age=30, city="London")
    ```
=== "Output"
    ```
    6
    100
      name: Alice
      age: 30
      city: London
    ```

---

## 4. Scope (LEGB Rule)

Python looks up names in this order: **L**ocal → **E**nclosing → **G**lobal → **B**uilt-in.

```python
x = "global"

def outer():
    x = "enclosing"
    def inner():
        x = "local"
        print(x)   # local
    inner()
    print(x)       # enclosing

outer()
print(x)           # global
```

!!! warning "Avoid `global` keyword"
    Using `global x` inside a function to modify a global variable is an anti-pattern in most cases.
    Pass values in and out of functions through parameters and return values instead.

---

## 5. Lambda Functions

A `lambda` is a small anonymous one-liner function.

```python
square = lambda x: x ** 2
print(square(9))           # 81

# Often used with sorted(), map(), filter()
names = ["Charlie", "Alice", "Bob"]
names.sort(key=lambda n: len(n))   # sort by name length
print(names)               # ['Bob', 'Alice', 'Charlie']

numbers = [1, 2, 3, 4, 5, 6]
evens = list(filter(lambda n: n % 2 == 0, numbers))
print(evens)               # [2, 4, 6]
```

---

## 6. Importing Modules

=== "Standard library"
    ```python
    import math
    import random
    import datetime

    print(math.sqrt(256))            # 16.0
    print(random.randint(1, 10))     # random int 1-10
    print(datetime.date.today())     # today's date
    ```
=== "Selective import"
    ```python
    from math import pi, sqrt, ceil
    from random import choice, shuffle

    print(f"Pi ≈ {pi:.4f}")
    print(sqrt(81))          # 9.0

    colours = ["red", "green", "blue"]
    shuffle(colours)
    print(choice(colours))
    ```
=== "Your own module"
    ```python
    # utils.py  (create this file)
    def celsius_to_fahrenheit(c):
        return c * 9/5 + 32

    # main.py
    from utils import celsius_to_fahrenheit
    print(celsius_to_fahrenheit(100))  # 212.0
    ```

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">def fizzbuzz(n):
    """Classic FizzBuzz for numbers 1 to n."""
    results = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            results.append("FizzBuzz")
        elif i % 3 == 0:
            results.append("Fizz")
        elif i % 5 == 0:
            results.append("Buzz")
        else:
            results.append(str(i))
    return results

output = fizzbuzz(20)
print(", ".join(output))
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Factorial

Write a function `factorial(n)` that returns `n!` (n factorial). Call it with `n=6` and print the result.

Expected output:
```
720
```

<div class="pyodide-runner" data-mode="challenge" data-expected="720">
<pre><code class="language-python">def factorial(n):
    # Return n! — e.g. factorial(5) = 5*4*3*2*1 = 120
    pass

print(factorial(6))
</code></pre>
</div>

---

### Challenge 2 — Flexible Greeter

Write a function `greet(*names)` that accepts any number of names and prints each greeting on its own line.

Expected output for `greet("Alice", "Bob", "Charlie")`:
```
Hello, Alice!
Hello, Bob!
Hello, Charlie!
```

<div class="pyodide-runner" data-mode="challenge" data-expected="Hello, Alice!
Hello, Bob!
Hello, Charlie!">
<pre><code class="language-python">def greet(*names):
    pass

greet("Alice", "Bob", "Charlie")
</code></pre>
</div>

---

## 📚 Further Reading

- [Defining Functions (docs.python.org)](https://docs.python.org/3/tutorial/controlflow.html#defining-functions)
- [*args and **kwargs — Real Python](https://realpython.com/python-kwargs-and-args/)
- [Python Modules (docs.python.org)](https://docs.python.org/3/tutorial/modules.html)

---

!!! success "Lesson Complete 🎉"
    Functions are the building blocks of clean code. Next up: reading and writing files.

[⬅️ Lesson 3 · Data Structures](03-data-structures.md){ .md-button } [➡️ Lesson 5 · File Handling](05-file-handling.md){ .md-button .md-button--primary }
