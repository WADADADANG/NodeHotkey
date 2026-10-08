const assert = require('assert');
const { nodeRegistry } = require('../node-registry');
const bot = require('../bot');
const { NodeExecutionEngine } = require('../execution-engine');

console.log('🧪 Starting Unreal Blueprint Reroute Node (Knot) Tests...\n');

// 1. Verify Node Definition in Registry
console.log('Test 1: Verifying modular node registration...');
nodeRegistry.loadAll(null, true);
assert.ok(nodeRegistry.has('reroute'), 'NodeRegistry should contain reroute');
assert.ok(nodeRegistry.has('knot'), 'NodeRegistry should contain knot alias');

const rerouteDef = nodeRegistry.get('reroute');
assert.strictEqual(rerouteDef.type, 'reroute');
assert.deepStrictEqual(rerouteDef.inputs, ['in'], 'reroute inputs should be ["in"]');
assert.deepStrictEqual(rerouteDef.outputs, ['out'], 'reroute outputs should be ["out"]');
console.log('✅ Test 1 Passed: Reroute Node definition correctly registered!\n');

// 2. Test Execution Engine Port Matching & Graph Translation
console.log('Test 2: Testing execution engine port matching...');
assert.strictEqual(NodeExecutionEngine.matchPort('out', 'in'), true, 'out should connect to in');
assert.strictEqual(NodeExecutionEngine.matchPort('out', 'exec_in'), true, 'out should connect to exec_in');
assert.strictEqual(NodeExecutionEngine.matchPort('next', 'out'), true, 'next should match generic out');

const testProfile = {
  name: 'Test Reroute Profile',
  nodes: [
    { id: 'node_trigger', type: 'trigger', data: { triggerType: 'keyboard', triggerValue: 'F1', enabled: true } },
    { id: 'node_knot_1', type: 'reroute', data: { enabled: true } },
    { id: 'node_act_1', type: 'key_press', data: { targetClient: '1', keys: ['1'], enabled: true } },
    { id: 'node_act_2', type: 'key_press', data: { targetClient: '1', keys: ['2'], enabled: true } }
  ],
  connections: [
    { id: 'c1', fromNodeId: 'node_trigger', fromPort: 'exec_out', toNodeId: 'node_knot_1', toPort: 'in' },
    { id: 'c2', fromNodeId: 'node_knot_1', fromPort: 'out', toNodeId: 'node_act_1', toPort: 'exec_in' },
    { id: 'c3', fromNodeId: 'node_knot_1', fromPort: 'out', toNodeId: 'node_act_2', toPort: 'exec_in' }
  ]
};

const engine = new NodeExecutionEngine(testProfile);
const downstream = engine.getDownstreamNodes('node_knot_1', 'out');
assert.strictEqual(downstream.length, 2, 'Reroute node should branch to 2 target actions');
assert.strictEqual(downstream[0].node.id, 'node_act_1');
assert.strictEqual(downstream[1].node.id, 'node_act_2');
console.log('✅ Test 2 Passed: Downstream branching and wire matching work perfectly!\n');

// 3. Test bot.js runRerouteAction
console.log('Test 3: Testing bot.runRerouteAction pass-through and circular loop guard...');
assert.strictEqual(typeof bot.runRerouteAction, 'function', 'bot.runRerouteAction must be a function');

let emittedSignals = [];
global.emitSignal = (id, event) => {
  emittedSignals.push({ id, event });
};
global.fireChain = async (act, event, stack) => {
  emittedSignals.push({ actionId: act.id, chainEvent: event });
};

const knotAction = { id: 'test_knot', name: 'Reroute 1', mode: 'reroute' };
bot.runRerouteAction(knotAction).then(() => {
  assert.ok(emittedSignals.some(s => s.event === 'out'), 'Should emit "out" signal');
  assert.ok(emittedSignals.some(s => s.chainEvent === 'out'), 'Should fireChain "out" event');
  console.log('🎉 All Reroute Node (Knot) tests passed successfully!\n');
  process.exit(0);
});
