(()=>{
'use strict';
const root=document.documentElement;
const loader=document.getElementById('swPageLoader');
if(!loader)return;
const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
if(!loader.dataset.swUpgraded){
  loader.dataset.swUpgraded='1';
  loader.setAttribute('role','status');
  loader.setAttribute('aria-live','polite');
  loader.setAttribute('aria-label','頁面載入進度');
  loader.innerHTML=`
    <div class="sw-page-loader-shell">
      <div class="sw-page-loader-hero" aria-hidden="true">
        <div class="sw-page-loader-glow"></div>
        <svg class="sw-page-loader-sw" viewBox="0 0 360 170" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="swLoaderGrad" x1="34" y1="84" x2="326" y2="84" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#5A90E6"/>
              <stop offset="0.45" stop-color="#6B8EDC"/>
              <stop offset="0.72" stop-color="#C08FCF"/>
              <stop offset="1" stop-color="#F0B0C9"/>
            </linearGradient>
          </defs>
          <path class="sw-page-loader-sw-under" d="M78 116C57 116 41 102 41 84C41 67 55 56 79 49C102 42 118 33 118 18C118 9 111 2 98 2C76 2 55 19 46 37"/>
          <path class="sw-page-loader-sw-under" d="M163 30C171 102 182 141 198 141C212 141 221 111 228 66C236 111 246 141 260 141C277 141 290 100 314 22"/>
          <path class="sw-page-loader-sw-stroke sw-page-loader-sw-s" pathLength="1000" d="M78 116C57 116 41 102 41 84C41 67 55 56 79 49C102 42 118 33 118 18C118 9 111 2 98 2C76 2 55 19 46 37"/>
          <path class="sw-page-loader-sw-stroke sw-page-loader-sw-w" pathLength="1000" d="M163 30C171 102 182 141 198 141C212 141 221 111 228 66C236 111 246 141 260 141C277 141 290 100 314 22"/>
        </svg>
      </div>
      <div class="sw-page-loader-brandlock">
        <div class="sw-page-loader-brand">SIGN WELL</div>
        <div class="sw-page-loader-sub">欣緯生醫</div>
      </div>
      <div class="sw-page-loader-track" aria-hidden="true"><i class="sw-page-loader-bar"></i></div>
      <div class="sw-page-loader-meta"><span class="sw-page-loader-stage">準備歡迎畫面</span><strong class="sw-page-loader-pct">6%</strong></div>
    </div>`;
}
root.classList.add('sw-page-loading');
const bar=loader.querySelector('.sw-page-loader-bar');
const pct=loader.querySelector('.sw-page-loader-pct');
const stage=loader.querySelector('.sw-page-loader-stage');
let current=6,target=12,last=performance.now(),done=false,hideTimer=0;
const set=(value,label)=>{target=Math.max(target,Math.min(100,Number(value)||0));if(label&&stage)stage.textContent=label};
const finish=()=>{if(done)return;done=true;set(100,'歡迎完成')};
function tick(now){
  const dt=Math.min(48,Math.max(8,now-last));last=now;
  const gap=target-current;
  const gain=target>=100?Math.max(.18,Math.min(.34,dt/72)):Math.max(.055,Math.min(.14,dt/150));
  current+=gap*gain;
  if(target<100&&gap>.08)current+=Math.min(.055*dt,gap*.08);
  if(target>=100&&100-current<.22)current=100;
  const shown=Math.max(0,Math.min(100,current));
  if(bar)bar.style.transform=`scaleX(${(shown/100).toFixed(4)})`;
  if(pct)pct.textContent=`${Math.round(shown)}%`;
  if(done&&shown>=100){
    if(!hideTimer)hideTimer=setTimeout(()=>{loader.classList.add('is-done');root.classList.remove('sw-page-loading');setTimeout(()=>loader.remove(),420)},reduced?40:200);
    return;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
set(18,'繪製 SW 筆畫');
const phaseTimer=setInterval(()=>{
  if(done){clearInterval(phaseTimer);return}
  if(target<34)set(34,'建立頁面結構');
  else if(target<52)set(52,'載入樣式與元件');
  else if(target<68)set(68,'準備互動功能');
  else if(target<82)set(82,'整理頁面內容');
  else clearInterval(phaseTimer)
},220);
document.addEventListener('readystatechange',()=>{if(document.readyState==='interactive')set(72,'初始化頁面功能');if(document.readyState==='complete')set(94,'整理畫面')});
document.addEventListener('DOMContentLoaded',()=>set(84,'準備完成，正在歡迎'),{once:true});
if('PerformanceObserver' in window){
  try{
    let seen=0;
    const po=new PerformanceObserver(list=>{seen+=list.getEntries().length;if(!done)set(Math.min(88,24+seen*2.2),'載入頁面資源')});
    po.observe({type:'resource',buffered:true});
    window.addEventListener('load',()=>setTimeout(()=>po.disconnect(),320),{once:true});
  }catch(_){}
}
window.addEventListener('load',()=>{set(96,'完成最後設定');requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(finish,110)))},{once:true});
setTimeout(()=>{if(!done)set(92,'等待頁面完成')},2400);
setTimeout(finish,7600);
window.signwellPageProgress={set:(v,label)=>set(v,label),complete:finish};
})();
