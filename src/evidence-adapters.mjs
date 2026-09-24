import {putEvidence} from './ledger.mjs';
const timeout=()=>AbortSignal.timeout(8000),get=async(url,headers={})=>{const r=await fetch(url,{headers:{'user-agent':'KISASIGNALS/2.3',...headers},signal:timeout()});if(!r.ok)throw new Error('HTTP_'+r.status);return r.json()};
const row=(channel,symbol,value,source,quality='VERIFIED')=>({event:'EXTERNAL_EVIDENCE',channel,symbol,value,source,quality,observedAt:new Date().toISOString()});
export async function captureExternalEvidence(symbol='BTCUSDT'){
 const asset=symbol.replace(/USDT$/,''),out=[];
 // Liquidations: public futures force-order REST is not assumed. Keep UNKNOWN until a verified provider/stream is configured.
 out.push(row('liquidations',symbol,null,'unconfigured','UNKNOWN'));
 // News: optional CryptoPanic-compatible API; no key means UNKNOWN.
 if(process.env.CRYPTOPANIC_TOKEN){try{const z=await get('https://cryptopanic.com/api/developer/v2/posts/?auth_token='+encodeURIComponent(process.env.CRYPTOPANIC_TOKEN)+'&currencies='+asset);out.push(row('news',symbol,{count:z.results?.length||0},'cryptopanic','VERIFIED'))}catch(e){out.push(row('news',symbol,{error:e.message},'cryptopanic','FAILED'))}}else out.push(row('news',symbol,null,'cryptopanic','UNKNOWN'));
 // X: official recent-search only when explicitly configured.
 if(process.env.X_BEARER_TOKEN){try{const q=encodeURIComponent('('+asset+' OR '+symbol+') lang:en -is:retweet'),z=await get('https://api.x.com/2/tweets/search/recent?query='+q+'&max_results=50&tweet.fields=created_at,public_metrics',{authorization:'Bearer '+process.env.X_BEARER_TOKEN}),texts=(z.data||[]).map(x=>x.text.toLowerCase()),pos=texts.filter(t=>/bull|breakout|buy|long|rally|surge/.test(t)).length,neg=texts.filter(t=>/bear|sell|short|crash|dump|liquidat/.test(t)).length;out.push(row('social',symbol,{posts:texts.length,sentiment:texts.length?(pos-neg)/texts.length:0},'x-api-v2','VERIFIED'))}catch(e){out.push(row('social',symbol,{error:e.message},'x-api-v2','FAILED'))}}else out.push(row('social',symbol,null,'x-api-v2','UNKNOWN'));
 // Fundamental/on-chain adapters require asset-specific semantics; never synthesize zeros.
 out.push(row('fundamental',symbol,null,'unconfigured','UNKNOWN'));out.push(row('onchain',symbol,null,'unconfigured','UNKNOWN'));
 for(const e of out){const id=e.channel+':'+symbol+':'+Math.floor(Date.parse(e.observedAt)/300000);await putEvidence('external_evidence',id,e).catch(()=>{})}
 return out;
}
export function evidenceMap(rows=[]){return Object.fromEntries(rows.map(x=>[x.channel,x]))}
