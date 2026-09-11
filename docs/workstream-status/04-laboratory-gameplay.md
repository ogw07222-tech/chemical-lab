# 04 — Laboratory Gameplay

- Owner: Lead Laboratory Gameplay Designer / Chemistry Sandbox Systems Designer / Progression Designer / Experiment Gameplay Developer
- Current phase: Phase 1 — Progression and scientific-knowledge contracts
- Overall state: PROGRESSION_RUNTIME_IMPLEMENTED_NOTEBOOK_CONTRACT_DEFINED
- Last updated: 2026-09-11
- Last checked main SHA: `9c11c1c35d7a9c008c07811002229fa6528d7e75`
- Active branch: `docs/lab-notebook-knowledge-contract`
- Active PR: pending

## Current Objective
Define the Lab Notebook / Encyclopedia scientific-knowledge contract so players receive direct measurements automatically and only perform the interpretation/calculation work that is scientifically meaningful.

This task is design/contract only. No chemistry formulas, analyzer physics, tolerance numbers, structure-equality algorithms, or UI production implementation are added.

## Source of Truth Reviewed
- `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`
- `docs/contracts/SIMULATION_CONTRACT.md`
- `docs/contracts/UNIT_SYSTEM.md`
- `docs/product/GAME_UI_SYSTEM_ROADMAP.md`
- this workstream status file

Canonical project constraints preserved:

- one canonical simulation;
- undiscovered identity does not leak to normal UI;
- discovery still requires valid identity confirmation;
- unlocked inventory remains unlimited at Game Layer only;
- vessel additions remain finite;
- Developer Mode remains separate QA/debug access;
- chemistry truth remains owned by 01/02/03 and validation by 06.

## Completed

### New contract
Added:

`docs/contracts/LAB_NOTEBOOK_SCIENTIFIC_KNOWLEDGE.md`

and linked it from:

`docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`

### Core design principle
Canonical notebook UX principle:

`measurement is automatic -> interpretation is player-driven`

Direct instrument/simulation observations become AUTO notebook records. The player is not required to retype visible measurements for progression.

### Acquisition modes
Defined:

- `AUTO`
- `SEMI_AUTO`
- `PLAYER_INFERENCE`

AUTO covers direct measurements and raw instrument outputs.

SEMI_AUTO covers values derived from evidence or fitted/standard analysis, such as density, molar mass, boiling point, pKa, reaction enthalpy, activation energy, reaction order, and redox potential.

PLAYER_INFERENCE covers identity, formula/structure interpretation, functional groups, reaction equations/mechanism hypotheses, acid/base roles, redox interpretation, and similar high-level reasoning.

### Minimal knowledge state machine
Recommended player-facing status:

- `OBSERVED`
- `READY_FOR_DERIVATION`
- `HYPOTHESIZED`
- `SUBMITTED`
- `CONFIRMED`
- `REJECTED`
- `OPEN`

Measurement/calculation method, verification closeness, and scientific/reference certainty are intentionally not overloaded into this enum.

### Separate scientific-support axis
Defined:

- `REFERENCE_BACKED`
- `REFERENCE_MATCHED`
- `APPROXIMATED`
- `GENERATED_UNVERIFIED`
- `OPEN`

Player knowledge and scientific certainty are separate dimensions. A player may correctly identify a simulation-generated species while the project still marks that species `GENERATED_UNVERIFIED`.

### Notebook data model
Defined contracts for:

- `NotebookEntry`
- `NotebookSubjectRef`
- `MeasurementRecord`
- `NotebookValue`
- `EvidenceRequirement`
- `DerivedFieldReadiness`
- `KnowledgeSubmission`
- `VerificationRecord`
- `StructureHypothesis`
- `EncyclopediaKnowledgeField`
- knowledge-category completion

Repeated measurement events append history rather than overwrite prior evidence. Exact duplicate observation ingestion should be idempotent.

### Derived-value boundary
04 owns the evidence/readiness graph only.

Examples:

- density needs compatible mass + volume evidence;
- boiling/melting point need phase-transition evidence with pressure context;
- pKa needs qualified acid/base series;
- reaction enthalpy needs relevant thermal/reaction evidence;
- activation energy/reaction order need qualified multi-condition kinetic evidence.

04 does not implement the scientific equations. Providers from 01/02/03 plus 06-approved policy perform scientific evaluation.

### Submission and tolerance verification
Verification outcomes proposed:

- `INCORRECT`
- `PLAUSIBLE`
- `CLOSE`
- `CONFIRMED`
- `UNVERIFIABLE`

04 stores submissions and returned verification results. It does not select tolerance numbers.

Tolerance/reference responsibility remains:

- 01: structural/reaction semantics where applicable;
- 02: thermo/kinetics/model results;
- 03: reference values, uncertainty, provenance;
- 06: tolerance/acceptance policy;
- 04: progression state;
- 05: feedback rendering.

### Structure hypothesis
Defined progressive submission levels:

- formula only;
- partial structure;
- full structure.

A future 05 molecular graph editor can attach to a graph-draft reference. Canonical graph normalization/equality remains 01-owned.

