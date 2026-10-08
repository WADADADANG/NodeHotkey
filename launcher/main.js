const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const LogManager = require('./log-manager');
const SystemUpdater = require('./updater');

// Single-Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;
let tray = null;
let botProcess = null;
let isBotRunning = false;
let isRestarting = false;
let healthCheckInterval = null;

const PROJECT_DIR = path.join(__dirname, '..');
const logManager = new LogManager(path.join(PROJECT_DIR, 'logs'));
const updater = new SystemUpdater(PROJECT_DIR);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 980,
    minHeight: 650,
    frame: false, // Custom sleek titlebar
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0d14',
    icon: path.join(PROJECT_DIR, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  // Prevent Mouse Button 4 & 5 (Back / Forward) from reloading/navigating the app
  mainWindow.on('app-command', (e, cmd) => {
    if (cmd === 'browser-backward' || cmd === 'browser-forward') {
      e.preventDefault();
    }
  });

  // Shortcut Guard: Enable Ctrl+R, F5, and Ctrl+Shift+I in Dev Mode (npm start) ONLY.
  // In Production / Installed mode: Block them completely to prevent accidental UI resets.
  const isDev = !app.isPackaged || process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const isReload = (input.control && input.key.toLowerCase() === 'r') || input.key === 'F5';
      const isDevTools = input.control && input.shift && input.key.toLowerCase() === 'i';

      if (isDev) {
        if (isReload) {
          mainWindow.webContents.reload();
          event.preventDefault();
        } else if (isDevTools) {
          mainWindow.webContents.toggleDevTools();
          event.preventDefault();
        }
      } else {
        if (isReload || isDevTools) {
          event.preventDefault(); // Block in Production/Installed mode
        }
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    broadcastStatus();
    checkBotHealth();
  });

  mainWindow.on('focus', () => {
    ensureOverlayAlwaysOnTop();
  });
}

function createTray() {
  if (tray) return;
  const iconPath = path.join(PROJECT_DIR, 'icon.ico');
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('NodeHotkey Control Center');

  const updateTrayMenu = () => {
    const statusText = isBotRunning ? '🟢 Running' : '🔴 Stopped';
    const contextMenu = Menu.buildFromTemplate([
      {
        label: `⚡ NodeHotkey (${statusText})`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: isBotRunning ? '🛑 Stop' : '▶️ Start',
        click: () => {
          if (isBotRunning) stopBotProcess();
          else startBotProcess();
        }
      },
      {
        label: '🔄 Restart',
        enabled: isBotRunning,
        click: () => restartBotProcess()
      },
      { type: 'separator' },
      {
        label: '🖥️ Show Launcher',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createWindow();
          }
        }
      },
      {
        label: '❌ Exit',
        click: () => {
          exitApplicationCleanly();
        }
      }
    ]);
    tray.setContextMenu(contextMenu);
  };

  updateTrayMenu();
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) mainWindow.focus();
      else mainWindow.show();
    } else {
      createWindow();
    }
  });

  // Keep tray menu updated on status change
  tray.updateMenu = updateTrayMenu;
}

// Broadcast Status & Diagnostics to UI
function broadcastStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('bot:status-change', {
    running: isBotRunning,
    restarting: isRestarting
  });
  if (tray && typeof tray.updateMenu === 'function') {
    tray.updateMenu();
  }
}

function classifyLogLevel(line, isStderr = false) {
  const lower = line.toLowerCase();
  
  // 1. Critical Errors (ข้อผิดพลาดร้ายแรงจริงๆ)
  if (
    line.includes('❌') ||
    lower.includes('uncaught exception') ||
    lower.includes('unhandledpromiserejection') ||
    lower.includes('syntaxerror') ||
    lower.includes('referenceerror') ||
    lower.includes('typeerror') ||
    lower.includes('rangeerror') ||
    lower.includes('eaddrinuse') ||
    lower.includes('econnrefused') ||
    lower.includes('fatal error') ||
    lower.includes('[critical]') ||
    line.startsWith('Error:') ||
    lower.includes('spawn error') ||
    lower.includes('failed to start') ||
    lower.includes('crashed')
  ) {
    return 'error';
  }

  // 2. Lifecycle / Closing / Detaching / Warning (การปิดจอ / ปิดแท็บ / พักการทำงาน)
  if (
    line.includes('⚠️') ||
    lower.includes('warn') ||
    lower.includes('game tab closed') ||
    lower.includes('browser closed') ||
    lower.includes('closed/detached') ||
    lower.includes('detached') ||
    lower.includes('pausing actions') ||
    lower.includes('stopping') ||
    lower.includes('stopped') ||
    lower.includes('disconnect') ||
    lower.includes('deprecationwarning') ||
    lower.includes('experimentalwarning')
  ) {
    return 'warn';
  }

  // 3. User Log Messages (ข้อความ Log ทั่วไป)
  if (
    line.includes('📝') ||
    line.includes('[Log]') ||
    line.includes('[log]') ||
    line.includes('🧭') ||
    line.includes('📍') ||
    line.includes('[Step]') ||
    line.includes('[step]') ||
    lower.includes('[step log]') ||
    lower.startsWith('[step]') ||
    lower.startsWith('[log]')
  ) {
    return 'log';
  }

  // 4. Actions / Hotkeys / Triggers / CDP (การกดปุ่ม / รัน workflow)
  if (
    line.includes('🔵') ||
    line.includes('🎯') ||
    line.includes('🎮') ||
    lower.includes('[action') ||
    lower.includes('hotkey') ||
    lower.includes('triggered') ||
    lower.includes('forwarder')
  ) {
    return 'action';
  }

  // 4. Success / Ready / Listening (ความสำเร็จ / พร้อมใช้งาน)
  if (
    line.includes('✅') ||
    line.includes('🎉') ||
    lower.includes('success') ||
    lower.includes('initialized successfully') ||
    lower.includes('ready!') ||
    lower.includes('connected') ||
    lower.includes('listening on')
  ) {
    return 'success';
  }

  // Default: Stderr that isn't a critical error is treated as warning or info
  if (isStderr) {
    return 'warn';
  }

  return 'info';
}

