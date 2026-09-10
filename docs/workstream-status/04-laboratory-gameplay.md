# 04 — Laboratory Gameplay

- Owner: Lead Laboratory Gameplay Designer / Chemistry Sandbox Systems Designer / Progression Designer / Experiment Gameplay Developer
- Current phase: Phase 0 — Architecture
- Overall state: CONTRACT_ALIGNED
- Last updated: 2026-09-10
- Last checked main SHA: `1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1`
- Active branch: `docs/04-gameplay-alignment`
- Active PR: #6 — `docs: align laboratory gameplay with canonical progression and thermal contracts`

## Current Objective
Align Laboratory Gameplay with the latest 00 HQ contracts for single-mode progression, discovery-gated unlimited inventory, simulation-owned phase, energy-based thermal controls, unknown-species observation, deterministic experiment records, and Developer Mode isolation. No chemistry outcome logic is implemented here.

## Source of Truth Reviewed
Production source of truth:

- `PROJECT.md`
- `AGENTS.md`
- `ROADMAP.md`
- `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`
- `docs/contracts/UNIT_SYSTEM.md`
- `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`
- `docs/product/GAME_UI_SYSTEM_ROADMAP.md`
- this workstream status document

Unmerged public contracts reviewed only as references, not production source of truth:

- PR #1 — 01 Molecular / Reaction Core
- PR #5 — 02 Thermodynamics / Phase / Thermal
- PR #3 — 03 Chemistry Data

## Canonical Gameplay Model
There is one normal game.

`choose unlocked material -> add finite amount -> configure apparatus/conditions -> run -> observe -> analyze -> confirm identity -> SpeciesDiscovery -> EncyclopediaUnlock -> InventoryUnlock -> unlimited reuse`

Tutorial, objective, challenge, guided-experiment, and achievement systems are overlays on this same game state and command model. They may constrain a task setup or evaluate observations, but they must not define a second chemistry mode or a second simulation rule set.

The former separate `Sandbox Mode` / `Objective Mode` proposal is deprecated.

```ts
export interface LaboratoryGameState {
  progression: PlayerProgressionState;
  activeExperimentId?: string;
  activeOverlay?: GameplayOverlayState;
  developerMode: DeveloperModeState;
}

export type GameplayOverlayKind =
  | "tutorial"
  | "objective"
  | "challenge"
  | "guided-experiment";

export interface GameplayOverlayState {
  id: string;
  kind: GameplayOverlayKind;
  status: "inactive" | "active" | "completed" | "failed";
  allowedSetupConstraints?: readonly SetupConstraint[];
  goals?: readonly ObjectiveCondition[];
}
```

Overlay state must never enter Simulation Core as a chemistry modifier.

## Typed Progression State
```ts
export type SpeciesKey = string;
export type ExperimentId = string;

export interface PlayerProgressionState {
  schemaVersion: number;
  starterMaterialSetId: string;
  starterSpecies: readonly SpeciesKey[];
  discoveredSpecies: Readonly<Record<SpeciesKey, SpeciesDiscovery>>;
  encyclopedia: Readonly<Record<SpeciesKey, EncyclopediaEntryState>>;
  inventory: InventoryUnlockState;
  discoveryOrder: readonly SpeciesKey[];
}

export interface SpeciesDiscovery {
  speciesKey: SpeciesKey;
  firstExperimentId: ExperimentId;
  confirmedAtSimulationTimeS: number;
  confirmationMethod: "instrument-analysis" | "approved-direct-identity-channel";
  analysisResultId?: string;
}

export interface EncyclopediaEntryState {
  speciesKey: SpeciesKey;
  unlocked: true;
  firstDiscoveryExperimentId: ExperimentId;
  relatedExperimentIds: readonly ExperimentId[];
  firstDiscoveryOrder: number;
}

export interface InventoryUnlockState {
  unlockedSpecies: readonly SpeciesKey[];
  stockSemantics: "UNLIMITED_UNLOCKED";
}
```

Progression contains access/knowledge state only. It does not contain physical vessel matter.

## Starter Material Contract
Exact starter species remain OPEN. The contract must allow starter tuning without silently rewriting older saves.

```ts
export interface StarterMaterialSet {
  id: string;
  schemaVersion: number;
  speciesKeys: readonly SpeciesKey[];
  equipmentEntitlements?: readonly string[];
  contentRevision?: string;
}

export interface StarterMaterialEntitlement {
  starterMaterialSetId: string;
  grantedSpeciesKeys: readonly SpeciesKey[];
  grantedAtSaveCreation: boolean;
}
```

Rules:

