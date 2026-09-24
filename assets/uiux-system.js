(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
let progress=null,progressBar=null,rail=null,observer=null;

function ensureReadingChrome(){
  if(!progress){
    progress=document.createElement('div');progress.className='sw-reading-progress';progress.setAttribute('aria-hidden','true');progress.innerHTML='<i></i>';document.body.appendChild(progress);progressBar=progress.firstElementChild;
  }
  if(!rail){
    rail=document.createElement('div');rail.className='sw-reading-rail';rail.setAttribute('aria-label','文章閱讀工具');rail.innerHTML='<button type="button" data-swux-top aria-label="回到文章頂端">↑</button><button type="button" data-swux-share aria-label="分享這篇文章">↗</button>';document.body.appendChild(rail);
    rail.querySelector('[data-swux-top]').addEventListener('click',()=>window.scrollTo({top:0,behavior:reduced?'auto':'smooth'}));
    rail.querySelector('[data-swux-share]').addEventListener('click',()=>document.querySelector('#articleShare')?.click());
  }
}
function updateReadingProgress(){
  if(!progressBar)return;const article=$('.article-view');if(!article){progress?.classList.remove('is-active');rail?.classList.remove('is-active');progressBar.style.transform='scaleX(0)';return;}
  const body=$('.article-body',article);if(!body)return;progress.classList.add('is-active');rail.classList.toggle('is-active',scrollY>280);
  const start=body.getBoundingClientRect().top+scrollY-innerHeight*.16;const end=start+Math.max(1,body.offsetHeight-innerHeight*.54);const p=Math.max(0,Math.min(1,(scrollY-start)/(end-start)));progressBar.style.transform=`scaleX(${p.toFixed(4)})`;
}
function upgradeInteractiveCards(){
  $$('[data-article],[data-topic]').forEach(el=>{
    if(el.dataset.swuxA11y==='1')return;el.dataset.swuxA11y='1';el.tabIndex=0;el.setAttribute('role','link');
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});
  });
}
function setupReveal(){
  if(reduced)return;
  observer?.disconnect();
  observer=new IntersectionObserver(entries=>entries.forEach(x=>{if(x.isIntersecting){x.target.classList.add('is-visible');observer.unobserve(x.target);}}),{rootMargin:'0px 0px -7% 0px',threshold:.05});
  $$('.hero-card,.article-card,.topic-card,.person-card,.panel,.share-card,.newsletter-card').forEach((el,i)=>{if(el.dataset.swuxReveal==='1')return;el.dataset.swuxReveal='1';el.classList.add('swux-reveal');el.style.transitionDelay=`${Math.min(i,5)*35}ms`;observer.observe(el);});
}
function setupSearchKeyboard(){
  const input=$('#searchInput');if(!input||input.dataset.swuxKeys==='1')return;input.dataset.swuxKeys='1';
  input.addEventListener('keydown',e=>{
    const rows=$$('.search-result','#searchResults');if(!rows.length)return;let i=rows.findIndex(x=>x.classList.contains('active'));
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();rows.forEach(x=>x.classList.remove('active'));i=e.key==='ArrowDown'?Math.min(rows.length-1,i+1):Math.max(0,i<0?rows.length-1:i-1);rows[i].classList.add('active');rows[i].scrollIntoView({block:'nearest'});}
    else if(e.key==='Enter'&&i>=0){e.preventDefault();rows[i].click();}
  });
}
function enhance(){ensureReadingChrome();upgradeInteractiveCards();setupReveal();setupSearchKeyboard();updateReadingProgress();}
let raf=0;addEventListener('scroll',()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;updateReadingProgress();});},{passive:true});
addEventListener('resize',()=>updateReadingProgress(),{passive:true});
const mo=new MutationObserver(()=>{clearTimeout(mo.t);mo.t=setTimeout(enhance,24)});mo.observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
})();
