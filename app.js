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
    "originalOriginX", "originalOriginY", "cropActive", "dataValue"
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

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = b; b = a % b; a = t; }
  return a;
}

function qrCanvasToVectorGroup(sourceCanvas, value) {
  const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const w = sourceCanvas.width, h = sourceCanvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  const dark = (x, y) => {
    const i = (y * w + x) * 4;
    return data[i] < 128 && data[i + 1] < 128 && data[i + 2] < 128 && data[i + 3] > 0;
  };
  let minX=w, minY=h, maxX=-1, maxY=-1;
  for (let y=0; y<h; y++) for (let x=0; x<w; x++) if (dark(x,y)) {
    if (x<minX) minX=x; if (x>maxX) maxX=x; if (y<minY) minY=y; if (y>maxY) maxY=y;
  }
  if (maxX < 0) throw new Error("Empty QR code");
  let unit = 0;
  for (let y=minY; y<=maxY; y++) {
    let last = dark(minX,y), run=1;
    for (let x=minX+1; x<=maxX; x++) {
      const now=dark(x,y);
      if (now===last) run++; else { unit = unit ? gcd(unit,run) : run; run=1; last=now; }
    }
    unit = unit ? gcd(unit,run) : run;
  }
  if (!unit || unit < 1) unit = 1;
  const cols = Math.round((maxX-minX+1)/unit);
  const rows = Math.round((maxY-minY+1)/unit);
  const rects=[];
  for (let r=0; r<rows; r++) {
    let c=0;
    while (c<cols) {
      if (!dark(Math.min(maxX, minX + Math.floor((c+0.5)*unit)), Math.min(maxY, minY + Math.floor((r+0.5)*unit)))) { c++; continue; }
      const start=c;
      while (c<cols && dark(Math.min(maxX, minX + Math.floor((c+0.5)*unit)), Math.min(maxY, minY + Math.floor((r+0.5)*unit)))) c++;
      rects.push(new fabric.Rect({ left:start, top:r, width:c-start, height:1, fill:"#000000", strokeWidth:0, selectable:false, evented:false }));
    }
  }
  rects.unshift(new fabric.Rect({ left:-4, top:-4, width:cols+8, height:rows+8, fill:"#ffffff", strokeWidth:0, selectable:false, evented:false }));
  return new fabric.Group(rects, { role:"qr", dataValue:value, originX:"center", originY:"center" });
}

$("qrBtn").onclick = () => {
  const v = prompt("Enter QR link or text:");
  if (!v) return;
  const d = document.createElement("div");
  new QRCode(d, { text: v, width: 600, height: 600, correctLevel: QRCode.CorrectLevel.H });
  setTimeout(() => {
    const qrCanvas = d.querySelector("canvas");
    if (!qrCanvas) return alert("QR code could not be created.");
    try {
      const group = qrCanvasToVectorGroup(qrCanvas, v);
      group.scaleToWidth(Math.min(W, H) * 0.35);
      group.set({ left: W / 2, top: H / 2, originX: "center", originY: "center" });
      canvas.add(group).setActiveObject(group);
      canvas.requestRenderAll();
      status("Vector QR added.");
    } catch (e) {
      alert("Vector QR could not be created: " + e.message);
    }
  }, 80);
};

$("barcodeBtn").onclick = () => {
  const v = prompt("Enter barcode value:");
  if (!v) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, v, { format: "CODE128", displayValue: true, width: 3, height: 120, margin: 10 });
    const markup = new XMLSerializer().serializeToString(svg);
    fabric.loadSVGFromString(markup, (objects, options) => {
      const group = fabric.util.groupSVGElements(objects, options);
      group.set({ role: "barcode", dataValue: v, left: W / 2, top: H / 2, originX: "center", originY: "center" });
      group.scaleToWidth(W * 0.42);
      canvas.add(group).setActiveObject(group);
      canvas.requestRenderAll();
      status("Vector barcode added.");
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
  }, ["role", "originalScaleX", "originalScaleY", "originalLeft", "originalTop", "originalOriginX", "originalOriginY", "cropActive", "dataValue"]);
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
  // 0.80 mm print bleed slightly enlarges the artwork beyond every card edge
  // to remove the last thin white strip without changing the design canvas.
  const bleed = 0.80 * 72 / 25.4;
  const drawW = pageW + bleed * 2;
  const drawH = pageH + bleed * 2;
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
      `q\n${drawW.toFixed(3)} 0 0 ${drawH.toFixed(3)} ${(-bleed).toFixed(3)} ${(-bleed).toFixed(3)} cm\n/Im${i + 1} Do\nQ`
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

