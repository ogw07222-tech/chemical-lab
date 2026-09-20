# Phase 4A-3 Thermal Apparatus / Heat Transfer / Temperature Evolution

Status: IMPLEMENTED FOUNDATION / independent validation pending
Owner: 02 — Thermodynamics & Kinetics

## Purpose
Phase 4A-3 extends the existing thermal primitives without replacing them. It evaluates energy movement among finite well-mixed thermal bodies, explicit external reservoirs, apparatus power sources/sinks, and existing reaction heat, then produces deterministic thermal body updates.

Authoritative model:

`thermal snapshot + applied reaction heat + apparatus/control inputs + dt`
→ finite-body / reservoir / external-power energy evaluation
→ signed energy aggregation per body
→ existing sensible-energy update (`DeltaT = Q/C`)
→ next thermal state
→ next simulation step kinetics consumes the updated temperature

No UI control writes temperature directly.

## Existing contract retained
The Phase 1 thermal foundation remains authoritative for:
- `ThermalState`;
- reaction heat sign (`Q_reaction = -DeltaH * appliedExtent`);
- heater/cooler/thermostat ledger semantics;
- `applySensibleEnergy()`;
- `stepThermalState()`;
- positive-Kelvin and finite heat-capacity validation.

Phase 4A-3 adds multi-body/appartus energy evaluation around these primitives. It does not create a second contradictory temperature authority.

## Thermal bodies
`ThermalBody` wraps an existing `ThermalState` with a stable body id, coarse body kind, scientific status and optional source. Body kinds distinguish vessel, hot plate, bath medium, chamber gas, lab environment and other thermal masses.

Each finite body has:
- authoritative current `temperatureK`;
- finite positive total sensible heat capacity from the existing thermal state;
- explicit scientific status.

The model is lumped / well mixed. It is not a spatial wall/mesh solver.

## Heat capacity and 03 data boundary
`evaluateMixtureHeatCapacity()` accepts phase-specific caller/provider-supplied species molar heat capacities and computes:

`C_mixture = Sum_i n_i Cp_i`

Requirements:
- amount is finite and non-negative;
- Cp is finite and positive;
- Cp record phase exactly matches the species phase;
- duplicate/ambiguous or missing Cp support is not guessed;
- generated/unknown SpeciesIds are handled identically and become OPEN when Cp is unavailable.

If any positive-amount component lacks unambiguous phase-matched Cp, quantitative mixture heat capacity is `OPEN` rather than silently treating the component as zero.

Repository 03 schema already supports `molarHeatCapacity: J/(mol*K)` plus optional temperature correlations/reference conditions. Phase 4A-3 does not duplicate the 03 schema and does not hardcode realistic-looking Cp values.

## Finite-body heat transfer
A finite-body `ThermalContact` uses an effective conductance `G_th` in W/K. `G_th` is caller/data/apparatus supplied; no universal default is invented.

Supported mechanisms remain topologically distinct:
- `CONTACT` — direct contact such as hot plate ↔ vessel;
- `BATH` — bath medium ↔ vessel;
- `CONVECTION` — chamber gas ↔ vessel.

For two finite bodies with capacities `C1`, `C2` and temperatures `T1`, `T2`:

`T_eq = (C1*T1 + C2*T2)/(C1+C2)`

For `DeltaT = T_hot - T_cold`:

`Q_eq = DeltaT / (1/C_hot + 1/C_cold)`

`lambda = G_th * (1/C_hot + 1/C_cold)`

`Q(dt) = Q_eq * [1 - exp(-lambda*dt)]`

The implementation uses `expm1` for numerical stability.

Properties:
- same positive energy magnitude removed from the hot finite body and added to the cold finite body;
- finite large-dt limit;
- no pairwise equilibrium crossing;
- no micro-substep loop;
- deterministic O(active contacts).

## Multiple finite contacts
All contacts are evaluated from the same immutable snapshot, canonically ordered. Because multiple simultaneous contacts can otherwise over-apply pairwise relaxation, the evaluator applies deterministic source/destination thermal-envelope normalization before body updates.

For contact-only exchange, a body is not allowed to move outside the temperature envelope of the finite bodies exchanging energy with it during the snapshot. Energy scaling is applied to the transfer itself, preserving equal-and-opposite finite-body energy accounting.

In addition, simultaneous passive contacts must preserve the snapshot hot-to-cold ordering on every active contact edge. Pairwise no-crossing is insufficient when one body participates in multiple contacts: individually valid pairwise energy requests can aggregate into a result where a snapshot-hot body becomes colder than a directly connected snapshot-cold body.

After the per-body envelope caps, Phase 4A-3 therefore computes the aggregate internal-energy delta of the entire finite-contact network and applies one deterministic common scale in [0, 1] when needed so that, for every snapshot hot-to-cold edge:

`T_source,next >= T_destination,next`.

The scale is derived analytically from the initial temperature gap, each body's heat capacity, and the aggregate network energy delta. It is not a fitted tolerance or timestep micro-substep. Applying one common scale to all internal transfers preserves equal-and-opposite internal energy accounting and avoids order-dependent first-contact-wins behavior.

This is a coarse lumped-network stability bound, not a claim to solve the exact coupled heat-equation dynamics within one timestep. Repeated timesteps continue the deterministic relaxation.

## External reservoir boundaries
`ThermalReservoirBoundary` explicitly models an external/infinite reservoir approximation such as lab ambient or a controlled chamber boundary.

For one finite body:

`dT/dt = (G/C) * (T_reservoir - T)`

