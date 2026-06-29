/* Lumen :: pdf.js — client-side PDF export (§6.9)
   Uses html2canvas + jsPDF to rasterise a hidden #pdf-template node
   and wrap it as an A4 page.

   API:
     exportPDF(analysisId)
*/
(function () {
  /**
   * @param {string} analysisId — short ID for the filename
   */
  async function exportPDF(analysisId) {
    var template = document.getElementById("pdf-template");
    if (!template) {
      console.error("[pdf] No #pdf-template element found");
      return;
    }

    // Show the hidden template briefly for capture
    template.style.display = "block";
    template.style.position = "fixed";
    template.style.left = "-9999px";
    template.style.top = "0";
    template.style.width = "794px"; // A4 width at 96dpi
    template.style.zIndex = "-1";

    try {
      // Wait a tick for layout
      await new Promise(function (r) { requestAnimationFrame(r); });

      var canvas = await html2canvas(template, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#fff6ec",
        logging: false,
      });

      var imgData = canvas.toDataURL("image/jpeg", 0.92);
      var pdf = new jspdf.jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      var pageW = 210;
      var pageH = 297;
      var imgW = pageW;
      var imgH = (canvas.height * imgW) / canvas.width;

      // If taller than one page, scale down
      if (imgH > pageH) {
        imgH = pageH;
        imgW = (canvas.width * imgH) / canvas.height;
      }

      var xOff = (pageW - imgW) / 2;
      var yOff = Math.max(0, (pageH - imgH) / 2);

      pdf.addImage(imgData, "JPEG", xOff, yOff, imgW, imgH);

      var shortId = (analysisId || "unknown").slice(0, 8);
      var dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      pdf.save("lumen-reading-" + shortId + "-" + dateStr + ".pdf");
    } catch (err) {
      console.error("[pdf] Export failed:", err);
      alert("PDF export failed. Please try again.");
    } finally {
      template.style.display = "none";
      template.style.position = "";
      template.style.left = "";
      template.style.width = "";
      template.style.zIndex = "";
    }
  }

  window.LumenPDF = { exportPDF: exportPDF };
})();
