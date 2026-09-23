/* SIGN WELL Error Experience · v24.10.0
 * Shared by Public and CMS. This surface never treats UI text as authority.
 */
(()=>{
'use strict';
const STATUS={
  400:['請求格式有誤','這個要求無法被系統理解。'],
  401:['需要重新登入','目前的工作階段無法完成這個操作。'],
  403:['沒有這個操作的權限','目前來源或工作階段不在允許範圍內。'],
  404:['找不到指定內容','網址、文章或資源目前不存在。'],
  408:['請求等待過久','瀏覽器在等待要求完成時超過時間。'],
  409:['資料版本發生衝突','目前資料與伺服器上的版本不同步。'],
  422:['資料未通過驗證','內容存在缺漏或格式不符合目前規則。'],
  429:['請求過於頻繁','系統暫時限制新的要求，稍後可再試。'],
  500:['程式執行發生問題','SIGN WELL 在執行這個功能時遇到未預期狀況。'],
  502:['上游服務回應異常','SIGN WELL 已送出要求，但外部服務沒有回傳可用結果。'],
  503:['服務目前無法使用','必要服務尚未啟用、暫時離線或正在維護。'],
  504:['服務回應逾時','SIGN WELL 已送出要求，但後端或上游服務未在期限內完成。']
};
const RETRY=new Set([408,429,500,502,503,504]);
const clean=(v,n=260)=>String(v??'').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
const upper=v=>clean(v,90).toUpperCase().replace(/[^A-Z0-9_-]/g,'-');
function safeLocation(stack){
  const s=String(stack||'');
  const m=s.match(/(?:https?:\/\/[^\s)]+\/)?([^\s/()]+\.(?:js|mjs|html)):(\d+):(\d+)/i);
  return m?`${m[1]}:${m[2]}:${m[3]}`:'';
}
function inferStatus(raw,ctx={}){
  const direct=Number(ctx.status||raw?.status||raw?.httpStatus||0);
  if(STATUS[direct])return direct;
  const msg=String(raw?.message||raw||'');
  if(typeof navigator!=='undefined'&&navigator.onLine===false)return 503;
  if(/origin not allowed|forbidden|permission|not authorized|權限|拒絕存取/i.test(msg))return 403;
  if(/not found|不存在|找不到|\b404\b/i.test(msg))return 404;
  if(/rate limit|too many|過於頻繁|\b429\b/i.test(msg))return 429;
  if(/timeout|timed out|逾時|超時|\b504\b/i.test(msg))return 504;
  if(/conflict|revision|version mismatch|不一致|衝突|stale/i.test(msg))return 409;
  if(/invalid|validation|格式錯誤|缺少|required|不完整|未通過/i.test(msg))return 422;
  if(/failed to fetch|network|bad gateway|upstream|外部服務|\b502\b/i.test(msg))return 502;
  if(/尚未啟用|service unavailable|offline|maintenance|quota exceeded|\b503\b/i.test(msg))return 503;
  return 500;
}
function reasonToken(status,ctx={}){
  if(ctx.token)return upper(ctx.token);
  const map={400:'BAD-REQUEST',401:'AUTH-REQUIRED',403:'ORIGIN-DENIED',404:'RESOURCE-NOT-FOUND',408:'REQUEST-TIMEOUT',409:'STATE-CONFLICT',422:'VALIDATION',429:'RATE-LIMIT',500:'RUNTIME',502:'UPSTREAM-RESPONSE',503:'SERVICE-UNAVAILABLE',504:'BRIDGE-TIMEOUT'};
  return map[status]||'RUNTIME';
}
function normalize(raw,ctx={}){
  const status=inferStatus(raw,ctx);
  const surface=upper(ctx.surface||raw?.surface||'APP').slice(0,12)||'APP';
  const backendCode=upper(ctx.errorCode||raw?.errorCode||raw?.code||'');
  const errorCode=backendCode&&/^SW-[A-Z]+-\d{3}-/.test(backendCode)?backendCode:`SW-${surface}-${status}-${reasonToken(status,ctx)}`;
  const pair=STATUS[status]||STATUS[500];
  const rawMessage=clean(ctx.reason||raw?.reason||raw?.message||raw||'',320);
  const publicMode=surface==='PUB'||ctx.public===true;
  let cause=rawMessage||pair[1];
  cause=cause
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,'[email]')
    .replace(/(?:github_pat_|ghp_|sk-[A-Za-z0-9_-]*|AIza[A-Za-z0-9_-]*)[A-Za-z0-9_-]*/g,'[secret]')
    .replace(/https:\/\/script\.google\.com\/[^\s]+/g,'[backend]')
    .replace(/SW_[A-Z0-9_]+/g,'[setting]');
  if(publicMode&&/(TypeError|ReferenceError|Exception:|PropertiesService|SpreadsheetApp|ScriptApp| at )/i.test(cause))cause='系統執行時發生未預期問題；公開頁面已隱藏內部堆疊資訊。';
  const moduleName=clean(ctx.module||raw?.module||'',80)||'runtime';
  const action=clean(ctx.action||raw?.action||'',100);
  const requestId=clean(ctx.requestId||raw?.requestId||'',80);
  const errorId=clean(ctx.errorId||raw?.errorId||'',80);
  const location=publicMode?'':clean(ctx.location||raw?.location||safeLocation(raw?.stack),120);
  return {
    status,errorCode,title:clean(ctx.title||pair[0],80),message:clean(ctx.message||pair[1],220),cause:clean(cause,300),
    module:moduleName,action,requestId,errorId,location,
    retryable:ctx.retryable??raw?.retryable??RETRY.has(status),surface,
    timestamp:new Date().toISOString(),homeUrl:ctx.homeUrl||'index.html',back:ctx.back!==false
  };
}
function bridgeError(message,meta={}){
  const e=new Error(clean(message||meta.error||'SIGN WELL Backend error',320));
  ['status','errorCode','errorId','requestId','module','action','reason','retryable'].forEach(k=>{if(meta[k]!==undefined)e[k]=meta[k]});
  return e;
}
function diagnosticText(d){
  return [
    'SIGN WELL diagnostic',
    `status: ${d.status}`,
    `code: ${d.errorCode}`,
    `module: ${d.module||'-'}`,
    `action: ${d.action||'-'}`,
    `request: ${d.requestId||'-'}`,
    `error: ${d.errorId||'-'}`,
    `location: ${d.location||'-'}`,
    `time: ${d.timestamp}`,
    `reason: ${d.cause}`
  ].join('\n');
}
function html(d,{dismissible=false}={}){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const detailRows=[
    ['模組',d.module],['Action',d.action],['Request ID',d.requestId],['Error ID',d.errorId],['程式位置',d.location],['時間',d.timestamp]
  ].filter(x=>x[1]);
  return `<section class="sw-error-stage" role="alert" aria-labelledby="swErrorTitle" data-sw-status="${d.status}">
    <div class="sw-error-ambient" aria-hidden="true"><i></i><i></i><i></i><b>${d.status}</b></div>
    <div class="sw-error-card">
      <div class="sw-error-kicker"><span>SIGN WELL SYSTEM</span><strong>${d.status}</strong></div>
      <div class="sw-error-codeghost" aria-hidden="true">${d.status}</div>
      <h1 id="swErrorTitle">${esc(d.title)}</h1>
      <p class="sw-error-message">${esc(d.message)}</p>
      <div class="sw-error-code"><span>ERROR CODE</span><code>${esc(d.errorCode)}</code></div>
      <div class="sw-error-cause"><span>造成原因</span><p>${esc(d.cause)}</p></div>
      ${detailRows.length?`<details class="sw-error-tech"><summary>技術資訊</summary><dl>${detailRows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></details>`:''}
      <div class="sw-error-actions">
        ${d.retryable?'<button type="button" data-sw-error-retry class="sw-error-primary">重新嘗試</button>':''}
        ${d.back?'<button type="button" data-sw-error-back>返回上一頁</button>':''}
        <a href="${esc(d.homeUrl)}" data-sw-error-home>回到首頁</a>
        <button type="button" data-sw-error-copy>複製診斷資料</button>
        ${dismissible?'<button type="button" data-sw-error-dismiss>關閉</button>':''}
      </div>
      <p class="sw-error-foot">若問題持續發生，請附上錯誤代號與 Request ID 回報。</p>
    </div>
  </section>`;
}
function bind(root,d,opts={}){
  const card=root.querySelector('.sw-error-card');
  root.addEventListener('pointermove',ev=>{if(!card||matchMedia('(prefers-reduced-motion:reduce)').matches)return;const r=card.getBoundingClientRect();card.style.setProperty('--sw-error-x',(((ev.clientX-r.left)/Math.max(1,r.width))*100).toFixed(1)+'%');card.style.setProperty('--sw-error-y',(((ev.clientY-r.top)/Math.max(1,r.height))*100).toFixed(1)+'%')},{passive:true});
  root.querySelector('[data-sw-error-retry]')?.addEventListener('click',()=>{if(typeof opts.onRetry==='function')opts.onRetry(d);else location.reload()});
  root.querySelector('[data-sw-error-back]')?.addEventListener('click',()=>{if(history.length>1)history.back();else location.assign(d.homeUrl)});
  root.querySelector('[data-sw-error-copy]')?.addEventListener('click',async e=>{try{await navigator.clipboard.writeText(diagnosticText(d));const b=e.currentTarget,old=b.textContent;b.textContent='已複製';setTimeout(()=>b.textContent=old,1400)}catch(_){}});
  root.querySelector('[data-sw-error-dismiss]')?.addEventListener('click',()=>opts.onDismiss?.(d));
}
function renderInto(target,raw,ctx={}){
  const el=typeof target==='string'?document.querySelector(target):target;
  if(!el)return null;
  const d=normalize(raw,ctx);
  el.innerHTML=html(d,{dismissible:false});
  el.dataset.swErrorActive='true';
  bind(el,d,ctx);
  document.title=`${d.status} · ${d.title} · SIGN WELL`;
  return d;
}
function show(raw,ctx={}){
  const d=normalize(raw,ctx);
  const previous=document.activeElement;
  let host=document.getElementById('swErrorExperienceOverlay');
  if(!host){host=document.createElement('div');host.id='swErrorExperienceOverlay';host.className='sw-error-overlay';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');document.body.appendChild(host)}
  host.innerHTML=html(d,{dismissible:true});host.classList.add('show');host.setAttribute('aria-hidden','false');
  const close=()=>{host.classList.remove('show');host.setAttribute('aria-hidden','true');setTimeout(()=>{if(!host.classList.contains('show'))host.replaceChildren();try{previous?.focus?.()}catch(_){}},220)};
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();close();document.removeEventListener('keydown',onKey,true)}};
  document.addEventListener('keydown',onKey,true);
  bind(host,d,{...ctx,onDismiss:ctx.onDismiss||close});
  requestAnimationFrame(()=>host.querySelector('.sw-error-primary,[data-sw-error-back],[data-sw-error-dismiss]')?.focus());
  return d;
}
function installGlobal(ctx={}){
  if(window.__swErrorGlobalInstalled)return;window.__swErrorGlobalInstalled=true;
  addEventListener('error',ev=>{
    if(ev.target&&ev.target!==window){
      const tag=String(ev.target.tagName||'').toLowerCase();
      if(tag==='script'||tag==='link'){
        const url=clean(ev.target.src||ev.target.href||'',220);
        let critical=Boolean(ev.target.dataset?.swCritical);
        try{if(url)critical=critical||new URL(url,location.href).origin===location.origin}catch(_){}
        if(critical)show(new Error(`必要資產載入失敗：${url||tag}`),{...ctx,status:502,token:'ASSET-LOAD',module:'asset-loader'});
      }
      return;
    }
    if(ev.error)show(ev.error,{...ctx,module:ctx.module||'runtime'});
  },true);
  addEventListener('unhandledrejection',ev=>{
    const reason=ev.reason instanceof Error?ev.reason:new Error(clean(ev.reason||'Unhandled promise rejection',240));
    show(reason,{...ctx,module:ctx.module||'promise-runtime'});
  });
}
window.SignWellErrors=Object.freeze({normalize,bridgeError,renderInto,show,installGlobal,diagnosticText,STATUS});
})();
