---
title: "Lesson 22 · To-Do List REST API"
description: "Design a full CRUD REST API for a to-do list with priorities, due dates, filtering, sorting, and pagination using in-memory storage."
---

# Lesson 22 · To-Do List REST API

> **Section:** 🌐 Real-World API Projects &nbsp;|&nbsp; **Difficulty:** ⭐⭐⭐☆☆ &nbsp;|&nbsp; **Time:** ~60 minutes

---

## 🎯 Learning Objectives

By the end of this lesson you will be able to:

- [ ] Design a full CRUD REST API for a task resource
- [ ] Use in-memory dicts to store and manage tasks
- [ ] Add priority levels (`low`, `medium`, `high`) and ISO due dates
- [ ] Filter tasks by priority and completion status
- [ ] Sort tasks by due date and paginate with `limit`/`offset`

---

## 📖 Introduction

A to-do list API is a classic project for learning REST design. It covers every HTTP verb — `GET`, `POST`, `PUT`, `PATCH`, `DELETE` — and forces you to think about data validation, filtering, and pagination. By building it in-memory first you focus on the logic before adding a database.

!!! info "In-memory storage"
    All tasks are stored in a plain Python dict. This means data is lost when the process restarts. That is intentional here — it keeps the code simple and browser-runnable. In production you'd swap the dict for SQLite or PostgreSQL.

---

## 1. Designing the Task Resource

Every task has a fixed schema:

=== "Python"
    ```python
    import uuid
    from datetime import date

    def create_task(title: str, priority: str = "medium",
                    due_date: str = None) -> dict:
        """Create a new task dict."""
        allowed = {"low", "medium", "high"}
        if priority not in allowed:
            raise ValueError(f"priority must be one of {allowed}")
        return {
            "id":         str(uuid.uuid4())[:8],
            "title":      title,
            "priority":   priority,
            "due_date":   due_date,       # ISO format: "2024-12-31"
            "status":     "pending",      # "pending" | "done"
            "created_at": str(date.today()),
        }

    task = create_task("Write unit tests", priority="high", due_date="2024-12-01")
    for k, v in task.items():
        print(f"  {k}: {v}")
    ```
=== "Output"
    ```
      id: a1b2c3d4
      title: Write unit tests
      priority: high
      due_date: 2024-12-01
      status: pending
      created_at: 2024-11-15
    ```

!!! tip "ISO 8601 dates"
    Always store dates as `"YYYY-MM-DD"` strings. They sort correctly as plain strings and are unambiguous across locales.

---

## 2. CRUD Operations

With the schema defined, we build four core operations:

=== "Python"
    ```python
    tasks = {}   # id → task dict

    def add_task(title, priority="medium", due_date=None):
        task = {
            "id": str(len(tasks) + 1),
            "title": title, "priority": priority,
            "due_date": due_date, "status": "pending",
        }
        tasks[task["id"]] = task
        return task

    def get_task(task_id):
        return tasks.get(task_id)

    def update_task(task_id, **fields):
        if task_id not in tasks:
            return None
        tasks[task_id].update(fields)
        return tasks[task_id]

    def delete_task(task_id):
        return tasks.pop(task_id, None) is not None

    # Demo
    add_task("Buy groceries", "low",    "2024-11-20")
    add_task("Fix bug #42",   "high",   "2024-11-18")
    add_task("Read book",     "medium", "2024-11-25")

    print("Total tasks:", len(tasks))
    update_task("2", status="done")
    print("Bug status:", tasks["2"]["status"])
    delete_task("3")
    print("After delete:", len(tasks))
    ```
=== "Output"
    ```
    Total tasks: 3
    Bug status: done
    After delete: 2
    ```

---

## 3. Filtering by Priority and Status

=== "Python"
    ```python
    def filter_tasks(all_tasks, priority=None, status=None):
        result = list(all_tasks.values())
        if priority:
            result = [t for t in result if t["priority"] == priority]
        if status:
            result = [t for t in result if t["status"] == status]
        return result

    tasks = {
        "1": {"title": "Task A", "priority": "high",   "status": "pending"},
        "2": {"title": "Task B", "priority": "high",   "status": "done"},
        "3": {"title": "Task C", "priority": "medium", "status": "pending"},
        "4": {"title": "Task D", "priority": "low",    "status": "pending"},
    }

    high_tasks    = filter_tasks(tasks, priority="high")
    pending_tasks = filter_tasks(tasks, status="pending")

    print(f"High priority: {len(high_tasks)}")
    print(f"Pending:       {len(pending_tasks)}")
    for t in high_tasks:
        print(f"  [{t['status']}] {t['title']}")
    ```
=== "Output"
    ```
    High priority: 2
    Pending:       3
      [pending] Task A
      [done] Task B
    ```

!!! warning "Case sensitivity in filters"
    Always normalise filter values: `priority.lower()` before comparing. A client sending `"High"` instead of `"high"` will get unexpected empty results otherwise.

