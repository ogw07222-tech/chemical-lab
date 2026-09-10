# Molecular / Reaction Core Contract — Phase 0

Status: PROPOSED CONTRACT
Owner: 01 — Chemistry Simulation Engine
Scope: molecular graph, species, reaction candidate, conservation, product transformation, stoichiometry
Out of scope: thermodynamic feasibility formulas, kinetics formulas, reference property values, UI/gameplay

## 1. Design Goals

The core must represent simple H/C/N/O chemistry now while remaining extensible to acid-base, redox, electrochemistry, radicals, aromaticity, coordination, and additional elements later.

The engine must not depend on a reaction lookup table. Reaction-specific exceptions remain a last resort after fundamental rules, reaction-family rules, and empirical corrections.

The real-time browser solver must operate on bounded local graph transformations rather than exhaustive graph rearrangement.

## 2. Core Identity Model

Three identities are intentionally separate:

1. `MolecularGraph`: topology and atom-level state.
2. `MoleculeIdentity`: canonical structural identity derived from a normalized graph.
3. `Species`: a chemically present entity in a vessel, including phase and amount.

Two vessel species may reference the same molecular identity while differing in phase or environment-dependent state. Runtime atom IDs are not canonical molecule identity.

## 3. Element Schema

```ts
export type AtomicNumber = number;
export type ElementSymbol = string;

export interface ElementDefinition {
  atomicNumber: AtomicNumber;
  symbol: ElementSymbol;
  atomicMass: number; // normalized data-layer unit contract; normally g/mol
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

`ElementDefinition` is immutable reference data supplied through the Chemistry Data boundary. The simulation engine must not embed authoritative physical values in reaction logic.

## 4. Atom Representation

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
- `formalCharge` is explicit and participates in conservation checks.
- `oxidationState` is an analysis interface, not mandatory source truth for all molecules.
- radical/electronic metadata is optional in Phase 0 but the schema must not block it later.

## 5. Bond Representation

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

Phase 0 production chemistry should primarily use covalent bonds with order 1, 2, or 3. Aromatic, ionic, and coordination kinds are schema-reserved and must not be treated as scientifically complete implementations merely because the enum exists.

## 6. Molecule / MolecularGraph

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

Derived properties:
- formula = count atoms by element
- net charge = sum formal charges
- adjacency = derived/cached from bonds
- connected components = graph utility; a `MoleculeRecord` should normally represent one connected molecular/ionic component

### Graph Validation

A graph is invalid when any of the following holds:
- duplicate atom IDs or bond IDs
- bond references a missing atom
- self-bond
- duplicate bond edge for the same semantic bond unless explicitly supported
- unsupported bond order/kind combination
- element reference unknown to the supplied element registry
- valence sanity fails under the selected validation policy

### Canonical Identity Strategy

Phase 0 contract requires deterministic structural identity but does not mandate a final cheminformatics canonicalization algorithm.

Minimum strategy:
1. normalize atom attributes relevant to identity
2. normalize undirected bond endpoints and bond attributes
3. compute a deterministic graph canonical labeling or stable graph hash
4. include total formal charge and relevant electronic state

Formula alone is never a canonical identity because structural isomers may share a formula.

OPEN: select/implement a chemically robust canonical-labeling algorithm before isomer-rich chemistry is enabled.

## 7. Species / Amount Model

```ts
export type SpeciesId = string;
export type Phase = "gas" | "liquid" | "solid" | "aqueous" | "plasma" | "unknown";

export interface SpeciesState {
  id: SpeciesId;
  molecule: MoleculeRecord;
  phase: Phase;
  amountMol: number;
  concentrationMolPerL?: number;
  activityHint?: number;
  metadata?: SpeciesMetadata;
}

export interface SpeciesMetadata {
  solvationModelKey?: string;
  tags?: readonly string[];
}
```

`amountMol` is the authoritative extensive quantity for stoichiometric state updates. Concentration may be supplied or derived from vessel state where meaningful; it must not silently replace amount.

Environment-dependent properties belong in a vessel/environment context, not permanently baked into canonical molecular identity.

## 8. Reaction Candidate

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
  coefficient: number; // positive normalized magnitude
}

export interface AtomMapEntry {
  reactantSpeciesId: SpeciesId;
  reactantAtomId: AtomId;
  productIndex: number;
  productAtomId: AtomId;
}

export interface BondChange {
  a: AtomMappingRef;
  b: AtomMappingRef;
  beforeOrder?: number;
  afterOrder?: number;
  beforeKind?: BondKind;
  afterKind?: BondKind;
}

export interface AtomMappingRef {
  sourceSpeciesId?: SpeciesId;
  atomId: AtomId;
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
  conservation: ConservationResult;
  confidence: number; // normalized 0..1 ranking hint, not probability
  scientificStatus: ScientificStatus;
  generationMetadata: CandidateGenerationMetadata;
  thermoQuery: ThermodynamicsQuery;
  kineticsQuery: KineticsQuery;
}
```

Candidate confidence is a solver-ranking signal and must not be presented as experimentally calibrated probability unless separately validated.

Atom mapping is first-class. Product atoms must be traceable to reactant atoms except for explicitly modeled external reservoirs, which must be represented in conservation/electron bookkeeping.

