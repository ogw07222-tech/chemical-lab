# 04 — Laboratory Gameplay

- Owner: Lead Laboratory Gameplay Designer / Chemistry Sandbox Systems Designer / Progression Designer / Experiment Gameplay Developer
- Current phase: Generated Species Player Knowledge Boundary
- Overall state: IMPLEMENTED_PENDING_RUNTIME_VALIDATION
- Last updated: 2026-09-12
- Starting main SHA: `4c12c2b9be6053887f471c288618590114dc32b4`
- Active branch: `feature/generated-species-player-knowledge`
- Active PR: pending

## Current Objective
Implement the Game Layer boundary that keeps generated/internal species identity separate from player knowledge while reusing the existing discovery -> encyclopedia -> unlimited inventory progression.

Core invariant:

`internal existence != player knowledge`

01 registry implementation is not modified.

## Source of Truth Reviewed
- `docs/contracts/LAB_NOTEBOOK_SCIENTIFIC_KNOWLEDGE.md`
- `docs/contracts/DISCOVERY_INVENTORY_PROGRESSION.md`
- `docs/contracts/SIMULATION_CONTRACT.md`
- `src/game/progression.ts`
- this status file

## Generated Species Knowledge Lifecycle
Canonical lifecycle implemented/proposed:

`internal species exists -> unknown player projection -> Scientific Record / My Notes -> analysis -> optional structured hypothesis -> authoritative identity confirmation -> existing SpeciesDiscovery -> existing Encyclopedia registration -> existing InventoryUnlock -> unlimited reuse`

Generated species do not receive a second progression system.

## Implemented Runtime
Added `src/game/generatedSpeciesKnowledge.ts` with:

- `InternalSpeciesDescriptor`
- generated/known origin metadata
- scientific reference-match state
- stable opaque `unknownRef`
- normal unknown-species projection
- Developer Mode internal projection
- Scientific Record accumulation
- My Notes attachment
- optional structured hypothesis storage
- analysis-history state
- authoritative identity-confirmation bridge into existing `handleIdentityEvent`
- encyclopedia/unlock knowledge flags
- deterministic generated-knowledge serialization/deserialization

The module depends only on the existing Game Layer progression interface and does not import or mutate 01 registry implementation.

## Identity Leakage Rules
### Normal Mode
Before authoritative identity confirmation, normal projection exposes only gameplay-safe information such as:

- `Unknown substance`
- opaque `unknownRef`
- observed/analyzed state
- whether hypothesis interaction is available

It does not expose:

- internal SpeciesId
- registry ID
- molecular formula
- molecular graph
- verified/common name
- generated/known origin
- scientific reference-match state
- registry/debug metadata

Scientific Record may accumulate measurements while identity remains hidden.

### Developer Mode
Developer Mode may additionally expose SpeciesId, origin, formula, graph reference, registry metadata, reference-match state, and available verified/common name for QA.

Developer projection does not alter discovery, encyclopedia, inventory, notes, or chemistry state.

## Notebook Behavior
Generated unknown species can accumulate:

- Scientific Record measurements/raw outputs
- repeated measurement history
- experiment provenance
- My Notes
- analysis references
- optional structured hypotheses

Scientific Record ingestion is idempotent by authoritative `observationRef`.

My Notes remain free-form and ungraded. Notes do not unlock identity or inventory by themselves.

## Encyclopedia / Unlock Behavior
Identity confirmation reuses the existing `IdentityConfirmedEvent` and `handleIdentityEvent` progression path.

On valid confirmation:

- knowledge entry becomes identity-confirmed;
- existing progression creates/reuses `SpeciesDiscovery`;
- Encyclopedia registration follows existing progression semantics;
- material access becomes unlocked;
- duplicate observations/internal references do not create duplicate knowledge entries.

Generated species therefore obey the same unlimited-stock rule as other discovered species.

Every actual `AddUnlockedMaterial` operation remains finite (`amountMol > 0`, finite number). `NaN`/`Infinity` remain invalid. Simulation Core never receives unlimited-inventory semantics.

## Real-World Identity Boundary
A structurally valid generated species is not automatically promoted to a named real-world compound by 04.

