# 06 — Simulation Validation Lab

- Owner: Chemistry Simulation Validation Engineer / Regression Test Developer / Scientific Model Auditor / Performance Validation Engineer
- Current phase: Phase 0 — Architecture
- Overall state: DESIGN_COMPLETE / ACCEPTANCE_CONTRACT_INTEGRATED / EXECUTABLE_VALIDATION_OPEN
- Last updated: 2026-09-10
- Last checked main SHA: 1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1
- Active branch: docs/06-phase0-validation-architecture
- Active PR: #2
- PR #2 architecture HEAD before this status-only commit: 24c81a3bd69c3b695a7e9931a6b4bc9ca0b9e9da

## Current Objective
Integrate the pre-committed real-experiment acceptance criteria, SI-unit validation, benchmark-loader contract, phase/thermal validation, gameplay-progression regressions, state-transition ordering, and Actions-conscious CI tiers into the existing Phase 0 validation architecture without tuning production chemistry.

## Completed
- Re-checked latest `main` and confirmed `1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1` as source of truth immediately before branch refresh.
- Refreshed PR #2 branch directly onto latest main rather than creating a new PR.
- Reviewed required canonical files: `PROJECT.md`, `AGENTS.md`, `ROADMAP.md`, `docs/contracts/UNIT_SYSTEM.md`, `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`, `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`, `docs/product/GAME_UI_SYSTEM_ROADMAP.md`, and this workstream status.
- Reviewed PR #1, PR #3, and PR #5 only as unmerged parallel interface references; none was treated as production truth.
- Preserved the previous conservation, graph sanity, known/negative chemistry, randomized/property, deterministic replay, timestep, network stability, candidate-explosion, and regression design.
- Made `docs/contracts/REAL_EXPERIMENT_VALIDATION.md` the explicit canonical authority for acceptance thresholds and no-moving-goalposts policy.
- Defined hard absolute gates for conservation, charge, negative amounts, unexplained matter creation/destruction, major direction reversal, and qualitatively wrong dominant product family.
- Defined a deterministic dimension-aware floating-point tolerance policy shape; exact numeric tolerance values remain OPEN until 01/02 numeric representations and solver behavior exist.
- Integrated Tier A/B/C/D benchmark execution and aggregation architecture.
- Defined Tier B metric output including median, P90, maximum with case identity, signed bias/error, case count, and OPEN exclusions.
- Defined Tier C model-status-specific kinetics evaluation for characteristic timescale, rate ranking, NRMSE, and monotonicity/order behavior.
- Defined Tier D phase classification, transition temperature, triple/critical point, phase-boundary, and near-boundary uncertainty handling.
- Defined manifest-driven benchmark loader stages: schema validation -> SI validation -> provenance validation -> eligibility validation -> execution -> aggregation -> PASS/FAIL/OPEN.
- Aligned loader design with the interface shape proposed in PR #3 (`BenchmarkTier`, benchmark families, SI fields, provenance/status metadata) without depending on that unmerged branch as production truth.
- Defined canonical SI validation at benchmark/runtime/persistence boundaries and separated UI display conversions from authoritative state.
- Added future thermal-energy validation for reaction heat, heater, cooler, thermostat, explicit energy ledger, no temperature teleport, and latent-heat accounting.
- Added phase/reaction coupling validation that permits scientific PASS only with authoritative/experimental evidence or direct contract invariants.
- Added cross-system progression regression tests for discovery confirmation, one-time unlock, encyclopedia/inventory synchronization, unlimited unlocked stock with finite vessel additions, Developer Mode, Premium isolation, and deterministic save/load.
- Pre-committed state-transition ordering regression target: reaction progression -> heat/energy update -> phase reevaluation -> next reaction candidate generation.
- Updated CI proposal to PR fast / main standard / manual-nightly expensive tiers to conserve GitHub Actions usage.

## Canonical Acceptance Gates

### Absolute — hard FAIL
- element/atom conservation violation;
- charge conservation violation where applicable;
- negative material amount beyond numeric tolerance;
- unexplained matter creation/destruction;
- major reaction direction reversed;
- dominant product family qualitatively wrong.

### Tier A — canonical `REAL_EXPERIMENT_VALIDATION.md`
- reaction/no-reaction classification >= 95% for eligible HIGH-confidence cases;
- dominant/major product identity >= 95%;
- exothermic/endothermic sign = 100% for modeled eligible cases;
- stable macroscopic phase classification = 100% for simple single-component reference points clearly away from boundaries when phase modeling is supported;
- qualitative condition-response direction >= 90%.

Note: `REAL_EXPERIMENT_VALIDATION.md` assigns the >=98% away-from-boundary aggregate phase target to Tier D, not Tier A. 06 preserves the canonical values and will not substitute 98% for the current Tier A 100% requirement without a prior 00 HQ contract change.

### Tier B/C/D
All numerical thresholds are inherited directly from `REAL_EXPERIMENT_VALIDATION.md`; PR #2 does not redefine or loosen them.

## Benchmark Loader Status

DESIGN: PASS

EXECUTABLE IMPLEMENTATION: OPEN

Expected layout:

