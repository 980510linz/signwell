/* SIGN WELL Public v23.9.20 · runtime performance / quality guardrails */
(()=>{
  'use strict';
  const d=document, root=d.documentElement;
  const ready=()=>{
    const b=d.body;if(!b)return;
    root.classList.add('sw-v23');
    const conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    const saveData=!!(conn&&conn.saveData);
    const lowMem=Number(navigator.deviceMemory||8)<=4;
    const coarse=matchMedia('(pointer:coarse)').matches;
    if(saveData || (lowMem&&coarse)) b.classList.add('sw-perf-lite');

    let scrollTimer=0, ticking=false;
    addEventListener('scroll',()=>{
      if(!ticking){
        ticking=true;requestAnimationFrame(()=>{b.classList.add('sw-scrolling');ticking=false;});
      }
      clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>b.classList.remove('sw-scrolling'),150);
    },{passive:true});

    const syncVisibility=()=>b.classList.toggle('sw-page-hidden',d.hidden);
    d.addEventListener('visibilitychange',syncVisibility,{passive:true});syncVisibility();

    const tuneImg=(img,idx=1)=>{
      if(!(img instanceof HTMLImageElement))return;
      img.decoding=img.decoding||'async';
      img.draggable=false;
      const priority=idx===0 || !!img.closest('.hero,.article-top,.article-cover,.cover-box,.share-qr');
      if(priority){ if(!img.getAttribute('fetchpriority')) img.setAttribute('fetchpriority','high'); }
      else{
        if(!img.getAttribute('loading')) img.loading='lazy';
        if(!img.getAttribute('fetchpriority')) img.setAttribute('fetchpriority','low');
      }
    };
    [...d.images].forEach(tuneImg);
    const mo=new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{
      if(n.nodeType!==1)return;
      if(n.matches?.('img')) tuneImg(n,1);
      n.querySelectorAll?.('img').forEach(img=>tuneImg(img,1));
    })));
    mo.observe(b,{childList:true,subtree:true});

    d.querySelectorAll('a[target="_blank"]').forEach(a=>{
      const rel=new Set((a.rel||'').split(/\s+/).filter(Boolean));rel.add('noopener');rel.add('noreferrer');a.rel=[...rel].join(' ');
    });
  };
  if(d.readyState==='loading')d.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();


/* SIGN WELL 23.9.0 · resilient interaction layer */
(()=>{
  'use strict';
  const d=document;
  const whenReady=(fn)=>d.readyState==='loading'?d.addEventListener('DOMContentLoaded',fn,{once:true}):fn();
  whenReady(()=>{
    const b=d.body;if(!b)return;

    // Accessible online/offline feedback. Nothing is blocked; users simply know why fresh content may fail.
    const net=d.createElement('div');
    net.className='sw-network-status';net.setAttribute('role','status');net.setAttribute('aria-live','polite');net.setAttribute('aria-atomic','true');
    d.body.appendChild(net);
    let hideTimer=0;
    const announceNetwork=(online,initial=false)=>{
      clearTimeout(hideTimer);
      b.classList.toggle('sw-offline',!online);
      net.classList.toggle('online',online);
      net.textContent=online?'連線已恢復':'目前離線，部分內容可能無法更新';
      if(initial&&online)return;
      net.classList.add('show');
      if(online)hideTimer=setTimeout(()=>net.classList.remove('show'),2600);
    };
    addEventListener('online',()=>announceNetwork(true));
    addEventListener('offline',()=>announceNetwork(false));
    announceNetwork(navigator.onLine!==false,true);

    // Upgrade dynamic announcements without changing existing visual components.
    const hardenDynamicA11y=(root=d)=>{
      root.querySelectorAll?.('.toast,.newsletter-status,.publish-status,.save-state').forEach(el=>{
        if(!el.hasAttribute('role'))el.setAttribute('role','status');
        if(!el.hasAttribute('aria-live'))el.setAttribute('aria-live','polite');
      });
      root.querySelectorAll?.('a[target="_blank"]').forEach(a=>{
        const rel=new Set((a.rel||'').split(/\s+/).filter(Boolean));rel.add('noopener');rel.add('noreferrer');a.rel=[...rel].join(' ');
      });
    };
    hardenDynamicA11y();
    new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)hardenDynamicA11y(n)}))).observe(b,{childList:true,subtree:true});

    // Intent-based prefetch for same-origin documents. Disabled for Save-Data / slow networks.
    const conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    const canPrefetch=!(conn&&conn.saveData)&&!/(^|-)2g$/.test(String(conn&&conn.effectiveType||''));
    const prefetched=new Set();
    const prefetch=a=>{
      if(!canPrefetch||!(a instanceof HTMLAnchorElement))return;
      let u;try{u=new URL(a.href,location.href)}catch(_){return}
      if(u.origin!==location.origin||u.protocol!=='https:'&&u.protocol!=='http:')return;
      if(u.pathname===location.pathname||prefetched.has(u.href))return;
      if(!/\.(?:html?)$/i.test(u.pathname)&&!u.pathname.endsWith('/'))return;
      const l=d.createElement('link');l.rel='prefetch';l.href=u.href;l.as='document';d.head.appendChild(l);prefetched.add(u.href);
    };
    if(canPrefetch){
      d.addEventListener('pointerover',e=>prefetch(e.target.closest?.('a[href]')),{passive:true});
      d.addEventListener('focusin',e=>prefetch(e.target.closest?.('a[href]')),{passive:true});
    }
  });
})();

/* SIGN WELL v23.9.20 · article citation/source confirmation */
(()=>{
  'use strict';
  const d=document;
  const selector='.article-body sup a[href], .article-body .refs a[href], .article-body .sw-source-figure a[href], .sw-evidence-ref[href]';
  const sourceLabel=a=>{
    const card=a.closest('.sw-evidence-ref');
    const titled=card?.querySelector('strong')?.textContent?.trim();
    if(titled)return titled;
    const ref=a.closest('li');
    const liText=ref?.textContent?.replace(/\s+/g,' ')?.trim();
    if(liText)return liText.replace(/^\[?\d+\]?\s*/,'').slice(0,120);
    return a.getAttribute('aria-label')||a.textContent?.trim()||'外部來源';
  };
  d.addEventListener('click',async e=>{
    const a=e.target.closest?.(selector);
    if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    let url;try{url=new URL(a.href,location.href)}catch(_){return}
    if(!/^https?:$/i.test(url.protocol)||url.origin===location.origin)return;
    e.preventDefault();
    const label=sourceLabel(a);
    const host=url.hostname.replace(/^www\./,'');
    const message=`即將離開 SIGN WELL，前往引用來源：${label}\n\n來源網站：${host}`;
    let ok=true;
    if(typeof window.swConfirm==='function'){
      ok=await window.swConfirm(message,{
        title:'前往文章引用來源？',
        kicker:'SIGN WELL · SOURCE',
        confirmText:'前往來源',
        cancelText:'留在本站',
        hint:'外部網站的內容與隱私政策由該網站負責。',
        tone:'info',
        icon:'↗'
      });
    }else{
      ok=window.confirm('即將前往外部引用來源，是否繼續？');
    }
    if(!ok)return;
    const follow=d.createElement('a');
    follow.href=url.href;
    follow.target='_blank';
    follow.rel='noopener noreferrer';
    follow.style.display='none';
    d.body.appendChild(follow);
    follow.click();
    follow.remove();
  },true);
})();

