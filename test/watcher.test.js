const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  initProfileWatcher,
  writeConfig,
  readConfig,
  writeSingleProfile,
  readSingleProfile,
  PROFILES_DIR
} = require('../config-store');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runWatcherTests() {
  console.log('🧪 Starting Profile Watcher & External Change Unit Tests...\n');

  const testProfileName = 'UnitTestWatcherProfile';
  const testFileName = `${testProfileName}.json`;
  const testFilePath = path.join(PROFILES_DIR, testFileName);

  // Clean up previous test file if exists
  if (fs.existsSync(testFilePath)) {
    try { fs.unlinkSync(testFilePath); } catch (e) {}
  }

  let externalEvents = [];
  initProfileWatcher((event) => {
    externalEvents.push(event);
  });

  await sleep(400); // Allow watcher to initialize

  // Test 1: Internal write via writeSingleProfile should NOT trigger external event
  console.log('Test 1: Testing internal write suppression...');
  writeSingleProfile(testProfileName, {
    name: testProfileName,
    nodes: [{ id: 'n1', type: 'delay', data: { delay: 1000 } }]
  });

  await sleep(600);
  assert.strictEqual(externalEvents.length, 0, 'Internal write should NOT trigger external change event');
  console.log('✅ Test 1 Passed: Internal write correctly ignored by watcher!\n');

  // Test 2: External write (simulating Notepad or VS Code editing the file directly)
  console.log('Test 2: Testing external file modification detection...');
  const currentContent = fs.readFileSync(testFilePath, 'utf8');
  const parsed = JSON.parse(currentContent);
  parsed.nodes.push({ id: 'n2', type: 'sound', data: { sound: 'beep' } });

  // Sleep slightly to ensure distinct timestamp from internal write
  await sleep(2000);

  // Write directly using raw fs (external tool simulation)
  fs.writeFileSync(testFilePath, JSON.stringify(parsed, null, 2), 'utf8');

  // Wait for debounce and watcher to catch
  await sleep(600);

  const modEvent = externalEvents.find(e => e.profileName === testProfileName && e.action === 'modified');
  assert.ok(modEvent, 'External modification MUST trigger an event with action="modified"');
  console.log(`✅ Test 2 Passed: Detected external modification on "${modEvent.profileName}" successfully!\n`);

  // Test 3: readSingleProfile verification
  console.log('Test 3: Validating readSingleProfile fresh data retrieval...');
  const fresh = readSingleProfile(testProfileName);
  assert.strictEqual(fresh.name, testProfileName);
  assert.strictEqual(fresh.nodes.length, 2);
  console.log('✅ Test 3 Passed: readSingleProfile returned the externally updated profile!\n');

  // Cleanup
  if (fs.existsSync(testFilePath)) {
    try { fs.unlinkSync(testFilePath); } catch (e) {}
  }

  console.log('🎉 All Profile Watcher & External Change Tests Passed Successfully!');
  process.exit(0);
}

runWatcherTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
