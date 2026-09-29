import { describe, expect, it } from "vitest";
import {
  MAX_VESSEL_TOTAL_AMOUNT_MOL,
  createInitialProgressionState,
  validateAddUnlockedMaterial,
} from "../../src/game/progression";
import {
  MAX_PARTICLES_PER_VESSEL,
  MAX_VISUALIZED_AMOUNT_MOL,
  MOLES_PER_VISUAL_PARTICLE,
  buildMatterVisualModel,
  visualParticleCount,
} from "../../src/ui/chemistry/matter/model";
import type { VesselContentView } from "../../src/ui/types";

const progression = createInitialProgressionState({
  id: "validation-starter",
  schemaVersion: 1,
  speciesKeys: ["A", "B"],
});

function add(amountMol: number, currentVesselTotalAmountMol: number, developerModeEnabled = false) {
  return validateAddUnlockedMaterial(
    progression,
    {
      kind: "AddUnlockedMaterial",
      commandId: `add-${amountMol}-${currentVesselTotalAmountMol}`,
      vesselId: "vessel-validation",
      speciesKey: "A",
      amountMol,
    },
    { currentVesselTotalAmountMol, developerModeEnabled },
  );
}

function content(key: string, amountMol: number, phase: VesselContentView["phase"] = "liquid"): VesselContentView {
  return {
    speciesId: key,
    visualizationKey: `known:${key}`,
    displayIdentity: key,
    amountMol,
    phase,
    identityConfirmed: true,
  };
}

describe("06 independent validation — 20 mol vessel cap", () => {
  it("accepts the exact 20 mol boundary and rejects the smallest meaningful overflow", () => {
    expect(MAX_VESSEL_TOTAL_AMOUNT_MOL).toBe(20);
    expect(add(0.01, 19.99).ok).toBe(true);
    expect(add(0.010001, 19.99)).toEqual({ ok: false, error: "VESSEL_AMOUNT_LIMIT_EXCEEDED" });
  });

  it("does not allow developer mode to bypass the 20 mol vessel ceiling", () => {
    expect(add(0.02, 19.99, true)).toEqual({ ok: false, error: "VESSEL_AMOUNT_LIMIT_EXCEEDED" });
  });

  it("rejects invalid authoritative vessel-total context", () => {
    for (const current of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -0.01]) {
      expect(add(0.01, current)).toEqual({ ok: false, error: "VESSEL_AMOUNT_CONTEXT_REQUIRED" });
    }
  });
});

describe("06 independent validation — linear mol-to-dot mapping", () => {
  it("maps exact hundredth-mol boundaries linearly across the full range", () => {
    expect(MOLES_PER_VISUAL_PARTICLE).toBe(0.01);
    expect(MAX_VISUALIZED_AMOUNT_MOL).toBe(20);
    expect(MAX_PARTICLES_PER_VESSEL).toBe(2000);

    const cases: Array<[number, number]> = [
      [0.01, 1],
      [0.02, 2],
      [0.1, 10],
      [0.25, 25],
      [1, 100],
      [10, 1000],
      [19.99, 1999],
      [20, 2000],
    ];
    for (const [mol, dots] of cases) {
      expect(visualParticleCount(mol), `${mol} mol`).toBe(dots);
    }
  });

  it("preserves linear mixture totals up to 20 mol", () => {
    const model = buildMatterVisualModel("mixture", [
      content("A", 7.25),
      content("B", 12.75),
    ]);
    expect(model.totalParticles).toBe(2000);

    const bySpecies = new Map<string, number>();
    for (const particle of model.regions.flatMap((region) => region.particles)) {
      bySpecies.set(particle.visualKey, (bySpecies.get(particle.visualKey) ?? 0) + 1);
    }
    expect(bySpecies.get("known:A")).toBe(725);
    expect(bySpecies.get("known:B")).toBe(1275);
  });

  it("never renders above the 2000-dot canvas cap", () => {
    const model = buildMatterVisualModel("overflow-provider-state", [
      content("A", 20),
      content("B", 20),
    ]);
    expect(model.totalParticles).toBe(2000);
  });
});
