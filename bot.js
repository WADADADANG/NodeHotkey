const { chromium, firefox } = require('playwright');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Start the control panel server
require('./test-server.js');

const { getCooldownPresetsById } = require('./cooldown-manager');
const NodeExecutionEngine = require('./execution-engine');
let activeWorkflowEngine = new NodeExecutionEngine();
global.activeWorkflowEngine = activeWorkflowEngine;

let keyboard, mouseEvents;
let clientPages = {};    // clientIndex -> page
let clientContexts = {}; // clientIndex -> browserContext
let activeClients = [];  // Array of active client indices, e.g. [2, 4]
global.activeClients = activeClients;
let clientCooldowns = {}; // clientIndex -> { [presetId]: expireTimestamp, [presetId_lastCycle]: lastCycleTimestamp }

// Real-time execution signal broadcast
function emitSignal(actionId, eventName, targetId = null) {
    if (!global.executionSignals) global.executionSignals = [];
    global.executionSignals.push({
        id: Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        actionId,
        eventName,
        targetId,
        timestamp: Date.now()
    });
    if (global.executionSignals.length > 80) {
        global.executionSignals.splice(0, global.executionSignals.length - 80);
    }
    if (typeof sendRealtimeOverlayState === 'function') {
        sendRealtimeOverlayState();
    }
}
global.emitSignal = emitSignal;

// ============================================================================
// CONFIGURATION VARIABLES
// ============================================================================
let targetUrlKeyword = 'universe.flyff.com'; // URL keyword to identify game tab

let activeActions = [];
let clientAliases = {};
let clientUserAgents = {};
let clientProxies = {};
let clientWindowModes = {};
let clientBrowsers = {};
let clientWindowBounds = {};
let clientMuteAudio = {};
let clientFpsLimit = {};
let clientRamLimit = {};
let clientScale1x = {};

function parseProxyString(rawStr) {
    if (!rawStr || typeof rawStr !== 'string' || !rawStr.trim()) return null;
    let str = rawStr.trim();

    if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('socks5://')) {
        try {
            const u = new URL(str);
            const proxyObj = {
                server: `${u.protocol}//${u.hostname}${u.port ? ':' + u.port : ''}`
            };
            if (u.username) proxyObj.username = decodeURIComponent(u.username);
            if (u.password) proxyObj.password = decodeURIComponent(u.password);
            return proxyObj;
        } catch (e) {
            return { server: str };
        }
    }

    const parts = str.split(':');
    if (parts.length === 4) {
        const [ip, port, username, password] = parts;
        return {
            server: `http://${ip}:${port}`,
            username: username,
            password: password
        };
    }
    if (parts.length === 2) {
        const [ip, port] = parts;
        return {
            server: `http://${ip}:${port}`
        };
    }

    return { server: str.startsWith('http') ? str : `http://${str}` };
}
let suspendHotkey = "";
global.isSuspended = false;
let pressedRemapKeys = {};
let activeHoldStates = {};
let forwardHoldTimers = {};
let activeLoopStates = {};
let activeSequencerLoops = {};
let isBuffSequenceRunning = {};
let isSequencerRunning = {};
let buffSequenceTokens = {};  // Per-action cancellation tokens: { actionId: tokenNumber }
global.activeLoopStates = activeLoopStates;
global.activeSequencerLoops = activeSequencerLoops;
global.isBuffSequenceRunning = isBuffSequenceRunning;
global.isSequencerRunning = isSequencerRunning;
global.pressedRemapKeys = pressedRemapKeys;
global.activeHoldStates = activeHoldStates;
let isSystemInitialized = false;
let overlayProcess = null;
let lastEnableOverlaySetting = true;
let overlayAutoRestartTimer = null;

function getClientStatuses() {
    const activeList = activeClients || [];
    const clientStatuses = {};
    const actions = activeActions || [];

    activeList.forEach(clientIdx => {
        const clientStr = String(clientIdx);
        const runningActions = [];

        actions.forEach(a => {
            if (!a.enabled || !isTargetMatched(a.targetClient, clientStr)) return;

            if (a.mode === 'loop_scheduler' && activeSchedulerStates[a.id]?.running) {
                runningActions.push({
                    id: a.id,
                    name: a.name || 'Loop Scheduler',
                    type: 'scheduler',
                    icon: '⏱️',
                    detail: `${a.items?.length || 0} timers`
                });
            } else if (a.mode === 'loop' && activeLoopStates[a.id]?.running) {
                runningActions.push({
                    id: a.id,
                    name: a.name || 'Key Loop',
                    type: 'loop',
                    icon: '🟢',
                    detail: `${a.interval || 1000}ms`
                });
            } else if ((a.mode === 'sequencer' || a.mode === 'cast_sequence') && ((activeSequencerLoops[a.id]?.running) || isSequencerRunning[clientStr])) {
                runningActions.push({
                    id: a.id,
                    name: a.name || 'Sequencer',
                    type: 'sequencer',
                    icon: '⚔️',
                    detail: a.modeType === 'once' ? 'Once' : 'Loop'
                });
            } else if (a.mode === 'buff_sequence' && isBuffSequenceRunning[clientStr]) {
                runningActions.push({
                    id: a.id,
                    name: a.name || 'Buff Queue',
                    type: 'buff',
                    icon: '🔵',
                    detail: `${(a.keys || []).length} keys`
                });
            } else if (a.mode === 'key_hold' && activeHoldStates[a.id]) {
                runningActions.push({
                    id: a.id,
                    name: a.name || `Hold: ${a.targetKey || '1'}`,
                    type: 'hold',
                    icon: '⚓',
                    detail: `Key ${a.targetKey || '1'}`
                });
            } else if (a.mode === 'forward' && pressedRemapKeys[`${a.id}-${clientStr}`]) {
                runningActions.push({
                    id: a.id,
                    name: a.name || 'Key Forward',
                    type: 'forward',
                    icon: '⚡',
                    detail: `${a.trigger?.value || 'Key'} ➜ ${a.targetKey || '1'}`
                });
            }
        });

        if (runningActions.length > 0) {
            // Check pinned action priority
            const pinnedAction = runningActions.find(ra => {
                const orig = actions.find(a => a.id === ra.id);
                return orig && orig.showOnOverlay;
            });
            const primary = pinnedAction || runningActions[0];

            clientStatuses[clientStr] = {
                status: primary.name,
                type: primary.type === 'scheduler' ? 'sequencer' : primary.type,
                activeCount: runningActions.length,
                activeActions: runningActions
            };
        } else {
            clientStatuses[clientStr] = {
                status: "Standby",
                type: "standby",
                activeCount: 0,
                activeActions: []
            };
        }
    });
    return clientStatuses;
}

function sendRealtimeOverlayState() {
    const payload = {
        activeClients: activeClients || [],
        clientStatuses: getClientStatuses(),
        clientAliases: clientAliases || {},
        isSuspended: !!global.isSuspended,
        disabledClients: global.disabledClients || []
    };
    try {
        console.log('__OVERLAY_DATA__' + JSON.stringify(payload));
    } catch (e) {}
}
global.sendRealtimeOverlayState = sendRealtimeOverlayState;
global.sendOverlayUpdate = sendRealtimeOverlayState;
global.getClientStatuses = getClientStatuses;

// Ghost Mouse Jitter state
let ghostMouseJitterConfig = { enabled: false, intervalMin: 8000, intervalMax: 25000, maxOffset: 12 };
let ghostMouseJitterTimers = {}; // clientIndex -> timeout handle

function getActionTargets(targetClientString) {
    if (!targetClientString) return ['1'];
    if (targetClientString === 'all' || targetClientString === 'both') {
        return activeClients.map(String);
    }
    const split = targetClientString.split(',').map(s => s.trim()).filter(Boolean);
    return split.length > 0 ? split : ['1'];
}

function isTargetMatched(targetClientString, clientStr) {
    const targets = getActionTargets(targetClientString);
    return targets.includes(clientStr);
}

function releaseHeldKeyForAction(act) {
    if (!act) return;
    if (activeHoldStates[act.id]) {
        const targetKey = act.targetKey || '1';
        let targets = getActionTargets(act.targetClient).map(x => parseInt(x, 10));
        for (let t of targets) {
            const page = clientPages[t];
            if (page) {
                page.keyboard.up(targetKey).catch(e => { });
            }
        }
        activeHoldStates[act.id] = false;
    }
}

function releaseAllHeldKeys() {
    for (let actionId in activeHoldStates) {
        if (activeHoldStates[actionId]) {
            const act = activeActions.find(a => a.id === actionId);
            if (act && act.mode === 'key_hold') {
                releaseHeldKeyForAction(act);
            }
            activeHoldStates[actionId] = false;
        }
    }
    for (let key in forwardHoldTimers) {
        clearTimeout(forwardHoldTimers[key]);
        delete forwardHoldTimers[key];
    }
}

const { readConfig, writeConfig } = require('./config-store');

// Helper to load config from JSON file
function loadConfigFromFile() {
    try {
        releaseAllHeldKeys();
        const parsed = readConfig();
        if (!parsed) return;

        const activeProfileNames = Array.isArray(parsed.activeProfiles)
            ? parsed.activeProfiles
            : (parsed.activeProfile ? [parsed.activeProfile] : []);
        
        console.log(`[Config] Active profiles (${activeProfileNames.length}): [${activeProfileNames.join(', ')}]`);

        const activeProfileObjs = activeProfileNames
            .map(pName => parsed.profiles[pName])
            .filter(Boolean);

        const primaryProfile = activeProfileObjs[0] || { actions: [] };
        const globalSet = parsed.globalSettings || {};

        // Load target URL keyword
        targetUrlKeyword = globalSet.targetUrlKeyword || primaryProfile.targetUrlKeyword || 'universe.flyff.com';
        suspendHotkey = globalSet.suspendHotkey || primaryProfile.suspendHotkey || '';

        // Load & initialize active Node Workflow execution engine with all active profiles
        activeWorkflowEngine.loadProfiles(activeProfileObjs);
        const totalNodes = activeProfileObjs.reduce((acc, p) => acc + (p.nodes ? p.nodes.length : 0), 0);
        const totalConns = activeProfileObjs.reduce((acc, p) => acc + (p.connections ? p.connections.length : 0), 0);

        // Combine in-memory actions dynamically generated from Pure Node Graph across all active profiles
        let combinedActions = [];
        activeProfileObjs.forEach(prof => {
            const profActions = activeWorkflowEngine.buildInMemoryActions(prof);
            combinedActions.push(...profActions);
        });
        activeActions = combinedActions;
        global.activeActions = activeActions; // Share with test-server.js

        console.log(`[Config] Node Workflow Engine initialized across ${activeProfileObjs.length} profile(s): ${totalNodes} nodes, ${totalConns} connections, ${activeActions.length} executable actions in memory`);

        // Load client aliases
        clientAliases = globalSet.clientAliases || primaryProfile.clientAliases || {};

        // Load client User-Agents
        clientUserAgents = globalSet.clientUserAgents || primaryProfile.clientUserAgents || {};

        // Load client Proxies
        clientProxies = globalSet.clientProxies || primaryProfile.clientProxies || {};

        // Load client Window Modes, Browsers & Window Bounds
        clientWindowModes = globalSet.clientWindowModes || primaryProfile.clientWindowModes || {};
        clientBrowsers = globalSet.clientBrowsers || primaryProfile.clientBrowsers || {};
        clientWindowBounds = globalSet.clientWindowBounds || primaryProfile.clientWindowBounds || {};
        clientMuteAudio = globalSet.clientMuteAudio || primaryProfile.clientMuteAudio || {};
        clientFpsLimit = globalSet.clientFpsLimit || primaryProfile.clientFpsLimit || {};
        clientRamLimit = globalSet.clientRamLimit || primaryProfile.clientRamLimit || {};
        clientScale1x = globalSet.clientScale1x || primaryProfile.clientScale1x || {};

        // Load Ghost Mouse Jitter config
        const gmj = globalSet.ghostMouseJitter || primaryProfile.ghostMouseJitter;
        if (gmj) {
            ghostMouseJitterConfig = {
                enabled: !!gmj.enabled,
                intervalMin: gmj.intervalMin || 8000,
                intervalMax: gmj.intervalMax || 25000,
                maxOffset: gmj.maxOffset || 12
            };
        } else {
            ghostMouseJitterConfig = { enabled: false, intervalMin: 8000, intervalMax: 25000, maxOffset: 12 };
        }

        // Sync state of active loops
        syncRunningLoops();

        // Sync Python overlay process setting (actual spawn handled by sendOverlayUpdate below)
        const enableOverlayVal = (globalSet && globalSet.enableOverlay !== undefined) ? globalSet.enableOverlay : ((primaryProfile && primaryProfile.enableOverlay !== undefined) ? primaryProfile.enableOverlay : true);
        lastEnableOverlaySetting = !!enableOverlayVal;

        // Sync Ghost Mouse Jitter
        syncGhostMouseJitter();

        // Update browser titles if running
        updateBrowserTitles();

        // Send state to overlay
        sendOverlayUpdate();

        console.log(`[Config] Loaded ${activeActions.length} actions successfully!`);
    } catch (e) {
        console.error("[Config Error] Failed to read config:", e.message);
    }
}

const { CONFIGS_DIR } = require('./config-store');

let watchDebounceTimer = null;
function watchConfigChanges() {
    if (fs.existsSync(CONFIGS_DIR)) {
        fs.watch(CONFIGS_DIR, { recursive: true }, (eventType, filename) => {
            if (filename && filename.endsWith('.json')) {
                if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
                watchDebounceTimer = setTimeout(() => {
                    console.log(`\n[Config] ${filename} modification detected. Reloading...`);
                    loadConfigFromFile();
                }, 300);
            }
        });
    }
}

// Load config immediately on startup
loadConfigFromFile();
watchConfigChanges();

// ============================================================================
// SYSTEM STATE & TIMERS
// ============================================================================
// (Variables hoisted to the top to avoid ReferenceError)

function sendOverlayUpdate() {
    sendRealtimeOverlayState();
}
global.sendOverlayUpdate = sendOverlayUpdate;

global.toggleSuspendState = function (forcedState) {
    if (forcedState !== undefined) {
        global.isSuspended = forcedState;
    } else {
        global.isSuspended = !global.isSuspended;
    }

    console.log(`\n[System Pause/Resume] Bot is now ${global.isSuspended ? '⏸️ PAUSED/SUSPENDED' : '▶️ ACTIVE/RESUMED'}`);

    if (global.isSuspended) {
        // Stop all loops
        stopAllLoops();

        // Release all key holds
        for (let actionId in activeHoldStates) {
            if (activeHoldStates[actionId]) {
                activeHoldStates[actionId] = false;
                const act = activeActions.find(a => a.id === actionId);
                if (act) {
                    const target = act.targetClient || '1';
                    let targets = getActionTargets(target).map(x => parseInt(x, 10));
                    for (let t of targets) {
                        const page = clientPages[t];
                        if (page) {
                            page.keyboard.up(act.targetKey || '1').catch(e => { });
                        }
                    }
                }
            }
        }
        // Release all remapped/forward keys
        for (let key in pressedRemapKeys) {
            if (pressedRemapKeys[key]) {
                delete pressedRemapKeys[key];
                const parts = key.split('-');
                if (parts.length === 2) {
                    const actId = parts[0];
                    const clientIndex = parseInt(parts[1], 10);
                    const act = activeActions.find(a => a.id === actId);
                    const page = clientPages[clientIndex];
                    if (act && page) {
                        page.keyboard.up(act.targetKey || '5').catch(e => { });
                    }
                }
            }
        }
        // Clear all forward hold timers
        for (let key in forwardHoldTimers) {
            if (forwardHoldTimers[key]) {
                clearTimeout(forwardHoldTimers[key]);
                delete forwardHoldTimers[key];
            }
        }
    }

    sendOverlayUpdate();
    return global.isSuspended;
};

