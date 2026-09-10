# 04 — Laboratory Gameplay

- Owner: Lead Laboratory Gameplay Designer / Chemistry Sandbox Systems Designer / Progression Designer / Experiment Gameplay Developer
- Current phase: Phase 0 — Architecture
- Overall state: CONTRACT_DEFINED
- Last updated: 2026-09-10
- Last checked main SHA: f6513bd6cefc7df5b16d1f678a4cf1b443859e94
- Active branch: main
- Active PR: none

## Current Objective
Define the Phase 0 laboratory gameplay contract: the game-layer state, player commands, instruments, observation policy, discovery/progression rules, and deterministic save/replay boundary needed to turn the Simulation Core into an exploratory laboratory sandbox without embedding chemistry outcomes in gameplay logic.

## Core Gameplay Loop

Canonical loop:

1. Select material/species from available laboratory inventory.
2. Add or transfer material into a reaction vessel.
3. Configure controllable conditions such as temperature target, vessel volume, applied pressure, mixing, electrodes, voltage/current request, or catalyst presence.
4. Advance simulation time.
5. Observe instrument readings and externally observable events.
6. Take a sample and/or run an analysis instrument.
7. Record products, remaining species, conditions, and observations in the experiment log.
8. Clone or reset the experiment, change one or more conditions, and compare outcomes.

The Game Layer never selects reaction products, reaction pathways, reaction rates, equilibrium positions, or thermodynamic direction. Those are Simulation Core responsibilities.

A core design requirement is cheap A/B experimentation. The player should be able to duplicate an experiment state or setup, change one condition, and compare results without manually rebuilding the full experiment.

## Vessel Interaction Contract

### Gameplay Vessel State

The Game Layer should reference one or more `LaboratoryVesselState` objects. The state exposed across the Game Layer / Simulation Core boundary should support at least:

- `vesselId`: stable vessel identifier.
- `capacity`: physical vessel capacity limit supplied by equipment definition.
- `contents`: species/material entries currently in the vessel.
  - stable species identifier
  - amount, preferably normalized to a simulation-supported physical quantity
  - phase or phase distribution when supported by Simulation Core
- `volume`: current vessel/system volume.
- `temperature`: current temperature state from Simulation Core.
- `pressure`: current pressure state from Simulation Core.
- `concentrations`: derived simulation values when meaningful for the phase/system; not authoritative Game Layer state.
- `energyState`: opaque or structured Simulation Core energy information sufficient for instruments and logging; Game Layer must not recalculate reaction energetics.
- `mixingState`: gameplay-controlled mixing request/state.
- `boundaryState`: open/closed/sealed and any simulation-relevant vessel boundary conditions.
- `electrodes`: optional installed electrode descriptors/references.
- `electricalControl`: optional requested voltage/current mode and setpoint, subject to Simulation Core support.
- `catalysts`: optional catalyst species/material references present in or coupled to the vessel.
- `simulationTime`: deterministic simulation clock associated with this vessel/run.
- `simulationStatus`: stopped, paused, running, stable/equilibrated when Core can determine it, or error/unsupported.

### Authority Rules

- Substance identity, amounts supplied by a command, and equipment configuration are Game Layer inputs.
- Temperature, pressure, concentration, phase evolution, energy evolution, products, remaining species, and reaction progress are Simulation Core outputs after transition.
- `concentration` should normally be derived from authoritative amount/volume/phase state rather than independently mutated by gameplay.
- `phase` must not be manually selected as a gameplay convenience when the Simulation Core can determine it from state/conditions.
- `energyState` is not a player-editable scalar. Heating/cooling commands provide energy-transfer intent or a target/control request; the Core resolves physical state change.
- Electrodes and catalysts are configuration/material inputs only. Gameplay must not encode their chemical effect.

### Inventory Boundary

Inventory represents what material the player can request for laboratory use; it is not a chemistry database. A material entry should contain a stable reference to a Simulation/Core/Data species/material definition plus gameplay metadata such as unlocked/available status and container quantity.

