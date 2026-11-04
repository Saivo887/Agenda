(function(){
const GG=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
const GS=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const GL=['D','L','M','M','G','V','S'];
const MM=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAYC=[['#e8382f','#ffffff'],['#ff6a3d','#ffffff'],['#f2b01e','#2a1d00'],['#13a47f','#ffffff'],['#2f6fff','#ffffff'],['#d63c86','#ffffff'],['#6f55ff','#ffffff']];
const FIX={'1-1':'Capodanno','1-6':'Epifania','4-25':'Liberazione','5-1':'Festa del Lavoro','6-2':'Festa della Repubblica','8-15':'Ferragosto','11-1':'Ognissanti','12-8':'Immacolata','12-25':'Natale','12-26':'Santo Stefano'};
const H0=6, H1=23; const HOURS=[];for(let h=H0;h<=H1;h++)HOURS.push(h);
const KEY='agenda-sfogliabile-v2';

const book=document.getElementById('book'), stage=document.getElementById('stage'), root=document.documentElement;
const T0=new Date(); T0.setHours(0,0,0,0);
let idx=0, cur=null, flip=null, mode='type', penSeen=false, zoom=1, lastW=0, locked=false, longT=0;
const TOOLS={pen:{n:'Penna',sizes:[.0026,.0045,.0075]},pencil:{n:'Matita',sizes:[.003,.005,.0085]},marker:{n:'Pennarello',sizes:[.009,.015,.024]},hl:{n:'Evidenziatore',sizes:[.028,.042,.06]}};
const PALETTE=['1','2','3','#0b7a5a','#13a47f','#7cc242','#f2b01e','#ff8a00','#e8382f','#d63c86','#9b51e0','#5b6cff','#00a3c4','#8a5a3c','#6b7280','#000000','#ffffff'];
const PNAMES={'1':'Blu','2':'Inchiostro','3':'Rosso','#0b7a5a':'Verde bosco','#13a47f':'Verde','#7cc242':'Lime','#f2b01e':'Giallo','#ff8a00':'Arancio','#e8382f':'Rosso vivo','#d63c86':'Fucsia','#9b51e0':'Viola','#5b6cff':'Indaco','#00a3c4':'Azzurro','#8a5a3c':'Marrone','#6b7280':'Grigio','#000000':'Nero','#ffffff':'Bianco'};
let pref={tool:'pen',color:'1',size:1,sound:true,voice:true,cover:true,remind:60};
try{Object.assign(pref,JSON.parse(localStorage.getItem('agenda-pref')||'{}'))}catch(e){}
function savePref(){try{localStorage.setItem('agenda-pref',JSON.stringify(pref))}catch(e){}}
let gesture=null, drawing=null, pinch=null; const ptrs=new Map(); const undoMap={};

// ---- Dati ----
let store={};
try{store=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){store={}}
if(!Object.keys(store).length){
  try{const v1=JSON.parse(localStorage.getItem('agenda-sfogliabile-v1')||'{}');
    for(const k in v1){const o=v1[k], h={}; (o.t||'').split('\n').forEach((l,j)=>{if(l.trim()&&j<HOURS.length)h[HOURS[j]]=l});
      store[k]={h,n:'',s:(o.s||[]).map(s=>({c:s.c==='nero'?'2':s.c==='rosso'?'3':'1',w:s.w,p:s.p.map(q=>[q[0],q[1]/.7,q[2]])}))}}}catch(e){}
}
if(!Object.keys(store).length) store[keyOf(T0)]={h:{9:'Riunione di reparto (esempio)',13:'Pranzo (esempio, cancella pure)'},n:'',s:[],ex:1};
const META='1970-01-01';
function meta(){return store[META]||(store[META]={})}
let dirty=new Set(); try{dirty=new Set(JSON.parse(localStorage.getItem('agenda-dirty')||'[]'))}catch(e){}
let saveT; function save(k){ if(k){ if(store[k]) store[k].u=Date.now(); dirty.add(k); updateDot() }
  clearTimeout(saveT); saveT=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(store)); localStorage.setItem('agenda-dirty',JSON.stringify([...dirty]))}catch(e){} if(k) schedulePush()},300)}
function dataFor(k){let d=store[k]; if(!d) return {h:{},n:'',s:[]}; d.h=d.h||{}; d.n=d.n||''; d.s=d.s||[]; return d}
function commit(sh){store[sh.key]=sh.data; save(sh.key)}

// ---- Date ----
function dateOf(i){return new Date(T0.getFullYear(),T0.getMonth(),T0.getDate()+i)}
function idxOf(d){return Math.round((d-T0)/864e5)}
function keyOf(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da)}
function holiday(d){const f=FIX[(d.getMonth()+1)+'-'+d.getDate()]; if(f) return f; const e=easter(d.getFullYear());
  if(+d===+e) return 'Pasqua'; const p=new Date(e); p.setDate(p.getDate()+1); return +d===+p?'Pasquetta':''}
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil(((t-y0)/864e5+1)/7)}
function doy(d){return Math.round((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-Date.UTC(d.getFullYear(),0,1))/864e5)+1}
function ylen(y){return (y%4===0&&y%100!==0)||y%400===0?366:365}
function colorOf(d){return (d.getDay()===0||holiday(d))?DAYC[0]:DAYC[d.getDay()]}
function inkColor(c){return getComputedStyle(root).getPropertyValue('--ink-'+c).trim()||'#2350d8'}

// ---- Pagina ----
function grow(ta){ta.style.height='0px'; ta.style.height=ta.scrollHeight+'px'}
function mountSheet(i,before){
  const d=dateOf(i), k=keyOf(d), hol=holiday(d), [bg,fg]=colorOf(d), n=doy(d), tot=ylen(d.getFullYear());
  const isToday=i===0, nowH=new Date().getHours();
  const mon=new Date(d); mon.setDate(d.getDate()-((d.getDay()+6)%7));
  let week=''; for(let j=0;j<7;j++){const w=new Date(mon); w.setDate(mon.getDate()+j); const wi=idxOf(w);
    week+=`<button class="chip${wi===i?' on':''}${wi===0?' today':''}${(w.getDay()===0||holiday(w))?' red':''}" data-i="${wi}" aria-label="${GG[w.getDay()]} ${w.getDate()}"><span>${GL[w.getDay()]}</span><strong>${w.getDate()}</strong></button>`}
  const C=2*Math.PI*15.5, prog=n/tot;
  const el=document.createElement('div'); el.className='sheet';
  el.innerHTML=`<div class="face front" style="--day:${bg};--day-ink:${fg}">
    <div class="band"><div class="bnum">${d.getDate()}</div>
      <div><div class="bdow">${GG[d.getDay()]}</div><div class="bmon">${MM[d.getMonth()]} ${d.getFullYear()} · Sett. ${isoWeek(d)}</div>${hol?`<span class="bhol">${hol}</span>`:''}</div>
      <div class="ring" title="Giorno ${n} di ${tot}"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-opacity=".25" stroke-width="3"/><circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(C*prog).toFixed(2)} ${C.toFixed(2)}"/></svg><b>${n}<small>−${tot-n}</small></b></div></div>
    <button class="wk-toggle" type="button" aria-label="Mostra o nascondi la settimana">Settimana ${isoWeek(d)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg></button>
    <div class="week">${week}</div>
    <div class="carry" hidden></div>
    <div class="slots">${HOURS.map(h=>`<div class="row${isToday&&h===nowH?' now':''}" data-h="${h}"><span class="hr">${String(h).padStart(2,'0')}:00</span><textarea class="t" data-h="${h}" rows="1" spellcheck="false" aria-label="Ore ${h}"></textarea><span class="bell" hidden></span></div>`).join('')}</div>
    <div class="notes"><div class="nl">Note</div><textarea class="t" data-h="n" spellcheck="false" aria-label="Note"></textarea></div>
    <div class="photos"></div><canvas class="ink"></canvas><canvas class="live"></canvas><div class="fold"></div><div class="ribbon" hidden></div><div class="shade"></div></div>
    <div class="face back"><div class="shade"></div></div>`;
  book.insertBefore(el,before||null);
  const front=el.querySelector('.front');
  const sh={el,front,idx:i,key:k,data:dataFor(k),canvas:el.querySelector('canvas.ink'),live:el.querySelector('canvas.live'),tas:[...el.querySelectorAll('textarea')],
    shF:front.querySelector('.shade'),shB:el.querySelector('.back .shade'),color:[bg,fg]};
  sh.tas.forEach(ta=>{const h=ta.dataset.h; ta.value=h==='n'?sh.data.n:(sh.data.h[h]||'');
    ta.addEventListener('input',()=>{ if(h==='n') sh.data.n=ta.value; else { if(ta.value) sh.data.h[h]=ta.value; else delete sh.data.h[h]; bellFor(sh,h) } grow(ta); commit(sh)})});
  el.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>goTo(+c.dataset.i)));
  el.querySelector('.wk-toggle').addEventListener('click',()=>{const on=book.classList.toggle('week-open');
    el.querySelector('.wk-toggle').setAttribute('aria-expanded',on); try{localStorage.setItem(KEY+'-week',on?'1':'0')}catch(e){}});
  el.querySelector('.wk-toggle').setAttribute('aria-expanded',book.classList.contains('week-open'));
  decorate(sh); refresh(sh); applyHits(sh); renderPhotos(sh);
  let raf=0, lastH=0;
  sh.ro=new ResizeObserver(()=>{cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{ if(front.clientHeight!==lastH||front.clientWidth!==sh.W){lastH=front.clientHeight; sizeCanvas(sh); redraw(sh); fitBook()} })});
  sh.ro.observe(front);
  return sh;
}
function removeSheet(sh){sh.ro&&sh.ro.disconnect(); sh.el.remove()}
function refresh(sh){sh.tas.forEach(grow); sizeCanvas(sh); redraw(sh)}
function sizeCanvas(sh){
  const W=sh.front.clientWidth, H=sh.front.clientHeight; let dpr=Math.min(window.devicePixelRatio||1,3);
  dpr=Math.min(dpr,Math.sqrt(14e6/Math.max(1,W*H)));
  sh.W=W; sh.H=H; sh.canvas.style.width=W+'px'; sh.canvas.style.height=H+'px';
  sh.canvas.width=Math.max(1,Math.round(W*dpr)); sh.canvas.height=Math.max(1,Math.round(H*dpr));
  sh.ctx=sh.canvas.getContext('2d'); sh.ctx.setTransform(dpr,0,0,dpr,0,0); sh.ctx.lineCap='round'; sh.ctx.lineJoin='round';
  sh.live.style.width=W+'px'; sh.live.style.height=H+'px'; sh.live.width=sh.canvas.width; sh.live.height=sh.canvas.height;
  sh.lctx=sh.live.getContext('2d'); sh.lctx.setTransform(dpr,0,0,dpr,0,0)}
function colorFor(c){return c&&c[0]==='#'?c:inkColor(c||'1')}
function isDark(){const t=root.getAttribute('data-theme'); return t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches}
function lw(sh,s,q){const W=sh.W, t=s.t||'pen';
  if(t==='marker'||t==='hl') return Math.max(1,s.w*W);
  if(t==='pencil') return Math.max(.6,s.w*W*(.7+.6*q[2]));
  return Math.max(.6,s.w*W*(.55+.9*q[2]))}
function hash(i,k){const x=Math.sin(i*12.9898+k*78.233)*43758.5453; return x-Math.floor(x)}
function seg(sh,s,i,ctx){const a=s.p[i-1],b=s.p[i],c=ctx||sh.ctx,W=sh.W,t=s.t||'pen',w=lw(sh,s,b);
  const ax=a[0]*W, ay=a[1]*W, bx=b[0]*W, by=b[1]*W; c.strokeStyle=colorFor(s.c);
  if(t==='pencil'){
    c.globalAlpha=.62; c.lineWidth=w; c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx,by); c.stroke();
    c.globalAlpha=.35; c.lineWidth=Math.max(.5,w*.35);
    for(let k=0;k<2;k++){const ox=(hash(i,k)-.5)*w*.9, oy=(hash(i,k+7)-.5)*w*.9; c.beginPath(); c.moveTo(ax+ox,ay+oy); c.lineTo(bx+ox,by+oy); c.stroke()}
    c.globalAlpha=1; return}
  c.lineWidth=w; c.beginPath(); c.moveTo(ax,ay); c.lineTo(bx,by); c.stroke()}
function dot(sh,s,ctx){const a=s.p[0],c=ctx||sh.ctx; c.fillStyle=colorFor(s.c); if(s.t==='pencil') c.globalAlpha=.62;
  c.beginPath(); c.arc(a[0]*sh.W,a[1]*sh.W,lw(sh,s,a)/2,0,7); c.fill(); c.globalAlpha=1}
function hlPath(sh,s,c){const W=sh.W; c.save(); c.globalAlpha=isDark()?.45:.38; c.globalCompositeOperation=isDark()?'screen':'multiply';
  c.strokeStyle=colorFor(s.c); c.lineWidth=lw(sh,s,s.p[0]); c.lineCap='butt'; c.lineJoin='round';
  c.beginPath(); c.moveTo(s.p[0][0]*W,s.p[0][1]*W); if(s.p.length===1) c.lineTo(s.p[0][0]*W+1,s.p[0][1]*W); else for(let i=1;i<s.p.length;i++) c.lineTo(s.p[i][0]*W,s.p[i][1]*W);
  c.stroke(); c.restore()}
