# 05 — Web UI

- Owner: Lead UI Architect / Frontend Workstream Coordinator / UI Contract Owner / Final UI Signoff Owner
- Current phase: Post-Phase-3A UI rebaseline + 05A/05B/05C/05D workstream split
- Overall state: PASS — production UI rebaselined; sub-workstreams ready for parallel execution
- Last updated: 2026-09-12
- Production source of truth: `main` @ `e49b3f25eeb39d08a6c397c4869beceb6c5c8bbf`
- Workbench design authority: PR #44 clean Workbench, now integrated
- Phase 3A reaction activity UI: production integrated via PR #47; old stacked PR #46 dependency is CLOSED
- Phase 3B external dependencies: PR #51 (02 equilibrium foundation/progression) + stacked PR #52 (01 reversible-pair arbitration); neither is production yet

## Role change
05 no longer acts as the single implementation owner for most frontend features.

05 now owns:
- current UI architecture audit;
- frontend ownership boundaries;
- shared interface decisions;
- cross-workstream task assignment;
- PR dependency/order management;
- duplicate implementation/conflict prevention;
- final UI architecture and integration signoff.

Implementation ownership is split into:
- **05A — Workbench & Layout**
- **05B — Apparatus UI**
- **05C — Chemistry Visualization**
- **05D — UI Integration & Accessibility**

05 may still make small coordination/documentation/interface changes, but large feature implementation should be delegated to the owning sub-workstream.

## Current production UI audit
Production `src/ui/` is still mostly monolithic and predates the new ownership split.

Current files on main:
- `src/ui/App.tsx` — ~20.9 KB; currently owns top bar, catalog, structural preview, central workbench, primary vessel, analysis drawer/timeline, reaction activity strip, inspector/notes, conditions, global operations, disposal, mobile navigation and top-level composition.
- `src/ui/provider.tsx` — ~15.3 KB; mock provider/state, catalog fixture, Phase 3A reaction projection fixture/wiring, commands and discovery fixture behavior.
- `src/ui/reactionProjection.ts` — Phase 3A provider -> player-safe reaction projection adapter.
- `src/ui/types.ts` — shared UI/provider DTOs and commands.
- `src/ui/selectors.ts` — inventory/selection helpers.
- `src/ui/units.ts` — typed unit conversion/display helpers.
- `src/ui/styles.css` — ~14.7 KB global Workbench styling and responsive rules.
- `src/ui/main.tsx` — React entrypoint.

Current Workbench behavior on main:
- clean, mostly empty central workspace with primary vessel;
- collapsible material catalog;
- structural-notation molecule previews;
- persistent substance inspector + free-form notes;
- compact reaction activity strip;
- Phase 3A reaction Timeline projection;
- Developer Mode diagnostics separated from normal identity projection;
- collapsible experiment-conditions panel with T/P/V summary;
- global Mix / Stir / Pause / Reset / Disposal controls;
- responsive desktop/tablet/mobile shell.

Current UI tests remain concentrated in `tests/ui/LaboratoryWorkspace.test.tsx` (21 tests) and cover layout, provider interaction, discovery/privacy, Phase 3A projection, collapse behavior and scientific-display honesty. This is valid production coverage but is now a conflict hotspot for future parallel work.

## Stale status resolved
The previous status document still described Phase 3A UI as a stacked implementation dependent on PR #46. That is no longer current.

Current production truth:
- Phase 3A multi-step reaction network + UI projection is integrated on main.
- PR #47 is merged.
- PR #46 is no longer an active UI dependency.
- Phase 3B work remains external to production through open PRs #51/#52.

Historical Phase 3A validation is retained below for auditability.

## Target file ownership model
The target ownership model applies **progressively to new work**; do not mass-move existing files merely to satisfy directory aesthetics.

### 05A — Workbench & Layout
Preferred future ownership:
- `src/ui/workbench/`
- `src/ui/layout/`

Owns:
- global Workbench composition/layout;
- center workspace / placement surface;
- left/right panel containers;
- catalog container shell;
- inspector container shell;
- apparatus placement slots/coordinates;
- selection/focus frame;
- z-order and placement interaction shell;
- panel collapse/expand;
- tablet/mobile drawer/navigation shell;
- responsive layout geometry.

Does **not** own apparatus-specific controls, chemistry visualization semantics or provider physics.

Immediate contract for apparatus work:
- expose a stable placement surface owned by 05A;
- apparatus instances are rendered through a typed child/interface supplied by 05B rather than hardcoded into `App.tsx`;
- layout state may include selected apparatus id, placement slot/position and visual z/focus state only;
- no apparatus physics or chemistry state is computed in the layout layer.

### 05B — Apparatus UI
Preferred future ownership:
- `src/ui/apparatus/`

Highest-priority implementation workstream.

