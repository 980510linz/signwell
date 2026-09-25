/* SIGN WELL public backend bootstrap · canonical stable filename */
(()=>{'use strict';
  const FALLBACK_ENDPOINT='https://script.google.com/macros/s/AKfycbzmZXZSepxCD1jbfpjMxsnvn0nRl-xEpeXdJoTO-TZL6Z5Zk7T-OsVGpTkIxWaCh-Y/exec';
  const valid=v=>/^https:\/\/script\.google\.com\/macros\/s\/[^\s?#]+\/exec(?:[?#].*)?$/i.test(String(v||'').trim());
  let endpoint=FALLBACK_ENDPOINT;
  try{
    const explicit=String(localStorage.getItem('signwell-backend-endpoint-explicit')||'').trim();
    if(valid(explicit))endpoint=explicit;
    localStorage.setItem('signwell-backend-endpoint',endpoint);
  }catch(_){endpoint=FALLBACK_ENDPOINT}
  window.SIGNWELL_CANONICAL_BACKEND_ENDPOINT=FALLBACK_ENDPOINT;
  const cfg={enabled:valid(endpoint),endpoint,version:'24.36.3',bridgeProtocol:'23.9.92'};
  window.SIGNWELL_BACKEND=Object.assign({},window.SIGNWELL_BACKEND||{},cfg);
  window.SIGNWELL_ANALYTICS=Object.assign({},window.SIGNWELL_ANALYTICS||{},cfg);
  window.SIGNWELL_NEWSLETTER=Object.assign({},window.SIGNWELL_NEWSLETTER||{},cfg);
})();