async function snapshotToSvgElement(snapshotJson) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("canvas");
    const temp = new fabric.StaticCanvas(el, { width: W, height: H, backgroundColor: "#ffffff", renderOnAddRemove: false });
    temp.loadFromJSON(snapshotJson || emptySnapshot(), () => {
      try {
        temp.setDimensions({ width: W, height: H });
        temp.renderAll();
        const svgText = temp.toSVG({ width: W, height: H, viewBox: { x: 0, y: 0, width: W, height: H } });
        temp.dispose();
        const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
        const svg = doc.documentElement;
        if (svg.querySelector("parsererror")) throw new Error("SVG parser error");
        resolve(svg);
      } catch (e) { temp.dispose(); reject(e); }
    });
  });
}

async function buildVectorPdf(list, useBleed = false) {
  if (!window.jspdf || !window.jspdf.jsPDF) throw new Error("jsPDF did not load. Check internet connection.");
  saveCurrentSide();
  const c = CARD[orientation];
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: c.mmW >= c.mmH ? "landscape" : "portrait", unit: "mm", format: [c.mmW, c.mmH], compress: true, hotfixes: ["px_scaling"] });
  for (let i=0; i<list.length; i++) {
    if (i) pdf.addPage([c.mmW, c.mmH], c.mmW >= c.mmH ? "landscape" : "portrait");
    const svg = await snapshotToSvgElement(sides[list[i]]);
    const bleed = useBleed ? 0.35 : 0;
    await pdf.svg(svg, { x: -bleed, y: -bleed, width: c.mmW + bleed*2, height: c.mmH + bleed*2 });
  }
  return pdf;
}

$("vectorPdfBtn").onclick = async () => {
  try {
    const both = confirm("Export Front and Back as VECTOR PDF?\nOK = both sides\nCancel = current side only");
    const list = both ? ["front", "back"] : [currentSide];
    status("Building vector PDF...");
    const pdf = await buildVectorPdf(list, false);
    pdf.save(`Tabaja-Card-V5-Vector-${orientation}.pdf`);
    status("V5 vector PDF exported.");
  } catch (e) { alert("Vector PDF failed: " + e.message); status("Vector PDF failed."); }
};

$("vectorPrintBtn").onclick = async () => {
  try {
    status("Building vector print PDF...");
    const pdf = await buildVectorPdf([currentSide], true);
    pdf.save(`Tabaja-PRINT-V5-Vector-${currentSide}-${orientation}-CR80.pdf`);
    status("Vector CR80 PDF downloaded. Print at Actual size / 100%.");
    alert("V5 VECTOR print file downloaded.\n\nOpen it and print at Actual size / 100%. Compare the small text with the stable PDF.");
  } catch (e) { alert("Vector print failed: " + e.message); status("Vector print failed."); }
};

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
status("V5.0 VECTOR TEST — stable engine kept, vector PDF added.");
if (isLoggedIn()) showApp(); else showLogin();


// ===== V6.1 BETA: Employee Card Builder — working canvas generator =====
const V61_TEMPLATE_KEY = "tabaja_card_designer_v61_template";
let builderPhotoData = "";
let builderLogoData = "";

function builderStatus(message) { status(message); }

function readBuilderFile(input, onDone) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => builderStatus("Could not read the selected image.");
  reader.onload = () => onDone(String(reader.result || ""));
  reader.readAsDataURL(file);
}

$("builderPhoto").addEventListener("change", e => readBuilderFile(e.target, value => {
  builderPhotoData = value;
  builderStatus("Employee photo ready — press Generate / Update Card.");
}));
$("builderLogo").addEventListener("change", e => readBuilderFile(e.target, value => {
  builderLogoData = value;
  builderStatus("Company logo ready — press Generate / Update Card.");
}));

function builderObject(role) {
  return canvas.getObjects().find(object => object.role === role) || null;
}

function builderAddOrUpdateRect(role, props) {
  let object = builderObject(role);
  if (!object) {
    object = new fabric.Rect(Object.assign({ role, selectable: false, evented: false }, props));
    canvas.add(object);
  } else object.set(props);
  object.setCoords();
  return object;
}

