const assert = require('assert');
const { convertLegacyProfileToNodeWorkflow, isNodeWorkflowProfile } = require('../converter');
const NodeExecutionEngine = require('../execution-engine');

console.log('🧪 Starting Phase 2 Profile Converter & Node Execution Engine Unit Tests...\n');

// Test 1: Legacy Profile with Single Key Loop Action & Mouse Trigger
const legacyProfile1 = {
  name: 'Test Profile 1',
  actions: [
    {
      id: 'act_101',
      name: 'RM Heal Loop',
      enabled: true,
      trigger: { type: 'mouse', value: '4' },
      mode: 'loop',
      targetClient: '1',
      keys: ['1'],
      interval: 3000,
      jitter: 250,
      executeImmediately: true,
      chaining: { _enabled: false }
    }
  ]
};

const converted1 = convertLegacyProfileToNodeWorkflow(legacyProfile1);
console.log('Test 1: Converting Legacy Profile with Mouse Trigger...');
assert.strictEqual(converted1.version, '3.0.0', 'Version should be 3.0.0');
assert.strictEqual(converted1.nodes.length, 2, 'Should create 2 nodes (1 trigger + 1 loop)');
assert.strictEqual(converted1.connections.length, 1, 'Should create 1 connection from trigger to loop');

const triggerNode1 = converted1.nodes.find(n => n.type === 'trigger');
const loopNode1 = converted1.nodes.find(n => n.type === 'loop');

assert.ok(triggerNode1, 'Trigger node should exist');
assert.ok(loopNode1, 'Loop node should exist');
assert.strictEqual(triggerNode1.data.triggerType, 'mouse');
assert.strictEqual(triggerNode1.data.triggerValue, '4');
assert.strictEqual(converted1.connections[0].fromNodeId, triggerNode1.id);
assert.strictEqual(converted1.connections[0].toNodeId, loopNode1.id);
console.log('✅ Test 1 Passed!\n');

// Test 2: Chained Actions (Action Branch / If-Else Chaining)
const legacyProfile2 = {
  name: 'Test Chained Profile',
  actions: [
    {
      id: 'act_cond_1',
      name: 'HP Check Condition',
      enabled: true,
      mode: 'condition',
      trigger: { type: 'keyboard', value: 'F1' },
      chaining: {
        _enabled: true,
        onTrue: 'act_heal_2',
        onFalse: 'act_buff_3'
      }
    },
    {
      id: 'act_heal_2',
      name: 'Heal Skill',
      enabled: true,
      mode: 'key_press',
      keys: ['2']
    },
    {
      id: 'act_buff_3',
      name: 'Buff Skill Queue',
      enabled: true,
      mode: 'buff_sequence',
      keys: ['3', '4']
    }
  ]
};

const converted2 = convertLegacyProfileToNodeWorkflow(legacyProfile2);
console.log('Test 2: Converting Chained Profile (Condition -> True/False outputs)...');
assert.strictEqual(converted2.nodes.length, 4, 'Should create 4 nodes (1 trigger + 3 actions)');
assert.strictEqual(converted2.connections.length, 3, 'Should create 3 connections (1 trigger -> cond, 1 cond -> true, 1 cond -> false)');

const engine = new NodeExecutionEngine(converted2);
const matchedTriggers = engine.getMatchingTriggerNodes('keyboard', 'F1');
assert.strictEqual(matchedTriggers.length, 1, 'Engine should find 1 matched trigger for F1 key');

const condNode = engine.getDownstreamNodes(matchedTriggers[0].id, 'exec_out');
assert.strictEqual(condNode.length, 1, 'Trigger should connect to Condition node');
assert.strictEqual(condNode[0].node.data.actionId, 'act_cond_1');

const onTrueDownstream = engine.getDownstreamNodes(condNode[0].node.id, 'on_true');
assert.strictEqual(onTrueDownstream.length, 1, 'Condition on_true should connect to act_heal_2');
assert.strictEqual(onTrueDownstream[0].node.data.actionId, 'act_heal_2');

const onFalseDownstream = engine.getDownstreamNodes(condNode[0].node.id, 'on_false');
assert.strictEqual(onFalseDownstream.length, 1, 'Condition on_false should connect to act_buff_3');
assert.strictEqual(onFalseDownstream[0].node.data.actionId, 'act_buff_3');

