/* Skinna :: Aurora — curtain sheet
   - Opens with ▶ in the play bar (or any [data-open-sheet] in the future)
   - Drag/drop + file picker + clipboard paste (⌘V / Ctrl+V)
   - Flip to webcam, capture-to-canvas
   - Submits to /api/analyze → redirects to /result/<id>
*/
(() => {
  const $ = (id) => document.getElementById(id);

  const scrim = $("scrim");
  const sheet = $("sheet");
  const openBtn = $("open-sheet");
  const closeBtn = $("sheet-close");

  const flip = $("flip");
  const toggleCam = $("toggle-cam");

  const dropzone = $("dropzone");
  const fileInput = $("file-input");
  const preview = $("preview");

  const video = $("webcam");
  const snap = $("snap");
  const heroPortrait = $("hero-portrait");

  const cta = $("read-cta");

  /** @type {{kind: 'file'|'dataurl', value: File|string} | null} */
  let staged = null;
  let camStream = null;

  // -------- open / close ----------
  function openSheet() {
    sheet.classList.add("open");
    scrim.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeSheet() {
    sheet.classList.remove("open");
    scrim.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    stopWebcam();
  }
  openBtn?.addEventListener("click", openSheet);
  closeBtn?.addEventListener("click", closeSheet);
  scrim?.addEventListener("click", closeSheet);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
  });

  // -------- staging an image ----------
  function setStaged(kind, value, previewUrl) {
    staged = { kind, value };
    preview.src = previewUrl;
    dropzone.classList.add("has-image");
    cta.disabled = false;
    // also swap the hero portrait so the landing feels personalised
    if (heroPortrait) heroPortrait.src = previewUrl;
  }

  function readFile(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setStaged("file", file, reader.result);
    reader.readAsDataURL(file);
  }

  // file picker
  dropzone.addEventListener("click", (e) => {
    // don't reopen the picker when clicking on the preview
    if (!dropzone.classList.contains("has-image")) fileInput.click();
  });
  fileInput.addEventListener("change", (e) => readFile(e.target.files?.[0]));

  // drag/drop
  ["dragenter", "dragover"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
    })
  );
  dropzone.addEventListener("drop", (e) => {
    const f = e.dataTransfer?.files?.[0];
    if (f) readFile(f);
  });

  // clipboard paste anywhere on the page
  document.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of items) {
      if (it.type?.startsWith("image/")) {
        const file = it.getAsFile();
        if (file) {
          if (!sheet.classList.contains("open")) openSheet();
          readFile(file);
          return;
        }
      }
    }
  });

  // -------- webcam ----------
  async function startWebcam() {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 960, facingMode: "user" },
        audio: false,
      });
      video.srcObject = camStream;
    } catch (err) {
      alert("Could not open the camera: " + err.message);
      flip.classList.remove("flipped");
    }
  }
  function stopWebcam() {
    if (!camStream) return;
    camStream.getTracks().forEach((t) => t.stop());
    camStream = null;
    video.srcObject = null;
  }

  toggleCam.addEventListener("click", () => {
    const flipped = flip.classList.toggle("flipped");
    if (flipped) {
      toggleCam.innerHTML = "⤺ flip back · snap";
      startWebcam();
      // when flipped to camera and tapped again, capture
      toggleCam.dataset.mode = "capture-ready";
    } else {
      toggleCam.innerHTML = "⤺ flip to camera";
      stopWebcam();
      toggleCam.dataset.mode = "";
    }
  });

  // Clicking the live webcam captures a frame
  video.addEventListener("click", captureFrame);
  function captureFrame() {
    if (!camStream) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    snap.width = w;
    snap.height = h;
    const ctx = snap.getContext("2d");
    // un-mirror
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = snap.toDataURL("image/jpeg", 0.92);
    setStaged("dataurl", dataUrl, dataUrl);
    // flip back to show the captured frame in the dropzone
    flip.classList.remove("flipped");
    toggleCam.innerHTML = "⤺ flip to camera";
    stopWebcam();
  }

  // also let "flip back · snap" button capture if flipped
  toggleCam.addEventListener("click", (e) => {
    if (toggleCam.dataset.mode === "capture-ready" && camStream) {
      // user clicked toggle while in camera mode → treat as a capture shortcut
      // (only if a frame is already showing)
      // Actually this is handled by video click above; nothing extra here.
    }
  });

  // -------- submit ----------
  cta.addEventListener("click", async () => {
    if (!staged) return;
    cta.classList.add("busy");
    cta.disabled = true;

    try {
      let res;
      if (staged.kind === "file") {
        const fd = new FormData();
        fd.append("image", staged.value);
        res = await fetch("/api/analyze", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: staged.value }),
        });
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || "Request failed");
      }
      const data = await res.json();
      window.location.href = `/result/${data.id}`;
    } catch (err) {
      alert(err.message);
      cta.classList.remove("busy");
      cta.disabled = false;
    }
  });
})();
