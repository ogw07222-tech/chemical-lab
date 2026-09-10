# Thermodynamics, Phase Equilibrium, and Thermal System Contract — Phase 0

Status: PROPOSED CONTRACT
Owner: 02 — Thermodynamics & Kinetics
Scope: thermodynamic evaluation, phase equilibrium, phase-dependent kinetics, reaction heat, vessel thermal coupling, heater/cooler/thermostat control, UI phase-diagram data boundary

## 1. Design Goals

This contract extends the Phase 0 thermodynamics/kinetics architecture so that phase, reaction heat, and thermal controls are physically coupled rather than treated as UI-only state.

Core rules:
- authoritative internal quantities use SI units from `UNIT_SYSTEM.md`;
- phase is simulation-owned and must not be selected directly by UI;
- thermodynamics and kinetics remain separate;
- reaction enthalpy is an energy source/sink coupled to vessel thermal state;
- heater/cooler/thermostat modify thermal energy through explicit power/energy exchange rather than overwriting temperature;
- phase changes may absorb/release latent heat;
- phase can modify reaction accessibility and rate without silently changing molecular identity;
- no runtime quantum chemistry, molecular dynamics, or exhaustive transport solver is required;
- uncertain predictions carry scientific-status and confidence metadata.

## 2. Canonical SI Types

The production implementation should use named/typed quantities or schema-level unit annotations rather than untagged numbers.

```ts
export type TemperatureK = number;
export type PressurePa = number;
export type VolumeM3 = number;
export type EnergyJ = number;
export type PowerW = number;
export type AmountMol = number;
export type MolarEnergyJPerMol = number;
export type MolarHeatCapacityJPerMolK = number;
export type HeatCapacityJPerK = number;
export type TimeS = number;
```

Authoritative concentration is mol/m^3 when represented. UI conversions such as C, L, atm, mol/L, kJ, and kJ/mol are boundary-only concerns.

## 3. Scientific Status and Confidence

Every derived or sourced scientific result should expose:

```ts
export type ScientificStatus =
  | "VERIFIED"
  | "APPROXIMATED"
  | "EMPIRICAL"
  | "GAMEPLAY_SIMPLIFICATION"
  | "OPEN";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "UNASSESSED";

export interface ScientificAssessment {
  status: ScientificStatus;
  confidence: ConfidenceLevel;
  sourceIds?: readonly string[];
  modelId?: string;
  validTemperatureRangeK?: readonly [number, number];
  validPressureRangePa?: readonly [number, number];
  notes?: readonly string[];
}
```

Missing values are explicit. They are never encoded as zero, NaN, or fabricated defaults.

## 4. Thermodynamics Contract

### 4.1 Thermodynamic Query

```ts
export interface ThermodynamicQuery {
  candidate: ReactionCandidateRef;
  environment: ThermodynamicEnvironment;
  properties: ThermodynamicPropertyProvider;
}

export interface ThermodynamicEnvironment {
  temperatureK: TemperatureK;
  pressurePa?: PressurePa;
  volumeM3: VolumeM3;
  species: readonly ThermodynamicSpeciesState[];
  solventContext?: string;
  electricalContext?: string;
}
```

### 4.2 Thermodynamic Evaluation

```ts
export interface ThermodynamicEvaluation {
  deltaH: EstimatedMolarEnergy;
  deltaS?: EstimatedMolarEntropy;
  deltaG?: EstimatedMolarEnergy;
  direction:
    | "FORWARD_FAVORED"
    | "REVERSE_FAVORED"
    | "NEAR_EQUILIBRIUM"
    | "INDETERMINATE";
  feasibility:
    | "FAVORABLE"
    | "CONDITIONALLY_FAVORABLE"
    | "UNFAVORABLE"
    | "UNKNOWN";
  assessment: ScientificAssessment;
  provenance: ThermodynamicProvenance;
}
```

### 4.3 Thermochemical Resolution Hierarchy

For reaction enthalpy/free-energy evaluation, use this order:

1. direct trusted reaction thermodynamic data under compatible phase/reference conditions;
2. phase-specific formation enthalpy/free-energy reconstruction;
3. bond-energy approximation for suitable simple molecular cases;
4. bounded family/general heuristic;
5. OPEN if no defensible estimate exists.

A lower tier must not silently inherit a higher scientific status.