function syncOverlayProcess(enableOverlay) {
    if (enableOverlay !== undefined) {
        lastEnableOverlaySetting = !!enableOverlay;
    }
}

// Clean up resources on main process exit
process.on('exit', () => {
    clearAllProfileLockFiles();
});

function updateBrowserTitles() {
    for (let index of activeClients) {
        const page = clientPages[index];
        if (!page) continue;
        const alias = clientAliases[String(index)] || '';
        const prefix = alias ? `[${alias}] ` : `[Client ${index}] `;

        page.evaluate(({ prefix }) => {
            window.__clientPrefix = prefix;
            const title = document.title;
            let cleanTitle = title;
            if (cleanTitle && cleanTitle.includes('] ')) {
                const parts = cleanTitle.split('] ');
                if (parts.length > 1 && parts[0].startsWith('[')) {
                    cleanTitle = parts.slice(1).join('] ');
                }
            }
            document.title = prefix + cleanTitle;
        }, { prefix }).catch(e => {
            // Ignore errors for closed tabs
        });
    }
}

// ============================================================================
// BROWSER LAUNCHER & SELECTION PROMPTS
// ============================================================================
function parseClientInput(input) {
    const clients = [];
    const parts = input.split(',');
    for (let part of parts) {
        part = part.trim();
        if (part.includes('-')) {
            const rangeParts = part.split('-');
            const start = parseInt(rangeParts[0], 10);
            const end = parseInt(rangeParts[1], 10);
            if (!isNaN(start) && !isNaN(end) && start >= 1 && end <= 8 && start <= end) {
                for (let i = start; i <= end; i++) {
                    if (!clients.includes(i)) clients.push(i);
                }
            }
        } else {
            const num = parseInt(part, 10);
            if (!isNaN(num) && num >= 1 && num <= 8) {
                if (!clients.includes(num)) clients.push(num);
            }
        }
    }
    return clients.sort((a, b) => a - b);
}

function askClientsAndBrowser() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("=================================================");
    console.log("Enter active client numbers to run (1-8):");
    console.log("Example: '2,4' for Client 2 & 4, or '1-5' for Clients 1 to 5.");
    console.log("Press Enter without input (or '0') to skip browser launch and open Dashboard later.");
    console.log("=================================================");

    return new Promise((resolve) => {
        rl.question("Enter clients and press Enter: ", (clientAnswer) => {
            const input = clientAnswer.trim();
            let parsedClients = [];
            if (input === '' || input === '0' || input.toLowerCase() === 'none') {
                parsedClients = [];
            } else {
                parsedClients = parseClientInput(input);
            }

            if (parsedClients.length === 0) {
                console.log("\n📌 [System] Skipping initial browser launch.");
                console.log("👉 Open Web Dashboard at http://localhost:3000/ to configure Proxy/Settings & launch clients!");
                rl.close();
                return resolve({ activeClientsList: [], choice: '1' });
            }

            console.log(`\nSelected clients to launch: [${parsedClients.join(', ')}]`);

            console.log("\n=================================================");
            console.log("Please select browser to run:");
            console.log(" [1] Google Chrome (Default)");
            console.log(" [2] Microsoft Edge");
            console.log(" [3] Mozilla Firefox");
            console.log("Press Enter without input for [1] Google Chrome.");
            console.log("=================================================");

            rl.question("Enter number (1, 2 or 3) and press Enter: ", (browserAnswer) => {
                rl.close();
                const browserChoice = browserAnswer.trim();
                let choice = '1';
                if (browserChoice === '2' || browserChoice === '3') {
                    choice = browserChoice;
                } else {
                    choice = '1';
                }
                resolve({ activeClientsList: parsedClients, choice });
            });
        });
    });
}

function isBlankPage(p) {
    const url = p.url();
    return url === 'about:blank' || url === '' ||
        url.includes('chrome://newtab') || url.includes('chrome-search://') ||
        url.includes('edge://newtab') || url.includes('edge://new-tab-page') ||
        url.includes('ntp.msn.com/edge/ntp') || url.includes('about:newtab');
}

function migrateProfilesDirectory() {
    const projectPath = __dirname;
    const profilesDir = path.join(projectPath, 'profiles');
    if (!fs.existsSync(profilesDir)) {
        try {
            fs.mkdirSync(profilesDir, { recursive: true });
        } catch (e) {
            console.error(`[System Error] Failed to create profiles directory:`, e.message);
            return;
        }
    }

    const oldProfiles = [
        'chrome-profile', 'chrome-profile-2',
        'edge-profile', 'edge-profile-2',
        'firefox-profile', 'firefox-profile-2'
    ];

    for (const name of oldProfiles) {
        const oldPath = path.join(projectPath, name);
        const newPath = path.join(profilesDir, name);
        if (fs.existsSync(oldPath)) {
            if (!fs.existsSync(newPath)) {
                try {
                    fs.renameSync(oldPath, newPath);
                    console.log(`[System] Cleaned up folder structure: Moved old profile "${name}" to "profiles/${name}"`);
                } catch (e) {
                    console.warn(`[System] Failed to move old profile folder "${name}":`, e.message);
                }
            }
        }
    }
}

function clearLockFiles(profilePath) {
    try {
        if (fs.existsSync(profilePath)) {
            const deleteFile = (filePath) => {
                try {
                    const stat = fs.lstatSync(filePath);
                    if (stat.isFile() || stat.isSymbolicLink()) {
                        fs.unlinkSync(filePath);
                    }
                } catch (err) { }
            };

            const files = fs.readdirSync(profilePath);
            for (const file of files) {
                const lower = file.toLowerCase();
                if (lower === 'singletonlock' || lower === 'lock' || lower.includes('lock') || lower === 'parent.lock') {
                    deleteFile(path.join(profilePath, file));
                }
            }

            // Check Default folder inside profile if exists
            const defaultDir = path.join(profilePath, 'Default');
            if (fs.existsSync(defaultDir)) {
                const defFiles = fs.readdirSync(defaultDir);
                for (const file of defFiles) {
                    const lower = file.toLowerCase();
                    if (lower === 'singletonlock' || lower === 'lock' || lower.includes('lock') || lower === 'parent.lock') {
                        deleteFile(path.join(defaultDir, file));
                    }
                }
            }
        }
    } catch (e) { }
}

function clearAllProfileLockFiles() {
    const profilesDir = path.join(__dirname, 'profiles');
    if (!fs.existsSync(profilesDir)) return;
    try {
        const dirs = fs.readdirSync(profilesDir, { withFileTypes: true });
        for (const d of dirs) {
            if (d.isDirectory()) {
                const profilePath = path.join(profilesDir, d.name);
                clearLockFiles(profilePath);
            }
        }
    } catch (e) {
        console.warn(`[System Warning] Failed to scan profiles for locks cleanup:`, e.message);
    }
}

function getBrowserLaunchParams(choiceStr) {
    const raw = String(choiceStr || '1');
    const isApp = raw.endsWith('-app');
    const baseChoice = raw.replace('-app', '');

    let browserName = 'Google Chrome';
    let browserType = chromium;
    let channelVal = 'chrome';

    if (baseChoice === '2') {
        browserName = isApp ? 'Microsoft Edge (App Mode)' : 'Microsoft Edge';
        channelVal = 'msedge';
    } else if (baseChoice === '3') {
        browserName = 'Mozilla Firefox';
        browserType = firefox;
        channelVal = undefined;
    } else {
        browserName = isApp ? 'Google Chrome (App Mode)' : 'Google Chrome';
        channelVal = 'chrome';
    }

    return { baseChoice, isApp: isApp && baseChoice !== '3', browserName, browserType, channelVal };
}

async function launchBrowser(activeClientsList, choice) {
    activeClients = activeClientsList;
    global.activeClients = activeClients; // Share with test-server.js

    const projectPath = __dirname;
    const profilesDir = path.join(projectPath, 'profiles');

    let launchOptions = {
        headless: false,
        viewport: null,
        args: [
            // === Window & Display ===
            '--disable-infobars',
            '--test-type',
            '--no-default-browser-check',
            '--no-first-run',
            '--disable-blink-features=AutomationControlled',

            // === Background Throttling Prevention ===
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',

            // === GPU & Rendering Performance ===
            '--enable-gpu-rasterization',
            '--enable-zero-copy',
            '--ignore-gpu-blocklist',
            '--disable-gpu-process-crash-limit',

            // === Reduce CPU/Memory Overhead ===
            '--disable-extensions',
            '--disable-sync',
            '--disable-default-apps',
            '--disable-background-networking',
            '--disable-client-side-phishing-detection',
            '--disable-hang-monitor',
            '--disable-prompt-on-repost',
            '--disable-translate',
            '--disk-cache-size=52428800',
            '--media-cache-size=52428800',
            '--disable-site-isolation-trials',

            // === Telemetry / Noise ===
            '--metrics-recording-only',
            '--disable-breakpad',

            // === Process Management ===
            '--renderer-process-limit=1'
        ]
    };

    let startUrl = targetUrlKeyword;
    if (!startUrl.startsWith('http://') && !startUrl.startsWith('https://')) {
        if (startUrl.includes('localhost') || startUrl.includes('127.0.0.1')) {
            startUrl = 'http://' + startUrl;
        } else {
            startUrl = 'https://' + startUrl;
        }
    }

    global.lastBrowserChoice = choice;

    // Launch all selected clients
    for (let clientIndex of activeClients) {
        const clientChoice = clientBrowsers[String(clientIndex)] || choice || '1';
        const { baseChoice, isApp, browserName, browserType, channelVal } = getBrowserLaunchParams(clientChoice);

        console.log(`[System] Launching Client ${clientIndex} (${browserName}) with persistent context...`);

        let profileName = '';
        if (baseChoice === '1') {
            profileName = clientIndex === 1 ? 'chrome-profile' : `chrome-profile-${clientIndex}`;
        } else if (baseChoice === '2') {
            profileName = clientIndex === 1 ? 'edge-profile' : `edge-profile-${clientIndex}`;
        } else {
            profileName = clientIndex === 1 ? 'firefox-profile' : `firefox-profile-${clientIndex}`;
        }

        const profilePath = path.join(profilesDir, profileName);
        const launchArgs = {
            ...launchOptions,
            args: baseChoice === '3' ? [] : [...launchOptions.args]
        };
        if (channelVal) launchArgs.channel = channelVal;
        if (isApp && baseChoice !== '3') {
            launchArgs.args.push(`--app=${startUrl}`);
        }

        // Apply saved window bounds (position & size) if available (Chromium only)
        const bounds = clientWindowBounds[String(clientIndex)];
        if (bounds && typeof bounds.x === 'number' && typeof bounds.y === 'number' && bounds.w > 200 && bounds.h > 200) {
            console.log(`[System] [Client ${clientIndex}] Restoring window bounds: Position (${bounds.x}, ${bounds.y}), Size (${bounds.w}x${bounds.h})`);
            if (baseChoice !== '3') {
                launchArgs.args.push(`--window-position=${bounds.x},${bounds.y}`);
                launchArgs.args.push(`--window-size=${bounds.w},${bounds.h}`);
            }
        }

        // Apply custom User-Agent if defined in clientUserAgents configuration
        const customUa = clientUserAgents[String(clientIndex)];
        if (customUa && customUa.trim() !== '') {
            console.log(`[System] [Client ${clientIndex}] Setting custom User-Agent: "${customUa}"`);
            launchArgs.userAgent = customUa.trim();
        }

        // Apply custom Proxy if defined in clientProxies configuration
        const customProxyStr = clientProxies[String(clientIndex)];
        if (customProxyStr && customProxyStr.trim() !== '') {
            const proxyObj = parseProxyString(customProxyStr);
            if (proxyObj) {
                console.log(`[System] [Client ${clientIndex}] Setting custom Proxy: "${proxyObj.server}"`);
                launchArgs.proxy = proxyObj;
            }
        }

        // Firefox specific args & user prefs
        if (baseChoice === '3') {
            // Firefox performance prefs (equivalent to about:config tweaks)
            launchArgs.firefoxUserPrefs = {
                'dom.ipc.processCount': 1,                     // Limit content processes per Firefox instance (Drastically reduces RAM/CPU usage for 5+ clients)
                'javascript.options.mem.max': 512,             // Max JS heap limit per process in MB
                'browser.sessionhistory.max_entries': 5,        // Reduce tab history memory footprint
                'browser.tabs.unloadOnLowMemory': true,
                'dom.timeout.enable_budget_timer_throttling': true,

                'media.autoplay.default': 5,                    // Block autoplay media in background
                'media.autoplay.blocking_policy': 2,

                'toolkit.telemetry.enabled': false,
                'toolkit.telemetry.unified': false,
                'toolkit.telemetry.server': '',
                'datareporting.healthreport.uploadEnabled': false,
                'datareporting.policy.dataSubmissionEnabled': false,
                'app.shield.optoutstudies.enabled': false,
                'browser.ping-centre.telemetry': false,
                'browser.newtabpage.activity-stream.feeds.telemetry': false,
                'browser.newtabpage.activity-stream.telemetry': false,

                'identity.fxaccounts.enabled': false,
                'services.sync.enabled': false,

                'browser.startup.firstrunSkipsHomepage': true,
                'browser.startup.homepage_override.mstone': 'ignore',
                'startup.homepage_welcome_url': '',
                'browser.laterrun.enabled': false,
                'browser.uitour.enabled': false,

                'gfx.webrender.enabled': true,
                'gfx.webrender.all': true,
                'layers.acceleration.enabled': true,
                'layers.gpu-process.enabled': true,
                'layers.omtp.enabled': true,
                'media.hardware-video-decoding.enabled': true,

                'network.prefetch-next': false,
                'network.dns.disablePrefetch': true,
                'network.http.speculative-parallel-limit': 0,
                'browser.safebrowsing.malware.enabled': false,
                'browser.safebrowsing.phishing.enabled': false,

                'browser.tabs.animate': false,
                'browser.fullscreen.animate': false,
                'ui.prefersReducedMotion': 1,
                'accessibility.force_disabled': 1,

                'general.smoothScroll': true,
                'mousewheel.min_line_scroll_amount': 5,

                'browser.sessionstore.resume_from_crash': false,
                'browser.crashReports.unsubmittedCheck.enabled': false,

                'mousebutton.4th.enabled': false,
                'mousebutton.5th.enabled': false
            };

            // Firefox persistent path logic
            if (clientIndex === 1) {
                launchArgs.profile = path.join(profilePath, 'playwright-nightly');
            }
        }

        const browserCtx = await browserType.launchPersistentContext(profilePath, launchArgs);
        clientContexts[clientIndex] = browserCtx;

        browserCtx.on('close', () => {
            handleClientContextClosed(clientIndex);
        });

        const pages = browserCtx.pages();
        const targetPage = pages.find(p => p.url().includes(targetUrlKeyword));
        const controlPanelPage = pages.find(p => p.url().includes('localhost:3000'));
        const blankPages = pages.filter(p => isBlankPage(p));

        let usedPages = [];
        if (targetPage) usedPages.push(targetPage);
        if (controlPanelPage) usedPages.push(controlPanelPage);

        // 1. Open target game page
        let pageForTarget = targetPage;
        if (!pageForTarget) {
            const availableBlank = blankPages.find(p => !usedPages.includes(p));
            if (availableBlank) {
                pageForTarget = availableBlank;
                usedPages.push(availableBlank);
                console.log(`[System] Client ${clientIndex}: Navigating existing blank tab to game URL: ${startUrl}`);
                pageForTarget.goto(startUrl).catch(e => console.log(`[System] Client ${clientIndex} initial navigation error:`, e.message));
            } else {
                console.log(`[System] Client ${clientIndex}: Creating new tab for game URL: ${startUrl}`);
                pageForTarget = await browserCtx.newPage();
                usedPages.push(pageForTarget);
                pageForTarget.goto(startUrl).catch(e => console.log(`[System] Client ${clientIndex} initial navigation error:`, e.message));
            }
        }

        // 2. Open control panel tab on Client 1 only
        if (clientIndex === 1 && !startUrl.includes('localhost:3000') && !controlPanelPage) {
            const availableBlank = blankPages.find(p => !usedPages.includes(p));
            if (availableBlank) {
                console.log(`[System] Client 1: Reusing existing blank tab for control panel`);
                availableBlank.goto(controlPanelUrl).catch(e => console.log(`[System] Client 1 control panel navigation error:`, e.message));
            } else {
                console.log(`[System] Client 1: Opening new tab for control panel: ${controlPanelUrl}`);
                if (pageForTarget) {
                    await pageForTarget.evaluate((url) => {
                        window.open(url, '_blank');
                    }, controlPanelUrl).catch(async (err) => {
                        console.log(`[System] Client 1 window.open failed, falling back to newPage():`, err.message);
                        const cpPage = await browserCtx.newPage();
                        cpPage.goto(controlPanelUrl).catch(e => console.log(`[System] Client 1 control panel navigation error:`, e.message));
                    });
                } else {
                    const cpPage = await browserCtx.newPage();
                    cpPage.goto(controlPanelUrl).catch(e => console.log(`[System] Client 1 control panel navigation error:`, e.message));
                }
            }
        } else if (clientIndex === 1 && controlPanelPage) {
            console.log(`[System] Client 1 already has control panel open: "${controlPanelPage.url()}"`);
        }

        // 3. Add Webdriver evasion and dynamic title observer
        await browserCtx.addInitScript(({ index, initialPrefix }) => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

            // Prevent mouse back/forward buttons (Mouse 4 and Mouse 5) from navigating away from the page
            const preventMouseNav = (e) => {
                if (e.button === 3 || e.button === 4) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            };
            window.addEventListener('mousedown', preventMouseNav, true);
            window.addEventListener('mouseup', preventMouseNav, true);
            window.addEventListener('click', preventMouseNav, true);

            window.__clientPrefix = initialPrefix;

            const updateTitle = () => {
                const prefix = window.__clientPrefix || `[Client ${index}] `;
                const title = document.title;
                if (title && !title.startsWith(prefix)) {
                    let cleanTitle = title;
                    if (title.includes('] ')) {
                        const parts = title.split('] ');
                        if (parts[0].startsWith('[')) {
                            cleanTitle = parts.slice(1).join('] ');
                        }
                    }
                    document.title = prefix + cleanTitle;
                }
            };

            const observer = new MutationObserver(updateTitle);
            observer.observe(document.querySelector('title') || document.documentElement, {
                subtree: true,
                characterData: true,
                childList: true
            });
            updateTitle();
        }, { index: clientIndex, initialPrefix: clientAliases[String(clientIndex)] ? `[${clientAliases[String(clientIndex)]}] ` : `[Client ${clientIndex}] ` });
    }

    console.log(`[System] ${browserName} launcher completed successfully!`);
    global.activeClients = activeClients;
    sendOverlayUpdate();
}

