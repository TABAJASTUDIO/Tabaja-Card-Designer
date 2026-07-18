# Tabaja Card Designer V3 Production

## Included
- Add Text
- Add Image
- Add Logo
- Background image
- Drag and drop
- Move, resize and rotate
- Front / Back
- QR Code
- CODE128 Barcode
- Duplicate
- Bring Front / Send Back
- Center Horizontal / Vertical
- Undo / Redo
- Zoom
- Save/Open `.tabaja` project
- Export PNG
- Export PDF
- CR80 print
- NFC fallback support

## Publish
Upload the contents of this folder to the repository root:

- index.html
- styles/style.css
- scripts/app.js
- README.md

Then commit, sync and refresh GitHub Pages.

## Important
The web app loads Fabric.js, QRCode.js, JsBarcode and jsPDF from CDN, so internet access is required.

Windows + ACR122U direct NFC writing still requires a local helper app.
Silent direct Zebra printing still requires Zebra Browser Print/SDK or a local helper.
