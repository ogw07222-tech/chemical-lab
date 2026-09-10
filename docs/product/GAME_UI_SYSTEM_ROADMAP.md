# Game UI and System Roadmap

## Status
APPROVED BY 00 - Chemistry Lab Game Design HQ

This document defines the current product-facing game structure, UI architecture, interaction model, phase/thermal behavior, deployment target, and feature roadmap for Chemical Lab.

It should be read together with:

- `PROJECT.md`
- `docs/contracts/UNIT_SYSTEM.md`
- `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`
- `docs/product/PREMIUM_ROADMAP.md`

## 1. Platform Direction

Primary target: PC web browser.

Secondary targets:

- tablet web browser;
- mobile web browser when practical.

The UI is PC-first and information-dense. Mobile support should preserve core functionality through responsive layout changes rather than by redesigning the chemistry model or removing core game systems.

Recommended layout priority:

1. desktop around 1440x900 and larger;
2. tablet / compact desktop around 1024px+;
3. narrow tablet / large mobile;
4. mobile with panel/tab navigation.

## 2. Canonical Core Gameplay Loop

Normal play uses one primary game mode.

`choose unlocked material -> add finite amount -> configure apparatus/conditions -> run experiment -> observe -> analyze -> confirm new species -> encyclopedia unlock -> unlimited inventory reuse -> next experiment`

Only starter materials and discovered/unlocked species are selectable in normal inventory.

Unlocked species have unlimited laboratory stock. Every actual vessel addition still has a finite amount in SI units and remains subject to physical conservation inside the simulation.

All-species bypass is Developer Mode only.

## 3. Main PC Laboratory Layout

The main laboratory should be optimized around one primary reaction vessel and rapid experimentation.

### Top Bar

- experiment name;
- save / load;
- simulation time;
- run / pause;
- simulation speed;
- settings;
- developer controls only in developer builds/mode.

### Left Panel — Inventory / Discovery Access

- unlocked substance search;
- material list;
- molecule preview;
- amount input;
- add-to-vessel action;
- favorite/recent materials;
- encyclopedia shortcut.

Undiscovered species are not normal selectable inventory entries.

### Center — Vessel Workspace

- reaction vessel visualization;
- visible bulk phases;
- fill/headspace representation;
- gas evolution / bubbling;
- precipitate or solid region when supported;
- heating/cooling activity;
- reaction activity feedback;
- current composition summary;
- molecule inspector / structure viewer.

The vessel visualization is a presentation of authoritative simulation state. It must not infer chemistry on its own.

### Right Panel — Laboratory Controls

Grouped controls:

#### Thermal
- heater power;
- cooler power;
- optional target-temperature controller / thermostat;
- current temperature;
- ambient/environment thermal settings where supported.

#### Vessel / Mechanical
- volume control where apparatus permits;
- pressure control where apparatus permits;
- open / sealed state;
- mixing controls.

#### Electrochemistry
- electrodes;
- voltage;
- current;
- electrical mode.

#### Chemistry Assistance
- catalysts;
- later solvent/apparatus controls.

#### Simulation
- start;
- pause;
- step;
- speed;
- reset.

### Bottom / Secondary Analysis Workspace

Tabs or expandable panels:

- Composition
- Products / Analysis
- Graphs
- Timeline
- Experiment Log
- Phase Diagram
- Comparison

## 4. Mobile Layout

Mobile should reuse the same game systems and state contracts.

Recommended navigation:

- Inventory
- Lab
- Controls
- Analysis
- Log

The vessel remains the primary Lab view. Dense secondary information moves into tabs, sheets, or full-screen panels.

Mobile must not introduce simplified chemistry rules.

## 5. Phase Is Simulation-Owned

Players do not manually choose whether a substance is solid, liquid, or gas.

Phase is determined by the Simulation / Thermodynamics layer from current physical conditions and available phase data/model.

Authoritative inputs include at least:

- species identity;
- temperature;
- pressure;
- composition/environment;
- later solvent/mixture effects where supported.

UI displays the resulting phase state only.

## 6. Phase Diagram Feature

The UI should support a temperature-pressure phase diagram for species where the required data/model exists.

Preferred display:

- temperature axis;
- pressure axis;
- solid region;
- liquid region;
- gas region;
- current T/P operating point;
- phase-boundary curves;
- triple point when known;
- critical point when known.

The current-state marker should move as temperature and pressure change.

### Data Quality Policy

Phase diagrams must follow scientific-status rules.

Possible sources:

