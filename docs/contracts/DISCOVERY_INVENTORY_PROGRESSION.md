# Discovery, Encyclopedia, and Inventory Progression Contract

## Status
APPROVED BY 00 - Chemistry Lab Game Design HQ

This document is the canonical Game Layer contract for species discovery, encyclopedia registration, inventory unlocks, unlimited unlocked-material access, and developer all-unlock behavior.

It supersedes earlier Phase 0 proposals that split the product into separate Sandbox and Objective modes or broadly unlocked supported materials in normal play.

## Core Product Loop

The canonical normal-play loop is:

`experiment -> create species -> analyze/confirm identity -> encyclopedia registration -> inventory unlock -> unlimited reuse in later experiments`

The player grows the usable material library through chemistry and observation rather than through a recipe list, resource grind, or premium purchase.

## Single Normal Game Mode

The product has one canonical normal gameplay mode.

Do not create separate Sandbox and Objective modes with different material-access rules.

Objectives, tutorials, challenges, achievements, and guided experiments may exist inside the same game, but they must not define a second chemistry mode or a separate simulation rule set.

The Simulation Core remains identical regardless of progression state.

## Starter Materials

A new save receives a deliberately small set of designated starter materials and equipment sufficient to begin experimentation.

Starter access is a Game Layer/content decision, not a chemistry-engine rule.

The exact starter set is OPEN and may be tuned later without changing this contract.

## Species Discovery

A species is considered discovered only after its identity has been legitimately confirmed through an allowed observation or analysis path.

Default rule:

- existence only inside hidden Simulation Core state does not unlock the species;
- visually ambiguous effects do not identify a named compound;
- valid analyzer/instrument confirmation can create a `SpeciesDiscovery`;
- a future scientifically justified direct-observation identity channel may also qualify;
- duplicate confirmation updates history/statistics but does not create a new unlock.

## Encyclopedia Registration

A confirmed first discovery creates or activates an encyclopedia entry.

An entry should be able to retain:

- stable species identifier;
- formula and validated name when available;
- structure/molecular graph reference;
- scientific status/confidence metadata;
- first-discovery experiment reference;
- first-discovery timestamp/order;
- player observations and analysis results;
- later related experiments;
- known properties from validated data where appropriate.

The encyclopedia does not define chemistry. It references Simulation/Data Layer identities and validated properties.

## Inventory Unlock

Once a species is validly registered as discovered, it becomes available as a reusable laboratory material in normal play.

Canonical rule:

`confirmed SpeciesDiscovery -> EncyclopediaUnlock -> InventoryUnlock`

Inventory availability must be represented in Game Layer progression state and must never modify molecular structure, thermodynamics, kinetics, equilibrium, or reaction generation.

### Unlimited unlocked-material supply

Once unlocked, a species has unlimited laboratory stock for normal gameplay.

The player may select any unlocked species from the inventory and request any amount that is otherwise permitted by vessel/equipment/simulation constraints without needing to synthesize, purchase, farm, or replenish that species again.

This is an intentional gameplay rule: progression challenge comes from discovery and experimental reasoning, not resource grinding.

The unlimited-stock rule is Game Layer inventory semantics only. It does not mean the Simulation Core has infinite matter inside a vessel. Each actual addition command still supplies an explicit finite physical amount, which then obeys all conservation and simulation rules.

A finite-resource economy must not be introduced later without an explicit 00 HQ decision that revises this contract.

## Undiscovered Species

Undiscovered non-starter species must not normally appear as selectable inventory materials.

They may still:

- form naturally in the Simulation Core;
- exist undetected in a vessel;
- be observed indirectly;
- become identified and unlocked after valid analysis.

The UI may show unknown/undetermined material observations without revealing the species identity before confirmation.

## Developer Mode

Developer Mode is the only canonical all-access bypass.

Developer Mode exists for development, QA, scientific validation, debugging, and internal testing.

It may:

- unlock all supported species;
- bypass discovery requirements;
- spawn arbitrary supported species and amounts;
- inspect hidden simulation state;
- inspect reaction candidates and pruning/debug data;
- force test states;
- access validation fixtures.

Developer Mode is not a normal gameplay mode and is not a premium benefit.

## Premium Boundary

Premium must use the same discovery and inventory-unlock rules as Standard.

Premium may enhance organization, visualization, experiment archives, comparisons, workspace convenience, or cosmetics, but must not:

- reveal undiscovered species identities;
- unlock undiscovered compounds;
- bypass analyzer/confirmation requirements;
- modify chemistry outcomes;
- provide exclusive chemistry needed for progression;
- alter the unlimited-stock rule for discovered species.

See `docs/product/PREMIUM_ROADMAP.md`.

## Objectives and Challenges

Guided tasks may constrain a particular experiment's allowed starting setup for challenge/tutorial purposes, but they are overlays on the single normal game rather than a separate mode.

Completing an objective may grant cosmetic, organizational, informational, or equipment rewards, but must not fabricate a SpeciesDiscovery that the player did not actually confirm.

## Save-State Requirements

Player progression/save data should eventually include at minimum:

- starter-material entitlement set;
- discovered species IDs;
- encyclopedia records;
- inventory-unlocked species IDs;
- first-discovery metadata;
- optional discovery statistics/history;
- developer-mode state only in explicitly non-normal/internal contexts.

Unlocked species do not require stock-count persistence because unlocked normal-play inventory is unlimited by contract.

The save format should use stable species identifiers rather than display names.

## UI Requirements

05 Web UI should treat Inventory, Discovery, and Encyclopedia as one connected progression surface:

- undiscovered species are not selectable inventory entries;
- newly confirmed species produces clear discovery feedback;
- encyclopedia registration and inventory availability occur together under the authoritative Game Layer event;
- unlocked inventory species are presented as unlimited laboratory stock;
- amount controls describe the finite quantity being added to the current vessel, not remaining inventory stock;
- developer-only all-species browsing is clearly separated from normal UI.

## Architecture Boundary

Preferred dependency flow:

`Simulation output -> Observation/Analysis -> Game Layer Discovery Service -> Encyclopedia State -> Inventory Unlock State -> UI`

Forbidden dependency direction:

`Inventory/Progression -> Simulation chemistry rules`

## Validation Requirements

06 should eventually verify at least:

- hidden generated species do not unlock before valid confirmation;
- first valid confirmation unlocks exactly once;
- unlocked species becomes reusable inventory material with unlimited normal-play stock;
- each vessel-add operation still creates a finite explicit amount;
- undiscovered species remains unavailable in normal inventory;
- Developer Mode can bypass progression without altering chemistry results;
- Premium entitlement does not alter species unlock or stock rules;
- save/load preserves discovery and inventory unlock state deterministically.

## OPEN

- exact starter-material set;
- precise analyzer requirements for each chemistry capability;
- discovery presentation/animation;
- optional challenge/objective reward design.