function broadcastLog(text, level = null) {
  const actualLevel = level || classifyLogLevel(text);
  logManager.writeLine(text);
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('bot:log', {
    text,
    level: actualLevel,
    time: new Date().toLocaleTimeString()
  });
}

let overlayWindow = null;
let isOverlayExplicitlyClosed = false;

function ensureOverlayAlwaysOnTop() {
  if (!overlayWindow || overlayWindow.isDestroyed() || !overlayWindow.isVisible()) return;
  try {
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.moveTop();
  } catch (e) {}
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.showInactive();
    ensureOverlayAlwaysOnTop();
    return;
  }

  overlayWindow = new BrowserWindow({
    width: 210,
    height: 60,
    minWidth: 210,
    maxWidth: 210,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    show: false, // Prevent focus stealing and white flash before ready
    skipTaskbar: true, // 100% hidden from Taskbar!
    resizable: false, // Disables manual cursor border resizing
    hasShadow: false,
    useContentSize: true,
    focusable: true,
    icon: path.join(PROJECT_DIR, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Ensure top-level Z-order across all desktop workspaces and full-screen games
  try {
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.moveTop();
  } catch (e) {}

  overlayWindow.loadFile(path.join(__dirname, 'ui', 'overlay.html'));

  overlayWindow.once('ready-to-show', () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.showInactive();
      ensureOverlayAlwaysOnTop();
    }
  });

  overlayWindow.on('show', () => {
    ensureOverlayAlwaysOnTop();
  });

  // When user clicks another application or window, immediately re-assert topmost
  overlayWindow.on('blur', () => {
    ensureOverlayAlwaysOnTop();
  });

  overlayWindow.on('moved', () => {
    ensureOverlayAlwaysOnTop();
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

// ============================================================================
// PiP (PICTURE-IN-PICTURE) FLOATING WINDOWS (Independent Multi-Screen & Master)
// ============================================================================
const pipWindows = new Map(); // clientId (e.g. '1', '2', or 'master') -> BrowserWindow
let latestActiveClients = [];
let latestClientAliases = {};

function getClientAliasesFromConfig() {
  try {
    const configPath = path.join(PROJECT_DIR, 'configs', 'global.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsed && parsed.globalSettings && parsed.globalSettings.clientAliases) {
        return parsed.globalSettings.clientAliases;
      }
    }
  } catch (e) {}
  return {};
}

function ensurePipAlwaysOnTop(win) {
  if (!win || win.isDestroyed() || !win.isVisible()) return;
  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.moveTop();
  } catch (e) {}
}

function createPipWindow(targetClientId = 'master') {
  const key = String(targetClientId || 'master');
  let existingWin = pipWindows.get(key);
  if (existingWin && !existingWin.isDestroyed()) {
    existingWin.showInactive();
    ensurePipAlwaysOnTop(existingWin);
    existingWin.webContents.send('pip:set-client', key);
    return existingWin;
  }

  // Calculate staggered initial position based on client index
  let initialX = undefined;
  let initialY = undefined;
  try {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;
    const clientNum = parseInt(key, 10) || 1;
    const offset = (clientNum - 1) * 35;
    initialX = Math.max(20, screenW - 350 - offset);
    initialY = Math.max(30, 80 + offset);
  } catch (e) {}

  const win = new BrowserWindow({
    width: 346,
    height: 258,
    minWidth: 220,
    minHeight: 140,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    hasShadow: true,
    resizable: true,
    focusable: true,
    x: initialX,
    y: initialY,
    icon: path.join(PROJECT_DIR, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.moveTop();
  } catch (e) {}

  win.loadFile(path.join(__dirname, 'ui', 'pip.html'), {
    query: { client: key }
  });

  win.once('ready-to-show', () => {
    if (win && !win.isDestroyed()) {
      win.showInactive();
      ensurePipAlwaysOnTop(win);
      const currentPort = activeWebPort || getWebPortFromConfig();
      if (!latestClientAliases || Object.keys(latestClientAliases).length === 0) {
        latestClientAliases = getClientAliasesFromConfig();
      }
      win.webContents.send('pip:init', {
        client: key,
        port: currentPort,
        activeClients: latestActiveClients,
        clientAliases: latestClientAliases
      });
    }
  });

  win.on('blur', () => ensurePipAlwaysOnTop(win));
  win.on('moved', () => ensurePipAlwaysOnTop(win));
  win.on('closed', () => {
    pipWindows.delete(key);
  });

  pipWindows.set(key, win);
  return win;
}

let isPipMasterExplicitlyClosed = false;

function isPipOverlayEnabledInConfig() {
  try {
    ensureGlobalConfigExists();
    const globalJsonPath = path.join(PROJECT_DIR, 'configs', 'global.json');
    if (fs.existsSync(globalJsonPath)) {
      const parsed = JSON.parse(fs.readFileSync(globalJsonPath, 'utf8'));
      if (parsed && parsed.globalSettings && parsed.globalSettings.enablePipOverlay !== undefined) {
        return !!parsed.globalSettings.enablePipOverlay;
      }
    }
  } catch (e) {}
  return false;
}

function syncPipOnEngineState(running) {
  if (running) {
    const isEnabled = isPipOverlayEnabledInConfig();
    if (isEnabled && !isPipMasterExplicitlyClosed) {
      let masterWin = pipWindows.get('master');
      if (!masterWin || masterWin.isDestroyed()) {
        createPipWindow('master');
      } else if (!masterWin.isVisible()) {
        masterWin.showInactive();
        ensurePipAlwaysOnTop(masterWin);
      }
    }
  } else {
    // Only auto-hide master PiP if it was configured as auto-launch overlay
    const isEnabled = isPipOverlayEnabledInConfig();
    if (isEnabled) {
      let masterWin = pipWindows.get('master');
      if (masterWin && !masterWin.isDestroyed() && masterWin.isVisible()) {
        masterWin.hide();
      }
    }
  }
}

function ensureGlobalConfigExists() {
  try {
    const globalJsonPath = path.join(PROJECT_DIR, 'configs', 'global.json');
    const defaultJsonPath = path.join(PROJECT_DIR, 'configs', 'global.default.json');
    if (!fs.existsSync(globalJsonPath) && fs.existsSync(defaultJsonPath)) {
      const configsDir = path.join(PROJECT_DIR, 'configs');
      if (!fs.existsSync(configsDir)) fs.mkdirSync(configsDir, { recursive: true });
      fs.copyFileSync(defaultJsonPath, globalJsonPath);
      console.log('[Launcher] 🚀 Initialized global.json from global.default.json template');
    }
  } catch (e) {
    console.error('[Launcher] Failed to initialize global config:', e.message);
  }
}

function isOverlayEnabledInConfig() {
  try {
    ensureGlobalConfigExists();
    const globalJsonPath = path.join(PROJECT_DIR, 'configs', 'global.json');
    if (fs.existsSync(globalJsonPath)) {
      const parsed = JSON.parse(fs.readFileSync(globalJsonPath, 'utf8'));
      if (parsed && parsed.globalSettings && parsed.globalSettings.enableOverlay !== undefined) {
        return !!parsed.globalSettings.enableOverlay;
      }
    }
  } catch (e) {}
  return true;
}

function syncOverlayOnEngineState(running) {
  if (running) {
    const isEnabled = isOverlayEnabledInConfig();
    if (isEnabled && !isOverlayExplicitlyClosed) {
      createOverlayWindow();
      if (overlayWindow && !overlayWindow.isDestroyed() && !overlayWindow.isVisible()) {
        overlayWindow.showInactive();
        ensureOverlayAlwaysOnTop();
      }
    } else {
      if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
        overlayWindow.hide();
      }
    }
  } else {
    // Engine stopped -> immediately hide overlay window
    if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
      overlayWindow.hide();
    }
  }
}

function getWebPortFromConfig() {
  try {
    ensureGlobalConfigExists();
    const globalJsonPath = path.join(PROJECT_DIR, 'configs', 'global.json');
    if (fs.existsSync(globalJsonPath)) {
      const parsed = JSON.parse(fs.readFileSync(globalJsonPath, 'utf8'));
      if (parsed && parsed.globalSettings && parsed.globalSettings.webPort) {
        const p = parseInt(parsed.globalSettings.webPort, 10);
        if (!isNaN(p) && p > 0) return p;
      }
    }
  } catch (e) {}
  return 3088;
}

let activeWebPort = getWebPortFromConfig();

function checkBotHealth() {
  const currentPort = activeWebPort || getWebPortFromConfig();
  const req = http.get(`http://localhost:${currentPort}/api/config`, { timeout: 1500 }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const resolvedPort = json.serverPort || json.port || currentPort;
        activeWebPort = resolvedPort;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('bot:diagnostics', {
            serverOnline: true,
            port: resolvedPort,
            activeProfiles: json.activeProfiles || [json.activeProfile || 'Default'],
            activeClientsCount: json.activeClients ? json.activeClients.length : 0
          });
        }

        if (json.clientAliases) {
          latestClientAliases = json.clientAliases;
        } else if (json.globalSettings && json.globalSettings.clientAliases) {
          latestClientAliases = json.globalSettings.clientAliases;
        } else if (!latestClientAliases || Object.keys(latestClientAliases).length === 0) {
          latestClientAliases = getClientAliasesFromConfig();
        }

        latestActiveClients = (json.activeClients || []).map(String);
        pipWindows.forEach(pWin => {
          if (pWin && !pWin.isDestroyed()) {
            pWin.webContents.send('pip:update', {
              port: resolvedPort,
              activeClients: latestActiveClients,
              clientAliases: latestClientAliases
            });
          }
        });

        // If bot is stopped by user or not running, ensure overlay stays hidden
        if (!isBotRunning) {
          syncOverlayOnEngineState(false);
          return;
        }

        // Overlay Sync
        const gs = json.globalSettings || {};
        const isEnabledInSettings = !!gs.enableOverlay;

        // If user changed the checkbox in Web UI, sync our explicit flag
        if (isEnabledInSettings && isOverlayExplicitlyClosed) {
          isOverlayExplicitlyClosed = false;
        } else if (!isEnabledInSettings) {
          isOverlayExplicitlyClosed = true;
        }

        const shouldShowOverlay = isEnabledInSettings && !isOverlayExplicitlyClosed;

        if (shouldShowOverlay) {
          if (!overlayWindow || overlayWindow.isDestroyed()) {
            createOverlayWindow();
          }
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            if (!overlayWindow.isVisible()) {
              overlayWindow.showInactive();
            }
            ensureOverlayAlwaysOnTop();
            overlayWindow.webContents.send('overlay:update', {
              port: resolvedPort,
              activeClients: json.activeClients || [],
              clientStatuses: json.clientStatuses || {},
              clientAliases: gs.clientAliases || {},
              isSuspended: !!json.isSuspended,
              disabledClients: json.disabledClients || []
            });
          }
        } else {
          if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
            overlayWindow.hide();
          }
        }

        // PiP Floating Overlay Auto-Launch Sync (auto-open on bot start only if enabled in settings)
        const isPipEnabledInSettings = !!gs.enablePipOverlay;
        if (isPipEnabledInSettings && !isPipMasterExplicitlyClosed) {
          let masterPip = pipWindows.get('master');
          if (!masterPip || masterPip.isDestroyed()) {
            createPipWindow('master');
          } else if (!masterPip.isVisible()) {
            masterPip.showInactive();
            ensurePipAlwaysOnTop(masterPip);
          }
        }
      } catch (e) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('bot:diagnostics', { serverOnline: true, port: currentPort });
        }
      }
    });
  });

  req.on('error', () => {
    if (!isBotRunning && overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
      overlayWindow.hide();
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bot:diagnostics', {
        serverOnline: false,
        port: currentPort,
        error: isBotRunning ? 'Server is starting or port unreachable' : 'Stopped'
      });
    }
  });

  req.on('timeout', () => req.destroy());
}

