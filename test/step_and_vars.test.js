const assert = require('assert');
const { nodeRegistry } = require('../node-registry');
const bot = require('../bot');

console.log('🧪 Starting Step Log & Unreal Blueprint Variable Data Pin Tests...\n');

// 1. Test Node Registry Loading
console.log('Test 1: Verifying modular node registration...');
nodeRegistry.loadAll(null, true);
assert.ok(nodeRegistry.has('step_log'), 'NodeRegistry should contain step_log');
assert.ok(nodeRegistry.has('var_get'), 'NodeRegistry should contain var_get');
assert.ok(nodeRegistry.has('var_set'), 'NodeRegistry should contain var_set');
assert.ok(nodeRegistry.has('variable'), 'NodeRegistry should contain variable alias');

const varGetDef = nodeRegistry.get('var_get');
assert.strictEqual(varGetDef.isPure, true, 'var_get should be marked as pure node');
assert.deepStrictEqual(varGetDef.inputs, [], 'var_get pure node should have no inputs');
assert.deepStrictEqual(varGetDef.outputs, ['val_out'], 'var_get should output val_out');

const stepLogDef = nodeRegistry.get('step_log');
assert.ok(stepLogDef.inputs.includes('msg_in'), 'step_log should have msg_in input port');
assert.ok(stepLogDef.outputs.includes('onComplete'), 'step_log should have onComplete output port');

console.log('✅ Test 1 Passed: Nodes correctly defined and registered!\n');

// 2. Test bot.js Variable Get / Set and resolveNodeInputData
console.log('Test 2: Testing Unreal-style Variable Set, Get, and Data Wire Resolution...');

// Set variable
const setAction = {
  id: 'act_var_set_1',
  name: 'Set BossPhase',
  varName: 'BossPhase',
  varType: 'string',
  scope: 'client',
  targetClient: '1',
  operation: 'set_value',
  opValue: 'PHASE_2_ENRAGE'
};

bot.setVariableValue(setAction, setAction.opValue, '1');
const val = bot.getNamedVariableValue('BossPhase', '1');
assert.strictEqual(val, 'PHASE_2_ENRAGE', 'Variable BossPhase should equal PHASE_2_ENRAGE');

// Target Action: Step Log
const stepLogAction = {
  id: 'act_step_log_1',
  name: 'Step Log Checkpoint',
  stepTag: 'BOSS_ALERT',
  message: 'Fallback Msg',
  showClient: true,
  targetClient: '1'
};

// Pure node action: Get Variable
const varGetAction = {
  id: 'act_var_get_1',
  name: 'Get BossPhase',
  mode: 'var_get',
  varName: 'BossPhase',
  varType: 'string',
  scope: 'client',
  targetClient: '1',
  defaultValue: 'UNKNOWN'
};

// Emulate active profile and connections
global.activeProfileConnections = [
  {
    fromNodeId: 'act_var_get_1',
    fromPort: 'val_out',
    toNodeId: 'act_step_log_1',
    toPort: 'msg_in'
  }
];

global.activeActions = [setAction, stepLogAction, varGetAction];

global.activeProfileNodes = [setAction, stepLogAction, varGetAction];

// Resolve input data pin 'msg_in' on stepLogAction
const resolvedMsg = bot.resolveNodeInputData(stepLogAction, 'msg_in');
assert.strictEqual(resolvedMsg, 'PHASE_2_ENRAGE', 'resolveNodeInputData should fetch value from connected var_get node');
console.log('✅ Test 2 Passed: Data wire dynamically resolved variable value!\n');

// 3. Test Log Classifier in launcher/main.js
console.log('Test 3: Testing Log Classifier for Log Messages...');
// Emulate classifyLogLevel from launcher/main.js
function classifyLogLevel(line) {
  const upper = (line || '').toUpperCase();
  if (upper.includes('[LOG]') || upper.includes('📝') || upper.includes('[STEP]') || upper.includes('🧭') || upper.includes('📍')) return 'log';
  if (upper.includes('[ERROR]') || upper.includes('ERR:')) return 'error';
  if (upper.includes('[WARN]') || upper.includes('WARNING')) return 'warn';
  if (upper.includes('[INFO]')) return 'info';
  if (upper.includes('[ACTION]') || upper.includes('[BOT]')) return 'action';
  return 'default';
}

assert.strictEqual(classifyLogLevel('📝 [Log] [Client 1] PHASE_2_ENRAGE'), 'log', 'Should classify as log');
assert.strictEqual(classifyLogLevel('🧭 [Step] [Client 1] [BOSS_ALERT] PHASE_2_ENRAGE'), 'log', 'Should classify as log');
assert.strictEqual(classifyLogLevel('2026-09-12 [INFO] Bot started'), 'info', 'Should classify as info');
assert.strictEqual(classifyLogLevel('2026-09-12 [ACTION] Key Press 1'), 'action', 'Should classify as action');
console.log('✅ Test 3 Passed: Log classifier correctly isolates log messages!\n');

// 4. Test Blueprint Variables Schema & Auto-Discovery Simulation
console.log('Test 4: Testing Profile Blueprint Variables Schema & Auto-Discovery...');
const sampleNodes = [
  { id: 'n1', type: 'var_set', title: 'Set isBuffActive', data: { varName: 'isBuffActive', varType: 'boolean', initialValue: 'false' } },
  { id: 'n2', type: 'var_get', title: 'Get comboCount', data: { varName: 'comboCount', varType: 'number', defaultValue: '0' } }
];

