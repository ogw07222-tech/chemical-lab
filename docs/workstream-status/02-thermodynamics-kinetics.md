# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Architect / Energy Model Architect
- Current phase: Phase 2E boundary — evaluation outputs consumed by state progression
- Overall state: IN_PROGRESS
- Last updated: 2026-09-11
- Starting main SHA for Phase 2E: `f282443e9b1c07f082fa43d2bcf7061c275d758a`
- Latest main re-check during task: `fb1b1ed4605eca26745629d82812e216a139cc0c`
- Shared implementation branch: `feature/phase2e-reaction-state-progression`
- Shared PR: #33 — `feat(sim): add Phase 2E reaction state progression`

## Phase 2E Ownership Boundary
02 remains authoritative for:
- thermodynamic direction / feasibility evidence;
- deltaH/deltaG where supported;
- kinetic accessibility and dimensionless `relativeRate`;
- deterministic rank score/ties;
- catalyst/environment modifiers;
- reaction heat and thermal primitives.

01 consumes those results for bounded extent, shared-reactant competition, stoichiometric mutation, conservation, and state transition. 01 does not recompute deltaG, activation barriers, Arrhenius terms, equilibrium, catalyst physics, or phase state.

## New Consumption Contract
- `RankedReactionEvaluation` is the authoritative 02 -> 01 evaluation snapshot.
- Production ranking naturally leaves unsupported/OPEN evaluations unranked; INFEASIBLE, UNCERTAIN, unranked, missing-rate, and negligible-rate paths are rejected/deferred by the Phase 2E resolver unless an explicit controlled-test option permits uncertainty.
- `kinetics.relativeRate` remains dimensionless and is not a physical rate constant.
- The v1 extent bridge is explicitly `APPROXIMATED`: 01 combines the 02 relative-rate signal with `dtS`, a configured coarse timescale, stoichiometric maximum extent, and a hard maximum fractional-consumption bound.
- `thermo.deltaH_J_per_mol` is consumed only after 01 has produced an actual applied extent.
- Existing `reactionHeatToSystem()` remains the only reaction-heat formula: `Q = -deltaH * actualExtent`.
- Thermal coupling runs deterministically in `ReactionProgressEvent` order and writes through the existing thermal energy ledger.
- If deltaH is absent, no heat is fabricated; the event/coupling result propagates `OPEN`.

## Canonical Timestep / Thermal Semantics
1. Read current authoritative species + thermal state.
2. 01 generates structurally/conservation-valid candidates.
3. 02 evaluates feasibility, kinetics, environmental modifiers, and deterministic ranking at the current environment.
4. 01 resolves equal-rank shared-reactant competition and computes bounded applied extents.
5. 01 applies stoichiometric amount mutation and re-checks conservation.
6. 01 emits deterministic `ReactionProgressEvent` records containing actual extent and species deltas.
7. 02 computes `Q = -deltaH * appliedExtent` only when deltaH exists and updates the thermal ledger/state.
8. Existing external heater/cooler/thermostat inputs are applied through the thermal model.
9. The next deterministic species/thermal state is returned.
10. Phase re-evaluation remains an explicit OPEN hook; no phase result is invented in Phase 2E.

## Extent / Kinetics Scientific Meaning
The v1 normalized extent bridge is not an absolute physical rate law. Its documented conversion is:

`fraction = min(maxFractionPerStep, 1 - exp(-relativeRate * dt / coarseRateTimescale))`

The 02 contribution is the dimensionless `relativeRate`; stoichiometric maximum extent, competition allocation, and authoritative mutation remain 01-owned. The resulting extent remains `APPROXIMATED` and may not be promoted to `VERIFIED` without a dimensioned rate-law model plus validation evidence.

## Reaction Heat / Thermal Coupling
- Exothermic `deltaH < 0` gives positive heat into the thermal system.
- Endothermic `deltaH > 0` removes thermal energy.
- Heat magnitude uses actual applied extent after shared-reactant scaling, never requested/preliminary extent.
- Missing deltaH yields no heat term and marks thermal coupling OPEN.
- Existing thermal ledger records the known reaction-heat contribution.
- Current mixture/vessel sensible heat capacity is reused; composition-dependent Cp recomputation after reaction progress remains OPEN.
- Thermal state remains simulation-owned; UI does not write temperature directly.

## Tests / Validation Scope
`tests/reaction-progression.test.ts` covers:
- limiting-reactant bounding and no negative amounts;
- explicit atom-inventory conservation before/after mutation;
- equal-rank shared-reactant competition / no overconsumption;
- deterministic repeated resolution and event ordering;
- invalid dt plus NaN/positive-Infinity/negative-Infinity species rejection;
- unresolved product identity deferral without invented IDs;
- zero-extent/negligible kinetics handling;
- heat magnitude from actual applied extent;
- reaction-heat ledger accounting;
- missing-deltaH OPEN behavior with no fabricated heat.

A synthetic-but-contract-valid pre-registered-product fixture validates progression mechanics. A complete generated-candidate -> real-data evaluation -> known registered product production case remains OPEN until current production chemistry/data exposes a stable suitable fixture without reaction-specific hardcoding.

## Scientific Status
### PASS
- Phase 2E reuses existing 02 evaluation and thermal contracts without duplicating thermo/kinetics formulas.
- Thermodynamic feasibility and kinetic accessibility stay separate.
- Reaction heat is based on actual applied extent after competition resolution.
- Missing enthalpy remains OPEN and creates no invented heat.
- Catalyst/thermodynamic invariants remain unchanged.
- Same state/evaluations/dt/options produce deterministic competition/event/thermal ordering by construction.

### FAIL
- None established in the source/contract audit.

### OPEN
- Dependency-enabled repository-native `npm ci`, typecheck, lint, targeted/full tests, and build for PR #33.
- PR #33 currently has no applicable GitHub Actions workflow run for this code path.
- Scientific/timestep-sensitivity validation by 06.
- Absolute dimensioned rate-law inference and calibrated rate constants.
- Full equilibrium/reversible flux solver.
- Composition-dependent mixture heat-capacity refresh after reaction progress.
- Phase re-resolution/latent-heat orchestration after each progression step.
- Dynamic Species Registry & Generated Species Persistence.

## 01 / 03 / 04 / 06 Handoff
- 01: own stoichiometric availability, shared-pool allocation, state mutation, conservation failure, and deterministic progress events. Do not infer thermo/kinetics.
- 03: continue providing SI thermochemistry/barrier data and provenance; Phase 2E introduces no hardcoded chemistry constants.
- 04: external heater/cooler/thermostat/catalyst controls remain typed inputs; gameplay must not set authoritative reaction outcomes or temperature.
- 06: validate conservation, no-negative invariant, deterministic tie/shared-reactant allocation, timestep sensitivity, OPEN/deferred handling, and reaction-heat ledger sign/magnitude from actual extent.

## Next
After Phase 2E is validated/integrated: **Dynamic Species Registry & Generated Species Persistence**. Electrochemistry remains out of scope.
