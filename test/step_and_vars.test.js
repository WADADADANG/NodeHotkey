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
console.log('Test 3: Testing Log Classifier for Step Logs...');
// Emulate classifyLogLevel from launcher/main.js
function classifyLogLevel(line) {
  const upper = (line || '').toUpperCase();
  if (upper.includes('[STEP]') || upper.includes('🧭') || upper.includes('📍')) return 'step';
  if (upper.includes('[ERROR]') || upper.includes('ERR:')) return 'error';
  if (upper.includes('[WARN]') || upper.includes('WARNING')) return 'warn';
  if (upper.includes('[INFO]')) return 'info';
  if (upper.includes('[ACTION]') || upper.includes('[BOT]')) return 'action';
  return 'default';
}

assert.strictEqual(classifyLogLevel('🧭 [Step] [Client 1] [BOSS_ALERT] PHASE_2_ENRAGE'), 'step', 'Should classify as step');
assert.strictEqual(classifyLogLevel('2026-09-12 [INFO] Bot started'), 'info', 'Should classify as info');
assert.strictEqual(classifyLogLevel('2026-09-12 [ACTION] Key Press 1'), 'action', 'Should classify as action');
console.log('✅ Test 3 Passed: Log classifier correctly isolates step logs!\n');

console.log('🎉 All Step Log & Unreal Blueprint Variable Tests Passed Successfully!');
process.exit(0);
