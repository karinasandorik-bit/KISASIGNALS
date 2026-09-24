# KISASIGNALS

Recovered research kernel; **not production-ready**. Observation/shadow only; no order execution.

Run with Node 22+: `npm test`, `npm run live`.
Optional `LEDGER_PATH` selects the local observation ledger. No credentials required.
There are no third-party runtime dependencies.

Current live path: Coinbase BTC-USD hourly closed bars, with Kraken XBTUSD fallback → timestamp/quality checks → frozen linear softmax classifier → explicit NO_TRADE because verified excursion distributions and calibration are unavailable → observation ledger.

This artifact is a linear baseline, not a trained deep neural trajectory model. The kernel's example EV formula, risk sizing, settlement and metrics are research scaffolding, not approved execution logic. `npm run demo` uses synthetic data only.

See [reality audit](docs/reality-audit-2026-09-24.md) for verified scope and blockers. No accuracy or profitability claim is supported.
