# Phase 0 Scientific Validation / Test Architecture

Status: DESIGN COMPLETE / EXECUTABLE VALIDATION OPEN
Owner: 06 - Simulation Validation Lab
Source-of-truth main checked: 1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1
Canonical acceptance policy: `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`

## 1. Validation Architecture

Validation is separated into four concerns so structural correctness, scientific acceptance, numerical behavior, and runtime cost are not conflated.

1. **Absolute invariant gates** — conservation, non-negative state, matter accounting, and qualitative catastrophic-error gates. Any violation is FAIL.
2. **Reference benchmark gates** — Tier A/B/C/D comparisons against eligible real-experiment/reference fixtures.
3. **Cross-system regression gates** — deterministic replay, SI boundaries, discovery/inventory/progression, state-update ordering, phase/thermal coupling, and save/load behavior.
4. **Numerical/performance observation gates** — timestep sensitivity, equilibrium/network stability, candidate explosion, runtime scaling, and stress campaigns.

Validation code may inspect production Simulation/Data/Game interfaces but must never become production chemistry logic. Known/reference fixtures are one-way oracles: tests may call production code; `src/` must not import benchmark or known-chemistry fixtures to decide outcomes.

Proposed repository structure:

```text
tests/
  unit/
    conservation/
    molecular-graph/
    canonicalization/
    si-units/
    thermal-ledger/
    phase/
  reference/
    known-chemistry/
    negative/
  benchmark/
    loader/
    eligibility/
    tier-a/
    tier-b/
    tier-c/
    tier-d/
    aggregation/
  property/
    graph-generators/
    transformations/
    conservation/
  determinism/
  numerical/
    timestep/
    network-stability/
    equilibrium/
    phase-transition/
    state-ordering/
  progression/
  regression/
  performance/
    candidate-explosion/
    runtime-scaling/
  fixtures/
    species/
    vessels/
    reactions/
    networks/
    progression/
  helpers/
    seeds/
    assertions/
    tolerances/
    scientific-status/
    metrics/

benchmarks/
  chemistry/
    manifest.json
    phase/
    calorimetry/
    equilibrium/
    reaction-direction/
    non-reaction/
    kinetics/
```

### Test naming convention

Use:

`<layer>.<subject>.<behavior>.test.ts`

Examples:
- `conservation.atom-count.accepted-candidate.test.ts`
- `si.temperature.authoritative-kelvin.test.ts`
- `benchmark.loader.rejects-missing-provenance.test.ts`
- `benchmark.tier-a.reaction-classification.test.ts`
- `benchmark.tier-d.phase-boundary.test.ts`
- `thermal.ledger.exothermic-sign.test.ts`
- `progression.discovery.unlock-once.test.ts`
- `numerical.ordering.reaction-heat-phase-candidate.test.ts`
- `performance.candidates.reactive-site-scaling.test.ts`

Every scientific benchmark carries both a validation verdict (`PASS`, `FAIL`, `OPEN`) and a separate scientific-model status (`VERIFIED`, `APPROXIMATED`, `EMPIRICAL`, `GAMEPLAY SIMPLIFICATION`, `OPEN`).

## 2. Canonical Acceptance Policy

`docs/contracts/REAL_EXPERIMENT_VALIDATION.md` is the only canonical source for scientific acceptance thresholds. Workstream 06 must not loosen, reinterpret, or post-hoc tune those thresholds after observing results.

If this document and the canonical acceptance contract differ, the canonical acceptance contract wins. Threshold changes require a prior 00 HQ decision.

### Absolute gates — hard FAIL

For every benchmark or simulation state where the quantity applies:

- atom/element conservation violation;
- net charge conservation violation where charge bookkeeping applies;
- negative material amount beyond numeric tolerance;
- unexplained matter creation/destruction;
- major reaction direction reversed relative to a matched reference;
- dominant product family qualitatively wrong.

Any absolute-gate violation is FAIL regardless of aggregate scores.

## 3. Dimension-Aware Deterministic Floating-Point Policy

Floating-point tolerance is a numerical-representation allowance, not a chemistry tuning parameter.

Use a deterministic comparison policy parameterized by physical dimension and scale:

`allowedError = absTol[dimension] + relTol[dimension] * max(|reference|, |observed|, scaleFloor[dimension])`

Requirements:

- tolerance tables are centralized, versioned, deterministic, and shared by all tests;
- amount, charge, mass, energy, pressure, temperature, volume, and dimensionless fractions use separate tolerance entries;
- exact discrete invariants such as element identity/count in graph transformations remain integer-exact before conversion to continuous amounts;
- comparisons across sums use a scale based on total participating inventory, not an arbitrary constant;
- tolerance may not depend on whether a result would otherwise PASS or FAIL;
- tolerance changes require a reviewed contract change with old/new values and affected tests;
- authoritative SI units are applied before tolerance comparison;
- values below tolerance may be canonicalized to zero only at a documented numeric boundary, never silently inside chemistry heuristics.

Initial absolute/relative numeric values remain OPEN until 01/02 expose actual numeric representations and solver behavior. The policy shape is fixed now; numbers are not guessed.

## 4. Invariant Catalog

### C1 Element identity conservation — MUST PASS
Accepted transformations preserve the multiset of elements after stoichiometric participation is applied.

### C2 Atom-count conservation — MUST PASS
Per-element and total atom counts are exact for graph-level transformations. Continuous vessel amounts must preserve corresponding elemental inventory within the dimension-aware numeric policy.

### C3 Net charge conservation — MUST PASS
Total charge is conserved for isolated chemistry. Electrochemical transfer requires an explicit external/electrode charge reservoir.

### C4 Electron accounting consistency — MUST PASS when modeled
Explicit electron transfer balances oxidation/reduction and any external reservoir.

### G1-G5 Molecular graph sanity — MUST PASS
Reject invalid valence, impossible/unsupported bond order, unexpected disconnected fragments, malformed charge states, and non-deterministic/non-idempotent canonicalization.

### S1 Non-negative amount — MUST PASS
No authoritative species amount below zero beyond numeric tolerance.

### S2 Matter/energy bookkeeping — MUST PASS where modeled
No unexplained element/mass drift. Thermal energy terms must have explicit ledger provenance.

### S3 Finite state — MUST PASS
No NaN/Infinity in authoritative amount, temperature, pressure, volume, energy, rate, extent, phase fraction, equilibrium residual, or accepted candidate score.

### D1 Deterministic replay — MUST PASS
Identical initial state + model/data version + commands + command timing + dt sequence + seed yields identical canonical output.

### U1 SI authoritative state — MUST PASS
Authoritative runtime and benchmark normalized fields use canonical SI units.

### T1 Timestep consistency — THRESHOLD/REGRESSION GATE
Refining dt must approach a stable result and may not qualitatively flip chemistry solely due to integration granularity.

### N1 Network stability — MUST PASS
Long-running reaction networks cannot create negative amounts, unexplained matter drift, purely numerical oscillations, or silent solver divergence.

### R1 Regression preservation — MUST PASS
Previously validated fixtures stay valid unless a deliberate model/contract change is documented and reviewed.

## 5. Known Chemistry Fixture Plan

Initial structural/reference species:

- H2
- O2
- N2
- H2O
- CO
- CO2
- CH4
- NH3

Known chemistry remains reference-only. Fixtures encode input conditions, eligibility/provenance, expected qualitative/quantitative observables, and tolerance source; they are not a reaction lookup table.

Initial examples include hydrogen oxidation under activation-capable conditions, methane combustion with sufficient oxygen, oxygen-limited carbon oxidation trends, ambient N2/O2 non-reaction, and ordinary water without electrochemical input.

CO canonical graph/formal-charge representation remains OPEN until 01/03 settle the supported representation.

## 6. Negative Test Plan

Negative tests distinguish three different outcomes:

1. no candidate should be generated;
2. a structural candidate may be generated but must be rejected/pruned;
3. a conserved and thermodynamically possible path may remain kinetically negligible.

This prevents candidate generation from improperly encoding thermodynamic or kinetic decisions.

Initial classes:

- N2 + O2 under ambient conditions without a supported activation mechanism;
- H2O-only vessel under ordinary conditions without electrochemical input;
- stable self-combinations with no supported pathway;
- unsupported element/electronic state input;
- conservation-violating transformations;
- graph-invalid but conserved transformations;
- duplicate/isomorphic candidate generation;
- hidden progression or Premium state accidentally modifying chemistry.

## 7. Randomized / Property-Based Plan

