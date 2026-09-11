/**
 * nodes/macro_group.node.js
 * Action Node: Macro Combo Group
 * 
 * Executes a granular list of keypress macro steps with precise delay timings.
 * Emits 'onComplete' signal when finished.
 */

module.exports = {
  type: 'macro_group',
  aliases: ['macro'],
  title: 'Macro Combo Group',
  category: 'Actions',
  icon: '🔀',
  color: '#8b5cf6',
  inputs: ['in'],
  outputs: ['onComplete'],
  defaultData: {
    targetClient: '1',
    steps: [],
    repeatCount: 1
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    if (typeof global.runCastSequencerOnce === 'function') {
      await global.runCastSequencerOnce(action, stack);
      return true;
    }

    console.warn(`⚠️ [Macro Group Node] "${action.name}": global.runCastSequencerOnce not found.`);
    return false;
  }
};
