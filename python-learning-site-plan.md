# Plan: Practice Python for Beginners — GitHub Pages Site

## Top-Level Overview

Transform the current bare-bones `index.md` / `index.html` repo into a fully self-contained,
beautiful Python learning website hosted on GitHub Pages using **MkDocs + Material theme**.

The site will contain:
- A rich landing page (roadmap / table of contents)
- 100 lesson pages organised into 10 topic sections
- Code examples + an in-browser Python runner (Pyodide)
- Interactive challenges with instant "Check Answer" feedback
- A GitHub Actions workflow that auto-builds and deploys to the `gh-pages` branch on every push to `main`

**Tech stack:**
- **MkDocs** (static site generator, Markdown → HTML)
- **Material for MkDocs** theme (responsive, beautiful out of the box)
- **Pyodide** (WebAssembly Python runtime, loaded via CDN in a custom JS hook)
- **GitHub Actions** (CI/CD to `gh-pages`)

---

## Sub-Tasks

---

### Sub-Task 1 — MkDocs Project Scaffold

**Status:** `[ ] pending`

**Intent:**
Set up the MkDocs + Material project skeleton so all subsequent content sub-tasks have a
stable, working build target.

**Expected Outcomes:**
- `mkdocs.yml` exists at repo root with Material theme, navigation, and plugin config
- `docs/` folder exists with placeholder `index.md`
- `requirements.txt` lists `mkdocs-material` and any needed plugins
- Running `mkdocs build` locally produces a valid `site/` directory without errors

**Todo List:**
1. Create `requirements.txt` with: `mkdocs-material>=9`, `mkdocs-minify-plugin`, `mkdocs-git-revision-date-localized-plugin`
2. Create `mkdocs.yml` at repo root:
   - `site_name`, `site_url`, `repo_url`, `repo_name`
   - `theme: material` with palette (deep purple + teal accent), icons, features list (navigation tabs, search, content tabs, code copy, announce banner)
   - `plugins`: search, minify, git-revision-date-localized
   - `markdown_extensions`: admonitions, code blocks with line numbers, content tabs, pymdownx.superfences, pymdownx.highlight, pymdownx.details, attr_list, md_in_html
   - Full `nav:` tree matching the 10 section / 100 lesson structure (see folder layout below)
   - `extra_javascript`: `javascripts/pyodide_runner.js`
   - `extra_css`: `stylesheets/extra.css`
3. Create `docs/` folder; move/copy existing `index.md` content there and rewrite as a proper MkDocs home page (hero banner, feature cards, roadmap overview)
4. Verify `mkdocs.yml` nav tree is syntactically valid

**Relevant Context:**
- Existing content: `index.md` (100-repo roadmap table)
- Material docs: https://squidfunk.github.io/mkdocs-material/

---

### Sub-Task 2 — Folder & File Structure Creation

**Status:** `[ ] pending`

**Intent:**
Create every folder and stub Markdown file for all 100 lessons so the nav is complete and
the site builds without broken links.

**Expected Outcomes:**
- `docs/` contains sub-folders for each of the 10 sections
- Each section folder contains 10 lesson `.md` stub files
- Each stub follows a consistent template (title, objectives, intro paragraph, code block placeholder, challenge placeholder)
- A `docs/about.md` and `docs/contributing.md` exist

**Folder Layout:**
```
docs/
  index.md                          # Landing / roadmap home
  about.md
  contributing.md
  01-basics/
    01-python-basics-and-syntax.md  ← FULL lesson (Sub-Task 3)
    02-strings-and-numbers.md       ← stub
    03-data-structures.md           ← stub
    04-functions-and-modules.md     ← stub
    05-file-handling.md             ← stub
    06-exception-handling.md        ← stub
    07-intro-to-oop.md              ← stub
    08-json-and-yaml.md             ← stub
    09-http-and-requests.md         ← stub
    10-simple-rest-api-flask.md     ← stub
  02-databases/
    11-flask-crud-app.md ... 20-api-documentation-swagger.md
  03-real-world-apis/
    21-weather-api.md ... 30-user-profile-api.md
  04-async-cicd/
    31-async-python-basics.md ... 40-deploying-flask-fastapi.md
  05-security/
    41-securing-flask-apis.md ... 50-api-gateway-fastapi.md
  06-frontend/
    51-consuming-apis.md ... 60-streamlit-data-visualizer.md
  07-data-apis/
    61-data-analysis-pandas.md ... 70-data-visualization-complete.md
  08-cloud/
    71-serverless-aws-lambda.md ... 80-event-driven-pubsub.md
  09-ml-ai/
    81-ml-model-api.md ... 90-mlops-basics.md
  10-enterprise/
    91-multi-tenant-api.md ... 100-complete-portfolio-project.md
  javascripts/
    pyodide_runner.js
  stylesheets/
    extra.css
```

