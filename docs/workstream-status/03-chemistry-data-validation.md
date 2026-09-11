# 03 — Chemistry Data & Validation

- Owner: Chemistry Data Researcher / Chemical Property Data Engineer / Scientific Reference Analyst / Chemistry Model Validation Researcher
- Current phase: Generated Species Scientific Reference Matching & Enrichment
- Overall state: PASS — READY_FOR_REVIEW
- Last updated: 2026-09-12
- Starting / latest checked main SHA: `4c12c2b9be6053887f471c288618590114dc32b4`
- Active branch: `feature/generated-species-reference-enrichment`
- Active PR: pending creation
- Exact executable/test HEAD validated by Actions: `b58731e7ed17c604d0e1af7907fdd589728b1d14`
- Validation run: `34636295729` — SUCCESS

## Objective
Provide a 03-owned scientific identity layer for molecular graphs generated and persisted by 01 without conflating structural validity, internal registry identity, real-world reference identity, or player knowledge.

Canonical flow:

`01 generated/internal species -> structural match input -> 03 scientific reference index -> match confidence/status -> exact-only property enrichment`

A generated graph is never treated as a verified real-world chemical merely because the simulation can register it.

## Source Architecture Audit
- Production main `4c12c2b9...` already contains the Phase 2C H/C/N/O chemistry data pack, thermochemistry/reference-phase data, source records, property status/confidence, and SI normalization.
- Production molecular identity currently represents element, connectivity, bond kind/order, formal charge, optional radical electrons and oxidation state in its canonical structural representation.
- Current molecular graph has no dedicated stereochemistry field.
- 01 parallel branch `feature/dynamic-species-registry` / PR #39 was inspected read-only. Its registry keeps `mol-v1` internal canonical identity, generated IDs, provenance, and OPEN scientific state separate from real-world matching.
- 01 currently has a registry-local placeholder `ReferenceMatchStatus = "KNOWN_SEED" | "OPEN"`. This is intentionally not reused as the 03 scientific matching taxonomy. 03 exposes `ScientificReferenceMatchStatus` as the public handoff name and does not modify 01-owned files.

## Scientific Reference Matching Contract
03 defines a separate five-state match axis:

- `EXACT_REFERENCE_MATCH`
- `POSSIBLE_REFERENCE_MATCH`
- `NO_REFERENCE_MATCH`
- `AMBIGUOUS`
- `INSUFFICIENT_STRUCTURE_INFORMATION`

This is independent of canonical `ScientificStatus` (`VERIFIED`, `APPROXIMATED`, `EMPIRICAL`, `GAMEPLAY_SIMPLIFICATION`, `OPEN`).

Matching basis currently includes:
- molecular formula;
- net charge;
- atom connectivity;
- bond kind/order and aromaticity representation;
- atom-level formal charge;
- explicit radical-electron count when represented.

Unsupported/unresolved dimensions such as stereochemistry or general electronic/spin-state identity are carried explicitly rather than silently collapsed.

## Reference Index
Initial known scientific reference records cover the current eight seed species:

- H2 — PubChem CID 783
- O2 — PubChem CID 977
- N2 — PubChem CID 947
- H2O — PubChem CID 962
- CO — PubChem CID 281
- CO2 — PubChem CID 280
- CH4 — PubChem CID 297
- NH3 — PubChem CID 222

Each reference record carries:
- 03 `referenceSpeciesId`;
- existing Phase 2C `dataSpeciesId`;
- common name;
- formula/net charge;
- charge-aware reference graph;
- PubChem CID/InChIKey/CAS metadata where recorded;
- identity provenance;
- data quality, confidence and scientific status;
- unresolved structural dimensions/notes where relevant.

Performance path is:

`formula bucket -> net-charge filter -> exact reference fingerprint -> ambiguity/collision check`

Only after exact matching fails is a charge/radical-insensitive topology fingerprint used to report a possible match. Matching is intended for registration/enrichment time, not every simulation timestep.

## Important CO Audit
Production historical molecular fixtures represent CO as neutral-formal-charge `C#O`. The PubChem reference structure is charge-separated `[C-]#[O+]`.

Therefore:
- charge-aware `C(-1)#O(+1)` -> exact reference match;
- historical neutral `C#O` -> `POSSIBLE_REFERENCE_MATCH` only;
- no CO reference properties are attached to the possible match.

03 does not migrate or mutate 01 canonical registry graphs in this workstream.

## Enrichment Schema
Only a unique `EXACT_REFERENCE_MATCH` receives `ScientificPropertyEnrichment`.

Supported attachment surfaces:
- derived molar mass;
- standard formation enthalpy;
- standard molar entropy;
- Gibbs formation energy when present;
- heat-capacity data when present;
- phase-equilibrium data;
- bond references;
- acid/base, redox and solubility records when present.

Each property keeps its own existing provenance/status/confidence. Exact identity does not promote an `APPROXIMATED` or `EMPIRICAL` property to `VERIFIED`.

Generated-species molar mass is derived from existing CIAAW-anchored Phase 2C element molar-mass projections and remains `APPROXIMATED`, not isotope-specific exact mass.

Missing properties remain `OPEN`; no number is fabricated.

