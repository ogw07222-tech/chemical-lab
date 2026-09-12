# 01 — Chemistry Simulation Engine

- Owner: Lead Chemistry Simulation Engine Developer / Reaction Solver Architect / Stoichiometry Engine Developer
- Current phase: Phase 3A — Multi-step Reaction Network Execution
- Overall state: PASS — implementation prepared / full-repository validation OPEN
- Last updated: 2026-09-12
- Latest re-checked main SHA: `3055ce6d2229806f4560a220ca835fb4b7f7c303`
- Active branch: `feature/phase3a-reaction-network`
- Active PR: #46 — `feat(sim): add Phase 3A multi-step reaction network execution`
- PR HEAD before this status commit: `aaab4b0fd4dc665ee1a0f4c5692438bc4ad652ed`

## Objective
Extend the existing Phase 2E reaction progression and Dynamic Species Registry into an explicit multi-step execution contract where products committed at timestep N can become reactants at timestep N+1, but never inside the same timestep.

The authoritative network remains emergent from changing vessel state rather than a persistent reaction-graph solver.

## Source of Truth
- Base/main checked at task start and again before PR creation: `3055ce6d2229806f4560a220ca835fb4b7f7c303`.
- Existing production Phase 2E progression remains authoritative for candidate generation, thermodynamic/kinetic evaluation, deterministic competition, finite extent, registry-backed product identity, conservation, and reaction-heat handoff.
- Existing Dynamic Species Registry remains authoritative for generated internal identity, deterministic generated ids, known-species reuse, provenance, and registration atomicity.

## Architecture
Added `src/integration/phase3a-reaction-network.ts` as a thin orchestration layer above the existing Phase 2E path.

Canonical per-timestep execution:
1. create immutable reactant snapshot from authoritative vessel state;
2. generate candidates from that snapshot only;
3. evaluate thermo/kinetics through the existing Phase 2 pipeline;
4. deterministic competition/ranking;
5. finite shared-reactant allocation;
6. selected extent resolution;
7. Dynamic Species Registry product resolution/registration;
8. atomic vessel mutation;
9. reaction heat aggregation;
10. `ReactionProgressEvent` emission;
11. close timestep;
12. use the committed returned state as the only source for the next timestep.

No giant persistent reaction graph is introduced. Event-derived graphs may be used for diagnostics or visualization only.

## Same-step Cascade Rule
`runPhase3AReactionNetworkStep()` exposes exactly one immutable species snapshot to the Phase 2E executor.

A product created during the step is present only in `nextState.species`. It cannot enter candidate generation again until a later call.

Phase 3A additionally validates emitted events: any reactant consumed by an event must have had positive amount in the timestep-start snapshot. A hidden A→B then B→C same-step cascade therefore fails even if a downstream executor were to accidentally emit it.

## Competing Reactions / Finite Matter
Phase 3A preserves the existing Phase 2E equal-rank shared-reactant proportional scaling and does not use candidate-id lexical ordering as an allocation policy.

The Phase 3A guard independently checks the aggregate consumed amount per reactant across all events and rejects any step where total consumption exceeds snapshot availability.

All committed species amounts must remain finite and non-negative, and species ids must remain unique.

## Dynamic Species Registry / Atomicity
Phase 3A requires a persistent `DynamicSpeciesRegistryLike` and passes it directly to Phase 2E.

The existing registry bridge remains unchanged:
- stage product graph identity resolution in an immutable working registry;
- stage zero-amount product state where needed;
- perform Phase 2E resolution/conservation;
- commit only selected reaction products;
- return the new registry and vessel state together.

Registration failure therefore propagates without mutating the caller's authoritative input state. No fake product ids are introduced.

Internal simulation identity, scientific reference identity, and player knowledge remain separate.

## Event / Provider Contract
Added a provider projection that lets 05 display simulation facts without recalculating chemistry.

### Authoritative vessel composition source
`Phase3AReactionNetworkStepResult.nextState.species`

`provider.authoritativeVesselComposition` projects only:
- opaque internal `speciesRef`;
- `amountMol`;
- phase;
- phase-state id.

It deliberately omits molecule graph, formula, name, and discovery state.

### Active/latest reaction source
`provider.activeReactionEvents`

Contains only the just-completed timestep's projected reaction facts:
- event/timestep/sequence;
- candidate stable id;
- simulation start/end time;
- applied extent mol;
- consumed species refs + mol;
- produced species refs + mol;
- reaction heat J when known;
- scientific status;
- reason codes.

### Timeline source
`provider.timelineEvents`

