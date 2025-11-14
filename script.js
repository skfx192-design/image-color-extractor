/* Image Color Extractor - simple k-means on sampled pixels */
const fileInput = document.getElementById('file-input');
const dropArea = document.getElementById('drop-area');
const imagePreview = document.getElementById('image-preview');
const canvas = document.getElementById('canvas');
const extractBtn = document.getElementById('extract-btn');
const downloadBtn = document.getElementById('download-btn');
const kInput = document.getElementById('k-input');
const sampleInput = document.getElementById('sample-input');
const paletteEl = document.getElementById('palette');

let currentPalette = [];
let currentCounts = [];

function preventDefaults (e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter','dragover','dragleave','drop'].forEach(evt=>{
  dropArea.addEventListener(evt, preventDefaults, false)
});

dropArea.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', handleFile, false);
extractBtn.addEventListener('click', () => {
  if (imagePreview.src) extract();
});
downloadBtn.addEventListener('click', ()=> {
  if (!currentPalette.length) return alert('No palette to download');
  const data = currentPalette.map((c,i)=>({hex: rgbToHex(...c), rgb:c, count: currentCounts[i]}));
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'palette.json';
  a.click();
  URL.revokeObjectURL(url);
});

function handleDrop(e){
  const dt = e.dataTransfer;
  const files = dt.files;
  if (files && files[0]) handleFile({ target: { files } });
}

function handleFile(e){
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return alert('Please provide an image file');
  const url = URL.createObjectURL(file);
  loadImage(url);
}

function loadImage(src){
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => {
    // fit preview
    imagePreview.src = src;
    // draw to canvas for sampling
    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    extract();
    URL.revokeObjectURL(src); // free blob URL if created from file
  };
  img.onerror = () => alert('Failed to load image');
  img.src = src;
}

function extract(){
  const k = Math.max(1, Math.min(20, parseInt(kInput.value) || 6));
  const sample = Math.max(1, Math.min(50, parseInt(sampleInput.value) || 8));
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  if (width === 0 || height === 0) return alert('Image not ready');
  const imageData = ctx.getImageData(0,0,width,height).data;
  const pixels = [];

  // sample pixels with stride = sample
  for (let y = 0; y < height; y += sample) {
    for (let x = 0; x < width; x += sample) {
      const idx = (y * width + x) * 4;
      const r = imageData[idx], g = imageData[idx+1], b = imageData[idx+2], a = imageData[idx+3];
      if (a === 0) continue; // skip transparent
      pixels.push([r,g,b]);
    }
  }
  if (!pixels.length) return alert('No pixels sampled. Try decreasing sample rate.');

  const {centroids, counts} = kmeans(pixels, k, 12);
  currentPalette = centroids;
  currentCounts = counts;
  renderPalette(centroids, counts);
}

function renderPalette(palette, counts){
  paletteEl.innerHTML = '';
  const total = counts.reduce((s,v)=>s+v,0) || 1;
  palette.forEach((rgb, i) => {
    const hex = rgbToHex(...rgb);
    const percent = Math.round((counts[i]/total)*1000)/10;
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.innerHTML = `
      <div class="color-strip" style="background:${hex}"></div>
      <div class="meta">
        <div>
          <div class="hex">${hex}</div>
          <div class="population">${rgb[0]}, ${rgb[1]}, ${rgb[2]}</div>
        </div>
        <div class="population">${percent}%</div>
      </div>
    `;
    sw.title = `Click to copy ${hex}`;
    sw.addEventListener('click', ()=> {
      navigator.clipboard?.writeText(hex).then(()=>{
        flashCopy(sw);
      });
    });
    paletteEl.appendChild(sw);
  });
}

function flashCopy(el){
  const original = el.style.transform;
  el.style.transform = 'scale(0.98)';
  setTimeout(()=> el.style.transform = original, 120);
}

