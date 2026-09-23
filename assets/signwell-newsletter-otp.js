/* SIGN WELL Newsletter OTP · v24.2.0
   First-party device ID + six-digit email verification UI.
   No fingerprinting: only a random browser identifier stored in localStorage/cookie. */
(function(){
'use strict';
const DEVICE_KEY='signwell-device-id-v1';
const COOKIE_KEY='sw_device_v1';
const DEVICE_DAYS=180;
let activeFlow=null;

function cookiePath(){
  return /\.github\.io$/i.test(location.hostname)&&location.pathname.indexOf('/-/')===0?'/-/':'/';
}
function readCookie(name){
  const m=document.cookie.match(new RegExp('(?:^|; )'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'=([^;]*)'));
  return m?decodeURIComponent(m[1]):'';
}
function validDeviceId(v){return /^[A-Za-z0-9_-]{24,96}$/.test(String(v||''))}
function freshDeviceId(){
  try{if(crypto&&typeof crypto.randomUUID==='function')return crypto.randomUUID().replace(/-/g,'')+'_'+Date.now().toString(36)}catch(_){ }
  try{
    const b=new Uint8Array(24);crypto.getRandomValues(b);
    return Array.from(b,x=>x.toString(16).padStart(2,'0')).join('')+'_'+Date.now().toString(36);
  }catch(_){return 'sw_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2)}
}
function persistDeviceId(id){
  try{localStorage.setItem(DEVICE_KEY,id)}catch(_){ }
  try{document.cookie=COOKIE_KEY+'='+encodeURIComponent(id)+'; Max-Age='+(DEVICE_DAYS*86400)+'; Path='+cookiePath()+'; SameSite=Lax; Secure'}catch(_){ }
  return id;
}
function getDeviceId(){
  let id='';
  try{id=localStorage.getItem(DEVICE_KEY)||''}catch(_){ }
  if(!validDeviceId(id))id=readCookie(COOKIE_KEY);
  if(!validDeviceId(id))id=freshDeviceId();
  return persistDeviceId(id);
}
function bridge(action,payload,timeout){
  if(typeof window.signwellPublicGasBridge!=='function')return Promise.reject(new Error('SIGN WELL Backend 尚未啟用'));
  return window.signwellPublicGasBridge(action,payload||{},timeout||45000);
}
function maskEmail(email){
  const p=String(email||'').split('@');if(p.length!==2)return '***';
  const left=p[0],shown=left.length<=2?left.slice(0,1):left.slice(0,2);
  return shown+'••••@'+p[1];
}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function turnstileKey(){return String(window.SIGNWELL_TURNSTILE_SITE_KEY||'').trim()}
let tsLoader=null;
function loadTurnstile(){
  if(window.turnstile)return Promise.resolve(true);
  if(tsLoader)return tsLoader;
  tsLoader=new Promise((resolve,reject)=>{
    const old=document.querySelector('script[data-sw-otp-turnstile]');
    if(old){const wait=()=>window.turnstile?resolve(true):setTimeout(wait,80);wait();return}
    const s=document.createElement('script');s.dataset.swOtpTurnstile='1';s.async=true;s.defer=true;
    s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.onload=()=>resolve(true);s.onerror=()=>reject(new Error('人機驗證元件載入失敗'));
    document.head.appendChild(s);
  });
  return tsLoader;
}
function ensureOverlay(){
  let el=document.getElementById('swNewsletterOtpOverlay');if(el)return el;
  el=document.createElement('div');el.id='swNewsletterOtpOverlay';el.className='sw-otp-overlay';el.setAttribute('aria-hidden','true');
  el.innerHTML=`<section class="sw-otp-card" role="dialog" aria-modal="true" aria-labelledby="swOtpTitle">
    <div class="sw-otp-glow sw-otp-glow-a" aria-hidden="true"></div><div class="sw-otp-glow sw-otp-glow-b" aria-hidden="true"></div>
    <header class="sw-otp-head"><div><div class="sw-otp-kicker"><i></i>SIGN WELL LETTER</div><h2 id="swOtpTitle">確認你的 Email</h2></div><button class="sw-otp-close" type="button" aria-label="關閉">×</button></header>
    <div class="sw-otp-stage" data-stage="code">
      <p class="sw-otp-copy">我們已將 6 位數驗證碼寄到 <strong data-email></strong>。輸入正確後才會正式加入電子報。</p>
      <label class="sw-otp-code-wrap" aria-label="6 位數驗證碼">
        <input class="sw-otp-code-input" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" aria-label="6 位數驗證碼">
        <span class="sw-otp-digits" aria-hidden="true">${'<b>–</b>'.repeat(6)}</span>
      </label>
      <div class="sw-otp-timer"><span data-expiry>05:00 後失效</span><span data-attempts>最多可輸錯 6 次</span></div>
      <div class="sw-otp-challenge" hidden><div class="sw-otp-challenge-copy">再次寄送前，請先完成「我不是電腦」驗證。</div><div data-turnstile></div></div>
      <div class="sw-otp-status" role="status" aria-live="polite"></div>
      <div class="sw-otp-actions"><button class="sw-otp-resend" type="button" disabled>60 秒後可重新寄送</button><button class="sw-otp-verify" type="button">確認驗證碼</button></div>
      <p class="sw-otp-note">驗證碼 5 分鐘有效。為防止濫用，一般模式每天最多 5 次；人機驗證未啟用時會自動採更嚴格的重寄限制。</p>
    </div>
    <div class="sw-otp-stage sw-otp-success" data-stage="success" hidden><div class="sw-otp-check">✓</div><h3>訂閱完成</h3><p>歡迎加入 SIGN WELL。下一封值得讀的內容，我們寄給你。</p></div>
    <div class="sw-otp-stage sw-otp-success sw-otp-already" data-stage="already" hidden><div class="sw-otp-check">✓</div><h3>此電子郵件已訂閱</h3><p>這個 Email 已經是 SIGN WELL Letter 的有效訂閱者，不需要再次驗證。</p></div>
  </section>`;
  document.body.appendChild(el);
  return el;
}
function renderDigits(input,wrap){
  const v=String(input.value||'').replace(/\D/g,'').slice(0,6);input.value=v;
  const nodes=wrap.querySelectorAll('.sw-otp-digits b');nodes.forEach((n,i)=>{n.textContent=v[i]||'–';n.classList.toggle('filled',Boolean(v[i]));});
}
function fmtSeconds(sec){sec=Math.max(0,Math.ceil(sec));const m=Math.floor(sec/60),s=sec%60;return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
function show(el){el.classList.add('show');el.setAttribute('aria-hidden','false');document.documentElement.classList.add('sw-otp-open')}
function hide(el){el.classList.remove('show');el.setAttribute('aria-hidden','true');document.documentElement.classList.remove('sw-otp-open')}

async function mountChallenge(flow){
  const key=turnstileKey(),box=flow.el.querySelector('.sw-otp-challenge'),host=flow.el.querySelector('[data-turnstile]');
  box.hidden=false;flow.challengeToken='';host.innerHTML='';
  if(!key){flow.status('此裝置需要人機驗證，但網站尚未設定 Turnstile。請稍後再試。','error');return false}
  try{
    await loadTurnstile();
    flow.turnstileId=window.turnstile.render(host,{sitekey:key,theme:document.body.classList.contains('dark')?'dark':'light',callback:t=>{flow.challengeToken=String(t||'');flow.status('人機驗證完成，可以重新寄送。','ok')},'expired-callback':()=>{flow.challengeToken=''},'error-callback':()=>{flow.challengeToken='';return true}});
    return true;
  }catch(e){flow.status(String(e.message||e),'error');return false}
}
function resetChallenge(flow){
  flow.challengeToken='';
  try{if(window.turnstile&&flow.turnstileId!=null)window.turnstile.reset(flow.turnstileId)}catch(_){ }
}

function start(options){
  options=options||{};const email=String(options.email||'').trim().toLowerCase();
  if(activeFlow&&typeof activeFlow.close==='function')activeFlow.close(true);
  const el=ensureOverlay(),input=el.querySelector('.sw-otp-code-input'),digits=el.querySelector('.sw-otp-code-wrap'),verifyBtn=el.querySelector('.sw-otp-verify'),resendBtn=el.querySelector('.sw-otp-resend'),statusEl=el.querySelector('.sw-otp-status'),expiryEl=el.querySelector('[data-expiry]'),attemptsEl=el.querySelector('[data-attempts]'),emailEl=el.querySelector('[data-email]'),titleEl=el.querySelector('#swOtpTitle'),codeStage=el.querySelector('[data-stage="code"]'),successStage=el.querySelector('[data-stage="success"]'),alreadyStage=el.querySelector('[data-stage="already"]'),challengeBox=el.querySelector('.sw-otp-challenge');
  const priorFocus=document.activeElement;
  titleEl.textContent='確認你的 Email';emailEl.textContent=maskEmail(email);codeStage.hidden=false;successStage.hidden=true;alreadyStage.hidden=true;challengeBox.hidden=true;statusEl.textContent='';statusEl.className='sw-otp-status';input.value='';renderDigits(input,digits);show(el);
  let resolveDone,rejectDone;const done=new Promise((r,j)=>{resolveDone=r;rejectDone=j});
  const flow={el,email,deviceId:getDeviceId(),requestId:'',expiresAt:0,cooldownUntil:0,attemptsRemaining:6,challengeToken:'',turnstileId:null,timer:0,closed:false,keyHandler:null,status(msg,type){statusEl.textContent=msg||'';statusEl.className='sw-otp-status'+(type?' '+type:'')},restoreFocus(){setTimeout(()=>{try{priorFocus&&priorFocus.focus&&priorFocus.focus({preventScroll:true})}catch(_){}},40)},close(silent){if(flow.closed)return;flow.closed=true;clearInterval(flow.timer);if(flow.keyHandler)document.removeEventListener('keydown',flow.keyHandler);hide(el);flow.restoreFocus();if(activeFlow===flow)activeFlow=null;rejectDone(new Error('已取消 Email 驗證'))}};
  activeFlow=flow;
  flow.keyHandler=e=>{
    if(flow.closed||!el.classList.contains('show'))return;
    if(e.key==='Escape'){e.preventDefault();flow.close(false);return}
    if(e.key==='Tab'){
      const focusables=[...el.querySelectorAll('button,input,[href],[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled&&x.offsetParent!==null);
      if(!focusables.length)return;
      const first=focusables[0],last=focusables[focusables.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    }
  };
  document.addEventListener('keydown',flow.keyHandler);
  const payloadBase=()=>({email,consent:true,source:String(options.source||'signwell-public'),page:location.href,honeypot:String(options.honeypot||''),elapsed:Math.max(0,Number(options.elapsed||0)),deviceId:flow.deviceId});
  function tick(){
    const now=Date.now();
    if(flow.expiresAt){const left=Math.max(0,Math.ceil((flow.expiresAt-now)/1000));expiryEl.textContent=left?fmtSeconds(left)+' 後失效':'驗證碼已失效';if(!left)verifyBtn.disabled=true}
    const cd=Math.max(0,Math.ceil((flow.cooldownUntil-now)/1000));resendBtn.disabled=cd>0;resendBtn.textContent=cd?cd+' 秒後可重新寄送':'重新寄送驗證碼';
  }
  async function requestCode(isResend){
    flow.status(isResend?'正在檢查重新寄送資格…':'正在寄送 6 位數驗證碼…','');resendBtn.disabled=true;verifyBtn.disabled=true;
    try{
      const r=await bridge('newsletter.subscribe',Object.assign(payloadBase(),{captchaToken:flow.challengeToken}),45000);
      if(r&&r.status==='already_subscribed'){
        clearInterval(flow.timer);flow.requestId='';titleEl.textContent='訂閱狀態';codeStage.hidden=true;successStage.hidden=true;alreadyStage.hidden=false;challengeBox.hidden=true;flow.status('','');
        try{localStorage.setItem('signwell-newsletter-subscribed','1');localStorage.removeItem('signwell-newsletter-pending');localStorage.removeItem('signwell-newsletter-pending-at')}catch(_){ }
        if(typeof options.onAlreadySubscribed==='function')try{options.onAlreadySubscribed(r)}catch(_){ }
        resolveDone(r);
        setTimeout(()=>{if(flow.closed)return;if(flow.keyHandler)document.removeEventListener('keydown',flow.keyHandler);hide(el);flow.closed=true;flow.restoreFocus();if(activeFlow===flow)activeFlow=null},2400);
        return r;
      }
      if(r&&r.status==='challenge_required'){
        flow.cooldownUntil=Date.now()+Math.max(0,Number(r.cooldownSeconds||0))*1000;tick();
        if(r.challengeAvailable===false){
          challengeBox.hidden=true;
          const msg=String(r.reason||'')==='device_storage_unavailable'
            ? '目前瀏覽器無法建立安全的裝置識別。請允許本站 Cookie／網站儲存空間後重新整理再試。'
            : '目前人機驗證服務未啟用；系統無法完成這次高風險重寄，請稍後再試。';
          flow.status(msg,'error');
          return r;
        }
        const mounted=await mountChallenge(flow);
        if(mounted)flow.status('請完成「我不是電腦」驗證後再重新寄送。','warn');
        return r;
      }
      if(r&&r.status==='cooldown'){
        flow.cooldownUntil=Date.now()+Math.max(1,Number(r.retryAfter||60))*1000;tick();flow.status('重新寄送太快了，請等倒數結束。','warn');return r;
      }
      if(r&&r.status==='daily_limit'){
        flow.cooldownUntil=Date.now()+86400000;tick();flow.status('今天的驗證碼發送次數已達上限，請明天再試。','error');return r;
      }
      if(!r||r.status!=='otp_sent'||!r.requestId)throw new Error('驗證碼暫時無法寄送，請稍後再試。');
      flow.requestId=String(r.requestId);flow.expiresAt=Date.parse(r.expiresAt||'')||Date.now()+300000;flow.cooldownUntil=Date.now()+Math.max(1,Number(r.cooldownSeconds||60))*1000;flow.attemptsRemaining=Number(r.attemptsRemaining||6);attemptsEl.textContent='最多可輸錯 '+flow.attemptsRemaining+' 次';input.value='';renderDigits(input,digits);verifyBtn.disabled=false;challengeBox.hidden=true;resetChallenge(flow);tick();
      const fallbackNote=r.degradedProtection&&isResend?' 人機驗證未啟用，本次改以較嚴格的重寄頻率限制保護。':'';
      flow.status((isResend?'新驗證碼已寄出。':'驗證碼已寄出。')+'請查看 Email 並在 5 分鐘內輸入。'+fallbackNote,'ok');setTimeout(()=>input.focus({preventScroll:true}),120);return r;
    }catch(e){flow.status(String(e.message||e),'error');throw e}
    finally{if(flow.requestId&&Date.now()<flow.expiresAt)verifyBtn.disabled=false;tick()}
  }
  async function verify(){
    const code=String(input.value||'').replace(/\D/g,'');if(code.length!==6){flow.status('請輸入完整的 6 位數驗證碼。','warn');input.focus();return}
    verifyBtn.disabled=true;flow.status('正在核對驗證碼…','');
    try{
      const r=await bridge('newsletter.verifyOtp',{requestId:flow.requestId,email,deviceId:flow.deviceId,code},30000);
      if(r&&r.status==='verified'){
        clearInterval(flow.timer);codeStage.hidden=true;successStage.hidden=false;flow.status('','');
        try{localStorage.setItem('signwell-newsletter-subscribed','1');localStorage.removeItem('signwell-newsletter-pending');localStorage.removeItem('signwell-newsletter-pending-at')}catch(_){ }
        if(typeof options.onVerified==='function')try{options.onVerified(r)}catch(_){ }
        resolveDone(r);setTimeout(()=>{if(flow.keyHandler)document.removeEventListener('keydown',flow.keyHandler);hide(el);flow.closed=true;flow.restoreFocus();if(activeFlow===flow)activeFlow=null},1800);return
      }
      if(r&&r.status==='expired'){flow.status('這組驗證碼已超過 5 分鐘，請重新寄送。','error');verifyBtn.disabled=true;return}
      if(r&&r.status==='locked'){flow.status('這組驗證碼輸入錯誤次數已達上限，請重新取得新碼。','error');verifyBtn.disabled=true;return}
      if(r&&r.status==='invalid_code'){
        flow.attemptsRemaining=Math.max(0,Number(r.attemptsRemaining||0));attemptsEl.textContent='還可輸入 '+flow.attemptsRemaining+' 次';flow.status('驗證碼不正確，請再確認一次。','error');input.select();return
      }
      flow.status('目前無法完成驗證，請稍後再試。','error');
    }catch(e){flow.status(String(e.message||e),'error')}
    finally{if(!flow.closed&&flow.requestId&&Date.now()<flow.expiresAt&&flow.attemptsRemaining>0)verifyBtn.disabled=false}
  }
  input.oninput=()=>renderDigits(input,digits);input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();verify()}};digits.onclick=()=>input.focus();verifyBtn.onclick=verify;resendBtn.onclick=async()=>{if(Date.now()<flow.cooldownUntil)return;if(challengeBox.hidden===false&&!flow.challengeToken){flow.status('請先完成「我不是電腦」驗證。','warn');return}await requestCode(true)};
  el.querySelector('.sw-otp-close').onclick=()=>flow.close(false);el.onclick=e=>{if(e.target===el)flow.close(false)};
  flow.timer=setInterval(tick,500);tick();requestAnimationFrame(()=>requestCode(false).catch(()=>{}));
  return done;
}

// Create the first-party random identifier on normal page load so a later revisit uses the same device bucket.
getDeviceId();
window.SignwellNewsletterOtp={start,getDeviceId,version:'24.2.0'};
})();
