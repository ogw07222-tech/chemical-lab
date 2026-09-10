# Molecular / Reaction Core Contract — Phase 0

Status: PROPOSED CONTRACT — HQ CANONICAL REFRESH
Owner: 01 — Chemistry Simulation Engine
Scope: molecular graph, species, phase-aware reaction candidates, conservation, product transformation, stoichiometry, reaction-progress observability
Out of scope: thermodynamic/kinetic formulas, phase-equilibrium calculation, vessel temperature calculation, authoritative property values, UI/gameplay progression

This contract refines the original PR #1 design without replacing its architecture. It must be read with `UNIT_SYSTEM.md`, `SIMULATION_CONTRACT.md`, `DISCOVERY_INVENTORY_PROGRESSION.md`, `REAL_EXPERIMENT_VALIDATION.md`, and `GAME_UI_SYSTEM_ROADMAP.md`.

## 1. Design Goals

The core must represent simple H/C/N/O chemistry now while remaining extensible to acid-base, redox, electrochemistry, radicals, aromaticity, coordination, solid interfaces, multiphase chemistry, and additional elements later.

The engine must not depend on a reaction lookup table. Reaction-specific exceptions remain a last resort after fundamental rules, reaction-family rules, and empirical corrections.

The browser solver operates on bounded local graph transformations rather than exhaustive graph rearrangement.

All authoritative physical quantities crossing the Simulation Core boundary use the canonical SI system defined by `UNIT_SYSTEM.md`.

## 2. Core Identity Model

Three identities remain intentionally separate:

1. `MolecularGraph`: topology and atom-level state.
2. `MoleculeIdentity`: canonical structural identity derived from a normalized graph.
3. `SpeciesState`: a finite amount of a chemical identity in authoritative vessel state, including simulation-derived phase state.

Runtime atom IDs are not canonical molecule identity. Phase is not part of canonical molecular identity because the same molecular structure may exist in different phases.

## 3. SI Quantity Boundary

01 does not own the project-wide unit system; it consumes the canonical contract.

Required internal units relevant to this workstream:

- amount: mol
- molar mass / atomic molar mass: kg/mol
- mass: kg
- temperature: K
- pressure: Pa
- volume: m^3
- energy: J
- molar energy: J/mol
- concentration: mol/m^3
- time: s

Physical numbers must use explicit dimension-bearing field names or later typed quantity wrappers. UI units such as L, mL, °C, atm, mol/L, kJ, and kJ/mol must not enter authoritative 01 state without boundary conversion.

## 4. Element Schema

```ts
export type AtomicNumber = number;
export type ElementSymbol = string;

export interface ElementDefinition {
  atomicNumber: AtomicNumber;
  symbol: ElementSymbol;
  atomicMolarMassKgPerMol: number;
  valenceElectrons: number;
  commonOxidationStates: readonly number[];
  electronegativity?: number;
  typicalValences: readonly number[];
  metadata?: ElementChemistryMetadata;
}

export interface ElementChemistryMetadata {
  period?: number;
  group?: number;
  isMetal?: boolean;
  preferredBondOrders?: readonly number[];
  dataStatus?: ScientificStatus;
  dataSourceKey?: string;
}
```

`ElementDefinition` is immutable normalized reference data supplied through workstream 03. 01 must not embed authoritative physical values inside reaction rules.

## 5. Atom Representation

```ts
export type AtomId = string;

export interface AtomNode {
  id: AtomId;
  element: ElementSymbol;
  formalCharge: number;
  oxidationState?: number;
  radicalElectrons?: number;
  metadata?: AtomMetadata;
}

export interface AtomMetadata {
  isotopeMassNumber?: number;
  lonePairHint?: number;
  flags?: readonly string[];
}
```

Rules:
- `id` is unique inside one graph instance.
- `formalCharge` is explicit and participates in charge conservation.
- `oxidationState` is an analysis interface, not mandatory source truth.
- radical/electronic metadata is optional in Phase 0 but not architecturally blocked.

## 6. Bond Representation

```ts
export type BondId = string;
export type BondKind =
  | "covalent"
  | "aromatic"
  | "ionic"
  | "coordination"
  | "other";

export interface BondEdge {
  id: BondId;
  a: AtomId;
  b: AtomId;
  kind: BondKind;
  order: number;
  metadata?: BondMetadata;
}

export interface BondMetadata {
  polarityHint?: number;
  bondEnergyQueryKey?: string;
  flags?: readonly string[];
}
```

