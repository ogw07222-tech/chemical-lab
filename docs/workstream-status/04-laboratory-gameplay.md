# 04 — Laboratory Gameplay

- Owner: Lead Laboratory Gameplay Designer / Chemistry Sandbox Systems Designer / Progression Designer / Experiment Gameplay Developer
- Current phase: Phase 0 — Architecture
- Overall state: CONTRACT_ALIGNED
- Last updated: 2026-09-10
- Last checked main SHA: `1a4e53ea78234cff02ee94ca6f0b4752a8ab4fa1`
- Active branch: `docs/04-gameplay-alignment`
- Active PR: none

## Current Objective
Align the Laboratory Gameplay contract with the current HQ source of truth for single-mode progression, discovery-gated inventory, physical phase ownership, energy-based thermal controls, unknown-species observation, deterministic experiment records, and Developer Mode isolation. This is a Game Layer contract task only; chemistry outcome logic is not implemented here.

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

Parallel public contracts reviewed as references only, not production source of truth:

- PR #1 — 01 Molecular / Reaction Core contract
- PR #5 — 02 Thermodynamics / Phase / Thermal contract
- PR #3 — 03 Chemistry Data contract

The unmerged PR contracts are used only to avoid incompatible Game Layer assumptions. Their exact types remain provisional until merged/integrated.

## Canonical Core Gameplay Loop
There is one normal game.

Canonical loop:

`choose unlocked material -> add finite amount -> configure apparatus/conditions -> run -> observe -> analyze -> confirm identity -> SpeciesDiscovery -> EncyclopediaUnlock -> InventoryUnlock -> unlimited reuse`

Tutorials, objectives, guided experiments, challenges, and achievements are overlays on this same game state and command model. They may constrain a particular task setup or evaluate player actions, but they do not create a second chemistry mode or alternate simulation rules.

The earlier separate `Sandbox Mode` / `Objective Mode` proposal is deprecated and must not be reintroduced without a new 00 HQ decision.

## Gameplay Session / Overlay Contract
The Game Layer should distinguish chemistry state from optional guidance overlays.

```ts
export interface LaboratoryGameState {
  progression: PlayerProgressionState;
  activeExperiment?: ExperimentRecordRef;
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

`GameplayOverlayState` must not be visible to Simulation Core as a chemistry modifier. It can only constrain commands at the Game Layer boundary or evaluate observations/results after the simulation runs.

## Typed Progression State
Recommended Phase 0 Game Layer types:

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
  scientificStatus?: "VERIFIED" | "APPROXIMATED" | "EMPIRICAL" | "GAMEPLAY_SIMPLIFICATION" | "OPEN";
}

export interface EncyclopediaEntryState {
  speciesKey: SpeciesKey;
  unlocked: true;
  firstDiscoveryExperimentId: ExperimentId;
  relatedExperimentIds: readonly ExperimentId[];
  firstDiscoveryOrder: number;
}

export interface InventoryUnlockState {
  unlockedSpecies: ReadonlySet<SpeciesKey>;
  stockSemantics: "UNLIMITED_UNLOCKED";
}
```

Implementation may use arrays/records instead of `ReadonlySet` for serialization. The semantic invariant matters: starter species plus confirmed discoveries define normal selectable inventory.

Progression state stores entitlement/unlock identity, not physical vessel amount.

## Starter Material Contract
The exact starter species list remains OPEN, but saves must not depend on hardcoded display names or on a globally fixed list that cannot evolve.

Recommended typed contract:

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

- starter identity uses stable species keys;
- exact species membership is content/HQ policy and remains OPEN;
- a save records the entitlement it was created with so later starter-set tuning does not silently rewrite old progression;
- migration may explicitly grant/remove content only under a versioned save migration policy;
- starter status does not alter chemistry behavior.

## Discovery -> Encyclopedia -> Inventory Contract
Authoritative normal-play state transition:

`IdentityConfirmedEvent -> SpeciesDiscovery(first only) -> EncyclopediaUnlock -> InventoryUnlock`

A species merely existing in Simulation Core state does not count as discovered.

Duplicate confirmation:

- may append experiment/history references;
- must not create a second first-discovery event;
- must not duplicate inventory unlock state.

The Game Layer should process the discovery transition atomically from the player's point of view so 05 does not show encyclopedia-unlocked but inventory-locked intermediate states unless a deliberate animation is purely presentational.

## Unlimited Unlocked Inventory Semantics
Once a species is a starter or inventory-unlocked, its normal laboratory stock is unlimited.

This is a Game Layer entitlement rule only.

