/**
 * nodes/variable.node.js
 * Action Node: Set Variable (Unreal Engine Blueprint Impure Node)
 * 
 * Sets or modifies runtime state variables (boolean, number, string).
 * Supports execution flow ('in' ➔ 'onComplete') and data pins ('val_in', 'val_out').
 * Operations: set_value, increment, decrement, toggle, reset.
 */

module.exports = {
  type: 'var_set',
  aliases: ['variable', 'var', 'state', 'set_var', 'variable_set'],
  title: 'Set Variable',
  category: 'Logic & Flow',
  icon: '📦',
  color: '#a855f7',
  inputs: ['in', 'val_in'],
  outputs: ['onComplete', 'val_out'],
  defaultData: {
    varName: 'my_var',
    varType: 'boolean', // 'boolean' | 'number' | 'string'
    scope: 'client',    // 'client' | 'global'
    targetClient: '1',
    initialValue: 'false',
    operation: 'set_value', // 'set_value' | 'increment' | 'decrement' | 'toggle' | 'reset'
    opValue: '1'
  },

  async execute(context, action, callStack = []) {
    if (global.isSuspended) return false;

    if (typeof global.runVariableAction === 'function') {
      await global.runVariableAction(action, callStack);
      return true;
    }

    console.warn(`⚠️ [Set Variable Node] "${action.name}": global.runVariableAction not found.`);
    return false;
  }
};
