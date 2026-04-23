    /**
     * 근로·급여 통합 계산 플랫폼 - 메인 앱 컴포넌트
     */
    import { useState } from 'react';
    import { usePayrollStore } from './store/usePayrollStore';
    import type { AllowanceItem } from './types';

    // ─── 포맷 유틸 ──────────────────────────────────────────────────
    const money = (n: number) => Math.round(n).toLocaleString('ko-KR') + '원';

    // ─── 결과 카드 컴포넌트 ──────────────────────────────────────────
    function ResultCard({
    title,
    mainValue,
    subValue,
    rows,
    log,
    highlight,
    }: {
    title: string;
    mainValue: string;
    subValue?: string;
    rows?: { label: string; value: string; accent?: boolean }[];
    log: string[];
    highlight?: 'success' | 'danger' | 'default';
    }) {
    const [logOpen, setLogOpen] = useState(false);
    const border =
        highlight === 'success'
        ? 'border-l-4 border-l-green-400'
        : highlight === 'danger'
        ? 'border-l-4 border-l-red-400'
        : '';

    return (
        <div className={`bg-white rounded-xl border border-gray-200 p-4 ${border}`}>
        <p className="text-xs text-gray-500 font-medium mb-2">{title}</p>
        <p className="text-xl font-medium text-gray-900">{mainValue}</p>
        {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
        {rows && rows.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
            {rows.map((r, i) => (
                <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-500">{r.label}</span>
                <span className={`font-medium ${r.accent ? 'text-blue-600' : 'text-gray-800'}`}>
                    {r.value}
                </span>
                </div>
            ))}
            </div>
        )}
        <button
            onClick={() => setLogOpen((v) => !v)}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
            {logOpen ? '▾ 계산과정 닫기' : '▸ 계산과정 보기'}
        </button>
        {logOpen && (
            <pre className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed font-mono">
            {log.join('\n')}
            </pre>
        )}
        </div>
    );
    }

    // ─── 수당 입력 행 ────────────────────────────────────────────────
    function AllowanceRow({
    item,
    onUpdate,
    onRemove,
    }: {
    item: AllowanceItem;
    onUpdate: (field: keyof AllowanceItem, value: string | number) => void;
    onRemove: () => void;
    }) {
    return (
        <div className="flex gap-2 mb-2">
        <input
            type="text"
            placeholder="수당명"
            value={item.name}
            onChange={(e) => onUpdate('name', e.target.value)}
            className="flex-1 h-8 text-sm px-2 border border-gray-200 rounded-lg bg-white"
        />
        <input
            type="number"
            placeholder="금액"
            value={item.amount || ''}
            onChange={(e) => onUpdate('amount', parseFloat(e.target.value) || 0)}
            className="w-28 h-8 text-sm px-2 border border-gray-200 rounded-lg bg-white text-right"
        />
        <button
            onClick={onRemove}
            className="w-8 h-8 text-red-400 hover:text-red-600 border border-red-100 rounded-lg text-sm hover:bg-red-50"
        >
            ×
        </button>
        </div>
    );
    }

    // ─── 메인 앱 ────────────────────────────────────────────────────
    export default function App() {
    const store = usePayrollStore();
    const { input, result } = store;

    const yearOptions = [2025, 2024, 2023, 2022, 2021, 2020];

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 font-sans">
        <header className="bg-white/80 backdrop-blur border-b border-gray-200 px-6 py-4">
            <h1 className="text-lg font-medium text-gray-900">근로·급여 통합 계산 플랫폼</h1>
            <p className="text-sm text-gray-500">한국 노동법 기준 · 8개 항목 통합 산정</p>
        </header>

        <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
            {/* ─── 입력 패널 ─────────────────────────────────────── */}
            <aside className="bg-white rounded-2xl border border-gray-200 p-5 h-fit">
            <section className="mb-5">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
                기본 정보
                </h2>
                <div className="grid grid-cols-2 gap-3">
                <label className="block">
                    <span className="text-xs text-gray-500 mb-1 block">기준 연도</span>
                    <select
                    value={input.year}
                    onChange={(e) => store.setYear(parseInt(e.target.value))}
                    className="w-full h-9 text-sm px-2 border border-gray-200 rounded-lg bg-white"
                    >
                    {yearOptions.map((y) => (
                        <option key={y}>{y}</option>
                    ))}
                    </select>
                </label>
                <label className="block">
                    <span className="text-xs text-gray-500 mb-1 block">주 근로시간</span>
                    <input
                    type="number"
                    value={input.weeklyHours}
                    onChange={(e) => store.setWeeklyHours(parseFloat(e.target.value) || 40)}
                    min={1} max={52}
                    className="w-full h-9 text-sm px-2 border border-gray-200 rounded-lg bg-white"
                    />
                </label>
                <label className="block">
                    <span className="text-xs text-gray-500 mb-1 block">입사일</span>
                    <input
                    type="date"
                    value={input.hireDate}
                    onChange={(e) => store.setHireDate(e.target.value)}
                    className="w-full h-9 text-sm px-2 border border-gray-200 rounded-lg bg-white"
                    />
                </label>
                <label className="block">
                    <span className="text-xs text-gray-500 mb-1 block">기준일</span>
                    <input
                    type="date"
                    value={input.referenceDate ?? ''}
                    onChange={(e) => store.setReferenceDate(e.target.value)}
                    className="w-full h-9 text-sm px-2 border border-gray-200 rounded-lg bg-white"
                    />
                </label>
                </div>
            </section>

            <section className="mb-5">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
                임금 정보
                </h2>
                <label className="block mb-3">
                <span className="text-xs text-gray-500 mb-1 block">기본급 (월)</span>
                <input
                    type="number"
                    value={input.baseSalary}
                    onChange={(e) => store.setBaseSalary(parseFloat(e.target.value) || 0)}
                    step={10000}
                    className="w-full h-9 text-sm px-2 border border-gray-200 rounded-lg bg-white text-right"
                />
                </label>
                <p className="text-xs text-gray-500 mb-2">고정수당 (통상임금 포함)</p>
                {input.fixedAllowances.map((a) => (
                <AllowanceRow
                    key={a.id}
                    item={a}
                    onUpdate={(f, v) => store.updateFixedAllowance(a.id, f, v)}
                    onRemove={() => store.removeFixedAllowance(a.id)}
                />
                ))}
                <button
                onClick={store.addFixedAllowance}
                className="w-full text-xs text-blue-500 border border-dashed border-blue-200 rounded-lg py-1.5 hover:bg-blue-50 mb-3"
                >
                + 고정수당 추가
                </button>
                <p className="text-xs text-gray-500 mb-2">비고정수당 (통상임금 미포함)</p>
                {input.variableAllowances.map((a) => (
                <AllowanceRow
                    key={a.id}
                    item={a}
                    onUpdate={(f, v) => store.updateVariableAllowance(a.id, f, v)}
                    onRemove={() => store.removeVariableAllowance(a.id)}
                />
                ))}
                <button
                onClick={store.addVariableAllowance}
                className="w-full text-xs text-blue-500 border border-dashed border-blue-200 rounded-lg py-1.5 hover:bg-blue-50"
                >
                + 비고정수당 추가
                </button>
            </section>

            <section className="mb-5">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
                최근 3개월 임금 (평균임금용)
                </h2>
                <div className="grid grid-cols-3 gap-2">
                {(['1개월 전', '2개월 전', '3개월 전'] as const).map((label, i) => (
                    <label key={i} className="block">
                    <span className="text-xs text-gray-500 mb-1 block">{label}</span>
                    <input
                        type="number"
                        value={input.monthly3months[i]}
                        onChange={(e) => {
                        const next = [...input.monthly3months] as [number, number, number];
                        next[i] = parseFloat(e.target.value) || 0;
                        store.setMonthly3months(next);
                        }}
                        step={10000}
                        className="w-full h-9 text-sm px-2 border border-gray-200 rounded-lg bg-white text-right"
                    />
                    </label>
                ))}
                </div>
            </section>

            <section className="mb-5">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
                연차 정보
                </h2>
                <label className="block w-1/2">
                <span className="text-xs text-gray-500 mb-1 block">사용 연차일수</span>
                <input
                    type="number"
                    value={input.leaveDaysUsed}
                    onChange={(e) => store.setLeaveDaysUsed(parseFloat(e.target.value) || 0)}
                    min={0}
                    className="w-full h-9 text-sm px-2 border border-gray-200 rounded-lg bg-white"
                />
                </label>
            </section>

            <section className="mb-5">
                <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">
                출산·육아 설정
                </h2>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={input.multiplePregnancy ?? false}
                    onChange={(e) => store.setMultiplePregnancy(e.target.checked)}
                    className="w-4 h-4"
                />
                <span className="text-sm text-gray-600">다태아 출산 (120일 적용)</span>
                </label>
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={input.parentalLeave6Plus6 ?? false}
                    onChange={(e) => store.setParentalLeave6Plus6(e.target.checked)}
                    className="w-4 h-4"
                />
                <span className="text-sm text-gray-600">6+6 부모육아휴직제 (2024 개정)</span>
                </label>
                <label className="block w-1/2">
                <span className="text-xs text-gray-500 mb-1 block">육아휴직 신청개월</span>
                <input
                    type="number"
                    value={input.parentalLeaveMonths ?? 12}
                    onChange={(e) => store.setParentalLeaveMonths(parseInt(e.target.value) || 12)}
                    min={1} max={12}
                    className="w-full h-9 text-sm px-2 border border-gray-200 rounded-lg bg-white"
                />
                </label>
            </section>

            <button
                onClick={store.calculate}
                disabled={store.isCalculating}
                className="w-full h-10 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 active:scale-[0.99] transition-all disabled:opacity-50"
            >
                {store.isCalculating ? '계산 중...' : '계산하기'}
            </button>
            {store.lastCalculatedAt && (
                <p className="text-xs text-gray-400 text-center mt-2">
                마지막 계산: {store.lastCalculatedAt.toLocaleTimeString('ko-KR')}
                </p>
            )}
            </aside>

            {/* ─── 결과 패널 ─────────────────────────────────────── */}
            <main>
            {!result ? (
                <div className="flex flex-col items-center justify-center h-80 text-gray-400">
                <p className="text-5xl mb-4 opacity-30">📊</p>
                <p className="text-base">좌측에서 정보를 입력하고 계산하기를 눌러주세요</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. 통상임금 */}
                <ResultCard
                    title="통상임금"
                    mainValue={money(result.ordinaryWage.data.hourlyRate) + '/시간'}
                    subValue={`일급 ${money(result.ordinaryWage.data.dailyRate)} · 월 ${money(result.ordinaryWage.data.monthlyTotal)}`}
                    rows={[
                    { label: '월 소정근로시간', value: `${result.ordinaryWage.data.monthlyWorkHours}시간` },
                    { label: '시간급', value: money(result.ordinaryWage.data.hourlyRate) },
                    { label: '일급', value: money(result.ordinaryWage.data.dailyRate) },
                    ]}
                    log={result.ordinaryWage.log}
                />

                {/* 2. 평균임금 */}
                <ResultCard
                    title="평균임금"
                    mainValue={money(result.averageWage.data.dailyAverage) + '/일'}
                    subValue={`3개월 합계 ${money(result.averageWage.data.totalPay)}`}
                    rows={[
                    { label: '기준일수', value: `${result.averageWage.data.totalDays}일` },
                    { label: '1일 평균임금', value: money(result.averageWage.data.dailyAverage) },
                    ]}
                    log={result.averageWage.log}
                />

                {/* 3. 주휴수당 */}
                <ResultCard
                    title="주휴수당"
                    mainValue={result.weeklyAllowance.data.eligible ? money(result.weeklyAllowance.data.amount) + '/주' : '미지급'}
                    subValue={result.weeklyAllowance.data.eligible ? `월 환산 ${money(result.weeklyAllowance.data.monthlyAmount)}` : `주 ${input.weeklyHours}시간 (15시간 미만)`}
                    rows={result.weeklyAllowance.data.eligible ? [
                    { label: '1일 소정근로시간', value: `${result.weeklyAllowance.data.dailyHours}시간` },
                    { label: '월 환산', value: money(result.weeklyAllowance.data.monthlyAmount) },
                    ] : []}
                    log={result.weeklyAllowance.log}
                />

                {/* 4. 연차 현황 */}
                <ResultCard
                    title="연차 현황"
                    mainValue={`${result.annualLeave.data.totalDays}일`}
                    subValue={result.annualLeave.data.description}
                    rows={[
                    { label: '근속기간', value: `${result.annualLeave.data.yearsOfService}년 ${result.annualLeave.data.monthsOfService % 12}개월` },
                    { label: '사용 연차', value: `${result.annualLeave.data.usedDays}일` },
                    { label: '잔여 연차', value: `${result.annualLeave.data.remainingDays}일`, accent: true },
                    ]}
                    log={result.annualLeave.log}
                />

                {/* 5. 연차수당 */}
                <ResultCard
                    title="연차수당"
                    mainValue={money(result.annualLeaveAllowance.data.amount)}
                    subValue={`미사용 ${result.annualLeaveAllowance.data.unusedDays}일 × 1일 통상임금`}
                    rows={[
                    { label: '미사용 연차', value: `${result.annualLeaveAllowance.data.unusedDays}일` },
                    { label: '1일 통상임금', value: money(result.annualLeaveAllowance.data.dailyOrdinaryWage) },
                    ]}
                    log={result.annualLeaveAllowance.log}
                />

                {/* 6. 최저임금 검증 */}
                <ResultCard
                    title="최저임금 검증"
                    mainValue={money(result.minimumWage.data.actualHourly) + '/시간'}
                    subValue={`${input.year}년 기준 최저임금 ${money(result.minimumWage.data.minimumHourly)}/시간`}
                    rows={[
                    { label: '최저임금 기준 월최소', value: money(result.minimumWage.data.minimumMonthly) },
                    {
                        label: '준수 여부',
                        value: result.minimumWage.data.isCompliant
                        ? `✅ 준수 (+${money(result.minimumWage.data.diff)}/h)`
                        : `❌ 위반 (${money(result.minimumWage.data.diff)}/h 부족)`,
                        accent: result.minimumWage.data.isCompliant,
                    },
                    ]}
                    log={result.minimumWage.log}
                    highlight={result.minimumWage.data.isCompliant ? 'success' : 'danger'}
                />

                {/* 7. 출산전후휴가급여 */}
                <ResultCard
                    title="출산전후휴가급여"
                    mainValue={money(result.maternityLeave.data.actualPay)}
                    subValue={`${result.maternityLeave.data.leaveDays}일 기준${result.maternityLeave.data.isUpperLimitApplied ? ' (상한 적용)' : ''}`}
                    rows={[
                    { label: '사업주 부담', value: money(result.maternityLeave.data.employerPays) },
                    { label: '고용보험 부담', value: money(result.maternityLeave.data.insurancePays) },
                    ]}
                    log={result.maternityLeave.log}
                />

                {/* 8. 육아휴직급여 */}
                <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 font-medium mb-2">
                    육아휴직급여 ({input.parentalLeaveMonths}개월)
                    </p>
                    <p className="text-xl font-medium text-gray-900">
                    {money(result.parentalLeave.data.totalPay)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                    즉시지급 {money(result.parentalLeave.data.totalImmediate)} ·
                    복귀후지급 {money(result.parentalLeave.data.totalDeferred)}
                    </p>
                    <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                        <thead>
                        <tr className="border-b border-gray-100">
                            <th className="text-left py-2 px-3 text-gray-500 font-medium">구분</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium">비율</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium">지급액</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium">즉시</th>
                            <th className="text-right py-2 px-3 text-gray-500 font-medium">복귀후</th>
                        </tr>
                        </thead>
                        <tbody>
                        {result.parentalLeave.data.monthBreakdown.map((m) => (
                            <tr key={m.month} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-1.5 px-3 text-gray-600">{m.label}</td>
                            <td className="py-1.5 px-3 text-right text-gray-600">
                                {(m.rate * 100).toFixed(0)}%
                            </td>
                            <td className="py-1.5 px-3 text-right font-medium">
                                {money(m.calculated)}
                            </td>
                            <td className="py-1.5 px-3 text-right text-blue-600">
                                {money(m.immediate)}
                            </td>
                            <td className="py-1.5 px-3 text-right text-gray-400">
                                {money(m.deferred)}
                            </td>
                            </tr>
                        ))}
                        </tbody>
                        <tfoot>
                        <tr className="bg-gray-50 font-medium">
                            <td className="py-2 px-3">합계</td>
                            <td />
                            <td className="py-2 px-3 text-right">
                            {money(result.parentalLeave.data.totalPay)}
                            </td>
                            <td className="py-2 px-3 text-right text-blue-600">
                            {money(result.parentalLeave.data.totalImmediate)}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-400">
                            {money(result.parentalLeave.data.totalDeferred)}
                            </td>
                        </tr>
                        </tfoot>
                    </table>
                    </div>
                    <button
                    onClick={() => {}}
                    className="mt-3 text-xs text-gray-400 hover:text-gray-600"
                    >
                    ▸ 계산과정 보기
                    </button>
                </div>
                </div>
            )}
            </main>
        </div>
        </div>
    );
    }
    