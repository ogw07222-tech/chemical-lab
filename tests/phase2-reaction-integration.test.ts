import { describe, expect, it } from "vitest";
import { minimumChemistryDataProvider, minimumElementProvider, validateMinimumChemistryDataPack } from "../src/data";
import { createPhase2ReactionDataBridge, runPhase2ReactionFoundation } from "../src/integration/phase2-reaction";
import { createMoleculeRecord, type MolecularGraph, type SpeciesState } from "../src/simulation/molecular";
import {
  validateCandidateSet,
  validateConservation,
  validateKinetics,
  validateStructure,
  validateThermodynamics,
} from "../src/validation";

function species(id: string, graph: MolecularGraph): SpeciesState {
  return {
    id,
    molecule: createMoleculeRecord(graph, minimumElementProvider),
    amountMol: 1,
    phaseState: {
      phase: "gas",
      source: "phase2-integration-test",
      phaseStateId: `${id}-gas`,
      scientificStatus: "VERIFIED",
    },
  };
}

const waterGraph: MolecularGraph = {
  atoms: [
    { id: "o", element: "O", formalCharge: 0 },
    { id: "h1", element: "H", formalCharge: 0 },
    { id: "h2", element: "H", formalCharge: 0 },
  ],
  bonds: [
    { id: "oh1", a: "o", b: "h1", kind: "covalent", order: 1 },
    { id: "oh2", a: "o", b: "h2", kind: "covalent", order: 1 },
  ],
};

const ammoniaGraph: MolecularGraph = {
  atoms: [
    { id: "n", element: "N", formalCharge: 0 },
    { id: "h1", element: "H", formalCharge: 0 },
    { id: "h2", element: "H", formalCharge: 0 },
    { id: "h3", element: "H", formalCharge: 0 },
  ],
  bonds: [
    { id: "nh1", a: "n", b: "h1", kind: "covalent", order: 1 },
    { id: "nh2", a: "n", b: "h2", kind: "covalent", order: 1 },
    { id: "nh3", a: "n", b: "h3", kind: "covalent", order: 1 },
  ],
};

describe("Phase 2 reaction foundation integration", () => {
  it("connects the minimum data pack to molecular and evaluation provider boundaries", () => {
    expect(validateMinimumChemistryDataPack().valid).toBe(true);
    expect(minimumElementProvider.getElement("H")?.symbol).toBe("H");
    expect(minimumElementProvider.getElement("O")?.symbol).toBe("O");

    const storedWaterThermo = minimumChemistryDataProvider.getSpeciesThermodynamics("H2O", "gas");
    expect(storedWaterThermo).toBeDefined();
    const bridge = createPhase2ReactionDataBridge();
    const projectedWaterThermo = bridge.evaluation.getSpeciesThermo("H2O", "gas");
    expect(projectedWaterThermo).toBeDefined();
    expect(projectedWaterThermo?.enthalpyOfFormation_J_per_mol?.source.sourceIds.length ?? 0).toBeGreaterThan(0);
  });

  it("runs candidate generation through evaluation and production validation without inventing missing data", () => {
    const inputSpecies = [species("H2O", waterGraph), species("NH3", ammoniaGraph)];
    const input = { species: inputSpecies, elements: minimumElementProvider };
    const config = { environment: { temperatureK: 298.15, pressurePa: 100_000 } };

    const first = runPhase2ReactionFoundation(input, config);
    const second = runPhase2ReactionFoundation(input, config);

    expect(first.candidates.length).toBeGreaterThan(0);
    expect(first.candidates.some((candidate) => candidate.family === "PROTON_TRANSFER")).toBe(true);
    expect(first.candidates.every((candidate) => candidate.conservation.valid)).toBe(true);
    expect(first.candidates.every((candidate) => candidate.assumptions.length > 0)).toBe(true);

    expect(first.candidates.map((candidate) => candidate.id)).toEqual(second.candidates.map((candidate) => candidate.id));
    expect(first.ranked.map((evaluation) => evaluation.candidateId)).toEqual(second.ranked.map((evaluation) => evaluation.candidateId));
    expect(first.ranked.map((evaluation) => evaluation.status)).toEqual(second.ranked.map((evaluation) => evaluation.status));

    const matrix = validateCandidateSet({ candidates: first.validationCandidates, performance: first.performance });
    expect(matrix.verdict).toBe("PASS");
    for (const candidate of first.validationCandidates) {
      expect(validateConservation(candidate).verdict).toBe("PASS");
      expect(validateStructure(candidate).verdict).toBe("PASS");
    }

    expect(first.validationCandidates.some((candidate) => validateThermodynamics(candidate).verdict === "OPEN")).toBe(true);
    expect(first.validationCandidates.some((candidate) => validateKinetics(candidate).verdict === "OPEN")).toBe(true);
    expect(first.evaluations.some((evaluation) => evaluation.status === "OPEN")).toBe(true);
  });
});
