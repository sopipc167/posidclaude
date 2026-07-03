(function () {
  const STORAGE_USERNAME = 'gift.adminUsername';
  const STORAGE_PASSWORD = 'gift.adminPassword';

  const els = {
    loginView: document.getElementById('loginView'),
    adminView: document.getElementById('adminView'),
    usernameInput: document.getElementById('usernameInput'),
    passwordInput: document.getElementById('passwordInput'),
    loginBtn: document.getElementById('loginBtn'),
    loginError: document.getElementById('loginError'),
    exportBtn: document.getElementById('exportBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    statGrid: document.getElementById('statGrid'),
    giftTableBody: document.getElementById('giftTableBody'),
    emptyState: document.getElementById('emptyState'),
    identityTableBody: document.getElementById('identityTableBody'),
    identityEmptyState: document.getElementById('identityEmptyState'),
    voteTableBody: document.getElementById('voteTableBody'),
    voteEmptyState: document.getElementById('voteEmptyState'),
    toast: document.getElementById('toast'),
  };

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  function getCredentials() {
    return {
      username: sessionStorage.getItem(STORAGE_USERNAME) || '',
      password: sessionStorage.getItem(STORAGE_PASSWORD) || '',
    };
  }

  function setCredentials(username, password) {
    sessionStorage.setItem(STORAGE_USERNAME, username);
    sessionStorage.setItem(STORAGE_PASSWORD, password);
  }

  function clearCredentials() {
    sessionStorage.removeItem(STORAGE_USERNAME);
    sessionStorage.removeItem(STORAGE_PASSWORD);
  }

  async function adminFetch(url, options = {}) {
    const { username, password } = getCredentials();
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        'x-admin-username': username,
        'x-admin-password': password,
      },
    });
    if (res.status === 401) {
      clearCredentials();
      showLogin('세션이 만료되었습니다. 다시 로그인해 주세요.');
      throw new Error('unauthorized');
    }
    return res;
  }

  function showLogin(message) {
    els.loginView.style.display = 'block';
    els.adminView.style.display = 'none';
    if (message) {
      els.loginError.textContent = message;
      els.loginError.classList.add('show');
    } else {
      els.loginError.classList.remove('show');
    }
  }

  let liveUpdatesConnected = false;
  function connectLiveUpdates() {
    if (liveUpdatesConnected || typeof EventSource === 'undefined') return;
    liveUpdatesConnected = true;
    const source = new EventSource('/api/events');
    source.addEventListener('gifts-changed', () => {
      loadAll();
    });
  }

  function showAdmin() {
    els.loginView.style.display = 'none';
    els.adminView.style.display = 'block';
    loadAll();
    connectLiveUpdates();
  }

  async function tryLogin(username, password) {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      setCredentials(username, password);
      showAdmin();
    } else {
      showLogin('아이디 또는 비밀번호가 올바르지 않습니다.');
    }
  }

  els.loginBtn.addEventListener('click', () => {
    const username = els.usernameInput.value.trim();
    const password = els.passwordInput.value;
    if (!username || !password) return;
    tryLogin(username, password);
  });

  [els.usernameInput, els.passwordInput].forEach((input) => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') els.loginBtn.click();
    });
  });

  els.logoutBtn.addEventListener('click', () => {
    clearCredentials();
    showLogin();
  });

  els.exportBtn.addEventListener('click', () => {
    downloadCsv();
  });

  async function downloadCsv() {
    try {
      const res = await adminFetch('/api/admin/export.csv');
      if (!res.ok) {
        showToast('내보내기에 실패했습니다.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gift-list.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      /* handled by adminFetch */
    }
  }

  function statTile(label, value) {
    const div = document.createElement('div');
    div.className = 'stat-tile';
    div.innerHTML = `<div class="label">${label}</div><div class="value">${value}</div>`;
    return div;
  }

  async function loadSummary() {
    const res = await adminFetch('/api/admin/summary');
    const data = await res.json();
    els.statGrid.innerHTML = '';
    els.statGrid.appendChild(statTile('총 제안 수', data.totalGifts));
    els.statGrid.appendChild(statTile('총 투표 수', data.totalVotes));
    els.statGrid.appendChild(statTile('참여 인원', data.uniqueParticipants));
    els.statGrid.appendChild(
      statTile('최다 득표 선물', data.topGift ? `${data.topGift.text} (${data.topGift.voteCount}표)` : '-')
    );
  }

  async function loadGifts() {
    const res = await adminFetch('/api/gifts');
    const gifts = await res.json();
    els.giftTableBody.innerHTML = '';
    els.emptyState.style.display = gifts.length ? 'none' : 'block';
    const maxVotes = gifts.reduce((m, g) => Math.max(m, g.voteCount), 0) || 1;

    gifts.forEach((gift, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="num">${idx + 1}</td>
        <td>${escapeHtml(gift.text)}</td>
        <td>${escapeHtml(gift.proposerEmployeeId)}</td>
        <td>${escapeHtml(gift.proposerName)}</td>
        <td>${escapeHtml(gift.team || '-')}</td>
        <td>
          <div class="bar-cell">
            <div class="track"><div class="fill" style="width:${(gift.voteCount / maxVotes) * 100}%"></div></div>
            <span class="num">${gift.voteCount}</span>
          </div>
        </td>
        <td></td>
      `;
      const delTd = tr.querySelector('td:last-child');
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = '삭제';
      delBtn.addEventListener('click', () => deleteGift(gift.id));
      delTd.appendChild(delBtn);
      els.giftTableBody.appendChild(tr);
    });
  }

  async function loadIdentities() {
    const res = await adminFetch('/api/admin/identities');
    const identities = await res.json();
    els.identityTableBody.innerHTML = '';
    els.identityEmptyState.style.display = identities.length ? 'none' : 'block';

    identities.forEach((identity) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(identity.employeeId)}</td>
        <td>${escapeHtml(identity.name)}</td>
        <td>${escapeHtml(identity.team)}</td>
        <td>${escapeHtml(identity.createdAt)}</td>
        <td></td>
      `;
      const delTd = tr.querySelector('td:last-child');
      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = '삭제';
      delBtn.addEventListener('click', () => deleteIdentity(identity.employeeId));
      delTd.appendChild(delBtn);
      els.identityTableBody.appendChild(tr);
    });
  }

  async function deleteIdentity(employeeId) {
    if (
      !confirm(
        `사번 ${employeeId} 유저를 삭제할까요?\n이 사람의 등록 정보와 투표 기록이 삭제됩니다. (제안한 선물은 남아있습니다)`
      )
    )
      return;
    const res = await adminFetch(`/api/admin/identities/${encodeURIComponent(employeeId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      showToast('삭제되었습니다.');
      loadAll();
    } else {
      showToast('삭제에 실패했습니다.');
    }
  }

  async function loadVotes() {
    const res = await adminFetch('/api/admin/votes');
    const votes = await res.json();
    els.voteTableBody.innerHTML = '';
    els.voteEmptyState.style.display = votes.length ? 'none' : 'block';

    votes.forEach((vote) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(vote.employeeId)}</td>
        <td>${escapeHtml(vote.voterName)}</td>
        <td>${escapeHtml(vote.team)}</td>
        <td>${escapeHtml(vote.giftText)}</td>
        <td>${escapeHtml(vote.createdAt)}</td>
      `;
      els.voteTableBody.appendChild(tr);
    });
  }

  async function deleteGift(id) {
    if (!confirm('이 제안을 삭제할까요? 관련 투표도 함께 삭제됩니다.')) return;
    const res = await adminFetch(`/api/admin/gifts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('삭제되었습니다.');
      loadAll();
    } else {
      showToast('삭제에 실패했습니다.');
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function loadAll() {
    loadSummary().catch(() => {});
    loadGifts().catch(() => {});
    loadIdentities().catch(() => {});
    loadVotes().catch(() => {});
  }

  const { username, password } = getCredentials();
  if (username && password) {
    showAdmin();
  } else {
    showLogin();
  }
})();