function drawStroke(sh,s,ctx){ if(s.t==='hl') return hlPath(sh,s,ctx||sh.ctx); if(s.p.length===1) dot(sh,s,ctx); else for(let i=1;i<s.p.length;i++) seg(sh,s,i,ctx)}
function redraw(sh){if(!sh.ctx)return; sh.ctx.clearRect(0,0,sh.W,sh.H); for(const s of sh.data.s) drawStroke(sh,s)}
function fitBook(){let h=0; book.querySelectorAll('.sheet').forEach(s=>h=Math.max(h,s.offsetHeight)); book.style.height=h+'px'}
function setDay(sh){root.style.setProperty('--day',sh.color[0]); root.style.setProperty('--day-ink',sh.color[1])}

// ---- Layout e zoom ----
function stageInner(){const cs=getComputedStyle(stage); return stage.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)}
function layout(){
  const W=Math.round(Math.min(stageInner(),600)*zoom);
  book.style.width=W+'px'; book.style.setProperty('--pw',W+'px');
  book.querySelectorAll('.sheet').forEach(()=>{}); if(cur) refresh(cur); if(flip){refresh(flip.leaf===cur?flip.under:flip.leaf)} fitBook();
}
function setZoom(z,cx,cy){
  z=Math.max(.6,Math.min(3,z)); if(Math.abs(z-zoom)<.001) return;
  const r0=book.getBoundingClientRect(); const u=(cx-r0.left)/r0.width, v=(cy-r0.top)/r0.width;
  zoom=z; layout();
  const r1=book.getBoundingClientRect(); stage.scrollLeft+=r1.left+u*r1.width-cx; stage.scrollTop+=r1.top+v*r1.width-cy;
}
function stageCenter(){const r=stage.getBoundingClientRect(); return [r.left+r.width/2, r.top+r.height/3]}
new ResizeObserver(()=>{const w=stage.clientWidth; if(w!==lastW){lastW=w; layout()}}).observe(stage);
stage.addEventListener('wheel',e=>{ if(e.ctrlKey||e.metaKey){e.preventDefault(); setZoom(zoom*Math.exp(-e.deltaY*.01),e.clientX,e.clientY)} },{passive:false});

// ---- Sfoglio ----
function setP(p){flip.p=p; const ang=flip.dir>0?-180*p:-180*(1-p), a=Math.abs(ang);
  flip.leaf.el.style.transform=`rotateY(${ang}deg)`;
  flip.leaf.shF.style.opacity=(Math.min(1,a/90)*.45).toFixed(3);
  flip.leaf.shB.style.opacity=(Math.max(0,(180-a)/90)*.25).toFixed(3);
  flip.under.shF.style.opacity=((1-a/180)*.55).toFixed(3)}
function startFlip(dir,target){
  if(flip) return false; target=target??idx+dir;
  if(document.activeElement&&document.activeElement.blur) document.activeElement.blur();
  if(dir>0){const under=mountSheet(target,cur.el); flip={dir,leaf:cur,under,target}}
  else{const leaf=mountSheet(target,null); flip={dir,leaf,under:cur,target}}
  flip.leaf.el.style.zIndex=2; fitBook(); setP(0); return true}
function endFlip(done){
  const f=flip; if(!f||f.ending) return; f.ending=true;
  [f.leaf.el,f.under.el].forEach(e=>e.classList.add('anim'));
  [f.under.shF,f.leaf.shF,f.leaf.shB].forEach(s=>s.style.transition='opacity var(--dur)');
  setP(done?1:0); if(done){setDay(f.dir>0?f.under:f.leaf); pageSound(f.dir)}
  const ms=(parseFloat(getComputedStyle(root).getPropertyValue('--dur'))||0)*1000;
  setTimeout(()=>{
    if(done){ if(f.dir>0){removeSheet(f.leaf); cur=f.under} else {removeSheet(f.under); cur=f.leaf} idx=f.target; stage.scrollTop=0 }
    else { if(f.dir>0) removeSheet(f.under); else removeSheet(f.leaf) }
    cur.el.classList.remove('anim'); cur.el.style.transform=''; cur.el.style.zIndex='';
    cur.el.querySelectorAll('.shade').forEach(s=>{s.style.opacity=0; s.style.transition=''});
    flip=null; fitBook(); updateLabel();
  },ms+30);
}
function animateFlip(dir,target){ if(startFlip(dir,target)) requestAnimationFrame(()=>requestAnimationFrame(()=>endFlip(true))) }
function goTo(t){ if(t===idx||flip) return; animateFlip(t>idx?1:-1,t) }

// ---- Gesti: disegno, sfoglio, scorrimento, pinch ----
function ptOf(e,rc){const pr=e.pointerType==='pen'?(e.pressure||.5):.5; return [+((e.clientX-rc.left)/rc.width).toFixed(4),+((e.clientY-rc.top)/rc.width).toFixed(4),+pr.toFixed(2)]}
function eraseAt(sh,pt){const R=14, px=pt[0]*sh.W, py=pt[1]*sh.W, n=sh.data.s.length;
  sh.data.s=sh.data.s.filter(s=>!s.p.some(q=>Math.hypot(q[0]*sh.W-px,q[1]*sh.W-py)<R)); if(sh.data.s.length!==n){drawing.hit=true; redraw(sh)}}
function pushUndo(sh){(undoMap[sh.key]=undoMap[sh.key]||[]).push(JSON.stringify(sh.data.s)); if(undoMap[sh.key].length>80) undoMap[sh.key].shift()}
function cancelDrawing(){ if(!drawing) return; if(drawing.sh.lctx) drawing.sh.lctx.clearRect(0,0,drawing.sh.W,drawing.sh.H); const st=undoMap[drawing.sh.key]; if(st&&st.length){drawing.sh.data.s=JSON.parse(st.pop()); redraw(drawing.sh)} drawing=null }
function visRect(){const b=book.getBoundingClientRect(), s=stage.getBoundingClientRect(); return {left:Math.max(b.left,s.left),right:Math.min(b.right,s.right)}}

stage.addEventListener('pointerdown',e=>{
  if(e.target.closest('.chip,.wk-toggle,.carry')) return;
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(e.pointerType==='pen') penSeen=true;
  wakeAudio(); if(!kit.hidden) closeKit();
  if(ptrs.size===2){
    clearTimeout(longT); const ps=[...ptrs.values()]; cancelDrawing();
    if(gesture&&gesture.axis==='x'&&flip) endFlip(false); gesture=null;
    if(flip) return;
    const r=book.getBoundingClientRect(), mx=(ps[0].x+ps[1].x)/2, my=(ps[0].y+ps[1].y)/2;
    pinch={d0:Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)||1,mx0:mx,my0:my,ox:mx-r.left,oy:my-r.top,u:(mx-r.left)/r.width,v:(my-r.top)/r.width,z0:zoom,sx:stage.scrollLeft,sy:stage.scrollTop,r:1,mx,my};
    book.style.transformOrigin=`${pinch.ox}px ${pinch.oy}px`; e.preventDefault(); return;
  }
  if(ptrs.size>2||flip||pinch) return;
  try{stage.setPointerCapture(e.pointerId)}catch(_){}
  const onCanvas=e.target.classList.contains('ink');
  const vr=visRect(), edgeW=Math.max(30,Math.min(56,(vr.right-vr.left)*.08));
  const phEl=e.target.closest('.ph');
  if(!phEl) selectPhoto(null);
  if(phEl&&!locked&&mode==='type'){ e.preventDefault(); startPhoto(e,phEl); return }
  const special=locked?null:hitSpecial(e);
  if(special){ e.preventDefault();
    gesture={id:e.pointerId,x0:e.clientX,y0:e.clientY,axis:null,dir:0,edge:0,w:Math.max(200,vr.right-vr.left),moved:0,sx:stage.scrollLeft,sy:stage.scrollTop,onTA:false,special};
    return }
  if(locked){
    e.preventDefault();
    gesture={id:e.pointerId,x0:e.clientX,y0:e.clientY,axis:null,dir:0,edge:0,w:Math.max(200,vr.right-vr.left),moved:0,sx:stage.scrollLeft,sy:stage.scrollTop,onTA:false,lock:true,t0:performance.now(),vl:vr.left};
    clearTimeout(longT); longT=setTimeout(()=>{ if(gesture&&gesture.lock&&gesture.moved<10&&!gesture.axis){gesture=null; try{navigator.vibrate&&navigator.vibrate(25)}catch(_){} setLock(false)} },750);
    return;
  }
  const inBook=!!e.target.closest('.book');
  const onEdge=inBook?(e.clientX>vr.right-edgeW?1:e.clientX<vr.left+edgeW?-1:0):0;
  if(onCanvas&&!onEdge&&!(penSeen&&e.pointerType==='touch')&&(mode==='pen'||mode==='erase')){
    e.preventDefault(); const sh=cur, rc=sh.canvas.getBoundingClientRect(); pushUndo(sh); const pt=ptOf(e,rc);
    if(mode==='erase'){drawing={sh,rc,erase:true,hit:false,id:e.pointerId}; eraseAt(sh,pt)}
    else{const s={t:pref.tool,c:pref.color,w:TOOLS[pref.tool].sizes[pref.size],p:[pt]}; sh.data.s.push(s); if(s.t==='hl') hlPath(sh,s,sh.lctx); else dot(sh,s); drawing={sh,rc,s,id:e.pointerId}}
    return;
  }
  const onTA=e.target.tagName==='TEXTAREA';
  if(onTA&&e.pointerType==='mouse') return;
  gesture={id:e.pointerId,x0:e.clientX,y0:e.clientY,axis:null,dir:0,edge:onEdge,w:Math.max(200,vr.right-vr.left),moved:0,sx:stage.scrollLeft,sy:stage.scrollTop,onTA};
  if(!onTA) e.preventDefault();
});
stage.addEventListener('pointermove',e=>{
  if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(phDrag&&e.pointerId===phDrag.id){movePhoto(e); return}
  if(pinch&&ptrs.size>=2){const ps=[...ptrs.values()], d=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);
    const z=Math.max(.6,Math.min(3,pinch.z0*d/pinch.d0)); pinch.r=z/pinch.z0; pinch.mx=(ps[0].x+ps[1].x)/2; pinch.my=(ps[0].y+ps[1].y)/2;
    book.style.transform=`translate(${pinch.mx-pinch.mx0}px,${pinch.my-pinch.my0}px) scale(${pinch.r})`; return}
  if(drawing&&e.pointerId===drawing.id){
    const evs=(e.getCoalescedEvents&&e.getCoalescedEvents())||[]; for(const ev of (evs.length?evs:[e])){const pt=ptOf(ev,drawing.rc);
      if(drawing.erase) eraseAt(drawing.sh,pt);
      else{const s=drawing.s,l=s.p[s.p.length-1]; if(Math.hypot(pt[0]-l[0],pt[1]-l[1])*drawing.sh.W<1.2) continue;
        if(e.pointerType==='pen') pt[2]=+(l[2]*.6+pt[2]*.4).toFixed(2); s.p.push(pt);
        if(s.t==='hl'){const sh=drawing.sh; sh.lctx.clearRect(0,0,sh.W,sh.H); hlPath(sh,s,sh.lctx)} else seg(drawing.sh,s,s.p.length-1)}}
    return}
  if(gesture&&e.pointerId===gesture.id){
    const dx=e.clientX-gesture.x0, dy=e.clientY-gesture.y0; gesture.moved=Math.max(gesture.moved,Math.hypot(dx,dy)); if(gesture.moved>=10) clearTimeout(longT);
    if(!gesture.axis){ if(gesture.moved<10) return;
      if(Math.abs(dx)>Math.abs(dy)*1.3&&!(stage.scrollWidth>stage.clientWidth+2&&!gesture.edge)){gesture.axis='x'; gesture.dir=dx<0?1:-1; if(!startFlip(gesture.dir)){gesture.axis='pan'}}
      else gesture.axis='pan';
      if(gesture.onTA&&document.activeElement) document.activeElement.blur();
    }
    if(gesture.axis==='x') setP(Math.max(0,Math.min(1,(gesture.dir>0?-dx:dx)/(gesture.w*.9))));
    else {stage.scrollTop=gesture.sy-dy; stage.scrollLeft=gesture.sx-dx}
  }
});
function release(e){
  ptrs.delete(e.pointerId); if(!gesture) clearTimeout(longT);
  if(phDrag&&e.pointerId===phDrag.id){endPhoto(); return}
  if(pinch){ if(ptrs.size<2){const p=pinch; pinch=null; book.style.transform=''; book.style.transformOrigin='';
      zoom=Math.max(.6,Math.min(3,p.z0*p.r)); layout(); const r1=book.getBoundingClientRect();
      stage.scrollLeft+=r1.left+p.u*r1.width-p.mx; stage.scrollTop+=r1.top+p.v*r1.width-p.my; ptrs.clear()} return }
  if(drawing&&e.pointerId===drawing.id){const d=drawing; drawing=null; if(d.s&&d.s.t==='hl'){d.sh.lctx.clearRect(0,0,d.sh.W,d.sh.H); hlPath(d.sh,d.s,d.sh.ctx)} if(d.erase&&!d.hit) undoMap[d.sh.key].pop(); commit(d.sh)}
  if(gesture&&e.pointerId===gesture.id){const g=gesture; gesture=null; clearTimeout(longT);
    if(g.axis==='x') endFlip((flip?flip.p:0)>.28);
    else if(!g.axis&&g.special&&g.moved<8) doSpecial(g.special);
    else if(!g.axis&&g.edge&&g.moved<8) animateFlip(g.edge);
    else if(!g.axis&&g.lock&&g.moved<8&&performance.now()-g.t0<400){const r=(e.clientX-g.vl)/g.w; if(r>.65) animateFlip(1); else if(r<.35) animateFlip(-1); showUnlock()}
  }
}
stage.addEventListener('pointerup',release); stage.addEventListener('pointercancel',release);

