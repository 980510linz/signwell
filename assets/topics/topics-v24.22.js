/* SIGN WELL Public · Topics v24.22 · canonical 3D single row */
(()=>{
  'use strict';
  if(window.SWTopicsV2422)return;

  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const safeId=(v='')=>'topic-'+String(v).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff_-]+/g,'-').replace(/^-|-$/g,'').slice(0,54);
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const quality=()=>window.SignWellMotionV2422?.quality||document.documentElement.dataset.swQuality||'medium';

  function markup(items=[],opts={}){
    const suffix=esc(opts.articleCountSuffix||'篇文章');
    const list=Array.isArray(items)?items:[];
    if(!list.length){
      return `<section class="sw-topic-magazine sw-topics-v2422" data-sw-topic-magazine aria-label="SIGN WELL 主題瀏覽器"><div class="sw-topic-stage"><div class="sw-topic-empty"><div><strong>目前還沒有公開主題</strong><br><span>建立主題並同步後會顯示在這裡。</span></div></div></div></section>`;
    }
    const cards=list.map((item,i)=>{
      const slug=String(item.slug||'');
      const id=`${safeId(slug||item.name||String(i))}-${i}`;
      const count=Number(item.count||0);
      const hue=Number(item.hue||205);
      return `<div class="sw-topic-item" data-sw-topic-item data-index="${i}" style="--cat-h:${hue}">
        <button type="button" class="sw-topic-page sw-no-liquid" data-sw-topic-page data-topic-open="${esc(slug)}" aria-expanded="false" aria-controls="${id}-wing">
          <span class="sw-topic-page-material">
            <span class="sw-topic-page-rim" aria-hidden="true"></span>
            <span class="sw-topic-page-glow" aria-hidden="true"></span>
            <span class="sw-topic-brandmark">SIGN WELL</span>
            <span class="sw-topic-count-badge"><b>${count}</b> ${suffix}</span>
            <span class="sw-topic-spine">${esc(item.name||'未命名主題')}<small>TOPIC ${String(i+1).padStart(2,'0')}</small></span>
          </span>
        </button>
        <aside class="sw-topic-wing" id="${id}-wing" data-sw-topic-wing aria-hidden="true">
          <span class="sw-topic-kicker">SIGN WELL · TOPIC</span>
          <h2>${esc(item.name||'未命名主題')}</h2>
          <p class="sw-topic-desc">${esc(item.description||'瀏覽這個主題的相關文章與延伸整理。')}</p>
          <div class="sw-topic-meta"><b>${count}</b> ${suffix}</div>
          <div class="sw-topic-wing-actions">
            <button type="button" class="sw-topic-wing-enter" data-sw-topic-wing-enter>進入主題</button>
            <button type="button" class="sw-topic-wing-close" data-sw-topic-wing-close aria-label="收起主題">×</button>
          </div>
        </aside>
      </div>`;
    }).join('');
    const dots=list.map((item,i)=>`<button type="button" class="sw-topic-dot${i===0?' is-active':''}" data-sw-topic-dot data-index="${i}" aria-label="${esc(item.name||`主題 ${i+1}`)}"></button>`).join('');
    return `<section class="sw-topic-magazine sw-topics-v2422" data-sw-topic-magazine aria-label="SIGN WELL 主題瀏覽器">
      <div class="sw-topic-stage" data-sw-topic-stage>
        <div class="sw-topic-scroller" data-sw-topic-scroller tabindex="0" aria-label="主題橫向瀏覽">
          <div class="sw-topic-row" data-sw-topic-row>${cards}</div>
        </div>
        <div class="sw-topic-dots" role="group" aria-label="主題位置">${dots}</div>
        <div class="sw-topic-console sw-no-liquid">
          <button type="button" class="sw-topic-search sw-no-liquid" data-sw-topic-search aria-label="搜尋 SIGN WELL">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
            <span>搜尋主題與文章</span><kbd>⌘K</kbd>
          </button>
          <div class="sw-topic-hint"><b data-sw-topic-state>左右滑動探索主題</b><span>點一下卡片展開資訊，玻璃會隨游標回應。</span></div>
          <button type="button" class="sw-topic-enter sw-no-liquid" data-sw-topic-enter hidden>進入主題 →</button>
        </div>
      </div>
    </section>`;
  }

  function mount(root,options={}){
    if(!root||!root.matches('[data-sw-topic-magazine]'))return null;
    const stage=root.querySelector('[data-sw-topic-stage]');
    const scroller=root.querySelector('[data-sw-topic-scroller]');
    const items=[...root.querySelectorAll('[data-sw-topic-item]')];
    const cards=items.map(x=>x.querySelector('[data-sw-topic-page]'));
    const wings=items.map(x=>x.querySelector('[data-sw-topic-wing]'));
    const dots=[...root.querySelectorAll('[data-sw-topic-dot]')];
    const search=root.querySelector('[data-sw-topic-search]');
    const enter=root.querySelector('[data-sw-topic-enter]');
    const state=root.querySelector('[data-sw-topic-state]');
    if(!stage||!scroller||!items.length)return null;

    let selected=-1;
    let nearest=0;
    let scrollFrame=0;
    let stageFrame=0;
    let destroyed=false;
    const cleanups=[];

    function setDot(i){nearest=Math.max(0,Math.min(items.length-1,i));dots.forEach((d,j)=>d.classList.toggle('is-active',j===nearest));}
    function center(i,behavior=reduced()?'auto':'smooth'){
      const item=items[i];if(!item)return;
      const x=item.offsetLeft+item.offsetWidth/2-scroller.clientWidth/2;
      scroller.scrollTo({left:Math.max(0,x),behavior});
      setDot(i);
    }
    function chooseWingSide(i){
      const item=items[i],wing=wings[i];if(!item||!wing)return;
      item.classList.remove('copy-left');
      const r=item.getBoundingClientRect();
      const roomRight=innerWidth-r.right;
      const roomLeft=r.left;
      const need=Math.min(330,Math.max(230,innerWidth*.26))*.72;
      if(roomRight<need&&roomLeft>roomRight)item.classList.add('copy-left');
    }
    function updateState(){
      root.classList.toggle('has-selection',selected>=0);
      items.forEach((item,i)=>{
        const active=i===selected;
        item.classList.toggle('is-selected',active);
        cards[i]?.setAttribute('aria-expanded',active?'true':'false');
        wings[i]?.setAttribute('aria-hidden',active?'false':'true');
      });
      if(selected>=0){
        const label=items[selected].querySelector('.sw-topic-spine')?.childNodes?.[0]?.textContent?.trim()||'主題';
        if(state)state.textContent=`已展開：${label}`;
        if(enter){enter.hidden=false;enter.textContent=`進入「${label}」 →`;}
      }else{
        if(state)state.textContent='左右滑動探索主題';
        if(enter)enter.hidden=true;
      }
    }
    function select(i,{focus=true}={}){
      if(i<0||i>=items.length)return;
      if(selected===i){clearSelection();return;}
      selected=i;
      chooseWingSide(i);
      updateState();
      center(i);
      if(focus)requestAnimationFrame(()=>cards[i]?.focus({preventScroll:true}));
    }
    function clearSelection(){
      if(selected<0)return;
      const i=selected;selected=-1;updateState();setDot(i);cards[i]?.focus({preventScroll:true});
    }
    function openSelected(i=selected){
      if(i<0||i>=items.length)return;
      const slug=cards[i]?.dataset.topicOpen||'';
      if(slug)options.onOpen?.(slug);
    }
    function onScroll(){
      if(scrollFrame)return;
      scrollFrame=requestAnimationFrame(()=>{
        scrollFrame=0;
        const c=scroller.getBoundingClientRect().left+scroller.clientWidth/2;
        let best=0,dist=Infinity;
        items.forEach((item,i)=>{const r=item.getBoundingClientRect();const d=Math.abs(r.left+r.width/2-c);if(d<dist){dist=d;best=i;}});
        if(selected<0)setDot(best);
      });
    }
    scroller.addEventListener('scroll',onScroll,{passive:true});
    cleanups.push(()=>scroller.removeEventListener('scroll',onScroll));

    cards.forEach((card,i)=>{
      const click=()=>select(i);
      card.addEventListener('click',click);
      cleanups.push(()=>card.removeEventListener('click',click));
      const focus=()=>{if(selected<0)center(i,reduced()?'auto':'smooth');};
      card.addEventListener('focus',focus);
      cleanups.push(()=>card.removeEventListener('focus',focus));
      const motion=window.SignWellMotionV2422;
      if(motion?.bindPointerSurface){
        cleanups.push(motion.bindPointerSurface(card,{tilt:true,tiltX:2.2,tiltY:2.5,vars:{x:'--glass-x',y:'--glass-y',active:'--glass-live',rx:'--topic-tilt-x',ry:'--topic-tilt-y'}}));
      }
      const enterBtn=wings[i]?.querySelector('[data-sw-topic-wing-enter]');
      const closeBtn=wings[i]?.querySelector('[data-sw-topic-wing-close]');
      if(enterBtn){const fn=(e)=>{e.stopPropagation();openSelected(i)};enterBtn.addEventListener('click',fn);cleanups.push(()=>enterBtn.removeEventListener('click',fn));}
      if(closeBtn){const fn=(e)=>{e.stopPropagation();clearSelection()};closeBtn.addEventListener('click',fn);cleanups.push(()=>closeBtn.removeEventListener('click',fn));}
    });

    dots.forEach((dot,i)=>{const fn=()=>{if(selected>=0)clearSelection();center(i);cards[i]?.focus({preventScroll:true});};dot.addEventListener('click',fn);cleanups.push(()=>dot.removeEventListener('click',fn));});
    if(search){const fn=()=>document.getElementById('searchBtn')?.click();search.addEventListener('click',fn);cleanups.push(()=>search.removeEventListener('click',fn));}
    if(enter){const fn=()=>openSelected();enter.addEventListener('click',fn);cleanups.push(()=>enter.removeEventListener('click',fn));}

    const key=(e)=>{
      if(e.key==='Escape'&&selected>=0){e.preventDefault();clearSelection();return;}
      if(e.target.closest?.('[data-sw-topic-wing]'))return;
      if(e.key==='ArrowRight'||e.key==='ArrowDown'){e.preventDefault();const n=Math.min(items.length-1,(selected>=0?selected:nearest)+1);if(selected>=0)select(n);else{center(n);cards[n]?.focus({preventScroll:true});}}
      else if(e.key==='ArrowLeft'||e.key==='ArrowUp'){e.preventDefault();const n=Math.max(0,(selected>=0?selected:nearest)-1);if(selected>=0)select(n);else{center(n);cards[n]?.focus({preventScroll:true});}}
      else if(e.key==='Home'){e.preventDefault();center(0);cards[0]?.focus({preventScroll:true});}
      else if(e.key==='End'){e.preventDefault();const n=items.length-1;center(n);cards[n]?.focus({preventScroll:true});}
    };
    scroller.addEventListener('keydown',key);root.addEventListener('keydown',key);cleanups.push(()=>{scroller.removeEventListener('keydown',key);root.removeEventListener('keydown',key);});

    if(quality()==='high'&&!window.SignWellMotionV2422?.coarsePointer){
      const move=(e)=>{
        if(e.pointerType==='touch')return;
        if(stageFrame)return;
        const x=e.clientX,y=e.clientY;
        stageFrame=requestAnimationFrame(()=>{
          stageFrame=0;const r=stage.getBoundingClientRect();const px=(x-r.left)/Math.max(1,r.width)-.5,py=(y-r.top)/Math.max(1,r.height)-.5;
          stage.style.setProperty('--topic-bg-x',`${(px*10).toFixed(2)}px`);stage.style.setProperty('--topic-bg-y',`${(py*8).toFixed(2)}px`);
        });
      };
      stage.addEventListener('pointermove',move,{passive:true});cleanups.push(()=>stage.removeEventListener('pointermove',move));
    }

    const resize=()=>{if(selected>=0)chooseWingSide(selected)};
    addEventListener('resize',resize,{passive:true});cleanups.push(()=>removeEventListener('resize',resize));

    requestAnimationFrame(()=>center(0,'auto'));
    updateState();

    const api={
      root,
      select,
      clearSelection,
      gotoIndex(i){if(selected>=0)clearSelection();center(i);},
      destroy(){if(destroyed)return;destroyed=true;if(scrollFrame)cancelAnimationFrame(scrollFrame);if(stageFrame)cancelAnimationFrame(stageFrame);for(const fn of cleanups.splice(0))try{fn()}catch(_){}}
    };
    root.__swTopicsV2422=api;
    return api;
  }

  const api=Object.freeze({version:'24.22.0',markup,mount});
  window.SWTopicsV2422=api;
  /* Compatibility contract: existing renderTopics() calls SWTopicMagazine. */
  window.SWTopicMagazine=api;
})();