function builderAddOrUpdateText(role, text, props) {
  let object = builderObject(role);
  const value = text || "";
  if (!object) {
    object = new fabric.Textbox(value, Object.assign({
      role,
      fontFamily: "Arial",
      editable: true,
      splitByGrapheme: false,
      lineHeight: 1.05
    }, props));
    canvas.add(object);
  } else {
    object.set(Object.assign({ text: value }, props));
  }
  object.setCoords();
  return object;
}

function fitBuilderText(object, maxFontSize, minFontSize = 12) {
  object.set({ fontSize: maxFontSize, scaleX: 1, scaleY: 1 });
  object.initDimensions();
  while ((object.height > object.heightLimit || object.width > object.widthLimit) && object.fontSize > minFontSize) {
    object.set({ fontSize: object.fontSize - 1 });
    object.initDimensions();
  }
  object.setCoords();
}

function imageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    if (!dataUrl) return resolve(null);
    fabric.Image.fromURL(dataUrl, image => image ? resolve(image) : reject(new Error("Image could not be loaded.")), { crossOrigin: "anonymous" });
  });
}

async function builderAddOrUpdateImage(role, dataUrl, box) {
  const old = builderObject(role);
  if (!dataUrl) return old;
  const image = await imageFromDataUrl(dataUrl);
  const saved = old ? {
    left: old.left, top: old.top, angle: old.angle || 0,
    originX: old.originX || "center", originY: old.originY || "center"
  } : null;
  if (old) canvas.remove(old);
  const scale = Math.min(box.width / image.width, box.height / image.height);
  image.set({
    role,
    left: saved ? saved.left : box.left + box.width / 2,
    top: saved ? saved.top : box.top + box.height / 2,
    originX: "center", originY: "center",
    angle: saved ? saved.angle : 0,
    scaleX: scale, scaleY: scale
  });
  rememberImage(image);
  canvas.add(image);
  image.setCoords();
  return image;
}

function ensureBuilderPlaceholder(role, box, label) {
  let object = builderObject(role);
  if (!object) {
    object = new fabric.Rect({
      role, left: box.left, top: box.top, width: box.width, height: box.height,
      rx: 22, ry: 22, fill: "#e9eef5", stroke: "#9eb1c5", strokeWidth: 3,
      strokeDashArray: [12, 8], selectable: false, evented: false
    });
    canvas.add(object);
  } else object.set({ left: box.left, top: box.top, width: box.width, height: box.height });
  let text = builderObject(role + "Label");
  if (!text) {
    text = new fabric.Text(label, {
      role: role + "Label", left: box.left + box.width / 2, top: box.top + box.height / 2,
      originX: "center", originY: "center", fontFamily: "Arial", fontSize: 22,
      fill: "#607286", selectable: false, evented: false
    });
    canvas.add(text);
  } else text.set({ left: box.left + box.width / 2, top: box.top + box.height / 2, text: label });
}

function removeBuilderPlaceholder(role) {
  [role, role + "Label"].forEach(r => {
    const object = builderObject(r);
    if (object) canvas.remove(object);
  });
}

function ensurePoweredBy() {
  let footer = builderObject("poweredBy");
  const footerProps = {
    text: "Powered by Tabaja Solution",
    left: W / 2, top: H - 22, width: W - 80,
    originX: "center", originY: "center", textAlign: "center",
    fontFamily: "Arial", fontSize: orientation === "landscape" ? 14 : 13,
    fontWeight: "bold", fill: "#526273", selectable: false, evented: false
  };
  if (!footer) {
    footer = new fabric.Textbox(footerProps.text, Object.assign({ role: "poweredBy" }, footerProps));
    canvas.add(footer);
  } else footer.set(footerProps);
  canvas.bringToFront(footer);
  footer.setCoords();
  return footer;
}

