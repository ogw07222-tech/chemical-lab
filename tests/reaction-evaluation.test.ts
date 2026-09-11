import { describe, expect, it } from "vitest";

import {
  evaluateReactionCandidate,
  rankReactionEvaluations,
  type EvaluatedQuantity,
  type ReactionCandidateAdapter,
  type ReactionCandidateEvaluationView,
  type ReactionEvaluationDataProvider,
} from "../src/simulation/reaction-evaluation";

function quantity(
  value: number,
  status: "VERIFIED" | "APPROXIMATED" | "EMPIRICAL" | "GAMEPLAY_SIMPLIFICATION" | "OPEN" = "VERIFIED",
): EvaluatedQuantity {
  return {
    value,
    status,
    confidence: status === "VERIFIED" ? "HIGH" : "MEDIUM",
    source: { sourceIds: ["fixture"] },
  };
}

type Candidate = { id: string; view: ReactionCandidateEvaluationView };

const adapter: ReactionCandidateAdapter<Candidate> = {
  toEvaluationView: (candidate) => candidate.view,
};

function candidate(id = "candidate-1"): Candidate {
  return {
    id,
    view: {
      candidateId: id,
      family: "test",
      reactants: [{ speciesKey: "A", coefficient: 1, phase: "gas" }],
      products: [{ speciesKey: "B", coefficient: 1, phase: "gas" }],
      accessMode: "homogeneous-gas",
      scientificStatus: "VERIFIED",
    },
  };
}

function provider(
  reactantH: number,
  productH: number,
  reactantS?: number,
  productS?: number,
  activationEnergy = 50_000,
): ReactionEvaluationDataProvider {
  return {
    getSpeciesThermo: (key) =>
      key === "A"
        ? {
            enthalpyOfFormation_J_per_mol: quantity(reactantH),
            standardMolarEntropy_J_per_mol_K:
              reactantS === undefined ? undefined : quantity(reactantS),
          }
        : {
            enthalpyOfFormation_J_per_mol: quantity(productH),
            standardMolarEntropy_J_per_mol_K:
              productS === undefined ? undefined : quantity(productS),
          },
    getActivationBarrier: () => ({
      activationEnergy_J_per_mol: quantity(activationEnergy),
    }),
  };
}

describe("Phase 2B reaction candidate evaluation", () => {
  it("preserves exothermic sign in J/mol", () => {
    const result = evaluateReactionCandidate(
      candidate(),
      adapter,
      { temperatureK: 300 },
      provider(0, -10_000, 10, 10),
    );
    expect(result.thermo.deltaH_J_per_mol).toBe(-10_000);
  });

  it("preserves endothermic sign in J/mol", () => {
    const result = evaluateReactionCandidate(
      candidate(),
      adapter,
      { temperatureK: 300 },
      provider(0, 10_000, 10, 10),
    );
    expect(result.thermo.deltaH_J_per_mol).toBe(10_000);
  });

  it("computes deltaG = deltaH - T deltaS and direction", () => {
    const result = evaluateReactionCandidate(
      candidate(),
      adapter,
      { temperatureK: 300 },
      provider(0, 1_000, 10, 20),
    );
    expect(result.thermo.deltaG_J_per_mol).toBe(-2_000);
    expect(result.thermo.direction).toBe("FORWARD_FAVORED");
  });

  it("does not invent deltaG when entropy is missing", () => {
    const result = evaluateReactionCandidate(
      candidate(),
      adapter,
      { temperatureK: 300 },
      provider(0, -10_000),
    );
    expect(result.thermo.deltaH_J_per_mol).toBe(-10_000);
    expect(result.thermo.deltaG_J_per_mol).toBeUndefined();
    expect(result.thermo.direction).toBe("INDETERMINATE");
    expect(result.reasonCodes).toContain("MISSING_ENTROPY");
  });

  it("gives a higher relative rate at higher temperature for positive Ea", () => {
    const data = provider(0, -10_000, 10, 10, 60_000);
    const low = evaluateReactionCandidate(candidate(), adapter, { temperatureK: 300 }, data);
    const high = evaluateReactionCandidate(candidate(), adapter, { temperatureK: 600 }, data);
    expect(high.kinetics.relativeRate).toBeGreaterThan(low.kinetics.relativeRate!);
  });

  it("lets catalyst change kinetics without changing deltaG", () => {
    const data = provider(0, -10_000, 10, 10, 60_000);
    const base = evaluateReactionCandidate(candidate(), adapter, { temperatureK: 400 }, data);
    const catalyzed = evaluateReactionCandidate(
      candidate(),
      adapter,
      {
        temperatureK: 400,
        catalyst: {
          id: "cat",
          barrierReduction_J_per_mol: 20_000,
          status: "EMPIRICAL",
          confidence: "MEDIUM",
        },
      },
      data,
    );

    expect(catalyzed.thermo.deltaG_J_per_mol).toBe(base.thermo.deltaG_J_per_mol);
    expect(catalyzed.kinetics.relativeRate).toBeGreaterThan(base.kinetics.relativeRate!);
  });

  it("propagates OPEN and does not turn missing data into fake PASS", () => {
    const emptyProvider: ReactionEvaluationDataProvider = {
      getSpeciesThermo: () => undefined,
    };
    const result = evaluateReactionCandidate(
      candidate(),
      adapter,
      { temperatureK: 300 },
      emptyProvider,
    );

    expect(result.status).toBe("OPEN");
    expect(result.feasible).toBe("UNCERTAIN");
    expect(result.rankScore).toBeNull();
  });

  it("ranks candidates deterministically and marks stable ties", () => {
    const data = provider(0, -10_000, 10, 10);
    const b = evaluateReactionCandidate(candidate("b"), adapter, { temperatureK: 300 }, data);
    const a = evaluateReactionCandidate(candidate("a"), adapter, { temperatureK: 300 }, data);
    const ranked = rankReactionEvaluations([b, a]);

    expect(ranked.map((entry) => entry.candidateId)).toEqual(["a", "b"]);
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[1]?.rank).toBe(1);
    expect(ranked.every((entry) => entry.tie)).toBe(true);
  });

  it("rejects invalid temperature instead of silently evaluating in wrong units", () => {
    expect(() =>
      evaluateReactionCandidate(candidate(), adapter, { temperatureK: 0 }, provider(0, 0, 0, 0)),
    ).toThrow();
    expect(() =>
      evaluateReactionCandidate(
        candidate(),
        adapter,
        { temperatureK: Number.NaN },
        provider(0, 0, 0, 0),
      ),
    ).toThrow();
  });
});
