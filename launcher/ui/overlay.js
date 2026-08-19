// Electron Native HUD Overlay Controller
(function() {
  const api = window.launcherAPI;
  const overlayRoot = document.getElementById('overlay-root');
  const overlayRows = document.getElementById('overlay-rows');
  const btnCloseOverlay = document.getElementById('btn-close-overlay');

  let lastAppliedHeight = null;

  if (btnCloseOverlay) {
    btnCloseOverlay.onclick = () => {
      if (api && typeof api.closeOverlay === 'function') {
        api.closeOverlay();
      }
    };
  }

  function getStatusIconAndClass(type, isSuspended) {
    if (isSuspended || type === 'suspended' || type === 'paused') {
      return { icon: '🔴', text: 'PAUSED', className: 'paused' };
    }
    switch (type) {
      case 'loop':
        return { icon: '🟢', text: 'Loop', className: 'loop' };
      case 'buff':
        return { icon: '🔵', text: 'Buff Queue', className: 'buff' };
      case 'forward':
        return { icon: '⚡', text: 'Forward', className: 'forward' };
      case 'hold':
        return { icon: '⚓', text: 'Holding', className: 'hold' };
      default:
        return { icon: '💤', text: 'Standby', className: 'standby' };
    }
  }

  function applyResize(newHeight) {
    if (lastAppliedHeight === newHeight) return; // Resize Guard: do not interrupt user drag
    lastAppliedHeight = newHeight;
    if (api && typeof api.resizeOverlay === 'function') {
      api.resizeOverlay(210, newHeight);
    }
  }

  function renderClients(data) {
    if (!data) return;
    const activeClients = (data.activeClients || []).sort((a, b) => a - b);
    const clientStatuses = data.clientStatuses || {};
    const clientAliases = data.clientAliases || {};
    const isSuspended = !!data.isSuspended;
    const disabledClients = data.disabledClients || [];

    if (activeClients.length === 0) {
      overlayRows.innerHTML = `
        <div class="overlay-empty">
          <span class="empty-icon">${isSuspended ? '🔴' : '💤'}</span>
          <span class="empty-text">${isSuspended ? 'BOT PAUSED' : 'Standby'}</span>
        </div>
      `;
      applyResize(60);
      return;
    }

    let rowsHtml = '';
    activeClients.forEach(idx => {
      const clientStr = String(idx);
      const alias = clientAliases[clientStr] || `Client ${idx}`;
      const statusInfo = clientStatuses[clientStr] || { status: 'Standby', type: 'standby' };
      const isClientDisabled = isSuspended || disabledClients.includes(idx) || disabledClients.includes(clientStr);
      
      const st = getStatusIconAndClass(statusInfo.type, isClientDisabled);
      const displayText = isClientDisabled ? 'PAUSED' : (statusInfo.status || st.text);

      rowsHtml += `
        <div class="client-row">
          <span class="client-name" title="${alias}">${alias}</span>
          <span class="client-status ${st.className}">
            <span>${st.icon}</span>
            <span>${displayText}</span>
          </span>
        </div>
      `;
    });

    overlayRows.innerHTML = rowsHtml;

    // Dynamic height calculation: header (24px) + rows (each ~26px + 4px gap) + padding (12px)
    const targetHeight = 24 + (activeClients.length * 30) + 14;
    applyResize(Math.min(targetHeight, 400));
  }

  // Listen to real-time IPC updates from Main Process
  if (api && typeof api.onOverlayUpdate === 'function') {
    api.onOverlayUpdate((data) => {
      renderClients(data);
    });
  }

  // Initial single fetch on startup
  fetch('http://localhost:3000/api/config', { cache: 'no-store' })
    .then(res => res.json())
    .then(json => renderClients(json))
    .catch(() => {});
})();
