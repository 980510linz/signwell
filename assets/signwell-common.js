/* SIGN WELL Public Runtime · Release 23.9.0 */
window.SIGNWELL_RELEASE=Object.freeze({version:"23.9.0",buildDate:"2026-09-13"});
document.documentElement.dataset.signwellRelease="23.9.0";

(() => {
  const root=document.documentElement;
  const lowMemory=(Number(navigator.deviceMemory||8)<=4);
  const lowCPU=(Number(navigator.hardwareConcurrency||8)<=4);
  const saveData=Boolean(navigator.connection&&navigator.connection.saveData);
  if(lowMemory||lowCPU||saveData)root.classList.add('sw-lowfx');

  const syncVisibility=()=>{
    document.body?.classList.toggle('sw-page-hidden',document.hidden);
  };
  document.addEventListener('visibilitychange',syncVisibility,{passive:true});
  syncVisibility();
})();


;


(() => {
  const setVar=(k,v)=>{ try{ document.body && document.body.style.setProperty(k,v); }catch(_){} };

  const wrap = (name, handler) => {
    const orig = window[name];
    if(typeof orig !== 'function') return;
    window[name] = function(...args){
      const out = orig.apply(this,args);
      try{ handler(args); }catch(_){ }
      return out;
    };
  };

  wrap('setPagerRouteGesture', ([progress=0,direction=0]) => {
    const p = Math.max(0, Math.min(1, Number(progress) || 0));
    const dir = Math.sign(Number(direction) || 0);
    const shift = Math.min(window.innerWidth * .27, 220);
    setVar('--route-progress', p.toFixed(3));
    setVar('--route-opacity', (1 - (p * .62)).toFixed(3));
    setVar('--route-chrome-opacity', (1 - (p * .48)).toFixed(3));
    setVar('--route-scale', '1');
    setVar('--route-veil', (p * .30).toFixed(3));
    setVar('--route-x', (-dir * p * shift).toFixed(2) + 'px');
    if(dir) setVar('--route-enter-x', (dir * Math.min(window.innerWidth * .18, 148)).toFixed(2) + 'px');
  });

  wrap('beginPagerGestureFX', ([seed=.035]) => {
    const p = Math.max(.03, Math.min(1, Number(seed) || .035));
    setVar('--route-progress', p.toFixed(3));
    setVar('--route-scale', '1');
  });

  wrap('cancelPagerGestureFX', () => {
    setVar('--route-progress','0');
    setVar('--route-scale','1');
  });

  wrap('beginPagerRouteFX', ([opts]) => {
    const direction = Math.sign(Number((opts && opts.direction) || 0));
    setVar('--route-progress','1');
    setVar('--route-opacity','.06');
    setVar('--route-chrome-opacity','.18');
    setVar('--route-scale','1');
    setVar('--route-veil','.32');
    if(direction) setVar('--route-enter-x', (direction * Math.min(window.innerWidth * .18, 148)).toFixed(2) + 'px');
  });

  wrap('playPagerRouteEntrance', () => {
    setVar('--route-progress','0');
    setVar('--route-scale','1');
  });

  wrap('playPagerSoftRouteEntrance', () => {
    setVar('--route-progress','0');
    setVar('--route-scale','1');
  });

  const applyTitleBalance = () => {
    document.querySelectorAll('.hero h1,.page-hero h1,.about-hero h1,.share-title,.newsletter-card h1,.article-top h1').forEach(el => {
      el.style.textWrap = 'balance';
      el.style.backfaceVisibility = 'hidden';
      el.style.transform = 'translateZ(0)';
    });
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', applyTitleBalance, { once:true });
  }else{
    applyTitleBalance();
  }
})();


;


