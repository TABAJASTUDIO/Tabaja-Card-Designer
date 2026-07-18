const CARD_W=1011,CARD_H=638;
const fabricCanvas=new fabric.Canvas("cardCanvas",{width:CARD_W,height:CARD_H,backgroundColor:"#ffffff",preserveObjectStacking:true,selection:true});
const sides={front:null,back:null};let currentSide="front",history=[],historyIndex=-1,isRestoring=false;

let dummyElement;

dummyElement = new Proxy(function () {}, {
  get(target, property) {
    if (property === "value") return "";
    if (property === "checked") return false;
    if (property === "files") return [];
    if (property === "style") return {};
    if (property === "classList") {
      return {
        add() {},
        remove() {},
        toggle() {}
      };
    }

    return dummyElement;
  },

  set() {
    return true;
  },

  apply() {
    return undefined;
  }
});

const $ = id => document.getElementById(id) || dummyElement;
function status(msg){$("statusText").textContent=msg}
function saveSide(){sides[currentSide]=JSON.stringify(fabricCanvas.toJSON(["customType"]))}
function loadSide(side){saveSide();currentSide=side;const data=sides[side];isRestoring=true;if(data){fabricCanvas.loadFromJSON(data,()=>{fabricCanvas.renderAll();isRestoring=false;pushHistory()})}else{fabricCanvas.clear();fabricCanvas.setBackgroundColor("#fff",fabricCanvas.renderAll.bind(fabricCanvas));isRestoring=false;pushHistory()}$("frontSideBtn").classList.toggle("active",side==="front");$("backSideBtn").classList.toggle("active",side==="back");updateSelection()}
function pushHistory(){if(isRestoring)return;const state=JSON.stringify(fabricCanvas.toJSON(["customType"]));if(history[historyIndex]===state)return;history=history.slice(0,historyIndex+1);history.push(state);historyIndex=history.length-1}
function restoreHistory(i){if(i<0||i>=history.length)return;historyIndex=i;isRestoring=true;fabricCanvas.loadFromJSON(history[i],()=>{fabricCanvas.renderAll();isRestoring=false;updateSelection()})}
fabricCanvas.on("object:added",pushHistory);fabricCanvas.on("object:modified",pushHistory);fabricCanvas.on("object:removed",pushHistory);fabricCanvas.on("selection:created",updateSelection);fabricCanvas.on("selection:updated",updateSelection);fabricCanvas.on("selection:cleared",updateSelection);

