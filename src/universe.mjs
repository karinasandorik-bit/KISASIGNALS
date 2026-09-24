const BASE=process.env.BINANCE_SPOT_BASE_URL||'https://api.binance.com';
const j=async u=>{const r=await fetch(u,{headers:{'user-agent':'KISASIGNALS/2.2'}});if(!r.ok)throw new Error('HTTP '+r.status+' '+u);return r.json()};
const ret=(a,b)=>a>0?10000*(b/a-1):0;
export async function scanUniverse({limit=80}={}){
 const [info,ticks]=await Promise.all([j(BASE+'/api/v3/exchangeInfo'),j(BASE+'/api/v3/ticker/24hr')]);
 const allowed=new Set(info.symbols.filter(x=>x.status==='TRADING'&&x.quoteAsset==='USDT'&&x.isSpotTradingAllowed!==false).map(x=>x.symbol));
 const liquid=ticks.filter(x=>allowed.has(x.symbol)&&Number(x.quoteVolume)>0).sort((a,b)=>Number(b.quoteVolume)-Number(a.quoteVolume)).slice(0,limit);
 const out=await Promise.all(liquid.map(async t=>{try{const k=await j(BASE+'/api/v3/klines?symbol='+encodeURIComponent(t.symbol)+'&interval=1h&limit=25'),cl=k.map(x=>Number(x[4])),hi=k.map(x=>Number(x[2])),lo=k.map(x=>Number(x[3])),r1=ret(cl.at(-2),cl.at(-1)),r4=ret(cl.at(-5),cl.at(-1)),r24=ret(cl[0],cl.at(-1)),rv=Math.sqrt(k.slice(-12).reduce((s,x,i,a)=>i?s+Math.pow(ret(Number(a[i-1][4]),Number(x[4])),2):s,0)/11),range=10000*(Math.max(...hi.slice(-6))-Math.min(...lo.slice(-6)))/cl.at(-1),score=.42*r4+.18*r1+.20*r24-.20*Math.sign(r4)*rv,side=Math.abs(score)<18?'WATCH':score>0?'LONG_BIAS':'SHORT_BIAS';return{symbol:t.symbol,price:Number(t.lastPrice),quoteVolume24h:Number(t.quoteVolume),change24h:Number(t.priceChangePercent),r1Bps:r1,r4Bps:r4,r24Bps:r24,rvBps:rv,range6hBps:range,score:+score.toFixed(2),side,source:'binance-spot-public',observedAt:new Date().toISOString()}}catch(e){return null}}));
 return out.filter(Boolean).sort((a,b)=>Math.abs(b.score)-Math.abs(a.score));
}