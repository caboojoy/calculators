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

  return { runCalc, makeJournals, prepForm };
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

  return {
    name,
    type: res.cls.type,
    allBalanced,
    preRedemptionErr,
    postRedemptionErr,
    interestIdentityErr,
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
      if (!ok) unexpected++;
    } catch (e) {
      const msg = String(e?.message || e);
      if (!msg.includes("Type D")) unexpected++;
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
  }
  if (!typeD.ok) failReasons.push(`Type D 차단 실패: ${typeD.message}`);
  if (!rateMode.ok) failReasons.push("복리/단리 모드 결과 차이 미발생");
  if (stress.unexpected > 0) failReasons.push(`스트레스 테스트 실패: ${stress.unexpected}건`);

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
