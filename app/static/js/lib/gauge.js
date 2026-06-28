/* Lumen :: SVG radial gauge (270° arc)
   API:
     createGauge(host, { value, label, name, key, tip })
   - `value` 0..100
   - severity: ≤33 good, 34–66 warn, ≥67 bad  (lower is better for skin metrics)
   - Respects prefers-reduced-motion (snaps to value).
*/
(function () {
  const NS = "http://www.w3.org/2000/svg";

  // 270° arc — from -135° to +135° (top is 12 o'clock minus 135 = bottom-left start)
  // We use a circle of radius R; the arc length = 2*PI*R*(270/360).
  const R = 56;
  const VIEWBOX = 160;
  const CENTER = VIEWBOX / 2;
  const ARC_LEN = 2 * Math.PI * R * (270 / 360);

  function severityFor(v) {
    if (v <= 33) return "good";
    if (v <= 66) return "warn";
    return "bad";
  }

  function el(tag, attrs = {}) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function arcPath() {
    // start angle 135° from top (i.e. bottom-left), sweep 270° clockwise to bottom-right
    // Easier: draw circle with stroke-dasharray = ARC_LEN, rotate so the gap (90°) sits at bottom
    return null;
  }

  /**
   * Render a gauge into host element.
   * @param {HTMLElement} host
   * @param {{value:number, label:string, name:string, key:string, tip?:{short:string,long:string[]}}} opts
   */
  function createGauge(host, opts) {
    const value = Math.max(0, Math.min(100, Number(opts.value) || 0));
    const sev = severityFor(value);

    host.classList.add("gauge");
    host.setAttribute("data-metric", opts.key);
    host.setAttribute("data-severity", sev);
    host.innerHTML = "";

    // label (eyebrow)
    const labelEl = document.createElement("div");
    labelEl.className = "gauge-label";
    labelEl.textContent = opts.label || opts.key;
    host.appendChild(labelEl);

    // svg
    const svg = el("svg", {
      class: "gauge-svg",
      viewBox: `0 0 ${VIEWBOX} ${VIEWBOX}`,
      role: "img",
      "aria-label": `${opts.label || opts.key}: ${value} out of 100`,
    });

    // rotate -135° so the 90° gap is at the bottom (a smile)
    const g = el("g", {
      transform: `rotate(135 ${CENTER} ${CENTER})`,
    });

    const track = el("circle", {
      class: "gauge-track",
      cx: CENTER, cy: CENTER, r: R,
      fill: "none",
      "stroke-width": 8,
      "stroke-linecap": "round",
      "stroke-dasharray": `${ARC_LEN} 9999`,
    });

    const arc = el("circle", {
      class: "gauge-arc",
      cx: CENTER, cy: CENTER, r: R,
      fill: "none",
      "stroke-width": 8,
      "stroke-linecap": "round",
      "stroke-dasharray": `${ARC_LEN} 9999`,
      "stroke-dashoffset": ARC_LEN, // fully empty
    });

    g.appendChild(track);
    g.appendChild(arc);
    svg.appendChild(g);

    // value text in centre
    const valueText = el("text", {
      class: "gauge-value",
      x: CENTER,
      y: CENTER + 6,
    });
    valueText.textContent = "0";
    svg.appendChild(valueText);

    const unitText = el("text", {
      class: "gauge-unit",
      x: CENTER,
      y: CENTER + 26,
    });
    unitText.textContent = "/ 100";
    svg.appendChild(unitText);

    host.appendChild(svg);

    // name (italic serif)
    const nameEl = document.createElement("div");
    nameEl.className = "gauge-name";
    nameEl.textContent = opts.name || opts.label || opts.key;
    host.appendChild(nameEl);

    // tip block
    if (opts.tip) {
      const tipBox = document.createElement("div");
      tipBox.className = "gauge-tip";
      tipBox.setAttribute("aria-expanded", "false");

      const short = document.createElement("button");
      short.type = "button";
      short.className = "gauge-tip-short";
      short.textContent = opts.tip.short;
      short.setAttribute("aria-label", `More tips for ${opts.label}`);
      short.addEventListener("click", () => {
        const open = tipBox.getAttribute("aria-expanded") === "true";
        tipBox.setAttribute("aria-expanded", String(!open));
      });

      const longBox = document.createElement("div");
      longBox.className = "gauge-tip-long";
      const ul = document.createElement("ul");
      (opts.tip.long || []).forEach((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        ul.appendChild(li);
      });
      longBox.appendChild(ul);

      tipBox.appendChild(short);
      tipBox.appendChild(longBox);
      host.appendChild(tipBox);
    }

    // Animate
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const offset = ARC_LEN * (1 - value / 100);

    if (reduce) {
      arc.setAttribute("stroke-dashoffset", offset);
      valueText.textContent = String(value);
    } else {
      // double rAF to ensure transition kicks in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          arc.setAttribute("stroke-dashoffset", offset);
        });
      });
      animateNumber(valueText, 0, value, 900);
    }

    return {
      el: host,
      setValue(v) {
        const nv = Math.max(0, Math.min(100, Number(v) || 0));
        host.setAttribute("data-severity", severityFor(nv));
        const off = ARC_LEN * (1 - nv / 100);
        arc.setAttribute("stroke-dashoffset", off);
        valueText.textContent = String(nv);
      },
    };
  }

  function animateNumber(el, from, to, ms) {
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  window.LumenGauge = { createGauge, severityFor };
})();
