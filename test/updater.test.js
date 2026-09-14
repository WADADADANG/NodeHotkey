const assert = require('assert');
const path = require('path');
const SystemUpdater = require('../launcher/updater');

async function runTests() {
  console.log('🧪 Starting Updater Dependency & Impact Analysis Tests...\n');
  const updater = new SystemUpdater(path.join(__dirname, '..'));

  console.log('Test 1: Verifying findNpmRunner()...');
  const runner = updater.findNpmRunner();
  assert(runner && runner.command, 'findNpmRunner must return an object with a command');
  console.log(`      ✓ Detected NPM Runner: ${runner.command}`);
  console.log('✅ Test 1 Passed!\n');

  console.log('Test 2: Verifying analyzeImpact for UI files (Level 1)...');
  const uiImpact = await updater.analyzeImpact(['public/style.css', 'public/index.html']);
  assert.strictEqual(uiImpact.level, 1, 'UI files should be level 1');
  assert.strictEqual(uiImpact.hasDependencyChanges, false, 'UI files should not trigger dependency changes');
  console.log('✅ Test 2 Passed!\n');

  console.log('Test 3: Verifying analyzeImpact for Bot Engine files (Level 2)...');
  const engineImpact = await updater.analyzeImpact(['bot.js', 'routes/profile-routes.js']);
  assert.strictEqual(engineImpact.level, 2, 'Bot engine files should be level 2');
  assert.strictEqual(engineImpact.hasDependencyChanges, false);
  console.log('✅ Test 3 Passed!\n');

  console.log('Test 4: Verifying analyzeImpact for Core Launcher files (Level 3)...');
  const coreImpact = await updater.analyzeImpact(['launcher/main.js']);
  assert.strictEqual(coreImpact.level, 3, 'Core Launcher files should be level 3');
  assert.strictEqual(coreImpact.hasDependencyChanges, false);
  console.log('✅ Test 4 Passed!\n');

  console.log('Test 5: Verifying analyzeImpact for package.json without dependency changes (No False Positive)...');
  // Local package.json dependencies match origin/main, so hasDependencyChanges must be false
  const pkgImpact = await updater.analyzeImpact(['package.json']);
  assert.strictEqual(pkgImpact.hasDependencyChanges, false, 'package.json without added dependencies should NOT flag dependency changes');
  console.log('✅ Test 5 Passed!\n');

  console.log('🎉 All Updater Dependency & Impact Tests Passed Successfully!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
