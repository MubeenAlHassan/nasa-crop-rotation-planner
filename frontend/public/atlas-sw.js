/* Versioned self-contained offline shell. Never cache mutation requests or API responses. */
const CACHE='rotation-atlas-805a0cb22cbf37c1';
const CORE=["/atlas/app.js","/atlas/app.css","/atlas/iowa.json","/atlas/field-evidence.json","/atlas/field-evidence.geojson","/atlas/offline.html","/atlas/modis-context.json","/atlas/access-status.json","/atlas/access-attempt.json","/atlas/power-history.json","/atlas/landsat-seasons.json","/atlas/nasa-context.json","/atlas/nasa-season-index.json","/atlas/ecostress-index.json","/atlas/grace-index.json"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('rotation-atlas-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'&&url.pathname.startsWith('/atlas')) {
    event.respondWith(fetch(event.request).catch(()=>caches.match('/atlas/offline.html')));return;
  }
  if(url.pathname==='/atlas/nasa-season-index.json'){event.respondWith(caches.open(CACHE).then(async cache=>{try{const response=await fetch(event.request);if(!response.ok)throw Error('Index unavailable');await cache.put('/atlas/nasa-season-index.json',response.clone());return response;}catch{return await cache.match('/atlas/nasa-season-index.json')||new Response('Index unavailable',{status:503});}}));return;}
  if(CORE.includes(url.pathname)||url.pathname.startsWith('/atlas/raw/')||url.pathname.startsWith('/atlas/evidence-raw/')||url.pathname.startsWith('/atlas/history-maps/')||url.pathname.startsWith('/atlas/nasa-native/')) event.respondWith(caches.open(CACHE).then(async cache=>{const cached=await cache.match(event.request);if(cached)return cached;const response=await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response;}));
});
