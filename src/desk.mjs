import crypto from 'node:crypto';
import {putEvidence} from './ledger.mjs';
import {recordLineage} from './lineage.mjs';
import {runDeskAgents} from './desk-agents.mjs';
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const ALPHA=new Set(['PRICENET','MICROSTRUCTURE','DERIVATIVES','OPPORTUNITY']);
export function aggregateDesk(opinions,{consensus}={}){
 const active=opinions.filter(x=>ALPHA.has(x.agent)&&x.vote!=='ABSTAIN');
 const bull=active.filter(x=>x.vote==='LONG').reduce((s,x)=>s+x.confidence,0);
 const bear=active.filter(x=>x.vote==='SHORT').reduce((s,x)=>s+x.confidence,0);
 const edge=(bull-bear)/(bull+bear||1),skeptic=opinions.find(x=>x.agent==='SKEPTIC');
 let action=Math.abs(edge)>=.22?(edge>0?'LONG':'SHORT'):'NO_TRADE',reason='INDEPENDENT_ALPHA_EDGE';
 if(!consensus?.verified){action='NO_TRADE';reason='FUTURES_CONSENSUS_VETO'}
 if((skeptic?.confidence??0)>=.75){action='NO_TRADE';reason='SKEPTIC_VETO'}
 return {action,reason,edge:+edge.toFixed(4),bull:+bull.toFixed(4),bear:+bear.toFixed(4),alphaAgents:active.map(x=>x.agent)};
}
export async function runDesk({px,consensus,futuresState,context,marketOpportunity,referencePrice,observedAt}){
 const opinions=runDeskAgents({px,consensus,futuresState,context,marketOpportunity});
 const a=aggregateDesk(opinions,{consensus});
 const decision={desk_version:'kisa-desk-v2-market',...a,reference_price:referencePrice,observed_at:observedAt,execution_mode:'SHADOW_ONLY',opinions};
 const id=sha(decision);decision.desk_decision_id=id;await putEvidence('desk_decision',id,decision);decision.lineageHash=await recordLineage('desk_decision',id,decision);return decision;
}
