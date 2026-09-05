// NodeHotkey Launcher Frontend Controller
(function() {
  const api = window.launcherAPI;
  if (!api) {
    console.error('launcherAPI is not available');
    return;
  }

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
        if (editorFrame && (editorFrame.src === 'about:blank' || !editorFrame.src)) {
          editorFrame.src = 'http://localhost:3000/';
        }
      }
    } else if (viewName === 'settings') {
      if (tabNavSettings) tabNavSettings.classList.add('active');
      if (viewSettings) viewSettings.classList.add('active');
      if (breadcrumbEl) breadcrumbEl.textContent = t.breadcrumbSettings;
      if (studioTopbarActions) studioTopbarActions.style.display = 'none';
    }
  }

  window.reloadEditorFrame = function() {
    if (editorFrame && isServerOnline) {
      editorFrame.src = 'http://localhost:3000/?t=' + Date.now();
    }
  };

  window.openEditorInBrowser = function() {
    if (api && api.openExternal) {
      api.openExternal('http://localhost:3000/');
    } else {
      window.open('http://localhost:3000/', '_blank');
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
      modalCancelBtn: "ยกเลิก"
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
      btnAutoScroll: "⬇️ Auto-scroll",
      btnClearTerm: "🗑️ Clear",
      termToday: "📁 Today: ",
      settingEmergencyHead: "⌨️ Global Emergency Pause Hotkey",
      settingEmergencyKey: "Emergency Pause Hotkey",
      settingEmergencyDesc: "Instantly release all keys, pause loops, and cancel skill queues in game (Click box to record new key)",
      settingOverlayHead: "🖥️ Desktop Overlay HUD",
      settingOverlay: "Enable Desktop Status Overlay",
      settingOverlayDesc: "Render transparent real-time status overlay HUD over game clients",
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
      modalCancelBtn: "Cancel"
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

    // Update Filter Pills
    filterPills.forEach(pill => {
      const f = pill.dataset.filter;
      if (f === 'all') pill.textContent = t.filterAll;
      else if (f === 'error') pill.textContent = t.filterError;
      else if (f === 'warn') pill.textContent = t.filterWarn;
      else if (f === 'action') pill.textContent = t.filterAction;
    });

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
  }

  window.saveSettingsFromUI = async function() {
    try {
      if (!cachedConfig) {
        const res = await fetch('http://localhost:3000/api/config');
        cachedConfig = await res.json();
      }
      if (!cachedConfig.globalSettings) cachedConfig.globalSettings = {};
      const gs = cachedConfig.globalSettings;

      const suspendKeyInput = document.getElementById('setting-suspend-key');
      const overlayCb = document.getElementById('setting-enable-overlay');
      const jitterCb = document.getElementById('setting-enable-jitter');
      const jitterMin = document.getElementById('setting-jitter-min');
      const jitterMax = document.getElementById('setting-jitter-max');
      const jitterOffset = document.getElementById('setting-jitter-offset');
      const targetUrlInput = document.getElementById('setting-target-url');

      if (suspendKeyInput) gs.suspendHotkey = suspendKeyInput.value.trim() || 'END';
      if (overlayCb) gs.enableOverlay = overlayCb.checked;
      if (jitterCb) {
        if (!gs.ghostMouseJitter) gs.ghostMouseJitter = {};
        gs.ghostMouseJitter.enabled = jitterCb.checked;
        if (jitterMin) gs.ghostMouseJitter.intervalMin = parseInt(jitterMin.value, 10) || 8000;
        if (jitterMax) gs.ghostMouseJitter.intervalMax = parseInt(jitterMax.value, 10) || 25000;
        if (jitterOffset) gs.ghostMouseJitter.maxOffset = parseInt(jitterOffset.value, 10) || 12;
      }
      if (targetUrlInput) gs.targetUrlKeyword = targetUrlInput.value.trim() || 'universe.flyff.com';

      await fetch('http://localhost:3000/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cachedConfig)
      });
      syncBackendStatus();
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

      await fetch('http://localhost:3000/api/client/launch', {
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
      await fetch('http://localhost:3000/api/client/close', {
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
      await fetch('http://localhost:3000/api/client/toggle-enable', {
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
        const res = await fetch('http://localhost:3000/api/config');
        cachedConfig = await res.json();
      }
      if (!cachedConfig.globalSettings) cachedConfig.globalSettings = {};
      if (!cachedConfig.globalSettings.clientAliases) cachedConfig.globalSettings.clientAliases = {};
      cachedConfig.globalSettings.clientAliases[String(clientIdx)] = (newAlias || '').trim();

      await fetch('http://localhost:3000/api/config', {
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

    modal.style.display = 'flex';
  };

  window.closeClientSettingsModal = function() {
    const modal = document.getElementById('client-settings-modal');
    if (modal) modal.style.display = 'none';
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
        const res = await fetch('http://localhost:3000/api/config');
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

      await fetch('http://localhost:3000/api/config', {
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

        fetch('http://localhost:3000/api/client/launch', {
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
        fetch('http://localhost:3000/api/client/close', {
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
        fetch('http://localhost:3000/api/status').catch(() => null),
        fetch('http://localhost:3000/api/config').catch(() => null)
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
        isServerOnline = true;
        dotServer.className = 'diag-indicator-dot online';
        valServerStatus.textContent = 'Port 3000';
        subServerInfo.textContent = '🟢 Server Online';

        // Auto-refresh/Load Studio iframe when Server comes Online
        if (offlinePlaceholder) offlinePlaceholder.style.display = 'none';
        if (editorFrame && (wasOffline || editorFrame.src === 'about:blank' || !editorFrame.src)) {
          editorFrame.src = 'http://localhost:3000/';
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
          valProfileName.textContent = data.activeProfiles[0];
          subProfileCount.textContent = `${data.activeProfiles.length} Active Profile(s)`;
        } else if (cachedConfig && cachedConfig.activeProfiles && cachedConfig.activeProfiles.length > 0) {
          valProfileName.textContent = cachedConfig.activeProfiles[0];
          subProfileCount.textContent = `${cachedConfig.activeProfiles.length} Active Profile(s)`;
        }
      }
    } catch (e) {
      isServerOnline = false;
      dotServer.className = 'diag-indicator-dot offline';
      subServerInfo.textContent = 'Server Offline';
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
      const curT = i18nDict[currentLang] || i18nDict.th;
      valClientsCount.textContent = `${diag.activeClientsCount} ${curT.unitScreens || 'จอ'}`;
      subClientsInfo.textContent = diag.activeClientsCount > 0 ? '🟢 Connected Clients' : 'No clients attached';
    }
  });

  // 8. Smart 3-Step Update Wizard Logic
  let currentUpdateCheck = null;
  let currentDownloadResult = null;

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
