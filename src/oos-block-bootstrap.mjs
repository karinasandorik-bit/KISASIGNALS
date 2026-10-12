// Paired moving-block bootstrap with deterministic seeded RNG. Diagnostic, not a trading approval.
export function blockBootstrap(candidate,baseline,{blockSize=24,replicates=2000,seed=20261012}={}){
 if(!Array.isArray(candidate)||!candidate.length||candidate.length!==baseline?.length)throw Error('PAIRS_REQUIRED');
 if(!Number.isInteger(blockSize)||blockSize<4||!Number.isInteger(replicates)||replicates<200||!Number.isInteger(seed))throw Error('INVALID_BOOTSTRAP_CONFIG');
 const delta=candidate.map((r,i)=>{
  if(r.id!==baseline[i]?.id||!Number.isFinite(r.netBps)||!Number.isFinite(baseline[i].netBps))throw Error('UNPAIRED_OBSERVATIONS');
  const t=Date.parse(r.signalAt),b=Date.parse(baseline[i].signalAt);
  if(!Number.isFinite(t)||t!==b||(i&&t<=Date.parse(candidate[i-1].signalAt)))throw Error('INVALID_CHRONOLOGY');
  return r.netBps-baseline[i].netBps;
 });
 const n=delta.length,mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
 let x=seed>>>0;const rand=()=>((x^=x<<13,x^=x>>>17,x^=x<<5)>>>0)/4294967296;
 const sample=[];
 for(let k=0;k<replicates;k++){
  let sum=0,count=0;
  while(count<n){const start=Math.floor(rand()*n);for(let j=0;j<blockSize&&count<n;j++,count++)sum+=delta[(start+j)%n]}
  sample.push(sum/n);
 }
 sample.sort((a,b)=>a-b);
 const q=p=>sample[Math.floor(p*(replicates-1))];
 return {n,blockSize,replicates,seed,observedMeanIncrementalNetBps:mean(delta),
  percentile95CI:[q(.025),q(.975)],lower95OneSided:q(.05),
  positiveLowerBound:q(.025)>0,method:'CIRCULAR_MOVING_BLOCK_BOOTSTRAP',
  caveat:'Exploratory conditional interval; overlapping trade exposure, multiple comparisons and nonstationarity require independent review'};
}
