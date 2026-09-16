/**
 * nodes/key_hold.node.js
 * Action Node: Key Hold (Toggle Down / Up)
 * 
 * Holds down or releases a specific key indefinitely on the target game client(s).
 * Emits 'onEnable' when held down and 'onDisable' when released.
 */

module.exports = {
  type: 'key_hold',
  aliases: ['hold'],
  title: 'Key Hold',
  category: 'Actions',
  icon: '⚓',
  color: '#0284c7',
  inputs: ['in'],
  outputs: ['onEnable', 'onDisable'],
  defaultData: {
    targetClient: '1',
    targetKey: 'w'
  },
  schema: [
    { key: 'targetClient', component: 'client_selector', labelKey: 'inspector_target_clients', label: 'Target Client Screen' },
    { key: 'targetKey', component: 'key_recorder', labelKey: 'inspector_key_hold_target', label: 'Key to Hold / Release (ปุ่มที่ต้องการกดค้าง)' },
    { key: 'cooldownPresetId', component: 'cooldown_guard' }
  ],
  summaryFields: [
    { key: 'targetClient', label: 'Target', format: 'Client {value}' },
    { key: 'targetKey', label: 'Key', format: 'Hold [{value}]' }
  ],

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    if (typeof global.toggleKeyHoldAction === 'function') {
      await global.toggleKeyHoldAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Key Hold Node] "${action.name}": global.toggleKeyHoldAction not found.`);
    return false;
  }
};
