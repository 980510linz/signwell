/* SIGN WELL · canonical Public service worker
   Stable filenames, network-first code/data, image/font SWR. */
const SW_PUBLIC_CACHE_PREFIX='signwell-public-';
const SW_PUBLIC_CACHE=SW_PUBLIC_CACHE_PREFIX+'canonical-r3';
const SW_PUBLIC_SHELL=[
  './','./index.html','./topics.html','./about.html','./share.html','./newsletter.html',
  './manifest.webmanifest','./site-content.js','./analytics-config.js',
  './assets/public-core.css','./assets/public-core.js',
  './assets/uiux-system.css','./assets/uiux-system.js',
  './assets/bundles/public-liquid-navigation.js','./assets/bundles/article-id-card.js',
  './assets/components/styles/public-liquid-dock.css','./assets/components/styles/article-id-card.css'
];
const swPublicUrl=p=>new URL(p,self.location.href).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(SW_PUBLIC_CACHE);
  await Promise.allSettled(SW_PUBLIC_SHELL.map(async p=>{try{const r=await fetch(swPublicUrl(p),{cache:'reload'});if(r.ok)await cache.put(swPublicUrl(p),r.clone())}catch(_){}}));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(n=>n.startsWith(SW_PUBLIC_CACHE_PREFIX)&&n!==SW_PUBLIC_CACHE).map(n=>caches.delete(n)));
  await self.clients.claim();
})()));
async function networkFirst(req){
  const cache=await caches.open(SW_PUBLIC_CACHE);
  try{const r=await fetch(req,{cache:'no-cache'});if(r&&r.ok)await cache.put(req,r.clone());return r}
  catch(err){const hit=await cache.match(req);if(hit)return hit;throw err}
}
async function swr(req){
  const cache=await caches.open(SW_PUBLIC_CACHE),hit=await cache.match(req);
  const fresh=fetch(req).then(r=>{if(r&&r.ok)cache.put(req,r.clone());return r}).catch(()=>null);
  return hit||fresh||Response.error();
}
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url),scopePath=new URL('./',self.location.href).pathname;
  if(url.origin!==self.location.origin||!url.pathname.startsWith(scopePath))return;
  if(req.mode==='navigate'||req.destination==='document'){event.respondWith(networkFirst(req));return}
  if(['script','style'].includes(req.destination)||/\.(?:json|xml|webmanifest)$/i.test(url.pathname)){event.respondWith(networkFirst(req));return}
  if(['image','font'].includes(req.destination)){event.respondWith(swr(req));}
});
