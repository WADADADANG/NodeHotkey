/**
 * canvas-inspector.js - NodeHotkey v3.1.0 Node Canvas Inspector Forms & UI Helpers
 * Modularized extension for NodeCanvasEditor
 */

(function () {
  function canvasT(key, fallback = '') {
    if (typeof window !== 'undefined' && typeof window.canvasT === 'function') {
      return window.canvasT(key, fallback);
    }
    if (typeof window !== 'undefined' && typeof window.t === 'function') {
      const val = window.t(key);
      if (val && val !== key) return val;
    }
    return fallback || key;
  }

  const InspectorExtension = {
  openInspector(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const formBody = this.container.querySelector('#inspector-form-body');
    const titleEl = this.container.querySelector('#inspector-node-title');
    titleEl.innerHTML = `⚙️ ${this.getNodeTypeLabel(node.type)}`;

    let fieldsHTML = `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_node_title', 'Node Title')}</label>
        <input type="text" class="inspector-input" value="${node.title || ''}" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'title', this.value)" />
      </div>
    `;

    if (node.type === 'trigger') {
      const trigType = node.data?.triggerType || 'keyboard';
      let triggerValueInputHTML = '';
      if (trigType === 'mouse') {
        triggerValueInputHTML = `
          <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'triggerValue', this.value)">
            <option value="4" ${String(node.data?.triggerValue) === '4' ? 'selected' : ''}>${window.currentLang === 'en' ? 'Mouse Button 4 (XButton 1 / Lower Side)' : 'Mouse Button 4 (XButton 1 / ปุ่มข้างล่าง)'}</option>
            <option value="5" ${String(node.data?.triggerValue) === '5' ? 'selected' : ''}>${window.currentLang === 'en' ? 'Mouse Button 5 (XButton 2 / Upper Side)' : 'Mouse Button 5 (XButton 2 / ปุ่มข้างบน)'}</option>
          </select>
        `;
      } else if (trigType === 'event') {
        triggerValueInputHTML = `
          <input type="text" class="inspector-input" value="${node.data?.triggerValue || ''}" placeholder="e.g. party_heal, boss_spawn" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'triggerValue', this.value.trim())" style="font-family:'JetBrains Mono'; font-weight:700; color:#06b6d4;" />
          <span style="font-size:10px; color:var(--muted); margin-top:4px; display:block;">${canvasT('inspector_event_trigger_hint', 'Triggers automatically when any active profile emits this event.')}</span>
        `;
      } else if (trigType === 'webhook') {
        const currentVal = node.data?.triggerValue || 'start_farm';
        triggerValueInputHTML = `
          <input type="text" class="inspector-input" value="${node.data?.triggerValue || ''}" placeholder="e.g. start_farm, heal_now" oninput="window.nodeCanvas.updateWebhookTriggerVal('${node.id}', this.value.trim())" style="font-family:'JetBrains Mono'; font-weight:700; color:#38bdf8;" />
          <div style="background:rgba(14, 165, 233, 0.1); border:1px solid rgba(14, 165, 233, 0.3); border-radius:6px; padding:8px 10px; margin-top:8px;">
            <div style="font-size:11px; font-weight:700; color:#38bdf8; margin-bottom:4px;">🌐 Inbound Webhook URL:</div>
            <code id="webhook-trigger-url-${node.id}" style="font-size:11px; color:#e0f2fe; word-break:break-all; user-select:all; display:block; font-family:'JetBrains Mono',monospace;">${(typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3088'}/api/trigger/${currentVal || '{eventName}'}</code>
            <div style="font-size:10px; color:var(--muted); margin-top:4px;">${canvasT('inspector_webhook_event_hint', 'Send HTTP POST or GET to this URL to trigger this flow.')}</div>
          </div>
        `;
      } else {
        triggerValueInputHTML = `
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="inspector-input" value="${node.data?.triggerValue || ''}" placeholder="${window.currentLang === 'en' ? 'Click to record key...' : 'คลิกเพื่อบันทึกคีย์ (Press any key)...'}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'hotkey')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" />
            <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'hotkey')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
          </div>
        `;
      }

      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_trigger_type_label', 'Trigger Method')}</label>
          <select class="inspector-select" onchange="window.nodeCanvas.updateTriggerType('${node.id}', this.value)">
            <option value="keyboard" ${trigType === 'keyboard' ? 'selected' : ''}>⌨️ ${canvasT('triggerKeyboard', 'Keyboard Hotkey')}</option>
            <option value="mouse" ${trigType === 'mouse' ? 'selected' : ''}>🖱️ ${canvasT('triggerMouse', 'Mouse Button')}</option>
            <option value="event" ${trigType === 'event' ? 'selected' : ''}>📡 ${canvasT('triggerEventLabel', 'Custom Event Listener')}</option>
            <option value="webhook" ${trigType === 'webhook' ? 'selected' : ''}>🌐 ${canvasT('triggerWebhookLabel', 'Webhook / HTTP (Inbound)')}</option>
          </select>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${trigType === 'event' ? canvasT('inspector_event_name_label', 'Event Name to Listen') : (trigType === 'webhook' ? canvasT('inspector_webhook_event_name', 'Event Name (Endpoint)') : canvasT('inspector_trigger_value_label', 'Trigger Key / Value'))}</label>
          ${triggerValueInputHTML}
        </div>
      `;
    } else if (node.type === 'webhook_out') {
      const isEn = window.currentLang === 'en';
      const method = (node.data?.method || 'POST').toUpperCase();
      const headersVal = node.data?.headers !== undefined ? (typeof node.data.headers === 'string' ? node.data.headers : JSON.stringify(node.data.headers, null, 2)) : '{\n  "Content-Type": "application/json"\n}';
      const payloadVal = node.data?.payload !== undefined ? (typeof node.data.payload === 'string' ? node.data.payload : JSON.stringify(node.data.payload, null, 2)) : '{\n  "content": "⚡ NodeHotkey Alert: Triggered!"\n}';
      const timeoutVal = node.data?.timeoutMs !== undefined ? node.data.timeoutMs : 5000;

      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_webhook_url', 'Target Webhook URL')}</label>
          <input type="text" class="inspector-input" value="${node.data?.url || ''}" placeholder="https://discord.com/api/webhooks/... or http://..." onchange="window.nodeCanvas.updateNodeData('${node.id}', 'url', this.value.trim())" style="font-family:'JetBrains Mono'; font-size:11px;" />
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_webhook_method', 'HTTP Method')}</label>
          <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'method', this.value)">
            <option value="POST" ${method === 'POST' ? 'selected' : ''}>POST</option>
            <option value="GET" ${method === 'GET' ? 'selected' : ''}>GET</option>
            <option value="PUT" ${method === 'PUT' ? 'selected' : ''}>PUT</option>
            <option value="DELETE" ${method === 'DELETE' ? 'selected' : ''}>DELETE</option>
          </select>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_webhook_headers', 'Headers (JSON format)')}</label>
          <textarea class="inspector-input" rows="3" style="font-family:'JetBrains Mono'; font-size:11px; resize:vertical;" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'headers', this.value)">${headersVal}</textarea>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_webhook_payload', 'Payload Body (JSON / Text)')}</label>
          <textarea class="inspector-input" rows="4" style="font-family:'JetBrains Mono'; font-size:11px; resize:vertical;" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'payload', this.value)">${payloadVal}</textarea>
          <span style="font-size:10px; color:var(--muted); margin-top:4px; display:block;">${isEn ? 'For Discord Webhooks, use JSON format with a "content" field.' : 'สำหรับ Discord Webhook ให้ใช้ฟอร์แมต JSON ที่มีฟิลด์ "content"'}</span>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_webhook_timeout', 'Timeout (ms)')}</label>
          <input type="number" class="inspector-input" min="500" max="30000" step="500" value="${timeoutVal}" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'timeoutMs', parseInt(this.value, 10) || 5000)" />
        </div>
        <div class="inspector-field-group" style="margin-top:12px;">
          <button type="button" id="btn-test-webhook-${node.id}" class="btn btn-ghost" onclick="window.nodeCanvas.testWebhookSend('${node.id}')" style="width:100%; border-color:#0ea5e9; color:#38bdf8; font-weight:700; height:34px; border-radius:6px; display:flex; align-items:center; justify-content:center; gap:6px;">
            ${canvasT('inspector_webhook_test_btn', '⚡ Test Webhook')}
          </button>
          <div id="webhook-test-status-${node.id}" style="display:none; font-size:11px; margin-top:6px; padding:6px 8px; border-radius:4px; background:rgba(15, 23, 42, 0.6); word-break:break-all;"></div>
        </div>
      `;
    } else if (node.type === 'emit_event') {
      fieldsHTML += this.renderEmitEventHelper(node);
    } else if (node.type === 'loop') {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_loop_keys', 'Loop Keys (comma-separated)')}</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="inspector-input" value="${(node.data?.keys || []).join(', ')}" placeholder="${window.currentLang === 'en' ? 'Click to record key...' : 'คลิกเพื่อบันทึกคีย์...'}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'comma_keys')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; cursor:pointer; font-family:'JetBrains Mono'; color:#60a5fa;" />
            <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'comma_keys')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
          </div>
        </div>
        ${this.renderIntervalHelper(node)}
        <div class="inspector-field-group" style="margin-top:6px;">
          <label class="inspector-label">${canvasT('inspector_jitter_label', 'Jitter Random (ms)')}</label>
          <input type="number" class="inspector-input" value="${node.data?.jitter || 0}" min="0" max="5000" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'jitter', parseInt(this.value, 10))" />
        </div>
        <div class="inspector-field-group" style="margin-top:4px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
            <input type="checkbox" ${node.data?.executeImmediately !== false ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', 'executeImmediately', this.checked)" style="accent-color:#3b82f6; cursor:pointer;" />
            <span>${canvasT('inspector_exec_immediately', 'Execute Immediately on Start')}</span>
          </label>
        </div>
        ${this.renderSkillCooldownHelper(node)}
      `;
    } else if (node.type === 'buff_sequence') {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_skill_keys', 'Skill Queue Keys (comma-separated)')}</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="inspector-input" value="${(node.data?.keys || []).join(', ')}" placeholder="${window.currentLang === 'en' ? 'Click to record key...' : 'คลิกเพื่อบันทึกคีย์...'}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'comma_keys')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; cursor:pointer; font-family:'JetBrains Mono'; color:#60a5fa;" />
            <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'comma_keys')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
          </div>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_delay_between_skills', 'Delay Between Skills (ms)')}</label>
          <input type="number" class="inspector-input" value="${node.data?.delayBuff ?? 800}" min="50" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayBuff', parseInt(this.value, 10))" />
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_delay_after_seq', 'Delay After Sequence (ms)')}</label>
          <input type="number" class="inspector-input" value="${node.data?.delayAfter ?? 0}" min="0" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayAfter', parseInt(this.value, 10))" />
        </div>
        ${this.renderSkillCooldownHelper(node)}
      `;
    } else if (node.type === 'key_press') {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_key_to_press', 'Key to Press')}</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="inspector-input" value="${(node.data?.keys || []).join(', ') || node.data?.targetKey || ''}" placeholder="${window.currentLang === 'en' ? 'Click to record key...' : 'คลิกเพื่อบันทึกคีย์...'}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'single_key')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" />
            <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'single_key')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
          </div>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_delay_after_key', 'Delay After (ms)')}</label>
          <input type="number" class="inspector-input" value="${node.data?.delayAfter ?? 0}" min="0" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayAfter', parseInt(this.value, 10))" />
        </div>
        ${this.renderSkillCooldownHelper(node)}
      `;
    } else if (node.type === 'sequencer') {
      fieldsHTML += this.renderSequencerHelper(node);
    } else if (node.type === 'loop_scheduler') {
      fieldsHTML += this.renderLoopSchedulerHelper(node);
    } else if (node.type === 'delay') {
      fieldsHTML += this.renderDelayHelper(node);
    } else if (node.type === 'branch' || node.type === 'condition') {
      fieldsHTML += this.renderBranchHelper(node);
    } else if (node.type === 'emergency_stop') {
      fieldsHTML += this.renderEmergencyStopHelper(node);
    } else if (node.type === 'sound') {
      fieldsHTML += this.renderSoundAlertHelper(node);
    } else if (node.type === 'control') {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_control_op_label', 'Control Operation')}</label>
          <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'controlOperation', this.value)">
            <option value="toggle" ${node.data?.controlOperation === 'toggle' ? 'selected' : ''}>${canvasT('controlOpToggle', 'Toggle')}</option>
            <option value="start" ${node.data?.controlOperation === 'start' ? 'selected' : ''}>${canvasT('controlOpStart', 'Start / Enable')}</option>
            <option value="stop" ${node.data?.controlOperation === 'stop' ? 'selected' : ''}>${canvasT('controlOpStop', 'Stop / Disable')}</option>
          </select>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_control_targets_label', 'Target Actions to Control')}</label>
          ${this.renderControlTargetsSelector(node)}
        </div>
      `;
    } else if (node.type === 'key_hold') {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_hold_key', 'Hold Target Key')}</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="inspector-input" value="${node.data?.targetKey || (node.data?.keys || [])[0] || '1'}" placeholder="e.g. 1 or F1" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'single_key')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" />
            <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'single_key')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
          </div>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
        ${this.renderSkillCooldownHelper(node)}
      `;
    } else if (node.type === 'forwarder') {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_forward_key', 'Forward Target Key')}</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="inspector-input" value="${node.data?.targetKey || (node.data?.keys || [])[0] || '1'}" placeholder="e.g. 1 or F1" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'single_key')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" />
            <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'single_key')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
          </div>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_delay_after_keyup', 'Delay After Key Up (ms)')}</label>
          <input type="number" class="inspector-input" value="${node.data?.delayAfter ?? 0}" min="0" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayAfter', parseInt(this.value, 10))" />
        </div>
        <div class="inspector-field-group" style="margin-top:4px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
            <input type="checkbox" ${node.data?.delayActivation ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayActivation', this.checked)" style="accent-color:#3b82f6; cursor:pointer;" />
            <span>${canvasT('inspector_delay_activation', 'Require holding trigger to activate')}</span>
          </label>
        </div>
        ${this.renderSkillCooldownHelper(node)}
      `;
    } else if (node.type === 'step_log') {
      fieldsHTML += this.renderStepLogHelper(node);
    } else if (node.type === 'var_get') {
      fieldsHTML += this.renderVarGetHelper(node);
    } else if (node.type === 'var_set' || node.type === 'variable') {
      fieldsHTML += this.renderVariableHelper(node);
    } else if (node.type === 'macro_group') {
      fieldsHTML += this.renderMacroGroupHelper(node);
    } else if (node.type === 'party_scanner') {
      fieldsHTML += this.renderPartyScannerHelper(node);
    } else if (node.type === 'party_slot') {
      fieldsHTML += this.renderPartySlotHelper(node);
    } else if (node.type === 'party_heal') {
      fieldsHTML += this.renderPartyHealHelper(node);
    } else if (node.type === 'party_buff') {
      fieldsHTML += this.renderPartyBuffHelper(node);
    } else if (node.type === 'tts') {
      fieldsHTML += this.renderTtsHelper(node);
    } else if (node.type === 'screenshot') {
      fieldsHTML += this.renderScreenshotHelper(node);
    } else if (node.type === 'format_text') {
      fieldsHTML += this.renderFormatTextHelper(node);
    } else {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_keys', 'Keys to Send')}</label>
          <input type="text" class="inspector-input" value="${(node.data?.keys || []).join(', ')}" onchange="window.nodeCanvas.updateNodeKeys('${node.id}', this.value)" />
        </div>
      `;
    }

    fieldsHTML += `
      <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.08); padding-top:14px; display:flex; gap:8px;">
        <button class="btn btn-ghost" style="flex:1; border-radius:8px; border-color:#3b82f6; color:#60a5fa; font-weight:600; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="window.nodeCanvas.duplicateSelectedNodes()" title="Duplicate Node (Shift+D)">
          ${canvasT('inspector_btn_duplicate', '📋 Duplicate')} <span style="font-size:10px; opacity:0.75; font-family:'JetBrains Mono',monospace;">(Shift+D)</span>
        </button>
        <button class="btn btn-danger" style="flex:1; border-radius:8px;" onclick="window.nodeCanvas.deleteNode('${node.id}')">${canvasT('inspector_btn_delete', '🗑️ Delete')}</button>
      </div>
    `;

    formBody.innerHTML = fieldsHTML;
    this.inspectorPanel.classList.add('open');
  },

  renderFormatTextHelper(node) {
    const template = node.data?.template !== undefined ? node.data.template : '{val_a} {val_b}';
    const pins = (Array.isArray(node.data?.pins) && node.data.pins.length > 0) ? node.data.pins : ['val_a', 'val_b'];
    const boolFormat = node.data?.boolFormat || 'true_false';
    const separator = node.data?.separator !== undefined ? node.data.separator : ' ';

    const pinBadgesHTML = pins.map(p => `
      <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.04); border:1px solid rgba(236,72,153,0.3); border-radius:6px; padding:4px 8px; margin-bottom:4px;">
        <span style="font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:700; color:#ec4899;">◀ {${p}}</span>
        <button type="button" class="btn btn-ghost" style="padding:2px 6px; font-size:11px; color:#ef4444; height:auto; line-height:1;" onclick="window.nodeCanvas.removeFormatTextPin('${node.id}', '${p}')" title="ลบ Pin นี้">✖</button>
      </div>
    `).join('');

    return `
      <div class="inspector-field-group">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <label class="inspector-label" style="margin-bottom:0;">${canvasT('inspector_format_template', window.currentLang === 'en' ? 'Text Template' : 'รูปแบบข้อความ (Template)')}</label>
          <button type="button" class="btn btn-ghost" style="padding:2px 8px; font-size:10px; color:#38bdf8; border-color:rgba(56,189,248,0.4); height:auto;" onclick="window.nodeCanvas.autoDetectFormatTextPins('${node.id}')" title="ตรวจหา {token} ใน Template แล้วสร้าง Pin ให้อัตโนมัติ">
            ⚡ ${window.currentLang === 'en' ? 'Auto-detect Pins' : 'ตรวจหา Pin อัตโนมัติ'}
          </button>
        </div>
        <textarea class="inspector-input" rows="3" placeholder="e.g. Slot {slot}: {name} (Active: {active})" oninput="window.nodeCanvas.updateNodeData('${node.id}', 'template', this.value); window.nodeCanvas.renderNodes();" style="resize:vertical; min-height:65px; font-family:'JetBrains Mono',monospace; padding:8px 10px; line-height:1.4;">${template}</textarea>
        <span style="font-size:10px; color:var(--muted); margin-top:4px; display:block; line-height:1.4;">
          💡 ใส่ชื่อพินในวงเล็บปีกกา เช่น <code>{name}</code>, <code>{slot}</code>, <code>{val_a}</code> เมื่อเชื่อมสายเข้ามา ระบบจะนำข้อความมาแทนที่ให้อัตโนมัติ
        </span>
      </div>

      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_format_pins', window.currentLang === 'en' ? 'Input Data Pins' : 'ขาเชื่อมข้อมูลนำเข้า (Data Pins)')}</label>
        <div style="max-height:140px; overflow-y:auto; margin-bottom:6px;">
          ${pinBadgesHTML || '<div style="font-size:11px; color:var(--muted); text-align:center; padding:6px 0;">ไม่มี Pin (กดเพิ่มด้านล่าง)</div>'}
        </div>
        <div style="display:flex; gap:6px;">
          <input type="text" id="new-pin-input-${node.id}" class="inspector-input" placeholder="e.g. val_c, slot, name" style="flex:1; font-family:'JetBrains Mono',monospace; font-size:11px;" onkeydown="if(event.key==='Enter'){window.nodeCanvas.addFormatTextPin('${node.id}', this.value); this.value='';}" />
          <button type="button" class="btn btn-primary" style="padding:4px 10px; font-size:11px;" onclick="const inp=document.getElementById('new-pin-input-${node.id}'); if(inp){window.nodeCanvas.addFormatTextPin('${node.id}', inp.value); inp.value='';}">
            ➕ ${window.currentLang === 'en' ? 'Add' : 'เพิ่ม'}
          </button>
        </div>
      </div>

      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_bool_format', window.currentLang === 'en' ? 'Boolean to String Format' : 'แปลง Boolean เป็นข้อความ')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'boolFormat', this.value); window.nodeCanvas.renderNodes();">
          <option value="true_false" ${boolFormat === 'true_false' ? 'selected' : ''}>true / false (สากล)</option>
          <option value="yes_no" ${boolFormat === 'yes_no' ? 'selected' : ''}>Yes / No (ใช่ / ไม่ใช่)</option>
          <option value="on_off" ${boolFormat === 'on_off' ? 'selected' : ''}>ON / OFF (เปิด / ปิด)</option>
          <option value="thai" ${boolFormat === 'thai' ? 'selected' : ''}>จริง / เท็จ (ภาษาไทย)</option>
        </select>
        <span style="font-size:10px; color:var(--muted); margin-top:4px; display:block;">หากข้อมูลที่ต่อเข้ามาเป็น Boolean ระบบจะแปลงเป็นข้อความตามรูปแบบนี้</span>
      </div>

      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_format_separator', window.currentLang === 'en' ? 'Fallback Separator' : 'ตัวคั่นสำรอง (กรณีไม่มี Template)')}</label>
        <input type="text" class="inspector-input" value="${separator}" placeholder="เว้นวรรค เช่น เคาะ space หรือ คอมม่า (, )" oninput="window.nodeCanvas.updateNodeData('${node.id}', 'separator', this.value);" />
      </div>

      <div style="background:rgba(236,72,153,0.08); border:1px solid rgba(236,72,153,0.25); border-radius:6px; padding:8px 10px; margin-top:10px;">
        <div style="font-size:11px; font-weight:700; color:#ec4899; margin-bottom:4px;">🧩 ขาต่อออก Result (msg_out):</div>
        <div style="font-size:10px; color:var(--text); line-height:1.4;">
          ต่อสายสีชมพูจาก <b>Result (msg_out)</b> เข้าหา <b>Log Message (◀ Message)</b>, <b>TTS</b> หรือ <b>Variable</b> เพื่อส่งข้อความที่รวมแล้วไปใช้งานต่อได้ทันที
        </div>
      </div>
    `;
  },

  addFormatTextPin(nodeId, pinName) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const cleanPin = (pinName || '').trim().replace(/[{}]/g, '');
    if (!cleanPin) return;

    if (!node.data) node.data = {};
    if (!Array.isArray(node.data.pins)) node.data.pins = ['val_a', 'val_b'];

    if (!node.data.pins.includes(cleanPin)) {
      node.data.pins.push(cleanPin);
      this.renderNodes();
      this.renderWires();
      this.openInspector(nodeId);
      this.onProfileChanged();
    }
  },

  removeFormatTextPin(nodeId, pinName) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.pins)) return;

    node.data.pins = node.data.pins.filter(p => p !== pinName);
    this.connections = this.connections.filter(c => !(c.toNodeId === nodeId && c.toPort === pinName));
    this.renderNodes();
    this.renderWires();
    this.openInspector(nodeId);
    this.onProfileChanged();
  },

  autoDetectFormatTextPins(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const template = node.data?.template || '';
    const matches = template.match(/\{([a-zA-Z0-9_\-]+)\}/g);
    if (matches && matches.length > 0) {
      const uniquePins = Array.from(new Set(matches.map(m => m.slice(1, -1).trim())));
      if (!node.data) node.data = {};
      node.data.pins = uniquePins;
      this.renderNodes();
      this.renderWires();
      this.openInspector(nodeId);
      this.onProfileChanged();
    }
  },


  renderStepLogHelper(node) {
    const message = node.data?.message || '';
    const showClient = node.data?.showClient === true;

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_log_message', window.currentLang === 'en' ? 'Log Message to Print' : 'ข้อความที่จะแสดงใน Log')}</label>
        <textarea class="inspector-input" rows="3" placeholder="${window.currentLang === 'en' ? 'Type message to print in terminal (or connect via pink Message pin)...' : 'พิมพ์ข้อความที่ต้องการแสดงใน Log (หรือต่อสายสีชมพูจากตัวแปร)...'}" oninput="window.nodeCanvas.updateNodeData('${node.id}', 'message', this.value); window.nodeCanvas.renderNodes();" style="resize:vertical; min-height:60px; font-family:inherit; padding:8px 10px; line-height:1.4;">${message}</textarea>
        <span style="font-size:10px; color:var(--muted); margin-top:4px; display:block; line-height:1.4;">💡 <b>Dynamic Wire Tip:</b> เชื่อมสายสีชมพูจากโหนด <b>Get Variable</b> เข้าขา <b>◀ Message</b> เพื่อนำค่าตัวแปรมาแสดงใน Log ได้</span>
      </div>
      <div class="inspector-field-group">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:12px; color:var(--text);">
          <input type="checkbox" ${showClient ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', 'showClient', this.checked); window.nodeCanvas.renderNodes();" style="accent-color:#10b981; cursor:pointer;" />
          <span>${canvasT('inspector_step_show_client', window.currentLang === 'en' ? 'Show [Client 1] tag in log' : 'แสดงป้ายระบุเลขจอ [Client 1] ใน Log')}</span>
        </label>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screen')}</label>
        ${this.renderClientButtonSelector(node)}
      </div>
    `;
  },

  renderVarGetHelper(node) {
    const vName = node.data?.varName || (node.title ? node.title.replace(/^Get /, '') : 'myVar');
    const vType = node.data?.varType || 'string';
    const defVal = node.data?.defaultValue !== undefined ? node.data.defaultValue : '';

    const allVars = this.getAvailableVariables();
    const hasCurrent = allVars.some(v => v.name === vName);
    const varOptions = allVars.map(v => {
      const typeIcon = v.type === 'number' ? '🔢' : (v.type === 'boolean' ? '🔘' : '📝');
      return `<option value="${v.name}" ${v.name === vName ? 'selected' : ''}>${typeIcon} ${v.name} (${v.type})</option>`;
    }).join('');

    let defValHTML = '';
    if (vType === 'boolean') {
      const isTrue = String(defVal) === 'true';
      defValHTML = `
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'defaultValue', this.value === 'true'); window.nodeCanvas.renderNodes();">
          <option value="false" ${!isTrue ? 'selected' : ''}>🔴 False (Off)</option>
          <option value="true" ${isTrue ? 'selected' : ''}>🟢 True (On)</option>
        </select>
      `;
    } else if (vType === 'number') {
      defValHTML = `
        <input type="number" class="inspector-input" value="${defVal || '0'}" step="any" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'defaultValue', parseFloat(this.value) || 0); window.nodeCanvas.renderNodes();" />
      `;
    } else {
      defValHTML = `
        <input type="text" class="inspector-input" value="${defVal}" placeholder="Fallback value if uninitialized..." onchange="window.nodeCanvas.updateNodeData('${node.id}', 'defaultValue', this.value); window.nodeCanvas.renderNodes();" />
      `;
    }

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_var_name', 'Variable Name')}</label>
        <div class="inspector-input-with-action">
          <select class="inspector-select" onchange="window.nodeCanvas.selectVariableForNode('${node.id}', this.value)" style="font-family:'JetBrains Mono'; font-weight:700; color:#ec4899;">
            ${!hasCurrent ? `<option value="${vName}" selected>⚠️ ${vName} (Custom)</option>` : ''}
            ${varOptions || `<option value="${vName}" selected>${vName}</option>`}
          </select>
          <button type="button" class="inspector-btn-action" onclick="window.nodeCanvas.openVariableModal(null, '${node.id}')" title="สร้างตัวแปรใหม่ (Add Variable)">➕</button>
        </div>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_var_type', 'Data Type')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'varType', this.value); window.nodeCanvas.render(); window.nodeCanvas.openInspector('${node.id}');">
          <option value="string" ${vType === 'string' ? 'selected' : ''}>${canvasT('var_type_string', '📝 String (Text - Pink)')}</option>
          <option value="number" ${vType === 'number' ? 'selected' : ''}>${canvasT('var_type_number', '🔢 Number (Integer/Float - Cyan)')}</option>
          <option value="boolean" ${vType === 'boolean' ? 'selected' : ''}>${canvasT('var_type_boolean', '🔘 Boolean (True/False - Red)')}</option>
        </select>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_var_default', 'Default Fallback Value')}</label>
        ${defValHTML}
      </div>
    `;
  },

  renderVariableHelper(node) {
    const vName = node.data?.varName || 'myVar';
    const vType = node.data?.varType || 'boolean';
    const op = node.data?.operation || (vType === 'boolean' ? 'set_true' : 'set_value');
    const opVal = node.data?.opValue !== undefined ? node.data.opValue : (vType === 'number' ? 0 : '');

    const allVars = this.getAvailableVariables();
    const hasCurrent = allVars.some(v => v.name === vName);
    const varOptions = allVars.map(v => {
      const typeIcon = v.type === 'number' ? '🔢' : (v.type === 'boolean' ? '🔘' : '📝');
      return `<option value="${v.name}" ${v.name === vName ? 'selected' : ''}>${typeIcon} ${v.name} (${v.type})</option>`;
    }).join('');

    let opOptionsHTML = '';
    let opValInputHTML = '';

    if (vType === 'boolean') {
      opOptionsHTML = `
        <option value="set_true" ${op === 'set_true' ? 'selected' : ''}>${canvasT('var_op_set_true', '🟢 Set True (Enable / On)')}</option>
        <option value="set_false" ${op === 'set_false' ? 'selected' : ''}>${canvasT('var_op_set_false', '🔴 Set False (Disable / Off)')}</option>
        <option value="toggle" ${op === 'toggle' ? 'selected' : ''}>${canvasT('var_op_toggle', '🔄 Toggle (True ⇄ False)')}</option>
        <option value="set_value" ${op === 'set_value' ? 'selected' : ''}>${canvasT('var_op_set_value_wire', '📥 Receive from Wire (Value In)')}</option>
        <option value="reset" ${op === 'reset' ? 'selected' : ''}>${canvasT('var_op_reset', '🔁 Reset to Initial')}</option>
      `;
      if (op === 'set_value') {
        opValInputHTML = `
          <div style="font-size:11px; color:#38bdf8; margin-top:8px; background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.25); border-radius:6px; padding:6px 10px; line-height:1.4;">
            💡 ${window.currentLang === 'en' ? 'Connect a data wire to the <b>◀ Value In</b> pin on Canvas to set this variable dynamically.' : 'นำสายสัญญาณจากโหนดอื่นมาต่อเข้าที่พอร์ต <b>◀ Value In</b> บน Canvas เพื่อส่งค่า'}
          </div>
        `;
      }
    } else if (vType === 'number') {
      opOptionsHTML = `
        <option value="set_value" ${op === 'set_value' ? 'selected' : ''}>${canvasT('var_op_set_value', '✏️ Set Value / Value In')}</option>
        <option value="increment" ${op === 'increment' ? 'selected' : ''}>${canvasT('var_op_increment', '➕ Increment (+step)')}</option>
        <option value="decrement" ${op === 'decrement' ? 'selected' : ''}>${canvasT('var_op_decrement', '➖ Decrement (-step)')}</option>
        <option value="reset" ${op === 'reset' ? 'selected' : ''}>${canvasT('var_op_reset', '🔁 Reset to Initial')}</option>
      `;
      if (op === 'set_value') {
        opValInputHTML = `
          <div class="inspector-field-group" style="margin-top:8px;">
            <label class="inspector-label">${window.currentLang === 'en' ? 'Value to Set (or connect via Value In pin)' : 'ค่าตัวเลขที่ต้องการกำหนด (หรือต่อสายเข้า Value In)'}</label>
            <input type="number" class="inspector-input" value="${opVal}" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'opValue', parseFloat(this.value) || 0)" />
            <div style="font-size:10.5px; color:#94a3b8; margin-top:4px;">💡 นำสายมาต่อที่พอร์ต <b>◀ Value In</b> บน Canvas หรือใส่ตัวเลขตรงนี้</div>
          </div>
        `;
      } else if (op === 'increment' || op === 'decrement') {
        opValInputHTML = `
          <div class="inspector-field-group" style="margin-top:8px;">
            <label class="inspector-label">${canvasT('inspector_var_op_value', 'Value / Step Amount')}</label>
            <input type="number" class="inspector-input" value="${opVal}" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'opValue', parseFloat(this.value) || 0)" />
          </div>
        `;
      }
    } else {
      opOptionsHTML = `
        <option value="set_value" ${op === 'set_value' ? 'selected' : ''}>${canvasT('var_op_set_value', '✏️ Set Value / Value In')}</option>
        <option value="reset" ${op === 'reset' ? 'selected' : ''}>${canvasT('var_op_reset', '🔁 Reset to Initial')}</option>
      `;
      if (op === 'set_value') {
        opValInputHTML = `
          <div class="inspector-field-group" style="margin-top:8px;">
            <label class="inspector-label">${window.currentLang === 'en' ? 'Text Value (or connect via Value In pin)' : 'ข้อความที่ต้องการกำหนด (หรือต่อสายเข้า Value In)'}</label>
            <input type="text" class="inspector-input" value="${opVal}" placeholder="New value..." onchange="window.nodeCanvas.updateNodeData('${node.id}', 'opValue', this.value)" />
            <div style="font-size:10.5px; color:#94a3b8; margin-top:4px;">💡 นำสายมาต่อที่พอร์ต <b>◀ Value In</b> บน Canvas หรือพิมพ์ข้อความตรงนี้</div>
          </div>
        `;
      }
    }

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_var_name', 'Variable Name')}</label>
        <div class="inspector-input-with-action">
          <select class="inspector-select" onchange="window.nodeCanvas.selectVariableForNode('${node.id}', this.value)" style="font-family:'JetBrains Mono'; font-weight:700; color:#a855f7;">
            ${!hasCurrent ? `<option value="${vName}" selected>⚠️ ${vName} (Custom)</option>` : ''}
            ${varOptions || `<option value="${vName}" selected>${vName}</option>`}
          </select>
          <button type="button" class="inspector-btn-action" onclick="window.nodeCanvas.openVariableModal(null, '${node.id}')" title="สร้างตัวแปรใหม่ (Add Variable)">➕</button>
        </div>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_var_type', 'Variable Type')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'varType', this.value); window.nodeCanvas.render(); window.nodeCanvas.openInspector('${node.id}');">
          <option value="boolean" ${vType === 'boolean' ? 'selected' : ''}>${canvasT('var_type_boolean', '🔘 Boolean (True / False - Red)')}</option>
          <option value="number" ${vType === 'number' ? 'selected' : ''}>${canvasT('var_type_number', '🔢 Number (Counter / Value - Cyan)')}</option>
          <option value="string" ${vType === 'string' ? 'selected' : ''}>${canvasT('var_type_string', '📝 Text (String - Pink)')}</option>
        </select>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_var_action', 'Action (When Executed)')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.setNodeOperation('${node.id}', this.value);">
          ${opOptionsHTML}
        </select>
        ${opValInputHTML}
      </div>
    `;
  },

  renderPartyScannerHelper(node) {
    const isEn = window.currentLang === 'en';
    const scanIntervalMs = node.data?.scanIntervalMs ?? 250;
    const lowHpThreshold = node.data?.lowHpThreshold ?? 70;
    const scanRegion = node.data?.scanRegion || 'left';

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screen (Vision)')}</label>
        ${this.renderClientButtonSelector(node)}
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_scan_region', isEn ? 'Scan Region (Screen Area)' : 'พื้นที่สแกนบนหน้าจอ')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'scanRegion', this.value);">
          <option value="left" ${scanRegion === 'left' ? 'selected' : ''}>👈 ${canvasT('region_left', isEn ? 'Left Half (Recommended)' : 'ฝั่งซ้ายของจอ (แนะนำ - ตัดสัญญาณกวน)')}</option>
          <option value="full" ${scanRegion === 'full' ? 'selected' : ''}>🖥️ ${canvasT('region_full', isEn ? 'Full Screen (Entire Window)' : 'ทั่วทั้งหน้าจอ (สแกนทั้งจอ)')}</option>
          <option value="top_left" ${scanRegion === 'top_left' ? 'selected' : ''}>↖️ ${canvasT('region_top_left', isEn ? 'Top-Left Corner' : 'มุมซ้ายบนของจอ')}</option>
          <option value="right" ${scanRegion === 'right' ? 'selected' : ''}>👉 ${canvasT('region_right', isEn ? 'Right Half' : 'ฝั่งขวาของจอ')}</option>
        </select>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_party_scan_interval', 'Scan Interval (ms)')}</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="number" class="inspector-input" value="${scanIntervalMs}" min="50" max="3000" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'scanIntervalMs', parseInt(this.value, 10))" style="flex:1;" />
          <span style="font-size:11px; opacity:0.6;">(50 - 2000 ms)</span>
        </div>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_party_low_hp', 'Low HP Alert Threshold (%)')}</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="range" min="10" max="95" step="5" value="${lowHpThreshold}" style="flex:1; accent-color:#ef4444;" oninput="this.nextElementSibling.innerText = this.value + '%'; window.nodeCanvas.updateNodeData('${node.id}', 'lowHpThreshold', parseInt(this.value, 10));" />
          <span style="min-width:44px; font-weight:700; color:#ef4444; font-family:'JetBrains Mono',monospace;">${lowHpThreshold}%</span>
        </div>
      </div>
      <div class="inspector-field-group" style="margin-top:6px;">
        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
          <input type="checkbox" ${node.data?.showOverlay !== false ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', 'showOverlay', this.checked)" style="accent-color:#06b6d4; cursor:pointer;" />
          <span>👁️ ${canvasT('inspector_party_show_overlay', 'Visual Overlay')}</span>
        </label>
      </div>
    `;
  },

  renderPartySlotHelper(node) {
    const isEn = window.currentLang === 'en';
    const targetSlot = node.data?.targetSlot ?? 1;
    const delayAfterClick = node.data?.delayAfterClick ?? 80;

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_clients', isEn ? 'Target Client Screen (Vision)' : 'เลือกหน้าจอเป้าหมาย (Client)')}</label>
        ${this.renderClientButtonSelector(node)}
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_slot', isEn ? 'Target Party Member Slot' : 'ช่องสมาชิกปาร์ตี้เป้าหมาย')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'targetSlot', parseInt(this.value, 10));">
          <option value="1" ${targetSlot == 1 ? 'selected' : ''}>${canvasT('slot_leader_desc', isEn ? 'Slot 1 (Party Leader)' : 'ช่อง 1 (หัวตี้ / เดินตาม)')}</option>
          <option value="2" ${targetSlot == 2 ? 'selected' : ''}>Slot 2</option>
          <option value="3" ${targetSlot == 3 ? 'selected' : ''}>Slot 3</option>
          <option value="4" ${targetSlot == 4 ? 'selected' : ''}>Slot 4</option>
          <option value="5" ${targetSlot == 5 ? 'selected' : ''}>Slot 5</option>
          <option value="6" ${targetSlot == 6 ? 'selected' : ''}>Slot 6</option>
          <option value="7" ${targetSlot == 7 ? 'selected' : ''}>Slot 7</option>
          <option value="8" ${targetSlot == 8 ? 'selected' : ''}>Slot 8</option>
        </select>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_party_delay_click', isEn ? 'Delay After Click (ms)' : 'หน่วงเวลาหลังคลิก (ms)')}</label>
        <input type="number" class="inspector-input" value="${delayAfterClick}" min="0" max="2000" step="20" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayAfterClick', parseInt(this.value, 10))" />
      </div>
      <div class="inspector-field-group" style="margin-top:6px;">
        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
          <input type="checkbox" ${node.data?.showOverlay !== false ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', 'showOverlay', this.checked)" style="accent-color:#06b6d4; cursor:pointer;" />
          <span>👁️ ${canvasT('inspector_party_show_overlay', isEn ? 'Visual Overlay' : 'แสดง Overlay บนจอ')}</span>
        </label>
      </div>
    `;
  },

  renderPartyHealHelper(node) {
    const lowHpThreshold = node.data?.lowHpThreshold ?? 70;
    const delayAfterClick = node.data?.delayAfterClick ?? 80;

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screen (Vision)')}</label>
        ${this.renderClientButtonSelector(node)}
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_party_low_hp', 'Low HP Threshold (%)')}</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="range" min="10" max="95" step="5" value="${lowHpThreshold}" style="flex:1; accent-color:#ef4444;" oninput="this.nextElementSibling.innerText = this.value + '%'; window.nodeCanvas.updateNodeData('${node.id}', 'lowHpThreshold', parseInt(this.value, 10));" />
          <span style="min-width:44px; font-weight:700; color:#ef4444; font-family:'JetBrains Mono',monospace;">${lowHpThreshold}%</span>
        </div>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_party_delay_click', 'Delay After Click (ms)')}</label>
        <input type="number" class="inspector-input" value="${delayAfterClick}" min="0" max="2000" step="20" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayAfterClick', parseInt(this.value, 10))" />
      </div>
      <div class="inspector-field-group" style="margin-top:6px;">
        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
          <input type="checkbox" ${node.data?.showOverlay !== false ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', 'showOverlay', this.checked)" style="accent-color:#06b6d4; cursor:pointer;" />
          <span>👁️ ${canvasT('inspector_party_show_overlay', 'Visual Overlay')}</span>
        </label>
      </div>
    `;
  },

  renderPartyBuffHelper(node) {
    const isEn = window.currentLang === 'en';
    const delayAfterClick = node.data?.delayAfterClick ?? 80;
    const scanRegion = node.data?.scanRegion || 'auto';

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screen (Vision)')}</label>
        ${this.renderClientButtonSelector(node)}
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_party_scan_region', isEn ? 'Party Window Position' : 'ตำแหน่งหน้าต่างปาร์ตี้บนจอ')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'scanRegion', this.value);">
          <option value="auto" ${scanRegion === 'auto' ? 'selected' : ''}>🔍 ${canvasT('region_auto', isEn ? 'Auto (Detect Left/Right)' : 'อัตโนมัติ (ตรวจจับซ้าย/ขวา Auto)')}</option>
          <option value="right" ${scanRegion === 'right' ? 'selected' : ''}>👉 ${canvasT('region_right', isEn ? 'Right Half' : 'ฝั่งขวาของจอ')}</option>
          <option value="left" ${scanRegion === 'left' ? 'selected' : ''}>👈 ${canvasT('region_left', isEn ? 'Left Half' : 'ฝั่งซ้ายของจอ')}</option>
          <option value="full" ${scanRegion === 'full' ? 'selected' : ''}>🖥️ ${canvasT('region_full', isEn ? 'Full Screen' : 'ทั่วทั้งหน้าจอ')}</option>
        </select>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_party_delay_click', 'Delay After Click (ms)')}</label>
        <input type="number" class="inspector-input" value="${delayAfterClick}" min="0" max="2000" step="20" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayAfterClick', parseInt(this.value, 10))" />
      </div>
      <div class="inspector-field-group" style="margin-top:6px;">
        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
          <input type="checkbox" ${node.data?.showOverlay !== false ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', 'showOverlay', this.checked)" style="accent-color:#06b6d4; cursor:pointer;" />
          <span>👁️ ${canvasT('inspector_party_show_overlay', 'Visual Overlay')}</span>
        </label>
      </div>
    `;
  },

  renderTtsHelper(node) {
    const isEn = window.currentLang === 'en';
    const text = node.data?.text || '';
    const voice = node.data?.voice || 'th-TH-PremwadeeNeural';
    const volume = node.data?.volume !== undefined ? node.data.volume : 100;

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_tts_message', isEn ? 'TTS Message to Speak' : 'ข้อความที่ต้องการให้พูด (TTS Message)')}</label>
        <textarea class="inspector-input" rows="3" placeholder="${isEn ? 'e.g. Party HP is critically low!' : 'เช่น เลือดในตี้ต่ำกว่าเกณฑ์'}" oninput="window.nodeCanvas.updateNodeData('${node.id}', 'text', this.value)" style="resize:vertical; min-height:65px; font-family:inherit; padding:8px 10px; line-height:1.4;">${text}</textarea>
        <span style="font-size:10px; color:var(--muted); margin-top:2px;">${canvasT('inspector_tts_message_hint', isEn ? 'Synthesized with realistic Neural AI voice' : 'ข้อความจะถูกสังเคราะห์ด้วย Neural AI เสียงเหมือนคนจริง')}</span>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_tts_voice', isEn ? 'Voice Model' : 'เสียงพูด (Voice Model)')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'voice', this.value);">
          <optgroup label="${isEn ? '🇹🇭 Thai (TH)' : '🇹🇭 ภาษาไทย'}">
            <option value="th-TH-PremwadeeNeural" ${voice === 'th-TH-PremwadeeNeural' ? 'selected' : ''}>👩 ${isEn ? 'Premwadee (Female)' : 'เปรมวดี (หญิง)'}</option>
            <option value="th-TH-NiwatNeural" ${voice === 'th-TH-NiwatNeural' ? 'selected' : ''}>👨 ${isEn ? 'Niwat (Male)' : 'นิวัต (ชาย)'}</option>
          </optgroup>
          <optgroup label="${isEn ? '🇺🇸 English (EN)' : '🇺🇸 ภาษาอังกฤษ'}">
            <option value="en-US-JennyNeural" ${voice === 'en-US-JennyNeural' ? 'selected' : ''}>👩 Jenny (${isEn ? 'Female' : 'หญิง'})</option>
            <option value="en-US-GuyNeural" ${voice === 'en-US-GuyNeural' ? 'selected' : ''}>👨 Guy (${isEn ? 'Male' : 'ชาย'})</option>
          </optgroup>
        </select>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_tts_volume', isEn ? 'Volume (%)' : 'ระดับเสียง (Volume %)')}</label>
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="range" min="0" max="100" step="5" value="${volume}" style="flex:1; accent-color:#c084fc;" oninput="this.nextElementSibling.innerText = this.value + '%'; window.nodeCanvas.updateNodeData('${node.id}', 'volume', parseInt(this.value, 10));" />
          <span style="min-width:44px; font-weight:700; color:#c084fc; font-family:'JetBrains Mono',monospace;">${volume}%</span>
        </div>
      </div>
    `;
  },

  renderScreenshotHelper(node) {
    const isEn = window.currentLang === 'en';
    const targetClient = String(node.data?.targetClient || '1');
    const captureRegion = node.data?.captureRegion || 'full';
    const annotate = node.data?.annotate !== false;
    const prefix = node.data?.prefix || 'error_snap';
    const subfolder = node.data?.subfolder !== undefined ? node.data.subfolder : `client_${targetClient}`;

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_clients', isEn ? 'Target Client Screen' : 'จอเป้าหมาย')}</label>
        ${this.renderClientButtonSelector(node)}
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_screenshot_region', isEn ? 'Capture Area' : 'พื้นที่ถ่ายภาพ')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'captureRegion', this.value);">
          <option value="full" ${captureRegion === 'full' ? 'selected' : ''}>🖥️ ${canvasT('region_full', isEn ? 'Full Viewport' : 'เต็มหน้าจอเกม')}</option>
          <option value="party" ${captureRegion === 'party' ? 'selected' : ''}>👥 ${canvasT('region_party', isEn ? 'Party Area' : 'โซนหน้าต่างปาร์ตี้')}</option>
          <option value="right" ${captureRegion === 'right' ? 'selected' : ''}>👉 ${canvasT('region_right', isEn ? 'Right Half' : 'ฝั่งขวาของจอ')}</option>
          <option value="left" ${captureRegion === 'left' ? 'selected' : ''}>👈 ${canvasT('region_left', isEn ? 'Left Half' : 'ฝั่งซ้ายของจอ')}</option>
        </select>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_screenshot_folder', isEn ? 'Storage Subfolder' : 'โฟลเดอร์จัดเก็บภาพ')}</label>
        <input type="text" class="inspector-input" value="${subfolder}" placeholder="เช่น client_${targetClient} หรือ party_errors" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'subfolder', this.value.trim());" />
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_screenshot_prefix', isEn ? 'File Prefix' : 'คำนำหน้าชื่อไฟล์')}</label>
        <input type="text" class="inspector-input" value="${prefix}" placeholder="error_snap" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'prefix', this.value.trim());" />
        <div style="margin-top:8px; padding:10px; background:rgba(15,23,42,0.6); border:1px solid rgba(56,189,248,0.2); border-radius:6px; font-size:11px; line-height:1.45;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:5px;">
            <div style="display:flex; align-items:center; gap:6px; color:#38bdf8; font-weight:600; font-size:11px;">
              <span>📁</span>
              <span>${isEn ? 'Save Location:' : 'ตำแหน่งบันทึกไฟล์:'}</span>
            </div>
            <button type="button" onclick="window.nodeCanvas.openScreenshotFolder('${node.id}');" style="display:inline-flex; align-items:center; gap:5px; padding:3px 9px; font-size:11px; border-radius:4px; background:rgba(56,189,248,0.2); border:1px solid rgba(56,189,248,0.4); color:#38bdf8; cursor:pointer; font-weight:600; transition:all 0.15s;" onmouseover="this.style.background='rgba(56,189,248,0.35)'" onmouseout="this.style.background='rgba(56,189,248,0.2)'">
              <span>📂</span>
              <span>${isEn ? 'Open Folder' : 'เปิดโฟลเดอร์'}</span>
            </button>
          </div>
          <div style="font-family:'JetBrains Mono',monospace; color:#f1f5f9; font-size:11px; word-break:break-all;">
            ./screenshots/<span style="color:#38bdf8; font-weight:700;">${subfolder || ('client_' + targetClient)}</span>/
          </div>
          <div style="font-family:'JetBrains Mono',monospace; color:#94a3b8; font-size:10.5px; margin-top:3px; word-break:break-all;">
            screenshot_c${targetClient}_${prefix}_[date].jpg
          </div>
        </div>
      </div>
      <div class="inspector-field-group" style="margin-top:6px;">
        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
          <input type="checkbox" ${annotate ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', 'annotate', this.checked)" style="accent-color:#10b981; cursor:pointer;" />
          <span>🔬 ${canvasT('inspector_screenshot_annotate', isEn ? 'Annotate Vision Diagnostics (Bounding boxes & Pixel marks)' : 'วาดตีกรอบพิกเซลวิเคราะห์ปัญหา (Diagnostics)')}</span>
        </label>
      </div>
    `;
  },

  renderIntervalHelper(node) {
    const curVal = node.data?.interval !== undefined ? node.data.interval : 1000;
    const presets = [
      { ms: 500, label: '500ms' },
      { ms: 800, label: '800ms' },
      { ms: 1000, label: '1s' },
      { ms: 1500, label: '1.5s' },
      { ms: 2000, label: '2s' },
      { ms: 3000, label: '3s' },
      { ms: 5000, label: '5s' },
      { ms: 10000, label: '10s' }
    ];
    const secStr = (curVal / 1000).toFixed(curVal >= 10000 ? 0 : (curVal % 1000 === 0 ? 0 : 1));

    let html = `
      <div class="inspector-field-group">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label class="inspector-label">${canvasT('inspector_interval_label', 'Loop Interval (ms)')}</label>
          <span id="interval-badge-${node.id}" style="font-size:11px; font-weight:700; color:#60a5fa; font-family:'JetBrains Mono';">${secStr}s (${curVal}ms)</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" onclick="window.nodeCanvas.adjustInterval('${node.id}', -100)" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px; padding:6px 8px; font-size:11px; font-weight:700; cursor:pointer;" title="-100ms">-100</button>
          <input type="number" class="inspector-input" id="inspector-interval-input-${node.id}" value="${curVal}" min="50" max="60000" step="50" style="flex:1; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" oninput="window.nodeCanvas.onIntervalInput('${node.id}', this.value)" onchange="window.nodeCanvas.onIntervalChange('${node.id}', this.value)" />
          <button type="button" onclick="window.nodeCanvas.adjustInterval('${node.id}', 100)" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px; padding:6px 8px; font-size:11px; font-weight:700; cursor:pointer;" title="+100ms">+100</button>
        </div>
        <input type="range" id="inspector-interval-slider-${node.id}" min="100" max="60000" step="50" value="${Math.min(curVal, 60000)}" style="width:100%; accent-color:#3b82f6; cursor:pointer; margin-top:4px;" oninput="window.nodeCanvas.onIntervalInput('${node.id}', this.value)" onchange="window.nodeCanvas.onIntervalChange('${node.id}', this.value)" />
        <div id="interval-presets-${node.id}" style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
          ${presets.map(p => {
      const isCur = curVal === p.ms;
      return `<button type="button" onclick="window.nodeCanvas.setPresetInterval('${node.id}', ${p.ms})" style="background:${isCur ? '#3b82f6' : 'rgba(255,255,255,0.06)'}; border:1px solid ${isCur ? '#60a5fa' : 'rgba(255,255,255,0.1)'}; color:${isCur ? '#fff' : 'var(--muted)'}; font-size:10px; font-weight:600; padding:3px 7px; border-radius:6px; cursor:pointer; transition:all 0.15s;">${p.label}</button>`;
    }).join('')}
        </div>
      </div>
    `;
    return html;
  },

  renderDelayHelper(node) {
    const curVal = node.data?.delayMs !== undefined ? node.data.delayMs : (node.data?.interval || 1000);
    const presets = [
      { ms: 500, label: '500ms' },
      { ms: 800, label: '800ms' },
      { ms: 1000, label: '1s' },
      { ms: 1500, label: '1.5s' },
      { ms: 2000, label: '2s' },
      { ms: 3000, label: '3s' },
      { ms: 5000, label: '5s' },
      { ms: 10000, label: '10s' }
    ];
    const secStr = (curVal / 1000).toFixed(curVal >= 10000 ? 0 : (curVal % 1000 === 0 ? 0 : 1));

    let html = `
      <div class="inspector-field-group">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label class="inspector-label">⏱️ ${canvasT('inspector_delay_duration', 'Delay Duration (ms)')}</label>
          <span id="delay-badge-${node.id}" style="font-size:11px; font-weight:700; color:#60a5fa; font-family:'JetBrains Mono';">${secStr}s (${curVal}ms)</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" onclick="window.nodeCanvas.adjustDelay('${node.id}', -100)" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px; padding:6px 8px; font-size:11px; font-weight:700; cursor:pointer;" title="-100ms">-100</button>
          <input type="number" class="inspector-input" id="inspector-delay-input-${node.id}" value="${curVal}" min="50" max="60000" step="50" style="flex:1; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" oninput="window.nodeCanvas.onDelayInput('${node.id}', this.value)" onchange="window.nodeCanvas.onDelayChange('${node.id}', this.value)" />
          <button type="button" onclick="window.nodeCanvas.adjustDelay('${node.id}', 100)" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px; padding:6px 8px; font-size:11px; font-weight:700; cursor:pointer;" title="+100ms">+100</button>
        </div>
        <input type="range" id="inspector-delay-slider-${node.id}" min="100" max="60000" step="50" value="${Math.min(curVal, 60000)}" style="width:100%; accent-color:#3b82f6; cursor:pointer; margin-top:4px;" oninput="window.nodeCanvas.onDelayInput('${node.id}', this.value)" onchange="window.nodeCanvas.onDelayChange('${node.id}', this.value)" />
        <div id="delay-presets-${node.id}" style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
          ${presets.map(p => {
      const isCur = curVal === p.ms;
      return `<button type="button" onclick="window.nodeCanvas.setPresetDelay('${node.id}', ${p.ms})" style="background:${isCur ? '#3b82f6' : 'rgba(255,255,255,0.06)'}; border:1px solid ${isCur ? '#60a5fa' : 'rgba(255,255,255,0.1)'}; color:${isCur ? '#fff' : 'var(--muted)'}; font-size:10px; font-weight:600; padding:3px 7px; border-radius:6px; cursor:pointer; transition:all 0.15s;">${p.label}</button>`;
    }).join('')}
        </div>
      </div>
    `;
    return html;
  },

  renderControlTargetsSelector(node) {
    const otherNodes = this.nodes.filter(n => n.id !== node.id && n.type !== 'trigger');
    const curTargets = Array.isArray(node.data?.controlTargetIds) ? node.data.controlTargetIds : [];

    if (otherNodes.length === 0) {
      return `<div style="font-size:11px; color:var(--muted); padding:4px 0;">ไม่มี Action อื่นใน Canvas</div>`;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:4px; max-height:160px; overflow-y:auto; margin-top:4px;">';
    otherNodes.forEach(other => {
      const isChecked = curTargets.includes(other.id);
      html += `
        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); background:rgba(255,255,255,0.03); padding:5px 8px; border-radius:6px; cursor:pointer;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.nodeCanvas.toggleControlTarget('${node.id}', '${other.id}', this.checked)" style="accent-color:#3b82f6; cursor:pointer;">
          <span>${other.title || other.type}</span>
          <span style="font-size:10px; color:var(--muted); margin-left:auto;">(${other.type})</span>
        </label>
      `;
    });
    html += '</div>';
    return html;
  },

  toggleControlTarget(nodeId, targetId, checked) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    if (!Array.isArray(node.data.controlTargetIds)) node.data.controlTargetIds = [];

    if (checked) {
      if (!node.data.controlTargetIds.includes(targetId)) node.data.controlTargetIds.push(targetId);
    } else {
      node.data.controlTargetIds = node.data.controlTargetIds.filter(id => id !== targetId);
    }
    this.renderNodes();
    this.onProfileChanged();
  },

  updateNodeKeys(nodeId, valStr) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const keys = String(valStr).split(',').map(s => s.trim()).filter(Boolean);
    node.data.keys = keys.length > 0 ? keys : ['1'];
    this.renderNodes();
    this.addHistory('⌨️', `แก้ไข Keys ของ "${node.title || node.type}" เป็น [${node.data.keys.join(', ')}]`);
    this.onProfileChanged();
  },

  updateTriggerType(nodeId, type) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    node.data.triggerType = type;
    if (type === 'mouse' && !['4', '5'].includes(String(node.data.triggerValue))) {
      node.data.triggerValue = '4';
    } else if (type === 'event') {
      if (!node.data.triggerValue || ['1', '4', '5', 'start_farm'].includes(String(node.data.triggerValue))) {
        node.data.triggerValue = 'party_heal';
      }
    } else if (type === 'webhook') {
      if (!node.data.triggerValue || ['1', '4', '5', 'party_heal'].includes(String(node.data.triggerValue))) {
        node.data.triggerValue = 'start_farm';
      }
    } else if (type === 'keyboard' && ['4', '5'].includes(String(node.data.triggerValue))) {
      node.data.triggerValue = '1';
    }
    this.renderNodes();
    this.openInspector(node.id);
    this.addHistory('⚡', `เปลี่ยนประเภท Trigger ของ "${node.title || node.type}" เป็น ${type}`);
    this.onProfileChanged();
  },

  updateWebhookTriggerVal(nodeId, val) {
    this.updateNodeData(nodeId, 'triggerValue', val);
    const codeEl = document.getElementById(`webhook-trigger-url-${nodeId}`);
    if (codeEl) {
      const baseUrl = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'http://localhost:3088';
      codeEl.textContent = `${baseUrl}/api/trigger/${val || '{eventName}'}`;
    }
  },

  testWebhookSend(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const statusBox = document.getElementById(`webhook-test-status-${nodeId}`);
    const btn = document.getElementById(`btn-test-webhook-${nodeId}`);
    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.style.color = '#38bdf8';
      statusBox.textContent = canvasT('inspector_webhook_testing', '⏳ Sending test request...');
    }
    if (btn) btn.disabled = true;

    fetch('/api/webhook/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: node.data?.url || '',
        method: node.data?.method || 'POST',
        headers: node.data?.headers || '',
        payload: node.data?.payload !== undefined ? node.data.payload : '',
        timeoutMs: node.data?.timeoutMs || 5000
      })
    })
      .then(res => res.json())
      .then(data => {
        if (btn) btn.disabled = false;
        if (!statusBox) return;
        if (data.success) {
          statusBox.style.color = '#34d399';
          statusBox.textContent = `${canvasT('inspector_webhook_test_ok', '✅ Test succeeded! HTTP Status: ')} ${data.status} ${data.statusText || ''}`;
        } else {
          statusBox.style.color = '#ef4444';
          statusBox.textContent = `${canvasT('inspector_webhook_test_err', '❌ Test failed: ')} ${data.error || ('Status ' + data.status)}`;
        }
      })
      .catch(err => {
        if (btn) btn.disabled = false;
        if (statusBox) {
          statusBox.style.color = '#ef4444';
          statusBox.textContent = `${canvasT('inspector_webhook_test_err', '❌ Test failed: ')} ${err.message}`;
        }
      });
  },

  openScreenshotFolder(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    const targetClient = String(node?.data?.targetClient || '1');
    const rawSub = (node?.data?.subfolder !== undefined && node.data.subfolder !== '') ? node.data.subfolder : (node?.data?.folder || `client_${targetClient}`);
    const subfolder = String(rawSub).trim();

    if (typeof window.toast === 'function') {
      window.toast(`📂 กำลังเปิดโฟลเดอร์ screenshots/${subfolder}...`, 'info');
    }

    fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subfolder })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (typeof window.toast === 'function') {
            window.toast(`✅ เปิดโฟลเดอร์เรียบร้อยแล้ว`, 'success');
          }
        } else {
          if (typeof window.toast === 'function') {
            window.toast(`❌ ไม่สามารถเปิดโฟลเดอร์ได้: ${data.error}`, 'error');
          }
        }
      })
      .catch(err => {
        if (typeof window.toast === 'function') {
          window.toast(`❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์: ${err.message}`, 'error');
        }
      });
  },

  renderEmitEventHelper(node) {
    const isEn = window.currentLang === 'en';
    const eventName = node.data?.eventName || '';
    return `
      <div class="inspector-field-group">
        <label class="inspector-label">📡 ${canvasT('inspector_event_name_label', isEn ? 'Event Name to Broadcast' : 'ชื่อเหตุการณ์ที่จะส่ง (Event Name)')}</label>
        <input type="text" class="inspector-input" value="${eventName}" placeholder="e.g. party_heal or boss_spawn" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'eventName', this.value.trim())" style="font-family:'JetBrains Mono'; font-weight:700; color:#06b6d4;" />
        <span style="font-size:10px; color:var(--muted); margin-top:4px; display:block;">
          ${canvasT('inspector_emit_event_hint', isEn ? 'This signal will be broadcasted to all active profiles listening for this event name.' : 'สัญญาณนี้จะถูกส่งไปยังทุกโปรไฟล์ที่เปิดใช้งาน (Active Profiles) ที่กำลังรอฟัง Event ชื่อนี้')}
        </span>
      </div>
    `;
  },

  onIntervalInput(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const intVal = Math.min(60000, Math.max(50, parseInt(val, 10) || 1000));
    node.data.interval = intVal;

    // Update UI elements in place without re-rendering form body to preserve slider drag
    const numInput = document.getElementById(`inspector-interval-input-${nodeId}`);
    const sliderInput = document.getElementById(`inspector-interval-slider-${nodeId}`);
    const badge = document.getElementById(`interval-badge-${nodeId}`);

    if (numInput && numInput.value != intVal) numInput.value = intVal;
    if (sliderInput && sliderInput.value != intVal) sliderInput.value = intVal;
    if (badge) {
      const secStr = (intVal / 1000).toFixed(intVal >= 10000 ? 0 : (intVal % 1000 === 0 ? 0 : 1));
      badge.textContent = `${secStr}s (${intVal}ms)`;
    }

    this.onProfileChanged();
  },

  onIntervalChange(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const intVal = Math.min(60000, Math.max(50, parseInt(val, 10) || 1000));
    node.data.interval = intVal;
    this.renderNodes();
    this.openInspector(node.id);
    this.addHistory('⏱️', `ปรับ Interval ของ "${node.title || node.type}" เป็น ${intVal}ms`);
    this.onProfileChanged();
  },

  setPresetInterval(nodeId, ms) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    node.data.interval = ms;
    this.renderNodes();
    this.openInspector(node.id);
    this.addHistory('⏱️', `เลือก Preset Interval ของ "${node.title || node.type}" เป็น ${ms}ms`);
    this.onProfileChanged();
  },

  adjustInterval(nodeId, delta) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const cur = node.data.interval !== undefined ? node.data.interval : 1000;
    const nextVal = Math.min(60000, Math.max(50, cur + delta));
    node.data.interval = nextVal;
    this.renderNodes();
    this.openInspector(node.id);
    this.addHistory('⏱️', `ปรับ Interval ของ "${node.title || node.type}" เป็น ${nextVal}ms`);
    this.onProfileChanged();
  },

  onDelayInput(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const dVal = Math.min(60000, Math.max(50, parseInt(val, 10) || 1000));
    node.data.delayMs = dVal;
    node.data.interval = dVal;

    const numInput = document.getElementById(`inspector-delay-input-${nodeId}`);
    const sliderInput = document.getElementById(`inspector-delay-slider-${nodeId}`);
    const badge = document.getElementById(`delay-badge-${nodeId}`);

    if (numInput && numInput.value != dVal) numInput.value = dVal;
    if (sliderInput && sliderInput.value != dVal) sliderInput.value = dVal;
    if (badge) {
      const secStr = (dVal / 1000).toFixed(dVal >= 10000 ? 0 : (dVal % 1000 === 0 ? 0 : 1));
      badge.textContent = `${secStr}s (${dVal}ms)`;
    }

    this.onProfileChanged();
  },

  onDelayChange(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const dVal = Math.min(60000, Math.max(50, parseInt(val, 10) || 1000));
    if (!node.data) node.data = {};
    node.data.delayMs = dVal;
    node.data.interval = dVal;
    this.render();
    this.openInspector(node.id);
    this.addHistory('⏱️', `ปรับ Delay ของ "${node.title || node.type}" เป็น ${dVal}ms`);
    this.onProfileChanged();
  },

  setPresetDelay(nodeId, ms) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    node.data.delayMs = ms;
    node.data.interval = ms;
    this.render();
    this.openInspector(node.id);
    this.addHistory('⏱️', `เลือก Preset Delay ของ "${node.title || node.type}" เป็น ${ms}ms`);
    this.onProfileChanged();
  },

  adjustDelay(nodeId, delta) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const cur = node.data?.delayMs !== undefined ? node.data.delayMs : (node.data?.interval || 1000);
    const nextVal = Math.min(60000, Math.max(50, cur + delta));
    node.data.delayMs = nextVal;
    node.data.interval = nextVal;
    this.render();
    this.openInspector(node.id);
    this.addHistory('⏱️', `ปรับ Delay ของ "${node.title || node.type}" เป็น ${nextVal}ms`);
    this.onProfileChanged();
  },

  renderClientButtonSelector(node) {
    const rawVal = node.data?.targetClient || '1';
    let selectedList = [];
    const isAllSelected = rawVal === 'all' || rawVal === 'both';
    if (isAllSelected) {
      selectedList = ['1', '2', '3', '4', '5', '6', '7', '8'];
    } else {
      selectedList = String(rawVal).split(',').map(s => s.trim()).filter(Boolean);
    }

    let buttonsHTML = '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">';
    for (let i = 1; i <= 8; i++) {
      const isSelected = isAllSelected || selectedList.includes(String(i));
      const bg = isSelected ? '#3b82f6' : 'rgba(15,23,42,0.8)';
      const border = isSelected ? '#60a5fa' : 'rgba(255,255,255,0.12)';
      const color = isSelected ? '#fff' : 'var(--muted)';
      buttonsHTML += `
        <button type="button" onclick="window.nodeCanvas.toggleClientSelection('${node.id}', '${i}')"
          style="background:${bg}; border:1px solid ${border}; color:${color}; width:28px; height:28px; border-radius:50%; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s; outline:none;"
          title="Client ${i}">
          ${i}
        </button>
      `;
    }

    const allBg = isAllSelected ? '#3b82f6' : 'rgba(15,23,42,0.8)';
    const allBorder = isAllSelected ? '#60a5fa' : 'rgba(255,255,255,0.12)';
    const allColor = isAllSelected ? '#fff' : 'var(--muted)';
    buttonsHTML += `
      <button type="button" onclick="window.nodeCanvas.toggleClientSelection('${node.id}', 'all')"
        style="background:${allBg}; border:1px solid ${allBorder}; color:${allColor}; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s; outline:none;"
        title="All Active Clients">
        ALL
      </button>
    `;
    buttonsHTML += '</div>';
    return buttonsHTML;
  },

  renderControlTargetsSelector(node) {
    const rawTargets = node.data?.controlTargetIds || (node.data?.controlTargetId ? [node.data?.controlTargetId] : []);
    const canonicalTargets = rawTargets.map(id => id.startsWith('node_') ? id.replace('node_', '') : id);
    const nonControllableTypes = ['trigger', 'branch', 'control', 'emergency_stop'];
    const availableNodes = this.nodes.filter(n => n.id !== node.id && !nonControllableTypes.includes(n.type));

    if (availableNodes.length === 0) {
      return `<div style="font-size:11px; color:var(--muted); padding:4px 0;">(ไม่มี Action อื่นบน Canvas)</div>`;
    }

    const totalCount = availableNodes.length;
    const selectedCount = availableNodes.filter(n => {
      const rawActId = n.data?.actionId || (n.id.startsWith('node_') ? n.id.replace('node_', '') : n.id);
      const actId = rawActId.startsWith('node_') ? rawActId.replace('node_', '') : rawActId;
      return canonicalTargets.includes(actId) || canonicalTargets.includes(n.id);
    }).length;

    let html = `
      <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="text" class="inspector-input" id="control-targets-search-input"
            placeholder="${window.currentLang === 'en' ? '🔍 Search actions...' : '🔍 ค้นหา Action...'}"
            oninput="window.nodeCanvas.filterControlTargetList(this.value)"
            style="flex:1; font-size:11px; padding:4px 8px; height:28px;" />
          <span id="control-targets-count-badge" style="font-size:10px; font-weight:700; color:#60a5fa; background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); padding:2px 6px; border-radius:10px; white-space:nowrap;">
            ${selectedCount}/${totalCount}
          </span>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn btn-ghost" onclick="window.nodeCanvas.toggleAllControlTargets('${node.id}', true)" style="flex:1; font-size:10px; padding:3px 0; border-color:rgba(59,130,246,0.4); color:#60a5fa; border-radius:6px;">
            ${window.currentLang === 'en' ? '✅ Select All' : '✅ เลือกทั้งหมด'}
          </button>
          <button type="button" class="btn btn-ghost" onclick="window.nodeCanvas.toggleAllControlTargets('${node.id}', false)" style="flex:1; font-size:10px; padding:3px 0; border-color:rgba(239,68,68,0.4); color:#ef4444; border-radius:6px;">
            ${window.currentLang === 'en' ? '🚫 Clear All' : '🚫 ยกเลิกทั้งหมด'}
          </button>
        </div>
        <div id="control-targets-list-container" style="display:flex; flex-direction:column; gap:4px; max-height:220px; overflow-y:auto; padding-right:2px; margin-top:2px; border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:6px; background:rgba(0,0,0,0.2);">
    `;

    availableNodes.forEach(otherNode => {
      const rawActId = otherNode.data?.actionId || (otherNode.id.startsWith('node_') ? otherNode.id.replace('node_', '') : otherNode.id);
      const actId = rawActId.startsWith('node_') ? rawActId.replace('node_', '') : rawActId;
      const isChecked = canonicalTargets.includes(actId) || canonicalTargets.includes(otherNode.id);
      const nodeTypeLabel = this.getNodeTypeLabel(otherNode.type);
      html += `
        <label class="control-target-item" data-title="${(otherNode.title || '').toLowerCase()}" data-type="${otherNode.type.toLowerCase()}" style="display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:6px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); cursor:pointer; font-size:12px; color:var(--text); transition:background 0.15s;">
          <input type="checkbox" class="control-target-checkbox" data-action-id="${actId}" ${isChecked ? 'checked' : ''} style="accent-color:#3b82f6; cursor:pointer; width:14px; height:14px;" onchange="window.nodeCanvas.toggleControlTarget('${node.id}', '${actId}', this.checked)" />
          <span style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="${otherNode.title || otherNode.type}">${otherNode.title || otherNode.type}</span>
          <span style="font-size:10px; color:var(--muted); white-space:nowrap;">(${nodeTypeLabel})</span>
        </label>
      `;
    });

    html += `
        </div>
      </div>
    `;
    return html;
  },

  filterControlTargetList(query) {
    const q = (query || '').toLowerCase().trim();
    const container = this.container.querySelector('#control-targets-list-container');
    if (!container) return;
    const items = container.querySelectorAll('.control-target-item');
    items.forEach(item => {
      const title = item.getAttribute('data-title') || '';
      const type = item.getAttribute('data-type') || '';
      if (!q || title.includes(q) || type.includes(q)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  },

  toggleControlTarget(nodeId, targetActionId, isChecked) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const rawTargets = node.data.controlTargetIds || (node.data.controlTargetId ? [node.data.controlTargetId] : []);
    let targets = rawTargets.map(id => id.startsWith('node_') ? id.replace('node_', '') : id);

    if (isChecked) {
      if (!targets.includes(targetActionId)) targets.push(targetActionId);
    } else {
      targets = targets.filter(t => t !== targetActionId && t !== `node_${targetActionId}`);
    }

    node.data.controlTargetIds = targets;
    node.data.controlTargetId = targets[0] || '';

    // Update count badge in inspector without re-rendering form and losing scroll position
    const badge = this.container.querySelector('#control-targets-count-badge');
    const availableNodes = this.nodes.filter(n => n.id !== node.id && n.type !== 'trigger');
    if (badge) {
      const canonical = targets.map(id => id.startsWith('node_') ? id.replace('node_', '') : id);
      const selected = availableNodes.filter(n => {
        const actId = n.data?.actionId || (n.id.startsWith('node_') ? n.id.replace('node_', '') : n.id);
        return canonical.includes(actId) || canonical.includes(n.id);
      }).length;
      badge.textContent = `${selected}/${availableNodes.length}`;
    }

    this.renderNodes();
    this.addHistory('🎯', `อัปเดตเป้าหมายควบคุมของ "${node.title || node.type}"`, true, `เลือกแล้ว ${selected}/${availableNodes.length} เป้าหมาย`);
    this.onProfileChanged();
  },

  toggleAllControlTargets(nodeId, selectAll) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const availableNodes = this.nodes.filter(n => n.id !== node.id && n.type !== 'trigger');

    let targets = [];
    if (selectAll) {
      targets = availableNodes.map(n => n.data?.actionId || (n.id.startsWith('node_') ? n.id.replace('node_', '') : n.id));
    }

    node.data.controlTargetIds = targets;
    node.data.controlTargetId = targets[0] || '';

    // Update all checkboxes in inspector list DOM
    const container = this.container.querySelector('#control-targets-list-container');
    if (container) {
      const checkboxes = container.querySelectorAll('.control-target-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = !!selectAll;
      });
    }

    // Update count badge
    const badge = this.container.querySelector('#control-targets-count-badge');
    if (badge) {
      badge.textContent = `${selectAll ? availableNodes.length : 0}/${availableNodes.length}`;
    }

    this.renderNodes();
    this.addHistory('🎯', `${selectAll ? 'เลือกเป้าหมายทั้งหมด' : 'ยกเลิกเป้าหมายทั้งหมด'} ของ "${node.title || node.type}"`, true, `${selectAll ? 'เลือกครบทุกโหนด' : 'เคลียร์เป็น 0'}`);
    this.onProfileChanged();
  },

  renderSequencerHelper(node) {
    const steps = Array.isArray(node.data?.steps) ? node.data.steps : [];
    const isLoop = (node.data?.modeType || 'loop') === 'loop';
    const intervalVal = node.data?.interval !== undefined ? node.data.interval : 1000;
    const repeatCount = Math.max(1, parseInt(node.data?.repeatCount, 10) || 1);
    const delayAfter = parseInt(node.data?.delayAfter, 10) || 0;

    let stepsHTML = '';
    if (steps.length === 0) {
      stepsHTML = `
        <div style="font-size:12px; color:var(--muted); text-align:center; padding:16px 8px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px dashed rgba(255,255,255,0.1);">
          ${window.currentLang === 'en' ? 'No steps in sequencer. Click + Add Step below.' : 'ยังไม่มีขั้นตอนคำสั่ง คลิกปุ่ม + เพิ่ม Step ด้านล่าง'}
        </div>
      `;
    } else {
      stepsHTML = steps.map((s, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === steps.length - 1;
        const delayMs = s.delay !== undefined ? s.delay : (s.castTimeMs !== undefined ? s.castTimeMs : 800);

        return `
          <div class="sequencer-step-item" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:12px; font-weight:700; color:#f59e0b; background:rgba(255,255,255,0.06); width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center;">${idx + 1}</span>
                <span style="font-size:12px; font-weight:600; color:var(--text);">${window.currentLang === 'en' ? 'Step Action' : 'ขั้นตอนคำสั่ง'}</span>
              </div>
              <div style="display:flex; align-items:center; gap:4px;">
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px;" onclick="window.nodeCanvas.moveSequencerStep('${node.id}', ${idx}, -1)" ${isFirst ? 'disabled' : ''} title="Move Up">▲</button>
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px;" onclick="window.nodeCanvas.moveSequencerStep('${node.id}', ${idx}, 1)" ${isLast ? 'disabled' : ''} title="Move Down">▼</button>
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px; color:#ef4444;" onclick="window.nodeCanvas.removeSequencerStep('${node.id}', ${idx})" title="Delete Step">🗑️</button>
              </div>
            </div>

            <div style="display:flex; gap:8px; align-items:flex-end; width:100%;">
              <div style="flex:1; min-width:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Key to Send' : 'ปุ่มที่กด'}</label>
                <div style="display:flex; align-items:center; gap:4px;">
                  <input type="text" class="inspector-input" value="${s.key || ''}" placeholder="${window.currentLang === 'en' ? 'Record key...' : 'กดบันทึก...'}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'sequencer_step_${idx}')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; min-width:0; height:30px; font-size:12px; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa; box-sizing:border-box;" />
                  <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'sequencer_step_${idx}')" style="height:30px; width:30px; padding:0; flex-shrink:0; border-color:#3b82f6; color:#60a5fa; border-radius:6px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
                </div>
              </div>

              <div style="width:95px; flex-shrink:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Delay (ms)' : 'ดีเลย์ (ms)'}</label>
                <input type="number" class="inspector-input" value="${delayMs}" min="0" step="50" onchange="window.nodeCanvas.updateSequencerStep('${node.id}', ${idx}, 'delay', parseInt(this.value, 10))" style="width:100%; height:30px; font-size:12px; text-align:center; padding:0 6px; box-sizing:border-box;" />
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
        ${this.renderClientButtonSelector(node)}
      </div>

      <div class="inspector-field-group">
        <label class="inspector-label">${window.currentLang === 'en' ? 'Execution Mode' : 'โหมดการทำงาน'}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'modeType', this.value); window.nodeCanvas.openInspector('${node.id}');">
          <option value="loop" ${isLoop ? 'selected' : ''}>🔄 ${window.currentLang === 'en' ? 'Continuous Loop (Start / Stop)' : 'วนลูปต่อเนื่อง (กดเริ่ม / กดหยุด)'}</option>
          <option value="once" ${!isLoop ? 'selected' : ''}>⚡ ${window.currentLang === 'en' ? 'Once / Burst (Single Trigger)' : 'รันทีเดียวจบ (Once / Burst)'}</option>
        </select>
      </div>

      ${isLoop ? `
        <div class="inspector-field-group">
          <label class="inspector-label">${window.currentLang === 'en' ? 'Loop Rest Interval (ms)' : 'หน่วงเวลาพักหลังจบรอบลูป (ms)'}</label>
          <input type="number" class="inspector-input" value="${intervalVal}" min="0" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'interval', parseInt(this.value, 10))" />
        </div>
      ` : `
        <div style="display:flex; gap:8px; margin-top:4px;">
          <div class="inspector-field-group" style="flex:1;">
            <label class="inspector-label">${window.currentLang === 'en' ? 'Repeat Count' : 'วนรอบซ้ำ (รอบ)'}</label>
            <input type="number" class="inspector-input" value="${repeatCount}" min="1" max="100" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'repeatCount', parseInt(this.value, 10))" />
          </div>
          <div class="inspector-field-group" style="flex:1;">
            <label class="inspector-label">${window.currentLang === 'en' ? 'Delay After (ms)' : 'พักหลังจบรอบ (ms)'}</label>
            <input type="number" class="inspector-input" value="${delayAfter}" min="0" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayAfter', parseInt(this.value, 10))" />
          </div>
        </div>
      `}

      <div class="inspector-field-group" style="margin-top:8px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <label class="inspector-label" style="margin:0;">📋 ${window.currentLang === 'en' ? 'Sequence Steps' : 'ลำดับขั้นตอน (Sequence Steps)'} (${steps.length})</label>
        </div>
        ${stepsHTML}

        <button type="button" class="btn btn-primary" style="width:100%; height:34px; font-size:12px; margin-top:8px; background:#f59e0b; border-color:#d97706; color:#000; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="window.nodeCanvas.addSequencerStep('${node.id}')">
          ➕ ${window.currentLang === 'en' ? 'Add Step' : 'เพิ่มขั้นตอน (+ Add Step)'}
        </button>
      </div>
    `;
  },

  renderLoopSchedulerHelper(node) {
    const items = Array.isArray(node.data?.items) ? node.data.items : [];
    const guardMs = node.data?.collisionGuardMs !== undefined ? node.data.collisionGuardMs : 800;

    let itemsHTML = '';
    if (items.length === 0) {
      itemsHTML = `
        <div style="font-size:12px; color:var(--muted); text-align:center; padding:16px 8px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px dashed rgba(255,255,255,0.1);">
          ${window.currentLang === 'en' ? 'No loop timers yet. Click button below to add.' : 'ยังไม่มีรายการลูป คลิกปุ่มด้านล่างเพื่อเพิ่ม Loop Item'}
        </div>
      `;
    } else {
      itemsHTML = items.map((it, idx) => {
        const isEnabled = it.enabled !== false;
        const isExecImmed = it.executeImmediately !== false;
        const itInterval = it.interval !== undefined ? it.interval : 3000;
        const itJitter = it.jitter !== undefined ? it.jitter : 0;

        return `
          <div class="scheduler-item-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:12px; font-weight:700; color:#38bdf8; background:rgba(56,189,248,0.1); width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center;">${idx + 1}</span>
                <span style="font-size:11px; font-weight:700; color:#60a5fa; font-family:'JetBrains Mono';">[Pin: item_${idx}]</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <label style="display:flex; align-items:center; gap:4px; font-size:11px; color:${isEnabled ? '#34d399' : 'var(--muted)'}; cursor:pointer; margin:0;">
                  <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="window.nodeCanvas.updateSchedulerItem('${node.id}', ${idx}, 'enabled', this.checked)" style="accent-color:#10b981; cursor:pointer;" />
                  <span>${isEnabled ? 'Active' : 'Muted'}</span>
                </label>
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px; color:#ef4444;" onclick="window.nodeCanvas.removeSchedulerItem('${node.id}', ${idx})" title="Delete Item">🗑️</button>
              </div>
            </div>

            <div style="display:flex; gap:6px; align-items:flex-end; width:100%;">
              <div style="flex:1; min-width:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Item Label' : 'ชื่อรายการ'}</label>
                <input type="text" class="inspector-input" value="${it.name || `Skill ${idx + 1}`}" placeholder="e.g. Heal 1" onchange="window.nodeCanvas.updateSchedulerItem('${node.id}', ${idx}, 'name', this.value.trim())" style="width:100%; height:30px; font-size:12px; font-weight:600; box-sizing:border-box; padding:0 8px;" />
              </div>
              <div style="width:75px; flex-shrink:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Interval (ms)' : 'เวลา (ms)'}</label>
                <input type="number" class="inspector-input" value="${itInterval}" min="50" step="100" onchange="window.nodeCanvas.updateSchedulerItem('${node.id}', ${idx}, 'interval', parseInt(this.value, 10))" style="width:100%; height:30px; font-size:12px; text-align:center; padding:0 4px; box-sizing:border-box; font-family:'JetBrains Mono'; font-weight:700; color:#38bdf8;" />
              </div>
              <div style="width:65px; flex-shrink:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? '± Jitter (ms)' : '± สุ่ม (ms)'}</label>
                <input type="number" class="inspector-input" value="${itJitter}" min="0" max="10000" step="50" onchange="window.nodeCanvas.updateSchedulerItem('${node.id}', ${idx}, 'jitter', parseInt(this.value, 10))" style="width:100%; height:30px; font-size:12px; text-align:center; padding:0 4px; box-sizing:border-box; font-family:'JetBrains Mono'; font-weight:700; color:#a855f7;" title="สุ่มเพิ่ม/ลดเวลา ±ms" />
              </div>
            </div>

            <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text); cursor:pointer; margin-top:2px;">
              <input type="checkbox" ${isExecImmed ? 'checked' : ''} onchange="window.nodeCanvas.updateSchedulerItem('${node.id}', ${idx}, 'executeImmediately', this.checked)" style="accent-color:#3b82f6; cursor:pointer;" />
              <span>${window.currentLang === 'en' ? 'Execute immediately on start' : 'เริ่มยิงทันทีเมื่อกด Start'}</span>
            </label>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
        ${this.renderClientButtonSelector(node)}
      </div>

      <div class="inspector-field-group">
        <label class="inspector-label" style="display:flex; align-items:center; justify-content:space-between;">
          <span>🛡️ ${window.currentLang === 'en' ? 'Anti-Collision Guard Delay (ms)' : 'เวลาป้องกันการชนกัน (Guard Delay ms)'}</span>
          <span style="font-size:10px; color:#10b981; font-family:'JetBrains Mono'; font-weight:700;">${guardMs}ms</span>
        </label>
        <input type="number" class="inspector-input" value="${guardMs}" min="50" max="5000" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'collisionGuardMs', parseInt(this.value, 10))" style="font-family:'JetBrains Mono'; color:#10b981; font-weight:700;" />
        <span style="font-size:10px; color:var(--muted); margin-top:4px; display:block;">
          ${window.currentLang === 'en' ? 'Minimum wait time between overlapping actions to prevent in-game animation lock.' : 'ระยะเวลารอขั้นต่ำระหว่างแต่ละสกิลเมื่อถึงเวลาพร้อมกัน เพื่อป้องกันคีย์ชนและติด Animation Lock ในเกม'}
        </span>
      </div>

      <div class="inspector-field-group" style="margin-top:8px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <label class="inspector-label" style="margin:0;">⏱️ ${window.currentLang === 'en' ? 'Independent Loop Timers' : 'รายการลูปเวลาอิสระ (Loop Timers)'} (${items.length})</label>
        </div>
        ${itemsHTML}

        <button type="button" class="btn btn-primary" style="width:100%; height:34px; font-size:12px; margin-top:8px; background:#0284c7; border-color:#0369a1; color:#fff; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="window.nodeCanvas.addSchedulerItem('${node.id}')">
          ➕ ${window.currentLang === 'en' ? 'Add Loop Timer' : 'เพิ่มรายการลูป (+ Add Loop Item)'}
        </button>
      </div>
    `;
  },

  addSchedulerItem(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    if (!Array.isArray(node.data.items)) node.data.items = [];
    const nextIdx = node.data.items.length;
    node.data.items.push({
      id: `item_${nextIdx}`,
      name: `Skill ${nextIdx + 1}`,
      interval: 3000,
      jitter: 0,
      executeImmediately: true,
      enabled: true
    });
    this.render();
    this.openInspector(nodeId);
    this.addHistory('➕', `เพิ่ม Loop Item ใน "${node.title || node.type}"`);
    this.onProfileChanged();
  },

  removeSchedulerItem(nodeId, index) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.items)) return;
    node.data.items.splice(index, 1);
    this.render();
    this.openInspector(nodeId);
    this.addHistory('🗑️', `ลบ Loop Item #${index + 1}`);
    this.onProfileChanged();
  },

  updateSchedulerItem(nodeId, index, field, value) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.items)) return;
    if (node.data.items[index]) {
      node.data.items[index][field] = value;
      this.render();
      this.onProfileChanged();
    }
  },

  addSequencerStep(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    if (!Array.isArray(node.data.steps)) node.data.steps = [];

    node.data.steps.push({
      key: '1',
      delay: 800
    });

    this.render();
    this.openInspector(nodeId);
    this.addHistory('➕', `เพิ่มขั้นตอนใน "${node.title || node.type}"`);
    this.onProfileChanged();
  },

  removeSequencerStep(nodeId, index) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;

    node.data.steps.splice(index, 1);
    this.render();
    this.openInspector(nodeId);
    this.addHistory('🗑️', `ลบขั้นตอนที่ ${index + 1} ใน "${node.title || node.type}"`);
    this.onProfileChanged();
  },

  moveSequencerStep(nodeId, index, direction) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= node.data.steps.length) return;

    const temp = node.data.steps[index];
    node.data.steps[index] = node.data.steps[targetIdx];
    node.data.steps[targetIdx] = temp;

    this.render();
    this.openInspector(nodeId);
    this.addHistory('↕️', `สลับลำดับขั้นตอนใน "${node.title || node.type}"`);
    this.onProfileChanged();
  },

  updateSequencerStep(nodeId, index, field, value) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;
    if (!node.data.steps[index]) return;

    node.data.steps[index][field] = value;
    if (field === 'delay') {
      node.data.steps[index].castTimeMs = value;
    }

    this.render();
    this.openInspector(nodeId);
    this.onProfileChanged();
  },

  renderMacroGroupHelper(node) {
    const steps = Array.isArray(node.data?.steps) ? node.data.steps : [];
    const repeatCount = Math.max(1, parseInt(node.data?.repeatCount, 10) || 1);

    let stepsHTML = '';
    if (steps.length === 0) {
      stepsHTML = `
        <div style="font-size:12px; color:var(--muted); text-align:center; padding:16px 8px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px dashed rgba(255,255,255,0.1);">
          ${window.currentLang === 'en' ? 'No steps in macro. Click button below to add.' : 'ยังไม่มีขั้นตอนมาโคร คลิกปุ่มด้านล่างเพื่อเพิ่ม Step'}
        </div>
      `;
    } else {
      stepsHTML = steps.map((s, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === steps.length - 1;
        const delayVal = s.delay !== undefined ? s.delay : 300;
        const holdVal = s.holdMs !== undefined ? s.holdMs : 0;

        return `
          <div class="macro-step-item" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:12px; font-weight:700; color:#60a5fa; background:rgba(255,255,255,0.06); width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center;">${idx + 1}</span>
                <span style="font-size:12px; font-weight:600; color:var(--text);">${window.currentLang === 'en' ? 'Step Action' : 'ขั้นตอนคำสั่ง'}</span>
              </div>
              <div style="display:flex; align-items:center; gap:4px;">
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px;" onclick="window.nodeCanvas.moveMacroStep('${node.id}', ${idx}, -1)" ${isFirst ? 'disabled' : ''} title="Move Up">▲</button>
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px;" onclick="window.nodeCanvas.moveMacroStep('${node.id}', ${idx}, 1)" ${isLast ? 'disabled' : ''} title="Move Down">▼</button>
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px; color:#ef4444;" onclick="window.nodeCanvas.removeMacroStep('${node.id}', ${idx})" title="Delete Step">🗑️</button>
              </div>
            </div>

            <div style="display:flex; gap:8px; align-items:flex-end; width:100%;">
              <div style="flex:1; min-width:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Key to Send' : 'ปุ่มที่กด'}</label>
                <div style="display:flex; align-items:center; gap:4px;">
                  <input type="text" class="inspector-input" value="${s.key || ''}" placeholder="${window.currentLang === 'en' ? 'Record key...' : 'กดบันทึก...'}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'macro_step_${idx}')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; min-width:0; height:30px; font-size:12px; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa; box-sizing:border-box;" />
                  <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'macro_step_${idx}')" style="height:30px; width:30px; padding:0; flex-shrink:0; border-color:#3b82f6; color:#60a5fa; border-radius:6px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
                </div>
              </div>

              <div style="width:75px; flex-shrink:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Delay (ms)' : 'ดีเลย์ (ms)'}</label>
                <input type="number" class="inspector-input" value="${delayVal}" min="0" step="50" onchange="window.nodeCanvas.updateMacroStep('${node.id}', ${idx}, 'delay', parseInt(this.value, 10))" style="width:100%; height:30px; font-size:12px; text-align:center; padding:0 4px; box-sizing:border-box;" />
              </div>

              <div style="width:75px; flex-shrink:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Hold (ms)' : 'กดค้าง (ms)'}</label>
                <input type="number" class="inspector-input" value="${holdVal}" min="0" step="50" onchange="window.nodeCanvas.updateMacroStep('${node.id}', ${idx}, 'holdMs', parseInt(this.value, 10))" style="width:100%; height:30px; font-size:12px; text-align:center; padding:0 4px; box-sizing:border-box;" />
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
        ${this.renderClientButtonSelector(node)}
      </div>

      <div class="inspector-field-group">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <label class="inspector-label" style="margin:0;">🔀 ${window.currentLang === 'en' ? 'Macro Steps Queue' : 'คิวลำดับคำสั่งมาโคร'} (${steps.length})</label>
        </div>
        ${stepsHTML}

        <button type="button" class="btn btn-primary" style="width:100%; height:34px; font-size:12px; margin-top:8px; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="window.nodeCanvas.addMacroStep('${node.id}')">
          ➕ ${window.currentLang === 'en' ? 'Add Macro Step' : 'เพิ่มขั้นตอนมาโคร (+ Add Step)'}
        </button>
      </div>

      <div class="inspector-field-group" style="margin-top:8px;">
        <label class="inspector-label">${window.currentLang === 'en' ? 'Repeat Count' : 'วนรอบซ้ำ (รอบ)'}</label>
        <input type="number" class="inspector-input" value="${repeatCount}" min="1" max="100" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'repeatCount', parseInt(this.value, 10))" />
      </div>

      ${this.renderSkillCooldownHelper(node)}
    `;
  },

  addMacroStep(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    if (!Array.isArray(node.data.steps)) node.data.steps = [];

    node.data.steps.push({
      key: '1',
      delay: 300,
      holdMs: 0
    });

    this.render();
    this.openInspector(nodeId);
    this.addHistory('➕', `เพิ่มขั้นตอนใน "${node.title || node.type}"`);
    this.onProfileChanged();
  },

  removeMacroStep(nodeId, index) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;

    node.data.steps.splice(index, 1);
    this.render();
    this.openInspector(nodeId);
    this.addHistory('🗑️', `ลบขั้นตอนที่ ${index + 1} ใน "${node.title || node.type}"`);
    this.onProfileChanged();
  },

  moveMacroStep(nodeId, index, direction) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= node.data.steps.length) return;

    const temp = node.data.steps[index];
    node.data.steps[index] = node.data.steps[targetIdx];
    node.data.steps[targetIdx] = temp;

    this.render();
    this.openInspector(nodeId);
    this.addHistory('↕️', `สลับลำดับขั้นตอนใน "${node.title || node.type}"`);
    this.onProfileChanged();
  },

  updateMacroStep(nodeId, index, field, value) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;
    if (!node.data.steps[index]) return;

    node.data.steps[index][field] = value;

    this.render();
    this.openInspector(nodeId);
    this.onProfileChanged();
  },

  renderBranchHelper(node) {
    const rawTargetId = node.data?.conditionTargetId || '';
    const canonicalTargetId = rawTargetId.startsWith('node_') ? rawTargetId.replace('node_', '') : rawTargetId;
    const rule = node.data?.conditionRule || 'is_running';
    const condVal = node.data?.conditionValue !== undefined ? node.data.conditionValue : '';
    const nonCheckableTypes = ['trigger', 'branch', 'control', 'emergency_stop'];
    const checkableNodes = this.nodes.filter(n => n.id !== node.id && !nonCheckableTypes.includes(n.type));

    const selectedTargetNode = this.nodes.find(n => {
      let actId = n.data?.actionId || (n.id.startsWith('node_') ? n.id.replace('node_', '') : n.id);
      if (actId.startsWith('node_')) actId = actId.replace('node_', '');
      return actId === canonicalTargetId || n.id === rawTargetId;
    });

    const isVariableTarget = selectedTargetNode && selectedTargetNode.type === 'variable';
    const varType = selectedTargetNode?.data?.varType || 'boolean';

    let rulesHTML = '';
    let valueInputHTML = '';

    if (isVariableTarget) {
      if (varType === 'boolean') {
        const booleanRule = (rule === 'is_false') ? 'is_false' : 'is_true';
        rulesHTML = `
          <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'conditionRule', this.value)">
            <option value="is_true" ${booleanRule === 'is_true' ? 'selected' : ''}>🟢 ${canvasT('conditionIsTrue', 'Is True (On)')}</option>
            <option value="is_false" ${booleanRule === 'is_false' ? 'selected' : ''}>🔴 ${canvasT('conditionIsFalse', 'Is False (Off)')}</option>
          </select>
        `;
      } else if (varType === 'number') {
        const numRule = (rule === 'is_running' || rule === 'is_true') ? 'equals' : rule;
        rulesHTML = `
          <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'conditionRule', this.value)">
            <option value="equals" ${numRule === 'equals' ? 'selected' : ''}>${canvasT('conditionEquals', 'Equals (==)')}</option>
            <option value="not_equals" ${numRule === 'not_equals' ? 'selected' : ''}>${canvasT('conditionNotEquals', 'Not Equals (!=)')}</option>
            <option value="greater_than" ${numRule === 'greater_than' ? 'selected' : ''}>${canvasT('conditionGreaterThan', 'Greater Than (>)')}</option>
            <option value="less_than" ${numRule === 'less_than' ? 'selected' : ''}>${canvasT('conditionLessThan', 'Less Than (<)')}</option>
            <option value="greater_or_equal" ${numRule === 'greater_or_equal' ? 'selected' : ''}>${canvasT('conditionGreaterOrEqual', 'Greater or Equal (>=)')}</option>
            <option value="less_or_equal" ${numRule === 'less_or_equal' ? 'selected' : ''}>${canvasT('conditionLessOrEqual', 'Less or Equal (<=)')}</option>
          </select>
        `;
        valueInputHTML = `
          <div class="inspector-field-group" style="margin-top:6px;">
            <label class="inspector-label">${canvasT('inspector_condition_compare_value', 'Value to Compare')}</label>
            <input type="number" class="inspector-input" value="${condVal !== '' ? condVal : 0}" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'conditionValue', parseFloat(this.value) || 0)" />
          </div>
        `;
      } else {
        const strRule = (rule === 'not_equals') ? 'not_equals' : 'equals';
        rulesHTML = `
          <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'conditionRule', this.value)">
            <option value="equals" ${strRule === 'equals' ? 'selected' : ''}>${canvasT('conditionEquals', 'Equals (==)')}</option>
            <option value="not_equals" ${strRule === 'not_equals' ? 'selected' : ''}>${canvasT('conditionNotEquals', 'Not Equals (!=)')}</option>
          </select>
        `;
        valueInputHTML = `
          <div class="inspector-field-group" style="margin-top:6px;">
            <label class="inspector-label">${canvasT('inspector_condition_compare_value', 'Text to Compare')}</label>
            <input type="text" class="inspector-input" value="${condVal}" placeholder="e.g. phase_1" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'conditionValue', this.value)" />
          </div>
        `;
      }
    } else {
      rulesHTML = `
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'conditionRule', this.value)">
          <option value="is_running" ${rule === 'is_running' ? 'selected' : ''}>🟢 ${canvasT('conditionRunning', 'Is Running')}</option>
          <option value="is_stopped" ${rule === 'is_stopped' ? 'selected' : ''}>🔴 ${canvasT('conditionStopped', 'Is Stopped')}</option>
          <option value="on_cooldown" ${rule === 'on_cooldown' ? 'selected' : ''}>⏳ ${canvasT('conditionCooldown', 'Is on Cooldown')}</option>
          <option value="is_ready" ${rule === 'is_ready' ? 'selected' : ''}>🛡️ ${canvasT('conditionReady', 'Is Ready')}</option>
        </select>
      `;
    }

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_condition_target_label', 'Target to Check')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'conditionTargetId', this.value); window.nodeCanvas.openInspector('${node.id}');">
          <option value="">${canvasT('inspector_select_action_check', '-- Select Action / Variable to Check --')}</option>
          ${checkableNodes.length === 0 ? `
            <option value="" disabled>(${canvasT('inspector_no_other_actions', 'No other actions on canvas')})</option>
          ` : checkableNodes.map(n => {
      let actId = n.data?.actionId || (n.id.startsWith('node_') ? n.id.replace('node_', '') : n.id);
      if (actId.startsWith('node_')) actId = actId.replace('node_', '');
      return `<option value="${actId}" ${actId === canonicalTargetId || n.id === rawTargetId ? 'selected' : ''}>${n.title || n.type} (${this.getNodeTypeLabel(n.type)})</option>`;
    }).join('')}
        </select>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_condition_rule_label', 'Condition Evaluation Rule')}</label>
        ${rulesHTML}
        ${valueInputHTML}
      </div>
    `;
  },

  renderEmergencyStopHelper(node) {
    const scope = node.data?.stopScope || 'all';
    const showNotice = node.data?.showOverlayNotice !== false;

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_stop_scope_label', 'Emergency Stop Scope')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'stopScope', this.value); window.nodeCanvas.openInspector('${node.id}');">
          <option value="all" ${scope === 'all' ? 'selected' : ''}>${canvasT('inspector_scope_all', '🛑 All Everywhere')}</option>
          <option value="profile" ${scope === 'profile' ? 'selected' : ''}>${canvasT('inspector_scope_profile', '📁 Current Profile Only')}</option>
          <option value="client" ${scope === 'client' ? 'selected' : ''}>${canvasT('inspector_scope_client', '🎯 Selected Client Only')}</option>
        </select>
      </div>
      ${scope === 'client' ? `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
      ` : ''}
      <div class="inspector-field-group" style="display:flex; align-items:center; gap:8px; margin-top:8px;">
        <input type="checkbox" id="stop-overlay-notice-${node.id}" ${showNotice ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', 'showOverlayNotice', this.checked)" style="accent-color:#ef4444; width:16px; height:16px; cursor:pointer;" />
        <label for="stop-overlay-notice-${node.id}" class="inspector-label" style="margin:0; cursor:pointer;">${canvasT('inspector_stop_overlay_notice', 'Show Warning Notice on Desktop Overlay')}</label>
      </div>
    `;
  },

  renderSkillCooldownHelper(node) {
    const presetId = node.data?.cooldownPresetId || '';
    const customMs = node.data?.customCooldownMs || 0;
    const presetsById = window.allCooldownPresetsById || {};
    const isCustom = presetId === 'custom';
    const currentLang = window.currentLang || 'th';
    const trans = (window.TRANSLATIONS && window.TRANSLATIONS[currentLang]) || {
      skillCooldownGuardLabel: 'Skill Cooldown Guard (ระบบป้องกันการกดซ้ำ)',
      customCooldownMsLabel: 'Custom Cooldown (ms)',
      noSkillSelectedText: 'ไม่มี Cooldown Guard (กดตามจังหวะปกติ)',
      clickToSelectSkillHint: 'คลิกเพื่อเลือกสกิล Flyff ป้องกันการกดซ้ำระหว่างติด Cooldown',
      selectSkillBtnText: 'เลือกสกิล',
      changeSkillBtnText: 'เปลี่ยน',
      customCooldownCardTitle: 'กำหนดเวลาเอง (Custom Duration)',
      customCooldownSpecifyHint: 'ระบุเวลาเองในช่องด้านล่าง'
    };

    let cardContent = '';
    if (isCustom) {
      const msText = customMs ? `${customMs}ms (${(customMs / 1000).toFixed(1)}s)` : (trans.customCooldownSpecifyHint || 'ระบุเวลาเองในช่องด้านล่าง');
      cardContent = `
        <div style="width:32px; height:32px; border-radius:8px; background:rgba(168,85,247,0.2); display:flex; align-items:center; justify-content:center; font-size:16px;">⚙️</div>
        <div style="display:flex; flex-direction:column; flex:1;">
          <span style="font-size:13px; font-weight:700; color:#a855f7;">${trans.customCooldownCardTitle || 'กำหนดเวลาเอง (Custom Duration)'}</span>
          <span style="font-size:11px; color:var(--muted);">⏱️ ${msText}</span>
        </div>
        <span style="font-size:12px; color:#a855f7; font-weight:600;">${trans.changeSkillBtnText || 'เปลี่ยน'} ➔</span>
      `;
    } else if (!presetId || !presetsById[presetId]) {
      cardContent = `
        <div style="width:32px; height:32px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:16px;">🚫</div>
        <div style="display:flex; flex-direction:column; flex:1;">
          <span style="font-size:13px; font-weight:600; color:var(--text);">${trans.noSkillSelectedText || 'ไม่มี Cooldown Guard'}</span>
          <span style="font-size:11px; color:var(--muted);">${trans.clickToSelectSkillHint || 'คลิกเพื่อเลือกสกิล Flyff ป้องกันกดซ้ำ'}</span>
        </div>
        <span style="font-size:12px; color:var(--primary); font-weight:600;">${trans.selectSkillBtnText || 'เลือกสกิล'} ➔</span>
      `;
    } else {
      const item = presetsById[presetId];
      const effectiveMs = customMs > 0 ? customMs : (item.cooldownMs || 0);
      const isCustomOverride = customMs > 0 && customMs !== item.cooldownMs;
      const cdText = effectiveMs ? `${effectiveMs / 1000}s (${effectiveMs}ms)${isCustomOverride ? ' • Custom' : ''}` : 'No Cooldown';
      const imgHTML = item.image ? `<img src="${item.image}" style="width:32px; height:32px; object-fit:contain; border-radius:6px; background:rgba(0,0,0,0.3); padding:2px; border:1px solid rgba(16,185,129,0.4);" onError="this.style.display='none'">` : `<div style="width:32px; height:32px; border-radius:6px; background:rgba(16,185,129,0.2); display:flex; align-items:center; justify-content:center;">✨</div>`;

      cardContent = `
        ${imgHTML}
        <div style="display:flex; flex-direction:column; flex:1;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:13px; font-weight:700; color:#fff;">${item.name}</span>
            <span style="font-size:10px; background:${isCustomOverride ? 'rgba(168,85,247,0.2)' : 'rgba(16,185,129,0.2)'}; border:1px solid ${isCustomOverride ? 'rgba(168,85,247,0.4)' : 'rgba(16,185,129,0.4)'}; color:${isCustomOverride ? '#a855f7' : '#10b981'}; border-radius:4px; padding:1px 6px; font-weight:700;">⏱️ ${cdText}</span>
          </div>
          <span style="font-size:11px; color:var(--muted);">${item.class || 'Skill'} ${item.description ? '• ' + item.description : ''}</span>
        </div>
        <span style="font-size:12px; color:#10b981; font-weight:600;">${trans.changeSkillBtnText || 'เปลี่ยน'} ➔</span>
      `;
    }

    const border = isCustom ? '#a855f7' : (presetId && presetsById[presetId] ? '#10b981' : 'var(--border)');
    const hasActiveGuard = !!(presetId || customMs > 0);

    return `
      <div class="inspector-field-group" style="margin-top:10px; border-top:1px dashed rgba(255,255,255,0.08); padding-top:10px;">
        <label class="inspector-label" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <span>⏱️ ${trans.skillCooldownGuardLabel || 'Skill Cooldown Guard (ระบบป้องกันการกดซ้ำ)'}</span>
          ${hasActiveGuard ? `
            <button type="button" onclick="event.stopPropagation(); window.nodeCanvas.clearSkillCooldown('${node.id}');"
                    title="ปิดใช้งาน Cooldown Guard (ตัดการเชื่อมต่อพอร์ต On Cooldown อัตโนมัติ)"
                    style="background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.35); color:#f87171; border-radius:5px; padding:2px 8px; font-size:10px; font-weight:700; cursor:pointer; transition:all 0.2s;">
              ✕ ${window.currentLang === 'en' ? 'Disable' : 'ปิดใช้งาน'}
            </button>
          ` : ''}
        </label>
        <div class="custom-skill-select-card ${presetId ? 'active' : ''}"
             onclick="if(window.openSkillPickerModal) window.openSkillPickerModal('${node.id}')"
             style="background:var(--bg-input); border:1px solid ${border}; border-radius:10px; padding:10px 14px; cursor:pointer; display:flex; align-items:center; gap:12px; transition:all 0.2s;">
          ${cardContent}
        </div>
        <div style="display:${presetId ? 'flex' : 'none'}; align-items:center; gap:10px; margin-top:8px; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:8px; padding:6px 12px;">
          <label style="font-size:11px; color:var(--muted); font-weight:600; white-space:nowrap;">
            ⏱️ ${trans.customCooldownMsLabel || 'Custom Cooldown (ms)'}
          </label>
          <input type="number" class="inspector-input" min="0" max="600000" step="100"
                 value="${customMs || ''}"
                 placeholder="${presetId && presetsById[presetId] ? 'Preset: ' + (presetsById[presetId].cooldownMs || 0) + 'ms' : 'e.g. 5000'}"
                 onchange="window.nodeCanvas.updateNodeData('${node.id}', 'customCooldownMs', parseInt(this.value, 10) || 0); window.nodeCanvas.openInspector('${node.id}'); window.nodeCanvas.renderNodes();"
                 style="padding:4px 8px; font-size:12px; flex:1;" />
          <span style="font-size:11px; color:#a855f7; font-weight:bold;">${customMs ? ((customMs / 1000).toFixed(1) + 's') : ''}</span>
        </div>
      </div>
    `;
  },

  renderSoundAlertHelper(node) {
    const isEn = window.currentLang === 'en';
    const source = node.data?.soundSource || 'preset';
    const preset = node.data?.soundPreset || 'ding';
    const url = node.data?.soundUrl || '';
    const file = node.data?.soundFile || '';
    const volume = node.data?.volume !== undefined ? node.data.volume : 100;
    const repeat = node.data?.repeatCount || 1;

    let sourceSpecificHTML = '';
    if (source === 'preset') {
      sourceSpecificHTML = `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('soundPresetLabel', isEn ? 'Sound Preset' : 'เสียงแจ้งเตือนมาตรฐาน')}</label>
          <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'soundPreset', this.value)">
            <option value="ding" ${preset === 'ding' ? 'selected' : ''}>🔔 Ding / Bell</option>
            <option value="alarm" ${preset === 'alarm' ? 'selected' : ''}>🚨 Alarm / Siren</option>
            <option value="laser" ${preset === 'laser' ? 'selected' : ''}>⚡ Laser / High Beep</option>
            <option value="warning" ${preset === 'warning' ? 'selected' : ''}>⚠️ Warning Buzzer</option>
            <option value="success" ${preset === 'success' ? 'selected' : ''}>✅ Success Tone</option>
          </select>
        </div>
      `;
    } else if (source === 'url') {
      sourceSpecificHTML = `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('soundUrlLabel', isEn ? 'Custom Audio URL (.mp3 / .wav)' : 'URL ไฟล์เสียง (.mp3 / .wav)')}</label>
          <input type="text" class="inspector-input" value="${url}" placeholder="https://example.com/sound.mp3" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'soundUrl', this.value)" />
        </div>
      `;
    } else if (source === 'upload') {
      sourceSpecificHTML = `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('soundUploadedFileLabel', isEn ? 'Uploaded Audio File' : 'ไฟล์เสียงที่อัปโหลด')}</label>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="file" accept="audio/*" onchange="window.nodeCanvas.uploadSoundFile('${node.id}', this)" style="display:none;" id="sound-upload-input-${node.id}" />
            <button type="button" class="btn btn-ghost" onclick="document.getElementById('sound-upload-input-${node.id}').click()" style="padding:6px 12px; font-size:12px; border-color:#a855f7; color:#c084fc;">
              📁 ${isEn ? 'Choose Audio File (.mp3, .wav)...' : 'เลือกไฟล์เสียง (.mp3, .wav)...'}
            </button>
            <span style="font-size:11px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">
              ${file ? file.split('/').pop() : (isEn ? 'No file chosen' : 'ยังไม่ได้เลือกไฟล์')}
            </span>
          </div>
        </div>
      `;
    }

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('soundSourceLabel', isEn ? 'Sound Source' : 'แหล่งที่มาของเสียง')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'soundSource', this.value); window.nodeCanvas.openInspector('${node.id}');">
          <option value="preset" ${source === 'preset' ? 'selected' : ''}>🔔 ${isEn ? 'Built-in Presets' : 'เสียงมาตรฐานในระบบ'}</option>
          <option value="url" ${source === 'url' ? 'selected' : ''}>🌐 ${isEn ? 'Custom Web URL' : 'ลิงก์เว็บ URL'}</option>
          <option value="upload" ${source === 'upload' ? 'selected' : ''}>📁 ${isEn ? 'Upload Local File' : 'อัปโหลดไฟล์ในเครื่อง'}</option>
        </select>
      </div>
      ${sourceSpecificHTML}
      <div class="inspector-field-group">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label class="inspector-label">${isEn ? `Volume (${volume}%)` : `ระดับเสียง (${volume}%)`}</label>
        </div>
        <input type="range" class="inspector-input" min="0" max="100" value="${volume}" oninput="this.previousElementSibling.firstElementChild.textContent = '${isEn ? 'Volume (' : 'ระดับเสียง ('}' + this.value + '%)'" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'volume', parseInt(this.value, 10))" style="padding:0; height:6px; cursor:pointer;" />
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${isEn ? 'Repeat Count (cycles)' : 'เล่นซ้ำ (รอบ)'}</label>
        <input type="number" class="inspector-input" min="1" max="10" value="${repeat}" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'repeatCount', parseInt(this.value, 10))" />
      </div>
      <div style="margin-top:12px;">
        <button type="button" class="btn" onclick="if(window.testAlertSound) window.testAlertSound('${node.id}')" style="width:100%; background:linear-gradient(135deg,#8b5cf6,#6d28d9); color:#fff; font-weight:700; border-radius:8px; padding:8px 0; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
          ▶️ ${isEn ? 'Test Play Audio' : 'ทดสอบเสียง (Test Play)'}
        </button>
      </div>
    `;
  },

  async uploadSoundFile(nodeId, inputEl) {
    if (!inputEl.files || inputEl.files.length === 0) return;
    const file = inputEl.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result.split(',')[1];
      try {
        const res = await fetch('/api/sound/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, base64Data })
        });
        const data = await res.json();
        if (data.success && data.url) {
          this.updateNodeData(nodeId, 'soundFile', data.url);
          this.openInspector(nodeId);
          if (typeof window.toast === 'function') {
            window.toast(`📁 อัปโหลดไฟล์เสียง "${data.filename}" เรียบร้อยแล้ว!`, 'success');
          }
        } else {
          if (typeof window.toast === 'function') window.toast(`Upload failed: ${data.error}`, 'error');
        }
      } catch (err) {
        console.error('Audio upload error:', err);
      }
    };
    reader.readAsDataURL(file);
  },

  toggleClientSelection(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};

    let currentVal = node.data.targetClient || '1';
    let targets = [];
    if (currentVal === 'all' || currentVal === 'both') {
      targets = ['1', '2', '3', '4', '5', '6', '7', '8'];
    } else {
      targets = String(currentVal).split(',').map(s => s.trim()).filter(Boolean);
    }

    if (val === 'all') {
      if (currentVal === 'all') {
        node.data.targetClient = '1';
      } else {
        node.data.targetClient = 'all';
      }
    } else {
      if (targets.includes(val)) {
        targets = targets.filter(t => t !== val);
      } else {
        targets.push(val);
      }

      targets.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

      if (targets.length === 0) {
        node.data.targetClient = '1';
      } else if (targets.length === 8) {
        node.data.targetClient = 'all';
      } else {
        node.data.targetClient = targets.join(',');
      }
    }

    this.renderNodes();
    this.openInspector(node.id);
    this.addHistory('🎯', `เปลี่ยนจอเป้าหมายของ "${node.title || node.type}" เป็น [${node.data.targetClient}]`);
    this.onProfileChanged();
  },

  closeInspector() {
    if (this.inspectorPanel) {
      this.inspectorPanel.classList.remove('open');
    }
  },

  hasCooldownGuard(node) {
    if (!node || !node.data) return false;
    const presetId = node.data.cooldownPresetId;
    const customMs = parseInt(node.data.customCooldownMs, 10);
    return !!((presetId && presetId !== 'none' && presetId !== '') || (customMs > 0));
  },

  clearSkillCooldown(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    node.data.cooldownPresetId = '';
    node.data.customCooldownMs = 0;
    // Auto-prune all connections going out from onCooldown
    this.connections = this.connections.filter(c => !(c.fromNodeId === nodeId && (c.fromPort === 'onCooldown' || c.fromPort === 'on_cooldown')));
    this.renderNodes();
    this.renderWires();
    this.openInspector(nodeId);
    this.addHistory('⏱️', `ปิดใช้งาน Cooldown Guard ของโหนด "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  };

  function applyExtension() {
    if (typeof window !== 'undefined' && window.NodeCanvasEditor) {
      Object.assign(window.NodeCanvasEditor.prototype, InspectorExtension);
    } else if (typeof window !== 'undefined') {
      setTimeout(applyExtension, 10);
    }
  }

  applyExtension();
})();