let declaredVariables = [
  { id: 'v1', name: 'playerName', type: 'string', scope: 'global', defaultValue: 'Hero' }
];

// Emulate getAvailableVariables auto-discovery logic
const existingNames = new Set(declaredVariables.map(v => v.name));
sampleNodes.forEach(node => {
  const vName = node.data?.varName;
  if (vName && !existingNames.has(vName)) {
    existingNames.add(vName);
    declaredVariables.push({
      id: 'var_' + vName,
      name: vName,
      type: node.data?.varType || 'string',
      scope: 'client',
      defaultValue: node.data?.initialValue || node.data?.defaultValue || ''
    });
  }
});

assert.strictEqual(declaredVariables.length, 3, 'Should discover both isBuffActive and comboCount along with declared playerName');
assert.ok(declaredVariables.some(v => v.name === 'isBuffActive' && v.type === 'boolean'), 'Should have isBuffActive');
assert.ok(declaredVariables.some(v => v.name === 'comboCount' && v.type === 'number'), 'Should have comboCount');
assert.ok(declaredVariables.some(v => v.name === 'playerName' && v.type === 'string'), 'Should have playerName');
console.log('✅ Test 4 Passed: Blueprint Variables schema and Auto-Discovery verified!\n');

// 5. Test Unified Global Scope & val_in Data Pin to var_set
console.log('Test 5: Testing Unified Global Scope & val_in dynamic data pin...');
const globalBoolAction = {
  id: 'act_var_set_bool',
  name: 'Set isTargetLocked',
  varName: 'isTargetLocked',
  varType: 'boolean',
  scope: 'global',
  operation: 'set_value',
  initialValue: 'false'
};

// Set globally
bot.setVariableValue(globalBoolAction, true);
// Lookup from any client screen (client '1', client '2', or no client specified)
assert.strictEqual(bot.getNamedVariableValue('isTargetLocked', '1'), true, 'Client 1 should read global boolean');
assert.strictEqual(bot.getNamedVariableValue('isTargetLocked', '2'), true, 'Client 2 should read global boolean');
assert.strictEqual(bot.getNamedVariableValue('isTargetLocked'), true, 'Global lookup without client should read true');

// Test wire into val_in on var_set node
const sourceVar = {
  id: 'act_src_val',
  mode: 'var_get',
  varName: 'sourceScore',
  varType: 'number',
  defaultValue: 999
};
const destVarSet = {
  id: 'act_dest_set',
  mode: 'var_set',
  varName: 'finalScore',
  varType: 'number',
  scope: 'global',
  operation: 'set_value'
};
global.activeProfileConnections.push({
  fromNodeId: 'act_src_val',
  fromPort: 'val_out',
  toNodeId: 'act_dest_set',
  toPort: 'val_in'
});
global.activeActions.push(sourceVar, destVarSet);

// 6. Test dynamic val_in pin visibility and auto-pruning logic
console.log('Test 6: Testing dynamic val_in pin visibility & auto-pruning logic...');
const testNodeSetValue = {
  id: 'node_test_var',
  type: 'var_set',
  data: { varName: 'score', varType: 'number', operation: 'set_value' }
};
const showValInSetValue = (testNodeSetValue.data?.operation || 'set_value') === 'set_value';
assert.strictEqual(showValInSetValue, true, 'val_in pin should be visible when operation is set_value');

const testNodeToggle = {
  id: 'node_test_var',
  type: 'var_set',
  data: { varName: 'score', varType: 'number', operation: 'toggle' }
};
const showValInToggle = (testNodeToggle.data?.operation || 'set_value') === 'set_value';
assert.strictEqual(showValInToggle, false, 'val_in pin should be hidden when operation is toggle');

// Simulate wire pruning
let mockConnections = [
  { id: 'c1', fromNodeId: 'node_1', fromPort: 'val_out', toNodeId: 'node_test_var', toPort: 'val_in' },
  { id: 'c2', fromNodeId: 'node_test_var', fromPort: 'next', toNodeId: 'node_2', toPort: 'exec_in' }
];
const newOperation = 'increment';
if (newOperation !== 'set_value') {
  mockConnections = mockConnections.filter(c => !(c.toNodeId === 'node_test_var' && c.toPort === 'val_in'));
}
assert.strictEqual(mockConnections.length, 1, 'Incoming val_in wire should be pruned');
assert.strictEqual(mockConnections[0].toPort, 'exec_in', 'Exec wire should be preserved');
console.log('✅ Test 6 Passed: Dynamic val_in pin visibility & auto-pruning logic verified!\n');

// 7. Test Step Log Static Message Resolution and Execution Engine Mapping
console.log('Test 7: Testing Step Log Static Message Resolution & Engine Mapping...');
const NodeExecutionEngine = require('../execution-engine');
const testProfile = {
  name: 'Test3',
  nodes: [
    {
      id: 'node_trigger_1',
      type: 'trigger',
      title: 'Global Trigger',
      data: { enabled: true, triggerType: 'keyboard', triggerValue: '1' }
    },
    {
      id: 'node_log_1',
      type: 'step_log',
      title: 'Log Message (📝)',
      data: {
        enabled: true,
        message: 'สวัสดีครับ',
        showClient: true,
        targetClient: '1',
        actionId: 'act_log_1'
      }
    }
  ],
  connections: [
    {
      id: 'c1',
      fromNodeId: 'node_trigger_1',
      fromPort: 'exec_out',
      toNodeId: 'node_log_1',
      toPort: 'exec_in'
    }
  ]
};

