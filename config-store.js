const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { convertLegacyProfileToNodeWorkflow, isNodeWorkflowProfile } = require('./converter');

const CONFIGS_DIR = path.join(__dirname, 'configs');
const PROFILES_DIR = path.join(CONFIGS_DIR, 'profiles');
const GLOBAL_CONFIG_PATH = path.join(CONFIGS_DIR, 'global.json');
const LEGACY_CONFIG_PATH = path.join(__dirname, 'config.json');

// File Hash & Internal Save Lock Tracking
const lastKnownProfileHashes = new Map(); // filename -> sha1
const internalWriteLocks = new Map(); // filename -> timestamp

function computeFileHash(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha1').update(content).digest('hex');
  } catch (e) {
    return null;
  }
}

// Ensure directory structure exists
function ensureDirs() {
  if (!fs.existsSync(CONFIGS_DIR)) {
    fs.mkdirSync(CONFIGS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROFILES_DIR)) {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
  }
}

// Migrate legacy single config.json to configs/ directory
function migrateLegacyConfig() {
  ensureDirs();
  if (!fs.existsSync(LEGACY_CONFIG_PATH)) return;

  try {
    const raw = fs.readFileSync(LEGACY_CONFIG_PATH, 'utf8');
    const legacy = JSON.parse(raw);

    // Save global settings
    const activeProfile = legacy.activeProfile || 'Default';
    const globalSettings = legacy.globalSettings || {
      targetUrlKeyword: "universe.flyff.com/play",
      enableOverlay: true,
      suspendHotkey: "END",
      ghostMouseJitter: { enabled: false, intervalMin: 8000, intervalMax: 25000, maxOffset: 12 },
      clientAliases: {},
      clientUserAgents: {},
      clientProxies: {}
    };
    const disabledClients = legacy.disabledClients || [];

    const globalData = {
      activeProfile,
      disabledClients,
      globalSettings
    };
    fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(globalData, null, 2), 'utf8');

    // Save individual profile files
    const profiles = legacy.profiles || {};
    for (const [pName, pData] of Object.entries(profiles)) {
      const sanitizedName = pName.replace(/[/\\?%*:|"<>]/g, '_');
      const pFile = path.join(PROFILES_DIR, `${sanitizedName}.json`);
      const profileData = {
        name: pName,
        actions: pData.actions || []
      };
      fs.writeFileSync(pFile, JSON.stringify(profileData, null, 2), 'utf8');
    }

    // Rename legacy file to config.json.bak
    const bakPath = path.join(__dirname, 'config.json.bak');
    fs.renameSync(LEGACY_CONFIG_PATH, bakPath);
    console.log(`[Config Store] 🚀 Migrated legacy config.json into configs/ folder successfully! (Backup: config.json.bak)`);
  } catch (e) {
    console.error(`[Config Store Error] Migration failed:`, e.message);
  }
}

function sanitizeProfileIds(profile) {
  if (!profile) return profile;
  if (Array.isArray(profile.nodes)) {
    profile.nodes.forEach(n => {
      if (n.data) {
        if (Array.isArray(n.data.controlTargetIds)) {
          n.data.controlTargetIds = n.data.controlTargetIds.map(id => id.startsWith('node_') ? id.replace('node_', '') : id);
        }
        if (n.data.conditionTargetId && n.data.conditionTargetId.startsWith('node_')) {
          n.data.conditionTargetId = n.data.conditionTargetId.replace('node_', '');
        }
      }
    });
  }
  if (Array.isArray(profile.actions)) {
    profile.actions.forEach(a => {
      if (Array.isArray(a.controlTargetIds)) {
        a.controlTargetIds = a.controlTargetIds.map(id => id.startsWith('node_') ? id.replace('node_', '') : id);
      }
      if (a.conditionTargetId && a.conditionTargetId.startsWith('node_')) {
        a.conditionTargetId = a.conditionTargetId.replace('node_', '');
      }
    });
  }
  return profile;
}

// Read and assemble full configuration object
function readConfig() {
  ensureDirs();
  if (fs.existsSync(LEGACY_CONFIG_PATH)) {
    migrateLegacyConfig();
  }

  let activeProfile = 'Default';
  let activeProfiles = [];
  let disabledClients = [];
  let globalSettings = {
    targetUrlKeyword: "universe.flyff.com/play",
    enableOverlay: true,
    suspendHotkey: "END",
    webPort: 3088,
    ghostMouseJitter: { enabled: false, intervalMin: 8000, intervalMax: 25000, maxOffset: 12 },
    clientAliases: {},
    clientUserAgents: {},
    clientProxies: {}
  };

  if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
    try {
      const globalRaw = fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8');
      const gParsed = JSON.parse(globalRaw);
      if (gParsed.activeProfile) activeProfile = gParsed.activeProfile;
      if (Array.isArray(gParsed.activeProfiles)) {
        activeProfiles = gParsed.activeProfiles;
      } else if (gParsed.activeProfile) {
        activeProfiles = [gParsed.activeProfile];
      }
      if (gParsed.disabledClients) disabledClients = gParsed.disabledClients;
      if (gParsed.globalSettings) globalSettings = gParsed.globalSettings;
    } catch (e) {
      console.error(`[Config Store Error] Failed to read global.json:`, e.message);
    }
  }

  const profiles = {};
  if (fs.existsSync(PROFILES_DIR)) {
    const files = fs.readdirSync(PROFILES_DIR);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const fPath = path.join(PROFILES_DIR, f);
      try {
        const pRaw = fs.readFileSync(fPath, 'utf8');
        const pData = JSON.parse(pRaw);
        const name = pData.name || path.basename(f, '.json');

        // Auto convert to Node Workflow v3.0.0 schema
        const converted = convertLegacyProfileToNodeWorkflow(pData);
        profiles[name] = sanitizeProfileIds(converted);
      } catch (e) {
        console.error(`[Config Store Error] Failed to read profile file ${f}:`, e.message);
      }
    }
  }

  if (Object.keys(profiles).length === 0) {
    profiles['Default'] = convertLegacyProfileToNodeWorkflow({ name: 'Default', actions: [] });
  }
  if (!profiles[activeProfile]) {
    activeProfile = Object.keys(profiles)[0] || 'Default';
  }

  // Filter valid active profiles (empty array is valid)
  activeProfiles = activeProfiles.filter(p => !!profiles[p]);

  return {
    activeProfile,
    activeProfiles,
    disabledClients,
    globalSettings,
    profiles
  };
}