- use stable species keys, not display names;
- exact set membership is content/HQ policy and remains OPEN;
- saves preserve the set/revision granted at creation;
- later tuning requires explicit versioned migration if existing saves are changed;
- starter status never changes chemistry.

## Discovery -> Encyclopedia -> Inventory
Canonical first-discovery transition:

`AnalysisResult(identity-confirmed) -> IdentityConfirmedEvent -> SpeciesDiscovery -> EncyclopediaUnlock -> InventoryUnlock`

A hidden species existing in Simulation Core does not count as discovered. Visually ambiguous effects do not identify a named compound. Duplicate valid confirmations may append history but must not duplicate first-discovery or inventory-unlock events.

From the player's perspective, encyclopedia and inventory unlock should commit atomically after the authoritative first-discovery event.

## Unlimited Unlocked Inventory
Once a species is a starter or unlocked discovery, its normal laboratory stock is unlimited. There is no normal consumable stock counter, depletion, purchase, farming, or replenishment loop.

Unlimited stock is a Game Layer entitlement only. Every operation entering Simulation Core must contain finite physical values.

```ts
export interface AddUnlockedMaterialCommand {
  kind: "AddUnlockedMaterial";
  commandId: string;
  vesselId: string;
  speciesKey: SpeciesKey;
  amountMol: number;
}
```

Pre-dispatch invariants:

- species is starter/unlocked unless Developer Mode bypass applies;
- `amountMol` is finite and > 0;
- explicit `massKg` / `volumeM3`, if present, are finite;
- apparatus and vessel constraints are respected;
- `Infinity`, `-Infinity`, `NaN`, unlimited tokens, and sentinel huge stock numbers are rejected before Core dispatch.

The previous quantity/economy OPEN is CLOSED by HQ: unlocked normal-play inventory is unlimited. A finite-resource economy requires a new explicit 00 decision.

## Vessel / Phase Ownership
Gameplay controls requests and apparatus configuration, not chemistry outcomes.

Gameplay may request:

- finite material addition/removal/transfer;
- mixing;
- heater/cooler/thermostat controls;
- supported pressure/volume apparatus controls;
- electrodes/catalysts;
- run/pause/step/speed;
- sampling and analysis.

Gameplay reads but does not authoritatively choose:

- products/pathways/reaction family outcome;
- kinetics/equilibrium;
- temperature evolution;
- pressure consequence;
- phase;
- reaction heat;
- phase-change heat.

Normal UI/gameplay must not offer `solid/liquid/gas` as a material-selection control. Phase is determined from current species, temperature, pressure, composition/environment, and the available Simulation/Thermodynamics model.

Gameplay may use authoritative phase for visualization, apparatus compatibility, sampling/analysis, observation records, experiment history, and phase-diagram current-state markers.

All authoritative physical quantities follow `UNIT_SYSTEM.md`: mol, kg, K, Pa, m^3, J, W, s, V, A, mol/m^3.

## Thermal Gameplay Commands
Normal gameplay must not implement instantaneous authoritative `SetTemperature`.

```ts
export type ThermalGameplayCommand =
  | {
      kind: "SetHeaterPower";
      commandId: string;
      vesselId: string;
      requestedPowerW: number;
    }
  | {
      kind: "SetCoolerPower";
      commandId: string;
      vesselId: string;
      requestedExtractionPowerW: number;
    }
  | {
      kind: "EnableThermostat";
      commandId: string;
      vesselId: string;
      targetTemperatureK: number;
    }
  | {
      kind: "SetThermostatTarget";
      commandId: string;
      vesselId: string;
      targetTemperatureK: number;
    }
  | {
      kind: "DisableThermostat";
      commandId: string;
      vesselId: string;
    };
```

Semantics:

- Heater adds energy over simulation time.
- Cooler removes energy over simulation time.
- Thermostat controls bounded external heat exchange toward a target; it does not overwrite `temperatureK`.
- Reaction heat stays part of the thermal model.
- Phase-change/latent heat stays distinct when modeled.
- Power/target inputs are finite SI values.
- Apparatus limits may explicitly reject or clamp a request; gameplay must not hide the distinction.

02 owns heat integration, heat capacity, latent heat, environment heat transfer, phase evaluation, and thermostat controller algorithm.

## Thermal Observation Contract
04 exposes fields capable of recording authoritative 02 outputs; 04 does not calculate them.

```ts
export interface ThermalObservationSnapshot {
  simulationTimeS: number;
  temperatureK: number;
  heaterEnergySuppliedJ?: number;
  coolerEnergyRemovedJ?: number;
  thermostatEnergyExchangedJ?: number;
  reactionHeatContributionJ?: number;
  phaseChangeHeatJ?: number;
  environmentHeatJ?: number;
}
```

