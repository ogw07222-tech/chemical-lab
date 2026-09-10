# 03 — Chemistry Data & Validation

- Owner: Chemistry Data Researcher / Chemical Property Data Engineer / Scientific Reference Analyst / Chemistry Model Validation Researcher
- Current phase: Phase 0 — Architecture / Integration
- Overall state: INTEGRATION_READY
- Last updated: 2026-09-11
- Last checked main SHA: c33f5e0bb6d30db63c4097edce30c4333a14b0c5
- Active branch: docs/phase0-chemistry-data-contract
- Active PR: #3 — Phase 0 chemistry data schema and provenance contract
- Exact TypeScript-tested code HEAD: f7c4db2f0daea2d05c4be6c4e6ea2a8bd4148ae4

## Current Objective
Finalize PR #3 against the merged Phase 0 contracts and provide an evidence-based immediate-integration handoff without adding a bulk numerical dataset.

## Completed
- Re-read latest `PROJECT.md`, `AGENTS.md`, `ROADMAP.md`, `docs/contracts/UNIT_SYSTEM.md`, `docs/contracts/MOLECULAR_REACTION_CORE.md`, `docs/contracts/THERMODYNAMICS_PHASE_THERMAL.md`, `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`, `docs/validation/PHASE0_VALIDATION_ARCHITECTURE.md`, this workstream status, and `docs/workstream-status/07-integration-github.md` from production main `c33f5e0bb6d30db63c4097edce30c4333a14b0c5`.
- Re-audited PR #3 HEAD/diff and reused the existing PR/branch; no new PR was created.
- Refreshed PR #3 directly onto latest main, replacing the prior stale-base branch history. The refresh commit/code HEAD is `f7c4db2f0daea2d05c4be6c4e6ea2a8bd4148ae4`.
- Confirmed normalized machine-consumed property values use SI units required by `UNIT_SYSTEM.md` while original source value/unit are preserved separately through `SourceMeasurement`.
- Confirmed `ScientificStatus` exactly matches the canonical five values: `VERIFIED`, `APPROXIMATED`, `EMPIRICAL`, `GAMEPLAY_SIMPLIFICATION`, `OPEN`.
- Audited `ElementData` against 01 `ElementDefinition`: identities and SI semantics are compatible, but provenance-rich data records must be projected through an explicit adapter to 01 runtime scalars such as `atomicMolarMassKgPerMol`; direct structural assignment is neither intended nor required.
- Audited phase representation against 01/02: 03 retains the richer lower-case data vocabulary while 02 Phase 0 uses narrower upper-case `BulkPhase`. An explicit adapter is required at the 03->02/01 runtime boundary; do not force a shared enum during Phase 0.
- Audited `ChemistryDataQuery`/records against 02 thermodynamic, phase, heat-capacity, latent-heat and phase-boundary requirements. Required SI quantities, source metadata, status/confidence and validity ranges are representable.
- Audited `ReferenceExperimentBenchmark` and manifest schema against 06 Phase 0 loader architecture. Directory/manifest/tier/provenance/SI/eligibility requirements are compatible; the corpus/loader remain future implementation work, not a blocker to the schema contract.
- Confirmed missing values are explicit and contractually forbidden from being encoded as zero, NaN, Infinity or guessed defaults. Runtime validators remain responsible for enforcing finiteness/ranges on populated data.
- Confirmed no executable tests currently exist on production main (`tests/` contains only `README.md`).

