/* SIGN WELL v23.9.1 · unified async dialog */
(()=>{
  'use strict';
  const d=document;
  let active=null, lastFocus=null;
  function ensure(){
    let root=d.getElementById('swUnifiedDialog'); if(root)return root;
    root=d.createElement('div'); root.id='swUnifiedDialog'; root.className='sw-dialog-overlay'; root.setAttribute('aria-hidden','true');
    root.innerHTML=`<section class="sw-dialog-card" role="dialog" aria-modal="true" aria-labelledby="swDialogTitle" aria-describedby="swDialogMessage" data-tone="info"><div class="sw-dialog-head"><div class="sw-dialog-icon" id="swDialogIcon">i</div><div><div class="sw-dialog-kicker" id="swDialogKicker">SIGN WELL</div><h2 class="sw-dialog-title" id="swDialogTitle">訊息</h2></div></div><div class="sw-dialog-message" id="swDialogMessage"></div><label class="sw-dialog-field" id="swDialogField" hidden><span id="swDialogLabel">輸入內容</span><input id="swDialogInput" autocomplete="off"></label><div class="sw-dialog-hint" id="swDialogHint"></div><div class="sw-dialog-actions"><button type="button" class="sw-dialog-cancel" id="swDialogCancel">取消</button><button type="button" class="sw-dialog-confirm" id="swDialogConfirm">確認</button></div></section>`;
    d.body.appendChild(root);
    root.addEventListener('click',e=>{if(e.target===root)finish(active?.kind==='alert'?true:(active?.kind==='prompt'?null:false))});
    root.querySelector('#swDialogCancel').addEventListener('click',()=>finish(active?.kind==='prompt'?null:false));
    root.querySelector('#swDialogConfirm').addEventListener('click',()=>{if(!active)return; if(active.kind==='prompt'){const v=root.querySelector('#swDialogInput').value;finish(v)}else finish(true)});
    d.addEventListener('keydown',e=>{
      if(!active||!root.classList.contains('show'))return;
      if(e.key==='Escape'){e.preventDefault();finish(active.kind==='prompt'?null:false)}
      if(e.key==='Enter'&&active.kind!=='prompt'&&!e.shiftKey){e.preventDefault();root.querySelector('#swDialogConfirm').click()}
      if(e.key==='Tab'){
        const fs=[...root.querySelectorAll('button,input,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.disabled&&!x.hidden);
        if(!fs.length)return;const first=fs[0],last=fs[fs.length-1];if(e.shiftKey&&d.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&d.activeElement===last){e.preventDefault();first.focus()}
      }
    });
    return root;
  }
  function finish(value){
    if(!active)return; const root=ensure(), resolve=active.resolve; active=null; root.classList.remove('show');root.setAttribute('aria-hidden','true');d.body.classList.remove('sw-dialog-open');setTimeout(()=>{try{lastFocus?.focus?.()}catch(_){ } resolve(value)},120);
  }
  function open(kind,message,opts={}){
    if(active)finish(active.kind==='prompt'?null:false);
    const root=ensure(), card=root.querySelector('.sw-dialog-card'), input=root.querySelector('#swDialogInput'), field=root.querySelector('#swDialogField');
    lastFocus=d.activeElement;
    const tone=opts.tone||(opts.danger?'danger':'info'); card.dataset.tone=tone;
    root.querySelector('#swDialogTitle').textContent=opts.title||(kind==='prompt'?'輸入內容':kind==='confirm'?'請確認操作':'提示');
    root.querySelector('#swDialogMessage').textContent=String(message||'');root.querySelector('#swDialogKicker').textContent=opts.kicker||'SIGN WELL';
    root.querySelector('#swDialogIcon').textContent=opts.icon||(tone==='danger'?'!':tone==='warning'?'!':tone==='success'?'✓':'i');
    root.querySelector('#swDialogHint').textContent=opts.hint||'';
    root.querySelector('#swDialogCancel').textContent=opts.cancelText||'取消';root.querySelector('#swDialogConfirm').textContent=opts.confirmText||(kind==='prompt'?'套用':'確認');
    root.querySelector('#swDialogCancel').hidden=kind==='alert';field.hidden=kind!=='prompt';
    if(kind==='prompt'){root.querySelector('#swDialogLabel').textContent=opts.label||'輸入內容';input.value=opts.value||'';input.placeholder=opts.placeholder||'';input.type=opts.inputType||'text'}
    return new Promise(resolve=>{active={kind,resolve};root.classList.add('show');root.setAttribute('aria-hidden','false');d.body.classList.add('sw-dialog-open');setTimeout(()=>{(kind==='prompt'?input:root.querySelector('#swDialogConfirm')).focus()},50)});
  }
  window.swConfirm=(message,opts={})=>open('confirm',message,opts);
  window.swPrompt=(message,opts={})=>open('prompt',message,opts);
  window.swAlert=(message,opts={})=>open('alert',message,opts);
  window.SignwellDialog={confirm:window.swConfirm,prompt:window.swPrompt,alert:window.swAlert};
  // Any accidental future alert() call uses the designed UI instead of a browser-native box.
  window.alert=(message)=>{void window.swAlert(String(message||''))};
})();
