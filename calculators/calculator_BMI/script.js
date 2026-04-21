/* ══════════════════════════════════════════
   상수 & 설정
   STATES.color 값은 CSS .badge-* / .state-* 색상과 통일
══════════════════════════════════════════ */
const STATES = {
    underweight: {
      label: '저체중',
      color: '#2e80c8',
      desc: '체중이 다소 낮습니다. 균형 잡힌 식단과\n적절한 영양 섭취를 권장합니다.',
    },
    normal: {
      label: '정상',
      color: '#1e9968',
      desc: '건강한 체중 범위입니다! 현재 생활습관을\n꾸준히 유지하는 것이 중요합니다.',
    },
    overweight: {
      label: '과체중',
      color: '#d47000',
      desc: '정상 범위를 약간 초과했습니다. 식이조절과\n규칙적인 운동으로 체중 관리를 시작해 보세요.',
    },
    obese: {
      label: '비만',
      color: '#c93030',
      desc: '건강 위험 수준의 체중입니다. 의료 전문가와\n상담하여 체계적인 관리 계획을 세우세요.',
    },
  };
  
  // 게이지 BMI 표시 범위
  const GAUGE_MIN = 15;
  const GAUGE_MAX = 35;
  
  // 게이지 구간 색상 (파스텔 스카이)
  const SEGMENTS = [
    { from: 15,   to: 18.5, color: '#60aaec' },
    { from: 18.5, to: 23,   color: '#5ecfa0' },
    { from: 23,   to: 25,   color: '#ffac5f' },
    { from: 25,   to: 35,   color: '#ff7b7b' },
  ];
  
  /* ══════════════════════════════════════════
     DOM 참조
  ══════════════════════════════════════════ */
  const heightInput = document.getElementById('height');
  const weightInput = document.getElementById('weight');
  const heightErr   = document.getElementById('height-err');
  const weightErr   = document.getElementById('weight-err');
  const resultCard  = document.getElementById('result-card');
  const idleCard    = document.getElementById('idle-card');
  const bmiValEl    = document.getElementById('bmi-val');
  const statusBadge = document.getElementById('status-badge');
  const badgeDot    = document.getElementById('badge-dot');
  const badgeText   = document.getElementById('badge-text');
  const descText    = document.getElementById('desc-text');
  const canvas      = document.getElementById('gauge');
  const ctx         = canvas.getContext('2d');
  
  /* ══════════════════════════════════════════
     BMI 계산
  ══════════════════════════════════════════ */
  function calcBMI(heightCm, weightKg) {
    const heightM = heightCm / 100;
    return weightKg / (heightM * heightM);
  }
  
  function getState(bmi) {
    if (bmi < 18.5) return 'underweight';
    if (bmi < 23)   return 'normal';
    if (bmi < 25)   return 'overweight';
    return 'obese';
  }
  
  /* ══════════════════════════════════════════
     유효성 검사
  ══════════════════════════════════════════ */
  function validateInput(val, type) {
    if (val === '' || val === null) return { ok: false, msg: '' };
  
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) return { ok: false, msg: '0보다 큰 값을 입력하세요' };
  
    if (type === 'height' && (n < 50 || n > 250))
      return { ok: false, msg: '50 ~ 250 cm 범위로 입력하세요' };
  
    if (type === 'weight' && (n < 10 || n > 400))
      return { ok: false, msg: '10 ~ 400 kg 범위로 입력하세요' };
  
    return { ok: true, val: n };
  }
  
  /* ══════════════════════════════════════════
     게이지 유틸
  ══════════════════════════════════════════ */
  function bmiToAngle(bmi) {
    const clamped = Math.max(GAUGE_MIN, Math.min(GAUGE_MAX, bmi));
    const ratio   = (clamped - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN);
    // 반원: π(왼쪽) ~ 2π(오른쪽)
    return Math.PI + ratio * Math.PI;
  }
  
  function getActiveSegment(pointerAngle) {
    const bmi = GAUGE_MIN + ((pointerAngle - Math.PI) / Math.PI) * (GAUGE_MAX - GAUGE_MIN);
    return SEGMENTS.find(s => bmi >= s.from && bmi < s.to) || SEGMENTS[SEGMENTS.length - 1];
  }
  
  /* ══════════════════════════════════════════
     게이지 그리기 (Canvas 반원형)
  ══════════════════════════════════════════ */
  function drawGauge(pointerAngle) {
    const W      = canvas.width;
    const H      = canvas.height;
    const cx     = W / 2;
    const cy     = H - 10;
    const outerR = W / 2 - 6;
    const innerR = outerR - 28;
  
    ctx.clearRect(0, 0, W, H);
  
    // 트랙 배경 호
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, Math.PI, 2 * Math.PI);
    ctx.arc(cx, cy, innerR, 2 * Math.PI, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = 'rgba(160, 210, 255, 0.18)';
    ctx.fill();
  
    // 색상 구간 그리기
    SEGMENTS.forEach(seg => {
      const a1 = bmiToAngle(seg.from);
      const a2 = bmiToAngle(seg.to);
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, a1, a2);
      ctx.arc(cx, cy, innerR, a2, a1, true);
      ctx.closePath();
      ctx.fillStyle   = seg.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  
    // 구간 구분선
    [18.5, 23, 25].forEach(bmi => {
      const a  = bmiToAngle(bmi);
      const x1 = cx + innerR * Math.cos(a);
      const y1 = cy + innerR * Math.sin(a);
      const x2 = cx + outerR * Math.cos(a);
      const y2 = cy + outerR * Math.sin(a);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = 'rgba(220, 240, 255, 0.95)';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    });
  
    // 포인터 핀
    if (pointerAngle !== null) {
      const px = cx + (innerR + 14) * Math.cos(pointerAngle);
      const py = cy + (innerR + 14) * Math.sin(pointerAngle);
  
      // 외부 흰 원 (그림자 포함)
      ctx.shadowColor = 'rgba(80, 140, 200, 0.35)';
      ctx.shadowBlur  = 8;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.shadowBlur = 0;
  
      // 내부 상태 색 원
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.fillStyle = getActiveSegment(pointerAngle).color;
      ctx.fill();
    }
  }
  
  /* ══════════════════════════════════════════
     애니메이션
  ══════════════════════════════════════════ */
  let animFrame    = null;
  let currentAngle = null;
  
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }
  
  function animatePointer(targetAngle) {
    if (animFrame) cancelAnimationFrame(animFrame);
    if (currentAngle === null) currentAngle = Math.PI; // 시작 위치: 왼쪽 끝
  
    const start    = currentAngle;
    const diff     = targetAngle - start;
    const duration = 700; // ms
    let startTime  = null;
  
    function step(ts) {
      if (!startTime) startTime = ts;
      const t     = Math.min((ts - startTime) / duration, 1);
      const angle = start + diff * easeOutCubic(t);
      drawGauge(angle);
      if (t < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        currentAngle = targetAngle;
      }
    }
    animFrame = requestAnimationFrame(step);
  }
  
  let countAnim = null;
  
  function animateCount(targetBMI) {
    if (countAnim) cancelAnimationFrame(countAnim);
  
    const startVal = parseFloat(bmiValEl.textContent) || 0;
    const duration = 600;
    let startTime  = null;
  
    function step(ts) {
      if (!startTime) startTime = ts;
      const t   = Math.min((ts - startTime) / duration, 1);
      const val = startVal + (targetBMI - startVal) * easeOutCubic(t);
      bmiValEl.textContent = val.toFixed(2);
      if (t < 1) {
        countAnim = requestAnimationFrame(step);
      } else {
        bmiValEl.textContent = targetBMI.toFixed(2);
      }
    }
    countAnim = requestAnimationFrame(step);
  }
  
  /* ══════════════════════════════════════════
     UI 업데이트
  ══════════════════════════════════════════ */
  function updateResult(bmi, state) {
    const info = STATES[state];
  
    // BMI 숫자 카운트업
    animateCount(bmi);
  
    // 색상 클래스
    bmiValEl.className = `bmi-val state-${state}`;
  
    // 배지
    statusBadge.className    = `status-badge badge-${state}`;
    badgeDot.style.background = info.color;
    badgeText.textContent    = info.label;
  
    // 설명 (white-space: pre-line 으로 \n 줄바꿈 적용)
    descText.textContent = info.desc;
  
    // 범례 활성화
    document.querySelectorAll('.legend-item').forEach(el => {
      el.classList.toggle('active', el.dataset.state === state);
    });
  
    // 게이지 포인터 이동
    animatePointer(bmiToAngle(bmi));
  }
  
  function showResult() {
    resultCard.classList.remove('hidden');
    resultCard.classList.add('visible');
    idleCard.style.display = 'none';
  }
  
  function hideResult() {
    resultCard.classList.add('hidden');
    resultCard.classList.remove('visible');
    idleCard.style.display = '';
    currentAngle = null;
  }
  
  /* ══════════════════════════════════════════
     입력 이벤트 (자동 계산)
  ══════════════════════════════════════════ */
  function onInput() {
    const hv = validateInput(heightInput.value, 'height');
    const wv = validateInput(weightInput.value, 'weight');
  
    // 에러 메시지 표시
    heightErr.textContent = hv.msg || '';
    weightErr.textContent = wv.msg || '';
    heightInput.classList.toggle('error', heightInput.value !== '' && !hv.ok);
    weightInput.classList.toggle('error', weightInput.value !== '' && !wv.ok);
  
    if (hv.ok && wv.ok) {
      const bmi   = calcBMI(hv.val, wv.val);
      const state = getState(bmi);
      showResult();
      updateResult(bmi, state);
    } else {
      hideResult();
    }
  }
  
  heightInput.addEventListener('input', onInput);
  weightInput.addEventListener('input', onInput);
  
  /* ══════════════════════════════════════════
     초기화
  ══════════════════════════════════════════ */
  drawGauge(null);