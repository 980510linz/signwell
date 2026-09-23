
(()=>{
'use strict';

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],app=$('#app');
const raf=requestAnimationFrame;
const reduceMotion=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const lite=()=>document.body.classList.contains('lite');


function signwellPublicBackendBase(){
  const a=window.SIGNWELL_ANALYTICS||{};
  const n=window.SIGNWELL_NEWSLETTER||{};
  return String(n.endpoint||a.endpoint||'').replace(/\/+$/,'');
}
function signwellPublicBackendEnabled(){
  const a=window.SIGNWELL_ANALYTICS||{};
  const n=window.SIGNWELL_NEWSLETTER||{};
  const enabled=a.enabled===true||n.enabled===true;
  return enabled&&/^https:\/\//i.test(signwellPublicBackendBase());
}
function signwellPublicGasBridge(action,payload={},timeoutMs=22000){
  return new Promise((resolve,reject)=>{
    if(!signwellPublicBackendEnabled()){const e=window.SignWellErrors?.bridgeError?.('SIGN WELL Backend 尚未啟用',{status:503,errorCode:'SW-PUB-503-BACKEND-DISABLED',module:'backend-bridge',action})||new Error('SIGN WELL Backend 尚未啟用');return reject(e);}

    const endpoint=signwellPublicBackendBase();
    const requestId='swp_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);
    const frameName='swpframe_'+requestId;
    const iframe=document.createElement('iframe');
    iframe.name=frameName;
    iframe.title='SIGN WELL Backend';
    iframe.tabIndex=-1;
    iframe.setAttribute('aria-hidden','true');
    Object.assign(iframe.style,{
      position:'fixed',width:'1px',height:'1px',opacity:'0',
      pointerEvents:'none',left:'-9999px',top:'-9999px'
    });

    const form=document.createElement('form');
    form.method='POST';
    form.action=endpoint;
    form.target=frameName;
    form.style.display='none';

    const add=(name,value)=>{
      const input=document.createElement('input');
      input.type='hidden';
      input.name=name;
      input.value=String(value??'');
      form.appendChild(input);
    };
    add('transport','iframe');
    add('requestId',requestId);
    add('returnOrigin',location.origin);
    add('action',action);
    add('payload',JSON.stringify(payload||{}));

    let timer=null;
    const cleanup=()=>{
      clearTimeout(timer);
      window.removeEventListener('message',onMessage);
      form.remove();
      setTimeout(()=>iframe.remove(),50);
    };
    const onMessage=e=>{
      const d=e.data;
      if(!d||d.source!=='SIGNWELL_GAS'||d.requestId!==requestId)return;
      cleanup();
      d.ok?resolve(d.data||{}):reject(window.SignWellErrors?.bridgeError?.(d.error||'SIGN WELL Backend error',{status:d.status,errorCode:d.errorCode,errorId:d.errorId,requestId:d.errorRequestId||d.requestId,module:d.errorModule||'backend-bridge',action:d.errorAction||action,reason:d.errorReason,retryable:d.retryable})||new Error(d.error||'SIGN WELL Backend error'));
    };

    window.addEventListener('message',onMessage);
    timer=setTimeout(()=>{
      cleanup();
      reject(window.SignWellErrors?.bridgeError?.('SIGN WELL Backend 連線逾時',{status:504,errorCode:'SW-PUB-504-BRIDGE-TIMEOUT',requestId,module:'backend-bridge',action,reason:'iframe bridge 未在指定時間內完成 postMessage handshake',retryable:true})||new Error('SIGN WELL Backend 連線逾時'));
    },timeoutMs);

    document.body.appendChild(iframe);
    document.body.appendChild(form);
    form.submit();
  });
}

const ANALYTICS_KEY='signwell-analytics-v1';
const ANALYTICS_CHANNEL='signwell-analytics';

const ANALYTICS_CFG=()=>window.SIGNWELL_ANALYTICS||{};
function analyticsEndpoint(){
  return signwellPublicBackendBase();
}
function remoteAnalyticsEnabled(){
  const a=ANALYTICS_CFG(),n=window.SIGNWELL_NEWSLETTER||{};
  const enabled=a.enabled===true||n.enabled===true;
  return enabled&&/^https:\/\//i.test(signwellPublicBackendBase());
}
function sendRemoteView(kind,key,eventId){
  if(!remoteAnalyticsEnabled())return;
  signwellPublicGasBridge('analytics.track',{
    kind:String(kind||''),
    key:String(key||''),
    eventId:String(eventId||''),
    path:location.pathname+location.hash,
    referrer:document.referrer?String(document.referrer).slice(0,240):''
  },16000).catch(()=>{});
}

function analyticsToday(){
  try{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const m=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return `${m.year}-${m.month}-${m.day}`;
  }catch(_){return new Date().toISOString().slice(0,10)}
}
function readPublicAnalytics(){
  try{
    const a=JSON.parse(localStorage.getItem(ANALYTICS_KEY)||'{}');
    return {
      version:1,
      total:Number(a.total||0),
      daily:a.daily&&typeof a.daily==='object'?a.daily:{},
      articles:a.articles&&typeof a.articles==='object'?a.articles:{}
    };
  }catch(_){return{version:1,total:0,daily:{},articles:{}}}
}
function writePublicAnalytics(a){
  try{
    localStorage.setItem(ANALYTICS_KEY,JSON.stringify(a));
    try{const bc=new BroadcastChannel(ANALYTICS_CHANNEL);bc.postMessage({type:'view'});bc.close()}catch(_){}
  }catch(_){}
}
function trackPublicView(kind,key){
  const clean=String(key||'').trim();
  if(!clean)return;

  const eventId=makeAnalyticsEventId(kind,clean);
  sendRemoteView(kind,clean,eventId);

  /* local fallback mirrors the actual route transition count.
     It is no longer the canonical CMS number once Google Sheet Analytics is enabled. */
  const a=readPublicAnalytics(),day=analyticsToday();
  a.total+=1;
  a.daily[day]=Number(a.daily[day]||0)+1;

  if(kind==='article'){
    const item=a.articles[clean]&&typeof a.articles[clean]==='object'
      ?a.articles[clean]
      :{total:0,daily:{}};

    item.total=Number(item.total||0)+1;
    item.daily=item.daily&&typeof item.daily==='object'?item.daily:{};
    item.daily[day]=Number(item.daily[day]||0)+1;
    item.lastAt=new Date().toISOString();
    a.articles[clean]=item;
  }

  writePublicAnalytics(a);
}

let lastTrackedViewSignature='';

function makeAnalyticsEventId(kind,key){
  try{
    return 'pv_'+crypto.randomUUID();
  }catch(_){
    return 'pv_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+'_'+String(kind)+'_'+String(key).slice(0,36);
  }
}

function trackRouteView(r){
  let kind='',key='';
  if(r.page==='article'&&ready){kind='article';key=r.slug}
  else if(r.page==='topicDetail'&&ready){kind='page';key='topic:'+r.slug}
  else if(['home','topics','about','share','newsletter'].includes(r.page)){kind='page';key=r.page}
  if(!kind||!key)return;

  const sig=kind+':'+key;
  if(sig===lastTrackedViewSignature)return;
  lastTrackedViewSignature=sig;
  trackPublicView(kind,key);
}

function defaultCoverMarkup(a,large=false){
  const title=escapeHTML(a?.title||'SIGN WELL');
  const cat=escapeHTML(a?.category||'醫學筆記');
  return `<div class="${large?'article-cover ':''}${large?'':'card-cover '}default-cover" aria-label="${title} 預設封面">
    <div class="default-cover-mark">SIGN WELL</div>
    <div class="default-cover-copy"><span>${cat}</span><span>SIGN WELL</span></div>
  </div>`;
}


const DEFAULT_SITE_TEXT={siteTitle:'SIGN WELL · 欣緯生醫',brandEnglish:'SIGN WELL',brandChinese:'欣緯生醫',homeEyebrow:'SIGN WELL BIOMED · 欣緯生醫',homeTitle1:'從臨床出發，',homeTitle2:'把值得留下的醫學寫清楚。',homeSubtitle:'以臨床推理、醫學教育與自費醫療觀察為核心的知識平台。從一個問題開始，整理成下一次真正用得上的答案。',homeCardTitle:'醫學不只是答案，而是理解答案從哪裡來。',homeCardBody:'把床邊問題、閱讀與思考整理成可回顧的知識，讓資訊回到臨床情境。',dailyEyebrow:'每日更新',dailyTitle:'每日新文章',dailyDescription:'最新整理與近期發布',topicsEyebrow:'主題探討',topicsTitle:'從一個主題，深入理解一整套問題。',topicsSubtitle:'依領域整理文章、臨床問題與延伸閱讀。',shareEyebrow:'分享我們',shareTitle:'把 SIGN WELL 分享給需要的人。',shareSubtitle:'複製網站連結，或使用 QR Code 讓另一台裝置快速開啟。',aboutEyebrow:'ABOUT SIGN WELL · 關於我們',aboutTitle:'關於我們',aboutBody:'SIGN WELL 是一個以臨床推理、醫學教育與健康知識為核心的出版空間。從問題出發，整理脈絡、證據與真正值得留下的判斷。',aboutManifestoTitle:'把複雜的醫學，整理成真正能被理解與使用的知識。',aboutManifestoBody:'我們重視推理、脈絡與長期可回顧性，而不只是快速堆疊資訊。',aboutFocusLabel:'核心',aboutFocusValue:'臨床推理',aboutFormatLabel:'形式',aboutFormatValue:'筆記 · 深度整理',aboutPrincipleLabel:'原則',aboutPrincipleValue:'清楚勝過複雜',aboutPeopleEyebrow:'PEOPLE',aboutPeopleTitle:'我們是誰',aboutPeopleSubtitle:'以不同背景與專長，共同整理值得留下的醫學與健康知識。',aboutDisclaimer:'本站不提供醫療服務、不招攬醫療業務；內容僅供醫學教育與資訊整理，不構成個別醫療建議，也不能取代正式臨床評估。',articleCountSuffix:'篇文章',minutesReadSuffix:'分鐘閱讀',shareLabel:'分享',copyLinkLabel:'複製連結',tocTitle:'本頁內容',footerTagline:'臨床筆記、醫學推理，以及值得留下的知識。',footerDisclaimer:'本站不提供醫療服務、不招攬醫療業務；內容僅供醫學教育與資訊整理，不構成個別醫療建議。',searchPlaceholder:'搜尋文章、主題、關鍵字…'};
let siteText={...DEFAULT_SITE_TEXT,...(window.SIGNWELL_SITE_TEXT||{})};
const t=(k,fb='')=>siteText[k]??fb;

let articles=[],topics=[],people=[],articleCache=new Map(),ready=false;

function escapeHTML(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

function iconSvg(name,cls='ui-icon'){
  const icons={
    share:'<circle cx="6" cy="12" r="2.3"/><circle cx="18" cy="6" r="2.3"/><circle cx="18" cy="18" r="2.3"/><path d="m8.1 10.9 7.7-3.8M8.1 13.1l7.7 3.8"/>',
    copy:'<rect x="8" y="8" width="10" height="10" rx="1.8"/><path d="M6 15H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"/>',
    link:'<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1"/>'
  };
  return `<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${icons[name]||icons.link}</svg></span>`;
}

function slugify(s=''){return String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,70)}

/* ---------- data ---------- */
function parseLegacy(text=''){const m=String(text).match(/window\.BLOG_ARTICLES\s*=\s*([\s\S]*);\s*$/);if(!m)return[];try{return JSON.parse(m[1]).filter(x=>x&&x.status==='Published')}catch(_){return[]}}

const SW_ARTICLES_CACHE='signwell-public-articles-v23-9-42';
const SW_TOPICS_CACHE='signwell-public-topics-v22-2';
const SW_BUNDLE_CACHE='signwell-public-bundle-v22-2';
const SW_REVISION_KEY='signwell-public-data-revision';
const PUBLIC_BUNDLE_PATH='public-data.json';
const PUBLIC_RAW_BUNDLE='https://raw.githubusercontent.com/980510linz/-/main/public-data.json';
const PUBLIC_RAW_INDEX='https://raw.githubusercontent.com/980510linz/-/main/articles/index.json';
const PUBLIC_RAW_BASE='https://raw.githubusercontent.com/980510linz/-/main/';
let publicBundleRevision=0;
let swLastRefresh=0;
const SW_IS_SHARE_DOCUMENT=(location.pathname.split('/').pop()||'').toLowerCase()==='share.html';

function readSessionJSON(key){
  try{const v=sessionStorage.getItem(key);return v?JSON.parse(v):null}catch(_){return null}
}
function writeSessionJSON(key,value){
  try{sessionStorage.setItem(key,JSON.stringify(value))}catch(_){}
}
function stableJSON(v){try{return JSON.stringify(v)}catch(_){return''}}
function sortArticles(){articles.sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')))}
function sortTopics(){topics.sort((a,b)=>(a.order??999)-(b.order??999)||String(a.name).localeCompare(String(b.name),'zh-Hant'))}



function normalizePeople(list){
  return (Array.isArray(list)?list:[])
    .filter(x=>x&&x.active!==false)
    .map((x,i)=>({
      id:String(x.id||('person-'+i)),
      name:String(x.name||'未命名'),
      role:String(x.role||''),
      bio:String(x.bio||''),
      photo:String(x.photo||''),
      expertise:Array.isArray(x.expertise)
        ?x.expertise.map(String).filter(Boolean)
        :String(x.expertise||'').split(',').map(s=>s.trim()).filter(Boolean),
      education:Array.isArray(x.education)
        ?x.education.map(String).filter(Boolean)
        :String(x.education||'').split(/\n+/).map(s=>s.trim()).filter(Boolean),
      experience:Array.isArray(x.experience)
        ?x.experience.map(String).filter(Boolean)
        :String(x.experience||'').split(/\n+/).map(s=>s.trim()).filter(Boolean),
      order:Number.isFinite(Number(x.order))?Number(x.order):i,
      active:x.active!==false
    }))
    .sort((a,b)=>(a.order??999)-(b.order??999)||String(a.name).localeCompare(String(b.name),'zh-Hant'));
}
function personInitials(name=''){
  const clean=String(name).trim();
  if(!clean)return 'SW';
  const words=clean.split(/\s+/).filter(Boolean);
  if(words.length>1)return (words[0][0]+words[words.length-1][0]).toUpperCase();
  return clean.slice(0,2).toUpperCase();
}
function personListHTML(items=[]){
  if(!items.length)return '<div class="about-empty">目前尚未新增公開人物。可從 CMS → 網站文字 → 關於我們新增。</div>';
  return items.map(person=>{
    const education=person.education||[];
    const experience=person.experience||[];
    const expertise=person.expertise||[];
    return `<article class="person-card glass lightcard sheen">${glassLayers}
      <div class="person-top">
        <div class="person-avatar">${person.photo?`<img src="${escapeHTML(person.photo)}" alt="${escapeHTML(person.name)}" loading="lazy" decoding="async">`:escapeHTML(personInitials(person.name))}</div>
        <div>
          <div class="person-kicker">SIGN WELL · PROFILE</div>
          <h3 class="person-name">${escapeHTML(person.name)}</h3>
          ${person.role?`<div class="person-role">${escapeHTML(person.role)}</div>`:''}
        </div>
      </div>
      ${person.bio?`<p class="person-bio">${escapeHTML(person.bio)}</p>`:''}
      ${expertise.length?`<div class="person-tags">${expertise.map(x=>`<span class="person-tag">${escapeHTML(x)}</span>`).join('')}</div>`:''}
      ${(education.length||experience.length)?`<div class="person-history">
        <div>
          <h4>EDUCATION · 學歷</h4>
          ${education.length?`<ul>${education.map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ul>`:'<div class="person-role">—</div>'}
        </div>
        <div>
          <h4>EXPERIENCE · 經歷</h4>
          ${experience.length?`<ul>${experience.map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ul>`:'<div class="person-role">—</div>'}
        </div>
      </div>`:''}
    </article>`;
  }).join('');
}


function validBundle(v){
  return v&&typeof v==='object'
    &&Array.isArray(v.topics)
    &&v.siteText&&typeof v.siteText==='object';
}
function bundleRevision(v){
  const n=Number(v?.revision||0);
  return Number.isFinite(n)?n:0;
}
function normalizeTopics(list){
  return (Array.isArray(list)?list:[])
    .filter(x=>x&&x.active!==false)
    .map((x,i)=>({
      id:String(x.id||('topic-'+i)),
      name:String(x.name||'未命名主題'),
      slug:String(x.slug||slugify(x.name||('topic-'+i))),
      description:String(x.description||''),
      order:Number.isFinite(Number(x.order))?Number(x.order):i,
      active:x.active!==false
    }))
    .sort((a,b)=>(a.order??999)-(b.order??999)||String(a.name).localeCompare(String(b.name),'zh-Hant'));
}
function applyPublicBundle(bundle,{paintNow=true}={}){
  if(!validBundle(bundle))return false;
  const rev=bundleRevision(bundle);
  publicBundleRevision=Math.max(publicBundleRevision,rev);
  siteText={...DEFAULT_SITE_TEXT,...bundle.siteText};
  topics=normalizeTopics(bundle.topics);
  people=normalizePeople(bundle.people);
  window.SIGNWELL_GLOSSARY=Array.isArray(bundle.glossary)?bundle.glossary.filter(g=>g&&g.active!==false):[];
  try{window.dispatchEvent(new CustomEvent('signwell:glossary-updated'))}catch(_){}
  writeSessionJSON(SW_BUNDLE_CACHE,bundle);
  writeSessionJSON(SW_TOPICS_CACHE,topics);
  applyChrome();
  if(ready&&paintNow){
    paint().then(()=>initReveal()).catch(()=>{});
  }
  return true;
}
function readCachedPublicBundle(){
  const b=readSessionJSON(SW_BUNDLE_CACHE);
  if(validBundle(b)){applyPublicBundle(b,{paintNow:false});return true}
  return false;
}
async function fetchBundleCandidate(url){
  try{
    const r=await fetch(url+(url.includes('?')?'&':'?')+'sw='+Date.now(),{
      cache:'no-store',
      headers:{'Accept':'application/json'}
    });
    if(!r.ok)throw 0;
    const v=await r.json();
    return validBundle(v)?v:null;
  }catch(_){return null}
}
async function fetchPublicBundleFresh(){
  /* Read both GitHub Pages and raw main. Raw main lets CMS changes appear
     before Pages deployment catches up. We choose the newest revision. */
  const [pageRes,rawRes]=await Promise.allSettled([
    fetchBundleCandidate(PUBLIC_BUNDLE_PATH),
    fetchBundleCandidate(PUBLIC_RAW_BUNDLE)
  ]);
  const candidates=[
    pageRes.status==='fulfilled'?pageRes.value:null,
    rawRes.status==='fulfilled'?rawRes.value:null
  ].filter(validBundle);
  if(!candidates.length)return null;
  candidates.sort((a,b)=>bundleRevision(b)-bundleRevision(a));
  return candidates[0];
}
async function loadPublicBundle(){
  if(!SW_IS_SHARE_DOCUMENT)readCachedPublicBundle();
  const fresh=await fetchPublicBundleFresh();
  if(!fresh)return false;
  applyPublicBundle(fresh,{paintNow:false});
  return true;
}

async function fetchArticleIndexCandidate(url){
  try{
    const r=await fetch(url+(url.includes('?')?'&':'?')+'sw='+Date.now(),{cache:'no-store',headers:{'Accept':'application/json'}});
    if(!r.ok)throw 0;
    const a=await r.json();
    if(!Array.isArray(a))throw 0;
    return a.filter(x=>x&&x.status==='Published');
  }catch(_){return null}
}
async function fetchArticlesFresh(){
  /* Raw main is authoritative for delete visibility: GitHub Pages can lag behind a commit.
     Fall back to the Pages copy only when raw main is temporarily unavailable. */
  const raw=await fetchArticleIndexCandidate(PUBLIC_RAW_INDEX);
  if(Array.isArray(raw))return {ok:true,data:raw,source:'raw'};
  const page=await fetchArticleIndexCandidate('articles/index.json');
  return Array.isArray(page)?{ok:true,data:page,source:'pages'}:{ok:false,data:[]};
}

async function loadArticles(){
  const cached=SW_IS_SHARE_DOCUMENT?null:readSessionJSON(SW_ARTICLES_CACHE);
  if(Array.isArray(cached)){
    articles=cached.filter(x=>x&&x.status==='Published');
    sortArticles();
    return;
  }
  const fresh=await fetchArticlesFresh();
  articles=fresh.ok?fresh.data:[];
  sortArticles();
  if(fresh.ok)writeSessionJSON(SW_ARTICLES_CACHE,articles);
}

async function fetchTopicsFresh(){
  try{
    /* Unique query + no-store prevents Safari/GitHub Pages from serving the previous topic file. */
    const r=await fetch('topics/index.json?sw='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw 0;
    const a=await r.json();
    if(!Array.isArray(a))throw 0;
    return {ok:true,data:a.filter(x=>x&&x.active!==false)};
  }catch(_){
    return {ok:false,data:[]};
  }
}

function topicFallbackFromArticles(){
  const seen=new Set();
  return articles.map(a=>a.category).filter(Boolean).filter(n=>!seen.has(n)&&seen.add(n))
    .map((name,i)=>({id:'auto-'+i,name,slug:slugify(name),description:'瀏覽 '+name+' 相關文章與延伸整理。',order:i,active:true}));
}

async function loadTopics(){
  const cached=readSessionJSON(SW_TOPICS_CACHE);
  if(Array.isArray(cached)){
    /* Empty [] is valid: CMS is allowed to publish zero visible topics. */
    topics=cached.filter(x=>x&&x.active!==false);
    sortTopics();
    return;
  }
  const fresh=await fetchTopicsFresh();
  topics=fresh.ok?fresh.data:topicFallbackFromArticles();
  sortTopics();
  if(fresh.ok)writeSessionJSON(SW_TOPICS_CACHE,topics);
}

/* Stale-while-revalidate that actually updates the current screen.
   v13.2 refreshed only the cache in the background, so the visible topic page
   could stay stale until another navigation. */
async function revalidatePublicData(force=false){
  const now=Date.now();
  if(!force && now-swLastRefresh<2500)return false;
  swLastRefresh=now;

  const beforeArticles=stableJSON(articles);
  const beforeTopics=stableJSON(topics);
  const beforeSite=stableJSON(siteText);
  const beforePeople=stableJSON(people);

  const [af,bundle]=await Promise.all([
    fetchArticlesFresh(),
    fetchPublicBundleFresh()
  ]);

  let changed=false;

  if(af.ok){
    const nextA=af.data.filter(x=>x&&x.status==='Published');
    nextA.sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
    if(stableJSON(nextA)!==beforeArticles){
      articles=nextA;
      articleCache.clear();
      changed=true;
    }
    writeSessionJSON(SW_ARTICLES_CACHE,nextA);
  }

  if(bundle){
    const nextTopics=normalizeTopics(bundle.topics);
    const nextSite={...DEFAULT_SITE_TEXT,...bundle.siteText};
    const nextPeople=normalizePeople(bundle.people);
    if(stableJSON(nextTopics)!==beforeTopics||stableJSON(nextSite)!==beforeSite||stableJSON(nextPeople)!==beforePeople)changed=true;
    applyPublicBundle(bundle,{paintNow:false});
  }else{
    /* Compatibility fallback for old repositories before public-data.json exists. */
    const tf=await fetchTopicsFresh();
    if(tf.ok){
      const nextT=normalizeTopics(tf.data);
      if(stableJSON(nextT)!==beforeTopics){
        topics=nextT;
        changed=true;
      }
      writeSessionJSON(SW_TOPICS_CACHE,nextT);
    }
  }

  if(changed&&ready){
    applyChrome();
    await paint();
    initReveal();
  }
  return changed;
}
function schedulePublicRevalidate(delay=180){
  setTimeout(()=>revalidatePublicData(true).catch(()=>{}),delay);
}
async function refreshArticleAvailability(slug){
  const fresh=await fetchArticlesFresh();
  if(!fresh.ok)return true;
  const next=fresh.data.slice().sort((a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
  const stillLive=next.some(a=>String(a.slug)===String(slug));
  articles=next;writeSessionJSON(SW_ARTICLES_CACHE,next);
  if(!stillLive)articleCache.delete(slug);
  return stillLive;
}
async function getFullArticle(slug){
  const stillLive=await refreshArticleAvailability(slug);
  if(!stillLive)return null;
  if(articleCache.has(slug))return articleCache.get(slug);
  const meta=articles.find(a=>a.slug===slug);
  if(!meta)return null;
  if(meta.content){articleCache.set(slug,meta);return meta}
  const file=meta.file||`articles/${encodeURIComponent(slug)}.json`;
  const candidates=[PUBLIC_RAW_BASE+file,file];
  for(const source of candidates){
    try{
      const r=await fetch(source+(source.includes('?')?'&':'?')+'v='+encodeURIComponent(meta.revision||Date.now()),{cache:'no-store'});
      if(!r.ok)continue;
      const full={...meta,...await r.json()};
      articleCache.set(slug,full);
      return full;
    }catch(_){}
  }
  return meta;
}

function sanitizeHTML(html=''){
  const d=new DOMParser().parseFromString(`<div>${html}</div>`,'text/html');
  d.querySelectorAll('script,style,iframe,object,embed,form,input,button,meta,link').forEach(n=>n.remove());
  d.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(a=>{
    if(a.name.toLowerCase().startsWith('on')||((a.name==='src'||a.name==='href')&&/^javascript:/i.test(a.value)))el.removeAttribute(a.name);
  }));
  d.body.querySelectorAll('img').forEach(im=>{im.loading='lazy';im.decoding='async'});
  const used=new Set();let i=0;
  d.body.querySelectorAll('h2,h3,h4').forEach(h=>{
    if(h.id){used.add(h.id);return}
    const base='section-'+(slugify(h.textContent||'')||String(++i));
    let id=base,n=2;while(used.has(id))id=base+'-'+(n++);used.add(id);h.id=id;
  });
  return d.body.firstElementChild?.innerHTML||'';
}
function swIsMedicalNewsArticle(a){return a?.sourceWorkspace?.type==='medical-news-workspace'||String(a?.category||'')==='時事探討'}
function swPubmedIdFromReference(r){
  const direct=String(r?.pmid||'').match(/\d+/);if(direct)return direct[0];
  const m=String(r?.url||'').match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i);return m?m[1]:'';
}
function swFilterPublicCitationsHTML(a,html=''){
  const refs=(Array.isArray(a?.references)?a.references:[]).filter(r=>r&&['news','government','literature'].includes(r.type));
  const allowedPmids=new Set(refs.filter(r=>r.type==='literature').map(swPubmedIdFromReference).filter(Boolean));
  const d=new DOMParser().parseFromString(`<div id="sw-public-content">${html}</div>`,'text/html');
  const root=d.getElementById('sw-public-content');
  root.querySelectorAll('a[href*="pubmed.ncbi.nlm.nih.gov"]').forEach(link=>{
    const m=String(link.getAttribute('href')||'').match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i),pmid=m?m[1]:'';
    if(pmid&&allowedPmids.has(pmid))return;
    const li=link.closest('li');if(li)li.remove();else link.remove();
  });
  root.querySelectorAll('li').forEach(li=>{
    const m=String(li.textContent||'').match(/\bPMID\s*[:：]?\s*(\d+)/i);
    if(m&&!allowedPmids.has(m[1]))li.remove();
  });
  root.querySelectorAll('sup').forEach(sup=>{if(!sup.textContent.trim()&&!sup.querySelector('a'))sup.remove()});
  return root.innerHTML;
}
function renderContent(a){return swFilterPublicCitationsHTML(a,sanitizeHTML(a?.content||''))}
function excerpt(a){
  if(a.excerpt)return a.excerpt;
  const d=document.createElement('div');d.innerHTML=a.content?renderContent(a):'';
  return(d.textContent||a.searchText||'').replace(/\s+/g,' ').trim().slice(0,150);
}
function readingTime(a){return Number(a.readingTime)||Math.max(1,Math.round((a.searchText||excerpt(a)).replace(/\s/g,'').length/450))}
function topicCount(tp){return articles.filter(a=>a.category===tp.name||slugify(a.category||'')===tp.slug).length}

/* ---------- chrome & routing ---------- */
function swSeoSetCanonical(url){let el=document.querySelector('link[rel=\"canonical\"]');if(!el){el=document.createElement('link');el.rel='canonical';document.head.appendChild(el)}el.href=url}
function swSeoPrimaryCanonical(){const f=(location.pathname.split('/').pop()||'index.html').toLowerCase();const m={"index.html":"https://signwell.com.tw/","topics.html":"https://signwell.com.tw/topics.html","about.html":"https://signwell.com.tw/about.html","share.html":"https://signwell.com.tw/share.html","newsletter.html":"https://signwell.com.tw/newsletter.html"};return m[f]||'https://signwell.com.tw/'}
function applyChrome(){
  swSeoSetCanonical(swSeoPrimaryCanonical());
  document.title=t('siteTitle');
  $('#brandEnglish').textContent=t('brandEnglish');
  $('#brandChinese').textContent=t('brandChinese');
  $('#footerBrand').textContent=t('siteTitle');
  $('#footerTagline').textContent='若有問題，請聯絡 signwell.com.tw@gmail.com';
  $('#footerDisclaimer').textContent=t('footerDisclaimer');
  $('#searchInput').placeholder=t('searchPlaceholder');
}
function route(){
  const h=(location.hash||'').replace(/^#/,'');
  if(h.startsWith('article/')){const slug=decodeURIComponent(h.slice(8));if(!window.__swLegacyArticleRedirectPending){window.__swLegacyArticleRedirectPending=true;location.replace(articleUrl(slug))}return{page:'article',slug}};
  if(h.startsWith('topic/'))return{page:'topicDetail',slug:decodeURIComponent(h.slice(6))};
  const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  if(file==='topics.html')return{page:'topics'};
  if(file==='about.html')return{page:'about'};
  if(file==='share.html')return{page:'share'};
  if(file==='newsletter.html')return{page:'newsletter'};
  return{page:'home'};
}
function routeIndex(r){return r.page==='topics'||r.page==='topicDetail'?1:r.page==='about'?2:r.page==='share'?3:r.page==='newsletter'?4:0}
/* canonical cross-page links + fast internal routing */
const APP_BASE=new URL('./',location.href);
const PAGE_FILE=Object.freeze({home:'index.html',topics:'topics.html',about:'about.html',share:'share.html',newsletter:'newsletter.html'});
const INTERNAL_NAV_KEY='signwell-internal-nav-v13';
function pageUrl(file,hash=''){
  const u=new URL(file,APP_BASE);
  u.search='';
  u.hash=hash;
  return u.href;
}
function markInternalNav(){
  try{sessionStorage.setItem(INTERNAL_NAV_KEY,String(Date.now()))}catch(_){}
}
function sameDocument(url){
  try{
    const u=new URL(url,location.href);
    return u.origin===location.origin && u.pathname===location.pathname;
  }catch(_){return false}
}
function softRoute(url){
  if(!sameDocument(url))return false;
  try{
    history.pushState({signwell:true},'',url);
    if(document.startViewTransition&&!reduceMotion()&&!document.body.classList.contains('page-route-fx')){
      document.startViewTransition(()=>render()).finished.catch(()=>{});
    }else{
      render();
    }
    return true;
  }catch(_){return false}
}
function isPrimaryPublicPage(page){
  return page==='home'||page==='topics'||page==='about'||page==='share'||page==='newsletter';
}
function softPrimaryRoute(url,page){
  if(!isPrimaryPublicPage(page))return false;
  try{
    const u=new URL(url,location.href);
    if(u.origin!==location.origin)return false;
    history.pushState({signwell:true,page},'',u.href);
    document.body.dataset.page=page;
    render();
    return true;
  }catch(_){return false}
}
function goto(page){
  let url='';
  if(page==='home')url=pageUrl(PAGE_FILE.home);
  else if(page==='topics')url=pageUrl(PAGE_FILE.topics);
  else if(page==='about')url=pageUrl(PAGE_FILE.about);
  else if(page==='share')url=pageUrl(PAGE_FILE.share);
  else if(page==='newsletter')url=pageUrl(PAGE_FILE.newsletter);
  else if(page.startsWith('article/'))url=articleUrl(decodeURIComponent(page.slice(8)));
  else if(page.startsWith('topic/'))url=pageUrl(PAGE_FILE.topics,page);
  else return;
  markInternalNav();
  /* Share has one canonical renderer only. Never render an embedded stale clone from another primary document. */
  if(page==='share'&&!SW_IS_SHARE_DOCUMENT){
    const freshShareUrl=new URL(url,location.href);
    freshShareUrl.searchParams.set('build','23.9.20');
    document.body.classList.add('page-switching');
    location.assign(freshShareUrl.href);
    return;
  }
  if(softPrimaryRoute(url,page))return;
  if(softRoute(url))return;
  document.body.classList.add('page-switching');
  location.assign(url);
}
function articleUrl(slug){return 'https://signwell.com.tw/article/'+encodeURIComponent(slug)+'/'}

function setNav(index,instant=false){Slider.set(index,instant)}

/* ---------- view builders ---------- */
const glassLayers='<span class="sheen-layer"></span>';




function enforceFooterContact(){
  const el=document.getElementById('footerTagline');
  if(!el)return;
  el.innerHTML='若有問題，請聯絡 <a href="mailto:signwell.com.tw@gmail.com">signwell.com.tw@gmail.com</a>';
}

function categoryHue(name=''){
  const s=String(name||'醫學筆記');
  let h=0;
  for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;
  /* Stay inside SIGN WELL's blue / cyan / blue-violet family. */
  return 186+(Math.abs(h)%58);
}
function categoryChipHTML(name='醫學筆記'){
  const label=String(name||'醫學筆記');
  return `<span class="category-chip" style="--cat-h:${categoryHue(label)}">${escapeHTML(label)}</span>`;
}

function publicPersonById(id){
  const key=String(id||'').trim();
  return key?(people||[]).find(p=>String(p.id||'')===key&&p.active!==false)||null:null;
}
function publisherForArticle(a){
  const p=publicPersonById(a?.publisherId);
  if(p)return p;
  return {
    id:'',
    name:t('articleBrand')||'SIGN WELL · 欣緯生醫',
    role:'',
    photo:''
  };
}
function publisherInitials(name=''){
  const clean=String(name||'').trim();
  if(!clean)return 'SW';
  const parts=clean.split(/\s+/).filter(Boolean);
  if(parts.length>1)return (parts[0][0]+parts[parts.length-1][0]).toUpperCase();
  return clean.slice(0,2).toUpperCase();
}
function publisherAvatarHTML(person,compact=false){
  const cls=compact?'article-publisher-avatar':'article-publisher-avatar';
  return `<span class="${cls}">${
    person?.photo
      ?`<img src="${escapeHTML(person.photo)}" alt="" loading="lazy" decoding="async">`
      :escapeHTML(publisherInitials(person?.name||'SIGN WELL'))
  }</span>`;
}

function articleCard(a){
  const publisher=publisherForArticle(a);
  return `<article class="article-card glass lightcard sheen" data-open="${escapeHTML(a.slug)}" tabindex="0" role="link">${glassLayers}${
    a.cover?`<div class="card-cover"><img src="${escapeHTML(a.cover)}" alt="" loading="lazy" decoding="async"></div>`:defaultCoverMarkup(a,false)
  }<div class="kicker">${categoryChipHTML(a.category||'醫學筆記')} <span aria-hidden="true">·</span> ${escapeHTML(a.type||'文章')}</div>
    ${swVerdictBadgeHTML(a)}
    <h3>${escapeHTML(a.title||'未命名文章')}</h3>
    <p>${escapeHTML(excerpt(a))}</p>
    <div class="card-publisher"><i class="card-publisher-dot"></i>${escapeHTML(publisher.name||'SIGN WELL')}</div>
    <div class="meta"><span>${escapeHTML(a.publishedAt||'')}</span><span>${readingTime(a)} ${escapeHTML(t('minutesReadSuffix'))}</span></div>
  </article>`;
}
function bindArticleCards(){
  $$('[data-open]').forEach(el=>{
    const open=()=>goto('article/'+encodeURIComponent(el.dataset.open));
    el.onclick=open;
    el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
  });
}
function skeletonGrid(n=6){
  return `<div class="article-grid">${Array.from({length:n}).map(()=>
    '<div class="skeleton"><div class="sk-cover"></div><div class="sk-bar sk-1"></div><div class="sk-bar sk-2"></div><div class="sk-bar sk-3"></div><div class="sk-bar sk-4"></div></div>').join('')}</div>`;
}
function skeletonTopics(n=6){
  return `<div class="topic-grid">${Array.from({length:n}).map(()=>
    '<div class="skeleton sk-topic"><div class="sk-bar sk-1"></div><div class="sk-bar sk-2"></div><div class="sk-bar sk-3"></div></div>').join('')}</div>`;
}
function skeletonArticle(){
  return `<article class="article-view"><header class="article-top"><div class="skeleton sk-line" style="width:120px;height:16px"></div><div class="skeleton sk-line" style="width:min(680px,90%);height:58px;margin-top:22px"></div><div class="skeleton sk-line" style="width:220px;height:13px;margin-top:18px"></div></header><div class="skeleton" style="height:300px;border-radius:30px;margin:22px 0"></div></article>`;
}

function renderHome(){
  const latest=articles.slice(0,9);
  app.innerHTML=`<div class="shell">
    <section class="hero">
      <div>
        <div class="eyebrow"><i></i>${escapeHTML(t('homeEyebrow'))}</div>
        <h1>${escapeHTML(t('homeTitle1'))}<br>${escapeHTML(t('homeTitle2'))}</h1>
        <p class="hero-sub">${escapeHTML(t('homeSubtitle'))}</p>
        <a class="scroll-cue" href="#daily" data-scroll="daily"><i></i><span>向下閱讀最新文章</span></a>
      </div>
      <aside class="hero-card glass lightcard sheen">${glassLayers}
        <b>${escapeHTML(t('homeCardTitle'))}</b>
        <p>${escapeHTML(t('homeCardBody'))}</p>
        <div class="tiny">SIGN WELL · 欣緯生醫</div>
      </aside>
    </section>
    <section class="section" id="daily">
      <div class="section-head">
        <div><p>${escapeHTML(t('dailyEyebrow'))}</p><h2>${escapeHTML(t('dailyTitle'))}</h2></div>
        <p>${escapeHTML(t('dailyDescription'))}</p>
      </div>
      ${ready?`<div class="article-grid">${latest.length?latest.map(articleCard).join(''):'<div class="empty">還沒有文章。發布第一篇之後，它會出現在這裡。</div>'}</div>`:skeletonGrid()}
    </section>
  </div>`;
  bindArticleCards();bindScrollCue();initReveal();
}

function renderTopics(){
  const magazineItems=topics.map(tp=>({
    slug:tp.slug,
    name:tp.name,
    description:tp.description||'瀏覽這個主題的相關文章與延伸整理。',
    count:topicCount(tp),
    hue:categoryHue(tp.name)
  }));
  const magazineMarkup=window.SWTopicMagazine?.markup
    ?window.SWTopicMagazine.markup(magazineItems,{articleCountSuffix:t('articleCountSuffix')})
    :`<section class="topic-grid">${topics.length?topics.map((tp,i)=>`<article class="topic-card glass lightcard sheen" style="--topic-stack-i:${i};--cat-h:${categoryHue(tp.name)}" data-topic-open="${escapeHTML(tp.slug)}" tabindex="0" role="link">${glassLayers}<span class="topic-signal" style="--cat-h:${categoryHue(tp.name)}" aria-hidden="true"></span><div class="topic-no">${topicCount(tp)} ${escapeHTML(t('articleCountSuffix'))}</div><h3>${escapeHTML(tp.name)}</h3><p>${escapeHTML(tp.description||'瀏覽這個主題的相關文章與延伸整理。')}</p><div class="topic-count">進入主題 →</div></article>`).join(''):'<div class="empty">還沒有建立公開主題。請從 CMS 的「主題管理」建立並同步。</div>'}</section>`;
  app.innerHTML=`<div class="shell">
    <section class="page-hero sw-topic-hero">
      <div class="eyebrow"><i></i>${escapeHTML(t('topicsEyebrow'))}</div>
      <h1>${escapeHTML(t('topicsTitle'))}</h1>
      <p>${escapeHTML(t('topicsSubtitle'))}</p>
    </section>
    ${!ready?skeletonTopics():magazineMarkup}
  </div>`;
  const magRoot=document.querySelector('[data-sw-topic-magazine]');
  if(magRoot&&window.SWTopicMagazine?.mount){
    window.SWTopicMagazine.mount(magRoot,{onOpen:(slug)=>goto('topic/'+encodeURIComponent(slug))});
  }else{
    $$('[data-topic-open]').forEach(el=>{
      const open=()=>goto('topic/'+encodeURIComponent(el.dataset.topicOpen));
      el.onclick=open;
      el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}};
    });
  }
  initReveal();
}

function renderTopicDetail(slug){
  const tp=topics.find(x=>x.slug===slug)||{name:decodeURIComponent(slug),slug,description:''};
  const list=articles.filter(a=>a.category===tp.name||slugify(a.category||'')===tp.slug);
  app.innerHTML=`<div class="shell">
    <section class="page-hero">
      <button class="backlink" data-back="topics.html">← 返回主題探討</button>
      <div class="topic-detail-badge" style="--cat-h:${categoryHue(tp.name)}"><i></i>主題探討 · ${escapeHTML(tp.name)}</div>
      <div class="topic-detail-head">
        <div><h1>${escapeHTML(tp.name)}</h1><p>${escapeHTML(tp.description||'')}</p></div>
        <p>${list.length} ${escapeHTML(t('articleCountSuffix'))}</p>
      </div>
    </section>
    <section class="article-grid">${list.length?list.map(articleCard).join(''):'<div class="empty">這個主題還沒有公開文章。</div>'}</section>
  </div>`;
  bindArticleCards();bindBack();initReveal();
}

function renderShare(){
  const url=location.origin+location.pathname.replace(/[^/]*$/,'');
  app.innerHTML=`<div class="shell share-wrap">
    <section class="share-card glass lightcard sheen">${glassLayers}
      <div class="share-grid">
        <div>
          <div class="eyebrow"><i></i>${escapeHTML(t('shareEyebrow'))}</div>
          <h1>${escapeHTML(t('shareTitle'))}</h1>
          <p>${escapeHTML(t('shareSubtitle'))}</p>
          <div class="share-url"><input id="shareUrl" value="${escapeHTML(url)}" readonly aria-label="網站連結"><button class="primarybtn" id="copySite">複製連結</button></div>
        </div>
        <div class="qr-box" id="qrcode"><div class="qr-fallback">正在產生 QR Code…</div></div>
      </div>
    </section>
  </div>`;
  $('#shareUrl').onclick=e=>e.target.select();
  $('#copySite').onclick=()=>copyText(url);
  makeQR(url);initReveal();
}


let qrLibPromise=null;
function ensureQRCodeLib(){
  if(window.QRCode)return Promise.resolve(true);
  if(qrLibPromise)return qrLibPromise;
  qrLibPromise=new Promise(resolve=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.async=true;
    s.onload=()=>resolve(Boolean(window.QRCode));
    s.onerror=()=>resolve(false);
    document.head.appendChild(s);
  });
  return qrLibPromise;
}

