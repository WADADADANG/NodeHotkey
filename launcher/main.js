const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-finish-load', () => {
    broadcastStatus();
    checkBotHealth();
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
        label: `⚡ NodeHotkey Launcher (${statusText})`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: isBotRunning ? '🛑 Stop Bot Engine' : '▶️ Start Bot Engine',
        click: () => {
          if (isBotRunning) stopBotProcess();
          else startBotProcess();
        }
      },
      {
        label: '🔄 Restart Bot Engine',
        enabled: isBotRunning,
        click: () => restartBotProcess()
      },
      {
        label: '🌐 Open Web Dashboard',
        click: () => openWebDashboard()
      },
      {
        label: '📂 Open Logs Folder',
        click: () => openLogFolder()
      },
      {
        label: '🪟 Toggle HUD Overlay',
        click: () => {
          isOverlayExplicitlyClosed = false;
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            if (overlayWindow.isVisible()) {
              overlayWindow.hide();
              isOverlayExplicitlyClosed = true;
            } else {
              overlayWindow.show();
            }
          } else {
            createOverlayWindow();
          }
        }
      },
      { type: 'separator' },
      {
        label: '🗗 Show Launcher Window',
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
        label: '❌ Exit All',
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

  // 3. Actions / Hotkeys / Triggers / CDP (การกดปุ่ม / รัน workflow)
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

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
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
    skipTaskbar: true, // 100% hidden from Taskbar!
    resizable: false, // Disables manual cursor border resizing
    hasShadow: false,
    useContentSize: true,
    icon: path.join(PROJECT_DIR, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  overlayWindow.loadFile(path.join(__dirname, 'ui', 'overlay.html'));

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function checkBotHealth() {
  const req = http.get('http://localhost:3000/api/config', { timeout: 1500 }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('bot:diagnostics', {
            serverOnline: true,
            port: 3000,
            activeProfiles: json.activeProfiles || [json.activeProfile || 'Default'],
            activeClientsCount: json.activeClients ? json.activeClients.length : 0
          });
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
            if (!overlayWindow.isVisible()) overlayWindow.show();
            overlayWindow.webContents.send('overlay:update', {
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
      } catch (e) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('bot:diagnostics', { serverOnline: true, port: 3000 });
        }
      }
    });
  });

  req.on('error', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('bot:diagnostics', {
        serverOnline: false,
        port: 3000,
        error: isBotRunning ? 'Server is starting or port unreachable' : 'Stopped'
      });
    }
  });

  req.on('timeout', () => req.destroy());
}

// Bot Process Management
function startBotProcess() {
  if (isBotRunning || botProcess) return { success: true, alreadyRunning: true };

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
            if (overlayWindow && !overlayWindow.isDestroyed()) {
              overlayWindow.webContents.send('overlay:update', overlayData);
            }
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
      checkBotHealth();
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay:update', { activeClients: [], clientStatuses: {}, isSuspended: false });
      }
    });

    botProcess.on('error', (err) => {
      broadcastLog(`❌ Failed to start NodeHotkey: ${err.message}`, 'error');
      botProcess = null;
      isBotRunning = false;
      broadcastStatus();
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.webContents.send('overlay:update', { activeClients: [], clientStatuses: {}, isSuspended: false });
      }
    });

    // Start periodic health checking
    if (healthCheckInterval) clearInterval(healthCheckInterval);
    healthCheckInterval = setInterval(checkBotHealth, 3000);

    return { success: true };
  } catch (err) {
    broadcastLog(`❌ Spawn Error: ${err.message}`, 'error');
    isBotRunning = false;
    broadcastStatus();
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
  checkBotHealth();
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay:update', { activeClients: [], clientStatuses: {}, isSuspended: false });
  }
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
  shell.openExternal('http://localhost:3000/');
}

function openLogFolder() {
  const dir = logManager.getLogDirectory();
  shell.openPath(dir);
  return { success: true, path: dir };
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

ipcMain.handle('logs:open-folder', () => openLogFolder());
ipcMain.handle('logs:get-path', () => logManager.getLogFilePath());

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

  // Persist disable to backend config
  try {
    const postData = JSON.stringify({ action: 'disable-overlay' });
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
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
            port: 3000,
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
    overlayWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: targetW,
      height: targetH
    });
  }
});

ipcMain.handle('overlay:toggle', () => {
  isOverlayExplicitlyClosed = false;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
      isOverlayExplicitlyClosed = true;
    } else {
      overlayWindow.show();
    }
  } else {
    createOverlayWindow();
  }
  return { visible: overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible() };
});

// App Lifecycle
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
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