// Bot Process Management
function startBotProcess() {
  if (isBotRunning || botProcess) return { success: true, alreadyRunning: true };

  activeWebPort = getWebPortFromConfig();
  broadcastLog('🚀 Starting NodeHotkey Core Engine (node bot.js)...', 'info');
  const botJs = path.join(PROJECT_DIR, 'bot.js');

  try {
    botProcess = spawn('node', [botJs], {
      cwd: PROJECT_DIR,
      env: { ...process.env, FORCE_COLOR: '1' },
      windowsHide: true
    });

    isBotRunning = true;
    broadcastStatus();
    syncOverlayOnEngineState(true);
    syncPipOnEngineState(true);

    botProcess.stdout.on('data', (data) => {
      const lines = data.toString().split(/\r?\n/);
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Zero-Latency High-Speed Overlay Stream from Bot Engine
        if (trimmed.startsWith('__OVERLAY_DATA__')) {
          try {
            const rawJson = trimmed.slice('__OVERLAY_DATA__'.length);
            const overlayData = JSON.parse(rawJson);
            latestActiveClients = (overlayData.activeClients || []).map(String);
            if (overlayData.clientAliases) {
              latestClientAliases = overlayData.clientAliases;
            }
            if (overlayWindow && !overlayWindow.isDestroyed()) {
              ensureOverlayAlwaysOnTop();
              overlayWindow.webContents.send('overlay:update', overlayData);
            }
            pipWindows.forEach(pWin => {
              if (pWin && !pWin.isDestroyed()) {
                pWin.webContents.send('pip:update', {
                  activeClients: latestActiveClients,
                  clientAliases: latestClientAliases
                });
              }
            });
          } catch (e) {}
          return;
        }

        broadcastLog(trimmed, classifyLogLevel(trimmed, false));
      });
    });

    botProcess.stderr.on('data', (data) => {
      const lines = data.toString().split(/\r?\n/);
      lines.forEach(line => {
        if (line.trim()) {
          broadcastLog(line, classifyLogLevel(line, true));
        }
      });
    });

    botProcess.on('close', (code) => {
      if (isStoppingByUser) {
        broadcastLog(`🛑 NodeHotkey Engine stopped cleanly.`, 'info');
        isStoppingByUser = false;
      } else if (code === 0) {
        broadcastLog(`🛑 NodeHotkey Engine exited normally.`, 'info');
      } else {
        broadcastLog(`❌ NodeHotkey Engine exited unexpectedly with code ${code}`, 'error');
      }
      botProcess = null;
      isBotRunning = false;
      broadcastStatus();
      syncOverlayOnEngineState(false);
      syncPipOnEngineState(false);
      checkBotHealth();
    });

    botProcess.on('error', (err) => {
      broadcastLog(`❌ Failed to start NodeHotkey: ${err.message}`, 'error');
      botProcess = null;
      isBotRunning = false;
      broadcastStatus();
      syncOverlayOnEngineState(false);
      syncPipOnEngineState(false);
    });

    // Start periodic health checking
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    healthCheckInterval = setInterval(checkBotHealth, 3000);

    return { success: true };
  } catch (err) {
    broadcastLog(`❌ Spawn Error: ${err.message}`, 'error');
    isBotRunning = false;
    broadcastStatus();
    syncOverlayOnEngineState(false);
    syncPipOnEngineState(false);
    return { success: false, error: err.message };
  }
}

