/* =========================================================
   SIGN WELL · Differential Liquid Glass Physics · v23.9.90

   pointer position -> trig map (sin/atan2/cos)
   pointer velocity -> dx/dt low-pass response
   pointer acceleration -> optical lag only
   card transform -> damped spring ODE
       x'' = k(target - x) - c x'
   settled -> requestAnimationFrame fully parked

   No gyroscope. Reduced motion / Lite / hidden tabs disable physics.
   ========================================================= */
(()=>{
  'use strict';
  if(window.SignWellLiquidGlassMotion?.version==='23.9.90-STAGING')return;

  const M=window.SignWellMath||{};
  const HALF_PI=Math.PI/2;
  const clamp=M.clamp||((v,min,max)=>Math.min(max,Math.max(min,Number(v)||0)));
  const finePointer=matchMedia('(pointer:fine)').matches;
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');

  function trigAxis(value){return Math.sin(clamp(value,-1,1)*HALF_PI)}
  function trigVector(nx,ny){
    const distance=Math.min(1,Math.hypot(nx,ny));
    if(distance<.0001)return{x:0,y:0,angle:0,distance:0};
    const angle=Math.atan2(ny,nx), eased=Math.sin(distance*HALF_PI);
    return{x:Math.cos(angle)*eased,y:Math.sin(angle)*eased,angle,distance:eased};
  }
  function springStep(position,velocity,target,dt,stiffness,damping,mass=1){
    if(M.springStep)return M.springStep(position,velocity,target,dt,stiffness,damping,mass);
    dt=clamp(dt||1/60,1/240,1/30); mass=Math.max(.001,Number(mass)||1);
    const acceleration=((target-position)*stiffness-velocity*damping)/mass;
    velocity+=acceleration*dt; position+=velocity*dt;
    return{position,velocity,acceleration};
  }
  function velocityGlow(v,reference=1800){
    const r=clamp(Math.abs(v)/reference,0,1); return r*r;
  }

  const TARGETS=[
    /* Public */
    '.hero-card','.home-hero-card','.article-card','.topic-card','.share-card','.newsletter-card',
    '.about-manifesto','.about-value','.about-team-card','.person-card','.searchbox','.idle-subscribe-card',
    '.newsletter-terms-card','.newsletter-flow-card','.sw-continue-card','.sw-related-card','.sw-article-join-card',
    /* CMS */
    '.lock-card','.login-sync-card','.stat','.panel','.settings-integration-card','.settings-detail-shell',
    '.social-studio-card','.social-studio-chat','.social-preview-panel','.publish-card','.modal-card',
    '.preview-shell','.review-inbox-card','.newsletter-send-card','.newsletter-admin-card','.sw-editor-toolbar-v23988'
  ].join(',');
  const EXCLUDES=[
    '.article-body','.article-page','.article-content','.preview-content','.review-inbox-preview',
    '.content-area','[contenteditable="true"]','.editor-main .content-area','.social-chat-compose','textarea','input','select'
  ].join(',');
  const NATIVE_TRANSFORM='.hero-card,.article-card,.topic-card,.share-card,.lock-card,.stat,.panel';
  const REFLECT_ONLY='.searchbox,.newsletter-terms-card,.sw-continue-card,.modal-card,.review-inbox-card,.sw-editor-toolbar-v23988';
  const LARGE_PUBLIC='.hero-card,.home-hero-card,.newsletter-card,.about-manifesto';
  const LARGE_CMS='.lock-card,.login-sync-card,.settings-detail-shell,.social-studio-card,.social-studio-chat,.social-preview-panel,.publish-card,.preview-shell';
  const BUTTONS='.tool,.iconbtn,.pager button,.settings-integration-card button,.settings-detail-shell button,.social-studio-card button,.sw-editor-toolbar-v23988 button';

  let active=null,activeRect=null,rafId=0,mutationRAF=0;
  const pendingRoots=new Set();
  const buttonSamples=new WeakMap();
  const state={
    targetRX:0,targetRY:0,rx:0,ry:0,vx:0,vy:0,ax:0,ay:0,
    targetLX:50,targetLY:30,lx:50,ly:30,lvx:0,lvy:0,
    targetGlow:0,glow:0,glowV:0,
    pointerVX:0,pointerVY:0,pointerAX:0,pointerAY:0,lastRawVX:0,lastRawVY:0,
    lastPX:0,lastPY:0,lastPT:0,lastFrame:0,releasing:false
  };

  const isLite=()=>document.hidden||reduceMotion.matches||document.body?.classList.contains('dark')||document.body?.classList.contains('perf-lite')||document.body?.classList.contains('lite')||document.body?.classList.contains('visual-paused');
  const reflectOnly=el=>!!el?.matches?.(REFLECT_ONLY);
  function profile(el){
    if(reflectOnly(el))return{maxX:0,maxY:0,k:190,c:28,reflectOnly:true};
    if(el.matches(LARGE_PUBLIC))return{maxX:2.05,maxY:2.85,k:118,c:20.2,reflectOnly:false};
    if(el.matches(LARGE_CMS))return{maxX:1.85,maxY:2.55,k:154,c:24.8,reflectOnly:false};
    return{maxX:1.25,maxY:1.8,k:176,c:27.2,reflectOnly:false};
  }
  function eligible(el){
    if(!el||!el.matches?.(TARGETS)||el.matches(EXCLUDES))return false;
    if(el.closest('.article-body,.article-page .article-content,.content-area,[contenteditable="true"]'))return false;
    return true;
  }
  function ensureSpecular(el){
    if(el.querySelector(':scope > .sw-motion-specular'))return;
    const shine=document.createElement('span');shine.className='sw-motion-specular';shine.setAttribute('aria-hidden','true');el.appendChild(shine);
  }
  function ensureAIBreath(el){
    if(!el||el.querySelector(':scope > .sw-ai-breath'))return;
    const breath=document.createElement('span');breath.className='sw-ai-breath';breath.setAttribute('aria-hidden','true');el.prepend(breath);
  }
  function decorate(root=document){
    const list=[];if(root?.nodeType===1&&root.matches?.(TARGETS))list.push(root);if(root?.querySelectorAll)list.push(...root.querySelectorAll(TARGETS));
    list.forEach(el=>{
      if(!eligible(el)||el.dataset.swMotionReady==='1')return;
      el.dataset.swMotionReady='1';el.dataset.swMotionTilt=reflectOnly(el)?'0':'1';el.dataset.swMotionNative=el.matches(NATIVE_TRANSFORM)?'1':'0';
      el.classList.add('sw-motion-glass');ensureSpecular(el);
    });
  }
  function decorateButtons(root=document){
    const list=[];if(root?.nodeType===1&&root.matches?.(BUTTONS))list.push(root);if(root?.querySelectorAll)list.push(...root.querySelectorAll(BUTTONS));
    list.forEach(btn=>{
      if(btn.dataset.swVelocityReady==='1'||btn.closest('.article-body,.content-area,[contenteditable="true"]'))return;
      btn.dataset.swVelocityReady='1';btn.classList.add('sw-motion-button');
      const s=document.createElement('span');s.className='sw-motion-button-specular';s.setAttribute('aria-hidden','true');btn.appendChild(s);
    });
  }
  function writeVars(el){
    if(!el)return;
    el.style.setProperty('--sw-rx',state.rx.toFixed(3)+'deg');el.style.setProperty('--sw-ry',state.ry.toFixed(3)+'deg');
    el.style.setProperty('--sw-mx',state.lx.toFixed(2)+'%');el.style.setProperty('--sw-my',state.ly.toFixed(2)+'%');el.style.setProperty('--sw-glow',state.glow.toFixed(3));
    el.style.setProperty('--rx',state.rx.toFixed(3)+'deg');el.style.setProperty('--ry',state.ry.toFixed(3)+'deg');el.style.setProperty('--px',state.lx.toFixed(2)+'%');el.style.setProperty('--py',state.ly.toFixed(2)+'%');
  }
  function zeroState(){
    Object.assign(state,{targetRX:0,targetRY:0,rx:0,ry:0,vx:0,vy:0,ax:0,ay:0,targetLX:50,targetLY:30,lx:50,ly:30,lvx:0,lvy:0,targetGlow:0,glow:0,glowV:0,pointerVX:0,pointerVY:0,pointerAX:0,pointerAY:0,lastRawVX:0,lastRawVY:0,lastPT:0,lastFrame:0,releasing:false});
  }
  function settled(){
    return Math.abs(state.targetRX-state.rx)<.0022&&Math.abs(state.targetRY-state.ry)<.0022&&Math.abs(state.vx)<.003&&Math.abs(state.vy)<.003&&Math.abs(state.targetLX-state.lx)<.04&&Math.abs(state.targetLY-state.ly)<.04&&Math.abs(state.glow-state.targetGlow)<.006;
  }
  function parkFrame(){if(rafId){cancelAnimationFrame(rafId);rafId=0}state.lastFrame=0}
  function finishRelease(){
    const el=active;if(!el)return;zeroState();writeVars(el);el.dataset.swMotionActive='0';el.classList.remove('sw-motion-active');active=null;activeRect=null;parkFrame();
  }
  function frame(now){
    rafId=0;const el=active;if(!el)return;
    if(isLite()){finishRelease();return}
    if(!state.lastFrame)state.lastFrame=now;
    const dt=clamp((now-state.lastFrame)/1000,1/240,1/30);state.lastFrame=now;const p=profile(el);
    let sx=springStep(state.rx,state.vx,state.targetRX,dt,p.k,p.c);state.rx=sx.position;state.vx=sx.velocity;state.ax=sx.acceleration;
    let sy=springStep(state.ry,state.vy,state.targetRY,dt,p.k,p.c);state.ry=sy.position;state.vy=sy.velocity;state.ay=sy.acceleration;
    let lx=springStep(state.lx,state.lvx,state.targetLX,dt,165,27);state.lx=lx.position;state.lvx=lx.velocity;
    let ly=springStep(state.ly,state.lvy,state.targetLY,dt,165,27);state.ly=ly.position;state.lvy=ly.velocity;
    let gl=springStep(state.glow,state.glowV,state.targetGlow,dt,210,31);state.glow=clamp(gl.position,0,1.25);state.glowV=gl.velocity;
    writeVars(el);
    if(settled()){
      state.rx=state.targetRX;state.ry=state.targetRY;state.lx=state.targetLX;state.ly=state.targetLY;state.glow=state.targetGlow;state.vx=state.vy=state.lvx=state.lvy=state.glowV=0;writeVars(el);
      if(state.releasing){finishRelease();return}state.lastFrame=0;return;
    }
    rafId=requestAnimationFrame(frame);
  }
  function wake(){if(!rafId&&!isLite()&&active)rafId=requestAnimationFrame(frame)}
  function samplePointer(e){
    const now=performance.now();if(!state.lastPT){state.lastPX=e.clientX;state.lastPY=e.clientY;state.lastPT=now;return 0}
    const dt=clamp((now-state.lastPT)/1000,1/240,.05),rawVX=(e.clientX-state.lastPX)/dt,rawVY=(e.clientY-state.lastPY)/dt;
    const nextVX=state.pointerVX+(rawVX-state.pointerVX)*.24,nextVY=state.pointerVY+(rawVY-state.pointerVY)*.24;
    state.pointerAX+=( (nextVX-state.pointerVX)/dt-state.pointerAX)*.18;state.pointerAY+=( (nextVY-state.pointerVY)/dt-state.pointerAY)*.18;
    state.lastRawVX=rawVX;state.lastRawVY=rawVY;state.pointerVX=nextVX;state.pointerVY=nextVY;state.lastPX=e.clientX;state.lastPY=e.clientY;state.lastPT=now;
    return Math.hypot(nextVX,nextVY);
  }
  function setTargetsFromPointer(e){
    if(!active||!activeRect)return;const r=activeRect;if(!r.width||!r.height)return;
    const nx=clamp((((e.clientX-r.left)/r.width)-.5)*2,-1,1),ny=clamp((((e.clientY-r.top)/r.height)-.5)*2,-1,1),m=trigVector(nx,ny),p=profile(active),speed=samplePointer(e);
    const vFeedX=clamp(-state.pointerVY*.00012,-.42,.42),vFeedY=clamp(state.pointerVX*.00012,-.42,.42);
    state.targetRX=p.reflectOnly?0:-m.y*p.maxX+vFeedX;state.targetRY=p.reflectOnly?0:m.x*p.maxY+vFeedY;
    const lagX=clamp(state.pointerVX/1800,-1,1)*3.2+clamp(state.pointerAX/42000,-1,1)*1.4;
    const lagY=clamp(state.pointerVY/1800,-1,1)*2.5+clamp(state.pointerAY/42000,-1,1)*1.1;
    state.targetLX=50+m.x*42-lagX;state.targetLY=30+m.y*36-lagY;
    state.targetGlow=clamp(.24+m.distance*.52+velocityGlow(speed)*.16,0,1.05);state.releasing=false;wake();
  }
  function activate(el,e){
    if(!eligible(el)||isLite())return;
    if(active&&active!==el){finishRelease()}
    active=el;activeRect=el.getBoundingClientRect();el.dataset.swMotionActive='1';el.classList.add('sw-motion-active');state.lastPT=0;state.releasing=false;setTargetsFromPointer(e);
  }
  function release(){
    if(!active)return;state.targetRX=0;state.targetRY=0;state.targetLX=50;state.targetLY=30;state.targetGlow=0;state.pointerVX=state.pointerVY=state.pointerAX=state.pointerAY=0;state.lastPT=0;state.releasing=true;wake();
  }
  function closestTarget(node){const el=node?.closest?.(TARGETS);return eligible(el)?el:null}
  function onPointerOver(e){if(!finePointer||isLite())return;const el=closestTarget(e.target);if(!el||e.relatedTarget&&el.contains(e.relatedTarget))return;activate(el,e)}
  function onPointerMove(e){if(!finePointer||!active||isLite())return;const el=closestTarget(e.target);if(el!==active)return;setTargetsFromPointer(e)}
  function onPointerOut(e){if(!finePointer)return;const el=closestTarget(e.target);if(!el||el!==active||e.relatedTarget&&el.contains(e.relatedTarget))return;release()}
  function onPointerDown(e){
    if(finePointer||isLite())return;const el=closestTarget(e.target);if(!el)return;active=el;activeRect=el.getBoundingClientRect();el.dataset.swMotionActive='1';el.classList.add('sw-motion-active');
    const r=activeRect;state.rx=state.ry=0;state.targetRX=state.targetRY=0;state.lx=clamp((e.clientX-r.left)/Math.max(1,r.width)*100,0,100);state.ly=clamp((e.clientY-r.top)/Math.max(1,r.height)*100,0,100);state.targetLX=state.lx;state.targetLY=state.ly;state.glow=state.targetGlow=.45;writeVars(el);
  }
  function onPointerUp(){if(!finePointer&&active)release()}

  function onButtonMove(e){
    if(isLite())return;const btn=e.target?.closest?.(BUTTONS);if(!btn||btn.closest('.article-body,.content-area,[contenteditable="true"]'))return;
    const now=performance.now(),prev=buttonSamples.get(btn)||{x:e.clientX,t:now,v:0};const dt=clamp((now-prev.t)/1000,1/240,.05),raw=(e.clientX-prev.x)/dt,v=prev.v+(raw-prev.v)*.25,n=clamp(Math.abs(v)/1800,0,1),rect=btn.getBoundingClientRect();
    btn.dataset.swBtnActive='1';btn.style.setProperty('--sw-btn-x',clamp((e.clientX-rect.left)/Math.max(1,rect.width)*100,0,100).toFixed(2)+'%');btn.style.setProperty('--sw-btn-glow',(n*n*.14).toFixed(3));buttonSamples.set(btn,{x:e.clientX,t:now,v});
  }
  function onButtonOut(e){const btn=e.target?.closest?.(BUTTONS);if(!btn||e.relatedTarget&&btn.contains(e.relatedTarget))return;btn.dataset.swBtnActive='0';btn.style.setProperty('--sw-btn-glow','0');buttonSamples.delete(btn)}

  let aiTimer=0;
  function aiTargets(){return[...document.querySelectorAll('[data-sw-ai-presence],.social-studio-chat,.review-inbox-card,.medical-news-persistent,.hero-card')].filter(eligible)}
  function setAIState(mode){
    clearTimeout(aiTimer);const targets=aiTargets();targets.forEach(el=>{ensureAIBreath(el);el.classList.remove('sw-ai-active','sw-ai-streaming','sw-ai-complete');if(mode==='thinking')el.classList.add('sw-ai-active');if(mode==='streaming')el.classList.add('sw-ai-active','sw-ai-streaming');if(mode==='done')el.classList.add('sw-ai-complete')});
    if(mode==='done'&&!reduceMotion.matches&&active){state.vx-=.04;state.vy+=.055;wake();aiTimer=setTimeout(()=>targets.forEach(el=>el.classList.remove('sw-ai-complete')),950)}
  }

  function park(){document.documentElement.classList.toggle('sw-motion-parked',isLite());if(isLite()){if(active)finishRelease();else parkFrame()}}
  function init(){
    decorate(document);decorateButtons(document);park();
    document.addEventListener('pointerover',onPointerOver,{passive:true});document.addEventListener('pointermove',onPointerMove,{passive:true});document.addEventListener('pointerout',onPointerOut,{passive:true});
    document.addEventListener('pointerdown',onPointerDown,{passive:true});document.addEventListener('pointerup',onPointerUp,{passive:true});document.addEventListener('pointercancel',onPointerUp,{passive:true});
    document.addEventListener('pointermove',onButtonMove,{passive:true});document.addEventListener('pointerout',onButtonOut,{passive:true});
    addEventListener('resize',()=>{activeRect=active?.getBoundingClientRect?.()||null},{passive:true});addEventListener('scroll',()=>{if(active)release()},{passive:true});document.addEventListener('visibilitychange',park,{passive:true});reduceMotion.addEventListener?.('change',park);if(document.body)new MutationObserver(park).observe(document.body,{attributes:true,attributeFilter:['class']});
    new MutationObserver(records=>{records.forEach(r=>r.addedNodes?.forEach(n=>{if(n?.nodeType===1)pendingRoots.add(n)}));if(!pendingRoots.size||mutationRAF)return;mutationRAF=requestAnimationFrame(()=>{mutationRAF=0;const roots=[...pendingRoots];pendingRoots.clear();roots.forEach(r=>{decorate(r);decorateButtons(r)})})}).observe(document.documentElement,{subtree:true,childList:true});
    addEventListener('message',e=>{const type=e?.data?.type;if(type==='signwell:ai-start')setAIState('thinking');if(type==='signwell:ai-stream')setAIState('streaming');if(type==='signwell:ai-done')setAIState('done');if(type==='signwell:ai-idle')setAIState('idle')});
  }

  window.SignWellLiquidGlassMotion=Object.freeze({version:'23.9.90-STAGING',trigAxis,trigVector,springStep,velocityGlow,decorate,park,setAIState,aiStart(){setAIState('thinking')},aiStreaming(){setAIState('streaming')},aiDone(){setAIState('done')},aiIdle(){setAIState('idle')}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
