/**
 * nodes/forwarder.node.js
 * Action Node: Key Forwarder (Multi-Client Forwarder)
 * 
 * Forwards a key press across one or more target game clients.
 * Emits 'onComplete' signal when finished.
 */

module.exports = {
  type: 'forwarder',
  aliases: ['forward'],
  title: 'Key Forwarder',
  category: 'Logic & Flow',
  icon: '🔗',
  color: '#64748b',
  inputs: ['in'],
  outputs: ['onComplete'],
  defaultData: {
    targetClient: '1',
    targetKey: '1'
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    // Ensure action has keys formatted for single_press runner
    const act = {
      ...action,
      keys: (action.keys && action.keys.length > 0) ? action.keys : (action.targetKey ? [action.targetKey] : ['1'])
    };

    if (typeof global.runSinglePressAction === 'function') {
      await global.runSinglePressAction(act, stack);
      return true;
    }

    console.warn(`⚠️ [Forwarder Node] "${action.name}": global.runSinglePressAction not found.`);
    return false;
  }
};
