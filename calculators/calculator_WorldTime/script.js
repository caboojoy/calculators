    /* ============================================
    세계 시간 차이 계산기 - script.js
    caboojoy-calculators
    ============================================ */

    'use strict';

    /* ── 도시 데이터 ── */
    const CITIES = [
        { name: '서울',        tz: 'Asia/Seoul',             label: 'UTC+9'     },
        { name: '도쿄',        tz: 'Asia/Tokyo',             label: 'UTC+9'     },
        { name: '베이징',      tz: 'Asia/Shanghai',          label: 'UTC+8'     },
        { name: '홍콩',        tz: 'Asia/Hong_Kong',         label: 'UTC+8'     },
        { name: '싱가포르',    tz: 'Asia/Singapore',         label: 'UTC+8'     },
        { name: '방콕',        tz: 'Asia/Bangkok',           label: 'UTC+7'     },
        { name: '두바이',      tz: 'Asia/Dubai',             label: 'UTC+4'     },
        { name: '모스크바',    tz: 'Europe/Moscow',          label: 'UTC+3'     },
        { name: '카이로',      tz: 'Africa/Cairo',           label: 'UTC+2'     },
        { name: '파리',        tz: 'Europe/Paris',           label: 'UTC+1/2'   },
        { name: '런던',        tz: 'Europe/London',          label: 'UTC+0/1'   },
        { name: '상파울루',    tz: 'America/Sao_Paulo',      label: 'UTC-3'     },
        { name: '뉴욕',        tz: 'America/New_York',       label: 'UTC-5/-4'  },
        { name: '시카고',      tz: 'America/Chicago',        label: 'UTC-6/-5'  },
        { name: '덴버',        tz: 'America/Denver',         label: 'UTC-7/-6'  },
        { name: '로스앤젤레스',tz: 'America/Los_Angeles',    label: 'UTC-8/-7'  },
        { name: '밴쿠버',      tz: 'America/Vancouver',      label: 'UTC-8/-7'  },
        { name: '시드니',      tz: 'Australia/Sydney',       label: 'UTC+10/11' },
        { name: '오클랜드',    tz: 'Pacific/Auckland',       label: 'UTC+12/13' },
        { name: '아디스아바바',tz: 'Africa/Addis_Ababa',     label: 'UTC+3'     },
        { name: '마드리드',    tz: 'Europe/Madrid',          label: 'UTC+1/2'   },
        { name: '코트디부아르(아비장)', tz: 'Africa/Abidjan',       label: 'UTC+0'     },
        { name: '남아프리카공화국(요하네스버그)', tz: 'Africa/Johannesburg', label: 'UTC+2'     },
        { name: '뉴델리',      tz: 'Asia/Kolkata',           label: 'UTC+5:30'  },
        { name: '베를린',      tz: 'Europe/Berlin',          label: 'UTC+1/2'   },
        { name: '토론토',      tz: 'America/Toronto',        label: 'UTC-5/-4'  },
        { name: '시에라리온(프리타운)', tz: 'Africa/Freetown',      label: 'UTC+0'     },
        { name: '조지아(트빌리시)', tz: 'Asia/Tbilisi',           label: 'UTC+4'     },
        { name: '아르메니아(예레반)', tz: 'Asia/Yerevan',          label: 'UTC+4'     },
        { name: '아제르바이잔(바쿠)', tz: 'Asia/Baku',             label: 'UTC+4'     },
    ];
    
    /* ── 상태 ── */
    let baseIdx = 0;                    // 기준 도시 인덱스
    let compCities = [3, 10, 13, 18];   // 비교 도시 인덱스 배열 (초기값)
    let tickTimer = null;
    
    /* ── 시간 유틸 ── */
    
    /**
        * 특정 타임존의 현재 시각 문자열 반환 (HH:MM:SS)
        * @param {string} tz - IANA 타임존
        * @returns {string}
        */
    function formatTime(tz) {
        return new Date().toLocaleTimeString('ko-KR', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        });
    }
    
    /**
        * 특정 타임존의 날짜 문자열 반환 (M월 D일 (요일))
        * @param {string} tz - IANA 타임존
        * @returns {string}
        */
    function formatDate(tz) {
        return new Date().toLocaleDateString('ko-KR', {
        timeZone: tz,
        month: 'long',
        day: 'numeric',
        weekday: 'short',
        });
    }
    
    /**
        * 타임존의 UTC 오프셋 (시간 단위, 소수 가능) 반환
        * 예) Asia/Seoul → 9, Asia/Kolkata → 5.5, America/New_York → -4 또는 -5
        * @param {string} tz - IANA 타임존
        * @returns {number}
        */
    function getTzOffsetHours(tz) {
        const now = new Date();
        const local = new Date(now.toLocaleString('en-US', { timeZone: tz }));
        const utc   = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
        return (local - utc) / 3_600_000;
    }
    
    /**
        * 두 오프셋의 차이를 한국어 문자열로 반환
        * @param {number} baseOff - 기준 도시 오프셋
        * @param {number} compOff - 비교 도시 오프셋
        * @returns {string}
        */
    function getDiffStr(baseOff, compOff) {
        const diff = compOff - baseOff;
        if (diff === 0) return '동일';
    
        const absDiff = Math.abs(diff);
        const h = Math.floor(absDiff);
        const m = Math.round((absDiff - h) * 60);
        const sign = diff > 0 ? '+' : '-';
        if (m === 0) return `${sign}${h}시간`;
        return `${sign}${h}시간 ${m}분`;
    }
    
    /**
        * 시차 배지 CSS 클래스 반환
        * @param {number} diff
        * @returns {string}
        */
    function diffClass(diff) {
        if (diff > 0) return 'diff-pos';
        if (diff < 0) return 'diff-neg';
        return 'diff-zero';
    }
    
    /* ── 렌더링 ── */
    
    /** 기준 도시 셀렉트 렌더링 */
    function renderBaseSelect() {
        const sel = document.getElementById('base-select');
        sel.innerHTML = '';
        CITIES.forEach((c, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${c.name} (${c.label})`;
        if (i === baseIdx) opt.selected = true;
        sel.appendChild(opt);
        });
        sel.onchange = () => {
        baseIdx = parseInt(sel.value, 10);
        compCities = compCities.filter(x => x !== baseIdx);
        renderAll();
        };
    }
    
    /** 도시 추가 셀렉트 렌더링 */
    function renderAddSelect() {
        const sel = document.getElementById('add-select');
        sel.innerHTML = '';
        CITIES.forEach((c, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `${c.name} (${c.label})`;
        sel.appendChild(opt);
        });
    
        document.getElementById('add-btn').onclick = () => {
        const idx = parseInt(sel.value, 10);
        if (idx === baseIdx) {
            alert('기준 도시와 같은 도시입니다.');
            return;
        }
        if (compCities.includes(idx)) {
            alert('이미 추가된 도시입니다.');
            return;
        }
        compCities.push(idx);
        renderAll();
        };
    }
    
    /** 비교 도시 카드 목록 렌더링 */
    function renderCities() {
        const container = document.getElementById('cities-list');
        const baseOff = getTzOffsetHours(CITIES[baseIdx].tz);
        container.innerHTML = '';
    
        compCities.forEach(idx => {
        const c = CITIES[idx];
        const compOff = getTzOffsetHours(c.tz);
        const diff = compOff - baseOff;
        const diffStr = getDiffStr(baseOff, compOff);
    
        const card = document.createElement('div');
        card.className = 'wt-city-card';
        card.dataset.idx = idx;
        card.innerHTML = `
            <div class="wt-city-main">
            <div class="wt-city-row">
                <span class="wt-city-name">${c.name}</span>
                <span class="wt-city-tz">${c.label}</span>
                <span class="wt-diff-badge ${diffClass(diff)}">${diffStr}</span>
            </div>
            <div class="wt-city-time" data-tz="${c.tz}">--:--:--</div>
            <div class="wt-city-date" data-tz="${c.tz}"></div>
            </div>
            <button class="wt-remove" data-idx="${idx}" title="도시 제거">✕</button>
        `;
    
        card.querySelector('.wt-remove').addEventListener('click', e => {
            const removeIdx = parseInt(e.currentTarget.dataset.idx, 10);
            compCities = compCities.filter(x => x !== removeIdx);
            renderAll();
        });
    
        container.appendChild(card);
        });
    }
    
    /** 시차 요약 테이블 렌더링 */
    function renderDiffTable() {
        const sec = document.getElementById('diff-section');
        if (compCities.length === 0) { sec.innerHTML = ''; return; }
    
        const baseOff = getTzOffsetHours(CITIES[baseIdx].tz);
        const rows = compCities
        .map(idx => {
            const c = CITIES[idx];
            const off = getTzOffsetHours(c.tz);
            return { name: c.name, off, diff: off - baseOff };
        })
        .sort((a, b) => a.diff - b.diff);
    
        const rowsHTML = rows.map(r => {
        const absDiff = Math.abs(r.off);
        const h = Math.floor(absDiff);
        const m = Math.round((absDiff - h) * 60);
        const sign = r.off >= 0 ? '+' : '-';
        const offStr = `UTC${sign}${m === 0 ? h : `${h}:${String(m).padStart(2, '0')}`}`;
        return `
            <tr>
            <td class="wt-diff-cell">${r.name}</td>
            <td class="wt-diff-cell" style="color:#5a7a8a;font-size:12px;">${offStr}</td>
            <td class="wt-diff-cell">
                <span class="wt-diff-badge ${diffClass(r.diff)}">${getDiffStr(baseOff, r.off)}</span>
            </td>
            </tr>
        `;
        }).join('');
    
        sec.innerHTML = `
        <div class="wt-diff-table">
            <div class="wt-diff-table-title">시차 요약 (${CITIES[baseIdx].name} 기준)</div>
            <table>
            <thead>
                <tr>
                <th class="wt-diff-cell wt-diff-header" style="width:40%;text-align:left;">도시</th>
                <th class="wt-diff-cell wt-diff-header" style="width:30%;text-align:left;">UTC 오프셋</th>
                <th class="wt-diff-cell wt-diff-header" style="width:30%;text-align:left;">시차</th>
                </tr>
            </thead>
            <tbody>${rowsHTML}</tbody>
            </table>
        </div>
        `;
    }
    
    /** 업무 시간 타임라인 렌더링 */
    function renderOverlap() {
        const sec = document.getElementById('overlap-section');
        if (compCities.length === 0) { sec.innerHTML = ''; return; }
    
        const WORK_START = 9;
        const WORK_END = 18;
        const allCities = [baseIdx, ...compCities];
    
        const timelinesHTML = allCities.map(cityIdx => {
        const c = CITIES[cityIdx];
        const hoursHTML = Array.from({ length: 24 }, (_, h) => {
            const isWork = h >= WORK_START && h < WORK_END;
            const bg = isWork ? '#1D9E75' : '#ddeef8';
            const opacity = isWork ? '0.85' : '0.6';
            return `<div class="wt-hour-cell" style="background:${bg};opacity:${opacity};" title="${String(h).padStart(2,'0')}:00"></div>`;
        }).join('');
        return `
            <div class="wt-city-tl">
            <div class="wt-city-tl-label">${c.name}</div>
            <div class="wt-timeline">${hoursHTML}</div>
            </div>
        `;
        }).join('');
    
        sec.innerHTML = `
        <div class="wt-overlap">
            <div class="wt-overlap-title">업무 시간 타임라인 (현지 09:00–18:00 기준)</div>
            ${timelinesHTML}
            <div class="wt-timeline-label">
            <span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>24시</span>
            </div>
        </div>
        `;
    }
    
    /** 모든 시계 텍스트 업데이트 (1초마다 호출) */
    function updateClocks() {
        const base = CITIES[baseIdx];
        document.getElementById('base-time').textContent     = formatTime(base.tz);
        document.getElementById('base-city-name').textContent = base.name;
        document.getElementById('base-date').textContent     = formatDate(base.tz);
    
        document.querySelectorAll('.wt-city-time[data-tz]').forEach(el => {
        el.textContent = formatTime(el.dataset.tz);
        });
        document.querySelectorAll('.wt-city-date[data-tz]').forEach(el => {
        el.textContent = formatDate(el.dataset.tz);
        });
    }
    
    /** 전체 렌더링 (구조 변경 시 호출) */
    function renderAll() {
        renderBaseSelect();
        renderCities();
        renderAddSelect();
        renderDiffTable();
        renderOverlap();
        updateClocks();
    
        // 기존 타이머 클리어 후 재시작 (중복 방지)
        if (tickTimer) clearInterval(tickTimer);
        tickTimer = setInterval(updateClocks, 1000);
    }
    
    /* ── 초기화 ── */
    document.addEventListener('DOMContentLoaded', () => {
        renderAll();
    });

