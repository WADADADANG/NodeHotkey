const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg'
};

const { readConfig, writeConfig } = require('./config-store');
const { checkForUpdates, getUpdateStatus } = require('./update-checker');

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(JSON.stringify(data, null, 2));
}

const { getCooldownPresets, getCooldownPresetsById, getClassIcons } = require('./cooldown-manager');

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  // --- SSE /api/signals/stream → Real-time Execution Signal Stream ---
  if (urlPath === '/api/signals/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(':\n\n');

    const intervalTimer = setInterval(() => {
      if (global.executionSignals && global.executionSignals.length > 0) {
        const batch = [...global.executionSignals];
        global.executionSignals = [];
        res.write(`data: ${JSON.stringify(batch)}\n\n`);
      }
    }, 50);

    req.on('close', () => {
      clearInterval(intervalTimer);
    });
    return;
  }

  // --- GET /api/update-check → returns GitHub update status ---
  if (urlPath === '/api/update-check' && req.method === 'GET') {
    return sendJSON(res, 200, { success: true, ...getUpdateStatus() });
  }

  // --- GET /api/cooldown-presets → list all skill cooldown presets ---
  if (urlPath === '/api/cooldown-presets' && req.method === 'GET') {
    const presets = getCooldownPresets();
    return sendJSON(res, 200, { success: true, presets, presetsById: getCooldownPresetsById(), classIcons: getClassIcons() });
  }

