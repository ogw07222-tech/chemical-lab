# Real Experiment Validation Contract

## Status
APPROVED BY 00 - Chemistry Lab Game Design HQ

This document defines pre-committed acceptance criteria for comparing the simulation against real experimental reference data. The thresholds exist to prevent post-hoc tuning of success criteria after results are known.

## Validation Principle

Validation must compare like with like. A reference experiment is usable only when its initial conditions, materials, phases, apparatus-relevant assumptions, and measured outputs are sufficiently specified for a fair comparison.

The project does not require every supported reaction to match research-grade laboratory results. The goal is a browser-real-time educational sandbox that preserves chemistry correctly at the levels that matter most.

Priority order:

1. conservation laws
2. reaction direction / whether a reaction occurs under the tested conditions
3. major products
4. exothermic vs endothermic direction
5. phase/state behavior
6. relative kinetics and condition response
7. quantitative product ratios / equilibrium composition
8. detailed time curves and fine numerical precision

## Absolute Gates

The following are hard requirements for any benchmark classified as PASS.

- Element/atom conservation: exact within numerical floating-point tolerance.
- Net charge conservation: exact within numerical floating-point tolerance when charge bookkeeping applies.
- No negative species amounts beyond numerical tolerance.
- No impossible spontaneous creation or destruction of matter.
- Major reaction direction must not be reversed relative to the reference under matched conditions.
- Dominant product family must not be qualitatively wrong.

A violation of an absolute gate is FAIL regardless of other numerical scores.

## Accuracy Tiers

### Tier A — Core Qualitative Chemistry

Required for Phase 1-4 production readiness.

PASS requires, across the selected reference benchmark set:

- >= 95% correct reaction/no-reaction qualitative classification for well-specified HIGH-confidence cases.
- >= 95% correct dominant/major product identity for well-specified HIGH-confidence cases.
- 100% correct exothermic/endothermic sign for benchmarks where the reference sign is well established and modeled by the engine.
- 100% correct stable macroscopic phase classification for simple single-component reference points clearly away from phase boundaries, when phase modeling is supported.
- Correct qualitative response direction for >= 90% of tested condition perturbations, such as temperature increase causing the expected rate trend or pressure change shifting an applicable equilibrium in the expected direction.

A benchmark with insufficient source quality is OPEN rather than counted as a failure or success.

### Tier B — Core Quantitative Chemistry

Target for the first strong public release of each supported chemistry family.

For HIGH-confidence, well-controlled benchmarks, default PASS targets are:

- Final major-product amount or conversion: median absolute relative error <= 15%.
- Major product ratio/selectivity: median absolute error <= 15 percentage points, or relative error <= 20% when a relative metric is scientifically meaningful.
- Equilibrium composition: median relative error <= 15% for major species; no major species should exceed 30% relative error without an explicit APPROXIMATED/EMPIRICAL limitation note.
- Reaction enthalpy / net heat effect: relative error <= 15% where directly comparable calorimetric/reference values exist; exothermic/endothermic sign remains an absolute qualitative requirement.
- Final temperature change in a sufficiently specified thermal benchmark: absolute error <= 5 K or relative error <= 15%, whichever is more permissive, provided heat capacity, heat loss, and vessel assumptions are represented consistently.
- Final pressure for simple closed-gas benchmarks: relative error <= 10% when the relevant equation-of-state regime is supported.

These are family-level default targets, not promises that every reaction will satisfy the same uncertainty.

### Tier C — Kinetics / Time-Series Fidelity

This tier is more demanding and should not block early chemistry-family support unless the engine claims quantitative kinetic accuracy.

For benchmarks with sufficiently specified kinetics:

- Characteristic timescale (for example half-time, time-to-threshold, or fitted dominant timescale): within a factor of 2 for APPROXIMATED kinetics and within 25% for VERIFIED/EMPIRICAL calibrated kinetics.
- Time-series shape must preserve monotonicity, overshoot/relaxation behavior, and ordering of competing processes when those features are robust in the reference.
- Normalized time-series comparison should achieve a target NRMSE <= 20% for benchmarks explicitly claimed as quantitatively modeled.
- Relative rate ranking under controlled perturbations must be correct in >= 90% of benchmark comparisons.

If only qualitative kinetics are modeled, the result should remain APPROXIMATED and should not be judged against the tighter VERIFIED threshold.

