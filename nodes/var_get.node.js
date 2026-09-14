/**
 * nodes/var_get.node.js
 * Action Node: Get Variable (Unreal Engine Blueprint Pure Node)
 * 
 * Pure data getter node without execution pins (no 'in' / 'out').
 * Outputs current variable value (String / Number / Boolean) to data output pin ('val_out').
 * Evaluated on-demand when connected nodes execute.
 */

module.exports = {
  type: 'var_get',
  aliases: ['get_var', 'variable_get'],
  title: 'Get Variable',
  category: 'Logic & Flow',
  icon: '🏷️',
  color: '#ec4899',
  isPure: true, // Unreal Blueprint Pure Node flag
  inputs: [],   // No execution pins!
  outputs: ['val_out'], // Data output pin
  defaultData: {
    varName: 'my_var',
    varType: 'string', // 'string' | 'number' | 'boolean'
    scope: 'client',    // 'client' | 'global'
    targetClient: '1',
    defaultValue: ''
  },

  /**
   * Pure value evaluation
   * @param {Object} action - Action node configuration
   * @param {string|number} [clientOverride] - Optional client screen index
   * @returns {*} Current evaluated value of the variable
   */
  getValue(action, clientOverride = null) {
    if (typeof global.getNamedVariableValue === 'function') {
      return global.getNamedVariableValue(action.varName || action.name, action, clientOverride);
    }
    if (typeof global.getVariableValue === 'function') {
      return global.getVariableValue(action, clientOverride);
    }
    return action.defaultValue !== undefined ? action.defaultValue : '';
  },

  async execute(context, action, callStack = []) {
    // Pure nodes do not participate in execution loops directly, but can be safely evaluated
    return this.getValue(action);
  }
};
