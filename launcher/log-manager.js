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

  initDailyLogFile() {
    const today = this.getTodayDateString();
    if (today !== this.currentDateStr || !this.currentLogFilePath) {
      this.currentDateStr = today;
      this.currentLogDir = path.join(this.baseDir, today);

      if (!fs.existsSync(this.currentLogDir)) {
        fs.mkdirSync(this.currentLogDir, { recursive: true });
      }

      const timeTag = new Date().toTimeString().split(' ')[0].replace(/:/g, '');
      this.currentLogFilePath = path.join(this.currentLogDir, `launcher_${timeTag}.log`);
      
      const timestamp = `[${this.getTimeString()}]`;
      fs.appendFileSync(this.currentLogFilePath, `${timestamp} === NodeHotkey Launcher Session Started at ${new Date().toLocaleString()} ===\n`, 'utf8');
    }
  }

  writeLine(text) {
    this.initDailyLogFile();
    const timestamp = `[${this.getTimeString()}]`;
    const cleanText = text.replace(/\x1b\[[0-9;]*m/g, ''); // strip ANSI codes for plain file
    try {
      fs.appendFileSync(this.currentLogFilePath, `${timestamp} ${cleanText}\n`, 'utf8');
    } catch (e) {}
  }

  getLogDirectory() {
    this.initDailyLogFile();
    return this.currentLogDir;
  }

  getLogFilePath() {
    return this.currentLogFilePath;
  }
}

module.exports = LogManager;
