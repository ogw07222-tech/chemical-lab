import { describe, expect, it } from "vitest";
import type { ScientificStatus } from "../src/simulation/molecular";
import {
  DEFAULT_EQUILIBRIUM_STANDARD_STATE,
  deriveExactReverseStandardThermo,
  evaluateReactionEquilibrium,
  type EquilibriumComposition,
  type EquilibriumDataProvider,
  type EquilibriumSpeciesState,
  type ReactionCandidateEvaluationView,
} from "../src/simulation/reaction-evaluation";

const T = 298.15;
const source = { sourceIds: ["test-reference"] };

function quantity(value: number, status: ScientificStatus = "VERIFIED") {
  return { value, status, confidence: "HIGH" as const, source };
}

function view(
  reactantCoefficient = 1,
  productCoefficient = 1,
  reactantPhase: ReactionCandidateEvaluationView["reactants"][number]["phase"] = "gas",
  productPhase: ReactionCandidateEvaluationView["products"][number]["phase"] = reactantPhase,
): ReactionCandidateEvaluationView {
  return {
    candidateId: "A_to_B",
    family: "TEST_REVERSIBLE",
    reactants: [{ speciesKey: "A", coefficient: reactantCoefficient, phase: reactantPhase }],
    products: [{ speciesKey: "B", coefficient: productCoefficient, phase: productPhase }],
    accessMode: "test",
    scientificStatus: "VERIFIED",
    reversible: { pairKey: "pair:A:B", direction: "FORWARD" },
  };
}

function kProvider(k = 1): EquilibriumDataProvider {
  return {
    getEquilibriumConstant: () => ({
      equilibriumConstantK: k,
      referenceTemperatureK: T,
      standardState: DEFAULT_EQUILIBRIUM_STANDARD_STATE,
      status: "VERIFIED",
      confidence: "HIGH",
      source,
    }),
  };
}

function gas(A: number, B: number): EquilibriumComposition {
  return {
    species: [
      { speciesKey: "A", phase: "gas", partialPressurePa: A },
      { speciesKey: "B", phase: "gas", partialPressurePa: B },
    ],
  };
}

function aqueous(A: number, B: number): EquilibriumComposition {
  return {
    species: [
      { speciesKey: "A", phase: "aqueous", concentrationMolPerM3: A },
      { speciesKey: "B", phase: "aqueous", concentrationMolPerM3: B },
    ],
  };
}

