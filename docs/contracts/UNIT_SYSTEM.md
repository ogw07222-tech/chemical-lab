# Unit System Contract

## Status
APPROVED BY 00 - Chemistry Lab Game Design HQ

This document is the canonical unit-system contract for simulation, chemistry data, gameplay state, validation, persistence, and UI adapters.

## Core Rule
The project uses SI units as the authoritative internal unit system.

All Simulation Core calculations, normalized chemistry/property data, persisted authoritative physical state, validation fixtures, and cross-workstream contracts must use SI units unless a specific quantity has an explicitly documented chemistry-domain convention that is converted at the boundary.

## Canonical Internal Units
- amount of substance: mole (mol)
- mass: kilogram (kg)
- length: metre (m)
- time: second (s)
- temperature: kelvin (K)
- pressure: pascal (Pa)
- volume: cubic metre (m^3)
- energy: joule (J)
- power: watt (W)
- electric current: ampere (A)
- electric potential: volt (V)
- electric charge: coulomb (C)
- concentration: mol/m^3 for authoritative internal state when molar concentration is represented
- molar energy quantities: J/mol
- entropy / heat capacity quantities: J/(mol*K) where molar, or J/K where system-total

## Chemistry Data Boundary
External scientific sources may report values in non-SI or chemistry-conventional units such as kJ/mol, L, mL, atm, bar, torr, Celsius, mol/L, eV, Angstrom, or pm.

Workstream 03 must preserve the original source value/unit in provenance metadata when useful, but normalized machine-consumed values must be converted to the canonical SI representation before entering authoritative simulation calculations.

No silent unit assumptions are allowed.

Every imported numeric property must have an explicit unit and reference conditions where relevant.

## Temperature
Authoritative simulation temperature is kelvin.

UI may display Celsius as a presentation preference, but conversion happens only in UI/display utilities. Celsius must never become the authoritative simulation temperature unit.

## Pressure
Authoritative simulation pressure is pascal.

UI may display kPa, MPa, bar, atm, or other convenient derived units when useful. These are display conversions only.

## Volume
Authoritative simulation volume is cubic metre.

UI may display litres or millilitres because they are convenient laboratory units, but Game/UI commands must convert them to m^3 before reaching authoritative simulation state.

## Concentration
Authoritative molar concentration is mol/m^3.

UI may display mol/L where educationally convenient. The conversion boundary must be explicit and tested.

## Energy
Authoritative energy is joule and molar energy is J/mol.

UI and data views may display kJ or kJ/mol for readability. Stored normalized values remain SI.

## Atomic / Molecular Length Scales
Simulation/data architecture may receive radii or bond lengths in pm, Angstrom, or nm from references.

Authoritative normalized values should be stored in metres unless a dedicated compact representation is later approved by 00 HQ for numerical/performance reasons. Any such exception must preserve explicit conversion semantics and may not create mixed-unit APIs.

## Electrochemistry
Electrical potential is volt, current is ampere, charge is coulomb, and electrical energy follows SI.

Any electrochemical domain-specific quantity must document its dimension and unit explicitly.

## UI Policy
The UI is allowed to use human-friendly derived units, but must not own physics conversions ad hoc inside React components.

Preferred flow:

`SI authoritative state -> typed unit/format adapter -> display unit -> UI`

and for commands:

`UI display/input unit -> typed conversion adapter -> SI command value -> Game/Simulation Layer`

All conversions should be centralized and tested.

## Persistence / Replay
Authoritative saved physical state and deterministic replay values should use canonical SI units.

Save formats should include schema/version metadata. Unit meaning must never depend on locale or display preferences.

## Validation Requirements
Workstream 06 should eventually verify:
- no mixed-unit contract violations;
- common conversions round-trip correctly;
- Celsius/Kelvin conversion is correct at boundaries;
- L/mL to m^3 conversion is correct;
- kPa/bar/atm display conversion does not mutate authoritative Pa state;
- mol/L display conversion does not alter authoritative mol/m^3 state;
- data imports preserve source units while supplying normalized SI values.

## Forbidden Patterns
- storing Celsius as simulation temperature;
- storing litres as authoritative vessel volume;
- passing untagged numeric values whose unit is implied only by variable naming;
- mixing J/mol and kJ/mol without explicit conversion;
- mixing Pa, kPa, bar, and atm in Simulation Core APIs;
- allowing UI display preferences to change simulation results.

## Architecture Rule
Units are part of the data contract, not presentation trivia.

Any new physical quantity added by 01, 02, 03, 04, 05, or 06 must define its canonical SI unit before production integration.
