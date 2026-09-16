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
