/**
 * node-registry.js
 * Central Registry for Action Nodes in NodeHotkey v3.1
 * Provides isolated, modular node execution without switch-case sprawl.
 */

const fs = require('fs');
const path = require('path');

class NodeRegistry {
  constructor() {
    this.nodes = new Map();
  }

  /**
   * Register a node definition
   * @param {Object} nodeDef
   * @param {string} nodeDef.type - Unique type identifier (e.g. 'screenshot', 'sound')
   * @param {string} [nodeDef.title] - Display title
   * @param {string} [nodeDef.category] - Palette category (e.g. 'Utility', 'Vision', 'Action')
   * @param {string} [nodeDef.icon] - Emoji/Icon
   * @param {string} [nodeDef.color] - Node accent color
   * @param {Array<string>} [nodeDef.inputs] - Input ports (default: ['in'])
   * @param {Array<string>} [nodeDef.outputs] - Output ports (default: ['onComplete', 'onError'])
   * @param {Object} [nodeDef.defaultData] - Default configuration data
   * @param {Function} [nodeDef.execute] - Async execution handler: async (context, action, callStack) => {}
   */
  register(nodeDef, silent = true) {
    if (!nodeDef || !nodeDef.type) {
      throw new Error('[NodeRegistry] Node definition must specify a "type" string.');
    }
    this.nodes.set(nodeDef.type, nodeDef);
    if (Array.isArray(nodeDef.aliases)) {
      for (const alias of nodeDef.aliases) {
        this.nodes.set(alias, nodeDef);
      }
    }
    if (!silent) {
      console.log(`[NodeRegistry] Registered node: "${nodeDef.type}" (${nodeDef.title || nodeDef.type})`);
    }
  }

  get(type) {
    return this.nodes.get(type) || null;
  }

  has(type) {
    return this.nodes.has(type);
  }

  getAll() {
    return Array.from(new Set(this.nodes.values()));
  }

  /**
   * Automatically load all *.node.js files from the specified directory
   * @param {string} [dirPath] - Defaults to path.join(__dirname, 'nodes')
   */
  loadAll(dirPath) {
    const targetDir = dirPath || path.join(__dirname, 'nodes');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(targetDir);
    let loadedCount = 0;
    const failedNodes = [];

    for (const file of files) {
      if (file.endsWith('.node.js') || (file.endsWith('.js') && !file.startsWith('_'))) {
        try {
          const fullPath = path.join(targetDir, file);
          // Clear require cache for development hot-reloading if needed
          delete require.cache[require.resolve(fullPath)];
          const nodeModule = require(fullPath);
          const nodeDef = typeof nodeModule === 'function' ? nodeModule() : nodeModule;
          if (nodeDef && nodeDef.type) {
            this.register(nodeDef, true);
            loadedCount++;
          }
        } catch (err) {
          failedNodes.push({ file, error: err.message });
        }
      }
    }

    if (failedNodes.length === 0) {
      console.log(`[NodeRegistry] Successfully loaded ${loadedCount} modular nodes.`);
    } else {
      console.warn(`[NodeRegistry] Loaded ${loadedCount} nodes (${failedNodes.length} failed):`);
      failedNodes.forEach(f => console.error(`   ❌ [${f.file}] ${f.error}`));
    }
  }

  /**
   * Execute an action using registered node handler
   * Returns true if handled, false if not found (fallback to legacy switch)
   */
  async execute(type, context, action, callStack) {
    const def = this.get(type);
    if (!def || typeof def.execute !== 'function') {
      return false;
    }
    await def.execute(context, action, callStack);
    return true;
  }
}

// Global Singleton
const globalRegistry = new NodeRegistry();

module.exports = {
  NodeRegistry,
  nodeRegistry: globalRegistry
};
