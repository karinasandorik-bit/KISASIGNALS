# EXP-001 Independent Dataset Approval Boundary

## Implemented on research branch
- Canonical SHA-256 payload verification (`verifyEvidence`) detects mutation **relative to a precommitted digest**. The digest alone does not establish that a venue originated the data. Trusted acquisition/transport and immutable timestamping remain necessary.
- `independentlyRecalculatePnL` recomputes **a simplified one-entry one-exit percentage return**, with fee, slippage and funding costs in bps. It is not a derivatives fill simulator: does not incorporate liquidation, variable notional, partial fills, contract multipliers or independently sourced funding history.
- `approveDataset` rejects unverified rows, holdout overlap and changed dataset manifests. Approval requires an Ed25519 signed receipt whose trusted public key must be installed out of band as `OWL_TRUSTED_VERIFIER_PUBKEY`. Never use a public key supplied by the dataset producer. No trusted key means fail closed.
- A signed receipt must be produced by a separate verifier process/identity after independent recomputation, not by the same exporter that generated labels.

## Open blockers
1. Real market evidence hashes were absent in the 40 checked settlements.
2. Independent exchange/fee/funding source not yet bound to signed receipt.
3. Hidden holdout must be generated, isolated and controlled by independent evaluator, with no leaking of labels to model selection.
4. The simple return model is insufficient for leveraged futures / complex execution; do not promote until execution-independent reconciliation and extra contract-specific tests.
5. This research module is not yet wired into live ingestion or training job; approving a dataset via UI or direct code path remains forbidden until all routes enforce the same gate.

## Approval policy
Do not run challenger training using these 40 approximate settlement labels. Current status: QUARANTINED. Historical OHLCV forecasting research may use separately validated price series and time-safe split, but cannot claim validated net trading edge.
