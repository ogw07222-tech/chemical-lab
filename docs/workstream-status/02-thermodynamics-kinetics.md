# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Designer / Energy Model Architect
- Current phase: Phase 0 — Architecture
- Overall state: IN_PROGRESS
- Last updated: 2026-09-10
- Last checked main SHA: 1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1
- Active branch: feature/phase0-thermo-phase-thermal-contract
- Active PR: pending

## Current Objective
Define the cross-system Phase 0 contract for thermodynamic evaluation, phase equilibrium, phase-dependent kinetics, reaction heat, vessel thermal coupling, and heater/cooler/thermostat behavior under the canonical SI-unit and real-experiment-validation policies.

## Completed
- Re-checked latest production `main` at `1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1`.
- Reviewed `PROJECT.md`, `AGENTS.md`, `ROADMAP.md`, `docs/contracts/UNIT_SYSTEM.md`, `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`, `docs/product/GAME_UI_SYSTEM_ROADMAP.md`, `docs/contracts/SIMULATION_CONTRACT.md`, and this workstream status.
- Reviewed open PR #1 and PR #3 as parallel reference only; neither is treated as production source of truth.
- Added proposed contract `docs/contracts/THERMODYNAMICS_PHASE_THERMAL.md` on `feature/phase0-thermo-phase-thermal-contract`.
- Defined `ThermodynamicEvaluation` and reaction-enthalpy resolution hierarchy: trusted direct data -> phase-specific formation thermochemistry -> bond-energy approximation -> bounded fallback -> OPEN.
- Defined reaction-heat sign convention and coupling from actual applied reaction extent to thermal energy.
- Defined `PhaseEvaluation` from species identity + T + P + composition + phase property provider, including scientific status/confidence, triple point, critical point, coexistence, phase fractions, and fallback hierarchy.
- Defined UI-facing `PhaseDiagramData`; 05 renders supplied boundaries/current state and does not calculate chemistry/phase curves independently.
- Defined phase-dependent kinetic accessibility/transport corrections for gas partial pressures, liquid mixing, aqueous mobility, solid contact, and multiphase transfer without requiring a transport PDE solver.
- Defined `ThermalState`, explicit thermal-energy ledger, mixture/vessel heat capacity boundary, lumped environment heat transfer, and energy-balance timestep semantics.
- Defined Heater as positive power input, Cooler as power extraction, and Thermostat as a bounded external-energy controller rather than temperature overwrite.
- Defined latent-heat implementation tiers: MVP simplified, data-backed core, advanced multiphase/non-ideal model.
- Defined 03 data requirements, 01 reaction-extent/interface requirements, 05 phase-diagram boundary, and 06 validation observables.
- Preserved canonical SI units: K, Pa, m^3, J, J/mol, W, mol/m^3 and explicit heat-capacity units.
- Defined browser performance strategy using cached phase/property/model evaluations, active-reaction-only kinetics, adaptive timesteps, deterministic bounded work, and no per-frame full phase-diagram generation.

## Current Contract Decisions

### Thermodynamics
- Thermodynamics and kinetics remain separate.
- Reaction enthalpy uses `deltaH < 0` for exothermic forward reaction as written.
- Thermal energy contribution from a positive forward reaction extent is `Q_reaction = -deltaH * extent`.
- Missing/low-confidence thermochemistry downgrades scientific status; it is never silently fabricated.

### Phase Equilibrium
- Phase is simulation-owned, not manually selected by UI.
- Runtime may cache current phase, but phase must be re-evaluable from T/P/composition/property data.
- Initial bulk phases: SOLID / LIQUID / GAS / UNKNOWN.
- Resolution hierarchy: trusted phase-boundary data -> validated thermodynamic model -> pressure-aware melting/boiling threshold -> bounded approximation -> OPEN.
- Triple/critical points and coexistence are first-class interface concepts even if early MVP implementation is simplified.

### Thermal Model
- Temperature evolves through energy balance, not direct user overwrite.
- Heat sources/sinks are tracked separately: reaction, heater, cooler, thermostat, environment, latent heat.
- Quantitative temperature prediction requires nonzero defensible mixture/vessel heat capacity; missing Cp is not assumed to be zero.
- Thermostat energy remains observable/loggable and does not delete reaction heat.

### Phase-Dependent Kinetics
- Phase can gate accessibility and alter effective kinetics through deterministic bounded transport/accessibility corrections.
- Gas channels may use partial pressure/activity; solids may be contact/surface limited; liquid/aqueous channels may use mixing/mobility classes.
- Phase kinetic corrections never alter conservation or molecular graph identity.

## Validation Evidence
Design/contract audit only; no production numerical model was implemented in this task.

Contract was checked against the approved SI contract and pre-committed real-experiment validation criteria. The contract exposes observables required for future 06 validation, including:
- exothermic/endothermic sign;
- reaction enthalpy;
- temperature delta/time series;
- pressure from the authoritative vessel solver;
- stable phase/coexistence;
- transition temperature;
- equilibrium target/composition where modeled;
- characteristic kinetic timescale/rate response;
- explicit energy-flow ledger.

No scientific PASS is claimed without benchmark execution.

## Blockers / OPEN
- PR #1 ReactionCandidate schema and PR #3 Chemistry Data schema are still unmerged; exact TypeScript names/adapters must be aligned after integration.
- Exact authoritative pressure/EOS ownership and gas partial-pressure provider remain cross-system OPEN.
- Thermostat MVP vs Core Release timing remains OPEN in the approved UI roadmap.
- First-playable latent-heat tier remains OPEN.
- Initial species set with validated complete phase-diagram support remains OPEN.
- Mixture/aqueous phase semantics are deferred beyond pure/simple phase MVP.
- Exact phase kinetic multiplier ranges and calibration are OPEN pending 06.
- Apparatus/vessel heat-capacity ownership and source interface need 04/00 alignment.
- Environment heat-transfer coefficients are apparatus/empirical parameters and require a contract owner/source decision.
- Numerical tolerance/integration method for phase coexistence and latent heat requires implementation/06 validation.

## Next Actions
1. Have 00 review/approve the cross-system contract and arbitrate pressure/EOS, apparatus heat capacity, thermostat timing, and latent-heat MVP tier.
2. Reconcile exact 01 types after PR #1 integration; require actual applied reaction extent per timestep for heat coupling.
3. Reconcile exact 03 property types after PR #3 integration; prioritize phase-specific formation thermochemistry, Cp, melting/boiling/vapor-pressure, triple/critical points, and latent heats.
4. Hand the observables and phase/thermal fixtures to 06 for benchmark specification against `REAL_EXPERIMENT_VALIDATION.md`.
5. After approval/integration, implement only the minimal deterministic evaluator/thermal interfaces before calibration.

## Handoffs
- 00: approve cross-system ownership and OPEN fidelity choices.
- 01: expose candidate structural data and actual applied reaction extent; do not decide thermodynamic phase/rate.
- 03: supply normalized SI property records/provenance/uncertainty and phase/thermal data.
- 04: provide heater/cooler/thermostat/apparatus command and hardware parameters through typed SI interfaces.
- 05: consume `PhaseDiagramData` and thermal observables; no chemistry equations in UI.
- 06: validate phase, reaction heat, energy accounting, temperature response, kinetics, equilibrium, determinism, timestep stability, and SI consistency.
- 07: integrate only after contract review and required validation gates.

## Verdict
- Phase 0 contract completeness for requested scope: PASS.
- Scientific numerical validation: OPEN.
- Production implementation: OPEN.
- Production readiness: OPEN.
