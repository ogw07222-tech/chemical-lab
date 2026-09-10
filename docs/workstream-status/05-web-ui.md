# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Phase 0 — Architecture
- Overall state: IN_PROGRESS
- Last updated: 2026-09-10
- Last checked main SHA: f6513bd6cefc7df5b16d1f678a4cf1b443859e94
- Active branch: main (status-document update only)
- Active PR: none

## Current Objective
Define browser UI information architecture and visualization contracts for vessel state, species, molecular graphs, environment controls, reaction feedback, and experiment analysis without embedding chemistry logic in the UI.

## Completed
### Phase 0 Information Architecture
- Defined the Laboratory main screen as a desktop-first three-zone workspace:
  - left: substances/inventory and molecule selection,
  - center: reaction vessel and direct laboratory interaction,
  - right: environment controls and live state/analysis.
- Defined a persistent experiment/status strip for simulation state, time/speed, temperature, pressure, volume, reaction activity, warnings, and pause/run controls.
- Defined lower/secondary analysis surfaces for reaction timeline, composition graphs, before/after comparison, product analysis, experiment log, and encyclopedia links.
- Established progressive disclosure: essential vessel state is always visible; detailed numerical/structural analysis is available through tabs/drawers without hiding the core experiment.

### Reaction Vessel Visualization Strategy
- No real-time CFD or one-rendered-particle-per-molecule requirement.
- Vessel visualization is a semantic/statistical view of simulation state.
- Represent bulk phase, fill level, gas region, precipitate/solid region, bubbles/gas evolution, thermal activity, and reaction intensity using bounded visual abstractions.
- Visual effects must be derived from state/event data and must not infer new chemistry.
- The composition panel remains the authoritative quantitative view when vessel visuals are approximate.

### Molecule Visualization Strategy
- 2D is the Phase 0/initial implementation default.
- MolecularGraph renderer must support atoms, bonds, bond order, formal charge, selection/highlight state, and optional reactive-site annotations.
- Renderer consumes graph/layout data; it must not fabricate chemically authoritative 3D geometry.
- Architecture should allow a later 3D viewer as an alternate renderer without changing the species/molecular-graph data contract.

### Controls Model
Planned control groups:
- thermal: temperature target, heater/cooler state or power,
- vessel: volume and pressure controls where the gameplay/system contract permits them,
- electrochemical: electrode configuration, voltage/current controls,
- chemistry aids: catalyst selection/add/remove,
- simulation: run/pause, step, speed, reset/replay hooks.

Controls are command emitters. They do not calculate reaction products, rates, equilibrium, pressure, or temperature consequences locally.

### Reaction Feedback
Planned feedback channels:
- gas production/evolution,
- temperature trend,
- pressure trend,
- phase/state changes,
- precipitation/solid formation,
- reaction-rate/activity indicator,
- product formation and reactant depletion,
- structured event/timeline entries.

A visual effect requires an explicit observable state or event source. Color changes are treated as an abstraction unless a validated source/property contract supplies physical color data.

### Analysis UI
- Composition table: species, phase, amount, fraction/concentration where supplied, delta, status.
- Timeline: timestamped simulation/game events plus state-change markers.
- Graphs: amount vs time, temperature vs time, pressure vs time, optional reaction-rate series.
- Before/after comparison: initial/current/final composition with absolute and relative deltas.
- Product analysis: generated species, remaining reactants, phases, confidence/scientific-status metadata when available.
- Experiment log: player actions, instrument observations, notable changes, snapshots/replay references.

### Responsive Strategy
- Desktop: three-zone laboratory workspace with persistent vessel and state panels.
- Tablet: central vessel retained; left/right panels become collapsible rails/drawers; critical state remains pinned.
- Mobile minimum support: single-column vessel-first layout with bottom/tab navigation for Inventory, Controls, Analysis, and Log. Mobile is not the primary dense-analysis target.

