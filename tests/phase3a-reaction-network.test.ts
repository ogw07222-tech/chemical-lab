import { describe, expect, it } from "vitest";
import {
  projectPhase3AProviderState,
  runPhase3AReactionNetworkStep,
  type Phase3AReactionNetworkState,
  type Phase3AReactionStepExecutor,
} from "../src/integration/phase3a-reaction-network";
import type { SpeciesState } from "../src/simulation/molecular";
import type { ReactionProgressEvent } from "../src/simulation/reaction-progression";
import type { DynamicSpeciesRegistryLike } from "../src/simulation/species-registry";
import type { ThermalState } from "../src/simulation/thermal";

const elements = { getElement: () => undefined };
const registry = {} as DynamicSpeciesRegistryLike;
const thermalState: ThermalState = {
  temperatureK: 300,
  mixtureHeatCapacity_JPerK: 100,
  vesselHeatCapacity_JPerK: 100,
  cumulativeEnergy: {
    reactionHeat_J: 0,
    heaterEnergy_J: 0,
    coolerEnergyRemoved_J: 0,
    thermostatEnergy_J: 0,
    environmentHeat_J: 0,
    phaseChangeLatentHeat_J: 0,
    otherExternalEnergy_J: 0,
  },
};

function species(id: string, amountMol: number, phase: "unknown" | "gas" = "unknown"): SpeciesState {
  return {
    id,
    amountMol,
    molecule: { canonicalKey: `key:${id}` },
    phaseState: {
      phase,
      source: "test",
      phaseStateId: `phase:${phase}:${id}`,
      scientificStatus: "OPEN",
    },
  } as SpeciesState;
}

function event(
  timestepId: string,
  sequence: number,
  candidateId: string,
  startTimeS: number,
  consumed: Readonly<Record<string, number>>,
  produced: Readonly<Record<string, number>>,
  heatJ?: number,
): ReactionProgressEvent {
  const speciesAmountDeltaMol: Record<string, number> = {};
  for (const [id, value] of Object.entries(consumed)) speciesAmountDeltaMol[id] = value;
  for (const [id, value] of Object.entries(produced)) speciesAmountDeltaMol[id] = (speciesAmountDeltaMol[id] ?? 0) + value;
  return {
    id: `${timestepId}:reaction:${String(sequence).padStart(4, "0")}:${candidateId}`,
    timestepId,
    candidateId,
    sequence,
    startTimeS,
    endTimeS: startTimeS + 1,
    dtS: 1,
    extentMol: 1,
    reactantDeltasMol: consumed,
    productDeltasMol: produced,
    speciesAmountDeltaMol,
    ...(heatJ === undefined ? {} : { heatJ }),
    scientificStatus: "APPROXIMATED",
    reasonCodes: ["SELECTED"],
  };
}

function initialState(entries: readonly SpeciesState[] = [species("A", 1)]): Phase3AReactionNetworkState {
  return {
    species: entries,
    thermalState,
    speciesRegistry: registry,
    simTimeS: 0,
    completedTimesteps: 0,
    timelineEvents: [],
  };
}

function fakeExecutor(
  produce: (snapshot: readonly SpeciesState[], timestepId: string, startTimeS: number) => {
    speciesAfter: readonly SpeciesState[];
    events: readonly ReactionProgressEvent[];
    knownHeatJ?: number;
  },
): Phase3AReactionStepExecutor {
  return ((input, config) => {
    const built = produce(input.species, config.timestepId, config.startTimeS);
    return {
      foundation: { candidates: [], evaluations: [], ranked: [], validationCandidates: [], performance: {} },
      resolution: {
        speciesBefore: input.species,
        speciesAfter: built.speciesAfter,
        selected: [],
        deferred: [],
        progressEvents: built.events,
        netSpeciesAmountDeltaMol: {},
        diagnostics: {},
      },
      thermal: {
        state: config.thermalState,
        events: built.events,
        scientificStatus: "APPROXIMATED",
        missingHeatCandidateIds: [],
        knownReactionHeat_J: built.knownHeatJ ?? built.events.reduce((sum, item) => sum + (item.heatJ ?? 0), 0),
      },
      nextState: {
        species: built.speciesAfter,
        thermalState: config.thermalState,
        speciesRegistry: config.speciesRegistry,
        phaseReevaluationRequired: built.events.length > 0,
      },
    } as unknown as ReturnType<Phase3AReactionStepExecutor>;
  }) as Phase3AReactionStepExecutor;
}

