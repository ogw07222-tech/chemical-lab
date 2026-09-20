import { describe, expect, it } from "vitest";
import {
  createThermalState,
  evaluateThermalApparatusStep,
  type ThermalApparatusEvaluation,
  type ThermalBody,
  type ThermalContact,
} from "../../src/simulation/thermal";

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
    source: "06-independent-phase4a3-runtime-blocking",
  };
}

function contact(id: string, a: string, b: string, g = 1e6): ThermalContact {
  return {
    id,
    bodyAId: a,
    bodyBId: b,
    enabled: true,
    conductanceWPerK: g,
    mechanism: "CONTACT",
    scientificStatus: "APPROXIMATED",
  };
}

function update(result: ThermalApparatusEvaluation, id: string) {
  const value = result.bodyUpdates.find((entry) => entry.bodyId === id);
  if (!value) throw new Error(`missing update for ${id}`);
  return value;
}

function sensibleEnergy(bodies: readonly ThermalBody[]): number {
  return bodies.reduce(
    (sum, entry) =>
      sum +
      entry.state.temperatureK *
        (entry.state.mixtureHeatCapacity_JPerK + entry.state.vesselHeatCapacity_JPerK),
    0,
  );
}

function updatedBodies(previous: readonly ThermalBody[], result: ThermalApparatusEvaluation): ThermalBody[] {
  const states = new Map(result.bodyUpdates.map((entry) => [entry.bodyId, entry.state]));
  return previous.map((entry) => ({ ...entry, state: states.get(entry.id) ?? entry.state }));
}

function assertEnergyClosed(
  beforeBodies: readonly ThermalBody[],
  result: ThermalApparatusEvaluation,
) {
  const afterBodies = updatedBodies(beforeBodies, result);
  const before = sensibleEnergy(beforeBodies);
  const after = sensibleEnergy(afterBodies);
  // Tight numerical closure: absolute 1e-9 J floor plus 1e-12 relative scale.
  const tolerance = Math.max(1e-9, Math.abs(before) * 1e-12);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(tolerance);
  expect(
    Math.abs(result.bodyUpdates.reduce((sum, entry) => sum + entry.internalTransferEnergy_J, 0)),
  ).toBeLessThanOrEqual(tolerance);
  expect(result.externalEnergyJ).toBe(0);
  expect(result.reactionEnergyJ).toBe(0);
}

function assertSnapshotEdgesDoNotCross(
  beforeBodies: readonly ThermalBody[],
  contacts: readonly ThermalContact[],
  result: ThermalApparatusEvaluation,
) {
  const initial = new Map(beforeBodies.map((entry) => [entry.id, entry.state.temperatureK]));
  const final = new Map(result.bodyUpdates.map((entry) => [entry.bodyId, entry.temperatureK]));
  for (const edge of contacts) {
    if (!edge.enabled) continue;
    const a0 = initial.get(edge.bodyAId)!;
    const b0 = initial.get(edge.bodyBId)!;
    if (a0 === b0) continue;
    const hotId = a0 > b0 ? edge.bodyAId : edge.bodyBId;
    const coldId = a0 > b0 ? edge.bodyBId : edge.bodyAId;
    const hotFinal = final.get(hotId)!;
    const coldFinal = final.get(coldId)!;
    // Existing project numerical philosophy uses 1e-12 engineering tolerances.
    // Add an IEEE-754 scale term so equality at the analytic boundary is not
    // misclassified solely by a few ulps of final division/addition rounding.
    const roundingToleranceK = Math.max(
      1e-12,
      16 * Number.EPSILON * Math.max(1, Math.abs(hotFinal), Math.abs(coldFinal)),
    );
    expect(hotFinal + roundingToleranceK).toBeGreaterThanOrEqual(coldFinal);
  }
}

function assertClosedGraph(
  bodies: readonly ThermalBody[],
  contacts: readonly ThermalContact[],
  dtS: number,
) {
  const first = evaluateThermalApparatusStep({ bodies, contacts, dtS });
  expect(first.scientificStatus).not.toBe("OPEN");
  for (const entry of first.bodyUpdates) {
    expect(Number.isFinite(entry.temperatureK)).toBe(true);
    expect(entry.temperatureK).toBeGreaterThan(0);
  }
  assertEnergyClosed(bodies, first);
  assertSnapshotEdgesDoNotCross(bodies, contacts, first);

  const reversed = evaluateThermalApparatusStep({
    bodies: [...bodies].reverse(),
    contacts: [...contacts].reverse(),
    dtS,
  });
  expect(reversed).toEqual(first);
  return first;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += 1) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) result.push([items[i]!, ...tail]);
  }
  return result;
}

