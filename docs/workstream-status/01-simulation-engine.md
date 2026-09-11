# 01 — Chemistry Simulation Engine

- Owner: Lead Chemistry Simulation Engine Developer / Reaction Solver Architect / Stoichiometry Engine Developer
- Current phase: Phase 2E — Reaction Resolution & State Progression
- Overall state: IN_PROGRESS
- Last updated: 2026-09-11
- Starting main SHA: `f282443e9b1c07f082fa43d2bcf7061c275d758a`
- Latest main re-check during task: `fb1b1ed4605eca26745629d82812e216a139cc0c`
- Active branch: `feature/phase2e-reaction-state-progression`
- Active PR: #33 — `feat(sim): add Phase 2E reaction state progression`

## Current Objective
Implement the first deterministic production state-progression slice after candidate evaluation/ranking: competing-reaction resolution, bounded reaction extent, stoichiometric species mutation, post-mutation conservation, reaction progress events, and thermal handoff without duplicating 02 thermodynamics/kinetics.

## Implemented
- Added `src/simulation/reaction-progression/` as the canonical Phase 2E progression module; duplicate progression paths were removed so there is one ownership path.
- Added deterministic shared-reactant competition by rank group. Equal-rank candidates share group-start inventory through proportional demand scaling instead of candidateId-first winner selection.
- Added bounded APPROXIMATED extent using 02 `relativeRate`, `dtS`, stoichiometric maximum extent, configured maximum fractional consumption, and a documented coarse timescale.
- Default mutation defers INFEASIBLE, UNCERTAIN, unranked/OPEN, missing-rate, negligible-rate, and zero-initial-reactant candidates under the production evaluation/ranking contract.
- Added product registry boundary: product graphs must map to an existing `SpeciesState` with matching canonical molecular identity; unresolved products are deferred and no species ID is invented.
- Added finite/non-negative amount mutation, no-overconsumption guarantees, concentration-hint invalidation, and post-mutation element/atom/net-charge conservation re-check.
- Added deterministic `ReactionProgressEvent` records with actual extent and species deltas.
- Added thermal coupling through existing 02-owned `reactionHeatToSystem()` / `stepThermalState()` primitives using actual applied extent and existing `deltaH_J_per_mol`; missing enthalpy produces OPEN with no fabricated heat.
- External thermal controls remain separate from reaction heat; reaction energy cannot bypass actual extent plus 02 thermochemical evidence.
- Added canonical integration function `runPhase2EReactionProgression()`.
- Added `docs/contracts/REACTION_PROGRESSION_V1.md`.

## Timestep Semantics
1. Read current authoritative species/thermal state.
2. Generate structural candidates.
3. Evaluate/rank with existing 02 layer at current environment.
4. Resolve ranked groups and shared-reactant competition.
5. Compute bounded extents from current available amounts.
6. Apply stoichiometric species amount changes.
7. Re-check state conservation; mismatch is an explicit error.
8. Emit deterministic progress events.
9. Apply reaction heat only where 02 supplies deltaH, then apply external thermal controls.
10. Return next state plus `phaseReevaluationRequired`; no phase solver is implemented here.

Newly formed products do not trigger another reaction inside the same v1 timestep. They become eligible on the next timestep, avoiding hidden intra-step cascades.

## Tests Added
`tests/reaction-progression.test.ts` covers:
- limiting-reactant bounds;
- no negative amounts / no overconsumption;
- explicit atom inventory conservation before/after mutation;
- shared-reactant tie competition;
- deterministic repeated resolution/event ordering;
- invalid dt;
- NaN and positive/negative Infinity amount rejection;
- unresolved product deferral;
- zero-extent handling;
- actual-extent reaction heat;
- thermal ledger reaction-heat accounting;
- missing-deltaH OPEN behavior with no fabricated heat.

A synthetic-but-contract-valid pre-registered product fixture is used because dynamic generated-species registration/persistence is not yet production functionality. A fully data-backed generated-candidate -> known-product progression fixture remains OPEN until the current chemistry/data set exposes a stable suitable case without reaction-specific hardcoding.

## Validation
- Local `git clone` / `npm ci`: BLOCKED because the execution environment cannot resolve `github.com`.
- Repository-native `npm run typecheck`, `npm run lint`, targeted/full `npm test`, and `npm run build`: OPEN pending dependency-enabled CI/Codespaces/06/07 validation.
- PR #33 currently has no applicable GitHub Actions workflow run for this code path.
- Source-level contract audit against production reaction candidate, reaction evaluation/ranking, molecular conservation, integration, and thermal primitives: PASS.

## PASS / FAIL / OPEN
### PASS
- Deterministic competing-reaction resolver exists.
- Stoichiometric maximum extent and shared-reactant overconsumption protection exist.
- Species mutation remains finite/non-negative and re-checks conservation.
- Unknown product identities cannot mutate state.
- Reaction heat uses actual applied extent and existing 02 deltaH only.
- Missing deltaH never creates invented heat.
- 01 does not recalculate deltaG, activation barriers, Arrhenius terms, equilibrium, catalyst physics, or phase state.

### FAIL
- None established in the source/contract audit.

### OPEN
- Dependency-enabled full regression/typecheck/lint/build.
- 06 numerical/timestep-sensitivity validation.
- Absolute physical rate laws; v1 extent is explicitly APPROXIMATED from dimensionless relative rate.
- Dynamic Species Registry & Generated Species Persistence.
- Composition-dependent heat-capacity refresh after species mutation.
- Full phase re-evaluation after thermal/state update.
- Full reversible equilibrium/network/ODE integration.
- Electrochemistry.

## Handoffs
- 02: continue owning evaluation, relative-rate semantics, reaction enthalpy, and thermal models. Phase 2E consumes these outputs but does not redefine them.
- 03: no new hardcoded chemistry data is introduced; future physical rate/thermal fidelity still requires normalized data/provenance.
- 04: gameplay may supply environmental controls but does not mutate chemistry/temperature directly.
- 06: validate conservation, determinism, timestep sensitivity, tie/shared-reactant allocation, no-negative invariant, product deferral, and reaction-heat ledger accounting.
- 07: run dependency-enabled `npm ci`, typecheck, lint, targeted/full tests, and build before integration.

## Next
After Phase 2E validation/integration: **Dynamic Species Registry & Generated Species Persistence**. Do not move to electrochemistry yet.
