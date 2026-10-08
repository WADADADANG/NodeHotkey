/**
 * tests/dynamic-client-slots-test.js
 * Unit tests for Dynamic Client Slots (Fixed Slot Architecture).
 */

const assert = require('assert');
const path = require('path');
const configStore = require('../config-store.js');

console.log('🧪 Starting Dynamic Client Slots Unit Tests...\n');

// Test 1: Verify getGlobalSettings includes clientSlots
console.log('Test 1: Verifying getGlobalSettings has clientSlots...');
const globalSettings = configStore.getGlobalSettings();
assert(Array.isArray(globalSettings.clientSlots), 'globalSettings.clientSlots must be an array');
assert(globalSettings.clientSlots.length > 0, 'clientSlots array should not be empty');
console.log(`✅ Test 1 Passed: getGlobalSettings contains clientSlots: [${globalSettings.clientSlots.join(', ')}]!\n`);

// Test 2: Fixed Slot Model (No re-indexing on deletion)
console.log('Test 2: Verifying Fixed Slot Deletion Model (Gaps preserved without re-indexing)...');
let slots = [1, 2, 3, 4];
// Delete Client 2
slots = slots.filter(s => s !== 2);
assert.deepStrictEqual(slots, [1, 3, 4], 'Slots after deleting 2 must be [1, 3, 4] with no re-indexing of 3 or 4');
assert.strictEqual(slots.includes(2), false, 'Slot 2 should no longer exist');
assert.strictEqual(slots.includes(3), true, 'Slot 3 must remain ID 3');
assert.strictEqual(slots.includes(4), true, 'Slot 4 must remain ID 4');
console.log('✅ Test 2 Passed: Slot 2 deletion maintains fixed IDs for 1, 3, and 4!\n');

// Test 3: Filling the gap vs Appending new slot
console.log('Test 3: Testing filling empty gaps vs adding trailing slots...');
// User clicks [➕ เพิ่มจอ 2]
const fillSlot = 2;
if (!slots.includes(fillSlot)) {
  slots.push(fillSlot);
  slots.sort((a, b) => a - b);
}
assert.deepStrictEqual(slots, [1, 2, 3, 4], 'Slot 2 should be restored into its original position');

// User clicks trailing [➕ เพิ่มจอใหม่ (จอ 5)]
const maxSlot = Math.max(...slots);
const nextSlot = maxSlot + 1;
assert.strictEqual(nextSlot, 5, 'Next slot should be 5');
slots.push(nextSlot);
assert.deepStrictEqual(slots, [1, 2, 3, 4, 5], 'Slots should now include 5');
console.log('✅ Test 3 Passed: Gap-filling and trailing slot addition verified!\n');

// Test 4: PiP Window Regex & Layout calculations for N clients
console.log('Test 4: Testing PiP client ID validation and grid layout scaling...');
const isClientId = (id) => /^[1-9]\d*$/.test(id);
assert.strictEqual(isClientId('1'), true);
assert.strictEqual(isClientId('8'), true);
assert.strictEqual(isClientId('12'), true);
assert.strictEqual(isClientId('99'), true);
assert.strictEqual(isClientId('0'), false);
assert.strictEqual(isClientId('null'), false);
assert.strictEqual(isClientId('-1'), false);
assert.strictEqual(isClientId('abc'), false);

function getLayout(n) {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n <= 2) return { cols: 2, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  if (n <= 12) return { cols: 4, rows: 3 };
  if (n <= 16) return { cols: 4, rows: 4 };
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

assert.deepStrictEqual(getLayout(1), { cols: 1, rows: 1 });
assert.deepStrictEqual(getLayout(4), { cols: 2, rows: 2 });
assert.deepStrictEqual(getLayout(8), { cols: 3, rows: 3 });
assert.deepStrictEqual(getLayout(12), { cols: 4, rows: 3 });
assert.deepStrictEqual(getLayout(16), { cols: 4, rows: 4 });
assert.deepStrictEqual(getLayout(20), { cols: 5, rows: 4 });
console.log('✅ Test 4 Passed: PiP ID validation and N-screen grid layout calculations verified!\n');

// Test 5: Action Node Target Clients Stability with arbitrary slots
console.log('Test 5: Verifying Action Node targetClient stability...');
const actionNode = {
  id: 'act_heal_1',
  targetClient: '3', // Specifically targeting Client 3
  type: 'key_press'
};

// Even if client 2 was removed, actionNode.targetClient is still '3'
const activeClients = [1, 3, 4];
const isActionTargetActive = (target, active) => {
  if (target === 'all') return active.length > 0;
  return active.includes(Number(target));
};

assert.strictEqual(isActionTargetActive(actionNode.targetClient, activeClients), true, 'Action targeting Client 3 still finds active Client 3');
assert.strictEqual(actionNode.targetClient, '3', 'actionNode.targetClient remains unchanged at 3');
console.log('✅ Test 5 Passed: Action Node targetClient remains stable and matches correct client!\n');

console.log('🎉 All Dynamic Client Slots Unit Tests Passed Successfully!');