Preferred interpretation:

- heater supplied and cooler removed values are explicit magnitudes;
- thermostat energy may be signed if that is the final merged 02 convention;
- reaction heat and phase-change heat remain separately attributable;
- 04/05 should consume a thermal ledger rather than infer heat sources from temperature alone.

Exact sign convention and controller limits remain OPEN until 02's contract is integrated.

## Phase Diagram Interaction Contract
05 renders Phase Diagram. 04 owns selection context and identity disclosure.

```ts
export type PhaseDiagramTarget =
  | { source: "inventory"; speciesKey: SpeciesKey }
  | { source: "encyclopedia"; speciesKey: SpeciesKey }
  | { source: "vessel-selection"; speciesKey: SpeciesKey; vesselId: string };
```

Rules:

- inventory target must be starter/unlocked;
- encyclopedia target must be identity-known;
- vessel target is allowed only if that species identity is already revealable in the current observation state;
- unknown species cannot use Phase Diagram lookup as an identity oracle;
- Phase Diagram is information, never a phase-control surface;
- the vessel T/P marker may track authoritative state;
- unavailable/approximate data must remain visibly limited rather than fabricated;
- 02/03 own phase-diagram data/model/status; 05 owns rendering.

## Unknown -> Identified -> Discovery Flow
Normal UI projection must not leak Simulation Core species identity before legitimate confirmation.

```ts
export interface UnknownSubstanceObservation {
  observationId: string;
  experimentId: ExperimentId;
  vesselId: string;
  simulationTimeS: number;
  observationKind: "unknown-substance";
  localObservationKey: string;
  visibleProperties?: readonly ObservableProperty[];
  phaseObservation?: "solid" | "liquid" | "gas" | "multiphase" | "unknown";
}

export interface AnalysisResult {
  analysisResultId: string;
  experimentId: ExperimentId;
  instrumentId: string;
  sampleRef: string;
  simulationTimeS: number;
  result:
    | { kind: "identity-confirmed"; speciesKey: SpeciesKey; confidence?: number }
    | { kind: "identity-unresolved"; candidateCountHint?: number };
}

export interface IdentityConfirmedEvent {
  eventId: string;
  speciesKey: SpeciesKey;
  experimentId: ExperimentId;
  analysisResultId: string;
  simulationTimeS: number;
}
```

Projection invariant:

`hidden authoritative SpeciesState -> normal observation projection -> UnknownSubstanceObservation`

Then, only through an approved identity channel:

`AnalysisResult(identity-confirmed) -> IdentityConfirmedEvent -> SpeciesDiscovery -> EncyclopediaUnlock -> InventoryUnlock`

An unknown normal view model must not contain player-readable `speciesKey`, name, formula, molecular graph, reaction-candidate identity, or debug metadata. A private correlation token may exist below the UI boundary. Visible phase may be shown when legitimately observable, but it does not identify the compound by itself.

## Experiment Record Contract
The old required `mode: sandbox | objective` field is deprecated.

```ts
export interface ExperimentRecord {
  schemaVersion: number;
  experimentId: ExperimentId;
  parentExperimentId?: ExperimentId;
  createdFromTemplateId?: string;
  simulation: {
    seed: string | number;
    simulationVersion: string;
    chemistryDataVersion: string;
    gameLayerVersion: string;
    steppingPolicyId?: string;
  };
  initialSetup: ExperimentInitialSetup;
  commands: readonly RecordedLaboratoryCommand[];
  observations: readonly ObservationRecord[];
  analysisActions: readonly AnalysisActionRecord[];
  discoveryEvents: readonly DiscoveryEventRecord[];
  resultSummary: ExperimentResultSummary;
  historyRefs: {
    temperatureSeriesRef?: string;
    pressureSeriesRef?: string;
    thermalEnergySeriesRef?: string;
    speciesSeriesRef?: string;
  };
  replay: ReplayMetadata;
  overlayContext?: ExperimentOverlayContext;
}
```

It must preserve at minimum:

- experiment ID;
- simulation seed/version and data/Game Layer versions;
- initial setup;
- every finite material addition/transfer used for replay;
- ordered commands and simulation timestamps;
- heater/cooler/thermostat state changes;
- analysis/sample actions;
- identity-confirmation/discovery events;
- resulting and remaining authoritative species state as needed for persistence/debug, while normal observations preserve identity gating;
- key temperature/pressure history references;
- thermal-energy history reference when available;
- replay schema/stepping/checkpoint metadata;
- optional tutorial/objective/challenge overlay history.

