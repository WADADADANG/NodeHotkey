import { currentLang, TRANSLATIONS, t } from './i18n.js';
import { syncActionFromDom, renderActions } from './components/actions.js';
import { validateProfile } from './validator.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export let fullConfig = { activeProfile: '', activeProfiles: [], profiles: {} };
export let currentEditProfile = 'Default';
export let activeClients = [];

let renderActionsCallback = null;
export let isDirty = false;
export const undoStack = [];
export const redoStack = [];
const MAX_HISTORY = 30;

export function updateUnsavedBadge() {
  const badge = document.getElementById('unsaved-changes-badge');
  const saveBtn = document.getElementById('btn-save-profile');
  const canvasSaveBtn = document.getElementById('btn-canvas-save');
  const isEn = (typeof currentLang !== 'undefined' ? currentLang : 'th') === 'en';

  if (badge) {
    badge.style.display = isDirty ? 'inline-flex' : 'none';
  }
  if (canvasSaveBtn) {
    if (isDirty) {
      canvasSaveBtn.classList.add('btn-save-dirty');
      canvasSaveBtn.setAttribute('title', isEn ? '⚠️ Unsaved Changes! Click to Save (Ctrl+S)' : '⚠️ มีการแก้ไขที่ยังไม่ได้บันทึก! คลิกเพื่อเซฟ (Ctrl+S)');
    } else {
      canvasSaveBtn.classList.remove('btn-save-dirty');
      canvasSaveBtn.setAttribute('title', isEn ? 'Save Profile (Ctrl+S)' : 'บันทึกโปรไฟล์ (Ctrl+S)');
    }
  }
  if (saveBtn) {
    if (isDirty) {
      saveBtn.style.boxShadow = '0 0 14px rgba(245, 158, 11, 0.7)';
      saveBtn.classList.add('dirty');
    } else {
      saveBtn.style.boxShadow = 'none';
      saveBtn.classList.remove('dirty');
    }
  }
  updateUndoRedoButtons();
}

export function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  const canvasUndoBtn = document.getElementById('btn-canvas-undo');
  const canvasRedoBtn = document.getElementById('btn-canvas-redo');

  if (undoBtn) undoBtn.disabled = undoStack.length === 0;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
  if (canvasUndoBtn) canvasUndoBtn.disabled = undoStack.length === 0;
  if (canvasRedoBtn) canvasRedoBtn.disabled = redoStack.length === 0;
}

export function recordSnapshot(skipRedoClear = false) {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile) return;

  const snapshot = {
    profileName: currentEditProfile,
    data: JSON.parse(JSON.stringify(profile))
  };

  undoStack.push(snapshot);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  if (!skipRedoClear) redoStack.length = 0;

  isDirty = true;
  updateUnsavedBadge();
}

export function triggerUndo() {
  if (undoStack.length === 0) return;

  const currentProfile = fullConfig.profiles[currentEditProfile];
  if (currentProfile) {
    redoStack.push({
      profileName: currentEditProfile,
      data: JSON.parse(JSON.stringify(currentProfile))
    });
  }

  const prev = undoStack.pop();
  if (prev && prev.data) {
    fullConfig.profiles[prev.profileName] = prev.data;
    currentEditProfile = prev.profileName;
    loadProfileToUI(prev.data);
    isDirty = true;
    updateUnsavedBadge();
    if (typeof window.toast === 'function') {
      window.toast('↩️ ย้อนกลับการกระทำแล้ว (Undo)', 'info');
    }
  }
}

export function triggerRedo() {
  if (redoStack.length === 0) return;

  const currentProfile = fullConfig.profiles[currentEditProfile];
  if (currentProfile) {
    undoStack.push({
      profileName: currentEditProfile,
      data: JSON.parse(JSON.stringify(currentProfile))
    });
  }

  const next = redoStack.pop();
  if (next && next.data) {
    fullConfig.profiles[next.profileName] = next.data;
    currentEditProfile = next.profileName;
    loadProfileToUI(next.data);
    isDirty = true;
    updateUnsavedBadge();
    if (typeof window.toast === 'function') {
      window.toast('↪️ ทำซ้ำการกระทำแล้ว (Redo)', 'info');
    }
  }
}

export function toggleCanvasFullscreen() {
  const canvasWrapper = document.getElementById('node-canvas-container');
  const btn = document.getElementById('btn-fullscreen-toggle');
  const canvasBtn = document.getElementById('btn-canvas-fullscreen');

  if (!canvasWrapper) return;

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
    canvasWrapper.classList.remove('fullscreen-mode');
    if (btn) btn.innerHTML = '⛶ เต็มจอ';
    if (canvasBtn) canvasBtn.innerHTML = '⛶';
  } else {
    if (canvasWrapper.requestFullscreen) {
      canvasWrapper.requestFullscreen().catch(() => {
        canvasWrapper.classList.toggle('fullscreen-mode');
      });
    } else {
      canvasWrapper.classList.toggle('fullscreen-mode');
    }
    if (btn) btn.innerHTML = '🗗 ย่อจอ';
    if (canvasBtn) canvasBtn.innerHTML = '🗗';
  }
}

export function setRenderActionsCallback(cb) {
  renderActionsCallback = cb;
}

export function setCurrentEditProfile(val) {
  currentEditProfile = val;
}

export function setFullConfig(cfg) {
  fullConfig = cfg;
}

export function setActiveClients(clients) {
  activeClients = clients;
}

export function loadConfig() {
  fetch('/api/config', { cache: 'no-store' })
    .then(r => r.json())
    .then(cfg => {
      if (cfg && cfg.profiles) {
        fullConfig = cfg;
        if (!Array.isArray(fullConfig.activeProfiles) || fullConfig.activeProfiles.length === 0) {
          fullConfig.activeProfiles = [fullConfig.activeProfile || 'Default'];
        }

        // Restore last viewed editing profile from localStorage if exists
        const lastViewed = localStorage.getItem('nodehotkey_last_viewed_profile');
        if (lastViewed && cfg.profiles[lastViewed]) {
          currentEditProfile = lastViewed;
        } else {
          currentEditProfile = cfg.activeProfile || Object.keys(cfg.profiles)[0] || 'Default';
        }

        populateProfileDropdowns();
        loadGlobalSettingsToUI();
        loadProfileToUI(fullConfig.profiles[currentEditProfile]);
        pollActiveClients();

        isDirty = false;
        undoStack.length = 0;
        redoStack.length = 0;
        updateUnsavedBadge();
      }
    })
    .catch(err => {
      if (typeof window.toast === 'function') {
        window.toast(t('toastLoadConfigErr') + ': ' + err.message, 'error');
      }
    });
}