There is no normal-play consumable stock counter and no depletion/replenishment loop.

Every command that moves material into a simulation vessel must still resolve to finite SI physical values before reaching Simulation Core.

```ts
export interface AddUnlockedMaterialCommand {
  kind: "AddUnlockedMaterial";
  commandId: string;
  vesselId: string;
  speciesKey: SpeciesKey;
  amountMol: number;
}
```

Required validation before dispatch:

- species is starter/unlocked, unless Developer Mode bypass applies;
- `amountMol` is finite;
- `amountMol > 0`;
- equipment/vessel limits permit the request;
- derived mass/volume inputs, when explicitly represented, are finite;
- no `Infinity`, `-Infinity`, `NaN`, sentinel huge-number stock value, or unlimited quantity token crosses into Simulation Core.

Mass and volume may be derived downstream from amount/composition/data where appropriate. If Game Layer records them, they remain finite SI values (`kg`, `m^3`) and must not become independent contradictory authoritative quantities.

The previous OPEN item about finite-resource economy semantics is CLOSED by the canonical HQ contract: unlocked normal inventory uses unlimited stock. A future finite-resource economy requires an explicit 00 contract revision.

## Vessel Interaction Alignment
Gameplay may request apparatus changes, but physical state remains authoritative outside the UI/Game Layer.

Game Layer may track/control:

- requested material additions/transfers;
- apparatus configuration;
- mixing control request;
- heater/cooler/thermostat control state;
- pressure/volume apparatus controls where supported;
- electrodes/catalysts as apparatus/material inputs;
- run/pause/step/simulation-speed requests;
- sampling and analysis commands.

Game Layer reads but does not authoritatively choose:

- chemical products;
- reaction pathway/family result;
- reaction rates/equilibrium;
- temperature evolution;
- pressure consequence;
- phase;
- reaction heat;
- phase-change heat.

All authoritative physical values use canonical SI: mol, kg, K, Pa, m^3, J, W, s, V, A, mol/m^3.

## Physical Phase Ownership
Player-facing material selection must not contain a normal control such as `choose solid/liquid/gas` for a species.

Phase is derived/evaluated from current physical state and models, including at least:

- species identity;
- temperature;
- pressure;
- composition/environment;
- supported mixture/solvent state when available.

Gameplay consumes phase for:

- visible vessel state;
- apparatus compatibility;
- sampling/analysis compatibility;
- observation text/events;
- phase-diagram current-state marker;
- experiment records.

Gameplay must not rewrite phase merely to satisfy an objective or make a material easier to add. If an apparatus workflow requires a desired phase, the player reaches it by changing physical conditions or selecting an appropriate supported preparation/setup.

## Thermal Gameplay Contract
The old generic `Heat` / `Cool` concept should be refined into explicit apparatus-control commands. Normal gameplay must not expose `SetTemperature` as an instantaneous authoritative state mutation.

Recommended command names:

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

If 02's final merged contract requires controller power limits as explicit Game Layer inputs, the thermostat configuration can extend with finite `maxHeatingPowerW` / `maxCoolingPowerW` or reference an apparatus capability that owns those limits.

Rules:

- heater supplies energy over simulation time;
- cooler removes energy over simulation time;
- thermostat controls external heat exchange toward a target;
- thermostat does not overwrite `temperatureK`;
- reaction heat remains visible to the thermal model;
- phase transition energy remains separate when modeled;
- all power/temperature inputs are finite SI values;
- apparatus limits may reject/clamp requests using an explicit command result rather than silently changing chemistry.

Exact physical integration, heat capacity, latent heat, environment heat transfer, and thermostat controller algorithm belong to 02.

## Thermal Observation / Energy Ledger Projection
04 should not calculate thermodynamics. It should define observation/log fields capable of consuming authoritative 02 outputs.

Recommended projection:

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
  scientificStatus?: "VERIFIED" | "APPROXIMATED" | "EMPIRICAL" | "GAMEPLAY_SIMPLIFICATION" | "OPEN";
}
```

Preferred semantics:

- `heaterEnergySuppliedJ`: cumulative/nonnegative energy added by heater;
- `coolerEnergyRemovedJ`: cumulative/nonnegative magnitude removed by cooler;
- `thermostatEnergyExchangedJ`: signed, if 02 adopts the proposed signed ledger; positive into vessel, negative out;
- `reactionHeatContributionJ`: authoritative reaction thermal contribution;
- `phaseChangeHeatJ`: separate latent/phase-transition contribution under 02's final sign convention;
- environment heat remains separable when modeled.

04/05 must not infer any of these by numerically differentiating temperature unless explicitly labeled as a display-only estimate. The preferred source is the simulation thermal energy ledger.

## Phase Diagram Interaction Contract
Phase Diagram rendering belongs to 05; gameplay owns selection context and disclosure policy.

Allowed normal-game targets:

```ts
export type PhaseDiagramTarget =
  | { source: "inventory"; speciesKey: SpeciesKey }
  | { source: "encyclopedia"; speciesKey: SpeciesKey }
  | { source: "vessel-selection"; speciesKey: SpeciesKey; vesselId: string };
