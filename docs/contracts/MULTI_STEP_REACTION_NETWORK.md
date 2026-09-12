# Phase 3A Multi-step Reaction Network Execution

Status: IMPLEMENTED CONTRACT — validation pending
Owner: 01 - Chemistry Simulation Engine

## Authority Model

Phase 3A does **not** introduce a giant persistent reaction graph solver.
The authoritative network is the changing vessel state:

`state(N) -> immutable reactant snapshot -> candidates/evaluation/competition/extent -> commit -> state(N+1)`

Generated species become chemically eligible only when they are present with positive amount in the next timestep snapshot.

## Canonical Timestep Order

Each call to `runPhase3AReactionNetworkStep()` performs exactly one Phase 2E progression pass against one immutable species snapshot:

1. snapshot authoritative vessel species;
2. generate candidates from that snapshot;
3. thermodynamic / kinetic evaluation;
4. deterministic ranking / competition;
5. finite shared-reactant allocation;
6. selected extent resolution;
7. Dynamic Species Registry product registration;
8. atomic vessel mutation;
9. reaction heat aggregation;
10. `ReactionProgressEvent` emission;
11. timestep close;
12. returned committed state becomes the only source for the next call.

Same-step hidden cascade is invalid. A species absent or non-positive in the snapshot may not appear in any event's reactant consumption map for that timestep, even if another event produces it earlier in event order.

## Existing Phase 2E Invariants Reused

Phase 3A delegates chemistry resolution to the production Phase 2E path rather than reimplementing it. Therefore it preserves:

- element / atom conservation;
- net charge conservation;
- finite, non-negative amounts;
- deterministic rank ordering;
- equal-rank shared-reactant proportional scaling;
- Dynamic Species Registry stable generated identities;
- known-species canonical reuse;
- staged registry resolution and selected-only commit;
- product registration failure atomicity;
- no fake product ids;
- separation of internal species identity, scientific reference identity, and player knowledge.

Candidate identifiers remain reaction facts only. Phase 3A never uses candidate-id lexical ordering as an inventory allocation policy.

## Defensive Network Guards

The Phase 3A orchestrator validates the committed Phase 2E result before exposing the next state:

- all species amounts are finite and non-negative;
- species ids are unique in each authoritative state;
- reaction events are ordered by contiguous sequence number;
- event timestep and simulation time match the enclosing step;
- event extents are finite and positive;
- reactant deltas are finite and negative;
- product deltas are finite and positive;
- every consumed species had positive amount in the timestep snapshot;
- aggregate event consumption cannot exceed snapshot availability;
- defined per-event reaction heat must sum to `knownReactionHeat_J` within deterministic tolerance.

These are invariant checks, not alternate chemistry calculations.

## Event / Provider Contract

`ReactionProgressEvent` remains the authoritative internal reaction fact.
Phase 3A adds `ReactionFactProjection` for consumers that must display already-computed facts without recomputing chemistry.

Projected event fields:

- event id;
- timestep id;
- deterministic sequence;
- candidate stable id;
- start / end simulation time;
- applied extent in mol;
- consumed species references and mol amounts;
- produced species references and mol amounts;
- reaction heat in J when known;
- scientific status;
- reason codes.

The projection is factual simulation output, not narrative text.

### Authoritative vessel composition source

`Phase3AReactionNetworkStepResult.nextState.species`

The provider projection exposes only:

- opaque internal `speciesRef`;
- finite `amountMol`;
- current phase;
- phase-state id.

It does not expose molecule graphs, formula strings, names, or discovery state.

### Active/latest reaction event source

`Phase3AReactionNetworkStepResult.provider.activeReactionEvents`

This contains only the events emitted by the just-completed timestep.

### Timeline event source

`Phase3AReactionNetworkStepResult.provider.timelineEvents`

Timeline order is append-only authoritative event order:

`previous timeline events` followed by `current timestep events in sequence order`.

Replay with identical initial state, registry, timestep ids/config, data providers, and deterministic chemistry inputs must reproduce the same ordering and projections.

### Unknown species projection boundary

`speciesRef` is an internal simulation reference and **must not be rendered as a player-facing name or formula**.

04/05 own the player-knowledge projection. They may map an internal species reference to a known label only when player knowledge permits it. Unknown generated species remain opaque/unknown in normal UI until the Game Layer knowledge contract says otherwise.

05 must not inspect the molecular graph or recompute chemistry to decide what to show.

## Thermal Boundary

Phase 3A does not calculate thermodynamic properties. Reaction heat continues to come from Phase 2E / 02 coupling:

`accepted extent -> sourced deltaH when available -> signed heat J -> thermal state`

The network layer only verifies that per-event defined heat facts agree with the aggregate known reaction heat reported by the thermal coupling result.

## Diagnostic Reaction Graphs

A graph derived from timeline events is allowed for diagnostics or visualization, but it is not simulation authority and must never replace vessel-state-driven candidate generation.

## OPEN

- phase re-resolution sequencing after a reaction step remains owned by the existing 02/phase integration path;
- long-horizon network pruning / equilibrium acceleration is not part of Phase 3A;
- event persistence across full save-game orchestration remains an integration concern;
- player-facing unknown-species labels remain 04/05 responsibility;
- 06 should independently validate chains, branching, replay, shared-reactant fairness, registry failure atomicity, and multi-event heat consistency.