let isStoppingByUser = false;

function stopBotProcess() {
  if (!isBotRunning && !botProcess) return { success: true };

  isStoppingByUser = true;
  broadcastLog('🛑 Stopping NodeHotkey Core Engine...', 'warn');
  if (botProcess) {
    try {
      // Windows tree-kill
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', botProcess.pid, '/f', '/t']);
      } else {
        botProcess.kill('SIGTERM');
      }
    } catch (e) {
      try { botProcess.kill('SIGKILL'); } catch (err) {}
    }
  }

  botProcess = null;
  isBotRunning = false;
  broadcastStatus();
  syncOverlayOnEngineState(false);
  syncPipOnEngineState(false);
  checkBotHealth();
  return { success: true };
}

async function restartBotProcess() {
  isRestarting = true;
  broadcastStatus();
  broadcastLog('🔄 Restarting NodeHotkey Engine...', 'warn');
  stopBotProcess();
  await new Promise(r => setTimeout(r, 1200));
  startBotProcess();
  isRestarting = false;
  broadcastStatus();
  return { success: true };
}

function openWebDashboard() {
  const currentPort = activeWebPort || getWebPortFromConfig();
  shell.openExternal(`http://localhost:${currentPort}/`);
}

function openLogFolder() {
  const dir = logManager.getLogDirectory();
  shell.openPath(dir);
  return { success: true, path: dir };
}

