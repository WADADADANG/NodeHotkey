/**
 * nodes/loop.node.js
 * Action Node: Interval Loop (Key Loop)
 * 
 * Toggles a recurring loop sending keystroke(s) at configured intervals with optional jitter.
 * Emits 'onStart' on initiation, 'onEachCycle' on every interval tick, and 'onStop' on halt.
 */

module.exports = {
  type: 'loop',
  aliases: ['repeat', 'auto_press'],
  title: 'Interval Loop',
  category: 'Loops & Automation',
  icon: '🔁',
  color: '#10b981',
  inputs: ['in'],
  outputs: ['onStart', 'onEachCycle', 'onStop'],
  defaultData: {
    targetClient: '1',
    keys: ['1'],
    interval: 1000,
    jitter: 0,
    executeImmediately: true
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    const state = global.activeLoopStates && global.activeLoopStates[action.id];
    if (state && state.running) {
      if (typeof global.stopLoopAction === 'function') {
        global.stopLoopAction(action.id, action.name);
        return true;
      }
    } else {
      if (typeof global.startLoopAction === 'function') {
        await global.startLoopAction(action, stack);
        return true;
      }
    }

    console.warn(`⚠️ [Loop Node] "${action.name}": global.startLoopAction / stopLoopAction not found.`);
    return false;
  }
};
