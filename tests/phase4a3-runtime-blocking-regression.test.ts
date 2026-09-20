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
    source: "phase4a3-runtime-blocking-regression",
  };
}

describe("Phase 4A-3 runtime-blocking passive-contact regression", () => {
  it("does not reverse a snapshot hot-to-warm edge under simultaneous huge-dt contacts", () => {
    const result = evaluateThermalApparatusStep({
      bodies: [
        body("vessel", 400),
        body("warm", 390),
        body("cold", 200),
      ],
      contacts: [
        {
          id: "hot-warm",
          bodyAId: "vessel",
          bodyBId: "warm",
          enabled: true,
          conductanceWPerK: 1e200,
          mechanism: "CONTACT",
          scientificStatus: "APPROXIMATED",
        },
        {
          id: "hot-cold",
          bodyAId: "vessel",
          bodyBId: "cold",
          enabled: true,
          conductanceWPerK: 1e200,
          mechanism: "CONTACT",
          scientificStatus: "APPROXIMATED",
        },
      ],
      dtS: 1e200,
    });

    expect(result.scientificStatus).not.toBe("OPEN");
    const temps = new Map(
      result.bodyUpdates.map((update) => [update.bodyId, update.temperatureK] as const),
    );

    expect(temps.get("vessel")).toBeGreaterThanOrEqual(temps.get("warm")!);
    expect(temps.get("warm")).toBeGreaterThanOrEqual(temps.get("cold")!);
    expect(
      result.bodyUpdates.reduce((sum, update) => sum + update.internalTransferEnergy_J, 0),
    ).toBeCloseTo(0, 10);
  });
});
