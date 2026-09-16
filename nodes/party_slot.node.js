/**
 * nodes/party_slot.node.js
 * Action Node: Party Slot Selector (Direct Slot Targeter)
 * 
 * Targets a specific party member slot directly (e.g. Slot 1 for party leader).
 * Emits 'onSelected' on successful selection and 'onError' if the slot is empty or dead.
 */

module.exports = {
  type: 'party_slot',
  aliases: ['select_party_slot', 'party_member'],
  title: 'Party Slot Selector',
  category: 'Vision & Party',
  icon: '🎯',
  color: '#38bdf8',
  inputs: ['in'],
  outputs: ['onSelected', 'onError'],
  defaultData: {
    targetClient: '1',
    targetSlot: 1,
    delayAfterClick: 80,
    showOverlay: true
  },
  schema: [
    { key: 'targetClient', component: 'client_selector', labelKey: 'inspector_target_clients', label: 'Target Client Screen (Vision)' },
    {
      key: 'targetSlot', component: 'select', labelKey: 'inspector_target_slot', label: 'Target Party Member Slot',
      options: [
        { value: 1, labelKey: 'slot_leader_desc', label: 'Slot 1 (Party Leader)' },
        { value: 2, label: 'Slot 2' },
        { value: 3, label: 'Slot 3' },
        { value: 4, label: 'Slot 4' },
        { value: 5, label: 'Slot 5' },
        { value: 6, label: 'Slot 6' },
        { value: 7, label: 'Slot 7' },
        { value: 8, label: 'Slot 8' }
      ]
    },
    { key: 'delayAfterClick', component: 'number_input', labelKey: 'inspector_party_delay_click', label: 'Delay After Click (ms)', min: 0, max: 2000, step: 20 },
    { key: 'showOverlay', component: 'toggle', labelKey: 'inspector_party_show_overlay', label: 'Visual Overlay', icon: '👁️', color: '#06b6d4' }
  ],
  summaryFields: [
    { key: 'targetClient', label: 'Target', format: 'Client {value}' },
    { key: 'targetSlot', label: 'Slot', format: 'Slot {value}' },
    { key: 'showOverlay', label: 'Overlay', format: 'boolean_on_off' }
  ],

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    if (typeof global.runSelectPartySlotAction === 'function') {
      await global.runSelectPartySlotAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Party Slot Node] "${action.name}": global.runSelectPartySlotAction not found.`);
    return false;
  }
};
