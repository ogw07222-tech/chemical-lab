# 04 — Laboratory Gameplay

- Owner: Lead Laboratory Gameplay Designer / Chemistry Sandbox Systems Designer / Progression Designer / Experiment Gameplay Developer
- Current phase: Phase 1 — Progression runtime foundation
- Overall state: IMPLEMENTED_PENDING_RUNTIME_VALIDATION
- Last updated: 2026-09-11
- Last checked main SHA: `567994693e56a7013cbcce0d95222a6cb98594af`
- Active branch: `feature/phase1-progression-runtime`
- Active PR: #8 — `feat(game): add Phase 1 progression runtime foundation`

## Current Objective
Implement the approved Discovery -> Encyclopedia -> Unlimited Inventory contract as an executable deterministic Game Layer state machine, without implementing chemistry, analyzer physics, phase, thermal, or UI behavior.

## Source of Truth Reviewed
- `PROJECT.md`
- `AGENTS.md`
- `ROADMAP.md`
- `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`
- `docs/contracts/UNIT_SYSTEM.md`
- this workstream status file

Canonical flow remains:

`starter/unlocked material -> finite vessel addition -> experiment -> authoritative identity confirmation -> first discovery -> encyclopedia unlock -> inventory unlock -> unlimited reuse`

## Completed

### Executable progression state
Added `src/game/progression.ts` implementing:

- `PlayerProgressionState`
- `StarterMaterialSet`
- `SpeciesDiscovery`
- `EncyclopediaEntryState`
- `InventoryUnlockState`
- `IdentityConfirmedEvent` / `IdentityUnconfirmedEvent`
- `FirstDiscoveryEvent`
- initial progression creation
- identity-event reducer
- material-access selector
- finite `AddUnlockedMaterial` validation
- progression invariant validation
- deterministic serialization/deserialization
- explicit unsupported-save-version failure

### Identity confirmation and atomic unlock
Only an authoritative `IdentityConfirmedEvent` can create a first discovery.

The first valid confirmation produces one state transition containing:

1. `SpeciesDiscovery`
2. matching encyclopedia entry
3. matching inventory unlock
4. one `FirstDiscoveryEvent`

Hidden/unconfirmed species do not unlock. Duplicate confirmation does not duplicate first-discovery state or inventory entitlement. A later confirming experiment may add a related experiment reference without replacing first-discovery metadata.

### Unlimited unlocked inventory
Unlocked normal-play species use `UNLIMITED_UNLOCKED` entitlement semantics. There is no stock counter, depletion, replenishment, purchase loop, or giant sentinel stock quantity.

Unlimited entitlement is Game Layer state only. Every Simulation-bound addition still contains finite `amountMol` and must satisfy `amountMol > 0`.

`NaN`, `Infinity`, `-Infinity`, zero, and negative amounts are rejected before Simulation dispatch.

No arbitrary global maximum amount is introduced here; actual vessel/apparatus capacity limits remain a later apparatus boundary concern. Large finite values are never interpreted as unlimited-stock sentinels.

### Developer Mode boundary
Developer Mode may bypass material entitlement only at the Game Layer access check. It does not mutate progression state or provide chemistry modifiers. Developer additions still require finite positive `amountMol`.

### Premium boundary
Premium cannot bypass discovery. The premium flag is deliberately ignored by material-access logic.

### Deterministic persistence foundation
Schema version is `1`. Serialization canonicalizes starter/unlocked species and record ordering while preserving first-discovery order explicitly. Deserialization validates discovery/encyclopedia/inventory synchronization.

Version `0`, missing versions, and unknown versions are rejected with `UnsupportedProgressionSaveVersionError`. No implicit migration is performed yet.

## Tests Added
Added `tests/game/progression.test.ts` covering:

- starter species accessible
- locked species unavailable
- hidden/unconfirmed species does not unlock
- identity confirmation triggers atomic unlock
- first confirmation unlocks exactly once
- duplicate confirmation protection
- later confirmation history without first-discovery mutation
- encyclopedia/inventory synchronization
- unlocked species reusable repeatedly without depletion
- exact finite amount forwarded to Simulation-bound request
- zero/negative amount rejection
- `NaN` rejection
- positive/negative `Infinity` rejection
- Developer Mode bypass without progression mutation
- Premium cannot bypass discovery
- deterministic serialize -> deserialize -> serialize
- explicit old/unknown save-version rejection

## Validation Performed
### PASS — contract/source audit
- No chemistry/reaction/analyzer/phase/thermal formulas were added.
- Progression state contains access/knowledge state, not vessel matter.
- First discovery keeps discovery, encyclopedia, and inventory synchronized in one returned transition.
- Unlimited stock is represented as entitlement semantics, never infinite physical amount.
- Developer Mode and Premium remain outside chemistry outcome logic.
- SI amount boundary is explicit as `amountMol`.

### OPEN — executable tests
Attempted:

`git clone --branch feature/phase1-progression-runtime --single-branch https://github.com/ogw07222-tech/chemical-lab.git ...`

The execution environment could not resolve `github.com`, so checkout stopped before `npm install`, `npm run typecheck`, or `npm test`. Therefore no executable/typecheck PASS is claimed here.

The checked main had no `.github/workflows` directory available for an existing CI run to reuse.

## PASS / FAIL / OPEN

### PASS
- Progression state machine implemented.
- Starter entitlement implemented.
- Locked-species rejection implemented.
- Authoritative identity-confirmation gate implemented.
- Atomic encyclopedia + inventory unlock implemented.
- Duplicate first-discovery protection implemented.
- Unlimited unlocked-stock semantics implemented.
- Finite positive amount validation implemented.
- Developer Mode access-only bypass implemented.
- Premium-neutral unlock rules implemented.
- Deterministic persistence foundation implemented.
- Old/unknown save behavior is explicit.

### FAIL
- None established by executed evidence.

### OPEN
- `npm run typecheck` and `npm test` must run in a network-enabled environment before merge.
- Exact adapter from Game Layer `SpeciesKey` to the final executable 01 species identity type.
- Exact starter-material membership remains an HQ/content decision.
- Actual analyzer implementation producing authoritative identity confirmations is out of scope.
- Future save-schema migration policy; unsupported versions currently fail explicitly.
- Vessel/apparatus maximum amount validation remains outside this foundation.

## 05 Handoff — Web UI
05 should consume Game Layer state/events rather than implement progression rules:

- normal inventory shows starter + unlocked species only;
- unlocked species are displayed as unlimited stock, without a remaining-stock counter;
- amount input describes the finite amount added to the current vessel;
- first-discovery feedback is driven by `FirstDiscoveryEvent`;
- encyclopedia and inventory appear unlocked from the same progression snapshot;
- Developer Mode all-species access is clearly separated from normal play;
- Premium UI must not expose discovery bypass.

## 06 Handoff — Simulation Validation Lab
Before runtime PASS, validate:

- the committed progression test suite;
- invalid-number/property tests around material-add validation;
- synchronization under repeated/reordered confirmation events;
- deterministic serialization round trips;
- malformed/old save rejection;
- Developer Mode only changes access and does not alter chemistry inputs beyond finite species/amount request;
- Premium produces no unlock/access difference;
- no `NaN`/`Infinity` crosses Game -> Simulation material boundary.

## 07 Handoff — Integration & GitHub
For PR #8:

1. re-check latest main because parallel Phase 1 work is active;
2. update/rebase PR #8 if main moved;
3. run `npm install`, `npm run typecheck`, and `npm test` in a network-enabled environment;
4. resolve only interface-level conflicts; do not move chemistry logic into Game Layer;
5. merge only after executable tests PASS and the 06 boundary review is acceptable.

## Next Actions
- Obtain executable typecheck/test evidence.
- Reconcile stable species identity with 01 through an adapter rather than chemistry dependency.
- Wire future analyzer/observation output into `IdentityConfirmedEvent` at the Game Layer boundary.
