# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Architect / Energy Model Architect
- Current phase: Phase 3A — Network Kinetics / Aggregate Thermal Coupling
- Overall state: PASS — IMPLEMENTED / 06 independent validation pending
- Last updated: 2026-09-12
- Starting / latest checked main SHA: `3055ce6d2229806f4560a220ca835fb4b7f7c303`
- Active branch: `feature/phase3a-kinetics-thermal-contract`
- Active PR: #45 — `feat(02): implement Phase 3A kinetics and aggregate thermal coupling`
- Parallel 01 PR audited: #46 — head `6d04b9aa96bfce02717cb9a233ded33d29960132`
- Exact validated executable/test HEAD: `df8389155132c81d5cc4a620dfb7b6deca42ebc8`
- Validation workflow run: `34671071689` — SUCCESS

## Objective
Implement the minimal 02-owned Phase 3A kinetic/thermal semantics required by 01 multi-step network execution without implementing a second reaction-network engine.

Canonical design remains `docs/contracts/PHASE3A_NETWORK_KINETICS_THERMAL.md`.

## Implemented

### Kinetic support metadata
`ReactionEvaluation` now supports four explicit kinetic evidence classes:
- `DIMENSIONED_RATE`: provider-supplied physical `extentRateMolPerS` at the queried environment;
- `RELATIVE_RATE`: dimensionless Arrhenius-like progression/ranking signal;
- `QUALITATIVE_ONLY`: sourced/empirical rate class with no numeric extent rate;
- `OPEN`: insufficient kinetic evidence.

The executable evaluator populates support class, confidence/status, supported environment dependencies and optional reversible-channel metadata. New fields are additive/optional at the type boundary so manually-built legacy/#46 fixtures remain source-compatible.

No missing activation energy, physical rate, reverse rate, `K_eq`, or detailed-balance relationship is fabricated.

### Provider / environment semantics
The provider may optionally supply:
- dimensioned extent rate + dependency metadata;
- qualitative rate class;
- explicit detailed-balance capability for a named reversible pair.

The existing Arrhenius fallback remains `RELATIVE_RATE`; its supported dependencies are temperature, scalar activity/concentration, catalyst and phase accessibility. Pressure is not applied as a kinetic multiplier by that fallback. A provider-supplied dimensioned model declares its own supported dependency set.

### Extent input boundary
Added pure `kineticExtentInputOverDt()`:
- `DIMENSIONED_RATE` -> `requestedExtentMol = extentRateMolPerS * dt`;
- `RELATIVE_RATE` -> bounded coarse exponential progress fraction using the existing approximate timescale bridge;
- `QUALITATIVE_ONLY` / `OPEN` -> no numeric extent request.

This helper does not read or mutate species inventory. 01 remains authoritative for stoichiometric availability, shared-reactant allocation, final applied extent, conservation and network state progression.

Relative-rate extent is never promoted to VERIFIED; a nominal VERIFIED input is downgraded to APPROXIMATED at the normalized extent bridge.

### Reversibility
Candidate evaluation accepts optional `pairKey` + independent `FORWARD` / `REVERSE` channel direction. Each channel is evaluated independently. `detailedBalanceSupported` is false unless a provider explicitly asserts support for that pair/environment.

No automatic reverse barrier/rate, equilibrium assumption or `K_eq` is introduced.

### Aggregate reaction heat
`applyReactionThermalCoupling()` now:
1. annotates each committed event with its known `deltaH`/heat fact where available;
2. computes each known contribution using existing `Q_i = -deltaH_i * appliedExtent_i`;
3. sums all known contributions;
4. calls `stepThermalState()` exactly once with aggregate signed `reactionHeat_J` plus external thermal controls.

This removes reaction-event ordering from final thermal state and prevents per-event + aggregate double application.

### Partial thermal knowledge
Thermal results now populate additive metadata:
- `knownReactionHeat_J`;
- `knownContributionCount`;
- `committedContributionCount`;
- `openHeatCandidateIds`;
- `thermalCoverage: COMPLETE | PARTIAL | OPEN`.

Backward-compatible `missingHeatCandidateIds` remains.

If known and unknown-deltaH reactions coexist, known heat is applied while coverage is `PARTIAL` and overall scientific status is `OPEN`. If all committed heat contributions are unknown, known heat remains zero and coverage is `OPEN`; zero is not claimed as the physical reaction heat.

