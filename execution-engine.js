/**
 * execution-engine.js - NodeHotkey v3.1.0 Backend Pure Node Execution Engine
 * Directly evaluates Node Workflow graph connections and handles wire signal routing.
 */

class NodeExecutionEngine {
  constructor(profileOrProfiles = null) {
    this.profiles = [];
    this.nodesMap = new Map();              // nodeId -> node object
    this.actionIdToNodeMap = new Map();      // actionId -> node object
    this.connectionsFromMap = new Map();     // fromNodeId -> array of connections
    this.connectionsToMap = new Map();       // toNodeId -> array of connections
    if (profileOrProfiles) {
      if (Array.isArray(profileOrProfiles)) {
        this.loadProfiles(profileOrProfiles);
      } else {
        this.loadProfile(profileOrProfiles);
      }
    }
  }

  loadProfile(profile) {
    this.loadProfiles(profile ? [profile] : []);
  }

  loadProfiles(profiles = []) {
    this.profiles = Array.isArray(profiles) ? profiles : [profiles].filter(Boolean);
    this.nodesMap.clear();
    this.actionIdToNodeMap.clear();
    this.connectionsFromMap.clear();
    this.connectionsToMap.clear();

    for (const profile of this.profiles) {
      if (!profile) continue;
      const nodes = Array.isArray(profile.nodes) ? profile.nodes : [];
      nodes.forEach(node => {
        const enrichedNode = { ...node, _profileName: profile.name };
        this.nodesMap.set(node.id, enrichedNode);

        const actionId = node.data?.actionId || (node.id.startsWith('node_') ? node.id.replace('node_', '') : node.id);
        this.actionIdToNodeMap.set(actionId, enrichedNode);
      });

      const connections = Array.isArray(profile.connections) ? profile.connections : [];
      connections.forEach(conn => {
        // Outgoing index
        if (!this.connectionsFromMap.has(conn.fromNodeId)) {
          this.connectionsFromMap.set(conn.fromNodeId, []);
        }
        this.connectionsFromMap.get(conn.fromNodeId).push(conn);

        // Incoming index
        if (!this.connectionsToMap.has(conn.toNodeId)) {
          this.connectionsToMap.set(conn.toNodeId, []);
        }
        this.connectionsToMap.get(conn.toNodeId).push(conn);
      });
    }
  }

  /**
   * Find trigger nodes matching input trigger type and value
   */
  getMatchingTriggerNodes(triggerType, triggerValue) {
    const matched = [];
    const valStr = String(triggerValue).toLowerCase().trim();

    for (const node of this.nodesMap.values()) {
      if (node.type === 'trigger' && node.data) {
        const nType = (node.data.triggerType || 'keyboard').toLowerCase().trim();
        const nVal = String(node.data.triggerValue || '').toLowerCase().trim();
        const isEnabled = node.data.enabled !== false;

        if (isEnabled && nType === triggerType.toLowerCase().trim() && nVal === valStr) {
          matched.push(node);
        }
      }
    }
    return matched;
  }

  /**
   * Directly get all Action nodes connected downstream from a matching trigger
   */
  getTriggerDownstreamNodes(triggerType, triggerValue) {
    const triggers = this.getMatchingTriggerNodes(triggerType, triggerValue);
    const downstream = [];

    triggers.forEach(trigNode => {
      const targets = this.getDownstreamNodes(trigNode.id, 'exec_out');
      targets.forEach(t => downstream.push({ ...t, triggerNode: trigNode }));
    });

    return downstream;
  }

  /**
   * Get downstream connected nodes from a specific output port
   */
  getDownstreamNodes(fromIdOrActionId, portName = null) {
    const node = this.getNode(fromIdOrActionId);
    if (!node) return [];

    const connections = this.connectionsFromMap.get(node.id) || [];
    const targetNodes = [];

    connections.forEach(conn => {
      const isNextPort = conn.fromPort === 'next' || conn.fromPort === 'exec_out' || conn.fromPort === 'onComplete' || conn.fromPort === 'on_complete' || conn.fromPort === 'onFired' || conn.fromPort === 'onActivated';
      const isReqNext = portName === 'onComplete' || portName === 'next' || portName === 'exec_out' || portName === 'on_complete' || portName === 'onFired' || portName === 'onActivated' || portName === 'onKeyDown';

      const matchesPort = !portName || 
        conn.fromPort === portName || 
        (isReqNext && isNextPort) ||
        (portName === 'onEachCycle' && (conn.fromPort === 'on_interval' || conn.fromPort === 'onInterval')) ||
        (portName === 'onStop' && conn.fromPort === 'on_stop') ||
        (portName === 'onTrue' && conn.fromPort === 'on_true') ||
        (portName === 'onFalse' && conn.fromPort === 'on_false') ||
        (portName === 'onEnable' && conn.fromPort === 'on_enable') ||
        (portName === 'onDisable' && conn.fromPort === 'on_disable') ||
        (portName === 'onBeforeStart' && conn.fromPort === 'on_before_start') ||
        (portName === 'onAfterStart' && conn.fromPort === 'on_after_start') ||
        (portName === 'onStep' && (conn.fromPort === 'onStep' || conn.fromPort === 'on_step'));

      if (matchesPort) {
        const targetNode = this.nodesMap.get(conn.toNodeId);
        if (targetNode) {
          targetNodes.push({
            node: targetNode,
            connection: conn
          });
        }
      }
    });

    return targetNodes;
  }

