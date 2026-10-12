# Prospective OOS acceptance protocol — frozen 2026-10-12

Status: NOT YET EVALUABLE. This is a preregistration, not evidence of trading edge.

## Admission
- Only decisions emitted AFTER the baseline/model hash and scoring specification are frozen.
- Immutable decision time, model hash, evidence timestamp and source, venue, predicted probabilities / MFE / MAE, target at +4h; independently collected exact-horizon outcomes.
- Reject NO_TRADE as a profitable long/short label. It remains an abstention outcome for coverage and opportunity-cost comparison.
- Reject lookahead, approximate horizon, stale/uncorroborated venue, nonverifiable costs, missing net return and data collected after outcome for input features.
- Use independent provider price; record provider receipt/hash and exact observation timestamp.

## Scoring
- Frozen no-trade baseline, EMA momentum and price-only momentum; same UTC timestamps and instrument/venue horizons.
- Net return = signed gross position return - round-trip fees - worst-case slippage - funding; use prospective frozen assumptions with upper-bound stress scenario.
- Report N, directional coverage, calibration/Brier/log loss, hit rate, mean net return, tail drawdown and bootstrap 95% confidence intervals by time block.
- Require at least 100 independent directional decisions for exploratory comparison; promotion demands additional independently sealed holdout and risk/CI review.
- NEVER optimize hyperparameters on held-out outcomes, backfill missing prices or promote on in-sample gains.

## Snapshot at audit
The previously observed PostgreSQL sample contained 69 owl-ema-v1 decisions, all NO_TRADE; 45 SHADOW_APPROX_HORIZON_UNCALIBRATED settlements, 0 verified net estimates. No verified PriceNet edge can be calculated.
