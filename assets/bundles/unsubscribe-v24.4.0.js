
const params=new URLSearchParams(location.search);
const token=params.get('t')||'';
function endpoint(){
  const cfg=window.SIGNWELL_NEWSLETTER||window.SIGNWELL_ANALYTICS||{};
  const url=String(cfg.endpoint||'').trim();
  return /^https:\/\/script\.google\.com\/macros\/s\//i.test(url)?url:'';
}
function gasBridge(action,payload={},timeoutMs=45000){
  return new Promise((resolve,reject)=>{
    const requestId='swu_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);
    const frameName='swuframe_'+requestId;
    const iframe=document.createElement('iframe');
    iframe.name=frameName;iframe.tabIndex=-1;iframe.setAttribute('aria-hidden','true');
    Object.assign(iframe.style,{position:'fixed',width:'1px',height:'1px',opacity:'0',pointerEvents:'none',left:'-9999px',top:'-9999px'});
    const backend=endpoint();
    if(!backend){reject(new Error('SIGN WELL Backend 尚未啟用，請稍後再試。'));return}
    const form=document.createElement('form');
    form.method='POST';form.action=backend;form.target=frameName;form.style.display='none';
    const add=(name,value)=>{const i=document.createElement('input');i.type='hidden';i.name=name;i.value=String(value??'');form.appendChild(i)};
    add('transport','iframe');add('requestId',requestId);add('returnOrigin',location.origin);add('action',action);add('payload',JSON.stringify(payload||{}));
    let timer=0;
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',onMessage);form.remove();setTimeout(()=>iframe.remove(),40)};
    const onMessage=e=>{const d=e.data;if(!d||d.source!=='SIGNWELL_GAS'||d.requestId!==requestId)return;cleanup();d.ok?resolve(d.data||{}):reject(new Error(d.error||'SIGN WELL Backend error'))};
    window.addEventListener('message',onMessage);
    timer=setTimeout(()=>{cleanup();reject(new Error('取消訂閱同步逾時，請稍後再試。'))},timeoutMs);
    document.body.append(iframe,form);form.submit();
  });
}
function showOnly(id){['retentionStep','reasonStep','resultStep'].forEach(x=>document.getElementById(x).classList.toggle('hidden',x!==id))}
function setResult(title,copy,email='',kind='success'){
  showOnly('resultStep');document.getElementById('resultTitle').textContent=title;document.getElementById('resultCopy').textContent=copy;
  const em=document.getElementById('email');if(email){em.textContent=email;em.classList.add('show')}else{em.classList.remove('show')}
  const icon=document.getElementById('statusIcon');
  if(kind==='loading')icon.innerHTML='<div class="spinner" aria-hidden="true"></div>';
  else if(kind==='error')icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 17h.01"/></svg>';
  else icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg>';
}
async function unsubscribe(reason='skipped'){
  if(!token){setResult('連結無效','這個取消訂閱連結缺少必要憑證。','','error');return}
  setResult('正在取消訂閱','正在同步你的設定，完成後就不會再收到 SIGN WELL Letter。','','loading');
  try{
    const note=reason==='skipped'?'':String(document.getElementById('reasonNote')?.value||'').trim();
    const result=await gasBridge('newsletter.unsubscribe',{token,reason,note});
    try{
      localStorage.removeItem('signwell-newsletter-subscribed');
      localStorage.removeItem('signwell-newsletter-pending');
      localStorage.removeItem('signwell-newsletter-pending-at');
      localStorage.setItem('signwell-newsletter-last-result',JSON.stringify({ok:true,at:Date.now(),status:'unsubscribed'}));
    }catch(_){}
    try{history.replaceState(null,'',location.pathname)}catch(_){}
    setResult('已取消訂閱',result.message||'已同步完成。之後不會再寄送 SIGN WELL 電子報到這個信箱。',result.emailMasked||'','success');
  }catch(err){setResult('無法完成取消訂閱',String(err?.message||err||'系統暫時無法同步，請稍後再試。'),'','error')}
}
document.getElementById('keepBtn').onclick=()=>setResult('已保留訂閱','你的訂閱沒有任何變更。下一封值得讀的內容，我們再見。','','success');
document.getElementById('continueCancelBtn').onclick=()=>showOnly('reasonStep');
document.getElementById('backBtn').onclick=()=>showOnly('retentionStep');
document.getElementById('unsubscribeBtn').onclick=()=>unsubscribe(document.querySelector('input[name="reason"]:checked')?.value||'skipped');
document.getElementById('skipBtn').onclick=()=>unsubscribe('skipped');
if(params.get('preview')==='1')setResult('取消訂閱設定頁','這是電子報預覽／測試連結，不會變更任何人的訂閱狀態。','','success');
else if(!token)setResult('連結無效','請從你收到的 SIGN WELL 電子報底部重新開啟「取消訂閱」。','','error');
