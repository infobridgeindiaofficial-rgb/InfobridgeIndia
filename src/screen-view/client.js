import { currentSession } from '/supabase/client.js';

const $ = id => document.getElementById(id);
const admin = document.body.dataset.mode === 'admin';
const worker = String(globalThis.INFOBRIDGE_SCREEN_VIEW?.workerUrl || '').replace(/\/$/, '');
let active, socket, ended = false, reconnectTimer, blobURL, remoteWidth = 1024, remoteHeight = 720, resizing;
// Mirrors browser-worker LIMITS: the remote viewport and its device-pixel budget.
const LIMITS = { minWidth: 240, maxWidth: 1920, minHeight: 200, maxHeight: 1400, maxPixels: 2.2e6 };
let remoteScale = 1, sentSize = '', typingFocus = false, anchorY = 0, remoteURL = '';
// Like mobile browsers: show the site name in the bar, the full URL while editing.
const shortURL = url => { try { return new URL(url).hostname.replace(/^www\./, '') || url; } catch { return url; } };
const message = text => { $('message').textContent = text; };
const codeLabel = code => code?.match(/.{1,6}/g)?.join('-') || 'Participant joined';
function setStatus(text, state) {
  $('status').textContent = text;
  for (const dot of document.querySelectorAll('[data-conn]')) { dot.dataset.state = state; dot.title = text; }
}
async function api(path, method = 'GET', data, participantToken) {
  const token = participantToken || (admin ? (await currentSession())?.access_token : active?.token);
  const response = await fetch(worker + path, { method, cache: 'no-store', credentials: 'omit',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}
function action(fn) { return async event => { event?.preventDefault(); message(''); try { await fn(event); } catch (error) { message(error.message === 'Failed to fetch' ? 'Browser service unavailable. Check your connection or contact the admin.' : error.message); } }; }
function control(event) { if (!admin && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event)); }
function interactive(enabled) {
  for (const element of document.querySelectorAll('#control-bar button,#control-bar input,#keyboard-bar button,#keyboard-bar input')) {
    if (element.classList.contains('sv-fullscreen') || element.id === 'end') continue;
    element.disabled = !enabled || admin;
  }
}
// Rendering density requested for the remote browser: device DPR up to 2x, within a pixel budget.
function requestedScale() {
  let scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const area = (screen.width || innerWidth) * (screen.height || innerHeight);
  while (scale > 1 && area * scale * scale > LIMITS.maxPixels) scale -= 0.25;
  return Math.max(1, Math.floor(scale * 4) / 4);
}

// ---- Immersive layout: the connected viewer follows the visual viewport (software keyboard, zoom, rotation).
function syncVisualViewport() {
  const vv = window.visualViewport, root = document.documentElement.style;
  if (!vv || !document.body.classList.contains('sv-connected')) return;
  root.setProperty('--sv-top', `${vv.offsetTop}px`); root.setProperty('--sv-left', `${vv.offsetLeft}px`);
  root.setProperty('--sv-width', `${vv.width}px`); root.setProperty('--sv-height', `${vv.height}px`);
}
function connectedLayout(on) {
  document.body.classList.toggle('sv-connected', on);
  if (!on) {
    document.body.classList.remove('sv-immersive', 'sv-typing');
    for (const name of ['--sv-top', '--sv-left', '--sv-width', '--sv-height']) document.documentElement.style.removeProperty(name);
  } else syncVisualViewport();
}
window.visualViewport?.addEventListener('resize', syncVisualViewport);
window.visualViewport?.addEventListener('scroll', syncVisualViewport);

// ---- Remote viewport sync: the remote CSS viewport matches the visible browser area, so frames are never stretched.
function resize(now = false) {
  clearTimeout(resizing);
  const run = () => {
    // While typing, the software keyboard shrinks the area; keep the remote layout stable instead of reflowing the page.
    if (admin || typingFocus || !document.body.classList.contains('sv-connected')) return;
    const box = $('viewport').getBoundingClientRect();
    let width = Math.round(box.width), height = Math.round(box.height);
    if (width < 50 || height < 50) return;
    const over = Math.sqrt(width * height * remoteScale * remoteScale / (LIMITS.maxPixels * 1.3));
    if (over > 1) { width = Math.floor(width / over); height = Math.floor(height / over); }
    width = Math.max(LIMITS.minWidth, Math.min(LIMITS.maxWidth, width));
    height = Math.max(LIMITS.minHeight, Math.min(LIMITS.maxHeight, height));
    if (`${width}x${height}` === sentSize) return;
    sentSize = `${width}x${height}`; control({ type: 'resize', width, height });
  };
  if (now) run(); else resizing = setTimeout(run, 120);
}

// ---- Frame display: decode off-screen, keep only the newest pending frame, never queue stale frames.
let pendingFrame = null, decoding = false;
function present(blob) { pendingFrame = blob; if (!decoding) showNext(); }
function showNext() {
  const blob = pendingFrame; pendingFrame = null;
  if (!blob) return;
  decoding = true;
  const url = URL.createObjectURL(blob), image = new Image(); image.src = url;
  image.decode().then(() => {
    if (ended && !active) { URL.revokeObjectURL(url); return; }
    const frame = $('frame'), changed = frame.naturalWidth !== image.naturalWidth || frame.naturalHeight !== image.naturalHeight;
    frame.src = url; if (blobURL) URL.revokeObjectURL(blobURL); blobURL = url;
    $('waiting').hidden = true;
    if (changed || !frame.style.width) layoutFrame(image.naturalWidth, image.naturalHeight);
  }, () => URL.revokeObjectURL(url)).finally(() => { decoding = false; if (pendingFrame) showNext(); });
}
// Places the image explicitly (no object-fit) so its box is exactly the remote page; input mapping uses that box.
function layoutFrame(naturalWidth = $('frame').naturalWidth, naturalHeight = $('frame').naturalHeight) {
  const frame = $('frame'), box = $('viewport');
  if (!naturalWidth || !naturalHeight) return;
  const cw = box.clientWidth, ch = box.clientHeight, aspect = naturalWidth / naturalHeight;
  let width, height, left, top;
  if (typingFocus && !admin) {
    // Keyboard open: keep full width and slide the last tapped point into view, like a real browser.
    width = cw; height = cw / aspect; left = 0;
    top = Math.min(0, Math.max(ch - height, ch * 0.35 - anchorY * height));
  } else {
    const scale = Math.min(cw / naturalWidth, ch / naturalHeight);
    width = naturalWidth * scale; height = naturalHeight * scale;
    left = (cw - width) / 2; top = admin ? (ch - height) / 2 : 0;
  }
  Object.assign(frame.style, { width: `${width}px`, height: `${height}px`, left: `${left}px`, top: `${top}px` });
}
new ResizeObserver(() => { layoutFrame(); resize(); }).observe($('viewport'));

function reset(reason) {
  ended = true; clearTimeout(reconnectTimer); socket?.close(); active = null;
  sessionStorage.removeItem('screen-view-participant');
  if (blobURL) URL.revokeObjectURL(blobURL); blobURL = null; pendingFrame = null; $('frame').removeAttribute('src');
  $('frame').removeAttribute('style'); sentSize = '';
  closeKeyboard(); exitFullscreen(); connectedLayout(false);
  $('viewer').hidden = true; $('lobby').hidden = false; setStatus('Session ended', 'ended');
  $('typing').value = ''; message(reason || 'Session ended. Temporary browser state has been cleared.');
  if (admin) list().catch(() => {});
}
async function connect() {
  if (!active || ended) return;
  const { ticket } = await api(`/api/sessions/${active.id}/ticket`, 'POST');
  const ws = socket = new WebSocket(worker.replace(/^http/, 'ws') + '/stream');
  ws.binaryType = 'blob';
  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', ticket }));
  ws.onmessage = event => {
    if (ws !== socket) return;
    if (event.data instanceof Blob) { present(event.data); return; }
    const data = JSON.parse(event.data);
    if (data.type === 'ready') { setStatus('Connected', 'connected'); interactive(true); message(''); sentSize = ''; resize(true); }
    if (data.type === 'state') {
      remoteURL = data.url || '';
      if (document.activeElement !== $('address')) $('address').value = shortURL(remoteURL);
      remoteWidth = data.width; remoteHeight = data.height; remoteScale = data.scale || 1;
      if (data.notice) message(data.notice);
      const tabs = data.tabs || [];
      $('tabs').hidden = tabs.length < 2;
      $('tabs').replaceChildren(...tabs.map(tab => {
        const button = document.createElement('button'); button.textContent = tab.label; button.disabled = admin;
        button.setAttribute('aria-pressed', String(tab.active)); button.onclick = () => control({ type: 'tab', id: tab.id }); return button;
      }));
    }
    if (data.type === 'presence') $('presence').textContent = data.participant ? 'Participant connected' : 'Participant disconnected';
    if (data.type === 'error') message(data.message);
    if (data.type === 'ended') reset(data.reason === 'expired' ? 'Session expired. Ask the admin for a new Session ID.' : undefined);
  };
  ws.onclose = event => {
    if (ended || ws !== socket) return;
    setStatus('Disconnected', 'disconnected');
    interactive(false);
    if (event.code === 1008) { message('Connection denied or already active in another tab. Close the other tab and reload to reconnect.'); return; }
    reconnectTimer = setTimeout(() => connect().catch(error => { message(error.message); setStatus('Reconnect failed — reload to retry', 'disconnected'); }), 1500);
  };
  ws.onerror = () => message('Live connection interrupted. Reconnecting…');
}
async function view(session) {
  ended = false; active = session; const previous = socket; socket = null; previous?.close(); clearTimeout(reconnectTimer);
  $('lobby').hidden = true; $('viewer').hidden = false; message('');
  $('session-label').textContent = session.code ? codeLabel(session.code) : `Session ${session.id.slice(0, 8)}`;
  $('permission').textContent = admin ? 'VIEW ONLY' : 'VIEW + CONTROL';
  $('control-bar').hidden = admin; $('keyboard-bar').hidden = true;
  connectedLayout(true);
  setStatus('Connecting…', 'connecting'); interactive(false); await connect();
}
async function list() {
  const { sessions } = await api('/api/sessions'); $('login').hidden = true;
  $('sessions').replaceChildren();
  if (!sessions.length) { $('sessions').textContent = 'No active sessions.'; return; }
  for (const session of sessions) {
    const card = document.createElement('article'); card.className = 'sv-card';
    const title = document.createElement('strong'); title.textContent = codeLabel(session.code);
    const details = document.createElement('p');
    details.textContent = `Participant: ${session.participant ? 'Connected' : 'Disconnected'} · Browser: ${session.browser} · Duration: ${Math.floor((Date.now() - session.createdAt) / 60000)} min`;
    const actions = document.createElement('div'); actions.className = 'sv-actions';
    const open = document.createElement('button'); open.textContent = 'View Browser'; open.onclick = action(() => view(session));
    const end = document.createElement('button'); end.className = 'danger'; end.textContent = 'End Session';
    end.onclick = action(async () => { await api(`/api/sessions/${session.id}`, 'DELETE'); await list(); });
    actions.append(open, end); card.append(title, details, actions); $('sessions').append(card);
  }
}
if (admin) {
  $('create').onclick = action(async () => {
    $('create').disabled = true;
    try { await api('/api/sessions', 'POST'); await list(); } finally { $('create').disabled = false; }
  });
  $('reload').onclick = action(list);
  list().catch(error => message(error.message));
  setInterval(() => { if (!active && !document.hidden) list().catch(() => {}); }, 15000);
} else {
  $('join').onsubmit = action(async () => {
    const button = $('join').querySelector('button'); button.disabled = true;
    try {
      const result = await api('/api/join', 'POST', { code: $('code').value, scale: requestedScale() });
      const session = { id: result.id, token: result.token };
      sessionStorage.setItem('screen-view-participant', JSON.stringify(session)); await view(session);
    } finally { button.disabled = false; }
  });
  try {
    const saved = JSON.parse(sessionStorage.getItem('screen-view-participant') || 'null');
    if (saved?.token && saved?.id) view(saved).catch(error => reset(error.message));
  } catch { sessionStorage.removeItem('screen-view-participant'); }
}
$('end').onclick = action(async () => {
  if (!active) return;
  if (!admin && !confirm('End this session? The remote browser and its sign-ins will be cleared.')) return;
  await api(`/api/sessions/${active.id}`, 'DELETE'); reset();
});
$('navigate').onsubmit = event => { event.preventDefault(); control({ type: 'navigate', value: $('address').value }); document.activeElement?.blur(); };
for (const button of document.querySelectorAll('[data-command]')) button.onclick = () => control({ type: button.dataset.command });
for (const button of document.querySelectorAll('[data-key]')) button.onclick = () => { control({ type: 'key', value: button.dataset.key }); $('typing').focus(); };

// ---- Software keyboard (touch devices): a dedicated input forwards text to the focused remote field.
function setTyping(on) {
  if (typingFocus === on) return;
  typingFocus = on; document.body.classList.toggle('sv-typing', on);
  layoutFrame(); if (!on) resize();
}
function openKeyboard() {
  if (admin) return;
  $('keyboard-bar').hidden = false; $('keyboard-toggle').setAttribute('aria-expanded', 'true');
  $('typing').focus({ preventScroll: true }); // synchronous with the tap so iOS shows its keyboard
}
function closeKeyboard() {
  $('keyboard-bar').hidden = true; $('keyboard-toggle').setAttribute('aria-expanded', 'false');
  $('typing').blur(); setTyping(false);
}
$('keyboard-toggle').onclick = () => ($('keyboard-bar').hidden ? openKeyboard() : closeKeyboard());
$('keyboard-close').onclick = closeKeyboard;
$('typing').addEventListener('focus', () => setTyping(true));
$('typing').addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== $('typing')) setTyping(false); }, 150));
$('address').addEventListener('focus', () => { $('address').value = remoteURL; $('address').select(); });
$('address').addEventListener('blur', () => { if ($('address').value === remoteURL) $('address').value = shortURL(remoteURL); resize(); });
// Keep focus in the field while pressing Go (Safari does not focus buttons), so Go stays visible and the typed text is kept.
$('navigate').querySelector('.sv-go').addEventListener('mousedown', event => event.preventDefault());
let composing = false;
function textInput() { if (!composing && $('typing').value) { control({ type: 'text', value: $('typing').value }); $('typing').value = ''; } }
$('typing').addEventListener('compositionstart', () => { composing = true; });
$('typing').addEventListener('compositionend', () => { composing = false; textInput(); });
$('typing').addEventListener('input', textInput);
$('typing').addEventListener('beforeinput', event => {
  if (event.inputType === 'deleteContentBackward' && !$('typing').value) { event.preventDefault(); control({ type: 'key', value: 'Backspace' }); }
});
$('typing').addEventListener('keydown', event => {
  if (['Enter', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Delete'].includes(event.key)) {
    event.preventDefault(); control({ type: 'key', value: event.key === 'Tab' && event.shiftKey ? 'Shift+Tab' : event.key });
  }
});

// ---- Full screen: Fullscreen API where available (desktop, Android, iPad); immersive CSS fallback (iPhone Safari).
const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
const fullscreenAPI = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
function exitFullscreen() {
  document.body.classList.remove('sv-immersive'); $('immersive-exit').hidden = true;
  if (fullscreenElement()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
}
function toggleFullscreen() {
  if (fullscreenElement() || document.body.classList.contains('sv-immersive')) { exitFullscreen(); return; }
  const root = document.documentElement;
  if (fullscreenAPI()) {
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    Promise.resolve(request.call(root, { navigationUI: 'hide' })).catch(immersive);
  } else immersive();
}
function immersive() { document.body.classList.add('sv-immersive'); $('immersive-exit').hidden = false; }
for (const button of document.querySelectorAll('.sv-fullscreen')) button.onclick = toggleFullscreen;
$('immersive-exit').onclick = exitFullscreen;
for (const name of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(name, () => {
  for (const button of document.querySelectorAll('.sv-fullscreen')) button.setAttribute('aria-pressed', String(!!fullscreenElement()));
});

// ---- Pointer, touch and wheel input. Scroll deltas are coalesced (~30/s) so input never floods the worker.
const viewport = $('viewport');
const point = event => { const rect = $('frame').getBoundingClientRect(); return {
  x: Math.max(0, Math.min(remoteWidth, (event.clientX - rect.left) * remoteWidth / rect.width)),
  y: Math.max(0, Math.min(remoteHeight, (event.clientY - rect.top) * remoteHeight / rect.height)) }; };
const toRemote = () => remoteHeight / ($('frame').getBoundingClientRect().height || remoteHeight);
let gesture, scrollAccumulated = null, scrollTimer, momentum;
function queueScroll(at, dx, dy) {
  if (!scrollAccumulated) scrollAccumulated = { ...at, dx: 0, dy: 0 };
  Object.assign(scrollAccumulated, at);
  scrollAccumulated.dx += dx; scrollAccumulated.dy += dy;
  // Leading edge: the first tick goes out at once; ticks within the next 33 ms are merged.
  if (!scrollTimer) { flushScroll(); scrollTimer = setTimeout(scrollWindow, 33); }
}
function scrollWindow() {
  scrollTimer = null;
  if (scrollAccumulated) { flushScroll(); scrollTimer = setTimeout(scrollWindow, 33); }
}
function flushScroll() {
  const s = scrollAccumulated; scrollAccumulated = null;
  if (!s || (!Math.round(s.dx) && !Math.round(s.dy))) return;
  const clamp = n => Math.max(-2000, Math.min(2000, Math.round(n)));
  control({ type: 'scroll', x: s.x, y: s.y, dx: clamp(s.dx), dy: clamp(s.dy) });
}
function stopMomentum() { cancelAnimationFrame(momentum?.frame); momentum = null; }
viewport.addEventListener('pointerdown', event => {
  if (admin || !$('frame').hasAttribute('src')) return;
  stopMomentum();
  if (event.pointerType === 'mouse') viewport.focus({ preventScroll: true });
  gesture = { ...point(event), clientX: event.clientX, clientY: event.clientY, startX: event.clientX, startY: event.clientY,
    moved: false, pointer: event.pointerId, samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }] };
  viewport.setPointerCapture(event.pointerId);
});
viewport.addEventListener('pointermove', event => {
  if (!gesture || gesture.pointer !== event.pointerId) return;
  if (!gesture.moved && Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) < 6) return;
  gesture.moved = true;
  const factor = toRemote();
  queueScroll(point(event), (gesture.clientX - event.clientX) * factor, (gesture.clientY - event.clientY) * factor);
  gesture.clientX = event.clientX; gesture.clientY = event.clientY;
  gesture.samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY });
  if (gesture.samples.length > 6) gesture.samples.shift();
});
viewport.addEventListener('pointerup', event => {
  if (!gesture || gesture.pointer !== event.pointerId) return;
  const g = gesture; gesture = null;
  if (!g.moved) {
    const at = point(event); anchorY = at.y / remoteHeight;
    control({ type: 'click', ...at }); return;
  }
  // Touch flicks continue with decaying momentum, like native scrolling.
  const first = g.samples[0], last = g.samples.at(-1), dt = last.t - first.t;
  if (event.pointerType !== 'touch' || dt <= 0 || event.timeStamp - last.t > 80) return;
  let vx = (first.x - last.x) / dt, vy = (first.y - last.y) / dt;
  if (Math.hypot(vx, vy) < 0.3) return;
  const at = point(event), factor = toRemote();
  let previous = performance.now();
  const step = now => {
    const elapsed = now - previous; previous = now;
    queueScroll(at, vx * elapsed * factor, vy * elapsed * factor);
    const decay = Math.pow(0.95, elapsed / 16); vx *= decay; vy *= decay;
    if (Math.hypot(vx, vy) > 0.05) momentum.frame = requestAnimationFrame(step); else momentum = null;
  };
  momentum = { frame: requestAnimationFrame(step) };
});
viewport.addEventListener('pointercancel', () => { gesture = null; });
viewport.addEventListener('wheel', event => {
  if (admin) return; event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? remoteHeight : 1;
  queueScroll(point(event), event.deltaX * unit, event.deltaY * unit);
}, { passive: false });

