/**
 * nodes/buff_sequence.node.js
 * Action Node: Buff Sequence
 * 
 * Executes a sequential list of self-buff keystrokes with delay between casts.
 * Emits 'onBeforeStart', 'onStart', 'onAfterStart', and 'onComplete'.
 */

module.exports = {
  type: 'buff_sequence',
  aliases: ['buffs', 'buff_seq'],
  title: 'Buff Sequence',
  category: 'Actions',
  icon: '✨',
  color: '#06b6d4',
  inputs: ['in'],
  outputs: ['onBeforeStart', 'onStart', 'onAfterStart', 'onComplete'],
  defaultData: {
    targetClient: '1',
    keys: ['1', '2', '3'],
    delayBuff: 800,
    delayAfter: 0
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    if (typeof global.runBuffSequenceAction === 'function') {
      await global.runBuffSequenceAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Buff Sequence Node] "${action.name}": global.runBuffSequenceAction not found.`);
    return false;
  }
};