function getClientStatusesPayload() {
  if (typeof global.getClientStatuses === 'function') {
    return global.getClientStatuses();
  }
  const activeList = global.activeClients || [];
  const clientStatuses = {};

  activeList.forEach(clientIdx => {
    const clientStr = String(clientIdx);
    const activeActions = global.activeActions || [];
    const activeLoopStates = global.activeLoopStates || {};
    const activeHoldStates = global.activeHoldStates || {};
    const pressedRemapKeys = global.pressedRemapKeys || {};

    // 1. Buff sequence running?
    if (global.isBuffSequenceRunning && global.isBuffSequenceRunning[clientStr]) {
      const buffAct = activeActions.find(a => a.mode === 'buff_sequence' && (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all'));
      clientStatuses[clientStr] = {
        status: buffAct ? buffAct.name : "Buffing",
        type: "buff"
      };
    // 2. Loop running?
    } else if (activeActions.find(a =>
      a.mode === 'loop' && a.enabled &&
      activeLoopStates[a.id] && activeLoopStates[a.id].running &&
      (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all')
    )) {
      const activeLoop = activeActions.find(a =>
        a.mode === 'loop' && a.enabled &&
        activeLoopStates[a.id] && activeLoopStates[a.id].running &&
        (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all')
      );
      clientStatuses[clientStr] = {
        status: activeLoop.name,
        type: "loop"
      };
    // 3. Key Hold active?
    } else if (activeActions.find(a =>
      a.mode === 'key_hold' && a.enabled && activeHoldStates[a.id] &&
      (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all')
    )) {
      const activeHold = activeActions.find(a =>
        a.mode === 'key_hold' && a.enabled && activeHoldStates[a.id] &&
        (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all')
      );
      clientStatuses[clientStr] = {
        status: activeHold.name || `Hold: ${activeHold.targetKey}`,
        type: "hold"
      };
    // 4. Key Forward active?
    } else if (activeActions.find(a =>
      a.mode === 'forward' && a.enabled && pressedRemapKeys[`${a.id}-${clientStr}`] &&
      (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all')
    )) {
      const activeForward = activeActions.find(a =>
        a.mode === 'forward' && a.enabled && pressedRemapKeys[`${a.id}-${clientStr}`] &&
        (a.targetClient === clientStr || a.targetClient === 'both' || a.targetClient === 'all')
      );
      clientStatuses[clientStr] = {
        status: activeForward.name || `${activeForward.trigger.value} ➜ ${activeForward.targetKey}`,
        type: "forward"
      };
    } else {
      clientStatuses[clientStr] = {
        status: "Standby",
        type: "standby"
      };
    }
  });

  return clientStatuses;
}

  // --- GET /api/config → full config + active runtime state ---
  if (urlPath === '/api/config' && req.method === 'GET') {
    const config = readConfig();
    if (!config) return sendJSON(res, 500, { error: 'Failed to read config' });
    return sendJSON(res, 200, {
      ...config,
      activeClients: global.activeClients || [],
      clientStatuses: getClientStatusesPayload(),
      isSuspended: !!global.isSuspended,
      disabledClients: global.disabledClients || []
    });
  }

  // --- GET /api/status or /api/active-clients → active clients list & their statuses ---
  if ((urlPath === '/api/status' || urlPath === '/api/active-clients') && req.method === 'GET') {
    const activeList = global.activeClients || [];
    const clientStatuses = getClientStatusesPayload();
    const cfg = readConfig() || {};
    const gs = cfg.globalSettings || {};

    return sendJSON(res, 200, {
      activeClients: activeList,
      clientStatuses: clientStatuses,
      clientAliases: global.clientAliases || {},
      isSuspended: !!global.isSuspended,
      disabledClients: global.disabledClients || [],
      enableOverlay: gs.enableOverlay !== undefined ? !!gs.enableOverlay : true
    });
  }

  // --- POST /api/client/toggle-enable → toggle enable/disable per client ---
  if (urlPath === '/api/client/toggle-enable' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { clientIndex } = JSON.parse(body);
        const clientStr = String(clientIndex);
        if (!global.disabledClients) global.disabledClients = [];
        const idx = global.disabledClients.indexOf(clientStr);
        if (idx > -1) {
          global.disabledClients.splice(idx, 1);
          console.log(`[Server] 🟢 Enabled Client ${clientStr}`);
        } else {
          global.disabledClients.push(clientStr);
          console.log(`[Server] 🔴 Disabled Client ${clientStr}`);
        }
        
        // Sync to config
        const config = readConfig();
        if (config) {
          config.disabledClients = global.disabledClients;
          const currentProfile = config.activeProfile;
          if (config.profiles[currentProfile]) {
            config.profiles[currentProfile].disabledClients = global.disabledClients;
          }
          writeConfig(config);
        }
        if (typeof global.sendOverlayUpdate === 'function') {
          global.sendOverlayUpdate();
        }
        return sendJSON(res, 200, { success: true, disabledClients: global.disabledClients });
      } catch (e) {
        return sendJSON(res, 400, { error: e.message });
      }
    });
    return;
  }

  // --- POST /api/client/launch → launch browser client dynamically ---
  if (urlPath === '/api/client/launch' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { clientIndex, browserChoice } = JSON.parse(body);
        if (typeof global.launchSingleClient === 'function') {
          const resObj = await global.launchSingleClient(clientIndex, browserChoice);
          return sendJSON(res, 200, resObj);
        }
        return sendJSON(res, 500, { error: 'launchSingleClient not ready' });
      } catch (e) {
        return sendJSON(res, 400, { error: e.message });
      }
    });
    return;
  }

  // --- POST /api/client/close → close browser client dynamically ---
  if (urlPath === '/api/client/close' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { clientIndex } = JSON.parse(body);
        if (typeof global.closeSingleClient === 'function') {
          const resObj = await global.closeSingleClient(clientIndex);
          return sendJSON(res, 200, resObj);
        }
        return sendJSON(res, 500, { error: 'closeSingleClient not ready' });
      } catch (e) {
        return sendJSON(res, 400, { error: e.message });
      }
    });
    return;
  }

  // --- POST /api/suspend/toggle → toggle suspend state ---
  if (urlPath === '/api/suspend/toggle' && req.method === 'POST') {
    if (typeof global.toggleSuspendState === 'function') {
      const newState = global.toggleSuspendState();
      return sendJSON(res, 200, { success: true, isSuspended: newState });
    } else {
      return sendJSON(res, 500, { error: 'Suspend toggler not initialized' });
    }
  }

  // --- POST /api/overlay/disable → toggle off overlay config ---
  if (urlPath === '/api/overlay/disable' && req.method === 'POST') {
    const config = readConfig();
    if (!config) return sendJSON(res, 500, { error: 'Config read failed' });
    const currentProfile = config.activeProfile;
    if (config.profiles[currentProfile]) {
      config.profiles[currentProfile].enableOverlay = false;
      writeConfig(config);
      console.log(`[Server] Disabled overlay in config profile: ${currentProfile}`);
      sendJSON(res, 200, { success: true });
    } else {
      sendJSON(res, 400, { error: 'Active profile not found' });
    }
    return;
  }

  // --- POST /api/config → save profile settings or full config ---
  if (urlPath === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (payload && payload.profiles) {
          writeConfig(payload);
          console.log(`[Server] Saved full config (active: ${payload.activeProfile})`);
          sendJSON(res, 200, { success: true });
        } else if (payload && payload.profileName && payload.profileData) {
          const config = readConfig();
          if (!config) return sendJSON(res, 500, { error: 'Config read failed' });
          config.profiles[payload.profileName] = payload.profileData;
          writeConfig(config);
          console.log(`[Server] Saved profile: ${payload.profileName}`);
          sendJSON(res, 200, { success: true });
        } else {
          sendJSON(res, 400, { error: 'Invalid payload structure' });
        }
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  // --- POST /api/profile/new → create new profile ---
  if (urlPath === '/api/profile/new' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name, copyFrom } = JSON.parse(body);
        if (!name || name.trim() === '') return sendJSON(res, 400, { error: 'Profile name required' });
        const config = readConfig();
        if (config.profiles[name]) return sendJSON(res, 409, { error: 'Profile already exists' });
        // Copy from specified profile or create blank
        if (!copyFrom || copyFrom.trim() === '') {
          config.profiles[name] = {
            targetUrlKeyword: "universe.flyff.com",
            actions: []
          };
        } else {
          const source = config.profiles[copyFrom] || config.profiles['Default'] || Object.values(config.profiles)[0];
          config.profiles[name] = JSON.parse(JSON.stringify(source));
        }
        writeConfig(config);
        console.log(`[Server] Created profile: ${name}`);
        sendJSON(res, 200, { success: true });
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  // --- POST /api/profile/delete → delete profile ---
  if (urlPath === '/api/profile/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name } = JSON.parse(body);
        if (name === 'Default') return sendJSON(res, 403, { error: 'Cannot delete Default profile' });
        const config = readConfig();
        if (!config.profiles[name]) return sendJSON(res, 404, { error: 'Profile not found' });
        delete config.profiles[name];
        if (config.activeProfile === name) config.activeProfile = 'Default';
        if (Array.isArray(config.activeProfiles)) {
          config.activeProfiles = config.activeProfiles.filter(p => p !== name);
          if (config.activeProfiles.length === 0) config.activeProfiles = ['Default'];
        }
        writeConfig(config);
        console.log(`[Server] Deleted profile: ${name}`);
        sendJSON(res, 200, { success: true, activeProfiles: config.activeProfiles });
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  // --- POST /api/profile/rename → rename profile ---
  if (urlPath === '/api/profile/rename' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { oldName, newName } = JSON.parse(body);
        if (!oldName || !newName || newName.trim() === '') {
          return sendJSON(res, 400, { error: 'Profile name required' });
        }
        const trimmedNew = newName.trim();
        const config = readConfig();
        if (!config.profiles[oldName]) {
          return sendJSON(res, 404, { error: 'Profile not found' });
        }
        if (oldName !== trimmedNew && config.profiles[trimmedNew]) {
          return sendJSON(res, 409, { error: 'A profile with that name already exists' });
        }

        if (oldName !== trimmedNew) {
          config.profiles[trimmedNew] = config.profiles[oldName];
          delete config.profiles[oldName];
          if (config.activeProfile === oldName) {
            config.activeProfile = trimmedNew;
          }
          if (Array.isArray(config.activeProfiles)) {
            config.activeProfiles = config.activeProfiles.map(p => p === oldName ? trimmedNew : p);
          }
          writeConfig(config);
          console.log(`[Server] Renamed profile "${oldName}" to "${trimmedNew}"`);
        }
        sendJSON(res, 200, { success: true, activeProfiles: config.activeProfiles });
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  // --- POST /api/profile/activate → switch active profile (single active) ---
  if (urlPath === '/api/profile/activate' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name } = JSON.parse(body);
        const config = readConfig();
        if (!config.profiles[name]) return sendJSON(res, 404, { error: 'Profile not found' });
        config.activeProfile = name;
        config.activeProfiles = [name];
        writeConfig(config);
        console.log(`[Server] Active profile set to: ${name}`);
        sendJSON(res, 200, { success: true, activeProfiles: config.activeProfiles });
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  // --- POST /api/profile/set-active-list → set exact list of active profiles ---
  if (urlPath === '/api/profile/set-active-list' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { activeProfiles } = JSON.parse(body);
        const config = readConfig();
        config.activeProfiles = Array.isArray(activeProfiles) ? activeProfiles.filter(p => config.profiles[p]) : [];
        config.activeProfile = config.activeProfiles[0] || '';
        writeConfig(config);
        console.log(`[Server] Batch set active profiles: [${config.activeProfiles.join(', ')}]`);
        sendJSON(res, 200, { success: true, activeProfiles: config.activeProfiles, activeProfile: config.activeProfile });
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  // --- POST /api/profile/toggle-active → toggle profile active state in activeProfiles list ---
  if (urlPath === '/api/profile/toggle-active' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name, active } = JSON.parse(body);
        const config = readConfig();
        if (!config.profiles[name]) return sendJSON(res, 404, { error: 'Profile not found' });
        if (!Array.isArray(config.activeProfiles)) config.activeProfiles = [config.activeProfile || 'Default'];
        
        const isCurrentlyActive = config.activeProfiles.includes(name);
        const shouldBeActive = (active !== undefined) ? !!active : !isCurrentlyActive;
        
        if (shouldBeActive) {
          if (!config.activeProfiles.includes(name)) config.activeProfiles.push(name);
        } else {
          config.activeProfiles = config.activeProfiles.filter(p => p !== name);
        }
        config.activeProfile = config.activeProfiles[0] || '';
        writeConfig(config);
        console.log(`[Server] Profile "${name}" active status: ${shouldBeActive}. Active profiles: [${config.activeProfiles.join(', ')}]`);
        sendJSON(res, 200, { success: true, activeProfiles: config.activeProfiles, activeProfile: config.activeProfile });
      } catch (e) {
        sendJSON(res, 400, { error: 'Invalid payload' });
      }
    });
    return;
  }

  // --- POST /api/sound/upload → upload audio file and save to public/sounds ---
  if (urlPath === '/api/sound/upload' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { filename, base64Data } = JSON.parse(body);
        if (!filename || !base64Data) {
          return sendJSON(res, 400, { error: 'Filename and base64Data required' });
        }
        const soundsDir = path.join(PUBLIC_DIR, 'sounds');
        if (!fs.existsSync(soundsDir)) {
          fs.mkdirSync(soundsDir, { recursive: true });
        }
        const cleanName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = path.join(soundsDir, cleanName);
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        console.log(`[Server] Saved sound file: ${cleanName} (${buffer.length} bytes)`);
        sendJSON(res, 200, { success: true, url: `/sounds/${cleanName}`, filename: cleanName });
      } catch (e) {
        sendJSON(res, 500, { error: e.message });
      }
    });
    return;
  }

  // --- Static file serving ---
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  let fullPath = path.join(PUBLIC_DIR, filePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n⚠️ [Server Error] Port ${PORT} is currently in use by a previous Node session!`);
    console.error(`👉 Retrying automatically after clearing Port ${PORT}...`);
    try {
      require('child_process').execSync(`npx --yes kill-port ${PORT}`);
      setTimeout(() => {
        server.listen(PORT, () => {
          console.log(`[Server] Running at http://localhost:${PORT}/`);
        });
      }, 1000);
    } catch (err) {
      console.error(`❌ Could not auto-clear port. Please run 'npm start' again.`);
    }
  }
});

server.listen(PORT, () => {
  console.log(`[Server] Running at http://localhost:${PORT}/`);
  setTimeout(() => checkForUpdates(), 1500);
});
