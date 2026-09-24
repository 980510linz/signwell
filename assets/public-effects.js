(()=>{'use strict';
const VERSION='24.36.2-effects-r1';
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
const coarse=matchMedia('(pointer:coarse)').matches||!matchMedia('(hover:hover)').matches;
const CARD_SEL='.article-card,.topic-card,.person-card,.hero-card,.share-card,.newsletter-card,.panel,.summary10s';
const qsa=(s,r=document)=>[...r.querySelectorAll(s)];

function mountScene(){
  if(document.querySelector('.swfx-scene'))return;
  const scene=document.createElement('div');scene.className='swfx-scene';scene.setAttribute('aria-hidden','true');
  scene.innerHTML='<i class="swfx-orb a"></i><i class="swfx-orb b"></i><i class="swfx-orb c"></i>';
  document.body.prepend(scene);
}

let active=null,raf=0;
function startLoop(state){
  if(raf)return;
  const step=()=>{
    raf=0;if(!state||state!==active)return;
    state.cx+=(state.tx-state.cx)*.145;state.cy+=(state.ty-state.cy)*.145;state.cv+=(state.tv-state.cv)*.18;
    const rx=(-state.cy*4.4).toFixed(3),ry=(state.cx*5.4).toFixed(3),lift=(Math.min(3.2,1.1+state.cv*2.1)).toFixed(2);
    state.el.style.transform=`perspective(980px) translate3d(0,-${lift}px,0) rotateX(${rx}deg) rotateY(${ry}deg)`;
    state.el.style.setProperty('--swfx-x',`${(50+state.cx*30).toFixed(1)}%`);
    state.el.style.setProperty('--swfx-y',`${(34+state.cy*24).toFixed(1)}%`);
    state.el.style.setProperty('--swfx-v',state.cv.toFixed(3));
    const unsettled=Math.abs(state.tx-state.cx)>.006||Math.abs(state.ty-state.cy)>.006||Math.abs(state.tv-state.cv)>.015;
    if(state.leaving&&!unsettled){state.el.style.removeProperty('transform');state.el.style.setProperty('--swfx-v','0');state.el.classList.remove('swfx-active');active=null;return;}
    raf=requestAnimationFrame(step);
  };
  raf=requestAnimationFrame(step);
}
function bindTilt(el){
  if(el.dataset.swfxTilt)return;el.dataset.swfxTilt='1';el.classList.add('swfx-card');
  if(coarse||reduced)return;
  const state={el,tx:0,ty:0,cx:0,cy:0,tv:0,cv:0,lastX:0,lastY:0,lastT:0,leaving:false};
  el.addEventListener('pointerenter',e=>{active=state;state.leaving=false;state.lastX=e.clientX;state.lastY=e.clientY;state.lastT=performance.now();el.classList.add('swfx-active');startLoop(state)},{passive:true});
  el.addEventListener('pointermove',e=>{if(active!==state)active=state;const r=el.getBoundingClientRect(),nx=Math.max(-1,Math.min(1,(e.clientX-r.left)/Math.max(1,r.width)*2-1)),ny=Math.max(-1,Math.min(1,(e.clientY-r.top)/Math.max(1,r.height)*2-1));const now=performance.now(),dt=Math.max(8,now-state.lastT||16),speed=Math.min(1,Math.hypot(e.clientX-state.lastX,e.clientY-state.lastY)/(dt*.9));state.tx=nx+Math.sign(nx)*speed*.035;state.ty=ny+Math.sign(ny)*speed*.025;state.tv=speed;state.lastX=e.clientX;state.lastY=e.clientY;state.lastT=now;state.leaving=false;startLoop(state)},{passive:true});
  el.addEventListener('pointerleave',()=>{state.tx=0;state.ty=0;state.tv=0;state.leaving=true;startLoop(state)},{passive:true});
}
function enhance(root=document){qsa(CARD_SEL,root).forEach(bindTilt)}

function reveal(){
  if(reduced)return;const app=document.getElementById('app');if(!app)return;
  const nodes=[...app.children,...qsa('.article-card,.topic-card,.person-card,.hero-card,.share-card,.newsletter-card,.summary10s',app)].filter((x,i,a)=>a.indexOf(x)===i).slice(0,22);
  nodes.forEach((el,i)=>{el.classList.add('swfx-reveal');el.animate([{opacity:.18,transform:'translate3d(0,14px,0) scale(.994)'},{opacity:1,transform:'translate3d(0,0,0) scale(1)'}],{duration:420+Math.min(i,8)*18,delay:Math.min(i,10)*28,easing:'cubic-bezier(.18,.82,.2,1)',fill:'both'}).finished.catch(()=>{}).finally(()=>{el.style.opacity='';el.style.transform='';});});
}

function bindPress(){
  document.addEventListener('pointerdown',e=>{const el=e.target.closest('button,.brand-top,.nav-item');if(!el||reduced||!el.animate)return;el.animate([{scale:'1'},{scale:'.965',offset:.30},{scale:'1.018',offset:.66},{scale:'1'}],{duration:360,easing:'cubic-bezier(.18,.82,.2,1)'});},{passive:true});
}

function bindDockOptics(){
  const pager=document.getElementById('pager'),thumb=document.getElementById('navThumb');if(!pager||!thumb)return;
  let lastX=0,lastT=performance.now(),pending=0,frame=0;
  pager.addEventListener('pointermove',e=>{pending=e.clientX;if(frame)return;frame=requestAnimationFrame(()=>{frame=0;const r=pager.getBoundingClientRect(),x=Math.max(0,Math.min(1,(pending-r.left)/Math.max(1,r.width))),now=performance.now(),dt=Math.max(8,now-lastT),speed=Math.min(1,Math.abs(pending-lastX)/(dt*.8));pager.style.setProperty('--swfx-dock-x',`${(x*100).toFixed(1)}%`);pager.style.setProperty('--swfx-dock-speed',speed.toFixed(3));lastX=pending;lastT=now;});},{passive:true});
  const settle=()=>pager.style.setProperty('--swfx-dock-speed','0');pager.addEventListener('pointerup',settle,{passive:true});pager.addEventListener('pointercancel',settle,{passive:true});pager.addEventListener('pointerleave',settle,{passive:true});
}

function observeApp(){
  const app=document.getElementById('app');if(!app)return;
  let t=0;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>{enhance(app);reveal()},32)}).observe(app,{childList:true,subtree:true});
  enhance(app);setTimeout(reveal,70);
}

mountScene();bindPress();bindDockOptics();observeApp();
window.SIGNWELL_PUBLIC_EFFECTS=Object.freeze({version:VERSION,refresh:()=>{enhance(document.getElementById('app')||document);reveal()}});
})();
