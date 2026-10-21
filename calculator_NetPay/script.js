/* ==========================================
   네트제(세후보장) 급여 계산기 — script.js
   세후 실수령액(Net) → 세전 급여(Gross) 역산 + 회사 총 인건비
   ※ taxTable2026.js 를 먼저 로드해야 함
   ========================================== */

// ==========================================
// CONFIG — 연도별 요율·상하한 (로직 코드에 숫자 하드코딩 금지)
// ==========================================
const POLICY_UPDATED = '2026-10-21'; // 요율 마지막 검증일 — 매년 1월·7월 재확인

const RATE_CONFIG = {
  2026: {
    nationalPension: {
      // 출처: 국민연금공단 '국민연금 보험료 정보' 화면 캡처 (도겸 제공, 2026-10 확인)
      employeeRate: 0.0475,                         // 총 9.5%
      employerRate: 0.0475,
      baseTruncUnit: 1000,                          // 기준소득월액 1,000원 미만 절사 (예: 3,512,990 → 3,512,000)
      truncUnit: 1,                                 // 보험료 원 미만 절사 (공단 예시: 상한 313,025원 · 하한 19,475원)
      // 기준소득월액 상하한은 7월 기준으로 바뀜 → 기간별로 보관
      bands: [
        { from: '2026-01-01', to: '2026-06-30', min: 400000, max: 6370000 }, // CLAUDE.md 기준 (원문 미대조)
        { from: '2026-07-01', to: '2027-06-30', min: 410000, max: 6590000 }, // 공단 화면 확인
      ],
    },
    healthInsurance: {
      // 출처: 국민건강보험공단 '건강보험료 정보' 화면 캡처 (도겸 제공, 적용기간 2026.1~12)
      totalRate: 0.0719,
      employeeRate: 0.03595,                        // 총 7.19%
      employerRate: 0.03595,
      truncUnit: 10,                                // 10원 미만 절사 (명세서 샘플과 일치, 공단 상·하한액도 10원 단위)
      min: 280383,                                  // 보수월액 하한
      max: 127725730,                               // 보수월액 상한
      premiumMin: 10080,                            // 보험료 하한 (근로자·사업주 각각)
      premiumMax: 4591740,                          // 보험료 상한 (근로자·사업주 각각)
    },
    longTermCare: {
      // 장기요양보험료 = 건강보험료 × (장기요양보험료율 ÷ 건강보험료율)
      // 공단 화면: 보수월액 대비 0.9448% (근로자·사업주 각 0.4724%) → 건보료 대비 약 13.1405% (13.14%는 반올림값)
      rateOfIncome: 0.009448,
      truncUnit: 10,
    },
    employment: {
      truncUnit: 10,                                // TODO: 근로복지공단 절사 기준 원문 확인 (현재 명세서 샘플 기준 10원)
      employeeRate: 0.009,                          // 실업급여 근로자분
      employerRate: 0.009,                          // 실업급여 사업주분
      // 고용안정·직업능력개발사업 (사업주만 부담)
      employerExtra: {
        under150:         0.0025,                   // 150인 미만
        priority:         0.0045,                   // 150인 이상 우선지원대상기업
        between150and999: 0.0065,                   // 150인 이상 ~ 1,000인 미만
        over1000OrGov:    0.0085,                   // 1,000인 이상 · 국가/지방자치단체
      },
    },
    industrialAccident: {
      truncUnit: 10,                                // TODO: 근로복지공단 절사 기준 원문 확인
      defaultRatePercent: 0.9,                      // 기본값(일반 사무직 기준, 4대보험 계산기와 동일) — 업종별 고시 요율로 변경
    },
    incomeTax: {
      ratios: [0.8, 1.0, 1.2],                      // 근로자 선택 원천징수 비율
      truncUnit: 10,                                // 원천징수세액 10원 미만 절사
      localRate: 0.1,                               // 지방소득세 = 소득세 × 10%
      localTruncUnit: 10,                           // 지방소득세 10원 미만 절사
    },
    nonTaxable: { meal: 200000 },
  },
};

const TAX_TABLES = { 2026: TAX_TABLE_2026 };

const PAY_ROUND_UNITS = [1, 10, 100, 1000];

