# Lab Notebook and Scientific Knowledge Contract

## Status
PROPOSED BY 04 — Laboratory Gameplay

This document defines the Game Layer contract for experiment notebooks, scientific records, player-authored notes, optional structured hypotheses, species knowledge progression, Encyclopedia projection, and unknown-species disclosure.

Read with:

- `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`
- `docs/contracts/SIMULATION_CONTRACT.md`
- `docs/contracts/UNIT_SYSTEM.md`
- `docs/product/GAME_UI_SYSTEM_ROADMAP.md`
- `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`

It does not define chemistry truth, physical formulas, molecular-graph equality, reference values, thermodynamic/kinetic truth, or scientific validation tolerances.

## 1. Canonical Product Direction

The notebook is a player research record, not a recurring quiz sheet.

Canonical rule:

> Direct measurement is automatic. Interpretation is player-owned. Formal submission is optional and reserved for scientifically useful structured targets.

The notebook has three distinct concepts:

1. **Scientific Record** — authoritative measurements, instrument/raw data, and observation history.
2. **My Notes** — free-form player observations, interpretations, reminders, and hypotheses. These are never graded as right/wrong.
3. **Structured Hypothesis** — optional structured submissions only where verification has real gameplay/scientific value, such as identity, molecular formula/structure, or selected quantitative estimates.

The purpose is to support experimentation and reasoning without forcing every interpretation into a system-defined answer box.

## 2. Knowledge Acquisition Modes

```ts
export type KnowledgeAcquisitionMode =
  | "AUTO"
  | "SEMI_AUTO"
  | "PLAYER_INFERENCE";
```

These modes describe how evidence/knowledge is acquired. They do **not** imply that every non-AUTO item must be submitted for grading.

### AUTO

Directly observable or instrument-projected records.

Examples:

- mass
- temperature
- pressure
- volume
- pH
- conductivity
- amount/concentration when legitimately measurable or revealable
- elapsed time
- raw spectrum / peak series
- phase observation
- generic instrument output
- uncertainty

AUTO records belong in the Scientific Record and require no manual transcription.

### SEMI_AUTO

Evidence is recorded automatically, but a derived quantity may require multiple observations, a fit, or a provider-owned scientific calculation.

Examples may include:

- density
- molar mass
- boiling or melting point
- pKa
- equilibrium constant
- reaction enthalpy
- activation energy
- reaction order
- redox potential

A SEMI_AUTO result may come from:

- an optional player calculation/submission when that has gameplay value; or
- an approved analysis instrument/software path.

04 owns evidence/readiness progression only. It does not duplicate formulas owned by 01/02/03/06.

### PLAYER_INFERENCE

Interpretation based on observations.

Possible examples:

- molecular identity
- molecular formula
- molecular structure
- functional-group hypothesis
- qualitative reaction interpretation
- mechanism hypothesis
- notes about observed behavior

`PLAYER_INFERENCE` does **not** mean “must be graded.”

A player may record free interpretations such as:

- “물과 닿으면 빠르게 발열하는 것 같음”
- “공기 중 반응성 높음”
- “가열 시 기체 생성”

as My Notes with no verification request.

Properties such as flammability, water reactivity, oxidizing character, corrosiveness, or similar qualitative interpretations must not automatically become hardcoded truth-label quiz fields merely because the player can describe them.

## 3. Scientific Record

Scientific Record is the objective experiment log.

It stores authoritative or instrument-projected observations such as:

- measurement values and canonical units;
- uncertainty when available;
- instrument identity/capability reference;
- observation/event reference;
- simulation timestamp;
- conditions or condition references;
- raw time-series/spectrum references;
- repeated measurements.

```ts
export type EvidenceRef = string;

export interface NotebookValue {
  value: unknown;
  canonicalUnit?: string;
  displayUnitHint?: string;
}

export interface MeasurementRecord {
  measurementId: string;
  fieldType: string;
  value: NotebookValue;
  uncertainty?: NotebookValue;
  instrumentId?: string;
  observationRef: string;
  simulationTimeS: number;
  conditionRef?: string;
}
```

Rules:

- instrument-readable values are auto-recorded;
- the same authoritative observation ID is ingested idempotently;
- distinct measurements/times/conditions remain distinct history entries;
- known raw values are never re-entered manually for progression;
- canonical physical quantities remain SI internally;
- 05 may convert display units without changing authoritative values.

## 4. My Notes

