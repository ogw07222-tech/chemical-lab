# 04 — Laboratory Gameplay

- Owner: Lead Laboratory Gameplay Designer / Chemistry Sandbox Systems Designer / Progression Designer / Experiment Gameplay Developer
- Current phase: Phase 0 — Architecture
- Overall state: CONTRACT_DEFINED_WITH_HQ_OVERRIDE
- Last updated: 2026-09-10
- Active branch: main
- Active PR: none

## Current Objective
Maintain the laboratory gameplay contract while aligning progression with the latest 00 HQ decision: one canonical normal game mode, discovery-driven encyclopedia registration, and inventory unlocks.

## Canonical Gameplay Direction
The current authoritative progression contract is:

`docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`

Canonical normal-play loop:

`experiment -> create species -> analyze/confirm identity -> encyclopedia registration -> inventory unlock -> reuse in later experiments`

Players begin from a limited starter-material set. Non-starter compounds must be legitimately discovered and identified before they become selectable reusable inventory materials.

## Superseded Earlier Proposal
The earlier Phase 0 proposal to split the product into separate `Sandbox Mode` and `Objective Mode` is superseded by 00 HQ.

Do not use the following earlier assumptions as source of truth:

- unrestricted/broadly unrestricted normal Sandbox material access;
- progression-limited Objective Mode as a separate material-access mode;
- `mode: sandbox/objective` as a required experiment-state field.

Objectives, tutorials, challenges, and guided experiments may still exist, but only as overlays within the same canonical normal game.

## Discovery / Encyclopedia / Inventory Authority
Game Layer owns:

- starter-material availability;
- confirmed species discovery records;
- encyclopedia registration state;
- inventory unlock state;
- first-discovery metadata;
- objective/tutorial/challenge overlays;
- experiment history and progression presentation.

Simulation Core owns chemistry outcomes and must not inspect player unlock state when calculating reactions.

Canonical dependency:

`Simulation output -> Observation/Analysis -> Discovery -> Encyclopedia -> Inventory Unlock -> UI`

Forbidden dependency:

`Inventory/Progression -> Chemistry rules`

## Developer Mode
Developer Mode is separate from normal play and premium.

It may bypass discovery, unlock all supported species, spawn test materials, inspect hidden simulation state, and access validation/debug tooling.

Developer Mode is not a player progression path and must not be sold as a premium chemistry advantage.

## Premium Boundary
Standard and Premium use exactly the same chemistry, discovery requirements, encyclopedia unlock rules, and inventory unlock rules.

Premium may add convenience, advanced archives, analysis presentation, organization, visualization, workspace capacity, and cosmetics only.

Reference:
`docs/product/PREMIUM_ROADMAP.md`

## Preserved Phase 0 Gameplay Contracts
The following earlier 04 design decisions remain valid unless later superseded:

- Game Layer never chooses products, pathways, rates, equilibrium positions, or thermodynamic direction.
- Laboratory interactions should be explicit serializable commands.
- Vessel state should expose stable vessel identity, contents, amount, temperature, pressure, volume, phase, equipment configuration, simulation time, and simulation status through authoritative contracts.
- Heating/cooling, pressure/volume manipulation, electrodes, catalysts, and time advancement are player requests/commands whose physical consequences are resolved outside UI logic.
- Instruments are information gates rather than chemistry solvers.
- Named species should normally require valid analysis/identity confirmation rather than inference from ambiguous visual effects.
- Experiment records should support deterministic save/replay and A/B comparison.
- Chemistry and gameplay progression remain separated.

## Current Required Game-Layer Contracts
04 should next formalize typed contracts for:

- `PlayerProgressionState`
- `SpeciesDiscovery`
- `EncyclopediaEntryState`
- `InventoryUnlockState`
- `StarterMaterialSet`
- discovery/unlock Game Layer events
- experiment record without mandatory sandbox/objective mode field
- Developer Mode capability boundary

Exact quantity semantics for unlocked inventory remain OPEN and require 00 HQ approval before introducing a resource economy.

## Handoffs
### To 05 — Web UI
Render Inventory, Discovery, and Encyclopedia as one connected progression system. Undiscovered non-starter species must not appear as normal selectable inventory entries. A confirmed first discovery should create clear feedback and make the species available for future selection.

### To 06 — Simulation Validation Lab
Add future validation cases for discovery-before-unlock, one-time first discovery, save/load persistence, Developer Mode bypass isolation, and Standard/Premium chemistry equivalence.

### To 01 / 02
No chemistry-model changes are required for this progression decision. Simulation behavior must remain independent of discovery, inventory, premium, and Developer Mode entitlement state.

## Validation Evidence
PASS:
- The new progression model preserves Simulation/Game Layer separation.
- Discovery is driven by simulation output and valid observation rather than recipes.
- Premium does not alter chemistry.
- Developer all-unlock is isolated from normal progression.

OPEN:
- starter-material set;
- unlocked-material quantity/economy semantics;
- exact analyzer requirements by chemistry capability;
- objective/challenge reward structure;
- concrete TypeScript progression schemas.

## Next Actions
1. Implement/approve typed discovery and inventory progression contracts.
2. Coordinate 05 inventory/encyclopedia UI around the canonical contract.
3. Coordinate 06 progression-state validation.
4. Do not reintroduce separate Sandbox/Objective material-access modes without a new 00 HQ decision.
