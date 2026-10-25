const fs = require("fs");
const path = require("path");

function loadCoreFunctions() {
  const scriptPath = path.join(__dirname, "script.js");
  let code = fs.readFileSync(scriptPath, "utf8");

  code = code.replace("const { useState, useMemo } = React;", "");
  const cutAt = code.indexOf("/* ── 공통 입력 스타일");
  if (cutAt < 0) {
    throw new Error("script.js에서 핵심 로직 경계(공통 입력 스타일 주석)를 찾지 못했습니다.");
  }

  const coreCode = code.slice(0, cutAt);
  eval(coreCode);

  return { runCalc, makeJournals, prepForm, getAsOf, addMonths };
}

/* 계정별 원장 잔액: 상각/배부 접미어를 떼고 같은 계정으로 묶어 차변−대변 합산 */
function ledger(jnl) {
  const bal = {};
  const key = (a) => String(a || "").replace(/ 상각$/, "").replace(/ \(부채요소 배부\)$/, "");
  for (const e of jnl) {
    for (const x of e.dr || []) bal[key(x.a)] = (bal[key(x.a)] || 0) + x.v;
    for (const x of e.cr || []) bal[key(x.a)] = (bal[key(x.a)] || 0) - x.v;
  }
  return bal;
}
const CLOSING_ACCOUNTS = /^(전환권조정|전환권할증발행차금|우선주할인발행차금|우선주할증발행차금|사채할인발행차금|사채할증발행차금|사채|전환사채 \(액면\)|상환전환우선주 \(액면\)|상환할증금)$/;
function openLedgerAccounts(jnl) {
  return Object.entries(ledger(jnl)).filter(([a, v]) => CLOSING_ACCOUNTS.test(a) && v !== 0);
}

const BASE_CB = {
  instrumentType: "CB", faceValue: "100000000", issuePrice: "100000000",
  couponRate: "2", marketRate: "5", issueDate: "2024-01-01", maturityDate: "2027-01-01",
  frequency: "yearly", issuanceCost: "2000000", issuanceCostMethod: "gross",
  hasGuaranteeYield: false, guaranteeRate: "3", hasMandatoryRedemption: true,
  dividendType: "fixed", hasConversionOption: true, conversionFixed: true, periodRateMode: "compound",
};

