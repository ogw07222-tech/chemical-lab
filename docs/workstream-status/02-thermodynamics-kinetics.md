# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Architect / Energy Model Architect
- Current phase: Phase 3A — Network Kinetics / Thermal Contract
- Overall state: PASS — CONTRACT / implementation handoff pending
- Last updated: 2026-09-12
- Starting / latest checked main SHA: `3055ce6d2229806f4560a220ca835fb4b7f7c303`
- Active branch: `feature/phase3a-kinetics-thermal-contract`
- Active PR: #45 — `docs(02): define Phase 3A network kinetics thermal contract`

## Objective
Define the 02-owned kinetic and thermal semantics required for 01 to execute deterministic multi-step and competing reactions across timesteps without implementing a second reaction-network engine or fabricating physical precision.

Canonical contract: `docs/contracts/PHASE3A_NETWORK_KINETICS_THERMAL.md`.

## Contract Decisions

### Per-candidate kinetics
01 must receive an explicit kinetic support class:
- `DIMENSIONED_RATE`: a physically supported `extentRateMolPerS` may be integrated over `dt`;
- `RELATIVE_RATE`: dimensionless progression/ranking signal only;
- `QUALITATIVE_ONLY`: rate class but no numeric authoritative extent input;
- `OPEN`: insufficient kinetic evidence.

Every evaluation retains feasibility, rate class, scientific status, confidence, reason codes, optional `deltaH`, environment-dependency metadata, reversibility metadata, and whether detailed balance is actually supported.

Missing kinetic data never creates a fake activation energy, rate constant, or zero physical rate. Production mutation is deferred by default for `QUALITATIVE_ONLY/OPEN` channels.

### Extent boundary
02 provides kinetic/rate evidence; 01 owns final extent, stoichiometric availability, shared-reactant allocation, species mutation, conservation, and network stepping.

Required invariant:
`0 <= appliedExtent <= stoichiometricMaximumExtent`.

For supported dimensioned rates, preliminary kinetic extent is `extentRateMolPerS * dt` before 01 bounds it. For existing relative-rate fallback, the coarse exponential fraction remains explicitly `APPROXIMATED` and cannot be promoted to VERIFIED.

### Timestep semantics
- evaluate active candidates from one common start-of-timestep state/environment snapshot;
- rate may respond to T/concentration/activity/pressure/catalyst/phase only where the 02 model explicitly supports that dependency;
- newly generated product cannot react until the next timestep;
- shared/tied channels must not gain inventory solely from candidate iteration order;
- timestep subdivision/adaptive hook may tighten a proposed step when fractional progress is too large;
- no claim of formal numerical convergence until 06 validates timestep sensitivity.

### Aggregate reaction heat
For every committed reaction `i`:
`reactionEnthalpyContribution_i = extent_i * deltaH_i`.

Known timestep enthalpy change:
`knownReactionEnthalpy_J = sum(extent_i * deltaH_i)`.

Using the existing thermal sign convention:
`knownReactionHeatToSystem_J = -knownReactionEnthalpy_J`.

All known contributions must be aggregated first and applied to the thermal state exactly once per timestep. Reaction event ordering must not alter final thermal state.

### Partial thermal knowledge
Known and OPEN heat contributions may coexist.

Required summary:
- `knownReactionHeat_J`;
- known contribution count;
- OPEN candidate IDs;
- coverage: `COMPLETE | PARTIAL | NONE`;
- overall scientific status.

Missing deltaH contributes no invented numeric heat. Known heat may still be applied, but if any committed contribution is unknown the thermal result is `PARTIAL/OPEN`; the resulting temperature is a partial-model simulated temperature, not a complete physical heat prediction.

### Reversibility
`A+B <=> C+D` is represented by independently evaluated forward and reverse channels.

- separate channel IDs;
- optional shared reversible-pair key;
- independent feasibility and kinetics at the current environment;
- no automatic equilibrium assumption;
- no hardcoded `K_eq`;
- no automatic reverse activation barrier/rate synthesis;
- no detailed-balance claim unless the model/data explicitly support it.

If both directions are active, 01 must resolve them from the same timestep snapshot/group semantics so ordering alone cannot create forward/reverse oscillation.

