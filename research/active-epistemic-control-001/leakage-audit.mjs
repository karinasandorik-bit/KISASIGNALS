import crypto from "node:crypto";
import fs from "node:fs";
const sha=x=>crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
const file=process.argv[2];
if(!file) throw new Error("usage: node leakage-audit.mjs <benchmark.json>");
const tasks=JSON.parse(fs.readFileSync(file,"utf8"));
const errors=[];
for(const t of tasks){
 if(!t.id||!t.cutoff_at||!t.outcome) errors.push([t?.id,"missing required fields"]);
 const cutoff=Date.parse(t.cutoff_at);
 for(const o of t.observations||[]){
   if(!(o.cost>0)) errors.push([t.id,o.id,"non-positive cost"]);
   if(Date.parse(o.available_at)<cutoff) errors.push([t.id,o.id,"observation precedes cutoff; task semantics require post-cutoff acquisition"]);
   if(o.value && typeof o.value.signal==="number") errors.push([t.id,o.id,"manual signal field forbidden for scientific Trial-1+; use raw fields + frozen transform"]);
 }
}
const report={ok:errors.length===0,n_tasks:tasks.length,errors,manifest_sha256:sha(tasks)};
console.log(JSON.stringify(report,null,2));
if(errors.length) process.exitCode=2;
