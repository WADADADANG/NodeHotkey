/**
 * nodes/step_log.node.js
 * Action Node: Step Log / Workflow Checkpoint
 * 
 * Emits dedicated, high-visibility step checkpoint logs for flow validation.
 * Supports Unreal Engine-style Data Pin input ('msg_in') to log dynamic variables (string/number/bool).
 * Automatically classified as 'step' level and filterable in Launcher Terminal.
 */

module.exports = {
  type: 'step_log',
  aliases: ['step', 'steplog', 'step_checkpoint'],
  title: 'Step Log',
  category: 'Utility & Debug',
  icon: '🧭',
  color: '#10b981',
  inputs: ['in', 'msg_in'],
  outputs: ['onComplete'],
  defaultData: {
    stepTag: 'STEP 1',
    message: 'Reached workflow checkpoint',
    showClient: true
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
      resolvedMsg = action.message || action.logMessage || 'Reached checkpoint';
    }

    const tag = (action.stepTag || action.name || 'STEP').trim();
    const clientPrefix = action.showClient && action.targetClient ? `[Client ${action.targetClient}] ` : '';

    // 3. Emit formatted Step Log to stdout (classified by Launcher as level: 'step')
    console.log(`🧭 [Step] ${clientPrefix}[${tag}] ${resolvedMsg}`);

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
