# 06 — Simulation Validation Lab

- Owner: Chemistry Simulation Validation Engineer / Regression Test Developer / Scientific Model Auditor / Performance Validation Engineer
- Current phase: Phase 2D — Reaction Engine Validation Matrix
- Overall state: EXECUTABLE_MATRIX_IMPLEMENTED / PRODUCTION_REACTION_ENGINE_OPEN / REAL_BENCHMARK_CORPUS_OPEN
- Last updated: 2026-09-11
- Last checked main SHA: `a4606143e8f249e5b9a398f72c86c8171ca405b5`
- Active branch: `feature/phase2-reaction-validation`
- Active PR: #20

## Current Objective

Provide an independent executable validation matrix for the future Phase 2 reaction candidate/evaluation engine without implementing or tuning production chemistry.

## Source of Truth / Threshold Authority

- Production source of truth: latest `main`.
- Scientific acceptance authority: `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`.
- Existing validation primitives: `src/validation/` from merged Phase 1 harness.
- 03 data schema is merged, but no populated real-experiment `benchmarks/` corpus exists on main; no real-experiment score is claimed.

## Main-State Finding

Latest main contains Phase 1 molecular core, thermal primitives, gameplay progression, chemistry-data schema, validation harness, and UI integration. A production Phase 2 reaction candidate/evaluation engine is not present on main yet.

Therefore 06 does not recreate reaction generation, thermodynamics, or kinetics. `ReactionValidationAdapter` is the dependency-inversion boundary for future 01/02 outputs.

## Implemented Validation Matrix

### Conservation — absolute gates

- exact element inventory;
- exact atom count;
- exact net charge;
- exact explicit electron bookkeeping when represented.

Any violation is `FAIL` regardless of later scores.

### Structural validity

- over-valence flag;
- invalid bond;
- dangling atom;
- duplicate atom mapping;
- malformed product graph;
- invalid/non-finite numeric state.

### Candidate generation sanity

- candidate ID uniqueness;
- canonical-key deduplication;
- raw/deduplicated/pruned counter sanity;
- positive-control expected-candidate assertion;
- negative-control outcome handling;
- deterministic same-input candidate ordering and evaluation.

### Negative controls

Allowed outcomes are:

- no candidate -> `PASS` for the control;
- candidate definitely thermo/kinetic infeasible -> `PASS` for the control;
- insufficient thermo/kinetic information -> `OPEN`;
- a candidate remains explicitly feasible -> `FAIL`.

Missing information is never upgraded to PASS.

### Thermodynamics

- finite deltaH/deltaG checks;
- internal deltaG sign/direction sanity;
- reference-backed exothermic/endothermic sign;
- reference-backed major reaction direction;
- unavailable/open data -> `OPEN`.

A reference-backed reversed major reaction direction remains an absolute scientific failure under the canonical validation contract.

### Kinetics

- finite/non-negative kinetic values;
- positive-Ea temperature response direction;
- catalyst affects kinetic rate but must not alter equilibrium thermodynamics;
- relative effective-rate ordering helper;
- unknown barrier/status -> `OPEN`.

### Performance / candidate explosion observability

Recorded adapter counters:

- reactive sites;
- eligible pairs;
- raw candidates;
- deduplicated candidates;
- pruned candidates;
- runtime ms.

Engineering runtime/candidate budgets are deliberately separate from scientific acceptance thresholds. No scientific threshold was invented for performance.

## Executable Tests

Added `tests/reaction-validation.matrix.test.ts` covering:

- conservation PASS/FAIL for elements/atoms/charge/electrons;
- structural invalidity rejection;
- duplicate candidate rejection;
- invalid/NaN performance counters;
- positive and negative controls;
- negative-control OPEN behavior for missing evaluation data;
- thermo sign and deltaG-direction checks;
- missing thermo -> OPEN;
- positive-Ea temperature direction;
- catalyst equilibrium isolation;
- unknown kinetic barrier -> OPEN;
- relative rate ordering;
- deterministic candidate/order/evaluation replay;
- candidate/performance counter observation separated from scientific acceptance.

All numeric values in this test file are synthetic validation-tooling values, not experimental chemistry measurements.

