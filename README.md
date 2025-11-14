# Image Color Extractor

A small client-side web app that extracts dominant colors from an image using k-means clustering on sampled pixels. No server required — open `index.html` in your browser.

Features
- Upload or drag-and-drop an image
- Choose number of colors (k)
- Adjust sampling rate (speed vs. accuracy)
- View palette with HEX/RGB values and population bars
- Click a color to copy its HEX to clipboard
- Download palette JSON

How to use
1. Open `index.html` in a modern browser.
2. Drag an image onto the drop area or click "Choose image" to upload.
3. Adjust "Colors" and "Sample rate" if desired.
4. Click "Extract colors" (it runs automatically after load).
5. Click any color swatch to copy its HEX code.

Files added
- index.html — app UI
- style.css — styles
- script.js — extraction logic (canvas sampling + k-means)

Notes & possible improvements
- Use more advanced quantization (MMCQ / median cut / octree) for large images
- Add Web Worker to move k-means off the main thread for large sample sizes
- Allow exporting palette as ASE/GPL files

License: MIT