If 03 reference matching remains OPEN or GENERATED_UNVERIFIED:

- player experiments remain valid;
- measurements/notes/history remain valid;
- identity/progression state may remain game-canonical;
- 04 does not invent a common name or precise external reference properties.

Reference support remains separate from player discovery state.

## Persistence Requirements
Generated player knowledge is keyed by stable 01 SpeciesId and preserves an opaque `unknownRef` for historical player-facing records.

Save/load must preserve:

- species association
- unknownRef
- observed/analyzed/confirmed state
- Scientific Record
- My Notes
- hypotheses
- analysis history
- encyclopedia/unlock linkage
- origin/reference-support metadata
- schema version

Restoring the same registry SpeciesId must restore the same player knowledge association. Knowledge may not migrate to another species or disappear silently.

## Tests Added
Added `tests/game/generatedSpeciesKnowledge.test.ts` covering:

- internal generated species does not leak identity in normal projection
- unknown species accumulates Scientific Record
- duplicate observation ingestion is idempotent
- My Notes attach to the correct species
- analysis -> confirmation -> existing discovery progression
- generated unlock reuses unlimited stock + finite vessel amount rule
- save/restore keeps knowledge associated with stable SpeciesId
- Developer Mode reveals internals without mutating normal progression
- duplicate internal references do not create duplicate knowledge entries

## Validation Performed
### PASS — source/contract audit
- 01-owned simulation/registry files untouched.
- No graph canonicalization or generated SpeciesId creation implemented.
- No reaction, thermo, phase, or reference-matching logic added.
- Normal projection omits identity-bearing internal fields.
- Confirmation delegates to existing Game Layer progression.
- Unlimited inventory remains entitlement-only and Simulation additions remain finite.

### OPEN — executable test/typecheck run
Attempted repository clone/test execution from the current environment, but DNS resolution for `github.com` failed before checkout. Therefore `npm run typecheck` and `npm test` could not be executed here. Runtime PASS is not claimed.

## 01 Handoff
04 requires only:

- stable SpeciesId across save/load for the same canonical registry identity
- origin: known/generated
- optional scientific reference-match state
- optional developer/post-confirmation metadata such as graph/formula/name refs
- no requirement for a player-facing name

01 remains owner of SpeciesId generation, registry persistence, graph canonicalization, structural identity, and duplicate structural identity handling.

See `docs/contracts/GENERATED_SPECIES_PLAYER_KNOWLEDGE.md`.

## 03 Handoff
Later loose updates may provide:

- scientific reference match state
- verified/common name where available
- provenance refs
- property evidence refs

No reference match must not be interpreted by 04 as impossibility.

## 05 Handoff
05 should render normal generated species from the Game Layer projection only. Before confirmation it must use an unknown/sample presentation and must not read Developer/internal metadata. My Notes and Scientific Record remain available for the unknown subject.

## 06 Handoff
Validate:

- nested normal projections/Scientific Record cannot leak internal identity
- Developer Mode reveal does not mutate normal progression
- save/restore preserves knowledge-to-SpeciesId association
- duplicate registry references remain one knowledge/encyclopedia identity
- confirmation uses ordinary progression semantics
- unlocked generated material additions remain finite
- serialization is deterministic and malformed/unknown schemas fail safely

## PASS / FAIL / OPEN
### PASS
- generated/internal existence separated from player knowledge
- unknown normal projection implemented
- Scientific Record accumulation implemented
- My Notes association implemented
- analysis/hypothesis state supported
- confirmation bridges into existing discovery progression
- encyclopedia/unlock lifecycle reused
- unlimited stock / finite-add rule preserved
- Developer Mode observability boundary implemented
- deterministic persistence foundation implemented
- 01/03 interface handoff documented

### FAIL
- None established by available evidence.

### OPEN
- actual executable typecheck/test result
- final 01 runtime descriptor/type names once the parallel registry implementation lands
- whether integration adapter or 01 directly supplies origin/reference DTO
- analyzer path producing authoritative `IdentityConfirmedEvent`
- 03 scientific-reference update event shape
- policy for confirmed but permanently unnamed generated species display label
- future generated-knowledge save migration policy
