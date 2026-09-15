/**
 * nodes/screenshot.node.js
 * Action Node: Screenshot (Diagnostic Tool)
 * 
 * Captures zero-flicker native compositor viewport stream with optional
 * vision bounding-box diagnostics, and saves as timestamped JPEG.
 */

const fs = require('fs');
const path = require('path');
const visionService = require('../vision-service');

module.exports = {
  type: 'screenshot',
  aliases: ['capture_screen'],
  title: 'Screenshot (Diagnostic)',
  category: 'Utility / Vision',
  icon: '📸',
  color: '#06b6d4',
  inputs: ['in'],
  outputs: ['onComplete', 'onError'],
  defaultData: {
    targetClient: '1',
    captureRegion: 'full',
    annotate: true,
    prefix: 'error_snap',
    subfolder: 'client_1'
  },

  /**
   * Execution logic for Screenshot Node
   */
  async execute(context, action, callStack = []) {
    const targetClientId = String(action.targetClient || '1');
    const region = action.captureRegion || 'full';
    const annotate = action.annotate !== undefined ? !!action.annotate : true;
    const prefix = action.prefix || 'snap';
    const rawSubfolder = (action.subfolder !== undefined && action.subfolder !== '') 
      ? action.subfolder 
      : (action.folder || `client_${targetClientId}`);
    const subfolder = String(rawSubfolder).trim().replace(/[\\/:*?"<>|]/g, '_');

    try {
      const dir = path.join(process.cwd(), 'screenshots', subfolder);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const buffer = await visionService.captureScreenshot(targetClientId, {
        region,
        annotate,
        customRect: action.customRect
      });

      if (!buffer) {
        console.warn(`[Screenshot Node] Client ${targetClientId}: Failed to capture screenshot.`);
        if (typeof global.fireChain === 'function') {
          await global.fireChain(action, 'onError', callStack);
        }
        return false;
      }

      const now = new Date();
      const pad = n => String(n).padStart(2, '0');
      const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `screenshot_c${targetClientId}_${prefix}_${timestamp}.jpg`;
      const filepath = path.join(dir, filename);
      fs.writeFileSync(filepath, buffer);

      console.log(`[Screenshot Node] Client ${targetClientId}: Saved screenshot (${region}) -> ./screenshots/${subfolder}/${filename}`);

      if (typeof global.fireChain === 'function') {
        await global.fireChain(action, 'onComplete', callStack);
      }
      return true;
    } catch (err) {
      console.error(`[Screenshot Node] Error taking screenshot:`, err.message);
      if (typeof global.fireChain === 'function') {
        await global.fireChain(action, 'onError', callStack);
      }
      return false;
    }
  }
};