**Stub template (each file):**
```markdown
# Lesson N — Title

> **Section:** Section Name | **Difficulty:** ⭐⭐☆☆☆

## 🎯 Learning Objectives
- Objective 1
- Objective 2

## 📖 Introduction
<!-- TODO: Write lesson content -->

## 💻 Code Example
<!-- TODO: Add code example with Pyodide runner -->

## 🏋️ Challenge
<!-- TODO: Add interactive challenge -->

## 📚 Further Reading
- Link 1
```

**Todo List:**
1. Create all 10 section sub-folders under `docs/`
2. For each of the 100 lessons, create a stub `.md` file using the template above
3. Create `docs/about.md` (project mission, maintainers, license)
4. Create `docs/contributing.md` (how to contribute lessons, PR guidelines)
5. Create `docs/javascripts/` and `docs/stylesheets/` folders with empty placeholder files

**Relevant Context:**
- Full lesson list is in `index.md` lines 26–183
- 10 sections map directly to folder names `01-basics` through `10-enterprise`

---

### Sub-Task 3 — Full Lesson 1: Python Basics & Syntax

**Status:** `[ ] pending`

**Intent:**
Write `docs/01-basics/01-python-basics-and-syntax.md` as the site's showcase lesson —
it demonstrates the full lesson format (narrative, tabbed code examples, admonitions,
Pyodide runner, interactive challenge with answer checker) that all future lessons will follow.

**Expected Outcomes:**
- Lesson 1 page has rich narrative content covering Python syntax fundamentals
- At least 3 tabbed code examples (variables, data types, conditionals)
- A Pyodide-powered "Try it yourself" live editor block
- An interactive challenge section with 2 exercises, expected output, and "Check Answer" button
- "Next Lesson" navigation button at the bottom

**Content to cover:**
- Variables and assignment
- Built-in data types (int, float, str, bool, None)
- Type conversion
- Operators (arithmetic, comparison, logical)
- Comments
- `print()` and `input()`
- First `if/elif/else` block
- Common beginner mistakes (indentation, naming)

**Todo List:**
1. Write the full Markdown lesson with all sections above
2. Add MkDocs admonition blocks for tips, warnings, and "Did you know?" notes
3. Add `=== "Python" / === "Output"` content tabs for each code example
4. Insert the Pyodide runner HTML block (uses the `pyodide_runner.js` hook from Sub-Task 4)
5. Write 2 interactive challenge exercises with expected outputs defined in `data-expected` HTML attributes
6. Add a "➡️ Next Lesson" button linking to Lesson 2

**Relevant Context:**
- Pyodide runner implementation is defined in Sub-Task 4
- MkDocs content tabs: `===` syntax from `pymdownx.tabbed`

---

### Sub-Task 4 — Pyodide In-Browser Python Runner

**Status:** `[ ] pending`

**Intent:**
Build `docs/javascripts/pyodide_runner.js` — a lightweight client-side script that:
1. Loads Pyodide from CDN on first use (lazy, not on page load)
2. Attaches to every `.pyodide-runner` div on the page
3. Provides a "▶ Run" button that executes the code and shows stdout in an output panel
4. For challenge blocks, provides a "✅ Check Answer" button that compares stripped stdout
   to the `data-expected` attribute and shows ✅ pass or ❌ try again feedback

**Expected Outcomes:**
- `docs/javascripts/pyodide_runner.js` is a complete, self-contained script (~100–150 lines)
- "▶ Run" button works for all plain code-runner blocks
- "✅ Check Answer" works for challenge blocks
- Loading indicator shown while Pyodide initialises
- Errors from Python code are caught and displayed in red

**Implementation notes:**
- Load Pyodide via `https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js`
- Use `pyodide.runPythonAsync()` with stdout redirected via `pyodide.setStdout()`
- HTML block pattern in Markdown (via `md_in_html` extension):
  ```html
  <div class="pyodide-runner" data-mode="run">
  ```python
  print("Hello, World!")
  ```
  </div>
  ```
- Challenge block adds `data-mode="challenge"` and `data-expected="Hello, World!"`

