const { exec } = require('child_process');
const path = require('path');

class SystemUpdater {
  constructor(projectDir) {
    this.projectDir = projectDir || path.join(__dirname, '..');
    this.isUpdating = false;
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

  async checkForUpdates() {
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
    } catch (err) {
      return {
        error: err.message || 'Cannot check for updates (Git repository not configured or offline).'
      };
    }
  }

  async performUpdate(onProgressCallback) {
    if (this.isUpdating) throw new Error('Update is already in progress');
    this.isUpdating = true;

    try {
      if (typeof onProgressCallback === 'function') onProgressCallback('📥 Pulling latest updates from Git...');
      const pullResult = await this.runCommand('git pull');

      if (typeof onProgressCallback === 'function') onProgressCallback('📦 Checking dependencies...');
      await this.runCommand('npm install --ignore-scripts');

      this.isUpdating = false;
      return { success: true, details: pullResult };
    } catch (err) {
      this.isUpdating = false;
      throw err;
    }
  }
}

module.exports = SystemUpdater;
