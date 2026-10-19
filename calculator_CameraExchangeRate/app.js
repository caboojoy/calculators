/* ══════════════════════════════════════════════
   카메라 환율 - app.js
   UI · 카메라 · 인식 프록시 통신 · 결과 편집 · 장바구니 · 설정
   ※ 서버 응답·사용자 입력은 innerHTML 없이 textContent / DOM API 로만 렌더링
   ══════════════════════════════════════════════ */

(function () {
    'use strict';

    const C = window.CamFXCore;
    const CFG = Object.assign({
        PROXY_URL: '', DAILY_SOFT_LIMIT: 40, MAX_SIDE: 1024, JPEG_QUALITY: 0.8, REQUEST_TIMEOUT_MS: 60000,
    }, window.CAMFX_CONFIG || {});
    const PROXY = String(CFG.PROXY_URL || '').replace(/\/+$/, '');

    const RATES_KEY = 'camfx_rates_v1';
    const CAM_OK_KEY = 'camfx_cam_ok';

    // ── 저장소 (사생활 보호 모드 등에서 실패해도 동작) ──────────────────────────────
    const store = {
        get(key) {
            try { const v = localStorage.getItem(key); return v === null ? null : JSON.parse(v); }
            catch (_) { return null; }
        },
        set(key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
        },
        remove(key) {
            try { localStorage.removeItem(key); } catch (_) {}
        },
    };

    // ── i18n ────────────────────────────────────────────────────────────────────
    const TEXT = {
        ko: {
            appTitle: '카메라 환율', pageTitle: '카메라 환율',
            tabPrice: '가격표', tabCash: '지폐', tabCart: '장바구니',
            settings: '설정', close: '닫기', capture: '촬영', keep: '유지', openSettings: '설정 열기',
            startCamera: '카메라 켜기', recognizing: '인식 중…',
            uploadPhoto: '사진 올리기', manualEntry: '직접 입력',
            autoCapture: '자동 촬영', autoCaptureDesc: '화면이 약 1.2초 멈추면 1회 촬영 (호출 비용 주의)',
            guidePrice: '가격표 1개를 박스 안에 맞추세요', guideCash: '지폐를 박스 안에 펼쳐 놓으세요',
            camIntro: '가격표나 지폐를 비추려면 카메라 권한이 필요합니다. 다음 화면에서 권한을 허용해 주세요. 사진은 인식에만 쓰이고 저장되지 않습니다.',
            camPaused: '카메라가 꺼져 있습니다.',
            needHttps: '카메라는 HTTPS(보안 연결)에서만 동작합니다. 사진 올리기나 직접 입력을 이용하세요.',
            camUnsupported: '이 브라우저는 카메라를 지원하지 않습니다. 사진 올리기나 직접 입력을 이용하세요.',
            camDenied: '카메라 권한이 거부되었습니다. 브라우저 설정에서 허용하거나, 사진 올리기·직접 입력을 이용하세요.',
            camError: '카메라를 시작하지 못했습니다. 사진 올리기나 직접 입력을 이용하세요.',
            noProxy: '인식 서버가 설정되지 않아 직접 입력만 사용할 수 있습니다.',
            usage: (n, max) => `오늘 인식 ${n}/${max}회 (이 기기 기준)`,
            softLimit: (max) => `오늘 이 기기의 인식 한도(${max}회)를 모두 썼습니다. 직접 입력을 이용하세요.`,
            err_rate_limited: '요청이 너무 잦습니다. 잠시 후 다시 시도하세요.',
            err_daily_limit: '오늘 인식 한도를 초과했습니다. 직접 입력을 이용하세요.',
            err_too_large: '사진이 너무 큽니다. 다시 찍어 주세요.',
            err_upstream: '인식에 실패했습니다. 잠시 후 다시 시도하거나 직접 입력하세요.',
            err_upstream_busy: '인식 서버가 바쁩니다. 잠시 후 다시 시도하세요.',
            err_parse: '인식 결과를 읽지 못했습니다. 조금 더 가까이에서 다시 찍어 보세요.',
            err_origin: '허용되지 않은 주소에서 보낸 요청입니다.',
            err_bad_request: '요청 형식이 올바르지 않습니다.',
            err_network: '네트워크 오류입니다. 연결을 확인하거나 직접 입력하세요.',
            err_timeout: '응답 시간이 초과되었습니다. 다시 시도하세요.',
            err_image: '사진을 읽지 못했습니다.',
            resultPrice: '가격표 인식 결과', resultCash: '지폐 인식 결과', resultManual: '직접 입력',
            noItems: '인식된 항목이 없습니다. 항목을 직접 추가해 주세요.',
            addItem: '+ 항목 추가', addToCart: '장바구니에 담기',
            labelPH: '상품명 (선택)', cashPH: '지폐', amountPH: '금액',
            qtyMinus: '수량 줄이기', qtyPlus: '수량 늘리기', remove: '삭제',
            badgeInferred: '통화 추정', badgeLowConf: '확인 필요', badgeDiscount: '할인가',
            badgeTaxIn: '세금 포함', badgeTaxOut: '세금 별도',
            unitPer: (per) => `${per}당`,
            noRate: '환율 정보 없음', enterAmount: '금액을 입력하세요',
            added: (n) => `${n}개 항목을 장바구니에 담았습니다`,
            total: '합계', subtotals: '통화별 소계',
            excluded: (codes) => `${codes}: 환율 정보가 없어 합계에서 제외했습니다`,
            cartItems: '담은 항목', clearCart: '비우기', clearConfirm: '장바구니를 비울까요?',
            cartEmpty: '장바구니가 비어 있습니다. 가격표를 찍거나 직접 입력해 담아 보세요.',
            kindPrice: '가격표', kindCash: '지폐', kindManual: '직접 입력',
            badgeLoading: '환율 불러오는 중', badgeNone: '환율 없음',
            badgeMarket: '실시간', badgeFee: (p, prof) => `${prof} +${p}%`, badgeManual: '수동',
            badgeFallback: '수동 미설정·실시간', badgeSame: '같은 통화', badgeStale: '⚠ 오래됨',
            profileCard: '카드', profileCash: '현금 환전',
            staleBanner: (pair) => `수동 환율(${pair})을 입력한 지 7일이 지났습니다. 지금도 맞는지 확인해 주세요.`,
            sCurrency: '통화', baseCurrency: '내 기준 통화', baseCurrencyDesc: '결과를 이 통화로 보여 줍니다',
            travelCurrency: '현재 여행 국가 통화',
            travelCurrencyDesc: '가격표의 $, ¥ 처럼 모호한 기호를 이 통화로 판단합니다',
            secondary: '보조 표시 통화 (최대 3개)', none: '— 없음',
            sRate: '기본 환율 설정', modeAuto: '자동(실시간)', modeFee: '시장+수수료', modeManual: '수동 환율',
            ratePriority: '적용 순서: 수동 환율(설정한 통화쌍) › 시장 환율 + 수수료 › 시장 환율. 수동 환율에는 수수료를 더하지 않습니다.',
            feeCard: '카드 수수료 %', feeCash: '현금 수수료 %',
            feeExample: '기본값 카드 1.5%, 현금 3%는 예시입니다. 내 카드·환전소 조건으로 바꾸세요. (0~20%)',
            feeInvalid: '수수료는 0~20% 사이로 입력하세요',
            fillMarket: '시장 환율 채우기', save: '저장',
            manualEmpty: '저장된 수동 환율이 없습니다. 설정하지 않은 통화는 시장 환율을 씁니다.',
            devPct: (p) => `시장 환율 대비 ${p}`,
            devWarn: (p) => `시장 환율 대비 ${p} — 자릿수를 확인하세요`,
            devNoMarket: '시장 환율 정보가 없어 편차를 확인할 수 없습니다',
            devConfirm: (p) => `입력한 환율이 시장 환율과 ${p} 차이 납니다.\n자릿수(예: 100엔 기준)를 잘못 입력하지 않았는지 확인하세요.\n그래도 저장할까요?`,
            rateInvalid: '올바른 환율을 입력하세요', manualSaved: '수동 환율을 저장했습니다',
            savedAt: (d) => `입력 ${d}`, staleTag: '7일 경과',
            sDisplay: '표시', rounding: '반올림 단위 (소수점 없는 통화)', showUnitPrice: '단가 환산 표시',
            sData: '데이터', export: '설정 내보내기', import: '설정 가져오기', reset: '초기화',
            resetConfirm: '모든 설정을 초기화할까요? (장바구니는 유지됩니다)',
            imported: '설정을 가져왔습니다', importFail: '올바른 설정 파일이 아닙니다',
            ratesLive: (d) => `시장 환율: ${d} 업데이트 (6시간마다 갱신)`,
            ratesError: '환율을 불러오지 못했습니다 (이전 데이터 사용)', ratesLoading: '환율 불러오는 중…',
            ratesMissing: '환율 데이터가 없습니다. 인터넷 연결 후 다시 열어 주세요.',
            back: '이전', next: '다음', start: '시작하기',
            obStep: (n) => `${n} / 3`,
            ob1Title: '내 기준 통화', ob1Desc: '환산 결과를 어떤 통화로 볼까요?',
            ob1Guess: (c) => `기기 언어로 추정한 값: ${c} (참고용)`,
            ob2Title: '여행 국가 통화', ob2Desc: '지금(또는 곧) 여행하는 나라의 통화입니다. 가격표에 $, ¥ 만 있을 때 이 통화로 판단합니다.',
            ob2Guess: (c) => `기기 시간대로 추정한 값: ${c} (참고용 · 위치 정보는 사용하지 않습니다)`,
            ob3Title: '환율 방식', ob3Desc: '언제든 설정에서 바꿀 수 있습니다.',
            ob3Auto: '시장 환율을 그대로 사용합니다 (6시간마다 갱신).',
            ob3Fee: '시장 환율에 카드/환전 수수료를 더합니다 (예시: 카드 1.5%, 현금 3%).',
            ob3Manual: '환전소·카드 명세서의 환율을 직접 입력합니다. 다음 화면에서 설정을 엽니다.',
            foot1: '환율은 시장 기준 참고값이며 실제 결제·환전 환율과 다를 수 있습니다.',
            foot2: '인식 결과는 틀릴 수 있으니 금액·통화를 꼭 확인하세요. 사진은 저장하지 않습니다.',
            foot3: '매장 내 촬영 규정을 확인하고 지켜 주세요.',
            foot4: '환율 데이터: Open ExchangeRate API',
        },
        en: {
            appTitle: 'Camera FX', pageTitle: 'Camera FX',
            tabPrice: 'Price tag', tabCash: 'Cash', tabCart: 'Cart',
            settings: 'Settings', close: 'Close', capture: 'Capture', keep: 'Keep', openSettings: 'Open settings',
            startCamera: 'Turn on camera', recognizing: 'Recognizing…',
            uploadPhoto: 'Upload photo', manualEntry: 'Type it in',
            autoCapture: 'Auto capture', autoCaptureDesc: 'Captures once when the view is still ~1.2s (uses API calls)',
            guidePrice: 'Fit one price tag inside the box', guideCash: 'Spread your banknotes inside the box',
            camIntro: 'Camera access is needed to scan price tags and banknotes. Please allow it on the next prompt. Photos are only used for recognition and never stored.',
            camPaused: 'The camera is off.',
            needHttps: 'The camera only works over HTTPS. Use photo upload or type it in.',
            camUnsupported: 'This browser does not support the camera. Use photo upload or type it in.',
            camDenied: 'Camera permission was denied. Allow it in browser settings, or use photo upload / type it in.',
            camError: 'Could not start the camera. Use photo upload or type it in.',
            noProxy: 'Recognition server is not configured — manual entry only.',
            usage: (n, max) => `Scans today: ${n}/${max} (this device)`,
            softLimit: (max) => `This device has used today's ${max} scans. Please type amounts in.`,
            err_rate_limited: 'Too many requests. Please wait a moment.',
            err_daily_limit: 'Daily scan limit reached. Please type amounts in.',
            err_too_large: 'The photo is too large. Please retake it.',
            err_upstream: 'Recognition failed. Try again later or type it in.',
            err_upstream_busy: 'The recognition server is busy. Please try again shortly.',
            err_parse: 'Could not read the result. Try again a little closer.',
            err_origin: 'Request from a non-allowed address.',
            err_bad_request: 'Invalid request.',
            err_network: 'Network error. Check your connection or type it in.',
            err_timeout: 'The request timed out. Please try again.',
            err_image: 'Could not read the photo.',
            resultPrice: 'Price tag result', resultCash: 'Banknote result', resultManual: 'Manual entry',
            noItems: 'Nothing was recognized. Add an item manually.',
            addItem: '+ Add item', addToCart: 'Add to cart',
            labelPH: 'Item name (optional)', cashPH: 'Banknote', amountPH: 'Amount',
            qtyMinus: 'Decrease quantity', qtyPlus: 'Increase quantity', remove: 'Remove',
            badgeInferred: 'Currency assumed', badgeLowConf: 'Please check', badgeDiscount: 'Sale price',
            badgeTaxIn: 'Tax incl.', badgeTaxOut: 'Tax excl.',
            unitPer: (per) => `per ${per}`,
            noRate: 'No rate available', enterAmount: 'Enter an amount',
            added: (n) => `Added ${n} item(s) to cart`,
            total: 'Total', subtotals: 'By currency',
            excluded: (codes) => `${codes}: no rate available, excluded from total`,
            cartItems: 'Items', clearCart: 'Clear', clearConfirm: 'Clear the cart?',
            cartEmpty: 'Your cart is empty. Scan a price tag or type one in.',
            kindPrice: 'Price tag', kindCash: 'Banknote', kindManual: 'Manual',
            badgeLoading: 'Loading rates', badgeNone: 'No rate',
            badgeMarket: 'Live', badgeFee: (p, prof) => `${prof} +${p}%`, badgeManual: 'Manual',
            badgeFallback: 'No manual rate · Live', badgeSame: 'Same currency', badgeStale: '⚠ Outdated',
            profileCard: 'Card', profileCash: 'Cash exchange',
            staleBanner: (pair) => `Your manual rate (${pair}) is over 7 days old. Please check it is still right.`,
            sCurrency: 'Currencies', baseCurrency: 'My base currency', baseCurrencyDesc: 'Results are shown in this currency',
            travelCurrency: 'Travel destination currency',
            travelCurrencyDesc: 'Used to interpret ambiguous symbols like $ and ¥ on price tags',
            secondary: 'Secondary currencies (up to 3)', none: '— None',
            sRate: 'Exchange rate', modeAuto: 'Live', modeFee: 'Market + fee', modeManual: 'Manual',
            ratePriority: 'Priority: manual rate (for that pair) › market + fee › market rate. Fees are never added to manual rates.',
            feeCard: 'Card fee %', feeCash: 'Cash fee %',
            feeExample: 'Defaults (card 1.5%, cash 3%) are examples. Set your own card / exchange terms. (0–20%)',
            feeInvalid: 'Fee must be between 0 and 20%',
            fillMarket: 'Use market rate', save: 'Save',
            manualEmpty: 'No manual rates saved. Currencies without one use the market rate.',
            devPct: (p) => `${p} vs market rate`,
            devWarn: (p) => `${p} vs market rate — check the digits`,
            devNoMarket: 'No market rate to compare against',
            devConfirm: (p) => `This rate differs from the market rate by ${p}.\nCheck you did not mistype the digits (e.g. per 100 JPY).\nSave anyway?`,
            rateInvalid: 'Enter a valid rate', manualSaved: 'Manual rate saved',
            savedAt: (d) => `Set ${d}`, staleTag: 'over 7 days',
            sDisplay: 'Display', rounding: 'Rounding (no-decimal currencies)', showUnitPrice: 'Show unit price conversion',
            sData: 'Data', export: 'Export settings', import: 'Import settings', reset: 'Reset',
            resetConfirm: 'Reset all settings? (Cart is kept)',
            imported: 'Settings imported', importFail: 'Not a valid settings file',
            ratesLive: (d) => `Market rates updated ${d} (refreshed every 6h)`,
            ratesError: 'Could not load rates (using cached data)', ratesLoading: 'Loading rates…',
            ratesMissing: 'No rate data. Connect to the internet and reopen.',
            back: 'Back', next: 'Next', start: 'Get started',
            obStep: (n) => `${n} / 3`,
            ob1Title: 'Your base currency', ob1Desc: 'Which currency should results be shown in?',
            ob1Guess: (c) => `Guessed from device language: ${c} (just a hint)`,
            ob2Title: 'Travel currency', ob2Desc: 'The currency where you are (or will be) traveling. Used when a price tag only shows $ or ¥.',
            ob2Guess: (c) => `Guessed from device time zone: ${c} (just a hint · location is not used)`,
            ob3Title: 'Rate method', ob3Desc: 'You can change this any time in Settings.',
            ob3Auto: 'Use the market rate as-is (refreshed every 6h).',
            ob3Fee: 'Add a card / exchange fee on top of the market rate (e.g. card 1.5%, cash 3%).',
            ob3Manual: 'Enter the rate from your exchange booth or card statement. Settings will open next.',
            foot1: 'Rates are market reference values and may differ from actual payment or exchange rates.',
            foot2: 'Recognition can be wrong — always check the amount and currency. Photos are not stored.',
            foot3: 'Please follow each store’s photography rules.',
            foot4: 'Rate data: Open ExchangeRate API',
        },
    };

    // ── 상태 ────────────────────────────────────────────────────────────────────
    const state = {
        settings: null,
        rates: null,
        ratesTimestamp: null,
        ratesStatus: 'loading',     // 'loading' | 'live' | 'error'
        tab: 'price',
        cart: [],
        sheet: null,                // { mode: 'price'|'cash'|'manual', rows, notes }
        stream: null,
        camState: 'idle',           // 'idle' | 'starting' | 'running' | 'denied' | 'error'
        resumeCamera: false,
        busy: false,
        autoTimer: null,
        onboardStep: 0,
        onboardDraft: null,
        guess: null,
    };

    const $ = (id) => document.getElementById(id);

    function t(key, ...args) {
        const lang = (state.settings && state.settings.lang) || 'ko';
        const val = TEXT[lang][key] !== undefined ? TEXT[lang][key] : TEXT.ko[key];
        return typeof val === 'function' ? val(...args) : (val === undefined ? key : val);
    }

    function ctx() {
        return { rates: state.rates, ratesTimestamp: state.ratesTimestamp, settings: state.settings, now: Date.now() };
    }

    // DOM 생성 헬퍼 (innerHTML 미사용)
    function h(tag, props, ...kids) {
        const el = document.createElement(tag);
        if (props) {
            for (const [k, v] of Object.entries(props)) {
                if (v === null || v === undefined || v === false) continue;
                if (k === 'class') el.className = v;
                else if (k === 'text') el.textContent = v;
                else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
                else if (k in el && typeof v !== 'string') el[k] = v;
                else el.setAttribute(k, v);
            }
        }
        for (const kid of kids.flat()) {
            if (kid === null || kid === undefined || kid === false) continue;
            el.append(kid instanceof Node ? kid : String(kid));
        }
        return el;
    }

    function svgIcon(paths) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('aria-hidden', 'true');
        for (const d of paths) {
            const p = document.createElementNS(NS, 'path');
            p.setAttribute('d', d);
            svg.appendChild(p);
        }
        return svg;
    }
    const ICON_X = ['M18 6L6 18', 'M6 6l12 12'];

    let toastTimer = null;
    function toast(msg) {
        const el = $('toast');
        el.textContent = msg;
        el.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
    }

    function money(value, code) {
        return C.formatMoney(value, code, state.settings.rounding);
    }

    function locale() {
        return state.settings.lang === 'ko' ? 'ko-KR' : 'en-US';
    }

    function fmtDate(ts) {
        const d = new Date(ts);
        return d.toLocaleDateString(locale(), { month: 'short', day: 'numeric' })
            + ' ' + d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
    }

    function currencyName(code) {
        const c = C.getCurrency(code);
        return state.settings.lang === 'ko' ? c.ko : c.en;
    }

    function fillCurrencySelect(sel, selected, opts) {
        const o = opts || {};
        sel.replaceChildren();
        if (o.none) sel.append(h('option', { value: '', text: t('none') }));
        for (const c of C.CURRENCIES) {
            if (o.exclude && o.exclude.includes(c.code)) continue;
            const label = o.compact ? `${c.flag} ${c.code}` : `${c.flag} ${c.code} · ${currencyName(c.code)}`;
            sel.append(h('option', { value: c.code, text: label }));
        }
        sel.value = selected || '';
    }

    // ── 설정 저장 ────────────────────────────────────────────────────────────────
    function loadSettings() {
        const raw = store.get(C.SETTINGS_KEY);
        state.guess = C.guessDefaults({
            language: (navigator.languages && navigator.languages[0]) || navigator.language || '',
            timeZone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { return ''; } })(),
        });
        if (raw) return C.sanitizeSettings(raw);
        const s = C.defaultSettings();
        Object.assign(s, state.guess);
        return C.sanitizeSettings(s);
    }

    function saveSettings() {
        state.settings = C.sanitizeSettings(state.settings);
        store.set(C.SETTINGS_KEY, state.settings);
        refreshAll();
    }

    // ── 환율 (기존 계산기 로직 재사용: open.er-api.com + 6시간 캐시) ──────────────
    async function fetchRates() {
        setRatesStatus('loading');
        const cached = store.get(RATES_KEY);
        const validCache = cached && cached.rates && typeof cached.rates === 'object' && Number.isFinite(cached.timestamp);

        // 1) 유효한 캐시가 있으면 사용
        if (validCache && Date.now() - cached.timestamp < C.RATES_TTL) {
            state.rates = cached.rates;
            state.ratesTimestamp = cached.timestamp;
            setRatesStatus('live');
            return;
        }
        // 2) 신선한 데이터 가져오기
        try {
            const res = await fetch('https://open.er-api.com/v6/latest/USD');
            const data = await res.json();
            if (data && data.result === 'success' && data.rates) {
                state.rates = data.rates;
                state.ratesTimestamp = Date.now();
                store.set(RATES_KEY, { rates: state.rates, timestamp: state.ratesTimestamp });
                setRatesStatus('live');
                return;
            }
        } catch (_) {}
        // 3) 실패 → 낡은 캐시라도 사용
        if (validCache) {
            state.rates = cached.rates;
            state.ratesTimestamp = cached.timestamp;
        }
        setRatesStatus('error');
    }

    function setRatesStatus(type) {
        state.ratesStatus = type;
        refreshAll();
    }

    // ── 헤더 배지 · 배너 ──────────────────────────────────────────────────────────
    function renderBadge() {
        const el = $('rateBadge');
        const s = state.settings;
        el.classList.remove('warn');
        if (!state.rates && state.ratesStatus === 'loading' && s.rateMode !== 'manual') {
            el.textContent = t('badgeLoading');
            return;
        }
        const b = C.rateBadge(ctx());
        if (b.kind === 'none') {
            el.textContent = state.ratesStatus === 'loading' ? t('badgeLoading') : t('badgeNone');
            el.classList.add('warn');
            return;
        }
        let label;
        if (b.kind === 'market') label = t('badgeMarket');
        else if (b.kind === 'fee') label = t('badgeFee', b.feePct, t(b.profile === 'cash' ? 'profileCash' : 'profileCard'));
        else if (b.kind === 'manual') label = t('badgeManual');
        else if (b.kind === 'manual_fallback') label = t('badgeFallback');
        else label = t('badgeSame');

        const parts = [];
        if (b.stale) parts.push(t('badgeStale'));
        parts.push(label);
        if (b.kind !== 'same') parts.push(`${b.unit} ${b.from} = ${C.formatRate(b.value)} ${b.to}`);
        el.textContent = parts.join(' · ');
        if (b.stale || b.kind === 'manual_fallback') el.classList.add('warn');
    }

    function renderStaleBanner() {
        const s = state.settings;
        const key = C.manualKey(s.travel, s.base);
        const m = s.manual[key];
        const show = s.rateMode === 'manual' && m && Date.now() - m.savedAt > C.MANUAL_STALE_MS;
        $('staleBanner').hidden = !show;
        if (show) {
            const unit = C.rateUnit(s.travel);
            $('staleBannerText').textContent =
                t('staleBanner', `${unit} ${s.travel} = ${C.formatRate(m.rate * unit)} ${s.base}`);
        }
    }

    // ── 언어 ────────────────────────────────────────────────────────────────────
    function applyLanguage() {
        const lang = state.settings.lang;
        document.documentElement.lang = lang;
        document.title = t('pageTitle');
        $('langToggle').textContent = lang === 'ko' ? 'EN' : 'KO';
        document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
        document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    }

    // ── 탭 ──────────────────────────────────────────────────────────────────────
    function setTab(tab) {
        state.tab = tab;
        document.querySelectorAll('.tab').forEach(b => {
            const on = b.dataset.tab === tab;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', String(on));
        });
        const isCam = tab !== 'cart';
        $('viewCamera').hidden = !isCam;
        $('viewCart').hidden = isCam;
        if (isCam) {
            $('camera').dataset.mode = tab;
            $('guideHint').textContent = t(tab === 'cash' ? 'guideCash' : 'guidePrice');
            if (!state.stream && camAllowedToAutoStart()) startCamera();
        } else {
            stopCamera();
            renderCart();
        }
    }

    // ── 카메라 ──────────────────────────────────────────────────────────────────
    function camSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
    function camAllowedToAutoStart() {
        return !!PROXY && window.isSecureContext && camSupported() && store.get(CAM_OK_KEY) === 1
            && state.camState !== 'denied' && !state.sheet && document.visibilityState !== 'hidden';
    }

    function renderCameraUI() {
        const cover = $('cameraCover');
        const btn = $('startCamera');
        const running = state.camState === 'running';
        cover.hidden = running;
        let msg, showBtn = false;
        if (!PROXY) msg = t('noProxy');
        else if (!window.isSecureContext) msg = t('needHttps');
        else if (!camSupported()) msg = t('camUnsupported');
        else if (state.camState === 'denied') msg = t('camDenied');
        else if (state.camState === 'error') { msg = t('camError'); showBtn = true; }
        else if (store.get(CAM_OK_KEY) === 1) { msg = t('camPaused'); showBtn = true; }
        else { msg = t('camIntro'); showBtn = true; }
        $('cameraCoverText').textContent = msg;
        btn.hidden = !showBtn || state.camState === 'starting';

        $('shutter').disabled = !PROXY || !running || state.busy;
        $('fileInput').disabled = !PROXY || state.busy;
        $('fileInput').closest('.ctrl').style.opacity = PROXY ? '' : '0.45';
        $('camera').classList.toggle('auto-armed', running && state.settings.autoCapture);
        $('busy').hidden = !state.busy;
        renderUsage();
    }

    async function startCamera() {
        if (!camSupported() || !window.isSecureContext || state.stream || state.camState === 'starting') return;
        state.camState = 'starting';
        renderCameraUI();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            });
            // 시작하는 사이 탭을 떠났으면 즉시 중지
            if (state.tab === 'cart' || document.visibilityState === 'hidden') {
                stream.getTracks().forEach(tr => tr.stop());
                state.camState = 'idle';
                renderCameraUI();
                return;
            }
            const video = $('video');
            video.srcObject = stream;
            state.stream = stream;
            await video.play().catch(() => {});
            store.set(CAM_OK_KEY, 1);
            state.camState = 'running';
        } catch (e) {
            state.camState = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'denied' : 'error';
            if (state.camState === 'denied') store.remove(CAM_OK_KEY);
        }
        renderCameraUI();
        syncAutoCapture();
    }

    function stopCamera() {
        if (state.stream) {
            state.stream.getTracks().forEach(tr => tr.stop());
            state.stream = null;
        }
        const video = $('video');
        if (video) video.srcObject = null;
        if (state.camState === 'running' || state.camState === 'starting') state.camState = 'idle';
        syncAutoCapture();
        renderCameraUI();
    }

    function guideRegion() {
        const video = $('video');
        const vr = video.getBoundingClientRect();
        const gr = $('guide').getBoundingClientRect();
        return C.coverCropRect(
            { vw: video.videoWidth, vh: video.videoHeight },
            { ew: vr.width, eh: vr.height },
            { x: gr.left - vr.left, y: gr.top - vr.top, w: gr.width, h: gr.height },
        );
    }

    function canvasToBase64(canvas) {
        const url = canvas.toDataURL('image/jpeg', CFG.JPEG_QUALITY);
        const i = url.indexOf(',');
        return i === -1 ? '' : url.slice(i + 1);
    }

    function captureFromVideo() {
        const video = $('video');
        if (!video.videoWidth) return null;
        const r = guideRegion();
        const size = C.fitWithin(r.sw, r.sh, CFG.MAX_SIDE);
        const canvas = document.createElement('canvas');
        canvas.width = size.w; canvas.height = size.h;
        canvas.getContext('2d').drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, size.w, size.h);
        return canvasToBase64(canvas);
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                try {
                    const size = C.fitWithin(img.naturalWidth, img.naturalHeight, CFG.MAX_SIDE);
                    const canvas = document.createElement('canvas');
                    canvas.width = size.w; canvas.height = size.h;
                    canvas.getContext('2d').drawImage(img, 0, 0, size.w, size.h);
                    resolve(canvasToBase64(canvas));
                } catch (e) { reject(e); }
                finally { URL.revokeObjectURL(url); }
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
            img.src = url;
        });
    }

    // ── 자동 촬영 ────────────────────────────────────────────────────────────────
    const autoCap = C.createAutoCapture();
    let sampleCanvas = null;

    function sampleFrame() {
        const video = $('video');
        if (!video.videoWidth) return null;
        if (!sampleCanvas) { sampleCanvas = document.createElement('canvas'); sampleCanvas.width = 24; sampleCanvas.height = 24; }
        const g = sampleCanvas.getContext('2d', { willReadFrequently: true });
        const r = guideRegion();
        g.drawImage(video, r.sx, r.sy, r.sw, r.sh, 0, 0, 24, 24);
        const d = g.getImageData(0, 0, 24, 24).data;
        const out = new Uint8Array(576);
        for (let i = 0, j = 0; i < d.length; i += 4, j++) out[j] = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        return out;
    }

    function syncAutoCapture() {
        const want = state.settings.autoCapture && state.camState === 'running' && !!PROXY;
        if (want && !state.autoTimer) {
            autoCap.reset();
            state.autoTimer = setInterval(() => {
                const frame = sampleFrame();
                if (!frame) return;
                const paused = !!state.sheet || state.busy || !$('settingsSheet').hidden || !$('onboarding').hidden;
                if (autoCap.step(frame, Date.now(), paused)) doCapture();
            }, 200);
        } else if (!want && state.autoTimer) {
            clearInterval(state.autoTimer);
            state.autoTimer = null;
        }
        $('camera').classList.toggle('auto-armed', want);
    }

    // ── 인식 요청 ────────────────────────────────────────────────────────────────
    function getUsage() {
        return C.usageToday(store.get(C.USAGE_KEY));
    }
    function renderUsage() {
        const el = $('usageText');
        el.hidden = !PROXY;
        if (PROXY) el.textContent = t('usage', getUsage().count, CFG.DAILY_SOFT_LIMIT);
    }
    function showCamNotice(msg) {
        const n = $('cameraNotice');
        n.hidden = !msg;
        n.textContent = msg || '';
    }

    async function recognize(image) {
        const mode = state.tab === 'cash' ? 'cash' : 'price';
        const usage = getUsage();
        if (usage.count >= CFG.DAILY_SOFT_LIMIT) { showCamNotice(t('softLimit', CFG.DAILY_SOFT_LIMIT)); return; }
        if (!image) { showCamNotice(t('err_image')); return; }

        state.busy = true;
        showCamNotice('');
        renderCameraUI();
        const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = setTimeout(() => ctrl && ctrl.abort(), CFG.REQUEST_TIMEOUT_MS);
        let err = null, data = null;
        try {
            const res = await fetch(`${PROXY}/recognize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode, image, mediaType: 'image/jpeg',
                    hint: C.buildHint(state.settings, state.settings.lang),
                }),
                signal: ctrl ? ctrl.signal : undefined,
            });
            store.set(C.USAGE_KEY, { day: usage.day, count: usage.count + 1 });
            data = await res.json().catch(() => null);
            if (!data || data.ok !== true) err = (data && typeof data.error === 'string') ? data.error : 'upstream';
        } catch (e) {
            err = e && e.name === 'AbortError' ? 'timeout' : 'network';
        } finally {
            clearTimeout(timer);
            state.busy = false;
            renderCameraUI();
        }
        if (err) {
            const key = `err_${err}`;
            showCamNotice(TEXT.ko[key] ? t(key) : t('err_upstream'));
            return;
        }
        const norm = C.normalizeRecognition(data, { travel: state.settings.travel });
        openResult(norm.mode, norm.rows, norm.notes);
    }

    function doCapture() {
        if (state.busy || !PROXY) return;
        let image = null;
        try { image = captureFromVideo(); } catch (_) {}
        recognize(image);
    }

    // ── 결과 시트 ────────────────────────────────────────────────────────────────
    const rowRefs = new Map();

    function openResult(mode, rows, notes) {
        state.sheet = { mode, rows, notes: notes || '' };
        $('sheetOverlay').hidden = false;
        $('resultSheet').hidden = false;
        document.body.classList.add('locked');
        renderResult();
    }

    function closeResult() {
        state.sheet = null;
        $('resultSheet').hidden = true;
        $('sheetOverlay').hidden = true;
        document.body.classList.remove('locked');
        rowRefs.clear();
        if (state.tab !== 'cart' && !state.stream && camAllowedToAutoStart()) startCamera();
    }

    function renderResult() {
        const sh = state.sheet;
        if (!sh) return;
        $('resultTitle').textContent = t(sh.mode === 'cash' ? 'resultCash' : sh.mode === 'manual' ? 'resultManual' : 'resultPrice');
        $('resultNotes').hidden = !sh.notes;
        $('resultNotes').textContent = sh.notes;
        const list = $('resultRows');
        list.replaceChildren();
        rowRefs.clear();
        for (const row of sh.rows) list.append(renderRow(row));
        $('resultEmpty').hidden = sh.rows.length > 0;
        renderResultTotals();
    }

    function stepper(value, onChange) {
        const out = h('output', { text: String(value) });
        const minus = h('button', { type: 'button', 'aria-label': t('qtyMinus'), text: '−' });
        const plus = h('button', { type: 'button', 'aria-label': t('qtyPlus'), text: '+' });
        const sync = (v) => { out.textContent = String(v); minus.disabled = v <= 1; plus.disabled = v >= C.MAX_QTY; };
        minus.addEventListener('click', () => { const v = C.clampQty(Number(out.textContent) - 1); sync(v); onChange(v); });
        plus.addEventListener('click', () => { const v = C.clampQty(Number(out.textContent) + 1); sync(v); onChange(v); });
        sync(value);
        return h('div', { class: 'stepper' }, minus, out, plus);
    }

    function renderRow(row) {
        const li = h('li', { class: 'row', 'data-id': row.id });
        const label = h('input', {
            class: 'row-label', type: 'text', maxlength: '60',
            placeholder: row.kind === 'cash' ? t('cashPH') : t('labelPH'),
        });
        label.value = row.label || '';
        label.addEventListener('input', () => { row.label = label.value.slice(0, 60); });

        const sel = h('select', { class: 'select row-cur', 'aria-label': t('travelCurrency') });
        fillCurrencySelect(sel, row.currency, { compact: true });
        sel.addEventListener('change', () => {
            row.currency = sel.value;
            row.inferred = false;          // 사용자가 직접 고른 통화
            const v = C.parseLooseNumber(amount.value, row.currency);
            row.amount = v;
            updateRowDerived(row);
            renderResultTotals();
        });

        const amount = h('input', {
            class: 'input row-amount', type: 'text', inputmode: 'decimal', autocomplete: 'off',
            placeholder: t('amountPH'), 'aria-label': t('amountPH'),
        });
        amount.value = C.formatEditable(row.amount, row.currency);
        amount.addEventListener('input', () => {
            row.amount = C.parseLooseNumber(amount.value, row.currency);
            updateRowDerived(row);
            renderResultTotals();
        });
        amount.addEventListener('blur', () => {
            if (Number.isFinite(row.amount) && row.amount > 0) amount.value = C.formatEditable(row.amount, row.currency);
        });

        const qty = stepper(row.qty, (v) => { row.qty = v; updateRowDerived(row); renderResultTotals(); });
        const del = h('button', { type: 'button', class: 'del-btn', 'aria-label': t('remove') }, svgIcon(ICON_X));
        del.addEventListener('click', () => {
            state.sheet.rows = state.sheet.rows.filter(r => r.id !== row.id);
            li.remove();
            rowRefs.delete(row.id);
            $('resultEmpty').hidden = state.sheet.rows.length > 0;
            renderResultTotals();
        });

        const conv = h('div', { class: 'row-conv' });
        const unit = h('div', { class: 'row-unit' });
        const badges = h('div', { class: 'badges' });
        li.append(label, h('div', { class: 'row-main' }, sel, amount, qty, del), conv, unit, badges);
        rowRefs.set(row.id, { conv, unit, badges, amount });
        updateRowDerived(row);
        return li;
    }

    function updateRowDerived(row) {
        const refs = rowRefs.get(row.id);
        if (!refs) return;
        const base = state.settings.base;
        const valid = Number.isFinite(row.amount) && row.amount > 0;

        if (!valid) {
            refs.conv.textContent = t('enterAmount');
            refs.conv.className = 'row-conv muted';
        } else {
            const c = C.convert(ctx(), row.amount * row.qty, row.currency, base);
            refs.conv.className = c ? 'row-conv' : 'row-conv muted';
            refs.conv.textContent = c
                ? `${row.qty > 1 ? `${C.formatDisplay(row.amount, row.currency)} × ${row.qty} → ` : '≈ '}${money(c.value, base)}`
                : t('noRate');
        }

        refs.unit.hidden = true;
        if (row.unitPrice && state.settings.showUnitPrice) {
            const cu = C.convert(ctx(), row.unitPrice.amount, row.currency, base);
            const per = row.unitPrice.per ? t('unitPer', row.unitPrice.per) + ' ' : '';
            refs.unit.textContent = `${per}${C.formatDisplay(row.unitPrice.amount, row.currency)} ${row.currency}`
                + (cu ? ` → ${money(cu.value, base)}` : '');
            refs.unit.hidden = false;
        }

        const b = [];
        if (row.inferred) b.push(['warn', t('badgeInferred')]);
        if (row.lowConf) b.push(['warn', t('badgeLowConf')]);
        if (row.discounted) b.push(['info', t('badgeDiscount')]);
        if (row.taxIncluded === true) b.push(['', t('badgeTaxIn')]);
        if (row.taxIncluded === false) b.push(['', t('badgeTaxOut')]);
        refs.badges.replaceChildren(...b.map(([cls, txt]) => h('span', { class: `badge ${cls}`, text: txt })));
        refs.badges.hidden = b.length === 0;
    }

    function validRows(rows) {
        return rows.filter(r => Number.isFinite(r.amount) && r.amount > 0 && r.amount <= 1e12 && C.isCode(r.currency));
    }

    function renderTotalsInto(container, items) {
        const tot = C.cartTotals(items, ctx());
        container.replaceChildren(
            h('div', { class: 't-label', text: t('total') }),
            h('div', { class: 't-main', text: money(tot.base.total, tot.base.code) }),
        );
        const sec = tot.secondary.filter(s => s.total !== null);
        if (sec.length) {
            container.append(h('div', { class: 't-sec' }, sec.map(s => h('span', { text: `≈ ${money(s.total, s.code)}` }))));
        }
        return tot;
    }

    function renderResultTotals() {
        if (!state.sheet) return;
        const items = validRows(state.sheet.rows);
        const box = $('resultTotals');
        const tot = renderTotalsInto(box, items);
        if (tot.excluded.length) {
            box.append(h('p', { class: 't-excluded', text: t('excluded', tot.excluded.map(e => e.code).join(', ')) }));
        }
        $('addToCart').disabled = items.length === 0;
    }

    function addRow() {
        if (!state.sheet) return;
        const last = state.sheet.rows[state.sheet.rows.length - 1];
        const row = C.emptyRow(last ? last.currency : state.settings.travel);
        state.sheet.rows.push(row);
        const li = renderRow(row);
        $('resultRows').append(li);
        $('resultEmpty').hidden = true;
        renderResultTotals();
        const refs = rowRefs.get(row.id);
        if (refs) refs.amount.focus();
    }

    function addSheetToCart() {
        if (!state.sheet) return;
        const items = validRows(state.sheet.rows);
        if (!items.length) { toast(t('enterAmount')); return; }
        const now = Date.now();
        for (const r of items) {
            state.cart.push({
                id: r.id, currency: r.currency, amount: r.amount, qty: C.clampQty(r.qty),
                label: (r.label || '').slice(0, 60), kind: r.kind, addedAt: now,
            });
        }
        saveCart();
        toast(t('added', items.length));
        closeResult();
    }

    // ── 장바구니 ────────────────────────────────────────────────────────────────
    function saveCart() {
        state.cart = C.sanitizeCart(state.cart);
        store.set(C.CART_KEY, state.cart);
        renderCartCount();
        if (state.tab === 'cart') renderCart();
    }

    function renderCartCount() {
        const el = $('cartCount');
        el.hidden = state.cart.length === 0;
        el.textContent = String(state.cart.length);
    }

    function itemTitle(it) {
        if (it.label) return it.label;
        if (it.kind === 'cash') return `${t('kindCash')} ${C.formatDisplay(it.amount, it.currency)} ${it.currency}`;
        return t(it.kind === 'price' ? 'kindPrice' : 'kindManual');
    }

    function renderCart() {
        const list = $('cartList');
        list.replaceChildren();
        $('cartEmpty').hidden = state.cart.length > 0;
        $('clearCart').hidden = state.cart.length === 0;
        const base = state.settings.base;

        for (const it of state.cart) {
            const c = C.convert(ctx(), it.amount * it.qty, it.currency, base);
            const del = h('button', { type: 'button', class: 'del-btn', 'aria-label': t('remove') }, svgIcon(ICON_X));
            del.addEventListener('click', () => {
                state.cart = state.cart.filter(x => x.id !== it.id);
                saveCart();
            });
            list.append(h('li', { class: 'cart-item' },
                h('div', {},
                    h('div', { class: 'ci-name', text: itemTitle(it) }),
                    h('div', { class: 'ci-orig', text: `${C.formatDisplay(it.amount, it.currency)} ${it.currency} × ${it.qty}` }),
                ),
                h('div', { class: 'ci-conv', text: c ? money(c.value, base) : t('noRate') }),
                h('div', { class: 'ci-actions' },
                    stepper(it.qty, (v) => { it.qty = v; saveCart(); }),
                    del,
                ),
            ));
        }

        const box = $('cartTotals');
        const tot = renderTotalsInto(box, state.cart);
        if (tot.byCurrency.length > 1 || (tot.byCurrency.length === 1 && tot.byCurrency[0].code !== base)) {
            box.append(h('ul', { class: 't-sub', 'aria-label': t('subtotals') },
                tot.byCurrency.map(g => h('li', {},
                    h('span', { text: `${C.getCurrency(g.code).flag} ${g.code}` }),
                    h('span', { text: `${C.formatDisplay(g.sum, g.code)} ${g.code}` }),
                ))));
        }
        if (tot.excluded.length) {
            box.append(h('p', { class: 't-excluded', text: t('excluded', tot.excluded.map(e => e.code).join(', ')) }));
        }
    }

    // ── 설정 시트 ────────────────────────────────────────────────────────────────
    function openSettings(focusManual) {
        $('settingsSheet').hidden = false;
        document.body.classList.add('locked');
        renderSettings();
        if (focusManual) $('manualRate').focus();
    }

    function closeSettings() {
        $('settingsSheet').hidden = true;
        if (!state.sheet) document.body.classList.remove('locked');
    }

    function renderSettings() {
        const s = state.settings;
        fillCurrencySelect($('setBase'), s.base);
        fillCurrencySelect($('setTravel'), s.travel);
        for (let i = 0; i < 3; i++) fillCurrencySelect($(`setSec${i}`), s.secondary[i] || '', { none: true, exclude: [s.base], compact: true });

        document.querySelectorAll('input[name="rateMode"]').forEach(r => { r.checked = r.value === s.rateMode; });
        document.querySelectorAll('input[name="feeProfile"]').forEach(r => { r.checked = r.value === s.feeProfile; });
        $('feePanel').hidden = s.rateMode !== 'fee';
        $('manualPanel').hidden = s.rateMode !== 'manual';
        if (document.activeElement !== $('feeCard')) $('feeCard').value = String(s.fees.card);
        if (document.activeElement !== $('feeCash')) $('feeCash').value = String(s.fees.cash);

        const from = $('manualFrom').value && $('manualFrom').value !== s.base ? $('manualFrom').value
            : (s.travel !== s.base ? s.travel : (s.base === 'USD' ? 'EUR' : 'USD'));
        fillCurrencySelect($('manualFrom'), from, { exclude: [s.base], compact: true });
        renderManualForm();
        renderManualList();

        $('setRounding').value = String(s.rounding);
        $('setUnitPrice').checked = s.showUnitPrice;

        const info = $('ratesInfo');
        if (state.ratesStatus === 'live') info.textContent = t('ratesLive', fmtDate(state.ratesTimestamp));
        else if (state.ratesStatus === 'loading') info.textContent = t('ratesLoading');
        else info.textContent = state.rates ? t('ratesError') : t('ratesMissing');
    }

    function fmtPct(p) {
        const sign = p > 0 ? '+' : '';
        return `${sign}${Math.abs(p) >= 100 ? Math.round(p) : p.toFixed(1)}%`;
    }

    function manualDraft() {
        const from = $('manualFrom').value;
        const unit = C.rateUnit(from);
        const v = C.parseLooseNumber($('manualRate').value, state.settings.base, { forceDecimal: true });
        const rate = Number.isFinite(v) && v > 0 ? v / unit : NaN;
        const market = C.marketRate(state.rates, from, state.settings.base);
        return { from, unit, rate, market };
    }

    function renderManualForm() {
        const d = manualDraft();
        $('manualUnit').textContent = String(d.unit);
        $('manualTo').textContent = state.settings.base;
        const dev = $('manualDeviation');
        dev.classList.remove('warn');
        if (!Number.isFinite(d.rate)) {
            dev.textContent = d.market ? `${t('badgeMarket')}: ${d.unit} ${d.from} = ${C.formatRate(d.market * d.unit)} ${state.settings.base}` : '';
            return;
        }
        if (d.market === null) { dev.textContent = t('devNoMarket'); return; }
        const p = C.deviationPct(d.rate, d.market);
        if (C.needsDeviationConfirm(d.rate, d.market)) {
            dev.textContent = t('devWarn', fmtPct(p));
            dev.classList.add('warn');
        } else {
            dev.textContent = t('devPct', fmtPct(p));
        }
    }

    function renderManualList() {
        const s = state.settings;
        const list = $('manualList');
        const keys = Object.keys(s.manual);
        list.replaceChildren();
        $('manualEmpty').hidden = keys.length > 0;
        const now = Date.now();
        for (const key of keys) {
            const [from, to] = key.split('_');
            const m = s.manual[key];
            const unit = C.rateUnit(from);
            const stale = now - m.savedAt > C.MANUAL_STALE_MS;
            const del = h('button', { type: 'button', class: 'del-btn', 'aria-label': t('remove') }, svgIcon(ICON_X));
            del.addEventListener('click', () => {
                delete state.settings.manual[key];
                saveSettings();
            });
            list.append(h('li', {},
                h('div', {},
                    h('div', { text: `${unit} ${from} = ${C.formatRate(m.rate * unit)} ${to}` }),
                    h('div', { class: `m-meta${stale ? ' warn' : ''}`,
                               text: t('savedAt', fmtDate(m.savedAt)) + (stale ? ` · ${t('staleTag')}` : '') }),
                ),
                del,
            ));
        }
    }

    function saveManual() {
        const d = manualDraft();
        if (!C.isCode(d.from) || d.from === state.settings.base || !Number.isFinite(d.rate) || d.rate <= 0 || d.rate > 1e9) {
            toast(t('rateInvalid'));
            return;
        }
        if (C.needsDeviationConfirm(d.rate, d.market)) {
            if (!window.confirm(t('devConfirm', fmtPct(C.deviationPct(d.rate, d.market))))) return;
        }
        state.settings.manual[C.manualKey(d.from, state.settings.base)] = { rate: d.rate, savedAt: Date.now() };
        $('manualRate').value = '';
        saveSettings();
        toast(t('manualSaved'));
    }

    function fillMarket() {
        const d = manualDraft();
        if (d.market === null) { toast(t('devNoMarket')); return; }
        $('manualRate').value = String(Number((d.market * d.unit).toPrecision(6)));
        renderManualForm();
    }

    function onFeeInput(profile, el) {
        const v = C.parseLooseNumber(el.value, 'USD', { forceDecimal: true });
        if (Number.isFinite(v) && v >= 0 && v <= 20) {
            state.settings.fees[profile] = Math.round(v * 100) / 100;
            saveSettings();
        }
    }

    function onFeeBlur(profile, el) {
        const v = C.parseLooseNumber(el.value, 'USD', { forceDecimal: true });
        if (!(Number.isFinite(v) && v >= 0 && v <= 20)) toast(t('feeInvalid'));
        el.value = String(state.settings.fees[profile]);
    }

    function readSecondary() {
        const vals = [0, 1, 2].map(i => $(`setSec${i}`).value).filter(Boolean);
        state.settings.secondary = vals;
        saveSettings();
    }

    function exportSettings() {
        const json = JSON.stringify(state.settings, null, 2);
        try {
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = h('a', { href: url, download: 'camfx-settings.json' });
            document.body.append(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (_) {
            toast(t('importFail'));
        }
    }

    async function importSettings(file) {
        if (!file || file.size > 100000) { toast(t('importFail')); return; }
        const text = await file.text();
        const r = C.parseImportedSettings(text);
        if (!r.ok) { toast(t('importFail')); return; }
        r.settings.onboarded = true;
        state.settings = r.settings;
        saveSettings();
        toast(t('imported'));
    }

    function resetSettings() {
        if (!window.confirm(t('resetConfirm'))) return;
        const s = C.defaultSettings();
        Object.assign(s, state.guess, { lang: state.settings.lang });
        state.settings = C.sanitizeSettings(s);
        saveSettings();
        closeSettings();
        openOnboarding();
    }

    // ── 온보딩 (기준 통화 → 여행 국가 → 환율 방식) ──────────────────────────────────
    function openOnboarding() {
        const s = state.settings;
        state.onboardStep = 0;
        state.onboardDraft = { base: s.base, travel: s.travel, rateMode: s.rateMode };
        $('onboarding').hidden = false;
        document.body.classList.add('locked');
        renderOnboarding();
    }

    function renderOnboarding() {
        const step = state.onboardStep;
        const d = state.onboardDraft;
        $('obStep').textContent = t('obStep', step + 1);
        $('obBack').style.visibility = step === 0 ? 'hidden' : 'visible';
        $('obNext').textContent = step === 2 ? t('start') : t('next');
        const content = $('obContent');
        content.replaceChildren();

        if (step === 0 || step === 1) {
            const key = step === 0 ? 'base' : 'travel';
            $('obTitle').textContent = t(step === 0 ? 'ob1Title' : 'ob2Title');
            $('obDesc').textContent = t(step === 0 ? 'ob1Desc' : 'ob2Desc');
            const sel = h('select', { class: 'select', id: step === 0 ? 'obBase' : 'obTravel' });
            fillCurrencySelect(sel, d[key]);
            sel.addEventListener('change', () => { d[key] = sel.value; });
            content.append(sel, h('p', { class: 'ob-guess', text: t(step === 0 ? 'ob1Guess' : 'ob2Guess', state.guess[key]) }));
        } else {
            $('obTitle').textContent = t('ob3Title');
            $('obDesc').textContent = t('ob3Desc');
            const opts = [['auto', 'modeAuto', 'ob3Auto'], ['fee', 'modeFee', 'ob3Fee'], ['manual', 'modeManual', 'ob3Manual']];
            content.append(h('div', { class: 'ob-options' }, opts.map(([v, title, desc]) => {
                const input = h('input', { type: 'radio', name: 'obMode', value: v });
                input.checked = d.rateMode === v;
                input.addEventListener('change', () => { d.rateMode = v; });
                return h('label', { class: 'ob-option' },
                    input, h('span', { class: 'ob-option-title', text: t(title) }),
                    h('span', { class: 'ob-option-desc', text: t(desc) }));
            })));
        }
    }

    function onboardNext() {
        if (state.onboardStep < 2) { state.onboardStep++; renderOnboarding(); return; }
        const d = state.onboardDraft;
        Object.assign(state.settings, { base: d.base, travel: d.travel, rateMode: d.rateMode, onboarded: true });
        $('onboarding').hidden = true;
        document.body.classList.remove('locked');
        saveSettings();
        if (d.rateMode === 'manual') openSettings(true);
    }

    function onboardBack() {
        if (state.onboardStep > 0) { state.onboardStep--; renderOnboarding(); }
    }

    // ── 전체 갱신 ────────────────────────────────────────────────────────────────
    function refreshAll() {
        if (!state.settings) return;
        applyLanguage();
        renderBadge();
        renderStaleBanner();
        renderCartCount();
        renderCameraUI();
        if (state.tab !== 'cart') $('guideHint').textContent = t(state.tab === 'cash' ? 'guideCash' : 'guidePrice');
        else renderCart();
        $('autoCapture').checked = state.settings.autoCapture;
        syncAutoCapture();
        if (state.sheet) {
            // 포커스 중인 입력이 없을 때만 다시 그림 (입력 중 커서 유지)
            const active = document.activeElement;
            if (active && $('resultSheet').contains(active)) {
                state.sheet.rows.forEach(updateRowDerived);
                renderResultTotals();
            } else {
                renderResult();
            }
        }
        if (!$('settingsSheet').hidden) renderSettings();
        if (!$('onboarding').hidden) renderOnboarding();
    }

    // ── 이벤트 ──────────────────────────────────────────────────────────────────
    function bindEvents() {
        document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
        $('langToggle').addEventListener('click', () => {
            state.settings.lang = state.settings.lang === 'ko' ? 'en' : 'ko';
            saveSettings();
        });
        $('openSettings').addEventListener('click', () => openSettings(false));
        $('rateBadge').addEventListener('click', () => openSettings(false));
        $('closeSettings').addEventListener('click', closeSettings);

        $('staleKeep').addEventListener('click', () => {
            const s = state.settings;
            const key = C.manualKey(s.travel, s.base);
            if (s.manual[key]) s.manual[key].savedAt = Date.now();
            saveSettings();
        });
        $('staleOpen').addEventListener('click', () => {
            $('manualFrom').value = state.settings.travel;
            openSettings(true);
        });

        $('startCamera').addEventListener('click', startCamera);
        $('shutter').addEventListener('click', doCapture);
        $('fileInput').addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            e.target.value = '';
            if (!file || !PROXY) return;
            let image = null;
            try { image = await fileToBase64(file); } catch (_) {}
            recognize(image);
        });
        $('manualEntry').addEventListener('click', () => {
            openResult('manual', [C.emptyRow(state.settings.travel)], '');
            const first = state.sheet.rows[0];
            const refs = rowRefs.get(first.id);
            if (refs) refs.amount.focus();
        });
        $('autoCapture').addEventListener('change', (e) => {
            state.settings.autoCapture = e.target.checked;
            saveSettings();
        });

        $('closeResult').addEventListener('click', closeResult);
        $('sheetOverlay').addEventListener('click', closeResult);
        $('addRow').addEventListener('click', addRow);
        $('addToCart').addEventListener('click', addSheetToCart);
        $('clearCart').addEventListener('click', () => {
            if (state.cart.length && window.confirm(t('clearConfirm'))) { state.cart = []; saveCart(); }
        });

        // 설정
        $('setBase').addEventListener('change', (e) => { state.settings.base = e.target.value; saveSettings(); });
        $('setTravel').addEventListener('change', (e) => { state.settings.travel = e.target.value; saveSettings(); });
        [0, 1, 2].forEach(i => $(`setSec${i}`).addEventListener('change', readSecondary));
        document.querySelectorAll('input[name="rateMode"]').forEach(r => r.addEventListener('change', () => {
            state.settings.rateMode = r.value; saveSettings();
        }));
        document.querySelectorAll('input[name="feeProfile"]').forEach(r => r.addEventListener('change', () => {
            state.settings.feeProfile = r.value; saveSettings();
        }));
        $('feeCard').addEventListener('input', (e) => onFeeInput('card', e.target));
        $('feeCash').addEventListener('input', (e) => onFeeInput('cash', e.target));
        $('feeCard').addEventListener('blur', (e) => onFeeBlur('card', e.target));
        $('feeCash').addEventListener('blur', (e) => onFeeBlur('cash', e.target));
        $('manualFrom').addEventListener('change', renderManualForm);
        $('manualRate').addEventListener('input', renderManualForm);
        $('manualFill').addEventListener('click', fillMarket);
        $('manualSave').addEventListener('click', saveManual);
        $('setRounding').addEventListener('change', (e) => { state.settings.rounding = Number(e.target.value); saveSettings(); });
        $('setUnitPrice').addEventListener('change', (e) => { state.settings.showUnitPrice = e.target.checked; saveSettings(); });
        $('exportSettings').addEventListener('click', exportSettings);
        $('importSettings').addEventListener('change', (e) => {
            const f = e.target.files && e.target.files[0];
            e.target.value = '';
            importSettings(f).catch(() => toast(t('importFail')));
        });
        $('resetSettings').addEventListener('click', resetSettings);

        $('obNext').addEventListener('click', onboardNext);
        $('obBack').addEventListener('click', onboardBack);

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (!$('settingsSheet').hidden) closeSettings();
            else if (state.sheet) closeResult();
        });

        // 탭 이탈·화면 숨김 시 스트림 중지, 복귀 시 재시작
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                state.resumeCamera = !!state.stream;
                stopCamera();
            } else if (state.resumeCamera && state.tab !== 'cart' && !state.sheet) {
                state.resumeCamera = false;
                startCamera();
            }
        });
        window.addEventListener('pagehide', stopCamera);
    }

    // ── 진입점 ──────────────────────────────────────────────────────────────────
    function init() {
        state.settings = loadSettings();
        state.cart = C.sanitizeCart(store.get(C.CART_KEY));
        bindEvents();
        setTab('price');
        refreshAll();
        if (!state.settings.onboarded) openOnboarding();
        fetchRates();

        if ('serviceWorker' in navigator && window.isSecureContext) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }

    // 테스트용 내부 접근 (기능에는 영향 없음)
    window.__camfx = { state, refreshAll };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