async function generateEmployeeCard() {
  try {
    builderStatus("Generating employee card...");
    const landscape = orientation === "landscape";
    const company = $("builderCompany").value.trim() || "COMPANY NAME";
    const name = $("builderName").value.trim() || "EMPLOYEE NAME";
    const job = $("builderJob").value.trim() || "Job Title";
    const phone = $("builderPhone").value.trim();
    const email = $("builderEmail").value.trim();
    const website = $("builderWebsite").value.trim();

    // V6.3: keep the selected canvas background visible.
    // This transparent structural layer replaces the old forced white rectangle.
    builderAddOrUpdateRect("builderBackground", {
      left: 0, top: 0, width: W, height: H, fill: "rgba(0,0,0,0)",
      selectable: false, evented: false
    });
    builderAddOrUpdateRect("builderAccent", landscape
      ? { left: 0, top: 0, width: W * 0.31, height: H, fill: "#123e66" }
      : { left: 0, top: 0, width: W, height: H * 0.25, fill: "#123e66" });
    builderAddOrUpdateRect("builderLine", landscape
      ? { left: W * 0.31, top: 0, width: 10, height: H, fill: "#2f9bdd" }
      : { left: 0, top: H * 0.25, width: W, height: 10, fill: "#2f9bdd" });

    const photoBox = landscape
      ? { left: W * 0.055, top: H * 0.20, width: W * 0.20, height: H * 0.55 }
      : { left: W * 0.27, top: H * 0.09, width: W * 0.46, height: H * 0.28 };
    const logoBox = landscape
      ? { left: W * 0.77, top: H * 0.07, width: W * 0.17, height: H * 0.15 }
      : { left: W * 0.30, top: H * 0.30, width: W * 0.40, height: H * 0.12 };

    if (builderPhotoData) {
      removeBuilderPlaceholder("employeePhotoPlaceholder");
      await builderAddOrUpdateImage("employeePhoto", builderPhotoData, photoBox);
    } else if (!builderObject("employeePhoto")) ensureBuilderPlaceholder("employeePhotoPlaceholder", photoBox, "EMPLOYEE PHOTO");

    // V6.4: the company logo is fully optional.
    // Show the real logo only when the user selects one; otherwise remove every logo guide/object
    // so nothing appears in PNG, PDF, or printing.
    removeBuilderPlaceholder("companyLogoPlaceholder");
    if (builderLogoData) {
      await builderAddOrUpdateImage("companyLogo", builderLogoData, logoBox);
    } else {
      const oldLogo = builderObject("companyLogo");
      if (oldLogo) canvas.remove(oldLogo);
    }

    const textLeft = landscape ? W * 0.36 : W * 0.10;
    const textWidth = landscape ? W * 0.57 : W * 0.80;
    const companyTop = landscape ? H * 0.12 : H * 0.45;

    const companyObj = builderAddOrUpdateText("employeeCompany", company, {
      left: textLeft, top: companyTop, width: textWidth, heightLimit: H * 0.10, widthLimit: textWidth,
      fontSize: landscape ? 29 : 28, fontWeight: "bold", fill: "#17547f", textAlign: "left"
    });
    fitBuilderText(companyObj, landscape ? 29 : 28, 16);

    const nameObj = builderAddOrUpdateText("employeeName", name, {
      left: textLeft, top: companyTop + H * 0.17, width: textWidth, heightLimit: H * 0.18, widthLimit: textWidth,
      fontSize: landscape ? 48 : 42, fontWeight: "bold", fill: "#111820", textAlign: "left"
    });
    fitBuilderText(nameObj, landscape ? 48 : 42, 20);

    const jobObj = builderAddOrUpdateText("employeeJob", job, {
      left: textLeft, top: companyTop + H * 0.34, width: textWidth, heightLimit: H * 0.10, widthLimit: textWidth,
      fontSize: landscape ? 28 : 25, fontWeight: "normal", fill: "#2c6e9d", textAlign: "left"
    });
    fitBuilderText(jobObj, landscape ? 28 : 25, 15);

    const contactLines = [phone && "Tel: " + phone, email && "Email: " + email, website && "Web: " + website].filter(Boolean);
    builderAddOrUpdateText("employeeContacts", contactLines.join("\n") || "", {
      left: textLeft, top: companyTop + H * 0.48, width: textWidth, heightLimit: H * 0.25, widthLimit: textWidth,
      fontSize: landscape ? 19 : 18, fill: "#263746", lineHeight: 1.35, textAlign: "left"
    });

    ensurePoweredBy();

    // Keep the structural background behind editable content.
    ["builderBackground", "builderAccent", "builderLine"].forEach(role => {
      const object = builderObject(role);
      if (object) canvas.sendToBack(object);
    });
    ensurePoweredBy();
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    saveCurrentSide();
    builderStatus("Employee card generated successfully — you can move and resize every employee element.");
  } catch (error) {
    console.error("V6.1 Employee Builder error:", error);
    builderStatus("Generate failed: " + (error.message || error));
    alert("Generate Card failed:\n" + (error.message || error));
  }
}

