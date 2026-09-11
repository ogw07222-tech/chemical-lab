export const KELVIN_OFFSET = 273.15;
export const LITERS_PER_CUBIC_METER = 1000;
export const PASCALS_PER_KILOPASCAL = 1000;
export const PASCALS_PER_ATMOSPHERE = 101325;

export function kelvinToCelsius(kelvin: number) { return kelvin - KELVIN_OFFSET; }
export function celsiusToKelvin(celsius: number) { return celsius + KELVIN_OFFSET; }
export function cubicMetersToLiters(volumeM3: number) { return volumeM3 * LITERS_PER_CUBIC_METER; }
export function litersToCubicMeters(liters: number) { return liters / LITERS_PER_CUBIC_METER; }
export function pascalsToKilopascals(pressurePa: number) { return pressurePa / PASCALS_PER_KILOPASCAL; }
export function pascalsToAtmospheres(pressurePa: number) { return pressurePa / PASCALS_PER_ATMOSPHERE; }
export function molPerM3ToMolPerL(value: number) { return value / LITERS_PER_CUBIC_METER; }

export function formatTemperature(kelvin: number) { return `${kelvin.toFixed(1)} K / ${kelvinToCelsius(kelvin).toFixed(1)} °C`; }
export function formatVolume(volumeM3: number) { return `${cubicMetersToLiters(volumeM3).toFixed(2)} L`; }
export function formatPressure(pressurePa: number) { return `${pascalsToKilopascals(pressurePa).toFixed(1)} kPa / ${pascalsToAtmospheres(pressurePa).toFixed(2)} atm`; }