Bond-energy approximation is not a general substitute for entropy, condensed-phase energetics, ionic solvation, or mechanism-specific barriers.

### 4.4 Reaction Enthalpy Output

```ts
export interface ReactionEnthalpyEvaluation {
  deltaH_JPerMolExtent: MolarEnergyJPerMol;
  thermalClass: "EXOTHERMIC" | "ENDOTHERMIC" | "NEAR_THERMONEUTRAL" | "UNKNOWN";
  uncertaintyJPerMol?: number;
  assessment: ScientificAssessment;
  method:
    | "DIRECT_REACTION_DATA"
    | "FORMATION_ENTHALPY"
    | "BOND_ENERGY_APPROXIMATION"
    | "FALLBACK_HEURISTIC"
    | "OPEN";
  sourceIds?: readonly string[];
}
```

Sign convention: `deltaH < 0` is exothermic for the forward reaction as written; `deltaH > 0` is endothermic.

Reaction heat transferred to the thermal system for positive forward reaction extent is conceptually:

`reactionHeatToThermalSystem_J = -deltaH_JPerMolExtent * reactionExtentMol`

Thus an exothermic reaction contributes positive thermal energy to the vessel/system.

## 5. Phase Equilibrium Contract

### 5.1 Phase Model

Phase is not merely a user-provided enum. A vessel may retain cached/current phase state for runtime efficiency, but the authoritative phase should be derivable/re-evaluable from physical conditions and data/model support.

Initial macroscopic phases:

```ts
export type BulkPhase = "SOLID" | "LIQUID" | "GAS" | "UNKNOWN";
```

Schema extensions may later support `AQUEOUS`, dissolved ions, multiple liquid phases, polymorphs, plasma, and explicit phase fractions without redesigning the core interface.

### 5.2 Phase Evaluation Input

```ts
export interface PhaseEvaluationInput {
  speciesKey: string;
  temperatureK: TemperatureK;
  pressurePa: PressurePa;
  composition?: readonly CompositionEntry[];
  currentPhaseHint?: BulkPhase;
  propertyProvider: PhasePropertyProvider;
}
```

`composition` is optional for a pure-substance MVP but reserved because mixtures, dissolved species, and phase-equilibrium shifts cannot be modeled correctly from species identity/T/P alone.

### 5.3 Phase Evaluation Output

```ts
export interface PhaseFraction {
  phase: BulkPhase;
  fraction: number; // normalized 0..1, sum approximately 1 when known
}

export interface PhaseEvaluation {
  stablePhase: BulkPhase;
  phaseFractions?: readonly PhaseFraction[];
  coexistence: boolean;
  nearBoundary: boolean;
  boundaryDistanceHint?: number;
  assessment: ScientificAssessment;
  method:
    | "TRUSTED_PHASE_BOUNDARY"
    | "THERMODYNAMIC_PHASE_MODEL"
    | "MELTING_BOILING_THRESHOLD"
    | "BOUNDED_APPROXIMATION"
    | "OPEN";
  triplePoint?: PhasePoint;
  criticalPoint?: PhasePoint;
}
```

When the model/data indicates coexistence, callers must not collapse the result to a single categorical phase without retaining the coexistence/fraction information.

### 5.4 Resolution Hierarchy

Phase determination uses:

1. trusted phase-boundary/EOS/phase-equilibrium data;
2. validated thermodynamic phase model;
3. melting/boiling threshold model valid near its stated pressure/reference regime;
4. bounded approximation with explicit domain limits;
5. OPEN.

A normal melting or boiling point is not a universal T-only boundary. Reference pressure must be respected.

### 5.5 Triple Point and Critical Point

Where trusted data exists:
- below the triple-point pressure, the liquid region may not be stable;
- phase-boundary selection must allow sublimation/deposition rather than forcing solid-liquid-gas thresholds in a fixed sequence;
- above the critical point, liquid/gas distinction should not be represented as a normal vapor-liquid phase boundary.

The Phase 0 interface supports these points even if the MVP fallback implementation does not yet model all associated behavior quantitatively.

### 5.6 Phase Coexistence

Near a first-order phase boundary, `PhaseEvaluation` may return multiple phase fractions. Exact lever-rule/flash calculations are not required in MVP.

Minimum behavior:
- mark `coexistence=true` when transition conditions are reached within the supported model;
- thermal integration may consume/release latent heat while phase fractions change;
- temperature should not be forced through the transition boundary until the selected thermal tier permits it.

