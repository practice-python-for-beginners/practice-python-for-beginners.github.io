---
title: "Lesson 38 · CI with GitHub Actions"
description: "Automate your Python test suite with GitHub Actions: write workflow YAML, run pytest on every push, test across multiple Python versions with matrix strategy, cache pip dependencies, and deploy on success."
---

# Lesson 38 · CI with GitHub Actions

> **Section:** ⚡ Async, CI/CD, Docker &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~50 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Explain what CI/CD is and why every project needs it
- [ ] Write a GitHub Actions workflow file with `on`, `jobs`, and `steps`
- [ ] Run pytest automatically on every push and pull request
- [ ] Use matrix strategy to test across multiple Python versions
- [ ] Store secrets securely in GitHub and access them in workflows
- [ ] Cache pip dependencies to speed up CI runs
- [ ] Add a deployment step that runs only after tests pass

---

## 📖 Introduction

**Continuous Integration (CI)** means automatically building and testing your code on every push, so broken code is caught before it reaches main. **Continuous Deployment (CD)** extends this by automatically deploying code that passes all checks.

GitHub Actions is GitHub's built-in CI/CD platform — free for public repos, and generous on private ones. Workflows live as YAML files in `.github/workflows/`.

!!! info "CI/CD Benefits"
    No more "it works on my machine" — CI runs your tests in a clean, reproducible environment. Pull requests show green ✅ or red ❌ before you merge. Deployments are triggered automatically, removing human error from the process.

---

## 1. Workflow Syntax — `on`, `jobs`, `steps`

A workflow file has three key sections:

| Section | Purpose |
|---------|---------|
| `on` | Events that trigger the workflow (push, PR, schedule, manual) |
| `jobs` | Named groups of steps that run on a runner (Ubuntu, macOS, Windows) |
| `steps` | Individual shell commands or Action calls |

=== "Python"
    ```yaml
    # .github/workflows/ci.yml

    name: Python CI

    on:
      push:
        branches: [main, develop]
      pull_request:
        branches: [main]

    jobs:
      test:
        runs-on: ubuntu-latest

        steps:
          - name: Checkout code
            uses: actions/checkout@v4

          - name: Set up Python 3.11
            uses: actions/setup-python@v5
            with:
              python-version: "3.11"

          - name: Install dependencies
            run: |
              python -m pip install --upgrade pip
              pip install -r requirements.txt
              pip install pytest pytest-cov

          - name: Run tests
            run: pytest --cov=app --cov-report=xml -v

          - name: Upload coverage report
            uses: codecov/codecov-action@v4
            with:
              token: ${{ secrets.CODECOV_TOKEN }}
    ```
=== "Output"
    ```
    # GitHub shows on each PR:
    ✅ test (ubuntu-latest) — All checks have passed
       pytest: 47 passed, 0 failed in 12.3s
       coverage: 94%
    ```

!!! tip "Workflow triggers"
    `on: push` runs on every push. `on: pull_request` runs on PR creation and updates. `on: schedule: - cron: "0 6 * * *"` runs nightly. `on: workflow_dispatch` adds a manual "Run workflow" button in the GitHub UI.

---

## 2. Matrix Strategy — Test Multiple Python Versions

Real projects need to work on Python 3.10, 3.11, and 3.12. The matrix strategy runs the same job N times with different configurations simultaneously:

=== "Python"
    ```yaml
    name: Python Matrix CI

    on: [push, pull_request]

    jobs:
      test:
        runs-on: ${{ matrix.os }}

        strategy:
          matrix:
            os: [ubuntu-latest, macos-latest]
            python-version: ["3.10", "3.11", "3.12"]
          fail-fast: false   # don't cancel other jobs if one fails

        steps:
          - uses: actions/checkout@v4

          - name: Set up Python ${{ matrix.python-version }}
            uses: actions/setup-python@v5
            with:
              python-version: ${{ matrix.python-version }}

          - name: Install and test
            run: |
              pip install -r requirements.txt pytest
              pytest -v

    # This creates 6 jobs: ubuntu × {3.10, 3.11, 3.12} + mac × {3.10, 3.11, 3.12}
    ```
=== "Output"
    ```
    # GitHub Actions summary:
    ✅ test (ubuntu-latest, 3.10)   PASSED
    ✅ test (ubuntu-latest, 3.11)   PASSED
    ✅ test (ubuntu-latest, 3.12)   PASSED
    ✅ test (macos-latest, 3.10)    PASSED
    ✅ test (macos-latest, 3.11)    PASSED
    ✅ test (macos-latest, 3.12)    PASSED
    ```

---

## 3. Using Secrets and Environment Variables

Sensitive values like API keys and database URLs should never be in code. GitHub Secrets are encrypted and injected as environment variables at runtime.

=== "Python"
    ```yaml
    # In GitHub: Settings → Secrets and variables → Actions → New secret
    # Name: DATABASE_URL, Value: postgresql://user:pass@host/db

    jobs:
      test:
        runs-on: ubuntu-latest

        env:
          # Set non-sensitive variables directly
          FLASK_ENV: testing
          LOG_LEVEL: WARNING

        steps:
          - uses: actions/checkout@v4

          - name: Set up Python
            uses: actions/setup-python@v5
            with:
              python-version: "3.11"

          - name: Run tests
            env:
              # Inject secrets as environment variables
              DATABASE_URL: ${{ secrets.DATABASE_URL }}
              REDIS_URL: ${{ secrets.REDIS_URL }}
              JWT_SECRET: ${{ secrets.JWT_SECRET }}
            run: pytest -v
    ```
