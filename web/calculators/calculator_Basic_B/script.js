document.addEventListener('DOMContentLoaded', () => {
    const calculator = {
        mainDisplay: document.getElementById('main-display'),
        subDisplay: document.getElementById('sub-display'),
        decimalPlaces: document.getElementById('decimal-places'),
        roundingMethod: document.getElementById('rounding-method'),
        memory: 0,
        isNewInput: true,
        calculationComplete: false,

        init() {
            this.bindEvents();
            this.mainDisplay.value = '0';
            this.taxRate = 10; // 기본 세율 10%
            this.loadColorPreference();
        },

        bindEvents() {
            document.querySelector('.buttons').addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') {
                    const action = e.target.dataset.action;
                    const value = e.target.dataset.value;
                    console.log("버튼 클릭:", action, value); // 디버깅
                    if (action && this[action]) {
                        this[action](value);
                    } else {
                        console.error("정의되지 않은 액션:", action);
                    }
                }
            });
            
            // 키보드 이벤트 바인딩 추가
            document.addEventListener('keydown', (e) => this.handleKeyPress(e));
            
            // 라운딩 설정 이벤트 (계산 결과 표시 중이면 새 설정으로 재포맷)
            this.decimalPlaces.addEventListener('change', () => {
                if (this.calculationComplete) {
                    const val = parseFloat(this.mainDisplay.value.replace(/,/g, ''));
                    if (!isNaN(val)) this.updateDisplay(this.formatNumber(val, true));
                }
                this.mainDisplay.focus();
            });

            this.roundingMethod.addEventListener('change', () => {
                if (this.calculationComplete) {
                    const val = parseFloat(this.mainDisplay.value.replace(/,/g, ''));
                    if (!isNaN(val)) this.updateDisplay(this.formatNumber(val, true));
                }
                this.mainDisplay.focus();
            });

            // 🔽 색상 변경 이벤트 추가
            document.getElementById('color-select').addEventListener('change', (e) => {
                this.changeCalculatorColor(e.target.value);
            });

        }, // 쉼표 추가
        
        updateDisplay(value = this.mainDisplay.value) {
            if (!value || value.length <= 1) {
                this.mainDisplay.value = value;
                return;
            }
        
            try {
                // 소수점으로 끝나는 경우 처리
                const endsWithDecimal = value.endsWith('.');
                // 콤마와 공백 제거
                const cleanValue = value.replace(/[,\s]/g, '');
        
                // 숫자와 연산자만 포함된 경우 (계산식인 경우)
                if (/^[0-9\.\+\-\×\÷]*$/.test(cleanValue)) {
                    // 계산식을 분해하여 각 숫자만 포맷팅
                    const formattedExpr = this.formatExpression(cleanValue);
                    this.mainDisplay.value = formattedExpr + (endsWithDecimal ? '.' : '');
                } else {
                    // 단순히 그대로 표시
                    this.mainDisplay.value = this.formatNumber(parseFloat(value));
                }
            } catch (error) {
                console.error("표시 오류:", error);
                this.mainDisplay.value = value; // 오류 시 원래 입력 유지
            }
        },


        // 표현식의 숫자 부분만 포맷팅하는 새 메서드
        formatExpression(expr) {
            // 숫자와 연산자로 분리
            const parts = expr.split(/([\+\-\×\÷])/);
            
            return parts.map(part => {
                // 연산자는 그대로 반환
                if (/^[\+\-\×\÷]$/.test(part)) {
                    return part;
                }
                // 숫자는 포맷팅
                if (part && !isNaN(parseFloat(part))) {
                    return this.formatNumber(parseFloat(part));
                }
                // 그 외에는 그대로
                return part;
            }).join('');
        }, // 쉼표 추가

        // isResult=true일 때만 소수점 자릿수 설정 적용 (입력 중에는 적용 안 함)
        formatNumber(num, isResult = false) {
            let places = isResult ? parseInt(this.decimalPlaces.value) : -1;
            const method = this.roundingMethod.value;

            // 입력된 값을 그대로 유지 (천 단위 구분자가 포함될 수 있음)
            let originalNum = num.toString().replace(/,/g, ""); // 천 단위 구분자 제거

            // 숫자로 변환 (NaN 방지)
            let parsedNum = parseFloat(originalNum);
            if (isNaN(parsedNum)) return originalNum;

            // 반올림, 올림, 버림 적용 (결과값이고 자릿수 설정이 있는 경우만)
            if (isResult && places !== -1 && !isNaN(places)) {
                const factor = Math.pow(10, places);
                if (method === "round") {
                    parsedNum = Math.round(parsedNum * factor) / factor;
                } else if (method === "floor") {
                    parsedNum = Math.floor(parsedNum * factor) / factor;
                } else if (method === "ceil") {
                    parsedNum = Math.ceil(parsedNum * factor) / factor;
                }
            }

            // 정수부 및 소수부 분리
            let numStr = parsedNum.toString();
            let [intPart, fracPart] = numStr.split('.');

            // 천 단위 구분자 추가
            intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

            // 소수부 처리
            if (originalNum.includes(".") || fracPart !== undefined) {
                if (places === 0) {
                    return intPart; // 소수점 자릿수가 0이면 정수부만 반환
                } else if (places === -1) { // 입력 모드 또는 '전체': 원래 입력값 유지
                    return fracPart !== undefined ? `${intPart}.${fracPart}` : `${intPart}.`;
                } else if (fracPart !== undefined) {
                    // 소수점 자릿수에 맞게 조정 (부족하면 0으로 채움)
                    fracPart = fracPart.length > places
                        ? fracPart.slice(0, places)
                        : fracPart.padEnd(places, '0');
                    return `${intPart}.${fracPart}`;
                } else {
                    // 소수 자릿수가 설정되어 있으면 0으로 채움
                    return places > 0 ? `${intPart}.${'0'.repeat(places)}` : intPart;
                }
            } else {
                // 결과값이고 소수점 자릿수가 설정된 경우 0으로 채움
                if (isResult && places > 0) {
                    return `${intPart}.${'0'.repeat(places)}`;
                }
                return intPart; // 정수만 입력된 경우
            }
        },

        append(value) {
            // 현재 디스플레이 값 가져오기 (콤마 제거)
            let currentValue = this.mainDisplay.value.replace(/,/g, '');
        
            // 방금 계산을 완료했다면 새로 시작
            if (this.calculationComplete) {
                currentValue = '';
                this.subDisplay.innerText = ''; // 서브 디스플레이 초기화
                this.calculationComplete = false;
            }
        
            // 새로운 입력이 시작될 때, 괄호 입력을 허용하도록 수정
            if (this.isNewInput && !/[\+\-\×\÷(]$/.test(currentValue)) {
                currentValue = '';
                this.subDisplay.innerText = ''; // 서브 디스플레이 초기화
            }
            this.isNewInput = false;
        
            // 현재 값이 0이면 괄호 입력 시 자동 삭제
            if (currentValue === '0' && value !== '.' && value !== '(') {
                currentValue = value;
            } 
            // 괄호 입력이 제한되지 않도록 수정
            else if (value === '(' || value === ')' || currentValue.length < 15) {
                currentValue += value;
            }
        
            // 콘솔에 현재 입력 상태 기록 (디버깅용)
            console.log("입력값:", value, "현재값:", currentValue);
        
            // 입력 값을 화면에 표시
            this.mainDisplay.value = currentValue;
            this.updateDisplay(currentValue);
        },


        appendDoubleZero() {
            if (this.isNewInput && !/[\+\-\×\÷]$/.test(this.mainDisplay.value)) {
                this.mainDisplay.value = '';
                this.isAreaConversionMode = false;
                this.subDisplay.innerText = '';
            }
            this.isNewInput = false;
            let currentValue = this.mainDisplay.value.replace(/[,]/g, '');
            // 조건 제거하여 언제나 '00' 추가
            currentValue += '00';
            this.updateDisplay(currentValue);
        },

        appendDecimal() {
            // 이미 계산이 완료된 상태라면 새로운 입력 시작
            if (this.calculationComplete) {
                this.mainDisplay.value = '0';
                this.subDisplay.innerText = '';
                this.calculationComplete = false;
            }

            let currentValue = this.mainDisplay.value.replace(/,/g, ''); // 천 단위 구분자 제거

            // 연산자로 끝나는 경우 "0."을 추가
            if (/[\+\-\×\÷]$/.test(currentValue)) {
                currentValue += '0.';
            } else {
                // 마지막 피연산자에만 소수점 중복 여부 확인 (수식 전체 검사 금지)
                const parts = currentValue.split(/[\+\-\×\÷]/);
                const lastPart = parts[parts.length - 1];
                if (!lastPart.includes('.')) {
                    if (currentValue === '' || this.isNewInput) {
                        currentValue = '0.';
                    } else {
                        currentValue += '.';
                    }
                }
            }

            this.isNewInput = false;

            // updateDisplay를 사용해 수식 전체를 올바르게 포맷
            this.mainDisplay.value = currentValue;
            this.updateDisplay(currentValue);
        },

        clearAll() {
            this.mainDisplay.value = '0';
            this.subDisplay.innerText = '';
            this.isNewInput = true;
            this.isAreaConversionMode = false;
            this.calculationComplete = false;
        },

        
        clearEntry() {
            let currentValue = this.mainDisplay.value;
            currentValue = currentValue.slice(0, -1);
            if (currentValue === '' || currentValue === '-') {
                currentValue = '0';
                this.isNewInput = true;
            }
            this.mainDisplay.value = currentValue;
            this.updateDisplay(currentValue);
        },

        toggleSign() {
            try {
                let currentValue = this.mainDisplay.value.replace(/,/g, ''); // 천 단위 구분자 제거
                let number = parseFloat(currentValue);
                if (!isNaN(number)) {
                    number = -number;
                    this.updateDisplay(number.toString()); // updateDisplay 메서드를 사용하여 천 단위 구분자 적용
                }
            } catch (error) {
                this.mainDisplay.value = 'Error';
            }
        },

        percentage() {
            try {
                let currentValue = this.mainDisplay.value;
                let number = parseFloat(currentValue);
                if (!isNaN(number)) {
                    number = number / 100;
                    this.mainDisplay.value = number.toString();
                    this.updateDisplay(number.toString());
                    this.isNewInput = true; // 새로운 입력 준비
                    this.calculationComplete = true;
                }
            } catch (error) {
                this.mainDisplay.value = 'Error';
            }
        },


        operate(operator) {
            let currentValue = this.mainDisplay.value;
            
            if (this.calculationComplete) {
                currentValue = this.mainDisplay.value;
                this.calculationComplete = false;
            }

            if (currentValue === '0' || currentValue === '') {
                currentValue = '0';
            }

            if (operator === '*') {
                operator = '×';
            } else if (operator === '/') {
                operator = '÷';
            }

            if (/[\+\-\×\÷]$/.test(currentValue)) {
                currentValue = currentValue.slice(0, -1) + operator;
            } else {
                currentValue += operator;
            }

            this.mainDisplay.value = currentValue;
            this.isNewInput = true;
            this.calculationComplete = false;
        },

        calculate() {
            try {
                let expression = this.mainDisplay.value;
        
                if (expression === '') {
                    return;
                }
                
                // 연사자로 끝나는 경우 제거
                if (/[\+\-\×\÷]$/.test(expression)) {
                    expression = expression.slice(0, -1);
                }
                
                // 수식이 연산자로 시작하면 " Error" 표시
                if (/^[\+\×\÷]/.test(expression)) {
                    this.mainDisplay.value = 'Error';
                    return;
                }
                
                // 괄호 균형 검사
                const openCount = (expression.match(/\(/g) || []).length;
                const closeCount = (expression.match(/\)/g) || []).length;
                
                if (openCount !== closeCount) {
                    this.mainDisplay.value = 'Error';
                    return;
                }

                // 연산자 변환
                expression = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '');
                
                 // eval 대신 안전한 Function 생성자 사용
                let result = new Function(`return (${expression})`)(); 
                
                
                if (isNaN(result) || !isFinite(result)) {
                    this.mainDisplay.value = 'Error';
                    return;
                }
        
                // 소수점 자릿수와 반올림 방식에 따라 결과 처리
                const places = parseInt(this.decimalPlaces.value);
                const method = this.roundingMethod.value;
        
                if (method === "round") {
                    result = Math.round(result * Math.pow(10, places)) / Math.pow(10, places);
                } else if (method === "floor") {
                    result = Math.floor(result * Math.pow(10, places)) / Math.pow(10, places);
                } else if (method === "ceil") {
                    result = Math.ceil(result * Math.pow(10, places)) / Math.pow(10, places);
                }
                
                // 천 단위 구분자 적용 후 표시 (isResult=true: 소수점 자릿수 설정 적용)
                this.updateDisplay(this.formatNumber(result, true));
                this.isNewInput = true;
                this.calculationComplete = true;
        
            } catch (error) {
                console.error("계산 오류:", error);
                this.mainDisplay.value = 'Error';
            }
        },

        memoryAdd() {
            try {
                let expression = this.mainDisplay.value;

                if (/[\+\-\×\÷]/.test(expression)) {
                    expression = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '');
                    let value = Function('"use strict";return (' + expression + ')')();

                    if (!isNaN(value) && isFinite(value)) {
                        this.memory += value;
                        this.updateDisplay(this.formatNumber(value, true)); // memorySub와 일관성 유지
                        this.subDisplay.innerText = `M: ${this.formatNumber(this.memory, true)}`;
                        this.isNewInput = true;
                        this.calculationComplete = true;
                    } else {
                        this.mainDisplay.value = 'Error';
                    }
                } else {
                    let value = parseFloat(this.mainDisplay.value.replace(/,/g, ''));
                    if (!isNaN(value)) {
                        this.memory += value;
                        this.subDisplay.innerText = `M: ${this.formatNumber(this.memory, true)}`;
                        this.isNewInput = true;
                        this.calculationComplete = false;
                    }
                }
            } catch (error) {
                console.error("메모리 추가 오류:", error);
                this.mainDisplay.value = 'Error';
            }
        },

        memorySub() {
            try {
                let expression = this.mainDisplay.value;
        
                // 수식이 포함되어 있는 경우 계산 수행
                if (/[\+\-\×\÷]/.test(expression)) {
                    expression = expression.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, ''); 
                    let value = Function('"use strict";return (' + expression + ')')();
        
                    if (!isNaN(value) && isFinite(value)) {
                        this.memory -= value; // 계산 결과를 메모리에서 빼기
                        this.updateDisplay(this.formatNumber(value, true)); // 화면에 계산 결과 표시
                        // 서브 디스플레이에 메모리 상태 표시
                        this.subDisplay.innerText = `M: ${this.formatNumber(this.memory, true)}`;
                        this.isNewInput = true; // 새로운 입력 준비
                        this.calculationComplete = true;
                    } else {
                        this.mainDisplay.value = 'Error';
                    }
                } else {
                    // 이미 계산된 값이 있는 경우 바로 메모리에서 빼기
                    let value = parseFloat(this.mainDisplay.value.replace(/,/g, ''));
                    if (!isNaN(value)) {
                        this.memory -= value;
                        this.subDisplay.innerText = `M: ${this.formatNumber(this.memory, true)}`;
                        this.isNewInput = true;
                        this.calculationComplete = false;
                    } else {
                        this.mainDisplay.value = 'Error'; // 숫자가 아닌 경우 표시
                    }
                }
            } catch (error) {
                console.error("메모리 빼기 오류:", error);
                this.mainDisplay.value = 'Error';
            }
        },

        memoryRecall() {
            try {
                if (!isNaN(this.memory)) {
                    this.updateDisplay(this.memory.toString()); // 메모리 값을 화면에 표시
                    this.subDisplay.innerText = `M: ${this.formatNumber(this.memory)}`; // 서브 디스플레이에 메모리 값 표시
                    this.isNewInput = true; // 새로운 입력 준비
                    this.calculationComplete = false;
                }
            } catch (error) {
                this.mainDisplay.value = 'Error';
            }
        },

        memoryClear() {
            try {
                this.memory = 0; // 메모리를 초기화
                this.subDisplay.innerText = ''; // 서브 디스플레이 초기화
                this.isNewInput = true;
                this.calculationComplete = false;
            } catch (error) {
                this.mainDisplay.value = 'Error';
            }
        },

        taxPlus() {
            try {
                let displayValue = this.mainDisplay?.value?.trim();

                // 빈 값 또는 잘못된 값이면 오류 방지
                if (!displayValue || isNaN(displayValue.replace(/,/g, ''))) {
                    this.mainDisplay.value = '0';
                    return;
                }

                let value = parseFloat(displayValue.replace(/,/g, ''));

                if (!isNaN(value)) {
                    let taxAmount = value * (this.taxRate / 100);
                    let result = value + taxAmount;

                    this.updateDisplay(this.formatNumber(result, true));
                    this.subDisplay.innerText = `세금: ${this.formatNumber(taxAmount, true)}`;
                    this.isNewInput = true;
                    this.calculationComplete = true;
                } else {
                    this.mainDisplay.value = 'Error';
                }
            } catch (error) {
                console.error("세금 계산 오류:", error);
                this.mainDisplay.value = 'Error';
            }
        },
        
        taxMinus() {
            try {
                let displayValue = this.mainDisplay?.value?.trim();

                // 빈 값 또는 잘못된 값이면 오류 방지
                if (!displayValue || isNaN(displayValue.replace(/,/g, ''))) {
                    this.mainDisplay.value = '0';
                    return;
                }

                let value = parseFloat(displayValue.replace(/,/g, ''));

                if (!isNaN(value)) {
                    // 세금 포함 금액에서 원래 금액 계산
                    let originalValue = value / (1 + this.taxRate / 100);
                    let taxAmount = value - originalValue;

                    this.updateDisplay(this.formatNumber(originalValue, true));
                    this.subDisplay.innerText = `세금: ${this.formatNumber(taxAmount, true)}`;
                    this.isNewInput = true;
                    this.calculationComplete = true;
                } else {
                    this.mainDisplay.value = 'Error';
                }
            } catch (error) {
                console.error("세금 계산 오류:", error);
                this.mainDisplay.value = 'Error';
            }
        },
        
        // 새로운 숫자 입력 시 세금 부분 초기화
        handleNewInput() {
            this.subDisplay.innerText = ''; // 세금 부분 초기화
        },
        
        
        

        squareRoot() {
            try {
                let value = parseFloat(this.mainDisplay.value);
                if (!isNaN(value) && value >= 0) {
                    let result = Math.sqrt(value);
                    this.updateDisplay(result.toString());
                    this.isNewInput = true;
                    this.calculationComplete = false;
                } else {
                    this.mainDisplay.value = 'Error';
                }
            } catch (error) {
                this.mainDisplay.value = 'Error';
            }
        },
        

        toggleAreaConversion() {
            this.isAreaConversionMode = !this.isAreaConversionMode;
            if (this.isAreaConversionMode) {
                this.convertArea(parseFloat(this.mainDisplay.value.replace(/[,]/g, '')) || 0);
            } else {
                this.subDisplay.innerText = '';
            }
            this.isNewInput = true;
            this.calculationComplete = false;
        },
        

        convertArea(value) {
            const m2ToPyeong = 0.3025;
            const pyeong = Math.floor(value * m2ToPyeong * 100) / 100; // 소수점 2자리까지 버림
            this.subDisplay.innerText = `${this.formatNumber(value)} m² = ${this.formatNumber(pyeong)} 평`; // 천 단위 구분 적용
        },
        
        toggleBracket() {
            let currentExpression = this.mainDisplay.value;
            let openBrackets = (currentExpression.match(/\(/g) || []).length;
            let closeBrackets = (currentExpression.match(/\)/g) || []).length;
        
            if (openBrackets > closeBrackets) {
                // 닫는 괄호 추가 (올바른 위치 확인)
                if (!/[+\-×÷(]$/.test(currentExpression)) {
                    this.append(')'); // 올바른 위치에서만 추가
                }
            } else {
                // 연산의 시작이면 괄호만 입력
                if (currentExpression === '' || currentExpression === '0') {
                    this.mainDisplay.value = ''; // 초기 0 제거
                    this.append('(');
                } 
                // 연산자 뒤라면 그냥 괄호 입력
                else if (/[\+\-\×\÷]$/.test(currentExpression)) {
                    this.append('(');
                } 
                // 숫자 뒤라면 × 없이 괄호 입력 허용
                else {
                    this.append('(');
                }
            }
        
            // NaN 방지를 위해 수식 검사 (잘못된 괄호 처리 방지)
            if (this.mainDisplay.value.includes('()')) {
                this.mainDisplay.value = this.mainDisplay.value.replace(/\(\)/g, ''); // 빈 괄호 제거
            }
        },

        handleKeyPress(event) {
            const key = event.key;

            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') {
                return;
            }

            if (/[0-9]/.test(key)) {
                this.append(key);
            } else if (key === '+' || key === '-') {
                this.operate(key);
            } else if (key === '*') {
                event.preventDefault();
                this.operate('×');
            } else if (key === '/') {
                event.preventDefault();
                this.operate('÷');
            } else if (key === 'Enter') {
                event.preventDefault();
                this.calculate();
            } else if (key === 'Escape') {
                this.clearAll();
            } else if (key === '.') {
                this.appendDecimal();
            } else if (key === 'Backspace') {
                this.clearEntry();
            } else if (['(', ')', '[', ']', '{', '}'].includes(key)) {
                this.append(key);
            }
        },

        // 🔽 새로운 메서드 추가
        changeCalculatorColor(color) {
            document.querySelector('.calculator').style.backgroundColor = color;
            localStorage.setItem('calculatorColor', color); // 선택한 배경색 저장
        
            // 라벨 요소들 선택
            const labels = document.querySelectorAll('label[for="decimal-places"], label[for="rounding-method"], label[for="color-select"]');
        
            // 테마 색상에 따라 라벨 텍스트 색상 변경
            if (color === '#333') {
                // 기본 그레이 테마일 경우 밝은 텍스트 유지
                labels.forEach(label => {
                    label.style.color = 'white'; // 흰색 텍스트
                });
                localStorage.setItem('labelTextColor', 'white'); // 흰색 저장
            } else {
                // 다른 테마일 경우 어두운 텍스트로 변경
                labels.forEach(label => {
                    label.style.color = '#333333'; // 어두운 회색 텍스트
                });
                localStorage.setItem('labelTextColor', '#333333'); // 어두운 회색 저장
            }
        },
        
        loadColorPreference() {
            const savedColor = localStorage.getItem('calculatorColor');
            const savedTextColor = localStorage.getItem('labelTextColor');
        
            if (savedColor) {
                document.querySelector('.calculator').style.backgroundColor = savedColor;
                document.getElementById('color-select').value = savedColor;
            }
        
            if (savedTextColor) {
                // 저장된 텍스트 색상이 있을 경우 적용
                const labels = document.querySelectorAll('label[for="decimal-places"], label[for="rounding-method"], label[for="color-select"]');
                labels.forEach(label => {
                    label.style.color = savedTextColor;
                });
            }
        },


    };

    calculator.init();
});