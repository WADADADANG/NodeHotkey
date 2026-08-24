/**
 * canvas.js - NodeHotkey v3.0.0 Visual Node Canvas Editor Component
 * Supports:
 * - Multi-Node Selection via Right-Click Drag Box (Marquee selection)
 * - Multi-Node Dragging (Dragging any selected node moves all selected nodes together)
 * - Batch Deletion of all selected nodes (Delete/Backspace key or Inspector Delete All button)
 * - Bezier SVG Wire Connections
 * - Pan & Zoom, Grid Alignment, Undo/Redo & Manual Save Toolbar Integration
 * - Full Dynamic Bilingual (EN/TH) Real-time Synchronization
 */

function canvasT(key, fallback = '') {
  if (typeof window.t === 'function') {
    const val = window.t(key);
    if (val && val !== key) return val;
  }
  return fallback || key;
}

class NodeCanvasEditor {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`[NodeCanvasEditor] Container #${containerId} not found`);
      return;
    }

    this.onProfileChanged = options.onProfileChanged || function() {};
    
    this.zoom = 1.0;
    this.pan = { x: 0, y: 0 };
    this.nodes = [];
    this.connections = [];

    // History Timeline state
    this.historyTimeline = [];
    this.activeDrawerTab = 'outliner';
    this.currentHistoryId = null;

    // Multi-selection state
    this.selectedNodeIds = new Set();

    // Viewport Panning state (Right-Click Drag)
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.rightClickStartPos = { x: 0, y: 0 };
    this.rightClickMoved = false;
    
    // Multi-Node Dragging state (Left-Click on Nodes)
    this.isDraggingNodes = false;
    this.hasActuallyDraggedNodes = false;
    this.dragStartMouse = { x: 0, y: 0 };
    this.dragInitialPositions = new Map(); // nodeId -> { x, y }

    // Box Selection (Marquee / คลุมดำ) state (Left-Click Drag on background)
    this.isBoxSelecting = false;
    this.selectionStart = { x: 0, y: 0 };
    this.selectionBoxEl = null;

    // Wire connection drawing state
    this.draftWire = null; // { fromNodeId, fromPort, x1, y1, x2, y2 }

    // Spotlight Catalog state
    this.catalogPendingPos = null;

    // Real-time Energy Pulses persistence
    const savedLiveFlow = localStorage.getItem('canvas_live_flow_enabled');
    this.liveFlowEnabled = savedLiveFlow !== null ? savedLiveFlow === 'true' : true;

    this.setupDOM();
    this.updateLiveFlowButtonUI();
    this.bindEvents();
    this.connectRealtimeSignalStream();
  }

  getNodeTypeLabel(type) {
    const isEn = window.currentLang === 'en';
    const map = {
      trigger: canvasT('canvas_trigger', isEn ? 'Global Trigger' : 'ทริกเกอร์ (Trigger)'),
      emit_event: canvasT('canvas_emit_event', isEn ? 'Broadcast Event' : 'กระจายสัญญาณ (Event)'),
      loop: canvasT('canvas_loop', isEn ? 'Repeat Loop' : 'ลูปซ้ำ (Loop)'),
      buff_sequence: canvasT('canvas_buff_sequence', isEn ? 'Buff Sequence' : 'บัฟสกิล (Buff)'),
      key_press: canvasT('canvas_key_press', isEn ? 'Key Press' : 'กดปุ่ม (Key)'),
      forwarder: canvasT('canvas_forwarder', isEn ? 'Key Forwarder' : 'ส่งต่อปุ่ม (Forward)'),
      macro_group: canvasT('canvas_macro_group', isEn ? 'Macro Queue' : 'มาโคร (Macro)'),
      branch: canvasT('canvas_branch', isEn ? 'Branch (If/Else)' : 'เงื่อนไข (Branch)'),
      condition: canvasT('canvas_condition', isEn ? 'Branch (If/Else)' : 'เงื่อนไข (Branch)'),
      control: canvasT('canvas_control', isEn ? 'Action Control' : 'ควบคุม (Control)'),
      delay: canvasT('canvas_delay', isEn ? 'Delay Timer' : 'หน่วงเวลา (Delay)'),
      emergency_stop: canvasT('canvas_emergency_stop', isEn ? 'Emergency Stop' : 'หยุดฉุกเฉิน (Stop All)'),
      sound: canvasT('canvas_sound', isEn ? 'Sound Alert' : 'เสียงแจ้งเตือน (Sound)'),
      key_hold: canvasT('canvas_key_hold', isEn ? 'Key Hold' : 'กดค้าง (Hold)'),
      sequencer: canvasT('canvas_sequencer', isEn ? 'Cast Sequencer' : 'จัดคิวสกิล (Sequencer)'),
      loop_scheduler: canvasT('canvas_loop_scheduler', isEn ? 'Loop Scheduler' : 'ตารางลูปกันชน (Scheduler)')
    };
    return map[type] || canvasT(`canvas_${type}`, (type || '').toUpperCase());
  }

  setupDOM() {
    this.container.innerHTML = `
      <div class="canvas-viewport" id="canvas-viewport">
        <div class="canvas-transform-layer" id="canvas-transform-layer">
          <svg class="canvas-svg-layer" id="canvas-svg-wires"></svg>
          <div id="canvas-nodes-layer"></div>
        </div>
      </div>

      <!-- Action Outliner & Edit History Side Drawer -->
      <div class="node-outliner-panel" id="node-outliner-panel">
        <div class="outliner-header">
          <div class="panel-tab-bar">
            <button class="panel-tab-btn active" id="tab-btn-outliner" onclick="window.nodeCanvas.switchDrawerTab('outliner')">📑 <span id="lbl-drawer-tab-outliner">${window.currentLang === 'en' ? 'Actions' : 'รายการคำสั่ง'}</span> (<span id="outliner-node-count">0</span>)</button>
            <button class="panel-tab-btn" id="tab-btn-history" onclick="window.nodeCanvas.switchDrawerTab('history')">🕒 <span id="lbl-drawer-tab-history">${window.currentLang === 'en' ? 'History' : 'ประวัติแก้ไข'}</span> (<span id="history-entry-count">0</span>)</button>
          </div>
          <button class="outliner-close-btn" onclick="window.nodeCanvas.togglePanel(null, false)">✕</button>
        </div>

        <!-- Tab 1: Outliner Body -->
        <div id="drawer-outliner-body" style="display:flex; flex-direction:column; flex:1; overflow:hidden;">
          <div class="outliner-search-box">
            <input type="text" class="outliner-search-input" id="outliner-search-input" placeholder="🔍 ค้นหา Action, Key, Type..." oninput="window.nodeCanvas.filterOutliner(this.value)" />
          </div>
          <div class="outliner-list" id="outliner-node-list"></div>
        </div>

        <!-- Tab 2: History Timeline Body -->
        <div id="drawer-history-body" style="display:none; flex-direction:column; flex:1; overflow:hidden;">
          <div style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); display:flex; align-items:center; justify-content:space-between;">
            <span id="lbl-history-hint" style="font-size:11px; color:var(--muted); font-weight:600;">คลิกรายการเพื่อย้อนเวลา (Restore)</span>
            <button onclick="window.nodeCanvas.clearHistory()" id="btn-clear-history" style="background:transparent; border:none; color:var(--muted); font-size:11px; cursor:pointer; padding:2px 4px;" title="ล้างประวัติ">🗑️ ล้าง</button>
          </div>
          <div class="history-timeline-list" id="history-timeline-list"></div>
        </div>
      </div>

      <!-- Canvas Floating Toolbar -->
      <div class="canvas-toolbar">
        <button class="canvas-tool-btn" id="btn-toggle-outliner" onclick="window.nodeCanvas.togglePanel('outliner')" title="Action Outliner (Ctrl+O)" style="font-weight:700;">📑</button>
        <button class="canvas-tool-btn" id="btn-toggle-history" onclick="window.nodeCanvas.togglePanel('history')" title="Edit History (Ctrl+H)" style="font-weight:700;">🕒</button>
        <div style="width:1px; height:20px; background:rgba(255,255,255,0.15); margin:0 4px;"></div>
        <button class="canvas-tool-btn" id="btn-canvas-undo" onclick="if(window.triggerUndo) window.triggerUndo()" title="Undo (Ctrl+Z)" disabled>↩️</button>
        <button class="canvas-tool-btn" id="btn-canvas-redo" onclick="if(window.triggerRedo) window.triggerRedo()" title="Redo (Ctrl+Y)" disabled>↪️</button>
        <div style="width:1px; height:20px; background:rgba(255,255,255,0.15); margin:0 4px;"></div>
        <button class="canvas-tool-btn" id="btn-zoom-in" title="Zoom In">+</button>
        <div class="zoom-level-indicator" id="zoom-indicator">100%</div>
        <button class="canvas-tool-btn" id="btn-zoom-out" title="Zoom Out">-</button>
        <button class="canvas-tool-btn" id="btn-reset-view" title="Reset View">1:1</button>
        <button class="canvas-tool-btn active" id="btn-toggle-live-flow" onclick="window.nodeCanvas.toggleLiveFlow()" title="Toggle Real-time Energy Pulses" style="background:rgba(56,189,248,0.2); border-color:#38bdf8; color:#38bdf8;">✨</button>
        <div style="width:1px; height:20px; background:rgba(255,255,255,0.15); margin:0 4px;"></div>
        <button class="canvas-tool-btn" id="btn-canvas-save" onclick="if(window.onManualSaveProfile) window.onManualSaveProfile()" title="Save Profile (Ctrl+S)" style="background:rgba(37,99,235,0.25); border-color:#3b82f6; color:#60a5fa;">💾</button>
        <button class="canvas-tool-btn" id="btn-canvas-fullscreen" onclick="if(window.toggleCanvasFullscreen) window.toggleCanvasFullscreen()" title="Fullscreen Mode">⛶</button>
      </div>

      <!-- Modern Compact Node Palette Floating Dock -->
      <div class="node-palette-bar compact-palette-dock" id="node-palette-bar">
        <button type="button" class="palette-main-add-btn" id="btn-palette-main-add" onclick="window.nodeCanvas.toggleNodeCatalog(this)">
          <span id="lbl-palette-add-btn">${canvasT('palette_add_node', '➕ Add Node')}</span>
        </button>
        <div class="palette-dock-divider"></div>
        <div class="palette-quick-group">
          <button type="button" class="palette-quick-btn" id="quick-btn-trigger" onclick="window.nodeCanvas.addNodeFromPalette('trigger')" title="${canvasT('palette_quick_trigger', 'Global Trigger')}">⚡</button>
          <button type="button" class="palette-quick-btn" id="quick-btn-loop" onclick="window.nodeCanvas.addNodeFromPalette('loop')" title="${canvasT('palette_quick_loop', 'Repeat Loop')}">🔄</button>
          <button type="button" class="palette-quick-btn" id="quick-btn-buff" onclick="window.nodeCanvas.addNodeFromPalette('buff_sequence')" title="${canvasT('palette_quick_buff', 'Buff Sequence')}">🛡️</button>
          <button type="button" class="palette-quick-btn" id="quick-btn-key" onclick="window.nodeCanvas.addNodeFromPalette('key_press')" title="${canvasT('palette_quick_key', 'Single Key')}">⌨️</button>
        </div>
      </div>

      <!-- Spotlight Blueprint Node Search Popover Modal -->
      <div class="node-spotlight-catalog" id="node-spotlight-catalog" style="display:none;">
        <div class="spotlight-search-header">
          <span class="spotlight-search-icon">🔍</span>
          <input type="text" class="spotlight-search-input" id="spotlight-search-input" placeholder="${canvasT('palette_search_placeholder', 'Search node or action...')}" oninput="window.nodeCanvas.filterSpotlight(this.value)" />
          <button type="button" class="spotlight-close-btn" onclick="window.nodeCanvas.hideNodeCatalog()">✕</button>
        </div>
        <div class="spotlight-catalog-body" id="spotlight-catalog-body"></div>
      </div>

      <!-- Node Config Inspector Side Drawer -->
      <div class="node-inspector-panel" id="node-inspector-panel">
        <div class="inspector-header">
          <div class="inspector-title" id="inspector-node-title">⚙️ ${canvasT('inspector_title', 'Node Inspector')}</div>
          <button class="inspector-close-btn" onclick="window.nodeCanvas.closeInspector()">✕</button>
        </div>
        <div class="inspector-body" id="inspector-form-body">
          <div style="color:var(--muted); font-size:12px; text-align:center; padding:20px 0;">
            ${window.currentLang === 'en' ? 'Select a node on the canvas to configure parameters.' : 'เลือก Node บน Canvas เพื่อแก้ไขค่าและคุณสมบัติ'}
          </div>
        </div>
      </div>

      <!-- Floating Port Context Menu (Break Links on Pin) -->
      <div class="port-context-menu" id="port-context-menu" style="display:none;"></div>
    `;

    this.viewport = this.container.querySelector('#canvas-viewport');
    this.transformLayer = this.container.querySelector('#canvas-transform-layer');
    this.svgLayer = this.container.querySelector('#canvas-svg-wires');
    this.nodesLayer = this.container.querySelector('#canvas-nodes-layer');
    this.zoomIndicator = this.container.querySelector('#zoom-indicator');
    this.inspectorPanel = this.container.querySelector('#node-inspector-panel');
    this.outlinerPanel = this.container.querySelector('#node-outliner-panel');
    this.outlinerSearchInput = this.container.querySelector('#outliner-search-input');
    this.outlinerNodeList = this.container.querySelector('#outliner-node-list');
    this.outlinerNodeCount = this.container.querySelector('#outliner-node-count');
    this.tabBtnOutliner = this.container.querySelector('#tab-btn-outliner');
    this.tabBtnHistory = this.container.querySelector('#tab-btn-history');
    this.drawerOutlinerBody = this.container.querySelector('#drawer-outliner-body');
    this.drawerHistoryBody = this.container.querySelector('#drawer-history-body');
    this.historyTimelineList = this.container.querySelector('#history-timeline-list');
    this.historyEntryCount = this.container.querySelector('#history-entry-count');
    this.portContextMenu = this.container.querySelector('#port-context-menu');
    this.spotlightCatalog = this.container.querySelector('#node-spotlight-catalog');
    this.spotlightInput = this.container.querySelector('#spotlight-search-input');
    this.spotlightBody = this.container.querySelector('#spotlight-catalog-body');
  }

  bindEvents() {
    // Zoom events
    this.container.querySelector('#btn-zoom-in').onclick = () => this.setZoom(this.zoom + 0.15);
    this.container.querySelector('#btn-zoom-out').onclick = () => this.setZoom(this.zoom - 0.15);
    this.container.querySelector('#btn-reset-view').onclick = () => {
      this.zoom = 1.0;
      this.pan = { x: 0, y: 0 };
      this.updateTransform();
    };

    // Mouse Wheel Zoom
    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      this.setZoom(this.zoom * zoomFactor);
    }, { passive: false });

    // Prevent default browser context menu on canvas viewport
    this.viewport.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Close Spotlight Catalog when clicking outside
    document.addEventListener('mousedown', (e) => {
      if (this.spotlightCatalog && this.spotlightCatalog.style.display !== 'none') {
        const isClickInside = this.spotlightCatalog.contains(e.target) || (this.paletteBar && this.paletteBar.contains(e.target));
        if (!isClickInside) {
          this.hideNodeCatalog();
        }
      }
    });

    // Mousedown on Viewport (Right-click = Pan/Drag Canvas or Trigger Menu on release, Left-click on background = Marquee Box Selection / คลุมดำ)
    this.viewport.addEventListener('mousedown', (e) => {
      this.hidePortContextMenu();
      const isBackground = e.target === this.viewport || e.target === this.svgLayer || e.target.classList.contains('canvas-transform-layer');

      // Right-Click: Track initial position for Pan / Menu Detection
      if (e.button === 2) {
        e.preventDefault();
        this.isPanning = true;
        this.rightClickStartPos = { x: e.clientX, y: e.clientY };
        this.rightClickMoved = false;
        this.viewport.classList.add('panning');
        this.panStart = { x: e.clientX - this.pan.x, y: e.clientY - this.pan.y };
        return;
      }

      // Left-Click on background: Marquee Box Selection (คลิกซ้าย บนพื้นที่ว่าง เป็นคลุมดำ)
      if (e.button === 0 && isBackground) {
        this.hideNodeCatalog();
        this.isBoxSelecting = true;
        this.selectionStart = this.clientToWorld(e.clientX, e.clientY);

        if (!e.shiftKey && !e.ctrlKey) {
          this.selectedNodeIds.clear();
        }

        // Create selection box element
        if (this.selectionBoxEl) this.selectionBoxEl.remove();
        this.selectionBoxEl = document.createElement('div');
        this.selectionBoxEl.className = 'canvas-selection-box';
        this.selectionBoxEl.style.left = `${this.selectionStart.x}px`;
        this.selectionBoxEl.style.top = `${this.selectionStart.y}px`;
        this.selectionBoxEl.style.width = '0px';
        this.selectionBoxEl.style.height = '0px';
        this.transformLayer.appendChild(this.selectionBoxEl);
      }
    });

    // Global Mousemove (Handles Panning via Right-Click, Multi-Node Dragging, Box Selection / คลุมดำ, and Wire Drafting)
    window.addEventListener('mousemove', (e) => {
      const worldPos = this.clientToWorld(e.clientX, e.clientY);

      // 1. Box Selection / คลุมดำ (Left-Click Drag on background)
      if (this.isBoxSelecting && this.selectionBoxEl) {
        const minX = Math.min(this.selectionStart.x, worldPos.x);
        const maxX = Math.max(this.selectionStart.x, worldPos.x);
        const minY = Math.min(this.selectionStart.y, worldPos.y);
        const maxY = Math.max(this.selectionStart.y, worldPos.y);

        this.selectionBoxEl.style.left = `${minX}px`;
        this.selectionBoxEl.style.top = `${minY}px`;
        this.selectionBoxEl.style.width = `${maxX - minX}px`;
        this.selectionBoxEl.style.height = `${maxY - minY}px`;

        // Check intersection for all nodes
        this.nodes.forEach(node => {
          const nx1 = node.position.x;
          const nx2 = node.position.x + 220;
          const ny1 = node.position.y;
          const ny2 = node.position.y + 120;

          const isIntersecting = nx1 < maxX && nx2 > minX && ny1 < maxY && ny2 > minY;
          if (isIntersecting) {
            this.selectedNodeIds.add(node.id);
          } else if (!e.shiftKey && !e.ctrlKey) {
            this.selectedNodeIds.delete(node.id);
          }
        });

        this.updateNodeSelectionClasses();
        return;
      }

      // 2. Viewport Panning (Right-Click Drag)
      if (this.isPanning) {
        if (!this.rightClickMoved && this.rightClickStartPos) {
          const dist = Math.hypot(e.clientX - this.rightClickStartPos.x, e.clientY - this.rightClickStartPos.y);
          if (dist > 5) {
            this.rightClickMoved = true;
          }
        }
        this.pan = { x: e.clientX - this.panStart.x, y: e.clientY - this.panStart.y };
        this.updateTransform();
        return;
      }

      // 3. Multi-Node Dragging (Moves all selected nodes smoothly without DOM re-creation)
      if (this.isDraggingNodes && this.selectedNodeIds.size > 0) {
        const dx = worldPos.x - this.dragStartMouse.x;
        const dy = worldPos.y - this.dragStartMouse.y;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          this.hasActuallyDraggedNodes = true;
        }

        if (this.hasActuallyDraggedNodes) {
          this.selectedNodeIds.forEach(nodeId => {
            const node = this.nodes.find(n => n.id === nodeId);
            const initial = this.dragInitialPositions.get(nodeId);
            if (node && initial) {
              node.position.x = Math.max(20, Math.round((initial.x + dx) / 10) * 10);
              node.position.y = Math.max(20, Math.round((initial.y + dy) / 10) * 10);

              // Update DOM element directly in-place to avoid re-triggering bubble animations & flickering
              const nodeEl = this.nodesLayer.querySelector(`.canvas-node[data-id="${nodeId}"]`);
              if (nodeEl) {
                nodeEl.style.left = `${node.position.x}px`;
                nodeEl.style.top = `${node.position.y}px`;
              }
            }
          });

          this.renderWires();
        }
        return;
      }

      // 4. Wire Drafting
      if (this.draftWire) {
        this.draftWire.x2 = worldPos.x;
        this.draftWire.y2 = worldPos.y;
        this.renderWires();
      }
    });

    // Global Mouseup
    window.addEventListener('mouseup', (e) => {
      // Finalize Box Selection (คลุมดำ)
      if (this.isBoxSelecting) {
        this.isBoxSelecting = false;
        if (this.selectionBoxEl) {
          this.selectionBoxEl.remove();
          this.selectionBoxEl = null;
        }

        if (this.selectedNodeIds.size === 1) {
          const singleId = Array.from(this.selectedNodeIds)[0];
          this.openInspector(singleId);
        } else if (this.selectedNodeIds.size > 1) {
          this.openMultiSelectInspector();
        } else {
          this.closeInspector();
        }
      }

      // Finalize Panning & Right-Click Detection
      if (e.button === 2) {
        if (this.isPanning) {
          this.isPanning = false;
          this.viewport.classList.remove('panning');
        }
        // If user right-clicked without dragging on empty canvas space => open node catalog!
        if (!this.rightClickMoved) {
          const isBg = e.target === this.viewport || e.target === this.svgLayer || e.target.classList.contains('canvas-transform-layer') || e.target.id === 'canvas-nodes-layer';
          if (isBg) {
            const worldPos = this.clientToWorld(e.clientX, e.clientY);
            this.showNodeCatalog(e.clientX, e.clientY, worldPos);
          }
        }
      } else if (this.isPanning) {
        this.isPanning = false;
        this.viewport.classList.remove('panning');
      }

      // Finalize Multi-Node Dragging
      if (this.isDraggingNodes) {
        this.isDraggingNodes = false;
        const didMove = this.hasActuallyDraggedNodes;
        this.hasActuallyDraggedNodes = false;
        this.dragInitialPositions.clear();
        if (didMove) {
          this.renderWires();
          this.onProfileChanged();
        }
      }

      // Finalize Wire Drafting
      if (this.draftWire) {
        this.draftWire = null;
        this.renderWires();
      }
    });

    // Delete or Backspace key to delete all selected nodes
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
      if (isInput) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedNodeIds.size > 0) {
        e.preventDefault();
        this.deleteSelectedNodes();
      }

      // Duplicate selected nodes: Shift+D or Ctrl+D
      if (((e.shiftKey && (e.key === 'D' || e.key === 'd')) || ((e.ctrlKey || e.metaKey) && (e.key === 'D' || e.key === 'd'))) && this.selectedNodeIds.size > 0) {
        e.preventDefault();
        this.duplicateSelectedNodes();
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.togglePanel('outliner');
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        this.togglePanel('history');
      }
    });
  }

  loadProfile(profile) {
    if (!profile) return;
    this.closeInspector();
    if (this.outlinerPanel) this.outlinerPanel.classList.remove('open');
    this.hideNodeCatalog();
    this.hidePortContextMenu();
    this.historyTimeline = [];

    this.nodes = Array.isArray(profile.nodes) ? JSON.parse(JSON.stringify(profile.nodes)) : [];
    this.connections = Array.isArray(profile.connections) ? JSON.parse(JSON.stringify(profile.connections)) : [];
    if (profile.canvas) {
      this.zoom = profile.canvas.zoom || 1.0;
      this.pan = profile.canvas.pan || { x: 0, y: 0 };
    }

    // Clean ghost chaining from node data based on real visual connections
    this.nodes.forEach(node => {
      if (node.data && node.data.chaining) {
        const outgoingConns = this.connections.filter(c => c.fromNodeId === node.id);
        if (outgoingConns.length === 0) {
          node.data.chaining = {
            _enabled: false,
            onBeforeStart: [],
            onAfterStart: [],
            onEachCycle: [],
            onStop: [],
            onComplete: []
          };
        }
      }
    });

    this.selectedNodeIds.clear();
    this.updateTransform();
    this.render();
    this.updateLiveFlowButtonUI();
    this.addHistory('📂', `เปิดโปรไฟล์ "${profile.name || 'Default'}"`);
  }

  setZoom(val) {
    this.zoom = Math.min(Math.max(0.4, val), 2.0);
    this.zoomIndicator.textContent = `${Math.round(this.zoom * 100)}%`;
    this.updateTransform();
  }

  updateTransform() {
    this.transformLayer.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
    this.zoomIndicator.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  clientToWorld(clientX, clientY) {
    const rect = this.viewport ? this.viewport.getBoundingClientRect() : { left: 0, top: 0 };
    return {
      x: (clientX - rect.left - this.pan.x) / this.zoom,
      y: (clientY - rect.top - this.pan.y) / this.zoom
    };
  }

  render() {
    this.renderNodes();
    this.renderWires();
    this.renderOutliner();
  }

  updateNodeSelectionClasses() {
    const nodeEls = this.nodesLayer.querySelectorAll('.canvas-node');
    nodeEls.forEach(el => {
      const id = el.dataset.id;
      if (this.selectedNodeIds.has(id)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
    this.renderOutliner();
  }

  renderNodes() {
    this.nodesLayer.innerHTML = '';
    this.nodes.forEach(node => {
      const nodeEl = document.createElement('div');
      const isSelected = this.selectedNodeIds.has(node.id);
      nodeEl.className = `canvas-node ${isSelected ? 'selected' : ''}`;
      nodeEl.style.left = `${node.position.x}px`;
      nodeEl.style.top = `${node.position.y}px`;
      nodeEl.dataset.id = node.id;
      nodeEl.dataset.type = node.type;

      const iconMap = {
        trigger: '⚡',
        loop: '🔄',
        buff_sequence: '🛡️',
        key_press: '⌨️',
        delay: '⏱️',
        branch: '🌿',
        condition: '🌿',
        control: '🎛️',
        forwarder: '🔗',
        macro_group: '🔀',
        emergency_stop: '🛑',
        sound: '🔊',
        emit_event: '📡',
        sequencer: '⚔️',
        loop_scheduler: '⏱️'
      };

      const icon = iconMap[node.type] || '📦';

      let bodyHTML = '';
      if (node.type === 'trigger') {
        const isEventTrigger = node.data?.triggerType === 'event';
        bodyHTML = `
          <div class="node-info-row">
            <span>Type:</span> <span class="node-info-value" style="${isEventTrigger ? 'color:#06b6d4; font-weight:700;' : ''}">${isEventTrigger ? 'Custom Event' : (node.data?.triggerType || 'keyboard')}</span>
          </div>
          <div class="node-info-row">
            <span>${isEventTrigger ? 'Event:' : 'Key/Val:'}</span> <span class="node-info-value" style="${isEventTrigger ? 'color:#06b6d4; font-weight:700;' : ''}">${node.data?.triggerValue || '-'}</span>
          </div>
        `;
      } else if (node.type === 'emit_event') {
        bodyHTML = `
          <div class="node-info-row">
            <span>Event:</span> <span class="node-info-value" style="color:#06b6d4; font-weight:700;">${node.data?.eventName || '-'}</span>
          </div>
          <div class="node-info-row">
            <span>Scope:</span> <span class="node-info-value">Active Profiles</span>
          </div>
        `;
      } else if (node.type === 'loop_scheduler') {
        const items = Array.isArray(node.data?.items) ? node.data.items : [];
        const guard = node.data?.collisionGuardMs !== undefined ? node.data.collisionGuardMs : 800;
        bodyHTML = `
          <div class="node-info-row">
            <span>Target:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
          <div class="node-info-row">
            <span>Guard:</span> <span class="node-info-value" style="color:#10b981; font-weight:700;">${guard}ms</span>
          </div>
          <div class="node-info-row">
            <span>Timers:</span> <span class="node-info-value" style="color:#38bdf8; font-weight:700;">${items.length} items</span>
          </div>
        `;
      } else if (node.type === 'loop') {
        let cdBadgeHTML = '';
        if (node.data?.cooldownPresetId) {
          const cdPreset = node.data.cooldownPresetId;
          const customCd = node.data.customCooldownMs;
          const presetsById = window.allCooldownPresetsById || {};
          let cdLabel = 'Custom CD';
          if (cdPreset === 'custom') {
            cdLabel = customCd ? `${customCd / 1000}s` : 'Custom';
          } else if (presetsById[cdPreset]) {
            const eff = customCd > 0 ? customCd : (presetsById[cdPreset].cooldownMs || 0);
            cdLabel = `${presetsById[cdPreset].name} (${eff / 1000}s)`;
          }
          cdBadgeHTML = `
            <div class="node-info-row" style="color:#10b981; font-weight:700;">
              <span>🛡️ Guard:</span> <span class="node-info-value" style="color:#10b981; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${cdLabel}">${cdLabel}</span>
            </div>
          `;
        }
        bodyHTML = `
          <div class="node-info-row">
            <span>Target:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
          <div class="node-info-row">
            <span>Interval:</span> <span class="node-info-value">${node.data?.interval || 1000}ms</span>
          </div>
          ${cdBadgeHTML}
        `;
      } else if (node.type === 'buff_sequence') {
        let cdBadgeHTML = '';
        if (node.data?.cooldownPresetId) {
          const cdPreset = node.data.cooldownPresetId;
          const customCd = node.data.customCooldownMs;
          const presetsById = window.allCooldownPresetsById || {};
          let cdLabel = 'Custom CD';
          if (cdPreset === 'custom') {
            cdLabel = customCd ? `${customCd / 1000}s` : 'Custom';
          } else if (presetsById[cdPreset]) {
            const eff = customCd > 0 ? customCd : (presetsById[cdPreset].cooldownMs || 0);
            cdLabel = `${presetsById[cdPreset].name} (${eff / 1000}s)`;
          }
          cdBadgeHTML = `
            <div class="node-info-row" style="color:#10b981; font-weight:700;">
              <span>🛡️ Guard:</span> <span class="node-info-value" style="color:#10b981; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${cdLabel}">${cdLabel}</span>
            </div>
          `;
        }
        bodyHTML = `
          <div class="node-info-row">
            <span>Target:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
          <div class="node-info-row">
            <span>Delay:</span> <span class="node-info-value">${node.data?.delayBuff || 800}ms</span>
          </div>
          ${cdBadgeHTML}
        `;
      } else if (node.type === 'key_press') {
        let cdBadgeHTML = '';
        if (node.data?.cooldownPresetId) {
          const cdPreset = node.data.cooldownPresetId;
          const customCd = node.data.customCooldownMs;
          const presetsById = window.allCooldownPresetsById || {};
          let cdLabel = 'Custom CD';
          if (cdPreset === 'custom') {
            cdLabel = customCd ? `${customCd / 1000}s` : 'Custom';
          } else if (presetsById[cdPreset]) {
            const eff = customCd > 0 ? customCd : (presetsById[cdPreset].cooldownMs || 0);
            cdLabel = `${presetsById[cdPreset].name} (${eff / 1000}s)`;
          }
          cdBadgeHTML = `
            <div class="node-info-row" style="color:#10b981; font-weight:700;">
              <span>🛡️ Guard:</span> <span class="node-info-value" style="color:#10b981; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${cdLabel}">${cdLabel}</span>
            </div>
          `;
        }
        bodyHTML = `
          <div class="node-info-row">
            <span>Target:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
          <div class="node-info-row">
            <span>Key:</span> <span class="node-info-value">${(node.data?.keys || []).join(', ') || node.data?.targetKey || '-'}</span>
          </div>
          ${cdBadgeHTML}
        `;
      } else if (node.type === 'key_hold') {
        let cdBadgeHTML = '';
        if (node.data?.cooldownPresetId) {
          const cdPreset = node.data.cooldownPresetId;
          const customCd = node.data.customCooldownMs;
          const presetsById = window.allCooldownPresetsById || {};
          let cdLabel = 'Custom CD';
          if (cdPreset === 'custom') {
            cdLabel = customCd ? `${customCd / 1000}s` : 'Custom';
          } else if (presetsById[cdPreset]) {
            const eff = customCd > 0 ? customCd : (presetsById[cdPreset].cooldownMs || 0);
            cdLabel = `${presetsById[cdPreset].name} (${eff / 1000}s)`;
          }
          cdBadgeHTML = `
            <div class="node-info-row" style="color:#10b981; font-weight:700;">
              <span>🛡️ Guard:</span> <span class="node-info-value" style="color:#10b981; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${cdLabel}">${cdLabel}</span>
            </div>
          `;
        }
        bodyHTML = `
          <div class="node-info-row">
            <span>Target:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
          <div class="node-info-row">
            <span>Hold Key:</span> <span class="node-info-value" style="color:#ef4444; font-weight:700;">${node.data?.targetKey || (node.data?.keys || [])[0] || '1'}</span>
          </div>
          ${cdBadgeHTML}
        `;
      } else if (node.type === 'delay') {
        const dMs = node.data?.delayMs !== undefined ? node.data?.delayMs : (node.data?.interval || 1000);
        bodyHTML = `
          <div class="node-info-row">
            <span>Duration:</span> <span class="node-info-value">${dMs}ms</span>
          </div>
          <div class="node-info-row">
            <span>Type:</span> <span class="node-info-value">Delay Timer</span>
          </div>
        `;
      } else if (node.type === 'branch' || node.type === 'condition') {
        const targetAction = this.nodes.find(n => n.id === node.data?.conditionTargetId);
        const targetName = targetAction ? (targetAction.title || targetAction.type) : (node.data?.conditionTargetId ? 'Action' : '(None)');
        const rule = node.data?.conditionRule || 'is_running';
        const ruleMap = {
          is_running: '🟢 Running',
          is_stopped: '🔴 Stopped',
          on_cooldown: '⏳ Cooldown',
          is_ready: '🛡️ Ready'
        };
        const ruleLabel = ruleMap[rule] || '🟢 Running';
        bodyHTML = `
          <div class="node-info-row">
            <span>Target:</span> <span class="node-info-value" style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${targetName}">${targetName}</span>
          </div>
          <div class="node-info-row">
            <span>Rule:</span> <span class="node-info-value">${ruleLabel}</span>
          </div>
        `;
      } else if (node.type === 'control') {
        bodyHTML = `
          <div class="node-info-row">
            <span>Action:</span> <span class="node-info-value">${(node.data?.controlOperation || 'toggle').toUpperCase()}</span>
          </div>
          <div class="node-info-row">
            <span>Target:</span> <span class="node-info-value">${(node.data?.controlTargetIds || []).length > 0 ? `${node.data.controlTargetIds.length} actions` : 'All'}</span>
          </div>
        `;
      } else if (node.type === 'forwarder') {
        let cdBadgeHTML = '';
        if (node.data?.cooldownPresetId) {
          const cdPreset = node.data.cooldownPresetId;
          const customCd = node.data.customCooldownMs;
          const presetsById = window.allCooldownPresetsById || {};
          let cdLabel = 'Custom CD';
          if (cdPreset === 'custom') {
            cdLabel = customCd ? `${customCd / 1000}s` : 'Custom';
          } else if (presetsById[cdPreset]) {
            const eff = customCd > 0 ? customCd : (presetsById[cdPreset].cooldownMs || 0);
            cdLabel = `${presetsById[cdPreset].name} (${eff / 1000}s)`;
          }
          cdBadgeHTML = `
            <div class="node-info-row" style="color:#10b981; font-weight:700;">
              <span>🛡️ Guard:</span> <span class="node-info-value" style="color:#10b981; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${cdLabel}">${cdLabel}</span>
            </div>
          `;
        }
        bodyHTML = `
          <div class="node-info-row">
            <span>Forward:</span> <span class="node-info-value">${node.data?.targetKey || (node.data?.keys || [])[0] || 'Key'}</span>
          </div>
          <div class="node-info-row">
            <span>To:</span> <span class="node-info-value">Client ${node.data?.targetClient || 'All'}</span>
          </div>
          ${cdBadgeHTML}
        `;
      } else if (node.type === 'macro_group') {
        const steps = node.data?.steps || [];
        const totalDelay = steps.reduce((acc, s) => acc + (s.delay || 0), 0);
        bodyHTML = `
          <div class="node-info-row">
            <span>Target:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
          <div class="node-info-row">
            <span>Steps:</span> <span class="node-info-value">${steps.length} actions (~${totalDelay}ms)</span>
          </div>
        `;
      } else if (node.type === 'emergency_stop') {
        const scope = node.data?.stopScope || 'all';
        const scopeLabel = scope === 'all' ? 'All Everywhere' : (scope === 'profile' ? 'Current Profile' : `Client ${node.data?.targetClient || '1'}`);
        bodyHTML = `
          <div class="node-info-row">
            <span>Scope:</span> <span class="node-info-value" style="color:#ef4444; font-weight:700;">${scopeLabel}</span>
          </div>
          <div class="node-info-row">
            <span>Type:</span> <span class="node-info-value">Panic Kill-Switch</span>
          </div>
        `;
      } else if (node.type === 'sound') {
        const sSource = node.data?.soundSource || 'preset';
        let soundName = node.data?.soundPreset || 'Ding';
        if (sSource === 'url') soundName = 'Web URL';
        if (sSource === 'upload') soundName = node.data?.soundFile ? 'Custom File' : 'Uploaded';
        bodyHTML = `
          <div class="node-info-row">
            <span>Sound:</span> <span class="node-info-value" style="color:#a855f7; font-weight:700;">${soundName}</span>
          </div>
          <div class="node-info-row">
            <span>Volume:</span> <span class="node-info-value">${node.data?.volume !== undefined ? node.data.volume : 100}%</span>
          </div>
        `;
      } else if (node.type === 'sequencer') {
        const steps = node.data?.steps || [];
        const isLoop = (node.data?.modeType || 'loop') === 'loop';
        const intervalVal = node.data?.interval !== undefined ? node.data.interval : 1000;
        const stepItemsHTML = steps.map((s, idx) => {
          const delayMs = s.delay !== undefined ? s.delay : (s.castTimeMs !== undefined ? s.castTimeMs : 800);
          const tag = delayMs > 0 ? `${delayMs}ms` : 'Instant';
          const tagColor = delayMs > 0 ? '#f59e0b' : '#10b981';
          return `<div style="font-size:10.5px; color:var(--muted); display:flex; justify-content:space-between; align-items:center; margin-top:3px; padding:1px 0; border-bottom:1px solid rgba(255,255,255,0.03);">
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:115px;">${idx + 1}. <strong style="color:var(--text); font-family:'JetBrains Mono';">${s.key || '-'}</strong></span>
            <span style="color:${tagColor}; font-weight:700; font-size:10px; font-family:'JetBrains Mono'; flex-shrink:0;">${tag}</span>
          </div>`;
        }).join('');

        bodyHTML = `
          <div class="node-info-row">
            <span>Target:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
          <div class="node-info-row">
            <span>Mode:</span> <span class="node-info-value" style="color:${isLoop ? '#3b82f6' : '#a855f7'}; font-weight:700;">${isLoop ? `🔄 Loop (~${intervalVal}ms)` : '⚡ Once'}</span>
          </div>
          <div class="node-info-row">
            <span>Steps:</span> <span class="node-info-value" style="color:#f59e0b; font-weight:700;">${steps.length} actions</span>
          </div>
          <div style="background:rgba(0,0,0,0.25); border-radius:6px; padding:4px 8px; margin-top:6px; border:1px solid rgba(255,255,255,0.06); max-height:260px; overflow-y:auto;">
            ${stepItemsHTML || '<div style="font-size:10px; color:var(--muted); text-align:center;">No steps added</div>'}
          </div>
        `;
      } else {
        bodyHTML = `
          <div class="node-info-row">
            <span>Target:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
        `;
      }

      let portsHTML = '';
      let pinsHTML = '';

      if (node.type !== 'trigger') {
        portsHTML += `<div class="node-port port-in" data-node="${node.id}" data-port="exec_in" title="Input (exec_in)"></div>`;
      }

      if (node.type === 'loop') {
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onBeforeStart">${canvasT('port_onBeforeStart', 'onBeforeStart')} ▶</span>
              <div class="node-port port-out port-onBeforeStart" data-node="${node.id}" data-port="onBeforeStart" title="${canvasT('port_onBeforeStart', 'onBeforeStart')}"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onAfterStart">${canvasT('port_onAfterStart', 'onAfterStart')} ▶</span>
              <div class="node-port port-out port-onAfterStart" data-node="${node.id}" data-port="onAfterStart" title="${canvasT('port_onAfterStart', 'onAfterStart')}"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onEachCycle">${canvasT('port_onEachCycle', 'onEachCycle')} ▶</span>
              <div class="node-port port-out port-onEachCycle" data-node="${node.id}" data-port="onEachCycle" title="${canvasT('port_onEachCycle', 'onEachCycle')}"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onStop">${canvasT('port_onStop', 'onStop')} ▶</span>
              <div class="node-port port-out port-onStop" data-node="${node.id}" data-port="onStop" title="${canvasT('port_onStop', 'onStop')}"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'buff_sequence') {
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onBeforeStart">${canvasT('port_onBeforeStart', 'onBeforeStart')} ▶</span>
              <div class="node-port port-out port-onBeforeStart" data-node="${node.id}" data-port="onBeforeStart" title="${canvasT('port_onBeforeStart', 'onBeforeStart')}"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onAfterStart">${canvasT('port_onAfterStart', 'onAfterStart')} ▶</span>
              <div class="node-port port-out port-onAfterStart" data-node="${node.id}" data-port="onAfterStart" title="${canvasT('port_onAfterStart', 'onAfterStart')}"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onComplete">${canvasT('port_onComplete', 'onComplete')} ▶</span>
              <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="onComplete" title="${canvasT('port_onComplete', 'onComplete')}"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'sequencer') {
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onStep">${canvasT('port_onStep', 'onStep')} ▶</span>
              <div class="node-port port-out port-onStep" data-node="${node.id}" data-port="onStep" title="${canvasT('port_onStep', 'onStep')}"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onEachCycle">${canvasT('port_onEachCycle', 'onEachCycle')} ▶</span>
              <div class="node-port port-out port-onEachCycle" data-node="${node.id}" data-port="onEachCycle" title="${canvasT('port_onEachCycle', 'onEachCycle')}"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onStop">${canvasT('port_onStop', 'onStop / onComplete')} ▶</span>
              <div class="node-port port-out port-onStop" data-node="${node.id}" data-port="onStop" title="${canvasT('port_onStop', 'onStop')}"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'loop_scheduler') {
        const items = Array.isArray(node.data?.items) ? node.data.items : [];
        let itemPinsHTML = '';
        items.forEach((it, idx) => {
          const itName = it.name || `Item ${idx + 1}`;
          const itInterval = it.interval || 3000;
          const isEnabled = it.enabled !== false;
          itemPinsHTML += `
            <div class="node-pin-row">
              <span class="node-pin-label" style="color:${isEnabled ? '#60a5fa' : 'var(--muted)'}; opacity:${isEnabled ? '1' : '0.6'}; font-size:10px; font-weight:700;" title="${itName} (${itInterval}ms)">${itName} (${(itInterval / 1000).toFixed(itInterval % 1000 === 0 ? 0 : 1)}s) ▶</span>
              <div class="node-port port-out" style="border-color:#3b82f6; background:#1e3a8a;" data-node="${node.id}" data-port="item_${idx}" title="${itName} ▶"></div>
            </div>
          `;
        });
        pinsHTML = `
          <div class="node-pins-section">
            ${itemPinsHTML}
            <div class="node-pin-row">
              <span class="node-pin-label onStop">${canvasT('port_onStop', 'onStop')} ▶</span>
              <div class="node-port port-out port-onStop" data-node="${node.id}" data-port="onStop" title="${canvasT('port_onStop', 'onStop')}"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'branch' || node.type === 'condition') {
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onTrue">${canvasT('port_onTrue', 'True')} ▶</span>
              <div class="node-port port-out port-onTrue" data-node="${node.id}" data-port="onTrue" title="${canvasT('port_onTrue', 'True')}"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onFalse">${canvasT('port_onFalse', 'False')} ▶</span>
              <div class="node-port port-out port-onFalse" data-node="${node.id}" data-port="onFalse" title="${canvasT('port_onFalse', 'False')}"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'key_hold') {
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onEnable">${canvasT('port_onEnable', 'onEnable')} ▶</span>
              <div class="node-port port-out port-onEnable" data-node="${node.id}" data-port="onEnable" title="${canvasT('port_onEnable', 'onEnable')}"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onDisable">${canvasT('port_onDisable', 'onDisable')} ▶</span>
              <div class="node-port port-out port-onDisable" data-node="${node.id}" data-port="onDisable" title="${canvasT('port_onDisable', 'onDisable')}"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'trigger') {
        portsHTML += `<div class="node-port port-out" data-node="${node.id}" data-port="exec_out" title="Output (exec_out)"></div>`;
      } else {
        portsHTML += `<div class="node-port port-out" data-node="${node.id}" data-port="next" title="Output (next)"></div>`;
      }

      const issue = this.getNodeValidationIssue(node);
      let validationHTML = '';
      if (issue) {
        nodeEl.classList.add(issue.severity === 'error' ? 'has-error' : 'has-warning');
        const bannerText = issue.severity === 'error' ? 'ERROR!' : 'WARNING!';
        const bubbleIcon = issue.severity === 'error' ? '🚫' : '⚠️';
        const msg = (window.currentLang === 'en' ? issue.messageEn : issue.messageTh) || issue.messageTh;
        validationHTML = `
          <div class="node-unreal-footer-banner ${issue.severity}">
            ${bannerText}
          </div>
          <div class="node-unreal-detail-bubble ${issue.severity}">
            <span class="bubble-icon">${bubbleIcon}</span>
            <span class="bubble-text">${msg}</span>
          </div>
        `;
      }

      nodeEl.innerHTML = `
        <div class="node-main-content">
          <div class="node-header">
            <div class="node-title-group">
              <span class="node-icon">${icon}</span>
              <span class="node-title">${node.title || node.type}</span>
            </div>
            <span class="node-type-badge">${this.getNodeTypeLabel(node.type)}</span>
          </div>
          <div class="node-body">
            ${bodyHTML}
          </div>
          ${pinsHTML}
          <div class="node-ports-container">
            ${portsHTML}
          </div>
        </div>
        ${validationHTML}
      `;

      // Left-Click Node Selection & Multi-Node Dragging
      nodeEl.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('node-port')) return;
        if (e.button === 2) return; // Right-click handled by viewport for box selection
        e.stopPropagation();

        const isMulti = e.shiftKey || e.ctrlKey;

        if (isMulti) {
          if (this.selectedNodeIds.has(node.id)) {
            this.selectedNodeIds.delete(node.id);
          } else {
            this.selectedNodeIds.add(node.id);
          }
        } else {
          // If clicked node is not already part of selection, select only this one
          if (!this.selectedNodeIds.has(node.id)) {
            this.selectedNodeIds.clear();
            this.selectedNodeIds.add(node.id);
          }
        }

        this.updateNodeSelectionClasses();

        // Start dragging all selected nodes together
        this.isDraggingNodes = true;
        this.dragStartMouse = this.clientToWorld(e.clientX, e.clientY);

        this.dragInitialPositions.clear();
        this.selectedNodeIds.forEach(id => {
          const targetNode = this.nodes.find(n => n.id === id);
          if (targetNode) {
            this.dragInitialPositions.set(id, { x: targetNode.position.x, y: targetNode.position.y });
          }
        });

        if (this.selectedNodeIds.size === 1) {
          this.openInspector(node.id);
        } else if (this.selectedNodeIds.size > 1) {
          this.openMultiSelectInspector();
        } else {
          this.closeInspector();
        }
      });

      // Bind port wiring drag events
      nodeEl.querySelectorAll('.node-port').forEach(portEl => {
        portEl.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          const pType = portEl.classList.contains('port-in') ? 'in' : 'out';
          const portName = portEl.dataset.port;
          const nodeId = portEl.dataset.node;

          if (pType === 'out' && e.button === 0) {
            const portRect = portEl.getBoundingClientRect();
            const portPos = this.clientToWorld(
              portRect.left + portRect.width / 2,
              portRect.top + portRect.height / 2
            );

            this.draftWire = {
              fromNodeId: nodeId,
              fromPort: portName,
              x1: portPos.x,
              y1: portPos.y,
              x2: portPos.x,
              y2: portPos.y
            };
          }
        });

        portEl.addEventListener('mouseup', (e) => {
          e.stopPropagation();
          if (this.draftWire && portEl.classList.contains('port-in')) {
            const toNodeId = portEl.dataset.node;
            const toPort = portEl.dataset.port;
            if (toNodeId !== this.draftWire.fromNodeId) {
              this.addConnection(this.draftWire.fromNodeId, this.draftWire.fromPort, toNodeId, toPort);
            }
          }
          this.draftWire = null;
          this.renderWires();
        });

        // Right-Click on Port Pin (Unreal Engine Blueprint Break Links Context Menu)
        portEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const pType = portEl.classList.contains('port-in') ? 'in' : 'out';
          const portName = portEl.dataset.port;
          const nodeId = portEl.dataset.node;
          this.showPortContextMenu(e.clientX, e.clientY, nodeId, portName, pType);
        });
      });

      // Ensure release anywhere on a node also dismisses any active draft wire
      nodeEl.addEventListener('mouseup', () => {
        if (this.draftWire) {
          this.draftWire = null;
          this.renderWires();
        }
      });

      this.nodesLayer.appendChild(nodeEl);
    });

    // Auto-update wires on next animation frame after DOM nodes finish layout & reflow
    requestAnimationFrame(() => {
      this.renderWires();
    });
  }

  getPortCenter(nodeId, portName) {
    const nodeEl = this.nodesLayer ? this.nodesLayer.querySelector(`.canvas-node[data-id="${nodeId}"]`) : null;
    if (nodeEl) {
      let portEl = null;
      if (portName) {
        portEl = nodeEl.querySelector(`.node-port[data-port="${portName}"]`);
      }
      if (!portEl) {
        portEl = nodeEl.querySelector('.node-port');
      }

      if (portEl) {
        const portRect = portEl.getBoundingClientRect();
        return this.clientToWorld(
          portRect.left + portRect.width / 2,
          portRect.top + portRect.height / 2
        );
      }
    }

    // Mathematical fallback if DOM element is not rendered yet
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const isOutput = portName !== 'exec_in';
    const x = isOutput ? node.position.x + 221 : node.position.x - 1;
    let y = node.position.y + 38;
    if (portName === 'onBeforeStart') y = node.position.y + 75;
    else if (portName === 'onAfterStart') y = node.position.y + 100;
    else if (portName === 'onEachCycle' || portName === 'on_interval') y = node.position.y + 125;
    else if (portName === 'onStop') y = node.position.y + 150;
    else if (portName === 'onComplete' || portName === 'on_complete') y = node.position.y + 125;
    else if (portName === 'onTrue' || portName === 'on_true') y = node.position.y + 75;
    else if (portName === 'onFalse' || portName === 'on_false') y = node.position.y + 100;

    return { x, y };
  }

  renderWires() {
    let svgContent = `
      <defs>
        <filter id="wire-glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="wire-glow-purple" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="wire-glow-blue" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="wire-glow-green" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="wire-glow-red" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="wire-glow-default" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
    `;

    // Render active connections as clean static wires
    this.connections.forEach(conn => {
      const fromPos = this.getPortCenter(conn.fromNodeId, conn.fromPort);
      const toPos = this.getPortCenter(conn.toNodeId, conn.toPort || 'exec_in');

      const x1 = fromPos.x;
      const y1 = fromPos.y;
      const x2 = toPos.x;
      const y2 = toPos.y;

      const dx = Math.max(30, Math.abs(x2 - x1) * 0.5);
      const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

      svgContent += `
        <g class="wire-group" data-id="${conn.id}">
          <path class="wire-path" d="${pathData}" data-id="${conn.id}" />
        </g>
      `;
    });

    // Render draft wire if currently dragging
    if (this.draftWire) {
      const dx = Math.max(30, Math.abs(this.draftWire.x2 - this.draftWire.x1) * 0.5);
      const pathData = `M ${this.draftWire.x1} ${this.draftWire.y1} C ${this.draftWire.x1 + dx} ${this.draftWire.y1}, ${this.draftWire.x2 - dx} ${this.draftWire.y2}, ${this.draftWire.x2} ${this.draftWire.y2}`;
      svgContent += `<path class="wire-path wire-draft" d="${pathData}" />`;
    }

    this.svgLayer.innerHTML = svgContent;
  }

  firePulseOnWire(conn, colorOverride = null, onCompleteCallback = null) {
    if (!this.svgLayer) return;

    const fromPos = this.getPortCenter(conn.fromNodeId, conn.fromPort);
    const toPos = this.getPortCenter(conn.toNodeId, conn.toPort || 'exec_in');

    const x1 = fromPos.x;
    const y1 = fromPos.y;
    const x2 = toPos.x;
    const y2 = toPos.y;

    const dx = Math.max(30, Math.abs(x2 - x1) * 0.5);
    const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

    // Color mapping by port type or override
    let colorKey = colorOverride || 'default';
    let orbColor = '#38bdf8';

    if (colorOverride === 'red') {
      orbColor = '#f87171';
    } else if (colorOverride === 'blue') {
      orbColor = '#60a5fa';
    } else if (colorOverride === 'green') {
      orbColor = '#34d399';
    } else if (colorOverride === 'cyan') {
      orbColor = '#06b6d4';
    } else if (colorOverride === 'purple') {
      orbColor = '#c084fc';
    } else {
      const pName = conn.fromPort || '';
      if (pName === 'onBeforeStart') {
        colorKey = 'purple';
        orbColor = '#c084fc';
      } else if (pName === 'onAfterStart') {
        colorKey = 'blue';
        orbColor = '#60a5fa';
      } else if (pName === 'onEachCycle' || pName === 'on_interval' || pName === 'onInterval') {
        colorKey = 'cyan';
        orbColor = '#06b6d4';
      } else if (pName === 'onComplete' || pName === 'on_complete' || pName === 'onTrue' || pName === 'on_true') {
        colorKey = 'green';
        orbColor = '#34d399';
      } else if (pName === 'onStop' || pName === 'on_stop' || pName === 'onFalse' || pName === 'on_false') {
        colorKey = 'red';
        orbColor = '#f87171';
      }
    }

    // Create a temporary SVG Path to compute precise coordinate length
    const tempPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempPath.setAttribute('d', pathData);
    const totalLength = tempPath.getTotalLength();
    if (!totalLength || totalLength <= 0) {
      if (onCompleteCallback) onCompleteCallback();
      return;
    }

    // Glowing Trail
    const trailHead = Math.max(25, totalLength * 0.25);
    const trailPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    trailPath.setAttribute('d', pathData);
    trailPath.setAttribute('class', `wire-pulse-trail ${colorKey}`);
    trailPath.style.strokeDasharray = `${trailHead} ${totalLength * 2}`;
    trailPath.style.strokeDashoffset = String(trailHead);

    // Glowing Energy Orb Circle
    const orb = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    orb.setAttribute('r', '6');
    orb.setAttribute('fill', orbColor);
    orb.setAttribute('filter', `url(#wire-glow-${colorKey})`);
    orb.setAttribute('class', 'wire-particle-orb');

    const startPt = tempPath.getPointAtLength(0);
    orb.setAttribute('cx', startPt.x);
    orb.setAttribute('cy', startPt.y);

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'wire-pulse-packet');
    g.appendChild(trailPath);
    g.appendChild(orb);
    this.svgLayer.appendChild(g);

    // Dynamic travel duration with balanced speed scaling for long wires
    const duration = Math.max(320, Math.min(900, totalLength * 0.55));
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Smooth ease-in-out curve
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentLen = Math.min(totalLength, totalLength * eased);
      const pt = tempPath.getPointAtLength(currentLen);
      orb.setAttribute('cx', pt.x);
      orb.setAttribute('cy', pt.y);

      // Dynamic trail attached to orb that scales gracefully to the end
      const trailLen = Math.min(currentLen, Math.max(35, totalLength * 0.22));
      trailPath.style.strokeDasharray = `${trailLen} ${totalLength * 3}`;
      trailPath.style.strokeDashoffset = String(trailLen - currentLen);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Bead precisely at the final point of destination port
        const endPt = tempPath.getPointAtLength(totalLength);
        orb.setAttribute('cx', endPt.x);
        orb.setAttribute('cy', endPt.y);

        // Flash destination node
        if (this.nodesLayer) {
          const targetNodeEl = this.nodesLayer.querySelector(`.canvas-node[data-id="${conn.toNodeId}"]`);
          if (targetNodeEl) {
            targetNodeEl.classList.remove('node-signal-hit');
            void targetNodeEl.offsetWidth;
            targetNodeEl.classList.add('node-signal-hit');
            setTimeout(() => targetNodeEl.classList.remove('node-signal-hit'), 500);
          }
        }

        if (typeof onCompleteCallback === 'function') {
          try { onCompleteCallback(); } catch(e) { console.error(e); }
        }

        // Smooth fade out after landing at the port
        g.style.transition = 'opacity 0.15s ease-out';
        g.style.opacity = '0';
        setTimeout(() => {
          if (g.parentElement) g.remove();
        }, 160);
      }
    };

    requestAnimationFrame(animate);
  }

  connectRealtimeSignalStream() {
    if (typeof EventSource === 'undefined') return;
    if (this.signalEventSource) {
      try { this.signalEventSource.close(); } catch(e) {}
    }

    try {
      this.signalEventSource = new EventSource('/api/signals/stream');
      this.signalEventSource.onmessage = (e) => {
        if (!e.data || e.data.trim() === '') return;
        try {
          const signals = JSON.parse(e.data);
          if (Array.isArray(signals)) {
            signals.forEach(sig => {
              this.handleRealExecutionSignal(sig);
            });
          }
        } catch (err) {
          console.error("Failed to parse execution signal:", err);
        }
      };
    } catch (err) {
      console.warn("Could not connect to SSE signal stream:", err);
    }
  }

  propagateSignalFlow(currentNode, isStarting = true, visited = new Set(), depth = 0) {
    if (!currentNode || depth > 15 || visited.has(currentNode.id)) return;
    visited.add(currentNode.id);

    // If node is Action Control:
    if (currentNode.type === 'control') {
      const targetActionId = currentNode.data?.controlTargetIds?.[0] || currentNode.data?.controlTargetId;
      const isCurrentlyRunning = !!this._actionRunStates[targetActionId || currentNode.id];
      const isStartingNow = !isCurrentlyRunning;
      this._actionRunStates[targetActionId || currentNode.id] = isStartingNow;

      if (isStartingNow) {
        // When STARTING: Propagate along outgoing wires
        const conns = this.connections.filter(c => c.fromNodeId === currentNode.id);
        conns.forEach(conn => {
          this.firePulseOnWire(conn, 'blue', () => {
            const nextNode = this.nodes.find(n => n.id === conn.toNodeId);
            if (nextNode) {
              this.propagateSignalFlow(nextNode, true, new Set(visited), depth + 1);
            }
          });
        });
      } else {
        // When STOPPING: Flow terminates at this Control Node immediately!
        return;
      }
    } else if (currentNode.type === 'branch') {
      // Condition Branch Nodes evaluate True/False in engine:
      // Do NOT auto-fire both wires! Engine will emit onTrue or onFalse.
      return;
    } else {
      // Regular Nodes (Loop, Buff Sequence, Delay, Sound, Key Hold, Trigger, etc.)
      const conns = this.connections.filter(c => c.fromNodeId === currentNode.id && c.fromPort !== 'onStop' && c.fromPort !== 'on_stop' && c.fromPort !== 'onTrue' && c.fromPort !== 'on_true' && c.fromPort !== 'onFalse' && c.fromPort !== 'on_false');
      conns.forEach(conn => {
        this.firePulseOnWire(conn, null, () => {
          const nextNode = this.nodes.find(n => n.id === conn.toNodeId);
          if (nextNode) {
            this.propagateSignalFlow(nextNode, isStarting, new Set(visited), depth + 1);
          }
        });
      });
    }
  }

  handleRealExecutionSignal(sig) {
    if (this.liveFlowEnabled === false) return;
    const actionId = sig.actionId;
    const eventName = sig.eventName;

    // Track active loop states
    if (!this._actionRunStates) this._actionRunStates = {};

    // Find node matching actionId
    const sourceNode = this.nodes.find(n => n.id === actionId || n.data?.actionId === actionId);
    if (!sourceNode) return;

    if (eventName === 'trigger') {
      this.lastTriggerTime = performance.now();
      // Only fire incoming wires from actual Trigger nodes
      const triggerIncomings = this.connections.filter(c => {
        if (c.toNodeId !== sourceNode.id) return false;
        const fromNode = this.nodes.find(n => n.id === c.fromNodeId);
        return fromNode && fromNode.type === 'trigger';
      });

      triggerIncomings.forEach(conn => {
        this.firePulseOnWire(conn, null, () => {
          this.propagateSignalFlow(sourceNode, true, new Set(), 1);
        });
      });
    } else if (eventName === 'onTrue') {
      const trueConns = this.connections.filter(c => c.fromNodeId === sourceNode.id && (c.fromPort === 'onTrue' || c.fromPort === 'on_true'));
      trueConns.forEach(conn => {
        this.firePulseOnWire(conn, 'green', () => {
          const nextNode = this.nodes.find(n => n.id === conn.toNodeId);
          if (nextNode) {
            this.propagateSignalFlow(nextNode, true, new Set(), 1);
          }
        });
      });
    } else if (eventName === 'onFalse') {
      const falseConns = this.connections.filter(c => c.fromNodeId === sourceNode.id && (c.fromPort === 'onFalse' || c.fromPort === 'on_false'));
      falseConns.forEach(conn => {
        this.firePulseOnWire(conn, 'red', () => {
          const nextNode = this.nodes.find(n => n.id === conn.toNodeId);
          if (nextNode) {
            this.propagateSignalFlow(nextNode, true, new Set(), 1);
          }
        });
      });
    } else if (eventName === 'onEachCycle') {
      // Suppress initial double firing during initial trigger cascade
      const timeSinceTrigger = performance.now() - (this.lastTriggerTime || 0);
      if (timeSinceTrigger < 900) {
        return; // Sequenced trigger cascade handles initial cycle cleanly
      }

      // 1. Play momentary pulse flash on the Loop Node card itself
      if (this.nodesLayer) {
        const sourceEl = this.nodesLayer.querySelector(`.canvas-node[data-id="${sourceNode.id}"]`);
        if (sourceEl) {
          sourceEl.classList.remove('node-signal-hit');
          void sourceEl.offsetWidth;
          sourceEl.classList.add('node-signal-hit');
          setTimeout(() => sourceEl.classList.remove('node-signal-hit'), 450);
        }
      }

      // 2. Fire outgoing onEachCycle wires for subsequent regular intervals
      const cycleConns = this.connections.filter(c => c.fromNodeId === sourceNode.id && (c.fromPort === 'onEachCycle' || c.fromPort === 'on_interval'));
      cycleConns.forEach(c => this.firePulseOnWire(c, 'cyan'));
    } else if (eventName === 'onStop') {
      this._actionRunStates[actionId] = false;
      const stopConns = this.connections.filter(c => c.fromNodeId === sourceNode.id && (c.fromPort === 'onStop' || c.fromPort === 'on_stop'));
      stopConns.forEach(c => this.firePulseOnWire(c, 'red'));
    }
  }

  triggerSignalPulse(fromNodeId, fromPort = null) {
    if (this.liveFlowEnabled === false) return;
    const matchingConns = this.connections.filter(c => {
      if (c.fromNodeId !== fromNodeId) return false;
      if (fromPort && c.fromPort && c.fromPort !== fromPort) return false;
      return true;
    });

    matchingConns.forEach(conn => {
      this.firePulseOnWire(conn);
    });
  }

  updateLiveFlowButtonUI() {
    const btn = this.container ? this.container.querySelector('#btn-toggle-live-flow') : document.getElementById('btn-toggle-live-flow');
    if (btn) {
      if (this.liveFlowEnabled) {
        btn.classList.add('active');
        btn.style.setProperty('background', 'rgba(56, 189, 248, 0.25)', 'important');
        btn.style.setProperty('border-color', '#38bdf8', 'important');
        btn.style.setProperty('color', '#38bdf8', 'important');
        btn.style.setProperty('box-shadow', '0 0 10px rgba(56, 189, 248, 0.4)', 'important');
      } else {
        btn.classList.remove('active');
        btn.style.setProperty('background', 'rgba(255, 255, 255, 0.05)', 'important');
        btn.style.setProperty('border-color', 'rgba(255, 255, 255, 0.12)', 'important');
        btn.style.setProperty('color', 'var(--muted)', 'important');
        btn.style.setProperty('box-shadow', 'none', 'important');
      }
    }
  }

  toggleLiveFlow() {
    this.liveFlowEnabled = !this.liveFlowEnabled;
    localStorage.setItem('canvas_live_flow_enabled', String(this.liveFlowEnabled));
    this.updateLiveFlowButtonUI();

    if (this.liveFlowEnabled) {
      if (typeof window.toast === 'function') {
        window.toast(window.currentLang === 'en' ? '⚡ Real-time Energy Pulses ON' : '⚡ เปิดเอฟเฟกต์ลูกแก้วพลังงาน (Live Signal Flow ON)', 'info');
      }
    } else {
      if (typeof window.toast === 'function') {
        window.toast(window.currentLang === 'en' ? '⏸️ Real-time Energy Pulses OFF' : '⏸️ ปิดเอฟเฟกต์ลูกแก้วพลังงาน (Live Signal Flow OFF)', 'info');
      }
    }
  }

  showPortContextMenu(clientX, clientY, nodeId, portName, portType) {
    if (!this.portContextMenu) return;
    const node = this.nodes.find(n => n.id === nodeId);
    const nodeTitle = node ? (node.title || node.type) : nodeId;

    let itemsHTML = '';

    if (portType === 'out') {
      const conns = this.connections.filter(c => c.fromNodeId === nodeId && c.fromPort === portName);
      if (conns.length === 0) {
        this.hidePortContextMenu();
        return;
      }

      itemsHTML += `
        <div class="port-context-header">
          <span>📤 ${nodeTitle}</span>
          <span style="font-family:'JetBrains Mono'; color:#60a5fa;">[${portName}]</span>
        </div>
        <button type="button" class="port-context-item" onclick="window.nodeCanvas.disconnectAllFromPort('${nodeId}', '${portName}')">
          <span>✂️ ตัดสายทั้งหมดออกจาก Pin นี้</span>
          <span style="background:rgba(239,68,68,0.2); padding:1px 6px; border-radius:10px; font-size:10px;">${conns.length}</span>
        </button>
      `;

      if (conns.length > 1) {
        itemsHTML += `<div class="port-context-divider"></div>`;
        conns.forEach(conn => {
          const targetNode = this.nodes.find(n => n.id === conn.toNodeId);
          const targetTitle = targetNode ? (targetNode.title || targetNode.type) : conn.toNodeId;
          itemsHTML += `
            <button type="button" class="port-context-item" style="font-size:11px;" onclick="window.nodeCanvas.deleteConnection('${conn.id}'); window.nodeCanvas.hidePortContextMenu();">
              <span>✂️ ตัดสาย ➔ ${targetTitle}</span>
            </button>
          `;
        });
      }
    } else {
      // Incoming port (port-in)
      const conns = this.connections.filter(c => c.toNodeId === nodeId && (c.toPort === portName || !c.toPort || c.toPort === 'exec_in'));
      if (conns.length === 0) {
        this.hidePortContextMenu();
        return;
      }

      itemsHTML += `
        <div class="port-context-header">
          <span>📥 ${nodeTitle}</span>
          <span style="font-family:'JetBrains Mono'; color:#34d399;">[${portName}]</span>
        </div>
      `;

      conns.forEach(conn => {
        const srcNode = this.nodes.find(n => n.id === conn.fromNodeId);
        const srcTitle = srcNode ? (srcNode.title || srcNode.type) : conn.fromNodeId;
        itemsHTML += `
          <button type="button" class="port-context-item" onclick="window.nodeCanvas.deleteConnection('${conn.id}'); window.nodeCanvas.hidePortContextMenu();">
            <span>✂️ ตัดสายจาก ➔ ${srcTitle}</span>
          </button>
        `;
      });

      if (conns.length > 1) {
        itemsHTML += `
          <div class="port-context-divider"></div>
          <button type="button" class="port-context-item" onclick="window.nodeCanvas.disconnectAllToPort('${nodeId}', '${portName}')">
            <span>✂️ ตัดสายรับเข้าทั้งหมด</span>
            <span style="background:rgba(239,68,68,0.2); padding:1px 6px; border-radius:10px; font-size:10px;">${conns.length}</span>
          </button>
        `;
      }
    }

    this.portContextMenu.innerHTML = itemsHTML;

    // Calculate position relative to container
    const containerRect = this.container.getBoundingClientRect();
    let posX = clientX - containerRect.left + 10;
    let posY = clientY - containerRect.top + 10;

    // Boundary check so menu does not overflow right or bottom
    if (posX + 230 > containerRect.width) {
      posX = Math.max(10, clientX - containerRect.left - 220);
    }
    if (posY + 160 > containerRect.height) {
      posY = Math.max(10, clientY - containerRect.top - 140);
    }

    this.portContextMenu.style.left = `${posX}px`;
    this.portContextMenu.style.top = `${posY}px`;
    this.portContextMenu.style.display = 'flex';
  }

  hidePortContextMenu() {
    if (this.portContextMenu) {
      this.portContextMenu.style.display = 'none';
      this.portContextMenu.innerHTML = '';
    }
  }

  disconnectAllFromPort(nodeId, portName) {
    const toRemove = this.connections.filter(c => c.fromNodeId === nodeId && c.fromPort === portName);
    if (toRemove.length === 0) return;

    this.connections = this.connections.filter(c => !(c.fromNodeId === nodeId && c.fromPort === portName));
    this.hidePortContextMenu();
    this.render();
    this.addHistory('✂️', `ตัดสายออกจาก [${portName}] ทั้งหมด (${toRemove.length} เส้น)`);
    if (typeof window.toast === 'function') {
      window.toast(`✂️ ตัดสายออกจาก Pin นี้ (${toRemove.length} เส้น) เรียบร้อยแล้ว`, 'info');
    }
    this.onProfileChanged();
  }

  disconnectAllToPort(nodeId, portName) {
    const toRemove = this.connections.filter(c => c.toNodeId === nodeId && (c.toPort === portName || !c.toPort || c.toPort === 'exec_in'));
    if (toRemove.length === 0) return;

    this.connections = this.connections.filter(c => !(c.toNodeId === nodeId && (c.toPort === portName || !c.toPort || c.toPort === 'exec_in')));
    this.hidePortContextMenu();
    this.render();
    this.addHistory('✂️', `ตัดสายรับเข้า [${portName}] ทั้งหมด (${toRemove.length} เส้น)`);
    if (typeof window.toast === 'function') {
      window.toast(`✂️ ตัดสายรับเข้าทั้งหมด (${toRemove.length} เส้น) เรียบร้อยแล้ว`, 'info');
    }
    this.onProfileChanged();
  }

  addConnection(fromNodeId, fromPort, toNodeId, toPort) {
    this.draftWire = null;
    const existing = this.connections.find(c => c.fromNodeId === fromNodeId && c.fromPort === fromPort && c.toNodeId === toNodeId);
    if (existing) {
      this.render();
      return;
    }

    this.connections.push({
      id: `conn_${Date.now()}`,
      fromNodeId,
      fromPort,
      toNodeId,
      toPort
    });

    this.render();
    this.addHistory('🔗', `เชื่อมสาย [${fromPort}] ➔ [${toPort}]`);
    if (typeof window.toast === 'function') {
      window.toast('🔗 เชื่อมต่อ Action เรียบร้อยแล้ว', 'success');
    }
    this.onProfileChanged();
  }

  deleteConnection(connId) {
    const countBefore = this.connections.length;
    this.connections = this.connections.filter(c => c.id !== connId);
    if (this.connections.length !== countBefore) {
      this.render();
      this.addHistory('✂️', 'ยกเลิกการเชื่อมต่อสาย');
      if (typeof window.toast === 'function') {
        window.toast('✂️ ยกเลิกการเชื่อมต่อสายเรียบร้อยแล้ว', 'info');
      }
      this.onProfileChanged();
    }
  }

  addNodeFromPalette(type, customWorldPos = null) {
    const id = `node_${Date.now()}`;

    let x = 300;
    let y = 200;

    if (customWorldPos && typeof customWorldPos.x === 'number' && typeof customWorldPos.y === 'number') {
      x = Math.round(customWorldPos.x - 110);
      y = Math.round(customWorldPos.y - 40);
    } else if (this.viewport) {
      const viewportRect = this.viewport.getBoundingClientRect();
      const centerX = ((viewportRect.width / 2) - this.pan.x) / this.zoom;
      const centerY = ((viewportRect.height / 2) - this.pan.y) / this.zoom;
      x = Math.round(centerX - 110) + (Math.floor(Math.random() * 40) - 20);
      y = Math.round(centerY - 60) + (Math.floor(Math.random() * 40) - 20);
    }

    const titleNames = {
      trigger: 'Global Trigger',
      loop: 'Key Loop',
      buff_sequence: 'Buff Skill Queue',
      key_press: 'Single Key Press',
      delay: 'Delay Timer',
      branch: 'Branch (If / Else)',
      condition: 'Branch (If / Else)',
      control: 'Action Controller',
      forwarder: 'Multi-Client Forwarder',
      macro_group: 'Combo Macro Group',
      emergency_stop: 'Emergency Stop All',
      sound: 'Sound Alert',
      emit_event: 'Emit Event',
      key_hold: 'Key Hold Toggle',
      sequencer: 'Cast Sequencer',
      loop_scheduler: 'Loop Scheduler'
    };

    let initialData = { enabled: true };
    if (type === 'trigger') {
      initialData = { triggerType: 'keyboard', triggerValue: '1', enabled: true };
    } else if (type === 'emit_event') {
      initialData = { eventName: 'party_heal', enabled: true };
    } else if (type === 'loop_scheduler') {
      initialData = {
        targetClient: '1',
        collisionGuardMs: 800,
        items: [
          { id: 'item_0', name: 'Skill 1', interval: 3000, executeImmediately: true, enabled: true },
          { id: 'item_1', name: 'Skill 2', interval: 5000, executeImmediately: true, enabled: true }
        ],
        enabled: true
      };
    } else if (type === 'loop') {
      initialData = { targetClient: '1', keys: ['1'], interval: 1000, jitter: 0, executeImmediately: true, enabled: true };
    } else if (type === 'sequencer') {
      initialData = {
        modeType: 'loop', // 'loop' | 'once'
        targetClient: '1',
        interval: 1000,
        repeatCount: 1,
        delayAfter: 0,
        steps: [
          { key: '1', delay: 800 }
        ],
        enabled: true
      };
    } else if (type === 'buff_sequence') {
      initialData = { targetClient: '1', keys: ['1', '2'], delayBuff: 800, delayAfter: 0, enabled: true };
    } else if (type === 'key_press') {
      initialData = { targetClient: '1', keys: ['1'], delayAfter: 0, enabled: true };
    } else if (type === 'delay') {
      initialData = { delayMs: 1000, enabled: true };
    } else if (type === 'branch' || type === 'condition') {
      initialData = { conditionTargetId: '', conditionRule: 'is_running', enabled: true };
    } else if (type === 'control') {
      initialData = { controlOperation: 'toggle', controlTargetIds: [], enabled: true };
    } else if (type === 'forwarder') {
      initialData = { targetKey: '1', targetClient: 'all', delayAfter: 0, delayActivation: false, activationDelayMs: 1000, enabled: true };
    } else if (type === 'emergency_stop') {
      initialData = { stopScope: 'all', targetClient: '1', showOverlayNotice: true, enabled: true };
    } else if (type === 'sound') {
      initialData = { soundSource: 'preset', soundPreset: 'ding', soundUrl: '', soundFile: '', volume: 100, repeatCount: 1, enabled: true };
    } else if (type === 'macro_group') {
      initialData = {
        targetClient: '1',
        repeatCount: 1,
        steps: [
          { key: '1', delay: 300, holdMs: 0 },
          { key: '2', delay: 300, holdMs: 0 }
        ],
        enabled: true
      };
    } else if (type === 'key_hold') {
      initialData = { targetKey: '1', targetClient: '1', enabled: true };
    }

    const newNode = {
      id,
      type,
      title: titleNames[type] || type,
      position: { x, y },
      data: initialData
    };

    this.nodes.push(newNode);
    this.render();
    this.focusNode(id);
    this.addHistory('✨', `เพิ่มโหนด "${newNode.title}"`);
    this.onProfileChanged();
    if (typeof window.toast === 'function') {
      window.toast(`✨ เพิ่มโหนด "${newNode.title}" แล้ว`, 'success');
    }
  }

  focusNode(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;

    // Calculate viewport center coordinates
    const viewportRect = this.viewport ? this.viewport.getBoundingClientRect() : { width: 800, height: 600 };
    const nodeWidth = 220;
    const nodeHeight = 120;

    const targetPanX = (viewportRect.width / 2) - ((node.position.x + nodeWidth / 2) * this.zoom);
    const targetPanY = (viewportRect.height / 2) - ((node.position.y + nodeHeight / 2) * this.zoom);

    this.pan = { x: Math.round(targetPanX), y: Math.round(targetPanY) };
    this.updateTransform();

    // Select this node
    this.selectedNodeIds.clear();
    this.selectedNodeIds.add(nodeId);
    this.updateNodeSelectionClasses();
    this.openInspector(nodeId);

    // Apply Focus Pulse Glow Animation smoothly with clean timer reset
    if (this.focusPulseTimer) {
      clearTimeout(this.focusPulseTimer);
      this.focusPulseTimer = null;
    }

    // Remove active pulse animation from all nodes
    this.nodesLayer.querySelectorAll('.canvas-node.node-focus-pulse').forEach(el => {
      el.classList.remove('node-focus-pulse');
    });

    const nodeEl = this.nodesLayer.querySelector(`.canvas-node[data-id="${nodeId}"]`);
    if (nodeEl) {
      void nodeEl.offsetWidth; // Force reflow to immediately restart animation
      nodeEl.classList.add('node-focus-pulse');
      this.focusPulseTimer = setTimeout(() => {
        if (nodeEl) nodeEl.classList.remove('node-focus-pulse');
        this.focusPulseTimer = null;
      }, 1300);
    }

    this.updateOutlinerSelectionClasses();
  }

  updateOutlinerSelectionClasses() {
    if (!this.outlinerNodeList) return;
    const items = this.outlinerNodeList.querySelectorAll('.outliner-item');
    items.forEach(el => {
      const itemId = el.dataset.id;
      if (this.selectedNodeIds.has(itemId)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
  }

  selectNode(nodeId) {
    this.selectedNodeIds.clear();
    this.selectedNodeIds.add(nodeId);
    this.updateNodeSelectionClasses();
    this.updateOutlinerSelectionClasses();
    this.openInspector(nodeId);
  }

  deselectAll() {
    this.selectedNodeIds.clear();
    this.updateNodeSelectionClasses();
    this.updateOutlinerSelectionClasses();
    this.closeInspector();
  }

  switchDrawerTab(tabName) {
    this.activeDrawerTab = tabName;
    if (this.tabBtnOutliner) this.tabBtnOutliner.classList.toggle('active', tabName === 'outliner');
    if (this.tabBtnHistory) this.tabBtnHistory.classList.toggle('active', tabName === 'history');
    if (this.drawerOutlinerBody) this.drawerOutlinerBody.style.display = tabName === 'outliner' ? 'flex' : 'none';
    if (this.drawerHistoryBody) this.drawerHistoryBody.style.display = tabName === 'history' ? 'flex' : 'none';

    if (tabName === 'history') {
      this.renderHistory();
    } else {
      this.renderOutliner();
    }
  }

  togglePanel(tabName = null, forceState = undefined) {
    if (!this.outlinerPanel) return;
    const isCurrentlyOpen = this.outlinerPanel.classList.contains('open');

    if (tabName) {
      this.switchDrawerTab(tabName);
    }

    const shouldOpen = forceState !== undefined ? !!forceState : (!isCurrentlyOpen || (tabName && this.activeDrawerTab !== tabName));

    if (shouldOpen) {
      this.outlinerPanel.classList.add('open');
      if (this.activeDrawerTab === 'history') {
        this.renderHistory();
      } else {
        this.renderOutliner();
        if (this.outlinerSearchInput) {
          setTimeout(() => this.outlinerSearchInput.focus(), 50);
        }
      }
    } else {
      this.outlinerPanel.classList.remove('open');
    }
  }

  toggleOutliner(forceState = undefined) {
    this.togglePanel('outliner', forceState);
  }

  addHistory(icon, desc, saveSnapshot = true) {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const id = `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const entry = {
      id,
      time: timeStr,
      icon: icon || '📝',
      desc: desc || 'แก้ไขข้อมูล',
      snapshot: saveSnapshot ? JSON.parse(JSON.stringify({
        nodes: this.nodes,
        connections: this.connections,
        zoom: this.zoom,
        pan: this.pan
      })) : null
    };

    this.historyTimeline.unshift(entry);
    if (this.historyTimeline.length > 50) {
      this.historyTimeline.pop();
    }

    this.currentHistoryId = id;
    this.renderHistory();
  }

  jumpToHistory(historyId) {
    const item = this.historyTimeline.find(h => h.id === historyId);
    if (!item || !item.snapshot) return;

    // Restore snapshot state
    this.nodes = JSON.parse(JSON.stringify(item.snapshot.nodes || []));
    this.connections = JSON.parse(JSON.stringify(item.snapshot.connections || []));
    this.zoom = item.snapshot.zoom || this.zoom;
    this.pan = item.snapshot.pan || this.pan;

    this.selectedNodeIds.clear();
    this.updateTransform();
    this.render();
    this.closeInspector();
    this.onProfileChanged();

    this.currentHistoryId = historyId;
    this.renderHistory();

    if (typeof window.toast === 'function') {
      window.toast(`↩️ ย้อนเวลาไปยัง: ${item.desc} (${item.time})`, 'info');
    }
  }

  clearHistory() {
    this.historyTimeline = [];
    this.addHistory('📂', 'เริ่มต้นประวัติการแก้ไขใหม่', true);
    if (typeof window.toast === 'function') {
      window.toast('🗑️ ล้างประวัติการแก้ไขแล้ว', 'info');
    }
  }

  renderHistory() {
    if (!this.historyTimelineList) return;
    if (this.historyEntryCount) {
      this.historyEntryCount.textContent = `${this.historyTimeline.length}`;
    }

    if (this.historyTimeline.length === 0) {
      this.historyTimelineList.innerHTML = `
        <div style="font-size:12px; color:var(--muted); text-align:center; padding:24px 0;">
          ยังไม่มีประวัติการแก้ไขในเซสชันนี้
        </div>
      `;
      return;
    }

    let html = '';
    this.historyTimeline.forEach((item, index) => {
      const isCurrent = (!this.currentHistoryId && index === 0) || item.id === this.currentHistoryId;
      html += `
        <div class="history-item ${isCurrent ? 'active' : ''}" onclick="window.nodeCanvas.jumpToHistory('${item.id}')" title="คลิกเพื่อย้อนเวลากลับไปยังจุดนี้ (${item.time})">
          <span class="history-item-icon">${item.icon}</span>
          <div class="history-item-content">
            <div class="history-item-desc">${item.desc}</div>
            <span class="history-item-time">${item.time}</span>
          </div>
          ${isCurrent ? '<span class="history-current-pill">Current</span>' : ''}
        </div>
      `;
    });

    this.historyTimelineList.innerHTML = html;
  }

  filterOutliner(filterText) {
    this.renderOutliner(filterText);
  }

  renderOutliner(filterText = '') {
    if (!this.outlinerNodeList) return;

    if (this.outlinerNodeCount) {
      this.outlinerNodeCount.textContent = `${this.nodes.length}`;
    }

    const q = (filterText || (this.outlinerSearchInput ? this.outlinerSearchInput.value : '')).toLowerCase().trim();

    const iconMap = {
      trigger: '⚡',
      loop: '🔄',
      buff_sequence: '🛡️',
      key_press: '⌨️',
      delay: '⏱️',
      condition: '🌿',
      control: '🎛️',
      forwarder: '🔗',
      macro_group: '🔀'
    };

    let filteredNodes = this.nodes.filter(node => {
      if (!q) return true;
      const title = (node.title || '').toLowerCase();
      const type = (node.type || '').toLowerCase();
      const keyVal = String(node.data?.triggerValue || (node.data?.keys || []).join(',') || '').toLowerCase();
      const client = String(node.data?.targetClient || '').toLowerCase();
      return title.includes(q) || type.includes(q) || keyVal.includes(q) || client.includes(q);
    });

    if (filteredNodes.length === 0) {
      this.outlinerNodeList.innerHTML = `
        <div style="font-size:12px; color:var(--muted); text-align:center; padding:24px 0;">
          ${q ? `ไม่พบ Action ที่ตรงกับ "${filterText}"` : 'ยังไม่มี Node ใน Canvas'}
        </div>
      `;
      return;
    }

    let listHTML = '';
    filteredNodes.forEach(node => {
      const isSelected = this.selectedNodeIds.has(node.id);
      const icon = iconMap[node.type] || '📦';
      
      let metaText = '';
      if (node.type === 'trigger') {
        metaText = `Key: <strong>${node.data?.triggerValue || '-'}</strong>`;
      } else if (node.type === 'loop') {
        metaText = `Key: <strong>${(node.data?.keys || []).join(',')}</strong> (${node.data?.interval || 1000}ms)`;
      } else if (node.type === 'buff_sequence') {
        metaText = `Skills: <strong>${(node.data?.keys || []).join(',')}</strong> (${node.data?.delayBuff || 800}ms)`;
      } else if (node.type === 'key_press') {
        metaText = `Key: <strong>${(node.data?.keys || []).join(',') || node.data?.targetKey || '-'}</strong> (Client ${node.data?.targetClient || '1'})`;
      } else if (node.type === 'delay') {
        metaText = `Delay: <strong>${node.data?.delayMs ?? node.data?.interval ?? 1000}ms</strong>`;
      } else if (node.type === 'condition') {
        metaText = `Check: <strong>${node.data?.conditionType || 'Pixel'}</strong>`;
      } else if (node.type === 'control') {
        metaText = `Op: <strong>${(node.data?.controlOperation || 'toggle').toUpperCase()}</strong>`;
      } else if (node.type === 'forwarder') {
        metaText = `Key: <strong>${node.data?.targetKey || (node.data?.keys || [])[0] || '-'}</strong> ➔ Client ${node.data?.targetClient || 'All'}`;
      } else if (node.type === 'macro_group') {
        metaText = `Steps: <strong>${(node.data?.steps || []).length}</strong> actions`;
      } else {
        metaText = `Client <strong>${node.data?.targetClient || '1'}</strong>`;
      }

      listHTML += `
        <div class="outliner-item ${isSelected ? 'selected' : ''}" data-id="${node.id}" onclick="window.nodeCanvas.focusNode('${node.id}')" title="คลิกเพื่อ Focus ไปยังโหนดนี้">
          <span class="outliner-item-icon">${icon}</span>
          <div class="outliner-item-info">
            <div class="outliner-item-title">${node.title || node.type}</div>
            <div class="outliner-item-meta">
              <span class="outliner-item-badge">${node.type}</span>
              <span>${metaText}</span>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:2px;">
            <button onclick="event.stopPropagation(); window.nodeCanvas.duplicateNodeById('${node.id}')" style="background:transparent; border:none; color:var(--muted); font-size:12px; cursor:pointer; padding:2px 4px; border-radius:4px; opacity:0.6;" onmouseenter="this.style.opacity='1'; this.style.color='#60a5fa'" onmouseleave="this.style.opacity='0.6'; this.style.color='var(--muted)'" title="คัดลอก Node นี้ (Duplicate: Shift+D)">📋</button>
            <button onclick="event.stopPropagation(); window.nodeCanvas.deleteNodeById('${node.id}')" style="background:transparent; border:none; color:var(--muted); font-size:12px; cursor:pointer; padding:2px 4px; border-radius:4px; opacity:0.6;" onmouseenter="this.style.opacity='1'; this.style.color='#ef4444'" onmouseleave="this.style.opacity='0.6'; this.style.color='var(--muted)'" title="ลบ Node นี้">✕</button>
          </div>
        </div>
      `;
    });

    this.outlinerNodeList.innerHTML = listHTML;
  }

  duplicateNodeById(nodeId) {
    this.selectedNodeIds.clear();
    this.selectedNodeIds.add(nodeId);
    this.duplicateSelectedNodes();
  }

  deleteNodeById(nodeId) {
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    this.connections = this.connections.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId);
    this.selectedNodeIds.delete(nodeId);
    this.render();
    this.closeInspector();
    this.onProfileChanged();
    if (typeof window.toast === 'function') {
      window.toast('🗑️ ลบ Node แล้ว', 'info');
    }
  }

  openMultiSelectInspector() {
    const formBody = this.container.querySelector('#inspector-form-body');
    const titleEl = this.container.querySelector('#inspector-node-title');
    const count = this.selectedNodeIds.size;
    titleEl.innerHTML = `📦 Selected Nodes (${count})`;

    formBody.innerHTML = `
      <div style="font-size:13px; color:#e2e8f0; line-height:1.5;">
        เลือกโหนดอยู่ทั้งหมด <strong>${count} โหนด</strong>
      </div>
      <div style="font-size:11px; color:var(--muted); margin-top:4px;">
        คุณสามารถคลิกลากโหนดใดโหนดหนึ่งเพื่อย้ายทั้งหมดพร้อมกัน หรือกดปุ่มลบด้านล่าง / ปุ่ม Delete บนคีย์บอร์ด
      </div>
      <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.08); padding-top:14px; display:flex; flex-direction:column; gap:10px;">
        <button class="btn btn-ghost" style="width:100%; border-radius:8px; font-weight:600; padding:10px; border-color:#3b82f6; color:#60a5fa; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="window.nodeCanvas.duplicateSelectedNodes()" title="Duplicate Selected (Shift+D)">
          📋 Duplicate Selected (${count}) <span style="font-size:11px; opacity:0.75; font-family:'JetBrains Mono',monospace;">(Shift+D)</span>
        </button>
        <button class="btn btn-danger" style="width:100%; border-radius:8px; font-weight:700; padding:10px;" onclick="window.nodeCanvas.deleteSelectedNodes()">
          🗑️ ลบโหนดที่เลือกทั้งหมด (${count})
        </button>
      </div>
    `;

    this.inspectorPanel.classList.add('open');
  }

  openInspector(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const formBody = this.container.querySelector('#inspector-form-body');
    const titleEl = this.container.querySelector('#inspector-node-title');
    titleEl.innerHTML = `⚙️ ${this.getNodeTypeLabel(node.type)}`;

    let fieldsHTML = `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_node_title', 'Node Title')}</label>
        <input type="text" class="inspector-input" value="${node.title || ''}" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'title', this.value)" />
      </div>
    `;

    if (node.type === 'trigger') {
      const trigType = node.data?.triggerType || 'keyboard';
      let triggerValueInputHTML = '';
      if (trigType === 'mouse') {
        triggerValueInputHTML = `
          <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'triggerValue', this.value)">
            <option value="4" ${String(node.data?.triggerValue) === '4' ? 'selected' : ''}>${window.currentLang === 'en' ? 'Mouse Button 4 (XButton 1 / Lower Side)' : 'Mouse Button 4 (XButton 1 / ปุ่มข้างล่าง)'}</option>
            <option value="5" ${String(node.data?.triggerValue) === '5' ? 'selected' : ''}>${window.currentLang === 'en' ? 'Mouse Button 5 (XButton 2 / Upper Side)' : 'Mouse Button 5 (XButton 2 / ปุ่มข้างบน)'}</option>
          </select>
        `;
      } else if (trigType === 'event') {
        triggerValueInputHTML = `
          <input type="text" class="inspector-input" value="${node.data?.triggerValue || ''}" placeholder="e.g. party_heal, boss_spawn" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'triggerValue', this.value.trim())" style="font-family:'JetBrains Mono'; font-weight:700; color:#06b6d4;" />
          <span style="font-size:10px; color:var(--muted); margin-top:4px; display:block;">${canvasT('inspector_event_trigger_hint', 'Triggers automatically when any active profile emits this event.')}</span>
        `;
      } else {
        triggerValueInputHTML = `
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="inspector-input" value="${node.data?.triggerValue || ''}" placeholder="${window.currentLang === 'en' ? 'Click to record key...' : 'คลิกเพื่อบันทึกคีย์ (Press any key)...'}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'hotkey')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" />
            <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'hotkey')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
          </div>
        `;
      }

      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_trigger_type_label', 'Trigger Method')}</label>
          <select class="inspector-select" onchange="window.nodeCanvas.updateTriggerType('${node.id}', this.value)">
            <option value="keyboard" ${trigType === 'keyboard' ? 'selected' : ''}>⌨️ ${canvasT('triggerKeyboard', 'Keyboard Hotkey')}</option>
            <option value="mouse" ${trigType === 'mouse' ? 'selected' : ''}>🖱️ ${canvasT('triggerMouse', 'Mouse Button')}</option>
            <option value="event" ${trigType === 'event' ? 'selected' : ''}>📡 ${canvasT('triggerEventLabel', 'Custom Event Listener')}</option>
          </select>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${trigType === 'event' ? canvasT('inspector_event_name_label', 'Event Name to Listen') : canvasT('inspector_trigger_value_label', 'Trigger Key / Value')}</label>
          ${triggerValueInputHTML}
        </div>
      `;
    } else if (node.type === 'emit_event') {
      fieldsHTML += this.renderEmitEventHelper(node);
    } else if (node.type === 'loop') {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_loop_keys', 'Loop Keys (comma-separated)')}</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="inspector-input" value="${(node.data?.keys || []).join(', ')}" placeholder="${window.currentLang === 'en' ? 'Click to record key...' : 'คลิกเพื่อบันทึกคีย์...'}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'comma_keys')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; cursor:pointer; font-family:'JetBrains Mono'; color:#60a5fa;" />
            <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'comma_keys')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
          </div>
        </div>
        ${this.renderIntervalHelper(node)}
        <div class="inspector-field-group" style="margin-top:6px;">
          <label class="inspector-label">${canvasT('inspector_jitter_label', 'Jitter Random (ms)')}</label>
          <input type="number" class="inspector-input" value="${node.data?.jitter || 0}" min="0" max="5000" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'jitter', parseInt(this.value, 10))" />
        </div>
        <div class="inspector-field-group" style="margin-top:4px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
            <input type="checkbox" ${node.data?.executeImmediately !== false ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', 'executeImmediately', this.checked)" style="accent-color:#3b82f6; cursor:pointer;" />
            <span>${canvasT('inspector_exec_immediately', 'Execute Immediately on Start')}</span>
          </label>
        </div>
        ${this.renderSkillCooldownHelper(node)}
      `;
    } else if (node.type === 'buff_sequence') {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_skill_keys', 'Skill Queue Keys (comma-separated)')}</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="inspector-input" value="${(node.data?.keys || []).join(', ')}" placeholder="${window.currentLang === 'en' ? 'Click to record key...' : 'คลิกเพื่อบันทึกคีย์...'}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'comma_keys')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; cursor:pointer; font-family:'JetBrains Mono'; color:#60a5fa;" />
            <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'comma_keys')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
          </div>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_delay_between_skills', 'Delay Between Skills (ms)')}</label>
          <input type="number" class="inspector-input" value="${node.data?.delayBuff ?? 800}" min="50" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayBuff', parseInt(this.value, 10))" />
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_delay_after_seq', 'Delay After Sequence (ms)')}</label>
          <input type="number" class="inspector-input" value="${node.data?.delayAfter ?? 0}" min="0" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayAfter', parseInt(this.value, 10))" />
        </div>
        ${this.renderSkillCooldownHelper(node)}
      `;
    } else if (node.type === 'key_press') {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_key_to_press', 'Key to Press')}</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="inspector-input" value="${(node.data?.keys || []).join(', ') || node.data?.targetKey || ''}" placeholder="${window.currentLang === 'en' ? 'Click to record key...' : 'คลิกเพื่อบันทึกคีย์...'}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'single_key')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" />
            <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'single_key')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
          </div>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_delay_after_key', 'Delay After (ms)')}</label>
          <input type="number" class="inspector-input" value="${node.data?.delayAfter ?? 0}" min="0" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayAfter', parseInt(this.value, 10))" />
        </div>
        ${this.renderSkillCooldownHelper(node)}
      `;
    } else if (node.type === 'sequencer') {
      fieldsHTML += this.renderSequencerHelper(node);
    } else if (node.type === 'loop_scheduler') {
      fieldsHTML += this.renderLoopSchedulerHelper(node);
    } else if (node.type === 'delay') {
      fieldsHTML += this.renderDelayHelper(node);
    } else if (node.type === 'branch' || node.type === 'condition') {
      fieldsHTML += this.renderBranchHelper(node);
    } else if (node.type === 'emergency_stop') {
      fieldsHTML += this.renderEmergencyStopHelper(node);
    } else if (node.type === 'sound') {
      fieldsHTML += this.renderSoundAlertHelper(node);
    } else if (node.type === 'control') {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_control_op_label', 'Control Operation')}</label>
          <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'controlOperation', this.value)">
            <option value="toggle" ${node.data?.controlOperation === 'toggle' ? 'selected' : ''}>${canvasT('controlOpToggle', 'Toggle')}</option>
            <option value="start" ${node.data?.controlOperation === 'start' ? 'selected' : ''}>${canvasT('controlOpStart', 'Start / Enable')}</option>
            <option value="stop" ${node.data?.controlOperation === 'stop' ? 'selected' : ''}>${canvasT('controlOpStop', 'Stop / Disable')}</option>
          </select>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_control_targets_label', 'Target Actions to Control')}</label>
          ${this.renderControlTargetsSelector(node)}
        </div>
      `;
    } else if (node.type === 'key_hold') {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_hold_key', 'Hold Target Key')}</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="inspector-input" value="${node.data?.targetKey || (node.data?.keys || [])[0] || '1'}" placeholder="e.g. 1 or F1" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'single_key')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" />
            <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'single_key')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
          </div>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
        ${this.renderSkillCooldownHelper(node)}
      `;
    } else if (node.type === 'forwarder') {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_forward_key', 'Forward Target Key')}</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <input type="text" class="inspector-input" value="${node.data?.targetKey || (node.data?.keys || [])[0] || '1'}" placeholder="e.g. 1 or F1" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'single_key')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" />
            <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'single_key')" style="height:36px; padding:0 10px; border-color:#3b82f6; color:#60a5fa; border-radius:8px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
          </div>
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_delay_after_keyup', 'Delay After Key Up (ms)')}</label>
          <input type="number" class="inspector-input" value="${node.data?.delayAfter ?? 0}" min="0" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayAfter', parseInt(this.value, 10))" />
        </div>
        <div class="inspector-field-group" style="margin-top:4px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); cursor:pointer;">
            <input type="checkbox" ${node.data?.delayActivation ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayActivation', this.checked)" style="accent-color:#3b82f6; cursor:pointer;" />
            <span>${canvasT('inspector_delay_activation', 'Require holding trigger to activate')}</span>
          </label>
        </div>
        ${this.renderSkillCooldownHelper(node)}
      `;
    } else if (node.type === 'macro_group') {
      fieldsHTML += this.renderMacroGroupHelper(node);
    } else {
      fieldsHTML += `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_keys', 'Keys to Send')}</label>
          <input type="text" class="inspector-input" value="${(node.data?.keys || []).join(', ')}" onchange="window.nodeCanvas.updateNodeKeys('${node.id}', this.value)" />
        </div>
      `;
    }

    fieldsHTML += `
      <div style="margin-top:20px; border-top:1px solid rgba(255,255,255,0.08); padding-top:14px; display:flex; gap:8px;">
        <button class="btn btn-ghost" style="flex:1; border-radius:8px; border-color:#3b82f6; color:#60a5fa; font-weight:600; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="window.nodeCanvas.duplicateSelectedNodes()" title="Duplicate Node (Shift+D)">
          ${canvasT('inspector_btn_duplicate', '📋 Duplicate')} <span style="font-size:10px; opacity:0.75; font-family:'JetBrains Mono',monospace;">(Shift+D)</span>
        </button>
        <button class="btn btn-danger" style="flex:1; border-radius:8px;" onclick="window.nodeCanvas.deleteNode('${node.id}')">${canvasT('inspector_btn_delete', '🗑️ Delete')}</button>
      </div>
    `;

    formBody.innerHTML = fieldsHTML;
    this.inspectorPanel.classList.add('open');
  }

  renderIntervalHelper(node) {
    const curVal = node.data?.interval !== undefined ? node.data.interval : 1000;
    const presets = [
      { ms: 500, label: '500ms' },
      { ms: 800, label: '800ms' },
      { ms: 1000, label: '1s' },
      { ms: 1500, label: '1.5s' },
      { ms: 2000, label: '2s' },
      { ms: 3000, label: '3s' },
      { ms: 5000, label: '5s' },
      { ms: 10000, label: '10s' }
    ];
    const secStr = (curVal / 1000).toFixed(curVal >= 10000 ? 0 : (curVal % 1000 === 0 ? 0 : 1));

    let html = `
      <div class="inspector-field-group">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label class="inspector-label">${canvasT('inspector_interval_label', 'Loop Interval (ms)')}</label>
          <span id="interval-badge-${node.id}" style="font-size:11px; font-weight:700; color:#60a5fa; font-family:'JetBrains Mono';">${secStr}s (${curVal}ms)</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" onclick="window.nodeCanvas.adjustInterval('${node.id}', -100)" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px; padding:6px 8px; font-size:11px; font-weight:700; cursor:pointer;" title="-100ms">-100</button>
          <input type="number" class="inspector-input" id="inspector-interval-input-${node.id}" value="${curVal}" min="50" max="60000" step="50" style="flex:1; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" oninput="window.nodeCanvas.onIntervalInput('${node.id}', this.value)" onchange="window.nodeCanvas.onIntervalChange('${node.id}', this.value)" />
          <button type="button" onclick="window.nodeCanvas.adjustInterval('${node.id}', 100)" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px; padding:6px 8px; font-size:11px; font-weight:700; cursor:pointer;" title="+100ms">+100</button>
        </div>
        <input type="range" id="inspector-interval-slider-${node.id}" min="100" max="60000" step="50" value="${Math.min(curVal, 60000)}" style="width:100%; accent-color:#3b82f6; cursor:pointer; margin-top:4px;" oninput="window.nodeCanvas.onIntervalInput('${node.id}', this.value)" onchange="window.nodeCanvas.onIntervalChange('${node.id}', this.value)" />
        <div id="interval-presets-${node.id}" style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
          ${presets.map(p => {
            const isCur = curVal === p.ms;
            return `<button type="button" onclick="window.nodeCanvas.setPresetInterval('${node.id}', ${p.ms})" style="background:${isCur ? '#3b82f6' : 'rgba(255,255,255,0.06)'}; border:1px solid ${isCur ? '#60a5fa' : 'rgba(255,255,255,0.1)'}; color:${isCur ? '#fff' : 'var(--muted)'}; font-size:10px; font-weight:600; padding:3px 7px; border-radius:6px; cursor:pointer; transition:all 0.15s;">${p.label}</button>`;
          }).join('')}
        </div>
      </div>
    `;
    return html;
  }

  renderDelayHelper(node) {
    const curVal = node.data?.delayMs !== undefined ? node.data.delayMs : (node.data?.interval || 1000);
    const presets = [
      { ms: 500, label: '500ms' },
      { ms: 800, label: '800ms' },
      { ms: 1000, label: '1s' },
      { ms: 1500, label: '1.5s' },
      { ms: 2000, label: '2s' },
      { ms: 3000, label: '3s' },
      { ms: 5000, label: '5s' },
      { ms: 10000, label: '10s' }
    ];
    const secStr = (curVal / 1000).toFixed(curVal >= 10000 ? 0 : (curVal % 1000 === 0 ? 0 : 1));

    let html = `
      <div class="inspector-field-group">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label class="inspector-label">⏱️ ${canvasT('inspector_delay_duration', 'Delay Duration (ms)')}</label>
          <span id="delay-badge-${node.id}" style="font-size:11px; font-weight:700; color:#60a5fa; font-family:'JetBrains Mono';">${secStr}s (${curVal}ms)</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" onclick="window.nodeCanvas.adjustDelay('${node.id}', -100)" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px; padding:6px 8px; font-size:11px; font-weight:700; cursor:pointer;" title="-100ms">-100</button>
          <input type="number" class="inspector-input" id="inspector-delay-input-${node.id}" value="${curVal}" min="50" max="60000" step="50" style="flex:1; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa;" oninput="window.nodeCanvas.onDelayInput('${node.id}', this.value)" onchange="window.nodeCanvas.onDelayChange('${node.id}', this.value)" />
          <button type="button" onclick="window.nodeCanvas.adjustDelay('${node.id}', 100)" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); color:#fff; border-radius:6px; padding:6px 8px; font-size:11px; font-weight:700; cursor:pointer;" title="+100ms">+100</button>
        </div>
        <input type="range" id="inspector-delay-slider-${node.id}" min="100" max="60000" step="50" value="${Math.min(curVal, 60000)}" style="width:100%; accent-color:#3b82f6; cursor:pointer; margin-top:4px;" oninput="window.nodeCanvas.onDelayInput('${node.id}', this.value)" onchange="window.nodeCanvas.onDelayChange('${node.id}', this.value)" />
        <div id="delay-presets-${node.id}" style="display:flex; gap:4px; flex-wrap:wrap; margin-top:4px;">
          ${presets.map(p => {
            const isCur = curVal === p.ms;
            return `<button type="button" onclick="window.nodeCanvas.setPresetDelay('${node.id}', ${p.ms})" style="background:${isCur ? '#3b82f6' : 'rgba(255,255,255,0.06)'}; border:1px solid ${isCur ? '#60a5fa' : 'rgba(255,255,255,0.1)'}; color:${isCur ? '#fff' : 'var(--muted)'}; font-size:10px; font-weight:600; padding:3px 7px; border-radius:6px; cursor:pointer; transition:all 0.15s;">${p.label}</button>`;
          }).join('')}
        </div>
      </div>
    `;
    return html;
  }

  renderControlTargetsSelector(node) {
    const otherNodes = this.nodes.filter(n => n.id !== node.id && n.type !== 'trigger');
    const curTargets = Array.isArray(node.data?.controlTargetIds) ? node.data.controlTargetIds : [];

    if (otherNodes.length === 0) {
      return `<div style="font-size:11px; color:var(--muted); padding:4px 0;">ไม่มี Action อื่นใน Canvas</div>`;
    }

    let html = '<div style="display:flex; flex-direction:column; gap:4px; max-height:160px; overflow-y:auto; margin-top:4px;">';
    otherNodes.forEach(other => {
      const isChecked = curTargets.includes(other.id);
      html += `
        <label style="display:flex; align-items:center; gap:8px; font-size:12px; color:var(--text); background:rgba(255,255,255,0.03); padding:5px 8px; border-radius:6px; cursor:pointer;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.nodeCanvas.toggleControlTarget('${node.id}', '${other.id}', this.checked)" style="accent-color:#3b82f6; cursor:pointer;">
          <span>${other.title || other.type}</span>
          <span style="font-size:10px; color:var(--muted); margin-left:auto;">(${other.type})</span>
        </label>
      `;
    });
    html += '</div>';
    return html;
  }

  toggleControlTarget(nodeId, targetId, checked) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    if (!Array.isArray(node.data.controlTargetIds)) node.data.controlTargetIds = [];

    if (checked) {
      if (!node.data.controlTargetIds.includes(targetId)) node.data.controlTargetIds.push(targetId);
    } else {
      node.data.controlTargetIds = node.data.controlTargetIds.filter(id => id !== targetId);
    }
    this.renderNodes();
    this.onProfileChanged();
  }

  updateNodeKeys(nodeId, valStr) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const keys = String(valStr).split(',').map(s => s.trim()).filter(Boolean);
    node.data.keys = keys.length > 0 ? keys : ['1'];
    this.renderNodes();
    this.addHistory('⌨️', `แก้ไข Keys ของ "${node.title || node.type}" เป็น [${node.data.keys.join(', ')}]`);
    this.onProfileChanged();
  }

  updateTriggerType(nodeId, type) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    node.data.triggerType = type;
    if (type === 'mouse' && !['4', '5'].includes(String(node.data.triggerValue))) {
      node.data.triggerValue = '4';
    } else if (type === 'event') {
      if (!node.data.triggerValue || ['1', '4', '5'].includes(String(node.data.triggerValue))) {
        node.data.triggerValue = 'party_heal';
      }
    } else if (type === 'keyboard' && ['4', '5'].includes(String(node.data.triggerValue))) {
      node.data.triggerValue = '1';
    }
    this.renderNodes();
    this.openInspector(node.id);
    this.addHistory('⚡', `เปลี่ยนประเภท Trigger ของ "${node.title || node.type}" เป็น ${type}`);
    this.onProfileChanged();
  }

  renderEmitEventHelper(node) {
    const isEn = window.currentLang === 'en';
    const eventName = node.data?.eventName || '';
    return `
      <div class="inspector-field-group">
        <label class="inspector-label">📡 ${canvasT('inspector_event_name_label', isEn ? 'Event Name to Broadcast' : 'ชื่อเหตุการณ์ที่จะส่ง (Event Name)')}</label>
        <input type="text" class="inspector-input" value="${eventName}" placeholder="e.g. party_heal or boss_spawn" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'eventName', this.value.trim())" style="font-family:'JetBrains Mono'; font-weight:700; color:#06b6d4;" />
        <span style="font-size:10px; color:var(--muted); margin-top:4px; display:block;">
          ${canvasT('inspector_emit_event_hint', isEn ? 'This signal will be broadcasted to all active profiles listening for this event name.' : 'สัญญาณนี้จะถูกส่งไปยังทุกโปรไฟล์ที่เปิดใช้งาน (Active Profiles) ที่กำลังรอฟัง Event ชื่อนี้')}
        </span>
      </div>
    `;
  }

  onIntervalInput(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const intVal = Math.min(60000, Math.max(50, parseInt(val, 10) || 1000));
    node.data.interval = intVal;

    // Update UI elements in place without re-rendering form body to preserve slider drag
    const numInput = document.getElementById(`inspector-interval-input-${nodeId}`);
    const sliderInput = document.getElementById(`inspector-interval-slider-${nodeId}`);
    const badge = document.getElementById(`interval-badge-${nodeId}`);

    if (numInput && numInput.value != intVal) numInput.value = intVal;
    if (sliderInput && sliderInput.value != intVal) sliderInput.value = intVal;
    if (badge) {
      const secStr = (intVal / 1000).toFixed(intVal >= 10000 ? 0 : (intVal % 1000 === 0 ? 0 : 1));
      badge.textContent = `${secStr}s (${intVal}ms)`;
    }

    this.onProfileChanged();
  }

  onIntervalChange(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const intVal = Math.min(60000, Math.max(50, parseInt(val, 10) || 1000));
    node.data.interval = intVal;
    this.renderNodes();
    this.openInspector(node.id);
    this.addHistory('⏱️', `ปรับ Interval ของ "${node.title || node.type}" เป็น ${intVal}ms`);
    this.onProfileChanged();
  }

  setPresetInterval(nodeId, ms) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    node.data.interval = ms;
    this.renderNodes();
    this.openInspector(node.id);
    this.addHistory('⏱️', `เลือก Preset Interval ของ "${node.title || node.type}" เป็น ${ms}ms`);
    this.onProfileChanged();
  }

  adjustInterval(nodeId, delta) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const cur = node.data.interval !== undefined ? node.data.interval : 1000;
    const nextVal = Math.min(60000, Math.max(50, cur + delta));
    node.data.interval = nextVal;
    this.renderNodes();
    this.openInspector(node.id);
    this.addHistory('⏱️', `ปรับ Interval ของ "${node.title || node.type}" เป็น ${nextVal}ms`);
    this.onProfileChanged();
  }

  onDelayInput(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const dVal = Math.min(60000, Math.max(50, parseInt(val, 10) || 1000));
    node.data.delayMs = dVal;
    node.data.interval = dVal;

    const numInput = document.getElementById(`inspector-delay-input-${nodeId}`);
    const sliderInput = document.getElementById(`inspector-delay-slider-${nodeId}`);
    const badge = document.getElementById(`delay-badge-${nodeId}`);

    if (numInput && numInput.value != dVal) numInput.value = dVal;
    if (sliderInput && sliderInput.value != dVal) sliderInput.value = dVal;
    if (badge) {
      const secStr = (dVal / 1000).toFixed(dVal >= 10000 ? 0 : (dVal % 1000 === 0 ? 0 : 1));
      badge.textContent = `${secStr}s (${dVal}ms)`;
    }

    this.onProfileChanged();
  }

  onDelayChange(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const dVal = Math.min(60000, Math.max(50, parseInt(val, 10) || 1000));
    if (!node.data) node.data = {};
    node.data.delayMs = dVal;
    node.data.interval = dVal;
    this.render();
    this.openInspector(node.id);
    this.addHistory('⏱️', `ปรับ Delay ของ "${node.title || node.type}" เป็น ${dVal}ms`);
    this.onProfileChanged();
  }

  setPresetDelay(nodeId, ms) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    node.data.delayMs = ms;
    node.data.interval = ms;
    this.render();
    this.openInspector(node.id);
    this.addHistory('⏱️', `เลือก Preset Delay ของ "${node.title || node.type}" เป็น ${ms}ms`);
    this.onProfileChanged();
  }

  adjustDelay(nodeId, delta) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const cur = node.data?.delayMs !== undefined ? node.data.delayMs : (node.data?.interval || 1000);
    const nextVal = Math.min(60000, Math.max(50, cur + delta));
    node.data.delayMs = nextVal;
    node.data.interval = nextVal;
    this.render();
    this.openInspector(node.id);
    this.addHistory('⏱️', `ปรับ Delay ของ "${node.title || node.type}" เป็น ${nextVal}ms`);
    this.onProfileChanged();
  }

  renderClientButtonSelector(node) {
    const rawVal = node.data?.targetClient || '1';
    let selectedList = [];
    const isAllSelected = rawVal === 'all' || rawVal === 'both';
    if (isAllSelected) {
      selectedList = ['1', '2', '3', '4', '5', '6', '7', '8'];
    } else {
      selectedList = String(rawVal).split(',').map(s => s.trim()).filter(Boolean);
    }

    let buttonsHTML = '<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">';
    for (let i = 1; i <= 8; i++) {
      const isSelected = isAllSelected || selectedList.includes(String(i));
      const bg = isSelected ? '#3b82f6' : 'rgba(15,23,42,0.8)';
      const border = isSelected ? '#60a5fa' : 'rgba(255,255,255,0.12)';
      const color = isSelected ? '#fff' : 'var(--muted)';
      buttonsHTML += `
        <button type="button" onclick="window.nodeCanvas.toggleClientSelection('${node.id}', '${i}')"
          style="background:${bg}; border:1px solid ${border}; color:${color}; width:28px; height:28px; border-radius:50%; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s; outline:none;"
          title="Client ${i}">
          ${i}
        </button>
      `;
    }

    const allBg = isAllSelected ? '#3b82f6' : 'rgba(15,23,42,0.8)';
    const allBorder = isAllSelected ? '#60a5fa' : 'rgba(255,255,255,0.12)';
    const allColor = isAllSelected ? '#fff' : 'var(--muted)';
    buttonsHTML += `
      <button type="button" onclick="window.nodeCanvas.toggleClientSelection('${node.id}', 'all')"
        style="background:${allBg}; border:1px solid ${allBorder}; color:${allColor}; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.15s; outline:none;"
        title="All Active Clients">
        ALL
      </button>
    `;
    buttonsHTML += '</div>';
    return buttonsHTML;
  }

  renderControlTargetsSelector(node) {
    const rawTargets = node.data?.controlTargetIds || (node.data?.controlTargetId ? [node.data?.controlTargetId] : []);
    const canonicalTargets = rawTargets.map(id => id.startsWith('node_') ? id.replace('node_', '') : id);
    const nonControllableTypes = ['trigger', 'branch', 'control', 'emergency_stop'];
    const availableNodes = this.nodes.filter(n => n.id !== node.id && !nonControllableTypes.includes(n.type));

    if (availableNodes.length === 0) {
      return `<div style="font-size:11px; color:var(--muted); padding:4px 0;">(ไม่มี Action อื่นบน Canvas)</div>`;
    }

    const totalCount = availableNodes.length;
    const selectedCount = availableNodes.filter(n => {
      const rawActId = n.data?.actionId || (n.id.startsWith('node_') ? n.id.replace('node_', '') : n.id);
      const actId = rawActId.startsWith('node_') ? rawActId.replace('node_', '') : rawActId;
      return canonicalTargets.includes(actId) || canonicalTargets.includes(n.id);
    }).length;

    let html = `
      <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="text" class="inspector-input" id="control-targets-search-input"
            placeholder="${window.currentLang === 'en' ? '🔍 Search actions...' : '🔍 ค้นหา Action...'}"
            oninput="window.nodeCanvas.filterControlTargetList(this.value)"
            style="flex:1; font-size:11px; padding:4px 8px; height:28px;" />
          <span id="control-targets-count-badge" style="font-size:10px; font-weight:700; color:#60a5fa; background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); padding:2px 6px; border-radius:10px; white-space:nowrap;">
            ${selectedCount}/${totalCount}
          </span>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn btn-ghost" onclick="window.nodeCanvas.toggleAllControlTargets('${node.id}', true)" style="flex:1; font-size:10px; padding:3px 0; border-color:rgba(59,130,246,0.4); color:#60a5fa; border-radius:6px;">
            ${window.currentLang === 'en' ? '✅ Select All' : '✅ เลือกทั้งหมด'}
          </button>
          <button type="button" class="btn btn-ghost" onclick="window.nodeCanvas.toggleAllControlTargets('${node.id}', false)" style="flex:1; font-size:10px; padding:3px 0; border-color:rgba(239,68,68,0.4); color:#ef4444; border-radius:6px;">
            ${window.currentLang === 'en' ? '🚫 Clear All' : '🚫 ยกเลิกทั้งหมด'}
          </button>
        </div>
        <div id="control-targets-list-container" style="display:flex; flex-direction:column; gap:4px; max-height:220px; overflow-y:auto; padding-right:2px; margin-top:2px; border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:6px; background:rgba(0,0,0,0.2);">
    `;

    availableNodes.forEach(otherNode => {
      const rawActId = otherNode.data?.actionId || (otherNode.id.startsWith('node_') ? otherNode.id.replace('node_', '') : otherNode.id);
      const actId = rawActId.startsWith('node_') ? rawActId.replace('node_', '') : rawActId;
      const isChecked = canonicalTargets.includes(actId) || canonicalTargets.includes(otherNode.id);
      const nodeTypeLabel = this.getNodeTypeLabel(otherNode.type);
      html += `
        <label class="control-target-item" data-title="${(otherNode.title || '').toLowerCase()}" data-type="${otherNode.type.toLowerCase()}" style="display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:6px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); cursor:pointer; font-size:12px; color:var(--text); transition:background 0.15s;">
          <input type="checkbox" class="control-target-checkbox" data-action-id="${actId}" ${isChecked ? 'checked' : ''} style="accent-color:#3b82f6; cursor:pointer; width:14px; height:14px;" onchange="window.nodeCanvas.toggleControlTarget('${node.id}', '${actId}', this.checked)" />
          <span style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;" title="${otherNode.title || otherNode.type}">${otherNode.title || otherNode.type}</span>
          <span style="font-size:10px; color:var(--muted); white-space:nowrap;">(${nodeTypeLabel})</span>
        </label>
      `;
    });

    html += `
        </div>
      </div>
    `;
    return html;
  }

  filterControlTargetList(query) {
    const q = (query || '').toLowerCase().trim();
    const container = this.container.querySelector('#control-targets-list-container');
    if (!container) return;
    const items = container.querySelectorAll('.control-target-item');
    items.forEach(item => {
      const title = item.getAttribute('data-title') || '';
      const type = item.getAttribute('data-type') || '';
      if (!q || title.includes(q) || type.includes(q)) {
        item.style.display = 'flex';
      } else {
        item.style.display = 'none';
      }
    });
  }

  toggleControlTarget(nodeId, targetActionId, isChecked) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const rawTargets = node.data.controlTargetIds || (node.data.controlTargetId ? [node.data.controlTargetId] : []);
    let targets = rawTargets.map(id => id.startsWith('node_') ? id.replace('node_', '') : id);

    if (isChecked) {
      if (!targets.includes(targetActionId)) targets.push(targetActionId);
    } else {
      targets = targets.filter(t => t !== targetActionId && t !== `node_${targetActionId}`);
    }

    node.data.controlTargetIds = targets;
    node.data.controlTargetId = targets[0] || '';

    // Update count badge in inspector without re-rendering form and losing scroll position
    const badge = this.container.querySelector('#control-targets-count-badge');
    const availableNodes = this.nodes.filter(n => n.id !== node.id && n.type !== 'trigger');
    if (badge) {
      const canonical = targets.map(id => id.startsWith('node_') ? id.replace('node_', '') : id);
      const selected = availableNodes.filter(n => {
        const actId = n.data?.actionId || (n.id.startsWith('node_') ? n.id.replace('node_', '') : n.id);
        return canonical.includes(actId) || canonical.includes(n.id);
      }).length;
      badge.textContent = `${selected}/${availableNodes.length}`;
    }

    this.renderNodes();
    this.addHistory('🎯', `อัปเดตเป้าหมายควบคุมของ "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  toggleAllControlTargets(nodeId, selectAll) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const availableNodes = this.nodes.filter(n => n.id !== node.id && n.type !== 'trigger');

    let targets = [];
    if (selectAll) {
      targets = availableNodes.map(n => n.data?.actionId || (n.id.startsWith('node_') ? n.id.replace('node_', '') : n.id));
    }

    node.data.controlTargetIds = targets;
    node.data.controlTargetId = targets[0] || '';

    // Update all checkboxes in inspector list DOM
    const container = this.container.querySelector('#control-targets-list-container');
    if (container) {
      const checkboxes = container.querySelectorAll('.control-target-checkbox');
      checkboxes.forEach(cb => {
        cb.checked = !!selectAll;
      });
    }

    // Update count badge
    const badge = this.container.querySelector('#control-targets-count-badge');
    if (badge) {
      badge.textContent = `${selectAll ? availableNodes.length : 0}/${availableNodes.length}`;
    }

    this.renderNodes();
    this.addHistory('🎯', `${selectAll ? 'เลือกเป้าหมายทั้งหมด' : 'ยกเลิกเป้าหมายทั้งหมด'} ของ "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  renderSequencerHelper(node) {
    const steps = Array.isArray(node.data?.steps) ? node.data.steps : [];
    const isLoop = (node.data?.modeType || 'loop') === 'loop';
    const intervalVal = node.data?.interval !== undefined ? node.data.interval : 1000;
    const repeatCount = Math.max(1, parseInt(node.data?.repeatCount, 10) || 1);
    const delayAfter = parseInt(node.data?.delayAfter, 10) || 0;

    let stepsHTML = '';
    if (steps.length === 0) {
      stepsHTML = `
        <div style="font-size:12px; color:var(--muted); text-align:center; padding:16px 8px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px dashed rgba(255,255,255,0.1);">
          ${window.currentLang === 'en' ? 'No steps in sequencer. Click + Add Step below.' : 'ยังไม่มีขั้นตอนคำสั่ง คลิกปุ่ม + เพิ่ม Step ด้านล่าง'}
        </div>
      `;
    } else {
      stepsHTML = steps.map((s, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === steps.length - 1;
        const delayMs = s.delay !== undefined ? s.delay : (s.castTimeMs !== undefined ? s.castTimeMs : 800);

        return `
          <div class="sequencer-step-item" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:12px; font-weight:700; color:#f59e0b; background:rgba(255,255,255,0.06); width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center;">${idx + 1}</span>
                <span style="font-size:12px; font-weight:600; color:var(--text);">${window.currentLang === 'en' ? 'Step Action' : 'ขั้นตอนคำสั่ง'}</span>
              </div>
              <div style="display:flex; align-items:center; gap:4px;">
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px;" onclick="window.nodeCanvas.moveSequencerStep('${node.id}', ${idx}, -1)" ${isFirst ? 'disabled' : ''} title="Move Up">▲</button>
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px;" onclick="window.nodeCanvas.moveSequencerStep('${node.id}', ${idx}, 1)" ${isLast ? 'disabled' : ''} title="Move Down">▼</button>
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px; color:#ef4444;" onclick="window.nodeCanvas.removeSequencerStep('${node.id}', ${idx})" title="Delete Step">🗑️</button>
              </div>
            </div>

            <div style="display:flex; gap:8px; align-items:flex-end; width:100%;">
              <div style="flex:1; min-width:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Key to Send' : 'ปุ่มที่กด'}</label>
                <div style="display:flex; align-items:center; gap:4px;">
                  <input type="text" class="inspector-input" value="${s.key || ''}" placeholder="${window.currentLang === 'en' ? 'Record key...' : 'กดบันทึก...'}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'sequencer_step_${idx}')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; min-width:0; height:30px; font-size:12px; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa; box-sizing:border-box;" />
                  <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'sequencer_step_${idx}')" style="height:30px; width:30px; padding:0; flex-shrink:0; border-color:#3b82f6; color:#60a5fa; border-radius:6px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
                </div>
              </div>

              <div style="width:95px; flex-shrink:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Delay (ms)' : 'ดีเลย์ (ms)'}</label>
                <input type="number" class="inspector-input" value="${delayMs}" min="0" step="50" onchange="window.nodeCanvas.updateSequencerStep('${node.id}', ${idx}, 'delay', parseInt(this.value, 10))" style="width:100%; height:30px; font-size:12px; text-align:center; padding:0 6px; box-sizing:border-box;" />
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
        ${this.renderClientButtonSelector(node)}
      </div>

      <div class="inspector-field-group">
        <label class="inspector-label">${window.currentLang === 'en' ? 'Execution Mode' : 'โหมดการทำงาน'}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'modeType', this.value); window.nodeCanvas.openInspector('${node.id}');">
          <option value="loop" ${isLoop ? 'selected' : ''}>🔄 ${window.currentLang === 'en' ? 'Continuous Loop (Start / Stop)' : 'วนลูปต่อเนื่อง (กดเริ่ม / กดหยุด)'}</option>
          <option value="once" ${!isLoop ? 'selected' : ''}>⚡ ${window.currentLang === 'en' ? 'Once / Burst (Single Trigger)' : 'รันทีเดียวจบ (Once / Burst)'}</option>
        </select>
      </div>

      ${isLoop ? `
        <div class="inspector-field-group">
          <label class="inspector-label">${window.currentLang === 'en' ? 'Loop Rest Interval (ms)' : 'หน่วงเวลาพักหลังจบรอบลูป (ms)'}</label>
          <input type="number" class="inspector-input" value="${intervalVal}" min="0" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'interval', parseInt(this.value, 10))" />
        </div>
      ` : `
        <div style="display:flex; gap:8px; margin-top:4px;">
          <div class="inspector-field-group" style="flex:1;">
            <label class="inspector-label">${window.currentLang === 'en' ? 'Repeat Count' : 'วนรอบซ้ำ (รอบ)'}</label>
            <input type="number" class="inspector-input" value="${repeatCount}" min="1" max="100" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'repeatCount', parseInt(this.value, 10))" />
          </div>
          <div class="inspector-field-group" style="flex:1;">
            <label class="inspector-label">${window.currentLang === 'en' ? 'Delay After (ms)' : 'พักหลังจบรอบ (ms)'}</label>
            <input type="number" class="inspector-input" value="${delayAfter}" min="0" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'delayAfter', parseInt(this.value, 10))" />
          </div>
        </div>
      `}

      <div class="inspector-field-group" style="margin-top:8px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <label class="inspector-label" style="margin:0;">📋 ${window.currentLang === 'en' ? 'Sequence Steps' : 'ลำดับขั้นตอน (Sequence Steps)'} (${steps.length})</label>
        </div>
        ${stepsHTML}

        <button type="button" class="btn btn-primary" style="width:100%; height:34px; font-size:12px; margin-top:8px; background:#f59e0b; border-color:#d97706; color:#000; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="window.nodeCanvas.addSequencerStep('${node.id}')">
          ➕ ${window.currentLang === 'en' ? 'Add Step' : 'เพิ่มขั้นตอน (+ Add Step)'}
        </button>
      </div>
    `;
  }

  renderLoopSchedulerHelper(node) {
    const items = Array.isArray(node.data?.items) ? node.data.items : [];
    const guardMs = node.data?.collisionGuardMs !== undefined ? node.data.collisionGuardMs : 800;

    let itemsHTML = '';
    if (items.length === 0) {
      itemsHTML = `
        <div style="font-size:12px; color:var(--muted); text-align:center; padding:16px 8px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px dashed rgba(255,255,255,0.1);">
          ${window.currentLang === 'en' ? 'No loop timers yet. Click button below to add.' : 'ยังไม่มีรายการลูป คลิกปุ่มด้านล่างเพื่อเพิ่ม Loop Item'}
        </div>
      `;
    } else {
      itemsHTML = items.map((it, idx) => {
        const isEnabled = it.enabled !== false;
        const isExecImmed = it.executeImmediately !== false;
        const itInterval = it.interval !== undefined ? it.interval : 3000;
        const itJitter = it.jitter !== undefined ? it.jitter : 0;

        return `
          <div class="scheduler-item-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:12px; font-weight:700; color:#38bdf8; background:rgba(56,189,248,0.1); width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center;">${idx + 1}</span>
                <span style="font-size:11px; font-weight:700; color:#60a5fa; font-family:'JetBrains Mono';">[Pin: item_${idx}]</span>
              </div>
              <div style="display:flex; align-items:center; gap:6px;">
                <label style="display:flex; align-items:center; gap:4px; font-size:11px; color:${isEnabled ? '#34d399' : 'var(--muted)'}; cursor:pointer; margin:0;">
                  <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="window.nodeCanvas.updateSchedulerItem('${node.id}', ${idx}, 'enabled', this.checked)" style="accent-color:#10b981; cursor:pointer;" />
                  <span>${isEnabled ? 'Active' : 'Muted'}</span>
                </label>
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px; color:#ef4444;" onclick="window.nodeCanvas.removeSchedulerItem('${node.id}', ${idx})" title="Delete Item">🗑️</button>
              </div>
            </div>

            <div style="display:flex; gap:6px; align-items:flex-end; width:100%;">
              <div style="flex:1; min-width:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Item Label' : 'ชื่อรายการ'}</label>
                <input type="text" class="inspector-input" value="${it.name || `Skill ${idx + 1}`}" placeholder="e.g. Heal 1" onchange="window.nodeCanvas.updateSchedulerItem('${node.id}', ${idx}, 'name', this.value.trim())" style="width:100%; height:30px; font-size:12px; font-weight:600; box-sizing:border-box; padding:0 8px;" />
              </div>
              <div style="width:75px; flex-shrink:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Interval (ms)' : 'เวลา (ms)'}</label>
                <input type="number" class="inspector-input" value="${itInterval}" min="50" step="100" onchange="window.nodeCanvas.updateSchedulerItem('${node.id}', ${idx}, 'interval', parseInt(this.value, 10))" style="width:100%; height:30px; font-size:12px; text-align:center; padding:0 4px; box-sizing:border-box; font-family:'JetBrains Mono'; font-weight:700; color:#38bdf8;" />
              </div>
              <div style="width:65px; flex-shrink:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? '± Jitter (ms)' : '± สุ่ม (ms)'}</label>
                <input type="number" class="inspector-input" value="${itJitter}" min="0" max="10000" step="50" onchange="window.nodeCanvas.updateSchedulerItem('${node.id}', ${idx}, 'jitter', parseInt(this.value, 10))" style="width:100%; height:30px; font-size:12px; text-align:center; padding:0 4px; box-sizing:border-box; font-family:'JetBrains Mono'; font-weight:700; color:#a855f7;" title="สุ่มเพิ่ม/ลดเวลา ±ms" />
              </div>
            </div>

            <label style="display:flex; align-items:center; gap:6px; font-size:11px; color:var(--text); cursor:pointer; margin-top:2px;">
              <input type="checkbox" ${isExecImmed ? 'checked' : ''} onchange="window.nodeCanvas.updateSchedulerItem('${node.id}', ${idx}, 'executeImmediately', this.checked)" style="accent-color:#3b82f6; cursor:pointer;" />
              <span>${window.currentLang === 'en' ? 'Execute immediately on start' : 'เริ่มยิงทันทีเมื่อกด Start'}</span>
            </label>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
        ${this.renderClientButtonSelector(node)}
      </div>

      <div class="inspector-field-group">
        <label class="inspector-label" style="display:flex; align-items:center; justify-content:space-between;">
          <span>🛡️ ${window.currentLang === 'en' ? 'Anti-Collision Guard Delay (ms)' : 'เวลาป้องกันการชนกัน (Guard Delay ms)'}</span>
          <span style="font-size:10px; color:#10b981; font-family:'JetBrains Mono'; font-weight:700;">${guardMs}ms</span>
        </label>
        <input type="number" class="inspector-input" value="${guardMs}" min="50" max="5000" step="50" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'collisionGuardMs', parseInt(this.value, 10))" style="font-family:'JetBrains Mono'; color:#10b981; font-weight:700;" />
        <span style="font-size:10px; color:var(--muted); margin-top:4px; display:block;">
          ${window.currentLang === 'en' ? 'Minimum wait time between overlapping actions to prevent in-game animation lock.' : 'ระยะเวลารอขั้นต่ำระหว่างแต่ละสกิลเมื่อถึงเวลาพร้อมกัน เพื่อป้องกันคีย์ชนและติด Animation Lock ในเกม'}
        </span>
      </div>

      <div class="inspector-field-group" style="margin-top:8px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <label class="inspector-label" style="margin:0;">⏱️ ${window.currentLang === 'en' ? 'Independent Loop Timers' : 'รายการลูปเวลาอิสระ (Loop Timers)'} (${items.length})</label>
        </div>
        ${itemsHTML}

        <button type="button" class="btn btn-primary" style="width:100%; height:34px; font-size:12px; margin-top:8px; background:#0284c7; border-color:#0369a1; color:#fff; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="window.nodeCanvas.addSchedulerItem('${node.id}')">
          ➕ ${window.currentLang === 'en' ? 'Add Loop Timer' : 'เพิ่มรายการลูป (+ Add Loop Item)'}
        </button>
      </div>
    `;
  }

  addSchedulerItem(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    if (!Array.isArray(node.data.items)) node.data.items = [];
    const nextIdx = node.data.items.length;
    node.data.items.push({
      id: `item_${nextIdx}`,
      name: `Skill ${nextIdx + 1}`,
      interval: 3000,
      jitter: 0,
      executeImmediately: true,
      enabled: true
    });
    this.render();
    this.openInspector(nodeId);
    this.addHistory('➕', `เพิ่ม Loop Item ใน "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  removeSchedulerItem(nodeId, index) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.items)) return;
    node.data.items.splice(index, 1);
    this.render();
    this.openInspector(nodeId);
    this.addHistory('🗑️', `ลบ Loop Item #${index + 1}`);
    this.onProfileChanged();
  }

  updateSchedulerItem(nodeId, index, field, value) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.items)) return;
    if (node.data.items[index]) {
      node.data.items[index][field] = value;
      this.render();
      this.onProfileChanged();
    }
  }

  addSequencerStep(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    if (!Array.isArray(node.data.steps)) node.data.steps = [];

    node.data.steps.push({
      key: '1',
      delay: 800
    });

    this.render();
    this.openInspector(nodeId);
    this.addHistory('➕', `เพิ่มขั้นตอนใน "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  removeSequencerStep(nodeId, index) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;

    node.data.steps.splice(index, 1);
    this.render();
    this.openInspector(nodeId);
    this.addHistory('🗑️', `ลบขั้นตอนที่ ${index + 1} ใน "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  moveSequencerStep(nodeId, index, direction) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= node.data.steps.length) return;

    const temp = node.data.steps[index];
    node.data.steps[index] = node.data.steps[targetIdx];
    node.data.steps[targetIdx] = temp;

    this.render();
    this.openInspector(nodeId);
    this.addHistory('↕️', `สลับลำดับขั้นตอนใน "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  updateSequencerStep(nodeId, index, field, value) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;
    if (!node.data.steps[index]) return;

    node.data.steps[index][field] = value;
    if (field === 'delay') {
      node.data.steps[index].castTimeMs = value;
    }

    this.render();
    this.openInspector(nodeId);
    this.onProfileChanged();
  }

  renderMacroGroupHelper(node) {
    const steps = Array.isArray(node.data?.steps) ? node.data.steps : [];
    const repeatCount = Math.max(1, parseInt(node.data?.repeatCount, 10) || 1);

    let stepsHTML = '';
    if (steps.length === 0) {
      stepsHTML = `
        <div style="font-size:12px; color:var(--muted); text-align:center; padding:16px 8px; background:rgba(0,0,0,0.2); border-radius:8px; border:1px dashed rgba(255,255,255,0.1);">
          ${window.currentLang === 'en' ? 'No steps in macro. Click button below to add.' : 'ยังไม่มีขั้นตอนมาโคร คลิกปุ่มด้านล่างเพื่อเพิ่ม Step'}
        </div>
      `;
    } else {
      stepsHTML = steps.map((s, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === steps.length - 1;
        const delayVal = s.delay !== undefined ? s.delay : 300;
        const holdVal = s.holdMs !== undefined ? s.holdMs : 0;

        return `
          <div class="macro-step-item" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:8px; padding:10px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:12px; font-weight:700; color:#60a5fa; background:rgba(255,255,255,0.06); width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center;">${idx + 1}</span>
                <span style="font-size:12px; font-weight:600; color:var(--text);">${window.currentLang === 'en' ? 'Step Action' : 'ขั้นตอนคำสั่ง'}</span>
              </div>
              <div style="display:flex; align-items:center; gap:4px;">
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px;" onclick="window.nodeCanvas.moveMacroStep('${node.id}', ${idx}, -1)" ${isFirst ? 'disabled' : ''} title="Move Up">▲</button>
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px;" onclick="window.nodeCanvas.moveMacroStep('${node.id}', ${idx}, 1)" ${isLast ? 'disabled' : ''} title="Move Down">▼</button>
                <button type="button" class="btn btn-ghost" style="padding:2px 6px; height:24px; font-size:11px; color:#ef4444;" onclick="window.nodeCanvas.removeMacroStep('${node.id}', ${idx})" title="Delete Step">🗑️</button>
              </div>
            </div>

            <div style="display:flex; gap:8px; align-items:flex-end; width:100%;">
              <div style="flex:1; min-width:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Key to Send' : 'ปุ่มที่กด'}</label>
                <div style="display:flex; align-items:center; gap:4px;">
                  <input type="text" class="inspector-input" value="${s.key || ''}" placeholder="${window.currentLang === 'en' ? 'Record key...' : 'กดบันทึก...'}" readonly onfocus="if(window.startRecordingKey) window.startRecordingKey(this, '${node.id}', 'macro_step_${idx}')" onblur="if(window.stopRecordingKey) window.stopRecordingKey(this)" style="flex:1; min-width:0; height:30px; font-size:12px; cursor:pointer; text-align:center; font-family:'JetBrains Mono'; font-weight:700; color:#60a5fa; box-sizing:border-box;" />
                  <button type="button" class="btn btn-ghost" onclick="if(window.openVirtualKeyboard) window.openVirtualKeyboard(this.previousElementSibling, '${node.id}', 'macro_step_${idx}')" style="height:30px; width:30px; padding:0; flex-shrink:0; border-color:#3b82f6; color:#60a5fa; border-radius:6px; display:flex; align-items:center; justify-content:center;" title="Virtual Keyboard">⌨️</button>
                </div>
              </div>

              <div style="width:75px; flex-shrink:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Delay (ms)' : 'ดีเลย์ (ms)'}</label>
                <input type="number" class="inspector-input" value="${delayVal}" min="0" step="50" onchange="window.nodeCanvas.updateMacroStep('${node.id}', ${idx}, 'delay', parseInt(this.value, 10))" style="width:100%; height:30px; font-size:12px; text-align:center; padding:0 4px; box-sizing:border-box;" />
              </div>

              <div style="width:75px; flex-shrink:0;">
                <label style="font-size:10px; color:var(--muted); display:block; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${window.currentLang === 'en' ? 'Hold (ms)' : 'กดค้าง (ms)'}</label>
                <input type="number" class="inspector-input" value="${holdVal}" min="0" step="50" onchange="window.nodeCanvas.updateMacroStep('${node.id}', ${idx}, 'holdMs', parseInt(this.value, 10))" style="width:100%; height:30px; font-size:12px; text-align:center; padding:0 4px; box-sizing:border-box;" />
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
        ${this.renderClientButtonSelector(node)}
      </div>

      <div class="inspector-field-group">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <label class="inspector-label" style="margin:0;">🔀 ${window.currentLang === 'en' ? 'Macro Steps Queue' : 'คิวลำดับคำสั่งมาโคร'} (${steps.length})</label>
        </div>
        ${stepsHTML}

        <button type="button" class="btn btn-primary" style="width:100%; height:34px; font-size:12px; margin-top:8px; display:flex; align-items:center; justify-content:center; gap:6px;" onclick="window.nodeCanvas.addMacroStep('${node.id}')">
          ➕ ${window.currentLang === 'en' ? 'Add Macro Step' : 'เพิ่มขั้นตอนมาโคร (+ Add Step)'}
        </button>
      </div>

      <div class="inspector-field-group" style="margin-top:8px;">
        <label class="inspector-label">${window.currentLang === 'en' ? 'Repeat Count' : 'วนรอบซ้ำ (รอบ)'}</label>
        <input type="number" class="inspector-input" value="${repeatCount}" min="1" max="100" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'repeatCount', parseInt(this.value, 10))" />
      </div>

      ${this.renderSkillCooldownHelper(node)}
    `;
  }

  addMacroStep(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    if (!Array.isArray(node.data.steps)) node.data.steps = [];

    node.data.steps.push({
      key: '1',
      delay: 300,
      holdMs: 0
    });

    this.render();
    this.openInspector(nodeId);
    this.addHistory('➕', `เพิ่มขั้นตอนใน "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  removeMacroStep(nodeId, index) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;

    node.data.steps.splice(index, 1);
    this.render();
    this.openInspector(nodeId);
    this.addHistory('🗑️', `ลบขั้นตอนที่ ${index + 1} ใน "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  moveMacroStep(nodeId, index, direction) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= node.data.steps.length) return;

    const temp = node.data.steps[index];
    node.data.steps[index] = node.data.steps[targetIdx];
    node.data.steps[targetIdx] = temp;

    this.render();
    this.openInspector(nodeId);
    this.addHistory('↕️', `สลับลำดับขั้นตอนใน "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  updateMacroStep(nodeId, index, field, value) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;
    if (!node.data.steps[index]) return;

    node.data.steps[index][field] = value;

    this.render();
    this.openInspector(nodeId);
    this.onProfileChanged();
  }

  renderBranchHelper(node) {
    const rawTargetId = node.data?.conditionTargetId || '';
    const canonicalTargetId = rawTargetId.startsWith('node_') ? rawTargetId.replace('node_', '') : rawTargetId;
    const rule = node.data?.conditionRule || 'is_running';
    const nonCheckableTypes = ['trigger', 'branch', 'control', 'emergency_stop'];
    const checkableNodes = this.nodes.filter(n => n.id !== node.id && !nonCheckableTypes.includes(n.type));

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_condition_target_label', 'Target Action to Check')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'conditionTargetId', this.value)">
          <option value="">${canvasT('inspector_select_action_check', '-- Select Action to Check --')}</option>
          ${checkableNodes.length === 0 ? `
            <option value="" disabled>(${canvasT('inspector_no_other_actions', 'No other actions on canvas')})</option>
          ` : checkableNodes.map(n => {
            let actId = n.data?.actionId || (n.id.startsWith('node_') ? n.id.replace('node_', '') : n.id);
            if (actId.startsWith('node_')) actId = actId.replace('node_', '');
            return `<option value="${actId}" ${actId === canonicalTargetId || n.id === rawTargetId ? 'selected' : ''}>${n.title || n.type} (${this.getNodeTypeLabel(n.type)})</option>`;
          }).join('')}
        </select>
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_condition_rule_label', 'Condition Evaluation Rule')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'conditionRule', this.value)">
          <option value="is_running" ${rule === 'is_running' ? 'selected' : ''}>🟢 ${canvasT('conditionRunning', 'Is Running')}</option>
          <option value="is_stopped" ${rule === 'is_stopped' ? 'selected' : ''}>🔴 ${canvasT('conditionStopped', 'Is Stopped')}</option>
          <option value="on_cooldown" ${rule === 'on_cooldown' ? 'selected' : ''}>⏳ ${canvasT('conditionCooldown', 'Is on Cooldown')}</option>
          <option value="is_ready" ${rule === 'is_ready' ? 'selected' : ''}>🛡️ ${canvasT('conditionReady', 'Is Ready')}</option>
        </select>
      </div>
    `;
  }

  renderEmergencyStopHelper(node) {
    const scope = node.data?.stopScope || 'all';
    const showNotice = node.data?.showOverlayNotice !== false;

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('inspector_stop_scope_label', 'Emergency Stop Scope')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'stopScope', this.value); window.nodeCanvas.openInspector('${node.id}');">
          <option value="all" ${scope === 'all' ? 'selected' : ''}>${canvasT('inspector_scope_all', '🛑 All Everywhere')}</option>
          <option value="profile" ${scope === 'profile' ? 'selected' : ''}>${canvasT('inspector_scope_profile', '📁 Current Profile Only')}</option>
          <option value="client" ${scope === 'client' ? 'selected' : ''}>${canvasT('inspector_scope_client', '🎯 Selected Client Only')}</option>
        </select>
      </div>
      ${scope === 'client' ? `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('inspector_target_clients', 'Target Client Screens')}</label>
          ${this.renderClientButtonSelector(node)}
        </div>
      ` : ''}
      <div class="inspector-field-group" style="display:flex; align-items:center; gap:8px; margin-top:8px;">
        <input type="checkbox" id="stop-overlay-notice-${node.id}" ${showNotice ? 'checked' : ''} onchange="window.nodeCanvas.updateNodeData('${node.id}', 'showOverlayNotice', this.checked)" style="accent-color:#ef4444; width:16px; height:16px; cursor:pointer;" />
        <label for="stop-overlay-notice-${node.id}" class="inspector-label" style="margin:0; cursor:pointer;">${canvasT('inspector_stop_overlay_notice', 'Show Warning Notice on Desktop Overlay')}</label>
      </div>
    `;
  }

  renderSkillCooldownHelper(node) {
    const presetId = node.data?.cooldownPresetId || '';
    const customMs = node.data?.customCooldownMs || 0;
    const presetsById = window.allCooldownPresetsById || {};
    const isCustom = presetId === 'custom';
    const currentLang = window.currentLang || 'th';
    const trans = (window.TRANSLATIONS && window.TRANSLATIONS[currentLang]) || {
      skillCooldownGuardLabel: 'Skill Cooldown Guard (ระบบป้องกันการกดซ้ำ)',
      customCooldownMsLabel: 'Custom Cooldown (ms)',
      noSkillSelectedText: 'ไม่มี Cooldown Guard (กดตามจังหวะปกติ)',
      clickToSelectSkillHint: 'คลิกเพื่อเลือกสกิล Flyff ป้องกันการกดซ้ำระหว่างติด Cooldown',
      selectSkillBtnText: 'เลือกสกิล',
      changeSkillBtnText: 'เปลี่ยน',
      customCooldownCardTitle: 'กำหนดเวลาเอง (Custom Duration)',
      customCooldownSpecifyHint: 'ระบุเวลาเองในช่องด้านล่าง'
    };

    let cardContent = '';
    if (isCustom) {
      const msText = customMs ? `${customMs}ms (${(customMs / 1000).toFixed(1)}s)` : (trans.customCooldownSpecifyHint || 'ระบุเวลาเองในช่องด้านล่าง');
      cardContent = `
        <div style="width:32px; height:32px; border-radius:8px; background:rgba(168,85,247,0.2); display:flex; align-items:center; justify-content:center; font-size:16px;">⚙️</div>
        <div style="display:flex; flex-direction:column; flex:1;">
          <span style="font-size:13px; font-weight:700; color:#a855f7;">${trans.customCooldownCardTitle || 'กำหนดเวลาเอง (Custom Duration)'}</span>
          <span style="font-size:11px; color:var(--muted);">⏱️ ${msText}</span>
        </div>
        <span style="font-size:12px; color:#a855f7; font-weight:600;">${trans.changeSkillBtnText || 'เปลี่ยน'} ➔</span>
      `;
    } else if (!presetId || !presetsById[presetId]) {
      cardContent = `
        <div style="width:32px; height:32px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center; font-size:16px;">🚫</div>
        <div style="display:flex; flex-direction:column; flex:1;">
          <span style="font-size:13px; font-weight:600; color:var(--text);">${trans.noSkillSelectedText || 'ไม่มี Cooldown Guard'}</span>
          <span style="font-size:11px; color:var(--muted);">${trans.clickToSelectSkillHint || 'คลิกเพื่อเลือกสกิล Flyff ป้องกันกดซ้ำ'}</span>
        </div>
        <span style="font-size:12px; color:var(--primary); font-weight:600;">${trans.selectSkillBtnText || 'เลือกสกิล'} ➔</span>
      `;
    } else {
      const item = presetsById[presetId];
      const effectiveMs = customMs > 0 ? customMs : (item.cooldownMs || 0);
      const isCustomOverride = customMs > 0 && customMs !== item.cooldownMs;
      const cdText = effectiveMs ? `${effectiveMs / 1000}s (${effectiveMs}ms)${isCustomOverride ? ' • Custom' : ''}` : 'No Cooldown';
      const imgHTML = item.image ? `<img src="${item.image}" style="width:32px; height:32px; object-fit:contain; border-radius:6px; background:rgba(0,0,0,0.3); padding:2px; border:1px solid rgba(16,185,129,0.4);" onError="this.style.display='none'">` : `<div style="width:32px; height:32px; border-radius:6px; background:rgba(16,185,129,0.2); display:flex; align-items:center; justify-content:center;">✨</div>`;

      cardContent = `
        ${imgHTML}
        <div style="display:flex; flex-direction:column; flex:1;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:13px; font-weight:700; color:#fff;">${item.name}</span>
            <span style="font-size:10px; background:${isCustomOverride ? 'rgba(168,85,247,0.2)' : 'rgba(16,185,129,0.2)'}; border:1px solid ${isCustomOverride ? 'rgba(168,85,247,0.4)' : 'rgba(16,185,129,0.4)'}; color:${isCustomOverride ? '#a855f7' : '#10b981'}; border-radius:4px; padding:1px 6px; font-weight:700;">⏱️ ${cdText}</span>
          </div>
          <span style="font-size:11px; color:var(--muted);">${item.class || 'Skill'} ${item.description ? '• ' + item.description : ''}</span>
        </div>
        <span style="font-size:12px; color:#10b981; font-weight:600;">${trans.changeSkillBtnText || 'เปลี่ยน'} ➔</span>
      `;
    }

    const border = isCustom ? '#a855f7' : (presetId && presetsById[presetId] ? '#10b981' : 'var(--border)');

    return `
      <div class="inspector-field-group" style="margin-top:10px; border-top:1px dashed rgba(255,255,255,0.08); padding-top:10px;">
        <label class="inspector-label" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <span>⏱️ ${trans.skillCooldownGuardLabel || 'Skill Cooldown Guard (ระบบป้องกันการกดซ้ำ)'}</span>
        </label>
        <div class="custom-skill-select-card ${presetId ? 'active' : ''}"
             onclick="if(window.openSkillPickerModal) window.openSkillPickerModal('${node.id}')"
             style="background:var(--bg-input); border:1px solid ${border}; border-radius:10px; padding:10px 14px; cursor:pointer; display:flex; align-items:center; gap:12px; transition:all 0.2s;">
          ${cardContent}
        </div>
        <div style="display:${presetId ? 'flex' : 'none'}; align-items:center; gap:10px; margin-top:8px; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:8px; padding:6px 12px;">
          <label style="font-size:11px; color:var(--muted); font-weight:600; white-space:nowrap;">
            ⏱️ ${trans.customCooldownMsLabel || 'Custom Cooldown (ms)'}
          </label>
          <input type="number" class="inspector-input" min="0" max="600000" step="100"
                 value="${customMs || ''}"
                 placeholder="${presetId && presetsById[presetId] ? 'Preset: ' + (presetsById[presetId].cooldownMs || 0) + 'ms' : 'e.g. 5000'}"
                 onchange="window.nodeCanvas.updateNodeData('${node.id}', 'customCooldownMs', parseInt(this.value, 10) || 0); window.nodeCanvas.openInspector('${node.id}'); window.nodeCanvas.renderNodes();"
                 style="padding:4px 8px; font-size:12px; flex:1;" />
          <span style="font-size:11px; color:#a855f7; font-weight:bold;">${customMs ? ((customMs / 1000).toFixed(1) + 's') : ''}</span>
        </div>
      </div>
    `;
  }

  renderSoundAlertHelper(node) {
    const isEn = window.currentLang === 'en';
    const source = node.data?.soundSource || 'preset';
    const preset = node.data?.soundPreset || 'ding';
    const url = node.data?.soundUrl || '';
    const file = node.data?.soundFile || '';
    const volume = node.data?.volume !== undefined ? node.data.volume : 100;
    const repeat = node.data?.repeatCount || 1;

    let sourceSpecificHTML = '';
    if (source === 'preset') {
      sourceSpecificHTML = `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('soundPresetLabel', isEn ? 'Sound Preset' : 'เสียงแจ้งเตือนมาตรฐาน')}</label>
          <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'soundPreset', this.value)">
            <option value="ding" ${preset === 'ding' ? 'selected' : ''}>🔔 Ding / Bell</option>
            <option value="alarm" ${preset === 'alarm' ? 'selected' : ''}>🚨 Alarm / Siren</option>
            <option value="laser" ${preset === 'laser' ? 'selected' : ''}>⚡ Laser / High Beep</option>
            <option value="warning" ${preset === 'warning' ? 'selected' : ''}>⚠️ Warning Buzzer</option>
            <option value="success" ${preset === 'success' ? 'selected' : ''}>✅ Success Tone</option>
          </select>
        </div>
      `;
    } else if (source === 'url') {
      sourceSpecificHTML = `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('soundUrlLabel', isEn ? 'Custom Audio URL (.mp3 / .wav)' : 'URL ไฟล์เสียง (.mp3 / .wav)')}</label>
          <input type="text" class="inspector-input" value="${url}" placeholder="https://example.com/sound.mp3" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'soundUrl', this.value)" />
        </div>
      `;
    } else if (source === 'upload') {
      sourceSpecificHTML = `
        <div class="inspector-field-group">
          <label class="inspector-label">${canvasT('soundUploadedFileLabel', isEn ? 'Uploaded Audio File' : 'ไฟล์เสียงที่อัปโหลด')}</label>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="file" accept="audio/*" onchange="window.nodeCanvas.uploadSoundFile('${node.id}', this)" style="display:none;" id="sound-upload-input-${node.id}" />
            <button type="button" class="btn btn-ghost" onclick="document.getElementById('sound-upload-input-${node.id}').click()" style="padding:6px 12px; font-size:12px; border-color:#a855f7; color:#c084fc;">
              📁 ${isEn ? 'Choose Audio File (.mp3, .wav)...' : 'เลือกไฟล์เสียง (.mp3, .wav)...'}
            </button>
            <span style="font-size:11px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">
              ${file ? file.split('/').pop() : (isEn ? 'No file chosen' : 'ยังไม่ได้เลือกไฟล์')}
            </span>
          </div>
        </div>
      `;
    }

    return `
      <div class="inspector-field-group">
        <label class="inspector-label">${canvasT('soundSourceLabel', isEn ? 'Sound Source' : 'แหล่งที่มาของเสียง')}</label>
        <select class="inspector-select" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'soundSource', this.value); window.nodeCanvas.openInspector('${node.id}');">
          <option value="preset" ${source === 'preset' ? 'selected' : ''}>🔔 ${isEn ? 'Built-in Presets' : 'เสียงมาตรฐานในระบบ'}</option>
          <option value="url" ${source === 'url' ? 'selected' : ''}>🌐 ${isEn ? 'Custom Web URL' : 'ลิงก์เว็บ URL'}</option>
          <option value="upload" ${source === 'upload' ? 'selected' : ''}>📁 ${isEn ? 'Upload Local File' : 'อัปโหลดไฟล์ในเครื่อง'}</option>
        </select>
      </div>
      ${sourceSpecificHTML}
      <div class="inspector-field-group">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <label class="inspector-label">${isEn ? `Volume (${volume}%)` : `ระดับเสียง (${volume}%)`}</label>
        </div>
        <input type="range" class="inspector-input" min="0" max="100" value="${volume}" oninput="this.previousElementSibling.firstElementChild.textContent = '${isEn ? 'Volume (' : 'ระดับเสียง ('}' + this.value + '%)'" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'volume', parseInt(this.value, 10))" style="padding:0; height:6px; cursor:pointer;" />
      </div>
      <div class="inspector-field-group">
        <label class="inspector-label">${isEn ? 'Repeat Count (cycles)' : 'เล่นซ้ำ (รอบ)'}</label>
        <input type="number" class="inspector-input" min="1" max="10" value="${repeat}" onchange="window.nodeCanvas.updateNodeData('${node.id}', 'repeatCount', parseInt(this.value, 10))" />
      </div>
      <div style="margin-top:12px;">
        <button type="button" class="btn" onclick="if(window.testAlertSound) window.testAlertSound('${node.id}')" style="width:100%; background:linear-gradient(135deg,#8b5cf6,#6d28d9); color:#fff; font-weight:700; border-radius:8px; padding:8px 0; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
          ▶️ ${isEn ? 'Test Play Audio' : 'ทดสอบเสียง (Test Play)'}
        </button>
      </div>
    `;
  }

  async uploadSoundFile(nodeId, inputEl) {
    if (!inputEl.files || inputEl.files.length === 0) return;
    const file = inputEl.files[0];
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result.split(',')[1];
      try {
        const res = await fetch('/api/sound/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, base64Data })
        });
        const data = await res.json();
        if (data.success && data.url) {
          this.updateNodeData(nodeId, 'soundFile', data.url);
          this.openInspector(nodeId);
          if (typeof window.toast === 'function') {
            window.toast(`📁 อัปโหลดไฟล์เสียง "${data.filename}" เรียบร้อยแล้ว!`, 'success');
          }
        } else {
          if (typeof window.toast === 'function') window.toast(`Upload failed: ${data.error}`, 'error');
        }
      } catch (err) {
        console.error('Audio upload error:', err);
      }
    };
    reader.readAsDataURL(file);
  }

  toggleClientSelection(nodeId, val) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};

    let currentVal = node.data.targetClient || '1';
    let targets = [];
    if (currentVal === 'all' || currentVal === 'both') {
      targets = ['1', '2', '3', '4', '5', '6', '7', '8'];
    } else {
      targets = String(currentVal).split(',').map(s => s.trim()).filter(Boolean);
    }

    if (val === 'all') {
      if (currentVal === 'all') {
        node.data.targetClient = '1';
      } else {
        node.data.targetClient = 'all';
      }
    } else {
      if (targets.includes(val)) {
        targets = targets.filter(t => t !== val);
      } else {
        targets.push(val);
      }

      targets.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

      if (targets.length === 0) {
        node.data.targetClient = '1';
      } else if (targets.length === 8) {
        node.data.targetClient = 'all';
      } else {
        node.data.targetClient = targets.join(',');
      }
    }

    this.renderNodes();
    this.openInspector(node.id);
    this.addHistory('🎯', `เปลี่ยนจอเป้าหมายของ "${node.title || node.type}" เป็น [${node.data.targetClient}]`);
    this.onProfileChanged();
  }

  closeInspector() {
    this.inspectorPanel.classList.remove('open');
  }

  updateNodeData(nodeId, key, value) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (key === 'title') {
      node.title = value;
    } else {
      if (!node.data) node.data = {};
      node.data[key] = value;
    }
    this.renderNodes();
    this.addHistory('⚙️', `แก้ไข ${key} ของโหนด "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  updateNodeKeys(nodeId, valStr) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    node.data.keys = valStr.split(',').map(s => s.trim()).filter(Boolean);
    this.renderNodes();
    this.addHistory('⌨️', `แก้ไขคีย์ [${valStr}] ของโหนด "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  addMacroStep(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    if (!Array.isArray(node.data.steps)) node.data.steps = [];
    node.data.steps.push({ key: '1', delay: 300, holdMs: 0 });
    this.renderNodes();
    this.openInspector(nodeId);
    this.addHistory('🔀', `เพิ่ม Step ใน Macro "${node.title || node.type}"`);
    this.onProfileChanged();
  }

  updateMacroStep(nodeId, stepIndex, field, value) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;
    if (node.data.steps[stepIndex]) {
      node.data.steps[stepIndex][field] = value;
      this.renderNodes();
      this.onProfileChanged();
    }
  }

  deleteMacroStep(nodeId, stepIndex) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;
    node.data.steps.splice(stepIndex, 1);
    this.renderNodes();
    this.openInspector(nodeId);
    this.addHistory('🗑️', `ลบ Step #${stepIndex + 1} ใน Macro`);
    this.onProfileChanged();
  }

  deleteNode(nodeId) {
    const node = this.nodes.find(n => n.id === nodeId);
    const nodeTitle = node ? (node.title || node.type) : 'Node';
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    this.connections = this.connections.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId);
    this.selectedNodeIds.delete(nodeId);
    this.closeInspector();
    this.render();
    this.addHistory('🗑️', `ลบโหนด "${nodeTitle}"`);
    this.onProfileChanged();
  }

  deleteSelectedNodes() {
    const count = this.selectedNodeIds.size;
    if (count === 0) return;

    this.nodes = this.nodes.filter(n => !this.selectedNodeIds.has(n.id));
    this.connections = this.connections.filter(c => !this.selectedNodeIds.has(c.fromNodeId) && !this.selectedNodeIds.has(c.toNodeId));
    this.selectedNodeIds.clear();
    this.closeInspector();
    this.render();
    this.addHistory('🗑️', `ลบ ${count} โหนดที่เลือก`);
    this.onProfileChanged();

    if (typeof window.toast === 'function') {
      window.toast(`🗑️ ลบ ${count} โหนดเรียบร้อยแล้ว`, 'info');
    }
  }

  duplicateSelectedNodes() {
    const count = this.selectedNodeIds.size;
    if (count === 0) return;

    const idMap = new Map();
    const newNodes = [];
    const offset = { x: 30, y: 140 };

    this.selectedNodeIds.forEach(oldId => {
      const original = this.nodes.find(n => n.id === oldId);
      if (!original) return;

      const newId = `node_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      idMap.set(oldId, newId);

      const cloned = JSON.parse(JSON.stringify(original));
      cloned.id = newId;
      if (cloned.data && cloned.data.actionId) {
        cloned.data.actionId = newId;
      }
      cloned.position.x = Math.max(20, Math.round(((cloned.position.x || 0) + offset.x) / 10) * 10);
      cloned.position.y = Math.max(20, Math.round(((cloned.position.y || 0) + offset.y) / 10) * 10);
      newNodes.push(cloned);
    });

    if (newNodes.length === 0) return;

    // Clone internal connections between selected nodes
    const newConnections = [];
    this.connections.forEach(conn => {
      if (idMap.has(conn.fromNodeId) && idMap.has(conn.toNodeId)) {
        newConnections.push({
          id: `conn_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          fromNodeId: idMap.get(conn.fromNodeId),
          fromPort: conn.fromPort,
          toNodeId: idMap.get(conn.toNodeId),
          toPort: conn.toPort
        });
      }
    });

    this.nodes.push(...newNodes);
    this.connections.push(...newConnections);

    // Switch selection to new duplicated nodes
    this.selectedNodeIds.clear();
    newNodes.forEach(n => this.selectedNodeIds.add(n.id));

    this.render();

    if (newNodes.length === 1) {
      this.openInspector(newNodes[0].id);
    } else {
      this.openMultiSelectInspector();
    }

    const desc = newNodes.length === 1 ? `คัดลอก "${newNodes[0].title || newNodes[0].type}"` : `คัดลอก ${newNodes.length} โหนด`;
    this.addHistory('📋', desc);
    this.onProfileChanged();

    if (typeof window.toast === 'function') {
      window.toast(`📋 ${desc} เรียบร้อยแล้ว`, 'success');
    }
  }

  autoAlignNodes() {
    let colX = { trigger: 100, action: 450, target: 800 };
    let rowY = { trigger: 150, action: 150, target: 150 };

    this.nodes.forEach(node => {
      if (node.type === 'trigger') {
        node.position = { x: colX.trigger, y: rowY.trigger };
        rowY.trigger += 180;
      } else {
        node.position = { x: colX.action, y: rowY.action };
        rowY.action += 180;
      }
    });

    this.render();
    this.addHistory('📐', 'จัดเรียง Grid อัตโนมัติ');
    this.onProfileChanged();
  }

  exportProfileData() {
    // Sanitize node data so that each node only keeps properties strictly relevant to its type
    const cleanNodes = this.nodes.map(node => {
      const d = node.data || {};
      const type = node.type;
      let cleanData = { enabled: d.enabled !== false };

      if (type === 'trigger') {
        cleanData.triggerType = d.triggerType || 'keyboard';
        cleanData.triggerValue = d.triggerValue || '1';
      } else if (type === 'key_press') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.keys = Array.isArray(d.keys) ? d.keys : (d.keys ? [d.keys] : ['1']);
        if (d.delayAfter !== undefined && parseInt(d.delayAfter, 10) > 0) {
          cleanData.delayAfter = parseInt(d.delayAfter, 10);
        }
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'loop') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.keys = Array.isArray(d.keys) ? d.keys : (d.keys ? [d.keys] : ['1']);
        cleanData.interval = d.interval !== undefined ? parseInt(d.interval, 10) : 1000;
        if (d.jitter !== undefined && parseInt(d.jitter, 10) > 0) cleanData.jitter = parseInt(d.jitter, 10);
        cleanData.executeImmediately = d.executeImmediately !== false;
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'buff_sequence') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.keys = Array.isArray(d.keys) ? d.keys : (d.keys ? [d.keys] : ['1', '2']);
        cleanData.delayBuff = d.delayBuff !== undefined ? parseInt(d.delayBuff, 10) : 800;
        if (d.delayAfter !== undefined && parseInt(d.delayAfter, 10) > 0) cleanData.delayAfter = parseInt(d.delayAfter, 10);
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'delay') {
        cleanData.delayMs = d.delayMs !== undefined ? parseInt(d.delayMs, 10) : 1000;
      } else if (type === 'branch' || type === 'condition') {
        cleanData.conditionTargetId = d.conditionTargetId || '';
        cleanData.conditionRule = d.conditionRule || 'is_running';
      } else if (type === 'control') {
        cleanData.controlOperation = d.controlOperation || 'toggle';
        cleanData.controlTargetIds = Array.isArray(d.controlTargetIds) ? d.controlTargetIds : (d.controlTargetId ? [d.controlTargetId] : []);
      } else if (type === 'forwarder') {
        cleanData.targetKey = d.targetKey || '1';
        cleanData.targetClient = d.targetClient || 'all';
        if (d.delayActivation) {
          cleanData.delayActivation = true;
          cleanData.activationDelayMs = parseInt(d.activationDelayMs, 10) || 1000;
        }
        if (d.delayAfter !== undefined && parseInt(d.delayAfter, 10) > 0) cleanData.delayAfter = parseInt(d.delayAfter, 10);
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'emergency_stop') {
        cleanData.stopScope = d.stopScope || 'all';
        if (cleanData.stopScope === 'client') cleanData.targetClient = d.targetClient || '1';
        cleanData.showOverlayNotice = d.showOverlayNotice !== false;
      } else if (type === 'sound') {
        cleanData.soundSource = d.soundSource || 'preset';
        cleanData.soundPreset = d.soundPreset || 'ding';
        if (d.soundUrl) cleanData.soundUrl = d.soundUrl;
        if (d.soundFile) cleanData.soundFile = d.soundFile;
        cleanData.volume = d.volume !== undefined ? parseInt(d.volume, 10) : 100;
        if (d.repeatCount && parseInt(d.repeatCount, 10) > 1) cleanData.repeatCount = parseInt(d.repeatCount, 10);
      } else if (type === 'emit_event') {
        cleanData.eventName = d.eventName || 'party_heal';
      } else if (type === 'macro_group') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.repeatCount = d.repeatCount || 1;
        cleanData.steps = Array.isArray(d.steps) ? d.steps : [];
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'key_hold') {
        cleanData.targetKey = d.targetKey || '1';
        cleanData.targetClient = d.targetClient || '1';
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'sequencer') {
        cleanData.modeType = d.modeType || 'loop';
        cleanData.targetClient = d.targetClient || '1';
        cleanData.interval = d.interval !== undefined ? Math.max(0, parseInt(d.interval, 10)) : 1000;
        cleanData.repeatCount = d.repeatCount !== undefined ? Math.max(1, parseInt(d.repeatCount, 10)) : 1;
        cleanData.delayAfter = d.delayAfter !== undefined ? parseInt(d.delayAfter, 10) : 0;
        cleanData.steps = Array.isArray(d.steps) ? d.steps.map(s => {
          const delayVal = s.delay !== undefined ? parseInt(s.delay, 10) : (s.castTimeMs !== undefined ? parseInt(s.castTimeMs, 10) : 800);
          return {
            key: s.key || '1',
            delay: delayVal,
            castTimeMs: delayVal
          };
        }) : [];
        if (d.cooldownPresetId) cleanData.cooldownPresetId = d.cooldownPresetId;
        if (d.customCooldownMs) cleanData.customCooldownMs = parseInt(d.customCooldownMs, 10);
      } else if (type === 'loop_scheduler') {
        cleanData.targetClient = d.targetClient || '1';
        cleanData.collisionGuardMs = d.collisionGuardMs !== undefined ? parseInt(d.collisionGuardMs, 10) : 800;
        cleanData.items = Array.isArray(d.items) ? d.items.map((it, idx) => ({
          id: it.id || `item_${idx}`,
          name: it.name || `Skill ${idx + 1}`,
          interval: Math.max(50, parseInt(it.interval, 10) || 3000),
          jitter: Math.max(0, parseInt(it.jitter, 10) || 0),
          executeImmediately: it.executeImmediately !== false,
          enabled: it.enabled !== false
        })) : [];
      }

      let actionId = d.actionId || (node.id.startsWith('node_') ? node.id.replace('node_', '') : node.id);
      if (actionId.startsWith('node_')) actionId = actionId.replace('node_', '');
      cleanData.actionId = actionId;

      return {
        id: node.id,
        type: node.type,
        title: node.title,
        position: node.position,
        data: cleanData
      };
    });

    return {
      version: '3.1.0',
      canvas: {
        zoom: this.zoom,
        pan: this.pan
      },
      nodes: cleanNodes,
      connections: this.connections
    };
  }

  isNodeReferencedRemotely(node) {
    if (!node) return false;
    const targetIds = [node.id, node.data?.actionId].filter(Boolean);

    return this.nodes.some(n => {
      if (n.id === node.id) return false;
      // 1. Check Action Controller Remote Target
      if (n.type === 'control') {
        const cTargets = n.data?.controlTargetIds || (n.data?.controlTargetId ? [n.data.controlTargetId] : []);
        if (cTargets && cTargets.length > 0 && targetIds.some(tid => cTargets.includes(tid))) {
          return true;
        }
      }
      // 2. Check Branch / Condition Remote Target
      if (n.type === 'branch' || n.type === 'condition') {
        if (n.data?.conditionTargetId && targetIds.includes(n.data.conditionTargetId)) {
          return true;
        }
      }
      return false;
    });
  }

  getNodeValidationIssue(node) {
    if (!node) return null;

    // If node is disabled, do not show validation warnings (inactive draft)
    if (node.data?.enabled === false) {
      return null;
    }

    // 1. Trigger Node Validation
    if (node.type === 'trigger') {
      const trigType = node.data?.triggerType || 'keyboard';
      const trigVal = String(node.data?.triggerValue || '').trim();

      if (!trigVal) {
        return {
          severity: 'error',
          messageTh: trigType === 'event' ? 'ยังไม่ได้ระบุชื่อ Event ที่รอรับ' : 'ยังไม่ได้กำหนดปุ่มทริกเกอร์',
          messageEn: trigType === 'event' ? 'No Event Name configured' : 'No Trigger Hotkey configured'
        };
      }

      const hasOutgoing = this.connections.some(c => c.fromNodeId === node.id);
      if (!hasOutgoing) {
        return {
          severity: 'warning',
          messageTh: 'ทริกเกอร์ยังไม่ได้เชื่อมต่อกับ Action ใดๆ',
          messageEn: 'Trigger is not connected to any Action'
        };
      }
      return null;
    }

    // 2. Action Nodes: Check if unconnected from inputs (exec_in)
    // Validate that action nodes (including emergency_stop) receive an incoming trigger or remote reference
    const isReferenced = this.isNodeReferencedRemotely(node);

    if (!isReferenced) {
      const hasIncoming = this.connections.some(c => c.toNodeId === node.id);
      if (!hasIncoming) {
        return {
          severity: 'warning',
          messageTh: 'ไม่ได้เชื่อมต่อสัญญาณเข้า (exec_in)',
          messageEn: 'No Input Trigger Connection (exec_in)'
        };
      }
    }

    // 3. Action Nodes: Check required configurations
    if (node.type === 'key_press' || node.type === 'loop') {
      const hasKeys = (Array.isArray(node.data?.keys) && node.data.keys.length > 0) || (node.data?.targetKey && String(node.data.targetKey).trim());
      if (!hasKeys) {
        return {
          severity: 'error',
          messageTh: 'ยังไม่ได้ตั้งค่าปุ่มคีย์ที่ต้องการกด',
          messageEn: 'No Key configured to press'
        };
      }
    } else if (node.type === 'buff_sequence') {
      const hasKeys = (Array.isArray(node.data?.keys) && node.data.keys.length > 0) || (node.data?.targetKey && String(node.data.targetKey).trim());
      if (!hasKeys) {
        return {
          severity: 'error',
          messageTh: 'ยังไม่ได้ตั้งค่าชุดสกิลที่ต้องการกด',
          messageEn: 'No Skill Keys configured'
        };
      }
    } else if (node.type === 'control') {
      const targets = Array.isArray(node.data?.controlTargetIds) ? node.data.controlTargetIds : (node.data?.controlTargetId ? [node.data.controlTargetId] : []);
      if (!targets || targets.length === 0) {
        return {
          severity: 'warning',
          messageTh: 'ยังไม่ได้เลือก Action เป้าหมายที่ต้องการควบคุม',
          messageEn: 'No target actions selected to control'
        };
      }
    } else if (node.type === 'forwarder') {
      const hasTargetKey = (node.data?.targetKey && String(node.data.targetKey).trim()) || (Array.isArray(node.data?.keys) && node.data.keys.length > 0);
      if (!hasTargetKey) {
        return {
          severity: 'error',
          messageTh: 'ยังไม่ได้ระบุปุ่มที่จะส่งต่อ (Target Key)',
          messageEn: 'No Forward Target Key configured'
        };
      }
    } else if (node.type === 'emit_event') {
      const hasEvent = node.data?.eventName && String(node.data.eventName).trim();
      if (!hasEvent) {
        return {
          severity: 'error',
          messageTh: 'ยังไม่ได้ระบุชื่อ Event ที่จะส่ง',
          messageEn: 'No Event Name specified'
        };
      }
    } else if (node.type === 'branch' || node.type === 'condition') {
      if (!node.data?.conditionTargetId) {
        return {
          severity: 'warning',
          messageTh: 'ยังไม่ได้เลือก Action อ้างอิง',
          messageEn: 'No Reference Action selected'
        };
      }
      const hasBranchOutputs = this.connections.some(c => c.fromNodeId === node.id && (
        c.fromPort === 'onTrue' || c.fromPort === 'on_true' ||
        c.fromPort === 'onFalse' || c.fromPort === 'on_false'
      ));
      if (!hasBranchOutputs) {
        return {
          severity: 'warning',
          messageTh: 'เงื่อนไขยังไม่ได้ต่อสาย Output (True/False)',
          messageEn: 'Branch outputs (True/False) not connected'
        };
      }
    } else if (node.type === 'macro_group') {
      const steps = node.data?.steps || [];
      if (!steps || steps.length === 0) {
        return {
          severity: 'warning',
          messageTh: 'Macro Queue ยังไม่มี Step คำสั่ง',
          messageEn: 'Macro Queue has no steps'
        };
      }
    }

    return null;
  }

  showNodeCatalog(clientX, clientY, worldPos = null) {
    if (!this.spotlightCatalog) return;
    this.catalogPendingPos = worldPos;

    // Calculate position relative to container
    const containerRect = this.container.getBoundingClientRect();
    let posX = (clientX !== undefined ? clientX : (containerRect.left + containerRect.width / 2)) - containerRect.left;
    let posY = (clientY !== undefined ? clientY : (containerRect.top + containerRect.height / 2)) - containerRect.top;

    // Boundary constraints
    const menuWidth = 340;
    const menuHeight = 440;
    if (posX + menuWidth > containerRect.width - 20) {
      posX = Math.max(20, containerRect.width - menuWidth - 20);
    }
    if (posY + menuHeight > containerRect.height - 20) {
      posY = Math.max(20, containerRect.height - menuHeight - 30);
    }

    this.spotlightCatalog.style.left = `${Math.max(20, posX)}px`;
    this.spotlightCatalog.style.top = `${Math.max(20, posY)}px`;
    this.spotlightCatalog.style.display = 'flex';

    if (this.spotlightInput) {
      this.spotlightInput.value = '';
      setTimeout(() => this.spotlightInput.focus(), 50);
    }
    this.renderSpotlightCatalog('');
  }

  hideNodeCatalog() {
    if (this.spotlightCatalog) {
      this.spotlightCatalog.style.display = 'none';
      this.catalogPendingPos = null;
    }
  }

  toggleNodeCatalog(triggerEl = null) {
    if (!this.spotlightCatalog) return;
    if (this.spotlightCatalog.style.display === 'none' || !this.spotlightCatalog.style.display) {
      let clientX, clientY;
      if (triggerEl && typeof triggerEl.getBoundingClientRect === 'function') {
        const rect = triggerEl.getBoundingClientRect();
        clientX = rect.left + rect.width / 2 - 170;
        clientY = rect.top - 460;
      }
      this.showNodeCatalog(clientX, clientY, null);
    } else {
      this.hideNodeCatalog();
    }
  }

  filterSpotlight(query) {
    this.renderSpotlightCatalog(query);
  }

  renderSpotlightCatalog(query = '') {
    if (!this.spotlightBody) return;
    const q = (query || '').toLowerCase().trim();

    const categories = [
      {
        id: 'triggers',
        name: canvasT('cat_triggers', '⚡ Triggers & Events'),
        items: [
          { type: 'trigger', icon: '⚡', name: this.getNodeTypeLabel('trigger'), desc: canvasT('node_desc_trigger', 'Starts flow on hotkey or event') },
          { type: 'emit_event', icon: '📡', name: this.getNodeTypeLabel('emit_event'), desc: canvasT('node_desc_emit_event', 'Broadcasts custom event to active profiles') }
        ]
      },
      {
        id: 'actions',
        name: canvasT('cat_actions', '🎮 Actions & Macros'),
        items: [
          { type: 'loop', icon: '🔄', name: this.getNodeTypeLabel('loop'), desc: canvasT('node_desc_loop', 'Continuously loops key sequence with timing') },
          { type: 'loop_scheduler', icon: '⏱️', name: this.getNodeTypeLabel('loop_scheduler'), desc: canvasT('node_desc_loop_scheduler', 'Independent multi-timer dispatcher with anti-collision guard queue') },
          { type: 'sequencer', icon: '⚔️', name: this.getNodeTypeLabel('sequencer'), desc: canvasT('node_desc_sequencer', 'Executes skills & instant items in sequence with animation delays') },
          { type: 'buff_sequence', icon: '🛡️', name: this.getNodeTypeLabel('buff_sequence'), desc: canvasT('node_desc_buff_sequence', 'Executes combo skill queue sequentially') },
          { type: 'key_press', icon: '⌨️', name: this.getNodeTypeLabel('key_press'), desc: canvasT('node_desc_key_press', 'Sends a single keypress with delay') },
          { type: 'forwarder', icon: '🔗', name: this.getNodeTypeLabel('forwarder'), desc: canvasT('node_desc_forwarder', 'Forwards key to multiple game clients') },
          { type: 'macro_group', icon: '🔀', name: this.getNodeTypeLabel('macro_group'), desc: canvasT('node_desc_buff_sequence', 'Step-by-step combo macro sequences') },
          { type: 'key_hold', icon: '⚓', name: this.getNodeTypeLabel('key_hold'), desc: canvasT('node_desc_key_hold', 'Toggle hold key down in game client') }
        ]
      },
      {
        id: 'flow',
        name: canvasT('cat_flow', '🌿 Logic & Timing'),
        items: [
          { type: 'branch', icon: '🌿', name: this.getNodeTypeLabel('branch'), desc: canvasT('node_desc_branch', 'Branches execution based on condition') },
          { type: 'control', icon: '🎛️', name: this.getNodeTypeLabel('control'), desc: canvasT('node_desc_control', 'Toggles, starts, or stops other actions') },
          { type: 'delay', icon: '⏱️', name: this.getNodeTypeLabel('delay'), desc: canvasT('node_desc_delay', 'Pauses flow for specified duration') }
        ]
      },
      {
        id: 'utilities',
        name: canvasT('cat_utilities', '🛡️ Safety & Sound'),
        items: [
          { type: 'emergency_stop', icon: '🛑', name: this.getNodeTypeLabel('emergency_stop'), desc: canvasT('node_desc_emergency_stop', 'Immediately stops active actions') },
          { type: 'sound', icon: '🔊', name: this.getNodeTypeLabel('sound'), desc: canvasT('node_desc_sound', 'Plays customizable audio alert') }
        ]
      }
    ];

    let html = '';
    let totalFound = 0;

    categories.forEach(cat => {
      const filtered = cat.items.filter(item => {
        if (!q) return true;
        return item.name.toLowerCase().includes(q) || item.type.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
      });

      if (filtered.length > 0) {
        totalFound += filtered.length;
        html += `
          <div class="spotlight-section">
            <div class="spotlight-category-title">${cat.name}</div>
            <div class="spotlight-grid">
              ${filtered.map(item => `
                <div class="spotlight-node-card" onclick="window.nodeCanvas.addNodeFromSpotlight('${item.type}')">
                  <span class="spotlight-node-icon">${item.icon}</span>
                  <div class="spotlight-node-info">
                    <span class="spotlight-node-name">${item.name}</span>
                    <span class="spotlight-node-desc">${item.desc}</span>
                  </div>
                  <span class="spotlight-node-plus">+</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    });

    if (totalFound === 0) {
      html = `
        <div style="font-size:12px; color:var(--muted); text-align:center; padding:32px 16px;">
          ${window.currentLang === 'en' ? `No nodes found matching "${query}"` : `ไม่พบคำสั่งที่ตรงกับ "${query}"`}
        </div>
      `;
    }

    this.spotlightBody.innerHTML = html;
  }

  addNodeFromSpotlight(type) {
    const pos = this.catalogPendingPos;
    this.hideNodeCatalog();
    this.addNodeFromPalette(type, pos);
  }

  updatePaletteLabels() {
    const addBtnLbl = document.getElementById('lbl-palette-add-btn');
    if (addBtnLbl) addBtnLbl.textContent = canvasT('palette_add_node', '➕ Add Node');

    const qTrig = document.getElementById('quick-btn-trigger');
    if (qTrig) qTrig.title = canvasT('palette_quick_trigger', 'Global Trigger');

    const qLoop = document.getElementById('quick-btn-loop');
    if (qLoop) qLoop.title = canvasT('palette_quick_loop', 'Repeat Loop');

    const qBuff = document.getElementById('quick-btn-buff');
    if (qBuff) qBuff.title = canvasT('palette_quick_buff', 'Buff Sequence');

    const qKey = document.getElementById('quick-btn-key');
    if (qKey) qKey.title = canvasT('palette_quick_key', 'Single Key');

    const searchInput = document.getElementById('spotlight-search-input');
    if (searchInput) searchInput.placeholder = canvasT('palette_search_placeholder', 'Search node or action...');

    const outlinerTab = document.getElementById('lbl-drawer-tab-outliner');
    if (outlinerTab) outlinerTab.textContent = window.currentLang === 'en' ? 'Actions' : 'รายการคำสั่ง';

    const historyTab = document.getElementById('lbl-drawer-tab-history');
    if (historyTab) historyTab.textContent = window.currentLang === 'en' ? 'History' : 'ประวัติแก้ไข';

    const outlinerSearch = document.getElementById('outliner-search-input');
    if (outlinerSearch) outlinerSearch.placeholder = window.currentLang === 'en' ? '🔍 Search Action, Key, Type...' : '🔍 ค้นหา Action, Key, Type...';

    const histHint = document.getElementById('lbl-history-hint');
    if (histHint) histHint.textContent = window.currentLang === 'en' ? 'Click entry to restore point' : 'คลิกรายการเพื่อย้อนเวลา (Restore)';

    const clearHistBtn = document.getElementById('btn-clear-history');
    if (clearHistBtn) {
      clearHistBtn.title = window.currentLang === 'en' ? 'Clear History' : 'ล้างประวัติ';
      clearHistBtn.textContent = window.currentLang === 'en' ? '🗑️ Clear' : '🗑️ ล้าง';
    }

    if (this.spotlightCatalog && this.spotlightCatalog.style.display !== 'none') {
      this.renderSpotlightCatalog(this.spotlightInput ? this.spotlightInput.value : '');
    }
  }

  updateLanguage(lang) {
    this.updatePaletteLabels();
    this.renderNodes();
    this.renderOutliner();
    this.renderHistory();

    if (this.selectedNodeIds.size === 1) {
      const singleId = Array.from(this.selectedNodeIds)[0];
      this.openInspector(singleId);
    } else if (this.selectedNodeIds.size > 1) {
      this.openMultiSelectInspector();
    } else {
      const formBody = this.container ? this.container.querySelector('#inspector-form-body') : null;
      const titleEl = this.container ? this.container.querySelector('#inspector-node-title') : null;
      if (titleEl) titleEl.innerHTML = `⚙️ ${canvasT('inspector_title', 'Node Inspector')}`;
      if (formBody) {
        formBody.innerHTML = `
          <div style="color:var(--muted); font-size:12px; text-align:center; padding:20px 0;">
            ${window.currentLang === 'en' ? 'Select a node on the canvas to configure parameters.' : 'เลือก Node บน Canvas เพื่อแก้ไขค่าและคุณสมบัติ'}
          </div>
        `;
      }
    }
  }
}

window.NodeCanvasEditor = NodeCanvasEditor;

window.triggerCanvasNodePulse = (actionIdOrNodeId, fromPort = null) => {
  if (!window.nodeCanvas) return;
  const node = window.nodeCanvas.nodes.find(n => n.id === actionIdOrNodeId || n.data?.actionId === actionIdOrNodeId);
  if (node) {
    window.nodeCanvas.triggerSignalPulse(node.id, fromPort);
  }
};