function openScreenshotsFolder() {
  const dir = path.join(PROJECT_DIR, 'screenshots');
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  }
  shell.openPath(dir);
  return { success: true, path: dir };
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDirStats(dirPath) {
  let fileCount = 0;
  let totalBytes = 0;

  if (!fs.existsSync(dirPath)) {
    return { fileCount: 0, totalBytes: 0, formattedSize: '0 B' };
  }

  function walk(current) {
    try {
      const items = fs.readdirSync(current, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(current, item.name);
        if (item.isDirectory()) {
          walk(full);
        } else if (item.isFile()) {
          fileCount++;
          try {
            totalBytes += fs.statSync(full).size;
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  walk(dirPath);
  return {
    fileCount,
    totalBytes,
    formattedSize: formatBytes(totalBytes)
  };
}

function clearDirContents(targetDir) {
  if (!fs.existsSync(targetDir)) {
    try { fs.mkdirSync(targetDir, { recursive: true }); } catch (e) {}
    return { success: true, deletedFiles: 0, freedBytes: 0, formattedFreed: '0 B' };
  }

  let deletedFiles = 0;
  let freedBytes = 0;

  function removeRecursive(currentDir) {
    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const item of items) {
        const full = path.join(currentDir, item.name);
        if (item.isDirectory()) {
          removeRecursive(full);
          try {
            if (fs.readdirSync(full).length === 0) {
              fs.rmdirSync(full);
            }
          } catch (e) {}
        } else if (item.isFile()) {
          try {
            const size = fs.statSync(full).size;
            fs.unlinkSync(full);
            deletedFiles++;
            freedBytes += size;
          } catch (err) {
            try {
              const size = fs.statSync(full).size;
              fs.truncateSync(full, 0);
              deletedFiles++;
              freedBytes += size;
            } catch (e2) {}
          }
        }
      }
    } catch (e) {}
  }

  removeRecursive(targetDir);
  return {
    success: true,
    deletedFiles,
    freedBytes,
    formattedFreed: formatBytes(freedBytes)
  };
}

// IPC Handlers
ipcMain.handle('bot:start', () => startBotProcess());
ipcMain.handle('bot:stop', () => stopBotProcess());
ipcMain.handle('bot:restart', () => restartBotProcess());
ipcMain.handle('bot:get-status', () => ({
  running: isBotRunning,
  restarting: isRestarting,
  logPath: logManager.getLogFilePath()
}));

// Global Settings Direct Disk Persistence IPC
ipcMain.handle('config:get-global', async () => {
  try {
    ensureGlobalConfigExists();
    const globalJsonPath = path.join(PROJECT_DIR, 'configs', 'global.json');
    if (fs.existsSync(globalJsonPath)) {
      return JSON.parse(fs.readFileSync(globalJsonPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to read global.json:', e);
  }
  return null;
});

ipcMain.handle('config:save-global-settings', async (event, newGlobalSettings) => {
  try {
    const globalJsonPath = path.join(PROJECT_DIR, 'configs', 'global.json');
    let data = { activeProfile: 'Default', activeProfiles: ['Default'], disabledClients: [], globalSettings: {} };
    if (fs.existsSync(globalJsonPath)) {
      try {
        data = JSON.parse(fs.readFileSync(globalJsonPath, 'utf8'));
      } catch (err) {}
    }
    data.globalSettings = { ...(data.globalSettings || {}), ...newGlobalSettings };
    fs.writeFileSync(globalJsonPath, JSON.stringify(data, null, 2), 'utf8');

    if (newGlobalSettings.webPort) {
      activeWebPort = parseInt(newGlobalSettings.webPort, 10);
    }
    return { success: true };
  } catch (e) {
    console.error('Failed to save global settings to disk:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('logs:open-folder', () => openLogFolder());
ipcMain.handle('logs:get-path', () => logManager.getLogFilePath());
ipcMain.handle('screenshots:open-folder', () => openScreenshotsFolder());

ipcMain.handle('storage:get-stats', async () => {
  const logsPath = path.join(PROJECT_DIR, 'logs');
  const screenshotsPath = path.join(PROJECT_DIR, 'screenshots');
  const logsStats = getDirStats(logsPath);
  const screenshotsStats = getDirStats(screenshotsPath);
  const totalBytes = logsStats.totalBytes + screenshotsStats.totalBytes;
  const totalFiles = logsStats.fileCount + screenshotsStats.fileCount;
  return {
    logs: logsStats,
    screenshots: screenshotsStats,
    totalBytes,
    totalFiles,
    formattedTotal: formatBytes(totalBytes)
  };
});

ipcMain.handle('storage:clear-logs', async () => {
  const logsPath = path.join(PROJECT_DIR, 'logs');
  const result = clearDirContents(logsPath);
  broadcastLog(`🧹 [Storage] Cleared ${result.deletedFiles} log files (${result.formattedFreed} freed)`, 'info');
  return result;
});

ipcMain.handle('storage:clear-screenshots', async () => {
  const screenshotsPath = path.join(PROJECT_DIR, 'screenshots');
  const result = clearDirContents(screenshotsPath);
  broadcastLog(`🧹 [Storage] Cleared ${result.deletedFiles} screenshot files (${result.formattedFreed} freed)`, 'info');
  return result;
});

ipcMain.handle('storage:clear-all', async () => {
  const logsPath = path.join(PROJECT_DIR, 'logs');
  const screenshotsPath = path.join(PROJECT_DIR, 'screenshots');
  const resLogs = clearDirContents(logsPath);
  const resScreenshots = clearDirContents(screenshotsPath);
  const totalDeleted = resLogs.deletedFiles + resScreenshots.deletedFiles;
  const totalFreed = resLogs.freedBytes + resScreenshots.freedBytes;
  const formatted = formatBytes(totalFreed);
  broadcastLog(`🧹 [Storage] Cleared all logs & screenshots: ${totalDeleted} files (${formatted} freed)`, 'info');
  return {
    success: true,
    deletedFiles: totalDeleted,
    freedBytes: totalFreed,
    formattedFreed: formatted
  };
});

// IPC Handlers for Step-by-Step Update Wizard
ipcMain.handle('update:check', async () => {
  return await updater.checkForUpdates();
});

ipcMain.handle('update:download', async () => {
  try {
    broadcastLog('📥 [Step 1] Downloading update package from GitHub...', 'info');
    const result = await updater.downloadPackage((msg) => broadcastLog(msg, 'info'));
    broadcastLog(`✅ [Step 1] Update package downloaded (${result.impact.badge})! Ready to install.`, 'success');
    return result;
  } catch (err) {
    broadcastLog(`❌ Download Failed: ${err.message}`, 'error');
    throw err;
  }
});

ipcMain.handle('update:apply', async () => {
  try {
    broadcastLog('📦 [Step 2] Installing update package files...', 'info');
    const result = await updater.applyPackage((msg) => broadcastLog(msg, 'info'));
    broadcastLog(`✅ [Step 2] Package applied successfully (${result.filesUpdated || 0} files overwritten).`, 'success');
    return result;
  } catch (err) {
    broadcastLog(`❌ Install Failed: ${err.message}`, 'error');
    throw err;
  }
});

ipcMain.handle('update:hot-reload-ui', async () => {
  broadcastLog('✨ [Level 1] Applying Seamless UI Hot-Reload (Launcher & Canvas)...', 'info');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:hot-reload');
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.reload();
      }
    }, 600);
  }
  return { success: true };
});

ipcMain.handle('update:restart-engine', async () => {
  broadcastLog('🔄 [Level 2] Restarting Bot Engine to load updated logic...', 'warn');
  await restartBotProcess();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:hot-reload');
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.reload();
      }
    }, 600);
  }
  return { success: true };
});

ipcMain.handle('update:relaunch-app', () => {
  broadcastLog('🚀 [Level 3] Relaunching NodeHotkey Launcher Application...', 'warn');
  setTimeout(() => {
    app.relaunch();
    app.exit(0);
  }, 1000);
  return { success: true };
});

ipcMain.handle('app:open-web', () => openWebDashboard());
ipcMain.handle('app:open-external', (event, targetUrl) => {
  if (targetUrl && (targetUrl.startsWith('https://') || targetUrl.startsWith('http://'))) {
    shell.openExternal(targetUrl);
  }
});

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) {
    // Hide to tray instead of quitting if user closes window
    mainWindow.hide();
  }
});

