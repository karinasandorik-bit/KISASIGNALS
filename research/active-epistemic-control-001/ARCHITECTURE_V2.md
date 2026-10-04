# AEC-001 v2 — sealed benchmark architecture

## Threat model
The benchmark is invalid if task construction, policy selection, or scoring can infer hidden outcomes through timestamps, filenames, hand-authored signal signs, future-derived normalization, or evaluator feedback.

## Physical roles
1. BUILDER: ingests timestamped raw observations and mechanically emits public task manifests. It never computes/reads post-horizon outcomes.
2. POLICY: receives hypotheses, revealed evidence, observation metadata/costs and budget. It never receives hidden observation values before purchase or outcomes.
3. SEALED EVALUATOR: receives frozen commitments plus sealed outcomes and computes losses only after policy termination.

No component may occupy two roles in a scientific run.

## Two commitments
Before policy execution:
- DATA_COMMIT = SHA256(raw-source identifiers + retrieval timestamps + transform version)
- TASK_COMMIT = SHA256(canonical public task manifest)

Before each A1 acquisition:
- SELECTION_COMMIT_t = SHA256(state + admissible set + selected observation + predicted belief/action consequences + remaining budget)

After all arms terminate and before unsealing:
- RUN_COMMIT = SHA256(all arm traces)

Only then may EVALUATOR unseal Y.

## Leakage audit
FAIL CLOSED if any:
- observation.available_at > decision cutoff used by policy;
- transform uses post-cutoff/global normalization;
- manually authored directional signal;
- task IDs encode outcome;
- policy sees outcome horizon values;
- missing commitment or hash mismatch;
- unequal admissible sets/budgets;
- A2 does not exactly replay A1 acquisition IDs;
- SHUFFLE is not deterministic from precommitted seed.

## Mechanical observations
Observation values must be computed by frozen transforms from raw pre-outcome data, e.g. price return over past window, OI delta, taker imbalance, funding, cross-venue basis/disagreement, realized volatility. No human assigns bullish/bearish signs per event.

## Evaluation hierarchy
Trial 0: code/smoke only; no scientific inference.
Trial 1: historical blind replay, >=30 tasks, task manifest committed before run. Can advance CANDIDATE -> REPLICATE only.
Trial 2: prospective OOS tasks whose outcomes do not exist at task freeze. Required for PROVE.
Trial 3: independent replication across a different market/regime or non-market decision domain. Required before general claim of epistemic agency.

## Controls
A0 fixed; A1 adaptive; A2 exact replay of A1 observations; SHUFFLE cost-matched seeded random; optional ORACLE upper bound that may select with outcome access but is excluded from inferential comparison.

Primary: decision loss per total acquisition cost. Also report paired per-task delta, bootstrap CI across tasks, coverage/selective risk, budget utilization and failure counts. Never treat statistical significance as sufficient if effect is dominated by one regime/task.