console.log('✅ Test 2 Passed!\n');

// Test 3: Existing v3.0.0 Profile Pass-Through Validation
console.log('Test 3: Validating v3.0.0 Profile Pass-through...');
assert.strictEqual(isNodeWorkflowProfile(converted2), true, 'Profile should be recognized as Node Workflow v3.0.0');
const reconverted = convertLegacyProfileToNodeWorkflow(converted2);
assert.strictEqual(reconverted, converted2, 'Converter should return existing v3.0.0 profile as-is without re-processing');
console.log('✅ Test 3 Passed!\n');

// Test 4: Macro Group Node Creation & Steps
console.log('Test 4: Validating Macro Group Node...');
const macroProfile = {
  name: 'Macro Profile',
  actions: [
    {
      id: 'act_macro_1',
      name: 'RM Full Buff Combo',
      enabled: true,
      mode: 'macro_group',
      trigger: { type: 'keyboard', value: '4' },
      targetClient: '2',
      repeatCount: 1,
      steps: [
        { key: '1', delay: 400, holdMs: 0 },
        { key: '2', delay: 400, holdMs: 0 },
        { key: '3', delay: 400, holdMs: 0 }
      ]
    }
  ]
};

const convertedMacro = convertLegacyProfileToNodeWorkflow(macroProfile);
assert.strictEqual(convertedMacro.nodes.length, 2, 'Should create 2 nodes (1 trigger + 1 macro_group)');
const macroNode = convertedMacro.nodes.find(n => n.type === 'macro_group');
assert.ok(macroNode, 'Macro group node should exist');
assert.strictEqual(macroNode.data.steps.length, 3, 'Macro group should have 3 steps');
assert.strictEqual(macroNode.data.steps[0].key, '1');
assert.strictEqual(macroNode.data.targetClient, '2');
console.log('✅ Test 4 Passed!\n');

// Test 5: Multi-Active Profiles Concurrent Execution Engine Validation
console.log('Test 5: Validating Multi-Active Profiles Concurrent Execution Engine...');
const healProfile = {
  name: 'Healer Profile',
  actions: [
    {
      id: 'act_heal_1',
      name: 'Auto Heal',
      enabled: true,
      mode: 'key_press',
      trigger: { type: 'keyboard', value: 'H' },
      keys: ['1']
    }
  ]
};

const dpsProfile = {
  name: 'DPS Profile',
  actions: [
    {
      id: 'act_dps_1',
      name: 'Nuke Skill',
      enabled: true,
      mode: 'key_press',
      trigger: { type: 'keyboard', value: 'D' },
      keys: ['2']
    }
  ]
};

const convertedHeal = convertLegacyProfileToNodeWorkflow(healProfile);
const convertedDPS = convertLegacyProfileToNodeWorkflow(dpsProfile);

const multiEngine = new NodeExecutionEngine([convertedHeal, convertedDPS]);

// Match trigger H from Healer Profile
const matchedH = multiEngine.getMatchingTriggerNodes('keyboard', 'H');
assert.strictEqual(matchedH.length, 1, 'Should find trigger node for key H');
assert.strictEqual(matchedH[0]._profileName, 'Healer Profile', 'Trigger H should belong to Healer Profile');
const healDownstream = multiEngine.getDownstreamNodes(matchedH[0].id, 'exec_out');
assert.strictEqual(healDownstream.length, 1, 'Trigger H should connect to act_heal_1 node');
assert.strictEqual(healDownstream[0].node.data.actionId, 'act_heal_1');

// Match trigger D from DPS Profile
const matchedD = multiEngine.getMatchingTriggerNodes('keyboard', 'D');
assert.strictEqual(matchedD.length, 1, 'Should find trigger node for key D');
assert.strictEqual(matchedD[0]._profileName, 'DPS Profile', 'Trigger D should belong to DPS Profile');
const dpsDownstream = multiEngine.getDownstreamNodes(matchedD[0].id, 'exec_out');
assert.strictEqual(dpsDownstream.length, 1, 'Trigger D should connect to act_dps_1 node');
assert.strictEqual(dpsDownstream[0].node.data.actionId, 'act_dps_1');

console.log('✅ Test 5 Passed!\n');

console.log('🎉 All Multi-Active Profiles & Node Workflow Unit Tests Passed Successfully!');

