# Phase 3A — Network Kinetics / Thermal Contract

Status: CONTRACT / DESIGN PASS
Owner: 02 — Thermodynamics & Kinetics
Consumer: 01 — Chemistry Simulation Engine

## Purpose

Define the thermodynamic, kinetic, timestep, reversibility, and thermal semantics that 01 needs to execute deterministic multi-step and competing reactions across timesteps without 02 implementing a second reaction-network engine.

This contract preserves ownership:
- 01 owns candidate graph/stoichiometry semantics, shared-reactant allocation, authoritative extent application, species mutation, network state transition, and conservation.
- 02 owns thermodynamic feasibility, kinetic accessibility/rate evidence, environment dependence, reaction enthalpy, reaction heat semantics, and scientific confidence/status.

## CONTRACT

### 1. Per-candidate kinetic/thermal evaluation

Each candidate/channel must expose enough information for 01 to decide whether and how far the channel may progress during `dt`.

Conceptual contract:

```ts
interface NetworkKineticEvaluation {
  candidateId: string;
  direction: "FORWARD" | "REVERSE";

  feasibility: "FEASIBLE" | "INFEASIBLE" | "UNCERTAIN";

  kineticSupport:
    | "DIMENSIONED_RATE"
    | "RELATIVE_RATE"
    | "QUALITATIVE_ONLY"
    | "OPEN";

  // Only when a physically dimensioned model is actually supported.
  extentRateMolPerS?: number;

  // Dimensionless comparison/progression signal. Never presented as mol/s.
  relativeRate?: number;
  rateClass: "NEGLIGIBLE" | "SLOW" | "MODERATE" | "FAST" | "VERY_FAST" | "UNKNOWN";

  // Optional 02 recommendation for stable explicit stepping.
  maxRecommendedFractionPerStep?: number;

  dependencies: {
    temperature: boolean;
    concentrationOrActivity: boolean;
    pressureOrPartialPressure: boolean;
    catalyst: boolean;
    phaseAccessibility: boolean;
  };

  deltaH_JPerMolExtent?: number;

  scientificStatus:
    | "VERIFIED"
    | "APPROXIMATED"
    | "EMPIRICAL"
    | "GAMEPLAY_SIMPLIFICATION"
    | "OPEN";

  confidence: "HIGH" | "MEDIUM" | "LOW" | "UNASSESSED";
  reasonCodes: readonly string[];

  reversiblePairKey?: string;
  detailedBalanceSupported: boolean;
}
```

The exact TypeScript shape may be adapted to existing `ReactionEvaluation`, but the semantics above are required.

### 2. Extent ownership

02 does not mutate species and does not override 01 stoichiometry.

01 computes authoritative extent using:

1. 02 feasibility / kinetic support;
2. current environment and current candidate evaluation;
3. `dt`;
4. stoichiometric maximum extent;
5. competing shared-reactant allocation;
6. configured / 02-recommended maximum fractional consumption per step;
7. numerical safety bounds.

Required invariant:

`0 <= appliedExtent <= stoichiometricMaximumExtent`

For `DIMENSIONED_RATE`:

`kineticRequestedExtent = extentRateMolPerS * dt`

before 01 applies stoichiometric/competition bounds.

For `RELATIVE_RATE`, the existing coarse bridge may remain temporarily:

`fraction = 1 - exp(-relativeRate * dt / coarseRateTimescale)`

followed by explicit fractional-consumption and stoichiometric bounds. This remains `APPROXIMATED` or worse and must never be labeled a physical rate constant.

For `QUALITATIVE_ONLY` or `OPEN`, authoritative mutation is deferred by default. Controlled validation/gameplay experiments may opt in only with explicit non-production status.

### 3. Environment response

Candidate evaluation is a snapshot of the start-of-timestep environment.

Where the model supports the dependency, rate evidence may respond to:
- temperature;
- species concentration/activity;
- gas pressure/partial pressure;
- catalyst context;
- phase accessibility.

If a dependency is not modeled, 02 must not fabricate it. `dependencies` tells 01/05 which inputs were actually represented.

New products remain ineligible to react until the next timestep. Therefore a temperature or concentration change caused by a committed reaction affects kinetic re-evaluation on the next timestep, not retroactively inside the same timestep.

### 4. Stable timestep semantics

Phase 3A remains an explicit/coarse deterministic integrator, not a stiff ODE solver.

Required safeguards:
- finite `dt > 0`;
- finite non-negative species amounts;
- hard stoichiometric bound;
- hard maximum fractional consumption bound;
- optional 02 `maxRecommendedFractionPerStep` may tighten, never loosen, 01 safety limits;
- no same-step product cascade;
- all competing channels at a decision level use one common start-of-step environment snapshot;
- tied/shared-pool channels are allocated as a group rather than by candidate iteration order.

