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
  icon: '📝',
  color: '#10b981',
  inputs: ['in', 'msg_in'],
  outputs: ['onComplete'],
  defaultData: {
    message: ''
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
