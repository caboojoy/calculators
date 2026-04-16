const STORAGE_KEY = 'dday_items_v2';

  let items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  let sortMode = localStorage.getItem('dday_sort') || 'near';

  function setSort(mode) {
    sortMode = mode;
    localStorage.setItem('dday_sort', mode);
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === mode);
    });
    render();
  }

  function getSorted() {
    const arr = [...items];
    switch (sortMode) {
      case 'near':
        return arr.sort((a, b) => {
          const da = Math.abs(calcDday(a.date));
          const db = Math.abs(calcDday(b.date));
          if (da === 0) return -1;
          if (db === 0) return 1;
          return da - db;
        });
      case 'added':
        return arr; // original insertion order
      case 'asc':
        return arr.sort((a, b) => a.date.localeCompare(b.date));
      case 'desc':
        return arr.sort((a, b) => b.date.localeCompare(a.date));
      case 'name':
        return arr.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
      default:
        return arr;
    }
  }

  const RECOMMENDATIONS = [
    { icon: '🎂', name: '내 생일', offsetFn: () => nextBirthday() },
    { icon: '🎄', name: '크리스마스', date: getNextAnnual(12, 25) },
    { icon: '🌸', name: '어버이날', date: getNextAnnual(5, 8) },
    { icon: '🎓', name: '수능', date: getNextSuneung() },
    { icon: '🌙', name: '추석', date: getChuseok() },
    { icon: '🎆', name: '새해 첫날', date: getNewYear() },
    { icon: '💘', name: '발렌타인데이', date: getNextAnnual(2, 14) },
    { icon: '🌹', name: '화이트데이', date: getNextAnnual(3, 14) },
    { icon: '👩‍💼', name: '근로자의 날', date: getNextAnnual(5, 1) },
    { icon: '🏖️', name: '여름 휴가', date: getNextAnnual(8, 1) },
  ];

  function getNextAnnual(month, day) {
    const now = new Date();
    const y = now.getFullYear();
    let d = new Date(y, month - 1, day);
    if (d < now) d = new Date(y + 1, month - 1, day);
    return toDateStr(d);
  }

  function getNewYear() {
    const now = new Date();
    return `${now.getFullYear() + 1}-01-01`;
  }

  function getNextSuneung() {
    // 수능 보통 11월 셋째주 목요일
    const now = new Date();
    const y = now.getFullYear();
    let d = getNthWeekday(y, 11, 4, 3);
    if (d < now) d = getNthWeekday(y + 1, 11, 4, 3);
    return toDateStr(d);
  }

  function getChuseok() {
    // 2024: Sep 17, 2025: Oct 6, 2026: Sep 25 (approximate)
    const now = new Date();
    const y = now.getFullYear();
    const dates = { 2024: '2024-09-17', 2025: '2025-10-06', 2026: '2026-09-25', 2027: '2027-10-14' };
    let d = new Date(dates[y] || `${y}-09-20`);
    if (d < now) {
      const ny = y + 1;
      d = new Date(dates[ny] || `${ny}-09-20`);
    }
    return toDateStr(d);
  }

  function getNthWeekday(year, month, weekday, n) {
    let d = new Date(year, month - 1, 1);
    let count = 0;
    while (true) {
      if (d.getDay() === weekday) count++;
      if (count === n) return d;
      d.setDate(d.getDate() + 1);
    }
  }

  function nextBirthday() {
    const stored = localStorage.getItem('my_birthday');
    if (stored) {
      const [, m, day] = stored.split('-');
      return getNextAnnual(parseInt(m), parseInt(day));
    }
    return null;
  }

  function toDateStr(d) {
    return d.toISOString().slice(0, 10);
  }

  function formatDisplay(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
  }

  function calcDday(dateStr) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(dateStr);
    const diff = Math.round((target - today) / 86400000);
    return diff;
  }

  function getDdayLabel(diff) {
    if (diff === 0) return { text: 'D-DAY', cls: 'today' };
    if (diff > 0) return { text: `D-${diff}`, cls: 'future' };
    return { text: `D+${Math.abs(diff)}`, cls: 'past' };
  }

  function getBreakdown(diff) {
    const abs = Math.abs(diff);
    const weeks = Math.floor(abs / 7);
    const months = Math.floor(abs / 30.44);
    const years = Math.floor(abs / 365.25);
    const parts = [];
    if (years > 0) parts.push(`${years}년`);
    else if (months > 0) parts.push(`약 ${months}개월`);
    if (weeks > 0) parts.push(`${weeks}주`);
    return parts.join(' · ');
  }

  function getCardAccent(diff) {
    if (diff === 0) return 'var(--accent3)';
    if (diff > 0) return 'var(--accent)';
    return 'var(--accent2)';
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function render() {
    const list = document.getElementById('ddayList');

    if (items.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <div class="empty-text">아직 추가된 디데이가 없어요.<br>날짜를 입력하거나 추천 디데이를 눌러보세요!</div>
        </div>`;
      return;
    }

    // Sort using current sortMode
    const sorted = getSorted();

    list.innerHTML = sorted.map((item, idx) => {
      const diff = calcDday(item.date);
      const { text, cls } = getDdayLabel(diff);
      const breakdown = diff !== 0 ? getBreakdown(diff) : '';
      const isToday = diff === 0;
      const accent = getCardAccent(diff);
      const origIdx = items.findIndex(i => i.id === item.id);

      return `
        <div class="dday-card ${isToday ? 'is-today' : ''}" style="--card-accent: ${accent}">
          <div class="card-left">
            <div class="card-name">
              ${item.name || '이름 없음'}
              ${isToday ? '<span class="today-tag">오늘!</span>' : ''}
            </div>
            <div class="card-date">${formatDisplay(item.date)}</div>
          </div>
          <div class="card-right">
            <div class="number-group">
              <div class="dday-number ${cls}">${text}</div>
              ${breakdown ? `<div class="breakdown"><span class="breakdown-item">${breakdown}</span></div>` : ''}
              <div class="dday-label ${cls}">${diff > 0 ? '남음' : diff < 0 ? '지남' : '디데이'}</div>
            </div>
            <button class="del-btn" onclick="deleteItem('${item.id}')" title="삭제">✕</button>
          </div>
        </div>`;
    }).join('');
  }

  function addDday(name, date) {
    const nameVal = name !== undefined ? name : document.getElementById('inputName').value.trim();
    const dateVal = date !== undefined ? date : document.getElementById('inputDate').value;

    if (!dateVal) { alert('날짜를 입력해주세요!'); return; }

    items.push({
      id: Date.now().toString(),
      name: nameVal,
      date: dateVal,
    });

    save();
    render();

    if (name === undefined) {
      document.getElementById('inputName').value = '';
      document.getElementById('inputDate').value = '';
    }
  }

  function deleteItem(id) {
    items = items.filter(i => i.id !== id);
    save();
    render();
  }

  function renderRec() {
    const chips = document.getElementById('recChips');
    chips.innerHTML = RECOMMENDATIONS.map(r => {
      const date = typeof r.date === 'function' ? r.date() : r.date;
      if (!date) return '';
      const diff = calcDday(date);
      const { text } = getDdayLabel(diff);
      return `<div class="chip" onclick="addDday('${r.name}', '${date}')">
        <span class="chip-icon">${r.icon}</span>
        ${r.name}
        <span style="color:var(--muted);font-size:11px">${text}</span>
      </div>`;
    }).join('');
  }

  function updateToday() {
    const now = new Date();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    document.getElementById('todayDisplay').textContent =
      `${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')} (${days[now.getDay()]})`;
  }

  // Enter key
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (document.activeElement.id === 'inputName' || document.activeElement.id === 'inputDate')) {
      addDday();
    }
  });

  // ── Tab switching ─────────────────────────
  function switchTab(name) {
    document.querySelectorAll('.tool-tab').forEach((btn, i) => {
      const ids = ['ndays','dminus','between','military'];
      btn.classList.toggle('active', ids[i] === name);
    });
    document.querySelectorAll('.tool-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
  }

  function addResult(date, label) {
    const name = label || formatDisplay(date);
    addDday(name, date);
  }

  // ── N일째 날 ─────────────────────────────
  function calcNdays() {
    const base = document.getElementById('nd-base').value;
    const n = parseInt(document.getElementById('nd-n').value);
    const el = document.getElementById('nd-result');
    if (!base || isNaN(n) || n < 1) { el.innerHTML = '<span class="empty-result">기준일과 일수를 입력하세요</span>'; return; }
    const d = new Date(base);
    d.setDate(d.getDate() + (n - 1));
    const resultStr = toDateStr(d);
    const dow = ['일','월','화','수','목','금','토'][d.getDay()];
    const ddiff = calcDday(resultStr);
    const { text: dtext } = getDdayLabel(ddiff);
    el.innerHTML = `
      <div>
        <div class="result-main">${formatDisplay(resultStr)} (${dow})</div>
        <div class="result-sub">${n}일째 되는 날 &nbsp;·&nbsp; ${dtext}</div>
      </div>
      <button class="result-add-btn" onclick="addResult('${resultStr}','${n}일째')">+ D-DAY 추가</button>`;
  }

  // ── D-N일 ─────────────────────────────────
  function calcDminus() {
    const base = document.getElementById('dm-base').value;
    const n = parseInt(document.getElementById('dm-n').value);
    const dir = document.getElementById('dm-dir').value;
    const el = document.getElementById('dm-result');
    if (!base || isNaN(n)) { el.innerHTML = '<span class="empty-result">기준일과 일수를 입력하세요</span>'; return; }
    const d = new Date(base);
    d.setDate(d.getDate() + (dir === 'after' ? n : -n));
    const resultStr = toDateStr(d);
    const dow = ['일','월','화','수','목','금','토'][d.getDay()];
    const ddiff = calcDday(resultStr);
    const { text: dtext } = getDdayLabel(ddiff);
    const label = dir === 'after' ? `${n}일 후` : `${n}일 전`;
    el.innerHTML = `
      <div>
        <div class="result-main">${formatDisplay(resultStr)} (${dow})</div>
        <div class="result-sub">${formatDisplay(base)} 기준 ${label} &nbsp;·&nbsp; ${dtext}</div>
      </div>
      <button class="result-add-btn" onclick="addResult('${resultStr}','${label}')">+ D-DAY 추가</button>`;
  }

  // ── 며칠째? ───────────────────────────────
  function calcBetween() {
    const start = document.getElementById('bw-start').value;
    const end = document.getElementById('bw-end').value;
    const el = document.getElementById('bw-result');
    if (!start || !end) { el.innerHTML = '<span class="empty-result">시작일과 목표일을 입력하세요</span>'; return; }
    const s = new Date(start), e = new Date(end);
    const diffDays = Math.round((e - s) / 86400000);
    const nthDay = diffDays + 1;
    const abs = Math.abs(diffDays);
    const weeks = Math.floor(abs / 7);
    const months = Math.floor(abs / 30.44);
    let breakdown = '';
    if (months > 0) breakdown += `약 ${months}개월 `;
    if (weeks > 0) breakdown += `(${weeks}주) `;
    const direction = diffDays >= 0 ? '이후' : '이전';
    const sign = diffDays >= 0 ? '+' : '';
    el.innerHTML = `
      <div>
        <div class="result-main">${diffDays >= 0 ? nthDay + '일째' : Math.abs(diffDays) + '일 전'}</div>
        <div class="result-sub">${formatDisplay(start)} → ${formatDisplay(end)} &nbsp;·&nbsp; ${sign}${diffDays}일 ${breakdown}</div>
      </div>`;
  }

  // ── 전역일 계산 ───────────────────────────
  function calcMilitary() {
    const enlist = document.getElementById('mil-enlist').value;
    const type = document.getElementById('mil-type').value;
    const el = document.getElementById('mil-result');
    if (!enlist) { el.innerHTML = ''; return; }

    const months = parseInt(type) || 21;
    const enlistDate = new Date(enlist);

    // 전역일 = 입대일 + 복무기간 - 1일 (입대일 당일 포함)
    const discharge = new Date(enlistDate);
    discharge.setMonth(discharge.getMonth() + months);
    discharge.setDate(discharge.getDate() - 1);

    const dischargeStr = toDateStr(discharge);
    const dow = ['일','월','화','수','목','금','토'][discharge.getDay()];
    const ddiff = calcDday(dischargeStr);
    const { text: dtext, cls } = getDdayLabel(ddiff);

    // 100일, 200일 등 기념일
    const milestones = [100, 200, 300];
    const msHTML = milestones.map(n => {
      const d = new Date(enlistDate);
      d.setDate(d.getDate() + n - 1);
      const ds = toDateStr(d);
      const ddow = ['일','월','화','수','목','금','토'][d.getDay()];
      const msdiff = calcDday(ds);
      const { text: mstext } = getDdayLabel(msdiff);
      return `<div class="mil-result-item">
        <div class="mil-result-label">${n}일째</div>
        <div class="mil-result-value">${formatDisplay(ds)}</div>
        <div class="mil-result-sub">${ddow}요일 · ${mstext}</div>
      </div>`;
    }).join('');

    el.innerHTML = `
      <div class="mil-result-grid">
        <div class="mil-result-item highlight" style="grid-column:1/-1">
          <div class="mil-result-label">🎖️ 전역일</div>
          <div class="mil-result-value">${formatDisplay(dischargeStr)} (${dow})</div>
          <div class="mil-result-sub">${dtext} · 복무기간 ${months}개월</div>
        </div>
        ${msHTML}
      </div>
      <div style="margin-top:12px;text-align:right">
        <button class="result-add-btn" onclick="addResult('${dischargeStr}','전역일')">+ 전역일 D-DAY 추가</button>
      </div>`;
  }

  updateToday();
  renderRec();
  // apply saved sort button state
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === sortMode);
  });
  render();