Adaptive/coarse stepping hook:
- 01 may reduce a proposed timestep when any active channel would exceed the configured/recommended progress fraction;
- 02 may recommend a smaller stable step from kinetic evidence;
- 02 does not own the network stepping loop.

A smaller timestep should converge toward a stable trajectory. Phase 3A does not claim formal ODE convergence until 06 validates it.

### 5. Multiple reactions and aggregate reaction heat

For every committed reaction `i` in one timestep:

`reactionEnthalpyContribution_i = extent_i * deltaH_i`

Known reaction enthalpy change for the timestep:

`knownReactionEnthalpy_J = sum(extent_i * deltaH_i)`

Thermal heat delivered to the system uses the existing sign convention:

`knownReactionHeatToSystem_J = -knownReactionEnthalpy_J`

Thus exothermic `deltaH < 0` contributes positive heat to the thermal system.

All known reaction-heat contributions must be summed first and applied to the thermal state exactly once per timestep. Event order must not change final thermal state.

External heater/cooler/thermostat/environment energy remains separate from reaction heat.

### 6. Partial thermal knowledge

Known and OPEN heat contributions may coexist.

Required result semantics:

```ts
interface TimestepReactionHeatSummary {
  knownReactionHeat_J: number;
  knownContributionCount: number;
  openContributionCandidateIds: readonly string[];
  coverage: "COMPLETE" | "PARTIAL" | "NONE";
  scientificStatus: ScientificStatus;
}
```

Rules:
- missing `deltaH` contributes no invented numeric heat;
- known contributions are still summed and may update temperature;
- if any committed reaction has missing `deltaH`, thermal result coverage is `PARTIAL` (or `NONE` if all are missing) and overall reaction-heat status is `OPEN`;
- resulting temperature is therefore a partial-model temperature and UI must label it accordingly;
- do not interpret omitted heat as zero physical enthalpy.

### 7. Reversibility

For a reversible chemistry concept such as `A + B <=> C + D`, Phase 3A represents forward and reverse as independent evaluable channels.

Required semantics:
- forward and reverse have distinct candidate/channel IDs;
- they may share `reversiblePairKey`;
- each direction receives an independent feasibility and kinetic evaluation at the current environment;
- no automatic equilibrium assumption;
- no hardcoded `K_eq`;
- no reverse activation energy inferred by arbitrary symmetry;
- no detailed-balance claim unless a future model provides thermodynamically/kinetically consistent forward/reverse data.

If both directions are active in the same timestep, 01 must resolve them from the same start-of-step snapshot/group semantics so candidate iteration order cannot produce a forward-then-reverse numerical oscillation.

A `NEAR_EQUILIBRIUM` thermodynamic label alone does not mean the system is at equilibrium and does not force zero net extent.

### 8. OPEN handling

Missing thermodynamic or kinetic data must remain explicit.

- Missing kinetic evidence -> `kineticSupport = OPEN`, `rateClass = UNKNOWN`, no authoritative extent by default.
- Missing activation barrier -> do not invent `Ea`.
- Missing deltaH -> reaction may still progress if kinetics/feasibility are otherwise supported, but its heat contribution is OPEN.
- Missing reverse data -> do not synthesize a reverse rate merely because a forward candidate exists.
- Missing equilibrium data -> do not synthesize `K_eq`.

## UI CONTRACT FOR 05

05 consumes simulation outputs only. It must not calculate Arrhenius, Gibbs, equilibrium, rate laws, or reaction heat.

### Rate display

- `DIMENSIONED_RATE` with supported units/data: numeric rate may be displayed with units and confidence/status.
- `RELATIVE_RATE`: numeric internal score should normally not be shown as a physical rate; UI may show normalized activity or qualitative class, explicitly labeled approximate.
- `QUALITATIVE_ONLY`: show rate class only.
- `OPEN`: show `unknown / insufficient data`; do not display `0`.

### Reversible direction display

Allowed labels:
- forward active;
- reverse active;
- both directions active;
- thermodynamically forward/reverse favored;
- near-equilibrium thermodynamic indication;
- direction unknown.

UI must not turn these labels into a claim that equilibrium has been reached.

### Reaction heat display

Expose separately:
- known reaction heat this timestep;
- heat coverage `COMPLETE/PARTIAL/NONE`;
- IDs/count of OPEN heat contributions only in diagnostic/detail UI;
- scientific status/confidence.

If coverage is partial, a temperature can still be shown as the simulated temperature but must have an approximation/partial-thermal-model indicator in scientific/debug views.

### Confidence labels

UI may display the existing scientific taxonomy:
- VERIFIED
- APPROXIMATED
- EMPIRICAL
- GAMEPLAY SIMPLIFICATION
- OPEN

and confidence:
- HIGH
- MEDIUM
- LOW
- UNASSESSED

Scientific status and statistical/data confidence remain separate fields.

## ASSUMPTIONS