function handleClientContextClosed(clientIndexInput) {
    const clientIndex = parseInt(clientIndexInput, 10);
    if (isNaN(clientIndex)) return;
    console.log(`[System] 🔴 [Client ${clientIndex}] Browser closed/detached.`);

    if (clientPages[clientIndex]) {
        try {
            clientPages[clientIndex].removeAllListeners('close');
            clientPages[clientIndex].removeAllListeners('crash');
        } catch (e) { }
        clientPages[clientIndex] = null;
    }

    if (clientContexts[clientIndex]) {
        try { clientContexts[clientIndex].close().catch(() => { }); } catch (e) { }
        clientContexts[clientIndex] = null;
    }

    stopLoopsForClient(clientIndex);

    const pos = activeClients.indexOf(clientIndex);
    if (pos > -1) {
        activeClients.splice(pos, 1);
    }
    const posStr = activeClients.indexOf(String(clientIndex));
    if (posStr > -1) {
        activeClients.splice(posStr, 1);
    }

    global.activeClients = activeClients;
    sendOverlayUpdate();
}

async function saveWindowBoundsForClient(clientIndex) {
    const page = clientPages[clientIndex];
    if (!page || page.isClosed()) return;
    try {
        const bounds = await page.evaluate(() => ({
            x: window.screenX,
            y: window.screenY,
            w: window.outerWidth,
            h: window.outerHeight
        })).catch(() => null);
        if (bounds && typeof bounds.x === 'number' && bounds.x > -5000 && bounds.w > 200 && bounds.h > 200) {
            clientWindowBounds[String(clientIndex)] = bounds;
        }
    } catch (e) { }
}

async function saveActiveClientsWindowBounds() {
    if (!activeClients || activeClients.length === 0) return;
    let updated = false;
    for (const clientIdx of activeClients) {
        const page = clientPages[clientIdx];
        if (page && !page.isClosed()) {
            try {
                const bounds = await page.evaluate(() => ({
                    x: window.screenX,
                    y: window.screenY,
                    w: window.outerWidth,
                    h: window.outerHeight
                })).catch(() => null);
                if (bounds && typeof bounds.x === 'number' && bounds.x > -5000 && bounds.w > 200 && bounds.h > 200) {
                    clientWindowBounds[String(clientIdx)] = bounds;
                    updated = true;
                }
            } catch (e) { }
        }
    }
    if (updated) {
        try {
            const fullCfg = readConfig();
            if (fullCfg && fullCfg.globalSettings) {
                fullCfg.globalSettings.clientWindowBounds = clientWindowBounds;
                writeConfig(fullCfg);
            }
        } catch (e) { }
    }
}

// Window bounds are saved when closing clients or closing app

async function closeSingleClient(clientIndexInput) {
    const clientIndex = parseInt(clientIndexInput, 10);
    if (isNaN(clientIndex)) return { success: false, error: "Invalid client index" };

    await saveWindowBoundsForClient(clientIndex);
    handleClientContextClosed(clientIndex);
    return { success: true, activeClients: activeClients, disabledClients: global.disabledClients || [] };
}
global.closeSingleClient = closeSingleClient;

async function launchSingleClient(clientIndexInput, choiceParam) {
    const clientIndex = parseInt(clientIndexInput, 10);
    if (isNaN(clientIndex) || clientIndex < 1 || clientIndex > 8) {
        throw new Error(`Invalid client index: ${clientIndexInput}`);
    }

    if (clientPages[clientIndex] && clientContexts[clientIndex]) {
        console.log(`[System] Client ${clientIndex} is already running.`);
        return { success: true, activeClients: activeClients, disabledClients: global.disabledClients || [] };
    }

    const choice = choiceParam || global.lastBrowserChoice || '1';
    global.lastBrowserChoice = choice;

    const projectPath = __dirname;
    const profilesDir = path.join(projectPath, 'profiles');

    let launchOptions = {
        headless: false,
        viewport: null,
        args: [
            '--disable-infobars',
            '--test-type',
            '--no-default-browser-check',
            '--no-first-run',
            '--disable-blink-features=AutomationControlled',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--enable-gpu-rasterization',
            '--enable-zero-copy',
            '--ignore-gpu-blocklist',
            '--disable-gpu-process-crash-limit',
            '--disable-extensions',
            '--disable-sync',
            '--disable-default-apps',
            '--disable-background-networking',
            '--disable-client-side-phishing-detection',
            '--disable-hang-monitor',
            '--disable-prompt-on-repost',
            '--disable-translate',
            '--disk-cache-size=52428800',
            '--media-cache-size=52428800',
            '--disable-site-isolation-trials',
            '--metrics-recording-only',
            '--disable-breakpad',
            '--renderer-process-limit=1'
        ]
    };

    let startUrl = targetUrlKeyword;
    if (!startUrl.startsWith('http://') && !startUrl.startsWith('https://')) {
        if (startUrl.includes('localhost') || startUrl.includes('127.0.0.1')) {
            startUrl = 'http://' + startUrl;
        } else {
            startUrl = 'https://' + startUrl;
        }
    }

    const clientChoice = choiceParam || clientBrowsers[String(clientIndex)] || global.lastBrowserChoice || '1';
    global.lastBrowserChoice = clientChoice;

    const { baseChoice, isApp, browserName, browserType, channelVal } = getBrowserLaunchParams(clientChoice);

    console.log(`[System] Dynamically launching Client ${clientIndex} (${browserName})...`);

    let profileName = '';
    if (baseChoice === '1') {
        profileName = clientIndex === 1 ? 'chrome-profile' : `chrome-profile-${clientIndex}`;
    } else if (baseChoice === '2') {
        profileName = clientIndex === 1 ? 'edge-profile' : `edge-profile-${clientIndex}`;
    } else {
        profileName = clientIndex === 1 ? 'firefox-profile' : `firefox-profile-${clientIndex}`;
    }

    const profilePath = path.join(profilesDir, profileName);
    clearLockFiles(profilePath);

    const launchArgs = {
        ...launchOptions,
        args: baseChoice === '3' ? [] : [...launchOptions.args]
    };
    if (channelVal) launchArgs.channel = channelVal;
    if (isApp && baseChoice !== '3') {
        launchArgs.args.push(`--app=${startUrl}`);
    }

    // Apply saved window bounds (position & size) if available (Chromium only)
    const bounds = clientWindowBounds[String(clientIndex)];
    if (bounds && typeof bounds.x === 'number' && typeof bounds.y === 'number' && bounds.w > 200 && bounds.h > 200) {
        console.log(`[System] [Client ${clientIndex}] Restoring window bounds: Position (${bounds.x}, ${bounds.y}), Size (${bounds.w}x${bounds.h})`);
        if (baseChoice !== '3') {
            launchArgs.args.push(`--window-position=${bounds.x},${bounds.y}`);
            launchArgs.args.push(`--window-size=${bounds.w},${bounds.h}`);
        }
    }

    const customUa = clientUserAgents[String(clientIndex)];
    if (customUa && customUa.trim() !== '') {
        launchArgs.userAgent = customUa.trim();
    }

    const customProxyStr = clientProxies[String(clientIndex)];
    if (customProxyStr && customProxyStr.trim() !== '') {
        const proxyObj = parseProxyString(customProxyStr);
        if (proxyObj) launchArgs.proxy = proxyObj;
    }

    if (baseChoice === '3') {
        launchArgs.firefoxUserPrefs = {
            'dom.ipc.processCount': 1,
            'javascript.options.mem.max': 512,
            'browser.sessionhistory.max_entries': 5,
            'browser.tabs.unloadOnLowMemory': true,
            'media.autoplay.default': 5,
            'toolkit.telemetry.enabled': false,
            'identity.fxaccounts.enabled': false,
            'services.sync.enabled': false,
            'browser.startup.firstrunSkipsHomepage': true,
            'gfx.webrender.enabled': true
        };
        if (clientIndex === 1) {
            launchArgs.profile = path.join(profilePath, 'playwright-nightly');
        }
    }

    const browserCtx = await browserType.launchPersistentContext(profilePath, launchArgs);
    clientContexts[clientIndex] = browserCtx;

    browserCtx.on('close', () => {
        handleClientContextClosed(clientIndex);
    });

    const pages = browserCtx.pages();
    const targetPage = pages.find(p => p.url().includes(targetUrlKeyword));
    const blankPages = pages.filter(p => isBlankPage(p));

    let pageForTarget = targetPage;
    if (!pageForTarget) {
        if (blankPages.length > 0) {
            pageForTarget = blankPages[0];
            pageForTarget.goto(startUrl).catch(e => console.log(`[System] Client ${clientIndex} navigation error:`, e.message));
        } else {
            pageForTarget = await browserCtx.newPage();
            pageForTarget.goto(startUrl).catch(e => console.log(`[System] Client ${clientIndex} navigation error:`, e.message));
        }
    }

    await browserCtx.addInitScript(({ index, initialPrefix }) => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        window.__clientPrefix = initialPrefix;
    }, { index: clientIndex, initialPrefix: clientAliases[String(clientIndex)] ? `[${clientAliases[String(clientIndex)]}] ` : `[Client ${clientIndex}] ` });

    if (!activeClients.includes(clientIndex)) {
        activeClients.push(clientIndex);
        activeClients.sort((a, b) => a - b);
        global.activeClients = activeClients;
    }

    findAndAttachTabForClient(clientIndex, browserCtx).catch(err => console.error(`Error in tab search for Client ${clientIndex}:`, err));

    sendOverlayUpdate();
    return { success: true, activeClients: activeClients, disabledClients: global.disabledClients || [] };
}
global.launchSingleClient = launchSingleClient;

