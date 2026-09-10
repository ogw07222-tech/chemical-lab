# Simulation Contract — v0

This file defines the initial cross-workstream simulation boundary. Detailed Phase 0 molecular/reaction-core types and invariants are defined in `docs/contracts/MOLECULAR_REACTION_CORE.md`.

Canonical unit semantics are defined by `docs/contracts/UNIT_SYSTEM.md` and override older implied-unit conventions.

## Simulation Input

Authoritative reaction-vessel state contains at minimum:
- volume in m^3
- temperature in K
- pressure in Pa or enough authoritative physical state for the owning layer to derive it
- species present
- finite amount per species in mol
- authoritative phase state per species
- optional electrical/electrode/catalyst/contact-interface environment
- deterministic simulation seed / clock state when stochastic logic is introduced
- versioned chemistry-data registry and reaction-rule-set identity

UI/display units never enter authoritative Simulation Core state without explicit conversion.

## Species Representation

A species is identifiable independently of display text and references a molecular/ionic graph where applicable.

A molecular graph supports at minimum unique graph-local atom IDs, element identity, formal charge, bonds/order, formula/net-charge derivation, graph validation, and deterministic structural identity.

Canonical molecular identity is distinct from vessel `SpeciesState` identity. Formula alone is insufficient identity. Phase is physical state, not molecular identity.

Every vessel species amount must be finite and non-negative. Game Layer unlimited inventory entitlement is forbidden from entering Simulation Core amount state; each vessel-add operation resolves to a finite mol amount before simulation.

## Phase Ownership and Phase-Aware Chemistry

Phase is not selected directly by the player. Workstream 02 owns phase determination/modeling using physical conditions and workstream 03 data; 01 consumes the resulting authoritative phase state.

Reaction candidate generation may use phase/contact information to determine structural accessibility, including homogeneous gas/liquid, aqueous, solid-surface, electrode-interface, and multiphase cases.

01 does not own phase-equilibrium thermodynamics, phase-dependent rate corrections, diffusion, surface kinetics, or latent heat.

The contract reserves contact/interface references so future solid reactions can be local to surfaces or phase boundaries rather than treating the entire solid bulk as instantly accessible.

## Reaction Candidate

A candidate must describe reactant species/stoichiometric participation, proposed graph/bond/charge/electron/proton transformations, generated product graphs, atom mapping, phase participants/access mode, conservation result, reaction family, thermo/kinetics query interfaces, confidence/scientific status, and deterministic generation/pruning metadata.

Candidate generation does not imply thermodynamic favorability or kinetic relevance.

## Required Invariants

No accepted ordinary closed-system chemical state transition may violate element identity conservation, atom-count conservation, net charge conservation, explicit electron bookkeeping when modeled, graph validity, finite non-negative amount state, or stoichiometric bounds.

Electrochemical/open-system electron transfer must cross an explicit external reservoir/electrode boundary.

## Chemical Reaction vs Phase Transition

A chemical reaction changes chemical participation through a `ReactionCandidate` and reaction extent and may change molecular graph/canonical identity.

Melting, freezing, vaporization, condensation, sublimation, deposition, and other same-identity phase changes are not represented as atom-rearrangement reaction candidates. They use a separate phase-transition/state-event boundary owned physically by 02 and consumed by shared state integration/validation.

01 must not fabricate bond transformations to encode a phase change.

## Product Generation Boundary

Reaction rules produce bounded local graph transformations rather than arbitrary graph rearrangements.

Product generation applies explicit graph operations, splits connected components where needed, validates structural/valence sanity, derives formula/charge/identity, validates atom mapping and conservation, validates phase/contact accessibility, and rejects invalid candidates before expensive 02 evaluation.

## Stoichiometry and Reaction Extent

Stoichiometric coefficients define conserved participation ratios. Reaction extent defines how much of that reaction occurs.

01 owns normalized coefficients, maximum extent permitted by finite available amounts, limiting/excess accounting, and exact amount consumption/formation bookkeeping. 02 kinetics determines timestep progression subject to those bounds.

## Reaction Heat Handoff

01 does not calculate reaction enthalpy, vessel heat, or temperature response.

Every accepted stoichiometric progression must be observable as a reaction-progress record containing at minimum:
- deterministic reaction candidate ID
- deterministic timestep/event ID
- reaction extent delta in mol
- stoichiometric coefficients
- species amount deltas in mol
- reactant/product phase-state references
- start/end simulation time in s

This record is the 01 -> 02 boundary for reaction enthalpy/thermal coupling. 02 converts reaction extent plus thermochemistry into released/absorbed energy and thermal/phase response.

## Thermodynamics / Kinetics Interface

01 provides structurally valid candidates plus SI physical context, phase/contact references, and transformation summary. 02 owns physical models and exact dimensioned semantics for driving force, rates, equilibrium, phase behavior, and thermal coupling.

Molar energy values exposed across this boundary use J/mol. Temperature uses K and pressure Pa. Rate-constant dimensions are reaction-order dependent and must be explicitly defined/versioned by 02 rather than inferred from a bare number.

The interface supports `unknown` so missing data does not become false precision.

## Candidate Explosion Policy

Real-time candidate generation uses finite active-species filtering, cached graph/property analysis, reactive-site detection, phase/contact accessibility filtering, reaction-family filters, local transformations, structural/conservation pruning, canonical deduplication, deterministic hard candidate budgets, and bounded transformation depth.

Exhaustive graph rearrangement and unbounded reaction-network search are forbidden in the real-time loop.

## Validation Observability

Workstream 06 must be able to inspect stable simulation traces independently of UI state. Each simulation step must expose enough deterministic information to recover:
- reaction/no-reaction outcome
- accepted candidate IDs
- major product species IDs under a documented deterministic criterion
- species amounts in mol
- reaction extent records
- authoritative phase state
- state-before/state-after IDs
- simulation timestamps
- phase-transition event references where present

This observability is required to support `REAL_EXPERIMENT_VALIDATION.md` acceptance criteria.

## Solver Separation

Candidate generation does not decide reaction speed. Thermodynamics does not substitute for kinetics. Kinetics does not bypass conservation or stoichiometric bounds. Phase transition is not encoded as chemical graph rearrangement. UI/gameplay does not override products, phase, or physical state. Reference properties are supplied through the Chemistry Data boundary.

## Determinism

The engine should eventually support `nextState = simulate(currentState, dt, context)`.

Identical authoritative vessel state, deterministic seed/clock, chemistry-data version, reaction-rule-set version, phase state, candidate budget, and simulation context must produce reproducible candidate ordering, progress events, and state transitions.

## Phase 0 Contract Status

PASS:
- molecular/species/reaction/conservation/stoichiometry boundaries are defined
- SI authoritative-unit compatibility is explicit
- finite vessel amount is isolated from unlimited Game Layer inventory
- phase is simulation-owned and available to candidate filtering
- solid/multiphase contact extension points are reserved
- chemical reactions and phase transitions are separated
- reaction extent has an explicit 02 thermal handoff
- 06 validation observability is defined

OPEN:
- final molecular graph canonicalization algorithm
- advanced valence/aromatic/coordination semantics
- oxidation-state inference
- full electrochemical reservoir model
- exact 02 phase-resolution/rate-law/thermal event contracts
- authoritative 03 normalized phase/property schemas and provenance types
- major-product classification threshold
- final orchestration ownership of phase/thermal state integration
