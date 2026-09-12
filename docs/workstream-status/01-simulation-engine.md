# 01 — Chemistry Simulation Engine

- Owner: Lead Chemistry Simulation Engine Developer / Reaction Solver Architect / Stoichiometry Engine Developer
- Current phase: Dynamic Species Registry & Generated Species Persistence
- Overall state: PASS — IMPLEMENTED / integration pending
- Last updated: 2026-09-12
- Starting / latest re-checked main SHA: `4c12c2b9be6053887f471c288618590114dc32b4`
- Active branch: `feature/dynamic-species-registry`
- Active PR: #39 — `feat(sim): add dynamic species registry and persistence`
- Exact validated executable/test HEAD: `aaad1235b1c0408cea0b3015af7e7049c06eb4c2`
- Validation workflow run: `34635920066` — SUCCESS

## Objective
Persist structurally valid reaction-generated molecular graphs as stable internal species identities so they can enter vessel state and participate in later timesteps without equating engine identity with verified real-world identity or player knowledge.

## Architecture
- Added `src/simulation/species-registry/` with immutable `DynamicSpeciesRegistry` and schema-versioned persistence contracts.
- Registry identity reuses the existing Phase 1 `mol-v1` canonical molecular core rather than defining a second graph identity system.
- Primary index is `canonicalKey -> DynamicSpeciesRecord`; exact `canonicalStructuralRepresentation` is retained for collision-safe verification.
- Generated ids are deterministic: `generated:<canonicalKey>`.
- Formula alone is never used as molecular identity.
- Phase, provenance, scientific reference matching, and player discovery are excluded from molecular identity.

## Identity Separation
1. Internal identity: deterministic canonical graph identity used by the simulation engine.
2. Scientific identity: known/reference compound matching; generated records remain `referenceMatchStatus: OPEN` unless enriched later by 03.
3. Player knowledge: discovery/name/encyclopedia state remains 04/Game Layer and is not stored in the registry.

Generated records use the existing scientific taxonomy and default to `scientificStatus: OPEN`, while separately recording `validationState: STRUCTURALLY_VALID`. Structural validity is not experimental verification.

## Registration / Validation
Before registration, a molecule must pass:
- existing molecular graph validation;
- formula/net-charge record consistency;
- `mol-v1` canonicalization;
- current coarse-valence sanity.

Hash/key collisions with a different exact canonical representation are explicit INVALID results rather than silent identity merges.

## Known / Generated Resolution
- Existing known seed canonical identity -> reuse existing known species id.
- Existing generated canonical identity -> reuse stable generated id and merge deterministic provenance.
- New valid canonical identity -> create generated record with OPEN scientific/reference status.
- Invalid/malformed/canonicalization-failed structure -> reject registration.

No density, phase boundary, pKa, thermochemistry, entropy, Gibbs energy, redox potential, or rate constant is invented by 01.

## Provenance / Persistence
Generated provenance records candidate id, parent reactant species ids, reaction family, creation timestep, product index, and canonicalization version. Provenance never affects identity.

`registry.serialize()` and `restoreDynamicSpeciesRegistry()` provide save/load-friendly persistence. Restore revalidates records, canonical representation/key, schema/canonicalization version, and deterministic generated ids before accepting the snapshot.

## Phase 2E Integration / Atomic Mutation
Added `resolveReactionCandidatesWithRegistry()` as the registry-backed Phase 2E bridge.

Canonical transaction:
1. stage product graph resolution/registration in an immutable working registry;
2. stage missing product vessel species at zero amount;
3. run existing Phase 2E ranking/competition/extent/conservation logic;
4. commit only registry records/products belonging to selected reactions;
5. return next vessel state + persistent registry.

The caller's input registry/state are never mutated in place. Registration failure or conservation failure cannot leave reactants consumed without products.

Generated vessel species start with phase `unknown` / scientific status `OPEN`; phase determination remains outside this registry layer.

## Timestep Semantics
- Same-step generated-product cascade: BLOCKED by existing `ZERO_INITIAL_REACTANT` policy.
- Next timestep: generated product is a normal positive-amount `SpeciesState`, so reactive-site detection/candidate generation can consume it normally.
- `runPhase2EReactionProgression()` remains backward compatible: legacy `productStateResolver` still works, while `speciesRegistry` enables persistent generated-species flow and is returned in `nextState`.

## Tests Added
`tests/dynamic-species-registry.test.ts` — 11 tests covering:
- canonical identity invariance and distinction by connectivity/bond order/formal charge;
- known-species reuse;
- unknown generated registration/dedup/different ids;
- malformed graph rejection;
- serialize/restore identity stability;
- generated product entering vessel state;
- no same-step cascade;
- next-step generated-species participation;
- known product reuse;
- registration failure atomicity;
- atom/charge conservation;
- deterministic repeated state/registry result.

## Validation Evidence
Validated exact HEAD: `aaad1235b1c0408cea0b3015af7e7049c06eb4c2`
GitHub Actions run: `34635920066` — SUCCESS.

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- targeted registry + reaction progression/candidate/evaluation/thermal: **5 files / 59 tests PASS**
  - dynamic registry 11/11
  - reaction progression 10/10
  - reaction candidate 16/16
  - reaction evaluation 9/9
  - thermal 13/13
- full `npm test`: **13 files / 148 tests PASS**
- reaction validation matrix included in full suite: 8/8 PASS
- UI workspace regression included in full suite: 10/10 PASS
- `npm run build`: PASS

The temporary branch-only validation workflow was removed after preserving the successful run. That cleanup and this status update do not alter the validated executable/test blobs.

## PASS / FAIL / OPEN
### PASS
- Deterministic canonical registry identity and duplicate prevention.
- Known species reuse and generated species registration.
- Collision-safe exact canonical verification.
- Generated provenance separated from identity.
- Registry serialization/restore with stable ids.
- Phase 2E generated-product amount mutation.
- Atomic failure semantics: no reactant-only partial mutation.
- Element/atom/charge and finite/non-negative amount invariants retained.
- Same-step cascade prevention and next-step generated-species participation.
- Full repository regression/build on validated executable HEAD.

### FAIL
- None identified in validated scope.

### OPEN
- Generated-species real-world/reference identity verification.
- Scientific property enrichment from 03/02 data.
- Full stereochemistry and chemically complete aromatic/resonance/coordination identity beyond the current graph model.
- Canonical search budget for very large/highly symmetric graphs remains bounded by the existing molecular core.
- Full save-game orchestration beyond the registry serialization contract.
- Advanced phase re-resolution for newly generated species.
- Equilibrium/electrochemistry remain out of scope.

## Handoffs
- 03: match generated canonical structures to reference compounds where possible and attach sourced property/provenance enrichment without changing internal identity.
- 02: consume only available sourced thermodynamic/kinetic properties; OPEN generated species must not receive fabricated physics.
- 04/05: player discovery/naming/encyclopedia presentation remains Game/UI ownership and must not infer knowledge from internal registry presence.
- 06: validate registry collision/dedup, restore determinism, generated-product conservation, atomic failure paths, and next-step participation with randomized graph ordering.
- 07: integrate PR #39 after normal latest-main/CI review; the temporary validation workflow is not intended for production.

## Next
**Generated Species Scientific Enrichment + Registry Validation**.