export function syncGlobalSettingsFromDOM() {
  if (!fullConfig.globalSettings) fullConfig.globalSettings = {};
  const gs = fullConfig.globalSettings;

  const urlInput = document.getElementById('target-url-keyword');
  if (urlInput) {
    gs.targetUrlKeyword = urlInput.value.trim() || 'universe.flyff.com';
  }

  const checkbox = document.getElementById('enable-overlay-checkbox');
  if (checkbox) {
    gs.enableOverlay = !!checkbox.checked;
  }

  const appModeCb = document.getElementById('enable-app-mode-checkbox');
  if (appModeCb) {
    gs.useAppMode = !!appModeCb.checked;
  }

  const suspendInput = document.getElementById('suspend-hotkey-input');
  if (suspendInput) {
    gs.suspendHotkey = suspendInput.value.trim();
  }

  const gmEnabled = document.getElementById('ghost-mouse-enabled');
  const gmMin = document.getElementById('ghost-mouse-interval-min');
  const gmMax = document.getElementById('ghost-mouse-interval-max');
  const gmOffset = document.getElementById('ghost-mouse-max-offset');

  if (gmEnabled) {
    gs.ghostMouseJitter = {
      enabled: !!gmEnabled.checked,
      intervalMin: gmMin ? parseInt(gmMin.value) || 8000 : 8000,
      intervalMax: gmMax ? parseInt(gmMax.value) || 25000 : 25000,
      maxOffset: gmOffset ? parseInt(gmOffset.value) || 12 : 12
    };
  }

  if (!gs.clientAliases) gs.clientAliases = {};
  for (let i = 1; i <= 8; i++) {
    const el = document.getElementById(`client-alias-${i}`);
    if (el) {
      gs.clientAliases[String(i)] = el.value.trim();
    }
  }

  // Mirror globalSettings to all profiles for backward compatibility
  Object.values(fullConfig.profiles || {}).forEach(prof => {
    prof.targetUrlKeyword = gs.targetUrlKeyword;
    prof.enableOverlay = gs.enableOverlay;
    prof.suspendHotkey = gs.suspendHotkey;
    prof.ghostMouseJitter = gs.ghostMouseJitter;
    prof.clientAliases = gs.clientAliases;
    if (gs.clientUserAgents) prof.clientUserAgents = gs.clientUserAgents;
    if (gs.clientProxies) prof.clientProxies = gs.clientProxies;
    if (gs.clientBrowsers) prof.clientBrowsers = gs.clientBrowsers;
    if (gs.clientMuteAudio) prof.clientMuteAudio = gs.clientMuteAudio;
    if (gs.clientFpsLimit) prof.clientFpsLimit = gs.clientFpsLimit;
    if (gs.clientRamLimit) prof.clientRamLimit = gs.clientRamLimit;
    if (gs.clientScale1x) prof.clientScale1x = gs.clientScale1x;
  });
}

export function saveCurrentProfile(recordUndo = true) {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile) return;

  if (recordUndo) {
    recordSnapshot();
  }

  if (profile.actions && Array.isArray(profile.actions)) {
    profile.actions.forEach(a => syncActionFromDom(a.id));
  }

  syncGlobalSettingsFromDOM();
  isDirty = true;
  updateUnsavedBadge();
}

export function commitConfigToBackend(onSuccessCallback = null) {
  return fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullConfig)
  })
    .then(r => r.json())
    .then(res => {
      if (res && res.success) {
        isDirty = false;
        updateUnsavedBadge();
        if (typeof onSuccessCallback === 'function') onSuccessCallback();
      } else {
        throw new Error(res.error || 'Server error saving config');
      }
    })
    .catch(err => {
      console.error('Failed to commit config to backend:', err);
      if (typeof window.toast === 'function') {
        window.toast(`❌ Sync error: ${err.message}`, 'error');
      }
    });
}

export function onManualSaveProfile() {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile) return;

  if (window.nodeCanvas && typeof window.nodeCanvas.exportProfileData === 'function') {
    const canvasData = window.nodeCanvas.exportProfileData();
    profile.version = canvasData.version;
    profile.canvas = canvasData.canvas;
    profile.nodes = canvasData.nodes;
    profile.connections = canvasData.connections;
    delete profile.actions;
  }
  syncGlobalSettingsFromDOM();

  commitConfigToBackend(() => {
    const msg = currentLang === 'en' 
      ? `💾 Profile "${currentEditProfile}" saved to file successfully!` 
      : `💾 บันทึกโปรไฟล์ "${currentEditProfile}" ลงไฟล์เรียบร้อยแล้ว!`;
    if (typeof window.toast === 'function') {
      window.toast(msg, 'success');
    }
  });

  if (profile.actions && Array.isArray(profile.actions)) {
    const { issues } = validateProfile(profile.actions);
    if (issues.length > 0) {
      if (typeof window.openValidatorModal === 'function') {
        window.openValidatorModal();
      }
    }
  }
}

export function isProfileActive(name) {
  if (!fullConfig.activeProfiles || !Array.isArray(fullConfig.activeProfiles)) {
    return fullConfig.activeProfile === name;
  }
  return fullConfig.activeProfiles.includes(name);
}

export function updateActiveToggleBtn() {
  const btn = document.getElementById('btn-toggle-active-profile');
  const icon = document.getElementById('active-toggle-icon');
  const text = document.getElementById('active-toggle-text');
  if (!btn) return;

  const isActive = isProfileActive(currentEditProfile);
  if (isActive) {
    btn.style.borderColor = '#10b981';
    btn.style.color = '#10b981';
    btn.style.background = 'rgba(16,185,129,0.12)';
    if (icon) icon.textContent = '🟢';
    if (text) text.textContent = 'Active';
  } else {
    btn.style.borderColor = 'rgba(255,255,255,0.2)';
    btn.style.color = 'var(--muted)';
    btn.style.background = 'rgba(255,255,255,0.04)';
    if (icon) icon.textContent = '⚪';
    if (text) text.textContent = 'Inactive';
  }
}

// Profile Grouping Helpers (without emojis)
export function getProfileGroup(name) {
  if (!name || typeof name !== 'string') return 'General';
  const match = name.match(/^\[([^\]]+)\]/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return 'General';
}

export function groupProfileNames(names) {
  const groups = {};
  names.forEach(name => {
    const grp = getProfileGroup(name);
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(name);
  });
  return groups;
}

let activeProfilesFilterTag = 'ALL';
window.activeProfilesFilterTag = activeProfilesFilterTag;