## 6. Phase Diagram Data Contract for UI

05 must render a diagram from 02/03 supplied data. React/UI code must not invent thermodynamic curves.

```ts
export interface PhaseDiagramData {
  speciesKey: string;
  temperatureRangeK: readonly [number, number];
  pressureRangePa: readonly [number, number];
  phaseRegions?: readonly PhaseRegion[];
  boundaries: readonly PhaseBoundarySeries[];
  triplePoint?: PhasePoint;
  criticalPoint?: PhasePoint;
  currentState?: {
    temperatureK: TemperatureK;
    pressurePa: PressurePa;
    phase: BulkPhase;
    coexistence?: boolean;
  };
  assessment: ScientificAssessment;
}

export interface PhasePoint {
  temperatureK: TemperatureK;
  pressurePa: PressurePa;
}

export interface PhaseBoundarySeries {
  id: string;
  between: readonly [BulkPhase, BulkPhase];
  samples: readonly PhasePoint[];
  modelId?: string;
  assessment: ScientificAssessment;
}
```

Preferred source hierarchy:
1. trusted normalized boundary samples/data;
2. sampled validated thermodynamic/correlation model;
3. bounded approximation derived by 02 from 03 properties;
4. unavailable/OPEN.

Do not fabricate smooth precise curves from one melting point and one boiling point. If only threshold data exists, UI should receive a correspondingly limited/approximate dataset or no full diagram.

## 7. Phase-Dependent Kinetics Contract

Phase influences reaction accessibility and effective kinetics without replacing thermodynamic evaluation.

```ts
export interface PhaseKineticContext {
  reactantPhases: readonly BulkPhase[];
  phaseFractions?: readonly PhaseFraction[];
  gasPartialPressuresPa?: Readonly<Record<string, PressurePa>>;
  mixingState?: "UNMIXED" | "PARTIAL" | "MIXED";
  contactAreaM2?: number;
  dissolvedMobilityClass?: "LOW" | "MEDIUM" | "HIGH";
}

export interface PhaseKineticCorrection {
  accessibility: number; // bounded multiplier or normalized accessibility
  transportFactor: number;
  effectiveRateMultiplier: number;
  limitingMode?:
    | "GAS_COLLISION"
    | "LIQUID_MIXING"
    | "AQUEOUS_MOBILITY"
    | "SOLID_SURFACE_CONTACT"
    | "MULTIPHASE_TRANSFER"
    | "NONE"
    | "UNKNOWN";
  assessment: ScientificAssessment;
}
```

MVP rules may use coarse deterministic factors/classes rather than transport PDEs.

Examples of allowed model effects:
- gas-phase channels use partial pressure/activity rather than bulk total pressure alone;
- liquid reactions may require a mixed/contact condition;
- aqueous ionic reactions may receive high mobility/accessibility when the aqueous model exists;
- solid-solid or solid-liquid reactions may be limited by surface/contact area;
- phase transfer can gate candidate accessibility or impose a transport factor;
- reactions requiring a missing phase environment may be inactive or strongly suppressed.

These corrections must not change atom conservation, molecular graph identity, or reaction thermodynamic state functions.

## 8. Kinetics and Temperature Dependence

The existing Phase 0 kinetic architecture remains:

`rateScale ~ A_eff * exp(-Ea_eff / (R*T)) * activityTerm * phaseTransportTerm`

Implementation should prefer log-space evaluation and relative rates when absolute units/order are unsupported.

Catalysts may alter barrier/prefactor/pathway but must not alter the equilibrium target or net reaction deltaG for the same thermodynamic reaction.

## 9. Thermal Model Contract

### 9.1 Thermal State

```ts
export interface ThermalState {
  temperatureK: TemperatureK;
  mixtureHeatCapacity_JPerK: HeatCapacityJPerK;
  vesselHeatCapacity_JPerK: HeatCapacityJPerK;
  totalSensibleHeatCapacity_JPerK: HeatCapacityJPerK;
  phaseTransitionState?: readonly PhaseTransitionState[];
  cumulativeEnergy: ThermalEnergyLedger;
}
```

`temperatureK` remains authoritative state, but changes are produced by energy integration rather than arbitrary UI assignment.

### 9.2 Energy Ledger

