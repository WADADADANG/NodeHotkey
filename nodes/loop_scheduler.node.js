/**
 * nodes/loop_scheduler.node.js
 * Action Node: Loop Scheduler (Multi-Timer Dispatcher)
 * 
 * Manages multiple concurrent interval timers with anti-collision queueing.
 * Dispatches signals dynamically to 'item_0', 'item_1', etc.
 * Emits 'onStop' when stopped.
 */

module.exports = {
  type: 'loop_scheduler',
  aliases: ['scheduler'],
  title: 'Loop Scheduler',
  category: 'Loops & Automation',
  icon: '⏱️',
  color: '#6366f1',
  inputs: ['in'],
  outputs: ['item_0', 'item_1', 'item_2', 'item_3', 'item_4', 'onStop'],
  defaultData: {
    collisionGuardMs: 800,
    items: []
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    const state = global.activeSchedulerStates && global.activeSchedulerStates[action.id];
    if (state && state.running) {
      if (typeof global.stopLoopSchedulerAction === 'function') {
        global.stopLoopSchedulerAction(action.id, action.name);
        return true;
      }
    } else {
      if (typeof global.startLoopSchedulerAction === 'function') {
        await global.startLoopSchedulerAction(action, stack);
        return true;
      }
    }

    console.warn(`⚠️ [Loop Scheduler Node] "${action.name}": global.startLoopSchedulerAction / stopLoopSchedulerAction not found.`);
    return false;
  }
};