## Unknown / Non-exact Behavior
- Unknown formula/index miss -> `NO_REFERENCE_MATCH`; no invented name or properties.
- Same formula but different connectivity/bonding -> no false exact match.
- Different net charge -> no match to neutral reference.
- Missing graph -> `INSUFFICIENT_STRUCTURE_INFORMATION`.
- Internally inconsistent formula/net charge vs graph -> insufficient information.
- Duplicate exact references -> `AMBIGUOUS`.
- Unique topology but different atom-level formal charge/radical representation -> `POSSIBLE_REFERENCE_MATCH`; no enrichment.
- Stereochemistry-required identity while stereo is unavailable -> insufficient information; no enrichment.

`NO_REFERENCE_MATCH` means only “not present in the currently loaded reference index”, not “chemically impossible”.

## Provenance
Identity provenance:
- PubChem Compound reference records for external identity metadata.

Property provenance remains the existing Phase 2C hierarchy:
- CIAAW atomic-weight references;
- NIST Atomic Spectra Database;
- NIST Chemistry WebBook;
- RSC compiled element/bond references;
- explicit internal derivation record only where a derived quantity is generated.

Identity source provenance and property source provenance remain separate and are both surfaced in enrichment results.

## 01 Handoff
Required minimum input:

```ts
ScientificMatchInput = {
  canonicalKey: string; // opaque 01 trace identity
  molecularFormula: Readonly<Record<string, number>>;
  netCharge: number;
  molecularGraph?: ScientificMatchGraph;
}
```

Current 01 `MoleculeRecord` can be adapted to this structurally without importing the unmerged registry implementation into 03.

Output:
- `matchScientificReference(input): ScientificReferenceMatch`
- public 03 status alias: `ScientificReferenceMatchStatus`
- reference ID only on unique exact match;
- optional enrichment only on unique exact match;
- matched/unresolved dimensions, confidence/status, candidate IDs and provenance.

Integration assumption:
1. 01 establishes stable internal identity first.
2. A boundary adapter sends structural data to 03.
3. 03 match metadata is stored alongside or outside the registry identity.
4. Future reference-data rematching may change enrichment without changing the internal species ID.

Do not make 01 IDs depend on PubChem IDs, chemical names, property availability or 03 match status.

Detailed handoff: `docs/handoffs/03-generated-species-reference-enrichment.md`.

## Tests / Validation
Exact validated executable/test HEAD: `b58731e7ed17c604d0e1af7907fdd589728b1d14`.
GitHub Actions run `34636295729`: SUCCESS.

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- targeted `tests/generated-species-reference-enrichment.test.ts`: **12/12 PASS**
- full `npm test`: **13 files / 149/149 PASS**
- `npm run lint`: PASS

The validation workflow was branch-only and removed after the successful run. Later changes are workflow cleanup and documentation/handoff only; validated executable/test source is unchanged.

Targeted tests cover:
- exact seed reference graphs;
- formula same / structure different false-match prevention;
- different charge rejection;
- missing structural information;
- historical neutral CO -> possible, not exact;
- unknown generated graph -> no fabricated identity/properties;
- provenance retention and OPEN missing properties;
- ambiguity from duplicate structures;
- duplicate reference validation;
- unresolved stereochemistry behavior.

## Scientific Status

### Exact identity matching — PASS within represented dimensions
Unique charge-aware seed reference structures match deterministically, with exact matching gated on represented connectivity/bonding/formal charge/radicals. Exact identity is not claimed beyond dimensions carried by the current graph model.

### Property enrichment — PASS / incomplete-by-design
Exact references can safely reuse existing sourced Phase 2C property records and derived molar mass. Missing fields remain OPEN. Possible/ambiguous/unknown matches receive no known-compound property attachment.

### Unsupported structural distinctions — OPEN
- stereochemistry;
- general electronic/spin-state resolution;
- isotope-labelled molecular identity;
- general tautomer/resonance equivalence;
- broad external compound coverage beyond the eight seed records.

## PASS / APPROXIMATED / OPEN

### PASS
- five-state scientific reference matching contract separated from ScientificStatus;
- eight-species reference index;
- formula-first indexed lookup and deterministic structural fingerprinting;
- exact-only enrichment;
- no-fabrication unknown behavior;
- duplicate/provenance/reference validation;
- 01 loose-coupling handoff;
- targeted/full regression/typecheck/lint.

### APPROXIMATED
- molecular molar mass derived from Phase 2C natural-composition element projections;
- charge-insensitive topology fallback is used only to label `POSSIBLE_REFERENCE_MATCH`, never as exact identity.

### OPEN
- stereo/state/isotope/tautomer-resonance-complete identity;
- large reference database ingestion/search;
- automatic 01 registry metadata persistence of 03 results;
- property expansion beyond currently sourced Phase 2C data;
- any future canonical representation migration for historical CO or other seed graphs.

## Files Added/Changed
- `src/data/reference-enrichment.ts`
- `src/data/reference-enrichment-interface.ts`
- `src/data/index.ts`
- `tests/generated-species-reference-enrichment.test.ts`
- `docs/contracts/GENERATED_SPECIES_REFERENCE_MATCHING.md`
- `docs/handoffs/03-generated-species-reference-enrichment.md`
- this workstream status document

No 01 production implementation file was modified.
