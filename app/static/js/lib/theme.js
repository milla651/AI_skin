/* Skinna :: theme manager
   - Reads/writes `skinna.theme` in localStorage ("light" | "dark" | "system")
   - Sets [data-theme] on <html>
   - Falls back to prefers-color-scheme when mode is "system"
   - Init is also exposed inline in <head> to prevent flash-of-wrong-theme.
*/
(function () {
  const STORAGE_KEY = "skinna.theme";
  const MODES = ["light", "dark", "system"];

  function systemPref() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function resolved(mode) {
    return mode === "system" ? systemPref() : mode;
  }

  function read() {
    const v = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(v) ? v : "system";
  }

  function apply(mode) {
    document.documentElement.setAttribute("data-theme", resolved(mode));
    document.documentElement.setAttribute("data-theme-mode", mode);
  }

  function set(mode) {
    if (!MODES.includes(mode)) return;
    localStorage.setItem(STORAGE_KEY, mode);
    apply(mode);
    dispatch();
  }

  function cycle() {
    const order = ["light", "dark", "system"];
    const next = order[(order.indexOf(read()) + 1) % order.length];
    set(next);
    return next;
  }

  function dispatch() {
    window.dispatchEvent(
      new CustomEvent("skinna:theme", {
        detail: { mode: read(), resolved: resolved(read()) },
      })
    );
  }

  // React to system change while in "system" mode
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener?.("change", () => {
    if (read() === "system") {
      apply("system");
      dispatch();
    }
  });

  // Wire up any [data-theme-toggle] buttons on the page
  function wireToggles() {
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const m = cycle();
        btn.setAttribute("data-theme-mode", m);
        const label = btn.querySelector("[data-theme-label]");
        if (label) label.textContent = m;
      });
      // initial label
      const label = btn.querySelector("[data-theme-label]");
      if (label) label.textContent = read();
      btn.setAttribute("data-theme-mode", read());
    });
  }

  // Public API
  window.SkinnaTheme = { read, set, cycle, resolved, apply };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireToggles);
  } else {
    wireToggles();
  }

  // Ensure attribute is set (in case the inline init was skipped)
  apply(read());
})();
