/**
 * nodes/party_scanner.node.js
 * Action Node: Party Scanner (Vision Scanner)
 * 
 * Performs real-time computer vision scan of party bars and member status.
 * Updates central party cache without clicking the mouse.
 * Emits 'onScanned' on success and 'onError' if party is not detected or client is unavailable.
 */

module.exports = {
  type: 'party_scanner',
  aliases: ['scan_party', 'scanner'],
  title: 'Party Scanner',
  category: 'Vision & Party',
  icon: '👁️',
  color: '#0ea5e9',
  inputs: ['in'],
  outputs: ['onScanned', 'onError'],
  defaultData: {
    targetClient: '1',
    scanRegion: 'auto',
    scanIntervalMs: 250,
    readNames: true,
    showOverlay: true
  },

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);

    if (typeof global.runPartyScannerAction === 'function') {
      await global.runPartyScannerAction(action, stack);
      return true;
    }

    console.warn(`⚠️ [Party Scanner Node] "${action.name}": global.runPartyScannerAction not found.`);
    return false;
  }
};
