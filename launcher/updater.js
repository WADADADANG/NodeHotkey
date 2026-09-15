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

  fetchGitHubDiff(localCommit) {
    return new Promise((resolve, reject) => {
      if (!localCommit || localCommit === 'unknown') {
        return this.fetchGitHubCommit().then(single => {
          resolve({
            hasUpdate: true,
            status: 'ahead',
            remoteHash: single.shortSha,
            remoteSha: single.sha,
            commitCount: 1,
            commitsList: [{ sha: single.shortSha, message: single.message.split('\n')[0] }],
            commitMessage: single.message,
            changedFiles: single.changedFiles
          });
        }).catch(reject);
      }

      const options = {
        hostname: 'api.github.com',
        path: `/repos/${GITHUB_REPO}/compare/${encodeURIComponent(localCommit)}...main`,
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
            if (res.statusCode === 200) {
              const json = JSON.parse(data);
              const totalCommits = json.total_commits || (Array.isArray(json.commits) ? json.commits.length : 0);
              const commits = Array.isArray(json.commits) ? json.commits : [];
              const changedFiles = Array.isArray(json.files) ? json.files.map(f => f.filename) : [];
              
              const headSha = (commits.length > 0 ? commits[commits.length - 1].sha : (json.base_commit ? json.base_commit.sha : '')).trim();
              const shortSha = headSha ? headSha.slice(0, 7) : 'main';

              const commitsList = commits.map(c => ({
                sha: c.sha ? c.sha.slice(0, 7) : '',
                message: c.commit && c.commit.message ? c.commit.message.trim().split('\n')[0] : ''
              }));

              let commitMessage = '';
              if (commitsList.length > 1) {
                commitMessage = `${commitsList.length} commits:\n` + commitsList.map(c => `• ${c.sha}: ${c.message}`).join('\n');
              } else if (commitsList.length === 1) {
                commitMessage = commits[0].commit && commits[0].commit.message ? commits[0].commit.message.trim() : 'Latest release update';
              } else {
                commitMessage = 'Up to date with latest release';
              }

              resolve({
                hasUpdate: totalCommits > 0 && json.status !== 'identical',
                status: json.status,
                remoteHash: shortSha,
                remoteSha: headSha,
                commitCount: totalCommits,
                commitsList,
                commitMessage,
                changedFiles
              });
            } else if (res.statusCode === 404) {
              // Local commit not found on remote (e.g. rebased or modified history), fallback to latest commit
              this.fetchGitHubCommit().then(single => {
                resolve({
                  hasUpdate: true,
                  status: 'ahead',
                  remoteHash: single.shortSha,
                  remoteSha: single.sha,
                  commitCount: 1,
                  commitsList: [{ sha: single.shortSha, message: single.message.split('\n')[0] }],
                  commitMessage: single.message,
                  changedFiles: single.changedFiles
                });
              }).catch(reject);
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
          version: data.version || '3.1.0',
          commit: data.commit || 'unknown'
        };
      } catch (e) {}
    }
    return { version: '3.1.0', commit: 'unknown' };
  }

  saveLocalVersion(sha, version) {
    const versionFilePath = path.join(this.projectDir, 'version.json');
    try {
      let currentVersion = version;
      if (!currentVersion && fs.existsSync(versionFilePath)) {
        try {
          const currentData = JSON.parse(fs.readFileSync(versionFilePath, 'utf8'));
          currentVersion = currentData.version;
        } catch (e) {}
      }
      fs.writeFileSync(versionFilePath, JSON.stringify({
        version: currentVersion || '3.1.0',
        commit: (sha || '').slice(0, 7),
        updatedAt: new Date().toISOString()
      }, null, 2), 'utf8');
    } catch (e) {}
  }

  async checkActualDependencyChanges() {
    try {
      const localPkgPath = path.join(this.projectDir, 'package.json');
      if (!fs.existsSync(localPkgPath)) return false;
      const localPkg = JSON.parse(fs.readFileSync(localPkgPath, 'utf8'));
      const localDeps = localPkg.dependencies || {};

      let remoteDeps = null;

      // 1. If we already extracted files in Step 1, inspect extracted package.json directly
      if (this.cachedExtractInfo && this.cachedExtractInfo.extractedRoot) {
        const extractedPkgPath = path.join(this.cachedExtractInfo.extractedRoot, 'package.json');
        if (fs.existsSync(extractedPkgPath)) {
          try {
            const parsed = JSON.parse(fs.readFileSync(extractedPkgPath, 'utf8'));
            if (parsed && parsed.dependencies) remoteDeps = parsed.dependencies;
          } catch (e) {}
        }
      }

      // 2. If Git repo exists, inspect origin/main:package.json
      if (!remoteDeps && this.hasGitRepo) {
        try {
          const content = await this.runCommand('git show origin/main:package.json');
          const parsed = JSON.parse(content);
          if (parsed && parsed.dependencies) remoteDeps = parsed.dependencies;
        } catch (e) {}
      }

      // 3. Fallback: Fetch raw package.json from GitHub
      if (!remoteDeps) {
        const remoteData = await new Promise((resolve) => {
          const options = {
            hostname: 'raw.githubusercontent.com',
            path: `/${GITHUB_REPO}/main/package.json`,
            method: 'GET',
            headers: { 'User-Agent': 'NodeHotkey-Launcher-Updater' }
          };
          const req = https.request(options, res => {
            if (res.statusCode !== 200) return resolve(null);
            let buf = '';
            res.on('data', chunk => buf += chunk);
            res.on('end', () => {
              try { resolve(JSON.parse(buf)); } catch (e) { resolve(null); }
            });
          });
          req.on('error', () => resolve(null));
          req.setTimeout(4000, () => { req.destroy(); resolve(null); });
          req.end();
        });
        if (remoteData && remoteData.dependencies) remoteDeps = remoteData.dependencies;
      }

      if (!remoteDeps) return false;

      // Check if any remote dependency is missing locally or has different version
      const hasAddedOrChanged = Object.keys(remoteDeps).some(key => {
        return !localDeps[key] || localDeps[key] !== remoteDeps[key];
      });

      return hasAddedOrChanged;
    } catch (e) {
      return false;
    }
  }

  findNpmRunner() {
    const runtimeNode = path.join(this.projectDir, 'runtime', 'node.exe');
    const embeddedNpmPaths = [
      path.join(this.projectDir, 'runtime', 'npm', 'bin', 'npm-cli.js'),
      path.join(this.projectDir, 'node_modules', 'npm', 'bin', 'npm-cli.js')
    ];
    if (fs.existsSync(runtimeNode)) {
      for (const p of embeddedNpmPaths) {
        if (fs.existsSync(p)) {
          return { command: `"${runtimeNode}" "${p}"`, isDirect: false };
        }
      }
    }

    if (process.env['ProgramFiles']) {
      const globalNpmCli = path.join(process.env['ProgramFiles'], 'nodejs', 'node_modules', 'npm', 'bin', 'npm-cli.js');
      if (fs.existsSync(globalNpmCli)) {
        const nodeExec = fs.existsSync(runtimeNode) ? runtimeNode : (process.execPath || 'node');
        return { command: `"${nodeExec}" "${globalNpmCli}"`, isDirect: false };
      }
    }

    return { command: 'npm', isDirect: true };
  }

  async analyzeImpact(changedFiles = []) {
    const normalized = changedFiles.map(f => f.replace(/\\/g, '/').toLowerCase());
    
    // Check if package.json has actual dependency additions or updates
    const mentionsPkg = normalized.some(f => 
      f === 'package.json' || 
      f === 'package-lock.json'
    );

    let hasDependencyChanges = false;
    if (mentionsPkg) {
      hasDependencyChanges = await this.checkActualDependencyChanges();
    }

    // Level 3: Core App (Requires full Electron App Relaunch)
    const isLevel3 = normalized.some(f => 
      f.includes('launcher/main.js') || 
      f.includes('launcher/preload.js') || 
      f.includes('launcher/updater.js')
    ) || hasDependencyChanges;

    if (isLevel3) {
      if (hasDependencyChanges) {
        return {
          level: 3,
          levelName: 'core_dependencies',
          badge: '⚡ Auto-Install Ready',
          badge_th: '⚡ พร้อมติดตั้ง Library อัตโนมัติ',
          badge_en: '⚡ Auto-Install Ready',
          badgeClass: 'level-dependencies',
          color: '#38bdf8',
          title: 'อัปเดตโมดูลและฟีเจอร์ใหม่',
          title_th: 'อัปเดตโมดูลและฟีเจอร์ใหม่',
          title_en: 'Module & Dependency Update',
          description: 'ตรวจพบ Library ใหม่ในระบบ ตัวโปรแกรมจะทำการติดตั้ง Library ใหม่อัตโนมัติใน Step 2 โดยที่คุณไม่ต้องติดตั้งโปรแกรมใหม่เอง',
          description_th: 'ตรวจพบ Library ใหม่ในระบบ ตัวโปรแกรมจะทำการติดตั้ง Library ใหม่อัตโนมัติใน Step 2 โดยที่คุณไม่ต้องติดตั้งโปรแกรมใหม่เอง',
          description_en: 'New system libraries detected. Required dependencies will be automatically installed in Step 2 with no manual reinstallation needed.',
          actionLabel: 'ปิดและเปิดโปรแกรมใหม่',
          actionLabel_th: 'ปิดและเปิดโปรแกรมใหม่',
          actionLabel_en: 'Relaunch App',
          hasDependencyChanges: true,
          needsRelaunch: true,
          needsEngineRestart: true,
          isUiOnly: false
        };
      }
      return {
        level: 3,
        levelName: 'core_app',
        badge: '🔴 Core App Update',
        badge_th: '🔴 อัปเดตระบบหลัก (Core)',
        badge_en: '🔴 Core App Update',
        badgeClass: 'level-core',
        color: '#ef4444',
        title: 'อัปเดตระบบหลัก (Core System)',
        title_th: 'อัปเดตระบบหลัก (Core System)',
        title_en: 'Core System Update',
        description: 'มีการแก้ไขไฟล์ระบบหลักของ Launcher จำเป็นต้องปิดและเปิดโปรแกรมใหม่',
        description_th: 'มีการแก้ไขไฟล์ระบบหลักของ Launcher จำเป็นต้องปิดและเปิดโปรแกรมใหม่',
        description_en: 'Core launcher system files modified. An app restart is required for changes to take effect.',
        actionLabel: 'ปิดและเปิดโปรแกรมใหม่',
        actionLabel_th: 'ปิดและเปิดโปรแกรมใหม่',
        actionLabel_en: 'Relaunch App',
        hasDependencyChanges: false,
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
        badge_th: '🟡 อัปเดตระบบบอท (Engine)',
        badge_en: '🟡 Bot Engine Update',
        badgeClass: 'level-engine',
        color: '#f59e0b',
        title: 'อัปเดตระบบบอท (Bot Logic)',
        title_th: 'อัปเดตระบบบอท (Bot Logic)',
        title_en: 'Bot Engine Update',
        description: 'มีการแก้ไขโค้ดการทำงานของบอท แนะนำให้รีสตาร์ท Engine เพื่อโหลดตรรกะใหม่',
        description_th: 'มีการแก้ไขโค้ดการทำงานของบอท แนะนำให้รีสตาร์ท Engine เพื่อโหลดตรรกะใหม่',
        description_en: 'Bot logic and scripts modified. Restarting the Bot Engine is recommended to load new logic.',
        actionLabel: 'รีสตาร์ท Engine เดี๋ยวนี้',
        actionLabel_th: 'รีสตาร์ท Engine เดี๋ยวนี้',
        actionLabel_en: 'Restart Engine Now',
        hasDependencyChanges: false,
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
      badge_th: '🟢 อัปเดต UI (Hot-Reload)',
      badge_en: '🟢 UI Hot-Reload',
      badgeClass: 'level-ui',
      color: '#10b981',
      title: 'อัปเดตหน้าตา UI & Web Dashboard',
      title_th: 'อัปเดตหน้าตา UI & Web Dashboard',
      title_en: 'UI & Dashboard Update',
      description: 'แก้ไขเฉพาะหน้าตาเว็บและข้อความ ไม่กระทบต่อการทำงานของบอทและหน้าจอเกม',
      description_th: 'แก้ไขเฉพาะหน้าตาเว็บและข้อความ ไม่กระทบต่อการทำงานของบอทและหน้าจอเกม',
      description_en: 'Modifications are strictly UI/web-based. Zero disruption to active bot loops and game clients.',
      actionLabel: 'Hot-Reload UI ทันที',
      actionLabel_th: 'Hot-Reload UI ทันที',
      actionLabel_en: 'Hot-Reload UI Now',
      hasDependencyChanges: false,
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
        let commitCount = 0;
        let commitsList = [];
        if (hasUpdate) {
          const logOutput = await this.runCommand(`git log --pretty=format:"%h|||%s" ${localHash}..${remoteHash}`);
          commitsList = logOutput.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
            const [sha, ...rest] = line.split('|||');
            return { sha, message: rest.join('|||') };
          });
          commitCount = commitsList.length;
          commitMessage = commitCount > 1 
            ? `${commitCount} commits:\n` + commitsList.map(c => `• ${c.sha}: ${c.message}`).join('\n')
            : (commitsList[0] ? commitsList[0].message : await this.runCommand('git log -1 --pretty=%B @{u}'));

          const diffOutput = await this.runCommand(`git diff --name-only ${localHash} ${remoteHash}`);
          changedFiles = diffOutput.split('\n').map(s => s.trim()).filter(Boolean);
        }

        const impact = await this.analyzeImpact(changedFiles);

        return {
          hasUpdate,
          localHash: localHash.slice(0, 7),
          remoteHash: remoteHash.slice(0, 7),
          commitMessage: commitMessage.trim(),
          commitsList,
          commitCount,
          changedFiles,
          impact
        };
      } catch (gitErr) {
        // Fallback to GitHub API below if git command fails
      }
    }

    // 2. Direct GitHub API Check (Works on installed versions & PC without Git)
    try {
      const localInfo = this.getLocalVersion();
      const diffInfo = await this.fetchGitHubDiff(localInfo.commit);
      const impact = await this.analyzeImpact(diffInfo.changedFiles);

      return {
        hasUpdate: diffInfo.hasUpdate,
        localHash: localInfo.commit,
        remoteHash: diffInfo.remoteHash,
        commitMessage: diffInfo.commitMessage,
        commitsList: diffInfo.commitsList || [],
        commitCount: diffInfo.commitCount || 0,
        changedFiles: diffInfo.changedFiles || [],
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
        const impact = await this.analyzeImpact(changedFiles);

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

      // Fetch remote commit/diff info for all changed files across intermediate commits
      const localInfo = this.getLocalVersion();
      let diffInfo;
      try {
        diffInfo = await this.fetchGitHubDiff(localInfo.commit);
      } catch (e) {
        diffInfo = await this.fetchGitHubCommit();
      }
      const changedFiles = diffInfo.changedFiles || [];
      const impact = await this.analyzeImpact(changedFiles);

      this.cachedExtractInfo = {
        hasGit: false,
        extractedRoot,
        tempZipPath,
        tempExtractDir,
        remoteInfo: {
          sha: diffInfo.remoteSha || diffInfo.sha || 'main',
          shortSha: diffInfo.remoteHash || diffInfo.shortSha || 'main',
          message: diffInfo.commitMessage || diffInfo.message || 'Latest release update',
          changedFiles: changedFiles
        },
        impact
      };

      this.isDownloaded = true;
      this.isUpdating = false;
      return { 
        success: true, 
        impact, 
        changedFiles, 
        remoteHash: diffInfo.remoteHash || diffInfo.shortSha || 'main',
        commitsList: diffInfo.commitsList || [],
        commitCount: diffInfo.commitCount || 0
      };
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
        const npmRunner = this.findNpmRunner();
        try { 
          if (typeof onProgressCallback === 'function') onProgressCallback('📦 Checking dependencies...');
          await this.runCommand(`${npmRunner.command} install --omit=dev --no-audit --no-fund --ignore-scripts`); 
        } catch (e) {}

        const newHash = await this.runCommand('git rev-parse HEAD');
        this.saveLocalVersion(newHash);

        const impact = this.cachedExtractInfo ? this.cachedExtractInfo.impact : await this.analyzeImpact([]);
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

      // If dependencies changed, run npm install using bundled runtime npm or system npm
      if (impact && impact.hasDependencyChanges) {
        try {
          if (typeof onProgressCallback === 'function') onProgressCallback('📦 กำลังติดตั้งโมดูลและ Library ใหม่อัตโนมัติ...');
          const npmRunner = this.findNpmRunner();
          await this.runCommand(`${npmRunner.command} install --omit=dev --no-audit --no-fund --ignore-scripts`);
          if (typeof onProgressCallback === 'function') onProgressCallback('✅ ติดตั้ง Library ใหม่สำเร็จเรียบร้อย!');
        } catch (npmErr) {
          console.warn('[Updater] npm install error:', npmErr.message);
          if (typeof onProgressCallback === 'function') onProgressCallback(`⚠️ ติดตั้งโมดูลบางส่วนไม่สำเร็จ: ${npmErr.message}`);
        }
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