Owns:
- apparatus catalog;
- simple apparatus geometry/visuals;
- apparatus instance UI;
- Device Inspector;
- Hot Plate;
- Heating Bath;
- Hot-Air Chamber;
- Cooling Bath;
- Magnetic Stirrer;
- Filter;
- Gas Collector;
- Condenser;
- Vacuum Pump;
- Power Supply / Electrode Controller;
- apparatus/sensor UI shells.

Device controls may include:
- ON/OFF;
- temperature setpoint;
- power/output mode;
- RPM;
- pressure target;
- valve state;
- voltage/current target.

05B is presentation/interaction shell only. It must not calculate heat transfer, actual temperature change, pressure evolution, gas transfer/escape, filtration outcome, condensation, reaction-rate changes or electrochemistry.

Expected architecture:
`apparatus UI -> provider command -> apparatus simulation -> provider projection -> UI current state`

Never:
`apparatus UI -> frontend physics calculation`.

### 05C — Chemistry Visualization
Preferred future ownership:
- `src/ui/chemistry/`

Owns:
- structural/molecular notation;
- vessel composition visualization;
- reaction activity presentation;
- reaction Timeline chemistry presentation;
- generated/unknown species visualization;
- scientific-status / approximation display;
- Phase 3B reversible/equilibrium presentation;
- future chemistry graphs/plots.

Current Phase 3A `reactionProjection`/reaction Timeline behavior belongs conceptually to 05C presentation, but provider wiring itself remains 05D-owned. Do not move it immediately unless an extraction is required by active work.

Phase 3B rule:
- inspect PR #51/#52 contracts only;
- do not calculate Q/K/ΔG/direction/equilibrium tolerance/extent in React;
- do not copy #51/#52 types into UI manually;
- wait for a stable provider-facing projection before production Phase 3B UI wiring.

### 05D — UI Integration & Accessibility
Preferred future ownership:
- `src/ui/shared/`
- `src/ui/providers/`
- `src/ui/adapters/`

Owns:
- provider wiring;
- player-safe adapters/projections;
- shared frontend DTO/contracts;
- shared state-boundary rules;
- accessibility / semantic regions;
- keyboard/focus behavior;
- Testing Library architecture;
- cross-module UI regression;
- final responsive/browser smoke integration.

Provider remains authoritative. 05D must not recreate simulation facts in React/provider adapters, including thermal evolution, gas pressure, equilibrium, reaction extent, molecular identity, phase truth, filtration outcome or heat transfer.

## App.tsx migration policy
`App.tsx` is currently the largest conflict hotspot because it owns layout, chemistry presentation, controls and composition in one file.

Do not allow 05A and 05B to independently rewrite it.

Migration policy:
1. 05A owns the first extraction of stable Workbench/layout composition boundaries.
2. 05B builds apparatus UI behind the resulting typed placement/inspector interface.
3. 05C extracts chemistry-specific presentation only when doing real chemistry-visualization work.
4. 05D owns provider/shared adapter extraction and integration wiring.
5. `App.tsx` should gradually become a composition shell; no mass refactor is required now.

## Existing apparatus work audit
GitHub audit at `e49b3f25eeb39d08a6c397c4869beceb6c5c8bbf` found:
- no production `src/ui/apparatus/` directory;
- no production Hot Plate / Device Inspector / Magnetic Stirrer / Gas Collector implementation;
- no open apparatus-specific PR;
- no apparatus-named feature branch in the current branch inventory.

Therefore there is no existing GitHub apparatus implementation to delete or restart.

The existing Workbench placement area and generic bottom controls are the starting production surfaces to preserve during staged migration.

Handoff:
- placement/layout preparation -> 05A;
- apparatus catalog/visuals/Device Inspector -> 05B;
- shared command/projection interfaces -> 05D;
- 05C does not own apparatus implementation.

## Bottom action migration policy
Current production still has generic bottom operations such as Mix/Stir and generic condition controls. Do not remove them abruptly.

Staged direction:
- place/select apparatus;
- Device Inspector opens;
- device-specific control is issued through provider command;
- provider/simulation returns authoritative current state;
- generic bottom actions are retired only after equivalent provider-backed apparatus flows are integrated and regression-tested.

Examples:
- Hot Plate -> ON/OFF -> target temperature or power request;
- Magnetic Stirrer -> ON/OFF -> RPM request;
- Vacuum Pump -> ON/OFF -> target pressure request;
- Filter -> connection/status/control request.

A setpoint is a request, not direct state mutation. Example: Hot Plate 100 °C must never set `vessel.temperature = 100 °C` in React.

## Phase 3B coordination
### Current external dependencies
PR #51 — 02 equilibrium thermodynamics + progression policy:
- open, not merged;
- base main `e49b3f25eeb39d08a6c397c4869beceb6c5c8bbf`;
- exposes equilibrium direction/status and optional numeric thermodynamic/progression evidence under 02 authority.