Progression may control convenient access to materials/equipment in Objective mode, but Sandbox mode should not alter chemistry behavior based on unlock state.

## Player Command Contract

All meaningful laboratory interactions should be represented as explicit, serializable commands. Commands should be timestampable, replayable, validated before execution, and produce either a deterministic accepted transition request or a structured rejection.

Minimum Phase 0 command set:

### Material Handling

- `AddSubstance`
  - vessel ID
  - species/material ID
  - amount
  - source inventory/container reference where relevant

- `RemoveSubstance`
  - vessel ID
  - requested amount or sampling amount
  - species selection only when physically/gameplay-valid; otherwise removal may be bulk material extraction

- `Transfer`
  - source vessel/container
  - destination vessel/container
  - amount or fraction
  - transfer mode if later required

- `Mix`
  - vessel ID
  - start/stop or mixing intensity request

### Environment / Energy

- `Heat`
  - vessel ID
  - control mode such as energy-input request, power request, or temperature-target request
  - requested value

- `Cool`
  - same contract shape as heating, representing an energy-removal/control request

- `ChangeVolume`
  - vessel ID
  - target volume or controlled volume-change request

- `ApplyPressure`
  - vessel ID
  - external pressure/control target when equipment permits

### Electrochemistry / Catalysis

- `InsertElectrode`
  - vessel ID
  - electrode equipment/material reference
  - optional role/terminal metadata required by later electrochemistry contracts

- `RemoveElectrode`

- `ApplyVoltageCurrent`
  - vessel ID
  - control mode: voltage or current
  - requested setpoint
  - explicit off state

- `AddCatalyst`
  - represented through material addition plus catalyst-role metadata only when needed for UI/gameplay; the chemical effect remains Core-owned

### Time / Analysis

- `AdvanceSimulation`
  - vessel ID or experiment context
  - requested simulated duration or run-until policy
  - optional deterministic stepping policy supplied by Core contract

- `PauseSimulation`

- `TakeSample`
  - source vessel
  - sample amount
  - destination sample container

- `AnalyzeSample`
  - sample/vessel reference
  - instrument ID/type
  - requested measurement mode supported by that instrument

### Command Result Envelope

Each command should return a structured result with:

- command ID
- accepted/rejected
- rejection reason or capability limitation
- resulting authoritative simulation snapshot/reference when state changed
- generated gameplay observations/events, if any
- simulation time before/after

The command API must not return invented chemistry to make an action feel responsive. Unsupported physical models must be surfaced as `OPEN`, unsupported, or simplified at an explicitly classified boundary.

## Instrument Model

Instruments are information gates. They transform authoritative Simulation Core state into player-visible observations with a defined measurement capability; they do not determine chemistry.

### MVP Instruments

1. **Thermometer**
   - Displays vessel temperature.
   - MVP may use idealized instantaneous readings unless later uncertainty/noise is valuable.

2. **Pressure Gauge**
   - Displays vessel pressure when meaningful and when connected to an appropriate vessel.

3. **Balance**
   - Measures mass of a container/sample/material if mass is derivable from authoritative species amounts/data.
   - Must not infer hidden composition from mass alone.

4. **Volume Measurement**
   - Displays vessel/sample volume.
   - Initial MVP can treat vessel calibrated volume as directly readable equipment state.

5. **Gas Detection / Gas Analysis**
   - Reports detected gaseous species or a capability-limited subset.
   - Exact quantitative composition should require analyzer capability rather than being globally visible by default.

6. **Substance Analyzer**
   - MVP abstraction for composition analysis.
   - Reports detected species and, where supported, approximate or quantitative amount/concentration.
   - This is intentionally an abstract educational instrument at Phase 0; later versions may split it into spectroscopy, chromatography, pH, conductivity, etc.

### Recommended Early Addition

7. **pH Meter**
   - Add when acid-base chemistry is supported by the Simulation Core.
   - Do not expose pH before the underlying model exists.

### Instrument Capability Schema

Each instrument definition should support:

- instrument ID/type
- compatible target types: vessel, gas headspace, liquid sample, solid sample, etc.
- observable fields
- qualitative vs quantitative output
- precision/uncertainty policy
- sampling requirement
- destructive/non-destructive analysis flag
- supported simulation capability/version

Phase 0 should avoid fake precision. Measurement uncertainty can initially be idealized, but UI/logging should leave room for `VERIFIED`, `APPROXIMATED`, `EMPIRICAL`, `GAMEPLAY SIMPLIFICATION`, and `OPEN` confidence/quality labels.

## Observation Model

### Principle

The player should observe the laboratory, not the engine debugger.

Simulation state and player observation are separate models:

`SimulationState -> Instrument/Observable Projection -> ObservationRecord -> UI`

The UI must not directly bind to every internal Simulation Core variable.

### Always/Directly Observable Gameplay Information

Reasonable direct equipment/state information for MVP:

- vessel identity and capacity
- whether vessel is open/sealed
- control settings currently requested by player
- elapsed simulation time
- visibly present macroscopic phase categories when the Core exposes them safely as observable state

### Instrument-Gated Information

- temperature -> thermometer
- pressure -> pressure gauge
- mass -> balance
- exact volume -> calibrated vessel/volume instrument
- pH -> pH meter when supported
- gas production/composition -> gas detector/analyzer
- detected substances -> substance analyzer
- quantitative concentration/composition -> suitable analyzer
- reaction-rate estimate -> derived from repeated observations/time-series analysis, not a raw internal kinetic constant by default

### Observable Events

The Game Layer may convert Core-supported macroscopic events into educational, non-graphic observations, for example:

- gas evolution detected
- temperature rising/falling
- pressure rising/falling
- phase appearance/disappearance
- precipitate/solid formation when the Core can support that interpretation
- detectable composition change
- electrical response when supported

The Game Layer must not infer named reaction products from visual effects alone. Named substances require an analysis result or another explicitly justified observation channel.

### Hidden/Internal by Default

Do not expose by default:

- reaction-candidate lists
- pruning scores
- exact activation barriers
- internal solver scores
- hidden pathway rankings
- exact equilibrium solver internals
- atom-mapping/debug graphs
- RNG state

These may exist in developer/debug tooling but not normal gameplay.

## Experiment Log

Every experiment run should have an immutable or append-oriented `ExperimentRecord` sufficient for later comparison and replay.

Minimum structure:

- `experimentId`
- name/optional player notes
- mode: sandbox/objective
- engine/data/game version metadata
- initial vessel/equipment setup
- initial inventory/material inputs relevant to the run
- simulation seed/replay metadata
- ordered command stream
- action timestamps in simulation time and optionally wall-clock UI time
- instrument measurements/time series
- observed events
- analysis results
- final products/detected species as observations plus authoritative final state reference where save format permits
- remaining species/material state
- run duration
- confidence/approximation labels attached to relevant observations
- parent experiment ID when cloned from another experiment
- comparison tags/group ID

### Comparison Contract

A comparison is a Game Layer object referencing two or more experiment records and should compute/display deltas only from observed or explicitly selected state fields.

Useful comparison dimensions:

- changed input amounts
- changed temperature/pressure/volume controls
- catalyst/electrode/control differences
- time to observed event
- measured gas production
- measured composition/product distribution when analyzer data exists
- final remaining species

The comparison system should highlight which setup/commands differed but must not claim causal chemistry beyond what the simulation and observations support.

## Discovery / Progression Model

### Discovery Types

Phase 0 discovery should be event-based and observation-based rather than recipe-based.

Potential discovery records:

- `SpeciesDiscovery`: first confirmed detection/analysis of a species.
- `ReactionFamilyDiscovery`: first Core-classified reaction-family occurrence that becomes observable/confirmable to the player.
- `ConditionEffectDiscovery`: first meaningful comparison showing that changing a condition changed an observed outcome.
- `InstrumentDiscovery`: optional first successful use/measurement category.
- `EncyclopediaUnlock`: knowledge entry unlocked by a qualifying discovery.

