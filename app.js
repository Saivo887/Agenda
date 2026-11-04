(function(){
const GG=['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
const GS=['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const GL=['D','L','M','M','G','V','S'];
const MM=['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const DAYC=[['#e8382f','#ffffff'],['#ff6a3d','#ffffff'],['#f2b01e','#2a1d00'],['#13a47f','#ffffff'],['#2f6fff','#ffffff'],['#d63c86','#ffffff'],['#6f55ff','#ffffff']];
const FIX={'1-1':'Capodanno','1-6':'Epifania','4-25':'Liberazione','5-1':'Festa del Lavoro','6-2':'Festa della Repubblica','8-15':'Ferragosto','11-1':'Ognissanti','12-8':'Immacolata','12-25':'Natale','12-26':'Santo Stefano'};
const HOURS=[];for(let h=7;h<=21;h++)HOURS.push(h);
const KEY='agenda-sfogliabile-v2';

const book=document.getElementById('book'), stage=document.getElementById('stage'), root=document.documentElement;
const T0=new Date(); T0.setHours(0,0,0,0);
let idx=0, cur=null, flip=null, mode='pen', ink='1', penSeen=false, zoom=1, lastW=0;
let gesture=null, drawing=null, pinch=null; const ptrs=new Map(); const undoMap={};

// ---- Dati ----
let store={};
try{store=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(e){store={}}
if(!Object.keys(store).length){
  try{const v1=JSON.parse(localStorage.getItem('agenda-sfogliabile-v1')||'{}');
    for(const k in v1){const o=v1[k], h={}; (o.t||'').split('\n').forEach((l,j)=>{if(l.trim()&&j<HOURS.length)h[HOURS[j]]=l});
      store[k]={h,n:'',s:(o.s||[]).map(s=>({c:s.c==='nero'?'2':s.c==='rosso'?'3':'1',w:s.w,p:s.p.map(q=>[q[0],q[1]/.7,q[2]])}))}}}catch(e){}
}
if(!Object.keys(store).length) store[keyOf(T0)]={h:{9:'Riunione di reparto (esempio)',13:'Pranzo (esempio, cancella pure)'},n:'',s:[]};
let saveT; function save(){clearTimeout(saveT); saveT=setTimeout(()=>{try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){}},300)}
function dataFor(k){const d=store[k]||{}; return {h:d.h||{},n:d.n||'',s:d.s||[]}}
function commit(sh){store[sh.key]=sh.data; save()}

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
    <div class="slots">${HOURS.map(h=>`<div class="row${isToday&&h===nowH?' now':''}"><span class="hr">${String(h).padStart(2,'0')}:00</span><textarea class="t" data-h="${h}" rows="1" spellcheck="false" aria-label="Ore ${h}"></textarea></div>`).join('')}</div>
    <div class="notes"><div class="nl">Note</div><textarea class="t" data-h="n" spellcheck="false" aria-label="Note"></textarea></div>
    <canvas class="ink"></canvas><div class="shade"></div></div>
    <div class="face back"><div class="shade"></div></div>`;
  book.insertBefore(el,before||null);
  const front=el.querySelector('.front');
  const sh={el,front,idx:i,key:k,data:dataFor(k),canvas:el.querySelector('canvas'),tas:[...el.querySelectorAll('textarea')],
    shF:front.querySelector('.shade'),shB:el.querySelector('.back .shade'),color:[bg,fg]};
  sh.tas.forEach(ta=>{const h=ta.dataset.h; ta.value=h==='n'?sh.data.n:(sh.data.h[h]||'');
    ta.addEventListener('input',()=>{ if(h==='n') sh.data.n=ta.value; else { if(ta.value) sh.data.h[h]=ta.value; else delete sh.data.h[h] } grow(ta); commit(sh)})});
  el.querySelectorAll('.chip').forEach(c=>c.addEventListener('click',()=>goTo(+c.dataset.i)));
  el.querySelector('.wk-toggle').addEventListener('click',()=>{const on=book.classList.toggle('week-open');
    el.querySelector('.wk-toggle').setAttribute('aria-expanded',on); try{localStorage.setItem(KEY+'-week',on?'1':'0')}catch(e){}});
  el.querySelector('.wk-toggle').setAttribute('aria-expanded',book.classList.contains('week-open'));
  refresh(sh);
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
  sh.ctx=sh.canvas.getContext('2d'); sh.ctx.setTransform(dpr,0,0,dpr,0,0); sh.ctx.lineCap='round'; sh.ctx.lineJoin='round'}
function lw(sh,s,q){return Math.max(.6,s.w*sh.W*(.55+.9*q[2]))}
function seg(sh,s,i){const a=s.p[i-1],b=s.p[i],c=sh.ctx; c.strokeStyle=inkColor(s.c); c.lineWidth=lw(sh,s,b);
  c.beginPath(); c.moveTo(a[0]*sh.W,a[1]*sh.W); c.lineTo(b[0]*sh.W,b[1]*sh.W); c.stroke()}
function dot(sh,s){const a=s.p[0],c=sh.ctx; c.fillStyle=inkColor(s.c); c.beginPath(); c.arc(a[0]*sh.W,a[1]*sh.W,lw(sh,s,a)/2,0,7); c.fill()}
function redraw(sh){if(!sh.ctx)return; sh.ctx.clearRect(0,0,sh.W,sh.H); for(const s of sh.data.s){ if(s.p.length===1) dot(sh,s); else for(let i=1;i<s.p.length;i++) seg(sh,s,i)}}
function fitBook(){let h=0; book.querySelectorAll('.sheet').forEach(s=>h=Math.max(h,s.offsetHeight)); book.style.height=h+'px'}
function setDay(sh){root.style.setProperty('--day',sh.color[0]); root.style.setProperty('--day-ink',sh.color[1])}

// ---- Layout e zoom ----
function stageInner(){const cs=getComputedStyle(stage); return stage.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)}
function layout(){
  const W=Math.round(Math.min(stageInner(),600)*zoom);
  book.style.width=W+'px'; book.style.setProperty('--pw',W+'px');
  document.getElementById('zreset').textContent=Math.round(zoom*100)+'%';
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
document.getElementById('zin').onclick=()=>setZoom(zoom*1.25,...stageCenter());
document.getElementById('zout').onclick=()=>setZoom(zoom/1.25,...stageCenter());
document.getElementById('zreset').onclick=()=>setZoom(1,...stageCenter());

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
  setP(done?1:0); if(done) setDay(f.dir>0?f.under:f.leaf);
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
function cancelDrawing(){ if(!drawing) return; const st=undoMap[drawing.sh.key]; if(st&&st.length){drawing.sh.data.s=JSON.parse(st.pop()); redraw(drawing.sh)} drawing=null }
function visRect(){const b=book.getBoundingClientRect(), s=stage.getBoundingClientRect(); return {left:Math.max(b.left,s.left),right:Math.min(b.right,s.right)}}

stage.addEventListener('pointerdown',e=>{
  if(e.target.closest('.chip,.wk-toggle')) return;
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(e.pointerType==='pen') penSeen=true;
  if(ptrs.size===2){
    const ps=[...ptrs.values()]; cancelDrawing();
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
  const inBook=!!e.target.closest('.book');
  const onEdge=inBook?(e.clientX>vr.right-edgeW?1:e.clientX<vr.left+edgeW?-1:0):0;
  if(onCanvas&&!onEdge&&!(penSeen&&e.pointerType==='touch')&&(mode==='pen'||mode==='erase')){
    e.preventDefault(); const sh=cur, rc=sh.canvas.getBoundingClientRect(); pushUndo(sh); const pt=ptOf(e,rc);
    if(mode==='erase'){drawing={sh,rc,erase:true,hit:false,id:e.pointerId}; eraseAt(sh,pt)}
    else{const s={c:ink,w:.0046,p:[pt]}; sh.data.s.push(s); dot(sh,s); drawing={sh,rc,s,id:e.pointerId}}
    return;
  }
  const onTA=e.target.tagName==='TEXTAREA';
  if(onTA&&e.pointerType==='mouse') return;
  gesture={id:e.pointerId,x0:e.clientX,y0:e.clientY,axis:null,dir:0,edge:onEdge,w:Math.max(200,vr.right-vr.left),moved:0,sx:stage.scrollLeft,sy:stage.scrollTop,onTA};
  if(!onTA) e.preventDefault();
});
stage.addEventListener('pointermove',e=>{
  if(ptrs.has(e.pointerId)) ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pinch&&ptrs.size>=2){const ps=[...ptrs.values()], d=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);
    const z=Math.max(.6,Math.min(3,pinch.z0*d/pinch.d0)); pinch.r=z/pinch.z0; pinch.mx=(ps[0].x+ps[1].x)/2; pinch.my=(ps[0].y+ps[1].y)/2;
    book.style.transform=`translate(${pinch.mx-pinch.mx0}px,${pinch.my-pinch.my0}px) scale(${pinch.r})`; return}
  if(drawing&&e.pointerId===drawing.id){
    const evs=(e.getCoalescedEvents&&e.getCoalescedEvents())||[]; for(const ev of (evs.length?evs:[e])){const pt=ptOf(ev,drawing.rc);
      if(drawing.erase) eraseAt(drawing.sh,pt);
      else{const s=drawing.s,l=s.p[s.p.length-1]; if(Math.hypot(pt[0]-l[0],pt[1]-l[1])*drawing.sh.W<1.2) continue;
        if(e.pointerType==='pen') pt[2]=+(l[2]*.6+pt[2]*.4).toFixed(2); s.p.push(pt); seg(drawing.sh,s,s.p.length-1)}}
    return}
  if(gesture&&e.pointerId===gesture.id){
    const dx=e.clientX-gesture.x0, dy=e.clientY-gesture.y0; gesture.moved=Math.max(gesture.moved,Math.hypot(dx,dy));
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
  ptrs.delete(e.pointerId);
  if(pinch){ if(ptrs.size<2){const p=pinch; pinch=null; book.style.transform=''; book.style.transformOrigin='';
      zoom=Math.max(.6,Math.min(3,p.z0*p.r)); layout(); const r1=book.getBoundingClientRect();
      stage.scrollLeft+=r1.left+p.u*r1.width-p.mx; stage.scrollTop+=r1.top+p.v*r1.width-p.my; ptrs.clear()} return }
  if(drawing&&e.pointerId===drawing.id){const d=drawing; drawing=null; if(d.erase&&!d.hit) undoMap[d.sh.key].pop(); commit(d.sh)}
  if(gesture&&e.pointerId===gesture.id){const g=gesture; gesture=null;
    if(g.axis==='x') endFlip((flip?flip.p:0)>.28);
    else if(!g.axis&&g.edge&&g.moved<8) animateFlip(g.edge);
  }
}
stage.addEventListener('pointerup',release); stage.addEventListener('pointercancel',release);

// ---- Controlli ----
const dateTxt=document.getElementById('dateTxt'), datePick=document.getElementById('datePick');
function updateLabel(){const d=dateOf(idx); dateTxt.textContent=`${GS[d.getDay()]} ${d.getDate()} ${MM[d.getMonth()].slice(0,3)}${d.getFullYear()!==T0.getFullYear()?' '+d.getFullYear():''}`; datePick.value=keyOf(d)}
datePick.addEventListener('change',()=>{if(!datePick.value) return; const [y,m,dd]=datePick.value.split('-').map(Number); goTo(idxOf(new Date(y,m-1,dd)))});
document.getElementById('prev').onclick=()=>animateFlip(-1);
document.getElementById('next').onclick=()=>animateFlip(1);
document.getElementById('today').onclick=()=>goTo(0);
const modes={pen:'m-pen',type:'m-type',erase:'m-erase'}, inks=document.getElementById('inks');
function setMode(m){mode=m; book.classList.remove('mode-pen','mode-type','mode-erase'); book.classList.add('mode-'+m);
  for(const k in modes) document.getElementById(modes[k]).setAttribute('aria-pressed',k===m);
  inks.hidden=m!=='pen';
  if(m!=='type'&&document.activeElement&&document.activeElement.blur) document.activeElement.blur()}
for(const k in modes) document.getElementById(modes[k]).onclick=()=>setMode(k);
inks.querySelectorAll('.sw').forEach(b=>b.onclick=()=>{ink=b.dataset.c; inks.querySelectorAll('.sw').forEach(x=>x.setAttribute('aria-pressed',x===b))});
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
  let t=s.replace(/^\s*(?:per\s+favore\s+)?(?:segnami|segna(?:re)?|ricordami(?:\s+di)?|ricorda|aggiungi|mettimi|metti|annota(?:mi)?|appunta(?:mi)?|scrivi|nota)\b\s*(?:che\s+)?(?:(?:un|uno|una|il|lo|la|l')\s*)?/i,' ');
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
Rispondi solo con JSON: {"date":"YYYY-MM-DD","hour":numero 0-23 oppure null,"minute":numero 0-59 oppure null,"text":"l'appunto, breve, senza data né ora né parole come segnami o ricordami","note":"stringa vuota, oppure un avviso se la richiesta è ambigua o contraddittoria"}.
Se non c'è una data usa oggi. "Alle 4" per un appuntamento significa 16.
Richiesta: ${JSON.stringify(src)}`;
  try{const r=await sample.json(prompt,{modelTier:'quick'});
    if(!r||!/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')) return null;
    const [y,mo,dd]=r.date.split('-').map(Number); let h=Number.isInteger(r.hour)?r.hour:null, mi=Number.isInteger(r.minute)?r.minute:0;
    return {found:true,date:new Date(y,mo-1,dd),hour:h,minute:h===null?null:mi,text:String(r.text||src).trim()||src,warn:String(r.note||'')};
  }catch(e){return null}
}

// ---- Scrittura nell'agenda ----
function addEntry(p){
  const k=keyOf(p.date), slot=(p.hour!==null&&p.hour>=7&&p.hour<=21)?String(p.hour):'n';
  const time=p.hour!==null?`${String(p.hour).padStart(2,'0')}:${String(p.minute||0).padStart(2,'0')} `:'';
  const line=(slot!=='n'&&!p.minute?'':time)+p.text;
  const sameCur=cur&&cur.key===k&&!flip;
  const data=sameCur?cur.data:(store[k]?(store[k].h=store[k].h||{},store[k].n=store[k].n||'',store[k].s=store[k].s||[],store[k]):(store[k]={h:{},n:'',s:[]}));
  const prev=slot==='n'?data.n:(data.h[slot]||'');
  const next=prev?prev.replace(/\s+$/,'')+'\n'+line:line;
  if(slot==='n') data.n=next; else data.h[slot]=next;
  store[k]=data; save();
  const restore=()=>{const dd=(cur&&cur.key===k)?cur.data:store[k]; if(slot==='n') dd.n=prev; else if(prev) dd.h[slot]=prev; else delete dd.h[slot];
    store[k]=dd; save(); if(cur&&cur.key===k){const ta=cur.tas.find(t=>t.dataset.h===slot); ta.value=prev; grow(ta)} toast('Appunto rimosso',null,2500)};
  const show=()=>{ if(!cur||cur.key!==k) return; const ta=cur.tas.find(t=>t.dataset.h===slot); ta.value=slot==='n'?data.n:(data.h[slot]||''); grow(ta);
    const row=ta.closest('.row')||ta.closest('.notes'); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
    const sr=stage.getBoundingClientRect(), rr=row.getBoundingClientRect(); stage.scrollTop+=rr.top-sr.top-sr.height*.3};
  const ti=idxOf(p.date);
  if(sameCur) show(); else if(!flip){goTo(ti); setTimeout(show,(parseFloat(getComputedStyle(root).getPropertyValue('--dur'))||0)*1000+120)}
  const when=`${GG[p.date.getDay()]} ${p.date.getDate()} ${MM[p.date.getMonth()].toLowerCase()}${p.hour!==null?`, ore ${String(p.hour).padStart(2,'0')}:${String(p.minute||0).padStart(2,'0')}`:', nelle note'}`;
  toast(`<span>Segnato: ${esc(p.text)}<small>${esc(when)}${p.warn?' · '+esc(p.warn):''}</small></span>`,restore,p.warn?9000:6000);
}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

// ---- Pannello vocale ----
const vscrim=document.getElementById('vscrim'), vtext=document.getElementById('vtext'), vstat=document.getElementById('vstat'), vmic=document.getElementById('vmic'), vgo=document.getElementById('vgo');
const SR=window.SpeechRecognition||window.webkitSpeechRecognition; let rec=null, recOn=false, micBlocked=!SR;
const HINT_KB='Il microfono diretto non è disponibile qui: tocca il <b>microfono della tastiera</b> del telefono e detta nel riquadro, poi premi <b>Segna in agenda</b>.';
function openVoice(){vscrim.hidden=false; vtext.value=''; vgo.disabled=true; vgo.textContent='Segna in agenda';
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
  try{rec.start(); recOn=true; vmic.classList.add('live'); vmic.setAttribute('aria-label','Ferma'); vstat.textContent='Ti ascolto…'}
  catch(e){micBlocked=true; vstat.innerHTML=HINT_KB; vtext.focus()}
}
function stopRec(){ if(rec&&recOn){try{rec.stop()}catch(e){}} }
async function submitVoice(){
  const src=vtext.value.trim(); if(!src) return; stopRec();
  vgo.disabled=true; vgo.textContent='Sto segnando…';
  let p=parseLocal(src);
  if(!p.found){vstat.textContent='Sto capendo la data…'; const c=await parseWithClaude(src); if(c) p=c}
  closeVoice(); addEntry(p);
}
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

try{if(localStorage.getItem(KEY+'-week')==='1') book.classList.add('week-open')}catch(e){}
lastW=stage.clientWidth; layout(); cur=mountSheet(0,null); setDay(cur); fitBook(); updateLabel();
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{if(cur) refresh(cur); fitBook()});
toast('Due dita per zoom e scorrimento · trascina dal bordo o di lato per sfogliare',null,5000);
})();
