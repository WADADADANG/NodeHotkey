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
    targetClient: '1',
    showOverlayNotice: true
  },
  schema: [
    {
      key: 'stopScope', component: 'select', labelKey: 'inspector_stop_scope_label', label: 'Stop Scope (ขอบเขตการหยุด)',
      options: [
        { value: 'all', labelKey: 'inspector_scope_all', label: '🌐 All Clients & Loops (หยุดทุกจอ)' },
        { value: 'profile', labelKey: 'inspector_scope_profile', label: '📁 Current Profile Only (เฉพาะโปรไฟล์นี้)' },
        { value: 'client', labelKey: 'inspector_scope_client', label: '🎯 Specific Client (เฉพาะจอเป้าหมาย)' }
      ]
    },
    { 
      key: 'targetClient', 
      component: 'client_selector', 
      labelKey: 'inspector_target_clients', 
      label: 'Target Client Screen',
      showIf: { stopScope: 'client' }
    },
    { key: 'showOverlayNotice', component: 'toggle', labelKey: 'inspector_stop_overlay_notice', label: 'Display Stop Banner Notice on Game Screen', icon: '📢', color: '#ef4444' }
  ],
  summaryFields: [
    { key: 'stopScope', label: 'Scope', format: val => val === 'client' ? 'Client Target' : 'All Clients' },
    { key: 'showOverlayNotice', label: 'Notice', format: 'boolean_on_off' }
  ],

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
