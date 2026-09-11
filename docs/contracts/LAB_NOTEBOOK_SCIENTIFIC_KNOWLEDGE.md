# Lab Notebook and Scientific Knowledge Contract

## Status
PROPOSED BY 04 — Laboratory Gameplay

This document defines the Game Layer contract for experiment notebooks, player hypotheses, derived-property worksheets, species knowledge progression, encyclopedia promotion, and unknown-species disclosure.

It must be read with:

- `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`
- `docs/contracts/SIMULATION_CONTRACT.md`
- `docs/contracts/UNIT_SYSTEM.md`
- `docs/product/GAME_UI_SYSTEM_ROADMAP.md`

It does not define chemistry truth, physical formulas, molecular-graph equality, reference values, or scientific validation tolerances.

## 1. Core Principle — Measurement Is Automatic, Interpretation Is Player Work

Canonical rule:

> Measurement is automatic; interpretation is player-driven.

When an instrument or authoritative simulation projection can directly provide a value, the player should not be asked to retype that value manually.

When multiple observations must be combined to infer meaning, estimate a property, propose an identity, or construct a scientific explanation, the Game Layer may ask the player to calculate, interpret, hypothesize, or submit an answer.

The purpose of notebook gameplay is scientific reasoning, not transcription labor.

## 2. Knowledge Acquisition Modes

Every notebook field definition has one acquisition mode.

```ts
export type KnowledgeAcquisitionMode =
  | "AUTO"
  | "SEMI_AUTO"
  | "PLAYER_INFERENCE";
```

### AUTO
Directly observable or instrument-projected values.

Typical fields:

- mass
- temperature
- pressure
- volume
- pH
- conductivity
- species amount when legitimately measurable/revealable
- concentration when legitimately measurable/revealable
- elapsed time
- raw spectrum/peak series
- phase observation
- instrument output
- measurement uncertainty

AUTO fields create measurement history without requiring manual re-entry.

### SEMI_AUTO
The evidence can be collected automatically, but a property must be derived from multiple observations, a fitted series, a standard procedure, or a provider-owned scientific calculation.

Typical fields:

- density
- molar mass
- boiling point
- melting point
- pKa
- equilibrium constant
- reaction enthalpy
- activation energy
- reaction order
- redox potential

A SEMI_AUTO field may be resolved either by:

1. a player calculation/submission; or
2. later-game approved analysis software/instrument automation using the same evidence contract.

Automation changes labor, not chemistry truth.

### PLAYER_INFERENCE
Interpretive knowledge not mechanically determined by one measurement.

Typical fields:

- molecular identity
- molecular formula interpretation when not directly revealed
- molecular structure
- functional groups
- reaction equation
- reaction mechanism hypothesis
- acid/base role interpretation
- oxidation/reduction interpretation
- unusual/reactivity classification

PLAYER_INFERENCE fields require a player or approved analysis system to submit a hypothesis before verification.

## 3. Notebook and Encyclopedia Are Different Systems

### Lab Notebook
Experiment-centered and intentionally messy.

It stores:

- raw measurements
- repeated measurements
- time series
- uncertainty
- evidence links
- calculations
- hypotheses
- rejected guesses
- verification feedback
- unknown-species local references
- experiment-specific notes

### Encyclopedia
Species-centered and curated.

It stores only knowledge that has crossed the required confirmation boundary, such as:

- confirmed identity
- confirmed structure when available
- confirmed/accepted properties
- validated phase behavior
- validated reaction-family associations
- discovery history
- provenance-backed reference information
- scientific status/confidence supplied by owning scientific layers

Notebook failures remain useful history but do not pollute the Encyclopedia.

Preferred flow:

`Observation -> Notebook -> Derivation/Hypothesis -> Verification -> Confirmed Knowledge -> Encyclopedia Projection`

## 4. Minimal Notebook State Model

The UX should not expose every possible scientific lifecycle label as one overloaded enum.

Recommended player-knowledge state:

```ts
export type NotebookKnowledgeStatus =
  | "OBSERVED"
  | "READY_FOR_DERIVATION"
  | "HYPOTHESIZED"
  | "SUBMITTED"
  | "CONFIRMED"
  | "REJECTED"
  | "OPEN";
```

Meaning:

