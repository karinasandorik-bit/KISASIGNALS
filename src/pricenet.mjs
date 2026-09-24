import fs from 'node:fs';
import crypto from 'node:crypto';
import {validateBars} from './market.mjs';
const MODEL_URL=new URL('../models/pricenet-linear-v1/model.json',import.meta.url);
const CAL_URL=new URL('../models/pricenet-linear-v1/calibration-excursion-v1.json',import.meta.url);
export const EXPECTED_MODEL_SHA256='29f643ecf0bf98dba652aa939f22400c530592418d80b3d6e670c128212c0dda';
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
export function featureVector(b){if(!Array.isArray(b)||b.length<14)throw new Error('PRICENET_NEEDS_14_BARS');validateBars(b);const i=b.length-1,r=n=>Math.log(b[i].c/b[i-n].c),rs=[];for(let j=i-12;j<=i;j++)rs.push(Math.log(b[j].c/b[j-1].c));const m=mean(rs),sd=Math.sqrt(mean(rs.map(x=>(x-m)**2)));return[r(1),r(3),r(6),r(12),sd,(b[i].h-b[i].l)/b[i].c,Math.log((b[i].v+1)/(b[i-6].v+1))]}
export function loadPriceNet(url=MODEL_URL){const raw=fs.readFileSync(url);const sha256=crypto.createHash('sha256').update(raw).digest('hex');if(sha256!==EXPECTED_MODEL_SHA256)throw Error('MODEL_HASH_MISMATCH');return{artifact:JSON.parse(raw),sha256}}
export function loadCalibration(url=CAL_URL){const raw=fs.readFileSync(url);return{artifact:JSON.parse(raw),sha256:crypto.createHash('sha256').update(raw).digest('hex')}}
const softmax=q=>{const mx=Math.max(...q),e=q.map(x=>Math.exp(x-mx)),z=e.reduce((a,b)=>a+b,0);return e.map(x=>x/z)};
const dot=(w,x)=>w.reduce((s,v,j)=>s+v*x[j],0);
const binFor=(side,p,cal)=>{const bins=cal.excursion.sides[side].bins;return bins.find(b=>p>=b.min&&p<b.max)||bins.at(-1)};
export function inferPriceNet(bars){const{artifact,sha256}=loadPriceNet(),{artifact:cal,sha256:calibrationSha256}=loadCalibration(),m=artifact.model,x0=featureVector(bars),x=x0.map((v,j)=>(v-m.featureMean[j])/m.featureStd[j]);const logits=m.weights.map((w,k)=>w.reduce((s,v,j)=>s+v*x[j],m.bias[k]));const T=cal.probabilityCalibration.temperature||1,p=softmax(logits.map(z=>z/T)),entropy=-p.reduce((s,v)=>s+(v?v*Math.log(v):0),0)/Math.log(3),ood=Math.min(1,Math.sqrt(mean(x.map(v=>v*v)))/4),lb=binFor('LONG',p[0],cal),sb=binFor('SHORT',p[1],cal);
return{modelVersion:m.version,modelSha256:sha256,calibrationVersion:cal.version,calibrationSha256,features:x0,pUp:p[0],pDown:p[1],pRange:p[2],uncertainty:entropy,ood,horizonBars:m.horizonBars,thresholdBps:m.thresholdBps,excursions:{LONG:{mfe50:lb.mfe50,mae50:lb.mae50,mae90:lb.mae90,n:lb.n},SHORT:{mfe50:sb.mfe50,mae50:sb.mae50,mae90:sb.mae90,n:sb.n}},legacyExcursion:{mfePointBps:Math.max(0,dot(m.mfeWeights||[],x)),maePointBps:Math.max(0,dot(m.maeWeights||[],x))},calibrationStatus:cal.probabilityCalibration.status,excursionStatus:cal.excursion.status,calibrationDiagnostics:cal.probabilityCalibration.holdout,excursionDiagnostics:{holdoutMae90Coverage:cal.excursion.holdoutMae90Coverage},promotion:cal.promotion}}
