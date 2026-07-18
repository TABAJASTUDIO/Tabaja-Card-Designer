const W=1011,H=638;
const canvas=new fabric.Canvas("cardCanvas",{backgroundColor:"#ffffff",preserveObjectStacking:true});
canvas.setDimensions({width:W,height:H});
let sides={front:null,back:null},currentSide="front",pendingImageRole="image",cropMode=false;

const $=id=>document.getElementById(id);
function status(msg){$("status").textContent=msg}
function snapshot(){return JSON.stringify(canvas.toJSON(["role","originalScaleX","originalScaleY","originalLeft","originalTop","cropActive"]))}
function loadSnapshot(data){canvas.loadFromJSON(data||{objects:[],background:"#fff"},()=>{canvas.renderAll();syncProps()})}
function saveCurrentSide(){sides[currentSide]=snapshot()}
function switchSide(side){saveCurrentSide();currentSide=side;loadSnapshot(sides[side]);$("frontBtn").classList.toggle("active",side==="front");$("backBtn").classList.toggle("active",side==="back");status(side.toUpperCase()+" side")}
function activeImage(){const o=canvas.getActiveObject();return o&&o.type==="image"?o:null}
function rememberImage(o){if(o.originalScaleX==null){o.originalScaleX=o.scaleX;o.originalScaleY=o.scaleY;o.originalLeft=o.left;o.originalTop=o.top}}
function clearClip(o){o.clipPath=null;o.cropActive=false;cropMode=false;$("cropBtn").classList.remove("active")}
function cardClip(){return new fabric.Rect({left:0,top:0,width:W,height:H,absolutePositioned:true})}

function fillCard(){
 const o=activeImage(); if(!o)return status("Select an image first.");
 rememberImage(o); clearClip(o);
 const scale=Math.max(W/o.width,H/o.height);
 o.set({scaleX:scale,scaleY:scale,left:W/2,top:H/2,originX:"center",originY:"center"});
 o.setCoords();canvas.requestRenderAll();status("Fill Card applied.");
}
function fitInside(){
 const o=activeImage(); if(!o)return status("Select an image first.");
 rememberImage(o); clearClip(o);
 const scale=Math.min(W/o.width,H/o.height);
 o.set({scaleX:scale,scaleY:scale,left:W/2,top:H/2,originX:"center",originY:"center"});
 o.setCoords();canvas.requestRenderAll();status("Fit Inside applied.");
}
function toggleCrop(){
 const o=activeImage(); if(!o)return status("Select an image first.");
 rememberImage(o);cropMode=!cropMode;
 if(cropMode){o.clipPath=cardClip();o.cropActive=true;$("cropBtn").classList.add("active");status("Crop Mode ON: drag or resize the image.");}
 else{clearClip(o);status("Crop Mode OFF.");}
 canvas.requestRenderAll();
}
function resetImage(){
 const o=activeImage();if(!o)return status("Select an image first.");
 if(o.originalScaleX!=null)o.set({scaleX:o.originalScaleX,scaleY:o.originalScaleY,left:o.originalLeft,top:o.originalTop,originX:"left",originY:"top"});
 clearClip(o);o.setCoords();canvas.requestRenderAll();status("Image reset.");
}

function addImageFromFile(file,role){
 const r=new FileReader();r.onload=()=>fabric.Image.fromURL(r.result,img=>{
   img.set({left:W/2,top:H/2,originX:"center",originY:"center",role});
   const s=Math.min((role==="logo"?W*.3:W*.6)/img.width,(role==="logo"?H*.3:H*.6)/img.height);
   img.scale(s);rememberImage(img);canvas.add(img).setActiveObject(img);canvas.requestRenderAll();status(role+" added.");
 });r.readAsDataURL(file);
}
$("imageInput").onchange=e=>{const f=e.target.files[0];if(f)addImageFromFile(f,pendingImageRole);e.target.value=""};
function chooseImage(role){pendingImageRole=role;$("imageInput").click()}

