/* Skinna :: compare page
   Fetches /api/compare, renders side-by-side portraits + delta table.
*/
(() => {
  const main = document.querySelector(".compare");
  if (!main) return;

  const aId = main.dataset.a || "";
  const bId = main.dataset.b || "";

  const loadingEl = document.getElementById("compare-loading");
  const emptyEl = document.getElementById("compare-empty");
  const bodyEl = document.getElementById("compare-body");

  async function load() {
    let url = "/api/compare";
    if (aId && bId) url += `?a=${aId}&b=${bId}`;

    let data;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed");
      }
      data = await resp.json();
    } catch (e) {
      if (loadingEl) loadingEl.hidden = true;
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.querySelector("p").textContent = e.message || "Could not load comparison.";
      }
      return;
    }

    if (loadingEl) loadingEl.hidden = true;
    if (bodyEl) bodyEl.hidden = false;

    renderScoreDiff(data);
    renderPortraits(data);
    renderDeltas(data);
    renderMeta(data);
  }

  function renderScoreDiff(data) {
    const el = document.getElementById("compare-score-diff");
    if (!el) return;
    const diff = data.overall_diff || 0;
    const cls = diff > 0 ? "diff-positive" : diff < 0 ? "diff-negative" : "diff-neutral";
    const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "—";
    const scoreA = data.a?.result?.overall_score ?? "—";
    const scoreB = data.b?.result?.overall_score ?? "—";
    el.innerHTML = `
      <div class="diff-value ${cls}">${arrow} ${Math.abs(diff)}</div>
      <div class="diff-label">Overall: ${scoreA} → ${scoreB} (${diff > 0 ? "+" : ""}${diff} pts)</div>
    `;
  }

  function renderPortraits(data) {
    const imgA = document.getElementById("compare-img-a");
    const imgB = document.getElementById("compare-img-b");
    if (imgA && data.a?.image_path_url) imgA.src = data.a.image_path_url;
    if (imgB && data.b?.image_path_url) imgB.src = data.b.image_path_url;
  }

  function renderDeltas(data) {
    const tbody = document.getElementById("compare-tbody");
    if (!tbody || !data.deltas) return;

    const LABELS = {
      redness: "Redness",
      pigmentation: "Pigmentation",
      wrinkles: "Wrinkles",
      pores: "Pores",
      dark_circles: "Dark Circles",
      acne: "Acne",
    };

    tbody.innerHTML = "";
    for (const [key, d] of Object.entries(data.deltas)) {
      const label = LABELS[key] || key.replace(/_/g, " ");
      const dir = d.direction;
      const cls = d.muted
        ? "delta-muted"
        : dir === "better"
        ? "delta-better"
        : dir === "worse"
        ? "delta-worse"
        : "delta-same";

      const arrow =
        dir === "better" ? '<span class="arrow">▼</span>' :
        dir === "worse"  ? '<span class="arrow">▲</span>' : "";
      const diffStr =
        d.diff != null
          ? `${arrow}${d.diff > 0 ? "+" : ""}${d.diff} (${d.pct > 0 ? "+" : ""}${d.pct}%)`
          : "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="metric-name">${label}</td>
        <td>${d.a ?? "—"}</td>
        <td>${d.b ?? "—"}</td>
        <td class="${cls}">${diffStr}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderMeta(data) {
    const el = document.getElementById("compare-meta");
    if (!el) return;
    const dateA = data.a?.created_at ? new Date(data.a.created_at).toLocaleDateString() : "—";
    const dateB = data.b?.created_at ? new Date(data.b.created_at).toLocaleDateString() : "—";
    el.innerHTML = `
      Latest: ${dateA} · Previous: ${dateB}
      &nbsp;·&nbsp;
      <a href="/compare/${data.a?.id || ""}/${data.b?.id || ""}">Permalink</a>
    `;
  }

  load();
})();
