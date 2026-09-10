# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Designer / Energy Model Architect
- Current phase: Phase 0 — Architecture
- Overall state: IN_PROGRESS
- Last updated: 2026-09-10
- Last checked main SHA: f6513bd6cefc7df5b16d1f678a4cf1b443859e94
- Active branch: main
- Active PR: none

## Current Objective
Define the browser-real-time contract that evaluates 01 `ReactionCandidate`s using separate thermodynamic, kinetic, equilibrium, catalyst, and confidence models without reaction-by-reaction hardcoding.

## Completed
- Reviewed `PROJECT.md`, `AGENTS.md`, `ROADMAP.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`, `docs/contracts/SIMULATION_CONTRACT.md`, and 01/03/06 workstream status at main `f6513bd6cefc7df5b16d1f678a4cf1b443859e94`.
- Proposed `ThermodynamicEvaluation` contract with deltaH, deltaS, deltaG, thermodynamic direction, feasibility class, provenance/confidence, and method metadata.
- Proposed energy hierarchy: direct trusted reaction thermodynamics -> formation-property reconstruction -> bond-energy approximation -> bounded fallback heuristic.
- Proposed `KineticEvaluation` contract with activation barrier estimate, rate/relative-rate output, qualitative rate class, environmental dependencies, catalyst correction, and confidence.
- Proposed Arrhenius-like MVP model using a barrier term plus bounded prefactor/reaction-family correction, with relative-rate consistency preferred over false absolute precision.
- Proposed reversible reaction/equilibrium interface using forward/reverse channels, equilibrium-constant query, reaction quotient/activity interface, and timestep-compatible net flux.
- Proposed competing-reaction strategy based on feasible active channels and normalized reaction flux, not thermodynamic favorability alone.
- Defined catalyst invariant: catalyst may alter kinetic pathway/barrier/prefactor but not the uncatalyzed reaction thermodynamic state function or equilibrium target.
- Defined approximation labels: VERIFIED / APPROXIMATED / EMPIRICAL / GAMEPLAY SIMPLIFICATION / OPEN.
- Defined browser performance policy: cache molecular/property/evaluation components, coarse kinetic classes when precision is unsupported, active-reaction filtering, adaptive timestep, deterministic bounded work, and no quantum chemistry/MD in the realtime loop.

## Proposed Contract Summary

### ThermodynamicEvaluation
Inputs:
- `ReactionCandidate`
- vessel/environment state: temperature, pressure/volume, species amounts/concentrations, phases, optional solvent/electrical context
- normalized referenced property data

Outputs:
- `deltaH` estimate with units/status/source method
- `deltaS` estimate with units/status/source method
- `deltaG` estimate at current conditions
- direction: `FORWARD_FAVORED | REVERSE_FAVORED | NEAR_EQUILIBRIUM | INDETERMINATE`
- feasibility: `FAVORABLE | CONDITIONALLY_FAVORABLE | UNFAVORABLE | UNKNOWN`
- uncertainty/confidence and approximation status

### Energy Resolution Hierarchy
1. Direct trusted reaction thermodynamic data when reaction identity, phase, and reference conditions are applicable.
2. Formation enthalpy/free-energy data summed stoichiometrically when all required species/state data are available.
3. Bond-energy approximation for graph-transformable gas-like/simple molecular cases where average bond energies are meaningful; entropy handled separately.
4. Bounded family/fallback heuristic only for ranking/pruning; never exposed as precise chemistry.

### KineticEvaluation
Outputs:
- activation barrier estimate or barrier class
- rate constant when dimension/order support it, otherwise normalized relative rate
- qualitative rate class: `NEGLIGIBLE | SLOW | MODERATE | FAST | VERY_FAST`
- temperature response
- concentration/activity dependence
- pressure dependence where gas participation/order warrants it
- catalyst correction metadata
- uncertainty/confidence and approximation status

### Arrhenius-like MVP
Use `rateScale ~ A_eff * exp(-Ea_eff / RT) * activityTerm` conceptually. `A_eff` may be a reaction-family/prefactor class rather than a trusted dimensional constant. Clamp/log-space evaluation should be used to avoid numerical overflow/underflow. Absolute rate constants must not be claimed when order, units, or source support is missing.

### Equilibrium
Represent reversible chemistry as paired forward/reverse channels sharing one thermodynamic reaction definition. Preferred thermodynamic target uses `K(T)` derived from trusted/approximated standard free energy when available. Runtime compares reaction quotient/activity state against the equilibrium target, then combines forward and reverse kinetic fluxes. Net progress is `forwardFlux - reverseFlux`, integrated subject to stoichiometric availability and non-negative amounts.

### Competition
Candidate ranking/pruning order:
1. conservation-valid candidates only
2. thermodynamic impossibility/unknown handling
3. kinetically active under current conditions
4. compute channel flux/rate score
5. resolve shared-reactant competition using flux-weighted progress constrained by stoichiometric availability

Do not select the most negative deltaG candidate as the sole winner. Strongly favorable but barrier-dominated reactions can remain negligible while less favorable low-barrier pathways dominate on the simulated timescale.

