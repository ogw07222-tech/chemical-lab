# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Phase 0 — Architecture / Early Implementation
- Overall state: IN_PROGRESS_WITH_HQ_ALIGNMENT
- Last updated: 2026-09-10

## Current Objective
Continue the browser Laboratory UI using the approved information architecture while aligning Inventory, Discovery, and Encyclopedia with the canonical discovery-driven progression contract.

Canonical references:

- `PROJECT.md`
- `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`
- `docs/product/PREMIUM_ROADMAP.md`
- latest `docs/workstream-status/04-laboratory-gameplay.md`

## Preserved UI Architecture
The approved initial Laboratory workspace remains:

- left: inventory/material and molecule selection;
- center: reaction vessel and direct laboratory interaction;
- right: environment controls and live state/analysis;
- secondary analysis surfaces: composition, timeline, graphs, product analysis, experiment comparison, and log.

2D molecular visualization remains the initial default. UI components must not calculate chemistry.

## Canonical Inventory / Discovery UX
Normal play must not show all supported compounds as immediately selectable inventory materials.

Required flow:

`experiment -> species produced -> valid analysis/identity confirmation -> discovery feedback -> encyclopedia registration -> inventory unlock -> future reuse`

UI requirements:

- starter materials are selectable from a new save;
- undiscovered non-starter species are not selectable in normal inventory;
- hidden Simulation Core species must not leak their names through the UI before valid confirmation;
- unknown observations may be shown as unknown/undetermined material states;
- first confirmed discovery should produce clear feedback;
- encyclopedia and inventory availability should update from authoritative Game Layer events;
- unlocked species should be easy to select again for later experiments;
- Developer Mode all-species access must be visually and architecturally separate from normal play.

## Single Normal Game Rule
Do not build separate Sandbox and Objective navigation/modes with different material access.

Tutorials, objectives, or challenges may be UI overlays/surfaces within the same normal game.

Do not make `sandbox/objective` a required frontend state discriminator unless 00 HQ later changes the canonical contract.

## Premium UI Boundary
Standard users receive the complete chemistry/discovery/encyclopedia/inventory loop.

Premium UI may later add:

- richer experiment archive/search/tagging;
- multi-run comparison;
- enhanced encyclopedia relationship views;
- additional workspace organization;
- advanced visualization options;
- cosmetics/themes.

Premium UI must not reveal or unlock undiscovered species and must not alter simulation outputs.

## Simulation Boundary
Frontend dependency flow remains:

`Simulation/Game snapshot -> UI adapter/selectors -> React view state -> components`

User action flow remains:

`component event -> typed UI command -> Game Layer command API -> Simulation Core -> new snapshot/events -> UI`

No chemistry formulas, product inference, equilibrium logic, reaction-rate calculation, or discovery authority belongs in React components.

## Current Dependencies
- 04 canonical progression direction is now resolved by HQ.
- 01 MolecularGraph/species contract may still be pending integration and should remain behind an adapter boundary until stable.
- Exact analyzer outputs and some observable fields remain dependent on 01/02/04 contracts.
- Unlocked-material quantity semantics remain OPEN; UI should not assume a finite resource economy.

## Next Actions
1. Continue/create the runnable React + TypeScript laboratory scaffold.
2. Introduce UI-facing inventory/discovery/encyclopedia state adapters aligned with `DISCOVERY_INVENTORY_PROGRESSION.md`.
3. Keep mock data clearly isolated from production chemistry logic.
4. Do not expose all mock species as normal unlocked inventory unless explicitly running Developer Mode/testing fixtures.
5. Add component tests for locked/unlocked inventory presentation and first-discovery state transitions when the Game Layer contract becomes executable.

## Handoffs
### To 04
05 needs typed progression events/state for discovery confirmation, encyclopedia registration, inventory unlocks, and starter-material access.

### To 06
UI validation should eventually check that undiscovered identities do not leak and that premium entitlement does not change discovery/unlock behavior.

## Status
PASS:
- Existing laboratory information architecture remains compatible with the new progression direction.
- No chemistry-layer redesign is required.

OPEN:
- concrete runtime progression adapter types;
- exact starter-material presentation;
- unlocked-material quantity UI;
- final analysis-instrument identity confirmation UX.
