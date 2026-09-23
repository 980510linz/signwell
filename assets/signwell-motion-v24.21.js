/* SIGN WELL v24.21 · adaptive motion / glass highlight */
(()=>{
 const root=document.documentElement;
 const rm=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const rt=matchMedia('(prefers-reduced-transparency: reduce)').matches;
 const coarse=matchMedia('(pointer: coarse)').matches;
 const mem=navigator.deviceMemory||4,cores=navigator.hardwareConcurrency||4;
 const low=rm||rt||mem<=2||cores<=2;
 const medium=!low&&(coarse||mem<=4||cores<=4);
 root.dataset.swQuality=low?'low':medium?'medium':'high';
 const eligible='.glass,.sw-glass,.hero-card,.home-hero-card,.article-card,.share-card,.newsletter-card,.about-value,.about-team-card,.sw-related-card,.card,.settings-card,.editor-card,.ai-card,.research-card';
 if(low)return;
 let active=null,pending=false,lastX=0,lastY=0;
 const update=()=>{pending=false;if(!active)return;const r=active.getBoundingClientRect();if(!r.width||!r.height)return;const x=(lastX-r.left)/r.width,y=(lastY-r.top)/r.height;active.style.setProperty('--sw-gx',`${Math.max(0,Math.min(1,x))*100}%`);active.style.setProperty('--sw-gy',`${Math.max(0,Math.min(1,y))*100}%`);active.style.setProperty('--sw-gv','1');if(root.dataset.swQuality==='high'&&active.matches('.article-card,.card,.settings-card,.editor-card,.ai-card,.research-card')){active.style.setProperty('--sw-rx',`${(0.5-y)*2.8}deg`);active.style.setProperty('--sw-ry',`${(x-0.5)*3.4}deg`);}};
 document.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const el=e.target.closest?.(eligible);if(active&&active!==el){active.style.removeProperty('--sw-gv');active.style.removeProperty('--sw-rx');active.style.removeProperty('--sw-ry');}active=el||null;lastX=e.clientX;lastY=e.clientY;if(!pending){pending=true;requestAnimationFrame(update)}},{passive:true});
 document.addEventListener('pointerout',e=>{const el=e.target.closest?.(eligible);if(el&&!el.contains(e.relatedTarget)){el.style.setProperty('--sw-gv','0');el.style.removeProperty('--sw-rx');el.style.removeProperty('--sw-ry');if(active===el)active=null}},{passive:true});
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.target.tagName==='VIDEO')e.isIntersecting?e.target.play?.().catch(()=>{}):e.target.pause?.()}),{rootMargin:'80px'});document.querySelectorAll('video[autoplay]').forEach(v=>io.observe(v));
})();
