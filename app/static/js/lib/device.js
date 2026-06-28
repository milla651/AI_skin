/* Lumen :: device.js
   - Sets the `lumen.tzoff` cookie so the server can compute local_date
     for streak tracking.
   - Fetches /api/streak and populates the sidebar streak widget.
   - Runs on every page load.
*/
(function () {
  // ---- Timezone offset cookie ----
  var offsetMin = new Date().getTimezoneOffset();
  document.cookie =
    "lumen.tzoff=" + String(offsetMin) + ";path=/;max-age=31536000;SameSite=Lax";

  // ---- Streak widget ----
  async function loadStreak() {
    try {
      var resp = await fetch("/api/streak");
      if (!resp.ok) return;
      var data = await resp.json();

      var valueEl = document.querySelector("[data-streak-value]");
      var metaEl = document.querySelector("[data-streak-meta]");

      if (valueEl) {
        if (data.current > 0) {
          valueEl.innerHTML =
            "\uD83D\uDD25 " + data.current + "<small> day" + (data.current !== 1 ? "s" : "") + "</small>";
        } else {
          valueEl.textContent = "\u2014";
        }
      }
      if (metaEl) {
        if (data.current > 0) {
          metaEl.textContent =
            "Longest: " + data.longest + " day" + (data.longest !== 1 ? "s" : "");
        } else {
          metaEl.innerHTML =
            '<a href="/" style="color:var(--accent)">Start a streak \u2192</a>';
        }
      }

      // last7 dots
      if (data.last7 && data.last7.length) {
        var existing = document.querySelector("[data-streak-dots]");
        if (!existing) {
          var container = document.createElement("div");
          container.setAttribute("data-streak-dots", "");
          container.style.cssText = "display:flex;gap:4px;margin-top:8px;";
          data.last7.forEach(function (filled) {
            var dot = document.createElement("span");
            dot.style.cssText =
              "width:8px;height:8px;border-radius:50%;background:" +
              (filled ? "var(--accent)" : "var(--surface-edge)") + ";";
            dot.title = filled ? "Scanned" : "Missed";
            container.appendChild(dot);
          });
          var statEl = document.querySelector("[data-streak]");
          if (statEl) statEl.appendChild(container);
        }
      }
    } catch (e) {
      // Silent fail
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadStreak);
  } else {
    loadStreak();
  }
})();
