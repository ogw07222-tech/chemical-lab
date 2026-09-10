# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Designer / Energy Model Architect
- Current phase: Phase 1 — Executable Foundation
- Overall state: IN_PROGRESS
- Last updated: 2026-09-11
- Last checked main SHA: 567994693e56a7013cbcce0d95222a6cb98594af
- Task-start main SHA: c33f5e0bb6d30db63c4097edce30c4333a14b0c5
- Active branch: feature/phase1-thermal-state-primitives
- Active PR: #9

## Current Objective
Implement a deterministic, browser-safe executable thermal foundation from the approved Phase 0 contract without introducing numerical thermochemistry databases, phase-diagram data, latent-heat solving, EOS logic, or detailed heat-transfer models.

## Implemented Primitives
- SI-facing aliases for K, J, W, J/K, J/mol, mol, and s.
- `ThermalState` with temperature, mixture/vessel sensible heat capacities, and cumulative energy ledger.
- `ThermalEnergyLedger` with explicit sign semantics for reaction heat, heater energy, cooler energy removed, thermostat exchange, environment exchange, latent-heat extension point, and other external exchange.
- `createThermalState` and runtime validation for finite values, `T > 0 K`, non-negative component heat capacities, and positive total sensible heat capacity.
- `integrateHeaterEnergy`: enabled heater power times timestep, positive energy into system.
- `integrateCoolerEnergyRemoved`: enabled cooler extraction power times timestep, positive ledger magnitude removed from system.
- `reactionHeatToSystem`: `Q_reaction = -deltaH * extent`, using a loosely coupled non-negative forward reaction extent input suitable for future 01 `ReactionProgressEvent` adaptation.
- `computeThermostatEnergyExchange`: bounded proportional controller skeleton that returns signed external energy and never directly mutates/overwrites temperature.
- `applySensibleEnergy`: converts signed sensible-energy change to temperature change using total sensible heat capacity.
- `stepThermalState`: deterministic per-timestep composition of reaction/heater/cooler/thermostat/environment/external energy into sensible temperature change and cumulative ledger updates.
- Public barrel exports under `src/simulation/thermal/index.ts`.

## Canonical Sign Semantics
- Heater energy: positive input to system; ledger field stores positive supplied magnitude.
- Cooler: system energy contribution is negative; ledger field stores positive removed magnitude.
- Exothermic forward reaction (`deltaH < 0`): positive `reactionHeat_J` into system.
- Endothermic forward reaction (`deltaH > 0`): negative `reactionHeat_J`, absorbing thermal energy.
- Thermostat: signed external exchange; positive supplies heat, negative removes heat.
- Environment/other external exchange: signed into system.
- Latent heat: reserved for later explicit allocation; not applied in this Phase 1 primitive.

## Tests Added
`tests/thermal.test.ts` covers:
- heater increases system energy and temperature;
- cooler decreases system energy and temperature;
- exothermic reaction adds thermal energy;
- endothermic reaction removes thermal energy;
- thermostat exchanges explicit bounded energy;
- thermostat does not teleport temperature to target;
- energy-ledger sign consistency;
- reaction-heat ledger accumulation;
- heater/cooler ledger accumulation;
- deterministic identical-input timestep integration;
- `T > 0 K` invariant and rejection of cooling through absolute zero;
- finite/positive total sensible heat capacity requirements;
- NaN rejection;
- Infinity rejection.

## Validation Performed
- Source-of-truth docs reviewed at task start: `PROJECT.md`, `AGENTS.md`, `ROADMAP.md`, `docs/contracts/UNIT_SYSTEM.md`, `docs/contracts/THERMODYNAMICS_PHASE_THERMAL.md`, `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`, and this workstream status.
- Runtime repository clone / `npm install` could not be performed in the execution sandbox because DNS resolution for github.com failed.
- Reconstructed the exact thermal primitive source in the local execution sandbox and ran TypeScript compilation with available global `tsc`: PASS.
- Ran a direct Node runtime harness against the compiled primitives covering heater, cooler, exothermic/endothermic reaction heat, thermostat bounded exchange, deterministic repeated integration, and rejection of 0 K / NaN / Infinity: PASS.
- Repository `npm test` / Vitest suite: OPEN, not executed locally because dependencies could not be fetched. The Vitest tests are committed for CI/integration execution.
- No scientific real-experiment benchmark PASS is claimed; this task validates executable semantics, not thermochemical fidelity.

## PASS / FAIL / OPEN
- Thermal primitive implementation against requested Phase 1 scope: PASS by code review + local TypeScript compile + runtime harness.
- Sign conventions / deterministic sensible-energy integration: PASS in local runtime harness.
- Repository Vitest execution: OPEN pending environment/CI with installed dependencies.
- Scientific thermochemistry accuracy: OPEN; no numerical reaction enthalpy data provider implemented.
- Full phase equilibrium / latent heat / EOS / vapor pressure / detailed heat transfer: OPEN and intentionally out of scope.
- Accurate thermostat tuning/control dynamics: OPEN; current controller is a bounded deterministic skeleton.
- Production readiness: OPEN pending 06/07 validation and integration.

## OPEN / Extension Points
- Latent heat allocation and phase coexistence coupling.
- Full phase equilibrium and phase-transition solver.
- EOS / pressure / partial-pressure ownership.
- Vapor-pressure correlations.
- Detailed environment/apparatus heat-transfer model.
- Temperature-dependent mixture Cp from 03 data.
- Apparatus/vessel heat-capacity source from 04/00 contract.
- Exact thermostat tuning and timestep-stability calibration.
- Final adapter to 01 `ReactionProgressEvent` once a production event/type exists.

## Handoffs
- 01: expose actual applied reaction extent per timestep; 02 can adapt it to `ReactionHeatInput` without coupling to candidate internals.
- 03: provide normalized SI phase-specific heat capacities and reaction/formation thermochemistry later; no hardcoded database was introduced here.
- 04: provide heater/cooler/thermostat command values and apparatus heat-capacity parameters through typed SI boundaries; do not set authoritative temperature directly.
- 06: run committed Vitest suite plus timestep/energy-accounting regressions; later validate real thermal benchmarks under `REAL_EXPERIMENT_VALIDATION.md`.
- 07: run repository typecheck/tests, inspect PR integration, and preserve deterministic thermal semantics.

## Repository Note
During setup, an empty placeholder was accidentally created on `main` and immediately removed in the next commit. Net repository content was restored before the feature branch was created. This advanced `main` history from the task-start `c33f5e0b...` to `56799469...` without an intended content change. All actual Phase 1 implementation work is on `feature/phase1-thermal-state-primitives`.
