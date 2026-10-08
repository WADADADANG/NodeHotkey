/**
 * canvas-components.js - NodeHotkey Visual Node Editor Form Components
 * Modular, reusable UI components for Node Inspector & Canvas Cards
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

  const CanvasComponents = {
    /**
     * Render a form field by schema definition
     */
    renderField(field, node) {
      if (!field || !field.component) return '';

      // Check conditional visibility (showIf / dependsOn)
      if (typeof field.showIf === 'function') {
        if (!field.showIf(node.data || {})) return '';
      } else if (typeof field.showIf === 'object' && field.showIf !== null) {
        for (const [prop, targetVal] of Object.entries(field.showIf)) {
          const actualVal = node.data ? node.data[prop] : undefined;
          if (Array.isArray(targetVal)) {
            if (!targetVal.includes(actualVal)) return '';
          } else if (actualVal !== targetVal) {
            return '';
          }
        }
      } else if (field.dependsOn && field.showIf !== undefined) {
        const actualVal = node.data ? node.data[field.dependsOn] : undefined;
        if (Array.isArray(field.showIf)) {
          if (!field.showIf.includes(actualVal)) return '';
        } else if (actualVal !== field.showIf) {
          return '';
        }
      }

      const renderer = this.components[field.component];
      if (typeof renderer !== 'function') {
        console.warn(`[CanvasComponents] Unknown component type: "${field.component}"`);
        return '';
      }
      const val = node.data ? node.data[field.key] : undefined;
      return renderer.call(this, field, val, node);
    },

    /**
     * Component Renderers Library
     */
    components: {
      client_selector(field, value, node) {
        const isEn = window.currentLang === 'en';
        const isVisionNode = ['party_slot', 'party_scanner', 'party_heal', 'party_buff', 'screenshot'].includes(node?.type);
        const isSingleSelect = field.allowMultiple === false || field.singleSelect === true || isVisionNode;
        let rawVal = String(value !== undefined ? value : (node.data?.[field.key || 'targetClient'] || '1'));
        if (isSingleSelect && (rawVal === 'all' || rawVal === 'both' || rawVal.includes(','))) {
          rawVal = rawVal.split(',')[0].trim() || '1';
          if (node.data) node.data[field.key || 'targetClient'] = rawVal;
        }

        const availableSlots = (window.fullConfig && window.fullConfig.globalSettings && Array.isArray(window.fullConfig.globalSettings.clientSlots) && window.fullConfig.globalSettings.clientSlots.length > 0)
          ? window.fullConfig.globalSettings.clientSlots
          : [1, 2, 3, 4, 5, 6, 7, 8];

        let selectedList = [];
        const isAllSelected = !isSingleSelect && (rawVal === 'all' || rawVal === 'both');
        if (isAllSelected) {
          selectedList = availableSlots.map(String);
        } else {
          selectedList = rawVal.split(',').map(s => s.trim()).filter(Boolean);
          if (isSingleSelect && selectedList.length > 1) {
            selectedList = [selectedList[0]];
          }
        }
        const allowAll = !isSingleSelect && (field.allowAll !== false);
        const label = canvasT(field.labelKey, field.label || (isEn ? 'Target Client Screen' : 'เลือกจอเป้าหมาย (Client)'));

        let clientBadge = '';
        if (isSingleSelect) {
          const currentTarget = selectedList[0] || String(availableSlots[0] || '1');
          clientBadge = isEn ? `Client ${currentTarget} (Single)` : `จอที่ ${currentTarget} (จอเดียว)`;
        } else if (rawVal === 'all') {
          clientBadge = isEn ? 'All Clients' : 'ทุกจอเกม';
        } else if (selectedList.length === 1) {
          clientBadge = isEn ? `Client ${selectedList[0]}` : `จอที่ ${selectedList[0]}`;
        } else if (selectedList.length > 1) {
          clientBadge = isEn ? `Clients ${selectedList.join(',')}` : `จอที่ ${selectedList.join(',')}`;
        } else {
          clientBadge = isEn ? 'None' : 'ไม่มี';
        }

        let buttonsHTML = '';
        for (const i of availableSlots) {
          const strI = String(i);
          const isSelected = isAllSelected || selectedList.includes(strI);
          const bg = isSelected ? '#3b82f6' : 'rgba(15,23,42,0.8)';
          const border = isSelected ? '#60a5fa' : 'rgba(255,255,255,0.12)';
          const color = isSelected ? '#ffffff' : '#94a3b8';
          const shadow = isSelected ? 'box-shadow: 0 0 10px rgba(59,130,246,0.45);' : '';
          buttonsHTML += `
            <button type="button" class="btn-client-chip ${isSelected ? 'active' : ''}"
              onclick="if(window.nodeCanvas?.toggleClientSelection){window.nodeCanvas.toggleClientSelection('${node.id}', '${strI}');}else{window.nodeCanvas.updateNodeData('${node.id}', '${field.key || 'targetClient'}', '${strI}'); window.nodeCanvas.openInspector('${node.id}');}"
              style="background:${bg}; border:1px solid ${border}; color:${color}; width:28px; height:28px; border-radius:50%; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease; outline:none; font-family:inherit; ${shadow}"
              title="${isEn ? `Client ${i}` : `Client จอที่ ${i}`}">
              ${i}
            </button>
          `;
        }

        let allBtnHTML = '';
        if (allowAll) {
          const allBg = isAllSelected ? '#3b82f6' : 'rgba(15,23,42,0.8)';
          const allBorder = isAllSelected ? '#60a5fa' : 'rgba(255,255,255,0.12)';
          const allColor = isAllSelected ? '#ffffff' : '#94a3b8';
          const allShadow = isAllSelected ? 'box-shadow: 0 0 10px rgba(59,130,246,0.45);' : '';
          allBtnHTML = `
            <button type="button" class="btn-client-chip btn-client-chip-all ${isAllSelected ? 'active' : ''}"
              onclick="if(window.nodeCanvas?.toggleClientSelection){window.nodeCanvas.toggleClientSelection('${node.id}', 'all');}else{window.nodeCanvas.updateNodeData('${node.id}', '${field.key || 'targetClient'}', 'all'); window.nodeCanvas.openInspector('${node.id}');}"
              style="background:${allBg}; border:1px solid ${allBorder}; color:${allColor}; padding:0 12px; height:28px; border-radius:14px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s ease; outline:none; font-family:inherit; ${allShadow}"
              title="${isEn ? 'All Active Clients' : 'เลือกทุกจอ'}">
              ${isEn ? 'ALL' : 'ทุกจอ'}
            </button>
          `;
        }

        return `
          <div class="inspector-field-group">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
              <label class="inspector-label" style="margin:0;">${label}</label>
              <span style="font-size:10.5px; font-weight:700; color:#38bdf8;">
                ${clientBadge}
              </span>
            </div>
            <div class="client-chips-grid" style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-top:4px;">
              ${buttonsHTML}
              ${allBtnHTML}
            </div>
          </div>
        `;
      },

      number_input(field, value, node) {
        const val = value !== undefined ? value : (field.default ?? 0);
        const label = canvasT(field.labelKey, field.label || field.key);
        const min = field.min !== undefined ? `min="${field.min}"` : '';
        const max = field.max !== undefined ? `max="${field.max}"` : '';
        const step = field.step !== undefined ? `step="${field.step}"` : '';
        const isFloat = field.isFloat === true;
        const parseFn = isFloat ? 'parseFloat(this.value)' : 'parseInt(this.value, 10)';

        return `
          <div class="inspector-field-group">
            <label class="inspector-label">${label}</label>
            <input type="number" class="inspector-input" value="${val}" ${min} ${max} ${step} onchange="window.nodeCanvas.updateNodeData('${node.id}', '${field.key}', ${parseFn})" />
          </div>
        `;
      },

      slider(field, value, node) {
        const val = value !== undefined ? value : (field.default ?? 50);
        const label = canvasT(field.labelKey, field.label || field.key);
        const min = field.min !== undefined ? field.min : 0;
        const max = field.max !== undefined ? field.max : 100;
        const step = field.step !== undefined ? field.step : 1;
        const unit = field.unit || '';
        const color = field.accentColor || '#ef4444';

        return `
          <div class="inspector-field-group">
            <label class="inspector-label">${label}</label>
            <div style="display:flex; align-items:center; gap:8px;">
              <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" style="flex:1; accent-color:${color}; cursor:pointer;" oninput="this.nextElementSibling.innerText = this.value + '${unit}'; window.nodeCanvas.updateNodeData('${node.id}', '${field.key}', parseInt(this.value, 10));" />
              <span style="min-width:44px; font-weight:700; color:${color}; font-family:'JetBrains Mono',monospace;">${val}${unit}</span>
            </div>
          </div>
        `;
      },

      toggle(field, value, node) {
        const isChecked = value !== undefined ? (value !== false) : (field.default !== false);
        const label = canvasT(field.labelKey, field.label || field.key);
        const icon = field.icon ? `${field.icon} ` : '';
        const color = field.color || '#06b6d4';
        const hint = field.hintKey ? canvasT(field.hintKey, field.hint || '') : (field.hint || '');

        return `
          <div class="inspector-field-group" style="margin-top:6px;">
            <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
              <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', '${field.key}', this.checked)" style="accent-color:${color}; cursor:pointer;" />
              <span>${icon}${label}</span>
            </label>
            ${hint ? `<div style="font-size:10.5px; opacity:0.6; margin-top:2px; margin-left:22px; line-height:1.4;">${hint}</div>` : ''}
          </div>
        `;
      },

      select(field, value, node) {
        const currentVal = value !== undefined ? value : (field.default || '');
        const label = canvasT(field.labelKey, field.label || field.key);
        const options = Array.isArray(field.options) ? field.options : [];

        const optionsHTML = options.map(opt => {
          const optVal = typeof opt === 'object' ? opt.value : opt;
          const optLabel = typeof opt === 'object' ? canvasT(opt.labelKey, opt.label || opt.value) : opt;
          const isSelected = String(currentVal) === String(optVal);
          return `<option value="${optVal}" ${isSelected ? 'selected' : ''}>${optLabel}</option>`;
        }).join('');

        return `
          <div class="inspector-field-group">
            <label class="inspector-label">${label}</label>
            <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', '${field.key}', this.value); if(window.nodeCanvas?.openInspector) window.nodeCanvas.openInspector('${node.id}');">
              ${optionsHTML}
            </select>
          </div>
        `;
      },

      text_input(field, value, node) {
        const val = value !== undefined ? value : (field.default || '');
        const label = canvasT(field.labelKey, field.label || field.key);
        const placeholder = field.placeholder || '';

        return `
          <div class="inspector-field-group">
            <label class="inspector-label">${label}</label>
            <input type="text" class="inspector-input" value="${val}" placeholder="${placeholder}" onchange="window.nodeCanvas.updateNodeData('${node.id}', '${field.key}', this.value.trim());" />
          </div>
        `;
      },

      textarea(field, value, node) {
        const val = value !== undefined ? value : (field.default || '');
        const label = canvasT(field.labelKey, field.label || field.key);
        const placeholder = field.placeholder || '';
        const rows = field.rows || 3;

        return `
          <div class="inspector-field-group">
            <label class="inspector-label">${label}</label>
            <textarea class="inspector-input" rows="${rows}" placeholder="${placeholder}" style="font-family:'JetBrains Mono',monospace; resize:vertical;" onchange="window.nodeCanvas.updateNodeData('${node.id}', '${field.key}', this.value);">${val}</textarea>
          </div>
        `;
      },

      key_recorder(field, value, node) {
        const val = value || node.data?.[field.key] || '1';
        const label = canvasT(field.labelKey, field.label || 'Target Key');
        const placeholderText = (typeof window !== 'undefined' && window.currentLang === 'en') ? 'Click to record key...' : 'คลิกเพื่อบันทึกคีย์...';

        return `
          <div class="inspector-field-group">
            <label class="inspector-label">${label}</label>
            <div style="display:flex; align-items:center; gap:6px;">
              <input type="text" class="inspector-input" value="${val}" placeholder="${placeholderText}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', '${field.key || 'targetKey'}')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" onchange="if(window.nodeCanvas?.updateNodeData) window.nodeCanvas.updateNodeData('${node.id}', '${field.key || 'targetKey'}', this.value.trim());" style="flex:1; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" />
              <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', '${field.key || 'targetKey'}')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
            </div>
          </div>
        `;
      },

      cooldown_guard(field, value, node) {
        if (typeof window.nodeCanvas?.renderSkillCooldownHelper === 'function') {
          return window.nodeCanvas.renderSkillCooldownHelper(node);
        }
        return '';
      },

      condition_rules(field, value, node) {
        const isEn = (typeof window !== 'undefined' && window.currentLang === 'en');
        const conditions = Array.isArray(value) ? value : (Array.isArray(node?.data?.conditions) ? node.data.conditions : []);

        const allVars = (typeof window.nodeCanvas?.getAvailableVariables === 'function')
          ? window.nodeCanvas.getAvailableVariables()
          : (window.nodeCanvas?.variables || []);

        const checkableActionTypes = [
          'loop', 'sequencer', 'cast_sequence', 'buff_sequence', 
          'key_hold', 'loop_scheduler', 'party_scanner', 'party_buff', 'party_heal', 'party_slot'
        ];
        const actionNodes = (window.nodeCanvas?.nodes || []).filter(n => n.id !== node.id && checkableActionTypes.includes(n.type));

        let conditionsHTML = '';
        if (conditions.length === 0) {
          conditionsHTML = `
            <div style="font-size:12px; color:var(--muted); text-align:center; padding:18px 10px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px dashed rgba(255,255,255,0.1); margin-bottom:10px;">
              ${isEn ? 'No conditions added yet. Click <strong>+ Add Condition</strong> below.' : 'ยังไม่มีเงื่อนไขในกลุ่ม คลิกปุ่ม <strong>+ เพิ่มเงื่อนไข</strong> ด้านล่าง'}
            </div>
          `;
        } else {
          conditionsHTML = conditions.map((cond, idx) => {
            const cType = cond.type || 'variable';
            let detailHTML = '';

            if (cType === 'variable') {
              const varName = (cond.varName || '').trim();
              const vType = cond.varType || 'boolean';
              const rule = cond.rule || (vType === 'boolean' ? 'is_true' : 'equals');
              const val = cond.value !== undefined ? cond.value : '';

              detailHTML = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <div>
                    <label style="font-size:11px; font-weight:600; color:var(--muted); display:block; margin-bottom:4px;">${isEn ? 'Variable Name' : 'เลือกตัวแปร'}</label>
                    <select class="inspector-select-sm" onchange="window.nodeCanvas.updateConditionGroupItem('${node.id}', ${idx}, 'varName', this.value)">
                      <option value="">${isEn ? '-- Select Variable --' : '-- เลือกตัวแปร --'}</option>
                      ${allVars.map(v => `<option value="${v.name}" ${v.name === varName ? 'selected' : ''}>${v.name} (${v.type || 'bool'})</option>`).join('')}
                    </select>
                  </div>
                  <div style="display:flex; gap:8px;">
                    <div style="flex:1;">
                      <label style="font-size:11px; font-weight:600; color:var(--muted); display:block; margin-bottom:4px;">${isEn ? 'Rule' : 'เงื่อนไข'}</label>
                      <select class="inspector-select-sm" onchange="window.nodeCanvas.updateConditionGroupItem('${node.id}', ${idx}, 'rule', this.value)">
                        ${vType === 'boolean' ? `
                          <option value="is_true" ${rule === 'is_true' ? 'selected' : ''}>${isEn ? '🟢 Is True' : '🟢 เป็นจริง (True)'}</option>
                          <option value="is_false" ${rule === 'is_false' ? 'selected' : ''}>${isEn ? '🔴 Is False' : '🔴 เป็นเท็จ (False)'}</option>
                        ` : vType === 'number' ? `
                          <option value="equals" ${rule === 'equals' ? 'selected' : ''}>== (เท่ากับ)</option>
                          <option value="not_equals" ${rule === 'not_equals' ? 'selected' : ''}>!= (ไม่เท่ากับ)</option>
                          <option value="greater_than" ${rule === 'greater_than' ? 'selected' : ''}>&gt; (มากกว่า)</option>
                          <option value="less_than" ${rule === 'less_than' ? 'selected' : ''}>&lt; (น้อยกว่า)</option>
                          <option value="greater_or_equal" ${rule === 'greater_or_equal' ? 'selected' : ''}>&gt;= (มากกว่าเท่ากับ)</option>
                          <option value="less_or_equal" ${rule === 'less_or_equal' ? 'selected' : ''}>&lt;= (น้อยกว่าเท่ากับ)</option>
                        ` : `
                          <option value="equals" ${rule === 'equals' ? 'selected' : ''}>== (ตรงกับ)</option>
                          <option value="not_equals" ${rule === 'not_equals' ? 'selected' : ''}>!= (ไม่ตรงกับ)</option>
                        `}
                      </select>
                    </div>
                    ${vType !== 'boolean' ? `
                      <div style="flex:1;">
                        <label style="font-size:11px; font-weight:600; color:var(--muted); display:block; margin-bottom:4px;">${isEn ? 'Compare Value' : 'ค่าเปรียบเทียบ'}</label>
                        <input type="${vType === 'number' ? 'number' : 'text'}" class="inspector-input-sm" value="${val}" placeholder="Value..." onchange="window.nodeCanvas.updateConditionGroupItem('${node.id}', ${idx}, 'value', this.value)" />
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
            } else if (cType === 'action') {
              const actId = (cond.actionId || '').trim();
              const actRule = cond.actionRule || 'is_running';

              detailHTML = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                  <div>
                    <label style="font-size:11px; font-weight:600; color:var(--muted); display:block; margin-bottom:4px;">${isEn ? 'Target Action' : 'เลือก Action'}</label>
                    <select class="inspector-select-sm" onchange="window.nodeCanvas.updateConditionGroupItem('${node.id}', ${idx}, 'actionId', this.value)">
                      <option value="">${isEn ? '-- Select Action --' : '-- เลือก Action --'}</option>
                      ${actionNodes.map(n => {
                        const id = n.data?.actionId || n.id;
                        return `<option value="${id}" ${id === actId ? 'selected' : ''}>${n.title || n.type}</option>`;
                      }).join('')}
                    </select>
                  </div>
                  <div>
                    <label style="font-size:11px; font-weight:600; color:var(--muted); display:block; margin-bottom:4px;">${isEn ? 'Status' : 'สถานะ'}</label>
                    <select class="inspector-select-sm" onchange="window.nodeCanvas.updateConditionGroupItem('${node.id}', ${idx}, 'actionRule', this.value)">
                      <option value="is_running" ${actRule === 'is_running' ? 'selected' : ''}>${isEn ? '🟢 Running (กำลังทำงาน)' : '🟢 กำลังทำงาน (Running)'}</option>
                      <option value="is_stopped" ${actRule === 'is_stopped' ? 'selected' : ''}>${isEn ? '🔴 Stopped (หยุดทำงาน)' : '🔴 หยุดทำงาน (Stopped)'}</option>
                    </select>
                  </div>
                </div>
              `;
            } else if (cType === 'client') {
              const clientTarget = cond.targetClient || '1';
              const clientRule = cond.clientRule || 'is_active';

              detailHTML = `
                <div style="display:flex; gap:8px;">
                  <div style="flex:1;">
                    <label style="font-size:11px; font-weight:600; color:var(--muted); display:block; margin-bottom:4px;">${isEn ? 'Target Client' : 'จอเป้าหมาย'}</label>
                    <select class="inspector-select-sm" onchange="window.nodeCanvas.updateConditionGroupItem('${node.id}', ${idx}, 'targetClient', this.value)">
                      <option value="1" ${clientTarget === '1' ? 'selected' : ''}>Client 1</option>
                      <option value="2" ${clientTarget === '2' ? 'selected' : ''}>Client 2</option>
                      <option value="3" ${clientTarget === '3' ? 'selected' : ''}>Client 3</option>
                      <option value="4" ${clientTarget === '4' ? 'selected' : ''}>Client 4</option>
                      <option value="5" ${clientTarget === '5' ? 'selected' : ''}>Client 5</option>
                    </select>
                  </div>
                  <div style="flex:1;">
                    <label style="font-size:11px; font-weight:600; color:var(--muted); display:block; margin-bottom:4px;">${isEn ? 'Status' : 'สถานะ'}</label>
                    <select class="inspector-select-sm" onchange="window.nodeCanvas.updateConditionGroupItem('${node.id}', ${idx}, 'clientRule', this.value)">
                      <option value="is_active" ${clientRule === 'is_active' ? 'selected' : ''}>${isEn ? '🟢 Active (เปิดอยู่)' : '🟢 เปิดอยู่ (Active)'}</option>
                      <option value="is_inactive" ${clientRule === 'is_inactive' ? 'selected' : ''}>${isEn ? '🔴 Inactive (ปิดอยู่)' : '🔴 ปิดอยู่ (Inactive)'}</option>
                    </select>
                  </div>
                </div>
              `;
            }

            return `
              <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                  <div style="display:flex; align-items:center; gap:6px; flex:1;">
                    <span style="font-size:11px; font-weight:700; color:#a78bfa; background:rgba(167,139,250,0.15); border:1px solid rgba(167,139,250,0.3); width:24px; height:24px; border-radius:6px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${idx + 1}</span>
                    <select class="inspector-select-sm" style="height:28px; min-height:28px; padding:2px 8px; font-size:12px; font-weight:600; width:auto; flex:1;" onchange="window.nodeCanvas.updateConditionGroupItemType('${node.id}', ${idx}, this.value)">
                      <option value="variable" ${cType === 'variable' ? 'selected' : ''}>🔹 ${isEn ? 'Variable' : 'ตัวแปร (Variable)'}</option>
                      <option value="action" ${cType === 'action' ? 'selected' : ''}>⚡ ${isEn ? 'Action Status' : 'สถานะคำสั่ง (Action)'}</option>
                      <option value="client" ${cType === 'client' ? 'selected' : ''}>🖥️ ${isEn ? 'Client Screen' : 'สถานะจอเกม (Client)'}</option>
                    </select>
                  </div>
                  <button type="button" class="btn btn-ghost" style="padding:0 8px; height:28px; font-size:12px; color:#ef4444; border:1px solid rgba(239,68,68,0.25); background:rgba(239,68,68,0.08); border-radius:6px; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;" onclick="window.nodeCanvas.removeConditionGroupItem('${node.id}', ${idx})" title="${isEn ? 'Delete condition' : 'ลบเงื่อนไขนี้'}">🗑️</button>
                </div>
                ${detailHTML}
              </div>
            `;
          }).join('');
        }

        return `
          <div class="inspector-field-group" style="margin-top:12px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
              <label class="inspector-label" style="margin:0;">${canvasT(field.labelKey, field.label || (isEn ? 'Condition Rules' : 'รายการเงื่อนไข'))}</label>
              <span style="font-size:10px; font-weight:700; color:#a78bfa; background:rgba(167,139,250,0.15); border:1px solid rgba(167,139,250,0.3); padding:2px 8px; border-radius:10px;">
                ${conditions.length} ${isEn ? 'rule(s)' : 'เงื่อนไข'}
              </span>
            </div>
            ${conditionsHTML}
            <button type="button" class="btn btn-ghost" style="width:100%; border:1px dashed #8b5cf6; color:#a78bfa; font-size:12px; font-weight:600; padding:8px 0; border-radius:8px; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;" onclick="window.nodeCanvas.addConditionGroupItem('${node.id}')">
              ➕ ${isEn ? 'Add Condition' : 'เพิ่มเงื่อนไข'}
            </button>
          </div>

          <div class="inspector-helper-box" style="margin-top:12px; font-size:11px; color:#94a3b8; background:rgba(139,92,246,0.08); border-left:3px solid #8b5cf6; padding:8px 12px; border-radius:4px; line-height:1.5;">
            🟢 <strong>onTrue:</strong> ${isEn ? 'Executed when logic passes.' : 'ทำงานเมื่อผ่านเงื่อนไข'}<br>
            🔴 <strong>onFalse:</strong> ${isEn ? 'Executed when logic fails (optional).' : 'ทำงานเมื่อไม่ผ่านเงื่อนไข (ปล่อยว่างได้)'}
          </div>
        `;
      }
    },

    /**
     * Render node card summary rows automatically from def.summaryFields
     */
    renderCardSummary(node, def) {
      if (!def || !Array.isArray(def.summaryFields) || def.summaryFields.length === 0) {
        return null;
      }

      const rows = [];
      for (const item of def.summaryFields) {
        const val = node.data ? node.data[item.key] : undefined;
        let formattedVal = val !== undefined ? String(val) : '-';

        if (item.format === 'boolean_on_off') {
          formattedVal = val !== false ? '🟢 ON' : '⚫ OFF';
        } else if (item.format === 'logic_mode') {
          formattedVal = (val === 'OR') ? 'OR (Any)' : 'AND (All)';
        } else if (typeof item.format === 'function') {
          formattedVal = item.format(val, node.data);
        } else if (typeof item.format === 'string') {
          let str = item.format;
          if (str.includes('{count}')) {
            const count = Array.isArray(val) ? val.length : 0;
            str = str.replace('{count}', count);
          }
          if (str.includes('{value}')) {
            str = str.replace('{value}', val !== undefined ? val : '-');
          }
          formattedVal = str;
        }

        rows.push(`
          <div class="node-info-row">
            <span>${item.label}:</span> <span class="node-info-value">${formattedVal}</span>
          </div>
        `);
      }

      return rows.join('');
    }
  };

  window.CanvasComponents = CanvasComponents;
})();
