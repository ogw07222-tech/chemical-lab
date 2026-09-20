# Phase 4A-3 — 06D Defect Fix Semantics

Status: FIX IMPLEMENTED / independent 06D revalidation pending
Owner: 02 — Thermodynamics & Kinetics
Target PR: #68

## Scope
This addendum closes only the three defects found by independent 06D validation. It does not redesign heat capacity, passive contact/reservoir relaxation, reaction thermochemistry, phase change, gas transport, or UI behavior.

## DEF-01 — multi-actuator target aggregation
`targetTemperatureK` is evaluated from the thermal snapshot, but multiple target-bearing actuators on the same body may not each consume the same target headroom independently.

For every enabled actuator:
1. compute the external power request `Q_requested = P * dt`;
2. when a target exists, cap that actuator's own raw contribution by `C * |T_target - T_snapshot|`;
3. group target-bearing contributions by `(bodyId, mode)`;
4. reconcile the group deterministically using a common proportional scale if the group would exceed the directional snapshot envelope.

For HEATER groups the directional envelope ends at the highest participating heater target; for COOLER groups it ends at the lowest participating cooler target. This does **not** mean the extreme target owns the allocation: every actuator first retains its own target cap and the remaining group demand is proportionally normalized. No first-actuator-wins or array-order sequential application is allowed.

Consequences:
- two or N identical heaters sharing a target cannot produce count-scaled overshoot;
- same-target coolers cannot produce count-scaled undershoot;
- mixed target values remain deterministic and contribution-proportional;
- target-less actuators remain ordinary external power sources/sinks and are not silently assigned a target.

## DEF-02 — authoritative target semantics
An actuator `targetTemperatureK` is a bound on **that actuator system's control contribution**, not a hard clamp on final body temperature.

Therefore:
- a heater's applied contribution alone does not exceed its supported target envelope;
- a cooler's applied contribution alone does not go below its supported target envelope;
- an exothermic reaction, hotter finite body/reservoir, or another independently supported heat source may still make final temperature exceed a heater target;
- an endothermic reaction or colder independent sink may make final temperature fall below a cooler/heater target;
- reaction heat is never discarded, clipped, or rewritten to satisfy an apparatus target.

The evaluator emits informational actuator diagnostics for target-bearing actuators. Structured diagnostic details include:
- `actuatorRequestedEnergyJ`;
- `actuatorAppliedEnergyJ`;
- `targetLimited`;
- `finalTemperatureMayCrossTargetDueToOtherSources = true`.

This flag states the contract semantics; it is not a prediction that crossing necessarily occurred in that particular timestep.

## DEF-03 — identity integrity
Within one `evaluateThermalApparatusStep()` input, IDs must be unique within each entity type:
- thermal bodies;
- finite contacts;
- external reservoir boundaries;
- power actuators;
- reaction heat sources.

Duplicate IDs are deterministic input errors and throw before thermal transfer evaluation/body updates begin. Entries are never silently deduplicated. Two physically parallel contacts or actuators must use distinct stable IDs.

Cross-type ID equality is permitted because namespaces are type-scoped.

## Atomicity
Duplicate-ID rejection occurs before any update result is produced. Existing runtime failures during final body temperature commit continue to return an OPEN result with `bodyUpdates: []` rather than a partially committed set.

## Energy conservation
This fix does not alter passive transfer equations or reaction-energy authority.

For finite modeled bodies:

`sum(deltaE_finite) = externalEnergyJ + reactionEnergyJ`

Internal finite-body transfer remains equal-and-opposite. Actuator normalization scales explicit external energy before accounting; no joules disappear from an already-applied transfer.

## Reaction/runtime boundary
Phase 3A reaction heat remains upstream authority and is only consumed as signed `ThermalReactionSource.energyJ`. The apparatus evaluator does not recompute extent or enthalpy and does not suppress reaction heat to enforce setpoints.

Full production orchestration between reaction progression and apparatus evaluation remains a separate integration item and is still OPEN until wired/validated cross-module.

## Unchanged
- mixture Cp model;
- passive finite-contact closed-form relaxation;
- reservoir closed-form relaxation;
- positive-Kelvin guard;
- phase-transition/latent-heat boundary;
- gas transport;
- UI/provider ownership.
