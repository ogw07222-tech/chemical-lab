# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Phase 0 — Runnable PC-first UI scaffold
- Overall state: IMPLEMENTED_AWAITING_RUNTIME_VALIDATION
- Last updated: 2026-09-10
- Last checked main SHA: `1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1`
- Active branch: `feature/phase0-web-lab-scaffold`
- Active PR: #4 — `feat(ui): runnable Phase 0 laboratory scaffold`
- PR #4 implementation HEAD before this status-only update: `8d55b8ccd5ad6938a92e402261a955c428e2fe72`

## Current Objective
Refresh the existing PR #4 scaffold to match the canonical PC-first product/UI direction without redesigning the approved laboratory information architecture or embedding chemistry behavior in React.

## Canonical References Reviewed
- `PROJECT.md`
- `AGENTS.md`
- `ROADMAP.md`
- `docs/contracts/UNIT_SYSTEM.md`
- `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`
- `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`
- `docs/product/GAME_UI_SYSTEM_ROADMAP.md`
- this workstream status
- PR #5 `THERMODYNAMICS_PHASE_THERMAL` as a non-production reference only

## Branch Refresh
PR #4 was originally based on old main `197b83595d2b562fa68c0ce69d25d48d4c9311b7`.

The feature branch is now merged forward with canonical main `1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1` while preserving the existing UI scaffold. After refresh, comparison against main reported `behind_by: 0`.

## Responsive / Platform Status
### PC web — primary
- Canonical three-zone desktop workspace retained.
- Top bar: experiment identity, save/load placeholders, run/pause, speed, settings, explicit developer toggle.
- Left: unlocked inventory/search/favorites/finite amount input/add-to-vessel.
- Center: vessel visualization, T/P/V summary, selected molecule/unknown observation.
- Right: thermal and vessel controls plus future mixing/electrode/catalyst slots.
- Bottom: tabbed Composition / Products / Graphs / Phase / Timeline / Experiment Log.
- Layout remains intentionally information-dense around the ~1440x900 target class.

### Tablet — secondary
- Responsive two-column layout keeps Inventory + Vessel usable and moves Environment controls below without deleting functionality.

### Mobile — best effort
- Bottom navigation exposes Inventory / Lab / Controls / Analysis / Log.
- Vessel is the primary Lab view.
- Analysis and Log navigation drive the shared analysis workspace rather than creating a second simulation path.
- Core chemistry-facing state/provider interfaces remain shared with desktop/tablet.
- Save/load remain scaffold placeholders until 04/07 persistence wiring exists.

## Discovery / Inventory Status
- Normal mock inventory no longer exposes all MVP species.
- Mock starter set is deliberately limited to H2 / O2 / N2; exact production starter set remains an HQ/content OPEN decision.
- Undiscovered species names are not rendered as normal selectable inventory entries.
- Unlocked stock is explicitly shown as `Unlimited stock`.
- Every AddSubstance command still requires finite positive `amountMol`.
- Favorites are provider-owned and filterable in the Inventory UI.
- Developer Mode is explicitly separate and reveals all supported mock species for QA/development only.
- Mock unknown-observation flow is implemented:
  `Unknown substance detected -> Analyze -> identity confirmed -> discovery event -> encyclopedia record -> inventory unlock`.
- The seeded unknown/analyzer outcome is an explicitly deterministic UI fixture and is not a chemistry prediction.

## SI Boundary Status
Added centralized `src/ui/units.ts`.

Authoritative/provider-side physical state now uses canonical units for the implemented boundary:
- temperature: K
- pressure: Pa
- volume: m^3
- amount: mol
- heater/cooler power: W

UI display/input conversions are centralized for Celsius, litres, kPa, atm, and related formatting. React components do not scatter ad-hoc physical conversion constants.

## Thermal Control Status
Replaced the previous generic Heat/Cool intent UI with:
- heater requested power in W;
- cooler requested extraction power in W;
- thermostat enabled state;
- thermostat target entered in °C but dispatched as K.

No UI command directly overwrites authoritative temperature. The mock provider records thermal control requests only; it does not calculate temperature evolution, reaction heat, heat capacity, latent heat, or thermodynamic outcomes.

PR #5 is referenced only for loose interface alignment. Production 02 interfaces are not imported before merge.