// Write full configuration object into multi-file structure
function writeConfig(fullConfig) {
  ensureDirs();
  if (!fullConfig) return;

  const activeProfile = fullConfig.activeProfile || '';
  const activeProfiles = Array.isArray(fullConfig.activeProfiles)
    ? fullConfig.activeProfiles.filter(p => !!fullConfig.profiles[p])
    : [];
  const disabledClients = fullConfig.disabledClients || [];
  const globalSettings = fullConfig.globalSettings || {};

  const globalData = {
    activeProfile,
    activeProfiles,
    disabledClients,
    globalSettings
  };

  const newGlobalContent = JSON.stringify(globalData, null, 2);
  if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
    const existingGlobal = fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8');
    if (existingGlobal !== newGlobalContent) {
      fs.writeFileSync(GLOBAL_CONFIG_PATH, newGlobalContent, 'utf8');
    }
  } else {
    fs.writeFileSync(GLOBAL_CONFIG_PATH, newGlobalContent, 'utf8');
  }

  // Save profile files and handle deletions
  const profiles = fullConfig.profiles || {};
  const currentFiles = fs.existsSync(PROFILES_DIR) ? fs.readdirSync(PROFILES_DIR) : [];
  const validFilenames = new Set();

  for (const [pName, pData] of Object.entries(profiles)) {
    const sanitizedName = pName.replace(/[/\\?%*:|"<>]/g, '_');
    const filename = `${sanitizedName}.json`;
    validFilenames.add(filename);
    const pFile = path.join(PROFILES_DIR, filename);

    const profileData = {
      version: pData.version || '3.1.0',
      name: pName,
      canvas: pData.canvas || { zoom: 1.0, pan: { x: 0, y: 0 } },
      nodes: pData.nodes || [],
      connections: pData.connections || []
    };

    const newContent = JSON.stringify(profileData, null, 2);
    if (fs.existsSync(pFile)) {
      try {
        const existingContent = fs.readFileSync(pFile, 'utf8');
        if (existingContent === newContent) {
          continue; // Skip writing if content is unchanged
        }
      } catch (e) { }
    }
    fs.writeFileSync(pFile, newContent, 'utf8');
    const newHash = crypto.createHash('sha1').update(newContent).digest('hex');
    lastKnownProfileHashes.set(filename, newHash);
    internalWriteLocks.set(filename, Date.now());
  }

  // Remove files for deleted profiles
  for (const f of currentFiles) {
    if (f.endsWith('.json') && !validFilenames.has(f)) {
      try {
        fs.unlinkSync(path.join(PROFILES_DIR, f));
        internalWriteLocks.set(f, Date.now());
        lastKnownProfileHashes.delete(f);
        console.log(`[Config Store] 🗑️ Deleted removed profile file: ${f}`);
      } catch (e) { }
    }
  }
}

// Write a single profile file directly with hash & internal lock update
function writeSingleProfile(profileName, pData) {
  ensureDirs();
  const sanitizedName = profileName.replace(/[/\\?%*:|"<>]/g, '_');
  const filename = `${sanitizedName}.json`;
  const pFile = path.join(PROFILES_DIR, filename);

  const profileData = {
    version: pData.version || '3.1.0',
    name: profileName,
    canvas: pData.canvas || { zoom: 1.0, pan: { x: 0, y: 0 } },
    nodes: pData.nodes || [],
    connections: pData.connections || []
  };

  const newContent = JSON.stringify(profileData, null, 2);
  fs.writeFileSync(pFile, newContent, 'utf8');
  const newHash = crypto.createHash('sha1').update(newContent).digest('hex');
  lastKnownProfileHashes.set(filename, newHash);
  internalWriteLocks.set(filename, Date.now());
  return true;
}

// Read a single profile directly from disk
function readSingleProfile(profileName) {
  ensureDirs();
  const sanitizedName = profileName.replace(/[/\\?%*:|"<>]/g, '_');
  const filename = `${sanitizedName}.json`;
  let targetFile = path.join(PROFILES_DIR, filename);

  if (!fs.existsSync(targetFile)) {
    if (fs.existsSync(PROFILES_DIR)) {
      const files = fs.readdirSync(PROFILES_DIR);
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        try {
          const raw = fs.readFileSync(path.join(PROFILES_DIR, f), 'utf8');
          const data = JSON.parse(raw);
          if (data.name === profileName) {
            targetFile = path.join(PROFILES_DIR, f);
            break;
          }
        } catch (e) { }
      }
    }
  }

  if (!fs.existsSync(targetFile)) return null;

  try {
    const pRaw = fs.readFileSync(targetFile, 'utf8');
    const pData = JSON.parse(pRaw);
    const converted = convertLegacyProfileToNodeWorkflow(pData);
    return sanitizeProfileIds(converted);
  } catch (e) {
    console.error(`[Config Store Error] Failed to read single profile ${profileName}:`, e.message);
    return null;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// PROFILE FILE WATCHER & EXTERNAL CHANGE DETECTION
// ═════════════════════════════════════════════════════════════════════════════
let profileWatcher = null;
const debounceTimers = new Map();

function initProfileWatcher(onExternalChange) {
  ensureDirs();

  // Populate initial hashes of all existing profile files
  if (fs.existsSync(PROFILES_DIR)) {
    const files = fs.readdirSync(PROFILES_DIR);
    for (const f of files) {
      if (f.endsWith('.json')) {
        const hash = computeFileHash(path.join(PROFILES_DIR, f));
        if (hash) lastKnownProfileHashes.set(f, hash);
      }
    }
  }

  if (profileWatcher) {
    try { profileWatcher.close(); } catch (e) { }
  }

  try {
    profileWatcher = fs.watch(PROFILES_DIR, (eventType, filename) => {
      if (!filename || !filename.endsWith('.json')) return;

      if (debounceTimers.has(filename)) {
        clearTimeout(debounceTimers.get(filename));
      }

      const timer = setTimeout(() => {
        debounceTimers.delete(filename);
        handleWatchedFileEvent(filename, onExternalChange);
      }, 350);

      debounceTimers.set(filename, timer);
    });

    console.log(`[Config Store] 👁️ Profile file watcher active on: ${PROFILES_DIR}`);
  } catch (err) {
    console.error('[Config Store] ❌ Failed to start profile file watcher:', err.message);
  }
}

function handleWatchedFileEvent(filename, onExternalChange) {
  const filePath = path.join(PROFILES_DIR, filename);
  const lockTime = internalWriteLocks.get(filename) || 0;
  const isInternalRecent = (Date.now() - lockTime) < 1800;

  const fileExists = fs.existsSync(filePath);

  if (fileExists) {
    const currentHash = computeFileHash(filePath);
    if (!currentHash) return; // Might be temporarily locked while writing
    const prevHash = lastKnownProfileHashes.get(filename);

    if (isInternalRecent && currentHash === prevHash) {
      return; // Internal write from NodeHotkey, ignore
    }

    if (prevHash && currentHash === prevHash) {
      return; // No real content change
    }

    const isNew = !prevHash;
    lastKnownProfileHashes.set(filename, currentHash);

    let pName = path.basename(filename, '.json');
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.name) pName = parsed.name;
    } catch (e) { }

    console.log(`[Config Store] 🔔 External profile change: "${pName}" (${isNew ? 'Created' : 'Modified'})`);

    if (typeof onExternalChange === 'function') {
      onExternalChange({
        action: isNew ? 'created' : 'modified',
        filename,
        profileName: pName,
        timestamp: Date.now()
      });
    }
  } else {
    if (isInternalRecent) {
      return; // Internal deletion
    }
    if (lastKnownProfileHashes.has(filename)) {
      lastKnownProfileHashes.delete(filename);
      const pName = path.basename(filename, '.json');
      console.log(`[Config Store] 🔔 External profile deletion: "${pName}"`);

      if (typeof onExternalChange === 'function') {
        onExternalChange({
          action: 'deleted',
          filename,
          profileName: pName,
          timestamp: Date.now()
        });
      }
    }
  }
}

// Get only the globalSettings portion of the config
function getGlobalSettings() {
  ensureDirs();
  if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed.globalSettings || null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

module.exports = {
  readConfig,
  writeConfig,
  readSingleProfile,
  writeSingleProfile,
  initProfileWatcher,
  migrateLegacyConfig,
  getGlobalSettings,
  CONFIGS_DIR,
  PROFILES_DIR,
  GLOBAL_CONFIG_PATH
};
