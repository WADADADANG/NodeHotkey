/**
 * nodes/variable.node.js
 * Action Node: Variable / State Management
 * 
 * Manages runtime state variables (boolean, number, string) per-client or globally.
 * Supports operations: toggle, set_true, set_false, set_value, increment, decrement, reset.
 * Emits 'onComplete' signal when variable operation finishes.
 */

module.exports = {
  type: 'variable',
  aliases: ['var', 'state'],
  title: 'Variable / State',
  category: 'Logic & Flow',
  icon: '📦',
  color: '#a855f7',
  inputs: ['in'],
  outputs: ['onComplete'],
  defaultData: {
    varType: 'boolean', // 'boolean' | 'number' | 'string'
    scope: 'client',    // 'client' | 'global'
    targetClient: '1',
    initialValue: 'false',
    operation: 'toggle', // 'toggle' | 'set_true' | 'set_false' | 'set_value' | 'increment' | 'decrement' | 'reset'
    opValue: '1'
  },

  async execute(context, action, callStack = []) {
    if (global.isSuspended) return false;

    if (typeof global.runVariableAction === 'function') {
      await global.runVariableAction(action, callStack);
      return true;
    }

    console.warn(`⚠️ [Variable Node] "${action.name}": global.runVariableAction not found.`);
    return false;
  }
};