## 9. Conservation Validator

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

Hard rejection conditions for accepted ordinary closed-system candidates:
- any non-zero element delta
- non-zero total atom delta
- non-zero net charge delta
- non-zero explicit electron delta when electrons are explicitly modeled and no external reservoir accounts for it

For electrochemistry, external electron transfer is allowed only through an explicit reservoir/electrode boundary. Charge is never silently created or destroyed.

The validator operates after candidate generation and before thermodynamic/kinetic acceptance.

## 10. Product Graph Generation

Graph transformations are local and explicit.

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

Generation pipeline:
1. clone/construct a candidate working graph from participating reactants
2. apply bounded operations
3. split into connected components
4. normalize each product graph
5. reject invalid valence/charge structures
6. derive formulas and canonical keys
7. perform atom mapping and conservation validation
8. only then emit a candidate for 02 evaluation

Valence sanity is a structural pruning rule, not a full quantum-chemical proof of stability.

## 11. Stoichiometry Contract

Stoichiometric definition and reaction progress are separate concepts.

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

Rules:
- coefficients are positive magnitudes; side determines sign semantically
- coefficients must be finite and > 0
- normalize to the smallest practical integer ratio when the chemistry model yields exact integer stoichiometry
- do not force integers when a future coarse-grained model explicitly requires non-integer effective stoichiometry
- limiting reactant is determined from available amount divided by coefficient
- the kinetics layer determines how much of the allowed extent occurs during a timestep; stoichiometry only provides bounds and accounting

## 12. Thermodynamics / Kinetics Boundary

01 generates structurally valid candidates. 02 evaluates whether/how fast they proceed.

```ts
export interface ThermodynamicsQuery {
  candidateId: string;
  reactantKeys: readonly string[];
  productKeys: readonly string[];
  environmentKey: string;
  transformationSummary: readonly BondChange[];
}

export interface ThermodynamicsResult {
  status: "favorable" | "unfavorable" | "unknown";
  drivingForce?: number;
  confidence?: number;
  scientificStatus: ScientificStatus;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface KineticsQuery {
  candidateId: string;
  family: ReactionFamily;
  reactantSpeciesIds: readonly SpeciesId[];
  environmentKey: string;
  reactiveSiteKeys?: readonly string[];
}

export interface KineticsResult {
  status: "fast" | "moderate" | "slow" | "negligible" | "unknown";
  rateConstant?: number;
  rate?: number;
  confidence?: number;
  scientificStatus: ScientificStatus;
  metadata?: Readonly<Record<string, unknown>>;
}
```

Exact numeric meanings/units for thermodynamic driving force, rate constants, activities, and equilibrium belong to the 02 contract and must be explicitly versioned there.

## 13. Candidate Generation and Explosion Control

The engine must not enumerate arbitrary graph rearrangements.

Required sequence:
1. active-species filtering
2. cached graph/property analysis
3. reactive-site detection
4. reaction-family eligibility filtering
5. local transformation templates/rules
6. immediate valence/structural rejection
7. conservation validation
8. duplicate canonical candidate elimination
9. optional cheap energetic plausibility hints
10. deterministic scoring/pruning to a hard cap

Suggested Phase 0/1 controls:

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

All caps must be deterministic and observable in diagnostics. Silent nondeterministic truncation is forbidden.

Cache candidates/properties by canonical molecule keys plus relevant environment buckets when safe. Never cache environment-sensitive conclusions solely by molecule identity.

## 14. Determinism

For identical vessel state, deterministic seed/clock state, element/property registry version, rule-set version, and candidate budget, candidate enumeration order and accepted state transition must be reproducible.

Candidate ordering must not depend on JavaScript object insertion accidents or unstable hash iteration.

## 15. Scientific Status

```ts
export type ScientificStatus =
  | "VERIFIED"
  | "APPROXIMATED"
  | "EMPIRICAL"
  | "GAMEPLAY_SIMPLIFICATION"
  | "OPEN";
```

A structurally valid candidate is not automatically chemically favorable or kinetically relevant.

## 16. Validation Fixtures Required Before Phase 1 Claim

Representation fixtures must cover at minimum:
- H2
- O2
- H2O
- CO
- CO2
- CH4
- NH3

Required tests:
- formula derivation
- net charge derivation
- graph validation
- atom conservation
- charge conservation
- invalid valence rejection
- deterministic canonical identity for equivalent graph input order
- deterministic candidate ordering
- known reaction reproduction once family rules exist
- negative reaction tests
- randomized conservation/property tests
- candidate-count budget enforcement
- regression tests

## 17. Design Status

PASS:
- core schema can represent the required H/C/N/O molecules
- conservation boundaries are explicit
- generic graph transformations do not require reaction-equation hardcoding
- thermodynamics/kinetics separation is preserved
- acid-base/redox/electrochemistry extension points exist
- browser performance policy is bounded by local transformations and hard candidate budgets

OPEN:
- final canonical graph-labeling algorithm
- exact valence model for hypervalent/coordination/aromatic chemistry
- oxidation-state inference algorithm
- electron/proton reservoir representation for full electrochemistry
- exact thermo/kinetics units and environment-key contract from 02
- authoritative element/bond/property schemas and source metadata from 03

FAIL:
- none identified at Phase 0 contract level
