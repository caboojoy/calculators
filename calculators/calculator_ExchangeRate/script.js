    /* ══════════════════════════════════════════════
    환율 계산기 - script.js
    실시간 환율 (open.er-api.com)
    한국어 / English 이중 언어
    ══════════════════════════════════════════════ */

    'use strict';

    // ── 상태 (State) ──────────────────────────────────────────────────────────────
    const state = {
        lang:         localStorage.getItem('exchange_lang') || 'ko',
        fromCurrency: 'USD',
        toCurrency:   'KRW',
        rates:        {},          // USD 기준 모든 환율 { USD:1, KRW:1485, ... }
        activeField:  'from',      // 마지막으로 입력된 필드
        dropdownFor:  null,        // 'from' | 'to'
        lastUpdated:  null,        // Date object
        statusType:   'loading',   // 'loading' | 'live' | 'error' — 언어 전환 시 상태 보존용
    };
    
    // ── 통화 목록 (Currency Data) ─────────────────────────────────────────────────
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
    
    // 인기 통화 (퀵버튼 & 기본 테이블)
    const QUICK_CODES  = ['USD', 'EUR', 'JPY', 'CNY', 'GBP', 'AUD', 'CAD', 'SGD'];
    const TABLE_CODES  = ['USD', 'EUR', 'JPY', 'CNY', 'GBP', 'AUD', 'CAD', 'SGD', 'HKD', 'THB', 'VND', 'CHF'];
    
    // 소수점 없이 표시할 통화
    const NO_DECIMAL   = new Set(['KRW', 'JPY', 'VND', 'IDR', 'HUF', 'CLP', 'COP', 'PKR', 'BDT']);
    
    // ── i18n ──────────────────────────────────────────────────────────────────────
    const TEXT = {
        ko: {
        loading:    '환율 불러오는 중...',
        live:       (d) => `실시간 환율 • ${d} 업데이트`,
        error:      '환율 로드 실패 (이전 데이터 사용)',
        dropdown:   '통화 선택',
        fromLabel:  '보내는 금액',
        toLabel:    '받는 금액',
        popular:    '인기 통화',
        overview:   '주요 환율 한눈에',
        footer1:    '환율 데이터: Open ExchangeRate API • 매일 업데이트',
        footer2:    '실제 거래 환율과 차이가 있을 수 있습니다',
        pageTitle:  '환율 계산기',
        subtitle:   '실시간 환율 기준',
        tableBase:  (code) => `1 ${code} 기준`,
        noResult:   '검색 결과가 없습니다',
        searchPH:   '통화 검색...',
        },
        en: {
        loading:    'Loading rates...',
        live:       (d) => `Live rates • Updated ${d}`,
        error:      'Failed to load rates (using cached data)',
        dropdown:   'Select Currency',
        fromLabel:  'Amount',
        toLabel:    'Converted Amount',
        popular:    'Popular Currencies',
        overview:   'Exchange Rate Overview',
        footer1:    'Rate data: Open ExchangeRate API • Updated daily',
        footer2:    'Rates may differ from actual transaction rates',
        pageTitle:  'Currency Calculator',
        subtitle:   'Live Exchange Rates',
        tableBase:  (code) => `Per 1 ${code}`,
        noResult:   'No currencies found',
        searchPH:   'Search currency...',
        },
    };
    
    function t(key, ...args) {
        const val = TEXT[state.lang][key];
        return typeof val === 'function' ? val(...args) : val;
    }
    
    // ── Helpers ───────────────────────────────────────────────────────────────────
    function getCurrency(code) {
        return CURRENCIES.find(c => c.code === code) || { code, flag: '🏳️', ko: code, en: code };
    }
    
    /**
        * 통화에 맞는 소수점 자릿수를 결정하여 포맷된 문자열 반환
        */
    function formatDisplay(value, currencyCode) {
        if (value === null || isNaN(value)) return '—';
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
    
    /**
        * input 필드에 넣을 raw 숫자 문자열 (천 단위 구분자 없음)
        */
    function formatRaw(value, currencyCode) {
        if (isNaN(value) || value === 0) return '';
        if (NO_DECIMAL.has(currencyCode)) return String(Math.round(value));
        if (value < 0.0001) return value.toFixed(8);
        if (value < 0.01)   return value.toFixed(6);
        if (value < 1)      return value.toFixed(4);
        return parseFloat(value.toFixed(4)).toString();
    }

function parseInputNumber(value) {
    const parsed = parseFloat(String(value || '').replace(/,/g, ''));
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, parsed);
}