// Scanning for the target tab periodically until found
async function findAndAttachTabForClient(clientIndex, browserCtx) {
    console.log(`[System] 🔍 [Client ${clientIndex}] Scanning for game tab containing "${targetUrlKeyword}"...`);

    while (true) {
        try {
            const pages = browserCtx.pages();
            const foundPage = pages.find(p => {
                const url = p.url();
                if (url.includes(targetUrlKeyword) || (url.includes('game') && !url.includes('localhost:3000'))) {
                    return true;
                }
                if (targetUrlKeyword.includes('localhost:3000') && url.includes('localhost:3000')) {
                    return true;
                }
                return false;
            });

            if (foundPage) {
                clientPages[clientIndex] = foundPage;
                delete clientCDPSessions[clientIndex];
                console.log(`\n[System] ✅ [Client ${clientIndex}] Game tab detected! Target locked: "${await foundPage.title()}"`);

                foundPage.removeAllListeners('close');
                foundPage.removeAllListeners('crash');

                foundPage.on('close', () => {
                    delete clientCDPSessions[clientIndex];
                    delete clientPages[clientIndex];
                    console.log(`\n🔴 [System] [Client ${clientIndex}] Game tab closed! Pausing actions for Client ${clientIndex}. You can re-launch it anytime from the Web Dashboard.`);
                    closeSingleClient(clientIndex);
                });

                foundPage.on('crash', () => {
                    delete clientCDPSessions[clientIndex];
                    delete clientPages[clientIndex];
                    console.log(`\n🔴 [System] [Client ${clientIndex}] Game tab crashed! Pausing actions for Client ${clientIndex}. You can re-launch it anytime from the Web Dashboard.`);
                    closeSingleClient(clientIndex);
                });

                console.log(`-------------------------------------------------`);
                console.log(`[Client ${clientIndex}] Global Hotkeys initialized!`);
                console.log(`-------------------------------------------------\n`);
                if (!activeClients.includes(clientIndex)) {
                    activeClients.push(clientIndex);
                    activeClients.sort((a, b) => a - b);
                }
                global.activeClients = activeClients;
                sendOverlayUpdate();
                updateBrowserTitles();
                startGhostMouseJitter(clientIndex);
                break;
            }
        } catch (e) {
            // Silence page retrieval errors during transition
        }
        await new Promise(res => setTimeout(res, 2000));
    }
}

// ============================================================================
// GHOST MOUSE JITTER
// ============================================================================
function startGhostMouseJitter(clientIndex) {
    stopGhostMouseJitter(clientIndex); // Clear any existing timer first
    if (!ghostMouseJitterConfig.enabled) return;

    const page = clientPages[clientIndex];
    if (!page) return;

    const scheduleNext = () => {
        const { intervalMin, intervalMax, maxOffset } = ghostMouseJitterConfig;
        const delay = intervalMin + Math.random() * (intervalMax - intervalMin);

        ghostMouseJitterTimers[clientIndex] = setTimeout(async () => {
            // Re-check if still enabled and page is still valid
            if (!ghostMouseJitterConfig.enabled) return;
            const currentPage = clientPages[clientIndex];
            if (!currentPage) return;

            try {
                // Get viewport size or use safe default
                const viewportSize = currentPage.viewportSize() || { width: 1280, height: 720 };
                const centerX = viewportSize.width / 2;
                const centerY = viewportSize.height / 2;

                // Random small offset from center
                const dx = (Math.random() - 0.5) * 2 * maxOffset;
                const dy = (Math.random() - 0.5) * 2 * maxOffset;

                await currentPage.mouse.move(centerX + dx, centerY + dy, { steps: 3 });
            } catch (e) {
                // Page may have navigated or closed — silently skip
            }

            scheduleNext();
        }, delay);
    };

    scheduleNext();
    console.log(`[Ghost Mouse] Started for Client ${clientIndex} (interval: ${ghostMouseJitterConfig.intervalMin}-${ghostMouseJitterConfig.intervalMax}ms, offset: ±${ghostMouseJitterConfig.maxOffset}px)`);
}

function stopGhostMouseJitter(clientIndex) {
    if (ghostMouseJitterTimers[clientIndex]) {
        clearTimeout(ghostMouseJitterTimers[clientIndex]);
        delete ghostMouseJitterTimers[clientIndex];
    }
}

function syncGhostMouseJitter() {
    // Called on config reload — start or stop for all active clients
    for (let clientIndex of activeClients) {
        if (ghostMouseJitterConfig.enabled && clientPages[clientIndex]) {
            startGhostMouseJitter(clientIndex);
        } else {
            stopGhostMouseJitter(clientIndex);
        }
    }
}

// ============================================================================
// SYSTEM INITIALIZATION
// ============================================================================
async function initSystem() {
    try {
        clearAllProfileLockFiles();
        migrateProfilesDirectory();

        console.log("\n=================================================================");
        console.log("🚀 NodeHotkey v2.2.4 Control Center Ready!");
        console.log("👉 Open Web Dashboard at: http://localhost:3000/");
        console.log("👉 Configure Proxy / User-Agent & launch your clients (1-8) directly from the Web UI!");
        console.log("=================================================================\n");

        // Start native mouse and keyboard listeners after initialization completes
        startGlobalListeners();

        isSystemInitialized = true;
        // Sync overlay process after system is fully initialized
        // Overlay setting is already loaded by loadConfigFromFile above
        // Just trigger sync now that isSystemInitialized = true
        syncOverlayProcess();

    } catch (error) {
        console.error("\n❌ [System Error] Initialization failed!");
        console.error(" >>", error.message);
        console.log("\n[System] Bot exiting due to startup failure.");
        process.exit(1);
    }
}

function normalizeKeyName(keyName) {
    if (!keyName) return '';
    const u = keyName.trim().toUpperCase();
    if (u === 'INS' || u === 'INSERT') return 'INSERT';
    if (u === 'ESC' || u === 'ESCAPE') return 'ESCAPE';
    if (u === 'DEL' || u === 'DELETE') return 'DELETE';
    if (u === 'BS' || u === 'BACKSPACE') return 'BACKSPACE';
    if (u === 'ENT' || u === 'ENTER') return 'ENTER';
    if (u === 'PGUP' || u === 'PAGEUP' || u === 'PAGE UP') return 'PAGEUP';
    if (u === 'PGDN' || u === 'PAGEDOWN' || u === 'PAGE DOWN') return 'PAGEDOWN';
    if (u === 'PRTSC' || u === 'PRINTSCREEN' || u === 'PRINT SCREEN') return 'PRINTSCREEN';
    if (u === 'SCRLK' || u === 'SCROLLLOCK' || u === 'SCROLL LOCK') return 'SCROLLLOCK';
    if (u === 'PAUSE' || u === 'PAUSE BREAK') return 'PAUSE';
    if (u === 'NUM' || u === 'NUMLOCK' || u === 'NUM LOCK') return 'NUMLOCK';
    return u;
}

function matchKeyTrigger(triggerValue, eventKeyName, downState, isUp = false) {
    if (!triggerValue || !eventKeyName) return false;

    const parts = triggerValue.split('+').map(s => s.trim().toUpperCase());
    if (parts.length === 0) return false;

    const mainKey = normalizeKeyName(parts[parts.length - 1]);
    const eventKey = normalizeKeyName(eventKeyName);
    const requiredModifiers = parts.slice(0, parts.length - 1);

    if (mainKey !== eventKey) {
        return false;
    }

    if (isUp) {
        return true;
    }

    if (requiredModifiers.length === 0) {
        return true;
    }

    const isModDown = (modName) => {
        const u = modName.toUpperCase();
        if (u === 'ALT') {
            return !!(downState['LEFT ALT'] || downState['RIGHT ALT'] || downState['ALT'] || downState['L ALT'] || downState['R ALT'] || downState['ALT GR']);
        }
        if (u === 'LEFT ALT' || u === 'L ALT' || u === 'LALT') {
            return !!(downState['LEFT ALT'] || downState['L ALT'] || downState['LALT']);
        }
        if (u === 'RIGHT ALT' || u === 'R ALT' || u === 'RALT') {
            return !!(downState['RIGHT ALT'] || downState['R ALT'] || downState['RALT'] || downState['ALT GR']);
        }
        if (u === 'CTRL' || u === 'CONTROL') {
            return !!(downState['LEFT CTRL'] || downState['RIGHT CTRL'] || downState['CTRL'] || downState['CONTROL'] || downState['L CTRL'] || downState['R CTRL']);
        }
        if (u === 'LEFT CTRL' || u === 'L CTRL' || u === 'LCTRL') {
            return !!(downState['LEFT CTRL'] || downState['L CTRL'] || downState['LCTRL']);
        }
        if (u === 'RIGHT CTRL' || u === 'R CTRL' || u === 'RCTRL') {
            return !!(downState['RIGHT CTRL'] || downState['R CTRL'] || downState['RCTRL']);
        }
        if (u === 'SHIFT') {
            return !!(downState['LEFT SHIFT'] || downState['RIGHT SHIFT'] || downState['SHIFT'] || downState['L SHIFT'] || downState['R SHIFT']);
        }
        if (u === 'LEFT SHIFT' || u === 'L SHIFT' || u === 'LSHIFT') {
            return !!(downState['LEFT SHIFT'] || downState['L SHIFT'] || downState['LSHIFT']);
        }
        if (u === 'RIGHT SHIFT' || u === 'R SHIFT' || u === 'RSHIFT') {
            return !!(downState['RIGHT SHIFT'] || downState['R SHIFT'] || downState['RSHIFT']);
        }
        return !!(downState[u] || downState[modName]);
    };

    for (let reqMod of requiredModifiers) {
        if (!isModDown(reqMod)) {
            return false;
        }
    }

    return true;
}

function formatKeyForPlaywright(keyStr) {
    if (!keyStr) return '1';
    const parts = keyStr.split('+').map(s => s.trim());

    const mappedParts = parts.map(p => {
        const u = p.toUpperCase();
        if (u === 'ESC' || u === 'ESCAPE') return 'Escape';
        if (u === 'ALT' || u === 'LEFT ALT' || u === 'RIGHT ALT' || u === 'L ALT' || u === 'R ALT' || u === 'LALT' || u === 'RALT' || u === 'ALT GR') return 'Alt';
        if (u === 'CTRL' || u === 'CONTROL' || u === 'LEFT CTRL' || u === 'RIGHT CTRL' || u === 'L CTRL' || u === 'R CTRL' || u === 'LCTRL' || u === 'RCTRL') return 'Control';
        if (u === 'SHIFT' || u === 'LEFT SHIFT' || u === 'RIGHT SHIFT' || u === 'L SHIFT' || u === 'R SHIFT' || u === 'LSHIFT' || u === 'RSHIFT') return 'Shift';
        if (u === 'ENT' || u === 'ENTER') return 'Enter';
        if (u === 'BS' || u === 'BACKSPACE') return 'Backspace';
        if (u === 'DEL' || u === 'DELETE') return 'Delete';
        if (u === 'INS' || u === 'INSERT') return 'Insert';
        if (u === 'PGUP' || u === 'PAGEUP' || u === 'PAGE UP') return 'PageUp';
        if (u === 'PGDN' || u === 'PAGEDOWN' || u === 'PAGE DOWN') return 'PageDown';
        if (u === 'PRTSC' || u === 'PRINTSCREEN' || u === 'PRINT SCREEN') return 'PrintScreen';
        if (u === 'SCRLK' || u === 'SCROLLLOCK' || u === 'SCROLL LOCK') return 'ScrollLock';
        if (u === 'PAUSE') return 'Pause';
        if (u === 'NUM' || u === 'NUMLOCK' || u === 'NUM LOCK') return 'NumLock';
        return p;
    });
    return mappedParts.join('+');
}

async function pressKeyHoldDown(page, keyStr) {
    const formatted = formatKeyForPlaywright(keyStr);
    const parts = formatted.split('+');
    for (let p of parts) {
        await page.keyboard.down(p);
    }
}

async function pressKeyHoldUp(page, keyStr) {
    const formatted = formatKeyForPlaywright(keyStr);
    const parts = formatted.split('+').reverse();
    for (let p of parts) {
        await page.keyboard.up(p);
    }
}

function isClientEnabled(clientIdxStr) {
    if (!global.disabledClients || !Array.isArray(global.disabledClients)) return true;
    const s = String(clientIdxStr);
    return !global.disabledClients.includes(s) && !global.disabledClients.includes(parseInt(s, 10));
}

function getActionTargets(targetStr) {
    if (!targetStr) return ['1'].filter(isClientEnabled);
    let raw = [];
    if (targetStr === 'all' || targetStr === 'both') {
        raw = activeClients.map(String);
    } else {
        raw = targetStr.split(',').map(s => s.trim()).filter(Boolean);
    }
    return raw.filter(isClientEnabled);
}

let clientCDPSessions = {};

async function getCDPSession(targetIdx) {
    const targetPage = clientPages[targetIdx];
    if (!targetPage) return null;
    if (!clientCDPSessions[targetIdx] || clientCDPSessions[targetIdx]._closed) {
        try {
            const cdp = await targetPage.context().newCDPSession(targetPage);
            clientCDPSessions[targetIdx] = cdp;
        } catch (e) {
            return null;
        }
    }
    return clientCDPSessions[targetIdx];
}