## Validation Evidence
- Latest-main freshness: PASS. PR #3 was rebuilt directly on `c33f5e0bb6d30db63c4097edce30c4333a14b0c5` before validation.
- Textual conflict audit: PASS. PR changes remain isolated to 03 contract/source/status and `src/data` schema files.
- SI normalization audit: PASS.
- Source-unit vs normalized-unit separation: PASS.
- 01 Species/Element naming/identity compatibility: PASS with explicit data->runtime projection adapter requirement.
- 02 thermodynamic/phase/thermal query compatibility: PASS with explicit phase adapter requirement.
- 06 benchmark-loader architecture compatibility: PASS at contract/schema level.
- ScientificStatus enum consistency: PASS.
- Missing-as-zero / NaN / Infinity semantics: PASS at contract level; populated runtime validation implementation remains future work.
- TypeScript compile/typecheck: PASS for exact code HEAD `f7c4db2f0daea2d05c4be6c4e6ea2a8bd4148ae4` using repository `tsconfig.json` semantics (`strict`, ES2022, Bundler resolution) and `npm run typecheck` with available `tsc 5.8.3`; zero diagnostics.
- `npm install --ignore-scripts`: ATTEMPTED but environment network/DNS access prevented completion and the command timed out. Dependency installation success is not claimed.
- `npm ci`: NOT APPLICABLE because production main has no committed package lockfile.
- Lint: NOT APPLICABLE; no lint script is defined in production `package.json`.
- Unit tests: NOT RUN / NOT APPLICABLE for this PR checkpoint because production `tests/` currently contains no executable tests and package installation was unavailable.
- GitHub Actions rerun: NOT REQUESTED; current main has no configured workflow evidence needed for this isolated checkpoint.

## Integration Audit
### 01 compatibility
`ElementData` is a provenance-bearing storage/normalization schema, whereas 01 `ElementDefinition` is a runtime projection. The adapter must extract compatible normalized scalar values and map names such as 03 molar-mass data to 01 `atomicMolarMassKgPerMol`. Species identifiers remain stable strings and phase remains outside molecular canonical identity. No blocking semantic conflict found.

### 02 compatibility
03 supplies phase-specific formation thermochemistry, heat-capacity values/correlations, latent heats, phase points/boundaries, vapor-pressure representations and validity metadata in SI. 02 remains authoritative for evaluation and may adapt 03 lower-case `Phase` values to its current `BulkPhase` vocabulary. No blocking semantic conflict found.

### 06 compatibility
`ReferenceExperimentBenchmark` + manifest can support the Phase 0 loader sequence: manifest discovery -> schema validation -> SI validation -> provenance validation -> eligibility -> execution -> verdict/aggregation. Real benchmark data and the executable loader remain OPEN by design.

## OPEN / Non-blocking Follow-up
- Concrete production adapters from 03 `ElementData` to 01 runtime `ElementDefinition` are not implemented yet because 01 runtime code does not yet exist.
- Concrete lower-case `Phase` -> 02 `BulkPhase` adapter is not implemented yet; 07 explicitly records this as an implementation-wiring OPEN item, not a Phase 0 schema merge blocker.
- Runtime schema/provenance/finiteness validators are not implemented yet.
- Actual H/C/N/O numerical property population remains OPEN by design.
- Real benchmark corpus and 06 executable loader/runner remain OPEN by design.
- Exact initial supported T/P domains, Cp extrapolation policy, EOS ownership and detailed latent-heat fidelity remain owned by 02/00 and do not block merging the data contract.

## Next Actions
1. 07 may integrate PR #3 after confirming the current final PR HEAD only adds this status update after the exact tested code HEAD.
2. 01 should implement a typed projection/adapter when runtime `ElementDefinition` code is introduced rather than importing provenance records directly.
3. 02 should implement a data-provider/phase adapter that preserves status, confidence and validity-domain semantics.
4. 06 should implement schema/SI/provenance validators and manifest loading before real benchmark acquisition scales up.
5. 03 should collect only the smallest trustworthy H/C/N/O property/benchmark set required by active 01/02/06 consumers.

## Handoffs
- 02 Thermodynamics & Kinetics: schema contract is integration-ready; consume it through a provider/phase adapter and keep extrapolation/status handling explicit.
- 06 Simulation Validation Lab: benchmark schema is integration-ready; implement manifest/schema/SI/provenance validation before adding a large corpus.
- 07 Integration & GitHub: **MERGE RECOMMENDATION — YES. The exact TypeScript-tested code HEAD `f7c4db2f0daea2d05c4be6c4e6ea2a8bd4148ae4` is safe to integrate; if the PR HEAD differs only by this 03 status-document commit, it remains merge-ready after a final mergeability check.**