## PR #46 Compatibility Audit
PR #46 head audited: `6d04b9aa96bfce02717cb9a233ded33d29960132`.

Observed interface assumptions:
- consumes existing `runPhase2EReactionProgression()` rather than reimplementing 02 physics;
- reads `ReactionProgressEvent.heatJ` and `thermal.knownReactionHeat_J`;
- verifies event heat sum consistency;
- creates manual/fake evaluation and thermal-result fixtures using the pre-Phase-3A shape.

Compatibility response:
- existing event fields and `knownReactionHeat_J` semantics are preserved;
- new kinetic and thermal metadata are additive at the public type boundary;
- aggregate coupling still writes per-event `heatJ`, so #46 provider projections remain valid;
- final ledger heat equals the sum of known event heat but is applied thermally once;
- #46 network ownership/state progression is untouched.

Joint #45+#46 combined-branch CI remains a 07/06 integration step because #46 is a parallel unmerged PR. No exact source-level contract conflict was found.

## Validation Evidence
Exact validated executable/test HEAD: `df8389155132c81d5cc4a620dfb7b6deca42ebc8`.
Temporary validation workflow run `34671071689`: SUCCESS. The workflow file was removed afterward without changing executable/test blobs.

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- targeted Phase 3A / evaluation / progression / thermal tests: **4 files / 42 tests PASS**
  - Phase 3A kinetics/thermal: 10/10
  - reaction evaluation: 9/9
  - reaction progression: 10/10
  - thermal: 13/13
- full `npm test`: **17 files / 196 tests PASS**
- `npm run build`: PASS

The Phase 3A tests cover dimensioned-rate dt integration, relative-rate temperature/dt response, qualitative/OPEN no-fabrication, forward/reverse metadata stability, two exothermic contributions, exothermic/endothermic cancellation, event-order independence, all-OPEN heat, mixed known+OPEN heat, and no double thermal application.

## PASS / FAIL / OPEN
### PASS
- Kinetic support classification is executable.
- Missing kinetics does not become fake activation/rate data.
- Dimensioned-rate and relative-rate dt input semantics are explicit.
- Environment dependency metadata is executable.
- Forward/reverse metadata is independent and detailed balance is opt-in only.
- Aggregate known reaction heat is applied exactly once per timestep.
- Exothermic/endothermic cancellation is preserved.
- Mixed known/OPEN thermal contributions are explicitly PARTIAL/OPEN.
- Event ordering does not change aggregate heat/final sensible temperature in tested scope.
- Existing Phase 2E regression and full repository suite pass on the validated HEAD.
- #46 interfaces remain backward-compatible by audit; no second network engine was added.

### FAIL
- None identified in implemented scope.

### OPEN
- 06 independent Phase 3A validation, especially timestep convergence and forward/reverse network stability.
- Joint #45 + #46 combined-branch regression after integration ordering is chosen.
- General physical reaction-order inference and broad dimensioned rate-law data.
- Validated non-ideal activities / gas partial-pressure rate laws.
- Diffusion, transport and surface-limited kinetics.
- Full equilibrium solver / general `K_eq` path / guaranteed detailed balance.
- Stiff/adaptive network integration beyond the existing bounded/coarse hooks.
- Composition-dependent heat-capacity refresh and phase/latent-heat coupling.

## Handoffs
- 01: consume 02 kinetic support metadata / `kineticExtentInputOverDt()` as the rate-to-extent input boundary; keep all inventory/stoichiometry/network mutation ownership in 01.
- 03: supply sourced dimensioned/qualitative kinetics, thermo and provenance; absent evidence remains OPEN.
- 05: display numeric physical rate only for `DIMENSIONED_RATE`; relative/qualitative/OPEN must not be rendered as physical mol/s. Display heat coverage/status from simulation output.
- 06: independently validate competition, reverse stability, timestep sensitivity, aggregate heat/partial coverage and permutation determinism using the #45/#46 integration candidate.
- 07: choose integration order for #45/#46 and run combined regression before merge.

## Next
Independent 06 validation + combined #45/#46 integration verification. Do not proceed to a full equilibrium solver or electrochemistry from this workstream yet.