export function renderActiveProfilesPills() {
  const summaryEl = document.getElementById('active-profiles-summary');
  const countBadgeEl = document.getElementById('active-profiles-count-badge');
  const listEl = document.getElementById('active-profiles-list');
  if (!summaryEl || !listEl) return;

  const names = Object.keys(fullConfig.profiles || {}).sort((a, b) => {
    if (a === 'Default') return -1;
    if (b === 'Default') return 1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });

  const activeList = Array.isArray(fullConfig.activeProfiles) ? fullConfig.activeProfiles : [];
  const activeSet = new Set(activeList);

  // 1. Update Dropdown Summary Bar
  const tNone = TRANSLATIONS[currentLang]?.activeProfilesNone || (currentLang === 'en' ? 'No profiles active (0 Active - Inactive)' : 'ไม่ได้เลือกโปรไฟล์ทำงาน (0 Active - ปิดทั้งหมด)');
  const tEditing = TRANSLATIONS[currentLang]?.activeProfilesEditingBadge || (currentLang === 'en' ? 'Editing' : 'กำลังแก้ไข');
  const tActiveSuffix = currentLang === 'en' ? 'Active' : 'เปิดทำงาน';

  if (activeList.length === 0) {
    summaryEl.innerHTML = `<span style="color:var(--muted); font-weight:500;">${tNone}</span>`;
    if (countBadgeEl) {
      countBadgeEl.textContent = `0 ${tActiveSuffix} ▾`;
      countBadgeEl.style.background = 'rgba(255,255,255,0.06)';
      countBadgeEl.style.color = 'var(--muted)';
      countBadgeEl.style.borderColor = 'transparent';
    }
  } else {
    const displayNames = activeList.slice(0, 3).join(', ');
    const moreText = activeList.length > 3 ? ` +${activeList.length - 3} more` : '';
    summaryEl.innerHTML = `<span style="color:#34d399; font-weight:700;">🟢 ${displayNames}${moreText}</span>`;
    if (countBadgeEl) {
      countBadgeEl.textContent = `${activeList.length} ${tActiveSuffix} ▾`;
      countBadgeEl.style.background = 'rgba(16,185,129,0.18)';
      countBadgeEl.style.color = '#34d399';
      countBadgeEl.style.border = '1px solid rgba(16,185,129,0.4)';
    }
  }

  // 2. Group Profiles
  const groups = groupProfileNames(names);
  const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'General') return 1;
    if (b === 'General') return -1;
    return a.localeCompare(b);
  });

  // 3. Render Filter Tag Bar
  let filterBarEl = document.getElementById('active-profiles-filter-bar');
  if (!filterBarEl) {
    filterBarEl = document.createElement('div');
    filterBarEl.id = 'active-profiles-filter-bar';
    filterBarEl.style.cssText = 'display:flex; align-items:center; gap:4px; flex-wrap:wrap; padding-bottom:6px; margin-bottom:6px; border-bottom:1px solid rgba(255,255,255,0.06);';
    listEl.parentNode.insertBefore(filterBarEl, listEl);
  }

  const tagList = ['ALL', ...sortedGroupKeys];
  filterBarEl.innerHTML = '';
  tagList.forEach(tag => {
    const isSelected = activeProfilesFilterTag === tag;
    const tagBtn = document.createElement('button');
    tagBtn.type = 'button';
    tagBtn.className = 'btn btn-ghost';
    tagBtn.style.cssText = `
      padding: 2px 7px;
      font-size: 10px;
      font-weight: 700;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s;
      background: ${isSelected ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.04)'};
      color: ${isSelected ? '#60a5fa' : 'var(--muted)'};
      border: 1px solid ${isSelected ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'};
    `;
    tagBtn.textContent = tag === 'ALL' ? (currentLang === 'en' ? 'All' : 'ทั้งหมด') : tag;
    tagBtn.onclick = (e) => {
      e.stopPropagation();
      activeProfilesFilterTag = tag;
      renderActiveProfilesPills();
    };
    filterBarEl.appendChild(tagBtn);
  });

  // 4. Render Grouped Sections
  listEl.innerHTML = '';
  sortedGroupKeys.forEach(grp => {
    if (activeProfilesFilterTag !== 'ALL' && activeProfilesFilterTag !== grp) {
      return;
    }

    const grpNames = groups[grp];
    const groupWrapper = document.createElement('div');
    groupWrapper.style.cssText = 'display:flex; flex-direction:column; gap:4px; margin-bottom:8px;';

    // Group Section Header (Clean, No Emojis)
    const grpHeader = document.createElement('div');
    grpHeader.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 6px;
      background: rgba(255,255,255,0.03);
      border-radius: 6px;
      border: 1px solid rgba(255,255,255,0.05);
    `;

    const titleSpan = document.createElement('span');
    titleSpan.style.cssText = 'font-size:11px; font-weight:700; color:#94a3b8; letter-spacing:0.3px;';
    titleSpan.textContent = `${grp} (${grpNames.length})`;
    grpHeader.appendChild(titleSpan);

    const btnGroup = document.createElement('div');
    btnGroup.style.cssText = 'display:flex; gap:4px;';

    const btnEnableAll = document.createElement('button');
    btnEnableAll.type = 'button';
    btnEnableAll.className = 'btn btn-ghost';
    btnEnableAll.style.cssText = 'padding:1px 6px; font-size:9.5px; border-color:rgba(16,185,129,0.3); color:#34d399; background:rgba(16,185,129,0.06); cursor:pointer;';
    btnEnableAll.textContent = currentLang === 'en' ? 'Enable Group' : 'เปิดทั้งกลุ่ม';
    btnEnableAll.onclick = (e) => {
      e.stopPropagation();
      setGroupProfilesActive(grp, true);
    };

    const btnDisableAll = document.createElement('button');
    btnDisableAll.type = 'button';
    btnDisableAll.className = 'btn btn-ghost';
    btnDisableAll.style.cssText = 'padding:1px 6px; font-size:9.5px; border-color:rgba(239,68,68,0.3); color:#ef4444; background:rgba(239,68,68,0.06); cursor:pointer;';
    btnDisableAll.textContent = currentLang === 'en' ? 'Disable Group' : 'ปิดทั้งกลุ่ม';
    btnDisableAll.onclick = (e) => {
      e.stopPropagation();
      setGroupProfilesActive(grp, false);
    };

    btnGroup.appendChild(btnEnableAll);
    btnGroup.appendChild(btnDisableAll);
    grpHeader.appendChild(btnGroup);
    groupWrapper.appendChild(grpHeader);

    // Profile Rows in Group
    grpNames.forEach(name => {
      const isActive = activeSet.has(name);
      const isEditing = currentEditProfile === name;

      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 5px 8px;
        border-radius: 6px;
        cursor: pointer;
        user-select: none;
        transition: all 0.15s;
        background: ${isActive ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.02)'};
        border: 1px solid ${isActive ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.05)'};
      `;
      row.onmouseenter = () => {
        row.style.background = isActive ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.08)';
      };
      row.onmouseleave = () => {
        row.style.background = isActive ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.02)';
      };

      row.onclick = (e) => {
        e.stopPropagation();
        toggleProfileActive(name);
      };

      const leftGroup = document.createElement('div');
      leftGroup.style.cssText = 'display:flex; align-items:center; gap:8px; overflow:hidden;';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = isActive;
      checkbox.style.cssText = 'accent-color:#10b981; cursor:pointer; width:14px; height:14px;';
      checkbox.onclick = (e) => e.stopPropagation();
      checkbox.onchange = () => toggleProfileActive(name, checkbox.checked);
      leftGroup.appendChild(checkbox);

      const nameLabel = document.createElement('span');
      nameLabel.style.cssText = `font-size: 11.5px; font-weight: ${isActive ? '700' : '500'}; color: ${isActive ? '#34d399' : 'var(--text)'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`;
      nameLabel.textContent = name;
      leftGroup.appendChild(nameLabel);

      row.appendChild(leftGroup);

      if (isEditing) {
        const editBadge = document.createElement('span');
        editBadge.style.cssText = 'font-size:9.5px; font-weight:700; color:#60a5fa; background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); padding:1px 5px; border-radius:10px; white-space:nowrap;';
        editBadge.textContent = tEditing;
        row.appendChild(editBadge);
      }

      groupWrapper.appendChild(row);
    });

    listEl.appendChild(groupWrapper);
  });
}

