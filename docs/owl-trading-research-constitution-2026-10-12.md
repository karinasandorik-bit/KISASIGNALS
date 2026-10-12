# OWL TRADING INTELLIGENCE — Research Constitution v1.0
Date: 2026-10-12
Status: RESEARCH_ONLY — no production trading authority

## Objective
Maximize independently verified, risk-adjusted *net* utility after fees, spread, slippage, funding, execution failures, model drift, and operational expense. Reject architectures whose incremental utility does not exceed a simple baseline.

## Reality checkpoint (2026-10-12)
- GitHub KISASIGNALS README describes a linear PriceNet baseline, evidence-first signals, immutable prospective 4h settlements, and cross-venue inputs. These are code/document claims, not external verification.
- Supabase OWL public schema queried: 66 market decisions, all NO_TRADE; 42 settlements, zero populated net_estimate_return_pct; 66 delivery entries all DISABLED; market report delivery CONFIG_MISSING. Counts are dynamic.
- No demonstrated live-order performance or verified positive economic edge. No live execution authorization.

## Minimal surviving architecture
Market Data -> Evidenced Snapshot -> Numeric Baselines -> Probabilistic Gate -> Frozen Decision -> Future Outcome -> Independent Economic Evaluation -> Promotion Review.
LLM research is an OPTIONAL challenger that must beat non-LLM baselines on holdout tasks; no LLM-generated order is directly executable.

## Comparison arms (frozen before forward test)
A0: all NO_TRADE (safety, zero-trading benchmark; not profitability benchmark).
A1: simple directional momentum / breakout under fixed turnover and risk limits.
A2: cost-aware tabular model (e.g. logistic regression or gradient boosting), calibrated.
A3: A2 + LLM research agent with timestamped news/evidence, no future information.
A4: A3 + dynamic entry/exit challenger, after A3 clears gates.
All share an identical historical information cutoff, venue availability, commission/slippage schedule, notional and risk budget. Report buy/hold and random exposure-matched controls separately.

## Every prospective decision must freeze
decision_id, strategy_version, code_commit_sha, model_artifact_sha256, feature_schema_hash, symbol, venue, event_time, decision_time, received_at, horizon, source timestamps, independent reference price/venue, predicted distribution, LONG/SHORT/NO_TRADE, entry/exit rules, sizing proposal, projected costs with source, reason codes, vetoes and authority=SHADOW.
Reject if stale, missing essential evidence, conflicting venues, schema mismatch, provider outage or uncalibrated tail risk.

## Evaluation protocol
1. Dataset and feature provenance audit; embargo/purging for overlapping labels; true chronological walk-forward train/validate/test.
2. Freeze candidates, thresholds and assumptions before a virgin prospective holdout.
3. Record MFE/MAE, actual fills when available, cost-aware net simulated returns otherwise (explicitly marked estimates). No cherry-picked fills.
4. Report calibration (Brier/log loss/coverage), precision and recall by direction, trade rate, turnover, net expectancy with bootstrap CIs, Sharpe/Sortino with uncertainty, drawdown, CVaR, rejected opportunities and abstention regret.
5. Audit missing/outage periods and selection bias; predefine treatment of incomplete outcomes.
6. Compare A2 vs A1 and A3 vs A2 by incremental net outcome and operating cost on identical event set.
7. Test across volatility regimes and multiple venues; keep all losing trials.
8. Independently verify evidence, settlement computations, and venue ledger. No promotion without verifier receipt.

## Initial gates (research preregistration; NOT evidence of success)
G0: 100% of new decisions have valid timestamped evidence and frozen assumptions.
G1: 100% of matured decisions have valid settlement or explicit documented exclusion.
G2: net return coverage >= 99% of evaluable positions; otherwise no trading promotion.
G3: enough *independent* observations to estimate uncertainty and show positive lower confidence bound of incremental net utility against relevant baseline; 100 decisions alone is not sufficient.
G4: zero critical safety bypass in fault injection and replay tests; demonstrate kill switch, idempotent order intent, least privilege, reconciliation after crash.
G5: bounded human-authorized canary only, with hard loss/notional/rate caps, separate exchange subaccount and withdrawal-disabled trading credentials, after G0-G4 independently pass.
These are candidate promotion criteria, subject to adversarial review.

## Immediate operational work queue
P0: fix mailing provider configuration and verify delivered receipt independently (control reports only).
P0: inspect why all 66 decisions abstain, without loosening thresholds until an offline replay and prospective plan exist.
P0: explain absent settlement net_estimate_return_pct and implement cost-accounting coverage in tests.
P1: establish independent 2+-venue prices and snapshots with source timestamps.
P1: freeze A1/A2 model cards and first virgin chronological evaluation slice.
P2: LLM agent ablation; promote only if it beats A2 net of inference and operational costs.
P3: execution testnet with fault-injection, order status reconciliation and segregated credentials.
Live execution remains OUT OF SCOPE for this document.

## Self-upgrade policy
OBSERVE failure -> HYPOTHESIS -> BUILD -> FREEZE -> PRE-REGISTER -> INDEPENDENT TEST -> PROMOTE/REJECT -> LOG. Never call a proposed improvement a deployed or successful upgrade without externally reproducible evidence.
