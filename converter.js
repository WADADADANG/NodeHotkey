/**
 * converter.js - NodeHotkey v3.1.0 Profile Converter Engine
 * Converts legacy linear profiles (`actions: [...]`) into Visual Pure Node Workflow format (`nodes: [...]`, `connections: [...]`).
 */

function isNodeWorkflowProfile(profile) {
  if (!profile) return false;
  const isV3 = profile.version === '3.0.0' || profile.version === '3.1.0';
  return isV3 && Array.isArray(profile.nodes) && Array.isArray(profile.connections) && profile.nodes.length > 0;
}

function convertLegacyProfileToNodeWorkflow(legacyProfile) {
  if (!legacyProfile) {
    return {
      version: '3.1.0',
      name: 'Default Profile',
      canvas: { zoom: 1.0, pan: { x: 0, y: 0 } },
      nodes: [],
      connections: []
    };
  }

  // If already in v3.1.0 node format, return as is
  if (isNodeWorkflowProfile(legacyProfile)) {
    return {
      ...legacyProfile,
      version: '3.1.0'
    };
  }

  const profileName = legacyProfile.name || 'Converted Profile';
  const actions = Array.isArray(legacyProfile.actions) ? legacyProfile.actions : [];

  const nodes = [];
  const connections = [];
  let connCounter = 1;

  // Map legacy action ID -> node ID
  const actionToNodeId = {};
  actions.forEach((act, idx) => {
    const actId = act.id || `act_${Date.now()}_${idx}`;
    actionToNodeId[actId] = `node_${actId}`;
  });

  const rowStartY = 150;
  const rowYSpacing = 180;

  actions.forEach((act, index) => {
    const actId = act.id || `act_${Date.now()}_${index}`;
    const mainNodeId = actionToNodeId[actId];
    const yPos = rowStartY + (index * rowYSpacing);

    let hasTrigger = false;
    let triggerNodeId = null;

    // 1. Create Trigger Node if trigger is present
    if (act.trigger && act.trigger.type !== 'none' && act.trigger.value) {
      hasTrigger = true;
      triggerNodeId = `trig_${actId}`;
      const trigType = act.trigger.type || 'keyboard';
      const trigVal = act.trigger.value;
      const trigTitle = trigType === 'mouse' 
        ? `Trigger (Mouse ${trigVal})` 
        : `Trigger (Key ${trigVal})`;

      nodes.push({
        id: triggerNodeId,
        type: 'trigger',
        title: trigTitle,
        position: { x: 100, y: yPos },
        data: {
          triggerType: trigType,
          triggerValue: trigVal,
          enabled: act.enabled !== false
        }
      });
    }

    // 2. Canonical Node Type Mapping
    const typeMap = {
      single_press: 'key_press',
      delay_only: 'delay',
      forward: 'forwarder',
      sound_alert: 'sound',
      action_control: 'control',
      action_condition: 'branch',
      stop_all: 'emergency_stop',
      send_event: 'emit_event',
      sequencer: 'sequencer',
      cast_sequence: 'sequencer'
    };
    const nodeType = typeMap[act.mode] || act.mode || 'loop';
    const mainNodeX = hasTrigger ? 450 : 100;
    const nodeTitle = act.name || `Node ${index + 1} (${nodeType})`;

    const nodeData = {
      actionId: actId,
      name: act.name || '',
      enabled: act.enabled !== false,
      targetClient: act.targetClient || '1',
      keys: Array.isArray(act.keys) ? act.keys : (act.keys ? [act.keys] : ['1']),
      interval: act.interval !== undefined ? act.interval : 1000,
      jitter: act.jitter !== undefined ? act.jitter : 0,
      executeImmediately: act.executeImmediately !== false,
      firstSteps: Array.isArray(act.firstSteps) ? act.firstSteps : [],
      cooldownPresetId: act.cooldownPresetId || '',
      customCooldownMs: act.customCooldownMs || 0,
      delayAfter: act.delayAfter || 0,
      targetKey: act.targetKey || (Array.isArray(act.keys) && act.keys[0] ? act.keys[0] : '1'),
      controlOperation: act.controlOperation || 'toggle',
      controlTargetIds: Array.isArray(act.controlTargetIds) ? act.controlTargetIds : [],
      conditionTargetId: act.conditionTargetId || '',
      conditionRule: act.conditionRule || 'is_running',
      stopScope: act.stopScope || 'all',
      eventName: act.eventName || '',
      soundSource: act.soundSource || 'preset',
      soundPreset: act.soundPreset || 'ding',
      soundUrl: act.soundUrl || '',
      soundFile: act.soundFile || '',
      volume: act.volume !== undefined ? act.volume : 100,
      steps: Array.isArray(act.steps) ? act.steps : [],
      repeatCount: act.repeatCount || 1,
      chaining: act.chaining || { _enabled: false }
    };

    nodes.push({
      id: mainNodeId,
      type: nodeType,
      title: nodeTitle,
      position: { x: mainNodeX, y: yPos },
      data: nodeData
    });

    // 3. Connect Trigger -> Main Action Node
    if (hasTrigger && triggerNodeId) {
      connections.push({
        id: `conn_${connCounter++}`,
        fromNodeId: triggerNodeId,
        fromPort: 'exec_out',
        toNodeId: mainNodeId,
        toPort: 'exec_in'
      });
    }
  });

  // 4. Create connections for all Chaining events
  actions.forEach((act) => {
    const actId = act.id;
    const mainNodeId = actionToNodeId[actId];

    if (act.chaining && act.chaining._enabled && mainNodeId) {
      const ch = act.chaining;
      const portEvents = [
        { key: 'onBeforeStart', port: 'onBeforeStart' },
        { key: 'onAfterStart', port: 'onAfterStart' },
        { key: 'onEachCycle', port: 'onEachCycle' },
        { key: 'onStop', port: 'onStop' },
        { key: 'onComplete', port: 'onComplete' },
        { key: 'onTrue', port: 'onTrue' },
        { key: 'onFalse', port: 'onFalse' }
      ];

      portEvents.forEach(({ key, port }) => {
        if (ch[key]) {
          const targetIds = Array.isArray(ch[key]) ? ch[key] : [ch[key]];
          targetIds.forEach(targetId => {
            if (actionToNodeId[targetId]) {
              connections.push({
                id: `conn_${connCounter++}`,
                fromNodeId: mainNodeId,
                fromPort: port,
                toNodeId: actionToNodeId[targetId],
                toPort: 'exec_in'
              });
            }
          });
        }
      });
    }
  });

  return {
    version: '3.1.0',
    name: profileName,
    canvas: legacyProfile.canvas || { zoom: 1.0, pan: { x: 0, y: 0 } },
    nodes,
    connections
  };
}

module.exports = {
  isNodeWorkflowProfile,
  convertLegacyProfileToNodeWorkflow
};
