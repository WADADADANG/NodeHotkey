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
