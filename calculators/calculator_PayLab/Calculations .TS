    /**
     * 급여 노무 플랫폼 - 핵심 계산 엔진
     * 한국 근로기준법 / 고용보험법 기준
     *
     * 모든 함수는 순수 함수(Pure Function)로 작성됨
     * - 사이드 이펙트 없음
     * - 동일 입력 → 동일 출력 보장
     * - 단위 테스트 가능
     */

    import type {
        WorkInput,
        CalcResult,
        OrdinaryWageResult,
        AverageWageResult,
        WeeklyAllowanceResult,
        AnnualLeaveResult,
        AnnualLeaveAllowanceResult,
        MaternityLeaveResult,
        ParentalLeaveResult,
        MinimumWageResult,
        FullCalculationResult,
    } from '../types';
    
    import {
        ANNUAL_LEAVE_POLICY,
        PARENTAL_LEAVE_PAY,
        PARENTAL_LEAVE_PAY_6_PLUS_6,
        WEEKLY_HOLIDAY_MIN_HOURS,
        getMinimumWage,
        getMaternityLeaveUpper,
    } from './policies';
    
    // ─────────────────────────────────────────────────────────────────
    // 내부 유틸리티
    // ─────────────────────────────────────────────────────────────────
    
    /**
     * 주 소정근로시간 기준 월 소정근로시간 계산
     * 공식: (주 소정근로시간 + 주휴시간) × (365일 / 7일) / 12개월
     */
    function calcMonthlyWorkHours(weeklyHours: number): number {
        // 주 40시간 이하: 주휴시간 = 1일 소정근로시간
        // 주 40시간 초과분은 연장근로로 주휴에 미산입
        const effectiveWeeklyHours = Math.min(weeklyHours, 40);
        const weeklyHolidayHours = effectiveWeeklyHours / 5; // 1일 소정근로시간
        return Math.round((effectiveWeeklyHours + weeklyHolidayHours) * (365 / 7) / 12);
    }
    
    function calcWeeklyHolidayHours(weeklyHours: number): number {
        return Math.min(weeklyHours, 40) / 5;
    }
    
    function fmt(n: number): string {
        return Math.round(n).toLocaleString('ko-KR');
    }
    
    function calcDateDiff(hireDate: string, referenceDate?: string) {
        const hire = new Date(hireDate);
        const ref = referenceDate ? new Date(referenceDate) : new Date();
        ref.setHours(0, 0, 0, 0);
        hire.setHours(0, 0, 0, 0);
    
        // 월수 계산 후 일(day) 미달 시 1개월 차감 (정확한 개근월수 산정)
        // 예: 3/15 입사 → 4/10 기준 = 0개월 완성 (4/15 미도래)
        let totalMonths =
        (ref.getFullYear() - hire.getFullYear()) * 12 +
        (ref.getMonth() - hire.getMonth());
        if (ref.getDate() < hire.getDate()) totalMonths--;
        totalMonths = Math.max(totalMonths, 0);
    
        const yearsOfService = Math.floor(totalMonths / 12);
        const monthsOfService = totalMonths;
    
        return { yearsOfService, monthsOfService, totalMonths };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 1. 통상임금 (Ordinary Wage)
    // 근로기준법 시행령 제6조
    // ─────────────────────────────────────────────────────────────────
    export function calculateOrdinaryWage(
        input: Pick<WorkInput, 'baseSalary' | 'fixedAllowances' | 'weeklyHours'>
    ): CalcResult<OrdinaryWageResult> {
        const { baseSalary, fixedAllowances, weeklyHours } = input;
    
        const totalFixed = fixedAllowances.reduce((sum, a) => sum + a.amount, 0);
        const monthlyTotal = baseSalary + totalFixed;
        const monthlyWorkHours = calcMonthlyWorkHours(weeklyHours);
        const weeklyHolidayHours = calcWeeklyHolidayHours(weeklyHours);
        const hourlyRate = monthlyTotal / monthlyWorkHours;
        const dailyWorkHours = Math.min(weeklyHours, 40) / 5; // 1일 소정근로시간
        const dailyRate = hourlyRate * dailyWorkHours;
    
        const log = [
        `▶ 통상임금 계산`,
        `  기본급: ${fmt(baseSalary)}원`,
        ...fixedAllowances.map((a) => `  고정수당 [${a.name}]: ${fmt(a.amount)}원`),
        `  고정수당 합계: ${fmt(totalFixed)}원`,
        `  월 통상임금 합계: ${fmt(monthlyTotal)}원`,
        `  주 소정근로시간: ${weeklyHours}시간`,
        `  주휴시간: ${weeklyHolidayHours}시간/주`,
        `  월 소정근로시간: (${weeklyHours} + ${weeklyHolidayHours}) × (365/7) ÷ 12 ≈ ${monthlyWorkHours}시간`,
        `  시간급 통상임금: ${fmt(monthlyTotal)} ÷ ${monthlyWorkHours} = ${fmt(hourlyRate)}원`,
        `  일급 통상임금: ${fmt(hourlyRate)} × ${dailyWorkHours}h = ${fmt(dailyRate)}원`,
        ];
    
        return {
        data: {
            hourlyRate: Math.round(hourlyRate),
            dailyRate: Math.round(dailyRate),
            monthlyTotal,
            monthlyWorkHours,
            weeklyHolidayHours,
        },
        log,
        };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 2. 평균임금 (Average Wage)
    // 근로기준법 제2조 제1항 제6호
    // ─────────────────────────────────────────────────────────────────
    export function calculateAverageWage(
        input: Pick<WorkInput, 'monthly3months'>
    ): CalcResult<AverageWageResult> {
        const { monthly3months } = input;
    
        // 3개월 총일수: 달력 기준 (정확도를 위해 91일 고정값 사용 가능, 또는 실제 달력 계산)
        // 실무에서는 해당 3개월의 실제 일수를 계산하지만 여기서는 입력받은 값 활용
        const totalDays = 91; // 평균적 3개월 일수 (91~92일)
        const totalPay = monthly3months.reduce((sum, v) => sum + v, 0);
        const dailyAverage = totalPay / totalDays;
    
        // 통상임금과 비교하여 낮은 경우 통상임금 적용 (근로기준법 제2조 제2항)
        const log = [
        `▶ 평균임금 계산`,
        `  최근 3개월 임금:`,
        ...monthly3months.map((v, i) => `    ${i + 1}개월 전: ${fmt(v)}원`),
        `  3개월 총임금: ${fmt(totalPay)}원`,
        `  기준 총일수: ${totalDays}일 (3개월 평균)`,
        `  1일 평균임금: ${fmt(totalPay)} ÷ ${totalDays} = ${fmt(dailyAverage)}원`,
        `  ※ 산출된 평균임금이 통상임금보다 낮으면 통상임금이 적용됩니다 (근로기준법 제2조 제2항)`,
        ];
    
        return {
        data: {
            dailyAverage: Math.round(dailyAverage),
            totalPay,
            totalDays,
        },
        log,
        };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 3. 주휴수당 (Weekly Holiday Allowance)
    // 근로기준법 제55조
    // ─────────────────────────────────────────────────────────────────
    export function calculateWeeklyAllowance(
        input: Pick<WorkInput, 'weeklyHours'> & { hourlyOrdinaryWage: number }
    ): CalcResult<WeeklyAllowanceResult> {
        const { weeklyHours, hourlyOrdinaryWage } = input;
    
        if (weeklyHours < WEEKLY_HOLIDAY_MIN_HOURS) {
        return {
            data: {
            amount: 0,
            monthlyAmount: 0,
            eligible: false,
            dailyHours: weeklyHours / 5,
            },
            log: [
            `▶ 주휴수당 계산`,
            `  주 소정근로시간: ${weeklyHours}시간`,
            `  지급 기준: 주 15시간 이상`,
            `  ❌ 주 ${weeklyHours}시간 → 주휴수당 미지급`,
            ],
        };
        }
    
        const dailyHours = Math.min(weeklyHours, 40) / 5;
        const amount = dailyHours * hourlyOrdinaryWage;
        // 월 환산: 4.345주/월
        const monthlyAmount = amount * 4.345;
    
        return {
        data: {
            amount: Math.round(amount),
            monthlyAmount: Math.round(monthlyAmount),
            eligible: true,
            dailyHours,
        },
        log: [
            `▶ 주휴수당 계산`,
            `  주 소정근로시간: ${weeklyHours}시간 ✅ (15시간 이상)`,
            `  1일 소정근로시간: ${weeklyHours}h ÷ 5일 = ${dailyHours}h`,
            `  시간급 통상임금: ${fmt(hourlyOrdinaryWage)}원`,
            `  주휴수당 (1주): ${dailyHours}h × ${fmt(hourlyOrdinaryWage)}원 = ${fmt(amount)}원`,
            `  월 환산액 (×4.345주): ${fmt(monthlyAmount)}원`,
        ],
        };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 4. 연차휴가 (Annual Leave)
    // 근로기준법 제60조
    // ─────────────────────────────────────────────────────────────────
    export function calculateAnnualLeave(
        input: Pick<WorkInput, 'hireDate' | 'leaveDaysUsed' | 'referenceDate'>
    ): CalcResult<AnnualLeaveResult> {
        const { hireDate, leaveDaysUsed, referenceDate } = input;
        const { yearsOfService, monthsOfService } = calcDateDiff(hireDate, referenceDate);
    
        let totalDays = 0;
        let description = '';
    
        if (yearsOfService < 1) {
        // 1년 미만: 1개월 개근 시 1일 (최대 11일)
        totalDays = Math.min(monthsOfService, ANNUAL_LEAVE_POLICY.UNDER_1_YEAR_MAX);
        description = `1년 미만 근속 → 개근 월수(${monthsOfService}개월) = ${totalDays}일 (최대 11일)`;
        } else {
        // 1년 이상: 15일 기본 + 2년마다 1일 추가 (최대 25일)
        const extra = Math.floor((yearsOfService - 1) / 2);
        totalDays = Math.min(
            ANNUAL_LEAVE_POLICY.BASE_DAYS + extra,
            ANNUAL_LEAVE_POLICY.MAX_DAYS
        );
        description = `${yearsOfService}년 근속 → 기본 ${ANNUAL_LEAVE_POLICY.BASE_DAYS}일 + 가산 ${extra}일 = ${totalDays}일`;
        }
    
        const usedDays = leaveDaysUsed ?? 0;
        const remainingDays = Math.max(totalDays - usedDays, 0);
    
        const refDate = referenceDate ?? new Date().toISOString().split('T')[0];
    
        return {
        data: {
            totalDays,
            usedDays,
            remainingDays,
            yearsOfService,
            monthsOfService,
            description,
        },
        log: [
            `▶ 연차휴가 계산`,
            `  입사일: ${hireDate}`,
            `  기준일: ${refDate}`,
            `  근속기간: ${yearsOfService}년 ${monthsOfService % 12}개월 (총 ${monthsOfService}개월)`,
            `  연차 산정: ${description}`,
            `  발생 연차: ${totalDays}일`,
            `  사용 연차: ${usedDays}일`,
            `  잔여 연차: ${remainingDays}일`,
        ],
        };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 5. 연차수당 (Annual Leave Allowance)
    // 근로기준법 제60조 제4항
    // ─────────────────────────────────────────────────────────────────
    export function calculateAnnualLeaveAllowance(
        unusedDays: number,
        dailyOrdinaryWage: number
    ): CalcResult<AnnualLeaveAllowanceResult> {
        const amount = unusedDays * dailyOrdinaryWage;
    
        return {
        data: {
            amount: Math.round(amount),
            unusedDays,
            dailyOrdinaryWage,
        },
        log: [
            `▶ 연차수당 계산`,
            `  미사용 연차: ${unusedDays}일`,
            `  1일 통상임금: ${fmt(dailyOrdinaryWage)}원`,
            `  연차수당: ${unusedDays}일 × ${fmt(dailyOrdinaryWage)}원 = ${fmt(amount)}원`,
            `  ※ 연차사용촉진제도 적용 시 수당 지급 의무 면제될 수 있음`,
        ],
        };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 6. 출산전후휴가급여 (Maternity Leave Pay)
    // 근로기준법 제74조 / 고용보험법 제75조
    // ─────────────────────────────────────────────────────────────────
    export function calculateMaternityLeavePay(
        input: Pick<WorkInput, 'year' | 'multiplePregnancy'> & { dailyOrdinaryWage: number }
    ): CalcResult<MaternityLeaveResult> {
        const { dailyOrdinaryWage, year, multiplePregnancy = false } = input;
    
        const leaveDays = multiplePregnancy ? 120 : 90;
        const totalByOrdinary = dailyOrdinaryWage * leaveDays;
    
        // 상한액: 고용보험 지급 기준 (3개월 총액)
        const monthlyUpper = getMaternityLeaveUpper(year);
        const upperLimit = monthlyUpper * 3;
    
        // 통상임금 > 상한액 이면 상한 적용
        const actualPay = Math.min(totalByOrdinary, upperLimit);
        const isUpperLimitApplied = totalByOrdinary > upperLimit;
    
        // 사업주 부담: 최초 60일 (다태아 75일), 통상임금 기준 (월상한 × 2개월 이내)
        const employerDays = multiplePregnancy ? 75 : 60;
        const employerPays = Math.min(dailyOrdinaryWage * employerDays, monthlyUpper * 2);
        const insurancePays = actualPay - employerPays;
    
        return {
        data: {
            leaveDays,
            totalByOrdinary: Math.round(totalByOrdinary),
            upperLimit,
            actualPay: Math.round(actualPay),
            isUpperLimitApplied,
            employerPays: Math.round(employerPays),
            insurancePays: Math.max(Math.round(insurancePays), 0),
        },
        log: [
            `▶ 출산전후휴가급여 계산`,
            `  구분: ${multiplePregnancy ? '다태아 (120일)' : '단태아 (90일)'}`,
            `  1일 통상임금: ${fmt(dailyOrdinaryWage)}원`,
            `  통상임금 기준 총액: ${leaveDays}일 × ${fmt(dailyOrdinaryWage)} = ${fmt(totalByOrdinary)}원`,
            `  ${year}년 월 상한액 (고용보험): ${fmt(monthlyUpper)}원`,
            `  3개월 상한총액: ${fmt(upperLimit)}원`,
            isUpperLimitApplied
            ? `  ⚠️ 상한액 적용: 실지급액 = ${fmt(actualPay)}원`
            : `  ✅ 상한 미적용: 전액 지급 = ${fmt(actualPay)}원`,
            `  ▸ 사업주 부담 (최초 ${employerDays}일): ${fmt(employerPays)}원`,
            `  ▸ 고용보험 부담 (나머지): ${fmt(Math.max(insurancePays, 0))}원`,
        ],
        };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 7. 육아휴직급여 (Parental Leave Pay)
    // 고용보험법 제70조
    // ─────────────────────────────────────────────────────────────────
    export function calculateParentalLeavePay(
        input: Pick<WorkInput, 'parentalLeaveMonths' | 'parentalLeave6Plus6'> & {
        dailyAverageWage: number;
        }
    ): CalcResult<ParentalLeaveResult> {
        const {
        dailyAverageWage,
        parentalLeaveMonths = 12,
        parentalLeave6Plus6 = false,
        } = input;
    
        const monthlyAvg = dailyAverageWage * 30;
        const months = Math.min(parentalLeaveMonths, PARENTAL_LEAVE_PAY.MAX_MONTHS);
    
        const sixPlusSixLimits = [
        PARENTAL_LEAVE_PAY_6_PLUS_6.month1,
        PARENTAL_LEAVE_PAY_6_PLUS_6.month2,
        PARENTAL_LEAVE_PAY_6_PLUS_6.month3,
        PARENTAL_LEAVE_PAY_6_PLUS_6.month4,
        PARENTAL_LEAVE_PAY_6_PLUS_6.month5,
        PARENTAL_LEAVE_PAY_6_PLUS_6.month6,
        ];
    
        const monthBreakdown = Array.from({ length: months }, (_, i) => {
        const m = i + 1;
        let rate: number;
        let upper: number;
        let lower: number;
        let label: string;
    
        if (parentalLeave6Plus6 && m <= 6) {
            rate = 1.0; // 100% 지급 (6+6 적용 시)
            upper = sixPlusSixLimits[i];
            lower = PARENTAL_LEAVE_PAY.FIRST_3_MONTHS.lower;
            label = `${m}개월차 (6+6제도: 100%, 상한 ${fmt(upper)}원)`;
        } else if (m <= 3) {
            rate = PARENTAL_LEAVE_PAY.FIRST_3_MONTHS.rate;
            upper = PARENTAL_LEAVE_PAY.FIRST_3_MONTHS.upper;
            lower = PARENTAL_LEAVE_PAY.FIRST_3_MONTHS.lower;
            label = `${m}개월차 (80%)`;
        } else {
            rate = PARENTAL_LEAVE_PAY.REMAINING.rate;
            upper = PARENTAL_LEAVE_PAY.REMAINING.upper;
            lower = PARENTAL_LEAVE_PAY.REMAINING.lower;
            label = `${m}개월차 (50%)`;
        }
    
        const calculated = Math.max(Math.min(monthlyAvg * rate, upper), lower);
        const deferred = Math.round(calculated * PARENTAL_LEAVE_PAY.DEFERRED_RATIO);
        const immediate = calculated - deferred;
    
        return {
            month: m,
            label,
            rate,
            calculated: Math.round(calculated),
            deferred,
            immediate: Math.round(immediate),
        };
        });
    
        const totalPay = monthBreakdown.reduce((s, m) => s + m.calculated, 0);
        const totalDeferred = monthBreakdown.reduce((s, m) => s + m.deferred, 0);
        const totalImmediate = totalPay - totalDeferred;
    
        return {
        data: {
            monthlyAvg: Math.round(monthlyAvg),
            monthBreakdown,
            totalPay,
            totalImmediate,
            totalDeferred,
        },
        log: [
            `▶ 육아휴직급여 계산`,
            `  1일 평균임금: ${fmt(dailyAverageWage)}원`,
            `  월 평균임금 (×30일): ${fmt(monthlyAvg)}원`,
            `  신청 개월: ${months}개월`,
            parentalLeave6Plus6
            ? `  ✅ 6+6 부모육아휴직제 적용 (2024년 개정)`
            : `  일반 육아휴직급여 적용`,
            `  지급 구조:`,
            `    - 1~3개월: 통상임금의 80% (상한 150만원)`,
            `    - 4~12개월: 통상임금의 50% (상한 120만원)`,
            `  총 예상 지급액: ${fmt(totalPay)}원`,
            `  ▸ 즉시 지급 (75%): ${fmt(totalImmediate)}원`,
            `  ▸ 복귀 후 지급 (25%): ${fmt(totalDeferred)}원 (복직 후 6개월 이후 일시지급)`,
        ],
        };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 8. 최저임금 검증 (Minimum Wage Validation)
    // 최저임금법 제6조
    // ─────────────────────────────────────────────────────────────────
    export function validateMinimumWage(
        input: Pick<WorkInput, 'baseSalary' | 'fixedAllowances' | 'variableAllowances' | 'weeklyHours' | 'year'>
    ): CalcResult<MinimumWageResult> {
        const { baseSalary, fixedAllowances, variableAllowances, weeklyHours, year } = input;
    
        const minimumHourly = getMinimumWage(year);
        const monthlyWorkHours = calcMonthlyWorkHours(weeklyHours);
    
        // 최저임금 산입 범위: 기본급 + 고정수당 + 상여금(월환산 25% 초과분) + 복리후생비(월환산 7% 초과분)
        // 간소화: 기본급 + 고정수당 + 비고정수당 합산
        const totalFixed = fixedAllowances.reduce((s, a) => s + a.amount, 0);
        const totalVariable = variableAllowances.reduce((s, a) => s + a.amount, 0);
        const totalMonthlyPay = baseSalary + totalFixed + totalVariable;
    
        const actualHourly = totalMonthlyPay / monthlyWorkHours;
        const minimumMonthly = minimumHourly * monthlyWorkHours;
        const isCompliant = actualHourly >= minimumHourly;
        const diff = actualHourly - minimumHourly;
    
        return {
        data: {
            minimumHourly,
            actualHourly: Math.round(actualHourly),
            isCompliant,
            diff: Math.round(diff),
            monthlyWorkHours,
            minimumMonthly: Math.round(minimumMonthly),
        },
        log: [
            `▶ 최저임금 검증 (${year}년 기준)`,
            `  ${year}년 최저임금: ${fmt(minimumHourly)}원/시간`,
            `  월 소정근로시간: ${monthlyWorkHours}시간`,
            `  최저임금 기준 월 최소임금: ${fmt(minimumMonthly)}원`,
            `  실제 시간당 임금: ${fmt(totalMonthlyPay)} ÷ ${monthlyWorkHours} = ${fmt(actualHourly)}원`,
            isCompliant
            ? `  ✅ 최저임금 준수 (${fmt(diff)}원 초과)`
            : `  ❌ 최저임금 위반! (${fmt(Math.abs(diff))}원 부족)`,
            `  ※ 상여금·복리후생비 산입 범위 초과분은 별도 계산 필요`,
        ],
        };
    }
    
    // ─────────────────────────────────────────────────────────────────
    // 통합 계산 실행
    // ─────────────────────────────────────────────────────────────────
    export function runFullCalculation(input: WorkInput): FullCalculationResult {
        const ordinaryWage = calculateOrdinaryWage(input);
        const averageWage = calculateAverageWage(input);
    
        const weeklyAllowance = calculateWeeklyAllowance({
        weeklyHours: input.weeklyHours,
        hourlyOrdinaryWage: ordinaryWage.data.hourlyRate,
        });
    
        const annualLeave = calculateAnnualLeave(input);
    
        const annualLeaveAllowance = calculateAnnualLeaveAllowance(
        annualLeave.data.remainingDays,
        ordinaryWage.data.dailyRate
        );
    
        const maternityLeave = calculateMaternityLeavePay({
        dailyOrdinaryWage: ordinaryWage.data.dailyRate,
        year: input.year,
        multiplePregnancy: input.multiplePregnancy,
        });
    
        // 평균임금 < 통상임금이면 통상임금으로 대체 (근로기준법 제2조 제2항)
        const effectiveDailyWage = Math.max(
        averageWage.data.dailyAverage,
        ordinaryWage.data.dailyRate
        );
    
        const parentalLeave = calculateParentalLeavePay({
        dailyAverageWage: effectiveDailyWage,
        parentalLeaveMonths: input.parentalLeaveMonths,
        parentalLeave6Plus6: input.parentalLeave6Plus6,
        });
    
        const minimumWage = validateMinimumWage(input);
    
        return {
        ordinaryWage,
        averageWage,
        weeklyAllowance,
        annualLeave,
        annualLeaveAllowance,
        maternityLeave,
        parentalLeave,
        minimumWage,
        };
    }
    
    