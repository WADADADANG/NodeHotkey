const fs = require('fs');
const path = require('path');

class LogManager {
  constructor(baseDir) {
    this.baseDir = baseDir || path.join(__dirname, '..', 'logs');
    this.currentDateStr = '';
    this.currentLogDir = '';
    this.currentLogFilePath = '';
    this.writeStream = null;
    this.buffer = [];
    this.flushTimer = null;
    this.FLUSH_INTERVAL_MS = 250;
    this.MAX_BUFFER_LINES = 100;

    this.initDailyLogFile();

    // Ensure buffered logs are flushed on process exit
    const exitHandler = () => this.flushSync();
    process.once('beforeExit', exitHandler);
    process.once('exit', exitHandler);
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
      !this.writeStream ||
      this.writeStream.destroyed;

    if (needsNewFile) {
      this.flushSync();

      if (this.writeStream && !this.writeStream.destroyed) {
        try { this.writeStream.end(); } catch (e) {}
        this.writeStream = null;
      }

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

        // Open high-speed append stream
        this.writeStream = fs.createWriteStream(this.currentLogFilePath, {
          flags: 'a',
          encoding: 'utf8',
          highWaterMark: 64 * 1024
        });

        this.writeStream.on('error', (err) => {
          console.error('[LogManager] WriteStream error:', err.message);
          this.writeStream = null;
        });

        const timestamp = `[${this.getTimeString()}]`;
        this.writeStream.write(
          `${timestamp} === NodeHotkey Launcher Session Started at ${new Date().toLocaleString()} ===\n`
        );
      } catch (err) {
        console.error('[LogManager] Error creating log directory or stream:', err.message);
      }
    }
  }

  writeLine(text) {
    const today = this.getTodayDateString();
    if (today !== this.currentDateStr || !this.writeStream || this.writeStream.destroyed) {
      this.initDailyLogFile();
    }

    const timestamp = `[${this.getTimeString()}]`;
    const cleanText = text.replace(/\x1b\[[0-9;]*m/g, ''); // strip ANSI codes for plain file
    this.buffer.push(`${timestamp} ${cleanText}\n`);

    if (this.buffer.length >= this.MAX_BUFFER_LINES) {
      this.flush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, this.FLUSH_INTERVAL_MS);
    }
  }

  flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) return;

    const chunk = this.buffer.join('');
    this.buffer = [];

    if (this.writeStream && !this.writeStream.destroyed) {
      try {
        this.writeStream.write(chunk);
      } catch (e) {
        // Fallback to synchronous append if stream write fails
        try {
          fs.appendFileSync(this.currentLogFilePath, chunk, 'utf8');
        } catch (syncErr) {
          console.error('[LogManager] Error during flush write:', syncErr.message);
        }
      }
    } else {
      // Re-initialize and write
      try {
        this.initDailyLogFile(true);
        if (this.writeStream && !this.writeStream.destroyed) {
          this.writeStream.write(chunk);
        }
      } catch (e) {}
    }
  }

  flushSync() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) return;

    const chunk = this.buffer.join('');
    this.buffer = [];

    if (this.currentLogFilePath) {
      try {
        fs.appendFileSync(this.currentLogFilePath, chunk, 'utf8');
      } catch (err) {
        console.error('[LogManager] Error in flushSync:', err.message);
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