## Reference Data / Metrics

03 reference data may later be adapted into the matrix for eligible cases with provenance. The existing benchmark harness already supports OPEN exclusion and median/P90/max/bias aggregation.

Current real-reference metrics:

- case count: `OPEN` — no populated corpus;
- qualitative accuracy: `OPEN`;
- median absolute relative error: `OPEN`;
- P90: `OPEN`;
- max error: `OPEN`;
- bias: `OPEN`.

No fabricated benchmark values were introduced to fill these fields.

## Performance Observations

Scientific production performance: `OPEN` because no production Phase 2 reaction engine is on main.

The executable harness proves only that candidate-performance counters and engineering budget classification can be represented and validated. Synthetic fixture runtime values are not interpreted as production benchmarks.

## Tests Executed / Not Executed

Executed:

- source/contract audit against latest main and `REAL_EXPERIMENT_VALIDATION.md`;
- main-state audit confirming no production Phase 2 reaction runtime is present;
- branch refresh onto latest main `a4606143e8f249e5b9a398f72c86c8171ca405b5` after main advanced during the task;
- static review of new validation interfaces/tests against merged Phase 1 validation primitives.

Blocked / not executed:

- repository `npm run typecheck` and Vitest execution in the local tool environment because `github.com` DNS resolution failed while cloning the public repository;
- production reaction-engine validation: OPEN because implementation is absent from main;
- real-experiment benchmark execution: OPEN because a populated eligible corpus is absent;
- candidate-explosion stress/performance matrix: OPEN until 01 exposes production candidate generation.

No runtime PASS is inferred from unexecuted tests.

## PASS / FAIL / OPEN

### PASS

- Phase 2D validation matrix architecture is implemented independently of production reaction logic.
- Conservation absolute gates, structural checks, candidate sanity, negative controls, thermo/kinetic OPEN discipline, determinism, rate ordering, and performance observability are represented executablely.
- Validation verdict and scientific-model status remain separate.
- `REAL_EXPERIMENT_VALIDATION.md` remains the threshold authority.
- No tuning and no fabricated experiment values were introduced.

### FAIL

- No production-scientific FAIL can be claimed because the Phase 2 reaction engine is not yet available for execution.
- No validation-infrastructure defect was confirmed by the available static audit.

### OPEN / BLOCKED

- repository-native typecheck/Vitest run: BLOCKED in this local execution environment;
- production candidate-generation scientific correctness: OPEN;
- production thermo/kinetics correctness: OPEN;
- real-reference quantitative metrics: OPEN;
- production candidate-explosion/runtime scaling: OPEN.

## Handoffs

### 01 — Chemistry Simulation Engine

Expose/adapt production reaction outputs into `ReactionValidationAdapter`, including:

- canonical candidate ID/key;
- reactant/product element and atom inventory;
- charge/electron bookkeeping;
- structural/product-graph sanity result;
- candidate generation diagnostics and counts;
- deterministic output ordering;
- production candidate runtime metrics.

Any conservation, graph/mapping, duplicate/order, or candidate-explosion defect routes to 01.

### 02 — Thermodynamics & Kinetics

Expose/adapt:

- deltaH / deltaG / direction / feasibility;
- scientific status and missing-data state;
- barrier availability and activation energy;
- controlled-temperature rates;
- catalyst-vs-uncatalyzed rates;
- effective relative rate/ranking diagnostics.

Thermo/kinetics/catalyst defects route to 02.

### 03 — Chemistry Data & Validation

Populate provenance-backed eligible reaction/no-reaction, thermochemistry, kinetics, and quantitative reference benchmarks. Missing or weak data must remain OPEN.

Data/provenance/eligibility defects route to 03.

### 04 — Laboratory Gameplay

No gameplay tuning or gameplay-dependent chemistry path was introduced. Future Game Layer integration must not change validation outcomes for identical Simulation inputs.

### 07 — Integration & GitHub

Run repository-native typecheck and full/targeted Vitest in a dependency-enabled environment before merge, then integrate the adapter/matrix without converting tooling PASS into scientific engine PASS.

## No Tuning

**No tuning performed.**