async function makeQR(url){
  const box=$('#qrcode');
  if(!box)return;
  box.innerHTML='<div class="qr-fallback">正在產生 QR Code…</div>';
  const ok=await ensureQRCodeLib();
  if(!ok||!window.QRCode){
    box.innerHTML='<div class="qr-fallback">QR Code 產生器沒有載入。<br>用上方「複製連結」一樣可以分享。</div>';
    return;
  }
  box.innerHTML='';
  new QRCode(box,{text:url,width:190,height:190,correctLevel:QRCode.CorrectLevel.M});
}


function renderAbout(){
  app.innerHTML=`<div class="shell about-wrap">
    <section class="about-hero">
      <div>
        <div class="eyebrow"><i></i>${escapeHTML(t('aboutEyebrow','ABOUT SIGN WELL'))}</div>
        <h1>${escapeHTML(t('aboutTitle','關於我們'))}</h1>
        <p class="about-hero-copy">${escapeHTML(t('aboutBody','SIGN WELL 是一個以醫學、健康與臨床思考為核心的知識平台。'))}</p>
      </div>
      <aside class="about-manifesto glass lightcard sheen">${glassLayers}
        <strong>${escapeHTML(t('aboutManifestoTitle','把複雜的醫學，整理成真正能被理解與使用的知識。'))}</strong>
        <p>${escapeHTML(t('aboutManifestoBody','我們重視推理、脈絡與長期可回顧性，而不只是快速堆疊資訊。'))}</p>
      </aside>
    </section>

    <section class="about-values">
      <div class="about-value glass"><span>${escapeHTML(t('aboutFocusLabel','核心'))}</span><b>${escapeHTML(t('aboutFocusValue','臨床推理'))}</b></div>
      <div class="about-value glass"><span>${escapeHTML(t('aboutFormatLabel','形式'))}</span><b>${escapeHTML(t('aboutFormatValue','筆記 · 深度整理'))}</b></div>
      <div class="about-value glass"><span>${escapeHTML(t('aboutPrincipleLabel','原則'))}</span><b>${escapeHTML(t('aboutPrincipleValue','清楚勝過複雜'))}</b></div>
    </section>

    <section class="about-team">
      <div class="about-team-head">
        <div>
          <p>${escapeHTML(t('aboutPeopleEyebrow','PEOPLE'))}</p>
          <h2>${escapeHTML(t('aboutPeopleTitle','我們是誰'))}</h2>
        </div>
        <span>${escapeHTML(t('aboutPeopleSubtitle','每一位成員的學歷、經歷與專長，都可以直接從 SIGN WELL CMS 維護。'))}</span>
      </div>
      <div class="people-grid">${personListHTML(people)}</div>
    </section>

    <div class="about-disclaimer glass">${escapeHTML(t('aboutDisclaimer','本站不提供醫療服務、不招攬醫療業務；內容僅供醫學教育與資訊整理，不構成個別醫療建議。'))}</div>
  </div>`;
  initReveal();
}