// ============================================================================
// ACTION & LOOP FUNCTIONS
// ============================================================================
async function sendKey(action, key) {
    if (global.isSuspended) return;
    const target = action.targetClient || '1';
    const targets = getActionTargets(target);
    if (targets.length === 0) return;

    if (targets.length > 1) {
        // Sequentially send to all targets in the list
        for (let targetIdxStr of targets) {
            await sendKey({ ...action, targetClient: targetIdxStr }, key);
        }
        return;
    }

    const targetIdx = parseInt(targets[0], 10);
    const targetPage = clientPages[targetIdx];
    const clientName = `Client ${targetIdx}`;

    if (!targetPage) return;

    // Cooldown Prevention Check per client
    let activeCooldownMs = 0;
    let cdKeyId = action.cooldownPresetId || ('custom_' + action.id);
    let cdLabel = action.name;

    if (action.customCooldownMs && parseInt(action.customCooldownMs) > 0) {
        activeCooldownMs = parseInt(action.customCooldownMs);
        if (action.cooldownPresetId && action.cooldownPresetId !== 'custom') {
            const presetsById = getCooldownPresetsById();
            const preset = presetsById[action.cooldownPresetId];
            cdLabel = preset ? `${preset.name} (Custom ${activeCooldownMs}ms)` : `Custom (${activeCooldownMs}ms)`;
        } else {
            cdLabel = `Custom (${activeCooldownMs}ms)`;
        }
    } else if (action.cooldownPresetId && action.cooldownPresetId !== 'custom') {
        const presetsById = getCooldownPresetsById();
        const preset = presetsById[action.cooldownPresetId];
        if (preset && preset.cooldownMs > 0) {
            activeCooldownMs = preset.cooldownMs;
            cdLabel = preset.name;
        }
    }

    if (activeCooldownMs > 0) {
        clientCooldowns[targetIdx] = clientCooldowns[targetIdx] || {};
        const now = Date.now();
        const expireTime = clientCooldowns[targetIdx][cdKeyId] || 0;
        const lastCycle = clientCooldowns[targetIdx][cdKeyId + '_lastCycle'] || 0;

        // If cooldown is currently active AND it's not part of the same action burst (< 1500ms)
        if (now < expireTime && (now - lastCycle) > 1500) {
            const remainingSec = ((expireTime - now) / 1000).toFixed(1);
            console.log(`[Cooldown] [${clientName}] ⏱️ Skipped "${action.name}" (${cdLabel}) - Skill on cooldown (${remainingSec}s remaining)`);
            return; // Skip sending key!
        }

        // Update timestamp for new action trigger burst
        if ((now - lastCycle) >= 1500) {
            clientCooldowns[targetIdx][cdKeyId + '_lastCycle'] = now;
            clientCooldowns[targetIdx][cdKeyId] = now + activeCooldownMs;
        }
    }

    try {
        const holdTime = Math.floor(Math.random() * 70) + 60;
        const cdp = await getCDPSession(targetIdx);

        // Check if key contains combination modifiers (e.g. "LEFT ALT + 1", "ALT + 2", "CTRL + F1")
        const parts = key.split('+').map(s => s.trim());
        if (parts.length > 1) {
            const formattedParts = parts.map(p => formatKeyForPlaywright(p));
            // Send modifier press for combination keys
            if (cdp) {
                for (let p of formattedParts) {
                    await cdp.send('Input.dispatchKeyEvent', {
                        type: 'rawKeyDown',
                        key: p,
                        code: p
                    }).catch(() => { });
                }
                setTimeout(async () => {
                    for (let p of [...formattedParts].reverse()) {
                        await cdp.send('Input.dispatchKeyEvent', {
                            type: 'keyUp',
                            key: p,
                            code: p
                        }).catch(() => { });
                    }
                }, holdTime);
                console.log(`[Action] [${clientName}] Sent key: "${key}" (Formatted: "${formattedParts.join('+')}" | Direct CDP Combo | Hold: ${holdTime}ms)`);
            } else {
                for (let p of formattedParts) {
                    await targetPage.keyboard.down(p).catch(() => { });
                }
                setTimeout(async () => {
                    for (let p of [...formattedParts].reverse()) {
                        await targetPage.keyboard.up(p).catch(() => { });
                    }
                }, holdTime);
                console.log(`[Action] [${clientName}] Sent key: "${key}" (Formatted: "${formattedParts.join('+')}" | Combo | Hold: ${holdTime}ms)`);
            }
            return;
        }

        const formattedKey = formatKeyForPlaywright(key);

        if (cdp) {
            await cdp.send('Input.dispatchKeyEvent', {
                type: 'rawKeyDown',
                key: formattedKey,
                code: formattedKey,
                text: formattedKey.length === 1 ? formattedKey : undefined,
                unmodifiedText: formattedKey.length === 1 ? formattedKey : undefined
            }).catch(() => { });

            setTimeout(() => {
                cdp.send('Input.dispatchKeyEvent', {
                    type: 'keyUp',
                    key: formattedKey,
                    code: formattedKey
                }).catch(() => { });
            }, holdTime);

            console.log(`[Action] [${clientName}] Sent key: "${key}" (Formatted: "${formattedKey}" | Direct CDP | Hold: ${holdTime}ms)`);
        } else {
            await targetPage.keyboard.down(formattedKey).catch(() => { });
            setTimeout(() => {
                targetPage.keyboard.up(formattedKey).catch(() => { });
            }, holdTime);

            console.log(`[Action] [${clientName}] Sent key: "${key}" (Formatted: "${formattedKey}" | Hold: ${holdTime}ms)`);
        }
    } catch (e) {
        console.error(`[Action Error] [${clientName}] Failed to send key "${key}":`, e.message);
    }
}

// Ensure running loops match the activeActions list
function syncRunningLoops() {
    for (let actionId in activeLoopStates) {
        if (activeLoopStates[actionId].running) {
            const matchingAct = activeActions.find(a => a.id === actionId && a.enabled);
            if (!matchingAct || matchingAct.mode !== 'loop') {
                stopLoopAction(actionId, matchingAct ? matchingAct.name : actionId);
            }
        }
    }
    for (let actionId in activeSequencerLoops) {
        if (activeSequencerLoops[actionId].running) {
            const matchingAct = activeActions.find(a => a.id === actionId && a.enabled);
            if (!matchingAct || (matchingAct.mode !== 'sequencer' && matchingAct.mode !== 'cast_sequence') || matchingAct.modeType === 'once') {
                stopCastSequencerAction(actionId, matchingAct ? matchingAct.name : actionId);
            }
        }
    }
    for (let actionId in activeSchedulerStates) {
        if (activeSchedulerStates[actionId].running) {
            const matchingAct = activeActions.find(a => a.id === actionId && a.enabled);
            if (!matchingAct || matchingAct.mode !== 'loop_scheduler') {
                stopLoopSchedulerAction(actionId, matchingAct ? matchingAct.name : actionId);
            }
        }
    }
}

// Start a loop action
async function startLoopAction(action, callStack) {
    if (global.isSuspended) return;
    const target = action.targetClient || '1';
    let targets = getActionTargets(target).map(x => parseInt(x, 10));

    // Run onBeforeStart chains first (e.g. Action Control commands)
    await fireChain(action, 'onBeforeStart', callStack);

    console.log(`🟢 [Action] Starting loop: "${action.name}" on Client ${target}`);
    if (!activeLoopStates[action.id]) {
        activeLoopStates[action.id] = { running: true, timeout: null };
    } else {
        activeLoopStates[action.id].running = true;
    }

    await fireChain(action, 'onStart', callStack);

    // Run first steps if any
    if (action.firstSteps && action.firstSteps.length > 0) {
        console.log(` - Running first steps for "${action.name}"...`);
        for (let step of action.firstSteps) {
            if (!activeLoopStates[action.id] || !activeLoopStates[action.id].running) return;
            await sendKey(action, step.key);
            const stepDelay = parseInt(step.delay, 10);
            if (!isNaN(stepDelay) && stepDelay > 0) {
                await new Promise(res => setTimeout(res, stepDelay));
            }
        }
    }

    await fireChain(action, 'onAfterStart', callStack);

    // Start the interval loop (check executeImmediately flag, default true)
    if (action.executeImmediately === false) {
        const baseInterval = action.interval || 3000;
        const jitterMax = action.jitter || 0;
        let initialInterval = baseInterval;
        if (jitterMax > 0) {
            const jitter = Math.floor(Math.random() * (jitterMax * 2)) - jitterMax;
            initialInterval = Math.max(100, baseInterval + jitter);
        }
        console.log(` - Loop "${action.name}" delayed initial cycle by ${initialInterval}ms (Execute Immediately: false)`);
        activeLoopStates[action.id].timeout = setTimeout(() => runLoopStep(action, callStack), initialInterval);
    } else {
        runLoopStep(action, callStack);
    }
    sendOverlayUpdate();
}

// Stop a loop action
function stopLoopAction(actionId, actionName) {
    if (activeLoopStates[actionId]) {
        console.log(`🔴 [Action] Stopped: "${actionName}"`);
        activeLoopStates[actionId].running = false;
        if (activeLoopStates[actionId].timeout) {
            clearTimeout(activeLoopStates[actionId].timeout);
            activeLoopStates[actionId].timeout = null;
        }
        const act = activeActions.find(a => a.id === actionId);
        if (act) fireChain(act, 'onStop');
        sendOverlayUpdate();
    }
}

// Stop all running loops
function stopAllLoops() {
    for (let act of activeActions) {
        if (act.mode === 'loop') {
            stopLoopAction(act.id, act.name);
        } else if (act.mode === 'sequencer' || act.mode === 'cast_sequence') {
            stopCastSequencerAction(act.id, act.name);
        }
    }
}

// Stop active loops for a specific client
function stopLoopsForClient(clientIndex) {
    for (let act of activeActions) {
        const targets = getActionTargets(act.targetClient).map(x => parseInt(x, 10));
        if (targets.includes(clientIndex)) {
            if (act.mode === 'loop') {
                stopLoopAction(act.id, act.name);
            } else if (act.mode === 'sequencer' || act.mode === 'cast_sequence') {
                stopCastSequencerAction(act.id, act.name);
            }
        }
    }
}

// Inner execution step for loops
async function runLoopStep(action, callStack) {
    const state = activeLoopStates[action.id];
    if (!state || !state.running) return;

    if (action.keys && action.keys.length > 0) {
        for (let key of action.keys) {
            if (!state || !state.running) return;
            await sendKey(action, key);
        }
    }

    await fireChain(action, 'onEachCycle', callStack);

    const baseInterval = action.interval || 3000;
    const jitterMax = action.jitter || 0;
    let nextInterval = baseInterval;

    if (jitterMax > 0) {
        const jitter = Math.floor(Math.random() * (jitterMax * 2)) - jitterMax;
        nextInterval = Math.max(100, baseInterval + jitter);
    }

    state.timeout = setTimeout(() => runLoopStep(action, new Set()), nextInterval);
}

// Run buff sequence
async function runBuffSequenceAction(action, callStack) {
    if (global.isSuspended) return;
    const target = action.targetClient || '1';
    let targets = getActionTargets(target).map(x => parseInt(x, 10));

    // Generate a unique cancellation token for this invocation
    const myToken = (buffSequenceTokens[action.id] || 0) + 1;
    buffSequenceTokens[action.id] = myToken;

    for (let t of targets) {
        isBuffSequenceRunning[String(t)] = true;
        console.log(`🔵 [Action] Buff Sequence Started: "${action.name}" on Client ${t}... (token: ${myToken})`);
    }
    await fireChain(action, 'onBeforeStart', callStack);
    await fireChain(action, 'onStart', callStack);
    await fireChain(action, 'onAfterStart', callStack);
    sendOverlayUpdate();

    const delay = action.delayBuff || 800;
    let wasInterrupted = false;

    if (action.keys && action.keys.length > 0) {
        for (let key of action.keys) {
            // Check cancellation: token changed means we were cancelled by Emergency Stop or Action Control
            if (buffSequenceTokens[action.id] !== myToken) {
                console.log(`🔴 [Action] Buff Sequence Cancelled (token invalidated): "${action.name}"`);
                wasInterrupted = true;
                break;
            }
            // Also check the per-client flag for backward compatibility
            let isRunningAny = targets.some(t => isBuffSequenceRunning[String(t)]);
            if (!isRunningAny) {
                console.log(`🔴 [Action] Buff Sequence Interrupted/Stopped: "${action.name}"`);
                wasInterrupted = true;
                break;
            }
            await sendKey(action, key);
            await new Promise(res => setTimeout(res, delay));
        }
    }

    for (let t of targets) {
        // Only clear the running flag if we still own the token (no new sequence started)
        if (buffSequenceTokens[action.id] === myToken) {
            isBuffSequenceRunning[String(t)] = false;
        }
        if (!wasInterrupted) {
            console.log(`⚪ [Action] Finished Buff Sequence: "${action.name}" on Client ${t}`);
        }
    }
    if (!wasInterrupted) {
        await fireChain(action, 'onComplete', callStack);
    }
    sendOverlayUpdate();
}

// Run single press
async function runSinglePressAction(action, callStack) {
    if (global.isSuspended) return;
    const target = action.targetClient || '1';
    console.log(`⚡ [Action] Single Press: "${action.name}" on Client ${target}`);
    if (action.keys && action.keys.length > 0) {
        for (let key of action.keys) {
            await sendKey(action, key);
        }
    }
    const delayAfter = action.delayAfter !== undefined ? parseInt(action.delayAfter, 10) : 0;
    if (delayAfter > 0) {
        await new Promise(res => setTimeout(res, delayAfter));
    }
    await fireChain(action, 'onComplete', callStack);
}

// Run delay only (Pure Delay / Timer Only, no keypresses sent)
async function runDelayOnlyAction(action, callStack) {
    if (global.isSuspended) return;
    const delay = action.delayMs !== undefined ? parseInt(action.delayMs, 10) : (action.delayBuff || 1000);
    console.log(`⏳ [Action] Delay Only Started: "${action.name}" (Waiting ${delay}ms)...`);
    await fireChain(action, 'onBeforeStart', callStack);
    if (delay > 0) {
        await new Promise(res => setTimeout(res, delay));
    }
    console.log(`⏳ [Action] Delay Only Finished: "${action.name}" (${delay}ms complete)`);
    await fireChain(action, 'onComplete', callStack);
}

async function toggleKeyHoldAction(action, callStack) {
    if (global.isSuspended) return;
    const targetKey = (action.targetKey && action.targetKey.trim()) ? action.targetKey.trim() : '';
    const target = action.targetClient || '1';

    if (!targetKey) {
        console.warn(`[Action Warning] Skipped "${action.name}" - No target key specified for Key Hold mode.`);
        return;
    }

    let targets = getActionTargets(target).map(x => parseInt(x, 10));

    const isCurrentlyHeld = !!activeHoldStates[action.id];
    const nextState = !isCurrentlyHeld;
    activeHoldStates[action.id] = nextState;

    console.log(`⚓ [Action] Toggle Key Hold for "${action.name}" (${targetKey}) on Client ${target} ➜ ${nextState ? 'DOWN' : 'UP'}`);

    for (let t of targets) {
        const page = clientPages[t];
        if (!page) continue;
        const cdp = await getCDPSession(t);
        const formattedKey = formatKeyForPlaywright(targetKey);

        try {
            if (cdp) {
                if (nextState) {
                    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: formattedKey, code: formattedKey }).catch(() => { });
                } else {
                    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: formattedKey, code: formattedKey }).catch(() => { });
                }
            } else {
                if (nextState) {
                    await pressKeyHoldDown(page, targetKey);
                } else {
                    await pressKeyHoldUp(page, targetKey);
                }
            }
        } catch (e) {
            console.error(`[Action Error] Failed toggle key hold on Client ${t}:`, e.message);
        }
    }

    fireChain(action, nextState ? 'onEnable' : 'onDisable', callStack);
    sendOverlayUpdate();
}

let sequencerTokens = {};

// Start a Sequencer Loop Action (Continuous execution with step delays and interval rest)
async function startCastSequencerLoop(action, callStack) {
    if (global.isSuspended) return;
    const target = action.targetClient || '1';
    console.log(`⚔️ [Action] Starting Sequencer Loop: "${action.name}" on Client ${target}`);

    const myToken = (sequencerTokens[action.id] || 0) + 1;
    sequencerTokens[action.id] = myToken;

    if (!activeSequencerLoops[action.id]) {
        activeSequencerLoops[action.id] = { running: true, timeout: null, token: myToken };
    } else {
        activeSequencerLoops[action.id].running = true;
        activeSequencerLoops[action.id].token = myToken;
    }

    sendOverlayUpdate();
    runSequencerLoopStep(action, callStack, myToken);
}

// Stop a Sequencer Action (Loop or Once)
function stopCastSequencerAction(actionId, actionName) {
    sequencerTokens[actionId] = (sequencerTokens[actionId] || 0) + 1;

    const act = activeActions.find(a => a.id === actionId);
    if (act) {
        const target = act.targetClient || '1';
        let targets = getActionTargets(target).map(x => parseInt(x, 10));
        for (let t of targets) {
            delete isSequencerRunning[String(t)];
        }
    }

    if (activeSequencerLoops[actionId]) {
        console.log(`🔴 [Action] Stopped Sequencer Loop: "${actionName || actionId}"`);
        activeSequencerLoops[actionId].running = false;
        if (activeSequencerLoops[actionId].timeout) {
            clearTimeout(activeSequencerLoops[actionId].timeout);
            activeSequencerLoops[actionId].timeout = null;
        }
        if (act) fireChain(act, 'onStop');
    }
    sendOverlayUpdate();
}

