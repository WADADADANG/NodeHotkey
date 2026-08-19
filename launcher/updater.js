const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

const GITHUB_REPO = 'WADADADANG/NodeHotkey';

class SystemUpdater {
  constructor(projectDir) {
    this.projectDir = projectDir || path.join(__dirname, '..');
    this.isUpdating = false;
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
              resolve({
                sha: json.sha,
                shortSha: json.sha.slice(0, 7),
                message: json.commit && json.commit.message ? json.commit.message.trim() : 'Latest release update'
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
        if (hasUpdate) {
          commitMessage = await this.runCommand('git log -1 --pretty=%B @{u}');
        }

        return {
          hasUpdate,
          localHash: localHash.slice(0, 7),
          remoteHash: remoteHash.slice(0, 7),
          commitMessage: commitMessage.trim()
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

      return {
        hasUpdate,
        localHash: localInfo.commit,
        remoteHash: remoteInfo.shortSha,
        commitMessage: remoteInfo.message
      };
    } catch (apiErr) {
      return {
        error: `ไม่สามารถตรวจสอบอัปเดตได้: ${apiErr.message} (กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต)`
      };
    }
  }

  downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      const req = https.get(url, { headers: { 'User-Agent': 'NodeHotkey-Launcher-Updater' } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          return this.downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve());
        });
      });
      req.on('error', (err) => {
        try { fs.unlinkSync(dest); } catch (e) {}
        reject(err);
      });
    });
  }

  async performUpdate(onProgressCallback) {
    if (this.isUpdating) throw new Error('Update is already in progress');
    this.isUpdating = true;
    this.hasGitRepo = fs.existsSync(path.join(this.projectDir, '.git'));

    try {
      // 1. If Git is present, use git pull
      if (this.hasGitRepo) {
        if (typeof onProgressCallback === 'function') onProgressCallback('📥 Pulling latest updates from Git...');
        const pullResult = await this.runCommand('git pull');

        if (typeof onProgressCallback === 'function') onProgressCallback('📦 Checking dependencies...');
        try { await this.runCommand('npm install --ignore-scripts'); } catch (e) {}

        const newHash = await this.runCommand('git rev-parse HEAD');
        this.saveLocalVersion(newHash);

        this.isUpdating = false;
        return { success: true, details: pullResult };
      }

      // 2. Standalone ZIP Updater (No Git Required)
      if (typeof onProgressCallback === 'function') onProgressCallback('📥 Downloading latest update package from GitHub...');
      const zipUrl = `https://github.com/${GITHUB_REPO}/archive/refs/heads/main.zip`;
      const tempZipPath = path.join(this.projectDir, 'temp_update.zip');
      const tempExtractDir = path.join(this.projectDir, 'temp_update_extracted');

      await this.downloadFile(zipUrl, tempZipPath);

      if (typeof onProgressCallback === 'function') onProgressCallback('📦 Extracting update files...');
      // Use Windows PowerShell Expand-Archive built-in
      await this.runCommand(`powershell -Command "Expand-Archive -Path '${tempZipPath}' -DestinationPath '${tempExtractDir}' -Force"`);

      const extractedRoot = path.join(tempExtractDir, 'NodeHotkey-main');
      if (fs.existsSync(extractedRoot)) {
        if (typeof onProgressCallback === 'function') onProgressCallback('🔄 Updating application files...');
        
        // Copy files excluding user configs and local settings
        const copyRecursive = (src, dest) => {
          if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
          const items = fs.readdirSync(src, { withFileTypes: true });
          for (const item of items) {
            const srcPath = path.join(src, item.name);
            const destPath = path.join(dest, item.name);

            // Preserve user configs and runtime
            if (item.name === 'configs' || item.name === 'profiles' || item.name === 'logs' || item.name === 'runtime' || item.name === 'node_modules') {
              continue;
            }

            if (item.isDirectory()) {
              copyRecursive(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        };

        copyRecursive(extractedRoot, this.projectDir);
      }

      // Cleanup
      try {
        fs.unlinkSync(tempZipPath);
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      } catch (e) {}

      // Update version.json to remote commit
      const remoteInfo = await this.fetchGitHubCommit();
      this.saveLocalVersion(remoteInfo.sha);

      if (typeof onProgressCallback === 'function') onProgressCallback('✅ All files updated successfully!');
      this.isUpdating = false;
      return { success: true };
    } catch (err) {
      this.isUpdating = false;
      throw err;
    }
  }
}

module.exports = SystemUpdater;