export function setGroupProfilesActive(groupName, makeActive) {
  const names = Object.keys(fullConfig.profiles || {});
  const grpNames = names.filter(n => getProfileGroup(n) === groupName);
  if (grpNames.length === 0) return;

  const currentActiveList = Array.isArray(fullConfig.activeProfiles) ? [...fullConfig.activeProfiles] : [];
  let updatedList = [];

  if (makeActive) {
    const set = new Set([...currentActiveList, ...grpNames]);
    updatedList = Array.from(set);
  } else {
    updatedList = currentActiveList.filter(n => !grpNames.includes(n));
  }

  fetch('/api/profile/set-active-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activeProfiles: updatedList })
  })
    .then(r => r.json())
    .then(res => {
      if (res && res.success) {
        fullConfig.activeProfiles = res.activeProfiles;
        fullConfig.activeProfile = res.activeProfile || fullConfig.activeProfiles[0] || '';
        populateProfileDropdowns();
        const msg = makeActive
          ? (currentLang === 'en' ? `Activated group "${groupName}" (${grpNames.length} profiles)` : `เปิดใช้งานกลุ่ม "${groupName}" (${grpNames.length} โปรไฟล์) แล้ว!`)
          : (currentLang === 'en' ? `Deactivated group "${groupName}"` : `ปิดการทำงานกลุ่ม "${groupName}" เรียบร้อยแล้ว`);
        if (typeof window.toast === 'function') window.toast(msg, makeActive ? 'success' : 'info');
      } else {
        fullConfig.activeProfiles = updatedList;
        populateProfileDropdowns();
      }
    })
    .catch(() => {
      fullConfig.activeProfiles = updatedList;
      populateProfileDropdowns();
    });
}
window.setGroupProfilesActive = setGroupProfilesActive;

export function toggleActiveProfilesDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('active-profiles-menu');
  if (!menu) return;
  const isShown = menu.style.display === 'flex';
  menu.style.display = isShown ? 'none' : 'flex';
}

export function setAllProfilesActive(makeActive) {
  const names = Object.keys(fullConfig.profiles || {});
  const targetProfiles = makeActive ? names : [];

  fetch('/api/profile/set-active-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activeProfiles: targetProfiles })
  })
    .then(r => r.json())
    .then(res => {
      if (res && res.success) {
        fullConfig.activeProfiles = res.activeProfiles;
        fullConfig.activeProfile = res.activeProfile || fullConfig.activeProfiles[0] || '';
        populateProfileDropdowns();
        const msg = makeActive
          ? (currentLang === 'en' ? `All ${names.length} profiles are now ACTIVE!` : `เปิดใช้งานโปรไฟล์ทั้งหมด (${names.length} โปรไฟล์) แล้ว!`)
          : (currentLang === 'en' ? `All profiles are now INACTIVE.` : `ปิดการทำงานของโปรไฟล์ทั้งหมดเรียบร้อยแล้ว`);
        if (typeof window.toast === 'function') window.toast(msg, makeActive ? 'success' : 'info');
      } else {
        fullConfig.activeProfiles = targetProfiles;
        fullConfig.activeProfile = targetProfiles[0] || '';
        populateProfileDropdowns();
      }
    })
    .catch(() => {
      fullConfig.activeProfiles = targetProfiles;
      fullConfig.activeProfile = targetProfiles[0] || '';
      populateProfileDropdowns();
    });
}

export function selectCurrentProfileActive() {
  const current = currentEditProfile || fullConfig.activeProfile || 'Default';
  if (!current) return;

  const currentActiveList = Array.isArray(fullConfig.activeProfiles) ? [...fullConfig.activeProfiles] : [];
  if (!currentActiveList.includes(current)) {
    currentActiveList.push(current);
  }

  fetch('/api/profile/set-active-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ activeProfiles: currentActiveList })
  })
    .then(r => r.json())
    .then(res => {
      if (res && res.success) {
        fullConfig.activeProfiles = res.activeProfiles;
        fullConfig.activeProfile = current;
        populateProfileDropdowns();
        const msg = currentLang === 'en' ? `Activated current profile: "${current}"` : `เปิดใช้งานโปรไฟล์ปัจจุบัน: "${current}" แล้ว!`;
        if (typeof window.toast === 'function') window.toast(msg, 'success');
      } else {
        fullConfig.activeProfiles = currentActiveList;
        populateProfileDropdowns();
      }
    })
    .catch(() => {
      fullConfig.activeProfiles = currentActiveList;
      populateProfileDropdowns();
    });
}

window.toggleActiveProfilesDropdown = toggleActiveProfilesDropdown;
window.setAllProfilesActive = setAllProfilesActive;
window.selectCurrentProfileActive = selectCurrentProfileActive;

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('active-profiles-dropdown-wrap');
  const menu = document.getElementById('active-profiles-menu');
  if (menu && menu.style.display === 'flex' && wrap && !wrap.contains(e.target)) {
    menu.style.display = 'none';
  }
});

export function populateProfileDropdowns() {
  const names = Object.keys(fullConfig.profiles || {}).sort((a, b) => {
    if (a === 'Default') return -1;
    if (b === 'Default') return 1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });

  const groups = groupProfileNames(names);
  const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'General') return 1;
    if (b === 'General') return -1;
    return a.localeCompare(b);
  });

  const selectEl = document.getElementById('profile-select');
  if (selectEl) {
    selectEl.innerHTML = '';
    sortedGroupKeys.forEach(grp => {
      const optGroup = document.createElement('optgroup');
      optGroup.label = grp;
      groups[grp].forEach(n => {
        const o = document.createElement('option');
        o.value = n;
        const isAct = isProfileActive(n);
        o.textContent = (isAct ? '⚡ ' : '') + n;
        optGroup.appendChild(o);
      });
      selectEl.appendChild(optGroup);
    });
    if (names.includes(currentEditProfile)) selectEl.value = currentEditProfile;
    else if (names.length > 0) selectEl.value = names[0];
  }

  const copyEl = document.getElementById('copy-from-select');
  if (copyEl) {
    const prevCopy = copyEl.value;
    copyEl.innerHTML = '';

    const optNone = document.createElement('option');
    optNone.value = '';
    optNone.textContent = TRANSLATIONS[currentLang] ? TRANSLATIONS[currentLang].emptyProfile : 'None (Empty Profile)';
    copyEl.appendChild(optNone);

    sortedGroupKeys.forEach(grp => {
      const optGroup = document.createElement('optgroup');
      optGroup.label = grp;
      groups[grp].forEach(n => {
        const o = document.createElement('option');
        o.value = n;
        o.textContent = n;
        optGroup.appendChild(o);
      });
      copyEl.appendChild(optGroup);
    });
    if (prevCopy !== undefined) copyEl.value = prevCopy;
  }

  updateActiveToggleBtn();
  renderActiveProfilesPills();
}

export function onProfileSelectChange() {
  const selectEl = document.getElementById('profile-select');
  if (selectEl) {
    syncGlobalSettingsFromDOM();
    currentEditProfile = selectEl.value;
    try {
      localStorage.setItem('nodehotkey_last_viewed_profile', currentEditProfile);
    } catch (e) {}
    populateProfileDropdowns();
    loadProfileToUI(fullConfig.profiles[currentEditProfile]);
  }
}