Use reproducible bounded generators over supported chemistry.

Generator layers:

- valid bounded H/C/N/O molecular graphs;
- deliberately invalid graphs;
- stoichiometric reactant multisets;
- bounded graph transformations;
- SI-valid vessel states;
- small branching reaction networks;
- progression/save states.

Core properties:

- every accepted transformation preserves C1-C4;
- accepted products satisfy graph sanity;
- invalid graphs cannot enter authoritative vessel state;
- canonicalization is deterministic, idempotent, and atom-order invariant;
- candidate deduplication is input-order invariant;
- state updates preserve S1-S3;
- same generated case + same seed replays identically;
- SI-valid inputs remain dimensionally valid through serialization/replay.

Failures must print the reproducible seed and minimized/canonical failing input where possible.

## 8. Deterministic Seed Policy

- no implicit global randomness in deterministic simulation paths;
- no `Math.random()` in deterministic chemistry/state-transition code;
- seed object includes algorithm/version;
- test seed printed on failure;
- regression fixtures use fixed named seeds;
- randomized CI runs use a recorded run seed;
- replay metadata includes seed, initial state, ordered commands, dt sequence, model/data version;
- RNG algorithm/version changes are compatibility changes.

Fixed smoke seeds may continue to use the prior PR #2 values; they have no scientific meaning.

## 9. Benchmark Loader Architecture

The loader is designed to consume the manifest/schema proposed by PR #3 without treating that unmerged PR as production truth.

Expected filesystem:

```text
benchmarks/chemistry/manifest.json
benchmarks/chemistry/phase/
benchmarks/chemistry/calorimetry/
benchmarks/chemistry/equilibrium/
benchmarks/chemistry/reaction-direction/
benchmarks/chemistry/non-reaction/
benchmarks/chemistry/kinetics/
```

Proposed pipeline:

`manifest discovery -> schema validation -> SI validation -> provenance validation -> eligibility evaluation -> benchmark execution -> per-case verdict -> metric aggregation -> family/tier verdict`

### Loader responsibilities

**Schema validation**
- schema version supported;
- unique benchmark IDs;
- manifest/file family and tier agree;
- required fields exist for the selected family/metric;
- references resolve and no duplicate enabled IDs exist.

**SI validation**
- normalized authoritative fields use canonical SI semantics;
- temperature > 0 K;
- pressure >= 0 Pa;
- volume >= 0 m^3;
- amount >= 0 mol;
- concentration, energy, time, and thermal quantities obey the canonical contract;
- no authoritative runtime fixture stores Celsius, L/mL, atm/bar/kPa, mol/L, kJ, or kJ/mol as if canonical;
- source-reported non-SI values may exist only in provenance/source-measurement metadata with explicit conversion to normalized SI.

**Provenance validation**
- source IDs/citations present where scientific claims require them;
- data quality, confidence, scientific status, reference conditions, and uncertainty are carried where applicable;
- missing provenance cannot be silently upgraded to HIGH confidence.

**Eligibility validation**
- initial conditions are sufficiently specified for like-with-like comparison;
- required model capability exists;
- source quality is sufficient for the intended official metric;
- model/status-specific threshold is resolvable;
- near-boundary or uncertainty-overlap rules are applied before aggregation.

Ineligible/underspecified cases are `OPEN` and excluded from pass-rate denominators unless the canonical contract says otherwise.

## 10. Tier A — Core Qualitative Chemistry

Use `REAL_EXPERIMENT_VALIDATION.md` exactly.

Canonical Tier A gates currently require:

- reaction/no-reaction classification >= 95% for eligible HIGH-confidence cases;
- dominant/major product identity >= 95%;
- exothermic/endothermic sign = 100% for modeled eligible cases;
- stable macroscopic phase classification = 100% for simple single-component points clearly away from phase boundaries when phase modeling is supported;
- qualitative condition-response direction >= 90%.

Important distinction: the canonical **Tier D** away-from-boundary phase aggregate target is >= 98%. Workstream 06 must not replace Tier A's current 100% requirement with 98% without a prior 00 contract change.

Family-level Tier A PASS additionally obeys the canonical minimum-set rules, including at least 10 independent reference cases when trustworthy references exist, meaningful negative coverage, and distinct condition regimes.

## 11. Tier B — Core Quantitative Chemistry