let newsletterOptimisticBusy=false;
let newsletterFormLoadedAt=Date.now();
let newsletterTurnstileToken='';
let newsletterTurnstileWidgetId=null;
let newsletterTurnstileLoader=null;

function ensureNewsletterFlowUI(){
  if(document.getElementById('newsletterFlowOverlay'))return;
  const wrap=document.createElement('div');
  wrap.className='newsletter-flow-overlay';
  wrap.id='newsletterFlowOverlay';
  wrap.setAttribute('role','status');
  wrap.setAttribute('aria-live','polite');
  wrap.innerHTML=`
    <div class="newsletter-flow-card">
      <div class="nl-flow-stage nl-flow-loading">
        <div class="nl-flow-icon" aria-hidden="true">
          <span class="nl-flow-orbit"></span>
          <span class="nl-flow-orbit second"></span>
          <span class="nl-flow-core">✦</span>
        </div>
        <h2 class="nl-flow-title">正在寄送驗證碼</h2>
        <p class="nl-flow-copy">我們正在寄送 6 位數驗證碼。完成 Email 驗證前，不會加入正式寄送名單。</p>
        <div class="nl-flow-email" data-nl-flow-email></div>
        <div class="nl-flow-progress" aria-hidden="true"><i></i></div>
      </div>

      <div class="nl-flow-stage nl-flow-success">
        <div class="nl-success-check">✓</div>
        <h2 class="nl-flow-title">請查看你的驗證碼</h2>
        <p class="nl-flow-copy">如果這個 Email 尚未完成訂閱，我們會寄出 6 位數驗證碼。回到目前頁面輸入驗證碼並驗證成功後，才會正式加入 SIGN WELL Letter。</p>
        <div class="nl-success-sub">SIGN WELL Letter · No spam. Just signal.</div>
        <button class="nl-success-close" type="button">知道了</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.querySelector('.nl-success-close')?.addEventListener('click',()=>hideNewsletterFlow());
}

function showNewsletterLoading(email){
  ensureNewsletterFlowUI();
  const wrap=document.getElementById('newsletterFlowOverlay');
  if(!wrap)return;
  wrap.classList.remove('success');
  const emailEl=wrap.querySelector('[data-nl-flow-email]');
  if(emailEl)emailEl.textContent=email||'';
  /* restart the fixed 4-second progress animation */
  const bar=wrap.querySelector('.nl-flow-progress i');
  if(bar){
    bar.style.animation='none';
    void bar.offsetWidth;
    bar.style.animation='';
  }
  wrap.classList.add('show');
}

function showNewsletterOptimisticSuccess(){
  ensureNewsletterFlowUI();
  const wrap=document.getElementById('newsletterFlowOverlay');
  if(!wrap)return;
  wrap.classList.add('success','show');
  playNewsletterConfetti();
}

function hideNewsletterFlow(){
  const wrap=document.getElementById('newsletterFlowOverlay');
  if(!wrap)return;
  wrap.classList.remove('show','success');
}

function playNewsletterConfetti(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  document.getElementById('newsletterConfettiPublic')?.remove();

  const layer=document.createElement('div');
  layer.id='newsletterConfettiPublic';
  layer.setAttribute('aria-hidden','true');
  document.body.appendChild(layer);

  const colors=['#7BC3EF','#A9DBF7','#8FD0BD','#DFF3FD','#FFFFFF','#6FA6C8','#BFDDEA'];
  const pieces=matchMedia('(pointer:coarse)').matches?38:56;
  const cx=innerWidth/2,cy=Math.min(innerHeight*.54,innerHeight-120);

  for(let i=0;i<pieces;i++){
    const el=document.createElement('i');
    el.className='nl-confetti-piece';

    const angle=(-158+(316*(i/Math.max(1,pieces-1))))*Math.PI/180;
    const distance=110+Math.random()*Math.min(290,innerWidth*.30);
    const dx=Math.cos(angle)*distance;
    const dy=Math.sin(angle)*distance-(60+Math.random()*130)+180+Math.random()*110;

    el.style.setProperty('--x',cx+'px');
    el.style.setProperty('--y',cy+'px');
    el.style.setProperty('--dx',dx.toFixed(1)+'px');
    el.style.setProperty('--dy',dy.toFixed(1)+'px');
    el.style.setProperty('--w',(5+Math.random()*7).toFixed(1)+'px');
    el.style.setProperty('--h',(3+Math.random()*8).toFixed(1)+'px');
    el.style.setProperty('--r',Math.random()<.2?'50%':'2px');
    el.style.setProperty('--c',colors[i%colors.length]);
    el.style.setProperty('--rot',(Math.random()*180).toFixed(0)+'deg');
    el.style.setProperty('--spin',((Math.random()>.5?1:-1)*(260+Math.random()*620)).toFixed(0)+'deg');
    el.style.setProperty('--dur',(920+Math.random()*760).toFixed(0)+'ms');
    el.style.setProperty('--delay',(Math.random()*100).toFixed(0)+'ms');

    layer.appendChild(el);
  }

  try{navigator.vibrate?.([16,22,10])}catch(_){}
  setTimeout(()=>layer.remove(),2050);
}

function newsletterTurnstileSiteKey(){
  return String(window.SIGNWELL_TURNSTILE_SITE_KEY||'').trim();
}

function loadNewsletterTurnstile(){
  const key=newsletterTurnstileSiteKey();
  if(!key)return Promise.resolve(false);
  if(window.turnstile)return Promise.resolve(true);
  if(newsletterTurnstileLoader)return newsletterTurnstileLoader;
  newsletterTurnstileLoader=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-signwell-turnstile]');
    if(existing){
      const wait=()=>window.turnstile?resolve(true):setTimeout(wait,80);
      wait();return;
    }
    const script=document.createElement('script');
    script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async=true;script.defer=true;script.dataset.signwellTurnstile='1';
    script.onload=()=>resolve(true);script.onerror=()=>reject(new Error('人機驗證元件載入失敗'));
    document.head.appendChild(script);
  });
  return newsletterTurnstileLoader;
}

async function mountNewsletterTurnstile(){
  const key=newsletterTurnstileSiteKey();
  const host=document.getElementById('newsletterTurnstile');
  if(!key||!host)return;
  host.hidden=false;
  try{
    await loadNewsletterTurnstile();
    if(!window.turnstile||!document.body.contains(host))return;
    host.innerHTML='';
    newsletterTurnstileToken='';
    newsletterTurnstileWidgetId=window.turnstile.render(host,{
      sitekey:key,
      theme:document.body.classList.contains('dark')?'dark':'light',
      callback:token=>{newsletterTurnstileToken=String(token||'')},
      'expired-callback':()=>{newsletterTurnstileToken=''},
      'error-callback':()=>{newsletterTurnstileToken='';return true}
    });
  }catch(err){
    console.warn('SIGN WELL Turnstile:',err?.message||err);
  }
}

function resetNewsletterTurnstile(){
  newsletterTurnstileToken='';
  try{
    if(window.turnstile&&newsletterTurnstileWidgetId!=null)window.turnstile.reset(newsletterTurnstileWidgetId);
  }catch(_){}
}

function startNewsletterBackgroundRequest(email,source='signwell-public'){
  return signwellPublicGasBridge('newsletter.subscribe',{
    email,
    consent:true,
    source,
    page:location.href,
    honeypot:String(document.getElementById('sw-company')?.value||''),
    elapsed:Math.max(0,Date.now()-newsletterFormLoadedAt),
    captchaToken:newsletterTurnstileToken
  },45000);
}

async function runNewsletterOptimistic4s(email,source='signwell-public'){
  // Security v23.1: success UI waits for the backend instead of declaring an
  // active subscription before the confirmation email request is accepted.
  showNewsletterLoading(email);
  const started=Date.now();
  const result=await startNewsletterBackgroundRequest(email,source);
  const floor=Math.max(0,950-(Date.now()-started));
  if(floor)await new Promise(r=>setTimeout(r,floor));
  showNewsletterOptimisticSuccess();
  try{
    localStorage.setItem('signwell-newsletter-last-result',JSON.stringify({
      ok:true,at:Date.now(),status:result?.status||'pending'
    }));
    localStorage.setItem('signwell-newsletter-pending','1');
    localStorage.setItem('signwell-newsletter-pending-at',String(Date.now()));
  }catch(_){}
  resetNewsletterTurnstile();
  return result;
}

let newsletterTermsAgreeCallback=null;
let newsletterTermsPriorFocus=null;

function ensureNewsletterTermsModal(){
  let modal=document.getElementById('newsletterTermsOverlay');
  if(modal)return modal;

  modal=document.createElement('div');
  modal.className='newsletter-terms-overlay';
  modal.id='newsletterTermsOverlay';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`
    <section class="newsletter-terms-card" role="dialog" aria-modal="true" aria-labelledby="newsletterTermsTitle">
      <header class="newsletter-terms-head">
        <div>
          <div class="newsletter-terms-kicker">SIGN WELL · LEGAL</div>
          <h2 class="newsletter-terms-title" id="newsletterTermsTitle">訂閱服務與隱私說明</h2>
        </div>
        <button class="newsletter-terms-close" type="button" aria-label="關閉">×</button>
      </header>

      <div class="newsletter-terms-body">
        <section class="newsletter-legal-panel" id="legalTermsPanel" role="tabpanel" aria-labelledby="legalTermsTab" data-legal-panel="terms">
          <div class="legal-meta"><span>適用：SIGN WELL／欣緯生醫網站</span><span>更新：2026-09-15</span></div>
          <p class="legal-intro">使用 SIGN WELL 網站或訂閱 SIGN WELL Letter，即表示你理解本站提供的是醫學、健康與運動相關的一般資訊整理服務；本站不提供醫療服務、不建立醫病關係，也不招攬醫療業務。</p>
          <h3>1. 服務內容與醫療聲明</h3><p>本站提供知識文章、主題整理與電子報。內容僅供教育與資訊用途，不構成個別醫療建議、診斷、治療或醫病關係，也不能取代合格醫療專業人員的正式評估。</p>
          <h3>2. 內容來源與研究資訊</h3><p>本站會盡力核對來源，但研究、法規與第三方網站可能更新。文章提及研究效果量、風險、案例、產品或技術時，屬來源整理或評論，不代表本站對任何療程、醫療機構或服務作成效果保證、推薦或招攬。</p>
          <h3>3. 電子報訂閱與取消</h3><p>SIGN WELL Letter 目前免費。送出 Email 後仍須輸入信箱收到的 6 位數驗證碼才正式生效；每封正式電子報提供取消訂閱方式。本站不出售或出租訂閱者電子郵件名單。</p>
          <h3>4. 未成年人</h3><p>未滿 18 歲者如欲訂閱或提供個人資料，應由法定代理人閱讀並同意相關條款與隱私權政策，或依適用法律取得必要同意。</p>
          <h3>5. 使用規範</h3><p>不得以自動化攻擊、惡意請求、繞過安全機制、冒用本站身分或其他足以影響服務正常運作的方式使用本站。</p>
          <h3>6. 智慧財產與第三方素材</h3><p>本站原創文字、編排與設計受法律保護；第三方研究、圖片、圖表、商標與資料的權利仍屬原權利人。本站以文字改寫、摘要與評論為主；第三方圖片或圖表原則上僅在自有、已取得授權、公眾領域或符合開放授權條件時使用。單純標示來源不等於取得重製權。</p>
          <h3>7. 責任限制</h3><p>在法律允許的最大範圍內，本站不保證內容或外部連結永遠正確、完整、即時或不中斷。使用者不應僅依本站內容作成重大醫療決策；依法不得排除或限制的責任，不受本條款影響。</p>
          <h3>8. 服務可用性與變更</h3><p>本站可能因維護、安全、第三方服務、法規或營運需要調整、暫停或終止部分功能、寄送頻率或內容形式。</p>
          <h3>9. 隱私與資料處理</h3><p>訂閱及使用網站時涉及的個人資料與瀏覽器儲存機制，依下方「隱私權政策」處理。</p>
          <h3>10. 準據法與管轄</h3><p>本條款以中華民國（臺灣）法律為準據法；如法律允許合意定管轄，原則上以服務提供者主要營業地所在地之地方法院為第一審管轄法院。法律另有強制規定者，從其規定。</p>
          <h3>11. 可分割性</h3><p>任一條款被認定無效、違法或不可執行時，不影響其他條款在法律允許範圍內繼續有效。</p>
          <h3>12. 條款修訂與聯絡</h3><p>本站可能因服務、技術或法規變更更新條款並標示日期。如有疑問或權利主張，可聯絡 <a href="mailto:signwell.com.tw@gmail.com">signwell.com.tw@gmail.com</a>。</p>
        </section>

        <div class="newsletter-legal-divider" aria-hidden="true"><span>隱私權與個人資料</span></div>
        <section class="newsletter-legal-panel newsletter-legal-panel-privacy" id="legalPrivacyPanel" data-legal-panel="privacy">
          <div class="legal-meta"><span>依台灣個資法原則設計</span><span>更新：2026-09-15</span></div>
          <p class="legal-intro">SIGN WELL／欣緯生醫尊重使用者的個人資料與隱私。本政策依本站目前實際功能撰寫，說明我們蒐集哪些資料、為何使用、保存多久、可能由哪些技術服務協助處理，以及你可以如何行使個人資料相關權利。</p>

          <h3>一、個人資料的取得</h3>
          <p>本站目前主要由你主動提供電子郵件地址以訂閱 SIGN WELL Letter；系統同時會建立訂閱狀態、訂閱／取消訂閱時間、來源與寄送紀錄。公開網站並不要求你提供身分證字號、信用卡資料、銀行帳戶或個人病歷。</p>
          <p>網站亦可能記錄不直接識別個人的彙總瀏覽統計，並在你的瀏覽器使用 localStorage 或 sessionStorage 保存主題偏好、介面狀態與暫時快取。電子報防濫用會建立一組隨機 First-party Device ID，保存於本機儲存與 first-party cookie 最長約 180 天；後端僅保存其雜湊，作為 60 秒重寄冷卻與每日 5 次發送上限的依據，不使用 Canvas、字型或硬體指紋。</p>

          <h3>二、資料蒐集之目的與類別</h3>
          <p><strong>蒐集目的：</strong>處理電子報訂閱與退訂、寄送內容與必要通知、維護網站功能、改善閱讀體驗、統計網站整體使用情形、除錯及維護服務安全。</p>
          <p><strong>主要資料類別：</strong>電子郵件地址，以及與訂閱服務直接相關的狀態、時間與寄送紀錄；另可能包含不直接識別個人的頁面瀏覽計數、介面偏好與瀏覽器端技術資料。</p>

          <h3>三、資料利用期間、地區、對象及方式</h3>
          <p><strong>期間：</strong>原則上於提供服務所必要期間內保存；你取消訂閱或提出停止利用／刪除請求後，會依實際系統需求及法律義務處理。為避免再次誤寄，系統可能保留最少量的退訂狀態紀錄。</p>
          <p><strong>地區：</strong>本站主要服務台灣使用者，但因使用雲端基礎設施，資料可能由服務供應商依其全球基礎設施於台灣以外地區進行技術處理或儲存。</p>
          <p><strong>對象與方式：</strong>資料僅在提供本站功能所需範圍內由 SIGN WELL 及受委託的技術服務提供者處理，例如 Google Apps Script、Google Sheets、Gmail、GitHub Pages 或其後續替代服務。</p>

          <h3>四、你的個人資料權利</h3>
          <p>依中華民國個人資料保護法第 3 條及其他適用規定，你得依法請求查詢或閱覽、製給複製本、補充或更正、停止蒐集／處理／利用，以及刪除你的個人資料。法律另有規定或技術上必須保留的最少資料除外。</p>
          <p>如欲行使上述權利，可來信 <a href="mailto:signwell.com.tw@gmail.com">signwell.com.tw@gmail.com</a>，並提供足以確認訂閱信箱的必要資訊。</p>

          <h3>五、個人資料利用與第三方服務</h3>
          <p>本站不會出售或出租你的電子郵件名單。為完成訂閱、寄送、資料保存、網站託管及系統運作，必要資料可能交由受委託的雲端或基礎服務提供者處理；其處理亦可能受該服務商自身隱私政策及法令要求約束。</p>

          <h3>六、資料安全</h3>
          <p>本站會在合理範圍內使用存取控制、權限限制、必要的金鑰／後端隔離及其他技術措施保護資料。惟任何網路傳輸或雲端系統均無法保證絕對零風險，因此本站不能保證資料永遠不會遭受未授權存取。</p>

          <h3>七、資料更正、停止使用與退訂</h3>
          <p>若電子郵件地址有誤、希望停止接收訊息或提出其他資料請求，可使用電子報中的取消訂閱功能，或直接聯絡本站。退訂後，系統不應再將該地址列入一般電子報寄送名單。</p>

          <h3>八、Cookie、localStorage 與 sessionStorage</h3>
          <p>本站目前主要使用瀏覽器端 localStorage／sessionStorage 保存深淺色模式、頁面狀態、暫存快取、訂閱提示狀態及部分統計防重複資料；部分第三方基礎服務可能依其技術需要使用 Cookie。關閉瀏覽器儲存功能可能使部分介面偏好或流程無法正常保存。</p>

          <h3>九、彙總網站分析</h3>
          <p>本站目前的網站分析以頁面瀏覽等彙總計數為主，後端不以此建立可持續識別個別讀者的廣告追蹤檔案，也不將電子報 Email 與頁面瀏覽紀錄合併成個人化廣告輪廓。</p>

          <h3>十、未成年人</h3><p>未滿 18 歲者如欲訂閱電子報或提供個人資料，應由法定代理人閱讀並同意本政策及相關服務條款，或依適用法律取得必要同意。</p><h3>十一、政策修訂與聯絡</h3>
          <p>本政策可能因網站功能、第三方服務或法令調整而更新。重大變更會盡可能於網站或電子報中說明。對隱私權政策或個人資料處理有疑問，可聯絡 <a href="mailto:signwell.com.tw@gmail.com">signwell.com.tw@gmail.com</a>。</p>

          <div class="legal-contact"><strong>個資／隱私聯絡</strong><br><a href="mailto:signwell.com.tw@gmail.com">signwell.com.tw@gmail.com</a></div>
        </section>

        <div class="newsletter-terms-note">按下「我同意」代表你已閱讀並同意本頁的「服務條款」與「隱私權政策」。</div>
      </div>

      <footer class="newsletter-terms-actions">
        <button class="newsletter-terms-decline" type="button">取消</button>
        <button class="newsletter-terms-agree" type="button" disabled aria-disabled="true"><span class="newsletter-terms-agree-label">我同意</span></button>
      </footer>
    </section>`;

  document.body.appendChild(modal);

  const body=modal.querySelector('.newsletter-terms-body');
  const agree=modal.querySelector('.newsletter-terms-agree');
  const updateLegalReadGate=()=>{
    if(!body||!agree)return;
    const max=Math.max(1,body.scrollHeight-body.clientHeight);
    const progress=max<=2?1:Math.max(0,Math.min(1,body.scrollTop/max));
    agree.style.setProperty('--terms-progress',progress.toFixed(3));
    const progressPct=Math.max(0,Math.min(100,progress*100)).toFixed(1)+'%';
    agree.style.setProperty('background',`linear-gradient(90deg,#e7606b 0%,#cf4150 ${progressPct},rgba(255,255,255,.94) ${progressPct},rgba(255,255,255,.94) 100%)`,'important');
    agree.style.setProperty('color','#101216','important');
    agree.style.setProperty('-webkit-text-fill-color','#101216','important');
    agree.style.setProperty('text-shadow','none','important');
    const ready=progress>=0.985;
    agree.disabled=!ready;
    agree.classList.toggle('is-ready',ready);
    agree.setAttribute('aria-disabled',ready?'false':'true');
    const agreeLabel=agree.querySelector('.newsletter-terms-agree-label');
    if(agreeLabel)agreeLabel.textContent=ready?'我同意':'請滑至底部';
  };
  body?.addEventListener('scroll',updateLegalReadGate,{passive:true});
  modal._resetLegalScrollGate=()=>{
    if(body)body.scrollTop=0;
    if(agree){agree.disabled=true;agree.classList.remove('is-ready');agree.setAttribute('aria-disabled','true');agree.style.setProperty('--terms-progress','0');agree.style.setProperty('background','rgba(255,255,255,.94)','important');agree.style.setProperty('color','#101216','important');agree.style.setProperty('-webkit-text-fill-color','#101216','important');agree.style.setProperty('text-shadow','none','important');const agreeLabel=agree.querySelector('.newsletter-terms-agree-label');if(agreeLabel)agreeLabel.textContent='請滑至底部'}
    requestAnimationFrame(updateLegalReadGate);
  };

  const close=()=>{
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('newsletter-terms-open');
    newsletterTermsAgreeCallback=null;
    setTimeout(()=>newsletterTermsPriorFocus?.focus?.(),40);
  };

  modal.querySelector('.newsletter-terms-close')?.addEventListener('click',close);
  modal.querySelector('.newsletter-terms-decline')?.addEventListener('click',close);
  modal.addEventListener('click',e=>{
    if(e.target===modal)close();
  });

  modal.querySelector('.newsletter-terms-agree')?.addEventListener('click',()=>{
    const cb=newsletterTermsAgreeCallback;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('newsletter-terms-open');
    newsletterTermsAgreeCallback=null;
    Promise.resolve(cb?.()).catch(()=>{});
  });

  addEventListener('keydown',e=>{
    if(!modal.classList.contains('show'))return;
    if(e.key==='Escape'){close();return}
    if(e.key==='Tab'){
      const focusables=[...modal.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
        .filter(el=>!el.disabled&&el.offsetParent!==null);
      if(!focusables.length)return;
      const first=focusables[0],last=focusables[focusables.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
  });

  return modal;
}

function showNewsletterTermsModal(onAgree){
  const modal=ensureNewsletterTermsModal();
  newsletterTermsPriorFocus=document.activeElement;
  newsletterTermsAgreeCallback=typeof onAgree==='function'?onAgree:null;
  modal._resetLegalScrollGate?.();
  document.body.classList.add('newsletter-terms-open');
  modal.classList.remove('show');
  void modal.offsetWidth;
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  setTimeout(()=>modal.querySelector('.newsletter-terms-close')?.focus(),70);
}

function bindNewsletterConsentTerms(){
  const checkbox=$('#newsletterConsent');
  const label=$('#newsletterConsentLabel');
  if(!checkbox||!label)return;

  label.addEventListener('click',e=>{
    e.preventDefault();

    if(checkbox.checked){
      checkbox.checked=false;
      checkbox.dispatchEvent(new Event('change',{bubbles:true}));
      return;
    }

    showNewsletterTermsModal(()=>{
      checkbox.checked=true;
      checkbox.dispatchEvent(new Event('change',{bubbles:true}));
      checkbox.focus({preventScroll:true});
    });
  });
}



/* ---------- SIGN WELL Letter ---------- */
const NEWSLETTER_CFG=()=>window.SIGNWELL_NEWSLETTER||{};
function newsletterEndpoint(){
  return signwellPublicBackendBase();
}
function newsletterEnabled(){
  const n=NEWSLETTER_CFG(),a=ANALYTICS_CFG();
  const enabled=n.enabled===true||a.enabled===true;
  return enabled&&/^https:\/\//i.test(signwellPublicBackendBase());
}
function validNewsletterEmail(email=''){
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(email).trim());
}
async function subscribeNewsletter(){
  const emailEl=$('#newsletterEmail'),consent=$('#newsletterConsent'),
        btn=$('#newsletterSubmit'),status=$('#newsletterStatus'),success=$('#newsletterSuccess');

  if(!emailEl||!btn||!status||newsletterOptimisticBusy)return;
  const email=String(emailEl.value||'').trim().toLowerCase();
  status.className='newsletter-status';
  success?.classList.remove('show');

  if(!validNewsletterEmail(email)){
    status.textContent='請輸入有效的電子郵件地址。';
    status.classList.add('error');emailEl.focus();return;
  }
  if(consent&&!consent.checked){
    showNewsletterTermsModal(()=>{
      consent.checked=true;
      consent.dispatchEvent(new Event('change',{bubbles:true}));
      requestAnimationFrame(()=>subscribeNewsletter());
    });
    return;
  }
  if(!newsletterEnabled()){
    status.textContent='訂閱服務尚未啟用。';status.classList.add('error');return;
  }
  if(!window.SignwellNewsletterOtp){
    status.textContent='Email 驗證元件尚未載入，請重新整理後再試。';status.classList.add('error');return;
  }

  newsletterOptimisticBusy=true;btn.disabled=true;
  const old=btn.textContent;btn.textContent='寄送 6 位數驗證碼…';status.textContent='';
  try{
    const subscriptionResult=await window.SignwellNewsletterOtp.start({
      email,
      source:'signwell-public',
      honeypot:String(document.getElementById('sw-company')?.value||''),
      elapsed:Math.max(0,Date.now()-newsletterFormLoadedAt),
      onVerified:()=>{
        try{localStorage.setItem('signwell-newsletter-subscribed','1')}catch(_){}
      }
    });
    emailEl.value='';if(consent)consent.checked=false;
    status.textContent=subscriptionResult?.status==='already_subscribed'?'✓ 此電子郵件已訂閱 SIGN WELL Letter。':'✓ Email 驗證完成，你已正式加入 SIGN WELL Letter。';
    status.classList.add('success');
  }catch(err){
    const msg=String(err?.message||'').trim();
    if(msg&&msg!=='已取消 Email 驗證'){
      status.textContent=msg;status.classList.add('error');
    }else{
      status.textContent='尚未完成 Email 驗證。';
    }
  }finally{
    btn.disabled=false;btn.textContent=old;newsletterOptimisticBusy=false;
  }
}

function renderNewsletter(){
  app.innerHTML=`<div class="shell newsletter-wrap">
    <section class="newsletter-card glass">
      <div class="newsletter-signal-orbit" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="newsletter-signal-lines" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="newsletter-kicker"><i></i>SIGN WELL LETTER · 免費</div>
      <h1>留一個信箱給我們。</h1>
      <p class="newsletter-lead">醫學、健康與值得留下的新觀點。不追求每天出現在你的收件匣，只在有真正值得閱讀的內容時寫信給你。</p>

      <form class="newsletter-form" id="newsletterForm" novalidate>
        <input id="newsletterEmail" type="email" inputmode="email" autocomplete="email" placeholder="your@email.com" aria-label="電子郵件">
        <input id="sw-company" name="company" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;opacity:0;pointer-events:none">
        <button class="newsletter-submit" id="newsletterSubmit" type="submit">免費訂閱 SIGN WELL</button>
      </form>
      <div id="newsletterTurnstile" class="newsletter-turnstile" hidden style="margin-top:12px;min-height:0"></div>

      <label class="newsletter-consent" id="newsletterConsentLabel">
        <input id="newsletterConsent" type="checkbox" aria-describedby="newsletterConsentText">
        <span id="newsletterConsentText">我同意接收 SIGN WELL 電子報與新文章通知，並已閱讀服務條款與隱私權政策。每封信都會提供取消訂閱方式。</span>
      </label>
      <div class="newsletter-note" style="margin-top:8px">想先查看內容？點選上方同意列即可開啟 <button class="newsletter-legal-open" type="button" id="newsletterLegalOpen">服務條款與隱私權政策</button>。</div>

      <div class="newsletter-status" id="newsletterStatus" role="status" aria-live="polite"></div>
      <div class="newsletter-success" id="newsletterSuccess">
        <div class="check">✓</div>
        <div>
          <strong>等待 Email 確認</strong>
          <div data-success-copy>輸入正確的 6 位數驗證碼後才會正式加入 SIGN WELL Letter。</div>
        </div>
      </div>

      <div class="newsletter-note">免費訂閱 · No spam. Just signal. · 你的 Email 只用於 SIGN WELL 電子報，不會公開顯示。</div>
    </section>
  </div>`;
  newsletterFormLoadedAt=Date.now();
  newsletterTurnstileToken='';newsletterTurnstileWidgetId=null;
  $('#newsletterForm')?.addEventListener('submit',e=>{e.preventDefault();subscribeNewsletter()});
  bindNewsletterConsentTerms();
  $('#newsletterLegalOpen')?.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    showNewsletterTermsModal();
  });
  // Turnstile is intentionally lazy: first send is frictionless; resend #2+ mounts it on demand.

  try{
    const q=new URLSearchParams(location.search);
    if(q.get('newsletter')==='confirmed'){
      localStorage.setItem('signwell-newsletter-subscribed','1');
      localStorage.removeItem('signwell-newsletter-pending');
      localStorage.removeItem('signwell-newsletter-pending-at');
      const status=$('#newsletterStatus');
      if(status){status.textContent='✓ Email 已確認，你已正式加入 SIGN WELL Letter。';status.classList.add('success')}
      q.delete('newsletter');
      const clean=location.pathname+(q.toString()?'?'+q.toString():'')+location.hash;
      history.replaceState(history.state,'',clean);
    }
  }catch(_){}
  initReveal();
}