export function loadGlobalSettingsToUI() {
  const gs = fullConfig.globalSettings || {};
  
  const targetUrlInput = document.getElementById('target-url-keyword');
  if (targetUrlInput) targetUrlInput.value = gs.targetUrlKeyword || 'universe.flyff.com';

  const checkbox = document.getElementById('enable-overlay-checkbox');
  if (checkbox) checkbox.checked = !!gs.enableOverlay;

  const appModeCb = document.getElementById('enable-app-mode-checkbox');
  if (appModeCb) appModeCb.checked = gs.useAppMode !== false;

  const suspendInput = document.getElementById('suspend-hotkey-input');
  if (suspendInput) suspendInput.value = gs.suspendHotkey || '';

  const gmj = gs.ghostMouseJitter || {};
  const gmEnabled = document.getElementById('ghost-mouse-enabled');
  if (gmEnabled) {
    gmEnabled.checked = !!gmj.enabled;
    toggleGhostMouseSettings();
  }
  const gmMin = document.getElementById('ghost-mouse-interval-min');
  if (gmMin) gmMin.value = gmj.intervalMin || 8000;
  const gmMax = document.getElementById('ghost-mouse-interval-max');
  if (gmMax) gmMax.value = gmj.intervalMax || 25000;
  const gmOffset = document.getElementById('ghost-mouse-max-offset');
  if (gmOffset) gmOffset.value = gmj.maxOffset || 12;

  renderClientToggles(activeClients, disabledClients);

  const aliases = gs.clientAliases || {};
  for (let i = 1; i <= 8; i++) {
    const el = document.getElementById(`client-alias-${i}`);
    if (el) el.value = aliases[String(i)] || '';
  }

  bindGlobalSettingsAutoSave();
}

let isGlobalSettingsAutoSaveBound = false;
export function bindGlobalSettingsAutoSave() {
  if (isGlobalSettingsAutoSaveBound) return;
  isGlobalSettingsAutoSaveBound = true;

  const triggerAutoSave = () => {
    syncGlobalSettingsFromDOM();
    commitConfigToBackend().catch(() => {});
  };

  let debounceTimer = null;
  const debouncedAutoSave = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      triggerAutoSave();
    }, 400);
  };

  const overlayCb = document.getElementById('enable-overlay-checkbox');
  if (overlayCb) overlayCb.addEventListener('change', triggerAutoSave);

  const appModeCb = document.getElementById('enable-app-mode-checkbox');
  if (appModeCb) appModeCb.addEventListener('change', triggerAutoSave);

  const targetUrlInput = document.getElementById('target-url-keyword');
  if (targetUrlInput) targetUrlInput.addEventListener('input', debouncedAutoSave);

  const suspendInput = document.getElementById('suspend-hotkey-input');
  if (suspendInput) suspendInput.addEventListener('input', debouncedAutoSave);

  const gmEnabled = document.getElementById('ghost-mouse-enabled');
  if (gmEnabled) gmEnabled.addEventListener('change', triggerAutoSave);

  ['ghost-mouse-interval-min', 'ghost-mouse-interval-max', 'ghost-mouse-max-offset'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', debouncedAutoSave);
  });

  for (let i = 1; i <= 8; i++) {
    const el = document.getElementById(`client-alias-${i}`);
    if (el) el.addEventListener('input', debouncedAutoSave);
  }
}

export function loadProfileToUI(p) {
  if (!p) return;
  if (window.nodeCanvas && typeof window.nodeCanvas.closeInspector === 'function') {
    window.nodeCanvas.closeInspector();
  }
  loadGlobalSettingsToUI();
  if (!p.actions) p.actions = [];
  renderActions(p.actions);
  if (window.nodeCanvas && typeof window.nodeCanvas.loadProfile === 'function') {
    window.nodeCanvas.loadProfile(p);
  }
}

export function toggleGhostMouseSettings() {
  const gmEnabled = document.getElementById('ghost-mouse-enabled');
  const gmSettings = document.getElementById('ghost-mouse-settings');
  if (gmEnabled && gmSettings) {
    gmSettings.style.display = gmEnabled.checked ? 'flex' : 'none';
  }
}

export function toggleCurrentProfileActive() {
  toggleProfileActive(currentEditProfile);
}

export function toggleProfileActive(name, forceState = undefined) {
  fetch('/api/profile/toggle-active', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, active: forceState })
  })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        fullConfig.activeProfiles = res.activeProfiles || [];
        fullConfig.activeProfile = res.activeProfile || fullConfig.activeProfiles[0] || '';
        populateProfileDropdowns();
        const isNowActive = fullConfig.activeProfiles.includes(name);
        const msg = isNowActive
          ? (currentLang === 'en' ? `🟢 Profile "${name}" is now ACTIVE!` : `🟢 เปิดใช้งานโปรไฟล์ "${name}" แล้ว!`)
          : (currentLang === 'en' ? `⚪ Profile "${name}" is now INACTIVE.` : `⚪ ปิดการทำงานของโปรไฟล์ "${name}" แล้ว`);
        if (typeof window.toast === 'function') {
          window.toast(msg, isNowActive ? 'success' : 'info');
        }
      }
    })
    .catch(err => {
      console.error('Failed to toggle active profile:', err);
    });
}

export function activateOnlyProfile() {
  fetch('/api/profile/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: currentEditProfile })
  })
    .then(r => r.json())
    .then(res => {
      if (res.success) {
        fullConfig.activeProfile = currentEditProfile;
        fullConfig.activeProfiles = [currentEditProfile];
        populateProfileDropdowns();
        if (typeof window.toast === 'function') {
          const msg = currentLang === 'en'
            ? `✓ Solo Active: Profile "${currentEditProfile}" is now the only active profile!`
            : `✓ ตั้งให้โปรไฟล์ "${currentEditProfile}" ทำงานเพียงโปรไฟล์เดียวแล้ว!`;
          window.toast(msg, 'success');
        }
      }
    });
}

export function activateProfile() {
  activateOnlyProfile();
}

export function openNewProfileModal() {
  document.getElementById('new-profile-name').value = '';
  const copyEl = document.getElementById('copy-from-select');
  if (copyEl && currentEditProfile) {
    copyEl.value = currentEditProfile;
  }
  document.getElementById('new-profile-modal').classList.add('show');
  setTimeout(() => {
    document.getElementById('new-profile-name')?.focus();
  }, 100);
}

export function confirmNewProfile() {
  const name = document.getElementById('new-profile-name').value.trim();
  if (!name) {
    if (typeof window.toast === 'function') window.toast(t('toastEnterProfileName'), 'error');
    return;
  }

  if (fullConfig.profiles && fullConfig.profiles[name]) {
    if (typeof window.toast === 'function') {
      const msg = currentLang === 'en' ? `⚠️ Profile name "${name}" already exists! Please choose a different name.` : `⚠️ ชื่อโปรไฟล์ "${name}" มีอยู่แล้วในระบบ! กรุณาตั้งชื่ออื่นเพื่อไม่ให้ทับกับของเดิม`;
      window.toast(msg, 'error');
    }
    return;
  }

  const copyFrom = document.getElementById('copy-from-select').value;
  let newProfileData = {
    version: '3.0.0',
    name: name,
    canvas: { zoom: 1, pan: { x: 0, y: 0 } },
    nodes: [],
    connections: [],
    actions: [],
    targetUrlKeyword: 'universe.flyff.com',
    enableOverlay: false,
    suspendHotkey: ''
  };

  if (copyFrom && fullConfig.profiles[copyFrom]) {
    const src = fullConfig.profiles[copyFrom];
    // Deep clone the source profile object completely (including nodes, connections, canvas, actions, and settings)
    newProfileData = JSON.parse(JSON.stringify(src));
    newProfileData.name = name;
  }

  fullConfig.profiles[name] = newProfileData;
  currentEditProfile = name;
  try { localStorage.setItem('nodehotkey_last_viewed_profile', currentEditProfile); } catch (e) {}
  if (!Array.isArray(fullConfig.activeProfiles)) fullConfig.activeProfiles = ['Default'];
  
  document.getElementById('new-profile-modal').classList.remove('show');
  populateProfileDropdowns();
  loadProfileToUI(fullConfig.profiles[name]);
  
  // Auto-commit to backend disk immediately
  commitConfigToBackend(() => {
    if (typeof window.toast === 'function') window.toast(t('toastProfileCreated').replace('{name}', name), 'success');
  });
}

