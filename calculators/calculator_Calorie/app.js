/**
 * app.js
 * 칼로리 & 다이어트 계산기
 * ─────────────────────────────────────────
 * 구조
 *  1. FoodDB      – 음식 데이터베이스 (60종)
 *  2. AppState    – 전역 상태 객체 (확장 가능)
 *  3. Calc        – 순수 계산 함수 모음
 *  4. Validate    – 입력값 유효성 검사
 *  5. MealUI      – 식단 기록 UI 로직
 *  6. UI          – 결과 카드 / 차트 렌더링
 *  7. compute()   – 계산 파이프라인
 *  8. bindEvents()– 이벤트 바인딩
 *  9. init()      – 초기화
 */

/* ================================================================
   1. 음식 데이터베이스
   구조: { name, kcal(1인분 기준), emoji, cat(카테고리) }
================================================================ */
const FoodDB = [
    /* ── 밥류 ── */
    { name: '흰밥',            kcal: 312, emoji: '🍚', cat: '밥류' },
    { name: '현미밥',          kcal: 295, emoji: '🍚', cat: '밥류' },
    { name: '잡곡밥',          kcal: 300, emoji: '🍚', cat: '밥류' },
    { name: '비빔밥',          kcal: 560, emoji: '🥗', cat: '밥류' },
    { name: '볶음밥',          kcal: 480, emoji: '🍳', cat: '밥류' },
    { name: '김밥 (1줄)',      kcal: 330, emoji: '🌀', cat: '밥류' },
    { name: '오므라이스',      kcal: 520, emoji: '🍳', cat: '밥류' },
    { name: '덮밥 (불고기)',   kcal: 590, emoji: '🍚', cat: '밥류' },
  
    /* ── 국·찌개 ── */
    { name: '된장찌개',        kcal: 100, emoji: '🍲', cat: '국·찌개' },
    { name: '김치찌개',        kcal: 120, emoji: '🍲', cat: '국·찌개' },
    { name: '순두부찌개',      kcal: 130, emoji: '🍲', cat: '국·찌개' },
    { name: '미역국',          kcal:  50, emoji: '🥣', cat: '국·찌개' },
    { name: '설렁탕',          kcal: 300, emoji: '🍜', cat: '국·찌개' },
    { name: '해장국',          kcal: 350, emoji: '🍜', cat: '국·찌개' },
    { name: '부대찌개',        kcal: 480, emoji: '🍲', cat: '국·찌개' },
  
    /* ── 메인 요리 ── */
    { name: '삼겹살 (200g)',   kcal: 620, emoji: '🥩', cat: '메인' },
    { name: '불고기 (200g)',   kcal: 380, emoji: '🥩', cat: '메인' },
    { name: '닭가슴살 (150g)',kcal: 165, emoji: '🍗', cat: '메인' },
    { name: '닭볶음탕',        kcal: 450, emoji: '🍗', cat: '메인' },
    { name: '제육볶음',        kcal: 420, emoji: '🥩', cat: '메인' },
    { name: '계란후라이 (2개)',kcal: 180, emoji: '🍳', cat: '메인' },
    { name: '두부조림',        kcal: 200, emoji: '🟡', cat: '메인' },
    { name: '생선구이 (고등어)',kcal:280, emoji: '🐟', cat: '메인' },
    { name: '갈비찜',          kcal: 550, emoji: '🥩', cat: '메인' },
    { name: '삼치구이',        kcal: 230, emoji: '🐟', cat: '메인' },
  
    /* ── 면·분식 ── */
    { name: '라면 (1봉)',      kcal: 500, emoji: '🍜', cat: '면·분식' },
    { name: '냉면',            kcal: 450, emoji: '🍜', cat: '면·분식' },
    { name: '자장면',          kcal: 680, emoji: '🍜', cat: '면·분식' },
    { name: '짬뽕',            kcal: 620, emoji: '🍜', cat: '면·분식' },
    { name: '순대 (1인분)',    kcal: 300, emoji: '🌭', cat: '면·분식' },
    { name: '떡볶이',          kcal: 380, emoji: '🍢', cat: '면·분식' },
    { name: '튀김 (5개)',      kcal: 350, emoji: '🍤', cat: '면·분식' },
    { name: '라볶이',          kcal: 550, emoji: '🍜', cat: '면·분식' },
    { name: '칼국수',          kcal: 440, emoji: '🍜', cat: '면·분식' },
  
    /* ── 양식 ── */
    { name: '파스타 (크림)',   kcal: 650, emoji: '🍝', cat: '양식' },
    { name: '파스타 (토마토)', kcal: 480, emoji: '🍝', cat: '양식' },
    { name: '피자 (2조각)',    kcal: 560, emoji: '🍕', cat: '양식' },
    { name: '햄버거',          kcal: 540, emoji: '🍔', cat: '양식' },
    { name: '샌드위치',        kcal: 380, emoji: '🥪', cat: '양식' },
    { name: '스테이크 (200g)', kcal: 420, emoji: '🥩', cat: '양식' },
    { name: '샐러드 (시저)',   kcal: 280, emoji: '🥗', cat: '양식' },
    { name: '감자튀김 (M)',    kcal: 340, emoji: '🍟', cat: '양식' },
  
    /* ── 간식·음료 ── */
    { name: '아메리카노',      kcal:   5, emoji: '☕', cat: '간식·음료' },
    { name: '라떼 (톨)',       kcal: 190, emoji: '☕', cat: '간식·음료' },
    { name: '요거트 (플레인)', kcal: 100, emoji: '🥛', cat: '간식·음료' },
    { name: '프로틴 쉐이크',  kcal: 160, emoji: '💪', cat: '간식·음료' },
    { name: '아이스크림 (1개)',kcal: 220, emoji: '🍦', cat: '간식·음료' },
    { name: '초콜릿 (50g)',    kcal: 270, emoji: '🍫', cat: '간식·음료' },
    { name: '과자 (감자칩 소)',kcal: 220, emoji: '🍟', cat: '간식·음료' },
    { name: '아몬드 (30g)',    kcal: 180, emoji: '🌰', cat: '간식·음료' },
  
    /* ── 과일·채소 ── */
    { name: '바나나 (1개)',    kcal:  90, emoji: '🍌', cat: '과일·채소' },
    { name: '사과 (1개)',      kcal:  80, emoji: '🍎', cat: '과일·채소' },
    { name: '오렌지 (1개)',    kcal:  60, emoji: '🍊', cat: '과일·채소' },
    { name: '방울토마토 (10개)',kcal: 30, emoji: '🍅', cat: '과일·채소' },
    { name: '오이 (1개)',      kcal:  20, emoji: '🥒', cat: '과일·채소' },
    { name: '고구마 (100g)',   kcal: 130, emoji: '🍠', cat: '과일·채소' },
    { name: '아보카도 (1/2)',  kcal: 120, emoji: '🥑', cat: '과일·채소' },
    { name: '수박 (200g)',     kcal:  60, emoji: '🍉', cat: '과일·채소' },
  ];
  
  /* ================================================================
     2. 앱 상태 (전역)
     확장 포인트:
     - history[]    : 날짜별 칼로리 로그
     - meals.{meal} : 아침/점심/저녁/간식 별 음식 배열
  ================================================================ */
  const AppState = {
    user: {
      gender:   'male',
      age:      null,
      height:   null,
      weight:   null,
      activity: 1.375,
      goal:     'maintain',
    },
    today: {
      meals: {
        breakfast: [],   // [{ name, kcal, emoji, src }, ...]
        lunch:     [],
        dinner:    [],
        snack:     [],
      },
    },
    results: {
      bmr:    null,
      tdee:   null,
      target: null,
    },
    history: [],         // 확장 슬롯: [{ date, totalKcal, weight }, ...]
    ui: {
      currentMeal:   'breakfast',
      currentCat:    '',
      aiResults:     [],   // 사진 분석 임시 결과
      photoBase64:   null, // 업로드된 사진 base64 데이터
      photoMediaType:'image/jpeg',
    },
  };
  
  /* ================================================================
     3. 계산 로직 (순수 함수)
  ================================================================ */
  const Calc = {
  
    /**
     * BMR (Mifflin-St Jeor 공식)
     * 남: 10w + 6.25h - 5a + 5
     * 여: 10w + 6.25h - 5a - 161
     */
    bmr(gender, weight, height, age) {
      const base = 10 * weight + 6.25 * height - 5 * age;
      return gender === 'male' ? base + 5 : base - 161;
    },
  
    /** TDEE = BMR × 활동계수 */
    tdee(bmr, factor) {
      return bmr * factor;
    },
  
    /**
     * 목표 칼로리
     * 감량: TDEE - 500 / 유지: TDEE / 증량: TDEE + 400 (범위 ±300~500)
     */
    targetCalories(tdee, goal) {
      const r = Math.round;
      if (goal === 'loss') return { target: r(tdee - 500), min: r(tdee - 500), max: r(tdee - 500) };
      if (goal === 'gain') return { target: r(tdee + 400), min: r(tdee + 300), max: r(tdee + 500) };
      return { target: r(tdee), min: r(tdee), max: r(tdee) };
    },
  
    /**
     * 권장 매크로 (탄 50 / 단 25 / 지 25%)
     * 탄수화물·단백질 1g = 4 kcal, 지방 1g = 9 kcal
     */
    macros(kcal) {
      return {
        protein: Math.round((kcal * 0.25) / 4),
        carb:    Math.round((kcal * 0.50) / 4),
        fat:     Math.round((kcal * 0.25) / 9),
      };
    },
  
    /** 특정 식사 소계 */
    mealTotal(mealKey) {
      return AppState.today.meals[mealKey].reduce((sum, f) => sum + f.kcal, 0);
    },
  
    /** 오늘 전체 칼로리 합계 */
    dailyTotal() {
      return ['breakfast', 'lunch', 'dinner', 'snack']
        .reduce((sum, k) => sum + Calc.mealTotal(k), 0);
    },
  
    /** 섭취 달성률 (%) */
    intakePct(intake, target) {
      return Math.round((intake / target) * 100);
    },
  };
  
  /* ================================================================
     4. 유효성 검사
  ================================================================ */
  const Validate = {
    rules: {
      age:    { min: 1,  max: 120, msg: '1~120 사이의 나이를 입력하세요.' },
      height: { min: 50, max: 250, msg: '50~250 cm 범위로 입력하세요.' },
      weight: { min: 20, max: 300, msg: '20~300 kg 범위로 입력하세요.' },
    },
  
    /**
     * 단일 필드 검사
     * @param {string} id       - input 요소 id
     * @param {*}      rawValue - 입력 문자열 또는 숫자
     * @returns {boolean} 유효 여부
     */
    field(id, rawValue) {
      const rule  = this.rules[id];
      const input = document.getElementById(id);
      const err   = document.getElementById('err-' + id);
      if (!rule) return true;
  
      const empty = (rawValue === '' || rawValue === null || rawValue === undefined);
      const valid = empty || (Number(rawValue) >= rule.min && Number(rawValue) <= rule.max);
  
      input.classList.toggle('error', !valid);
      err.classList.toggle('show',   !valid);
      return valid;
    },
  
    /**
     * 전체 검증
     * - 3개 필드 모두 입력됐는지 + 범위 유효한지 확인
     * - 음수·0·범위 초과 시 false 반환 → compute() 차단
     */
    all() {
      const { age, height, weight } = AppState.user;
      if (!age || !height || !weight) return false;
      return (
        this.field('age',    age)    &&
        this.field('height', height) &&
        this.field('weight', weight)
      );
    },
  };
  
  /* ================================================================
     5. 식단 UI
  ================================================================ */
  const MealUI = {
  
    mealLabels: {
      breakfast: '아침',
      lunch:     '점심',
      dinner:    '저녁',
      snack:     '간식',
    },
  
    /* ── 탭 전환 ── */
    switchTab(mealKey) {
      AppState.ui.currentMeal = mealKey;
  
      // 탭 active 클래스 토글
      document.querySelectorAll('.meal-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.meal === mealKey);
      });
  
      // 소계 레이블 변경
      document.getElementById('ms-meal-name').textContent =
        this.mealLabels[mealKey] + ' 소계';
  
      // 검색창·드롭다운 초기화
      document.getElementById('food-search').value = '';
      document.getElementById('autocomplete-list').classList.remove('show');
  
      this.renderFoodList();
      this.updateSubtotal();
    },
  
    /* ── 카테고리 필터 ── */
    filterCat(cat) {
      AppState.ui.currentCat = cat;
  
      // 버튼 active 상태
      document.querySelectorAll('.cat-btn').forEach(b => {
        const isAll = (cat === '' && b.textContent.includes('전체'));
        b.classList.toggle('active', isAll || b.textContent.includes(cat));
      });
  
      // 현재 검색어 기준으로 다시 렌더
      this.showAutocomplete(document.getElementById('food-search').value);
    },
  
    /* ── 자동완성 드롭다운 표시 ── */
    showAutocomplete(q) {
      const list = document.getElementById('autocomplete-list');
      const cat  = AppState.ui.currentCat;
  
      // DB 필터링
      let items = FoodDB;
      if (cat)      items = items.filter(f => f.cat === cat);
      if (q.trim()) items = items.filter(f =>
        f.name.toLowerCase().includes(q.toLowerCase())
      );
  
      if (!items.length) {
        list.classList.remove('show');
        return;
      }
  
      // 최대 8개만 표시
      list.innerHTML = items.slice(0, 8).map(f => `
        <div class="autocomplete-item"
             onclick="MealUI.addFood('${f.name.replace(/'/g, "\\'")}', ${f.kcal}, '${f.emoji}', 'DB')">
          <span class="ai-name">${f.emoji} ${f.name}</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="ai-meta">${f.cat}</span>
            <span class="ai-kcal">${f.kcal} kcal</span>
          </div>
        </div>`).join('');
  
      list.classList.add('show');
    },
  
    /* ── 음식 추가 ── */
    addFood(name, kcal, emoji, src) {
      const meal = AppState.ui.currentMeal;
      AppState.today.meals[meal].push({ name, kcal, emoji, src });
  
      // 검색창 초기화
      document.getElementById('food-search').value = '';
      document.getElementById('autocomplete-list').classList.remove('show');
  
      this.renderFoodList();
      this.updateSubtotal();
      this.updateDailySummary();
      this.updateBadge(meal);
      compute(); // 결과 카드·차트 갱신
    },
  
    /* ── 음식 삭제 ── */
    removeFood(meal, idx) {
      AppState.today.meals[meal].splice(idx, 1);
  
      this.renderFoodList();
      this.updateSubtotal();
      this.updateDailySummary();
      this.updateBadge(meal);
      compute();
    },
  
    /* ── 음식 목록 렌더링 ── */
    renderFoodList() {
      const meal  = AppState.ui.currentMeal;
      const items = AppState.today.meals[meal];
      const list  = document.getElementById('food-list');
  
      if (!items.length) {
        list.innerHTML = `
          <div style="text-align:center;padding:20px;color:var(--t3);font-size:13px;">
            아직 추가된 음식이 없습니다.
          </div>`;
        return;
      }
  
      list.innerHTML = items.map((f, i) => `
        <div class="food-item">
          <div class="fi-left">
            <span class="fi-emoji">${f.emoji}</span>
            <div>
              <div class="fi-name">${f.name}</div>
              <div class="fi-src">${f.src === 'AI' ? '🤖 AI 추정' : '📋 DB'}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;">
            <span class="fi-kcal">${f.kcal} kcal</span>
            <button class="fi-del"
                    onclick="MealUI.removeFood('${meal}', ${i})">✕</button>
          </div>
        </div>`).join('');
    },
  
    /* ── 식사 소계 업데이트 ── */
    updateSubtotal() {
      const total = Calc.mealTotal(AppState.ui.currentMeal);
      document.getElementById('ms-val').textContent = total.toLocaleString();
    },
  
    /* ── 탭 배지 업데이트 ── */
    updateBadge(meal) {
      const cnt = AppState.today.meals[meal].length;
      const b   = document.getElementById('badge-' + meal);
      b.textContent = cnt;
      b.classList.toggle('show', cnt > 0);
    },
  
    /* ── 오늘 합계 배너 업데이트 ── */
    updateDailySummary() {
      const total = Calc.dailyTotal();
      document.getElementById('ds-total').innerHTML =
        total.toLocaleString() +
        ' <span style="font-size:1rem;color:var(--t2)">kcal</span>';
  
      ['breakfast', 'lunch', 'dinner', 'snack'].forEach(k => {
        document.getElementById('dm-' + k).textContent = Calc.mealTotal(k);
      });
    },
  
    /* ── API 키 표시/숨기기 ── */
    toggleApiKeyVisibility() {
      const inp = document.getElementById('api-key');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    },
  
    /* ================================================================
       AI 사진 분석
       - Claude Vision API (claude-opus-4-5) 호출
       - 응답을 JSON으로 파싱해 음식명·칼로리 추출
    ================================================================ */
    async analyzePhoto() {
      const apiKey = document.getElementById('api-key').value.trim();
  
      if (!apiKey) {
        alert('Anthropic API 키를 입력해 주세요.');
        return;
      }
      if (!AppState.ui.photoBase64) {
        alert('사진을 먼저 업로드해 주세요.');
        return;
      }
  
      // UI: 로딩 시작
      document.getElementById('analyze-btn').disabled = true;
      document.getElementById('ai-loading').classList.add('show');
      document.getElementById('ai-result').classList.remove('show');
  
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type':      'application/json',
            'x-api-key':         apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model:      'claude-opus-4-5',
            max_tokens: 1000,
            system: `당신은 음식 칼로리 분석 전문가입니다.
  사진에서 음식을 식별하고 각 음식의 예상 칼로리를 추정합니다.
  반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
  {"foods": [{"name": "음식명", "kcal": 숫자, "emoji": "이모지"}]}
  규칙:
  - 음식명은 한국어로 작성
  - kcal은 1인분 기준 정수값
  - emoji는 음식에 어울리는 이모지 1개
  - 여러 음식이 보이면 각각 배열에 추가`,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type:       'base64',
                    media_type: AppState.ui.photoMediaType,
                    data:       AppState.ui.photoBase64,
                  },
                },
                {
                  type: 'text',
                  text: '이 사진의 음식과 칼로리를 분석해 주세요.',
                },
              ],
            }],
          }),
        });
  
        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.error?.message || 'API 오류가 발생했습니다.');
        }
  
        // 응답 JSON 파싱 (마크다운 펜스 제거)
        const rawText = data.content.find(b => b.type === 'text')?.text || '{}';
        const clean   = rawText.replace(/```json|```/g, '').trim();
        const parsed  = JSON.parse(clean);
  
        AppState.ui.aiResults = parsed.foods || [];
        this.renderAiResult();
  
      } catch (err) {
        alert('분석 실패: ' + err.message);
      } finally {
        document.getElementById('ai-loading').classList.remove('show');
        document.getElementById('analyze-btn').disabled = false;
      }
    },
  
    /* ── AI 분석 결과 렌더링 ── */
    renderAiResult() {
      const foods = AppState.ui.aiResults;
      if (!foods.length) {
        alert('음식을 인식하지 못했습니다. 다른 사진을 시도해 보세요.');
        return;
      }
  
      document.getElementById('ar-foods').innerHTML = foods.map(f => `
        <div class="ar-food">
          <span>${f.emoji || '🍽️'} ${f.name}</span>
          <span class="af-kcal">${f.kcal} kcal</span>
        </div>`).join('');
  
      document.getElementById('ai-result').classList.add('show');
    },
  
    /* ── AI 결과 → 현재 식사에 추가 ── */
    addAiResults() {
      AppState.ui.aiResults.forEach(f => {
        this.addFood(f.name, f.kcal, f.emoji || '🍽️', 'AI');
      });
  
      // 초기화
      AppState.ui.aiResults   = [];
      AppState.ui.photoBase64 = null;
  
      document.getElementById('ai-result').classList.remove('show');
      document.getElementById('photo-preview').classList.remove('show');
      document.getElementById('analyze-btn').disabled = true;
    },
  };
  
  /* ================================================================
     6. UI 렌더링 (결과 카드 / 차트)
  ================================================================ */
  // Chart.js 인스턴스 싱글톤
  let barChart = null;
  
  const UI = {
  
    /* ── 결과 카드 ── */
    renderResults() {
      const { bmr, tdee, target } = AppState.results;
      const { goal }              = AppState.user;
      const intake                = Calc.dailyTotal();
      const macros                = Calc.macros(target);
  
      const goalMeta = {
        loss:     { label: '🔥 체중 감량', cls: 'loss',     desc: 'TDEE 대비 -500 kcal 적자' },
        maintain: { label: '⚖️ 체중 유지', cls: 'maintain', desc: 'TDEE와 동일한 칼로리 유지' },
        gain:     { label: '💪 근육 증량', cls: 'gain',     desc: 'TDEE 대비 +300~500 kcal 흑자' },
      };
      const gm = goalMeta[goal];
  
      // 진행 바 (오늘 식단 합계 > 0 일 때만 렌더)
      let intakeHTML = '';
      if (intake > 0) {
        const pct    = Calc.intakePct(intake, target);
        const barCls = pct > 110 ? 'over' : (pct < 80 ? 'warn' : 'ok');
        const barW   = Math.min(pct, 100);
        const remain = target - intake;
        const remainTxt = remain >= 0
          ? `<span style="color:var(--accent)">+${remain.toLocaleString()} kcal 남음</span>`
          : `<span style="color:var(--danger)">${Math.abs(remain).toLocaleString()} kcal 초과</span>`;
  
        intakeHTML = `
          <div class="intake-section">
            <div class="intake-label-row">
              <span>오늘 식단 합계 ${remainTxt}</span>
              <strong>${intake.toLocaleString()} kcal</strong>
            </div>
            <div class="progress-wrap">
              <div class="progress-bar ${barCls}" style="width:${barW}%"></div>
            </div>
            <div class="progress-pct">
              목표 대비 <span>${pct}%</span> ${pct > 100 ? '⚠️ 초과' : '달성'}
            </div>
          </div>`;
      }
  
      document.getElementById('result-body').innerHTML = `
        <div class="anim-pop">
          <div style="margin-bottom:18px;">
            <span class="goal-badge ${gm.cls}">${gm.label}</span>
            <span style="font-size:12px;color:var(--t2);margin-left:8px;">${gm.desc}</span>
          </div>
  
          <div class="result-grid">
            <div class="result-item">
              <div class="ri-label">기초대사량 BMR</div>
              <div class="ri-value">${bmr.toLocaleString()}</div>
              <div class="ri-unit">kcal / day</div>
            </div>
            <div class="result-item">
              <div class="ri-label">활동 소비량 TDEE</div>
              <div class="ri-value">${Math.round(tdee).toLocaleString()}</div>
              <div class="ri-unit">kcal / day</div>
            </div>
            <div class="result-item highlight">
              <div class="ri-label">목표 칼로리</div>
              <div class="ri-value">${target.toLocaleString()}</div>
              <div class="ri-unit">kcal / day</div>
            </div>
          </div>
  
          ${intakeHTML}
  
          <div style="font-size:11px;color:var(--t3);letter-spacing:.12em;
                      text-transform:uppercase;margin-top:24px;margin-bottom:12px;">
            권장 매크로 (탄 50 / 단 25 / 지 25%)
          </div>
          <div class="macro-row">
            <div class="macro-item protein">
              <div class="m-name">단백질</div>
              <div class="m-val">${macros.protein}</div>
              <div class="m-unit">g</div>
            </div>
            <div class="macro-item carb">
              <div class="m-name">탄수화물</div>
              <div class="m-val">${macros.carb}</div>
              <div class="m-unit">g</div>
            </div>
            <div class="macro-item fat">
              <div class="m-name">지방</div>
              <div class="m-val">${macros.fat}</div>
              <div class="m-unit">g</div>
            </div>
          </div>
        </div>`;
    },
  
    /* ── 차트 렌더링 ──
       - CSS 변수를 동적으로 읽어 차트 색상에 적용 (테마 연동)
       - intake === 0이면 '목표 칼로리' 단독 막대만 표시
    */
    renderChart() {
      const { target } = AppState.results;
      const intake     = Calc.dailyTotal();
  
      // CSS 변수 → JS 값 추출
      const cs       = getComputedStyle(document.documentElement);
      const cardBg   = cs.getPropertyValue('--card').trim();
      const text1    = cs.getPropertyValue('--t1').trim();
      const text2    = cs.getPropertyValue('--t2').trim();
      const borderCl = cs.getPropertyValue('--border').trim();
  
      // intake 유무에 따라 레이블·데이터 구성
      const hasIntake    = intake > 0;
      const labels       = hasIntake ? ['목표 칼로리', '섭취 칼로리'] : ['목표 칼로리'];
      const dataVals     = hasIntake ? [target, intake]              : [target];
  
      // 달성률에 따른 섭취 막대 색상
      let iBg = 'rgba(45,168,216,0.6)', iBd = 'rgba(45,168,216,1)';
      if (hasIntake) {
        const pct = Calc.intakePct(intake, target);
        if      (pct > 110) { iBg = 'rgba(224,92,114,0.6)';  iBd = 'rgba(224,92,114,1)'; }
        else if (pct < 80)  { iBg = 'rgba(232,156,56,0.6)';  iBd = 'rgba(232,156,56,1)'; }
      }
  
      const bgColors     = hasIntake ? ['rgba(58,159,214,0.25)', iBg] : ['rgba(58,159,214,0.25)'];
      const borderColors = hasIntake ? ['rgba(58,159,214,1)',    iBd] : ['rgba(58,159,214,1)'];
  
      // 캔버스 교체
      document.getElementById('chart-body').innerHTML =
        '<div class="chart-wrap"><canvas id="myChart"></canvas></div>';
      if (barChart) { barChart.destroy(); barChart = null; }
  
      barChart = new Chart(
        document.getElementById('myChart').getContext('2d'),
        {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'kcal',
              data:  dataVals,
              backgroundColor: bgColors,
              borderColor:     borderColors,
              borderWidth: 2,
              borderRadius: 8,
              borderSkipped: false,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 900, easing: 'easeOutQuart' },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: { label: c => ' ' + c.parsed.y.toLocaleString() + ' kcal' },
                backgroundColor: cardBg,
                titleColor:      text1,
                bodyColor:       text2,
                borderColor:     borderCl,
                borderWidth: 1,
                padding: 12,
              },
            },
            scales: {
              x: {
                ticks:  { color: text2, font: { family: 'Noto Sans KR', size: 12 } },
                grid:   { display: false },
                border: { color: borderCl },
              },
              y: {
                ticks: {
                  color: text2,
                  font: { family: 'Noto Sans KR', size: 11 },
                  callback: v => v.toLocaleString(),
                },
                grid:   { color: 'rgba(189,216,242,.55)' },
                border: { color: borderCl, dash: [4, 4] },
                beginAtZero: true,
              },
            },
          },
        }
      );
    },
  
    /* ── 플레이스홀더 복원 ── */
    showPlaceholder() {
      document.getElementById('result-body').innerHTML = `
        <div class="placeholder-msg">
          <span class="icon">📊</span>
          신체 정보를 모두 입력하면 결과가 여기에 표시됩니다.
        </div>`;
      document.getElementById('chart-body').innerHTML = `
        <div class="placeholder-msg">
          <span class="icon">📈</span>
          계산 후 그래프가 표시됩니다.
        </div>`;
      if (barChart) { barChart.destroy(); barChart = null; }
    },
  };
  
  /* ================================================================
     7. 계산 파이프라인
  ================================================================ */
  function compute() {
    const { gender, age, height, weight, activity, goal } = AppState.user;
  
    // 유효성 검사 통과 실패 시 플레이스홀더 표시
    if (!Validate.all()) { UI.showPlaceholder(); return; }
  
    const bmr        = Math.round(Calc.bmr(gender, weight, height, age));
    const tdee       = Calc.tdee(bmr, activity);
    const { target } = Calc.targetCalories(tdee, goal);
  
    AppState.results.bmr    = bmr;
    AppState.results.tdee   = tdee;
    AppState.results.target = target;
  
    UI.renderResults();
    UI.renderChart();
  }
  
  /* ================================================================
     8. 이벤트 바인딩
  ================================================================ */
  function bindEvents() {
  
    /* ── 신체 정보 입력 ── */
    ['age', 'height', 'weight'].forEach(id => {
      document.getElementById(id).addEventListener('input', e => {
        AppState.user[id] = e.target.value === '' ? null : Number(e.target.value);
        Validate.field(id, e.target.value);
        compute();
      });
    });
  
    /* ── 성별 ── */
    document.querySelectorAll('input[name="gender"]').forEach(r => {
      r.addEventListener('change', e => {
        AppState.user.gender = e.target.value;
        compute();
      });
    });
  
    /* ── 활동 수준 ── */
    document.getElementById('activity').addEventListener('change', e => {
      AppState.user.activity = Number(e.target.value);
      compute();
    });
  
    /* ── 목표 ── */
    document.querySelectorAll('input[name="goal"]').forEach(r => {
      r.addEventListener('change', e => {
        AppState.user.goal = e.target.value;
        compute();
      });
    });
  
    /* ── 음식 검색 자동완성 ── */
    const searchInput = document.getElementById('food-search');
    searchInput.addEventListener('input',  e => MealUI.showAutocomplete(e.target.value));
    searchInput.addEventListener('focus',  e => { if (!e.target.value) MealUI.showAutocomplete(''); });
  
    // 검색창 외부 클릭 시 드롭다운 닫기
    document.addEventListener('click', e => {
      if (!e.target.closest('.food-search-wrap')) {
        document.getElementById('autocomplete-list').classList.remove('show');
      }
    });
  
    /* ── 사진 업로드 (파일 선택) ── */
    document.getElementById('photo-input').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      _loadPhotoFile(file);
    });
  
    /* ── 드래그 앤 드롭 ── */
    const dropZone = document.getElementById('photo-drop');
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) _loadPhotoFile(file);
    });
  
    /* ── 미리보기 클릭 → 재선택 ── */
    document.getElementById('photo-preview').addEventListener('click', () => {
      document.getElementById('photo-input').click();
    });
  
    /* ── API 키 localStorage 저장/복원 ── */
    const savedKey = localStorage.getItem('anthropic_api_key');
    if (savedKey) document.getElementById('api-key').value = savedKey;
  
    document.getElementById('api-key').addEventListener('change', e => {
      if (e.target.value) localStorage.setItem('anthropic_api_key', e.target.value);
      else                localStorage.removeItem('anthropic_api_key');
    });
  }
  
  /**
   * 이미지 파일을 base64로 읽어 상태에 저장하고 미리보기를 업데이트
   * @param {File} file
   */
  function _loadPhotoFile(file) {
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target.result;
      const parts   = dataUrl.split(',');
  
      // 상태 저장
      AppState.ui.photoBase64    = parts[1];
      AppState.ui.photoMediaType = file.type || 'image/jpeg';
  
      // 미리보기
      document.getElementById('preview-img').src = dataUrl;
      document.getElementById('photo-preview').classList.add('show');
      document.getElementById('analyze-btn').disabled = false;
    };
    reader.readAsDataURL(file);
  }
  
  /* ================================================================
     9. 초기화
  ================================================================ */
  (function init() {
    bindEvents();
    MealUI.renderFoodList(); // 초기 빈 상태 렌더
  })();
  