### Tier D — Phase Equilibrium Fidelity

For substances with adequate phase-equilibrium data:

- Stable phase classification at benchmark T/P points away from phase boundaries: >= 98% accuracy.
- Normal boiling/melting transition temperatures at specified pressure: absolute error <= 5 K for VERIFIED/high-quality data-backed models; <= 15 K for APPROXIMATED models.
- Triple point / critical point: use source values directly when available; displayed/used values should match the normalized source within data/rounding tolerance.
- Generated phase-boundary curves should remain within 10% relative pressure error or 10 K temperature error over validated ranges for models advertised as quantitatively reliable.

Near phase boundaries, small source/model uncertainty can change the categorical phase. Such cases should use uncertainty bands and may be OPEN rather than FAIL when the reference uncertainty overlaps the prediction.

## Benchmark-Set Pass Rules

A subsystem or chemistry family is not declared production-validated from one successful reaction.

Minimum benchmark-set policy:

- At least 10 independent reference cases before claiming a family-level Tier A PASS, when enough trustworthy references exist.
- At least 5 quantitatively specified cases before claiming a family-level Tier B PASS.
- Include at least one negative/non-reaction case where scientifically meaningful.
- Include at least two distinct condition regimes where available.
- Avoid counting trivial repetitions of the same reaction under nearly identical conditions as independent evidence.

If insufficient trustworthy data exist, verdict is OPEN rather than PASS.

## Aggregate Metrics

06 should report distributions, not only averages.

For quantitative benchmark suites, report when applicable:

- count of cases
- median absolute relative error
- 90th-percentile absolute relative error
- maximum error with case identity
- bias / signed error
- qualitative classification accuracy
- number of OPEN cases excluded from numerical aggregation

A family-level Tier B PASS requires both:

- median target satisfied; and
- no more than 10% of HIGH-confidence cases exceed twice the stated default error threshold, unless the outliers have a documented model limitation already classified before the run.

## Reference Data Quality

03 must attach provenance and quality metadata to every benchmark.

Preferred evidence order:

1. authoritative reference databases / standards
2. peer-reviewed experimental literature
3. trusted handbooks or high-quality institutional teaching data
4. lower-confidence secondary sources only when clearly labeled

Reference cases must specify, where relevant:

- reactants/species identities
- initial amounts/concentrations
- temperature
- pressure
- volume
- phases
- solvent
- catalyst
- apparatus-relevant boundary assumptions
- measurement time / endpoint definition
- measured outputs
- uncertainty/error bars
- source citation

## Status Handling

Use:

- PASS — pre-committed acceptance criteria satisfied.
- FAIL — criteria violated with sufficient evidence.
- OPEN — data, model capability, or benchmark specification is insufficient for a fair verdict.

Scientific model labels remain separate:

- VERIFIED
- APPROXIMATED
- EMPIRICAL
- GAMEPLAY SIMPLIFICATION
- OPEN

A benchmark can PASS for an APPROXIMATED model if it satisfies the threshold assigned to that model class.

## No Moving the Goalposts

Threshold changes require a documented 00 HQ decision before re-running the benchmark suite for an official verdict.

06 must not loosen thresholds because a current implementation narrowly fails.

If a threshold is later found scientifically inappropriate for an entire metric/family, the change must include:

- rationale
- affected benchmarks
- old threshold
- new threshold
- whether prior verdicts are invalidated

## Early-MVP Minimum Release Gate

Before calling the chemistry MVP scientifically credible, require at minimum:

- all conservation absolute gates PASS;
- Tier A major reaction/no-reaction classification >= 95% on the approved HIGH-confidence MVP set;
- Tier A major-product identity >= 95%;
- exothermic/endothermic sign 100% on modeled benchmark cases;
- simple phase classification >= 98% away from boundaries for supported species;
- no unexplained catastrophic outlier in a HIGH-confidence Tier B benchmark;
- all known material limitations explicitly labeled rather than hidden.

## Ownership

- 03 — collects and normalizes real reference experiments and uncertainties.
- 06 — executes benchmark suites and reports PASS / FAIL / OPEN without tuning.
- 01 — fixes reaction-generation/conservation/product-graph problems.
- 02 — fixes thermodynamics, kinetics, phase, equilibrium, and thermal-coupling problems.
- 00 — approves threshold-policy changes and scientific scope claims.
- 07 — integrates validated changes and preserves regression coverage.
