// 검색엔진 노출용 태그를 각 계산기 페이지와 메인 페이지에 넣는 스크립트
//
// 실행: node scripts/seo.mjs
// - 계산기 페이지: </head> 앞에 <!-- SEO:START --> ~ <!-- SEO:END --> 블록을 넣는다
//   (description · canonical · og · twitter · 구조화 데이터 JSON-LD)
// - 메인 index.html: 같은 블록 + <main> 안에 계산기 카드를 정적 HTML 링크로 미리 그려 둔다
// - 다시 실행하면 블록만 교체되므로 설명을 고친 뒤 몇 번이든 다시 돌려도 된다.
// - 페이지에 이미 직접 적어 둔 description·canonical·og 태그가 있으면 그 태그는 건드리지 않고 건너뛴다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.allcalcu.com';
const SITE_NAME = '올계산 allcalcu';
const OG_IMAGE = `${SITE}/favicon.png`;

// category → schema.org applicationCategory
const APP_CATEGORY = {
  basic: 'UtilitiesApplication',
  advanced: 'FinanceApplication',
  salary: 'FinanceApplication',
  health: 'HealthApplication',
};

// 페이지별 검색 결과 설명 (네이버·구글 검색 결과에 보이는 문장)
// title: og:title·구조화 데이터에 쓰는 이름 (페이지 <title> 은 그대로 둔다)
const PAGES = {
  calculator_Basic_A: {
    category: 'basic',
    title: '온라인 계산기 (베이직1) - 사칙연산·평형 계산',
    description: '무료 온라인 계산기. 사칙연산, 퍼센트, 평형 계산, 메모리 기능과 소수점 자릿수·반올림 설정을 지원하며 그레이·코랄·퍼플·블루·민트 5가지 테마를 고를 수 있습니다.',
  },
  calculator_Basic_B: {
    category: 'basic',
    title: '온라인 계산기 (베이직2) - 슬림 디자인 기본 계산기',
    description: '심플하고 슬림한 디자인의 무료 온라인 기본 계산기. 사칙연산과 퍼센트 계산을 빠르게 하고 5가지 색상 테마를 선택할 수 있습니다.',
  },
  'calculator_D-day': {
    category: 'basic',
    title: 'D-DAY 계산기 - 날짜 계산, 남은 일수 계산',
    description: '디데이 계산기. 기념일·시험일·마감일까지 남은 일수와 시·분·초를 실시간으로 계산하고 여러 이벤트를 함께 관리할 수 있습니다.',
  },
  calculator_Change_rate: {
    category: 'basic',
    title: '증감율 계산기 - 증가율·감소율 퍼센트 계산',
    description: '이전 값과 현재 값을 입력하면 증가율·감소율(%)과 증감액을 바로 계산합니다. 매출 성장률, 주가 등락률, 성적 변화 비교에 활용하세요.',
  },
  calculator_Age: {
    category: 'basic',
    title: '나이 계산기 - 만 나이·세는 나이·연 나이 계산',
    description: '생년월일을 입력하면 만 나이, 세는 나이, 연 나이를 한 번에 계산합니다. 2023년 시행된 만 나이 통일법 기준을 반영했습니다.',
  },
  calculator_Discount: {
    category: 'basic',
    title: '할인 계산기 - 할인율·할인가·원래 가격 계산',
    description: '정가와 할인율로 최종 가격을, 정가와 할인가로 할인율을, 할인가와 할인율로 원래 가격을 역산하는 할인 계산기입니다.',
  },
  calculator_UnitConversion: {
    category: 'basic',
    title: '단위 변환 계산기 - 길이·무게·온도·넓이·부피 변환',
    description: '길이, 무게, 온도, 넓이(평·㎡), 부피 등 자주 쓰는 단위를 즉시 변환합니다. 국제 단위(SI)와 영미식 단위를 모두 지원합니다.',
  },
  calculator_WorldTime: {
    category: 'basic',
    title: '세계 시간 계산기 - 나라별 시차·현지 시각 비교',
    description: '기준 도시를 정하고 비교할 도시를 추가하면 세계 각 도시의 현재 시각과 시차를 한눈에 비교합니다. 해외 출장·여행·화상회의 일정 잡기에 유용합니다.',
  },
  calculator_ExchangeRate: {
    category: 'basic',
    title: '환율 계산기 - 실시간 환율로 달러·엔·유로 원화 환산',
    description: '실시간 환율 기준으로 달러, 엔화, 유로, 위안 등 주요 통화를 원화로 환산하는 환율 계산기입니다. 주요 통화 환율을 한눈에 확인할 수 있습니다.',
  },
  calculator_CameraExchangeRate: {
    category: 'basic',
    title: '카메라 환율 계산기 - 가격표를 찍으면 원화로 환산',
    description: '해외여행 중 가격표나 지폐를 카메라로 비추면 금액과 통화를 인식해 원화로 바로 환산합니다. 장바구니 합계와 카드·현금 수수료 반영도 지원합니다.',
  },
  calculator_Business: {
    category: 'advanced',
    title: '비즈니스 계산기 - 부가세·마진율·손익분기점·가산세·감가상각',
    description: '부가세 역산, 마진율·마크업, 손익분기점(BEP), 국세기본법 가산세(무신고·과소신고·납부지연), 정액법·정률법 감가상각, 재무비율 24종을 한곳에서 계산합니다.',
  },
  calculator_Financial: {
    category: 'advanced',
    title: '사채·전환사채 계산기 - 발행가액·유효이자율 상각표·분개',
    description: 'K-IFRS 기준 사채와 전환사채(CB)의 발행가액, 부채·자본요소 배분, 유효이자율법 상각표와 회계처리 분개를 자동으로 계산하는 회계 실무용 계산기입니다.',
  },
  calculator_Interest: {
    category: 'advanced',
    title: '이자 계산기 - 단리·복리 이자, 대출 원리금 상환 스케줄',
    description: '원금·이자율·기간을 입력하면 단리·복리 이자를 계산하고 대출 원리금균등·원금균등 상환 스케줄표를 만들어 주는 이자 계산기입니다.',
  },
  calculator_DualCalendar: {
    category: 'advanced',
    title: '음력 양력 변환기 - 음력·양력 날짜 변환 달력',
    description: '양력 날짜를 음력으로, 음력 날짜를 양력으로 변환합니다. 윤달 처리와 24절기 표시를 지원해 생일·제사·명절 날짜 확인에 편리합니다.',
  },
  calculator_Investment: {
    category: 'advanced',
    title: '증권거래세 계산기 - 주식 매도 시 거래세 계산',
    description: '주식 매도 금액과 시장(코스피·코스닥·비상장)을 입력하면 증권거래세와 농어촌특별세를 자동으로 계산합니다.',
  },
  calculator_TaxPlatform: {
    category: 'salary',
    title: '소득세 계산기 - 근로·사업·기타소득 종합소득세 계산',
    description: '소득 종류별로 세액을 계산한 뒤 종합소득세로 자동 합산하는 소득세 계산기입니다. 세법 기준으로 근로·사업·기타소득 등의 추정 세액을 확인할 수 있습니다.',
  },
  calculator_Retire: {
    category: 'salary',
    title: '퇴직금 계산기 - 법정 퇴직금·퇴직연금(DB·DC) 계산',
    description: '입사일·퇴직일과 최근 3개월 평균임금을 입력하면 법정 퇴직금을 계산합니다. DB형·DC형 퇴직연금 예상액 비교도 지원합니다.',
  },
  calculator_4insurance: {
    category: 'salary',
    title: '4대보험 계산기 - 국민연금·건강보험·고용보험·산재보험',
    description: '월 보수액을 입력하면 국민연금, 건강보험, 장기요양보험, 고용보험의 근로자 부담금과 회사 부담금을 계산하는 4대보험 계산기입니다.',
  },
  calculator_NetPay: {
    category: 'salary',
    title: '네트제 급여 계산기 - 세후 실수령액으로 세전 연봉 역산',
    description: '받기로 한 세후 월급을 입력하면 4대보험과 근로소득 간이세액표를 반영해 필요한 세전 급여와 회사 총 인건비를 원 단위로 역산합니다.',
  },
  calculator_PayLab: {
    category: 'salary',
    title: '급여·노무 계산기 - 평균임금·통상임금·연차수당·주휴수당',
    description: '평균임금, 통상임금, 연차휴가와 연차수당, 주휴수당, 출산휴가급여, 육아휴직급여 등 급여·노무 항목을 한곳에서 계산하는 통합 계산기입니다.',
  },
  calculator_RealEestate: {
    category: 'advanced',
    title: '부동산 계산기 - 중개보수·취득세·대출·임대 수익 계산',
    description: '부동산 중개보수(복비) 법정 상한, 취득세 등 세금, 대출, 임대 수익을 종합적으로 계산하는 부동산 계산기입니다.',
  },
  calculator_BMI: {
    category: 'health',
    title: 'BMI 계산기 - 비만도 측정·표준 체중 계산',
    description: '키와 몸무게를 입력하면 BMI 지수를 계산해 저체중·정상·과체중·비만을 판정하고 표준 체중 범위를 알려 주는 비만도 계산기입니다.',
  },
  calculator_LunaCycle: {
    category: 'health',
    title: '배란일 계산기 - 배란일·가임기·다음 생리 예정일',
    description: '마지막 생리 시작일과 주기를 입력하면 배란 예정일, 가임기, 다음 생리 예정일을 3회 주기까지 예측하는 배란일 계산기입니다.',
  },
  calculator_Calorie: {
    category: 'health',
    title: '칼로리 계산기 - 기초대사량(BMR)·하루 권장 칼로리',
    description: '성별·나이·키·몸무게와 활동량으로 기초대사량(BMR)과 하루 필요 칼로리를 계산하고 감량·유지·증량 목표별 권장 섭취량을 알려 줍니다.',
  },
};

