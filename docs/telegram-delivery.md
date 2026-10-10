# OWL QUANT Telegram delivery (SHADOW ONLY)

## Deployment state
- Receiver: Railway GENESIS / owl-quant-telegram-webhook (STAGED; not live until reviewed and accepted).
- Sender: KISASIGNALS src/signal-delivery-outbox.mjs on branch owl-quant-durable-push-20261010 (draft PR #13).
- Market worker continues in shadow mode. No live orders.

## Configure through Railway dashboard ONLY
1. Create a Telegram bot with @BotFather and open a private chat with it. Send /start from the intended iPhone account.
2. Find your numeric Telegram chat ID using the bot's `getUpdates` API in a secure browser/session. Never paste bot token into GitHub, chat, logs, or URLs shared with others.
3. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `KISA_SIGNAL_WEBHOOK_SECRET` on the receiver service. Generate a cryptographically random secret at least 32 characters.
4. On KISASIGNALS set `KISA_SIGNAL_WEBHOOK_URL` to the deployed receiver's HTTPS /signal URL and set `KISA_SIGNAL_WEBHOOK_SECRET` to the same secret.
5. Verify receiver GET /health reports `configured: true`; this endpoint must not reveal secrets. Keep `KISA_EXECUTION_MODE=SHADOW` and micro-live disabled.
6. After CI/tests pass, approve deployment and test an isolated SHADOW_ONLY event. Verify Telegram Bot API receipt and actual iPhone notification manually.
7. Compare decision ID and timestamp against PostgreSQL `signal_delivery_outbox` and `evidence_events`.

## Security
- Receiver rejects POST without bearer secret.
- Receiver only accepts SHADOW_ONLY LONG/SHORT envelopes, forwards to one configured chat ID, and does not execute trades.
- Outbox retries and can deliver duplicates after ambiguous network timeouts (at-least-once, **not exactly-once**). Telegram does not provide a sendMessage idempotency key.
- Telegram API 200 means Telegram accepted the message, **not** proof iPhone displayed it.
- Secrets are Railway variables, never source-code literals.

## Release blockers
- Bot token and recipient ID have not been provided/configured.
- Draft PR lacks independent CI/fault-injection results.
- Railway function is staged, not deployed.
- No confirmed delivery receipt or on-device evidence.