export function openRenameProfileModal() {
  document.getElementById('rename-profile-name').value = currentEditProfile;
  document.getElementById('rename-profile-modal').classList.add('show');
}

export function confirmRenameProfile() {
  const newName = document.getElementById('rename-profile-name').value.trim();
  if (!newName) {
    if (typeof window.toast === 'function') window.toast(t('toastEnterProfileName'), 'error');
    return;
  }
  if (newName === currentEditProfile) {
    document.getElementById('rename-profile-modal').classList.remove('show');
    return;
  }

  if (fullConfig.profiles && fullConfig.profiles[newName]) {
    if (typeof window.toast === 'function') {
      const msg = currentLang === 'en' ? `⚠️ Profile name "${newName}" already exists! Please choose a different name.` : `⚠️ ชื่อโปรไฟล์ "${newName}" มีอยู่แล้วในระบบ! กรุณาตั้งชื่ออื่นเพื่อไม่ให้ทับกับของเดิม`;
      window.toast(msg, 'error');
    }
    return;
  }

  const oldProfile = fullConfig.profiles[currentEditProfile];
  delete fullConfig.profiles[currentEditProfile];
  fullConfig.profiles[newName] = oldProfile;
  if (fullConfig.activeProfile === currentEditProfile) {
    fullConfig.activeProfile = newName;
  }
  if (Array.isArray(fullConfig.activeProfiles)) {
    fullConfig.activeProfiles = fullConfig.activeProfiles.map(p => p === currentEditProfile ? newName : p);
  }
  currentEditProfile = newName;
  try { localStorage.setItem('nodehotkey_last_viewed_profile', currentEditProfile); } catch (e) {}
  document.getElementById('rename-profile-modal').classList.remove('show');
  populateProfileDropdowns();
  loadProfileToUI(fullConfig.profiles[newName]);

  // Auto-commit to backend disk immediately
  commitConfigToBackend(() => {
    if (typeof window.toast === 'function') window.toast(t('toastProfileRenamed').replace('{name}', newName), 'success');
  });
}

export function deleteProfile() {
  if (currentEditProfile === 'Default') {
    if (typeof window.toast === 'function') window.toast(t('toastDeleteDefaultErr'), 'error');
    return;
  }
  if (confirm(t('confirmDeleteProfile').replace('{name}', currentEditProfile))) {
    const deletedName = currentEditProfile;
    delete fullConfig.profiles[deletedName];
    if (fullConfig.activeProfile === deletedName) {
      fullConfig.activeProfile = 'Default';
    }
    if (Array.isArray(fullConfig.activeProfiles)) {
      fullConfig.activeProfiles = fullConfig.activeProfiles.filter(p => p !== deletedName);
      if (fullConfig.activeProfiles.length === 0) fullConfig.activeProfiles = ['Default'];
    }
    const remaining = Object.keys(fullConfig.profiles);
    currentEditProfile = remaining.includes('Default') ? 'Default' : remaining[0];
    try { localStorage.setItem('nodehotkey_last_viewed_profile', currentEditProfile); } catch (e) {}
    populateProfileDropdowns();
    loadProfileToUI(fullConfig.profiles[currentEditProfile]);

    // Auto-commit deletion to backend disk immediately
    commitConfigToBackend(() => {
      if (typeof window.toast === 'function') window.toast(t('toastProfileDeleted'), 'success');
    });
  }
}

export let disabledClients = [];

export function renderClientToggles(activeList = activeClients, disabledList = disabledClients) {
  const container = document.getElementById('client-toggles-container');
  if (!container) return;
  container.innerHTML = '';

  const currentProf = fullConfig.profiles[currentEditProfile];
  const gs = fullConfig.globalSettings || {};
  const aliases = gs.clientAliases || (currentProf ? currentProf.clientAliases : {}) || {};

  const activeStrList = (activeList || []).map(String);
  const disabledStrList = (disabledList || []).map(String);

  for (let clientIdx = 1; clientIdx <= 8; clientIdx++) {
    const sIdx = String(clientIdx);
    const customAlias = aliases[sIdx] || aliases[clientIdx] || '';
    const isActive = activeStrList.includes(sIdx);
    const isDisabled = disabledStrList.includes(sIdx);

    const browsers = gs.clientBrowsers || {};
    const browserCode = browsers[sIdx] || '1';
    let browserIcon = '🌐';
    let browserName = 'Google Chrome';
    if (browserCode === '2') { browserIcon = '🌊'; browserName = 'Microsoft Edge'; }
    else if (browserCode === '3') { browserIcon = '🦊'; browserName = 'Mozilla Firefox'; }

    let statusText = '⚪ OFFLINE';
    let statusStyle = 'background:rgba(255,255,255,0.05); color:var(--muted);';
    let cardBorder = 'border:1px solid rgba(255,255,255,0.08);';

    if (isActive) {
      if (isDisabled) {
        statusText = '🔴 PAUSED';
        statusStyle = 'background:rgba(239,68,68,0.2); color:#fca5a5;';
        cardBorder = 'border:1px solid rgba(239,68,68,0.4); background:rgba(239,68,68,0.04);';
      } else {
        statusText = '🟢 ACTIVE';
        statusStyle = 'background:rgba(16,185,129,0.2); color:#6ee7b7;';
        cardBorder = 'border:1px solid rgba(16,185,129,0.4); background:rgba(16,185,129,0.04);';
      }
    }

    const card = document.createElement('div');
    card.className = 'client-card';
    card.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 8px;
      ${cardBorder}
      transition: all 0.2s ease;
    `;

    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:4px;">
          <span style="font-size:11px; font-weight:700; color:var(--text);" title="${browserName}">${browserIcon} Client ${clientIdx}</span>
          <button type="button" class="btn btn-ghost" onclick="openClientSettingsModal(${clientIdx})" style="padding:0 3px; height:18px; font-size:10px; border:none; background:transparent; color:var(--muted); cursor:pointer; transition:transform 0.2s;" title="Browser, User-Agent & Proxy Settings">⚙️</button>
        </div>
        <span style="font-size:9px; font-weight:700; padding:2px 5px; border-radius:4px; ${statusStyle}">${statusText}</span>
      </div>
      <input type="text" id="client-alias-${clientIdx}" value="${escapeHtml(customAlias)}" placeholder="Alias (e.g. RM)" style="background:var(--bg-input); border:1px solid var(--border); border-radius:6px; padding:3px 6px; color:var(--text); font-size:11px; outline:none; text-align:center; height:24px;" onchange="saveCurrentProfile()">
      <div style="display:flex; gap:4px; margin-top:2px;">
        ${!isActive ? `
          <button type="button" class="btn btn-sm btn-ghost" onclick="launchClient(${clientIdx})" style="flex:1; border-color:var(--primary); color:var(--primary); font-size:10px; padding:4px 0; height:26px; border-radius:6px; font-weight:700;">➕ Launch</button>
        ` : `
          <button type="button" class="btn btn-sm ${isDisabled ? 'btn-ghost' : 'btn-danger'}" onclick="toggleClientEnable(${clientIdx})" style="flex:1; font-size:10px; padding:4px 0; height:26px; border-radius:6px; font-weight:700; ${isDisabled ? 'border-color:#10b981; color:#6ee7b7;' : ''}">${isDisabled ? '▶ Resume' : '⏸ Pause'}</button>
          <button type="button" class="btn btn-sm btn-ghost" onclick="closeClient(${clientIdx})" style="border-color:#ef4444; color:#ef4444; font-size:10px; padding:0 6px; height:26px; border-radius:6px;" title="Close Browser Window">❌</button>
        `}
      </div>
    `;
    container.appendChild(card);
  }
}