**Todo List:**
1. Write `docs/javascripts/pyodide_runner.js` with lazy Pyodide load
2. Implement `attachRunners()` function that scans the DOM for `.pyodide-runner` divs
3. Implement stdout capture and error handling
4. Implement challenge checker comparing normalised output to `data-expected`
5. Write `docs/stylesheets/extra.css` to style the runner UI (code area, output panel, buttons)

**Relevant Context:**
- Pyodide CDN: `https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js`
- MkDocs `extra_javascript` hook loads the script on every page

---

### Sub-Task 5 — GitHub Actions CI/CD Workflow

**Status:** `[ ] pending`

**Intent:**
Create `.github/workflows/deploy.yml` so the site is automatically built and deployed
to the `gh-pages` branch on every push to `main`, making GitHub Pages always up to date.

**Expected Outcomes:**
- `.github/workflows/deploy.yml` exists
- On push to `main`: installs Python + requirements, runs `mkdocs gh-deploy --force`
- GitHub Pages is configured to serve from `gh-pages` branch
- Badge in `README.md` links to the live site

**Todo List:**
1. Create `.github/workflows/deploy.yml` using `actions/checkout@v4`, `actions/setup-python@v5`, pip install, `mkdocs gh-deploy --force`
2. Add a `Deploy` status badge to `README.md`
3. Add instructions in `docs/contributing.md` for local preview (`mkdocs serve`)

**Relevant Context:**
- GitHub Pages must be configured in repo Settings → Pages → "Deploy from branch: gh-pages"
- Standard MkDocs deploy command: `mkdocs gh-deploy --force`

---

### Sub-Task 6 — Landing Page & Navigation Polish

**Status:** `[ ] pending`

**Intent:**
Rewrite `docs/index.md` as a visually rich home page that:
- Greets learners with a hero section
- Shows the learning roadmap as visual section cards (not just a table)
- Highlights key features (100 lessons, live code runner, challenges, free & open source)
- Links to Lesson 1 as the "Start Learning" CTA

**Expected Outcomes:**
- `docs/index.md` uses Material's `hero` and feature grid HTML blocks
- Roadmap section cards (one per 10-lesson section) with emoji, title, and "Go →" link
- "Start Learning" button prominently above the fold
- Footer credits (maintainers, license)

**Todo List:**
1. Rewrite `docs/index.md` with Material `md_in_html` hero section
2. Add 10 section cards using Material's grid + card component syntax
3. Add a "Why this site?" feature list (icons + short copy)
4. Replace raw table from old `index.md` with clean card grid
5. Keep `index.html` (auto-generated by MkDocs) — do not hand-edit it

**Relevant Context:**
- Material for MkDocs grid cards: https://squidfunk.github.io/mkdocs-material/reference/grids/
- Existing `index.md` content (lines 1–207) is the source of truth for all section names

---

## File Tree Summary

```
.
├── mkdocs.yml
├── requirements.txt
├── .github/
│   └── workflows/
│       └── deploy.yml
├── docs/
│   ├── index.md
│   ├── about.md
│   ├── contributing.md
│   ├── javascripts/
│   │   └── pyodide_runner.js
│   ├── stylesheets/
│   │   └── extra.css
│   ├── 01-basics/         (10 lessons: 01–10)
│   ├── 02-databases/      (10 lessons: 11–20)
│   ├── 03-real-world-apis/(10 lessons: 21–30)
│   ├── 04-async-cicd/     (10 lessons: 31–40)
│   ├── 05-security/       (10 lessons: 41–50)
│   ├── 06-frontend/       (10 lessons: 51–60)
│   ├── 07-data-apis/      (10 lessons: 61–70)
│   ├── 08-cloud/          (10 lessons: 71–80)
│   ├── 09-ml-ai/          (10 lessons: 81–90)
│   └── 10-enterprise/     (10 lessons: 91–100)
├── index.html             (kept as-is, auto-overwritten by MkDocs build)
├── index.md               (kept as source, content moved to docs/index.md)
├── README.md              (updated with live site badge)
└── LICENSE
```

---

## Implementation Order

Sub-tasks are designed to be run in sequence:

1. **Sub-Task 1** — MkDocs scaffold (build system first)
2. **Sub-Task 2** — All folders & stub files (complete nav)
3. **Sub-Task 3** — Full Lesson 1 content (flagship lesson)
4. **Sub-Task 4** — Pyodide runner JS + CSS (interactivity)
5. **Sub-Task 5** — GitHub Actions deploy (automation)
6. **Sub-Task 6** — Landing page polish (UX finish)
