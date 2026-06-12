// ===================== STATE =====================
let stream = null;
let facingMode = 'environment';
let currentMode = 'photo'; // 'photo' | 'video'
let torchOn = false;
let gridOn = false;
let timerSeconds = 0; // 0, 3, 10
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recordStartTime = 0;
let recTimerInterval = null;
let track = null;
let capabilities = null;

// ===================== ELEMENTS =====================
const video = document.getElementById('video');
const shotCanvas = document.getElementById('shotCanvas');
const shutter = document.getElementById('shutter');
const flipBtn = document.getElementById('flipBtn');
const flashBtn = document.getElementById('flashBtn');
const gridBtn = document.getElementById('gridBtn');
const timerBtn = document.getElementById('timerBtn');
const timerLabel = document.getElementById('timerLabel');
const timerVal = document.getElementById('timerVal');
const grid = document.getElementById('grid');
const focusRing = document.getElementById('focusRing');
const countdown = document.getElementById('countdown');
const countdownNum = document.getElementById('countdownNum');
const flashFx = document.getElementById('flashFx');
const recIndicator = document.getElementById('recIndicator');
const recTime = document.getElementById('recTime');
const toast = document.getElementById('toast');
const overlay = document.getElementById('overlay');
const overlayMsg = document.getElementById('overlayMsg');
const retryBtn = document.getElementById('retryBtn');
const galleryThumb = document.getElementById('galleryThumb');
const galleryView = document.getElementById('galleryView');
const galleryGrid = document.getElementById('galleryGrid');
const galleryEmpty = document.getElementById('galleryEmpty');
const closeGallery = document.getElementById('closeGallery');
const lightbox = document.getElementById('lightbox');
const lightboxContent = document.getElementById('lightboxContent');
const closeLightbox = document.getElementById('closeLightbox');
const deleteBtn = document.getElementById('deleteBtn');
const settingsBtn = document.getElementById('settingsBtn');
const stage = document.getElementById('stage');

let currentLightboxId = null;

// ===================== TOAST =====================
function showToast(msg, ms=1400){
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> toast.classList.remove('show'), ms);
}

