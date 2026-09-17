import { fullConfig, currentEditProfile, saveCurrentProfile } from './state.js';
import { renderActions, normalizeMode } from './components/actions.js';
import { currentLang, TRANSLATIONS } from './i18n.js';

export function validateProfile(actions) {
  const issues = [];
  if (!actions || !Array.isArray(actions)) return { issues, errorCount: 0, warningCount: 0 };

  const actionIds = new Set(actions.map(a => a.id));

  // Build map of all actions being chained/controlled as sub-actions
  const controlledSubActionIds = new Set();
  actions.forEach(source => {
    if (source.chaining && source.chaining._enabled) {
      Object.keys(source.chaining).forEach(eventKey => {
        if (eventKey === '_enabled') return;
        const targetList = source.chaining[eventKey] || [];
        targetList.forEach(tid => controlledSubActionIds.add(tid));
      });
    }
    if (normalizeMode(source.mode) === 'control' && source.controlTargetIds) {
      source.controlTargetIds.forEach(tid => controlledSubActionIds.add(tid));
    }
  });

  actions.forEach(act => {
    const normMode = normalizeMode(act.mode);

    // 1. Conflicting Trigger Check:
    // If an action is controlled via Action Chain / Control, but ALSO has a key/mouse trigger matching its master trigger
    if (controlledSubActionIds.has(act.id) && act.trigger && act.trigger.type !== 'none' && act.trigger.value) {
      // Find master actions controlling this sub-action
      const masters = actions.filter(m => {
        if (m.id === act.id || !m.trigger || m.trigger.type === 'none') return false;
        let isMaster = false;
        if (m.chaining && m.chaining._enabled) {
          Object.keys(m.chaining).forEach(ev => {
            if (ev !== '_enabled' && (m.chaining[ev] || []).includes(act.id)) isMaster = true;
          });
        }
        const mNorm = normalizeMode(m.mode);
        if (mNorm === 'control' && (m.controlTargetIds || []).includes(act.id)) isMaster = true;
        if ((mNorm === 'branch' || mNorm === 'action_branch') && m.conditionTargetId === act.id) isMaster = true;
        return isMaster && m.trigger.type === act.trigger.type && m.trigger.value === act.trigger.value;
      });

      if (masters.length > 0) {
        const masterNames = masters.map(m => `"${m.name}"`).join(', ');
        const trigLabelEn = act.trigger.type === 'mouse' ? `Mouse Button ${act.trigger.value}` : `Keyboard Key "${act.trigger.value}"`;
        const trigLabelTh = act.trigger.type === 'mouse' ? `ปุ่มเมาส์คลิกด้านข้าง (Mouse Button ${act.trigger.value})` : `ปุ่มคีย์บอร์ด "${act.trigger.value}"`;

        issues.push({
          type: 'conflicting_trigger',
          severity: 'warning',
          actionId: act.id,
          actionName: act.name,
          autoFixable: true,
          messageEn: `Trigger ${trigLabelEn} conflicts with master action ${masterNames} controlling it (causes double-triggering).`,
          messageTh: `ตั้งค่าปุ่ม ${trigLabelTh} ซ้ำกับ Master (${masterNames}) ที่ควบคุมมันอยู่ (ทำให้เกิดการกดซ้ำซ้อน)`
        });
      }
    }

    // 2. Broken Chain References Check:
    if (act.chaining && act.chaining._enabled) {
      Object.keys(act.chaining).forEach(eventKey => {
        if (eventKey === '_enabled') return;
        const targetList = act.chaining[eventKey] || [];
        targetList.forEach(targetId => {
          if (!actionIds.has(targetId)) {
            issues.push({
              type: 'broken_chain',
              severity: 'error',
              actionId: act.id,
              actionName: act.name,
              autoFixable: true,
              eventKey,
              targetId,
              messageEn: `Event [${eventKey}] references a deleted or non-existent action ID ("${targetId}").`,
              messageTh: `เหตุการณ์ [${eventKey}] อ้างอิงถึง Action ID ที่ถูกลบไปแล้ว ("${targetId}")`
            });
          }
        });
      });
    }

    // 3. Unset Target Check for Control & Branch Modes:
    if (normMode === 'control') {
      const targets = act.controlTargetIds || (act.controlTargetId ? [act.controlTargetId] : []);
      const validTargets = targets.filter(tid => actionIds.has(tid));
      if (validTargets.length === 0) {
        issues.push({
          type: 'unset_target',
          severity: 'warning',
          actionId: act.id,
          actionName: act.name,
          autoFixable: false,
          messageEn: `Action Control mode has no target actions selected.`,
          messageTh: `โหมด Action Control ยังไม่ได้เลือก Action เป้าหมาย`
        });
      }
    } else if (normMode === 'branch' || normMode === 'action_branch') {
      if (!act.conditionTargetId || !actionIds.has(act.conditionTargetId)) {
        issues.push({
          type: 'unset_target',
          severity: 'warning',
          actionId: act.id,
          actionName: act.name,
          autoFixable: false,
          messageEn: `Action Branch mode has no target action selected to check.`,
          messageTh: `โหมด Action Branch ยังไม่ได้เลือก Action อ้างอิงที่ต้องการเช็ค`
        });
      }
    } else if (normMode === 'var_branch' || normMode === 'variable_branch') {
      const hasVar = (act.conditionTargetId && String(act.conditionTargetId).trim()) || (act.varName && String(act.varName).trim());
      if (!hasVar) {
        issues.push({
          type: 'unset_target',
          severity: 'warning',
          actionId: act.id,
          actionName: act.name,
          autoFixable: false,
          messageEn: `Variable Branch mode has no variable selected to check.`,
          messageTh: `โหมด Variable Branch ยังไม่ได้เลือกตัวแปรที่ต้องการเช็ค`
        });
      }
    } else if (normMode === 'key_hold') {
      const hasTargetKey = !!(act.targetKey && act.targetKey.trim());
      if (!hasTargetKey) {
        issues.push({
          type: 'unset_target',
          severity: 'warning',
          actionId: act.id,
          actionName: act.name,
          autoFixable: false,
          messageEn: `Key Hold mode has no target key specified to hold down.`,
          messageTh: `โหมดกดปุ่มค้าง (Key Hold) ยังไม่ได้เลือกปุ่มที่จะสั่งให้กดค้าง`
        });
      }
    } else if (normMode === 'emit_event') {
      if (!act.eventName || !act.eventName.trim()) {
        issues.push({
          type: 'unset_target',
          severity: 'warning',
          actionId: act.id,
          actionName: act.name,
          autoFixable: false,
          messageEn: `Broadcast Event mode has no Event Name specified.`,
          messageTh: `โหมดกระจายสัญญาณ (Emit Event) ยังไม่ได้ระบุชื่อเหตุการณ์`
        });
      }
    } else if (normMode === 'sequencer' || normMode === 'cast_sequence') {
      const steps = Array.isArray(act.steps) ? act.steps : [];
      if (steps.length === 0) {
        issues.push({
          type: 'unset_target',
          severity: 'warning',
          actionId: act.id,
          actionName: act.name,
          autoFixable: false,
          messageEn: `Cast Sequencer has no sequence steps defined.`,
          messageTh: `โหมดจัดคิวสกิล (Cast Sequencer) ยังไม่มี Step คำสั่ง`
        });
      }
    }

    if (act.trigger && act.trigger.type === 'event' && (!act.trigger.value || !act.trigger.value.trim())) {
      issues.push({
        type: 'unset_target',
        severity: 'warning',
        actionId: act.id,
        actionName: act.name,
        autoFixable: false,
        messageEn: `Custom Event trigger has no Event Name specified to listen for.`,
        messageTh: `ทริกเกอร์ Custom Event ยังไม่ได้ระบุชื่อเหตุการณ์ที่ต้องการรอฟัง`
      });
    }

    // 4. Circular Chain Loop Check (Direct self-reference or circular chain):
    if (act.chaining && act.chaining._enabled) {
      Object.keys(act.chaining).forEach(eventKey => {
        if (eventKey === '_enabled') return;
        const targetList = act.chaining[eventKey] || [];
        if (targetList.includes(act.id)) {
          issues.push({
            type: 'circular_chain',
            severity: 'error',
            actionId: act.id,
            actionName: act.name,
            autoFixable: true,
            eventKey,
            targetId: act.id,
            messageEn: `Event [${eventKey}] triggers itself directly, causing an infinite loop.`,
            messageTh: `เหตุการณ์ [${eventKey}] ตั้งทริกเกอร์วนกลับหาตัวเอง ทำให้เกิดลูปไม่สิ้นสุด`
          });
        }
      });
    }
  });

  // 5. Duplicate Action Name Check:
  const nameCounts = {};
  actions.forEach(act => {
    const trimmed = (act.name || '').trim();
    if (trimmed) {
      if (!nameCounts[trimmed]) nameCounts[trimmed] = [];
      nameCounts[trimmed].push(act);
    }
  });

  Object.keys(nameCounts).forEach(name => {
    if (nameCounts[name].length > 1) {
      nameCounts[name].forEach(act => {
        issues.push({
          type: 'duplicate_name',
          severity: 'error',
          actionId: act.id,
          actionName: act.name,
          autoFixable: false,
          messageEn: `Duplicate Action name "${name}" found. Multiple actions share the exact same name.`,
          messageTh: `พบชื่อ Action ซ้ำกัน ("${name}") ซึ่งอาจทำให้เกิดความสับสน`
        });
      });
    }
  });

  // 6. Duplicate Trigger Key Check:
  const triggerCounts = {};
  actions.forEach(act => {
    if (act.enabled && act.trigger && act.trigger.type !== 'none' && act.trigger.value) {
      const key = `${act.trigger.type}:${act.trigger.value.toUpperCase()}`;
      if (!triggerCounts[key]) triggerCounts[key] = [];
      triggerCounts[key].push(act);
    }
  });

  Object.keys(triggerCounts).forEach(key => {
    if (triggerCounts[key].length > 1) {
      const acts = triggerCounts[key];
      const names = acts.map(a => `"${a.name}"`).join(', ');
      const [type, value] = key.split(':');
      const deviceLabelEn = type === 'mouse' ? `Mouse Button ${value}` : `Keyboard Key "${value}"`;
      const deviceLabelTh = type === 'mouse' ? `ปุ่มเมาส์คลิกด้านข้าง (Mouse Button ${value})` : `ปุ่มคีย์บอร์ด "${value}"`;

      acts.forEach(act => {
        issues.push({
          type: 'duplicate_trigger',
          severity: 'warning',
          actionId: act.id,
          actionName: act.name,
          autoFixable: false,
          messageEn: `${deviceLabelEn} is assigned to trigger multiple actions (${names}) at the same time.`,
          messageTh: `ตั้งค่าให้ ${deviceLabelTh} สั่งรันพร้อมกันหลาย Action (${names})`
        });
      });
    }
  });

  // 7. Canvas Nodes & Connections Check (Unconnected Triggers & Standalone Actions)
  const activeProfile = fullConfig && fullConfig.profiles ? fullConfig.profiles[currentEditProfile] : null;
  const canvasNodes = (window.nodeCanvas && window.nodeCanvas.nodes) || (activeProfile && activeProfile.nodes) || [];
  const canvasConns = (window.nodeCanvas && window.nodeCanvas.connections) || (activeProfile && activeProfile.connections) || [];

  if (Array.isArray(canvasNodes) && canvasNodes.length > 0) {
    canvasNodes.forEach(node => {
      if (node.data?.enabled === false) return; // Ignore disabled nodes

      // 7.1 Unconnected Trigger Check
      if (node.type === 'trigger') {
        const hasOutgoing = canvasConns.some(c => c.fromNodeId === node.id);
        if (!hasOutgoing) {
          issues.push({
            type: 'unconnected_trigger',
            severity: 'warning',
            actionId: node.id,
            actionName: node.title || 'Global Trigger',
            autoFixable: false,
            messageEn: `Trigger node "${node.title || 'Global Trigger'}" is not connected to any Action wire.`,
            messageTh: `โหนดทริกเกอร์ "${node.title || 'Global Trigger'}" ยังไม่ได้เชื่อมต่อสายไปยัง Action ใด ๆ`
          });
        }
      } else {
        // 7.2 Unconnected Action Check (No input connection for all action types including emergency_stop)
        const isPure = (node.type === 'var_get' || node.type === 'format_text');
        const isReferenced = window.nodeCanvas && typeof window.nodeCanvas.isNodeReferencedRemotely === 'function'
          ? window.nodeCanvas.isNodeReferencedRemotely(node)
          : false;

        if (!isPure && !isReferenced) {
          const hasIncoming = canvasConns.some(c => c.toNodeId === node.id);
          if (!hasIncoming) {
            issues.push({
              type: 'unconnected_action',
              severity: 'warning',
              actionId: node.id,
              actionName: node.title || node.type,
              autoFixable: false,
              messageEn: `Action node "${node.title || node.type}" has no incoming trigger wire (exec_in).`,
              messageTh: `โหนด "${node.title || node.type}" ยังไม่มีสายสัญญาณคำสั่งเข้า (exec_in)`
            });
          }
        }
      }
    });

    // 7.3 Invalid Connection Type & Incompatible Wire Check
    if (Array.isArray(canvasConns) && canvasConns.length > 0) {
      canvasConns.forEach(conn => {
        const fromNode = canvasNodes.find(n => n.id === conn.fromNodeId);
        const toNode = canvasNodes.find(n => n.id === conn.toNodeId);
        if (!fromNode || !toNode) return;

        // Port metadata lookup
        const getMeta = (node, pName, dir) => {
          if (window.nodeCanvas && typeof window.nodeCanvas.getPortMeta === 'function') {
            return window.nodeCanvas.getPortMeta(node.id, pName, dir);
          }
          const isFlowOut = [
            'next', 'exec_out', 'onComplete', 'onError', 'onScanned', 'onLowHp',
            'onHealTarget', 'onNoTarget', 'onNextMember', 'onKeyDown', 'onActivated',
            'onStep', 'onEachCycle', 'onStop', 'onCooldown', 'onBeforeStart',
            'onAfterStart', 'onTrue', 'onFalse', 'onEnable', 'onDisable'
          ].includes(pName) || String(pName).startsWith('item_');
          const isFlowIn = pName === 'exec_in' || pName === 'in';

          if (dir === 'in') {
            if (isFlowIn) return { kind: 'flow', type: 'flow' };
            return {
              kind: 'data',
              type: pName === 'val_in' ? (node.data?.varType || 'string') : (node.type === 'format_text' ? 'any' : 'string')
            };
          } else {
            if (isFlowOut) return { kind: 'flow', type: 'flow' };
            let dType = 'string';
            if (pName === 'val_out') dType = node.data?.varType || 'string';
            else if (pName === 'slot_out' || pName === 'count_out') dType = 'number';
            return { kind: 'data', type: dType };
          }
        };

        const fromMeta = getMeta(fromNode, conn.fromPort, 'out');
        const toMeta = getMeta(toNode, conn.toPort || 'exec_in', 'in');

        if (fromMeta.kind !== toMeta.kind) {
          issues.push({
            type: 'invalid_connection_type',
            severity: 'error',
            connectionId: conn.id,
            actionId: fromNode.id,
            actionName: `${fromNode.title || fromNode.type} ➔ ${toNode.title || toNode.type}`,
            autoFixable: true,
            fromPort: conn.fromPort,
            toPort: conn.toPort || 'exec_in',
            messageEn: `Illegal connection: Flow and Data pins cannot be wired together between "${fromNode.title || fromNode.type}" [${conn.fromPort}] and "${toNode.title || toNode.type}" [${conn.toPort || 'exec_in'}].`,
            messageTh: `พบสายเชื่อมผิดประเภท: ไม่สามารถต่อสาย Flow ข้ามกับ Data ระหว่าง "${fromNode.title || fromNode.type}" [${conn.fromPort}] และ "${toNode.title || toNode.type}" [${conn.toPort || 'exec_in'}] ได้`
          });
        } else if (fromMeta.kind === 'data' && toMeta.kind === 'data') {
          const fType = fromMeta.type || 'any';
          const tType = toMeta.type || 'any';
          let compatible = false;
          if (fType === 'any' || tType === 'any' || fType === tType) {
            compatible = true;
          } else if (tType === 'string' && (fType === 'number' || fType === 'boolean')) {
            compatible = true;
          }
          if (!compatible) {
            issues.push({
              type: 'incompatible_data_wire',
              severity: 'warning',
              connectionId: conn.id,
              actionId: fromNode.id,
              actionName: `${fromNode.title || fromNode.type} ➔ ${toNode.title || toNode.type}`,
              autoFixable: true,
              fromPort: conn.fromPort,
              toPort: conn.toPort,
              messageEn: `Type mismatch: Data wire from "${fromNode.title || fromNode.type}" [${conn.fromPort}] (${fType}) is incompatible with "${toNode.title || toNode.type}" [${conn.toPort}] (${tType}).`,
              messageTh: `ชนิดข้อมูลไม่ตรงกัน: สายข้อมูลจาก "${fromNode.title || fromNode.type}" [${conn.fromPort}] (${fType}) ไม่สามารถส่งเข้า "${toNode.title || toNode.type}" [${conn.toPort}] (${tType}) ได้`
            });
          }
        }
      });
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return { issues, errorCount, warningCount };
}

export function autoFixProfile() {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile || !profile.actions) return 0;

  let fixedCount = 0;
  const { issues } = validateProfile(profile.actions);

  issues.forEach(issue => {
    if (!issue.autoFixable) return;

    if (issue.type === 'invalid_connection_type' || issue.type === 'incompatible_data_wire') {
      if (issue.connectionId) {
        if (window.nodeCanvas && Array.isArray(window.nodeCanvas.connections)) {
          window.nodeCanvas.connections = window.nodeCanvas.connections.filter(c => c.id !== issue.connectionId);
        }
        if (profile && Array.isArray(profile.connections)) {
          profile.connections = profile.connections.filter(c => c.id !== issue.connectionId);
        }
        fixedCount++;
      }
      return;
    }

    const act = profile.actions.find(a => a.id === issue.actionId);
    if (!act) return;

    if (issue.type === 'conflicting_trigger') {
      act.trigger = { type: 'none', value: '' };
      fixedCount++;
    } else if (issue.type === 'broken_chain' || issue.type === 'circular_chain') {
      if (act.chaining && act.chaining[issue.eventKey]) {
        act.chaining[issue.eventKey] = act.chaining[issue.eventKey].filter(id => id !== issue.targetId);
        fixedCount++;
      }
    }
  });

  if (fixedCount > 0) {
    saveCurrentProfile();
    renderActions(profile.actions);
    if (window.nodeCanvas && typeof window.nodeCanvas.render === 'function') {
      window.nodeCanvas.render();
    }
  }

  return fixedCount;
}
