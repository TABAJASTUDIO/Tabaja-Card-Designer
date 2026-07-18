(() => {
  "use strict";

  const WIDTH = 1011;
  const HEIGHT = 638;
  const STORAGE_KEY = "tabaja-card-designer-v3-production";

  if (typeof fabric === "undefined") {
    alert("Fabric.js failed to load. Check your internet connection.");
    return;
  }

  const $ = (id) => document.getElementById(id);

  const canvas = new fabric.Canvas("cardCanvas", {
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: "#ffffff",
    preserveObjectStacking: true,
    selection: true
  });

  const sides = {
    front: null,
    back: JSON.stringify({ version: "5.3.0", objects: [], background: "#ffffff" })
  };

  let currentSide = "front";
  let isRestoring = false;
  let zoomLevel = 1;
  let undoStack = [];
  let redoStack = [];
  let promptResolver = null;

  function serializeCanvas() {
    return JSON.stringify(canvas.toJSON(["name", "dataValue"]));
  }

  function pushHistory() {
    if (isRestoring) return;
    const state = serializeCanvas();
    if (undoStack[undoStack.length - 1] !== state) {
      undoStack.push(state);
      if (undoStack.length > 60) undoStack.shift();
      redoStack = [];
    }
  }

  async function loadCanvasState(json) {
    isRestoring = true;

    await new Promise((resolve) => {
      canvas.loadFromJSON(json, () => {
        canvas.renderAll();
        isRestoring = false;
        resolve();
      });
    });
  }

  function saveCurrentSide() {
    sides[currentSide] = serializeCanvas();
  }

  async function switchSide(side) {
    if (side === currentSide) return;

    saveCurrentSide();
    currentSide = side;

    $("frontTab").classList.toggle("active", side === "front");
    $("backTab").classList.toggle("active", side === "back");

    const state = sides[side] || JSON.stringify({
      version: "5.3.0",
      objects: [],
      background: "#ffffff"
    });

    await loadCanvasState(state);
    undoStack = [serializeCanvas()];
    redoStack = [];
  }

  function normalizeColor(color) {
    if (typeof color !== "string") return "#111111";

    if (/^#[0-9a-fA-F]{6}$/.test(color)) {
      return color;
    }

    if (/^#[0-9a-fA-F]{3}$/.test(color)) {
      return "#" + color
        .slice(1)
        .split("")
        .map((character) => character + character)
        .join("");
    }

    return "#111111";
  }

  function fitObject(object, maxWidth, maxHeight) {
    const scale = Math.min(
      maxWidth / object.width,
      maxHeight / object.height,
      1
    );

    object.set({
      scaleX: scale,
      scaleY: scale
    });

    canvas.centerObject(object);
    object.setCoords();
  }


  function getSelectedImage() {
    const object = canvas.getActiveObject();
    if (!object || object.type !== "image") {
      alert("Select an image first.");
      return null;
    }
    return object;
  }

  function fillSelectedImage() {
    const image = getSelectedImage();
    if (!image) return;
    const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
    image.set({scaleX:scale,scaleY:scale,left:WIDTH/2,top:HEIGHT/2,originX:"center",originY:"center",angle:0});
    image.setCoords(); canvas.renderAll(); pushHistory();
  }

  function fitSelectedImage() {
    const image = getSelectedImage();
    if (!image) return;
    const scale = Math.min(WIDTH / image.width, HEIGHT / image.height);
    image.set({scaleX:scale,scaleY:scale,left:WIDTH/2,top:HEIGHT/2,originX:"center",originY:"center",angle:0});
    image.setCoords(); canvas.renderAll(); pushHistory();
  }

  function resetSelectedImage() {
    const image = getSelectedImage();
    if (!image) return;
    image.set({scaleX:1,scaleY:1,angle:0,left:WIDTH/2,top:HEIGHT/2,originX:"center",originY:"center",opacity:1});
    fitObject(image,WIDTH*0.7,HEIGHT*0.7); canvas.renderAll(); pushHistory();
  }

  function toggleCropMode() {
    const image = getSelectedImage();
    if (!image) return;
    const enabled=!image.cropMode; image.cropMode=enabled;
    image.set({lockRotation:enabled,transparentCorners:false,cornerStyle:enabled?"circle":"rect"});
    document.body.classList.toggle("crop-active",enabled);
    $("cropModeBtn").textContent=enabled?"Exit Crop Mode":"Crop Mode";
    alert(enabled?"Crop Mode is ON. Drag and resize the image until it covers the card the way you want, then press Exit Crop Mode.":"Crop Mode is OFF.");
    canvas.renderAll();
  }

  function addText() {
    const text = new fabric.IText("New Text", {
      left: WIDTH / 2,
      top: HEIGHT / 2,
      originX: "center",
      originY: "center",
      fontFamily: $("fontFamily").value,
      fontSize: Number($("fontSize").value) || 34,
      fill: $("textColor").value || "#111111"
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
    canvas.renderAll();
    pushHistory();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function addImageFile(file, role = "image") {
    if (!file || !file.type.startsWith("image/")) return;

    const dataUrl = await readFileAsDataUrl(file);

    fabric.Image.fromURL(dataUrl, (image) => {
      image.set({
        name: role
      });

      if (role === "logo") {
        fitObject(image, WIDTH * 0.35, HEIGHT * 0.35);
      } else {
        fitObject(image, WIDTH * 0.7, HEIGHT * 0.7);
      }

      canvas.add(image);
      canvas.setActiveObject(image);
      canvas.renderAll();
      pushHistory();
    });
  }

  async function setBackgroundImage(file) {
    if (!file || !file.type.startsWith("image/")) return;

    const dataUrl = await readFileAsDataUrl(file);

    fabric.Image.fromURL(dataUrl, (image) => {
      const scale = Math.max(
        WIDTH / image.width,
        HEIGHT / image.height
      );

      image.set({
        scaleX: scale,
        scaleY: scale,
        left: WIDTH / 2,
        top: HEIGHT / 2,
        originX: "center",
        originY: "center"
      });

      canvas.setBackgroundImage(
        image,
        canvas.renderAll.bind(canvas)
      );

      pushHistory();
    });
  }

  function ask(title, defaultValue = "") {
    $("promptTitle").textContent = title;
    $("promptInput").value = defaultValue;
    $("promptModal").classList.add("show");

    setTimeout(() => $("promptInput").focus(), 0);

    return new Promise((resolve) => {
      promptResolver = resolve;
    });
  }

  function closePrompt(value) {
    $("promptModal").classList.remove("show");

    if (promptResolver) {
      promptResolver(value);
    }

    promptResolver = null;
  }

  async function addQrCode() {
    const value = await ask(
      "QR Code content",
      "https://tabajastudio.github.io/"
    );

    if (!value) return;

    const holder = document.createElement("div");

    new QRCode(holder, {
      text: value,
      width: 512,
      height: 512,
      correctLevel: QRCode.CorrectLevel.H
    });

    setTimeout(() => {
      const source =
        holder.querySelector("img") ||
        holder.querySelector("canvas");

      const data =
        source.tagName === "CANVAS"
          ? source.toDataURL("image/png")
          : source.src;

      fabric.Image.fromURL(data, (image) => {
        image.set({
          left: WIDTH / 2,
          top: HEIGHT / 2,
          originX: "center",
          originY: "center",
          name: "qr",
          dataValue: value
        });

        fitObject(image, 240, 240);

        canvas.add(image);
        canvas.setActiveObject(image);
        canvas.renderAll();
        pushHistory();
      });
    }, 80);
  }

  async function addBarcode() {
    const value = await ask("Barcode value", "000001");
    if (!value) return;

    const barcodeCanvas = document.createElement("canvas");

    try {
      JsBarcode(barcodeCanvas, value, {
        format: "CODE128",
        displayValue: true,
        fontSize: 24,
        margin: 12,
        background: "#ffffff",
        lineColor: "#111111"
      });

      fabric.Image.fromURL(
        barcodeCanvas.toDataURL("image/png"),
        (image) => {
          image.set({
            left: WIDTH / 2,
            top: HEIGHT / 2,
            originX: "center",
            originY: "center",
            name: "barcode",
            dataValue: value
          });

          fitObject(image, 480, 180);

          canvas.add(image);
          canvas.setActiveObject(image);
          canvas.renderAll();
          pushHistory();
        }
      );
    } catch (error) {
      alert("Barcode error: " + error.message);
    }
  }

  function duplicateSelected() {
    const activeObject = canvas.getActiveObject();

    if (!activeObject) {
      alert("Select an object first.");
      return;
    }

    activeObject.clone((cloned) => {
      cloned.set({
        left: (activeObject.left || 0) + 30,
        top: (activeObject.top || 0) + 30,
        evented: true
      });

      if (cloned.type === "activeSelection") {
        cloned.canvas = canvas;

        cloned.forEachObject((object) => {
          canvas.add(object);
        });

        cloned.setCoords();
      } else {
        canvas.add(cloned);
      }

      canvas.setActiveObject(cloned);
      canvas.renderAll();
      pushHistory();
    });
  }

  function deleteSelected() {
    const activeObjects = canvas.getActiveObjects();

    if (!activeObjects.length) return;

    activeObjects.forEach((object) => {
      canvas.remove(object);
    });

    canvas.discardActiveObject();
    canvas.renderAll();
    pushHistory();
  }

  function clearSide() {
    if (!confirm("Clear all objects from this side?")) return;

    canvas.getObjects().forEach((object) => {
      canvas.remove(object);
    });

    canvas.setBackgroundImage(
      null,
      canvas.renderAll.bind(canvas)
    );

    canvas.backgroundColor = "#ffffff";
    canvas.renderAll();
    pushHistory();
  }

  function centerSelected(axis) {
    const object = canvas.getActiveObject();

    if (!object) {
      alert("Select an object first.");
      return;
    }

    if (axis === "horizontal") {
      object.set({
        left: WIDTH / 2,
        originX: "center"
      });
    }

    if (axis === "vertical") {
      object.set({
        top: HEIGHT / 2,
        originY: "center"
      });
    }

    object.setCoords();
    canvas.renderAll();
    pushHistory();
  }

  function updateProperties() {
    const object = canvas.getActiveObject();
    if (!object) return;

    $("opacity").value = object.opacity ?? 1;
    $("rotation").value = object.angle ?? 0;

    if (
      object.type === "i-text" ||
      object.type === "text" ||
      object.type === "textbox"
    ) {
      $("textValue").value = object.text || "";
      $("fontSize").value = Math.round(object.fontSize || 34);
      $("textColor").value = normalizeColor(
        object.fill || "#111111"
      );
      $("fontFamily").value = object.fontFamily || "Arial";
    }
  }

  function applyTextProperty(property, value) {
    const object = canvas.getActiveObject();

    if (
      !object ||
      !["i-text", "text", "textbox"].includes(object.type)
    ) {
      return;
    }

    object.set(property, value);
    object.setCoords();
    canvas.renderAll();
  }

  async function undo() {
    if (undoStack.length <= 1) return;

    const current = undoStack.pop();
    redoStack.push(current);

    await loadCanvasState(
      undoStack[undoStack.length - 1]
    );
  }

  async function redo() {
    if (!redoStack.length) return;

    const state = redoStack.pop();
    undoStack.push(state);

    await loadCanvasState(state);
  }

  function setZoom(level) {
    zoomLevel = Math.max(0.5, Math.min(2, level));

    document.querySelector(".card-shell").style.transform =
      `scale(${zoomLevel})`;

    $("zoomResetBtn").textContent =
      Math.round(zoomLevel * 100) + "%";
  }

  function projectData() {
    saveCurrentSide();

    return {
      app: "Tabaja Card Designer",
      version: 3,
      currentSide,
      sides
    };
  }

  function saveProject() {
    const data = projectData();

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Tabaja-Card-Project.tabaja";
    link.click();

    URL.revokeObjectURL(link.href);
  }

  async function openProject(file) {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data || !data.sides) {
      throw new Error("Invalid project file.");
    }

    sides.front = data.sides.front;
    sides.back = data.sides.back;

    currentSide =
      data.currentSide === "back"
        ? "back"
        : "front";

    $("frontTab").classList.toggle(
      "active",
      currentSide === "front"
    );

    $("backTab").classList.toggle(
      "active",
      currentSide === "back"
    );

    await loadCanvasState(
      sides[currentSide] ||
      JSON.stringify({
        objects: [],
        background: "#ffffff"
      })
    );

    undoStack = [serializeCanvas()];
    redoStack = [];
  }

  async function renderSideDataUrl(side) {
    saveCurrentSide();

    const originalSide = currentSide;

    if (side !== currentSide) {
      currentSide = side;

      await loadCanvasState(
        sides[side] ||
        JSON.stringify({
          objects: [],
          background: "#ffffff"
        })
      );
    }

    canvas.discardActiveObject();
    canvas.renderAll();

    const data = canvas.toDataURL({
      format: "png",
      multiplier: 1
    });

    if (originalSide !== currentSide) {
      currentSide = originalSide;

      await loadCanvasState(
        sides[originalSide] ||
        JSON.stringify({
          objects: [],
          background: "#ffffff"
        })
      );
    }

    return data;
  }

  async function exportPng() {
    const exportBoth = confirm(
      "Export Front and Back?\nOK = both sides\nCancel = current side only"
    );

    const sidesToExport = exportBoth
      ? ["front", "back"]
      : [currentSide];

    for (const side of sidesToExport) {
      const data = await renderSideDataUrl(side);
      const link = document.createElement("a");
      link.href = data;
      link.download =
        `Tabaja-Card-${side}-300DPI.png`;
      link.click();
    }
  }

  async function exportPdf() {
    if (!window.jspdf) {
      alert("jsPDF failed to load.");
      return;
    }

    const { jsPDF } = window.jspdf;

    const exportBoth = confirm(
      "Create a two-page PDF?\nOK = Front + Back\nCancel = current side"
    );

    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: [85.6, 53.98],
      compress: true
    });

    if (exportBoth) {
      const front = await renderSideDataUrl("front");
      pdf.addImage(
        front,
        "PNG",
        0,
        0,
        85.6,
        53.98
      );

      pdf.addPage(
        [85.6, 53.98],
        "landscape"
      );

      const back = await renderSideDataUrl("back");
      pdf.addImage(
        back,
        "PNG",
        0,
        0,
        85.6,
        53.98
      );
    } else {
      const current = await renderSideDataUrl(
        currentSide
      );

      pdf.addImage(
        current,
        "PNG",
        0,
        0,
        85.6,
        53.98
      );
    }

    pdf.save("Tabaja-Card-CR80.pdf");
  }

  async function printCard() {
    const data = await renderSideDataUrl(
      currentSide
    );

    $("printArea").innerHTML =
      `<img src="${data}" alt="Card print">`;

    setTimeout(() => {
      window.print();
    }, 200);
  }


  async function printBothSides() {
    const front = await renderSideDataUrl("front");
    const back = await renderSideDataUrl("back");
    $("printArea").innerHTML = `<div class="print-page"><img src="${front}" alt="Front side"></div><div class="print-page"><img src="${back}" alt="Back side"></div>`;
    setTimeout(() => window.print(), 250);
  }

  async function nfcAction() {
    const url = await ask(
      "NFC URL",
      "https://tabajastudio.github.io/Tabaja-Card-Designer/"
    );

    if (!url) return;

    if ("NDEFReader" in window) {
      try {
        const ndef = new NDEFReader();

        await ndef.write({
          records: [
            {
              recordType: "url",
              data: url
            }
          ]
        });

        alert("NFC written successfully.");
      } catch (error) {
        alert(
          "NFC writing failed: " +
          error.message
        );
      }

      return;
    }

    try {
      await navigator.clipboard.writeText(url);

      alert(
        "Web NFC is not supported on this device. " +
        "The URL was copied. Use your NFC writer software."
      );
    } catch {
      alert(
        "Web NFC is not supported. Use this URL in your NFC writer software:\n" +
        url
      );
    }
  }

  function newProject() {
    if (
      !confirm(
        "Start a new project? Unsaved changes will be lost."
      )
    ) {
      return;
    }

    sides.front = JSON.stringify({
      version: "5.3.0",
      objects: [],
      background: "#ffffff"
    });

    sides.back = JSON.stringify({
      version: "5.3.0",
      objects: [],
      background: "#ffffff"
    });

    currentSide = "front";

    $("frontTab").classList.add("active");
    $("backTab").classList.remove("active");

    loadCanvasState(sides.front).then(() => {
      undoStack = [serializeCanvas()];
      redoStack = [];
    });
  }

  canvas.on("object:modified", pushHistory);
  canvas.on("object:added", pushHistory);
  canvas.on("object:removed", pushHistory);
  canvas.on("selection:created", updateProperties);
  canvas.on("selection:updated", updateProperties);
  canvas.on("object:rotating", updateProperties);

  $("addTextBtn").addEventListener("click", addText);
  $("addImageBtn").addEventListener("click", () => $("imageInput").click());
  $("addLogoBtn").addEventListener("click", () => $("logoInput").click());
  $("backgroundBtn").addEventListener("click", () => $("backgroundInput").click());
  $("fillCardBtn").addEventListener("click", fillSelectedImage);
  $("fitCardBtn").addEventListener("click", fitSelectedImage);
  $("cropModeBtn").addEventListener("click", toggleCropMode);
  $("resetImageBtn").addEventListener("click", resetSelectedImage);

  $("imageInput").addEventListener("change", (event) => {
    addImageFile(event.target.files[0], "image");
    event.target.value = "";
  });

  $("logoInput").addEventListener("change", (event) => {
    addImageFile(event.target.files[0], "logo");
    event.target.value = "";
  });

  $("backgroundInput").addEventListener("change", (event) => {
    setBackgroundImage(event.target.files[0]);
    event.target.value = "";
  });

  $("qrBtn").addEventListener("click", addQrCode);
  $("barcodeBtn").addEventListener("click", addBarcode);
  $("duplicateBtn").addEventListener("click", duplicateSelected);
  $("nfcBtn").addEventListener("click", nfcAction);

  $("bringFrontBtn").addEventListener("click", () => {
    const object = canvas.getActiveObject();
    if (!object) return;
    object.bringToFront();
    canvas.renderAll();
    pushHistory();
  });

  $("sendBackBtn").addEventListener("click", () => {
    const object = canvas.getActiveObject();
    if (!object) return;
    object.sendToBack();
    canvas.renderAll();
    pushHistory();
  });

  $("centerHBtn").addEventListener("click", () => {
    centerSelected("horizontal");
  });

  $("centerVBtn").addEventListener("click", () => {
    centerSelected("vertical");
  });

  $("deleteBtn").addEventListener("click", deleteSelected);
  $("clearBtn").addEventListener("click", clearSide);

  $("frontTab").addEventListener("click", () => {
    switchSide("front");
  });

  $("backTab").addEventListener("click", () => {
    switchSide("back");
  });

  $("textValue").addEventListener("input", (event) => {
    applyTextProperty("text", event.target.value);
  });

  $("fontSize").addEventListener("input", (event) => {
    applyTextProperty(
      "fontSize",
      Number(event.target.value) || 34
    );
  });

  $("fontFamily").addEventListener("change", (event) => {
    applyTextProperty(
      "fontFamily",
      event.target.value
    );
  });

  $("textColor").addEventListener("input", (event) => {
    applyTextProperty(
      "fill",
      event.target.value
    );
  });

  $("boldBtn").addEventListener("click", () => {
    const object = canvas.getActiveObject();

    if (
      !object ||
      !["i-text", "text", "textbox"].includes(object.type)
    ) {
      return;
    }

    applyTextProperty(
      "fontWeight",
      object.fontWeight === "bold"
        ? "normal"
        : "bold"
    );

    pushHistory();
  });

  $("italicBtn").addEventListener("click", () => {
    const object = canvas.getActiveObject();

    if (
      !object ||
      !["i-text", "text", "textbox"].includes(object.type)
    ) {
      return;
    }

    applyTextProperty(
      "fontStyle",
      object.fontStyle === "italic"
        ? "normal"
        : "italic"
    );

    pushHistory();
  });

  $("backgroundColor").addEventListener("input", (event) => {
    canvas.backgroundColor = event.target.value;
    canvas.renderAll();
  });

  $("backgroundColor").addEventListener("change", pushHistory);

  $("opacity").addEventListener("input", (event) => {
    const object = canvas.getActiveObject();
    if (!object) return;

    object.set(
      "opacity",
      Number(event.target.value)
    );

    canvas.renderAll();
  });

  $("opacity").addEventListener("change", pushHistory);

  $("rotation").addEventListener("input", (event) => {
    const object = canvas.getActiveObject();
    if (!object) return;

    object.rotate(Number(event.target.value));
    object.setCoords();
    canvas.renderAll();
  });

  $("rotation").addEventListener("change", pushHistory);

  $("undoBtn").addEventListener("click", undo);
  $("redoBtn").addEventListener("click", redo);

  $("zoomOutBtn").addEventListener("click", () => {
    setZoom(zoomLevel - 0.1);
  });

  $("zoomInBtn").addEventListener("click", () => {
    setZoom(zoomLevel + 0.1);
  });

  $("zoomResetBtn").addEventListener("click", () => {
    setZoom(1);
  });

  $("newBtn").addEventListener("click", newProject);
  $("saveBtn").addEventListener("click", saveProject);
  $("openBtn").addEventListener("click", () => $("projectInput").click());

  $("projectInput").addEventListener("change", async (event) => {
    try {
      await openProject(event.target.files[0]);
    } catch (error) {
      alert(
        "Cannot open project: " +
        error.message
      );
    }

    event.target.value = "";
  });

  $("exportPngBtn").addEventListener("click", exportPng);
  $("exportPdfBtn").addEventListener("click", exportPdf);
  $("printBtn").addEventListener("click", printCard);
  $("printBothBtn").addEventListener("click", printBothSides);

  $("promptOk").addEventListener("click", () => {
    closePrompt($("promptInput").value.trim());
  });

  $("promptCancel").addEventListener("click", () => {
    closePrompt(null);
  });

  $("promptInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      closePrompt(event.target.value.trim());
    }

    if (event.key === "Escape") {
      closePrompt(null);
    }
  });

  $("dropZone").addEventListener("dragover", (event) => {
    event.preventDefault();
    $("dropZone").classList.add("dragging");
  });

  $("dropZone").addEventListener("dragleave", () => {
    $("dropZone").classList.remove("dragging");
  });

  $("dropZone").addEventListener("drop", (event) => {
    event.preventDefault();
    $("dropZone").classList.remove("dragging");

    const file = [...event.dataTransfer.files].find(
      (item) => item.type.startsWith("image/")
    );

    if (file) {
      addImageFile(file, "image");
    }
  });

  document.addEventListener("keydown", (event) => {
    const tagName = document.activeElement?.tagName;

    const editing =
      ["INPUT", "TEXTAREA", "SELECT"].includes(tagName) ||
      canvas.getActiveObject()?.isEditing;

    if (editing) return;

    if (
      event.key === "Delete" ||
      event.key === "Backspace"
    ) {
      deleteSelected();
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "z"
    ) {
      event.preventDefault();
      undo();
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "y"
    ) {
      event.preventDefault();
      redo();
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "d"
    ) {
      event.preventDefault();
      duplicateSelected();
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "s"
    ) {
      event.preventDefault();
      saveProject();
    }
  });

  sides.front = serializeCanvas();
  undoStack = [serializeCanvas()];

  const savedProject = localStorage.getItem(
    STORAGE_KEY
  );

  if (
    savedProject &&
    confirm("A saved project exists in this browser. Open it?")
  ) {
    openProject(
      new File(
        [savedProject],
        "saved.tabaja",
        { type: "application/json" }
      )
    ).catch(() => {});
  }
})();