// ---- Physical keyboard (laptops/iPad keyboards): typing goes straight to the remote page while it has focus.
const KEYS = new Set(['Enter', 'Tab', 'Backspace', 'Delete', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
let typed = '';
const flushTyped = () => { if (typed) { control({ type: 'text', value: typed }); typed = ''; } };
viewport.addEventListener('keydown', event => {
  if (admin || event.isComposing || event.altKey) return;
  if ((event.ctrlKey || event.metaKey)) {
    if (event.key.toLowerCase() === 'a') { event.preventDefault(); flushTyped(); control({ type: 'key', value: 'ControlOrMeta+A' }); }
    return; // leave copy/paste/browser shortcuts alone
  }
  if (event.key.length === 1) { event.preventDefault(); if (!typed) queueMicrotask(flushTyped); typed += event.key; return; }
  if (KEYS.has(event.key)) { event.preventDefault(); flushTyped(); control({ type: 'key', value: event.key === 'Tab' && event.shiftKey ? 'Shift+Tab' : event.key }); }
});
viewport.addEventListener('paste', event => {
  if (admin) return;
  const text = event.clipboardData?.getData('text/plain');
  if (text) { event.preventDefault(); flushTyped(); control({ type: 'text', value: text.slice(0, 2000) }); }
});

window.addEventListener('pagehide', () => { ended = true; clearTimeout(reconnectTimer); socket?.close(); });
window.addEventListener('pageshow', event => { if (event.persisted && active) { ended = false; connect().catch(error => message(error.message)); } });