$("addTextBtn").onclick=()=>{const t=new fabric.IText("Your Text",{left:W/2,top:H/2,originX:"center",originY:"center",fontSize:34,fill:"#111"});canvas.add(t).setActiveObject(t);syncProps()};
$("addImageBtn").onclick=()=>chooseImage("image");
$("addLogoBtn").onclick=()=>chooseImage("logo");
$("backgroundBtn").onclick=()=>chooseImage("background");
$("fillBtn").onclick=fillCard;$("fitBtn").onclick=fitInside;$("cropBtn").onclick=toggleCrop;$("resetImageBtn").onclick=resetImage;

$("qrBtn").onclick=()=>{const v=prompt("Enter QR link or text:");if(!v)return;const d=document.createElement("div");new QRCode(d,{text:v,width:300,height:300});setTimeout(()=>fabric.Image.fromURL(d.querySelector("canvas").toDataURL(),img=>{img.scale(.6);img.set({left:W/2,top:H/2,originX:"center",originY:"center"});canvas.add(img).setActiveObject(img)}),50)};
$("barcodeBtn").onclick=()=>{const v=prompt("Enter barcode value:");if(!v)return;const c=document.createElement("canvas");try{JsBarcode(c,v,{format:"CODE128",displayValue:true});fabric.Image.fromURL(c.toDataURL(),img=>{img.scaleToWidth(420);img.set({left:W/2,top:H/2,originX:"center",originY:"center"});canvas.add(img).setActiveObject(img)})}catch(e){alert("Invalid barcode value.")}};
$("nfcBtn").onclick=async()=>{const v=prompt("Enter NFC link:");if(!v)return;if("NDEFReader"in window){try{const n=new NDEFReader();await n.write(v);alert("NFC written successfully.")}catch(e){alert("NFC could not be written: "+e.message)}}else{navigator.clipboard?.writeText(v);alert("Web NFC is unavailable here. Link copied.")}};
$("duplicateBtn").onclick=()=>{const o=canvas.getActiveObject();if(!o)return;o.clone(c=>{c.set({left:o.left+25,top:o.top+25});canvas.add(c).setActiveObject(c);canvas.requestRenderAll()})};
$("deleteBtn").onclick=()=>{const o=canvas.getActiveObject();if(o){canvas.remove(o);canvas.discardActiveObject();canvas.requestRenderAll()}};

function syncProps(){const o=canvas.getActiveObject();if(!o)return;$("opacity").value=o.opacity??1;$("rotation").value=o.angle??0;if(o.type==="i-text"||o.type==="text"){$("textValue").value=o.text||"";$("fontSize").value=o.fontSize||34;$("fontFamily").value=o.fontFamily||"Arial";$("textColor").value=toHex(o.fill||"#111111")}}
function toHex(c){if(typeof c==="string"&&c.startsWith("#"))return c.length===4?"#"+c[1]+c[1]+c[2]+c[2]+c[3]+c[3]:c;return "#111111"}
canvas.on("selection:created",syncProps);canvas.on("selection:updated",syncProps);canvas.on("object:modified",syncProps);
$("textValue").oninput=e=>{const o=canvas.getActiveObject();if(o&&(o.type==="i-text"||o.type==="text")){o.set("text",e.target.value);canvas.requestRenderAll()}};
$("fontSize").oninput=e=>{const o=canvas.getActiveObject();if(o&&o.set){o.set("fontSize",+e.target.value);canvas.requestRenderAll()}};
$("fontFamily").onchange=e=>{const o=canvas.getActiveObject();if(o){o.set("fontFamily",e.target.value);canvas.requestRenderAll()}};
$("textColor").oninput=e=>{const o=canvas.getActiveObject();if(o){o.set("fill",e.target.value);canvas.requestRenderAll()}};
$("boldBtn").onclick=()=>{const o=canvas.getActiveObject();if(o){o.set("fontWeight",o.fontWeight==="bold"?"normal":"bold");canvas.requestRenderAll()}};
$("italicBtn").onclick=()=>{const o=canvas.getActiveObject();if(o){o.set("fontStyle",o.fontStyle==="italic"?"normal":"italic");canvas.requestRenderAll()}};
$("cardColor").oninput=e=>{canvas.setBackgroundColor(e.target.value,canvas.renderAll.bind(canvas))};
$("opacity").oninput=e=>{const o=canvas.getActiveObject();if(o){o.set("opacity",+e.target.value);canvas.requestRenderAll()}};
$("rotation").oninput=e=>{const o=canvas.getActiveObject();if(o){o.rotate(+e.target.value);o.setCoords();canvas.requestRenderAll()}};

