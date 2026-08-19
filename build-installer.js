/**
 * build-installer.js - Automated Packaging Engine for NodeHotkey
 * Packages application files + portable Node.js runtime into dist/ folder
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const appDistDir = path.join(distDir, 'NodeHotkey');

console.log('====================================================');
console.log('🚀 Packaging NodeHotkey for Standalone Windows Setup');
console.log('====================================================\n');

// 1. Clean & create dist directories
if (fs.existsSync(appDistDir)) {
  console.log('[1/5] 🧹 Cleaning previous dist folder...');
  fs.rmSync(appDistDir, { recursive: true, force: true });
}
fs.mkdirSync(appDistDir, { recursive: true });
const runtimeDir = path.join(appDistDir, 'runtime');
fs.mkdirSync(runtimeDir, { recursive: true });

// 2. Copy Portable Node.js Runtime
console.log('[2/5] 📦 Embedding Portable Node.js Runtime...');
const currentRuntime = process.execPath;
if (fs.existsSync(currentRuntime)) {
  fs.copyFileSync(currentRuntime, path.join(runtimeDir, 'node.exe'));
  console.log(`      ✓ Copied node.exe from ${currentRuntime}`);
} else {
  console.error('      ❌ node.exe not found at:', currentRuntime);
}

// 3. Helper to recursively copy directories
function copyFolderSync(from, to, excludeFilter = null) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  const entries = fs.readdirSync(from, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);

    if (excludeFilter && excludeFilter(srcPath, entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath, excludeFilter);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 4. Copy Project Files & Folders
console.log('[3/5] 📂 Copying Project Files & Assets...');

const rootEntries = fs.readdirSync(rootDir, { withFileTypes: true });
rootEntries.forEach(entry => {
  if (!entry.isFile()) return;
  const name = entry.name;
  if (name === 'build-installer.js' || name.endsWith('.bak') || name.endsWith('.log') || name.endsWith('.exe')) return;

  const ext = path.extname(name).toLowerCase();
  if (['.js', '.json', '.ico', '.png', '.md'].includes(ext)) {
    const src = path.join(rootDir, name);
    fs.copyFileSync(src, path.join(appDistDir, name));
    console.log(`      ✓ Copied ${name}`);
  }
});

console.log('      ⏳ Copying public/ directory...');
copyFolderSync(path.join(rootDir, 'public'), path.join(appDistDir, 'public'));

console.log('      ⏳ Copying launcher/ directory (Desktop Launcher GUI)...');
if (fs.existsSync(path.join(rootDir, 'launcher'))) {
  copyFolderSync(path.join(rootDir, 'launcher'), path.join(appDistDir, 'launcher'));
}

console.log('      ⏳ Copying configs/ directory (profiles & global settings)...');
copyFolderSync(path.join(rootDir, 'configs'), path.join(appDistDir, 'configs'));

console.log('      ⏳ Copying node_modules/ (Production Dependencies)...');
copyFolderSync(
  path.join(rootDir, 'node_modules'),
  path.join(appDistDir, 'node_modules'),
  (fullPath, name) => {
    // Exclude cache or dev artifacts
    return name === '.cache' || name === '.bin';
  }
);

// 5. Create Standalone Launchers
console.log('[4/5] 🛠️ Creating Standalone Launchers...');

// Launcher Batch (Launches Electron Desktop Launcher)
const batLauncherContent = `@echo off
chcp 65001 > nul
cd /d "%~dp0"
start "" "%~dp0runtime\\node.exe" node_modules/electron/cli.js launcher/main.js
exit
`;
fs.writeFileSync(path.join(appDistDir, 'NodeHotkey.bat'), batLauncherContent, 'utf8');

// Launcher VBS (Silent Stealth Background Launch)
const vbsLauncherContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run """runtime\\node.exe"" node_modules/electron/cli.js launcher/main.js", 0, False
`;
fs.writeFileSync(path.join(appDistDir, 'NodeHotkey-Silent.vbs'), vbsLauncherContent, 'utf8');

console.log('[5/5] ✅ Application packaged successfully at:');
console.log(`      ${appDistDir}\n`);