Ordering is append-only: prior authoritative timeline followed by current timestep events in deterministic sequence order.

### Unknown species boundary
`speciesRef` is an internal opaque reference and must not be rendered directly as a player-facing name or formula.

04/05 player-knowledge projection remains authoritative. Unknown generated species must stay unknown in normal UI until the Game Layer knowledge contract permits disclosure. 05 must not inspect molecular graphs or recompute chemistry to infer identity.

## Thermal Consistency
Phase 3A does not calculate thermodynamic properties or fabricate reaction enthalpies.

Existing Phase 2E / 02 coupling remains authoritative for reaction heat. The network layer only checks that all defined per-event `heatJ` values sum to `thermal.knownReactionHeat_J` within deterministic tolerance.

## Files Changed
- `src/integration/phase3a-reaction-network.ts` — Phase 3A snapshot orchestrator, network invariants, provider projections.
- `src/integration/index.ts` — exports the Phase 3A integration API.
- `tests/phase3a-reaction-network.test.ts` — multi-step/network/provider contract tests.
- `docs/contracts/MULTI_STEP_REACTION_NETWORK.md` — authoritative Phase 3A execution and UI/provider contract.
- `docs/workstream-status/01-simulation-engine.md` — this status update.

## Tests Added
`tests/phase3a-reaction-network.test.ts` covers:
1. A→B / B→C next-step visibility;
2. three-step chain;
3. shared-reactant fair allocation acceptance + aggregate overconsumption rejection;
4. branching network without persistent authority graph;
5. generated unknown next-step participation;
6. registration failure caller atomicity;
7. deterministic replay;
8. negative/non-finite amount rejection;
9. same-step hidden cascade rejection;
10. multi-reaction heat consistency and provider fact projection;
11. provider timeline ordering.

Existing Phase 2E tests remain responsible for actual resolver equal-rank proportional allocation, conservation, bounded extent, and deterministic event ordering.

## Validation Evidence
### Local behavioral harness — PASS
A standalone deterministic harness was compiled/executed locally before creating the feature branch. It exercised:
- three-step next-timestep visibility;
- same-step cascade rejection;
- shared-reactant overconsumption rejection;
- reaction heat event/aggregate consistency.

### Production source typecheck harness — PASS
The actual `phase3a-reaction-network.ts` source was compiled under strict ES2022 / Bundler TypeScript semantics against locally reconstructed current contract stubs matching the repository interfaces.

### Full repository regression — OPEN
This environment could not clone GitHub over DNS, so no claim is made for full local `npm ci`, full repository `npm run typecheck`, `npm test`, lint, or build on the branch. Those remain required before merge.

## PASS / FAIL / OPEN
### PASS
- Explicit immutable timestep reactant snapshot.
- Generated product becomes eligible only on later timesteps.
- Defensive no-same-step-cascade guard.
- Existing Phase 2E finite shared-reactant competition preserved.
- Aggregate overconsumption guard.
- Dynamic Species Registry authority and stable generated-id path preserved.
- Known species reuse path preserved.
- Registration failure does not partially mutate caller state.
- Finite/non-negative amount guard.
- Deterministic event/timeline ordering contract.
- Reaction heat event consistency interface.
- UI-consumable simulation fact projection without molecule/name/formula leakage.
- Scientific identity and player knowledge remain separate.

### FAIL
- None identified in the implemented Phase 3A orchestration scope.

### OPEN
- Full repository branch typecheck/test/lint/build.
- Independent 06 validation of chain, branch, shared-reactant fairness, replay, atomicity, and heat consistency.
- Advanced phase re-resolution ordering after committed reaction state.
- Long-horizon equilibrium/network acceleration; intentionally not part of Phase 3A.
- Full save-game orchestration for reaction timeline history.
- Player-facing unknown-species naming/disclosure remains 04/05 ownership.
- Generated-species scientific enrichment remains 03/02 ownership.

## Handoffs
- 02: keep thermodynamic/kinetic formulas and reaction heat derivation authoritative; Phase 3A consumes only existing evaluated outputs.
- 03: enrich generated species with sourced scientific reference/property matches without changing internal registry identity.
- 04/05: consume provider composition/events, but resolve player-facing identity only through the player-knowledge boundary.
- 06: independently validate multi-step chains/branches, no same-step cascades, shared-reactant fairness, deterministic replay, registration failure atomicity, conservation, and heat-event consistency.
- 07: run normal repository regression/CI and integrate PR #46 only after validation.

## Next
**06 independent Phase 3A network validation, then 07 integration review.**
