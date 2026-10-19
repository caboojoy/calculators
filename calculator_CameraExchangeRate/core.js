/* ══════════════════════════════════════════════
   카메라 환율 - core.js
   DOM 비의존 순수 로직 (브라우저: window.CamFXCore / Node: require)
   - 통화 목록·포맷: 기존 환율 계산기(script.js)에서 그대로 재사용
   ══════════════════════════════════════════════ */

(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.CamFXCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // ── 통화 목록 (기존 계산기 재사용) ─────────────────────────────────────────────
    const CURRENCIES = [
        { code: 'USD', flag: '🇺🇸', ko: '미국 달러',          en: 'US Dollar' },
        { code: 'EUR', flag: '🇪🇺', ko: '유로',               en: 'Euro' },
        { code: 'KRW', flag: '🇰🇷', ko: '한국 원',            en: 'South Korean Won' },
        { code: 'JPY', flag: '🇯🇵', ko: '일본 엔',            en: 'Japanese Yen' },
        { code: 'CNY', flag: '🇨🇳', ko: '중국 위안',          en: 'Chinese Yuan' },
        { code: 'GBP', flag: '🇬🇧', ko: '영국 파운드',        en: 'British Pound' },
        { code: 'AUD', flag: '🇦🇺', ko: '호주 달러',          en: 'Australian Dollar' },
        { code: 'CAD', flag: '🇨🇦', ko: '캐나다 달러',        en: 'Canadian Dollar' },
        { code: 'SGD', flag: '🇸🇬', ko: '싱가포르 달러',      en: 'Singapore Dollar' },
        { code: 'HKD', flag: '🇭🇰', ko: '홍콩 달러',          en: 'Hong Kong Dollar' },
        { code: 'THB', flag: '🇹🇭', ko: '태국 바트',          en: 'Thai Baht' },
        { code: 'VND', flag: '🇻🇳', ko: '베트남 동',          en: 'Vietnamese Dong' },
        { code: 'CHF', flag: '🇨🇭', ko: '스위스 프랑',        en: 'Swiss Franc' },
        { code: 'NZD', flag: '🇳🇿', ko: '뉴질랜드 달러',      en: 'New Zealand Dollar' },
        { code: 'MYR', flag: '🇲🇾', ko: '말레이시아 링깃',    en: 'Malaysian Ringgit' },
        { code: 'PHP', flag: '🇵🇭', ko: '필리핀 페소',        en: 'Philippine Peso' },
        { code: 'IDR', flag: '🇮🇩', ko: '인도네시아 루피아',  en: 'Indonesian Rupiah' },
        { code: 'INR', flag: '🇮🇳', ko: '인도 루피',          en: 'Indian Rupee' },
        { code: 'BRL', flag: '🇧🇷', ko: '브라질 헤알',        en: 'Brazilian Real' },
        { code: 'MXN', flag: '🇲🇽', ko: '멕시코 페소',        en: 'Mexican Peso' },
        { code: 'ZAR', flag: '🇿🇦', ko: '남아프리카 랜드',    en: 'South African Rand' },
        { code: 'SEK', flag: '🇸🇪', ko: '스웨덴 크로나',      en: 'Swedish Krona' },
        { code: 'NOK', flag: '🇳🇴', ko: '노르웨이 크로네',    en: 'Norwegian Krone' },
        { code: 'DKK', flag: '🇩🇰', ko: '덴마크 크로네',      en: 'Danish Krone' },
        { code: 'TRY', flag: '🇹🇷', ko: '터키 리라',          en: 'Turkish Lira' },
        { code: 'PLN', flag: '🇵🇱', ko: '폴란드 즈워티',      en: 'Polish Złoty' },
        { code: 'CZK', flag: '🇨🇿', ko: '체코 코루나',        en: 'Czech Koruna' },
        { code: 'HUF', flag: '🇭🇺', ko: '헝가리 포린트',      en: 'Hungarian Forint' },
        { code: 'AED', flag: '🇦🇪', ko: '아랍에미리트 디르함', en: 'UAE Dirham' },
        { code: 'SAR', flag: '🇸🇦', ko: '사우디 리얄',        en: 'Saudi Riyal' },
        { code: 'RUB', flag: '🇷🇺', ko: '러시아 루블',        en: 'Russian Ruble' },
        { code: 'ILS', flag: '🇮🇱', ko: '이스라엘 셰켈',      en: 'Israeli Shekel' },
        { code: 'TWD', flag: '🇹🇼', ko: '대만 달러',          en: 'Taiwan Dollar' },
        { code: 'PKR', flag: '🇵🇰', ko: '파키스탄 루피',      en: 'Pakistani Rupee' },
        { code: 'BDT', flag: '🇧🇩', ko: '방글라데시 타카',    en: 'Bangladeshi Taka' },
    ];
    const CODES = new Set(CURRENCIES.map(c => c.code));

    // 소수점 없이 표시할 통화 (기존 계산기 재사용)
    const NO_DECIMAL = new Set(['KRW', 'JPY', 'VND', 'IDR', 'HUF', 'CLP', 'COP', 'PKR', 'BDT']);

    // 수동 환율을 100단위로 입력/표시하는 통화
    const HUNDRED_UNIT = new Set(['JPY', 'VND', 'IDR']);

    const RATES_TTL        = 6 * 60 * 60 * 1000;       // 환율 캐시 6시간 (기존과 동일)
    const RATES_STALE_MS   = 24 * 60 * 60 * 1000;      // 24시간 초과 → 오래됨
    const MANUAL_STALE_MS  = 7 * 24 * 60 * 60 * 1000;  // 수동 환율 7일 경과 → 재확인
    const DEVIATION_LIMIT  = 20;                       // ±20% 초과 시 저장 전 확인
    const LOW_CONFIDENCE   = 0.6;
    const MAX_SECONDARY    = 3;
    const MAX_QTY          = 99;
    const MAX_AMOUNT       = 1e12;

    function isCode(code) {
        return typeof code === 'string' && CODES.has(code);
    }

    function getCurrency(code) {
        return CURRENCIES.find(c => c.code === code) || { code, flag: '🏳️', ko: code, en: code };
    }

    function rateUnit(code) {
        return HUNDRED_UNIT.has(code) ? 100 : 1;
    }

    // ── 포맷 (기존 formatDisplay 재사용) ──────────────────────────────────────────
    function formatDisplay(value, currencyCode) {
        if (value === null || value === undefined || isNaN(value)) return '—';
        if (value === 0) return NO_DECIMAL.has(currencyCode) ? '0' : '0.00';
        if (NO_DECIMAL.has(currencyCode)) {
            return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);
        }
        // 매우 작은 값은 더 많은 소수점
        const decimals = value < 0.01 ? 6 : value < 1 ? 4 : 2;
        return new Intl.NumberFormat('ko-KR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }).format(value);
    }

    // 반올림 단위(1/10/100)는 소수점 없는 통화에만 적용
    function roundForDisplay(value, currencyCode, unit) {
        if (!Number.isFinite(value)) return value;
        if (!NO_DECIMAL.has(currencyCode)) return value;
        const u = [1, 10, 100].includes(unit) ? unit : 1;
        return Math.round(value / u) * u;
    }

    function formatMoney(value, currencyCode, unit) {
        return `${formatDisplay(roundForDisplay(value, currencyCode, unit), currencyCode)} ${currencyCode}`;
    }

    // 환율 숫자 표시 (유효숫자 위주)
    function formatRate(value) {
        if (!Number.isFinite(value)) return '—';
        const decimals = value >= 100 ? 2 : value >= 1 ? 4 : 6;
        return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: decimals }).format(value);
    }

    // input 에 넣을 편집용 문자열 (천 단위 구분자 없음 → 재파싱 시 모호하지 않음)
    function formatEditable(value, currencyCode) {
        if (!Number.isFinite(value) || value <= 0) return '';
        if (NO_DECIMAL.has(currencyCode)) return String(Math.round(value));
        return String(Math.round(value * 100) / 100);
    }

    // ── 숫자 파싱 ────────────────────────────────────────────────────────────────
    /**
     * 가격표·사용자 입력의 다양한 표기를 숫자로.
     * - . 과 , 가 둘 다 있으면 마지막에 나온 것이 소수점
     * - 하나만 있을 때: 2회 이상 → 천 단위 / forceDecimal → 소수점 /
     *   소수점 없는 통화 → 천 단위 / 뒤 3자리 → 천 단위(정수부 0 이면 소수점) / 그 외 → 소수점
     * @returns {number} 실패 시 NaN
     */
    function parseLooseNumber(input, currency, opts) {
        const forceDecimal = !!(opts && opts.forceDecimal);
        if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? input : NaN;
        if (typeof input !== 'string') return NaN;

        // 공백·아포스트로피(CHF 1'234.50)는 천 단위 구분자로 취급해 제거
        let s = input.replace(/[\s  '’]/g, '');
        // 숫자·구분자 외(통화 기호, 문자)는 제거
        s = s.replace(/[^\d.,]/g, '');
        // 앞뒤에 붙은 구분자 정리 ("1,200." / ",50" 등)
        s = s.replace(/[.,]+$/, '');
        if (!/\d/.test(s)) return NaN;

        const lastDot = s.lastIndexOf('.');
        const lastComma = s.lastIndexOf(',');
        let normalized;

        if (lastDot !== -1 && lastComma !== -1) {
            const decSep = lastDot > lastComma ? '.' : ',';
            const thouSep = decSep === '.' ? ',' : '.';
            const idx = s.lastIndexOf(decSep);
            const intPart = s.slice(0, idx).split(thouSep).join('').split(decSep).join('');
            normalized = `${intPart}.${s.slice(idx + 1)}`;
        } else if (lastDot !== -1 || lastComma !== -1) {
            const sep = lastDot !== -1 ? '.' : ',';
            const parts = s.split(sep);
            const intPart = parts[0];
            const tail = parts[parts.length - 1];

            if (parts.length > 2) {
                normalized = parts.join('');                       // 같은 구분자 2회 이상 → 천 단위
            } else if (forceDecimal) {
                normalized = `${intPart}.${tail}`;
            } else if (NO_DECIMAL.has(currency)) {
                normalized = parts.join('');                       // JPY 등 → 천 단위
            } else if (tail.length === 3) {
                normalized = /^0*$/.test(intPart) ? `0.${tail}` : parts.join('');
            } else {
                normalized = `${intPart}.${tail}`;
            }
        } else {
            normalized = s;
        }

        if (normalized.startsWith('.')) normalized = '0' + normalized;
        const n = Number(normalized);
        return Number.isFinite(n) ? n : NaN;
    }

    // ── 통화 판별 ────────────────────────────────────────────────────────────────
    // 명시 표식 (긴 것부터 검사)
    const EXPLICIT_MARKERS = [
        ['US$', 'USD'], ['HK$', 'HKD'], ['NT$', 'TWD'], ['S$', 'SGD'], ['A$', 'AUD'],
        ['AU$', 'AUD'], ['C$', 'CAD'], ['CA$', 'CAD'], ['NZ$', 'NZD'], ['R$', 'BRL'],
        ['MX$', 'MXN'], ['RM', 'MYR'], ['Rp', 'IDR'], ['Kč', 'CZK'], ['zł', 'PLN'],
        ['Ft', 'HUF'], ['CHF', 'CHF'],
        ['円', 'JPY'], ['元', 'CNY'], ['人民币', 'CNY'], ['원', 'KRW'],
        ['€', 'EUR'], ['£', 'GBP'], ['₩', 'KRW'], ['฿', 'THB'], ['₫', 'VND'],
        ['₱', 'PHP'], ['₹', 'INR'], ['₺', 'TRY'], ['₪', 'ILS'], ['₽', 'RUB'], ['৳', 'BDT'],
    ];
    // 모호한 기호 → 여행지 통화 우선, 아니면 대표 통화
    const AMBIGUOUS = {
        '$': { set: ['USD', 'AUD', 'CAD', 'SGD', 'HKD', 'NZD', 'TWD', 'MXN'], fallback: 'USD' },
        '¥': { set: ['JPY', 'CNY'], fallback: 'JPY' },
        '￥': { set: ['JPY', 'CNY'], fallback: 'JPY' },
        'kr': { set: ['SEK', 'NOK', 'DKK'], fallback: 'SEK' },
    };

    /**
     * 문자열의 통화 표식 판별.
     * @returns {{currency: string, inferred: boolean}}
     */
    function detectCurrency(text, travel) {
        const s = String(text || '');
        const upper = s.toUpperCase();
        const travelCode = isCode(travel) ? travel : 'USD';

        // ISO 코드가 직접 적힌 경우
        const iso = upper.match(/(?:^|[^A-Z])([A-Z]{3})(?![A-Z])/);
        if (iso && isCode(iso[1])) return { currency: iso[1], inferred: false };

        for (const [marker, code] of EXPLICIT_MARKERS) {
            if (s.includes(marker)) return { currency: code, inferred: false };
        }
        for (const sym of Object.keys(AMBIGUOUS)) {
            if (s.includes(sym)) {
                const a = AMBIGUOUS[sym];
                return { currency: a.set.includes(travelCode) ? travelCode : a.fallback, inferred: true };
            }
        }
        // 표식 없음 → 여행지 통화로 가정
        return { currency: travelCode, inferred: true };
    }

    // ── 환율 ────────────────────────────────────────────────────────────────────
    function marketRate(rates, from, to) {
        if (!rates || !rates[from] || !rates[to]) return null;
        const r = rates[to] / rates[from];
        return Number.isFinite(r) && r > 0 ? r : null;
    }

    function manualKey(from, to) {
        return `${from}_${to}`;
    }

    function findManual(manual, from, to) {
        if (!manual) return null;
        const direct = manual[manualKey(from, to)];
        if (direct) return { rate: direct.rate, savedAt: direct.savedAt };
        const inverse = manual[manualKey(to, from)];
        if (inverse) return { rate: 1 / inverse.rate, savedAt: inverse.savedAt };
        return null;
    }

    function activeFeePct(settings) {
        const fees = (settings && settings.fees) || DEFAULT_SETTINGS.fees;
        const profile = settings && settings.feeProfile === 'cash' ? 'cash' : 'card';
        return fees[profile];
    }

    /**
     * 적용 환율 결정. 우선순위(고정): 수동(통화쌍 설정 시) > 시장×(1+수수료) > 시장 환율.
     * 수동 환율에는 수수료를 가산하지 않는다.
     * @returns {{rate:number, source:'same'|'manual'|'manual_fallback'|'fee'|'market', market:number|null,
     *            feePct?:number, savedAt?:number, stale:boolean} | null}
     */
    function resolveRate(ctx, from, to) {
        const { rates, settings } = ctx;
        const now = ctx.now || Date.now();
        if (from === to) return { rate: 1, source: 'same', market: 1, stale: false };

        const market = marketRate(rates, from, to);
        const mode = settings && settings.rateMode;

        if (mode === 'manual') {
            const m = findManual(settings.manual, from, to);
            if (m) {
                return { rate: m.rate, source: 'manual', market, savedAt: m.savedAt,
                         stale: now - m.savedAt > MANUAL_STALE_MS };
            }
            return market === null ? null : { rate: market, source: 'manual_fallback', market, stale: false };
        }
        if (market === null) return null;
        if (mode === 'fee') {
            const feePct = activeFeePct(settings);
            return { rate: market * (1 + feePct / 100), source: 'fee', market, feePct, stale: false };
        }
        return { rate: market, source: 'market', market, stale: false };
    }

    function convert(ctx, amount, from, to) {
        if (!Number.isFinite(amount)) return null;
        const info = resolveRate(ctx, from, to);
        if (!info) return null;
        return { value: amount * info.rate, info };
    }

    function ratesAreStale(ratesTimestamp, now) {
        if (!Number.isFinite(ratesTimestamp)) return true;
        return (now || Date.now()) - ratesTimestamp > RATES_STALE_MS;
    }

    /** 헤더 배지용: 여행지 → 기준 통화 적용 환율 요약 */
    function rateBadge(ctx) {
        const { settings } = ctx;
        const now = ctx.now || Date.now();
        const info = resolveRate(ctx, settings.travel, settings.base);
        const ratesStale = !!ctx.rates && ratesAreStale(ctx.ratesTimestamp, now);
        if (!info) return { kind: 'none', stale: false };
        const unit = rateUnit(settings.travel);
        const base = { from: settings.travel, to: settings.base, unit, value: info.rate * unit };
        switch (info.source) {
            case 'manual':
                return Object.assign(base, { kind: 'manual', stale: info.stale });
            case 'manual_fallback':
                return Object.assign(base, { kind: 'manual_fallback', stale: ratesStale });
            case 'fee':
                return Object.assign(base, { kind: 'fee', feePct: info.feePct,
                                             profile: settings.feeProfile, stale: ratesStale });
            case 'same':
                return Object.assign(base, { kind: 'same', stale: false });
            default:
                return Object.assign(base, { kind: 'market', stale: ratesStale });
        }
    }

    function deviationPct(rate, market) {
        if (!Number.isFinite(rate) || !Number.isFinite(market) || market <= 0) return null;
        return (rate / market - 1) * 100;
    }

    function needsDeviationConfirm(rate, market) {
        const d = deviationPct(rate, market);
        return d !== null && Math.abs(d) > DEVIATION_LIMIT;
    }

    /** 기준 통화로 지정된 수동 환율 중 7일 지난 것 */
    function staleManualEntries(settings, now) {
        const t = now || Date.now();
        return Object.keys(settings.manual || {})
            .filter(k => t - settings.manual[k].savedAt > MANUAL_STALE_MS);
    }

    // ── 설정 ────────────────────────────────────────────────────────────────────
    const SETTINGS_KEY = 'camfx_settings_v1';
    const DEFAULT_SETTINGS = Object.freeze({
        v: 1,
        lang: 'ko',
        base: 'KRW',
        travel: 'JPY',
        rateMode: 'auto',                       // 'auto' | 'fee' | 'manual'
        fees: Object.freeze({ card: 1.5, cash: 3 }), // 예시 기본값
        feeProfile: 'card',
        manual: Object.freeze({}),              // { 'JPY_KRW': { rate, savedAt } } rate = 1 단위당
        secondary: Object.freeze(['USD']),
        rounding: 1,
        showUnitPrice: true,
        autoCapture: false,
        onboarded: false,
    });

    function defaultSettings() {
        return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }

    function isPlainObject(v) {
        return v !== null && typeof v === 'object' && !Array.isArray(v);
    }

    /** 잘못된 값은 모두 기본값으로 정화 */
    function sanitizeSettings(raw, now) {
        const t = now || Date.now();
        const d = defaultSettings();
        if (!isPlainObject(raw)) return d;
        const out = d;

        if (raw.lang === 'ko' || raw.lang === 'en') out.lang = raw.lang;
        if (isCode(raw.base)) out.base = raw.base;
        if (isCode(raw.travel)) out.travel = raw.travel;
        if (['auto', 'fee', 'manual'].includes(raw.rateMode)) out.rateMode = raw.rateMode;
        if (raw.feeProfile === 'card' || raw.feeProfile === 'cash') out.feeProfile = raw.feeProfile;

        if (isPlainObject(raw.fees)) {
            for (const p of ['card', 'cash']) {
                const v = raw.fees[p];
                if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 20) out.fees[p] = v;
            }
        }

        if (isPlainObject(raw.manual)) {
            for (const key of Object.keys(raw.manual)) {
                const m = /^([A-Z]{3})_([A-Z]{3})$/.exec(key);
                const e = raw.manual[key];
                if (!m || !isCode(m[1]) || !isCode(m[2]) || m[1] === m[2] || !isPlainObject(e)) continue;
                if (typeof e.rate !== 'number' || !Number.isFinite(e.rate) || e.rate <= 0 || e.rate > 1e9) continue;
                if (typeof e.savedAt !== 'number' || !Number.isFinite(e.savedAt) || e.savedAt <= 0
                    || e.savedAt > t + 24 * 60 * 60 * 1000) continue;
                out.manual[key] = { rate: e.rate, savedAt: e.savedAt };
            }
        }

        if (Array.isArray(raw.secondary)) {
            const seen = new Set();
            out.secondary = raw.secondary
                .filter(c => isCode(c) && c !== out.base && !seen.has(c) && seen.add(c))
                .slice(0, MAX_SECONDARY);
        } else {
            out.secondary = out.secondary.filter(c => c !== out.base);
        }

        if ([1, 10, 100].includes(raw.rounding)) out.rounding = raw.rounding;
        if (typeof raw.showUnitPrice === 'boolean') out.showUnitPrice = raw.showUnitPrice;
        if (typeof raw.autoCapture === 'boolean') out.autoCapture = raw.autoCapture;
        if (typeof raw.onboarded === 'boolean') out.onboarded = raw.onboarded;
        return out;
    }

    /** 가져오기 검증: JSON 문자열 → {ok, settings} | {ok:false, error} */
    function parseImportedSettings(text, now) {
        let raw;
        try { raw = JSON.parse(text); } catch (_) { return { ok: false, error: 'json' }; }
        if (!isPlainObject(raw)) return { ok: false, error: 'shape' };
        if (raw.v !== 1) return { ok: false, error: 'version' };
        return { ok: true, settings: sanitizeSettings(raw, now) };
    }

    // ── 기기 언어/시간대 → 초기값 추정 (참고용) ─────────────────────────────────────
    const REGION_CURRENCY = {
        KR: 'KRW', JP: 'JPY', CN: 'CNY', TW: 'TWD', HK: 'HKD', US: 'USD', GB: 'GBP', AU: 'AUD',
        CA: 'CAD', SG: 'SGD', TH: 'THB', VN: 'VND', CH: 'CHF', NZ: 'NZD', MY: 'MYR', PH: 'PHP',
        ID: 'IDR', IN: 'INR', BR: 'BRL', MX: 'MXN', ZA: 'ZAR', SE: 'SEK', NO: 'NOK', DK: 'DKK',
        TR: 'TRY', PL: 'PLN', CZ: 'CZK', HU: 'HUF', AE: 'AED', SA: 'SAR', RU: 'RUB', IL: 'ILS',
        PK: 'PKR', BD: 'BDT',
        DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR',
        IE: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR',
        LT: 'EUR', HR: 'EUR', MT: 'EUR', CY: 'EUR',
    };
    const LANG_CURRENCY = {
        ko: 'KRW', ja: 'JPY', zh: 'CNY', th: 'THB', vi: 'VND', id: 'IDR', ms: 'MYR', tr: 'TRY',
        pl: 'PLN', cs: 'CZK', hu: 'HUF', ru: 'RUB', he: 'ILS', sv: 'SEK', nb: 'NOK', da: 'DKK',
        de: 'EUR', fr: 'EUR', it: 'EUR', es: 'EUR', nl: 'EUR', pt: 'EUR', fi: 'EUR', el: 'EUR',
    };
    const TZ_CURRENCY = {
        'Asia/Seoul': 'KRW', 'Asia/Tokyo': 'JPY', 'Asia/Shanghai': 'CNY', 'Asia/Chongqing': 'CNY',
        'Asia/Hong_Kong': 'HKD', 'Asia/Taipei': 'TWD', 'Asia/Bangkok': 'THB',
        'Asia/Ho_Chi_Minh': 'VND', 'Asia/Saigon': 'VND', 'Asia/Singapore': 'SGD',
        'Asia/Kuala_Lumpur': 'MYR', 'Asia/Manila': 'PHP', 'Asia/Jakarta': 'IDR',
        'Asia/Makassar': 'IDR', 'Asia/Kolkata': 'INR', 'Asia/Calcutta': 'INR', 'Asia/Dubai': 'AED',
        'Asia/Riyadh': 'SAR', 'Asia/Jerusalem': 'ILS', 'Asia/Karachi': 'PKR', 'Asia/Dhaka': 'BDT',
        'Europe/London': 'GBP', 'Europe/Zurich': 'CHF', 'Europe/Stockholm': 'SEK',
        'Europe/Oslo': 'NOK', 'Europe/Copenhagen': 'DKK', 'Europe/Istanbul': 'TRY',
        'Europe/Warsaw': 'PLN', 'Europe/Prague': 'CZK', 'Europe/Budapest': 'HUF',
        'Europe/Moscow': 'RUB', 'Pacific/Auckland': 'NZD', 'Africa/Johannesburg': 'ZAR',
        'America/Toronto': 'CAD', 'America/Vancouver': 'CAD', 'America/Mexico_City': 'MXN',
        'America/Sao_Paulo': 'BRL', 'Pacific/Guam': 'USD', 'Pacific/Saipan': 'USD',
        'Pacific/Honolulu': 'USD',
    };

    function guessDefaults(env) {
        const language = String((env && env.language) || '');
        const timeZone = String((env && env.timeZone) || '');
        const [langPart, regionPart] = language.replace('_', '-').split('-');
        const lang = langPart.toLowerCase() === 'ko' ? 'ko' : (langPart ? 'en' : 'ko');

        let base = (regionPart && REGION_CURRENCY[regionPart.toUpperCase()])
            || LANG_CURRENCY[langPart.toLowerCase()] || (langPart ? 'USD' : 'KRW');
        if (langPart.toLowerCase() === 'zh' && regionPart && REGION_CURRENCY[regionPart.toUpperCase()]) {
            base = REGION_CURRENCY[regionPart.toUpperCase()];
        }

        let travel = TZ_CURRENCY[timeZone];
        if (!travel) {
            if (timeZone.startsWith('Europe/')) travel = 'EUR';
            else if (timeZone.startsWith('Australia/')) travel = 'AUD';
            else if (timeZone.startsWith('America/')) travel = 'USD';
        }
        if (!travel || travel === base) travel = base === 'KRW' ? 'JPY' : (base === 'USD' ? 'EUR' : 'USD');
        return { lang, base, travel };
    }

    // ── 인식 결과 정규화 ──────────────────────────────────────────────────────────
    let idSeq = 0;
    function newId() {
        idSeq += 1;
        return `r${Date.now().toString(36)}${idSeq}`;
    }

    function clampQty(n) {
        const q = Math.round(Number(n));
        if (!Number.isFinite(q) || q < 1) return 1;
        return Math.min(q, MAX_QTY);
    }

    function validAmount(a) {
        return typeof a === 'number' && Number.isFinite(a) && a > 0 && a <= MAX_AMOUNT;
    }

    function cleanText(s, max) {
        if (typeof s !== 'string') return '';
        return s.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);
    }

    /**
     * 서버 응답 → 편집 가능한 행 목록
     * row: {id, kind, currency, amount, qty, label, inferred, lowConf, discounted, taxIncluded, unitPrice}
     */
    function normalizeRecognition(resp, opts) {
        const travel = isCode(opts && opts.travel) ? opts.travel : 'USD';
        const mode = resp && resp.mode === 'cash' ? 'cash' : 'price';
        const items = resp && Array.isArray(resp.items) ? resp.items : [];
        const rows = [];

        for (const it of items.slice(0, 20)) {
            if (!isPlainObject(it)) continue;
            let currency = typeof it.currency === 'string' ? it.currency.trim().toUpperCase() : '';
            let inferred = it.currency_inferred === true;
            if (!/^[A-Z]{3}$/.test(currency) || !isCode(currency)) { currency = travel; inferred = true; }
            const conf = typeof it.confidence === 'number' && it.confidence >= 0 && it.confidence <= 1
                ? it.confidence : 0;

            if (mode === 'cash') {
                if (!validAmount(it.denomination)) continue;
                rows.push({
                    id: newId(), kind: 'cash', currency, amount: it.denomination, qty: clampQty(it.count),
                    label: '', inferred, lowConf: conf < LOW_CONFIDENCE, confidence: conf,
                    discounted: false, taxIncluded: null, unitPrice: null,
                });
            } else {
                if (!validAmount(it.amount)) continue;
                let unitPrice = null;
                if (isPlainObject(it.unit_price) && validAmount(it.unit_price.amount)) {
                    unitPrice = { amount: it.unit_price.amount, per: cleanText(it.unit_price.per, 24) };
                }
                rows.push({
                    id: newId(), kind: 'price', currency, amount: it.amount, qty: 1,
                    label: cleanText(it.label, 60), inferred, lowConf: conf < LOW_CONFIDENCE, confidence: conf,
                    discounted: it.is_discounted === true,
                    taxIncluded: typeof it.tax_included === 'boolean' ? it.tax_included : null,
                    unitPrice,
                });
            }
        }
        return { mode, rows, notes: cleanText(resp && resp.notes, 200) };
    }

    function emptyRow(currency) {
        return {
            id: newId(), kind: 'manual', currency: isCode(currency) ? currency : 'USD', amount: NaN, qty: 1,
            label: '', inferred: false, lowConf: false, confidence: 1,
            discounted: false, taxIncluded: null, unitPrice: null,
        };
    }

    // ── 장바구니 ────────────────────────────────────────────────────────────────
    const CART_KEY = 'camfx_cart_v1';

    function sanitizeCart(raw) {
        if (!Array.isArray(raw)) return [];
        const out = [];
        for (const it of raw.slice(0, 200)) {
            if (!isPlainObject(it) || !isCode(it.currency) || !validAmount(it.amount)) continue;
            out.push({
                id: typeof it.id === 'string' && it.id.length <= 40 ? it.id : newId(),
                currency: it.currency,
                amount: it.amount,
                qty: clampQty(it.qty),
                label: cleanText(it.label, 60),
                kind: ['price', 'cash', 'manual'].includes(it.kind) ? it.kind : 'manual',
                addedAt: Number.isFinite(it.addedAt) ? it.addedAt : 0,
            });
        }
        return out;
    }

    /**
     * 합계 (통화 혼합). 기준 통화 환율이 없는 통화는 합계에서 제외.
     * @returns {{base:{code,total}, secondary:[{code,total|null}], byCurrency:[{code,sum,count}],
     *            excluded:[{code, reason}], includedCount:number}}
     */
    function cartTotals(items, ctx) {
        const { settings } = ctx;
        const base = settings.base;
        const secondary = (settings.secondary || []).filter(c => c !== base).slice(0, MAX_SECONDARY);
        let total = 0;
        const secTotals = secondary.map(code => ({ code, total: 0, ok: true }));
        const byCur = new Map();
        const excluded = new Map();
        let includedCount = 0;

        for (const it of items) {
            const line = it.amount * clampQty(it.qty);
            if (!Number.isFinite(line) || line <= 0) continue;
            const g = byCur.get(it.currency) || { code: it.currency, sum: 0, count: 0 };
            g.sum += line; g.count += 1;
            byCur.set(it.currency, g);

            const c = convert(ctx, line, it.currency, base);
            if (!c) { excluded.set(it.currency, { code: it.currency, reason: 'no_rate' }); continue; }
            total += c.value;
            includedCount += 1;
            for (const s of secTotals) {
                const cs = convert(ctx, line, it.currency, s.code);
                if (!cs) s.ok = false; else s.total += cs.value;
            }
        }
        return {
            base: { code: base, total },
            secondary: secTotals.map(s => ({ code: s.code, total: s.ok ? s.total : null })),
            byCurrency: [...byCur.values()],
            excluded: [...excluded.values()],
            includedCount,
        };
    }

    // ── 카메라 보조 계산 ─────────────────────────────────────────────────────────
    /**
     * object-fit: cover 로 표시된 video 에서 화면상의 가이드 박스 영역 → 원본 영상 좌표
     * @param {{vw,vh}} video 원본 해상도  @param {{ew,eh}} el 표시 크기  @param {{x,y,w,h}} box 요소 기준 좌표
     */
    function coverCropRect(video, el, box) {
        const scale = Math.max(el.ew / video.vw, el.eh / video.vh);
        const ox = (el.ew - video.vw * scale) / 2;
        const oy = (el.eh - video.vh * scale) / 2;
        let sx = (box.x - ox) / scale;
        let sy = (box.y - oy) / scale;
        let sw = box.w / scale;
        let sh = box.h / scale;
        // 원본 범위로 자르기
        const x2 = Math.min(video.vw, sx + sw);
        const y2 = Math.min(video.vh, sy + sh);
        sx = Math.max(0, sx); sy = Math.max(0, sy);
        sw = Math.max(1, x2 - sx); sh = Math.max(1, y2 - sy);
        return { sx: Math.round(sx), sy: Math.round(sy), sw: Math.round(sw), sh: Math.round(sh) };
    }

    /** 긴 변이 maxSide 이하가 되도록 축소 (확대하지 않음) */
    function fitWithin(w, h, maxSide) {
        const s = Math.min(1, maxSide / Math.max(w, h));
        return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
    }

    /** 24×24 회색조 프레임 평균 절대 차이 (0~255) */
    function frameDiff(a, b) {
        if (!a || !b || a.length !== b.length || a.length === 0) return 255;
        let sum = 0;
        for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
        return sum / a.length;
    }

    /**
     * 자동 촬영 판단 상태 기계 (순수). 매 샘플마다 step 호출.
     * 안정(차이 < stableT)이 stableMs 지속되면 1회 촬영, 이후 기준 프레임과
     * 차이가 changeT 를 넘을 때까지 재촬영 금지.
     */
    function createAutoCapture(opts) {
        const o = Object.assign({ stableT: 6, changeT: 22, stableMs: 1200 }, opts || {});
        let prev = null, stableSince = null, lockedRef = null;
        return {
            step(frame, now, paused) {
                if (paused) { prev = frame; stableSince = null; return false; }
                if (lockedRef) {
                    if (frameDiff(frame, lockedRef) > o.changeT) lockedRef = null;
                    else { prev = frame; return false; }
                }
                const d = frameDiff(frame, prev);
                prev = frame;
                if (d < o.stableT) {
                    if (stableSince === null) stableSince = now;
                    if (now - stableSince >= o.stableMs) {
                        lockedRef = frame; stableSince = null;
                        return true;
                    }
                } else {
                    stableSince = null;
                }
                return false;
            },
            reset() { prev = null; stableSince = null; lockedRef = null; },
        };
    }

    // ── 인식 요청 힌트 ──────────────────────────────────────────────────────────
    function buildHint(settings, lang) {
        const list = [settings.travel, settings.base, ...(settings.secondary || []),
                      'USD', 'EUR', 'JPY', 'CNY', 'GBP', 'HKD', 'TWD', 'THB', 'SGD', 'VND'];
        const candidates = [...new Set(list.filter(isCode))].slice(0, 12);
        return { travel: settings.travel, base: settings.base, candidates, lang: lang === 'en' ? 'en' : 'ko' };
    }

    // ── 기기당 소프트 한도 ───────────────────────────────────────────────────────
    const USAGE_KEY = 'camfx_usage_v1';
    function todayKey(now) {
        const d = new Date(now || Date.now());
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function usageToday(raw, now) {
        const day = todayKey(now);
        if (isPlainObject(raw) && raw.day === day && Number.isInteger(raw.count) && raw.count >= 0) return raw;
        return { day, count: 0 };
    }

    return {
        CURRENCIES, NO_DECIMAL, HUNDRED_UNIT, RATES_TTL, RATES_STALE_MS, MANUAL_STALE_MS,
        DEVIATION_LIMIT, LOW_CONFIDENCE, MAX_SECONDARY, MAX_QTY, SETTINGS_KEY, CART_KEY, USAGE_KEY,
        DEFAULT_SETTINGS,
        isCode, getCurrency, rateUnit,
        formatDisplay, roundForDisplay, formatMoney, formatRate, formatEditable,
        parseLooseNumber, detectCurrency,
        marketRate, manualKey, findManual, activeFeePct, resolveRate, convert, ratesAreStale, rateBadge,
        deviationPct, needsDeviationConfirm, staleManualEntries,
        defaultSettings, sanitizeSettings, parseImportedSettings, guessDefaults,
        normalizeRecognition, emptyRow, clampQty, sanitizeCart, cartTotals,
        coverCropRect, fitWithin, frameDiff, createAutoCapture, buildHint, todayKey, usageToday,
    };
});