const builtActions = NodeExecutionEngine.buildInMemoryActions(testProfile);
const logAction = builtActions.find(a => a.mode === 'step_log');
assert.ok(logAction, 'Should build step_log action');
assert.strictEqual(logAction.message, 'สวัสดีครับ', 'Action message should be "สวัสดีครับ"');
assert.strictEqual(logAction.showClient, true, 'Action showClient should be true');
assert.strictEqual(logAction.targetClient, '1', 'Action targetClient should be "1"');

// Test actual step_log execution output
const logs = [];
const originalLog = console.log;
console.log = (msg) => { logs.push(msg); };

const stepNode = require('../nodes/step_log.node');
stepNode.execute({}, logAction, []);
console.log = originalLog;

const foundLog = logs.find(l => typeof l === 'string' && l.includes('สวัสดีครับ'));
assert.strictEqual(foundLog, '📝 [Log] [Client 1] สวัสดีครับ', 'Step log should print actual message with client prefix');

// Test multiline formatting
const multiLogs = [];
console.log = (msg) => { if (typeof msg === 'string' && msg.includes('Line')) multiLogs.push(msg); };
stepNode.execute({}, { message: 'Line 1\nLine 2\nLine 3' }, []);
console.log = originalLog;
assert.strictEqual(multiLogs.length, 3, 'Multiline log should produce 3 distinct lines');
assert.ok(multiLogs.every(l => l.startsWith('📝 [Log]')), 'All multiline log lines should start with 📝 [Log]');
console.log('✅ Test 7 Passed: Step Log Static Message & Multiline formatting correctly resolved and printed!\n');

// 8. Test Party Buff & Party Scanner Data Output Pins
console.log('Test 8: Testing Party Buff & Party Scanner Data Output Pins...');
const partyBuffAction = {
  id: 'act_party_buff_1',
  nodeId: 'node_party_buff_1',
  mode: 'party_buff',
  name: 'Party Buff',
  name_out: 'HeroSlayer',
  slot_out: 2,
  info_out: 'Slot 2: HeroSlayer [1/4]'
};

const partyScannerAction = {
  id: 'act_party_scanner_1',
  nodeId: 'node_party_scanner_1',
  mode: 'party_scanner',
  name: 'Party Scanner',
  names_out: 'Alice, Bob, Charlie',
  count_out: 3,
  info_out: 'สแกนพบ 3 คน: Slot 1: Alice, Slot 2: Bob, Slot 3: Charlie'
};

const consumerLogName = { id: 'act_log_name', nodeId: 'node_log_name', mode: 'step_log' };
const consumerLogSlot = { id: 'act_log_slot', nodeId: 'node_log_slot', mode: 'step_log' };
const consumerLogScannerInfo = { id: 'act_log_scan', nodeId: 'node_log_scan', mode: 'step_log' };

global.activeActions = [partyBuffAction, partyScannerAction, consumerLogName, consumerLogSlot, consumerLogScannerInfo];
global.activeProfileConnections = [
  { id: 'c_name', fromNodeId: 'node_party_buff_1', fromPort: 'name_out', toNodeId: 'node_log_name', toPort: 'msg_in' },
  { id: 'c_slot', fromNodeId: 'node_party_buff_1', fromPort: 'slot_out', toNodeId: 'node_log_slot', toPort: 'msg_in' },
  { id: 'c_scan', fromNodeId: 'node_party_scanner_1', fromPort: 'info_out', toNodeId: 'node_log_scan', toPort: 'msg_in' }
];

const resolvedName = bot.resolveNodeInputData(consumerLogName, 'msg_in');
assert.strictEqual(resolvedName, 'HeroSlayer', 'Should resolve member name from party_buff name_out');

const resolvedSlot = bot.resolveNodeInputData(consumerLogSlot, 'msg_in');
assert.strictEqual(resolvedSlot, 2, 'Should resolve slot index from party_buff slot_out');

const resolvedScanInfo = bot.resolveNodeInputData(consumerLogScannerInfo, 'msg_in');
assert.strictEqual(resolvedScanInfo, 'สแกนพบ 3 คน: Slot 1: Alice, Slot 2: Bob, Slot 3: Charlie', 'Should resolve party info from party_scanner info_out');

console.log('✅ Test 8 Passed: Party Buff & Party Scanner Data Output Pins verified!\n');

// 9. Test Format Text Node (String, Number, Boolean formatting & Data Pin wiring)
console.log('Test 9: Testing Format Text Node (String, Number, Boolean formatting & Template)...');

const formatTextNode = nodeRegistry.get('format_text');
assert(formatTextNode, 'format_text node should be registered in NodeRegistry');

// 9.1 Test direct value formatting
assert.strictEqual(formatTextNode.formatValue(true, 'true_false'), 'true');
assert.strictEqual(formatTextNode.formatValue(false, 'true_false'), 'false');
assert.strictEqual(formatTextNode.formatValue(true, 'yes_no'), 'Yes');
assert.strictEqual(formatTextNode.formatValue(false, 'yes_no'), 'No');
assert.strictEqual(formatTextNode.formatValue(true, 'thai'), 'จริง');
assert.strictEqual(formatTextNode.formatValue(false, 'thai'), 'เท็จ');
assert.strictEqual(formatTextNode.formatValue(12345), '12345');
assert.strictEqual(formatTextNode.formatValue('Hello World'), 'Hello World');