// ---- Controlli ----
const dateTxt=document.getElementById('dateTxt'), datePick=document.getElementById('datePick');
function updateLabel(){const d=dateOf(idx); dateTxt.textContent=`${GS[d.getDay()]} ${d.getDate()} ${MM[d.getMonth()].slice(0,3)}${d.getFullYear()!==T0.getFullYear()?' '+d.getFullYear():''}`; datePick.value=keyOf(d); afterNav()}
datePick.addEventListener('change',()=>{if(!datePick.value) return; const [y,m,dd]=datePick.value.split('-').map(Number); closeSheet(idxScrim); goTo(idxOf(new Date(y,m-1,dd)))});
document.getElementById('prev').onclick=()=>animateFlip(-1);
document.getElementById('next').onclick=()=>animateFlip(1);
document.getElementById('today').onclick=()=>goTo(0);
const modes={pen:'m-pen',type:'m-type',erase:'m-erase'};
function setMode(m){mode=m; book.classList.remove('mode-pen','mode-type','mode-erase'); book.classList.add('mode-'+m);
  for(const k in modes) document.getElementById(modes[k]).setAttribute('aria-pressed',k===m);
  if(m!=='type'&&document.activeElement&&document.activeElement.blur) document.activeElement.blur()}
for(const k in modes) document.getElementById(modes[k]).onclick=()=>setMode(k);
document.getElementById('undo').onclick=()=>{
  if(mode==='type'){const a=document.activeElement; if(a&&a.tagName==='TEXTAREA'){try{document.execCommand('undo')}catch(e){}} return}
  const st=undoMap[cur.key]; if(!st||!st.length) return; cur.data.s=JSON.parse(st.pop()); redraw(cur); commit(cur)};
document.getElementById('undo').addEventListener('pointerdown',e=>{if(mode==='type')e.preventDefault()});
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT') return;
  if(e.key==='ArrowRight') animateFlip(1); else if(e.key==='ArrowLeft') animateFlip(-1);
  else if((e.ctrlKey||e.metaKey)&&(e.key==='+'||e.key==='=')){e.preventDefault(); setZoom(zoom*1.25,...stageCenter())}
  else if((e.ctrlKey||e.metaKey)&&e.key==='-'){e.preventDefault(); setZoom(zoom/1.25,...stageCenter())}
  else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault(); document.getElementById('undo').click()}
});
const rd=()=>{if(cur) redraw(cur)};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',rd);
new MutationObserver(rd).observe(root,{attributes:true,attributeFilter:['data-theme']});

// ---- Avvisi ----
const toastEl=document.getElementById('toast'), toastMsg=document.getElementById('toastMsg'), toastBtn=document.getElementById('toastBtn'); let toastT;
function toast(html,action,ms){toastMsg.innerHTML=html; toastBtn.hidden=!action; toastBtn.onclick=()=>{toastEl.classList.add('hide'); action&&action()};
  toastEl.classList.remove('hide'); clearTimeout(toastT); toastT=setTimeout(()=>toastEl.classList.add('hide'),ms||6000)}