1. validated phase-boundary / EOS data;
2. validated vapor-pressure / melting / boiling data;
3. thermodynamic approximation;
4. simple threshold fallback;
5. OPEN / unavailable.

Do not fabricate precise curves for poorly characterized species.

## 7. Phase-Dependent Chemistry

Phase must affect simulation behavior, not only rendering.

Potential effects include:

- collision frequency;
- diffusion / transport;
- molecular mobility;
- ion dissociation availability;
- solvent interaction;
- gas partial-pressure behavior;
- solid surface/contact limits;
- precipitation availability;
- reaction candidate filtering;
- reaction rate corrections.

Initial implementation may use coarse phase-dependent multipliers/classes before more realistic transport models are available.

Thermodynamic direction and reaction generation must remain separate from purely visual phase effects.

## 8. Thermal and Reaction-Enthalpy Model

Exothermic and endothermic reactions are core simulation features.

A reaction should be able to exchange energy with the vessel thermal state.

Conceptual flow:

`reaction extent -> reaction enthalpy -> released/absorbed energy -> vessel thermal energy -> temperature response`

The engine must distinguish:

- exothermic reaction;
- endothermic reaction;
- external heating/cooling;
- heat transfer to surroundings;
- phase-change energy when supported.

## 9. Temperature Control Philosophy

The player should not normally overwrite vessel temperature as an instantaneous arbitrary state variable.

Preferred controls:

### Heater / Cooler Power

The player applies heating or cooling power. Temperature evolves from the thermal model.

This allows reaction heat to remain visible and physically meaningful.

### Target-Temperature Controller

An optional thermostat/controller may attempt to maintain a chosen target temperature.

In this mode, the controller supplies or removes heat as needed rather than deleting reaction heat from the model.

The UI may display energy supplied/removed by the controller when supported.

This allows meaningful comparison between:

- near-adiabatic experiments;
- actively heated/cooled experiments;
- temperature-controlled experiments.

## 10. Thermal State Requirements

Long-term vessel thermal state should support:

- temperature in K;
- thermal energy / enthalpy accounting where appropriate;
- heat capacity;
- reaction heat source/sink;
- heater/cooler power;
- environment heat exchange;
- vessel/container heat capacity;
- latent heat / phase transition coupling;
- optional thermostat control state.

Initial versions may simplify some of these, but the interfaces should not assume temperature is merely a UI slider value.

## 11. SI Unit Policy

Authoritative internal state uses SI units.

Examples:

- amount: mol
- mass: kg
- temperature: K
- pressure: Pa
- volume: m^3
- energy: J
- molar energy: J/mol
- concentration: mol/m^3
- power: W
- voltage: V
- current: A

UI may display convenient derived units such as °C, L, mL, kPa, atm, mol/L, kJ, or kJ/mol.

Conversions happen at typed UI/data boundaries only.

## 12. Analysis and Instrument Model

New species should not automatically reveal their identity merely because the Simulation Core created them.

Default discovery loop:

`unknown product -> observation -> analyzer/instrument confirmation -> identity confirmed -> encyclopedia entry -> inventory unlock`

Initial MVP may use a generalized Substance Analyzer abstraction.

Later specialized instruments may include:

- thermometer;
- pressure gauge;
- balance;
- pH meter;
- gas analyzer;
- conductivity meter;
- spectroscopic/chromatographic abstractions where appropriate.

## 13. Encyclopedia

The encyclopedia is a progression system and personal chemistry record, not merely a static wiki.

A discovered species entry may show:

- name;
- formula;
- molecular graph / structure;
- current known phase information;
- phase diagram when available;
- validated physical properties;
- first-discovery experiment;
- discovery date/order;
- related experiments;
- related species;
- known reaction-family associations;
- scientific confidence/status.

Undiscovered compounds should not be revealed as normal inventory choices.

## 14. Experiment Record and Replay

Each experiment should eventually be reproducible from:

- initial state;
- simulation/data version;
- seed;
- ordered commands;
- timing/stepping policy;
- optional snapshots/checkpoints.

Experiment records should include:

- materials added;
- finite amounts;
- temperature/pressure/volume history;
- heater/cooler activity;
- reaction/observable events;
- analyzer results;
- products;
- remaining species;
- graphs/time series;
- notes and comparison links.

## 15. Graphs

Core graphing should include, when data exists:

- species amount vs time;
- temperature vs time;
- pressure vs time;
- concentration vs time;
- reaction-rate/activity vs time;
- heater/cooler power vs time;
- thermal energy flow where useful.

