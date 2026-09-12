# Generated Species Player Knowledge Contract

## Status
PROPOSED BY 04 — Laboratory Gameplay

This document defines the Game Layer boundary between internally registered/generated species and player-visible scientific knowledge.

Core invariant:

> Internal existence does not imply player knowledge.

A species may exist in Simulation Core and in the 01 species registry while remaining unknown to the normal player.

## Lifecycle

Canonical lifecycle:

`internal species exists -> unknown player projection -> observation -> analysis -> optional hypothesis -> authoritative identity confirmation -> SpeciesDiscovery -> Encyclopedia registration -> material access unlock`

Generated species use the same discovery/progression path as known/reference-backed species. There is no second generated-species progression system.

## 01 -> 04 Interface

04 requires only a loose descriptor from 01-facing integration:

```ts
interface InternalSpeciesDescriptor {
  speciesId: string; // stable across save/load for the same canonical registry identity
  origin: "known" | "generated";
  scientificReferenceMatch?:
    | "REFERENCE_BACKED"
    | "REFERENCE_MATCHED"
    | "GENERATED_UNVERIFIED"
    | "OPEN";

  // Developer/debug or post-confirmation metadata only.
  verifiedCommonName?: string;
  molecularFormula?: string;
  molecularGraphRef?: string;
  registryMetadataRef?: string;
}
```

04 does not require a player-facing name. A generated species may remain unnamed indefinitely.

01 owns:

- SpeciesId generation/stability;
- registry persistence;
- graph canonicalization;
- molecular graph content;
- generated/known structural identity;
- duplicate structural identity handling.

04 must not recreate any of those mechanisms.

## Normal Projection

Before valid identity confirmation, normal UI receives an opaque Game Layer projection only:

```ts
interface UnknownSpeciesProjection {
  kind: "unknown-species";
  unknownRef: string;
  displayLabel: string; // e.g. "Unknown substance"
  observed: boolean;
  analyzed: boolean;
  identityHypothesisAvailable: boolean;
  identityConfirmed: boolean;
}
```

Normal projection must not contain:

- internal SpeciesId;
- internal registry identifier;
- canonical molecular formula;
- molecular graph;
- verified/common name;
- reference-match metadata;
- registry/debug metadata.

`unknownRef` is a Game Layer opaque correlation key. It is not the internal SpeciesId and must not encode player-readable registry metadata.

## Developer Mode

Developer Mode may additionally expose:

- stable SpeciesId;
- origin (`known` / `generated`);
- molecular graph reference;
- formula;
- registry metadata reference;
- scientific reference match state;
- verified/common name when available.

Developer projection changes observability only. It does not modify normal progression, discovery, inventory entitlement, chemistry, or registry state.

## Scientific Record

Generated unknown species follow `LAB_NOTEBOOK_SCIENTIFIC_KNOWLEDGE.md`.

Automatic Scientific Record data may include:

- measured mass;
- temperature;
- pressure;
- volume;
- instrument output;
- raw spectrum/data;
- elapsed time;
- experiment provenance;
- reaction/phase observations that are legitimately player-observable;
- measurement uncertainty.

Automatic records must not reveal hidden identity through field names, payloads, reference IDs, or debug metadata.

Repeated authoritative observation IDs are ingested idempotently; distinct observations remain in history.

## My Notes

My Notes attach to the Game Layer knowledge entry for the stable species association and its `unknownRef` history.

Notes are free-form and ungraded. Examples include player-authored observations such as apparent response to heating, water, or similarity to an earlier sample.

Notes:

- do not unlock species;
- are not truth-graded;
- survive identity confirmation;
- survive save/load;
- remain associated with the same stable SpeciesId-backed knowledge entry.

## Structured Hypotheses

Optional structured hypotheses may cover:

- identity;
- molecular formula;
- molecular structure;
- selected quantitative inference.

04 stores hypothesis/submission lifecycle only. Scientific grading remains provider-owned under the Notebook contract.

## Confirmation and Progression

Authoritative identity confirmation must be represented using the existing progression boundary (`IdentityConfirmedEvent`).

04 then reuses the existing progression state machine:

`IdentityConfirmedEvent -> SpeciesDiscovery -> EncyclopediaEntryState -> InventoryUnlockState`

The knowledge entry is updated consistently with progression:

- `identityConfirmed = true`;
- `encyclopediaRegistered = true`;
- `materialAccessUnlocked = true`.

Duplicate internal observations or duplicate references to the same stable SpeciesId must not create duplicate knowledge entries or duplicate encyclopedia discoveries.

## Unlimited Stock

After normal progression unlock:

- the generated species has unlimited Game Layer laboratory stock;
- repeated experiments do not deplete a stock counter;
- every actual vessel addition still has explicit finite `amountMol > 0`;
- `NaN`/`Infinity` remain invalid;
- Simulation Core remains unaware of inventory entitlement.

## Real-World Identity and 03 Boundary

A structurally valid generated graph is not automatically a real-world named compound claim.

03 may later provide:

```ts
interface ScientificReferenceIdentityUpdate {
  speciesId: string;
  matchState:
    | "REFERENCE_BACKED"
    | "REFERENCE_MATCHED"
    | "GENERATED_UNVERIFIED"
    | "OPEN";
  verifiedCommonName?: string;
  provenanceRefs?: readonly string[];
  propertyEvidenceRefs?: readonly string[];
}
```

Rules:

- no DB/reference match does not mean the simulated species is impossible;
- generated/unverified species may accumulate experiments, measurements, notes, hypotheses, and discovery history;
- 04 never invents a real-world name or precise reference property;
- reference support is separate from player discovery state.

## Persistence

Player-knowledge persistence keys the knowledge entry by stable 01 SpeciesId while preserving the opaque player-history `unknownRef`.

Saved state must preserve:

- species association;
- unknownRef;
- observed/analyzed/confirmed state;
- Scientific Record/history;
- My Notes;
- structured hypotheses;
- analysis refs;
- encyclopedia/unlock linkage;
- origin/reference-support status where applicable;
- schema version.

Required invariant:

> Restoring the same registry SpeciesId must restore the same player knowledge association; knowledge may not migrate to another species or disappear silently.

Serialization should be deterministic. Unknown schema versions must fail explicitly or use an approved migration path rather than silently reassigning knowledge.

## Identity Leakage Validation

06 should verify at minimum:

- normal projection before confirmation contains no SpeciesId, formula, graph, name, registry metadata, or reference-match information;
- automatic Scientific Record entries cannot leak hidden identity through nested payloads;
- Developer Mode exposes internals without mutating normal progression;
- save/restore preserves knowledge-to-SpeciesId association;
- duplicate references to the same SpeciesId do not create duplicate Encyclopedia entries;
- confirmation invokes the same progression/unlimited-inventory path used by ordinary species;
- every unlocked material addition remains finite.

## Current OPEN

- exact final 01 generated-species descriptor/type names;
- whether 01 supplies a dedicated public origin/reference-support DTO or integration adapter creates it;
- exact analyzer/verification path that produces authoritative identity confirmation;
- reference-match update event shape from 03;
- future schema migration from generated-knowledge v1;
- policy for confirmed but permanently unnamed generated species display labels.
