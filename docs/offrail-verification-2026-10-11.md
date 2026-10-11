# OWL off-Railway verification gate (2026-10-11)

Status: **NOT DEPLOYED / NOT END-TO-END VERIFIED**.

This branch prepares migration without changing production or enabling real orders.

Acceptance gates:
1. Preserve Railway PostgreSQL with encrypted dump, SHA-256, independent pg_restore and row-count/checksum parity (not yet completed).
2. Publish isolated GitHub Actions shadow job with least-privilege permissions and private durable ledger, never secrets in public commits.
3. Fetch live public futures market data from two independently reachable venues, verify timestamp continuity, sequence and spread; fail closed.
4. Append immutable decision containing evidence hash, frozen policy hash, entry assumptions, expiry and NO_TRADE status.
5. Delivery outbox: record provider acceptance ID; distinguish ACCEPTED from DELIVERED. Reconcile UNKNOWN rather than blindly resending.
6. Settlement at 4h: missing bars remain pending; intrabar SL/TP collision recorded AMBIGUOUS; hypothetical fill never reported as executed trade.
7. CI must test missing candles, ambiguous bar, timeout, idempotency, crash-after-provider-acceptance and provider 5xx.
8. Verify externally using GitHub workflow run URL, real market timestamp, provider event receipt and independent ledger replay before switching.

Source package: locally tested offrail runner artifact from ChatGPT conversation. Repository deployment and secrets have not been activated. Never interpret the price momentum baseline as validated alpha.