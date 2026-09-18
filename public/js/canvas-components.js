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
        const rawVal = String(value !== undefined ? value : (node.data?.[field.key || 'targetClient'] || '1'));
        let selectedList = [];
        const isAllSelected = rawVal === 'all' || rawVal === 'both';
        if (isAllSelected) {
          selectedList = ['1', '2', '3', '4', '5', '6', '7', '8'];
        } else {
          selectedList = rawVal.split(',').map(s => s.trim()).filter(Boolean);
        }
        const allowAll = field.allowAll !== false;
        const label = canvasT(field.labelKey, field.label || (isEn ? 'Target Client Screen' : 'เลือกจอเป้าหมาย (Client)'));

        let clientBadge = '';
        if (rawVal === 'all') {
          clientBadge = isEn ? 'All Clients' : 'ทุกจอเกม';
        } else if (selectedList.length === 1) {
          clientBadge = isEn ? `Client ${selectedList[0]}` : `จอที่ ${selectedList[0]}`;
        } else if (selectedList.length > 1) {
          clientBadge = isEn ? `Clients ${selectedList.join(',')}` : `จอที่ ${selectedList.join(',')}`;
        } else {
          clientBadge = isEn ? 'None' : 'ไม่มี';
        }

        let buttonsHTML = '';
        for (let i = 1; i <= 8; i++) {
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
        } else if (typeof item.format === 'function') {
          formattedVal = item.format(val, node.data);
        } else if (typeof item.format === 'string') {
          formattedVal = item.format.replace('{value}', val !== undefined ? val : '-');
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
