/* Lumen :: result poller (Phase 1–3)
   Polls /api/result/<id> until done, then:
     - hydrates score & skin-type badge
     - renders 6 radial gauges with severity colours + per-metric tips
     - fills in recommendations
     - inits annotated overlay tabs (Phase 3)
     - wires PDF export button (Phase 3)
*/
(() => {
  const id = window.__ANALYSIS_ID__;
  if (!id) return;

  const STATUS_TEXT = {
    queued:  "queued",
    pending: "queued",
    running: "scanning",
    done:    "ready",
    error:   "trouble",
  };

  const METRICS = [
    { key: "redness",      label: "01 · REDNESS",      name: "Flush & flare" },
    { key: "pigmentation", label: "02 · PIGMENTATION", name: "Spotted tone" },
    { key: "wrinkles",     label: "03 · WRINKLES",     name: "Fine lines" },
    { key: "pores",        label: "04 · PORES",        name: "Open count" },
    { key: "dark_circles", label: "05 · DARK CIRCLES", name: "Under-eye shadow" },
    { key: "acne",         label: "06 · ACNE",         name: "Breakouts" },
  ];

  const METRIC_LABELS = {
    redness: "Redness", pigmentation: "Pigmentation", wrinkles: "Wrinkles",
    pores: "Pores", dark_circles: "Dark Circles", acne: "Acne",
  };

  const els = {
    img:          document.getElementById("r-image"),
    portraitWrap: document.getElementById("r-portrait-wrap"),
    statusDot:    document.getElementById("r-status-dot"),
    statusText:   document.getElementById("r-status-text"),
    score:        document.getElementById("r-score"),
    skintype:     document.getElementById("r-skintype-host"),
    recs:         document.getElementById("r-recs"),
    recList:      document.getElementById("r-rec-list"),
    gauges:       document.getElementById("r-gauges"),
    pdfBtn:       document.getElementById("r-pdf-btn"),
  };

  let rendered = false;

  async function poll() {
    let data;
    try {
      const res = await fetch(`/api/result/${id}`);
      if (!res.ok) throw new Error("Result fetch failed");
      data = await res.json();
    } catch (err) {
      console.error(err);
      setTimeout(poll, 2000);
      return;
    }

    await render(data);

    if (data.status === "done" || data.status === "error") return;
    setTimeout(poll, 1500);
  }

  async function render(data) {
    if (els.statusDot) els.statusDot.className = `dot ${data.status}`;
    if (els.statusText) els.statusText.textContent = STATUS_TEXT[data.status] || data.status;

    if (data.image_path_url && els.img && els.img.src !== data.image_path_url) {
      els.img.src = data.image_path_url;
    }

    if (data.status === "done" && data.result && !rendered) {
      rendered = true;
      const r = data.result;

      // Score
      if (els.score) {
        const from = parseInt(els.score.textContent, 10) || 0;
        animateNumber(els.score, from, Number(r.overall_score) || 0, 1100);
      }

      // Skin type
      if (els.skintype && window.LumenSkinType) {
        window.LumenSkinType.renderSkinTypeBadge(els.skintype, r);
      }

      // Gauges
      if (els.gauges && window.LumenGauge) {
        els.gauges.innerHTML = "";
        for (const m of METRICS) {
          const v = Number(r.metrics?.[m.key]);
          if (Number.isFinite(v)) {
            const host = document.createElement("article");
            els.gauges.appendChild(host);
            const tip = window.LumenTips
              ? await window.LumenTips.getTip(m.key, v).catch(() => null)
              : null;
            window.LumenGauge.createGauge(host, { ...m, value: v, tip });
          }
        }
      }

      // Recommendations
      if (r.recommendations?.length && els.recs && els.recList) {
        els.recs.hidden = false;
        els.recList.innerHTML = "";
        r.recommendations.forEach((rec) => {
          const li = document.createElement("li");
          li.textContent = rec;
          els.recList.appendChild(li);
        });
      }

      // ---- Phase 3: Overlay ----
      if (r.regions && els.portraitWrap && els.img && window.LumenOverlay) {
        window.LumenOverlay.initOverlay(els.portraitWrap, els.img, r.regions);
      }

      // ---- Phase 3: PDF export ----
      if (els.pdfBtn) {
        els.pdfBtn.hidden = false;
        populatePdfTemplate(r, data);
        els.pdfBtn.addEventListener("click", () => {
          if (window.LumenPDF) {
            window.LumenPDF.exportPDF(id);
          }
        });
      }

    } else if (data.status === "error") {
      if (els.score) els.score.textContent = "ERR";
      if (els.skintype) {
        els.skintype.innerHTML = `<span class="badge badge-bad"><span class="badge-dot"></span>${
          (data.error || "something went wrong").slice(0, 80)
        }</span>`;
      }
    }
  }

  function populatePdfTemplate(r, data) {
    const scoreEl = document.getElementById("pdf-score");
    const dateEl = document.getElementById("pdf-date");
    const typeEl = document.getElementById("pdf-skintype");
    const metricsEl = document.getElementById("pdf-metrics");
    const recsEl = document.getElementById("pdf-recs");
    const idEl = document.getElementById("pdf-id");

    if (scoreEl) scoreEl.textContent = r.overall_score ?? "—";
    if (dateEl) {
      const d = data.created_at ? new Date(data.created_at) : new Date();
      dateEl.textContent = d.toLocaleDateString(undefined, {
        year: "numeric", month: "long", day: "numeric",
      });
    }
    if (typeEl) {
      typeEl.innerHTML = `Skin type · <b>${(r.skin_type || "unknown").toUpperCase()}</b>`;
    }
    if (metricsEl && r.metrics) {
      metricsEl.innerHTML = "";
      for (const [key, val] of Object.entries(r.metrics)) {
        const label = METRIC_LABELS[key] || key.replace(/_/g, " ");
        metricsEl.innerHTML += `
          <div class="pdf-metric">
            <div class="pdf-metric-label">${label}</div>
            <div class="pdf-metric-value">${val}</div>
            <div class="pdf-metric-unit">/ 100</div>
          </div>
        `;
      }
    }
    if (recsEl && r.recommendations) {
      recsEl.innerHTML = "";
      r.recommendations.forEach((rec) => {
        const li = document.createElement("li");
        li.textContent = rec;
        recsEl.appendChild(li);
      });
    }
    if (idEl) {
      idEl.textContent = `Reading #${(id || "").slice(0, 8)}`;
    }
  }

  function animateNumber(el, from, to, ms) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el.textContent = Math.round(to);
      return;
    }
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  poll();
})();
