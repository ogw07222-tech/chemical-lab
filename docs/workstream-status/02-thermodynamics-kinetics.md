# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Designer / Energy Model Architect
- Current phase: Phase 2B — Reaction Candidate Evaluation Foundation
- Overall state: IN_PROGRESS
- Last updated: 2026-09-11
- Task-start main SHA: `901f812edad16b67c0382e1a30ce744f2e6cd234`
- Latest main re-check: `a4606143e8f249e5b9a398f72c86c8171ca405b5`
- Active branch: `feature/phase2-reaction-evaluation`
- Active PR: #19 — `feat(02): add Phase 2B reaction candidate evaluation`

## Current Objective
Provide a production-facing foundation that evaluates an 01 reaction candidate through thermodynamic evidence, kinetic accessibility, environment modifiers, and deterministic competing-candidate ranking without taking ownership of candidate generation, products, stoichiometry, or reaction extent.

## Source-of-Truth / Candidate Contract
- Task started from production `main` `901f812edad16b67c0382e1a30ce744f2e6cd234`; main advanced during the task to `a4606143e8f249e5b9a398f72c86c8171ca405b5` due Phase 2 integration-coordination documentation.
- PR #19 is currently mergeable against the latest `main` re-check.
- Production runtime currently contains the Phase 1 molecular core but does not yet expose an executable `ReactionCandidate` TypeScript type.
- The canonical 01 contract in `docs/contracts/MOLECULAR_REACTION_CORE.md` defines `ReactionCandidate`, phase/access mode, `ThermodynamicsQuery`, `KineticsQuery`, and `ReactionProgressEvent` semantics.
- 02 therefore does not recreate 01 candidate generation semantics. It consumes candidates through a generic `ReactionCandidateAdapter<TCandidate>` producing a narrow read-only `ReactionCandidateEvaluationView`. When 01 publishes the executable type, only an adapter is required.

## Implemented Foundation
Added `src/simulation/reaction-evaluation/`:
- `types.ts`
  - `ReactionEvaluation`
  - thermodynamic / kinetic / environment outputs
  - canonical scientific statuses: VERIFIED / APPROXIMATED / EMPIRICAL / GAMEPLAY_SIMPLIFICATION / OPEN
  - 03-facing `ReactionEvaluationDataProvider`
  - generic 01 candidate adapter boundary
- `evaluator.ts`
  - direct reaction thermochemistry precedence
  - formation-thermochemistry reconstruction
  - bond-energy-assisted approximation hook
  - structural approximation hook
  - explicit OPEN fallback
  - deltaG calculation only when sufficient data exists
  - Arrhenius-compatible relative-rate model
  - activation-barrier known/unknown handling
  - catalyst barrier/rate correction without changing thermodynamics
  - coarse phase accessibility classification/factor
  - temperature, pressure relevance, activity placeholder, catalyst modifier outputs
  - final feasibility/status/reason-code/rank-score calculation
- `ranking.ts`
  - deterministic score ordering
  - stable candidateId tiebreak ordering
  - equal-score tie preservation
  - unavailable/OPEN scores sorted last with `rank=null`
- `index.ts`
  - public module exports

## Thermodynamic Model
Resolution order:
1. direct validated reaction thermochemistry from the provider;
2. phase-specific formation thermochemistry;
3. bond-energy-assisted enthalpy approximation;
4. coarse structural enthalpy approximation;
5. OPEN.

Rules:
- authoritative energies are J/mol and entropy is J/(mol*K);
- when both deltaH and deltaS exist, `deltaG = deltaH - T*deltaS`;
- when entropy is absent, deltaG is not fabricated;
- formation Gibbs energy may provide deltaG when available even if explicit entropy is missing;
- result status/confidence/source IDs propagate from data inputs;
- bond/structural fallback cannot silently claim VERIFIED precision.

## Kinetic Model
- Uses non-negative activation energy in J/mol when available.
- Relative temperature contribution is Arrhenius-compatible: `exp(-Ea/(R*T))`.
- Absolute dimensional rate constants are not invented because reaction order/mechanism dimensions are not yet authoritative.
- `relativeRate` is dimensionless and intended for candidate comparison only.
- Coarse classes: NEGLIGIBLE / SLOW / MODERATE / FAST / VERY_FAST / UNKNOWN.
- Missing activation barrier yields UNKNOWN + OPEN, not fake kinetic PASS.
- `activityScale` is an explicit dimensionless placeholder until rate-law/reaction-order contracts exist.

## Catalyst Invariant
- Catalyst may reduce effective activation barrier and/or multiply kinetic rate contribution.
- Catalyst never changes deltaH, deltaS, deltaG, or thermodynamic direction.
- Catalyst scientific status/confidence propagates into the kinetic result.

## Phase Accessibility
Current coarse deterministic categories:
- GAS_GAS
- SOLUTION
- HETEROGENEOUS
- SOLID_SOLID_LOW
- UNKNOWN

These are accessibility/transport placeholders only. They do not calculate phase state. Phase determination remains owned by the existing thermal/phase architecture. Unknown phase propagates OPEN.

