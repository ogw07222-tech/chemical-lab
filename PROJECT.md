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

## MVP
Initial chemistry focuses on H, C, N, O and a small set of molecules such as H2, O2, N2, H2O, CO, CO2, CH4, and NH3. The architecture must remain extensible to additional elements and reaction families without redesigning the engine.

## Source-of-Truth Policy
- Cross-system design: `00 - Chemistry Lab Game Design HQ` and this document.
- Implementation: latest `main`, relevant feature branch/PR, tests, and CI.
- Workstream progress: `docs/workstream-status/*.md`.
- Scientific data claims: source metadata maintained by workstream 03.
- Validation verdicts: workstream 06.
