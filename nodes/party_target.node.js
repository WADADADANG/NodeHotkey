/**
 * nodes/party_target.node.js
 * Action Node: Party Target Router (Legacy Combined Router)
 * 
 * Routes targeting requests dynamically based on targetMode:
 * - 'heal_priority' (Lowest HP member under threshold)
 * - 'buff_loop' (Round-robin party buffing)
 * - 'slot_select' (Specific slot)
 * Emits signals according to the active mode.
 */

module.exports = {
  type: 'party_target',
  aliases: ['party_target_router'],
  title: 'Party Target Router',
  category: 'Vision & Party',
  icon: '🧭',
  color: '#0284c7',
  inputs: ['in'],
  outputs: ['onTargetSelected', 'onAllHealthy', 'onNextMember', 'onComplete', 'onError'],
  defaultData: {
    targetClient: '1',
    targetMode: 'heal_priority', // 'heal_priority' | 'buff_loop' | 'slot_select'
    lowHpThreshold: 70,
    delayAfterClick: 80
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    if (typeof global.runPartyTargetRouterAction === 'function') {
      await global.runPartyTargetRouterAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Party Target Router Node] "${action.name}": global.runPartyTargetRouterAction not found.`);
    return false;
  }
};
