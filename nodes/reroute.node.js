/**
 * nodes/reroute.node.js
 * Action Node: Reroute Node (Unreal Engine Blueprint Knot)
 * 
 * Provides an ultra-compact pass-through junction point for wiring cleanup.
 * Allows multiple input wires to merge into one, and one wire to branch into multiple.
 * Signal latency is 0ms (instant pass-through).
 */

module.exports = {
  type: 'reroute',
  aliases: ['knot', 'reroute_node', 'wire_pin', 'junction'],
  title: 'Reroute',
  category: 'Logic & Flow',
  icon: 'circle-dot',
  color: '#38bdf8',
  inputs: ['in'],
  outputs: ['out'],
  defaultData: {
    enabled: true
  },
  schema: [],
  summaryFields: [],

  async execute(context, action, callStack = new Set()) {
    if (global.isSuspended) return false;

    const stack = (callStack instanceof Set) ? callStack : new Set(Array.isArray(callStack) ? callStack : []);
    if (typeof global.runRerouteAction === 'function') {
      await global.runRerouteAction(action, stack);
      return true;
    }

    if (typeof global.fireChain === 'function') {
      await global.fireChain(action, 'out', stack);
      return true;
    }

    return true;
  }
};