is integrated with closed-form exponential relaxation. Reservoir exchange cannot cross the reservoir temperature for that contribution. Multiple reservoir boundaries are deterministically envelope-limited.

Energy transferred through these boundaries is not silently created/destroyed: it is reported as signed `externalEnergyJ` and recorded in the body's environment ledger.

A finite bath/chamber should be represented as a normal `ThermalBody` + finite contact, not as an external reservoir.

## External heater and cooler
`ThermalPowerActuator` is an explicit external source/sink.

Baseline:

`Q = P * dt`

where `powerW` is a non-negative magnitude.

- HEATER adds external energy.
- COOLER removes external energy.
- disabled or zero-power actuator contributes zero.
- negative/non-finite power is unsupported/OPEN.

Optional `targetTemperatureK` is a control request. It limits the actuator's own energy contribution so that the actuator alone does not cross its target; it never assigns current temperature to the target.

No efficiency factor is fabricated. If effective efficiency/calibration is needed, 03/04 must supply a scientifically-labeled effective power/conductance input.

## Apparatus topology
### Hot Plate
Supported topology:

`external heater -> finite plate body -> CONTACT -> vessel`

The heater first changes the plate thermal state. The vessel receives heat through physical contact in subsequent snapshot evolution. A UI target does not teleport either body temperature.

### Heating Bath
Supported topology:

`external heater -> finite bath-medium body -> BATH -> vessel`

Bath thermal mass is distinct from vessel thermal mass.

### Cooling Bath
Supported topology:

`vessel -> BATH -> finite cold bath`

Optional external cooler power may remove energy from the bath body. A finite bath warms as it receives vessel heat; it is not an infinite 0 C clamp.

### Hot-Air Chamber
Supported topology:

`external heater -> finite chamber-gas body -> CONVECTION -> vessel`

A controlled external chamber may alternatively be represented as an explicitly external `CONTROLLED_CHAMBER` reservoir, in which case exchanged energy is external-accounted.

## Reaction heat coupling
Phase 4A-3 does not recalculate reaction enthalpy or reaction extent. Existing reaction progression/thermal coupling remains authoritative for signed reaction heat from actual applied extent.

`ThermalReactionSource.energyJ` is therefore already-computed signed heat:
- positive = heat released into body;
- negative = heat absorbed from body.

The apparatus evaluator adds this energy exactly once to the same body energy aggregate used for contact/reservoir/heater/cooler effects and records it once in `reactionHeat_J`.

Missing reaction enthalpy remains OPEN upstream; Phase 4A-3 must not fabricate it.

## Timestep semantics
The intended coarse ordering is:

1. snapshot current matter/thermal state;
2. reaction progression uses snapshot temperature;
3. applied reaction extent produces signed reaction heat;
4. matter transport commits through the applicable matter-transport boundary;
5. apparatus/contact/ambient thermal exchange is evaluated from the thermal snapshot;
6. reaction + internal + external thermal contributions are aggregated once;
7. temperature update is committed;
8. pressure/provider projections use the resulting authoritative state as appropriate;
9. the next reaction/kinetic step uses the updated temperature.

This avoids a same-step cyclic dependency where a temperature change retroactively changes the reaction rate that produced the same step's heat.

## Energy accounting
For finite modeled bodies:

`DeltaE_body = Q_internal + Q_reservoir + Q_heater - Q_cooler + Q_reaction`

Internal finite-body transfers sum to zero across the modeled finite-body system.

Therefore:

`Sum(DeltaE_finite_bodies) = externalEnergyJ + reactionEnergyJ`

subject only to floating-point representation.

`internalTransferHeat_J` was added as an optional additive ledger field so finite body-to-body energy transfer is auditable without mislabeling it as external environment energy. Existing thermal ledgers remain source compatible.

## Scientific status
The engine uses the repository `ScientificStatus` convention.

- Data-backed inputs may retain their supplied status.
- Generic/effective conductance is only as authoritative as the supplied source/status.
- The lumped thermal model itself should normally be treated as `APPROXIMATED` unless a narrower validated model explicitly supports stronger status.
- missing/ambiguous Cp, invalid conductance/power, missing body references, non-finite energy, or invalid temperature update cause `OPEN` diagnostics rather than NaN/Infinity propagation.

## Phase-transition boundary
Melting, freezing, boiling, evaporation, condensation, and latent heat are deliberately not implemented in Phase 4A-3.

The evaluator performs only sensible-heat evolution on states for which the caller has elected to use the sensible model. It does not infer a new phase, invent latent heat, or silently claim a phase transition has been modeled. Where 03/02 phase evaluation indicates a transition/coexistence boundary, orchestration must mark the quantitative continuation OPEN or defer to the future Phase 4B phase-transition authority instead of interpreting the Phase 4A-3 sensible result as a valid post-transition prediction.

## Determinism
Identical bodies, contacts, reservoirs, actuators, reaction sources and dt produce identical evaluation output.

Canonical ordering is by stable ids. RNG is not used.

## Provider/UI boundary
Possible future provider facts include:
- current temperature;
- requested target temperature;
- heating/cooling active;
- signed/net heat-flow direction;
- normalized/coarse heat-transfer activity;
- scientific status.

05B/05C/05D must render or dispatch simulation facts/intents only. React/UI must not perform thermal integration.

## Explicitly out of scope
- melting/freezing/boiling;
- evaporation/condensation;
- latent heat / phase-fraction integration;
- CFD/Navier-Stokes;
- finite-element/spatial thermal meshes;
- detailed radiation heat transfer;
- molecular/per-particle energy simulation;
- electrochemistry;
- apparatus visual redesign;
- UI implementation.
