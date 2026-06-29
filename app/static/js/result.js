/* Skinna :: result poller (Phase 1–4)
   Polls /api/result/<id> until done, then:
     - hydrates score, skin age, skin-type badge
     - renders 6 radial gauges with severity colours + per-metric tips
     - fills in recommendations
     - inits annotated overlay tabs (Phase 3)
     - wires PDF export + share card buttons (Phase 3–4)
     - renders routine builder (Phase 4)
     - wires skin journal / notes (Phase 4)
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
    img:           document.getElementById("r-image"),
    portraitWrap:  document.getElementById("r-portrait-wrap"),
    statusDot:     document.getElementById("r-status-dot"),
    statusText:    document.getElementById("r-status-text"),
    score:         document.getElementById("r-score"),
    skinAge:       document.getElementById("r-skin-age"),
    skinAgeValue:  document.getElementById("r-skin-age-value"),
    skintype:      document.getElementById("r-skintype-host"),
    recs:          document.getElementById("r-recs"),
    recList:       document.getElementById("r-rec-list"),
    gauges:        document.getElementById("r-gauges"),
    pdfBtn:        document.getElementById("r-pdf-btn"),
    shareActions:  document.getElementById("r-share-actions"),
    shareCopy:     document.getElementById("r-share-copy"),
    shareDownload: document.getElementById("r-share-download"),
    routine:       document.getElementById("r-routine"),
    notesSection:  document.getElementById("r-notes-section"),
    notesTextarea: document.getElementById("r-notes-textarea"),
    notesSave:     document.getElementById("r-notes-save"),
    notesSaved:    document.getElementById("r-notes-saved"),
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

      // Skin age (Phase 4)
      if (r.skin_age && els.skinAge && els.skinAgeValue) {
        els.skinAge.hidden = false;
        animateNumber(els.skinAgeValue, 18, Number(r.skin_age), 900);
      }

      // Skin type
      if (els.skintype && window.SkinnaSkinType) {
        window.SkinnaSkinType.renderSkinTypeBadge(els.skintype, r);
      }

      // Gauges
      if (els.gauges && window.SkinnaGauge) {
        els.gauges.innerHTML = "";
        for (const m of METRICS) {
          const v = Number(r.metrics?.[m.key]);
          if (Number.isFinite(v)) {
            const host = document.createElement("article");
            els.gauges.appendChild(host);
            const tip = window.SkinnaTips
              ? await window.SkinnaTips.getTip(m.key, v).catch(() => null)
              : null;
            window.SkinnaGauge.createGauge(host, { ...m, value: v, tip });
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

      // Overlay (Phase 3)
      if (r.regions && els.portraitWrap && els.img && window.SkinnaOverlay) {
        window.SkinnaOverlay.initOverlay(els.portraitWrap, els.img, r.regions);
      }

      // PDF export (Phase 3)
      if (els.pdfBtn) {
        els.pdfBtn.hidden = false;
        populatePdfTemplate(r, data);
        els.pdfBtn.addEventListener("click", () => {
          if (window.SkinnaPDF) window.SkinnaPDF.exportPDF(id);
        });
      }

      // Share card (Phase 4)
      if (els.shareActions) {
        els.shareActions.hidden = false;
        populateShareCard(r, data);
        if (els.shareCopy) {
          els.shareCopy.addEventListener("click", () => {
            if (window.SkinnaShare) window.SkinnaShare.shareCard("clipboard");
          });
        }
        if (els.shareDownload) {
          els.shareDownload.addEventListener("click", () => {
            if (window.SkinnaShare) window.SkinnaShare.shareCard("download");
          });
        }
      }

      // Routine builder (Phase 4)
      if (els.routine && r.skin_type && window.SkinnaRoutine) {
        window.SkinnaRoutine.renderRoutine(els.routine, r.skin_type);
      }

      // Notes (Phase 4)
      wireNotes(data);

    } else if (data.status === "error") {
      if (els.score) els.score.textContent = "ERR";
      if (els.skintype) {
        els.skintype.innerHTML = `<span class="badge badge-bad"><span class="badge-dot"></span>${
          (data.error || "something went wrong").slice(0, 80)
        }</span>`;
      }
    }
  }

  // ---- Notes ----
  function wireNotes(data) {
    if (!els.notesSection) return;
    els.notesSection.hidden = false;

    // Pre-fill existing notes
    if (data.notes && els.notesTextarea) {
      els.notesTextarea.value = data.notes;
    }

    if (els.notesSave) {
      els.notesSave.addEventListener("click", async () => {
        els.notesSave.disabled = true;
        try {
          const resp = await fetch(`/api/result/${id}/notes`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: els.notesTextarea.value }),
          });
          if (resp.ok && els.notesSaved) {
            els.notesSaved.classList.add("is-visible");
            setTimeout(() => els.notesSaved.classList.remove("is-visible"), 2000);
          }
        } catch (e) {
          console.error(e);
        } finally {
          els.notesSave.disabled = false;
        }
      });
    }
  }

  // ---- PDF template ----
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
    if (typeEl) typeEl.innerHTML = `Skin type · <b>${(r.skin_type || "unknown").toUpperCase()}</b>`;
    if (metricsEl && r.metrics) {
      metricsEl.innerHTML = "";
      for (const [key, val] of Object.entries(r.metrics)) {
        const label = METRIC_LABELS[key] || key.replace(/_/g, " ");
        metricsEl.innerHTML += `
          <div class="pdf-metric">
            <div class="pdf-metric-label">${label}</div>
            <div class="pdf-metric-value">${val}</div>
            <div class="pdf-metric-unit">/ 100</div>
          </div>`;
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
    if (idEl) idEl.textContent = `Reading #${(id || "").slice(0, 8)}`;
  }

  // ---- Share card template ----
  function populateShareCard(r, data) {
    const score = document.getElementById("share-score");
    const type = document.getElementById("share-skintype");
    const age = document.getElementById("share-age");
    const date = document.getElementById("share-date");

    if (score) score.innerHTML = `${r.overall_score ?? "—"}<span class="share-slash">/</span><span class="share-max">100</span>`;
    if (type) type.innerHTML = `Skin · <b>${(r.skin_type || "normal").toUpperCase()}</b>`;
    if (age && r.skin_age) age.textContent = `Skin age: ${r.skin_age}`;
    if (date) {
      const d = data.created_at ? new Date(data.created_at) : new Date();
      date.textContent = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    }
  }

  // ---- Animate number ----
  function animateNumber(el, from, to, ms) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { el.textContent = Math.round(to); return; }
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
