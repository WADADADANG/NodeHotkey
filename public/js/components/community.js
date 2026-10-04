/**
 * NodeHotkey Community Hub & Profile Workshop Client
 * Powered by Cloudflare D1 + Cloudflare Workers
 * Fully localized with i18n support (TH / EN)
 * Pure In-App Custom Modals (No native browser alert/confirm/prompt)
 */

import { t, currentLang } from '../i18n.js';

const COMMUNITY_API_URL = 'https://nodehotkey-api.kitsada19972540.workers.dev';

let myIdentity = null;
let cachedCommunityProfiles = [];
let activeTab = 'all'; // 'all' | 'my'
let activeSort = 'downloads'; // 'downloads' | 'recent'
let activeSearchQuery = '';
let isLoading = false;

function getActiveLang() {
  return window.currentLang || currentLang || 'th';
}

// Format relative date or simple date
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const locale = getActiveLang() === 'th' ? 'th-TH' : 'en-US';
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

// Escape HTML for safe rendering
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function fetchCreatorIdentity() {
  try {
    const res = await fetch('/api/community/identity');
    const data = await res.json();
    if (data.success && data.identity) {
      myIdentity = data.identity;
      updateAuthorDisplayUI();
      return myIdentity;
    }
  } catch (e) {
    console.error('[Community Hub] Failed to fetch creator identity:', e);
  }
  return null;
}

function updateAuthorDisplayUI() {
  const el = document.getElementById('community-current-author');
  if (el && myIdentity) {
    el.textContent = myIdentity.authorName || myIdentity.authorId || 'Anonymous';
  }
}

// ─── Custom Modal: Change Author Name ───
export async function openChangeAuthorModal() {
  if (!myIdentity) await fetchCreatorIdentity();
  const modal = document.getElementById('author-name-modal');
  const input = document.getElementById('input-new-author-name');
  if (!modal || !input) return;

  input.value = myIdentity ? (myIdentity.authorName || '') : '';
  modal.classList.add('show');
  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);
}

export const promptChangeAuthorName = openChangeAuthorModal;

export function closeChangeAuthorModal() {
  const modal = document.getElementById('author-name-modal');
  if (modal) modal.classList.remove('show');
}

export async function confirmChangeAuthorName() {
  const input = document.getElementById('input-new-author-name');
  if (!input) return;
  const newName = input.value.trim();
  if (!newName) {
    if (typeof window.toast === 'function') {
      window.toast(getActiveLang() === 'en' ? '⚠️ Please enter an author name' : '⚠️ กรุณาระบุชื่อผู้สร้างที่ต้องการ', 'warning');
    }
    return;
  }

  try {
    const res = await fetch('/api/community/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorName: newName })
    });
    const data = await res.json();
    if (data.success && data.identity) {
      myIdentity = data.identity;
      updateAuthorDisplayUI();
      closeChangeAuthorModal();
      if (typeof window.toast === 'function') {
        const msg = (t('authorModalSuccessToast') || '✅ Updated author name to "{name}" successfully').replace('{name}', myIdentity.authorName);
        window.toast(msg, 'success');
      }
    }
  } catch (e) {
    if (typeof window.toast === 'function') {
      window.toast(`❌ ${e.message}`, 'error');
    }
  }
}

// ─── Custom Modal: Confirm Delete Community Profile ───
export function openCommunityDeleteModal(profileId, profileName) {
  const modal = document.getElementById('community-delete-modal');
  const desc = document.getElementById('community-delete-desc');
  const idInput = document.getElementById('community-delete-id');
  const nameInput = document.getElementById('community-delete-name');
  if (!modal) return;

  const descTemplate = t('deleteModalConfirmDesc') || 'Are you sure you want to delete profile "{name}" from Community Hub?';
  if (desc) desc.textContent = descTemplate.replace('{name}', profileName);
  if (idInput) idInput.value = profileId;
  if (nameInput) nameInput.value = profileName;

  modal.classList.add('show');
}

export function closeCommunityDeleteModal() {
  const modal = document.getElementById('community-delete-modal');
  if (modal) modal.classList.remove('show');
}

