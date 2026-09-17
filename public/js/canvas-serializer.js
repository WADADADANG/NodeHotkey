/**
 * canvas-serializer.js - NodeHotkey v3.1.0 Canvas Profile Serializer & Data Sanitizer
 * Modularized extension for NodeCanvasEditor
 */

(function () {
  const SerializerExtension = {
  exportProfileData() {
    // Sanitize node data so that each node only keeps properties strictly relevant to its type
    const cleanNodes = this.nodes.map(node => {
      const d = node.data || {};
      const type = node.type;
      let cleanData = { enabled: d.enabled !== false };

      const def = window.clientNodeRegistry ? window.clientNodeRegistry.get(type) : null;
      if (def && Array.isArray(def.schema) && def.schema.length > 0) {
        for (const field of def.schema) {
          const key = field.key;
          if (d[key] !== undefined) {
            if (field.component === 'number_input' || field.component === 'slider') {
              cleanData[key] = field.isFloat ? parseFloat(d[key]) : parseInt(d[key], 10);
              if (isNaN(cleanData[key])) cleanData[key] = field.default ?? 0;
            } else if (field.component === 'toggle') {
              cleanData[key] = d[key] !== false;
            } else {
              cleanData[key] = d[key];
            }
          } else if (def.defaultData && def.defaultData[key] !== undefined) {
            cleanData[key] = def.defaultData[key];
          }
        }
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'trigger') {
        cleanData.triggerType = d.triggerType || 'keyboard';
        cleanData.triggerValue = d.triggerValue || '1';
      } else if (type === 'key_press') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.keys = Array.isArray(d.keys) ? d.keys : (d.keys ? [d.keys] : ['1']);
        if (d.delayAfter !== undefined && parseInt(d.delayAfter, 10) > 0) {
          cleanData.delayAfter = parseInt(d.delayAfter, 10);
        }
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'loop') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.keys = Array.isArray(d.keys) ? d.keys : (d.keys ? [d.keys] : ['1']);
        cleanData.interval = d.interval !== undefined ? parseInt(d.interval, 10) : 1000;
        if (d.jitter !== undefined && parseInt(d.jitter, 10) > 0) cleanData.jitter = parseInt(d.jitter, 10);
        cleanData.executeImmediately = d.executeImmediately !== false;
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'buff_sequence') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.keys = Array.isArray(d.keys) ? d.keys : (d.keys ? [d.keys] : ['1', '2']);
        cleanData.delayBuff = d.delayBuff !== undefined ? parseInt(d.delayBuff, 10) : 800;
        if (d.delayAfter !== undefined && parseInt(d.delayAfter, 10) > 0) cleanData.delayAfter = parseInt(d.delayAfter, 10);
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'delay') {
        cleanData.delayMs = d.delayMs !== undefined ? parseInt(d.delayMs, 10) : 1000;
      } else if (type === 'var_set' || type === 'variable') {
        cleanData.varName = d.varName || (node.title ? node.title.replace(/^Set /, '') : 'myVar');
        cleanData.varType = d.varType || 'boolean';
        cleanData.scope = d.scope || 'client';
        cleanData.targetClient = d.targetClient || '1';
        cleanData.initialValue = d.initialValue !== undefined ? d.initialValue : 'false';
        cleanData.operation = d.operation || 'set_value';
        cleanData.opValue = d.opValue !== undefined ? d.opValue : '1';
      } else if (type === 'var_get') {
        cleanData.varName = d.varName || (node.title ? node.title.replace(/^Get /, '') : 'myVar');
        cleanData.varType = d.varType || 'string';
        cleanData.scope = d.scope || 'client';
        cleanData.targetClient = d.targetClient || '1';
        cleanData.defaultValue = d.defaultValue !== undefined ? d.defaultValue : '';
      } else if (type === 'action_branch' || type === 'branch' || type === 'condition') {
        cleanData.conditionTargetId = d.conditionTargetId || '';
        cleanData.conditionRule = d.conditionRule || 'is_running';
        if (d.conditionValue !== undefined) cleanData.conditionValue = d.conditionValue;
      } else if (type === 'var_branch' || type === 'variable_branch') {
        cleanData.conditionTargetId = d.conditionTargetId || (d.varName ? `var:${d.varName}` : '');
        cleanData.varName = d.varName || (cleanData.conditionTargetId.startsWith('var:') ? cleanData.conditionTargetId.replace('var:', '') : '');
        cleanData.varType = d.varType || 'boolean';
        cleanData.conditionRule = d.conditionRule || (cleanData.varType === 'boolean' ? 'is_true' : 'equals');
        if (d.conditionValue !== undefined) cleanData.conditionValue = d.conditionValue;
      } else if (type === 'control') {
        cleanData.controlOperation = d.controlOperation || 'toggle';
        cleanData.controlTargetIds = Array.isArray(d.controlTargetIds) ? d.controlTargetIds : (d.controlTargetId ? [d.controlTargetId] : []);
      } else if (type === 'forwarder') {
        cleanData.targetKey = d.targetKey || '1';
        cleanData.targetClient = d.targetClient || 'all';
        if (d.delayActivation) {
          cleanData.delayActivation = true;
          cleanData.activationDelayMs = parseInt(d.activationDelayMs, 10) || 1000;
        }
        if (d.delayAfter !== undefined && parseInt(d.delayAfter, 10) > 0) cleanData.delayAfter = parseInt(d.delayAfter, 10);
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'emergency_stop') {
        cleanData.stopScope = d.stopScope || 'all';
        if (cleanData.stopScope === 'client') cleanData.targetClient = d.targetClient || '1';
        cleanData.showOverlayNotice = d.showOverlayNotice !== false;
      } else if (type === 'sound') {
        cleanData.soundSource = d.soundSource || 'preset';
        cleanData.soundPreset = d.soundPreset || 'ding';
        if (d.soundUrl) cleanData.soundUrl = d.soundUrl;
        if (d.soundFile) cleanData.soundFile = d.soundFile;
        cleanData.volume = d.volume !== undefined ? parseInt(d.volume, 10) : 100;
        if (d.repeatCount && parseInt(d.repeatCount, 10) > 1) cleanData.repeatCount = parseInt(d.repeatCount, 10);
      } else if (type === 'emit_event') {
        cleanData.eventName = d.eventName || 'party_heal';
      } else if (type === 'webhook_out') {
        cleanData.url = d.url || '';
        cleanData.method = d.method || 'POST';
        cleanData.headers = d.headers || '';
        cleanData.payload = d.payload !== undefined ? d.payload : '';
        cleanData.timeoutMs = d.timeoutMs !== undefined ? parseInt(d.timeoutMs, 10) : 5000;
      } else if (type === 'macro_group') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.repeatCount = d.repeatCount || 1;
        cleanData.steps = Array.isArray(d.steps) ? d.steps : [];
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'key_hold') {
        cleanData.targetKey = d.targetKey || '1';
        cleanData.targetClient = d.targetClient || '1';
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'sequencer') {
        cleanData.modeType = d.modeType || 'loop';
        cleanData.targetClient = d.targetClient || '1';
        cleanData.interval = d.interval !== undefined ? Math.max(0, parseInt(d.interval, 10)) : 1000;
        cleanData.repeatCount = d.repeatCount !== undefined ? Math.max(1, parseInt(d.repeatCount, 10)) : 1;
        cleanData.delayAfter = d.delayAfter !== undefined ? parseInt(d.delayAfter, 10) : 0;
        cleanData.steps = Array.isArray(d.steps) ? d.steps.map(s => {
          const delayVal = s.delay !== undefined ? parseInt(s.delay, 10) : (s.castTimeMs !== undefined ? parseInt(s.castTimeMs, 10) : 800);
          return {
            key: s.key || '1',
            delay: delayVal,
            castTimeMs: delayVal
          };
        }) : [];
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'loop_scheduler') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.collisionGuardMs = d.collisionGuardMs !== undefined ? parseInt(d.collisionGuardMs, 10) : 800;
        cleanData.items = Array.isArray(d.items) ? d.items.map((it, idx) => ({
          id: it.id || `item_${idx}`,
          name: it.name || `Skill ${idx + 1}`,
          interval: Math.max(50, parseInt(it.interval, 10) || 3000),
          jitter: Math.max(0, parseInt(it.jitter, 10) || 0),
          executeImmediately: it.executeImmediately !== false,
          enabled: it.enabled !== false
        })) : [];
      } else if (type === 'party_scanner') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.scanIntervalMs = d.scanIntervalMs !== undefined ? parseInt(d.scanIntervalMs, 10) : 250;
        cleanData.lowHpThreshold = d.lowHpThreshold !== undefined ? parseInt(d.lowHpThreshold, 10) : 70;
        cleanData.showOverlay = d.showOverlay !== false;
      } else if (type === 'party_slot') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.targetSlot = d.targetSlot !== undefined ? parseInt(d.targetSlot, 10) : 1;
        cleanData.delayAfterClick = d.delayAfterClick !== undefined ? parseInt(d.delayAfterClick, 10) : 80;
        cleanData.showOverlay = d.showOverlay !== false;
      } else if (type === 'party_heal') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.lowHpThreshold = d.lowHpThreshold !== undefined ? parseInt(d.lowHpThreshold, 10) : 70;
        cleanData.delayAfterClick = d.delayAfterClick !== undefined ? parseInt(d.delayAfterClick, 10) : 80;
        cleanData.showOverlay = d.showOverlay !== false;
      } else if (type === 'party_buff') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.delayAfterClick = d.delayAfterClick !== undefined ? parseInt(d.delayAfterClick, 10) : 80;
        cleanData.showOverlay = d.showOverlay !== false;
      } else if (type === 'tts') {
        cleanData.text = d.text || '';
        cleanData.voice = d.voice || 'th-TH-PremwadeeNeural';
        cleanData.volume = d.volume !== undefined ? parseInt(d.volume, 10) : 100;
      } else if (type === 'step_log') {
        cleanData.message = d.message !== undefined ? d.message : '';
      } else if (type === 'screenshot') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.captureRegion = d.captureRegion || 'active_client';
        cleanData.subfolder = d.subfolder || '';
        cleanData.prefix = d.prefix || 'error_snap';
        cleanData.annotate = d.annotate === true;
      } else if (type === 'format_text') {
        cleanData.template = d.template !== undefined ? d.template : '{val_a}';
        cleanData.pins = Array.isArray(d.pins) ? d.pins : ['val_a'];
        cleanData.boolFormat = d.boolFormat || 'true_false';
        cleanData.separator = d.separator !== undefined ? d.separator : ' ';
      }

      let actionId = d.actionId || (node.id.startsWith('node_') ? node.id.replace('node_', '') : node.id);
      if (actionId.startsWith('node_')) actionId = actionId.replace('node_', '');
      cleanData.actionId = actionId;

      return {
        id: node.id,
        type: node.type,
        title: node.title,
        position: node.position,
        data: cleanData
      };
    });

    return {
      version: '3.1.0',
      canvas: {
        zoom: this.zoom,
        pan: this.pan
      },
      variables: this.getAvailableVariables(),
      nodes: cleanNodes,
      connections: this.connections
    };
  }

  };

  function applyExtension() {
    if (typeof window !== 'undefined' && window.NodeCanvasEditor) {
      Object.assign(window.NodeCanvasEditor.prototype, SerializerExtension);
    } else if (typeof window !== 'undefined') {
      setTimeout(applyExtension, 10);
    }
  }

  applyExtension();
})();
