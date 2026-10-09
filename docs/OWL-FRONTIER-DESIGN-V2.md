# OWL Frontier Design System V2
Status: DRAFT / not deployed. Owner: OWL. Purpose: unifying the visual identity of KISA/OWL with verifiable runtime evidence.

## Design principles
1. Evidence before spectacle. Never show invented KPIs, live-status badges, worker counts, or benchmark scores.
2. The product is a control surface, not a fantasy illustration.
3. Visual trust is earned through timestamps, source identity, signed provenance, and independently checked outcomes.
4. Geometry: low-polygon owl silhouette (minimal face), orbit, dependency graph, asymmetric signal arcs.
5. A single warm accent indicates a selected hypothesis or active signal; status semantics never depend on color alone.

## Tokens
```css
:root {
  --owl-obsidian: #101116;
  --owl-graphite: #292831;
  --owl-orchid: #A47C9C;
  --owl-signal: #E8A8CA;
  --owl-porcelain: #F5F2F0;
  --owl-silver: #BFC4CC;
  --owl-iris: #8176BE;
  --owl-amber: #E6AE78;
  --owl-positive: #70BFA2;
  --owl-negative: #F27E89;
  --owl-radius: 12px;
}
```

## App information architecture
1. Overview: runtime evidence status, latest immutable decision and settlement, no fictitious values.
2. Signals: prospective signals, evidence cut-off, source/observed_at, gate verdict.
3. Agent workbench: worker ID, capability grant, exact permitted actuator, evidence references, trace.
4. Evaluator: blind hold-out verdict, baseline, ablations, p-values/intervals where applicable, verdict provenance.
5. Ledger: append-only decision/action/outcome lineage; verified PostgreSQL times.
6. Controls: revoke, halt, rollback, replay; every outcome independently attested.

## Rendering contract
Represent missing data as UNKNOWN, never zero. Mark STALE feed after an explicit threshold; mark verification as UNVERIFIED until proof exists. Labels EXECUTED, DERIVED, HYPOTHESIS and UNKNOWN must be visible as text. A screenshot/render is NOT proof of a live worker. Show SHADOW prominently, with no implied exchange execution or profitability.

## Upgrade gates
A candidate must pass visual regression, accessibility contrast, responsive layouts (mobile/iPhone included), zero fabricated metrics, schema-verified API data, safe empty/error/offline states, and independent review of claims. No production promotion from this spec alone.

## Presentation sequence
Claim → live demonstrable function → system diagram → prospective evidence → independent test → limitations → next experiment.

## Anti-patterns
No gold trim, ruins, decorative planets, oversaturated neon, meaningless spiderwebs, giant owl in trading tables, or unsourced before/after metrics.
