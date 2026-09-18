/**
 * nodes/delay.node.js
 * Action Node: Delay Timer
 * 
 * Pauses execution flow for specified milliseconds without blocking other parallel chains.
 */

module.exports = {
  type: 'delay',
  aliases: ['delay_only'],
  title: 'Delay Timer',
  category: 'Flow / Timing',
  icon: '⏳',
  color: '#eab308',
  inputs: ['in'],
  outputs: ['onBeforeStart', 'onComplete'],
  defaultData: {
    delayMs: 1000
  },
  schema: [
    { key: 'delayMs', component: 'number_input', labelKey: 'inspector_delay_ms', label: 'Delay Duration (ms)', min: 10, max: 60000, step: 50, unit: 'ms' }
  ],
  summaryFields: [
    { key: 'delayMs', label: 'Wait', format: '{value}ms' }
  ],

  async execute(context, action, callStack = []) {
    if (global.isSuspended) return false;

    const delay = action.delayMs !== undefined ? parseInt(action.delayMs, 10) : (action.delayBuff || 1000);
    console.log(`[Delay Node] Started: "${action.name || 'Delay'}" (Waiting ${delay}ms)...`);

    if (typeof global.fireChain === 'function') {
      await global.fireChain(action, 'onBeforeStart', callStack);
    }

    if (delay > 0) {
      const ok = typeof global.abortableSleep === 'function'
        ? await global.abortableSleep(delay, action.id)
        : await new Promise(res => setTimeout(res, delay));
      if (!ok || global.isSuspended) {
        console.log(`[Delay Node] Interrupted / Aborted: "${action.name || 'Delay'}"`);
        return false;
      }
    }

    if (global.isSuspended) return false;

    console.log(`[Delay Node] Finished: "${action.name || 'Delay'}" (${delay}ms complete)`);

    if (typeof global.fireChain === 'function') {
      await global.fireChain(action, 'onComplete', callStack);
    }
    return true;
  }
};
