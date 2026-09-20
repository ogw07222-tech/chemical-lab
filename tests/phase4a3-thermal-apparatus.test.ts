import { describe, expect, it } from "vitest";
import {
  createThermalState,
  evaluateMixtureHeatCapacity,
  evaluateThermalApparatusStep,
  type ThermalApparatusEvaluation,
  type ThermalBody,
} from "../src/simulation/thermal";
import type { SpeciesState } from "../src/simulation/molecular";

function body(id: string, temperatureK: number, capacityJPerK = 100, kind: ThermalBody["kind"] = "VESSEL"): ThermalBody {
  return {
    id,
    kind,
    state: createThermalState({ temperatureK, mixtureHeatCapacity_JPerK: capacityJPerK, vesselHeatCapacity_JPerK: 0 }),
    scientificStatus: "APPROXIMATED",
    source: "phase4a3-test",
  };
}

function updatedBodies(previous: readonly ThermalBody[], evaluation: ThermalApparatusEvaluation): ThermalBody[] {
  const states = new Map(evaluation.bodyUpdates.map((update) => [update.bodyId, update.state]));
  return previous.map((entry) => ({ ...entry, state: states.get(entry.id) ?? entry.state }));
}

function update(evaluation: ThermalApparatusEvaluation, id: string) {
  return evaluation.bodyUpdates.find((entry) => entry.bodyId === id)!;
}

const gasPhase = {
  phase: "gas" as const,
  source: "phase4a3-test",
  phaseStateId: "gas:test",
  scientificStatus: "APPROXIMATED" as const,
};
const fakeMolecule = {
  atoms: [],
  bonds: [],
};
const molecule = {
  graph: fakeMolecule,
  formula: {},
  netCharge: 0,
  canonicalKey: "test",
};
function species(id: string, amountMol: number): SpeciesState {
  return { id, amountMol, molecule, phaseState: gasPhase };
}