function validateFixes(core) {
  const fails = [];
  const calc = (o) => {
    const pf = core.prepForm({ ...BASE_CB, ...o });
    const res = core.runCalc(pf);
    return { pf, res, jnl: core.makeJournals(res, pf) };
  };

  // 1·2. 기준일 조회: 미지급이자 = 표면이자 경과분, 장부금액은 만기 상환 현금 제외
  {
    const { res } = calc({});
    for (const d of ["2024-07-01", "2026-07-01"]) {
      const a = core.getAsOf(res.sched, "2024-01-01", d);
      const r = res.sched[a.period - 1];
      const expCA = r.open + (r.intr - r.couponOnly) * a.fr;
      const expAcc = r.couponOnly * a.fr;
      if (Math.abs(a.ca - expCA) > 1e-6 || Math.abs(a.accrued - expAcc) > 1e-6)
        fails.push(`기준일 ${d}: CA ${a.ca} (기대 ${expCA}), 미지급이자 ${a.accrued} (기대 ${expAcc})`);
    }
  }

  // 3. 일반사채 + 보장수익률: 사채·상환할증금·할인차금 모두 만기에 잔액 0
  {
    const { jnl } = calc({ instrumentType: "BOND", hasGuaranteeYield: true, guaranteeRate: "5" });
    const open = openLedgerAccounts(jnl);
    if (open.length) fails.push(`일반사채+보장수익률 미청산 계정: ${JSON.stringify(open)}`);
  }

  // 4. 부채 PV > 발행금액: 음수 배부 없음, 부채+자본 = 순수취액
  {
    const { res, jnl } = calc({ marketRate: "1" });
    if (res.eqCost < 0 || res.liabCost < 0) fails.push(`PV>발행가: 음수 비용배부 (${res.liabCost}, ${res.eqCost})`);
    if (Math.abs(res.liab + res.eq - res.net) > 1e-6) fails.push(`PV>발행가: 부채+자본 ${res.liab + res.eq} ≠ 순수취 ${res.net}`);
    if (!res.warnings?.length) fails.push("PV>발행가: 경고 미표시");
    if (jnl.some((e) => [...e.dr, ...e.cr].some((x) => x.v < 0))) fails.push("PV>발행가: 음수 분개 금액");
  }

  // 5·10. 장기(분기 12기): 마지막 기 이자 분개 표시 + 원 단위 절사 후에도 조정계정 잔액 0
  {
    const { jnl } = calc({ frequency: "quarterly" });
    if (!jnl.some((e) => /제12기\)/.test(e.title))) fails.push("분기 12기: 마지막 기 이자 분개 누락");
    if (!jnl.some((e) => /제5기 ~ 제11기 생략/.test(e.title))) fails.push("분기 12기: 생략 표기 오류");
  }
  {
    const { jnl } = calc({ frequency: "quarterly", maturityDate: "2025-04-01" }); // 5기
    if (jnl.some((e) => /생략/.test(e.title))) fails.push("5기: 생략 없이 전 기간 표시되어야 함");
  }
  // 전 기간 분개가 모두 나오는 케이스(≤5기)에서 계정 청산 확인 — 여러 조건 조합
  const combos = [
    {}, { issuanceCostMethod: "net", issuePrice: "98000000" }, { issuePrice: "105000000" },
    { hasGuaranteeYield: true, guaranteeRate: "4" }, { marketRate: "1" }, { instrumentType: "RCPS" },
    { instrumentType: "BOND", issuePrice: "95000000" }, { instrumentType: "BOND", issuePrice: "104000000", couponRate: "6" },
    { faceValue: "123456789", issuePrice: "120000001", issuanceCost: "1234567", couponRate: "3.3", marketRate: "7.7" },
    // 할증발행 CB(총액법): 발행비용 부채 배부분이 할증 계정을 줄이거나 넘어서는 경우
    { issuePrice: "120000000", marketRate: "1" }, { issuePrice: "101000000", marketRate: "1" },
    { issuePrice: "101000000", marketRate: "1", instrumentType: "RCPS" },
    { issuePrice: "103500000", marketRate: "1", issuanceCostMethod: "net" },
  ];
  for (const c of combos) {
    const { jnl } = calc(c);
    const open = openLedgerAccounts(jnl);
    if (open.length) fails.push(`미청산 계정 ${JSON.stringify(c)}: ${JSON.stringify(open)}`);
    if (!jnl.every(balanceOk)) fails.push(`차대 불균형 ${JSON.stringify(c)}`);
  }

  // 6. BS 표시: 액면 + 상환할증금 − 전환권조정(최종) = res.liab (발행비용 반영 후)
  //    (화면 함수 convAdjBreakdown은 UI 영역이라 동일 공식으로 확인)
  {
    const { res } = calc({});
    const convAdj = res.fv + res.guarLumpSum - res.liab;
    const parts = res.guarLumpSum + res.eqGross + (res.fv - res.gross) + res.liabCost;
    if (Math.abs(convAdj - parts) > 1e-6) fails.push(`전환권조정 구성 불일치: ${convAdj} vs ${parts}`);
  }

  // 7. 만기일-지급주기 불일치 → 오류
  try {
    calc({ maturityDate: "2026-07-01" });
    fails.push("만기일 불일치(연1회, 2.5년)가 차단되지 않음");
  } catch (e) {
    if (!/이자지급주기/.test(e.message)) fails.push(`만기일 불일치 오류 메시지 이상: ${e.message}`);
  }

  // 이자 지급일 당일 기준일: 지급 완료 → 미지급이자 0, 장부금액 = 직전 기 기말
  {
    const { res } = calc({});
    const a = core.getAsOf(res.sched, "2024-01-01", "2025-01-01");
    if (a.accrued !== 0 || Math.abs(a.ca - res.sched[0].close) > 1e-6)
      fails.push(`지급일 당일 기준일: CA ${a.ca}, 미지급이자 ${a.accrued}`);
  }

  // 잘못된 입력은 명확한 오류로 차단
  for (const [o, re] of [
    [{ faceValue: "0" }, /액면금액/], [{ issuePrice: "" }, /발행금액/], [{ couponRate: "-1" }, /표면이자율/],
    [{ issuanceCost: "150000000" }, /발행비용/], [{ hasGuaranteeYield: true, guaranteeRate: "-2" }, /보장수익률/],
  ]) {
    try { calc(o); fails.push(`잘못된 입력 미차단: ${JSON.stringify(o)}`); }
    catch (e) { if (!re.test(e.message)) fails.push(`입력 오류 메시지 이상 ${JSON.stringify(o)}: ${e.message}`); }
  }

  // 의무상환 없음 + 비재량 배당 복합상품은 차단, 재량적 배당(자본)은 계산
  for (const dividendType of ["fixed", "variable"]) {
    try { calc({ hasMandatoryRedemption: false, dividendType }); fails.push(`의무상환 없음+${dividendType} 배당 미차단`); }
    catch (e) { if (!/의무상환 조건이 없고/.test(e.message)) fails.push(`의무상환 없음 차단 메시지 이상: ${e.message}`); }
  }
  try {
    const { res } = calc({ hasMandatoryRedemption: false, dividendType: "discretionary" });
    if (res.cls.type !== "EQUITY") fails.push(`의무상환 없음+재량 배당 분류 ${res.cls.type} (기대 EQUITY)`);
  } catch (e) { fails.push(`의무상환 없음+재량 배당 계산 실패: ${e.message}`); }

  // 9. 월말 발행: 지급일이 매월 말일
  {
    const d = [1, 2, 3, 13].map((m) => core.addMonths("2024-01-31", m));
    const exp = ["2024-02-29", "2024-03-31", "2024-04-30", "2025-02-28"];
    if (d.join() !== exp.join()) fails.push(`월말 지급일 ${d.join()} (기대 ${exp.join()})`);
    const { res } = calc({ frequency: "monthly", issueDate: "2024-01-31", maturityDate: "2025-01-31" });
    if (res.periods !== 12) fails.push(`월말 발행 기수 ${res.periods} (기대 12)`);
  }

  return fails;
}

