# 01 — Chemistry Simulation Engine

- Owner: Lead Chemistry Simulation Engine Developer / Molecular Graph Systems Developer / Reaction Solver Architect / Stoichiometry Engine Developer
- Current phase: Phase 0 — Architecture / Contract
- Overall state: IN_PROGRESS
- Last updated: 2026-09-10
- Last checked main SHA: `f6513bd6cefc7df5b16d1f678a4cf1b443859e94`
- Active branch: `feature/phase0-molecular-core-contract`
- Active PR: #1 — `docs: define Phase 0 molecular reaction core contract`

## Current Objective
Finalize the Phase 0 molecular/reaction core contract that can support the later Emergent Chemistry Engine without reaction-equation lookup hardcoding.

## Completed
- Re-checked latest `main` and required source-of-truth documents before design work.
- Defined Phase 0 Element schema contract: atomic number, symbol, atomic mass, valence electrons, common oxidation states, electronegativity, typical valences, optional chemistry/data metadata.
- Defined Atom representation with graph-local unique atom IDs, formal charge, optional oxidation-state analysis, and radical/electronic extension points.
- Defined Bond representation with endpoints, kind, order, polarity/energy query metadata, and reserved aromatic/ionic/coordination extension points.
- Defined `MolecularGraph` / `MoleculeRecord` boundaries, formula and net-charge derivation, graph validation, and deterministic canonical structural identity requirement.
- Separated canonical molecular identity from vessel `Species` identity and defined phase/amount/concentration interfaces.
- Defined `ReactionCandidate`, first-class atom mapping, bond/charge/proton/electron transformation metadata, family classification, confidence/scientific-status metadata, and 02 query boundaries.
- Defined conservation validation for element counts, total atom count, charge, and explicit electron bookkeeping.
- Defined bounded local product-graph generation and impossible-product/valence pruning sequence.
- Defined stoichiometric coefficients separately from reaction extent, limiting/excess-reactant accounting, and kinetics-owned timestep progress.
- Defined deterministic candidate-explosion controls: active-species filtering, reactive sites, family filters, local transformations, structural/conservation pruning, deduplication, caching, hard observable budgets, and maximum transformation depth.
- Added required representation/validation fixtures for H2, O2, H2O, CO, CO2, CH4, and NH3.
- Updated `docs/contracts/SIMULATION_CONTRACT.md` to reference and enforce the refined Phase 0 boundaries.

## In Progress
- PR #1 review/integration of the Phase 0 contract.

## Blockers / OPEN
- Final canonical molecular graph labeling/hash algorithm is not selected.
- Advanced valence treatment for aromatic, hypervalent, ionic, and coordination chemistry is OPEN.
- Oxidation-state inference algorithm is OPEN.
- Full proton/electron reservoir representation for electrochemistry is OPEN.
- Workstream 02 must define exact numeric units/semantics for thermodynamic driving-force, rate, activity, and equilibrium interfaces.
- Workstream 03 must define authoritative normalized element/bond/property data schemas and provenance/uncertainty metadata.

## Validation Evidence
- Document-level contract audit performed against `PROJECT.md`, `AGENTS.md`, `ROADMAP.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`, and the prior `docs/contracts/SIMULATION_CONTRACT.md` at main SHA `f6513bd6cefc7df5b16d1f678a4cf1b443859e94`.
- Branch comparison before status update: 2 commits ahead of the checked main, 0 behind; only contract documentation changed.
- No runtime/unit tests run because this task changed no production code.
- Contract-level verdict: PASS for requested Phase 0 structural boundaries; implementation and scientific validation remain OPEN.

## Next Actions
1. Review/merge PR #1 through workstream 07 after contract approval.
2. Route exact thermo/kinetics query-unit semantics to 02.
3. Route normalized element/property/reference-data contract to 03.
4. After contract integration, implement the minimal TypeScript molecular core in a separate focused task: graph primitives, derived formula/charge, structural validation, conservation, and deterministic identity baseline.
5. Hand the first implementation fixtures and candidate-budget diagnostics to 06 for scientific/regression/performance validation.

## Handoffs
- 02 — Thermodynamics & Kinetics: define exact thermo/kinetics numeric contracts; 01 only supplies structurally valid candidate/context queries.
- 03 — Chemistry Data & Validation: define normalized property records, units, provenance, conditions, uncertainty, and quality metadata.
- 06 — Simulation Validation Lab: prepare representation, conservation, determinism, randomized, negative, and candidate-count validation once implementation exists.
- 07 — Integration & GitHub: review/integrate PR #1 after contract approval.
