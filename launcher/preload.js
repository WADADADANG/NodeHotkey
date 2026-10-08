const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcherAPI', {
  // Process Control
  startBot: () => ipcRenderer.invoke('bot:start'),
  stopBot: () => ipcRenderer.invoke('bot:stop'),
  restartBot: () => ipcRenderer.invoke('bot:restart'),
  getBotStatus: () => ipcRenderer.invoke('bot:get-status'),

  // Logs & Storage
  openLogFolder: () => ipcRenderer.invoke('logs:open-folder'),
  getLogPath: () => ipcRenderer.invoke('logs:get-path'),
  openScreenshotsFolder: () => ipcRenderer.invoke('screenshots:open-folder'),
  getStorageStats: () => ipcRenderer.invoke('storage:get-stats'),
  clearLogs: () => ipcRenderer.invoke('storage:clear-logs'),
  clearScreenshots: () => ipcRenderer.invoke('storage:clear-screenshots'),
  clearAllStorage: () => ipcRenderer.invoke('storage:clear-all'),

  // Global Config Disk Persistence
  getGlobalConfig: () => ipcRenderer.invoke('config:get-global'),
  saveGlobalSettings: (settings) => ipcRenderer.invoke('config:save-global-settings', settings),

  // Updater (Step-by-Step Wizard & Multi-Tier Control)
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  applyUpdate: () => ipcRenderer.invoke('update:apply'),
  hotReloadUi: () => ipcRenderer.invoke('update:hot-reload-ui'),
  restartEngine: () => ipcRenderer.invoke('update:restart-engine'),
  relaunchApp: () => ipcRenderer.invoke('update:relaunch-app'),

  // External & UI
  openWebDashboard: () => ipcRenderer.invoke('app:open-web'),
  openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Overlay HUD Controls
  closeOverlay: () => ipcRenderer.send('overlay:close'),
  resizeOverlay: (w, h) => ipcRenderer.send('overlay:resize', { width: w, height: h }),
  toggleOverlay: () => ipcRenderer.invoke('overlay:toggle'),

  // Dedicated PiP Floating Window Controls
  togglePiP: (clientId) => ipcRenderer.invoke('pip:toggle', clientId),
  closePiP: (clientId) => ipcRenderer.invoke('pip:close', clientId),
  resizePiP: (clientId, w, h) => ipcRenderer.send('pip:resize', { clientId, width: w, height: h }),
  movePiP: (clientId, dx, dy) => ipcRenderer.send('pip:move', { clientId, dx, dy }),
  focusGameClient: (clientId) => ipcRenderer.invoke('pip:focus-client', clientId),
  onPipInit: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('pip:init', subscription);
    return () => ipcRenderer.removeListener('pip:init', subscription);
  },
  onPipSetClient: (callback) => {
    const subscription = (event, clientId) => callback(clientId);
    ipcRenderer.on('pip:set-client', subscription);
    return () => ipcRenderer.removeListener('pip:set-client', subscription);
  },
  onPipUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('pip:update', subscription);
    return () => ipcRenderer.removeListener('pip:update', subscription);
  },

  // Event Listeners from Main Process
  onOverlayUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('overlay:update', subscription);
    return () => ipcRenderer.removeListener('overlay:update', subscription);
  },
  onLogMessage: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('bot:log', subscription);
    return () => ipcRenderer.removeListener('bot:log', subscription);
  },
  onStatusChange: (callback) => {
    const subscription = (event, status) => callback(status);
    ipcRenderer.on('bot:status-change', subscription);
    return () => ipcRenderer.removeListener('bot:status-change', subscription);
  },
  onDiagnosticsUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('bot:diagnostics', subscription);
    return () => ipcRenderer.removeListener('bot:diagnostics', subscription);
  },
  onHotReload: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('app:hot-reload', subscription);
    return () => ipcRenderer.removeListener('app:hot-reload', subscription);
  }
});
