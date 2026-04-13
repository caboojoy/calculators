document.addEventListener("DOMContentLoaded", () => {
    const calculator = {
        mainDisplay: document.getElementById("main-display"),
        subDisplay: document.getElementById("sub-display"),
        decimalPlaces: document.getElementById("decimal-places"),
        roundingMethod: document.getElementById("rounding-method"),
        colorSelect: document.getElementById("color-select"),
        memory: 0,
        taxRate: 10, // 기본 세율 10%
        isNewInput: true,
        calculationComplete: false,
        isAreaConversionMode: false,
        lastCalculatedValue: null,
        operationHistory: [], // 연산 기록을 위한 배열
        currentExpression: "0", // 현재 표현식 저장

        /**
         * 계산기 초기화
         */
        init() {
            this.bindEvents();
            this.mainDisplay.value = "0";
            this.loadColorPreference();
            this.grandTotalValue = 0; // GT 총합 초기화 (함수와 이름 충돌 방지)
            this.calculationResults = []; // 계산 결과 히스토리
        },

        /**
         * 이벤트 리스너 등록
         */
        bindEvents() {
            // 숫자 및 연산 버튼 이벤트
            document
                .querySelector(".buttons")
                .addEventListener("click", (e) => {
                    if (e.target.tagName === "BUTTON") {
                        const action = e.target.dataset.action;
                        const value = e.target.dataset.value;
                        console.log("버튼 클릭:", action, value);
                        if (action && this[action]) {
                            this[action](value);
                        } else {
                            console.error("정의되지 않은 액션:", action);
                        }
                    }
                });

            // 키보드 이벤트
            document.addEventListener("keydown", (e) => this.handleKeyPress(e));

            // 소수점, 반올림 방식 설정 변경 이벤트
            this.decimalPlaces.addEventListener("change", () =>
                this.updateDisplay(this.mainDisplay.value, this.calculationComplete)
            );
            this.roundingMethod.addEventListener("change", () =>
                this.updateDisplay(this.mainDisplay.value, this.calculationComplete)
            );

            // 색상 변경 이벤트
            this.colorSelect.addEventListener("change", (e) => {
                this.changeCalculatorColor(e.target.value);
            });
        },

        /**
         * 오류 표시
         * @param {string} message - 오류 메시지
         */
        showError(message = "Error") {
            this.mainDisplay.value = "Error";
            this.subDisplay.innerText = message;
            this.mainDisplay.classList.add("error");
            this.calculationComplete = true;
            this.isNewInput = true;
        },

        /**
         * 오류 상태 해제
         */
        clearError() {
            this.mainDisplay.classList.remove("error");
        },

        /**
         * 화면 업데이트
         * @param {string} value - 표시할 값 (기본값: 현재 화면값)
         * @param {boolean} isResult - 계산 결과인지 여부
         */
        updateDisplay(value = this.mainDisplay.value, isResult = false) {
            if (!value || value === "") {
                this.mainDisplay.value = "0";
                return;
            }

            // Error 상태면 처리하지 않음
            if (value === "Error") return;

            this.clearError();

            try {
                // 소수점으로 끝나는 경우 처리
                const endsWithDecimal = value.endsWith(".");

                // 콤마와 공백 제거한 깨끗한 값
                let cleanValue = value.replace(/[,\s]/g, "");

                // 표현식이 포함된 값인지 확인
                if (this.isExpression(cleanValue)) {
                    // 수식 포맷팅 (천 단위 구분자 등)
                    this.mainDisplay.value = this.formatExpression(
                        cleanValue,
                        isResult
                    );

                    // 소수점으로 끝나면 소수점 보존
                    if (
                        endsWithDecimal &&
                        !this.mainDisplay.value.endsWith(".")
                    ) {
                        this.mainDisplay.value += ".";
                    }
                } else {
                    // 단일 숫자 포맷팅
                    if (cleanValue.endsWith(".")) {
                        // 소수점으로 끝나는 경우 소수점 보존
                        let formattedValue = this.formatNumber(
                            cleanValue.slice(0, -1),
                            isResult
                        );
                        this.mainDisplay.value = formattedValue + ".";
                    } else {
                        this.mainDisplay.value = this.formatNumber(
                            cleanValue,
                            isResult
                        );
                    }
                }

                // 괄호 균형 확인 및 시각적 표시
                this.checkBracketBalance();
            } catch (error) {
                console.error("표시 오류:", error);
                this.mainDisplay.value = value; // 오류 시 원래 입력 유지
            }
        },

        /**
         * 표현식인지 확인 (숫자만 있는지 vs 연산자도 포함되어 있는지)
         * @param {string} value - 확인할 문자열
         * @returns {boolean} - 표현식 여부
         */
        isExpression(value) {
            // 맨 앞의 - 부호(음수)를 제거한 후 연산자 여부 확인 (음수를 표현식으로 오판 방지)
            const stripped = value.replace(/^-/, "");
            return /[\+\-\×\÷\(\)%]/.test(stripped);
        },

        /**
         * 괄호 균형 확인 및 시각적 표시
         */
        checkBracketBalance() {
            const expression = this.mainDisplay.value;
            const openCount = (expression.match(/\(/g) || []).length;
            const closeCount = (expression.match(/\)/g) || []).length;

            if (openCount > closeCount) {
                this.mainDisplay.classList.add("bracket-warning");
                this.subDisplay.innerText = `닫히지 않은 괄호: ${
                    openCount - closeCount
                }개`;
            } else {
                this.mainDisplay.classList.remove("bracket-warning");
                // 서브 디스플레이에 다른 내용이 없을 때만 비움
                if (this.subDisplay.innerText.includes("닫히지 않은 괄호")) {
                    this.subDisplay.innerText = "";
                }
            }
        },

        /**
         * 표현식 포맷팅 (콤마, 서식 적용)
         * @param {string} expr - 원본 표현식
         * @param {boolean} isResult - 계산 결과인지 여부
         * @returns {string} - 포맷팅된 표현식
         */
        formatExpression(expr, isResult = false) {
            // 연산자를 기준으로 분할
            const tokens = this.tokenizeExpression(expr);

            return tokens
                .map((token) => {
                    // 연산자나 괄호는 그대로 반환
                    if (/^[\+\-\×\÷\(\)%]$/.test(token)) {
                        return token;
                    }
                    // 숫자는 포맷팅
                    if (token && !isNaN(parseFloat(token))) {
                        return this.formatNumber(parseFloat(token), isResult);
                    }
                    // 그 외에는 그대로
                    return token;
                })
                .join("");
        },

        /**
         * 표현식을 토큰으로 분리 (개선된 토큰화)
         * @param {string} expr - 원본 표현식
         * @returns {string[]} - 토큰 배열
         */
        tokenizeExpression(expr) {
            const tokens = [];
            let currentNumber = "";
            let lastChar = "";

            // 표현식의 각 문자를 순회하며 토큰화
            for (let i = 0; i < expr.length; i++) {
                const char = expr[i];

                if (/[\+\-\×\÷\(\)%]/.test(char)) {
                    // 숫자가 저장되어 있으면 먼저 토큰으로 추가
                    if (currentNumber !== "") {
                        tokens.push(currentNumber);
                        currentNumber = "";
                    }
                    tokens.push(char);
                } else if (/[\d\.]/.test(char)) {
                    // 숫자나 소수점은 현재 숫자에 누적
                    currentNumber += char;
                }

                lastChar = char;
            }

            // 마지막에 남은 숫자 처리
            if (currentNumber !== "") {
                tokens.push(currentNumber);
            }

            return tokens;
        },

        /**
         * 숫자에 천 단위 구분자 및 포맷팅 적용
         * @param {number|string} num - 포맷팅할 숫자
         * @param {boolean} isResult - 계산 결과인지 여부 (true면 소수점 설정 적용)
         * @returns {string} - 포맷팅된 숫자 문자열
         */
        formatNumber(num, isResult = false) {
            // 입력된 값 정리
            let originalNum;
            if (typeof num === "string") {
                originalNum = num.replace(/,/g, ""); // 천 단위 구분자 제거
            } else {
                originalNum = num.toString();
            }

            // 숫자로 변환
            let parsedNum = parseFloat(originalNum);
            if (isNaN(parsedNum)) return originalNum; // 숫자가 아니면 원래 값 반환

            // 소수점 자릿수 설정 - 결과 출력 시에만 적용
            if (isResult) {
                let places = parseInt(this.decimalPlaces.value);
                const method = this.roundingMethod.value;

                // 반올림, 올림, 버림 적용
                if (places !== -1 && method !== "none") {
                    const factor = Math.pow(10, places);
                    if (method === "round") {
                        parsedNum = Math.round(parsedNum * factor) / factor;
                    } else if (method === "floor") {
                        parsedNum = Math.floor(parsedNum * factor) / factor;
                    } else if (method === "ceil") {
                        parsedNum = Math.ceil(parsedNum * factor) / factor;
                    }
                }
            }

            // 정수부 및 소수부 분리
            let [intPart, fracPart] = parsedNum.toString().split(".");

            // 천 단위 구분자 추가
            intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

            // 소수부 처리
            if (originalNum.includes(".") || fracPart !== undefined) {
                // 결과값일 경우 소수점 자릿수 설정 적용
                if (isResult) {
                    let places = parseInt(this.decimalPlaces.value);

                    if (places === 0) {
                        return intPart; // 소수점 자릿수가 0이면 정수부만 반환
                    } else if (places === -1) {
                        // '전체'일 경우 원래 입력값 유지
                        return fracPart !== undefined
                            ? `${intPart}.${fracPart}`
                            : intPart;
                    } else if (fracPart !== undefined) {
                        // 소수점 자릿수에 맞게 조정
                        if (fracPart.length > places) {
                            fracPart = fracPart.slice(0, places);
                        } else {
                            // 소수점 자릿수가 부족하면 0으로 채움
                            fracPart = fracPart.padEnd(places, "0");
                        }
                        return `${intPart}.${fracPart}`;
                    }
                } else {
                    // 입력값일 경우 소수점 그대로 유지
                    return fracPart !== undefined
                        ? `${intPart}.${fracPart}`
                        : originalNum.endsWith(".")
                        ? `${intPart}.`
                        : intPart;
                }
            }

            return intPart; // 정수만 입력된 경우
        },

        /**
         * 숫자 또는 연산자 추가
         * @param {string} value - 추가할 값
         */
        append(value) {
            // 현재 디스플레이 값 가져오기 (콤마 제거)
            let currentValue = this.mainDisplay.value.replace(/,/g, "");

            // Error 상태면 초기화
            if (currentValue === "Error") {
                this.clearAll();
                currentValue = "0";
            }

            // 방금 계산을 완료했다면 상태에 따라 처리
            if (this.calculationComplete) {
                // 연산자를 입력하는 경우 이전 결과에 이어서 계산
                if (/[\+\-\×\÷]/.test(value)) {
                    this.lastCalculatedValue = currentValue;
                } else {
                    // 숫자나 그 외의 입력이면 새로운 계산 시작
                    currentValue = "";
                }
                this.subDisplay.innerText = ""; // 서브 디스플레이 초기화
                this.calculationComplete = false;
            }

            // 새로운 입력 시작 처리
            if (this.isNewInput) {
                // 연산자 뒤에 오는 경우는 새 입력으로 처리하지 않고 기존 수식에 추가
                if (/[\+\-\×\÷]$/.test(currentValue)) {
                    this.isNewInput = false;
                }
                // 수식의 시작이나 괄호 입력이 아닌 경우에만 초기화
                else if (
                    !/[\(\)]/.test(value) &&
                    currentValue !== "0" &&
                    currentValue !== ""
                ) {
                    if (!/[\+\-\×\÷\(]$/.test(currentValue)) {
                        currentValue = "";
                        this.subDisplay.innerText = ""; // 서브 디스플레이 초기화
                    }
                }
            }
            this.isNewInput = false;

            // 현재 값이 0이면 괄호나 소수점이 아닌 경우 자동 삭제
            if (
                currentValue === "0" &&
                value !== "." &&
                value !== "(" &&
                value !== "%"
            ) {
                currentValue = value;
            }
            // 괄호 입력이 제한되지 않도록 수정하고, 일반 숫자/연산자는 길이 제한
            else if (
                value === "(" ||
                value === ")" ||
                currentValue.length < 15
            ) {
                currentValue += value;
            }

            // 입력 값을 화면에 표시
            this.mainDisplay.value = currentValue;
            this.updateDisplay(currentValue);

            // 현재 표현식 저장
            this.currentExpression = currentValue;
        },

        /**
         * 00 추가
         */
        appendDoubleZero() {
            if (this.mainDisplay.value === "Error") {
                this.clearAll();
                return;
            }

            if (this.calculationComplete) {
                this.mainDisplay.value = "";
                this.subDisplay.innerText = "";
                this.calculationComplete = false;
            }

            if (
                this.isNewInput &&
                !/[\+\-\×\÷]$/.test(this.mainDisplay.value)
            ) {
                this.mainDisplay.value = "";
                this.isAreaConversionMode = false;
                this.subDisplay.innerText = "";
            }
            this.isNewInput = false;

            let currentValue = this.mainDisplay.value.replace(/[,]/g, "");

            // 현재 값이 0이면 00을 추가해도 0으로 표시
            if (currentValue === "0") {
                currentValue = "0";
            } else {
                currentValue += "00";
            }

            this.mainDisplay.value = currentValue;
            this.updateDisplay(currentValue);
            this.currentExpression = currentValue;
        },

        /**
         * 소수점 추가
         */
        appendDecimal() {
            if (this.mainDisplay.value === "Error") {
                this.clearAll();
                return;
            }

            // 이미 계산이 완료된 상태라면 새로운 입력 시작
            if (this.calculationComplete) {
                this.mainDisplay.value = "0";
                this.subDisplay.innerText = "";
                this.calculationComplete = false;
            }

            let currentValue = this.mainDisplay.value.replace(/,/g, ""); // 천 단위 구분자 제거

            // 현재 값이 비어있거나 새 입력이면 0. 추가
            if (currentValue === "" || this.isNewInput) {
                currentValue = "0.";
                this.isNewInput = false;
                this.mainDisplay.value = currentValue;
                this.updateDisplay(currentValue);
                this.currentExpression = currentValue;
                return;
            }

            // 마지막 숫자 부분에 소수점이 이미 있는지 확인
            let parts = currentValue.split(/[\+\-\×\÷]/);
            let lastPart = parts[parts.length - 1];

            // 마지막 부분이 괄호를 포함하면 더 복잡한 처리 필요
            if (lastPart.includes("(") || lastPart.includes(")")) {
                // 괄호 내부의 마지막 숫자 찾기
                let bracketParts = lastPart.split(/[\(\)]/);
                lastPart = bracketParts[bracketParts.length - 1];
            }

            // 마지막 숫자 부분에 소수점이 없으면 추가
            if (!lastPart.includes(".")) {
                // 연산자로 끝나는 경우 "0."을 추가
                if (/[\+\-\×\÷\(]$/.test(currentValue)) {
                    currentValue += "0.";
                } else {
                    currentValue += ".";
                }
            }

            this.isNewInput = false;
            this.mainDisplay.value = currentValue;
            this.updateDisplay(currentValue);
            this.currentExpression = currentValue;
        },

        /**
         * 모든 입력 및 계산 초기화
         */
        clearAll() {
            this.mainDisplay.value = "0";
            this.subDisplay.innerText = "";
            this.isNewInput = true;
            this.isAreaConversionMode = false;
            this.calculationComplete = false;
            this.lastCalculatedValue = null;
            this.mainDisplay.classList.remove("bracket-warning");
            this.mainDisplay.classList.remove("error");
            this.currentExpression = "0";

            // GT 기능을 위한 변수 초기화
            this.grandTotalValue = 0;
            this.calculationResults = [];
            console.log("계산 결과 배열 초기화됨");
        },

        /**
         * 가장 최근 입력 지우기
         */
        clearEntry() {
            let currentValue = this.mainDisplay.value;

            // 에러 상태면 전부 지우기
            if (currentValue === "Error") {
                return this.clearAll();
            }

            // 계산 완료 상태에서 CE를 누르면 완전히 지움
            if (this.calculationComplete) {
                return this.clearAll();
            }

            currentValue = currentValue.slice(0, -1);
            if (currentValue === "" || currentValue === "-") {
                currentValue = "0";
                this.isNewInput = true;
            }
            this.mainDisplay.value = currentValue;
            this.updateDisplay(currentValue);
            this.currentExpression = currentValue;
        },

        /**
         * +/- 부호 전환
         */
        toggleSign() {
            try {
                let currentValue = this.mainDisplay.value.replace(/,/g, ""); // 천 단위 구분자 제거

                // Error 상태이면 처리하지 않음
                if (currentValue === "Error") return;

                // 빈 문자열이면 처리하지 않음
                if (currentValue === "") return;

                // 표현식에서 마지막 숫자의 부호만 변경
                if (this.isExpression(currentValue)) {
                    // 정규식을 사용하여 마지막 숫자 찾기
                    let lastNumMatch = currentValue.match(/(-?\d+\.?\d*)$/);

                    if (lastNumMatch) {
                        let lastNum = lastNumMatch[0];
                        let lastNumIndex = currentValue.lastIndexOf(lastNum);

                        // 숫자가 음수면 양수로, 양수면 음수로 변경
                        let newNum = lastNum.startsWith("-")
                            ? lastNum.substring(1)
                            : "-" + lastNum;

                        // 부호 변경된 숫자로 교체
                        currentValue =
                            currentValue.substring(0, lastNumIndex) + newNum;
                    } else if (/[\+\-\×\÷\(]$/.test(currentValue)) {
                        // 연산자나 여는 괄호로 끝나면 음수 부호 토글
                        if (currentValue.endsWith("-")) {
                            currentValue = currentValue.slice(0, -1);
                        } else {
                            currentValue += "-";
                        }
                    }
                } else {
                    // 단일 숫자인 경우 간단히 부호 전환
                    if (currentValue.startsWith("-")) {
                        currentValue = currentValue.substring(1);
                    } else {
                        currentValue = "-" + currentValue;
                    }
                }

                this.mainDisplay.value = currentValue;
                this.updateDisplay(currentValue);
                this.currentExpression = currentValue;
            } catch (error) {
                console.error("부호 전환 오류:", error);
                this.showError("부호 전환 오류");
            }
        },

        /**
         * 퍼센트 계산
         */
        percentage() {
            try {
                let currentValue = this.mainDisplay.value.replace(/,/g, "");

                // Error 상태이면 처리하지 않음
                if (currentValue === "Error") return;

                // 입력이 비어있으면 처리하지 않음
                if (currentValue === "" || currentValue === "0") return;

                // 계산이 완료된 상태면 바로 퍼센트로 변환 (100분의 1)
                if (this.calculationComplete) {
                    let value = parseFloat(currentValue) / 100;
                    this.updateDisplay(value.toString());
                    this.currentExpression = value.toString();
                    return;
                }

                // 마지막 이진 연산자 위치 찾기 (뒤에서부터 탐색)
                let lastOpIndex = -1;
                let lastOp = "";
                for (let i = currentValue.length - 1; i >= 0; i--) {
                    const ch = currentValue[i];
                    if (/[\+\×\÷]/.test(ch)) {
                        lastOpIndex = i;
                        lastOp = ch;
                        break;
                    }
                    // -가 이진 연산자인 경우: 바로 앞이 숫자 또는 닫는 괄호
                    if (ch === "-" && i > 0 && /[\d\)]/.test(currentValue[i - 1])) {
                        lastOpIndex = i;
                        lastOp = ch;
                        break;
                    }
                }

                if (lastOpIndex > 0) {
                    const leftExpr = currentValue.substring(0, lastOpIndex);
                    const lastNumStr = currentValue.substring(lastOpIndex + 1);
                    const lastNum = parseFloat(lastNumStr);

                    if (!isNaN(lastNum)) {
                        let percentValue;
                        if (lastOp === "+" || lastOp === "-") {
                            // 덧셈/뺄셈: 왼쪽 전체 식 결과값의 퍼센트로 계산
                            try {
                                const baseValue = this.safeEvaluate(leftExpr);
                                percentValue = baseValue * (lastNum / 100);
                            } catch (e) {
                                percentValue = lastNum / 100;
                            }
                        } else {
                            // 곱셈/나눗셈: 단순히 100으로 나눔
                            percentValue = lastNum / 100;
                        }

                        currentValue = leftExpr + lastOp + percentValue.toString();
                        this.mainDisplay.value = currentValue;
                        this.updateDisplay(currentValue);
                        this.currentExpression = currentValue;
                    }
                } else {
                    // 단일 숫자인 경우 100으로 나눔
                    let value = parseFloat(currentValue) / 100;
                    this.updateDisplay(value.toString());
                    this.currentExpression = value.toString();
                }

                this.isNewInput = false;
            } catch (error) {
                console.error("백분율 변환 오류:", error);
                this.showError("백분율 변환 오류");
            }
        },

        /**
         * 연산자 추가
         * @param {string} operator - 추가할 연산자
         */
        operate(operator) {
            let currentValue = this.mainDisplay.value.replace(/,/g, "");

            // Error 상태이면 처리하지 않음
            if (currentValue === "Error") return;

            if (this.calculationComplete) {
                this.calculationComplete = false;
            }

            if (currentValue === "" || currentValue === "0") {
                // + 또는 - 기호로 시작할 수 있도록 허용
                if (operator === "+" || operator === "-") {
                    currentValue = operator;
                    this.mainDisplay.value = currentValue;
                    this.isNewInput = false;
                    this.currentExpression = currentValue;
                    return;
                } else {
                    currentValue = "0";
                }
            }

            // 연산자 기호 변환
            if (operator === "*") {
                operator = "×";
            } else if (operator === "/") {
                operator = "÷";
            }

            // 이미 연산자로 끝나는 경우 교체 (부호인 -는 예외)
            if (/[\+\×\÷]$/.test(currentValue)) {
                currentValue = currentValue.slice(0, -1) + operator;
            } else if (currentValue.endsWith("-") && currentValue.length > 1) {
                const beforeMinus = currentValue.slice(0, -1);
                if (/[\+\-\×\÷]$/.test(beforeMinus)) {
                    // 연산자 뒤에 - 가 붙은 경우 (예: 5×-): 둘 다 제거 후 새 연산자 삽입
                    currentValue = beforeMinus.slice(0, -1) + operator;
                } else {
                    currentValue = currentValue.slice(0, -1) + operator;
                }
            } else {
                currentValue += operator;
            }

            this.mainDisplay.value = currentValue;
            this.isNewInput = false;
            this.calculationComplete = false;
            this.currentExpression = currentValue;
        },

        /**
         * 표현식을 안전하게 계산
         * @param {string} expression - 계산할 표현식
         * @returns {number} - 계산 결과
         */
        safeEvaluate(expression) {
            console.log("계산 시작:", expression);

            // 중위 표현식을 후위 표현식으로 변환 (쉐이딩 야드 알고리즘)
            function infixToPostfix(infix) {
                const precedence = {
                    "+": 1,
                    "-": 1,
                    "*": 2,
                    "/": 2,
                    "%": 2,
                };

                const output = [];
                const operators = [];
                let numBuffer = "";
                let isNegative = false;

                // 표현식 토큰화
                for (let i = 0; i < infix.length; i++) {
                    const char = infix[i];

                    // 숫자 또는 소수점은 버퍼에 추가
                    if (/[\d\.]/.test(char)) {
                        numBuffer += char;
                    }
                    // 연산자 처리
                    else if (/[\+\-\*\/\%]/.test(char)) {
                        // 숫자 버퍼가 있으면 출력에 추가
                        if (numBuffer !== "") {
                            output.push(
                                isNegative
                                    ? -parseFloat(numBuffer)
                                    : parseFloat(numBuffer)
                            );
                            numBuffer = "";
                            isNegative = false;
                        }

                        // 맨 앞이나 연산자 뒤에 오는 음수 부호 처리
                        if (
                            char === "-" &&
                            (i === 0 || /[\+\-\*\/\(]/.test(infix[i - 1]))
                        ) {
                            isNegative = true;
                            continue;
                        }

                        // 연산자 우선순위에 따라 스택 처리
                        while (
                            operators.length > 0 &&
                            operators[operators.length - 1] !== "(" &&
                            precedence[operators[operators.length - 1]] >=
                                precedence[char]
                        ) {
                            output.push(operators.pop());
                        }

                        operators.push(char);
                    }
                    // 괄호 처리
                    else if (char === "(") {
                        operators.push(char);
                    } else if (char === ")") {
                        // 숫자 버퍼가 있으면 출력에 추가
                        if (numBuffer !== "") {
                            output.push(
                                isNegative
                                    ? -parseFloat(numBuffer)
                                    : parseFloat(numBuffer)
                            );
                            numBuffer = "";
                            isNegative = false;
                        }

                        // 여는 괄호를 만날 때까지 연산자를 출력으로 이동
                        while (
                            operators.length > 0 &&
                            operators[operators.length - 1] !== "("
                        ) {
                            output.push(operators.pop());
                        }

                        // 여는 괄호 제거
                        if (
                            operators.length > 0 &&
                            operators[operators.length - 1] === "("
                        ) {
                            operators.pop();
                        }
                    }
                }

                // 남은 숫자 버퍼 처리
                if (numBuffer !== "") {
                    output.push(
                        isNegative
                            ? -parseFloat(numBuffer)
                            : parseFloat(numBuffer)
                    );
                }

                // 남은 연산자 처리
                while (operators.length > 0) {
                    output.push(operators.pop());
                }

                return output;
            }

            // 후위 표현식 계산
            function evaluatePostfix(postfix) {
                const stack = [];

                for (let i = 0; i < postfix.length; i++) {
                    const token = postfix[i];

                    // 숫자는 스택에 푸시
                    if (typeof token === "number") {
                        stack.push(token);
                    }
                    // 연산자는 스택에서 숫자 2개를 꺼내서 계산 후 결과를 스택에 푸시
                    else if (/[\+\-\*\/\%]/.test(token)) {
                        if (stack.length < 2) {
                            throw new Error(
                                "잘못된 표현식: 연산자에 필요한 피연산자가 부족합니다"
                            );
                        }

                        const b = stack.pop();
                        const a = stack.pop();

                        switch (token) {
                            case "+":
                                stack.push(a + b);
                                break;
                            case "-":
                                stack.push(a - b);
                                break;
                            case "*":
                                stack.push(a * b);
                                break;
                            case "/":
                                if (b === 0)
                                    throw new Error("0으로 나눌 수 없습니다");
                                stack.push(a / b);
                                break;
                            case "%":
                                stack.push(a % b);
                                break;
                        }
                    }
                }

                if (stack.length !== 1) {
                    throw new Error("잘못된 표현식: 계산 결과가 여러 개입니다");
                }

                return stack[0];
            }

            // 표현식 준비 (괄호 정리, 연산자 변환 등)
            expression = expression.replace(/×/g, "*").replace(/÷/g, "/");

            // 퍼센트 기호 처리 (문맥 인식: +/- 앞에서는 왼쪽 값의 퍼센트로 계산)
            expression = expression.replace(
                /([+\-]?)(\d+(?:\.\d+)?)%/g,
                function (match, sign, number, offset, str) {
                    const before = str.substring(0, offset);
                    const addSubMatch = before.match(/([+\-])[^+\-]*$/);
                    if (addSubMatch) {
                        const leftExpr = before.substring(0, before.lastIndexOf(addSubMatch[1]));
                        if (leftExpr.length > 0) {
                            return "(" + leftExpr + "*" + number + "/100)";
                        }
                    }
                    return "(" + (sign || "") + number + "/100)";
                }
            );

            // 중위 표현식을 후위 표현식으로 변환 후 계산
            try {
                const postfixExpr = infixToPostfix(expression);
                console.log("후위 표현식:", postfixExpr);
                const result = evaluatePostfix(postfixExpr);
                console.log("계산 결과:", result);
                return result;
            } catch (error) {
                console.error("계산 오류:", error.message);
                throw error;
            }
        },

        /**
         * 표현식 계산 실행
         */
        calculate() {
            try {
                let expression = this.mainDisplay.value.replace(/,/g, "");
                console.log("입력된 식:", expression);

                if (expression === "" || expression === "0") {
                    return;
                }

                // 에러 상태면 처리 안함
                if (expression === "Error") {
                    return;
                }

                // 연산자로 시작하는 경우 (단, + 또는 -는 허용)
                if (/^[\×\÷]/.test(expression)) {
                    this.showError("올바르지 않은 수식");
                    return;
                }

                // 연산자로 끝나는 경우 제거
                if (/[\+\-\×\÷]$/.test(expression)) {
                    expression = expression.slice(0, -1);
                }

                // 괄호 균형 검사 및 자동 보정
                const openCount = (expression.match(/\(/g) || []).length;
                const closeCount = (expression.match(/\)/g) || []).length;

                // 닫는 괄호가 부족하면 자동으로 추가
                if (openCount > closeCount) {
                    const missingCloseBrackets = openCount - closeCount;
                    expression += ")".repeat(missingCloseBrackets);
                    // 사용자에게 알림
                    this.subDisplay.innerText = `닫는 괄호 ${missingCloseBrackets}개가 자동으로 추가되었습니다`;
                }

                // 수식 자동 보정 (곱셈 연산자 삽입)
                expression = this.fixExpressionSyntax(expression);
                console.log("수정된 표현식:", expression);

                // 표현식 계산
                let result;
                try {
                    result = this.safeEvaluate(expression);

                    // 결과가 숫자가 아니면 에러 처리
                    if (
                        typeof result !== "number" ||
                        isNaN(result) ||
                        !isFinite(result)
                    ) {
                        this.showError("계산할 수 없는 값");
                        return;
                    }
                } catch (error) {
                    console.error("계산 오류:", error.message);
                    this.showError(error.message || "계산 오류");
                    return;
                }

                // GT 기능을 위해 계산 결과 저장
                this.calculationResults.push(result);
                console.log("계산 결과 저장:", result);

                // 천 단위 구분자 적용 후 표시 (isResult=true로 설정하여 소수점 자릿수 적용)
                this.updateDisplay(result.toString(), true);
                this.lastCalculatedValue = result; // 마지막 계산 값 저장
                this.isNewInput = true;
                this.calculationComplete = true;
                this.currentExpression = result.toString();
            } catch (error) {
                console.error("계산 오류:", error);
                this.showError("계산 오류");
            }
        },

        /**
         * 수식 문법 자동 수정
         * @param {string} expression - 원본 표현식
         * @returns {string} - 수정된 표현식
         */
        fixExpressionSyntax(expression) {
            // 숫자 뒤에 바로 괄호가 오는 경우 곱셈 연산자 삽입 (5(2) -> 5*(2))
            expression = expression.replace(/(\d+(\.\d+)?)(\()/g, "$1*$3");

            // 괄호 뒤에 바로 숫자가 오는 경우 곱셈 연산자 삽입 ((3)5 -> (3)*5)
            expression = expression.replace(/(\))(\d+(\.\d+)?)/g, "$1*$2");

            // 괄호 다음에 괄호가 오는 경우 곱셈 연산자 삽입 (() -> ()*(
            expression = expression.replace(/(\))(\()/g, "$1*$2");

            return expression;
        },

        /**
         * 반올림 설정 적용 (계산 결과에만 적용)
         * @param {number} value - 원본 값
         * @returns {number} - 반올림 적용된 값
         */
        applyRounding(value) {
            const places = parseInt(this.decimalPlaces.value);
            const method = this.roundingMethod.value;

            if (places === -1 || method === "none") {
                return value;
            }

            const factor = Math.pow(10, places);
            if (method === "round") {
                return Math.round(value * factor) / factor;
            } else if (method === "floor") {
                return Math.floor(value * factor) / factor;
            } else if (method === "ceil") {
                return Math.ceil(value * factor) / factor;
            }

            return value;
        },

        /**
         * 메모리에 현재 값 추가
         */
        memoryAdd() {
            try {
                if (this.mainDisplay.value === "Error") return;

                let currentValue = this.mainDisplay.value.replace(/,/g, "");

                // 수식 포함된 경우 먼저 계산
                if (this.isExpression(currentValue)) {
                    // 임시로 표시 저장
                    const tempDisplay = this.subDisplay.innerText;

                    // 현재 식 계산
                    this.calculate();

                    if (this.mainDisplay.value === "Error") return;

                    // 계산된 값 가져오기
                    currentValue = this.mainDisplay.value.replace(/,/g, "");

                    // 이전 서브 디스플레이 복원 (메모리 정보 유지)
                    if (!tempDisplay.startsWith("M:")) {
                        this.subDisplay.innerText = tempDisplay;
                    }
                }

                const value = parseFloat(currentValue);
                if (!isNaN(value)) {
                    this.memory += value;
                    this.subDisplay.innerText = `M: ${this.formatNumber(
                        this.memory
                    )}`;
                    this.isNewInput = true;
                }
            } catch (error) {
                console.error("메모리 추가 오류:", error);
                this.showError("메모리 추가 오류");
            }
        },

        /**
         * 메모리에서 현재 값 빼기
         */
        memorySub() {
            try {
                if (this.mainDisplay.value === "Error") return;

                let currentValue = this.mainDisplay.value.replace(/,/g, "");

                // 수식 포함된 경우 먼저 계산
                if (this.isExpression(currentValue)) {
                    // 임시로 표시 저장
                    const tempDisplay = this.subDisplay.innerText;

                    // 현재 식 계산
                    this.calculate();

                    if (this.mainDisplay.value === "Error") return;

                    // 계산된 값 가져오기
                    currentValue = this.mainDisplay.value.replace(/,/g, "");

                    // 이전 서브 디스플레이 복원 (메모리 정보 유지)
                    if (!tempDisplay.startsWith("M:")) {
                        this.subDisplay.innerText = tempDisplay;
                    }
                }

                const value = parseFloat(currentValue);
                if (!isNaN(value)) {
                    this.memory -= value;
                    this.subDisplay.innerText = `M: ${this.formatNumber(
                        this.memory
                    )}`;
                    this.isNewInput = true;
                }
            } catch (error) {
                console.error("메모리 빼기 오류:", error);
                this.showError("메모리 빼기 오류");
            }
        },

        /**
         * 메모리 값 불러오기
         */
        memoryRecall() {
            try {
                if (isNaN(this.memory)) {
                    this.memory = 0;
                }
                this.mainDisplay.value = this.memory.toString();
                this.updateDisplay(this.memory.toString()); // 메모리 값을 화면에 표시
                this.subDisplay.innerText = `M: ${this.formatNumber(
                    this.memory
                )}`; // 서브 디스플레이에 메모리 값 표시
                this.isNewInput = true; // 새로운 입력 준비
                this.calculationComplete = false;
                this.currentExpression = this.memory.toString();
            } catch (error) {
                console.error("메모리 호출 오류:", error);
                this.showError("메모리 호출 오류");
            }
        },

        /**
         * 메모리 초기화
         */
        memoryClear() {
            try {
                this.memory = 0; // 메모리를 초기화
                this.subDisplay.innerText = ""; // 서브 디스플레이 초기화
                this.isNewInput = true;
                this.calculationComplete = false;
            } catch (error) {
                console.error("메모리 초기화 오류:", error);
                this.showError("메모리 초기화 오류");
            }
        },

        /**
         * 세금 추가 (세전 금액 -> 세후 금액)
         */
        taxPlus() {
            try {
                if (this.mainDisplay.value === "Error") return;

                let displayValue = this.mainDisplay.value.trim();

                // 수식 포함된 경우 먼저 계산
                if (this.isExpression(displayValue)) {
                    // 현재 식 계산
                    this.calculate();

                    if (this.mainDisplay.value === "Error") return;

                    // 계산된 값 가져오기
                    displayValue = this.mainDisplay.value;
                }

                // 빈 값 또는 잘못된 값이면 오류 방지
                if (!displayValue || isNaN(displayValue.replace(/,/g, ""))) {
                    this.mainDisplay.value = "0";
                    return;
                }

                let value = parseFloat(displayValue.replace(/,/g, "")); // 천 단위 구분 기호 제거 후 숫자로 변환

                if (!isNaN(value)) {
                    let taxAmount = value * (this.taxRate / 100);
                    let result = value + taxAmount;

                    // 반올림 설정 적용
                    result = this.applyRounding(result);
                    taxAmount = this.applyRounding(taxAmount);

                    this.updateDisplay(result.toString(), true); // 천 단위 적용, 계산 결과로 표시
                    this.subDisplay.innerText = `세금: ${this.formatNumber(
                        taxAmount,
                        true
                    )}`; // 천 단위 표시
                    this.lastCalculatedValue = result; // 마지막 계산 값 저장
                    this.isNewInput = true;
                    this.calculationComplete = true;
                    this.currentExpression = result.toString();
                } else {
                    this.showError("유효하지 않은 값");
                }
            } catch (error) {
                console.error("세금 계산 오류:", error);
                this.showError("세금 계산 오류");
            }
        },

        /**
         * 세금 빼기 (세후 금액 -> 세전 금액)
         */
        taxMinus() {
            try {
                if (this.mainDisplay.value === "Error") return;

                let displayValue = this.mainDisplay.value.trim();

                // 수식 포함된 경우 먼저 계산
                if (this.isExpression(displayValue)) {
                    // 현재 식 계산
                    this.calculate();

                    if (this.mainDisplay.value === "Error") return;

                    // 계산된 값 가져오기
                    displayValue = this.mainDisplay.value;
                }

                // 빈 값 또는 잘못된 값이면 오류 방지
                if (!displayValue || isNaN(displayValue.replace(/,/g, ""))) {
                    this.mainDisplay.value = "0";
                    return;
                }

                let value = parseFloat(displayValue.replace(/,/g, "")); // 천 단위 구분 기호 제거 후 숫자로 변환

                if (!isNaN(value)) {
                    // 세금 포함 금액에서 원래 금액 계산
                    const taxRate = this.taxRate / 100;
                    let originalValue = value / (1 + taxRate);
                    let taxAmount = value - originalValue;

                    // 반올림 설정 적용
                    originalValue = this.applyRounding(originalValue);
                    taxAmount = this.applyRounding(taxAmount);

                    this.updateDisplay(originalValue.toString(), true); // 천 단위 적용, 계산 결과로 표시
                    this.subDisplay.innerText = `세금: ${this.formatNumber(
                        taxAmount,
                        true
                    )}`; // 천 단위 표시
                    this.lastCalculatedValue = originalValue; // 마지막 계산 값 저장
                    this.isNewInput = true;
                    this.calculationComplete = true;
                    this.currentExpression = originalValue.toString();
                } else {
                    this.showError("유효하지 않은 값");
                }
            } catch (error) {
                console.error("세금 계산 오류:", error);
                this.showError("세금 계산 오류");
            }
        },

        /**
         * Grand Total 기능 - 모든 계산 결과의 합계
         */
        grandTotal() {
            try {
                if (this.mainDisplay.value === "Error") return;

                console.log("GT 함수 호출됨");
                console.log("저장된 계산 결과들:", this.calculationResults);

                // 계산 결과가 없는 경우 메시지 표시
                if (this.calculationResults.length === 0) {
                    this.subDisplay.innerText =
                        "계산 결과가 없습니다. 계산 후 다시 시도하세요.";
                    return;
                }

                // 모든 계산 결과 합산
                const gtResult = this.calculationResults.reduce(
                    (sum, value) => {
                        console.log("합산 중:", sum, "+", value);
                        return sum + value;
                    },
                    0
                );

                console.log("최종 GT 결과:", gtResult);

                // 반올림 설정 적용
                const formattedTotal = this.applyRounding(gtResult);

                // 계산 결과 표시 (isResult=true로 설정하여 소수점 자릿수 적용)
                this.updateDisplay(formattedTotal.toString(), true);

                // 계산 내역 표시
                const calculationsCount = this.calculationResults.length;
                this.subDisplay.innerText = `총 ${calculationsCount}개 계산 결과의 합계`;

                // 상태 업데이트
                this.lastCalculatedValue = formattedTotal;
                this.isNewInput = true;
                this.calculationComplete = true;
                this.currentExpression = formattedTotal.toString();
            } catch (error) {
                console.error("GT 계산 오류:", error);
                this.showError("GT 계산 오류");
            }
        },

        /**
         * 평방미터 <-> 평 변환
         */
        toggleAreaConversion() {
            try {
                if (this.mainDisplay.value === "Error") return;

                let currentValue = this.mainDisplay.value.replace(/,/g, "");

                // 수식 포함된 경우 먼저 계산
                if (this.isExpression(currentValue)) {
                    // 현재 식 계산
                    this.calculate();

                    if (this.mainDisplay.value === "Error") return;

                    // 계산된 값 가져오기
                    currentValue = this.mainDisplay.value.replace(/,/g, "");
                }

                const value = parseFloat(currentValue);
                if (isNaN(value)) {
                    this.showError("유효하지 않은 값");
                    return;
                }

                this.isAreaConversionMode = !this.isAreaConversionMode;

                if (this.isAreaConversionMode) {
                    // 평방미터 → 평
                    const m2ToPyeong = 0.3025;
                    const pyeong = value * m2ToPyeong;

                    // 반올림 설정 적용
                    const roundedPyeong = this.applyRounding(pyeong);

                    this.subDisplay.innerText = `${this.formatNumber(
                        value,
                        false
                    )} m² = ${this.formatNumber(roundedPyeong, true)} 평`;
                } else {
                    // 평 → 평방미터
                    const pyeongToM2 = 3.3058;
                    const m2 = value * pyeongToM2;

                    // 반올림 설정 적용
                    const roundedM2 = this.applyRounding(m2);

                    this.subDisplay.innerText = `${this.formatNumber(
                        value,
                        false
                    )} 평 = ${this.formatNumber(roundedM2, true)} m²`;
                }

                this.isNewInput = true;
                this.calculationComplete = false;
            } catch (error) {
                console.error("면적 변환 오류:", error);
                this.showError("면적 변환 오류");
            }
        },

        /**
         * 괄호 토글 (열기/닫기)
         */
        toggleBracket() {
            try {
                if (this.mainDisplay.value === "Error") return;

                let currentExpression = this.mainDisplay.value.replace(
                    /,/g,
                    ""
                );
                let openBrackets = (currentExpression.match(/\(/g) || [])
                    .length;
                let closeBrackets = (currentExpression.match(/\)/g) || [])
                    .length;

                // 닫는 괄호 우선 처리 (열린 괄호가 더 많은 경우)
                if (openBrackets > closeBrackets) {
                    // 연산자로 끝나는 경우는 닫는 괄호를 추가하지 않음
                    if (!/[+\-×÷(]$/.test(currentExpression)) {
                        this.append(")");
                    } else {
                        this.subDisplay.innerText =
                            "닫는 괄호를 추가하려면 숫자를 먼저 입력하세요";
                    }
                }
                // 여는 괄호 처리
                else {
                    // 시작이거나 비어있는 경우
                    if (currentExpression === "" || currentExpression === "0") {
                        this.mainDisplay.value = ""; // 초기 0 제거
                        this.append("(");
                    }
                    // 연산자 뒤
                    else if (/[\+\-\×\÷]$/.test(currentExpression)) {
                        this.append("(");
                    }
                    // 숫자 뒤라면 곱셈 기호와 함께 괄호 입력
                    else if (/\d$/.test(currentExpression)) {
                        this.append("×");
                        this.append("(");
                    }
                    // 닫는 괄호 뒤
                    else if (/\)$/.test(currentExpression)) {
                        this.append("×");
                        this.append("(");
                    } else {
                        this.append("(");
                    }
                }

                // 빈 괄호 방지
                if (this.mainDisplay.value.includes("()")) {
                    this.mainDisplay.value = this.mainDisplay.value.replace(
                        /\(\)/g,
                        ""
                    );
                    this.updateDisplay(this.mainDisplay.value);
                    this.currentExpression = this.mainDisplay.value;
                }
            } catch (error) {
                console.error("괄호 토글 오류:", error);
                // 조용히 에러 처리
            }
        },

        /**
         * 키보드 입력 처리
         * @param {KeyboardEvent} event - 키보드 이벤트
         */
        handleKeyPress(event) {
            // 이벤트 처리 중인지 확인 (중복 처리 방지)
            if (event.defaultPrevented) {
                return;
            }

            const key = event.key;
            const ctrlKey = event.ctrlKey || event.metaKey;

            // 브라우저 단축키 보존 (Ctrl + 키)
            if (ctrlKey) {
                return;
            }

            // 텍스트 입력 필드나 드롭다운에 포커스가 있으면 무시
            if (
                (document.activeElement.tagName === "INPUT" &&
                    document.activeElement.type === "text") ||
                document.activeElement.tagName === "SELECT"
            ) {
                return;
            }

            try {
                // 숫자 키
                if (/^[0-9]$/.test(key)) {
                    event.preventDefault();
                    this.append(key);
                }
                // 연산자 키
                else if (key === "+" || key === "-") {
                    event.preventDefault();
                    this.operate(key);
                }
                // 곱셈
                else if (key === "*" || key === "x" || key === "X") {
                    event.preventDefault();
                    this.operate("*");
                }
                // 나눗셈
                else if (key === "/" || key === ":") {
                    event.preventDefault();
                    this.operate("/");
                }
                // 계산
                else if (key === "Enter" || key === "=") {
                    event.preventDefault();
                    this.calculate();
                }
                // 전체 지우기
                else if (key === "Escape") {
                    event.preventDefault();
                    this.clearAll();
                }
                // 소수점
                else if (key === ".") {
                    event.preventDefault();
                    this.appendDecimal();
                }
                // 백스페이스
                else if (key === "Backspace") {
                    event.preventDefault();
                    this.clearEntry();
                }
                // 괄호
                else if (key === "(" || key === ")") {
                    event.preventDefault();
                    this.append(key);
                }
                // 퍼센트
                else if (key === "%") {
                    event.preventDefault();
                    this.percentage();
                }
                // GT (Grand Total)
                else if (
                    key === "t" ||
                    key === "T" ||
                    key === "g" ||
                    key === "G"
                ) {
                    event.preventDefault();
                    this.grandTotal();
                }
            } catch (error) {
                console.error("키 입력 처리 오류:", error);
                // 키 입력 오류는 화면에 표시하지 않음
            }

            // 디버깅을 위한 로그
            console.log(
                `누른 키: ${key}, 현재 화면: ${this.mainDisplay.value}`
            );
        },

        /**
         * 계산기 색상 변경
         * @param {string} color - 색상 코드
         */
        changeCalculatorColor(color) {
            document.querySelector(".calculator").style.backgroundColor = color;
            localStorage.setItem("calculatorColor", color); // 선택한 배경색 저장

            // 라벨 요소들 선택
            const labels = document.querySelectorAll(
                'label[for="decimal-places"], label[for="rounding-method"], label[for="color-select"]'
            );

            // 테마 색상에 따라 라벨 텍스트 색상 변경
            if (color === "#333") {
                // 기본 그레이 테마일 경우 밝은 텍스트 유지
                labels.forEach((label) => {
                    label.style.color = "white"; // 흰색 텍스트
                });
                localStorage.setItem("labelTextColor", "white"); // 흰색 저장
            } else {
                // 다른 테마일 경우 어두운 텍스트로 변경
                labels.forEach((label) => {
                    label.style.color = "#333333"; // 어두운 회색 텍스트
                });
                localStorage.setItem("labelTextColor", "#333333"); // 어두운 회색 저장
            }
        },

        /**
         * 저장된 색상 설정 불러오기
         */
        loadColorPreference() {
            const savedColor = localStorage.getItem("calculatorColor");
            const savedTextColor = localStorage.getItem("labelTextColor");

            if (savedColor) {
                document.querySelector(".calculator").style.backgroundColor =
                    savedColor;
                document.getElementById("color-select").value = savedColor;
            }

            if (savedTextColor) {
                const labels = document.querySelectorAll(
                    'label[for="decimal-places"], label[for="rounding-method"], label[for="color-select"]'
                );
                labels.forEach((label) => {
                    label.style.color = savedTextColor;
                });
            }
        },
    };

    calculator.init();
});