Phase 0 chemistry primarily relies on ordinary covalent bond orders. Reserved bond kinds are extension points, not claims of complete aromatic/ionic/coordination modeling.

## 7. Molecule / MolecularGraph

```ts
export interface MolecularGraph {
  atoms: readonly AtomNode[];
  bonds: readonly BondEdge[];
}

export interface MoleculeRecord {
  graph: MolecularGraph;
  formula: MolecularFormula;
  netCharge: number;
  canonicalKey: string;
}

export type MolecularFormula = Readonly<Record<ElementSymbol, number>>;
```

Derived properties include formula, net formal charge, adjacency, and connected components.

Graph validation rejects duplicate IDs, missing endpoints, self-bonds, unsupported duplicate semantic bonds, unknown elements, unsupported bond-kind/order combinations, and structures failing the selected valence sanity policy.

### Canonical Identity

Formula alone is never identity. Phase 0 requires deterministic graph identity but leaves the final chemically robust canonical-labeling algorithm OPEN. Canonical identity must include graph topology, identity-relevant atom/bond attributes, total formal charge, and relevant electronic state while excluding phase and vessel amount.

## 8. Species / Amount / Phase State

```ts
export type SpeciesId = string;
export type PhaseKind =
  | "gas"
  | "liquid"
  | "solid"
  | "aqueous"
  | "supercritical"
  | "plasma"
  | "multiphase"
  | "unknown";

export type PhaseStateSource =
  | "thermodynamic-model"
  | "validated-data"
  | "approved-approximation"
  | "initial-condition-resolver"
  | "unknown";

export interface PhaseStateRef {
  phase: PhaseKind;
  source: PhaseStateSource;
  phaseStateId: string;
  modelVersion?: string;
  confidence?: number;
  scientificStatus: ScientificStatus;
}

export interface SpeciesState {
  id: SpeciesId;
  molecule: MoleculeRecord;
  amountMol: number;
  phaseState: PhaseStateRef;
  concentrationMolPerM3?: number;
  activityHint?: number;
  metadata?: SpeciesMetadata;
}

export interface SpeciesMetadata {
  solvationModelKey?: string;
  tags?: readonly string[];
}
```

Rules:
- `amountMol` is finite, non-negative authoritative vessel matter.
- `concentrationMolPerM3` is SI when represented and may be derived from vessel/composition state.
- player/UI code does not directly choose `phaseState`.
- 02 owns phase determination/modeling; 01 consumes the resolved authoritative phase state.
- phase does not alter molecular canonical identity.
- inventory entitlement, unlocked status, stock counts, or an `Infinity` amount are forbidden in `SpeciesState`.

## 9. Phase-Aware Candidate Context

Reaction generation must be able to decide structural accessibility using phase/contact information without taking ownership of thermodynamic or kinetic phase corrections.

```ts
export type ReactionAccessMode =
  | "homogeneous-gas"
  | "homogeneous-liquid"
  | "aqueous"
  | "solid-surface"
  | "phase-interface"
  | "mixed-or-unknown";

export interface SpeciesPhaseParticipation {
  speciesId: SpeciesId;
  phaseStateId: string;
  phase: PhaseKind;
}

export interface ContactInterfaceRef {
  id: string;
  participantSpeciesIds: readonly SpeciesId[];
  kind: "bulk-mixture" | "solid-surface" | "phase-boundary" | "electrode-interface" | "unknown";
  accessibleFractionHint?: number;
  areaM2Hint?: number;
  scientificStatus: ScientificStatus;
}

export interface ReactionGenerationContext {
  temperatureK: number;
  pressurePa: number;
  volumeM3: number;
  speciesPhases: readonly SpeciesPhaseParticipation[];
  contactInterfaces?: readonly ContactInterfaceRef[];
  environmentKey: string;
}
```

`accessibleFractionHint` and `areaM2Hint` are optional future transport/surface hooks. They do not authorize 01 to invent reaction rates. MVP may represent a solid contact merely as an interface identity/class.

Candidate rules may reject structurally inaccessible combinations, for example ions not available in a relevant aqueous environment or solids with no declared contact/interface. Rate multipliers, diffusion rates, phase equilibrium, and surface kinetics remain 02 responsibilities.

## 10. Reaction Candidate