My Notes are player-authored and intentionally free-form.

```ts
export interface PlayerNotebookNote {
  noteId: string;
  experimentId: string;
  subject: NotebookSubjectRef;
  text: string;
  evidenceRefs?: readonly EvidenceRef[];
  createdAtSimulationTimeS?: number;
  updatedAtSimulationTimeS?: number;
}
```

Rules:

- notes may contain observations, speculation, hypotheses, plans, labels, or reminders;
- notes may optionally link to measurements/evidence;
- notes are not checked against hidden scientific truth;
- notes do not become `CONFIRMED`, `REJECTED`, or `INCORRECT` merely because their text disagrees with a provider;
- notes do not unlock species or scientific facts by themselves;
- 04 does not maintain hardcoded “correct property interpretation” labels for free text;
- Encyclopedia may preserve selected player notes as research history, but player-authored prose must remain visibly distinct from validated/reference-backed facts.

My Notes should be useful even when no structured hypothesis exists for the subject.

## 5. Structured Hypotheses Are Optional

Structured hypotheses exist only when a machine-verifiable submission creates real gameplay value.

Appropriate targets include:

- molecular identity;
- molecular formula;
- molecular structure;
- formula-only / partial / full structure hypotheses;
- selected quantitative estimates with an approved provider/tolerance policy.

They are not the default representation for every qualitative chemical property.

```ts
export type NotebookKnowledgeStatus =
  | "OBSERVED"
  | "READY_FOR_DERIVATION"
  | "HYPOTHESIZED"
  | "SUBMITTED"
  | "CONFIRMED"
  | "REJECTED"
  | "OPEN";

export interface StructuredHypothesisEntry {
  entryId: string;
  experimentId: string;
  subject: NotebookSubjectRef;
  fieldType: string;
  acquisitionMode: "SEMI_AUTO" | "PLAYER_INFERENCE";
  status: NotebookKnowledgeStatus;
  submittedValue?: NotebookValue;
  confirmedValue?: NotebookValue;
  evidenceRefs: readonly EvidenceRef[];
  verificationHistory: readonly VerificationRecord[];
  scientificSupport?: ScientificSupportStatus;
}
```

A field may have evidence and notes without ever creating a StructuredHypothesisEntry.

## 6. Subject and Unknown-Identity Contract

```ts
export type NotebookSubjectRef =
  | { kind: "species"; speciesKey: string }
  | { kind: "unknown"; unknownRef: string }
  | { kind: "reaction"; reactionRef: string }
  | { kind: "experiment"; experimentId: string };
```

Normal-play identity disclosure remains strict:

- hidden species keys must not leak through Scientific Record;
- My Notes must not receive hidden backend names/graphs/reference matches;
- structured hypothesis feedback must not expose the correct identity after a failed guess unless disclosure is otherwise allowed;
- historical observations made under `unknownRef` remain historically linked to that unknown context even after later identity confirmation.

Canonical flow:

`internal species -> unknownRef -> Scientific Record + My Notes -> optional structured identity/structure hypothesis or approved analyzer -> IdentityConfirmedEvent -> SpeciesDiscovery -> Encyclopedia -> InventoryUnlock`

## 7. Scientific Support Is Separate From Player Knowledge

```ts
export type ScientificSupportStatus =
  | "REFERENCE_BACKED"
  | "REFERENCE_MATCHED"
  | "APPROXIMATED"
  | "GENERATED_UNVERIFIED"
  | "OPEN";
```

This status comes from scientific owner layers/adapters. 04 never upgrades support because the player wrote or submitted something plausible.

A structured player hypothesis can be `CONFIRMED` while the underlying scientific support remains `APPROXIMATED`, `GENERATED_UNVERIFIED`, or `OPEN`.

My Notes do not receive a scientific-support verdict at all unless a separate validated fact is being displayed beside them.

## 8. Evidence / Derived-Value Readiness

04 may track whether evidence required by a provider is available.

```ts
export interface EvidenceRequirement {
  requirementId: string;
  fieldType: string;
  requiredEvidenceKinds: readonly EvidencePredicate[];
  minimumDistinctConditions?: number;
  providerId: string;
}

export interface DerivedFieldReadiness {
  fieldType: string;
  ready: boolean;
  satisfiedEvidenceRefs: readonly EvidenceRef[];
  missingRequirementIds: readonly string[];
}
```

Examples:

