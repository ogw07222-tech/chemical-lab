# Dynamic Species Registry & Generated Species Persistence

Status: EXECUTABLE FOUNDATION
Owner: 01 — Chemistry Simulation Engine

## Identity layers

The registry deliberately separates three concepts:

1. **Internal molecular identity** — deterministic structural identity derived from the molecular graph.
2. **Scientific real-world identity** — whether 03/reference data has established a match to a known compound.
3. **Player knowledge identity** — discovery/name/encyclopedia state owned by 04/Game Layer and not stored here.

A generated structure may therefore be internally stable while remaining `referenceMatchStatus: OPEN` and `scientificStatus: OPEN`.

## Canonical identity

The registry reuses the Phase 1 molecular core:

- `canonicalStructuralRepresentation(graph)` for exact structure representation;
- `mol-v1-*` `MoleculeRecord.canonicalKey` for indexed lookup.

The representation includes the currently modeled atom invariant (element, formal charge, radical-electron count, oxidation state), connectivity, bond kind, and bond order. Runtime atom IDs and atom-array ordering are excluded from identity.

Phase is not molecular identity. Player discovery/progression is not molecular identity. Provenance is not molecular identity.

Current OPEN limitations include full stereochemistry and chemically complete aromatic/resonance/coordination canonicalization beyond what the graph model explicitly represents.

## Collision safety / performance

Primary lookup is `canonicalKey -> record` using a map. A matching key is accepted only when the stored exact canonical structural representation also matches. A key collision with a different representation is rejected rather than silently merging distinct structures.

Generated ids are deterministic: `generated:<canonicalKey>`. A conflicting id/key is an explicit error.

## Registration gate

Before a graph can enter the registry it must pass:

- molecular graph validation;
- molecule record/formula/net-charge consistency;
- canonicalization under `mol-v1`;
- current coarse valence sanity.

Malformed graphs and canonicalization failures return INVALID and cannot mutate vessel state.

## Records

A registry record stores:

- stable `speciesId`;
- canonical key + exact canonical structural representation;
- canonical `MoleculeRecord`;
- `origin: KNOWN | GENERATED`;
- `validationState: STRUCTURALLY_VALID`;
- `referenceMatchStatus: KNOWN_SEED | OPEN`;
- canonical scientific status;
- generated-species provenance where applicable.

Generated records default to `scientificStatus: OPEN` and `referenceMatchStatus: OPEN`. Structural validity does not imply experimental existence, property availability, or real-world identity.

01 does not invent density, phase boundaries, pKa, thermochemistry, entropy, Gibbs energy, redox potential, or kinetic constants. 03/02 enrichment remains separate.

## Provenance

Generated provenance can retain candidate id, parent reactant species ids, reaction family, timestep, product index, and canonicalization version. Provenance is deduplicated/sorted deterministically and never changes molecular identity.

## Persistence

`registry.serialize()` produces a save/load-friendly schema-versioned snapshot. `restoreDynamicSpeciesRegistry()` revalidates every record, canonical identity, generated-id determinism, and canonicalization version before accepting it.

Restore preserves generated species ids and lookup identity.

## Phase 2E atomic integration

`resolveReactionCandidatesWithRegistry()` stages product resolution in an immutable working registry and zero-amount vessel states. The existing Phase 2E resolver then performs ranking/competition/extent/conservation.

Only products belonging to selected reactions are committed to the returned registry/state. Registration failure or downstream conservation failure cannot partially consume reactants because the original input registry/state are never mutated in place.

Generated product states start with phase `unknown`, source `dynamic-species-registry`, and scientific status `OPEN`; full phase re-resolution remains a separate 02/phase hook.

New generated species have zero amount at timestep start, so the existing Phase 2E `ZERO_INITIAL_REACTANT` rule prevents hidden same-step cascades. Once returned with positive amount, they are normal `SpeciesState` inputs for the next timestep and may participate in reactive-site/candidate generation.

## Out of scope

- real-world automatic compound naming / IUPAC naming;
- external database lookup;
- property prediction;
- quantum chemistry;
- player discovery/encyclopedia/inventory entitlement;
- equilibrium/electrochemistry/advanced phase solving.
