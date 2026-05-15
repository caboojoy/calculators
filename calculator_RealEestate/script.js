    // ============================================================
    // script.js — 부동산 계산기 메인 로직 (calculator_RS)
    // ============================================================

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. 메뉴 구성
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const MENU = {
        '거래비용': [
        { id: 'agentFee',     label: '중개보수' },
        { id: 'registration', label: '등기비용' },
        ],
        '대출': [
        { id: 'ltvDtiDsr',    label: 'LTV·DTI·DSR' },
        { id: 'loanInterest', label: '대출이자' },
        ],
        '세금': [
        { id: 'acquisitionTax',   label: '취득세' },
        { id: 'propertyTax',      label: '재산세' },
        { id: 'comprehensiveTax', label: '종합부동산세' },
        { id: 'capitalGainsTax',  label: '양도소득세' },
        ],
        '투자·임대': [
        { id: 'rentalYield',    label: '임대수익률' },
        { id: 'rentConversion', label: '전월세전환율' },
        ],
    };
    
    let currentCat  = '거래비용';
    let currentCalc = 'agentFee';
    
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. 네비게이션
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    function initNav() {
        const catNav = document.getElementById('catNav');
        Object.keys(MENU).forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn' + (cat === currentCat ? ' active' : '');
        btn.textContent = cat;
        btn.onclick = () => switchCategory(cat);
        catNav.appendChild(btn);
        });
        renderSubNav();
    }
    
    function switchCategory(cat) {
        currentCat = cat;
        document.querySelectorAll('.cat-btn').forEach(b =>
        b.classList.toggle('active', b.textContent === cat)
        );
        renderSubNav();
        // 첫 번째 항목으로 이동
        const first = MENU[cat][0];
        switchCalc(first.id);
    }
    
    function renderSubNav() {
        const subNav = document.getElementById('subNav');
        subNav.innerHTML = '';
        MENU[currentCat].forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'sub-btn' + (item.id === currentCalc ? ' active' : '');
        btn.textContent = item.label;
        btn.onclick = () => switchCalc(item.id);
        subNav.appendChild(btn);
        });
    }
    
    function switchCalc(calcId) {
        // 현재 카테고리에 없는 calcId면 카테고리도 변경
        let found = false;
        for (const [cat, items] of Object.entries(MENU)) {
        if (items.find(i => i.id === calcId)) {
            currentCat = cat;
            found = true;
            break;
        }
        }
        if (!found) return;
    
        currentCalc = calcId;
    
        // 카테고리 탭 갱신
        document.querySelectorAll('.cat-btn').forEach(b =>
        b.classList.toggle('active', b.textContent === currentCat)
        );
        renderSubNav();
    
        // 패널 전환
        document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
        const target = document.getElementById('panel-' + calcId);
        if (target) target.style.display = 'block';
    
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. 유틸리티
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    /** 숫자 → 콤마 형식 문자열 */
    function formatNum(n) {
        if (isNaN(n) || n === null) return '0';
        return Math.round(n).toLocaleString('ko-KR');
    }
    
    /** 콤마 포함 문자열 → 숫자 */
    function parseNum(str) {
        if (!str) return 0;
        return parseFloat(str.toString().replace(/,/g, '')) || 0;
    }
    
    /** 원화 표시 */
    function wonStr(n) {
        return formatNum(n) + '원';
    }
    
    /** 한글 단위 힌트 (억·만) */
    function koreanUnit(n) {
        if (!n || n <= 0) return '';
        const eok = Math.floor(n / 100_000_000);
        const man = Math.floor((n % 100_000_000) / 10_000);
        if (eok > 0 && man > 0) return `약 ${eok}억 ${formatNum(man)}만원`;
        if (eok > 0)             return `약 ${eok}억원`;
        if (man > 0)             return `약 ${formatNum(man)}만원`;
        return `${formatNum(n)}원`;
    }
    
    /** 숫자 인풋 포맷 + 힌트 연동 */
    function initNumberInputs() {
        document.querySelectorAll('.num-input').forEach(input => {
        input.addEventListener('input', () => {
            const raw = input.value.replace(/[^0-9]/g, '');
            const num = parseInt(raw, 10) || 0;
            input.value = num > 0 ? num.toLocaleString('ko-KR') : '';
    
            // 힌트 엘리먼트 (같은 form-group 내 .input-hint)
            const hint = input.closest('.form-group')?.querySelector('.input-hint');
            if (hint && !hint.classList.contains('small')) {
            hint.textContent = koreanUnit(num);
            }
        });
        });
    }
    
    /** 토글 버튼 그룹 클릭 이벤트 등록 */
    function initToggleGroup(groupId, onChange) {
        const group = document.getElementById(groupId);
        if (!group) return;
        group.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (onChange) onChange(btn.dataset.value);
        });
        });
    }
    
    /** 현재 활성 토글 값 반환 */
    function getToggleVal(groupId) {
        const active = document.querySelector(`#${groupId} .toggle-btn.active`);
        return active ? active.dataset.value : null;
    }
    
    /** 세법 기준일 배지 표시 */
    function setUpdatedBadge(elId, dateStr) {
        const el = document.getElementById(elId);
        if (el) el.textContent = `세법 기준 ${dateStr}`;
    }
    
    /** 내부 탭 전환 (LTV·DTI·DSR용) */
    function switchLoanTab(tab) {
        ['ltv', 'dti', 'dsr'].forEach(t => {
        document.getElementById(t + '-panel').style.display = t === tab ? 'block' : 'none';
        document.querySelector(`.inner-tab[data-tab="${t}"]`).classList.toggle('active', t === tab);
        });
    }
    
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4. 중개보수 계산기 (AgentFee)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    function initAgentFee() {
        setUpdatedBadge('agentFee-updated', TAX_DATA.agentFee.updated);
    
        // 거래유형 변경 시 월세 입력 표시/숨김 + 레이블 변경
        initToggleGroup('agentFee-transType', val => {
        const isRent = val === 'rent';
        document.getElementById('agentFee-monthlyGroup').style.display = isRent ? '' : 'none';
        document.getElementById('agentFee-priceLabel').textContent =
            isRent ? '보증금 (전세금)' : '거래금액 (매매가)';
        });
    
        initToggleGroup('agentFee-propType');
    }
    
    function calcAgentFee() {
        const transType = getToggleVal('agentFee-transType');  // buy | rent
        const propType  = getToggleVal('agentFee-propType');   // residential | officetel | commercial
    
        const priceRaw   = parseNum(document.getElementById('agentFee-price').value);
        const monthlyRaw = parseNum(document.getElementById('agentFee-monthly').value);
    
        if (!priceRaw) {
        alert('거래금액(보증금)을 입력해 주세요.');
        return;
        }
    
        // 환산 거래금액 계산
        let tradingPrice = priceRaw;
        let convertedNote = '';
        if (transType === 'rent' && monthlyRaw > 0) {
        tradingPrice = priceRaw + (monthlyRaw * 100);
        convertedNote = `보증금 ${wonStr(priceRaw)} + (월세 ${wonStr(monthlyRaw)} × 100)`;
        }
    
        let fee, rate, maxFeeApplied = false, note = '';
    
        if (propType === 'commercial') {
        // 상가·토지: 최대 0.9%, 협의
        rate = TAX_DATA.agentFee.commercial.maxRate;
        fee  = tradingPrice * rate;
        note = '⚠️ 상가·토지는 0.9% 이내에서 중개의뢰인과 개업공인중개사가 협의합니다. 표시 금액은 법정 최고 기준입니다.';
    
        } else if (propType === 'officetel') {
        const data = TAX_DATA.agentFee.officetel[transType === 'buy' ? 'buy' : 'rent'];
        rate = data.rate;
        fee  = tradingPrice * rate;
        note = '오피스텔(업무용 목적) 기준 단일 요율이 적용됩니다.';
    
        } else {
        // 주거용
        const brackets = TAX_DATA.agentFee.residential[transType === 'buy' ? 'buy' : 'rent'];
        const bracket  = brackets.find(b => tradingPrice <= b.max);
        rate = bracket.rate;
        let rawFee = tradingPrice * rate;
    
        if (bracket.maxFee !== null && rawFee > bracket.maxFee) {
            rawFee = bracket.maxFee;
            maxFeeApplied = true;
        }
        fee = rawFee;
        }
    
        // 결과 표시
        const resultEl = document.getElementById('agentFee-result');
        resultEl.style.display = '';
    
        document.getElementById('agentFee-converted').textContent =
        tradingPrice !== priceRaw ? wonStr(tradingPrice) : '-';
        document.getElementById('agentFee-rate').textContent =
        (rate * 100).toFixed(1) + '%' + (maxFeeApplied ? ' (한도 적용)' : '');
        document.getElementById('agentFee-fee').textContent    = wonStr(Math.floor(fee));
        document.getElementById('agentFee-feeVat').textContent = wonStr(Math.floor(fee * 1.1));
        document.getElementById('agentFee-note').textContent   =
        (convertedNote ? `환산: ${convertedNote}\n` : '') + note;
    }
    
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5. 전월세 전환율 계산기 (RentConversion)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    function initRentConversion() {
        setUpdatedBadge('rentConv-updated', TAX_DATA.rentConversion.updated);
    
        // 법정 상한율 배너
        const d = TAX_DATA.rentConversion;
        const legalRate = (d.bankRate + d.legalPremium) * 100;
        const banner = document.getElementById('rentConv-legalBanner');
        banner.innerHTML =
        `📌 현재 법정 상한 전환율: <strong>${legalRate.toFixed(2)}%</strong>&nbsp;`+
        `(한국은행 기준금리 ${(d.bankRate*100).toFixed(2)}% + 가산 2%)`;
    
        // 모드 전환
        initToggleGroup('rentConv-mode', val => {
        ['jeonToWol','wolToJeon','calcRate'].forEach(m => {
            document.getElementById('rentConv-' + m).style.display = m === val ? '' : 'none';
        });
        document.getElementById('rentConv-result').style.display = 'none';
        });
    }
    
    function calcRentConversion() {
        const mode = getToggleVal('rentConv-mode');
        const d    = TAX_DATA.rentConversion;
        const legalRate = d.bankRate + d.legalPremium;  // 소수점 (예: 0.0525)
    
        let resLabel = '', resVal = '', appliedRate = legalRate, note = '';
    
        if (mode === 'jeonToWol') {
        const jeon       = parseNum(document.getElementById('rc-jeon-deposit').value);
        const newDeposit = parseNum(document.getElementById('rc-jeon-newDeposit').value);
        const rateInput  = parseFloat(document.getElementById('rc-jeon-rate').value);
    
        if (!jeon) { alert('현재 전세 보증금을 입력해 주세요.'); return; }
        if (newDeposit >= jeon) { alert('새 보증금은 전세금보다 작아야 합니다.'); return; }
    
        const diff = jeon - newDeposit;
        if (!isNaN(rateInput) && rateInput > 0) appliedRate = rateInput / 100;
    
        const monthly = Math.round(diff * appliedRate / 12);
        resLabel = '전환 월세';
        resVal   = wonStr(monthly) + '/월';
        note = `전환 기준 보증금 차액: ${wonStr(diff)}\n법정 상한율 ${(legalRate*100).toFixed(2)}% 기준 월세: ${wonStr(Math.round(diff*legalRate/12))}/월`;
    
        } else if (mode === 'wolToJeon') {
        const deposit = parseNum(document.getElementById('rc-wol-deposit').value);
        const monthly = parseNum(document.getElementById('rc-wol-monthly').value);
        const rateInput = parseFloat(document.getElementById('rc-wol-rate').value);
    
        if (!monthly) { alert('월세를 입력해 주세요.'); return; }
    
        if (!isNaN(rateInput) && rateInput > 0) appliedRate = rateInput / 100;
    
        const convertedDeposit = Math.round((monthly * 12) / appliedRate);
        const totalJeon = deposit + convertedDeposit;
        resLabel = '전환 전세 환산 보증금';
        resVal   = wonStr(totalJeon);
        note = `월세 ${wonStr(monthly)}/월 → 추가 환산 보증금: ${wonStr(convertedDeposit)}\n(현재 보증금 ${wonStr(deposit)} 포함 합계)`;
    
        } else {  // calcRate
        const jeon    = parseNum(document.getElementById('rc-calc-jeon').value);
        const deposit = parseNum(document.getElementById('rc-calc-deposit').value);
        const monthly = parseNum(document.getElementById('rc-calc-monthly').value);
    
        if (!jeon || !monthly) { alert('전세금(기준 보증금)과 월세를 입력해 주세요.'); return; }
    
        const diff = jeon - deposit;
        if (diff <= 0) { alert('기준 보증금이 전환 후 보증금보다 커야 합니다.'); return; }
    
        const calcRate = (monthly * 12) / diff * 100;
        appliedRate = calcRate / 100;
        resLabel = '계산된 전환율';
        resVal   = calcRate.toFixed(2) + '%';
    
        const legal = legalRate * 100;
        const over  = calcRate > legal;
        note = over
            ? `⚠️ 법정 상한율(${legal.toFixed(2)}%)을 ${(calcRate - legal).toFixed(2)}%p 초과합니다.`
            : `✅ 법정 상한율(${legal.toFixed(2)}%) 이내입니다.`;
        }
    
        const resultEl = document.getElementById('rentConv-result');
        resultEl.style.display = '';
        document.getElementById('rentConv-resLabel').textContent  = resLabel;
        document.getElementById('rentConv-resVal').textContent    = resVal;
        document.getElementById('rentConv-legal').textContent    = (legalRate * 100).toFixed(2) + '%';
        document.getElementById('rentConv-applied').textContent  = (appliedRate * 100).toFixed(2) + '%';
        document.getElementById('rentConv-note').textContent     = note;
    }
    
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 6. LTV · DTI · DSR 계산기
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    function initLoanRatio() {
        setUpdatedBadge('loanRatio-updated', TAX_DATA.loanRegulation.updated);
        initToggleGroup('ltv-region');
        initToggleGroup('ltv-houseCount');
        initToggleGroup('dti-region');
        initToggleGroup('dsr-institution');
    }
    
    // ── LTV ──────────────────────────────────────────────────────
    function calcLTV() {
        const region     = getToggleVal('ltv-region');      // regulated | normal
        const houseCount = getToggleVal('ltv-houseCount');  // noHouse | oneHouse | multiHouse
        const propValue  = parseNum(document.getElementById('ltv-value').value);
        const prior      = parseNum(document.getElementById('ltv-prior').value);
        const desired    = parseNum(document.getElementById('ltv-desired').value);
    
        if (!propValue) { alert('부동산 감정가를 입력해 주세요.'); return; }
    
        const ltvData   = TAX_DATA.loanRegulation.ltv;
        const limitRate = ltvData[region][houseCount];  // 0.5, 0.6, 0.7 등
    
        const maxLoan    = Math.max(0, Math.floor(propValue * limitRate - prior));
        const desiredLTV = desired > 0 ? ((desired + prior) / propValue * 100) : null;
    
        const resultEl = document.getElementById('ltv-result');
        resultEl.style.display = '';
    
        document.getElementById('ltv-limitRate').textContent  = (limitRate * 100) + '%';
        document.getElementById('ltv-maxLoan').textContent    = wonStr(maxLoan);
        document.getElementById('ltv-desiredVal').textContent = desired > 0 ? wonStr(desired) : '-';
        document.getElementById('ltv-desiredRate').textContent =
        desiredLTV !== null ? desiredLTV.toFixed(1) + '%' : '-';
    
        const statusEl = document.getElementById('ltv-status');
        if (desired > 0) {
        const ok = desired <= maxLoan;
        statusEl.className = 'status-badge ' + (ok ? 'ok' : 'over');
        statusEl.textContent = ok
            ? `✅ 대출 가능 (LTV ${desiredLTV.toFixed(1)}% ≤ 한도 ${limitRate*100}%)`
            : `❌ 한도 초과 (LTV ${desiredLTV.toFixed(1)}% > 한도 ${limitRate*100}%)`;
        } else {
        statusEl.className = '';
        statusEl.textContent = '';
        }
    }
    
    // ── DTI ──────────────────────────────────────────────────────
    function calcDTI() {
        const region     = getToggleVal('dti-region');  // regulated | normal
        const income     = parseNum(document.getElementById('dti-income').value);
        const principal  = parseNum(document.getElementById('dti-principal').value);
        const otherInt   = parseNum(document.getElementById('dti-otherInterest').value);
    
        if (!income) { alert('연간 소득을 입력해 주세요.'); return; }
    
        const limitRate   = TAX_DATA.loanRegulation.dti[region];
        const totalPayment = principal + otherInt;
        const dtiRatio    = (totalPayment / income) * 100;
    
        const resultEl = document.getElementById('dti-result');
        resultEl.style.display = '';
    
        document.getElementById('dti-limit').textContent        = (limitRate * 100) + '%';
        document.getElementById('dti-ratio').textContent        = dtiRatio.toFixed(1) + '%';
        document.getElementById('dti-incomeVal').textContent    = wonStr(income);
        document.getElementById('dti-totalPayment').textContent = wonStr(totalPayment);
    
        const statusEl = document.getElementById('dti-status');
        const pct      = dtiRatio / (limitRate * 100) * 100;
        if (pct <= 80) {
        statusEl.className = 'status-badge ok';
        statusEl.textContent = `✅ 여유 (DTI ${dtiRatio.toFixed(1)}% — 한도의 ${pct.toFixed(0)}% 사용)`;
        } else if (pct <= 100) {
        statusEl.className = 'status-badge warn';
        statusEl.textContent = `⚠️ 주의 (DTI ${dtiRatio.toFixed(1)}% — 한도의 ${pct.toFixed(0)}% 사용)`;
        } else {
        statusEl.className = 'status-badge over';
        statusEl.textContent = `❌ 한도 초과 (DTI ${dtiRatio.toFixed(1)}% > 한도 ${limitRate*100}%)`;
        }
    }
    
    // ── DSR ──────────────────────────────────────────────────────
    function calcDSR() {
        const institution  = getToggleVal('dsr-institution');  // bank | nonBank
        const income       = parseNum(document.getElementById('dsr-income').value);
        const totalPayment = parseNum(document.getElementById('dsr-totalPayment').value);
    
        if (!income) { alert('연간 소득을 입력해 주세요.'); return; }
    
        const limitRate  = TAX_DATA.loanRegulation.dsr[institution];
        const dsrRatio   = (totalPayment / income) * 100;
        const maxPayment = Math.floor(income * limitRate);
    
        const resultEl = document.getElementById('dsr-result');
        resultEl.style.display = '';
    
        document.getElementById('dsr-limit').textContent      = (limitRate * 100) + '%';
        document.getElementById('dsr-ratio').textContent      = dsrRatio.toFixed(1) + '%';
        document.getElementById('dsr-incomeVal').textContent  = wonStr(income);
        document.getElementById('dsr-maxPayment').textContent = wonStr(maxPayment);
    
        const statusEl = document.getElementById('dsr-status');
        const pct      = dsrRatio / (limitRate * 100) * 100;
        if (pct <= 80) {
        statusEl.className = 'status-badge ok';
        statusEl.textContent = `✅ 여유 (DSR ${dsrRatio.toFixed(1)}% — 한도의 ${pct.toFixed(0)}% 사용)`;
        } else if (pct <= 100) {
        statusEl.className = 'status-badge warn';
        statusEl.textContent = `⚠️ 주의 (DSR ${dsrRatio.toFixed(1)}% — 한도의 ${pct.toFixed(0)}% 사용)`;
        } else {
        statusEl.className = 'status-badge over';
        statusEl.textContent = `❌ 한도 초과 (DSR ${dsrRatio.toFixed(1)}% > 한도 ${limitRate*100}%)`;
        }
    }
    
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 7. 임대수익률 계산기 (RentalYield)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    function initRentalYield() {
        initToggleGroup('ry-type', val => {
        const isMonthly = val === 'monthly';
        document.getElementById('ry-monthlyGroup').style.display = isMonthly ? '' : 'none';
        document.getElementById('ry-result').style.display = 'none';
        });
    }
    
    function calcRentalYield() {
        const type       = getToggleVal('ry-type');
        const price      = parseNum(document.getElementById('ry-price').value);
        const deposit    = parseNum(document.getElementById('ry-deposit').value);
        const monthly    = parseNum(document.getElementById('ry-monthly').value);
        const annualCost = parseNum(document.getElementById('ry-cost').value);
        const loan       = parseNum(document.getElementById('ry-loan').value);
        const loanRate   = parseFloat(document.getElementById('ry-loanRate').value) / 100 || 0;
    
        if (!price) { alert('매입 가격을 입력해 주세요.'); return; }
    
        // 연간 임대 수입
        const annualIncome = type === 'monthly' ? monthly * 12 : 0;
    
        // 순수입 (비용 제외)
        const annualInterest  = loan * loanRate;
        const netIncome       = annualIncome - annualCost;
    
        // 실투자금 = 매입가 - 보증금 - 대출
        const selfCapital = Math.max(0, price - deposit - loan);
    
        // 총 수익률 = 순임대수입 / (매입가 - 보증금) × 100
        const investBase  = Math.max(1, price - deposit);
        const totalYield  = (netIncome / investBase) * 100;
    
        // 자기자본 수익률 (ROE) = (순임대수입 - 연이자) / 자기자본 × 100
        const roeIncome = netIncome - annualInterest;
        const roe       = selfCapital > 0 ? (roeIncome / selfCapital) * 100 : null;
    
        const resultEl = document.getElementById('ry-result');
        resultEl.style.display = '';
    
        document.getElementById('ry-annualIncome').textContent  = wonStr(annualIncome);
        document.getElementById('ry-netIncome').textContent     = wonStr(netIncome);
        document.getElementById('ry-totalYield').textContent    = totalYield.toFixed(2) + '%';
        document.getElementById('ry-selfCapital').textContent   = wonStr(selfCapital);
    
        const roeRow = document.getElementById('ry-roeRow');
        if (loan > 0 && selfCapital > 0 && roe !== null) {
        roeRow.style.display = '';
        document.getElementById('ry-roe').textContent = roe.toFixed(2) + '%';
        } else {
        roeRow.style.display = 'none';
        }
    
        const interestRow = document.getElementById('ry-annualInterestRow');
        if (loan > 0 && loanRate > 0) {
        interestRow.style.display = '';
        document.getElementById('ry-annualInterest').textContent = wonStr(Math.round(annualInterest));
        } else {
        interestRow.style.display = 'none';
        }
    }
    
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 8. 등기비용 계산기 (Registration)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    /** 법무사 보수 계산 (대법원 법무사보수표 기준, 소유권이전) */
    function calcNotaryFee(price) {
        const P = price;
        let fee;
        if      (P <   10_000_000)  fee = 50_000;                                         // 1천만 미만: 최소 5만원
        else if (P <   20_000_000)  fee = 40_000  + (P -  10_000_000) * 0.003;            // ~2천만
        else if (P <   50_000_000)  fee = 70_000  + (P -  20_000_000) * 0.002;            // ~5천만
        else if (P <  100_000_000)  fee = 130_000 + (P -  50_000_000) * 0.0015;           // ~1억
        else if (P <  300_000_000)  fee = 205_000 + (P - 100_000_000) * 0.001;            // ~3억
        else if (P <  500_000_000)  fee = 405_000 + (P - 300_000_000) * 0.0007;           // ~5억
        else if (P < 1_000_000_000) fee = 545_000 + (P - 500_000_000) * 0.0005;           // ~10억
        else fee = Math.min(795_000 + (P - 1_000_000_000) * 0.0002, 1_500_000);           // 10억 초과 (최대 150만)
        return Math.max(Math.floor(fee), 50_000);   // 최소 보수 5만원 보장
    }
    
    /** 인지세 계산 */
    function calcStampDuty(price) {
        const table = TAX_DATA.registrationFee.stampDuty;
        return (table.find(b => price <= b.max) || table[table.length - 1]).amount;
    }
    
    function initRegistration() {
        setUpdatedBadge('reg-updated', TAX_DATA.registrationFee.updated);
        initToggleGroup('reg-type', val => {
        document.getElementById('reg-priceLabel').textContent =
            val === 'buy' ? '매매가' : '전세금';
        document.getElementById('reg-result').style.display = 'none';
        });
    }
    
    function calcRegistration() {
        const type  = getToggleVal('reg-type');
        const price = parseNum(document.getElementById('reg-price').value);
        const loan  = parseNum(document.getElementById('reg-loan').value);
    
        if (!price) { alert('금액을 입력해 주세요.'); return; }
    
        const stamp       = calcStampDuty(price);
        const notary      = calcNotaryFee(price);
        const appFee      = 15_000;
    
        let mortgageTax   = 0, mortgageNotary = 0;
        if (loan > 0) {
        const maxCredit  = Math.ceil(loan * 1.2);          // 채권최고액 = 대출금 × 120%
        const d          = TAX_DATA.registrationFee.mortgage;
        mortgageTax      = Math.floor(maxCredit * d.rate);
        mortgageNotary   = calcNotaryFee(maxCredit);
        document.getElementById('reg-maxCredit').textContent = `(채권최고액 ${koreanUnit(maxCredit)})`;
        document.getElementById('reg-mortgageRow').style.display       = '';
        document.getElementById('reg-mortgageNotaryRow').style.display = '';
        document.getElementById('reg-mortgage').textContent      = wonStr(mortgageTax);
        document.getElementById('reg-mortgageNotary').textContent = wonStr(mortgageNotary);
        } else {
        document.getElementById('reg-mortgageRow').style.display       = 'none';
        document.getElementById('reg-mortgageNotaryRow').style.display = 'none';
        }
    
        const total = stamp + notary + appFee + mortgageTax + mortgageNotary;
    
        const resultEl = document.getElementById('reg-result');
        resultEl.style.display = '';
        document.getElementById('reg-stamp').textContent  = wonStr(stamp);
        document.getElementById('reg-notary').textContent = wonStr(notary);
        document.getElementById('reg-total').textContent  = wonStr(total);
    }
    
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 9. 대출이자 계산기 (LoanInterest)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    function initLoanInterest() {
        initToggleGroup('li-method', () => {
        document.getElementById('li-result').style.display = 'none';
        });
    }
    
    function calcLoanInterest() {
        const amount  = parseNum(document.getElementById('li-amount').value);
        const annRate = parseFloat(document.getElementById('li-rate').value);
        const years   = parseInt(document.getElementById('li-period').value) || 0;
        const method  = getToggleVal('li-method');  // annuity | principal | bullet
    
        if (!amount || !annRate || !years) {
        alert('대출금액, 이자율, 기간을 모두 입력해 주세요.'); return;
        }
    
        const r = annRate / 100 / 12;  // 월 이자율
        const n = years * 12;          // 총 납입 개월
    
        let monthlyFirst = 0, totalInterest = 0, tableRows = [];
    
        if (method === 'annuity') {
        // 원리금균등
        monthlyFirst = amount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
        let balance = amount;
        for (let i = 1; i <= Math.min(n, 12); i++) {
            const interest  = balance * r;
            const principal = monthlyFirst - interest;
            balance -= principal;
            tableRows.push({ month: i, payment: monthlyFirst, principal, interest, balance: Math.max(0, balance) });
        }
        totalInterest = monthlyFirst * n - amount;
        document.getElementById('li-methodNote').textContent = '(매월 동일)';
    
        } else if (method === 'principal') {
        // 원금균등
        const principalPerMonth = amount / n;
        let balance = amount;
        for (let i = 1; i <= Math.min(n, 12); i++) {
            const interest  = balance * r;
            const payment   = principalPerMonth + interest;
            balance -= principalPerMonth;
            if (i === 1) monthlyFirst = payment;
            tableRows.push({ month: i, payment, principal: principalPerMonth, interest, balance: Math.max(0, balance) });
            totalInterest += interest;
        }
        // 전체 총이자 계산
        totalInterest = 0;
        let bal2 = amount;
        for (let i = 1; i <= n; i++) {
            totalInterest += bal2 * r;
            bal2 -= principalPerMonth;
        }
        document.getElementById('li-methodNote').textContent = '(첫 달 기준, 이후 감소)';
    
        } else {
        // 만기일시
        monthlyFirst = amount * r;
        totalInterest = amount * r * n;
        for (let i = 1; i <= 12; i++) {
            const isLast = i === n;
            const payment = isLast ? amount + amount * r : amount * r;
            tableRows.push({ month: i, payment, principal: isLast ? amount : 0, interest: amount * r, balance: isLast ? 0 : amount });
        }
        document.getElementById('li-methodNote').textContent = '(이자만, 만기 시 원금 상환)';
        }
    
        const totalPayment = amount + totalInterest;
    
        document.getElementById('li-result').style.display = '';
        document.getElementById('li-monthly').textContent       = wonStr(Math.round(monthlyFirst));
        document.getElementById('li-totalInterest').textContent = wonStr(Math.round(totalInterest));
        document.getElementById('li-totalPayment').textContent  = wonStr(Math.round(totalPayment));
    
        // 테이블 렌더링
        const table = document.getElementById('li-table');
        table.innerHTML = `
        <thead><tr>
            <th>월</th><th>납입금</th><th>원금</th><th>이자</th><th>잔액</th>
        </tr></thead>
        <tbody>${tableRows.map(r => `
            <tr>
            <td>${r.month}</td>
            <td>${formatNum(Math.round(r.payment))}</td>
            <td>${formatNum(Math.round(r.principal))}</td>
            <td>${formatNum(Math.round(r.interest))}</td>
            <td>${formatNum(Math.round(r.balance))}</td>
            </tr>`).join('')}
        </tbody>`;
    }
    
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 10. 취득세 계산기 (AcquisitionTax)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    function initAcquisitionTax() {
        setUpdatedBadge('acq-updated', TAX_DATA.acquisitionTax.updated);
        initToggleGroup('acq-propType', val => {
        const isRes = val === 'residential';
        document.getElementById('acq-residentialOptions').style.display = isRes ? '' : 'none';
        document.getElementById('acq-result').style.display = 'none';
        });
        initToggleGroup('acq-houseCount', val => {
        // 2주택 이상만 지역 구분 의미 있음
        document.getElementById('acq-regionGroup').style.display = val === 'one' ? 'none' : '';
        document.getElementById('acq-result').style.display = 'none';
        });
        initToggleGroup('acq-region');
        initToggleGroup('acq-area');
        // 초기 1주택엔 지역 구분 불필요
        document.getElementById('acq-regionGroup').style.display = 'none';
    }
    
    function calcAcquisitionTax() {
        const propType   = getToggleVal('acq-propType');
        const price      = parseNum(document.getElementById('acq-price').value);
        if (!price) { alert('취득가액을 입력해 주세요.'); return; }
    
        let rate = 0, note = '';
        const d = TAX_DATA.acquisitionTax;
    
        if (propType === 'nonResidential') {
        rate = d.nonResidential.land;  // 4%
        note = '토지·상가 등 비주거용 단일 세율 4%';
        } else {
        const houseCount = getToggleVal('acq-houseCount');  // one | two | three
        const region     = getToggleVal('acq-region');      // normal | regulated
    
        if (houseCount === 'one') {
            const bracket = d.residential.oneHouse.find(b => price <= b.max);
            rate = bracket.rate;
            note = '1주택 취득 (1% ~ 3% 구간세율)';
        } else if (houseCount === 'two') {
            if (region === 'regulated') {
            rate = d.residential.twoHouse.regulated;  // 8%
            note = '⚠️ 조정대상지역 2주택: 8% 중과';
            } else {
            const bracket = d.residential.twoHouse.normalBrackets.find(b => price <= b.max);
            rate = bracket.rate;
            note = '비조정지역 2주택: 일반세율 적용';
            }
        } else {  // three
            if (region === 'regulated') {
            rate = d.residential.threeHousePlus.regulated;  // 12%
            note = '⚠️ 조정대상지역 3주택 이상: 12% 중과';
            } else {
            rate = d.residential.threeHousePlus.normal;  // 8%
            note = '비조정지역 3주택 이상: 8%';
            }
        }
        }
    
        const acquisitionTax = Math.floor(price * rate);
        const eduTax         = Math.floor(acquisitionTax * d.surcharge.localEduRate);  // 취득세의 20%
    
        // 농어촌특별세: 주택은 85㎡ 초과 시, 비주거용은 항상
        const area       = getToggleVal('acq-area');
        const isRural    = propType === 'nonResidential' || area === 'over85';
        const ruralTax   = isRural ? Math.floor(acquisitionTax * d.surcharge.ruralSpecial) : 0;  // 취득세의 10%
    
        const total = acquisitionTax + eduTax + ruralTax;
    
        const resultEl = document.getElementById('acq-result');
        resultEl.style.display = '';
        document.getElementById('acq-rate').textContent    = (rate * 100).toFixed(0) + '%';
        document.getElementById('acq-tax').textContent     = wonStr(acquisitionTax);
        document.getElementById('acq-eduTax').textContent  = wonStr(eduTax);
        document.getElementById('acq-total').textContent   = wonStr(total);
        document.getElementById('acq-note').textContent    = note;
    
        const ruralRow = document.getElementById('acq-ruralRow');
        if (isRural) {
        ruralRow.style.display = '';
        document.getElementById('acq-ruralTax').textContent = wonStr(ruralTax);
        } else {
        ruralRow.style.display = 'none';
        }
    }
    
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 11. 재산세 계산기 (PropertyTax)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    function initPropertyTax() {
        setUpdatedBadge('pt-updated', TAX_DATA.propertyTax.updated);
        initToggleGroup('pt-type');
        initToggleGroup('pt-urban');
    }
    
    function calcPropertyTax() {
        const type  = getToggleVal('pt-type');   // residential | land-aggregate | land-separate
        const price = parseNum(document.getElementById('pt-price').value);
        const urban = getToggleVal('pt-urban') === 'yes';
        if (!price) { alert('공시가격을 입력해 주세요.'); return; }
    
        const d = TAX_DATA.propertyTax;
        let taxBase, brackets, ratio;
    
        if (type === 'residential') {
        ratio    = d.residential.fairMarketRatio;   // 43%
        taxBase  = Math.floor(price * ratio);
        brackets = d.residential.rates;
        } else if (type === 'land-aggregate') {
        ratio   = 0.70;  // 토지 종합합산 공정시장가액비율 70%
        taxBase = Math.floor(price * ratio);
        brackets = d.land.aggregate;
        } else {
        ratio   = 0.70;
        taxBase = Math.floor(price * ratio);
        brackets = d.land.separate;
        }
    
        // 누진 계산
        const bracket = brackets.find(b => taxBase <= b.max);
        const propTax = Math.floor(taxBase * bracket.rate - bracket.deduction);
        const eduTax  = Math.floor(propTax * d.localEduRate);
        const urbanTax = urban ? Math.floor(taxBase * d.urbanAreaRate) : 0;
        const total   = propTax + eduTax + urbanTax;
    
        // 납부 분할 (20만 이하: 7월 일시, 초과: 50/50)
        const jul = total <= 200_000 ? total : Math.floor(total / 2);
        const sep = total <= 200_000 ? 0     : total - jul;
    
        const resultEl = document.getElementById('pt-result');
        resultEl.style.display = '';
        document.getElementById('pt-ratio').textContent   = (ratio * 100).toFixed(0) + '%';
        document.getElementById('pt-base').textContent    = wonStr(taxBase);
        document.getElementById('pt-tax').textContent     = wonStr(propTax);
        document.getElementById('pt-eduTax').textContent  = wonStr(eduTax);
        document.getElementById('pt-total').textContent   = wonStr(total);
        document.getElementById('pt-jul').textContent     = wonStr(jul) + (total <= 200_000 ? ' (일시납)' : '');
        document.getElementById('pt-sep').textContent     = sep > 0 ? wonStr(sep) : '-';
    
        const urbanRow = document.getElementById('pt-urbanRow');
        if (urban) {
        urbanRow.style.display = '';
        document.getElementById('pt-urbanTax').textContent = wonStr(urbanTax);
        } else {
        urbanRow.style.display = 'none';
        }
    }
    
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 12. 종합부동산세 계산기 (ComprehensiveTax)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    function initComprehensiveTax() {
        setUpdatedBadge('crt-updated', TAX_DATA.comprehensiveRETax.updated);
        initToggleGroup('crt-type', val => {
        // 다주택이면 중과 선택 활성화
        document.getElementById('crt-result').style.display = 'none';
        });
        initToggleGroup('crt-heavy');
    }
    
    function calcComprehensiveTax() {
        const type  = getToggleVal('crt-type');   // oneHouse | multiHouse
        const heavy = getToggleVal('crt-heavy') === 'heavy';
        const price = parseNum(document.getElementById('crt-price').value);
        if (!price) { alert('공시가격 합산액을 입력해 주세요.'); return; }
    
        const d           = TAX_DATA.comprehensiveRETax;
        const deductionAmt= type === 'oneHouse' ? d.deduction.oneHouse : d.deduction.multiHouse;
        const fairPrice   = price - deductionAmt;
    
        if (fairPrice <= 0) {
        document.getElementById('crt-result').style.display = '';
        document.getElementById('crt-deduction').textContent = wonStr(deductionAmt);
        document.getElementById('crt-base').textContent      = '0원 (과세 없음)';
        document.getElementById('crt-rate').textContent      = '-';
        document.getElementById('crt-tax').textContent       = '0원';
        document.getElementById('crt-ruralTax').textContent  = '0원';
        document.getElementById('crt-total').textContent     = '0원';
        return;
        }
    
        const taxBase  = Math.floor(fairPrice * d.fairMarketRatio);   // 과세표준
        const brackets = heavy ? d.residential.heavy : d.residential.normal;
        const bracket  = brackets.find(b => taxBase <= b.max);
        const crtTax   = Math.floor(taxBase * bracket.rate - bracket.deduction);
        const ruralTax = Math.floor(crtTax * d.ruralSpecialRate);
        const total    = crtTax + ruralTax;
    
        const resultEl = document.getElementById('crt-result');
        resultEl.style.display = '';
        document.getElementById('crt-deduction').textContent = wonStr(deductionAmt);
        document.getElementById('crt-base').textContent      = wonStr(taxBase);
        document.getElementById('crt-rate').textContent      = (bracket.rate * 100).toFixed(1) + '%';
        document.getElementById('crt-tax').textContent       = wonStr(crtTax);
        document.getElementById('crt-ruralTax').textContent  = wonStr(ruralTax);
        document.getElementById('crt-total').textContent     = wonStr(total);
    }
    
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 13. 양도소득세 계산기 (CapitalGainsTax)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    function initCapitalGainsTax() {
        setUpdatedBadge('cgt-updated', TAX_DATA.capitalGainsTax.updated);
        initToggleGroup('cgt-houseType', val => {
        document.getElementById('cgt-liveGroup').style.display =
            val === 'oneHouse' ? '' : 'none';
        document.getElementById('cgt-result').style.display = 'none';
        });
    }
    
    function calcCapitalGainsTax() {
        const houseType = getToggleVal('cgt-houseType');  // oneHouse | twoHouse | multi
        const buyPrice  = parseNum(document.getElementById('cgt-buyPrice').value);
        const sellPrice = parseNum(document.getElementById('cgt-sellPrice').value);
        const expense   = parseNum(document.getElementById('cgt-expense').value);
        const holdYear  = parseInt(document.getElementById('cgt-holdYear').value) || 0;
        const liveYear  = parseInt(document.getElementById('cgt-liveYear').value) || 0;
    
        if (!buyPrice || !sellPrice) { alert('취득가액과 양도가액을 입력해 주세요.'); return; }
    
        const d    = TAX_DATA.capitalGainsTax;
        const gain = sellPrice - buyPrice - expense;  // 양도차익
    
        document.getElementById('cgt-result').style.display = '';
        document.getElementById('cgt-gain').textContent = wonStr(Math.max(0, gain));
    
        if (gain <= 0) {
        // 손실
        ['cgt-ltdAmount','cgt-income','cgt-taxBase','cgt-rate','cgt-tax','cgt-localTax','cgt-totalTax']
            .forEach(id => document.getElementById(id).textContent = '-');
        document.getElementById('cgt-exemptRow').style.display = 'none';
        document.getElementById('cgt-note').textContent = '양도차익이 없거나 손실입니다. 양도소득세가 발생하지 않습니다.';
        return;
        }
    
        // ── 1세대 1주택 비과세 판정 ──────────────────────────
        const isOneHouse = houseType === 'oneHouse';
        const NON_TAXABLE_LIMIT = 1_200_000_000;  // 12억원
    
        if (isOneHouse && holdYear >= 2 && liveYear >= 2 && sellPrice <= NON_TAXABLE_LIMIT) {
        document.getElementById('cgt-exemptRow').style.display = '';
        ['cgt-ltdAmount','cgt-income','cgt-taxBase','cgt-rate','cgt-tax','cgt-localTax','cgt-totalTax']
            .forEach(id => document.getElementById(id).textContent = '0원');
        document.getElementById('cgt-note').textContent =
            '✅ 1세대 1주택 비과세 요건을 충족합니다 (보유 2년↑, 거주 2년↑, 양도가 12억 이하).';
        return;
        }
        document.getElementById('cgt-exemptRow').style.display = 'none';
    
        // ── 고가주택 1세대 1주택: 12억 초과분만 과세 ─────────
        let taxableGain = gain;
        let noteText    = '';
        if (isOneHouse && holdYear >= 2 && liveYear >= 2 && sellPrice > NON_TAXABLE_LIMIT) {
        taxableGain = Math.floor(gain * (sellPrice - NON_TAXABLE_LIMIT) / sellPrice);
        noteText = `고가주택: 양도가 ${koreanUnit(sellPrice)} 중 12억 초과분 (${koreanUnit(sellPrice - NON_TAXABLE_LIMIT)})만 과세됩니다.`;
        }
    
        // ── 장기보유특별공제 ──────────────────────────────────
        let ltdRate = 0;
        if (holdYear >= 3) {
        if (isOneHouse && liveYear >= 2) {
            // 1세대 1주택: 보유 4%/년 + 거주 4%/년 (각 10년 한도, 합계 최대 80%)
            const holdRate = Math.min(holdYear, 10) * 0.04;
            const liveRate = Math.min(liveYear, 10) * 0.04;
            ltdRate = Math.min(holdRate + liveRate, 0.80);
        } else if (houseType !== 'multi') {
            // 일반 장특공: 연 2%, 최대 30%
            const table = d.longTermDeduction.general;
            const row   = [...table].reverse().find(r => holdYear >= r.years);
            if (row) ltdRate = row.rate;
        }
        // 다주택 중과: 장특공 미적용
        }
    
        const ltdAmount    = Math.floor(taxableGain * ltdRate);
        const incomeAmount = taxableGain - ltdAmount;
        const basicDeduction = d.basicDeduction;  // 250만원
        const taxBase      = Math.max(0, incomeAmount - basicDeduction);
    
        // ── 세율 적용 ─────────────────────────────────────────
        let taxAmount = 0, rateStr = '';
        if (holdYear < 1) {
        taxAmount = Math.floor(taxBase * d.shortTerm.under1year);
        rateStr   = '70% (1년 미만 단기)';
        } else if (holdYear < 2 && houseType !== 'oneHouse') {
        taxAmount = Math.floor(taxBase * d.shortTerm.under2year);
        rateStr   = '60% (2년 미만 단기)';
        } else if (houseType === 'multi') {
        // 다주택 중과: 기본세율 + 20%p (조정지역 2주택), +30%p (3주택 이상) - 단순화
        const bracket = d.normalRates.find(b => taxBase <= b.max);
        const baseRate = bracket.rate;
        const heavyAdd = 0.20;   // 조정지역 2주택 기준 (단순화)
        taxAmount = Math.floor(taxBase * (baseRate + heavyAdd) - bracket.deduction);
        rateStr   = `${((baseRate + heavyAdd) * 100).toFixed(0)}% (중과 +20%p 적용)`;
        } else {
        const bracket = d.normalRates.find(b => taxBase <= b.max);
        taxAmount = Math.floor(taxBase * bracket.rate - bracket.deduction);
        rateStr   = (bracket.rate * 100).toFixed(0) + '%';
        }
    
        taxAmount = Math.max(0, taxAmount);
        const localTax = Math.floor(taxAmount * 0.10);
        const totalTax = taxAmount + localTax;
    
        // 결과 표시
        document.getElementById('cgt-ltdAmount').textContent = ltdRate > 0
        ? `-${wonStr(ltdAmount)} (${(ltdRate * 100).toFixed(0)}%)` : '해당 없음';
        document.getElementById('cgt-income').textContent   = wonStr(incomeAmount);
        document.getElementById('cgt-taxBase').textContent  = wonStr(taxBase);
        document.getElementById('cgt-rate').textContent     = rateStr;
        document.getElementById('cgt-tax').textContent      = wonStr(taxAmount);
        document.getElementById('cgt-localTax').textContent = wonStr(localTax);
        document.getElementById('cgt-totalTax').textContent = wonStr(totalTax);
        document.getElementById('cgt-note').textContent     =
        noteText + (noteText ? '\n' : '') +
        '⚠️ 본 계산은 단순 추산입니다. 입주권·분양권·임대사업자 감면·이월과세 등 특수한 경우는 반영되지 않습니다.';
    }
    document.addEventListener('DOMContentLoaded', () => {
        initNav();
        initNumberInputs();
    
        // 기존 4개
        initAgentFee();
        initRentConversion();
        initLoanRatio();
        initRentalYield();
    
        // 신규 6개
        initRegistration();
        initLoanInterest();
        initAcquisitionTax();
        initPropertyTax();
        initComprehensiveTax();
        initCapitalGainsTax();
    
        // 기본 화면: 중개보수
        switchCalc('agentFee');
    });
    