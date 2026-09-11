import { describe, expect, it } from "vitest";
import {
  buildReferenceSpeciesIndex,
  knownSpeciesReferenceRecords,
  matchScientificReference,
  scientificReferenceSources,
  validateKnownSpeciesReferenceRecords,
  type KnownSpeciesReferenceRecord,
  type ScientificMatchGraph,
} from "../src/data/reference-enrichment";

function matchFromRecord(record: KnownSpeciesReferenceRecord) {
  return matchScientificReference({
    canonicalKey: `internal:${record.dataSpeciesId}`,
    molecularFormula: record.molecularFormula,
    netCharge: record.netCharge,
    molecularGraph: record.referenceGraph,
  });
}

function waterGraph(overrides?: { oxygenCharge?: number }): ScientificMatchGraph {
  return {
    atoms: [
      { id: "o", element: "O", formalCharge: overrides?.oxygenCharge ?? 0 },
      { id: "h1", element: "H", formalCharge: 0 },
      { id: "h2", element: "H", formalCharge: 0 },
    ],
    bonds: [
      { id: "b1", a: "o", b: "h1", kind: "covalent", order: 1 },
      { id: "b2", a: "o", b: "h2", kind: "covalent", order: 1 },
    ],
  };
}

describe("generated species scientific reference index", () => {
  it("validates the seed reference records without duplicate or provenance defects", () => {
    expect(validateKnownSpeciesReferenceRecords()).toEqual([]);
    expect(scientificReferenceSources.some((source) => source.id === "pubchem-compound-identity-2026-09")).toBe(true);
  });

  it("contains the eight current seed scientific reference identities", () => {
    expect(knownSpeciesReferenceRecords.map((record) => record.dataSpeciesId)).toEqual([
      "H2", "O2", "N2", "H2O", "CO", "CO2", "CH4", "NH3",
    ]);
  });

  it("exact-matches every charge-aware seed reference graph deterministically", () => {
    for (const record of knownSpeciesReferenceRecords) {
      const first = matchFromRecord(record);
      const second = matchFromRecord(record);
      expect(first.referenceMatchStatus, record.dataSpeciesId).toBe("EXACT_REFERENCE_MATCH");
      expect(first.referenceSpeciesId, record.dataSpeciesId).toBe(record.referenceSpeciesId);
      expect(first.enrichment, record.dataSpeciesId).toBeDefined();
      expect(second).toEqual(first);
    }
  });

  it("does not confuse formula equality with structure identity", () => {
    const disconnectedH2O: ScientificMatchGraph = {
      atoms: [
        { id: "h1", element: "H", formalCharge: 0 },
        { id: "h2", element: "H", formalCharge: 0 },
        { id: "o", element: "O", formalCharge: 0 },
      ],
      bonds: [{ id: "hh", a: "h1", b: "h2", kind: "covalent", order: 1 }],
    };
    const result = matchScientificReference({
      canonicalKey: "generated:disconnected-h2o-formula",
      molecularFormula: { H: 2, O: 1 },
      netCharge: 0,
      molecularGraph: disconnectedH2O,
    });
    expect(result.referenceMatchStatus).toBe("NO_REFERENCE_MATCH");
    expect(result.referenceSpeciesId).toBeUndefined();
    expect(result.enrichment).toBeUndefined();
  });

  it("does not match a different net charge", () => {
    const result = matchScientificReference({
      canonicalKey: "generated:h2o-plus",
      molecularFormula: { H: 2, O: 1 },
      netCharge: 1,
      molecularGraph: waterGraph({ oxygenCharge: 1 }),
    });
    expect(result.referenceMatchStatus).toBe("NO_REFERENCE_MATCH");
    expect(result.enrichment).toBeUndefined();
  });

  it("returns insufficient information when graph structure is unavailable", () => {
    const result = matchScientificReference({
      canonicalKey: "generated:h2o-formula-only",
      molecularFormula: { H: 2, O: 1 },
      netCharge: 0,
    });
    expect(result.referenceMatchStatus).toBe("INSUFFICIENT_STRUCTURE_INFORMATION");
    expect(result.candidateReferenceSpeciesIds).toEqual(["ref:pubchem:962"]);
    expect(result.enrichment).toBeUndefined();
  });

  it("treats the historical neutral-formal-charge CO graph as possible, not exact", () => {
    const legacyCO: ScientificMatchGraph = {
      atoms: [
        { id: "c", element: "C", formalCharge: 0 },
        { id: "o", element: "O", formalCharge: 0 },
      ],
      bonds: [{ id: "co", a: "c", b: "o", kind: "covalent", order: 3 }],
    };
    const result = matchScientificReference({
      canonicalKey: "legacy:co-neutral-formal-charge",
      molecularFormula: { C: 1, O: 1 },
      netCharge: 0,
      molecularGraph: legacyCO,
    });
    expect(result.referenceMatchStatus).toBe("POSSIBLE_REFERENCE_MATCH");
    expect(result.referenceSpeciesId).toBeUndefined();
    expect(result.candidateReferenceSpeciesIds).toEqual(["ref:pubchem:281"]);
    expect(result.enrichment).toBeUndefined();
    expect(result.unresolvedDimensions).toContain("FORMAL_CHARGE");
  });

  it("does not fabricate an identity or property pack for an unknown generated graph", () => {
    const unknown: ScientificMatchGraph = {
      atoms: [
        { id: "c", element: "C", formalCharge: 0 },
        { id: "h1", element: "H", formalCharge: 0 },
        { id: "h2", element: "H", formalCharge: 0 },
      ],
      bonds: [
        { a: "c", b: "h1", kind: "covalent", order: 1 },
        { a: "c", b: "h2", kind: "covalent", order: 1 },
      ],
    };
    const result = matchScientificReference({
      canonicalKey: "generated:unknown-ch2",
      molecularFormula: { C: 1, H: 2 },
      netCharge: 0,
      molecularGraph: unknown,
    });
    expect(result.referenceMatchStatus).toBe("NO_REFERENCE_MATCH");
    expect(result.referenceSpeciesId).toBeUndefined();
    expect(result.enrichment).toBeUndefined();
    expect(result.provenanceSourceIds).toEqual([]);
  });

  it("retains property provenance and keeps unsupported properties OPEN", () => {
    const water = knownSpeciesReferenceRecords.find((record) => record.dataSpeciesId === "H2O")!;
    const result = matchFromRecord(water);
    expect(result.enrichment?.availability.molarMass).toBe("APPROXIMATED");
    expect(result.enrichment?.availability.standardEnthalpyOfFormation).toBe("VERIFIED");
    expect(result.enrichment?.availability.standardMolarEntropy).toBe("VERIFIED");
    expect(result.enrichment?.availability.standardGibbsEnergyOfFormation).toBe("OPEN");
    expect(result.enrichment?.availability.meltingPoint).toBe("OPEN");
    expect(result.enrichment?.availability.boilingPoint).toBe("OPEN");
    expect(result.enrichment?.provenanceSourceIds).toContain("nist-webbook-srd69");
    expect(result.enrichment?.provenanceSourceIds).toContain("reference-molar-mass-derivation-v1");
  });

  it("reports ambiguous matching when duplicate exact structures are supplied", () => {
    const water = knownSpeciesReferenceRecords.find((record) => record.dataSpeciesId === "H2O")!;
    const duplicate: KnownSpeciesReferenceRecord = {
      ...water,
      referenceSpeciesId: "ref:test:duplicate-water",
      externalIdentifiers: { inchiKey: "TEST-DUPLICATE-WATER" },
    };
    const index = buildReferenceSpeciesIndex([water, duplicate]);
    const result = matchScientificReference({
      canonicalKey: "generated:water-ambiguous-index",
      molecularFormula: water.molecularFormula,
      netCharge: 0,
      molecularGraph: water.referenceGraph,
    }, index);
    expect(result.referenceMatchStatus).toBe("AMBIGUOUS");
    expect(result.referenceSpeciesId).toBeUndefined();
    expect(result.enrichment).toBeUndefined();
  });

  it("detects duplicate reference records", () => {
    const water = knownSpeciesReferenceRecords.find((record) => record.dataSpeciesId === "H2O")!;
    const duplicate = { ...water };
    const issues = validateKnownSpeciesReferenceRecords([...knownSpeciesReferenceRecords, duplicate]);
    expect(issues.some((issue) => issue.code === "DUPLICATE_REFERENCE_ID")).toBe(true);
    expect(issues.some((issue) => issue.code === "DUPLICATE_REFERENCE_STRUCTURE")).toBe(true);
    expect(issues.some((issue) => issue.code === "DUPLICATE_EXTERNAL_ID")).toBe(true);
  });

  it("does not collapse a reference that explicitly requires unresolved stereochemistry", () => {
    const water = knownSpeciesReferenceRecords.find((record) => record.dataSpeciesId === "H2O")!;
    const stereoSensitive: KnownSpeciesReferenceRecord = {
      ...water,
      referenceSpeciesId: "ref:test:stereo-sensitive",
      externalIdentifiers: { inchiKey: "TEST-STEREO-SENSITIVE" },
      unresolvedStructuralDimensions: ["STEREOCHEMISTRY"],
    };
    const index = buildReferenceSpeciesIndex([stereoSensitive]);
    const result = matchScientificReference({
      canonicalKey: "generated:stereo-unresolved",
      molecularFormula: stereoSensitive.molecularFormula,
      netCharge: 0,
      molecularGraph: stereoSensitive.referenceGraph,
    }, index);
    expect(result.referenceMatchStatus).toBe("INSUFFICIENT_STRUCTURE_INFORMATION");
    expect(result.unresolvedDimensions).toContain("STEREOCHEMISTRY");
    expect(result.enrichment).toBeUndefined();
  });
});
