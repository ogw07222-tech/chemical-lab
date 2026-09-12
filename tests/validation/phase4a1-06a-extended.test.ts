import { describe, expect, it } from "vitest";
import {
  aggregateSystemMatterInventory,
  createMatterCompartment,
  transferMatter,
  type MatterConnectionState,
  type MatterSystemState,
} from "../../src/simulation/compartment";
import {
  createMoleculeRecord,
  type ElementDefinition,
  type ElementProvider,
  type SpeciesState,
} from "../../src/simulation/molecular";

const H: ElementDefinition = {
  atomicNumber: 1,
  symbol: "H",
  atomicMolarMassKgPerMol: 0.001,
  valenceElectrons: 1,
  commonOxidationStates: [-1, 1],
  electronegativity: 2.2,
  typicalValences: [1],
};
const elements: ElementProvider = {
  getElement(symbol) {
    return symbol === "H" ? H : undefined;
  },
};
const h2 = createMoleculeRecord({
  atoms: [
    { id: "h1", element: "H", formalCharge: 0 },
    { id: "h2", element: "H", formalCharge: 0 },
  ],
  bonds: [{ id: "hh", a: "h1", b: "h2", kind: "covalent", order: 1 }],
}, elements);
const phase = {
  phase: "gas" as const,
  source: "06a-extended-validation",
  phaseStateId: "gas:06a-extended",
  scientificStatus: "APPROXIMATED" as const,
};

function sp(amountMol: number): SpeciesState {
  return { id: "H2", amountMol, molecule: h2, phaseState: phase };
}
function compartment(id: string, amountMol = 0) {
  return createMatterCompartment({
    id,
    kind: "OTHER",
    species: amountMol > 0 ? [sp(amountMol)] : [],
  });
}
function total(system: MatterSystemState): number {
  return aggregateSystemMatterInventory(system).speciesAmountsMol.H2 ?? 0;
}

describe("06A Phase 4A-1 extended validation", () => {
  it("rejects a runtime-invalid connection kind instead of committing", () => {
    const invalidConnection = {
      id: "A-B",
      sourceCompartmentId: "A",
      destinationCompartmentId: "B",
      kind: "SOLID",
      enabled: true,
    } as unknown as MatterConnectionState;
    const before: MatterSystemState = {
      compartments: [compartment("A", 1), compartment("B")],
      connections: [invalidConnection],
    };
    const result = transferMatter(before, {
      sourceCompartmentId: "A",
      destinationCompartmentId: "B",
      connectionId: "A-B",
      species: [{ speciesId: "H2", amountMol: 0.1 }],
    });
    expect(result.status).toBe("REJECTED");
    expect(result.state).toBe(before);
  });

  it("remains conservative and non-negative through a long A-B-C-A transfer sequence", () => {
    let state: MatterSystemState = {
      compartments: [compartment("A", 1), compartment("B"), compartment("C")],
    };
    const initialTotal = total(state);
    for (let cycle = 0; cycle < 500; cycle += 1) {
      for (const [sourceCompartmentId, destinationCompartmentId] of [["A", "B"], ["B", "C"], ["C", "A"]] as const) {
        const result = transferMatter(state, {
          sourceCompartmentId,
          destinationCompartmentId,
          species: [{ speciesId: "H2", amountMol: 0.001 }],
        });
        expect(result.status).toBe("COMMITTED");
        if (result.status !== "COMMITTED") return;
        state = result.state;
        for (const c of state.compartments) {
          for (const s of c.species) {
            expect(Number.isFinite(s.amountMol)).toBe(true);
            expect(s.amountMol).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
    expect(Math.abs(total(state) - initialTotal)).toBeLessThanOrEqual(1e-12);
  });

  it("passes deterministic seeded randomized valid transfers without conservation drift", () => {
    function run(seed: number) {
      let x = seed >>> 0;
      const random = () => {
        x = (Math.imul(1664525, x) + 1013904223) >>> 0;
        return x / 0x1_0000_0000;
      };
      let state: MatterSystemState = {
        compartments: [compartment("A", 2), compartment("B", 1), compartment("C", 1)],
      };
      const initialTotal = total(state);
      const ids = ["A", "B", "C"] as const;
      for (let i = 0; i < 300; i += 1) {
        const sourceIndex = Math.floor(random() * ids.length);
        let destinationIndex = Math.floor(random() * (ids.length - 1));
        if (destinationIndex >= sourceIndex) destinationIndex += 1;
        const source = ids[sourceIndex]!;
        const destination = ids[destinationIndex]!;
        const available = state.compartments.find((c) => c.id === source)?.species.find((s) => s.id === "H2")?.amountMol ?? 0;
        if (available <= 0) continue;
        const amountMol = Math.min(available, 0.0001 + random() * 0.01);
        const result = transferMatter(state, {
          sourceCompartmentId: source,
          destinationCompartmentId: destination,
          species: [{ speciesId: "H2", amountMol }],
        });
        expect(result.status).toBe("COMMITTED");
        if (result.status !== "COMMITTED") return state;
        state = result.state;
        expect(Math.abs(total(state) - initialTotal)).toBeLessThanOrEqual(1e-12);
      }
      return state;
    }

    const first = run(0x06a4a1);
    const second = run(0x06a4a1);
    expect(second).toEqual(first);
  });
});
