import { describe, expect, it } from "vitest";
import {
  createThermalState,
  evaluateThermalApparatusStep,
  type ThermalBody,
} from "../src/simulation/thermal";

function body(id: string, temperatureK: number, capacityJPerK = 100): ThermalBody {
  return {
    id,
    kind: "VESSEL",
    state: createThermalState({
      temperatureK,
      mixtureHeatCapacity_JPerK: capacityJPerK,
      vesselHeatCapacity_JPerK: 0,
    }),
    scientificStatus: "APPROXIMATED",
  };
}

function temp(result: ReturnType<typeof evaluateThermalApparatusStep>, id = "vessel") {
  return result.bodyUpdates.find((entry) => entry.bodyId === id)!.temperatureK;
}

function heater(id: string, targetTemperatureK: number) {
  return {
    id,
    bodyId: "vessel",
    enabled: true,
    mode: "HEATER" as const,
    powerW: 1e9,
    targetTemperatureK,
    apparatusKind: "HOT_PLATE" as const,
    scientificStatus: "APPROXIMATED" as const,
  };
}

function cooler(id: string, targetTemperatureK: number) {
  return {
    id,
    bodyId: "vessel",
    enabled: true,
    mode: "COOLER" as const,
    powerW: 1e9,
    targetTemperatureK,
    apparatusKind: "COOLING_BATH" as const,
    scientificStatus: "APPROXIMATED" as const,
  };
}