- `OBSERVED`: one or more authoritative measurements/evidence records exist.
- `READY_FOR_DERIVATION`: required evidence contract is satisfied for a SEMI_AUTO field.
- `HYPOTHESIZED`: player has drafted an interpretation/calculation but not formally submitted it.
- `SUBMITTED`: awaiting or carrying a verification result.
- `CONFIRMED`: accepted as player-known knowledge and eligible for Encyclopedia promotion if the field policy allows it.
- `REJECTED`: submitted hypothesis failed verification; evidence/history remains.
- `OPEN`: evidence or scientific provider support is insufficient for resolution.

`MEASURED`, `CALCULATED`, `PLAUSIBLE`, `CLOSE`, and `REFERENCE_BACKED` are not all folded into this status enum:

- measurement/calculation method belongs in acquisition/evidence metadata;
- plausible/close belong to verification feedback;
- reference support belongs to a separate scientific-support axis.

## 5. Scientific Support Is a Separate Axis

Player knowledge must not be confused with project scientific certainty.

```ts
export type ScientificSupportStatus =
  | "REFERENCE_BACKED"
  | "REFERENCE_MATCHED"
  | "APPROXIMATED"
  | "GENERATED_UNVERIFIED"
  | "OPEN";
```

This status is supplied from 01/02/03/06 contracts or adapters. 04 does not promote a generated species or estimated property to reference-backed truth.

A player may have `CONFIRMED` notebook knowledge whose underlying scientific support is still `APPROXIMATED` or `GENERATED_UNVERIFIED`. The UI must display both dimensions honestly.

## 6. Notebook Entry Contract

```ts
export type NotebookFieldType = string;
export type NotebookEntryId = string;
export type EvidenceRef = string;

export type NotebookSubjectRef =
  | { kind: "species"; speciesKey: string }
  | { kind: "unknown"; unknownRef: string }
  | { kind: "reaction"; reactionRef: string }
  | { kind: "experiment"; experimentId: string };

export interface NotebookValue {
  value: unknown;
  canonicalUnit?: string;
  displayUnitHint?: string;
}

export interface NotebookEntry {
  entryId: NotebookEntryId;
  experimentId: string;
  subject: NotebookSubjectRef;
  fieldType: NotebookFieldType;
  acquisitionMode: KnowledgeAcquisitionMode;
  status: NotebookKnowledgeStatus;
  observedValues: readonly MeasurementRecord[];
  submittedValue?: NotebookValue;
  confirmedValue?: NotebookValue;
  evidenceRefs: readonly EvidenceRef[];
  verificationHistory: readonly VerificationRecord[];
  scientificSupport?: ScientificSupportStatus;
  createdAtSimulationTimeS?: number;
  updatedAtSimulationTimeS?: number;
}
```

`observedValues` is a history. New measurements normally append rather than overwrite.

## 7. Measurement History Contract

```ts
export interface MeasurementRecord {
  measurementId: string;
  fieldType: NotebookFieldType;
  value: NotebookValue;
  uncertainty?: NotebookValue;
  instrumentId?: string;
  observationRef: string;
  simulationTimeS: number;
  conditionRef?: string;
}
```

Rules:

- identical field types may have many measurements;
- repeated measurements are preserved if they correspond to distinct observation events, times, or conditions;
- exact duplicate ingestion of the same authoritative observation ID is idempotent;
- AUTO ingestion never requires the player to copy an instrument value into a text box;
- raw time series may be stored by reference rather than duplicating every sample inside each NotebookEntry.

All authoritative physical quantities use the canonical SI representation internally. 05 may render alternate display units through typed adapters.

## 8. Automatic Notebook Ingestion

Game Layer should support an adapter such as:

```ts
export interface NotebookObservationIngestor {
  ingestObservation(
    state: LabNotebookState,
    observation: ObservationRecord,
  ): LabNotebookTransition;
}
```

Eligible observation classes may produce or append AUTO entries for:

- mass
- temperature
- pressure
- volume
- pH
- conductivity
- concentration
- amount
- elapsed time
- spectrum/raw peak data
- detected macroscopic phase
- generic instrument output
- uncertainty

The ingestor must respect identity-disclosure policy. An observation associated internally with a hidden species may update an `unknownRef` notebook subject without revealing its species key to the normal UI.

## 9. Derived Value / Evidence Requirement Contract

04 owns the gameplay requirement graph, not scientific formulas.

