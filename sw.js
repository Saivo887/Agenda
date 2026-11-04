// Agenda: rete prima (cosi' gli aggiornamenti arrivano subito), cache come riserva per l'uso offline.
const CACHE='agenda-v3';
const CORE=['/','/app.js?v=3','/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{const cp=r.clone(); caches.open(CACHE).then(c=>c.put(req,cp)); return r})));
    return;
  }
  if(url.origin!==location.origin) return;
  const key=req.mode==='navigate'?'/':req;
  e.respondWith(fetch(req).then(r=>{ if(r.ok){const cp=r.clone(); caches.open(CACHE).then(c=>c.put(key,cp))} return r}).catch(()=>caches.match(key)));
});
