/**
 * nodes/sequencer.node.js
 * Action Node: Cast Sequencer (Skill Combo & Loop)
 * 
 * Executes structured combo chains with custom per-step delays.
 * Supports both One-Shot Burst ('once') and Continuous Loop ('loop').
 * Emits 'onEachCycle', 'onComplete', and 'onStop'.
 */

module.exports = {
  type: 'sequencer',
  aliases: ['cast_sequence', 'combo'],
  title: 'Cast Sequencer',
  category: 'Loops & Automation',
  icon: '⚔️',
  color: '#ec4899',
  inputs: ['in'],
  outputs: ['onEachCycle', 'onComplete', 'onStop'],
  defaultData: {
    targetClient: '1',
    modeType: 'loop', // 'loop' | 'once'
    steps: [],
    interval: 1000,
    repeatCount: 1
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    if (action.modeType === 'once') {
      if (typeof global.runCastSequencerOnce === 'function') {
        await global.runCastSequencerOnce(action, stack);
        return true;
      }
    } else {
      const state = global.activeSequencerLoops && global.activeSequencerLoops[action.id];
      if (state && state.running) {
        if (typeof global.stopCastSequencerAction === 'function') {
          global.stopCastSequencerAction(action.id, action.name);
          return true;
        }
      } else {
        if (typeof global.startCastSequencerLoop === 'function') {
          await global.startCastSequencerLoop(action, stack);
          return true;
        }
      }
    }

    console.warn(`⚠️ [Sequencer Node] "${action.name}": global sequencer handlers not found.`);
    return false;
  }
};
