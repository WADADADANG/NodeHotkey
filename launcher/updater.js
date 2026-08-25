const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

const GITHUB_REPO = 'WADADADANG/NodeHotkey';

class SystemUpdater {
  constructor(projectDir) {
    this.projectDir = projectDir || path.join(__dirname, '..');
    this.isUpdating = false;
    this.isDownloaded = false;
    this.cachedExtractInfo = null;
    this.hasGitRepo = fs.existsSync(path.join(this.projectDir, '.git'));
  }

  runCommand(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, { cwd: this.projectDir, encoding: 'utf8' }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr || stdout || err.message));
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  fetchGitHubCommit() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.github.com',
        path: `/repos/${GITHUB_REPO}/commits/main`,
        method: 'GET',
        headers: {
          'User-Agent': 'NodeHotkey-Launcher-Updater',
          'Accept': 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const json = JSON.parse(data);
              const changedFiles = Array.isArray(json.files) ? json.files.map(f => f.filename) : [];
              resolve({
                sha: json.sha,
                shortSha: json.sha.slice(0, 7),
                message: json.commit && json.commit.message ? json.commit.message.trim() : 'Latest release update',
                changedFiles: changedFiles
              });
            } else {
              reject(new Error(`GitHub API HTTP ${res.statusCode}: ${data}`));
            }
          } catch (e) {
            reject(new Error(`JSON Parse Error: ${e.message}`));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.setTimeout(8000, () => {
        req.destroy();
        reject(new Error('Connection timeout to GitHub API'));
      });
      req.end();
    });
  }

  getLocalVersion() {
    const versionFilePath = path.join(this.projectDir, 'version.json');
    if (fs.existsSync(versionFilePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
        return {
          version: data.version || '3.0.0',
          commit: data.commit || 'unknown'
        };
      } catch (e) {}
    }
    return { version: '3.0.0', commit: '77bd53a' };
  }

  saveLocalVersion(sha, version = '3.0.0') {
    const versionFilePath = path.join(this.projectDir, 'version.json');
    try {
      fs.writeFileSync(versionFilePath, JSON.stringify({
        version,
        commit: sha.slice(0, 7),
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
    } catch (e) {}
  }

  analyzeImpact(changedFiles = []) {
    const normalized = changedFiles.map(f => f.replace(/\\/g, '/').toLowerCase());
    
    // Level 3: Core App (Requires full Electron App Relaunch)
    const isLevel3 = normalized.some(f => 
      f.includes('launcher/main.js') || 
      f.includes('launcher/preload.js') || 
      f.includes('launcher/updater.js') || 
      f === 'package.json'
    );
    if (isLevel3) {
      return {
        level: 3,
        levelName: 'core_app',
        badge: '🔴 Core App Update',
        badgeClass: 'level-core',
        color: '#ef4444',
        title: 'อัปเดตระบบหลัก (Core System)',
        description: 'มีการแก้ไขไฟล์ระบบหลักของ Launcher จำเป็นต้องปิดและเปิดโปรแกรมใหม่',
        actionLabel: 'ปิดและเปิดโปรแกรมใหม่',
        needsRelaunch: true,
        needsEngineRestart: true,
        isUiOnly: false
      };
    }

    // Level 2: Bot Engine (Requires Bot Process Restart, Game windows can be kept)
    const isLevel2 = normalized.some(f => 
      f === 'bot.js' || 
      f.includes('execution-engine.js') || 
      f.includes('cooldown-manager.js') || 
      f.includes('test-server.js') || 
      f.startsWith('routes/') || 
      f.includes('audio-worker')
    );
    if (isLevel2) {
      return {
        level: 2,
        levelName: 'engine',
        badge: '🟡 Bot Engine Update',
        badgeClass: 'level-engine',
        color: '#f59e0b',
        title: 'อัปเดตระบบบอท (Bot Logic)',
        description: 'มีการแก้ไขโค้ดการทำงานของบอท แนะนำให้รีสตาร์ท Engine เพื่อโหลดตรรกะใหม่',
        actionLabel: 'รีสตาร์ท Engine เดี๋ยวนี้',
        needsRelaunch: false,
        needsEngineRestart: true,
        isUiOnly: false
      };
    }

    // Level 1: UI Only (Seamless Hot-Reload, ZERO game disruption)
    return {
      level: 1,
      levelName: 'ui_only',
      badge: '🟢 UI / Web Hot-Reload',
      badgeClass: 'level-ui',
      color: '#10b981',
      title: 'อัปเดตหน้าตา UI & Web Dashboard',
      description: 'แก้ไขเฉพาะหน้าตาเว็บและข้อความ ไม่กระทบต่อการทำงานของบอทและหน้าจอเกม',
      actionLabel: 'Hot-Reload UI ทันที',
      needsRelaunch: false,
      needsEngineRestart: false,
      isUiOnly: true
    };
  }

  async checkForUpdates() {
    this.hasGitRepo = fs.existsSync(path.join(this.projectDir, '.git'));

    // 1. If Git directory exists, try standard git check
    if (this.hasGitRepo) {
      try {
        await this.runCommand('git fetch origin');
        const localHash = await this.runCommand('git rev-parse HEAD');
        const remoteHash = await this.runCommand('git rev-parse @{u}');
        const hasUpdate = localHash !== remoteHash;
        
        let commitMessage = '';
        let changedFiles = [];
        if (hasUpdate) {
          commitMessage = await this.runCommand('git log -1 --pretty=%B @{u}');
          const diffOutput = await this.runCommand(`git diff --name-only ${localHash} ${remoteHash}`);
          changedFiles = diffOutput.split('\n').map(s => s.trim()).filter(Boolean);
        }

        const impact = this.analyzeImpact(changedFiles);

        return {
          hasUpdate,
          localHash: localHash.slice(0, 7),
          remoteHash: remoteHash.slice(0, 7),
          commitMessage: commitMessage.trim(),
          changedFiles,
          impact
        };
      } catch (gitErr) {
        // Fallback to GitHub API below if git command fails
      }
    }

    // 2. Direct GitHub API Check (Works on installed versions & PC without Git)
    try {
      const remoteInfo = await this.fetchGitHubCommit();
      const localInfo = this.getLocalVersion();
      const hasUpdate = localInfo.commit.toLowerCase() !== remoteInfo.shortSha.toLowerCase() && localInfo.commit.toLowerCase() !== remoteInfo.sha.toLowerCase();

      const impact = this.analyzeImpact(remoteInfo.changedFiles);

      return {
        hasUpdate,
        localHash: localInfo.commit,
        remoteHash: remoteInfo.shortSha,
        commitMessage: remoteInfo.message,
        changedFiles: remoteInfo.changedFiles,
        impact
      };
    } catch (apiErr) {
      return {
        error: `ไม่สามารถตรวจสอบอัปเดตได้: ${apiErr.message} (กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต)`
      };
    }
  }

  downloadBuffer(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { headers: { 'User-Agent': 'NodeHotkey-Launcher-Updater' } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          return this.downloadBuffer(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', (err) => reject(err));
    });
  }

  // =========================================================================
  // STEP 1: DOWNLOAD PACKAGE (Download & Extract to staging area)
  // =========================================================================
  async downloadPackage(onProgressCallback) {
    if (this.isUpdating) throw new Error('Update is already in progress');
    this.isUpdating = true;
    this.hasGitRepo = fs.existsSync(path.join(this.projectDir, '.git'));

    try {
      if (this.hasGitRepo) {
        if (typeof onProgressCallback === 'function') onProgressCallback('📥 Fetching latest commits from Git...');
        await this.runCommand('git fetch origin');
        const localHash = await this.runCommand('git rev-parse HEAD');
        const remoteHash = await this.runCommand('git rev-parse @{u}');
        const diffOutput = await this.runCommand(`git diff --name-only ${localHash} ${remoteHash}`);
        const changedFiles = diffOutput.split('\n').map(s => s.trim()).filter(Boolean);
        const impact = this.analyzeImpact(changedFiles);

        this.cachedExtractInfo = { hasGit: true, remoteHash, changedFiles, impact };
        this.isDownloaded = true;
        this.isUpdating = false;
        return { success: true, impact, changedFiles, remoteHash: remoteHash.slice(0, 7) };
      }

      // Standalone ZIP Download
      if (typeof onProgressCallback === 'function') onProgressCallback('📥 Downloading latest update package from GitHub...');
      const zipUrl = `https://github.com/${GITHUB_REPO}/archive/refs/heads/main.zip`;
      const tempZipPath = path.join(this.projectDir, 'temp_update.zip');
      const tempExtractDir = path.join(this.projectDir, 'temp_update_extracted');

      try { if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath); } catch (e) {}
      try { if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (e) {}

      const zipBuffer = await this.downloadBuffer(zipUrl);
      fs.writeFileSync(tempZipPath, zipBuffer);

      if (typeof onProgressCallback === 'function') onProgressCallback('📦 Extracting update package...');
      await this.runCommand(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${tempZipPath}', '${tempExtractDir}')"`);

      const extractedItems = fs.existsSync(tempExtractDir) ? fs.readdirSync(tempExtractDir) : [];
      if (extractedItems.length === 0) throw new Error('Failed to extract update files (empty archive)');

      const extractedRoot = path.join(tempExtractDir, extractedItems[0]);
      if (!fs.existsSync(extractedRoot) || !fs.statSync(extractedRoot).isDirectory()) {
        throw new Error('Invalid update package structure');
      }

      // Fetch remote commit info for changed files diff
      const remoteInfo = await this.fetchGitHubCommit();
      const impact = this.analyzeImpact(remoteInfo.changedFiles);

      this.cachedExtractInfo = {
        hasGit: false,
        extractedRoot,
        tempZipPath,
        tempExtractDir,
        remoteInfo,
        impact
      };

      this.isDownloaded = true;
      this.isUpdating = false;
      return { success: true, impact, changedFiles: remoteInfo.changedFiles, remoteHash: remoteInfo.shortSha };
    } catch (err) {
      this.isUpdating = false;
      this.isDownloaded = false;
      throw err;
    }
  }

  // =========================================================================
  // STEP 2: APPLY PACKAGE (Overwrite files to live project)
  // =========================================================================
  async applyPackage(onProgressCallback) {
    if (!this.cachedExtractInfo && !this.hasGitRepo) {
      throw new Error('No downloaded package found. Please download first.');
    }

    try {
      if (this.hasGitRepo) {
        if (typeof onProgressCallback === 'function') onProgressCallback('🔄 Applying Git pull...');
        const pullResult = await this.runCommand('git pull');
        try { await this.runCommand('npm install --ignore-scripts'); } catch (e) {}

        const newHash = await this.runCommand('git rev-parse HEAD');
        this.saveLocalVersion(newHash);

        const impact = this.cachedExtractInfo ? this.cachedExtractInfo.impact : this.analyzeImpact([]);
        this.isDownloaded = false;
        this.cachedExtractInfo = null;
        return { success: true, impact, details: pullResult };
      }

      const { extractedRoot, tempZipPath, tempExtractDir, remoteInfo, impact } = this.cachedExtractInfo;
      if (typeof onProgressCallback === 'function') onProgressCallback('🔄 Overwriting application files with latest version...');

      let copiedFilesCount = 0;
      const copyRecursive = (src, dest, relBase = '') => {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        const items = fs.readdirSync(src, { withFileTypes: true });
        for (const item of items) {
          const srcPath = path.join(src, item.name);
          const destPath = path.join(dest, item.name);
          const relPath = path.join(relBase, item.name);

          // Strictly preserve user configs, profiles, logs, and node_modules
          if (item.name === 'configs' || item.name === 'profiles' || item.name === 'logs' || item.name === 'runtime' || item.name === 'node_modules') {
            continue;
          }

          if (item.isDirectory()) {
            copyRecursive(srcPath, destPath, relPath);
          } else {
            // Check if file is already identical to avoid unnecessary write / lock issues
            if (fs.existsSync(destPath)) {
              try {
                const srcStat = fs.statSync(srcPath);
                const destStat = fs.statSync(destPath);
                if (srcStat.size === destStat.size) {
                  const srcBuf = fs.readFileSync(srcPath);
                  const destBuf = fs.readFileSync(destPath);
                  if (srcBuf.equals(destBuf)) {
                    copiedFilesCount++;
                    continue;
                  }
                }
              } catch (e) {}
            }

            try {
              fs.copyFileSync(srcPath, destPath);
              copiedFilesCount++;
            } catch (err) {
              if (err.code === 'EBUSY' || err.code === 'EPERM') {
                console.warn(`[Updater] Resource busy/locked (${err.code}), skipping active file: ${destPath}`);
                copiedFilesCount++;
              } else {
                throw err;
              }
            }
          }
        }
      };

      copyRecursive(extractedRoot, this.projectDir);

      if (copiedFilesCount === 0) {
        throw new Error('No files were updated during installation.');
      }

      // Cleanup staging
      try {
        if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
        if (fs.existsSync(tempExtractDir)) fs.rmSync(tempExtractDir, { recursive: true, force: true });
      } catch (e) {}

      // Save version
      this.saveLocalVersion(remoteInfo.sha);

      if (typeof onProgressCallback === 'function') onProgressCallback(`✅ ${copiedFilesCount} files updated successfully!`);

      this.isDownloaded = false;
      this.cachedExtractInfo = null;
      return { success: true, impact, filesUpdated: copiedFilesCount };
    } catch (err) {
      throw err;
    }
  }

  // All-in-one fallback
  async performUpdate(onProgressCallback) {
    await this.downloadPackage(onProgressCallback);
    return await this.applyPackage(onProgressCallback);
  }
}

module.exports = SystemUpdater;
