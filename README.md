# KISASIGNALS

Evidence-first crypto decision system. **Shadow/research only; no live order execution or profitability claim.**

## Production contract
`market → evidence → trajectory model → validator → information value → optimal entry → MetaGate → freeze → world → settlement → causal evaluation → independent promotion gate → bounded authority`

Current production includes:
- frozen PriceNet linear baseline with calibration/excursion artifact;
- prospective immutable prediction + 4h settlement ledger in Postgres;
- multi-venue derivatives recorder with freshness, circuit breakers and cross-venue consensus;
- OKX + Bitget currently usable from the production region; unavailable venues fail closed;
- persisted OI snapshots; ΔOI requires a same-source observation separated by at least 60s;
- sensor ablation/shadow evidence and a decision constitution;
- product API for Signals, Open Entries and prospective-only statistics;
- signed external collector ingestion boundary for future region-independent data collection.

## Epistemic boundary
A generated model/sensor/policy has **no trading authority**. Promotion path:
`generate → freeze → shadow → world → causal evaluation → independent promotion gate → bounded authority`.

Current PriceNet is a small linear baseline, not a deep neural trajectory model. Validator and sensor challengers remain research components. GGShot-style product UX is a product target, not evidence of model quality.

## Run
Node 22+: `npm test`, `npm run live`, `npm start`.

See `docs/reality-audit-2026-09-24.md` for historical recovery notes.
