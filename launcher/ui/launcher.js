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

  // 8. Smart 3-Step Update Wizard Logic
  let currentUpdateCheck = null;
  let currentDownloadResult = null;

  function renderWizardSteps(activeStep) {
    return `
      <div class="wizard-header-steps">
        <div class="wizard-step-item ${activeStep === 1 ? 'active' : activeStep > 1 ? 'completed' : ''}">
          <span class="wizard-step-num">${activeStep > 1 ? '✓' : '1'}</span>
          <span>1. ตรวจสอบ</span>
        </div>
        <div class="wizard-step-divider"></div>
        <div class="wizard-step-item ${activeStep === 2 ? 'active' : activeStep > 2 ? 'completed' : ''}">
          <span class="wizard-step-num">${activeStep > 2 ? '✓' : '2'}</span>
          <span>2. ติดตั้ง</span>
        </div>
        <div class="wizard-step-divider"></div>
        <div class="wizard-step-item ${activeStep === 3 ? 'active' : ''}">
          <span class="wizard-step-num">3</span>
          <span>3. ใช้งาน</span>
        </div>
      </div>
    `;
  }

  function renderFileList(files = []) {
    if (!files || files.length === 0) return '';
    const fileItems = files.slice(0, 15).map(f => `
      <div class="changed-file-item">
        <span class="changed-file-icon">📄</span>
        <span>${f}</span>
      </div>
    `).join('');
    const extraCount = files.length > 15 ? `<div style="font-size:10px; opacity:0.6; padding-top:2px;">... และอีก ${files.length - 15} ไฟล์</div>` : '';
    return `
      <div class="changed-files-box">
        ${fileItems}
        ${extraCount}
      </div>
    `;
  }

  if (btnCheckUpdate) {
    btnCheckUpdate.onclick = async () => {
      updateModal.style.display = 'flex';
      btnPerformUpdate.style.display = 'none';
      btnPerformUpdate.disabled = false;
      btnCancelUpdate.disabled = false;
      btnCancelUpdate.textContent = 'ยกเลิก';

      updateModalBody.innerHTML = `
        ${renderWizardSteps(1)}
        <div style="display:flex; align-items:center; gap:10px; padding:12px 0;">
          <div class="spinner"></div>
          <span>กำลังตรวจสอบสถานะและวิเคราะห์ผลกระทบจาก GitHub...</span>
        </div>
      `;

      try {
        const result = await api.checkUpdate();
        currentUpdateCheck = result;

        if (result.error) {
          updateModalBody.innerHTML = `
            ${renderWizardSteps(1)}
            <div style="color:#ef4444; font-weight:700; margin-bottom:6px;">⚠️ ไม่สามารถตรวจสอบอัปเดตได้</div>
            <div style="font-size:11px; opacity:0.8;">${result.error}</div>
          `;
        } else if (result.hasUpdate) {
          const impact = result.impact || { badge: 'Update Available', badgeClass: 'level-ui', description: 'New updates available' };
          updateModalBody.innerHTML = `
            ${renderWizardSteps(1)}
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
              <div style="color:#10b981; font-weight:700; font-size:13px;">🎉 มีอัปเดตใหม่พร้อมใช้งาน!</div>
              <span class="impact-badge ${impact.badgeClass}">${impact.badge}</span>
            </div>
            <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:8px 10px; margin:6px 0; font-family:'JetBrains Mono'; font-size:11px;">
              <div>Local: <strong>${result.localHash}</strong> ➔ Remote: <strong>${result.remoteHash}</strong></div>
              <div style="color:#60a5fa; margin-top:4px;">"${result.commitMessage || 'New features & improvements'}"</div>
            </div>
            <div style="font-size:11px; color:#cbd5e1; margin-top:6px;">💡 <strong>ผลกระทบ:</strong> ${impact.description}</div>
            ${renderFileList(result.changedFiles)}
          `;
          btnPerformUpdate.style.display = 'block';
          btnPerformUpdate.disabled = false;
          btnPerformUpdate.textContent = '📥 Step 1: ดาวน์โหลดแพ็คเกจ';
          btnPerformUpdate.onclick = () => handleStep1Download();
        } else {
          updateModalBody.innerHTML = `
            ${renderWizardSteps(1)}
            <div style="color:#10b981; font-weight:700; font-size:13px; margin-bottom:4px;">✅ ระบบเป็นเวอร์ชันล่าสุดแล้ว!</div>
            <div style="font-size:11px; opacity:0.8;">Current Commit: <code>${result.localHash}</code> (Up to date)</div>
          `;
          btnCancelUpdate.textContent = 'ปิด';
        }
      } catch (err) {
        updateModalBody.innerHTML = `
          ${renderWizardSteps(1)}
          <div style="color:#ef4444; font-weight:700;">❌ เกิดข้อผิดพลาดในการตรวจสอบ:</div>
          <div style="font-size:11px; opacity:0.8; margin-top:4px;">${err.message}</div>
        `;
      }
    };
  }

  // Step 1 Handler: Download Package
  async function handleStep1Download() {
    btnPerformUpdate.disabled = true;
    btnCancelUpdate.disabled = true;
    updateModalBody.innerHTML = `
      ${renderWizardSteps(1)}
      <div style="display:flex; align-items:center; gap:10px; padding:12px 0;">
        <div class="spinner"></div>
        <span>กำลังดาวน์โหลดแพ็คเกจและจัดเตรียมความพร้อม...</span>
      </div>
    `;

    try {
      const res = await api.downloadUpdate();
      currentDownloadResult = res;
      const impact = res.impact || (currentUpdateCheck && currentUpdateCheck.impact) || {};

      updateModalBody.innerHTML = `
        ${renderWizardSteps(2)}
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <div style="color:#10b981; font-weight:700; font-size:13px;">✅ ดาวน์โหลดแพ็คเกจเสร็จสิ้น!</div>
          <span class="impact-badge ${impact.badgeClass}">${impact.badge}</span>
        </div>
        <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5;">
          แพ็คเกจถูกเตรียมพร้อมสำหรับการติดตั้งแล้ว คุณสามารถกดปุ่มด้านล่างเพื่อเริ่มการติดตั้งทับไฟล์ live ในระบบได้ทันที
        </div>
        <div style="margin-top:10px; font-size:11px; color:#94a3b8;">
          ⚙️ <strong>ระดับการอัปเดต:</strong> ${impact.title || 'Live Application Update'}
        </div>
      `;

      btnPerformUpdate.style.display = 'block';
      btnPerformUpdate.disabled = false;
      btnPerformUpdate.textContent = '⚡ Step 2: เริ่มการติดตั้งไฟล์';
      btnCancelUpdate.disabled = false;
      btnCancelUpdate.textContent = 'ยกเลิก';
      btnPerformUpdate.onclick = () => handleStep2Apply();
    } catch (err) {
      updateModalBody.innerHTML = `
        ${renderWizardSteps(1)}
        <div style="color:#ef4444; font-weight:700;">❌ การดาวน์โหลดล้มเหลว:</div>
        <div style="font-size:11px; opacity:0.8; margin-top:4px;">${err.message}</div>
      `;
      btnPerformUpdate.style.display = 'none';
      btnCancelUpdate.disabled = false;
    }
  }

  // Step 2 Handler: Apply Package
  async function handleStep2Apply() {
    btnPerformUpdate.disabled = true;
    btnCancelUpdate.disabled = true;
    updateModalBody.innerHTML = `
      ${renderWizardSteps(2)}
      <div style="display:flex; align-items:center; gap:10px; padding:12px 0;">
        <div class="spinner"></div>
        <span>กำลังแตกไฟล์และเขียนทับข้อมูลเวอร์ชันใหม่...</span>
      </div>
    `;

    try {
      const res = await api.applyUpdate();
      const impact = res.impact || (currentDownloadResult && currentDownloadResult.impact) || { level: 1 };

      // Render Step 3 according to impact level
      if (impact.level === 3) {
        // Level 3: Core App Relaunch Required
        updateModalBody.innerHTML = `
          ${renderWizardSteps(3)}
          <div style="color:#f87171; font-weight:700; font-size:13px; margin-bottom:6px;">🚀 ติดตั้งระบบหลักเสร็จสมบูรณ์!</div>
          <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5;">
            มีการเปลี่ยนแปลงในไฟล์ระบบหลัก (Core Launcher) จำเป็นต้องรีสตาร์ทตัวโปรแกรมเพื่อให้การตั้งค่าใหม่มีผล
          </div>
        `;
        btnPerformUpdate.style.display = 'block';
        btnPerformUpdate.disabled = false;
        btnPerformUpdate.className = 'btn-hero-primary';
        btnPerformUpdate.textContent = '🚀 รีสตาร์ทโปรแกรมทันที';
        btnPerformUpdate.onclick = () => api.relaunchApp();

        btnCancelUpdate.disabled = false;
        btnCancelUpdate.textContent = 'เลื่อนไปก่อน';
      } else if (impact.level === 2) {
        // Level 2: Bot Engine Update (Ask user to restart engine or keep running)
        updateModalBody.innerHTML = `
          ${renderWizardSteps(3)}
          <div style="color:#fbbf24; font-weight:700; font-size:13px; margin-bottom:6px;">🟡 อัปเดต Bot Engine เรียบร้อย!</div>
          <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5;">
            ไฟล์คำสั่งและตรรกะของบอทได้รับการอัปเดตแล้ว คุณต้องการรีสตาร์ท Bot Engine ตอนนี้เลยหรือไม่? (หน้าจอเกมจะคงอยู่)
          </div>
        `;
        btnPerformUpdate.style.display = 'block';
        btnPerformUpdate.disabled = false;
        btnPerformUpdate.className = 'btn-hero-primary';
        btnPerformUpdate.textContent = '🔄 รีสตาร์ท Engine เดี๋ยวนี้';
        btnPerformUpdate.onclick = async () => {
          btnPerformUpdate.disabled = true;
          await api.restartEngine();
          if (editorFrame) editorFrame.src = 'http://localhost:3000/?t=' + Date.now();
          updateModal.style.display = 'none';
        };

        btnCancelUpdate.disabled = false;
        btnCancelUpdate.textContent = '⏳ รีสตาร์ทเองภายหลัง';
      } else {
        // Level 1: UI Only Hot-Reload (ZERO bot & game disruption)
        await api.hotReloadUi();
        if (editorFrame) editorFrame.src = 'http://localhost:3000/?t=' + Date.now();

        updateModalBody.innerHTML = `
          ${renderWizardSteps(3)}
          <div style="color:#34d399; font-weight:700; font-size:13px; margin-bottom:6px;">✨ Hot-Reload สำเร็จสมบูรณ์!</div>
          <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5;">
            หน้าจอ UI และ Web Dashboard ได้รับการรีเฟรชเป็นเวอร์ชันใหม่เรียบร้อยแล้ว — <strong>บอทและหน้าจอเกมทุกจอทำงานต่อเนื่อง 100% ไม่มีการปิดจอ</strong>
          </div>
        `;
        btnPerformUpdate.style.display = 'none';
        btnCancelUpdate.disabled = false;
        btnCancelUpdate.textContent = 'เสร็จสิ้น';
      }
    } catch (err) {
      updateModalBody.innerHTML = `
        ${renderWizardSteps(2)}
        <div style="color:#ef4444; font-weight:700;">❌ การติดตั้งล้มเหลว:</div>
        <div style="font-size:11px; opacity:0.8; margin-top:4px;">${err.message}</div>
      `;
      btnPerformUpdate.style.display = 'none';
      btnCancelUpdate.disabled = false;
    }
  }

  if (btnCloseUpdateModal) btnCloseUpdateModal.onclick = () => updateModal.style.display = 'none';
  if (btnCancelUpdate) btnCancelUpdate.onclick = () => updateModal.style.display = 'none';

  // 9. Listeners from Electron Main Process
  if (api.onHotReload) {
    api.onHotReload(() => {
      if (editorFrame) {
        editorFrame.src = 'http://localhost:3000/?t=' + Date.now();
      }
    });
  }

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
