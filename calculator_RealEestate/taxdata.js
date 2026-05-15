    /**
     * taxdata.js — 부동산 세법 및 요율 데이터
     * =====================================================
     * ⚠️  세법 변경 시 이 파일만 수정하세요.
     *     각 항목의 updated 필드로 마지막 업데이트 일자를 관리합니다.
     *     script.js의 계산 로직은 건드리지 않아도 됩니다.
     * =====================================================
     */

    const TAX_DATA = {

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 1. 공인중개사 중개보수 요율
        //    근거: 공인중개사법 시행규칙 제20조 (2023.10 개정)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        agentFee: {
        updated: '2023-10',
        note: '서울·수도권 기준. 지자체 조례에 따라 차이 있을 수 있음',
    
        residential: {
            // 주거용 부동산 매매·교환
            buy: [
            { max: 50_000_000,   rate: 0.006, maxFee: 250_000 },
            { max: 200_000_000,  rate: 0.005, maxFee: 800_000 },
            { max: 900_000_000,  rate: 0.004, maxFee: null },
            { max: 1_200_000_000,rate: 0.005, maxFee: null },
            { max: 1_500_000_000,rate: 0.006, maxFee: null },
            { max: Infinity,     rate: 0.007, maxFee: null },
            ],
            // 주거용 부동산 임대차 (전세·월세)
            rent: [
            { max: 50_000_000,   rate: 0.005, maxFee: 200_000 },
            { max: 100_000_000,  rate: 0.004, maxFee: 300_000 },
            { max: 600_000_000,  rate: 0.003, maxFee: null },
            { max: 1_200_000_000,rate: 0.004, maxFee: null },
            { max: 1_500_000_000,rate: 0.005, maxFee: null },
            { max: Infinity,     rate: 0.006, maxFee: null },
            ],
        },
    
        officetel: {
            // 오피스텔 (업무용 목적)
            buy:  { rate: 0.005, maxFee: null },
            rent: { rate: 0.004, maxFee: null },
        },
    
        commercial: {
            // 상가·토지·기타 비주거용
            maxRate: 0.009,
            note: '0.9% 이내에서 중개의뢰인과 개업공인중개사가 협의',
        },
        },
    
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 2. 취득세율
        //    근거: 지방세법 제11조·제13조 (2024 기준)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        acquisitionTax: {
        updated: '2024-01',
        note: '생애최초 감면(200만원 한도), 일시적 2주택 등 별도 조건 적용 가능',
    
        residential: {
            oneHouse: [
            { max: 600_000_000, rate: 0.01 },
            { max: 900_000_000, rate: 0.02 },
            { max: Infinity,    rate: 0.03 },
            ],
            twoHouse: {
            regulated: 0.08,
            normalBrackets: [
                { max: 600_000_000, rate: 0.01 },
                { max: 900_000_000, rate: 0.02 },
                { max: Infinity,    rate: 0.03 },
            ],
            },
            threeHousePlus: {
            regulated: 0.12,
            normal:    0.08,
            },
            corporation: 0.12,
        },
    
        nonResidential: {
            land:       0.04,
            commercial: 0.04,
            other:      0.04,
        },
    
        // 취득세에 부가되는 세금
        surcharge: {
            localEduRate: 0.20,   // 지방교육세: 취득세의 20%
            ruralSpecial: 0.10,   // 농어촌특별세: 취득세의 10% (비주거용, 전용면적 85㎡ 초과)
        },
        },
    
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 3. 재산세
        //    근거: 지방세법 제111조 (2024 기준)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        propertyTax: {
        updated: '2024-01',
    
        residential: {
            fairMarketRatio: 0.43,   // 공정시장가액비율 (2024: 43%)
            rates: [
            { max: 60_000_000,  rate: 0.001,  deduction: 0 },
            { max: 150_000_000, rate: 0.0015, deduction: 30_000 },
            { max: 300_000_000, rate: 0.0025, deduction: 180_000 },
            { max: Infinity,    rate: 0.004,  deduction: 630_000 },
            ],
        },
    
        land: {
            aggregate: [   // 종합합산 (나대지 등)
            { max: 50_000_000,    rate: 0.002, deduction: 0 },
            { max: 1_000_000_000, rate: 0.003, deduction: 50_000 },
            { max: Infinity,      rate: 0.005, deduction: 2_050_000 },
            ],
            separate: [   // 별도합산 (사업용 토지 등)
            { max: 200_000_000,   rate: 0.002, deduction: 0 },
            { max: 1_000_000_000, rate: 0.003, deduction: 200_000 },
            { max: Infinity,      rate: 0.004, deduction: 1_200_000 },
            ],
        },
    
        localEduRate: 0.20,     // 지방교육세: 재산세의 20%
        urbanAreaRate: 0.0014,  // 도시지역분: 과세표준의 0.14%
        },
    
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 4. 종합부동산세
        //    근거: 종합부동산세법 (2024 기준)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        comprehensiveRETax: {
        updated: '2024-01',
        note: '공정시장가액비율 60% 적용. 공동명의 각각 9억 공제',
    
        fairMarketRatio: 0.60,
    
        deduction: {
            oneHouse:       1_200_000_000,
            multiHouse:     900_000_000,
            jointOwnership: 900_000_000,
        },
    
        residential: {
            normal: [   // 일반 (2주택 이하, 비조정 3주택)
            { max: 300_000_000,    rate: 0.005, deduction: 0 },
            { max: 600_000_000,    rate: 0.007, deduction: 600_000 },
            { max: 1_200_000_000,  rate: 0.010, deduction: 2_400_000 },
            { max: 2_500_000_000,  rate: 0.013, deduction: 6_000_000 },
            { max: 5_000_000_000,  rate: 0.015, deduction: 11_000_000 },
            { max: Infinity,       rate: 0.027, deduction: 71_000_000 },
            ],
            heavy: [   // 중과 (조정 2주택, 3주택 이상)
            { max: 300_000_000,    rate: 0.005, deduction: 0 },
            { max: 600_000_000,    rate: 0.007, deduction: 600_000 },
            { max: 1_200_000_000,  rate: 0.010, deduction: 2_400_000 },
            { max: 2_500_000_000,  rate: 0.020, deduction: 14_400_000 },
            { max: 5_000_000_000,  rate: 0.030, deduction: 39_400_000 },
            { max: Infinity,       rate: 0.050, deduction: 139_400_000 },
            ],
        },
    
        ruralSpecialRate: 0.20,  // 농어촌특별세: 종부세의 20%
        },
    
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 5. 양도소득세
        //    근거: 소득세법 제104조 (2024 기준)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        capitalGainsTax: {
        updated: '2024-01',
        note: '매우 복잡한 세목. 본 계산기는 단순 추산용. 전문가 상담 권장',
    
        basicDeduction: 2_500_000,
    
        normalRates: [
            { max: 14_000_000,   rate: 0.06, deduction: 0 },
            { max: 50_000_000,   rate: 0.15, deduction: 1_260_000 },
            { max: 88_000_000,   rate: 0.24, deduction: 5_760_000 },
            { max: 150_000_000,  rate: 0.35, deduction: 15_440_000 },
            { max: 300_000_000,  rate: 0.38, deduction: 19_940_000 },
            { max: 500_000_000,  rate: 0.40, deduction: 25_940_000 },
            { max: 1_000_000_000,rate: 0.42, deduction: 35_940_000 },
            { max: Infinity,     rate: 0.45, deduction: 65_940_000 },
        ],
    
        shortTerm: {
            under1year: 0.70,
            under2year: 0.60,
        },
    
        longTermDeduction: {
            general: [   // 일반 장특공 (연 2%, 최대 30%)
            { years: 3,  rate: 0.06 }, { years: 4,  rate: 0.08 },
            { years: 5,  rate: 0.10 }, { years: 6,  rate: 0.12 },
            { years: 7,  rate: 0.14 }, { years: 8,  rate: 0.16 },
            { years: 9,  rate: 0.18 }, { years: 10, rate: 0.20 },
            { years: 11, rate: 0.22 }, { years: 12, rate: 0.24 },
            { years: 13, rate: 0.26 }, { years: 14, rate: 0.28 },
            { years: 15, rate: 0.30 },
            ],
            oneHouse: [  // 1세대 1주택 (보유 4% + 거주 4%, 최대 80%)
            { years: 3,  rateHold: 0.12, rateLive: 0.12 },
            { years: 4,  rateHold: 0.16, rateLive: 0.16 },
            { years: 5,  rateHold: 0.20, rateLive: 0.20 },
            { years: 6,  rateHold: 0.24, rateLive: 0.24 },
            { years: 7,  rateHold: 0.28, rateLive: 0.28 },
            { years: 8,  rateHold: 0.32, rateLive: 0.32 },
            { years: 9,  rateHold: 0.36, rateLive: 0.36 },
            { years: 10, rateHold: 0.40, rateLive: 0.40 },
            ],
        },
        },
    
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 6. 등기비용
        //    근거: 등록면허세법, 대법원 법무사보수규정 (2024 기준)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        registrationFee: {
        updated: '2024-06',
    
        mortgage: {
            rate: 0.002,        // 근저당 설정: 채권최고액의 0.2%
            localEduRate: 0.20, // 지방교육세: 등록세의 20%
        },
    
        // 대법원 법무사 보수 기준
        notaryFee: [
            { max: 10_000_000,   base: 0,         rate: 0.0040, min: 50_000 },
            { max: 20_000_000,   base: 40_000,    rate: 0.0030, min: null },
            { max: 50_000_000,   base: 70_000,    rate: 0.0020, min: null },
            { max: 100_000_000,  base: 130_000,   rate: 0.0015, min: null },
            { max: 300_000_000,  base: 205_000,   rate: 0.0010, min: null },
            { max: 500_000_000,  base: 405_000,   rate: 0.0007, min: null },
            { max: 1_000_000_000,base: 545_000,   rate: 0.0005, min: null },
            { max: Infinity,     base: 1_045_000, rate: 0.0002, min: null, maxFee: 1_500_000 },
        ],
    
        // 인지세
        stampDuty: [
            { max: 10_000_000,  amount: 0 },
            { max: 30_000_000,  amount: 20_000 },
            { max: 50_000_000,  amount: 40_000 },
            { max: 100_000_000, amount: 70_000 },
            { max: 1_000_000_000, amount: 150_000 },
            { max: Infinity,    amount: 350_000 },
        ],
        },
    
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 7. 대출 규제 비율 (LTV / DTI / DSR)
        //    근거: 금융감독원 가계대출 규정 (2024.09 기준)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        loanRegulation: {
        updated: '2024-09',
        note: '스트레스DSR 2단계 적용 (2024.09). 규제지역 현황은 금융위원회 사이트에서 확인',
    
        ltv: {
            regulated: {
            noHouse:    0.50,
            oneHouse:   0.50,
            multiHouse: 0.30,
            },
            normal: {
            noHouse:    0.70,
            oneHouse:   0.60,
            multiHouse: 0.60,
            },
            firstTimeBuyer: 0.80,
        },
    
        dti: {
            regulated: 0.40,
            normal:    0.60,
        },
    
        dsr: {
            bank:      0.40,
            nonBank:   0.50,
            threshold: 100_000_000,
        },
        },
    
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 8. 전월세 전환율
        //    근거: 주택임대차보호법 시행령 제9조
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        rentConversion: {
        updated: '2024-10',
        note: '법정 상한율 = 한국은행 기준금리 + 2%. 기준금리 변경 시 bankRate 수정 필요',
    
        bankRate:     0.0325,   // 한국은행 기준금리 (2024.10: 3.25%)
        legalPremium: 0.02,     // 법적 가산율 2%
        // 법정 상한 전환율 = bankRate + legalPremium = 5.25%
        },
    
    };
    