## Current Production Audit
- Existing `ReactionEvaluation` already separates thermodynamics, kinetics, environment, feasibility, scientific status, and rank score.
- Existing Phase 2E progression already enforces stoichiometric bounds, deterministic competing allocation, same-step product-cascade prevention, and OPEN/deferred handling.
- Dynamic generated species are now available for later-timestep participation through the 01 registry integration.
- Current `applyReactionThermalCoupling()` applies known reaction heat event-by-event. Because current sensible heat capacity is fixed during that loop the result is often algebraically equivalent, but Phase 3A contract requires an explicit aggregate-once implementation to remove ordering dependence and support clean partial-heat semantics.

## UI Contract for 05
05 must not calculate Arrhenius, Gibbs, equilibrium, rates, or heat.

- `DIMENSIONED_RATE`: numeric rate may be displayed with units/status/confidence.
- `RELATIVE_RATE`: show approximate activity/qualitative class, not a physical mol/s claim.
- `QUALITATIVE_ONLY`: rate class only.
- `OPEN`: show unknown/insufficient data, not zero.
- reversible state may show forward active / reverse active / both active / favored direction / direction unknown, but not “equilibrium reached” unless simulation explicitly supplies that result.
- heat UI must expose `COMPLETE/PARTIAL/NONE` coverage and scientific status.
- scientific status and confidence remain separate fields.

## Implementation Needs
### 02
1. Add explicit kinetic-support semantics to/alongside `ReactionEvaluation`.
2. Add environment-dependency metadata.
3. Add optional dimensioned extent-rate output only when scientifically supported.
4. Add reversible-pair / detailed-balance capability metadata.
5. Refactor reaction thermal coupling to aggregate known heat first, then perform one thermal application.
6. Return partial thermal coverage metadata when deltaH is missing for any committed channel.

### 01
1. Consume one common evaluation snapshot per timestep.
2. Integrate 02 rate input over `dt`, then apply stoichiometric/shared-pool bounds.
3. Preserve no-same-step-product-cascade semantics.
4. Resolve forward/reverse/shared channels without iteration-order winner effects.
5. Support timestep subdivision/adaptive hook when progress bounds require it.
6. Do not implement thermo/kinetic formulas locally.

### 05
Consume only simulation-provided rate/heat/reversibility/status outputs and do not infer precision.

### 06
Validate aggregate heat, reversibility stability, timestep sensitivity, competition, OPEN propagation, and permutation determinism.

## Test Plan
- two competing exothermic reactions;
- exothermic + endothermic in the same timestep;
- rate-limited intermediate (`A -> B`, then `B -> C` next timestep only);
- temperature-dependent second step re-evaluated after previous-step thermal change;
- independently evaluated reverse candidate with candidate-order permutation;
- missing deltaH with partial heat coverage;
- missing kinetic data -> OPEN/deferred without fake rate;
- timestep sensitivity comparing `dt`, `dt/2 x2`, `dt/4 x4`.

## PASS / FAIL / OPEN
### PASS
- 01/02 ownership boundary is explicit.
- Multi-step rate/extent input semantics are defined without a second network engine.
- Stoichiometric and timestep bounds are explicit.
- Same-step intermediate cascade remains prohibited.
- Aggregate signed reaction-heat semantics are defined.
- Known and OPEN heat contributions can coexist with explicit partial coverage.
- Forward/reverse channels are independent and do not imply equilibrium/detailed balance.
- 05 precision/display rules are explicit.

### FAIL
- None in contract design.

### OPEN
- Actual TypeScript implementation of kinetic-support metadata and aggregate-once thermal coupling.
- General physical reaction-order inference and dimensioned rate constants.
- Validated activity/non-ideal solution and partial-pressure models.
- Diffusion/transport/surface-limited kinetics.
- Stiff network integration.
- General equilibrium solver / `K_eq` path.
- Guaranteed detailed balance.
- Composition-dependent Cp refresh and phase/latent-heat coupling.
- 06 numerical convergence/timestep acceptance thresholds.

## Handoffs
- 01: use `PHASE3A_NETWORK_KINETICS_THERMAL.md` as the Phase 3A rate/thermal execution contract; do not duplicate 02 physics.
- 03: continue supplying sourced thermochemistry/barrier/rate-law data with units/provenance/status; absent data remains OPEN.
- 05: implement display only from provided support/status/coverage fields.
- 06: validate the listed network/thermal/timestep cases before production scientific PASS.

## Next
Implement the minimal 02 metadata + aggregate thermal coupling needed by 01 Phase 3A, then validate jointly with 06. Do not move to equilibrium or electrochemistry yet.