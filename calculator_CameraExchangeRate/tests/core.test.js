/* node tests/core.test.js */
'use strict';
const assert = require('assert');
const C = require('../core.js');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { failed++; console.log(`  ✗ ${name}\n    ${e.message}`); }
}

const NOW = Date.UTC(2026, 9, 19, 3, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const RATES = { USD: 1, KRW: 1400, JPY: 150, EUR: 0.9, CNY: 7.2, VND: 25000 };
function ctx(over) {
    const settings = C.sanitizeSettings(Object.assign({ base: 'KRW', travel: 'JPY' }, over || {}), NOW);
    return { rates: RATES, ratesTimestamp: NOW - 1000, settings, now: NOW };
}
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

console.log('parseLooseNumber');
test('구분자 둘: 마지막이 소수점', () => {
    assert.strictEqual(C.parseLooseNumber('1.234,56', 'EUR'), 1234.56);
    assert.strictEqual(C.parseLooseNumber('1,234.56', 'USD'), 1234.56);
    assert.strictEqual(C.parseLooseNumber('1.234.567,8', 'EUR'), 1234567.8);
    assert.strictEqual(C.parseLooseNumber('1,234,567.89', 'USD'), 1234567.89);
});
test('같은 구분자 2회 이상 → 천 단위', () => {
    assert.strictEqual(C.parseLooseNumber('1.234.567', 'EUR'), 1234567);
    assert.strictEqual(C.parseLooseNumber('1,234,567', 'USD'), 1234567);
    assert.strictEqual(C.parseLooseNumber('1.234.567', 'EUR', { forceDecimal: true }), 1234567);
});
test('소수점 없는 통화 → 천 단위', () => {
    assert.strictEqual(C.parseLooseNumber('1.200', 'JPY'), 1200);
    assert.strictEqual(C.parseLooseNumber('15.000', 'IDR'), 15000);
    assert.strictEqual(C.parseLooseNumber('1,5', 'KRW'), 15);
    assert.strictEqual(C.parseLooseNumber('¥1,980', 'JPY'), 1980);
});
test('뒤 3자리 → 천 단위, 정수부 0 이면 소수점', () => {
    assert.strictEqual(C.parseLooseNumber('1,234', 'USD'), 1234);
    assert.strictEqual(C.parseLooseNumber('1.234', 'EUR'), 1234);
    assert.strictEqual(C.parseLooseNumber('0.500', 'USD'), 0.5);
    assert.strictEqual(C.parseLooseNumber('0,125', 'EUR'), 0.125);
    assert.strictEqual(C.parseLooseNumber('.500', 'USD'), 0.5);
});
test('그 외 → 소수점', () => {
    assert.strictEqual(C.parseLooseNumber('12,50', 'EUR'), 12.5);
    assert.strictEqual(C.parseLooseNumber('3.99', 'USD'), 3.99);
    assert.strictEqual(C.parseLooseNumber('12.5', 'USD'), 12.5);
    assert.strictEqual(C.parseLooseNumber('1234,5678', 'EUR'), 1234.5678);
});
test('forceDecimal: 구분자 하나면 항상 소수점 (환율 입력)', () => {
    assert.strictEqual(C.parseLooseNumber('9,123', 'KRW', { forceDecimal: true }), 9.123);
    assert.strictEqual(C.parseLooseNumber('1.234', 'JPY', { forceDecimal: true }), 1.234);
    assert.strictEqual(C.parseLooseNumber('912,5', 'KRW', { forceDecimal: true }), 912.5);
});
test('기호·공백·아포스트로피·잘못된 입력', () => {
    assert.strictEqual(C.parseLooseNumber('€ 12,99', 'EUR'), 12.99);
    assert.strictEqual(C.parseLooseNumber("CHF 1'234.50", 'CHF'), 1234.5);
    assert.strictEqual(C.parseLooseNumber('1 234,56', 'EUR'), 1234.56);
    assert.strictEqual(C.parseLooseNumber('1200円', 'JPY'), 1200);
    assert.strictEqual(C.parseLooseNumber('1,200.', 'USD'), 1200);
    assert.strictEqual(C.parseLooseNumber('500', 'KRW'), 500);
    assert.ok(Number.isNaN(C.parseLooseNumber('', 'USD')));
    assert.ok(Number.isNaN(C.parseLooseNumber('abc', 'USD')));
    assert.ok(Number.isNaN(C.parseLooseNumber(null, 'USD')));
});

console.log('통화 판별');
test('명시 표식 우선, 모호 기호는 여행지 통화 + inferred', () => {
    assert.deepStrictEqual(C.detectCurrency('1200円', 'USD'), { currency: 'JPY', inferred: false });
    assert.deepStrictEqual(C.detectCurrency('35元', 'JPY'), { currency: 'CNY', inferred: false });
    assert.deepStrictEqual(C.detectCurrency('HK$ 45', 'USD'), { currency: 'HKD', inferred: false });
    assert.deepStrictEqual(C.detectCurrency('$4.99', 'SGD'), { currency: 'SGD', inferred: true });
    assert.deepStrictEqual(C.detectCurrency('$4.99', 'JPY'), { currency: 'USD', inferred: true });
    assert.deepStrictEqual(C.detectCurrency('¥980', 'CNY'), { currency: 'CNY', inferred: true });
    assert.deepStrictEqual(C.detectCurrency('980', 'THB'), { currency: 'THB', inferred: true });
    assert.deepStrictEqual(C.detectCurrency('EUR 9,90', 'JPY'), { currency: 'EUR', inferred: false });
});

console.log('포맷');
test('formatDisplay (기존 로직)', () => {
    assert.strictEqual(C.formatDisplay(1234567, 'KRW'), '1,234,567');
    assert.strictEqual(C.formatDisplay(1234.5, 'USD'), '1,234.50');
    assert.strictEqual(C.formatDisplay(0, 'JPY'), '0');
    assert.strictEqual(C.formatDisplay(0, 'USD'), '0.00');
    assert.strictEqual(C.formatDisplay(0.5, 'USD'), '0.5000');
    assert.strictEqual(C.formatDisplay(NaN, 'USD'), '—');
});
test('반올림 단위는 소수점 없는 통화에만', () => {
    assert.strictEqual(C.formatMoney(12345, 'KRW', 100), '12,300 KRW');
    assert.strictEqual(C.formatMoney(12355, 'KRW', 10), '12,360 KRW');
    assert.strictEqual(C.formatMoney(12.345, 'USD', 100), '12.35 USD');
});
test('formatEditable 은 재파싱해도 같은 값', () => {
    for (const [v, c] of [[1234.5, 'USD'], [1200, 'JPY'], [0.5, 'EUR'], [12.99, 'EUR'], [1234, 'USD']]) {
        assert.strictEqual(C.parseLooseNumber(C.formatEditable(v, c), c), v);
    }
});

console.log('환율 우선순위');
test('자동: 시장 환율', () => {
    const r = C.resolveRate(ctx(), 'JPY', 'KRW');
    assert.strictEqual(r.source, 'market');
    near(r.rate, 1400 / 150);
});
test('수수료: 시장 × (1+수수료), 활성 프로필', () => {
    const card = C.resolveRate(ctx({ rateMode: 'fee' }), 'JPY', 'KRW');
    assert.strictEqual(card.source, 'fee');
    near(card.rate, (1400 / 150) * 1.015);
    const cash = C.resolveRate(ctx({ rateMode: 'fee', feeProfile: 'cash', fees: { card: 1.5, cash: 4 } }), 'JPY', 'KRW');
    near(cash.rate, (1400 / 150) * 1.04);
});
test('수동: 통화쌍 설정 시 수동 값, 수수료 이중 가산 안 함', () => {
    const c = ctx({ rateMode: 'manual', fees: { card: 5, cash: 5 }, manual: { JPY_KRW: { rate: 9.5, savedAt: NOW - DAY } } });
    const r = C.resolveRate(c, 'JPY', 'KRW');
    assert.strictEqual(r.source, 'manual');
    assert.strictEqual(r.rate, 9.5);
    assert.strictEqual(r.stale, false);
    near(C.resolveRate(c, 'KRW', 'JPY').rate, 1 / 9.5);   // 역방향
});
test('수동 모드인데 통화쌍 미설정 → 시장 환율 fallback 표시', () => {
    const r = C.resolveRate(ctx({ rateMode: 'manual' }), 'EUR', 'KRW');
    assert.strictEqual(r.source, 'manual_fallback');
    near(r.rate, 1400 / 0.9);
});
test('환율 없는 통화 → null, 같은 통화 → 1', () => {
    assert.strictEqual(C.resolveRate(ctx(), 'THB', 'KRW'), null);
    assert.strictEqual(C.resolveRate(ctx({ rateMode: 'fee' }), 'KRW', 'KRW').rate, 1);
});
test('오래됨: 수동 7일 경과 / 시장 캐시 24시간 초과', () => {
    const c = ctx({ rateMode: 'manual', manual: { JPY_KRW: { rate: 9.5, savedAt: NOW - 8 * DAY } } });
    assert.strictEqual(C.resolveRate(c, 'JPY', 'KRW').stale, true);
    assert.strictEqual(C.rateBadge(c).kind, 'manual');
    assert.strictEqual(C.rateBadge(c).stale, true);
    assert.strictEqual(C.rateBadge(c).unit, 100);
    near(C.rateBadge(c).value, 950);
    const old = Object.assign(ctx(), { ratesTimestamp: NOW - 25 * 60 * 60 * 1000 });
    assert.strictEqual(C.rateBadge(old).stale, true);
    assert.strictEqual(C.rateBadge(ctx()).stale, false);
});
test('편차 계산과 ±20% 확인', () => {
    near(C.deviationPct(11, 10), 10);
    assert.strictEqual(C.needsDeviationConfirm(12.1, 10), true);   // +21%
    assert.strictEqual(C.needsDeviationConfirm(0.91, 9.1), true);  // 자릿수 오입력
    assert.strictEqual(C.needsDeviationConfirm(9.5, 9.1), false);
    assert.strictEqual(C.needsDeviationConfirm(9.5, null), false);
});

console.log('설정 정화');
test('잘못된 값은 기본값으로', () => {
    const s = C.sanitizeSettings({
        lang: 'fr', base: 'XXX', travel: 123, rateMode: 'crypto', feeProfile: 'gold',
        fees: { card: -1, cash: 99 }, rounding: 7, showUnitPrice: 'yes', onboarded: 1,
        secondary: 'USD',
    }, NOW);
    const d = C.defaultSettings();
    assert.strictEqual(s.lang, d.lang);
    assert.strictEqual(s.base, d.base);
    assert.strictEqual(s.travel, d.travel);
    assert.strictEqual(s.rateMode, 'auto');
    assert.strictEqual(s.feeProfile, 'card');
    assert.deepStrictEqual(s.fees, { card: 1.5, cash: 3 });
    assert.strictEqual(s.rounding, 1);
    assert.strictEqual(s.showUnitPrice, true);
    assert.strictEqual(s.onboarded, false);
    assert.deepStrictEqual(C.sanitizeSettings(null), d);
    assert.deepStrictEqual(C.sanitizeSettings([1, 2]), d);
});
test('수동 환율·보조 통화 정화 (범위·중복·최대 3)', () => {
    const s = C.sanitizeSettings({
        base: 'USD',
        manual: {
            JPY_KRW: { rate: 9.1, savedAt: NOW - DAY },
            KRW_KRW: { rate: 1, savedAt: NOW },
            ABC_KRW: { rate: 1, savedAt: NOW },
            EUR_KRW: { rate: -5, savedAt: NOW },
            CNY_KRW: { rate: 190, savedAt: NOW + 30 * DAY },
            'jpy_krw': { rate: 9, savedAt: NOW },
        },
        secondary: ['USD', 'EUR', 'EUR', 'XXX', 'JPY', 'CNY', 'GBP'],
    }, NOW);
    assert.deepStrictEqual(Object.keys(s.manual), ['JPY_KRW']);
    assert.deepStrictEqual(s.secondary, ['EUR', 'JPY', 'CNY']);
});
test('가져오기 검증', () => {
    assert.strictEqual(C.parseImportedSettings('not json').ok, false);
    assert.strictEqual(C.parseImportedSettings('[1]').error, 'shape');
    assert.strictEqual(C.parseImportedSettings('{"v":2}').error, 'version');
    const r = C.parseImportedSettings('{"v":1,"base":"USD","rateMode":"fee","lang":"zz"}', NOW);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.settings.base, 'USD');
    assert.strictEqual(r.settings.rateMode, 'fee');
    assert.strictEqual(r.settings.lang, 'ko');
});
test('기기 언어/시간대 추정', () => {
    assert.deepStrictEqual(C.guessDefaults({ language: 'ko-KR', timeZone: 'Asia/Tokyo' }),
        { lang: 'ko', base: 'KRW', travel: 'JPY' });
    assert.deepStrictEqual(C.guessDefaults({ language: 'ko-KR', timeZone: 'Asia/Seoul' }),
        { lang: 'ko', base: 'KRW', travel: 'JPY' });
    assert.deepStrictEqual(C.guessDefaults({ language: 'en-US', timeZone: 'Europe/Paris' }),
        { lang: 'en', base: 'USD', travel: 'EUR' });
    assert.deepStrictEqual(C.guessDefaults({ language: 'zh-TW', timeZone: 'Asia/Bangkok' }),
        { lang: 'en', base: 'TWD', travel: 'THB' });
    assert.strictEqual(C.guessDefaults({}).base, 'KRW');
});

