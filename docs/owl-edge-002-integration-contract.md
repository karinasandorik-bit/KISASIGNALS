# OWL EDGE-002: Collector → atomic freeze → settlement → challenger evaluation
Status: IMPLEMENTATION SPEC / NOT DEPLOYED
Date: 2026-10-12

## Observed integration risk
Current src/live.mjs writes JSONL before asynchronous PostgreSQL evidence and catches PostgreSQL failure, allowing apparent successful inference without durable atomic freeze. A signal may be pushed in a broad try block. Do not connect scientific-loop to production signal path until this is corrected.

## Independent collector contract
Collector runs in a separate process and failure domain. Pull two venues with independently timestamped prices and capture source exchange timestamps, collector received timestamps, instrument contract, quote currency, market type, and source hashes. Enforce freshness and venue disagreement bounds. Different venue names alone do not prove independent observations; test correlated outages and upstream dependencies. Collector signs envelope with scoped credentials; receiver validates signature, replay nonce, monotonic sequence, TTL and schema version. No secret keys in public frontend.

## Atomic freeze
In one PostgreSQL transaction:
1. Verify evidence source, timestamps, horizon and policy version.
2. INSERT evidence envelope and frozen prediction with unique (strategy_version,symbol,horizon_start_at) and immutable commitment.
3. INSERT settlement_due outbox event, referencing prediction id, in same transaction.
4. COMMIT before any signal delivery.
No JSONL-first or swallowed DB failure. No signal when transaction fails. Workers claim due items via SELECT ... FOR UPDATE SKIP LOCKED with lease/retry and idempotent settlement id; the external observation is fetched after horizon, validated then written in a separate transaction. Never hold DB transaction across network I/O.

## Settlement verification
Compare outcome venue with prediction reference venue, and verify observed_at >= target_at; validate actual price timestamp, source candle window and market contract. Require raw evidence hash, disagreement threshold, frozen fee/funding/slippage model. Store gross return and net *estimate* separately; no fabricated fill. On disagreement/stale data set INVALID_EVIDENCE and quarantine. NO_TRADE receives a counterfactual benchmark return, not an executed-trade PnL.

## Policy challenge
Pre-register A1 and A2 on identical timestamps and tradable universe; assign independent future holdout. Evaluate paired economic net returns and costs, uncertainty intervals with time-block bootstrap, exposure/turnover matched baselines, calibration, drawdown, abstention regret and outage sensitivity. Promotion requires independent verifier receipt and explicit human authorization. Current scientific-loop promotionGate is screening only: iid approximate interval is NOT adequate for correlated market observations, and the current outcome evaluator must enforce cost <= frozen max budget and independent-source allowlist.

## Failure injection acceptance
- SIGKILL between DB COMMIT and outbox delivery: exactly one prediction, one due event, eventual settlement.
- Two competing workers: exactly one settlement.
- Collector outage / replay / forged timestamp / source disagreement: fail closed.
- Wrong instrument or horizon: reject.
- Partial venue failure: quarantine rather than silently using stale reference.
- Policy swap during holdout: reject.
- Zero net-return coverage: block promotion.

## Work order
P0 add schema migration + atomic transaction repository; P0 replace JSONL-first path; P0 collector signed envelope; P1 settlement worker and reconciliation; P1 hidden holdout evaluator; P2 independently replay crash tests; P3 production shadow canary. No live orders.