function sum(arr, pick) {
  return (arr || []).reduce((s, x) => s + pick(x), 0);
}

function balanceOk(journal) {
  const dr = sum(journal.dr, (x) => x.v);
  const cr = sum(journal.cr, (x) => x.v);
  return dr === cr;
}

function validateSingleCase(name, form, core) {
  const pf = core.prepForm(form);
  const res = core.runCalc(pf);
  const jnl = core.makeJournals(res, pf);

  const allBalanced = jnl.every(balanceOk);
  const last = res.sched?.[res.sched.length - 1];
  const maturityTarget = (res.fv ?? pf.faceValue) + (res.guarLumpSum ?? 0);

  // 만기기 "이자 반영 후 상환 직전" 수렴 검증
  const preRedemptionCA = last ? last.open + last.intr - (last.couponOnly ?? 0) : 0;
  const preRedemptionErr = Math.abs(preRedemptionCA - maturityTarget);

  // 상환 후 close는 0 수렴
  const postRedemptionErr = last ? Math.abs(last.close) : 0;

  // 총 이자비용 정합성
  const totalInterest = sum(res.sched, (r) => r.intr);
  const totalCoupon = sum(res.sched, (r) => r.couponOnly ?? r.cash);
  const openingBase =
    res.cls.type === "HYBRID"
      ? maturityTarget - res.liab // FV+gLS-LN
      : maturityTarget - res.net; // FV+gLS-NP
  const interestIdentityErr = Math.abs(totalInterest - (openingBase + totalCoupon));

  // 사채/일반부채 케이스에서는 전환권조정 계정이 노출되면 안 됨
  const hasConversionAdjLabelInLiability = res.cls.type === "LIABILITY"
    ? jnl.some((entry) => {
        const hasInLines = [...(entry.dr || []), ...(entry.cr || [])]
          .some((line) => /전환권조정|우선주할인발행차금|우선주할증발행차금/.test(line.a || ""));
        return hasInLines || /전환권조정|우선주할인발행차금|우선주할증발행차금/.test(entry.note || "");
      })
    : false;

  return {
    name,
    type: res.cls.type,
    allBalanced,
    preRedemptionErr,
    postRedemptionErr,
    interestIdentityErr,
    hasConversionAdjLabelInLiability,
    annEIR: res.annEIR,
    liab: res.liab,
    eq: res.eq,
  };
}

