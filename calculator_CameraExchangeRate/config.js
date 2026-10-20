/* 배포 설정 — API 키는 절대 여기에 넣지 마세요 (Worker 시크릿에만 보관) */
window.CAMFX_CONFIG = {
    // Cloudflare Worker 주소. 비우면 인식 기능 꺼짐 → 직접 입력만 사용
    PROXY_URL: 'https://camfx-proxy.caboojoy-cer.workers.dev',
    // 기기당 하루 인식 요청 소프트 한도 (서버 한도와 별개, 안내용)
    DAILY_SOFT_LIMIT: 40,
    // 전송 이미지: 긴 변 픽셀, JPEG 품질
    MAX_SIDE: 1024,
    JPEG_QUALITY: 0.8,
    // 인식 요청 타임아웃
    REQUEST_TIMEOUT_MS: 60000,
};

