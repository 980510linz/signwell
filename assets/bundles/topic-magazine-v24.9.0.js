/* SIGN WELL Public · Topic Magazine Corridor · v24.9.0
   Accessible DOM/CSS 3D adaptation of the magazine-corridor interaction.
   No topic data is invented here: the renderer receives canonical Public topic objects.
*/
(function(){
  'use strict';

  const ACTIVE_KEY='__SIGNWELL_TOPIC_MAGAZINE_ACTIVE__';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const esc=(v)=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
  const now=()=>performance.now();
  const wrap=(v,n)=>{
    if(n<=0)return 0;
    let x=((v+n/2)%n+n)%n-n/2;
    if(x===-n/2&&v>0)x=n/2;
    return x;
  };
  const reduced=()=>matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowPower=()=>{
    const cores=finite(navigator.hardwareConcurrency,8);
    const mem=finite(navigator.deviceMemory,8);
    return document.body.classList.contains('lite')||cores<=4||mem<=4;
  };

  function markup(items,opts={}){
    const suffix=esc(opts.articleCountSuffix||'篇文章');
    const list=Array.isArray(items)?items:[];
    if(!list.length)return '<div class="empty">還沒有建立公開主題。請從 CMS 的「主題管理」建立並同步。</div>';
    const pages=list.map((item,i)=>{
      const hue=clamp(finite(item.hue,210),0,360);
      const name=esc(item.name||'未命名主題');
      const desc=esc(item.description||'瀏覽這個主題的相關文章與延伸整理。');
      const slug=esc(item.slug||'');
      const count=Math.max(0,Math.round(finite(item.count,0)));
      return `<button type="button" class="sw-topic-page" data-sw-topic-page data-index="${i}" data-topic-open="${slug}" style="--cat-h:${hue}" aria-label="${name}，${count} ${suffix}">
        <span class="sw-topic-page-material" aria-hidden="true"><i class="sw-topic-page-rim"></i><i class="sw-topic-page-glow"></i><span class="sw-topic-spine">${name}</span></span>
        <span class="sw-topic-page-copy">
          <span class="sw-topic-kicker">SIGN WELL · TOPIC ${String(i+1).padStart(2,'0')}</span>
          <strong>${name}</strong>
          <span class="sw-topic-desc">${desc}</span>
          <span class="sw-topic-meta"><b>${count}</b> ${suffix}<i>·</i> 點選後展開</span>
        </span>
      </button>`;
    }).join('');
    const dots=list.map((item,i)=>`<button type="button" class="sw-topic-dot" data-sw-topic-dot="${i}" aria-label="定位到 ${esc(item.name||'主題')}"></button>`).join('');
    return `<section class="sw-topic-magazine" data-sw-topic-magazine aria-label="SIGN WELL 主題瀏覽器">
      <div class="sw-topic-stage" data-sw-topic-stage tabindex="0" role="region" aria-roledescription="3D 主題走廊" aria-describedby="swTopicMagazineHint">
        <div class="sw-topic-depth" aria-hidden="true"></div>
        <div class="sw-topic-corridor" data-sw-topic-corridor role="list">${pages}</div>
        <div class="sw-topic-vignette" aria-hidden="true"></div>
      </div>
      <div class="sw-topic-console">
        <div class="sw-topic-console-main">
          <button type="button" class="sw-topic-search" data-sw-topic-search aria-label="搜尋 SIGN WELL"><span>search...</span><b>⌕</b></button>
          <div class="sw-topic-hint" id="swTopicMagazineHint"><b data-sw-topic-state>拖曳或滾輪瀏覽</b><span>觸碰主題後，牌列會停住並展開</span></div>
          <button type="button" class="sw-topic-enter" data-sw-topic-enter hidden>進入主題 →</button>
        </div>
        <div class="sw-topic-dots" role="group" aria-label="主題位置">${dots}</div>
      </div>
    </section>`;
  }

  function mount(root,options={}){
    if(!root||!root.matches('[data-sw-topic-magazine]'))return null;
    try{window[ACTIVE_KEY]?.destroy?.()}catch(_){ }

    const stage=root.querySelector('[data-sw-topic-stage]');
    const corridor=root.querySelector('[data-sw-topic-corridor]');
    const pages=Array.from(root.querySelectorAll('[data-sw-topic-page]'));
    const dots=Array.from(root.querySelectorAll('[data-sw-topic-dot]'));
    const enter=root.querySelector('[data-sw-topic-enter]');
    const search=root.querySelector('[data-sw-topic-search]');
    const stateEl=root.querySelector('[data-sw-topic-state]');
    const n=pages.length;
    if(!stage||!corridor||!n)return null;

    const isReduced=reduced();
    const isLite=lowPower();
    root.classList.toggle('is-reduced',isReduced);
    root.classList.toggle('is-lite',isLite);

    let current=0;
    let target=0;
    let selected=-1;
    let dragging=false;
    let pointerId=-1;
    let lastX=0;
    let downX=0;
    let downY=0;
    let dragged=false;
    let visible=true;
    let destroyed=false;
    let raf=0;
    let last=now();
    let manualUntil=0;
    let autoSpeed=isLite?0.055:0.085;
    let resumeAt=0;
    let lastPaint='';

    function nearestIndex(){
      const k=Math.round(current);
      return ((k%n)+n)%n;
    }

    function updateConsole(){
      const active=selected>=0?selected:nearestIndex();
      dots.forEach((d,i)=>d.classList.toggle('is-active',i===active));
      pages.forEach((p,i)=>{
        p.classList.toggle('is-selected',i===selected);
        p.classList.toggle('is-dimmed',selected>=0&&i!==selected);
        p.setAttribute('aria-pressed',i===selected?'true':'false');
      });
      if(selected>=0){
        const page=pages[selected];
        const name=(page.querySelector('strong')?.textContent||'主題').trim();
        if(stateEl)stateEl.textContent=`已展開：${name}`;
        if(enter){enter.hidden=false;enter.textContent=`進入「${name}」 →`;}
      }else{
        if(stateEl)stateEl.textContent=isReduced?'左右滑動瀏覽主題':'拖曳或滾輪瀏覽';
        if(enter)enter.hidden=true;
      }
    }

    function stylePage(page,i){
      if(isReduced)return;
      const rel=wrap(i-current,n);
      const dist=Math.abs(rel);
      const near=clamp(1-dist/5,0,1);
      const side=Math.sign(rel)||1;
      let transform='';
      let opacity=1;
      let filter='';
      let zIndex=String(200-Math.round(dist*12));
      if(i===selected){
        transform='translate(-50%,-50%) translate3d(0px,-6px,260px) rotateX(-2deg) rotateY(45deg) scale3d(1.055,1.055,1.055)';
        opacity=1;
        filter='saturate(1.03)';
        zIndex='999';
      }else{
        const x=rel*(isLite?66:76);
        const y=Math.sin(rel*.78)*(isLite?8:13);
        const z=-42-dist*(isLite?128:154);
        const rotY=82+clamp(rel,-4,4)*1.15;
        const rotX=-3+Math.sin(rel*.62)*1.4;
        const scale=.91+near*.08;
        transform=`translate(-50%,-50%) translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(${scale.toFixed(4)},${scale.toFixed(4)},1)`;
        opacity=dist>5.4?0:clamp(.18+near*.82,.18,1);
        filter=selected>=0?'brightness(.55) saturate(.72)':`brightness(${(.72+near*.28).toFixed(3)}) saturate(${(.72+near*.28).toFixed(3)})`;
      }
      page.style.transform=transform;
      page.style.opacity=String(opacity);
      page.style.filter=filter;
      page.style.zIndex=zIndex;
      page.style.pointerEvents=dist>5.6&&i!==selected?'none':'auto';
      page.dataset.side=side<0?'left':'right';
    }

    function paint(force=false){
      if(destroyed)return;
      if(!document.documentElement.contains(root)){destroy();return;}
      if(isReduced){updateConsole();return;}
      const sig=`${current.toFixed(4)}|${selected}|${root.className}`;
      if(!force&&sig===lastPaint)return;
      lastPaint=sig;
      pages.forEach(stylePage);
      updateConsole();
    }

    function select(i){
      if(i<0||i>=n)return;
      dragging=false;
      dragged=false;
      selected=i;
      target=current;
      manualUntil=Infinity;
      root.classList.add('is-focused');
      stage.classList.add('is-locked');
      paint(true);
      requestAnimationFrame(()=>pages[i]?.focus({preventScroll:true}));
    }

    function clearSelection(){
      if(selected<0)return;
      selected=-1;
      root.classList.remove('is-focused');
      stage.classList.remove('is-locked');
      manualUntil=now()+900;
      resumeAt=now()+1200;
      paint(true);
      stage.focus({preventScroll:true});
    }

    function gotoIndex(i,animate=true){
      if(!Number.isFinite(i))return;
      const base=Math.round(target/n)*n;
      let candidate=base+i;
      while(candidate-target>n/2)candidate-=n;
      while(candidate-target<-n/2)candidate+=n;
      target=candidate;
      manualUntil=now()+1400;
      if(!animate||isReduced)current=target;
      paint(true);
    }

    function tick(ts){
      if(destroyed)return;
      raf=requestAnimationFrame(tick);
      if(!visible||document.hidden||isReduced)return;
      const dt=clamp((ts-last)/1000,0,.05);last=ts;
      if(selected<0&&!dragging&&ts>manualUntil&&ts>resumeAt){target+=autoSpeed*dt;}
      const k=1-Math.pow(isLite?.84:.78,dt*60);
      current+=(target-current)*k;
      if(Math.abs(current)>n*200){current%=n;target%=n;}
      paint();
    }

    const onWheel=(e)=>{
      if(selected>=0||isReduced)return;
      const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
      if(!Number.isFinite(d)||Math.abs(d)<.1)return;
      target+=d*.0028;
      manualUntil=now()+1200;
    };

    const onPointerDown=(e)=>{
      if(isReduced||selected>=0||e.button!==0)return;
      pointerId=e.pointerId;dragging=true;dragged=false;lastX=downX=e.clientX;downY=e.clientY;
      manualUntil=now()+1600;resumeAt=now()+1800;
      stage.setPointerCapture?.(pointerId);
      stage.classList.add('is-dragging');
    };
    const onPointerMove=(e)=>{
      if(!dragging||e.pointerId!==pointerId||selected>=0)return;
      const dx=e.clientX-lastX;lastX=e.clientX;
      if(Math.hypot(e.clientX-downX,e.clientY-downY)>7)dragged=true;
      target-=dx*.0105;
    };
    const finishPointer=(e)=>{
      if(e.pointerId!==pointerId)return;
      dragging=false;pointerId=-1;stage.classList.remove('is-dragging');
      try{stage.releasePointerCapture?.(e.pointerId)}catch(_){ }
      if(!dragged){const p=e.target.closest?.('[data-sw-topic-page]');if(p)select(Number(p.dataset.index));}
      dragged=false;
    };

    const onStageClick=(e)=>{
      if(e.target.closest?.('[data-sw-topic-page],[data-sw-topic-enter],[data-sw-topic-search],[data-sw-topic-dot]'))return;
      if(selected>=0)clearSelection();
    };
    const onKey=(e)=>{
      if(e.key==='Escape'){if(selected>=0){e.preventDefault();clearSelection();}return;}
      if(selected>=0)return;
      if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();gotoIndex((nearestIndex()+1)%n);}
      else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();gotoIndex((nearestIndex()-1+n)%n);}
      else if(e.key==='Home'){e.preventDefault();gotoIndex(0);}
      else if(e.key==='End'){e.preventDefault();gotoIndex(n-1);}
      else if(e.key==='Enter'||e.key===' '){e.preventDefault();select(nearestIndex());}
    };

    pages.forEach((page,i)=>{
      page.dataset.index=String(i);
      page.addEventListener('click',(e)=>{
        if(dragged){e.preventDefault();return;}
        if(isReduced){options.onOpen?.(page.dataset.topicOpen||'');return;}
        e.preventDefault();
        if(selected===i)return;
        select(i);
      });
      page.addEventListener('focus',()=>{if(selected<0)gotoIndex(i,true)});
    });
    dots.forEach((dot,i)=>dot.addEventListener('click',()=>{if(selected>=0)clearSelection();gotoIndex(i,true)}));
    enter?.addEventListener('click',()=>{if(selected>=0)options.onOpen?.(pages[selected]?.dataset.topicOpen||'')});
    search?.addEventListener('click',()=>document.getElementById('searchBtn')?.click());
    stage.addEventListener('wheel',onWheel,{passive:true});
    stage.addEventListener('pointerdown',onPointerDown);
    stage.addEventListener('pointermove',onPointerMove);
    stage.addEventListener('pointerup',finishPointer);
    stage.addEventListener('pointercancel',finishPointer);
    stage.addEventListener('click',onStageClick);
    stage.addEventListener('keydown',onKey);

    let io=null;
    if('IntersectionObserver'in window){
      io=new IntersectionObserver(entries=>{visible=!!entries[0]?.isIntersecting;},{rootMargin:'180px'});
      io.observe(root);
    }

    function destroy(){
      if(destroyed)return;destroyed=true;cancelAnimationFrame(raf);io?.disconnect();
      stage.removeEventListener('wheel',onWheel);stage.removeEventListener('pointerdown',onPointerDown);stage.removeEventListener('pointermove',onPointerMove);stage.removeEventListener('pointerup',finishPointer);stage.removeEventListener('pointercancel',finishPointer);stage.removeEventListener('click',onStageClick);stage.removeEventListener('keydown',onKey);
      if(window[ACTIVE_KEY]?.root===root)window[ACTIVE_KEY]=null;
    }

    if(isReduced){
      pages.forEach(p=>{p.style.transform='';p.style.opacity='';p.style.filter='';p.style.zIndex='';});
      updateConsole();
    }else{
      paint(true);raf=requestAnimationFrame(tick);
    }
    const api={root,destroy,select,clearSelection,gotoIndex};
    window[ACTIVE_KEY]=api;
    return api;
  }

  window.SWTopicMagazine=Object.freeze({markup,mount});
})();
