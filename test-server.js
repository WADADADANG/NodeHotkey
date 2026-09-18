const http = require('http');
const fs = require('fs');
const path = require('path');

const { readConfig, writeConfig, readSingleProfile, writeSingleProfile, initProfileWatcher } = require('./config-store');
const { checkForUpdates, getUpdateStatus } = require('./update-checker');

// Profile External Event Stream (SSE)
const profileSseClients = new Set();
function broadcastProfileEvent(eventData) {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const client of profileSseClients) {
    try {
      client.write(payload);
    } catch (e) {
      profileSseClients.delete(client);
    }
  }
}

function getInitialPort() {
  if (process.env.PORT) {
    const p = parseInt(process.env.PORT, 10);
    if (!isNaN(p) && p > 0) return p;
  }
  try {
    const cfg = readConfig();
    if (cfg && cfg.globalSettings && cfg.globalSettings.webPort) {
      const p = parseInt(cfg.globalSettings.webPort, 10);
      if (!isNaN(p) && p > 0) return p;
    }
  } catch (e) { }
  return 3088;
}

let PORT = getInitialPort();
global.activeServerPort = PORT;

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

  // --- SSE /api/profile-events/stream → Real-time Profile External File Modification Stream ---
  if (urlPath === '/api/profile-events/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);
    profileSseClients.add(res);

    req.on('close', () => {
      profileSseClients.delete(res);
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
      port: PORT,
      serverPort: PORT,
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
      port: PORT,
      serverPort: PORT,
      activeClients: activeList,
      clientStatuses: clientStatuses,
      clientAliases: global.clientAliases || {},
      isSuspended: !!global.isSuspended,
      disabledClients: global.disabledClients || [],
      enableOverlay: gs.enableOverlay !== undefined ? !!gs.enableOverlay : true,
      activeProfiles: cfg.activeProfiles || (cfg.activeProfile ? [cfg.activeProfile] : ['Default']),
      activeProfile: cfg.activeProfile || (cfg.activeProfiles && cfg.activeProfiles[0]) || 'Default'
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

  // --- POST /api/client/reset-bounds → reset saved bounds and reposition live window ---
  if (urlPath === '/api/client/reset-bounds' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { clientIndex } = JSON.parse(body || '{}');
        if (typeof global.resetClientWindowBounds === 'function') {
          const resObj = await global.resetClientWindowBounds(clientIndex);
          return sendJSON(res, 200, resObj);
        }
        return sendJSON(res, 200, { success: true });
      } catch (e) {
        return sendJSON(res, 400, { error: e.message });
      }
    });
    return;
  }

  // --- POST / GET /api/trigger/:eventName → Inbound Webhook Trigger ---
  if (urlPath.startsWith('/api/trigger/')) {
    const rawEvent = urlPath.replace('/api/trigger/', '').trim();
    const eventName = decodeURIComponent(rawEvent);
    if (!eventName) {
      return sendJSON(res, 400, { error: 'Event name is required' });
    }

    const executeTrigger = (payloadData) => {
      if (typeof global.triggerWebhookEvent === 'function') {
        const result = global.triggerWebhookEvent(eventName, payloadData);
        console.log(`[Server] 🌐 Inbound Webhook Event received: "${eventName}" (Matched: ${result.count})`);
        return sendJSON(res, 200, {
          success: true,
          event: eventName,
          matchedTriggers: result.count,
          executedActions: result.actions
        });
      } else {
        return sendJSON(res, 503, { error: 'Bot Engine / Webhook Trigger handler not ready' });
      }
    };

    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        let payloadData = null;
        try { payloadData = body ? JSON.parse(body) : null; } catch (e) { payloadData = body; }
        executeTrigger(payloadData);
      });
    } else {
      executeTrigger(null);
    }
    return;
  }

  // --- POST /api/webhook/test → Test fire an outbound webhook from Studio Inspector ---
  if (urlPath === '/api/webhook/test' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { url, method = 'POST', headers = {}, payload, timeoutMs = 5000 } = JSON.parse(body);
        if (!url) return sendJSON(res, 400, { error: 'URL is required' });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), parseInt(timeoutMs, 10) || 5000);

        let parsedHeaders = {};
        if (typeof headers === 'string') {
          try { parsedHeaders = JSON.parse(headers); } catch (e) { }
        } else if (typeof headers === 'object' && headers !== null) {
          parsedHeaders = headers;
        }
        if (!parsedHeaders['Content-Type'] && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
          parsedHeaders['Content-Type'] = 'application/json';
        }

        const reqBody = (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD' && payload !== undefined && payload !== '')
          ? (typeof payload === 'string' ? payload : JSON.stringify(payload))
          : undefined;

        const response = await fetch(url, {
          method: method.toUpperCase(),
          headers: parsedHeaders,
          body: reqBody,
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        let responseText = '';
        try { responseText = await response.text(); } catch (e) { }

        sendJSON(res, 200, {
          success: response.ok,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText.slice(0, 1000)
        });
      } catch (err) {
        sendJSON(res, 500, { error: err.message });
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

  // --- GET /api/profile-data → get single profile fresh from disk ---
  if (urlPath === '/api/profile-data' && req.method === 'GET') {
    try {
      const urlObj = new URL(req.url, `http://localhost:${PORT}`);
      const profileName = urlObj.searchParams.get('name');
      if (!profileName) return sendJSON(res, 400, { error: 'Profile name required' });
      const profile = readSingleProfile(profileName);
      if (!profile) return sendJSON(res, 404, { error: 'Profile not found on disk' });
      return sendJSON(res, 200, { success: true, profile });
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  // --- POST /api/profile/overwrite → force overwrite a profile with UI data (Conflict resolution) ---
  if (urlPath === '/api/profile/overwrite' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { name, profileData } = JSON.parse(body);
        if (!name || !profileData) return sendJSON(res, 400, { error: 'Missing name or profileData' });
        writeSingleProfile(name, profileData);
        console.log(`[Server] 💾 Overwrote profile on disk: "${name}"`);
        return sendJSON(res, 200, { success: true });
      } catch (e) {
        return sendJSON(res, 400, { error: 'Invalid JSON payload' });
      }
    });
    return;
  }

  // --- GET /api/nodes → list all modular registered nodes ---
  if (urlPath === '/api/nodes' && req.method === 'GET') {
    try {
      const { nodeRegistry } = require('./node-registry');
      if (!nodeRegistry.isLoaded) {
        nodeRegistry.loadAll();
      }
      const list = nodeRegistry.getAll().map(def => ({
        type: def.type,
        aliases: def.aliases || [],
        title: def.title || def.type,
        category: def.category || 'Custom',
        icon: def.icon || '🧩',
        color: def.color || '#3b82f6',
        isPure: !!def.isPure,
        inputs: def.inputs || ['in'],
        outputs: def.outputs || ['onComplete', 'onError'],
        dataOutputs: def.dataOutputs || [],
        defaultData: def.defaultData || {},
        schema: def.schema || null,
        summaryFields: def.summaryFields || null
      }));
      sendJSON(res, 200, { success: true, nodes: list });
    } catch (e) {
      sendJSON(res, 500, { error: e.message });
    }
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

  // --- POST /api/open-folder → open folder in Windows Explorer ---
  if (urlPath === '/api/open-folder' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { subfolder } = JSON.parse(body || '{}');
        const rawSub = subfolder ? String(subfolder).trim().replace(/[\\/:*?"<>|]/g, '_') : '';
        const targetDir = path.join(__dirname, 'screenshots', rawSub);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
        const { exec } = require('child_process');
        if (process.platform === 'win32') {
          exec(`explorer "${targetDir.replace(/\//g, '\\')}"`);
        } else if (process.platform === 'darwin') {
          exec(`open "${targetDir}"`);
        } else {
          exec(`xdg-open "${targetDir}"`);
        }
        console.log(`[Server] Opened folder in explorer: ${targetDir}`);
        sendJSON(res, 200, { success: true, path: targetDir });
      } catch (e) {
        console.error('[Server] Failed to open folder:', e.message);
        sendJSON(res, 500, { error: e.message });
      }
    });
    return;
  }

  // --- Static serving for screenshots (including subfolders) ---
  if (urlPath.startsWith('/screenshots/')) {
    const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
    const relPath = decodeURIComponent(urlPath.replace(/^\/screenshots\//, ''));
    const fullPath = path.join(SCREENSHOTS_DIR, relPath);

    if (!fullPath.startsWith(SCREENSHOTS_DIR)) {
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
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      fs.createReadStream(fullPath).pipe(res);
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
    console.warn(`\n⚠️ [Server Warning] Port ${PORT} is currently in use!`);
    const nextPort = PORT + 1;
    console.log(`👉 Trying next available port: ${nextPort}...`);
    PORT = nextPort;
    global.activeServerPort = PORT;
    setTimeout(() => {
      server.listen(PORT, () => {
        global.activeServerPort = PORT;
        console.log(`[Server] Running at http://localhost:${PORT}/`);
      });
    }, 500);
  } else {
    console.error(`❌ [Server Error]:`, e.message);
  }
});

server.listen(PORT, () => {
  global.activeServerPort = PORT;
  console.log(`[Server] Running at http://localhost:${PORT}/`);
  setTimeout(() => checkForUpdates(), 1500);

  // Initialize Profile File Watcher & External Change Broadcast
  initProfileWatcher((change) => {
    broadcastProfileEvent({
      type: 'PROFILE_EXTERNAL_CHANGE',
      ...change
    });

    // Hot-reload in bot engine if active profile
    try {
      const cfg = readConfig();
      if (cfg && Array.isArray(cfg.activeProfiles) && cfg.activeProfiles.includes(change.profileName)) {
        if (global.activeWorkflowEngine && typeof global.activeWorkflowEngine.loadProfile === 'function') {
          const fresh = readSingleProfile(change.profileName);
          if (fresh) {
            global.activeWorkflowEngine.loadProfile(fresh);
            console.log(`[Server] ⚡ Hot-reloaded active profile into Engine: "${change.profileName}"`);
          }
        }
      }
    } catch (e) {
      console.warn('[Server] Error during engine profile hot-reload:', e.message);
    }
  });
});