// Inner cycle runner for Sequencer Loop
async function runSequencerLoopStep(action, callStack, myToken) {
    const state = activeSequencerLoops[action.id];
    if (!state || !state.running || global.isSuspended || sequencerTokens[action.id] !== myToken) return;

    const target = action.targetClient || '1';
    let targets = getActionTargets(target).map(x => parseInt(x, 10));
    const steps = Array.isArray(action.steps) ? action.steps : [];

    for (let sIdx = 0; sIdx < steps.length; sIdx++) {
        if (!state || !state.running || global.isSuspended || sequencerTokens[action.id] !== myToken) return;
        const step = steps[sIdx];
        const rawKey = (step.key || '').trim();
        if (!rawKey) continue;

        const delayMs = step.delay !== undefined ? parseInt(step.delay, 10) : (step.castTimeMs !== undefined ? parseInt(step.castTimeMs, 10) : 800);

        for (let t of targets) {
            const page = clientPages[t];
            if (!page) continue;
            await sendKey(action, rawKey, t);
        }

        await fireChain(action, 'onStep', callStack);

        if (delayMs > 0) {
            await new Promise(res => setTimeout(res, delayMs));
        }
    }

    if (!state || !state.running || global.isSuspended || sequencerTokens[action.id] !== myToken) return;

    await fireChain(action, 'onEachCycle', callStack);

    const baseInterval = action.interval !== undefined ? parseInt(action.interval, 10) : 1000;
    state.timeout = setTimeout(() => runSequencerLoopStep(action, new Set(), myToken), Math.max(50, baseInterval));
}

// Run Smart Cast Sequencer Action Once / Burst
async function runCastSequencerOnce(action, callStack) {
    if (global.isSuspended) return;
    const target = action.targetClient || '1';
    let targets = getActionTargets(target).map(x => parseInt(x, 10));
    const steps = Array.isArray(action.steps) ? action.steps : [];
    const repeatCount = Math.max(1, parseInt(action.repeatCount, 10) || 1);

    if (steps.length === 0) {
        console.warn(`[Sequencer Warning] Skipped "${action.name}" - No steps defined.`);
        return;
    }

    const myToken = (sequencerTokens[action.id] || 0) + 1;
    sequencerTokens[action.id] = myToken;

    for (let t of targets) {
        isSequencerRunning[String(t)] = true;
    }
    sendOverlayUpdate();

    console.log(`⚔️ [Action] Cast Sequencer (Once): "${action.name}" (${steps.length} steps, ${repeatCount}x) on Client ${target}... (token: ${myToken})`);

    let wasInterrupted = false;

    try {
        for (let r = 0; r < repeatCount; r++) {
            if (global.isSuspended || sequencerTokens[action.id] !== myToken) {
                wasInterrupted = true;
                break;
            }

            for (let sIdx = 0; sIdx < steps.length; sIdx++) {
                if (global.isSuspended || sequencerTokens[action.id] !== myToken) {
                    wasInterrupted = true;
                    break;
                }
                const step = steps[sIdx];
                const rawKey = (step.key || '').trim();
                if (!rawKey) continue;

                const delayMs = step.delay !== undefined ? parseInt(step.delay, 10) : (step.castTimeMs !== undefined ? parseInt(step.castTimeMs, 10) : 800);

                for (let t of targets) {
                    const page = clientPages[t];
                    if (!page) continue;
                    await sendKey(action, rawKey, t);
                }

                await fireChain(action, 'onStep', callStack);

                if (delayMs > 0) {
                    await new Promise(res => setTimeout(res, delayMs));
                }
            }
        }

        if (!wasInterrupted) {
            const delayAfter = action.delayAfter !== undefined ? parseInt(action.delayAfter, 10) : 0;
            if (delayAfter > 0) {
                await new Promise(res => setTimeout(res, delayAfter));
            }

            console.log(`⚔️ [Action] Cast Sequencer Finished: "${action.name}" on Client ${target}`);
            await fireChain(action, 'onComplete', callStack);
        } else {
            console.log(`🔴 [Action] Cast Sequencer Cancelled / Interrupted: "${action.name}"`);
            await fireChain(action, 'onStop', callStack);
        }
    } finally {
        if (sequencerTokens[action.id] === myToken) {
            for (let t of targets) {
                delete isSequencerRunning[String(t)];
            }
        }
        sendOverlayUpdate();
    }
}

let activeSchedulerStates = {};
let schedulerTokens = {};

// Start a Loop Scheduler Action (Multi-Timer Dispatcher with Anti-Collision Guard Queue)
async function startLoopSchedulerAction(action, callStack) {
    if (global.isSuspended) return;
    const target = action.targetClient || '1';
    console.log(`⏱️ [Action] Starting Loop Scheduler: "${action.name}" on Client ${target}...`);

    const myToken = (schedulerTokens[action.id] || 0) + 1;
    schedulerTokens[action.id] = myToken;

    const items = Array.isArray(action.items) ? action.items : [];
    const state = {
        running: true,
        timeouts: [],
        queue: [],
        isProcessing: false,
        token: myToken
    };
    activeSchedulerStates[action.id] = state;
    sendOverlayUpdate();

    // Schedule each independent loop timer
    items.forEach((it, idx) => {
        if (it.enabled === false) return;
        const baseInterval = Math.max(50, parseInt(it.interval, 10) || 3000);
        const jitter = Math.max(0, parseInt(it.jitter, 10) || 0);
        const execImmediately = it.executeImmediately !== false;

        const getNextInterval = () => {
            if (jitter <= 0) return baseInterval;
            const randomOffset = Math.floor(Math.random() * (jitter * 2 + 1)) - jitter;
            return Math.max(50, baseInterval + randomOffset);
        };

        const scheduleCycle = (delayMs) => {
            if (!state.running || schedulerTokens[action.id] !== myToken || global.isSuspended) return;
            const timer = setTimeout(async () => {
                if (!state.running || schedulerTokens[action.id] !== myToken || global.isSuspended) return;
                // Push to FIFO Queue
                state.queue.push({ item: it, index: idx });
                processSchedulerQueue(action, state, myToken);
                // Schedule next recurring cycle with jitter
                scheduleCycle(getNextInterval());
            }, delayMs);
            state.timeouts.push(timer);
        };

        if (execImmediately) {
            scheduleCycle(0);
        } else {
            scheduleCycle(getNextInterval());
        }
    });
}

// Process Scheduler FIFO Queue with Collision Guard Delay
async function processSchedulerQueue(action, state, myToken) {
    if (!state || !state.running || state.isProcessing || schedulerTokens[action.id] !== myToken || global.isSuspended) return;
    state.isProcessing = true;

    const guardMs = Math.max(0, parseInt(action.collisionGuardMs, 10) || 800);

    try {
        while (state.queue.length > 0 && state.running && schedulerTokens[action.id] === myToken && !global.isSuspended) {
            const task = state.queue.shift();
            if (!task || !task.item) continue;

            console.log(`⏱️ [Scheduler] "${action.name}" ➔ Dispatching [item_${task.index}] ("${task.item.name}")...`);
            emitSignal(action.id, `item_${task.index}`);
            await fireChain(action, `item_${task.index}`, new Set());

            // Apply Anti-Collision Guard wait before processing next item in queue
            if (guardMs > 0 && state.queue.length > 0) {
                await new Promise(r => setTimeout(r, guardMs));
            }
        }
    } finally {
        if (state) state.isProcessing = false;
    }
}

// Stop a Loop Scheduler Action
function stopLoopSchedulerAction(actionId, actionName) {
    schedulerTokens[actionId] = (schedulerTokens[actionId] || 0) + 1;
    const state = activeSchedulerStates[actionId];
    if (state) {
        console.log(`🔴 [Action] Stopped Loop Scheduler: "${actionName || actionId}"`);
        state.running = false;
        if (Array.isArray(state.timeouts)) {
            state.timeouts.forEach(t => clearTimeout(t));
            state.timeouts = [];
        }
        state.queue = [];
        const act = activeActions.find(a => a.id === actionId);
        if (act) fireChain(act, 'onStop');
    }
    sendOverlayUpdate();
}

let nativeAudioWorker = null;

function initNativeAudioWorker() {
    if (nativeAudioWorker) return;
    try {
        const psScript = `
$ErrorActionPreference = 'SilentlyContinue'

$code = @"
using System;
using System.IO;
using System.Windows.Media;
using System.Threading.Tasks;
using System.Collections.Concurrent;

public class AsyncAudioPlayer {
    private static ConcurrentBag<MediaPlayer> activePlayers = new ConcurrentBag<MediaPlayer>();

    public static void Play(string filePath, int repeats, int volPercent) {
        if (volPercent <= 0 || !File.Exists(filePath)) return;
        double vol = Math.Max(0.0, Math.Min(1.0, (double)volPercent / 100.0));
        
        Task.Run(async () => {
            try {
                for (int i = 0; i < repeats; i++) {
                    var player = new MediaPlayer();
                    activePlayers.Add(player);
                    player.Open(new Uri(filePath));
                    player.Volume = vol;
                    player.Play();
                    
                    if (repeats > 1 && i < repeats - 1) {
                        await Task.Delay(450);
                    }
                }
                
                await Task.Delay(4000);
                
                while (activePlayers.Count > 50) {
                    MediaPlayer p;
                    activePlayers.TryTake(out p);
                }
            } catch {}
        });
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies 'presentationCore', 'System.Windows.Presentation', 'WindowsBase'

while ($line = [Console]::In.ReadLine()) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line.Split('|')
    $filePath = $parts[0]
    $repeats = if ($parts.Length -gt 1) { [int]$parts[1] } else { 1 }
    $volPercent = if ($parts.Length -gt 2) { [int]$parts[2] } else { 100 }
    
    [AsyncAudioPlayer]::Play($filePath, $repeats, $volPercent)
}
`;
        nativeAudioWorker = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
            windowsHide: true,
            stdio: ['pipe', 'ignore', 'ignore']
        });
        nativeAudioWorker.on('exit', () => { nativeAudioWorker = null; });
    } catch (e) {
        console.warn('Failed to start native audio worker:', e.message);
    }
}

// Pre-warm the audio worker immediately at startup
initNativeAudioWorker();

function playNativeSound(preset, url, file, repeatCount = 1, volume = 100) {
    const vol = volume !== undefined ? parseInt(volume, 10) : 100;
    if (vol <= 0) return;

    if (!nativeAudioWorker) {
        initNativeAudioWorker();
    }
    const repeats = Math.max(1, parseInt(repeatCount || 1, 10));

    let audioPath = '';
    if (file) {
        audioPath = path.join(__dirname, 'public', file.startsWith('/') ? file.slice(1) : file);
    } else if (url && !url.startsWith('http')) {
        audioPath = path.isAbsolute(url) ? url : path.join(__dirname, 'public', url.startsWith('/') ? url.slice(1) : url);
    } else {
        const cleanPreset = (preset || 'ding').toLowerCase();
        audioPath = path.join(__dirname, 'public', 'sounds', `${cleanPreset}.wav`);
    }

    if (nativeAudioWorker && nativeAudioWorker.stdin && nativeAudioWorker.stdin.writable) {
        nativeAudioWorker.stdin.write(`${audioPath}|${repeats}|${vol}\n`);
    }
}

async function runSoundAlertAction(action, callStack) {
    if (global.isSuspended) return;
    const source = action.soundSource || 'preset';
    const preset = action.soundPreset || 'ding';
    const url = action.soundUrl || '';
    const file = action.soundFile || '';
    const repeat = action.repeatCount || 1;
    const volume = action.volume !== undefined ? parseInt(action.volume, 10) : 100;

    if (volume <= 0) {
        console.log(`🔊 [Action] Sound Alert: "${action.name}" skipped (Volume: 0%)`);
        await fireChain(action, 'onFired', callStack);
        return;
    }

    console.log(`🔊 [Action] Playing Sound Alert: "${action.name}" (Type: ${source}, Preset: ${preset}, Vol: ${volume}%)`);
    playNativeSound(preset, url, file, repeat, volume);
    await fireChain(action, 'onFired', callStack);
}

async function runEmergencyStopAction(action, callStack) {
    const scope = action.stopScope || 'all';
    console.log(`🛑 [Action] Emergency Stop Triggered: "${action.name}" (Scope: ${scope})`);

    if (scope === 'all') {
        // 1. Stop all active loops
        Object.keys(activeLoopStates).forEach(loopId => {
            const state = activeLoopStates[loopId];
            if (state && state.running) {
                stopLoopAction(loopId, 'Emergency Stop');
            }
        });

        // 2. Stop all buff sequences + sequencer actions + loop schedulers + invalidate tokens
        Object.keys(isBuffSequenceRunning).forEach(cIdx => {
            isBuffSequenceRunning[cIdx] = false;
        });
        Object.keys(isSequencerRunning).forEach(cIdx => {
            delete isSequencerRunning[cIdx];
        });
        Object.keys(activeSequencerLoops).forEach(seqId => {
            stopCastSequencerAction(seqId, 'Emergency Stop');
        });
        Object.keys(activeSchedulerStates).forEach(schId => {
            stopLoopSchedulerAction(schId, 'Emergency Stop');
        });
        // Invalidate all tokens so running sequences abort immediately
        activeActions.forEach(act => {
            if (act.mode === 'buff_sequence') {
                buffSequenceTokens[act.id] = (buffSequenceTokens[act.id] || 0) + 1;
            } else if (act.mode === 'sequencer' || act.mode === 'cast_sequence') {
                sequencerTokens[act.id] = (sequencerTokens[act.id] || 0) + 1;
            } else if (act.mode === 'loop_scheduler') {
                schedulerTokens[act.id] = (schedulerTokens[act.id] || 0) + 1;
            }
        });

        // 3. Release all held keys
        Object.keys(activeHoldStates).forEach(actId => {
            activeHoldStates[actId] = false;
        });

        console.log(`🛑 [Emergency Stop] All loops, buff sequences, sequencers, schedulers, and held keys stopped across all clients 100%!`);
    } else if (scope === 'profile') {
        const profileName = action._profileName;
        // Stop all actions belonging to the same profile
        activeActions.forEach(act => {
            const isSameProfile = !profileName || act._profileName === profileName;
            if (!isSameProfile) return;

            if (act.mode === 'loop' && activeLoopStates[act.id]?.running) {
                stopLoopAction(act.id, act.name);
            } else if (act.mode === 'key_hold') {
                releaseHeldKeyForAction(act);
            } else if (act.mode === 'buff_sequence') {
                buffSequenceTokens[act.id] = (buffSequenceTokens[act.id] || 0) + 1;
                const targets = getActionTargets(act.targetClient);
                targets.forEach(t => {
                    isBuffSequenceRunning[String(t)] = false;
                });
            } else if (act.mode === 'sequencer' || act.mode === 'cast_sequence') {
                stopCastSequencerAction(act.id, act.name);
                sequencerTokens[act.id] = (sequencerTokens[act.id] || 0) + 1;
                const targets = getActionTargets(act.targetClient);
                targets.forEach(t => {
                    delete isSequencerRunning[String(t)];
                });
            } else if (act.mode === 'loop_scheduler') {
                stopLoopSchedulerAction(act.id, act.name);
                schedulerTokens[act.id] = (schedulerTokens[act.id] || 0) + 1;
            }
        });
        console.log(`🛑 [Emergency Stop] Stopped all actions in profile "${profileName || 'Current'}"!`);
    } else if (scope === 'client') {
        const targets = getActionTargets(action.targetClient || '1');
        targets.forEach(t => {
            isBuffSequenceRunning[String(t)] = false;
            delete isSequencerRunning[String(t)];
        });
        activeActions.forEach(act => {
            const actTargets = getActionTargets(act.targetClient);
            if (targets.some(t => actTargets.includes(t))) {
                if (act.mode === 'loop' && activeLoopStates[act.id]?.running) {
                    stopLoopAction(act.id, act.name);
                } else if (act.mode === 'key_hold') {
                    releaseHeldKeyForAction(act);
                } else if (act.mode === 'buff_sequence') {
                    buffSequenceTokens[act.id] = (buffSequenceTokens[act.id] || 0) + 1;
                } else if (act.mode === 'sequencer' || act.mode === 'cast_sequence') {
                    stopCastSequencerAction(act.id, act.name);
                    sequencerTokens[act.id] = (sequencerTokens[act.id] || 0) + 1;
                } else if (act.mode === 'loop_scheduler') {
                    stopLoopSchedulerAction(act.id, act.name);
                    schedulerTokens[act.id] = (schedulerTokens[act.id] || 0) + 1;
                }
            }
        });
        console.log(`🛑 [Emergency Stop] Stopped actions on target client(s): ${targets.join(', ')}`);
    }

    sendOverlayUpdate();
    await fireChain(action, 'onFired', callStack);
}

