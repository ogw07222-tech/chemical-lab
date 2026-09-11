import { describe, expect, it } from "vitest";
import {
  observePerformance,
  validateCandidateSet,
  validateConservation,
  validateDeterminism,
  validateKinetics,
  validateRateOrdering,
  validateReferenceExpectation,
  validateStructure,
  validateThermodynamics,
  type ReactionCandidateValidationView,
  type ReactionGenerationResult,
  type ReactionValidationAdapter,
} from "../src/validation";

function candidate(overrides: Partial<ReactionCandidateValidationView> = {}): ReactionCandidateValidationView {
  return {
    id: "candidate-1",
    canonicalKey: "A->B",
    conservation: {
      reactantElements: { H: 2, O: 1 },
      productElements: { H: 2, O: 1 },
      reactantAtomCount: 3,
      productAtomCount: 3,
      reactantCharge: 0,
      productCharge: 0,
    },
    structure: {
      overValence: false,
      invalidBond: false,
      danglingAtom: false,
      malformedGraph: false,
      duplicateAtomMapping: false,
      finiteNumericState: true,
    },
    ...overrides,
  };
}

function generation(candidates: readonly ReactionCandidateValidationView[]): ReactionGenerationResult {
  return {
    candidates,
    performance: {
      reactiveSites: 4,
      eligiblePairs: 6,
      rawCandidates: candidates.length,
      deduplicatedCandidates: candidates.length,
      prunedCandidates: 0,
      runtimeMs: 1.25,
    },
  };
}

