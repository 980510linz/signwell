/* SIGN WELL v24.22 · Adaptive motion runtime
   No broad mutation observer and no transform ownership over specialist components. */
(()=>{
  'use strict';
  if(window.SignWellMotionV2422)return;

  const root=document.documentElement;
  const mq=(q)=>matchMedia(q);
  const reducedMotion=mq('(prefers-reduced-motion: reduce)').matches;
  const reducedTransparency=mq('(prefers-reduced-transparency: reduce)').matches;
  const coarse=mq('(pointer: coarse)').matches;
  const memory=Number(navigator.deviceMemory||0);
  const cores=Number(navigator.hardwareConcurrency||0);

  let quality='high';
  if(reducedMotion||reducedTransparency)quality='accessible';
  else if((memory&&memory<=2)||(cores&&cores<=2))quality='low';
  else if(coarse||(memory&&memory<=4)||(cores&&cores<=4))quality='medium';
  root.dataset.swQuality=quality;

  const cleanups=new Set();

  function bindPointerSurface(el,{tilt=false,tiltX=2.4,tiltY=2.8,vars={x:'--sw-gx',y:'--sw-gy',active:'--sw-gv',rx:'--sw-rx',ry:'--sw-ry'}}={}){
    if(!el||quality==='low'||quality==='accessible'||coarse)return()=>{};
    let frame=0,lastX=0,lastY=0,inside=false;
    const paint=()=>{
      frame=0;
      if(!inside||!el.isConnected)return;
      const r=el.getBoundingClientRect();
      if(!r.width||!r.height)return;
      const x=Math.max(0,Math.min(1,(lastX-r.left)/r.width));
      const y=Math.max(0,Math.min(1,(lastY-r.top)/r.height));
      el.style.setProperty(vars.x,`${(x*100).toFixed(2)}%`);
      el.style.setProperty(vars.y,`${(y*100).toFixed(2)}%`);
      el.style.setProperty(vars.active,'1');
      if(tilt&&quality==='high'){
        el.style.setProperty(vars.rx,`${((.5-y)*tiltX).toFixed(3)}deg`);
        el.style.setProperty(vars.ry,`${((x-.5)*tiltY).toFixed(3)}deg`);
      }
    };
    const move=(e)=>{
      if(e.pointerType==='touch')return;
      inside=true;lastX=e.clientX;lastY=e.clientY;
      if(!frame)frame=requestAnimationFrame(paint);
    };
    const leave=()=>{
      inside=false;
      if(frame){cancelAnimationFrame(frame);frame=0;}
      el.style.setProperty(vars.active,'0');
      if(tilt){el.style.removeProperty(vars.rx);el.style.removeProperty(vars.ry);}
    };
    el.addEventListener('pointermove',move,{passive:true});
    el.addEventListener('pointerleave',leave,{passive:true});
    const cleanup=()=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerleave',leave);leave();cleanups.delete(cleanup);};
    cleanups.add(cleanup);
    return cleanup;
  }

  function bindVisibleVideo(video){
    if(!video||!('IntersectionObserver'in window))return()=>{};
    const io=new IntersectionObserver(entries=>{
      for(const e of entries){
        if(e.isIntersecting)video.play?.().catch(()=>{});
        else video.pause?.();
      }
    },{rootMargin:'80px'});
    io.observe(video);
    const cleanup=()=>{io.disconnect();cleanups.delete(cleanup);};
    cleanups.add(cleanup);
    return cleanup;
  }

  document.querySelectorAll('.sw-glass-surface,.brand-top,.top-actions .iconbtn,.searchbox,.pager').forEach(el=>bindPointerSurface(el));
  document.querySelectorAll('video[autoplay]').forEach(bindVisibleVideo);

  window.SignWellMotionV2422=Object.freeze({
    quality,
    reducedMotion,
    reducedTransparency,
    coarsePointer:coarse,
    bindPointerSurface,
    bindVisibleVideo,
    destroy(){for(const fn of [...cleanups])try{fn()}catch(_){}}
  });
})();
