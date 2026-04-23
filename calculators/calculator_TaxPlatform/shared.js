

// shared.js 상단에 버전 주석 달아두기

/**
 * ⚠️ 연도별 세법 체크리스트
 *
 * 매년 확인 항목:
 * □ TAX_BRACKETS — 세율 구간 (2~3년 주기)
 * □ earnedIncomeDeduction — 근로소득공제 한도
 * □ earnedTaxCredit — 세액공제 한도 (총급여 구간별)
 * □ pensionIncomeDeduction — 연금소득공제
 * □ personalDeduction — 기본공제 1인당 금액
 *
 * 소득 유형별:
 * □ daily.html    DED_PER_DAY (일용직 비과세)
 * □ financial.html THRESHOLD  (금융소득 2천만)
 * □ other.html    THRESHOLD   (기타소득 300만)
 * □ business.html BIZ_RATES   (업종별 경비율, 국세청 고시)
 *
 * Last updated: 2024-01-01
 */



/**
 * shared.js — 세무 계산 플랫폼 공통 엔진 v1.0
 * 2024년 소득세법 기준
 * caboojoy-calculators / calculator_TaxPlatform
 */

'use strict';

// ════════════════════════════════════════════════
// 1. 2024년 종합소득세 세율표 (누진공제 방식)
// ════════════════════════════════════════════════
const TAX_BRACKETS = [
  { limit:    14_000_000, rate: 0.06, deduction:          0 },
  { limit:    50_000_000, rate: 0.15, deduction:  1_260_000 },
  { limit:    88_000_000, rate: 0.24, deduction:  5_760_000 },
  { limit:   150_000_000, rate: 0.35, deduction: 15_440_000 },
  { limit:   300_000_000, rate: 0.38, deduction: 19_940_000 },
  { limit:   500_000_000, rate: 0.40, deduction: 25_940_000 },
  { limit: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { limit:      Infinity, rate: 0.45, deduction: 65_940_000 },
];

// ════════════════════════════════════════════════
// 2. 소득 유형 메타데이터
// ════════════════════════════════════════════════
const INCOME_TYPES = {
  earned:   { label: '근로소득',   emoji: '💼', color: '#3B82F6', file: 'earned.html'   },
  daily:    { label: '일용직소득', emoji: '🔨', color: '#8B5CF6', file: 'daily.html'    },
  business: { label: '사업소득',   emoji: '🏢', color: '#10B981', file: 'business.html' },
  financial:{ label: '금융소득',   emoji: '💰', color: '#F59E0B', file: 'financial.html'},
  transfer: { label: '양도소득',   emoji: '🏠', color: '#EF4444', file: 'transfer.html' },
  pension:  { label: '연금소득',   emoji: '🎯', color: '#6366F1', file: 'pension.html'  },
  other:    { label: '기타소득',   emoji: '📋', color: '#EC4899', file: 'other.html'    },
};

// ════════════════════════════════════════════════
// 3. 핵심 세금 계산 함수
// ════════════════════════════════════════════════
const TaxEngine = {

  /** 누진세율 적용 */
  progressiveTax(taxableIncome) {
    if (taxableIncome <= 0) return 0;
    for (const b of TAX_BRACKETS) {
      if (taxableIncome <= b.limit) {
        return Math.max(0, Math.floor(taxableIncome * b.rate - b.deduction));
      }
    }
    return 0;
  },

  /** 적용 세율 구간 텍스트 */
  bracketLabel(taxableIncome) {
    if (taxableIncome <= 0) return '—';
    for (const b of TAX_BRACKETS) {
      if (taxableIncome <= b.limit) return `${(b.rate * 100).toFixed(0)}%`;
    }
    return '45%';
  },

  /** 근로소득공제 (2024) */
  earnedIncomeDeduction(wage) {
    if (wage <= 5_000_000)   return Math.floor(wage * 0.70);
    if (wage <= 15_000_000)  return Math.floor(3_500_000 + (wage - 5_000_000) * 0.40);
    if (wage <= 45_000_000)  return Math.floor(7_500_000 + (wage - 15_000_000) * 0.15);
    if (wage <= 100_000_000) return Math.floor(12_000_000 + (wage - 45_000_000) * 0.05);
    return 14_750_000;
  },

  /** 연금소득공제 (2024) */
  pensionIncomeDeduction(pension) {
    if (pension <= 3_500_000)  return pension;
    if (pension <= 7_000_000)  return Math.floor(3_500_000 + (pension - 3_500_000) * 0.40);
    if (pension <= 14_000_000) return Math.floor(4_900_000 + (pension - 7_000_000) * 0.20);
    if (pension <= 21_000_000) return Math.floor(6_300_000 + (pension - 14_000_000) * 0.10);
    if (pension <= 28_000_000) return Math.floor(7_000_000 + (pension - 21_000_000) * 0.05);
    return 7_350_000;
  },

  /** 근로소득세액공제 */
  earnedTaxCredit(calculatedTax, totalWage) {
    let credit;
    if (calculatedTax <= 1_300_000) {
      credit = Math.floor(calculatedTax * 0.55);
    } else {
      credit = Math.floor(715_000 + (calculatedTax - 1_300_000) * 0.30);
    }
    const limit = totalWage <= 33_000_000 ? 740_000
                : totalWage <= 70_000_000 ? 660_000
                : 500_000;
    return Math.min(credit, limit);
  },

  /** 기본공제 계산 */
  personalDeduction(self = 1, spouse = 0, dependents = 0) {
    return (self + spouse + dependents) * 1_500_000;
  },

  /** 장기보유특별공제율 (일반 부동산) */
  longTermDeductionRate(yearsHeld) {
    if (yearsHeld < 3) return 0;
    if (yearsHeld < 4) return 0.06;
    if (yearsHeld < 5) return 0.08;
    if (yearsHeld < 6) return 0.10;
    if (yearsHeld < 7) return 0.12;
    if (yearsHeld < 8) return 0.14;
    if (yearsHeld < 9) return 0.16;
    if (yearsHeld < 10) return 0.18;
    if (yearsHeld < 11) return 0.20;
    if (yearsHeld < 12) return 0.22;
    if (yearsHeld < 13) return 0.24;
    if (yearsHeld < 14) return 0.26;
    if (yearsHeld < 15) return 0.28;
    return 0.30; // 15년 이상 최대 30%
  },
};

// ════════════════════════════════════════════════
// 4. localStorage 저장소 관리
// ════════════════════════════════════════════════
const TaxStorage = {
  KEY: 'caboojoy_tax_v1',

  save(type, result) {
    const all = this.getAll();
    all[type] = { ...result, savedAt: new Date().toISOString() };
    localStorage.setItem(this.KEY, JSON.stringify(all));
    // 다른 탭/페이지에 변경 알림
    window.dispatchEvent(new CustomEvent('taxDataUpdated', { detail: { type } }));
  },

  get(type) {
    return this.getAll()[type] || null;
  },

  getAll() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || {}; }
    catch { return {}; }
  },

  remove(type) {
    const all = this.getAll();
    delete all[type];
    localStorage.setItem(this.KEY, JSON.stringify(all));
  },

  clearAll() {
    localStorage.removeItem(this.KEY);
  }
};

