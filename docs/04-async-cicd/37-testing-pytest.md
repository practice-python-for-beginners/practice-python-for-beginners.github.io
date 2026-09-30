---
title: "Lesson 37 · Automated Testing with Pytest"
description: "Write reliable Python tests with pytest: unit tests, fixtures, parametrize, mocking with unittest.mock, Flask test client integration, and measuring coverage."
---

# Lesson 37 · Automated Testing with Pytest

> **Section:** ⚡ Async, CI/CD, Docker &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~55 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain why automated tests are essential for production code
- [ ] Write pytest tests using the `test_` prefix and `assert` statements
- [ ] Use `@pytest.fixture` to share setup and teardown logic
- [ ] Parametrize tests with `@pytest.mark.parametrize`
- [ ] Mock external dependencies with `unittest.mock`
- [ ] Test a Flask app with `app.test_client()`
- [ ] Measure test coverage with `pytest-cov`

---

## 📖 Introduction

Code that isn't tested is code that only *seems* to work. A small refactor, a new environment variable, a library upgrade — any of these can silently break behaviour that was "obviously correct" yesterday. **Automated tests** are your safety net.

pytest is Python's most popular testing framework. It's minimal to set up, incredibly powerful, and produces beautiful output.

!!! info "Unit vs Integration vs E2E"
    **Unit tests** test one function in isolation, mocking all external calls. **Integration tests** test multiple components together (e.g., API route + database). **End-to-end (E2E) tests** test the entire system via the UI or HTTP. The classic advice: write many unit tests, fewer integration tests, very few E2E tests (the "testing pyramid").

---

## 1. pytest Basics — `test_` Prefix and `assert`

pytest uses naming conventions to discover tests. Any file named `test_*.py` or `*_test.py`, with functions named `test_*`, will be collected automatically.

=== "Python"
    ```python
    # test_math.py

    def add(a: int, b: int) -> int:
        return a + b

    def divide(a: float, b: float) -> float:
        if b == 0:
            raise ValueError("Cannot divide by zero")
        return a / b

    # Tests — pytest discovers these automatically
    def test_add_positive():
        assert add(2, 3) == 5

    def test_add_negative():
        assert add(-1, -1) == -2

    def test_add_zero():
        assert add(0, 0) == 0

    def test_divide_normal():
        assert divide(10, 2) == 5.0

    def test_divide_by_zero():
        import pytest
        with pytest.raises(ValueError, match="Cannot divide by zero"):
            divide(10, 0)
    ```
=== "Output"
    ```
    $ pytest test_math.py -v
    ====================== test session starts ======================
    collected 5 items

    test_math.py::test_add_positive    PASSED
    test_math.py::test_add_negative    PASSED
    test_math.py::test_add_zero        PASSED
    test_math.py::test_divide_normal   PASSED
    test_math.py::test_divide_by_zero  PASSED

    ====================== 5 passed in 0.03s =======================
    ```

!!! tip "Descriptive test names"
    Name tests as `test_<function>_<scenario>_<expected>`. Example: `test_divide_by_zero_raises_value_error`. This makes failure messages self-documenting.

---

## 2. Fixtures — Setup and Teardown

`@pytest.fixture` creates reusable test objects. pytest injects them automatically by parameter name.

=== "Python"
    ```python
    import pytest

    class Database:
        def __init__(self):
            self.data = {}

        def insert(self, key: str, value) -> None:
            self.data[key] = value

        def get(self, key: str):
            return self.data.get(key)

        def delete(self, key: str) -> None:
            self.data.pop(key, None)

    @pytest.fixture
    def db():
        """Create a fresh database for each test."""
        database = Database()
        database.insert("user:1", {"name": "Alice", "age": 30})
        yield database          # test receives the db object
        database.data.clear()   # teardown — runs after the test

    def test_db_get(db):
        user = db.get("user:1")
        assert user["name"] == "Alice"

    def test_db_insert(db):
        db.insert("user:2", {"name": "Bob"})
        assert db.get("user:2")["name"] == "Bob"

    def test_db_delete(db):
        db.delete("user:1")
        assert db.get("user:1") is None
    ```