PR #52 — 01 reversible-pair arbitration:
- open, not merged;
- stacked on PR #51;
- extends reaction/provider facts with optional reversible/equilibrium metadata;
- explicitly states 05 must not derive equilibrium direction itself.

### Safe UI work now
05C may:
- review #51/#52 player-facing semantics;
- define compact presentation vocabulary and component interface shape;
- define privacy/precision test cases;
- plan placement in reaction activity / Timeline / inspector.

05D may:
- inspect exact provider-facing fields;
- plan adapter and accessibility boundaries;
- prepare tests that consume mocked provider facts only after types stabilize.

### Blocked until provider contract lands/stabilizes
- production Phase 3B provider wiring;
- canonical UI DTO duplication of #51/#52 types;
- Q/K/ΔG calculation;
- favored-direction calculation;
- equilibrium-tolerance logic;
- reaction-extent derivation.

## Test ownership going forward
- **05A tests:** layout, placement surface, panel/drawer behavior, responsive geometry.
- **05B tests:** apparatus catalog, device selection, Device Inspector, control dispatch/UI state.
- **05C tests:** molecule/composition/reaction/equilibrium/scientific-status presentation and privacy.
- **05D tests:** provider integration, accessibility, semantic regions, keyboard/focus, global regression, responsive smoke.

Do not mass-migrate the existing `LaboratoryWorkspace.test.tsx` simply for aesthetics. New tests should be placed by ownership, and existing cases should move only when the corresponding production boundary is extracted.

## Next parallel execution order
### 05A — start now
1. Define/extract Workbench placement surface from monolithic `App.tsx`.
2. Establish typed apparatus placement child/slot interface.
3. Preserve catalog/inspector containers and collapse behavior.
4. Preserve responsive desktop/tablet/mobile geometry.
5. Avoid apparatus-specific controls.

### 05B — start now, in parallel after interface agreement
1. Define apparatus catalog model and initial simple geometry.
2. Implement apparatus-instance presentation against 05A placement interface.
3. Implement Device Inspector shell.
4. Prioritize Hot Plate / Heating Bath / Hot-Air Chamber / Cooling Bath / Magnetic Stirrer, then remaining devices.
5. Dispatch typed commands only; do not implement physics.

### 05C — limited parallel work
1. Own current chemistry-presentation inventory/contract.
2. Prepare Phase 3B visualization spec against #51/#52 without production wiring.
3. Do not start apparatus work.

### 05D — prepare integration boundary
1. Define shared apparatus UI DTO/command/projection boundary without inventing backend values.
2. Plan `src/ui/shared`, `providers`, `adapters` extraction as needed by real integration.
3. Define accessibility/focus semantics for placement + Device Inspector.
4. Split new integration/regression tests by ownership.
5. Final integration after 05A/B/C interfaces stabilize.

## Conflict risks and mitigation
### High-risk shared files
- `src/ui/App.tsx`
- `src/ui/provider.tsx`
- `src/ui/types.ts`
- `src/ui/styles.css`
- `tests/ui/LaboratoryWorkspace.test.tsx`

### Mitigation
- 05A gets first ownership of layout extraction from `App.tsx`.
- 05B does not independently rewrite `App.tsx`; it consumes the 05A interface.
- 05D owns shared provider/type adapters once extraction is required.
- 05C should keep chemistry presentation changes isolated from apparatus/layout files.
- shared CSS primitives should be extracted before multiple branches add competing global selectors.
- no two workstreams should invent parallel versions of the same apparatus/provider DTO.

## Historical Phase 3A record
Phase 3A is now production history, not an active dependency.

Historical facts retained for audit:
- PR #47 implemented player-safe Phase 3A reaction activity projection against PR #46.
- targeted UI at the validated Phase 3A checkpoint: 21/21 PASS.
- full stack checkpoint: 205/205 PASS across 17 files.
- responsive smoke passed at 1536×900, 1440×900, 1024×768 and 390×844.
- unknown generated identity remained hidden in normal mode and Developer Mode diagnostics remained isolated.

Production integration is complete on current main; the old statement that 05 is blocked on PR #46 is closed.

## Active blockers
- No blocker to begin 05A/05B parallel apparatus UI preparation.
- Phase 3B visualization production wiring is blocked on the #51/#52 stack reaching a stable integration point.
- Apparatus physics/provider runtime contracts are not yet production-authoritative; 05B/05D must therefore implement UI shells/contracts without inventing physical readings or evolution.

## Next integration order
1. 05A placement/layout boundary.
2. 05B apparatus catalog + visuals + Device Inspector against that boundary.
3. 05D provider/shared integration boundary and accessibility regression.
4. 05C chemistry visualization changes as provider contracts stabilize, including Phase 3B when ready.
5. 05 final architecture/signoff and coordinated integration PR order.

## Gate
**PASS — 05 is rebaselined as UI architecture/coordinator; Phase 3A is production-integrated; 05A/05B/05C/05D ownership is defined and ready for parallel execution.**