const MAIN = {
  title: '올계산 - 무료 온라인 계산기 모음 (급여·세금·이자·환율·건강)',
  description: '연봉 실수령액, 4대보험, 퇴직금, 소득세, 이자, 환율, 나이, D-DAY, BMI 등 자주 쓰는 무료 계산기를 한곳에 모았습니다. 회원가입 없이 바로 계산하세요.',
};

// ── 공통 유틸 ───────────────────────────────────────────
const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const START = '<!-- SEO:START (scripts/seo.mjs 가 생성 — 직접 수정하지 마세요) -->';
const END = '<!-- SEO:END -->';
const BLOCK_RE = /[ \t]*<!-- SEO:START[\s\S]*?<!-- SEO:END -->\r?\n?/;

// 블록 밖에 이미 그 태그가 있는지 확인
function hasOutside(html, re) {
  return re.test(html.replace(BLOCK_RE, ''));
}

function jsonLd(obj) {
  // </script> 가 섞여 깨지는 것을 막는다
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

function headBlock(html, { url, title, description, ld }) {
  const tags = [];
  if (!hasOutside(html, /<meta\s+name=["']description["']/i))
    tags.push(`<meta name="description" content="${esc(description)}">`);
  if (!hasOutside(html, /<link\s+rel=["']canonical["']/i))
    tags.push(`<link rel="canonical" href="${url}">`);
  if (!hasOutside(html, /property=["']og:title["']/i)) {
    tags.push(
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="${esc(SITE_NAME)}">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(description)}">`,
      `<meta property="og:url" content="${url}">`,
      `<meta property="og:image" content="${OG_IMAGE}">`,
      `<meta property="og:locale" content="ko_KR">`,
    );
  }
  if (!hasOutside(html, /name=["']twitter:card["']/i))
    tags.push(`<meta name="twitter:card" content="summary">`);
  for (const obj of ld) tags.push(jsonLd(obj));
  return [START, ...tags, END].map((t) => '    ' + t).join('\n') + '\n';
}

function injectHead(html, block) {
  html = html.replace(BLOCK_RE, '');
  if (!/<\/head>/i.test(html)) throw new Error('</head> 없음');
  return html.replace(/<\/head>/i, block + '</head>');
}

function write(file, html) {
  const before = fs.readFileSync(file, 'utf8');
  if (before !== html) fs.writeFileSync(file, html, 'utf8');
  return before !== html;
}

// ── 1) 계산기 페이지 ────────────────────────────────────
const dirs = fs.readdirSync(ROOT).filter((d) => d.startsWith('calculator_') &&
  fs.existsSync(path.join(ROOT, d, 'index.html')));

const missing = dirs.filter((d) => !PAGES[d]);
if (missing.length) {
  console.error('PAGES 에 설명이 없는 폴더:', missing.join(', '));
  process.exit(1);
}

for (const dir of dirs) {
  const p = PAGES[dir];
  const url = `${SITE}/${dir}/`;
  const file = path.join(ROOT, dir, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const name = p.title.split(' - ')[0];
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name,
      alternateName: p.title,
      url,
      description: p.description,
      applicationCategory: APP_CATEGORY[p.category],
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript',
      inLanguage: 'ko',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '올계산 계산기 모음', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name, item: url },
      ],
    },
  ];
  const changed = write(file, injectHead(html, headBlock(html, { url, title: p.title, description: p.description, ld })));
  console.log(`${changed ? '수정' : '그대로'}  ${dir}`);
}

// ── 2) 메인 페이지 ──────────────────────────────────────
const mainFile = path.join(ROOT, 'index.html');
let main = fs.readFileSync(mainFile, 'utf8');

// 메인 페이지의 JS 배열을 그대로 읽어 카드 목록의 기준으로 쓴다 (목록을 두 군데서 관리하지 않도록)
function readArray(name) {
  const m = main.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\]);`));
  if (!m) throw new Error(`index.html 에서 ${name} 배열을 찾지 못함`);
  return Function(`"use strict"; return ${m[1]};`)();
}
const categories = readArray('categories');
const calculators = readArray('calculators');

const ld = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: ['올계산', 'allcalcu', 'Caboo 계산기 모음'],
    url: `${SITE}/`,
    inLanguage: 'ko',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '올계산 계산기 목록',
    itemListElement: calculators.filter((c) => c.ready).map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.title,
      url: `${SITE}/${c.url}`,
    })),
  },
];
main = injectHead(main, headBlock(main, { url: `${SITE}/`, title: MAIN.title, description: MAIN.description, ld }));

// <main> 안에 카드를 정적으로 그려 둔다. 화면에서는 JS 가 같은 내용을 다시 그린다.
// renderCard/renderAll 과 같은 마크업을 유지할 것.
const cardHtml = (c, catName) => `
                    <a class="card ${c.ready ? 'ready' : 'soon'}" data-id="${c.id}" href="${esc(c.url)}">
                        <div class="card-thumb">${c.icon}<span class="status-badge ${c.ready ? 'badge-ready' : 'badge-soon'}">${c.ready ? '사용 가능' : '준비 중'}</span></div>
                        <div class="card-body">
                            <div class="card-title">${esc(c.title)}</div>
                            <div class="card-desc">${esc(c.desc)}</div>
                            <div class="card-footer">
                                <span class="card-tag">${esc(catName)}</span>
                                <span class="card-arrow"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>
                            </div>
                        </div>
                    </a>`;

const sections = categories.map((cat) => {
  const items = calculators.filter((c) => c.category === cat.id);
  if (!items.length) return '';
  return `
        <section class="category-section ${cat.id}-section" data-category="${cat.id}">
            <div class="section-head">
                <div class="section-color-bar"></div>
                <h2>${esc(cat.name)}</h2>
                <span class="section-count">${items.filter((c) => c.ready).length}/${items.length} 사용 가능</span>
            </div>
            <div class="card-grid">${items.map((c) => cardHtml(c, cat.name)).join('')}
            </div>
        </section>`;
}).join('');

const MAIN_RE = /<main class="main" id="main-container">[\s\S]*?<\/main>/;
if (!MAIN_RE.test(main)) throw new Error('<main id="main-container"> 를 찾지 못함');
main = main.replace(MAIN_RE, () =>
  `<main class="main" id="main-container">\n        <!-- 아래 카드는 scripts/seo.mjs 가 생성 (검색엔진용 정적 링크) -->${sections}\n</main>`);

console.log(`${write(mainFile, main) ? '수정' : '그대로'}  index.html (카드 ${calculators.length}개)`);
