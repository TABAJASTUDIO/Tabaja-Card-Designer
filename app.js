const CARD = {
  landscape: { w: 1011, h: 638, mmW: 85.6, mmH: 53.98 },
  portrait:  { w: 638, h: 1011, mmW: 53.98, mmH: 85.6 }
};

const LOGIN_USER = "admin";
const LOGIN_PASSWORD = "Tabaja@2026";
const LOGIN_KEY = "tabaja_card_designer_login";

const $ = id => document.getElementById(id);
let orientation = "landscape";
let { w: W, h: H } = CARD[orientation];
let canvas = new fabric.Canvas("cardCanvas", {
  backgroundColor: "#ffffff",
  preserveObjectStacking: true
});
canvas.setDimensions({ width: W, height: H });

let sides = { front: null, back: null };
let currentSide = "front";
let pendingImageRole = "image";
let cropMode = false;

function status(msg) { $("status").textContent = msg; }
function showApp() { $("loginScreen").classList.add("hidden"); $("appShell").classList.remove("hidden"); setTimeout(() => canvas.calcOffset(), 0); }
function showLogin() { $("appShell").classList.add("hidden"); $("loginScreen").classList.remove("hidden"); $("loginPassword").value = ""; $("loginError").textContent = ""; }

function isLoggedIn() {
  return localStorage.getItem(LOGIN_KEY) === "1" || sessionStorage.getItem(LOGIN_KEY) === "1";
}

$("loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const user = $("loginUser").value.trim();
  const pass = $("loginPassword").value;
  if (user === LOGIN_USER && pass === LOGIN_PASSWORD) {
    localStorage.removeItem(LOGIN_KEY);
    sessionStorage.removeItem(LOGIN_KEY);
    ($("rememberLogin").checked ? localStorage : sessionStorage).setItem(LOGIN_KEY, "1");
    showApp();
  } else {
    $("loginError").textContent = "Incorrect username or password.";
  }
});

$("logoutBtn").onclick = () => {
  localStorage.removeItem(LOGIN_KEY);
  sessionStorage.removeItem(LOGIN_KEY);
  showLogin();
};

function snapshot() {
  return JSON.stringify(canvas.toJSON([
    "role", "originalScaleX", "originalScaleY", "originalLeft", "originalTop",
    "originalOriginX", "originalOriginY", "cropActive"
  ]));
}

function emptySnapshot(bg = "#ffffff") {
  return JSON.stringify({ version: "5.3.0", objects: [], background: bg });
}

function loadSnapshot(data) {
  return new Promise(resolve => {
    canvas.loadFromJSON(data || emptySnapshot(), () => {
      canvas.setDimensions({ width: W, height: H });
      canvas.renderAll();
      syncProps();
      resolve();
    });
  });
}

function saveCurrentSide() { sides[currentSide] = snapshot(); }

async function switchSide(side) {
  saveCurrentSide();
  currentSide = side;
  await loadSnapshot(sides[side]);
  $("frontBtn").classList.toggle("active", side === "front");
  $("backBtn").classList.toggle("active", side === "back");
  status(side.toUpperCase() + " side");
}

function activeImage() {
  const o = canvas.getActiveObject();
  return o && o.type === "image" ? o : null;
}

function rememberImage(o) {
  if (o.originalScaleX == null) {
    o.originalScaleX = o.scaleX;
    o.originalScaleY = o.scaleY;
    o.originalLeft = o.left;
    o.originalTop = o.top;
    o.originalOriginX = o.originX;
    o.originalOriginY = o.originY;
  }
}

function clearClip(o) {
  o.clipPath = null;
  o.cropActive = false;
  cropMode = false;
  $("cropBtn").classList.remove("active");
}

function cardClip() {
  return new fabric.Rect({ left: 0, top: 0, width: W, height: H, absolutePositioned: true });
}

function fillCard() {
  const o = activeImage();
  if (!o) return status("Select an image first.");
  rememberImage(o);
  clearClip(o);

  if (currentSide === "back") {
    // The back side must show the complete supplied artwork without cropping.
    // Stretch it exactly to CR80 dimensions so one click is enough.
    o.set({
      scaleX: W / o.width,
      scaleY: H / o.height,
      left: W / 2,
      top: H / 2,
      originX: "center",
      originY: "center"
    });
    status("Back fitted exactly to the card — no crop.");
  } else {
    // Keep the proven front-side cover behaviour unchanged.
    const scale = Math.max(W / o.width, H / o.height);
    o.set({
      scaleX: scale,
      scaleY: scale,
      left: W / 2,
      top: H / 2,
      originX: "center",
      originY: "center"
    });
    status("Fill Card applied.");
  }

  o.setCoords();
  canvas.requestRenderAll();
}