```

Rules:

- inventory target requires starter/unlocked species;
- encyclopedia target requires the species identity to be legitimately known/unlocked;
- vessel target requires that the Game Layer is allowed to reveal that species identity at the current observation state;
- unknown vessel species cannot use phase-diagram lookup to leak identity;
- phase diagram is an information/analysis surface, not a phase control;
- current T/P marker may track vessel state for a known selected species;
- if data/model quality is insufficient, show limited/approximate/unavailable state rather than fabricated precise boundaries;
- 02/03 own diagram data/model and scientific status; 05 owns rendering.

## Unknown Species Observation Contract
The Game Layer must prevent hidden Simulation Core identity from leaking through ordinary UI state before valid confirmation.

Recommended typed projection:

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
    | {
        kind: "identity-confirmed";
        speciesKey: SpeciesKey;
        confidence?: number;
      }
    | {
        kind: "identity-unresolved";
        candidateCountHint?: number;
      };
}

export interface IdentityConfirmedEvent {
  eventId: string;
  speciesKey: SpeciesKey;
  experimentId: ExperimentId;
  analysisResultId: string;
  simulationTimeS: number;
}
```

Projection rule:

`authoritative hidden SpeciesState -> normal observation projection -> UnknownSubstanceObservation`

Only after an approved identity channel:

`AnalysisResult(identity-confirmed) -> IdentityConfirmedEvent -> SpeciesDiscovery -> EncyclopediaUnlock -> InventoryUnlock`

Normal UI must not receive hidden `speciesKey`, name, formula, molecular graph, exact reaction candidate, or debug metadata through an unknown observation object. Internally, the Game Layer may need a non-player-visible correlation token, but it must not be exposed through 05's normal view model.

A visible macroscopic phase may be shown for an unknown material if legitimately observable/supported, but this must not identify the compound by itself.

## Experiment Record Contract
`mode: sandbox | objective` is deprecated and must not be required in new experiment records.

Recommended record:

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

Required preserved facts include:

- experiment ID;
- simulation seed and simulation/data/Game Layer versions;
- canonical initial setup;
- every finite material addition/transfer relevant to replay;
- ordered commands;
- simulation timestamps;
- heater power changes;
- cooler power changes;
- thermostat enable/disable/target changes;
- analysis/sample actions;
- identity confirmation and discovery events;
- resulting species in authoritative save/debug state as permitted, plus player-visible identified/unknown observations separately;
- remaining species/state as required for save/replay;
- key temperature/pressure history references;
- deterministic replay metadata;
- optional overlay context for tutorial/objective/challenge history.

`overlayContext` is metadata only and never switches simulation rules.

### Recorded finite material addition

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

All numeric physical fields must be finite. Replay must reject invalid infinite/non-finite material values rather than normalize them.

## Save / Replay Alignment
Replay remains command-driven, not video-driven.

Minimum deterministic bundle:

- schema version;
- initial authoritative setup/snapshot or canonical constructor inputs;
- simulation seed;
- Simulation Core version/compatibility ID;
- Chemistry Data version/hash;
- Game Layer command schema version;
- ordered commands;
- simulation-time timestamps/sequence IDs;
- thermal apparatus control changes;
- stepping policy where required;
- optional checkpoints/hashes for divergence detection.

Progression state and experiment replay should be separable:

- experiment replay reconstructs chemistry/experiment behavior;
- player save reconstructs discovery/encyclopedia/inventory entitlement state.

Replaying an old experiment in normal play must not silently award historical discoveries again unless the replay is explicitly treated as a new live experiment under progression rules. Default archival replay should be non-progression-mutating.

## Developer Mode Boundary
Developer Mode is the only canonical all-access bypass.

```ts
export interface DeveloperModeState {
  enabled: boolean;
  context: "normal" | "developer" | "validation";
}
```

Developer capabilities may include:

- browse/spawn all supported species;
- bypass normal discovery/inventory entitlement checks;
- inspect hidden species identities and raw Simulation Core state;
- inspect reaction candidates/pruning diagnostics;
- force test setups/states;
- access validation fixtures.

