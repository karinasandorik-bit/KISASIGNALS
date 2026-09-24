# KISASIGNALS — Product v1

## Product thesis
KISASIGNALS is a prospective AI crypto signal terminal. It keeps the fast, readable signal UX proven by products such as GGShot (entry, TP/SL, live status, statistics), but changes the epistemic core: every actionable signal is frozen before the outcome, carries source/model provenance, can abstain, and is scored only from prospective settlements.

## User surface
**Signals** — LONG / SHORT / PASS, symbol, horizon, prospective score, optimal-entry state (ENTER NOW / WAIT / LIMIT / EXPIRE), Entry, SL, TP1–TP4, R:R, expected value.

**Trajectory** — P(UP), P(DOWN), P(RANGE), MFE/MAE q10/q50/q90. PriceNet predicts a distribution; it never directly authorizes LONG/SHORT.

**Validator** — calibration state, uncertainty/OOD, independent futures-feed consensus and disagreement. Cross-venue conflict blocks trade authority rather than silently failing over.

**Open Entries** — only currently actionable/waiting setups, with expiry and live entry status.

**Evidence** — immutable decision ID, frozen timestamp, model SHA/version, market source timestamp, 4h settlement, realized MFE/MAE/net PnL.

**Statistics** — prospective-only win rate, expectancy, calibration/coverage, sample size and baseline comparisons. No backtest-derived “accuracy” badge may be presented as future accuracy.

## Decision pipeline
MARKET → MULTI-VENUE WORLD RECORDER → FEATURES → PRICENET → TRAJECTORY DISTRIBUTION → CALIBRATION → OPTIMAL ENTRY → METAGATE → RISK/EXECUTION SIMULATOR → IMMUTABLE SHADOW SIGNAL → FUTURE OUTCOME → SETTLEMENT → PERFORMANCE LEDGER → PROMOTION GATE

## Product states
A signal must expose one of: PASS, WATCH, WAITING, IN_ENTRY, ACTIVE, SETTLED, INVALIDATED, EXPIRED.

## Trade authority
A generated sensor/model/policy has zero authority by default. Promotion is:
generate → freeze → shadow → prospective OOS outcomes → causal ablation → independent promotion gate → bounded authority.

Live-capital execution is explicitly out of scope until prospective evidence beats preregistered baselines after costs.

## Reliability kernel
Market evidence should include futures-native funding, OI/ΔOI, mark/index basis, spread/depth, aggressive flow and, when available, liquidations. Two or more independent venues are preferred; disagreement is itself a feature and a blocking condition when beyond calibrated thresholds.

## What is deliberately different from GGShot
We copy usability patterns, not unverifiable performance claims. KISASIGNALS does not equate recent wins or backtests with “94% accuracy.” Its differentiator is auditability: a user can inspect what the model knew, what it predicted, why MetaGate acted or abstained, and what the world did afterward.
