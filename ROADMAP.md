# Roadmap

## Phase 0 — Architecture
- Repository and module boundaries
- Simulation contracts
- Element/molecule/species schemas
- Deterministic simulation rules
- Workstream status protocol
- Test strategy
- Canonical discovery -> encyclopedia -> inventory progression contract
- Premium/core-feature boundary contract

## Phase 1 — Molecular Core
- Atoms and elements
- Bonds and molecular graphs
- Molecular formula / formal charge
- Conservation laws
- Basic energy interface

## Phase 2 — Reaction Engine
- Reactive-site detection
- Reaction candidate generation
- Graph transformations
- Candidate pruning
- Product generation
- Stoichiometry

## Phase 3 — Thermodynamics & Kinetics
- Enthalpy/energy approximations
- Activation barriers
- Temperature/concentration/pressure dependence
- Reaction rates
- Equilibrium approximation

## Phase 4 — Major Chemistry Families
- Combustion
- Acid-base
- Redox
- Precipitation
- Dissociation/ionization
- Decomposition/synthesis
- Electrochemistry

## Phase 5 — Laboratory Game
- Interactive reaction vessel
- Starter-material inventory
- Discovery confirmation through valid observation/analysis
- Encyclopedia registration
- Discovered-species inventory unlock and reuse
- Heating/cooling and environment controls
- Instruments and analysis
- Experiment log and progression
- Objectives/tutorials/challenges as overlays within the single normal game
- Developer Mode for all-species/debug access only

## Post-Phase 5 — Premium Foundation
Only after the standard gameplay loop is stable:
- Advanced experiment archive and organization
- Multi-run comparison and richer analytics
- Enhanced encyclopedia organization/relationship views
- Additional saved workspace/setup convenience
- Cosmetic laboratory/UI customization

Premium must not unlock undiscovered chemistry or alter simulation outcomes.

## Phase 6 — Advanced Chemistry
- More elements and functional groups
- Solvents and catalysts
- Electrolysis
- More realistic equilibria
- Complex reaction networks

## Gate Rule
A phase does not become production-ready because implementation exists. Relevant scientific and regression validation from workstream 06 is required before integration/release claims.