export async function confirmDeleteCommunityProfile() {
  const idInput = document.getElementById('community-delete-id');
  const nameInput = document.getElementById('community-delete-name');
  const profileId = idInput ? idInput.value : '';
  const profileName = nameInput ? nameInput.value : '';
  if (!profileId) return;

  if (!myIdentity || !myIdentity.authorSecret) {
    await fetchCreatorIdentity();
  }

  closeCommunityDeleteModal();

  try {
    const res = await fetch(`${COMMUNITY_API_URL}/api/profiles/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: profileId,
        author_secret: myIdentity ? myIdentity.authorSecret : ''
      })
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Delete failed');
    }

    if (typeof window.toast === 'function') {
      const msg = (t('deleteSuccessToast') || '🗑️ Deleted profile "{name}" from Community Hub successfully').replace('{name}', profileName);
      window.toast(msg, 'info');
    }

    cachedCommunityProfiles = cachedCommunityProfiles.filter(p => p.id !== profileId);
    renderCommunityProfiles();
  } catch (err) {
    if (typeof window.toast === 'function') {
      const msg = (t('deleteErrorToast') || '❌ Failed to delete: {error}').replace('{error}', err.message);
      window.toast(msg, 'error');
    }
  }
}

// ─── Community Hub Main Modal ───
export async function openCommunityHubModal() {
  const modal = document.getElementById('community-hub-modal');
  if (!modal) return;
  modal.classList.add('show');

  if (!myIdentity) {
    await fetchCreatorIdentity();
  } else {
    updateAuthorDisplayUI();
  }

  loadCommunityProfiles();
}

export function closeCommunityHubModal() {
  const modal = document.getElementById('community-hub-modal');
  if (modal) modal.classList.remove('show');
}

export async function loadCommunityProfiles() {
  const container = document.getElementById('community-profiles-container');
  if (!container) return;

  isLoading = true;
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:50px 20px; color:var(--muted); gap:12px;">
      <div class="spinner" style="width:32px; height:32px; border:3px solid rgba(56,189,248,0.2); border-top-color:#38bdf8; border-radius:50%; animation:spin 0.8s linear infinite;"></div>
      <div style="font-size:13px; font-weight:600;">${escapeHtml(t('communityLoading') || 'Loading profiles from Cloudflare Community Hub...')}</div>
    </div>
  `;

  try {
    const url = new URL(`${COMMUNITY_API_URL}/api/profiles`);
    if (activeSort) url.searchParams.set('sort', activeSort);
    if (activeSearchQuery) url.searchParams.set('q', activeSearchQuery);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.success && Array.isArray(data.profiles)) {
      cachedCommunityProfiles = data.profiles;
      renderCommunityProfiles();
    } else {
      throw new Error(data.error || 'Failed to fetch profiles');
    }
  } catch (err) {
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; text-align:center; color:#f87171; gap:10px;">
        <div style="font-size:24px;">⚠️</div>
        <div style="font-size:13px; font-weight:600;">${escapeHtml(err.message)}</div>
        <button type="button" class="btn btn-ghost" onclick="window.loadCommunityProfiles()" style="margin-top:8px; font-size:12px; padding:6px 14px;">🔄 ${getActiveLang() === 'en' ? 'Retry' : 'ลองใหม่อีกครั้ง'}</button>
      </div>
    `;
  } finally {
    isLoading = false;
  }
}

export function renderCommunityProfiles() {
  const container = document.getElementById('community-profiles-container');
  if (!container) return;

  let list = [...cachedCommunityProfiles];

  // Filter if 'My Uploads' tab is active
  if (activeTab === 'my') {
    const myId = myIdentity ? myIdentity.authorId : '';
    list = list.filter(p => p.author_id === myId);
  }

  if (list.length === 0) {
    const emptyTitle = t('communityEmptyTitle') || 'No profiles found in this category';
    const emptyDesc = activeTab === 'my'
      ? (t('communityEmptyDescMy') || "You haven't uploaded any profiles to Community Hub yet.")
      : (t('communityEmptyDescAll') || 'No profiles match your search criteria or none uploaded yet.');
    const shareFirstText = t('communityShareFirstBtn') || '🚀 Be the first to share your profile';

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; text-align:center; color:var(--muted); gap:10px;">
        <div style="font-size:36px; opacity:0.6;">📦</div>
        <div style="font-size:14px; font-weight:600; color:var(--text);">${escapeHtml(emptyTitle)}</div>
        <div style="font-size:12px; max-width:320px;">${escapeHtml(emptyDesc)}</div>
        <button type="button" class="btn btn-primary" onclick="window.openShareProfileModal()" style="margin-top:10px; font-size:12px; padding:6px 16px;">${escapeHtml(shareFirstText)}</button>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
  grid.style.gap = '14px';
  grid.style.padding = '4px 2px';

  list.forEach(p => {
    const isMine = myIdentity && p.author_id === myIdentity.authorId;
    const card = document.createElement('div');
    card.className = 'community-card';
    card.style.background = 'rgba(15, 23, 42, 0.75)';
    card.style.border = isMine ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)';
    card.style.borderRadius = '10px';
    card.style.padding = '14px 16px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';
    card.style.gap = '12px';
    card.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
    card.style.transition = 'all 0.2s ease';

    const tagsArr = (p.tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
    const byAuthorText = (t('communityByAuthor') || 'By {author}').replace('{author}', `<strong style="color:#cbd5e1;">${escapeHtml(p.author_name || 'Anonymous')}</strong>`);
    const downloadsText = (t('communityDownloadsCount') || '{count} downloads').replace('{count}', p.downloads_count || 0);
    const installBtnText = t('communityInstallBtn') || '📥 Install';
    const badgeMineText = t('communityBadgeMine') || '👑 Yours';
    const noDescText = t('communityNoDesc') || 'No description provided';

    card.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <h3 style="font-size:14px; font-weight:700; color:var(--text); margin:0; word-break:break-word;">${escapeHtml(p.profile_name)}</h3>
            <span style="font-size:10px; font-weight:700; background:rgba(56,189,248,0.12); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); border-radius:4px; padding:1px 5px;">v${escapeHtml(p.version || '1.0.0')}</span>
          </div>
          ${isMine ? `
            <span style="font-size:10px; font-weight:700; background:rgba(245,158,11,0.15); color:#f59e0b; border:1px solid rgba(245,158,11,0.4); border-radius:12px; padding:2px 8px; flex-shrink:0;">${escapeHtml(badgeMineText)}</span>
          ` : ''}
        </div>

        <div style="font-size:11px; color:var(--muted); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <span>👤 ${byAuthorText}</span>
          <span>•</span>
          <span>🕒 ${formatDate(p.updated_at || p.created_at)}</span>
        </div>

        <p style="font-size:12px; color:#94a3b8; margin:0 0 10px 0; line-height:1.45; word-break:break-word; max-height:52px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical;">
          ${escapeHtml(p.description || noDescText)}
        </p>

        ${tagsArr.length > 0 ? `
          <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">
            ${tagsArr.map(tag => `
              <span style="font-size:10px; background:rgba(255,255,255,0.05); color:#a1a1aa; border-radius:4px; padding:1px 6px;">#${escapeHtml(tag)}</span>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.06); padding-top:10px; margin-top:4px;">
        <div style="display:flex; align-items:center; gap:4px; font-size:11.5px; color:#38bdf8; font-weight:600;">
          <span>📥</span>
          <span>${escapeHtml(downloadsText)}</span>
        </div>

        <div style="display:flex; align-items:center; gap:6px;">
          <button type="button" class="btn btn-primary btn-install-profile" data-profile-id="${p.id}" data-profile-name="${escapeHtml(p.profile_name)}"
            style="padding:4px 12px; font-size:11.5px; font-weight:700; background:linear-gradient(135deg,#0284c7,#0369a1); border-radius:6px; color:#fff; display:flex; align-items:center; gap:4px; cursor:pointer;">
            ${escapeHtml(installBtnText)}
          </button>

          ${isMine ? `
            <button type="button" class="btn btn-ghost btn-update-mine" data-profile-id="${p.id}" data-profile-name="${escapeHtml(p.profile_name)}"
              title="${getActiveLang() === 'en' ? 'Update this profile' : 'อัปเดตข้อมูลทับโปรไฟล์นี้'}"
              style="padding:4px 8px; font-size:11px; border-color:rgba(245,158,11,0.4); color:#f59e0b; background:rgba(245,158,11,0.1); border-radius:6px; cursor:pointer;">
              🔄
            </button>
            <button type="button" class="btn btn-ghost btn-delete-mine" data-profile-id="${p.id}" data-profile-name="${escapeHtml(p.profile_name)}"
              title="${getActiveLang() === 'en' ? 'Delete from Community Hub' : 'ลบออกจาก Community Hub'}"
              style="padding:4px 8px; font-size:11px; border-color:rgba(239,68,68,0.4); color:#ef4444; background:rgba(239,68,68,0.1); border-radius:6px; cursor:pointer;">
              🗑️
            </button>
          ` : ''}
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  // Attach event handlers
  grid.querySelectorAll('.btn-install-profile').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-profile-id');
      const name = btn.getAttribute('data-profile-name');
      installCommunityProfile(id, name, btn);
    });
  });

  grid.querySelectorAll('.btn-update-mine').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-profile-id');
      const name = btn.getAttribute('data-profile-name');
      openShareProfileModal(name, id);
    });
  });

  grid.querySelectorAll('.btn-delete-mine').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-profile-id');
      const name = btn.getAttribute('data-profile-name');
      openCommunityDeleteModal(id, name);
    });
  });

  container.appendChild(grid);
}

// 1-Click Install Community Profile into NodeHotkey local store
export async function installCommunityProfile(profileId, profileName, btnEl = null) {
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = `<span>⏳</span> ${escapeHtml(t('communityInstallingBtn') || 'Installing...')}`;
  }

  try {
    // 1. Download profile data from Cloudflare Worker
    const res = await fetch(`${COMMUNITY_API_URL}/api/profiles/${profileId}`);
    const data = await res.json();

    if (!data.success || !data.profile) {
      throw new Error(data.error || 'Failed to download profile');
    }

    const { profile } = data;
    const rawData = typeof profile.profile_data === 'string' ? JSON.parse(profile.profile_data) : profile.profile_data;

    // Attach community link metadata
    rawData.communityId = profileId;
    rawData.authorName = profile.author_name;

    // 2. Install to local server
    const installRes = await fetch('/api/community/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileName: profile.profile_name,
        profileData: rawData,
        overwrite: false
      })
    });

    const installData = await installRes.json();
    if (!installData.success) {
      throw new Error(installData.error || 'Failed to install to local storage');
    }

    const installedName = installData.installedName || profile.profile_name;

    if (typeof window.toast === 'function') {
      const msg = (t('communityInstalledSuccess') || '🎉 Successfully installed profile "{name}"!').replace('{name}', installedName);
      window.toast(msg, 'success');
    }

    // Refresh local app state if available
    if (typeof window.loadConfig === 'function') {
      window.loadConfig();
    }

    // Increment downloads count locally in UI
    const target = cachedCommunityProfiles.find(p => p.id === profileId);
    if (target) target.downloads_count = (target.downloads_count || 0) + 1;
    renderCommunityProfiles();

  } catch (err) {
    if (typeof window.toast === 'function') {
      const msg = (t('communityInstalledError') || '❌ Installation failed: {error}').replace('{error}', err.message);
      window.toast(msg, 'error');
    }
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = escapeHtml(t('communityInstallBtn') || '📥 Install');
    }
  }
}

// Open Share to Community Modal
export async function openShareProfileModal(preferredProfileName = null, communityId = null) {
  const modal = document.getElementById('share-profile-modal');
  if (!modal) return;

  if (!myIdentity) await fetchCreatorIdentity();

  const profileSelect = document.getElementById('share-profile-select');
  const nameInput = document.getElementById('share-profile-name');
  const authorInput = document.getElementById('share-author-name');
  const descInput = document.getElementById('share-profile-desc');
  const tagsInput = document.getElementById('share-profile-tags');
  const versionInput = document.getElementById('share-profile-version');
  const communityIdInput = document.getElementById('share-community-id');

  if (authorInput && myIdentity) {
    authorInput.value = myIdentity.authorName || 'Player';
  }

  if (communityIdInput) {
    communityIdInput.value = communityId || '';
  }

  // Populate local profiles list dropdown
  if (profileSelect && window.fullConfig && window.fullConfig.profiles) {
    profileSelect.innerHTML = '';
    const profNames = Object.keys(window.fullConfig.profiles);
    profNames.forEach(pName => {
      const opt = document.createElement('option');
      opt.value = pName;
      opt.textContent = pName;
      if (preferredProfileName && pName === preferredProfileName) {
        opt.selected = true;
      } else if (!preferredProfileName && window.currentEditProfile === pName) {
        opt.selected = true;
      }
      profileSelect.appendChild(opt);
    });

    const activeSelected = profileSelect.value;
    if (nameInput) nameInput.value = activeSelected || '';

    profileSelect.onchange = () => {
      if (nameInput) nameInput.value = profileSelect.value;
    };
  } else if (nameInput && preferredProfileName) {
    nameInput.value = preferredProfileName;
  }

  // Pre-fill existing metadata if updating
  if (communityId) {
    const existing = cachedCommunityProfiles.find(p => p.id === communityId);
    if (existing) {
      if (nameInput) nameInput.value = existing.profile_name;
      if (descInput) descInput.value = existing.description || '';
      if (tagsInput) tagsInput.value = existing.tags || '';
      if (versionInput) versionInput.value = existing.version || '1.0.0';
    }
  }

  modal.classList.add('show');
}

export function closeShareProfileModal() {
  const modal = document.getElementById('share-profile-modal');
  if (modal) modal.classList.remove('show');
}

// Submit profile to Cloudflare Community Hub
export async function submitShareProfile() {
  const btn = document.getElementById('btn-submit-share-profile');
  const profileSelect = document.getElementById('share-profile-select');
  const nameInput = document.getElementById('share-profile-name');
  const authorInput = document.getElementById('share-author-name');
  const descInput = document.getElementById('share-profile-desc');
  const tagsInput = document.getElementById('share-profile-tags');
  const versionInput = document.getElementById('share-profile-version');
  const communityIdInput = document.getElementById('share-community-id');

  const selectedProfileName = profileSelect ? profileSelect.value : (window.currentEditProfile || 'Default');
  const publishedName = nameInput ? nameInput.value.trim() : selectedProfileName;
  const authorName = authorInput ? authorInput.value.trim() : (myIdentity ? myIdentity.authorName : 'Creator');
  const description = descInput ? descInput.value.trim() : '';
  const tags = tagsInput ? tagsInput.value.trim() : '';
  const version = versionInput ? versionInput.value.trim() : '1.0.0';
  const existingCommunityId = communityIdInput ? communityIdInput.value.trim() : '';

  if (!publishedName) {
    if (typeof window.toast === 'function') {
      window.toast(t('shareWarnNameRequired') || '⚠️ Please enter a profile name to share', 'warning');
    }
    return;
  }

  if (!myIdentity || !myIdentity.authorId || !myIdentity.authorSecret) {
    await fetchCreatorIdentity();
  }

  // Update author nickname locally if changed
  if (authorName && myIdentity && authorName !== myIdentity.authorName) {
    fetch('/api/community/identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorName })
    }).catch(() => {});
    myIdentity.authorName = authorName;
    updateAuthorDisplayUI();
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>⏳</span> ${escapeHtml(t('shareSubmittingBtn') || 'Uploading...')}`;
  }

  try {
    // 1. Fetch fresh profile data from server
    const profRes = await fetch(`/api/community/profile-for-share?name=${encodeURIComponent(selectedProfileName)}`);
    const profData = await profRes.json();

    if (!profData.success || !profData.profile) {
      throw new Error(profData.error || 'Failed to read local profile data');
    }

    const payload = {
      id: existingCommunityId || undefined,
      profile_name: publishedName,
      author_id: myIdentity.authorId,
      author_name: authorName,
      author_secret: myIdentity.authorSecret,
      description: description,
      tags: tags,
      profile_data: profData.profile,
      version: version
    };

    // 2. Upload to Cloudflare Worker
    const uploadRes = await fetch(`${COMMUNITY_API_URL}/api/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const uploadResult = await uploadRes.json();

    if (!uploadResult.success) {
      throw new Error(uploadResult.error || 'Upload failed');
    }

    if (typeof window.toast === 'function') {
      const msg = (t('shareSuccessToast') || '🎉 Shared profile "{name}" successfully!').replace('{name}', publishedName);
      window.toast(msg, 'success');
    }

    closeShareProfileModal();

    // Reload community list
    activeTab = 'my';
    const tabMy = document.getElementById('tab-community-my');
    const tabAll = document.getElementById('tab-community-all');
    if (tabMy && tabAll) {
      tabMy.classList.add('active');
      tabAll.classList.remove('active');
    }
    loadCommunityProfiles();

  } catch (err) {
    if (typeof window.toast === 'function') {
      const msg = (t('shareErrorToast') || '❌ Failed to share: {error}').replace('{error}', err.message);
      window.toast(msg, 'error');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>🚀</span> ${escapeHtml(t('shareSubmitBtn') || 'Publish to Community Hub')}`;
    }
  }
}

// Bind search and filter events
export function initCommunityUI() {
  // Search input
  const searchInput = document.getElementById('community-search-input');
  if (searchInput) {
    let debounceTimer = null;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        activeSearchQuery = searchInput.value.trim();
        loadCommunityProfiles();
      }, 350);
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('community-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      activeSort = sortSelect.value;
      loadCommunityProfiles();
    });
  }

  // Tabs
  const tabAll = document.getElementById('tab-community-all');
  const tabMy = document.getElementById('tab-community-my');

  if (tabAll) {
    tabAll.addEventListener('click', () => {
      activeTab = 'all';
      tabAll.classList.add('active');
      if (tabMy) tabMy.classList.remove('active');
      renderCommunityProfiles();
    });
  }

  if (tabMy) {
    tabMy.addEventListener('click', () => {
      activeTab = 'my';
      tabMy.classList.add('active');
      if (tabAll) tabAll.classList.remove('active');
      renderCommunityProfiles();
    });
  }

  // Handle Enter key on Change Author input
  const authorInput = document.getElementById('input-new-author-name');
  if (authorInput) {
    authorInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmChangeAuthorName();
      } else if (e.key === 'Escape') {
        closeChangeAuthorModal();
      }
    });
  }

  // Expose global window hooks
  window.openCommunityHubModal = openCommunityHubModal;
  window.closeCommunityHubModal = closeCommunityHubModal;
  window.loadCommunityProfiles = loadCommunityProfiles;
  window.renderCommunityProfiles = renderCommunityProfiles;
  window.openShareProfileModal = openShareProfileModal;
  window.closeShareProfileModal = closeShareProfileModal;
  window.submitShareProfile = submitShareProfile;

  // Author Change Modal
  window.openChangeAuthorModal = openChangeAuthorModal;
  window.closeChangeAuthorModal = closeChangeAuthorModal;
  window.confirmChangeAuthorName = confirmChangeAuthorName;
  window.promptChangeAuthorName = openChangeAuthorModal; // Alias for backward compatibility

  // Delete Confirm Modal
  window.openCommunityDeleteModal = openCommunityDeleteModal;
  window.closeCommunityDeleteModal = closeCommunityDeleteModal;
  window.confirmDeleteCommunityProfile = confirmDeleteCommunityProfile;

  // Pre-fetch identity
  fetchCreatorIdentity();
}