Overlay metadata never changes chemistry rules.

```ts
export interface RecordedMaterialAddition {
  commandId: string;
  simulationTimeS: number;
  vesselId: string;
  speciesKey: SpeciesKey;
  amountMol: number;
  massKg?: number;
  volumeM3?: number;
  source: "unlocked-inventory" | "starter" | "developer" | "transfer";
}
```

All physical numeric fields must be finite. Invalid non-finite replay data is rejected rather than normalized.

## Save / Replay Boundary
Replay remains command-driven, not video-driven.

Minimum deterministic bundle:

- save/replay schema version;
- initial authoritative state or canonical constructor inputs;
- seed;
- Simulation Core compatibility/version ID;
- Chemistry Data version/hash;
- Game Layer command schema version;
- ordered command stream;
- simulation-time timestamps and sequence IDs;
- thermal apparatus-control changes;
- stepping policy where required;
- optional checkpoints/state hashes for divergence detection.

Experiment replay and player progression persistence are distinct. Archival replay should be non-progression-mutating by default. A deliberate "re-run as new experiment" may be treated as a new live experiment and evaluated normally.

## Developer Mode Boundary
Developer Mode is the only all-access bypass.

```ts
export interface DeveloperModeState {
  enabled: boolean;
  context: "normal" | "developer" | "validation";
}
```

It may browse/spawn all supported species, bypass discovery entitlement, inspect hidden state/candidates/pruning data, force test setups, and use validation fixtures.

Invariants:

- bypass changes access/observability, not thermodynamics, kinetics, conservation, phase, or normal reaction outcomes;
- developer runs/saves are clearly marked and do not accidentally contaminate normal progression/achievements;
- Premium is not Developer Mode;
- Developer spawning still sends finite physical amounts to Simulation Core.

## Safety / Gameplay Abstraction
Hazardous conditions may be represented non-graphically through:

- warnings;
- apparatus-limit warnings;
- containment-failure abstraction;
- experiment abort/simulation termination;
- abstract apparatus damage/unavailability if later useful.

Gameplay must not teach real-world acquisition, preparation, concentration, or handling procedures for dangerous substances. Safety presentation should communicate simulation/apparatus state at a high level.

## Dependencies on 01 / 02 / 03
### 01 — Simulation Engine
Required production boundary:

- finite `amountMol` only;
- stable species keys;
- no inventory entitlement inside authoritative species state;
- phase is read-only to Game Layer;
- deterministic state/event IDs for replay correlation;
- hidden identities can be projected without leaking to normal UI.

PR #1 publicly proposes compatible finite amount/phase/identity semantics but is unmerged.

### 02 — Thermodynamics & Kinetics
Required production boundary:

- authoritative temperature and phase evaluation;
- heater/cooler/thermostat energy-control semantics;
- separable reaction/heater/cooler/thermostat/environment/phase-change thermal contributions;
- phase-diagram data/model boundary;
- phase-transition events when supported;
- apparatus/controller limits.

PR #5 publicly proposes a compatible thermal ledger and bounded thermostat but is unmerged. Exact sign conventions, controller limits, latent-heat tier, and integration ordering remain OPEN.

### 03 — Chemistry Data
Required production boundary:

- stable species identity data;
- SI-normalized phase/thermal properties with provenance/status;
- phase boundaries and triple/critical points when available;
- explicit missing-data behavior with no fabricated precision.

PR #3 publicly proposes compatible SI-normalized phase/thermal records but is unmerged.

## 05 — Web UI Handoff
05 must align the UI-facing provider/view-model contract to these rules:

- no Sandbox/Objective chemistry-mode selector;
- overlays for tutorial/objective/challenge;
- normal inventory shows starter + unlocked species only;
- unlocked stock displays as unlimited while amount input means finite quantity added now;
- no normal phase selector;
- heater power, cooler power, and thermostat controls replace direct SetTemperature semantics;
- unknown species remain anonymous until identity confirmation;
- confirmation -> discovery -> encyclopedia -> inventory appears as one authoritative progression transition;
- Phase Diagram is identity-gated information, never a phase control;
- experiment history can show thermal controls, analyses, discoveries, T/P series, and thermal-ledger data when available;
- Developer all-species/debug surfaces are isolated from normal UI;
- UI units use typed conversion adapters while authoritative state remains SI.

PR #4 predates this full alignment. Before production integration it must be reconciled especially for mock-catalog visibility, progression gating, thermal controls, phase ownership, and unknown identity projection.

