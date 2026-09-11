/**
 * nodes/emergency_stop.node.js
 * Action Node: Emergency Stop All
 * 
 * Halts active loops, sequences, and schedulers across all clients or target scope.
 */

module.exports = {
  type: 'emergency_stop',
  aliases: ['stop_all'],
  title: 'Emergency Stop All',
  category: 'Safety / Utility',
  icon: '🛑',
  color: '#ef4444',
  inputs: ['in'],
  outputs: ['onFired'],
  defaultData: {
    stopScope: 'all',
    targetClient: '1'
  },

  async execute(context, action, callStack = []) {
    if (typeof global.stopAllAudio === 'function') {
      global.stopAllAudio();
    }
    if (typeof global.runEmergencyStopAction === 'function') {
      await global.runEmergencyStopAction(action, callStack);
      return true;
    }
    console.warn(`🛑 [Emergency Stop Node] global.runEmergencyStopAction not found`);
    return false;
  }
};