describe("06 independent Phase 4A-3 runtime-blocking defect validation", () => {
  it("closes the original 400/390/200 simultaneous-contact defect", () => {
    const bodies = [body("A", 400), body("B", 390), body("C", 200)];
    const contacts = [contact("A-B", "A", "B", 1e200), contact("A-C", "A", "C", 1e200)];
    const result = assertClosedGraph(bodies, contacts, 1e200);
    expect(update(result, "A").temperatureK).toBeGreaterThanOrEqual(update(result, "B").temperatureK);
    expect(update(result, "B").temperatureK).toBeGreaterThanOrEqual(update(result, "C").temperatureK);
  });

  it("is exactly invariant over all 3-body and 2-contact order permutations", () => {
    const bodies = [body("A", 400), body("B", 390), body("C", 200)];
    const contacts = [contact("A-B", "A", "B", 1e200), contact("A-C", "A", "C", 1e200)];
    const baseline = evaluateThermalApparatusStep({ bodies, contacts, dtS: 1e200 });
    for (const bp of permutations(bodies)) {
      for (const cp of permutations(contacts)) {
        expect(evaluateThermalApparatusStep({ bodies: bp, contacts: cp, dtS: 1e200 })).toEqual(
          baseline,
        );
      }
    }
  });

  it("validates chain topology", () => {
    assertClosedGraph(
      [body("A", 500, 100), body("B", 350, 1000), body("C", 200, 10)],
      [contact("A-B", "A", "B"), contact("B-C", "B", "C")],
      1e6,
    );
  });

  it("validates star topology with a shared center", () => {
    assertClosedGraph(
      [body("A", 500, 100), body("B", 350, 10), body("C", 280, 1000), body("D", 220, 100)],
      [contact("B-A", "B", "A"), contact("B-C", "B", "C"), contact("B-D", "B", "D")],
      1e6,
    );
  });

  it("validates a branching graph", () => {
    assertClosedGraph(
      [
        body("A", 520, 50),
        body("B", 410, 500),
        body("C", 330, 5),
        body("D", 260, 1000),
        body("E", 180, 80),
      ],
      [
        contact("A-B", "A", "B"),
        contact("B-C", "B", "C"),
        contact("B-D", "B", "D"),
        contact("D-E", "D", "E"),
      ],
      1e6,
    );
  });

  it("bounds a hot shared node with multiple cooler neighbors", () => {
    assertClosedGraph(
      [body("H", 700, 1), body("C1", 400, 10), body("C2", 300, 100), body("C3", 200, 1000)],
      [contact("H-C1", "H", "C1"), contact("H-C2", "H", "C2"), contact("H-C3", "H", "C3")],
      1e12,
    );
  });

  it("bounds a cold shared node with multiple hotter neighbors", () => {
    assertClosedGraph(
      [body("C", 100, 1), body("H1", 300, 10), body("H2", 500, 100), body("H3", 800, 1000)],
      [contact("C-H1", "C", "H1"), contact("C-H2", "C", "H2"), contact("C-H3", "C", "H3")],
      1e12,
    );
  });

  it("bounds a mixed hotter/colder neighborhood around one central body", () => {
    assertClosedGraph(
      [body("M", 350, 100), body("H1", 600, 10), body("H2", 450, 1000), body("C1", 250, 1), body("C2", 150, 100)],
      [contact("M-H1", "M", "H1"), contact("M-H2", "M", "H2"), contact("M-C1", "M", "C1"), contact("M-C2", "M", "C2")],
      1e12,
    );
  });

  it.each([1e3, 1e6, 1e12])("remains finite, positive-K and non-crossing at huge dt=%s", (dtS) => {
    assertClosedGraph(
      [body("A", 900, 1), body("B", 500, 10), body("C", 250, 1000), body("D", 50, 100)],
      [contact("A-B", "A", "B", 1e9), contact("B-C", "B", "C", 1e9), contact("B-D", "B", "D", 1e9)],
      dtS,
    );
  });

  it.each([1, 10, 1000])("closes energy with heat-capacity ratio 1:%s", (ratio) => {
    assertClosedGraph(
      [body("hot", 600, 1), body("mid", 350, ratio), body("cold", 100, 1)],
      [contact("hot-mid", "hot", "mid"), contact("mid-cold", "mid", "cold")],
      1e12,
    );
  });

  it("keeps internal transfers out of external/reaction ledgers", () => {
    const bodies = [body("A", 500, 100), body("B", 300, 200), body("C", 200, 50)];
    const contacts = [contact("A-B", "A", "B"), contact("B-C", "B", "C")];
    const result = evaluateThermalApparatusStep({ bodies, contacts, dtS: 1000 });
    assertEnergyClosed(bodies, result);
    expect(result.externalEnergyJ).toBe(0);
    expect(result.reactionEnergyJ).toBe(0);
    expect(result.bodyUpdates.reduce((s, x) => s + x.internalTransferEnergy_J, 0)).toBeCloseTo(0, 10);
  });

  it("preserves signed reaction heat exactly once alongside internal contacts", () => {
    for (const energyJ of [250, -250]) {
      const bodies = [body("vessel", 350, 100), body("neighbor", 300, 100)];
      const result = evaluateThermalApparatusStep({
        bodies,
        contacts: [contact("v-n", "vessel", "neighbor", 10)],
        reactionSources: [{
          id: `rxn-${energyJ}`,
          bodyId: "vessel",
          energyJ,
          scientificStatus: "VERIFIED",
          source: "06-independent",
        }],
        dtS: 1,
      });
      expect(result.scientificStatus).not.toBe("OPEN");
      expect(result.reactionEnergyJ).toBe(energyJ);
      expect(result.externalEnergyJ).toBe(0);
      expect(result.bodyUpdates.reduce((s, x) => s + x.netEnergy_J, 0)).toBeCloseTo(energyJ, 10);
      expect(result.bodyUpdates.reduce((s, x) => s + x.internalTransferEnergy_J, 0)).toBeCloseTo(0, 10);
    }
  });

  it("passes fixed-seed randomized connected graph properties", () => {
    let seed = 0x064a3001 >>> 0;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };

    for (let caseIndex = 0; caseIndex < 80; caseIndex += 1) {
      const n = 3 + Math.floor(random() * 6);
      const bodies: ThermalBody[] = [];
      for (let i = 0; i < n; i += 1) {
        const capacityChoices = [1, 10, 100, 1000];
        const capacity = capacityChoices[Math.floor(random() * capacityChoices.length)]!;
        bodies.push(body(`B${i}`, 50 + random() * 850 + i * 1e-7, capacity));
      }
      const contacts: ThermalContact[] = [];
      // Spanning chain guarantees connected topology.
      for (let i = 1; i < n; i += 1) {
        contacts.push(contact(`E${i - 1}-${i}`, `B${i - 1}`, `B${i}`, 0.01 + random() * 1e6));
      }
      // Deterministic extra branches.
      for (let i = 0; i < n; i += 1) {
        for (let j = i + 2; j < n; j += 1) {
          if (random() < 0.25) contacts.push(contact(`X${i}-${j}`, `B${i}`, `B${j}`, 0.01 + random() * 1e6));
        }
      }
      const dtChoices = [1e-6, 1, 1e3, 1e6, 1e12];
      const dtS = dtChoices[Math.floor(random() * dtChoices.length)]!;
      const result = assertClosedGraph(bodies, contacts, dtS);
      expect(evaluateThermalApparatusStep({ bodies, contacts, dtS })).toEqual(result);
    }
  });

  it("remains energy-stable and convergent over 1000 closed-system steps", () => {
    let bodies = [
      body("A", 700, 1),
      body("B", 500, 10),
      body("C", 300, 100),
      body("D", 100, 1000),
    ];
    const contacts = [
      contact("A-B", "A", "B", 2),
      contact("B-C", "B", "C", 3),
      contact("C-D", "C", "D", 5),
      contact("B-D", "B", "D", 1),
    ];
    const initialEnergy = sensibleEnergy(bodies);
    const initialRange = Math.max(...bodies.map((b) => b.state.temperatureK)) - Math.min(...bodies.map((b) => b.state.temperatureK));
    let previousRange = initialRange;

    for (let step = 0; step < 1000; step += 1) {
      const result = evaluateThermalApparatusStep({ bodies, contacts, dtS: 1 });
      expect(result.scientificStatus).not.toBe("OPEN");
      assertEnergyClosed(bodies, result);
      bodies = updatedBodies(bodies, result);
      const temps = bodies.map((b) => b.state.temperatureK);
      const range = Math.max(...temps) - Math.min(...temps);
      expect(range).toBeLessThanOrEqual(previousRange + 1e-12);
      previousRange = range;
      expect(Math.abs(sensibleEnergy(bodies) - initialEnergy)).toBeLessThanOrEqual(
        Math.max(1e-8, Math.abs(initialEnergy) * 1e-12),
      );
    }
    expect(previousRange).toBeLessThan(initialRange);
    for (const entry of bodies) {
      expect(Number.isFinite(entry.state.temperatureK)).toBe(true);
      expect(entry.state.temperatureK).toBeGreaterThan(0);
    }
  });
});
