# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Architect / Energy Model Architect
- Current phase: Phase 4A-3 — Thermal Apparatus / Heat Transfer / Temperature Evolution
- Overall state: PASS — IMPLEMENTATION COMPLETE / independent thermal validation pending
- Last updated: 2026-09-13
- Starting / latest checked main SHA: `28b85072ada9865d76d3e7874f926490558a198c`
- Active branch: `feature/phase4a3-thermal-apparatus`
- Active PR: #68 — `feat(02): add Phase 4A-3 thermal apparatus engine`
- Exact validated executable/test HEAD: `7647c21b585366441726e70c7855f3a2e4f6817c`
- Validation workflow run: `34748579195` — SUCCESS

## Objective
Extend the existing thermal primitives with deterministic finite-body heat transfer, external heater/cooler/reservoir energy accounting, apparatus topology, phase-specific mixture heat-capacity evaluation, and authoritative temperature evolution. Existing reaction-heat and sensible-energy behavior is retained rather than replaced.

Canonical contract: `docs/contracts/PHASE4A3_THERMAL_APPARATUS.md`.

## Implemented
- Reuses existing `ThermalState`, `applySensibleEnergy()`, `stepThermalState()`, and reaction heat sign/ledger semantics.
- Adds optional `internalTransferHeat_J` for auditable finite body-to-body exchange.
- `evaluateMixtureHeatCapacity()` computes `C = Sum(n_i Cp_i)` from unambiguous phase-matched caller/03 data. Missing/generated/ambiguous Cp is `OPEN`; no component is silently treated as zero.
- Finite `CONTACT | BATH | CONVECTION` transfer uses caller-supplied W/K conductance and closed-form exponential relaxation toward heat-capacity-weighted equilibrium.
- Multiple simultaneous contacts are evaluated from one snapshot, canonical ordered, then deterministically normalized to the snapshot thermal envelope while preserving equal-and-opposite transfer energy.
- `AMBIENT | CONTROLLED_CHAMBER` reservoir boundaries are explicit external approximations with signed external-energy accounting.
- `HEATER | COOLER` power actuators use `Q=P*dt`; optional target temperature bounds actuator contribution but never assigns current temperature.
- Hot Plate: external heater -> finite plate -> CONTACT -> vessel.
- Heating Bath: external heater -> finite bath -> BATH -> vessel.
- Cooling Bath: vessel -> BATH -> finite cold bath; optional external cooler acts on bath.
- Hot-Air Chamber: finite chamber gas -> CONVECTION -> vessel, or explicitly external controlled-reservoir approximation.
- Existing actual-applied-extent reaction heat is consumed once as a signed source and combined with apparatus/ambient contributions before one sensible temperature update.
- Invalid/non-finite conductance, power, heat-capacity support, energy, or non-positive-K temperature result becomes explicit reject/OPEN rather than NaN propagation.

## Timestep Semantics
1. snapshot temperature/state;
2. reaction progression uses snapshot temperature;
3. applied reaction extent yields signed reaction heat;
4. applicable matter transport commits;
5. thermal apparatus/contact/ambient exchange evaluates from the thermal snapshot;
6. reaction + internal + external energy aggregates once;
7. temperature commits;
8. pressure/provider projection follows as applicable;
9. next-step kinetics consumes updated temperature.

No same-step cyclic Arrhenius/temperature dependency is introduced.

## Energy Accounting
For finite modeled bodies:

`DeltaE = Q_internal + Q_reservoir + Q_heater - Q_cooler + Q_reaction`

Internal finite-body transfers sum to zero, therefore:

`Sum(DeltaE_finite) = externalEnergyJ + reactionEnergyJ`

subject only to floating-point representation.

## Validation Evidence
Exact executable/test HEAD `7647c21b585366441726e70c7855f3a2e4f6817c`, temporary workflow run `34748579195`: SUCCESS.

- `npm ci`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS with 0 errors; one pre-existing `src/ui/provider.tsx` hooks warning
- Phase 4A-3: **34/34 PASS**
- targeted: **9 files / 139 tests PASS**
  - thermal 13
  - Phase 3A kinetics/thermal 10
  - Phase 3B equilibrium 15
  - Phase 3B progression 13
  - Phase 3B reversible arbitration 16
  - reaction progression 10
  - Phase 4A-1 17
  - Dynamic Species Registry 11
- full suite: **28 files / 335 tests PASS**
- `npm run build`: PASS

Temporary branch validation workflow was removed after the successful exact-head run.

## Phase 4A-2 Compatibility
**OPEN / NOT RUN ON THIS BRANCH.** PR #67 was still unmerged when this focused Phase 4A-3 branch was created from production main. Its module/tests therefore are not present here, and no Phase 4A-2 regression PASS is claimed. Cross-PR compatibility remains an integration/validation gate.

## PASS / FAIL / OPEN
### PASS
- existing thermal/reaction authority preserved;
- energy-driven temperature evolution;
- no fabricated Cp or conductance defaults;
- closed-form finite-body stability and no pairwise overshoot;
- explicit external source/sink accounting;
- distinct apparatus topologies;
- reaction heat combined exactly once;
- closed-system energy accounting tests;
- deterministic/order-invariant evaluation;
- full main-baseline suite/build.

### FAIL
- none identified in implemented Phase 4A-3 scope.

### OPEN
- independent 06 thermal validation;
- Phase 4A-2 cross-PR compatibility;
- authoritative apparatus conductance/thermal-mass calibration from 03/04;
- production apparatus/provider orchestration wiring;
- phase-transition/latent-heat authority.

## Out of Scope
Phase transitions, latent heat, melting/freezing, boiling, evaporation/condensation, CFD/Navier-Stokes, spatial thermal meshes, detailed radiation, molecular/per-particle thermal simulation, electrochemistry, and UI implementation.

## Handoffs
- 01: preserve reaction extent/matter mutation authority and provide signed reaction heat once. Next-step kinetics consumes committed temperature.
- 03: provide phase-specific Cp/correlations and validated material/apparatus thermal data with conditions/provenance.
- 04: own apparatus enabled state, setpoints/power requests, finite-vs-controlled-reservoir semantics, and topology; never assign temperature directly.
- 05B/05C/05D: typed intents/provider facts only; no frontend thermal integration or Cp inference.
- 06: independently validate PR #68, especially energy closure, extreme dt, multi-contact networks, double-count protection, generated-species OPEN behavior, and phase-boundary honesty.
- 07: merge PR #68 only after 06 approval and required cross-PR integration checks.

## Next
Independent thermal validation of PR #68. Phase-transition/latent-heat work belongs to later Phase 4B and must not be folded into this PR.