$("frontBtn").onclick=()=>switchSide("front");$("backBtn").onclick=()=>switchSide("back");
$("newBtn").onclick=()=>{if(confirm("Start a new project?")){sides={front:null,back:null};currentSide="front";canvas.clear();canvas.setBackgroundColor("#fff",canvas.renderAll.bind(canvas));status("New project.")}};
$("saveBtn").onclick=()=>{saveCurrentSide();const blob=new Blob([JSON.stringify({version:"3.1.2",front:sides.front,back:sides.back,currentSide})],{type:"application/json"});downloadBlob(blob,"Tabaja-Card-Project.tabaja")};
$("openBtn").onclick=()=>$("projectInput").click();
$("projectInput").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(r.result);sides.front=p.front;sides.back=p.back;currentSide=p.currentSide||"front";loadSnapshot(sides[currentSide]);$("frontBtn").classList.toggle("active",currentSide==="front");$("backBtn").classList.toggle("active",currentSide==="back");status("Project opened.")}catch(err){alert("Invalid project file.")}};r.readAsText(f);e.target.value=""};

function exportSide(side){return new Promise(resolve=>{const old=currentSide;saveCurrentSide();loadSnapshot(sides[side]);setTimeout(()=>{canvas.discardActiveObject();canvas.requestRenderAll();const data=canvas.toDataURL({format:"png",multiplier:1});loadSnapshot(sides[old]);currentSide=old;resolve(data)},120)})}
$("pngBtn").onclick=async()=>{saveCurrentSide();const both=confirm("Export Front and Back?\nOK = both sides\nCancel = current side only");if(both){for(const s of ["front","back"]){const d=await exportSide(s);downloadData(d,`Tabaja-Card-${s}-300DPI.png`)}}else downloadData(canvas.toDataURL({format:"png"}),`Tabaja-Card-${currentSide}-300DPI.png`)};
$("pdfBtn").onclick=async()=>{saveCurrentSide();if(!window.jspdf||!window.jspdf.jsPDF){alert("jsPDF failed to load. Check internet connection and refresh.");return}const {jsPDF}=window.jspdf;const both=confirm("Export Front and Back?\nOK = both sides\nCancel = current side only");const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:[85.6,53.98]});const list=both?["front","back"]:[currentSide];for(let i=0;i<list.length;i++){if(i)pdf.addPage([85.6,53.98],"landscape");const data=await exportSide(list[i]);pdf.addImage(data,"PNG",0,0,85.6,53.98)}pdf.save("Tabaja-Card.pdf")};

async function printSides(list){const imgs=[];for(const s of list)imgs.push(await exportSide(s));const w=window.open("","_blank");if(!w)return alert("Allow pop-ups for printing.");w.document.write(`<html><head><style>@page{size:85.6mm 53.98mm;margin:0}body{margin:0}.page{width:85.6mm;height:53.98mm;page-break-after:always}.page:last-child{page-break-after:auto}img{width:85.6mm;height:53.98mm;display:block}</style></head><body>${imgs.map(x=>`<div class="page"><img src="${x}"></div>`).join("")}<script>onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);w.document.close()}
$("printBtn").onclick=()=>printSides([currentSide]);$("printBothBtn").onclick=()=>printSides(["front","back"]);

function downloadData(data,name){const a=document.createElement("a");a.href=data;a.download=name;a.click()}
function downloadBlob(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
canvas.setBackgroundColor("#fff",canvas.renderAll.bind(canvas));sides.front=snapshot();sides.back=snapshot();status("V3.1.2 ready.");
