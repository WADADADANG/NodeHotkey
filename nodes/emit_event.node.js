/**
 * nodes/emit_event.node.js
 * Action Node: Emit Event (Custom Event Bus)
 * 
 * Broadcasts a custom event across the NodeHotkey event bus, triggering
 * any listener nodes configured to listen for this event name.
 */

module.exports = {
  type: 'emit_event',
  aliases: ['send_event'],
  title: 'Emit Event',
  category: 'Logic & Flow',
  icon: '📡',
  color: '#8b5cf6',
  inputs: ['in'],
  outputs: ['onFired'],
  defaultData: {
    eventName: 'party_heal'
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);
    if (typeof global.runEmitEventAction === 'function') {
      await global.runEmitEventAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Emit Event Node] "${action.name}": global.runEmitEventAction not found.`);
    return false;
  }
};
