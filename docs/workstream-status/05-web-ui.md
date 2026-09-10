# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Phase 0 — Architecture / Runnable UI Scaffold
- Overall state: IMPLEMENTED_AWAITING_RUNTIME_VALIDATION
- Last updated: 2026-09-10
- Last checked main SHA: 197b83595d2b562fa68c0ce69d25d48d4c9311b7
- Active branch: feature/phase0-web-lab-scaffold
- Active PR: #4

## Current Objective
Continue the approved Phase 0 information architecture into a runnable React + TypeScript laboratory scaffold using a UI-facing provider boundary and deterministic mock provider, without embedding chemistry behavior in React components.

## Completed
### Frontend scaffold
- Added React + TypeScript + Vite entrypoint and browser `index.html`.
- Added `dev`, `build`, `typecheck`, `lint`, and `test` scripts.
- Added separate Vite and Vitest configuration.
- Added ESLint flat configuration.
- Added desktop-first responsive styling with tablet and mobile fallbacks.

### Laboratory workspace
Implemented the existing Phase 0 information architecture rather than redesigning it:
- persistent experiment/status bar,
- left InventoryPanel with SubstanceSearch, SubstanceList, MoleculeSelector behavior, amount control, and AddSubstance dispatch,
- center VesselWorkspace with semantic ReactionVesselView and MoleculeGraphView placeholder/adapter boundary,
- right EnvironmentPanel with Heat/Cool command intent, volume control, pressure gauge/readout, and simulation speed controls,
- secondary AnalysisWorkspace with CompositionTable, ReactionTimeline, ExperimentGraphs placeholder, ProductAnalysis boundary, and ExperimentLog summary.

### Mock species catalog
Added deterministic UI catalog entries for:
- H2
- O2
- N2
- H2O
- CO
- CO2
- CH4
- NH3

These entries are mock/UI-development data only and are not authoritative Chemistry Data records.

### UI-facing provider boundary
Added UI-facing types:
- `LaboratorySnapshot`
- `LaboratoryCommand`
- `LaboratoryEvent`
- `LaboratoryProviderValue`
- `MoleculeGraphViewModel`

Added `MockLaboratoryProvider` using a reducer-backed deterministic state flow.

Mock scope is intentionally limited to UI behavior:
- selected species and requested amount are handled by UI,
- AddSubstance updates mock vessel contents,
- Heat/Cool update control intent only and do not calculate temperature change,
- ChangeVolume updates mock apparatus/request state,
- Run/Pause/Reset update mock simulation lifecycle state,
- simulation speed updates mock UI/provider state,
- accepted commands append deterministic mock event records.

The mock provider does not calculate products, reaction feasibility, stoichiometry, rates, equilibrium, phase evolution, pressure consequences, or thermodynamics.

### 04 Laboratory Gameplay adaptation
The scaffold reflects the merged 04 contract by keeping commands serializable and provider-owned, separating simulation state from UI components, and treating ProductAnalysis as instrument/observation-gated rather than inferring named products from vessel graphics.

Pressure is read-only in this scaffold because the 04 contract makes direct pressure manipulation equipment/capability dependent. Volume is exposed through the command boundary.

### 01 dependency isolation
`MoleculeGraphViewModel` supports future atoms, bonds, bond order, formal charge, and optional reactive-site annotations without importing the unmerged PR #1 schema. The current MoleculeGraphView is a placeholder/simple renderer boundary until the production 01 contract merges.

### Responsive behavior
- Desktop: 3-zone Inventory / Vessel / Environment workspace plus analysis area.
- Tablet: 2-column primary layout with controls moved below the main vessel row.
- Mobile: vessel-first single column with compact persistent status/actions and stacked controls/analysis.

### Tests authored
Added component/provider tests covering:
- core workspace render,
- substance addition through the mock provider,
- run/pause/reset state flow,
- typed command dispatch boundary.

