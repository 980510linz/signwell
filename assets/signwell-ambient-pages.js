
/* SIGN WELL R9.7 · cubic ambient background motion for non-home pages */
(function(){
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function cubicBlend(u, a, b){ return a*u*u*u + b*u; }
  function wave(t, duration){
    const phase = (t % duration) / duration;
    return phase * 2 - 1; // -1..1, looped
  }
  function createAmbient(){
    const body = document.body;
    if(!body) return;
    const page = (body.dataset.page || '').trim();
    if(page === 'home') return;
    if(body.querySelector('.sw-ambient-pages')) return;
    body.classList.add('sw-ambient-enabled');
    const layer = document.createElement('div');
    layer.className = 'sw-ambient-pages';
    layer.setAttribute('aria-hidden','true');
    layer.innerHTML = '<i class="blob blue"></i><i class="blob pink"></i><i class="blob glow"></i>';
    body.insertBefore(layer, body.firstChild);
    if(prefersReduced) return;
    let raf = 0;
    const tick = (now)=>{
      const t = now / 1000;
      const u1 = wave(t, 34);
      const u2 = wave(t + 5.4, 42);
      const u3 = wave(t + 10.2, 48);
      const blueX = cubicBlend(u1, -6.2, 18.5);
      const blueY = cubicBlend(u1, 7.5, -2.8);
      const pinkX = cubicBlend(u2, 5.4, -16.4);
      const pinkY = cubicBlend(u2, -6.0, 3.3);
      const glowX = cubicBlend(u3, 2.6, 9.4);
      const glowY = cubicBlend(u3, -3.4, 4.4);
      const root = document.documentElement;
      root.style.setProperty('--sw-blue-x', blueX.toFixed(3));
      root.style.setProperty('--sw-blue-y', blueY.toFixed(3));
      root.style.setProperty('--sw-blue-s', (1 + 0.045*u1*u1*u1).toFixed(4));
      root.style.setProperty('--sw-pink-x', pinkX.toFixed(3));
      root.style.setProperty('--sw-pink-y', pinkY.toFixed(3));
      root.style.setProperty('--sw-pink-s', (1 - 0.038*u2*u2*u2).toFixed(4));
      root.style.setProperty('--sw-glow-x', glowX.toFixed(3));
      root.style.setProperty('--sw-glow-y', glowY.toFixed(3));
      root.style.setProperty('--sw-glow-s', (1 + 0.028*u3*u3*u3).toFixed(4));
      root.style.setProperty('--sw-light-x', (cubicBlend(u2, 1.4, 4.2)).toFixed(3));
      root.style.setProperty('--sw-light-y', (cubicBlend(u1, -0.8, 1.8)).toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', ()=>{
      if(document.hidden && raf){ cancelAnimationFrame(raf); raf = 0; }
      else if(!document.hidden && !raf){ raf = requestAnimationFrame(tick); }
    });
    raf = requestAnimationFrame(tick);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createAmbient, {once:true});
  else createAmbient();
})();