```ts
export interface EvidenceRequirement {
  requirementId: string;
  fieldType: NotebookFieldType;
  requiredEvidenceKinds: readonly EvidencePredicate[];
  minimumDistinctConditions?: number;
  providerId: string;
}

export interface DerivedFieldReadiness {
  fieldType: NotebookFieldType;
  ready: boolean;
  satisfiedEvidenceRefs: readonly EvidenceRef[];
  missingRequirementIds: readonly string[];
}
```

Examples of conceptual requirements:

- density: compatible mass + volume evidence
- molar mass: approved mass/amount relation or qualified instrument evidence
- boiling point: phase-transition evidence + known pressure context
- melting point: phase-transition evidence + known pressure context
- pKa: qualified acid/base measurement series
- reaction enthalpy: qualified thermal/energy context and reaction extent/evidence
- activation energy: qualified rate data across conditions
- reaction order: qualified concentration/rate series
- redox potential: qualified electrochemical measurement context

These are requirement descriptions, not formulas.

The actual computation/fit/physical validity comes from an owning provider:

- 01 for structure/reaction semantics where applicable
- 02 for thermo/kinetics-derived quantities
- 03 for reference/property data and provenance
- 06 for acceptance/tolerance policy

04 must not implement a hidden duplicate scientific calculator merely to award notebook progress.

## 10. Submission and Verification Contract

```ts
export type VerificationOutcome =
  | "INCORRECT"
  | "PLAUSIBLE"
  | "CLOSE"
  | "CONFIRMED"
  | "UNVERIFIABLE";

export interface KnowledgeSubmission {
  submissionId: string;
  entryId: NotebookEntryId;
  submittedValue: NotebookValue;
  evidenceRefs: readonly EvidenceRef[];
  submittedAtSimulationTimeS?: number;
}

export interface VerificationRecord {
  verificationId: string;
  submissionId: string;
  outcome: VerificationOutcome;
  feedbackCode?: string;
  evaluatedAgainst?: string;
  tolerancePolicyId?: string;
  uncertaintyRef?: string;
  createdAtSimulationTimeS?: number;
}
```

Numeric verification conceptually compares:

`player estimate <-> validated/provider value <-> reference/measurement uncertainty <-> approved gameplay tolerance policy`

04 does not choose tolerance numbers.

Tolerance ownership:

- 03 supplies reference value, uncertainty, conditions, and provenance where available;
- 06 approves validation/tolerance policy;
- 01/02 supply model-owned truth when the field is structural/thermodynamic/kinetic;
- 04 stores submission and result;
- 05 presents feedback.

Verification should normally avoid revealing the exact correct answer after a failed submission unless the relevant knowledge has otherwise become confirmed/unlocked.

## 11. Structure Hypothesis Contract

Molecular structure is a high-value PLAYER_INFERENCE path.

```ts
export type StructureHypothesisCompleteness =
  | "FORMULA_ONLY"
  | "PARTIAL_STRUCTURE"
  | "FULL_STRUCTURE";

export interface StructureHypothesis {
  hypothesisId: string;
  entryId: NotebookEntryId;
  completeness: StructureHypothesisCompleteness;
  molecularFormula?: Readonly<Record<string, number>>;
  atomComposition?: readonly AtomCompositionHypothesis[];
  graphDraftRef?: string;
  functionalGroupHypotheses?: readonly string[];
  evidenceRefs: readonly EvidenceRef[];
}
```

Future 05 UI may attach a molecular graph editor to `graphDraftRef`.

04 owns draft/submission/progression state only.

01 owns canonical graph normalization, graph identity, graph equivalence, formula derivation from canonical structures, and structure-validation semantics.

## 12. Unknown Species Flow

Canonical normal-play flow:

`generated species exists internally`

`-> normal projection assigns/uses unknownRef`

`-> AUTO measurements accumulate under unknownRef`

`-> SEMI_AUTO calculations and PLAYER_INFERENCE hypotheses accumulate`

`-> approved analyzer or verification path confirms identity`

`-> IdentityConfirmedEvent`

`-> SpeciesDiscovery`

`-> Encyclopedia registration`

`-> Inventory unlock when permitted by canonical progression contract`

Critical invariant:

An internal species key, canonical graph, reference database match, developer metadata, or known name must not leak through the normal notebook merely because the backend knows it.

After identity confirmation, Game Layer may link prior `unknownRef` notebook history to the confirmed species entry without rewriting the historical fact that the observations were originally made while identity was unknown.

