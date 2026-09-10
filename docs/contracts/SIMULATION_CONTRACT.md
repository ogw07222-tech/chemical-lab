# Simulation Contract — v0

This file defines the initial cross-workstream contract. It is intentionally conservative and will evolve through HQ decisions.

## Simulation Input
A reaction vessel state containing at minimum:
- volume
- temperature
- pressure or enough information to derive it
- species present
- amount per species
- phase per species
- optional electrical/electrode/catalyst environment
- deterministic simulation seed / clock state when stochastic logic is introduced

## Species Representation
A species must be identifiable independently of display text and should reference a molecular/ionic graph where applicable.

A molecular graph must support at minimum:
- atoms
- element identity
- formal charge
- bonds
- bond order

Later extensions may add aromaticity, radicals, coordination, resonance representation, stereochemistry, and explicit electronic state.

## Reaction Candidate
A candidate should describe:
- reactant species and stoichiometric participation
- proposed bond/charge/electron/proton transformations
- generated product species
- conservation result
- reaction-family classification
- thermodynamics query/result interface
- kinetics query/result interface
- confidence/scientific-status metadata

## Required Invariants
No accepted state transition may violate:
- element identity conservation
- atom-count conservation
- net charge conservation
- explicit electron bookkeeping when electron transfer is modeled

## Solver Separation
Candidate generation does not decide reaction speed.
Thermodynamics does not substitute for kinetics.
Kinetics does not bypass conservation.
UI/gameplay does not override chemical products.

## Time-Step Output
The engine should eventually support:
`nextState = simulate(currentState, dt, context)`
with deterministic results for identical deterministic inputs and seed.