(() => {
  const root = document.documentElement;
  const prefersDark = () => document.body && document.body.classList.contains('dark');

  function enhanceTitles(){
    document.querySelectorAll('.hero h1,.page-hero h1,.about-hero h1,.share-title,.newsletter-card h1,.article-top h1').forEach(el=>{
      el.style.textWrap='balance';
      el.style.transform='translateZ(0)';
      el.style.backfaceVisibility='hidden';
    });
  }

  function n(v, d=0){ v = Number(v); return Number.isFinite(v) ? v : d; }

  const wrap = (name, handler) => {
    const orig = window[name];
    if(typeof orig !== 'function') return;
    window[name] = function(...args){
      const out = orig.apply(this, args);
      try{ handler(args); }catch(_){ }
      return out;
    };
  };

  wrap('setPagerRouteGesture', ([progress=0]) => {
    const p = Math.max(0, Math.min(1, n(progress, 0)));
    document.body.style.setProperty('--route-progress', p.toFixed(3));
  });
  wrap('cancelPagerGestureFX', () => {
    document.body.style.setProperty('--route-progress','0');
  });
  wrap('playPagerRouteEntrance', () => {
    document.body.style.setProperty('--route-progress','0');
    enhanceTitles();
  });
  wrap('playPagerSoftRouteEntrance', () => {
    document.body.style.setProperty('--route-progress','0');
    enhanceTitles();
  });
  wrap('render', () => {
    setTimeout(enhanceTitles, 30);
  });

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', enhanceTitles, {once:true});
  }else{
    enhanceTitles();
  }
})();


;


(() => {
  'use strict';
  const mq = window.matchMedia('(max-width:760px)');
  let lastArticle = null;

  function syncViewportClass(){
    document.documentElement.classList.toggle('sw-mobile-v22', mq.matches);
  }

  function closeTocSheet(){
    const sheet=document.getElementById('swMobileTocSheet');
    if(sheet) sheet.classList.remove('show');
    document.body.classList.remove('sw-mobile-sheet-open');
  }

  function openTocSheet(article){
    const toc=article.querySelector('.toc');
    const buttons=[...(toc?.querySelectorAll('button[data-toc]')||[])];
    if(!buttons.length) return;

    let sheet=document.getElementById('swMobileTocSheet');
    if(!sheet){
      sheet=document.createElement('div');
      sheet.id='swMobileTocSheet';
      sheet.className='sw-mobile-toc-sheet';
      sheet.setAttribute('role','dialog');
      sheet.setAttribute('aria-modal','true');
      sheet.setAttribute('aria-label','本文導覽');
      sheet.innerHTML=`
        <div class="sw-mobile-toc-scrim" data-sw-toc-close></div>
        <section class="sw-mobile-toc-panel">
          <div class="sw-mobile-toc-handle" aria-hidden="true"></div>
          <header class="sw-mobile-toc-head"><strong>本文導覽</strong><button class="sw-mobile-toc-close" type="button" data-sw-toc-close aria-label="關閉">×</button></header>
          <div class="sw-mobile-toc-list"></div>
        </section>`;
      document.body.appendChild(sheet);
      sheet.querySelectorAll('[data-sw-toc-close]').forEach(el=>el.addEventListener('click',closeTocSheet));
    }

    const list=sheet.querySelector('.sw-mobile-toc-list');
    list.innerHTML='';
    buttons.forEach((src,i)=>{
      const b=document.createElement('button');
      b.type='button';
      b.textContent=`${String(i+1).padStart(2,'0')}  ${src.textContent.trim()}`;
      b.addEventListener('click',()=>{
        const id=src.getAttribute('data-toc');
        closeTocSheet();
        setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'}),80);
      });
      list.appendChild(b);
    });
    sheet.classList.add('show');
    document.body.classList.add('sw-mobile-sheet-open');
    setTimeout(()=>sheet.querySelector('.sw-mobile-toc-close')?.focus(),40);
  }

  function enhanceArticle(article){
    if(!article) return;

    article.querySelectorAll('table').forEach(table=>{
      table.setAttribute('role','region');
      table.setAttribute('aria-label','可水平捲動的表格');
      table.tabIndex=0;
    });

    const toc=article.querySelector('.toc');
    const count=toc?.querySelectorAll('button[data-toc]').length||0;
    if(count && !article.querySelector('.sw-mobile-toc-launch')){
      const launch=document.createElement('button');
      launch.type='button';
      launch.className='sw-mobile-toc-launch';
      launch.innerHTML=`<span>本文導覽</span><small>${count} 個章節 · 點擊展開</small>`;
      const layout=article.querySelector('.article-layout');
      if(layout) layout.parentNode.insertBefore(launch,layout);
      launch.addEventListener('click',()=>openTocSheet(article));
    }
  }

  function auditDynamicUI(){
    syncViewportClass();
    const article=document.querySelector('.article-view');
    document.body.classList.toggle('sw-reading',Boolean(article));
    if(article && article!==lastArticle){
      lastArticle=article;
      enhanceArticle(article);
    }
    if(!article){
      lastArticle=null;
      closeTocSheet();
    }
  }

  const app=document.getElementById('app');
  if(app){
    new MutationObserver(()=>requestAnimationFrame(auditDynamicUI)).observe(app,{childList:true,subtree:true});
  }
  mq.addEventListener?.('change',auditDynamicUI);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTocSheet()});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',auditDynamicUI,{once:true});
  else auditDynamicUI();
})();