Per eligible benchmark, compute applicable errors for:

- final major-product amount or conversion;
- selectivity / major-product ratio;
- equilibrium composition;
- reaction enthalpy / net heat effect;
- final temperature delta;
- final gas pressure.

Aggregate output must include when applicable:

- case count;
- median error;
- P90 error;
- maximum error with benchmark ID;
- signed bias / signed error;
- number of OPEN cases excluded;
- qualitative absolute-gate outcomes.

Thresholds are not redefined here. Use the canonical Tier B values in `REAL_EXPERIMENT_VALIDATION.md`, including its family-level outlier rule.

Metric implementations must define denominator/zero handling explicitly. Relative error is not used when the scientifically meaningful reference is zero or near-zero; an appropriate absolute/domain metric must be selected by the benchmark contract before execution.

## 12. Tier C — Kinetics / Time-Series

Supported metrics:

- characteristic timescale ratio;
- characteristic-timescale relative error where appropriate;
- controlled-condition rate ranking;
- normalized time-series RMSE (NRMSE);
- monotonicity/order behavior;
- robust overshoot/relaxation/order features where reference data establishes them.

Canonical model-class handling:

- `APPROXIMATED` kinetics: characteristic timescale within factor 2;
- `VERIFIED` / calibrated `EMPIRICAL`: characteristic timescale within 25%;
- quantitatively claimed time series: NRMSE <= 20%;
- relative rate ranking: >= 90%.

Qualitative-only kinetics remain `APPROXIMATED` and must not be judged against tighter VERIFIED/calibrated thresholds.

## 13. Tier D — Phase Equilibrium

Validate:

- stable phase classification;
- melting/boiling transition temperature at specified pressure;
- triple point;
- critical point;
- generated phase-boundary deviation;
- near-boundary uncertainty handling.

Canonical acceptance currently includes:

- away-from-boundary stable phase classification >= 98%;
- melting/boiling transition absolute error <= 5 K for VERIFIED/high-quality models and <= 15 K for APPROXIMATED models;
- triple/critical point values match normalized source within data/rounding tolerance when source values are used directly;
- quantitative phase-boundary curves remain within 10% relative pressure error or 10 K temperature error over validated ranges.

Near a phase boundary, compare the reference uncertainty region/model uncertainty band with the predicted boundary/phase region. If they overlap such that categorical identity is not resolvable, verdict may be `OPEN`; do not force FAIL merely because an infinitesimal side-of-boundary classification differs.

A definite non-overlapping wrong phase with adequate data is FAIL.

## 14. SI Validation Contract

Authoritative benchmark fixtures, runtime Simulation state, persistence/replay state, and cross-workstream validation interfaces use SI.

Minimum assertions:

- temperature > 0 K;
- pressure >= 0 Pa;
- volume >= 0 m^3;
- amount >= 0 mol;
- authoritative concentration uses mol/m^3;
- authoritative energy uses J / J/mol as dimensionally appropriate;
- time uses s;
- power uses W;
- electrical potential/current use V/A;
- UI display conversions are tested separately and cannot mutate authoritative state.

Round-trip adapter tests should cover Celsius/Kelvin, L/mL to m^3, kPa/bar/atm to Pa, mol/L to mol/m^3, and kJ to J without letting display units leak into authoritative APIs.

## 15. Thermal Energy Validation

The thermal test structure is pre-committed for future 02 implementation. Missing functionality is `OPEN`, not PASS.

Required directional/accounting tests when supported:

- exothermic forward reaction produces positive thermal energy into the system under the canonical sign convention;
- endothermic forward reaction consumes available thermal/sensible energy;
- heater supplies positive energy over positive dt;
- cooler removes energy over positive dt;
- thermostat records explicit signed external energy exchange;
- no direct temperature teleport through heater/cooler/thermostat command semantics;
- reaction, heater, cooler, thermostat, environment, and latent-heat ledger signs are internally consistent;
- reaction heat is derived from actual applied reaction extent, not merely candidate existence;
- latent heat cannot appear/disappear without an explicit phase-change energy ledger entry;
- energy bookkeeping is deterministic under replay.

Scientific validation of resulting temperature curves requires eligible calorimetry/thermal benchmarks; structural ledger correctness alone does not certify quantitative thermal accuracy.

## 16. Phase / Reaction Coupling Validation