function fitInside() {
  const o = activeImage();
  if (!o) return status("Select an image first.");
  rememberImage(o);
  clearClip(o);
  const scale = Math.min(W / o.width, H / o.height);
  o.set({ scaleX: scale, scaleY: scale, left: W / 2, top: H / 2, originX: "center", originY: "center" });
  o.setCoords();
  canvas.requestRenderAll();
  status("Fit Inside applied.");
}

function toggleCrop() {
  const o = activeImage();
  if (!o) return status("Select an image first.");
  rememberImage(o);
  cropMode = !cropMode;
  if (cropMode) {
    o.clipPath = cardClip();
    o.cropActive = true;
    $("cropBtn").classList.add("active");
    status("Crop Mode ON: move or resize the image.");
  } else {
    clearClip(o);
    status("Crop Mode OFF.");
  }
  canvas.requestRenderAll();
}

function resetImage() {
  const o = activeImage();
  if (!o) return status("Select an image first.");
  if (o.originalScaleX != null) {
    o.set({
      scaleX: o.originalScaleX,
      scaleY: o.originalScaleY,
      left: o.originalLeft,
      top: o.originalTop,
      originX: o.originalOriginX || "left",
      originY: o.originalOriginY || "top"
    });
  }
  clearClip(o);
  o.setCoords();
  canvas.requestRenderAll();
  status("Image reset.");
}

function rotateImage90() {
  const o = activeImage();
  if (!o) return status("Select an image first.");
  o.rotate(((o.angle || 0) + 90) % 360);
  o.setCoords();
  canvas.requestRenderAll();
  $("rotation").value = o.angle || 0;
  status("Image rotated 90°.");
}

function addImageFromFile(file, role) {
  const r = new FileReader();
  r.onload = () => fabric.Image.fromURL(r.result, img => {
    img.set({ left: W / 2, top: H / 2, originX: "center", originY: "center", role });
    const maxW = role === "logo" ? W * 0.3 : W * 0.6;
    const maxH = role === "logo" ? H * 0.3 : H * 0.6;
    const s = Math.min(maxW / img.width, maxH / img.height);
    img.scale(s);
    rememberImage(img);
    canvas.add(img).setActiveObject(img);
    if (role === "background") {
      fillCard();
      canvas.sendToBack(img);
      img.selectable = true;
    }
    canvas.requestRenderAll();
    status(role + " added.");
  }, { crossOrigin: "anonymous" });
  r.readAsDataURL(file);
}

$("imageInput").onchange = e => {
  const f = e.target.files[0];
  if (f) addImageFromFile(f, pendingImageRole);
  e.target.value = "";
};
function chooseImage(role) { pendingImageRole = role; $("imageInput").click(); }

$("addTextBtn").onclick = () => {
  const t = new fabric.IText("Your Text", { left: W / 2, top: H / 2, originX: "center", originY: "center", fontSize: 34, fill: "#111111" });
  canvas.add(t).setActiveObject(t);
  syncProps();
};
$("addImageBtn").onclick = () => chooseImage("image");
$("addLogoBtn").onclick = () => chooseImage("logo");
$("backgroundBtn").onclick = () => chooseImage("background");
$("fillBtn").onclick = fillCard;
$("fitBtn").onclick = fitInside;
$("cropBtn").onclick = toggleCrop;
$("resetImageBtn").onclick = resetImage;
$("rotateImageBtn").onclick = rotateImage90;

$("qrBtn").onclick = () => {
  const v = prompt("Enter QR link or text:");
  if (!v) return;
  const d = document.createElement("div");
  new QRCode(d, { text: v, width: 600, height: 600, correctLevel: QRCode.CorrectLevel.H });
  setTimeout(() => {
    const qrCanvas = d.querySelector("canvas");
    if (!qrCanvas) return alert("QR code could not be created.");
    fabric.Image.fromURL(qrCanvas.toDataURL("image/png"), img => {
      img.scaleToWidth(Math.min(W, H) * 0.35);
      img.set({ left: W / 2, top: H / 2, originX: "center", originY: "center" });
      canvas.add(img).setActiveObject(img);
      canvas.requestRenderAll();
    });
  }, 80);
};

