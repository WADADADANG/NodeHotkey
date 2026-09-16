/**
 * nodes/party_buff.node.js
 * Action Node: Party Buff (Round-Robin Party Buffing)
 * 
 * Iterates through active party members sequentially to target them for buffing.
 * Uses slot-order anchoring to ensure each party member is buffed once.
 * Emits 'onNextMember' for each member, 'onComplete' when all members are buffed, and 'onError' on failure.
 */

module.exports = {
  type: 'party_buff',
  aliases: ['buff_party', 'party_buff_cycle'],
  title: 'Party Buff',
  category: 'Vision & Party',
  icon: '🛡️',
  color: '#14b8a6',
  inputs: ['in'],
  outputs: ['onNextMember', 'onComplete', 'onError'],
  dataOutputs: [
    { name: 'name_out', type: 'string', label: 'Member Name' },
    { name: 'slot_out', type: 'number', label: 'Slot Number' },
    { name: 'info_out', type: 'string', label: 'Summary' }
  ],
  defaultData: {
    targetClient: '1',
    scanRegion: 'auto',
    delayAfterClick: 80,
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
    { key: 'delayAfterClick', component: 'number_input', labelKey: 'inspector_party_delay_click', label: 'Delay After Click (ms)', min: 0, max: 2000, step: 20 },
    { key: 'showOverlay', component: 'toggle', labelKey: 'inspector_party_show_overlay', label: 'Visual Overlay', icon: '👁️', color: '#06b6d4' },
    {
      key: 'readNames', component: 'toggle', labelKey: 'inspector_party_read_names', label: 'Read Member Names (OCR - High CPU)', icon: '🔤', color: '#38bdf8',
      hintKey: 'inspector_party_read_names_buff_hint',
      hint: 'Tip: If Party Scanner is running, names are inherited automatically without OCR.'
    }
  ],
  summaryFields: [
    { key: 'targetClient', label: 'Target', format: 'Client {value}' },
    { key: 'delayAfterClick', label: 'Delay', format: '{value}ms' },
    { key: 'showOverlay', label: 'Overlay', format: 'boolean_on_off' }
  ],

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    if (typeof global.runPartyBuffAction === 'function') {
      await global.runPartyBuffAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Party Buff Node] "${action.name}": global.runPartyBuffAction not found.`);
    return false;
  }
};