## 13. Encyclopedia Promotion Contract

Not every NotebookEntry becomes an Encyclopedia field.

```ts
export interface EncyclopediaKnowledgeField {
  fieldType: NotebookFieldType;
  value: NotebookValue;
  confirmedFromEntryIds: readonly NotebookEntryId[];
  scientificSupport: ScientificSupportStatus;
  provenanceRefs?: readonly string[];
  confirmedAtExperimentId?: string;
}
```

Promotion requires:

- player-knowledge state `CONFIRMED`;
- identity disclosure allowed for the target species;
- field policy permits Encyclopedia presentation;
- scientific support metadata is preserved, not upgraded by 04.

Rejected hypotheses, raw failed calculations, and ambiguous observations stay in the Notebook.

## 14. Anti-Grind Rules

The following are canonical gameplay requirements:

1. Direct instrument readings are AUTO-recorded; never require transcription for progression.
2. Exact re-ingestion of the same observation event is idempotent.
3. Repeating the same field under the same condition does not require duplicate manual submission unless repetition has genuine scientific value such as uncertainty reduction.
4. When evidence requirements are satisfied, SEMI_AUTO fields expose `READY_FOR_DERIVATION` rather than making the player rediscover prerequisite bookkeeping.
5. Later approved analysis software/instruments may automate SEMI_AUTO derivations without changing truth criteria.
6. Already `CONFIRMED` knowledge is not repeatedly quizzed for routine use.
7. Failed hypotheses favor targeted feedback and preserved evidence over punitive resource loss.
8. Evidence from multiple experiments on the same species may contribute to the same species knowledge graph.
9. The challenge is choosing experiments and interpreting evidence, not typing numbers already visible elsewhere.

## 15. Knowledge Completion

Completion is derived from confirmed fields, not a free-floating XP bar.

```ts
export type KnowledgeCategory =
  | "IDENTITY"
  | "STRUCTURE"
  | "BASIC_PROPERTIES"
  | "THERMAL_PROPERTIES"
  | "ACID_BASE"
  | "REDOX"
  | "REACTION_BEHAVIOR"
  | "PHASE_BEHAVIOR";

export interface KnowledgeCategoryProgress {
  category: KnowledgeCategory;
  confirmedFieldIds: readonly string[];
  applicableFieldIds: readonly string[];
  completionFraction?: number;
}
```

A UI may render 0–100% by multiplying a derived fraction, but the source of truth is the set of applicable and confirmed fields.

Fields that are unsupported, scientifically OPEN, or non-applicable should not silently count as player failure. Applicability must come from an approved field-definition/provider contract.

## 16. Generated / Unverified Species

Generated species may not have trusted external reference data.

Normal UI must distinguish:

- `REFERENCE_BACKED`
- `REFERENCE_MATCHED`
- `APPROXIMATED`
- `GENERATED_UNVERIFIED`
- `OPEN`

Rules:

- generated/unverified does not mean experimentally established real-world substance;
- do not invent precise reference properties;
- player notebook may still contain simulation observations and hypotheses;
- encyclopedia presentation must retain the scientific-support label;
- 04 never upgrades support status because the player guessed correctly within the simulation.

## 17. Save / Replay Contract

Notebook and knowledge progression are persistent Game Layer state.

Save state should retain at minimum:

- notebook schema version
- entries
- measurement history or stable time-series references
- evidence references
- hypotheses/submissions
- verification history
- confirmed fields
- rejected submissions
- unknownRef -> confirmed species linkage history
- discovery and encyclopedia state references
- canonical species references where disclosure is permitted
- scientific-support/provenance references
- data/schema/provider version identifiers

Replay should distinguish two concepts:

1. authoritative raw simulation/instrument events;
2. derived notebook transitions generated from those events.

Preferred deterministic architecture:

`recorded authoritative events + notebook schema/provider versions -> deterministic AUTO notebook reconstruction`

Player-authored hypotheses/submissions remain recorded commands/state and are replayed separately.

If a newer provider/version would derive a different result, archival replay should use the recorded compatible version rather than silently rewriting historical knowledge.

## 18. UI Contract for 05

05 should provide these surfaces without owning chemistry truth:

### Lab Notebook
- experiment list
- notebook entries
- measurement history
- raw time-series/spectrum links
- uncertainty display
- notes/hypotheses

