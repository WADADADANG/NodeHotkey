/**
 * public/js/components/node-docs.js
 * NodeHotkey Reusable Interactive Node Documentation Component
 * Unreal Engine Blueprint Inspired Layout with Structured Categorization
 */

(function(global) {
  'use strict';

  class NodeDocsComponent {
    constructor(options = {}) {
      this.container = typeof options.container === 'string'
        ? document.querySelector(options.container)
        : options.container;

      if (!this.container) {
        throw new Error('[NodeDocsComponent] Invalid container provided.');
      }

      this.dataModule = options.dataModule || global.NodeDocsData;
      if (!this.dataModule || !Array.isArray(this.dataModule.catalog)) {
        throw new Error('[NodeDocsComponent] NodeDocsData catalog is not loaded.');
      }

      this.lang = options.lang || 'th';
      this.currentCategory = options.initialCategory || 'all';
      this.searchQuery = '';
      this.selectedType = options.initialNodeType || (this.dataModule.catalog[0] ? this.dataModule.catalog[0].type : '');
      this.collapsedGroups = new Set();
      this.onSelect = typeof options.onSelect === 'function' ? options.onSelect : null;

      this.init();
    }

    getIcon(name, size = 16, className = '') {
      if (global.NodeDocsIcons && typeof global.NodeDocsIcons.render === 'function') {
        return global.NodeDocsIcons.render(name, { size, className });
      }
      return `<span class="node-docs-icon-fallback ${className}">${name}</span>`;
    }

    init() {
      const isEn = this.lang === 'en';
      this.container.innerHTML = `
        <div class="node-docs-wrapper">
          <!-- Left Nav Sidebar -->
          <aside class="node-docs-sidebar">
            <div class="node-docs-sidebar-header">
              <div class="node-docs-brand">
                <div class="node-docs-brand-title">
                  <span>${this.getIcon('book-open', 16)}</span>
                  <span class="docs-lbl-brand-title">${isEn ? 'Node Blueprint Wiki' : 'คู่มือ Action Node (Wiki)'}</span>
                </div>
                <span class="node-docs-brand-badge" id="docs-badge-total">${this.dataModule.catalog.length} Nodes</span>
              </div>
              <div class="node-docs-search-box">
                <span class="node-docs-search-icon">${this.getIcon('search', 14)}</span>
                <input type="text" class="node-docs-search-input" id="docs-search-input" placeholder="${isEn ? 'Search by name, key, or category...' : 'ค้นหาตามชื่อ, คีย์เวิร์ด, หรือหมวดหมู่...'}" />
              </div>
            </div>
            
            <!-- Category Filter Dropdown -->
            <div class="node-docs-filter-bar">
              <span class="node-docs-filter-label">${isEn ? 'Filter:' : 'หมวดหมู่:'}</span>
              <select class="node-docs-category-select" id="docs-category-select"></select>
            </div>
            
            <!-- Accordion Grouped List -->
            <div class="node-docs-list-scroll" id="docs-nodes-list"></div>
          </aside>

          <!-- Right Content Area -->
          <main class="node-docs-content" id="docs-main-content">
            <!-- Dynamic details rendered here -->
          </main>
        </div>
      `;

      this.domSearchInput = this.container.querySelector('#docs-search-input');
      this.domCategorySelect = this.container.querySelector('#docs-category-select');
      this.domNodesList = this.container.querySelector('#docs-nodes-list');
      this.domMainContent = this.container.querySelector('#docs-main-content');

      // Bind search input
      this.domSearchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target.value || '').trim().toLowerCase();
        this.renderNodeList();
      });

      // Bind category select
      this.domCategorySelect.addEventListener('change', (e) => {
        this.currentCategory = e.target.value;
        this.renderNodeList();
      });

      this.renderCategorySelect();
      this.renderNodeList();
      this.renderNodeDetails(this.selectedType);
    }

    setLanguage(newLang) {
      if (this.lang === newLang) return;
      this.lang = newLang;
      const isEn = this.lang === 'en';

      if (this.domSearchInput) {
        this.domSearchInput.placeholder = isEn ? 'Search by name, key, or category...' : 'ค้นหาตามชื่อ, คีย์เวิร์ด, หรือหมวดหมู่...';
      }
      const brandTitle = this.container.querySelector('.docs-lbl-brand-title');
      if (brandTitle) {
        brandTitle.textContent = isEn ? 'Node Blueprint Wiki' : 'คู่มือ Action Node (Wiki)';
      }
      const filterLbl = this.container.querySelector('.node-docs-filter-label');
      if (filterLbl) {
        filterLbl.textContent = isEn ? 'Filter:' : 'หมวดหมู่:';
      }

      this.renderCategorySelect();
      this.renderNodeList();
      this.renderNodeDetails(this.selectedType);
    }

    renderCategorySelect() {
      const isEn = this.lang === 'en';
      let optionsHtml = '';
      this.dataModule.categories.forEach(cat => {
        const count = cat.id === 'all'
          ? this.dataModule.catalog.length
          : this.dataModule.catalog.filter(n => n.category === cat.id).length;
        const label = isEn ? cat.labelEn : cat.labelTh;
        const isSelected = cat.id === this.currentCategory;
        optionsHtml += `<option value="${cat.id}" ${isSelected ? 'selected' : ''}>${label} (${count})</option>`;
      });
      this.domCategorySelect.innerHTML = optionsHtml;
    }

    renderNodeList() {
      const isEn = this.lang === 'en';
      const q = this.searchQuery;

      // Group catalog by category
      const categoriesToShow = this.dataModule.categories.filter(c => c.id !== 'all' && (this.currentCategory === 'all' || this.currentCategory === c.id));
      
      let html = '';
      let totalVisible = 0;

      categoriesToShow.forEach(cat => {
        let nodesInCat = this.dataModule.catalog.filter(n => n.category === cat.id);

        if (q) {
          nodesInCat = nodesInCat.filter(node => {
            const matchType = node.type.toLowerCase().includes(q);
            const matchTitleTh = (node.titleTh || '').toLowerCase().includes(q);
            const matchTitleEn = (node.titleEn || '').toLowerCase().includes(q);
            const matchDescTh = (node.descTh || '').toLowerCase().includes(q);
            const matchDescEn = (node.descEn || '').toLowerCase().includes(q);
            const matchBadge = (node.badge || '').toLowerCase().includes(q);
            return matchType || matchTitleTh || matchTitleEn || matchDescTh || matchDescEn || matchBadge;
          });
        }

        if (nodesInCat.length === 0) return;
        totalVisible += nodesInCat.length;

        // Auto-expand when searching
        const isCollapsed = q ? false : this.collapsedGroups.has(cat.id);
        const catLabel = isEn ? cat.labelEn : cat.labelTh;

        html += `
          <div class="node-docs-cat-group ${isCollapsed ? 'collapsed' : ''}" data-cat="${cat.id}">
            <div class="node-docs-group-header" data-cat="${cat.id}">
              <div class="group-header-left" style="color: ${cat.color || '#fff'};">
                <span class="group-icon">${this.getIcon(cat.icon, 14)}</span>
                <span class="group-title">${catLabel}</span>
              </div>
              <div class="group-header-right">
                <span class="group-badge">${nodesInCat.length}</span>
                <span class="group-chevron">${this.getIcon('chevron-down', 11)}</span>
              </div>
            </div>
            <div class="node-docs-group-items">
              ${nodesInCat.map(node => {
                if (!node || !node.type) return '';
                const isActive = node.type === this.selectedType;
                const nodeTitle = isEn ? (node.titleEn || node.titleTh || node.type) : (node.titleTh || node.titleEn || node.type);
                const iconHtml = this.getIcon(node.icon || 'layers', 14);
                return `
                  <div class="node-docs-nav-item ${isActive ? 'active' : ''}" data-type="${node.type}">
                    <div class="node-docs-nav-icon" style="background:${cat.color || '#3b82f6'}22; color:${cat.color || '#3b82f6'};">
                      ${iconHtml}
                    </div>
                    <div class="node-docs-nav-info">
                      <div class="node-docs-nav-name" title="${nodeTitle}">${nodeTitle}</div>
                      <div class="node-docs-nav-sub">${node.type}</div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      });

      if (totalVisible === 0) {
        html = `
          <div style="padding: 30px 14px; text-align: center; color: #64748b; font-size: 12px;">
            <div style="margin-bottom: 8px;">${this.getIcon('search', 28)}</div>
            <div>${isEn ? 'No Action Nodes found matching your query.' : 'ไม่พบ Action Node ที่ตรงกับคำค้นหา'}</div>
          </div>
        `;
      }

      this.domNodesList.innerHTML = html;

      // Bind group accordion toggle clicks
      this.domNodesList.querySelectorAll('.node-docs-group-header').forEach(header => {
        header.addEventListener('click', (e) => {
          const group = header.closest('.node-docs-cat-group');
          const catId = header.dataset.cat;
          if (group) {
            group.classList.toggle('collapsed');
            if (group.classList.contains('collapsed')) {
              this.collapsedGroups.add(catId);
            } else {
              this.collapsedGroups.delete(catId);
            }
          }
        });
      });

      // Bind item click listeners
      this.domNodesList.querySelectorAll('.node-docs-nav-item').forEach(el => {
        el.addEventListener('click', () => {
          const type = el.dataset.type;
          this.selectedType = type;
          this.domNodesList.querySelectorAll('.node-docs-nav-item').forEach(i => i.classList.remove('active'));
          el.classList.add('active');
          this.renderNodeDetails(type);
          if (this.onSelect) this.onSelect(type);
        });
      });
    }

    renderNodeDetails(type) {
      const node = this.dataModule.getNodeDoc(type);
      if (!node) {
        this.domMainContent.innerHTML = `
          <div class="node-docs-content-inner" style="display:flex; align-items:center; justify-content:center; min-height:300px;">
            <div style="padding: 40px; text-align: center; color: #64748b;">
              <h2>${this.lang === 'en' ? 'Select an Action Node' : 'กรุณาเลือก Action Node'}</h2>
            </div>
          </div>
        `;
        return;
      }

      const isEn = this.lang === 'en';
      const title = isEn ? (node.titleEn || node.titleTh) : (node.titleTh || node.titleEn);
      const desc = isEn ? (node.descEn || node.descTh) : (node.descTh || node.descEn);
      const bestPractice = isEn ? (node.bestPracticeEn || node.bestPracticeTh) : (node.bestPracticeTh || node.bestPracticeEn);

      // Find Category Info
      const catInfo = this.dataModule.categories.find(c => c.id === node.category) || {
        id: node.category,
        icon: '🧩',
        labelTh: node.category,
        labelEn: node.category,
        color: node.color || '#3b82f6'
      };
      const catLabel = isEn ? catInfo.labelEn : catInfo.labelTh;

      // Find Previous & Next Nodes in Catalog
      const allNodes = this.dataModule.catalog;
      const currentIndex = allNodes.findIndex(n => n.type === node.type);
      const prevNode = currentIndex > 0 ? allNodes[currentIndex - 1] : null;
      const nextNode = currentIndex < allNodes.length - 1 ? allNodes[currentIndex + 1] : null;

      // 1. Hero Header
      let html = `
        <div class="node-docs-hero">
          <div class="node-docs-hero-left">
            <div class="node-docs-hero-icon" style="background:${catInfo.color}22; color:${catInfo.color}; border:1px solid ${catInfo.color}55;">
              ${this.getIcon(node.icon, 24)}
            </div>
            <div class="node-docs-hero-title-group">
              <div class="node-docs-hero-title-wrap">
                <h1 class="node-docs-hero-title">${title}</h1>
                <span class="node-docs-category-pill" style="background:${catInfo.color}22; color:${catInfo.color}; border:1px solid ${catInfo.color}55;">
                  <span>${this.getIcon(catInfo.icon, 13)}</span>
                  <span>${catLabel}</span>
                </span>
                ${node.badge ? `<span class="node-docs-badge-pill">${node.badge}</span>` : ''}
              </div>
              <div class="node-docs-hero-sub">
                <span>Node Type: <code>${node.type}</code></span>
                <span>•</span>
                <span>Category: <strong>${catLabel}</strong></span>
              </div>
            </div>
          </div>
        </div>
      `;

      // 2. Overview / Role Description
      html += `
        <div class="node-docs-section">
          <div class="node-docs-sec-head">
            <span style="display:inline-flex; align-items:center; gap:6px;">${this.getIcon('file-text', 14)} <span>${isEn ? 'Overview & Function' : 'หน้าที่และบทบาทการทำงาน'}</span></span>
          </div>
          <div class="node-docs-desc-box" style="border-left-color:${catInfo.color};">
            ${desc}
          </div>
        </div>
      `;

      // 3. Configuration Parameters Table (Bilingual + Styled Types)
      const params = Array.isArray(node.parameters) ? node.parameters : [];
      html += `
        <div class="node-docs-section">
          <div class="node-docs-sec-head">
            <span style="display:inline-flex; align-items:center; gap:6px;">${this.getIcon('sliders', 14)} <span>${isEn ? 'Configuration Parameters' : 'พารามิเตอร์และการตั้งค่า'}</span></span>
            <span style="font-size:10.5px; font-weight:600; color:var(--docs-text-dim); text-transform:none;">${params.length} ${isEn ? 'Fields' : 'รายการ'}</span>
          </div>

          <div class="node-docs-table-wrap">
            <table class="node-docs-table">
              <thead>
                <tr>
                  <th style="width: 25%;">${isEn ? 'Field / Key' : 'ชื่อพารามิเตอร์ (Field)'}</th>
                  <th style="width: 15%;">${isEn ? 'Data Type' : 'ชนิดข้อมูล (Type)'}</th>
                  <th style="width: 18%;">${isEn ? 'Default Value' : 'ค่าเริ่มต้น (Default)'}</th>
                  <th style="width: 42%;">${isEn ? 'Description & Usage' : 'คำอธิบายการตั้งค่า'}</th>
                </tr>
              </thead>
              <tbody>
                ${params.length === 0 ? `
                  <tr>
                    <td colspan="4" style="text-align:center; color:#64748b; font-style:italic; padding:18px;">
                      ${isEn ? 'This node has no configurable parameters.' : 'โหนดนี้ไม่มีพารามิเตอร์ที่ต้องตั้งค่าเพิ่มเติม'}
                    </td>
                  </tr>
                ` : params.map(param => {
                  const paramTitle = isEn 
                    ? (param.nameEn || param.nameTh || param.name || param.key)
                    : (param.nameTh || param.nameEn || param.name || param.key);
                  const paramDesc = isEn
                    ? (param.descEn || param.descTh || '-')
                    : (param.descTh || param.descEn || '-');
                  const pType = param.type || 'string';
                  const defVal = param.default !== undefined && param.default !== '' ? JSON.stringify(param.default) : '-';

                  return `
                    <tr>
                      <td>
                        <div class="param-name-cell">
                          <span class="param-name-title">${paramTitle}</span>
                          <span class="param-name-key">${param.key}</span>
                        </div>
                      </td>
                      <td>
                        <span class="type-pill ${pType}">${pType}</span>
                      </td>
                      <td>
                        <code class="default-val-badge">${defVal}</code>
                      </td>
                      <td>
                        <div style="font-size:11.5px; line-height:1.4; color:#cbd5e1;">${paramDesc}</div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // 5. Blueprint Wiring Example
      if (node.exampleBlueprint) {
        html += `
          <div class="node-docs-section">
            <div class="node-docs-sec-head">
              <span style="display:inline-flex; align-items:center; gap:6px;">${this.getIcon('workflow', 14)} <span>${isEn ? 'Blueprint Wiring & Architecture Pattern' : 'ตัวอย่างการต่อสาย (Blueprint Wiring Architecture)'}</span></span>
            </div>
            <div class="node-docs-code-card">
              <div class="node-docs-code-head">
                <span>${isEn ? 'Recommended Workflow Pattern' : 'รูปแบบผังงานแนะนำ'}</span>
              </div>
              <pre class="node-docs-code-pre"><code>${node.exampleBlueprint}</code></pre>
            </div>
          </div>
        `;
      }

      // 6. Pro Tips & Strategy
      if (bestPractice) {
        html += `
          <div class="node-docs-section">
            <div class="node-docs-tip-callout">
              <span style="color:#fbbf24; display:inline-flex; align-items:center; flex-shrink:0;">${this.getIcon('lightbulb', 20)}</span>
              <div>
                <strong>${isEn ? 'Pro Tip & Botting Strategy:' : 'เคล็ดลับ & กลยุทธ์การใช้งาน:'}</strong> ${bestPractice}
              </div>
            </div>
          </div>
        `;
      }

      // 7. Navigation Footer (Previous / Next Node)
      html += `
        <div class="node-docs-footer-nav">
          <button type="button" class="node-docs-nav-page-btn" id="docs-btn-prev-node" ${!prevNode ? 'disabled' : ''}>
            <span>${this.getIcon('chevron-left', 13)}</span>
            <span>${prevNode ? (isEn ? (prevNode.titleEn || prevNode.titleTh) : (prevNode.titleTh || prevNode.titleEn)) : (isEn ? 'Previous' : 'ก่อนหน้า')}</span>
          </button>
          
          <span style="font-size:11px; color:var(--docs-text-dim);">
            ${currentIndex + 1} / ${allNodes.length} Nodes
          </span>

          <button type="button" class="node-docs-nav-page-btn" id="docs-btn-next-node" ${!nextNode ? 'disabled' : ''}>
            <span>${nextNode ? (isEn ? (nextNode.titleEn || nextNode.titleTh) : (nextNode.titleTh || nextNode.titleEn)) : (isEn ? 'Next' : 'ถัดไป')}</span>
            <span>${this.getIcon('chevron-right', 13)}</span>
          </button>
        </div>
      `;

      this.domMainContent.innerHTML = `
        <div class="node-docs-content-inner">
          ${html}
        </div>
      `;

      // Bind Prev / Next Buttons
      const btnPrev = this.domMainContent.querySelector('#docs-btn-prev-node');
      if (btnPrev && prevNode) {
        btnPrev.addEventListener('click', () => {
          this.selectedType = prevNode.type;
          this.renderNodeList();
          this.renderNodeDetails(prevNode.type);
          this.domMainContent.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }

      const btnNext = this.domMainContent.querySelector('#docs-btn-next-node');
      if (btnNext && nextNode) {
        btnNext.addEventListener('click', () => {
          this.selectedType = nextNode.type;
          this.renderNodeList();
          this.renderNodeDetails(nextNode.type);
          this.domMainContent.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
    }
  }

  global.NodeDocsComponent = NodeDocsComponent;

})(typeof window !== 'undefined' ? window : global);
