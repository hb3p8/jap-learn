const PREFIX=`kana:${new URL(self.registration.scope).pathname}:`;
const CACHE=PREFIX+'v4-private-genki';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 // Authentication and learning records must always reach the server.
 if(event.request.method!=='GET'||url.origin!==self.location.origin||/^\/(?:v1|auth)(?:\/|$)/.test(url.pathname)||url.pathname==='/health'||event.request.headers.has('Range'))return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.status===401||response.status===403||response.headers.get('X-Kana-Locked')==='1')event.waitUntil(caches.delete(CACHE));
  if(response.ok&&response.headers.get('X-Kana-Private')==='1'){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)));}
  return response;
 }).catch(async()=>await caches.match(event.request)||new Response('Нет соединения. Уже открытое занятие продолжит сохраняться на устройстве.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
});