Boundaries:

- Developer Mode does not alter thermodynamics, kinetics, conservation, phase, or chemical outcomes;
- bypass means access/observability only;
- Developer Mode saves/runs must be clearly marked so they cannot contaminate normal progression/achievement claims by accident;
- Premium is not Developer Mode and cannot receive all-species bypass;
- Developer material spawning still sends finite physical amounts to Simulation Core.

## Safety / Gameplay Abstraction
Potentially dangerous conditions may be represented through non-graphic, educational abstractions such as:

- warning state;
- apparatus operating-limit warning;
- containment-failure abstraction;
- experiment abort/simulation termination;
- damaged/unavailable apparatus state if later useful for gameplay.

The game must not provide operational tutorials for acquiring, preparing, concentrating, or handling real dangerous substances. Safety feedback should describe simulation state and apparatus limitations at a high level rather than teaching real-world hazardous procedures.

## 05 — Web UI Handoff
05 should align normal UI around these information requirements:

1. One normal game; no Sandbox/Objective chemistry-mode selector.
2. Tutorials/objectives/challenges appear as optional overlays/panels.
3. Inventory lists starter + unlocked species only.
4. Unlocked stock is shown as unlimited; amount input means finite quantity to add now, not remaining stock.
5. No phase selector for normal material addition.
6. Thermal controls expose heater power, cooler power, and optional thermostat target/controller state rather than an instantaneous temperature setter.
7. Unknown species use anonymous observation/view models until identity confirmation.
8. Discovery feedback atomically connects confirmation -> encyclopedia -> inventory unlock.
9. Phase Diagram is available only for identity-known eligible targets and never acts as a phase-control surface.
10. Experiment history can display control changes, analyzer actions, discoveries, T/P series, and thermal-energy ledger fields when available.
11. Developer-only all-species/debug views are visually and structurally separated from normal gameplay.
12. All convenient displayed units convert through typed adapters; authoritative gameplay/simulation records stay SI.

PR #4's current UI scaffold predates this complete alignment and should be reconciled before production integration, especially around unrestricted mock catalog exposure, thermal controls, phase ownership, and normal-mode progression.

## 06 — Validation Requirements
06 should add/retain tests for the following before this contract is considered production-validated:

### Progression / inventory
- undiscovered non-starter species cannot be selected in normal inventory;
- hidden simulation existence alone does not unlock identity;
- first valid identity confirmation emits one first-discovery transition;
- confirmation produces encyclopedia + inventory unlock exactly once;
- duplicate confirmations do not duplicate unlocks;
- unlocked stock is unlimited at Game Layer;
- every vessel addition remains finite and positive;
- `Infinity`, `NaN`, and non-finite mass/volume/amount are rejected before Core dispatch;
- save/load preserves starter/discovery/encyclopedia/inventory state;
- starter-set revision does not silently rewrite existing save entitlement.

### Unknown identity
- normal observation projection does not leak species key/name/formula/graph before identity confirmation;
- phase or visible macroscopic observations do not accidentally unlock species;
- analyzer confirmation switches subsequent allowed identity-bearing projections correctly.

### Thermal / phase
- no normal command directly overwrites authoritative temperature;
- heater/cooler commands operate through finite power requests;
- thermostat target does not bypass the 02 thermal model;
- energy ledger components remain distinguishable in experiment records;
- phase is simulation-owned and cannot be selected directly by normal Game/UI commands;
- phase-diagram interaction cannot be used to identify hidden species;
- SI unit boundaries are respected for K, Pa, m^3, J, W, s.

### Replay / mode isolation
- identical supported initial state + seed + command stream + stepping policy reproduces deterministic behavior subject to Core guarantee;
- archival replay does not mutate progression by default;
- overlay metadata does not change chemistry results;
- Developer Mode bypass changes access/visibility only, not chemistry outcomes;
- normal and Developer runs with the same physical initial state/commands produce the same chemistry when debug-only forced-state operations are excluded;
- Standard/Premium entitlements do not alter discovery or chemistry behavior.

Scientific accuracy thresholds remain governed by `REAL_EXPERIMENT_VALIDATION.md`; 04 does not redefine them.

## Dependencies / Handoffs to 01 / 02 / 03
### 01 — Simulation Engine
Required stable boundary:

- finite `amountMol` only;
- stable species identity keys;
- authoritative species state not polluted by inventory entitlement;
- phase state read-only from the Game Layer perspective;
- deterministic state/reaction event IDs needed for record/replay correlation;
- hidden species identity must be projectable without leaking to normal UI.

