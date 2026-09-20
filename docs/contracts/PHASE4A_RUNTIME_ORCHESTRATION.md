# Phase 4A Authoritative Runtime Timestep Orchestration

Status: IMPLEMENTED FOUNDATION / independent validation pending

Owners: 01/02 Runtime Integration

## Purpose

This contract defines the authoritative staged timestep that composes the already-existing reaction/equilibrium, Phase 4A-1 matter mutation, Phase 4A-2 gas transport, Phase 4A-3 thermal apparatus, and provider-projection boundaries.

It does not introduce a new chemistry, transport, thermal, pressure, or phase model.

Canonical implementation:

`src/integration/phase4a-runtime-orchestration.ts`

## Authoritative ordering

For one timestep:

1. validate and snapshot authoritative matter + thermal state;
2. evaluate reaction/equilibrium progression using the current temperature;
3. determine the actually applied reaction extent;
4. obtain the reaction species delta and signed reaction heat from that applied extent;
5. commit the reaction species result into the configured reaction compartment;
6. create one immutable post-reaction matter snapshot;
7. evaluate every enabled Phase 4A-2 gas connection from that same immutable snapshot;
8. commit the resulting transfer requests only through Phase 4A-1 `transferMatterBatch()`;
9. evaluate Phase 4A-3 contacts/reservoirs/actuators from the defined pre-thermal thermal snapshot;
10. supply the already-computed reaction heat as one `ThermalReactionSource`;
11. aggregate reaction + internal transfer + external apparatus energy exactly once;
12. commit all thermal-body updates;
13. preserve the Phase 4A-4 seam for future liquid-volume/headspace refresh;
14. compute final gas pressure facts from the post-transport gas inventory, final temperature, and current compartment volume;
15. publish one completed provider projection;
16. the next reaction timestep consumes the final vessel temperature and post-transport reaction-compartment inventory.

No intermediate half-state is published as a normal timestep result.

## Reaction heat exactly once

The pre-existing Phase 3 reaction path calls `applyReactionThermalCoupling()`, which internally calls `stepThermalState()`.

That legacy result remains useful for reaction-event heat annotation and backward-compatible Phase 3 behavior, but the Phase 4A orchestrator deliberately does **not** commit its returned thermal state.

The Phase 4A orchestrator consumes only:

- actually committed reaction progress events;
- `knownReactionHeat_J`;
- heat-coverage/scientific status.

That heat is then supplied exactly once to Phase 4A-3 as one `ThermalReactionSource`.

Therefore the authoritative Phase 4A temperature commit is owned by Phase 4A-3, not by the legacy Phase 3 reaction-only thermal state.

If committed reaction events have PARTIAL/OPEN heat coverage, the entire staged timestep returns OPEN and the input state remains unchanged. Missing reaction heat is never treated as zero.

## Matter ownership

Reaction progression owns reaction extent and the resulting reaction species state.

The orchestrator maps that authoritative result into one explicitly configured reaction compartment.

Phase 4A-2 never mutates matter. It only returns transfer requests.

All gas transport relocation is committed through Phase 4A-1 `transferMatterBatch()`.

The orchestrator checks element, atom-count, and net-charge conservation:

- before vs post-reaction;
- post-reaction vs post-transport;
- initial vs final timestep.

Negative or non-finite inventory is rejected before a state commit.

## Transport snapshot semantics

Gas transport evaluates from exactly one immutable snapshot created after the reaction matter commit.

Consequences:

- all enabled gas connections compete against the same source amounts;
- same-step incoming gas cannot fund another same-step outgoing request;
- Phase 4A-2 source normalization remains authoritative;
- request ordering cannot create first-connection-wins behavior;
- Phase 4A-1 performs one atomic batch commit.

If Phase 4A-2 returns OPEN, the whole orchestration returns OPEN and no zero-flow fallback is committed.

## Reaction gas routing

Phase 4A does not invent chemistry-to-headspace routing.