### Species Discovery Rule

A molecule/species should not unlock merely because it existed invisibly in Simulation Core state. Default rule: unlock after player confirmation through a valid analyzer/measurement or an explicitly observable identity channel.

### Reaction Family Discovery Rule

The Game Layer consumes a Core-provided reaction-family/event classification if available. It does not infer the family from hand-authored reaction recipes.

### Condition Effect Discovery

This should be conservative in MVP. A discovery may trigger when two related experiments differ in a controlled input and exceed a Core/analysis-supported observable difference threshold. It should be labeled as an observed condition effect, not universal causation.

### Encyclopedia

The encyclopedia should store discovered knowledge, not override Simulation Core rules. Entries can include:

- formula/name where available
- discovered observations
- player experiment links
- known phase/measurement information from validated data where appropriate
- reaction-family associations revealed through play
- confidence/quality metadata

### Progression Policy

Progression must never change fundamental chemistry or make reactions possible/impossible solely because of player level.

Allowed progression gates:

- access to more convenient equipment
- higher-capability instruments
- additional laboratory workspace/vessels
- saved experiment slots or organizational features if desired
- curated objective sets
- encyclopedia/contextual knowledge presentation
- convenience access to more materials in Objective mode

Disallowed progression gates:

- changing reaction direction/rate/product to reward progression
- hidden bonuses to thermodynamics/kinetics
- changing conservation rules
- making a molecule chemically unavailable when the player has physically equivalent inputs in unrestricted Sandbox mode

Sandbox should eventually provide an unrestricted or broadly unrestricted scientific playground. Objective mode may constrain starting materials/equipment as a challenge setup without modifying chemistry.

## Sandbox vs Objective Mode

**Decision: separate them at the Game Layer while sharing the exact same Simulation Core and laboratory command model.**

### Sandbox Mode

- exploration-first
- broad material/equipment access according to supported chemistry capabilities
- no required win condition
- free experiment cloning/comparison
- discoveries and encyclopedia can still progress
- chemistry never changes based on progression

### Objective Mode

- curated starting inventory/equipment/environment
- optional goals such as identify a product, compare two conditions, reach an observable state, or reproduce a qualitative phenomenon
- scoring, if any, evaluates experimental process/observations rather than secretly modifying simulation outcomes
- can teach instrument use and experimental reasoning

This separation prevents tutorial/progression constraints from contaminating the scientific sandbox contract.

## Save / Replay Contract

Replay should reconstruct an experiment from deterministic inputs rather than storing only a video-like history.

Minimum replay bundle:

- save/replay format version
- Game Layer version
- Simulation Core version/commit or compatibility version
- Chemistry Data version/hash
- deterministic simulation seed
- complete initial authoritative simulation state or a canonical setup specification capable of reproducing it
- equipment configuration
- ordered serializable command stream
- deterministic command sequence IDs
- simulation-time positions for each command
- Simulation Core timestep/stepping policy identifier when required for deterministic equivalence
- optional state checkpoints/snapshots for fast seeking
- optional observation cache for historical fidelity and migration diagnostics

### Replay Requirements

- Same compatible engine/data version + same initial state + same seed + same ordered commands + same stepping policy should reproduce the same authoritative state transitions.
- Randomness, if used by Simulation Core, must be seeded and deterministic.
- Replay commands must not rely on wall-clock scheduling.
- Snapshot checkpoints are an optimization, not the source of truth for command semantics.
- If engine/data changes invalidate exact replay, the system must report compatibility status rather than silently produce a different experiment under the same replay identity.

### Save Scope

A normal save may contain:

- current laboratory/session state
- vessel states
- inventory/progression/discoveries
- experiment records
- replay bundles/checkpoints

Simulation Core should own serialization rules for its authoritative chemistry state or provide a stable snapshot contract; Game Layer should not reverse-engineer Core internals.

## Safety / Gameplay Simplification

Hazards should be represented educationally and non-graphically. The game should not turn realistic hazardous-material handling into procedural training.

Phase 0 policy:

