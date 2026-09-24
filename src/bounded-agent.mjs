// KISASIGNALS bounded execution loop.
// One code path; mode only changes the execution adapter.
// Agent output can never bypass riskConstitution.

import crypto from "node:crypto";

export const MODES = Object.freeze(["SHADOW", "PAPER", "MICRO_LIVE"]);
export const ACTIONS = Object.freeze(["LONG", "SHORT", "WAIT", "ABSTAIN", "MEASURE"]);

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export class ProspectiveLedger {
  constructor({ append }) { this.append = append; }
  async event(runId, type, payload = {}) {
    const e = Object.freeze({ event_id:id(), run_id:runId, type, observed_at:now(), payload });
    await this.append(e);
    return e;
  }
}

export function createRiskConstitution(policy = {}) {
  const p = Object.freeze({
    allowedSymbols: policy.allowedSymbols ?? ["BTCUSDT", "ETHUSDT"],
    maxRiskUsd: policy.maxRiskUsd ?? 1,
    maxNotionalUsd: policy.maxNotionalUsd ?? 25,
    maxLeverage: policy.maxLeverage ?? 1,
    maxDailyLossUsd: policy.maxDailyLossUsd ?? 3,
    maxEvidenceAgeMs: policy.maxEvidenceAgeMs ?? 60_000,
    requireStop: policy.requireStop ?? true,
    maxVenueDisagreementBps: policy.maxVenueDisagreementBps ?? 35,
  });
  return Object.freeze({
    policy:p,
    evaluate(intent, ctx) {
      const deny = [];
      if (!["LONG","SHORT"].includes(intent.action)) deny.push("NON_TRADE_ACTION");
      if (!p.allowedSymbols.includes(intent.symbol)) deny.push("SYMBOL_NOT_ALLOWED");
      if (!(intent.risk_usd > 0 && intent.risk_usd <= p.maxRiskUsd)) deny.push("RISK_LIMIT");
      if (!(intent.notional_usd > 0 && intent.notional_usd <= p.maxNotionalUsd)) deny.push("NOTIONAL_LIMIT");
      if (!(intent.leverage > 0 && intent.leverage <= p.maxLeverage)) deny.push("LEVERAGE_LIMIT");
      if (p.requireStop && !(Number.isFinite(intent.stop) && intent.stop > 0)) deny.push("STOP_REQUIRED");
      if ((ctx.dailyLossUsd ?? 0) >= p.maxDailyLossUsd) deny.push("DAILY_LOSS_LIMIT");
      if ((ctx.venueDisagreementBps ?? Infinity) > p.maxVenueDisagreementBps) deny.push("VENUE_DISAGREEMENT");
      if ((ctx.evidenceAgeMs ?? Infinity) > p.maxEvidenceAgeMs) deny.push("STALE_EVIDENCE");
      return deny.length ? { permitted:false, reasons:deny } :
        { permitted:true, permit:Object.freeze({ permit_id:id(), intent_id:intent.intent_id, issued_at:now(), mode:ctx.mode }) };
    }
  });
}

export function createExecutor({ shadow, paper, microLive }) {
  return async function execute(permit, intent, mode) {
    if (!permit || permit.intent_id !== intent.intent_id) throw new Error("EXECUTION_WITHOUT_VALID_PERMIT");
    if (mode === "SHADOW") return shadow(intent);
    if (mode === "PAPER") return paper(intent);
    if (mode === "MICRO_LIVE") {
      if (process.env.KISA_MICRO_LIVE_ENABLED !== "true") throw new Error("MICRO_LIVE_KILL_SWITCH");
      return microLive(intent);
    }
    throw new Error("UNKNOWN_EXECUTION_MODE");
  };
}

export async function runBoundedCycle({
  mode="SHADOW", perceive, estimateUncertainty, proposeEvidence, acquireEvidence,
  decide, riskConstitution, executor, settle, causalAudit, ledger
}) {
  if (!MODES.includes(mode)) throw new Error("INVALID_MODE");
  const runId=id();
  await ledger.event(runId,"RUN_STARTED",{mode});

  const perception=await perceive();
  await ledger.event(runId,"PERCEPTION_RECORDED",perception);

  const uncertainty=await estimateUncertainty(perception);
  await ledger.event(runId,"UNCERTAINTY_ESTIMATED",uncertainty);

  const d0=await decide({perception, uncertainty, evidence:null});
  await ledger.event(runId,"DECISION_PREREGISTERED",{stage:"D0",decision:d0});

  let evidence=null;
  const proposal=await proposeEvidence({perception,uncertainty,decision:d0});
  if (proposal?.measurement) {
    await ledger.event(runId,"MEASUREMENT_PROPOSED",proposal);
    evidence=await acquireEvidence(proposal);
    await ledger.event(runId,"EVIDENCE_ACQUIRED",evidence);
  }

  const decision= evidence ? await decide({perception,uncertainty,evidence}) : d0;
  await ledger.event(runId,"DECISION_FINAL",{decision,changed:JSON.stringify(decision)!==JSON.stringify(d0)});

  if (!["LONG","SHORT"].includes(decision.action)) {
    await ledger.event(runId,"EXECUTION_SKIPPED",{action:decision.action});
    return {runId,mode,decision,status:decision.action};
  }

  const intent=Object.freeze({...decision,intent_id:id()});
  await ledger.event(runId,"TRADE_INTENT_CREATED",intent);

  const risk=riskConstitution.evaluate(intent,{...perception.risk_context,mode});
  await ledger.event(runId,risk.permitted?"RISK_PERMIT":"RISK_DENIED",risk);
  if (!risk.permitted) return {runId,mode,decision,status:"DENIED",risk};

  const execution=await executor(risk.permit,intent,mode);
  await ledger.event(runId,"EXECUTION_RESULT",execution);

  const outcome=await settle({intent,execution,perception});
  await ledger.event(runId,"WORLD_SETTLED",outcome);

  const audit=await causalAudit({d0,decision,evidence,intent,execution,outcome});
  await ledger.event(runId,"CAUSAL_AUDIT",audit);
  return {runId,mode,decision,execution,outcome,audit,status:"SETTLED"};
}
