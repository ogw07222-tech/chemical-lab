# 06 — Simulation Validation Lab

- Owner: Chemistry Simulation Validation Engineer / Regression Test Developer / Scientific Model Auditor / Performance Validation Engineer
- Current phase: Phase 3B reversible pair arbitration independent validation
- Overall state: PHASE3B_REVERSIBLE_VALIDATION_PASS / EXACT_HEAD_ONLY
- Last updated: 2026-09-12
- Latest production main SHA checked: `36b82d9b9101819768970c39694c9139b2ee47bc`
- Upstream 02 PR #51 exact source HEAD: `116cfa30192556b3236f4f2814000ad971361bac`
- 01 PR #52 exact source HEAD: `aadd8d28312f85e99903bc1b731faffd4ac7de94`
- Independent validation branch: `validation/06-phase3b-reversible`
- Exact tested validation HEAD: `7a576ba74e72ab969ca7df4c837efb09aab2a771`
- Final validation run: `34687958351` — SUCCESS

## Objective
Independently validate the exact stacked executable semantics of PR #51 + PR #52 without chemistry tuning, threshold relaxation, or production feature changes.

## Source equivalence
- PR #51 current HEAD remains `116cfa30192556b3236f4f2814000ad971361bac`.
- PR #51 executable/test reference HEAD `5fcc62a05189ad7759596892ae30ab2a5b829998` differs from current HEAD only by temporary workflow removal plus docs/status changes; executable/test blobs are equivalent.
- PR #52 current HEAD remains `aadd8d28312f85e99903bc1b731faffd4ac7de94` and is based on exact PR #51 HEAD `116cfa30192556b3236f4f2814000ad971361bac`.
- PR #52 executable/test reference HEAD `888eb99b0a2e11988db63866505eabf9f9eb6026` differs from current HEAD only by temporary workflow removal plus docs/status changes; executable/test blobs are equivalent.
- Production main advanced from the original Phase 3B baseline only through PR #53 UI workstream documentation; no Phase 3B executable source changed on main.

## Independent validation result
PASS:
- 02 authority boundary for Q/K, ln(Q/K), equilibrium direction, near-equilibrium policy, driving strength, and crossing bound.
- explicit reversible `pairId` + direction identification only; no implicit chemistry/text/id pairing.
- forward/reverse directional arbitration and symmetry.
- near-equilibrium zero coarse net progression without composition snap or heat.
- INDETERMINATE scientific abstention with no fabricated suppression/cap.
- anti-ping-pong across six starting regimes and repeated timesteps.
- crossing/anti-overshoot bound respected under deliberately excessive kinetic request.
- no simultaneous determinate forward/reverse matter/event/heat commit.
- Phase 3A aggregate thermal application remains once per timestep; reverse heat sign semantics preserved.
- conservation, finite/non-negative state, and Dynamic Species Registry regressions.
- surviving reversible channel still enters normal shared-reactant competition.
- candidate permutation determinism and repeated deterministic replay.
- OPEN / QUALITATIVE_ONLY kinetics never become numeric from equilibrium driving strength.
- generated-species same-step prohibition, next-step participation, and unknown-phase INDETERMINATE semantics.
- transactional registry/progression path remains atomic under existing exact-stack regression tests.
- 128 deterministic pseudo-random positive-state validation cases.
- qualitative timestep sensitivity at dt 1 / 0.5 / 0.25 over the same total duration: no direction reversal, runaway, oscillation, nonfinite state, or conservation loss.

OPEN / WATCH:
- no canonical absolute performance acceptance threshold exists. Synthetic GitHub-runner observation for 2000 pair arbitrations was approximately 370–493 ms depending on surrounding suite load; this is an environment-local measurement, not a scientific or engineering PASS threshold.
- quantitative timestep-convergence/error threshold for a stiff reversible solver is not established; only the current coarse qualitative stability contract is validated.
- general equilibrium composition solving, detailed balance enforcement, stiff reversible-network integration, K(T), nonideal activities/fugacity/ionic strength, coupled phase equilibria, transport limits, and multi-pair coupled equilibrium remain outside this slice.

## Final strict run
Workflow `34687958351`, exact tested HEAD `7a576ba74e72ab969ca7df4c837efb09aab2a771`:
- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS — 0 errors; one inherited UI `react-hooks/exhaustive-deps` warning
- targeted Phase 3B / Phase 3A / progression / thermal / registry: **12 files / 137 tests PASS**
- independent 06 Phase 3B validation file: **12/12 PASS**
- full `npm test`: **23 files / 273 tests PASS**
- `npm run build`: PASS

An earlier validation run failed only because the 06-only test fixture type was narrowed to the literal gas phase. The validation harness was corrected without modifying PR #51/#52 production code. No production failure was hidden or tuned away.

## Integration decision
**PHASE3B_REVERSIBLE_VALIDATION_PASS**

06 approves integration only for the exact source combination:
- PR #51: `116cfa30192556b3236f4f2814000ad971361bac`
- PR #52: `aadd8d28312f85e99903bc1b731faffd4ac7de94`

07 must preserve these validated executable/test semantics when refreshing the stacked PRs onto latest main `36b82d9b9101819768970c39694c9139b2ee47bc`. Any executable/test change to either source HEAD invalidates this approval until equivalence is proven or 06 revalidates.

## No tuning
No tuning performed.
