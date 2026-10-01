/**
 * converter.js - NodeHotkey v3.1.0 Profile Converter Engine
 * Converts legacy linear profiles (`actions: [...]`) into Visual Pure Node Workflow format (`nodes: [...]`, `connections: [...]`).
 */

function isNodeWorkflowProfile(profile) {
  if (!profile) return false;
  const isV3 = typeof profile.version === 'string' && profile.version.startsWith('3.');
  const hasNodes = Array.isArray(profile.nodes);
  const hasConnections = Array.isArray(profile.connections);
  const hasLegacyActions = Array.isArray(profile.actions) && profile.actions.length > 0;
  return isV3 && hasNodes && hasConnections && !hasLegacyActions;
}

function normalizeNodeWorkflow(profile) {
  if (!profile) return { profile, modified: false };

  let modified = false;

  if (profile.version !== '3.1.0') {
    profile.version = '3.1.0';
    modified = true;
  }

  if (profile.actions) {
    delete profile.actions;
    modified = true;
  }

  if (!profile.canvas) {
    profile.canvas = { zoom: 1.0, pan: { x: 0, y: 0 } };
    modified = true;
  }

  if (!Array.isArray(profile.nodes)) {
    profile.nodes = [];
    modified = true;
  }

  if (!Array.isArray(profile.connections)) {
    profile.connections = [];
    modified = true;
  }

  profile.nodes.forEach(node => {
    if (!node) return;
    if (!node.data) {
      node.data = {};
      modified = true;
    }
    const d = node.data;

    // 1. Unified Key Synchronization for all key-related nodes
    if (['forwarder', 'key_hold'].includes(node.type)) {
      const rawKey = d.targetKey || (Array.isArray(d.keys) && d.keys[0]) || (typeof d.keys === 'string' && d.keys) || '1';
      const cleanKey = String(rawKey).trim() || '1';
      if (d.targetKey !== cleanKey) {
        d.targetKey = cleanKey;
        modified = true;
      }
      if (!Array.isArray(d.keys) || d.keys.length !== 1 || d.keys[0] !== cleanKey) {
        d.keys = [cleanKey];
        modified = true;
      }
    } else if (node.type === 'key_press') {
      if (Array.isArray(d.keys) && d.keys.length > 0) {
        const cleanKeys = d.keys.map(k => String(k).trim()).filter(Boolean);
        if (d.targetKey !== cleanKeys[0]) {
          d.targetKey = cleanKeys[0] || '1';
          modified = true;
        }
      } else if (d.targetKey) {
        const k = String(d.targetKey).trim() || '1';
        d.targetKey = k;
        d.keys = [k];
        modified = true;
      }
    } else if (node.type === 'loop') {
      if (Array.isArray(d.keys) && d.keys.length > 0) {
        const cleanKeys = d.keys.map(k => String(k).trim()).filter(Boolean);
        if (d.targetKey !== cleanKeys[0]) {
          d.targetKey = cleanKeys[0] || '1';
          modified = true;
        }
      }
    } else if (node.type === 'condition_group') {
      if (!d.logicMode || (d.logicMode !== 'AND' && d.logicMode !== 'OR')) {
        d.logicMode = 'AND';
        modified = true;
      }
      if (!Array.isArray(d.conditions)) {
        d.conditions = [];
        modified = true;
      }
    }

    // 2. Ensure enabled boolean
    if (d.enabled === undefined) {
      d.enabled = true;
      modified = true;
    }
  });

  return { profile, modified };
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

  // If already in v3.1.0 node format, normalize and return
  if (isNodeWorkflowProfile(legacyProfile)) {
    const { profile } = normalizeNodeWorkflow(legacyProfile);
    return profile;
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
      action_condition: 'action_branch',
      action_branch: 'action_branch',
      var_branch: 'var_branch',
      variable_branch: 'var_branch',
      stop_all: 'emergency_stop',
      send_event: 'emit_event',
      sequencer: 'sequencer',
      cast_sequence: 'sequencer',
      party_scanner: 'party_scanner',
      party_slot: 'party_slot',
      party_heal: 'party_heal',
      party_buff: 'party_buff',
      party_target_router: 'party_target',
      tts: 'tts',
      tts_alert: 'tts',
      text_to_speech: 'tts',
      webhook_out: 'webhook_out',
      screenshot: 'screenshot',
      capture_screen: 'screenshot'
    };
    const nodeType = typeMap[act.mode] || act.mode || 'loop';
    const mainNodeX = hasTrigger ? 450 : 100;
    const nodeTitle = act.name || `Node ${index + 1} (${nodeType})`;

    let resolvedTargetKey = '1';
    let resolvedKeys = ['1'];
    if (act.targetKey && typeof act.targetKey === 'string' && act.targetKey.trim()) {
      resolvedTargetKey = act.targetKey.trim();
      resolvedKeys = (Array.isArray(act.keys) && act.keys.length > 1) ? act.keys : [resolvedTargetKey];
    } else if (Array.isArray(act.keys) && act.keys.length > 0) {
      resolvedKeys = act.keys.map(k => String(k).trim()).filter(Boolean);
      resolvedTargetKey = resolvedKeys[0] || '1';
    }

    const nodeData = {
      actionId: actId,
      name: act.name || '',
      enabled: act.enabled !== false,
      targetClient: act.targetClient || '1',
      targetMode: act.targetMode || 'heal_priority',
      lowHpThreshold: act.lowHpThreshold !== undefined ? act.lowHpThreshold : 70,
      scanIntervalMs: act.scanIntervalMs !== undefined ? act.scanIntervalMs : 250,
      delayAfterClick: act.delayAfterClick !== undefined ? act.delayAfterClick : 80,
      url: act.url || '',
      method: act.method || 'POST',
      headers: act.headers || '',
      payload: act.payload !== undefined ? act.payload : '',
      timeoutMs: act.timeoutMs !== undefined ? act.timeoutMs : 5000,
      keys: resolvedKeys,
      interval: act.interval !== undefined ? act.interval : 1000,
      jitter: act.jitter !== undefined ? act.jitter : 0,
      executeImmediately: act.executeImmediately !== false,
      firstSteps: Array.isArray(act.firstSteps) ? act.firstSteps : [],
      cooldownPresetId: act.cooldownPresetId || '',
      customCooldownMs: act.customCooldownMs || 0,
      delayAfter: act.delayAfter || 0,
      targetKey: resolvedTargetKey,
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
      text: act.text || act.message || '',
      voice: act.voice || 'th-TH-PremwadeeNeural',
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
  convertLegacyProfileToNodeWorkflow,
  normalizeNodeWorkflow
};