If reaction progression produces a new positive gas-phase amount in a non-headspace reaction compartment while an explicit sibling headspace exists, and no routing authority has placed that gas in headspace, the orchestrator returns:

`REACTION_GAS_SOURCE_ROUTING_OPEN`

No arbitrary headspace insertion occurs.

A reaction already evaluated in a gas/headspace compartment may participate in the subsequent gas-transport stage normally.

## Thermal snapshot semantics

Phase 4A-3 receives one immutable thermal-body snapshot for:

- finite-body contacts;
- reservoirs;
- actuators;
- the single reaction-energy source.

The subsystem retains its deterministic canonical ordering and envelope normalization.

If Phase 4A-3 returns OPEN, the complete staged timestep is rolled back.

The orchestrator does not recalculate mixture heat capacity or introduce new Cp data. Existing ThermalBody state remains authoritative for this phase.

## Pressure

Final pressure facts use the existing ideal-gas baseline:

`P = nRT/V`

Inputs are:

- post-transport gas inventory;
- post-thermal temperature;
- current explicit compartment volume.

The UI and provider do not recompute pressure.

Mapped gas compartments require finite `V > 0` and an authoritative finite `T > 0 K`.

OPEN pressure is published as OPEN only through a non-committed timestep result; a fabricated numeric pressure is never generated.

## Atomicity

The orchestrator performs staged immutable evaluation.

A REJECTED or blocking OPEN result returns the original input `Phase4ARuntimeState` object unchanged.

No provider projection is emitted for an incomplete state.

Blocking conditions include:

- invalid/non-finite authoritative state;
- reaction-stage failure;
- reaction conservation failure;
- missing reaction gas routing;
- incomplete reaction heat;
- OPEN gas transport;
- rejected Phase 4A-1 transport commit;
- OPEN thermal apparatus result;
- OPEN final pressure;
- final conservation failure.

## Determinism

No RNG is introduced.

For identical:

- initial runtime state;
- timestep id/dt;
- reaction/equilibrium inputs;
- topology;
- gas models;
- thermal contacts/reservoirs/actuators;

the committed state, audit ledger, and provider projection are deterministic.

## Audit ledger

`Phase4ARuntimeAudit` exposes:

- reaction matter delta;
- committed gas-transfer requests;
- compartment/species transport delta;
- reaction energy;
- internal finite-body transfer magnitude;
- external energy;
- final vessel temperature;
- optional primary final pressure;
- gas/thermal/overall scientific status;
- reaction gas-routing OPEN flag.

This is observability only and does not create a second physics authority.

## Provider timing

Provider projection is produced only after the completed authoritative timestep.

The final reaction provider composition uses the post-transport reaction compartment.

Current reaction-event temperature annotations are rewritten to the completed Phase 4A final vessel temperature rather than exposing the discarded legacy reaction-only thermal result.

## Phase 4A-4 seam

No liquid density or liquid-volume calculation is implemented here.

The extension seam is explicitly:

`temperature commit -> future liquid density/volume authority -> headspace volume update -> gas pressure projection`

Phase 4A currently leaves compartment volumes unchanged between thermal commit and pressure projection.

No iterative same-step pressure/volume/thermal/reaction solve is introduced.

## Explicitly out of scope

- liquid density or thermal expansion;
- dynamic liquid volume;
- evaporation/condensation/boiling;
- latent heat / phase transition;
- nonideal gas EOS;
- detailed pump/liquid flow;
- Navier-Stokes / CFD;
- molecular dynamics;
- UI physics;
- particle-renderer state as physics input.

## Validation gate

Implementation branch:

`feature/phase4a-runtime-orchestration`

Required before merge:

- typecheck + lint;
- orchestration matrix;
- reaction progression;
- Phase 3A;
- Phase 3B equilibrium;
- reversible arbitration;
- Phase 4A-1;
- Phase 4A-2;
- Phase 4A-3;
- Dynamic Species Registry;
- provider/UI targeted regression;
- full test suite;
- production build;
- independent 06 validation.