function validateTypeDBlocked(core) {
  const form = {
    instrumentType: "RCPS",
    faceValue: "100000000",
    issuePrice: "100000000",
    couponRate: "2",
    marketRate: "5",
    issueDate: "2024-01-01",
    maturityDate: "2027-01-01",
    frequency: "yearly",
    issuanceCost: "2000000",
    issuanceCostMethod: "gross",
    hasGuaranteeYield: false,
    guaranteeRate: "3",
    hasMandatoryRedemption: true,
    dividendType: "variable",
    hasConversionOption: true,
    conversionFixed: false,
    periodRateMode: "compound",
  };

  try {
    core.runCalc(core.prepForm(form));
    return { ok: false, message: "Type D 케이스가 차단되지 않았습니다." };
  } catch (e) {
    const msg = String(e?.message || e);
    return {
      ok: msg.includes("Type D") || msg.includes("내재파생"),
      message: msg,
    };
  }
}

function validateRateModeDiff(core) {
  const base = {
    instrumentType: "CB",
    faceValue: "100000000",
    issuePrice: "100000000",
    couponRate: "2",
    marketRate: "5",
    issueDate: "2024-01-01",
    maturityDate: "2027-01-01",
    frequency: "quarterly",
    issuanceCost: "2000000",
    issuanceCostMethod: "gross",
    hasGuaranteeYield: false,
    guaranteeRate: "3",
    hasMandatoryRedemption: true,
    dividendType: "fixed",
    hasConversionOption: true,
    conversionFixed: true,
  };

  const compound = core.runCalc(core.prepForm({ ...base, periodRateMode: "compound" }));
  const simple = core.runCalc(core.prepForm({ ...base, periodRateMode: "simple" }));

  const diff =
    Math.abs(compound.liab - simple.liab) +
    Math.abs(compound.eq - simple.eq) +
    Math.abs(compound.annEIR - simple.annEIR);

  return {
    ok: diff > 0,
    diff,
    compound: { liab: compound.liab, eq: compound.eq, annEIR: compound.annEIR },
    simple: { liab: simple.liab, eq: simple.eq, annEIR: simple.annEIR },
  };
}

function runStress(core, count = 120) {
  function rnd(min, max) {
    return Math.random() * (max - min) + min;
  }

  let unexpected = 0;
  for (let i = 0; i < count; i++) {
    const hasConv = Math.random() > 0.35;
    const form = {
      instrumentType: hasConv ? "CB" : "BOND",
      faceValue: String(Math.floor(rnd(5e7, 2e8))),
      issuePrice: String(Math.floor(rnd(4e7, 2.1e8))),
      couponRate: String(rnd(0, 8).toFixed(2)),
      marketRate: String(rnd(1, 10).toFixed(2)),
      issueDate: "2024-01-01",
      maturityDate: "2028-01-01",
      frequency: ["yearly", "quarterly", "monthly"][Math.floor(Math.random() * 3)],
      issuanceCost: String(Math.floor(rnd(0, 5e6))),
      issuanceCostMethod: Math.random() > 0.5 ? "gross" : "net",
      hasGuaranteeYield: Math.random() > 0.6,
      guaranteeRate: String(rnd(1, 6).toFixed(2)),
      hasMandatoryRedemption: Math.random() > 0.2,
      dividendType: ["fixed", "variable", "discretionary"][Math.floor(Math.random() * 3)],
      hasConversionOption: hasConv,
      conversionFixed: Math.random() > 0.25,
      periodRateMode: Math.random() > 0.5 ? "compound" : "simple",
    };

    try {
      const pf = core.prepForm(form);
      const res = core.runCalc(pf);
      const jnl = core.makeJournals(res, pf);
      const ok = jnl.every(balanceOk);
      // 분개가 전 기간 표시되는 경우(≤5기) 만기 후 부채·조정 계정 잔액 0 확인
      const closed = (res.sched?.length ?? 0) > 5 || openLedgerAccounts(jnl).length === 0;
      if (!ok || !closed) unexpected++;
    } catch (e) {
      const msg = String(e?.message || e);
      if (!msg.includes("Type D") && !msg.includes("의무상환 조건이 없고")) unexpected++;
    }
  }

  return { tested: count, unexpected };
}