```ts
export interface ThermalEnergyLedger {
  reactionHeat_J: EnergyJ;
  heaterEnergy_J: EnergyJ;
  coolerEnergyRemoved_J: EnergyJ;
  thermostatEnergy_J: EnergyJ; // signed: positive supplied, negative removed
  environmentHeat_J: EnergyJ; // signed into system
  phaseChangeLatentHeat_J: EnergyJ;
  otherExternalEnergy_J?: EnergyJ;
}
```

The ledger exists for validation, analysis graphs, experiment logs, deterministic replay diagnostics, and energy-accounting audits.

### 9.3 Per-Step Thermal Balance

Each thermal timestep accumulates energy contributions:

- reaction heat from actual reaction extent;
- heater power multiplied by dt;
- cooler extraction power multiplied by dt;
- thermostat controller exchange;
- environment heat transfer;
- latent heat allocation/release during phase change.

Conceptually:

`deltaQ_system = Q_reaction + Q_heater - Q_cooler + Q_thermostat + Q_environment -/+ Q_latent`

The exact sign implementation must be centralized and unit tested. Public fields should use explicit names/sign semantics to avoid ambiguity.

When no active phase transition consumes energy, the sensible temperature update is approximately:

`deltaT = deltaQ_sensible / (C_mixture + C_vessel)`

This is an MVP energy model, not a claim of spatially uniform real apparatus behavior under every condition.

## 10. Mixture and Vessel Heat Capacity

02 requires a provider capable of returning:
- phase-specific species molar heat capacity, preferably as temperature-dependent data/correlation;
- valid T range and status;
- vessel/container heat capacity or material/apparatus model from the gameplay/apparatus boundary.

Mixture sensible heat capacity may initially use amount-weighted phase-specific molar heat capacities when scientifically appropriate.

If heat-capacity data is missing:
- do not silently assume zero;
- use an approved bounded approximation with downgraded status, or
- leave quantitative temperature prediction OPEN.

## 11. Environment Heat Transfer

A minimal browser-real-time interface may use lumped heat transfer:

```ts
export interface EnvironmentThermalContext {
  ambientTemperatureK: TemperatureK;
  effectiveHeatTransferCoefficient_WPerK?: number;
  mode: "ADIABATIC" | "LUMPED" | "OPEN";
}
```

For a simple lumped model, environment heat flow may depend on the vessel-ambient temperature difference. The coefficient is an apparatus/environment parameter, not a universal molecular property.

## 12. Heater / Cooler / Thermostat Contract

### 12.1 Heater

```ts
export interface HeaterState {
  enabled: boolean;
  requestedPowerW: PowerW;
  effectivePowerW?: PowerW;
}
```

Heater power adds energy over time. It does not set temperature directly.

### 12.2 Cooler

```ts
export interface CoolerState {
  enabled: boolean;
  requestedExtractionPowerW: PowerW;
  effectiveExtractionPowerW?: PowerW;
}
```

Cooler removes thermal energy over time. Cooling must not push the system below model-supported limits without explicit handling.

### 12.3 Thermostat

```ts
export interface ThermostatState {
  enabled: boolean;
  targetTemperatureK: TemperatureK;
  maxHeatingPowerW: PowerW;
  maxCoolingPowerW: PowerW;
  controlModel: "BOUNDED_PROPORTIONAL" | "IDEALIZED_BOUNDED" | "OPEN";
}
```

The thermostat is an external energy controller. It does not erase reaction heat. It computes heating/cooling exchange required to approach/maintain target temperature, bounded by available power.

For every step, thermostat energy exchange should be logged separately from reaction heat.

An idealized controller with unlimited instantaneous power is not the default physical model. If provided for developer/testing purposes, it must be marked `GAMEPLAY_SIMPLIFICATION` or debug-only.

## 13. Phase Change and Latent Heat

### Tier 1 — MVP Simplified
- determine categorical stable phase from supported phase data/model;
- allow threshold-based phase switching;
- latent heat may be omitted only with explicit `GAMEPLAY_SIMPLIFICATION` or `APPROXIMATED` thermal status;
- quantitative transition-temperature/temperature-curve claims remain limited.

### Tier 2 — Data-Backed Core
- use fusion/vaporization/sublimation latent heat where available;
- when a transition boundary is reached, allocate net thermal energy into phase-fraction change before continuing sensible temperature movement through the transition;
- support coexistence fractions at least for pure single-component systems;
- use pressure-aware boundary data/model where available.

