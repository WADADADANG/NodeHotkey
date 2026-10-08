// NodeHotkey PiP (Picture-in-Picture) Screen Controller — v3.2 redesign
//
// View model:
//   view = 'all'  -> grid of every running screen
//   view = '1'..'8' -> that single screen
// Feeds are polled frame-by-frame from /api/client-frame/:id (no long-lived MJPEG
// connections), so switching views never leaks connections and a screen that comes
// online later starts showing automatically.
(function () {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  let windowKey = urlParams.get('client') || 'master';
  const STORAGE_PREFIX = `nh.pip.${windowKey}.`;

  let serverPort = 3088;
  let activeClients = [];
  let clientAliases = {};
  try {
    const cachedAliases = localStorage.getItem('nh.pip.clientAliases');
    if (cachedAliases) clientAliases = JSON.parse(cachedAliases);
  } catch (e) {}

  let view = loadPref('view', isClientId(windowKey) ? windowKey : 'all');
  let opacity = parseFloat(loadPref('opacity', '1')) || 1;
  let isBubble = false;
  let lastLayoutKey = '';

  const tiles = new Map(); // clientId -> FeedTile

  // DOM
  const root = document.getElementById('pip-root');
  const titleText = document.getElementById('pip-title-text');
  const statusDot = document.getElementById('pip-status-dot');
  const tabsBar = document.getElementById('pip-tabs');
  const grid = document.getElementById('pip-grid');
  const emptyState = document.getElementById('pip-empty');
  const bubble = document.getElementById('pip-bubble');
  const bubbleLabel = document.getElementById('pip-bubble-label');
  const btnOpacity = document.getElementById('btn-opacity');
  const opacityValue = document.getElementById('pip-opacity-value');
  const opacityPopover = document.getElementById('pip-opacity-popover');
  const opacityOptions = document.getElementById('pip-opacity-options');
  const btnMinimize = document.getElementById('btn-minimize');
  const btnClose = document.getElementById('btn-close');

  document.addEventListener('dragstart', (e) => e.preventDefault());

  // ---------- Helpers ----------
  function isClientId(v) { return /^[1-9]\d*$/.test(String(v)); }
  function serverUrl(p) { return `http://localhost:${serverPort}${p}`; }
  function loadPref(k, def) {
    try { const v = localStorage.getItem(STORAGE_PREFIX + k); return v === null ? def : v; } catch (e) { return def; }
  }
  function savePref(k, v) {
    try { localStorage.setItem(STORAGE_PREFIX + k, String(v)); } catch (e) {}
  }
  function api() { return window.launcherAPI || {}; }

  function getClientName(id) {
    if (!id || id === 'null' || id === 'undefined') return 'PiP';
    const sId = String(id);
    const alias = clientAliases[sId] || clientAliases[parseInt(sId, 10)];
    if (alias && typeof alias === 'string' && alias.trim()) {
      return alias.trim();
    }
    return `จอ ${sId}`;
  }

  // Which screens are actually shown right now
  function getEffectiveView() {
    if (activeClients.length === 0) return null;
    if (view === 'all') return activeClients.length === 1 ? activeClients[0] : 'all';
    return activeClients.includes(view) ? view : activeClients[0];
  }

  function getTargets(eff) {
    if (!eff) return [];
    return eff === 'all' ? activeClients.slice() : [eff];
  }

  function getLayout(n) {
    const cols = n <= 1 ? 1 : (n <= 4 ? 2 : (n <= 9 ? 3 : 4));
    const rows = Math.max(1, Math.ceil(n / cols));
    return { cols, rows };
  }

  // ---------- Feed tile (frame poller) ----------
  class FeedTile {
    constructor(clientId) {
      this.id = clientId;
      this.running = false;
      this.timer = null;
      this.abort = null;
      this.objectUrl = null;
      this.failures = 0;
      this.isLive = false;

      this.el = document.createElement('div');
      this.el.className = 'pip-tile';
      this.el.dataset.client = clientId;

      this.img = document.createElement('img');
      this.img.alt = '';
      this.img.draggable = false;

      const label = document.createElement('div');
      label.className = 'pip-tile-label';
      label.textContent = getClientName(clientId);
      this.labelEl = label;

      this.state = document.createElement('div');
      this.state.className = 'pip-tile-state';
      this.state.innerHTML = '<div class="pip-spinner"></div><div class="pip-tile-state-text"></div>';
      this.stateText = this.state.querySelector('.pip-tile-state-text');

      this.hint = document.createElement('div');
      this.hint.className = 'pip-tile-hint';

      this.el.append(this.img, label, this.state, this.hint);
      this.setState('connecting');

      this.el.addEventListener('click', () => {
        if (getEffectiveView() === 'all') setView(this.id);
      });
      this.el.addEventListener('dblclick', () => {
        if (api().focusGameClient) api().focusGameClient(this.id);
      });
    }

    setHint(text) { this.hint.textContent = text; }

    updateName() {
      if (this.labelEl) this.labelEl.textContent = getClientName(this.id);
    }

    setState(state) {
      this.el.classList.toggle('live', state === 'live');
      this.el.classList.toggle('offline', state === 'offline');
      this.isLive = state === 'live';
      if (state === 'connecting') this.stateText.textContent = `กำลังเชื่อมต่อ ${getClientName(this.id)}...`;
      if (state === 'offline') this.stateText.textContent = `${getClientName(this.id)} ยังไม่พร้อม — รอสักครู่`;
      updateHeader();
    }

    setInterval(ms) { this.interval = ms; }

    start() {
      if (this.running) return;
      this.running = true;
      this.tick();
    }

    stop() {
      this.running = false;
      clearTimeout(this.timer);
      this.timer = null;
      if (this.abort) { this.abort.abort(); this.abort = null; }
    }

    destroy() {
      this.stop();
      this.img.removeAttribute('src');
      if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
      this.el.remove();
    }

    async tick() {
      if (!this.running) return;
      const started = performance.now();
      let nextDelay = this.interval || 150;

      const ctrl = new AbortController();
      this.abort = ctrl;
      const killer = setTimeout(() => ctrl.abort(), 4000); // stall watchdog

      try {
        const res = await fetch(serverUrl(`/api/client-frame/${this.id}?t=${Date.now()}`), {
          cache: 'no-store',
          signal: ctrl.signal
        });
        if (res.ok) {
          const blob = await res.blob();
          if (!this.running) return;
          await this.showBlob(blob);
          this.failures = 0;
          if (!this.isLive) this.setState('live');
        } else {
          this.failures++;
          nextDelay = 1000;
          if (this.failures >= 2 || res.status === 404) this.setState('offline');
        }
      } catch (e) {
        if (!this.running) return;
        this.failures++;
        nextDelay = 1000;
        if (this.failures >= 3) this.setState(this.failures >= 6 ? 'offline' : 'connecting');
      } finally {
        clearTimeout(killer);
        if (this.abort === ctrl) this.abort = null;
      }

      if (!this.running) return;
      const elapsed = performance.now() - started;
      this.timer = setTimeout(() => this.tick(), Math.max(0, nextDelay - elapsed));
    }

    showBlob(blob) {
      return new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const prev = this.objectUrl;
        this.img.onload = () => {
          if (prev) URL.revokeObjectURL(prev);
          resolve();
        };
        this.img.onerror = () => {
          URL.revokeObjectURL(url);
          if (this.objectUrl === url) this.objectUrl = prev;
          resolve();
        };
        this.objectUrl = url;
        this.img.src = url;
      });
    }
  }

  // ---------- Rendering ----------
  function render(forceResize) {
    const eff = getEffectiveView();
    const targets = isBubble ? [] : getTargets(eff);

    // Remove tiles that are no longer shown (fully stops their polling)
    for (const [id, tile] of tiles) {
      if (!targets.includes(id)) {
        tile.destroy();
        tiles.delete(id);
      }
    }

    // Create / order tiles
    const isGrid = targets.length > 1;
    const interval = !isGrid ? 120 : (targets.length <= 4 ? 200 : 320);
    const hint = isGrid ? 'คลิก = ดูจอนี้จอเดียว · ดับเบิลคลิก = ไปที่หน้าเกม' : 'ดับเบิลคลิก = ไปที่หน้าเกม';
    targets.forEach((id) => {
      let tile = tiles.get(id);
      if (!tile) {
        tile = new FeedTile(id);
        tiles.set(id, tile);
      }
      tile.setInterval(interval);
      tile.setHint(hint);
      grid.appendChild(tile.el); // appendChild moves existing nodes -> keeps order
      if (!document.hidden) tile.start();
    });

    const { cols, rows } = getLayout(targets.length);
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
    grid.classList.toggle('single', targets.length === 1);
    emptyState.hidden = isBubble || activeClients.length > 0;

    renderTabs(eff);
    updateHeader();

    // Auto-size the window when the layout shape changes
    if (!isBubble) {
      const layoutKey = `${cols}x${rows}`;
      if (forceResize || layoutKey !== lastLayoutKey) {
        lastLayoutKey = layoutKey;
        resizeForLayout(targets.length, cols, rows);
      }
    }
  }

  function renderTabs(eff) {
    tabsBar.innerHTML = '';

    if (activeClients.length === 0) {
      const hint = document.createElement('span');
      hint.className = 'pip-tabs-hint';
      hint.textContent = 'รอจอเกมเปิดทำงาน...';
      tabsBar.appendChild(hint);
      return;
    }

    if (activeClients.length >= 2) {
      tabsBar.appendChild(makeTab('all', `ทั้งหมด (${activeClients.length})`, eff === 'all', true));
    }
    activeClients.forEach((id) => {
      tabsBar.appendChild(makeTab(id, getClientName(id), eff === id, false));
    });
  }

  function makeTab(value, text, selected, isAll) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pip-tab' + (isAll ? ' all-tab' : '') + (selected ? ' selected' : '');
    b.title = isAll ? 'ดูทุกจอพร้อมกัน' : `ดูเฉพาะ${text}`;
    if (!isAll) {
      b.dataset.client = value;
      const dot = document.createElement('span');
      const tile = tiles.get(value);
      dot.className = 'tab-dot' + (tile && tile.isLive ? ' live' : '');
      b.appendChild(dot);
    }
    b.appendChild(document.createTextNode(text));
    b.addEventListener('click', () => setView(value));
    return b;
  }

  function updateHeader() {
    const eff = getEffectiveView();
    let text = 'จอลอย PiP';
    if (eff === 'all') text = `ทุกจอ (${activeClients.length})`;
    else if (eff) text = getClientName(eff);
    titleText.textContent = text;
    bubbleLabel.textContent = eff === 'all' ? 'ALL' : (eff ? getClientName(eff) : 'PiP');

    let anyLive = false;
    tiles.forEach((t) => { if (t.isLive) anyLive = true; });
    statusDot.classList.toggle('live', anyLive);

    // keep tab dots in sync without re-rendering tabs
    tabsBar.querySelectorAll('.pip-tab[data-client]').forEach((tab) => {
      const dot = tab.querySelector('.tab-dot');
      if (!dot) return;
      const tile = tiles.get(tab.dataset.client);
      dot.classList.toggle('live', !!(tile && tile.isLive));
    });
  }

  function resizeForLayout(n, cols, rows) {
    if (!api().resizePiP) return;
    const CHROME_H = 30 + 30 + 2; // title bar + tabs + border
    const GAP = 3;
    let tileW;
    if (n <= 1) tileW = 340;
    else if (n <= 4) tileW = 240;
    else if (n <= 9) tileW = 200;
    else tileW = 170;
    const tileH = Math.round(tileW * 9 / 16);
    const w = cols * tileW + GAP * (cols + 1) + 2;
    const h = CHROME_H + rows * tileH + GAP * (rows + 1);
    api().resizePiP(windowKey, w, h);
  }

  function setView(next) {
    view = String(next);
    savePref('view', view);
    render(true);
  }

  function setClientAliases(newAliases) {
    if (!newAliases || typeof newAliases !== 'object') return;
    const oldStr = JSON.stringify(clientAliases);
    const newStr = JSON.stringify(newAliases);
    if (oldStr === newStr) return;
    clientAliases = Object.assign({}, newAliases);
    try { localStorage.setItem('nh.pip.clientAliases', JSON.stringify(clientAliases)); } catch (e) {}
    tiles.forEach((t) => t.updateName());
    const eff = getEffectiveView();
    renderTabs(eff);
    updateHeader();
  }

  function setActiveClients(list) {
    const next = (list || []).map(String).filter(isClientId).sort((a, b) => a - b);
    if (next.join(',') === activeClients.join(',')) return;
    activeClients = next;
    render(false);
  }

  // ---------- Opacity ----------
  function applyOpacity(op) {
    opacity = op;
    root.style.opacity = String(op);
    opacityValue.textContent = `${Math.round(op * 100)}%`;
    opacityOptions.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('selected', Math.abs(parseFloat(b.dataset.op) - op) < 0.01);
    });
    savePref('opacity', op);
  }

  function toggleOpacityPopover(force) {
    const show = force !== undefined ? force : opacityPopover.hidden;
    opacityPopover.hidden = !show;
    btnOpacity.classList.toggle('open', show);
  }

  btnOpacity.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleOpacityPopover();
  });
  opacityOptions.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-op]');
    if (!b) return;
    applyOpacity(parseFloat(b.dataset.op));
    toggleOpacityPopover(false);
  });
  document.addEventListener('click', (e) => {
    if (!opacityPopover.hidden && !opacityPopover.contains(e.target)) toggleOpacityPopover(false);
  });

  // ---------- Bubble ----------
  function setBubble(enable) {
    isBubble = enable;
    toggleOpacityPopover(false);
    root.classList.toggle('is-bubble', enable);
    bubble.hidden = !enable;
    if (enable) {
      render(false); // stops all feeds
      if (api().resizePiP) api().resizePiP(windowKey, 64, 64);
    } else {
      render(true);
    }
  }

  btnMinimize.addEventListener('click', () => setBubble(true));

  // Draggable Floating Bubble with Click-to-Restore
  let isBubblePointerDown = false;
  let bubbleStartScreenX = 0;
  let bubbleStartScreenY = 0;
  let hasBubbleDragged = false;
  let pendingBubbleDx = 0;
  let pendingBubbleDy = 0;
  let bubbleRafId = null;

  function flushBubbleMove() {
    bubbleRafId = null;
    if (pendingBubbleDx !== 0 || pendingBubbleDy !== 0) {
      if (api().movePiP) {
        api().movePiP(windowKey, pendingBubbleDx, pendingBubbleDy);
      }
      pendingBubbleDx = 0;
      pendingBubbleDy = 0;
    }
  }

  bubble.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // Left mouse click only
    isBubblePointerDown = true;
    bubbleStartScreenX = e.screenX;
    bubbleStartScreenY = e.screenY;
    hasBubbleDragged = false;
    pendingBubbleDx = 0;
    pendingBubbleDy = 0;
    bubble.classList.add('is-dragging');
    try { bubble.setPointerCapture(e.pointerId); } catch (_) {}
  });

  bubble.addEventListener('pointermove', (e) => {
    if (!isBubblePointerDown) return;
    const dx = e.screenX - bubbleStartScreenX;
    const dy = e.screenY - bubbleStartScreenY;
    bubbleStartScreenX = e.screenX;
    bubbleStartScreenY = e.screenY;

    pendingBubbleDx += dx;
    pendingBubbleDy += dy;

    if (!hasBubbleDragged && (Math.abs(pendingBubbleDx) > 3 || Math.abs(pendingBubbleDy) > 3)) {
      hasBubbleDragged = true;
    }

    if (hasBubbleDragged && !bubbleRafId) {
      bubbleRafId = requestAnimationFrame(flushBubbleMove);
    }
  });

  bubble.addEventListener('pointerup', (e) => {
    if (!isBubblePointerDown) return;
    isBubblePointerDown = false;
    bubble.classList.remove('is-dragging');
    try { bubble.releasePointerCapture(e.pointerId); } catch (_) {}

    if (bubbleRafId) {
      cancelAnimationFrame(bubbleRafId);
      flushBubbleMove();
    }

    // Only restore if user clicked without dragging
    if (!hasBubbleDragged) {
      setBubble(false);
    }
  });

  bubble.addEventListener('pointercancel', (e) => {
    isBubblePointerDown = false;
    bubble.classList.remove('is-dragging');
    try { bubble.releasePointerCapture(e.pointerId); } catch (_) {}
    if (bubbleRafId) {
      cancelAnimationFrame(bubbleRafId);
      flushBubbleMove();
    }
  });

  // ---------- Close ----------
  btnClose.addEventListener('click', () => {
    tiles.forEach((t) => t.stop());
    if (api().closePiP) api().closePiP(windowKey);
    else window.close();
  });

  // Pause polling when window is hidden
  document.addEventListener('visibilitychange', () => {
    tiles.forEach((t) => (document.hidden ? t.stop() : t.start()));
  });

  // ---------- Active client sync ----------
  async function syncActiveClients() {
    try {
      const res = await fetch(serverUrl('/api/status'), { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.port) serverPort = data.port;
      if (data.clientAliases) setClientAliases(data.clientAliases);
      if (Array.isArray(data.activeClients)) setActiveClients(data.activeClients);
    } catch (e) {}
  }

  const L = api();
  if (L.onPipInit) {
    L.onPipInit((data) => {
      if (!data) return;
      if (data.port) serverPort = data.port;
      if (data.client) {
        windowKey = String(data.client);
        if (isClientId(windowKey)) view = windowKey;
      }
      if (data.clientAliases) setClientAliases(data.clientAliases);
      if (Array.isArray(data.activeClients)) {
        activeClients = data.activeClients.map(String).filter(isClientId).sort((a, b) => a - b);
      }
      render(true);
    });
  }
  if (L.onPipUpdate) {
    L.onPipUpdate((data) => {
      if (!data) return;
      if (data.port) serverPort = data.port;
      if (data.clientAliases) setClientAliases(data.clientAliases);
      if (Array.isArray(data.activeClients)) setActiveClients(data.activeClients);
    });
  }
  if (L.onPipSetClient) {
    L.onPipSetClient((clientId) => {
      const target = String(clientId);
      if (isClientId(target)) setView(target);
    });
  }

  // ---------- Boot ----------
  applyOpacity(opacity);
  render(true);
  syncActiveClients();
  setInterval(syncActiveClients, 2000);
})();
