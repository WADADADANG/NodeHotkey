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
  icon: 'share-2',
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

    // Resolve key from targetKey first (set in Forwarder inspector), then fallback to keys[0], then '1'
    const keyToForward = action.targetKey || (Array.isArray(action.keys) && action.keys.length > 0 ? action.keys[0] : '1');

    // Ensure action has keys formatted for single_press runner
    const act = {
      ...action,
      targetKey: keyToForward,
      keys: [keyToForward]
    };

    if (typeof global.runSinglePressAction === 'function') {
      await global.runSinglePressAction(act, stack);
      return true;
    }

    console.warn(`⚠️ [Forwarder Node] "${action.name}": global.runSinglePressAction not found.`);
    return false;
  }
};
