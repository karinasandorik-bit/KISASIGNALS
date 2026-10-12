# OWL EXP-002 — Actual market-to-outcome lineage audit (2026-10-12)

Source: read-only Supabase SQL over public.owl_signal_market_decisions JOIN public.owl_signal_settlements USING(decision_id). Snapshot count during audit: 41 joined records (dataset is live; counts may increase).

## Observed
- 41/41 decision_created_at < outcome_observed_at.
- 41/41 decision.horizon_target_at = settlement.target_at, and outcome_observed_at >= target_at.
- 41/41 action = NO_TRADE; no observed execution.
- 41/41 missing source_evidence_hash and net_estimate_return_pct.
- 41/41 settlement.independent_venue equals decision.reference_venue. It is separate from decision.venue, but **not independent of all contemporaneous reference feeds**.
- settlement.horizon_lag_seconds min=597, max=701, mean=601.8. Outcome is not exact horizon price.

## Reproduce
```sql
select count(*) n,
count(*) filter(where d.decision_created_at < s.outcome_observed_at) prospective,
count(*) filter(where d.horizon_target_at=s.target_at) target_match,
count(*) filter(where s.outcome_observed_at>=s.target_at) after_target,
count(*) filter(where s.independent_venue=d.reference_venue) reused_reference,
count(*) filter(where s.source_evidence_hash is null) no_hash,
count(*) filter(where s.net_estimate_return_pct is null) no_net,
min(s.horizon_lag_seconds) min_lag,max(s.horizon_lag_seconds) max_lag
from public.owl_signal_market_decisions d join public.owl_signal_settlements s using(decision_id);
```

## Gate decision
No real label from this sample qualifies as verified exact-horizon net execution return. Leave training authorization CLOSED. This audit proves relational/temporal consistency only, not authenticity of observed source prices, trading gains, or independent adjudication. A shadow NO_TRADE decision is not an executed trade and should never be assigned trade PnL as ground truth.

## Next falsification protocol
1. Capture raw signed or provider-authenticated exchange observations, request/receive timestamps, market/instrument identity, candle open-close interval, and complete response bytes; commit SHA256 before downstream evaluation.
2. Freeze prediction payload/hash before outcome. Use immutable, separately administered append-only log or externally witnessed timestamp.
3. Use a third independent verification venue or independently authenticated snapshots with input-usage disclosure. Assert independent_venue != reference_venue and != primary venue when requiring source independence.
4. Define settlement horizon precisely (trade, mark, or exact closed candle; do not substitute candle+10min). Store clock skew and source sampling method.
5. Independently recalculate with frozen entry/exit policy, venue and contract denomination, fees, funding, slippage, fill model and uncertainties; persist component-level reconciliation.
6. Have separately credentialed verifier challenge the full dataset, publish signed receipt and never approve a self-issued signature.
7. Pre-register held-out temporal interval before candidate training and reserve adjudication access to verifier.
