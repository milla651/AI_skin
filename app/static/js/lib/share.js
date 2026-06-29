/* Skinna :: share.js — generate a shareable result card image
   Uses html2canvas to rasterise a hidden #share-card div,
   then copies to clipboard or downloads as PNG.
*/
(function () {
  /**
   * @param {"clipboard"|"download"} mode
   */
  async function shareCard(mode) {
    var card = document.getElementById("share-card");
    if (!card) {
      console.error("[share] No #share-card element");
      return;
    }

    card.style.display = "block";
    card.style.position = "fixed";
    card.style.left = "-9999px";
    card.style.top = "0";
    card.style.width = "600px";
    card.style.zIndex = "-1";

    try {
      await new Promise(function (r) { requestAnimationFrame(r); });

      var canvas = await html2canvas(card, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fff6ec",
        logging: false,
      });

      if (mode === "clipboard" && navigator.clipboard && navigator.clipboard.write) {
        canvas.toBlob(async function (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
            showToast("Card copied to clipboard!");
          } catch (e) {
            fallbackDownload(canvas);
          }
        }, "image/png");
      } else {
        fallbackDownload(canvas);
      }
    } catch (err) {
      console.error("[share] Failed:", err);
      alert("Could not generate share card.");
    } finally {
      card.style.display = "none";
      card.style.position = "";
      card.style.left = "";
      card.style.width = "";
      card.style.zIndex = "";
    }
  }

  function fallbackDownload(canvas) {
    var link = document.createElement("a");
    link.download = "skinna-score.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("Card downloaded!");
  }

  function showToast(msg) {
    var region = document.getElementById("toast-region");
    if (!region) return;
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    region.appendChild(t);
    setTimeout(function () {
      t.classList.add("is-leaving");
      setTimeout(function () { t.remove(); }, 300);
    }, 3000);
  }

  window.SkinnaShare = { shareCard: shareCard };
})();
