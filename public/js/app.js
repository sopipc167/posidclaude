(function () {
  const STORAGE_EMPLOYEE_ID = 'gift.employeeId';
  const STORAGE_NAME = 'gift.name';
  const STORAGE_TEAM = 'gift.team';

  const EMPLOYEE_ID_REGEX = /^[A-C]\d{4}(0[1-9]|1[0-2])\d{2}$/;

  const els = {
    whoami: document.getElementById('whoami'),
    editIdentityBtn: document.getElementById('editIdentityBtn'),
    identityCard: document.getElementById('identityCard'),
    identityEmployeeId: document.getElementById('identityEmployeeId'),
    identityName: document.getElementById('identityName'),
    identityTeam: document.getElementById('identityTeam'),
    identityError: document.getElementById('identityError'),
    saveIdentityBtn: document.getElementById('saveIdentityBtn'),
    giftForm: document.getElementById('giftForm'),
    giftText: document.getElementById('giftText'),
    giftList: document.getElementById('giftList'),
    emptyState: document.getElementById('emptyState'),
    toast: document.getElementById('toast'),
  };

  function getIdentity() {
    return {
      employeeId: localStorage.getItem(STORAGE_EMPLOYEE_ID) || '',
      name: localStorage.getItem(STORAGE_NAME) || '',
      team: localStorage.getItem(STORAGE_TEAM) || '',
    };
  }

  function setIdentity(employeeId, name, team) {
    localStorage.setItem(STORAGE_EMPLOYEE_ID, employeeId);
    localStorage.setItem(STORAGE_NAME, name);
    localStorage.setItem(STORAGE_TEAM, team);
    renderIdentity();
  }

  function hasIdentity() {
    const { employeeId, name, team } = getIdentity();
    return EMPLOYEE_ID_REGEX.test(employeeId) && !!name && !!team;
  }

  function renderIdentity() {
    const { employeeId, name, team } = getIdentity();
    if (hasIdentity()) {
      els.whoami.textContent = `${name} (${team}) · ${employeeId}`;
    } else {
      els.whoami.textContent = '아직 입력 전';
    }
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 2200);
  }

  function requireIdentity() {
    if (hasIdentity()) return true;
    els.identityCard.style.display = 'block';
    els.identityCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    els.identityEmployeeId.focus();
    showToast('먼저 사번/이름/팀 명을 입력해 주세요.');
    return false;
  }

  els.editIdentityBtn.addEventListener('click', () => {
    const { employeeId, name, team } = getIdentity();
    els.identityEmployeeId.value = employeeId;
    els.identityName.value = name;
    els.identityTeam.value = team;
    els.identityCard.style.display = els.identityCard.style.display === 'block' ? 'none' : 'block';
  });

  els.saveIdentityBtn.addEventListener('click', () => {
    const employeeId = els.identityEmployeeId.value.trim().toUpperCase();
    const name = els.identityName.value.trim();
    const team = els.identityTeam.value.trim();

    if (!EMPLOYEE_ID_REGEX.test(employeeId)) {
      els.identityError.classList.add('show');
      els.identityEmployeeId.focus();
      return;
    }
    els.identityError.classList.remove('show');

    if (!name) {
      showToast('이름을 입력해 주세요.');
      els.identityName.focus();
      return;
    }
    if (!team) {
      showToast('팀 명을 입력해 주세요.');
      els.identityTeam.focus();
      return;
    }

    setIdentity(employeeId, name, team);
    els.identityCard.style.display = 'none';
    showToast('저장되었습니다.');
    fetchGifts();
  });

  async function fetchGifts() {
    const { employeeId } = getIdentity();
    const res = await fetch(`/api/gifts?employeeId=${encodeURIComponent(employeeId)}`);
    const gifts = await res.json();
    renderGifts(gifts);
  }

  function renderGifts(gifts) {
    els.giftList.innerHTML = '';
    els.emptyState.style.display = gifts.length ? 'none' : 'block';
    const maxVotes = gifts.reduce((m, g) => Math.max(m, g.voteCount), 0) || 1;

    gifts.forEach((gift, idx) => {
      const li = document.createElement('li');
      li.className = 'gift-item';

      const rank = document.createElement('div');
      rank.className = 'gift-rank';
      rank.textContent = gift.voteCount > 0 ? String(idx + 1) : '·';

      const main = document.createElement('div');
      main.className = 'gift-main';

      const text = document.createElement('p');
      text.className = 'gift-text';
      text.textContent = gift.text;

      const meta = document.createElement('div');
      meta.className = 'gift-meta';
      meta.textContent = `${gift.proposerName}${gift.team ? ' · ' + gift.team : ''} 제안`;

      const track = document.createElement('div');
      track.className = 'gift-bar-track';
      const fill = document.createElement('div');
      fill.className = 'gift-bar-fill';
      fill.style.width = `${(gift.voteCount / maxVotes) * 100}%`;
      track.appendChild(fill);

      main.appendChild(text);
      main.appendChild(meta);
      main.appendChild(track);

      const voteBtn = document.createElement('button');
      voteBtn.className = 'vote-btn' + (gift.votedByMe ? ' voted' : '');
      voteBtn.innerHTML = `<span>${gift.votedByMe ? '✓ 추천됨' : '추천'}</span><span class="count">${gift.voteCount}</span>`;
      voteBtn.addEventListener('click', () => toggleVote(gift.id));

      li.appendChild(rank);
      li.appendChild(main);
      li.appendChild(voteBtn);
      els.giftList.appendChild(li);
    });
  }

  async function toggleVote(giftId) {
    if (!requireIdentity()) return;
    const { employeeId, name, team } = getIdentity();
    const res = await fetch(`/api/gifts/${giftId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, voterName: name, team }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || '투표 처리 중 오류가 발생했습니다.');
      return;
    }
    fetchGifts();
  }

  els.giftForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireIdentity()) return;
    const text = els.giftText.value.trim();
    if (!text) return;
    const { employeeId, name, team } = getIdentity();

    const res = await fetch('/api/gifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, employeeId, proposerName: name, team }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showToast(data.error || '등록 중 오류가 발생했습니다.');
      return;
    }
    els.giftText.value = '';
    showToast('제안이 등록되었습니다. 감사합니다!');
    fetchGifts();
  });

  renderIdentity();
  if (!hasIdentity()) {
    els.identityCard.style.display = 'block';
  }
  fetchGifts();
})();
