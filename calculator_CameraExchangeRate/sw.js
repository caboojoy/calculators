/* 카메라 환율 - 서비스 워커: 앱 셸 캐시 (환율 API·인식 프록시는 캐시하지 않음) */
'use strict';

const CACHE = 'camfx-shell-v1';
const SHELL = [
    './',
    'index.html',
    'style.css',
    'config.js',
    'core.js',
    'app.js',
    'icon.svg',
    'manifest.webmanifest',
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k.startsWith('camfx-') && k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;   // 환율 API·프록시 등 외부 요청은 그대로 네트워크

    // 앱 셸: 네트워크 우선(최신 배포 반영), 실패 시 캐시 → 오프라인에서도 직접 입력 사용 가능
    e.respondWith(
        fetch(req, { cache: 'no-cache' })   // HTTP 캐시 재검증 → 배포 직후에도 최신 파일
            .then(res => {
                if (res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(req, copy));
                }
                return res;
            })
            .catch(() => caches.match(req, { ignoreSearch: true })
                .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
            .then(res => res || new Response('', { status: 504 }))
    );
});
