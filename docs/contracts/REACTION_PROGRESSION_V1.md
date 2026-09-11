# Reaction Resolution & State Progression v1 — Phase 2E

Status: EXECUTABLE FOUNDATION
Owners: 01 Chemistry Simulation Engine (resolution/state mutation), 02 Thermodynamics & Kinetics (evaluation/rate/heat evidence)

## Canonical timestep

`current species -> candidate generation -> 02 evaluation/ranking -> 01 competing-reaction resolution -> bounded extent -> stoichiometric species mutation -> reaction progress events -> 02 reaction heat/thermal primitive -> next deterministic state`

Phase re-evaluation is an explicit hook after the step and is not implemented here.

## Resolution ownership

01 owns stoichiometric maximum extent, shared-reactant allocation, amount mutation, conservation re-check, deterministic event ordering, and failure on invalid numerical/conservation state.

02 owns thermodynamic feasibility, relative kinetic signal/ranking, reaction enthalpy, and thermal physics. Phase 2E consumes `RankedReactionEvaluation`; it does not recalculate deltaG, activation barriers, Arrhenius terms, equilibrium, or catalyst physics.

## Extent model

Absolute rate laws are not yet available. v1 therefore converts 02's dimensionless `relativeRate` into an explicitly APPROXIMATED timestep fraction:

`fraction = min(maxFractionPerStep, 1 - exp(-relativeRate * dt / coarseRateTimescale))`

`requestedExtent = stoichiometricMaxExtent * fraction`

This is not a physical rate constant and must never be labeled VERIFIED. Default uncertain/unranked/OPEN candidates are deferred from authoritative mutation unless explicitly enabled for controlled experiments.

## Competition

Rank groups are processed in rank order. Equal-rank candidates are handled as one group: preliminary demands are computed from the same group-start inventory and a common per-reactant scale prevents aggregate overconsumption. candidateId is only a deterministic ordering key for emitted records, not a tie winner.

Candidates whose reactants had zero amount at timestep start are not activated from products formed earlier in the same step. This prevents hidden intra-step reaction cascades in the v1 integrator.

## Product identity / registry boundary

A product must resolve to an already registered `SpeciesState` whose molecular canonical key matches the proposed product graph. Unresolved products are deferred and no fake species ID is created. Dynamic Species Registry & Generated Species Persistence is the next phase.

## Numerical safety

- `dtS > 0`, finite;
- all amounts remain finite and non-negative;
- only tiny negative roundoff within the configured tolerance may clamp to zero;
- positive near-zero amounts are not silently deleted;
- concentration hints are invalidated after amount mutation rather than left stale;
- mole-weighted element/atom/net-charge conservation is recomputed before/after mutation;
- conservation mismatch throws and is never silently repaired.

## ReactionProgressEvent

Every applied reaction emits a deterministic event containing timestep/candidate IDs, extent, reactant/product/net amount deltas, scientific status, reason codes, and optional deltaH/heat/temperature fields populated by thermal coupling.

## Thermal coupling

When 02 provides `deltaH_J_per_mol`, existing thermal primitives compute `Q = -deltaH * appliedExtent` and update the thermal ledger/state. If deltaH is unavailable, heat is not fabricated; the event and thermal coupling result propagate OPEN and list the missing-heat candidate. Existing mixture/vessel heat capacity is used; composition-dependent heat-capacity re-resolution remains OPEN.

## Out of scope

Full equilibrium, stiff ODE/adaptive network integration, dynamic species creation/persistence, phase solver, electrochemistry, electrode models, and UI wiring are not part of Phase 2E.