### Catalyst
Catalyst input is part of environment/query context. Catalyst corrections may lower forward and reverse pathway barriers and/or alter effective prefactors/pathway selection. They must not directly alter reaction deltaG or the equilibrium constant for the same net reaction. Catalyst consumption is excluded unless 01 explicitly represents catalytic intermediates as reaction-network species.

## Data Requirements from 03
Minimum normalized property record metadata:
- property/value/unit
- species/element/bond identifier
- phase
- reference temperature and pressure when applicable
- solvent/ionic-strength context when applicable
- source/provenance
- uncertainty or quality indicator
- approximation status
- valid range / applicability notes

Priority datasets:
- standard formation enthalpies
- standard Gibbs formation energies and/or entropies
- heat capacities where temperature corrections are later enabled
- average bond dissociation/formation energy references for fallback estimation
- phase-transition/state data needed for phase corrections
- equilibrium constants where trusted data exist
- activation energies/rate constants only as optional empirical corrections, not the engine backbone
- catalyst-specific barrier/rate corrections when evidence exists
- electrochemical potentials for the future electrochemical interface

## Required Information from 01 ReactionCandidate
02 requires 01 to supply:
- stable candidate/reaction id
- reactant and product species ids with signed stoichiometric coefficients
- phases or references to vessel phase state
- atom/charge conservation result
- molecular graph references
- bonds broken/formed and bond-order changes when available
- proton/electron transfer bookkeeping when modeled
- reaction-family classification and optional mechanism/pathway tags
- reversibility hint only as a structural hint, not a final thermodynamic verdict
- reactive-site/context identifiers needed for family kinetic heuristics
- candidate scientific-status metadata

02 must not mutate molecular graphs or decide products.

## Performance Strategy
- Cache species-level formation/bond/property lookups by species/state/data-version key.
- Cache reaction-invariant thermodynamic components separately from environment-dependent deltaG corrections.
- Cache kinetic family/barrier estimates when molecular/pathway identity is unchanged.
- Recompute only temperature/activity/pressure dependent terms each active timestep.
- Evaluate active candidates only; use deterministic bounded pruning.
- Use log-space rate comparisons and coarse classes when absolute numbers are unsupported.
- Adaptive timestep should limit fractional consumption and resolve fast competing channels without evaluating inactive networks exhaustively.

## Scientific Limitations
- Average bond energies can be poor for condensed phases, resonance, ionic species, radicals, strained structures, solvent-specific chemistry, and mechanism-dependent reactions.
- Standard-state deltaG alone does not determine real-time direction; activities/concentrations/partial pressures and kinetics matter.
- Simple Arrhenius behavior can fail across phase changes, diffusion limits, tunneling, complex mechanisms, chain reactions, and transport-controlled processes.
- Activity coefficients, ionic strength, non-ideal gases/solutions, detailed solvent effects, heat/mass transport, and multistep mechanisms are outside Phase 0 fidelity unless explicitly added later.
- A catalyst invariant applies to the same net reaction at fixed thermodynamic state; explicit coupled chemistry or energy input must be represented separately rather than hidden as a catalyst correction.

## Validation Evidence
Contract/design review only. No production implementation or numerical validation exists yet. Per `AGENTS.md`, no scientific PASS is claimed without validation evidence.

Requested Phase 0 validation fixtures for 06:
- exothermic vs endothermic classification
- favorable deltaG plus high barrier -> kinetically slow
- catalyst changes rate/barrier but not equilibrium target
- temperature increase produces physically consistent Arrhenius relative-rate response for positive barrier
- reversible channel approaches equilibrium without negative species amounts
- shared-reactant competing channels remain stoichiometrically bounded and deterministic

## Blockers / OPEN
- 01 concrete `ReactionCandidate` TypeScript schema is not yet defined, so exact field names/types remain OPEN.
- 03 normalized property schema and first H/C/N/O dataset are not yet defined, so data adapters remain OPEN.
- Exact entropy fallback model for graph-only unknown species is OPEN; avoid pretending bond energies supply entropy.
- Exact definition/thresholds for qualitative kinetic classes are OPEN pending 06 calibration.
- Reaction order/activity-term inference from reaction-family/mechanism metadata is OPEN.
- Pressure handling beyond ideal-gas activities/partial pressures is OPEN.
- Phase corrections and temperature extrapolation policy require 03 data availability and 06 tests.
- Detailed electrochemical potential coupling is deferred beyond the minimal interface.

## Next Actions
1. Align exact TypeScript query/result types with 01 candidate schema when 01 publishes it.
2. Give 03 the required thermodynamic/kinetic property schema and H/C/N/O MVP priority list.
3. Ask 06 to turn the listed fixtures into Phase 0 validation gates.
4. After contracts stabilize, implement only the minimal deterministic evaluator and cache interfaces; defer tuning/calibration.

## Handoffs
- 01: finalize candidate fields listed above; preserve product/conservation ownership.
- 03: provide normalized data/provenance interfaces and MVP datasets.
- 06: validate physical invariants, determinism, numerical stability, and performance before PASS.
- 00: arbitrate any cross-system schema disagreement or fidelity/complexity tradeoff.
