const MAX = 4;
let stream, shots = [], currentFilter = 'none', shotCount = 0, busy = false;
const video = document.getElementById('video');
const flash = document.getElementById('flash');
const cdDisplay = document.getElementById('countdown-display');
const stripPreview = document.getElementById('stripPreview');
const stripOuter = document.getElementById('stripOuter');

function showPage(p) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.getElementById(p).classList.add('active');
  document.querySelectorAll('nav ul a').forEach(a => a.classList.remove('active'));
  document.getElementById('nav-' + (p === 'landing' ? 'home' : p)).classList.add('active');
  if (p === 'booth') startCamera();
}

async function startCamera() {
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false
    });
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', syncStripHeight, { once: true });
  } catch(e) {
    alert('Camera access needed. Please allow permissions and refresh.');
  }
}

function syncStripHeight() {
  const slotW = 164;
  const slotH = Math.round(slotW * 3 / 4);
  const totalH = 8 + (slotH + 5) * 4 + 28 + 12 + 14;
  stripOuter.style.height = totalH + 'px';
  stripPreview.style.transform = 'translateY(-100%)';
  stripPreview.style.transition = 'transform 0s';
}

function setFilter(f, btn) {
  currentFilter = f;
  video.className = f === 'none' ? '' : f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function startCountdown() {
  if (busy || shotCount >= MAX) return;
  busy = true;
  document.getElementById('shootBtn').disabled = true;
  let n = 3;
  cdDisplay.textContent = n;
  cdDisplay.classList.add('show');
  const iv = setInterval(() => {
    n--;
    if (n > 0) {
      cdDisplay.textContent = n;
    } else {
      clearInterval(iv);
      cdDisplay.classList.remove('show');
      takeShot();
    }
  }, 900);
}

function takeShot() {
  flash.classList.add('pop');
  setTimeout(() => flash.classList.remove('pop'), 150);

  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;

  let sw = vw, sh = Math.round(vw * 3 / 4);
  let sx = 0, sy = Math.round((vh - sh) / 2);
  if (sh > vh) {
    sh = vh;
    sw = Math.round(vh * 4 / 3);
    sx = Math.round((vw - sw) / 2);
    sy = 0;
  }

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.translate(sw, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.restore();

  if (currentFilter === 'grayscale') applyGrayscale(ctx, canvas);
  if (currentFilter === 'sepia') applySepia(ctx, canvas);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  shots.push(dataUrl);

  const slot = document.getElementById('slot' + shotCount);
  const img = new Image();
  img.src = dataUrl;
  slot.innerHTML = '';
  slot.appendChild(img);
  document.getElementById('dot' + shotCount).classList.add('taken');
  shotCount++;
  busy = false;

  if (shotCount < MAX) {
    document.getElementById('shootBtn').disabled = false;
  } else {
    document.getElementById('shootBtn').style.display = 'none';
    animatePrint();
  }
}

function animatePrint() {
  stripPreview.style.transition = 'transform 0s';
  stripPreview.style.transform = 'translateY(-100%)';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      stripPreview.style.transition = 'transform 2s cubic-bezier(0.33, 1, 0.68, 1)';
      stripPreview.style.transform = 'translateY(0%)';
    });
  });
  setTimeout(() => {
    document.getElementById('downloadBtn').style.display = 'block';
    document.getElementById('retakeBtn').style.display = 'block';
  }, 2200);
}

function applyGrayscale(ctx, canvas) {
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const g = d.data[i] * 0.299 + d.data[i+1] * 0.587 + d.data[i+2] * 0.114;
    d.data[i] = d.data[i+1] = d.data[i+2] = g;
  }
  ctx.putImageData(d, 0, 0);
}

function applySepia(ctx, canvas) {
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i], g = d.data[i+1], b = d.data[i+2];
    d.data[i]   = Math.min(255, r*0.393 + g*0.769 + b*0.189);
    d.data[i+1] = Math.min(255, r*0.349 + g*0.686 + b*0.168);
    d.data[i+2] = Math.min(255, r*0.272 + g*0.534 + b*0.131);
  }
  ctx.putImageData(d, 0, 0);
}

function updateStripMeta() {
  const cap = document.getElementById('caption').value;
  const showDate = document.getElementById('dateToggle').checked;
  document.getElementById('stripCaption').textContent = cap;
  document.getElementById('stripDate').textContent = showDate
    ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
}

function downloadStrip() {
  const PAD = 16, GAP = 8, BOTTOM = 72, SW = 500;
  const FW = SW - PAD * 2;
  const FH = Math.round(FW * 3 / 4);
  const H = PAD + (FH + GAP) * 4 - GAP + BOTTOM;

  const canvas = document.getElementById('offscreen');
  canvas.width = SW;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SW, H);

  let loaded = 0;
  shots.forEach((src, i) => {
    const img = new Image();
    img.onload = () => {
      const y = PAD + i * (FH + GAP);
      ctx.drawImage(img, PAD, y, FW, FH);
      loaded++;
      if (loaded === shots.length) finishDownload(ctx, canvas, SW, H, PAD, FH, GAP);
    };
    img.src = src;
  });
}

function finishDownload(ctx, canvas, W, H, PAD, FH, GAP) {
  const cap = document.getElementById('caption').value;
  const showDate = document.getElementById('dateToggle').checked;
  const baseY = PAD + (FH + GAP) * 4 - GAP;

  if (cap) {
    ctx.fillStyle = '#333';
    ctx.font = '20px "Special Elite", serif';
    ctx.textAlign = 'center';
    ctx.fillText(cap, W / 2, baseY + 28);
  }
  if (showDate) {
    ctx.fillStyle = '#aaa';
    ctx.font = '14px "Special Elite", serif';
    ctx.textAlign = 'center';
    const d = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    ctx.fillText(d, W / 2, baseY + 52);
  }

  const a = document.createElement('a');
  a.download = 'photovault-strip.jpg';
  a.href = canvas.toDataURL('image/jpeg', 0.95);
  a.click();
}

function resetBooth() {
  shots = []; shotCount = 0; busy = false;
  for (let i = 0; i < MAX; i++) {
    document.getElementById('slot' + i).innerHTML = '<span class="empty-icon">○</span>';
    document.getElementById('dot' + i).classList.remove('taken');
  }
  stripPreview.style.transition = 'transform 0s';
  stripPreview.style.transform = 'translateY(-100%)';
  document.getElementById('shootBtn').style.display = '';
  document.getElementById('shootBtn').disabled = false;
  document.getElementById('downloadBtn').style.display = 'none';
  document.getElementById('retakeBtn').style.display = 'none';
  document.getElementById('caption').value = '';
  updateStripMeta();
}

// Init
updateStripMeta();
stripPreview.style.transform = 'translateY(-100%)';
stripPreview.style.transition = 'transform 0s';
