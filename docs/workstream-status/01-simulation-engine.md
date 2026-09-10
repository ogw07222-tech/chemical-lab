# 01 — Chemistry Simulation Engine

- Owner: Lead Chemistry Simulation Engine Developer / Molecular Graph Systems Developer / Reaction Solver Architect / Stoichiometry Engine Developer
- Current phase: Phase 0 — Architecture / Contract Refresh
- Overall state: IN_PROGRESS
- Last updated: 2026-09-10
- Last checked main SHA: `1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1`
- Active branch: `feature/phase0-molecular-core-contract`
- Active PR: #1 — `docs: define Phase 0 molecular reaction core contract`
- PR #1 HEAD audited before this status commit: `a2d02051b1e9c4b65025a599c857514ecd2cf5b7`

## Current Objective
Refresh the existing Phase 0 molecular/reaction contract against the newer HQ canonical SI, phase/thermal, inventory-progression, and real-experiment-validation contracts without replacing the original PR #1 architecture.

## Completed
- Re-checked latest `main` SHA `1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1`.
- Read current `PROJECT.md`, `AGENTS.md`, `ROADMAP.md`, `UNIT_SYSTEM.md`, `DISCOVERY_INVENTORY_PROGRESSION.md`, `REAL_EXPERIMENT_VALIDATION.md`, `GAME_UI_SYSTEM_ROADMAP.md`, `SIMULATION_CONTRACT.md`, and this workstream status from latest main.
- Re-read PR #1 metadata, latest branch content, and diff before modification.
- Preserved the original Element / Atom / Bond / MolecularGraph / ReactionCandidate / conservation / graph-transformation / stoichiometry architecture.
- Corrected SI conflicts: atomic molar mass is now explicitly kg/mol and authoritative concentration is mol/m^3; temperature K, pressure Pa, volume m^3, energy J/J-per-mol, time s are explicit at relevant boundaries.
- Refined `SpeciesState` so vessel amount is finite mol and phase is an authoritative `PhaseStateRef`, not a player-selected gameplay property.
- Added phase-aware candidate-generation context for gas/liquid/aqueous/solid-surface/multiphase/electrode accessibility without moving thermodynamic/rate ownership from 02.
- Added solid/contact/interface extension hooks (`ContactInterfaceRef`, optional area/accessibility hints) without implementing a surface solver.
- Explicitly separated same-molecular-identity phase transitions from atom-rearrangement chemical `ReactionCandidate`s.
- Added `ReactionProgressEvent` carrying candidate ID, extent delta, stoichiometry, species amount deltas, phase references, timestep ID, and times for 02 thermal coupling.
- Made unlimited inventory a strict Game Layer concern: Simulation Core never stores infinite stock/amount and only receives finite vessel additions.
- Added validation observability for reaction/no-reaction, accepted candidate IDs, major products, species amounts, extent, phase, deterministic state IDs, timestamps, and phase-transition references.
- Updated `docs/contracts/SIMULATION_CONTRACT.md` to make the same SI/phase/thermal/validation boundaries canonical at the cross-workstream level.

## In Progress
- PR #1 review/integration after the HQ contract refresh.
- Cross-workstream refinement of exact 02/03 interfaces before TypeScript production implementation.

## Blockers / OPEN
- Final canonical molecular graph labeling/hash algorithm.
- Advanced aromatic/hypervalent/coordination valence treatment.
- Oxidation-state inference.
- Full proton/electron reservoir representation for electrochemistry.
- Exact 02 phase-resolution interface and ownership of phase-transition event production/state application.
- Exact dimensioned 02 rate-law contract; reaction-order-dependent rate constants must not remain bare unit-ambiguous numbers in production.
- Exact 02 thermal orchestration contract connecting `ReactionProgressEvent` to reaction enthalpy, vessel thermal state, latent heat, and resulting phase/temperature updates.
- 03 normalized phase/property schemas, SI fields, provenance, uncertainty, and reference-condition types.
- Solid accessible-fraction/contact-area calculation policy.
- Deterministic major-product classification criterion shared with 06.
- Final orchestrator ownership for ordering reaction progress, heat update, phase resolution, and next candidate-generation step.

## Validation Evidence
- Contract audit against latest main HQ documents listed above.
- `REAL_EXPERIMENT_VALIDATION.md` requirements mapped to explicit step observability fields.
- No runtime/unit tests run because this task changed documentation/contracts only and introduced no production code.
- Contract-level verdict after refresh: PASS for SI compatibility, phase-aware candidate interfaces, phase-transition separation, thermal handoff, finite-inventory boundary, and validation observability.
- Production implementation/scientific behavior remains OPEN pending 02/03 contracts and later 06 execution.

## Next Actions
1. 02 defines exact phase-resolution, rate-law dimensions, reaction-enthalpy/thermal, latent-heat, and phase-transition event contracts against the new 01 handoff.
2. 03 defines normalized SI property and phase-data records with provenance/reference conditions/uncertainty.
3. 06 reviews the proposed observability contract and fixes benchmark-facing required fields/major-product criterion before runtime implementation.
4. 07 reviews and integrates PR #1 when cross-workstream contract dependencies are acceptable.
5. After contract integration, implement the minimal TypeScript molecular core and deterministic diagnostics in a separate focused task.

## Handoffs
- 02 — consume `ReactionProgressEvent`, define exact dimensioned thermo/kinetics/phase/thermal contracts, and resolve authoritative `PhaseStateRef` semantics.
- 03 — provide SI-normalized element, molecular, thermochemical, phase-equilibrium, heat-capacity, and provenance/reference-condition data contracts.
- 06 — validate SI consistency, reaction/no-reaction and major-product observability, conservation, extent accounting, phase state, reaction-vs-phase-transition separation, determinism, and candidate budgets.
- 07 — keep PR #1 as the integration vehicle; no replacement PR was created.
