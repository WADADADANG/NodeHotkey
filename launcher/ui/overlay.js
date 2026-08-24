// Electron Native HUD Overlay Controller
(function() {
  const api = window.launcherAPI;
  const overlayRoot = document.getElementById('overlay-root');
  const overlayRows = document.getElementById('overlay-rows');
  const btnCloseOverlay = document.getElementById('btn-close-overlay');
  const btnToggleView = document.getElementById('btn-toggle-view');

  let lastAppliedHeight = null;
  let lastAppliedWidth = null;
  let lastCachedData = null;

  // View state: Expand all actions vs Compact single-line summary
  let isExpandedAll = localStorage.getItem('nodehotkey_overlay_expand_all') === 'true';
  const clientToggleOverrides = {}; // clientStr -> boolean

  if (btnCloseOverlay) {
    btnCloseOverlay.onclick = () => {
      if (api && typeof api.closeOverlay === 'function') {
        api.closeOverlay();
      }
    };
  }

  function updateToggleBtnState() {
    if (!btnToggleView) return;
    btnToggleView.innerHTML = isExpandedAll ? '&#9650;' : '&#9660;';
    btnToggleView.title = isExpandedAll ? 'ย่อการแสดงผล (Compact View)' : 'แสดง Action ทั้งหมด (Expand All Actions)';
  }

  if (btnToggleView) {
    updateToggleBtnState();
    btnToggleView.onclick = () => {
      const activeCount = lastCachedData?.activeClients?.length || 0;
      if (activeCount === 0) return;

      isExpandedAll = !isExpandedAll;
      localStorage.setItem('nodehotkey_expand_all', isExpandedAll ? 'true' : 'false');
      updateToggleBtnState();
      // Clear individual overrides when global toggle is clicked
      Object.keys(clientToggleOverrides).forEach(k => delete clientToggleOverrides[k]);
      if (lastCachedData) renderClients(lastCachedData);
    };
  }

  window.toggleClientExpand = (clientStr) => {
    const current = clientToggleOverrides[clientStr] !== undefined ? clientToggleOverrides[clientStr] : isExpandedAll;
    clientToggleOverrides[clientStr] = !current;
    if (lastCachedData) renderClients(lastCachedData);
  };

  function getStatusIconAndClass(type, isSuspended) {
    if (isSuspended || type === 'suspended' || type === 'paused') {
      return { icon: '🔴', text: 'PAUSED', className: 'paused' };
    }
    switch (type) {
      case 'loop':
        return { icon: '🟢', text: 'Loop', className: 'loop' };
      case 'scheduler':
        return { icon: '⏱️', text: 'Scheduler', className: 'scheduler' };
      case 'buff':
        return { icon: '🔵', text: 'Buff Queue', className: 'buff' };
      case 'forward':
        return { icon: '⚡', text: 'Forward', className: 'forward' };
      case 'sequencer':
        return { icon: '⚔️', text: 'Sequencer', className: 'sequencer' };
      case 'hold':
        return { icon: '⚓', text: 'Holding', className: 'hold' };
      default:
        return { icon: '💤', text: 'Standby', className: 'standby' };
    }
  }

  const OVERLAY_WIDTH = 210;

  function applyResize(newHeight) {
    const roundedHeight = Math.ceil(newHeight);
    if (lastAppliedHeight === roundedHeight) return;
    lastAppliedHeight = roundedHeight;
    if (api && typeof api.resizeOverlay === 'function') {
      api.resizeOverlay(OVERLAY_WIDTH, roundedHeight);
    }
  }

  function recalculateHeight() {
    requestAnimationFrame(() => {
      if (!overlayRoot) return;
      const rect = overlayRoot.getBoundingClientRect();
      const measuredHeight = Math.ceil(rect.height || overlayRoot.offsetHeight);
      const finalHeight = Math.max(50, Math.min(measuredHeight, 700));
      applyResize(finalHeight);
    });
  }

  // Real-time ResizeObserver to guarantee instant window bound updates
  if (window.ResizeObserver && overlayRoot) {
    const ro = new ResizeObserver(() => {
      recalculateHeight();
    });
    ro.observe(overlayRoot);
  }

  function renderClients(data) {
    if (!data) return;
    lastCachedData = data;

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
      recalculateHeight();
      return;
    }

    let rowsHtml = '';

    activeClients.forEach(idx => {
      const clientStr = String(idx);
      const alias = clientAliases[clientStr] || `Client ${idx}`;
      const statusInfo = clientStatuses[clientStr] || { status: 'Standby', type: 'standby', activeCount: 0, activeActions: [] };
      const isClientDisabled = isSuspended || disabledClients.includes(idx) || disabledClients.includes(clientStr);
      
      const st = getStatusIconAndClass(statusInfo.type, isClientDisabled);
      const displayText = isClientDisabled ? 'PAUSED' : (statusInfo.status || st.text);

      const activeActionsList = Array.isArray(statusInfo.activeActions) ? statusInfo.activeActions : [];
      const hasActive = activeActionsList.length > 0;
      const isExpanded = isClientDisabled ? false : (clientToggleOverrides[clientStr] !== undefined ? clientToggleOverrides[clientStr] : isExpandedAll);

      if (!isExpanded || !hasActive) {
        // Compact Single Row (or idle client without extra lines)
        rowsHtml += `
          <div class="client-row compact-mode ${hasActive ? 'is-active' : 'is-idle'}" onclick="${hasActive ? `window.toggleClientExpand('${clientStr}')` : ''}" title="${hasActive ? 'คลิกเพื่อกาง/ย่อ Action ของจอนี้' : ''}">
            <span class="client-name" title="${alias}">${alias}</span>
            <div class="client-status-wrap">
              <span class="client-status ${st.className}">
                <span>${st.icon}</span>
                <span>${displayText}</span>
              </span>
              ${activeActionsList.length > 1 ? `<span class="active-count-badge" title="มี ${activeActionsList.length} Action กำลังทำงานพร้อมกัน">+${activeActionsList.length - 1}</span>` : ''}
            </div>
          </div>
        `;
      } else {
        // Expanded Multi-Action Tree Mode
        let subItemsHtml = '';
        activeActionsList.forEach((act, actIdx) => {
          const isLast = actIdx === activeActionsList.length - 1;
          const actSt = getStatusIconAndClass(act.type, isSuspended);
          subItemsHtml += `
            <div class="sub-action-item ${actSt.className}">
              <span class="sub-tree-branch">${isLast ? '└─' : '├─'}</span>
              <span class="sub-action-icon">${act.icon || actSt.icon}</span>
              <span class="sub-action-name" title="${act.name}">${act.name}</span>
              ${act.detail ? `<span class="sub-action-detail">${act.detail}</span>` : ''}
            </div>
          `;
        });

        rowsHtml += `
          <div class="client-tree-group">
            <div class="client-row tree-header" onclick="window.toggleClientExpand('${clientStr}')" title="คลิกเพื่อย่อ/ขยาย Action ของจอนี้">
              <span class="client-name" title="${alias}">${alias}</span>
              <span class="client-badge active">${activeActionsList.length} Active</span>
            </div>
            <div class="client-sub-list">
              ${subItemsHtml}
            </div>
          </div>
        `;
      }
    });

    overlayRows.innerHTML = rowsHtml;
    recalculateHeight();
  }

  // Listen to real-time IPC updates from Main Process
  if (api && typeof api.onOverlayUpdate === 'function') {
    api.onOverlayUpdate((data) => {
      renderClients(data);
    });
  }

  // Initial fetch on startup
  fetch('http://localhost:3000/api/config', { cache: 'no-store' })
    .then(res => res.json())
    .then(json => renderClients(json))
    .catch(() => {});
})();
