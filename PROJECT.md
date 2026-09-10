# Chemical Lab — Project Source of Truth

## Product Vision
Build a browser-based chemistry laboratory sandbox where reactions emerge from molecular structure, physical conditions, general chemistry rules, and validated property data rather than a large reaction lookup table.

## Primary Design Principle
Prefer, in order:
1. Fundamental/common rule
2. Reaction-family rule
3. Empirical correction
4. Specific reaction exception

Specific reaction hardcoding is a last resort.

## Scientific Priority
1. Conservation laws
2. Reaction direction
3. Major products
4. Relative reaction rate
5. Product ratios
6. Fine numerical precision

Do not provide false precision. Classify uncertain behavior as VERIFIED, APPROXIMATED, EMPIRICAL, GAMEPLAY SIMPLIFICATION, or OPEN.

## Core Simulation Flow
Vessel State -> molecular/species analysis -> reactive-site detection -> reaction-family filtering -> candidate generation -> conservation validation -> product graph generation -> thermodynamic evaluation -> kinetic evaluation -> competing-reaction resolution -> stoichiometry/state update.

## Canonical Gameplay Progression
Normal play uses one core game mode.

The central progression loop is:

`experiment -> create species -> analyze/confirm identity -> encyclopedia registration -> inventory unlock -> reuse in later experiments`

Players begin with a limited starter-material set. A non-starter compound becomes freely selectable for future laboratory use only after a valid first discovery/analysis confirms its identity and registers it in the encyclopedia.

Do not split the product into separate Sandbox and Objective modes with different material-access rules. Tutorials, objectives, and challenges may exist as overlays inside the same game.

All-species access and discovery bypass are Developer Mode features only. Developer Mode is for development, QA, validation, and debugging; it is not a premium gameplay benefit.

The canonical detailed contract is `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`.

## Premium Boundary
The Standard game contains the complete supported chemistry engine, discovery progression, encyclopedia, and normal inventory unlock loop.

Premium may add workflow convenience, advanced analysis/visualization, archive capacity, organization, and cosmetics, but must not unlock chemistry, reveal undiscovered species, alter reaction outcomes, or modify scientific accuracy.

See `docs/product/PREMIUM_ROADMAP.md`.

## MVP
Initial chemistry focuses on H, C, N, O and a small set of molecules such as H2, O2, N2, H2O, CO, CO2, CH4, and NH3. The architecture must remain extensible to additional elements and reaction families without redesigning the engine.

## Source-of-Truth Policy
- Cross-system design: `00 - Chemistry Lab Game Design HQ` and this document.
- Gameplay discovery/inventory progression: `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`.
- Premium boundary: `docs/product/PREMIUM_ROADMAP.md`.
- Implementation: latest `main`, relevant feature branch/PR, tests, and CI.
- Workstream progress: `docs/workstream-status/*.md`.
- Scientific data claims: source metadata maintained by workstream 03.
- Validation verdicts: workstream 06.