### Unknown species flow
Canonical flow refined to:

`internal species -> unknownRef -> automatic measurements -> notebook evidence/hypotheses -> verification/analyzer -> IdentityConfirmedEvent -> SpeciesDiscovery -> Encyclopedia -> InventoryUnlock`

Internal species keys, reference matches, graphs, names, and developer/debug metadata remain hidden until disclosure is allowed.

Historical notebook evidence recorded under `unknownRef` may later link to the confirmed species without pretending the player knew the identity at observation time.

### Notebook vs Encyclopedia
Lab Notebook is experiment-centered and retains raw measurements, uncertainty, calculations, failed hypotheses, and history.

Encyclopedia is species-centered and only promotes confirmed/accepted knowledge with its scientific-support/provenance status intact.

### Anti-grind rules
Established:

- direct instrument readings auto-record;
- duplicate observation ingestion is idempotent;
- repeated same-condition transcription is not gameplay;
- SEMI_AUTO fields become ready when evidence requirements are satisfied;
- later-game software/instruments may automate SEMI_AUTO labor;
- confirmed fields are not repeatedly quizzed;
- failed hypotheses preserve learning evidence rather than impose grind penalties;
- cross-experiment evidence may accumulate for one species;
- progression focuses on experiment design and interpretation.

### Save / replay direction
Notebook saves should preserve measurement history/evidence, hypotheses, submissions, verification history, confirmed fields, rejected guesses, unknown-to-species linkage, scientific-support references, and schema/provider versions.

Preferred deterministic architecture:

`recorded authoritative observations + compatible notebook/provider versions -> deterministic AUTO notebook reconstruction`

Player-authored submissions remain separately recorded state/commands.

## 05 Handoff — Web UI
05 should design/implement these surfaces from the new contract:

- Lab Notebook
- experiment entry list
- unknown-species evidence page
- property worksheet
- hypothesis submission
- structure hypothesis editor placeholder
- evidence list
- verification feedback
- measurement history
- encyclopedia species page
- knowledge completion derived from confirmed fields

Normal UI must not expose hidden species keys, canonical backend graphs, internal reference matches, candidate diagnostics, or unrevealed ground truth.

## 01 Handoff
Provide/standardize adapters for:

- species/canonical identity refs;
- structural hypothesis verification;
- formula/graph semantic comparison;
- reaction-structure semantics when notebook fields depend on them.

04 should consume results, not graph algorithms.

## 02 Handoff
Provide analysis-provider contracts for thermo/kinetic SEMI_AUTO fields, including applicability/uncertainty/status where supported. 04 supplies evidence refs/readiness but not formulas.

## 03 Handoff
Provide reference-value/provenance/uncertainty/reference-match metadata for Encyclopedia and verification adapters. Generated/unverified species must remain distinguishable from reference-backed species.

## 06 Handoff
Validate:

- field-specific evidence requirements;
- scientific tolerance policies;
- uncertainty-aware verification behavior;
- no false `CONFIRMED` promotion;
- generated/unverified scientific-support labeling;
- deterministic notebook reconstruction from observation/event streams;
- identity-leak prevention through notebook/encyclopedia projections.

## PASS / FAIL / OPEN

### PASS — contract/design
- AUTO / SEMI_AUTO / PLAYER_INFERENCE separation defined.
- Player knowledge and scientific support separated.
- Notebook and Encyclopedia responsibilities separated.
- Unknown species can accumulate evidence without identity leakage.
- Repeated measurements preserve history.
- SEMI_AUTO evidence graph does not duplicate scientific formulas in 04.
- Structure hypothesis progression is extensible to a future graph editor.
- Tolerance ownership remains outside 04.
- Anti-grind rules explicitly prevent measurement transcription gameplay.
- Save/replay direction supports deterministic reconstruction.

### FAIL
- None identified at design-contract level.

### OPEN
- canonical `NotebookFieldDefinition` registry and exact MVP field set;
- production ObservationRecord -> Notebook adapter shape;
- approved analyzer/identity-confirmation channels;
- exact per-field evidence requirements;
- 03/06 tolerance-policy IDs;
- player-facing support/status wording;
- applicable-field registry for knowledge completion;
- 01/05 molecular graph editor exchange format;
- notebook persistence/migration schema;
- full derived-state reconstruction vs hybrid checkpoint persistence.

## Next Implementation Slice

### Minimum executable Notebook runtime
Implement only:

- `LabNotebookState`;
- a tiny versioned field-definition registry;
- AUTO observation ingestion with idempotent measurement history;
- SEMI_AUTO readiness evaluation from evidence references;
- submission/verification history ingestion;
- unknownRef -> confirmed species linking;
- deterministic serialization.

No scientific formulas should be added to that runtime.

### Minimum UI slice
Implement:

- experiment notebook list;
- measurement-history table;
- one unknown-species evidence page;
- one property worksheet;
- submission/verification feedback;
- encyclopedia projection of confirmed fields.

### Minimum verification adapter
Use one provider-neutral verification interface which can delegate by field ownership to 01, 02, or 03/06-backed services. 04 must not encode scientific truth internally.