function updateSelection(){const o=fabricCanvas.getActiveObject();$("selectedText").textContent=o?`${o.type} selected`:"No object selected";if(!o)return;$("opacity").value=Math.round((o.opacity??1)*100);$("angle").value=Math.round(o.angle||0);$("objWidth").value=Math.round(o.getScaledWidth());$("objHeight").value=Math.round(o.getScaledHeight());$("lockObject").checked=!o.selectable;if(o.type==="i-text"||o.type==="text"){$("textValue").value=o.text||"";$("fontSize").value=o.fontSize||38;$("fontFamily").value=o.fontFamily||"Arial";$("textColor").value=o.fill||"#111111"}}
function active(){return fabricCanvas.getActiveObject()}
function addText(){const t=new fabric.IText("New Text",{left:80,top:80,fontSize:42,fill:"#111",fontFamily:"Arial"});fabricCanvas.add(t).setActiveObject(t);fabricCanvas.renderAll()}
function addImageFile(file,asBackground=false){if(!file)return;const r=new FileReader();r.onload=e=>fabric.Image.fromURL(e.target.result,img=>{if(asBackground){const scale=Math.max(CARD_W/img.width,CARD_H/img.height);img.set({left:CARD_W/2,top:CARD_H/2,originX:"center",originY:"center",scaleX:scale,scaleY:scale,selectable:false,evented:false});fabricCanvas.setBackgroundImage(img,fabricCanvas.renderAll.bind(fabricCanvas));pushHistory()}else{img.scaleToWidth(300);img.set({left:100,top:100});fabricCanvas.add(img).setActiveObject(img);fabricCanvas.renderAll()}});r.readAsDataURL(file)}
function makeQr(){const link=$("cardLink").value.trim();if(!link){alert("Enter the card link first.");return}const holder=document.createElement("div");new QRCode(holder,{text:link,width:400,height:400,correctLevel:QRCode.CorrectLevel.H});setTimeout(()=>{const src=holder.querySelector("canvas")?.toDataURL()||holder.querySelector("img")?.src;fabric.Image.fromURL(src,img=>{img.scaleToWidth(180);img.set({left:760,top:400,customType:"qr"});fabricCanvas.add(img).setActiveObject(img);fabricCanvas.renderAll()})},50)}
function makeBarcode(){const value=$("barcodeValue").value.trim();if(!value)return;const c=document.createElement("canvas");JsBarcode(c,value,{format:"CODE128",displayValue:true,fontSize:28,height:100,margin:8});fabric.Image.fromURL(c.toDataURL(),img=>{img.scaleToWidth(350);img.set({left:550,top:460,customType:"barcode"});fabricCanvas.add(img).setActiveObject(img);fabricCanvas.renderAll()})}
function duplicate(){const o=active();if(!o)return;o.clone(cl=>{cl.set({left:o.left+25,top:o.top+25});fabricCanvas.add(cl).setActiveObject(cl);fabricCanvas.renderAll()})}
function del(){const o=active();if(o){fabricCanvas.remove(o);fabricCanvas.discardActiveObject();fabricCanvas.renderAll()}}
function exportData(side){const previous=currentSide;saveSide();let result;const doExport=()=>fabricCanvas.toDataURL({format:"png",quality:1,multiplier:1});if(side===currentSide)return doExport();return null}
function download(url,name){const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove()}
function exportPng(){saveSide();download(fabricCanvas.toDataURL({format:"png",quality:1,multiplier:1}),`Tabaja-${currentSide}-300dpi.png`)}
function exportPdf(){saveSide();const {jsPDF}=window.jspdf;const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:[85.6,53.98]});pdf.addImage(fabricCanvas.toDataURL({format:"png",quality:1}),"PNG",0,0,85.6,53.98);pdf.save(`Tabaja-${currentSide}.pdf`)}
function projectPayload(){saveSide();return{version:2,currentSide,sides}}
function saveProject(){const blob=new Blob([JSON.stringify(projectPayload())],{type:"application/json"});const u=URL.createObjectURL(blob);download(u,"Tabaja-Card-Project.tcd");setTimeout(()=>URL.revokeObjectURL(u),1000)}
function openProject(file){if(!file)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);sides.front=p.sides?.front||null;sides.back=p.sides?.back||null;currentSide=p.currentSide||"front";const data=sides[currentSide];isRestoring=true;if(data)fabricCanvas.loadFromJSON(data,()=>{fabricCanvas.renderAll();isRestoring=false;pushHistory();updateSelection()});else{fabricCanvas.clear();fabricCanvas.setBackgroundColor("#fff",fabricCanvas.renderAll.bind(fabricCanvas));isRestoring=false}status("Project loaded")}catch(e){alert("Invalid project file.")}};r.readAsText(file)}
function quickSave(){localStorage.setItem("tabaja-card-v2",JSON.stringify(projectPayload()));status("Saved in browser")}
function quickLoad(){const raw=localStorage.getItem("tabaja-card-v2");if(!raw){alert("No browser save found.");return}const p=JSON.parse(raw);sides.front=p.sides.front;sides.back=p.sides.back;currentSide=p.currentSide||"front";const data=sides[currentSide];isRestoring=true;fabricCanvas.loadFromJSON(data,()=>{fabricCanvas.renderAll();isRestoring=false;pushHistory();updateSelection()});status("Loaded from browser")}
function printCard(){saveSide();const area=$("printArea");area.innerHTML="";const img=new Image();img.src=fabricCanvas.toDataURL({format:"png",quality:1});area.appendChild(img);setTimeout(()=>window.print(),150)}
async function writeNfc(){const link=$("cardLink").value.trim();if(!link){alert("Enter the card link first.");return}if(!("NDEFReader"in window)){alert("Web NFC is not supported on this browser/device. Copy the link and use your NFC writer app or ACR122U software.");return}try{const ndef=new NDEFReader();await ndef.write({records:[{recordType:"url",data:link}]});alert("NFC written successfully.")}catch(e){alert(`NFC write failed: ${e.message}`)}}
$("nfcSupport").textContent=("NDEFReader"in window)?"Web NFC available on this device.":"Web NFC not available here; use Android Chrome or ACR122U software.";