$("barcodeBtn").onclick = () => {
  const v = prompt("Enter barcode value:");
  if (!v) return;
  const c = document.createElement("canvas");
  try {
    JsBarcode(c, v, { format: "CODE128", displayValue: true, width: 3, height: 120, margin: 10 });
    fabric.Image.fromURL(c.toDataURL("image/png"), img => {
      img.scaleToWidth(W * 0.42);
      img.set({ left: W / 2, top: H / 2, originX: "center", originY: "center" });
      canvas.add(img).setActiveObject(img);
      canvas.requestRenderAll();
    });
  } catch (e) { alert("Invalid barcode value."); }
};

$("nfcBtn").onclick = async () => {
  const v = prompt("Enter NFC link:");
  if (!v) return;
  if ("NDEFReader" in window) {
    try {
      const n = new NDEFReader();
      await n.write(v);
      alert("NFC written successfully.");
    } catch (e) { alert("NFC could not be written: " + e.message); }
  } else {
    try { await navigator.clipboard.writeText(v); } catch (_) {}
    alert("Web NFC is unavailable here. The link was copied when permitted.");
  }
};

$("duplicateBtn").onclick = () => {
  const o = canvas.getActiveObject();
  if (!o) return status("Select an object first.");
  o.clone(c => {
    c.set({ left: (o.left || 0) + 25, top: (o.top || 0) + 25 });
    canvas.add(c).setActiveObject(c);
    canvas.requestRenderAll();
  }, ["role", "originalScaleX", "originalScaleY", "originalLeft", "originalTop", "originalOriginX", "originalOriginY", "cropActive"]);
};

$("deleteBtn").onclick = () => {
  const objects = canvas.getActiveObjects();
  if (!objects.length) return;
  objects.forEach(o => canvas.remove(o));
  canvas.discardActiveObject();
  canvas.requestRenderAll();
};

function syncProps() {
  const o = canvas.getActiveObject();
  if (!o) return;
  $("opacity").value = o.opacity ?? 1;
  $("rotation").value = o.angle ?? 0;
  if (o.type === "i-text" || o.type === "text") {
    $("textValue").value = o.text || "";
    $("fontSize").value = o.fontSize || 34;
    $("fontFamily").value = o.fontFamily || "Arial";
    $("textColor").value = toHex(o.fill || "#111111");
  }
}

function toHex(c) {
  if (typeof c === "string" && c.startsWith("#")) return c.length === 4 ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
  return "#111111";
}

canvas.on("selection:created", syncProps);
canvas.on("selection:updated", syncProps);
canvas.on("object:modified", syncProps);
$("textValue").oninput = e => { const o = canvas.getActiveObject(); if (o && (o.type === "i-text" || o.type === "text")) { o.set("text", e.target.value); canvas.requestRenderAll(); } };
$("fontSize").oninput = e => { const o = canvas.getActiveObject(); if (o && (o.type === "i-text" || o.type === "text")) { o.set("fontSize", +e.target.value); canvas.requestRenderAll(); } };
$("fontFamily").onchange = e => { const o = canvas.getActiveObject(); if (o && (o.type === "i-text" || o.type === "text")) { o.set("fontFamily", e.target.value); canvas.requestRenderAll(); } };
$("textColor").oninput = e => { const o = canvas.getActiveObject(); if (o) { o.set("fill", e.target.value); canvas.requestRenderAll(); } };
$("boldBtn").onclick = () => { const o = canvas.getActiveObject(); if (o) { o.set("fontWeight", o.fontWeight === "bold" ? "normal" : "bold"); canvas.requestRenderAll(); } };
$("italicBtn").onclick = () => { const o = canvas.getActiveObject(); if (o) { o.set("fontStyle", o.fontStyle === "italic" ? "normal" : "italic"); canvas.requestRenderAll(); } };
$("cardColor").oninput = e => canvas.setBackgroundColor(e.target.value, canvas.renderAll.bind(canvas));
$("opacity").oninput = e => { const o = canvas.getActiveObject(); if (o) { o.set("opacity", +e.target.value); canvas.requestRenderAll(); } };
$("rotation").oninput = e => { const o = canvas.getActiveObject(); if (o) { o.rotate(+e.target.value); o.setCoords(); canvas.requestRenderAll(); } };

