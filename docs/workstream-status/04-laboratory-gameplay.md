# 04 — Laboratory Gameplay

- Owner: Lead Laboratory Gameplay Designer / Chemistry Sandbox Systems Designer / Progression Designer / Experiment Gameplay Developer
- Current phase: Lab Notebook / Scientific Knowledge Contract
- Overall state: NOTEBOOK_CONTRACT_REFRESHED / READY_FOR_MERGE
- Last updated: 2026-09-11
- Latest production main incorporated: `f282443e9b1c07f082fa43d2bcf7061c275d758a`
- Active branch: `docs/lab-notebook-knowledge-contract`
- Active PR: #28 — `docs(game): define lab notebook scientific knowledge contract`

## Current Objective

Define a player-centered Lab Notebook / Encyclopedia contract that automatically records objective measurements while leaving interpretation primarily to the player rather than turning the notebook into a mandatory answer-submission system.

This work is contract/design only. It does not implement chemistry formulas, analyzer physics, scientific tolerances, graph-equality algorithms, reaction logic, or production UI.

## Canonical Direction

The notebook has three separate concepts:

1. **Scientific Record** — objective instrument/simulation observations and raw data, automatically recorded.
2. **My Notes** — free-form player-authored observations, interpretations, hypotheses, and reminders; never graded as correct/incorrect.
3. **Structured Hypothesis** — optional structured submissions only where verification has meaningful gameplay/scientific value, such as molecular identity, formula, structure, or selected quantitative estimates.

Canonical principle:

`direct measurement is automatic -> interpretation is player-owned -> formal verification is optional and targeted`

The previous `PLAYER_INFERENCE` concept is retained as an acquisition category but no longer implies that every interpretation must be submitted for grading.

## Completed Contract Work

### Scientific Record

Instrument-readable values and authoritative observations are AUTO-recorded with:

- measurement/event identity;
- value/unit;
- uncertainty where available;
- instrument/source reference;
- timestamp;
- condition/evidence references;
- repeat-measurement history.

The same authoritative observation is idempotent. Players are not asked to retype already known raw values.

### My Notes

Players may freely write notes such as:

- “물과 닿으면 빠르게 발열하는 것 같음”
- “공기 중 반응성 높음”
- “가열 시 기체 생성”

These notes:

- may link to evidence;
- are not evaluated against hidden truth;
- do not become `CONFIRMED`/`REJECTED` merely from text;
- do not unlock species by themselves;
- remain distinct from validated Encyclopedia facts.

Qualitative interpretations such as flammability, water reactivity, oxidizing behavior, or corrosiveness are not automatically mandatory system-defined answer fields.

### Optional Structured Hypothesis

Structured verification remains appropriate for high-value machine-verifiable targets such as:

- molecular identity;
- molecular formula;
- formula-only / partial / full molecular structure;
- selected quantitative estimates backed by approved provider/tolerance policy.

Structured submissions are optional rather than the default representation for all player interpretation.

### Notebook vs Encyclopedia

Lab Notebook is experiment-centered research history containing Scientific Record, My Notes, calculations/evidence, and optional structured hypotheses.

Encyclopedia is a species-centered curated player research record. It may show confirmed/validated/reference-backed facts and clearly labeled player research history, but it must not behave as an automatic ground-truth wiki merely because the backend knows a species.

### Unknown Species / Identity Leak

Canonical flow remains:

`internal species -> unknownRef -> Scientific Record + My Notes -> optional structured identity/structure hypothesis or approved analyzer -> IdentityConfirmedEvent -> SpeciesDiscovery -> Encyclopedia -> InventoryUnlock`

Normal projections must not leak hidden species keys, canonical graphs, reference matches, names, or developer metadata before disclosure is allowed.

### Anti-Grind

Canonical anti-grind requirements:

- instrument-readable values auto-record;
- duplicate observation ingestion is idempotent;
- confirmed/raw values are never retyped for progression;
- My Notes are freely authored and never graded;
- structured submissions are optional and limited to meaningful fields;
- confirmed structured knowledge is not repeatedly quizzed;
- evidence may accumulate across experiments;
- progression emphasizes experiment choice and interpretation rather than transcription.

## Ownership Boundaries

### 01 — Chemistry Simulation Engine
Owns molecular/species identity, graph semantics/equality, formula/structure verification semantics, and reaction structure.

### 02 — Thermodynamics & Kinetics
Owns thermodynamic/kinetic truth and derived physical results.

### 03 — Chemistry Data & Validation
Owns reference values, provenance, uncertainty, reference matching, and scientific data quality.

### 04 — Laboratory Gameplay
Owns:

- Notebook state;
- Scientific Record organization;
- player My Notes;
- evidence/history;
- optional Structured Hypothesis lifecycle;
- progression/Encyclopedia presentation rules;
- unknownRef progression/disclosure;
- anti-grind behavior.

04 does not own hardcoded chemistry-truth labels for qualitative property grading.

### 05 — Web UI
Owns Scientific Record, My Notes, worksheet/hypothesis, unknown-species, and Encyclopedia UI surfaces.

### 06 — Simulation Validation Lab
Owns scientific acceptance/tolerance policy and validation that structured confirmation does not produce false scientific claims.

## Phase 2 Compatibility

The branch was refreshed after Phase 2 reaction candidate/data/evaluation/validation integration and now incorporates production main `f282443e9b1c07f082fa43d2bcf7061c275d758a`.

The Notebook contract does not overwrite or redefine Phase 2 reaction/data/thermo/validation semantics.

## PASS / FAIL / OPEN

### PASS

- Scientific Record AUTO measurement direction defined.
- My Notes free-form/ungraded direction defined.
- optional Structured Hypothesis boundary defined.
- Notebook and Encyclopedia responsibilities separated.
- unknown species can accumulate research history without identity leakage.
- anti-grind rules prevent measurement transcription gameplay.
- player knowledge remains separate from scientific support.
- scientific ownership remains in 01/02/03/06.
- Phase 2 production docs/code semantics are not redefined by 04.

### FAIL

- None identified at contract level.

### OPEN

- executable `LabNotebookState` persistence schema;
- minimum Scientific Record field registry;
- production ObservationRecord -> Notebook adapter;
- exact MVP Structured Hypothesis fields;
- analyzer/identity-confirmation progression;
- field-specific evidence requirements;
- 03/06 tolerance policy IDs where needed;
- My Notes search/tagging UX;
- graph-editor exchange format with 01/05;
- long-save migration/checkpoint strategy.

## Next Implementation Slice

### 04 — Minimum Executable Notebook Runtime

Implement only:

- `LabNotebookState`;
- AUTO Scientific Record ingestion with idempotent history;
- free-form My Notes CRUD/persistence;
- tiny optional Structured Hypothesis registry;
- provider-neutral verification-result ingestion;
- unknownRef -> confirmed species linking;
- Encyclopedia projection of confirmed/disclosed fields;
- deterministic serialization.

Do not add scientific formulas, chemistry truth duplication, compulsory qualitative-property quizzes, or production UI in this runtime.
