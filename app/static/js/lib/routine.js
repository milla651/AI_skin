/* Skinna :: routine.js — personalised AM/PM skincare routine builder
   Loads routines.json, picks the routine for the user's skin type,
   and renders it into a host element.
*/
(function () {
  var cache = null;

  async function loadRoutines() {
    if (cache) return cache;
    try {
      var resp = await fetch("/static/data/routines.json");
      if (!resp.ok) return {};
      cache = await resp.json();
      return cache;
    } catch (e) {
      return {};
    }
  }

  /**
   * @param {HTMLElement} host
   * @param {string} skinType — "oily" | "dry" | "combination" | "normal"
   */
  async function renderRoutine(host, skinType) {
    if (!host) return;
    var all = await loadRoutines();
    var routine = all[skinType] || all["normal"] || {};

    if (!routine.am && !routine.pm) {
      host.hidden = true;
      return;
    }

    host.hidden = false;
    host.innerHTML = "";

    var title = document.createElement("h3");
    title.className = "routine-title";
    title.textContent = "Your routine";
    host.appendChild(title);

    var grid = document.createElement("div");
    grid.className = "routine-grid";

    ["am", "pm"].forEach(function (period) {
      var steps = routine[period];
      if (!steps || !steps.length) return;

      var col = document.createElement("div");
      col.className = "routine-col";

      var heading = document.createElement("div");
      heading.className = "routine-period";
      heading.textContent = period === "am" ? "☀ Morning" : "☾ Evening";
      col.appendChild(heading);

      var list = document.createElement("ol");
      list.className = "routine-steps";

      steps.forEach(function (s, i) {
        var li = document.createElement("li");
        li.className = "routine-step";
        li.innerHTML =
          '<span class="routine-step-num">' + (i + 1) + "</span>" +
          '<div class="routine-step-body">' +
          '<div class="routine-step-name">' + s.step + "</div>" +
          '<div class="routine-step-detail">' + s.detail + "</div>" +
          '<div class="routine-step-ingredient">Look for: ' + s.ingredient + "</div>" +
          "</div>";
        list.appendChild(li);
      });

      col.appendChild(list);
      grid.appendChild(col);
    });

    host.appendChild(grid);
  }

  window.SkinnaRoutine = { renderRoutine: renderRoutine };
})();
