/**
 * nodes/control.node.js
 * Action Node: Action Controller
 * 
 * Controls other actions/nodes in the graph (start, stop, toggle).
 * Compatible with loops, key holds, cast sequencers, schedulers, etc.
 * Emits 'onComplete' signal after controlling target actions.
 */

module.exports = {
  type: 'control',
  aliases: ['action_control'],
  title: 'Action Controller',
  category: 'Logic & Flow',
  icon: '🎮',
  color: '#f97316',
  inputs: ['in'],
  outputs: ['onComplete'],
  defaultData: {
    controlOperation: 'toggle', // 'toggle' | 'start' | 'stop'
    controlTargetIds: []
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);
    if (typeof global.runActionControl === 'function') {
      await global.runActionControl(action, stack);
      return true;
    }

    console.warn(`⚠️ [Control Node] "${action.name}": global.runActionControl not found.`);
    return false;
  }
};