Phase Diagram is a separate T-P scientific visualization rather than a time-series graph.

## 16. Premium Boundary

Standard game includes the complete chemistry/discovery loop and essential UI.

Premium may extend:

- experiment archive capacity;
- advanced multi-run comparison;
- richer graph overlays;
- enhanced encyclopedia organization;
- advanced visualization options;
- workspace customization;
- cosmetics.

Premium must not alter chemistry, scientific accuracy, inventory unlock rules, or supported compounds.

See `docs/product/PREMIUM_ROADMAP.md`.

## 17. Developer Mode

Developer Mode may expose:

- all supported species;
- arbitrary spawning;
- hidden simulation state;
- reaction candidates;
- pruning diagnostics;
- raw thermodynamic/kinetic values;
- forced test states;
- validation fixtures.

Developer Mode is separate from normal play and Premium.

## 18. Architecture Boundary

Preferred dependency direction:

`Simulation Core -> authoritative physical/chemical state`

`Game Layer -> discovery, encyclopedia, inventory, experiment history`

`UI Adapter -> display-oriented transformation / unit conversion`

`Web UI -> presentation + command dispatch`

Forbidden patterns:

- chemistry formulas inside React components;
- phase selected directly by UI;
- UI directly mutating authoritative temperature;
- Premium checks inside Simulation Core;
- Inventory progression changing reaction physics.

## 19. Feature Roadmap

### MVP UI

- PC-first laboratory workspace;
- unlocked-material inventory;
- finite amount input;
- reaction vessel;
- current composition;
- temperature display;
- heater/cooler controls;
- run/pause/reset/speed controls;
- basic pressure/volume display;
- generalized analyzer;
- experiment log;
- encyclopedia unlock loop;
- basic phase display;
- basic graphs.

### Core Release

- responsive tablet/mobile layout;
- robust experiment saving/replay;
- experiment comparison;
- phase diagram for supported species;
- pressure/volume apparatus controls;
- phase-dependent kinetics;
- reaction enthalpy -> vessel temperature coupling;
- heat exchange with environment;
- improved molecule viewer;
- catalyst UI;
- electrochemistry controls as engine support matures.

### Advanced

- richer phase-equilibrium models;
- latent heat / phase-transition coupling;
- specialized instruments;
- complex reaction networks;
- improved transport/diffusion effects;
- solvents;
- multi-vessel experiments;
- richer electrochemistry;
- advanced molecular/chemical visualizations.

### Premium Foundation — after core loop is stable

- advanced archive;
- multi-experiment overlays;
- enhanced discovery maps;
- richer workspace organization;
- cosmetics / lab themes;
- advanced presentation options.

## 20. Cross-Workstream Ownership

### 01 — Chemistry Simulation Engine

Owns:

- species/molecular graph state;
- reaction candidates;
- product generation;
- conservation;
- phase-dependent candidate interfaces where structural.

### 02 — Thermodynamics & Kinetics

Owns:

- reaction enthalpy;
- thermal coupling contract;
- phase determination/model interface;
- phase-dependent kinetics;
- heat capacity / energy evaluation;
- equilibrium and temperature dependence.

### 03 — Chemistry Data & Validation

Owns:

- phase data;
- melting/boiling data;
- vapor-pressure data;
- triple/critical points;
- heat capacities;
- thermochemistry;
- source provenance and uncertainty.

### 04 — Laboratory Gameplay

Owns:

- heater/cooler/thermostat commands;
- experiment interaction rules;
- analyzer/discovery/inventory progression;
- save/replay/gameplay state.

### 05 — Web UI

Owns:

- PC-first laboratory layout;
- responsive mobile/tablet presentation;
- phase diagram rendering;
- controls/graphs/encyclopedia UI;
- typed adapter boundaries.

### 06 — Simulation Validation Lab

Validates:

- energy conservation/accounting where modeled;
- phase transitions;
- phase-dependent reaction behavior;
- exothermic/endothermic direction;
- timestep stability;
- SI-unit consistency;
- regression behavior.

### 07 — Integration & GitHub

Owns production wiring, integration sequencing, CI, deployment, and release consistency.

## 21. Current OPEN Decisions

- exact starter-material set;
- exact MVP thermal simplifications;
- initial set of species with validated phase diagrams;
- exact apparatus semantics for pressure/volume control;
- whether thermostat is MVP or Core Release;
- exact mobile minimum viewport/support level;
- detailed analyzer progression;
- exact visual style/theme.

These OPEN items may be refined without changing the core architecture defined above.
