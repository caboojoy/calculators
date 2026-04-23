    /* ==========================================
    4대보험 계산기 — script.js
    ========================================== */

    // ==========================================
    // CONFIG — 연도별 요율 및 한도
    // ==========================================
    const CONFIG = {
        2025: {
        pension: {
            rate: 0.09,           // 국민연금 합산 요율
            workerRate: 0.045,
            employerRate: 0.045,
            ceiling: 6170000,     // 기준소득월액 상한 (617만원)
            floor: 370000,        // 기준소득월액 하한 (37만원)
        },
        health: {
            rate: 0.0709,         // 건강보험 합산 요율
            workerRate: 0.03545,
            employerRate: 0.03545,
            ltcRate: 0.1295,      // 장기요양보험 = 건강보험료 × 12.95%
        },
        employment: {
            workerRate: 0.009,    // 고용보험 근로자
            employerRate: 0.0115, // 사업주 (150인 미만 기준)
        },
        },
        2024: {
        pension: {
            rate: 0.09,
            workerRate: 0.045,
            employerRate: 0.045,
            ceiling: 5900000,
            floor: 370000,
        },
        health: {
            rate: 0.0709,
            workerRate: 0.03545,
            employerRate: 0.03545,
            ltcRate: 0.1281,
        },
        employment: {
            workerRate: 0.009,
            employerRate: 0.0115,
        },
        },
    };
    
    // ==========================================
    // 전역 상태
    // ==========================================
    const state = {
        tab: 'annual',        // 'annual' | 'monthly'
        salary: 0,
        monthlySalary: 0,
        annualSalary: 0,
        nontax: 0,
        bonusIncluded: false,
        industryRate: 0.009,
        year: 2025,
        result: null,
    };
    
    let donutChart = null;
    let barChart   = null;
    
    // ==========================================
    // 탭 전환
    // ==========================================
    function switchTab(tab) {
        state.tab = tab;
        document.getElementById('tab-annual').classList.toggle('active', tab === 'annual');
        document.getElementById('tab-monthly').classList.toggle('active', tab === 'monthly');
        document.getElementById('salary-label').textContent =
        tab === 'annual' ? '연봉 입력' : '월급 입력';
        document.getElementById('salary-hint').textContent =
        tab === 'annual' ? '월 환산액이 자동으로 계산됩니다' : '연봉 환산액이 자동으로 계산됩니다';
        if (document.getElementById('salary-input').value) calculate();
    }
    
    // ==========================================
    // 입력 핸들러
    // ==========================================
    function onSalaryInput(el) {
        applyThousands(el);
        const num = parseRaw(el.value);
        const annual = state.tab === 'annual' ? num : num * 12;
        const sliderEl = document.getElementById('salary-slider');
        sliderEl.value = Math.min(Math.max(annual, 10000000), 200000000);
        document.getElementById('slider-display').textContent = formatWon(annual) + '원';
        calculate();
    }
    
    function onSliderInput(val) {
        const annual = parseInt(val, 10);
        document.getElementById('slider-display').textContent = formatWon(annual) + '원';
        const rawNum = state.tab === 'annual' ? annual : Math.round(annual / 12);
        document.getElementById('salary-input').value = rawNum.toLocaleString('ko-KR');
        calculate();
    }
    
    function onYearChange(year) {
        state.year = parseInt(year, 10);
        document.getElementById('year-badge').textContent = year + '년';
        calculate();
    }
    
    // ==========================================
    // 메인 계산
    // ==========================================
    function calculate() {
        const cfg        = CONFIG[state.year];
        const rawSalary  = parseRaw(document.getElementById('salary-input').value);
        const nontax     = parseRaw(document.getElementById('nontax-input').value);
        const bonusIncluded = document.getElementById('bonus-check').checked;
        const industryRate  = parseFloat(document.getElementById('industry-select').value);
    
        // 유효성 검사
        const salaryErr = document.getElementById('salary-error');
        if (rawSalary < 0) {
        salaryErr.classList.add('show');
        salaryErr.textContent = '올바른 금액을 입력해주세요';
        return;
        }
        salaryErr.classList.remove('show');
    
        if (rawSalary === 0) {
        showEmpty();
        return;
        }
    
        // 월급 환산
        let monthly;
        if (state.tab === 'annual') {
        monthly = bonusIncluded ? rawSalary / 13 : rawSalary / 12;
        } else {
        monthly = rawSalary;
        }
        const annual = state.tab === 'annual' ? rawSalary : rawSalary * 12;
    
        // 비과세 검증
        const nontaxErr = document.getElementById('nontax-error');
        if (nontax > monthly) {
        nontaxErr.classList.add('show');
        return;
        }
        nontaxErr.classList.remove('show');
    
        // 과세 대상 급여
        const taxableSalary = monthly - nontax;
    
        // ── 국민연금 ──
        const pensionBase     = Math.min(Math.max(taxableSalary, cfg.pension.floor), cfg.pension.ceiling);
        const pensionWorker   = Math.floor(pensionBase * cfg.pension.workerRate);
        const pensionEmployer = Math.floor(pensionBase * cfg.pension.employerRate);
    
        // ── 건강보험 ──
        const healthWorker   = Math.floor(taxableSalary * cfg.health.workerRate);
        const healthEmployer = Math.floor(taxableSalary * cfg.health.employerRate);
    
        // ── 장기요양보험 ──
        const ltcWorker   = Math.floor(healthWorker   * cfg.health.ltcRate);
        const ltcEmployer = Math.floor(healthEmployer * cfg.health.ltcRate);
    
        // ── 고용보험 ──
        const emplWorker   = Math.floor(taxableSalary * cfg.employment.workerRate);
        const emplEmployer = Math.floor(taxableSalary * cfg.employment.employerRate);
    
        // ── 산재보험 (사업주만) ──
        const injuryEmployer = Math.floor(taxableSalary * (industryRate / 100));
    
        // ── 합계 ──
        const totalWorker   = pensionWorker + healthWorker + ltcWorker + emplWorker;
        const totalEmployer = pensionEmployer + healthEmployer + ltcEmployer + emplEmployer + injuryEmployer;
    
        const netSalary    = monthly - totalWorker;
        const deductionRate = ((totalWorker / monthly) * 100).toFixed(2);
        const netRate       = ((netSalary   / monthly) * 100).toFixed(1);
    
        state.result = {
        monthly, annual, taxableSalary, nontax,
        pension:    { worker: pensionWorker, employer: pensionEmployer, base: pensionBase, cfg: cfg.pension },
        health:     { worker: healthWorker,  employer: healthEmployer },
        ltc:        { worker: ltcWorker,     employer: ltcEmployer },
        employment: { worker: emplWorker,    employer: emplEmployer },
        injury:     { worker: 0,             employer: injuryEmployer },
        totalWorker, totalEmployer,
        netSalary, deductionRate, netRate,
        industryRate, cfg,
        };
    
        renderResult();
    }
    
    // ==========================================
    // 렌더링
    // ==========================================
    function renderResult() {
        const r = state.result;
        if (!r) return;
    
        // 결과 카드 표시
        ['summary-card', 'chart-card', 'table-card', 'compare-card', 'ratio-card'].forEach(id => {
        document.getElementById(id).style.display = '';
        });
    
        // ── 요약 ──
        document.getElementById('summary-content').innerHTML = `
        <div class="summary-grid fade-in">
            <div class="summary-item">
            <div class="summary-label">월 총급여</div>
            <div class="summary-value">${formatWon(r.monthly)}</div>
            <div class="summary-sub">원</div>
            </div>
            <div class="summary-item">
            <div class="summary-label">연봉 환산</div>
            <div class="summary-value">${formatWonShort(r.annual)}</div>
            <div class="summary-sub">원</div>
            </div>
            <div class="summary-item highlight">
            <div class="summary-label">월 실수령액</div>
            <div class="summary-value">${formatWon(r.netSalary)}</div>
            <div class="summary-sub">원 (${r.netRate}%)</div>
            </div>
            <div class="summary-item">
            <div class="summary-label">근로자 공제</div>
            <div class="summary-value">${formatWon(r.totalWorker)}</div>
            <div class="summary-sub">월 (${r.deductionRate}%)</div>
            </div>
            <div class="summary-item">
            <div class="summary-label">사업주 부담</div>
            <div class="summary-value">${formatWon(r.totalEmployer)}</div>
            <div class="summary-sub">월</div>
            </div>
            <div class="summary-item">
            <div class="summary-label">연간 공제 합계</div>
            <div class="summary-value">${formatWonShort(r.totalWorker * 12)}</div>
            <div class="summary-sub">원</div>
            </div>
        </div>
        `;
    
        // ── 보험료 테이블 ──
        const items = [
        {
            name: '국민연금', color: '#2196c9',
            worker: r.pension.worker,    employer: r.pension.employer,
            workerRate:   (r.cfg.pension.workerRate   * 100).toFixed(2) + '%',
            employerRate: (r.cfg.pension.employerRate * 100).toFixed(2) + '%',
        },
        {
            name: '건강보험', color: '#e07c2a',
            worker: r.health.worker,     employer: r.health.employer,
            workerRate:   (r.cfg.health.workerRate   * 100).toFixed(3) + '%',
            employerRate: (r.cfg.health.employerRate * 100).toFixed(3) + '%',
        },
        {
            name: '장기요양보험', color: '#7c5cbf',
            worker: r.ltc.worker,        employer: r.ltc.employer,
            workerRate:   '건보×' + (r.cfg.health.ltcRate * 100).toFixed(2) + '%',
            employerRate: '건보×' + (r.cfg.health.ltcRate * 100).toFixed(2) + '%',
        },
        {
            name: '고용보험', color: '#2da44e',
            worker: r.employment.worker, employer: r.employment.employer,
            workerRate:   (r.cfg.employment.workerRate   * 100).toFixed(1) + '%',
            employerRate: (r.cfg.employment.employerRate * 100).toFixed(2) + '%',
        },
        {
            name: '산재보험', color: '#d9534f',
            worker: 0,                   employer: r.injury.employer,
            workerRate: '—', employerRate: r.industryRate + '%',
        },
        ];
    
        document.getElementById('table-content').innerHTML = `
        <table class="insurance-table">
            <thead>
            <tr>
                <th>보험 종류</th>
                <th>요율(근로자)</th>
                <th>요율(사업주)</th>
                <th>근로자 부담</th>
                <th>사업주 부담</th>
            </tr>
            </thead>
            <tbody>
            ${items.map(item => `
                <tr>
                <td><span class="ins-dot" style="background:${item.color}"></span>${item.name}</td>
                <td class="rate-val">${item.workerRate}</td>
                <td class="rate-val">${item.employerRate}</td>
                <td class="worker-val">${item.worker ? formatWon(item.worker) : '—'}</td>
                <td class="employer-val">${formatWon(item.employer)}</td>
                </tr>
            `).join('')}
            <tr class="table-total">
                <td>합 계</td><td></td><td></td>
                <td class="worker-val">${formatWon(r.totalWorker)}</td>
                <td class="employer-val">${formatWon(r.totalEmployer)}</td>
            </tr>
            </tbody>
        </table>
        `;
    
        // ── 계산 과정 상세 ──
        document.getElementById('detail-content').innerHTML = `
        <div class="detail-row">
            <span class="detail-key">총 급여 (월)</span>
            <span class="detail-val">${formatWon(r.monthly)}원</span>
        </div>
        <div class="detail-row">
            <span class="detail-key">비과세 금액</span>
            <span class="detail-val">- ${formatWon(r.nontax)}원</span>
        </div>
        <div class="detail-row">
            <span class="detail-key">과세 대상 급여</span>
            <span class="detail-val">${formatWon(r.taxableSalary)}원</span>
        </div>
        <hr style="border:none;border-top:1px solid var(--border);margin:6px 0">
        <div class="detail-row">
            <span class="detail-key">국민연금 기준소득</span>
            <span class="detail-val">${formatWon(r.pension.base)}원 (상한 ${formatWon(r.cfg.pension.ceiling)})</span>
        </div>
        <div class="detail-row">
            <span class="detail-key">국민연금 = ${formatWon(r.pension.base)} × ${(r.cfg.pension.workerRate*100).toFixed(2)}%</span>
            <span class="detail-val">${formatWon(r.pension.worker)}원</span>
        </div>
        <div class="detail-row">
            <span class="detail-key">건강보험 = ${formatWon(r.taxableSalary)} × ${(r.cfg.health.workerRate*100).toFixed(3)}%</span>
            <span class="detail-val">${formatWon(r.health.worker)}원</span>
        </div>
        <div class="detail-row">
            <span class="detail-key">장기요양 = ${formatWon(r.health.worker)} × ${(r.cfg.health.ltcRate*100).toFixed(2)}%</span>
            <span class="detail-val">${formatWon(r.ltc.worker)}원</span>
        </div>
        <div class="detail-row">
            <span class="detail-key">고용보험 = ${formatWon(r.taxableSalary)} × ${(r.cfg.employment.workerRate*100).toFixed(1)}%</span>
            <span class="detail-val">${formatWon(r.employment.worker)}원</span>
        </div>
        <hr style="border:none;border-top:1px solid var(--border);margin:6px 0">
        <div class="detail-row">
            <span class="detail-key">총 공제액</span>
            <span class="detail-val">${formatWon(r.totalWorker)}원</span>
        </div>
        <div class="detail-row">
            <span class="detail-key">실수령액 = ${formatWon(r.monthly)} - ${formatWon(r.totalWorker)}</span>
            <span class="detail-val">${formatWon(r.netSalary)}원</span>
        </div>
        `;
    
        // ── 비율 바 ──
        const ratioBars = [
        { name: '실수령',  pct: parseFloat(r.netRate), color: '#2da44e' },
        { name: '국민연금', pct: r.monthly > 0 ? (r.pension.worker / r.monthly * 100) : 0, color: '#2196c9' },
        { name: '건강보험', pct: r.monthly > 0 ? ((r.health.worker + r.ltc.worker) / r.monthly * 100) : 0, color: '#e07c2a' },
        { name: '고용보험', pct: r.monthly > 0 ? (r.employment.worker / r.monthly * 100) : 0, color: '#7c5cbf' },
        ];
    
        document.getElementById('ratio-bars').innerHTML = ratioBars.map(b => `
        <div class="ratio-row">
            <span class="ratio-name">${b.name}</span>
            <div class="ratio-track">
            <div class="ratio-fill" style="width:${Math.min(b.pct, 100).toFixed(1)}%;background:${b.color}"></div>
            </div>
            <span class="ratio-pct">${b.pct.toFixed(1)}%</span>
        </div>
        `).join('');
    
        // ── 차트 / 비교 ──
        renderCharts();
        updateCompare();
    }
    
    // ==========================================
    // 차트 렌더링
    // ==========================================
    function renderCharts() {
        const r = state.result;
    
        const donutLabels = ['국민연금', '건강보험', '장기요양', '고용보험'];
        const donutColors = ['#2196c9', '#f0a030', '#8e6ecf', '#2da44e'];
        const donutData   = [r.pension.worker, r.health.worker, r.ltc.worker, r.employment.worker];
    
        document.getElementById('donut-pct').textContent = r.deductionRate + '%';
    
        if (donutChart) donutChart.destroy();
        donutChart = new Chart(
        document.getElementById('donutChart').getContext('2d'),
        {
            type: 'doughnut',
            data: {
            labels: donutLabels,
            datasets: [{
                data: donutData,
                backgroundColor: donutColors,
                borderColor: '#ffffff',
                borderWidth: 3,
                hoverOffset: 6,
            }],
            },
            options: {
            cutout: '68%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                callbacks: {
                    label: ctx =>
                    ` ${formatWon(ctx.raw)}원 (${(ctx.raw / r.totalWorker * 100).toFixed(1)}%)`,
                },
                },
            },
            animation: { animateRotate: true, duration: 500 },
            },
        }
        );
    
        // 범례
        document.getElementById('donut-legend').innerHTML = donutLabels.map((l, i) => `
        <div class="legend-item">
            <span class="legend-dot" style="background:${donutColors[i]}"></span>
            <span>${l}</span>
        </div>
        `).join('');
    
        // 바 차트
        if (barChart) barChart.destroy();
        barChart = new Chart(
        document.getElementById('barChart').getContext('2d'),
        {
            type: 'bar',
            data: {
            labels: ['월 총급여', '근로자 공제', '실수령액'],
            datasets: [{
                data: [r.monthly, r.totalWorker, r.netSalary],
                backgroundColor: ['rgba(33,150,201,0.18)', 'rgba(217,83,79,0.18)', 'rgba(45,164,78,0.22)'],
                borderColor:     ['#2196c9', '#d9534f', '#2da44e'],
                borderWidth: 2,
                borderRadius: 6,
            }],
            },
            options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ' ' + formatWon(ctx.raw) + '원' } },
            },
            scales: {
                x: {
                grid:  { color: 'rgba(184,216,239,0.5)' },
                ticks: { color: '#7aaec8', font: { family: 'Noto Sans KR', size: 11 } },
                },
                y: {
                grid:  { color: 'rgba(184,216,239,0.5)' },
                ticks: {
                    color: '#7aaec8',
                    font:  { family: 'DM Mono', size: 11 },
                    callback: v => formatWonShort(v),
                },
                },
            },
            animation: { duration: 400 },
            },
        }
        );
    }
    
    // ==========================================
    // 연봉 비교
    // ==========================================
    function updateCompare() {
        const r = state.result;
        if (!r) return;
    
        const compareVal = parseRaw(document.getElementById('compare-input').value);
        if (!compareVal) {
        document.getElementById('compare-content').innerHTML =
            '<div style="text-align:center;color:var(--text3);font-size:12px;padding:16px 0">비교할 연봉을 입력하세요</div>';
        return;
        }
    
        const cfg      = CONFIG[state.year];
        const monthly2 = compareVal / 12;
        const nontax   = parseRaw(document.getElementById('nontax-input').value);
        const taxable2 = Math.max(monthly2 - nontax, 0);
    
        const p2 = Math.floor(Math.min(Math.max(taxable2, cfg.pension.floor), cfg.pension.ceiling) * cfg.pension.workerRate);
        const h2 = Math.floor(taxable2 * cfg.health.workerRate);
        const l2 = Math.floor(h2 * cfg.health.ltcRate);
        const e2 = Math.floor(taxable2 * cfg.employment.workerRate);
    
        const total2 = p2 + h2 + l2 + e2;
        const net2   = monthly2 - total2;
    
        const annualDiff     = compareVal - r.annual;
        const netMonthlyDiff = net2 - r.netSalary;
        const netAnnualDiff  = netMonthlyDiff * 12;
    
        const sign = v => v >= 0 ? '+' : '';
        const cls  = v => v >= 0 ? 'up' : 'down';
    
        document.getElementById('compare-content').innerHTML = `
        <div class="compare-row">
            <span class="compare-lbl">현재 연봉</span>
            <span class="compare-val">${formatWon(r.annual)}원</span>
        </div>
        <div class="compare-row">
            <span class="compare-lbl">비교 연봉</span>
            <span class="compare-val">${formatWon(compareVal)}원</span>
        </div>
        <div class="compare-row">
            <span class="compare-lbl">연봉 차이</span>
            <span class="compare-val ${cls(annualDiff)}">${sign(annualDiff)}${formatWon(annualDiff)}원</span>
        </div>
        <div class="compare-row" style="border-color:rgba(33,150,201,0.25)">
            <span class="compare-lbl" style="color:var(--text)">현재 월 실수령</span>
            <span class="compare-val" style="color:var(--accent)">${formatWon(r.netSalary)}원</span>
        </div>
        <div class="compare-row" style="border-color:rgba(33,150,201,0.25)">
            <span class="compare-lbl" style="color:var(--text)">비교 월 실수령</span>
            <span class="compare-val" style="color:var(--accent)">${formatWon(net2)}원</span>
        </div>
        <div class="compare-row">
            <span class="compare-lbl">월 실수령 차이</span>
            <span class="compare-val ${cls(netMonthlyDiff)}">${sign(netMonthlyDiff)}${formatWon(netMonthlyDiff)}원</span>
        </div>
        <div class="compare-row">
            <span class="compare-lbl">연간 실수령 차이</span>
            <span class="compare-val ${cls(netAnnualDiff)}">${sign(netAnnualDiff)}${formatWon(netAnnualDiff)}원</span>
        </div>
        `;
    }
    
    // ==========================================
    // 계산 과정 토글
    // ==========================================
    function toggleDetail() {
        const btn     = document.getElementById('detail-btn');
        const content = document.getElementById('detail-content');
        const isOpen  = btn.classList.toggle('open');
        content.classList.toggle('show', isOpen);
        btn.childNodes.forEach(n => {
        if (n.nodeType === Node.TEXT_NODE && n.textContent.trim()) {
            n.textContent = isOpen ? ' 계산 과정 닫기' : ' 계산 과정 보기';
        }
        });
    }
    
    // ==========================================
    // 빈 상태
    // ==========================================
    function showEmpty() {
        document.getElementById('summary-content').innerHTML = `
        <div class="empty-state">
            <div class="empty-icon">💼</div>
            <div>급여를 입력하면 결과가 표시됩니다</div>
        </div>
        `;
        ['chart-card', 'table-card', 'compare-card', 'ratio-card'].forEach(id => {
        document.getElementById(id).style.display = 'none';
        });
    }
    
    // ==========================================
    // 유틸리티
    // ==========================================
    
    /** 쉼표 제거 후 숫자 반환 */
    function parseRaw(str) {
        return parseFloat((str || '').replace(/,/g, '')) || 0;
    }
    
    /** 입력 중 천단위 쉼표 자동 포맷 */
    function applyThousands(el) {
        const raw       = el.value.replace(/[^0-9]/g, '');
        el.value = raw ? parseInt(raw, 10).toLocaleString('ko-KR') : '';
    }
    
    /** 공통 포맷 핸들러 — 포맷 후 콜백 실행 */
    function onFormattedInput(el, callback) {
        applyThousands(el);
        callback();
    }
    
    /** 금액 → 천단위 쉼표 */
    function formatWon(n) {
        if (!n && n !== 0) return '—';
        return Math.round(n).toLocaleString('ko-KR');
    }
    
    /** 금액 → 억/만 단위 축약 */
    function formatWonShort(n) {
        if (!n && n !== 0) return '0';
        const abs  = Math.abs(n);
        const sign = n < 0 ? '-' : '';
        if (abs >= 100000000) return sign + (abs / 100000000).toFixed(1) + '억';
        if (abs >= 10000)     return sign + Math.round(abs / 10000) + '만';
        return sign + abs.toLocaleString('ko-KR');
    }
    
    // ==========================================
    // 초기화
    // ==========================================
    function init() {
        document.getElementById('salary-input').value = '40,000,000';
        document.getElementById('salary-slider').value = '40000000';
        document.getElementById('slider-display').textContent = '4,000만원';
        calculate();
    }
    
    window.addEventListener('DOMContentLoaded', init);
    
    