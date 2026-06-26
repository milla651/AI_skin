/* Lumen :: Aurora — result poller
   Polls /api/result/<id> and animates the score + orbiting metric cards into
   the live values. The 6 backend metrics map onto our 4 visible cards
   (extras are summarised in the recommendations).
*/
(() => {
  const id = window.__ANALYSIS_ID__;
  if (!id) return;

  const STATUS_TEXT = {
    queued:  "queued",
    running: "scanning",
    done:    "ready",
    error:   "trouble",
  };

  const els = {
    img:    document.getElementById("r-image"),
    statusDot:  document.getElementById("r-status-dot"),
    statusText: document.getElementById("r-status-text"),
    score:      document.getElementById("r-score"),
    skintype:   document.getElementById("r-skintype"),
    recs:       document.getElementById("r-recs"),
    recList:    document.getElementById("r-rec-list"),
    ts:         document.getElementById("r-ts"),
    cards:      document.querySelectorAll(".card[data-metric]"),
  };

  let startTime = Date.now();

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

    render(data);

    if (data.status === "done" || data.status === "error") return;
    setTimeout(poll, 1500);
  }

  function render(data) {
    // status pill
    els.statusDot.className = `dot ${data.status}`;
    els.statusText.textContent = STATUS_TEXT[data.status] || data.status;

    // running clock
    const secs = Math.floor((Date.now() - startTime) / 1000);
    els.ts.textContent = `${String(Math.floor(secs / 60)).padStart(2,'0')}:${String(secs % 60).padStart(2,'0')}`;

    // portrait
    if (data.image_path_url && els.img.src !== data.image_path_url) {
      els.img.src = data.image_path_url;
    }

    if (data.status === "done" && data.result) {
      const r = data.result;

      // animate the score
      animateNumber(els.score, parseInt(els.score.textContent) || 0, r.overall_score, 1100);
      els.skintype.textContent = r.skin_type || "—";

      // metric cards
      els.cards.forEach((card) => {
        const key = card.dataset.metric;
        const v = r.metrics?.[key];
        if (typeof v === "number") {
          const valEl = card.querySelector("[data-val]");
          const barEl = card.querySelector("[data-bar]");
          if (valEl) valEl.textContent = v;
          if (barEl) barEl.style.width = `${Math.min(100, v)}%`;
        }
      });

      // recommendations
      if (r.recommendations?.length) {
        els.recs.hidden = false;
        els.recList.innerHTML = "";
        r.recommendations.forEach((rec) => {
          const li = document.createElement("li");
          li.textContent = rec;
          els.recList.appendChild(li);
        });
      }
    } else if (data.status === "error") {
      els.score.textContent = "ERR";
      els.skintype.innerHTML = `<b>${data.error || "something went wrong"}</b>`;
    }
  }

  function animateNumber(el, from, to, ms) {
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  poll();
})();