```ts
export type ReactionFamily =
  | "combination"
  | "decomposition"
  | "proton-transfer"
  | "electron-transfer"
  | "substitution"
  | "addition"
  | "elimination"
  | "combustion"
  | "dissociation"
  | "precipitation"
  | "electrochemical"
  | "other";

export interface StoichiometricTerm {
  speciesId: SpeciesId;
  coefficient: number;
}

export interface AtomMapEntry {
  reactantSpeciesId: SpeciesId;
  reactantAtomId: AtomId;
  productIndex: number;
  productAtomId: AtomId;
}

export interface AtomMappingRef {
  sourceSpeciesId?: SpeciesId;
  atomId: AtomId;
}

export interface BondChange {
  a: AtomMappingRef;
  b: AtomMappingRef;
  beforeOrder?: number;
  afterOrder?: number;
  beforeKind?: BondKind;
  afterKind?: BondKind;
}

export interface ElectronBookkeeping {
  transferredElectrons?: number;
  sourceRefs?: readonly AtomMappingRef[];
  sinkRefs?: readonly AtomMappingRef[];
  externalElectronReservoirDelta?: number;
}

export interface ReactionCandidate {
  id: string;
  family: ReactionFamily;
  reactants: readonly StoichiometricTerm[];
  proposedProducts: readonly MoleculeRecord[];
  productCoefficients: readonly number[];
  atomMapping: readonly AtomMapEntry[];
  bondChanges: readonly BondChange[];
  formalChargeChanges?: readonly FormalChargeChange[];
  protonTransfers?: readonly ProtonTransfer[];
  electronBookkeeping?: ElectronBookkeeping;
  accessMode: ReactionAccessMode;
  phaseParticipants: readonly SpeciesPhaseParticipation[];
  contactInterfaceIds?: readonly string[];
  conservation: ConservationResult;
  confidence: number;
  scientificStatus: ScientificStatus;
  generationMetadata: CandidateGenerationMetadata;
  thermoQuery: ThermodynamicsQuery;
  kineticsQuery: KineticsQuery;
}
```

Candidate confidence is a ranking signal, not a calibrated experimental probability. Atom mapping remains first-class.

## 11. Conservation Validator

```ts
export interface ConservationDelta {
  elementDelta: Readonly<Record<ElementSymbol, number>>;
  totalAtomDelta: number;
  netChargeDelta: number;
  explicitElectronDelta?: number;
}

export interface ConservationResult {
  valid: boolean;
  delta: ConservationDelta;
  reasons: readonly string[];
}
```

Ordinary accepted closed-system reaction candidates require zero element, atom-count, and net-charge delta within explicit numerical tolerance. Explicit electron bookkeeping must also close unless an external electrode/reservoir accounts for transfer.

### Unlimited Inventory Boundary

The Game Layer may offer unlimited reusable stock for an unlocked species, but this has no representation inside conservation or vessel chemistry. Every add-to-vessel command must resolve before entering 01 to a finite `amountMol`. From that point onward normal conservation applies completely.

## 12. Product Graph Generation

```ts
export type GraphOperation =
  | { kind: "break-bond"; bondId: BondId }
  | { kind: "form-bond"; a: AtomId; b: AtomId; bondKind: BondKind; order: number }
  | { kind: "change-bond"; bondId: BondId; bondKind?: BondKind; order?: number }
  | { kind: "set-formal-charge"; atomId: AtomId; charge: number }
  | { kind: "set-radical-electrons"; atomId: AtomId; radicalElectrons: number };

export interface GraphTransformation {
  operations: readonly GraphOperation[];
  maxTouchedAtoms: number;
  family: ReactionFamily;
}
```

Generation remains local: construct participating graph -> apply bounded operations -> split components -> normalize -> valence/charge sanity -> canonicalize -> atom map -> conservation validation -> phase-accessibility validation -> emit to 02.

Valence sanity is structural pruning, not proof of thermodynamic stability.

## 13. Chemical Reaction vs Phase Transition

Melting, freezing, boiling, condensation, sublimation, deposition, and related state-of-matter changes are not molecular-graph reaction candidates when molecular identity is unchanged.

```ts
export interface PhaseTransitionEvent {
  id: string;
  kind: "melting" | "freezing" | "vaporization" | "condensation" | "sublimation" | "deposition" | "other";
  moleculeCanonicalKey: string;
  speciesIdBefore: SpeciesId;
  speciesIdAfter: SpeciesId;
  phaseBefore: PhaseStateRef;
  phaseAfter: PhaseStateRef;
  amountMol: number;
  startTimeS: number;
  endTimeS: number;
  modelEventId?: string;
}
```