- density: compatible mass + volume evidence;
- boiling/melting point: phase-transition evidence plus pressure context;
- pKa: qualified acid/base measurement series;
- reaction enthalpy: qualified thermal/reaction evidence;
- activation energy: qualified rate data across temperatures;
- reaction order: qualified concentration/rate series.

These are requirement descriptions, not equations.

Scientific computation/validity remains owned by:

- 01 for molecular/reaction structure semantics;
- 02 for thermodynamics/kinetics;
- 03 for reference/property data and provenance;
- 06 for validation/tolerance policy.

## 9. Structured Submission and Verification

```ts
export type VerificationOutcome =
  | "INCORRECT"
  | "PLAUSIBLE"
  | "CLOSE"
  | "CONFIRMED"
  | "UNVERIFIABLE";

export interface KnowledgeSubmission {
  submissionId: string;
  entryId: string;
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

Verification is available only for fields with an approved scientific owner/provider and, where quantitative tolerance is needed, an approved policy.

04 stores submission state and returned results. It does not calculate chemistry truth or choose tolerance values.

Free-form My Notes never enter this verification pipeline.

## 10. Structure Hypothesis Contract

Molecular structure is a high-value optional structured hypothesis.

```ts
export type StructureHypothesisCompleteness =
  | "FORMULA_ONLY"
  | "PARTIAL_STRUCTURE"
  | "FULL_STRUCTURE";

