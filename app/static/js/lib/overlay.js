/* Lumen :: overlay.js — annotated image overlay (§6.8)
   Draws coloured heatmap polygons on a <canvas> over the portrait.
   Tabs: Photo | Redness | Pores | Wrinkles | Pigment

   API:
     initOverlay(containerEl, imgEl, regions)
   - containerEl: the host element that wraps the image
   - imgEl: the <img> element
   - regions: { redness: [{polygon, intensity}], pores: [...], ... }
*/
(function () {
  const COLORS = {
    redness:      { r: 255, g: 60,  b: 45  },
    pores:        { r: 255, g: 180, b: 40  },
    wrinkles:     { r: 120, g: 80,  b: 200 },
    pigmentation: { r: 140, g: 90,  b: 50  },
  };

  const TABS = [
    { key: "photo",        label: "Photo" },
    { key: "redness",      label: "Redness" },
    { key: "pores",        label: "Pores" },
    { key: "wrinkles",     label: "Wrinkles" },
    { key: "pigmentation", label: "Pigment" },
  ];

  /**
   * @param {HTMLElement} containerEl
   * @param {HTMLImageElement} imgEl
   * @param {object} regions
   */
  function initOverlay(containerEl, imgEl, regions) {
    if (!containerEl || !imgEl) return;

    // Ensure container is positioned
    containerEl.style.position = "relative";

    // Create tab bar
    const tabBar = document.createElement("div");
    tabBar.className = "overlay-tabs";
    tabBar.setAttribute("role", "tablist");
    tabBar.setAttribute("aria-label", "Overlay view");

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.className = "overlay-canvas";
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity 240ms ease;";
    containerEl.appendChild(canvas);

    let activeTab = "photo";

    TABS.forEach((tab) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "overlay-tab" + (tab.key === "photo" ? " is-active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", tab.key === "photo" ? "true" : "false");
      btn.textContent = tab.label;
      btn.dataset.overlay = tab.key;

      // Disable tabs that have no region data
      if (tab.key !== "photo" && (!regions || !regions[tab.key] || !regions[tab.key].length)) {
        btn.disabled = true;
        btn.title = "No data for this metric";
      }

      btn.addEventListener("click", () => {
        tabBar.querySelectorAll(".overlay-tab").forEach((b) => {
          b.classList.remove("is-active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");
        activeTab = tab.key;
        drawOverlay(canvas, imgEl, regions, activeTab);
      });

      tabBar.appendChild(btn);
    });

    // Insert tab bar before the container
    containerEl.parentNode.insertBefore(tabBar, containerEl);

    // Resize canvas to match image
    function sizeCanvas() {
      canvas.width = imgEl.naturalWidth || imgEl.offsetWidth;
      canvas.height = imgEl.naturalHeight || imgEl.offsetHeight;
      if (activeTab !== "photo") {
        drawOverlay(canvas, imgEl, regions, activeTab);
      }
    }

    if (imgEl.complete) {
      sizeCanvas();
    } else {
      imgEl.addEventListener("load", sizeCanvas);
    }
    window.addEventListener("resize", sizeCanvas);
  }

  function drawOverlay(canvas, imgEl, regions, tabKey) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (tabKey === "photo" || !regions || !regions[tabKey]) {
      canvas.style.opacity = "0";
      return;
    }

    canvas.style.opacity = "1";
    const color = COLORS[tabKey] || { r: 255, g: 100, b: 100 };
    const polys = regions[tabKey];

    polys.forEach((region) => {
      const pts = region.polygon;
      const intensity = Math.min(1, Math.max(0.1, region.intensity || 0.5));

      if (!pts || pts.length < 3) return;

      ctx.beginPath();
      // Points are in 0..1 normalised coords → scale to canvas
      ctx.moveTo(pts[0][0] * canvas.width, pts[0][1] * canvas.height);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i][0] * canvas.width, pts[i][1] * canvas.height);
      }
      ctx.closePath();

      ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity * 0.45})`;
      ctx.fill();

      ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${intensity * 0.7})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  window.LumenOverlay = { initOverlay };
})();