// ===================== CAMERA =====================
async function startCamera(){
  overlay.classList.add('hidden');

  if(!window.isSecureContext && location.protocol !== 'file:'){
    overlay.classList.remove('hidden');
    overlayMsg.textContent = 'Camera needs HTTPS or to run as an installed app.';
    return;
  }

  try{
    if(stream){ stream.getTracks().forEach(t=>t.stop()); }

    const constraints = {
      audio: currentMode === 'video',
      video: {
        facingMode: facingMode,
        width: { ideal: 4096 },
        height: { ideal: 2160 }
      }
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    await video.play();

    track = stream.getVideoTracks()[0];
    capabilities = track.getCapabilities ? track.getCapabilities() : {};

    // reset torch UI if not supported
    if(!capabilities.torch){
      flashBtn.classList.remove('active');
      torchOn = false;
    }
  }catch(err){
    overlay.classList.remove('hidden');
    overlayMsg.textContent = 'Could not access camera: ' + (err.message || err.name);
  }
}

// ===================== FLIP =====================
flipBtn.addEventListener('click', ()=>{
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  torchOn = false;
  flashBtn.classList.remove('active');
  startCamera();
});

// ===================== FLASH / TORCH =====================
flashBtn.addEventListener('click', async ()=>{
  if(!track || !capabilities || !capabilities.torch){
    showToast('Flash not supported on this camera');
    return;
  }
  torchOn = !torchOn;
  try{
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    flashBtn.classList.toggle('active', torchOn);
  }catch(e){
    showToast('Could not toggle flash');
    torchOn = !torchOn;
  }
});

// ===================== GRID =====================
gridBtn.addEventListener('click', ()=>{
  gridOn = !gridOn;
  grid.classList.toggle('show', gridOn);
  gridBtn.classList.toggle('active', gridOn);
});

// ===================== TIMER =====================
timerBtn.addEventListener('click', ()=>{
  if(timerSeconds === 0) timerSeconds = 3;
  else if(timerSeconds === 3) timerSeconds = 10;
  else timerSeconds = 0;

  if(timerSeconds === 0){
    timerLabel.classList.remove('show','on');
    timerBtn.classList.remove('active');
    timerVal.textContent = 'OFF';
  } else {
    timerLabel.classList.add('show','on');
    timerBtn.classList.add('active');
    timerVal.textContent = timerSeconds + 's';
    showToast('Timer: ' + timerSeconds + 's');
    setTimeout(()=> timerLabel.classList.remove('show'), 1500);
  }
});

// ===================== RESOLUTION SETTINGS =====================
settingsBtn.addEventListener('click', async ()=>{
  if(!track) return;
  const settings = track.getSettings ? track.getSettings() : {};
  const w = settings.width || '?';
  const h = settings.height || '?';
  showToast(`Resolution: ${w} x ${h}`, 2000);
});

// ===================== FOCUS TAP =====================
stage.addEventListener('click', (e)=>{
  if(e.target.closest('.iconbtn') || e.target.closest('#shutterWrap') || e.target.closest('#bottombar')) return;
  const rect = stage.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  focusRing.style.left = x + 'px';
  focusRing.style.top = y + 'px';
  focusRing.classList.remove('show');
  void focusRing.offsetWidth; // reflow to restart animation
  focusRing.classList.add('show');

  // attempt manual focus if supported
  if(track && capabilities && capabilities.focusMode && capabilities.focusMode.includes('manual') && capabilities.focusDistance){
    // best-effort; many browsers don't expose point-of-interest focus
  }
});

// ===================== MODE SWITCH =====================
document.querySelectorAll('#modes .mode').forEach(el=>{
  el.addEventListener('click', ()=>{
    if(isRecording) return;
    document.querySelectorAll('#modes .mode').forEach(m=>m.classList.remove('active'));
    el.classList.add('active');
    currentMode = el.dataset.mode;
    shutter.classList.toggle('video-mode', currentMode === 'video');
    // restart stream to add/remove audio track for video mode
    startCamera();
  });
});

// ===================== CAPTURE PHOTO =====================
function capturePhoto(){
  const vw = video.videoWidth, vh = video.videoHeight;
  shotCanvas.width = vw;
  shotCanvas.height = vh;
  const ctx = shotCanvas.getContext('2d');

  // mirror front camera shots to match preview
  if(facingMode === 'user'){
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, vw, vh);

  // flash effect
  flashFx.classList.remove('fire');
  void flashFx.offsetWidth;
  flashFx.classList.add('fire');

  shotCanvas.toBlob(async (blob)=>{
    await saveMedia(blob, 'photo');
    showToast('Photo saved');
    refreshGalleryThumb();
  }, 'image/jpeg', 0.95);
}

// ===================== VIDEO RECORDING =====================
function startRecording(){
  if(!stream) return;
  recordedChunks = [];

  let mimeType = 'video/webm;codecs=vp9,opus';
  if(!MediaRecorder.isTypeSupported(mimeType)){
    mimeType = 'video/webm;codecs=vp8,opus';
  }
  if(!MediaRecorder.isTypeSupported(mimeType)){
    mimeType = 'video/webm';
  }
  if(!MediaRecorder.isTypeSupported(mimeType)){
    mimeType = '';
  }

  try{
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  }catch(e){
    showToast('Recording not supported');
    return;
  }

  mediaRecorder.ondataavailable = (e)=>{
    if(e.data && e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = async ()=>{
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
    await saveMedia(blob, 'video');
    showToast('Video saved');
    refreshGalleryThumb();
  };

  mediaRecorder.start();
  isRecording = true;
  shutter.classList.add('recording');
  recIndicator.classList.add('show');
  recordStartTime = Date.now();
  recTimerInterval = setInterval(updateRecTime, 250);
}

function stopRecording(){
  if(mediaRecorder && isRecording){
    mediaRecorder.stop();
  }
  isRecording = false;
  shutter.classList.remove('recording');
  recIndicator.classList.remove('show');
  clearInterval(recTimerInterval);
}

function updateRecTime(){
  const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
  const m = String(Math.floor(elapsed/60)).padStart(2,'0');
  const s = String(elapsed%60).padStart(2,'0');
  recTime.textContent = `${m}:${s}`;
}

// ===================== SHUTTER ACTION =====================
async function doCapture(){
  if(currentMode === 'photo'){
    capturePhoto();
  } else {
    if(isRecording){
      stopRecording();
    } else {
      startRecording();
    }
  }
}

shutter.addEventListener('click', async ()=>{
  if(currentMode === 'video' && isRecording){
    // stop immediately, ignore timer
    doCapture();
    return;
  }
  if(timerSeconds > 0){
    await runCountdown(timerSeconds);
  }
  doCapture();
});

function runCountdown(seconds){
  return new Promise(resolve=>{
    let n = seconds;
    countdown.classList.add('show');
    countdownNum.textContent = n;
    const iv = setInterval(()=>{
      n--;
      if(n <= 0){
        clearInterval(iv);
        countdown.classList.remove('show');
        resolve();
      } else {
        countdownNum.textContent = n;
        // restart css animation
        countdownNum.style.animation = 'none';
        void countdownNum.offsetWidth;
        countdownNum.style.animation = '';
      }
    }, 1000);
  });
}

// ===================== INDEXEDDB STORAGE =====================
const DB_NAME = 'lumacam';
const STORE_NAME = 'media';
let dbPromise = null;

function getDB(){
  if(dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      if(!db.objectStoreNames.contains(STORE_NAME)){
        const store = db.createObjectStore(STORE_NAME, { keyPath:'id', autoIncrement:true });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = (e)=> resolve(e.target.result);
    req.onerror = (e)=> reject(e.target.error);
  });
  return dbPromise;
}

async function saveMedia(blob, type){
  const db = await getDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = { blob, type, createdAt: Date.now() };
    const req = store.add(record);
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = (e)=> reject(e.target.error);
  });
}

async function getAllMedia(){
  const db = await getDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = ()=> resolve(req.result.sort((a,b)=> b.createdAt - a.createdAt));
    req.onerror = (e)=> reject(e.target.error);
  });
}