// Overlay HUD Handlers
ipcMain.on('overlay:close', () => {
  isOverlayExplicitlyClosed = true;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }

  // 1. Persist directly to configs/global.json
  try {
    const globalJsonPath = path.join(PROJECT_DIR, 'configs', 'global.json');
    if (fs.existsSync(globalJsonPath)) {
      const parsed = JSON.parse(fs.readFileSync(globalJsonPath, 'utf8'));
      if (!parsed.globalSettings) parsed.globalSettings = {};
      parsed.globalSettings.enableOverlay = false;
      fs.writeFileSync(globalJsonPath, JSON.stringify(parsed, null, 2), 'utf8');
    }
  } catch (e) {}

  // 2. Also notify running backend HTTP endpoint if available
  const currentPort = activeWebPort || getWebPortFromConfig();
  try {
    const req = http.request({
      hostname: 'localhost',
      port: currentPort,
      path: '/api/config',
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const cfg = JSON.parse(data);
          if (!cfg.globalSettings) cfg.globalSettings = {};
          cfg.globalSettings.enableOverlay = false;
          if (cfg.profiles) {
            Object.values(cfg.profiles).forEach(p => p.enableOverlay = false);
          }

          const saveReq = http.request({
            hostname: 'localhost',
            port: currentPort,
            path: '/api/config',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          saveReq.write(JSON.stringify(cfg));
          saveReq.end();
        } catch (e) {}
      });
    });
    req.on('error', () => {});
    req.end();
  } catch (e) {}
});