### Unknown Species Page
- anonymous/local unknown label
- permitted visible measurements
- accumulated evidence
- no hidden species identity leak

### Property Worksheet
- evidence checklist
- readiness state
- player calculation/submission
- later analysis-software auto-derive action where allowed

### Hypothesis Submission
- submitted interpretation
- evidence links
- verification feedback: incorrect/plausible/close/confirmed/unverifiable

### Structure Hypothesis Placeholder
- formula-only
- partial structure
- full structure
- future molecular graph editor attachment

### Encyclopedia Species Page
- confirmed identity
- curated confirmed properties
- confirmed structure when available
- discovery history
- scientific-support/provenance labels
- knowledge categories/completion derived from confirmed fields

Normal UI must hide Developer Mode species keys, canonical hidden graphs, internal reference matches, candidate diagnostics, and unrevealed ground truth.

## 19. Ownership Boundaries

### 01 — Chemistry Simulation Engine
Owns:

- canonical molecular/species identity
- graph semantics/equality
- reaction semantics and structural transformations
- structural identity verification adapters

### 02 — Thermodynamics & Kinetics
Owns:

- thermodynamic/kinetic calculations
- equilibrium/rate/energy-derived scientific results
- phase/thermal scientific semantics

### 03 — Chemistry Data & Validation
Owns:

- reference values
- provenance
- uncertainty
- reference-match status
- scientific data quality

### 04 — Laboratory Gameplay
Owns:

- notebook state
- acquisition-mode definitions
- evidence linkage
- hypothesis/submission lifecycle
- knowledge progression
- encyclopedia promotion rules
- unknownRef disclosure/progression behavior
- anti-grind rules

### 05 — Web UI
Owns:

- notebook/worksheet/encyclopedia rendering
- graph editor UI when implemented
- unit/display formatting
- verification-feedback presentation

### 06 — Simulation Validation Lab
Owns/validates:

- scientific tolerance policy
- verification policy calibration
- evidence requirement validity
- no false confirmation under uncertainty
- deterministic notebook reconstruction tests

## 20. PASS / FAIL / OPEN

### PASS — Contract decisions
- AUTO / SEMI_AUTO / PLAYER_INFERENCE are separated.
- Measurement history is append-only/idempotent by observation identity rather than overwrite-only.
- Player-knowledge status and scientific-support status are separate axes.
- Notebook and Encyclopedia have distinct responsibilities.
- Unknown species can accumulate evidence without identity leakage.
- SEMI_AUTO uses evidence requirements plus external providers rather than duplicated formulas in Game Layer.
- Structure hypotheses have formula/partial/full completeness levels.
- Anti-grind rules make direct measurements automatic.
- Save/replay has a deterministic reconstruction direction.

### FAIL
- None identified at contract level.

### OPEN
- canonical `NotebookFieldDefinition` registry and exact MVP field list;
- exact ObservationRecord adapter shape from production Simulation/Instrument layer;
- analyzer capability progression and which identity channels may produce `IdentityConfirmedEvent`;
- field-specific evidence requirements;
- 03/06 tolerance-policy identifiers and policies;
- minimum MVP scientific-support labels visible to players;
- knowledge-category applicable-field registry;
- molecular graph editor representation contract with 01/05;
- exact persistence schema/migration rules;
- whether archived replay stores full derived notebook state, reconstructs it, or uses a hybrid checkpoint model.

## 21. Next Implementation Slice

### Minimum executable Notebook runtime
Implement only:

- `LabNotebookState`
- field-definition registry for a tiny MVP set
- AUTO observation ingestion with idempotent measurement history
- SEMI_AUTO readiness evaluation from evidence refs
- player submission history
- provider-agnostic verification result ingestion
- unknownRef -> confirmed species linking
- deterministic serialization

Do not implement scientific formulas in this runtime.

### Minimum UI slice
Implement:

- experiment notebook list
- measurement-history table
- one unknown-species evidence page
- one property worksheet
- submission/verification feedback component
- encyclopedia projection of confirmed fields

### Minimum verification adapter
Define one provider-neutral interface:

```ts
export interface KnowledgeVerificationProvider {
  verify(submission: KnowledgeSubmission): Promise<VerificationRecord>;
}
```

The adapter may delegate to 01, 02, 03/06 policy-backed services depending on field ownership. 04 must not encode their scientific truth internally.
