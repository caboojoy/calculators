/* ══════════════════════════════════════════════
   카메라 환율 인식 프록시 - Cloudflare Worker
   방어선: Origin → IP 분당 제한 → 크기 제한 → (KV) 일일 한도 → 모델 호출
   이미지·응답 본문은 저장·로깅하지 않음. 업스트림 오류 본문은 전달하지 않음.
   ══════════════════════════════════════════════ */

import {
    ERROR_STATUS, isOriginAllowed, validateRequest, buildAnthropicRequest,
    responseText, extractJson, sanitizeModelOutput, MinuteLimiter, checkDailyLimit,
} from './lib.mjs';

let limiter = null;

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
    };
}

function json(data, status, origin) {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
                      'X-Content-Type-Options': 'nosniff' };
    if (origin) Object.assign(headers, corsHeaders(origin));
    return new Response(JSON.stringify(data), { status, headers });
}

function fail(error, origin) {
    return json({ ok: false, error }, ERROR_STATUS[error] || 500, origin);
}

async function callModel(req, env) {
    const { body, headers } = buildAnthropicRequest(req, env);
    headers['x-api-key'] = env.ANTHROPIC_API_KEY;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Number(env.UPSTREAM_TIMEOUT_MS) || 55000);
    let res;
    try {
        res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers, body: JSON.stringify(body), signal: ctrl.signal,
        });
    } catch (_) {
        return { error: 'upstream_busy' };
    } finally {
        clearTimeout(timer);
    }
    if (res.status === 429 || res.status === 529 || res.status === 503) return { error: 'upstream_busy' };
    if (!res.ok) return { error: 'upstream' };      // 본문(오류 상세)은 읽지도, 전달하지도 않음
    const data = await res.json().catch(() => null);
    return responseText(data);
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin') || '';

        if (url.pathname === '/health' && request.method === 'GET') {
            return json({ ok: true }, 200, null);
        }
        if (url.pathname !== '/recognize') return json({ ok: false, error: 'bad_request' }, 404, null);

        // 1) Origin 허용 목록
        if (!isOriginAllowed(origin, env)) return fail('origin', null);
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
        if (request.method !== 'POST') return fail('bad_request', origin);

        // 2) IP별 분당 제한 (메모리)
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        if (!limiter) limiter = new MinuteLimiter(Number(env.PER_MINUTE_LIMIT) || 10);
        if (!limiter.hit(ip)) return fail('rate_limited', origin);

        // 3) 크기 제한 + 형식 검증
        const len = Number(request.headers.get('Content-Length') || 0);
        if (len > 2_600_000) return fail('too_large', origin);
        let text;
        try { text = await request.text(); } catch (_) { return fail('bad_request', origin); }
        const v = validateRequest(text);
        if (!v.ok) return fail(v.error, origin);

        // 설정 오류는 일반화된 오류로 응답 (상세 비노출)
        if (!env.ANTHROPIC_API_KEY) return fail('upstream', origin);

        // 4) (선택) KV 일일 한도
        try {
            if (!(await checkDailyLimit(env.RATE_KV, ip, env))) return fail('daily_limit', origin);
        } catch (_) { /* KV 장애 시 분당 제한만 적용 */ }

        // 5) 모델 호출 → JSON 추출 → 형식·범위 재검증
        const r = await callModel(v.value, env);
        if (r.error) return fail(r.error, origin);
        const parsed = extractJson(r.text);
        const out = sanitizeModelOutput(v.value.mode, parsed, v.value.hint);
        if (!out) return fail('parse', origin);
        return json(out, 200, origin);
    },
};