ipcMain.on('overlay:resize', (event, { width, height }) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    const targetW = Math.round(width) || 210;
    const targetH = Math.round(height) || 60;
    const bounds = overlayWindow.getBounds();
    if (bounds.width !== targetW || bounds.height !== targetH) {
      overlayWindow.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: targetW,
        height: targetH
      });
    }
    // Windows SetWindowPos drops HWND_TOPMOST when resizing; re-assert topmost!
    ensureOverlayAlwaysOnTop();
  }
});

ipcMain.handle('overlay:toggle', () => {
  isOverlayExplicitlyClosed = false;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
      isOverlayExplicitlyClosed = true;
    } else {
      overlayWindow.showInactive();
      ensureOverlayAlwaysOnTop();
    }
  } else {
    createOverlayWindow();
  }
  return { visible: overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible() };
});

// PiP Floating Window IPC Handlers
ipcMain.handle('pip:toggle', (event, clientId = 'master') => {
  const key = String(clientId || 'master');
  if (key === 'master') isPipMasterExplicitlyClosed = false;
  const existingWin = pipWindows.get(key);
  if (existingWin && !existingWin.isDestroyed()) {
    if (existingWin.isVisible()) {
      existingWin.close();
      pipWindows.delete(key);
      if (key === 'master') isPipMasterExplicitlyClosed = true;
      return { open: false, client: key };
    } else {
      existingWin.showInactive();
      ensurePipAlwaysOnTop(existingWin);
      return { open: true, client: key };
    }
  } else {
    createPipWindow(key);
    return { open: true, client: key };
  }
});

