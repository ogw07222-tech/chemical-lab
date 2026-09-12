import { describe, expect, it } from "vitest";
import {
  DEFAULT_EQUILIBRIUM_STANDARD_STATE,
  equilibriumDrivingStrength,
  evaluateReactionEquilibrium,
  kineticExtentInputOverDt,
  recommendEquilibriumProgression,
  type EquilibriumComposition,
  type EquilibriumDataProvider,
  type KineticEvaluationResult,
  type ReactionCandidateEvaluationView,
} from "../src/simulation/reaction-evaluation";

const T = 298.15;
const source = { sourceIds: ["test-reference"] };

function view(): ReactionCandidateEvaluationView {
  return {
    candidateId: "A_to_B",
    family: "TEST_REVERSIBLE",
    reactants: [{ speciesKey: "A", coefficient: 1, phase: "gas" }],
    products: [{ speciesKey: "B", coefficient: 1, phase: "gas" }],
    accessMode: "test",
    scientificStatus: "VERIFIED",
    reversible: { pairKey: "pair:A:B", direction: "FORWARD" },
  };
}

function provider(k = 1): EquilibriumDataProvider {
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

function composition(aMol: number, bMol: number): EquilibriumComposition {
  return {
    species: [
      { speciesKey: "A", phase: "gas", amountMol: aMol, partialPressurePa: aMol * 100_000 },
      { speciesKey: "B", phase: "gas", amountMol: bMol, partialPressurePa: bMol * 100_000 },
    ],
  };
}

function projection(a0: number, b0: number, maxFeasibleExtentMol: number) {
  return {
    maxFeasibleExtentMol,
    projectComposition(netForwardExtentMol: number): EquilibriumComposition {
      const a = a0 - netForwardExtentMol;
      const b = b0 + netForwardExtentMol;
      if (a < -1e-12 || b < -1e-12) throw new RangeError("projected negative amount");
      return composition(Math.max(0, a), Math.max(0, b));
    },
  };
}

function eq(a: number, b: number, p: EquilibriumDataProvider = provider()) {
  return evaluateReactionEquilibrium(view(), composition(a, b), T, p);
}

describe("Phase 3B-B equilibrium progression policy", () => {
  it("has zero driving strength at and inside the equilibrium tolerance", () => {
    expect(equilibriumDrivingStrength(0, 1e-6)).toBe(0);
    expect(equilibriumDrivingStrength(5e-7, 1e-6)).toBe(0);
    expect(equilibriumDrivingStrength(-5e-7, 1e-6)).toBe(0);
  });

  it("increases monotonically with |ln(Q/K)| and remains bounded", () => {
    const values = [1e-6, 1e-4, 1e-2, 1, 10, 1e6].map((x) => equilibriumDrivingStrength(x, 1e-6));
    for (let i = 1; i < values.length; i += 1) expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("is symmetric for forward/reverse driving magnitude", () => {
    for (const magnitude of [1e-5, 0.1, 1, 100]) {
      expect(equilibriumDrivingStrength(magnitude, 1e-6)).toBeCloseTo(
        equilibriumDrivingStrength(-magnitude, 1e-6),
        15,
      );
    }
  });

  it("is continuous at the engineering near-equilibrium boundary", () => {
    const epsilon = 1e-6;
    const at = equilibriumDrivingStrength(epsilon, epsilon);
    const justAbove = equilibriumDrivingStrength(epsilon + 1e-12, epsilon);
    expect(at).toBe(0);
    expect(justAbove).toBeLessThan(2e-12);
  });

  it("recommends zero net progression near equilibrium without claiming microscopic rates are zero", () => {
    const equilibrium = eq(1, 1);
    const result = recommendEquilibriumProgression(view(), equilibrium, T, provider());
    expect(result.mode).toBe("NEAR_EQUILIBRIUM");
    expect(result.drivingStrength).toBe(0);
    expect(result.maxNetProgressFraction).toBe(0);
    expect(result.maxExtentTowardEquilibriumMol).toBe(0);
    expect(result.reasonCodes).toContain("NEAR_EQUILIBRIUM_ZERO_NET_PROGRESS");
  });

  it("abstains when equilibrium evidence is OPEN and does not create a rate", () => {
    const equilibrium = eq(0.9, 0.1, {});
    const result = recommendEquilibriumProgression(view(), equilibrium, T, {});
    expect(result.mode).toBe("INDETERMINATE");
    expect(result.scientificStatus).toBe("OPEN");
    expect(result.drivingStrength).toBe(0);
    expect(result.preventEquilibriumCrossing).toBe(false);

    const openKinetics: KineticEvaluationResult = {
      supportClass: "OPEN",
      rateClass: "UNKNOWN",
      confidence: "UNASSESSED",
      approximationClass: "OPEN",
    };
    expect(kineticExtentInputOverDt(openKinetics, 1)).toEqual({
      mode: "NO_NUMERIC_EXTENT",
      scientificStatus: "OPEN",
    });
  });

  it("finds a deterministic forward equilibrium crossing bound by bisection", () => {
    const equilibrium = eq(0.9, 0.1);
    const inputProjection = projection(0.9, 0.1, 0.9);
    const first = recommendEquilibriumProgression(view(), equilibrium, T, provider(), {}, inputProjection);
    const second = recommendEquilibriumProgression(view(), equilibrium, T, provider(), {}, inputProjection);
    expect(first).toEqual(second);
    expect(first.mode).toBe("FORWARD");
    expect(first.preventEquilibriumCrossing).toBe(true);
    expect(first.maxExtentTowardEquilibriumMol).toBeCloseTo(0.4, 9);
    expect(first.maxExtentTowardEquilibriumMol!).toBeLessThanOrEqual(0.9);
  });

  it("finds the symmetric reverse equilibrium crossing bound", () => {
    const equilibrium = eq(0.1, 0.9);
    const result = recommendEquilibriumProgression(
      view(),
      equilibrium,
      T,
      provider(),
      {},
      projection(0.1, 0.9, 0.9),
    );
    expect(result.mode).toBe("REVERSE");
    expect(result.maxExtentTowardEquilibriumMol).toBeCloseTo(0.4, 9);
  });

  it("never returns an anti-crossing bound above 01 feasible extent", () => {
    const equilibrium = eq(0.9, 0.1);
    const result = recommendEquilibriumProgression(
      view(),
      equilibrium,
      T,
      provider(),
      {},
      projection(0.9, 0.1, 0.2),
    );
    expect(result.maxExtentTowardEquilibriumMol).toBe(0.2);
    expect(result.reasonCodes).toContain("EQUILIBRIUM_OUTSIDE_FEASIBLE_EXTENT");
  });

  it("provides the exact cap needed to prevent a one-step equilibrium overshoot", () => {
    const equilibrium = eq(0.9, 0.1);
    const result = recommendEquilibriumProgression(
      view(),
      equilibrium,
      T,
      provider(),
      {},
      projection(0.9, 0.1, 0.9),
    );
    const cap = result.maxExtentTowardEquilibriumMol!;
    const atCap = evaluateReactionEquilibrium(view(), projection(0.9, 0.1, 0.9).projectComposition(cap), T, provider());
    expect(Math.abs(atCap.lnQOverK ?? 0)).toBeLessThanOrEqual(1e-6 + 1e-8);
    expect(cap).toBeLessThan(0.41);
  });

  it("stays finite for tiny and huge thermodynamic driving coordinates", () => {
    for (const x of [1e-300, -1e-300, 1e300, -1e300]) {
      const value = equilibriumDrivingStrength(x, 1e-12);
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it("does not replace Phase 3A kinetics; it only supplies a multiplier/cap", () => {
    const kinetics: KineticEvaluationResult = {
      supportClass: "DIMENSIONED_RATE",
      extentRateMolPerS: 0.25,
      rateClass: "MODERATE",
      confidence: "HIGH",
      approximationClass: "VERIFIED",
    };
    const kinetic = kineticExtentInputOverDt(kinetics, 2);
    const equilibrium = eq(0.9, 0.1);
    const recommendation = recommendEquilibriumProgression(view(), equilibrium, T, provider());
    expect(kinetic.requestedExtentMol).toBe(0.5);
    expect(recommendation.drivingStrength).toBeGreaterThan(0);
    expect("requestedExtentMol" in recommendation).toBe(false);
  });

  it("leaves reverse thermochemical/heat semantics untouched", () => {
    const equilibrium = eq(0.9, 0.1);
    const recommendation = recommendEquilibriumProgression(view(), equilibrium, T, provider());
    expect(recommendation.scientificStatus).toBe("APPROXIMATED");
    expect(recommendation.reasonCodes).not.toContain("STANDARD_GIBBS_TO_K" as never);
    expect(recommendation).not.toHaveProperty("heatJ");
    expect(recommendation).not.toHaveProperty("deltaH_J_per_mol");
  });
});
