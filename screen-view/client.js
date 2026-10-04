import { currentSession } from '/supabase/client.js';

const $ = id => document.getElementById(id);
const admin = document.body.dataset.mode === 'admin';
const worker = String(globalThis.INFOBRIDGE_SCREEN_VIEW?.workerUrl || '').replace(/\/$/, '');
let active, socket, ended = false, reconnectTimer, blobURL, remoteWidth = 1024, remoteHeight = 720, resizing;
const message = text => { $('message').textContent = text; };
const codeLabel = code => code?.match(/.{1,6}/g)?.join('-') || 'Participant joined';
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
  for (const element of document.querySelectorAll('#control-bar button,#control-bar input,#keyboard-bar button,#keyboard-bar input')) element.disabled = !enabled || admin;
}
function resize() {
  clearTimeout(resizing); resizing = setTimeout(() => {
    const width = Math.max(320, Math.min(1440, Math.round($('viewport').clientWidth)));
    const height = Math.max(400, Math.min(1080, Math.round(window.innerHeight * .7)));
    control({ type: 'resize', width, height });
  }, 350);
}
function reset(reason) {
  ended = true; clearTimeout(reconnectTimer); socket?.close(); active = null;
  sessionStorage.removeItem('screen-view-participant');
  if (blobURL) URL.revokeObjectURL(blobURL); blobURL = null; $('frame').removeAttribute('src');
  $('viewer').hidden = true; $('lobby').hidden = false; $('status').textContent = 'Session ended';
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
    if (event.data instanceof Blob) {
      if (blobURL) URL.revokeObjectURL(blobURL);
      blobURL = URL.createObjectURL(event.data); $('frame').src = blobURL; $('waiting').hidden = true; return;
    }
    const data = JSON.parse(event.data);
    if (data.type === 'ready') { $('status').textContent = 'Connected ●'; interactive(true); message(''); resize(); }
    if (data.type === 'state') {
      if (document.activeElement !== $('address')) $('address').value = data.url || '';
      remoteWidth = data.width; remoteHeight = data.height;
      if (data.notice) message(data.notice);
      $('tabs').replaceChildren(...(data.tabs || []).map(tab => {
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
    $('status').textContent = 'Disconnected';
    interactive(false);
    if (event.code === 1008) { message('Connection denied or already active in another tab. Close the other tab and reload to reconnect.'); return; }
    reconnectTimer = setTimeout(() => connect().catch(error => { message(error.message); $('status').textContent = 'Reconnect failed — reload to retry'; }), 1500);
  };
  ws.onerror = () => message('Live connection interrupted. Reconnecting…');
}
async function view(session) {
  ended = false; active = session; const previous = socket; socket = null; previous?.close(); clearTimeout(reconnectTimer);
  $('lobby').hidden = true; $('viewer').hidden = false;
  $('session-label').textContent = session.code ? codeLabel(session.code) : 'Shared remote browser';
  $('permission').textContent = admin ? 'VIEW ONLY' : 'VIEW + CONTROL';
  $('control-bar').hidden = admin; $('keyboard-bar').hidden = admin;
  $('status').textContent = 'Connecting…'; interactive(false); await connect();
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
      const result = await api('/api/join', 'POST', { code: $('code').value });
      const session = { id: result.id, token: result.token };
      sessionStorage.setItem('screen-view-participant', JSON.stringify(session)); await view(session);
    } finally { button.disabled = false; }
  });
  try {
    const saved = JSON.parse(sessionStorage.getItem('screen-view-participant') || 'null');
    if (saved?.token && saved?.id) view(saved).catch(error => reset(error.message));
  } catch { sessionStorage.removeItem('screen-view-participant'); }
}
$('end').onclick = action(async () => { await api(`/api/sessions/${active.id}`, 'DELETE'); reset(); });
$('navigate').onsubmit = event => { event.preventDefault(); control({ type: 'navigate', value: $('address').value }); $('address').blur(); };
for (const button of document.querySelectorAll('[data-command]')) button.onclick = () => control({ type: button.dataset.command });
for (const button of document.querySelectorAll('[data-key]')) button.onclick = () => { control({ type: 'key', value: button.dataset.key }); $('typing').focus(); };
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
const viewport = $('viewport');
const point = event => { const rect = $('frame').getBoundingClientRect(); return {
  x: Math.max(0, Math.min(remoteWidth, (event.clientX - rect.left) * remoteWidth / rect.width)),
  y: Math.max(0, Math.min(remoteHeight, (event.clientY - rect.top) * remoteHeight / rect.height)) }; };
let gesture;
viewport.addEventListener('pointerdown', event => {
  if (admin || !$('frame').hasAttribute('src')) return;
  gesture = { ...point(event), clientY: event.clientY, moved: false, pointer: event.pointerId };
  viewport.setPointerCapture(event.pointerId);
});
viewport.addEventListener('pointermove', event => {
  if (!gesture || gesture.pointer !== event.pointerId) return;
  const dy = gesture.clientY - event.clientY;
  if (Math.abs(dy) > 4) { gesture.moved = true; control({ type: 'scroll', ...point(event), dx: 0,
    dy: Math.max(-2000, Math.min(2000, dy * remoteHeight / $('frame').clientHeight)) }); gesture.clientY = event.clientY; }
});
viewport.addEventListener('pointerup', event => { if (gesture && !gesture.moved) control({ type: 'click', ...point(event) }); gesture = null; });
viewport.addEventListener('pointercancel', () => { gesture = null; });
viewport.addEventListener('wheel', event => {
  if (admin) return; event.preventDefault(); control({ type: 'scroll', ...point(event), dx: Math.max(-2000, Math.min(2000, event.deltaX)), dy: Math.max(-2000, Math.min(2000, event.deltaY)) });
}, { passive: false });
window.addEventListener('resize', resize);
window.addEventListener('pagehide', () => { ended = true; clearTimeout(reconnectTimer); socket?.close(); });
window.addEventListener('pageshow', event => { if (event.persisted && active) { ended = false; connect().catch(error => message(error.message)); } });
