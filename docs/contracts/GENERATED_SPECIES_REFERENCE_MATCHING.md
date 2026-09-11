# Generated Species Scientific Reference Matching & Enrichment Contract

Status: Phase 2 parallel contract for 03 Chemistry Data & Validation.

## 1. Identity separation

This layer enforces three distinct identity levels:

1. **Internal Species Identity** — owned by 01. Registry IDs, persistence, amount mutation, canonical registry keys, and generated-species lifecycle remain outside 03.
2. **Scientific Reference Identity** — owned by 03. This document defines matching to known external chemical references and scientific-property enrichment.
3. **Player Knowledge Identity** — owned by 04. Discovery, names shown to players, encyclopedia state, and UI exposure are outside 03.

A generated graph is never assumed to be a verified real-world chemical merely because 01 can register it.

## 2. Match status is not ScientificStatus

`ReferenceMatchStatus` is a separate axis from the canonical scientific-status enum.

- `EXACT_REFERENCE_MATCH` — represented formula, net charge, connectivity, bond order, atom-level formal charge, aromaticity and radical fields match one reference record uniquely.
- `POSSIBLE_REFERENCE_MATCH` — charge-insensitive represented topology matches one unique reference, but atom-level charge/radical representation does not. No scientific properties are attached.
- `NO_REFERENCE_MATCH` — no compatible record exists in the currently loaded reference index. This means only “not found in this index”; it is not evidence that the species cannot exist.
- `AMBIGUOUS` — the represented information matches multiple records and cannot uniquely select one.
- `INSUFFICIENT_STRUCTURE_INFORMATION` — the input is missing graph information, internally inconsistent, exceeds the matching representation budget, or lacks a structural dimension required to resolve a reference identity.

Canonical `ScientificStatus` remains:

- `VERIFIED`
- `APPROXIMATED`
- `EMPIRICAL`
- `GAMEPLAY_SIMPLIFICATION`
- `OPEN`

The two status systems must never be used as synonyms.

## 3. Matching basis

The current reference fingerprint uses, when available:

- molecular formula;
- atom connectivity;
- bond order;
- bond kind/aromaticity;
- atom formal charge;
- net charge;
- explicit radical-electron count.

The current production molecular model has no dedicated stereochemistry field. Therefore stereochemical identity must remain unresolved whenever stereochemistry can distinguish references. Electronic/spin-state identity is also not treated as fully resolved by the 2D constitution graph unless a future contract carries it explicitly.

The 03 fingerprint is **not** an 01 canonical registry identity. `ScientificMatchInput.canonicalKey` is opaque trace metadata from 01. 03 neither interprets nor generates the registry key.

## 4. Minimum 01 input

```ts
interface ScientificMatchInput {
  canonicalKey: string;
  molecularFormula: Readonly<Record<string, number>>;
  netCharge: number;
  molecularGraph?: ScientificMatchGraph;
}
```

`ScientificMatchGraph` is deliberately a small structural compatibility shape rather than an import from an unmerged 01 registry implementation. Current production `MolecularGraph` is structurally compatible through a boundary adapter.

01 must provide internally consistent formula, net charge and graph. If supplied values disagree, 03 returns `INSUFFICIENT_STRUCTURE_INFORMATION`; it never guesses which representation is authoritative.

## 5. Output contract

```ts
interface ScientificReferenceMatch {
  internalCanonicalKey: string;
  referenceMatchStatus: ReferenceMatchStatus;
  referenceSpeciesId?: string;
  candidateReferenceSpeciesIds: readonly string[];
  scientificStatus: ScientificStatus;
  confidence: Confidence;
  matchedDimensions: readonly ReferenceStructuralDimension[];
  unresolvedDimensions: readonly ReferenceStructuralDimension[];
  provenanceSourceIds: readonly string[];
  enrichment?: ScientificPropertyEnrichment;
  notes: readonly string[];
}
```

`referenceSpeciesId` and `enrichment` are emitted only for a unique exact reference match. A possible, ambiguous, insufficient, or absent match never receives known-compound properties.

