# Phase 4A-1 — 06A Independent Validation

Validation-only branch. Do not merge automatically into production.

- Production main checked: `555c6e74ef94a9c06416fb80ce703980ce6a1889`
- PR #57 final source HEAD checked: `86dad8298be2997370fc529ab9e07179aba843d7`
- Source executable/test HEAD: `6e7b45f62e0a6822b53a77b179e0445ba1f9b83e`
- Tested validation HEAD: `bef280edaf267b9970a19d828191cbf4cc0e9764`
- Validation branch: `validation/06a-phase4a1-compartment`
- Workflow run: `34693004008`
- Status: `PHASE4A1_INDEPENDENT_VALIDATION_FAIL`
- Merge allowed: `NO`
- Authority: 06A independent validation; final overall 06 status remains owned by 06/HQ.

## Independent failures

1. **System aggregation order invariance** — FAIL.
   The same semantic compartment set produced different floating-point totals when compartment order changed. Observed H2 species total `1` vs `1.0000000000000002`, H element / atom amount `2` vs `2.0000000000000004`.
2. **Connection kind validation** — FAIL.
   A runtime-invalid connection with kind `SOLID` was accepted and the transfer committed, although the Phase 4A-1 topology contract permits only `GAS | LIQUID` and requires connection kind validity.

## Confirmed passes

- invalid transfer amounts: zero, negative, NaN, +Infinity, -Infinity reject atomically
- directed reverse connection rejection
- incoming matter cannot fund outgoing matter in the same transaction
- conflicting SpeciesId canonical identities reject
- competing source demand request-order invariance
- deterministic replay
- seeded deterministic randomized valid-transfer conservation
- 500-cycle A -> B -> C -> A long-sequence finite/non-negative/conservation stability
- existing Phase 4A-1 + Phase 3A + Phase 3B + Dynamic Species Registry + progression + thermal targeted regression: 84/84 pass
- typecheck pass
- lint pass with one inherited UI hooks warning and zero errors
- production build pass

Performance remains OPEN because no canonical performance threshold was established and this validation did not define a new one.