async function runEmitEventAction(action, callStack) {
    if (global.isSuspended) return;
    const eventName = (action.eventName || action.event || '').trim();
    if (!eventName) {
        console.warn(`📡 [Emit Event] "${action.name}" has no Event Name specified — skipped.`);
        await fireChain(action, 'onFired', callStack);
        return;
    }

    const cleanEventName = eventName.toLowerCase();
    console.log(`📡 [Event Bus] Broadcasting custom event: "${eventName}" (from "${action._profileName || 'Active'}" / "${action.name}")`);

    // Find all matching trigger actions in activeActions
    const listeners = activeActions.filter(act => 
        act.enabled && 
        act.trigger && 
        act.trigger.type === 'event' && 
        String(act.trigger.value || '').trim().toLowerCase() === cleanEventName
    );

    console.log(`📡 [Event Bus] Found ${listeners.length} active listener(s) for event "${eventName}"`);

    // Prevent recursive event loop within callStack
    const stackKey = `event:${cleanEventName}`;
    const resolvedStack = callStack || new Set();
    if (resolvedStack.has(stackKey)) {
        console.warn(`📡 [Event Bus] ⚠️ Circular event broadcast loop detected for "${cleanEventName}" — stopping cascade.`);
        await fireChain(action, 'onFired', callStack);
        return;
    }
    resolvedStack.add(stackKey);

    // Fire all active listener actions
    for (const listener of listeners) {
        console.log(`👂 [Event Triggered] Event "${eventName}" ➔ Firing "${listener.name}" (Profile: ${listener._profileName || 'Default'})`);
        handleActionTrigger(listener);
    }

    await fireChain(action, 'onFired', resolvedStack);
}

// Unified trigger entry point
function handleActionTrigger(act) {
    if (global.isSuspended) return;
    emitSignal(act.id, 'trigger');
    if (act.mode === 'loop') {
        const state = activeLoopStates[act.id];
        if (state && state.running) {
            stopLoopAction(act.id, act.name);
        } else {
            startLoopAction(act).catch(err => console.error(`Error in startLoopAction:`, err));
        }
    } else if (act.mode === 'buff_sequence') {
        const target = act.targetClient || '1';
        let targets = getActionTargets(target).map(x => parseInt(x, 10));

        // Only start if not already running on any of the target clients
        let alreadyRunning = false;
        for (let t of targets) {
            if (isBuffSequenceRunning[String(t)]) {
                alreadyRunning = true;
                break;
            }
        }

        if (!alreadyRunning) {
            runBuffSequenceAction(act).catch(err => console.error(`Error in runBuffSequence:`, err));
        }
    } else if (act.mode === 'single_press') {
        runSinglePressAction(act).catch(err => console.error(`Error in runSinglePress:`, err));
    } else if (act.mode === 'delay_only') {
        runDelayOnlyAction(act).catch(err => console.error(`Error in runDelayOnlyAction:`, err));
    } else if (act.mode === 'key_hold') {
        toggleKeyHoldAction(act).catch(err => console.error(`Error in toggleKeyHoldAction:`, err));
    } else if (act.mode === 'control' || act.mode === 'action_control') {
        runActionControl(act).catch(err => console.error(`Error in runActionControl:`, err));
    } else if (act.mode === 'branch' || act.mode === 'action_condition') {
        runActionCondition(act).catch(err => console.error(`Error in runActionCondition:`, err));
    } else if (act.mode === 'sound_alert' || act.mode === 'sound') {
        runSoundAlertAction(act).catch(err => console.error(`Error in runSoundAlertAction:`, err));
    } else if (act.mode === 'emergency_stop' || act.mode === 'stop_all') {
        runEmergencyStopAction(act).catch(err => console.error(`Error in runEmergencyStopAction:`, err));
    } else if (act.mode === 'emit_event' || act.mode === 'send_event') {
        runEmitEventAction(act).catch(err => console.error(`Error in runEmitEventAction:`, err));
    } else if (act.mode === 'sequencer' || act.mode === 'cast_sequence') {
        if (act.modeType === 'once') {
            runCastSequencerOnce(act).catch(err => console.error(`Error in runCastSequencerOnce:`, err));
        } else {
            const state = activeSequencerLoops[act.id];
            if (state && state.running) {
                stopCastSequencerAction(act.id, act.name);
            } else {
                startCastSequencerLoop(act).catch(err => console.error(`Error in startCastSequencerLoop:`, err));
            }
        }
    } else if (act.mode === 'loop_scheduler') {
        const state = activeSchedulerStates[act.id];
        if (state && state.running) {
            stopLoopSchedulerAction(act.id, act.name);
        } else {
            startLoopSchedulerAction(act).catch(err => console.error(`Error in startLoopSchedulerAction:`, err));
        }
    }
}

// ============================================================================
// ACTION CHAIN & DIRECT GRAPH SIGNAL PROPAGATION (Node Workflow Engine)
// ============================================================================

// Fire downstream connected actions for a given source action and event name directly from Graph Engine.
// callStack prevents infinite loops (A→B→A).
async function fireChain(sourceAction, eventName, callStack = new Set()) {
    if (global.isSuspended || !sourceAction) return;

    // 1. Direct Graph Connections Execution (First Priority: Single Source of Truth)
    const downstreamGraphTargets = activeWorkflowEngine && typeof activeWorkflowEngine.getDownstreamNodes === 'function'
        ? activeWorkflowEngine.getDownstreamNodes(sourceAction.id, eventName)
        : [];

    let targetActionsToRun = [];

    if (downstreamGraphTargets.length > 0) {
        downstreamGraphTargets.forEach(({ node }) => {
            const actId = node.data?.actionId || (node.id.startsWith('node_') ? node.id.replace('node_', '') : node.id);
            const targetAction = activeActions.find(a => a.id === actId || a.id === node.id);
            if (targetAction && targetAction.enabled) {
                targetActionsToRun.push(targetAction);
            }
        });
    } else {
        // 2. Legacy Chaining Fallback (Secondary)
        const chains = sourceAction.chaining;
        if (chains && chains._enabled === true && chains[eventName] && chains[eventName].length) {
            const rawTargets = Array.isArray(chains[eventName]) ? chains[eventName] : [chains[eventName]];
            rawTargets.forEach(targetId => {
                const targetAction = activeActions.find(a => a.id === targetId || a.id === `node_${targetId}`);
                if (targetAction && targetAction.enabled) {
                    targetActionsToRun.push(targetAction);
                }
            });
        }
    }

    if (targetActionsToRun.length === 0) return;

    const executeChain = async () => {
        for (const targetAction of targetActionsToRun) {
            if (callStack.has(targetAction.id)) {
                console.warn(`[Graph Chain] Circular chain detected: ${Array.from(callStack).join(' → ')} → ${targetAction.id}. Aborting branch.`);
                continue;
            }
            console.log(`[Graph Chain] "${sourceAction.name}" [${eventName}] ➔ "${targetAction.name}"`);
            emitSignal(sourceAction.id, eventName, targetAction.id);
            await runChainedAction(targetAction, new Set([...callStack, targetAction.id]));
        }
    };

    await executeChain().catch(err => console.error(`[Graph Chain Error] executeChain:`, err));
}

// Run a target action directly (bypasses hotkey requirement).
async function runChainedAction(action, callStack) {
    if (global.isSuspended) return;
    if (action.mode === 'loop') {
        const state = activeLoopStates[action.id];
        if (state && state.running) {
            stopLoopAction(action.id, action.name);
        } else {
            await startLoopAction(action, callStack).catch(err => console.error(`[Chain Error] startLoopAction:`, err));
        }
    } else if (action.mode === 'buff_sequence') {
        const target = action.targetClient || '1';
        let targets = getActionTargets(target).map(x => parseInt(x, 10));
        let alreadyRunning = targets.some(t => isBuffSequenceRunning[String(t)]);
        if (!alreadyRunning) {
            await runBuffSequenceAction(action, callStack).catch(err => console.error(`[Chain Error] runBuffSequenceAction:`, err));
        }
    } else if (action.mode === 'single_press') {
        await runSinglePressAction(action, callStack).catch(err => console.error(`[Chain Error] runSinglePressAction:`, err));
    } else if (action.mode === 'delay_only') {
        await runDelayOnlyAction(action, callStack).catch(err => console.error(`[Chain Error] runDelayOnlyAction:`, err));
    } else if (action.mode === 'key_hold') {
        await toggleKeyHoldAction(action, callStack).catch(err => console.error(`[Chain Error] toggleKeyHoldAction:`, err));
    } else if (action.mode === 'control' || action.mode === 'action_control') {
        await runActionControl(action, callStack).catch(err => console.error(`[Chain Error] runActionControl:`, err));
    } else if (action.mode === 'branch' || action.mode === 'action_condition') {
        await runActionCondition(action, callStack).catch(err => console.error(`[Chain Error] runActionCondition:`, err));
    } else if (action.mode === 'sound_alert' || action.mode === 'sound') {
        await runSoundAlertAction(action, callStack).catch(err => console.error(`[Chain Error] runSoundAlertAction:`, err));
    } else if (action.mode === 'emergency_stop' || action.mode === 'stop_all') {
        await runEmergencyStopAction(action, callStack).catch(err => console.error(`[Chain Error] runEmergencyStopAction:`, err));
    } else if (action.mode === 'emit_event' || action.mode === 'send_event') {
        await runEmitEventAction(action, callStack).catch(err => console.error(`[Chain Error] runEmitEventAction:`, err));
    } else if (action.mode === 'sequencer' || action.mode === 'cast_sequence') {
        if (action.modeType === 'once') {
            await runCastSequencerOnce(action, callStack).catch(err => console.error(`[Chain Error] runCastSequencerOnce:`, err));
        } else {
            const state = activeSequencerLoops[action.id];
            if (state && state.running) {
                stopCastSequencerAction(action.id, action.name);
            } else {
                await startCastSequencerLoop(action, callStack).catch(err => console.error(`[Chain Error] startCastSequencerLoop:`, err));
            }
        }
    } else if (action.mode === 'loop_scheduler') {
        const state = activeSchedulerStates[action.id];
        if (state && state.running) {
            stopLoopSchedulerAction(action.id, action.name);
        } else {
            await startLoopSchedulerAction(action, callStack).catch(err => console.error(`[Chain Error] startLoopSchedulerAction:`, err));
        }
    }
}

