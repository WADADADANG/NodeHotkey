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
    readNames: false
  },

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
