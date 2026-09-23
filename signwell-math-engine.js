/* =========================================================
   SIGN WELL · Mathematical Engine · v23.9.90
   Shared numerical primitives for Public + CMS.
   Pure functions only: no network, no DOM writes, no medical claims.
   ========================================================= */
(()=>{
  'use strict';
  if(window.SignWellMath?.version==='23.9.90-STAGING')return;

  const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
  const sum=a=>a.reduce((s,v)=>s+(Number(v)||0),0);
  const mean=a=>a?.length?sum(a)/a.length:0;

  function trigMap(x){return Math.sin(clamp(x,-1,1)*Math.PI/2)}
  function cubicBlend(x,linearWeight=.65){
    x=clamp(x,-1,1); const w=clamp(linearWeight,0,1);
    return w*x+(1-w)*x*x*x;
  }
  function springStep(position,velocity,target,dt,stiffness,damping,mass=1){
    dt=clamp(dt||1/60,1/240,1/30); mass=Math.max(.001,Number(mass)||1);
    const acceleration=((target-position)*(Number(stiffness)||0)-velocity*(Number(damping)||0))/mass;
    velocity+=acceleration*dt;
    position+=velocity*dt;
    return{position,velocity,acceleration};
  }
  function glowFromVelocity(v,reference=1500){const r=Math.abs(Number(v)||0)/Math.max(1,reference);return clamp(r*r,0,1)}
  function hotScore(engagement,age,lambda=.08){return Math.log1p(Math.max(0,Number(engagement)||0))*Math.exp(-Math.max(0,Number(lambda)||0)*Math.max(0,Number(age)||0))}
  function sigmoid(x){x=clamp(x,-60,60);return 1/(1+Math.exp(-x))}
  function entropy(probabilities,base=Math.E){
    const vals=(probabilities||[]).map(v=>Math.max(0,Number(v)||0));
    const total=sum(vals); if(!total)return 0;
    const denom=Math.log(base>1?base:Math.E);
    return -vals.reduce((h,v)=>{if(!v)return h;const p=v/total;return h+p*(Math.log(p)/denom)},0);
  }
  function softmax(values,temperature=1){
    const a=(values||[]).map(Number); if(!a.length)return[];
    const t=Math.max(.001,Number(temperature)||1),m=Math.max(...a);
    const e=a.map(v=>Math.exp((v-m)/t)),d=sum(e)||1; return e.map(v=>v/d);
  }
  function cosineSimilarity(a,b){
    const n=Math.min(a?.length||0,b?.length||0); if(!n)return 0;
    let dot=0,aa=0,bb=0; for(let i=0;i<n;i++){const x=Number(a[i])||0,y=Number(b[i])||0;dot+=x*y;aa+=x*x;bb+=y*y}
    return aa&&bb?dot/Math.sqrt(aa*bb):0;
  }
  function ema(previous,value,alpha=.2){alpha=clamp(alpha,0,1);return Number.isFinite(previous)?alpha*value+(1-alpha)*previous:Number(value)||0}
  function percentile(values,p=.5){
    const a=(values||[]).map(Number).filter(Number.isFinite).sort((x,y)=>x-y); if(!a.length)return 0;
    p=clamp(p,0,1); const i=(a.length-1)*p,lo=Math.floor(i),hi=Math.ceil(i); return lo===hi?a[lo]:a[lo]+(a[hi]-a[lo])*(i-lo);
  }
  function variance(values,sample=true){
    const a=(values||[]).map(Number).filter(Number.isFinite); const n=a.length; if(!n||sample&&n<2)return 0;
    const m=mean(a); return a.reduce((s,v)=>s+(v-m)*(v-m),0)/(sample?n-1:n);
  }
  function sampleSD(values){return Math.sqrt(variance(values,true))}
  function zScore(value,mu,sd){sd=Number(sd)||0;return sd?(Number(value)-Number(mu))/sd:0}
  function bayesUpdate(prior,likelihoodRatio){
    const p=clamp(prior,.000001,.999999),lr=Math.max(0,Number(likelihoodRatio)||0),odds=p/(1-p),posteriorOdds=odds*lr;
    return posteriorOdds/(1+posteriorOdds);
  }
  function stableHash(value){
    const s=String(value??''); let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
    return h>>>0;
  }
  function stableBucket(value,n=100){n=Math.max(1,Math.floor(Number(n)||100));return stableHash(value)%n}
  function combination(n,r){n=Math.floor(n);r=Math.floor(r);if(r<0||n<0||r>n)return 0;r=Math.min(r,n-r);let x=1;for(let i=1;i<=r;i++)x=x*(n-r+i)/i;return Math.round(x)}
  function permutation(n,r){n=Math.floor(n);r=Math.floor(r);if(r<0||n<0||r>n)return 0;let x=1;for(let i=0;i<r;i++)x*=n-i;return x}

  window.SignWellMath=Object.freeze({
    version:'23.9.90-STAGING',clamp,mean,variance,sampleSD,zScore,percentile,ema,
    trigMap,cubicBlend,springStep,glowFromVelocity,hotScore,sigmoid,entropy,softmax,
    cosineSimilarity,bayesUpdate,stableHash,stableBucket,combination,permutation
  });
})();
