/* ═══════════════════════════════════════════════════════════
   퇴직금 계산기 — script.js
   ═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   CONFIG  —  세율·공제 기준
   ※ 매년 세법 변경 시 이 구역만 수정하면 됩니다.
   ═══════════════════════════════════════════════════════════ */
   const TAX_CONFIG = {

    taxYear: 2024,
  
    /*
     * 근속연수 공제 (2023년 이후 개정세법)
     * upTo    : 구간 상한 (이하)
     * base    : 구간 시작 시점 누적 공제액
     * perYear : 초과 1년당 추가 공제액
     * prev    : 이전 구간 상한
     */
    tenureDeduction: [
      { upTo: 5,        base:           0, perYear: 1_000_000, prev: 0  }, // 100만 × n년
      { upTo: 10,       base:   5_000_000, perYear: 2_000_000, prev: 5  }, // 500만 + 200만 × (n-5)
      { upTo: 20,       base:  15_000_000, perYear: 2_500_000, prev: 10 }, // 1,500만 + 250만 × (n-10)
      { upTo: Infinity, base:  40_000_000, perYear: 3_000_000, prev: 20 }, // 4,000만 + 300만 × (n-20)
    ],
  
    /*
     * 환산급여 공제
     * upTo  : 구간 상한
     * base  : 구간 시작 시점 누적 공제액
     * rate  : 초과분 공제율
     * prev  : 이전 구간 상한
     */
    convertedDeduction: [
      { upTo:   8_000_000, base:           0, rate: 1.00, prev:           0 }, // 전액
      { upTo:  70_000_000, base:   8_000_000, rate: 0.60, prev:   8_000_000 }, // 800만 + 60%
      { upTo: 100_000_000, base:  45_200_000, rate: 0.55, prev:  70_000_000 }, // 4,520만 + 55%
      { upTo: 300_000_000, base:  61_700_000, rate: 0.45, prev: 100_000_000 }, // 6,170만 + 45%
      { upTo: Infinity,    base: 151_700_000, rate: 0.35, prev: 300_000_000 }, // 15,170만 + 35%
    ],
  
    /*
     * 종합소득 누진세율 (2023년 기준)
     * 퇴직소득 환산세액 계산에 사용
     */
    taxBrackets: [
      { upTo:    14_000_000, rate: 0.06, deduction:          0 },
      { upTo:    50_000_000, rate: 0.15, deduction:  1_260_000 },
      { upTo:    88_000_000, rate: 0.24, deduction:  5_760_000 },
      { upTo:   150_000_000, rate: 0.35, deduction: 15_440_000 },
      { upTo:   300_000_000, rate: 0.38, deduction: 19_940_000 },
      { upTo:   500_000_000, rate: 0.40, deduction: 25_940_000 },
      { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
      { upTo: Infinity,      rate: 0.45, deduction: 65_940_000 },
    ],
  
    localTaxRate: 0.10,  // 지방소득세율 (소득세의 10%)
  };
  
  
  /* ═══════════════════════════════════════════════════════════
     UTILITIES
     ═══════════════════════════════════════════════════════════ */
  
  /** 숫자를 "n,nnn원" 형식으로 변환 */
  function won(n) {
    return Math.round(n).toLocaleString('ko-KR') + '원';
  }
  
  /** 숫자를 "억 / 만원" 축약 형식으로 변환 (차트 중앙 표시용) */
  function wonShort(n) {
    n = Math.round(n);
    if (n >= 100_000_000) return (n / 100_000_000).toFixed(1).replace(/\.0$/, '') + '억';
    if (n >= 10_000)      return Math.round(n / 10_000) + '만원';
    return n.toLocaleString() + '원';
  }
  
  
  /* ═══════════════════════════════════════════════════════════
     DATE HELPERS
     ═══════════════════════════════════════════════════════════ */
  
  /**
   * 'YYYY-MM-DD' 문자열을 로컬 자정(Date)으로 파싱
   * new Date('YYYY-MM-DD')는 UTC midnight으로 파싱되어
   * 음수 UTC offset 환경에서 하루 앞당겨지는 문제를 방지
   */
  function parseLocalDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  
  /**
   * 두 Date 사이의 "n년 m개월 d일" 문자열을 캘린더 기반으로 계산
   * (totalDays/365 방식은 윤년 포함 시 "n년 1일" 오표시 발생)
   */
  function calcReadable(s, e) {
    let y  = e.getFullYear() - s.getFullYear();
    let mo = e.getMonth()    - s.getMonth();
    let d  = e.getDate()     - s.getDate();
  
    if (d < 0) {
      mo--;
      d += new Date(e.getFullYear(), e.getMonth(), 0).getDate();
    }
    if (mo < 0) { y--; mo += 12; }
  
    const parts = [];
    if (y  > 0) parts.push(y  + '년');
    if (mo > 0) parts.push(mo + '개월');
    if (d  > 0) parts.push(d  + '일');
    return parts.join(' ') || '0일';
  }
  
  
  /* ═══════════════════════════════════════════════════════════
     STEP 1 — 재직 정보 계산
     ═══════════════════════════════════════════════════════════ */
  
  /**
   * @returns {{
   *   totalDays  : number  — 총 재직 일수
   *   exactYears : number  — 소수 연수 (퇴직급여 계산용)
   *   taxYears   : number  — 세법 근속연수, 1년 미만 단수 → 올림 (세금 계산용)
   *   readable   : string  — "n년 m개월 d일"
   * }}
   */
  function calcServiceInfo(startStr, endStr) {
    const s = parseLocalDate(startStr);
    const e = parseLocalDate(endStr);
  
    const totalDays  = Math.round((e - s) / 86_400_000);
    const exactYears = totalDays / 365;
  
    // 완전한 연수 계산
    let fullYears  = e.getFullYear() - s.getFullYear();
    const dm = e.getMonth() - s.getMonth();
    const dd = e.getDate()  - s.getDate();
    if (dm < 0 || (dm === 0 && dd < 0)) fullYears--;
  
    // anniversary 직접 생성 — setFullYear()는 2/29에서 3/1로 overflow됨
    const annivYear  = s.getFullYear() + fullYears;
    const lastDay    = new Date(annivYear, s.getMonth() + 1, 0).getDate();
    const anniversary = new Date(annivYear, s.getMonth(), Math.min(s.getDate(), lastDay));
  
    const taxYears = Math.max(1, e > anniversary ? fullYears + 1 : fullYears);
    const readable = calcReadable(s, e);
  
    return { totalDays, exactYears, taxYears, readable };
  }
  
  
  /* ═══════════════════════════════════════════════════════════
     STEP 2 — 근속연수 공제
     ═══════════════════════════════════════════════════════════ */
  
  function calcTenureDeduction(taxYears) {
    for (const b of TAX_CONFIG.tenureDeduction) {
      if (taxYears <= b.upTo) {
        return b.base + b.perYear * (taxYears - b.prev);
      }
    }
    return 0;
  }
  
  
  /* ═══════════════════════════════════════════════════════════
     STEP 3 — 환산급여 공제
     ═══════════════════════════════════════════════════════════ */
  
  function calcConvertedDeduction(convertedSalary) {
    for (const b of TAX_CONFIG.convertedDeduction) {
      if (convertedSalary <= b.upTo) {
        return b.base + (convertedSalary - b.prev) * b.rate;
      }
    }
    return 0;
  }
  
  
  /* ═══════════════════════════════════════════════════════════
     STEP 4 — 누진세율 적용
     ═══════════════════════════════════════════════════════════ */
  
  function calcProgressiveTax(taxBase) {
    for (const b of TAX_CONFIG.taxBrackets) {
      if (taxBase <= b.upTo) {
        return Math.max(0, taxBase * b.rate - b.deduction);
      }
    }
    return 0;
  }
  
  
  /* ═══════════════════════════════════════════════════════════
     MAIN — 전체 계산
     ═══════════════════════════════════════════════════════════ */
  
  function calcAll(startStr, endStr, salary3M, days3M) {
    // ① 평균임금 (1일)
    const avgDailyWage = salary3M / days3M;
  
    // ② 재직 정보
    const svc = calcServiceInfo(startStr, endStr);
  
    // ③ 퇴직급여 = 평균임금 × 30일 × 근속연수
    const severancePay = avgDailyWage * 30 * svc.exactYears;
  
    // ─── 퇴직소득세 계산 ───
    // (일반 소득세와 구조가 다름 — 환산급여 방식)
  
    // ④ 퇴직소득금액
    const retirementIncome = severancePay;
  
    // ⑤ 근속연수 공제
    const tenureDeduction = calcTenureDeduction(svc.taxYears);
    const afterTenure     = Math.max(0, retirementIncome - tenureDeduction);
  
    // ⑥ 환산급여 = 잔액 × 12 ÷ 근속연수
    const convertedSalary = afterTenure * 12 / svc.taxYears;
  
    // ⑦ 환산급여 공제
    const convertedDeduction = calcConvertedDeduction(convertedSalary);
  
    // ⑧ 과세표준
    const taxBase = Math.max(0, convertedSalary - convertedDeduction);
  
    // ⑨ 환산산출세액 (누진세율)
    const convertedTax = calcProgressiveTax(taxBase);
  
    // ⑩ 산출세액 = 환산세액 × 근속연수 ÷ 12
    const incomeTax = convertedTax * svc.taxYears / 12;
  
    // ⑪ 지방소득세
    const localTax = incomeTax * TAX_CONFIG.localTaxRate;
  
    // ⑫ 합계 및 실수령
    const totalTax  = incomeTax + localTax;
    const netAmount = severancePay - totalTax;
  
    return {
      avgDailyWage, svc,
      severancePay,
      retirementIncome, tenureDeduction, afterTenure,
      convertedSalary, convertedDeduction,
      taxBase, convertedTax, incomeTax, localTax,
      totalTax, netAmount,
    };
  }
  
  
  /* ═══════════════════════════════════════════════════════════
     SALARY INPUT — 천단위 쉼표 포맷
     ═══════════════════════════════════════════════════════════ */
  
  function getSalaryRawValue() {
    return parseFloat(document.getElementById('totalSalary').value.replace(/,/g, '')) || 0;
  }
  
  (function initSalaryInput() {
    const el = document.getElementById('totalSalary');
  
    el.addEventListener('input', () => {
      const raw = el.value.replace(/[^0-9]/g, '');
      if (raw === '') { el.value = ''; return; }
      el.value = Number(raw).toLocaleString('ko-KR');
    });
  
    el.addEventListener('paste', e => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text');
      const raw = pasted.replace(/[^0-9]/g, '');
      if (raw) el.value = Number(raw).toLocaleString('ko-KR');
    });
  })();
  
  
  /* ═══════════════════════════════════════════════════════════
     DATE INPUT HANDLER — 재직기간 실시간 표시
     ═══════════════════════════════════════════════════════════ */
  
  function refreshTenureBox() {
    const s   = document.getElementById('startDate').value;
    const e   = document.getElementById('endDate').value;
    const box = document.getElementById('tenureBox');
  
    if (!s || !e) { box.style.display = 'none'; return; }
  
    const sd = parseLocalDate(s);
    const ed = parseLocalDate(e);
    if (ed <= sd) { box.style.display = 'none'; return; }
  
    const info = calcServiceInfo(s, e);
    document.getElementById('tenureText').textContent =
      `${info.readable} (총 ${info.totalDays.toLocaleString()}일)`;
    box.style.display = 'flex';
  }
  
  document.getElementById('startDate').addEventListener('change', refreshTenureBox);
  document.getElementById('endDate').addEventListener('change', refreshTenureBox);
  
  
  /* ═══════════════════════════════════════════════════════════
     VALIDATION
     ═══════════════════════════════════════════════════════════ */
  
  function clearErrors() {
    ['startDateErr', 'endDateErr', 'salaryErr', 'daysErr'].forEach(id => {
      document.getElementById(id).textContent = '';
    });
    ['startDate', 'endDate', 'totalSalary', 'totalDays'].forEach(id => {
      document.getElementById(id).classList.remove('is-error');
    });
  }
  
  function showErr(inputId, msgId, msg) {
    document.getElementById(msgId).textContent = msg;
    document.getElementById(inputId).classList.add('is-error');
  }
  
  function validate(s, e, salary, days) {
    clearErrors();
    let ok = true;
  
    if (!s) { showErr('startDate', 'startDateErr', '입사일을 입력하세요.'); ok = false; }
    if (!e) { showErr('endDate',   'endDateErr',   '퇴사일을 입력하세요.'); ok = false; }
  
    if (s && e) {
      const sd = parseLocalDate(s);
      const ed = parseLocalDate(e);
      if (ed <= sd) {
        showErr('endDate', 'endDateErr', '퇴사일은 입사일 이후여야 합니다.'); ok = false;
      } else {
        const diffDays = Math.round((ed - sd) / 86_400_000);
        if (diffDays < 365) {
          document.getElementById('endDateErr').textContent =
            '⚠️ 재직기간 1년 미만 — 법적 퇴직금 미발생 가능 (계산은 진행됩니다)';
        }
      }
    }
  
    if (!salary || isNaN(salary) || salary <= 0) {
      showErr('totalSalary', 'salaryErr', '0원 초과의 급여액을 입력하세요.'); ok = false;
    }
    if (!days || isNaN(days) || days <= 0) {
      showErr('totalDays', 'daysErr', '0일 초과의 일수를 입력하세요.'); ok = false;
    } else if (days > 95) {
      showErr('totalDays', 'daysErr', '3개월 일수는 최대 95일입니다.'); ok = false;
    }
  
    return ok;
  }
  
  
  /* ═══════════════════════════════════════════════════════════
     CHART — 도넛 차트 (Chart.js)
     ═══════════════════════════════════════════════════════════ */
  
  let chartInstance = null;
  
  function renderChart(severance, tax, net) {
    const ctx = document.getElementById('donutChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
  
    const netPct = ((net / severance) * 100).toFixed(1);
    const taxPct = ((tax / severance) * 100).toFixed(1);
  
    document.getElementById('leg-net').textContent  = netPct + '%';
    document.getElementById('leg-tax').textContent  = taxPct + '%';
    document.getElementById('chartCenterVal').textContent = wonShort(severance);
  
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['실수령액', '세금'],
        datasets: [{
          data: [Math.round(net), Math.round(tax)],
          backgroundColor: ['#1B2B5B', '#B8922A'],
          borderWidth: 0,
          hoverOffset: 8,
        }],
      },
      options: {
        cutout: '70%',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const pct = ((ctx.parsed / severance) * 100).toFixed(1);
                return ` ${ctx.label}: ${Math.round(ctx.parsed).toLocaleString()}원 (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
  
  
  /* ═══════════════════════════════════════════════════════════
     RENDER RESULTS — DOM 업데이트
     ═══════════════════════════════════════════════════════════ */
  
  function renderResults(r) {
    // 핵심 결과
    document.getElementById('r-avgWage').textContent        = won(r.avgDailyWage);
    document.getElementById('r-serviceYears').textContent   = r.svc.taxYears + '년 (세법 기준)';
    document.getElementById('r-serviceYearsSub').textContent = '실 재직: ' + r.svc.readable;
    document.getElementById('r-severancePay').textContent   = won(r.severancePay);
    document.getElementById('r-totalTax').textContent       = won(r.totalTax);
    document.getElementById('r-taxRate').textContent        =
      '실효세율 ' + ((r.totalTax / r.severancePay) * 100).toFixed(2) + '%';
    document.getElementById('r-netAmount').textContent      = won(r.netAmount);
  
    // 세금 계산 단계
    document.getElementById('bd-tenureYearsLabel').textContent   = `(${r.svc.taxYears}년 적용)`;
    document.getElementById('bd-income').textContent             = won(r.retirementIncome);
    document.getElementById('bd-tenureDeduction').textContent    = '− ' + won(r.tenureDeduction);
    document.getElementById('bd-converted').textContent          = won(r.convertedSalary);
    document.getElementById('bd-convertedDeduction').textContent = '− ' + won(r.convertedDeduction);
    document.getElementById('bd-taxBase').textContent            = won(r.taxBase);
    document.getElementById('bd-convertedTax').textContent       = won(r.convertedTax);
    document.getElementById('bd-incomeTax').textContent          = won(r.incomeTax);
    document.getElementById('bd-localTax').textContent           = won(r.localTax);
    document.getElementById('bd-totalTax').textContent           = won(r.totalTax);
  
    // 차트
    renderChart(r.severancePay, r.totalTax, r.netAmount);
  
    // 결과 영역 표시 & 스크롤
    const el = document.getElementById('results');
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  
  
  /* ═══════════════════════════════════════════════════════════
     CALCULATE — 진입점
     ═══════════════════════════════════════════════════════════ */
  
  function calculate() {
    const startDate = document.getElementById('startDate').value;
    const endDate   = document.getElementById('endDate').value;
    const salary    = getSalaryRawValue();
    const days      = parseFloat(document.getElementById('totalDays').value);
  
    if (!validate(startDate, endDate, salary, days)) return;
  
    const result = calcAll(startDate, endDate, salary, days);
    renderResults(result);
  }