describe("Phase 2D reaction validation matrix", () => {
  it("treats atom/element/charge/electron conservation violations as absolute FAIL", () => {
    expect(validateConservation(candidate()).verdict).toBe("PASS");
    expect(validateConservation(candidate({ conservation: { reactantElements: { H: 2 }, productElements: { H: 1 }, reactantAtomCount: 2, productAtomCount: 1, reactantCharge: 0, productCharge: 0 } })).verdict).toBe("FAIL");
    expect(validateConservation(candidate({ conservation: { reactantElements: { H: 1 }, productElements: { H: 1 }, reactantAtomCount: 1, productAtomCount: 1, reactantCharge: 0, productCharge: 1 } })).verdict).toBe("FAIL");
    expect(validateConservation(candidate({ conservation: { reactantElements: { H: 1 }, productElements: { H: 1 }, reactantAtomCount: 1, productAtomCount: 1, reactantCharge: 0, productCharge: 0, reactantExplicitElectrons: 1, productExplicitElectrons: 0 } })).verdict).toBe("FAIL");
  });

  it("rejects structural and numeric-invalid products", () => {
    const keys = ["overValence", "invalidBond", "danglingAtom", "duplicateAtomMapping", "malformedGraph"] as const;
    for (const key of keys) expect(validateStructure(candidate({ structure: { ...candidate().structure, [key]: true } })).verdict).toBe("FAIL");
    expect(validateStructure(candidate({ structure: { ...candidate().structure, finiteNumericState: false } })).verdict).toBe("FAIL");
  });

  it("rejects duplicate canonical candidates and invalid counters", () => {
    const a = candidate({ id: "a", canonicalKey: "same" });
    const b = candidate({ id: "b", canonicalKey: "same" });
    expect(validateCandidateSet(generation([a, b])).verdict).toBe("FAIL");
    expect(validateCandidateSet({ candidates: [a], performance: { reactiveSites: 1, eligiblePairs: 1, rawCandidates: 0, deduplicatedCandidates: 1, prunedCandidates: 0, runtimeMs: 1 } }).verdict).toBe("FAIL");
    expect(validateCandidateSet({ candidates: [], performance: { reactiveSites: 1, eligiblePairs: 1, rawCandidates: 0, deduplicatedCandidates: 0, prunedCandidates: 0, runtimeMs: Number.NaN } }).verdict).toBe("FAIL");
  });

  it("supports positive and negative controls without implementing reaction logic", () => {
    expect(validateReferenceExpectation(generation([candidate()]), { expectCandidate: true }, true).verdict).toBe("PASS");
    expect(validateReferenceExpectation(generation([]), { expectCandidate: false }, true).verdict).toBe("PASS");
    expect(validateReferenceExpectation(generation([candidate()]), { expectCandidate: false }, true).verdict).toBe("OPEN");
    const infeasible = candidate({ thermo: { feasibility: "UNFAVORABLE", scientificStatus: "APPROXIMATED", dataAvailable: true } });
    expect(validateReferenceExpectation(generation([infeasible]), { expectCandidate: false }, true).verdict).toBe("PASS");
    const feasible = candidate({ thermo: { feasibility: "FAVORABLE", direction: "FORWARD", scientificStatus: "APPROXIMATED", dataAvailable: true }, kinetics: { feasible: true, barrierKnown: true, scientificStatus: "APPROXIMATED" } });
    expect(validateReferenceExpectation(generation([feasible]), { expectCandidate: false }, true).verdict).toBe("FAIL");
    expect(validateReferenceExpectation(generation([]), { expectCandidate: false }, false).verdict).toBe("OPEN");
  });

  it("checks thermodynamic sign/direction and returns OPEN for missing data", () => {
    const exo = candidate({ thermo: { deltaH_JPerMol: -10, deltaG_JPerMol: -5, direction: "FORWARD", feasibility: "FAVORABLE", scientificStatus: "APPROXIMATED", dataAvailable: true } });
    expect(validateThermodynamics(exo, { expectedThermalSign: "EXOTHERMIC", expectedDirection: "FORWARD" }).verdict).toBe("PASS");
    expect(validateThermodynamics(exo, { expectedThermalSign: "ENDOTHERMIC" }).verdict).toBe("FAIL");
    expect(validateThermodynamics(candidate({ thermo: { ...exo.thermo!, direction: "REVERSE" } })).verdict).toBe("FAIL");
    expect(validateThermodynamics(candidate(), { expectedDirection: "FORWARD" }).verdict).toBe("OPEN");
  });

  it("checks positive-Ea temperature direction, catalyst kinetics-only behavior, unknown barriers, and relative ordering", () => {
    const good = candidate({ canonicalKey: "fast", kinetics: { activationEnergy_JPerMol: 1000, lowTemperatureK: 300, highTemperatureK: 400, lowTemperatureRate: 1, highTemperatureRate: 2, uncatalyzedRate: 1, catalyzedRate: 3, effectiveRate: 5, feasible: true, equilibriumChangedByCatalyst: false, scientificStatus: "APPROXIMATED", barrierKnown: true } });
    expect(validateKinetics(good).verdict).toBe("PASS");
    expect(validateKinetics(candidate({ kinetics: { ...good.kinetics!, highTemperatureRate: 0.5 } })).verdict).toBe("FAIL");
    expect(validateKinetics(candidate({ kinetics: { ...good.kinetics!, equilibriumChangedByCatalyst: true } })).verdict).toBe("FAIL");
    expect(validateKinetics(candidate({ kinetics: { ...good.kinetics!, barrierKnown: false, scientificStatus: "OPEN" } })).verdict).toBe("OPEN");
    const slow = candidate({ id: "slow", canonicalKey: "slow", kinetics: { ...good.kinetics!, effectiveRate: 1 } });
    expect(validateRateOrdering([good, slow], ["fast", "slow"]).verdict).toBe("PASS");
    expect(validateRateOrdering([good, slow], ["slow", "fast"]).verdict).toBe("FAIL");
  });

  it("requires deterministic candidates, ordering and evaluation for identical input/config", async () => {
    const fixed = generation([candidate({ id: "a", canonicalKey: "a" }), candidate({ id: "b", canonicalKey: "b" })]);
    const adapter: ReactionValidationAdapter<{ x: number }, { seed: number }> = { generate: () => fixed };
    expect((await validateDeterminism(adapter, { x: 1 }, { seed: 7 })).verdict).toBe("PASS");
    let flip = false;
    const unstable: ReactionValidationAdapter<unknown, unknown> = { generate: () => { flip = !flip; return generation(flip ? fixed.candidates : [...fixed.candidates].reverse()); } };
    expect((await validateDeterminism(unstable, {}, {})).verdict).toBe("FAIL");
  });

  it("reports performance counters separately from scientific acceptance", () => {
    const observed = observePerformance({ reactiveSites: 12, eligiblePairs: 30, rawCandidates: 18, deduplicatedCandidates: 9, prunedCandidates: 5, runtimeMs: 4 });
    expect(observed.engineeringBudgetStatus).toBe("UNSPECIFIED");
    expect(observed.deduplicatedCandidates).toBe(9);
    expect(observePerformance(observed, 3).engineeringBudgetStatus).toBe("OVER_BUDGET");
  });
});