## 6. Performance/indexing

Reference matching is indexed once as:

`formula bucket -> net-charge filter -> exact reference fingerprint -> collision/ambiguity check`

A charge/radical-insensitive topology fingerprint is evaluated only after exact matching fails and only to report `POSSIBLE_REFERENCE_MATCH`.

There is no per-timestep full-database graph scan. The intended call point is generated-species registration/first enrichment or an explicit rematch after reference-data version changes, not every simulation tick.

## 7. Seed scientific references

The initial reference index contains only the existing minimum chemistry species:

- H2 — PubChem CID 783
- O2 — PubChem CID 977
- N2 — PubChem CID 947
- H2O — PubChem CID 962
- CO — PubChem CID 281
- CO2 — PubChem CID 280
- CH4 — PubChem CID 297
- NH3 — PubChem CID 222

PubChem identity metadata supplies the external CID/InChIKey/common identity layer. Existing Phase 2C NIST/CIAAW/RSC-backed property records remain the property source of truth; PubChem identity matching does not overwrite thermochemistry provenance.

### Carbon-monoxide representation caveat

The current production molecular test fixture historically encodes CO as neutral-formal-charge `C#O`. PubChem represents the compound as `[C-]#[O+]`. Because formal charge is part of the scientific matching contract, the neutral historical graph is intentionally classified only as a possible reference match. A charge-aware `C(-1)#O(+1)` graph can exact-match the reference record.

This is a scientific representation issue, not an instruction for 01 to mutate existing registered species automatically. 01/00 must decide any future canonical-graph migration separately.

## 8. Enrichment policy

Only `EXACT_REFERENCE_MATCH` can attach:

- derived molar mass;
- phase-specific standard formation enthalpy;
- standard molar entropy;
- Gibbs formation energy when present;
- heat-capacity records when present;
- phase data;
- bond-reference records;
- acid/base, redox, and solubility records when present.

Missing properties remain `OPEN`; the matcher never creates a numeric placeholder.

The seed molar mass is a deterministic sum of the existing CIAAW-anchored element molar-mass projections and is therefore `APPROXIMATED`, not an isotope-specific exact mass.

## 9. Provenance/confidence rules

Identity matching and property provenance remain separate:

- external identity: reference-database source IDs such as PubChem;
- property data: existing NIST/CIAAW/RSC source measurements from the minimum chemistry pack;
- internal derivation: explicitly labelled for derived molar mass only.

Exact reference matching does not upgrade an `APPROXIMATED` or `EMPIRICAL` property to `VERIFIED`. Property status remains the status of the property record itself.

## 10. No-fabrication rules

The layer must never:

- invent a chemical name for an unmatched graph;
- treat formula equality as compound identity;
- attach a known compound’s properties to a possible/ambiguous match;
- collapse stereoisomers when stereochemistry is unavailable;
- fill missing property values with guessed numbers;
- interpret `NO_REFERENCE_MATCH` as “chemically impossible”.

## 11. 01 integration assumptions

01 should call the matcher only after it has a stable generated molecular graph and internal canonical key. Recommended integration point:

`generated graph -> 01 registry identity/persistence -> boundary adapter -> 03 matchScientificReference -> optional exact-match enrichment metadata`

03 output should be stored as optional scientific metadata alongside, not inside, the authority of the 01 registry identity. A reference-data update may change reference-match metadata without changing internal species identity.

01 must not import 03 reference records as reaction-generation rules.

## 12. Current structural limitations

- stereochemistry: `OPEN` — no dedicated current graph field;
- electronic/spin state: partially represented at best; not a state-resolved identity contract;
- isotopic identity: `OPEN` — current seed references describe ordinary composition, not isotope-labelled species;
- tautomers/resonance normalization: no general equivalence engine; atom-level charge differences remain non-exact unless explicitly represented by the reference record;
- reference coverage: intentionally tiny; absence from the seed index is not evidence of nonexistence.
