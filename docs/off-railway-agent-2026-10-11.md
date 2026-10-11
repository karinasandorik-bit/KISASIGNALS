# OWL Market Agent — independent runtime (2026-10-11)

This is a separate, Railway-independent *runtime* hosted on the connected Supabase OWL project, **not** a new standalone GitHub repository or separate Supabase billing project.

## Verified infrastructure
- Supabase project ref: `omgbfczcifhsckzibwsb`
- Function: `owl-market-agent`, deployed v2; callable only with a private custom request token
- Postgres tables: `public.owl_signal_market_decisions`, `public.owl_signal_delivery_outbox`, `public.owl_signal_agent_runs`
- PostgreSQL pg_cron job: `owl-market-agent-15m`, schedule `5,20,35,50 * * * *` UTC
- The cron secret is in Supabase Vault; never copy it into this repository.
- Verified manual HTTP invocation: HTTP 200, `RECORDED`, database `decision_id=okx-btc-15m-1791738000000-ema-v1`, `NO_TRADE`, observed price 83787.8.
- Scheduled execution is enabled, but not yet verified across multiple unattended ticks.

## Decision boundary
Reads closed 15-minute OKX BTC-USDT-SWAP candles; EMA12/EMA26 and momentum are an **uncalibrated research baseline**. No trading orders are placed. Action choices are LONG / SHORT / NO_TRADE, and outcomes are **not** yet independently backtested. Never claim a profitable or verified futures edge.

## Email
The deployed function supports Resend when three environment variables are installed in Supabase Function Secrets:
- `RESEND_API_KEY` — provider API key
- `OWL_SIGNAL_EMAIL` — target inbox
- `OWL_SIGNAL_FROM` — verified sender email/domain

These secrets have NOT been configured or tested in the current deployment. No email has been sent. The outbox stores the provider ID only if the email API returns a successful response. Avoid sending uncalibrated research alerts as investment recommendations.

## Next verification
1. Validate repeated scheduled invocations in `cron.job_run_details` and `public.owl_signal_agent_runs`.
2. Configure a permitted, verified sender and test end-to-end email receipt and provider ID.
3. Implement an immutable 4h settlement/outcome table, evaluate OOS samples, multi-venue derivatives consistency and fees, then replace EMA baseline only if independently better.
4. Add backup/restore drill and uptime monitor. No Railway cutover or termination without restore parity.

## Operational caveats
Supabase Free is quota-limited and may pause after inactivity. pg_cron is best-effort rather than a hard real-time guarantee. No promise of absolute 24/7 uptime. Never commit secrets.
