import { describe, expect, it } from "vitest";
import {
  computeThermostatEnergyExchange,
  createThermalState,
  reactionHeatToSystem,
  stepThermalState,
} from "../src/simulation/thermal";

function baseState() {
  return createThermalState({
    temperatureK: 300,
    mixtureHeatCapacity_JPerK: 80,
    vesselHeatCapacity_JPerK: 20,
  });
}

describe("thermal executable primitives", () => {
  it("heater increases system energy and temperature", () => {
    const result = stepThermalState(baseState(), {
      dtS: 2,
      heater: { enabled: true, powerW: 50 },
    });

    expect(result.stepEnergyDelta_J).toBe(100);
    expect(result.state.cumulativeEnergy.heaterEnergy_J).toBe(100);
    expect(result.state.temperatureK).toBe(301);
  });

  it("cooler decreases system energy and temperature", () => {
    const result = stepThermalState(baseState(), {
      dtS: 2,
      cooler: { enabled: true, extractionPowerW: 50 },
    });

    expect(result.stepEnergyDelta_J).toBe(-100);
    expect(result.state.cumulativeEnergy.coolerEnergyRemoved_J).toBe(100);
    expect(result.state.temperatureK).toBe(299);
  });

  it("exothermic reaction adds thermal energy", () => {
    expect(
      reactionHeatToSystem({
        reactionExtentMol: 0.5,
        deltaH_JPerMolExtent: -2000,
      }),
    ).toBe(1000);

    const result = stepThermalState(baseState(), {
      dtS: 1,
      reactionHeat: {
        reactionExtentMol: 0.5,
        deltaH_JPerMolExtent: -2000,
      },
    });

    expect(result.state.cumulativeEnergy.reactionHeat_J).toBe(1000);
    expect(result.state.temperatureK).toBe(310);
  });

  it("endothermic reaction removes thermal energy", () => {
    const result = stepThermalState(baseState(), {
      dtS: 1,
      reactionHeat: {
        reactionExtentMol: 0.5,
        deltaH_JPerMolExtent: 2000,
      },
    });

    expect(result.stepEnergyDelta_J).toBe(-1000);
    expect(result.state.cumulativeEnergy.reactionHeat_J).toBe(-1000);
    expect(result.state.temperatureK).toBe(290);
  });

  it("thermostat exchanges explicit bounded energy", () => {
    const state = baseState();
    const thermostat = {
      enabled: true,
      targetTemperatureK: 310,
      maxHeatingPowerW: 20,
      maxCoolingPowerW: 20,
      proportionalGainWPerK: 10,
    } as const;

    expect(computeThermostatEnergyExchange(state, thermostat, 2)).toBe(40);

    const result = stepThermalState(state, { dtS: 2, thermostat });
    expect(result.state.cumulativeEnergy.thermostatEnergy_J).toBe(40);
    expect(result.state.temperatureK).toBe(300.4);
  });

  it("thermostat does not teleport temperature to target", () => {
    const result = stepThermalState(baseState(), {
      dtS: 1,
      thermostat: {
        enabled: true,
        targetTemperatureK: 350,
        maxHeatingPowerW: 10,
        maxCoolingPowerW: 10,
        proportionalGainWPerK: 100,
      },
    });

    expect(result.state.temperatureK).toBe(300.1);
    expect(result.state.temperatureK).not.toBe(350);
    expect(result.state.cumulativeEnergy.thermostatEnergy_J).toBe(10);
  });

  it("keeps energy-ledger sign conventions consistent", () => {
    const result = stepThermalState(baseState(), {
      dtS: 2,
      heater: { enabled: true, powerW: 10 },
      cooler: { enabled: true, extractionPowerW: 4 },
      reactionHeat: {
        reactionExtentMol: 1,
        deltaH_JPerMolExtent: -5,
      },
      environmentHeat_J: -3,
      otherExternalEnergy_J: 2,
    });

    expect(result.state.cumulativeEnergy).toMatchObject({
      reactionHeat_J: 5,
      heaterEnergy_J: 20,
      coolerEnergyRemoved_J: 8,
      environmentHeat_J: -3,
      otherExternalEnergy_J: 2,
    });
    expect(result.stepEnergyDelta_J).toBe(16);
  });

  it("accumulates reaction and heater/cooler ledger values across steps", () => {
    const first = stepThermalState(baseState(), {
      dtS: 1,
      heater: { enabled: true, powerW: 20 },
      reactionHeat: {
        reactionExtentMol: 0.1,
        deltaH_JPerMolExtent: -100,
      },
    });
    const second = stepThermalState(first.state, {
      dtS: 2,
      cooler: { enabled: true, extractionPowerW: 5 },
      reactionHeat: {
        reactionExtentMol: 0.1,
        deltaH_JPerMolExtent: 50,
      },
    });

    expect(second.state.cumulativeEnergy.heaterEnergy_J).toBe(20);
    expect(second.state.cumulativeEnergy.coolerEnergyRemoved_J).toBe(10);
    expect(second.state.cumulativeEnergy.reactionHeat_J).toBe(5);
  });

  it("is deterministic for identical state, timestep, and inputs", () => {
    const input = {
      dtS: 0.25,
      heater: { enabled: true, powerW: 12 },
      cooler: { enabled: true, extractionPowerW: 3 },
      reactionHeat: {
        reactionExtentMol: 0.01,
        deltaH_JPerMolExtent: -250,
      },
    } as const;

    expect(stepThermalState(baseState(), input)).toEqual(
      stepThermalState(baseState(), input),
    );
  });

  it("rejects temperatures at or below absolute zero", () => {
    expect(() =>
      createThermalState({
        temperatureK: 0,
        mixtureHeatCapacity_JPerK: 1,
        vesselHeatCapacity_JPerK: 1,
      }),
    ).toThrow(/> 0 K/);

    expect(() =>
      stepThermalState(
        createThermalState({
          temperatureK: 1,
          mixtureHeatCapacity_JPerK: 1,
          vesselHeatCapacity_JPerK: 0,
        }),
        { dtS: 1, cooler: { enabled: true, extractionPowerW: 2 } },
      ),
    ).toThrow(/> 0 K/);
  });

  it("requires finite positive total sensible heat capacity", () => {
    expect(() =>
      createThermalState({
        temperatureK: 300,
        mixtureHeatCapacity_JPerK: 0,
        vesselHeatCapacity_JPerK: 0,
      }),
    ).toThrow(/heat capacity/);

    expect(() =>
      createThermalState({
        temperatureK: 300,
        mixtureHeatCapacity_JPerK: Number.POSITIVE_INFINITY,
        vesselHeatCapacity_JPerK: 1,
      }),
    ).toThrow(/finite/);
  });

  it("rejects NaN", () => {
    expect(() =>
      createThermalState({
        temperatureK: Number.NaN,
        mixtureHeatCapacity_JPerK: 1,
        vesselHeatCapacity_JPerK: 1,
      }),
    ).toThrow(/finite/);

    expect(() =>
      stepThermalState(baseState(), {
        dtS: Number.NaN,
      }),
    ).toThrow(/finite/);
  });

  it("rejects Infinity", () => {
    expect(() =>
      stepThermalState(baseState(), {
        dtS: Number.POSITIVE_INFINITY,
        heater: { enabled: true, powerW: 1 },
      }),
    ).toThrow(/finite/);

    expect(() =>
      reactionHeatToSystem({
        reactionExtentMol: 1,
        deltaH_JPerMolExtent: Number.NEGATIVE_INFINITY,
      }),
    ).toThrow(/finite/);
  });
});