- represent unsafe conditions through abstract laboratory warnings, equipment limits, experiment termination, containment failure states, or non-graphic consequence indicators
- avoid detailed real-world acquisition, dosing, construction, or handling instructions for dangerous materials
- avoid rewarding hazardous experimentation for realism alone
- keep hazard simulation distinct from chemistry outcome calculation
- label deliberately abstracted hazard behavior as `GAMEPLAY SIMPLIFICATION`

This safety layer must not falsify ordinary chemistry. Where realistic hazard modeling would require operational detail inappropriate for gameplay, prefer an abstract boundary condition or warning state.

## Dependencies on 01 / 02 / 05

### 01 — Chemistry Simulation Engine

04 requires 01 to define or expose:

- stable species/material identifiers
- authoritative vessel-state schema
- amount/phase representation
- state transition interface for adding/removing/transferring material
- simulation-time advancement contract
- deterministic seed/step behavior
- product/remaining-species output
- macroscopic observable/event hooks where scientifically justified
- reaction-family classification/event identifiers if discovery is to use them
- snapshot/serialization compatibility contract

04 must not implement fallback chemistry when these are unavailable.

### 02 — Thermodynamics & Kinetics

04 requires 02/Core integration to expose player-relevant outputs through the Simulation Core boundary, including when available:

- temperature/pressure/energy evolution
- reaction progress/rate observables or stable derived signals
- equilibrium/stability indications suitable for gameplay
- catalyst/electrode/control effects as simulation outputs
- explicit approximation/confidence classification

04 must not calculate Arrhenius behavior, equilibrium shifts, electrochemical outcomes, or catalyst effects itself.

### 05 — Web UI

04 provides 05 with the information architecture and state requirements, not pixel-level layout.

05 should be able to render:

- vessel contents at an observation-appropriate level
- inventory/material selection
- equipment controls and current requested settings
- simulation run/pause/time state
- instrument list, compatibility, and readings
- experiment log timeline
- analysis results
- experiment clone/compare workflow
- discovery/encyclopedia notifications and entries
- Sandbox vs Objective context
- save/replay compatibility/status

05 must respect the observation model: UI should not bypass instruments by directly exposing hidden Core values.

## OPEN Questions

1. **Authoritative vessel schema** — exact 01 schema for amounts, multiphase contents, boundaries, and energy is not yet defined. `OPEN`.
2. **Control semantics** — whether heat/cool/pressure/volume commands are target controllers, power/flux inputs, direct boundary-condition changes, or multiple supported modes needs 00/01/02 contract agreement. `OPEN`.
3. **Mixing model** — whether mixing changes kinetics/spatial assumptions in MVP or is initially a semantic/no-op control pending later modeling. `OPEN`.
4. **Sampling semantics** — whether taking a sample must physically subtract material from the source vessel in all cases and how heterogeneous/multiphase sampling works. `OPEN`.
5. **Instrument uncertainty** — idealized exact instruments vs calibrated/noisy measurements for MVP. Recommendation: idealized-but-capability-limited first; avoid false decimal precision. `OPEN` pending 00.
6. **Reaction-family discovery hook** — Core event/classification interface not yet specified. `OPEN`.
7. **Condition-effect discovery thresholds** — requires stable observable metrics and validation before automatic discovery claims. `OPEN`.
8. **Exact replay contract** — seed is necessary but may not be sufficient unless timestep/pruning/order guarantees are explicitly defined by 01/02. `OPEN`.
9. **Electrode/electrical command capability** — architecture should reserve it now, but production behavior waits for electrochemistry support. `OPEN`.
10. **Hazard boundary model** — exact abstract hazard states/equipment limits can be designed later without exposing operational hazardous procedures. `OPEN`.

## PASS / FAIL / OPEN

### PASS

