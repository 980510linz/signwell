/* SIGN WELL · Anatomy Link v23.9.96
   Controlled anatomy term mapping + lazy procedural 3D viewer.
   Three.js is loaded only when the user opens the viewer. */
(function(){
  'use strict';

  const VERSION='23.9.96-STAGING';
  const THREE_URL='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  const reduceMotion=()=>!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const REGISTRY=Object.freeze({
    heart:{label:'心臟',system:'心血管',terms:['心臟','heart','心肌','myocard'],kind:'heart',focus:[0,.35,0]},
    lad:{label:'左前降支（LAD）',system:'冠狀動脈',terms:['LAD','左前降支','left anterior descending'],kind:'lad',focus:[-.08,.38,.28]},
    rca:{label:'右冠狀動脈（RCA）',system:'冠狀動脈',terms:['RCA','右冠狀動脈','right coronary artery'],kind:'rca',focus:[.22,.35,.16]},
    lcx:{label:'左迴旋支（LCX）',system:'冠狀動脈',terms:['LCX','左迴旋支','left circumflex'],kind:'lcx',focus:[-.23,.42,.08]},
    lv_anterior_wall:{label:'左心室前壁',system:'心臟',terms:['左心室前壁','LV anterior wall','anterior wall of left ventricle'],kind:'lvwall',focus:[-.12,.26,.34]},
    lung:{label:'肺臟',system:'呼吸',terms:['肺臟','肺部','lung','肺癌','肺炎'],kind:'lung',focus:[0,.48,0]},
    rul:{label:'右上肺葉',system:'呼吸',terms:['右上肺葉','RUL','right upper lobe'],kind:'rul',focus:[.28,.68,.02]},
    lul:{label:'左上肺葉',system:'呼吸',terms:['左上肺葉','LUL','left upper lobe'],kind:'lul',focus:[-.28,.68,.02]},
    brain:{label:'腦',system:'神經',terms:['腦部','大腦','brain','顱內','腦瘤','腦腫瘤','腦轉移'],kind:'brain',focus:[0,1.62,0]},
    frontal_lobe:{label:'額葉',system:'神經',terms:['額葉','frontal lobe'],kind:'frontal',focus:[0,1.66,.22]},
    temporal_lobe:{label:'顳葉',system:'神經',terms:['顳葉','temporal lobe'],kind:'temporal',focus:[.34,1.54,0]},
    parietal_lobe:{label:'頂葉',system:'神經',terms:['頂葉','parietal lobe'],kind:'parietal',focus:[0,1.78,0]},
    occipital_lobe:{label:'枕葉',system:'神經',terms:['枕葉','occipital lobe'],kind:'occipital',focus:[0,1.62,-.24]},
    cerebellum:{label:'小腦',system:'神經',terms:['小腦','cerebellum'],kind:'cerebellum',focus:[0,1.38,-.16]},
    liver:{label:'肝臟',system:'消化',terms:['肝臟','肝癌','肝硬化','liver','hepatic'],kind:'liver',focus:[.22,.03,.02]},
    pancreas:{label:'胰臟',system:'消化',terms:['胰臟','胰腺','胰臟癌','胰腺癌','pancreas','pancreatic'],kind:'pancreas',focus:[0,-.12,.08]},
    stomach:{label:'胃',system:'消化',terms:['胃部','胃癌','stomach','gastric'],kind:'stomach',focus:[-.2,.0,.02]},
    colon:{label:'大腸',system:'消化',terms:['大腸','結腸','直腸','colorectal','colon','rectum'],kind:'colon',focus:[0,-.42,.05]},
    kidney:{label:'腎臟',system:'泌尿',terms:['腎臟','腎癌','kidney','renal'],kind:'kidney',focus:[0,-.18,-.08]},
    thyroid:{label:'甲狀腺',system:'內分泌',terms:['甲狀腺','thyroid'],kind:'thyroid',focus:[0,1.02,.16]},
    breast:{label:'乳房',system:'乳房',terms:['乳房','乳癌','breast'],kind:'breast',focus:[0,.64,.3]},
    prostate:{label:'攝護腺',system:'泌尿',terms:['攝護腺','前列腺','prostate'],kind:'prostate',focus:[0,-.72,.04]},
    bladder:{label:'膀胱',system:'泌尿',terms:['膀胱','bladder'],kind:'bladder',focus:[0,-.63,.06]},
    uterus:{label:'子宮',system:'婦科',terms:['子宮','uterus','uterine'],kind:'uterus',focus:[0,-.64,.04]}
  });

  const specificity=['lad','rca','lcx','lv_anterior_wall','rul','lul','frontal_lobe','temporal_lobe','parietal_lobe','occipital_lobe','cerebellum','heart','lung','brain','liver','pancreas','stomach','colon','kidney','thyroid','breast','prostate','bladder','uterus'];

  function cleanText(v){
    const d=document.createElement('div');d.innerHTML=String(v||'');
    return (d.textContent||'').replace(/\s+/g,' ').trim();
  }

  function infer(article,root=document){
    if(article?.anatomy?.enabled===false)return [];
    const declared=Array.isArray(article?.anatomy?.targets)?article.anatomy.targets:[];
    const validDeclared=declared.map(x=>({id:String(x?.id||''),terms:Array.isArray(x?.matchedTerms)?x.matchedTerms:[]})).filter(x=>REGISTRY[x.id]);
    if(validDeclared.length)return validDeclared.slice(0,4);

    const body=root.querySelector?.('.article-body,.article')?.textContent||'';
    const hay=[article?.title,article?.summary10s,article?.excerpt,cleanText(article?.content||article?.contentHtml||''),body].filter(Boolean).join(' ');
    const lower=hay.toLowerCase();
    const hits=[];
    for(const id of specificity){
      const item=REGISTRY[id];
      const matched=item.terms.filter(t=>lower.includes(String(t).toLowerCase()));
      if(matched.length)hits.push({id,terms:matched});
      if(hits.length>=4)break;
    }
    return hits;
  }

  function el(tag,cls,html){const n=document.createElement(tag);if(cls)n.className=cls;if(html!==undefined)n.innerHTML=html;return n}
  function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

  let threePromise=null;
  function loadThree(){
    if(window.THREE)return Promise.resolve(window.THREE);
    if(threePromise)return threePromise;
    threePromise=new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src=THREE_URL;s.async=true;s.crossOrigin='anonymous';
      s.onload=()=>window.THREE?resolve(window.THREE):reject(new Error('THREE unavailable'));
      s.onerror=()=>reject(new Error('3D engine load failed'));document.head.appendChild(s);
    });
    return threePromise;
  }

  function baseMaterial(T,color,opacity=.9){return new T.MeshStandardMaterial({color,roughness:.55,metalness:.02,transparent:opacity<1,opacity,depthWrite:opacity>=1})}
  function ellipsoid(T,scene,scale,pos,color,opacity=.92){const g=new T.SphereGeometry(1,36,24),m=baseMaterial(T,color,opacity),o=new T.Mesh(g,m);o.scale.set(...scale);o.position.set(...pos);scene.add(o);return o}
  function tube(T,scene,points,color,r=.035){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const g=new T.TubeGeometry(curve,48,r,10,false);const o=new T.Mesh(g,baseMaterial(T,color,1));scene.add(o);return o}

  function buildBody(T,scene){
    const ghost=new T.MeshStandardMaterial({color:0xdbeaf3,transparent:true,opacity:.12,roughness:.85,depthWrite:false,wireframe:false});
    ellipsoid(T,scene,[.48,.72,.28],[0,.35,0],0xdbeaf3,.10).material=ghost;
    ellipsoid(T,scene,[.30,.34,.29],[0,1.43,0],0xdbeaf3,.10).material=ghost;
    const lineMat=new T.LineBasicMaterial({color:0x90a8b7,transparent:true,opacity:.18});
    const geo=new T.EdgesGeometry(new T.SphereGeometry(1,20,14));const wire=new T.LineSegments(geo,lineMat);wire.scale.set(.48,.72,.28);wire.position.set(0,.35,0);scene.add(wire);
    const wire2=new T.LineSegments(geo.clone(),lineMat.clone());wire2.scale.set(.30,.34,.29);wire2.position.set(0,1.43,0);scene.add(wire2);
  }

  function addHeart(T,scene,color=0xdb7a87){
    const g=new T.Group();scene.add(g);
    const a=ellipsoid(T,g,[.19,.24,.16],[-.08,.38,.05],color),b=ellipsoid(T,g,[.17,.22,.15],[.09,.38,.05],color);
    a.rotation.z=.28;b.rotation.z=-.28;ellipsoid(T,g,[.18,.22,.16],[0,.22,.05],color);return g;
  }

  function buildTarget(T,scene,id){
    buildBody(T,scene);const item=REGISTRY[id]||REGISTRY.heart;const c=0xff6f91;
    switch(item.kind){
      case 'heart': addHeart(T,scene); break;
      case 'lad':{addHeart(T,scene,0xc97882);tube(T,scene,[[-.03,.52,.20],[-.06,.42,.24],[-.08,.30,.26],[-.10,.18,.22]],c,.026);break}
      case 'rca':{addHeart(T,scene,0xc97882);tube(T,scene,[[.03,.51,.18],[.18,.45,.17],[.23,.35,.12],[.19,.24,.07]],c,.026);break}
      case 'lcx':{addHeart(T,scene,0xc97882);tube(T,scene,[[-.02,.51,.16],[-.14,.49,.08],[-.24,.43,.02],[-.22,.32,-.02]],c,.026);break}
      case 'lvwall':{addHeart(T,scene,0xc97882);ellipsoid(T,scene,[.07,.13,.025],[-.11,.27,.20],c,1);break}
      case 'lung':case 'rul':case 'lul':{
        ellipsoid(T,scene,[.22,.43,.15],[-.25,.55,0],0x9bc7dc,.86);ellipsoid(T,scene,[.22,.43,.15],[.25,.55,0],0x9bc7dc,.86);
        if(item.kind==='rul')ellipsoid(T,scene,[.19,.18,.16],[.25,.75,.05],c,1);
        if(item.kind==='lul')ellipsoid(T,scene,[.19,.18,.16],[-.25,.75,.05],c,1);
        break;
      }
      case 'brain':case 'frontal':case 'temporal':case 'parietal':case 'occipital':case 'cerebellum':{
        ellipsoid(T,scene,[.27,.22,.25],[0,1.48,0],0xd7b7df,.9);
        const p={frontal:[0,1.52,.20],temporal:[.22,1.43,.05],parietal:[0,1.63,.02],occipital:[0,1.49,-.20],cerebellum:[0,1.30,-.14]}[item.kind];
        if(p)ellipsoid(T,scene,[.13,.10,.08],p,c,1);break;
      }
      case 'liver': ellipsoid(T,scene,[.34,.18,.17],[.20,.02,.04],0xc67b62,1);break;
      case 'pancreas':{const g=T.CapsuleGeometry?new T.CapsuleGeometry(.05,.34,8,16):new T.CylinderGeometry(.05,.07,.42,20);const o=new T.Mesh(g,baseMaterial(T,c,1));o.rotation.z=Math.PI/2;o.position.set(0,-.12,.11);scene.add(o);break}
      case 'stomach':{const o=ellipsoid(T,scene,[.18,.27,.13],[-.18,-.03,.07],0xdfa878,1);o.rotation.z=-.45;break}
      case 'colon':{const pts=[[-.25,-.24,.05],[-.32,-.42,.05],[-.15,-.55,.05],[.18,-.55,.05],[.32,-.40,.05],[.25,-.24,.05]];tube(T,scene,pts,c,.055);break}
      case 'kidney': ellipsoid(T,scene,[.12,.20,.08],[-.25,-.20,-.02],c,1);ellipsoid(T,scene,[.12,.20,.08],[.25,-.20,-.02],c,1);break;
      case 'thyroid': ellipsoid(T,scene,[.09,.13,.05],[-.08,1.03,.17],c,1);ellipsoid(T,scene,[.09,.13,.05],[.08,1.03,.17],c,1);break;
      case 'breast': ellipsoid(T,scene,[.16,.15,.09],[-.20,.62,.25],c,.95);ellipsoid(T,scene,[.16,.15,.09],[.20,.62,.25],c,.95);break;
      case 'prostate': ellipsoid(T,scene,[.11,.08,.08],[0,-.71,.06],c,1);break;
      case 'bladder': ellipsoid(T,scene,[.15,.14,.11],[0,-.58,.05],c,1);break;
      case 'uterus':{const o=ellipsoid(T,scene,[.14,.18,.09],[0,-.56,.05],c,1);o.rotation.z=Math.PI;break}
      default: addHeart(T,scene);
    }
  }

  function fallbackGraphic(box,item){
    box.innerHTML='<div class="sw-anatomy-fallback"><div class="sw-anatomy-body-icon" aria-hidden="true"><i></i><b></b><span></span></div><strong>'+escapeHTML(item.label)+'</strong><small>3D 引擎目前未載入，仍保留解剖位置提示。</small></div>';
  }

  function render3D(box,id){
    const item=REGISTRY[id]||REGISTRY.heart;box.innerHTML='<div class="sw-anatomy-loading"><i></i><span>建立 3D 解剖定位…</span></div>';
    return loadThree().then(T=>{
      box.innerHTML='';const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.1,100);camera.position.set(0,.38,4.5);
      const renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.outputEncoding=T.sRGBEncoding;box.appendChild(renderer.domElement);
      scene.add(new T.HemisphereLight(0xffffff,0x78909c,1.4));const key=new T.DirectionalLight(0xffffff,1.1);key.position.set(3,4,5);scene.add(key);const fill=new T.DirectionalLight(0xaad8ff,.6);fill.position.set(-3,2,2);scene.add(fill);
      const group=new T.Group();scene.add(group);buildTarget(T,group,id);
      const target=REGISTRY[id]?.focus||[0,.35,0];group.position.set(-target[0]*.18,-target[1]*.12,0);group.rotation.y=-.16;
      let raf=0,active=true,drag=false,lastX=0,rotY=-.16;
      const resize=()=>{const w=Math.max(260,box.clientWidth||320),h=Math.max(300,box.clientHeight||420);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};resize();
      const ro=new ResizeObserver(resize);ro.observe(box);
      const tick=()=>{if(!active)return;if(!drag&&!reduceMotion())rotY+=.0018;group.rotation.y+=(rotY-group.rotation.y)*.08;renderer.render(scene,camera);raf=requestAnimationFrame(tick)};tick();
      const down=e=>{drag=true;lastX=e.clientX;box.setPointerCapture?.(e.pointerId)};
      const move=e=>{if(!drag)return;rotY+=(e.clientX-lastX)*.009;lastX=e.clientX};
      const up=()=>{drag=false};box.addEventListener('pointerdown',down);box.addEventListener('pointermove',move);box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
      return ()=>{active=false;cancelAnimationFrame(raf);ro.disconnect();box.removeEventListener('pointerdown',down);box.removeEventListener('pointermove',move);box.removeEventListener('pointerup',up);box.removeEventListener('pointercancel',up);renderer.dispose();renderer.forceContextLoss?.();};
    }).catch(()=>{fallbackGraphic(box,item);return ()=>{}});
  }

  let activeCleanup=null;
  function closeViewer(){document.querySelector('.sw-anatomy-overlay')?.remove();document.body.classList.remove('sw-anatomy-open');try{activeCleanup?.()}catch(_){}activeCleanup=null}
  function openViewer(id){
    closeViewer();const item=REGISTRY[id];if(!item)return;
    const ov=el('div','sw-anatomy-overlay');
    ov.innerHTML='<section class="sw-anatomy-panel" role="dialog" aria-modal="true" aria-label="3D 解剖定位"><header><div><small>AI ANATOMY LINK · 3D</small><h2>'+escapeHTML(item.label)+'</h2><p>'+escapeHTML(item.system)+' · 文章解剖位置示意</p></div><button type="button" class="sw-anatomy-close" aria-label="關閉">×</button></header><div class="sw-anatomy-stage" data-stage></div><footer><span>拖曳可旋轉</span><b>示意定位，不代表個人影像或診斷</b></footer></section>';
    document.body.appendChild(ov);document.body.classList.add('sw-anatomy-open');
    ov.addEventListener('click',e=>{if(e.target===ov||e.target.closest('.sw-anatomy-close'))closeViewer()});
    const esc=e=>{if(e.key==='Escape'){closeViewer();document.removeEventListener('keydown',esc)}};document.addEventListener('keydown',esc);
    render3D(ov.querySelector('[data-stage]'),id).then(fn=>activeCleanup=fn);
  }

  function wrapTerms(container,targets){
    if(!container||container.dataset.swAnatomyLinked==='1')return;
    container.dataset.swAnatomyLinked='1';
    const terms=[];targets.forEach(t=>{const r=REGISTRY[t.id];(t.terms?.length?t.terms:r.terms).forEach(x=>terms.push({text:String(x),id:t.id}))});
    terms.sort((a,b)=>b.text.length-a.text.length);
    const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT,{acceptNode:n=>{
      const p=n.parentElement;if(!p||p.closest('a,button,code,pre,script,style,.refs,.sw-anatomy-term'))return NodeFilter.FILTER_REJECT;
      const s=n.nodeValue||'';return terms.some(t=>s.toLowerCase().includes(t.text.toLowerCase()))?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;
    }});const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{let text=n.nodeValue||'',frag=document.createDocumentFragment(),changed=false;while(text){let best=null,idx=-1;for(const t of terms){const i=text.toLowerCase().indexOf(t.text.toLowerCase());if(i>=0&&(idx<0||i<idx)){idx=i;best=t}}if(!best){frag.appendChild(document.createTextNode(text));break}if(idx>0)frag.appendChild(document.createTextNode(text.slice(0,idx)));const b=el('button','sw-anatomy-term');b.type='button';b.dataset.anatomyId=best.id;b.textContent=text.slice(idx,idx+best.text.length);b.title='開啟 3D 解剖定位';frag.appendChild(b);text=text.slice(idx+best.text.length);changed=true}if(changed)n.parentNode.replaceChild(frag,n)});
    container.addEventListener('click',e=>{const b=e.target.closest?.('.sw-anatomy-term');if(b)openViewer(b.dataset.anatomyId)});
  }

  function mountArticle(article,root=document){
    const targets=infer(article,root);if(!targets.length)return {mounted:false,targets:[]};
    const view=root.querySelector?.('.article-view')||root.querySelector?.('.article-shell')||document.querySelector('.article-view,.article-shell');
    const body=root.querySelector?.('.article-body,.article')||document.querySelector('.article-body,.article');if(!body)return {mounted:false,targets};
    if(view?.querySelector?.('.sw-anatomy-entry'))return {mounted:true,targets};
    const card=el('section','sw-anatomy-entry');
    card.innerHTML='<div class="sw-anatomy-entry-copy"><small>AI ANATOMY LINK</small><h2>這篇文章有可定位的解剖位置</h2><p>根據文章中的器官與部位詞彙建立 3D 示意。點選位置查看；不會把一般醫療名詞硬套成模型。</p></div><div class="sw-anatomy-chips">'+targets.map((t,i)=>'<button type="button" data-anatomy-open="'+escapeHTML(t.id)+'"'+(i===0?' class="primary"':'')+'>'+escapeHTML(REGISTRY[t.id].label)+'</button>').join('')+'</div>';
    const anchor=view?.querySelector?.('.article-layout')||body;anchor?.parentNode?.insertBefore(card,anchor);
    card.addEventListener('click',e=>{const b=e.target.closest?.('[data-anatomy-open]');if(b)openViewer(b.dataset.anatomyOpen)});
    wrapTerms(body,targets);
    return {mounted:true,targets};
  }

  window.SignWellAnatomy=Object.freeze({version:VERSION,registry:REGISTRY,infer,mountArticle,openViewer,closeViewer});
  if(window.SIGNWELL_STATIC_ARTICLE){queueMicrotask(()=>mountArticle(window.SIGNWELL_STATIC_ARTICLE,document))}
  else{queueMicrotask(()=>{if(document.querySelector('.article-view'))mountArticle({},document)})}
})();