PR #1 publicly proposes these directions and is compatible with this gameplay contract, but remains unmerged.

### 02 — Thermodynamics & Kinetics
Required stable boundary:

- authoritative temperature/phase evaluation;
- heater/cooler/thermostat energy-control semantics;
- distinguishable reaction/heater/cooler/thermostat/environment/phase-change thermal contributions;
- phase diagram data/model boundary;
- phase-transition events where supported;
- apparatus/controller limit semantics.

PR #5 publicly proposes an explicit thermal energy ledger and bounded thermostat model compatible with this gameplay contract, but remains unmerged. Exact sign conventions, controller limits, and latent-heat tier remain subject to 02/00 integration.

### 03 — Chemistry Data
Required stable boundary:

- stable species keys and validated display identity data;
- phase/thermal properties with provenance and scientific status;
- phase-boundary/triple/critical-point data where supported;
- no fabricated precision when phase data are incomplete.

PR #3 publicly proposes SI-normalized phase/thermal records and explicit missing-data behavior compatible with this gameplay contract, but remains unmerged.

## Completed
- Re-audited latest main and all required HQ canonical documents.
- Removed separate Sandbox/Objective chemistry-mode semantics from the active 04 contract.
- Closed the old unlocked-material quantity/economy OPEN item: unlocked normal inventory is unlimited by canonical HQ contract.
- Defined typed `PlayerProgressionState`, discovery, encyclopedia, inventory, and starter-material contracts.
- Defined finite-only unlimited-inventory dispatch semantics.
- Defined physical phase ownership and prohibited normal direct phase selection.
- Refined thermal commands to Heater / Cooler / Thermostat power/controller semantics.
- Defined thermal observation/energy-ledger projection requirements without calculating thermodynamics in 04.
- Defined Phase Diagram target/identity gating contract.
- Defined unknown -> analyzed -> identity-confirmed -> discovery typed flow.
- Updated Experiment Record and replay contract; deprecated `mode: sandbox/objective`.
- Defined Developer Mode bypass/isolation boundary.
- Defined 05 UI handoff and 06 validation requirements.
- Reviewed public contracts from latest 01/02/03 PRs as non-production references.

## Validation Evidence / Verdict
This task is a contract/design audit. No chemistry runtime implementation changed, so no scientific or runtime PASS is claimed.

### PASS — contract alignment
- PASS: single normal game + overlay model matches current HQ contract.
- PASS: discovery -> encyclopedia -> inventory transition matches canonical progression.
- PASS: unlimited unlocked stock is isolated to Game Layer; finite physical amounts are required at Core boundary.
- PASS: starter-material membership can change without schema redesign.
- PASS: phase is simulation-owned and cannot be a normal player-selected property.
- PASS: thermal controls are energy/power based rather than direct temperature overwrite.
- PASS: unknown-species identity is protected until legitimate confirmation.
- PASS: experiment records can preserve finite additions, thermal commands, analysis/discovery events, T/P history references, and deterministic replay metadata.
- PASS: Developer Mode bypass is isolated from normal progression and from chemistry rules.
- PASS: 05 and 06 receive explicit handoff requirements.

### FAIL
- None identified at contract level after this alignment.

### OPEN
- exact `StarterMaterialSet.speciesKeys` and starter equipment list;
- exact analyzer/identity-confirmation requirements by chemistry capability;
- final canonical serialization representation for progression maps/sets;
- final merged 01 species/event types and stable identity naming;
- final merged 02 thermostat controller limits/sign conventions;
- final 02 latent-heat implementation tier and phase-transition integration behavior;
- exact apparatus semantics for pressure and volume control;
- exact set of species with usable Phase Diagram support at MVP/Core Release;
- exact policy for showing unidentified mixture/component counts without leaking identity;
- objective/challenge reward details;
- archival replay vs "re-run as new experiment" UX semantics;
- runtime validation implementation in 06;
- reconciliation of PR #4 UI scaffold with this canonical contract before integration.

## Next Actions
1. 05 should update its UI-facing provider/view-model contract to enforce progression, unknown identity, thermal controls, and phase ownership.
2. 06 should implement contract tests listed above plus SI/replay checks.
3. After PR #1/#3/#5 stabilize or merge, rebind 04's conceptual types to their canonical production names rather than duplicating types.
4. 07 should integrate 04 documentation with 01/02/03/05 in an order that preserves the final shared contracts and prevents stale mock interfaces from becoming production assumptions.
