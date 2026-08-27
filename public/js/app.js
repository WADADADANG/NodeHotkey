import { currentLang, changeLang, TRANSLATIONS, t } from './i18n.js';
import {
  fullConfig,
  currentEditProfile,
  activeClients,
  loadConfig,
  saveCurrentProfile,
  onManualSaveProfile,
  activateProfile,
  activateOnlyProfile,
  toggleCurrentProfileActive,
  toggleProfileActive,
  onProfileSelectChange,
  openNewProfileModal,
  confirmNewProfile,
  openRenameProfileModal,
  confirmRenameProfile,
  deleteProfile,
  exportCurrentProfile,
  triggerImportProfile,
  handleImportProfileFile,
  toggleGhostMouseSettings,
  populateProfileDropdowns,
  loadProfileToUI,
  pollActiveClients,
  toggleClientEnable,
  renderClientToggles,
  launchClient,
  closeClient,
  toggleActiveProfilesDropdown,
  toggleProfileActionsDropdown,
  closeProfileActionsDropdown,
  setAllProfilesActive,
  selectCurrentProfileActive,
  setGroupProfilesActive,
  switchToEditProfile,
  triggerUndo,
  triggerRedo,
  toggleCanvasFullscreen,
  isDirty
} from './state.js';
import {
  startRecordingKey,
  stopRecordingKey,
  startRecordingSuspendHotkey,
  clearSuspendHotkey,
  setRecordSaveCallback
} from './key-recorder.js';
import {
  fetchCooldownPresets,
  openSkillPickerModal,
  closeSkillPickerModal,
  renderSkillPickerClassTabs,
  renderSkillPickerGrid,
  selectSkillForAction
} from './cooldown.js';
import {
  initActionsModule,
  renderActions,
  addNewAction,
  deleteAction,
  toggleActionAccordion,
  toggleChainAccordion,
  toggleClientSelection,
  onTriggerTypeChange,
  onModeChange,
  toggleForwardDelayDisplay,
  addFirstStepToAction,
  removeFirstStepFromAction,
  syncActionFromDom,
  syncIntervalRange,
  syncIntervalInput,
  syncDelayOnlyRange,
  syncDelayOnlyInput,
  toggleForwardDelayActivationDisplay,
  syncForwardActivationRange,
  syncForwardActivationInput,
  onChainEnabledToggle,
  toggleChainItem,
  toggleControlTargetItem,
  onControlOperationChange
} from './components/actions.js';
import {
  openAntiDetectModal,
  closeAntiDetectModal,
  randomizeUserAgent,
  randomizeAllUserAgents,
  clearUserAgent,
  saveAntiDetectSettings,
  openProxyModal,
  closeProxyModal,
  clearProxy,
  saveProxySettings,
  openClientSettingsModal,
  closeClientSettingsModal,
  randomizeClientModalUA,
  clearClientModalUA,
  clearClientModalProxy,
  saveClientSettingsModal
} from './components/modal.js';
import {
  toast,
  addLog,
  clearLogs,
  flashKey,
  updateSuspendButtonUI,
  toggleSuspendState,
  setup3D
} from './components/logs.js';
import {
  openVirtualKeyboard,
  closeVirtualKeyboard,
  toggleModifier,
  pressVirtualKey,
  clearVirtualKeyboard,
  popVirtualKey,
  toggleManualMode,
  applyVirtualKeyboard
} from './virtual-keyboard.js';
import { validateProfile, autoFixProfile } from './validator.js';

// Expose functions required by inline HTML event attributes & global calls
window.changeLang = (lang) => {
  changeLang(lang, (newLang) => {
    updateLanguageUI();
  });
};

