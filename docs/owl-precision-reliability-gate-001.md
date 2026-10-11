# OWL Precision Engine — Reliability Gate 001

Date: 2026-10-11. Scope: `src/live.mjs`, `.github/workflows/owl-independent-signals.yml`.

## Verified static findings (not a runtime certification)
1. `runLive` calls `appendLedger(ledger,row)` before awaited PostgreSQL `putEvidence` operations. A partial write is possible.
2. PostgreSQL dedup error is caught and execution continues through `POSTGRES_DEDUP_FALLBACK`. This is fail-open in a workflow which requires PostgreSQL as the source of truth.
3. Persistence, lineage, contract writing and `pushActionableSignal` are enclosed in a try/catch that logs `POSTGRES_WRITE_OR_PUSH_FAILED` but does not rethrow; `runLive` may resolve successfully despite loss of durable state or delivery.
4. The scheduled workflow is guarded by `OWL_INDEPENDENT_RUNNER_ENABLED`, so existence of the workflow does not prove it is enabled or succeeding.
5. GitHub Actions concurrency prevents overlap **within that group**, but does not provide cross-provider locking against Railway or another runner.

## Required invariants
- R1: A signal must never be emailed unless a committed prospective decision with matching payload hash already exists in independent PostgreSQL.
- R2: On any missing/failed PostgreSQL write, inference may be observed locally but no actionable email is released, and the job fails with nonzero exit.
- R3: A stable decision ID or (symbol, feature_timestamp, model_hash, policy_hash) uniquely identifies the decision; retries must not create a second decision or duplicate send.
- R4: Delivery is outbox-based. Commit decision + pending outbox event atomically; a separate worker sends; provider delivery receipt and retry count are stored. Exactly-once remote email cannot be guaranteed without provider-side idempotency, so use at-least-once with explicit duplicate identification and bounded retry.
- R5: A distributed PostgreSQL advisory lock or lease must ensure a single producer across hosts; GitHub workflow concurrency alone is insufficient.
- R6: Clock/freshness failures, impossible bars, futures feed disagreement, stale model calibration and missing reference price force NO_TRADE.
- R7: Every signal email states symbol, side, horizon, entry policy, SL, TP, cost assumptions, evidence timestamp/source, model/policy hashes, SHADOW status, and decision ID.
- R8: No live order execution; manual decisions only until prospective, out-of-sample net advantage is independently demonstrated.
- R9: Restore gate: off-Railway encrypted backup with SHA-256, successful isolated pg_restore, table-count/integrity checks and stored restore receipt **before** switching the independent runner on.

## Minimal fault-injection acceptance matrix
| Fault | Expected result |
|---|---|
| PostgreSQL unavailable during dedup | Fail nonzero; no new signal email |
| PostgreSQL unavailable after model computation | Fail nonzero; no actionable signal email |
| Crash after committed decision / before send | Outbox event pending; retry after restart |
| Crash after provider accepts email / before receipt | Ambiguous state recorded; retry policy explicitly handles duplicates |
| Two workers launch simultaneously | Exactly one authoritative prospective decision |
| Stale or conflicting market feed | NO_TRADE, reason persisted |
| Workflow scheduled while activation flag is false | Skipped, not reported as successful execution |
| Railway stopped | Independent restore + external worker maintain traceable operation |

## Operational quality SLOs (targets, not achieved claims)
- 100% actionable emails trace to immutable committed decision ID.
- 0 actionable sends with unverified freshness/consensus.
- 100% write failures result in nonzero workflow status.
- 100% daily recovery drills have independent receipt (after rollout).
- Track observed freshness, incident rate, delivery delay, failed/duplicate sends, 4h settlements and net expectancy without inventing success rates.

## Gate status
**BLOCKED / NOT CERTIFIED.** Static review reveals R1/R2 deficiencies. No production runtime, external restore or email receipt has been verified in this audit.

## Implementation order
1. Extract pure `computeDecision` from side effects.
2. Make persistent decision + outbox enqueue a single PostgreSQL transaction; forbid JSONL fallback for production send.
3. Add atomic dedup, cross-host lease and email outbox worker.
4. Add synthetic failing-PG, crash-window and concurrency tests to CI.
5. Perform external PostgreSQL restore and obtain independent receipts.
6. Enable scheduled runner only after all above pass, then accumulate prospective settlements and report calibration / realized net edge.
