/* Skinna :: tips — looks up advice per (metric, severity).
   Tips are loaded from /static/data/tips.json once and cached.
*/
(function () {
  const URL = "/static/data/tips.json";
  let cache = null;
  let inflight = null;

  function severityFor(v) {
    if (v <= 33) return "good";
    if (v <= 66) return "warn";
    return "bad";
  }

  async function loadAll() {
    if (cache) return cache;
    if (inflight) return inflight;
    inflight = fetch(URL)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        cache = data || {};
        return cache;
      })
      .catch(() => ({}));
    return inflight;
  }

  /**
   * @param {string} metric
   * @param {number} value
   * @returns {Promise<{short:string,long:string[]} | null>}
   */
  async function getTip(metric, value) {
    const all = await loadAll();
    const sev = severityFor(value);
    const m = all[metric];
    if (!m) return null;
    return m[sev] || m["warn"] || null;
  }

  window.SkinnaTips = { getTip, loadAll, severityFor };
})();