  /**
   * Get node by Node ID or Action ID
   */
  getNode(idOrActionId) {
    if (!idOrActionId) return null;
    return this.nodesMap.get(idOrActionId) || this.actionIdToNodeMap.get(idOrActionId) || null;
  }

  /**
   * Get all nodes of a specific type
   */
  getNodesByType(type) {
    const result = [];
    for (const node of this.nodesMap.values()) {
      if (node.type === type) {
        result.push(node);
      }
    }
    return result;
  }

  /**
   * Dynamically build in-memory executable actions model from Pure Node Graph
   */
  buildInMemoryActions(profile) {
    if (!profile) return [];
    if (Array.isArray(profile.actions) && profile.actions.length > 0 && (!profile.nodes || profile.nodes.length === 0)) {
      return profile.actions.map(act => ({ ...act, _profileName: profile.name }));
    }

    const nodes = Array.isArray(profile.nodes) ? profile.nodes : [];
    const connections = Array.isArray(profile.connections) ? profile.connections : [];
    const triggerMap = new Map();

    // Map trigger connections (fromNodeId -> toNodeId)
    connections.forEach(conn => {
      const fromNode = nodes.find(n => n.id === conn.fromNodeId);
      if (fromNode && fromNode.type === 'trigger' && fromNode.data) {
        triggerMap.set(conn.toNodeId, {
          type: fromNode.data.triggerType || 'keyboard',
          value: fromNode.data.triggerValue || ''
        });
      }
    });

    const modeMap = {
      key_press: 'single_press',
      delay: 'delay_only',
      forwarder: 'forward',
      sound: 'sound_alert',
      control: 'action_control',
      branch: 'action_condition',
      emergency_stop: 'stop_all',
      emit_event: 'send_event',
      loop: 'loop',
      buff_sequence: 'buff_sequence',
      key_hold: 'key_hold',
      macro_group: 'macro_group',
      sequencer: 'sequencer',
      loop_scheduler: 'loop_scheduler'
    };

    const actions = [];
    nodes.forEach((node, idx) => {
      if (node.type === 'trigger') return; // Triggers are merged into downstream actions in memory

      const d = node.data || {};
      const actionId = d.actionId || (node.id.startsWith('node_') ? node.id.replace('node_', '') : node.id);
      const trig = triggerMap.get(node.id) || {
        type: d.triggerType || 'none',
        value: d.triggerValue || ''
      };

      actions.push({
        id: actionId,
        nodeId: node.id,
        name: node.title || d.name || `Action ${idx + 1}`,
        enabled: d.enabled !== false,
        mode: modeMap[node.type] || node.type || 'loop',
        modeType: d.modeType || 'loop',
        trigger: trig,
        eventName: d.eventName || '',
        targetClient: d.targetClient || '1',
        keys: Array.isArray(d.keys) ? d.keys : (d.keys ? [d.keys] : ['1']),
        interval: d.interval !== undefined ? d.interval : 1000,
        jitter: d.jitter !== undefined ? d.jitter : 0,
        executeImmediately: d.executeImmediately !== false,
        collisionGuardMs: d.collisionGuardMs !== undefined ? parseInt(d.collisionGuardMs, 10) : 800,
        items: Array.isArray(d.items) ? d.items : [],
        steps: Array.isArray(d.steps) ? d.steps : [],
        repeatCount: d.repeatCount || 1,
        delayAfter: d.delayAfter || 0,
        delayBuff: d.delayBuff !== undefined ? d.delayBuff : 800,
        delayMs: d.delayMs !== undefined ? d.delayMs : 1000,
        targetKey: d.targetKey || (Array.isArray(d.keys) && d.keys[0] ? d.keys[0] : '1'),
        controlOperation: d.controlOperation || 'toggle',
        controlTargetIds: Array.isArray(d.controlTargetIds) ? d.controlTargetIds : (d.controlTargetId ? [d.controlTargetId] : []),
        conditionTargetId: d.conditionTargetId || '',
        conditionRule: d.conditionRule || 'is_running',
        stopScope: d.stopScope || 'all',
        showOverlayNotice: d.showOverlayNotice !== false,
        soundSource: d.soundSource || 'preset',
        soundPreset: d.soundPreset || 'ding',
        soundUrl: d.soundUrl || '',
        soundFile: d.soundFile || '',
        volume: d.volume !== undefined ? d.volume : 100,
        delayActivation: !!d.delayActivation,
        activationDelayMs: d.activationDelayMs || 1000,
        cooldownPresetId: d.cooldownPresetId || '',
        customCooldownMs: d.customCooldownMs ? parseInt(d.customCooldownMs, 10) : 0,
        _profileName: profile.name || 'Active'
      });
    });

    return actions;
  }
}

module.exports = NodeExecutionEngine;
