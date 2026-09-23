/* SIGN WELL v24.2.0 · Canonical Liquid Glass Slider Optics */
(()=>{
  'use strict';
  if(window.SignWellLiquidSlider?.version==='24.2.0')return;

  const root=document.documentElement;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const mem=Number(navigator.deviceMemory||0);
  const cores=Number(navigator.hardwareConcurrency||0);
  const coarse=matchMedia('(hover:none) and (pointer:coarse)').matches;
  const lowHardware=(mem>0&&mem<=4)||(cores>0&&cores<=4);
  if(lowHardware)root.classList.add('sw-lg-lite');

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const tracked=new WeakSet();
  let hidden=document.hidden;

  function setVar(el,k,v){el.style.setProperty(k,v)}
  function reset(el){
    setVar(el,'--lg-x','50%');
    setVar(el,'--lg-y','32%');
    setVar(el,'--lg-speed','0');
    setVar(el,'--lg-spec-x','0px');
    setVar(el,'--lg-spec-y','0px');
    el.classList.remove('lg-active','lg-pressed');
  }

  function attach(el){
    if(!el||tracked.has(el))return;
    tracked.add(el);
    el.dataset.liquidGlass='24.2.0';
    let lastX=0,lastY=0,lastT=0,fxVX=0,fxVY=0,raf=0,pending=null;

    const apply=()=>{
      raf=0;
      if(!pending||hidden||reduce.matches||root.classList.contains('sw-lg-lite'))return;
      const {x,y,t}=pending;
      const r=el.getBoundingClientRect();
      if(!r.width||!r.height)return;
      const px=clamp((x-r.left)/r.width,0,1);
      const py=clamp((y-r.top)/r.height,0,1);
      const dt=lastT?Math.max(8,t-lastT):16;
      const vx=lastT?(x-lastX)/dt*1000:0;
      const vy=lastT?(y-lastY)/dt*1000:0;
      fxVX=fxVX*.68+vx*.32;
      fxVY=fxVY*.68+vy*.32;
      const speed=clamp(Math.hypot(fxVX,fxVY)/1350,0,1);
      const sx=clamp(fxVX/85,-8,8);
      const sy=clamp(fxVY/85,-7,7);
      setVar(el,'--lg-x',(px*100).toFixed(1)+'%');
      setVar(el,'--lg-y',(py*100).toFixed(1)+'%');
      setVar(el,'--lg-speed',speed.toFixed(3));
      setVar(el,'--lg-spec-x',sx.toFixed(2)+'px');
      setVar(el,'--lg-spec-y',sy.toFixed(2)+'px');
      lastX=x;lastY=y;lastT=t;
      el.classList.add('lg-active');
    };

    el.addEventListener('pointermove',e=>{
      pending={x:e.clientX,y:e.clientY,t:e.timeStamp||performance.now()};
      if(!raf)raf=requestAnimationFrame(apply);
    },{passive:true});
    el.addEventListener('pointerenter',e=>{
      lastX=e.clientX;lastY=e.clientY;lastT=e.timeStamp||performance.now();
      el.classList.add('lg-active');
    },{passive:true});
    el.addEventListener('pointerdown',()=>el.classList.add('lg-pressed'),{passive:true});
    const release=()=>el.classList.remove('lg-pressed');
    el.addEventListener('pointerup',release,{passive:true});
    el.addEventListener('pointercancel',release,{passive:true});
    el.addEventListener('pointerleave',()=>{
      release();
      fxVX=fxVY=0;lastT=0;
      if(raf){cancelAnimationFrame(raf);raf=0}
      reset(el);
    },{passive:true});

    reset(el);
  }

  function scan(scope=document){
    scope.querySelectorAll?.('.pager,.sw-font-dock').forEach(attach);
  }
  scan();

  const mo=new MutationObserver(records=>{
    for(const rec of records){
      for(const node of rec.addedNodes){
        if(node.nodeType!==1)continue;
        if(node.matches?.('.pager,.sw-font-dock'))attach(node);
        scan(node);
      }
    }
  });
  mo.observe(document.documentElement,{childList:true,subtree:true});

  document.addEventListener('visibilitychange',()=>{
    hidden=document.hidden;
    if(hidden)document.querySelectorAll('.pager,.sw-font-dock').forEach(reset);
  },{passive:true});

  window.SignWellLiquidSlider=Object.freeze({
    version:'24.2.0',
    scan,
    lowHardware,
    get reducedMotion(){return reduce.matches}
  });
})();
