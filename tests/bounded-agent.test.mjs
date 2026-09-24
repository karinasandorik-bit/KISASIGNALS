import test from "node:test";
import assert from "node:assert/strict";
import {ProspectiveLedger,createRiskConstitution,createExecutor,runBoundedCycle} from "../src/bounded-agent.mjs";

const base=()=>({perceive:async()=>({risk_context:{dailyLossUsd:0,venueDisagreementBps:2,evidenceAgeMs:10}}),estimateUncertainty:async()=>({score:.2}),proposeEvidence:async()=>null,acquireEvidence:async()=>({}),decide:async()=>({action:"LONG",symbol:"BTCUSDT",risk_usd:1,notional_usd:10,leverage:1,stop:90000}),settle:async()=>({pnl_usd:1}),causalAudit:async()=>({useful:true})});

test("same path executes shadow with permit", async()=>{const ev=[]; const ledger=new ProspectiveLedger({append:async e=>ev.push(e)}); const executor=createExecutor({shadow:async()=>({venue:"shadow"}),paper:async()=>({venue:"paper"}),microLive:async()=>({venue:"live"})}); const r=await runBoundedCycle({...base(),mode:"SHADOW",riskConstitution:createRiskConstitution(),executor,ledger}); assert.equal(r.status,"SETTLED"); assert.ok(ev.some(e=>e.type==="RISK_PERMIT")); assert.ok(ev.some(e=>e.type==="WORLD_SETTLED"));});

test("risk kernel blocks oversized intent", async()=>{const ev=[]; const ledger=new ProspectiveLedger({append:async e=>ev.push(e)}); const b=base(); b.decide=async()=>({action:"LONG",symbol:"BTCUSDT",risk_usd:999,notional_usd:10,leverage:1,stop:90000}); const executor=createExecutor({shadow:async()=>{throw Error("must not execute")},paper:async()=>{},microLive:async()=>{}}); const r=await runBoundedCycle({...b,riskConstitution:createRiskConstitution(),executor,ledger}); assert.equal(r.status,"DENIED"); assert.ok(ev.some(e=>e.type==="RISK_DENIED"));});

test("micro-live is fail-closed without kill-switch enable", async()=>{delete process.env.KISA_MICRO_LIVE_ENABLED; const ex=createExecutor({shadow:async()=>{},paper:async()=>{},microLive:async()=>({})}); await assert.rejects(()=>ex({intent_id:"i"},{intent_id:"i"},"MICRO_LIVE"),/KILL_SWITCH/);});