// ---- Interpretazione della frase ----
const POLITE='(?:(?:ehi|ok|hey)\\s+agenda\\s*,?\\s*)?(?:per\\s+(?:favore|piacere)\\s*,?\\s*)?(?:(?:mi\\s+|me\\s+)?(?:puoi|potresti|riesci\\s+a|vorrei\\s+che|voglio\\s+che|devi)\\s+)?(?:mi\\s+|me\\s+|ti\\s+)?';
const CLITIC='(?:mi|ti|ci|lo|la|le|li|ne|melo|mela|telo|celo|glielo)?';
const ADDV='(?:aggiung|inser(?:isc)?|mett|scriv|ricord|segn|annot|appunt|fiss|prenot|programm|pianific|memorizz|salv|registr|cre|organizz)(?:are|ere|ire|ar|er|ir|ati|iamo|a|i|e|o)'+CLITIC;
const ADDV2='(?:'+ADDV+'|not(?:are|ar|a)'+CLITIC+')';
const DELV='(?:annull(?:are|ar|a|i)|cancell(?:are|ar|a|i)|elimin(?:are|ar|a|i)|togli(?:ere|er)?|rimuov(?:ere|er|i)|lev(?:are|ar|a)|scancell(?:are|ar|a)|disdic(?:ere|er|i)|butt(?:are|ar|a)\\s+via)'+CLITIC;
const ADD_RE=new RegExp('^\\s*'+POLITE+ADDV2+'\\b\\s*(?:(?:in|nell\'|sull\'|all\')\\s*agenda\\b\\s*)?(?:(?:che|di)\\s+)?(?:(?:un|uno|una|un\'|il|lo|la|l\'|i|gli|le)\\s*)?','i');
const DEL_RE=new RegExp('^\\s*'+POLITE+DELV+'\\b\\s*','i');
const MREX='gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre';
const WD=[['domenica'],['lunedì','lunedi'],['martedì','martedi'],['mercoledì','mercoledi'],['giovedì','giovedi'],['venerdì','venerdi'],['sabato']];
const WREX=WD.flat().join('|');
const NUMW={un:1,uno:1,una:1,due:2,tre:3,quattro:4,cinque:5,sei:6,sette:7,otto:8,nove:9,dieci:10,undici:11,dodici:12,primo:1};
function parseLocal(src){
  let s=' '+src.replace(/[!?]/g,' ').replace(/\s+/g,' ')+' ';
  const cut=re=>{const m=s.match(re); if(m) s=s.replace(m[0],' '); return m};
  let date=null, found=false, wdSaid=null, hour=null, minute=null;
  const today=new Date(T0);
  // tra N giorni / settimane
  let m=cut(new RegExp('\\b(?:tra|fra)\\s+(\\d+|'+Object.keys(NUMW).join('|')+')\\s+(giorni|giorno|settimane|settimana)\\b','i'));
  if(m){const n=isNaN(m[1])?NUMW[m[1].toLowerCase()]:+m[1]; date=new Date(today); date.setDate(date.getDate()+n*(/settiman/i.test(m[2])?7:1)); found=true}
  // 25 novembre [2026]
  if(!found&&(m=cut(new RegExp('\\b(?:il\\s+|giorno\\s+)?(\\d{1,2}|primo)\\s*(?:di\\s+)?('+MREX+')(?:\\s+(\\d{4}))?\\b','i')))){
    const dd=m[1].toLowerCase()==='primo'?1:+m[1], mo=MREX.split('|').indexOf(m[2].toLowerCase());
    let y=m[3]?+m[3]:today.getFullYear(); date=new Date(y,mo,dd); if(!m[3]&&date<today) date=new Date(y+1,mo,dd); found=true}
  // 25/11[/2026]
  if(!found&&(m=cut(/\b(?:il\s+)?(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/))){
    let y=m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):today.getFullYear(); date=new Date(y,+m[2]-1,+m[1]); if(!m[3]&&date<today) date=new Date(y+1,+m[2]-1,+m[1]); found=true}
  if(!found&&(m=cut(/\bdopodomani\b/i))){date=new Date(today); date.setDate(date.getDate()+2); found=true}
  if(!found&&(m=cut(/\bdomani\b/i))){date=new Date(today); date.setDate(date.getDate()+1); found=true}
  if(!found&&(m=cut(/\b(?:per\s+)?oggi\b/i))){date=new Date(today); found=true}
  // giorno della settimana
  m=cut(new RegExp('\\b(?:per\\s+)?(?:il\\s+|la\\s+)?('+WREX+')(?:\\s+prossim[oa])?(?=\\s|$)','i'));
  if(m){wdSaid=WD.findIndex(a=>a.includes(m[1].toLowerCase()));
    if(!found){date=new Date(today); let add=(wdSaid-date.getDay()+7)%7; if(add===0) add=7; date.setDate(date.getDate()+add); found=true}}
  // il 25 (solo giorno)
  if(!found&&(m=cut(/\b(?:il|giorno)\s+(\d{1,2})\b(?![:.]\d)/i))){
    date=new Date(today.getFullYear(),today.getMonth(),+m[1]); if(date<today) date=new Date(today.getFullYear(),today.getMonth()+1,+m[1]); found=true}
  // ora
  m=cut(/\b(?:alle\s+ore|alle|ore|per\s+le|verso\s+le|dalle)\s+(\d{1,2})(?:\s*[:.]\s*(\d{2})|\s+e\s+(mezza|mezzo|un\s+quarto|tre\s+quarti|\d{1,2}))?\b/i)
    ||cut(/\b(\d{1,2})[:.](\d{2})\b/);
  if(m){hour=+m[1]; minute=m[2]?+m[2]:0;
    if(m[3]){const t=m[3].toLowerCase(); minute=/mezz/.test(t)?30:/tre\s+quarti/.test(t)?45:/quarto/.test(t)?15:+t}}
  else if((m=cut(/\ba\s+mezzogiorno\b|\bmezzogiorno\b/i))){hour=12; minute=0}
  const pm=cut(/\b(?:del|di|nel)\s+(pomeriggio|sera)\b/i), am=cut(/\b(?:del|di|la)\s+mattin[ao]\b/i);
  if(hour!==null){ if(pm&&hour<12) hour+=12; else if(!am&&hour>=1&&hour<=6) hour+=12; if(hour>23||minute>59){hour=null; minute=null} }
  // testo
  let t=s.replace(ADD_RE,' ').replace(/\b(?:in|nell'|sull'|all')\s*agenda\b/gi,' ');
  t=t.replace(/\s+/g,' ').trim();
  for(let i=0;i<3;i++) t=t.replace(/^(?:per|il|lo|la|di|a|alle|ore|giorno|e|,)\s+/i,'').replace(/\s+(?:per|il|lo|la|di|a|alle|ore|giorno|e|,|del|nel)$/i,'').replace(/[,;:]+$/,'').trim();
  if(!t) t=src.trim();
  t=t.charAt(0).toUpperCase()+t.slice(1);
  let warn='';
  if(found&&wdSaid!==null&&date.getDay()!==wdSaid){warn=`Il ${date.getDate()} ${MM[date.getMonth()].toLowerCase()} è ${GG[date.getDay()].toLowerCase()}, non ${GG[wdSaid].toLowerCase()}: ho usato la data.`}
  return {found,date:date||new Date(today),hour,minute,text:t,warn};
}
let samplePromise=null;
function getSample(){ if(!samplePromise) samplePromise=(window.claude&&window.claude.use?window.claude.use('sample'):Promise.resolve(null)).catch(()=>null); return samplePromise }
async function parseWithClaude(src){
  const sample=await getSample(); if(!sample) return null;
  const d=T0, iso=keyOf(d);
  const prompt=`Oggi è ${GG[d.getDay()].toLowerCase()} ${iso}. Interpreta questa richiesta dettata a un'agenda in italiano.
Rispondi solo con JSON: {"date":"YYYY-MM-DD","hour":numero 0-23 oppure null,"minute":numero 0-59 oppure null,"text":"l'appunto, breve, senza data né ora né verbi di comando come segnami, aggiungimi, ricordami, mettimi","note":"stringa vuota, oppure un avviso se la richiesta è ambigua o contraddittoria"}.
Se non c'è una data usa oggi. "Alle 4" per un appuntamento significa 16.
Richiesta: ${JSON.stringify(src)}`;
  try{const r=await sample.json(prompt,{modelTier:'quick'});
    if(!r||!/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')) return null;
    const [y,mo,dd]=r.date.split('-').map(Number); let h=Number.isInteger(r.hour)?r.hour:null, mi=Number.isInteger(r.minute)?r.minute:0;
    return {found:true,date:new Date(y,mo-1,dd),hour:h,minute:h===null?null:mi,text:String(r.text||src).trim()||src,warn:String(r.note||'')};
  }catch(e){return null}
}

// ---- Scrittura nell'agenda ----
const NUMA={un:1,una:1,"un'":1,due:2,tre:3,quattro:4,cinque:5,sei:6,dieci:10,quindici:15,venti:20,trenta:30,quaranta:40,quarantacinque:45};
function cutAlert(src){
  const m=src.match(/[,;]?\s*\b(?:e\s+)?(?:avvisami|avvisarmi|ricordamelo|ricordarmelo|ricordamela|mandami\s+(?:un\s+|una\s+)?(?:avviso|notifica|promemoria)|(?:con|metti(?:mi)?)\s+(?:un\s+|una\s+)?(?:avviso|promemoria|allarme|notifica|sveglia))\b/i);
  if(!m) return {src,al:undefined};
  let tail=src.slice(m.index+m[0].length), al, used=0, x;
  if((x=tail.match(/^\s*(?:di\s+)?(?:una\s+)?mezz['’]?\s*ora(?:\s+prima)?/i))){al=30; used=x[0].length}
  else if((x=tail.match(/^\s*(?:di\s+)?(\d+|un['’]?|una|due|tre|quattro|cinque|sei|dieci|quindici|venti|trenta|quaranta|quarantacinque)\s*(minut[oi]|or[ae]|giorn[oi])(?:\s+prima)?/i))){
    const n=isNaN(x[1])?(NUMA[x[1].toLowerCase().replace('’',"'")]||1):+x[1]; const u=/^or/i.test(x[2])?60:/^giorn/i.test(x[2])?1440:1; al=n*u; used=x[0].length}
  else if((x=tail.match(/^\s*il\s+giorno\s+prima/i))){al=1440; used=x[0].length}
  else if((x=tail.match(/^\s*(?:all['’]?\s*ora\s+esatta|quando\s+inizia|in\s+tempo)/i))){al=0; used=x[0].length}
  else {x=tail.match(/^\s*prima/i); used=x?x[0].length:0; al=pref.remind>0?pref.remind:60}
  return {src:(src.slice(0,m.index)+' '+tail.slice(used)).replace(/\s+/g,' ').trim(),al};
}
function addEntry(p){
  const k=keyOf(p.date), slot=(p.hour!==null&&p.hour>=H0&&p.hour<=H1)?String(p.hour):'n';
  const time=p.hour!==null?`${String(p.hour).padStart(2,'0')}:${String(p.minute||0).padStart(2,'0')} `:'';
  const line=(slot!=='n'&&!p.minute?'':time)+p.text;
  const sameCur=cur&&cur.key===k&&!flip;
  const data=sameCur?cur.data:(store[k]?(store[k].h=store[k].h||{},store[k].n=store[k].n||'',store[k].s=store[k].s||[],store[k]):(store[k]={h:{},n:'',s:[]}));
  const prev=slot==='n'?data.n:(data.h[slot]||'');
  const next=prev?prev.replace(/\s+$/,'')+'\n'+line:line;
  if(slot==='n') data.n=next; else data.h[slot]=next;
  if(p.al!==undefined&&slot!=='n'){data.al=data.al||{}; data.al[slot]=p.al}
  store[k]=data; save(k);
  const hist={text:p.text,when:'',restore:(quiet)=>{setSlot(k,slot,prev); const i=voiceHist.indexOf(hist); if(i>=0) voiceHist.splice(i,1); if(!quiet) toast('Appunto rimosso',null,2500)}};
  const restore=()=>hist.restore(false);
  const show=()=>{ if(!cur||cur.key!==k) return; const ta=cur.tas.find(t=>t.dataset.h===slot); ta.value=slot==='n'?data.n:(data.h[slot]||''); grow(ta);
    const row=ta.closest('.row')||ta.closest('.notes'); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash'); if(slot!=='n') bellFor(cur,slot);
    const sr=stage.getBoundingClientRect(), rr=row.getBoundingClientRect(); stage.scrollTop+=rr.top-sr.top-sr.height*.3};
  const ti=idxOf(p.date);
  if(sameCur) show(); else if(!flip){goTo(ti); setTimeout(show,(parseFloat(getComputedStyle(root).getPropertyValue('--dur'))||0)*1000+120)}
  const when=`${GG[p.date.getDay()]} ${p.date.getDate()} ${MM[p.date.getMonth()].toLowerCase()}${p.hour!==null?`, ore ${String(p.hour).padStart(2,'0')}:${String(p.minute||0).padStart(2,'0')}`:', nelle note'}`;
  const alTxt=p.al===undefined?'':slot==='n'?' · per l\'avviso serve un orario':(p.al?` · avviso ${remLabel(p.al)} prima`:" · avviso all'ora esatta");
  hist.when=when+alTxt; voiceHist.push(hist); say(`Segnato: ${p.text}. ${when.replace(', nelle note',', nelle note del giorno')}`+(alTxt?'. '+alTxt.replace(' · ',''):'')+(p.warn?'. '+p.warn:''));
  toast(`<span>Segnato: ${esc(p.text)}<small>${esc(when+alTxt)}${p.warn?' · '+esc(p.warn):''}</small></span>`,restore,p.warn?9000:6000);
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

// ---- Cancellazione a voce ----
const voiceHist=[];
function parseDelete(src){
  const m=src.match(DEL_RE); if(!m) return null;
  let rest=src.slice(m[0].length).replace(/[.!?]+$/,'').trim();
  rest=rest.replace(/^(?:(?:l'|lo|la|il|un|una|i|gli|le)\s*)/i,'').trim();
  if(!rest||/^(?:ultim[oaei]|quell[oa]\s+di\s+prima|appena\s+(?:dett|scritt)[oa]|precedente|ultim[oa]\s+(?:appunto|nota|cosa|impegno|inserimento|comando))(?:\s+(?:appunto|nota|cosa|impegno|inserimento|comando))?$/i.test(rest)) return {last:true};
  return {last:false,query:rest};
}
const STOP=new Set(['appuntamento','appuntamenti','impegno','nota','appunto','evento','con','del','dal','della','dalla','alle','per','che','una','uno','gli','dei','delle','di','da','il','la','lo','le','al','ore']);
function deleteEntry(d){
  if(d.last){
    const h=voiceHist.pop();
    if(!h){toast('Non c\'è nessun appunto dettato da annullare',null,3500); say('Non c\'è nessun appunto dettato da annullare'); return}
    h.restore(true); say(`Ho cancellato ${h.text}`); toast(`<span>Cancellato: ${esc(h.text)}<small>${esc(h.when)}</small></span>`,null,4000); return}
  // cerca la data, se c'è, e le parole dell'appunto
  const p=parseLocal(d.query); const words=p.text.toLowerCase().split(/[^a-zà-ù0-9]+/).filter(w=>w.length>2&&!STOP.has(w));
  if(!words.length){toast('Dimmi cosa cancellare, ad esempio: cancella dentista',null,4000); return}
  const keys=p.found?[keyOf(p.date)]:Object.keys(store).sort((a,b)=>{const t=keyOf(T0), fa=a>=t, fb=b>=t; return fa!==fb?(fa?-1:1):(fa?a.localeCompare(b):b.localeCompare(a))});
  for(const k of keys){const dd=store[k]; if(!dd) continue;
    const slots=[...Object.keys(dd.h||{}).sort((a,b)=>a-b),'n'];
    for(const sl of slots){const txt=sl==='n'?(dd.n||''):(dd.h[sl]||''); const lines=txt.split('\n');
      const li=lines.findIndex(l=>{const low=l.toLowerCase(); return words.every(w=>low.includes(w))});
      if(li<0) continue;
      const removed=lines[li]; lines.splice(li,1); const next=lines.join('\n').trim();
      setSlot(k,sl,next);
      const [y,mo,da]=k.split('-').map(Number), dt=new Date(y,mo-1,da);
      const where=`${GG[dt.getDay()]} ${dt.getDate()} ${MM[dt.getMonth()].toLowerCase()}${sl==='n'?', note':', ore '+String(sl).padStart(2,'0')}`;
      if(idxOf(dt)!==idx&&!flip) goTo(idxOf(dt)); say(`Ho cancellato ${spokenLine(removed)}, ${where}`);
      toast(`<span>Cancellato: ${esc(removed.trim())}<small>${esc(where)}</small></span>`,()=>{setSlot(k,sl,txt); toast('Ripristinato',null,2000)},6000);
      return}
  }
  toast(`<span>Non ho trovato «${esc(p.text)}»<small>${p.found?'in quel giorno':'in agenda'}</small></span>`,null,4500); say(`Non ho trovato ${p.text}`);
}
function setSlot(k,sl,val){
  const data=(cur&&cur.key===k)?cur.data:(store[k]||(store[k]={h:{},n:'',s:[]}));
  data.h=data.h||{}; if(sl==='n') data.n=val; else if(val) data.h[sl]=val; else delete data.h[sl];
  store[k]=data; save(k);
  if(cur&&cur.key===k){const ta=cur.tas.find(t=>t.dataset.h===String(sl)); if(ta){ta.value=sl==='n'?data.n:(data.h[sl]||''); grow(ta)}}
}

// ---- Domande e ricerca ----
const ASK_RE=/^\s*(?:(?:ehi|ok|hey)\s+agenda\s*,?\s*)?(?:(?:mi\s+)?(?:sai\s+dire|dici|puoi\s+dirmi|ricordi)\s+)?(?:quando|cerca(?:mi)?|trova(?:mi)?|ricerca|dov['’]?\s*è|dove|a\s+che\s+ora|che\s+giorno|in\s+che\s+giorno|che\s+cosa|cosa|mostra(?:mi)?|fammi\s+vedere|c['’]?\s*è|ci\s+sono|ho\s+(?:segnato|messo|scritto|annotato))\b/i;
const QSTOP=new Set([...STOP,'impegni','impegno','giornata','leggimi','riepilogo','quali','com','come','la','mia','dimmi','dimmelo','sai','dire','puoi','potresti','fammi','sapere','vedere','po','poco','favore','piacere','ehi','hey','ok','allora','senti','scusa','vorrei','voglio','controlla','guarda','ho','hai','ha','segnato','messo','scritto','annotato','quando','cosa','che','c','è','e','in','agenda','prossimo','prossima','mio','mia','miei','mie','a','ora','giorno','mi','ci','sono','un','l','prima','dopo','ancora','qualcosa','devo','fare','c\'è']);
function norm(x){return String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}
const QW=/(?:^|[\s,])(?:quando|dov['’]?\s*è|dove|a\s+che\s+ora|in\s+che\s+giorno|che\s+giorno|cerca(?:mi)?|trova(?:mi)?|ricerca|ho\s+(?:segnato|messo|scritto|annotato)|che\s+(?:cosa\s+)?ho|cosa\s+ho|c['’]?\s*è|ci\s+sono|che\s+impegni|quali\s+impegni|com['’]?\s*è\s+(?:la\s+)?(?:mia\s+)?giornata|leggimi|riepilogo)(?=[\s,?]|$)/i;
function parseAsk(src){
  const q=src.trim();
  if(ADD_RE.test(q)||DEL_RE.test(q)) return null;
  const m=q.match(ASK_RE)||(()=>{const x=q.match(QW); return x&&x.index<=45?x:null})();
  if(!m&&!/\?\s*$/.test(q)) return null;
  const body=q.slice(m?m.index+m[0].length:0).replace(/\?+\s*$/,'');
  const p=parseLocal(body);
  const words=norm(p.text).split(/[^a-z0-9]+/).filter(w=>w.length>1&&!QSTOP.has(w));
  return {words,label:words.join(' '),date:p.found?p.date:null};
}
let fState=null;
const findEl=document.getElementById('find'), fTerm=document.getElementById('fTerm'), fInfo=document.getElementById('fInfo');
function lineHit(line,words){const l=norm(line); return words.every(w=>l.includes(w))}
function searchAll(words){
  const out=[];
  for(const k of Object.keys(store)){const d=store[k]; if(!d) continue; const [y,mo,da]=k.split('-').map(Number);
    for(const sl of Object.keys(d.h||{})) (d.h[sl]||'').split('\n').forEach(line=>{ if(line.trim()&&lineHit(line,words)) out.push({k,sl,line:line.trim(),date:new Date(y,mo-1,da),ord:+sl}) });
    (d.n||'').split('\n').forEach(line=>{ if(line.trim()&&lineHit(line,words)) out.push({k,sl:'n',line:line.trim(),date:new Date(y,mo-1,da),ord:99}) });
  }
  return out.sort((a,b)=>a.k.localeCompare(b.k)||a.ord-b.ord);
}
function runFind(a){
  if(!a.words.length){ closeFind();
    { const dd=a.date||new Date(T0); if(idxOf(dd)!==idx) goTo(idxOf(dd)); const sm=daySummary(dd); toast(`<span>${esc(sm.title)}<small>${esc(sm.short)}</small></span>`,null,5000); say(sm.spoken)}
    return}
  let res=searchAll(a.words); if(a.date){const kk=keyOf(a.date); const same=res.filter(r=>r.k===kk); if(same.length) res=same}
  if(!res.length){closeFind(); toast(`<span>Non ho trovato «${esc(a.label)}»<small>in nessun giorno dell'agenda</small></span>`,null,4500); say(`Non ho trovato ${a.label} in agenda`); return}
  const now=new Date(), todayK=keyOf(T0), nowH=now.getHours();
  let i=res.findIndex(r=>r.k>todayK||(r.k===todayK&&(r.sl==='n'||+r.sl>=nowH)));
  if(i<0) i=res.length-1;
  fState={words:a.words,label:a.label,res,i}; toastEl.classList.add('hide');
  findEl.hidden=false; findGo(i);
  { const r=res[i], d=r.date, past=r.k<keyOf(T0), others=res.length-1;
    say(`${spokenLine(r.line)}: ${past?'era ':''}${relDay(d)}${r.sl==='n'?', nelle note':', alle '+spokenTime(r.line,r.sl)}.`+(others?` Ci ${others===1?'è un altro risultato':'sono altri '+others+' risultati'}: usa le frecce per vederli.`:'')) }
}
function findGo(i){
  if(!fState) return; fState.i=Math.max(0,Math.min(fState.res.length-1,i)); const r=fState.res[fState.i], d=r.date;
  const past=r.k<keyOf(T0);
  fTerm.textContent=r.line;
  fInfo.textContent=`${fState.i+1} di ${fState.res.length} · ${GS[d.getDay()].toLowerCase()} ${d.getDate()} ${MM[d.getMonth()].slice(0,3).toLowerCase()}${d.getFullYear()!==T0.getFullYear()?' '+d.getFullYear():''}${r.sl==='n'?' · note':' · '+String(r.sl).padStart(2,'0')+':00'}${past?' · passato':''}`;
  document.getElementById('fPrev').disabled=fState.i===0; document.getElementById('fNext').disabled=fState.i===fState.res.length-1;
  const ti=idxOf(d);
  const show=()=>{ if(!cur||cur.key!==r.k) return; applyHits(cur); const ta=cur.tas.find(t=>t.dataset.h===String(r.sl)); if(!ta) return;
    const row=ta.closest('.row')||ta.closest('.notes'); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
    const sr=stage.getBoundingClientRect(), rr=row.getBoundingClientRect(); stage.scrollTop+=rr.top-sr.top-sr.height*.3};
  if(ti===idx&&!flip) show(); else if(!flip){goTo(ti); setTimeout(show,(parseFloat(getComputedStyle(root).getPropertyValue('--dur'))||0)*1000+120)}
}
function applyHits(sh){
  sh.el.querySelectorAll('.hit').forEach(e=>e.classList.remove('hit'));
  if(!fState) return;
  sh.tas.forEach(ta=>{ if(ta.value.split('\n').some(l=>l.trim()&&lineHit(l,fState.words))) (ta.closest('.row')||ta.closest('.notes')).classList.add('hit') });
}
function closeFind(){fState=null; findEl.hidden=true; if(cur) applyHits(cur)}
document.getElementById('fPrev').onclick=()=>findGo(fState.i-1);
document.getElementById('fNext').onclick=()=>findGo(fState.i+1);
document.getElementById('fClose').onclick=closeFind;

// ---- Pannello vocale ----
const vscrim=document.getElementById('vscrim'), vtext=document.getElementById('vtext'), vstat=document.getElementById('vstat'), vmic=document.getElementById('vmic'), vgo=document.getElementById('vgo');
const SR=window.SpeechRecognition||window.webkitSpeechRecognition; let rec=null, recOn=false, micBlocked=!SR;
const HINT_KB='Il microfono diretto non è disponibile qui: tocca il <b>microfono della tastiera</b> del telefono e detta nel riquadro, poi premi <b>Segna in agenda</b>.';
function openVoice(){vscrim.hidden=false; vtext.value=''; vgo.disabled=true; vgo.textContent='Segna in agenda'; vforce.hidden=true; force=false;
  vstat.innerHTML=micBlocked?HINT_KB:'Tocca il microfono e parla. Dì cosa, quando e a che ora.';
  if(micBlocked) setTimeout(()=>vtext.focus(),50); else startRec()}
function closeVoice(){stopRec(); vscrim.hidden=true}
function startRec(){
  if(!SR){micBlocked=true; vstat.innerHTML=HINT_KB; vtext.focus(); return}
  try{rec=new SR(); rec.lang='it-IT'; rec.interimResults=true; rec.continuous=false; rec.maxAlternatives=1}catch(e){micBlocked=true; vstat.innerHTML=HINT_KB; vtext.focus(); return}
  let finalTxt='';
  rec.onresult=ev=>{let interim=''; for(let i=ev.resultIndex;i<ev.results.length;i++){const r=ev.results[i]; if(r.isFinal) finalTxt+=r[0].transcript; else interim+=r[0].transcript}
    vtext.value=(finalTxt+interim).trim(); vgo.disabled=!vtext.value.trim()};
  rec.onerror=ev=>{ if(ev.error==='not-allowed'||ev.error==='service-not-allowed'||ev.error==='audio-capture'){micBlocked=true; vstat.innerHTML=HINT_KB; vtext.focus()}
    else if(ev.error==='no-speech'){vstat.textContent='Non ho sentito nulla. Tocca il microfono e riprova.'} };
  rec.onend=()=>{recOn=false; vmic.classList.remove('live'); vmic.setAttribute('aria-label','Inizia a dettare');
    if(!micBlocked&&vstat.textContent.startsWith('Ti ascolto')) vstat.textContent=vtext.value?'Controlla il testo e premi Segna in agenda.':'Tocca il microfono e parla.';
    if(finalTxt.trim()&&!vscrim.hidden) submitVoice()};
  vforce.hidden=true;
  try{rec.start(); recOn=true; vmic.classList.add('live'); vmic.setAttribute('aria-label','Ferma'); vstat.textContent='Ti ascolto…'}
  catch(e){micBlocked=true; vstat.innerHTML=HINT_KB; vtext.focus()}
}
function stopRec(){ if(rec&&recOn){try{rec.stop()}catch(e){}} }
async function submitVoice(){
  const src=vtext.value.trim(); if(!src) return; stopRec();
  const ask=parseAsk(src);
  if(ask){closeVoice(); runFind(ask); return}
  const del=parseDelete(src);
  if(del){closeVoice(); deleteEntry(del); return}
  vgo.disabled=true; vgo.textContent='Sto segnando…';
  const ca=cutAlert(src); const clean=ca.src;
  let p=parseLocal(clean);
  if(!p.found){const c=await parseWithClaude(clean); if(c) p=c}
  p.al=ca.al;
  const hasVerb=ADD_RE.test(clean);
  if(!force&&!hasVerb&&!p.found&&p.hour===null){ notUnderstood(src); return }
  force=false; vforce.hidden=true; closeVoice(); addEntry(p);
}
let force=false; const vforce=document.getElementById('vforce');
function notUnderstood(src){
  vgo.disabled=false; vgo.textContent='Segna in agenda'; vforce.hidden=false;
  say('Non ho capito. Puoi ripetere?');
  vstat.innerHTML=`Non ho capito «${esc(src)}». <b>Tocca il microfono e ripeti</b>, per esempio "segnami dentista il 25 novembre alle 16" o "quando ho il dentista?".`;
  try{navigator.vibrate&&navigator.vibrate([20,60,20])}catch(e){}
}
vforce.onclick=()=>{force=true; submitVoice()};
document.getElementById('voice').onclick=openVoice;
document.getElementById('vclose').onclick=closeVoice;
document.getElementById('vcancel').onclick=closeVoice;
vscrim.addEventListener('click',e=>{if(e.target===vscrim) closeVoice()});
vmic.onclick=()=>{ if(recOn) stopRec(); else if(micBlocked){vstat.innerHTML=HINT_KB; vtext.focus()} else startRec() };
vgo.onclick=submitVoice;
vtext.addEventListener('input',()=>{vgo.disabled=!vtext.value.trim()});
vtext.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault(); submitVoice()} else if(e.key==='Escape') closeVoice()});
document.getElementById('vex').querySelectorAll('button').forEach(b=>b.onclick=()=>{vtext.value=b.textContent; vgo.disabled=false; vtext.focus()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!vscrim.hidden) closeVoice()});

// ---- Astuccio ----
const kit=document.getElementById('kit'), kitBtn=document.getElementById('kitBtn');
const ICONS={
 pen:'<svg viewBox="0 0 32 32"><path d="M6 26l2-6L21 7a2.8 2.8 0 014 4L12 24z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 26l2-6 4 4z" fill="var(--kc)"/></svg>',
 pencil:'<svg viewBox="0 0 32 32"><path d="M8 24L22 10l3 3-14 14H8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M20 12l3 3" stroke="currentColor" stroke-width="1.8"/><path d="M8 24v3h3z" fill="var(--kc)"/><path d="M22 10l2-2a2 2 0 013 3l-2 2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
 marker:'<svg viewBox="0 0 32 32"><path d="M9 21l11-11 4 4-11 11z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 21l-3 5h5l2-1z" fill="var(--kc)"/><path d="M20 10l3-3 4 4-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
 hl:'<svg viewBox="0 0 32 32"><rect x="4" y="22" width="24" height="5" rx="1" fill="var(--kc)" opacity=".45"/><path d="M11 19l9-9 5 5-9 9z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M11 19l-2 4h5l2-1" fill="var(--kc)"/></svg>'};
function renderKit(){
  const col=colorFor(pref.color); root.style.setProperty('--kit-c',col);
  document.getElementById('tools').innerHTML=Object.keys(TOOLS).map(k=>`<button class="tl" data-t="${k}" aria-pressed="${pref.tool===k}" style="--kc:${col}">${ICONS[k]}${TOOLS[k].n}</button>`).join('');
  const sz=TOOLS[pref.tool].sizes;
  document.getElementById('sizes').innerHTML=sz.map((w,i)=>`<button class="sz" data-s="${i}" aria-pressed="${pref.size===i}" aria-label="Misura ${['piccola','media','grande'][i]}"><i style="width:${Math.max(3,Math.round(w*600))}px;height:${Math.max(3,Math.round(w*600))}px"></i></button>`).join('');
  const custom=pref.color[0]==='#'&&!PALETTE.includes(pref.color);
  document.getElementById('pal').innerHTML=PALETTE.map(c=>`<button class="pc" data-c="${c}" aria-pressed="${pref.color===c}" aria-label="${PNAMES[c]}" style="background:${c[0]==='#'?c:'var(--ink-'+c+')'}"></button>`).join('')
    +`<label class="pc custom" aria-pressed="${custom}" title="Altro colore"${custom?` style="background:${pref.color}"`:''}><input type="color" id="cpick" value="${pref.color[0]==='#'?pref.color:'#2350d8'}" aria-label="Scegli un altro colore"></label>`;
  kitBtn.setAttribute('aria-label','Astuccio: '+TOOLS[pref.tool].n.toLowerCase()+', '+(PNAMES[pref.color]||'colore personalizzato').toLowerCase());
}
function openKit(){renderKit(); kit.hidden=false; kitBtn.setAttribute('aria-expanded','true')}
function closeKit(){kit.hidden=true; kitBtn.setAttribute('aria-expanded','false')}
kitBtn.onclick=e=>{e.stopPropagation(); if(kit.hidden) openKit(); else closeKit()};
document.getElementById('m-pen').addEventListener('click',()=>{ if(mode==='pen'&&kit.hidden&&document.getElementById('m-pen').dataset.was==='pen') openKit(); document.getElementById('m-pen').dataset.was='pen'});
['m-type','m-erase'].forEach(id=>document.getElementById(id).addEventListener('click',()=>{document.getElementById('m-pen').dataset.was='';closeKit()}));
kit.addEventListener('click',e=>{
  const t=e.target.closest('.tl'), z=e.target.closest('.sz'), c=e.target.closest('.pc:not(.custom)');
  if(t){pref.tool=t.dataset.t} else if(z){pref.size=+z.dataset.s} else if(c){pref.color=c.dataset.c} else return;
  savePref(); renderKit(); if(mode!=='pen') setMode('pen');
});
kit.addEventListener('input',e=>{ if(e.target.id==='cpick'){pref.color=e.target.value; savePref(); root.style.setProperty('--kit-c',pref.color); if(mode!=='pen') setMode('pen')} });
kit.addEventListener('change',e=>{ if(e.target.id==='cpick') renderKit() });
document.addEventListener('pointerdown',e=>{ if(!kit.hidden&&!e.target.closest('#kit,#kitBtn')) closeKit() });
renderKit(); document.getElementById('m-pen').dataset.was='';

// ---- Suono delle pagine ----
let actx=null;
function wakeAudio(){ if(!pref.sound) return; try{ if(!actx){const AC=window.AudioContext||window.webkitAudioContext; if(AC) actx=new AC()} if(actx&&actx.state==='suspended') actx.resume() }catch(e){} }
// Sintesi di una pagina di carta che si gira: crepitio delle fibre + fruscio + spostamento d'aria + pagina che si posa
function rnd(a,b){return a+Math.random()*(b-a)}
function bufFrom(fn,dur){const sr=actx.sampleRate,n=Math.max(1,Math.floor(sr*dur)),b=actx.createBuffer(1,n,sr),d=b.getChannelData(0); fn(d,n,sr); return b}
function envAt(t,peak,sharp){return t<peak?Math.pow(t/peak,1.6):Math.exp(-(t-peak)*sharp/(1-peak))}
function crackle(dur,peak,dens,sharp){return bufFrom((d,n,sr)=>{
  let v=0,k=0; for(let i=0;i<n;i++){const e=envAt(i/n,peak,sharp);
    if(Math.random()<e*dens){v+=(Math.random()*2-1)*rnd(.25,1)*e; k=Math.exp(-1/(sr*rnd(.0005,.0016)))}
    d[i]=v; v*=k}
  for(let i=n-1;i>0;i--) d[i]=d[i]-d[i-1]*.55;   // grana leggera, come carta
  let m=0; for(let i=0;i<n;i++) m=Math.max(m,Math.abs(d[i])); if(m) for(let i=0;i<n;i++) d[i]/=m},dur)}
function airy(dur,peak,sharp){return bufFrom((d,n)=>{for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*envAt(i/n,peak,sharp)},dur)}
function play(buf,t,{type='allpass',f=1000,q=.7,gain=.5,rate=1}={}){
  const s=actx.createBufferSource(); s.buffer=buf; s.playbackRate.value=rate;
  const fl=actx.createBiquadFilter(); fl.type=type; fl.frequency.value=f; fl.Q.value=q;
  const g=actx.createGain(); g.gain.value=gain; s.connect(fl); fl.connect(g); g.connect(master()); s.start(t)}
function thump(t,f0,f1,dur,gain){const o=actx.createOscillator(), g=actx.createGain(); o.type='sine';
  o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(gain,t+.006); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g); g.connect(master()); o.start(t); o.stop(t+dur+.02)}
let mst=null; function master(){ if(!mst){mst=actx.createGain(); mst.gain.value=.55; const lp=actx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=6500; lp.Q.value=.5; const c=actx.createDynamicsCompressor(); c.threshold.value=-18; c.ratio.value=3; mst.connect(lp); lp.connect(c); c.connect(actx.destination)} return mst}
function pageSound(dir){
  if(!pref.sound) return; wakeAudio(); if(!actx) return;
  const t=actx.currentTime+.01, r=rnd(.94,1.06);
  if(dir>0){ // avanti: fruscio morbido della pagina che gira e si posa
    play(crackle(.5,.42,.006,4.5),t,{type:'bandpass',f:2600*r,q:.45,gain:.26,rate:r});
    play(airy(.48,.45,4.5),t,{type:'bandpass',f:2100*r,q:.5,gain:.2});
    play(airy(.44,.5,3.8),t+.03,{type:'lowpass',f:520,q:.6,gain:.3});
    const land=t+.42/r;
    play(airy(.06,.1,8),land,{type:'lowpass',f:900,q:.6,gain:.22});
    thump(land,95,60,.07,.06);
  } else { // indietro: si stacca piano dalla pila, fruscio un po' più lungo e cupo
    play(airy(.04,.12,8),t,{type:'bandpass',f:1700,q:.7,gain:.14});
    play(crackle(.58,.55,.005,3.8),t+.02,{type:'bandpass',f:2200*r,q:.45,gain:.24,rate:r*.96});
    play(airy(.56,.55,3.8),t+.02,{type:'bandpass',f:1800*r,q:.5,gain:.2});
    play(airy(.52,.48,3.2),t+.04,{type:'lowpass',f:440,q:.6,gain:.32});
    const land=t+.54;
    play(airy(.07,.1,8),land,{type:'lowpass',f:750,q:.6,gain:.18});
    thump(land,80,55,.08,.05);
  }
}

// ---- Lucchetto ----
function setLock(on){
  locked=on; document.body.classList.toggle('locked',on); closeKit();
  if(document.activeElement&&document.activeElement.blur) document.activeElement.blur();
  try{ if(on){const r=document.documentElement; (r.requestFullscreen||r.webkitRequestFullscreen||function(){}).call(r)} else if(document.fullscreenElement||document.webkitFullscreenElement){(document.exitFullscreen||document.webkitExitFullscreen).call(document)} }catch(e){}
  requestAnimationFrame(()=>{lastW=stage.clientWidth; layout()});
  toast(on?'Agenda bloccata. Per sbloccarla tocca la pagina: in basso a destra compare il lucchetto.':'Agenda sbloccata',null,on?4000:1800); if(on) showUnlock(); else unlockBtn.classList.remove('show');
}
document.getElementById('lock').onclick=()=>setLock(true);
const unlockBtn=document.getElementById('unlock'); let unlockT=0;
function showUnlock(){unlockBtn.classList.add('show'); clearTimeout(unlockT); unlockT=setTimeout(()=>unlockBtn.classList.remove('show'),3000)}
unlockBtn.onclick=()=>{unlockBtn.classList.remove('show'); setLock(false)};
document.addEventListener('contextmenu',e=>{ if(locked) e.preventDefault() });
document.addEventListener('keydown',e=>{ if(locked&&e.key==='Escape') setLock(false) });

// ======================================================================
// ---- Voce in uscita ----
let itVoice=null;
function pickVoice(){ try{const vs=speechSynthesis.getVoices(); itVoice=vs.find(v=>/^it/i.test(v.lang)&&/Alice|Federica|Elsa|Google|Paola/i.test(v.name))||vs.find(v=>/^it/i.test(v.lang))||null}catch(e){} }
if('speechSynthesis' in window){pickVoice(); try{speechSynthesis.onvoiceschanged=pickVoice}catch(e){}}
function say(t){ if(!pref.voice||!('speechSynthesis' in window)||!t) return;
  try{speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(String(t).replace(/·/g,',').replace(/\s+/g,' ')); u.lang='it-IT'; if(itVoice) u.voice=itVoice; u.rate=1.03; speechSynthesis.speak(u)}catch(e){} }
function cap(t){t=String(t); return t.charAt(0).toUpperCase()+t.slice(1)}
function spokenLine(l){return String(l).replace(/^\s*\d{1,2}[:.]\d{2}\s+/,'').trim()}
function spokenTime(line,sl){const m=String(line).match(/^\s*(\d{1,2})[:.](\d{2})/); const hh=m?+m[1]:+sl, mm=m?+m[2]:0; return (hh===1?'una':String(hh))+(mm?' e '+mm:'')}
function keyDate(k){const [y,m,d]=k.split('-').map(Number); return new Date(y,m-1,d)}
function fmtKey(k){const dt=keyDate(k); return `${GS[dt.getDay()].toLowerCase()} ${dt.getDate()} ${MM[dt.getMonth()].slice(0,3).toLowerCase()}${dt.getFullYear()!==T0.getFullYear()?' '+dt.getFullYear():''}`}
function relDay(d){const n=idxOf(d); if(n===0) return 'oggi'; if(n===1) return 'domani'; if(n===-1) return 'ieri'; if(n===2) return 'dopodomani'; return `${GG[d.getDay()].toLowerCase()} ${d.getDate()} ${MM[d.getMonth()].toLowerCase()}`}
function dayItems(k){const d=store[k], out=[]; if(!d) return out;
  for(const sl of Object.keys(d.h||{}).sort((a,b)=>a-b)) (d.h[sl]||'').split('\n').forEach(l=>{ if(!l.trim()) return; const m=l.match(/^\s*(\d{1,2})[:.](\d{2})\s+/);
    out.push({t:m?`${m[1].padStart(2,'0')}:${m[2]}`:`${String(sl).padStart(2,'0')}:00`,text:spokenLine(l),done:!!(d.d&&d.d[sl]),sl}) });
  (d.n||'').split('\n').forEach(l=>{ if(l.trim()) out.push({t:'',text:l.trim(),done:false,sl:'n'}) });
  return out}
function daySummary(date){const k=keyOf(date), it=dayItems(k), title=`${GG[date.getDay()]} ${date.getDate()} ${MM[date.getMonth()].toLowerCase()}`;
  if(!it.length) return {title,short:'Nessun impegno',spoken:`${cap(relDay(date))} non hai impegni.`};
  const timed=it.filter(x=>x.t), notes=it.filter(x=>!x.t);
  let sp=`${cap(relDay(date))} hai ${it.length===1?'un impegno':it.length+' impegni'}: `+timed.map(x=>`alle ${spokenTime(x.t)} ${x.text}${x.done?', già fatto':''}`).join('; ');
  if(notes.length) sp+=(timed.length?'. ':'')+'Nelle note: '+notes.map(x=>x.text).join('; ');
  return {title,short:`${it.length} ${it.length===1?'impegno':'impegni'}`,spoken:sp+'.'}}

// ---- Fogli: indice e impostazioni ----
const idxScrim=document.getElementById('idxScrim'), setScrim=document.getElementById('setScrim');
function openSheet(sc){sc.hidden=false; closeKit()}
function closeSheet(sc){sc.hidden=true}
[idxScrim,setScrim].forEach(sc=>sc.addEventListener('click',e=>{ if(e.target===sc||e.target.closest('[data-close]')) closeSheet(sc) }));
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){closeSheet(idxScrim); closeSheet(setScrim)} });

// ---- Indice dei mesi, segnalibro, pagine piegate ----
const MC=['#5b6cff','#00a3c4','#13a47f','#7cc242','#d9a20f','#ff8a00','#e8382f','#d63c86','#9b51e0','#8a5a3c','#5f6b7a','#0b7a5a'];
let idxYear=T0.getFullYear();
const monthsEl=document.getElementById('months'), bmRow=document.getElementById('bmRow'), foldList=document.getElementById('foldList'), yLbl=document.getElementById('yLbl');
function monthCount(y,m){let n=0; const pre=`${y}-${String(m+1).padStart(2,'0')}-`; for(const k in store) if(k.startsWith(pre)&&dayItems(k).length) n++; return n}
function goMonth(y,m){const t=(y===T0.getFullYear()&&m===T0.getMonth())?new Date(T0):new Date(y,m,1); closeSheet(idxScrim); goTo(idxOf(t))}
function renderIndex(){
  yLbl.textContent=idxYear; const cd=dateOf(idx);
  monthsEl.innerHTML=MM.map((m,i)=>{const c=monthCount(idxYear,i); return `<button class="mtab${cd.getFullYear()===idxYear&&cd.getMonth()===i?' cur':''}" data-m="${i}" style="--mc:${MC[i]}">${m.slice(0,3)}<small>${c?c+(c>1?' giorni':' giorno'):'vuoto'}</small></button>`}).join('');
  datePick.value=keyOf(cd);
  const bm=meta().bm, here=keyOf(cd);
  bmRow.innerHTML=(bm?`<button class="fchip" data-go="${bm}">Vai a ${fmtKey(bm)}</button>`:'<span class="empty">Nessun segnalibro.</span>')
    +(bm===here?'<button class="fchip" data-bm="off">Togli il segnalibro</button>':'<button class="fchip" data-bm="here">Metti il segnalibro su questa pagina</button>');
  const folds=Object.keys(store).filter(k=>k!==META&&store[k]&&store[k].f).sort();
  foldList.innerHTML=folds.length?folds.map(k=>`<button class="fchip" data-go="${k}">${fmtKey(k)}</button>`).join(''):'<span class="empty">Nessuna pagina piegata. Tocca l\'angolo in alto a destra di una pagina per piegarlo.</span>';
}
document.getElementById('dateBtn').onclick=()=>{idxYear=dateOf(idx).getFullYear(); renderIndex(); openSheet(idxScrim)};
document.getElementById('yPrev').onclick=()=>{idxYear--; renderIndex()};
document.getElementById('yNext').onclick=()=>{idxYear++; renderIndex()};
monthsEl.addEventListener('click',e=>{const b=e.target.closest('[data-m]'); if(b) goMonth(idxYear,+b.dataset.m)});
idxScrim.addEventListener('click',e=>{const g=e.target.closest('[data-go]'), m=e.target.closest('[data-bm]');
  if(g){closeSheet(idxScrim); goTo(idxOf(keyDate(g.dataset.go)))}
  else if(m){setBookmark(m.dataset.bm==='here'?keyOf(dateOf(idx)):null); renderIndex()}});
const mtabs=document.getElementById('mtabs');
function renderSideTabs(){const cd=dateOf(idx), y=cd.getFullYear();
  mtabs.innerHTML=MM.map((m,i)=>`<button data-m="${i}" class="${cd.getMonth()===i?'cur':''}" style="--mc:${MC[i]}" aria-label="${m} ${y}">${m.slice(0,3).toUpperCase()}</button>`).join('')}
mtabs.addEventListener('click',e=>{const b=e.target.closest('[data-m]'); if(b) goMonth(dateOf(idx).getFullYear(),+b.dataset.m)});

// segnalibro
const bmTab=document.getElementById('bmTab'), bmTabTxt=document.getElementById('bmTabTxt');
function setBookmark(k){meta().bm=k||null; save(META); if(cur) decorate(cur); renderBmTab();
  toast(k?'Segnalibro messo su questa pagina':'Segnalibro tolto',null,2200)}
function renderBmTab(){const bm=meta().bm; const show=!!bm&&cur&&bm!==cur.key; bmTab.hidden=!show; if(show) bmTabTxt.textContent='Segnalibro · '+fmtKey(bm)}
bmTab.onclick=()=>{const bm=meta().bm; if(bm) goTo(idxOf(keyDate(bm)))};
function afterNav(){renderSideTabs(); renderBmTab()}

// ---- Decorazioni della pagina: orecchia, nastro, spunte, impegni da riportare ----
function decorate(sh){
  sh.front.classList.toggle('folded',!!sh.data.f);
  sh.front.querySelector('.ribbon').hidden=meta().bm!==sh.key;
  sh.el.querySelectorAll('.row').forEach(r=>{const h=r.dataset.h; r.classList.toggle('done',!!(sh.data.d&&sh.data.d[h])); r.classList.toggle('moved',!!(sh.data.m&&sh.data.m[h])); bellFor(sh,h)});
  const banner=sh.el.querySelector('.carry');
  const items=sh.idx===0?pendingCarry():[];
  banner.hidden=!items.length;
  if(items.length){
    banner.innerHTML=`<span><b>${items.length} ${items.length===1?'impegno':'impegni'}</b> dei giorni scorsi ${items.length===1?'non è spuntato':'non sono spuntati'}.</span><button data-carry="yes">Riporta a oggi</button><button class="ghost" data-carry="no">Ignora</button>`;
    banner.onclick=e=>{const b=e.target.closest('[data-carry]'); if(!b) return; if(b.dataset.carry==='yes') carryOver(items); else {meta().carryOff=keyOf(T0); save(META); decorate(sh)}};
  }
}
function pendingCarry(){
  const tk=keyOf(T0); if(meta().carryOff===tk) return [];
  const out=[];
  for(let i=7;i>=1;i--){const k=keyOf(dateOf(-i)), d=store[k]; if(!d||!d.h) continue;
    for(const sl of Object.keys(d.h).sort((a,b)=>a-b)){ if(!d.h[sl]||!d.h[sl].trim()) continue; if(d.d&&d.d[sl]) continue; if(d.m&&d.m[sl]) continue; if(/\(esempio/.test(d.h[sl])) continue; out.push({k,sl,text:d.h[sl].trim()}) } }
  return out}
function carryOver(items){
  const lines=items.map(it=>it.text.split('\n').map(l=>`↪ ${spokenLine(l)} (da ${fmtKey(it.k)})`).join('\n'));
  for(const it of items){const d=store[it.k]; d.m=d.m||{}; d.m[it.sl]=true; save(it.k)}
  cur.data.n=(cur.data.n?cur.data.n.replace(/\s+$/,'')+'\n':'')+lines.join('\n'); commit(cur);
  const ta=cur.tas.find(t=>t.dataset.h==='n'); ta.value=cur.data.n; grow(ta); decorate(cur);
  const row=ta.closest('.notes'); const sr=stage.getBoundingClientRect(), rr=row.getBoundingClientRect(); stage.scrollTop+=rr.top-sr.top-sr.height*.3;
  row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
  toast(`${items.length} ${items.length===1?'impegno riportato':'impegni riportati'} nelle note di oggi`,null,3500);
}
function hitSpecial(e){
  if(!cur||!e.target.closest('.book')) return null;
  const fr=cur.front.getBoundingClientRect(), c=fr.width*.1;
  if(e.clientX>fr.right-c&&e.clientX<=fr.right&&e.clientY>=fr.top&&e.clientY<fr.top+c) return {t:'fold'};
  const els=document.elementsFromPoint(e.clientX,e.clientY);
  const bl=els.find(x=>x.classList&&x.classList.contains('bell')&&!x.hidden); if(bl){const row=bl.closest('.row'); if(row&&cur.el.contains(row)) return {t:'bell',h:row.dataset.h,el:bl}}
  const hr=els.find(x=>x.classList&&x.classList.contains('hr'));
  if(hr){const row=hr.closest('.row'); if(row&&cur.el.contains(row)) return {t:'hr',h:row.dataset.h}}
  return null}
function doSpecial(sp){
  const sh=cur; if(!sh) return;
  if(sp.t==='fold'){sh.data.f=!sh.data.f; commit(sh); decorate(sh); try{navigator.vibrate&&navigator.vibrate(12)}catch(e){}
    toast(sh.data.f?'Angolo piegato: ritrovi la pagina nell\'Indice':'Angolo spiegato',null,2200); return}
  if(sp.t==='bell'){openAlertMenu(sh,sp.h,sp.el); return}
  if(sp.t==='hr'){const h=sp.h; if(!(sh.data.h[h]||'').trim()){toast('Scrivi qualcosa in quest\'ora per poterla spuntare',null,2200); return}
    sh.data.d=sh.data.d||{}; if(sh.data.d[h]) delete sh.data.d[h]; else sh.data.d[h]=true; commit(sh); decorate(sh); try{navigator.vibrate&&navigator.vibrate(10)}catch(e){}}
}

// ---- Foto incollate ----
let phDrag=null; const urlCache={};
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('agenda-photos',1); r.onupgradeneeded=()=>r.result.createObjectStore('ph'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error)})}
async function idbGet(id){try{const db=await idb(); return await new Promise(res=>{const q=db.transaction('ph').objectStore('ph').get(id); q.onsuccess=()=>res(q.result||null); q.onerror=()=>res(null)})}catch(e){return null}}
async function idbPut(id,b){try{const db=await idb(); return await new Promise(res=>{const tx=db.transaction('ph','readwrite'); tx.objectStore('ph').put(b,id); tx.oncomplete=()=>res(true); tx.onerror=()=>res(false)})}catch(e){return false}}
async function idbDel(id){try{const db=await idb(); db.transaction('ph','readwrite').objectStore('ph').delete(id)}catch(e){}}
async function photoURL(id){ if(urlCache[id]) return urlCache[id]; let b=await idbGet(id);
  if(!b&&sb&&user){try{const {data}=await sb.storage.from('photos').download(`${user.id}/${id}.jpg`); if(data){b=data; idbPut(id,b)}}catch(e){}}
  return b?(urlCache[id]=URL.createObjectURL(b)):null}
function renderPhotos(sh){const box=sh.front.querySelector('.photos'); box.innerHTML='';
  (sh.data.ph||[]).forEach(p=>{const f=document.createElement('figure'); f.className='ph'; f.dataset.id=p.id;
    f.style.left=(p.x*100)+'%'; f.style.top=`calc(var(--pw) * ${p.y})`; f.style.width=(p.w*100)+'%'; f.style.transform=`rotate(${p.r||0}deg)`;
    f.innerHTML='<img alt="Foto incollata sulla pagina"><button class="ctl del" aria-label="Togli la foto">×</button><span class="ctl rsz" aria-hidden="true">⤡</span>';
    box.appendChild(f); photoURL(p.id).then(u=>{ if(u) f.querySelector('img').src=u })})}
function selectPhoto(el){ if(!cur) return; cur.el.querySelectorAll('.ph.sel').forEach(x=>{ if(x!==el) x.classList.remove('sel') }); if(el) el.classList.add('sel') }
function startPhoto(e,el){
  const id=el.dataset.id, p=(cur.data.ph||[]).find(x=>x.id===id); if(!p) return;
  if(e.target.closest('.del')){removePhoto(id); return}
  try{stage.setPointerCapture(e.pointerId)}catch(_){}
  phDrag={id:e.pointerId,el,p,mode:e.target.closest('.rsz')?'rsz':'move',x0:e.clientX,y0:e.clientY,W:cur.front.getBoundingClientRect().width,sx:p.x,sy:p.y,sw:p.w,moved:0};
}
function movePhoto(e){const d=phDrag, dx=e.clientX-d.x0, dy=e.clientY-d.y0; d.moved=Math.max(d.moved,Math.hypot(dx,dy));
  if(d.mode==='move'){d.p.x=Math.max(-.1,Math.min(.9,d.sx+dx/d.W)); d.p.y=Math.max(0,d.sy+dy/d.W); d.el.style.left=(d.p.x*100)+'%'; d.el.style.top=`calc(var(--pw) * ${d.p.y})`}
  else {d.p.w=Math.max(.15,Math.min(.95,d.sw+dx/d.W)); d.el.style.width=(d.p.w*100)+'%'}}
function endPhoto(){const d=phDrag; phDrag=null; if(d.moved>4){commit(cur); selectPhoto(d.el)} else selectPhoto(d.el.classList.contains('sel')?null:d.el)}
function removePhoto(id){cur.data.ph=(cur.data.ph||[]).filter(x=>x.id!==id); commit(cur); renderPhotos(cur); idbDel(id);
  if(sb&&user) sb.storage.from('photos').remove([`${user.id}/${id}.jpg`]).catch(()=>{}); toast('Foto tolta dalla pagina',null,2000)}
async function shrink(file){
  let bmp; try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){bmp=await createImageBitmap(file)}
  const M=1400, sc=Math.min(1,M/Math.max(bmp.width,bmp.height)), c=document.createElement('canvas'); c.width=Math.round(bmp.width*sc); c.height=Math.round(bmp.height*sc);
  c.getContext('2d').drawImage(bmp,0,0,c.width,c.height); return await new Promise(r=>c.toBlob(r,'image/jpeg',.82))}
document.getElementById('phPick').addEventListener('change',async e=>{
  const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f||!cur) return; closeKit();
  try{const blob=await shrink(f); const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7); await idbPut(id,blob);
    const fr=cur.front.getBoundingClientRect(), sr=stage.getBoundingClientRect();
    const p={id,x:.25,y:Math.max(.05,((sr.top+sr.height*.3)-fr.top)/fr.width),w:.5,r:+(Math.random()*6-3).toFixed(1)};
    cur.data.ph=(cur.data.ph||[]).concat(p); commit(cur); renderPhotos(cur); setMode('type');
    toast('Foto incollata. Trascinala per spostarla; toccala per ridimensionarla o toglierla.',null,4500);
    uploadPhoto(cur.key,p);
  }catch(err){toast('Non sono riuscito a leggere questa foto. Prova con un\'altra immagine.',null,4000)}
});
async function uploadPhoto(k,p){ if(!sb||!user||p.up) return; const b=await idbGet(p.id); if(!b) return;
  try{const {error}=await sb.storage.from('photos').upload(`${user.id}/${p.id}.jpg`,b,{contentType:'image/jpeg',upsert:true}); if(!error){p.up=1; save(k)}}catch(e){}}

// ---- Account e sincronizzazione (Supabase) ----
const SB_URL='https://vpzzwmcsnpezrjzndsez.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwenp3bWNzbnBlenJqem5kc2V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MDM3MjUsImV4cCI6MjEwOTM3OTcyNX0.stUk6bheO3O70TKK7LpgMvRYE2Cr-2ubxs4H8vTLEXQ';
const VAPID='BA9KzcxMMJK86IuSqdhKjVm7hd474bp4u8GuyAnRILHSST6KLfCF3NKyIbOP2tCNgwoWJ9PhSWnkPyMj2xb7Ahs';
let sb=null, user=null, syncing=false, pushT=0, lastSync=0, authStep='signup', authEmail='', authMsg='';
try{ if(window.supabase) sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'agenda-auth'}}) }catch(e){sb=null}
const sdot=document.getElementById('sdot'), acct=document.getElementById('acct');
function updateDot(){ if(!sdot) return; sdot.className='sdot'+(!user?'':!navigator.onLine?' off':(syncing||dirty.size)?' wait':' ok') }
function schedulePush(){ if(!sb||!user) return; clearTimeout(pushT); pushT=setTimeout(syncNow,1500) }
async function syncNow(){
  if(!sb||!user||syncing) return; if(!navigator.onLine){updateDot(); return}
  syncing=true; updateDot(); renderAccount();
  try{ await pull(); await push(); lastSync=Date.now() }catch(e){ console.warn('sync',e) }
  syncing=false; updateDot(); renderAccount()}
async function pull(){
  const mk='agenda-pull-'+user.id, since=localStorage.getItem(mk)||'1970-01-01T00:00:00+00:00';
  const {data,error}=await sb.from('days').select('day,data,updated_at').gt('updated_at',since).order('updated_at',{ascending:true}).limit(2000);
  if(error) throw error; let maxT=since; const changed=[];
  for(const r of data||[]){const k=r.day, rd=r.data||{}, ru=rd.u||Date.parse(r.updated_at), ld=store[k];
    if(r.updated_at>maxT) maxT=r.updated_at;
    if(ld&&(ld.u||0)>=ru) continue;
    store[k]=rd; dirty.delete(k); changed.push(k)}
  try{localStorage.setItem(mk,maxT)}catch(e){}
  if(changed.length){ try{localStorage.setItem(KEY,JSON.stringify(store)); localStorage.setItem('agenda-dirty',JSON.stringify([...dirty]))}catch(e){} onRemote(changed) }}
function onRemote(keys){
  if(keys.includes(META)){ if(cur) decorate(cur); renderBmTab() }
  if(cur&&keys.includes(cur.key)&&!flip&&!drawing&&!cur.el.contains(document.activeElement)){
    const old=cur, top=stage.scrollTop; cur=mountSheet(idx,null); removeSheet(old); setDay(cur); fitBook(); stage.scrollTop=top }}
async function push(){
  if(!dirty.size) return; const keys=[...dirty].filter(k=>store[k]);
  const rows=keys.map(k=>({user_id:user.id,day:k,data:store[k],updated_at:new Date().toISOString()}));
  for(let i=0;i<rows.length;i+=200){const {error}=await sb.from('days').upsert(rows.slice(i,i+200),{onConflict:'user_id,day'}); if(error) throw error}
  keys.forEach(k=>dirty.delete(k)); try{localStorage.setItem('agenda-dirty',JSON.stringify([...dirty]))}catch(e){}
  for(const k of keys) for(const p of (store[k].ph||[])) if(!p.up) uploadPhoto(k,p);
  syncReminders(keys.filter(k=>k!==META));
}
function renderAccount(){
  if(!acct) return;
  if(!sb){acct.innerHTML='<h3>Account e sincronizzazione</h3><p class="amsg">Per il primo accesso serve la connessione a internet. Riapri l\'app quando sei online.</p>'; return}
  if(!user){
    const reg=authStep==='signup';
    acct.innerHTML=`<h3>Account e sincronizzazione</h3><p class="amsg">${reg?'Crea il tuo account: l\'agenda viene salvata online e la ritrovi uguale su telefono, tablet e computer.':'Entra con email e password per salvare l\'agenda online e ritrovarla su tutti i tuoi dispositivi.'}</p>
      <input class="acct-in" id="aEmail" type="email" placeholder="nome@email.it" autocomplete="email" value="${esc(authEmail)}">
      <input class="acct-in" id="aPass" type="password" placeholder="${reg?'Scegli una password (almeno 6 caratteri)':'Password'}" autocomplete="${reg?'new-password':'current-password'}">
      <div class="acct-row"><button class="ib sbtn pri" id="${reg?'aSignup':'aLogin'}">${reg?'Crea account':'Entra'}</button><button class="ib" id="aSwitch">${reg?'Ho già un account':'Non hai un account? Crealo'}</button></div>${authMsg?`<p class="amsg">${authMsg}</p>`:''}`;
    return}
  const st=syncing?'Sincronizzazione in corso…':!navigator.onLine?'Sei offline: salvo tutto appena torni in rete':dirty.size?`${dirty.size} ${dirty.size===1?'pagina':'pagine'} da salvare`:lastSync?`Tutto salvato online alle ${new Date(lastSync).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}`:'Collegato';
  acct.innerHTML=`<h3>Account e sincronizzazione</h3><div class="srow"><span>Connesso come <b>${esc(user.email||'')}</b><br><span class="amsg">${st}</span></span><button class="ib sbtn" id="aSync">Sincronizza</button></div><div><button class="ib sbtn" id="aOut">Esci</button></div>`;
}
acct&&acct.addEventListener('click',async e=>{
  const id=e.target.id;
  if(id==='aLogin'||id==='aSignup'){
    const em=(document.getElementById('aEmail').value||'').trim(), pw=document.getElementById('aPass').value||'';
    authEmail=em;
    if(!/^\S+@\S+\.\S+$/.test(em)){authMsg='Scrivi un indirizzo email valido.'; renderAccount(); return}
    if(pw.length<6){authMsg='La password deve avere almeno 6 caratteri.'; renderAccount(); return}
    e.target.disabled=true; e.target.textContent='Un attimo…';
    if(id==='aLogin'){const {error}=await sb.auth.signInWithPassword({email:em,password:pw});
      authMsg=error?(/confirm/i.test(error.message)?'Account non ancora confermato: su Supabase disattiva «Confirm email», poi riprova.':'Email o password non corretti.'):''}
    else {const {data,error}=await sb.auth.signUp({email:em,password:pw});
      if(error) authMsg=/registered|exists/i.test(error.message)?'Questa email ha già un account: usa «Ho già un account».':'Registrazione non riuscita: '+esc(error.message);
      else if(!data.session) authMsg='Account creato, ma Supabase chiede la conferma via email. Disattiva «Confirm email» su Supabase e poi entra qui.';
      else authMsg=''}
    renderAccount()}
  else if(id==='aSwitch'){authStep=authStep==='signup'?'email':'signup'; authMsg=''; renderAccount()}
  else if(id==='aSync'){syncNow()}
  else if(id==='aOut'){await sb.auth.signOut(); toast('Sei uscito. Le pagine restano su questo telefono.',null,3000)}
});
if(sb) sb.auth.onAuthStateChange((ev,session)=>{
  const was=user&&user.id; user=session?session.user:null; updateDot(); renderAccount(); renderPush();
  if(user&&user.id!==was){
    if(!localStorage.getItem('agenda-pull-'+user.id)) for(const k of Object.keys(store)){const d=store[k]; if(k===META||!/\(esempio/.test(JSON.stringify(d.h||{}))) dirty.add(k)}
    syncNow(); if(ev==='SIGNED_IN') toast(`Accesso fatto: ${esc(user.email||'')}. Sincronizzo l'agenda…`,null,3500)}
});
addEventListener('online',()=>{updateDot(); syncNow()}); addEventListener('offline',updateDot);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') syncNow() });
setInterval(()=>{ if(document.visibilityState==='visible') syncNow() },60000);

// ---- Promemoria e notifiche ----
function remLabel(m){return m>=1440?(m===1440?'1 giorno':(m/1440)+' giorni'):m>=60?(m===60?'1 ora':(m/60)+' ore'):m+' minuti'}
// avviso del singolo impegno: -1 nessuno, 0 all'ora esatta, n minuti prima; se non impostato vale l'impostazione generale
function alertFor(d,sl){const v=d.al&&d.al[sl]; if(v!==undefined&&v!==null) return v<0?null:v; return pref.remind>0?pref.remind:null}
const AL_OPTS=[['def',''],[0,"All'ora esatta"],[10,'10 minuti prima'],[30,'30 minuti prima'],[60,'1 ora prima'],[120,'2 ore prima'],[1440,'Il giorno prima'],[-1,'Nessun avviso']];
function alShort(m){return m===0?'ora':m>=1440?(m/1440)+'g':m>=60?(m/60)+'h':m+'′'}
function bellFor(sh,h){
  const row=sh.el.querySelector(`.row[data-h="${h}"]`); if(!row) return; const b=row.querySelector('.bell'); if(!b) return;
  const has=!!(sh.data.h[h]||'').trim(); b.hidden=!has; if(!has) return;
  const v=sh.data.al&&sh.data.al[h]; const custom=v!==undefined&&v!==null;
  b.className='bell'+(custom?(v<0?' off':' on'):(pref.remind>0?' def':' none'));
  b.innerHTML=(custom&&v<0?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 8a6 6 0 019.3-5M18 8c0 7 3 9 3 9H9M3 3l18 18M13.7 21a2 2 0 01-3.4 0M6 8.6V9c0 4-1.2 6.4-2.1 7.7"/></svg>'
    :'<svg viewBox="0 0 24 24" fill="'+(custom?'currentColor':'none')+'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>')
    +(custom&&v>=0?`<i>${alShort(v)}</i>`:'');
  b.setAttribute('aria-label',custom?(v<0?'Nessun avviso':'Avviso '+(v?remLabel(v)+' prima':"all'ora esatta")):'Avviso: come da impostazioni');
}
const alMenu=document.getElementById('alMenu');
function openAlertMenu(sh,h,anchor){
  const txt=(sh.data.h[h]||'').split('\n')[0], v=sh.data.al&&sh.data.al[h];
  alMenu.innerHTML=`<p class="al-t">Avviso per <b>${esc(spokenLine(txt)||'questo impegno')}</b></p>`+AL_OPTS.map(([val,lab])=>{
    const sel=val==='def'?(v===undefined||v===null):v===val;
    const label=val==='def'?`Come da impostazioni (${pref.remind>0?remLabel(pref.remind)+' prima':'nessun avviso'})`:lab;
    return `<button data-al="${val}" aria-pressed="${sel}">${label}</button>`}).join('');
  alMenu.hidden=false;
  const r=anchor.getBoundingClientRect(), mw=alMenu.offsetWidth, mh=alMenu.offsetHeight, vw=innerWidth, vh=innerHeight;
  alMenu.style.left=Math.max(12,Math.min(vw-mw-12,r.right-mw))+'px';
  alMenu.style.top=(r.bottom+8+mh<vh-80?r.bottom+8:Math.max(12,r.top-mh-8))+'px';
  alMenu.onclick=e=>{const b=e.target.closest('[data-al]'); if(!b) return; const val=b.dataset.al;
    sh.data.al=sh.data.al||{}; if(val==='def') delete sh.data.al[h]; else sh.data.al[h]=+val; commit(sh); bellFor(sh,h); alMenu.hidden=true;
    const eff=alertFor(sh.data,h);
    toast(eff===null?'Nessun avviso per questo impegno':`Ti avviso ${eff?remLabel(eff)+' prima':"all'ora esatta"}`+((!user||Notification.permission!=='granted')?'<small>Per ricevere gli avvisi entra e attiva le notifiche in ⚙ Impostazioni</small>':''),null,3500)};
}
document.addEventListener('pointerdown',e=>{ if(!alMenu.hidden&&!e.target.closest('#alMenu')) alMenu.hidden=true },true);
function futureKeys(){const t=keyOf(T0); return Object.keys(store).filter(k=>k!==META&&k>=t)}
async function syncReminders(keys){
  if(!sb||!user||!keys.length) return; const now=Date.now();
  for(const k of keys){ const dt=keyDate(k); if(idxOf(dt)<-1) continue; const rows=[];
    {const d=store[k]||{};
      for(const sl of Object.keys(d.h||{})){ if(d.d&&d.d[sl]) continue; const mins=alertFor(d,sl); if(mins===null) continue;
        (d.h[sl]||'').split('\n').forEach(l=>{ if(!l.trim()) return; const m=l.match(/^\s*(\d{1,2})[:.](\d{2})\s+/); const hh=m?+m[1]:+sl, mm=m?+m[2]:0;
          const at=new Date(dt.getFullYear(),dt.getMonth(),dt.getDate(),hh,mm), fire=new Date(at.getTime()-mins*60000); if(fire.getTime()<=now) return;
          const hm=`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
          rows.push({user_id:user.id,day:k,fire_at:fire.toISOString(),title:`${hm} · ${spokenLine(l)}`,body:`${GG[dt.getDay()]} ${dt.getDate()} ${MM[dt.getMonth()].toLowerCase()} · ${mins?'tra '+remLabel(mins):'adesso'}`}) }) } }
    try{ await sb.from('reminders').delete().eq('day',k).is('sent_at',null); if(rows.length) await sb.from('reminders').insert(rows) }catch(e){} }
}
function b64u(s){const p='='.repeat((4-s.length%4)%4), b=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from(b,c=>c.charCodeAt(0))}
const pushTxt=document.getElementById('pushTxt'), pushBtn=document.getElementById('pushBtn'), remSel=document.getElementById('remSel');
const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
async function renderPush(){
  if(!pushTxt) return; pushBtn.hidden=false; pushBtn.disabled=false; pushBtn.textContent='Attiva';
  if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){
    pushTxt.textContent=isIOS&&!standalone?'Su iPhone le notifiche funzionano solo con l\'app aggiunta alla schermata Home e aperta da lì.':'Questo browser non supporta le notifiche.'; pushBtn.hidden=true; return}
  if(!user){pushTxt.textContent='Per i promemoria entra prima con la tua email (sopra).'; pushBtn.hidden=true; return}
  let sub=null; try{const reg=await navigator.serviceWorker.ready; sub=await reg.pushManager.getSubscription()}catch(e){}
  if(Notification.permission==='granted'&&sub){pushTxt.textContent='Notifiche su questo telefono: attive'; pushBtn.textContent='Attive'; pushBtn.disabled=true}
  else if(Notification.permission==='denied'){pushTxt.textContent='Notifiche bloccate: abilitale per questa app nelle impostazioni del telefono.'; pushBtn.hidden=true}
  else pushTxt.textContent='Notifiche su questo telefono: non attive';
}
pushBtn&&pushBtn.addEventListener('click',async()=>{
  try{const perm=await Notification.requestPermission(); if(perm!=='granted'){renderPush(); return}
    const reg=await navigator.serviceWorker.ready; let sub=await reg.pushManager.getSubscription();
    if(!sub) sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(VAPID)});
    const j=sub.toJSON(); const {error}=await sb.from('push_subscriptions').upsert({endpoint:j.endpoint,user_id:user.id,p256dh:j.keys.p256dh,auth:j.keys.auth},{onConflict:'endpoint'});
    if(error) throw error;
    if(!pref.remind){pref.remind=60; savePref(); remSel.value='60'}
    syncReminders(futureKeys()); toast('Notifiche attive: ti avviso '+remLabel(pref.remind)+' prima di ogni impegno con orario.',null,4000);
  }catch(e){toast('Non sono riuscito ad attivare le notifiche su questo telefono.',null,3500)}
  renderPush();
});
remSel&&remSel.addEventListener('change',()=>{pref.remind=+remSel.value; savePref(); syncReminders(futureKeys()); if(cur) decorate(cur)});
if('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message',ev=>{const d=ev.data||{}; if(d.type==='goto'&&d.day){closeCover(true); goTo(idxOf(keyDate(d.day)))}});

// ---- Impostazioni ----
const tVoice=document.getElementById('tVoice'), tSound=document.getElementById('tSound'), tCover=document.getElementById('tCover');
document.getElementById('setBtn').onclick=()=>{tVoice.checked=pref.voice; tSound.checked=pref.sound; tCover.checked=pref.cover; remSel.value=String(pref.remind); renderAccount(); renderPush(); openSheet(setScrim)};
tVoice.onchange=()=>{pref.voice=tVoice.checked; savePref(); if(pref.voice) say('Ok, ti risponderò a voce.')};
tSound.onchange=()=>{pref.sound=tSound.checked; savePref(); if(pref.sound){wakeAudio(); pageSound(1)}};
tCover.onchange=()=>{pref.cover=tCover.checked; savePref()};

// ---- Copertina del mattino ----
const coverEl=document.getElementById('cover');
function li(x){return `<li class="${x.done?'done':''}"><b>${x.t||'note'}</b><span>${esc(x.text)}</span></li>`}
function showCover(){
  const d=new Date(T0), tm=dateOf(1), h=new Date().getHours();
  document.getElementById('cvYear').textContent=d.getFullYear();
  document.getElementById('cvHello').textContent=h<12?'Buongiorno':h<18?'Buon pomeriggio':'Buonasera';
  document.getElementById('cvDate').textContent=`${GG[d.getDay()]} ${d.getDate()} ${MM[d.getMonth()]} · settimana ${isoWeek(d)}`;
  const a=dayItems(keyOf(d)).filter(x=>!/\(esempio/.test(x.text)), b=dayItems(keyOf(tm));
  document.getElementById('cvToday').innerHTML=a.length?a.map(li).join(''):'<li class="none">Nessun impegno: giornata libera.</li>';
  document.getElementById('cvTomorrow').innerHTML=b.length?b.map(li).join(''):'<li class="none">Niente in programma.</li>';
  const ex=[], bm=meta().bm, fc=Object.keys(store).filter(k=>k!==META&&store[k]&&store[k].f).length, pc=pendingCarry().length;
  if(bm) ex.push('Segnalibro su '+fmtKey(bm)); if(fc) ex.push(fc+(fc>1?' pagine piegate':' pagina piegata')); if(pc) ex.push(pc+(pc>1?' impegni da riportare':' impegno da riportare'));
  document.getElementById('cvExtra').textContent=ex.join(' · ');
  coverEl.classList.remove('open'); coverEl.hidden=false;
}
function closeCover(quiet){ if(coverEl.hidden) return; coverEl.classList.add('open'); if(!quiet) pageSound(1); setTimeout(()=>{coverEl.hidden=true},720) }
document.getElementById('cvRead').addEventListener('click',e=>{e.stopPropagation(); wakeAudio();
  const t=daySummary(new Date(T0)), m=daySummary(dateOf(1)); say(`${document.getElementById('cvHello').textContent}. ${t.spoken} ${m.spoken}`)});
let cvX=null;
coverEl.addEventListener('pointerdown',e=>{cvX=e.clientX; wakeAudio()});
coverEl.addEventListener('pointerup',e=>{ if(e.target.closest('.cv-read')) return; closeCover() });

try{if(localStorage.getItem(KEY+'-week')==='1') book.classList.add('week-open')}catch(e){}
const qDay=new URLSearchParams(location.search).get('day');
lastW=stage.clientWidth; layout(); cur=mountSheet(0,null); setDay(cur); fitBook(); updateLabel(); updateDot(); renderAccount();
if(qDay&&/^\d{4}-\d{2}-\d{2}$/.test(qDay)){history.replaceState(null,'',location.pathname); setTimeout(()=>goTo(idxOf(keyDate(qDay))),300)}
else if(pref.cover) showCover();
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{if(cur) refresh(cur); fitBook()});
toast('Due dita per zoom e scorrimento · trascina dal bordo o di lato per sfogliare',null,5000);
})();
