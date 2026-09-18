// NodeHotkey Launcher Frontend Controller
(function() {
  const api = window.launcherAPI;
  if (!api) {
    console.error('launcherAPI is not available');
    return;
  }

  // Dynamic Web Server Port
  let currentServerPort = 3088;
  function getServerUrl(path = '') {
    return `http://localhost:${currentServerPort}${path}`;
  }

  // Load global settings directly from disk via IPC on boot
  async function initGlobalSettingsFromDisk() {
    if (api && typeof api.getGlobalConfig === 'function') {
      try {
        const cfg = await api.getGlobalConfig();
        if (cfg) {
          if (!cachedConfig) cachedConfig = cfg;
          else {
            cachedConfig.globalSettings = cfg.globalSettings;
            if (cfg.activeProfile) cachedConfig.activeProfile = cfg.activeProfile;
            if (cfg.activeProfiles) cachedConfig.activeProfiles = cfg.activeProfiles;
          }
          if (cfg.globalSettings && cfg.globalSettings.webPort) {
            const p = parseInt(cfg.globalSettings.webPort, 10);
            if (!isNaN(p) && p > 0 && !isServerOnline) {
              currentServerPort = p;
            }
          }
          loadSettingsToUI(cfg);
          if (cfg.activeProfiles && cfg.activeProfiles.length > 0) {
            renderActiveProfiles(cfg.activeProfiles);
          } else if (cfg.activeProfile) {
            renderActiveProfiles([cfg.activeProfile]);
          }
        }
      } catch (e) {
        console.warn('initGlobalSettingsFromDisk error:', e);
      }
    }
  }
  initGlobalSettingsFromDisk();

  // Navigation Tabs & Views
  const tabNavDashboard = document.getElementById('tab-nav-dashboard') || document.getElementById('tab-nav-launcher');
  const tabNavEditor = document.getElementById('tab-nav-editor');
  const tabNavSettings = document.getElementById('tab-nav-settings');
  const tabEditorDot = document.getElementById('tab-editor-dot');
  
  const viewDashboard = document.getElementById('view-dashboard') || document.getElementById('view-launcher');
  const viewEditor = document.getElementById('view-editor');
  const viewSettings = document.getElementById('view-settings');
  const editorFrame = document.getElementById('editor-frame');
  const btnSwitchToEditor = document.getElementById('btn-switch-to-editor');
  
  // Top Utilities
  const btnTopGithub = document.getElementById('btn-top-github');
  const btnLangTh = document.getElementById('btn-lang-th');
  const btnLangEn = document.getElementById('btn-lang-en');

  // DOM Elements (Controls)
  const btnToggleEngine = document.getElementById('btn-toggle-engine');
  const heroIcon = document.getElementById('hero-icon');
  const heroTitle = document.getElementById('hero-title');
  const heroSub = document.getElementById('hero-sub');
  
  const btnOpenLogs = document.getElementById('btn-open-logs');
  const btnCheckUpdate = document.getElementById('btn-check-update');
  const lblCheckUpdateText = document.getElementById('lbl-check-update-text');
  const badgeUpdateCount = document.getElementById('badge-update-count');
  const dotUpdatePulse = document.getElementById('dot-update-pulse');

  let detectedUpdateInfo = null;
  let currentUpdateCheck = null;
  let currentDownloadResult = null;

  function renderUpdateToolButton(hasUpdate, updateData) {
    if (!btnCheckUpdate) return;
    const t = i18nDict[currentLang] || i18nDict.th;

    if (hasUpdate && updateData) {
      btnCheckUpdate.classList.add('has-update');
      if (lblCheckUpdateText) lblCheckUpdateText.textContent = t.btnUpdateHasNew || 'มีอัปเดตใหม่!';
      if (badgeUpdateCount) {
        const count = updateData.commitCount || (updateData.commitsList ? updateData.commitsList.length : 1);
        badgeUpdateCount.textContent = count > 1 ? `${count} Commits` : 'New';
        badgeUpdateCount.style.display = 'inline-flex';
      }
      if (dotUpdatePulse) dotUpdatePulse.style.display = 'inline-block';
      btnCheckUpdate.title = t.btnUpdateTooltip || 'มีอัปเดตใหม่พร้อมใช้งาน! คลิกเพื่อดูรายละเอียดและติดตั้ง';
      document.title = currentLang === 'en' ? '(✨ Update Available) NodeHotkey Studio Pro' : '(✨ มีอัปเดต) NodeHotkey Studio Pro';
    } else {
      btnCheckUpdate.classList.remove('has-update');
      if (lblCheckUpdateText) lblCheckUpdateText.textContent = t.btnUpdate || 'Update';
      if (badgeUpdateCount) badgeUpdateCount.style.display = 'none';
      if (dotUpdatePulse) dotUpdatePulse.style.display = 'none';
      btnCheckUpdate.title = currentLang === 'en' ? 'Check for system updates from GitHub' : 'ตรวจสอบการอัปเดตระบบจาก GitHub';
      document.title = 'NodeHotkey Studio Pro';
    }
  }
  
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
  const cardProfileStatus = document.getElementById('card-profile-status');
  let cachedActiveProfiles = [];
  let profileAutoScrollTimer = null;
  let isHoveringProfileCard = false;

  if (cardProfileStatus) {
    cardProfileStatus.addEventListener('mouseenter', () => {
      isHoveringProfileCard = true;
    });
    cardProfileStatus.addEventListener('mouseleave', () => {
      isHoveringProfileCard = false;
    });
    // Allow mouse wheel anywhere on the card to smoothly scroll the active profiles list
    cardProfileStatus.addEventListener('wheel', (e) => {
      if (!valProfileName) return;
      const listEl = valProfileName.querySelector('.active-profiles-list');
      if (listEl && listEl.scrollHeight > listEl.clientHeight) {
        listEl.scrollTop += e.deltaY;
        e.preventDefault();
      }
    }, { passive: false });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderActiveProfiles(profiles) {
    if (!valProfileName) return;
    if (profileAutoScrollTimer) {
      clearInterval(profileAutoScrollTimer);
      profileAutoScrollTimer = null;
    }

    const list = Array.isArray(profiles) ? profiles.filter(p => p && typeof p === 'string' && p.trim()) : [];
    cachedActiveProfiles = list;

    const count = list.length;
    const isEn = currentLang === 'en';

    // Update subtitle count and scroll hint when list exceeds card view
    if (subProfileCount) {
      if (count === 0) {
        subProfileCount.textContent = isEn ? '0 Active Profile' : 'ยังไม่ได้เปิดโปรไฟล์';
      } else if (count === 1) {
        subProfileCount.textContent = isEn ? '1 Active Profile' : 'เปิดใช้งาน 1 โปรไฟล์';
      } else if (count === 2) {
        subProfileCount.textContent = isEn ? '2 Active Profiles' : 'เปิดใช้งาน 2 โปรไฟล์';
      } else {
        subProfileCount.textContent = isEn ? `${count} Profiles (Scroll ▾)` : `เปิด ${count} โปรไฟล์ (เลื่อนดู ▾)`;
      }
    }

    if (count === 0) {
      valProfileName.innerHTML = `<span style="font-size:12px; font-weight:700; color:var(--text-dim);">-</span>`;
      return;
    }

    if (count === 1) {
      const p = list[0];
      valProfileName.innerHTML = `
        <div class="active-profile-item" style="font-size:12px;" title="${escapeHtml(p)}">
          <span class="active-profile-bullet">▸</span>
          <span class="active-profile-text" style="font-size:12px; font-weight:700; color:#fff;">${escapeHtml(p)}</span>
        </div>
      `;
      return;
    }

    // 2 or more profiles: Keep readable font size (11.5px) in a scrollable list
    const itemsHtml = list.map(p => `
      <div class="active-profile-item" title="${escapeHtml(p)}">
        <span class="active-profile-bullet">▸</span>
        <span class="active-profile-text">${escapeHtml(p)}</span>
      </div>
    `).join('');

    valProfileName.innerHTML = `
      <div class="active-profiles-list">
        ${itemsHtml}
      </div>
    `;

    // When 3+ profiles exist, enable a subtle ticker auto-scroll when idle (pauses on hover)
    if (count > 2) {
      profileAutoScrollTimer = setInterval(() => {
        if (isHoveringProfileCard) return;
        const listEl = valProfileName.querySelector('.active-profiles-list');
        if (!listEl) return;
        if (listEl.scrollHeight <= listEl.clientHeight) return;

        // Loop back smoothly to top if near bottom
        if (listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight - 2) {
          listEl.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          listEl.scrollBy({ top: 22, behavior: 'smooth' });
        }
      }, 3000);
    }
  }
  
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
  let currentView = 'dashboard';
  let isRunning = false;
  let isRestarting = false;
  let autoScroll = true;
  let currentFilter = 'all';
  let searchQuery = '';
  let totalLogs = 0;
  let startTime = Date.now();
  let uptimeInterval = null;
  let isServerOnline = false;
  let currentModalState = null;

  // 1. Navigation View Switcher Logic
  const breadcrumbEl = document.getElementById('view-breadcrumb-text');

  function switchView(viewName) {
    currentView = viewName;
    const t = i18nDict[currentLang] || i18nDict.th;
    
    // Deactivate all
    if (tabNavDashboard) tabNavDashboard.classList.remove('active');
    if (tabNavEditor) tabNavEditor.classList.remove('active');
    if (tabNavSettings) tabNavSettings.classList.remove('active');
    if (viewDashboard) viewDashboard.classList.remove('active');
    if (viewEditor) viewEditor.classList.remove('active');
    if (viewSettings) viewSettings.classList.remove('active');

    const studioTopbarActions = document.getElementById('studio-topbar-actions');
    const offlinePlaceholder = document.getElementById('editor-offline-placeholder');

    if (viewName === 'dashboard') {
      if (tabNavDashboard) tabNavDashboard.classList.add('active');
      if (viewDashboard) viewDashboard.classList.add('active');
      if (breadcrumbEl) breadcrumbEl.textContent = t.breadcrumbDashboard;
      if (studioTopbarActions) studioTopbarActions.style.display = 'none';
    } else if (viewName === 'editor') {
      if (tabNavEditor) tabNavEditor.classList.add('active');
      if (viewEditor) viewEditor.classList.add('active');
      if (breadcrumbEl) breadcrumbEl.textContent = t.breadcrumbStudio;
      if (studioTopbarActions) studioTopbarActions.style.display = 'flex';

      // Check Server/Bot Engine status
      if (!isServerOnline || !isRunning) {
        if (offlinePlaceholder) offlinePlaceholder.style.display = 'flex';
      } else {
        if (offlinePlaceholder) offlinePlaceholder.style.display = 'none';
        const currentOrigin = `http://localhost:${currentServerPort}`;
        if (editorFrame && (!editorFrame.src || editorFrame.src === 'about:blank' || !editorFrame.src.startsWith(currentOrigin))) {
          window.reloadEditorFrame();
        }
      }
    } else if (viewName === 'settings') {
      if (tabNavSettings) tabNavSettings.classList.add('active');
      if (viewSettings) viewSettings.classList.add('active');
      if (breadcrumbEl) breadcrumbEl.textContent = t.breadcrumbSettings;
      if (studioTopbarActions) studioTopbarActions.style.display = 'none';
    }
  }

  // Action Node Unsaved State & Safe Reload Controls
  let isStudioDirty = false;
  window.addEventListener('message', (e) => {
    if (!e.data) return;
    if (e.data.type === 'NODEHOTKEY_DIRTY_STATE') {
      isStudioDirty = !!e.data.isDirty;
    }
  });

  window.closeUnsavedReloadModal = function() {
    const modal = document.getElementById('unsaved-reload-modal');
    if (modal) modal.style.display = 'none';
  };

  window.forceDiscardAndReload = function() {
    window.closeUnsavedReloadModal();
    isStudioDirty = false;
    if (editorFrame && editorFrame.contentWindow) {
      try {
        editorFrame.contentWindow.postMessage({ type: 'NODEHOTKEY_FORCE_RELOAD' }, '*');
        return;
      } catch (e) {}
    }
    if (editorFrame && isServerOnline) {
      editorFrame.src = getServerUrl('/?t=' + Date.now());
    }
  };

  window.reloadEditorFrame = function(bypassDirtyCheck = false) {
    if (!editorFrame || !isServerOnline) return;

    if (!bypassDirtyCheck && isStudioDirty) {
      const modal = document.getElementById('unsaved-reload-modal');
      if (modal) {
        modal.style.display = 'flex';
        return;
      }
    }

    editorFrame.src = getServerUrl('/?t=' + Date.now());
  };

  window.openEditorInBrowser = function() {
    if (api && api.openExternal) {
      api.openExternal(getServerUrl('/'));
    } else {
      window.open(getServerUrl('/'), '_blank');
    }
  };

  window.startBotFromStudio = async function() {
    if (isRestarting) return;
    setBtnLoading('Starting...');
    await api.startBot();
  };

  if (tabNavDashboard) tabNavDashboard.onclick = () => switchView('dashboard');
  if (tabNavEditor) tabNavEditor.onclick = () => switchView('editor');
  if (tabNavSettings) tabNavSettings.onclick = () => switchView('settings');
  if (btnSwitchToEditor) btnSwitchToEditor.onclick = () => switchView('editor');

  // GitHub Open
  if (btnTopGithub) {
    btnTopGithub.onclick = (e) => {
      e.preventDefault();
      if (api.openExternal) {
        api.openExternal('https://github.com/WADADADANG/NodeHotkey');
      } else {
        window.open('https://github.com/WADADADANG/NodeHotkey', '_blank');
      }
    };
  }

  // Language Toggle
  if (btnLangTh && btnLangEn) {
    btnLangTh.onclick = () => {
      btnLangTh.classList.add('active');
      btnLangEn.classList.remove('active');
    };
    btnLangEn.onclick = () => {
      btnLangEn.classList.add('active');
      btnLangTh.classList.remove('active');
    };
  }
  // 2. Initialize Window Controls
  if (btnWinMin) btnWinMin.onclick = () => api.minimizeWindow();
  if (btnWinMax) btnWinMax.onclick = () => api.maximizeWindow();
  if (btnWinClose) btnWinClose.onclick = () => api.closeWindow();

  // 3. Multilingual Translations Dictionary (TH / EN)
  const i18nDict = {
    th: {
      menuMain: "หน้าหลัก (Workspace)",
      menuConfig: "การตั้งค่า (Configuration)",
      navDashboard: "แดชบอร์ด",
      navActionNode: "Action Node",
      navSettings: "ตั้งค่า & HUD",
      breadcrumbDashboard: "Dashboard & ควบคุมจอ",
      breadcrumbStudio: "Action Node Studio",
      breadcrumbSettings: "ตั้งค่าระบบ & HUD",
      btnLogs: "Logs",
      btnUpdate: "อัปเดต",
      btnUpdateHasNew: "มีอัปเดตใหม่!",
      btnUpdateTooltip: "มีอัปเดตใหม่พร้อมใช้งาน! คลิกเพื่อดูรายละเอียดและติดตั้ง",
      diagEngineTitle: "สถานะโปรแกรม",
      diagServerTitle: "Web Server",
      diagProfileTitle: "โปรไฟล์ที่เปิดใช้งาน",
      diagClientsTitle: "จอเกมที่ตรวจพบ",
      statusStarting: "กำลังเริ่ม...",
      statusStopped: "🔴 หยุดทำงาน",
      statusRunning: "🟢 กำลังทำงาน",
      statusRestarting: "กำลังรีสตาร์ท...",
      btnStartEngine: "เริ่มการทำงาน",
      btnStopEngine: "หยุดการทำงาน",
      matrixTitle: "CLIENT CONTROL MATRIX (จอ 1 - 8)",
      unitScreens: "จอ",
      btnLaunchAll: "🚀 เปิดทุกจอ",
      btnStopAll: "⏹️ ปิดทุกจอ",
      btnLaunchAllLoading: "⏳ กำลังเปิดทุกจอ...",
      cBtnLaunch: "➕ เปิดจอ",
      cBtnLaunching: "⏳ กำลังเปิด...",
      cBtnPause: "⏸️ พักบอท",
      cBtnPauseTitle: "หยุดการกดสกิลในจอนี้ชั่วคราว",
      cBtnResume: "▶️ เปิดบอท",
      cBtnResumeTitle: "เปิดการทำงานต่อสำหรับจอนี้",
      cBadgeOffline: "OFFLINE",
      cBadgeActive: "🟢 ทำงาน",
      cBadgePaused: "🔴 พักบอท",
      cAliasPlaceholder: "ตั้งชื่อจอ (เช่น Knight, RM)",
      cAliasTitle: "คลิกเพื่อเปลี่ยนชื่อจอ",
      cSettingsTitle: "ตั้งค่า Proxy, User-Agent, Browser",
      cCloseTitle: "ปิดหน้าจอเกม",
      termTitle: "Console Output & Real-time Logs",
      termSearchPlaceholder: "ค้นหา Logs...",
      filterAll: "ทั้งหมด",
      filterError: "🔴 Error",
      filterWarn: "🟡 Warning",
      filterAction: "🟣 Action",
      filterLog: "🟢 Log",
      filterStep: "🟢 Log",
      btnAutoScroll: "⬇️ Auto-scroll",
      btnClearTerm: "🗑️ ล้าง",
      termToday: "📁 วันนี้: ",
      settingEmergencyHead: "⌨️ Global Emergency Pause Hotkey",
      settingEmergencyKey: "ปุ่มระงับการทำงานฉุกเฉิน",
      settingEmergencyHead: "⌨️ Global Emergency Pause Hotkey",
      settingEmergencyKey: "ปุ่มระงับการทำงานฉุกเฉิน",
      settingEmergencyDesc: "กดเพื่อสั่งหยุดลูป คิวสกิล และปล่อยปุ่มค้างทั้งหมดในเกมทันที (คลิกที่กล่องเพื่อกดบันทึกปุ่มใหม่)",
      settingOverlayHead: "🖥️ Desktop Overlay HUD",
      settingOverlay: "เปิดใช้งาน Desktop Overlay HUD",
      settingOverlayDesc: "แสดงแถบสถานะโปร่งแสงบนหน้าจอเกมแบบ Real-time (เปิด/ปิด อัตโนมัติตามบอท)",
      settingGpuHead: "🚀 Hardware & GPU Acceleration",
      settingGpuTitle: "เร่งความเร็วด้วยการ์ดจอแยก (High-Performance GPU / D3D11)",
      settingGpuDesc: "บังคับให้เบราว์เซอร์ใช้การ์ดจอแยก (NVIDIA/AMD) และ Direct3D 11 Canvas Acceleration ช่วยลดโหลด CPU และลดอาการแลค",
      settingJitterHead: "🛡️ Anti-Detect & Ghost Mouse Jitter",
      settingJitter: "สุ่มหน่วงเวลาการกดปุ่มและขยับเมาส์ (Human Random Jitter)",
      settingJitterDesc: "จำลองพฤติกรรมมนุษย์ด้วยการสุ่มขยับเมาส์เล็กน้อยและหน่วงเวลากดปุ่มเพื่อป้องกันการตรวจจับ",
      settingJitterIntervalTitle: "⏱️ ช่วงเวลาสุ่มขยับเมาส์ (Interval Min - Max)",
      settingJitterIntervalDesc: "ระบบจะสุ่มขยับเมาส์อัตโนมัติทุกๆ ช่วงเวลานี้ (หน่วยเป็น มิลลิวินาที / ms)",
      settingJitterOffsetTitle: "🎯 ระยะการขยับพิกัดเมาส์ (Max Pixel Offset)",
      settingJitterOffsetDesc: "ระยะทางพิกัดที่เมาส์จะสุ่มเคลื่อนที่รอบตำแหน่งเดิม (หน่วยเป็น พิกเซล / px)",
      settingUrlHead: "🌐 Target Game URL Filter",
      settingUrlTitle: "คีย์เวิร์ด URL สำหรับตรวจจับจอเกม",
      settingUrlDesc: "ระบบจะค้นหาแท็บเบราว์เซอร์ที่มีคำนี้เพื่อเชื่อมต่อ CDP อัตโนมัติ",
      settingPortHead: "🔌 Web Server & Dashboard Port",
      settingPortTitle: "พอร์ตสำหรับ Web Dashboard & Studio",
      settingPortDesc: "หมายเลข Port สำหรับ Web Server (ค่าเริ่มต้น: 3088 ป้องกันการชนกับพอร์ต 3000 ของโปรเจกต์อื่น)",
      settingPortNote: "⚡ มีผลเมื่อ Stop แล้ว Start ใหม่ หรือกด Restart Bot Engine",
      btnReloadStudio: "รีโหลด",
      btnBrowserStudio: "เปิดในเบราว์เซอร์",
      lblOfflineHead: "Bot Engine กำลังปิดอยู่ (Server Offline)",
      lblOfflineDesc: "Web Server และระบบบอทยังไม่ได้เริ่มทำงาน กรุณากดปุ่มด้านล่างเพื่อเริ่มใช้งาน Action Node Studio",
      lblOfflineBtn: "เริ่มการทำงาน Bot Engine",
      modalSettingsTitle: "Client Settings",
      modalBrowserLabel: "เลือก Browser Instance",
      modalProxyLabel: "HTTP / SOCKS5 Proxy",
      modalProxyHint: "ใช้แยก IP สำหรับแต่ละจอเพื่อป้องกันการตรวจจับ (IP Detection)",
      modalSaveBtn: "💾 บันทึกการตั้งค่า",
      modalCancelBtn: "ยกเลิก",
      unsavedModalTitle: "ตรวจพบการแก้ไขที่ยังไม่ได้บันทึก",
      unsavedModalDesc: "คุณมีการแก้ไขผังในหน้า <strong>Action Node Studio</strong> ที่ยังไม่ได้กดบันทึก!<br/>หากทำการรีโหลดในตอนนี้ ข้อมูลที่คุณเพิ่งแก้ไขจะสูญหายทันที",
      unsavedModalHintTitle: "คำแนะนำ:",
      unsavedModalHintDesc: "กดปุ่ม <strong>\"ปิด เพื่อกลับไปบันทึกเอง\"</strong> ด้านล่าง แล้วกดปุ่ม 💾 บันทึก (หรือ Ctrl+S) ในหน้า Action Node ก่อนที่จะรีโหลดครับ",
      unsavedModalDiscardBtn: "🔄 ละทิ้งและรีโหลด",
      unsavedModalBackBtn: "✕ ปิด เพื่อกลับไปบันทึกเอง",
      modalUpdateTitle: "ตรวจสอบการอัปเดตระบบ",
      btnUpdateChecking: "กำลังตรวจสอบสถานะและวิเคราะห์ผลกระทบจาก GitHub...",
      btnUpdateCheckErr: "เกิดข้อผิดพลาดในการตรวจสอบ:",
      btnUpdateNoUpdate: "ระบบเป็นเวอร์ชันล่าสุดแล้ว!",
      btnUpdateNoUpdateDesc: "Current Commit: <code>{hash}</code> (เป็นเวอร์ชันล่าสุดแล้ว)",
      btnUpdateHasNewTitle: "มีอัปเดตใหม่พร้อมใช้งาน!",
      btnUpdateDepTitle: "ระบบพร้อมติดตั้ง Library ใหม่อัตโนมัติ",
      btnUpdateDepDesc: "ตรวจพบโมดูลระบบใหม่ ตัวโปรแกรมจะทำการดาวน์โหลดและติดตั้ง Library ใหม่ให้พร้อมใช้งานอัตโนมัติใน Step 2 โดยที่คุณไม่ต้องดาวน์โหลดหรือติดตั้งโปรแกรมใหม่เอง",
      btnUpdateImpactLabel: "ผลกระทบ:",
      btnUpdateLevelLabel: "ระดับการอัปเดต:",
      btnUpdateFilesLabel: "ไฟล์ที่เปลี่ยนแปลงทั้งหมด:",
      btnUpdateFilesMore: "... และอีก {count} ไฟล์",
      btnUpdateDownloading: "กำลังดาวน์โหลดแพ็คเกจและจัดเตรียมความพร้อม...",
      btnUpdateDownloadComplete: "ดาวน์โหลดแพ็คเกจเสร็จสิ้น!",
      btnUpdateDownloadCompleteDesc: "แพ็คเกจถูกเตรียมพร้อมสำหรับการติดตั้งแล้ว คุณสามารถกดปุ่มด้านล่างเพื่อเริ่มการติดตั้งทับไฟล์ live ในระบบได้ทันที",
      btnUpdateDownloadFailed: "การดาวน์โหลดล้มเหลว:",
      btnUpdateApplying: "กำลังแตกไฟล์และเขียนทับข้อมูลเวอร์ชันใหม่...",
      btnUpdateApplyFailed: "การติดตั้งล้มเหลว:",
      btnUpdateCoreComplete: "ติดตั้งระบบหลักเสร็จสมบูรณ์!",
      btnUpdateCoreCompleteDesc: "มีการเปลี่ยนแปลงในไฟล์ระบบหลัก (Core Launcher) จำเป็นต้องรีสตาร์ทตัวโปรแกรมเพื่อให้การตั้งค่าใหม่มีผล",
      btnUpdateCoreDepSuccess: "ติดตั้งโมดูลใหม่สำเร็จ: ระบบได้ติดตั้ง Library ที่จำเป็นเรียบร้อยแล้ว เมื่อรีสตาร์ทโปรแกรมจะพร้อมใช้งานได้ทันที",
      btnUpdateEngineComplete: "อัปเดต Bot Engine เรียบร้อย!",
      btnUpdateEngineCompleteDesc: "ไฟล์คำสั่งและตรรกะของบอทได้รับการอัปเดตแล้ว คุณต้องการรีสตาร์ท Bot Engine ตอนนี้เลยหรือไม่? (หน้าจอเกมจะคงอยู่)",
      btnUpdateUiComplete: "Hot-Reload สำเร็จสมบูรณ์!",
      btnUpdateUiCompleteDesc: "หน้าจอ UI และ Web Dashboard ได้รับการรีเฟรชเป็นเวอร์ชันใหม่เรียบร้อยแล้ว — <strong>บอทและหน้าจอเกมทุกจอทำงานต่อเนื่อง 100% ไม่มีการปิดจอ</strong>",
      btnStep1Download: "📥 Step 1: ดาวน์โหลดแพ็คเกจ",
      btnStep2Apply: "⚡ Step 2: เริ่มการติดตั้งไฟล์",
      btnRelaunchApp: "🚀 รีสตาร์ทโปรแกรมทันที",
      btnRestartEngineNow: "🔄 รีสตาร์ท Engine เดี๋ยวนี้",
      btnLater: "เลื่อนไปก่อน",
      btnRestartLater: "⏳ รีสตาร์ทเองภายหลัง",
      btnDone: "เสร็จสิ้น",
      btnCancel: "ยกเลิก",
      btnClose: "ปิด"
    },
    en: {
      menuMain: "Main Workspace",
      menuConfig: "Configuration",
      navDashboard: "Dashboard",
      navActionNode: "Action Node",
      navSettings: "Settings & HUD",
      breadcrumbDashboard: "Dashboard & Clients",
      breadcrumbStudio: "Action Node Studio",
      breadcrumbSettings: "System Settings & HUD",
      btnLogs: "Logs",
      btnUpdate: "Update",
      btnUpdateHasNew: "Update Available!",
      btnUpdateTooltip: "New update available! Click to inspect and install",
      diagEngineTitle: "SYSTEM STATUS",
      diagServerTitle: "WEB SERVER",
      diagProfileTitle: "ACTIVE PROFILES",
      diagClientsTitle: "DETECTED CLIENTS",
      statusStarting: "Starting...",
      statusStopped: "🔴 Stopped",
      statusRunning: "🟢 Running",
      statusRestarting: "Restarting...",
      btnStartEngine: "Start Bot Engine",
      btnStopEngine: "Stop Bot Engine",
      matrixTitle: "CLIENT CONTROL MATRIX (1 - 8)",
      unitScreens: "Clients",
      btnLaunchAll: "🚀 Launch All",
      btnStopAll: "⏹️ Stop All",
      btnLaunchAllLoading: "⏳ Launching All...",
      cBtnLaunch: "➕ Launch",
      cBtnLaunching: "⏳ Launching...",
      cBtnPause: "⏸️ Pause",
      cBtnPauseTitle: "Temporarily pause skills for this client",
      cBtnResume: "▶️ Resume",
      cBtnResumeTitle: "Resume skills for this client",
      cBadgeOffline: "OFFLINE",
      cBadgeActive: "🟢 ACTIVE",
      cBadgePaused: "🔴 PAUSED",
      cAliasPlaceholder: "Alias (e.g. Knight, RM)",
      cAliasTitle: "Click to rename client alias",
      cSettingsTitle: "Proxy, User-Agent, Browser Settings",
      cCloseTitle: "Close Game Window",
      termTitle: "Console Output & Real-time Logs",
      termSearchPlaceholder: "Search logs...",
      filterAll: "All",
      filterError: "🔴 Error",
      filterWarn: "🟡 Warning",
      filterAction: "🟣 Action",
      filterLog: "🟢 Log",
      filterStep: "🟢 Log",
      btnAutoScroll: "⬇️ Auto-scroll",
      btnClearTerm: "🗑️ Clear",
      termToday: "📁 Today: ",
      settingEmergencyHead: "⌨️ Global Emergency Pause Hotkey",
      settingEmergencyKey: "Emergency Pause Hotkey",
      settingEmergencyDesc: "Instantly release all keys, pause loops, and cancel skill queues in game (Click box to record new key)",
      settingOverlayHead: "🖥️ Desktop Overlay HUD",
      settingOverlay: "Enable Desktop Status Overlay",
      settingOverlayDesc: "Render transparent real-time status overlay HUD over game clients",
      settingGpuHead: "🚀 Hardware & GPU Acceleration",
      settingGpuTitle: "High-Performance GPU Acceleration (Discrete GPU / D3D11)",
      settingGpuDesc: "Force browsers to use dedicated discrete GPU (NVIDIA/AMD) and Direct3D 11 Canvas Acceleration to reduce CPU load and eliminate lag",
      settingJitterHead: "🛡️ Anti-Detect & Ghost Mouse Jitter",
      settingJitter: "Human Random Jitter (Anti-Detect)",
      settingJitterDesc: "Add natural ±15ms human jitter and subtle mouse shifts to prevent bot detection",
      settingJitterIntervalTitle: "⏱️ Random Jitter Interval (Min - Max)",
      settingJitterIntervalDesc: "Subtle mouse shifts will trigger randomly between this time window (in ms)",
      settingJitterOffsetTitle: "🎯 Max Pixel Offset",
      settingJitterOffsetDesc: "Maximum random pixel distance around current cursor position (in px)",
      settingUrlHead: "🌐 Target Game URL Filter",
      settingUrlTitle: "Target URL Keyword for Game Screen Detection",
      settingUrlDesc: "CDP scanner will search for tabs matching this keyword to bind automatically",
      settingPortHead: "🔌 Web Server & Dashboard Port",
      settingPortTitle: "Web Dashboard & Studio Port",
      settingPortDesc: "Port number for the internal web server (Default: 3088 to avoid port 3000 collisions with other dev projects)",
      settingPortNote: "⚡ Takes effect after Restarting or Stopping & Starting the Bot Engine",
      btnReloadStudio: "Reload",
      btnBrowserStudio: "Browser",
      lblOfflineHead: "Bot Engine is Offline",
      lblOfflineDesc: "Web Server and bot processes are stopped. Please start the engine below to use Action Node Studio.",
      lblOfflineBtn: "Start Bot Engine Now",
      modalSettingsTitle: "Client Settings",
      modalBrowserLabel: "Browser Instance Selection",
      modalProxyLabel: "HTTP / SOCKS5 Proxy",
      modalProxyHint: "Separate independent IP per client screen to prevent IP Detection",
      modalSaveBtn: "💾 Save Settings",
      modalCancelBtn: "Cancel",
      unsavedModalTitle: "Unsaved Changes Detected",
      unsavedModalDesc: "You have unsaved changes in <strong>Action Node Studio</strong>!<br/>Reloading right now will discard all your pending changes.",
      unsavedModalHintTitle: "Recommendation:",
      unsavedModalHintDesc: "Click <strong>\"Close to Save Manually\"</strong> below, then click 💾 Save Profile (or press Ctrl+S) in Action Node before reloading.",
      unsavedModalDiscardBtn: "🔄 Discard & Reload",
      unsavedModalBackBtn: "✕ Close to Save Manually",
      modalUpdateTitle: "System Update",
      btnUpdateChecking: "Checking update status and analyzing impact from GitHub...",
      btnUpdateCheckErr: "Error checking for updates:",
      btnUpdateNoUpdate: "System is up to date!",
      btnUpdateNoUpdateDesc: "Current Commit: <code>{hash}</code> (Up to date)",
      btnUpdateHasNewTitle: "Update Available!",
      btnUpdateDepTitle: "Automatic Library & Module Installation",
      btnUpdateDepDesc: "New system modules detected. The launcher will automatically download and install required dependencies in Step 2 with no manual reinstall needed.",
      btnUpdateImpactLabel: "Impact:",
      btnUpdateLevelLabel: "Update Level:",
      btnUpdateFilesLabel: "Total Changed Files:",
      btnUpdateFilesMore: "... and {count} more files",
      btnUpdateDownloading: "Downloading update package and preparing...",
      btnUpdateDownloadComplete: "Package Download Complete!",
      btnUpdateDownloadCompleteDesc: "The update package is ready for installation. Click the button below to apply the update directly to the live system.",
      btnUpdateDownloadFailed: "Download Failed:",
      btnUpdateApplying: "Extracting files and applying update...",
      btnUpdateApplyFailed: "Installation Failed:",
      btnUpdateCoreComplete: "Core System Update Complete!",
      btnUpdateCoreCompleteDesc: "Core Launcher system files have been modified. A full application restart is required for changes to take effect.",
      btnUpdateCoreDepSuccess: "Dependencies Installed: Required libraries were installed successfully and will be loaded upon restart.",
      btnUpdateEngineComplete: "Bot Engine Updated!",
      btnUpdateEngineCompleteDesc: "Bot logic and scripts have been updated. Would you like to restart the Bot Engine now? (Active game clients remain running)",
      btnUpdateUiComplete: "Hot-Reload Complete!",
      btnUpdateUiCompleteDesc: "UI and Web Dashboard have been refreshed to the latest version — <strong>Bots and game clients continue running 100% uninterrupted.</strong>",
      btnStep1Download: "📥 Step 1: Download Package",
      btnStep2Apply: "⚡ Step 2: Apply Update",
      btnRelaunchApp: "🚀 Restart App Now",
      btnRestartEngineNow: "🔄 Restart Engine Now",
      btnLater: "Later",
      btnRestartLater: "⏳ Restart Later",
      btnDone: "Done",
      btnCancel: "Cancel",
      btnClose: "Close"
    }
  };

  let currentLang = localStorage.getItem('nodehotkey_lang') || 'th';

  function applyLanguage(lang) {
    currentLang = lang;
    try { localStorage.setItem('nodehotkey_lang', lang); } catch (e) {}
    const t = i18nDict[lang] || i18nDict.th;
    
    // Update breadcrumbs
    if (breadcrumbEl) {
      if (currentView === 'dashboard') breadcrumbEl.textContent = t.breadcrumbDashboard;
      else if (currentView === 'editor') breadcrumbEl.textContent = t.breadcrumbStudio;
      else if (currentView === 'settings') breadcrumbEl.textContent = t.breadcrumbSettings;
    }

    // Update Studio Topbar Buttons
    const lblReload = document.getElementById('lbl-reload-studio');
    const lblBrowser = document.getElementById('lbl-browser-studio');
    if (lblReload) lblReload.textContent = t.btnReloadStudio;
    if (lblBrowser) lblBrowser.textContent = t.btnBrowserStudio;

    // Update Quick Action Tools (Logs & Update Pill)
    const lblLogs = document.querySelector('#btn-open-logs span:last-child');
    if (lblLogs) lblLogs.textContent = t.btnLogs || 'Logs';
    renderUpdateToolButton(!!detectedUpdateInfo, detectedUpdateInfo);

    // Update Offline Placeholder
    const lblOffHead = document.getElementById('lbl-offline-head');
    const lblOffDesc = document.getElementById('lbl-offline-desc');
    const lblOffBtn = document.getElementById('lbl-offline-btn');
    if (lblOffHead) lblOffHead.textContent = t.lblOfflineHead;
    if (lblOffDesc) lblOffDesc.textContent = t.lblOfflineDesc;
    if (lblOffBtn) lblOffBtn.textContent = t.lblOfflineBtn;

    // Update Language Pills
    if (btnLangTh) btnLangTh.className = `btn-lang-toggle ${lang === 'th' ? 'active' : ''}`;
    if (btnLangEn) btnLangEn.className = `btn-lang-toggle ${lang === 'en' ? 'active' : ''}`;

    // Update Diagnostics Cards Titles
    const dEngine = document.querySelector('#card-engine-status .diag-title');
    const dServer = document.querySelector('#card-server-status .diag-title');
    const dProfile = document.querySelector('#card-profile-status .diag-title');
    const dClients = document.querySelector('#card-clients-status .diag-title');
    if (dEngine) dEngine.textContent = t.diagEngineTitle;
    if (dServer) dServer.textContent = t.diagServerTitle;
    if (dProfile) dProfile.textContent = t.diagProfileTitle;
    if (dClients) dClients.textContent = t.diagClientsTitle;
    if (cachedActiveProfiles && cachedActiveProfiles.length > 0) {
      renderActiveProfiles(cachedActiveProfiles);
    } else {
      renderActiveProfiles([]);
    }

    // Update Matrix Title & Buttons
    const matrixTitle = document.getElementById('matrix-title-label');
    if (matrixTitle) matrixTitle.textContent = t.matrixTitle;

    const launchAllBtn = document.getElementById('btn-matrix-launch-all');
    const stopAllBtn = document.getElementById('btn-matrix-stop-all');
    if (launchAllBtn && !isLaunchingAll) launchAllBtn.textContent = t.btnLaunchAll;
    if (stopAllBtn) stopAllBtn.textContent = t.btnStopAll;

    // Update Hero Toggle Button
    if (!isRunning && heroTitle) heroTitle.textContent = t.btnStartEngine;
    if (isRunning && heroTitle) heroTitle.textContent = t.btnStopEngine;

    // Update Terminal Elements
    const termTitleEl = document.querySelector('.terminal-title-group .term-title');
    if (termTitleEl) termTitleEl.textContent = t.termTitle;
    const searchInput = document.getElementById('log-search-input');
    if (searchInput) searchInput.placeholder = t.termSearchPlaceholder;
    const clearBtn = document.getElementById('btn-clear-terminal');
    if (clearBtn) clearBtn.textContent = t.btnClearTerm;
    const pillLog = document.querySelector('.filter-pill[data-filter="log"]') || document.querySelector('.filter-pill[data-filter="step"]');
    if (pillLog) pillLog.textContent = t.filterLog || t.filterStep || '🟢 Log';

    // Update Settings View Elements
    const lblHeadEm = document.getElementById('lbl-setting-head-emergency');
    const lblKeyTitle = document.getElementById('lbl-setting-key-title');
    const lblKeyDesc = document.getElementById('lbl-setting-key-desc');
    const lblHeadOv = document.getElementById('lbl-setting-head-overlay');
    const lblOvTitle = document.getElementById('lbl-setting-overlay-title');
    const lblOvDesc = document.getElementById('lbl-setting-overlay-desc');
    const lblHeadJit = document.getElementById('lbl-setting-head-jitter');
    const lblJitTitle = document.getElementById('lbl-setting-jitter-title');
    const lblJitDesc = document.getElementById('lbl-setting-jitter-desc');
    const lblJitIntTitle = document.getElementById('lbl-jitter-interval-title');
    const lblJitIntDesc = document.getElementById('lbl-jitter-interval-desc');
    const lblJitOffTitle = document.getElementById('lbl-jitter-offset-title');
    const lblJitOffDesc = document.getElementById('lbl-jitter-offset-desc');
    const lblHeadUrl = document.getElementById('lbl-setting-head-url');
    const lblUrlTitle = document.getElementById('lbl-setting-url-title');
    const lblUrlDesc = document.getElementById('lbl-setting-url-desc');

    if (lblHeadEm) lblHeadEm.textContent = t.settingEmergencyHead;
    if (lblKeyTitle) lblKeyTitle.textContent = t.settingEmergencyKey;
    if (lblKeyDesc) lblKeyDesc.textContent = t.settingEmergencyDesc;
    if (lblHeadOv) lblHeadOv.textContent = t.settingOverlayHead;
    if (lblOvTitle) lblOvTitle.textContent = t.settingOverlay;
    if (lblOvDesc) lblOvDesc.textContent = t.settingOverlayDesc;
    const lblHeadGpu = document.getElementById('lbl-setting-head-gpu');
    const lblGpuTitle = document.getElementById('lbl-setting-gpu-title');
    const lblGpuDesc = document.getElementById('lbl-setting-gpu-desc');
    if (lblHeadGpu) lblHeadGpu.textContent = t.settingGpuHead;
    if (lblGpuTitle) lblGpuTitle.textContent = t.settingGpuTitle;
    if (lblGpuDesc) lblGpuDesc.textContent = t.settingGpuDesc;
    if (lblHeadJit) lblHeadJit.textContent = t.settingJitterHead;
    if (lblJitTitle) lblJitTitle.textContent = t.settingJitter;
    if (lblJitDesc) lblJitDesc.textContent = t.settingJitterDesc;
    if (lblJitIntTitle) lblJitIntTitle.textContent = t.settingJitterIntervalTitle;
    if (lblJitIntDesc) lblJitIntDesc.textContent = t.settingJitterIntervalDesc;
    if (lblJitOffTitle) lblJitOffTitle.textContent = t.settingJitterOffsetTitle;
    if (lblJitOffDesc) lblJitOffDesc.textContent = t.settingJitterOffsetDesc;
    if (lblHeadUrl) lblHeadUrl.textContent = t.settingUrlHead;
    if (lblUrlTitle) lblUrlTitle.textContent = t.settingUrlTitle;
    if (lblUrlDesc) lblUrlDesc.textContent = t.settingUrlDesc;
    const lblHeadPort = document.getElementById('lbl-setting-head-port');
    const lblPortTitle = document.getElementById('lbl-setting-port-title');
    const lblPortDesc = document.getElementById('lbl-setting-port-desc');
    const lblPortNote = document.getElementById('lbl-setting-port-restart-note');
    if (lblHeadPort) lblHeadPort.textContent = t.settingPortHead;
    if (lblPortTitle) lblPortTitle.textContent = t.settingPortTitle;
    if (lblPortDesc) lblPortDesc.textContent = t.settingPortDesc;
    if (lblPortNote) lblPortNote.textContent = t.settingPortNote;

    // Update Unsaved Changes Modal text
    const lblUnsavedTitle = document.getElementById('lbl-unsaved-modal-title');
    const lblUnsavedDesc = document.getElementById('lbl-unsaved-modal-desc');
    const lblUnsavedHintTitle = document.getElementById('lbl-unsaved-modal-hint-title');
    const lblUnsavedHintDesc = document.getElementById('lbl-unsaved-modal-hint-desc');
    const btnUnsavedDiscard = document.getElementById('btn-unsaved-discard');
    const btnUnsavedBack = document.getElementById('btn-unsaved-back');
    if (lblUnsavedTitle) lblUnsavedTitle.textContent = t.unsavedModalTitle;
    if (lblUnsavedDesc) lblUnsavedDesc.innerHTML = t.unsavedModalDesc;
    if (lblUnsavedHintTitle) lblUnsavedHintTitle.textContent = t.unsavedModalHintTitle;
    if (lblUnsavedHintDesc) lblUnsavedHintDesc.innerHTML = t.unsavedModalHintDesc;
    if (btnUnsavedDiscard) btnUnsavedDiscard.textContent = t.unsavedModalDiscardBtn;
    if (btnUnsavedBack) btnUnsavedBack.textContent = t.unsavedModalBackBtn;

    // Update Filter Pills
    filterPills.forEach(pill => {
      const f = pill.dataset.filter;
      if (f === 'all') pill.textContent = t.filterAll;
      else if (f === 'error') pill.textContent = t.filterError;
      else if (f === 'warn') pill.textContent = t.filterWarn;
      else if (f === 'action') pill.textContent = t.filterAction;
      else if (f === 'log' || f === 'step') pill.textContent = t.filterLog || t.filterStep || '🟢 Log';
    });

    // Update Update Modal Title
    const lblUpdateModalTitle = document.getElementById('lbl-update-modal-title');
    if (lblUpdateModalTitle) lblUpdateModalTitle.textContent = t.modalUpdateTitle || 'System Update';

    // If Update Modal is open, re-render its content in the newly selected language
    if (updateModal && updateModal.style.display === 'flex' && currentModalState) {
      if (currentModalState.type === 'step1_result' && currentModalState.data) {
        renderStep1CheckResult(currentModalState.data);
      } else if (currentModalState.type === 'download_complete' && currentModalState.data) {
        const impact = currentModalState.data.impact || (currentUpdateCheck && currentUpdateCheck.impact) || {};
        const isEn = lang === 'en';
        const badgeText = (isEn ? impact.badge_en : impact.badge_th) || impact.badge || '';
        const titleText = (isEn ? impact.title_en : impact.title_th) || impact.title || (isEn ? 'Live Application Update' : 'อัปเดตแอปพลิเคชัน');
        updateModalBody.innerHTML = `
          ${renderWizardSteps(2)}
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <div style="color:#10b981; font-weight:700; font-size:13px;">✅ ${t.btnUpdateDownloadComplete}</div>
            ${badgeText ? `<span class="impact-badge ${impact.badgeClass}">${badgeText}</span>` : ''}
          </div>
          <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5;">
            ${t.btnUpdateDownloadCompleteDesc}
          </div>
          <div style="margin-top:10px; font-size:11px; color:#94a3b8;">
            ⚙️ <strong>${t.btnUpdateLevelLabel}</strong> ${titleText}
          </div>
        `;
        btnPerformUpdate.textContent = t.btnStep2Apply;
        btnCancelUpdate.textContent = t.btnCancel;
      } else if (currentModalState.type === 'apply_complete') {
        const impact = currentModalState.impact || { level: 1 };
        if (impact.level === 3) {
          updateModalBody.innerHTML = `
            ${renderWizardSteps(3)}
            <div style="color:#f87171; font-weight:700; font-size:13px; margin-bottom:6px;">🚀 ${t.btnUpdateCoreComplete}</div>
            <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5;">${t.btnUpdateCoreCompleteDesc}</div>
            ${impact.hasDependencyChanges ? `
              <div style="margin-top:8px; background:rgba(16, 185, 129, 0.12); border:1px solid rgba(16, 185, 129, 0.3); border-radius:6px; padding:8px 10px; font-size:11px; color:#6ee7b7; line-height:1.4;">
                ✅ <strong>${t.btnUpdateCoreDepSuccess}</strong>
              </div>
            ` : ''}
          `;
          btnPerformUpdate.textContent = t.btnRelaunchApp;
          btnCancelUpdate.textContent = t.btnLater;
        } else if (impact.level === 2) {
          updateModalBody.innerHTML = `
            ${renderWizardSteps(3)}
            <div style="color:#fbbf24; font-weight:700; font-size:13px; margin-bottom:6px;">🟡 ${t.btnUpdateEngineComplete}</div>
            <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5;">${t.btnUpdateEngineCompleteDesc}</div>
          `;
          btnPerformUpdate.textContent = t.btnRestartEngineNow;
          btnCancelUpdate.textContent = t.btnRestartLater;
        } else {
          updateModalBody.innerHTML = `
            ${renderWizardSteps(3)}
            <div style="color:#34d399; font-weight:700; font-size:13px; margin-bottom:6px;">✨ ${t.btnUpdateUiComplete}</div>
            <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5;">${t.btnUpdateUiCompleteDesc}</div>
          `;
          btnCancelUpdate.textContent = t.btnDone;
        }
      }
    }

    // Re-render Client Cards in active language
    renderLauncherClientCards(cachedStatus, cachedConfig);

    // Propagate language switch to iframe Studio Canvas (via postMessage & direct call)
    if (editorFrame && editorFrame.contentWindow) {
      try {
        editorFrame.contentWindow.postMessage({ type: 'NODEHOTKEY_CHANGE_LANG', lang: lang }, '*');
      } catch (e) {}
      try {
        if (typeof editorFrame.contentWindow.changeLang === 'function') {
          editorFrame.contentWindow.changeLang(lang);
        }
      } catch (e) {}
    }
  }

  if (editorFrame) {
    editorFrame.addEventListener('load', () => {
      isStudioDirty = false;
      try {
        editorFrame.contentWindow.postMessage({ type: 'NODEHOTKEY_CHANGE_LANG', lang: currentLang }, '*');
      } catch (e) {}
    });
  }

  if (btnLangTh) btnLangTh.onclick = () => applyLanguage('th');
  if (btnLangEn) btnLangEn.onclick = () => applyLanguage('en');

  // 4. Global Settings System (Load, Auto-Save, Hotkey Recording)
  let isRecordingKey = false;

  window.toggleJitterSubSettings = function() {
    const jitterCb = document.getElementById('setting-enable-jitter');
    const subPanel = document.getElementById('jitter-sub-settings');
    if (jitterCb && subPanel) {
      subPanel.style.display = jitterCb.checked ? 'flex' : 'none';
    }
  };

  function loadSettingsToUI(config) {
    if (!config || !config.globalSettings) return;
    const gs = config.globalSettings;

    const suspendKeyInput = document.getElementById('setting-suspend-key');
    const overlayCb = document.getElementById('setting-enable-overlay');
    const jitterCb = document.getElementById('setting-enable-jitter');
    const jitterMin = document.getElementById('setting-jitter-min');
    const jitterMax = document.getElementById('setting-jitter-max');
    const jitterOffset = document.getElementById('setting-jitter-offset');
    const targetUrlInput = document.getElementById('setting-target-url');

    if (suspendKeyInput && !isRecordingKey) {
      suspendKeyInput.value = gs.suspendHotkey || 'END';
    }
    if (overlayCb) {
      overlayCb.checked = !!gs.enableOverlay;
    }
    const gpuCb = document.getElementById('setting-gpu-acceleration');
    if (gpuCb) {
      gpuCb.checked = gs.gpuAcceleration !== false;
    }
    if (jitterCb) {
      const gmj = gs.ghostMouseJitter || {};
      jitterCb.checked = !!gmj.enabled;
      window.toggleJitterSubSettings();

      if (jitterMin && document.activeElement !== jitterMin) {
        jitterMin.value = gmj.intervalMin || 8000;
      }
      if (jitterMax && document.activeElement !== jitterMax) {
        jitterMax.value = gmj.intervalMax || 25000;
      }
      if (jitterOffset && document.activeElement !== jitterOffset) {
        jitterOffset.value = gmj.maxOffset || 12;
      }
    }
    if (targetUrlInput && document.activeElement !== targetUrlInput) {
      targetUrlInput.value = gs.targetUrlKeyword || 'universe.flyff.com';
    }
    const portInput = document.getElementById('setting-web-port');
    if (portInput && document.activeElement !== portInput) {
      portInput.value = gs.webPort || 3088;
    }
  }

  window.saveSettingsFromUI = async function() {
    try {
      const suspendKeyInput = document.getElementById('setting-suspend-key');
      const overlayCb = document.getElementById('setting-enable-overlay');
      const gpuCb = document.getElementById('setting-gpu-acceleration');
      const jitterCb = document.getElementById('setting-enable-jitter');
      const jitterMin = document.getElementById('setting-jitter-min');
      const jitterMax = document.getElementById('setting-jitter-max');
      const jitterOffset = document.getElementById('setting-jitter-offset');
      const targetUrlInput = document.getElementById('setting-target-url');
      const portInput = document.getElementById('setting-web-port');

      const newSettings = {};
      if (suspendKeyInput) newSettings.suspendHotkey = suspendKeyInput.value.trim() || 'END';
      if (overlayCb) newSettings.enableOverlay = overlayCb.checked;
      if (gpuCb) newSettings.gpuAcceleration = gpuCb.checked;
      if (jitterCb) {
        newSettings.ghostMouseJitter = {
          enabled: jitterCb.checked,
          intervalMin: parseInt(jitterMin ? jitterMin.value : 8000, 10) || 8000,
          intervalMax: parseInt(jitterMax ? jitterMax.value : 25000, 10) || 25000,
          maxOffset: parseInt(jitterOffset ? jitterOffset.value : 12, 10) || 12
        };
      }
      if (targetUrlInput) newSettings.targetUrlKeyword = targetUrlInput.value.trim() || 'universe.flyff.com';
      if (portInput) {
        const p = parseInt(portInput.value, 10);
        if (!isNaN(p) && p >= 1024 && p <= 65535) {
          newSettings.webPort = p;
        }
      }

      // 1. Persist directly to configs/global.json via IPC (works even when bot is stopped!)
      if (api && typeof api.saveGlobalSettings === 'function') {
        await api.saveGlobalSettings(newSettings);
      }

      // Update local memory cache
      if (!cachedConfig) cachedConfig = { globalSettings: {} };
      if (!cachedConfig.globalSettings) cachedConfig.globalSettings = {};
      Object.assign(cachedConfig.globalSettings, newSettings);

      // 2. If server is actively running, sync changes to running process via HTTP
      if (isServerOnline) {
        try {
          await fetch(getServerUrl('/api/config'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cachedConfig)
          });
        } catch (postErr) {
          console.warn('Could not post to active server HTTP endpoint:', postErr);
        }
      }
    } catch (e) {
      console.warn('Failed to save global settings:', e);
    }
  };

  window.startRecordingSuspendKey = function() {
    const input = document.getElementById('setting-suspend-key');
    if (!input) return;
    isRecordingKey = true;
    input.value = '...กดปุ่ม...';
    input.style.borderColor = '#eab308';
    input.style.color = '#fde047';

    const onKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      let keyName = e.key.toUpperCase();
      if (keyName === 'ESCAPE') {
        input.value = (cachedConfig && cachedConfig.globalSettings && cachedConfig.globalSettings.suspendHotkey) || 'END';
      } else {
        if (keyName === ' ') keyName = 'SPACE';
        input.value = keyName;
        window.saveSettingsFromUI();
      }

      input.style.borderColor = '#3b82f6';
      input.style.color = '#60a5fa';
      isRecordingKey = false;
      window.removeEventListener('keydown', onKeyDown, true);
    };

    window.addEventListener('keydown', onKeyDown, true);
  };

  window.clearSuspendKey = function() {
    const input = document.getElementById('setting-suspend-key');
    if (input) {
      input.value = 'NONE';
      window.saveSettingsFromUI();
    }
  };

  // ══════════════════════════════════════════════════════════
  // 4.1 LAUNCHER VISUAL KEY PICKER & MECHANICAL KEYBOARD
  // ══════════════════════════════════════════════════════════
  let launcherSelectedModifiers = new Set();
  let launcherSelectedKeys = [];
  let launcherIsManualMode = false;

  function renderLauncherKeyboardUI() {
    const previewEl = document.getElementById('launcher-vk-preview');
    const manualInput = document.getElementById('launcher-vk-manual-input');
    const manualArea = document.getElementById('launcher-vk-manual-area');
    const pickerArea = document.getElementById('launcher-vk-picker-area');
    const toggleBtn = document.getElementById('btn-vk-toggle-manual');

    // Build combination string
    let comboParts = [];
    if (launcherSelectedModifiers.has('CTRL')) comboParts.push('CTRL');
    if (launcherSelectedModifiers.has('LEFT ALT') || launcherSelectedModifiers.has('ALT')) comboParts.push('ALT');
    if (launcherSelectedModifiers.has('SHIFT')) comboParts.push('SHIFT');
    if (launcherSelectedKeys.length > 0) comboParts.push(launcherSelectedKeys.join(' + '));

    const finalVal = comboParts.join(' + ') || 'NONE';
    if (previewEl) previewEl.textContent = finalVal;
    if (manualInput && document.activeElement !== manualInput) manualInput.value = finalVal === 'NONE' ? '' : finalVal;

    // Toggle active modifier button highlight
    const modal = document.getElementById('launcher-key-picker-modal');
    if (modal) {
      modal.querySelectorAll('.vk-mod-btn').forEach(btn => {
        const mod = btn.dataset.mod;
        if (launcherSelectedModifiers.has(mod)) btn.classList.add('active');
        else btn.classList.remove('active');
      });
    }

    if (manualArea && pickerArea && toggleBtn) {
      manualArea.style.display = launcherIsManualMode ? 'flex' : 'none';
      pickerArea.style.display = launcherIsManualMode ? 'none' : 'flex';
      toggleBtn.textContent = launcherIsManualMode ? '⌨️ Switch to Keyboard Picker' : '✏️ Switch to Manual Typing';
    }
  }

  window.openLauncherKeyPicker = function() {
    launcherSelectedModifiers.clear();
    launcherSelectedKeys = [];
    launcherIsManualMode = false;

    const input = document.getElementById('setting-suspend-key');
    const currentVal = input ? input.value.trim() : 'END';

    if (currentVal && currentVal !== 'NONE' && currentVal !== '...กดปุ่ม...') {
      const parts = currentVal.split('+').map(s => s.trim()).filter(Boolean);
      parts.forEach(p => {
        const upper = p.toUpperCase();
        if (['CTRL', 'LEFT CTRL', 'RIGHT CTRL'].includes(upper)) launcherSelectedModifiers.add('CTRL');
        else if (['ALT', 'LEFT ALT', 'RIGHT ALT'].includes(upper)) launcherSelectedModifiers.add('LEFT ALT');
        else if (['SHIFT', 'LEFT SHIFT', 'RIGHT SHIFT'].includes(upper)) launcherSelectedModifiers.add('SHIFT');
        else launcherSelectedKeys.push(upper);
      });
    }

    renderLauncherKeyboardUI();

    const modal = document.getElementById('launcher-key-picker-modal');
    if (modal) modal.style.display = 'flex';
  };

  window.closeLauncherKeyPicker = function() {
    const modal = document.getElementById('launcher-key-picker-modal');
    if (modal) modal.style.display = 'none';
  };

  window.toggleLauncherManualMode = function() {
    launcherIsManualMode = !launcherIsManualMode;
    renderLauncherKeyboardUI();
  };

  window.toggleLauncherModifier = function(mod) {
    if (launcherSelectedModifiers.has(mod)) launcherSelectedModifiers.delete(mod);
    else launcherSelectedModifiers.add(mod);
    renderLauncherKeyboardUI();
  };

  window.pressLauncherVirtualKey = function(key) {
    launcherSelectedKeys = [key]; // Single main key for emergency pause
    renderLauncherKeyboardUI();
  };

  window.popLauncherVirtualKey = function() {
    if (launcherSelectedKeys.length > 0) {
      launcherSelectedKeys.pop();
    } else if (launcherSelectedModifiers.size > 0) {
      launcherSelectedModifiers.clear();
    }
    renderLauncherKeyboardUI();
  };

  window.clearLauncherVirtualKey = function() {
    launcherSelectedModifiers.clear();
    launcherSelectedKeys = [];
    renderLauncherKeyboardUI();
  };

  window.onLauncherManualInput = function(val) {
    const previewEl = document.getElementById('launcher-vk-preview');
    if (previewEl) previewEl.textContent = val.trim() || 'NONE';
  };

  window.applyLauncherKeyPicker = function() {
    const previewEl = document.getElementById('launcher-vk-preview');
    const input = document.getElementById('setting-suspend-key');
    if (previewEl && input) {
      const chosenKey = previewEl.textContent.trim() || 'END';
      input.value = chosenKey;
      window.saveSettingsFromUI();
    }
    window.closeLauncherKeyPicker();
  };

  // 4. Client Matrix System (Launch, Close, Pause/Resume, Alias, Settings)
  let cachedConfig = null;
  let cachedStatus = null;
  const launchingClients = new Set();
  let isLaunchingAll = false;

  window.launchClient = async function(clientIdx) {
    if (launchingClients.has(clientIdx)) return;
    launchingClients.add(clientIdx);
    renderLauncherClientCards(cachedStatus, cachedConfig);

    try {
      const gs = (cachedConfig && cachedConfig.globalSettings) || {};
      const browsers = gs.clientBrowsers || {};
      const browserChoice = browsers[String(clientIdx)] || '1';

      await fetch(getServerUrl('/api/client/launch'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIndex: clientIdx, browserChoice })
      });
      syncBackendStatus();
    } catch (e) {
      console.warn('Cannot launch client:', e);
    } finally {
      setTimeout(() => {
        launchingClients.delete(clientIdx);
        renderLauncherClientCards(cachedStatus, cachedConfig);
      }, 2500);
    }
  };

  window.closeClient = async function(clientIdx) {
    try {
      await fetch(getServerUrl('/api/client/close'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIndex: clientIdx })
      });
      syncBackendStatus();
    } catch (e) {
      console.warn('Cannot close client:', e);
    }
  };

  window.toggleClientPause = async function(clientIdx) {
    try {
      await fetch(getServerUrl('/api/client/toggle-enable'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIndex: clientIdx })
      });
      syncBackendStatus();
    } catch (e) {
      console.warn('Cannot toggle client enable:', e);
    }
  };

  window.saveClientAlias = async function(clientIdx, newAlias) {
    try {
      if (!cachedConfig) {
        const res = await fetch(getServerUrl('/api/config'));
        cachedConfig = await res.json();
      }
      if (!cachedConfig.globalSettings) cachedConfig.globalSettings = {};
      if (!cachedConfig.globalSettings.clientAliases) cachedConfig.globalSettings.clientAliases = {};
      cachedConfig.globalSettings.clientAliases[String(clientIdx)] = (newAlias || '').trim();

      await fetch(getServerUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cachedConfig)
      });
      syncBackendStatus();
    } catch (e) {
      console.warn('Failed to save client alias:', e);
    }
  };

  // User-Agent Pool for Anti-Detect
  const USER_AGENT_POOL = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  ];

  window.randomizeModalUA = function() {
    const uaInput = document.getElementById('modal-client-ua');
    if (uaInput) {
      const rand = USER_AGENT_POOL[Math.floor(Math.random() * USER_AGENT_POOL.length)];
      uaInput.value = rand;
    }
  };

  window.clearModalUA = function() {
    const uaInput = document.getElementById('modal-client-ua');
    if (uaInput) uaInput.value = '';
  };

  window.clearModalProxy = function() {
    const proxyInput = document.getElementById('modal-client-proxy');
    if (proxyInput) proxyInput.value = '';
  };

  window.openClientSettingsModal = function(clientIdx) {
    const modal = document.getElementById('client-settings-modal');
    const nameSpan = document.getElementById('client-settings-modal-name');
    const idxInput = document.getElementById('modal-client-idx');
    const browserSelect = document.getElementById('modal-client-browser');
    const proxyInput = document.getElementById('modal-client-proxy');
    const uaInput = document.getElementById('modal-client-ua');

    if (!modal) return;
    idxInput.value = clientIdx;
    
    const gs = (cachedConfig && cachedConfig.globalSettings) || {};
    const aliases = gs.clientAliases || {};
    const alias = aliases[String(clientIdx)] || `Client ${clientIdx}`;
    if (nameSpan) nameSpan.textContent = `Client ${clientIdx} Settings (${alias})`;

    const browsers = gs.clientBrowsers || {};
    const proxies = gs.clientProxies || {};
    const uas = gs.clientUserAgents || {};

    if (browserSelect) browserSelect.value = browsers[String(clientIdx)] || '1';
    if (proxyInput) proxyInput.value = proxies[String(clientIdx)] || '';
    if (uaInput) uaInput.value = uas[String(clientIdx)] || '';

    const boundsInfo = document.getElementById('modal-client-bounds-info');
    const boundsMap = gs.clientWindowBounds || {};
    const bounds = boundsMap[String(clientIdx)];
    if (boundsInfo) {
      if (bounds && typeof bounds.x === 'number' && typeof bounds.y === 'number') {
        const w = bounds.width || bounds.w || 960;
        const h = bounds.height || bounds.h || 540;
        boundsInfo.textContent = `X: ${bounds.x}, Y: ${bounds.y} (${w}x${h})`;
        boundsInfo.style.color = '#38bdf8';
      } else {
        boundsInfo.textContent = 'Default (Auto / กลางจอหลัก)';
        boundsInfo.style.color = '#94a3b8';
      }
    }

    modal.style.display = 'flex';
  };

  window.closeClientSettingsModal = function() {
    const modal = document.getElementById('client-settings-modal');
    if (modal) modal.style.display = 'none';
  };

  window.resetModalWindowBounds = async function() {
    const idxInput = document.getElementById('modal-client-idx');
    const resetBtn = document.getElementById('btn-modal-reset-bounds');
    const boundsInfo = document.getElementById('modal-client-bounds-info');
    if (!idxInput) return;
    const clientIdx = parseInt(idxInput.value, 10);

    try {
      if (!cachedConfig) {
        const res = await fetch(getServerUrl('/api/config'));
        cachedConfig = await res.json();
      }
      if (cachedConfig.globalSettings && cachedConfig.globalSettings.clientWindowBounds) {
        delete cachedConfig.globalSettings.clientWindowBounds[String(clientIdx)];
      }

      await fetch(getServerUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cachedConfig)
      });

      await fetch(getServerUrl('/api/client/reset-bounds'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIndex: clientIdx })
      });

      if (boundsInfo) {
        boundsInfo.textContent = 'Default (Auto / กลางจอหลัก)';
        boundsInfo.style.color = '#94a3b8';
      }
      if (resetBtn) {
        const originalText = resetBtn.textContent;
        resetBtn.textContent = '✓ Reset แล้ว!';
        resetBtn.style.color = '#34d399';
        resetBtn.style.borderColor = '#34d399';
        setTimeout(() => {
          resetBtn.textContent = originalText;
          resetBtn.style.color = '#f59e0b';
          resetBtn.style.borderColor = '#f59e0b';
        }, 1800);
      }
    } catch (e) {
      console.warn('Failed to reset bounds:', e);
      if (boundsInfo) {
        boundsInfo.textContent = 'Default (Auto / กลางจอหลัก)';
      }
    }
  };

  window.saveClientSettingsFromModal = async function() {
    const idxInput = document.getElementById('modal-client-idx');
    const browserSelect = document.getElementById('modal-client-browser');
    const proxyInput = document.getElementById('modal-client-proxy');
    const uaInput = document.getElementById('modal-client-ua');
    if (!idxInput) return;

    const clientIdx = String(idxInput.value);
    try {
      if (!cachedConfig) {
        const res = await fetch(getServerUrl('/api/config'));
        cachedConfig = await res.json();
      }
      if (!cachedConfig.globalSettings) cachedConfig.globalSettings = {};
      const gs = cachedConfig.globalSettings;
      if (!gs.clientBrowsers) gs.clientBrowsers = {};
      if (!gs.clientProxies) gs.clientProxies = {};
      if (!gs.clientUserAgents) gs.clientUserAgents = {};

      if (browserSelect) gs.clientBrowsers[clientIdx] = browserSelect.value;
      if (proxyInput) gs.clientProxies[clientIdx] = proxyInput.value.trim();
      if (uaInput) gs.clientUserAgents[clientIdx] = uaInput.value.trim();

      await fetch(getServerUrl('/api/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cachedConfig)
      });

      closeClientSettingsModal();
      syncBackendStatus();
    } catch (e) {
      console.warn('Failed to save client settings:', e);
    }
  };

  window.launchAllClients = async function() {
    if (isLaunchingAll) return;
    isLaunchingAll = true;
    const t = i18nDict[currentLang] || i18nDict.th;
    const launchAllBtn = document.getElementById('btn-matrix-launch-all');
    if (launchAllBtn) {
      launchAllBtn.textContent = t.btnLaunchAllLoading;
      launchAllBtn.style.pointerEvents = 'none';
      launchAllBtn.style.opacity = '0.7';
    }

    for (let i = 1; i <= 8; i++) {
      launchingClients.add(i);
    }
    renderLauncherClientCards(cachedStatus, cachedConfig);

    for (let i = 1; i <= 8; i++) {
      try {
        const gs = (cachedConfig && cachedConfig.globalSettings) || {};
        const browsers = gs.clientBrowsers || {};
        const browserChoice = browsers[String(i)] || '1';

        fetch(getServerUrl('/api/client/launch'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientIndex: i, browserChoice })
        }).catch(() => {});
      } catch (e) {}
    }

    setTimeout(() => {
      isLaunchingAll = false;
      launchingClients.clear();
      if (launchAllBtn) {
        const curT = i18nDict[currentLang] || i18nDict.th;
        launchAllBtn.textContent = curT.btnLaunchAll;
        launchAllBtn.style.pointerEvents = 'auto';
        launchAllBtn.style.opacity = '1';
      }
      syncBackendStatus();
    }, 3000);
  };

  window.stopAllClients = async function() {
    for (let i = 1; i <= 8; i++) {
      try {
        fetch(getServerUrl('/api/client/close'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientIndex: i })
        }).catch(() => {});
      } catch (e) {}
    }
    setTimeout(syncBackendStatus, 1000);
  };

  function renderLauncherClientCards(data, config) {
    const grid = document.getElementById('launcher-client-matrix-grid');
    if (!grid) return;

    const t = i18nDict[currentLang] || i18nDict.th;
    const activeList = (data && data.activeClients) ? data.activeClients.map(String) : [];
    const disabledList = (data && data.disabledClients) ? data.disabledClients.map(String) : [];
    const gs = (config && config.globalSettings) || {};
    const aliases = gs.clientAliases || (data && data.clientAliases) || {};
    const browsers = gs.clientBrowsers || {};

    let html = '';
    for (let i = 1; i <= 8; i++) {
      const sIdx = String(i);
      const alias = aliases[sIdx] || aliases[i] || '';
      const isActive = activeList.includes(sIdx);
      const isPaused = disabledList.includes(sIdx);
      const isLaunching = launchingClients.has(i);

      const browserCode = browsers[sIdx] || '1';
      let bIcon = '🌐';
      if (browserCode === '2' || browserCode === '2-app') bIcon = '🌊';
      else if (browserCode === '3') bIcon = '🦊';

      let statusBadge = `<span class="c-tile-badge offline">${t.cBadgeOffline}</span>`;
      let tileClass = 'c-matrix-tile';
      let actionButtons = isLaunching
        ? `<button class="btn-c-action launch" style="opacity:0.7; pointer-events:none;">${t.cBtnLaunching}</button>`
        : `<button class="btn-c-action launch" onclick="launchClient(${i})">${t.cBtnLaunch}</button>`;

      if (isActive) {
        if (isPaused) {
          statusBadge = `<span class="c-tile-badge paused">${t.cBadgePaused}</span>`;
          tileClass = 'c-matrix-tile paused';
          actionButtons = `
            <button class="btn-c-action resume" onclick="toggleClientPause(${i})" title="${t.cBtnResumeTitle || t.cBtnResume}">${t.cBtnResume}</button>
            <button class="btn-c-close" onclick="closeClient(${i})" title="${t.cCloseTitle}">❌</button>
          `;
        } else {
          statusBadge = `<span class="c-tile-badge active">${t.cBadgeActive}</span>`;
          tileClass = 'c-matrix-tile active';
          actionButtons = `
            <button class="btn-c-action pause" onclick="toggleClientPause(${i})" title="${t.cBtnPauseTitle || t.cBtnPause}">${t.cBtnPause}</button>
            <button class="btn-c-close" onclick="closeClient(${i})" title="${t.cCloseTitle}">❌</button>
          `;
        }
      }

      html += `
        <div class="${tileClass}" id="c-tile-${i}">
          <div class="c-tile-head">
            <div class="c-tile-title-box">
              <span>${bIcon} Client ${i}</span>
              <button type="button" class="btn-c-gear" onclick="openClientSettingsModal(${i})" title="${t.cSettingsTitle}">⚙️</button>
            </div>
            ${statusBadge}
          </div>
          <input type="text" class="c-alias-input" id="c-alias-${i}" value="${alias.replace(/"/g, '&quot;')}" placeholder="${t.cAliasPlaceholder}" onchange="saveClientAlias(${i}, this.value)" title="${t.cAliasTitle}" />
          <div class="c-tile-tools">
            ${actionButtons}
          </div>
        </div>
      `;
    }
    grid.innerHTML = html;
  }

  // Sync Diagnostics & Client Statuses from Backend API
  async function syncBackendStatus() {
    try {
      const [statusRes, configRes] = await Promise.all([
        fetch(getServerUrl('/api/status')).catch(() => null),
        fetch(getServerUrl('/api/config')).catch(() => null)
      ]);

      if (configRes && configRes.ok) {
        cachedConfig = await configRes.json();
        loadSettingsToUI(cachedConfig);
      }

      const offlinePlaceholder = document.getElementById('editor-offline-placeholder');

      if (statusRes && statusRes.ok) {
        const data = await statusRes.json();
        cachedStatus = data;
        const wasOffline = !isServerOnline;
        const previousPort = currentServerPort;
        if (data.port || data.serverPort) currentServerPort = data.port || data.serverPort;
        isServerOnline = true;
        dotServer.className = 'diag-indicator-dot online';
        valServerStatus.textContent = `Port ${currentServerPort}`;
        subServerInfo.textContent = '🟢 Server Online';

        // Auto-refresh/Load Studio iframe when Server comes Online or Port changes
        if (offlinePlaceholder) offlinePlaceholder.style.display = 'none';
        const currentOrigin = `http://localhost:${currentServerPort}`;
        const needsReload = wasOffline || (previousPort !== currentServerPort) || !editorFrame.src || editorFrame.src === 'about:blank' || !editorFrame.src.startsWith(currentOrigin);
        if (editorFrame && needsReload) {
          if (!isStudioDirty) {
            window.reloadEditorFrame();
          }
        }

        // Render Client Matrix cards
        renderLauncherClientCards(data, cachedConfig);

        // Update Client Count
        if (data.activeClients && Array.isArray(data.activeClients)) {
          const curT = i18nDict[currentLang] || i18nDict.th;
          valClientsCount.textContent = `${data.activeClients.length} ${curT.unitScreens || 'จอ'}`;
          const badgeCount = document.getElementById('badge-clients-count');
          if (badgeCount) badgeCount.textContent = `${data.activeClients.length}/8`;
        }

        // Update Active Profile Name
        if (data.activeProfiles && data.activeProfiles.length > 0) {
          renderActiveProfiles(data.activeProfiles);
        } else if (cachedConfig && cachedConfig.activeProfiles && cachedConfig.activeProfiles.length > 0) {
          renderActiveProfiles(cachedConfig.activeProfiles);
        } else if (cachedConfig && cachedConfig.activeProfile) {
          renderActiveProfiles([cachedConfig.activeProfile]);
        }
      }
    } catch (e) {
      isServerOnline = false;
      dotServer.className = 'diag-indicator-dot offline';
      subServerInfo.textContent = 'Server Offline';
      if (cachedConfig && cachedConfig.globalSettings && cachedConfig.globalSettings.webPort) {
        currentServerPort = cachedConfig.globalSettings.webPort;
      }
      const offlinePlaceholder = document.getElementById('editor-offline-placeholder');
      if (offlinePlaceholder && currentView === 'editor') {
        offlinePlaceholder.style.display = 'flex';
      }
    }
  }

  setInterval(syncBackendStatus, 2000);
  syncBackendStatus();

  // 5. Button Action Handlers
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

  // 6. UI State Setters
  function setBtnLoading(msg) {
    btnToggleEngine.className = 'btn-toggle-engine-sidebar btn-restarting';
    heroIcon.textContent = '⏳';
    heroTitle.textContent = msg;
    heroSub.textContent = 'Please wait...';
  }

  function updateStatusUI(status) {
    const curT = i18nDict[currentLang] || i18nDict.th;
    isRunning = status.running;
    isRestarting = status.restarting;

    if (isRestarting) {
      btnToggleEngine.className = 'btn-toggle-engine-sidebar btn-restarting';
      heroIcon.textContent = '🔄';
      heroTitle.textContent = curT.statusRestarting;
      heroSub.textContent = 'Restarting Engine';

      dotEngine.className = 'diag-indicator-dot pending';
      valEngineStatus.textContent = curT.statusRestarting;
      subEngineInfo.textContent = 'Reloading processes';
    } else if (isRunning) {
      btnToggleEngine.className = 'btn-toggle-engine-sidebar running';
      heroIcon.textContent = '⏹';
      heroTitle.textContent = curT.btnStopEngine;
      heroSub.textContent = 'Stop Bot Engine';

      dotEngine.className = 'diag-indicator-dot online';
      valEngineStatus.textContent = curT.statusRunning;
      if (!uptimeInterval) {
        startTime = Date.now();
        uptimeInterval = setInterval(updateUptime, 1000);
      }
    } else {
      btnToggleEngine.className = 'btn-toggle-engine-sidebar btn-start';
      heroIcon.textContent = '▶';
      heroTitle.textContent = curT.btnStartEngine;
      heroSub.textContent = 'Start Bot Engine';

      dotEngine.className = 'diag-indicator-dot offline';
      valEngineStatus.textContent = curT.statusStopped;
      subEngineInfo.textContent = 'Process Stopped';
      if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
      }
      isServerOnline = false;
      const offlinePlaceholder = document.getElementById('editor-offline-placeholder');
      if (offlinePlaceholder && currentView === 'editor') {
        offlinePlaceholder.style.display = 'flex';
      }
    }
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
    const wasOffline = !isServerOnline;
    const previousPort = currentServerPort;
    isServerOnline = diag.serverOnline;

    if (diag.serverOnline) {
      if (diag.port) currentServerPort = diag.port;
      dotServer.className = 'diag-indicator-dot online';
      valServerStatus.textContent = `Port ${currentServerPort}`;
      subServerInfo.textContent = '🟢 Server Online';
      if (tabEditorDot) tabEditorDot.className = 'tab-live-dot online';

      // Auto-reload Action Node Studio if server came online, port changed, or url mismatched
      const currentOrigin = `http://localhost:${currentServerPort}`;
      const needsReload = wasOffline || (diag.port && diag.port !== previousPort) || !editorFrame.src || editorFrame.src === 'about:blank' || !editorFrame.src.startsWith(currentOrigin);
      if (editorFrame && needsReload) {
        if (!isStudioDirty) {
          window.reloadEditorFrame();
        }
      }
    } else {
      dotServer.className = 'diag-indicator-dot offline';
      valServerStatus.textContent = `Offline`;
      subServerInfo.textContent = diag.error || 'Server not responding';
      if (tabEditorDot) tabEditorDot.className = 'tab-live-dot';
      const offlinePlaceholder = document.getElementById('editor-offline-placeholder');
      if (offlinePlaceholder && currentView === 'editor') {
        offlinePlaceholder.style.display = 'flex';
      }
    }

    if (diag.activeProfiles && diag.activeProfiles.length > 0) {
      renderActiveProfiles(diag.activeProfiles);
    }

    if (diag.activeClientsCount !== undefined) {
      const curT = i18nDict[currentLang] || i18nDict.th;
      valClientsCount.textContent = `${diag.activeClientsCount} ${curT.unitScreens || 'จอ'}`;
      subClientsInfo.textContent = diag.activeClientsCount > 0 ? '🟢 Connected Clients' : 'No clients attached';
    }
  });

  // 8. Smart 3-Step Update Wizard Logic
  function renderWizardSteps(activeStep) {
    const isEn = currentLang === 'en';
    const s1 = isEn ? 'Check' : 'ตรวจสอบ';
    const s2 = isEn ? 'Install' : 'ติดตั้ง';
    const s3 = isEn ? 'Ready' : 'ใช้งาน';
    return `
      <div class="wizard-header-steps">
        <div class="wizard-step-item ${activeStep === 1 ? 'active' : activeStep > 1 ? 'completed' : ''}">
          <span class="wizard-step-num">${activeStep > 1 ? '✓' : '1'}</span>
          <span>${s1}</span>
        </div>
        <div class="wizard-step-divider"></div>
        <div class="wizard-step-item ${activeStep === 2 ? 'active' : activeStep > 2 ? 'completed' : ''}">
          <span class="wizard-step-num">${activeStep > 2 ? '✓' : '2'}</span>
          <span>${s2}</span>
        </div>
        <div class="wizard-step-divider"></div>
        <div class="wizard-step-item ${activeStep === 3 ? 'active' : ''}">
          <span class="wizard-step-num">${activeStep === 3 ? '✓' : '3'}</span>
          <span>${s3}</span>
        </div>
      </div>
    `;
  }

  function renderFileList(files = []) {
    if (!files || files.length === 0) return '';
    const isEn = currentLang === 'en';
    const t = i18nDict[currentLang] || i18nDict.th;
    const fileItems = files.slice(0, 30).map(f => `
      <div class="changed-file-item">
        <span class="changed-file-icon">📄</span>
        <span>${f}</span>
      </div>
    `).join('');
    const extraCount = files.length > 30 
      ? `<div style="font-size:10px; opacity:0.6; padding-top:2px;">${(t.btnUpdateFilesMore || '... and {count} more files').replace('{count}', files.length - 30)}</div>` 
      : '';
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; margin-bottom:4px; font-size:11px;">
        <span style="color:#94a3b8; font-weight:600;">📁 ${t.btnUpdateFilesLabel || 'Total Changed Files:'}</span>
        <span style="color:#64748b; font-size:10px;">${files.length} ${isEn ? 'files' : 'ไฟล์'}</span>
      </div>
      <div class="changed-files-box" style="max-height:120px; overflow-y:auto;">
        ${fileItems}
        ${extraCount}
      </div>
    `;
  }

  function renderStep1CheckResult(result) {
    currentModalState = { type: 'step1_result', data: result };
    const isEn = currentLang === 'en';
    const t = i18nDict[currentLang] || i18nDict.th;

    if (result.error) {
      updateModalBody.innerHTML = `
        ${renderWizardSteps(1)}
        <div style="color:#ef4444; font-weight:700; margin-bottom:6px;">${t.btnUpdateCheckErr || '⚠️ Error checking for updates:'}</div>
        <div style="font-size:11px; opacity:0.8;">${result.error}</div>
      `;
      btnPerformUpdate.style.display = 'none';
      btnCancelUpdate.disabled = false;
      btnCancelUpdate.textContent = t.btnClose || 'Close';
    } else if (result.hasUpdate) {
      const impact = result.impact || { badge: 'Update Available', badgeClass: 'level-ui', description: 'New updates available' };
      const badgeText = (isEn ? impact.badge_en : impact.badge_th) || impact.badge;
      const descText = (isEn ? impact.description_en : impact.description_th) || impact.description;
      const hasMultipleCommits = result.commitsList && result.commitsList.length > 1;
      updateModalBody.innerHTML = `
        ${renderWizardSteps(1)}
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <div style="color:#10b981; font-weight:700; font-size:13px;">🎉 ${t.btnUpdateHasNewTitle || 'Update Available!'}</div>
          <span class="impact-badge ${impact.badgeClass}">${badgeText}</span>
        </div>
        <div style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.08); border-radius:6px; padding:8px 10px; margin:6px 0; font-family:'JetBrains Mono'; font-size:11px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>Local: <strong>${result.localHash}</strong> ➔ Remote: <strong>${result.remoteHash}</strong></div>
            ${result.commitCount > 1 ? `<span style="background:rgba(96,165,250,0.15); color:#60a5fa; border:1px solid rgba(96,165,250,0.3); padding:1px 6px; border-radius:4px; font-size:10px; font-weight:600;">${result.commitCount} Commits</span>` : ''}
          </div>
          ${hasMultipleCommits ? `
            <div style="margin-top:6px; max-height:85px; overflow-y:auto; display:flex; flex-direction:column; gap:3px; padding-right:4px;">
              ${result.commitsList.map(c => `
                <div style="font-size:10.5px; display:flex; gap:6px; align-items:baseline;">
                  <span style="color:#f59e0b; font-weight:600; flex-shrink:0;">${c.sha}</span>
                  <span style="color:#93c5fd; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.message}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="color:#60a5fa; margin-top:4px;">"${result.commitMessage || (isEn ? 'New features & improvements' : 'ปรับปรุงประสิทธิภาพและเพิ่มฟีเจอร์ใหม่')}"</div>
          `}
        </div>
        ${impact.hasDependencyChanges ? `
          <div style="background:rgba(14, 165, 233, 0.15); border:1px solid rgba(14, 165, 233, 0.4); border-radius:6px; padding:10px; margin:8px 0; color:#bae6fd; font-size:11.5px; line-height:1.45;">
            <div style="font-weight:700; display:flex; align-items:center; gap:6px; margin-bottom:4px; color:#38bdf8;">
              <span>⚡ ${t.btnUpdateDepTitle}</span>
            </div>
            <div>${t.btnUpdateDepDesc}</div>
          </div>
        ` : ''}
        <div style="font-size:11px; color:#cbd5e1; margin-top:6px;">💡 <strong>${t.btnUpdateImpactLabel || 'Impact:'}</strong> ${descText}</div>
        ${renderFileList(result.changedFiles)}
      `;
      btnPerformUpdate.style.display = 'block';
      btnPerformUpdate.disabled = false;
      btnPerformUpdate.textContent = t.btnStep1Download || '📥 Step 1: Download Package';
      btnPerformUpdate.onclick = () => handleStep1Download();
      btnCancelUpdate.disabled = false;
      btnCancelUpdate.textContent = t.btnCancel || 'Cancel';
    } else {
      updateModalBody.innerHTML = `
        ${renderWizardSteps(1)}
        <div style="color:#10b981; font-weight:700; font-size:13px; margin-bottom:4px;">✅ ${t.btnUpdateNoUpdate || 'System is up to date!'}</div>
        <div style="font-size:11px; opacity:0.8;">${(t.btnUpdateNoUpdateDesc || 'Current Commit: <code>{hash}</code> (Up to date)').replace('{hash}', result.localHash)}</div>
      `;
      btnPerformUpdate.style.display = 'none';
      btnCancelUpdate.disabled = false;
      btnCancelUpdate.textContent = t.btnClose || 'Close';
    }
  }

  async function checkUpdateSilentlyOnStartup() {
    try {
      if (!api || typeof api.checkUpdate !== 'function') return;
      const result = await api.checkUpdate();
      if (result && !result.error && result.hasUpdate) {
        detectedUpdateInfo = result;
        currentUpdateCheck = result;
        renderUpdateToolButton(true, result);
        console.log(`[Updater] Silent startup check: ${result.commitCount || 1} new commit(s) detected.`);
      }
    } catch (err) {
      console.warn('[Updater] Silent startup check failed/offline:', err && err.message);
    }
  }

  if (btnCheckUpdate) {
    btnCheckUpdate.onclick = async () => {
      const t = i18nDict[currentLang] || i18nDict.th;
      updateModal.style.display = 'flex';
      btnPerformUpdate.style.display = 'none';
      btnPerformUpdate.disabled = false;
      btnCancelUpdate.disabled = false;
      btnCancelUpdate.textContent = t.btnCancel || 'Cancel';

      if (currentUpdateCheck && currentUpdateCheck.hasUpdate) {
        renderStep1CheckResult(currentUpdateCheck);
        return;
      }

      currentModalState = { type: 'checking' };
      updateModalBody.innerHTML = `
        ${renderWizardSteps(1)}
        <div style="display:flex; align-items:center; gap:10px; padding:12px 0;">
          <div class="spinner"></div>
          <span>${t.btnUpdateChecking || 'Checking update status and analyzing impact from GitHub...'}</span>
        </div>
      `;

      try {
        const result = await api.checkUpdate();
        currentUpdateCheck = result;
        if (result && !result.error && result.hasUpdate) {
          detectedUpdateInfo = result;
          renderUpdateToolButton(true, result);
        } else {
          detectedUpdateInfo = null;
          renderUpdateToolButton(false);
        }
        renderStep1CheckResult(result);
      } catch (err) {
        currentModalState = { type: 'check_error', error: err.message };
        updateModalBody.innerHTML = `
          ${renderWizardSteps(1)}
          <div style="color:#ef4444; font-weight:700;">❌ ${t.btnUpdateCheckErr || 'Error checking for updates:'}</div>
          <div style="font-size:11px; opacity:0.8; margin-top:4px;">${err.message}</div>
        `;
        btnCancelUpdate.disabled = false;
        btnCancelUpdate.textContent = t.btnClose || 'Close';
      }
    };
  }

  // Step 1 Handler: Download Package
  async function handleStep1Download() {
    const t = i18nDict[currentLang] || i18nDict.th;
    currentModalState = { type: 'downloading' };
    btnPerformUpdate.disabled = true;
    btnCancelUpdate.disabled = true;
    updateModalBody.innerHTML = `
      ${renderWizardSteps(1)}
      <div style="display:flex; align-items:center; gap:10px; padding:12px 0;">
        <div class="spinner"></div>
        <span>${t.btnUpdateDownloading || 'Downloading update package and preparing...'}</span>
      </div>
    `;

    try {
      const res = await api.downloadUpdate();
      currentDownloadResult = res;
      currentModalState = { type: 'download_complete', data: res };
      const isEn = currentLang === 'en';
      const impact = res.impact || (currentUpdateCheck && currentUpdateCheck.impact) || {};
      const badgeText = (isEn ? impact.badge_en : impact.badge_th) || impact.badge || '';
      const titleText = (isEn ? impact.title_en : impact.title_th) || impact.title || (isEn ? 'Live Application Update' : 'อัปเดตแอปพลิเคชัน');

      updateModalBody.innerHTML = `
        ${renderWizardSteps(2)}
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
          <div style="color:#10b981; font-weight:700; font-size:13px;">✅ ${t.btnUpdateDownloadComplete || 'Package Download Complete!'}</div>
          ${badgeText ? `<span class="impact-badge ${impact.badgeClass}">${badgeText}</span>` : ''}
        </div>
        <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5;">
          ${t.btnUpdateDownloadCompleteDesc || 'The update package is ready for installation. Click the button below to apply the update directly to the live system.'}
        </div>
        <div style="margin-top:10px; font-size:11px; color:#94a3b8;">
          ⚙️ <strong>${t.btnUpdateLevelLabel || 'Update Level:'}</strong> ${titleText}
        </div>
      `;

      btnPerformUpdate.style.display = 'block';
      btnPerformUpdate.disabled = false;
      btnPerformUpdate.textContent = t.btnStep2Apply || '⚡ Step 2: Apply Update';
      btnCancelUpdate.disabled = false;
      btnCancelUpdate.textContent = t.btnCancel || 'Cancel';
      btnPerformUpdate.onclick = () => handleStep2Apply();
    } catch (err) {
      currentModalState = { type: 'download_failed', error: err.message };
      updateModalBody.innerHTML = `
        ${renderWizardSteps(1)}
        <div style="color:#ef4444; font-weight:700;">❌ ${t.btnUpdateDownloadFailed || 'Download Failed:'}</div>
        <div style="font-size:11px; opacity:0.8; margin-top:4px;">${err.message}</div>
      `;
      btnPerformUpdate.style.display = 'none';
      btnCancelUpdate.disabled = false;
      btnCancelUpdate.textContent = t.btnClose || 'Close';
    }
  }

  // Step 2 Handler: Apply Package
  async function handleStep2Apply() {
    const t = i18nDict[currentLang] || i18nDict.th;
    currentModalState = { type: 'applying' };
    btnPerformUpdate.disabled = true;
    btnCancelUpdate.disabled = true;
    updateModalBody.innerHTML = `
      ${renderWizardSteps(2)}
      <div style="display:flex; align-items:center; gap:10px; padding:12px 0;">
        <div class="spinner"></div>
        <span>${t.btnUpdateApplying || 'Extracting files and applying update...'}</span>
      </div>
    `;

    try {
      const res = await api.applyUpdate();
      const impact = res.impact || (currentDownloadResult && currentDownloadResult.impact) || { level: 1 };
      detectedUpdateInfo = null;
      currentUpdateCheck = null;
      renderUpdateToolButton(false);
      currentModalState = { type: 'apply_complete', impact: impact };

      // Render Step 3 according to impact level
      if (impact.level === 3) {
        // Level 3: Core App Relaunch Required
        updateModalBody.innerHTML = `
          ${renderWizardSteps(3)}
          <div style="color:#f87171; font-weight:700; font-size:13px; margin-bottom:6px;">🚀 ${t.btnUpdateCoreComplete}</div>
          <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5;">
            ${t.btnUpdateCoreCompleteDesc}
          </div>
          ${impact.hasDependencyChanges ? `
            <div style="margin-top:8px; background:rgba(16, 185, 129, 0.12); border:1px solid rgba(16, 185, 129, 0.3); border-radius:6px; padding:8px 10px; font-size:11px; color:#6ee7b7; line-height:1.4;">
              ✅ <strong>${t.btnUpdateCoreDepSuccess}</strong>
            </div>
          ` : ''}
        `;
        btnPerformUpdate.style.display = 'block';
        btnPerformUpdate.disabled = false;
        btnPerformUpdate.className = 'btn-hero-primary';
        btnPerformUpdate.textContent = t.btnRelaunchApp || '🚀 Restart App Now';
        btnPerformUpdate.onclick = () => api.relaunchApp();

        btnCancelUpdate.disabled = false;
        btnCancelUpdate.textContent = t.btnLater || 'Later';
      } else if (impact.level === 2) {
        // Level 2: Bot Engine Update
        updateModalBody.innerHTML = `
          ${renderWizardSteps(3)}
          <div style="color:#fbbf24; font-weight:700; font-size:13px; margin-bottom:6px;">🟡 ${t.btnUpdateEngineComplete}</div>
          <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5;">
            ${t.btnUpdateEngineCompleteDesc}
          </div>
        `;
        btnPerformUpdate.style.display = 'block';
        btnPerformUpdate.disabled = false;
        btnPerformUpdate.className = 'btn-hero-primary';
        btnPerformUpdate.textContent = t.btnRestartEngineNow || '🔄 Restart Engine Now';
        btnPerformUpdate.onclick = async () => {
          btnPerformUpdate.disabled = true;
          await api.restartEngine();
          if (editorFrame) editorFrame.src = getServerUrl('/?t=' + Date.now());
          updateModal.style.display = 'none';
        };

        btnCancelUpdate.disabled = false;
        btnCancelUpdate.textContent = t.btnRestartLater || '⏳ Restart Later';
      } else {
        // Level 1: UI Only Hot-Reload
        await api.hotReloadUi();
        if (editorFrame) editorFrame.src = getServerUrl('/?t=' + Date.now());

        updateModalBody.innerHTML = `
          ${renderWizardSteps(3)}
          <div style="color:#34d399; font-weight:700; font-size:13px; margin-bottom:6px;">✨ ${t.btnUpdateUiComplete}</div>
          <div style="font-size:11.5px; color:#cbd5e1; line-height:1.5;">
            ${t.btnUpdateUiCompleteDesc}
          </div>
        `;
        btnPerformUpdate.style.display = 'none';
        btnCancelUpdate.disabled = false;
        btnCancelUpdate.textContent = t.btnDone || 'Done';
      }
    } catch (err) {
      currentModalState = { type: 'apply_failed', error: err.message };
      updateModalBody.innerHTML = `
        ${renderWizardSteps(2)}
        <div style="color:#ef4444; font-weight:700;">❌ ${t.btnUpdateApplyFailed || 'Installation Failed:'}</div>
        <div style="font-size:11px; opacity:0.8; margin-top:4px;">${err.message}</div>
      `;
      btnPerformUpdate.style.display = 'none';
      btnCancelUpdate.disabled = false;
      btnCancelUpdate.textContent = t.btnClose || 'Close';
    }
  }

  if (btnCloseUpdateModal) btnCloseUpdateModal.onclick = () => updateModal.style.display = 'none';
  if (btnCancelUpdate) btnCancelUpdate.onclick = () => updateModal.style.display = 'none';

  // 9. Listeners from Electron Main Process
  if (api.onHotReload) {
    api.onHotReload(() => {
      if (editorFrame) {
        editorFrame.src = getServerUrl('/?t=' + Date.now());
      }
      setTimeout(() => {
        window.location.reload();
      }, 500);
    });
  }

  api.onLogMessage((data) => {
    appendLogEntry(data);
  });

  api.onStatusChange((status) => {
    updateStatusUI(status);
  });

  // 10. Initial Load
  applyLanguage(currentLang);

  api.getBotStatus().then(status => {
    updateStatusUI(status);
    if (status.logPath && footerLogPath) {
      footerLogPath.textContent = status.logPath;
    }
  });

  api.getLogPath().then(path => {
    if (footerLogPath && path) footerLogPath.textContent = path;
  });

  // Silent Background Update Check on Startup (Delayed 2.5s to prevent boot race)
  setTimeout(() => {
    checkUpdateSilentlyOnStartup();
  }, 2500);

  // Prevent Mouse Button 4 & 5 (Back/Forward) from reloading/navigating the Launcher Shell
  window.addEventListener('mouseup', (e) => {
    if (e.button === 3 || e.button === 4) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  window.addEventListener('mousedown', (e) => {
    if (e.button === 3 || e.button === 4) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  window.addEventListener('auxclick', (e) => {
    if (e.button === 3 || e.button === 4) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
})();
