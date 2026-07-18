# Tabaja Card Designer V4.3

Production update built on the original GitHub project.

## Login
- Username: `admin`
- Password: `Tabaja@2026`

## Included
- Login, Keep me signed in, Logout
- Landscape and Portrait CR80 card design
- Front and Back sides
- Export PNG at 1011×638 or 638×1011
- Built-in PDF export without jsPDF
- High-quality Print Current and Print Front + Back
- Fill Card, Fit Inside, Crop Mode, Reset Image
- Rotate selected image 90 degrees
- Save/Open project with orientation
- QR, barcode and NFC link tools

Upload `index.html`, `app.js`, and `style.css` to the repository root.
The old `scripts` and `styles` folders are not used by this version.

## V4.3 print repair
- Print Current and Print Front + Back now create a print-ready CR80 PDF.
- Both sides are flattened to full-colour JPEG with a solid white base.
- A small bleed is applied only to printing to prevent a white strip at the card edge.
- Cache-busting version tags ensure GitHub Pages loads the new CSS and JavaScript.


## V4.3 fixes
- Direct print dialog without opening a blob/PDF tab
- Exact CR80 print page with bleed to remove the lower white strip
- Back Fill Card stretches artwork exactly to the card without cropping
- Front Fill Card behaviour remains unchanged


## V4.3 Print Size Fix
- Print page now uses the exact canvas pixel size instead of millimetres.
- Fixes cards appearing small inside the Zebra custom pixel page.
- Front and Back Fill Card behaviour remains unchanged.