describe("Phase 4A-3 thermal apparatus engine", () => {
  it("computes mixture heat capacity from phase-matched molar Cp data", () => {
    const result = evaluateMixtureHeatCapacity(
      [species("A", 2), species("B", 1)],
      [
        { speciesId: "A", phase: "gas", molarHeatCapacity_JPerMolK: 20, scientificStatus: "VERIFIED", source: "03" },
        { speciesId: "B", phase: "gas", molarHeatCapacity_JPerMolK: 30, scientificStatus: "APPROXIMATED", source: "03" },
      ],
    );
    expect(result.heatCapacity_JPerK).toBe(70);
    expect(result.scientificStatus).toBe("APPROXIMATED");
    expect(result.missingSpeciesIds).toEqual([]);
  });

  it("returns OPEN rather than fabricating Cp for a generated/unknown species", () => {
    const result = evaluateMixtureHeatCapacity(
      [species("generated:abc", 0.1)],
      [],
    );
    expect(result.heatCapacity_JPerK).toBeUndefined();
    expect(result.scientificStatus).toBe("OPEN");
    expect(result.missingSpeciesIds).toEqual(["generated:abc"]);
  });

  it("requires exact phase support for Cp", () => {
    const result = evaluateMixtureHeatCapacity(
      [species("A", 1)],
      [{ speciesId: "A", phase: "liquid", molarHeatCapacity_JPerMolK: 50, scientificStatus: "VERIFIED", source: "03" }],
    );
    expect(result.scientificStatus).toBe("OPEN");
    expect(result.heatCapacity_JPerK).toBeUndefined();
  });

  it("conserves energy for two finite bodies and moves temperatures toward equilibrium", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("A", 350, 100), body("B", 300, 200)],
      contacts: [{ id: "A-B", bodyAId: "A", bodyBId: "B", enabled: true, conductanceWPerK: 10, mechanism: "CONTACT", scientificStatus: "APPROXIMATED" }],
      dtS: 1,
    });
    const a = update(result, "A");
    const b = update(result, "B");
    expect(a.temperatureK).toBeLessThan(350);
    expect(b.temperatureK).toBeGreaterThan(300);
    expect(a.temperatureK).toBeGreaterThanOrEqual(300);
    expect(b.temperatureK).toBeLessThanOrEqual(350);
    expect(a.netEnergy_J + b.netEnergy_J).toBeCloseTo(0, 12);
    expect(result.externalEnergyJ).toBe(0);
  });

  it("approaches the weighted common equilibrium without overshoot at huge dt", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("A", 350, 100), body("B", 300, 200)],
      contacts: [{ id: "A-B", bodyAId: "A", bodyBId: "B", enabled: true, conductanceWPerK: 1e200, mechanism: "CONTACT", scientificStatus: "APPROXIMATED" }],
      dtS: 1e200,
    });
    const expected = (100 * 350 + 200 * 300) / 300;
    expect(update(result, "A").temperatureK).toBeCloseTo(expected, 10);
    expect(update(result, "B").temperatureK).toBeCloseTo(expected, 10);
  });

  it("models a hot plate as external heater -> plate -> vessel contact, not temperature teleport", () => {
    let bodies = [body("plate", 293, 100, "HOT_PLATE"), body("vessel", 293, 100)];
    const actuator = [{ id: "plate-power", bodyId: "plate", enabled: true, mode: "HEATER" as const, powerW: 100, targetTemperatureK: 373, apparatusKind: "HOT_PLATE" as const, scientificStatus: "APPROXIMATED" as const }];
    const contacts = [{ id: "plate-vessel", bodyAId: "plate", bodyBId: "vessel", enabled: true, conductanceWPerK: 20, mechanism: "CONTACT" as const, scientificStatus: "APPROXIMATED" as const }];
    const first = evaluateThermalApparatusStep({ bodies, actuators: actuator, contacts, dtS: 1 });
    expect(update(first, "plate").temperatureK).toBeCloseTo(294, 12);
    expect(update(first, "plate").temperatureK).not.toBe(373);
    expect(update(first, "vessel").temperatureK).toBe(293);
    bodies = updatedBodies(bodies, first);
    const second = evaluateThermalApparatusStep({ bodies, actuators: actuator, contacts, dtS: 1 });
    expect(update(second, "vessel").temperatureK).toBeGreaterThan(293);
    expect(second.transfers.some((entry) => entry.mechanism === "CONTACT")).toBe(true);
  });

  it("disabling the hot-plate heater stops external energy input", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("plate", 300, 100, "HOT_PLATE")],
      actuators: [{ id: "plate", bodyId: "plate", enabled: false, mode: "HEATER", powerW: 1000, apparatusKind: "HOT_PLATE", scientificStatus: "APPROXIMATED" }],
      dtS: 10,
    });
    expect(result.externalEnergyJ).toBe(0);
    expect(update(result, "plate").temperatureK).toBe(300);
  });

  it("models a heating bath as heater -> finite bath -> vessel BATH topology", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("bath", 340, 500, "BATH_MEDIUM"), body("vessel", 290, 100)],
      actuators: [{ id: "bath-heater", bodyId: "bath", enabled: true, mode: "HEATER", powerW: 50, apparatusKind: "HEATING_BATH", scientificStatus: "APPROXIMATED" }],
      contacts: [{ id: "bath-vessel", bodyAId: "bath", bodyBId: "vessel", enabled: true, conductanceWPerK: 10, mechanism: "BATH", scientificStatus: "APPROXIMATED" }],
      dtS: 1,
    });
    expect(result.transfers.some((entry) => entry.mechanism === "BATH")).toBe(true);
    expect(update(result, "vessel").temperatureK).toBeGreaterThan(290);
    expect(result.externalEnergyJ).toBe(50);
  });

  it("models a finite cooling bath that warms while the vessel cools", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("bath", 280, 300, "BATH_MEDIUM"), body("vessel", 350, 100)],
      contacts: [{ id: "bath-vessel", bodyAId: "bath", bodyBId: "vessel", enabled: true, conductanceWPerK: 20, mechanism: "BATH", scientificStatus: "APPROXIMATED" }],
      dtS: 10,
    });
    expect(update(result, "vessel").temperatureK).toBeLessThan(350);
    expect(update(result, "bath").temperatureK).toBeGreaterThan(280);
    expect(update(result, "vessel").netEnergy_J + update(result, "bath").netEnergy_J).toBeCloseTo(0, 12);
  });

  it("models hot-air chamber transfer through CONVECTION rather than plate contact", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("air", 360, 1000, "CHAMBER_GAS"), body("vessel", 300, 100)],
      contacts: [{ id: "air-vessel", bodyAId: "air", bodyBId: "vessel", enabled: true, conductanceWPerK: 5, mechanism: "CONVECTION", scientificStatus: "APPROXIMATED" }],
      dtS: 2,
    });
    expect(result.transfers[0]?.mechanism).toBe("CONVECTION");
    expect(update(result, "vessel").temperatureK).toBeGreaterThan(300);
  });

  it("accounts ambient reservoir exchange as external energy", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 350, 100)],
      reservoirs: [{ id: "lab-air", bodyId: "vessel", enabled: true, reservoirTemperatureK: 293, conductanceWPerK: 2, mechanism: "AMBIENT", scientificStatus: "APPROXIMATED" }],
      dtS: 10,
    });
    expect(result.externalEnergyJ).toBeLessThan(0);
    expect(update(result, "vessel").netEnergy_J).toBeCloseTo(result.externalEnergyJ, 12);
    expect(update(result, "vessel").state.cumulativeEnergy.environmentHeat_J).toBeCloseTo(result.externalEnergyJ, 12);
  });

  it("setpoint-limited heater approaches target without instantaneous assignment or overshoot", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("plate", 300, 100, "HOT_PLATE")],
      actuators: [{ id: "heater", bodyId: "plate", enabled: true, mode: "HEATER", powerW: 10, targetTemperatureK: 350, apparatusKind: "HOT_PLATE", scientificStatus: "APPROXIMATED" }],
      dtS: 1,
    });
    expect(update(result, "plate").temperatureK).toBeCloseTo(300.1, 12);
    const huge = evaluateThermalApparatusStep({
      bodies: [body("plate", 300, 100, "HOT_PLATE")],
      actuators: [{ id: "heater", bodyId: "plate", enabled: true, mode: "HEATER", powerW: 1e9, targetTemperatureK: 350, apparatusKind: "HOT_PLATE", scientificStatus: "APPROXIMATED" }],
      dtS: 1e9,
    });
    expect(update(huge, "plate").temperatureK).toBeCloseTo(350, 12);
  });

  it("setpoint-limited cooler cannot remove energy past its requested target", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("bath", 320, 100, "BATH_MEDIUM")],
      actuators: [{ id: "cooler", bodyId: "bath", enabled: true, mode: "COOLER", powerW: 1e9, targetTemperatureK: 280, apparatusKind: "COOLING_BATH", scientificStatus: "APPROXIMATED" }],
      dtS: 1e9,
    });
    expect(update(result, "bath").temperatureK).toBeCloseTo(280, 12);
    expect(result.externalEnergyJ).toBe(-4000);
  });

  it("combines exothermic reaction heat and heater energy exactly once", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300, 100)],
      actuators: [{ id: "heater", bodyId: "vessel", enabled: true, mode: "HEATER", powerW: 20, apparatusKind: "HOT_PLATE", scientificStatus: "APPROXIMATED" }],
      reactionSources: [{ id: "rxn", bodyId: "vessel", energyJ: 50, scientificStatus: "VERIFIED", source: "reaction-progression" }],
      dtS: 2,
    });
    expect(result.reactionEnergyJ).toBe(50);
    expect(result.externalEnergyJ).toBe(40);
    expect(update(result, "vessel").netEnergy_J).toBe(90);
    expect(update(result, "vessel").temperatureK).toBeCloseTo(300.9, 12);
    expect(update(result, "vessel").state.cumulativeEnergy.reactionHeat_J).toBe(50);
    expect(update(result, "vessel").state.cumulativeEnergy.heaterEnergy_J).toBe(40);
  });

  it("supports endothermic reaction heat through the same authoritative update path", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300, 100)],
      reactionSources: [{ id: "rxn", bodyId: "vessel", energyJ: -100, scientificStatus: "VERIFIED" }],
      dtS: 1,
    });
    expect(result.reactionEnergyJ).toBe(-100);
    expect(update(result, "vessel").temperatureK).toBeCloseTo(299, 12);
  });

  it("rejects an energy aggregate that would produce non-positive Kelvin", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 1, 1)],
      reactionSources: [{ id: "rxn", bodyId: "vessel", energyJ: -2, scientificStatus: "VERIFIED" }],
      dtS: 1,
    });
    expect(result.scientificStatus).toBe("OPEN");
    expect(result.bodyUpdates).toEqual([]);
    expect(result.diagnostics.some((entry) => entry.reasonCodes.includes("INVALID_TEMPERATURE_UPDATE"))).toBe(true);
  });

  it("keeps multiple finite contacts within the snapshot thermal envelope", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("hot", 400, 100), body("cold-a", 200, 100), body("cold-b", 250, 100)],
      contacts: [
        { id: "a", bodyAId: "hot", bodyBId: "cold-a", enabled: true, conductanceWPerK: 1e200, mechanism: "CONTACT", scientificStatus: "APPROXIMATED" },
        { id: "b", bodyAId: "hot", bodyBId: "cold-b", enabled: true, conductanceWPerK: 1e200, mechanism: "CONTACT", scientificStatus: "APPROXIMATED" },
      ],
      dtS: 1e200,
    });
    expect(update(result, "hot").temperatureK).toBeGreaterThanOrEqual(200);
    expect(update(result, "cold-a").temperatureK).toBeLessThanOrEqual(400);
    expect(update(result, "cold-b").temperatureK).toBeLessThanOrEqual(400);
    expect(result.bodyUpdates.reduce((sum, entry) => sum + entry.internalTransferEnergy_J, 0)).toBeCloseTo(0, 10);
  });

  it("is invariant to body/contact/actuator/reaction ordering", () => {
    const bodies = [body("A", 350, 100), body("B", 300, 200), body("C", 320, 150)];
    const contacts = [
      { id: "A-B", bodyAId: "A", bodyBId: "B", enabled: true, conductanceWPerK: 5, mechanism: "CONTACT" as const, scientificStatus: "APPROXIMATED" as const },
      { id: "C-B", bodyAId: "C", bodyBId: "B", enabled: true, conductanceWPerK: 3, mechanism: "CONVECTION" as const, scientificStatus: "APPROXIMATED" as const },
    ];
    const actuators = [
      { id: "heater-a", bodyId: "A", enabled: true, mode: "HEATER" as const, powerW: 10, apparatusKind: "HOT_PLATE" as const, scientificStatus: "APPROXIMATED" as const },
      { id: "cooler-c", bodyId: "C", enabled: true, mode: "COOLER" as const, powerW: 4, apparatusKind: "COOLING_BATH" as const, scientificStatus: "APPROXIMATED" as const },
    ];
    const reactions = [
      { id: "r1", bodyId: "B", energyJ: 5, scientificStatus: "VERIFIED" as const },
      { id: "r2", bodyId: "A", energyJ: -2, scientificStatus: "VERIFIED" as const },
    ];
    const first = evaluateThermalApparatusStep({ bodies, contacts, actuators, reactionSources: reactions, dtS: 1 });
    const second = evaluateThermalApparatusStep({ bodies: [...bodies].reverse(), contacts: [...contacts].reverse(), actuators: [...actuators].reverse(), reactionSources: [...reactions].reverse(), dtS: 1 });
    expect(second).toEqual(first);
  });

  it("is deterministic for replay-identical inputs", () => {
    const input = {
      bodies: [body("A", 330, 100), body("B", 300, 100)],
      contacts: [{ id: "A-B", bodyAId: "A", bodyBId: "B", enabled: true, conductanceWPerK: 7, mechanism: "CONTACT" as const, scientificStatus: "APPROXIMATED" as const }],
      dtS: 0.001,
    };
    expect(evaluateThermalApparatusStep(input)).toEqual(evaluateThermalApparatusStep(input));
  });

  it("handles tiny dt with finite smooth energy transfer", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("A", 350, 100), body("B", 300, 100)],
      contacts: [{ id: "A-B", bodyAId: "A", bodyBId: "B", enabled: true, conductanceWPerK: 10, mechanism: "CONTACT", scientificStatus: "APPROXIMATED" }],
      dtS: 1e-12,
    });
    expect(Number.isFinite(result.transfers[0]!.energyJ)).toBe(true);
    expect(result.transfers[0]!.energyJ).toBeGreaterThan(0);
  });

  it.each([Number.NaN, Number.NEGATIVE_INFINITY, -1])("rejects invalid conductance %s as OPEN", (conductanceWPerK) => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("A", 350), body("B", 300)],
      contacts: [{ id: "bad", bodyAId: "A", bodyBId: "B", enabled: true, conductanceWPerK, mechanism: "CONTACT", scientificStatus: "APPROXIMATED" }],
      dtS: 1,
    });
    expect(result.scientificStatus).toBe("OPEN");
    expect(result.transfers).toEqual([]);
  });

  it("returns OPEN and no NaN/Infinity for non-finite external power", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("A", 300)],
      actuators: [{ id: "bad", bodyId: "A", enabled: true, mode: "HEATER", powerW: Number.POSITIVE_INFINITY, apparatusKind: "HOT_PLATE", scientificStatus: "APPROXIMATED" }],
      dtS: 1,
    });
    expect(result.scientificStatus).toBe("OPEN");
    expect(result.externalEnergyJ).toBe(0);
    expect(result.bodyUpdates.every((entry) => Number.isFinite(entry.temperatureK))).toBe(true);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid total heat capacity construction %s", (capacity) => {
    expect(() => body("bad", 300, capacity)).toThrow();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid initial temperature %s", (temperatureK) => {
    expect(() => body("bad", temperatureK, 100)).toThrow();
  });

  it("rejects invalid dt explicitly", () => {
    expect(() => evaluateThermalApparatusStep({ bodies: [body("A", 300)], dtS: Number.NaN })).toThrow(/dtS/);
    expect(() => evaluateThermalApparatusStep({ bodies: [body("A", 300)], dtS: -1 })).toThrow(/dtS/);
  });

  it("preserves closed-system energy while external source/sink accounting matches finite-body energy change", () => {
    const closed = evaluateThermalApparatusStep({
      bodies: [body("A", 350, 100), body("B", 300, 100)],
      contacts: [{ id: "A-B", bodyAId: "A", bodyBId: "B", enabled: true, conductanceWPerK: 10, mechanism: "CONTACT", scientificStatus: "APPROXIMATED" }],
      dtS: 2,
    });
    expect(closed.bodyUpdates.reduce((sum, entry) => sum + entry.netEnergy_J, 0)).toBeCloseTo(0, 12);

    const external = evaluateThermalApparatusStep({
      bodies: [body("A", 300, 100)],
      actuators: [
        { id: "heater", bodyId: "A", enabled: true, mode: "HEATER", powerW: 20, apparatusKind: "HOT_PLATE", scientificStatus: "APPROXIMATED" },
        { id: "cooler", bodyId: "A", enabled: true, mode: "COOLER", powerW: 5, apparatusKind: "COOLING_BATH", scientificStatus: "APPROXIMATED" },
      ],
      reactionSources: [{ id: "rxn", bodyId: "A", energyJ: 7, scientificStatus: "VERIFIED" }],
      dtS: 2,
    });
    const finiteDelta = external.bodyUpdates.reduce((sum, entry) => sum + entry.netEnergy_J, 0);
    expect(finiteDelta).toBeCloseTo(external.externalEnergyJ + external.reactionEnergyJ, 12);
    expect(external.externalEnergyJ).toBe(30);
    expect(external.reactionEnergyJ).toBe(7);
  });
});