;


/* Public v22.8 · show newsletter invitation after the second unique article view. */
(() => {
  const VIEWS_KEY='signwell-article-views-session-v1';
  const SHOWN_KEY='signwell-article-join-shown-session-v1';
  const FOCUS_KEY='signwell-newsletter-focus-request-v1';
  const SUBSCRIBED_KEY='signwell-newsletter-subscribed';
  let promptTimer=0;

  const safeGet=(store,key)=>{try{return store.getItem(key)}catch(_){return null}};
  const safeSet=(store,key,val)=>{try{store.setItem(key,val)}catch(_){}};
  const alreadySubscribed=()=>{
    if(safeGet(localStorage,SUBSCRIBED_KEY)==='1'||safeGet(localStorage,'signwell-newsletter-interested-v1')==='1')return true;
    if(safeGet(localStorage,'signwell-newsletter-pending')==='1'){
      const at=Number(safeGet(localStorage,'signwell-newsletter-pending-at')||0);
      if(at&&Date.now()-at<7*86400000)return true;
      try{localStorage.removeItem('signwell-newsletter-pending');localStorage.removeItem('signwell-newsletter-pending-at')}catch(_){}
    }
    return false;
  };

  function articleViews(){
    try{
      const raw=JSON.parse(safeGet(sessionStorage,VIEWS_KEY)||'[]');
      return Array.isArray(raw)?raw.filter(Boolean).map(String):[];
    }catch(_){return []}
  }
  function saveArticleViews(list){safeSet(sessionStorage,VIEWS_KEY,JSON.stringify([...new Set(list)].slice(-30)))}
  function markPromptShown(){safeSet(sessionStorage,SHOWN_KEY,'1')}
  function promptAlreadyShown(){return safeGet(sessionStorage,SHOWN_KEY)==='1'}

  function dismissArticleJoinPrompt(){
    const el=document.getElementById('swArticleJoinOverlay');
    if(!el)return;
    el.classList.remove('show');
    setTimeout(()=>el.remove(),260);
  }

  function focusNewsletterSignup(){
    const attempt=(n=0)=>{
      const email=document.getElementById('newsletterEmail');
      const card=document.querySelector('.newsletter-card');
      if(email){
        safeSet(sessionStorage,FOCUS_KEY,'0');
        (card||email).scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
        setTimeout(()=>{try{email.focus({preventScroll:true})}catch(_){email.focus()}},260);
        return;
      }
      if(n<24)setTimeout(()=>attempt(n+1),90);
    };
    attempt();
  }

  function goToNewsletterSignup(){
    dismissArticleJoinPrompt();
    safeSet(sessionStorage,FOCUS_KEY,'1');
    try{
      if(typeof window.markIdleSubscribeHandled==='function')window.markIdleSubscribeHandled(false);
      if(typeof window.goto==='function'){
        window.goto('newsletter');
        setTimeout(focusNewsletterSignup,120);
        return;
      }
    }catch(_){}
    location.assign(new URL('newsletter.html',location.href).href);
  }

  function ensureArticleJoinPrompt(){
    let el=document.getElementById('swArticleJoinOverlay');
    if(el)return el;
    el=document.createElement('div');
    el.id='swArticleJoinOverlay';
    el.className='sw-article-join-overlay';
    el.setAttribute('role','presentation');
    el.innerHTML=`<section class="sw-article-join-card" role="dialog" aria-modal="true" aria-labelledby="swArticleJoinTitle">
      <button class="sw-article-join-close" type="button" aria-label="稍後再說">×</button>
      <div class="sw-article-join-kicker">SIGN WELL LETTER · 免費</div>
      <h2 class="sw-article-join-title" id="swArticleJoinTitle">喜歡我們的網站就加入我們吧！</h2>
      <p class="sw-article-join-copy">免費加入。每週整理值得看的醫療內容與新文章，直接寄到你的信箱。只在有值得閱讀的內容時出現。</p>
      <div class="sw-article-join-actions">
        <button class="sw-article-join-primary" type="button">免費加入電子報</button>
        <button class="sw-article-join-later" type="button">稍後再說</button>
      </div>
    </section>`;
    document.body.appendChild(el);
    const close=()=>dismissArticleJoinPrompt();
    el.querySelector('.sw-article-join-primary')?.addEventListener('click',goToNewsletterSignup);
    el.querySelector('.sw-article-join-later')?.addEventListener('click',close);
    el.querySelector('.sw-article-join-close')?.addEventListener('click',close);
    el.addEventListener('click',e=>{if(e.target===el)close()});
    const esc=e=>{if(e.key==='Escape'){close();document.removeEventListener('keydown',esc)}};
    document.addEventListener('keydown',esc);
    return el;
  }

  function registerArticleView(slug){
    const id=String(slug||'').trim();
    if(!id||alreadySubscribed())return;
    const views=articleViews();
    if(!views.includes(id)){views.push(id);saveArticleViews(views)}
    if(views.length<2||promptAlreadyShown())return;
    markPromptShown();
    try{if(typeof window.markIdleSubscribeHandled==='function')window.markIdleSubscribeHandled(false)}catch(_){}
    clearTimeout(promptTimer);
    promptTimer=setTimeout(()=>{
      if(alreadySubscribed()||document.hidden)return;
      const el=ensureArticleJoinPrompt();
      requestAnimationFrame(()=>el.classList.add('show'));
    },950);
  }

  function attachArticleHook(){
    if(typeof window.renderArticle!=='function'||window.renderArticle.__swArticleJoinWrapped)return;
    const original=window.renderArticle;
    const wrapped=async function(slug){
      const result=await original.apply(this,arguments);
      registerArticleView(slug);
      return result;
    };
    wrapped.__swArticleJoinWrapped=true;
    window.renderArticle=wrapped;
  }

  function restoreNewsletterFocus(){
    if(safeGet(sessionStorage,FOCUS_KEY)==='1')setTimeout(focusNewsletterSignup,160);
  }

  attachArticleHook();
  restoreNewsletterFocus();
  addEventListener('pageshow',restoreNewsletterFocus);
  addEventListener('popstate',restoreNewsletterFocus);
  addEventListener('hashchange',restoreNewsletterFocus);
})();


