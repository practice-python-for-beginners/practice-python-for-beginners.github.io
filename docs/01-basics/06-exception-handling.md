---
title: "Lesson 6 · Exception Handling & Debugging"
description: "Write resilient Python code using try/except, raise custom exceptions, and use logging for production-ready debugging."
---

# Lesson 6 · Exception Handling & Debugging

> **Section:** 🧱 Python Basics &nbsp;|&nbsp; **Difficulty:** ⭐⭐☆☆☆ &nbsp;|&nbsp; **Time:** ~45 minutes

---

## 🎯 Learning Objectives

- [ ] Use `try / except / else / finally` to handle errors gracefully
- [ ] Catch specific exception types
- [ ] Raise exceptions with `raise`
- [ ] Define custom exception classes
- [ ] Use the `logging` module instead of `print()` for diagnostics

---

## 📖 Introduction

Errors (exceptions) happen. A network call fails, a user provides bad input, a file is missing. The difference between beginner code and production code is how you handle these situations: crash with a traceback, or recover gracefully.

---

## 1. The `try / except` Block

=== "Basic"
    ```python
    try:
        number = int("not a number")   # raises ValueError
    except ValueError:
        print("That's not a valid integer!")

    print("Program continues...")
    ```
=== "Multiple exceptions"
    ```python
    def safe_divide(a, b):
        try:
            result = a / b
        except ZeroDivisionError:
            print("Error: cannot divide by zero")
            return None
        except TypeError as e:
            print(f"Error: invalid types — {e}")
            return None
        else:
            # Runs only if no exception was raised
            print(f"{a} / {b} = {result}")
            return result
        finally:
            # Always runs, exception or not
            print("--- divide complete ---")

    safe_divide(10, 2)
    safe_divide(5, 0)
    safe_divide("x", 2)
    ```
=== "Output"
    ```
    10 / 2 = 5.0
    --- divide complete ---
    Error: cannot divide by zero
    --- divide complete ---
    Error: invalid types — unsupported operand type(s) for /: 'str' and 'int'
    --- divide complete ---
    ```

---

## 2. Common Built-in Exceptions

| Exception | When it occurs |
|-----------|---------------|
| `ValueError` | Wrong value type/format (e.g. `int("abc")`) |
| `TypeError` | Wrong type for operation |
| `KeyError` | Dict key doesn't exist |
| `IndexError` | List index out of range |
| `FileNotFoundError` | File doesn't exist |
| `ZeroDivisionError` | Division by zero |
| `AttributeError` | Object has no such attribute |
| `ImportError` | Module can't be imported |

---

## 3. Raising Exceptions

Use `raise` to signal that something went wrong.

```python
def set_age(age):
    if not isinstance(age, int):
        raise TypeError(f"Age must be an int, got {type(age).__name__}")
    if age < 0 or age > 150:
        raise ValueError(f"Age {age} is out of realistic range (0-150)")
    return age

try:
    set_age(-5)
except ValueError as e:
    print(f"Caught: {e}")

try:
    set_age("twenty")
except TypeError as e:
    print(f"Caught: {e}")
```

---

## 4. Custom Exception Classes

```python
class InsufficientFundsError(Exception):
    """Raised when a bank withdrawal exceeds the balance."""
    def __init__(self, balance, amount):
        self.balance = balance
        self.amount = amount
        super().__init__(
            f"Cannot withdraw {amount:.2f}. Balance is only {balance:.2f}."
        )

class BankAccount:
    def __init__(self, balance):
        self.balance = balance

    def withdraw(self, amount):
        if amount > self.balance:
            raise InsufficientFundsError(self.balance, amount)
        self.balance -= amount
        return self.balance

account = BankAccount(100.0)
try:
    account.withdraw(150.0)
except InsufficientFundsError as e:
    print(e)
```

---

## 5. Logging vs `print()`

`print()` is fine for quick debugging. For real applications, use the `logging` module.

```python
import logging

# Configure once at the top of your app
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)

log = logging.getLogger(__name__)

def process_data(data):
    log.debug(f"Processing {len(data)} records")
    if not data:
        log.warning("Received empty data list")
        return []
    log.info("Processing complete")
    return [str(d).upper() for d in data]

process_data(["alpha", "beta"])
process_data([])
```

!!! tip "Log levels"
    `DEBUG` < `INFO` < `WARNING` < `ERROR` < `CRITICAL`.
    In production, set `level=logging.INFO` or `WARNING` to reduce noise.

---

## 💻 Try It Yourself

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">def parse_age(value):
    """Parse a string to a valid age integer."""
    try:
        age = int(value)
    except ValueError:
        raise ValueError(f"Cannot convert '{value}' to an integer")
    if not 0 <= age <= 120:
        raise ValueError(f"Age {age} is not realistic")
    return age

test_cases = ["25", "abc", "-3", "200", "0"]

for tc in test_cases:
    try:
        age = parse_age(tc)
        print(f"'{tc}' → valid age: {age}")
    except ValueError as e:
        print(f"'{tc}' → ERROR: {e}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Safe Division

Write a function `safe_div(a, b)` that returns `a / b`, but returns the string `"error"` if `b` is zero.

Expected output:
```
5.0
error
```

<div class="pyodide-runner" data-mode="challenge" data-expected="5.0
error">
<pre><code class="language-python">def safe_div(a, b):
    pass

print(safe_div(10, 2))
print(safe_div(5, 0))
</code></pre>
</div>

---

## 📚 Further Reading

- [Errors and Exceptions (docs.python.org)](https://docs.python.org/3/tutorial/errors.html)
- [Python Logging — Real Python](https://realpython.com/python-logging/)
- [Python Exception Hierarchy](https://docs.python.org/3/library/exceptions.html#exception-hierarchy)

---

!!! success "Lesson Complete 🎉"
    Robust exception handling separates toy scripts from production-grade code.

[⬅️ Lesson 5 · File Handling](05-file-handling.md){ .md-button } [➡️ Lesson 7 · Intro to OOP](07-intro-to-oop.md){ .md-button .md-button--primary }