$("addTextBtn").onclick=addText;$("imageInput").onchange=e=>addImageFile(e.target.files[0]);$("logoInput").onchange=e=>addImageFile(e.target.files[0]);$("backgroundInput").onchange=e=>addImageFile(e.target.files[0],true);
$("addQrBtn").onclick=makeQr;$("addBarcodeBtn").onclick=makeBarcode;$("duplicateBtn").onclick=duplicate;$("deleteBtn").onclick=del;
$("frontObjBtn").onclick=()=>{const o=active();if(o){o.bringToFront();fabricCanvas.renderAll();pushHistory()}};$("backObjBtn").onclick=()=>{const o=active();if(o){o.sendToBack();fabricCanvas.renderAll();pushHistory()}};
$("centerHBtn").onclick=()=>{const o=active();if(o){o.centerH();o.setCoords();fabricCanvas.renderAll();pushHistory()}};$("centerVBtn").onclick=()=>{const o=active();if(o){o.centerV();o.setCoords();fabricCanvas.renderAll();pushHistory()}};
$("undoBtn").onclick=()=>restoreHistory(historyIndex-1);$("redoBtn").onclick=()=>restoreHistory(historyIndex+1);$("frontSideBtn").onclick=()=>loadSide("front");$("backSideBtn").onclick=()=>loadSide("back");
$("newBtn").onclick=()=>{if(confirm("Start a new project?")){sides.front=null;sides.back=null;history=[];historyIndex=-1;fabricCanvas.clear();fabricCanvas.setBackgroundColor("#fff",fabricCanvas.renderAll.bind(fabricCanvas));pushHistory()}};
$("saveBrowserBtn").onclick=quickSave;$("loadBrowserBtn").onclick=quickLoad;$("downloadProjectBtn").onclick=saveProject;$("openProjectBtn").onclick=()=>$("projectInput").click();$("projectInput").onchange=e=>openProject(e.target.files[0]);
$("exportPngBtn").onclick=exportPng;$("exportPdfBtn").onclick=exportPdf;$("printBtn").onclick=printCard;$("addQrBtn").onclick=makeQr;$("addBarcodeBtn").onclick=makeBarcode;$("writeNfcBtn").onclick=writeNfc;
$("copyLinkBtn").onclick=async()=>{await navigator.clipboard.writeText($("cardLink").value);status("Link copied")};
$("textValue").oninput=e=>{const o=active();if(o&&(o.type==="i-text"||o.type==="text")){o.set("text",e.target.value);fabricCanvas.renderAll()}};
$("fontSize").oninput=e=>{const o=active();if(o)o.set("fontSize",Number(e.target.value)),fabricCanvas.renderAll()};$("fontFamily").onchange=e=>{const o=active();if(o)o.set("fontFamily",e.target.value),fabricCanvas.renderAll()};$("textColor").oninput=e=>{const o=active();if(o)o.set("fill",e.target.value),fabricCanvas.renderAll()};
$("opacity").oninput=e=>{const o=active();if(o)o.set("opacity",Number(e.target.value)/100),fabricCanvas.renderAll()};$("angle").oninput=e=>{const o=active();if(o)o.rotate(Number(e.target.value)),o.setCoords(),fabricCanvas.renderAll()};
$("objWidth").onchange=e=>{const o=active();if(o){o.scaleToWidth(Number(e.target.value));fabricCanvas.renderAll()}};$("objHeight").onchange=e=>{const o=active();if(o){o.scaleToHeight(Number(e.target.value));fabricCanvas.renderAll()}};
$("lockObject").onchange=e=>{const o=active();if(o){const locked=e.target.checked;o.set({lockMovementX:locked,lockMovementY:locked,lockScalingX:locked,lockScalingY:locked,lockRotation:locked,hasControls:!locked});fabricCanvas.renderAll()}};
$("cardBgColor").oninput=e=>fabricCanvas.setBackgroundColor(e.target.value,fabricCanvas.renderAll.bind(fabricCanvas));$("clearBackgroundBtn").onclick=()=>fabricCanvas.setBackgroundImage(null,fabricCanvas.renderAll.bind(fabricCanvas));
document.addEventListener("keydown",e=>{if(e.key==="Delete")del();if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){e.preventDefault();e.shiftKey?restoreHistory(historyIndex+1):restoreHistory(historyIndex-1)}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="d"){e.preventDefault();duplicate()}});
pushHistory();