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
  schema: [
    { key: 'targetClient', component: 'client_selector', labelKey: 'inspector_target_clients', label: 'Target Client Screen' },
    {
      key: 'captureRegion', component: 'select', labelKey: 'inspector_screenshot_region', label: 'Capture Area',
      options: [
        { value: 'full', labelKey: 'region_full', label: '🖥️ Full Viewport' },
        { value: 'party', labelKey: 'region_party', label: '👥 Party Area' },
        { value: 'right', labelKey: 'region_right', label: '👉 Right Half' },
        { value: 'left', labelKey: 'region_left', label: '👈 Left Half' }
      ]
    },
    { key: 'subfolder', component: 'text_input', labelKey: 'inspector_screenshot_folder', label: 'Storage Subfolder', placeholder: 'client_1' },
    { key: 'prefix', component: 'text_input', labelKey: 'inspector_screenshot_prefix', label: 'File Prefix', placeholder: 'error_snap' },
    { key: 'annotate', component: 'toggle', labelKey: 'inspector_screenshot_annotate', label: 'Draw Detection Overlays & Timestamps', default: true }
  ],
  summaryFields: [
    { key: 'targetClient', label: 'Target', format: 'Client {value}' },
    { key: 'captureRegion', label: 'Region', format: '{value}' },
    { key: 'prefix', label: 'Prefix', format: '{value}' }
  ],

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