export function launchClient(clientIdx) {
  if (typeof window.toast === 'function') {
    window.toast(t('toastLaunchingClient') || `Launching Client ${clientIdx}...`, 'info');
  }
  const gs = fullConfig.globalSettings || {};
  const browsers = gs.clientBrowsers || {};
  const browserChoice = browsers[String(clientIdx)] || '1';

  fetch('/api/client/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientIndex: clientIdx, browserChoice: browserChoice })
  })
    .then(r => r.json())
    .then(res => {
      if (res && res.success) {
        if (res.activeClients) activeClients = res.activeClients;
        if (res.disabledClients) disabledClients = res.disabledClients;
        renderClientToggles(activeClients, disabledClients);
        if (typeof window.toast === 'function') {
          window.toast(`Client ${clientIdx} launched successfully!`, 'success');
        }
      } else if (res && res.error) {
        if (typeof window.toast === 'function') window.toast(`Launch failed: ${res.error}`, 'error');
      }
    })
    .catch(err => {
      console.error('Failed to launch client:', err);
    });
}

export function closeClient(clientIdx) {
  fetch('/api/client/close', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientIndex: clientIdx })
  })
    .then(r => r.json())
    .then(res => {
      if (res && res.success) {
        if (res.activeClients) activeClients = res.activeClients;
        if (res.disabledClients) disabledClients = res.disabledClients;
        renderClientToggles(activeClients, disabledClients);
        if (typeof window.toast === 'function') {
          window.toast(`Client ${clientIdx} closed.`, 'warning');
        }
      }
    })
    .catch(err => {
      console.error('Failed to close client:', err);
    });
}

export function toggleClientEnable(clientIdx) {
  fetch('/api/client/toggle-enable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientIndex: clientIdx })
  })
    .then(r => r.json())
    .then(res => {
      if (res && res.success) {
        disabledClients = res.disabledClients || [];
        renderClientToggles(activeClients, disabledClients);
        if (typeof window.toast === 'function') {
          const isDisabled = disabledClients.includes(String(clientIdx)) || disabledClients.includes(clientIdx);
          const msg = isDisabled 
            ? (currentLang === 'en' ? `Paused Client ${clientIdx} (Skipped from hotkeys)` : `ปิดพัก Client ${clientIdx} (ข้ามการกดปุ่ม)`)
            : (currentLang === 'en' ? `Activated Client ${clientIdx}` : `เปิดใช้งาน Client ${clientIdx}`);
          window.toast(msg, isDisabled ? 'warning' : 'success');
        }
      }
    })
    .catch(err => {
      console.error('Failed to toggle client enable state:', err);
    });
}

export function pollActiveClients() {
  fetch('/api/active-clients', { cache: 'no-store' })
    .then(r => r.json())
    .then(res => {
      if (!res) return;
      const list = res.activeClients !== undefined ? res.activeClients : (Array.isArray(res) ? res : null);
      if (res.disabledClients) {
        disabledClients = res.disabledClients;
      }

      // Real-time 2-Way Sync: Update Overlay Checkbox immediately if toggled from overlay [X]
      if (res.enableOverlay !== undefined) {
        const overlayCb = document.getElementById('enable-overlay-checkbox');
        if (overlayCb && overlayCb.checked !== res.enableOverlay) {
          overlayCb.checked = res.enableOverlay;
          if (fullConfig.globalSettings) {
            fullConfig.globalSettings.enableOverlay = res.enableOverlay;
          }
        }
      }

      if (Array.isArray(list)) {
        const changed = JSON.stringify(activeClients) !== JSON.stringify(list);
        activeClients = list;
        renderClientToggles(activeClients, disabledClients);
        if (changed && fullConfig.profiles[currentEditProfile]) {
          renderActions(fullConfig.profiles[currentEditProfile].actions);
        }
      } else {
        renderClientToggles(activeClients, disabledClients);
      }
    })
    .catch(() => {});
}

// ═════════════════════════════════════════════════════════════════════════════
// PROFILE EXPORT & IMPORT MODULE
// ═════════════════════════════════════════════════════════════════════════════

