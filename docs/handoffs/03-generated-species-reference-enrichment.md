# 03 -> 01 Handoff — Generated Species Scientific Reference Enrichment

## Scope boundary

03 matches already-created molecular structures to scientific reference identities and attaches sourced metadata only after a safe match. 03 does not generate graphs, allocate internal species IDs, mutate amounts, control reaction progression, or expose player knowledge.

## Current parallel 01 contract audit

Observed on `feature/dynamic-species-registry` / PR #39:

- registry identity is `mol-v1` canonical molecular identity;
- generated IDs are `generated:<canonicalKey>`;
- `DynamicSpeciesRecord` retains `molecule`, `canonicalKey`, structural validation, provenance and OPEN scientific state;
- 01 currently defines a registry-local placeholder `ReferenceMatchStatus = "KNOWN_SEED" | "OPEN"`.

That placeholder is not the 03 scientific match taxonomy and must not be widened or replaced from this branch. 03 exposes the public alias `ScientificReferenceMatchStatus` for its five-state matching result so integration code can keep the contracts distinct.

## Required input from 01

Minimum boundary input:

```ts
{
  canonicalKey: string;
  molecularFormula: Readonly<Record<string, number>>;
  netCharge: number;
  molecularGraph: {
    atoms: readonly {
      id: string;
      element: string;
      formalCharge: number;
      radicalElectrons?: number;
    }[];
    bonds: readonly {
      id?: string;
      a: string;
      b: string;
      kind: string;
      order: number;
    }[];
  };
}
```

The current 01 `MoleculeRecord` can provide these values without 03 importing the registry implementation.

`canonicalKey` is opaque to 03 and is returned only for traceability. Scientific matching is recalculated from the supplied structural information and does not treat a matching internal key as scientific evidence.

## Output

Use `matchScientificReference(input)`.

Result includes:

- `referenceMatchStatus` using the 03 five-state scientific-reference taxonomy;
- optional `referenceSpeciesId` only for unique exact matches;
- candidate reference IDs for possible/ambiguous/insufficient cases;
- scientific status and confidence;
- matched and unresolved structural dimensions;
- provenance source IDs;
- optional property enrichment only for exact matches.

Public handoff type name for the status is `ScientificReferenceMatchStatus` to avoid collision with the current 01 registry-local placeholder type.

## Integration rule

Recommended integration sequence:

1. 01 validates and registers the graph, establishing stable internal identity.
2. A boundary adapter reads the registered `MoleculeRecord` without mutating it.
3. 03 `matchScientificReference` evaluates the structure.
4. The returned scientific metadata may be cached/stored alongside the registry record or in a separate enrichment store.
5. A later reference-dataset version may rematch/enrich the same internal species without changing its 01 identity.

Do not make the 01 generated ID depend on PubChem CID, common name, property availability, or 03 reference status.

## Exact-match policy

Only `EXACT_REFERENCE_MATCH` receives known-compound property enrichment.

- `POSSIBLE_REFERENCE_MATCH`: no property attachment.
- `AMBIGUOUS`: no property attachment.
- `INSUFFICIENT_STRUCTURE_INFORMATION`: no property attachment.
- `NO_REFERENCE_MATCH`: no name/property fabrication.

## Current seed caveat

The historical production CO graph is neutral-formal-charge `C#O`, while the scientific reference record uses the charge-separated representation `[C-]#[O+]`. It therefore returns `POSSIBLE_REFERENCE_MATCH` under the current 03 contract unless 01 supplies the charge-aware representation. 03 does not request an automatic registry migration in this PR.

## Unsupported identity dimensions

Current graph input cannot fully establish:

- stereochemistry;
- general electronic/spin state;
- isotope-labelled identity;
- general tautomer/resonance equivalence.

Where such a dimension is necessary to distinguish reference compounds, the result must remain insufficient/ambiguous rather than exact.