function swDisplayDate(value){
  const s=String(value||'').trim();if(!s)return '';
  const d=new Date(s+'T00:00:00');
  return Number.isNaN(d.getTime())?s:d.toLocaleDateString('zh-TW',{year:'numeric',month:'short',day:'numeric'});
}
function swArticleAgeDays(a){
  const s=String(a?.updatedAt||a?.publishedAt||'').trim();if(!s)return 0;
  const d=new Date(s+'T00:00:00');return Number.isNaN(d.getTime())?0:Math.floor((Date.now()-d.getTime())/86400000);
}
function swEvidenceLevelLabel(ref){
  return String(ref?.evidenceLevel || (ref?.type==='literature'?'Research':'Source')).trim()||'Source';
}

function swVerdictMeta(readiness=''){
  const map={
    established:{label:'Established',zh:'成熟',tone:'green'},
    reasonable:{label:'Reasonable option',zh:'合理選項',tone:'blue'},
    emerging:{label:'Emerging',zh:'證據累積中',tone:'yellow'},
    experimental:{label:'Experimental',zh:'實驗性',tone:'orange'},
    unsupported:{label:'Unsupported',zh:'不支持',tone:'red'}
  };
  return map[String(readiness||'').toLowerCase()]||null;
}
function swHypeLabel(value=''){
  return ({low:'Low',moderate:'Moderate',high:'High','very-high':'Very high'})[String(value||'').toLowerCase()]||String(value||'');
}
function swEvidenceLevelText(value=''){
  return ({high:'High',moderate:'Moderate',low:'Low','very-low':'Very low'})[String(value||'').toLowerCase()]||String(value||'');
}
function swEvidenceSnapshotHTML(a){
  const cards=(Array.isArray(a?.evidenceCards)?a.evidenceCards:[]).filter(c=>c&&String(c.claim||'').trim()).slice(0,3);
  const verdict=a?.signWellVerdict&&typeof a.signWellVerdict==='object'?a.signWellVerdict:{};
  const meta=swVerdictMeta(verdict.readiness);
  if(a?.evidenceEnabled!==true&&cards.length===0&&!meta)return '';
  const metric=(label,val)=>String(val||'').trim()?`<div class="sw-verdict-metric"><span>${escapeHTML(label)}</span><b>${escapeHTML(String(val))}</b></div>`:'';
  const verdictHTML=(meta||Object.values(verdict).some(Boolean))?`<article class="sw-verdict-card ${meta?'is-'+meta.tone:''}">
      <div class="sw-verdict-card-head"><span>SIGN WELL VERDICT</span>${meta?`<b>${escapeHTML(meta.label)}</b>`:''}</div>
      ${meta?`<div class="sw-verdict-readiness"><i aria-hidden="true"></i><strong>${escapeHTML(meta.zh)}</strong><span>Clinical readiness</span></div>`:''}
      <div class="sw-verdict-metrics">
        ${metric('Evidence',verdict.evidence)}${metric('Safety',verdict.safety)}${metric('Cost-effectiveness',verdict.costEffectiveness)}${metric('Regulatory',verdict.regulatory)}${metric('Marketing hype',swHypeLabel(verdict.marketingHype))}
      </div>
    </article>`:'';
  const cardsHTML=cards.length?`<div class="sw-evidence-cards">${cards.map((c,i)=>`<article class="sw-evidence-card">
      <div class="sw-evidence-card-top"><span>CLAIM ${String(i+1).padStart(2,'0')}</span>${c.level?`<b>${escapeHTML(swEvidenceLevelText(c.level))} evidence</b>`:''}</div>
      <h3>${escapeHTML(c.claim)}</h3>
      <dl>
        ${c.evidenceType?`<div><dt>主要證據</dt><dd>${escapeHTML(c.evidenceType)}</dd></div>`:''}
        ${c.population?`<div><dt>Population</dt><dd>${escapeHTML(c.population)}</dd></div>`:''}
        ${c.effect?`<div><dt>Effect</dt><dd>${escapeHTML(c.effect)}</dd></div>`:''}
        ${c.boundary?`<div class="sw-evidence-boundary"><dt>不可外推／限制</dt><dd>${escapeHTML(c.boundary)}</dd></div>`:''}
      </dl>
      ${c.lastChecked?`<div class="sw-evidence-checked">Last checked · ${escapeHTML(swDisplayDate(c.lastChecked)||c.lastChecked)}</div>`:''}
    </article>`).join('')}</div>`:'';
  return `<section class="sw-evidence-snapshot" aria-label="SIGN WELL 證據判讀"><div class="sw-evidence-snapshot-head"><div><span>EVIDENCE SNAPSHOT</span><h2>主張、證據與欣緯判讀</h2></div><small>Evidence ≠ recommendation</small></div><div class="sw-evidence-snapshot-grid">${cardsHTML}${verdictHTML}</div></section>`;
}
function swVerdictBadgeHTML(a){
  const meta=swVerdictMeta(a?.verdictReadiness||a?.signWellVerdict?.readiness);
  if(!meta)return '';
  return `<span class="sw-card-verdict is-${meta.tone}"><i aria-hidden="true"></i>${escapeHTML(meta.label)}</span>`;
}

