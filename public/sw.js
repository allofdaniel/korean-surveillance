/**
 * Service Worker — kill switch (v14)
 *
 * 모바일 사용자가 옛 SW (v6~v13) cache 에 stuck 되어 검은 화면이 발생하는
 * 사례가 다수 보고됨. SW 캐싱 전략 자체가 실시간 NOTAM/항적 데이터에 부적합
 * 하므로, 이 SW 는 단 한 가지 일만 한다:
 *   1. 모든 cache 삭제
 *   2. 모든 client claim 후 navigate(reload) 한 번
 *   3. 자기 자신 unregister
 *
 * 결과: 옛 SW 가진 사용자는 v14 가 한 번 설치된 후 SW 가 영구 사라지고
 * 일반 웹앱으로 동작. 새 사용자는 SW 등록 자체가 install 직후 사라지므로
 * stale cache 위험이 원천 제거됨.
 *
 * 향후 PWA 오프라인 지원이 필요할 때 다시 도입하되, App Shell 사전 캐싱
 * 패턴 (deploy 후 stale bundle hash) 은 절대 사용 금지.
 */
/* global self, caches, location */

self.addEventListener('install', (event) => {
  // 즉시 활성화로 진입 — waiting 단계 skip
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1. 모든 cache 삭제 (옛 v6~v13 cache 포함)
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* ignore */ }

    // 2. 모든 client claim
    try { await self.clients.claim(); } catch (e) { /* ignore */ }

    // 3. 모든 열린 client 에게 reload 명령 — stale bundle 즉시 새로고침
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        try { client.navigate(client.url); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }

    // 4. 자기 자신 unregister — 다음 navigation 부터는 SW 없는 일반 웹앱
    try { await self.registration.unregister(); } catch (e) { /* ignore */ }
  })());
});

// fetch 이벤트는 의도적으로 처리하지 않음 — 모든 요청이 network 직통.
// (handler 등록 자체가 없으면 브라우저가 SW 우회)