### Tier 3 — Advanced
- multi-component flash/phase-equilibrium calculations;
- composition-dependent boiling/melting behavior;
- non-ideal mixture activities;
- polymorphs and multiple liquid phases;
- transport-limited evaporation/condensation;
- EOS-based supercritical behavior.

The interface is designed so Tier 1 can be replaced by Tier 2/3 without changing UI or reaction-engine ownership boundaries.

## 14. Pressure Coupling

02 may consume or supply thermodynamic pressure observables, but the canonical vessel equation-of-state ownership must remain explicit in cross-system architecture.

Minimum requirements for 02 consumers:
- gas-phase kinetics can access species partial pressures;
- phase evaluation receives total/system pressure;
- equilibrium calculations can use gas activities/partial pressures;
- thermal changes may indirectly alter pressure through the vessel/state solver.

02 must not independently maintain a second contradictory authoritative pressure state.

## 15. Equilibrium Coupling

Thermal/phase changes feed back into equilibrium through current state:
- temperature modifies equilibrium constants where supported;
- pressure/partial pressure modifies gas reaction quotient/activity;
- phase changes alter which activities/phases are present;
- phase coexistence may affect pure-phase activity handling;
- kinetics still controls approach timescale.

The equilibrium target and kinetic approach rate remain distinct.

## 16. Interface Requirements from 01

02 requires 01 `ReactionCandidate`/reaction definitions to expose or reference:
- stable candidate/reaction id;
- reactant/product species ids and stoichiometric coefficients;
- molecular structural keys;
- conservation result;
- bond changes for bond-energy fallback;
- reaction family;
- optional mechanism/pathway/reactive-site metadata for kinetic heuristics;
- proton/electron bookkeeping where modeled;
- phase/accessibility requirements when structurally required;
- reversibility hint only as a hint, not final thermodynamic direction.

For thermal coupling, 01/state-update integration must return the actual applied reaction extent in mol for each reaction channel during a timestep. Reaction heat is computed from actual extent, never from requested/unbounded extent.

02 does not mutate product molecular graphs or bypass stoichiometric/conservation limits.

## 17. Data Requirements from 03

03 should supply normalized SI-consumable records with source/provenance/reference conditions/uncertainty/status for:

Thermochemistry:
- phase-specific standard enthalpies of formation;
- phase-specific standard Gibbs energies of formation and/or standard molar entropies;
- trusted direct reaction enthalpies where useful;
- average/molecule-specific bond energies for fallback use;
- heat-capacity scalars/correlations with valid T ranges.

Phase equilibrium:
- melting/freezing points with pressure/reference context;
- boiling/condensation points with pressure/reference context;
- vapor-pressure correlations or boundary samples where available;
- sublimation data where relevant;
- triple point;
- critical point;
- latent heats of fusion/vaporization/sublimation;
- EOS/correlation identifiers and valid ranges where supplied;
- phase-specific density only when another subsystem has a defined consumer.

Kinetics/equilibrium:
- equilibrium constants or standard free energies when trusted values exist;
- activation energies/rate constants only as empirical corrections, not as the architecture backbone;
- catalyst-specific corrections only when evidence exists.

03 must preserve original source units but provide normalized authoritative SI values at the runtime data boundary, consistent with `UNIT_SYSTEM.md`.

## 18. UI Phase Diagram Boundary

05 receives `PhaseDiagramData` only.

05 may:
- render axes, regions, boundary curves, uncertainty styling, and current-state marker;
- convert K/Pa to display units through centralized adapters.

05 may not:
- compute its own phase boundary from isolated melting/boiling points;
- infer stable phase independently;
- mutate authoritative phase or temperature;
- embed thermodynamic equations in React components.

## 19. 06 Benchmark Observables

02 must expose enough deterministic outputs for 06 to compare against `REAL_EXPERIMENT_VALIDATION.md`:

Thermodynamic observables:
- `deltaH_JPerMolExtent`;
- exothermic/endothermic classification;
- `deltaG_JPerMolExtent` where modeled;
- equilibrium constant/target and equilibrium composition where modeled.

Thermal observables:
- temperatureK vs simulation time;
- net/final temperature delta K;
- reaction heat J;
- heater energy supplied J;
- cooler energy removed J;
- thermostat signed energy exchange J;
- environment heat exchange J;
- latent heat allocation J;
- total effective heat capacity J/K.

