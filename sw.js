// Agenda: rete prima (cosi' gli aggiornamenti arrivano subito), cache come riserva per l'uso offline. Notifiche dei promemoria.
const CACHE='memi-v16';
const CORE=['/','/app.js?v=16','/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)||url.hostname==='cdn.jsdelivr.net'){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{const cp=r.clone(); caches.open(CACHE).then(c=>c.put(req,cp)); return r})));
    return;
  }
  if(url.origin!==location.origin) return;
  const key=req.mode==='navigate'?'/':req;
  e.respondWith(fetch(req).then(r=>{ if(r.ok){const cp=r.clone(); caches.open(CACHE).then(c=>c.put(key,cp))} return r}).catch(()=>caches.match(key)));
});
self.addEventListener('push',e=>{
  let d={}; try{d=e.data.json()}catch(_){d={title:'Memi',body:e.data?e.data.text():''}}
  e.waitUntil(self.registration.showNotification(d.title||'Memi',{body:d.body||'',icon:'/icon-192.png',badge:'/icon-192.png',tag:d.tag,data:{day:d.day},vibrate:[80,40,80]}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close(); const day=(e.notification.data&&e.notification.data.day)||'';
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    for(const c of cs){ if('focus' in c){ c.postMessage({type:'goto',day}); return c.focus() } }
    return self.clients.openWindow('/?day='+day);
  }));
});