$("frontBtn").onclick = () => switchSide("front");
$("backBtn").onclick = () => switchSide("back");

function scaleSnapshot(json, sx, sy) {
  if (!json) return emptySnapshot();
  const data = JSON.parse(json);
  for (const o of data.objects || []) {
    if (typeof o.left === "number") o.left *= sx;
    if (typeof o.top === "number") o.top *= sy;
    if (typeof o.scaleX === "number") o.scaleX *= sx;
    if (typeof o.scaleY === "number") o.scaleY *= sy;
    if (typeof o.originalLeft === "number") o.originalLeft *= sx;
    if (typeof o.originalTop === "number") o.originalTop *= sy;
    if (typeof o.originalScaleX === "number") o.originalScaleX *= sx;
    if (typeof o.originalScaleY === "number") o.originalScaleY *= sy;
    if (o.clipPath && o.clipPath.absolutePositioned) {
      o.clipPath.width = CARD[orientation].w;
      o.clipPath.height = CARD[orientation].h;
    }
  }
  return JSON.stringify(data);
}

async function changeOrientation(next) {
  if (next === orientation) return;
  saveCurrentSide();
  const old = CARD[orientation];
  const neu = CARD[next];
  orientation = next;
  W = neu.w; H = neu.h;
  const sx = neu.w / old.w;
  const sy = neu.h / old.h;
  sides.front = scaleSnapshot(sides.front, sx, sy);
  sides.back = scaleSnapshot(sides.back, sx, sy);
  canvas.setDimensions({ width: W, height: H });
  $("canvasShell").classList.toggle("landscape", next === "landscape");
  $("canvasShell").classList.toggle("portrait", next === "portrait");
  $("orientationSelect").value = next;
  updateCardInfo();
  await loadSnapshot(sides[currentSide]);
  canvas.calcOffset();
  status(next === "portrait" ? "Portrait orientation." : "Landscape orientation.");
}

function updateCardInfo() {
  const c = CARD[orientation];
  $("cardInfo").textContent = `CR80 • ${c.mmW.toFixed(2)} × ${c.mmH.toFixed(2)} mm • ${orientation[0].toUpperCase() + orientation.slice(1)} • 300 DPI`;
}

$("orientationSelect").onchange = e => changeOrientation(e.target.value);

$("newBtn").onclick = async () => {
  if (!confirm("Start a new project?")) return;
  orientation = "landscape";
  W = CARD.landscape.w; H = CARD.landscape.h;
  sides = { front: emptySnapshot(), back: emptySnapshot() };
  currentSide = "front";
  canvas.setDimensions({ width: W, height: H });
  $("canvasShell").className = "canvas-shell landscape";
  $("orientationSelect").value = "landscape";
  updateCardInfo();
  await loadSnapshot(sides.front);
  $("frontBtn").classList.add("active");
  $("backBtn").classList.remove("active");
  status("New project.");
};

$("saveBtn").onclick = () => {
  saveCurrentSide();
  const project = { version: "4.1", orientation, front: sides.front, back: sides.back, currentSide };
  downloadBlob(new Blob([JSON.stringify(project)], { type: "application/json" }), "Tabaja-Card-Project.tabaja");
};

$("openBtn").onclick = () => $("projectInput").click();
$("projectInput").onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const p = JSON.parse(r.result);
      orientation = p.orientation || "landscape";
      W = CARD[orientation].w; H = CARD[orientation].h;
      sides.front = p.front || emptySnapshot();
      sides.back = p.back || emptySnapshot();
      currentSide = p.currentSide || "front";
      canvas.setDimensions({ width: W, height: H });
      $("canvasShell").className = "canvas-shell " + orientation;
      $("orientationSelect").value = orientation;
      updateCardInfo();
      await loadSnapshot(sides[currentSide]);
      $("frontBtn").classList.toggle("active", currentSide === "front");
      $("backBtn").classList.toggle("active", currentSide === "back");
      status("Project opened.");
    } catch (err) { alert("Invalid project file."); }
  };
  r.readAsText(f);
  e.target.value = "";
};

