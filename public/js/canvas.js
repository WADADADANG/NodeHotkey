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
if (typeof window !== 'undefined') window.canvasT = canvasT;
  return fallback || key;
}

class NodeCanvasEditor {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`[NodeCanvasEditor] Container #${containerId} not found`);
      return;
    }

    this.onProfileChanged = options.onProfileChanged || function () { };

    this.zoom = 1.0;
    this.pan = { x: 0, y: 0 };
    this.nodes = [];
    this.connections = [];

    // Blueprint Variables state
    this.variables = [];
    this.variablesSearchQuery = '';

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
      branch: canvasT('canvas_branch', isEn ? 'Action Branch' : 'เงื่อนไขสถานะ Action'),
      action_branch: canvasT('canvas_action_branch', isEn ? 'Action Branch' : 'เงื่อนไขสถานะ Action'),
      var_branch: canvasT('canvas_var_branch', isEn ? 'Variable Branch' : 'เงื่อนไขตัวแปร'),
      variable_branch: canvasT('canvas_var_branch', isEn ? 'Variable Branch' : 'เงื่อนไขตัวแปร'),
      condition: canvasT('canvas_condition', isEn ? 'Action Branch' : 'เงื่อนไขสถานะ Action'),
      control: canvasT('canvas_control', isEn ? 'Action Control' : 'ควบคุม (Control)'),
      delay: canvasT('canvas_delay', isEn ? 'Delay Timer' : 'หน่วงเวลา (Delay)'),
      emergency_stop: canvasT('canvas_emergency_stop', isEn ? 'Emergency Stop' : 'หยุดฉุกเฉิน (Stop All)'),
      sound: canvasT('canvas_sound', isEn ? 'Sound Alert' : 'เสียงแจ้งเตือน (Sound)'),
      key_hold: canvasT('canvas_key_hold', isEn ? 'Key Hold' : 'กดค้าง (Hold)'),
      sequencer: canvasT('canvas_sequencer', isEn ? 'Cast Sequencer' : 'จัดคิวสกิล (Sequencer)'),
      loop_scheduler: canvasT('canvas_loop_scheduler', isEn ? 'Loop Scheduler' : 'ตารางลูปกันชน (Scheduler)'),
      step_log: canvasT('canvas_step_log', isEn ? 'Log Message' : 'บันทึกข้อความ (Log Message)'),
      var_get: canvasT('canvas_var_get', isEn ? 'Get Variable' : 'อ่านค่าตัวแปร (Get Var)'),
      var_set: canvasT('canvas_var_set', isEn ? 'Set Variable' : 'กำหนดค่าตัวแปร (Set Var)'),
      variable: canvasT('canvas_variable', isEn ? 'Variable / State' : 'ตัวแปร / สถานะ (Variable)'),
      party_scanner: canvasT('canvas_party_scanner', isEn ? 'Party Scanner' : 'สแกนปาร์ตี้กลาง (Party Scanner)'),
      party_slot: canvasT('canvas_party_slot', isEn ? 'Select Party Slot' : 'เลือกสมาชิกปาร์ตี้ (Select Slot)'),
      party_heal: canvasT('canvas_party_heal', isEn ? 'Party Heal Target' : 'เลือกเป้าหมายฮีล (Party Heal)'),
      party_buff: canvasT('canvas_party_buff', isEn ? 'Party Buff Target' : 'วนเลือกเป้าหมายบัฟ (Party Buff)'),
      tts: canvasT('canvas_tts', isEn ? 'Text to Speech (TTS)' : 'อ่านข้อความเสียง (TTS)'),
      screenshot: canvasT('canvas_screenshot', isEn ? 'Screenshot' : 'ถ่ายภาพหน้าจอ (Screenshot)'),
      webhook_out: canvasT('canvas_webhook_out', isEn ? 'HTTP Webhook' : 'ส่ง Webhook / HTTP'),
      format_text: canvasT('canvas_format_text', isEn ? 'Format Text' : 'รวมข้อความ (Format Text)')
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
            <button class="panel-tab-btn" id="tab-btn-variables" onclick="window.nodeCanvas.switchDrawerTab('variables')">📦 <span id="lbl-drawer-tab-variables">${window.currentLang === 'en' ? 'Variables' : 'ตัวแปร'}</span> (<span id="variables-count">0</span>)</button>
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

        <!-- Tab 2: Blueprint Variables Body -->
        <div id="drawer-variables-body" style="display:none; flex-direction:column; flex:1; overflow:hidden;">
          <div class="variables-toolbar">
            <button type="button" class="btn-add-variable-hero" onclick="window.nodeCanvas.openVariableModal()">
              <span>➕ ${canvasT('btn_add_variable', 'สร้างตัวแปรใหม่ (Add Variable)')}</span>
            </button>
            <input type="text" class="outliner-search-input" id="variables-search-input" placeholder="${canvasT('var_search_placeholder', '🔍 ค้นหาตัวแปร...')}" oninput="window.nodeCanvas.filterVariables(this.value)" />
          </div>
          <div class="variables-list" id="variables-list"></div>
        </div>

        <!-- Tab 3: History Timeline Body -->
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
        <button class="canvas-tool-btn" id="btn-toggle-variables" onclick="window.nodeCanvas.togglePanel('variables')" title="Blueprint Variables (Ctrl+B)" style="font-weight:700;">📦</button>
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

      <!-- Blender-Style Add Node Menu Popover -->
      <div class="node-spotlight-catalog blender-add-menu" id="node-spotlight-catalog" style="display:none;">
        <div class="spotlight-search-header">
          <span class="spotlight-search-icon">🔍</span>
          <input type="text" class="spotlight-search-input" id="spotlight-search-input" placeholder="${canvasT('palette_search_placeholder', 'Search... (Shift+A)')}" oninput="window.nodeCanvas.filterSpotlight(this.value)" />
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
    this.tabBtnVariables = this.container.querySelector('#tab-btn-variables');
    this.tabBtnHistory = this.container.querySelector('#tab-btn-history');
    this.drawerOutlinerBody = this.container.querySelector('#drawer-outliner-body');
    this.drawerVariablesBody = this.container.querySelector('#drawer-variables-body');
    this.drawerHistoryBody = this.container.querySelector('#drawer-history-body');
    this.variablesListEl = this.container.querySelector('#variables-list');
    this.variablesCountEl = this.container.querySelector('#variables-count');
    this.variablesSearchInput = this.container.querySelector('#variables-search-input');
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
          this.updateNodeSelectionClasses();
          this.closeInspector();
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
      this.lastMousePos = { clientX: e.clientX, clientY: e.clientY, world: worldPos };

      // Auto-recover from stuck pan/drag when mouseup occurred outside window/iframe
      if (this.isPanning && (e.buttons & 2) === 0) {
        this.isPanning = false;
        this.viewport.classList.remove('panning');
      }
      if (this.isBoxSelecting && (e.buttons & 1) === 0) {
        this.isBoxSelecting = false;
        if (this.selectionBoxEl) {
          this.selectionBoxEl.remove();
          this.selectionBoxEl = null;
        }
      }
      if (this.isDraggingNodes && (e.buttons & 1) === 0) {
        this.isDraggingNodes = false;
        this.hasActuallyDraggedNodes = false;
        this.dragInitialPositions.clear();
      }

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

        // Threshold of 8px to prevent micro-drags during click
        if (Math.hypot(dx, dy) > 8) {
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

        const elemUnder = document.elementFromPoint(e.clientX, e.clientY);
        const portUnder = elemUnder ? elemUnder.closest('.node-port.port-in') : null;
        if (portUnder && portUnder.classList.contains('port-invalid-target')) {
          this.draftWire.isInvalid = true;
        } else {
          this.draftWire.isInvalid = false;
        }

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

        this.updateNodeSelectionClasses();

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

        let anyNodeReallyMoved = false;
        if (didMove) {
          this.selectedNodeIds.forEach(nodeId => {
            const node = this.nodes.find(n => n.id === nodeId);
            const initial = this.dragInitialPositions.get(nodeId);
            if (node && initial) {
              if (Math.abs(node.position.x - initial.x) >= 10 || Math.abs(node.position.y - initial.y) >= 10) {
                anyNodeReallyMoved = true;
              } else {
                // Snap back tiny micro-movement
                node.position.x = initial.x;
                node.position.y = initial.y;
                const nodeEl = this.nodesLayer.querySelector(`.canvas-node[data-id="${nodeId}"]`);
                if (nodeEl) {
                  nodeEl.style.left = `${node.position.x}px`;
                  nodeEl.style.top = `${node.position.y}px`;
                }
              }
            }
          });
        }

        this.dragInitialPositions.clear();
        if (anyNodeReallyMoved) {
          this.renderWires();
          const count = this.selectedNodeIds.size;
          if (count === 1) {
            const singleNode = this.nodes.find(n => this.selectedNodeIds.has(n.id));
            const name = singleNode ? (singleNode.title || singleNode.type) : 'โหนด';
            this.addHistory('📍', `ย้ายตำแหน่งโหนด "${name}"`, true, `พิกัดใหม่ (x: ${singleNode?.position.x}, y: ${singleNode?.position.y})`);
          } else {
            this.addHistory('📍', `ย้ายตำแหน่งกลุ่ม ${count} โหนดพร้อมกัน`, true);
          }
          this.onProfileChanged();
        }
      }

      // Finalize Wire Drafting
      if (this.draftWire) {
        this.draftWire = null;
        this.clearPortHighlights();
        this.renderWires();
      }
    });

    // Safety resets on window blur, mouseenter, or focus loss
    const resetCanvasDragStates = () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.viewport.classList.remove('panning');
      }
      if (this.isBoxSelecting) {
        this.isBoxSelecting = false;
        if (this.selectionBoxEl) {
          this.selectionBoxEl.remove();
          this.selectionBoxEl = null;
        }
      }
      if (this.isDraggingNodes) {
        this.isDraggingNodes = false;
        this.hasActuallyDraggedNodes = false;
        this.dragInitialPositions.clear();
      }
      if (this.draftWire) {
        this.draftWire = null;
        this.clearPortHighlights();
        this.renderWires();
      }
    };

    window.addEventListener('blur', resetCanvasDragStates);
    window.addEventListener('mouseenter', (e) => {
      if (e.buttons === 0) resetCanvasDragStates();
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

      // Blender Shortcut: Shift + A to Add Node at Cursor Position
      if (e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        const clientX = this.lastMousePos ? this.lastMousePos.clientX : window.innerWidth / 2 - 160;
        const clientY = this.lastMousePos ? this.lastMousePos.clientY : window.innerHeight / 2 - 200;
        const worldPos = this.lastMousePos ? this.lastMousePos.world : this.clientToWorld(clientX, clientY);
        this.showNodeCatalog(clientX, clientY, worldPos);
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.togglePanel('outliner');
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        this.togglePanel('history');
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.togglePanel('variables');
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
    this.variables = Array.isArray(profile.variables) ? JSON.parse(JSON.stringify(profile.variables)) : [];
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
    this.getAvailableVariables();
    this.renderVariablesPanel();
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
    const isEn = (typeof window !== 'undefined' && window.currentLang === 'en');
    this.nodes.forEach(node => {
      const nodeEl = document.createElement('div');
      const isSelected = this.selectedNodeIds.has(node.id);
      const isPure = (node.type === 'var_get' || node.type === 'format_text' || node.isPure);
      const pureTypeClass = isPure ? `pure-node pure-${node.data?.varType || (node.type === 'format_text' ? 'string' : 'string')}` : '';
      nodeEl.className = `canvas-node ${isSelected ? 'selected' : ''} ${pureTypeClass}`.trim();
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
        action_branch: '⚡',
        var_branch: '📦',
        variable_branch: '📦',
        condition: '🌿',
        control: '🎛️',
        forwarder: '🔗',
        macro_group: '🔀',
        emergency_stop: '🛑',
        sound: '🔊',
        emit_event: '📡',
        sequencer: '⚔️',
        loop_scheduler: '⏱️',
        step_log: '📝',
        var_get: '📥',
        var_set: '📦',
        variable: '📦',
        party_scanner: '👁️',
        party_slot: '🎯',
        party_heal: '🚑',
        party_buff: '📜',
        tts: '🗣️',
        screenshot: '📸',
        webhook_out: '🌐',
        format_text: '🧩'
      };

      const def = window.clientNodeRegistry ? window.clientNodeRegistry.get(node.type) : null;
      const icon = (def && def.icon) || iconMap[node.type] || '📦';

      let bodyHTML = '';
      if (window.CanvasComponents && typeof window.CanvasComponents.renderCardSummary === 'function') {
        const autoSummary = window.CanvasComponents.renderCardSummary(node, def);
        if (autoSummary) {
          bodyHTML = autoSummary;
        }
      }

      if (!bodyHTML) {
      if (node.type === 'trigger') {
        const isEventTrigger = node.data?.triggerType === 'event';
        const isWebhookTrigger = node.data?.triggerType === 'webhook';
        let trigTypeLabel = 'keyboard';
        if (isWebhookTrigger) trigTypeLabel = 'Webhook (Inbound)';
        else if (isEventTrigger) trigTypeLabel = 'Custom Event';
        else trigTypeLabel = node.data?.triggerType || 'keyboard';

        const colorStyle = isWebhookTrigger ? 'color:#38bdf8; font-weight:700;' : (isEventTrigger ? 'color:#06b6d4; font-weight:700;' : '');
        bodyHTML = `
          <div class="node-info-row">
            <span>Type:</span> <span class="node-info-value" style="${colorStyle}">${trigTypeLabel}</span>
          </div>
          <div class="node-info-row">
            <span>${isWebhookTrigger ? 'Endpoint:' : (isEventTrigger ? 'Event:' : 'Key/Val:')}</span> <span class="node-info-value" style="${colorStyle}">${node.data?.triggerValue || '-'}</span>
          </div>
        `;
      } else if (node.type === 'webhook_out') {
        const method = (node.data?.method || 'POST').toUpperCase();
        let displayUrl = node.data?.url || '-';
        if (displayUrl.length > 28) displayUrl = displayUrl.substring(0, 26) + '...';
        bodyHTML = `
          <div class="node-info-row">
            <span>Method:</span> <span class="node-info-value" style="color:#38bdf8; font-weight:700;">${method}</span>
          </div>
          <div class="node-info-row">
            <span>URL:</span> <span class="node-info-value" title="${node.data?.url || ''}" style="color:#cbd5e1; font-family:'JetBrains Mono',monospace; font-size:10px;">${displayUrl}</span>
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
      } else if (node.type === 'action_branch' || node.type === 'branch' || node.type === 'condition') {
        const targetAction = this.nodes.find(n => n.id === node.data?.conditionTargetId);
        const targetName = targetAction ? (targetAction.title || targetAction.type) : (node.data?.conditionTargetId ? 'Action' : (isEn ? '(None)' : '(ไม่มี)'));
        const rule = node.data?.conditionRule || 'is_running';
        const ruleMap = {
          is_running: isEn ? '🟢 Running' : '🟢 กำลังทำงาน',
          is_stopped: isEn ? '🔴 Stopped' : '🔴 หยุดทำงาน',
          on_cooldown: isEn ? '⏳ Cooldown' : '⏳ ติดคูลดาวน์',
          is_ready: isEn ? '🛡️ Ready' : '🛡️ พร้อมใช้งาน'
        };
        const ruleLabel = ruleMap[rule] || (isEn ? '🟢 Running' : '🟢 กำลังทำงาน');
        bodyHTML = `
          <div class="node-info-row">
            <span>${isEn ? 'Target:' : 'เป้าหมาย:'}</span> <span class="node-info-value" style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${targetName}">${targetName}</span>
          </div>
          <div class="node-info-row">
            <span>${isEn ? 'Rule:' : 'เงื่อนไข:'}</span> <span class="node-info-value">${ruleLabel}</span>
          </div>
        `;
      } else if (node.type === 'var_branch' || node.type === 'variable_branch') {
        const targetId = node.data?.conditionTargetId || (node.data?.varName ? `var:${node.data.varName}` : '');
        const varName = targetId.startsWith('var:') ? targetId.replace('var:', '') : (node.data?.varName || targetId || (isEn ? '(None)' : '(ไม่มี)'));
        const rule = node.data?.conditionRule || 'is_true';
        const ruleMap = {
          is_true: isEn ? '🟢 True' : '🟢 เป็นจริง',
          is_false: isEn ? '🔴 False' : '🔴 เป็นเท็จ',
          equals: '==',
          not_equals: '!=',
          greater_than: '>',
          less_than: '<',
          greater_or_equal: '>=',
          less_or_equal: '<='
        };
        const ruleLabel = ruleMap[rule] || rule;
        const valStr = (node.data?.conditionValue !== undefined && node.data?.conditionValue !== '') ? ` (${node.data.conditionValue})` : '';
        bodyHTML = `
          <div class="node-info-row">
            <span>${isEn ? 'Var:' : 'ตัวแปร:'}</span> <span class="node-info-value" style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${varName}">${varName}</span>
          </div>
          <div class="node-info-row">
            <span>${isEn ? 'Rule:' : 'เงื่อนไข:'}</span> <span class="node-info-value">${ruleLabel}${valStr}</span>
          </div>
        `;
      } else if (node.type === 'party_scanner') {
        const interval = node.data?.scanIntervalMs || 250;
        const hpThresh = node.data?.lowHpThreshold || 70;
        bodyHTML = `
          <div class="node-info-row">
            <span>Client:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
          <div class="node-info-row">
            <span>Interval:</span> <span class="node-info-value" style="color:#06b6d4; font-weight:700;">${interval}ms</span>
          </div>
          <div class="node-info-row">
            <span>Low HP Alert:</span> <span class="node-info-value" style="color:#ef4444; font-weight:700;">&le; ${hpThresh}%</span>
          </div>
        `;
      } else if (node.type === 'party_slot') {
        const slotNum = node.data?.targetSlot || 1;
        const delay = node.data?.delayAfterClick || 80;
        bodyHTML = `
          <div class="node-info-row">
            <span>Client:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
          <div class="node-info-row">
            <span>Slot:</span> <span class="node-info-value" style="color:#10b981; font-weight:700;">Slot ${slotNum}</span>
          </div>
          <div class="node-info-row">
            <span>Delay:</span> <span class="node-info-value">${delay}ms</span>
          </div>
        `;
      } else if (node.type === 'party_heal') {
        const hpThresh = node.data?.lowHpThreshold || 70;
        const delay = node.data?.delayAfterClick || 80;
        bodyHTML = `
          <div class="node-info-row">
            <span>Client:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
          <div class="node-info-row">
            <span>Target HP:</span> <span class="node-info-value" style="color:#ef4444; font-weight:700;">&le; ${hpThresh}% (Lowest)</span>
          </div>
          <div class="node-info-row">
            <span>Delay:</span> <span class="node-info-value">${delay}ms</span>
          </div>
        `;
      } else if (node.type === 'party_buff') {
        const delay = node.data?.delayAfterClick || 80;
        bodyHTML = `
          <div class="node-info-row">
            <span>Client:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
          <div class="node-info-row">
            <span>Sequence:</span> <span class="node-info-value" style="color:#a855f7; font-weight:700;">Downward Cycle</span>
          </div>
          <div class="node-info-row">
            <span>Delay:</span> <span class="node-info-value">${delay}ms</span>
          </div>
        `;
      } else if (node.type === 'tts') {
        const textConn = this.connections.find(c => c.toNodeId === node.id && (c.toPort === 'text_in' || c.toPort === 'msg_in'));
        let srcTitle = '';
        if (textConn) {
          const srcNode = this.nodes.find(n => n.id === textConn.fromNodeId);
          srcTitle = srcNode ? (srcNode.title || srcNode.type) : 'Wire';
        }
        const text = node.data?.text || (isEn ? 'Voice alert message...' : 'ข้อความเสียง...');
        const textDisplayHTML = textConn
          ? `<span class="node-info-value" style="color:#ec4899; font-weight:700; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${isEn ? `🔗 Dynamic text from: ${srcTitle}` : `🔗 รับข้อความจากสาย: ${srcTitle}`}">🔗 [${srcTitle}]</span>`
          : `<span class="node-info-value" style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${text}">"${text}"</span>`;
        const v = node.data?.voice || 'th-TH-PremwadeeNeural';
        const vLabel = v.includes('Niwat') ? (isEn ? 'Niwat (Male)' : 'นิวัต (ชาย)') : (v.includes('Jenny') ? 'Jenny' : (v.includes('Guy') ? 'Guy' : (isEn ? 'Premwadee (Female)' : 'เปรมวดี (หญิง)')));
        const vol = node.data?.volume !== undefined ? node.data.volume : 100;
        bodyHTML = `
          <div class="node-info-row">
            <span>Voice:</span> <span class="node-info-value" style="color:#c084fc; font-weight:700;">${vLabel}</span>
          </div>
          <div class="node-info-row">
            <span>Text:</span> ${textDisplayHTML}
          </div>
          <div class="node-info-row">
            <span>Vol:</span> <span class="node-info-value">${vol}%</span>
          </div>
        `;
      } else if (node.type === 'screenshot') {
        const region = node.data?.captureRegion || 'full';
        const prefix = node.data?.prefix || 'error_snap';
        const annotate = node.data?.annotate !== false;
        bodyHTML = `
          <div class="node-info-row">
            <span>Client:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
          <div class="node-info-row">
            <span>Region:</span> <span class="node-info-value" style="color:#10b981; font-weight:700;">${region}</span>
          </div>
          <div class="node-info-row">
            <span>Prefix:</span> <span class="node-info-value" style="max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${prefix}</span>
          </div>
          <div class="node-info-row">
            <span>Annotate:</span> <span class="node-info-value" style="color:${annotate ? '#10b981' : '#94a3b8'}; font-weight:600;">${annotate ? '✅ ON' : 'OFF'}</span>
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
      } else if (node.type === 'step_log') {
        const stepTag = node.data?.stepTag || 'STEP 1';
        const msg = node.data?.message || '';
        const msgConn = this.connections.find(c => c.toNodeId === node.id && c.toPort === 'msg_in');
        let srcTitle = '';
        if (msgConn) {
          const srcNode = this.nodes.find(n => n.id === msgConn.fromNodeId);
          srcTitle = srcNode ? (srcNode.title || srcNode.type) : 'Wire';
        }
        const msgDisplayHTML = msgConn 
          ? `<span class="node-info-value" style="color:#ec4899; font-weight:700; max-width:115px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="🔗 รับข้อความจากสาย: ${srcTitle} (แทนที่ข้อความพิมพ์)">🔗 [${srcTitle}]</span>`
          : `<span class="node-info-value" style="color:#10b981; font-weight:600; max-width:115px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${msg || '(ว่างเปล่า)'}">${msg || '(ว่างเปล่า)'}</span>`;

        bodyHTML = `
          <div class="node-info-row">
            <span>Tag:</span> <span class="node-info-value" style="color:#10b981; font-weight:700;">${stepTag}</span>
          </div>
          <div class="node-info-row">
            <span>Msg:</span> ${msgDisplayHTML}
          </div>
        `;
      } else if (node.type === 'format_text') {
        const template = node.data?.template !== undefined ? node.data.template : '{val_a}';
        const pins = Array.isArray(node.data?.pins) ? node.data.pins : ['val_a'];
        const boolFmt = node.data?.boolFormat || 'true_false';
        bodyHTML = `
          <div class="node-info-row">
            <span>Pattern:</span> <span class="node-info-value" style="color:#ec4899; font-family:'JetBrains Mono'; font-weight:700; max-width:110px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${template}">${template || '(Concat)'}</span>
          </div>
          <div class="node-info-row">
            <span>Pins:</span> <span class="node-info-value" style="color:#a855f7; font-weight:700;">${pins.length} inputs</span>
          </div>
        `;
      } else if (node.type === 'var_get') {
        const vName = node.data?.varName || node.title || 'myVar';
        const vType = node.data?.varType || 'string';
        const defVal = node.data?.defaultValue !== undefined ? node.data.defaultValue : '';
        const typeColor = vType === 'number' ? '#06b6d4' : (vType === 'boolean' ? '#ef4444' : '#ec4899');
        bodyHTML = `
          <div class="node-info-row" style="margin-bottom:2px;">
            <span style="font-family:'JetBrains Mono'; font-weight:700; color:var(--text); font-size:12px;">${vName}</span>
          </div>
          <div class="node-info-row">
            <span style="font-size:10px; color:${typeColor}; font-weight:700;">● ${vType.toUpperCase()}</span>
            ${defVal ? `<span class="node-info-value" style="font-size:10px; opacity:0.8;">(def: ${defVal})</span>` : ''}
          </div>
        `;
      } else if (node.type === 'var_set' || node.type === 'variable') {
        const vName = node.data?.varName || 'myVar';
        const vType = node.data?.varType || 'boolean';
        const vScope = node.data?.scope || 'client';
        const op = node.data?.operation || 'set_value';
        const scopeLabel = vScope === 'global' ? 'Global (All)' : `Client ${node.data?.targetClient || '1'}`;
        const typeMap = {
          boolean: '🔘 Boolean',
          number: '🔢 Number',
          string: '📝 Text'
        };
        const opMap = {
          toggle: '🔄 Toggle',
          set_true: '🟢 Set True',
          set_false: '🔴 Set False',
          set_value: `✏️ Set: ${node.data?.opValue !== undefined ? node.data.opValue : '-'}`,
          increment: `➕ +${node.data?.opValue !== undefined ? node.data.opValue : 1}`,
          decrement: `➖ -${node.data?.opValue !== undefined ? node.data.opValue : 1}`,
          reset: '🔁 Reset'
        };
        bodyHTML = `
          <div class="node-info-row">
            <span>Name:</span> <span class="node-info-value" style="color:var(--text); font-weight:700; font-family:'JetBrains Mono';">${vName}</span>
          </div>
          <div class="node-info-row">
            <span>Type:</span> <span class="node-info-value" style="color:#a855f7; font-weight:700;">${typeMap[vType] || vType}</span>
          </div>
          <div class="node-info-row">
            <span>Op:</span> <span class="node-info-value" style="color:#10b981; font-weight:700;">${opMap[op] || op}</span>
          </div>
        `;
      } else {
        bodyHTML = `
          <div class="node-info-row">
            <span>Target:</span> <span class="node-info-value">Client ${node.data?.targetClient || '1'}</span>
          </div>
        `;
      }
      } // End if (!bodyHTML)

      let portsHTML = '';
      let pinsHTML = '';

      if (node.type !== 'trigger' && !isPure) {
        portsHTML += `<div class="node-port port-in port-flow" data-node="${node.id}" data-port="exec_in" title="Input (exec_in)"></div>`;
      }

      const hasCooldown = this.hasCooldownGuard(node);
      const cooldownPinRowHTML = hasCooldown ? `
        <div class="node-pin-row">
          <span class="node-pin-label onCooldown">${canvasT('port_onCooldown', 'On Cooldown')} ▶</span>
          <div class="node-port port-out port-onCooldown" data-node="${node.id}" data-port="onCooldown" title="${canvasT('port_onCooldown', 'On Cooldown')}"></div>
        </div>
      ` : '';

      if (node.type === 'step_log') {
        const msgConn = this.connections.find(c => c.toNodeId === node.id && c.toPort === 'msg_in');
        const pinLabelText = '◀ Msg In';
        const pinLabelStyle = msgConn ? 'color:#ec4899; font-weight:700;' : '';
        const pinTitle = 'Message Data Input (String - Pink)';
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row pin-row-in">
              <div class="node-port port-in port-data port-string" data-node="${node.id}" data-port="msg_in" title="${pinTitle}"></div>
              <span class="node-pin-label port-string" style="${pinLabelStyle}">${pinLabelText}</span>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onComplete">${canvasT('port_onComplete', 'On Complete')} ▶</span>
              <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="next" title="${canvasT('port_onComplete', 'On Complete')}"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'format_text') {
        const pins = Array.isArray(node.data?.pins) ? node.data.pins : ['val_a'];
        const inputPinsHTML = pins.map(p => `
          <div class="node-pin-row pin-row-in">
            <div class="node-port port-in port-data port-string" data-node="${node.id}" data-port="${p}" title="Input: {${p}} (String / Number / Bool)"></div>
            <span class="node-pin-label port-string">◀ {${p}}</span>
          </div>
        `).join('');

        pinsHTML = `
          <div class="node-pins-section pure-pins">
            ${inputPinsHTML}
            <div class="node-pin-row">
              <span class="node-pin-label port-string">Result (msg_out) ●</span>
              <div class="node-port port-out port-data port-string" data-node="${node.id}" data-port="msg_out" title="Formatted Text (String - Pink)"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'var_get') {
        const vType = node.data?.varType || 'string';
        pinsHTML = `
          <div class="node-pins-section pure-pins">
            <div class="node-pin-row">
              <span class="node-pin-label port-${vType}">Value ●</span>
              <div class="node-port port-out port-data port-${vType}" data-node="${node.id}" data-port="val_out" title="Value Output (${vType})"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'var_set' || node.type === 'variable') {
        const vType = node.data?.varType || 'boolean';
        const op = node.data?.operation || 'set_value';
        const showValIn = (op === 'set_value');
        pinsHTML = `
          <div class="node-pins-section">
            ${showValIn ? `
            <div class="node-pin-row pin-row-in">
              <div class="node-port port-in port-data port-${vType}" data-node="${node.id}" data-port="val_in" title="Value In (${vType})"></div>
              <span class="node-pin-label port-${vType}">◀ Value In</span>
            </div>` : ''}
            <div class="node-pin-row">
              <span class="node-pin-label port-${vType}">Value Out ▶</span>
              <div class="node-port port-out port-data port-${vType}" data-node="${node.id}" data-port="val_out" title="Value Out (${vType})"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onComplete">${canvasT('port_onComplete', 'On Complete')} ▶</span>
              <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="next" title="${canvasT('port_onComplete', 'On Complete')}"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'loop') {
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
            ${cooldownPinRowHTML}
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
            ${cooldownPinRowHTML}
          </div>
        `;
      } else if (node.type === 'sequencer') {
        const isOnce = (node.data?.modeType === 'once');
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onStep">${canvasT('port_onStep', 'onStep')} ▶</span>
              <div class="node-port port-out port-onStep" data-node="${node.id}" data-port="onStep" title="${canvasT('port_onStep', 'onStep')}"></div>
            </div>
            ${isOnce ? `
            <div class="node-pin-row">
              <span class="node-pin-label onComplete" style="color:#10b981;">🏁 ${canvasT('port_onComplete', 'onComplete')} ▶</span>
              <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="onComplete" title="${canvasT('port_onComplete', 'onComplete')}"></div>
            </div>
            ` : `
            <div class="node-pin-row">
              <span class="node-pin-label onEachCycle">${canvasT('port_onEachCycle', 'onEachCycle')} ▶</span>
              <div class="node-port port-out port-onEachCycle" data-node="${node.id}" data-port="onEachCycle" title="${canvasT('port_onEachCycle', 'onEachCycle')}"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onStop">${canvasT('port_onStop', 'onStop')} ▶</span>
              <div class="node-port port-out port-onStop" data-node="${node.id}" data-port="onStop" title="${canvasT('port_onStop', 'onStop')}"></div>
            </div>
            `}
            ${cooldownPinRowHTML}
          </div>
        `;
      } else if (node.type === 'key_press') {
        if (hasCooldown) {
          pinsHTML = `
            <div class="node-pins-section">
              <div class="node-pin-row">
                <span class="node-pin-label onComplete">${canvasT('port_onComplete', 'On Complete')} ▶</span>
                <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="next" title="${canvasT('port_onComplete', 'On Complete')}"></div>
              </div>
              ${cooldownPinRowHTML}
            </div>
          `;
        } else {
          portsHTML += `<div class="node-port port-out" data-node="${node.id}" data-port="next" title="Output (next)"></div>`;
        }
      } else if (node.type === 'party_scanner') {
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onComplete" style="color:#06b6d4;">👁️ On Scanned ▶</span>
              <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="onScanned" title="Triggered every scan cycle with fresh party data"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onStop" style="color:#ef4444;">🚨 On Low HP ▶</span>
              <div class="node-port port-out port-onStop" data-node="${node.id}" data-port="onLowHp" title="Triggered when any member HP <= threshold"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label" style="color:#f59e0b;">⚠️ Error ▶</span>
              <div class="node-port port-out" data-node="${node.id}" data-port="onError" title="Error / Window not found"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label port-string">Names (String) ●</span>
              <div class="node-port port-out port-data port-string" data-node="${node.id}" data-port="names_out" title="All Member Names (String - Pink)"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label port-number">Count (Number) ●</span>
              <div class="node-port port-out port-data port-number" data-node="${node.id}" data-port="count_out" title="Member Count (Number - Cyan)"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label port-string">Summary (String) ●</span>
              <div class="node-port port-out port-data port-string" data-node="${node.id}" data-port="info_out" title="Party Summary Information (String - Pink)"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'party_slot') {
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onComplete" style="color:#10b981;">🏁 Selected (next) ▶</span>
              <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="next" title="Triggered when member slot is clicked (e.g. Slot 1 Leader -> Follow)"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label" style="color:#f59e0b;">⚠️ Error ▶</span>
              <div class="node-port port-out" data-node="${node.id}" data-port="onError" title="Error / Party not found"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'party_heal') {
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onStop" style="color:#ef4444;">🚑 On Target Selected ▶</span>
              <div class="node-port port-out port-onStop" data-node="${node.id}" data-port="onHealTarget" title="Triggered when damaged member is selected for heal"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onComplete" style="color:#38bdf8;">🛡️ Everyone Healthy ▶</span>
              <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="onNoTarget" title="Triggered when no member has low HP"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label" style="color:#f59e0b;">⚠️ Error ▶</span>
              <div class="node-port port-out" data-node="${node.id}" data-port="onError" title="Error / Party not found"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'party_buff') {
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onComplete" style="color:#a855f7;">📜 Next Member ▶</span>
              <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="onNextMember" title="Triggered for each member in party buff sequence"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onAfterStart" style="color:#38bdf8;">🏁 All Complete ▶</span>
              <div class="node-port port-out port-onAfterStart" data-node="${node.id}" data-port="onComplete" title="Triggered when all party members have been buffed"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label" style="color:#f59e0b;">⚠️ Error ▶</span>
              <div class="node-port port-out" data-node="${node.id}" data-port="onError" title="Error / Party not found"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label port-string">Name (String) ●</span>
              <div class="node-port port-out port-data port-string" data-node="${node.id}" data-port="name_out" title="Target Member Name (String - Pink)"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label port-number">Slot (Number) ●</span>
              <div class="node-port port-out port-data port-number" data-node="${node.id}" data-port="slot_out" title="Target Member Slot Index (Number - Cyan)"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label port-string">Summary (String) ●</span>
              <div class="node-port port-out port-data port-string" data-node="${node.id}" data-port="info_out" title="Target Member Summary (String - Pink)"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'tts') {
        const isEn = window.currentLang === 'en';
        const textConn = this.connections.find(c => c.toNodeId === node.id && (c.toPort === 'text_in' || c.toPort === 'msg_in'));
        const pinLabelText = isEn ? '◀ Text In' : '◀ ข้อความเข้า';
        const pinLabelStyle = textConn ? 'color:#ec4899; font-weight:700;' : '';
        const pinTitle = isEn ? 'Text Data Input (String - Pink)' : 'รับข้อความเสียง (String - สีชมพู)';
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row pin-row-in">
              <div class="node-port port-in port-data port-string" data-node="${node.id}" data-port="text_in" title="${pinTitle}"></div>
              <span class="node-pin-label port-string" style="${pinLabelStyle}">${pinLabelText}</span>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onComplete" style="color:#c084fc;">🏁 ${isEn ? 'Spoken (next)' : 'พูดสำเร็จ (next)'} ▶</span>
              <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="next" title="${isEn ? 'Triggered when voice alert begins' : 'ส่งสัญญาณเมื่อเริ่มเล่นเสียงแจ้งเตือน'}"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label" style="color:#f59e0b;">⚠️ ${isEn ? 'Error' : 'ผิดพลาด'} ▶</span>
              <div class="node-port port-out" data-node="${node.id}" data-port="onError" title="${isEn ? 'Synthesis or audio error' : 'สังเคราะห์หรือเล่นเสียงไม่สำเร็จ'}"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'screenshot') {
        const isEn = window.currentLang === 'en';
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onComplete" style="color:#10b981;">🏁 ${isEn ? 'Captured' : 'บันทึกสำเร็จ'} ▶</span>
              <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="onComplete" title="${isEn ? 'Triggered when screenshot is saved' : 'ส่งสัญญาณเมื่อถ่ายและบันทึกภาพสำเร็จ'}"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label" style="color:#f59e0b;">⚠️ ${isEn ? 'Error' : 'ผิดพลาด'} ▶</span>
              <div class="node-port port-out" data-node="${node.id}" data-port="onError" title="${isEn ? 'Capture or write error' : 'ดึงภาพหรือบันทึกไฟล์ไม่สำเร็จ'}"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'forwarder') {
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onAfterStart">${canvasT('port_onKeyDown', 'On Key Down')} ▶</span>
              <div class="node-port port-out port-onAfterStart" data-node="${node.id}" data-port="onKeyDown" title="On Key Down"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onComplete">${canvasT('port_onActivated', 'On Activated')} ▶</span>
              <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="onActivated" title="On Activated"></div>
            </div>
            ${cooldownPinRowHTML}
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
            ${cooldownPinRowHTML}
          </div>
        `;
      } else if (node.type === 'branch' || node.type === 'condition' || node.type === 'action_branch' || node.type === 'var_branch' || node.type === 'variable_branch') {
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
      } else if (node.type === 'webhook_out') {
        pinsHTML = `
          <div class="node-pins-section">
            <div class="node-pin-row">
              <span class="node-pin-label onComplete">${canvasT('port_onComplete', 'On Success')} ▶</span>
              <div class="node-port port-out port-onComplete" data-node="${node.id}" data-port="onComplete" title="On Success (2xx)"></div>
            </div>
            <div class="node-pin-row">
              <span class="node-pin-label onFalse" style="color:#ef4444;">${canvasT('port_onError', 'On Error')} ▶</span>
              <div class="node-port port-out port-onFalse" style="border-color:#ef4444;" data-node="${node.id}" data-port="onError" title="On Error (Network/HTTP Error)"></div>
            </div>
          </div>
        `;
      } else if (node.type === 'trigger') {
        portsHTML += `<div class="node-port port-out port-flow" data-node="${node.id}" data-port="exec_out" title="Output (exec_out)"></div>`;
      } else if (node.type === 'step_log' || node.type === 'format_text' || node.type === 'var_get' || node.type === 'var_set' || node.type === 'variable' || node.type === 'tts') {
        // Output pins explicitly handled in pinsHTML
      } else {
        portsHTML += `<div class="node-port port-out port-flow" data-node="${node.id}" data-port="next" title="Output (next)"></div>`;
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

      // Bind port wiring drag events & auto-apply port metadata and classes
      nodeEl.querySelectorAll('.node-port').forEach(portEl => {
        const pType = portEl.classList.contains('port-in') ? 'in' : 'out';
        const portName = portEl.dataset.port;
        const nodeId = portEl.dataset.node;

        // Auto-apply port metadata and styling classes
        const meta = this.getPortMeta(nodeId, portName, pType);
        portEl.dataset.kind = meta.kind;
        portEl.dataset.type = meta.type;
        if (meta.kind === 'flow') {
          portEl.classList.add('port-flow');
          portEl.classList.remove('port-data');
        } else {
          portEl.classList.add('port-data');
          portEl.classList.remove('port-flow');
          if (meta.type && meta.type !== 'flow') {
            portEl.classList.add(`port-${meta.type}`);
          }
        }

        portEl.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (pType === 'out' && e.button === 0) {
            const portRect = portEl.getBoundingClientRect();
            const portPos = this.clientToWorld(
              portRect.left + portRect.width / 2,
              portRect.top + portRect.height / 2
            );

            const wireType = meta.kind === 'data' ? meta.type : null;

            this.draftWire = {
              fromNodeId: nodeId,
              fromPort: portName,
              wireType,
              meta,
              isInvalid: false,
              x1: portPos.x,
              y1: portPos.y,
              x2: portPos.x,
              y2: portPos.y
            };

            this.highlightCompatiblePorts(nodeId, portName);
          }
        });

        portEl.addEventListener('mouseup', (e) => {
          e.stopPropagation();
          if (this.draftWire && portEl.classList.contains('port-in')) {
            const toNodeId = portEl.dataset.node;
            const toPort = portEl.dataset.port;
            const check = this.canConnectPorts(this.draftWire.fromNodeId, this.draftWire.fromPort, toNodeId, toPort);
            if (check.allowed) {
              this.addConnection(this.draftWire.fromNodeId, this.draftWire.fromPort, toNodeId, toPort);
            } else {
              const msg = window.currentLang === 'en' ? check.reasonEn : check.reasonTh;
              if (typeof window.toast === 'function') {
                window.toast(`⚠️ ${msg}`, 'warning');
              }
            }
          }
          this.draftWire = null;
          this.clearPortHighlights();
          this.renderWires();
        });

        // Right-Click on Port Pin (Unreal Engine Blueprint Break Links Context Menu)
        portEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.showPortContextMenu(e.clientX, e.clientY, nodeId, portName, pType);
        });
      });

      // Ensure release anywhere on a node also dismisses any active draft wire
      nodeEl.addEventListener('mouseup', () => {
        if (this.draftWire) {
          this.draftWire = null;
          this.clearPortHighlights();
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

    const isOutput = !(portName === 'exec_in' || portName === 'msg_in' || portName === 'val_in' || portName === 'text_in' || (node.type === 'format_text' && portName !== 'msg_out'));
    const x = isOutput ? node.position.x + 221 : node.position.x - 1;
    let y = node.position.y + 38;
    if (portName === 'onBeforeStart') y = node.position.y + 75;
    else if (portName === 'onAfterStart' || portName === 'onKeyDown') y = node.position.y + 100;
    else if (portName === 'onEachCycle' || portName === 'on_interval') y = node.position.y + 125;
    else if (portName === 'onStop') y = node.position.y + 150;
    else if (portName === 'onComplete' || portName === 'on_complete' || portName === 'onActivated') y = node.position.y + 125;
    else if (portName === 'onCooldown' || portName === 'on_cooldown') y = node.position.y + 150;
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
        <filter id="wire-glow-pink" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="wire-glow-amber" x="-50%" y="-50%" width="200%" height="200%">
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

      const fromNode = this.nodes.find(n => n.id === conn.fromNodeId);
      const toNode = this.nodes.find(n => n.id === conn.toNodeId);
      const isDataWire = (
        conn.fromPort === 'val_out' || 
        conn.fromPort === 'msg_out' || 
        conn.fromPort === 'name_out' || 
        conn.fromPort === 'slot_out' || 
        conn.fromPort === 'names_out' || 
        conn.fromPort === 'count_out' || 
        conn.fromPort === 'info_out' || 
        conn.toPort === 'val_in' || 
        conn.toPort === 'msg_in' ||
        conn.toPort === 'text_in' ||
        (toNode && toNode.type === 'format_text')
      );
      let wireTypeClass = '';
      if (isDataWire) {
        let vType = fromNode?.data?.varType;
        if (!vType) {
          if (conn.fromPort === 'slot_out' || conn.fromPort === 'count_out') vType = 'number';
          else if (conn.fromPort === 'msg_out' || conn.fromPort === 'name_out' || conn.fromPort === 'names_out' || conn.fromPort === 'info_out' || conn.toPort === 'msg_in' || conn.toPort === 'text_in') vType = 'string';
          else vType = 'string';
        }
        wireTypeClass = `wire-data wire-${vType}`;
      }

      svgContent += `
        <g class="wire-group" data-id="${conn.id}">
          <path class="wire-path ${wireTypeClass}" d="${pathData}" data-id="${conn.id}" />
        </g>
      `;
    });

    // Render draft wire if currently dragging
    if (this.draftWire) {
      const dx = Math.max(30, Math.abs(this.draftWire.x2 - this.draftWire.x1) * 0.5);
      const pathData = `M ${this.draftWire.x1} ${this.draftWire.y1} C ${this.draftWire.x1 + dx} ${this.draftWire.y1}, ${this.draftWire.x2 - dx} ${this.draftWire.y2}, ${this.draftWire.x2} ${this.draftWire.y2}`;
      let draftClass = 'wire-draft';
      if (this.draftWire.isInvalid) {
        draftClass += ' wire-draft-invalid';
      } else if (this.draftWire.wireType) {
        draftClass += ` wire-data wire-${this.draftWire.wireType}`;
      }
      svgContent += `<path class="wire-path ${draftClass}" d="${pathData}" />`;
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

    if (colorOverride === 'pink') {
      orbColor = '#ec4899';
    } else if (colorOverride === 'red') {
      orbColor = '#f87171';
    } else if (colorOverride === 'blue') {
      orbColor = '#60a5fa';
    } else if (colorOverride === 'green') {
      orbColor = '#34d399';
    } else if (colorOverride === 'cyan') {
      orbColor = '#06b6d4';
    } else if (colorOverride === 'purple') {
      orbColor = '#c084fc';
    } else if (colorOverride === 'amber' || colorOverride === 'orange') {
      colorKey = 'amber';
      orbColor = '#f59e0b';
    } else {
      const pName = conn.fromPort || '';
      const toPName = conn.toPort || '';
      const fromNode = this.nodes.find(n => n.id === conn.fromNodeId);
      const toNode = this.nodes.find(n => n.id === conn.toNodeId);
      const isDataWire = (
        pName === 'val_out' || 
        pName === 'msg_out' || 
        pName === 'name_out' || 
        pName === 'slot_out' || 
        pName === 'names_out' || 
        pName === 'count_out' || 
        pName === 'info_out' || 
        toPName === 'val_in' || 
        toPName === 'msg_in' ||
        toPName === 'text_in' ||
        (toNode && toNode.type === 'format_text')
      );

      if (isDataWire) {
        let vType = fromNode?.data?.varType;
        if (!vType) {
          if (pName === 'slot_out' || pName === 'count_out') vType = 'number';
          else if (pName === 'msg_out' || pName === 'name_out' || pName === 'names_out' || pName === 'info_out' || toPName === 'msg_in' || toPName === 'text_in') vType = 'string';
          else vType = 'string';
        }
        if (vType === 'number') {
          colorKey = 'cyan';
          orbColor = '#06b6d4';
        } else if (vType === 'boolean') {
          colorKey = 'red';
          orbColor = '#ef4444';
        } else {
          colorKey = 'pink';
          orbColor = '#ec4899';
        }
      } else if (pName === 'onBeforeStart') {
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
      } else if (pName === 'onCooldown' || pName === 'on_cooldown') {
        colorKey = 'amber';
        orbColor = '#f59e0b';
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
          try { onCompleteCallback(); } catch (e) { console.error(e); }
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
      try { this.signalEventSource.close(); } catch (e) { }
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
    } else if (currentNode.type === 'branch' || currentNode.type === 'action_branch' || currentNode.type === 'var_branch' || currentNode.type === 'variable_branch') {
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
    } else if (eventName === 'onCooldown') {
      const cdConns = this.connections.filter(c => c.fromNodeId === sourceNode.id && (c.fromPort === 'onCooldown' || c.fromPort === 'on_cooldown'));
      cdConns.forEach(conn => {
        this.firePulseOnWire(conn, 'amber', () => {
          const nextNode = this.nodes.find(n => n.id === conn.toNodeId);
          if (nextNode) {
            this.propagateSignalFlow(nextNode, true, new Set(), 1);
          }
        });
      });
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
      const isFlow = portName === 'exec_in' || portName === 'in';
      const conns = this.connections.filter(c => c.toNodeId === nodeId && (isFlow ? (c.toPort === 'exec_in' || c.toPort === 'in' || !c.toPort) : c.toPort === portName));
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

  getPortMeta(nodeId, portName, direction = 'out') {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return { kind: 'flow', type: 'flow', label: portName };

    const def = (typeof window !== 'undefined' && window.clientNodeRegistry)
      ? window.clientNodeRegistry.get(node.type)
      : (typeof global !== 'undefined' && global.nodeRegistry ? global.nodeRegistry.get(node.type) : null);

    // 1. Flow Input: exec_in or in
    if (portName === 'exec_in' || portName === 'in') {
      return { kind: 'flow', type: 'flow', label: 'exec_in' };
    }

    // 2. Data Inputs: msg_in, text_in, val_in, format_text pin inputs
    if (portName === 'msg_in' || portName === 'text_in') {
      return { kind: 'data', type: 'string', label: portName };
    }
    if (portName === 'val_in') {
      return { kind: 'data', type: node.data?.varType || 'string', label: 'val_in' };
    }
    if (node.type === 'format_text' && portName !== 'msg_out') {
      return { kind: 'data', type: 'any', label: portName };
    }

    // 3. Flow Outputs:
    const knownFlowOutputs = [
      'next', 'exec_out', 'onComplete', 'onError', 'onScanned', 'onLowHp',
      'onHealTarget', 'onNoTarget', 'onNextMember', 'onKeyDown', 'onActivated',
      'onStep', 'onEachCycle', 'onStop', 'onCooldown', 'onBeforeStart',
      'onAfterStart', 'onTrue', 'onFalse', 'onEnable', 'onDisable'
    ];
    if (knownFlowOutputs.includes(portName) || portName.startsWith('item_')) {
      return { kind: 'flow', type: 'flow', label: portName };
    }

    // 4. Data Outputs:
    if (portName === 'val_out') {
      return { kind: 'data', type: node.data?.varType || 'string', label: 'val_out' };
    }
    if (portName === 'msg_out') {
      return { kind: 'data', type: 'string', label: 'msg_out' };
    }
    if (portName === 'names_out' || portName === 'name_out' || portName === 'info_out') {
      return { kind: 'data', type: 'string', label: portName };
    }
    if (portName === 'slot_out' || portName === 'count_out') {
      return { kind: 'data', type: 'number', label: portName };
    }

    // 5. Check Registry dataOutputs or outputs
    if (def && Array.isArray(def.dataOutputs)) {
      const dOut = def.dataOutputs.find(d => d.name === portName);
      if (dOut) {
        return { kind: 'data', type: dOut.type || 'string', label: dOut.label || portName };
      }
    }
    if (def && Array.isArray(def.outputs) && def.outputs.includes(portName)) {
      return { kind: 'flow', type: 'flow', label: portName };
    }

    // Default fallback based on naming convention
    const isData = portName.includes('_out') || portName.includes('_in') || portName.startsWith('val_');
    return {
      kind: isData ? 'data' : 'flow',
      type: isData ? 'string' : 'flow',
      label: portName
    };
  }

  canConnectPorts(fromNodeId, fromPort, toNodeId, toPort) {
    if (fromNodeId === toNodeId) {
      return {
        allowed: false,
        reasonKey: 'wire_err_same_node',
        reasonTh: 'ไม่สามารถเชื่อมต่อสายเข้าหาโหนดเดียวกันได้',
        reasonEn: 'Cannot connect a node to itself.'
      };
    }

    const fromMeta = this.getPortMeta(fromNodeId, fromPort, 'out');
    const toMeta = this.getPortMeta(toNodeId, toPort, 'in');

    // Rule 1: Flow to Data is FORBIDDEN
    if (fromMeta.kind === 'flow' && toMeta.kind === 'data') {
      return {
        allowed: false,
        reasonKey: 'wire_err_flow_to_data',
        reasonTh: `ไม่สามารถเชื่อมสายสั่งการ [${fromPort}] เข้ากับช่องรับข้อมูล [${toPort}] ได้`,
        reasonEn: `Cannot connect Execution Flow [${fromPort}] to Data Input pin [${toPort}].`,
        fromMeta,
        toMeta
      };
    }

    // Rule 2: Data to Flow is FORBIDDEN
    if (fromMeta.kind === 'data' && toMeta.kind === 'flow') {
      return {
        allowed: false,
        reasonKey: 'wire_err_data_to_flow',
        reasonTh: `ไม่สามารถเชื่อมสายข้อมูล [${fromPort}] เข้ากับขาสั่งการทำงาน [${toPort}] ได้`,
        reasonEn: `Cannot connect Data output [${fromPort}] to Execution Flow input [${toPort}].`,
        fromMeta,
        toMeta
      };
    }

    // Rule 3: Data to Data Type Matrix
    if (fromMeta.kind === 'data' && toMeta.kind === 'data') {
      const fType = fromMeta.type || 'any';
      const tType = toMeta.type || 'any';

      let compatible = false;
      if (fType === 'any' || tType === 'any') {
        compatible = true;
      } else if (fType === tType) {
        compatible = true;
      } else if (tType === 'string' && (fType === 'number' || fType === 'boolean')) {
        compatible = true; // Auto-coercion into string
      }

      if (!compatible) {
        return {
          allowed: false,
          reasonKey: 'wire_err_type_mismatch',
          reasonTh: `ชนิดข้อมูลไม่เข้ากัน: ไม่สามารถส่ง [${fType}] เข้าช่อง [${tType}] ได้`,
          reasonEn: `Incompatible data types: cannot feed [${fType}] into [${tType}].`,
          fromMeta,
          toMeta
        };
      }
    }

    // Rule 4: Duplicate connection
    const existing = this.connections.find(c => c.fromNodeId === fromNodeId && c.fromPort === fromPort && c.toNodeId === toNodeId && c.toPort === toPort);
    if (existing) {
      return {
        allowed: false,
        reasonKey: 'wire_err_already_connected',
        reasonTh: 'พอร์ตคู่นี้ถูกเชื่อมต่ออยู่แล้ว',
        reasonEn: 'These pins are already connected.',
        fromMeta,
        toMeta
      };
    }

    return { allowed: true, fromMeta, toMeta };
  }

  highlightCompatiblePorts(fromNodeId, fromPort) {
    if (!this.nodesLayer) return;
    const inputPorts = this.nodesLayer.querySelectorAll('.node-port.port-in');
    inputPorts.forEach(portEl => {
      const toNodeId = portEl.dataset.node;
      const toPort = portEl.dataset.port;
      const check = this.canConnectPorts(fromNodeId, fromPort, toNodeId, toPort);
      if (check.allowed) {
        portEl.classList.add('port-valid-target');
        portEl.classList.remove('port-invalid-target');
      } else {
        portEl.classList.add('port-invalid-target');
        portEl.classList.remove('port-valid-target');
      }
    });
  }

  clearPortHighlights() {
    if (!this.nodesLayer) return;
    const ports = this.nodesLayer.querySelectorAll('.node-port');
    ports.forEach(p => {
      p.classList.remove('port-valid-target', 'port-invalid-target');
    });
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
    const isFlow = portName === 'exec_in' || portName === 'in';
    const toRemove = this.connections.filter(c => c.toNodeId === nodeId && (isFlow ? (c.toPort === 'exec_in' || c.toPort === 'in' || !c.toPort) : c.toPort === portName));
    if (toRemove.length === 0) return;

    this.connections = this.connections.filter(c => !(c.toNodeId === nodeId && (isFlow ? (c.toPort === 'exec_in' || c.toPort === 'in' || !c.toPort) : c.toPort === portName)));
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
    this.clearPortHighlights();

    const check = this.canConnectPorts(fromNodeId, fromPort, toNodeId, toPort);
    if (!check.allowed) {
      const msg = (typeof window !== 'undefined' && window.currentLang === 'en') ? check.reasonEn : check.reasonTh;
      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast(`⚠️ ${msg}`, 'warning');
      }
      this.render();
      return;
    }

    // For any data input pin, automatically prune previous incoming connection to that port
    const toMeta = this.getPortMeta(toNodeId, toPort, 'in');
    if (toMeta.kind === 'data') {
      this.connections = this.connections.filter(c => !(c.toNodeId === toNodeId && c.toPort === toPort));
    }

    this.connections.push({
      id: `conn_${Date.now()}`,
      fromNodeId,
      fromPort,
      toNodeId,
      toPort
    });

    this.render();
    const isEn = (typeof window !== 'undefined' && window.currentLang === 'en');
    this.addHistory('🔗', isEn ? `Connected [${fromPort}] ➔ [${toPort}]` : `เชื่อมสาย [${fromPort}] ➔ [${toPort}]`);
    if (typeof window !== 'undefined' && typeof window.toast === 'function') {
      window.toast(isEn ? `🔗 Connected [${fromPort}] ➔ [${toPort}]` : '🔗 เชื่อมต่อ Action เรียบร้อยแล้ว', 'success');
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
      branch: 'Action Branch',
      action_branch: 'Action Branch',
      var_branch: 'Variable Branch',
      variable_branch: 'Variable Branch',
      condition: 'Action Branch',
      control: 'Action Controller',
      forwarder: 'Multi-Client Forwarder',
      macro_group: 'Combo Macro Group',
      emergency_stop: 'Emergency Stop All',
      sound: 'Sound Alert',
      emit_event: 'Emit Event',
      key_hold: 'Key Hold Toggle',
      sequencer: 'Cast Sequencer',
      loop_scheduler: 'Loop Scheduler',
      step_log: 'Log Message (📝)',
      var_get: 'myVar',
      var_set: 'Set myVar',
      variable: 'Set myVar',
      tts: 'Text to Speech (TTS)',
      webhook_out: 'Discord / HTTP Webhook',
      format_text: 'Format Text'
    };

    const def = window.clientNodeRegistry ? window.clientNodeRegistry.get(type) : null;
    let initialData = { enabled: true };
    if (def && def.defaultData && Object.keys(def.defaultData).length > 0) {
      initialData = JSON.parse(JSON.stringify(def.defaultData));
      if (initialData.enabled === undefined) initialData.enabled = true;
    } else if (type === 'trigger') {
      initialData = { triggerType: 'keyboard', triggerValue: '1', enabled: true };
    } else if (type === 'step_log') {
      initialData = {
        message: '',
        enabled: true
      };
    } else if (type === 'format_text') {
      initialData = {
        template: '{val_a}',
        pins: ['val_a'],
        boolFormat: 'true_false',
        separator: ' ',
        enabled: true
      };
    } else if (type === 'var_get') {
      initialData = {
        varName: 'myVar',
        varType: 'string',
        defaultValue: '',
        scope: 'global',
        targetClient: 'all',
        enabled: true
      };
    } else if (type === 'var_set' || type === 'variable') {
      initialData = {
        varName: 'myVar',
        varType: 'boolean', // 'boolean' | 'number' | 'string'
        scope: 'global',
        targetClient: 'all',
        initialValue: 'false',
        operation: 'set_value', // 'set_value' | 'toggle' | 'set_true' | 'set_false' | 'increment' | 'decrement' | 'reset'
        opValue: '',
        enabled: true
      };
    } else if (type === 'webhook_out') {
      initialData = {
        name: 'Discord / HTTP Webhook',
        url: '',
        method: 'POST',
        headers: '{\n  "Content-Type": "application/json"\n}',
        payload: '{\n  "content": "⚡ NodeHotkey Alert: Triggered!"\n}',
        timeoutMs: 5000,
        enabled: true
      };
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
    } else if (type === 'party_scanner') {
      initialData = {
        targetClient: '1',
        scanIntervalMs: 250,
        lowHpThreshold: 70,
        scanRegion: 'auto',
        showOverlay: true,
        enabled: true
      };
    } else if (type === 'party_slot') {
      initialData = {
        targetClient: '1',
        targetSlot: 1,
        delayAfterClick: 80,
        showOverlay: true,
        enabled: true
      };
    } else if (type === 'party_heal') {
      initialData = {
        targetClient: '1',
        lowHpThreshold: 70,
        delayAfterClick: 80,
        showOverlay: true,
        enabled: true
      };
    } else if (type === 'party_buff') {
      initialData = {
        targetClient: '1',
        delayAfterClick: 80,
        showOverlay: true,
        enabled: true
      };
    } else if (type === 'tts') {
      const isEn = window.currentLang === 'en';
      initialData = {
        text: isEn ? 'Party HP alert from bot' : 'เกิดการแจ้งเตือนจากบอท',
        voice: isEn ? 'en-US-JennyNeural' : 'th-TH-PremwadeeNeural',
        volume: 100,
        enabled: true
      };
    } else if (type === 'buff_sequence') {
      initialData = { targetClient: '1', keys: ['1', '2'], delayBuff: 800, delayAfter: 0, enabled: true };
    } else if (type === 'key_press') {
      initialData = { targetClient: '1', keys: ['1'], delayAfter: 0, enabled: true };
    } else if (type === 'delay') {
      initialData = { delayMs: 1000, enabled: true };
    } else if (type === 'action_branch' || type === 'branch' || type === 'condition') {
      initialData = { conditionTargetId: '', conditionRule: 'is_running', enabled: true };
    } else if (type === 'var_branch' || type === 'variable_branch') {
      initialData = { conditionTargetId: '', varName: '', varType: 'boolean', conditionRule: 'is_true', conditionValue: '', enabled: true };
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
    } else if (type === 'screenshot') {
      initialData = {
        targetClient: '1',
        captureRegion: 'full',
        subfolder: 'client_1',
        prefix: 'error_snap',
        annotate: true,
        enabled: true
      };
    }

    const newNode = {
      id,
      type,
      title: (def && def.title) || titleNames[type] || type,
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

  updateNodeSelectionClasses() {
    if (!this.nodesLayer) return;
    const nodeEls = this.nodesLayer.querySelectorAll('.canvas-node');
    nodeEls.forEach(el => {
      const id = el.dataset.id;
      if (this.selectedNodeIds.has(id)) {
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
      }
    });
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
    if (this.tabBtnVariables) this.tabBtnVariables.classList.toggle('active', tabName === 'variables');
    if (this.tabBtnHistory) this.tabBtnHistory.classList.toggle('active', tabName === 'history');
    if (this.drawerOutlinerBody) this.drawerOutlinerBody.style.display = tabName === 'outliner' ? 'flex' : 'none';
    if (this.drawerVariablesBody) this.drawerVariablesBody.style.display = tabName === 'variables' ? 'flex' : 'none';
    if (this.drawerHistoryBody) this.drawerHistoryBody.style.display = tabName === 'history' ? 'flex' : 'none';

    if (tabName === 'history') {
      this.renderHistory();
    } else if (tabName === 'variables') {
      this.renderVariablesPanel();
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
      } else if (this.activeDrawerTab === 'variables') {
        this.renderVariablesPanel();
        if (this.variablesSearchInput) {
          setTimeout(() => this.variablesSearchInput.focus(), 50);
        }
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

  // =========================================================================
  // UNREAL ENGINE BLUEPRINT VARIABLES SYSTEM
  // =========================================================================
  getAvailableVariables() {
    if (!Array.isArray(this.variables)) this.variables = [];

    // Auto-discovery from nodes on canvas
    const existingNames = new Set(this.variables.map(v => v.name));

    this.nodes.forEach(node => {
      if (node.type === 'var_set' || node.type === 'variable' || node.type === 'var_get') {
        const vName = node.data?.varName || (node.title ? node.title.replace(/^(Get |Set )/, '') : null);
        if (vName && !existingNames.has(vName)) {
          existingNames.add(vName);
          const vType = node.data?.varType || (node.type === 'var_get' ? 'string' : 'boolean');
          const vScope = node.data?.scope || 'client';
          const defVal = node.data?.defaultValue !== undefined 
            ? node.data.defaultValue 
            : (node.data?.initialValue !== undefined ? node.data.initialValue : (vType === 'boolean' ? 'false' : (vType === 'number' ? '0' : '')));

          this.variables.push({
            id: 'var_' + Math.random().toString(36).substring(2, 9),
            name: vName,
            type: vType,
            scope: 'global',
            targetClient: 'all',
            defaultValue: String(defVal),
            description: ''
          });
        }
      }
    });

    return this.variables.sort((a, b) => a.name.localeCompare(b.name));
  }

  filterVariables(query) {
    this.variablesSearchQuery = (query || '').toLowerCase().trim();
    this.renderVariablesPanel();
  }

  renderVariablesPanel() {
    if (!this.variablesListEl) return;
    const allVars = this.getAvailableVariables();

    if (this.variablesCountEl) {
      this.variablesCountEl.textContent = allVars.length;
    }

    const filtered = allVars.filter(v => {
      if (!this.variablesSearchQuery) return true;
      return v.name.toLowerCase().includes(this.variablesSearchQuery) ||
             (v.type && v.type.toLowerCase().includes(this.variablesSearchQuery)) ||
             (v.description && v.description.toLowerCase().includes(this.variablesSearchQuery));
    });

    if (filtered.length === 0) {
      this.variablesListEl.innerHTML = `
        <div style="text-align:center; padding:30px 16px; color:var(--muted);">
          <div style="font-size:28px; margin-bottom:8px;">📦</div>
          <div style="font-weight:700; font-size:12px; color:#cbd5e1; margin-bottom:4px;">
            ${this.variablesSearchQuery ? 'ไม่พบตัวแปรที่ค้นหา' : canvasT('var_empty_title', 'ยังไม่มีตัวแปรในโปรไฟล์นี้')}
          </div>
          <div style="font-size:10.5px; opacity:0.75; line-height:1.4;">
            ${this.variablesSearchQuery ? 'ลองพิมพ์คำค้นหาอื่น' : canvasT('var_empty_desc', 'สร้างตัวแปรเพื่อใช้อ่าน (Get) หรือกำหนดค่า (Set) ระหว่างโหนด')}
          </div>
        </div>
      `;
      return;
    }

    this.variablesListEl.innerHTML = filtered.map(v => {
      const typeBadgeClass = v.type === 'number' ? 'var-badge-number' : (v.type === 'boolean' ? 'var-badge-boolean' : 'var-badge-string');
      const typeIcon = v.type === 'number' ? '🔢' : (v.type === 'boolean' ? '🔘' : '📝');

      return `
        <div class="variable-card" id="var-card-${v.id}">
          <div class="variable-card-top">
            <span class="variable-name" title="${v.name}">${v.name}</span>
            <span class="var-type-badge ${typeBadgeClass}">${typeIcon} ${v.type}</span>
          </div>
          <div class="variable-card-meta">
            <span>🌐 Global</span>
            <span style="font-family:'JetBrains Mono'; opacity:0.85;">Def: ${v.defaultValue !== undefined ? v.defaultValue : '-'}</span>
          </div>
          ${v.description ? `<div style="font-size:10px; color:#94a3b8; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${v.description}">${v.description}</div>` : ''}
          <div class="variable-actions">
            <button type="button" class="btn-var-spawn btn-var-get" onclick="window.nodeCanvas.spawnVariableNode('${v.name}', 'var_get')" title="วางโหนด Get Variable ลง Canvas">
              📥 ${canvasT('var_spawn_get', 'Get')}
            </button>
            <button type="button" class="btn-var-spawn btn-var-set" onclick="window.nodeCanvas.spawnVariableNode('${v.name}', 'var_set')" title="วางโหนด Set Variable ลง Canvas">
              ✏️ ${canvasT('var_spawn_set', 'Set')}
            </button>
            <button type="button" class="btn-var-icon" onclick="window.nodeCanvas.openVariableModal('${v.id}')" title="แก้ไขตัวแปร (Edit)">
              ⚙️
            </button>
            <button type="button" class="btn-var-icon btn-var-del" onclick="window.nodeCanvas.deleteVariable('${v.id}')" title="ลบตัวแปร (Delete)">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  spawnVariableNode(varName, nodeType = 'var_get') {
    const allVars = this.getAvailableVariables();
    const vObj = allVars.find(v => v.name === varName) || {
      name: varName,
      type: nodeType === 'var_get' ? 'string' : 'boolean',
      scope: 'global',
      targetClient: 'all',
      defaultValue: ''
    };

    const viewportRect = this.viewport ? this.viewport.getBoundingClientRect() : { width: 800, height: 600 };
    const centerClient = { x: viewportRect.width / 2, y: viewportRect.height / 2 };
    const worldPos = this.clientToWorld(centerClient.x, centerClient.y);
    const jitterX = Math.floor(Math.random() * 40) - 20;
    const jitterY = Math.floor(Math.random() * 40) - 20;
    const finalPos = { x: Math.round(worldPos.x + jitterX), y: Math.round(worldPos.y + jitterY) };

    const nodeId = 'node_' + Math.random().toString(36).substring(2, 9);
    let initialData = {};

    if (nodeType === 'var_get') {
      initialData = {
        varName: vObj.name,
        varType: vObj.type || 'string',
        scope: 'global',
        targetClient: 'all',
        defaultValue: vObj.defaultValue !== undefined ? vObj.defaultValue : '',
        enabled: true
      };
    } else {
      initialData = {
        varName: vObj.name,
        varType: vObj.type || 'boolean',
        scope: 'global',
        targetClient: 'all',
        initialValue: vObj.defaultValue !== undefined ? vObj.defaultValue : (vObj.type === 'boolean' ? 'false' : (vObj.type === 'number' ? '0' : '')),
        operation: 'set_value',
        opValue: vObj.type === 'number' ? '1' : (vObj.type === 'boolean' ? 'true' : ''),
        enabled: true
      };
    }

    const newNode = {
      id: nodeId,
      type: nodeType,
      title: (nodeType === 'var_get' ? 'Get ' : 'Set ') + vObj.name,
      position: finalPos,
      data: initialData
    };

    this.nodes.push(newNode);
    this.render();
    this.focusNode(nodeId);
    this.addHistory('✨', `เพิ่มโหนด "${newNode.title}"`);
    this.onProfileChanged();
    if (typeof window.toast === 'function') {
      window.toast(`✨ วางโหนด "${newNode.title}" แล้ว`, 'success');
    }
  }

  deleteVariable(varId) {
    const v = (this.variables || []).find(it => it.id === varId);
    if (!v) return;

    const referencingNodes = this.nodes.filter(n => 
      (n.type === 'var_set' || n.type === 'variable' || n.type === 'var_get') &&
      n.data?.varName === v.name
    );

    let confirmMsg = `ต้องการลบตัวแปร "${v.name}" หรือไม่?`;
    if (referencingNodes.length > 0) {
      confirmMsg += `\n⚠️ มีโหนดบน Canvas ใช้งานตัวแปรนี้อยู่ ${referencingNodes.length} โหนด`;
    }

    if (!confirm(confirmMsg)) return;

    this.variables = this.variables.filter(it => it.id !== varId);
    this.renderVariablesPanel();
    this.addHistory('🗑️', `ลบตัวแปร "${v.name}"`);
    this.onProfileChanged();
    if (typeof window.toast === 'function') {
      window.toast(`🗑️ ลบตัวแปร "${v.name}" แล้ว`, 'info');
    }
  }

  renderDefaultValueInputHTML(type, val = '') {
    if (type === 'boolean') {
      const isTrue = String(val) === 'true';
      return `
        <select id="modal-var-default" class="inspector-select" style="font-weight:700;">
          <option value="false" ${!isTrue ? 'selected' : ''}>🔴 False (Off / ปิด)</option>
          <option value="true" ${isTrue ? 'selected' : ''}>🟢 True (On / เปิด)</option>
        </select>
      `;
    } else if (type === 'number') {
      const numVal = isNaN(Number(val)) ? 0 : Number(val);
      return `
        <input type="number" id="modal-var-default" class="inspector-input" value="${numVal}" step="any" placeholder="0" style="font-family:'JetBrains Mono'; font-weight:700; color:#38bdf8;" />
      `;
    } else {
      return `
        <input type="text" id="modal-var-default" class="inspector-input" value="${val || ''}" placeholder="ค่าข้อความเริ่มต้น..." style="font-family:'JetBrains Mono';" />
      `;
    }
  }

  openVariableModal(varId = null, targetNodeId = null) {
    let vObj = null;
    if (varId) {
      vObj = (this.variables || []).find(it => it.id === varId);
    }

    let modalEl = document.getElementById('variable-editor-modal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'variable-editor-modal';
      modalEl.className = 'modal-bg';
      document.body.appendChild(modalEl);
    }

    const isEdit = !!vObj;
    const varName = vObj ? vObj.name : '';
    const varType = vObj ? (vObj.type || 'boolean') : 'boolean';
    const defaultValue = vObj ? (vObj.defaultValue !== undefined ? vObj.defaultValue : '') : (varType === 'boolean' ? 'false' : (varType === 'number' ? '0' : ''));
    const desc = vObj ? (vObj.description || '') : '';

    modalEl.innerHTML = `
      <div class="variable-modal-dialog">
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:10px;">
          <div style="font-weight:700; font-size:14px; color:#fff; display:flex; align-items:center; gap:8px;">
            <span>📦</span>
            <span>${isEdit ? canvasT('var_modal_title_edit', 'แก้ไขข้อมูลตัวแปร') : canvasT('var_modal_title_new', 'สร้างตัวแปร Blueprint ใหม่')}</span>
          </div>
          <button type="button" style="background:transparent; border:none; color:var(--muted); font-size:16px; cursor:pointer;" onclick="window.nodeCanvas.closeVariableModal()">✕</button>
        </div>

        <form id="var-editor-form" onsubmit="event.preventDefault(); window.nodeCanvas.saveVariableFromModal('${varId || ''}', '${targetNodeId || ''}');">
          <div class="inspector-field-group" style="margin-bottom:12px;">
            <label class="inspector-label">${canvasT('var_name_label', 'ชื่อตัวแปร')} <span style="color:#ef4444;">*</span></label>
            <input type="text" id="modal-var-name" class="inspector-input" value="${varName}" placeholder="e.g. isBuffActive, comboCounter, bossHealth" required pattern="[A-Za-z0-9_]+" title="ใช้อักษรภาษาอังกฤษ ตัวเลข และ _ เท่านั้น (ห้ามเว้นวรรค)" style="font-family:'JetBrains Mono'; font-weight:700; color:#38bdf8;" />
            <span style="font-size:10px; color:var(--muted); margin-top:3px; display:block;">ใช้อักษร A-Z, 0-9 และ _ (เช่น isBuffActive, comboCount)</span>
          </div>

          <div class="inspector-field-group" style="margin-bottom:12px;">
            <label class="inspector-label">${canvasT('var_type_label', 'ชนิดข้อมูล (Data Type)')}</label>
            <select id="modal-var-type" class="inspector-select" onchange="window.nodeCanvas.onModalTypeChange(this.value)">
              <option value="boolean" ${varType === 'boolean' ? 'selected' : ''}>🔘 Boolean (True / False - สีแดง)</option>
              <option value="number" ${varType === 'number' ? 'selected' : ''}>🔢 Number (ตัวเลขจำนวนเต็ม/ทศนิยม - สีฟ้า)</option>
              <option value="string" ${varType === 'string' ? 'selected' : ''}>📝 String (ข้อความตัวอักษร - สีชมพู)</option>
            </select>
          </div>

          <div class="inspector-field-group" style="margin-bottom:12px;">
            <label class="inspector-label">${canvasT('var_default_label', 'ค่าเริ่มต้น (Default Value)')}</label>
            <div id="modal-var-default-container">
              ${this.renderDefaultValueInputHTML(varType, defaultValue)}
            </div>
          </div>

          <div class="inspector-field-group" style="margin-bottom:16px;">
            <label class="inspector-label">${canvasT('var_desc_label', 'คำอธิบาย (Optional)')}</label>
            <input type="text" id="modal-var-desc" class="inspector-input" value="${desc}" placeholder="อธิบายหน้าที่ของตัวแปรนี้..." />
          </div>

          <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid rgba(255,255,255,0.08); padding-top:12px;">
            <button type="button" class="btn btn-ghost" onclick="window.nodeCanvas.closeVariableModal()">${canvasT('var_btn_cancel', 'ยกเลิก')}</button>
            <button type="submit" class="btn btn-hero-primary" style="background:linear-gradient(135deg, #a855f7, #6366f1); border-color:#a855f7;">${canvasT('var_btn_save', 'บันทึกตัวแปร')}</button>
          </div>
        </form>
      </div>
    `;

    modalEl.classList.add('show');
    const nameInput = document.getElementById('modal-var-name');
    if (nameInput) setTimeout(() => nameInput.focus(), 50);
  }

  onModalTypeChange(type) {
    const container = document.getElementById('modal-var-default-container');
    const curInput = document.getElementById('modal-var-default');
    const curVal = curInput ? curInput.value : '';
    if (container) {
      container.innerHTML = this.renderDefaultValueInputHTML(type, curVal);
    }
  }

  closeVariableModal() {
    const modalEl = document.getElementById('variable-editor-modal');
    if (modalEl) modalEl.classList.remove('show');
  }

  saveVariableFromModal(varId, targetNodeId) {
    const nameInput = document.getElementById('modal-var-name');
    const typeSelect = document.getElementById('modal-var-type');
    const defaultInput = document.getElementById('modal-var-default');
    const descInput = document.getElementById('modal-var-desc');

    if (!nameInput || !nameInput.value.trim()) return;

    const rawName = nameInput.value.trim().replace(/\s+/g, '_');
    const type = typeSelect ? typeSelect.value : 'boolean';
    const scope = 'global';
    const targetClient = 'all';
    let defaultValue = defaultInput ? defaultInput.value.trim() : '';
    if (type === 'boolean' && defaultValue !== 'true' && defaultValue !== 'false') defaultValue = 'false';
    const description = descInput ? descInput.value.trim() : '';

    if (!Array.isArray(this.variables)) this.variables = [];

    let oldName = null;
    if (varId) {
      const existing = this.variables.find(v => v.id === varId);
      if (existing) {
        oldName = existing.name;
        existing.name = rawName;
        existing.type = type;
        existing.scope = scope;
        existing.targetClient = targetClient;
        existing.defaultValue = defaultValue;
        existing.description = description;
      }
    } else {
      const dup = this.variables.find(v => v.name === rawName);
      if (dup) {
        dup.type = type;
        dup.scope = scope;
        dup.targetClient = targetClient;
        dup.defaultValue = defaultValue;
        dup.description = description;
      } else {
        this.variables.push({
          id: 'var_' + Math.random().toString(36).substring(2, 9),
          name: rawName,
          type,
          scope,
          targetClient,
          defaultValue,
          description
        });
      }
    }

    // If renamed, update nodes on canvas
    if (oldName && oldName !== rawName) {
      this.nodes.forEach(n => {
        if ((n.type === 'var_set' || n.type === 'variable' || n.type === 'var_get') && n.data?.varName === oldName) {
          n.data.varName = rawName;
          n.data.varType = type;
          n.data.scope = 'global';
          n.data.targetClient = 'all';
          if (n.title.includes(oldName)) {
            n.title = n.title.replace(oldName, rawName);
          }
        }
      });
      this.render();
    }

    this.closeVariableModal();
    this.renderVariablesPanel();
    this.onProfileChanged();

    if (targetNodeId) {
      this.selectVariableForNode(targetNodeId, rawName);
    }

    if (typeof window.toast === 'function') {
      window.toast(`✅ บันทึกตัวแปร "${rawName}" สำเร็จ`, 'success');
    }
  }

  selectVariableForNode(nodeId, varName) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const allVars = this.getAvailableVariables();
    const vObj = allVars.find(v => v.name === varName);

    if (!node.data) node.data = {};
    node.data.varName = varName;

    if (vObj) {
      node.data.varType = vObj.type;
      node.data.scope = 'global';
      node.data.targetClient = 'all';
      if (node.type === 'var_get') {
        node.data.defaultValue = vObj.defaultValue !== undefined ? vObj.defaultValue : '';
        node.title = 'Get ' + varName;
      } else {
        node.title = 'Set ' + varName;
        if (vObj.type === 'boolean' && node.data.operation !== 'toggle' && node.data.operation !== 'set_value' && node.data.operation !== 'set_true' && node.data.operation !== 'set_false' && node.data.operation !== 'reset') {
          node.data.operation = 'set_value';
        } else if (vObj.type === 'number' && node.data.operation !== 'set_value' && node.data.operation !== 'increment' && node.data.operation !== 'decrement' && node.data.operation !== 'reset') {
          node.data.operation = 'set_value';
        }
      }
    }

    this.render();
    this.openInspector(nodeId);
    this.onProfileChanged();
  }

  toggleOutliner(forceState = undefined) {
    this.togglePanel('outliner', forceState);
  }

  addHistory(icon, desc, saveSnapshot = true, details = '') {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const id = `hist_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const entry = {
      id,
      time: timeStr,
      icon: icon || '📝',
      desc: desc || 'แก้ไขข้อมูล',
      details: details || '',
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

    let isDirtyNow = false;
    try {
      if (typeof window.isDirty !== 'undefined') isDirtyNow = window.isDirty;
    } catch (e) { }

    const isEn = window.currentLang === 'en';

    let statusHeader = '';
    if (isDirtyNow) {
      statusHeader = `
        <div style="background:rgba(245, 158, 11, 0.12); border:1px solid rgba(245, 158, 11, 0.35); border-radius:8px; padding:9px 12px; margin-bottom:12px; font-size:11.5px; display:flex; align-items:center; justify-content:space-between; color:#fde68a;">
          <div style="display:flex; align-items:center; gap:6px;">
            <span>⚠️</span>
            <span style="font-weight:700;">${isEn ? 'Unsaved Changes Pending' : 'มีการแก้ไขที่ยังไม่ได้บันทึก'}</span>
          </div>
          <button type="button" onclick="if(window.onManualSaveProfile) window.onManualSaveProfile()" style="background:#eab308; color:#000; border:none; border-radius:5px; padding:4px 9px; font-size:10.5px; font-weight:800; cursor:pointer; display:flex; align-items:center; gap:4px;" title="Save (Ctrl+S)">
            💾 ${isEn ? 'Save' : 'บันทึก'}
          </button>
        </div>
      `;
    } else {
      statusHeader = `
        <div style="background:rgba(16, 185, 129, 0.1); border:1px solid rgba(16, 185, 129, 0.25); border-radius:8px; padding:7px 12px; margin-bottom:12px; font-size:11px; display:flex; align-items:center; gap:6px; color:#6ee7b7;">
          <span>✅</span>
          <span style="font-weight:600;">${isEn ? 'All changes saved to backend' : 'ข้อมูลล่าสุดถูกบันทึกแล้ว (ไม่มีงานค้าง)'}</span>
        </div>
      `;
    }

    if (this.historyTimeline.length === 0) {
      this.historyTimelineList.innerHTML = `
        ${statusHeader}
        <div style="font-size:12px; color:var(--muted); text-align:center; padding:24px 0;">
          ${isEn ? 'No edits recorded in this session yet.' : 'ยังไม่มีประวัติการแก้ไขในเซสชันนี้'}
        </div>
      `;
      return;
    }

    let html = statusHeader;
    this.historyTimeline.forEach((item, index) => {
      const isCurrent = (!this.currentHistoryId && index === 0) || item.id === this.currentHistoryId;
      html += `
        <div class="history-item ${isCurrent ? 'active' : ''}" onclick="window.nodeCanvas.jumpToHistory('${item.id}')" title="คลิกเพื่อย้อนเวลากลับไปยังจุดนี้ (${item.time})">
          <span class="history-item-icon">${item.icon}</span>
          <div class="history-item-content" style="flex:1; min-width:0;">
            <div class="history-item-desc" style="font-weight:600; word-break:break-word; color:#f1f5f9;">${item.desc}</div>
            ${item.details ? `<div style="font-size:10px; color:#94a3b8; font-family:'JetBrains Mono',monospace; margin-top:2px;">${item.details}</div>` : ''}
            <span class="history-item-time" style="font-size:10px; color:var(--muted); margin-top:3px; display:block;">🕒 ${item.time}</span>
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

  // Note: Inspector form renderers and controls have been modularized into /js/canvas-inspector.js
  updateNodeData(nodeId, key, value) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const oldVal = (key === 'title') ? node.title : (node.data ? node.data[key] : undefined);
    if (key === 'title') {
      node.title = value;
    } else {
      if (!node.data) node.data = {};
      node.data[key] = value;
    }

    // If cooldown was cleared or set to 0, auto-prune any onCooldown wire connections
    if ((key === 'cooldownPresetId' || key === 'customCooldownMs') && !this.hasCooldownGuard(node)) {
      this.connections = this.connections.filter(c => !(c.fromNodeId === nodeId && (c.fromPort === 'onCooldown' || c.fromPort === 'on_cooldown')));
      this.renderWires();
    }

    // If operation changed away from set_value on variable node, auto-prune val_in wire connections
    if (key === 'operation' && value !== 'set_value') {
      this.connections = this.connections.filter(c => !(c.toNodeId === nodeId && c.toPort === 'val_in'));
      this.renderWires();
    }

    this.renderNodes();
    const oldStr = typeof oldVal === 'object' ? JSON.stringify(oldVal) : String(oldVal ?? '');
    const newStr = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
    const detail = (oldVal !== undefined && oldStr !== newStr) ? `${key}: "${oldStr}" ➔ "${newStr}"` : `${key}: "${newStr}"`;
    this.addHistory('⚙️', `แก้ไข ${key} ของโหนด "${node.title || node.type}"`, true, detail);
    this.onProfileChanged();
  }

  setNodeOperation(nodeId, operation) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    const oldOp = node.data.operation || 'set_value';
    node.data.operation = operation;

    // When switching away from set_value, automatically prune any wires connected to val_in
    if (operation !== 'set_value') {
      const hadWire = this.connections.some(c => c.toNodeId === nodeId && c.toPort === 'val_in');
      if (hadWire) {
        this.connections = this.connections.filter(c => !(c.toNodeId === nodeId && c.toPort === 'val_in'));
        if (typeof window.toast === 'function') {
          window.toast(`✂️ ปลดสายออกจาก Value In อัตโนมัติ (${operation})`, 'info');
        }
      }
    }

    this.render();
    this.openInspector(nodeId);
    this.addHistory('⚙️', `เปลี่ยน Operation ของ "${node.title || node.type}" เป็น ${operation}`, true, `Operation: "${oldOp}" ➔ "${operation}"`);
    this.onProfileChanged();
  }

  updateNodeKeys(nodeId, valStr) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return;
    if (!node.data) node.data = {};
    node.data.keys = valStr.split(',').map(s => s.trim()).filter(Boolean);
    this.renderNodes();
    this.addHistory('⌨️', `แก้ไขคีย์ของโหนด "${node.title || node.type}"`, true, `คีย์ใหม่: [${valStr}]`);
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
    this.addHistory('🔀', `เพิ่ม Step ใน Macro "${node.title || node.type}"`, true, `ขั้นตอนที่ ${node.data.steps.length}`);
    this.onProfileChanged();
  }

  updateMacroStep(nodeId, stepIndex, field, value) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node || !node.data || !Array.isArray(node.data.steps)) return;
    if (node.data.steps[stepIndex]) {
      node.data.steps[stepIndex][field] = value;
      this.renderNodes();
      this.addHistory('🔀', `แก้ไขขั้นตอน #${stepIndex + 1} ใน "${node.title || node.type}"`, true, `${field}: ${value}`);
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

  // Note: exportProfileData() has been modularized into /js/canvas-serializer.js
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
      if (n.type === 'branch' || n.type === 'condition' || n.type === 'action_branch' || n.type === 'var_branch' || n.type === 'variable_branch') {
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

    // Check for illegal wire connections connected to this node
    const attachedConns = this.connections.filter(c => c.fromNodeId === node.id || c.toNodeId === node.id);
    for (const conn of attachedConns) {
      const fromMeta = this.getPortMeta(conn.fromNodeId, conn.fromPort, 'out');
      const toMeta = this.getPortMeta(conn.toNodeId, conn.toPort || 'exec_in', 'in');
      if (fromMeta.kind !== toMeta.kind) {
        return {
          severity: 'error',
          messageTh: `สายต่อผิดประเภท [${conn.fromPort}] ➔ [${conn.toPort || 'exec_in'}]`,
          messageEn: `Illegal Wire [${conn.fromPort}] ➔ [${conn.toPort || 'exec_in'}]`
        };
      }
    }

    // 2. Action Nodes: Check if unconnected from inputs (exec_in)
    // Validate that action nodes (including emergency_stop) receive an incoming trigger or remote reference
    const isPure = (node.type === 'var_get' || node.type === 'format_text');
    const isReferenced = this.isNodeReferencedRemotely(node);

    if (!isPure && !isReferenced) {
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
    } else if (node.type === 'action_branch' || node.type === 'branch' || node.type === 'condition') {
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
    } else if (node.type === 'var_branch' || node.type === 'variable_branch') {
      if (!node.data?.conditionTargetId && !node.data?.varName) {
        return {
          severity: 'warning',
          messageTh: 'ยังไม่ได้เลือกตัวแปรที่ต้องการตรวจสอบ',
          messageEn: 'No Variable selected to evaluate'
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

    // Boundary constraints for compact Blender menu
    const menuWidth = 220;
    const menuHeight = 175;
    const isNearRightEdge = (posX + 440 > containerRect.width);
    if (posX + menuWidth > containerRect.width - 20) {
      posX = Math.max(20, containerRect.width - menuWidth - 20);
    }
    if (posY + menuHeight > containerRect.height - 20) {
      posY = Math.max(20, containerRect.height - menuHeight - 20);
    }

    this.spotlightCatalog.style.left = `${Math.max(20, posX)}px`;
    this.spotlightCatalog.style.top = `${Math.max(20, posY)}px`;
    this.spotlightCatalog.style.display = 'flex';

    if (this.spotlightInput) {
      this.spotlightInput.value = '';
      setTimeout(() => this.spotlightInput.focus(), 50);
    }
    this.renderSpotlightCatalog('');

    // Apply open-left if close to right boundary
    const submenus = this.spotlightCatalog.querySelectorAll('.blender-submenu');
    submenus.forEach(sm => {
      if (isNearRightEdge) sm.classList.add('open-left');
      else sm.classList.remove('open-left');
    });
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
      const menuWidth = 220;
      const menuHeight = 175;

      if (triggerEl && typeof triggerEl.getBoundingClientRect === 'function') {
        const rect = triggerEl.getBoundingClientRect();
        clientX = Math.round(rect.left + (rect.width / 2) - (menuWidth / 2));
        clientY = Math.round(rect.top - menuHeight - 12);
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
        icon: '⚡',
        name: canvasT('cat_triggers', 'Triggers & Events'),
        items: [
          { type: 'trigger', icon: '⚡', name: this.getNodeTypeLabel('trigger') },
          { type: 'emit_event', icon: '📡', name: this.getNodeTypeLabel('emit_event') },
          { type: 'webhook_out', icon: '🌐', name: this.getNodeTypeLabel('webhook_out') }
        ]
      },
      {
        id: 'actions',
        icon: '🎮',
        name: canvasT('cat_actions', 'Actions & Macros'),
        items: [
          { type: 'loop_scheduler', icon: '⏱️', name: this.getNodeTypeLabel('loop_scheduler') },
          { type: 'loop', icon: '🔄', name: this.getNodeTypeLabel('loop') },
          { type: 'sequencer', icon: '⚔️', name: this.getNodeTypeLabel('sequencer') },
          { type: 'buff_sequence', icon: '🛡️', name: this.getNodeTypeLabel('buff_sequence') },
          { type: 'key_hold', icon: '⚓', name: this.getNodeTypeLabel('key_hold') },
          { type: 'key_press', icon: '⌨️', name: this.getNodeTypeLabel('key_press') },
          { type: 'forwarder', icon: '🔗', name: this.getNodeTypeLabel('forwarder') },
          { type: 'party_scanner', icon: '👁️', name: this.getNodeTypeLabel('party_scanner') },
          { type: 'party_slot', icon: '🎯', name: this.getNodeTypeLabel('party_slot') },
          { type: 'party_heal', icon: '🚑', name: this.getNodeTypeLabel('party_heal') },
          { type: 'party_buff', icon: '📜', name: this.getNodeTypeLabel('party_buff') },
          { type: 'macro_group', icon: '🔀', name: this.getNodeTypeLabel('macro_group') }
        ]
      },
      {
        id: 'flow',
        icon: '🌿',
        name: canvasT('cat_flow', 'Logic & Flow'),
        items: [
          { type: 'var_branch', icon: '📦', name: this.getNodeTypeLabel('var_branch') },
          { type: 'action_branch', icon: '⚡', name: this.getNodeTypeLabel('action_branch') },
          { type: 'var_set', icon: '📦', name: this.getNodeTypeLabel('var_set') },
          { type: 'var_get', icon: '📥', name: this.getNodeTypeLabel('var_get') },
          { type: 'control', icon: '🎛️', name: this.getNodeTypeLabel('control') },
          { type: 'delay', icon: '⏳', name: this.getNodeTypeLabel('delay') }
        ]
      },
      {
        id: 'utilities',
        icon: '🛡️',
        name: canvasT('cat_utilities', 'Safety & Utilities'),
        items: [
          { type: 'step_log', icon: '📝', name: this.getNodeTypeLabel('step_log') },
          { type: 'format_text', icon: '🧩', name: this.getNodeTypeLabel('format_text') },
          { type: 'emergency_stop', icon: '🛑', name: this.getNodeTypeLabel('emergency_stop') },
          { type: 'tts', icon: '🗣️', name: this.getNodeTypeLabel('tts') },
          { type: 'screenshot', icon: '📸', name: this.getNodeTypeLabel('screenshot') },
          { type: 'sound', icon: '🔊', name: this.getNodeTypeLabel('sound') }
        ]
      }
    ];

    // [v3.1 Dynamic Modular Nodes Injection]
    if (typeof window.clientNodeRegistry !== 'undefined') {
      const modularNodes = window.clientNodeRegistry.getAll();
      const existingTypes = new Set();
      categories.forEach(c => c.items.forEach(i => existingTypes.add(i.type)));

      const customItems = modularNodes
        .filter(n => !existingTypes.has(n.type))
        .map(n => ({
          type: n.type,
          icon: n.icon || '🧩',
          name: n.title || n.type
        }));

      if (customItems.length > 0) {
        categories.push({
          id: 'modular_nodes',
          icon: '🧩',
          name: window.currentLang === 'en' ? 'Modular Nodes (v3.1)' : 'โหนดโมดูลเสริม (v3.1)',
          items: customItems
        });
      }
    }

    let html = '';

    if (!q) {
      // 1. Blender Cascading Menu View (Default when not searching)
      html = `
        <div class="blender-menu-list">
          ${categories.map(cat => `
            <div class="blender-menu-item has-submenu">
              <div class="blender-item-main">
                <span class="blender-item-icon">${cat.icon}</span>
                <span class="blender-item-label">${cat.name}</span>
                <span class="blender-item-arrow">▶</span>
              </div>
              <div class="blender-submenu">
                ${cat.items.map(it => `
                  <div class="blender-sub-item" onclick="window.nodeCanvas.addNodeFromSpotlight('${it.type}')">
                    <span class="blender-sub-icon">${it.icon}</span>
                    <span class="blender-sub-label">${it.name}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      // 2. Search Results View (Compact Flat List)
      let matchedItems = [];
      categories.forEach(cat => {
        cat.items.forEach(it => {
          if (it.name.toLowerCase().includes(q) || it.type.toLowerCase().includes(q)) {
            matchedItems.push(it);
          }
        });
      });

      if (matchedItems.length > 0) {
        html = `
          <div class="blender-search-list">
            ${matchedItems.map(it => `
              <div class="blender-sub-item search-match" onclick="window.nodeCanvas.addNodeFromSpotlight('${it.type}')">
                <span class="blender-sub-icon">${it.icon}</span>
                <span class="blender-sub-label">${it.name}</span>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        html = `
          <div class="blender-empty-search">
            ${window.currentLang === 'en' ? `No nodes matching "${query}"` : `ไม่พบคำสั่ง "${query}"`}
          </div>
        `;
      }
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

if (typeof window !== 'undefined') {
  window.NodeCanvasEditor = NodeCanvasEditor;
  window.triggerCanvasNodePulse = (actionIdOrNodeId, fromPort = null) => {
    if (!window.nodeCanvas) return;
    const node = window.nodeCanvas.nodes.find(n => n.id === actionIdOrNodeId || n.data?.actionId === actionIdOrNodeId);
    if (node) {
      window.nodeCanvas.triggerSignalPulse(node.id, fromPort);
    }
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NodeCanvasEditor };
}