When 01/02 expose the interfaces, construct paired tests with identical species inventories and controlled conditions except for phase/context.

Measure:

- candidate accessibility changes;
- effective kinetic accessibility/transport changes;
- rate ranking or characteristic timescale changes;
- whether reaction families requiring a particular phase become active/inactive appropriately.

Scientific PASS requires an experimental/authoritative reference or a directly derived contract-level invariant. Coarse multipliers or heuristic expectations without evidence are regression/metamorphic checks only and remain `APPROXIMATED`/`OPEN` scientifically.

Phase-dependent corrections must not alter atom/charge conservation or silently rewrite reaction state-function thermodynamics.

## 17. Gameplay Progression Cross-System Validation

06 owns minimum cross-system regression checks without taking ownership of gameplay design.

Required tests once 04 implementation exists:

- hidden generated species does not unlock before valid confirmation;
- first valid confirmation unlocks exactly once;
- encyclopedia registration and inventory unlock remain synchronized;
- undiscovered non-starter species is not normally selectable;
- unlocked species is selectable for arbitrarily many later experiments because stock is unlimited by gameplay contract;
- each actual add-to-vessel command carries a finite explicit SI amount;
- Developer Mode bypasses discovery/access restrictions but does not alter chemistry results for otherwise identical simulation inputs;
- Premium entitlement does not alter chemistry, discovery eligibility, or unlocked-stock semantics;
- save/load preserves discovery, encyclopedia, and inventory-unlock state deterministically.

Defects in these behaviors route to 04 unless the chemistry/state contract itself is responsible.

## 18. State Transition Ordering Regression Target

Pre-commit the simulation-ordering validation target before 01/02 implementation:

`reaction progression -> heat/energy update -> phase reevaluation -> next reaction candidate generation`

The exact integrator may substep or iterate, but externally equivalent simulations must not become qualitatively dependent on arbitrary ordering artifacts.

Future ordering tests compare equal physical duration under dt, dt/2, and dt/4 and record:

- reaction extents;
- thermal ledger;
- temperature trajectory;
- phase trajectory/coexistence state;
- next-step candidate identities/count;
- final species amounts and dominant products.

A qualitative flip caused solely by update ordering/timestep is FAIL unless the scenario lies within a documented physical/uncertainty boundary where verdict is OPEN.

## 19. Numerical Stability

Retain and extend the prior PR #2 strategy.

Required targets:

- timestep sensitivity;
- deterministic seed/replay;
- candidate explosion;
- no negative amounts;
- no NaN/Infinity;
- no purely numerical oscillatory artifacts;
- equilibrium convergence or explicit non-convergence status;
- phase-transition stability/coexistence handling;
- no mass/charge drift;
- stable state-transition ordering.

For a chosen scenario, compare equal simulated duration at dt, dt/2, dt/4. Quantitative convergence tolerances remain OPEN until solver contracts/empirical convergence data justify them; absolute gates remain active at every dt.

## 20. Performance / Candidate Explosion Plan

Benchmark independent variables:

- species count N;
- total reactive-site count R;
- enabled reaction-family count F;
- candidate count before/after pruning C;
- accepted candidate count A.

Record:

- candidate generation wall time;
- candidate count before/after pruning;
- peak candidate set size;
- simulation-step runtime;
- memory proxy where practical;
- environment/runtime metadata.

Initial structural grid may retain N = 2,4,8,16,32 and R buckets = 4,8,16,32,64,128.

Performance correctness remains separate from scientific correctness.

- non-termination/OOM or explicit safety-cap violation: FAIL;
- >25% same-environment regression in median runtime or candidate count without approved reason: regression FAIL/investigation gate from the prior architecture;
- absolute browser budget: OPEN until representative production workloads/hardware are measured.

## 21. Regression Structure

Every validated capability or fixed defect adds the smallest stable reproducer.

Regression metadata includes:

- ID and originating issue/PR;
- model/data/schema versions;
- benchmark/reference IDs where applicable;
- validation verdict and scientific status;
- expected invariants/observables;
- threshold/tolerance source;
- seed;
- owning workstream.

Snapshots/baselines must not be blindly regenerated after a failure.

## 22. CI Test Tiers — Actions-Conscious

### PR fast tier — blocking, deterministic, high signal