## 06 — Validation Requirements
Progression/inventory:

- undiscovered non-starter species cannot be selected normally;
- hidden simulation existence alone never unlocks;
- first valid identity confirmation unlocks exactly once;
- encyclopedia and inventory unlock remain consistent;
- duplicate confirmation does not duplicate unlock;
- unlocked stock is unlimited in Game Layer;
- every Core-bound addition is finite and positive;
- Infinity/NaN/non-finite mass, volume, amount are rejected;
- save/load preserves starter/discovery/encyclopedia/inventory state;
- starter-set revisions do not silently rewrite existing entitlement.

Unknown identity:

- normal projection does not leak species key/name/formula/graph before confirmation;
- visible phase/macroscopic observations alone do not unlock;
- analyzer confirmation permits identity-bearing views only after the authoritative event;
- Phase Diagram cannot act as an identity oracle.

Thermal/phase:

- no normal command directly overwrites authoritative temperature;
- heater/cooler use finite power requests;
- thermostat target does not bypass the 02 thermal model;
- thermal ledger components stay distinguishable;
- phase cannot be selected directly by normal Game/UI commands;
- SI boundaries remain K, Pa, m^3, J, W, s as applicable.

Replay/isolation:

- supported identical initial state + seed + command stream + stepping policy reproduces deterministic behavior subject to Core guarantee;
- archival replay does not mutate progression by default;
- overlay metadata does not affect chemistry;
- Developer Mode changes access/visibility only;
- normal and Developer runs with identical physical inputs produce identical chemistry when debug forced-state actions are excluded;
- Standard/Premium entitlement never changes chemistry/discovery rules.

Scientific accuracy remains governed by `REAL_EXPERIMENT_VALIDATION.md`; 04 does not redefine scientific thresholds.

## Completed
- Rechecked production main `1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1` and all required HQ docs.
- Reviewed latest public 01/02/03 PR contracts as non-production references.
- Replaced separate Sandbox/Objective mode semantics with single normal game + overlays.
- Closed unlocked inventory economy semantics as unlimited stock per HQ.
- Defined typed progression, discovery, encyclopedia, inventory, and starter-set contracts.
- Defined finite-only material dispatch despite unlimited stock.
- Aligned phase ownership to Simulation/Thermodynamics.
- Defined Heater/Cooler/Thermostat commands and prohibited normal direct SetTemperature mutation.
- Defined thermal observation/ledger fields without implementing thermodynamic calculations.
- Defined Phase Diagram selection/disclosure contract.
- Defined unknown -> identified -> discovery typed flow.
- Updated Experiment Record and replay model; deprecated sandbox/objective mode field.
- Defined Developer Mode boundary.
- Defined 05 and 06 handoffs.
- Opened PR #6 for this documentation alignment.

## PASS / FAIL / OPEN
### PASS — contract alignment
- PASS: single normal game + overlay matches HQ.
- PASS: discovery -> encyclopedia -> inventory matches HQ.
- PASS: unlimited stock is isolated to Game Layer and Core inputs stay finite.
- PASS: starter-set membership can change without schema redesign.
- PASS: phase is simulation-owned.
- PASS: thermal controls operate through energy/power semantics.
- PASS: unknown identity is protected until valid confirmation.
- PASS: experiment records cover required commands, thermal controls, analysis/discovery, histories, versions, and replay metadata.
- PASS: Developer Mode bypass is isolated from chemistry/progression.
- PASS: explicit 05/06 handoffs are defined.

### FAIL
None identified at contract level.

### OPEN
- exact starter species/equipment set;
- analyzer/identity-confirmation rules by chemistry capability;
- final serialization form for maps/sets;
- final merged 01 identity/event type names;
- final merged 02 thermostat limits and thermal-ledger sign conventions;
- final latent-heat implementation tier and phase-transition integration ordering;
- exact pressure/volume apparatus semantics;
- MVP/Core species with validated Phase Diagram support;
- unidentified mixture/component-count disclosure policy without identity leakage;
- objective/challenge reward details;
- archival replay vs re-run-as-new UX semantics;
- runtime implementation and 06 validation;
- PR #4 UI reconciliation before integration.

## Next Actions
1. 05: update provider/view-model contracts for progression gating, anonymous unknowns, physical thermal controls, and phase ownership.
2. 06: implement the validation matrix above plus SI and replay checks.
3. Rebind 04 conceptual types to final production names after PR #1/#3/#5 stabilize/merge rather than duplicating parallel types.
4. 07: integrate in an order that prevents stale UI/mock contracts from becoming production assumptions.
