# Vessel Amount Limit & Linear Particle Visualization

Status: IMPLEMENTATION CONTRACT

## Manual vessel-addition limit

Player/developer material-add commands are bounded by an authoritative current-vessel amount supplied by the caller.

- maximum total amount after a manual addition: **20 mol**
- additions that would exceed 20 mol are rejected
- the 20 mol rule applies to the manual material-add boundary; reaction/transport semantics remain owned by their existing simulation systems
- unlocked inventory remains unlimited entitlement, but each actual vessel addition remains finite
- missing/non-finite authoritative current-vessel amount context is rejected rather than guessed

## Particle visualization

The Workbench particle renderer uses a linear display mapping:

- **0.01 mol = 1 display dot**
- **20 mol = 2000 display dots**
- display cap: **2000 dots per vessel**
- amounts below 0.01 mol may be present in authoritative/provider state but produce no dot; exact amount remains available through textual/accessibility presentation
- dots are representative display marks, not literal atoms or molecules

Visual encoding remains separated by concern:

- species identity: deterministic player-safe color
- phase: region/arrangement/motion class
- amount: dot count
- temperature: not encoded by this change

No frontend chemistry, phase inference, transport, or thermodynamics is introduced by this mapping.
