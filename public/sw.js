/**
 * 킬 스위치 서비스워커.
 *
 * 이 도메인의 이전 제품이 /sw.js 에 서비스워커를 등록해 두었고, 그 등록이 방문자
 * 브라우저에 그대로 남아 캐시된 옛 화면을 띄울 수 있다 (실측: 2026-09-16~21 사이 549회 요청).
 * 404 를 주면 등록이 확실히 사라지지 않으므로, 캐시를 비우고 스스로 등록을 해제한 뒤
 * 열려 있는 탭을 새로 고친다. Everychain 자체는 서비스워커를 쓰지 않는다.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: "window" })) client.navigate(client.url);
  })());
});