describe("Phase 4A-3 06D defect regressions", () => {
  it("bounds two identical heaters sharing one target", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      actuators: [heater("h1", 400), heater("h2", 400)],
      dtS: 1000,
    });
    expect(temp(result)).toBeCloseTo(400, 12);
    expect(result.externalEnergyJ).toBeCloseTo(10_000, 10);
    expect(result.transfers).toHaveLength(2);
    expect(result.transfers[0]!.energyJ).toBeCloseTo(5_000, 10);
    expect(result.transfers[1]!.energyJ).toBeCloseTo(5_000, 10);
  });

  it.each([3, 5])("does not scale same-target overshoot with %i heaters", (count) => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      actuators: Array.from({ length: count }, (_, index) => heater(`h${index}`, 400)),
      dtS: 1000,
    });
    expect(temp(result)).toBeCloseTo(400, 12);
    expect(result.externalEnergyJ).toBeCloseTo(10_000, 10);
  });

  it("bounds two identical coolers sharing one target", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 400)],
      actuators: [cooler("c1", 300), cooler("c2", 300)],
      dtS: 1000,
    });
    expect(temp(result)).toBeCloseTo(300, 12);
    expect(result.externalEnergyJ).toBeCloseTo(-10_000, 10);
  });

  it("reconciles mixed heater targets by individual caps plus deterministic aggregate scaling", () => {
    const actuators = [heater("h350", 350), heater("h400", 400)];
    const first = evaluateThermalApparatusStep({ bodies: [body("vessel", 300)], actuators, dtS: 1000 });
    const second = evaluateThermalApparatusStep({ bodies: [body("vessel", 300)], actuators: [...actuators].reverse(), dtS: 1000 });
    expect(temp(first)).toBeCloseTo(400, 12);
    expect(second).toEqual(first);
    const energies = new Map(first.transfers.map((entry) => [entry.id, entry.energyJ]));
    expect(energies.get("h350")).toBeCloseTo(10_000 / 3, 8);
    expect(energies.get("h400")).toBeCloseTo(20_000 / 3, 8);
  });

  it("is actuator-order invariant for same-target and mixed-target groups", () => {
    const actuators = [heater("c", 375), heater("a", 350), heater("b", 400)];
    const forward = evaluateThermalApparatusStep({ bodies: [body("vessel", 300)], actuators, dtS: 1000 });
    const reverse = evaluateThermalApparatusStep({ bodies: [body("vessel", 300)], actuators: [...actuators].reverse(), dtS: 1000 });
    expect(reverse).toEqual(forward);
  });

  it("caps heater contribution while exothermic reaction may raise final T above target", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      actuators: [heater("heater", 310)],
      reactionSources: [{ id: "rxn", bodyId: "vessel", energyJ: 50_000, scientificStatus: "VERIFIED" }],
      dtS: 1000,
    });
    expect(result.transfers.find((entry) => entry.id === "heater")!.energyJ).toBeCloseTo(1_000, 10);
    expect(temp(result)).toBeCloseTo(810, 10);
    const diagnostic = result.diagnostics.find((entry) => entry.id === "heater")!;
    expect(diagnostic.reasonCodes).toContain("ACTUATOR_TARGET_CONTRIBUTION_BOUND");
    expect(diagnostic.details?.actuatorAppliedEnergyJ).toBeCloseTo(1_000, 10);
    expect(diagnostic.details?.finalTemperatureMayCrossTargetDueToOtherSources).toBe(true);
  });

  it("caps cooler contribution while endothermic reaction may lower final T below target", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      actuators: [cooler("cooler", 290)],
      reactionSources: [{ id: "rxn", bodyId: "vessel", energyJ: -500, scientificStatus: "VERIFIED" }],
      dtS: 1000,
    });
    expect(result.transfers.find((entry) => entry.id === "cooler")!.energyJ).toBeCloseTo(1_000, 10);
    expect(temp(result)).toBeCloseTo(285, 10);
  });

  it("keeps heater target as an own-contribution bound with a hotter reservoir", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      actuators: [heater("heater", 310)],
      reservoirs: [{
        id: "hot-room",
        bodyId: "vessel",
        enabled: true,
        reservoirTemperatureK: 400,
        conductanceWPerK: 1,
        mechanism: "AMBIENT",
        scientificStatus: "APPROXIMATED",
      }],
      dtS: 1,
    });
    expect(result.transfers.find((entry) => entry.id === "heater")!.energyJ).toBeCloseTo(1_000, 10);
    expect(temp(result)).toBeGreaterThan(310);
  });

  it("rejects duplicate actuator IDs before any state update", () => {
    expect(() => evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      actuators: [heater("same", 350), heater("same", 400)],
      dtS: 1,
    })).toThrow(/Duplicate thermal actuator id: same/);
  });

  it("rejects duplicate contact IDs before any state update", () => {
    expect(() => evaluateThermalApparatusStep({
      bodies: [body("a", 350), body("b", 300)],
      contacts: [
        { id: "same", bodyAId: "a", bodyBId: "b", enabled: true, conductanceWPerK: 1, mechanism: "CONTACT", scientificStatus: "APPROXIMATED" },
        { id: "same", bodyAId: "a", bodyBId: "b", enabled: true, conductanceWPerK: 2, mechanism: "CONTACT", scientificStatus: "APPROXIMATED" },
      ],
      dtS: 1,
    })).toThrow(/Duplicate thermal contact id: same/);
  });

  it("rejects duplicate reservoir IDs before any state update", () => {
    expect(() => evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      reservoirs: [
        { id: "same", bodyId: "vessel", enabled: true, reservoirTemperatureK: 350, conductanceWPerK: 1, mechanism: "AMBIENT", scientificStatus: "APPROXIMATED" },
        { id: "same", bodyId: "vessel", enabled: true, reservoirTemperatureK: 250, conductanceWPerK: 1, mechanism: "AMBIENT", scientificStatus: "APPROXIMATED" },
      ],
      dtS: 1,
    })).toThrow(/Duplicate thermal reservoir id: same/);
  });

  it("rejects duplicate reaction-source IDs before any state update", () => {
    expect(() => evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      reactionSources: [
        { id: "same", bodyId: "vessel", energyJ: 10, scientificStatus: "VERIFIED" },
        { id: "same", bodyId: "vessel", energyJ: 20, scientificStatus: "VERIFIED" },
      ],
      dtS: 1,
    })).toThrow(/Duplicate thermal reaction source id: same/);
  });

  it("preserves the existing multi-contact envelope and exact energy closure", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("hot", 400), body("cold-a", 200), body("cold-b", 250)],
      contacts: [
        { id: "a", bodyAId: "hot", bodyBId: "cold-a", enabled: true, conductanceWPerK: 1e200, mechanism: "CONTACT", scientificStatus: "APPROXIMATED" },
        { id: "b", bodyAId: "hot", bodyBId: "cold-b", enabled: true, conductanceWPerK: 1e200, mechanism: "CONTACT", scientificStatus: "APPROXIMATED" },
      ],
      dtS: 1e200,
    });
    expect(temp(result, "hot")).toBeGreaterThanOrEqual(200);
    expect(result.bodyUpdates.reduce((sum, entry) => sum + entry.internalTransferEnergy_J, 0)).toBeCloseTo(0, 10);
    expect(result.bodyUpdates.reduce((sum, entry) => sum + entry.netEnergy_J, 0)).toBeCloseTo(0, 10);
  });

  it("keeps ledger/external/reaction accounting exact after actuator normalization", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      actuators: [heater("h1", 310), heater("h2", 310)],
      reactionSources: [{ id: "rxn", bodyId: "vessel", energyJ: 250, scientificStatus: "VERIFIED" }],
      dtS: 1000,
    });
    const update = result.bodyUpdates[0]!;
    expect(result.externalEnergyJ).toBeCloseTo(1_000, 10);
    expect(result.reactionEnergyJ).toBe(250);
    expect(update.netEnergy_J).toBeCloseTo(1_250, 10);
    expect(update.state.cumulativeEnergy.heaterEnergy_J).toBeCloseTo(1_000, 10);
    expect(update.state.cumulativeEnergy.reactionHeat_J).toBe(250);
  });

  it("replays actuator normalization deterministically", () => {
    const input = {
      bodies: [body("vessel", 300)],
      actuators: [heater("h2", 400), heater("h1", 350)],
      reactionSources: [{ id: "rxn", bodyId: "vessel", energyJ: 10, scientificStatus: "VERIFIED" as const }],
      dtS: 1000,
    };
    expect(evaluateThermalApparatusStep(input)).toEqual(evaluateThermalApparatusStep(input));
  });
});
