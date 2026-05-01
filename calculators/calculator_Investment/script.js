    /**
     * 증권거래세 계산기 — script.js
     * caboojoy calculators
     *
     * 세율 기준 (매도 기준, 원천징수 또는 신고납부)
     * 근거: 증권거래세법 시행령 제5조(탄력세율) [시행 2026.1.2]
     * ──────────────────────────────────────────────────────────────────
     * 연도  │ KOSPI (STT+농특세)       │ KOSDAQ │ KONEX │ K-OTC │ 비상장장외
     * 2022  │ 0.05% + 0.15% = 0.20%   │ 0.20%  │ 0.10% │ 0.20% │ 0.35%
     * 2023  │ 0.05% + 0.15% = 0.20%   │ 0.20%  │ 0.10% │ 0.20% │ 0.35%
     * 2024  │ 0.03% + 0.15% = 0.18%   │ 0.18%  │ 0.10% │ 0.18% │ 0.35%
     * 2025  │ 0.00% + 0.15% = 0.15%   │ 0.15%  │ 0.10% │ 0.15% │ 0.35%
     * 2026+ │ 0.05% + 0.15% = 0.20%   │ 0.20%  │ 0.10% │ 0.20% │ 0.35%
     * ──────────────────────────────────────────────────────────────────
     * ※ K-OTC: 제5조 제3호 나목(금융투자협회 통해 양도) → KOSDAQ과 동일 세율
     * ※ 비상장 장외: 탄력세율 비적용, 기본세율 35/10000 = 0.35%
     * ※ 농어촌특별세: KOSPI에만 부과 (0.15%), 나머지 시장 면제
     * ※ 원단위 절사 (Math.floor) 적용
     */

    'use strict';

    // ─── 세율 테이블 ──────────────────────────────────────────
    // key: year (숫자)
    // value: { STT: 증권거래세율, AGRI: 농어촌특별세율 } (소수)
    const TAX_RATES = {
    // 유가증권시장(KOSPI): 증권거래세 + 농어촌특별세 0.15% 별도 부과
    KOSPI: {
        2022: { STT: 0.0005, AGRI: 0.0015 },  // 1만분의 5
        2023: { STT: 0.0005, AGRI: 0.0015 },  // 1만분의 5
        2024: { STT: 0.0003, AGRI: 0.0015 },  // 1만분의 3
        2025: { STT: 0.0000, AGRI: 0.0015 },  // 0 (단계적 인하)
        2026: { STT: 0.0005, AGRI: 0.0015 },  // 1만분의 5 (시행령 제5조제1호, 2026.1.2 시행)
    },
    // 코스닥시장(KOSDAQ): 증권거래세만 부과, 농특세 면제
    KOSDAQ: {
        2022: { STT: 0.0020, AGRI: 0 },  // 1만분의 20
        2023: { STT: 0.0020, AGRI: 0 },  // 1만분의 20
        2024: { STT: 0.0018, AGRI: 0 },  // 1만분의 18
        2025: { STT: 0.0015, AGRI: 0 },  // 1만분의 15 (단계적 인하)
        2026: { STT: 0.0020, AGRI: 0 },  // 1만분의 20 (시행령 제5조제3호가목, 2026.1.2 시행)
    },
    // 코넥스시장(KONEX): 1만분의 10 고정
    KONEX: {
        2022: { STT: 0.0010, AGRI: 0 },
        2023: { STT: 0.0010, AGRI: 0 },
        2024: { STT: 0.0010, AGRI: 0 },
        2025: { STT: 0.0010, AGRI: 0 },
        2026: { STT: 0.0010, AGRI: 0 },  // 1만분의 10 (시행령 제5조제2호)
    },
    // K-OTC(금융투자협회를 통하여 양도): 시행령 제5조제3호나목
    // → KOSDAQ(가목)과 동일 조항으로 묶여 동일 세율 적용
    KOTC: {
        2022: { STT: 0.0020, AGRI: 0 },  // 1만분의 20
        2023: { STT: 0.0020, AGRI: 0 },  // 1만분의 20
        2024: { STT: 0.0018, AGRI: 0 },  // 1만분의 18
        2025: { STT: 0.0015, AGRI: 0 },  // 1만분의 15
        2026: { STT: 0.0020, AGRI: 0 },  // 1만분의 20 (시행령 제5조제3호나목, 2026.1.2 시행)
    },
    // 비상장 장외거래: 법 기본세율 0.35% 적용 (탄력세율 미적용)
    OTC: {
        2022: { STT: 0.0035, AGRI: 0 },
        2023: { STT: 0.0035, AGRI: 0 },
        2024: { STT: 0.0035, AGRI: 0 },
        2025: { STT: 0.0035, AGRI: 0 },
        2026: { STT: 0.0035, AGRI: 0 },
    },
    };

    // 2026 이후: 2026 세율 그대로 적용
    function getRates(market, year) {
    const table = TAX_RATES[market] || TAX_RATES['OTC'];
    // 2022 미만은 2022 적용, 2026 초과는 2026 적용
    const y = Math.max(2022, Math.min(2026, year));
    return table[y] || table[2026];
    }

    // ─── 포맷 유틸 ────────────────────────────────────────────
    const fmt = (n) => n.toLocaleString('ko-KR');
    const fmtPct = (r) => (r * 100).toFixed(2) + '%';

    // 실수 파싱 (단가용)
    function parsePlainNum(str) {
    return parseFloat(str.replace(/,/g, '').trim());
    }

    // 정수 파싱 (수량용) — 소수점 입력 차단
    function parsePlainInt(str) {
    const n = parseFloat(str.replace(/,/g, '').trim());
    return Number.isFinite(n) ? Math.trunc(n) : NaN;
    }

    // ─── 계산 함수 ────────────────────────────────────────────
    /**
     * @returns {{ tradeAmt, stt, agri, total, net, sttRate, agriRate }}
     */
    function calculate(market, year, qty, price) {
    const tradeAmt = qty * price;
    const rates = getRates(market, year);
    const stt = Math.floor(tradeAmt * rates.STT);
    const agri = Math.floor(tradeAmt * rates.AGRI);
    const total = stt + agri;
    const net = tradeAmt - total;
    return { tradeAmt, stt, agri, total, net, sttRate: rates.STT, agriRate: rates.AGRI };
    }

    // ─── 상태 ────────────────────────────────────────────────
    let selectedMarket = 'KOSPI';
    let historyRows = [];    // { id, date, market, name, qty, price, tradeAmt, stt, agri, total, net }
    let nextId = 1;

    // ─── DOM 참조 ─────────────────────────────────────────────
    const tradeDateEl  = document.getElementById('tradeDate');
    const stockNameEl  = document.getElementById('stockName');
    const qtyEl        = document.getElementById('qty');
    const priceEl      = document.getElementById('price');

    const previewSTT   = document.getElementById('previewSTT');
    const previewAgri  = document.getElementById('previewAgri');
    const previewTotal = document.getElementById('previewTotal');

    const resultCard   = document.getElementById('resultCard');
    const rTradeAmt    = document.getElementById('rTradeAmt');
    const rSTT         = document.getElementById('rSTT');
    const rAgri        = document.getElementById('rAgri');
    const rTotal       = document.getElementById('rTotal');
    const rNet         = document.getElementById('rNet');
    const resultNote   = document.getElementById('resultNote');

    const historyCard  = document.getElementById('historyCard');
    const historyBody  = document.getElementById('historyBody');
    const historyFoot  = document.getElementById('historyFoot');

    const calcBtn      = document.getElementById('calcBtn');
    const addBtn       = document.getElementById('addBtn');
    const resetBtn     = document.getElementById('resetBtn');
    const csvBtn       = document.getElementById('csvBtn');
    const clearAllBtn  = document.getElementById('clearAllBtn');

    const rateToggle   = document.getElementById('rateToggle');
    const rateBody     = document.getElementById('rateBody');
    const toggleArrow  = document.getElementById('toggleArrow');

    // ─── 초기화 ──────────────────────────────────────────────
    function init() {
    // 오늘 날짜 기본값
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    tradeDateEl.value = `${y}-${m}-${d}`;

    updateRatePreview();
    setupEvents();
    setupNumberInputs();
    }

    // ─── 이벤트 등록 ──────────────────────────────────────────
    function setupEvents() {
    // 시장 탭
    document.getElementById('marketTabs').addEventListener('click', (e) => {
        const tab = e.target.closest('.market-tab');
        if (!tab) return;
        document.querySelectorAll('.market-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        selectedMarket = tab.dataset.market;
        updateRatePreview();
    });

    tradeDateEl.addEventListener('change', updateRatePreview);
    calcBtn.addEventListener('click', onCalc);
    addBtn.addEventListener('click', onAdd);
    resetBtn.addEventListener('click', onReset);
    csvBtn.addEventListener('click', exportCSV);
    clearAllBtn.addEventListener('click', onClearAll);

    rateToggle.addEventListener('click', () => {
        const open = rateBody.style.display !== 'none';
        rateBody.style.display = open ? 'none' : 'block';
        toggleArrow.classList.toggle('open', !open);
    });
    }

    // ─── 숫자 입력 포맷 ───────────────────────────────────────
    function setupNumberInputs() {
    [qtyEl, priceEl].forEach(el => {
        el.addEventListener('input', () => {
        const raw = el.value.replace(/[^0-9]/g, '');
        if (raw === '') { el.value = ''; return; }
        el.value = Number(raw).toLocaleString('ko-KR');
        });
        el.addEventListener('keydown', (e) => {
        // 방향키, 백스페이스, Delete, Tab 등 허용
        if (['ArrowLeft','ArrowRight','Backspace','Delete','Tab'].includes(e.key)) return;
        // 숫자만 허용
        if (!/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
        });
    });
    }

    // ─── 세율 미리보기 갱신 ──────────────────────────────────
    function updateRatePreview() {
    const year = getSelectedYear();
    const rates = getRates(selectedMarket, year);
    previewSTT.textContent   = fmtPct(rates.STT);
    previewAgri.textContent  = fmtPct(rates.AGRI);
    previewTotal.textContent = fmtPct(rates.STT + rates.AGRI);
    }

    function getSelectedYear() {
    if (!tradeDateEl.value) return new Date().getFullYear();
    return parseInt(tradeDateEl.value.split('-')[0], 10);
    }

    // ─── 입력 검증 ────────────────────────────────────────────
    function getInputs() {
    const date  = tradeDateEl.value;
    const name  = stockNameEl.value.trim() || '—';
    const qty   = parsePlainInt(qtyEl.value);   // 버그 1,5 수정: 정수 파싱
    const price = parsePlainNum(priceEl.value);

    if (!date) return { ok: false, msg: '거래일을 선택해 주세요.' };
    if (isNaN(qty)   || qty <= 0)   return { ok: false, msg: '매도 수량을 올바르게 입력해 주세요. (1주 이상 정수)' };
    if (!Number.isInteger(qty))     return { ok: false, msg: '매도 수량은 정수(주)만 입력 가능합니다.' };
    if (isNaN(price) || price <= 0) return { ok: false, msg: '매도 단가를 올바르게 입력해 주세요.' };

    return { ok: true, date, name, qty, price, year: parseInt(date.split('-')[0], 10) };
    }

    // ─── 계산하기 ─────────────────────────────────────────────
    function onCalc() {
    const inp = getInputs();
    if (!inp.ok) { alert(inp.msg); return; }

    const result = calculate(selectedMarket, inp.year, inp.qty, inp.price);
    showResult(result, inp.year);
    }

    function showResult(result, year) {
    const rates = getRates(selectedMarket, year);

    rTradeAmt.textContent = fmt(result.tradeAmt) + ' 원';
    rSTT.textContent      = fmt(result.stt)      + ' 원  (' + fmtPct(rates.STT)  + ')';
    rAgri.textContent     = fmt(result.agri)     + ' 원  (' + fmtPct(rates.AGRI) + ')';
    rTotal.textContent    = fmt(result.total)    + ' 원';
    rNet.textContent      = fmt(result.net)      + ' 원';

    const label = getMarketLabel(selectedMarket);
    resultNote.textContent =
        `${year}년 ${label} 기준 · 증권거래세 ${fmtPct(rates.STT)} + 농어촌특별세 ${fmtPct(rates.AGRI)} 적용`;

    resultCard.style.display = 'block';
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // ─── 내역에 추가 ──────────────────────────────────────────
    function onAdd() {
    const inp = getInputs();
    if (!inp.ok) { alert(inp.msg); return; }

    const result = calculate(selectedMarket, inp.year, inp.qty, inp.price);

    historyRows.push({
        id:       nextId++,
        date:     inp.date,
        market:   selectedMarket,
        name:     inp.name,
        qty:      inp.qty,
        price:    inp.price,
        tradeAmt: result.tradeAmt,
        stt:      result.stt,
        agri:     result.agri,
        total:    result.total,
        net:      result.net,
    });

    renderHistory();
    showResult(result, inp.year);

    // 피드백
    addBtn.textContent = '✓ 추가됨';
    addBtn.style.background = 'linear-gradient(135deg, #388e6c, #2d7a5e)';
    setTimeout(() => {
        addBtn.textContent = '➕ 내역에 추가';
        addBtn.style.background = '';
    }, 1200);
    }

    // ─── 내역 렌더링 ──────────────────────────────────────────
    function renderHistory() {
    if (historyRows.length === 0) {
        historyCard.style.display = 'none';
        return;
    }
    historyCard.style.display = 'block';

    // 바디
    historyBody.innerHTML = historyRows.map(row => `
        <tr data-id="${row.id}">
        <td>${row.date}</td>
        <td><span class="market-badge badge-${row.market}">${getMarketLabel(row.market)}</span></td>
        <td>${escHtml(row.name)}</td>
        <td>${fmt(row.qty)}</td>
        <td>${fmt(row.price)}</td>
        <td>${fmt(row.tradeAmt)}</td>
        <td class="td-tax">${fmt(row.stt)}</td>
        <td class="td-tax">${fmt(row.agri)}</td>
        <td class="td-tax"><strong>${fmt(row.total)}</strong></td>
        <td class="td-net">${fmt(row.net)}</td>
        <td><button class="delete-btn" data-id="${row.id}" title="삭제">✕</button></td>
        </tr>
    `).join('');

    // 합계 행
    const sum = historyRows.reduce((acc, r) => ({
        tradeAmt: acc.tradeAmt + r.tradeAmt,
        stt:      acc.stt      + r.stt,
        agri:     acc.agri     + r.agri,
        total:    acc.total    + r.total,
        net:      acc.net      + r.net,
    }), { tradeAmt: 0, stt: 0, agri: 0, total: 0, net: 0 });

    historyFoot.innerHTML = `
        <tr>
        <td colspan="5" style="text-align:right; font-weight:700;">합계 (${historyRows.length}건)</td>
        <td>${fmt(sum.tradeAmt)}</td>
        <td class="td-tax">${fmt(sum.stt)}</td>
        <td class="td-tax">${fmt(sum.agri)}</td>
        <td class="td-tax"><strong>${fmt(sum.total)}</strong></td>
        <td class="td-net">${fmt(sum.net)}</td>
        <td></td>
        </tr>
    `;

    // 삭제 버튼 이벤트
    historyBody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        historyRows = historyRows.filter(r => r.id !== id);
        renderHistory();
        });
    });
    }

    // ─── 전체 초기화 ──────────────────────────────────────────
    function onReset() {
    // 버그 4 수정: 날짜를 오늘로 리셋 (날짜 미초기화 시 이전 세율 유지 오류)
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    tradeDateEl.value = `${y}-${m}-${d}`;

    qtyEl.value = '';
    priceEl.value = '';
    stockNameEl.value = '';
    resultCard.style.display = 'none';
    updateRatePreview();
    }

    // ─── 전체 삭제 ────────────────────────────────────────────
    function onClearAll() {
    if (!confirm('거래 내역 전체를 삭제하시겠습니까?')) return;
    historyRows = [];
    renderHistory();
    }

    // ─── CSV 내보내기 ─────────────────────────────────────────
    function exportCSV() {
    if (historyRows.length === 0) return;

    const BOM = '\uFEFF';
    const header = ['거래일', '시장', '종목명', '수량(주)', '단가(원)', '거래대금(원)',
        '증권거래세(원)', '농어촌특별세(원)', '합계세액(원)', '실수취금액(원)'];

    const rows = historyRows.map(r => [
        r.date,
        getMarketLabel(r.market),
        r.name,
        r.qty,
        r.price,
        r.tradeAmt,
        r.stt,
        r.agri,
        r.total,
        r.net,
    ]);

    // 합계 행
    const sum = historyRows.reduce((acc, r) => ({
        tradeAmt: acc.tradeAmt + r.tradeAmt,
        stt:      acc.stt      + r.stt,
        agri:     acc.agri     + r.agri,
        total:    acc.total    + r.total,
        net:      acc.net      + r.net,
    }), { tradeAmt: 0, stt: 0, agri: 0, total: 0, net: 0 });

    rows.push([`합계(${historyRows.length}건)`, '', '', '', '', sum.tradeAmt, sum.stt, sum.agri, sum.total, sum.net]);

    const csv = BOM + [header, ...rows]
        .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `증권거래세_내역_${new Date().toISOString().slice(0, 10)}.csv`;
    // 버그 2,3 수정: body에 추가 후 클릭 (Safari/Firefox 호환), revokeObjectURL은 지연 호출
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 150);
    }

    // ─── 유틸 ────────────────────────────────────────────────
    function getMarketLabel(market) {
    const map = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', KONEX: 'KONEX', KOTC: 'K-OTC', OTC: '비상장장외' };
    return map[market] || market;
    }

    function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // ─── 실행 ────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);
    