ipcMain.handle('pip:close', (event, clientId) => {
  const key = String(clientId || 'master');
  if (key === 'master') isPipMasterExplicitlyClosed = true;
  let win = pipWindows.get(key);
  if (!win && pipWindows.size === 1) {
    win = pipWindows.values().next().value;
  }
  if (win && !win.isDestroyed()) {
    win.close();
  }
  pipWindows.delete(key);
  return { success: true };
});

ipcMain.on('pip:resize', (event, { clientId, width, height }) => {
  const key = String(clientId || 'master');
  let win = pipWindows.get(key);
  if (!win && pipWindows.size === 1) {
    win = pipWindows.values().next().value;
  }
  if (win && !win.isDestroyed()) {
    const w = Math.round(width);
    const h = Math.round(height);
    // Bubble mode (64x64) is smaller than the normal minimum size
    win.setMinimumSize(Math.min(220, w), Math.min(140, h));
    win.setSize(w, h);
    try {
      const { screen } = require('electron');
      const b = win.getBounds();
      const wa = screen.getDisplayMatching(b).workArea;
      const nx = Math.max(wa.x, Math.min(b.x, wa.x + wa.width - b.width));
      const ny = Math.max(wa.y, Math.min(b.y, wa.y + wa.height - b.height));
      if (nx !== b.x || ny !== b.y) win.setPosition(nx, ny);
    } catch (e) {}
    ensurePipAlwaysOnTop(win);
  }
});

ipcMain.on('pip:move', (event, { clientId, dx, dy }) => {
  const key = String(clientId || 'master');
  let win = pipWindows.get(key);
  if (!win && pipWindows.size === 1) {
    win = pipWindows.values().next().value;
  }
  if (win && !win.isDestroyed()) {
    const [x, y] = win.getPosition();
    win.setPosition(Math.round(x + (dx || 0)), Math.round(y + (dy || 0)));
    ensurePipAlwaysOnTop(win);
  }
});

ipcMain.handle('pip:focus-client', async (event, clientId) => {
  try {
    const currentPort = activeWebPort || getWebPortFromConfig();
    const http = require('http');
    const req = http.request(`http://localhost:${currentPort}/api/client-focus/${clientId}`, {
      method: 'POST'
    });
    req.on('error', () => {});
    req.end();
  } catch (e) {}
});

// App Lifecycle
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    ensureOverlayAlwaysOnTop();
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Auto-start bot on launcher open
  setTimeout(() => {
    startBotProcess();
  }, 600);

  // Background health check & diagnostics heartbeat
  healthCheckInterval = setInterval(checkBotHealth, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

function exitApplicationCleanly() {
  app.isQuitting = true;
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }

  // 1. Destroy tray immediately to remove tray icon from taskbar instantly
  if (tray) {
    try { tray.destroy(); } catch (e) {}
    tray = null;
  }

  // 2. Hide and destroy all active windows
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    try { overlayWindow.destroy(); } catch (e) {}
    overlayWindow = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.destroy(); } catch (e) {}
    mainWindow = null;
  }
  pipWindows.forEach(win => {
    if (win && !win.isDestroyed()) {
      try { win.destroy(); } catch (e) {}
    }
  });
  pipWindows.clear();

  // 3. Terminate bot core process tree
  stopBotProcess();

  // 4. Clean exit with hard exit fallback to guarantee zero hang
  setTimeout(() => {
    app.quit();
    setTimeout(() => {
      process.exit(0);
    }, 300);
  }, 100);
}

app.on('before-quit', () => {
  app.isQuitting = true;
  if (healthCheckInterval) clearInterval(healthCheckInterval);
  if (tray) {
    try { tray.destroy(); } catch (e) {}
    tray = null;
  }
  stopBotProcess();
});

app.on('window-all-closed', () => {
  // Keep alive in tray on Windows
  if (process.platform !== 'darwin' && !app.isQuitting) {
    // Hidden in tray
  } else {
    exitApplicationCleanly();
  }
});