// Listen for Language Switch messages from Electron Host Shell
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NODEHOTKEY_CHANGE_LANG') {
    const lang = event.data.lang;
    if (lang && (lang === 'th' || lang === 'en')) {
      window.changeLang(lang);
    }
  }
});
window.onProfileSelectChange = onProfileSelectChange;
window.activateProfile = activateProfile;
window.activateOnlyProfile = activateOnlyProfile;
window.toggleCurrentProfileActive = toggleCurrentProfileActive;
window.toggleProfileActive = toggleProfileActive;
window.openNewProfileModal = openNewProfileModal;
window.closeNewProfileModal = () => document.getElementById('new-profile-modal')?.classList.remove('show');
window.confirmNewProfile = confirmNewProfile;
window.openRenameProfileModal = openRenameProfileModal;
window.closeRenameProfileModal = () => document.getElementById('rename-profile-modal')?.classList.remove('show');
window.confirmRenameProfile = confirmRenameProfile;
window.deleteProfile = deleteProfile;
window.exportCurrentProfile = exportCurrentProfile;
window.triggerImportProfile = triggerImportProfile;
window.handleImportProfileFile = handleImportProfileFile;
window.toggleGhostMouseSettings = toggleGhostMouseSettings;
window.saveCurrentProfile = saveCurrentProfile;
window.onManualSaveProfile = onManualSaveProfile;
window.triggerUndo = triggerUndo;
window.toggleActiveProfilesDropdown = toggleActiveProfilesDropdown;
window.toggleProfileActionsDropdown = toggleProfileActionsDropdown;
window.closeProfileActionsDropdown = closeProfileActionsDropdown;
window.setAllProfilesActive = setAllProfilesActive;
window.selectCurrentProfileActive = selectCurrentProfileActive;
window.setGroupProfilesActive = setGroupProfilesActive;
window.switchToEditProfile = switchToEditProfile;
window.toggleCanvasFullscreen = toggleCanvasFullscreen;
window.toggleClientEnable = toggleClientEnable;
window.launchClient = launchClient;
window.closeClient = closeClient;

window.startRecordingKey = startRecordingKey;
window.stopRecordingKey = stopRecordingKey;
window.startRecordingSuspendHotkey = startRecordingSuspendHotkey;
window.clearSuspendHotkey = () => clearSuspendHotkey(() => saveCurrentProfile());

window.openVirtualKeyboard = openVirtualKeyboard;
window.closeVirtualKeyboard = closeVirtualKeyboard;
window.toggleModifier = toggleModifier;
window.pressVirtualKey = pressVirtualKey;
window.clearVirtualKeyboard = clearVirtualKeyboard;
window.popVirtualKey = popVirtualKey;
window.toggleManualMode = toggleManualMode;
window.applyVirtualKeyboard = applyVirtualKeyboard;

window.syncIntervalRange = syncIntervalRange;
window.syncIntervalInput = syncIntervalInput;
window.syncDelayOnlyRange = syncDelayOnlyRange;
window.syncDelayOnlyInput = syncDelayOnlyInput;
window.toggleForwardDelayActivationDisplay = toggleForwardDelayActivationDisplay;
window.syncForwardActivationRange = syncForwardActivationRange;
window.syncForwardActivationInput = syncForwardActivationInput;

window.openSkillPickerModal = (actionId) => openSkillPickerModal(actionId, renderActions);
window.closeSkillPickerModal = closeSkillPickerModal;
window.selectPickerClassTab = (className) => {
  renderSkillPickerClassTabs();
  renderSkillPickerGrid(renderActions);
};
window.selectSkillForAction = (presetId) => selectSkillForAction(presetId, renderActions);

window.addNewAction = addNewAction;
window.deleteAction = deleteAction;
window.toggleActionAccordion = toggleActionAccordion;
window.toggleChainAccordion = toggleChainAccordion;
window.toggleClientSelection = toggleClientSelection;
window.onTriggerTypeChange = onTriggerTypeChange;
window.onModeChange = onModeChange;
window.toggleForwardDelayDisplay = toggleForwardDelayDisplay;
window.addFirstStepToAction = addFirstStepToAction;
window.removeFirstStepFromAction = removeFirstStepFromAction;
window.onChainEnabledToggle = onChainEnabledToggle;
window.toggleChainItem = toggleChainItem;
window.toggleControlTargetItem = toggleControlTargetItem;
window.onControlOperationChange = onControlOperationChange;

