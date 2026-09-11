import { describe, expect, it } from "vitest";
import {
  PROGRESSION_SCHEMA_VERSION,
  UnsupportedProgressionSaveVersionError,
  createInitialProgressionState,
  deserializeProgressionState,
  handleIdentityEvent,
  isSpeciesAccessible,
  serializeProgressionState,
  validateAddUnlockedMaterial,
  type IdentityConfirmedEvent,
  type StarterMaterialSet,
} from "../../src/game/progression";

const starterSet: StarterMaterialSet = {
  id: "starter-v1",
  schemaVersion: 1,
  speciesKeys: ["H2", "O2"],
};

function confirmed(
  speciesKey: string,
  experimentId = "exp-1",
  eventId = `confirm-${speciesKey}`,
): IdentityConfirmedEvent {
  return {
    kind: "IdentityConfirmed",
    eventId,
    speciesKey,
    experimentId,
    simulationTimeS: 12,
    confirmationMethod: "instrument-analysis",
    analysisResultId: `analysis-${speciesKey}`,
    authoritative: true,
  };
}

describe("progression runtime", () => {
  it("makes starter species accessible and locked species unavailable", () => {
    const state = createInitialProgressionState(starterSet);
    expect(isSpeciesAccessible(state, "H2")).toBe(true);
    expect(isSpeciesAccessible(state, "CO2")).toBe(false);
  });

  it("does not unlock hidden or unconfirmed species", () => {
    const state = createInitialProgressionState(starterSet);
    const result = handleIdentityEvent(state, {
      kind: "IdentityUnconfirmed",
      eventId: "hidden-1",
      experimentId: "exp-1",
      simulationTimeS: 5,
      authoritative: false,
    });
    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(isSpeciesAccessible(result.state, "H2O")).toBe(false);
  });

  it("atomically unlocks discovery, encyclopedia and inventory on first confirmation", () => {
    const state = createInitialProgressionState(starterSet);
    const result = handleIdentityEvent(state, confirmed("H2O"));

    expect(result.firstDiscoveryEvent?.speciesKey).toBe("H2O");
    expect(result.state.discoveredSpecies.H2O?.speciesKey).toBe("H2O");
    expect(result.state.encyclopedia.H2O?.unlocked).toBe(true);
    expect(result.state.inventory.unlockedSpecies).toContain("H2O");
    expect(isSpeciesAccessible(result.state, "H2O")).toBe(true);
  });

  it("creates first discovery exactly once and protects duplicates", () => {
    const first = handleIdentityEvent(
      createInitialProgressionState(starterSet),
      confirmed("H2O", "exp-1", "event-1"),
    );
    const duplicate = handleIdentityEvent(
      first.state,
      confirmed("H2O", "exp-1", "event-2"),
    );

    expect(first.firstDiscoveryEvent).toBeDefined();
    expect(duplicate.firstDiscoveryEvent).toBeUndefined();
    expect(duplicate.changed).toBe(false);
    expect(duplicate.state.discoveryOrder).toEqual(["H2O"]);
    expect(duplicate.state.inventory.unlockedSpecies).toEqual(["H2O"]);
  });

  it("records later confirming experiments without duplicating first discovery", () => {
    const first = handleIdentityEvent(
      createInitialProgressionState(starterSet),
      confirmed("H2O", "exp-1", "event-1"),
    );
    const later = handleIdentityEvent(
      first.state,
      confirmed("H2O", "exp-2", "event-2"),
    );

    expect(later.firstDiscoveryEvent).toBeUndefined();
    expect(later.changed).toBe(true);
    expect(later.state.encyclopedia.H2O?.relatedExperimentIds).toEqual([
      "exp-1",
      "exp-2",
    ]);
    expect(later.state.discoveryOrder).toEqual(["H2O"]);
  });

  it("allows unlimited reuse without stock depletion", () => {
    const unlocked = handleIdentityEvent(
      createInitialProgressionState(starterSet),
      confirmed("H2O"),
    ).state;

    for (let i = 0; i < 100; i += 1) {
      const result = validateAddUnlockedMaterial(unlocked, {
        kind: "AddUnlockedMaterial",
        commandId: `add-${i}`,
        vesselId: "vessel-1",
        speciesKey: "H2O",
        amountMol: 0.01,
      });
      expect(result.ok).toBe(true);
    }

    expect(unlocked.inventory.unlockedSpecies).toEqual(["H2O"]);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects invalid finite-add amount %s",
    (amountMol) => {
      const state = createInitialProgressionState(starterSet);
      const result = validateAddUnlockedMaterial(state, {
        kind: "AddUnlockedMaterial",
        commandId: "bad-add",
        vesselId: "vessel-1",
        speciesKey: "H2",
        amountMol,
      });
      expect(result).toEqual({ ok: false, error: "INVALID_AMOUNT" });
    },
  );

  it("preserves the exact finite amount in a Simulation-bound request", () => {
    const state = createInitialProgressionState(starterSet);
    const result = validateAddUnlockedMaterial(state, {
      kind: "AddUnlockedMaterial",
      commandId: "add-1",
      vesselId: "vessel-1",
      speciesKey: "H2",
      amountMol: 0.25,
    });
    expect(result).toEqual({
      ok: true,
      request: {
        kind: "AddMaterial",
        commandId: "add-1",
        vesselId: "vessel-1",
        speciesKey: "H2",
        amountMol: 0.25,
        source: "starter",
      },
    });
  });

  it("developer mode bypasses access but does not mutate progression state", () => {
    const state = createInitialProgressionState(starterSet);
    const before = serializeProgressionState(state);
    const result = validateAddUnlockedMaterial(
      state,
      {
        kind: "AddUnlockedMaterial",
        commandId: "dev-add",
        vesselId: "vessel-1",
        speciesKey: "LOCKED_TEST_SPECIES",
        amountMol: 1,
      },
      { developerModeEnabled: true },
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.request.source).toBe("developer");
    expect(serializeProgressionState(state)).toBe(before);
    expect(isSpeciesAccessible(state, "LOCKED_TEST_SPECIES")).toBe(false);
  });

  it("premium cannot bypass discovery or unlock requirements", () => {
    const state = createInitialProgressionState(starterSet);
    expect(isSpeciesAccessible(state, "CO2", { premium: true })).toBe(false);
    expect(
      validateAddUnlockedMaterial(
        state,
        {
          kind: "AddUnlockedMaterial",
          commandId: "premium-add",
          vesselId: "vessel-1",
          speciesKey: "CO2",
          amountMol: 1,
        },
        { premium: true },
      ),
    ).toEqual({ ok: false, error: "LOCKED_SPECIES" });
  });

  it("serializes and deserializes deterministically", () => {
    let state = createInitialProgressionState({
      ...starterSet,
      speciesKeys: ["O2", "H2", "O2"],
    });
    state = handleIdentityEvent(state, confirmed("H2O", "exp-2")).state;
    state = handleIdentityEvent(state, confirmed("CO2", "exp-1")).state;

    const serialized = serializeProgressionState(state);
    const restored = deserializeProgressionState(serialized);
    expect(serializeProgressionState(restored)).toBe(serialized);
    expect(restored).toEqual(state);
  });

  it("rejects old or unknown save versions explicitly", () => {
    const oldSave = JSON.stringify({ schemaVersion: 0 });
    expect(() => deserializeProgressionState(oldSave)).toThrow(
      UnsupportedProgressionSaveVersionError,
    );
    expect(PROGRESSION_SCHEMA_VERSION).toBe(1);
  });
});