console.log('인식 결과 정규화');
test('가격표: 통화 코드 검증·추정 표시·신뢰도·단가', () => {
    const r = C.normalizeRecognition({
        mode: 'price', notes: 'ok',
        items: [
            { amount: 298, currency: 'JPY', currency_inferred: false, label: '우유', confidence: 0.9,
              unit_price: { amount: 29.8, per: '100ml' }, is_discounted: true, tax_included: true },
            { amount: 5, currency: 'dollar', confidence: 0.4 },
            { amount: -1, currency: 'JPY' },
            { amount: 'abc', currency: 'JPY' },
            { amount: 3, currency: 'ZZZ', confidence: 2 },
        ],
    }, { travel: 'JPY' });
    assert.strictEqual(r.rows.length, 3);
    const [a, b, c] = r.rows;
    assert.strictEqual(a.inferred, false);
    assert.strictEqual(a.lowConf, false);
    assert.deepStrictEqual(a.unitPrice, { amount: 29.8, per: '100ml' });
    assert.strictEqual(a.discounted, true);
    assert.strictEqual(a.taxIncluded, true);
    assert.strictEqual(b.currency, 'JPY');
    assert.strictEqual(b.inferred, true);
    assert.strictEqual(b.lowConf, true);
    assert.strictEqual(b.taxIncluded, null);
    assert.strictEqual(c.currency, 'JPY');
    assert.strictEqual(c.lowConf, true);   // 범위 밖 신뢰도 → 0
});
test('지폐: 권종·매수(1~99)', () => {
    const r = C.normalizeRecognition({
        mode: 'cash',
        items: [{ currency: 'USD', denomination: 20, count: 3, confidence: 0.95 },
                { currency: 'USD', denomination: 100, count: 500, confidence: 0.7 },
                { currency: 'USD', denomination: 0, count: 1 }],
    }, { travel: 'JPY' });
    assert.strictEqual(r.mode, 'cash');
    assert.strictEqual(r.rows.length, 2);
    assert.strictEqual(r.rows[0].amount, 20);
    assert.strictEqual(r.rows[0].qty, 3);
    assert.strictEqual(r.rows[1].qty, 99);
    assert.deepStrictEqual(C.normalizeRecognition(null, { travel: 'JPY' }).rows, []);
});