## Tests Added
`tests/reaction-evaluation.test.ts` covers:
- exothermic sign;
- endothermic sign;
- deltaG direction sanity;
- missing entropy handling;
- higher relative rate at higher T for positive Ea;
- catalyst changes kinetics but not deltaG;
- OPEN propagation;
- missing data does not become fake PASS;
- deterministic ranking and ties;
- invalid absolute-temperature rejection / SI boundary sanity.

## Validation Performed
- Repository clone / `npm ci` could not be executed in the local sandbox because github.com DNS resolution is unavailable.
- Reconstructed the implementation source locally and ran strict TypeScript compile with available `tsc 5.8.3`: PASS.
- Compiled test source against a minimal local Vitest declaration for type/shape validation: PASS.
- Direct executable Node harness: PASS for thermodynamic sign/direction, Arrhenius temperature response, catalyst thermodynamic invariance, OPEN propagation, and ranking execution.
- Actual repository `npm ci`: OPEN due network/DNS environment.
- Actual repository `npm run typecheck`: OPEN locally; source-equivalent strict compile PASS.
- Actual repository `npm run lint`: OPEN locally because repository dependencies cannot be installed.
- Actual repository `npm test`: OPEN locally; committed Vitest suite awaits dependency-enabled CI/06/07.
- Actual repository `npm run build`: OPEN locally because Vite dependencies cannot be installed.

## PASS / FAIL / OPEN
### PASS
- Phase 2B reaction-evaluation module implemented within 02 ownership.
- Scientific status propagation implemented.
- No missing-data precision fabrication.
- DeltaG calculation and direction logic implemented when evidence is sufficient.
- Thermodynamically favorable and kinetically slow/unknown states remain distinguishable.
- Catalyst changes kinetics without rewriting thermodynamics.
- Deterministic ranking/tie interface implemented.
- Pure evaluator has no hardcoded thermochemical database.
- PR #19 currently reports mergeable against latest main.

### FAIL
- None identified in source-equivalent strict compile/runtime harness.

### OPEN
- Dependency-enabled repository npm ci/typecheck/lint/test/build run.
- Scientific benchmark validation by 06.
- Executable 01 `ReactionCandidate` type and production adapter.
- Absolute/dimensioned rate-law contract and reaction-order inference.
- Calibrated rate-class thresholds.
- Data-backed phase accessibility factors / transport behavior.
- Full competing-reaction extent/flux solver.

## Required 03 Data
Provider adapters should eventually expose, in canonical SI with provenance/status/confidence:
- phase-specific standard enthalpy of formation, J/mol;
- phase-specific standard molar entropy, J/(mol*K);
- phase-specific standard Gibbs energy of formation, J/mol;
- direct trusted reaction thermochemistry where available;
- molecule-specific or clearly labeled average bond-energy records for fallback approximation;
- activation-energy/barrier data and optional pre-exponential/rate-law data where available;
- catalyst-specific empirical barrier/rate corrections where evidence exists.

No bulk constants are embedded in the evaluator.

## Limitations
- Formation-property calculation assumes the adapter supplies correct stoichiometric coefficients and phase-resolved species keys; 02 does not validate 01 stoichiometry semantics.
- Standard-state thermochemistry is not yet corrected for full non-ideal concentration/activity effects.
- Current phase-accessibility factors are coarse APPROXIMATED placeholders, not validated transport models.
- `relativeRate` is dimensionless and not an absolute reaction rate.
- Rank score is a deterministic comparison heuristic, not reaction extent or probability.
- Strongly reverse-favored thermodynamics is classified infeasible in this foundation, but future nonequilibrium/electrochemical/external-driving channels require explicit coupled-energy semantics rather than hidden exceptions.

## Future Reaction-Resolution Requirements
A later reaction-resolution layer must:
1. consume ranked/evaluated candidates;
2. compute dimensioned forward/reverse fluxes where supported;
3. resolve shared-reactant competition;
4. respect stoichiometric maximum extent from 01;
5. integrate actual timestep extent without negative amounts;
6. emit `ReactionProgressEvent` for thermal coupling;
7. preserve deterministic ordering/tie behavior;
8. support reversible/equilibrium channels rather than choosing only the top rank.

## Handoffs
- 01: publish executable `ReactionCandidate` / `ReactionProgressEvent` types matching the canonical contract; provide an adapter or stable import boundary. 02 will not duplicate graph/product/stoichiometry logic.
- 03: implement provider adapters for thermochemistry, bond-energy fallback, kinetic barriers, catalyst empirical corrections, and provenance/status propagation.
- 04: pass only explicit environmental controls/catalyst selections; do not decide chemistry outcomes.
- 06: execute committed Vitest suite, then add scientific benchmark fixtures for thermo sign/direction, Arrhenius response, catalyst invariance, OPEN propagation, ranking determinism, and phase accessibility.
- 07: run repository npm ci/typecheck/lint/test/build and integrate only after normal review/CI gates.