1. Candidate stoichiometry and conservation have already passed 01 gates.
2. Dynamic generated species may enter future timesteps, but OPEN species receive no fabricated thermochemistry/kinetics.
3. Phase 3A uses start-of-timestep evaluation snapshots.
4. Same-step product cascade remains disabled.
5. Existing relative-rate model is a bounded approximation until dimensioned rate laws exist.
6. Sensible heat capacity may still be reused across a timestep; composition-dependent heat-capacity refresh is a later fidelity improvement.
7. No stiff solver, full equilibrium solver, transport PDE, or molecular dynamics is implied.

## IMPLEMENTATION NEEDS

### 02

1. Extend/adapter-map `ReactionEvaluation` to expose explicit kinetic support semantics (`DIMENSIONED_RATE / RELATIVE_RATE / QUALITATIVE_ONLY / OPEN`).
2. Expose environment-dependency metadata so 01/05 know whether T/concentration/pressure actually affected the rate.
3. Keep dimensioned `extentRateMolPerS` optional and emit only when units/order/model are scientifically supported.
4. Add reversible-pair metadata without deriving reverse kinetics automatically.
5. Replace event-by-event thermal state mutation with aggregation of all known reaction heat contributions followed by one thermal application per timestep.
6. Return partial thermal coverage when committed reactions include missing deltaH.

### 01

1. Consume one common evaluation snapshot per timestep.
2. Integrate dimensioned or relative kinetic input over `dt` and apply stoichiometric/shared-pool bounds.
3. Keep same-step generated products inactive until the next timestep.
4. Resolve simultaneously active forward/reverse/shared-pool channels without iteration-order winner effects.
5. Support timestep subdivision hook when progress fractions exceed safety/stability limits.
6. Do not implement thermodynamic/kinetic formulas locally.

### 05

1. Display simulation-provided rate support/status rather than inferring physical precision.
2. Distinguish numeric physical rate from relative/qualitative activity.
3. Display partial/OPEN heat coverage.
4. Display reversible direction state without claiming equilibrium.

### 06

Validate numerical stability, timestep sensitivity, thermal aggregation, reversibility, and OPEN propagation independently before production PASS.

## TEST PLAN

### Two competing exothermic reactions
- shared reactant pool;
- both supported/active;
- no overconsumption;
- deterministic group allocation;
- aggregate heat equals negative sum of committed `extent * deltaH`;
- one thermal application.

### Exothermic + endothermic in same timestep
- both extents committed;
- signed enthalpy contributions partially cancel correctly;
- event order does not alter final temperature;
- thermal ledger receives one aggregate reaction heat value.

### Rate-limited intermediate
- `A -> B` fast, `B -> C` supported but B starts at zero;
- first timestep forms B only;
- second timestep re-evaluates B -> C;
- no same-step cascade.

### Temperature-dependent second step
- step 1 reaction changes temperature;
- step 2 is re-evaluated next timestep using updated T;
- rate response follows the model-supported temperature dependency;
- no retroactive same-step reranking.

### Reverse candidate stability
- forward and reverse channels evaluated independently;
- same start-of-step snapshot;
- deterministic net result under candidate list permutation;
- no ordering-only forward/reverse oscillation;
- no detailed-balance claim unless explicitly supported.

### Missing deltaH
- reaction extent may commit when other evidence supports it;
- no numeric heat invented for missing contribution;
- known contributions still aggregate;
- coverage becomes PARTIAL/OPEN.

### Missing kinetic data
- candidate remains UNKNOWN/OPEN;
- authoritative production extent is zero/deferred by default;
- no fake barrier or rate.

### Timestep sensitivity
- compare `dt`, `dt/2 x2`, `dt/4 x4` for representative networks;
- verify conservation/non-negative invariants always;
- quantify trajectory/heat differences;
- define 06 acceptance tolerance before claiming numerical convergence.

## OPEN SCIENTIFIC LIMITATIONS

- No general reaction-order inference for arbitrary generated chemistry.
- No universal physical prefactor / absolute rate constant for structural candidates.
- No validated activity-coefficient/non-ideal solution model.
- Partial-pressure handling is still coarse outside explicit gas models.
- No diffusion/transport-limited, surface-area, or mass-transfer kinetics.
- No coupled radical-chain/stiff-network integration.
- No general equilibrium solver or validated `K_eq` path.
- No guaranteed detailed balance for reversible pairs.
- No composition-dependent Cp refresh within the same timestep yet.
- Missing deltaH means simulated temperature may omit real heat and must remain scientifically labeled partial/OPEN.
- Phase changes/latent heat can alter rate and heat semantics but remain outside this Phase 3A contract unless separately integrated.

## SUCCESS CRITERION

PASS when 01 can execute multi-step and competing networks across timesteps using bounded, deterministic, scientifically labeled 02 kinetic/thermal outputs without inventing rate constants, activation energies, equilibrium constants, or missing reaction heat.