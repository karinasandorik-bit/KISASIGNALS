# Reality audit — 2026-09-24

## EXECUTED: repository and runtime inspection

At audit start karinasandorik-bit/KISASIGNALS was empty: size 0, branches [], no git refs, no HEAD. Default branch name main was metadata only. Recovery source: KISASIGNALS-v2-latest.tgz, preserved separately; historical proof files were not treated as fresh execution evidence.

Railway project ae825ae8-1bd6-405f-b16e-a03e28363831, production eeb3ddf8-8354-4701-981b-3db31a98c677:
- crypto-monitor-v2: deployment 4f7b6bf3-6fe6-4fb1-9039-a6826f78770c reports SUCCESS; runtime is BROKEN for data acquisition. Logs 11:40–12:10 UTC repeatedly emit MARKET_STATE_ERROR / REQUIRED_EVIDENCE_UNAVAILABLE, Binance HTTP 451 and alternate hosts' JSON failures.
- Config points to deontey303/crypto-monitor, feat/market-state-dataset-v1, commit d4d715d8b91979ae6fa637a0894f699292218373, start npm run run:market-state. This is not KISASIGNALS. Source owner repo is read-only to current connection.
- crypto-monitor: FAILED; crypto-monitor-dex: CRASHED. Root causes not inspected here.
- Postgres: platform SUCCESS; connectivity, schema and records UNVERIFIED.
- genesis-core: no deployment.

No deployment configuration or service was changed during this repair.

## Components after repair

| Component | Status | Evidence / limitation |
|---|---|---|
| Runtime entrypoints | WORKING locally | src/live.mjs, src/demo.mjs; integration invoked live with injected fixture |
| Dependencies | WORKING locally | Node built-ins; tests executed with installed Node; Node 22 CI configured |
| Market providers | PARTIAL / live BLOCKED here | Coinbase + Kraken; both real probes returned HTML Site Unavailable; fixture failover tested |
| Features | PARTIAL | Closed hourly bars, gap/duplicate/OHLC checks, freshness and normalization metadata; original training parity/cutoff UNKNOWN |
| PriceNet artifact/load | WORKING locally | Frozen SHA-256 29f643ecf0bf98dba652aa939f22400c530592418d80b3d6e670c128212c0dda; runtime mismatch rejection tested |
| Classifier inference | WORKING locally | Finite normalized probabilities on fixture; predictive utility UNKNOWN |
| Probabilistic MFE/MAE | MISSING | Artifact contains regression weights but insufficient semantics/intercepts; no quantile distributions |
| Frozen calibration | MISSING | No fitted calibrator, held-out calibration dataset or verified training cutoff |
| MetaGate | PARTIAL | Invalid/unavailable forecasts fail closed; valid-input EV formula is heuristic and not a validated utility estimator |
| Costs | PARTIAL | Scalar example fees/slippage/funding; spread and instrument-specific execution missing |
| Risk engine | PARTIAL | Example sizing; no total notional/leverage cap or execution-aware maximum loss |
| Shadow trade persistence | MISSING | Append-only JSONL observations exist; no immutable transaction-backed trade records or cross-process deduplication |
| Settlement | PARTIAL | Synthetic terminal-return arithmetic only; no scheduler, TP/SL ordering, due-time check or idempotency |
| Prospective A/B | MISSING | No paired cohorts, baseline collection or frozen trial protocol |
| API/dashboard | MISSING in recovered target | Legacy repo has dashboard files, not executed or migrated |
| Observability | PARTIAL | Inference/error structured events; full causal event chain absent |
| Tests | WORKING locally | Original 10/10; repaired suite 17/17, includes fixture market→inference→persist |
| CI | UNVERIFIED | Workflow added; remote execution must be inspected |
| Deployment | MISSING for target | Old Railway service cannot prove new repository runs |
| Security | PARTIAL | Restored source/config inspected; no credential files migrated; no exhaustive audit of external legacy history |

## Changes and falsification

Observed failures: empty target repository, unclosed latest bar in recovered live code, no production artifact integrity enforcement, Infinity serialized as null, custom ledger parent not created, unhealthy upstream accepted without explicit JSON validation.

Repairs: recover core only; closed-bar quality contract; runtime hash check; explicit null excursion / NO_TRADE contract; observation-only labeling; custom parent directory creation; JSON validation and source-preserving failover; focused regression tests and CI.

Falsifier: changed artifact accepted, unfinished candle alters features, stale/gapped data accepted, or missing excursions cause a trade. Tests exercise these failure cases. Synthetic outcomes are not prospective evidence.

## Next bottleneck / STOP boundary

The first production link remains blocked: obtain valid timestamped market JSON from a permitted runtime, then verify a persisted real observation. Do not interpret this repair as a successful deployment. No real capital execution.

Before trades: recover raw chronological training data and cutoff, train/validate excursion distributions, fit and freeze calibration, replace heuristic utility/risk/settlement contracts, then register a new prospective generation. The 4h outcome cannot be fabricated or inferred from code existence.

## Publication attempt

EXECUTED: local repair commit created and 17 tests passed. Git push failed because no HTTPS credentials are available. Connected GitHub contents write returned HTTP 403 Resource not accessible by integration, despite repository metadata listing push=true. Remote repository remains empty; CI was not triggered. Repaired npm run live returned ALL_MARKET_SOURCES_FAILED / NON_JSON_RESPONSE for both providers and exited 1 without persisting a market observation.

BLOCKED: GitHub integration write permission and live market JSON access from this runtime. No successful remote commit/deployment is claimed.
