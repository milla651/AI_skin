/* Skinna :: history page — Chart.js trend chart
   Fetches /api/history/trend, renders a line chart of overall_score vs date.
   Handles 7d / 30d / 90d range buttons.
*/
(() => {
  const trendSection = document.getElementById("atlas-trend");
  if (!trendSection) return;

  const canvasWrap = trendSection.querySelector(".atlas-trend-canvas");
  const emptyEl = trendSection.querySelector(".atlas-trend-empty");
  const rangeButtons = trendSection.querySelectorAll("[data-range]");
  let chart = null;

  // Read CSS custom property values for theming the chart
  function getToken(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function chartColors() {
    return {
      line: getToken("--accent") || "#ff3d2e",
      fill: (getToken("--accent-glow") || "rgba(255,61,46,0.2)"),
      grid: getToken("--ink-faint") || "#c9b9a8",
      text: getToken("--ink-soft") || "#4a382f",
      dot: getToken("--accent-soft") || "#ff7a59",
    };
  }

  async function loadTrend(days) {
    let data;
    try {
      const resp = await fetch(`/api/history/trend?days=${days}`);
      if (!resp.ok) return [];
      data = await resp.json();
    } catch (e) {
      return [];
    }
    return data;
  }

  function renderChart(data) {
    if (!data || data.length < 2) {
      if (emptyEl) {
        emptyEl.textContent = data.length === 1
          ? "One reading so far — take another to see a trend."
          : "No readings in this range.";
        emptyEl.hidden = false;
      }
      if (chart) { chart.destroy(); chart = null; }
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    const colors = chartColors();
    const labels = data.map((d) => {
      const dt = new Date(d.created_at);
      return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    });
    const scores = data.map((d) => d.overall_score);
    const ids = data.map((d) => d.id);

    // Create canvas if needed
    let canvas = canvasWrap.querySelector("canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvasWrap.appendChild(canvas);
    }

    if (chart) chart.destroy();

    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Overall Score",
            data: scores,
            borderColor: colors.line,
            backgroundColor: colors.fill,
            pointBackgroundColor: colors.dot,
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        onClick: function (_evt, elements) {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const readingId = ids[idx];
            if (readingId) window.location.href = `/result/${readingId}`;
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(28,20,16,0.85)",
            titleColor: "#fff",
            bodyColor: "#fff",
            titleFont: { family: "'Geist Mono', monospace", size: 11 },
            bodyFont: { family: "'Geist Mono', monospace", size: 12 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              title: function (items) {
                return items[0].label;
              },
              label: function (item) {
                return `Score: ${item.raw} / 100`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: colors.text, font: { family: "'Geist Mono', monospace", size: 10 } },
            grid: { color: "transparent" },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              color: colors.text,
              font: { family: "'Geist Mono', monospace", size: 10 },
              stepSize: 25,
            },
            grid: { color: colors.grid + "33" },
          },
        },
      },
    });
  }

  // Range button wiring
  let activeDays = 30;
  rangeButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      rangeButtons.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeDays = parseInt(btn.dataset.range, 10) || 30;
      const data = await loadTrend(activeDays);
      renderChart(data);
    });
  });

  // Re-render on theme change (colours shift)
  window.addEventListener("skinna:theme", async () => {
    if (chart) {
      const data = await loadTrend(activeDays);
      renderChart(data);
    }
  });

  // Initial load
  (async () => {
    const data = await loadTrend(activeDays);
    renderChart(data);
  })();
})();