function swArticleTrustHTML(a){
  const pub=publisherForArticle(a),refs=Array.isArray(a?.references)?a.references:[];
  const medicalNews=swIsMedicalNewsArticle(a);
  const lit=medicalNews?[]:refs.filter(r=>r&&r.type==='literature');
  const audit=a?.audit&&typeof a.audit==='object'?a.audit:null;
  const shown=lit.slice(0,6);
  const auditHtml=audit?.claimEvidenceLocked?`<div class="sw-audit-strip"><span>${medicalNews?'主張－證據審查 ✓':'證據審查 ✓'}</span>${Number.isFinite(Number(audit.topicFitScore))?`<span>主題吻合度 ${Math.round(Number(audit.topicFitScore))}/100</span>`:''}${audit.numericalFidelityChecked?'<span>數字核對 ✓</span>':''}</div>`:'';
  const refsHtml=shown.length?`<div class="sw-evidence-list">${shown.map(r=>`<a class="sw-evidence-ref" href="${escapeHTML(r.url||'#')}" target="_blank" rel="noopener noreferrer"><span class="sw-evidence-level">${escapeHTML(r.evidenceLevel||'研究')}</span><span><strong>${escapeHTML(r.title||'研究文獻')}</strong><small>${escapeHTML([r.journal,r.year].filter(Boolean).join(' · '))}</small></span></a>`).join('')}</div>`:'';
  const trustCopy=medicalNews?'讓你知道這篇內容由誰整理、何時更新，以及公開引用的新聞來源。':'讓你知道這篇內容由誰整理、何時更新，以及引用了哪些研究。';
  return `<section class="sw-trust-panel" aria-label="文章可信度資訊"><div class="sw-trust-head"><div><strong>文章資訊與證據</strong><span>${trustCopy}</span></div>${lit.length?`<span>${lit.length} 篇研究文獻</span>`:''}</div>${auditHtml}<div class="sw-trust-grid"><div class="sw-trust-item"><b>作者 / 發布者</b><span>${escapeHTML(pub.name||'SIGN WELL')}</span></div><div class="sw-trust-item"><b>最後更新</b><span>${escapeHTML(swDisplayDate(a.updatedAt||a.publishedAt)||'未標示')}</span></div><div class="sw-trust-item"><b>閱讀時間</b><span>約 ${readingTime(a)} 分鐘</span></div></div>${refsHtml}<div class="sw-article-disclaimer">本站不提供醫療服務、不招攬醫療業務。內容僅供醫學教育與資訊整理，不構成個別醫療建議，也不能取代正式臨床評估、診斷或治療。研究證據可能隨時間更新；如涉及個人健康決策，請與合格醫療專業人員討論。</div></section>`;
}
function swRelatedArticles(a){
  const same=articles.filter(x=>x.slug!==a.slug&&(x.category===a.category||((x.tags||[]).some(t=>(a.tags||[]).includes(t))))).slice(0,3);
  if(!same.length)return '';
  return `<section class="sw-related"><div class="sw-related-head"><h2>延伸閱讀</h2><span>同主題內容</span></div><div class="sw-related-grid">${same.map(x=>`<article class="sw-related-card" data-related="${escapeHTML(x.slug)}" tabindex="0"><small>${escapeHTML(x.category||'醫學筆記')} · ${readingTime(x)} 分鐘</small><b>${escapeHTML(x.title||'未命名文章')}</b><p>${escapeHTML(excerpt(x).slice(0,92))}</p></article>`).join('')}</div></section>`;
}
function swArticleSectionUrl(slug,sectionId=''){
  const u=new URL(articleUrl(slug));
  if(sectionId)u.searchParams.set('s',sectionId);else u.searchParams.delete('s');
  return u.href;
}
function swCurrentSection(){
  const hs=[...document.querySelectorAll('.article-body h2[id],.article-body h3[id]')];
  let best='';for(const h of hs){if(h.getBoundingClientRect().top<=150)best=h.id;else break}return best;
}
function swArticleFontDock(){return document.getElementById('swArticleFontDock')}
function swApplyReaderFont(view,size){
  const allowed=['small','medium','large'];
  const next=allowed.includes(size)?size:'small';
  if(view)view.dataset.fontSize=next;
  try{localStorage.setItem('signwell-reader-font-v2',next)}catch(_){}
  const dock=swArticleFontDock()||view?.querySelector('.sw-font-dock');
  dock?.querySelectorAll('[data-font-size]').forEach(b=>{
    const active=b.dataset.fontSize===next;
    b.classList.toggle('active',active);
    b.setAttribute('aria-pressed',active?'true':'false');
  });
  if(dock){
    dock.dataset.size=next;
    dock.classList.remove('is-changing');
    void dock.offsetWidth;
    dock.classList.add('is-changing');
    clearTimeout(dock._swFontTimer);
    dock._swFontTimer=setTimeout(()=>dock.classList.remove('is-changing'),300);
  }
}
function swMountArticleFontDock(view){
  const dock=view?.querySelector('#swArticleFontDock');
  if(!dock)return null;
  document.querySelectorAll('body > #swArticleFontDock').forEach(old=>{if(old!==dock)old.remove()});
  document.body.appendChild(dock);
  const desktopMotion=window.matchMedia?.('(min-width:761px) and (pointer:fine)').matches&&!reduceMotion();
  if(desktopMotion){
    dock.classList.remove('sw-font-exit');
    dock.classList.add('sw-font-enter');
    clearTimeout(dock._swEnterTimer);
    dock._swEnterTimer=setTimeout(()=>dock.classList.remove('sw-font-enter'),520);
  }
  const press=()=>dock.classList.add('is-pressing');
  const release=()=>dock.classList.remove('is-pressing');
  dock.addEventListener('pointerdown',press,{passive:true});
  dock.addEventListener('pointerup',release,{passive:true});
  dock.addEventListener('pointercancel',release,{passive:true});
  dock.addEventListener('pointerleave',release,{passive:true});
  dock.querySelectorAll('[data-font-size]').forEach(b=>b.onclick=()=>swApplyReaderFont(view,b.dataset.fontSize));
  return dock;
}

function swDismissArticleFontDock(){
  const dock=swArticleFontDock();
  if(!dock)return;
  const desktopMotion=window.matchMedia?.('(min-width:761px) and (pointer:fine)').matches&&!reduceMotion();
  if(!desktopMotion){dock.remove();return}
  dock.classList.remove('sw-font-enter','is-changing','is-pressing');
  dock.classList.add('sw-font-exit');
  clearTimeout(dock._swExitTimer);
  dock._swExitTimer=setTimeout(()=>dock.remove(),270);
}
async function swOpenContinueQR(a){
  document.querySelector('.sw-continue-overlay')?.remove();
  const section=swCurrentSection(),url=swArticleSectionUrl(a.slug,section);
  const overlay=document.createElement('div');overlay.className='sw-continue-overlay';overlay.innerHTML=`<div class="sw-continue-card" role="dialog" aria-modal="true"><h3>使用其他裝置閱讀</h3><p>${section?'QR Code 會帶你回到目前章節。':'掃描後直接開啟這篇文章。'} 不需要登入帳號。</p><div class="sw-continue-qr" id="swContinueQr">正在產生 QR Code…</div><div class="sw-continue-actions"><button data-sw-copy>複製閱讀連結</button><button class="primary" data-sw-close>完成</button></div></div>`;document.body.appendChild(overlay);
  overlay.onclick=e=>{if(e.target===overlay||e.target.closest('[data-sw-close]'))overlay.remove()};
  overlay.querySelector('[data-sw-copy]').onclick=()=>copyText(url);
  const ok=await ensureQRCodeLib();const box=overlay.querySelector('#swContinueQr');
  if(ok&&window.QRCode){box.innerHTML='';new QRCode(box,{text:url,width:190,height:190,correctLevel:QRCode.CorrectLevel.M})}else box.textContent=url;
}
function swBindSectionLinks(a){
  document.querySelectorAll('.article-body h2[id],.article-body h3[id]').forEach(h=>{
    if(h.querySelector('.sw-section-link'))return;
    const b=document.createElement('button');b.className='sw-section-link';b.type='button';b.setAttribute('aria-label','複製本段連結');b.textContent='↗';
    b.onclick=e=>{e.preventDefault();e.stopPropagation();copyText(swArticleSectionUrl(a.slug,h.id))};h.appendChild(b);
  });
}
function swScrollToRequestedSection(){
  const id=new URLSearchParams(location.search).get('s');if(!id)return;
  requestAnimationFrame(()=>setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:reduceMotion()?'auto':'smooth',block:'start'}),80));
}
function swUpdateArticleMeta(a){
  swSeoSetCanonical(articleUrl(a.slug));
  const set=(sel,val)=>{let el=document.querySelector(sel);if(el&&val)el.setAttribute('content',val)};
  set('meta[property="og:title"]',a.title||'SIGN WELL · 欣緯生醫');set('meta[property="og:description"]',excerpt(a));set('meta[name="twitter:title"]',a.title||'');set('meta[name="twitter:description"]',excerpt(a));if(a.cover){set('meta[property="og:image"]',a.cover);set('meta[name="twitter:image"]',a.cover)}
}