/* --------- Simple K-means implementation ---------- */
// pixels: array of [r,g,b]
// k: number of clusters
// maxIter: max iterations
function kmeans(pixels, k, maxIter=10) {
  // initialize centroids by random picking
  const centroids = [];
  const used = new Set();
  while (centroids.length < k && centroids.length < pixels.length) {
    const idx = Math.floor(Math.random() * pixels.length);
    if (used.has(idx)) continue;
    used.add(idx);
    centroids.push(pixels[idx].slice());
  }
  // if k > unique pixels, pad by duplicates
  while (centroids.length < k) centroids.push(pixels[Math.floor(Math.random()*pixels.length)].slice());

  let assignments = new Array(pixels.length).fill(-1);
  for (let iter=0; iter<maxIter; iter++) {
    let changed = false;
    // assign
    for (let i=0;i<pixels.length;i++){
      const p = pixels[i];
      let best = 0;
      let bestDist = dist2(p, centroids[0]);
      for (let c=1;c<centroids.length;c++){
        const d = dist2(p, centroids[c]);
        if (d < bestDist){ bestDist = d; best = c; }
      }
      if (assignments[i] !== best){ assignments[i] = best; changed = true; }
    }
    // update centroids
    const sums = Array.from({length:centroids.length}, ()=>[0,0,0,0]); // r,g,b,count
    for (let i=0;i<pixels.length;i++){
      const c = assignments[i];
      const p = pixels[i];
      sums[c][0] += p[0];
      sums[c][1] += p[1];
      sums[c][2] += p[2];
      sums[c][3] += 1;
    }
    for (let c=0;c<centroids.length;c++){
      const count = sums[c][3];
      if (count === 0) {
        // reinitialize to random pixel
        const r = pixels[Math.floor(Math.random()*pixels.length)];
        centroids[c] = r.slice();
      } else {
        centroids[c][0] = Math.round(sums[c][0] / count);
        centroids[c][1] = Math.round(sums[c][1] / count);
        centroids[c][2] = Math.round(sums[c][2] / count);
      }
    }
    if (!changed) break;
  }

  // compute counts per centroid
  const counts = new Array(centroids.length).fill(0);
  for (let i=0;i<assignments.length;i++) counts[assignments[i]]++;

  // sort centroids by count desc
  const order = centroids.map((c,i)=>({i, count: counts[i], rgb: c}))
    .sort((a,b)=>b.count - a.count);

  return {
    centroids: order.map(o=>o.rgb),
    counts: order.map(o=>o.count)
  };
}

function dist2(a,b){
  const dr = a[0]-b[0], dg=a[1]-b[1], db=a[2]-b[2];
  return dr*dr + dg*dg + db*db;
}

function rgbToHex(r,g,b){
  return '#' + [r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
}

/* try to allow clicking on image to pick color */
imagePreview.addEventListener('click', (e)=>{
  const rect = imagePreview.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // scale to canvas
  if (!canvas.width || !canvas.height) return;
  // compute ratio
  const imgW = imagePreview.naturalWidth;
  const imgH = imagePreview.naturalHeight;
  const dispW = imagePreview.clientWidth;
  const dispH = imagePreview.clientHeight;
  // compute offset due to fit (center), assume object-fit: contain (default)
  const scale = Math.min(dispW / imgW, dispH / imgH);
  const scaledW = imgW * scale;
  const scaledH = imgH * scale;
  const offsetX = (dispW - scaledW) / 2;
  const offsetY = (dispH - scaledH) / 2;
  const imgX = Math.round((x - offsetX) / scale);
  const imgY = Math.round((y - offsetY) / scale);
  if (imgX < 0 || imgY < 0 || imgX >= imgW || imgY >= imgH) return;
  // read from canvas scaled image
  const ctx = canvas.getContext('2d');
  const sx = Math.round(imgX * (canvas.width / imgW));
  const sy = Math.round(imgY * (canvas.height / imgH));
  try {
    const d = ctx.getImageData(sx, sy, 1, 1).data;
    const hex = rgbToHex(d[0], d[1], d[2]);
    navigator.clipboard?.writeText(hex).then(()=> alert(`Copied ${hex}`));
  } catch (err) {
    // security error if cross-origin - ignore
    console.warn('Could not read pixel:', err);
  }
});