### Proposed React / TypeScript Component Boundary
```text
AppShell
└─ LaboratoryWorkspace
   ├─ ExperimentStatusBar
   ├─ InventoryPanel
   │  ├─ SubstanceSearch
   │  ├─ SubstanceList
   │  └─ MoleculeSelector
   ├─ VesselWorkspace
   │  ├─ ReactionVesselView
   │  ├─ VesselOverlay
   │  └─ MoleculeInspector / MoleculeGraphView
   ├─ EnvironmentPanel
   │  ├─ ThermalControls
   │  ├─ PressureVolumeControls
   │  ├─ ElectrodeControls
   │  ├─ CatalystControls
   │  └─ SimulationTimeControls
   └─ AnalysisWorkspace
      ├─ CompositionTable
      ├─ ReactionTimeline
      ├─ ExperimentGraphs
      ├─ ProductAnalysis
      ├─ ExperimentComparison
      └─ ExperimentLog
```

Secondary routes/surfaces:
- MoleculeEncyclopedia
- DiscoveryUI
- Settings
- ExperimentHistory / Replay (later contract)

### State / Dependency Boundary
Proposed frontend dependency flow:
`Simulation/Game snapshot -> UI adapter/selectors -> React view state -> components`

User actions flow:
`component event -> typed UI command -> Game Layer command API -> Simulation Core -> new snapshot/events -> UI`

Rules:
- no chemistry formulas in React components,
- no product/rate/equilibrium inference in selectors,
- display formatting/unit conversion may live in UI utilities,
- animation/interpolation may smooth display values but must not mutate authoritative simulation state,
- simulation tick rate and render frame rate are independent,
- high-frequency snapshots should be sampled/coalesced for presentation when needed.

## In Progress
- Refine typed snapshot/event/command interfaces once 01 and 04 publish stable Phase 0 contracts.
- Decide exact navigation/tab/drawer implementation after frontend scaffold exists.
- Define accessibility/unit-formatting conventions before production component implementation.

## Blockers / OPEN
- 01 Simulation Engine has not yet finalized the MolecularGraph/species TypeScript schema.
- 04 Laboratory Gameplay has not yet finalized the command contract for adding/removing material, vessel manipulation, instruments, catalysts, electrical controls, run/pause/step, experiment history, and replay.
- Exact definitions for concentration, reaction-rate observables, reaction events, color/optical properties, precipitation events, and analysis instrument outputs are not yet stable.
- Pressure/volume controls require 04/00 to define which controls are physically direct vs apparatus-mediated.
- Electrode UI requires 04/01/02 contracts for electrode identity, topology, voltage/current mode, and observable electrical state.

## Validation Evidence
Architecture review only; no runtime UI exists yet.

PASS:
- Main laboratory information architecture can be defined independently of detailed chemistry implementation.
- 2D molecular visualization is compatible with the current molecular graph contract.
- Proposed UI preserves `UI -> Game Layer -> Simulation Core` dependency direction.
- Simulation/render cadence can remain decoupled.

FAIL:
- None identified in the current Phase 0 repository architecture.

OPEN:
- Concrete TypeScript snapshot/event/command schemas.
- Valid direct-manipulation semantics for pressure/volume/electrical controls.
- Physical color/appearance data availability.
- Instrument observation contracts and uncertainty/confidence presentation.
- Exact replay/snapshot contract.

## Next Actions
1. Receive or review 04 Laboratory Gameplay MVP interaction/command contract.
2. Receive or review 01 MolecularGraph/species/vessel-state TypeScript contract.
3. Define `LaboratorySnapshot`, `LaboratoryEvent`, and `LaboratoryCommand` UI-facing interfaces or adapters without owning chemistry behavior.
4. Create the initial React/TypeScript UI scaffold only after those interface boundaries are stable enough to avoid duplicating domain logic.
5. Add component-level tests for rendering states, command dispatch, responsive layout, and high-frequency snapshot handling when implementation begins.

## Handoffs
### To 04 — Laboratory Gameplay
Please define authoritative game-layer commands and capability rules for:
- add/remove/transfer substance,
- heat/cool,
- pressure/volume manipulation,
- catalyst operations,
- electrodes/voltage/current,
- simulation run/pause/step/speed,
- instruments/observations,
- experiment snapshot/log/replay.

05 will render controls and dispatch these commands but will not decide whether the action is chemically or apparatus-valid.

### To 01 — Chemistry Simulation Engine
Please expose stable read-only identifiers/state needed for UI:
- species identity and amount,
- phase,
- vessel temperature/pressure/volume,
- MolecularGraph atoms/bonds/bond order/formal charge,
- optional reactive-site/reaction annotations if those are intended to be observable,
- deterministic clock/state identifiers where appropriate.

05 will visualize these values but will not derive chemical outcomes from graph structure.