function renderSnapshotToData(snapshotJson, format = "png", quality = 1) {
  return new Promise((resolve, reject) => {
    const tempEl = document.createElement("canvas");
    tempEl.width = W; tempEl.height = H;
    const temp = new fabric.StaticCanvas(tempEl, { width: W, height: H, backgroundColor: "#ffffff", renderOnAddRemove: false });
    temp.loadFromJSON(snapshotJson || emptySnapshot(), () => {
      try {
        temp.setDimensions({ width: W, height: H });
        temp.renderAll();
        const data = temp.toDataURL({ format, quality, multiplier: 1, enableRetinaScaling: false });
        temp.dispose();
        resolve(data);
      } catch (e) {
        temp.dispose();
        reject(e);
      }
    });
  });
}

async function exportSide(side, format = "png", quality = 1) {
  saveCurrentSide();
  return renderSnapshotToData(sides[side], format, quality);
}

$("pngBtn").onclick = async () => {
  try {
    saveCurrentSide();
    const both = confirm("Export Front and Back?\nOK = both sides\nCancel = current side only");
    const list = both ? ["front", "back"] : [currentSide];
    for (const side of list) {
      const data = await exportSide(side, "png", 1);
      downloadData(data, `Tabaja-Card-${side}-${orientation}-300DPI.png`);
    }
    status("PNG exported.");
  } catch (e) { alert("PNG export failed: " + e.message); }
};