## Phase / Vessel Visualization Status
- No manual solid/liquid/gas selector exists.
- Vessel content phase is read-only snapshot data.
- Vessel rendering switches semantic visual layers from authoritative phase labels: liquid fill, gas headspace, solid deposit, and multiphase combination.
- React does not determine phase from T/P.

### Phase Diagram
Added Phase tab and a renderer contract with:
- Temperature x-axis;
- Pressure y-axis;
- phase-region labels;
- boundary series;
- triple point;
- critical point;
- current T/P marker;
- scientific-status badge;
- unavailable state.

The mock diagram is explicitly labeled `UI-only illustrative fixture — not scientific phase data` in code and UI. The renderer only maps supplied data coordinates to SVG coordinates; it does not calculate thermodynamic boundary curves. Production data must come through a 02/03 adapter.

## Molecule / Encyclopedia Status
- 2D `MoleculeGraphViewModel` boundary remains isolated from unmerged/unstable lower-layer schema details.
- Encyclopedia minimum scaffold exposes species name/formula via selected species, 2D structure boundary, scientific status, first-discovery metadata, phase information, known-properties slot, and phase-diagram availability.
- Authoritative molecular geometry and property values remain integration dependencies.

## Tests Authored
Component/unit coverage now includes:
- PC laboratory zones and Phase tab render;
- starter-only normal inventory;
- Developer Mode all-species visibility;
- finite substance addition;
- heater power / thermostat interaction;
- unknown -> analysis -> discovery -> inventory unlock;
- run/pause/reset flow;
- SI conversion helpers;
- typed provider command boundary.

## Validation Performed
### PASS
- PR #4 branch refreshed onto latest checked main; `behind_by: 0` after refresh.
- Source review confirms no manual phase selector.
- Source review confirms no direct temperature setter/overwrite command.
- UI physical input boundary uses SI-valued provider commands for volume/temperature target/power.
- Normal inventory visibility is derived in a selector from provider-owned unlock state, not duplicated as chemistry/progression logic in components.
- Mock reactions/thermodynamic calculations were not introduced.
- Phase-diagram curves are supplied fixture data, not calculated by React.

### BLOCKED / OPEN
The current execution environment cannot resolve external GitHub/npm hosts from the local container. A fresh `git clone` failed with `Could not resolve host: github.com`; therefore network-backed package installation is unavailable here.

Do NOT treat the following as PASS in this task:
- `npm install`;
- real project `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run build`;
- Vite dev-server/browser smoke;
- console-error check;
- visual checks at desktop/tablet/mobile viewport sizes.

These require CI/Codespaces or another network-enabled environment before merge.

## OPEN
- Exact production starter material set.
- 04 production persistence/save/load APIs and analyzer/discovery event schemas.
- 02 merged thermal/phase/phase-diagram contract and actual runtime adapter.
- 03 authoritative names/properties/phase-boundary datasets and scientific-status metadata.
- 01 authoritative MolecularGraph mapping/layout.
- Exact apparatus semantics for pressure control and open/sealed/mixing controls.
- Browser-verified responsive polish and accessibility audit.

## Next Actions
1. Run install -> typecheck -> lint -> component tests -> production build in a network-enabled environment.
2. Browser smoke PR #4 at approximately 1440x900, tablet ~1024px, and narrow mobile widths; inspect console errors.
3. After PR #5/02 contract integration, replace the phase fixture with a thin production adapter while preserving unavailable/approximate states.
4. After 04 runtime APIs exist, replace mock discovery/persistence commands with authoritative Game Layer adapter behavior.
5. Hand PR #4 to 07 only after runtime validation evidence is available.

## Handoffs
### To 04 — Laboratory Gameplay
Provide production typed state/events/commands for starter entitlements, discovery confirmation, encyclopedia registration, inventory unlock, analyzer results, save/load, and apparatus capability rules. 05 will render/dispatch them and will not own progression authority.

### To 02 — Thermodynamics & Kinetics
After the thermal/phase contract is merged, provide stable SI thermal-control state and `PhaseDiagramData`/phase outputs. 05 needs supplied curves/points/status only; it will not derive phase or thermodynamic boundaries.

### To 07 — Integration & GitHub
PR #4 is refreshed to latest checked main and is structurally ready for validation. Do not merge until network-enabled typecheck/lint/tests/build and browser/console checks pass.