/* Release 23.9.0 · legal links are always reachable, independent of newsletter modal state. */
(function ensureSignwellLegalFooter(){
  const run=()=>{
    document.querySelectorAll('.footer').forEach(footer=>{
      if(footer.querySelector('.sw-legal-links')) return;
      const nav=document.createElement('nav');
      nav.className='sw-legal-links';
      nav.setAttribute('aria-label','法律資訊');
      nav.innerHTML='<a href="privacy.html">隱私權政策</a><span>·</span><a href="terms.html">服務條款</a>';
      footer.appendChild(nav);
    });
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true}); else run();
})();

/* SIGN WELL v23.9.40 · subtle tap scale pulse for the bottom liquid-glass frame */
(function swPagerTapBounce(){
  const rail=document.getElementById('pager');
  if(!rail||rail.dataset.swTapBounce==='1')return;
  rail.dataset.swTapBounce='1';
  const reduced=()=>window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pointerId=null,startX=0,startY=0;
  let timer=0;
  const bounce=()=>{
    if(reduced())return;
    clearTimeout(timer);
    rail.classList.remove('sw-tap-bounce');
    void rail.offsetWidth;
    rail.classList.add('sw-tap-bounce');
    timer=setTimeout(()=>rail.classList.remove('sw-tap-bounce'),340);
  };
  rail.addEventListener('pointerdown',e=>{
    pointerId=e.pointerId;
    startX=e.clientX;
    startY=e.clientY;
  },{passive:true});
  rail.addEventListener('pointerup',e=>{
    if(pointerId!==null&&e.pointerId===pointerId){
      const dx=e.clientX-startX,dy=e.clientY-startY;
      if(Math.hypot(dx,dy)<9)bounce();
    }
    pointerId=null;
  },{passive:true});
  rail.addEventListener('pointercancel',()=>{pointerId=null},{passive:true});
  rail.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' ')bounce();
  });
})();

