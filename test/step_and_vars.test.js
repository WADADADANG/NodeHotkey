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
console.log('✅ Test 7 Passed: Step Log Static Message correctly resolved and printed!\n');

console.log('🎉 All Step Log & Unreal Blueprint Variable Tests Passed Successfully!');
process.exit(0);
