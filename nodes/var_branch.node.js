/**
 * nodes/var_branch.node.js
 * Action Node: Variable Branch
 * 
 * Evaluates variables (Boolean is_true/is_false, Number comparison, String equality).
 * Supports Blueprint Variables (e.g. isFullBuffPartyScanner) and canvas variable nodes.
 * Routes execution flow dynamically to 'onTrue' or 'onFalse' port.
 */

module.exports = {
  type: 'var_branch',
  aliases: ['variable_branch', 'var_if', 'variable_if'],
  title: 'Variable Branch',
  category: 'Logic & Flow',
  icon: '📦',
  color: '#ec4899',
  inputs: ['in'],
  outputs: ['onTrue', 'onFalse'],
  defaultData: {
    conditionTargetId: '',
    varName: '',
    varType: 'boolean',
    conditionRule: 'is_true', // 'is_true' | 'is_false' | 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal'
    conditionValue: ''
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);
    if (typeof global.runActionCondition === 'function') {
      await global.runActionCondition(action, stack);
      return true;
    }

    console.warn(`⚠️ [Variable Branch Node] "${action.name}": global.runActionCondition not found.`);
    return false;
  }
};
