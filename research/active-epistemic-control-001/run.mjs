import crypto from "node:crypto";
import fs from "node:fs";

const canonical = x => JSON.stringify(x, Object.keys(x).sort());
const hash = x => crypto.createHash("sha256").update(canonical(x)).digest("hex");

function decide(evidence) {
  const score = evidence.reduce((s,o)=>s + Number(o.signal ?? 0) * Number(o.reliability ?? 1),0);
  if (score >= 1) return "LONG";
  if (score <= -1) return "SHORT";
  return "NO_TRADE";
}
function loss(action, outcome, threshold) {
  const y = outcome.return >= threshold ? "LONG" : outcome.return <= -threshold ? "SHORT" : "FLAT";
  if (action === "NO_TRADE") return y === "FLAT" ? 0 : 1;
  return action === y ? 0 : 2;
}
function fixed(catalogue, budget) {
  const priority=["cross_venue","flow","open_interest","funding","volatility"];
  return [...catalogue].sort((a,b)=>priority.indexOf(a.type)-priority.indexOf(b.type)||a.cost-b.cost).filter(o=>o.cost<=budget);
}
function adaptive(revealed,catalogue,budget) {
  const action=decide(revealed);
  const remaining=catalogue.filter(o=>!revealed.some(r=>r.id===o.id)&&o.cost<=budget);
  const typeValue = action==="NO_TRADE"
    ? {cross_venue:5,flow:4,open_interest:3,volatility:2,funding:1}
    : {cross_venue:5,volatility:4,flow:3,open_interest:2,funding:1};
  return remaining.sort((a,b)=>(typeValue[b.type]??0)/(b.cost)-(typeValue[a.type]??0)/(a.cost)||a.id.localeCompare(b.id))[0];
}
function seededShuffle(catalogue,budget,seed) {
  return [...catalogue].map(o=>({o,k:hash({seed,id:o.id})})).sort((a,b)=>a.k.localeCompare(b.k)).map(x=>x.o).filter(o=>o.cost<=budget);
}
function runArm(task,arm,replayIds=[]) {
  let budget=task.budget, revealed=[], commits=[];
  const meta=task.observations.map(({value,...m})=>m);
  let queue=arm==="A0"?fixed(meta,budget):arm==="SHUFFLE"?seededShuffle(meta,budget,task.id):[];
  while (budget>0) {
    let choice;
    if (arm==="A1") choice=adaptive(revealed,meta,budget);
    else if (arm==="A2") choice=meta.find(o=>o.id===replayIds[revealed.length]&&o.cost<=budget);
    else choice=queue.shift();
    if (!choice || choice.cost>budget) break;
    const commitment={task_id:task.id,arm,step:revealed.length,state_action:decide(revealed),selected_observation:choice.id,cost:choice.cost,budget_before:budget};
    const commitment_hash=hash(commitment);
    const hidden=task.observations.find(o=>o.id===choice.id);
    revealed.push({...choice,...hidden.value});
    budget-=choice.cost;
    commits.push({...commitment,commitment_hash});
  }
  const action=decide(revealed);
  return {arm,action,cost:task.budget-budget,loss:loss(action,task.outcome,task.materiality),selected:commits.map(c=>c.selected_observation),commits};
}
const path=process.argv[2]||"research/active-epistemic-control-001/benchmark.json";
const tasks=JSON.parse(fs.readFileSync(path,"utf8"));
const results=[];
for (const task of tasks) {
  const a1=runArm(task,"A1");
  for (const arm of ["A0","A2","SHUFFLE"]) results.push({task:task.id,...runArm(task,arm,a1.selected)});
  results.push({task:task.id,...a1});
}
const arms=["A0","A1","A2","SHUFFLE"];
const summary=Object.fromEntries(arms.map(a=>{
 const rs=results.filter(r=>r.arm===a), L=rs.reduce((s,r)=>s+r.loss,0), C=rs.reduce((s,r)=>s+r.cost,0);
 return [a,{loss:L,cost:C,J:C?L/C:null}];
}));
const out={experiment:"ACTIVE-EPISTEMIC-CONTROL-001",results,summary,delta_10:(summary.A0.J??0)-(summary.A1.J??0)};
console.log(JSON.stringify(out,null,2));