// 역산 보정 탐색 폭(원)
// - BOUNDARY: 이분탐색 결과 아래에서 간이세액표 구간 경계를 확인할 범위 (구간 폭 최대 2만원 + 세액 점프 회복분)
// - MICRO: 원 단위 절사·10원 절사로 생기는 미세한 실수령액 역전을 흡수할 범위
const REVERSE_BOUNDARY_WINDOW = 60000;
const REVERSE_MICRO_WINDOW = 200;   // 국민연금 기준소득월액 천원 절사(1,000원마다 약 47원 감소) 포함

const COMPANY_SIZE_LABELS = {
  under150:         '150인 미만',
  priority:         '150인 이상 우선지원대상기업',
  between150and999: '150인 이상 ~ 1,000인 미만',
  over1000OrGov:    '1,000인 이상 · 국가/지자체',
};

// ==========================================
// 유틸리티
// ==========================================

/**
 * 부동소수점 보정 후 원 단위 절사. 예: 3,000,000 × 0.009 (= 26,999.999…) → 27,000
 * ※ toFixed(2)로 정규화하면 4,750.9975 → '4751.00' → 4,751 처럼 1원이 올라가는 버그가 있어
 *   소수 6자리로 정규화한다. (요율은 소수 6자리 이내이므로 정확한 값이 보존됨)
 */
const FLOAT_NORMALIZE_DIGITS = 6;
const floorWon = (v) => Math.floor(Number(v.toFixed(FLOAT_NORMALIZE_DIGITS)));

/** unit(1/10/100…) 미만 절사 */
function truncTo(v, unit) {
  const w = floorWon(v);
  return w - (w % unit);
}

