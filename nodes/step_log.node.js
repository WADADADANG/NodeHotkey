/**
 * nodes/step_log.node.js
 * Action Node: Log Message / Print String
 * 
 * Emits dedicated, high-visibility log messages to Terminal/Logs.
 * Supports Unreal Engine-style Data Pin input ('msg_in') to log dynamic variables (string/number/bool).
 * Automatically classified as 'log' level and filterable in Launcher Terminal.
 */

module.exports = {
  type: 'step_log',
  aliases: ['step', 'steplog', 'step_checkpoint', 'log', 'log_message', 'print_string'],
  title: 'Log Message',
  category: 'Utility & Debug',
  icon: 'file-text',
  color: '#10b981',
  inputs: ['in', 'msg_in'],
  outputs: ['onComplete'],
  defaultData: {
    message: ''
  },
  schema: [
    { key: 'message', component: 'textarea', labelKey: 'inspector_log_message', label: 'Log Message to Print (ข้อความบันทึก Log)', placeholder: 'ระบุข้อความที่ต้องการแสดงในแท็บ Log หรือรับผ่าน Data Wire (msg_in)' }
  ],
  summaryFields: [
    { key: 'message', label: 'Message', format: val => val ? (val.length > 20 ? val.substring(0, 18) + '...' : val) : '(From Pin)' }
  ],
  doc: {
    titleTh: 'บันทึกข้อความ (Log Message / Print String)',
    titleEn: 'Log Message / Print String',
    badge: 'Diagnostics',
    descTh: 'พิมพ์ข้อความตรวจสอบและส่งสัญญาณ Log ออก Console Terminal รองรับทั้งพิมพ์ข้อความตรงๆ หรือรับค่า Dynamic ผ่านสาย Data Wire (msg_in)',
    descEn: 'Emits dedicated log messages to console and log files. Supports dynamic input from Data Wire (msg_in).',
    inputs: [
      { name: 'in', type: 'flow', descTh: 'รับสัญญาณสั่งบันทึกข้อความ', descEn: 'Execution flow in' },
      { name: 'msg_in', type: 'data', descTh: 'รับข้อมูลข้อความ/ตัวแปรผ่านสาย Data Wire', descEn: 'Dynamic message or variable data input' }
    ],
    outputs: [
      { name: 'onComplete', type: 'flow', descTh: 'ส่งสัญญาณออกทำงานต่อเนื่องหลังบันทึกเสร็จ', descEn: 'Fires downstream after log is emitted' }
    ],
    parameters: [
      { key: 'message', nameTh: 'ข้อความบันทึก', nameEn: 'Log Message', type: 'string', default: '', descTh: 'ข้อความที่ต้องการบันทึก (หรือเว้นว่างเพื่อรับจาก msg_in)', descEn: 'Message text to display in log' }
    ],
    bestPracticeTh: 'ใช้ต่อจากโหนดคำนวณ หรือ Format Text เพื่อพิมพ์ค่าตัวแปรออกมาดูใน Terminal หรือใส่ตามทางแยกเพื่อดูว่าโปรแกรมวิ่งไปทางไหน',
    bestPracticeEn: 'Wire downstream of Format Text or arithmetic nodes to inspect dynamic values in terminal.',
    exampleBlueprint: '[Format Text] ──(msg_out)──▶ (msg_in)[Log Message] ──▶ [Next]'
  },

  async execute(context, action, callStack = []) {
    if (global.isSuspended) return false;

    // 1. Resolve dynamic data from incoming data wire ('msg_in') if available
    let resolvedMsg = null;
    if (typeof global.resolveNodeInputData === 'function') {
      resolvedMsg = global.resolveNodeInputData(action, 'msg_in');
    }

    // 2. Fallback to static message configured in Inspector
    if (resolvedMsg === null || resolvedMsg === undefined || resolvedMsg === '') {
      resolvedMsg = action.message !== undefined ? action.message : (action.logMessage || action.text || '');
    }

    // 3. Fallback to custom action name ONLY if explicitly renamed and not a default title
    if (!resolvedMsg && action.name && !action.name.startsWith('Log Message') && !action.name.startsWith('Step Log') && !action.name.startsWith('node_')) {
      resolvedMsg = action.name;
    }
    if (!resolvedMsg) resolvedMsg = 'Log Message';

    const clientPrefix = action.showClient && action.targetClient ? `[Client ${action.targetClient}] ` : '';

    // 3. Emit formatted Log to stdout (classified by Launcher as level: 'log')
    // Support multiline logs (e.g. from Format Text) so each line is tagged and visible in the Log filter
    const lines = String(resolvedMsg).split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.log(`📝 [Log] ${clientPrefix}${line}`.trim());
      }
    }

    // 4. Emit onComplete signal to trigger subsequent execution flow
    if (typeof global.emitSignal === 'function') {
      global.emitSignal(action.id, 'onComplete');
    }
    if (typeof global.fireChain === 'function') {
      await global.fireChain(action, 'onComplete', callStack);
    }

    return true;
  }
};