function normalizeInputValue(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';

    let cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
    if (!cleaned) return '';

    const firstDot = cleaned.indexOf('.');
    if (firstDot !== -1) {
        cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    }

    const hasDot = cleaned.includes('.');
    const [rawInt = '', rawDec = ''] = cleaned.split('.');
    let intPart = rawInt.replace(/^0+(?=\d)/, '');
    if (!intPart) intPart = '0';

    const groupedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (!hasDot) return groupedInt;
    return `${groupedInt}.${rawDec.slice(0, 2)}`;
}

function formatInputFixed2(value) {
    if (!Number.isFinite(value) || value <= 0) return '';
    return new Intl.NumberFormat('ko-KR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

function formatFixed2(value) {
    if (value === null || !Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('ko-KR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}
    
    /**
        * USD 기준 rates에서 from → to 환율 계산
        */
    function getRate(from, to) {
        const r = state.rates;
        if (!r[from] || !r[to]) return null;
        return r[to] / r[from];
    }
    
    // ── API & 캐시 ────────────────────────────────────────────────────────────────
    const CACHE_KEY = 'exchange_rates_v2';
    const CACHE_TTL = 6 * 60 * 60 * 1000; // 6시간
    
    async function fetchRates() {
        setStatus('loading');
    
        // 1) 유효한 캐시가 있으면 사용
        try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            const { rates, timestamp } = JSON.parse(raw);
            if (Date.now() - timestamp < CACHE_TTL) {
            state.rates      = rates;
            state.lastUpdated = new Date(timestamp);
            setStatus('live');
            return;
            }
        }
        } catch (_) {}
    
        // 2) 신선한 데이터 가져오기
        try {
        const res  = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data.result === 'success') {
            state.rates       = data.rates;
            state.lastUpdated = new Date();
            localStorage.setItem(CACHE_KEY, JSON.stringify({
            rates:     state.rates,
            timestamp: Date.now(),
            }));
            setStatus('live');
            return;
        }
        } catch (_) {}
    
        // 3) 실패 → 낡은 캐시라도 사용
        try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            const { rates, timestamp } = JSON.parse(raw);
            state.rates       = rates;
            state.lastUpdated = new Date(timestamp);
            setStatus('error');
            return;
        }
        } catch (_) {}
    
        setStatus('error');
    }
    
    function setStatus(type) {
        state.statusType = type;   // ← 상태 보존 (언어 전환 시 재사용)
        const dot  = document.getElementById('statusDot');
        const text = document.getElementById('statusText');
    
        dot.className = 'status-dot ' + type;
    
        if (type === 'live') {
        const locale = state.lang === 'ko' ? 'ko-KR' : 'en-US';
        const dateStr = state.lastUpdated
            ? state.lastUpdated.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
            + ' ' + state.lastUpdated.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
            : '';
        text.textContent = t('live', dateStr);
        } else if (type === 'error') {
        text.textContent = t('error');
        } else {
        text.textContent = t('loading');
        }
    }
    
    // ── 환율 계산 ─────────────────────────────────────────────────────────────────
    function convert() {
        const rate = getRate(state.fromCurrency, state.toCurrency);
        if (rate === null) return;
    
        const fromInput = document.getElementById('fromInput');
        const toInput   = document.getElementById('toInput');
    
        if (state.activeField === 'from') {
        const val    = parseInputNumber(fromInput.value);
        const result = val * rate;
        toInput.value = formatInputFixed2(result);
        } else {
        const val    = parseInputNumber(toInput.value);
        const result = rate !== 0 ? val / rate : 0;
        fromInput.value = formatInputFixed2(result);
        }
    
        refreshRateBar();
        refreshTable();
    }
    
    function refreshRateBar() {
        const rate = getRate(state.fromCurrency, state.toCurrency);
        if (rate === null) return;
    
        const inv = rate !== 0 ? 1 / rate : 0;
    
        document.getElementById('rateText').textContent =
        `1 ${state.fromCurrency} = ${formatDisplay(rate, state.toCurrency)} ${state.toCurrency}`;
    
        document.getElementById('inverseRate').textContent =
        `1 ${state.toCurrency} = ${formatDisplay(inv, state.fromCurrency)} ${state.fromCurrency}`;
    }
    
    // ── UI 업데이트 ───────────────────────────────────────────────────────────────
    function refreshCurrencySelectors() {
        const from = getCurrency(state.fromCurrency);
        const to   = getCurrency(state.toCurrency);
    
        document.getElementById('fromFlag').textContent = from.flag;
        document.getElementById('fromCode').textContent = from.code;
        document.getElementById('toFlag').textContent   = to.flag;
        document.getElementById('toCode').textContent   = to.code;
    }
    
    function refreshQuickButtons() {
        const container = document.getElementById('quickGrid');
        container.innerHTML = '';
    
        QUICK_CODES.forEach(code => {
        const c   = getCurrency(code);
        const btn = document.createElement('button');
        btn.className = 'quick-btn' + (code === state.toCurrency ? ' active' : '');
        btn.innerHTML = `<span class="quick-flag">${c.flag}</span>${c.code}`;
        btn.onclick   = () => selectToCurrency(code);
        container.appendChild(btn);
        });
    }
    
    function selectToCurrency(code) {
        if (code === state.fromCurrency) {
        // 같은 통화 → swap
        state.fromCurrency = state.toCurrency;
        }
        state.toCurrency  = code;
        state.activeField = 'from';
        refreshCurrencySelectors();
        refreshQuickButtons();
        convert();
    }
    
    function refreshTable() {
        const container  = document.getElementById('rateTable');
        container.innerHTML = '';
    
    const fromAmount = parseInputNumber(document.getElementById('fromInput').value) || 1;
    
        document.getElementById('tableBase').textContent = t('tableBase', state.fromCurrency);
    
        TABLE_CODES.forEach(code => {
        if (code === state.fromCurrency) return;
        const rate = getRate(state.fromCurrency, code);
        if (rate === null) return;
    
        const c        = getCurrency(code);
        const name     = state.lang === 'ko' ? c.ko : c.en;
        const converted = fromAmount * rate;
    
        const row = document.createElement('div');
        row.className = 'rate-row';
        row.innerHTML = `
            <div class="rate-row-left">
            <span class="row-flag">${c.flag}</span>
            <div>
                <div class="row-code">${c.code}</div>
                <div class="row-name">${name}</div>
            </div>
            </div>
            <div class="rate-row-right">
            <div class="row-value">${formatFixed2(converted)}</div>
            <div class="row-unit">1 ${state.fromCurrency} = ${formatFixed2(rate)}</div>
            </div>
        `;
        // 클릭하면 해당 통화로 to 변경
        row.onclick = () => {
            state.toCurrency  = code;
            state.activeField = 'from';
            refreshCurrencySelectors();
            refreshQuickButtons();
            convert();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        container.appendChild(row);
        });
    }
    
    // ── 언어 갱신 ─────────────────────────────────────────────────────────────────
    function applyLanguage() {
        localStorage.setItem('exchange_lang', state.lang);
    
        // 버튼 활성 표시
        const btn = document.getElementById('langToggle');
        btn.className = 'lang-toggle ' + (state.lang === 'ko' ? 'ko-active' : 'en-active');
    
        // data-ko / data-en 속성을 가진 모든 요소 업데이트
        document.querySelectorAll('[data-ko]').forEach(el => {
        el.textContent = state.lang === 'ko' ? el.dataset.ko : el.dataset.en;
        });
    
        // 개별 동적 텍스트
        document.title = t('pageTitle');
        document.documentElement.lang = state.lang;
    
        const si = document.getElementById('searchInput');
        if (si) si.placeholder = t('searchPH');
    
        // 상태 메시지 재렌더 — 저장된 statusType 그대로 사용 (error → live로 잘못 복원 방지)
        setStatus(state.statusType);
    
        // 테이블 통화명 갱신
        refreshTable();
        refreshQuickButtons();
    }
    
    // ── 드롭다운 (통화 선택 모달) ─────────────────────────────────────────────────
    function openDropdown(target) {
        state.dropdownFor = target;
    
        document.getElementById('dropdownTitle').textContent = t('dropdown');
        document.getElementById('searchInput').value = '';
        document.getElementById('searchInput').placeholder = t('searchPH');
    
        document.getElementById('dropdownOverlay').classList.add('open');
        document.getElementById('dropdownModal').classList.add('open');
    
        renderCurrencyList('');
    
        // 모바일에서 키보드 자동 열기 약간 지연
        setTimeout(() => document.getElementById('searchInput').focus(), 150);
    }
    
    function closeDropdown() {
        document.getElementById('dropdownOverlay').classList.remove('open');
        document.getElementById('dropdownModal').classList.remove('open');
        state.dropdownFor = null;
    }
    
    function filterCurrencies(query) {
        renderCurrencyList(query);
    }
    
    function renderCurrencyList(query) {
        const list     = document.getElementById('currencyList');
        const q        = query.toLowerCase().trim();
        const selected = state.dropdownFor === 'from' ? state.fromCurrency : state.toCurrency;
    
        const filtered = CURRENCIES.filter(c => {
        if (!q) return true;
        return c.code.toLowerCase().includes(q)
            || c.ko.includes(q)
            || c.en.toLowerCase().includes(q);
        });
    
        if (filtered.length === 0) {
        list.innerHTML = `<div class="no-results">${t('noResult')}</div>`;
        return;
        }
    
        list.innerHTML = '';
        filtered.forEach(c => {
        const name = state.lang === 'ko' ? c.ko : c.en;
        const item = document.createElement('div');
        item.className = 'dropdown-item' + (c.code === selected ? ' selected' : '');
        item.innerHTML = `
            <span class="item-flag">${c.flag}</span>
            <span class="item-code">${c.code}</span>
            <span class="item-name">${name}</span>
        `;
        item.onclick = () => selectFromDropdown(c.code);
        list.appendChild(item);
        });
    }
    
    function selectFromDropdown(code) {
        const { dropdownFor } = state;
    
        if (dropdownFor === 'from') {
        if (code === state.toCurrency) state.toCurrency = state.fromCurrency;
        state.fromCurrency = code;
        } else {
        if (code === state.fromCurrency) state.fromCurrency = state.toCurrency;
        state.toCurrency = code;
        }
    
        state.activeField = 'from';
        closeDropdown();
        refreshCurrencySelectors();
        refreshQuickButtons();
        convert();
    }
    
    // ── 통화 교체 (Swap) ──────────────────────────────────────────────────────────
    function swapCurrencies() {
        [state.fromCurrency, state.toCurrency] = [state.toCurrency, state.fromCurrency];
    
        // swap 후 fromInput 기준으로 재계산 (중간 값 할당 없이 convert()에 위임)
        state.activeField = 'from';
        refreshCurrencySelectors();
        refreshQuickButtons();
        convert();
    }
    
    // ── 이벤트 리스너 초기화 ──────────────────────────────────────────────────────
    function initInputListeners() {
    const fromInput = document.getElementById('fromInput');
    const toInput = document.getElementById('toInput');

    fromInput.addEventListener('input', () => {
    fromInput.value = normalizeInputValue(fromInput.value);
        state.activeField = 'from';
        convert();
        });
    
    toInput.addEventListener('input', () => {
    toInput.value = normalizeInputValue(toInput.value);
        state.activeField = 'to';
        convert();
        });

    fromInput.addEventListener('blur', () => {
    fromInput.value = formatInputFixed2(parseInputNumber(fromInput.value));
    });

    toInput.addEventListener('blur', () => {
    toInput.value = formatInputFixed2(parseInputNumber(toInput.value));
    });
    }
    
    function initLangToggle() {
        document.getElementById('langToggle').addEventListener('click', () => {
        state.lang = state.lang === 'ko' ? 'en' : 'ko';
        applyLanguage();
        });
    }
    
    // ESC 키로 드롭다운 닫기
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDropdown();
    });
    
    // ── 진입점 (Init) ─────────────────────────────────────────────────────────────
    async function init() {
        initInputListeners();
        initLangToggle();
        applyLanguage();          // 저장된 언어로 UI 초기화 (refreshQuickButtons, refreshTable 포함)
        refreshCurrencySelectors();
        // ↑ applyLanguage()가 이미 refreshQuickButtons()를 호출하므로 중복 호출 제거
    
        await fetchRates();       // API 호출
    
        convert();                // 초기 변환 실행
        refreshTable();           // 환율 테이블 채우기
    }
    
    init();
    