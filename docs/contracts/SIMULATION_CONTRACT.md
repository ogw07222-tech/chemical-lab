# Simulation Contract — v0

This file defines the initial cross-workstream simulation boundary. Detailed Phase 0 molecular/reaction-core types and invariants are defined in `docs/contracts/MOLECULAR_REACTION_CORE.md`.

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
- versioned chemistry-data registry and reaction-rule-set identity

## Species Representation
A species must be identifiable independently of display text and should reference a molecular/ionic graph where applicable.

A molecular graph must support at minimum:
- unique atom IDs within a graph instance
- element identity
- formal charge
- bonds and bond order
- deterministic formula/net-charge derivation
- graph validation
- deterministic structural identity independent of runtime atom IDs

Later extensions may add aromaticity, radicals, coordination, resonance representation, stereochemistry, isotopes, and explicit electronic state.

Canonical molecular identity is distinct from vessel `Species` identity. Formula alone is not sufficient as a structural identity.

## Reaction Candidate
A candidate must describe:
- reactant species and stoichiometric participation
- proposed graph/bond/charge/electron/proton transformations
- generated product graphs
- atom mapping from reactants to products
- conservation result
- reaction-family classification
- thermodynamics query/result interface
- kinetics query/result interface
- confidence/scientific-status metadata
- deterministic generation/pruning metadata sufficient for validation diagnostics

Candidate generation does not imply thermodynamic favorability or kinetic relevance.

## Required Invariants
No accepted ordinary closed-system state transition may violate:
- element identity conservation
- atom-count conservation
- net charge conservation
- explicit electron bookkeeping when electron transfer is modeled
- graph validity under the active structural validation policy

Electrochemical/open-system electron transfer must cross an explicit external reservoir/electrode boundary; charge/electrons may not appear or disappear implicitly.

## Product Generation Boundary
Reaction rules produce bounded local `GraphTransformation`s rather than arbitrary graph rearrangements.

Product generation must:
1. apply explicit graph operations
2. split product connected components where needed
3. validate graph/valence sanity
4. derive formula, charge, and structural identity
5. validate atom mapping and conservation
6. reject impossible/invalid candidates before expensive thermodynamics/kinetics evaluation

## Stoichiometry Boundary
Stoichiometric coefficients define conserved participation ratios. Reaction extent defines how much of that valid reaction occurs.

The stoichiometry layer owns:
- normalized reactant/product coefficients
- maximum extent permitted by available amounts
- limiting/excess reactant accounting
- exact amount consumption/formation bookkeeping

The kinetics layer owns the timestep reaction progress subject to those stoichiometric bounds.

## Candidate Explosion Policy
Real-time candidate generation must use bounded deterministic search:
- active-species filtering
- reactive-site detection
- reaction-family eligibility filters
- local transformations
- valence/structural pruning
- conservation pruning
- duplicate canonical-candidate elimination
- cached molecular/property analyses
- hard observable candidate budgets
- bounded transformation depth

Exhaustive graph rearrangement and unbounded reaction-network search are forbidden in the real-time loop.

## Solver Separation
Candidate generation does not decide reaction speed.
Thermodynamics does not substitute for kinetics.
Kinetics does not bypass conservation or stoichiometric bounds.
UI/gameplay does not override chemical products.
Reference property values are supplied by the Chemistry Data boundary rather than embedded ad hoc in reaction logic.

## Thermodynamics / Kinetics Interface
Workstream 01 provides structurally valid reaction candidates plus transformation/environment context. Workstream 02 owns the physical models and exact units/semantics for thermodynamic driving force, activation/rate behavior, and equilibrium.

The interface must support `unknown` results so missing data does not become false precision.

## Determinism
The engine should eventually support:
`nextState = simulate(currentState, dt, context)`

Identical vessel state, deterministic seed/clock state, chemistry-data registry version, reaction-rule-set version, candidate budget, and simulation context must produce reproducible candidate ordering and state transitions.

## Phase 0 Contract Status
PASS:
- molecular/species/reaction/conservation/stoichiometry boundaries are defined
- 01/02/03 responsibility separation is preserved
- bounded candidate-generation policy is explicit

OPEN:
- final molecular graph canonicalization algorithm
- advanced valence/aromatic/coordination semantics
- oxidation-state inference
- full electrochemical reservoir model
- exact 02 numeric units/query semantics
- authoritative 03 property schemas/data provenance fields
