/**
 * nodes/client_check.node.js
 * Action Node: Client Check (Screen Active/Open Check)
 * 
 * Checks whether a specific game client/screen is currently active and attached.
 * Routes execution dynamically:
 * - 'onActive': Fired if the target client window is open and connected.
 * - 'onInactive': Fired if the target client is closed or not attached (allows skipping).
 */

module.exports = {
  type: 'client_check',
  aliases: ['check_client', 'client_status', 'is_client_open', 'is_client_active'],
  title: 'Client Check',
  category: 'Logic & Flow',
  icon: '🖥️',
  color: '#06b6d4',
  inputs: ['in'],
  outputs: ['onActive', 'onInactive'],
  defaultData: {
    targetClient: '1',
    checkRule: 'is_active' // 'is_active' | 'is_inactive'
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);
    if (typeof global.runClientCheckAction === 'function') {
      await global.runClientCheckAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Client Check Node] "${action.name}": global.runClientCheckAction not found.`);
    return false;
  }
};
