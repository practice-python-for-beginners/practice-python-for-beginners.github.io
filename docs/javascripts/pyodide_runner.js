/**
 * pyodide_runner.js
 * In-browser Python runner for Practice Python for Beginners.
 *
 * Scans the page for .pyodide-runner divs and attaches:
 *   - "▶ Run" button for data-mode="run"
 *   - "✅ Check Answer" button for data-mode="challenge"
 *
 * Pyodide is lazy-loaded from CDN on first click.
 */

(function () {
  "use strict";

  const PYODIDE_CDN =
    "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js";

  let pyodideInstance = null;
  let pyodideLoading = false;
  let pyodideQueue = [];

  /* ──────────────────────────────────────────────────────────
   * Load Pyodide (once, lazily)
   * ─────────────────────────────────────────────────────── */
  function loadPyodide() {
    return new Promise((resolve, reject) => {
      if (pyodideInstance) {
        resolve(pyodideInstance);
        return;
      }
      pyodideQueue.push({ resolve, reject });
      if (pyodideLoading) return;

      pyodideLoading = true;

      const script = document.createElement("script");
      script.src = PYODIDE_CDN;
      script.onload = async () => {
        try {
          const pyodide = await window.loadPyodide();
          pyodideInstance = pyodide;
          pyodideQueue.forEach((p) => p.resolve(pyodide));
          pyodideQueue = [];
        } catch (err) {
          pyodideQueue.forEach((p) => p.reject(err));
          pyodideQueue = [];
        }
      };
      script.onerror = (err) => {
        pyodideQueue.forEach((p) => p.reject(err));
        pyodideQueue = [];
      };
      document.head.appendChild(script);
    });
  }

  /* ──────────────────────────────────────────────────────────
   * Run Python code, capture stdout + stderr
   * ─────────────────────────────────────────────────────── */
  async function runPython(code) {
    const pyodide = await loadPyodide();

    let stdout = "";
    let stderr = "";

    pyodide.setStdout({ batched: (s) => { stdout += s + "\n"; } });
    pyodide.setStderr({ batched: (s) => { stderr += s + "\n"; } });

    try {
      await pyodide.runPythonAsync(code);
    } catch (err) {
      stderr += err.message;
    }

    return { stdout: stdout.trimEnd(), stderr: stderr.trimEnd() };
  }

  /* ──────────────────────────────────────────────────────────
   * Build the runner UI and inject it into a container div
   * ─────────────────────────────────────────────────────── */
  function buildRunnerUI(container) {
    const mode = container.dataset.mode || "run";
    const expected = (container.dataset.expected || "").trim();

    // Extract the code from the <pre><code> inside the container
    const codeEl = container.querySelector("code");
    const initialCode = codeEl ? codeEl.textContent.trim() : "";

    // Build DOM
    container.innerHTML = ""; // clear the raw pre/code block
    container.classList.add("pyodide-widget");

    // — textarea (editable code)
    const textarea = document.createElement("textarea");
    textarea.className = "pyodide-editor";
    textarea.spellcheck = false;
    textarea.autocomplete = "off";
    textarea.value = initialCode;
    container.appendChild(textarea);

    // — toolbar
    const toolbar = document.createElement("div");
    toolbar.className = "pyodide-toolbar";

    const runBtn = document.createElement("button");
    runBtn.className = "pyodide-btn pyodide-btn--run";
    runBtn.textContent = "▶ Run";
    toolbar.appendChild(runBtn);

    if (mode === "challenge") {
      const checkBtn = document.createElement("button");
      checkBtn.className = "pyodide-btn pyodide-btn--check";
      checkBtn.textContent = "✅ Check Answer";
      toolbar.appendChild(checkBtn);

      checkBtn.addEventListener("click", async () => {
        await execute(textarea.value, output, loader, "check", expected, feedback);
      });
    }

    const resetBtn = document.createElement("button");
    resetBtn.className = "pyodide-btn pyodide-btn--reset";
    resetBtn.textContent = "↺ Reset";
    resetBtn.title = "Restore original code";
    toolbar.appendChild(resetBtn);

    container.appendChild(toolbar);

    // — loader
    const loader = document.createElement("div");
    loader.className = "pyodide-loader";
    loader.textContent = "⏳ Loading Python runtime…";
    loader.hidden = true;
    container.appendChild(loader);

    // — output
    const output = document.createElement("pre");
    output.className = "pyodide-output";
    output.hidden = true;
    container.appendChild(output);

    // — feedback (challenges only)
    const feedback = document.createElement("div");
    feedback.className = "pyodide-feedback";
    feedback.hidden = true;
    container.appendChild(feedback);

    // Wire up Run button
    runBtn.addEventListener("click", async () => {
      await execute(textarea.value, output, loader, "run", null, feedback);
    });

    // Wire up Reset button
    resetBtn.addEventListener("click", () => {
      textarea.value = initialCode;
      output.hidden = true;
      feedback.hidden = true;
    });

    // Auto-resize textarea
    textarea.addEventListener("input", () => autoResize(textarea));
    autoResize(textarea);
  }

  /* ──────────────────────────────────────────────────────────
   * Execute code and update UI
   * ─────────────────────────────────────────────────────── */
  async function execute(code, outputEl, loaderEl, mode, expected, feedbackEl) {
    outputEl.hidden = true;
    feedbackEl.hidden = true;
    loaderEl.hidden = false;

    const { stdout, stderr } = await runPython(code);

    loaderEl.hidden = true;
    outputEl.hidden = false;

    if (stderr) {
      outputEl.className = "pyodide-output pyodide-output--error";
      outputEl.textContent = stderr;
    } else {
      outputEl.className = "pyodide-output";
      outputEl.textContent = stdout || "(no output)";
    }

    if (mode === "check" && expected !== null) {
      feedbackEl.hidden = false;
      const actual = stdout.trim();
      const pass = actual === expected.trim();
      feedbackEl.className = pass
        ? "pyodide-feedback pyodide-feedback--pass"
        : "pyodide-feedback pyodide-feedback--fail";
      feedbackEl.textContent = pass
        ? "✅ Correct! Great work."
        : `❌ Not quite. Expected:\n${expected}\n\nYour output:\n${actual}`;
    }
  }

  /* ──────────────────────────────────────────────────────────
   * Auto-resize textarea to fit content
   * ─────────────────────────────────────────────────────── */
  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  /* ──────────────────────────────────────────────────────────
   * Initialise all runners on the page
   * ─────────────────────────────────────────────────────── */
  function attachRunners() {
    document
      .querySelectorAll(".pyodide-runner")
      .forEach((el) => buildRunnerUI(el));
  }

  /* Run on initial page load and on MkDocs SPA navigation */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachRunners);
  } else {
    attachRunners();
  }

  /* MkDocs Material uses instant navigation — re-attach after each page swap */
  document.addEventListener("DOMContentSwitch", attachRunners);
})();