window.openAntiDetectModal = openAntiDetectModal;
window.closeAntiDetectModal = closeAntiDetectModal;
window.randomizeUserAgent = randomizeUserAgent;
window.randomizeAllUserAgents = randomizeAllUserAgents;
window.clearUserAgent = clearUserAgent;
window.saveAntiDetectSettings = saveAntiDetectSettings;

window.openProxyModal = openProxyModal;
window.closeProxyModal = closeProxyModal;
window.clearProxy = clearProxy;
window.saveProxySettings = saveProxySettings;

window.openClientSettingsModal = openClientSettingsModal;
window.closeClientSettingsModal = closeClientSettingsModal;
window.randomizeClientModalUA = randomizeClientModalUA;
window.clearClientModalUA = clearClientModalUA;
window.clearClientModalProxy = clearClientModalProxy;
window.saveClientSettingsModal = saveClientSettingsModal;

window.toggleSuspendState = toggleSuspendState;
window.toast = toast;
window.addLog = addLog;
window.clearLogs = clearLogs;

// ─── Validator Modal Functions ───
window.openValidatorModal = function() {
  const profile = fullConfig.profiles[currentEditProfile];
  if (!profile || !profile.actions) return;

  const { issues, errorCount, warningCount } = validateProfile(profile.actions);
  const lang = currentLang;

  // If no issues, show clean toast and skip modal
  if (issues.length === 0) {
    toast(t('toastProfileValidatedClean') || '✓ Profile is clean!', 'success');
    return;
  }

  const modal = document.getElementById('validator-modal');
  if (!modal) return;

  // If in fullscreen mode, ensure modal is inside the fullscreen container
  const fsElement = document.fullscreenElement || document.webkitFullscreenElement;
  if (fsElement && modal.parentElement !== fsElement) {
    fsElement.appendChild(modal);
  } else if (!fsElement && modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }

  // Render summary bar
  const summaryEl = document.getElementById('validator-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <span style="color:#ef4444;">🔴 ${lang === 'en' ? 'Errors' : 'ข้อผิดพลาด'}: <strong>${errorCount}</strong></span>
      <span style="color:#f59e0b;">🟡 ${lang === 'en' ? 'Warnings' : 'คำเตือน'}: <strong>${warningCount}</strong></span>
      <span style="color:var(--muted); margin-left:auto; font-size:11px;">${lang === 'en' ? 'Total' : 'ทั้งหมด'}: ${issues.length}</span>
    `;
  }

  // Render issues list
  const listEl = document.getElementById('validator-issues-list');
  if (listEl) {
    listEl.innerHTML = '';
    issues.forEach((issue, idx) => {
      const severityColor = issue.severity === 'error' ? '#ef4444' : '#f59e0b';
      const severityIcon = issue.severity === 'error' ? '🔴' : '🟡';
      const severityLabel = issue.severity === 'error'
        ? (lang === 'en' ? 'ERROR' : 'ผิดพลาด')
        : (lang === 'en' ? 'WARNING' : 'คำเตือน');
      const message = lang === 'th' ? issue.messageTh : issue.messageEn;
      const fixBadge = issue.autoFixable
        ? `<span style="background:rgba(168,85,247,0.15); color:#c084fc; font-size:9px; padding:2px 6px; border-radius:4px; font-weight:700;">AUTO-FIX</span>`
        : `<span style="background:rgba(239,68,68,0.1); color:#f87171; font-size:9px; padding:2px 6px; border-radius:4px; font-weight:700;">${lang === 'en' ? 'MANUAL' : 'แก้เอง'}</span>`;

      const issueCard = document.createElement('div');
      issueCard.style.cssText = `padding:10px 14px; background:rgba(255,255,255,0.025); border:1px solid ${severityColor}33; border-radius:8px; border-left:3px solid ${severityColor};`;
      issueCard.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
          <span>${severityIcon}</span>
          <span style="color:${severityColor}; font-size:10px; font-weight:700; text-transform:uppercase;">${severityLabel}</span>
          ${fixBadge}
          <span style="color:var(--muted); font-size:10px; margin-left:auto;">#${idx + 1}</span>
        </div>
        <div style="font-size:12px; color:var(--text); font-weight:600; margin-bottom:2px;">📌 ${issue.actionName}</div>
        <div style="font-size:11px; color:var(--muted);">${message}</div>
      `;
      listEl.appendChild(issueCard);
    });
  }

  // Show/hide auto-fix button
  const autoFixBtn = document.getElementById('validator-autofix-btn');
  if (autoFixBtn) {
    const hasFixable = issues.some(i => i.autoFixable);
    autoFixBtn.style.display = hasFixable ? 'inline-flex' : 'none';
  }

  modal.classList.add('show');
};