async function renderArticle(slug){
  swArticleFontDock()?.remove();
  const a=await getFullArticle(slug);
  if(!a){if(window.SignWellErrors?.renderInto){window.SignWellErrors.renderInto(app,new Error('文章可能已由 CMS 刪除、尚未公開，或網址已失效。'),{surface:'PUB',status:404,errorCode:'SW-PUB-404-ARTICLE-NOT-FOUND',token:'ARTICLE-NOT-FOUND',title:'這篇文章已不存在',message:'目前網址沒有對應的公開文章。',module:'article-renderer',action:'renderArticle',homeUrl:'https://signwell.com.tw/',retryable:false});}else{document.title='404 · SIGN WELL';app.innerHTML='<div class="shell"><section class="empty"><strong>404 · 這篇文章已不存在</strong></section></div>';}return}
  const html=renderContent(a),wrap=document.createElement('div');wrap.innerHTML=html;
  const heads=[...wrap.querySelectorAll('h2')].map(h=>({id:h.id,text:h.textContent}));
  const age=swArticleAgeDays(a),updated=swDisplayDate(a.updatedAt||a.publishedAt),published=swDisplayDate(a.publishedAt);
  app.innerHTML=`<article class="article-view" data-font-size="small">
    <header class="article-top">
      <button class="backlink" data-back="index.html">← 返回首頁</button>
      <div class="kicker" style="margin-top:24px">${categoryChipHTML(a.category||'醫學筆記')} <span aria-hidden="true">·</span> ${escapeHTML(a.type||'文章')}</div>
      <h1>${escapeHTML(a.title||'未命名文章')}</h1>
      <div class="article-meta">
        ${(()=>{const publisher=publisherForArticle(a);return `<span class="article-publisher">${publisherAvatarHTML(publisher,true)}<span class="article-publisher-copy"><b>${escapeHTML(publisher.name||'SIGN WELL')}</b>${publisher.role?`<small>${escapeHTML(publisher.role)}</small>`:''}</span></span>`})()}
        ${published?`<span>發布 ${escapeHTML(published)}</span>`:''}
        ${updated?`<span class="sw-updated">更新 ${escapeHTML(updated)}</span>`:''}
        <span>約 ${readingTime(a)} ${escapeHTML(t('minutesReadSuffix'))}</span>
      </div>
      <div class="article-actions"><button class="pillbtn" id="shareArticle">${escapeHTML(t('shareLabel'))}</button><button class="pillbtn" id="copyArticle">${iconSvg('copy')}${escapeHTML(t('copyLinkLabel'))}</button></div>
      <div class="sw-reader-tools"><button id="continueArticle">使用其他裝置閱讀</button><button id="emailSelfArticle">寄給自己</button></div>
      <div class="sw-font-dock" id="swArticleFontDock" data-size="small" role="group" aria-label="文章字級">
        <span class="sw-font-dock-thumb" aria-hidden="true"></span>
        <button type="button" data-font-size="small" aria-label="小字" aria-pressed="true">小</button>
        <button type="button" data-font-size="medium" aria-label="中字" aria-pressed="false">中</button>
        <button type="button" data-font-size="large" aria-label="大字" aria-pressed="false">大</button>
      </div>
    </header>
    ${age>365?`<div class="sw-stale-note">這篇文章最後更新於 ${escapeHTML(updated||a.updatedAt||a.publishedAt||'較早時間')}，已超過一年。醫學資訊可能已有新的研究或指引，請搭配最新專業資料判讀。</div>`:''}
    ${a.cover?`<div class="article-cover"><img loading="eager" fetchpriority="high" decoding="async" src="${escapeHTML(a.cover)}" alt=""></div>`:defaultCoverMarkup(a,true)}
    ${swEvidenceSnapshotHTML(a)}
    <div class="article-layout">
      <div class="sw-article-main"><div class="article-body">${html}</div>${swArticleTrustHTML(a)}</div>
      ${heads.length?`<aside class="toc"><div class="toc-title">${escapeHTML(t('tocTitle'))}</div>${heads.map(h=>`<button data-toc="${escapeHTML(h.id)}">${escapeHTML(h.text)}</button>`).join('')}</aside>`:''}
    </div>
    ${swRelatedArticles(a)}
  </article>`;
  $$('[data-toc]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.toc)?.scrollIntoView({behavior:reduceMotion()?'auto':'smooth',block:'start'}));
  $$('[data-related]').forEach(el=>{const open=()=>goto('article/'+encodeURIComponent(el.dataset.related));el.onclick=open;el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
  const shareUrl=articleUrl(a.slug);
  $('#copyArticle').onclick=()=>copyText(shareUrl);
  $('#shareArticle').onclick=async()=>{
    const shareText=`我在欣緯生醫看到了一篇超棒的文章：${a.title||'SIGN WELL 文章'}`;
    try{
      if(navigator.share)await navigator.share({title:shareText,text:shareText,url:shareUrl});
      else{await copyText(`${shareText}\n${shareUrl}`);showToast('分享文字與連結已複製')}
    }catch(e){
      if(e?.name!=='AbortError'){await copyText(`${shareText}\n${shareUrl}`);showToast('系統分享不可用，分享文字與連結已複製')}
    }
  };
  $('#continueArticle').onclick=()=>swOpenContinueQR(a);
  $('#emailSelfArticle').onclick=()=>{const u=encodeURIComponent(swArticleSectionUrl(a.slug,swCurrentSection()));const subject=encodeURIComponent('稍後閱讀｜'+(a.title||'SIGN WELL'));location.href=`mailto:?subject=${subject}&body=${u}`};
  const view=document.querySelector('.article-view');const fontDock=swMountArticleFontDock(view);let fs='small';try{fs=localStorage.getItem('signwell-reader-font-v2')||'small'}catch(_){}swApplyReaderFont(view,fs);fontDock?.querySelectorAll('[data-font-size]').forEach(b=>b.onclick=()=>swApplyReaderFont(view,b.dataset.fontSize));
  swBindSectionLinks(a);swScrollToRequestedSection();swUpdateArticleMeta(a);window.SignWellAnatomy?.mountArticle?.(a,document);
  document.title=`${a.title} · SIGN WELL`;
  hardenRenderedArticleMedia();bindBack();initReveal();setupToc();
}

function bindBack(){
  $$('[data-back]').forEach(b=>b.onclick=()=>{
    const file=String(b.dataset.back||'').split('#')[0].toLowerCase();
    if(file.endsWith('topics.html'))goto('topics');
    else if(file.endsWith('about.html'))goto('about');
    else if(file.endsWith('share.html'))goto('share');
    else if(file.endsWith('newsletter.html'))goto('newsletter');
    else goto('home');
  });
}
function bindScrollCue(){
  const cue=$('[data-scroll]');
  if(cue)cue.onclick=e=>{e.preventDefault();document.getElementById(cue.dataset.scroll)?.scrollIntoView({behavior:reduceMotion()?'auto':'smooth'})};
}

/* ---------- render orchestration ---------- */
async function paint(){
  const r=route();
  document.documentElement.classList.toggle('article-reading',r.page==='article');
  document.body.classList.toggle('article-reading',r.page==='article');
  if(r.page!=='article')swDismissArticleFontDock();
  setNav(routeIndex(r));
  if(r.page==='home')renderHome();
  else if(r.page==='topics')renderTopics();
  else if(r.page==='about')renderAbout();
  else if(r.page==='share')renderShare();
  else if(r.page==='newsletter')renderNewsletter();
  else if(!ready)app.innerHTML=r.page==='topicDetail'?`<div class="shell">${skeletonGrid(3)}</div>`:skeletonArticle();
  else if(r.page==='topicDetail')renderTopicDetail(r.slug);
  else await renderArticle(r.slug);

  trackRouteView(r);
}

async function render(){
  enforceFooterContact();
  await paint();
  window.scrollTo({top:0,behavior:'auto'});
  if(reduceMotion())return;
  app.classList.remove('page-in-fast');
  void app.offsetWidth;
  app.classList.add('page-in-fast');
  setTimeout(()=>app.classList.remove('page-in-fast'),210);
}

/* ---------- liquid nav ---------- */

const PAGE_ROUTE_FX_KEY='signwell-page-route-fx-v2';
let pagerRouteEntrancePending=false;

function setPagerRouteGesture(progress=0,direction=0){
  if(reduceMotion())return;
  const p=Math.max(0,Math.min(1,Number(progress)||0));
  const dir=Math.sign(Number(direction)||0);
  const fade=1-(p*.14);
  const chrome=1-(p*.10);
  const scale=1-(p*.006);
  const veil=p*.16;
  const maxShift=Math.min(innerWidth*.235,190);
  const x=(-dir*p*maxShift);
  document.body.style.setProperty('--route-opacity',fade.toFixed(3));
  document.body.style.setProperty('--route-chrome-opacity',chrome.toFixed(3));
  document.body.style.setProperty('--route-scale',scale.toFixed(4));
  document.body.style.setProperty('--route-veil',veil.toFixed(3));
  document.body.style.setProperty('--route-x',x.toFixed(2)+'px');
  if(dir)document.body.style.setProperty('--route-enter-x',(dir*Math.min(innerWidth*.16,138)).toFixed(2)+'px');
}

function beginPagerGestureFX(seed=.035){
  if(reduceMotion())return;
  document.body.classList.remove('page-enter-fx','page-enter-pending');
  document.body.classList.add('page-route-gesture');
  setPagerRouteGesture(seed);
}

function cancelPagerGestureFX(){
  if(reduceMotion())return;
  document.body.style.setProperty('--route-opacity','1');
  document.body.style.setProperty('--route-chrome-opacity','1');
  document.body.style.setProperty('--route-scale','1');
  document.body.style.setProperty('--route-veil','0');
  document.body.style.setProperty('--route-x','0px');

  setTimeout(()=>{
    if(!document.body.classList.contains('page-route-fx')){
      document.body.classList.remove('page-route-gesture');
    }
  },130);
}

function beginPagerRouteFX({persist=true,direction=0}={}){
  if(reduceMotion())return;
  document.body.classList.add('page-route-gesture');
  document.body.classList.add('page-route-fx');
  const dir=Math.sign(Number(direction)||0);
  const shift=Math.min(innerWidth*.20,170);
  document.body.style.setProperty('--route-opacity','.16');
  document.body.style.setProperty('--route-chrome-opacity','.32');
  document.body.style.setProperty('--route-scale','.992');
  document.body.style.setProperty('--route-veil','.24');
  document.body.style.setProperty('--route-x',(-dir*shift).toFixed(2)+'px');
  document.body.style.setProperty('--route-enter-x',(dir*Math.min(innerWidth*.16,138)).toFixed(2)+'px');

  if(persist){
    try{
      sessionStorage.setItem(PAGE_ROUTE_FX_KEY,String(Date.now()));
    }catch(_){}
  }
}

function preparePagerRouteEntrance(){
  if(reduceMotion())return false;

  let at=0;
  try{
    at=Number(sessionStorage.getItem(PAGE_ROUTE_FX_KEY)||0);
  }catch(_){}

  if(!at||Date.now()-at>3500)return false;

  pagerRouteEntrancePending=true;
  document.body.classList.add('page-enter-pending');
  return true;
}

function playPagerRouteEntrance(){
  if(reduceMotion())return;

  let valid=pagerRouteEntrancePending;
  if(!valid){
    let at=0;
    try{at=Number(sessionStorage.getItem(PAGE_ROUTE_FX_KEY)||0)}catch(_){}
    valid=Boolean(at&&Date.now()-at<3500);
  }

  try{sessionStorage.removeItem(PAGE_ROUTE_FX_KEY)}catch(_){}
  if(!valid)return;

  pagerRouteEntrancePending=false;
  document.body.classList.remove('page-enter-pending','page-route-gesture','page-route-fx');
  document.body.style.removeProperty('--route-opacity');
  document.body.style.removeProperty('--route-chrome-opacity');
  document.body.style.removeProperty('--route-scale');
  document.body.style.removeProperty('--route-veil');
  document.body.style.removeProperty('--route-x');

  void document.body.offsetWidth;
  document.body.classList.add('page-enter-fx');
  setTimeout(()=>document.body.classList.remove('page-enter-fx'),330);
}

function playPagerSoftRouteEntrance(){
  if(reduceMotion()){
    document.body.classList.remove('page-route-gesture','page-route-fx');
    return;
  }

  document.body.classList.remove('page-route-gesture','page-route-fx');
  document.body.style.removeProperty('--route-opacity');
  document.body.style.removeProperty('--route-chrome-opacity');
  document.body.style.removeProperty('--route-scale');
  document.body.style.removeProperty('--route-veil');
  document.body.style.removeProperty('--route-x');

  void document.body.offsetWidth;
  document.body.classList.add('page-enter-fx');
  setTimeout(()=>document.body.classList.remove('page-enter-fx'),330);
}

function pagerPageURL(page){
  if(page==='home')return pageUrl(PAGE_FILE.home);
  if(page==='topics')return pageUrl(PAGE_FILE.topics);
  if(page==='about')return pageUrl(PAGE_FILE.about);
  if(page==='share')return pageUrl(PAGE_FILE.share);
  if(page==='newsletter')return pageUrl(PAGE_FILE.newsletter);
  if(page.startsWith('article/'))return articleUrl(decodeURIComponent(page.slice(8)));
  if(page.startsWith('topic/'))return pageUrl(PAGE_FILE.topics,page);
  return '';
}

function pagerWillStayInDocument(page){
  const url=pagerPageURL(page);
  if(!url)return false;
  if(isPrimaryPublicPage(page))return true;
  return sameDocument(url);
}

function prefetchPagerPage(page){
  const url=pagerPageURL(page);
  if(!url||sameDocument(url))return;
  try{
    const abs=new URL(url,location.href).href;
    if([...document.querySelectorAll('link[rel="prefetch"]')].some(x=>x.href===abs))return;
    const l=document.createElement('link');
    l.rel='prefetch';
    l.href=abs;
    l.as='document';
    document.head.appendChild(l);
  }catch(_){}
}


/* ---------- page slider: compositor-first liquid glass ---------- */
const Slider=(()=>{
  const rail=$('#pager'),thumb=$('#navThumb'),items=$$('.nav-item');
  const N=items.length,LAST=N-1;
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;

  let vert=false,step=1,base={x:0,y:0},size={w:1,h:1};
  let railRect={left:0,top:0};
  let pos=0,vel=0,goal=0,anim=0;
  let dragging=false,grab=0,travel=0,lastP=0,lastT=0,startIndex=0,index=0;
  let pendingPoint=null,moveRAF=0,navTimer=0,changeTimer=0;
  const coarse=matchMedia('(hover:none) and (pointer:coarse)').matches;

  function pulseSegment(){
    if(reduceMotion())return;
    clearTimeout(changeTimer);
    rail.classList.remove('is-changing');
    void rail.offsetWidth;
    rail.classList.add('is-changing');
    changeTimer=setTimeout(()=>rail.classList.remove('is-changing'),260);
  }

  function cacheGeometry(){
    const rr=rail.getBoundingClientRect();
    const rects=items.map(el=>el.getBoundingClientRect());
    const a=rects[0],b=rects[1]||rects[0];
    vert=Math.abs(b.top-a.top)>Math.abs(b.left-a.left);
    step=vert?(b.top-a.top):(b.left-a.left);
    if(!step)step=vert?a.height:a.width;
    base={x:a.left-rr.left,y:a.top-rr.top};
    size={w:a.width,h:a.height};
    railRect={left:rr.left,top:rr.top};

    const thumbInsetX=vert?6:6;
    const thumbInsetY=vert?6:5;
    const thumbW=Math.max(56,size.w-thumbInsetX*2);
    const thumbH=Math.max(44,size.h-thumbInsetY*2);
    thumb.style.width=thumbW+'px';
    thumb.style.height=thumbH+'px';
    thumb.style.left=(base.x+(size.w-thumbW)/2)+'px';
    thumb.style.top=(base.y+(size.h-thumbH)/2)+'px';
    thumb.style.borderRadius=(Math.min(thumbW,thumbH)*.5)+'px';

    pos=goal=index*step;
    draw(0,true);
  }

  function refreshRailRect(){
    const rr=rail.getBoundingClientRect();
    railRect.left=rr.left;
    railRect.top=rr.top;
  }

  function draw(stretch=0,forceDecor=false){
    /* v17.2: translation only.
       Removing velocity-based scale/stretch eliminates the visible wobble
       that made the liquid slider feel like it was "jumping". */
    /* v23.9.93: segmented-control motion. Position is independent from size.
       No velocity-driven stretch: the thumb keeps a stable geometry and
       gets its Small/Medium/Large-style pulse from the `scale` property. */
    thumb.style.transform=vert
      ? `translate3d(0,${pos.toFixed(3)}px,0)`
      : `translate3d(${pos.toFixed(3)}px,0,0)`;

    if(!coarse || forceDecor || !dragging){
      thumb.style.setProperty('--spec','0px');
      if(!coarse && !dragging && !anim){
        rail.style.setProperty('--rim',(140+(pos/(step*LAST||1))*180)+'deg');
      }
    }

    const near=clamp(Math.round(pos/step),0,LAST);
    if(near!==index){
      index=near;
      highlight(near);
      pulseSegment();
    }
  }

  function highlight(i){
    for(let n=0;n<N;n++){
      const b=items[n],on=n===i;
      if(b.classList.contains('active')!==on)b.classList.toggle('active',on);
      if(on)b.setAttribute('aria-current','page');
      else if(b.hasAttribute('aria-current'))b.removeAttribute('aria-current');
    }
    rail.setAttribute('aria-valuenow',String(i));
    rail.setAttribute('aria-valuetext',items[i].querySelector('span')?.textContent||'');
  }

  let tweenFrom=0,tweenStart=0,tweenDuration=160,tweenPrev=0,tweenPrevTs=0;

  function easePager(t){
    /* Smooth, quick, non-overshooting ease. */
    return 1-Math.pow(1-t,3);
  }

  function tween(ts){
    if(!tweenStart){
      tweenStart=ts;
      tweenPrev=pos;
      tweenPrevTs=ts;
    }

    const t=clamp((ts-tweenStart)/Math.max(1,tweenDuration),0,1);
    const next=tweenFrom+(goal-tweenFrom)*easePager(t);
    const dt=Math.max(1,ts-tweenPrevTs);

    vel=(next-tweenPrev)/dt*1000;
    pos=next;
    tweenPrev=next;
    tweenPrevTs=ts;
    draw(0);

    if(t>=1){
      pos=goal;
      vel=0;
      draw(0,true);
      anim=0;
      tweenStart=0;
      tweenPrevTs=0;
      return;
    }
    anim=raf(tween);
  }

  function settle(to,duration=160){
    stop();
    goal=clamp(to,0,LIMIT());
    tweenFrom=pos;
    tweenDuration=clamp(duration,110,220);
    tweenStart=0;
    anim=raf(tween);
  }

  function stop(){
    if(anim){cancelAnimationFrame(anim);anim=0}
    tweenStart=0;
    tweenPrevTs=0;
  }

  function clearPendingNavigation(){
    if(navTimer){
      clearTimeout(navTimer);
      navTimer=0;
    }
    rail.classList.remove('nav-traveling');
    document.body.classList.remove('pager-programmatic');
  }

  function animateToRoute(target,page,{tapped=false,from=index}={}){
    target=clamp(target,0,LAST);
    clearPendingNavigation();
    highlight(target);
    pulseSegment();

    /* Match the Small / Medium / Large selector: crisp snap first,
       then hand the route to the page transition. */
    settle(target*step,tapped?168:182);

    if(reduceMotion()){
      goto(page);
      return;
    }

    const soft=pagerWillStayInDocument(page);
    prefetchPagerPage(page);
    const direction=Math.sign(target-from);
    beginPagerRouteFX({persist:!soft,direction});

    const distance=Math.abs(target-from);

    /* Fast enough to feel continuous, long enough for the thumb to visibly
       arrive at its real slot before the document hand-off. */
    const wait=tapped
      ? Math.min(214,176+distance*9)
      : Math.min(222,186+distance*8);

    rail.classList.add('nav-traveling');
    document.body.classList.add('pager-programmatic');

    navTimer=setTimeout(()=>{
      navTimer=0;
      rail.classList.remove('nav-traveling');
      document.body.classList.remove('pager-programmatic');
      goto(page);

      /* A hash/route that stays in this HTML document must explicitly
         recover from the exit state; this fixes the old "page stays faded"
         edge case on article → Home / topic → Topics. */
      if(soft){
        requestAnimationFrame(()=>requestAnimationFrame(playPagerSoftRouteEntrance));
      }
    },wait);
  }

  function trackClient(clientX,clientY){
    return vert
      ? clientY-railRect.top-base.y-size.h/2
      : clientX-railRect.left-base.x-size.w/2;
  }
  const LIMIT=()=>step*LAST;
  function band(p){
    /* v17.2: hard clamp. Rubber-band overshoot looked like the whole slider
       was still drifting after the user's finger stopped. */
    return clamp(p,0,LIMIT());
  }

  function processPoint(pt){
    moveRAF=0;
    if(!dragging||!pt)return;
    const p=trackClient(pt.x,pt.y),now=pt.t;
    const dt=Math.max(8,now-lastT);
    travel+=Math.abs(p-lastP);
    /* low-pass velocity removes micro-jitter on 120 Hz touch streams */
    const instant=(p-lastP)/dt*1000;
    vel=vel*.55+instant*.45;
    lastP=p;lastT=now;
    const desired=band(p-grab);

    /* Position low-pass: suppress 120 Hz micro-jitter while keeping the lens
       visually under the finger. Coarse pointers get a slightly softer blend. */
    const follow=coarse?.52:.64;
    pos+=(desired-pos)*follow;
    if(Math.abs(desired-pos)<.18)pos=desired;

    draw(0);

    /* Segmented-control behavior: while the finger moves, only the selector
       moves. The page changes after release, just like the Small/Medium/Large dock. */
    const candidate=clamp(Math.round(desired/step),0,LAST);
    prefetchPagerPage(items[candidate].dataset.page);
  }

  function queuePoint(e){
    const evs=e.getCoalescedEvents?.();
    const ev=evs&&evs.length?evs[evs.length-1]:e;
    pendingPoint={x:ev.clientX,y:ev.clientY,t:ev.timeStamp||performance.now()};
    if(!moveRAF)moveRAF=raf(()=>processPoint(pendingPoint));
  }

  rail.addEventListener('pointerdown',e=>{
    clearPendingNavigation();
    stop();
    refreshRailRect();
    dragging=true;travel=0;startIndex=index;vel=0;
    document.body.classList.add('pager-dragging');
    rail.classList.add('grabbing','is-pressing');
    try{rail.setPointerCapture(e.pointerId)}catch(_){}
    const p=trackClient(e.clientX,e.clientY);
    const half=(vert?size.h:size.w)/2;
    grab=Math.abs(p-pos)<=half?p-pos:0;
    lastP=p;lastT=e.timeStamp||performance.now();

    const likely=clamp(Math.round(p/step),0,LAST);
    prefetchPagerPage(items[likely].dataset.page);
  },{passive:true});

  rail.addEventListener('pointermove',e=>{
    if(!dragging)return;
    queuePoint(e);
  },{passive:true});

  const release=e=>{
    if(!dragging)return;
    if(moveRAF){
      cancelAnimationFrame(moveRAF);moveRAF=0;
      if(pendingPoint)processPoint(pendingPoint);
    }
    dragging=false;
    document.body.classList.remove('pager-dragging');
    rail.classList.remove('grabbing','is-pressing');

    const tapped=travel<7;
    const p=trackClient(e.clientX,e.clientY);
    const projected=tapped?p:pos+vel*.028;
    const target=clamp(Math.round(projected/step),0,LAST);

    if(target!==startIndex||routeIndex(route())!==target){
      animateToRoute(target,items[target].dataset.page,{tapped,from:startIndex});
    }else{
      highlight(target);
      pulseSegment();
      settle(target*step,138);
      cancelPagerGestureFX();
    }
  };

  rail.addEventListener('pointerup',release,{passive:true});
  rail.addEventListener('pointercancel',()=>{
    if(!dragging)return;
    dragging=false;
    document.body.classList.remove('pager-dragging');
    rail.classList.remove('grabbing','is-pressing');
    if(moveRAF){cancelAnimationFrame(moveRAF);moveRAF=0}
    settle(startIndex*step,125);
    cancelPagerGestureFX();
  },{passive:true});

  rail.addEventListener('keydown',e=>{
    const map={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1};
    let next=null;
    if(e.key in map)next=clamp(index+map[e.key],0,LAST);
    else if(e.key==='Home')next=0;
    else if(e.key==='End')next=LAST;
    else if(e.key==='Enter'||e.key===' ')next=index;
    if(next===null)return;
    e.preventDefault();
    const from=index;
    if(routeIndex(route())!==next)animateToRoute(next,items[next].dataset.page,{tapped:true,from});
    else{highlight(next);settle(next*step)};
  });

  let wheelLock=false;
  rail.addEventListener('wheel',e=>{
    e.preventDefault();
    if(wheelLock)return;
    wheelLock=true;setTimeout(()=>wheelLock=false,300);
    const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
    const from=index;
    const next=clamp(index+(d>0?1:-1),0,LAST);
    if(next!==index)animateToRoute(next,items[next].dataset.page,{tapped:true,from});
  },{passive:false});

  let resizeRAF=0;
  const relayout=()=>{
    if(resizeRAF)cancelAnimationFrame(resizeRAF);
    resizeRAF=raf(()=>{resizeRAF=0;stop();cacheGeometry()});
  };
  addEventListener('resize',relayout,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(relayout,100),{passive:true});

  return{
    init(){cacheGeometry();setTimeout(cacheGeometry,80)},
    set(i,instant){
      i=clamp(i,0,LAST);
      highlight(i);
      if(instant||reduceMotion()){
        stop();index=i;pos=goal=i*step;vel=0;draw(0,true);
      }else{
        index=i;pulseSegment();settle(i*step,168);
      }
    }
  };
})();

/* ---------- pointer-reactive effects (rAF batched) ---------- */
function initPointerFX(){
  if(!matchMedia('(pointer:fine)').matches||lite()||reduceMotion())return;
  document.body.classList.add('has-pointer');

  const glow=$('#cursorGlow');
  let gx=innerWidth/2,gy=innerHeight/2,tx=gx,ty=gy,idle=0,looping=false;
  const useTrigGlass=Boolean(window.SignWellLiquidGlassMotion);
  let card=null,cx=0,cy=0,pending=false;

  const loop=()=>{
    gx+=(tx-gx)*.14;gy+=(ty-gy)*.14;
    glow.style.transform=`translate3d(${gx}px,${gy}px,0)`;
    if(Math.abs(tx-gx)<.4&&Math.abs(ty-gy)<.4&&++idle>12){looping=false;return}
    raf(loop);
  };

  const applyCard=()=>{
    pending=false;
    if(!card)return;
    const r=card.getBoundingClientRect();
    const x=(cx-r.left)/r.width,y=(cy-r.top)/r.height;
    card.style.setProperty('--px',(x*100).toFixed(1)+'%');
    card.style.setProperty('--py',(y*100).toFixed(1)+'%');
    card.style.setProperty('--ry',((x-.5)*7).toFixed(2)+'deg');
    card.style.setProperty('--rx',((.5-y)*5).toFixed(2)+'deg');
  };

  document.addEventListener('pointermove',e=>{
    tx=e.clientX;ty=e.clientY;idle=0;
    if(!looping){looping=true;raf(loop)}
    if(!useTrigGlass){
      const el=e.target.closest?.('.hero-card,.article-card,.topic-card,.share-card');
      if(el!==card&&card)resetCard(card);
      card=el;cx=e.clientX;cy=e.clientY;
      if(card&&!pending){pending=true;raf(applyCard)}
    }
  },{passive:true});

  document.addEventListener('pointerleave',()=>{if(card)resetCard(card);card=null},{passive:true});
  function resetCard(el){el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg')}
}

/* ---------- reveal on scroll · repeatable ---------- */
let revealObserver=null;
function initReveal(){
  if(reduceMotion()){
    app.querySelectorAll('.reveal').forEach(e=>e.classList.add('in'));
    return;
  }

  revealObserver?.disconnect();

  revealObserver=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      /* Enter: play. Leave: reset so a later re-entry can play again.
         We do NOT unobserve, so scrolling back up keeps the effect alive. */
      entry.target.classList.toggle('in',entry.isIntersecting);
    });
  },{
    threshold:[0,.09,.22],
    rootMargin:'-2% 0px -6% 0px'
  });

  app.querySelectorAll('.section-head,.article-card,.topic-card,.hero-card,.share-card,.article-cover,.skeleton,.empty,.person-card')
    .forEach((el,i)=>{
      el.classList.add('reveal');
      if(!el.dataset.revealDelay){
        el.dataset.revealDelay=String(Math.min(i%6,5)*45);
      }
      el.style.transitionDelay=el.dataset.revealDelay+'ms';
      revealObserver.observe(el);
    });
}