=== "Output"
    ```
    # Secrets are masked in logs:
    Run pytest -v
    DATABASE_URL = ***
    REDIS_URL = ***
    # Tests that use os.environ["DATABASE_URL"] work correctly
    ```

!!! warning "Never commit secrets"
    Treat any accidental secret commit as compromised. Rotate the credential immediately. Use tools like `git-secrets` or `truffleHog` to scan your history.

---

## 4. Caching pip Dependencies

By default, CI installs all packages from scratch on every run. Caching makes subsequent runs much faster:

=== "Python"
    ```yaml
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"
          cache: "pip"               # ← built-in pip caching

      # Alternatively, manual cache control:
      - name: Cache pip packages
        uses: actions/cache@v4
        with:
          path: ~/.cache/pip
          key: ${{ runner.os }}-pip-${{ hashFiles('requirements*.txt') }}
          restore-keys: |
            ${{ runner.os }}-pip-

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt
    ```
=== "Output"
    ```
    # First run: 45 seconds (no cache)
    # Subsequent runs (cache hit): 4 seconds ← 91% faster!

    Cache restored from key: Linux-pip-a1b2c3d4...
    ```

---

## 5. Deploy on Success

Chain a deployment job that only runs when tests pass, using `needs`:

=== "Python"
    ```yaml
    jobs:
      test:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - uses: actions/setup-python@v5
            with: { python-version: "3.11" }
          - run: pip install -r requirements.txt pytest
          - run: pytest -v

      deploy:
        needs: test            # only run if 'test' job passes
        runs-on: ubuntu-latest
        if: github.ref == 'refs/heads/main'   # only deploy from main branch

        steps:
          - uses: actions/checkout@v4

          - name: Deploy to Render
            env:
              RENDER_DEPLOY_HOOK: ${{ secrets.RENDER_DEPLOY_HOOK }}
            run: curl -X POST "$RENDER_DEPLOY_HOOK"

          - name: Notify Slack on success
            if: success()
            uses: slackapi/slack-github-action@v1
            with:
              slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
              channel-id: "deployments"
              slack-message: "✅ Deployed to production!"
    ```
=== "Output"
    ```
    # Job dependency graph:
    test → deploy (only on success + main branch)

    ✅ test     passed in 23s
    ✅ deploy   triggered Render redeploy hook
    📣 Slack:  ✅ Deployed to production!
    ```

---

## 💻 Try It Yourself

Simulate a CI pipeline in Python — define "steps" as functions, run them in sequence, and report pass/fail.

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">import time

def simulate_ci_pipeline(steps):
    """Run a list of CI steps, stop on first failure."""
    results = []
    print("=== CI Pipeline Starting ===\n")

    for step_name, step_fn in steps:
        print(f"  ▶ Running: {step_name}")
        try:
            step_fn()
            results.append((step_name, "PASSED"))
            print(f"  ✓ PASSED: {step_name}\n")
        except Exception as e:
            results.append((step_name, f"FAILED: {e}"))
            print(f"  ✗ FAILED: {step_name} — {e}\n")
            break  # stop pipeline on failure

    print("=== Pipeline Summary ===")
    for name, status in results:
        icon = "✓" if "PASSED" in status else "✗"
        print(f"  {icon} {name}: {status}")

    passed = sum(1 for _, s in results if "PASSED" in s)
    print(f"\n{passed}/{len(results)} steps passed")
    return passed == len(steps)

# Define CI steps
def checkout():
    print("    Cloning repository...")

def setup_python():
    print("    Python 3.11 configured.")

def install_deps():
    print("    pip install -r requirements.txt... done")

def run_linter():
    print("    flake8 . → no issues found")

def run_tests():
    print("    pytest -v → 47 passed, 0 failed")

def build_docker():
    print("    docker build -t myapp:latest . → done")

steps = [
    ("Checkout code",       checkout),
    ("Setup Python 3.11",   setup_python),
    ("Install dependencies",install_deps),
    ("Run linter",          run_linter),
    ("Run tests",           run_tests),
    ("Build Docker image",  build_docker),
]

success = simulate_ci_pipeline(steps)
print(f"\n{'✅ Pipeline PASSED' if success else '❌ Pipeline FAILED'}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count Passing Steps

Simulate 4 CI steps, all passing, and print the total number that passed.

Expected output:
```
4
```

<div class="pyodide-runner" data-mode="challenge" data-expected="4">
<pre><code class="language-python">steps = ["checkout", "install", "lint", "test"]
passed = 0

for step in steps:
    # All steps succeed
    passed += 1

print(passed)
</code></pre>
</div>

---

### Challenge 2 — Parse Test Report

Given a mock test report dictionary, print the number of passing tests.

Expected output:
```
7
```

<div class="pyodide-runner" data-mode="challenge" data-expected="7">
<pre><code class="language-python">test_report = {
    "total": 10,
    "passed": 7,
    "failed": 2,
    "skipped": 1,
    "duration_seconds": 14.3,
}

print(test_report["passed"])
</code></pre>
</div>

---

## 📚 Further Reading

- [GitHub Actions — Official Docs](https://docs.github.com/en/actions)
- [GitHub Actions Marketplace](https://github.com/marketplace?type=actions)
- [Real Python — Python CI/CD with GitHub Actions](https://realpython.com/python-continuous-integration/)

---

!!! success "Lesson Complete 🎉"
    You can now write GitHub Actions workflows, run pytest on every push, test across Python versions
    with matrix strategy, cache dependencies, and trigger deployments on success!

[⬅️ Lesson 37 · Automated Testing with Pytest](37-testing-pytest.md){ .md-button }
[➡️ Lesson 39 · Docker for Python APIs](39-docker-python-apis.md){ .md-button .md-button--primary }
