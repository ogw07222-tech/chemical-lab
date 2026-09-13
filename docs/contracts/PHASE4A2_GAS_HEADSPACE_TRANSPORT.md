# Phase 4A-2 Gas / Headspace Transport Contract

Status: IMPLEMENTED FOUNDATION / independent validation pending
Owner: 02 — Thermodynamics & Kinetics

## Purpose
Phase 4A-2 provides a deterministic well-mixed gas thermodynamic and transport-amount layer on top of the Phase 4A-1 compartment/atomic-transfer foundation.

Authoritative flow:

`MatterSystemState + thermodynamic inputs + GAS connection models + dt`
→ gas pressure/partial-pressure evaluation
→ bulk pressure-driven and species-diffusive transport amount evaluation
→ explicit `MatterTransferRequest[]`
→ 01 `transferMatterBatch()`
→ next `MatterSystemState`

02 never commits arbitrary matter mutation.

## Headspace and atmosphere
`VESSEL_HEADSPACE`, `LAB_ATMOSPHERE`, and other gas-capable Phase 4A-1 compartments reuse the existing `MatterCompartmentState` inventory and `volumeM3` fields. Phase 4A-2 does not redesign 01 ownership.

Temperature is supplied to the 02 evaluator through `GasCompartmentThermodynamicInput` rather than being invented from compartment metadata.

`LAB_ATMOSPHERE` is modeled as a finite matter compartment in this foundation. Open-vessel gas does not disappear into an implicit infinite reservoir.

Open/closed semantics are explicit topology/control facts:
- an enabled directed GAS connection may transport gas;
- a missing or disabled atmosphere connection transports nothing;
- an open vessel is never implemented as automatic gas deletion.

## Ideal-gas baseline
For supported gas-phase inventory:

`P = n R T / V`

with SI units:
- P: Pa
- V: m^3
- n: mol
- T: K
- R: 8.31446261815324 J/(mol K)

Requirements:
- finite `V > 0`;
- finite `T > 0 K`;
- finite non-negative gas amounts;
- only `SpeciesState` records whose phase is `gas` contribute.

A valid empty gas compartment evaluates to 0 Pa. Invalid/missing thermodynamic support returns `OPEN` rather than NaN/Infinity.

Scientific status is `APPROXIMATED`: the ideal-gas equation is exact only within the idealized model, not universally exact physical behavior.

## Partial pressure
For an ideal mixture:

`p_i = n_i R T / V = y_i P`

Phase 4A-2 exposes canonical species partial pressures and mole fractions. These values are reusable by diffusion, future provider measurements, and visualization projection; React/UI must not recompute the physics.

## Transport coefficients
Phase 4A-2 does not hardcode realistic-looking diffusion or conductance constants.

A caller/provider supplies a `GasConnectionTransportModel` with optional:
- bulk molar conductance `G_bulk` in mol/(s Pa);
- generic species-diffusion conductance `G_diff` in mol/(s Pa);
- species-specific diffusion conductance overrides in mol/(s Pa);
- scientific status/provenance.

03 may later supply authoritative values. Caller-supplied coarse values remain explicitly approximate/parameterized.

## Pressure-driven bulk gas transport
Bulk transport is driven by total pressure difference on an enabled directed GAS connection:

`dn_total/dt = G_bulk (P_source - P_destination)`

only when the directed source has higher pressure.

Transferred species amounts are distributed by the source gas mole fractions. Bulk advection remains separate from species diffusion in the evaluation result.

## Species diffusion
Species diffusion is driven by species partial-pressure difference:

`dn_i/dt = G_i (p_i,source - p_i,destination)`

only when the directed source has the larger partial pressure for that species.

Equal total pressure therefore does not suppress composition diffusion. Example: equal-P N2/O2 mixtures with different compositions can diffuse while bulk pressure-driven flow remains zero.

## Directed topology and bidirectionality
Phase 4A-1 GAS connections remain directed. Phase 4A-2 never silently interprets a directed connection as reversible.

Physical bidirectional exchange requires two explicitly enabled directed GAS connections (or a future explicitly bidirectional capability owned by the topology/control contract).

## Timestep stability
No molecular micro-stepping is used.

For a pairwise ideal-gas conductance path, define:

`s_source = R T_source / V_source`

`s_destination = R T_destination / V_destination`

For a positive pressure driving difference `DeltaP`, the equality extent is:

`xi_eq = DeltaP / (s_source + s_destination)`

The linear conductance ODE has closed-form relaxation:

`xi(dt) = xi_eq [1 - exp(-G (s_source + s_destination) dt)]`

implemented numerically with `expm1` for stability.

Consequences:
- deterministic;
- no arbitrary micro-substep count;
- finite large-dt limit;
- pairwise pressure/partial-pressure equality is approached without crossing for the corresponding contribution model;
- browser cost remains O(active GAS connections × relevant gas species).

Bulk and diffusive contributions are evaluated separately from the same snapshot and then combined into explicit transfer requests. This is a coarse operator approximation, not Navier-Stokes or a detailed multicomponent transport solver.

## Source availability and multiple connections
02 must not rely on 01 to silently clamp overdraw.

After per-connection desired contributions are calculated, outgoing demands are grouped by `(sourceCompartmentId, speciesId)`. If aggregate requested demand exceeds the source snapshot amount, all competing contributions are proportionally normalized using canonical ordering.

This prevents first-connection-wins behavior and makes caller ordering irrelevant. The resulting combined requests are safe inputs for 01 `transferMatterBatch()`.

## Transfer result contract
`GasTransportEvaluation` exposes:
- `bulkTransfers`;
- `diffusiveTransfers`;
- canonical combined `transferRequests` for 01;
- per-species contribution diagnostics;
- per-connection scientific status/reason codes.

The evaluation is not a state transition. Only 01 may commit the requests.

## Conservation
02 only produces relocations of existing SpeciesIds. It does not create/destroy atoms or species.

When the returned requests are committed through Phase 4A-1 `transferMatterBatch()`, the existing global species, element, atom-count, and net-charge conservation checks remain authoritative.

No source request exceeds the available snapshot amount after deterministic normalization.

## Open vessel routing
An open headspace may have an explicit directed GAS connection to a finite `LAB_ATMOSPHERE` compartment.

Gas escape is therefore:

`VESSEL_HEADSPACE → LAB_ATMOSPHERE`

through an explicit transport request and 01 commit. Closing/disabling the connection stops the transport. Matter is never deleted merely because a vessel is open.

Reaction-to-headspace source terms are not fabricated here. If chemistry has not already placed gas-phase matter in a gas compartment, Phase 4A-2 does not invent that phase-transfer event.

## Scientific status and OPEN behavior
Supported ideal-gas pressure plus parameterized conductance is at best `APPROXIMATED` unless stronger evidence is explicitly supplied, and the overall result takes the worst contributing status.

The solver returns no transport contribution for unsupported/OPEN endpoints or invalid conductances. NaN/Infinity is never emitted as a transfer amount.

Nonideal gas equations, fugacity, continuum fluid dynamics, detailed multicomponent diffusion, phase change, and empirical apparatus-specific conductance calibration remain separate work.

## Role boundaries
### 01 — Chemistry Simulation Engine
Owns:
- compartment inventory and SpeciesId identity;
- `transferMatterBatch()` atomic mutation;
- global conservation-safe commit semantics.

### 02 — Thermodynamics & Kinetics
Owns:
- ideal-gas pressure/partial-pressure baseline;
- transport amount evaluation;
- bulk pressure-driven and partial-pressure diffusive contributions;
- timestep stability and source-demand normalization;
- scientific status.

### 03 — Chemistry Data & Validation
Owns authoritative transport/diffusion/conductance reference data and provenance.

### 04 — Laboratory Gameplay
Owns whether valves/openings/connections are enabled and apparatus control semantics.

### 05C / 05D — UI
May consume simulation-provided pressure/composition/net transport facts. UI particle positions, velocities, or animations are never physics inputs.

## Explicitly out of scope
- particle-by-particle molecular simulation;
- per-particle momentum/collisions;
- Navier-Stokes CFD or 3D velocity fields;
- UI visualization particle physics;
- evaporation, condensation, boiling, dissolution, or reaction-to-headspace phase source models;
- nonideal gas EOS/fugacity;
- full multicomponent Maxwell-Stefan transport;
- apparatus-specific empirical coefficient tuning.