async function deleteMedia(id){
  const db = await getDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = ()=> resolve();
    req.onerror = (e)=> reject(e.target.error);
  });
}

// ===================== GALLERY UI =====================
async function refreshGalleryThumb(){
  const items = await getAllMedia();
  galleryThumb.innerHTML = '';
  if(items.length === 0){
    galleryThumb.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
    return;
  }
  const latest = items[0];
  const url = URL.createObjectURL(latest.blob);
  if(latest.type === 'photo'){
    galleryThumb.innerHTML = `<img src="${url}">`;
  } else {
    galleryThumb.innerHTML = `<video src="${url}" muted></video>`;
  }
}

async function openGallery(){
  const items = await getAllMedia();
  galleryGrid.innerHTML = '';
  if(items.length === 0){
    galleryEmpty.classList.remove('hidden');
    galleryGrid.classList.add('hidden');
  } else {
    galleryEmpty.classList.add('hidden');
    galleryGrid.classList.remove('hidden');
    items.forEach(item=>{
      const url = URL.createObjectURL(item.blob);
      const div = document.createElement('div');
      div.className = 'gallery-item';
      div.dataset.id = item.id;
      if(item.type === 'photo'){
        div.innerHTML = `<img src="${url}" loading="lazy">`;
      } else {
        div.innerHTML = `<video src="${url}" muted></video>
          <div class="badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>VIDEO</div>`;
      }
      div.addEventListener('click', ()=> openLightbox(item, url));
      galleryGrid.appendChild(div);
    });
  }
  galleryView.classList.add('open');
}

function openLightbox(item, url){
  currentLightboxId = item.id;
  lightboxContent.innerHTML = '';
  if(item.type === 'photo'){
    lightboxContent.innerHTML = `<img src="${url}">`;
  } else {
    lightboxContent.innerHTML = `<video src="${url}" controls autoplay playsinline></video>`;
  }
  lightbox.classList.add('open');
}

closeLightbox.addEventListener('click', ()=>{
  lightbox.classList.remove('open');
  lightboxContent.innerHTML = '';
});

deleteBtn.addEventListener('click', async ()=>{
  if(currentLightboxId == null) return;
  await deleteMedia(currentLightboxId);
  lightbox.classList.remove('open');
  lightboxContent.innerHTML = '';
  openGallery();
  refreshGalleryThumb();
});

galleryThumb.addEventListener('click', openGallery);
closeGallery.addEventListener('click', ()=> galleryView.classList.remove('open'));

// ===================== RETRY =====================
retryBtn.addEventListener('click', startCamera);

// ===================== INIT =====================
window.addEventListener('load', ()=>{
  startCamera();
  refreshGalleryThumb();

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
});

// pause camera when tab hidden (saves battery), resume when visible
document.addEventListener('visibilitychange', ()=>{
  if(document.hidden){
    if(stream) stream.getTracks().forEach(t=> t.enabled = false);
  } else {
    if(stream) stream.getTracks().forEach(t=> t.enabled = true);
  }
});
