/**
 * nodes/party_scanner.node.js
 * Action Node: Party Scanner (Vision Scanner)
 * 
 * Performs real-time computer vision scan of party bars and member status.
 * Updates central party cache without clicking the mouse.
 * Emits 'onScanned' on success and 'onError' if party is not detected or client is unavailable.
 */

module.exports = {
  type: 'party_scanner',
  aliases: ['scan_party', 'scanner'],
  title: 'Party Scanner',
  category: 'Vision & Party',
  icon: '👁️',
  color: '#0ea5e9',
  inputs: ['in'],
  outputs: ['onScanned', 'onError'],
  dataOutputs: [
    { name: 'names_out', type: 'string', label: 'Member Names' },
    { name: 'count_out', type: 'number', label: 'Member Count' },
    { name: 'info_out', type: 'string', label: 'Party Summary' }
  ],
  defaultData: {
    targetClient: '1',
    scanRegion: 'auto',
    scanIntervalMs: 250,
    lowHpThreshold: 70,
    readNames: false,
    showOverlay: true
  },
  schema: [
    { key: 'targetClient', component: 'client_selector', labelKey: 'inspector_target_clients', label: 'Target Client Screen (Vision)' },
    {
      key: 'scanRegion', component: 'select', labelKey: 'inspector_party_scan_region', label: 'Party Window Position',
      options: [
        { value: 'auto', labelKey: 'region_auto', label: '🔍 Auto (Detect Left/Right)' },
        { value: 'right', labelKey: 'region_right', label: '👉 Right Half' },
        { value: 'left', labelKey: 'region_left', label: '👈 Left Half' },
        { value: 'full', labelKey: 'region_full', label: '🖥️ Full Screen' }
      ]
    },
    { key: 'scanIntervalMs', component: 'number_input', labelKey: 'inspector_party_scan_interval', label: 'Scan Interval (ms)', min: 50, max: 2000, step: 25 },
    { key: 'lowHpThreshold', component: 'slider', labelKey: 'inspector_party_low_hp', label: 'Low HP Alert Threshold (%)', min: 10, max: 95, step: 5, unit: '%' },
    { key: 'showOverlay', component: 'toggle', labelKey: 'inspector_party_show_overlay', label: 'Visual Overlay', icon: '👁️', color: '#06b6d4' },
    {
      key: 'readNames', component: 'toggle', labelKey: 'inspector_party_read_names', label: 'Read Member Names (OCR - High CPU)', icon: '🔤', color: '#38bdf8',
      hintKey: 'inspector_party_read_names_scanner_hint',
      hint: 'Tip: Leave disabled for real-time HP healing loops to save CPU. Enable only if needed for TTS or Webhook.'
    }
  ],
  summaryFields: [
    { key: 'targetClient', label: 'Target', format: 'Client {value}' },
    { key: 'scanIntervalMs', label: 'Interval', format: '{value}ms' },
    { key: 'lowHpThreshold', label: 'Alert HP', format: '<= {value}%' },
    { key: 'showOverlay', label: 'Overlay', format: 'boolean_on_off' }
  ],

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    if (typeof global.runPartyScannerAction === 'function') {
      await global.runPartyScannerAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Party Scanner Node] "${action.name}": global.runPartyScannerAction not found.`);
    return false;
  }
};