async function runActionControl(act, callStack) {
    const targetIds = act.controlTargetIds || (act.controlTargetId ? [act.controlTargetId] : []);
    const op = act.controlOperation || 'toggle';
    if (!targetIds.length) return;

    // Prevent circular execution stacks within the control command chain
    const stackKey = `${act.id}:control`;
    const resolvedStack = callStack || new Set();
    if (resolvedStack.has(stackKey)) {
        console.warn(`[Action Control] ⚠️ Circular control loop detected: "${act.name}" control stack — skipping.`);
        return;
    }
    resolvedStack.add(stackKey);

    for (const targetId of targetIds) {
        const targetAction = activeActions.find(a => a.id === targetId || a.id === `node_${targetId}` || (a.nodeId && a.nodeId === targetId));
        if (!targetAction || !targetAction.enabled) {
            console.log(`[Action Control] Target action "${targetId}" is missing or disabled — skipping.`);
            continue;
        }

        console.log(`[Action Control] Sourced from "${act.name}": Controlling "${targetAction.name}" (Operation: ${op})`);

        if (targetAction.mode === 'loop') {
            const state = activeLoopStates[targetAction.id];
            const isRunning = state && state.running;
            if (op === 'start') {
                if (!isRunning) {
                    emitSignal(act.id, 'control_start', targetAction.id);
                    await startLoopAction(targetAction, resolvedStack).catch(e => console.error(e));
                }
            } else if (op === 'stop') {
                if (isRunning) {
                    emitSignal(act.id, 'control_stop', targetAction.id);
                    stopLoopAction(targetAction.id, targetAction.name);
                }
            } else { // toggle
                if (isRunning) {
                    emitSignal(act.id, 'control_stop', targetAction.id);
                    stopLoopAction(targetAction.id, targetAction.name);
                } else {
                    emitSignal(act.id, 'control_start', targetAction.id);
                    await startLoopAction(targetAction, resolvedStack).catch(e => console.error(e));
                }
            }
        } else if (targetAction.mode === 'key_hold') {
            const isCurrentlyHeld = !!activeHoldStates[targetAction.id];
            if (op === 'start') {
                if (!isCurrentlyHeld) {
                    emitSignal(act.id, 'control_start', targetAction.id);
                    await toggleKeyHoldAction(targetAction, resolvedStack).catch(e => console.error(e));
                }
            } else if (op === 'stop') {
                if (isCurrentlyHeld) {
                    emitSignal(act.id, 'control_stop', targetAction.id);
                    await toggleKeyHoldAction(targetAction, resolvedStack).catch(e => console.error(e));
                }
            } else { // toggle
                emitSignal(act.id, isCurrentlyHeld ? 'control_stop' : 'control_start', targetAction.id);
                await toggleKeyHoldAction(targetAction, resolvedStack).catch(e => console.error(e));
            }
        } else if (targetAction.mode === 'buff_sequence') {
            const target = targetAction.targetClient || '1';
            let targets = getActionTargets(target).map(x => parseInt(x, 10));
            let alreadyRunning = targets.some(t => isBuffSequenceRunning[String(t)]);
            if (op === 'start') {
                if (!alreadyRunning) {
                    emitSignal(act.id, 'control_start', targetAction.id);
                    await runBuffSequenceAction(targetAction, resolvedStack).catch(err => console.error(err));
                }
            } else if (op === 'stop') {
                if (alreadyRunning) {
                    emitSignal(act.id, 'control_stop', targetAction.id);
                    buffSequenceTokens[targetAction.id] = (buffSequenceTokens[targetAction.id] || 0) + 1;
                    for (let t of targets) {
                        isBuffSequenceRunning[String(t)] = false;
                    }
                    console.log(`🔴 [Action Control] Stopped Buff Sequence: "${targetAction.name}"`);
                    sendOverlayUpdate();
                }
            } else { // toggle
                if (alreadyRunning) {
                    emitSignal(act.id, 'control_stop', targetAction.id);
                    buffSequenceTokens[targetAction.id] = (buffSequenceTokens[targetAction.id] || 0) + 1;
                    for (let t of targets) {
                        isBuffSequenceRunning[String(t)] = false;
                    }
                    console.log(`🔴 [Action Control] Toggled (Stopped) Buff Sequence: "${targetAction.name}"`);
                    sendOverlayUpdate();
                } else {
                    emitSignal(act.id, 'control_start', targetAction.id);
                    await runBuffSequenceAction(targetAction, resolvedStack).catch(err => console.error(err));
                }
            }
        } else if (targetAction.mode === 'sequencer' || targetAction.mode === 'cast_sequence') {
            const isOnce = targetAction.modeType === 'once';
            const target = targetAction.targetClient || '1';
            let targets = getActionTargets(target).map(x => parseInt(x, 10));
            const isRunning = isOnce 
                ? targets.some(t => isSequencerRunning[String(t)])
                : !!(activeSequencerLoops[targetAction.id] && activeSequencerLoops[targetAction.id].running);

            if (op === 'start') {
                if (!isRunning) {
                    emitSignal(act.id, 'control_start', targetAction.id);
                    if (isOnce) {
                        runCastSequencerOnce(targetAction, resolvedStack).catch(err => console.error(err));
                    } else {
                        await startCastSequencerLoop(targetAction, resolvedStack).catch(err => console.error(err));
                    }
                }
            } else if (op === 'stop') {
                if (isRunning) {
                    emitSignal(act.id, 'control_stop', targetAction.id);
                    stopCastSequencerAction(targetAction.id, targetAction.name);
                    for (let t of targets) {
                        delete isSequencerRunning[String(t)];
                    }
                    console.log(`🔴 [Action Control] Stopped Sequencer: "${targetAction.name}"`);
                    sendOverlayUpdate();
                }
            } else { // toggle
                if (isRunning) {
                    emitSignal(act.id, 'control_stop', targetAction.id);
                    stopCastSequencerAction(targetAction.id, targetAction.name);
                    for (let t of targets) {
                        delete isSequencerRunning[String(t)];
                    }
                    console.log(`🔴 [Action Control] Toggled (Stopped) Sequencer: "${targetAction.name}"`);
                    sendOverlayUpdate();
                } else {
                    emitSignal(act.id, 'control_start', targetAction.id);
                    if (isOnce) {
                        runCastSequencerOnce(targetAction, resolvedStack).catch(err => console.error(err));
                    } else {
                        await startCastSequencerLoop(targetAction, resolvedStack).catch(err => console.error(err));
                    }
                }
            }
        } else if (targetAction.mode === 'loop_scheduler') {
            const isRunning = !!(activeSchedulerStates[targetAction.id] && activeSchedulerStates[targetAction.id].running);
            if (op === 'start') {
                if (!isRunning) {
                    emitSignal(act.id, 'control_start', targetAction.id);
                    await startLoopSchedulerAction(targetAction, resolvedStack).catch(err => console.error(err));
                }
            } else if (op === 'stop') {
                if (isRunning) {
                    emitSignal(act.id, 'control_stop', targetAction.id);
                    stopLoopSchedulerAction(targetAction.id, targetAction.name);
                    console.log(`🔴 [Action Control] Stopped Scheduler: "${targetAction.name}"`);
                    sendOverlayUpdate();
                }
            } else { // toggle
                if (isRunning) {
                    emitSignal(act.id, 'control_stop', targetAction.id);
                    stopLoopSchedulerAction(targetAction.id, targetAction.name);
                    console.log(`🔴 [Action Control] Toggled (Stopped) Scheduler: "${targetAction.name}"`);
                    sendOverlayUpdate();
                } else {
                    emitSignal(act.id, 'control_start', targetAction.id);
                    await startLoopSchedulerAction(targetAction, resolvedStack).catch(err => console.error(err));
                }
            }
        } else if (targetAction.mode === 'single_press') {
            if (op === 'start' || op === 'toggle') {
                await runSinglePressAction(targetAction, resolvedStack).catch(err => console.error(err));
            }
        } else if (targetAction.mode === 'control' || targetAction.mode === 'action_control') {
            await runActionControl(targetAction, resolvedStack).catch(err => console.error(err));
        } else if (targetAction.mode === 'branch' || targetAction.mode === 'action_condition') {
            await runActionCondition(targetAction, resolvedStack).catch(err => console.error(err));
        }
    }

    emitSignal(act.id, 'onComplete');
    await fireChain(act, 'onComplete', resolvedStack);
}

function isActionRunning(actionId) {
    const act = activeActions.find(a => a.id === actionId || a.id === `node_${actionId}` || (a.nodeId && a.nodeId === actionId));
    if (!act) return false;

    if (act.mode === 'loop') {
        return !!(activeLoopStates[act.id] && activeLoopStates[act.id].running);
    } else if (act.mode === 'key_hold') {
        return !!activeHoldStates[act.id];
    } else if (act.mode === 'buff_sequence') {
        const target = act.targetClient || '1';
        let targets = getActionTargets(target).map(x => parseInt(x, 10));
        return targets.some(t => isBuffSequenceRunning[String(t)]);
    } else if (act.mode === 'sequencer' || act.mode === 'cast_sequence') {
        if (act.modeType === 'once') {
            const target = act.targetClient || '1';
            let targets = getActionTargets(target).map(x => parseInt(x, 10));
            return targets.some(t => isSequencerRunning[String(t)]);
        } else {
            return !!(activeSequencerLoops[act.id] && activeSequencerLoops[act.id].running);
        }
    } else if (act.mode === 'loop_scheduler') {
        return !!(activeSchedulerStates[act.id] && activeSchedulerStates[act.id].running);
    }
    return false;
}

async function runActionCondition(act, callStack) {
    const targetId = act.conditionTargetId;
    const rule = act.conditionRule || 'is_running';
    if (!targetId) {
        console.warn(`[Condition Check] "${act.name}" has no target action selected — skipping.`);
        return;
    }

    const stackKey = `${act.id}:condition`;
    const resolvedStack = callStack || new Set();
    if (resolvedStack.has(stackKey)) {
        console.warn(`[Condition Check] ⚠️ Circular condition stack detected: "${act.name}" — skipping.`);
        return;
    }
    resolvedStack.add(stackKey);

    const isRunning = isActionRunning(targetId);
    const isTrue = (rule === 'is_running') ? isRunning : !isRunning;

    const targetAct = activeActions.find(a => a.id === targetId);
    const targetName = targetAct ? targetAct.name : targetId;

    console.log(`[Condition Check] "${act.name}": Checking target "${targetName}" (${rule}) ➔ Result: ${isTrue ? 'TRUE' : 'FALSE'}`);

    if (isTrue) {
        emitSignal(act.id, 'onTrue');
        await fireChain(act, 'onTrue', resolvedStack);
    } else {
        emitSignal(act.id, 'onFalse');
        await fireChain(act, 'onFalse', resolvedStack);
    }
}

// ============================================================================
// GLOBAL HOTKEYS LISTENER (Native OS level hooks)
// ============================================================================

function startGlobalListeners() {
    console.log("\n[System] Initializing global keyboard and mouse listeners...");
    const { GlobalKeyboardListener } = require('node-global-key-listener');

    try {
        mouseEvents = require('global-mouse-events');
        if (mouseEvents && typeof mouseEvents.on === 'function') {
            mouseEvents.on('mousedown', (event) => {
                if (global.isSuspended) return;

                // Find matching actions
                const matchingActions = activeActions.filter(act =>
                    act.enabled &&
                    act.trigger.type === 'mouse' &&
                    act.trigger.value == event.button
                );

                for (let act of matchingActions) {
                    console.log(`[Global Mouse Captured] Triggered action: "${act.name}" via Mouse Button ${event.button}`);
                    handleActionTrigger(act);
                }
            });
        }
    } catch (err) {
        console.warn("[System] ⚠️ Note: 'global-mouse-events' module is disabled or not built (Mouse triggers offline). Keyboard triggers active 100%.");
    }

    keyboard = new GlobalKeyboardListener();

    // 2. Keyboard Events Hook
    keyboard.addListener(function (e, down) {
        const isDown = e.state === "DOWN";
        const isUp = e.state === "UP";
        if (!isDown && !isUp) return;

        // Handle global suspend hotkey toggle
        if (isDown && suspendHotkey && e.name && matchKeyTrigger(suspendHotkey, e.name, down, false)) {
            global.toggleSuspendState();
            return;
        }

        if (global.isSuspended) return;

        // 1. Handle normal actions (loop, buff_sequence, single_press, sound_alert, emergency_stop, etc.) strictly on DOWN state
        if (isDown) {
            const matchingActions = activeActions.filter(act =>
                act.enabled &&
                act.mode !== 'forward' &&
                act.trigger.type === 'keyboard' &&
                act.trigger.type !== 'none' &&
                act.trigger.value &&
                matchKeyTrigger(act.trigger.value, e.name, down, false)
            );

            if (matchingActions.length > 0) {
                console.log(`[Global Key Captured] Triggered action(s) via physical key "${e.name}"`);
            }

            for (let act of matchingActions) {
                handleActionTrigger(act);
            }
        }

        // 2. Handle forward actions (down and up states for holding keys)
        const forwardActions = activeActions.filter(act =>
            act.enabled &&
            act.mode === 'forward' &&
            act.trigger.type === 'keyboard' &&
            act.trigger.value &&
            matchKeyTrigger(act.trigger.value, e.name, down, isUp)
        );

        for (let act of forwardActions) {
            const targetKey = act.targetKey || '5';
            const target = act.targetClient || '1';
            let targets = getActionTargets(target).map(x => parseInt(x, 10));

            for (let clientIndex of targets) {
                const page = clientPages[clientIndex];
                if (!page) continue;

                const trackingKey = `${act.id}-${clientIndex}`;
                if (isDown) {
                    if (!pressedRemapKeys[trackingKey] && !forwardHoldTimers[trackingKey]) {
                        if (act.delayActivation) {
                            const delay = act.activationDelayMs !== undefined ? parseInt(act.activationDelayMs, 10) : 1000;
                            forwardHoldTimers[trackingKey] = setTimeout(() => {
                                pressedRemapKeys[trackingKey] = true;
                                delete forwardHoldTimers[trackingKey];
                                console.log(`[Forward] [Client ${clientIndex}] Key Down (Delayed): "${targetKey}" (via Physical Key "${e.name}")`);
                                pressKeyHoldDown(page, targetKey).catch(err => {
                                    console.error(`[Forward Error] [Client ${clientIndex}] Failed pressKeyHoldDown("${targetKey}"):`, err.message);
                                });
                                // Fire onActivated chain once (only on the first client to avoid duplicate)
                                if (clientIndex === targets[0]) fireChain(act, 'onActivated');
                                sendOverlayUpdate();
                            }, delay);
                            // Fire onKeyDown immediately
                            if (clientIndex === targets[0]) fireChain(act, 'onKeyDown');
                        } else {
                            pressedRemapKeys[trackingKey] = true;
                            console.log(`[Forward] [Client ${clientIndex}] Key Down: "${targetKey}" (via Physical Key "${e.name}")`);
                            pressKeyHoldDown(page, targetKey).catch(err => {
                                console.error(`[Forward Error] [Client ${clientIndex}] Failed pressKeyHoldDown("${targetKey}"):`, err.message);
                            });
                            // Fire onKeyDown AND onActivated together (no delay)
                            if (clientIndex === targets[0]) {
                                fireChain(act, 'onKeyDown');
                                fireChain(act, 'onActivated');
                            }
                            sendOverlayUpdate();
                        }
                    }
                } else if (isUp) {
                    if (forwardHoldTimers[trackingKey]) {
                        clearTimeout(forwardHoldTimers[trackingKey]);
                        delete forwardHoldTimers[trackingKey];
                    }
                    if (pressedRemapKeys[trackingKey]) {
                        delete pressedRemapKeys[trackingKey];
                        console.log(`[Forward] [Client ${clientIndex}] Key Up: "${targetKey}" (via Physical Key "${e.name}")`);
                        pressKeyHoldUp(page, targetKey).catch(err => {
                            console.error(`[Forward Error] [Client ${clientIndex}] Failed pressKeyHoldUp("${targetKey}"):`, err.message);
                        });
                        if (clientIndex === targets[0]) fireChain(act, 'onKeyUp');
                        // For delayed-activation actions: give overlay 120ms to render ⚡ before going back to Standby.
                        if (act.delayActivation) {
                            setTimeout(() => sendOverlayUpdate(), 120);
                        } else {
                            sendOverlayUpdate();
                        }
                    }
                }
            }
        }

        // 3. Global Anti-Stuck Key Watchdog:
        // When any physical key is released anywhere in Windows, ensure all game tabs release it immediately
        if (isUp && e.name) {
            const rawKey = e.name.trim();
            const pwKey = formatKeyForPlaywright(rawKey);
            for (let clientIndex of activeClients) {
                const page = clientPages[clientIndex];
                if (!page) continue;

                // Check if this key is intentionally held down by a "Key Hold" node action
                const isHeldByAction = Object.keys(activeHoldStates).some(actId => {
                    const holdAct = activeActions.find(a => a.id === actId);
                    return holdAct && holdAct.targetKey && holdAct.targetKey.toUpperCase() === rawKey.toUpperCase();
                });

                if (!isHeldByAction) {
                    page.keyboard.up(pwKey).catch(() => {});
                }
            }
        }
    });

    console.log("[System] Global keyboard and mouse listeners initialized successfully!");
}

// Clean shutdown handlers
process.on('SIGINT', async () => {
    console.log('\n[System] Shutting down NodeHotkey server cleanly...');
    if (nativeAudioWorker) {
        try { nativeAudioWorker.kill(); } catch (e) { }
    }
    for (let idx in clientContexts) {
        try {
            if (clientContexts[idx]) await clientContexts[idx].close();
        } catch (e) { }
    }
    clearAllProfileLockFiles();
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (nativeAudioWorker) {
        try { nativeAudioWorker.kill(); } catch (e) { }
    }
    clearAllProfileLockFiles();
    process.exit(0);
});

// Start system initialization
initSystem();
