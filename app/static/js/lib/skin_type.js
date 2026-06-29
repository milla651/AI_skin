/* Skinna :: skin-type badge + popover
   Renders a badge with the skin type + an info popover explaining drivers.
*/
(function () {
  const TYPE_COPY = {
    oily: {
      title: "Oily",
      body: "Skin produces excess sebum, often with visible pores and breakouts. Cleanse twice daily and reach for niacinamide or BHA serums.",
    },
    dry: {
      title: "Dry",
      body: "Skin lacks moisture and feels tight, sometimes with flaking. Layer a ceramide moisturiser and avoid foaming cleansers.",
    },
    combination: {
      title: "Combination",
      body: "An oily T-zone with drier cheeks. Zone your routine — lightweight gels in the middle, richer creams on the perimeter.",
    },
    normal: {
      title: "Normal",
      body: "Balanced moisture, even tone, no major flares. Keep a simple routine and stay consistent with SPF.",
    },
  };

  function detectDrivers(metrics) {
    if (!metrics) return [];
    const drivers = [];
    if (metrics.pores >= 55) drivers.push({ k: "pores", v: metrics.pores });
    if (metrics.acne >= 25) drivers.push({ k: "acne", v: metrics.acne });
    if (metrics.redness >= 50) drivers.push({ k: "redness", v: metrics.redness });
    if (metrics.wrinkles >= 35) drivers.push({ k: "wrinkles", v: metrics.wrinkles });
    if (metrics.dark_circles >= 35) drivers.push({ k: "dark circles", v: metrics.dark_circles });
    return drivers;
  }

  /**
   * @param {HTMLElement} host
   * @param {{skin_type:string, metrics:object}} result
   */
  function renderSkinTypeBadge(host, result) {
    if (!host) return;
    const type = String(result?.skin_type || "normal").toLowerCase();
    const copy = TYPE_COPY[type] || TYPE_COPY.normal;
    const drivers = detectDrivers(result?.metrics);

    host.classList.add("skin-type");
    host.setAttribute("aria-expanded", "false");
    host.innerHTML = "";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "skin-type-trigger";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.innerHTML = `Skin · <b>${copy.title}</b>`;
    host.appendChild(trigger);

    const pop = document.createElement("div");
    pop.className = "skin-type-popover";
    pop.setAttribute("role", "dialog");
    pop.innerHTML = `
      <h4>${copy.title} skin</h4>
      <p>${copy.body}</p>
      ${
        drivers.length
          ? `<div class="drivers" aria-label="Driving metrics">
              ${drivers
                .map(
                  (d) =>
                    `<span class="badge badge-warn"><span class="badge-dot"></span>${d.k} ${d.v}</span>`
                )
                .join("")}
            </div>`
          : ""
      }
    `;
    host.appendChild(pop);

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = host.getAttribute("aria-expanded") === "true";
      host.setAttribute("aria-expanded", String(!open));
    });
    document.addEventListener("click", (e) => {
      if (!host.contains(e.target)) host.setAttribute("aria-expanded", "false");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") host.setAttribute("aria-expanded", "false");
    });
  }

  window.SkinnaSkinType = { renderSkinTypeBadge };
})();