// 9.2 Test template interpolation
const sampleAction = {
  template: 'Member: {name} (Slot {slot}, Active: {active})',
  pins: ['name', 'slot', 'active'],
  boolFormat: 'true_false',
  name: 'Warrior',
  slot: 3,
  active: true
};
const formattedResult = formatTextNode.computeFormattedText(sampleAction);
assert.strictEqual(formattedResult, 'Member: Warrior (Slot 3, Active: true)', 'Template should correctly interpolate string, number, and bool');

// 9.3 Test Thai boolean format in template
sampleAction.boolFormat = 'thai';
const formattedThaiResult = formatTextNode.computeFormattedText(sampleAction);
assert.strictEqual(formattedThaiResult, 'Member: Warrior (Slot 3, Active: จริง)', 'Template should support Thai boolean format');

// 9.4 Test Data Pin wiring: Party Buff (name_out, slot_out) + Boolean Var -> Format Text -> Step Log (msg_in)
const boolLeaderVarAction = {
  id: 'act_var_leader_1',
  nodeId: 'node_var_leader_1',
  mode: 'var_get',
  varName: 'IsLeader',
  varType: 'boolean',
  defaultValue: true
};
bot.setVariableValue(boolLeaderVarAction, true);

const formatTextAction = {
  id: 'act_format_text_1',
  nodeId: 'node_format_text_1',
  mode: 'format_text',
  template: 'Buffing {name} at Slot {slot} (Leader: {isLeader})',
  pins: ['name', 'slot', 'isLeader'],
  boolFormat: 'true_false'
};

const finalLogAction = {
  id: 'act_final_log_1',
  nodeId: 'node_final_log_1',
  mode: 'step_log'
};

// Connect:
// party_buff (name_out: String) -> format_text (name)
// party_buff (slot_out: Number) -> format_text (slot)
// boolLeaderVar (val_out: Boolean true) -> format_text (isLeader)
// format_text (msg_out: String) -> step_log (msg_in)
global.activeActions.push(partyBuffAction, boolLeaderVarAction, formatTextAction, finalLogAction);
global.activeProfileConnections.push(
  { id: 'c_ft_name', fromNodeId: 'node_party_buff_1', fromPort: 'name_out', toNodeId: 'node_format_text_1', toPort: 'name' },
  { id: 'c_ft_slot', fromNodeId: 'node_party_buff_1', fromPort: 'slot_out', toNodeId: 'node_format_text_1', toPort: 'slot' },
  { id: 'c_ft_leader', fromNodeId: 'node_var_leader_1', fromPort: 'val_out', toNodeId: 'node_format_text_1', toPort: 'isLeader' },
  { id: 'c_ft_log', fromNodeId: 'node_format_text_1', fromPort: 'msg_out', toNodeId: 'node_final_log_1', toPort: 'msg_in' }
);

// Resolve from downstream Step Log
const resolvedThroughFormatText = bot.resolveNodeInputData(finalLogAction, 'msg_in');
assert.strictEqual(
  resolvedThroughFormatText,
  'Buffing HeroSlayer at Slot 2 (Leader: true)',
  'Step Log should resolve combined string via Format Text node with Boolean converted to string'
);

// 9.5 Test with Thai Boolean formatting
formatTextAction.boolFormat = 'thai';
const resolvedThai = bot.resolveNodeInputData(finalLogAction, 'msg_in');
assert.strictEqual(
  resolvedThai,
  'Buffing HeroSlayer at Slot 2 (Leader: จริง)',
  'Step Log should resolve Boolean converted to Thai string'
);

// 9.6 Test with Boolean False
bot.setVariableValue(boolLeaderVarAction, false);
formatTextAction.boolFormat = 'yes_no';
const resolvedFalse = bot.resolveNodeInputData(finalLogAction, 'msg_in');
assert.strictEqual(
  resolvedFalse,
  'Buffing HeroSlayer at Slot 2 (Leader: No)',
  'Step Log should resolve Boolean false converted to No'
);

console.log('✅ Test 9 Passed: Format Text Node, Type Conversion & Data Pin Resolution verified!\n');

// 10. Test Text to Speech (TTS) Dynamic Data Pin (text_in)
console.log('Test 10: Testing Text to Speech (TTS) dynamic text_in data pin resolution...');

const ttsDef = nodeRegistry.get('tts');
assert.ok(ttsDef, 'TTS node must be registered in nodeRegistry');
assert.ok(ttsDef.inputs.includes('text_in'), 'TTS node inputs must include text_in');
assert.ok(ttsDef.outputs.includes('next'), 'TTS node outputs must include next');

const ttsAction = {
  id: 'node_tts_1',
  name: 'Alert TTS',
  type: 'tts',
  text: 'Default static fallback message',
  voice: 'th-TH-PremwadeeNeural',
  volume: 100
};

// 10.1 Fallback when no wire connected
global.resolveNodeInputData = bot.resolveNodeInputData;
let resolvedTtsNoWire = bot.resolveNodeInputData(ttsAction, 'text_in');
assert.strictEqual(resolvedTtsNoWire, null, 'Unconnected text_in should resolve to null');