- **PASS — Layering contract:** Laboratory gameplay can be modeled entirely in the Game Layer without embedding chemistry outcomes, consistent with `UI -> Game Layer -> Simulation Core -> Chemistry Data`.
- **PASS — Core gameplay loop:** select -> add/transfer -> control conditions -> advance -> observe -> analyze -> log -> clone/compare is compatible with the project vision.
- **PASS — Command-driven interaction:** explicit serializable commands provide a clean deterministic/replayable laboratory interface.
- **PASS — Observation separation:** instrument-gated `ObservationRecord`s prevent UI from becoming an unrestricted Simulation Core debugger.
- **PASS — Discovery separation:** discovery can be based on confirmed observations/Core classifications without recipe hardcoding.
- **PASS — Progression integrity:** progression can unlock tools/context/objectives without modifying chemistry.
- **PASS — Mode separation:** Sandbox and Objective modes should share identical chemistry and commands while differing only in Game Layer constraints/goals.
- **PASS — Replay architecture:** initial state + compatible engine/data versions + seed + ordered commands + deterministic stepping metadata is the correct replay contract shape.
- **PASS — Safety direction:** hazards can be represented educationally and non-graphically without turning the game into dangerous real-world procedural instruction.

### FAIL

- **No current FAIL at Phase 0 contract level.** No chemistry implementation was changed or validated in this workstream.

### OPEN

- Exact vessel schema and state ownership details from 01.
- Exact thermodynamic/kinetic control semantics and observables from 02.
- Deterministic timestep/pruning/replay guarantees from 01/02.
- Final MVP instrument fidelity and measurement uncertainty policy.
- Sampling/mixing/electrochemistry capability details.
- Automatic condition-effect discovery thresholds.

## Completed

- Defined Phase 0 core laboratory gameplay loop.
- Defined reaction-vessel gameplay state and authority boundaries.
- Defined minimum serializable player command set.
- Proposed MVP instrument set and capability schema.
- Defined instrument-gated observation model.
- Defined experiment log and experiment comparison contracts.
- Defined discovery, encyclopedia, and non-distorting progression rules.
- Decided to separate Sandbox and Objective modes at the Game Layer while sharing one Simulation Core.
- Defined deterministic save/replay contract shape.
- Defined safety/gameplay simplification boundary.
- Identified explicit dependencies and OPEN cross-workstream contracts for 01/02/05.

## In Progress

None. Phase 0 gameplay contract is ready for HQ review and lower-layer interface reconciliation.

## Blockers / OPEN

The contract is implementable in shape but cannot be finalized at field/type level until 01 and 02 publish stable vessel, control, observation, and deterministic stepping contracts.

## Validation Evidence

Design/architecture validation only:

- Checked latest `main` at `f6513bd6cefc7df5b16d1f678a4cf1b443859e94` before work.
- Reviewed `PROJECT.md`, `AGENTS.md`, `ROADMAP.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`, and this workstream status file.
- Confirmed no chemistry calculation logic or UI pixel-level implementation was introduced.
- Confirmed proposed dependency direction preserves `UI -> Game Layer -> Simulation Core -> Chemistry Data`.
- No code tests were run because this task changed documentation/design only.

## Next Actions

1. Send vessel/control/replay interface requirements to 01 and 02 for reconciliation.
2. Have 00 resolve cross-system decisions: control semantics, sampling policy, instrument fidelity, and discovery thresholds.
3. After stable lower-layer contracts exist, convert this Phase 0 design into typed Game Layer interfaces and command schemas.
4. Hand the observation/information requirements to 05 for UI architecture without exposing hidden Simulation Core state.
5. Route future implemented gameplay contracts through 06 validation before production integration.

## Handoffs

### To 01 — Chemistry Simulation Engine
Define the authoritative vessel snapshot/state-transition/replay interface required by the Vessel Interaction and Player Command contracts above.

### To 02 — Thermodynamics & Kinetics
Define supported environment-control semantics and player-observable thermo/kinetic outputs, including approximation/confidence metadata.

### To 05 — Web UI
Use the Observation Model and Instrument Model as the UI information boundary. Do not bind normal gameplay directly to hidden Simulation Core values.

### To 00 — Chemistry Lab Game Design HQ
Review and decide the listed cross-system OPEN questions before typed implementation begins.
