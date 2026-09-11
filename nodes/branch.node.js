/**
 * nodes/branch.node.js
 * Action Node: Branch (If / Else Condition)
 * 
 * Evaluates conditions based on:
 * - Target action state (is_running / is_not_running)
 * - Variable values (is_true, is_false, equals, not_equals, greater_than, less_than, etc.)
 * Routes execution flow dynamically to 'onTrue' or 'onFalse' port.
 */

module.exports = {
  type: 'branch',
  aliases: ['condition', 'action_condition'],
  title: 'Branch (If / Else)',
  category: 'Logic & Flow',
  icon: '🔀',
  color: '#eab308',
  inputs: ['in'],
  outputs: ['onTrue', 'onFalse'],
  defaultData: {
    conditionTargetId: '',
    conditionRule: 'is_running', // 'is_running' | 'is_not_running' | 'is_true' | 'is_false' | 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal'
    conditionValue: ''
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);
    if (typeof global.runActionCondition === 'function') {
      await global.runActionCondition(action, stack);
      return true;
    }

    console.warn(`⚠️ [Branch Node] "${action.name}": global.runActionCondition not found.`);
    return false;
  }
};