// ════════════════════════════════════════════════
// 5. 공통 결과 데이터 구조 생성
// ════════════════════════════════════════════════
/**
 * @param {string}  type           - 소득 유형 키
 * @param {number}  income         - 총 수입금액
 * @param {number}  taxableIncome  - 과세표준 (또는 종합과세 합산용 금액)
 * @param {number}  tax            - 산출(결정)세액
 * @param {boolean} comprehensive  - 종합소득세 합산 대상 여부
 * @param {object}  details        - 계산 상세 내역
 */
function createTaxResult(type, income, taxableIncome, tax, comprehensive, details = {}) {
  return {
    type,
    income:         Math.round(income),
    taxable_income: Math.round(taxableIncome),
    tax:            Math.round(tax),
    comprehensive,
    details
  };
}

// ════════════════════════════════════════════════
// 6. 숫자/포맷 유틸리티
// ════════════════════════════════════════════════
const Fmt = {
  won(n) {
    if (n == null || isNaN(n)) return '—';
    return Math.round(n).toLocaleString('ko-KR') + '원';
  },
  eok(n) {
    n = Math.round(n);
    if (n >= 100_000_000) {
      const e = Math.floor(n / 100_000_000);
      const m = Math.floor((n % 100_000_000) / 10_000);
      return m > 0 ? `${e}억 ${m.toLocaleString()}만원` : `${e}억원`;
    }
    if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString()}만원`;
    return n.toLocaleString('ko-KR') + '원';
  },
  pct(n) { return (n * 100).toFixed(1) + '%'; },
  parse(str) {
    if (!str && str !== 0) return 0;
    return parseFloat(String(str).replace(/,/g, '')) || 0;
  },
};

/** 입력 필드에 자동 콤마 포맷 적용 */
function addCommaInput(el) {
  el.addEventListener('input', function () {
    const start = this.selectionStart;
    const raw = this.value.replace(/[^\d]/g, '');
    const fmt = raw ? parseInt(raw, 10).toLocaleString('ko-KR') : '';
    const diff = fmt.length - this.value.length;
    this.value = fmt;
    try { this.setSelectionRange(start + diff, start + diff); } catch (_) {}
  });
}

/** 저장된 소득 배지를 허브 페이지용으로 렌더 (재사용) */
function renderSavedBadge(type) {
  const saved = TaxStorage.get(type);
  if (!saved) return '';
  const d = new Date(saved.savedAt);
  const timeStr = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return `<span class="saved-badge">✓ 저장됨 (${timeStr})</span>`;
}
