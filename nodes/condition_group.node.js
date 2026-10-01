/**
 * nodes/condition_group.node.js
 * Action Node: Condition Group (Multi-Condition Evaluator)
 * 
 * Evaluates multiple conditions (Variables, Action statuses, Client statuses) in one node.
 * Supports logical AND (all must match) and OR (any must match).
 * Routes execution flow dynamically to 'onTrue' or 'onFalse' port.
 */

module.exports = {
  type: 'condition_group',
  aliases: ['multi_condition', 'logic_gate', 'group_condition'],
  title: 'Condition Group',
  category: 'Logic & Flow',
  icon: 'git-merge',
  color: '#8b5cf6',
  inputs: ['in'],
  outputs: ['onTrue', 'onFalse'],
  defaultData: {
    logicMode: 'AND', // 'AND' | 'OR'
    conditions: []
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);
    if (typeof global.runConditionGroupAction === 'function') {
      await global.runConditionGroupAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Condition Group Node] "${action.name}": global.runConditionGroupAction not found.`);
    return false;
  }
};
