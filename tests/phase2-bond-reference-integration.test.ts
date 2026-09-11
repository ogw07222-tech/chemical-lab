import { describe, expect, it } from "vitest";
import { minimumElementProvider } from "../src/data";
import { createReactionCandidateBondEnergyProvider } from "../src/integration/phase2-bond-reference";
import {
  createPhase2ReactionDataBridge,
  createReactionCandidateEvaluationAdapter,
  toReactionValidationView,
} from "../src/integration/phase2-reaction";
import { createMoleculeRecord, type MolecularGraph, type SpeciesState } from "../src/simulation/molecular";
import { generateReactionCandidatesWithDiagnostics } from "../src/simulation/reaction";
import { evaluateReactionCandidate } from "../src/simulation/reaction-evaluation";
import { validateConservation, validateStructure, validateThermodynamics } from "../src/validation";

const h2Graph: MolecularGraph = {
  atoms: [
    { id: "h1", element: "H", formalCharge: 0 },
    { id: "h2", element: "H", formalCharge: 0 },
  ],
  bonds: [
    { id: "hh", a: "h1", b: "h2", kind: "covalent", order: 1 },
  ],
};

const h2: SpeciesState = {
  id: "H2",
  molecule: createMoleculeRecord(h2Graph, minimumElementProvider),
  amountMol: 1,
  phaseState: {
    phase: "gas",
    source: "phase2-bond-reference-integration-test",
    phaseStateId: "H2-gas",
    scientificStatus: "VERIFIED",
  },
};

describe("Phase 2 bond/reference data integration", () => {
  it("uses the exact H2 reactant bond reference for a complete bond-cleavage candidate", () => {
    const generation = generateReactionCandidatesWithDiagnostics({
      species: [h2],
      elements: minimumElementProvider,
    });
    const candidate = generation.candidates.find((entry) => entry.family === "BOND_CLEAVAGE");
    expect(candidate).toBeDefined();

    const bridge = createPhase2ReactionDataBridge();
    const bondProvider = createReactionCandidateBondEnergyProvider(generation.candidates, [h2], bridge.chemistry);
    const provider = { ...bridge.evaluation, ...bondProvider };
    const adapter = createReactionCandidateEvaluationAdapter([h2]);
    const evaluation = evaluateReactionCandidate(
      candidate!,
      adapter,
      { temperatureK: 298.15, pressurePa: 100_000 },
      provider,
    );

    expect(evaluation.reasonCodes).toContain("BOND_ENERGY_APPROXIMATION");
    expect(evaluation.thermo.deltaH_J_per_mol).toBeCloseTo(435_900, 6);
    expect(evaluation.thermo.approximationClass).toBe("EMPIRICAL");
    expect(evaluation.thermo.source.sourceIds.length).toBeGreaterThan(0);

    const validation = toReactionValidationView(candidate!, evaluation, [h2], bridge.elements);
    expect(validateConservation(validation).verdict).toBe("PASS");
    expect(validateStructure(validation).verdict).toBe("PASS");
    expect(validateThermodynamics(validation).verdict).toBe("PASS");
  });

  it("does not emit partial bond-energy estimates for candidates that form bonds", () => {
    const generation = generateReactionCandidatesWithDiagnostics({
      species: [h2],
      elements: minimumElementProvider,
    });
    const bondProvider = createReactionCandidateBondEnergyProvider(generation.candidates, [h2]);
    const adapter = createReactionCandidateEvaluationAdapter([h2]);
    const formationCandidate = generation.candidates.find((entry) =>
      entry.bondChanges.some((change) => change.kind !== "REMOVE"),
    );

    if (!formationCandidate) return;
    const view = adapter.toEvaluationView(formationCandidate);
    expect(bondProvider.getBondEnergyApproximation?.(view)).toBeUndefined();
  });
});
