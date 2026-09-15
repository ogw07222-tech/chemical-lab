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

function heater(id: string, targetTemperatureK: number, bodyId = "vessel") {
  return {
    id,
    bodyId,
    enabled: true,
    mode: "HEATER" as const,
    powerW: 1e9,
    targetTemperatureK,
    apparatusKind: "HOT_PLATE" as const,
    scientificStatus: "APPROXIMATED" as const,
  };
}

function cooler(id: string, targetTemperatureK: number, bodyId = "vessel") {
  return {
    id,
    bodyId,
    enabled: true,
    mode: "COOLER" as const,
    powerW: 1e9,
    targetTemperatureK,
    apparatusKind: "COOLING_BATH" as const,
    scientificStatus: "APPROXIMATED" as const,
  };
}

function contact(id: string, a: string, b: string, conductanceWPerK = 10) {
  return {
    id,
    bodyAId: a,
    bodyBId: b,
    enabled: true,
    conductanceWPerK,
    mechanism: "CONTACT" as const,
    scientificStatus: "APPROXIMATED" as const,
  };
}

describe("06D Phase 4A-3 post-fix independent revalidation", () => {
  it.each([2, 3, 5])("DEF-01: %i identical heaters do not count-scale overshoot", (count) => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      actuators: Array.from({ length: count }, (_, i) => heater(`h${i}`, 400)),
      dtS: 1000,
    });
    expect(temp(result)).toBeCloseTo(400, 12);
    expect(result.externalEnergyJ).toBeCloseTo(10_000, 8);
    expect(Number.isFinite(temp(result))).toBe(true);
  });

  it.each([2, 3, 5])("DEF-01: %i identical coolers do not target-undershoot", (count) => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 400)],
      actuators: Array.from({ length: count }, (_, i) => cooler(`c${i}`, 300)),
      dtS: 1000,
    });
    expect(temp(result)).toBeCloseTo(300, 12);
    expect(result.externalEnergyJ).toBeCloseTo(-10_000, 8);
    expect(temp(result)).toBeGreaterThan(0);
  });

  it("DEF-01: mixed targets are order invariant and no first-actuator-wins", () => {
    const actuators = [heater("h350", 350), heater("h400", 400)];
    const a = evaluateThermalApparatusStep({ bodies: [body("vessel", 300)], actuators, dtS: 1000 });
    const b = evaluateThermalApparatusStep({ bodies: [body("vessel", 300)], actuators: [...actuators].reverse(), dtS: 1000 });
    expect(b).toEqual(a);
    expect(temp(a)).toBeCloseTo(400, 12);
    const energies = new Map(a.transfers.map((entry) => [entry.id, entry.energyJ]));
    expect(energies.get("h350")!).toBeLessThanOrEqual(5_000 + 1e-9);
    expect(energies.get("h400")!).toBeLessThanOrEqual(10_000 + 1e-9);
  });

  it("DEF-02: exothermic reaction is preserved even when final T crosses heater target", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      actuators: [heater("heater", 310)],
      reactionSources: [{ id: "rxn", bodyId: "vessel", energyJ: 50_000, scientificStatus: "VERIFIED" }],
      dtS: 1000,
    });
    expect(result.reactionEnergyJ).toBe(50_000);
    expect(result.transfers.find((entry) => entry.id === "heater")!.energyJ).toBeCloseTo(1_000, 8);
    expect(temp(result)).toBeGreaterThan(310);
    expect(result.bodyUpdates[0]!.netEnergy_J).toBeCloseTo(result.externalEnergyJ + result.reactionEnergyJ, 8);
  });

  it("DEF-02: endothermic reaction is preserved independently of cooler target", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      actuators: [cooler("cooler", 290)],
      reactionSources: [{ id: "rxn", bodyId: "vessel", energyJ: -500, scientificStatus: "VERIFIED" }],
      dtS: 1000,
    });
    expect(result.reactionEnergyJ).toBe(-500);
    expect(result.transfers.find((entry) => entry.id === "cooler")!.energyJ).toBeCloseTo(1_000, 8);
    expect(temp(result)).toBeCloseTo(285, 10);
  });

  it("DEF-02: hotter reservoir may push final temperature above heater target", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      actuators: [heater("heater", 310)],
      reservoirs: [{ id: "hot", bodyId: "vessel", enabled: true, reservoirTemperatureK: 400, conductanceWPerK: 10, mechanism: "AMBIENT", scientificStatus: "APPROXIMATED" }],
      dtS: 10,
    });
    expect(result.transfers.find((entry) => entry.id === "heater")!.energyJ).toBeCloseTo(1_000, 8);
    expect(temp(result)).toBeGreaterThan(310);
  });

  it("DEF-03: duplicate body ids reject deterministically", () => {
    expect(() => evaluateThermalApparatusStep({ bodies: [body("x", 300), body("x", 310)], dtS: 1 }))
      .toThrow(/Duplicate thermal body id: x/);
  });

  it("DEF-03: duplicate contact ids reject deterministically", () => {
    expect(() => evaluateThermalApparatusStep({
      bodies: [body("a", 350), body("b", 300)],
      contacts: [contact("x", "a", "b"), contact("x", "a", "b", 20)],
      dtS: 1,
    })).toThrow(/Duplicate thermal contact id: x/);
  });

  it("DEF-03: duplicate reservoir ids reject deterministically", () => {
    expect(() => evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      reservoirs: [
        { id: "x", bodyId: "vessel", enabled: true, reservoirTemperatureK: 350, conductanceWPerK: 1, mechanism: "AMBIENT", scientificStatus: "APPROXIMATED" },
        { id: "x", bodyId: "vessel", enabled: true, reservoirTemperatureK: 250, conductanceWPerK: 1, mechanism: "AMBIENT", scientificStatus: "APPROXIMATED" },
      ],
      dtS: 1,
    })).toThrow(/Duplicate thermal reservoir id: x/);
  });

  it("DEF-03: duplicate actuator ids reject deterministically", () => {
    expect(() => evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      actuators: [heater("x", 350), heater("x", 400)],
      dtS: 1,
    })).toThrow(/Duplicate thermal actuator id: x/);
  });

  it("DEF-03: duplicate reaction-source ids reject deterministically", () => {
    expect(() => evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      reactionSources: [
        { id: "x", bodyId: "vessel", energyJ: 10, scientificStatus: "VERIFIED" },
        { id: "x", bodyId: "vessel", energyJ: 20, scientificStatus: "VERIFIED" },
      ],
      dtS: 1,
    })).toThrow(/Duplicate thermal reaction source id: x/);
  });

  it("DEF-03: cross-type same id is allowed by type-scoped namespace", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("a", 350), body("b", 300)],
      contacts: [contact("X", "a", "b")],
      actuators: [heater("X", 360, "a")],
      dtS: 1,
    });
    expect(result.bodyUpdates).toHaveLength(2);
    expect(result.transfers.filter((entry) => entry.id === "X")).toHaveLength(2);
  });

  it("atomic failure: invalid thermal state prevents any partial evaluation", () => {
    const invalid = {
      ...body("bad", 300),
      state: { ...body("bad", 300).state, temperatureK: 0 },
    } as ThermalBody;
    expect(() => evaluateThermalApparatusStep({
      bodies: [body("good", 300), invalid],
      actuators: [heater("h", 350, "good")],
      dtS: 1,
    })).toThrow();
  });

  it("closed-system two-body energy is equal-and-opposite", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("hot", 350, 100), body("cold", 300, 200)],
      contacts: [contact("hc", "hot", "cold", 20)],
      dtS: 10,
    });
    expect(result.externalEnergyJ).toBe(0);
    expect(result.reactionEnergyJ).toBe(0);
    expect(result.bodyUpdates.reduce((sum, u) => sum + u.netEnergy_J, 0)).toBeCloseTo(0, 10);
  });

  it("external heater/cooler sign accounting closes", () => {
    const heated = evaluateThermalApparatusStep({ bodies: [body("vessel", 300)], actuators: [heater("h", 310)], dtS: 1000 });
    expect(heated.bodyUpdates[0]!.netEnergy_J).toBeCloseTo(heated.externalEnergyJ, 10);
    const cooled = evaluateThermalApparatusStep({ bodies: [body("vessel", 300)], actuators: [cooler("c", 290)], dtS: 1000 });
    expect(cooled.bodyUpdates[0]!.netEnergy_J).toBeCloseTo(cooled.externalEnergyJ, 10);
    expect(cooled.externalEnergyJ).toBeLessThan(0);
  });

  it("reaction-only accounting closes exactly", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("vessel", 300)],
      reactionSources: [{ id: "rxn", bodyId: "vessel", energyJ: 1234, scientificStatus: "VERIFIED" }],
      dtS: 1,
    });
    expect(result.externalEnergyJ).toBe(0);
    expect(result.reactionEnergyJ).toBe(1234);
    expect(result.bodyUpdates[0]!.netEnergy_J).toBe(1234);
  });

  it("ABSOLUTE: huge-dt multi-contact passive network must not reverse a direct hot-warm ordering", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [body("hot", 400, 100), body("warm", 390, 100), body("cold", 200, 100)],
      contacts: [
        contact("hot-warm", "hot", "warm", 1e200),
        contact("hot-cold", "hot", "cold", 1e200),
      ],
      dtS: 1e200,
    });
    const hot = temp(result, "hot");
    const warm = temp(result, "warm");
    const cold = temp(result, "cold");
    expect([hot, warm, cold].every(Number.isFinite)).toBe(true);
    expect(Math.min(hot, warm, cold)).toBeGreaterThan(0);
    expect(hot).toBeGreaterThanOrEqual(warm);
    expect(warm).toBeGreaterThanOrEqual(cold);
    expect(result.bodyUpdates.reduce((sum, u) => sum + u.netEnergy_J, 0)).toBeCloseTo(0, 8);
  });

  it("deterministic replay and actuator permutation are exact", () => {
    const input = {
      bodies: [body("vessel", 300)],
      actuators: [heater("h2", 400), heater("h1", 350), heater("h3", 375)],
      reactionSources: [{ id: "rxn", bodyId: "vessel", energyJ: 100, scientificStatus: "VERIFIED" as const }],
      dtS: 1000,
    };
    const a = evaluateThermalApparatusStep(input);
    const b = evaluateThermalApparatusStep(input);
    const c = evaluateThermalApparatusStep({ ...input, actuators: [...input.actuators].reverse() });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it("fixed-seed randomized actuator/reaction cases are finite, deterministic and close ledgers", () => {
    let seed = 0x6d4a3;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    for (let caseIndex = 0; caseIndex < 100; caseIndex += 1) {
      const startT = 280 + random() * 40;
      const target1 = startT + 5 + random() * 30;
      const target2 = startT + 5 + random() * 30;
      const reactionJ = (random() - 0.5) * 500;
      const input = {
        bodies: [body("vessel", startT, 100 + random() * 100)],
        actuators: [heater("a", target1), heater("b", target2)],
        reactionSources: [{ id: "rxn", bodyId: "vessel", energyJ: reactionJ, scientificStatus: "VERIFIED" as const }],
        dtS: 100,
      };
      const first = evaluateThermalApparatusStep(input);
      const second = evaluateThermalApparatusStep(input);
      expect(second).toEqual(first);
      expect(Number.isFinite(temp(first))).toBe(true);
      expect(temp(first)).toBeGreaterThan(0);
      const sumDelta = first.bodyUpdates.reduce((sum, u) => sum + u.netEnergy_J, 0);
      expect(sumDelta).toBeCloseTo(first.externalEnergyJ + first.reactionEnergyJ, 8);
      expect(evaluateThermalApparatusStep({ ...input, actuators: [...input.actuators].reverse() })).toEqual(first);
    }
  });

  it("long-run passive two-body system converges without measurable energy drift", () => {
    let bodies = [body("a", 350, 100), body("b", 300, 200)];
    const contacts = [contact("ab", "a", "b", 5)];
    const initialEnergyProxy = bodies.reduce((sum, x) => sum + x.state.temperatureK * (x.state.mixtureHeatCapacity_JPerK + x.state.vesselHeatCapacity_JPerK), 0);
    for (let i = 0; i < 2000; i += 1) {
      const result = evaluateThermalApparatusStep({ bodies, contacts, dtS: 0.1 });
      const states = new Map(result.bodyUpdates.map((u) => [u.bodyId, u.state]));
      bodies = bodies.map((x) => ({ ...x, state: states.get(x.id)! }));
    }
    const finalEnergyProxy = bodies.reduce((sum, x) => sum + x.state.temperatureK * (x.state.mixtureHeatCapacity_JPerK + x.state.vesselHeatCapacity_JPerK), 0);
    expect(finalEnergyProxy).toBeCloseTo(initialEnergyProxy, 8);
    expect(Math.abs(bodies[0]!.state.temperatureK - bodies[1]!.state.temperatureK)).toBeLessThan(0.01);
  });
});