export function exportCurrentProfile() {
  const profileName = currentEditProfile || 'Default';
  const profile = fullConfig.profiles[profileName];
  if (!profile) {
    if (typeof window.toast === 'function') {
      window.toast('❌ Profile not found to export', 'error');
    }
    return;
  }

  // Ensure latest canvas and DOM state is synced into profile object
  if (window.nodeCanvas && typeof window.nodeCanvas.exportProfileData === 'function') {
    const canvasData = window.nodeCanvas.exportProfileData();
    profile.version = canvasData.version;
    profile.canvas = canvasData.canvas;
    profile.nodes = canvasData.nodes;
    profile.connections = canvasData.connections;
    profile.actions = canvasData.actions;
  } else if (profile.actions && Array.isArray(profile.actions)) {
    profile.actions.forEach(a => syncActionFromDom(a.id));
  }
  syncGlobalSettingsFromDOM();

  // Extract strictly pure profile graph data (exclude global machine/browser settings)
  const pureProfileData = {
    version: profile.version || '3.1.0',
    name: profileName,
    canvas: profile.canvas || { zoom: 1.0, pan: { x: 0, y: 0 } },
    nodes: Array.isArray(profile.nodes) ? profile.nodes : [],
    connections: Array.isArray(profile.connections) ? profile.connections : []
  };

  // Create clean export payload
  const exportPayload = {
    _format: 'NodeHotkey_Profile',
    _version: '3.1.0',
    _exportedAt: new Date().toISOString(),
    name: profileName,
    profileData: pureProfileData
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${profileName.replace(/[\\/:*?"<>|]/g, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const successMsg = (t('toastProfileExported') || '✓ Exported profile "{name}.json" successfully!').replace('{name}', profileName);
  if (typeof window.toast === 'function') {
    window.toast(successMsg, 'success');
  }
}

export function triggerImportProfile() {
  const fileInput = document.getElementById('import-profile-file-input');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

export function validateAndSanitizeImportedProfile(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(currentLang === 'en' ? 'Uploaded file is not a valid JSON object.' : 'ไฟล์ที่อัปโหลดไม่ใช่โครงสร้าง JSON ที่ถูกต้อง');
  }

  let profileData = null;
  let profileName = '';

  if (parsed._format === 'NodeHotkey_Profile' && parsed.profileData && typeof parsed.profileData === 'object') {
    profileData = parsed.profileData;
    profileName = typeof parsed.name === 'string' ? parsed.name.trim() : '';
  } else if (Array.isArray(parsed.actions) || Array.isArray(parsed.nodes) || parsed.version || parsed.targetUrlKeyword) {
    profileData = parsed;
    profileName = typeof parsed.name === 'string' ? parsed.name.trim() : '';
  } else {
    throw new Error(currentLang === 'en' ? 'Uploaded file does not match NodeHotkey profile format.' : 'ไฟล์ที่อัปโหลดไม่ใช่รูปแบบโปรไฟล์ของ NodeHotkey');
  }

  // 1. Sanitize Top-Level Properties
  const sanitized = {
    version: typeof profileData.version === 'string' ? profileData.version : '3.1.0',
    targetUrlKeyword: typeof profileData.targetUrlKeyword === 'string' ? profileData.targetUrlKeyword : 'universe.flyff.com',
    enableOverlay: !!profileData.enableOverlay,
    suspendHotkey: typeof profileData.suspendHotkey === 'string' ? profileData.suspendHotkey : '',
    canvas: {
      zoom: (profileData.canvas && typeof profileData.canvas.zoom === 'number' && !isNaN(profileData.canvas.zoom)) ? Math.min(Math.max(profileData.canvas.zoom, 0.2), 2.5) : 1.0,
      pan: {
        x: (profileData.canvas && profileData.canvas.pan && typeof profileData.canvas.pan.x === 'number' && !isNaN(profileData.canvas.pan.x)) ? profileData.canvas.pan.x : 0,
        y: (profileData.canvas && profileData.canvas.pan && typeof profileData.canvas.pan.y === 'number' && !isNaN(profileData.canvas.pan.y)) ? profileData.canvas.pan.y : 0
      }
    },
    nodes: [],
    connections: [],
    actions: []
  };

  // 2. Validate Nodes with Allowed Node Types
  const validNodeTypes = new Set([
    'trigger', 'loop', 'buff_sequence', 'key_press', 'delay',
    'branch', 'condition', 'control', 'forwarder', 'macro_group',
    'emergency_stop', 'sound', 'emit_event'
  ]);

  if (Array.isArray(profileData.nodes)) {
    sanitized.nodes = profileData.nodes
      .filter(n => n && typeof n === 'object' && typeof n.id === 'string' && validNodeTypes.has(n.type))
      .map(n => ({
        id: String(n.id),
        type: n.type,
        title: typeof n.title === 'string' ? n.title : n.type,
        position: {
          x: (n.position && typeof n.position.x === 'number' && !isNaN(n.position.x)) ? n.position.x : 100,
          y: (n.position && typeof n.position.y === 'number' && !isNaN(n.position.y)) ? n.position.y : 100
        },
        data: (n.data && typeof n.data === 'object' && !Array.isArray(n.data)) ? n.data : { enabled: true }
      }));
  }

  // 3. Validate Connections against Valid Node IDs
  const validNodeIds = new Set(sanitized.nodes.map(n => n.id));
  if (Array.isArray(profileData.connections)) {
    sanitized.connections = profileData.connections
      .filter(c => c && typeof c === 'object' && validNodeIds.has(c.fromNodeId) && validNodeIds.has(c.toNodeId))
      .map(c => ({
        id: String(c.id || `conn_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`),
        fromNodeId: String(c.fromNodeId),
        fromPort: typeof c.fromPort === 'string' ? c.fromPort : 'next',
        toNodeId: String(c.toNodeId),
        toPort: typeof c.toPort === 'string' ? c.toPort : 'exec_in'
      }));
  }

  // 4. Validate Actions Structure
  if (Array.isArray(profileData.actions)) {
    sanitized.actions = profileData.actions.filter(a => a && typeof a === 'object' && typeof a.id === 'string');
  }

  // Strict check: Must have either valid nodes or valid actions
  if (sanitized.nodes.length === 0 && sanitized.actions.length === 0) {
    throw new Error(currentLang === 'en' ? 'Profile contains no valid Nodes or Actions data.' : 'ไฟล์ไม่มีข้อมูลโหนดหรือคำสั่ง Action ที่ถูกต้องของ NodeHotkey');
  }

  return {
    sanitizedData: sanitized,
    extractedName: profileName
  };
}

export function handleImportProfileFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const content = e.target.result;
      let parsed = null;
      try {
        parsed = JSON.parse(content);
      } catch (jsonErr) {
        throw new Error(currentLang === 'en' ? 'Invalid JSON format (syntax error).' : 'ไฟล์ไม่ใช่รูปแบบ JSON ที่ถูกต้อง (ไวยากรณ์ผิดพลาด)');
      }

      // Deep Schema & Data Validation
      const { sanitizedData, extractedName } = validateAndSanitizeImportedProfile(parsed);

      let targetName = extractedName || file.name.replace(/\.json$/i, '').trim() || 'Imported_Profile';

      // Check if profile name already exists in config
      if (fullConfig.profiles && fullConfig.profiles[targetName]) {
        const promptTemplate = t('promptImportOverwrite') || 'Profile "{name}" already exists.\n\nClick OK to OVERWRITE it, or Cancel to import as a NEW copy.';
        const shouldOverwrite = window.confirm(promptTemplate.replace('{name}', targetName));

        if (!shouldOverwrite) {
          // Generate unique non-colliding name e.g. "Profile (1)"
          let copyIndex = 1;
          let candidateName = `${targetName} (${copyIndex})`;
          while (fullConfig.profiles[candidateName]) {
            copyIndex++;
            candidateName = `${targetName} (${copyIndex})`;
          }
          targetName = candidateName;
        }
      }

      // Save sanitized profile to fullConfig and backend disk
      if (!fullConfig.profiles) fullConfig.profiles = {};
      fullConfig.profiles[targetName] = sanitizedData;
      currentEditProfile = targetName;
      try { localStorage.setItem('nodehotkey_last_viewed_profile', currentEditProfile); } catch (e) {}
      if (!Array.isArray(fullConfig.activeProfiles)) fullConfig.activeProfiles = ['Default'];

      commitConfigToBackend(() => {
        populateProfileDropdowns();
        loadProfileToUI(fullConfig.profiles[targetName]);

        const successMsg = (t('toastProfileImported') || '✓ Imported profile "{name}" successfully!').replace('{name}', targetName);
        if (typeof window.toast === 'function') {
          window.toast(successMsg, 'success');
        }
      });

    } catch (err) {
      console.error('Failed to import profile:', err);
      const errorMsg = `❌ ${err.message || t('toastProfileImportError') || 'Invalid profile format'}`;
      if (typeof window.toast === 'function') {
        window.toast(errorMsg, 'error');
      }
    }
  };

  reader.readAsText(file);
}

window.exportCurrentProfile = exportCurrentProfile;
window.triggerImportProfile = triggerImportProfile;
window.handleImportProfileFile = handleImportProfileFile;