Phase observables:
- stable phase;
- phase fractions/coexistence when supported;
- transition temperature at tested pressure;
- triple/critical point source values when exposed;
- phase boundary samples/model status.

Kinetic observables:
- activation barrier/status;
- relative/absolute rate output;
- characteristic timescale where supported;
- phase transport/accessibility correction;
- temperature perturbation response.

Pressure observable:
- current/final pressurePa from the authoritative vessel solver, together with relevant thermodynamic inputs used by 02.

## 20. Performance Strategy

Browser-real-time policy:
- cache normalized property lookups by species/phase/data-version key;
- cache phase-boundary/correlation objects and sampled diagram series;
- cache reaction-invariant enthalpy components separately from T/P-dependent corrections;
- cache species heat-capacity model selection while evaluating only current T-dependent value;
- recompute phase only when relevant T/P/composition crosses an invalidation threshold or model boundary;
- evaluate phase-dependent kinetic corrections only for active candidates;
- use coarse accessibility/transport classes before detailed transport models;
- integrate thermal state with adaptive timestep when reactions/heater/phase transitions create fast energy changes;
- cap thermostat/controller power explicitly to avoid numerical teleportation;
- avoid per-frame rebuilding of full phase diagrams;
- use deterministic bounded calculations and stable cache keys.

Phase-diagram visualization data should be generated/cached outside the hot simulation loop whenever possible.

## 21. Approximation Tiers

### VERIFIED
Direct high-quality source/model under compatible conditions with uncertainty/provenance.

### APPROXIMATED
Scientifically motivated interpolation, phase threshold, mixture Cp estimate, bond-energy estimate, or simplified thermodynamic model with bounded domain.

### EMPIRICAL
Correlation/fitted relation such as vapor-pressure, heat-capacity, kinetic, or apparatus heat-transfer model with documented validity range.

### GAMEPLAY SIMPLIFICATION
Deliberate physical simplification approved for simulation/product reasons. Examples may include latent-heat omission in an early MVP or coarse fixed transport classes. Must never be presented as reference-quality chemistry.

### OPEN
Insufficient data/model support. Caller-visible absence or uncertain behavior; do not fabricate precise values.

## 22. Scientific Limitations

Phase:
- pure-substance T/P phase logic is insufficient for many mixtures/solutions;
- polymorphs, hydrates, metastability, supercooling/superheating, nucleation hysteresis, and non-equilibrium phase behavior are not captured by a simple equilibrium classifier;
- normal melting/boiling points alone do not define full phase diagrams.

Thermal:
- lumped heat capacity assumes spatially uniform temperature;
- real vessels have heat/mass-transfer gradients and apparatus-dependent coefficients;
- mixture Cp can be non-ideal;
- reaction enthalpy can vary with T, phase, and composition.

Kinetics:
- coarse phase factors cannot replace diffusion/reaction transport models;
- surface chemistry depends strongly on morphology/contact area;
- Arrhenius-like behavior may fail across phase changes, diffusion limits, complex mechanisms, tunneling, or chain reactions.

These limitations must downgrade status rather than generate false precision.

## 23. OPEN Questions

Cross-system decisions still requiring 00/01/03/04/06 alignment:
- exact authoritative pressure/EOS ownership and gas partial-pressure provider;
- whether thermostat ships in MVP or Core Release;
- exact Tier 1 latent-heat policy for the first playable build;
- initial set of species with data-backed full phase diagrams;
- mixture-phase semantics before aqueous chemistry arrives;
- exact cache invalidation thresholds for phase reevaluation;
- exact phase kinetic multiplier ranges/classes;
- apparatus/vessel heat-capacity ownership and source contract;
- default environment heat-transfer mode/parameters;
- numerical method and tolerance for phase coexistence/latent-heat integration;
- precise definition of near-boundary uncertainty behavior used by 06.

## 24. Validation Status

This document is a Phase 0 architecture/contract proposal only.

Contract completeness against the requested scope: PASS.
Scientific numerical validation: OPEN.
Production implementation: OPEN.
Phase/thermal benchmark validation under `REAL_EXPERIMENT_VALIDATION.md`: OPEN until 03 supplies data and 06 executes benchmarks.

No scientific subsystem should be declared production-ready solely because this contract exists.
