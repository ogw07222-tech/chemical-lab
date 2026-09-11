import { describe, expect, it } from "vitest";
import {
  minimumBondEnergies,
  minimumChemistryDataBundle,
  minimumChemistryDataProvider,
  minimumChemistryReferenceCases,
  minimumElementProvider,
  minimumElementRecords,
  minimumElements,
  minimumSources,
  minimumThermodynamics,
  validateChemistryDataBundle,
  validateMinimumChemistryDataPack,
  type ChemistryDataBundle,
  type ElementData,
} from "../src/data";

function replaceFirstElement(bundle: ChemistryDataBundle, element: ElementData): ChemistryDataBundle {
  return { ...bundle, elements: [element, ...bundle.elements.slice(1)] };
}

describe("Phase 2C minimum chemistry data pack", () => {
  it("passes schema, SI, provenance, finiteness, and duplicate validation", () => {
    expect(validateMinimumChemistryDataPack()).toEqual({ valid: true, issues: [] });
  });

  it("covers exactly the initial H/C/N/O element set", () => {
    expect(minimumElements.map((element) => element.symbol)).toEqual(["H", "C", "N", "O"]);
    expect(minimumElementProvider.getElement("Na")).toBeUndefined();
    expect(minimumElementProvider.getElement("Cl")).toBeUndefined();
  });

  it("projects provenance data deterministically into the 01 ElementProvider interface", () => {
    const first = minimumElementProvider.getElement("C");
    const second = minimumElementProvider.getElement("C");
    expect(first).toBe(second);
    expect(first).toMatchObject({
      atomicNumber: 6,
      symbol: "C",
      valenceElectrons: 4,
      commonOxidationStates: [4, 2, -4],
      typicalValences: [4],
      electronegativity: 2.55,
    });
    expect(first?.atomicMolarMassKgPerMol).toBeCloseTo(0.012011, 9);
  });

  it("provides phase-specific 02 thermochemistry lookups with explicit missing behavior", () => {
    const waterGas = minimumChemistryDataProvider.getSpeciesThermodynamics("H2O", "gas");
    const waterLiquid = minimumChemistryDataProvider.getSpeciesThermodynamics("H2O", "liquid");
    expect(waterGas?.standardEnthalpyOfFormation?.normalizedValue).toBe(-241_826);
    expect(waterLiquid?.standardEnthalpyOfFormation?.normalizedValue).toBe(-285_830);
    expect(minimumChemistryDataProvider.getSpeciesThermodynamics("H2O", "solid")).toBeUndefined();
    expect(minimumChemistryDataProvider.getSpeciesThermodynamics("UNKNOWN")).toBeUndefined();
  });

  it("keeps known unsupported values explicit instead of inventing defaults", () => {
    const nitrogen = minimumChemistryDataProvider.getElementData("N");
    expect(nitrogen?.electronAffinity).toBeUndefined();
    expect(nitrogen?.atomicMass).toBeUndefined();
    expect(minimumChemistryDataProvider.getElementData("Na")).toBeUndefined();
  });

  it("returns selected bond reference values deterministically", () => {
    expect(minimumChemistryDataProvider.getBondEnergyById("bond-H-H-H2")?.normalizedValue).toBe(435_900);
    expect(minimumChemistryDataProvider.findBondEnergies({ speciesId: "CO2", bondOrder: 2 })).toHaveLength(1);
    expect(minimumChemistryDataProvider.getBondEnergyById("missing-bond")).toBeUndefined();
  });

  it("has no duplicate public IDs", () => {
    expect(new Set(minimumSources.map((source) => source.id)).size).toBe(minimumSources.length);
    expect(new Set(minimumElements.map((element) => element.symbol)).size).toBe(minimumElements.length);
    expect(new Set(minimumBondEnergies.map((bond) => bond.id)).size).toBe(minimumBondEnergies.length);
    expect(new Set(minimumChemistryReferenceCases.map((reference) => reference.id)).size).toBe(minimumChemistryReferenceCases.length);
    expect(new Set(minimumThermodynamics.map((record) => `${record.speciesId}:${record.phase}`)).size).toBe(minimumThermodynamics.length);
  });

  it("rejects duplicate identifiers", () => {
    const duplicate: ChemistryDataBundle = {
      ...minimumChemistryDataBundle,
      sources: [...minimumSources, minimumSources[0]!],
    };
    const result = validateChemistryDataBundle(duplicate);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "DUPLICATE_SOURCE_ID")).toBe(true);
  });

  it("rejects NaN and Infinity rather than treating them as missing", () => {
    const original = minimumElements[0]!;
    const nanElement: ElementData = {
      ...original,
      atomicNumber: { ...original.atomicNumber, normalizedValue: Number.NaN },
    };
    const infinityElement: ElementData = {
      ...original,
      firstIonizationEnergy: original.firstIonizationEnergy
        ? { ...original.firstIonizationEnergy, normalizedValue: Number.POSITIVE_INFINITY }
        : undefined,
    };

    expect(validateChemistryDataBundle(replaceFirstElement(minimumChemistryDataBundle, nanElement)).issues.some((issue) => issue.code === "NON_FINITE_NUMBER")).toBe(true);
    expect(validateChemistryDataBundle(replaceFirstElement(minimumChemistryDataBundle, infinityElement)).issues.some((issue) => issue.code === "NON_FINITE_NUMBER")).toBe(true);
  });

  it("requires provenance for populated properties", () => {
    const original = minimumElements[0]!;
    const missingProvenance: ElementData = {
      ...original,
      atomicNumber: { ...original.atomicNumber, sourceMeasurements: [] },
    };
    const result = validateChemistryDataBundle(replaceFirstElement(minimumChemistryDataBundle, missingProvenance));
    expect(result.issues.some((issue) => issue.code === "MISSING_SOURCE_MEASUREMENT")).toBe(true);
  });

  it("rejects source references that are not registered", () => {
    const original = minimumElements[0]!;
    const badSource: ElementData = {
      ...original,
      atomicNumber: {
        ...original.atomicNumber,
        sourceMeasurements: original.atomicNumber.sourceMeasurements.map((measurement) => ({
          ...measurement,
          sourceId: "missing-source",
        })),
      },
    };
    const result = validateChemistryDataBundle(replaceFirstElement(minimumChemistryDataBundle, badSource));
    expect(result.issues.some((issue) => issue.code === "UNKNOWN_SOURCE_ID")).toBe(true);
  });

  it("rejects a non-SI normalized unit even if a malformed external object bypasses TypeScript", () => {
    const original = minimumElements[0]!;
    const malformed = {
      ...original,
      firstIonizationEnergy: original.firstIonizationEnergy
        ? { ...original.firstIonizationEnergy, normalizedUnit: "eV" }
        : undefined,
    } as unknown as ElementData;
    const result = validateChemistryDataBundle(replaceFirstElement(minimumChemistryDataBundle, malformed));
    expect(result.issues.some((issue) => issue.code === "NON_CANONICAL_UNIT")).toBe(true);
  });

  it("resolves every sourced 06 reference-case source ID", () => {
    const sourceIds = new Set(minimumSources.map((source) => source.id));
    for (const reference of minimumChemistryReferenceCases) {
      for (const sourceId of reference.sourceIds) {
        expect(sourceIds.has(sourceId), `${reference.id} -> ${sourceId}`).toBe(true);
      }
    }
  });

  it("keeps thermochemical reference expectations consistent with stored formation enthalpies", () => {
    const hydrogenOxidation = minimumChemistryReferenceCases.find((reference) => reference.id === "ref-thermo-h2-o2-h2o-g");
    const methaneCombustion = minimumChemistryReferenceCases.find((reference) => reference.id === "ref-thermo-ch4-combustion-g");
    expect(hydrogenOxidation?.expectedThermalClass).toBe("EXOTHERMIC");
    expect(hydrogenOxidation?.expectedDeltaH_JPerMolExtent).toBe(-483_652);
    expect(methaneCombustion?.expectedThermalClass).toBe("EXOTHERMIC");
    expect(methaneCombustion?.expectedDeltaH_JPerMolExtent).toBe(-802_562);
  });

  it("exposes all eight requested species in thermochemistry or reference-phase data", () => {
    const required = ["H2", "O2", "N2", "H2O", "CO", "CO2", "CH4", "NH3"];
    for (const speciesId of required) {
      expect(minimumChemistryDataProvider.getPhaseEquilibrium(speciesId), speciesId).toBeDefined();
      expect(minimumThermodynamics.some((record) => record.speciesId === speciesId), speciesId).toBe(true);
    }
  });

  it("keeps minimum element records and projected elements one-to-one", () => {
    expect(minimumElementRecords).toHaveLength(minimumElements.length);
    for (const record of minimumElementRecords) {
      expect(minimumChemistryDataProvider.getElementDefinition(record.element.symbol)).toBeDefined();
    }
  });
});