function main() {
  const core = loadCoreFunctions();

  const cases = [
    {
      name: "Bond-discount",
      form: {
        instrumentType: "BOND",
        faceValue: "100000000",
        issuePrice: "95000000",
        couponRate: "3",
        marketRate: "6",
        issueDate: "2024-01-01",
        maturityDate: "2027-01-01",
        frequency: "yearly",
        issuanceCost: "1000000",
        issuanceCostMethod: "gross",
        hasGuaranteeYield: false,
        guaranteeRate: "3",
        hasMandatoryRedemption: true,
        dividendType: "fixed",
        hasConversionOption: false,
        conversionFixed: true,
        periodRateMode: "compound",
      },
    },
    {
      name: "CB-hybrid-gross",
      form: {
        instrumentType: "CB",
        faceValue: "100000000",
        issuePrice: "100000000",
        couponRate: "2",
        marketRate: "5",
        issueDate: "2024-01-01",
        maturityDate: "2027-01-01",
        frequency: "yearly",
        issuanceCost: "2000000",
        issuanceCostMethod: "gross",
        hasGuaranteeYield: false,
        guaranteeRate: "3",
        hasMandatoryRedemption: true,
        dividendType: "fixed",
        hasConversionOption: true,
        conversionFixed: true,
        periodRateMode: "compound",
      },
    },
    {
      name: "CB-hybrid-net",
      form: {
        instrumentType: "CB",
        faceValue: "100000000",
        issuePrice: "98000000",
        couponRate: "2",
        marketRate: "5",
        issueDate: "2024-01-01",
        maturityDate: "2027-01-01",
        frequency: "yearly",
        issuanceCost: "2000000",
        issuanceCostMethod: "net",
        hasGuaranteeYield: false,
        guaranteeRate: "3",
        hasMandatoryRedemption: true,
        dividendType: "fixed",
        hasConversionOption: true,
        conversionFixed: true,
        periodRateMode: "compound",
      },
    },
  ];

  const results = cases.map((x) => validateSingleCase(x.name, x.form, core));
  const typeD = validateTypeDBlocked(core);
  const rateMode = validateRateModeDiff(core);
  const stress = runStress(core, 120);

  const failReasons = [];
  for (const r of results) {
    if (!r.allBalanced) failReasons.push(`${r.name}: 분개 차대 불균형`);
    if (r.preRedemptionErr > 1e-4) failReasons.push(`${r.name}: 상환 전 수렴 오차(${r.preRedemptionErr})`);
    if (r.postRedemptionErr > 1e-4) failReasons.push(`${r.name}: 상환 후 CA 오차(${r.postRedemptionErr})`);
    if (r.interestIdentityErr > 1e-4) failReasons.push(`${r.name}: 총 이자비용 식 오차(${r.interestIdentityErr})`);
    if (r.hasConversionAdjLabelInLiability) failReasons.push(`${r.name}: 부채형 케이스에 전환권조정 계정 노출`);
  }
  if (!typeD.ok) failReasons.push(`Type D 차단 실패: ${typeD.message}`);
  if (!rateMode.ok) failReasons.push("복리/단리 모드 결과 차이 미발생");
  if (stress.unexpected > 0) failReasons.push(`스트레스 테스트 실패: ${stress.unexpected}건`);
  failReasons.push(...validateFixes(core));

  const output = {
    summary: failReasons.length === 0 ? "PASS" : "FAIL",
    singleCaseResults: results,
    typeD,
    rateMode,
    stress,
    failReasons,
  };

  console.log(JSON.stringify(output, null, 2));
  process.exit(failReasons.length === 0 ? 0 : 1);
}

main();