function setupToc(){
  const bs=$$('[data-toc]'),hs=bs.map(b=>document.getElementById(b.dataset.toc)).filter(Boolean);
  if(!hs.length)return;
  const o=new IntersectionObserver(es=>es.forEach(e=>{
    if(e.isIntersecting)bs.forEach(b=>b.classList.toggle('active',b.dataset.toc===e.target.id));
  }),{rootMargin:'-20% 0px -70% 0px'});
  hs.forEach(h=>o.observe(h));
}

/* ---------- toast & clipboard ---------- */
function showToast(msg){
  const el=$('#toast');el.textContent=msg;el.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t=setTimeout(()=>el.classList.remove('show'),1900);
}
async function copyText(v){
  try{await navigator.clipboard.writeText(v);showToast('連結已複製')}
  catch(_){
    try{
      const ta=document.createElement('textarea');ta.value=v;ta.style.cssText='position:fixed;opacity:0';
      document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
      showToast('連結已複製');
    }catch(__){showToast('無法自動複製，請長按網址手動複製')}
  }
}

/* ---------- search ---------- */
let searchIndex=-1;
function openSearch(){document.body.classList.add('search-open');
  const ov=$('#searchOverlay');
  ov.classList.add('show');
  document.body.style.overflow='hidden';
  $('#searchInput').value='';
  if(window.SignWellEasterEgg)SignWellEasterEgg.reset();
  renderSearch('');
  setTimeout(()=>$('#searchInput').focus(),90);
}
function closeSearch(){document.body.classList.remove('search-open');
  $('#searchOverlay').classList.remove('show');
  document.body.style.overflow='';
  searchIndex=-1;
}
function searchArticleRow(a,i){
  return `<div class="search-result" data-search="${escapeHTML(a.slug)}" style="animation-delay:${Math.min(i,8)*24}ms"><div class="search-result-cover ${a.cover?'':'noimg'}">${a.cover?`<img src="${escapeHTML(a.cover)}" alt="" loading="lazy">`:'SIGN WELL'}</div><div class="search-result-copy"><strong>${escapeHTML(a.title)}</strong><span>${escapeHTML(a.category||'醫學筆記')} · ${readingTime(a)} 分鐘閱讀${a.excerpt?' · '+escapeHTML(a.excerpt):''}</span></div><div class="search-result-arrow">›</div></div>`;
}
function searchTopicRow(tp,i){
  return `<div class="search-result search-topic-result" data-search-topic="${escapeHTML(tp.slug)}" style="animation-delay:${Math.min(i,8)*24}ms"><div class="search-topic-icon">主</div><div class="search-result-copy"><strong>${escapeHTML(tp.name)}</strong><span>${escapeHTML(tp.description||'瀏覽這個主題的相關文章與延伸整理。')} · ${topicCount(tp)} 篇</span></div><div class="search-result-arrow">›</div></div>`;
}
function renderSearch(q){
  const s=q.trim().toLowerCase();
  let foundArticles,foundTopics;
  if(!s){
    foundArticles=articles.slice(0,6);foundTopics=topics.slice(0,3);
    $('#searchHint').textContent='最近發布與主題';
  }else{
    foundArticles=articles.filter(a=>[a.title,a.category,(a.tags||[]).join(' '),a.searchText,excerpt(a)].join(' ').toLowerCase().includes(s)).slice(0,10);
    foundTopics=topics.filter(tp=>[tp.name,tp.description,tp.slug].join(' ').toLowerCase().includes(s)).slice(0,5);
    $('#searchHint').textContent=`搜尋「${q.trim()}」`;
  }
  const total=foundArticles.length+foundTopics.length;
  $('#searchCount').textContent=total?`${total} 個結果`:'';
  let html='';
  if(foundArticles.length)html+=`<div class="search-section-label">文章</div>${foundArticles.map(searchArticleRow).join('')}`;
  if(foundTopics.length)html+=`<div class="search-section-label">主題</div>${foundTopics.map(searchTopicRow).join('')}`;
  if(!total)html='<div class="search-empty">沒有符合的內容。<br>換個短一點的關鍵字，或直接瀏覽主題。</div>';
  $('#searchResults').innerHTML=html;
  searchIndex=-1;
  $$('[data-search]').forEach(el=>el.onclick=()=>{closeSearch();goto('article/'+encodeURIComponent(el.dataset.search))});
  $$('[data-search-topic]').forEach(el=>el.onclick=()=>{closeSearch();goto('topic/'+encodeURIComponent(el.dataset.searchTopic))});
}
function moveSearch(dir){
  const rows=$$('#searchResults .search-result');
  if(!rows.length)return;
  rows.forEach(r=>r.classList.remove('active'));
  searchIndex=(searchIndex+dir+rows.length)%rows.length;
  const row=rows[searchIndex];
  row.classList.add('active');
  row.scrollIntoView({block:'nearest'});
}

/* ---------- theme ---------- */
function applyTheme(){
  const p=localStorage.getItem('signwell-theme')||'system';
  const dark=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);
  document.body.classList.toggle('dark',dark);
  document.body.classList.toggle('taiwan-theme',dark);
  document.documentElement.dataset.swTheme=dark?'taiwan':'light';
  $('#themeColorMeta')?.setAttribute('content',dark?'#14251f':'#eef7ff');
  const themeBtn=$('#themeBtn');
  if(themeBtn){
    themeBtn.setAttribute('aria-label',dark?'切換至淺色模式':'切換至台灣主題色');
    themeBtn.setAttribute('aria-pressed',dark?'true':'false');
    themeBtn.title=dark?'目前：台灣主題｜切換至淺色模式':'目前：淺色模式｜切換至台灣主題';
  }
}
function swEnsureThemeLightWash(){
  let wash=document.getElementById('swThemeLightWash');
  if(wash)return wash;
  wash=document.createElement('div');
  wash.id='swThemeLightWash';
  wash.setAttribute('aria-hidden','true');
  document.body.appendChild(wash);
  return wash;
}
function toggleTheme(ev){
  const btn=$('#themeBtn');
  const rect=btn?.getBoundingClientRect?.();
  const x=Number.isFinite(ev?.clientX)&&ev.clientX>0?ev.clientX:(rect?rect.left+rect.width/2:innerWidth*.92);
  const y=Number.isFinite(ev?.clientY)&&ev.clientY>0?ev.clientY:(rect?rect.top+rect.height/2:innerHeight*.08);
  document.documentElement.style.setProperty('--sw-theme-x',x+'px');
  document.documentElement.style.setProperty('--sw-theme-y',y+'px');

  const wasDark=document.body.classList.contains('dark');
  const nextDark=!wasDark;
  localStorage.setItem('signwell-theme',nextDark?'dark':'light');

  const html=document.documentElement;
  html.classList.remove('sw-theme-to-light','sw-theme-to-dark','sw-theme-fallback-to-light','sw-theme-fallback-to-taiwan');
  html.classList.add('sw-theme-changing',nextDark?'sw-theme-to-dark':'sw-theme-to-light');
  const cleanup=()=>html.classList.remove('sw-theme-changing','sw-theme-to-light','sw-theme-to-dark','sw-theme-fallback-to-light','sw-theme-fallback-to-taiwan');
  const run=()=>applyTheme();

  if(document.startViewTransition&&!reduceMotion()){
    const vt=document.startViewTransition(run);
    vt.finished.finally(cleanup);
  }else{
    if(!reduceMotion()){
      swEnsureThemeLightWash();
      requestAnimationFrame(()=>html.classList.add(nextDark?'sw-theme-fallback-to-taiwan':'sw-theme-fallback-to-light'));
    }
    run();
    setTimeout(cleanup,720);
  }
}