window.closeValidatorModal = function() {
  const modal = document.getElementById('validator-modal');
  if (modal) {
    modal.classList.remove('show');
  }
};

window.autoFixFromModal = function() {
  const fixedCount = autoFixProfile();
  closeValidatorModal();
  if (fixedCount > 0) {
    const msg = (t('toastProfileAutoFixed') || '✓ Automatically resolved {count} issue(s)!').replace('{count}', fixedCount);
    toast(msg, 'success');
  }
};

function updateLanguageUI() {
  const lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
      if (key === 'applySave') {
        el.innerHTML = `💾 ${TRANSLATIONS[lang][key].substring(2)}`;
      } else if (key === 'addCustomAction') {
        el.innerHTML = `➕ ${TRANSLATIONS[lang][key].substring(2)}`;
      } else {
        el.textContent = TRANSLATIONS[lang][key];
      }
    }
  });

  const nameInput = document.getElementById('new-profile-name');
  if (nameInput) {
    nameInput.placeholder = lang === 'en' ? 'e.g. Healer-PvP' : 'เช่น Healer-PvP';
  }

  const urlInput = document.getElementById('target-url-keyword');
  if (urlInput) {
    urlInput.placeholder = lang === 'en' ? 'e.g. universe.flyff.com' : 'เช่น universe.flyff.com';
  }

  const saveBtn = document.getElementById('btn-save-profile');
  if (saveBtn) {
    saveBtn.title = lang === 'en' ? 'Save profile to file (Ctrl+S)' : 'บันทึกโปรไฟล์ลงไฟล์ (Ctrl+S)';
  }

  populateProfileDropdowns();

  if (fullConfig.profiles[currentEditProfile]) {
    loadProfileToUI(fullConfig.profiles[currentEditProfile]);
  }

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.classList.contains(lang));
  });

  // Sync Canvas Language Real-time
  if (window.nodeCanvas && typeof window.nodeCanvas.updateLanguage === 'function') {
    window.nodeCanvas.updateLanguage(lang);
  }
}