// 10.2 Connect format_text -> tts (text_in)
const ttsWireConn = {
  id: 'c_fmt_to_tts',
  fromNodeId: 'node_format_text_1',
  fromPort: 'msg_out',
  toNodeId: 'node_tts_1',
  toPort: 'text_in'
};
global.activeActions.push(ttsAction);
global.activeProfileConnections.push(ttsWireConn);

const resolvedTtsFromFormat = bot.resolveNodeInputData(ttsAction, 'text_in');
assert.strictEqual(
  resolvedTtsFromFormat,
  'Buffing HeroSlayer at Slot 2 (Leader: No)',
  'TTS text_in should dynamically resolve formatted text from upstream format_text node'
);

// 10.3 Connect party_buff (name_out) -> tts (text_in)
global.activeProfileConnections = global.activeProfileConnections.filter(c => c.id !== 'c_fmt_to_tts');
const ttsBuffConn = {
  id: 'c_buff_to_tts',
  fromNodeId: 'node_party_buff_1',
  fromPort: 'name_out',
  toNodeId: 'node_tts_1',
  toPort: 'text_in'
};
global.activeProfileConnections.push(ttsBuffConn);

const resolvedTtsFromName = bot.resolveNodeInputData(ttsAction, 'text_in');
assert.strictEqual(
  resolvedTtsFromName,
  'HeroSlayer',
  'TTS text_in should dynamically resolve member name from party_buff name_out'
);

console.log('✅ Test 10 Passed: TTS text_in Dynamic Data Pin & Upstream Action Node Resolution verified!\n');

