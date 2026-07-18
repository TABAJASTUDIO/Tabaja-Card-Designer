const cardCanvas = document.getElementById("cardCanvas");
const placeholder = cardCanvas.querySelector(".placeholder");
const imageInput = document.getElementById("imageInput");

let selectedItem = null;
let currentSide = "front";

function hidePlaceholder() {
  placeholder.style.display = cardCanvas.querySelector(".design-item")
    ? "none"
    : "grid";
}

function selectItem(item) {
  document.querySelectorAll(".design-item").forEach((el) => {
    el.classList.remove("selected");
  });

  selectedItem = item;

  if (selectedItem) {
    selectedItem.classList.add("selected");
  }
}

function makeDraggable(item) {
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  let dragging = false;

  item.addEventListener("mousedown", (event) => {
    selectItem(item);
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    initialLeft = parseFloat(item.style.left || 0);
    initialTop = parseFloat(item.style.top || 0);
    event.preventDefault();
  });

  document.addEventListener("mousemove", (event) => {
    if (!dragging) return;

    const nextLeft = initialLeft + event.clientX - startX;
    const nextTop = initialTop + event.clientY - startY;

    item.style.left = `${Math.max(0, Math.min(nextLeft, cardCanvas.clientWidth - item.offsetWidth))}px`;
    item.style.top = `${Math.max(0, Math.min(nextTop, cardCanvas.clientHeight - item.offsetHeight))}px`;
  });

  document.addEventListener("mouseup", () => {
    dragging = false;
  });
}

function addText() {
  const text = prompt("Enter text:");
  if (!text) return;

  const item = document.createElement("div");
  item.className = "design-item";
  item.textContent = text;
  item.style.left = "80px";
  item.style.top = "80px";
  item.style.fontSize = `${document.getElementById("fontSize").value}px`;
  item.style.color = document.getElementById("textColor").value;
  item.dataset.side = currentSide;

  cardCanvas.appendChild(item);
  makeDraggable(item);
  selectItem(item);
  hidePlaceholder();
}

function addImage(source) {
  const item = document.createElement("div");
  item.className = "design-item";
  item.style.left = "100px";
  item.style.top = "100px";
  item.style.width = "220px";
  item.style.height = "220px";
  item.dataset.side = currentSide;

  const image = document.createElement("img");
  image.src = source;
  image.alt = "Uploaded image";

  item.appendChild(image);
  cardCanvas.appendChild(item);
  makeDraggable(item);
  selectItem(item);
  hidePlaceholder();
}

function clearCard() {
  cardCanvas.querySelectorAll(".design-item").forEach((item) => item.remove());
  selectedItem = null;
  hidePlaceholder();
}

function changeSide(side) {
  currentSide = side;

  document.getElementById("frontBtn").classList.toggle("active", side === "front");
  document.getElementById("backBtn").classList.toggle("active", side === "back");

  cardCanvas.querySelectorAll(".design-item").forEach((item) => {
    item.style.display = item.dataset.side === side ? "block" : "none";
  });

  selectItem(null);
  hidePlaceholder();
}

document.getElementById("addTextBtn").addEventListener("click", addText);

document.getElementById("addImageBtn").addEventListener("click", () => {
  imageInput.click();
});

document.getElementById("addLogoBtn").addEventListener("click", () => {
  imageInput.click();
});

imageInput.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => addImage(reader.result);
  reader.readAsDataURL(file);
  imageInput.value = "";
});

document.getElementById("bgColor").addEventListener("input", (event) => {
  cardCanvas.style.background = event.target.value;
});

document.getElementById("textColor").addEventListener("input", (event) => {
  if (selectedItem && !selectedItem.querySelector("img")) {
    selectedItem.style.color = event.target.value;
  }
});

document.getElementById("fontSize").addEventListener("input", (event) => {
  if (selectedItem && !selectedItem.querySelector("img")) {
    selectedItem.style.fontSize = `${event.target.value}px`;
  }
});

document.getElementById("deleteBtn").addEventListener("click", () => {
  if (!selectedItem) return;
  selectedItem.remove();
  selectedItem = null;
  hidePlaceholder();
});

document.getElementById("clearBtn").addEventListener("click", clearCard);
document.getElementById("newBtn").addEventListener("click", clearCard);

document.getElementById("frontBtn").addEventListener("click", () => changeSide("front"));
document.getElementById("backBtn").addEventListener("click", () => changeSide("back"));

document.getElementById("printBtn").addEventListener("click", () => {
  window.print();
});

document.getElementById("saveBtn").addEventListener("click", () => {
  localStorage.setItem("tabaja-card-designer", cardCanvas.innerHTML);
  alert("Design saved in this browser.");
});

document.getElementById("exportBtn").addEventListener("click", () => {
  alert("PNG export will be connected in the next step.");
});

cardCanvas.addEventListener("click", (event) => {
  if (event.target === cardCanvas) {
    selectItem(null);
  }
});

hidePlaceholder();
