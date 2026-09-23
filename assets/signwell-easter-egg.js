(function(global){
  'use strict';

  const EXACT_WELL=/^well$/i;
  let armed=true;
  let closeTimer=0;

  function matches(value){
    return EXACT_WELL.test(String(value == null ? '' : value));
  }

  function reset(){
    armed=true;
  }

  function removeExisting(){
    if(typeof document==='undefined')return;
    document.getElementById('swWellEggOverlay')?.remove();
    document.getElementById('swWellConfetti')?.remove();
    if(closeTimer){clearTimeout(closeTimer);closeTimer=0;}
  }

  function confetti(){
    if(typeof document==='undefined')return;
    const reduced=global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const lite=document.documentElement.classList.contains('perf-lite') || document.body?.classList.contains('perf-lite');
    const count=reduced?12:(lite?22:38);
    const layer=document.createElement('div');
    layer.id='swWellConfetti';
    layer.className='sw-well-confetti';
    layer.setAttribute('aria-hidden','true');
    const palette=['#7cc7ff','#ff9fc5','#ffe08a','#9fddb7','#b6a7ff','#ffffff'];
    for(let i=0;i<count;i++){
      const piece=document.createElement('i');
      piece.className='sw-well-confetti-piece';
      const left=5+Math.random()*90;
      const drift=-70+Math.random()*140;
      const delay=Math.random()*120;
      const duration=reduced?420:(760+Math.random()*520);
      const rotate=-180+Math.random()*540;
      piece.style.setProperty('--sw-confetti-left',left+'vw');
      piece.style.setProperty('--sw-confetti-drift',drift+'px');
      piece.style.setProperty('--sw-confetti-delay',delay+'ms');
      piece.style.setProperty('--sw-confetti-duration',duration+'ms');
      piece.style.setProperty('--sw-confetti-rotate',rotate+'deg');
      piece.style.setProperty('--sw-confetti-color',palette[i%palette.length]);
      layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    setTimeout(()=>layer.remove(),reduced?850:1650);
  }

  function modal(){
    if(typeof document==='undefined')return;
    const overlay=document.createElement('div');
    overlay.id='swWellEggOverlay';
    overlay.className='sw-well-egg-overlay';
    overlay.innerHTML='<section class="sw-well-egg-card" role="dialog" aria-modal="true" aria-labelledby="swWellEggTitle"><button class="sw-well-egg-close" type="button" aria-label="關閉">×</button><div class="sw-well-egg-mark" aria-hidden="true">SW</div><p class="sw-well-egg-kicker">EASTER EGG</p><h2 id="swWellEggTitle">沒想到你真的”SIGN WELL”了！</h2></section>';
    const close=()=>{overlay.classList.add('is-leaving');setTimeout(()=>overlay.remove(),220);if(closeTimer){clearTimeout(closeTimer);closeTimer=0;}};
    overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('.sw-well-egg-close'))close();});
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
    document.body.appendChild(overlay);
    requestAnimationFrame(()=>overlay.classList.add('is-visible'));
    overlay.querySelector('.sw-well-egg-close')?.focus({preventScroll:true});
    closeTimer=setTimeout(close,5200);
  }

  function celebrate(){
    if(typeof document==='undefined')return false;
    removeExisting();
    confetti();
    modal();
    return true;
  }

  function handleSearch(value){
    const hit=matches(value);
    if(!hit){armed=true;return false;}
    if(!armed)return false;
    armed=false;
    return celebrate();
  }

  const api=Object.freeze({matches,handleSearch,celebrate,reset});
  global.SignWellEasterEgg=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
