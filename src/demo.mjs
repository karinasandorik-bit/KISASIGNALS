import {makePrediction,settle,metrics} from './kernel.mjs';
const f={pUp:.64,pDown:.21,pRange:.15,mfe10:45,mfe50:105,mfe90:210,mae10:18,mae50:42,mae90:82};
const p=makePrediction({ts:'2026-09-24T12:00:00Z',modelVersion:'PriceNet-linear-v1',features:[.1,.2,.3,.4,.5,.6,.7],forecast:f,equity:1000});
const s=settle(p,{returnBps:88,realizedMfeBps:121,realizedMaeBps:31});
console.log(JSON.stringify({prediction:s,metrics:metrics([s])},null,2));