/* ---------- startup warm cache · v15.1 ---------- */
function warmStartupCache(){
  /*
   * v16.8:
   * Do not download the five sibling HTML documents during the critical
   * startup path. They are already prefetched later during idle time.
   * This window is only used to keep expensive visual loops paused while
   * the first paint/data requests settle.
   */
  document.body.classList.add('boot-preparing');

  const settle=new Promise(resolve=>setTimeout(resolve,220));
  settle.finally(()=>{
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      document.body.classList.remove('boot-preparing');
      document.body.classList.add('visuals-ready');
    }));
  });

  return settle;
}

function preloadVisibleCovers(){
  const run=()=>{
    articles.filter(a=>a&&a.cover).slice(0,3).forEach(a=>{
      try{
        const im=new Image();
        im.decoding='async';
        im.fetchPriority='low';
        im.src=String(a.cover||'');
      }catch(_){}
    });
  };
  if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:900});
  else setTimeout(run,280);
}



/* v16.8 · pause non-essential animation work in background tabs */
function initGlobalVisualPause(){
  const apply=()=>document.body.classList.toggle('visual-paused',document.hidden);
  document.addEventListener('visibilitychange',apply,{passive:true});
  apply();
}

/* ---------- adaptive desktop visual quality ---------- */
function initAdaptiveVisualQuality(){
  if(!matchMedia('(hover:hover) and (pointer:fine) and (min-width:900px)').matches)return;

  const onVisibility=()=>{
    document.body.classList.toggle('visual-paused',document.hidden);
  };
  document.addEventListener('visibilitychange',onVisibility,{passive:true});
  onVisibility();

  if(reduceMotion())return;

  let frames=0,total=0,last=performance.now();
  const start=last;
  const sample=now=>{
    if(document.hidden)return requestAnimationFrame(sample);
    const dt=now-last;
    last=now;
    if(dt<120){
      total+=dt;
      frames++;
    }
    if(now-start<2300&&frames<100){
      requestAnimationFrame(sample);
      return;
    }
    const avg=frames?total/frames:16.7;
    /* Keep the four desktop orbs. If a machine is struggling, only simplify
       expensive secondary filters/mix-blend work. */
    if(avg>24)document.body.classList.add('effects-balanced');
  };
  requestAnimationFrame(sample);
}


/* ---------- idle newsletter invitation · v15.4 ---------- */
const IDLE_SUB_PROMPT_SESSION='signwell-idle-sub-prompt-session-v1';
const IDLE_SUB_PROMPT_DONE='signwell-newsletter-interested-v1';

function idleSubscribeAlreadyHandled(){
  try{
    return sessionStorage.getItem(IDLE_SUB_PROMPT_SESSION)==='1' ||
           localStorage.getItem(IDLE_SUB_PROMPT_DONE)==='1';
  }catch(_){return false}
}
function markIdleSubscribeHandled(done=false){
  try{sessionStorage.setItem(IDLE_SUB_PROMPT_SESSION,'1')}catch(_){}
  if(done){try{localStorage.setItem(IDLE_SUB_PROMPT_DONE,'1')}catch(_){}}
}
function hideIdleSubscribePrompt(done=false){
  const el=document.getElementById('idleSubscribePrompt');
  if(el)el.classList.remove('show');
  markIdleSubscribeHandled(done);
}
function ensureIdleSubscribePrompt(){
  if(document.getElementById('idleSubscribePrompt'))return document.getElementById('idleSubscribePrompt');

  const el=document.createElement('aside');
  el.id='idleSubscribePrompt';
  el.className='idle-subscribe';
  el.setAttribute('aria-live','polite');
  el.innerHTML=`
    <div class="idle-subscribe-card">
      <div class="idle-subscribe-head">
        <div>
          <div class="idle-subscribe-kicker">SIGN WELL LETTER</div>
          <div class="idle-subscribe-title">把下一篇值得讀的文章寄給你。</div>
        </div>
        <button class="idle-subscribe-close" type="button" aria-label="關閉訂閱邀請">×</button>
      </div>
      <p class="idle-subscribe-copy">如果你正在慢慢讀，歡迎留下 Email。新文章與精選內容才會寄出，不做廣告轟炸。</p>
      <form class="idle-subscribe-form">
        <input type="email" autocomplete="email" inputmode="email" placeholder="your@email.com" aria-label="Email" required>
        <button type="submit">免費訂閱 SIGN WELL</button>
      </form>
      <div class="idle-subscribe-note">完全免費；送出後請到信箱查看 6 位數驗證碼，5 分鐘內輸入正確後才會正式加入。你可以隨時取消訂閱。</div>
    </div>`;
  document.body.appendChild(el);

  el.querySelector('.idle-subscribe-close')?.addEventListener('click',()=>hideIdleSubscribePrompt(false));

  el.querySelector('form')?.addEventListener('submit',e=>{
    e.preventDefault();
    const input=el.querySelector('input');
    const button=el.querySelector('button[type="submit"]');
    const note=el.querySelector('.idle-subscribe-note');
    const email=String(input?.value||'').trim().toLowerCase();

    if(!validNewsletterEmail(email)){
      note.textContent='請先輸入有效的 Email。';
      input?.focus();
      return;
    }
    if(!newsletterEnabled()){
      note.textContent='電子報服務目前尚未連線，請稍後再試。';
      return;
    }

    showNewsletterTermsModal(async()=>{
      button.disabled=true;
      button.textContent='訂閱中…';
      note.textContent='正在建立訂閱…';

      try{
        hideIdleSubscribePrompt(false);
        const subscriptionResult=await window.SignwellNewsletterOtp.start({email,source:'signwell-idle-prompt',honeypot:'',elapsed:Math.max(0,Date.now()-newsletterFormLoadedAt)});
        note.textContent=subscriptionResult?.status==='already_subscribed'?'✓ 此電子郵件已訂閱 SIGN WELL Letter。':'✓ Email 驗證完成，已正式加入 SIGN WELL Letter。';
        button.textContent=subscriptionResult?.status==='already_subscribed'?'已訂閱':'已完成訂閱';
        markIdleSubscribeHandled(true);
      }catch(err){
        button.disabled=false;button.textContent='免費訂閱 SIGN WELL';
        note.textContent=String(err?.message||'尚未完成 Email 驗證。');
        requestAnimationFrame(()=>el.classList.add('show'));
      }
    });
  });

  return el;
}

function initIdleSubscriptionPrompt(){
  if(document.body?.dataset?.page==='newsletter')return;
  if(idleSubscribeAlreadyHandled())return;

  const IDLE_MS=60000;
  let timer=0,lastMoveReset=0;

  const schedule=()=>{
    clearTimeout(timer);
    if(document.hidden||idleSubscribeAlreadyHandled())return;
    timer=setTimeout(()=>{
      if(document.hidden||idleSubscribeAlreadyHandled())return;
      const el=ensureIdleSubscribePrompt();
      requestAnimationFrame(()=>el.classList.add('show'));
      markIdleSubscribeHandled(false);
    },IDLE_MS);
  };

  const activity=e=>{
    const now=performance.now();
    if(e?.type==='pointermove'&&now-lastMoveReset<900)return;
    lastMoveReset=now;
    schedule();
  };

  ['pointerdown','pointermove','touchstart','wheel','scroll','keydown'].forEach(type=>{
    window.addEventListener(type,activity,{passive:true});
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden)clearTimeout(timer);
    else schedule();
  },{passive:true});

  schedule();
}

/* ---------- performance mode ---------- */
function optimize(){
  const touch=matchMedia('(hover:none) and (pointer:coarse)').matches;
  const weak=Number(navigator.deviceMemory||8)<4
    ||(innerWidth<480&&navigator.hardwareConcurrency&&navigator.hardwareConcurrency<=4);
  if(weak||reduceMotion()||touch)document.body.classList.add('lite');
}

/* ---------- splash ---------- */
function initWelcome(){
  const el=$('#welcomeSplash');
  if(!el)return;
  const deep=route().page==='article';
  let seen=false,internal=false;
  try{
    seen=sessionStorage.getItem('signwell-welcome-original-v1')==='1';
    const stamp=Number(sessionStorage.getItem(INTERNAL_NAV_KEY)||0);
    internal=stamp>0 && Date.now()-stamp<8000;
    sessionStorage.removeItem(INTERNAL_NAV_KEY);
    if(!seen)sessionStorage.setItem('signwell-welcome-original-v1','1');
  }catch(_){seen=false;internal=false}
  /* Internal page/article navigation must be instant.
     A direct shared article still keeps the original welcome animation. */
  if(internal||(seen&&!deep)){el.remove();return}
  setTimeout(()=>el.classList.add('out'),950);
  setTimeout(()=>el.remove(),1600);
}

/* ---------- scroll-driven chrome (one rAF loop) ---------- */
function initScrollFX(){
  const bar=$('#readingProgress'),toTop=$('#toTop'),ambient=$('#ambient');
  const parallax=!lite()&&!reduceMotion();
  let ticking=false;
  const update=()=>{
    ticking=false;
    const max=document.documentElement.scrollHeight-innerHeight;
    const y=scrollY;
    bar.style.transform=`scaleX(${max>0?Math.min(1,y/max):0})`;
    document.body.classList.toggle('is-scrolled',y>24);
    toTop.classList.toggle('show',y>560);
    if(parallax)ambient.style.transform=`translate3d(0,${(-y*.045).toFixed(1)}px,0)`;
  };
  addEventListener('scroll',()=>{if(!ticking){ticking=true;raf(update)}},{passive:true});
  addEventListener('resize',()=>{if(!ticking){ticking=true;raf(update)}},{passive:true});
  toTop.onclick=()=>scrollTo({top:0,behavior:reduceMotion()?'auto':'smooth'});
  update();
}

/* ---------- press feedback: jelly + ripple ---------- */
function initPressFX(){
  document.addEventListener('pointerdown',e=>{
    const b=e.target.closest('button,.article-card,.topic-card,.brand-top');
    if(!b)return;
    if(!reduceMotion()){
      b.classList.remove('jelly');void b.offsetWidth;b.classList.add('jelly');
      setTimeout(()=>b.classList.remove('jelly'),600);
    }
    if(lite()||reduceMotion())return;
    const r=b.getBoundingClientRect(),size=Math.max(r.width,r.height)*2.1;
    const ink=document.createElement('span');
    ink.className='ripple';
    ink.style.cssText=`width:${size}px;height:${size}px;left:${e.clientX-r.left}px;top:${e.clientY-r.top}px`;
    if(getComputedStyle(b).position==='static')b.style.position='relative';
    b.appendChild(ink);
    setTimeout(()=>ink.remove(),660);
  },{passive:true});
}

/* ---------- global wiring ---------- */
$('#brandHome').onclick=()=>goto('home');
$('#brandHome').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();goto('home')}};
$('#searchBtn').onclick=openSearch;
$('#searchClose').onclick=closeSearch;
$('#searchOverlay').onclick=e=>{if(e.target===$('#searchOverlay'))closeSearch()};
$('#searchInput').oninput=e=>{renderSearch(e.target.value);if(window.SignWellEasterEgg)SignWellEasterEgg.handleSearch(e.target.value)};
$('#themeBtn').onclick=toggleTheme;

document.addEventListener('keydown',e=>{
  const open=$('#searchOverlay').classList.contains('show');
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();open?closeSearch():openSearch();return}
  if(e.key==='/'&&!open&&!/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||'')){e.preventDefault();openSearch();return}
  if(!open)return;
  if(e.key==='Escape')closeSearch();
  else if(e.key==='ArrowDown'){e.preventDefault();moveSearch(1)}
  else if(e.key==='ArrowUp'){e.preventDefault();moveSearch(-1)}
  else if(e.key==='Enter'){const row=$('#searchResults .search-result.active');if(row){e.preventDefault();row.click()}}
});

matchMedia('(prefers-color-scheme:dark)').addEventListener?.('change',()=>{
  if((localStorage.getItem('signwell-theme')||'system')==='system')applyTheme();
});
let routeRenderRAF=0;
function scheduleRouteRender(){
  if(routeRenderRAF)cancelAnimationFrame(routeRenderRAF);
  routeRenderRAF=requestAnimationFrame(()=>{
    routeRenderRAF=0;
    if(document.startViewTransition&&!reduceMotion()){
      document.startViewTransition(()=>render()).finished.catch(()=>{});
    }else{
      render();
    }
  });
}
addEventListener('hashchange',scheduleRouteRender);
addEventListener('popstate',scheduleRouteRender);
addEventListener('storage',e=>{
  if(e.key===SW_REVISION_KEY)schedulePublicRevalidate(80);
});
addEventListener('pageshow',e=>{
  if(e.persisted)schedulePublicRevalidate(100);
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')revalidatePublicData(false).catch(()=>{});
});

/* ---------- navigation prefetch ---------- */
function prefetchSiblingPages(){
  const current=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const pages=['index.html','topics.html','about.html','share.html','newsletter.html'].filter(x=>x!==current);
  const run=()=>pages.forEach(href=>{
    const abs=new URL(href,location.href).href;
    if([...document.querySelectorAll('link[rel="prefetch"]')].some(x=>x.href===abs))return;
    const l=document.createElement('link');
    l.rel='prefetch';l.href=href;l.as='document';
    document.head.appendChild(l);
  });
  if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:2200});
  else setTimeout(run,1400);
}


/* ---------- v18.1 network + navigation governor ---------- */
let swBootArticlesFromCache=false;
let swBootBundleFromCache=false;
let swNetworkSweepAt=0;
let swNetworkSweepPromise=null;

const swLoadArticlesBase=loadArticles;
loadArticles=async function(){
  swBootArticlesFromCache=Array.isArray(readSessionJSON(SW_ARTICLES_CACHE));
  return swLoadArticlesBase();
};

const swLoadPublicBundleBase=loadPublicBundle;
loadPublicBundle=async function(){
  swBootBundleFromCache=validBundle(readSessionJSON(SW_BUNDLE_CACHE));
  if(swBootBundleFromCache){
    readCachedPublicBundle();
    return true;
  }
  return swLoadPublicBundleBase();
};

const swRevalidatePublicDataBase=revalidatePublicData;
revalidatePublicData=async function(force=false){
  if(navigator.onLine===false)return false;

  const now=Date.now();
  const gap=force?4000:12000;
  if(!force && now-swNetworkSweepAt<gap)return false;
  if(swNetworkSweepPromise)return swNetworkSweepPromise;

  swNetworkSweepAt=now;
  swNetworkSweepPromise=Promise.resolve(swRevalidatePublicDataBase(force))
    .finally(()=>{swNetworkSweepPromise=null});
  return swNetworkSweepPromise;
};

schedulePublicRevalidate=function(delay=180,force=false){
  setTimeout(()=>revalidatePublicData(force).catch(()=>{}),delay);
};

/* Prefetch only adjacent pages, and never consume bandwidth when the user
   has asked for data saving or is on a very slow connection. */
prefetchSiblingPages=function(){
  const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
  const slow=connection?.saveData || /(^|-)2g$|slow-2g/i.test(String(connection?.effectiveType||''));
  if(slow || document.hidden)return;

  const files=['index.html','topics.html','about.html','share.html','newsletter.html'];
  const current=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const i=Math.max(0,files.indexOf(current));
  const coarse=matchMedia('(pointer:coarse)').matches;

  let targets=[];
  if(i+1<files.length)targets.push(files[i+1]);
  if(!coarse && i-1>=0)targets.push(files[i-1]);
  targets=[...new Set(targets)].filter(x=>x!==current);

  const addOne=(href,delay=0)=>{
    setTimeout(()=>{
      if(document.hidden)return;
      const abs=new URL(href,location.href).href;
      if([...document.querySelectorAll('link[rel="prefetch"]')].some(x=>x.href===abs))return;
      const l=document.createElement('link');
      l.rel='prefetch';
      l.href=href;
      l.as='document';
      document.head.appendChild(l);
    },delay);
  };

  const run=()=>targets.forEach((href,n)=>addOne(href,n*240));
  if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:2400});
  else setTimeout(run,1500);
};

function hardenRenderedArticleMedia(){
  document.querySelectorAll('.article-body img').forEach(img=>{
    img.loading='lazy';
    img.decoding='async';
    try{img.fetchPriority='low'}catch(_){}

    if(img.closest('.sw-source-figure')){
      const drop=()=>img.closest('.sw-source-figure')?.remove();
      img.addEventListener('error',drop,{once:true});
      if(img.complete && !img.naturalWidth)drop();
    }
  });
}


/* ---------- boot ---------- */
(async()=>{
  window.SignWellErrors?.installGlobal?.({surface:'PUB',module:'public-runtime',homeUrl:'https://signwell.com.tw/'});
  optimize();applyTheme();applyChrome();initGlobalVisualPause();initAdaptiveVisualQuality();
  preparePagerRouteEntrance();

  /* Use the welcome screen as a real warm-up window. */
  const warmPromise=warmStartupCache();
  initWelcome();prefetchSiblingPages();

  Slider.init();initPointerFX();initScrollFX();initPressFX();
  setNav(routeIndex(route()),true);

  /* Begin network work in parallel while the splash is still visible. */
  const articlePromise=loadArticles();
  const bundlePromise=loadPublicBundle();

  await paint();
  await articlePromise;
  const bundleLoaded=await bundlePromise;
  if(!bundleLoaded)await loadTopics();

  ready=true;
  applyChrome();
  await paint();
  playPagerRouteEntrance();
  preloadVisibleCovers();
  initReveal();
  initIdleSubscriptionPrompt();

  warmPromise.catch(()=>{});
  schedulePublicRevalidate((!swBootArticlesFromCache&&!swBootBundleFromCache)?12000:260);
})();
})();

window.addEventListener('pagehide',()=>{
  document.body.classList.add('visual-paused');
},{passive:true});