- `benchmarks/chemistry/manifest.json`
- `benchmarks/chemistry/phase/`
- `benchmarks/chemistry/calorimetry/`
- `benchmarks/chemistry/equilibrium/`
- `benchmarks/chemistry/reaction-direction/`
- `benchmarks/chemistry/non-reaction/`
- `benchmarks/chemistry/kinetics/`

Loader validation responsibilities:

- schema/version/ID/family/tier consistency;
- canonical SI validation;
- provenance/data-quality/confidence/status validation;
- like-with-like eligibility validation;
- benchmark execution;
- metric aggregation;
- PASS / FAIL / OPEN classification.

PR #3 currently proposes a compatible benchmark schema, but because PR #3 is unmerged the executable loader remains decoupled from it until integration decisions are made.

## In Progress
- No executable benchmark loader or scientific reference runner exists on production main yet.
- No production 01/02 implementation exists on main against which the full acceptance suite can be executed.

## Blockers / OPEN
- PR #1 molecular/reaction interfaces are still parallel/unmerged.
- PR #3 benchmark/data schema and populated benchmark corpus are still parallel/unmerged/not yet available on main.
- PR #5 thermo/phase/thermal interfaces are still parallel/unmerged.
- Exact dimension-aware floating-point absolute/relative tolerance values.
- Canonical deterministic major-product selection criterion.
- Equilibrium convergence thresholds/residual contract.
- Absolute candidate safety cap and representative browser runtime budget.
- Property-testing library selection.
- Actual CI workflow wiring for proposed tiers.
- Scientific benchmark population with sufficient provenance and reference conditions.

## Tests Executed / Not Executed

Executed:
- document/contract consistency audit against latest main;
- PR #2 branch refresh onto latest main;
- semantic comparison of validation architecture against canonical SI, progression, real-experiment, and product/thermal-phase contracts;
- interface compatibility review of PR #3 benchmark schema and PR #5 thermal/phase proposal as non-production references.

Not executed:
- no runtime chemistry tests;
- no TypeScript/Vitest suite;
- no benchmark execution;
- no randomized/property campaign;
- no performance stress run;
- no timestep/equilibrium/phase numerical run.

Reason: this task changes validation architecture/contracts only, and the required production chemistry/benchmark implementations are not present on main. No runtime PASS is claimed.

## Validation Evidence

### PASS
- Latest-main canonical contracts are compatible with the expanded validation architecture.
- `REAL_EXPERIMENT_VALIDATION.md` is now explicitly wired as the acceptance-threshold authority.
- Absolute gates, Tier A/B/C/D metric architecture, SI/provenance/eligibility loader architecture, thermal/phase/progression regression targets, deterministic ordering target, and Actions-conscious CI tiering are defined.
- Existing PR #2 validation design was preserved while branch history was refreshed onto latest main.

### FAIL
- None identified at contract/design level on latest checked main.

### OPEN
- Executable scientific correctness remains OPEN until 01/02 implementations and eligible 03 benchmark data exist on production/integration branches.
- Benchmark loader implementation remains OPEN.
- Numeric tolerance values, equilibrium tolerances, absolute candidate caps, and absolute browser budgets remain OPEN rather than guessed.
- Unmerged PR #1/#3/#5 proposals are not certified as production truth.

## Next Actions
1. After 01 interfaces stabilize, implement PR-fast conservation/graph/SI/determinism unit gates and deterministic major-product observability.
2. After 03 benchmark schema/corpus is integrated, implement manifest/schema/SI/provenance/eligibility loader tests before executing scientific scores.
3. After 02 thermal/phase solver interfaces stabilize, implement energy-ledger, phase, timestep, equilibrium, and ordering tests.
4. Add progression regressions when 04 discovery/inventory/save implementation exists.
5. Wire PR/main/manual-nightly CI tiers through 07 only when executable tests exist, avoiding redundant Actions usage.

## Handoffs

### 01 — Chemistry Simulation Engine
Expose stable graph/conservation/candidate/product/deduplication/seed/pruning diagnostics, finite SI amounts, deterministic reaction progress/extent, major-product observability, phase-aware candidate accessibility, and ordering-compatible state transitions.

### 02 — Thermodynamics & Kinetics
Expose SI thermodynamic/kinetic/phase values, reaction enthalpy sign/value, explicit thermal ledger, heater/cooler/thermostat exchange, phase/coexistence/near-boundary state, phase-dependent kinetic diagnostics, timestep/integration semantics, and equilibrium convergence diagnostics.

### 03 — Chemistry Data & Validation
Provide manifest/schema plus provenance-backed SI-normalized benchmarks with source measurements, reference conditions, uncertainty, quality/confidence/scientific status, and eligibility/exclusion metadata.

### 04 — Laboratory Gameplay
Expose deterministic confirmation -> encyclopedia -> inventory transitions, unlimited unlocked stock with finite SI vessel additions, Developer Mode/Premium boundaries, and deterministic save/load progression state.

### 05 — Web UI
Keep display-unit conversion and phase/thermal visualization outside authoritative chemistry state. UI/display preferences must not change benchmark results.

### 07 — Integration & GitHub
Own CI wiring and production integration after evidence exists. Avoid promoting contract-only design PASS into runtime scientific PASS.

06 does not tune reaction heuristics, thermodynamic/kinetic parameters, phase multipliers, progression behavior, or UI to make benchmarks pass.
