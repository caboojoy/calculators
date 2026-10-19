/* jsdom 스모크: 온보딩 → 직접 입력 → 환산 → 장바구니 → 수동 환율(편차 경고) → 언어 전환
   실행: npm i jsdom (어디든) 후  NODE_PATH=<node_modules 경로> node tests/smoke.jsdom.js */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0;
function step(name, fn) { fn(); passed++; console.log(`  ✓ ${name}`); }
const tick = () => new Promise(r => setTimeout(r, 20));

(async () => {
    const dom = new JSDOM(read('index.html'), { url: 'http://localhost:8080/', runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    const d = w.document;
    let fetchCalls = 0;
    w.fetch = async (url) => {
        fetchCalls++;
        assert.ok(String(url).startsWith('https://open.er-api.com/'), `unexpected fetch ${url}`);
        return { json: async () => ({ result: 'success', rates: { USD: 1, KRW: 1400, JPY: 150, EUR: 0.9 } }) };
    };
    let confirmAnswer = false, confirmMsgs = [];
    w.confirm = (m) => { confirmMsgs.push(m); return confirmAnswer; };
    Object.defineProperty(w.navigator, 'language', { value: 'ko-KR', configurable: true });
    Object.defineProperty(w.navigator, 'languages', { value: ['ko-KR'], configurable: true });

    w.eval(read('config.js'));
    w.eval(read('core.js'));
    w.eval(read('app.js'));
    await tick();

    const $ = (id) => d.getElementById(id);
    const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
    const setVal = (el, v, type = 'input') => { el.value = v; fire(el, type); };

    step('첫 실행 온보딩 3단계', () => {
        assert.strictEqual($('onboarding').hidden, false);
        assert.strictEqual($('obStep').textContent, '1 / 3');
        setVal($('obBase'), 'KRW', 'change');
        $('obNext').click();
        assert.strictEqual($('obStep').textContent, '2 / 3');
        setVal($('obTravel'), 'JPY', 'change');
        $('obNext').click();
        const auto = d.querySelector('input[name="obMode"][value="auto"]');
        auto.checked = true; fire(auto, 'change');
        $('obNext').click();
        assert.strictEqual($('onboarding').hidden, true);
        const saved = JSON.parse(w.localStorage.getItem('camfx_settings_v1'));
        assert.strictEqual(saved.onboarded, true);
        assert.strictEqual(saved.base, 'KRW');
        assert.strictEqual(saved.travel, 'JPY');
    });

    step('환율 로드 + 헤더 배지(실시간), 프록시 미설정 안내', () => {
        assert.strictEqual(fetchCalls, 1);
        assert.ok(w.localStorage.getItem('camfx_rates_v1'));
        assert.ok($('rateBadge').textContent.includes('실시간'), $('rateBadge').textContent);
        assert.ok($('rateBadge').textContent.includes('100 JPY'), $('rateBadge').textContent);
        assert.ok($('cameraCoverText').textContent.includes('인식 서버'));
        assert.strictEqual($('shutter').disabled, true);
    });

    step('직접 입력 → 즉시 환산 (1.980 JPY = 천 단위)', () => {
        $('manualEntry').click();
        assert.strictEqual($('resultSheet').hidden, false);
        const row = d.querySelector('#resultRows .row');
        setVal(row.querySelector('.row-amount'), '1.980');
        assert.strictEqual(row.querySelector('.row-conv').textContent, '≈ 18,480 KRW');
        row.querySelectorAll('.stepper button')[1].click();          // 수량 +1
        assert.ok(row.querySelector('.row-conv').textContent.endsWith('36,960 KRW'));
        assert.ok($('resultTotals').textContent.includes('36,960 KRW'));
    });

    step('항목 추가(통화 변경) → 장바구니 담기 → 합계', () => {
        $('addRow').click();
        const rows = d.querySelectorAll('#resultRows .row');
        assert.strictEqual(rows.length, 2);
        setVal(rows[1].querySelector('.row-cur'), 'USD', 'change');
        setVal(rows[1].querySelector('.row-amount'), '3,99');
        assert.ok($('resultTotals').textContent.includes('42,546 KRW'), $('resultTotals').textContent);
        $('addToCart').click();
        assert.strictEqual($('resultSheet').hidden, true);
        assert.strictEqual($('cartCount').textContent, '2');
        d.querySelector('.tab[data-tab="cart"]').click();
        assert.strictEqual($('viewCart').hidden, false);
        assert.strictEqual(d.querySelectorAll('#cartList .cart-item').length, 2);
        assert.ok($('cartTotals').textContent.includes('42,546 KRW'));
        assert.ok($('cartTotals').textContent.includes('3.99 USD'));             // 통화별 소계
        assert.strictEqual(JSON.parse(w.localStorage.getItem('camfx_cart_v1')).length, 2);
    });

    step('수동 환율: 편차 경고 + 저장 전 확인 + 적용', () => {
        $('openSettings').click();
        const manual = d.querySelector('input[name="rateMode"][value="manual"]');
        manual.checked = true; fire(manual, 'change');
        assert.strictEqual($('manualPanel').hidden, false);
        assert.ok($('rateBadge').textContent.includes('수동 미설정'));
        assert.strictEqual($('manualFrom').value, 'JPY');
        assert.strictEqual($('manualUnit').textContent, '100');
        setVal($('manualRate'), '91');                                // 100엔=91원 → 자릿수 오입력
        assert.ok($('manualDeviation').classList.contains('warn'));
        confirmAnswer = false;
        $('manualSave').click();
        assert.strictEqual(confirmMsgs.length, 1);
        assert.strictEqual(d.querySelectorAll('#manualList li').length, 0);
        setVal($('manualRate'), '950');
        assert.ok(!$('manualDeviation').classList.contains('warn'));
        assert.ok($('manualDeviation').textContent.includes('+1.8%'), $('manualDeviation').textContent);
        $('manualSave').click();
        assert.strictEqual(confirmMsgs.length, 1);
        assert.strictEqual(d.querySelectorAll('#manualList li').length, 1);
        assert.ok($('rateBadge').textContent.includes('수동'));
        assert.ok($('rateBadge').textContent.includes('950'));
        assert.ok($('cartTotals').textContent.includes('43,206 KRW'), $('cartTotals').textContent);
        $('closeSettings').click();
    });

    step('7일 경과 수동 환율 → 재확인 배너 → 유지', () => {
        const s = w.__camfx.state.settings;
        s.manual.JPY_KRW.savedAt = Date.now() - 8 * 24 * 3600 * 1000;
        w.__camfx.refreshAll();
        assert.strictEqual($('staleBanner').hidden, false);
        assert.ok($('rateBadge').textContent.includes('오래됨'));
        $('staleKeep').click();
        assert.strictEqual($('staleBanner').hidden, true);
    });

    step('언어 전환', () => {
        $('langToggle').click();
        assert.strictEqual(d.documentElement.lang, 'en');
        assert.strictEqual(d.title, 'Camera FX');
        assert.strictEqual(d.querySelector('.tab[data-tab="cart"] [data-i18n]').textContent, 'Cart');
        assert.ok($('rateBadge').textContent.startsWith('Manual'));
        assert.strictEqual(JSON.parse(w.localStorage.getItem('camfx_settings_v1')).lang, 'en');
    });

    step('잘못된 저장값은 정화되어 로드', () => {
        const s = require('../core.js').sanitizeSettings({ base: 'NOPE', rounding: 3, v: 1 });
        assert.strictEqual(s.base, 'KRW');
        assert.strictEqual(s.rounding, 1);
    });

    step('innerHTML 미사용', () => {
        assert.ok(!/\.(innerHTML|outerHTML|insertAdjacentHTML)\b/.test(read('app.js')));
    });

    console.log(`\n${passed} smoke steps passed`);
})().catch(e => { console.error('  ✗', e.stack || e); process.exit(1); });