console.log('장바구니');
test('합계: 통화 혼합, 보조 통화, 통화별 소계', () => {
    const c = ctx({ secondary: ['USD', 'EUR'] });
    const items = [
        { currency: 'JPY', amount: 1500, qty: 2 },
        { currency: 'USD', amount: 10, qty: 1 },
        { currency: 'KRW', amount: 5000, qty: 1 },
    ];
    const t = C.cartTotals(items, c);
    near(t.base.total, 3000 * (1400 / 150) + 10 * 1400 + 5000, 1e-6);
    assert.strictEqual(t.base.code, 'KRW');
    assert.strictEqual(t.secondary.length, 2);
    near(t.secondary[0].total, 3000 / 150 + 10 + 5000 / 1400, 1e-9);
    assert.strictEqual(t.byCurrency.find(g => g.code === 'JPY').sum, 3000);
    assert.strictEqual(t.excluded.length, 0);
});
test('환율 없는 통화는 합계 제외 + 사유', () => {
    const t = C.cartTotals([
        { currency: 'JPY', amount: 1000, qty: 1 },
        { currency: 'THB', amount: 100, qty: 2 },
    ], ctx({ secondary: [] }));
    near(t.base.total, 1000 * (1400 / 150), 1e-6);
    assert.deepStrictEqual(t.excluded, [{ code: 'THB', reason: 'no_rate' }]);
    assert.strictEqual(t.includedCount, 1);
    assert.strictEqual(t.byCurrency.find(g => g.code === 'THB').sum, 200);
});
test('합계는 수동/수수료 환율을 따름', () => {
    const items = [{ currency: 'JPY', amount: 1000, qty: 1 }];
    const m = C.cartTotals(items, ctx({ rateMode: 'manual', manual: { JPY_KRW: { rate: 10, savedAt: NOW } } }));
    near(m.base.total, 10000, 1e-9);
    const f = C.cartTotals(items, ctx({ rateMode: 'fee' }));
    near(f.base.total, 1000 * (1400 / 150) * 1.015, 1e-6);
});
test('장바구니 저장값 정화', () => {
    const s = C.sanitizeCart([{ currency: 'JPY', amount: 100, qty: 150, label: 'a' },
                              { currency: 'XXX', amount: 1 }, { currency: 'JPY', amount: 0 }, 'x']);
    assert.strictEqual(s.length, 1);
    assert.strictEqual(s[0].qty, 99);
    assert.deepStrictEqual(C.sanitizeCart({}), []);
});

