/**
 * nodes/branch.node.js
 * Action Node: Action Branch (Action Status Condition)
 * 
 * Evaluates live running state of other action nodes:
 * - is_running / is_stopped / on_cooldown / is_ready
 * Routes execution flow dynamically to 'onTrue' or 'onFalse' port.
 */

module.exports = {
  type: 'action_branch',
  aliases: ['branch', 'condition', 'action_condition'],
  title: 'Action Branch',
  category: 'Logic & Flow',
  icon: '⚡',
  color: '#eab308',
  inputs: ['in'],
  outputs: ['onTrue', 'onFalse'],
  defaultData: {
    conditionTargetId: '',
    conditionRule: 'is_running', // 'is_running' | 'is_stopped' | 'on_cooldown' | 'is_ready'
    conditionValue: ''
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);
    if (typeof global.runActionCondition === 'function') {
      await global.runActionCondition(action, stack);
      return true;
    }

    console.warn(`⚠️ [Action Branch Node] "${action.name}": global.runActionCondition not found.`);
    return false;
  }
};