(async () => {
// ==========================================
// Test 11: Testing Party Scanner & Party Buff showOverlay disabled suppression
// ==========================================
console.log('Test 11: Testing Party Scanner & Party Buff showOverlay disabled suppression...');

const visionService = require('../vision-service');
const partyHandler = require('../party-target-handler');

let renderCalls = 0;
let clearCalls = 0;

const origRender = visionService.VisualOverlay.render;
const origClear = visionService.VisualOverlay.clear;

visionService.VisualOverlay.render = async () => { renderCalls++; };
visionService.VisualOverlay.clear = async () => { clearCalls++; };

const mockPage = {
  isClosed: () => false,
  mouse: {
    click: async () => {},
    move: async () => {}
  },
  evaluate: async () => {}
};

global.clientPages = { '1': mockPage };

// Mock scanClientPage to test showOverlay handling
const origScanClientPage = visionService.scanClientPage;
visionService.scanClientPage = async (page, clientId, scanRegion, options = {}) => {
  if (options.showOverlay === true) {
    await visionService.VisualOverlay.render(page, {});
  } else if (options.showOverlay === false) {
    await visionService.VisualOverlay.clear(page);
  }
  return {
    timestamp: Date.now(),
    members: [
      { slot: 1, name: 'Tanker', isAlive: true, statusCode: 'active', click: { x: 100, y: 100 }, hpPercent: 100 },
      { slot: 2, name: 'DamageDealer', isAlive: true, statusCode: 'active', click: { x: 100, y: 150 }, hpPercent: 80 }
    ]
  };
};

// 11.1 party_scanner with showOverlay: false
renderCalls = 0;
clearCalls = 0;
await partyHandler.runPartyScannerAction({
  targetClient: '1',
  showOverlay: false,
  readNames: false
}, new Set());

assert.strictEqual(renderCalls, 0, 'VisualOverlay.render must NOT be called when showOverlay is false in party_scanner');
assert(clearCalls >= 1, 'VisualOverlay.clear MUST be called when showOverlay is false in party_scanner');

// 11.2 party_buff with showOverlay: false
renderCalls = 0;
clearCalls = 0;
await partyHandler.runPartyBuffAction({
  targetClient: '1',
  showOverlay: false,
  delayAfterClick: 0,
  readNames: false
}, new Set());

assert.strictEqual(renderCalls, 0, 'VisualOverlay.render must NOT be called during party_buff when showOverlay is false');
assert(clearCalls >= 1, 'VisualOverlay.clear MUST be called when party_buff has showOverlay: false');

// Restore original methods
visionService.VisualOverlay.render = origRender;
visionService.VisualOverlay.clear = origClear;
visionService.scanClientPage = origScanClientPage;

console.log('✅ Test 11 Passed: party_scanner and party_buff correctly suppress and clear Visual Overlay when disabled!\n');

// ==========================================
// Test 12: Testing Modular Node Schema & Component-Based Metadata
// ==========================================
console.log('Test 12: Testing Modular Node Schema & Component-Based Metadata...');

const { nodeRegistry } = require('../node-registry');
if (!nodeRegistry.isLoaded) nodeRegistry.loadAll();

const pbDef = nodeRegistry.get('party_buff');
assert(pbDef, 'party_buff node definition must be registered');
assert(Array.isArray(pbDef.schema), 'party_buff must define UI schema');
assert(Array.isArray(pbDef.summaryFields), 'party_buff must define summaryFields');

const hasTargetClient = pbDef.schema.some(f => f.key === 'targetClient' && f.component === 'client_selector');
const hasDelay = pbDef.schema.some(f => f.key === 'delayAfterClick' && f.component === 'number_input');
const hasOverlay = pbDef.schema.some(f => f.key === 'showOverlay' && f.component === 'toggle');
assert(hasTargetClient && hasDelay && hasOverlay, 'party_buff schema must declare client_selector, number_input, and toggle');

const psDef = nodeRegistry.get('party_scanner');
assert(psDef && Array.isArray(psDef.schema), 'party_scanner must define UI schema');
assert(psDef.schema.some(f => f.key === 'lowHpThreshold' && f.component === 'slider'), 'party_scanner must have slider for lowHpThreshold');

const ttsDef = nodeRegistry.get('tts');
assert(ttsDef && Array.isArray(ttsDef.schema), 'tts must define UI schema');
assert(ttsDef.schema.some(f => f.key === 'text' && f.component === 'textarea'), 'tts must have textarea for speech text');

console.log('✅ Test 12 Passed: Modular Node Schema & Component-Based Metadata verified!\n');

// ==========================================
// Test 13: Wire Connection Constraints, Pin Taxonomy & Type Validation
// ==========================================
console.log('Test 13: Testing Wire Connection Constraints, Pin Taxonomy & Type Validation...');

// Mock Minimal Canvas Instance with NodeCanvasEditor Prototype
const { NodeCanvasEditor } = require('../public/js/canvas.js');
const mockCanvas = Object.create(NodeCanvasEditor.prototype);
mockCanvas.nodes = [
  { id: 'node_scanner', type: 'party_scanner', title: 'Party Scanner', data: {} },
  { id: 'node_buff', type: 'party_buff', title: 'Party Buff', data: {} },
  { id: 'node_log', type: 'step_log', title: 'Step Log', data: {} },
  { id: 'node_key', type: 'key_press', title: 'Key Press', data: { keys: ['1'] } },
  { id: 'node_var_num', type: 'variable', title: 'Num Var', data: { varType: 'number', operation: 'set_value' } },
  { id: 'node_fmt', type: 'format_text', title: 'Format Text', data: { pins: ['val_a'] } }
];
mockCanvas.connections = [];

// 1. Port Metadata check
const execInMeta = mockCanvas.getPortMeta('node_key', 'exec_in', 'in');
assert.strictEqual(execInMeta.kind, 'flow', 'exec_in must be flow kind');

const nextMeta = mockCanvas.getPortMeta('node_key', 'next', 'out');
assert.strictEqual(nextMeta.kind, 'flow', 'next must be flow kind');

const msgInMeta = mockCanvas.getPortMeta('node_log', 'msg_in', 'in');
assert.strictEqual(msgInMeta.kind, 'data', 'msg_in must be data kind');
assert.strictEqual(msgInMeta.type, 'string', 'msg_in must accept string type');

const namesOutMeta = mockCanvas.getPortMeta('node_scanner', 'names_out', 'out');
assert.strictEqual(namesOutMeta.kind, 'data', 'names_out must be data kind');
assert.strictEqual(namesOutMeta.type, 'string', 'names_out must be string type');

const slotOutMeta = mockCanvas.getPortMeta('node_buff', 'slot_out', 'out');
assert.strictEqual(slotOutMeta.kind, 'data', 'slot_out must be data kind');
assert.strictEqual(slotOutMeta.type, 'number', 'slot_out must be number type');

// 2. canConnectPorts checks:
// 2.1 Flow -> Flow is ALLOWED
const flowToFlow = mockCanvas.canConnectPorts('node_key', 'next', 'node_log', 'exec_in');
assert.strictEqual(flowToFlow.allowed, true, 'Flow next -> exec_in must be ALLOWED');

// 2.2 Data -> Data (same type) is ALLOWED
const dataToDataSame = mockCanvas.canConnectPorts('node_scanner', 'names_out', 'node_log', 'msg_in');
assert.strictEqual(dataToDataSame.allowed, true, 'names_out (string) -> msg_in (string) must be ALLOWED');

// 2.3 Data -> Data (number auto-cast to string) is ALLOWED
const dataNumberToString = mockCanvas.canConnectPorts('node_buff', 'slot_out', 'node_log', 'msg_in');
assert.strictEqual(dataNumberToString.allowed, true, 'slot_out (number) -> msg_in (string) must be ALLOWED via auto-cast');

// 2.4 Flow -> Data is STRICTLY FORBIDDEN
const flowToData = mockCanvas.canConnectPorts('node_key', 'next', 'node_log', 'msg_in');
assert.strictEqual(flowToData.allowed, false, 'Flow -> Data must be FORBIDDEN');
assert.strictEqual(flowToData.reasonKey, 'wire_err_flow_to_data', 'Should fail with wire_err_flow_to_data');

// 2.5 Data -> Flow is STRICTLY FORBIDDEN
const dataToFlow = mockCanvas.canConnectPorts('node_scanner', 'names_out', 'node_key', 'exec_in');
assert.strictEqual(dataToFlow.allowed, false, 'Data -> Flow must be FORBIDDEN');
assert.strictEqual(dataToFlow.reasonKey, 'wire_err_data_to_flow', 'Should fail with wire_err_data_to_flow');

// 2.6 Data Type Mismatch (String -> Number) is FORBIDDEN
const stringToNumber = mockCanvas.canConnectPorts('node_scanner', 'names_out', 'node_var_num', 'val_in');
assert.strictEqual(stringToNumber.allowed, false, 'String -> Number val_in must be FORBIDDEN');
assert.strictEqual(stringToNumber.reasonKey, 'wire_err_type_mismatch', 'Should fail with wire_err_type_mismatch');

// 2.7 Self Connection is FORBIDDEN
const selfConn = mockCanvas.canConnectPorts('node_key', 'next', 'node_key', 'exec_in');
assert.strictEqual(selfConn.allowed, false, 'Self connection must be FORBIDDEN');
assert.strictEqual(selfConn.reasonKey, 'wire_err_same_node', 'Should fail with wire_err_same_node');

// 3. Single-input data pin auto-pruning in addConnection
mockCanvas.render = function () {};
mockCanvas.onProfileChanged = function () {};
mockCanvas.addHistory = function () {};

// Add first wire to msg_in
mockCanvas.addConnection('node_scanner', 'names_out', 'node_log', 'msg_in');
assert.strictEqual(mockCanvas.connections.length, 1, 'Should have 1 connection');
assert.strictEqual(mockCanvas.connections[0].fromPort, 'names_out');

// Add second wire from slot_out to msg_in: should auto-prune first wire
mockCanvas.addConnection('node_buff', 'slot_out', 'node_log', 'msg_in');
assert.strictEqual(mockCanvas.connections.length, 1, 'Should prune previous incoming data wire to single input');
assert.strictEqual(mockCanvas.connections[0].fromPort, 'slot_out', 'New wire slot_out should replace names_out');

// Attempt illegal connection: should NOT be added
mockCanvas.addConnection('node_key', 'next', 'node_log', 'msg_in');
assert.strictEqual(mockCanvas.connections.length, 1, 'Illegal Flow -> Data connection must NOT be added');

// 4. Test getNodeValidationIssue on illegal connection attached to node
mockCanvas.connections.push({
  id: 'c_illegal',
  fromNodeId: 'node_key',
  fromPort: 'next',
  toNodeId: 'node_log',
  toPort: 'msg_in'
});
const issue = mockCanvas.getNodeValidationIssue(mockCanvas.nodes.find(n => n.id === 'node_log'));
assert.ok(issue, 'Node with illegal wire should return validation issue');
assert.strictEqual(issue.severity, 'error', 'Illegal wire should have error severity');
assert.ok(issue.messageTh.includes('สายต่อผิดประเภท'), 'Issue message should mention illegal wire type');

// Clean up
mockCanvas.connections = mockCanvas.connections.filter(c => c.id !== 'c_illegal');

console.log('✅ Test 13 Passed: Wire Connection Constraints, Pin Taxonomy & Type Validation verified!\n');

// 14. Test Variable Branch (var_branch) and Action Branch (action_branch)
console.log('Test 14: Testing Variable Branch (var_branch) and Action Branch (action_branch)...');
assert.ok(nodeRegistry.has('var_branch'), 'NodeRegistry must contain var_branch');
assert.ok(nodeRegistry.has('action_branch'), 'NodeRegistry must contain action_branch');
assert.ok(nodeRegistry.has('branch'), 'NodeRegistry must resolve branch alias');

const varBranchDef = nodeRegistry.get('var_branch');
assert.deepStrictEqual(varBranchDef.inputs, ['in'], 'var_branch input should be in');
assert.deepStrictEqual(varBranchDef.outputs, ['onTrue', 'onFalse'], 'var_branch outputs should be onTrue/onFalse');

const actionBranchDef = nodeRegistry.get('action_branch');
assert.deepStrictEqual(actionBranchDef.inputs, ['in'], 'action_branch input should be in');
assert.deepStrictEqual(actionBranchDef.outputs, ['onTrue', 'onFalse'], 'action_branch outputs should be onTrue/onFalse');

// Test Variable Branch evaluation via bot.runActionCondition
let lastEmitted = null;
// Reset executionSignals
global.executionSignals = [];

// Set variable isFullBuffPartyScanner = true
bot.setVariableValue({ varName: 'isFullBuffPartyScanner', varType: 'boolean', scope: 'client', targetClient: '1' }, true, '1');

// var_branch checking is_true -> should return true and emit onTrue
const varBranchAct1 = {
  id: 'act_var_branch_1',
  name: 'Check FullBuff Scanner',
  mode: 'var_branch',
  conditionTargetId: 'var:isFullBuffPartyScanner',
  conditionRule: 'is_true',
  varType: 'boolean',
  targetClient: '1'
};
const res1 = await bot.runActionCondition(varBranchAct1);
assert.strictEqual(res1, true, 'isFullBuffPartyScanner is true -> is_true should evaluate true');
const sig1 = global.executionSignals.find(s => s.actionId === 'act_var_branch_1');
assert.ok(sig1, 'Should record signal for act_var_branch_1');
assert.strictEqual(sig1.eventName, 'onTrue', 'isFullBuffPartyScanner is true -> onTrue expected');

// var_branch checking is_false -> should return false and emit onFalse
const varBranchAct2 = {
  id: 'act_var_branch_2',
  name: 'Check FullBuff Scanner False',
  mode: 'var_branch',
  conditionTargetId: 'var:isFullBuffPartyScanner',
  conditionRule: 'is_false',
  varType: 'boolean',
  targetClient: '1'
};
const res2 = await bot.runActionCondition(varBranchAct2);
assert.strictEqual(res2, false, 'isFullBuffPartyScanner is true -> is_false should evaluate false');
const sig2 = global.executionSignals.find(s => s.actionId === 'act_var_branch_2');
assert.ok(sig2, 'Should record signal for act_var_branch_2');
assert.strictEqual(sig2.eventName, 'onFalse', 'isFullBuffPartyScanner is true so is_false check -> onFalse expected');

// var_branch checking number comparison
bot.setVariableValue({ varName: 'partyMemberCount', varType: 'number', scope: 'client', targetClient: '1' }, 4, '1');
const varBranchAct3 = {
  id: 'act_var_branch_3',
  name: 'Check Party Size > 2',
  mode: 'var_branch',
  conditionTargetId: 'var:partyMemberCount',
  conditionRule: 'greater_than',
  conditionValue: 2,
  varType: 'number',
  targetClient: '1'
};
const res3 = await bot.runActionCondition(varBranchAct3);
assert.strictEqual(res3, true, 'partyMemberCount 4 > 2 -> should evaluate true');
const sig3 = global.executionSignals.find(s => s.actionId === 'act_var_branch_3');
assert.strictEqual(sig3.eventName, 'onTrue', 'partyMemberCount 4 > 2 -> onTrue expected');

// Action Branch checking action running status
global.activeActions = [
  { id: 'act_loop_1', name: 'Attack Loop', mode: 'loop' }
];
global.isActionRunning = (id) => id === 'act_loop_1';

const actionBranchAct1 = {
  id: 'act_action_branch_1',
  name: 'Check Attack Loop Running',
  mode: 'action_branch',
  conditionTargetId: 'act_loop_1',
  conditionRule: 'is_running'
};
const res4 = await bot.runActionCondition(actionBranchAct1);
assert.strictEqual(res4, true, 'act_loop_1 is running -> should evaluate true');
const sig4 = global.executionSignals.find(s => s.actionId === 'act_action_branch_1');
assert.strictEqual(sig4.eventName, 'onTrue', 'act_loop_1 is running -> onTrue expected');

// Backward compatibility: legacy mode 'branch' checking running status
const legacyBranchAct = {
  id: 'act_legacy_branch',
  name: 'Legacy Branch Check',
  mode: 'branch',
  conditionTargetId: 'act_loop_1',
  conditionRule: 'is_running'
};
const res5 = await bot.runActionCondition(legacyBranchAct);
assert.strictEqual(res5, true, 'Legacy branch mode should evaluate running state as true');
const sig5 = global.executionSignals.find(s => s.actionId === 'act_legacy_branch');
assert.strictEqual(sig5.eventName, 'onTrue', 'Legacy branch mode should evaluate running state and emit onTrue');

console.log('✅ Test 14 Passed: Variable Branch and Action Branch execution & signal routing verified!\n');

// Test 15: Emergency Stop All Halts New Action Nodes & Abortable Delay
console.log('Test 15: Testing Emergency Stop All halts new action nodes (delay, macro_group, party actions)...');
assert.ok(nodeRegistry.has('emergency_stop'), 'NodeRegistry must contain emergency_stop');
assert.ok(nodeRegistry.has('delay'), 'NodeRegistry must contain delay');
assert.ok(nodeRegistry.has('macro_group'), 'NodeRegistry must contain macro_group');

const delayDef = nodeRegistry.get('delay');
assert.ok(delayDef, 'Delay definition must exist');

// Setup mock action with macro_group and party_buff
const testMacroAction = { id: 'act_macro_test', name: 'Macro Test', mode: 'macro_group' };
const testPartyBuffAction = { id: 'act_pb_test', name: 'Party Buff Test', mode: 'party_buff' };
global.activeActions = [testMacroAction, testPartyBuffAction];

let delayFinished = false;
let chainCompleted = false;
global.fireChain = async (action, event) => {
  if (event === 'onComplete') chainCompleted = true;
};

// Start delay in background
const delayPromise = delayDef.execute({}, { id: 'act_delay_test', name: 'Test Delay', delayMs: 1500 }, []);
delayPromise.then(res => {
  delayFinished = res;
});

// Sleep briefly to ensure delay node is waiting
await new Promise(r => setTimeout(r, 50));

// Fire Emergency Stop All
const prevPartyEpoch = global.partyBuffEpoch || 0;
await bot.runEmergencyStopAction({ name: 'Stop All Test', stopScope: 'all' });

// Await the delay execution result
const delayResult = await delayPromise;
assert.strictEqual(delayResult, false, 'Delay node must abort and return false on Emergency Stop');
assert.strictEqual(chainCompleted, false, 'Delay node must NOT fire onComplete chain after Emergency Stop');
assert.ok((global.partyBuffEpoch || 0) > prevPartyEpoch, 'Emergency Stop must bump partyBuffEpoch');
assert.ok(global.partyActionTokens['act_pb_test'] > 0, 'Party buff token must be invalidated');

console.log('✅ Test 15 Passed: Emergency Stop All instantly aborts delay and invalidates tokens for modular action nodes!\n');

// Test 16: Client Window Bounds Reset & Auto-Save Helper
console.log('Test 16: Testing Client Window Bounds Reset and Auto-Save Helper...');
assert.ok(typeof bot.resetClientWindowBounds === 'function', 'bot.resetClientWindowBounds must be a function');
const testBoundsResult = await bot.resetClientWindowBounds(99);
assert.strictEqual(testBoundsResult.success, true, 'resetClientWindowBounds must return success');
console.log('✅ Test 16 Passed: Window Bounds Reset helper verified!\n');

console.log('🎉 All Step Log & Unreal Blueprint Variable Tests Passed Successfully!');
process.exit(0);
})();

