# Phase 2D Reaction Engine Validation Matrix

Owner: 06 - Simulation Validation Lab
Threshold authority: `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`
Scope: validation only; no reaction/thermo/kinetic tuning.

## Purpose

This matrix validates a future Phase 2 reaction candidate/evaluation engine through an adapter boundary. It intentionally does not implement candidate generation, thermodynamics, kinetics, or reaction-specific production lookup logic.

`ReactionValidationAdapter` converts production 01/02 outputs into the stable validation view defined in `src/validation/reaction.ts`.

## Matrix

| Area | Executable gate | Verdict rule | Owner on defect |
| --- | --- | --- | --- |
| Atom/element conservation | exact inventory comparison | any violation = FAIL | 01 |
| Charge conservation | exact net charge comparison | any violation = FAIL | 01 |
| Explicit electron bookkeeping | exact when represented | any violation = FAIL | 01 |
| Structural validity | over-valence/bond/dangling/mapping/graph/numeric flags | invalid accepted product = FAIL | 01 |
| Candidate duplicate sanity | ID + canonical-key uniqueness | duplicate accepted output = FAIL | 01 |
| Candidate ordering | same input/config replay | changed order/output = FAIL | 01 |
| Positive control | reference says generic candidate should exist | missing candidate = FAIL when reference eligible | 01/03 |
| Negative control | no candidate or later infeasible/OPEN evaluation | feasible candidate = FAIL; unresolved data = OPEN | 01/02/03 |
| Thermochemistry sign | reference-backed deltaH sign | wrong sign = FAIL; missing data = OPEN | 02/03 |
| Reaction direction | reference-backed deltaG/direction | reversed major direction = absolute FAIL | 02/03 |
| Kinetic temperature response | positive Ea, controlled conditions | reversed rate trend = FAIL | 02 |
| Catalyst separation | catalyst changes kinetics, not equilibrium | equilibrium changed by catalyst = FAIL | 02 |
| Relative rate order | reference-backed candidate ranking | wrong order = FAIL; missing rates = OPEN | 02/03 |
| Unknown barriers/data | explicit availability/status | OPEN, never guessed PASS | 02/03 |
| Candidate explosion | counters + runtime observation | engineering budget only; not scientific threshold | 01/07 |

## Performance Observability

Every adapter run should expose reactive site count, eligible pair count, raw candidate count, deduplicated candidate count, pruned candidate count, and runtime in milliseconds.

Engineering budgets must be supplied separately by 01/00/07. A runtime or candidate-count budget is not a scientific acceptance threshold and must not be added to `REAL_EXPERIMENT_VALIDATION.md` by 06.

## Reference Data

03 reference benchmarks may provide expected reaction/no-reaction, thermochemical sign/direction, product identity, kinetic ranking, or quantitative observations when provenance and eligibility requirements are satisfied. At the time this matrix was created, no populated `benchmarks/` corpus exists on main, so no real-experiment numerical score is claimed.

No new experimental numerical values are introduced by this matrix.

## Reporting

When eligible data exists, reports should include case counts and PASS/FAIL/OPEN counts, qualitative accuracy, and existing benchmark aggregates such as median/P90/max/bias. Candidate-generation reports additionally include the performance counters above.

Until a production Phase 2 engine and eligible corpus exist, tooling/matrix tests can PASS while scientific engine validation remains OPEN.
