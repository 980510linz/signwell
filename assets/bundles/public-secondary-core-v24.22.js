/* SIGN WELL PUBLIC · Topics/secondary core v24.22
   Purposefully small: data, theme, search, topic rendering and canonical navigation only. */
(()=>{
  'use strict';
  if(window.SignWellTopicsCoreV2422)return;

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=(v='')=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const slugify=(s='')=>String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,70);
  const app=$('#app');
  const toast=$('#toast');
  const DATA_CACHE='signwell-topics-v2422-data';
  const THEME_KEY='signwell-theme';
  const RAW_BUNDLE='https://raw.githubusercontent.com/980510linz/signwell.com/main/public-data.json';
  const RAW_INDEX='https://raw.githubusercontent.com/980510linz/signwell.com/main/articles/index.json';
  const DEFAULT_TEXT={
    siteTitle:'SIGN WELL · 欣緯生醫',brandEnglish:'SIGN WELL',brandChinese:'欣緯科技',
    topicsEyebrow:'主題探討',topicsTitle:'從一個主題，深入理解一整套問題。',topicsSubtitle:'依領域整理文章、臨床問題與延伸閱讀。',
    articleCountSuffix:'篇文章',footerDisclaimer:'本站不提供醫療服務、不招攬醫療業務；內容僅供醫學教育與資訊整理，不構成個別醫療建議。',
    searchPlaceholder:'搜尋文章、主題、關鍵字…'
  };

  let siteText={...DEFAULT_TEXT};
  let topics=[];
  let articles=[];
  let selectedSearch=-1;
  let lastFetch=0;

  function readCache(){try{return JSON.parse(sessionStorage.getItem(DATA_CACHE)||'null')}catch(_){return null}}
  function writeCache(v){try{sessionStorage.setItem(DATA_CACHE,JSON.stringify(v))}catch(_){}}
  async function fetchJSON(url,timeout=7500){
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),timeout);
    try{
      const join=url.includes('?')?'&':'?';
      const res=await fetch(url+join+'sw='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'},signal:ctrl.signal});
      if(!res.ok)throw new Error(`HTTP ${res.status}`);
      return await res.json();
    }finally{clearTimeout(timer)}
  }
  function normalizeTopics(list){return (Array.isArray(list)?list:[]).filter(x=>x&&x.active!==false).map((x,i)=>({
    id:String(x.id||`topic-${i}`),name:String(x.name||'未命名主題'),slug:String(x.slug||slugify(x.name||`topic-${i}`)),description:String(x.description||''),order:Number.isFinite(Number(x.order))?Number(x.order):i,active:x.active!==false
  })).sort((a,b)=>(a.order??999)-(b.order??999)||a.name.localeCompare(b.name,'zh-Hant'))}
  function normalizeArticles(list){return (Array.isArray(list)?list:[]).filter(x=>x&&x.status==='Published').sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')))}
  function revision(v){const n=Number(v?.revision||0);return Number.isFinite(n)?n:0}
  async function loadFresh(){
    const [pageBundle,rawBundle,rawArticles,pageArticles]=await Promise.allSettled([
      fetchJSON('public-data.json'),fetchJSON(RAW_BUNDLE),fetchJSON(RAW_INDEX),fetchJSON('articles/index.json')
    ]);
    const bundles=[pageBundle,rawBundle].filter(x=>x.status==='fulfilled'&&x.value&&Array.isArray(x.value.topics)).map(x=>x.value).sort((a,b)=>revision(b)-revision(a));
    const bundle=bundles[0]||null;
    let articleList=[];
    if(rawArticles.status==='fulfilled'&&Array.isArray(rawArticles.value))articleList=rawArticles.value;
    else if(pageArticles.status==='fulfilled'&&Array.isArray(pageArticles.value))articleList=pageArticles.value;
    if(!bundle&&!articleList.length)throw new Error('PUBLIC data unavailable');
    if(bundle){siteText={...DEFAULT_TEXT,...(bundle.siteText||{})};topics=normalizeTopics(bundle.topics);}
    articles=normalizeArticles(articleList);
    if(!topics.length&&articles.length){const seen=new Set();topics=articles.map(a=>a.category).filter(Boolean).filter(x=>!seen.has(x)&&seen.add(x)).map((name,i)=>({id:`auto-${i}`,name,slug:slugify(name),description:`瀏覽 ${name} 相關文章與延伸整理。`,order:i,active:true}));}
    const data={siteText,topics,articles,at:Date.now()};writeCache(data);lastFetch=Date.now();return true;
  }
  function useCache(){
    const c=readCache();if(!c||!Array.isArray(c.topics))return false;
    siteText={...DEFAULT_TEXT,...(c.siteText||{})};topics=normalizeTopics(c.topics);articles=normalizeArticles(c.articles);lastFetch=Number(c.at||0);return true;
  }

  function topicCount(tp){return articles.filter(a=>a.category===tp.name||slugify(a.category||'')===tp.slug).length}
  function categoryHue(name=''){let h=0;for(const c of String(name||'醫學筆記'))h=((h<<5)-h+c.charCodeAt(0))|0;return 186+(Math.abs(h)%58)}
  function text(k,fb=''){return siteText[k]??fb}
  function excerpt(a){return String(a.excerpt||a.searchText||'').replace(/\s+/g,' ').trim().slice(0,160)}
  function articleUrl(slug){const u=new URL('index.html',new URL('./',location.href));u.search='';u.searchParams.set('article',String(slug||''));u.hash='';return u.href}

  function showToast(msg){if(!toast)return;toast.textContent=msg;toast.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toast.classList.remove('show'),1800)}
  function applyChrome(){
    document.title=`${text('topicsEyebrow','主題探討')} · SIGN WELL`;
    $('#brandEnglish')&&( $('#brandEnglish').textContent=text('brandEnglish','SIGN WELL') );
    $('#brandChinese')&&( $('#brandChinese').textContent=text('brandChinese','欣緯科技') );
    $('#footerBrand')&&( $('#footerBrand').textContent=text('siteTitle') );
    $('#footerDisclaimer')&&( $('#footerDisclaimer').textContent=text('footerDisclaimer') );
    $('#searchInput')?.setAttribute('placeholder',text('searchPlaceholder'));
  }

  function currentTheme(){try{return localStorage.getItem(THEME_KEY)||'system'}catch(_){return'system'}}
  function applyTheme(){
    const pref=currentTheme();const dark=pref==='dark'||(pref==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);
    document.body.classList.toggle('dark',dark);document.body.classList.toggle('taiwan-theme',dark);document.documentElement.dataset.swTheme=dark?'taiwan':'light';
    const btn=$('#themeBtn');if(btn){btn.setAttribute('aria-pressed',dark?'true':'false');btn.setAttribute('aria-label',dark?'切換至淺色模式':'切換至台灣主題色');btn.title=dark?'目前：Formosa Dusk｜切換至淺色模式':'目前：淺色模式｜切換至 Formosa Dusk';}
    const meta=$('#themeColorMeta');if(meta)meta.content=dark?'#102426':'#f7fbff';
  }
  function toggleTheme(){const next=!document.body.classList.contains('dark');try{localStorage.setItem(THEME_KEY,next?'dark':'light')}catch(_){};document.documentElement.classList.add('sw-theme-changing');applyTheme();setTimeout(()=>document.documentElement.classList.remove('sw-theme-changing'),520)}

  function renderLoading(){app.innerHTML='<div class="sw-page-shell"><section class="sw-topic-hero"><div class="eyebrow"><i></i>主題探討</div><h1>整理值得深入的醫學問題。</h1><p>正在取得最新主題。</p></section><div class="sw-loading"><div class="sw-loading-orb" aria-label="載入中"></div></div></div>'}
  function renderTopics(){
    const items=topics.map(tp=>({slug:tp.slug,name:tp.name,description:tp.description||'瀏覽這個主題的相關文章與延伸整理。',count:topicCount(tp),hue:categoryHue(tp.name)}));
    const markup=window.SWTopicMagazine?.markup?window.SWTopicMagazine.markup(items,{articleCountSuffix:text('articleCountSuffix','篇文章')}):'<div class="empty">主題元件尚未載入。</div>';
    app.innerHTML=`<div class="sw-page-shell"><section class="sw-topic-hero"><div class="eyebrow"><i></i>${esc(text('topicsEyebrow','主題探討'))}</div><h1>${esc(text('topicsTitle','從一個主題，深入理解一整套問題。'))}</h1><p>${esc(text('topicsSubtitle','依領域整理文章、臨床問題與延伸閱讀。'))}</p></section>${markup}</div>`;
    const root=$('[data-sw-topic-magazine]');
    window.SWTopicMagazine?.mount?.(root,{onOpen:slug=>{location.hash='topic/'+encodeURIComponent(slug)}});
  }
  function renderTopicDetail(slug){
    let decoded='';try{decoded=decodeURIComponent(slug)}catch(_){decoded=slug}
    const tp=topics.find(x=>x.slug===decoded)||{name:decoded,slug:decoded,description:''};
    const list=articles.filter(a=>a.category===tp.name||slugify(a.category||'')===tp.slug);
    const cards=list.map(a=>`<a class="article-card" href="${esc(articleUrl(a.slug||''))}"><small>${esc(a.category||tp.name)}</small><h3>${esc(a.title||'未命名文章')}</h3><p>${esc(excerpt(a)||'開啟文章閱讀完整內容。')}</p><div class="article-card-meta"><span>${esc(a.publishedAt||'')}</span><span>閱讀文章 →</span></div></a>`).join('');
    app.innerHTML=`<div class="sw-page-shell"><section class="topic-detail"><a class="backlink" href="topics.html">← 返回主題探討</a><div class="topic-detail-head"><div><div class="eyebrow"><i></i>TOPIC · ${esc(tp.name)}</div><h1>${esc(tp.name)}</h1><p>${esc(tp.description||'')}</p></div><div class="topic-detail-count">${list.length} ${esc(text('articleCountSuffix','篇文章'))}</div></div></section><section class="article-grid">${cards||'<div class="empty">這個主題目前還沒有公開文章。</div>'}</section></div>`;
    document.title=`${tp.name} · SIGN WELL`;
  }
  function route(){const h=(location.hash||'').replace(/^#/,'');return h.startsWith('topic/')?{page:'detail',slug:h.slice(6)}:{page:'topics'}}
  function paint(){const r=route();if(r.page==='detail')renderTopicDetail(r.slug);else renderTopics();window.scrollTo({top:0,behavior:'auto'});}

  /* ---------- search ---------- */
  const overlay=$('#searchOverlay'),input=$('#searchInput'),results=$('#searchResults'),hint=$('#searchHint'),count=$('#searchCount');
  function searchItems(q){
    const term=String(q||'').trim().toLocaleLowerCase('zh-Hant');if(!term)return[];
    const topicHits=topics.filter(t=>(`${t.name} ${t.description}`).toLocaleLowerCase('zh-Hant').includes(term)).map(t=>({type:'主題',title:t.name,sub:t.description||`${topicCount(t)} ${text('articleCountSuffix')}`,url:`topics.html#topic/${encodeURIComponent(t.slug)}`}));
    const articleHits=articles.filter(a=>(`${a.title||''} ${a.category||''} ${a.excerpt||''} ${a.searchText||''}`).toLocaleLowerCase('zh-Hant').includes(term)).slice(0,12).map(a=>({type:'文章',title:a.title||'未命名文章',sub:a.category||'',url:articleUrl(a.slug||'')}));
    return [...topicHits,...articleHits].slice(0,18);
  }
  function renderSearch(){
    const q=input?.value||'';const hits=searchItems(q);selectedSearch=hits.length?0:-1;
    if(!q.trim()){hint.textContent='輸入關鍵字開始搜尋';count.textContent='';results.innerHTML='<div class="search-empty">可搜尋主題名稱、文章標題、科別與關鍵字。</div>';return;}
    hint.textContent=hits.length?'搜尋結果':'找不到符合內容';count.textContent=hits.length?`${hits.length} 筆`:'';
    results.innerHTML=hits.length?hits.map((x,i)=>`<a class="search-result${i===selectedSearch?' is-active':''}" data-search-index="${i}" href="${esc(x.url)}"><span class="search-result-icon">${x.type==='主題'?'T':'A'}</span><span class="search-result-copy"><b>${esc(x.title)}</b><span>${esc(x.sub||'')}</span></span><span class="search-result-type">${x.type}</span></a>`).join(''):'<div class="search-empty">沒有找到內容。可以改用更短的關鍵字。</div>';
  }
  function openSearch(){if(!overlay)return;overlay.classList.add('show');document.body.classList.add('search-open');renderSearch();setTimeout(()=>input?.focus(),30)}
  function closeSearch(){overlay?.classList.remove('show');document.body.classList.remove('search-open');}
  function moveSearch(delta){const nodes=$$('[data-search-index]',results);if(!nodes.length)return;selectedSearch=(selectedSearch+delta+nodes.length)%nodes.length;nodes.forEach((n,i)=>n.classList.toggle('is-active',i===selectedSearch));nodes[selectedSearch]?.scrollIntoView({block:'nearest'});}
  $('#searchBtn')?.addEventListener('click',openSearch);$('#searchClose')?.addEventListener('click',closeSearch);input?.addEventListener('input',renderSearch);
  overlay?.addEventListener('pointerdown',e=>{if(e.target===overlay)closeSearch()});
  addEventListener('keydown',e=>{
    if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();overlay?.classList.contains('show')?closeSearch():openSearch();return;}
    if(!overlay?.classList.contains('show'))return;
    if(e.key==='Escape'){e.preventDefault();closeSearch()}
    else if(e.key==='ArrowDown'){e.preventDefault();moveSearch(1)}
    else if(e.key==='ArrowUp'){e.preventDefault();moveSearch(-1)}
    else if(e.key==='Enter'&&selectedSearch>=0){const n=$(`[data-search-index="${selectedSearch}"]`,results);if(n){e.preventDefault();n.click()}}
  });

  $('#themeBtn')?.addEventListener('click',toggleTheme);
  matchMedia('(prefers-color-scheme:dark)').addEventListener?.('change',()=>{if(currentTheme()==='system')applyTheme()});
  addEventListener('hashchange',paint);

  async function boot(){
    applyTheme();renderLoading();
    const cached=useCache();if(cached){applyChrome();paint();}
    try{await loadFresh();applyChrome();paint();}
    catch(err){if(!cached){app.innerHTML='<div class="sw-page-shell"><div class="empty"><div><strong>目前無法取得主題資料</strong><br><span>請稍後重新整理。</span></div></div></div>';showToast('資料載入失敗');}}
    document.documentElement.classList.add('sw-public-ready');
  }
  addEventListener('pageshow',()=>{if(Date.now()-lastFetch>300000)loadFresh().then(()=>{applyChrome();paint()}).catch(()=>{})});

  window.SignWellTopicsCoreV2422=Object.freeze({version:'24.22.0',refresh:async()=>{await loadFresh();applyChrome();paint()},paint});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
