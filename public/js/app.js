(function () {
  const STORAGE_VOTER_ID = 'gift.voterId';
  const STORAGE_NAME = 'gift.name';
  const STORAGE_DEPT = 'gift.dept';

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'v-' + Math.random().toString(36).slice(2) + Date.now();
  }

  function getVoterId() {
    let id = localStorage.getItem(STORAGE_VOTER_ID);
    if (!id) {
      id = uuid();
      localStorage.setItem(STORAGE_VOTER_ID, id);
    }
    return id;
  }

  const voterId = getVoterId();

  const els = {
    whoami: document.getElementById('whoami'),
    editIdentityBtn: document.getElementById('editIdentityBtn'),
    identityCard: document.getElementById('identityCard'),
    identityName: document.getElementById('identityName'),
    identityDept: document.getElementById('identityDept'),
    saveIdentityBtn: document.getElementById('saveIdentityBtn'),
    giftForm: document.getElementById('giftForm'),
    giftText: document.getElementById('giftText'),
    giftList: document.getElementById('giftList'),
    emptyState: document.getElementById('emptyState'),
    toast: document.getElementById('toast'),
  };

  function getIdentity() {
    return {
      name: localStorage.getItem(STORAGE_NAME) || '',
      dept: localStorage.getItem(STORAGE_DEPT) || '',
    };
  }

  function setIdentity(name, dept) {
    localStorage.setItem(STORAGE_NAME, name);
    localStorage.setItem(STORAGE_DEPT, dept);
    renderIdentity();
  }

  function renderIdentity() {
    const { name, dept } = getIdentity();
    if (name) {
      els.whoami.textContent = dept ? `${name} (${dept})` : name;
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
    const { name } = getIdentity();
    if (name) return true;
    els.identityCard.style.display = 'block';
    els.identityCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    els.identityName.focus();
    showToast('먼저 이름을 입력해 주세요.');
    return false;
  }

  els.editIdentityBtn.addEventListener('click', () => {
    const { name, dept } = getIdentity();
    els.identityName.value = name;
    els.identityDept.value = dept;
    els.identityCard.style.display = els.identityCard.style.display === 'block' ? 'none' : 'block';
  });

  els.saveIdentityBtn.addEventListener('click', () => {
    const name = els.identityName.value.trim();
    const dept = els.identityDept.value.trim();
    if (!name) {
      showToast('이름을 입력해 주세요.');
      els.identityName.focus();
      return;
    }
    setIdentity(name, dept);
    els.identityCard.style.display = 'none';
    showToast('저장되었습니다.');
  });

  async function fetchGifts() {
    const res = await fetch(`/api/gifts?voterId=${encodeURIComponent(voterId)}`);
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
      meta.textContent = `${gift.proposerName}${gift.department ? ' · ' + gift.department : ''} 제안`;

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
    const { name, dept } = getIdentity();
    const res = await fetch(`/api/gifts/${giftId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voterId, voterName: name, voterDepartment: dept }),
    });
    if (!res.ok) {
      showToast('투표 처리 중 오류가 발생했습니다.');
      return;
    }
    fetchGifts();
  }

  els.giftForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!requireIdentity()) return;
    const text = els.giftText.value.trim();
    if (!text) return;
    const { name, dept } = getIdentity();

    const res = await fetch('/api/gifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, proposerName: name, department: dept }),
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
  if (!getIdentity().name) {
    els.identityCard.style.display = 'block';
  }
  fetchGifts();
})();