- schema/contract validation;
- typecheck where configured;
- deterministic core unit tests;
- conservation/graph/SI unit tests;
- small known/negative benchmark smoke;
- small fixed-seed property sample;
- progression contract smoke when implemented;
- regression smoke.

Avoid full benchmark matrices and large randomized campaigns on every PR.

### Main tier — standard regression/reference

- PR fast tier;
- standard regression corpus;
- selected eligible reference benchmarks across Tier A and representative Tier B/D cases;
- small timestep/network/phase-transition stability set;
- candidate-explosion smoke.

### Manual/nightly tier — expensive

- large randomized/property campaigns;
- full approved benchmark suite;
- full Tier B/C/D aggregation;
- performance/candidate stress grid;
- many-seed determinism campaign;
- timestep matrix;
- long-horizon network/equilibrium/phase-transition stability;
- sensitivity analysis.

Manual/nightly failures create investigation items and cannot be hidden through baseline regeneration.

## 23. Current Gaps

OPEN/BLOCKED:

- PR #1 molecular/reaction-core interfaces remain unmerged parallel contracts;
- PR #3 benchmark/data schema and provenance interfaces remain unmerged parallel contracts;
- PR #5 thermo/phase/thermal interfaces remain unmerged parallel contracts;
- no executable benchmark loader exists yet;
- no populated approved benchmark corpus exists yet;
- no production 01/02 chemistry implementation exists to execute scientific acceptance suites against;
- exact centralized dimension-aware numeric tolerance values remain OPEN;
- exact canonical major-product selection criterion remains OPEN;
- exact equilibrium convergence thresholds remain OPEN;
- absolute candidate/browser runtime budget remains OPEN;
- property-testing library selection remains OPEN;
- CI workflow implementation remains OPEN.

## 24. Dependencies / Handoffs

### 01 — Chemistry Simulation Engine
Expose stable graph/conservation/candidate/product/deduplication/seed/pruning diagnostics, finite SI amounts, reaction progress/extent, phase-aware candidate accessibility, and deterministic major-product observability. Final ordering contract must be compatible with reaction -> thermal -> phase -> next-candidate validation.

### 02 — Thermodynamics & Kinetics
Expose deterministic thermo/kinetic/phase interfaces, SI quantities, reaction enthalpy sign/value, applied heat ledger, heater/cooler/thermostat exchange, phase/coexistence/near-boundary state, phase-dependent kinetic diagnostics, timestep/integration semantics, and equilibrium convergence diagnostics.

### 03 — Chemistry Data & Validation
Provide the benchmark manifest/schema, provenance-backed SI-normalized reference experiments, source measurements, confidence/data-quality/status metadata, uncertainties, reference conditions, phase boundaries, calorimetry/equilibrium/kinetics data, and explicit exclusion/eligibility information.

### 04 — Laboratory Gameplay
Expose deterministic discovery/confirmation -> encyclopedia -> inventory state transitions, unlimited unlocked-stock semantics with finite vessel additions, Developer Mode/Premium boundaries, and save/load progression state. Chemistry outcomes must remain independent of progression entitlements.

### 05 — Web UI
Keep display units and visual phase/thermal rendering outside authoritative validation state; UI preferences must not alter chemistry.

### 07 — Integration & GitHub
Implement/maintain CI wiring and integrate only after relevant 06 gates have evidence.

06 does not tune production chemistry, kinetics, phase multipliers, progression, or UI behavior while validating defects.

## 25. Phase 0 Verdict

### PASS

- validation architecture remains compatible with latest canonical main contracts;
- `REAL_EXPERIMENT_VALIDATION.md` is now explicitly the canonical threshold authority;
- absolute gates, Tier A/B/C/D metric architecture, SI/provenance/eligibility loader stages, thermal/phase/progression regressions, ordering targets, and Actions-conscious CI tiers are defined;
- prior conservation, property, deterministic, timestep, candidate-explosion, and regression architecture is preserved.

### FAIL

- none identified at contract/design level on main `1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1`.

### OPEN

- scientific execution verdicts remain OPEN because the relevant 01/02 implementation and approved benchmark corpus are not yet available in production main;
- PR #1/#3/#5 interfaces are useful references but are not treated as production truth while unmerged;
- numeric tolerance values, exact solver convergence limits, and absolute browser performance budgets remain OPEN rather than guessed.