/* SIGN WELL v23.9.55 · automatic medical glossary cards */
(function swMedicalGlossaryRuntime(){
  if(window.__swMedicalGlossaryRuntime)return;
  window.__swMedicalGlossaryRuntime=true;
  const CACHE_KEY='signwell-public-bundle-v22-2';
  const norm=v=>String(v||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLowerCase();
  const escRx=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  let currentSignature='';
  let annotateTimer=0;
  let pressTimer=0,pressStart=null;

  function glossary(){
    let list=[];
    try{
      const bundle=JSON.parse(sessionStorage.getItem(CACHE_KEY)||'null');
      if(Array.isArray(bundle?.glossary))list=bundle.glossary;
    }catch(_){}
    if(!list.length&&Array.isArray(window.SIGNWELL_GLOSSARY))list=window.SIGNWELL_GLOSSARY;
    return list.filter(g=>g&&g.active!==false&&String(g.term||'').trim()&&String(g.definition||'').trim());
  }
  function signature(list){return list.map(g=>[g.id,g.term,g.translation,g.definition,(g.aliases||[]).join('|'),g.active!==false].join('~')).join('||')}
  function entryById(id){return glossary().find(g=>String(g.id)===String(id))||null}
  function ensureCard(){
    let card=document.getElementById('swMedicalTermCard');
    if(card)return card;
    card=document.createElement('div');card.id='swMedicalTermCard';card.className='sw-med-card';card.setAttribute('aria-hidden','true');
    card.innerHTML='<div class="sw-med-card-panel" role="dialog" aria-modal="false" aria-labelledby="swMedCardTerm"><button type="button" class="sw-med-card-close" aria-label="關閉">×</button><div class="sw-med-card-kicker">SIGN WELL · 醫學詞卡</div><h3 id="swMedCardTerm"></h3><div class="sw-med-card-translation"></div><p class="sw-med-card-definition"></p><div class="sw-med-card-hint">長按文章中的醫學名詞可再次查看</div></div>';
    document.body.appendChild(card);
    card.addEventListener('click',e=>{if(e.target===card||e.target.closest('.sw-med-card-close'))closeCard()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&card.classList.contains('show'))closeCard()});
    return card;
  }
  function openCard(el){
    const g=entryById(el?.dataset?.swTermId);if(!g)return;
    const card=ensureCard();
    card.querySelector('#swMedCardTerm').textContent=el.textContent.trim()||g.term||'';
    card.querySelector('.sw-med-card-translation').textContent=g.translation||g.term||'';
    card.querySelector('.sw-med-card-definition').textContent=g.definition||'';
    card.classList.add('show');card.setAttribute('aria-hidden','false');
    document.body.classList.add('sw-med-card-open');
    try{navigator.vibrate?.(10)}catch(_){}
  }
  function closeCard(){const card=document.getElementById('swMedicalTermCard');if(!card)return;card.classList.remove('show');card.setAttribute('aria-hidden','true');document.body.classList.remove('sw-med-card-open')}
  function unwrap(root){
    root.querySelectorAll('.sw-med-term').forEach(el=>el.replaceWith(document.createTextNode(el.textContent||'')));
    root.normalize();
  }
  function buildMatcher(root,list){
    const text=norm(root.textContent||'');
    const forms=[];
    list.forEach(g=>{
      [g.term,...(Array.isArray(g.aliases)?g.aliases:[])].forEach(form=>{
        const clean=String(form||'').normalize('NFKC').trim();
        const n=norm(clean);
        if(n.length<2||!text.includes(n))return;
        forms.push({form:clean,key:n,id:String(g.id||'')});
      });
    });
    const dedup=new Map();forms.sort((a,b)=>b.form.length-a.form.length).forEach(x=>{if(!dedup.has(x.key))dedup.set(x.key,x)});
    const chosen=[...dedup.values()].slice(0,180);
    if(!chosen.length)return null;
    const byKey=new Map(chosen.map(x=>[x.key,x]));
    const rx=new RegExp(chosen.map(x=>escRx(x.form)).join('|'),'giu');
    return {rx,byKey};
  }
  function shouldSkip(node){
    const p=node.parentElement;if(!p)return true;
    return Boolean(p.closest('a,button,code,pre,script,style,textarea,input,select,option,sup,sub,.sw-med-term,.sw-source-figure,.sw-evidence-ref,.sw-data-source'));
  }
  function annotate(root){
    if(!root||root.dataset.swGlossaryBusy==='1')return;
    const list=glossary();const sig=signature(list);
    if(root.dataset.swGlossarySignature===sig&&root.querySelector('.sw-med-term'))return;
    root.dataset.swGlossaryBusy='1';
    try{
      unwrap(root);
      if(!list.length){root.dataset.swGlossarySignature=sig;return}
      const match=buildMatcher(root,list);if(!match){root.dataset.swGlossarySignature=sig;return}
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:n=>!shouldSkip(n)&&String(n.nodeValue||'').trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT});
      const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
      let total=0;
      nodes.forEach(node=>{
        if(total>=160)return;
        const raw=node.nodeValue||'';match.rx.lastIndex=0;let m,last=0,hit=false;const frag=document.createDocumentFragment();
        while((m=match.rx.exec(raw))&&total<160){
          const shown=m[0],entry=match.byKey.get(norm(shown));if(!entry)continue;
          const before=raw[m.index-1]||'',after=raw[m.index+shown.length]||'';
          if(/^[A-Za-z0-9]$/.test(shown[0]||'')&&/[A-Za-z0-9]/.test(before))continue;
          if(/[A-Za-z0-9]$/.test(shown.slice(-1))&&/[A-Za-z0-9]/.test(after))continue;
          frag.appendChild(document.createTextNode(raw.slice(last,m.index)));
          const span=document.createElement('span');span.className='sw-med-term';span.dataset.swTermId=entry.id;span.tabIndex=0;span.setAttribute('role','button');span.setAttribute('aria-label','長按查看醫學詞卡：'+shown);span.textContent=shown;frag.appendChild(span);
          last=m.index+shown.length;hit=true;total++;
        }
        if(hit){frag.appendChild(document.createTextNode(raw.slice(last)));node.replaceWith(frag)}
      });
      root.dataset.swGlossarySignature=sig;
    }finally{delete root.dataset.swGlossaryBusy}
  }
  function scan(){
    clearTimeout(annotateTimer);annotateTimer=setTimeout(()=>{
      document.querySelectorAll('.article-body').forEach(annotate);
      currentSignature=signature(glossary());
    },45);
  }
  document.addEventListener('pointerdown',e=>{
    const el=e.target.closest?.('.sw-med-term');if(!el)return;
    clearTimeout(pressTimer);pressStart={el,id:e.pointerId,x:e.clientX,y:e.clientY};
    pressTimer=setTimeout(()=>{if(pressStart?.el===el){openCard(el);pressStart=null}},440);
  },{passive:true});
  document.addEventListener('pointermove',e=>{if(!pressStart||e.pointerId!==pressStart.id)return;if(Math.hypot(e.clientX-pressStart.x,e.clientY-pressStart.y)>9){clearTimeout(pressTimer);pressStart=null}},{passive:true});
  ['pointerup','pointercancel'].forEach(type=>document.addEventListener(type,e=>{if(!pressStart||e.pointerId!==pressStart.id)return;clearTimeout(pressTimer);pressStart=null},{passive:true}));
  document.addEventListener('contextmenu',e=>{if(e.target.closest?.('.sw-med-term'))e.preventDefault()});
  document.addEventListener('keydown',e=>{const el=e.target.closest?.('.sw-med-term');if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openCard(el)}});
  const mo=new MutationObserver(records=>{if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&(n.matches?.('.article-body')||n.querySelector?.('.article-body')))))scan()});
  mo.observe(document.documentElement,{childList:true,subtree:true});
  ['pageshow','hashchange','popstate','focus'].forEach(ev=>addEventListener(ev,scan,{passive:true}));
  addEventListener('signwell:glossary-updated',scan);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)scan()},{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();
})();

