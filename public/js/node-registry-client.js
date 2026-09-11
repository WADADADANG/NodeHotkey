/**
 * public/js/node-registry-client.js
 * Frontend Node Registry for Canvas & Visual Studio (v3.1)
 * Dynamically loads and manages modular action node definitions.
 */

(function () {
  class ClientNodeRegistry {
    constructor() {
      this.nodes = new Map();
      this.listeners = [];
      this.isLoaded = false;
    }

    /**
     * Register a node template definition
     */
    register(nodeDef) {
      if (!nodeDef || !nodeDef.type) return;
      this.nodes.set(nodeDef.type, nodeDef);
      if (Array.isArray(nodeDef.aliases)) {
        for (const alias of nodeDef.aliases) {
          this.nodes.set(alias, nodeDef);
        }
      }
      this.notifyListeners();
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

    onUpdate(fn) {
      if (typeof fn === 'function') {
        this.listeners.push(fn);
      }
    }

    notifyListeners() {
      for (const fn of this.listeners) {
        try { fn(this.getAll()); } catch (e) { console.error('[ClientNodeRegistry] Listener error:', e); }
      }
    }

    /**
     * Fetch all modular node definitions from server API
     */
    async loadFromServer() {
      try {
        const res = await fetch('/api/nodes');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && data.success && Array.isArray(data.nodes)) {
          for (const nodeDef of data.nodes) {
            this.register(nodeDef);
          }
          this.isLoaded = true;
          console.log(`[ClientNodeRegistry] Loaded ${data.nodes.length} nodes from server.`);
        }
      } catch (err) {
        console.warn('[ClientNodeRegistry] Failed to load modular nodes from /api/nodes:', err.message);
      }
    }
  }

  window.clientNodeRegistry = new ClientNodeRegistry();

  // Auto-fetch on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.clientNodeRegistry.loadFromServer());
  } else {
    window.clientNodeRegistry.loadFromServer();
  }
})();
