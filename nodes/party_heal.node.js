/**
 * nodes/party_heal.node.js
 * Action Node: Party Heal Priority (Auto Heal Target Selector)
 * 
 * Evaluates scanned party members' HP and targets the member with lowest HP below threshold.
 * Emits 'onTargetSelected' when an injured member is targeted, 'onAllHealthy' if no one needs heals, and 'onError' on failure.
 */

module.exports = {
  type: 'party_heal',
  aliases: ['heal_party', 'auto_heal'],
  title: 'Party Heal',
  category: 'Vision & Party',
  icon: '💚',
  color: '#22c55e',
  inputs: ['in'],
  outputs: ['onTargetSelected', 'onAllHealthy', 'onError'],
  defaultData: {
    targetClient: '1',
    scanRegion: 'auto',
    lowHpThreshold: 70,
    delayAfterClick: 80,
    showOverlay: true
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    if (typeof global.runPartyHealAction === 'function') {
      await global.runPartyHealAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Party Heal Node] "${action.name}": global.runPartyHealAction not found.`);
    return false;
  }
};