/* v24.0.20 · Portfolio PDF Compressor entry */
(() => {
  const mount=()=>{
    const footer=document.querySelector('.footer');
    if(!footer || footer.querySelector('.sw-portfolio-tool-link')) return;
    const a=document.createElement('a');
    a.className='sw-portfolio-tool-link';
    a.href='portfolio-compress.html';
    a.textContent='學習歷程壓縮 · PDF ≤ 4 MB';
    a.setAttribute('aria-label','開啟學習歷程 PDF 壓縮工具');
    footer.appendChild(a);
    if(!document.getElementById('swPortfolioToolStyle')){
      const style=document.createElement('style');style.id='swPortfolioToolStyle';
      style.textContent='.sw-portfolio-tool-link{display:inline-flex;align-items:center;justify-content:center;align-self:center;padding:9px 12px;border-radius:999px;border:1px solid rgba(120,140,150,.18);text-decoration:none;font-size:10px;font-weight:800;color:var(--muted,#7b8994);background:rgba(255,255,255,.28);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}body.dark .sw-portfolio-tool-link{color:#d9d2c6;background:rgba(78,86,72,.26);border-color:rgba(239,232,220,.12)}@media(max-width:700px){.sw-portfolio-tool-link{align-self:flex-start}}';
      document.head.appendChild(style);
    }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