/** 콤마 제거 후 정수 반환 (빈 값/잘못된 값 → 0) */
function getSalaryRawValue(value) {
  const n = parseInt(String(value == null ? '' : value).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

function formatWon(n) {
  return Math.round(n).toLocaleString('ko-KR');
}

function pct(rate, digits) {
  return (rate * 100).toFixed(digits).replace(/\.?0+$/, '') + '%';
}

// ==========================================
// 기준 시점 → 요율·상하한 선택
// ==========================================

/** 'YYYY-MM' → 해당 연도 config와 국민연금 상하한 구간 */
function resolvePolicy(ym) {
  const year = parseInt(String(ym).slice(0, 4), 10);
  const cfg = RATE_CONFIG[year];
  const table = TAX_TABLES[year];
  if (!cfg || !table) throw new Error(`${year}년 요율 설정이 없습니다`);
  const date = `${ym}-01`; // ISO 문자열 비교 (Date 파싱 사용 안 함)
  if (table.effectiveFrom && date < table.effectiveFrom) {
    throw new Error(`${ym}은 간이세액표(${table.effectiveFrom} 시행) 적용 전입니다`);
  }
  const band = cfg.nationalPension.bands.find(b => b.from <= date && date <= b.to);
  if (!band) throw new Error(`${ym} 국민연금 상하한 구간이 없습니다`);
  return { year, cfg, table, band };
}

/** 선택 가능한 적용 시점 목록 (config 연도 안으로 구간을 잘라서 표시) */
function listPolicyPeriods() {
  const out = [];
  Object.keys(RATE_CONFIG).sort().forEach(y => {
    // 간이세액표 시행일 이전 기간은 제외
    const start = [`${y}-01-01`, (TAX_TABLES[y] && TAX_TABLES[y].effectiveFrom) || ''].sort().pop();
    RATE_CONFIG[y].nationalPension.bands.forEach(b => {
      const from = b.from > start ? b.from : start;
      const to   = b.to   < `${y}-12-31` ? b.to   : `${y}-12-31`;
      if (from > to) return;
      const m1 = parseInt(from.slice(5, 7), 10);
      const m2 = parseInt(to.slice(5, 7), 10);
      out.push({ value: from.slice(0, 7), label: `${y}년 ${m1}월 ~ ${m2}월` });
    });
  });
  return out;
}

// ==========================================
// 근로소득 간이세액표
// ==========================================

/** 8~20세 자녀 세액공제액 */
function childCredit(children, table) {
  const c = table.childCredit;
  if (children <= 0) return 0;
  if (children === 1) return c.one;
  return c.two + (children - 2) * c.perExtra;
}

/** 간이세액표 세액(자녀공제 전, 100% 기준) */
function lookupTableTax(taxable, family, table) {
  const fam = Math.max(family, 1);
  if (fam > table.maxFamily) {
    // 별표2 제4호: 11명 세액 − (10명 세액 − 11명 세액) × 초과 가족 수 (음수면 0)
    const t11 = lookupTableTax(taxable, table.maxFamily, table);
    const t10 = lookupTableTax(taxable, table.maxFamily - 1, table);
    return Math.max(0, t11 - (t10 - t11) * (fam - table.maxFamily));
  }
  if (taxable < table.minMonthly) return 0;
  const col = 2 + (fam - 1);
  const k = Math.floor(taxable / 1000); // 천원 단위
  const rows = table.rows;

  if (k < rows[rows.length - 1][1]) {
    // 구간 이분탐색: rows[i][0] <= k < rows[i][1]
    let lo = 0, hi = rows.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (k < rows[mid][0]) hi = mid - 1;
      else if (k >= rows[mid][1]) lo = mid + 1;
      else return rows[mid][col];
    }
    return 0;
  }

  const base10 = table.at10000[col - 2];
  const seg = table.over10000.find(s => taxable > s.from && taxable <= s.to);
  if (!seg) return base10; // 정확히 1,000만원
  return base10 + seg.base + floorWon((taxable - seg.from) * seg.payRatio * seg.rate);
}

/** 최종 원천징수 소득세 (자녀공제 → 선택비율 → 10원 미만 절사) */
function calcIncomeTax(taxable, family, children, ratio, table, taxCfg) {
  const tableTax = lookupTableTax(taxable, family, table);
  const credit = childCredit(children, table);
  const afterCredit = Math.max(0, tableTax - credit);
  return {
    tableTax,
    credit,
    incomeTax: truncTo(afterCredit * ratio, taxCfg.truncUnit),
  };
}

// ==========================================
// 4대보험 공통 (근로자·사업주 동일 규칙)
// ==========================================

/** 보험료 산정 기준: 국민연금 기준소득월액(1,000원 미만 절사 후 상하한), 건강보험 보수월액(상하한) */
function insuranceBases(taxable, cfg, band) {
  if (taxable <= 0) return { pensionBase: 0, healthBase: 0 };
  const np = cfg.nationalPension, h = cfg.healthInsurance;
  const truncated = taxable - (taxable % np.baseTruncUnit);
  const pensionBase = Math.min(Math.max(truncated, band.min), band.max);
  let healthBase = taxable;
  if (h.min != null) healthBase = Math.max(healthBase, h.min);
  if (h.max != null) healthBase = Math.min(healthBase, h.max);
  return { pensionBase, healthBase };
}

function pensionPremium(base, rate, cfg) {
  return truncTo(base * rate, cfg.nationalPension.truncUnit);
}

/** 건강보험료 (1인 부담분) — 10원 미만 절사 후 보험료 상·하한 적용 */
function healthPremium(base, rate, cfg) {
  if (base <= 0) return 0;
  const h = cfg.healthInsurance;
  // 보수월액 상한 이상 → 고시된 보험료 상한액 그대로 (상한 보수월액 × 요율은 4,591,739.99원이라 절사하면 10원 모자람)
  if (h.max != null && h.premiumMax != null && base >= h.max) return h.premiumMax;
  let p = truncTo(base * rate, h.truncUnit);
  if (h.premiumMin != null) p = Math.max(p, h.premiumMin);
  if (h.premiumMax != null) p = Math.min(p, h.premiumMax);
  return p;
}

/** 장기요양보험료 = 건강보험료 × (장기요양보험료율 ÷ 건강보험료율) */
function ltcPremium(health, cfg) {
  const l = cfg.longTermCare;
  return truncTo(health * l.rateOfIncome / cfg.healthInsurance.totalRate, l.truncUnit);
}

/** 화면 표시용: 건보료 대비 장기요양 비율 */
function ltcRatioOfHealth(cfg) {
  return cfg.longTermCare.rateOfIncome / cfg.healthInsurance.totalRate;
}

// ==========================================
// 1. 정방향 (Gross → Net) — 모든 계산의 기준 함수
// ==========================================
/**
 * @param {number} gross 세전 월급여(원, 정수)
 * @param {object} o { ym, nonTaxable, family, children, taxRatio }
 */
function forward(gross, o) {
  const { cfg, table, band } = o.policy || resolvePolicy(o.ym);

  const nonTaxable = Math.min(Math.max(o.nonTaxable || 0, 0), gross); // 비과세가 급여보다 크면 급여까지만
  const taxable = gross - nonTaxable;

  const { pensionBase, healthBase } = insuranceBases(taxable, cfg, band);
  const pension    = pensionPremium(pensionBase, cfg.nationalPension.employeeRate, cfg);
  const health     = healthPremium(healthBase, cfg.healthInsurance.employeeRate, cfg);
  const ltc        = ltcPremium(health, cfg);
  const employment = truncTo(taxable * cfg.employment.employeeRate, cfg.employment.truncUnit);
  const insuranceTotal = pension + health + ltc + employment;

  const tax = calcIncomeTax(taxable, o.family, o.children, o.taxRatio, table, cfg.incomeTax);
  const localTax = truncTo(tax.incomeTax * cfg.incomeTax.localRate, cfg.incomeTax.localTruncUnit);

  const deductionTotal = insuranceTotal + tax.incomeTax + localTax;

  return {
    gross, nonTaxable, taxable, pensionBase, healthBase,
    pension, health, ltc, employment, insuranceTotal,
    tableTax: tax.tableTax, childCredit: tax.credit,
    incomeTax: tax.incomeTax, localTax,
    deductionTotal,
    net: gross - deductionTotal,
  };
}

// ==========================================
// 2. 역방향 (Net → Gross) — 이분탐색
// ==========================================

/** 실수령액이 계단식으로 떨어질 수 있는 세전 급여 지점 = 간이세액표 구간 시작점 + 비과세 */
function taxBoundariesInGross(opts) {
  const table = opts.policy.table;
  const nonTax = Math.max(opts.nonTaxable || 0, 0);
  const list = table.rows.map(r => r[0] * 1000 + nonTax);
  list.push(table.rows[table.rows.length - 1][1] * 1000 + nonTax);
  return list;
}

/** ok(lo)=false, ok(hi)=true 인 구간에서 경계점 이분탐색 */
function bisect(lo, hi, ok) {
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

/**
 * 이분탐색은 net이 단조 증가할 때만 '최소' gross를 보장한다.
 * 간이세액표 구간 경계에서 세액이 한 번에 뛰면 net이 줄어드는 지점이 생기므로,
 * g0(이분탐색 결과) 아래에 더 작은 해가 있는지 확인한다.
 *  ① g0 아래 BOUNDARY 범위의 각 구간 경계 직전(MICRO 범위)에서 목표 충족 여부 확인
 *     → 충족하면 그 구간 안에서 다시 이분탐색 (작은 경계부터 확인하므로 처음 찾은 것이 최소)
 *  ② 없으면 g0 바로 아래 MICRO 범위를 1원씩 확인 (절사로 인한 미세 역전)
 */
function refineMinGross(g0, floorGross, ok, opts) {
  const windowStart = Math.max(floorGross, g0 - REVERSE_BOUNDARY_WINDOW);
  const microScan = (from, to) => { // [from, to) 에서 처음 충족하는 g
    for (let g = Math.max(floorGross, from); g < to; g++) if (ok(g)) return g;
    return null;
  };
  // 작은 역전 구간(MICRO 이하)을 건너뛰며 아래로 내려가 최소 해를 찾는다
  const descend = (g) => {
    for (let s = microScan(g - REVERSE_MICRO_WINDOW, g); s !== null; s = microScan(g - REVERSE_MICRO_WINDOW, g)) g = s;
    return g;
  };
  const bounds = taxBoundariesInGross(opts).filter(b => b > windowStart && b <= g0);
  let segStart = windowStart;
  for (const b of bounds) {
    const hit = microScan(b - REVERSE_MICRO_WINDOW, b);
    if (hit !== null) {
      const lo = Math.max(floorGross, segStart) - 1;
      const first = (lo >= floorGross && ok(lo)) ? microScan(segStart, hit) : bisect(lo, hit, ok);
      return descend(first);
    }
    segStart = b;
  }
  return descend(g0);
}
/**
 * forward(g).net >= targetNet 을 만족하는 최소 gross를 찾고,
 * 지급 단위(roundUnit) 올림 후에도 목표를 만족하는지 재검증한다.
 */
function reverse(targetNet, o) {
  const opts = Object.assign({}, o, { policy: o.policy || resolvePolicy(o.ym) });
  const ok = (g) => forward(g, opts).net >= targetNet;

  // 공제액 ≥ 0 이므로 gross ≥ net. 따라서 하한 = 목표 Net
  let lo = Math.max(0, Math.floor(targetNet));
  let minGross;
  if (ok(lo)) {
    minGross = lo;
  } else {
    let hi = Math.max(lo * 2, 1000);
    while (!ok(hi)) { lo = hi; hi *= 2; }
    // 불변식: ok(lo) = false, ok(hi) = true
    hi = bisect(lo, hi, ok);
    minGross = refineMinGross(hi, Math.floor(targetNet), ok, opts);
  }

  // 지급 단위 올림 — 올린 값이 경계를 넘어 목표 미달이면 다음 단위로
  const unit = PAY_ROUND_UNITS.includes(o.roundUnit) ? o.roundUnit : 1;
  let paid = Math.ceil(minGross / unit) * unit;
  while (!ok(paid)) paid += unit;

  const result = forward(paid, opts);
  return {
    targetNet,
    minGross,
    gross: paid,
    result,
    diff: result.net - targetNet, // 목표 대비 초과 수령액 (≥ 0)
  };
}

// ==========================================
// 3. 회사 부담 총 인건비
// ==========================================
/**
 * @param {object} f forward() 결과
 * @param {object} o { ym, companySize, accidentRatePercent }
 */
function employerCost(f, o) {
  const { cfg } = o.policy || resolvePolicy(o.ym);
  const empUnit = cfg.employment.truncUnit;

  const extraRate = cfg.employment.employerExtra[o.companySize];
  if (extraRate == null) throw new Error('회사 규모 선택이 올바르지 않습니다');
  const accidentRate = (o.accidentRatePercent || 0) / 100;

  const pension         = pensionPremium(f.pensionBase, cfg.nationalPension.employerRate, cfg);
  const health          = healthPremium(f.healthBase, cfg.healthInsurance.employerRate, cfg);
  const ltc             = ltcPremium(health, cfg);
  const unemployment    = truncTo(f.taxable * cfg.employment.employerRate, empUnit);
  const employmentExtra = truncTo(f.taxable * extraRate, empUnit);
  const accident        = truncTo(f.taxable * accidentRate, cfg.industrialAccident.truncUnit);
  const insuranceTotal  = pension + health + ltc + unemployment + employmentExtra + accident;

  return {
    pension, health, ltc, unemployment, employmentExtra, accident,
    employment: unemployment + employmentExtra,
    extraRate, accidentRate,
    insuranceTotal,
    totalCost: f.gross + insuranceTotal,
  };
}

/** 정방향 + 역산 + 회사부담을 한 번에 */
function calculateNetPay(input) {
  const policy = resolvePolicy(input.ym);
  const o = Object.assign({}, input, { policy });
  const rev = reverse(input.targetNet, o);
  const emp = employerCost(rev.result, o);
  return { input, policy, rev, emp };
}

/** 입력값 검증 — { 필드: 오류 메시지 } 반환 (빈 객체 = 정상) */
function validateInput(input) {
  const errors = {};
  if (!(input.targetNet > 0)) errors.targetNet = '목표 세후 월급을 입력해주세요';
  if (input.nonTaxable < 0) errors.nonTaxable = '비과세 금액이 올바르지 않습니다';
  if (!(input.family >= 1)) errors.family = '공제대상 가족 수는 본인 포함 1명 이상입니다';
  if (input.children < 0 || input.children > input.family - 1) {
    errors.children = '8~20세 자녀 수는 (공제대상 가족 수 − 1) 이하여야 합니다';
  }
  if (!Number.isFinite(input.accidentRatePercent) || input.accidentRatePercent < 0 || input.accidentRatePercent >= 100) {
    errors.accident = '산재보험 요율(%)을 올바르게 입력해주세요';
  }
  return errors;
}

// Node 테스트용 내보내기
if (typeof module !== 'undefined') {
  module.exports = { RATE_CONFIG, POLICY_UPDATED, forward, reverse, employerCost, calculateNetPay, lookupTableTax, childCredit, resolvePolicy, listPolicyPeriods, floorWon, truncTo, getSalaryRawValue };
}

// ==========================================
// UI
// ==========================================
if (typeof document !== 'undefined' && document.getElementById('net-input')) {
  (function initUI() {
    const $ = (id) => document.getElementById(id);
    let donutChart = null;
    let timer = null;

    /** 입력 중 천 단위 콤마 (커서 위치 보존) */
    function applyThousands(el) {
      const raw = el.value.replace(/[^0-9]/g, '');
      const formatted = raw ? parseInt(raw, 10).toLocaleString('ko-KR') : '';
      const prevLen = el.value.length;
      const cursor = el.selectionStart == null ? prevLen : el.selectionStart;
      el.value = formatted;
      const next = Math.max(0, cursor + (formatted.length - prevLen));
      try { el.setSelectionRange(next, next); } catch (e) { /* 일부 브라우저 무시 */ }
    }

    // ── 선택 옵션 채우기 ──
    const periods = listPolicyPeriods();
    $('period-select').innerHTML = periods.map(p => `<option value="${p.value}">${p.label}</option>`).join('');
    // 오늘 날짜가 속한 구간을 기본 선택 (없으면 마지막 구간)
    const now = new Date();
    const todayYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const current = periods.filter(p => p.value <= todayYm).pop() || periods[periods.length - 1];
    $('period-select').value = current.value;

    $('family-select').innerHTML = Array.from({ length: 15 }, (_, i) =>
      `<option value="${i + 1}">${i + 1}명${i === 0 ? ' (본인만)' : ''}</option>`).join('');
    $('children-select').innerHTML = Array.from({ length: 11 }, (_, i) =>
      `<option value="${i}">${i}명</option>`).join('');

    function fillCompanySize() {
      const cfg = resolvePolicy($('period-select').value).cfg;
      const prev = $('company-select').value || 'under150';
      $('company-select').innerHTML = Object.keys(cfg.employment.employerExtra).map(k =>
        `<option value="${k}">${COMPANY_SIZE_LABELS[k] || k} (${pct(cfg.employment.employerExtra[k], 2)})</option>`).join('');
      $('company-select').value = cfg.employment.employerExtra[prev] != null ? prev : 'under150';
    }
    fillCompanySize();

    const cfg0 = resolvePolicy(current.value).cfg;
    $('nontax-input').value = cfg0.nonTaxable.meal.toLocaleString('ko-KR');
    $('accident-input').value = String(cfg0.industrialAccident.defaultRatePercent);
    $('policy-updated').textContent = POLICY_UPDATED;

    // ── 이벤트 ──
    ['net-input', 'nontax-input'].forEach(id => {
      $(id).addEventListener('input', (e) => { applyThousands(e.target); schedule(); });
    });
    $('accident-input').addEventListener('input', schedule);
    ['family-select', 'children-select', 'company-select', 'round-select'].forEach(id => {
      $(id).addEventListener('change', calculate);
    });
    $('period-select').addEventListener('change', () => { fillCompanySize(); calculate(); });
    document.querySelectorAll('[data-ratio]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-ratio]').forEach(b => b.classList.toggle('active', b === btn));
        calculate();
      });
    });
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        $('net-input').value = parseInt(btn.dataset.preset, 10).toLocaleString('ko-KR');
        calculate();
      });
    });

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(calculate, 120);
    }

    function readInput() {
      const ratioBtn = document.querySelector('[data-ratio].active');
      return {
        targetNet: getSalaryRawValue($('net-input').value),
        nonTaxable: getSalaryRawValue($('nontax-input').value),
        family: parseInt($('family-select').value, 10),
        children: parseInt($('children-select').value, 10),
        taxRatio: ratioBtn ? parseFloat(ratioBtn.dataset.ratio) : 1,
        ym: $('period-select').value,
        companySize: $('company-select').value,
        accidentRatePercent: $('accident-input').value.trim() === '' ? 0 : Number($('accident-input').value.trim()),
        roundUnit: parseInt($('round-select').value, 10),
      };
    }

    function showErrors(errors) {
      document.querySelectorAll('.input-error').forEach(el => {
        const msg = errors[el.dataset.for];
        el.textContent = msg || '';
        el.classList.toggle('show', !!msg);
      });
    }

    function calculate() {
      const input = readInput();
      const errors = validateInput(input);
      const hasValue = input.targetNet > 0;
      if (!hasValue) delete errors.targetNet; // 빈 입력은 오류 대신 안내 화면
      showErrors(errors);

      if (!hasValue || Object.keys(errors).length) {
        $('results').hidden = true;
        $('empty-state').hidden = false;
        $('empty-state').textContent = hasValue
          ? '입력값을 확인해주세요'
          : '받기로 한 세후 월급을 입력하면 필요한 세전 급여가 계산됩니다';
        return;
      }
      render(calculateNetPay(input));
    }

    function row(label, value, cls, sub) {
      return `<tr class="${cls || ''}"><td>${label}${sub ? `<span class="row-sub">${sub}</span>` : ''}</td><td class="num">${value}</td></tr>`;
    }

    function render(out) {
      const { input, policy, rev, emp } = out;
      const f = rev.result;
      const cfg = policy.cfg;
      $('results').hidden = false;
      $('empty-state').hidden = true;

      // ── 히어로 ──
      $('gross-value').textContent = formatWon(rev.gross);
      $('gross-annual').textContent = formatWon(rev.gross * 12);
      $('verify-net').textContent = formatWon(f.net);
      $('verify-target').textContent = formatWon(input.targetNet);
      $('verify-diff').textContent = rev.diff === 0 ? '목표와 정확히 일치' : `목표 대비 +${formatWon(rev.diff)}원`;
      $('verify-diff').classList.toggle('exact', rev.diff === 0);
      $('min-gross-note').textContent = rev.minGross !== rev.gross
        ? `이론상 최소 세전 ${formatWon(rev.minGross)}원 → ${formatWon(input.roundUnit)}원 단위 올림 지급`
        : '';
      $('total-cost-value').textContent = formatWon(emp.totalCost);

      // ── 공제 내역 ──
      const bandNote = f.taxable > 0 && f.pensionBase !== f.taxable
        ? ` · 기준소득월액 ${f.pensionBase === policy.band.max ? '상한 ' : f.pensionBase === policy.band.min ? '하한 ' : ''}${formatWon(f.pensionBase)}원${f.pensionBase !== policy.band.max && f.pensionBase !== policy.band.min ? ' (천원 미만 절사)' : ' 적용'}` : '';
      const taxSub = `간이세액표 ${formatWon(f.tableTax)}원`
        + (f.childCredit ? ` − 자녀공제 ${formatWon(f.childCredit)}원` : '')
        + (input.taxRatio !== 1 ? ` × ${Math.round(input.taxRatio * 100)}%` : '');
      $('deduction-table').innerHTML = `
        <tbody>
          ${row('세전 급여', formatWon(f.gross) + '원', 'strong')}
          ${row('비과세 (식대 등)', formatWon(f.nonTaxable) + '원', 'muted')}
          ${row('과세 급여', formatWon(f.taxable) + '원', 'muted')}
          ${row('국민연금', '−' + formatWon(f.pension), '', pct(cfg.nationalPension.employeeRate, 3) + bandNote)}
          ${row('건강보험', '−' + formatWon(f.health), '', pct(cfg.healthInsurance.employeeRate, 3))}
          ${row('장기요양보험', '−' + formatWon(f.ltc), '', '건강보험료 × ' + pct(cfg.longTermCare.rateOfIncome, 4) + ' ÷ ' + pct(cfg.healthInsurance.totalRate, 2))}
          ${row('고용보험', '−' + formatWon(f.employment), '', pct(cfg.employment.employeeRate, 2))}
          ${row('소득세', '−' + formatWon(f.incomeTax), '', taxSub)}
          ${row('지방소득세', '−' + formatWon(f.localTax), '', '소득세 × ' + pct(cfg.incomeTax.localRate, 0))}
          ${row('공제 합계', '−' + formatWon(f.deductionTotal) + '원', 'total')}
          ${row('실수령액 (검증)', formatWon(f.net) + '원', 'net')}
        </tbody>`;

      // ── 근로자 vs 회사 비교 ──
      const cmp = [
        ['국민연금', f.pension, emp.pension],
        ['건강보험', f.health, emp.health],
        ['장기요양', f.ltc, emp.ltc],
        ['고용보험 (실업급여)', f.employment, emp.unemployment],
        [`고용안정·직능 (${pct(emp.extraRate, 2)})`, 0, emp.employmentExtra],
        [`산재보험 (${pct(emp.accidentRate, 3)})`, 0, emp.accident],
        ['소득세 + 지방소득세', f.incomeTax + f.localTax, 0],
      ];
      const cell = (v) => v ? formatWon(v) : '—';
      $('compare-table').innerHTML = `
        <thead><tr><th>항목</th><th>근로자</th><th>회사</th></tr></thead>
        <tbody>
          ${cmp.map(([n, w, c]) => `<tr><td>${n}</td><td class="num worker">${cell(w)}</td><td class="num employer">${cell(c)}</td></tr>`).join('')}
          <tr class="total"><td>합계</td><td class="num worker">${formatWon(f.deductionTotal)}</td><td class="num employer">${formatWon(emp.insuranceTotal)}</td></tr>
        </tbody>`;

      $('cost-breakdown').innerHTML = `
        <div class="cost-line"><span>세전 급여</span><span class="num">${formatWon(f.gross)}원</span></div>
        <div class="cost-line"><span>+ 회사 부담 4대보험·산재</span><span class="num">${formatWon(emp.insuranceTotal)}원</span></div>
        <div class="cost-line total"><span>= 월 총 인건비</span><span class="num">${formatWon(emp.totalCost)}원</span></div>
        <div class="cost-ratio">세후 ${formatWon(f.net)}원을 보장하려면 실수령액의 <b>${(emp.totalCost / f.net * 100).toFixed(1)}%</b>가 비용으로 듭니다</div>`;

      // ── 연간 환산 ──
      const annual = [
        ['세전 급여', f.gross * 12],
        ['근로자 공제 합계', f.deductionTotal * 12],
        ['실수령액', f.net * 12],
        ['회사 부담 보험료', emp.insuranceTotal * 12],
        ['총 인건비', emp.totalCost * 12],
      ];
      $('annual-grid').innerHTML = annual.map(([n, v], i) => `
        <div class="annual-item${i === 2 || i === 4 ? ' highlight' : ''}">
          <div class="annual-label">${n}</div>
          <div class="annual-value num">${formatWon(v)}</div>
        </div>`).join('');

      // ── 하단 기준 요율 ──
      $('basis-text').innerHTML = `
        적용 시점 ${$('period-select').selectedOptions[0].textContent} ·
        국민연금 ${pct(cfg.nationalPension.employeeRate, 3)} (기준소득월액 ${formatWon(policy.band.min)}~${formatWon(policy.band.max)}원) ·
        건강보험 ${pct(cfg.healthInsurance.employeeRate, 3)} · 장기요양 ${pct(cfg.longTermCare.rateOfIncome, 4)} (건보료×${pct(ltcRatioOfHealth(cfg), 2)}) ·
        건강보험 보수월액 ${formatWon(cfg.healthInsurance.min)}~${formatWon(cfg.healthInsurance.max)}원 ·
        고용보험 ${pct(cfg.employment.employeeRate, 2)} · 간이세액표 ${policy.table.version} 시행분`;

      renderChart(f);
    }

    function renderChart(f) {
      if (typeof Chart === 'undefined') return; // CDN 로드 실패 시 차트 생략
      const data = [f.net, f.insuranceTotal, f.incomeTax + f.localTax];
      const labels = ['실수령액', '4대보험', '소득세·지방세'];
      const colors = ['#2196c9', '#7cc4ea', '#f0a868'];
      $('donut-pct').textContent = (f.net / f.gross * 100).toFixed(1) + '%';
      $('donut-legend').innerHTML = labels.map((l, i) =>
        `<span class="legend-item"><span class="legend-dot" style="background:${colors[i]}"></span>${l} ${formatWon(data[i])}원</span>`).join('');
      if (donutChart) {
        donutChart.data.datasets[0].data = data;
        donutChart.update();
        return;
      }
      donutChart = new Chart($('donut-chart').getContext('2d'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#ffffff', borderWidth: 3, hoverOffset: 6 }] },
        options: {
          cutout: '68%', responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => {
              const sum = c.dataset.data.reduce((x, y) => x + y, 0); // = 세전 급여
              return ` ${formatWon(c.raw)}원 (${(c.raw / sum * 100).toFixed(1)}%)`;
            } } },
          },
        },
      });
    }

    calculate();
  })();
}