01 must not generate bond/atom rearrangements merely to encode a phase change. 02 owns the phase-transition/latent-heat model; state integration may emit a `PhaseTransitionEvent` through a shared simulation event boundary.

Chemical reactions are distinguished by a reaction candidate plus stoichiometric extent and may change molecular graph/canonical identity. A phase transition preserves molecular identity while changing authoritative physical phase state.

## 14. Stoichiometry and Reaction Extent

```ts
export interface ReactionStoichiometry {
  reactants: readonly StoichiometricTerm[];
  products: readonly StoichiometricProductTerm[];
}

export interface StoichiometricProductTerm {
  productIndex: number;
  coefficient: number;
}

export interface ReactionExtentInput {
  stoichiometry: ReactionStoichiometry;
  availableAmountMol: Readonly<Record<SpeciesId, number>>;
  requestedExtentMol?: number;
}

export interface ReactionExtentResult {
  maxExtentMol: number;
  appliedExtentMol: number;
  limitingReactantIds: readonly SpeciesId[];
  reactantConsumptionMol: Readonly<Record<SpeciesId, number>>;
  productFormationMol: readonly number[];
  excessAmountMol: Readonly<Record<SpeciesId, number>>;
}
```

Coefficients are positive magnitudes; side determines semantic sign. Kinetics determines actual timestep progression, while stoichiometry constrains and accounts for it.

## 15. Reaction Progress / Thermal Coupling Boundary

01 does not calculate vessel temperature or reaction enthalpy. It must emit sufficient reaction-progress information for 02 to calculate reaction heat and thermal response.

```ts
export interface ReactionProgressEvent {
  id: string;
  candidateId: string;
  timestepId: string;
  startTimeS: number;
  endTimeS: number;
  extentDeltaMol: number;
  stoichiometry: ReactionStoichiometry;
  reactantPhaseRefs: readonly SpeciesPhaseParticipation[];
  productPhaseRefs: readonly SpeciesPhaseParticipation[];
  speciesAmountDeltaMol: Readonly<Record<SpeciesId, number>>;
}
```

Required invariant: `extentDeltaMol` and `speciesAmountDeltaMol` must correspond to the same accepted stoichiometric update. This event is the authoritative handoff for 02 reaction enthalpy/heat calculation and 06 validation; it contains no inferred heat or temperature change from 01.

## 16. Thermodynamics / Kinetics Boundary

```ts
export interface ThermodynamicsQuery {
  candidateId: string;
  reactantKeys: readonly string[];
  productKeys: readonly string[];
  temperatureK: number;
  pressurePa: number;
  phaseParticipants: readonly SpeciesPhaseParticipation[];
  contactInterfaceIds?: readonly string[];
  environmentKey: string;
  transformationSummary: readonly BondChange[];
}

export interface ThermodynamicsResult {
  status: "favorable" | "unfavorable" | "unknown";
  drivingForceJPerMol?: number;
  confidence?: number;
  scientificStatus: ScientificStatus;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface KineticsQuery {
  candidateId: string;
  family: ReactionFamily;
  reactantSpeciesIds: readonly SpeciesId[];
  temperatureK: number;
  pressurePa: number;
  phaseParticipants: readonly SpeciesPhaseParticipation[];
  accessMode: ReactionAccessMode;
  contactInterfaceIds?: readonly string[];
  environmentKey: string;
  reactiveSiteKeys?: readonly string[];
}

export interface KineticsResult {
  status: "fast" | "moderate" | "slow" | "negligible" | "unknown";
  rateConstantSI?: number;
  rateMolPerM3PerS?: number;
  confidence?: number;
  scientificStatus: ScientificStatus;
  metadata?: Readonly<Record<string, unknown>>;
}
```

Exact dimensions of a rate constant depend on reaction order and therefore must be defined by 02 rather than assumed by the `rateConstantSI` field alone. Before production implementation, 02 should replace this placeholder with an explicitly dimensioned/versioned rate-law contract. `drivingForceJPerMol` follows the canonical molar-energy unit when that quantity is exposed.

## 17. Candidate Generation and Explosion Control

Required sequence:

1. finite active-species filtering
2. cached graph/property analysis
3. reactive-site detection
4. phase/contact accessibility filtering
5. reaction-family eligibility filtering
6. local transformation templates/rules
7. immediate valence/structural rejection
8. conservation validation
9. duplicate canonical candidate elimination
10. optional cheap plausibility hints
11. deterministic pruning to a hard cap

```ts
export interface CandidateBudget {
  maxReactiveSitesPerSpecies: number;
  maxSpeciesCombinations: number;
  maxTransformationsPerSitePair: number;
  maxTouchedAtomsPerTransformation: number;
  maxCandidatesBeforeDedup: number;
  maxCandidatesAfterPruning: number;
  maxTransformationDepth: number;
}
```

All caps are deterministic and observable. Environment-sensitive cache keys must include the phase/contact/environment dimensions needed to avoid reusing conclusions across physically different states.

## 18. Determinism and Validation Observability

Identical authoritative state, seed/clock, data/rule versions, phase state, candidate budget, and timestep inputs must produce reproducible enumeration and state transitions.

06 must be able to inspect a stable trace without relying on UI state.

```ts
export interface SimulationStepObservation {
  stepId: string;
  startTimeS: number;
  endTimeS: number;
  stateBeforeId: string;
  stateAfterId: string;
  reactionOccurred: boolean;
  acceptedCandidateIds: readonly string[];
  rejectedCandidateIds?: readonly string[];
  reactionProgressEvents: readonly ReactionProgressEvent[];
  phaseTransitionEventIds: readonly string[];
  speciesAfter: readonly SpeciesObservation[];
  majorProductSpeciesIds: readonly SpeciesId[];
}

export interface SpeciesObservation {
  speciesId: SpeciesId;
  moleculeCanonicalKey: string;
  amountMol: number;
  phaseStateId: string;
  phase: PhaseKind;
}
```

The observability contract supplies reaction/no-reaction, major products, finite species amounts, reaction extents, phases, deterministic identifiers, and before/after state IDs required by `REAL_EXPERIMENT_VALIDATION.md`.

Whether a product is "major" must eventually use a deterministic documented criterion shared with 06; that threshold is OPEN.

## 19. Scientific Status

```ts
export type ScientificStatus =
  | "VERIFIED"
  | "APPROXIMATED"
  | "EMPIRICAL"
  | "GAMEPLAY_SIMPLIFICATION"
  | "OPEN";
```

A structurally valid candidate is not automatically thermodynamically favorable, kinetically relevant, or phase-accessible.

## 20. Validation Fixtures Required Before Phase 1 Claim

Representation fixtures must cover at minimum H2, O2, H2O, CO, CO2, CH4, and NH3.

Required validation hooks/tests include formula and net-charge derivation, graph validity, atom/element/charge conservation, invalid valence rejection, deterministic canonical identity and candidate ordering, finite amount enforcement, SI-unit contract checks, phase-state provenance, phase-aware accessibility cases, chemical-reaction vs phase-transition separation, reaction-progress/extent consistency, negative reaction cases, randomized conservation properties, candidate-budget enforcement, and regression tests.

## 21. Design Status

### PASS

- Original molecular graph / reaction-candidate architecture remains valid.
- Required H/C/N/O molecules remain representable.
- SI conflicts from atomic mass and concentration naming are removed.
- Species amount is finite and isolated from unlimited Game Layer inventory semantics.
- Phase is authoritative simulation state supplied by 02/data-backed resolution rather than a player choice.
- Candidate generation can consume phase/contact/interface state without owning phase thermodynamics or kinetics.
- Solid-surface and multiphase locality have explicit extension points without requiring an MVP surface solver.
- Chemical reactions are separated from same-identity phase transitions.
- Reaction extent produces an explicit thermal handoff event for 02.
- 06 can observe reaction/no-reaction, major products, amount, extent, phase, deterministic IDs, and before/after state references.

### OPEN

- final canonical graph-labeling algorithm
- advanced aromatic/hypervalent/coordination valence model
- oxidation-state inference
- full electrochemical proton/electron reservoir representation
- exact 02 rate-law dimensions, phase determination contract, thermal/latent-heat event ownership details
- exact 03 normalized phase/property schema and provenance types
- solid accessible fraction/contact-area calculation
- deterministic major-product classification threshold for 06
- exact orchestration owner that combines 01 ReactionProgressEvent with 02 thermal state update

### FAIL

- none remaining at the refreshed Phase 0 contract level; production implementation and scientific validation remain OPEN
