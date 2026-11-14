/* Versioned self-contained offline shell. Never cache mutation requests or API responses. */
const CACHE='rotation-atlas-fef9bbc0a6a03216';
const CORE=['/atlas/offline.html','/atlas/app.js','/atlas/app.css','/atlas/iowa.json'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rotation-atlas-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'&&url.pathname.startsWith('/atlas')) {
    event.respondWith(fetch(event.request).catch(()=>caches.match('/atlas/offline.html')));return;
  }
  if(CORE.includes(url.pathname)||url.pathname.startsWith('/atlas/raw/')) event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(event.request);if(cached)return cached;const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;}));
});
