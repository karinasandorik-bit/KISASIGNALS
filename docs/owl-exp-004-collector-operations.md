# OWL EXP-004 — independent collector operations (NOT DEPLOYED)

The price policy `OWL-EXACT-TRADE-BRACKET-V1` is frozen in `src/prospective-outcome-collector.mjs`: use Binance USDⓈ-M BTCUSDT aggregate trades immediately on either side of an immutable 4-hour target, with <=250 ms bracket distance, matching prices and strictly increasing IDs. Otherwise fail closed.

Collector creates SHA-256 of canonical capture, including raw HTTP response SHA-256, retrieval time, request URL and explicit `provider_origin_signed:false`. An Ed25519 collector signature proves the *collector key* endorsed the saved bytes, **not** that Binance signed them. The raw response bytes themselves must be retained in a separate immutable, access-controlled blob store with content-hash address; currently the collector records the raw hash but does not archive raw bytes, so full replay/provenance is incomplete.

`src/outcome-witness-worker.mjs` is a one-shot worker for an external scheduler. It selects due NO_TRADE decisions and inserts idempotent receipts. The database table defined in `sql/owl_external_outcome_receipts.sql` has not been applied. Prerequisites: reviewed migration, least-privilege DB identity, PEM signing key in independent key-management, separate immutable raw payload archive, external scheduler (e.g. every minute), retry and missing-outcome alerts. Worker only considers targets in [now−20m, now−1m]; missed windows are NOT silently filled. It should be augmented with explicit failure ledger and backfill policy prior to production.

This stage does NOT settle LONG/SHORT futures trades, calculate realized PnL or approve ML training. A no-trade observational price is not execution return. Deployment and external verifier independence are pending.