describe("Phase 3B equilibrium thermodynamics", () => {
  it("marks mostly-A A⇌B as forward favored when Q<K", () => {
    const result = evaluateReactionEquilibrium(view(), gas(90_000, 10_000), T, kProvider(1));
    expect(result.direction).toBe("FORWARD_FAVORED");
    expect(result.reactionQuotientQ).toBeCloseTo(1 / 9, 12);
    expect(result.lnQOverK).toBeLessThan(0);
    expect(result.deltaG_J_per_mol).toBeLessThan(0);
  });

  it("marks mostly-B A⇌B as reverse favored when Q>K", () => {
    const result = evaluateReactionEquilibrium(view(), gas(10_000, 90_000), T, kProvider(1));
    expect(result.direction).toBe("REVERSE_FAVORED");
    expect(result.reactionQuotientQ).toBeCloseTo(9, 12);
    expect(result.lnQOverK).toBeGreaterThan(0);
  });

  it("uses configurable ln(Q/K) tolerance for near equilibrium", () => {
    const ratio = Math.exp(5e-7);
    const result = evaluateReactionEquilibrium(
      view(),
      gas(100_000, 100_000 * ratio),
      T,
      kProvider(1),
      { tolerance: { epsilonLnQOverK: 1e-6, basis: "CONFIGURED", scientificStatus: "APPROXIMATED" } },
    );
    expect(result.direction).toBe("NEAR_EQUILIBRIUM");
    expect(result.nearEquilibrium).toBe(true);
    expect(result.reasonCodes).toContain("NEAR_EQUILIBRIUM_BY_LOG_RATIO");
  });

  it("applies stoichiometric exponents in log-space Q", () => {
    const result = evaluateReactionEquilibrium(
      view(2, 3),
      {
        species: [
          { speciesKey: "A", phase: "gas", activityDimensionless: 2 },
          { speciesKey: "B", phase: "gas", activityDimensionless: 3 },
        ],
      },
      T,
      kProvider(1),
    );
    expect(result.reactionQuotientQ).toBeCloseTo(27 / 4, 12);
    expect(result.lnReactionQuotientQ).toBeCloseTo(Math.log(27 / 4), 12);
  });

  it("uses dimensionless ideal-gas partial-pressure activities", () => {
    const result = evaluateReactionEquilibrium(view(), gas(50_000, 100_000), T, kProvider(1));
    expect(result.activityModel).toBe("IDEAL_GAS_PARTIAL_PRESSURE");
    expect(result.reactionQuotientQ).toBeCloseTo(2, 12);
  });

  it("uses ideal-dilute concentration activities only for aqueous species", () => {
    const result = evaluateReactionEquilibrium(
      view(1, 1, "aqueous"),
      aqueous(500, 1_000),
      T,
      kProvider(1),
    );
    expect(result.activityModel).toBe("IDEAL_DILUTE_SOLUTION");
    expect(result.reactionQuotientQ).toBeCloseTo(2, 12);
  });

  it("uses activity one for explicitly present pure solid/liquid phases", () => {
    const pure: EquilibriumSpeciesState[] = [
      { speciesKey: "A", phase: "solid", amountMol: 1, purePhaseActivityOne: true },
      { speciesKey: "B", phase: "liquid", amountMol: 1, purePhaseActivityOne: true },
    ];
    const result = evaluateReactionEquilibrium(
      view(1, 1, "solid", "liquid"),
      { species: pure },
      T,
      kProvider(1),
    );
    expect(result.activityModel).toBe("PURE_PHASE_ACTIVITY_ONE");
    expect(result.reactionQuotientQ).toBeCloseTo(1, 12);
    expect(result.direction).toBe("NEAR_EQUILIBRIUM");
  });

  it("returns OPEN for unsupported gas+aqueous mixed activity model", () => {
    const result = evaluateReactionEquilibrium(
      view(1, 1, "gas", "aqueous"),
      {
        species: [
          { speciesKey: "A", phase: "gas", partialPressurePa: 100_000 },
          { speciesKey: "B", phase: "aqueous", concentrationMolPerM3: 1_000 },
        ],
      },
      T,
      kProvider(1),
    );
    expect(result.direction).toBe("OPEN");
    expect(result.activityModel).toBe("OPEN");
    expect(result.reasonCodes).toContain("UNSUPPORTED_ACTIVITY_MODEL");
  });

  it("handles zero and tiny activities without NaN/Infinity result fields", () => {
    const zeroProduct = evaluateReactionEquilibrium(view(), gas(100_000, 0), T, kProvider(1));
    expect(zeroProduct.direction).toBe("FORWARD_FAVORED");
    expect(zeroProduct.reactionQuotientQ).toBe(0);
    expect(zeroProduct.lnQOverK).toBeUndefined();

    const zeroReactant = evaluateReactionEquilibrium(view(), gas(0, 100_000), T, kProvider(1));
    expect(zeroReactant.direction).toBe("REVERSE_FAVORED");
    expect(zeroReactant.reactionQuotientQ).toBeUndefined();

    const bothZero = evaluateReactionEquilibrium(view(), gas(0, 0), T, kProvider(1));
    expect(bothZero.direction).toBe("OPEN");

    const tiny = evaluateReactionEquilibrium(
      view(),
      {
        species: [
          { speciesKey: "A", phase: "gas", activityDimensionless: 1e-300 },
          { speciesKey: "B", phase: "gas", activityDimensionless: 1e-250 },
        ],
      },
      T,
      kProvider(1),
    );
    expect(Number.isFinite(tiny.lnReactionQuotientQ)).toBe(true);
    expect(Number.isFinite(tiny.lnQOverK)).toBe(true);
  });

  it("keeps very large Q in log space instead of returning Infinity", () => {
    const result = evaluateReactionEquilibrium(
      view(),
      {
        species: [
          { speciesKey: "A", phase: "gas", activityDimensionless: 1e-300 },
          { speciesKey: "B", phase: "gas", activityDimensionless: 1e300 },
        ],
      },
      T,
      kProvider(1),
    );
    expect(result.direction).toBe("REVERSE_FAVORED");
    expect(result.reactionQuotientQ).toBeUndefined();
    expect(Number.isFinite(result.lnReactionQuotientQ)).toBe(true);
    expect(Number.isFinite(result.lnQOverK)).toBe(true);
  });

  it("returns OPEN when K and supported ΔG° are both missing", () => {
    const result = evaluateReactionEquilibrium(view(), gas(50_000, 50_000), T, {});
    expect(result.direction).toBe("OPEN");
    expect(result.reasonCodes).toContain("MISSING_EQUILIBRIUM_DATA");
  });

  it("derives lnK from supported standard ΔG° without fabricating K on overflow", () => {
    const provider: EquilibriumDataProvider = {
      getStandardReactionGibbs: () => ({
        deltaGStandard_J_per_mol: quantity(-2_000_000),
        referenceTemperatureK: T,
        standardState: DEFAULT_EQUILIBRIUM_STANDARD_STATE,
      }),
    };
    const result = evaluateReactionEquilibrium(view(), gas(100_000, 100_000), T, provider);
    expect(result.reasonCodes).toContain("STANDARD_GIBBS_TO_K");
    expect(Number.isFinite(result.lnEquilibriumConstantK)).toBe(true);
    expect(result.equilibriumConstantK).toBeUndefined();
    expect(result.direction).toBe("FORWARD_FAVORED");
  });

  it("is deterministic for identical inputs", () => {
    const composition = gas(30_000, 70_000);
    const first = evaluateReactionEquilibrium(view(), composition, T, kProvider(2));
    const second = evaluateReactionEquilibrium(view(), composition, T, kProvider(2));
    expect(second).toEqual(first);
  });

  it("derives reverse ΔG°/ΔH° signs only with explicit exact-reverse proof", () => {
    const forward = {
      reversiblePairId: "pair:A:B",
      channelDirection: "FORWARD" as const,
      referenceTemperatureK: T,
      deltaGStandard_J_per_mol: quantity(-10_000),
      deltaHStandard_J_per_mol: quantity(-20_000),
    };
    const reverse = deriveExactReverseStandardThermo(forward, {
      reversiblePairId: "pair:A:B",
      exactReverseConfirmed: true,
      sourceIds: ["exact-reverse-proof"],
    });
    expect(reverse.channelDirection).toBe("REVERSE");
    expect(reverse.deltaGStandard_J_per_mol?.value).toBe(10_000);
    expect(reverse.deltaHStandard_J_per_mol?.value).toBe(20_000);

    expect(() => deriveExactReverseStandardThermo(forward, {
      reversiblePairId: "unrelated-pair",
      exactReverseConfirmed: true,
      sourceIds: ["bad-proof"],
    })).toThrow(/mismatch/i);
  });

  it("changes only the near-equilibrium decision when engineering tolerance is configured", () => {
    const ratio = Math.exp(5e-5);
    const composition = gas(100_000, 100_000 * ratio);
    const strict = evaluateReactionEquilibrium(view(), composition, T, kProvider(1), {
      tolerance: { epsilonLnQOverK: 1e-6, basis: "CONFIGURED", scientificStatus: "APPROXIMATED" },
    });
    const loose = evaluateReactionEquilibrium(view(), composition, T, kProvider(1), {
      tolerance: { epsilonLnQOverK: 1e-4, basis: "CONFIGURED", scientificStatus: "APPROXIMATED" },
    });
    expect(strict.direction).toBe("REVERSE_FAVORED");
    expect(loose.direction).toBe("NEAR_EQUILIBRIUM");
    expect(strict.lnQOverK).toBeCloseTo(loose.lnQOverK!, 12);
  });
});
