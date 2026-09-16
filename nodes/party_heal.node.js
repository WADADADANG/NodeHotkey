/**
 * nodes/party_heal.node.js
 * Action Node: Party Heal Priority (Auto Heal Target Selector)
 * 
 * Evaluates scanned party members' HP and targets the member with lowest HP below threshold.
 * Emits 'onTargetSelected' when an injured member is targeted, 'onAllHealthy' if no one needs heals, and 'onError' on failure.
 */

module.exports = {
  type: 'party_heal',
  aliases: ['heal_party', 'auto_heal'],
  title: 'Party Heal',
  category: 'Vision & Party',
  icon: '💚',
  color: '#22c55e',
  inputs: ['in'],
  outputs: ['onTargetSelected', 'onAllHealthy', 'onError'],
  defaultData: {
    targetClient: '1',
    scanRegion: 'auto',
    lowHpThreshold: 70,
    delayAfterClick: 80,
    showOverlay: true
  },
  schema: [
    { key: 'targetClient', component: 'client_selector', labelKey: 'inspector_target_clients', label: 'Target Client Screen (Vision)' },
    { key: 'lowHpThreshold', component: 'slider', labelKey: 'inspector_party_low_hp', label: 'Low HP Threshold (%)', min: 10, max: 95, step: 5, unit: '%' },
    { key: 'delayAfterClick', component: 'number_input', labelKey: 'inspector_party_delay_click', label: 'Delay After Click (ms)', min: 0, max: 2000, step: 20 },
    { key: 'showOverlay', component: 'toggle', labelKey: 'inspector_party_show_overlay', label: 'Visual Overlay', icon: '👁️', color: '#06b6d4' }
  ],
  summaryFields: [
    { key: 'targetClient', label: 'Target', format: 'Client {value}' },
    { key: 'lowHpThreshold', label: 'Heal HP', format: '<= {value}%' },
    { key: 'showOverlay', label: 'Overlay', format: 'boolean_on_off' }
  ],

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    if (typeof global.runPartyHealAction === 'function') {
      await global.runPartyHealAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Party Heal Node] "${action.name}": global.runPartyHealAction not found.`);
    return false;
  }
};
