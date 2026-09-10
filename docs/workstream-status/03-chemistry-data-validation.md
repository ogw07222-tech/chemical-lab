# 03 — Chemistry Data & Validation

- Owner: Chemistry Data Researcher / Chemical Property Data Engineer / Scientific Reference Analyst / Chemistry Model Validation Researcher
- Current phase: Phase 0 — Architecture
- Overall state: CONTRACT_DEFINED
- Last updated: 2026-09-10
- Last checked main SHA: 1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1
- Active branch: docs/phase0-chemistry-data-contract
- Active PR: #3
- PR HEAD checked before this status update: a4a0bf63e30bc082a2a051afaa46d72e8cb4b4f6

## Current Objective
Refresh the Phase 0 chemistry-data contract for approved SI normalization, phase-equilibrium/thermal data, and machine-loadable real-experiment benchmarks without beginning bulk numerical ingestion.

## Completed
- Re-read latest `PROJECT.md`, `AGENTS.md`, `ROADMAP.md`, `docs/contracts/UNIT_SYSTEM.md`, `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`, `docs/product/GAME_UI_SYSTEM_ROADMAP.md`, and this workstream status at main `1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1`.
- Re-audited PR #3 and reused its existing branch; no independent PR was created.
- Found the previous PR #3 runtime canonical units (`Da`, `pm`, `eV`, `kJ/mol`) were incompatible with the newly approved SI unit contract.
- Updated `src/data/schema.ts` so authoritative machine-consumed quantities use SI units and external source representations are stored separately as `SourceMeasurement { sourceValue, sourceUnit, ... }`.
- Distinguished standard atomic weight (dimensionless), per-particle atomic mass (kg), and molar mass (kg/mol) rather than conflating them.
- Expanded molecular thermal data for formation enthalpy/Gibbs/entropy, Cp, temperature-dependent Cp correlations, fusion enthalpy, and vaporization enthalpy.
- Added phase-equilibrium schema for melting/boiling points, triple/critical points, vapor pressure, valid T/P ranges, transition enthalpies, and phase-boundary representations.
- Added four explicit phase-boundary data forms: experimental samples, fitted correlation, trusted model reference, and approximation with assumptions/applicability metadata.
- Added `ChemistryDataQuery` / `ChemistryDataQueryResult` proposal so 02 can request thermochemistry, heat capacity, phase points/boundaries, vapor pressure, latent heat, bond energy, or atomic properties with T/P/phase/status constraints.
- Added `src/data/benchmark-schema.ts` defining machine-loadable Tier A/B/C/D reference experiment records for 06.
- Defined benchmark fields for species/amounts/concentrations, T/P/volume/phases, solvent/catalyst, apparatus boundaries, duration/endpoint, products, conversion/yield, equilibrium composition, thermal/pressure effects, kinetics, uncertainty/confidence/status, and source provenance.
- Added benchmark directory/manifest proposal and initial H/C/N/O acquisition priorities: simple phase points, phase-transition references, gas-state checks, combustion calorimetry/direction, simple equilibrium when feasible, known non-reaction cases, and later kinetic perturbation pairs.
- Updated `docs/data-sources/SOURCE_REGISTRY.md` so property and real-experiment source quality follows the approved evidence hierarchy and normalized values preserve original source units.
- Refreshed the PR #3 branch directly onto latest main `1a4e53ea...`, removing the previous 12-commit stale-base divergence.

## In Progress
- Final PR #3 contract review and integration handoff.
- Numerical property population and real benchmark acquisition remain intentionally unstarted.

## Blockers / OPEN
- 01 still needs to specify actual atomic-property consumers: electronegativity scale, radius requirements, and ionization/electron-affinity use.
- 02 must finalize exact phase/thermal query semantics, first supported T/P ranges, preferred vapor-pressure/phase-boundary model classes, Cp(T) requirements, and rules for extrapolation outside a record's validity domain.
- Exact initial species subset receiving validated phase-boundary curves is OPEN; H2O/CO2 and simple MVP gases are acquisition priorities, not yet approved populated datasets.
- Trusted source families for electronegativity/covalent radii/ionic radii/common oxidation states remain OPEN pending consumer semantics.
- pKa, electrode potential, solubility/Ksp, and reaction-specific kinetics source families remain OPEN until their chemistry families enter scope.
- 06 has not yet implemented the benchmark manifest/loader/runner, so no real-experiment benchmark PASS can be claimed.
- Benchmark quantitative cases requiring detailed vessel heat-loss, headspace, mixing, or endpoint semantics remain OPEN until 02/04 can represent those assumptions fairly.
- Full repository TypeScript typecheck remains OPEN in this chat environment: direct repository checkout through raw GitHub DNS was unavailable. Schema changes therefore require normal repository/CI typecheck before merge.

## Validation Evidence
- SI contract consistency: PASS at design level. Runtime normalized fields now follow `UNIT_SYSTEM.md`; source units are retained separately.
- Provenance semantics: PASS at design level. Source representation is not overwritten by normalization.
- Phase-equilibrium schema coverage: PASS for Phase 0 contract requirements, including incomplete real-world T-P data and fitted/model/approximation distinctions.
- Thermal-property schema coverage: PASS for the requested calorimetry/vessel-thermal inputs.
- Benchmark schema alignment with `REAL_EXPERIMENT_VALIDATION.md`: PASS at design level; Tier A/B/C/D and like-with-like metadata can be represented.
- Benchmark source-quality policy: PASS; guessed/tuned values are forbidden as experimental truth.
- Numerical MVP property dataset: OPEN by design.
- Real benchmark dataset/results: OPEN by design.
- Full TypeScript compilation: NOT RUN / OPEN; no compile PASS claimed.

## Next Actions
1. 02 should review `ChemistryDataQuery` and phase/thermal record semantics and specify required fields/ranges for its first evaluator.
2. 06 should adopt or refine `ReferenceExperimentBenchmark` + manifest loading and create schema/SI/provenance validation tests before benchmark acquisition scales up.
3. 03 should then collect the smallest trustworthy property/benchmark set required by those consumers, beginning with simple phase references and combustion thermochemistry/calorimetry.
4. 07 should run repository typecheck/CI and integrate PR #3 after normal review.

## Handoffs
- 02 Thermodynamics & Kinetics: review the proposed query/result boundary; define first supported phase/thermal domains, extrapolation policy, and which Cp/vapor-pressure/latent-heat records are mandatory.
- 06 Simulation Validation Lab: implement manifest-based benchmark loading, reject incompatible/non-SI fixtures, keep insufficient cases OPEN, and apply the pre-committed Tier A/B/C/D gates from `REAL_EXPERIMENT_VALIDATION.md`.
- 01 Chemistry Simulation Engine: confirm exact atomic/bond property consumers and accepted missing/status behavior.
- 00 Chemistry Game Design HQ: arbitrate any cross-workstream fallback/gameplay simplification or fidelity-vs-coverage policy conflict.
- 07 Integration & GitHub: run typecheck/CI and integrate PR #3; no main-direct changes were made by this workstream.
