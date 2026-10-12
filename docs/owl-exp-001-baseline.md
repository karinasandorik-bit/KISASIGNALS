# OWL EXP-001 — frozen EMA baseline and training-label quarantine

Baseline source commit: `8c837c792189d7511a415eb1425000e70531224c` (main at audit). Supabase policy `owl-ema-v1`. This freeze is an **audit reference**, not a claim that trained model weights or historical market features have been cryptographically frozen. The Railway PriceNet `linear-softmax` path is a separate implementation, not interchangeable with `owl-ema-v1`.

Read-only audit 2026-10-12 09:05 UTC cutoff: 64 distinct SHADOW decisions, all NO_TRADE, all quality `UNCALIBRATED_RESEARCH_BASELINE`; 60 EMA12 > EMA26, 4 EMA12 < EMA26; futures_verified true in 1/64. 40 settlements: all `SHADOW_APPROX_HORIZON_UNCALIBRATED`, all without source_evidence_hash and net_estimate_return_pct. Do NOT train on these outcomes as verified execution-profit labels.

## Reproduce read-only audit
```sql
select model_version,action,status,rationale->>'quality' quality,count(*)
from public.owl_signal_market_decisions group by 1,2,3,4;
select count(*) n,count(*) filter (where (rationale->>'ema12')::numeric > (rationale->>'ema26')::numeric) ema_bull,
count(*) filter (where rationale->>'futures_verified'='true') futures_verified
from public.owl_signal_market_decisions;
select evaluation_status,count(*) n,count(*) filter (where source_evidence_hash is null) no_hash,
count(*) filter (where net_estimate_return_pct is null) no_net
from public.owl_signal_settlements group by 1;
```

## Contract
`src/training-data-gate.mjs` enforces fail-closed admissibility for *trade-return supervision*, not for descriptive market forecasting. NO_TRADE records remain valuable for abstention audits, but are NOT negative PnL labels. Missing values are not zero returns. Never convert approximated 15-minute candle close at a nominal 4h horizon into exact execution PnL. Require independent exact-horizon prices, frozen contemporaneous costs, evidence hash, causal time ordering, and approved calibration before acceptance. This first gate is intentionally strict; a future policy revision must be frozen and independently validated rather than silently weakening it.

## Challenger protocol (not yet executed)
Collect clean timestamped OHLCV plus venue-specific derivative data and independent outcomes; freeze feature availability timestamps and market-source lineage; make chronological train/validation/test partitions with horizon-aware embargo. Compare trivial always-abstain/EMA rules to logistic regression, XGBoost and TCN, holding execution assumptions identical; compute net expected return with fees/funding/slippage, trade coverage, drawdown, calibration and block-bootstrap confidence intervals. Never report a backtest as prospective performance. Keep every challenger SHADOW-only until independent prospective promotion.
