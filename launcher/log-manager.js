const fs = require('fs');
const path = require('path');

class LogManager {
  constructor(baseDir) {
    this.baseDir = baseDir || path.join(__dirname, '..', 'logs');
    this.currentDateStr = '';
    this.currentLogDir = '';
    this.currentLogFilePath = '';
    this.writeStream = null;
    this.initDailyLogFile();
  }

  getTodayDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getTimeString() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  initDailyLogFile(force = false) {
    const today = this.getTodayDateString();
    const needsNewFile = force ||
      today !== this.currentDateStr ||
      !this.currentLogFilePath ||
      !fs.existsSync(this.currentLogDir) ||
      !fs.existsSync(this.currentLogFilePath);

    if (needsNewFile) {
      this.currentDateStr = today;
      this.currentLogDir = path.join(this.baseDir, today);

      try {
        if (!fs.existsSync(this.currentLogDir)) {
          fs.mkdirSync(this.currentLogDir, { recursive: true });
        }

        const timeTag = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
        let newFilePath = path.join(this.currentLogDir, `launcher_${timeTag}.log`);
        if (fs.existsSync(newFilePath)) {
          const ms = String(Date.now()).slice(-4);
          newFilePath = path.join(this.currentLogDir, `launcher_${timeTag}_${ms}.log`);
        }
        this.currentLogFilePath = newFilePath;

        const timestamp = `[${this.getTimeString()}]`;
        fs.appendFileSync(
          this.currentLogFilePath,
          `${timestamp} === NodeHotkey Launcher Session Started at ${new Date().toLocaleString()} ===\n`,
          'utf8'
        );
      } catch (err) {
        console.error('[LogManager] Error creating log directory or file:', err.message);
      }
    }
  }

  writeLine(text) {
    this.initDailyLogFile();
    const timestamp = `[${this.getTimeString()}]`;
    const cleanText = text.replace(/\x1b\[[0-9;]*m/g, ''); // strip ANSI codes for plain file
    try {
      fs.appendFileSync(this.currentLogFilePath, `${timestamp} ${cleanText}\n`, 'utf8');
    } catch (e) {
      // If writing failed (e.g. folder or file was deleted mid-session), force recreate and retry write
      try {
        this.initDailyLogFile(true);
        fs.appendFileSync(this.currentLogFilePath, `${timestamp} ${cleanText}\n`, 'utf8');
      } catch (retryErr) {
        console.error('[LogManager] Error writing log file after retry:', retryErr.message);
      }
    }
  }

  getLogDirectory() {
    this.initDailyLogFile();
    return this.currentLogDir;
  }

  getLogFilePath() {
    this.initDailyLogFile();
    return this.currentLogFilePath;
  }
}

module.exports = LogManager;