function dataUrlToBytes(dataUrl) {
  const binary = atob(dataUrl.split(",")[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function asciiBytes(text) { return new TextEncoder().encode(text); }
function concatBytes(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function buildJpegPdf(images, pxW, pxH, mmW, mmH) {
  const pageW = mmW * 72 / 25.4;
  const pageH = mmH * 72 / 25.4;
  const objects = [];
  const addObj = bytes => { objects.push(bytes); return objects.length; };
  const pagesId = 2;
  const pageIds = [];
  const imageIds = [];
  const contentIds = [];
  addObj(asciiBytes("<< /Type /Catalog /Pages 2 0 R >>"));
  addObj(asciiBytes("PAGES_PLACEHOLDER"));

  images.forEach((imgBytes, i) => {
    const imageId = addObj(concatBytes([
      asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`),
      imgBytes,
      asciiBytes("\nendstream")
    ]));
    imageIds.push(imageId);

    const content = asciiBytes(`q\n${pageW.toFixed(3)} 0 0 ${pageH.toFixed(3)} 0 0 cm\n/Im${i + 1} Do\nQ`);
    const contentId = addObj(concatBytes([
      asciiBytes(`<< /Length ${content.length} >>\nstream\n`), content, asciiBytes("\nendstream")
    ]));
    contentIds.push(contentId);

    const pageId = addObj(asciiBytes(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageW.toFixed(3)} ${pageH.toFixed(3)}] /Resources << /XObject << /Im${i + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
    ));
    pageIds.push(pageId);
  });

  objects[1] = asciiBytes(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);

  const header = asciiBytes("%PDF-1.4\n%âãÏÓ\n");
  const bodyParts = [header];
  const offsets = [0];
  let offset = header.length;
  objects.forEach((obj, i) => {
    offsets.push(offset);
    const prefix = asciiBytes(`${i + 1} 0 obj\n`);
    const suffix = asciiBytes("\nendobj\n");
    bodyParts.push(prefix, obj, suffix);
    offset += prefix.length + obj.length + suffix.length;
  });

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  bodyParts.push(asciiBytes(xref));
  return concatBytes(bodyParts);
}

$("pdfBtn").onclick = async () => {
  try {
    saveCurrentSide();
    const both = confirm("Export Front and Back?\nOK = both sides\nCancel = current side only");
    const list = both ? ["front", "back"] : [currentSide];
    const jpegBytes = [];
    for (const side of list) {
      const jpeg = await exportSide(side, "jpeg", 0.98);
      jpegBytes.push(dataUrlToBytes(jpeg));
    }
    const c = CARD[orientation];
    const pdfBytes = buildJpegPdf(jpegBytes, W, H, c.mmW, c.mmH);
    downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `Tabaja-Card-${orientation}.pdf`);
    status("PDF exported.");
  } catch (e) { alert("PDF export failed: " + e.message); }
};

async function printSides(list) {
  try {
    saveCurrentSide();

    // IMPORTANT: Edge reports the Zebra card stock as a pixel-sized sheet
    // (for example 1006 × 640 px). Browser HTML printing then treats those
    // pixels as 96-DPI CSS pixels and the Zebra driver scales the card down.
    // To preserve the real CR80 physical size, build a PDF whose MediaBox is
    // expressed in PDF points (85.60 × 53.98 mm), then download that exact file.
    const jpegBytes = [];
    for (const side of list) {
      const jpeg = await exportSide(side, "jpeg", 1);
      jpegBytes.push(dataUrlToBytes(jpeg));
    }

    const c = CARD[orientation];
    const pdfBytes = buildPrintJpegPdf(jpegBytes, W, H, c.mmW, c.mmH);
    const fileName = list.length === 2
      ? `Tabaja-PRINT-Front-Back-${orientation}-CR80.pdf`
      : `Tabaja-PRINT-${list[0]}-${orientation}-CR80.pdf`;

    downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), fileName);
    status("Exact-size CR80 PDF downloaded. Open it and print at Actual size / 100%.");
    alert("Exact-size CR80 print file downloaded.\n\nOpen the PDF, choose Zebra ZC300, then select Actual size / 100% and print.");
  } catch (e) {
    alert("Print preparation failed: " + e.message);
  }
}

function buildPrintJpegPdf(images, pxW, pxH, mmW, mmH) {
  const pageW = mmW * 72 / 25.4;
  const pageH = mmH * 72 / 25.4;
  // Keep the proven 0.80 mm bleed on the left, right and top.
  // Add a little more only below the card because the ZC300 feed leaves
  // a very thin white strip on the trailing (bottom) edge.
  const bleedX = 0.80 * 72 / 25.4;
  const bleedTop = 0.80 * 72 / 25.4;
  const bleedBottom = 1.60 * 72 / 25.4;
  const drawW = pageW + bleedX * 2;
  const drawH = pageH + bleedTop + bleedBottom;
  const objects = [];
  const addObj = bytes => { objects.push(bytes); return objects.length; };
  const pagesId = 2;
  const pageIds = [];

  addObj(asciiBytes("<< /Type /Catalog /Pages 2 0 R >>"));
  addObj(asciiBytes("PAGES_PLACEHOLDER"));

  images.forEach((imgBytes, i) => {
    const imageId = addObj(concatBytes([
      asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`),
      imgBytes,
      asciiBytes("\nendstream")
    ]));

    const content = asciiBytes(
      `q\n${drawW.toFixed(3)} 0 0 ${drawH.toFixed(3)} ${(-bleedX).toFixed(3)} ${(-bleedBottom).toFixed(3)} cm\n/Im${i + 1} Do\nQ`
    );
    const contentId = addObj(concatBytes([
      asciiBytes(`<< /Length ${content.length} >>\nstream\n`),
      content,
      asciiBytes("\nendstream")
    ]));

    const pageId = addObj(asciiBytes(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageW.toFixed(3)} ${pageH.toFixed(3)}] /CropBox [0 0 ${pageW.toFixed(3)} ${pageH.toFixed(3)}] /Resources << /XObject << /Im${i + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`
    ));
    pageIds.push(pageId);
  });

  objects[1] = asciiBytes(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);

  const header = asciiBytes("%PDF-1.4\n%âãÏÓ\n");
  const bodyParts = [header];
  const offsets = [0];
  let offset = header.length;

  objects.forEach((obj, i) => {
    offsets.push(offset);
    const prefix = asciiBytes(`${i + 1} 0 obj\n`);
    const suffix = asciiBytes("\nendobj\n");
    bodyParts.push(prefix, obj, suffix);
    offset += prefix.length + obj.length + suffix.length;
  });

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  bodyParts.push(asciiBytes(xref));
  return concatBytes(bodyParts);
}

$("printBtn").onclick = () => printSides([currentSide]);
$("printBothBtn").onclick = () => printSides(["front", "back"]);

function downloadData(data, name) {
  const a = document.createElement("a");
  a.href = data;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

canvas.setBackgroundColor("#ffffff", canvas.renderAll.bind(canvas));
sides.front = snapshot();
sides.back = snapshot();
updateCardInfo();
status("V4.6 ready — extra bottom-edge bleed active.");
if (isLoggedIn()) showApp(); else showLogin();
