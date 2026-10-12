# OWL/KISA Integration Acceptance — 2026-10-12

Status: **BLOCKED** — no production promotion, no actionable LONG/SHORT, no order execution.

## Source freeze
- PR #17: durable PG outbox; touches `src/live.mjs` and `src/signal-push.mjs`.
- PR #19: net-EV verifier; also touches `src/live.mjs`; direct conflict surface with #17.
- PR #20: independent training/outcome gates; isolated files, contracts CI success on head `d1f876ca8c869d602e366019468088ca349dc3f1`; this is CI success only, **not** independent OOS profitability.
- PR #21: isolated PostgreSQL/Docker test runner, head `f590b89bf2a497078c86cec8d456506cd4f805bd`; both workflows failed.

## Reproduced external CI diagnosis (GitHub Actions logs)
- PR #21, contracts run 38232812698: test 60 `market to frozen inference persists calibrated prospective observation` fails with `DATABASE_URL_REQUIRED` (123 pass / 1 fail / 1 skip).
- PR #21, isolated run 38232812764: tests 6 and 60 fail because `owl_internal.predictions` relation does not exist (123 pass / 2 fail). PostgreSQL container starts successfully; schema bootstrap is missing or incomplete.
- Do not solve this by connecting CI to production PostgreSQL or passing a production DATABASE_URL into Docker build.

## Integration order and explicit acceptance
1. **Schema/test isolation gate:** source-control complete PostgreSQL schema and apply it to the disposable PostgreSQL 17 service *before* running DB-required tests. Check DB schema presence independently; contracts/unit suite must remain valid without production credentials. Validate Docker image builds with zero production secrets.
2. **Outbox gate (#17):** independent two-worker claims, lease/fencing, provider readback after crash between Gmail accept and DB receipt; no second email under ambiguous delivery. Distinguish API ACCEPTED, SENT and actual recipient DELIVERED. Exact-once is not assumed.
3. **Training lineage gate (#20):** freeze source hash and outcome time; quarantine approximate/no-trade outcomes from profitable LONG/SHORT labels; reject lookahead and mismatched venues.
4. **EV gate (#19):** wire verifier only after independent OOS sample and cost/slippage/funding/risk bounds; regression test LONG, SHORT, NO_TRADE, stale evidence, missing input, negative EV.
5. **Joint gate:** merge into a single **temporary integration branch**, resolve `src/live.mjs` overlap, run full tests and isolated Postgres 17/18 compatibility matrix, source provenance review, failover test and independent evaluator. Production remains read-only/shadow until reviewed.

## Proof obligations (not yet met)
- CI green on exact combined commit and reproducible with fresh disposable DB.
- At least one unattended 4h report with Gmail message ID and PostgreSQL matching receipt; retry/reconciliation does not duplicate.
- Independent prospective out-of-sample PriceNet comparison after fees/slippage/funding versus frozen baselines, with adequate sample and calibration.
- Backup/restore drill and one-writer cutover evidence before deployment.
- Explicit operator approval before production deploy; separate promotion approval before actionable signals. Never authorize live trading from this document.

This file is an acceptance contract, not evidence that the integration has passed.