export interface StructureHypothesis {
  hypothesisId: string;
  entryId: string;
  completeness: StructureHypothesisCompleteness;
  molecularFormula?: Readonly<Record<string, number>>;
  atomComposition?: readonly AtomCompositionHypothesis[];
  graphDraftRef?: string;
  functionalGroupHypotheses?: readonly string[];
  evidenceRefs: readonly EvidenceRef[];
}
```

04 owns draft/submission/progression state.

01 owns canonical graph normalization, formula derivation from canonical structures, graph identity/equivalence, and structure verification semantics.

05 owns any future graph-editor UI.

## 11. Notebook and Encyclopedia Are Different

### Lab Notebook

Experiment-centered research history containing:

- Scientific Record;
- My Notes;
- calculations/worksheets where applicable;
- optional Structured Hypotheses;
- failed/rejected structured submissions;
- evidence links;
- unknown-species research history.

### Encyclopedia

Species-centered curated projection containing only appropriately disclosed and confirmed/validated knowledge, such as:

- confirmed identity;
- confirmed structure when available;
- validated/reference-backed properties where appropriate;
- discovery history;
- scientific support/confidence/provenance metadata;
- optional clearly labeled player research notes/history.

The Encyclopedia is **not** an automatic answer wiki that reveals every property once a species exists internally.

It grows from player research/discovery and approved scientific projections.

## 12. Encyclopedia Promotion

```ts
export interface EncyclopediaKnowledgeField {
  fieldType: string;
  value: NotebookValue;
  confirmedFromEntryIds: readonly string[];
  scientificSupport: ScientificSupportStatus;
  provenanceRefs?: readonly string[];
  confirmedAtExperimentId?: string;
}
```

Structured facts may be promoted only when:

- identity disclosure is allowed;
- the field policy permits Encyclopedia display;
- required confirmation/provider support exists;
- scientific support metadata is preserved.

Free My Notes are not silently converted into validated Encyclopedia truth.

## 13. Anti-Grind Rules

Canonical requirements:

1. Instrument-readable values auto-record into Scientific Record.
2. The same authoritative observation event is idempotent.
3. Known/raw values are never retyped merely to progress.
4. Repeating the same field under the same conditions does not require duplicate manual submission unless repetition has genuine scientific value.
5. My Notes are freely authored and never graded.
6. Structured submissions are optional and limited to fields with meaningful verification value.
7. Confirmed structured knowledge is not repeatedly quizzed for routine use.
8. Evidence may accumulate across experiments.
9. Later approved analysis tools may automate suitable SEMI_AUTO derivations without changing chemistry truth.
10. The core challenge is choosing experiments and interpreting evidence, not transcribing known numbers or filling compulsory property-label forms.

## 14. Generated / Unverified Species

Generated species may lack external reference data.

Rules:

- do not invent precise reference properties;
- simulation observations may still enter Scientific Record;
- players may still write My Notes and hypotheses;
- structured verification returns `UNVERIFIABLE`/`OPEN` where support is insufficient;
- Encyclopedia presentation retains `GENERATED_UNVERIFIED` or `OPEN` support status;
- 04 never upgrades support based on player text or gameplay convenience.

## 15. Save / Replay

Persistent Notebook state should retain, as applicable:

- schema version;
- Scientific Record / measurement history or stable raw-data references;
- My Notes;
- evidence refs;
- structured hypotheses/submissions;
- verification history;
- confirmed structured fields;
- unknownRef -> confirmed-species linkage history;
- Encyclopedia/discovery references;
- scientific-support/provenance refs;
- compatible provider/schema version IDs.

Preferred deterministic architecture:

`authoritative recorded observations + compatible notebook/provider versions -> deterministic Scientific Record reconstruction`

Player-authored notes and structured submissions remain separately persisted player state/commands.

## 16. Ownership Boundaries

### 01 — Chemistry Simulation Engine

Owns molecular identity, molecular graph semantics/equality, formula/structure semantics, reaction structure, and related verification adapters.

### 02 — Thermodynamics & Kinetics

Owns thermodynamic/kinetic truth, rates/barriers/equilibrium evaluation, and model-owned derived results.

### 03 — Chemistry Data & Validation

Owns reference values, provenance, uncertainty, data quality, and reference matching.

### 04 — Laboratory Gameplay

Owns:

- Notebook state;
- Scientific Record organization;
- player My Notes;
- evidence/history linkage;
- optional structured-hypothesis lifecycle;
- knowledge/discovery progression presentation;
- Encyclopedia promotion policy;
- unknownRef disclosure/progression behavior;
- anti-grind behavior.

04 does **not** own hardcoded truth labels such as flammability/water-reactivity/oxidizer/corrosive classifications merely for notebook grading.

### 05 — Web UI

Owns rendering/editing surfaces for Scientific Record, My Notes, worksheets, structured hypotheses, unknown species, and Encyclopedia.

### 06 — Simulation Validation Lab

Owns/validates scientific acceptance/tolerance policy, uncertainty-aware confirmation, no false confirmation, and deterministic reconstruction/integration tests.

## 17. UI Contract for 05

Minimum conceptual surfaces:

- **Scientific Record:** chronological measurements/raw data, uncertainty, conditions.
- **My Notes:** free-form editable notes with optional evidence links.
- **Unknown Species:** permitted evidence without identity leak.
- **Optional Structured Hypothesis:** identity/formula/structure or selected quantitative submission.
- **Encyclopedia:** curated player research record plus clearly distinguished validated/reference-backed facts.

The UI must never present free-form My Notes as system-verified scientific truth.

## 18. PASS / FAIL / OPEN

### PASS — Contract decisions

- AUTO measurement recording is canonical.
- Scientific Record and My Notes are separate concepts.
- My Notes are free-form and ungraded.
- Structured Hypothesis is optional and limited to scientifically/gameplay-meaningful fields.
- qualitative property interpretations are not automatically compulsory answer fields.
- Notebook and Encyclopedia have distinct responsibilities.
- Encyclopedia is research/progression-oriented, not an automatic ground-truth wiki.
- player knowledge and scientific support remain separate.
- unknown species can accumulate evidence without identity leakage.
- repeated measurements retain history and duplicate observation ingestion is idempotent.
- scientific formulas/truth/tolerance remain outside 04.
- anti-grind rules prevent measurement transcription gameplay.

### FAIL

- None identified at contract level.

### OPEN

- exact executable Notebook persistence schema;
- minimal versioned Scientific Record field registry;
- production ObservationRecord -> Notebook adapter;
- exact identity-confirmation/analyzer capability progression;
- exact structured fields offered in MVP;
- field-specific evidence requirements;
- 03/06 tolerance-policy identifiers where required;
- My Notes search/tagging UX;
- 01/05 molecular graph editor exchange format;
- migration/checkpoint strategy for long saves.

## 19. Next Implementation Slice — Minimum Executable Notebook Runtime

Implement only:

- `LabNotebookState`;
- Scientific Record AUTO observation ingestion with idempotent history;
- free-form My Notes CRUD/persistence;
- a tiny optional structured-hypothesis registry;
- provider-agnostic verification result ingestion;
- unknownRef -> confirmed species linking;
- Encyclopedia projection of confirmed/disclosed fields;
- deterministic serialization.

Do not add scientific formulas, chemistry truth duplication, compulsory qualitative-property quizzes, or UI production code to the 04 runtime.
