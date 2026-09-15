/**
 * nodes/format_text.node.js
 * Action Node: Format Text / Combine Strings
 * 
 * Combines, formats, and interpolates dynamic data inputs (strings, numbers, booleans)
 * from other nodes (e.g., party_buff, party_scanner, var_get, variable) into a single formatted string.
 * Automatically converts boolean inputs to string representation based on configurable format (e.g. 'true'/'false', 'Yes'/'No', 'จริง'/'เท็จ').
 * 
 * Data Output Pin:
 *   - 'msg_out' (String - Pink): Emits the formatted string directly into step_log ('msg_in'), variable ('val_in'), tts ('text_in'), etc.
 * 
 * Flow Pins:
 *   - 'in' (exec_in): Execution trigger input
 *   - 'onComplete' (next): Flow continuation output
 */

module.exports = {
  type: 'format_text',
  aliases: ['format', 'format_string', 'string_format', 'concat_text', 'combine_text'],
  title: 'Format Text',
  category: 'Utility & Debug',
  icon: '🧩',
  isPure: true,
  inputs: [],
  outputs: ['msg_out'],
  dataOutputs: [
    { name: 'msg_out', type: 'string', label: 'Formatted Text' }
  ],
  defaultData: {
    template: '{val_a} {val_b}',
    pins: ['val_a', 'val_b'],
    boolFormat: 'true_false', // 'true_false' | 'yes_no' | 'on_off' | 'thai'
    separator: ' ',
    enabled: true
  },

  /**
   * Converts any value (boolean, number, string, object, array) to a formatted string.
   * If value is a boolean, converts it according to boolFormat.
   * 
   * @param {*} val - Raw value
   * @param {string} [boolFormat='true_false'] - Format style for boolean
   * @returns {string} Formatted string
   */
  formatValue(val, boolFormat = 'true_false') {
    if (val === null || val === undefined) {
      return '';
    }

    // Boolean conversion
    if (typeof val === 'boolean' || val === 'true' || val === 'false') {
      const isTrue = (val === true || val === 'true');
      switch (boolFormat) {
        case 'yes_no':
          return isTrue ? 'Yes' : 'No';
        case 'on_off':
          return isTrue ? 'ON' : 'OFF';
        case 'thai':
          return isTrue ? 'จริง' : 'เท็จ';
        case 'true_false':
        default:
          return isTrue ? 'true' : 'false';
      }
    }

    // Number conversion
    if (typeof val === 'number') {
      return String(val);
    }

    // Array conversion (e.g. party_scanner names_out: ['P1', 'P2'])
    if (Array.isArray(val)) {
      return val.join(', ');
    }

    // Object conversion
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch (_) {
        return String(val);
      }
    }

    return String(val);
  },

  /**
   * Computes the formatted text output by resolving all connected pin data and evaluating the template.
   * 
   * @param {Object} action - Action configuration object
   * @returns {string} Formatted string
   */
  computeFormattedText(action) {
    if (!action) return '';

    // Determine pins list
    let pins = [];
    if (Array.isArray(action.pins) && action.pins.length > 0) {
      pins = [...action.pins];
    } else if (typeof action.pins === 'string' && action.pins.trim()) {
      pins = action.pins.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Auto-detect any tokens inside template if pins is empty
    const template = typeof action.template === 'string' ? action.template : '';
    if (pins.length === 0 && template) {
      const detected = template.match(/\{([a-zA-Z0-9_\-]+)\}/g);
      if (detected) {
        pins = Array.from(new Set(detected.map(t => t.slice(1, -1).trim())));
      }
    }
    if (pins.length === 0) {
      pins = ['val_a', 'val_b'];
    }

    const boolFormat = action.boolFormat || 'true_false';
    const pinValues = {};
    const formattedPinValues = [];

    // Resolve data for each pin
    for (const pin of pins) {
      let rawVal = null;
      if (typeof global.resolveNodeInputData === 'function') {
        rawVal = global.resolveNodeInputData(action, pin);
      }
      if (rawVal === null || rawVal === undefined) {
        // Fallback to static action property if defined
        if (action[pin] !== undefined) {
          rawVal = action[pin];
        } else if (action.data && action.data[pin] !== undefined) {
          rawVal = action.data[pin];
        }
      }

      const strVal = this.formatValue(rawVal, boolFormat);
      pinValues[pin] = strVal;
      pinValues[pin.toLowerCase()] = strVal;
      formattedPinValues.push(strVal);
    }

    let result = '';
    if (template.trim() !== '') {
      // Replace tokens matching {pinName}
      result = template.replace(/\{([a-zA-Z0-9_\-]+)\}/g, (match, tokenName) => {
        const trimmed = tokenName.trim();
        if (pinValues[trimmed] !== undefined) {
          return pinValues[trimmed];
        }
        if (pinValues[trimmed.toLowerCase()] !== undefined) {
          return pinValues[trimmed.toLowerCase()];
        }
        return '';
      });
    } else {
      // Fallback concatenation using separator
      const sep = action.separator !== undefined ? action.separator : ' ';
      result = formattedPinValues.filter(v => v !== '').join(sep);
    }

    // Store computed result on action properties for downstream data wire pickup
    action.msg_out = result;
    action.val_out = result;
    action.value = result;

    return result;
  },

  /**
   * Pure data getter implementation (Unreal Blueprint Pure Node capability)
   */
  getValue(action) {
    return this.computeFormattedText(action);
  },

  async execute(context, action, callStack = []) {
    return this.computeFormattedText(action);
  }
};
