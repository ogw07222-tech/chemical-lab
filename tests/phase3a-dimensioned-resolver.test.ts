import { describe, expect, it } from "vitest";
import { createMoleculeRecord, type ElementDefinition, type ElementProvider, type SpeciesState } from "../src/simulation/molecular";
import type { ReactionCandidate } from "../src/simulation/reaction";
import type { RankedReactionEvaluation } from "../src/simulation/reaction-evaluation";
import { resolveReactionCandidates, type ReactionProductStateResolver } from "../src/simulation/reaction-progression";

const H: ElementDefinition = {
  atomicNumber: 1,
  symbol: "H",
  atomicMolarMassKgPerMol: 0.001,
  valenceElectrons: 1,
  commonOxidationStates: [-1, 1],
  typicalValences: [1],
};
const elements: ElementProvider = { getElement: (symbol) => symbol === "H" ? H : undefined };
const atomH = createMoleculeRecord({ atoms: [{ id: "h", element: "H", formalCharge: 0 }], bonds: [] }, elements);
const h2 = createMoleculeRecord({
  atoms: [{ id: "h1", element: "H", formalCharge: 0 }, { id: "h2", element: "H", formalCharge: 0 }],
  bonds: [{ id: "b", a: "h1", b: "h2", kind: "covalent", order: 1 }],
}, elements);
const phase = { phase: "gas" as const, source: "test", phaseStateId: "gas:test", scientificStatus: "APPROXIMATED" as const };

const species: SpeciesState[] = [
  { id: "H2", molecule: h2, amountMol: 1, phaseState: phase },
  { id: "H", molecule: atomH, amountMol: 0, phaseState: phase },
];

const candidate: ReactionCandidate = {
  id: "dimensioned",
  family: "BOND_CLEAVAGE",
  reactantRefs: [{ speciesId: "H2", coefficient: 1 }],
  productGraphs: [atomH, atomH],
  atomMapping: [
    { reactant: { speciesId: "H2", atomId: "h1" }, productIndex: 0, productAtomId: "h" },
    { reactant: { speciesId: "H2", atomId: "h2" }, productIndex: 1, productAtomId: "h" },
  ],
  bondChanges: [{ kind: "REMOVE", a: { speciesId: "H2", atomId: "h1" }, b: { speciesId: "H2", atomId: "h2" }, beforeOrder: 1, bondKind: "covalent" }],
  chargeChanges: [],
  stoichiometry: {
    reactants: [{ speciesId: "H2", coefficient: 1 }],
    products: [{ productIndex: 0, coefficient: 1 }, { productIndex: 1, coefficient: 1 }],
  },
  structuralConfidence: 0.8,
  assumptions: ["dimensioned-rate resolver fixture"],
  ruleId: "test:dimensioned",
  conservation: { valid: true, delta: { elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 }, reasons: [] },
  debug: { structuralKey: "dimensioned", rulePriority: 1, siteKeys: [] },
};

const resolver: ReactionProductStateResolver = {
  resolveProductState: (_candidate, _index, product) => product.canonicalKey === atomH.canonicalKey ? { speciesId: "H" } : undefined,
};

function evaluation(rateMolPerS: number): RankedReactionEvaluation {
  return {
    candidateId: "dimensioned",
    thermo: {
      deltaH_J_per_mol: -100,
      deltaG_J_per_mol: -100,
      direction: "FORWARD_FAVORED",
      confidence: "HIGH",
      approximationClass: "VERIFIED",
      source: { sourceIds: ["test"] },
    },
    kinetics: {
      supportClass: "DIMENSIONED_RATE",
      extentRateMolPerS: rateMolPerS,
      rateClass: "FAST",
      confidence: "HIGH",
      approximationClass: "VERIFIED",
      dependencies: { temperature: false, activityOrConcentration: false, pressure: false, catalyst: false, phase: false },
    },
    environment: {
      temperatureContribution: 1,
      pressureRelevance: "RELEVANT",
      activityContribution: 1,
      catalystModifier: 1,
      phaseAccessibility: { class: "GAS_GAS", factor: 1, status: "APPROXIMATED" },
    },
    feasible: "FEASIBLE",
    rankScore: 0.5,
    status: "APPROXIMATED",
    reasonCodes: ["DIMENSIONED_RATE_DATA"],
    rank: 1,
    tie: false,
  };
}

function run(dtS: number, maxFractionalConsumptionPerStep = 1) {
  return resolveReactionCandidates({
    species,
    elements,
    candidates: [candidate],
    rankedEvaluations: [evaluation(0.2)],
    productStateResolver: resolver,
    dtS,
    timestepId: `step-${dtS}`,
    startTimeS: 0,
    temperatureK: 300,
    options: { maxFractionalConsumptionPerStep },
  });
}

describe("Phase 3A dimensioned rate resolver bridge", () => {
  it("uses extentRateMolPerS * dt before 01 stoichiometric bounds", () => {
    expect(run(1).selected[0]!.appliedExtentMol).toBeCloseTo(0.2, 12);
    expect(run(2).selected[0]!.appliedExtentMol).toBeCloseTo(0.4, 12);
  });

  it("keeps the configured fractional-consumption safety bound", () => {
    const result = run(10, 0.25);
    expect(result.selected[0]!.appliedExtentMol).toBeCloseTo(0.25, 12);
    expect(result.selected[0]!.reasonCodes).toContain("MAX_FRACTION_BOUNDED");
    expect(result.speciesAfter.find((item) => item.id === "H2")!.amountMol).toBeGreaterThanOrEqual(0);
  });
});