## In Progress
- Runtime verification in an environment with npm registry access.
- Production adapter implementation remains intentionally deferred until Game Layer / Simulation contracts are available and merged.

## Blockers / OPEN
- `npm install --no-audit --no-fund` could not complete in the current execution environment because external npm registry access timed out.
- Consequently the repository's real `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` could not be executed here with installed project dependencies.
- A temporary source-only TypeScript static check using local declaration stubs passed after fixing a `LaboratoryEvent.kind` discriminant widening issue. This is useful evidence but is not a substitute for the real project typecheck.
- A headless Chromium smoke harness was attempted, but external React CDN loading was unavailable in the current environment, so an actual React browser render is still OPEN.
- PR #4 head currently has no GitHub status checks or workflow runs, so CI does not supply missing runtime evidence yet.
- 01 Molecular Reaction Core PR #1 is not production source of truth until merge; the UI uses an adapter boundary only.
- 02 thermodynamics/kinetics observables are not yet integrated.
- 03 Chemistry Data PR #3 is not production source of truth until merge; catalog metadata remains mock-only.
- Instrument capability/observation result schemas, electrical controls, catalysts, experiment comparison/replay, and authoritative graph layout remain later integration items.

## Validation Evidence
### PASS
- Feature work is isolated on `feature/phase0-web-lab-scaffold`; no direct implementation changes were made on main.
- React components dispatch typed commands through `LaboratoryProviderValue`; chemistry outcome logic is not embedded in components.
- Mock provider state transitions are deterministic and limited to UI/development behavior.
- Source-only TypeScript static verification passed after the event discriminant fix.
- Existing Phase 0 information architecture and dependency direction `UI -> Game Layer -> Simulation Core` are preserved.

### FAIL
- None identified architecturally.
- Completion cannot yet be marked full runtime PASS because dependency installation, project test/build, and actual React browser rendering remain unverified in this execution environment.

### OPEN
- Real `npm install` / `npm run typecheck` / `npm test` / `npm run lint` / `npm run build` in a network-enabled development or CI environment.
- Browser smoke test and console-error check after successful build/dev-server startup.
- Production LaboratoryProvider adapter against merged 04/01 contracts.
- 01 MolecularGraph schema mapping after PR #1 merges.
- 03 authoritative species metadata mapping after PR #3 merges.
- 02-driven temperature/pressure/reaction-rate observables.
- Instrument observation schemas and analyzer-gated composition/product UI.

## Next Actions
1. Run install/typecheck/lint/tests/build in CI, Codespaces, or another environment with npm registry access.
2. Start Vite dev server and perform browser smoke/interactions: add H2/O2, change amount/volume, Heat/Cool, Run/Pause/Reset, speed selection, responsive widths, and console check.
3. After PR #1 merges, implement a small adapter from the authoritative MolecularGraph/species schema to `MoleculeGraphViewModel`; do not move graph chemistry into UI.
4. After 03 contract/data merge, replace mock catalog metadata with an adapter to authoritative data while retaining test fixtures.
5. When 04 production Game Layer APIs exist, replace `MockLaboratoryProvider` with a production provider/adapter behind the same component boundary.
6. Route integration/merge to 07 after runtime validation evidence is available.

## Handoffs
### To 01 — Chemistry Simulation Engine
When PR #1 is merged, provide stable mapping fields for species identity plus MolecularGraph atoms/bonds/bond order/formal charge and any explicitly observable reactive-site annotations.

### To 03 — Chemistry Data & Validation
After PR #3 merges, provide display-safe species names/formula/phase metadata and quality/provenance fields appropriate for inventory/encyclopedia presentation.

### To 04 — Laboratory Gameplay
The current UI command/provider boundary is ready for a production adapter once concrete Game Layer APIs exist. 05 will not duplicate command validation or chemistry outcomes.

### To 07 — Integration & GitHub
Do not merge PR #4 until network-enabled runtime validation confirms install, project typecheck, tests, production build, browser render, and obvious console/runtime error checks.
