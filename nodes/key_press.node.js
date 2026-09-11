/**
 * nodes/key_press.node.js
 * Action Node: Key Press (Single Press)
 * 
 * Sends one or more keystrokes once to the target game client(s).
 * Emits 'onComplete' signal when finished.
 */

module.exports = {
  type: 'key_press',
  aliases: ['single_press', 'press'],
  title: 'Key Press',
  category: 'Actions',
  icon: '⌨️',
  color: '#3b82f6',
  inputs: ['in'],
  outputs: ['onComplete'],
  defaultData: {
    targetClient: '1',
    keys: ['1'],
    delayAfter: 0
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    if (typeof global.runSinglePressAction === 'function') {
      await global.runSinglePressAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Key Press Node] "${action.name}": global.runSinglePressAction not found.`);
    return false;
  }
};