$("generateEmployeeBtn").addEventListener("click", generateEmployeeCard);
$("replacePhotoBtn").addEventListener("click", () => $("builderPhoto").click());

$("saveTemplateBtn").addEventListener("click", () => {
  ensurePoweredBy();
  saveCurrentSide();
  localStorage.setItem(V61_TEMPLATE_KEY, snapshot());
  builderStatus("Template saved on this device.");
});

$("loadTemplateBtn").addEventListener("click", async () => {
  const saved = localStorage.getItem(V61_TEMPLATE_KEY);
  if (!saved) return alert("No saved V6.1 template on this device.");
  await loadSnapshot(saved);
  ensurePoweredBy();
  saveCurrentSide();
  builderStatus("Template loaded — enter the next employee details and press Generate / Update Card.");
});

// Protect the mandatory footer from deletion.
const v61OriginalDeleteHandler = $("deleteBtn").onclick;
$("deleteBtn").onclick = () => {
  const selected = canvas.getActiveObjects();
  if (selected.some(object => object.role === "poweredBy")) {
    builderStatus("Powered by Tabaja Solution is protected.");
    return;
  }
  if (typeof v61OriginalDeleteHandler === "function") v61OriginalDeleteHandler();
};

builderStatus("V6.4 BETA ready — company logo is optional and no placeholder is exported.");

// ===== V6.3 BETA: Locked Card Background =====
function removeBackgroundImageObjects() {
  const objects = canvas.getObjects().filter(object => object.role === "background" || object.role === "cardBackgroundImage");
  objects.forEach(object => canvas.remove(object));
}

function finishCardBackground(message) {
  canvas.discardActiveObject();
  canvas.requestRenderAll();
  saveCurrentSide();
  status(message);
}

function applySolidCardBackground(color) {
  removeBackgroundImageObjects();
  canvas.setBackgroundColor(color, () => finishCardBackground("Solid card background applied."));
}

function gradientCoordinates(direction) {
  if (direction === "vertical") return { x1: 0, y1: 0, x2: 0, y2: H };
  if (direction === "diagonal") return { x1: 0, y1: 0, x2: W, y2: H };
  if (direction === "diagonalReverse") return { x1: W, y1: 0, x2: 0, y2: H };
  return { x1: 0, y1: 0, x2: W, y2: 0 };
}

function applyGradientCardBackground() {
  removeBackgroundImageObjects();
  const color1 = $("cardBgGradient1").value;
  const color2 = $("cardBgGradient2").value;
  const direction = $("cardBgGradientDirection").value;
  const gradient = new fabric.Gradient({
    type: "linear",
    gradientUnits: "pixels",
    coords: gradientCoordinates(direction),
    colorStops: [
      { offset: 0, color: color1 },
      { offset: 1, color: color2 }
    ]
  });
  canvas.setBackgroundColor(gradient, () => finishCardBackground("Gradient card background applied."));
}

function applyTransparentCardBackground() {
  removeBackgroundImageObjects();
  canvas.setBackgroundColor("rgba(0,0,0,0)", () => finishCardBackground("Transparent card background applied. White PVC will remain visible when printed."));
}

$("applySolidBackgroundBtn").addEventListener("click", () => applySolidCardBackground($("cardBgSolidColor").value));
$("applyGradientBackgroundBtn").addEventListener("click", applyGradientCardBackground);
$("transparentBackgroundBtn").addEventListener("click", applyTransparentCardBackground);
$("resetWhiteBackgroundBtn").addEventListener("click", () => {
  $("cardBgSolidColor").value = "#ffffff";
  applySolidCardBackground("#ffffff");
});
$("cardBackgroundImageBtn").addEventListener("click", () => chooseImage("background"));

// Keep the original quick color control synchronized with the new background panel.
$("cardBgSolidColor").addEventListener("input", event => {
  $("cardColor").value = event.target.value;
});
$("cardColor").addEventListener("input", event => {
  $("cardBgSolidColor").value = event.target.value;
});

status("V6.3 BETA ready — Employee Builder preserves the selected Card Background.");