=== "Output"
    ```
    test_fixtures.py::test_db_get     PASSED
    test_fixtures.py::test_db_insert  PASSED
    test_fixtures.py::test_db_delete  PASSED
    ```

!!! note "Fixture scopes"
    `@pytest.fixture(scope="function")` — default, fresh per test. `scope="module"` — shared across the whole file. `scope="session"` — shared across the entire test run. Use `session` scope for expensive setup like a real DB connection.

---

## 3. `@pytest.mark.parametrize` — Data-Driven Tests

Instead of writing five nearly-identical test functions, use `@parametrize` to run one test with multiple inputs:

=== "Python"
    ```python
    import pytest

    def is_palindrome(s: str) -> bool:
        cleaned = s.lower().replace(" ", "")
        return cleaned == cleaned[::-1]

    @pytest.mark.parametrize("text, expected", [
        ("racecar",      True),
        ("hello",        False),
        ("A man a plan",  False),
        ("Was it a car", False),
        ("level",        True),
        ("",             True),   # empty string is a palindrome
    ])
    def test_is_palindrome(text, expected):
        assert is_palindrome(text) == expected

    # Alternatively, test expected failures
    @pytest.mark.parametrize("n", [-1, 0, 1.5])
    def test_factorial_invalid(n):
        import pytest
        from math import factorial
        with pytest.raises((ValueError, TypeError)):
            factorial(n)
    ```
=== "Output"
    ```
    test_param.py::test_is_palindrome[racecar-True]          PASSED
    test_param.py::test_is_palindrome[hello-False]           PASSED
    test_param.py::test_is_palindrome[A man a plan-False]    PASSED
    test_param.py::test_is_palindrome[level-True]            PASSED
    test_param.py::test_is_palindrome[--True]                PASSED
    ```

---

## 4. Mocking with `unittest.mock`

Unit tests should be *isolated* — they shouldn't actually send HTTP requests or touch a database. `unittest.mock` replaces real dependencies with controllable fakes.

=== "Python"
    ```python
    import pytest
    from unittest.mock import patch, MagicMock

    # The function under test
    def get_user_from_api(user_id: int) -> dict:
        import requests
        response = requests.get(f"https://api.example.com/users/{user_id}")
        response.raise_for_status()
        return response.json()

    # Test WITHOUT hitting the real API
    def test_get_user_success():
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": 1, "name": "Alice"}
        mock_response.raise_for_status.return_value = None

        with patch("requests.get", return_value=mock_response) as mock_get:
            user = get_user_from_api(1)

        assert user["name"] == "Alice"
        mock_get.assert_called_once_with("https://api.example.com/users/1")

    def test_get_user_network_error():
        import requests
        with patch("requests.get", side_effect=requests.ConnectionError("timeout")):
            with pytest.raises(requests.ConnectionError):
                get_user_from_api(1)
    ```
=== "Output"
    ```
    test_mock.py::test_get_user_success       PASSED
    test_mock.py::test_get_user_network_error PASSED
    ```

!!! warning "Mock at the right level"
    Patch `requests.get` in the module that *uses* it, not in `requests` itself. If your code is in `myapp.utils`, use `patch("myapp.utils.requests.get")`, not `patch("requests.get")`.

---

## 5. Flask Test Client and Coverage

Flask ships with a test client that lets you make HTTP calls without running a server:

=== "Python"
    ```python
    # app.py
    from flask import Flask, jsonify

    app = Flask(__name__)

    @app.route("/api/greet/<name>")
    def greet(name: str):
        if not name.isalpha():
            return jsonify({"error": "Invalid name"}), 400
        return jsonify({"message": f"Hello, {name}!"})

    # test_app.py
    import pytest
    from app import app

    @pytest.fixture
    def client():
        app.config["TESTING"] = True
        with app.test_client() as client:
            yield client

    def test_greet_success(client):
        resp = client.get("/api/greet/Alice")
        assert resp.status_code == 200
        assert resp.get_json()["message"] == "Hello, Alice!"

    def test_greet_invalid_name(client):
        resp = client.get("/api/greet/123")
        assert resp.status_code == 400
        assert "error" in resp.get_json()
    ```
=== "Output"
    ```
    # Run with coverage:
    # $ pytest --cov=app --cov-report=term-missing

    test_app.py::test_greet_success       PASSED
    test_app.py::test_greet_invalid_name  PASSED

    ----------- coverage: app.py -----------
    Name     Stmts  Miss  Cover
    -------- -----  ----  -----
    app.py       8     0   100%
    ```

---

## 💻 Try It Yourself

Implement a simple function and verify it with manual `assert`-based tests — the same logic pytest uses internally.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">def is_even(n):
    return n % 2 == 0

def multiply(a, b):
    return a * b

def clamp(value, lo, hi):
    return max(lo, min(hi, value))

# Simulate pytest-style tests
test_results = []

def run_test(name, fn):
    try:
        fn()
        test_results.append(("PASS", name))
    except AssertionError as e:
        test_results.append(("FAIL", f"{name}: {e}"))

def test_is_even_true():
    assert is_even(4) is True

def test_is_even_false():
    assert is_even(7) is False

def test_multiply():
    assert multiply(3, 4) == 12

def test_clamp_within():
    assert clamp(5, 0, 10) == 5

def test_clamp_below():
    assert clamp(-5, 0, 10) == 0

def test_clamp_above():
    assert clamp(15, 0, 10) == 10

for name, fn in [
    ("test_is_even_true",  test_is_even_true),
    ("test_is_even_false", test_is_even_false),
    ("test_multiply",      test_multiply),
    ("test_clamp_within",  test_clamp_within),
    ("test_clamp_below",   test_clamp_below),
    ("test_clamp_above",   test_clamp_above),
]:
    run_test(name, fn)

for status, name in test_results:
    icon = "✓" if status == "PASS" else "✗"
    print(f"  {icon} {status} — {name}")

passed = sum(1 for s, _ in test_results if s == "PASS")
print(f"\n{passed}/{len(test_results)} tests passed")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Test `is_even`

Write an `is_even(n)` function, assert `is_even(4)` is `True`, and print `"passed"`.

Expected output:
```
passed
```

<div class="pyodide-runner" data-mode="challenge" data-expected="passed">
<pre><code class="language-python">def is_even(n):
    return n % 2 == 0

assert is_even(4) is True
print("passed")
</code></pre>
</div>

---

### Challenge 2 — Parametrized Loop

Simulate a parametrized test: loop over `[2, 4, 6]` and assert each is even. If all pass, print `"all even"`.

Expected output:
```
all even
```

<div class="pyodide-runner" data-mode="challenge" data-expected="all even">
<pre><code class="language-python">def is_even(n):
    return n % 2 == 0

test_cases = [2, 4, 6]

for n in test_cases:
    assert is_even(n), f"Expected {n} to be even"

print("all even")
</code></pre>
</div>

---

## 📚 Further Reading

- [pytest — Official Documentation](https://docs.pytest.org/en/stable/)
- [Real Python — Getting Started with Testing in Python](https://realpython.com/python-testing/)
- [unittest.mock — Official Docs](https://docs.python.org/3/library/unittest.mock.html)

---

!!! success "Lesson Complete 🎉"
    You can now write pytest unit tests, use fixtures, parametrize data-driven tests, mock
    external dependencies, and test Flask routes with a test client. Test all the things!

[⬅️ Lesson 36 · Logging & Monitoring](36-logging-monitoring.md){ .md-button }
[➡️ Lesson 38 · CI with GitHub Actions](38-ci-github-actions.md){ .md-button .md-button--primary }