console.log('카메라 보조');
test('object-fit: cover 크롭 보정', () => {
    // 1920×1080 영상을 390×844 세로 화면에 cover → 높이 기준 scale
    const scale = 844 / 1080;
    const r = C.coverCropRect({ vw: 1920, vh: 1080 }, { ew: 390, eh: 844 }, { x: 45, y: 322, w: 300, h: 200 });
    const ox = (390 - 1920 * scale) / 2;
    assert.strictEqual(r.sx, Math.round((45 - ox) / scale));
    assert.strictEqual(r.sy, Math.round(322 / scale));
    assert.strictEqual(r.sw, Math.round(300 / scale));
    assert.strictEqual(r.sh, Math.round(200 / scale));
    const full = C.coverCropRect({ vw: 100, vh: 100 }, { ew: 100, eh: 100 }, { x: -10, y: -10, w: 200, h: 200 });
    assert.deepStrictEqual(full, { sx: 0, sy: 0, sw: 100, sh: 100 });
});
test('긴 변 1024 축소 (확대 안 함)', () => {
    assert.deepStrictEqual(C.fitWithin(4032, 3024, 1024), { w: 1024, h: 768 });
    assert.deepStrictEqual(C.fitWithin(800, 600, 1024), { w: 800, h: 600 });
});
test('자동 촬영: 1.2초 안정 후 1회, 장면 바뀔 때까지 재촬영 금지, 일시정지', () => {
    const ac = C.createAutoCapture();
    const A = new Array(576).fill(100), B = new Array(576).fill(160);
    let shots = 0;
    for (let t = 0; t <= 3000; t += 200) if (ac.step(A, t, false)) shots++;
    assert.strictEqual(shots, 1);
    for (let t = 3200; t <= 6000; t += 200) if (ac.step(B, t, false)) shots++;
    assert.strictEqual(shots, 2);
    ac.reset();
    for (let t = 0; t <= 3000; t += 200) if (ac.step(A, t, true)) shots++;
    assert.strictEqual(shots, 2);
});
test('인식 힌트: 통화코드만, 최대 12개', () => {
    const h = C.buildHint(C.sanitizeSettings({ base: 'KRW', travel: 'THB', secondary: ['USD', 'EUR', 'JPY'] }), 'en');
    assert.strictEqual(h.travel, 'THB');
    assert.ok(h.candidates.length <= 12);
    assert.ok(h.candidates.every(c => /^[A-Z]{3}$/.test(c)));
    assert.strictEqual(new Set(h.candidates).size, h.candidates.length);
    assert.strictEqual(h.lang, 'en');
});
test('일일 사용량은 날짜가 바뀌면 초기화', () => {
    const u = C.usageToday({ day: C.todayKey(NOW), count: 5 }, NOW);
    assert.strictEqual(u.count, 5);
    assert.strictEqual(C.usageToday({ day: '2000-01-01', count: 5 }, NOW).count, 0);
    assert.strictEqual(C.usageToday('junk', NOW).count, 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