---

## 4. Sorting Tasks by Due Date

=== "Python"
    ```python
    def sort_by_due_date(task_list, ascending=True):
        # Tasks without a due_date sort to the end
        return sorted(
            task_list,
            key=lambda t: t["due_date"] or "9999-99-99",
            reverse=not ascending,
        )

    task_list = [
        {"title": "Task A", "due_date": "2024-12-10"},
        {"title": "Task B", "due_date": None},
        {"title": "Task C", "due_date": "2024-11-20"},
        {"title": "Task D", "due_date": "2024-12-01"},
    ]

    for t in sort_by_due_date(task_list):
        print(f"{t['due_date'] or 'no date':12}  {t['title']}")
    ```
=== "Output"
    ```
    2024-11-20    Task C
    2024-12-01    Task D
    2024-12-10    Task A
    no date       Task B
    ```

---

## 5. Pagination with `limit` and `offset`

=== "Python"
    ```python
    def paginate(items: list, limit: int = 10, offset: int = 0) -> dict:
        total  = len(items)
        page   = items[offset: offset + limit]
        return {
            "total":  total,
            "limit":  limit,
            "offset": offset,
            "count":  len(page),
            "items":  page,
        }

    all_tasks = [{"id": str(i), "title": f"Task {i}"} for i in range(1, 16)]

    page1 = paginate(all_tasks, limit=5, offset=0)
    page2 = paginate(all_tasks, limit=5, offset=5)

    print(f"Total: {page1['total']}")
    print(f"Page 1 items: {[t['id'] for t in page1['items']]}")
    print(f"Page 2 items: {[t['id'] for t in page2['items']]}")
    ```
=== "Output"
    ```
    Total: 15
    Page 1 items: ['1', '2', '3', '4', '5']
    Page 2 items: ['6', '7', '8', '9', '10']
    ```

!!! note "Cursor-based pagination"
    For large, frequently-updated datasets prefer cursor-based pagination (using the last seen `id`) over `offset`. Offset pagination can skip or duplicate rows when records are inserted between requests.

---

## 💻 Try It Yourself

Demo task manager with add, complete, and filter operations:

<div class="pyodide-runner" data-mode="run">
<pre><code class="language-python">tasks = {}

def add(id_, title, priority="medium", due_date=None):
    tasks[id_] = {"id": id_, "title": title, "priority": priority,
                  "due_date": due_date, "status": "pending"}

def complete(id_):
    if id_ in tasks:
        tasks[id_]["status"] = "done"

def list_tasks(priority=None):
    return [t for t in tasks.values()
            if priority is None or t["priority"] == priority]

add("1", "Deploy to production", "high",   "2024-11-30")
add("2", "Write docs",           "medium", "2024-12-05")
add("3", "Fix login bug",        "high",   "2024-11-28")
add("4", "Update README",        "low",    None)

complete("1")

high = list_tasks("high")
print(f"High priority tasks: {len(high)}")
for t in high:
    print(f"  [{t['status']:7}] {t['title']}")
</code></pre>
</div>

---

## 🏋️ Challenges

### Challenge 1 — Count High-Priority Tasks

Filter the task list to find only `"high"` priority tasks and print the count.

<div class="pyodide-runner" data-mode="challenge" data-expected="2">
<pre><code class="language-python">tasks = [
    {"title": "Fix critical bug", "priority": "high",   "status": "pending"},
    {"title": "Write tests",      "priority": "medium", "status": "pending"},
    {"title": "Deploy hotfix",    "priority": "high",   "status": "pending"},
    {"title": "Update changelog", "priority": "low",    "status": "done"},
]

# Filter to high priority and print just the count
</code></pre>
</div>

---

### Challenge 2 — Mark a Task Done

Mark the task with `id="3"` as done and print its status.

<div class="pyodide-runner" data-mode="challenge" data-expected="done">
<pre><code class="language-python">tasks = {
    "1": {"title": "Task A", "status": "pending"},
    "2": {"title": "Task B", "status": "pending"},
    "3": {"title": "Task C", "status": "pending"},
}

# Mark tasks["3"] as done, then print its status
</code></pre>
</div>

---

## 📚 Further Reading

- [REST API Design Best Practices](https://restfulapi.net/)
- [Real Python — Build a REST API with Flask](https://realpython.com/flask-connexion-rest-api/)
- [JSON:API Specification for Pagination](https://jsonapi.org/format/#fetching-pagination)

---

!!! success "Lesson Complete 🎉"
    You've built a full CRUD to-do API with filtering, sorting, and pagination — all the building blocks you need before adding a real database.

[⬅️ Lesson 21 · Weather API](21-weather-api.md){ .md-button } [➡️ Lesson 23 · Currency Converter API](23-currency-converter.md){ .md-button .md-button--primary }
