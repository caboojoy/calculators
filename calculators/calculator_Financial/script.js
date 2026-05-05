    /* ═══════════════════════════════════════════════════════════
    금융상품 IFRS 분류·측정 계산기 (script.js)
    사채 · 전환사채(CB) · 상환전환우선주(RCPS)
    IAS 32 분류 엔진 + IFRS 9 상각후원가 측정 엔진

    수정 이력:
    - BUG FIX: 순액법 grossProceeds 오산출 → HYBRID 자본요소·비용 안분 오류
    - BUG FIX: 할증발행채 이자 분개 사채할증발행차금 차변/대변 위치 오류
    - BUG FIX: 시나리오 비교 탭 순액법·총액법 장부금액 불일치
    - IMPROVEMENT: IRR 뉴턴-랩슨 복수 초기값으로 수렴 실패 방지
    ═══════════════════════════════════════════════════════════ */
    const { useState, useMemo } = React;

    /* ── 유틸리티 ── */
    const KRW = n => new Intl.NumberFormat("ko-KR").format(Math.round(n ?? 0));
    const PCT  = n => ((n ?? 0) * 100).toFixed(4) + "%";
    const PCT2 = n => ((n ?? 0) * 100).toFixed(2) + "%";
    const freqMap = { yearly: 1, quarterly: 4, monthly: 12 };
    function addMonths(d, mo) {
    const x = new Date(d);
    x.setMonth(x.getMonth() + mo);
    return x.toISOString().slice(0, 10);
    }

    /* ── IRR (뉴턴-랩슨, 복수 초기값) ── */
    function calcIRR(cfs) {
    for (const g of [0.05, 0.1, 0.01, 0.2, 0.3, 0.005, 0.5]) {
        let r = g, ok = false;
        for (let i = 0; i < 500; i++) {
        let f = 0, df = 0;
        cfs.forEach((c, t) => {
            const d = Math.pow(1 + r, t);
            f += c / d;
            if (t > 0) df -= t * c / (d * (1 + r));
        });
        if (Math.abs(f) < 0.01) { ok = true; break; }
        if (Math.abs(df) < 1e-12) break;
        const rn = r - f / df;
        if (!isFinite(rn) || rn <= -1) break;
        if (Math.abs(rn - r) < 1e-12) { r = rn; ok = true; break; }
        r = rn;
        }
        if (ok && r > -1 && r < 50 && isFinite(r)) return r;
    }
    return 0.05;
    }
    const toAnnual   = (r, freq) => Math.pow(1 + r, freqMap[freq]) - 1;
    const toPeriodic = (r, freq) => Math.pow(1 + r, 1 / freqMap[freq]) - 1;

    /* ── IAS 32 분류 엔진 ── */
    function classify({ hasMandatoryRedemption, dividendType, hasConversionOption, conversionFixed }) {
    if (hasMandatoryRedemption) {
        if (hasConversionOption && conversionFixed) return {
        type: "HYBRID", label: "복합금융상품 (부채 + 자본)",
        steps: [
            "의무상환 조건 존재 → 계약상 현금 지급 의무 → 금융부채 요소 식별 (IAS 32.11)",
            "고정수량·고정가격 전환권 (fixed-for-fixed) → 자본 요소 식별 (IAS 32.16)",
            "두 요소 공존 → 복합금융상품으로 부채/자본 분리 인식 (IAS 32.28)",
            "발행비용 → 부채/자본 공정가치 비율로 안분 배부 (IAS 32.38)"
        ]
        };
        if (hasConversionOption) return {
        type: "LIABILITY", label: "금융부채 + 내재파생상품 (FVTPL)",
        steps: [
            "의무상환 조건 존재 → 금융부채 요소 식별 (IAS 32.11)",
            "전환가격 변동 → fixed-for-fixed 조건 미충족 → 자본 분류 불가 (IAS 32.16)",
            "전환권 = 내재파생상품 → IFRS 9.4.3.3: 파생상품 FVTPL 처리",
            "주계약(사채 부분) 상각후원가(AC) 측정 가능성 별도 검토 필요"
        ]
        };
        return {
        type: "LIABILITY", label: "금융부채",
        steps: [
            "의무상환 조건 존재 → 계약상 현금 지급 의무 (IAS 32.11)",
            "전환권 없음 → 자본 요소 없음",
            "전액 금융부채 분류",
            "IFRS 9: 상각후원가(AC), 유효이자율(EIR)법 적용"
        ]
        };
    }
    if (dividendType === "discretionary") return {
        type: "EQUITY", label: "자본",
        steps: [
        "의무상환 조건 없음 → 원금 상환 의무 없음",
        "재량적 배당 → 배당 지급 계약상 의무 없음 (IAS 32.11)",
        "발행자에게 계약상 지급 의무 없음 → 자본 분류 (IAS 32.16)",
        "발행비용 → 자본(주식발행초과금)에서 직접 차감 (IAS 32.37)"
        ]
    };
    return {
        type: "HYBRID", label: "복합금융상품 (부채 + 자본)",
        steps: [
        "의무상환 조건 없음 → 원금 상환 의무 없음",
        "고정/변동(비재량) 배당 → 배당 지급 계약상 의무 존재 → 부채 요소 식별",
        "잔여지분 → 자본 요소 식별",
        "복합금융상품으로 부채/자본 분리 인식 (IAS 32.28)"
        ]
    };
    }

    /* ── IFRS 9 계산 엔진 ──
    BUG FIX: gross = 투자자 지급 총액(비용 차감 전)으로 통일
        순액법: issuePrice = 회사 수취액(순액) → gross = issuePrice + issuanceCost
        총액법: issuePrice = 투자자 지급 총액   → gross = issuePrice
    두 방법 모두 net(장부금액) = gross - issuanceCost 로 동일해야 함. ── */
    function runCalc(f) {
    const cls = classify(f);
    const n = freqMap[f.frequency], mpp = 12 / n;
    const periods = Math.round(
        (new Date(f.maturityDate) - new Date(f.issueDate)) / (365.25 * 864e5) * n
    );
    if (periods <= 0) throw new Error("만기일은 발행일 이후여야 합니다");

    // FIXED: gross = 총발행금액(투자자 지급 기준), net = 회사 순수취액
    const gross = f.issuanceCostMethod === "net"
        ? f.issuePrice + f.issuanceCost  // 순액법: 입력값에 비용 복원
        : f.issuePrice;                   // 총액법: 입력값 = 총액
    const net = gross - f.issuanceCost;

    const couponPP  = f.faceValue * f.couponRate / n;
    const years     = periods / n;

    /* ── 상환할증금 계산 (IAS 32, 한국 CB 실무)
        보장수익률(g) 조건: 만기까지 보유 시 총수익 = fv × (1+g)^years
        만기상환금 = fv × (1+g)^years − 쿠폰의 미래가치합
        상환할증금 = 만기상환금 − fv

        핵심: 쿠폰의 단순합이 아닌 각 쿠폰을 만기까지 보장수익률로 복리한
            미래가치합(couponFVSum)을 차감해야 IRR = 보장수익률이 정확히 성립.

        couponFVSum = Σ[couponPP × (1+g_p)^(periods−t)]  for t = 1..periods
        여기서 g_p = (1+g)^(1/n) − 1  (기간별 복리 보장수익률) ── */
    const guarLumpSum = (() => {
        if (!f.hasGuaranteeYield) return 0;
        const g_p = toPeriodic(f.guaranteeRate, f.frequency);
        let couponFVSum = 0;
        for (let t = 1; t <= periods; t++) {
        couponFVSum += couponPP * Math.pow(1 + g_p, periods - t);
        }
        return Math.max(0, f.faceValue * Math.pow(1 + f.guaranteeRate, years) - couponFVSum - f.faceValue);
    })();
    const cashPP  = couponPP;  // 매기 현금흐름: 쿠폰만
    const flows   = Array.from({ length: periods }, (_, i) =>
        i === periods - 1 ? couponPP + f.faceValue + guarLumpSum : couponPP
    );

    /* 자본 (EQUITY) */
    if (cls.type === "EQUITY") {
        return {
        cls, n, mpp, periods, gross, net, fv: f.faceValue,
        couponPP, guarLumpSum, cashPP, flows,
        liab: 0, eq: net, liabGross: 0, eqGross: gross,
        liabCost: 0, eqCost: f.issuanceCost,
        eir: 0, annEIR: 0, sched: []
        };
    }

    /* 부채 (LIABILITY) */
    if (cls.type === "LIABILITY") {
        const eirP   = calcIRR([-net, ...flows]);
        const annEIR = toAnnual(eirP, f.frequency);
        return {
        cls, n, mpp, periods, gross, net, fv: f.faceValue,
        couponPP, guarLumpSum, cashPP, flows,
        liab: net, eq: 0, liabGross: net, eqGross: 0,
        liabCost: f.issuanceCost, eqCost: 0,
        eir: eirP, annEIR,
        sched: buildSched(net, flows, eirP, f.issueDate, mpp)
        };
    }

    /* 복합 (HYBRID) — 잔여접근법 IAS 32.31 + 비용 안분 IAS 32.38
        FIXED: gross(총발행) 기준으로 자본요소 산출 및 비용 안분
        FIXED: pmkt = 명목연이자율 / 지급횟수 (단순분할)
                한국 채권시장 관행: 시장이자율은 명목연이자율(APR)로 고시되며
                기간이자율은 단순분할(r/n) 적용 — 복리환산((1+r)^(1/n)-1)과 구분 ── */
    const pmkt      = f.marketRate / n;  // FIXED: 단순분할 (한국 시장 관행)
    const liabGross = flows.reduce((s, c, i) => s + c / Math.pow(1 + pmkt, i + 1), 0);
    const eqGross   = Math.max(0, gross - liabGross);
    const liabCost  = gross > 0 ? f.issuanceCost * liabGross / gross : 0;
    const eqCost    = f.issuanceCost - liabCost;
    const liabNet   = liabGross - liabCost;
    const eqNet     = eqGross  - eqCost;
    const eirP      = calcIRR([-liabNet, ...flows]);
    const annEIR    = toAnnual(eirP, f.frequency);

    return {
        cls, n, mpp, periods, gross, net, fv: f.faceValue,
        couponPP, guarLumpSum, cashPP, flows,
        liab: liabNet, eq: eqNet, liabGross, eqGross, liabCost, eqCost,
        pmkt, annMkt: f.marketRate, eir: eirP, annEIR,
        sched: buildSched(liabNet, flows, eirP, f.issueDate, mpp)
    };
    }

    /* ── 상각표 생성 ── */
    function buildSched(ca0, cfs, eir, issueDate, mpp) {
    let ca = ca0;
    return cfs.map((cash, i) => {
        const open = ca, intr = open * eir, amort = intr - cash;
        ca = open + amort;
        return { period: i + 1, date: addMonths(issueDate, (i + 1) * mpp), open, intr, cash, amort, close: ca };
    });
    }

    /* ── 보고기준일 조회 ── */
    function getAsOf(sched, issueDate, asOfDate) {
    if (!sched?.length || !asOfDate) return null;
    const asOf = new Date(asOfDate), issue = new Date(issueDate);
    if (asOf <= issue) return { ca: sched[0].open, accrued: 0, note: "발행일" };
    const last = sched[sched.length - 1];
    if (asOf >= new Date(last.date)) return { ca: last.close, accrued: 0, note: "만기 이후" };
    for (let i = 0; i < sched.length; i++) {
        const pe = new Date(sched[i].date), ps = i === 0 ? issue : new Date(sched[i - 1].date);
        if (asOf <= pe) {
        const fr = (asOf - ps) / (pe - ps);
        return {
            ca:      sched[i].open + (sched[i].close - sched[i].open) * fr,
            accrued: sched[i].intr * fr,
            fr, period: i + 1,
            ps: ps.toISOString().slice(0, 10), pe: sched[i].date,
            note: `제${i + 1}기 중 (${(fr * 100).toFixed(1)}% 경과)`
        };
        }
    }
    return null;
    }

    /* ── 분개 생성
    BUG FIX: 할증발행채(amort < 0) 시 사채할증발행차금상각 → 차변(Dr)
        할인: Dr 이자비용 = Cr 현금 + Cr 사채할인발행차금상각
        할증: Dr 이자비용 + Dr 사채할증발행차금상각 = Cr 현금 ── */
    function makeJournals(res, f) {
    if (!res) return [];
    const { cls, liab, eq, liabGross, eqGross, liabCost, eqCost, sched, net, gross, fv } = res;
    const { issueDate, issuanceCost, issuanceCostMethod } = f;
    const jnl = [];
    const costNote = issuanceCostMethod === "net"
        ? `순액법: 수취액 ${KRW(net)}원 (총발행 ${KRW(gross)}원 − 비용 ${KRW(issuanceCost)}원)`
        : `총액법: 총발행 ${KRW(gross)}원 수취 후 비용 ${KRW(issuanceCost)}원 별도 지급`;

    /* 발행 분개 */
    if (cls.type === "LIABILITY") {
        const disc = fv - liab;
        jnl.push({
        date: issueDate, title: "사채 발행",
        dr: [{ a: "현금및현금성자산", v: net }, ...(disc > 0 ? [{ a: "사채할인발행차금", v: disc }] : [])],
        cr: [{ a: "사채", v: fv },              ...(disc < 0 ? [{ a: "사채할증발행차금", v: -disc }] : [])],
        note: costNote + ` | 할인(+)/할증(−) ${KRW(disc)}원`
        });
    } else if (cls.type === "EQUITY") {
        jnl.push({
        date: issueDate, title: "우선주 발행",
        dr: [{ a: "현금및현금성자산", v: net }],
        cr: [
            { a: "우선주자본금", v: Math.min(fv, net) },
            ...(net > fv ? [{ a: "주식발행초과금", v: net - fv }] : [])
        ],
        note: costNote + " (자본: 발행비용 주발초 직접 차감)"
        });
    } else {
        const lg = liabGross, eg = eqGross, disc = fv - lg;
        jnl.push({
        date: issueDate, title: "복합금융상품 발행 (잔여접근법)",
        dr: [{ a: "현금및현금성자산", v: gross }, ...(disc > 0 ? [{ a: "사채할인발행차금", v: disc }] : [])],
        cr: [
            { a: "사채(부채요소)", v: fv },
            { a: "전환권대가(자본요소)", v: eg },
            ...(disc < 0 ? [{ a: "사채할증발행차금", v: -disc }] : [])
        ],
        note: `잔여접근법: 부채FV ${KRW(lg)}원 선 측정 → 자본잔여 ${KRW(eg)}원 | ${costNote}`
        });
        if (issuanceCost > 0) jnl.push({
        date: issueDate, title: "발행비용 안분 배부 (IAS 32.38)",
        dr: [{ a: "사채할인발행차금 (부채요소)", v: liabCost }, { a: "전환권대가 차감 (자본요소)", v: eqCost }],
        cr: [{ a: "현금및현금성자산", v: issuanceCost }],
        note: `부채 ${KRW(liabCost)}원 (${((liabCost / issuanceCost) * 100).toFixed(1)}%) + 자본 ${KRW(eqCost)}원 (${((eqCost / issuanceCost) * 100).toFixed(1)}%)`
        });
    }

    /* 이자비용 분개 (최초 3기) */
    sched?.slice(0, 3).forEach(row => {
        const isDiscount = row.amort >= 0;
        jnl.push({
        date: row.date, title: `이자비용 인식 (제${row.period}기)`,
        // FIXED: 할증 시 사채할증발행차금상각 → 차변(Dr) (부채 감소 효과)
        dr: [
            { a: "이자비용", v: row.intr },
            ...(!isDiscount ? [{ a: "사채할증발행차금 상각", v: Math.abs(row.amort) }] : [])
        ],
        cr: [
            { a: "현금및현금성자산", v: row.cash },
            ...(isDiscount  ? [{ a: "사채할인발행차금 상각", v: row.amort }] : [])
        ],
        note: `기초CA(${KRW(row.open)}) × EIR(${PCT(res.eir)}) = ${KRW(row.intr)} | 현금 ${KRW(row.cash)} | 상각 ${KRW(row.amort)}${!isDiscount ? " ← 할증상각(Dr)" : ""}`
        });
    });

    /* 만기 상환 — 상환할증금 포함 */
    if (sched?.length && cls.type !== "EQUITY") {
        const last = sched[sched.length - 1];
        const guarLumpSum = res.guarLumpSum ?? 0;
        // 상각후원가 모델: EIR 상각을 통해 장부금액이 만기상환금액(액면+상환할증금)까지 증가
        // 만기 시 장부금액(last.open) = 총상환금액 → Dr/Cr 모두 totalRedemption
        const totalRedemption = fv + guarLumpSum;
        jnl.push({
        date: last.date, title: "만기 상환",
        dr: [{ a: "사채 (부채요소)", v: totalRedemption }],
        cr: [{ a: "현금및현금성자산", v: totalRedemption }],
        note: guarLumpSum > 0
            ? `액면 ${KRW(fv)}원 + 상환할증금 ${KRW(guarLumpSum)}원 = 총상환 ${KRW(totalRedemption)}원 | 장부금액이 EIR 상각을 통해 만기상환금액까지 증가함`
            : `만기 장부금액(${KRW(last.open)}) ≈ 액면금액(${KRW(fv)}) — 완전 상각 완료`
        });
    }
    return jnl;
    }

    /* ── 폼 준비 (% → 소수 변환) ── */
    function prepForm(form) {
    return {
        ...form,
        faceValue:     +form.faceValue,
        issuePrice:    +form.issuePrice,
        couponRate:    +form.couponRate    / 100,
        marketRate:    +form.marketRate    / 100,
        issuanceCost:  +form.issuanceCost,
        guaranteeRate: +form.guaranteeRate / 100,
    };
    }

    /* ── 공통 입력 스타일 (모듈 레벨 상수 — App 내부 정의 금지) ── */
    const INP_STYLE = { width: "100%", boxSizing: "border-box", fontSize: 13 };

    /* ── FI: 입력 필드 래퍼 ──
    IMPORTANT: 반드시 App 외부(모듈 레벨)에 정의해야 함.
    App 내부에서 정의하면 매 렌더마다 새 컴포넌트 참조가 생성되어
    React가 자식 input을 언마운트/재마운트 → 포커스 소실 버그 발생. ── */
    function FI({ label, note, children }) {
    return (
        <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 10, color: "var(--color-text-secondary)", display: "block", marginBottom: 2 }}>{label}</label>
        {children}
        {note && <div style={{ fontSize: 9, color: "var(--color-text-tertiary)", marginTop: 1 }}>{note}</div>}
        </div>
    );
    }

    /* ── NumInput: 천단위 구분 숫자 입력 ──
    - 포커스 중: 순수 숫자만 표시 (입력 편의)
    - 포커스 아웃: 천단위 콤마 포맷 표시 (가독성)
    - type="text" + inputMode="numeric": 콤마 입력 허용하면서 모바일 숫자 키패드 ── */
    function NumInput({ value, onChange, style }) {
    const [focused, setFocused] = useState(false);
    const display = focused
        ? value  // 입력 중: 순수 숫자 문자열 (커서 위치 유지)
        : (value ? parseInt(value || "0", 10).toLocaleString("ko-KR") : "");  // 포커스 아웃: 콤마 포맷
    return (
        <input
        type="text"
        inputMode="numeric"
        style={style || INP_STYLE}
        value={display}
        onChange={e => onChange(e.target.value.replace(/[^\d]/g, ""))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        />
    );
    }

    /* ── 색상 팔레트 ── */
    const CLS = {
    LIABILITY: { bg: "#FCEBEB", border: "#E24B4A", text: "#A32D2D", badge: { background: "#F7C1C1", color: "#A32D2D" } },
    EQUITY:    { bg: "#EAF3DE", border: "#639922", text: "#3B6D11", badge: { background: "#C0DD97", color: "#3B6D11" } },
    HYBRID:    { bg: "#EEEDFE", border: "#7F77DD", text: "#3C3489", badge: { background: "#CECBF6", color: "#3C3489" } },
    };

    /* ── 공통 카드 스타일 ── */
    const card = {
    background: "var(--color-background-primary)",
    border: "0.5px solid var(--color-border-tertiary)",
    borderRadius: "var(--border-radius-lg)",
    padding: "1rem 1.25rem",
    marginBottom: "12px",
    boxShadow: "0 1px 4px rgba(100,160,220,0.08)"
    };

    /* ── StatCard ── */
    function StatCard({ label, value, sub }) {
    return (
        <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 14px" }}>
        <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 16, fontWeight: 500 }}>{value}</div>
        {sub && <div style={{ fontSize: 10, color: "var(--color-text-tertiary)", marginTop: 2 }}>{sub}</div>}
        </div>
    );
    }

    /* ── TAB: 분류 결과 ── */
    function ClassTab({ res }) {
    const cs = CLS[res.cls.type], H = res.cls.type === "HYBRID";
    return (
        <div>
        <div style={{ ...card, background: cs.bg, border: `1.5px solid ${cs.border}`, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ ...cs.badge, fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 6 }}>{res.cls.type}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: cs.text }}>{res.cls.label}</span>
            </div>
            {res.cls.steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: cs.text, fontWeight: 500, minWidth: 50, flexShrink: 0 }}>Step {i + 1}</span>
                <span style={{ color: "var(--color-text-primary)", lineHeight: 1.5 }}>{s}</span>
            </div>
            ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, marginBottom: 12 }}>
            <StatCard label="총발행금액 (투자자 지급)" value={KRW(res.gross) + "원"} sub="발행비용 차감 전 총액" />
            <StatCard label="순수취액 (장부금액 기준)"  value={KRW(res.net)   + "원"} sub={`발행비용 ${KRW(res.liabCost + res.eqCost)}원 차감`} />
            {res.cls.type !== "EQUITY"    && <StatCard label="부채요소 장부금액" value={KRW(res.liab) + "원"} sub={H ? `총액 ${KRW(res.liabGross)}원 − 비용 ${KRW(res.liabCost)}원` : null} />}
            {res.cls.type !== "LIABILITY" && <StatCard label="자본요소 장부금액" value={KRW(res.eq)   + "원"} sub={H ? `총액 ${KRW(res.eqGross)}원 − 비용 ${KRW(res.eqCost)}원`   : null} />}
            {res.annEIR > 0 && <StatCard label="유효이자율 EIR (연)" value={PCT(res.annEIR)} sub={`기간이자율: ${PCT(res.eir)}`} />}
            {res.guarLumpSum > 0 && <StatCard label="만기 상환할증금" value={KRW(res.guarLumpSum) + "원"} sub="보장수익률 만기 일시 지급" />}
            <StatCard label="이자지급 기수" value={`${res.periods}회`} sub={`총 ${res.periods / res.n}년`} />
        </div>
        <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 8 }}>
            발행비용 조정 내역 — 현금수령액 vs 장부금액 (IFRS 9 B5.4.2)
            </div>
            {[
            ["총발행금액 (투자자 지급 / 현금수령)",  KRW(res.gross) + "원", false],
            ["(−) 발행비용 부채요소 배부", `(${KRW(res.liabCost)})원`, true],
            ...(H ? [["(−) 발행비용 자본요소 배부", `(${KRW(res.eqCost)})원`, true]] : []),
            ["최초 인식 합산 장부금액", KRW(res.liab + res.eq) + "원", false],
            ].map(([l, v, red], i, arr) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: i === arr.length - 1 ? "1px solid var(--color-border-secondary)" : "none", fontSize: 13 }}>
                <span style={{ color: red ? "var(--color-text-danger)" : "var(--color-text-secondary)" }}>{l}</span>
                <span style={{ fontWeight: i === arr.length - 1 ? 500 : 400, color: red ? "var(--color-text-danger)" : "var(--color-text-primary)" }}>{v}</span>
            </div>
            ))}
        </div>
        {H && (
            <div style={{ ...card, background: "#EEEDFE", border: "0.5px solid #AFA9EC" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "#3C3489", marginBottom: 5 }}>잔여접근법 계산 근거 (IAS 32.31) — 수정 완료</div>
            <div style={{ fontSize: 12, color: "#534AB7", lineHeight: 1.9 }}>
                ① 부채요소 = 미래현금흐름을 시장이자율({PCT2(res.annMkt)})로 할인한 현재가치 = <strong>{KRW(res.liabGross)}원</strong><br />
                ② 자본요소 = 총발행금액({KRW(res.gross)}) − 부채요소 공정가치({KRW(res.liabGross)}) = <strong>{KRW(res.eqGross)}원</strong><br />
                ③ 발행비용 비율 안분 (IAS 32.38) → 부채 <strong>{KRW(res.liabCost)}원</strong> / 자본 <strong>{KRW(res.eqCost)}원</strong>
            </div>
            </div>
        )}
        </div>
    );
    }

    /* ── TAB: 상각표 ── */
    function SchedTab({ res }) {
    if (res.cls.type === "EQUITY") return (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--color-text-secondary)" }}>
        <div style={{ fontSize: 15, marginBottom: 8 }}>자본으로 분류된 상품은 상각표가 없습니다.</div>
        <div style={{ fontSize: 13 }}>배당 지급 시 이익잉여금 차감 처리합니다.</div>
        </div>
    );
    const { sched } = res;
    const totIntr  = sched.reduce((s, r) => s + r.intr,  0);
    const totCash  = sched.reduce((s, r) => s + r.cash,  0);
    const totAmort = sched.reduce((s, r) => s + r.amort, 0);
    const th = { padding: "7px 8px", fontWeight: 500, fontSize: 11, color: "var(--color-text-secondary)", borderBottom: "0.5px solid var(--color-border-secondary)", background: "var(--color-background-secondary)", whiteSpace: "nowrap" };
    return (
        <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 12 }}>
            <StatCard label="유효이자율 EIR (연)" value={PCT(res.annEIR)} sub={`기간이자율: ${PCT(res.eir)}`} />
            <StatCard label="총 이자비용"         value={KRW(totIntr)  + "원"} />
            <StatCard label="총 현금지급"         value={KRW(totCash)  + "원"} />
            <StatCard label="총 상각액"           value={KRW(totAmort) + "원"} sub={totAmort > 0 ? "할인발행(+)" : "할증발행(−)"} />
        </div>
        <div style={{ overflowX: "auto", border: "0.5px solid var(--color-border-secondary)", borderRadius: "var(--border-radius-md)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 580 }}>
            <thead>
                <tr>{["기", "지급일", "기초 장부금액", "이자비용 (EIR×CA)", "현금지급", "상각액", "기말 장부금액"].map((h, i) => (
                <th key={i} style={{ ...th, textAlign: i < 2 ? "left" : "right" }}>{h}</th>
                ))}</tr>
            </thead>
            <tbody>
                {sched.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "var(--color-background-primary)" : "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <td style={{ padding: "6px 8px", fontWeight: 500 }}>{row.period}</td>
                    <td style={{ padding: "6px 8px", color: "var(--color-text-secondary)", fontSize: 10 }}>{row.date}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{KRW(row.open)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#185FA5" }}>{KRW(row.intr)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "#A32D2D" }}>({KRW(row.cash)})</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: row.amort >= 0 ? "#3B6D11" : "#A32D2D" }}>{KRW(row.amort)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 500 }}>{KRW(row.close)}</td>
                </tr>
                ))}
                <tr style={{ background: "var(--color-background-secondary)", borderTop: "1.5px solid var(--color-border-secondary)", fontWeight: 500 }}>
                <td colSpan={2} style={{ padding: "7px 8px" }}>합 계</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--color-text-tertiary)" }}>—</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "#185FA5" }}>{KRW(totIntr)}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "#A32D2D" }}>({KRW(totCash)})</td>
                <td style={{ padding: "7px 8px", textAlign: "right" }}>{KRW(totAmort)}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "var(--color-text-tertiary)" }}>—</td>
                </tr>
            </tbody>
            </table>
        </div>
        </div>
    );
    }

    /* ── TAB: 분개 ── */
    function JournalEntry({ j }) {
    const rows    = Math.max(j.dr.length, j.cr.length);
    const drTotal = j.dr.reduce((s, x) => s + x.v, 0);
    const crTotal = j.cr.reduce((s, x) => s + x.v, 0);
    const balanced = Math.abs(drTotal - crTotal) < 1;
    return (
        <div style={card}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 8, justifyContent: "space-between" }}>
            <div>
            <span style={{ fontWeight: 500, fontSize: 13 }}>{j.title}</span>
            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", marginLeft: 8 }}>{j.date}</span>
            </div>
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: balanced ? "var(--color-background-success)" : "var(--color-background-danger)", color: balanced ? "var(--color-text-success)" : "var(--color-text-danger)" }}>
            {balanced ? "차대 균형 ✓" : "차대 불균형 !"}
            </span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
            <tr style={{ borderBottom: "0.5px solid var(--color-border-secondary)" }}>
                <th style={{ textAlign: "left",  padding: "3px 6px", fontWeight: 500, fontSize: 10, color: "var(--color-text-secondary)", width: "40%" }}>차변 (Dr)</th>
                <th style={{ textAlign: "right", padding: "3px 6px", fontWeight: 500, fontSize: 10, color: "var(--color-text-secondary)", width: "10%" }}>금액</th>
                <th style={{ textAlign: "left",  padding: "3px 6px 3px 12px", fontWeight: 500, fontSize: 10, color: "var(--color-text-secondary)", width: "40%", borderLeft: "0.5px solid var(--color-border-tertiary)" }}>대변 (Cr)</th>
                <th style={{ textAlign: "right", padding: "3px 6px", fontWeight: 500, fontSize: 10, color: "var(--color-text-secondary)", width: "10%" }}>금액</th>
            </tr>
            </thead>
            <tbody>
            {Array.from({ length: rows }, (_, i) => (
                <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                <td style={{ padding: "4px 6px", color: "#185FA5" }}>{j.dr[i]?.a ?? ""}</td>
                <td style={{ padding: "4px 6px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{j.dr[i] ? KRW(j.dr[i].v) : ""}</td>
                <td style={{ padding: "4px 6px 4px 12px", color: "#3B6D11", borderLeft: "0.5px solid var(--color-border-tertiary)" }}>{j.cr[i]?.a ?? ""}</td>
                <td style={{ padding: "4px 6px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 11 }}>{j.cr[i] ? KRW(j.cr[i].v) : ""}</td>
                </tr>
            ))}
            <tr style={{ borderTop: "0.5px solid var(--color-border-secondary)", fontSize: 11, color: "var(--color-text-tertiary)" }}>
                <td style={{ padding: "3px 6px", textAlign: "right" }} colSpan={2}>합계 {KRW(drTotal)}</td>
                <td style={{ padding: "3px 6px", textAlign: "right", borderLeft: "0.5px solid var(--color-border-tertiary)" }} colSpan={2}>합계 {KRW(crTotal)}</td>
            </tr>
            </tbody>
        </table>
        <div style={{ marginTop: 6, fontSize: 10, color: "var(--color-text-warning)", background: "var(--color-background-warning)", padding: "4px 8px", borderRadius: "var(--border-radius-md)" }}>{j.note}</div>
        </div>
    );
    }

    /* ── TAB: 기준일 조회 ── */
    function AsOfTab({ res, form, asOfDate, setAsOfDate, asOfRes }) {
    return (
        <div>
        <div style={{ marginBottom: 14, maxWidth: 260 }}>
            <label style={{ fontSize: 11, color: "var(--color-text-secondary)", display: "block", marginBottom: 3 }}>보고기준일 (As-of Date)</label>
            <input type="date" style={{ width: "100%", boxSizing: "border-box" }} value={asOfDate}
            min={form.issueDate} max={form.maturityDate} onChange={e => setAsOfDate(e.target.value)} />
        </div>
        {!asOfDate && <div style={{ color: "var(--color-text-tertiary)", fontSize: 13, padding: "12px 0" }}>기준일을 입력하면 해당 시점의 장부금액, 미지급이자 및 재무제표 표시금액이 계산됩니다.</div>}
        {asOfRes && (
            <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginBottom: 12 }}>
                <StatCard label="장부금액 (상각후원가)"  value={KRW(asOfRes.ca)             + "원"} sub={asOfRes.note} />
                <StatCard label="미지급이자 (발생이자)"  value={KRW(asOfRes.accrued)        + "원"} />
                <StatCard label="재무상태표 계상액"       value={KRW(asOfRes.ca + asOfRes.accrued) + "원"} sub="CA + 미지급이자" />
                <StatCard label="해당 이자지급기"         value={`제${asOfRes.period}기`} sub={`${asOfRes.ps} ~ ${asOfRes.pe}`} />
            </div>
            <div style={{ ...card, background: "var(--color-background-info)", border: "0.5px solid var(--color-border-info)" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-info)", marginBottom: 6 }}>재무제표 주석 데이터 (기준일: {asOfDate})</div>
                {[
                ["부채요소 장부금액 (상각후원가)", KRW(asOfRes.ca) + "원"],
                ["미지급이자 (유동부채)",          KRW(asOfRes.accrued) + "원"],
                ["유효이자율 (EIR)",               PCT(res.annEIR)],
                ["표면이자율 (쿠폰)",              PCT2(+form.couponRate / 100)],
                ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "0.5px solid var(--color-border-info)" }}>
                    <span style={{ color: "var(--color-text-secondary)" }}>{k}</span>
                    <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
                ))}
            </div>
            </div>
        )}
        </div>
    );
    }

    /* ── TAB: 시나리오 비교
    BUG FIX: 동일 경제적 실질 기준으로 grossProceeds를 역산하여 두 방법 모두
    동일한 장부금액이 나오도록 정상화. ── */
    function ScenarioTab({ form }) {
    const pf = useMemo(() => prepForm(form), [form]);

    // FIXED: 현재 입력 방식에서 총발행금액(투자자 지급) 역산
    const grossProceeds = form.issuanceCostMethod === "net"
        ? pf.issuePrice + pf.issuanceCost  // 순액법 입력: 순수취액 + 비용 = 총발행
        : pf.issuePrice;                    // 총액법 입력: 총발행 = 입력값

    // 총액법 시나리오: 총발행금액으로 직접 입력
    const grossR = useMemo(() =>
        runCalc({ ...pf, issuePrice: grossProceeds, issuanceCostMethod: "gross" }),
        [pf, grossProceeds]
    );
    // 순액법 시나리오: 순수취액(= 총발행 − 비용)을 issuePrice로 입력
    const netR = useMemo(() =>
        runCalc({ ...pf, issuePrice: grossProceeds - pf.issuanceCost, issuanceCostMethod: "net" }),
        [pf, grossProceeds]
    );

    const noGuarR = useMemo(() => runCalc({ ...pf, hasGuaranteeYield: false }), [pf]);
    const guarPct = pf.guaranteeRate > 0 ? pf.guaranteeRate : 0.03;
    const withGuarR = useMemo(() =>
        runCalc({ ...pf, hasGuaranteeYield: true, guaranteeRate: guarPct }), [pf, guarPct]
    );

    const ca_same = Math.abs((grossR.liab + grossR.eq) - (netR.liab + netR.eq)) < 1;

    const SRow = ({ label, v1, v2, bold }) => (
        <tr style={{ borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <td style={{ padding: "5px 8px", fontSize: 12, color: "var(--color-text-secondary)" }}>{label}</td>
        <td style={{ padding: "5px 8px", fontSize: 12, textAlign: "center", fontWeight: bold ? 500 : 400 }}>{v1}</td>
        <td style={{ padding: "5px 8px", fontSize: 12, textAlign: "center", fontWeight: bold ? 500 : 400 }}>{v2}</td>
        </tr>
    );
    const THead = ({ h1, h2 }) => (
        <thead><tr style={{ background: "var(--color-background-secondary)", borderBottom: "0.5px solid var(--color-border-secondary)" }}>
        <th style={{ padding: "5px 8px", textAlign: "left",   fontWeight: 500, fontSize: 11, color: "var(--color-text-secondary)" }}>항목</th>
        <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: 500, fontSize: 11, color: "var(--color-text-secondary)" }}>{h1}</th>
        <th style={{ padding: "5px 8px", textAlign: "center", fontWeight: 500, fontSize: 11, color: "var(--color-text-secondary)" }}>{h2}</th>
        </tr></thead>
    );

    return (
        <div style={{ display: "grid", gap: 14 }}>
        <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>시나리오 1: 발행비용 처리방식 비교 (수정됨)</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 8 }}>
            동일 경제적 실질 — 총발행 {KRW(grossProceeds)}원, 비용 {KRW(pf.issuanceCost)}원
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <THead h1="총액법" h2="순액법" />
            <tbody>
                <SRow label="총발행금액 (투자자 지급)" v1={KRW(grossR.gross) + "원"}      v2={KRW(netR.gross) + "원"} />
                <SRow label="회사 수취액 (순)"         v1={KRW(grossR.net)   + "원"}      v2={KRW(netR.net)   + "원"} />
                <SRow label="발행금액 입력 기준"        v1={KRW(grossProceeds) + "원 (총액)"} v2={KRW(grossProceeds - pf.issuanceCost) + "원 (순액)"} />
                <SRow label="장부금액 (CA)" v1={KRW(grossR.liab + grossR.eq) + "원"} v2={KRW(netR.liab + netR.eq) + "원"} bold />
                <SRow label="유효이자율 EIR" v1={PCT(grossR.annEIR)} v2={PCT(netR.annEIR)} bold />
                {grossR.sched[0] && <SRow label="제1기 이자비용" v1={KRW(grossR.sched[0].intr) + "원"} v2={KRW(netR.sched[0].intr) + "원"} />}
            </tbody>
            </table>
            <div style={{ marginTop: 8, fontSize: 11, background: ca_same ? "var(--color-background-success)" : "var(--color-background-danger)", color: ca_same ? "var(--color-text-success)" : "var(--color-text-danger)", padding: "6px 10px", borderRadius: "var(--border-radius-md)" }}>
            {ca_same
                ? `✓ 순액법·총액법 장부금액 ${KRW(grossR.liab + grossR.eq)}원으로 동일. IFRS 9는 두 방법 모두 허용합니다.`
                : `⚠ 장부금액 불일치: 총액 ${KRW(grossR.liab + grossR.eq)} vs 순액 ${KRW(netR.liab + netR.eq)}`}
            </div>
        </div>
        <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>시나리오 2: 보장수익률 유무 비교</div>
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", marginBottom: 8 }}>
            보장수익률 없음 vs {(guarPct * 100).toFixed(1)}% 추가 가정
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <THead h1="보장수익률 없음" h2={`+${(guarPct * 100).toFixed(1)}% 추가`} />
            <tbody>
                <SRow label="매기 현금지급 (쿠폰)"     v1={KRW(noGuarR.cashPP)           + "원"} v2={KRW(withGuarR.cashPP) + "원"} />
                <SRow label="만기 상환할증금"           v1="없음"                                  v2={KRW(withGuarR.guarLumpSum) + "원"} />
                <SRow label="유효이자율 EIR (연)"       v1={PCT(noGuarR.annEIR)}                   v2={PCT(withGuarR.annEIR)}          bold />
                {noGuarR.sched[0] && <SRow label="제1기 이자비용" v1={KRW(noGuarR.sched[0].intr) + "원"} v2={KRW(withGuarR.sched[0].intr) + "원"} />}
                <SRow label="부채요소 CA" v1={KRW(noGuarR.liab) + "원"} v2={KRW(withGuarR.liab) + "원"} bold />
            </tbody>
            </table>
            <div style={{ marginTop: 8, fontSize: 11, background: "var(--color-background-info)", color: "var(--color-text-info)", padding: "6px 10px", borderRadius: "var(--border-radius-md)" }}>
            보장수익률은 매기 지급이 아닌 만기 상환할증금(일시불)으로 처리됩니다. 만기 현금흐름 증가 → EIR 상승 → 이자비용·부채요소 장부금액 증가
            </div>
        </div>
        </div>
    );
    }

    /* ── MAIN APP ── */
    const DEFAULTS = {
    instrumentType: "CB", faceValue: "100000000", issuePrice: "100000000",
    couponRate: "2", marketRate: "5",
    issueDate: "2024-01-01", maturityDate: "2027-01-01",
    frequency: "yearly", issuanceCost: "2000000", issuanceCostMethod: "gross",
    hasGuaranteeYield: false, guaranteeRate: "3",
    hasMandatoryRedemption: true, dividendType: "fixed",
    hasConversionOption: true, conversionFixed: true,
    };

    function App() {
    const [form, setForm]       = useState(DEFAULTS);
    const [result, setResult]   = useState(null);
    const [tab, setTab]         = useState("classify");
    const [asOfDate, setAsOfDate] = useState("");
    const [collapsed, setCollapsed] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    function run() {
        try {
        const res = runCalc(prepForm(form));
        res.form = form;
        setResult(res);
        setTab("classify");
        setCollapsed(true);
        } catch (e) { alert("계산 오류: " + e.message); }
    }

    const asOfRes = useMemo(() => result ? getAsOf(result.sched, form.issueDate, asOfDate) : null, [result, asOfDate, form.issueDate]);
    const jnl     = useMemo(() => result ? makeJournals(result, prepForm(form)) : [],          [result, form]);
    const preview = classify({ hasMandatoryRedemption: form.hasMandatoryRedemption, dividendType: form.dividendType, hasConversionOption: form.hasConversionOption, conversionFixed: form.conversionFixed });
    const pcs     = CLS[preview.type];
    const TABS    = [["classify","① 분류"],["schedule","② 상각표"],["journal","③ 분개"],["asof","④ 기준일"],["scenario","⑤ 시나리오"]];

    return (
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--color-text-primary)", paddingBottom: 40 }}>
        {/* 헤더 */}
        <div style={{ background: "rgba(255,255,255,0.80)", backdropFilter: "blur(12px)", borderBottom: "0.5px solid var(--color-border-secondary)", padding: "10px 20px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 100 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#185FA5,#4a9ed4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 600, fontSize: 15 }}>₩</div>
            <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>금융상품 IFRS 분류·측정 계산기</div>
            <div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>사채 · 전환사채(CB) · 상환전환우선주(RCPS) | IAS 32 / IFRS 9</div>
            </div>
        </div>

        <div style={{ padding: "0 16px" }}>
            {/* 입력 패널 */}
            <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setCollapsed(!collapsed)}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>입력 조건</span>
                <button style={{ fontSize: 10, color: "var(--color-text-secondary)", background: "none", border: "none", cursor: "pointer" }}>{collapsed ? "펼치기 ▼" : "접기 ▲"}</button>
            </div>

            {!collapsed && (
                <div style={{ marginTop: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(195px,1fr))", gap: 18 }}>
                    {/* 기본 정보 */}
                    <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>기본 정보</div>
                    <FI label="상품 유형">
                        <select style={INP_STYLE} value={form.instrumentType} onChange={e => set("instrumentType", e.target.value)}>
                        <option value="BOND">일반사채 (Straight Bond)</option>
                        <option value="CB">전환사채 (CB)</option>
                        <option value="RCPS">상환전환우선주 (RCPS)</option>
                        </select>
                    </FI>
                    <FI label="액면금액 (원)">
                        <NumInput value={form.faceValue} onChange={v => set("faceValue", v)} />
                    </FI>
                    <FI label="발행금액 (원)" note={form.issuanceCostMethod === "net" ? "순액: 회사 수취액 (비용 차감 후)" : "총액: 투자자 지급액 (비용 차감 전)"}>
                        <NumInput value={form.issuePrice} onChange={v => set("issuePrice", v)} />
                    </FI>
                    <FI label="발행비용 (원)">
                        <NumInput value={form.issuanceCost} onChange={v => set("issuanceCost", v)} />
                    </FI>
                    <FI label="발행비용 처리방식">
                        <div style={{ display: "flex", border: "1px solid var(--color-border-primary)", borderRadius: "var(--border-radius-sm)", overflow: "hidden" }}>
                        {[["net", "순액법"], ["gross", "총액법"]].map(([v, l]) => (
                            <button key={v} onClick={() => set("issuanceCostMethod", v)} style={{ flex: 1, padding: "6px", fontSize: 12, border: "none", cursor: "pointer", background: form.issuanceCostMethod === v ? "#185FA5" : "var(--color-background-primary)", color: form.issuanceCostMethod === v ? "#fff" : "var(--color-text-primary)", fontFamily: "var(--font-sans)", transition: "all 0.15s" }}>{l}</button>
                        ))}
                        </div>
                    </FI>
                    </div>

                    {/* 금융 조건 */}
                    <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>금융 조건</div>
                    <FI label="표면이자율 (%)">
                        <input type="number" step="0.1" style={INP_STYLE} value={form.couponRate} onChange={e => set("couponRate", e.target.value)} />
                    </FI>
                    <FI label="시장이자율 (%) — 부채 PV 할인율" note="복합금융상품 부채요소 현재가치 산정용">
                        <input type="number" step="0.1" style={INP_STYLE} value={form.marketRate} onChange={e => set("marketRate", e.target.value)} />
                    </FI>
                    <FI label="발행일">
                        <input type="date" style={INP_STYLE} value={form.issueDate} onChange={e => set("issueDate", e.target.value)} />
                    </FI>
                    <FI label="만기일">
                        <input type="date" style={INP_STYLE} value={form.maturityDate} onChange={e => set("maturityDate", e.target.value)} />
                    </FI>
                    <FI label="이자지급주기">
                        <select style={INP_STYLE} value={form.frequency} onChange={e => set("frequency", e.target.value)}>
                        <option value="yearly">연 1회</option>
                        <option value="quarterly">분기 1회 (연 4회)</option>
                        <option value="monthly">월 1회 (연 12회)</option>
                        </select>
                    </FI>
                    <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "8px 10px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, marginBottom: form.hasGuaranteeYield ? 6 : 0 }}>
                        <input type="checkbox" checked={form.hasGuaranteeYield} onChange={e => set("hasGuaranteeYield", e.target.checked)} />
                        <span style={{ fontWeight: 500 }}>보장수익률 추가</span>
                        </label>
                        {form.hasGuaranteeYield && (
                        <FI label="보장수익률 (%)" note="만기 상환할증금으로 반영 → EIR 상승">
                            <input type="number" step="0.1" style={INP_STYLE} value={form.guaranteeRate} onChange={e => set("guaranteeRate", e.target.value)} />
                        </FI>
                        )}
                    </div>
                    </div>

                    {/* 분류 조건 */}
                    <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-text-tertiary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>분류 조건 (IAS 32)</div>
                    {[
                        ["hasMandatoryRedemption", "의무상환 조건 존재",        "만기 시 현금 상환 의무"],
                        ["hasConversionOption",    "전환권 존재",               "주식 전환 권리"],
                    ].map(([k, l, d]) => (
                        <label key={k} style={{ display: "flex", gap: 7, padding: "7px 8px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-tertiary)", marginBottom: 5, cursor: "pointer", background: form[k] ? "var(--color-background-secondary)" : "transparent" }}>
                        <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} style={{ marginTop: 2 }} />
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{l}</div>
                            <div style={{ fontSize: 9, color: "var(--color-text-tertiary)" }}>{d}</div>
                        </div>
                        </label>
                    ))}
                    {form.hasConversionOption && (
                        <label style={{ display: "flex", gap: 7, padding: "7px 8px", borderRadius: "var(--border-radius-md)", border: "0.5px solid var(--color-border-tertiary)", marginBottom: 5, cursor: "pointer", background: form.conversionFixed ? "var(--color-background-secondary)" : "transparent" }}>
                        <input type="checkbox" checked={form.conversionFixed} onChange={e => set("conversionFixed", e.target.checked)} style={{ marginTop: 2 }} />
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>전환가격 고정 (Fixed-for-Fixed)</div>
                            <div style={{ fontSize: 9, color: "var(--color-text-tertiary)" }}>자본 분류 요건</div>
                        </div>
                        </label>
                    )}
                    <FI label="배당 유형">
                        <select style={INP_STYLE} value={form.dividendType} onChange={e => set("dividendType", e.target.value)}>
                        <option value="fixed">고정 배당 (비재량)</option>
                        <option value="variable">변동 배당 (비재량)</option>
                        <option value="discretionary">재량적 배당</option>
                        </select>
                    </FI>
                    <div style={{ background: pcs.bg, border: `1px solid ${pcs.border}`, borderRadius: "var(--border-radius-md)", padding: "7px 9px" }}>
                        <div style={{ fontSize: 9, color: "var(--color-text-tertiary)", marginBottom: 2 }}>예상 분류 (실시간)</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: pcs.text }}>{preview.label}</div>
                        <div style={{ fontSize: 9, color: "var(--color-text-secondary)", marginTop: 2, lineHeight: 1.4 }}>{preview.steps[0]}</div>
                    </div>
                    </div>
                </div>
                <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                    <button onClick={run} style={{ padding: "9px 44px", background: "linear-gradient(135deg,#185FA5,#2a7ed4)", color: "#fff", border: "none", borderRadius: "var(--border-radius-md)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-sans)", boxShadow: "0 2px 8px rgba(24,95,165,0.3)" }}>
                    계산 실행
                    </button>
                </div>
                </div>
            )}
            </div>

            {/* 결과 패널 */}
            {result && (() => {
            const cs = CLS[result.cls.type];
            return (
                <div style={card}>
                <div style={{ background: cs.bg, border: `0.5px solid ${cs.border}`, borderRadius: "var(--border-radius-md)", padding: "7px 10px", marginBottom: 10, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                    <span style={{ ...cs.badge, fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 5 }}>{result.cls.type}</span>
                    <span style={{ fontWeight: 500, fontSize: 13, color: cs.text }}>{result.cls.label}</span>
                    {result.annEIR > 0 && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>EIR <strong>{PCT(result.annEIR)}</strong></span>}
                    {result.liab  > 0 && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>부채 <strong>{KRW(result.liab)}원</strong></span>}
                    {result.eq    > 0 && <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>자본 <strong>{KRW(result.eq)}원</strong></span>}
                </div>
                <div style={{ display: "flex", borderBottom: "0.5px solid var(--color-border-secondary)", marginBottom: 14, overflowX: "auto" }}>
                    {TABS.map(([id, l]) => (
                    <button key={id} onClick={() => setTab(id)} style={{ padding: "6px 13px", fontSize: 12, fontWeight: tab === id ? 500 : 400, color: tab === id ? "#185FA5" : "var(--color-text-secondary)", background: "none", border: "none", borderBottom: tab === id ? "2px solid #185FA5" : "2px solid transparent", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--font-sans)", transition: "color 0.15s" }}>
                        {l}
                    </button>
                    ))}
                </div>
                {tab === "classify"  && <ClassTab  res={result} />}
                {tab === "schedule"  && <SchedTab  res={result} />}
                {tab === "journal"   && <div>{jnl.map((j, i) => <JournalEntry key={i} j={j} />)}</div>}
                {tab === "asof"      && <AsOfTab   res={result} form={form} asOfDate={asOfDate} setAsOfDate={setAsOfDate} asOfRes={asOfRes} />}
                {tab === "scenario"  && <ScenarioTab form={form} />}
                </div>
            );
            })()}
        </div>
        </div>
    );
    }

    ReactDOM.render(<App />, document.getElementById("root"));