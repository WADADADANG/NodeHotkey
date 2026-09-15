/**
 * nodes/webhook_out.node.js
 * Action Node: Outbound HTTP / Discord Webhook
 * 
 * Sends POST/GET HTTP requests or Discord webhooks when triggered in the graph.
 */

module.exports = {
  type: 'webhook_out',
  aliases: ['http_request'],
  title: 'Discord / HTTP Webhook',
  category: 'Utility / Network',
  icon: '🌐',
  color: '#6366f1',
  inputs: ['in'],
  outputs: ['onComplete', 'onError'],
  defaultData: {
    url: '',
    method: 'POST',
    headers: '{\n  "Content-Type": "application/json"\n}',
    payload: '{\n  "content": "⚡ NodeHotkey Alert: Triggered!"\n}',
    timeoutMs: 5000
  },

  async execute(context, action, callStack = []) {
    if (global.isSuspended) return false;

    const url = (action.url || '').trim();
    if (!url) {
      console.warn(`[Webhook Out Node] "${action.name}": URL is empty, skipping.`);
      if (typeof global.emitSignal === 'function') global.emitSignal(action.id, 'onError');
      if (typeof global.fireChain === 'function') await global.fireChain(action, 'onError', callStack);
      return false;
    }

    const method = (action.method || 'POST').toUpperCase();
    let headers = {};
    try {
      if (action.headers) {
        headers = typeof action.headers === 'string' ? JSON.parse(action.headers) : action.headers;
      }
    } catch (e) {
      headers = {};
    }
    if (!headers['Content-Type'] && method !== 'GET' && method !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
    }

    const timeoutMs = parseInt(action.timeoutMs, 10) || 5000;
    let body = undefined;
    if (method !== 'GET' && method !== 'HEAD' && action.payload !== undefined && action.payload !== '') {
      body = typeof action.payload === 'string' ? action.payload : JSON.stringify(action.payload);
    }

    console.log(`[Webhook Out Node] "${action.name}" -> ${method} ${url}`);
    if (typeof global.emitSignal === 'function') global.emitSignal(action.id, 'trigger');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      console.log(`[Webhook Out Node] "${action.name}" -> Status: ${response.status} ${response.statusText}`);
      if (typeof global.emitSignal === 'function') global.emitSignal(action.id, 'onComplete');
      if (typeof global.fireChain === 'function') await global.fireChain(action, 'onComplete', callStack);
      return true;
    } catch (err) {
      console.error(`[Webhook Out Node] "${action.name}" Error:`, err.message);
      if (typeof global.emitSignal === 'function') global.emitSignal(action.id, 'onError');
      if (typeof global.fireChain === 'function') await global.fireChain(action, 'onError', callStack);
      return false;
    }
  }
};
