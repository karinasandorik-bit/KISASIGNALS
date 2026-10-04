# ACTIVE-EPISTEMIC-CONTROL-001 — frozen preregistration

Status: PREREGISTERED / NOT YET EVIDENCE OF EFFECT
Design: historical replay with real hidden outcomes; prospective OOS replication required before promotion.

## Claim
Adaptive observation selection can reduce decision loss per acquisition cost relative to a fixed evidence policy under equal budgets.

## Arms
- A0 FIXED: deterministic observation order frozen before outcomes.
- A1 ADAPTIVE: chooses the next admissible observation from the currently revealed state before acquisition.
- A2 REPLAY: receives A1's selected observations, separating information content from selection policy.
- SHUFFLE: deterministic seeded cost-matched random selection.

All arms receive identical hypotheses, initial evidence, action set, observation catalogue, budget and decision rule family.

## Anti-leakage
Each task has cutoff_at < every observation.available_at <= outcome_at. Policies see only observation metadata (id/type/cost/available_at) until purchase. Hidden values and outcome are stored in the benchmark fixture but are never passed to policy functions. Every A1 selection is committed before reveal as SHA-256(canonical commitment).

## Budget
Per-task budget = 3 cost units. Observation costs are positive integers. No arm may exceed budget.

## Primary endpoint
For arm p:
J(p) = sum_i decision_loss(D_i,Y_i) / sum_i acquisition_cost_i.
Primary contrast: Delta_10 = J(A0) - J(A1).
Lower J is better. H0: Delta_10 <= 0.

Decision loss is 0 for correct directional action, 1 for NO_TRADE when a predeclared material move occurs, and 2 for wrong directional action. Materiality threshold is frozen per task before evaluation.

## Secondary endpoints
Raw decision loss; accuracy conditional on TRADE; NO_TRADE missed-opportunity rate; cost; selection overlap; per-task regret.

## Promotion rule
No capability promotion from the historical replay alone. A1 may advance to PROVE only if it beats A0 and SHUFFLE on aggregate J without greater budget and the gain is not confined to one task. INHERIT requires a separately frozen prospective OOS batch.

## Falsification
Reject/demote the active-selection claim if A1 fails to beat A0 on primary J, exceeds budget, uses post-cutoff unavailable evidence, selection commitment is missing/mismatched, or advantage disappears in prospective OOS replication.

## Isolation
This benchmark MUST NOT execute trades, mutate production MetaGate/model state, or train on hidden outcomes.
