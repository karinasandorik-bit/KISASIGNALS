# PRICENET-OOS-001 — pre-registration (research/shadow only)

Status: IMPLEMENTED EVALUATOR COMPONENT; PROSPECTIVE TEST NOT YET EXECUTED.
The existence of this file does not assert edge, verified execution, or production delivery.

## Frozen unit of evaluation
Each UTC hourly decision tick on BTCUSDT is eligible, including NO_TRADE.
Freeze predictionId, feature timestamp, decision timestamp, price/source, feature/data cutoff,
model artifact SHA-256, calibration SHA-256, probabilities, decision, entry/SL/TP,
4h horizon, deterministic input digest, cost schedule and code commit before looking at outcomes.
No deletion or resampling of abstentions, failed forecasts, missing data or losses.
Store append-only in PostgreSQL; export a signed/hash-chained immutable snapshot to the evaluator.

## World and evaluator independence
Evaluator is a separate *read-only* job with separate credentials and no access to the
training pipeline or promotion write permissions.
Obtain independently sourced timestamped CLOSED hourly OHLC plus source evidence.
Do not equate a source name string with verified provenance: independently check collector
credentials, venue response receipts and observation chronology.
Missing, stale, inconsistent, non-consecutive or tainted bars => UNSETTLED; never score as wins.
The current evaluator requires exact 4 hourly close boundaries and a 4h matured observation.
Actual futures fill simulation requires bid/ask/depth, contract sizing, latency and venue rules.
Until this exists, label the current outcome **conservative OHLC shadow proxy**, not realized PnL.

## Cost and exit policy
All fees, bid/ask spread, entry/exit slippage and funding explicitly required in bps;
cost parameters must be set **before** observed world outcomes.
Use round-trip fees; baseline and candidate use identical cost/latency assumptions.
For TP and SL in the same OHLC bar use stop-first. For gaps through stop use
bar open instead of ideal stop price. For gaps through TP cap reward at frozen TP.
Horizon exit uses last closed price. Carry both source and simulation-version hashes.
Stress-test 1x, 1.5x, 2x costs, and at least two liquidity regimes.
Limitations: no real market/limit fill guarantee; stop-first is conservative but not
a robust bound under exchange outages, insufficient depth or market impact.

## Frozen baselines and matched evaluation
A0: always NO_TRADE (safety/zero PnL, not a meaningful trading edge comparator).
A1: deterministic constant-position LONG with same 4h horizon and costs.
A2: time-series momentum/trend signal from past-only returns, fitted on training only.
A3: comparable always-eligible volatility or breakout rule.
PriceNet and A1/A2/A3 are evaluated on identical decision times, same source quality
eligibility and no hindsight tuning. For directional metrics, compute Brier / log loss,
reliability, calibration slope/intercept, class frequencies and a climatology baseline;
for price-excursion quantiles report coverage and pinball loss on independent holdout.
Explicitly distinguish prediction advantage from trading-policy advantage.

## OOS protocol and promotion gate
Chronological train → calibration → embargo/purge (>=4h label overlap) → prospective locked test.
No changes to model, baseline definitions, thresholds, source filters or costs mid-test.
Record every attempted inference and excluded row with reason.
At least 100 **matured, valid trades** is a collection floor, NOT automatic proof.
Report all decision opportunities, trade frequency, wins, max drawdown, net trade bps,
cost sensitivity, MAE/MFE coverage, worst loss, turnover, time-to-outcome and missing rate.
A separate evaluator computes the paired difference with a 24h+ time-block bootstrap
and reports a confidence interval and one-sided lower bound; also perform a
non-overlap sensitivity analysis. Sample unit must account for 4h overlapping labels.
Only consider bounded promotion when lower 95% confidence bound of incremental net
return against the strongest valid trading baseline exceeds zero and stress costs remain
positive, after accounting for the full predeclared family of comparisons.
NO_TRADE safety baseline cannot establish an economic edge by itself.
Additional requirements: calibrated estimates, acceptable drawdown, no data provenance
violations, reproducibility by an independently controlled job, and user approval.
If promotion gate fails, continue collecting or return NO_TRADE.
No automatic live order execution or email LONG/SHORT authority.

## Known follow-ups
- Wire immutable PostgreSQL prediction rows and independent source receipts to CLI input.
- Add separately frozen baseline decisions on each clock tick, not hindsight synthesis.
- Implement time-block bootstrap, calibration and max drawdown reports.
- Independently run 100+ matured trades and verify result hashes across processes.
- Audit existing settlement.mjs: its terminal net return currently ignores stop/take
  first touch; do NOT use its netTerminalBps as executed strategy net PnL.
