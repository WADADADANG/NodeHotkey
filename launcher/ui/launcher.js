// NodeHotkey Launcher Frontend Controller
(function() {
  const api = window.launcherAPI;
  if (!api) {
    console.error('launcherAPI is not available');
    return;
  }

  // Navigation Tabs & Views
  const tabNavLauncher = document.getElementById('tab-nav-launcher');
  const tabNavEditor = document.getElementById('tab-nav-editor');
  const tabEditorDot = document.getElementById('tab-editor-dot');
  const viewLauncher = document.getElementById('view-launcher');
  const viewEditor = document.getElementById('view-editor');
  const editorFrame = document.getElementById('editor-frame');
  const btnSwitchToEditor = document.getElementById('btn-switch-to-editor');
  const btnReloadCanvas = document.getElementById('btn-reload-canvas');
  const btnOpenExternalBrowser = document.getElementById('btn-open-external-browser');

  // DOM Elements (Controls)
  const btnToggleEngine = document.getElementById('btn-toggle-engine');
  const heroIcon = document.getElementById('hero-icon');
  const heroTitle = document.getElementById('hero-title');
  const heroSub = document.getElementById('hero-sub');
  
  const btnRestartEngine = document.getElementById('btn-restart-engine');
  const btnOpenLogs = document.getElementById('btn-open-logs');
  const btnCheckUpdate = document.getElementById('btn-check-update');
  
  // Window Controls
  const btnWinMin = document.getElementById('btn-win-min');
  const btnWinMax = document.getElementById('btn-win-max');
  const btnWinClose = document.getElementById('btn-win-close');

  // Diagnostics Elements
  const dotEngine = document.getElementById('dot-engine');
  const valEngineStatus = document.getElementById('val-engine-status');
  const subEngineInfo = document.getElementById('sub-engine-info');
  
  const dotServer = document.getElementById('dot-server');
  const valServerStatus = document.getElementById('val-server-status');
  const subServerInfo = document.getElementById('sub-server-info');
  
  const valProfileName = document.getElementById('val-profile-name');
  const subProfileCount = document.getElementById('sub-profile-count');
  
  const valClientsCount = document.getElementById('val-clients-count');
  const subClientsInfo = document.getElementById('sub-clients-info');

  // Terminal Elements
  const terminalBody = document.getElementById('terminal-body');
  const logEntries = document.getElementById('log-entries');
  const logSearchInput = document.getElementById('log-search-input');
  const btnToggleAutoscroll = document.getElementById('btn-toggle-autoscroll');
  const btnClearTerminal = document.getElementById('btn-clear-terminal');
  const footerLogPath = document.getElementById('footer-log-path');
  const logCounterBadge = document.getElementById('log-counter-badge');
  const filterPills = document.querySelectorAll('.filter-pill');

  // Update Modal Elements
  const updateModal = document.getElementById('update-modal');
  const updateModalBody = document.getElementById('update-modal-body');
  const btnCloseUpdateModal = document.getElementById('btn-close-update-modal');
  const btnCancelUpdate = document.getElementById('btn-cancel-update');
  const btnPerformUpdate = document.getElementById('btn-perform-update');

  // State
  let currentView = 'launcher';
  let isRunning = false;
  let isRestarting = false;
  let autoScroll = true;
  let currentFilter = 'all';
  let searchQuery = '';
  let totalLogs = 0;
  let startTime = Date.now();
  let uptimeInterval = null;
  let isServerOnline = false;

  // 1. Navigation View Switcher Logic
  function switchView(viewName) {
    currentView = viewName;
    if (viewName === 'launcher') {
      tabNavLauncher.classList.add('active');
      tabNavEditor.classList.remove('active');
      viewLauncher.classList.add('active');
      viewEditor.classList.remove('active');
    } else if (viewName === 'editor') {
      tabNavEditor.classList.add('active');
      tabNavLauncher.classList.remove('active');
      viewEditor.classList.add('active');
      viewLauncher.classList.remove('active');

      // Load or refresh iframe if not loaded
      if (editorFrame && (editorFrame.src === 'about:blank' || !editorFrame.src)) {
        editorFrame.src = 'http://localhost:3000/';
      }
    }
  }

  if (tabNavLauncher) tabNavLauncher.onclick = () => switchView('launcher');
  if (tabNavEditor) tabNavEditor.onclick = () => switchView('editor');
  if (btnSwitchToEditor) btnSwitchToEditor.onclick = () => switchView('editor');

  if (btnReloadCanvas) {
    btnReloadCanvas.onclick = () => {
      if (editorFrame) {
        editorFrame.src = 'http://localhost:3000/?t=' + Date.now();
      }
    };
  }

  if (btnOpenExternalBrowser) {
    btnOpenExternalBrowser.onclick = () => api.openWebDashboard();
  }

  // 2. Initialize Window Controls
  if (btnWinMin) btnWinMin.onclick = () => api.minimizeWindow();
  if (btnWinMax) btnWinMax.onclick = () => api.maximizeWindow();
  if (btnWinClose) btnWinClose.onclick = () => api.closeWindow();

  // 3. Button Action Handlers
  if (btnToggleEngine) {
    btnToggleEngine.onclick = async () => {
      if (isRestarting) return;
      if (isRunning) {
        setBtnLoading('Stopping...');
        await api.stopBot();
      } else {
        setBtnLoading('Starting...');
        await api.startBot();
      }
    };
  }

  if (btnRestartEngine) {
    btnRestartEngine.onclick = async () => {
      if (isRestarting) return;
      setBtnLoading('Restarting...');
      await api.restartBot();
    };
  }

  if (btnOpenLogs) {
    btnOpenLogs.onclick = () => api.openLogFolder();
  }

  // 4. UI State Setters
  function setBtnLoading(msg) {
    btnToggleEngine.className = 'btn-hero-primary btn-restarting';
    heroIcon.textContent = '⏳';
    heroTitle.textContent = msg;
    heroSub.textContent = 'Please wait...';
  }

  function updateStatusUI(status) {
    isRunning = status.running;
    isRestarting = status.restarting;

    if (isRestarting) {
      btnToggleEngine.className = 'btn-hero-primary btn-restarting';
      heroIcon.textContent = '🔄';
      heroTitle.textContent = 'กำลังรีสตาร์ท...';
      heroSub.textContent = 'Restarting Engine';

      dotEngine.className = 'diag-indicator-dot pending';
      valEngineStatus.textContent = 'กำลังรีสตาร์ท';
      subEngineInfo.textContent = 'Reloading processes';
    } else if (isRunning) {
      btnToggleEngine.className = 'btn-hero-primary btn-stop';
      heroIcon.textContent = '⏹';
      heroTitle.textContent = 'หยุดการทำงาน';
      heroSub.textContent = 'Stop Bot Engine';

      dotEngine.className = 'diag-indicator-dot online';
      valEngineStatus.textContent = '🟢 กำลังทำงาน';
      if (!uptimeInterval) {
        startTime = Date.now();
        uptimeInterval = setInterval(updateUptime, 1000);
      }
    } else {
      btnToggleEngine.className = 'btn-hero-primary btn-start';
      heroIcon.textContent = '▶';
      heroTitle.textContent = 'เริ่มการทำงาน';
      heroSub.textContent = 'Start Bot Engine';

      dotEngine.className = 'diag-indicator-dot offline';
      valEngineStatus.textContent = '🔴 หยุดทำงาน';
      subEngineInfo.textContent = 'Process Stopped';
      if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
      }
    }

    btnRestartEngine.disabled = !isRunning && !isRestarting;
  }

  function updateUptime() {
    if (!isRunning) return;
    const diffSec = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(diffSec / 60);
    const s = diffSec % 60;
    const timeStr = m > 0 ? `${m}m ${s}s` : `${s}s`;
    subEngineInfo.textContent = `Uptime: ${timeStr}`;
  }

  // 5. Real-time Terminal Log Appender
  function appendLogEntry(data) {
    totalLogs++;
    logCounterBadge.textContent = `${totalLogs} Lines`;

    const row = document.createElement('div');
    row.className = `log-row ${data.level || 'info'}`;
    row.dataset.level = data.level || 'info';
    row.dataset.text = (data.text || '').toLowerCase();

    // Check filter match
    const matchesFilter = currentFilter === 'all' || (data.level && data.level.toLowerCase() === currentFilter);
    const matchesSearch = !searchQuery || row.dataset.text.includes(searchQuery);

    if (!matchesFilter || !matchesSearch) {
      row.style.display = 'none';
    }

    const timeEl = document.createElement('span');
    timeEl.className = 'log-time';
    timeEl.textContent = data.time || new Date().toLocaleTimeString();

    const badgeEl = document.createElement('span');
    badgeEl.className = `log-badge ${data.level || 'info'}`;
    badgeEl.textContent = data.level || 'INFO';

    const textEl = document.createElement('span');
    textEl.className = 'log-text';
    textEl.textContent = data.text;

    row.appendChild(timeEl);
    row.appendChild(badgeEl);
    row.appendChild(textEl);

    logEntries.appendChild(row);

    // Limit maximum DOM nodes in terminal
    if (logEntries.children.length > 800) {
      logEntries.removeChild(logEntries.firstElementChild);
    }

    if (autoScroll) {
      terminalBody.scrollTop = terminalBody.scrollHeight;
    }
  }

  // 6. Terminal Filtering & Search
  function applyLogFilters() {
    const rows = logEntries.querySelectorAll('.log-row');
    rows.forEach(r => {
      const level = r.dataset.level || 'info';
      const text = r.dataset.text || '';
      const matchesFilter = currentFilter === 'all' || level === currentFilter;
      const matchesSearch = !searchQuery || text.includes(searchQuery);
      r.style.display = (matchesFilter && matchesSearch) ? 'flex' : 'none';
    });

    if (autoScroll) {
      terminalBody.scrollTop = terminalBody.scrollHeight;
    }
  }

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter || 'all';
      applyLogFilters();
    });
  });

  if (logSearchInput) {
    logSearchInput.addEventListener('input', (e) => {
      searchQuery = (e.target.value || '').toLowerCase().trim();
      applyLogFilters();
    });
  }

  if (btnToggleAutoscroll) {
    btnToggleAutoscroll.onclick = () => {
      autoScroll = !autoScroll;
      btnToggleAutoscroll.classList.toggle('active', autoScroll);
      if (autoScroll) {
        terminalBody.scrollTop = terminalBody.scrollHeight;
      }
    };
  }

  if (btnClearTerminal) {
    btnClearTerminal.onclick = () => {
      logEntries.innerHTML = '';
      totalLogs = 0;
      logCounterBadge.textContent = `0 Lines`;
    };
  }

  // 7. Diagnostics Data Listener
  api.onDiagnosticsUpdate((diag) => {
    isServerOnline = diag.serverOnline;

    if (diag.serverOnline) {
      dotServer.className = 'diag-indicator-dot online';
      valServerStatus.textContent = `Port ${diag.port || 3000}`;
      subServerInfo.textContent = '🟢 Server Online';
      if (tabEditorDot) tabEditorDot.className = 'tab-live-dot online';

      // If editor frame is still blank and user is in editor view, load it
      if (editorFrame && (editorFrame.src === 'about:blank' || !editorFrame.src)) {
        editorFrame.src = 'http://localhost:3000/';
      }
    } else {
      dotServer.className = 'diag-indicator-dot offline';
      valServerStatus.textContent = `Offline`;
      subServerInfo.textContent = diag.error || 'Server not responding';
      if (tabEditorDot) tabEditorDot.className = 'tab-live-dot';
    }

    if (diag.activeProfiles && diag.activeProfiles.length > 0) {
      valProfileName.textContent = diag.activeProfiles[0];
      subProfileCount.textContent = `${diag.activeProfiles.length} Active Profile(s)`;
    }

    if (diag.activeClientsCount !== undefined) {
      valClientsCount.textContent = `${diag.activeClientsCount} จอ`;
      subClientsInfo.textContent = diag.activeClientsCount > 0 ? '🟢 Connected Clients' : 'No clients attached';
    }
  });

  // 8. Update System Logic
  if (btnCheckUpdate) {
    btnCheckUpdate.onclick = async () => {
      updateModal.style.display = 'flex';
      btnPerformUpdate.style.display = 'none';
      updateModalBody.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="spinner"></div>
          <span>กำลังตรวจสอบสถานะ Git Remote...</span>
        </div>
      `;

      try {
        const result = await api.checkUpdate();
        if (result.error) {
          updateModalBody.innerHTML = `
            <div style="color:#ef4444; font-weight:700; margin-bottom:6px;">⚠️ ไม่สามารถตรวจสอบอัปเดตได้</div>
            <div style="font-size:11px; opacity:0.8;">${result.error}</div>
          `;
        } else if (result.hasUpdate) {
          updateModalBody.innerHTML = `
            <div style="color:#10b981; font-weight:700; font-size:13px; margin-bottom:6px;">🎉 มีอัปเดตเวอร์ชันใหม่พร้อมใช้งาน!</div>
            <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:8px 10px; margin:8px 0; font-family:'JetBrains Mono'; font-size:11px;">
              <div>Local: <strong>${result.localHash}</strong> ➔ Remote: <strong>${result.remoteHash}</strong></div>
              <div style="color:#60a5fa; margin-top:4px;">"${result.commitMessage || 'New features & bug fixes'}"</div>
            </div>
            <div style="font-size:11px; color:#94a3b8;">กดปุ่มด้านล่างเพื่อดาวน์โหลดและอัปเดตระบบอัตโนมัติ</div>
          `;
          btnPerformUpdate.style.display = 'block';
        } else {
          updateModalBody.innerHTML = `
            <div style="color:#10b981; font-weight:700; font-size:13px; margin-bottom:4px;">✅ ระบบเป็นเวอร์ชันล่าสุดแล้ว!</div>
            <div style="font-size:11px; opacity:0.8;">Current Commit: <code>${result.localHash}</code> (Up to date)</div>
          `;
        }
      } catch (err) {
        updateModalBody.innerHTML = `
          <div style="color:#ef4444; font-weight:700;">❌ เกิดข้อผิดพลาดในการตรวจสอบ:</div>
          <div style="font-size:11px; opacity:0.8; margin-top:4px;">${err.message}</div>
        `;
      }
    };
  }

  if (btnPerformUpdate) {
    btnPerformUpdate.onclick = async () => {
      btnPerformUpdate.disabled = true;
      btnCancelUpdate.disabled = true;
      updateModalBody.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="spinner"></div>
          <span>กำลังดาวน์โหลดและติดตั้งอัปเดต... (กรุณารอสักครู่)</span>
        </div>
      `;

      try {
        await api.applyUpdate();
        updateModalBody.innerHTML = `
          <div style="color:#10b981; font-weight:700; font-size:14px; margin-bottom:6px;">🎉 อัปเดตระบบเสร็จสมบูรณ์เรียบร้อยแล้ว!</div>
          <div style="font-size:11px; opacity:0.8;">ระบบพร้อมใช้งานเวอร์ชันใหม่ทันที</div>
        `;
        btnPerformUpdate.style.display = 'none';
        btnCancelUpdate.disabled = false;
        btnCancelUpdate.textContent = 'เสร็จสิ้น';
      } catch (err) {
        updateModalBody.innerHTML = `
          <div style="color:#ef4444; font-weight:700;">❌ การอัปเดตล้มเหลว:</div>
          <div style="font-size:11px; opacity:0.8; margin-top:4px;">${err.message}</div>
        `;
        btnPerformUpdate.style.display = 'none';
        btnCancelUpdate.disabled = false;
      }
    };
  }

  if (btnCloseUpdateModal) btnCloseUpdateModal.onclick = () => updateModal.style.display = 'none';
  if (btnCancelUpdate) btnCancelUpdate.onclick = () => updateModal.style.display = 'none';

  // 9. Listeners from Electron Main Process
  api.onLogMessage((data) => {
    appendLogEntry(data);
  });

  api.onStatusChange((status) => {
    updateStatusUI(status);
  });

  // 10. Initial Load
  api.getBotStatus().then(status => {
    updateStatusUI(status);
    if (status.logPath && footerLogPath) {
      footerLogPath.textContent = status.logPath;
    }
  });

  api.getLogPath().then(path => {
    if (footerLogPath && path) footerLogPath.textContent = path;
  });
})();