// Global Event Listeners Setup & Initialization
async function initApp() {
  initActionsModule();
  setup3D();

  setRecordSaveCallback((actionId, type, value) => {
    if (type === 'suspend_hotkey') {
      const profile = fullConfig.profiles[currentEditProfile];
      if (profile) profile.suspendHotkey = value;
    } else if (actionId) {
      if (window.nodeCanvas && Array.isArray(window.nodeCanvas.nodes)) {
        const node = window.nodeCanvas.nodes.find(n => n.id === actionId);
        if (node) {
          if (!node.data) node.data = {};
          if (type === 'hotkey') {
            node.data.triggerValue = value;
          } else if (type === 'comma_keys') {
            node.data.keys = value.split(',').map(s => s.trim()).filter(Boolean);
          } else if (type === 'single_key') {
            if (node.type === 'forwarder' || node.type === 'key_hold') {
              node.data.targetKey = value;
            } else {
              node.data.keys = value ? [value] : ['1'];
            }
          } else if (type && (type.startsWith('sequencer_step_') || type.startsWith('macro_step_'))) {
            const stepIdx = parseInt(type.replace('sequencer_step_', '').replace('macro_step_', ''), 10);
            if (Array.isArray(node.data.steps) && node.data.steps[stepIdx]) {
              node.data.steps[stepIdx].key = value;
            }
          }
          window.nodeCanvas.renderNodes();
          window.nodeCanvas.renderOutliner();
          if (window.nodeCanvas.inspectorPanel && window.nodeCanvas.inspectorPanel.classList.contains('open')) {
            window.nodeCanvas.openInspector(node.id);
          }
          window.nodeCanvas.onProfileChanged();
        }
      }
      syncActionFromDom(actionId);
    }
    saveCurrentProfile();
  });

  // Initialize Node Canvas Editor
  if (typeof window.NodeCanvasEditor === 'function') {
    window.nodeCanvas = new window.NodeCanvasEditor('node-canvas-container', {
      onProfileChanged: () => {
        if (fullConfig && fullConfig.profiles && currentEditProfile && fullConfig.profiles[currentEditProfile]) {
          const canvasData = window.nodeCanvas.exportProfileData();
          const p = fullConfig.profiles[currentEditProfile];
          p.version = canvasData.version;
          p.canvas = canvasData.canvas;
          p.nodes = canvasData.nodes;
          p.connections = canvasData.connections;
          delete p.actions;
          saveCurrentProfile();
        }
      }
    });
  }

  await fetchCooldownPresets();
  loadConfig();
  updateLanguageUI();
  renderClientToggles();
  checkAppUpdate();

  // Multi-select custom dropdown behavior without Ctrl key
  window.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'OPTION' && e.target.parentNode.multiple) {
      e.preventDefault();
      const select = e.target.parentNode;
      const scroll = select.scrollTop;
      e.target.selected = !e.target.selected;
      setTimeout(() => { select.scrollTop = scroll; }, 0);
      select.dispatchEvent(new Event('change'));
    }
  }, true);

  // Global Keyboard Shortcuts (Ctrl+S for Save, Ctrl+Z for Undo, Ctrl+Y for Redo)
  window.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
    const activeEl = document.activeElement;
    const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

    // Ctrl+S / Cmd+S -> Save Profile to file
    if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onManualSaveProfile();
      return;
    }

    // Ctrl+Z / Cmd+Z -> Undo
    if (isCmdOrCtrl && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      if (!isInputActive) {
        e.preventDefault();
        triggerUndo();
      }
      return;
    }

    // Ctrl+Y or Ctrl+Shift+Z -> Redo
    if ((isCmdOrCtrl && e.key.toLowerCase() === 'y') || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
      if (!isInputActive) {
        e.preventDefault();
        triggerRedo();
      }
      return;
    }
  });

  // Warn user if leaving page with unsaved changes
  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Sync fullscreen change event
  document.addEventListener('fullscreenchange', () => {
    const canvasWrapper = document.getElementById('node-canvas-container');
    const btn = document.getElementById('btn-fullscreen-toggle');
    const canvasBtn = document.getElementById('btn-canvas-fullscreen');
    if (!document.fullscreenElement) {
      if (canvasWrapper) canvasWrapper.classList.remove('fullscreen-mode');
      if (btn) btn.innerHTML = '⛶ เต็มจอ';
      if (canvasBtn) canvasBtn.innerHTML = '⛶';
    } else {
      if (btn) btn.innerHTML = '🗗 ย่อจอ';
      if (canvasBtn) canvasBtn.innerHTML = '🗗';
    }
  });

  // Periodic status poll
  setInterval(() => {
    pollActiveClients();
  }, 3000);
}

async function checkAppUpdate() {
  try {
    const res = await fetch('/api/update-check');
    const data = await res.json();
    if (data.hasUpdate) {
      const container = document.getElementById('update-badge-container');
      const textEl = document.getElementById('update-badge-text');
      const linkEl = document.getElementById('update-badge-link');

      if (container && textEl) {
        textEl.textContent = `🚀 Update v${data.latestVersion} Available!`;
        if (linkEl && data.repoUrl) linkEl.href = data.repoUrl;
        container.style.display = 'block';
      }

      if (typeof window.toast === 'function') {
        window.toast(`🚀 GitHub Update Available: v${data.latestVersion}!`, 'info');
      }
    }
  } catch (e) {}
}

// Prevent Mouse Button 4 & 5 (Back/Forward) from navigating or reloading the Canvas
window.addEventListener('mouseup', (e) => {
  if (e.button === 3 || e.button === 4) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

window.addEventListener('mousedown', (e) => {
  if (e.button === 3 || e.button === 4) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

window.addEventListener('auxclick', (e) => {
  if (e.button === 3 || e.button === 4) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
