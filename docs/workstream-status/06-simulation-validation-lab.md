# 06 — Simulation Validation Lab

- Owner: Chemistry Simulation Validation Engineer / Regression Test Developer / Scientific Model Auditor / Performance Validation Engineer
- Current phase: Phase 1 — Executable Validation Harness Foundation
- Overall state: HARNESS_FOUNDATION_IMPLEMENTED / VITEST_EXECUTION_BLOCKED / SCIENTIFIC_BENCHMARKS_OPEN
- Last updated: 2026-09-11
- Last checked main SHA: 567994693e56a7013cbcce0d95222a6cb98594af
- Active branch: feature/06-phase1-validation-harness
- Active PR: #11

## Current Objective
Provide executable validation primitives before a real scientific benchmark corpus exists, without tuning chemistry or fabricating experiment values.

## Implemented Validation Primitives

Production-independent code now exists under `src/validation/`:

- `policy.ts`
  - `VALIDATION_POLICY_SOURCE = docs/contracts/REAL_EXPERIMENT_VALIDATION.md`
  - centralized frozen `CanonicalValidationPolicy`
  - deterministic dimension-aware numerical tolerance policy/helpers
- `core.ts`
  - `PASS` / `FAIL` / `OPEN` validation verdicts
  - separate `VERIFIED` / `APPROXIMATED` / `EMPIRICAL` / `GAMEPLAY_SIMPLIFICATION` / `OPEN` scientific-model status
  - absolute-gate override helper
  - finite-number and non-negative physical-state validation
  - authoritative SI-state sanity validation
  - deterministic canonical result serialization
- `invariants.ts`
  - exact invariant assertions
  - tolerance-aware numeric invariant assertions
  - exact element-inventory conservation assertion
- `metrics.ts`
  - absolute error
  - relative error with explicit zero-reference handling
  - median
  - percentile / P90
  - signed bias
  - NRMSE
- `benchmark.ts`
  - benchmark/manifest adapter interfaces independent of 03 concrete schema
  - manifest source/loader boundary
  - manifest identity/duplicate validation
  - eligibility skeleton
  - OPEN exclusion from aggregate denominator
  - median/P90/max/signed-bias aggregation
- `index.ts`
  - validation harness public exports

No real experimental measurements or reaction-specific scientific fixture numbers were introduced.

## Canonical Threshold Authority

`docs/contracts/REAL_EXPERIMENT_VALIDATION.md` remains the sole scientific acceptance-threshold authority.

Threshold values are centralized in `CanonicalValidationPolicy`; metric, invariant, eligibility, and aggregation helpers do not carry independent copies.

The deterministic tolerance table is explicitly a floating-point representation policy, not a scientific acceptance policy. It cannot depend on a desired PASS/FAIL outcome.

## Adapter / Dependency Boundary

The executable harness does not import PR #3 benchmark schema types directly. `BenchmarkManifestAdapter`, `BenchmarkAdapterRecord`, and `ManifestSource` provide a dependency-inversion boundary so a future 03 schema adapter can be connected without making validation primitives depend on the concrete data implementation.

## Tests Added

`tests/validation.foundation.test.ts` covers:

- PASS result
- FAIL result
- OPEN result
- scientific status separated from validation verdict
- absolute-gate violation always yields FAIL
- deterministic same-input result representation
- absolute error
- median
- P90
- signed bias
- NRMSE
- normal relative error
- zero-reference relative-error handling
- invalid absolute-temperature SI state rejection
- negative physical state rejection
- NaN rejection
- Infinity rejection
- exact element-inventory conservation
- tolerance independence from desired verdict
- canonical threshold-authority identity/frozen policy
- insufficient benchmark eligibility -> OPEN
- schema-independent manifest validation/loading
- OPEN case exclusion from aggregate denominator

All test values are synthetic validation-tooling examples, not scientific experiment fixtures.

## Validation Performed

### PASS

- Latest main rechecked during task. Initial audited main was `c33f5e0bb6d30db63c4097edce30c4333a14b0c5`; main advanced during work to `567994693e56a7013cbcce0d95222a6cb98594af` through an accidental placeholder plus immediate revert with no intended net content change.
- Feature branch was merged forward to include latest main before closeout.
- Available local TypeScript compiler (`tsc 5.8.3`) strict-compiled the reconstructed `src/validation/*.ts` source with zero diagnostics.
- Validation result/scientific-status separation is implemented.
- Absolute-gate override, SI/finite-state validation, tolerance helpers, metric primitives, OPEN exclusion, deterministic result representation, eligibility, and manifest adapter foundation are implemented.
- No production chemistry tuning or fabricated scientific data was added.

### FAIL

- None identified in the implemented validation primitive source during the available static compile/audit.

### OPEN / BLOCKED

- Repository `npm test` / Vitest execution: BLOCKED in this execution environment because Vitest is not installed globally and external npm/GitHub DNS access is unavailable.
- Repository full `npm run typecheck` using installed project dependencies: OPEN for the same environment reason. Source-only strict TypeScript validation passed separately.
- No GitHub Actions workflow exists on current main to supply an automatic PR test result.
- Real-experiment benchmark corpus execution: OPEN; no corpus was added in this task.
- Monte Carlo stress, full reaction-network validation, large performance matrices, timestep matrices, and production chemistry scientific PASS remain outside this task.

## Handoffs

### 01 — Chemistry Simulation Engine
Connect molecular-core/reaction outputs to the invariant helpers through adapters. Provide authoritative element/charge inventories and accepted-transition state snapshots. PR #10 is a relevant Phase 1 implementation branch but is not modified by 06.

### 02 — Thermodynamics & Kinetics
Expose finite SI thermal/phase/kinetic state and explicit energy-ledger quantities for future invariant and benchmark adapters. PR #9 is a relevant Phase 1 thermal implementation branch but is not modified by 06.

### 03 — Chemistry Data & Validation
Provide/adapt the benchmark manifest/schema and later provenance-backed corpus into `BenchmarkManifestAdapter`; do not duplicate canonical threshold logic in data files.

### 04 — Laboratory Gameplay
Connect deterministic progression/save state to validation adapters when production progression is integrated. PR #8 is a relevant Phase 1 progression implementation branch but is not modified by 06.

### 07 — Integration & GitHub
Run repository-native dependency install, `npm run typecheck`, and `npm test` in a network-enabled/CI environment before merge. Add CI wiring separately according to the approved PR-fast/main/manual-nightly strategy; do not infer scientific PASS from tooling-unit PASS.

## Next Actions

1. Run PR #11 with repository-installed Vitest/typecheck through 07 or another network-enabled environment.
2. Add adapters to integrated 01/02/03/04 production interfaces without moving validation policy into those layers.
3. Add real benchmark loader/schema/provenance validation only when an approved corpus is available.
4. Preserve `PASS` / `FAIL` / `OPEN` discipline: missing data/capability remains OPEN, not inferred PASS.