function transition(from: string, to: string): Phase3AReactionStepExecutor {
  return fakeExecutor((snapshot, timestepId, startTimeS) => {
    const source = snapshot.find((item) => item.id === from);
    if (!source || source.amountMol <= 0) return { speciesAfter: snapshot, events: [] };
    const target = snapshot.find((item) => item.id === to);
    const amount = source.amountMol;
    return {
      speciesAfter: [
        ...snapshot.filter((item) => item.id !== from && item.id !== to),
        species(from, 0, source.phaseState.phase === "gas" ? "gas" : "unknown"),
        species(to, (target?.amountMol ?? 0) + amount),
      ],
      events: [event(timestepId, 0, `${from}->${to}`, startTimeS, { [from]: -amount }, { [to]: amount })],
    };
  });
}

const config = {
  dtS: 1,
  timestepId: "step-1",
  environment: { temperatureK: 300, pressurePa: 101325 },
};

function step(
  state: Phase3AReactionNetworkState,
  timestepId: string,
  executor: Phase3AReactionStepExecutor,
) {
  return runPhase3AReactionNetworkStep(
    state,
    { elements },
    { ...config, timestepId },
    executor,
  );
}

describe("Phase 3A multi-step reaction network", () => {
  it("makes A->B product unavailable in N and available as B->C reactant in N+1", () => {
    const first = step(initialState(), "step-1", transition("A", "B"));
    expect(first.reactantSnapshot.some((item) => item.id === "B")).toBe(false);
    expect(first.nextState.species.find((item) => item.id === "B")?.amountMol).toBe(1);

    const second = step(first.nextState, "step-2", transition("B", "C"));
    expect(second.reactantSnapshot.find((item) => item.id === "B")?.amountMol).toBe(1);
    expect(second.nextState.species.find((item) => item.id === "C")?.amountMol).toBe(1);
  });

  it("executes a deterministic three-step chain across three timesteps", () => {
    const n1 = step(initialState(), "step-1", transition("A", "B"));
    const n2 = step(n1.nextState, "step-2", transition("B", "C"));
    const n3 = step(n2.nextState, "step-3", transition("C", "D"));
    expect(n3.nextState.species.find((item) => item.id === "D")?.amountMol).toBe(1);
    expect(n3.nextState.timelineEvents.map((item) => item.candidateId)).toEqual(["A->B", "B->C", "C->D"]);
  });

  it("accepts fair shared-reactant allocation and rejects aggregate overconsumption", () => {
    const fair = fakeExecutor((snapshot, timestepId, startTimeS) => ({
      speciesAfter: [species("A", 0), species("B", 0.5), species("C", 0.5)],
      events: [
        event(timestepId, 0, "branch-1", startTimeS, { A: -0.5 }, { B: 0.5 }),
        event(timestepId, 1, "branch-2", startTimeS, { A: -0.5 }, { C: 0.5 }),
      ],
    }));
    expect(step(initialState(), "step-1", fair).nextState.species.find((item) => item.id === "A")?.amountMol).toBe(0);

    const invalid = fakeExecutor((_snapshot, timestepId, startTimeS) => ({
      speciesAfter: [species("A", 0), species("B", 0.7), species("C", 0.7)],
      events: [
        event(timestepId, 0, "branch-1", startTimeS, { A: -0.7 }, { B: 0.7 }),
        event(timestepId, 1, "branch-2", startTimeS, { A: -0.7 }, { C: 0.7 }),
      ],
    }));
    expect(() => step(initialState(), "step-1", invalid)).toThrow(/SHARED_REACTANT_OVERCONSUMPTION/);
  });

  it("supports a branching network without introducing a persistent authority graph", () => {
    const branch = fakeExecutor((_snapshot, timestepId, startTimeS) => ({
      speciesAfter: [species("A", 0), species("B", 0.5), species("C", 0.5)],
      events: [
        event(timestepId, 0, "A->B", startTimeS, { A: -0.5 }, { B: 0.5 }),
        event(timestepId, 1, "A->C", startTimeS, { A: -0.5 }, { C: 0.5 }),
      ],
    }));
    const result = step(initialState(), "step-1", branch);
    expect(result.nextState.species.map((item) => [item.id, item.amountMol])).toEqual([["A", 0], ["B", 0.5], ["C", 0.5]]);
    expect(result.nextState).not.toHaveProperty("reactionGraph");
  });

  it("allows a generated unknown species to participate on the next timestep", () => {
    const created = step(initialState(), "step-1", transition("A", "generated:unknown"));
    const generated = created.nextState.species.find((item) => item.id === "generated:unknown")!;
    expect(generated.phaseState.phase).toBe("unknown");

    const consumed = step(created.nextState, "step-2", transition("generated:unknown", "Z"));
    expect(consumed.reactantSnapshot.find((item) => item.id === "generated:unknown")?.amountMol).toBe(1);
    expect(consumed.nextState.species.find((item) => item.id === "Z")?.amountMol).toBe(1);
  });

  it("keeps registration failure atomic from the caller perspective", () => {
    const state = initialState();
    const failing = (() => {
      throw new Error("PRODUCT_REGISTRATION_FAILED:test");
    }) as Phase3AReactionStepExecutor;
    expect(() => step(state, "step-1", failing)).toThrow(/PRODUCT_REGISTRATION_FAILED/);
    expect(state.species).toEqual([species("A", 1)]);
    expect(state.timelineEvents).toEqual([]);
    expect(state.completedTimesteps).toBe(0);
  });

  it("replays deterministically for identical state, timestep and executor", () => {
    const executor = transition("A", "B");
    const left = step(initialState(), "step-1", executor);
    const right = step(initialState(), "step-1", executor);
    expect(left.nextState.species).toEqual(right.nextState.species);
    expect(left.nextState.timelineEvents).toEqual(right.nextState.timelineEvents);
    expect(left.provider).toEqual(right.provider);
  });

  it("rejects negative or non-finite committed amounts", () => {
    const negative = fakeExecutor((_snapshot, timestepId, startTimeS) => ({
      speciesAfter: [species("A", -0.1)],
      events: [event(timestepId, 0, "bad", startTimeS, { A: -0.1 }, { B: 0.1 })],
    }));
    expect(() => step(initialState(), "step-1", negative)).toThrow(/amountMol/);

    const nonFinite = initialState([species("A", Number.POSITIVE_INFINITY)]);
    expect(() => step(nonFinite, "step-1", transition("A", "B"))).toThrow(/amountMol/);
  });

  it("rejects any same-step hidden cascade that consumes a newly produced species", () => {
    const cascade = fakeExecutor((_snapshot, timestepId, startTimeS) => ({
      speciesAfter: [species("A", 0), species("B", 0), species("C", 1)],
      events: [
        event(timestepId, 0, "A->B", startTimeS, { A: -1 }, { B: 1 }),
        event(timestepId, 1, "B->C", startTimeS, { B: -1 }, { C: 1 }),
      ],
    }));
    expect(() => step(initialState(), "step-1", cascade)).toThrow(/SAME_STEP_CASCADE_BLOCKED/);
  });

  it("keeps multi-reaction heat facts consistent and projects UI-consumable facts without molecular identity leakage", () => {
    const heated = fakeExecutor((_snapshot, timestepId, startTimeS) => ({
      speciesAfter: [species("A", 0), species("B", 0.5), species("C", 0.5)],
      events: [
        event(timestepId, 0, "r1", startTimeS, { A: -0.5 }, { B: 0.5 }, 10),
        event(timestepId, 1, "r2", startTimeS, { A: -0.5 }, { C: 0.5 }, -4),
      ],
      knownHeatJ: 6,
    }));
    const result = step(initialState(), "step-1", heated);
    expect(result.provider.activeReactionEvents.map((item) => item.reactionHeat_J)).toEqual([10, -4]);
    expect(result.provider.authoritativeVesselComposition[0]).not.toHaveProperty("molecule");
    expect(result.provider.authoritativeVesselComposition[0]).not.toHaveProperty("formula");

    const mismatch = fakeExecutor((_snapshot, timestepId, startTimeS) => ({
      speciesAfter: [species("A", 0), species("B", 1)],
      events: [event(timestepId, 0, "bad-heat", startTimeS, { A: -1 }, { B: 1 }, 5)],
      knownHeatJ: 4,
    }));
    expect(() => step(initialState(), "step-1", mismatch)).toThrow(/REACTION_HEAT_EVENT_MISMATCH/);
  });

  it("keeps provider timeline ordering identical to authoritative event ordering", () => {
    const events = [
      event("step-1", 0, "a", 0, { A: -0.5 }, { B: 0.5 }),
      event("step-1", 1, "b", 0, { A: -0.5 }, { C: 0.5 }),
    ];
    const projection = projectPhase3AProviderState([species("C", 0.5), species("B", 0.5)], events, events);
    expect(projection.timelineEvents.map((item) => item.candidateId)).toEqual(["a", "b"]);
    expect(projection.authoritativeVesselComposition.map((item) => item.speciesRef)).toEqual(["B", "C"]);
  });
});
