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

## Canonical Unit System
The project uses SI units as the authoritative internal unit system across Simulation Core, normalized chemistry data, gameplay physical state, persistence/replay, validation, and cross-workstream contracts.

Examples:
- amount: mol
- mass: kg
- temperature: K
- pressure: Pa
- volume: m^3
- energy: J
- molar energy: J/mol
- concentration: mol/m^3
- power: W
- voltage: V
- current: A

UI may present convenient derived units such as °C, L, mL, kPa, bar, atm, mol/L, kJ, or kJ/mol, but conversion must occur at typed boundaries and must never change authoritative simulation state. See `docs/contracts/UNIT_SYSTEM.md`.

## Canonical Gameplay Progression
The normal game uses one primary gameplay mode.

Core progression loop:

`experiment -> create species -> analyze/confirm -> encyclopedia registration -> inventory unlock -> unlimited reuse`

Only designated starter materials and previously discovered/unlocked species are selectable in normal inventory.

Once a species is unlocked, it has unlimited laboratory stock for future experiments. Each actual vessel addition still specifies a finite physical amount and remains fully subject to conservation laws and the simulation engine.

All-supported-species access is Developer Mode only. Premium must not bypass discovery or change this inventory rule.

See `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`.

## Physical State and Thermal Direction
Phase is not selected manually by the player. The authoritative phase/state of matter is determined by the Simulation/Thermodynamics layers from current physical conditions and available data/models.

Reaction heat is part of the simulation. Exothermic/endothermic reaction enthalpy should couple to vessel thermal state rather than being a cosmetic label. Temperature control should be implemented through heating/cooling power and, when available, an explicit target-temperature controller that adds or removes heat instead of overwriting temperature.

Phase may affect reaction availability and kinetics. Phase diagrams are a core scientific visualization when sufficient validated data/model support exists.

See `docs/product/GAME_UI_SYSTEM_ROADMAP.md`.

## Platform Direction
Primary deployment target is PC web browser. Tablet and mobile web should be supported responsively when practical without simplifying the chemistry model or creating a separate simulation path.

See `docs/product/GAME_UI_SYSTEM_ROADMAP.md`.

## MVP
Initial chemistry focuses on H, C, N, O and a small set of molecules such as H2, O2, N2, H2O, CO, CO2, CH4, and NH3. The architecture must remain extensible to additional elements and reaction families without redesigning the engine.

## Source-of-Truth Policy
- Cross-system design: `00 - Chemistry Lab Game Design HQ` and this document.
- Implementation: latest `main`, relevant feature branch/PR, tests, and CI.
- Workstream progress: `docs/workstream-status/*.md`.
- Scientific data claims: source metadata maintained by workstream 03.
- Validation verdicts: workstream 06.
- Product/UI/thermal-phase roadmap: `docs/product/GAME_UI_SYSTEM_ROADMAP.md`.
