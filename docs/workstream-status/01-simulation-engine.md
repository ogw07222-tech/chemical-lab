# 01 — Chemistry Simulation Engine

- Owner: Lead Chemistry Simulation Engine Developer / Molecular Graph Systems Developer / Reaction Solver Architect / Stoichiometry Engine Developer
- Current phase: Phase 2A — Generic Reaction Candidate Engine
- Overall state: IN_PROGRESS
- Last updated: 2026-09-11
- Source main SHA at task start: `901f812edad16b67c0382e1a30ce744f2e6cd234`
- Final synchronized main SHA before implementation commit: `a4606143e8f249e5b9a398f72c86c8171ca405b5`
- Active branch: `feature/phase2-reaction-candidate-engine`
- Active PR: #21 — `feat(sim): add Phase 2A generic reaction candidate engine`
- Implementation code HEAD before this status-only commit: `932f89c6d4032f9f3d9eaa33d8581b829cfdc1eb`

## Current Objective
Implement a bounded deterministic generic reaction-candidate engine that consumes the existing molecular core and produces conservation-valid structural candidates without reaction-equation lookup tables or thermodynamic/kinetic evaluation.

## Implemented Scope
- Reused the existing `AtomNode`, `BondEdge`, `MolecularGraph`, `MoleculeRecord`, `SpeciesState`, `ElementProvider`, canonical identity, validation, and conservation primitives; no duplicate chemistry-domain types were introduced.
- Added executable `ReactionCandidate` / `ReactionFamily` v1 contract and explicit 02 handoff metadata.
- Added deterministic reactive-site detection for formal charge, hetero atoms, coarse under-coordination, polarized bonds when electronegativity exists, proton donor/acceptor hints, electron-rich/electron-poor hints, and breakable bonds.
- Added coarse over-coordination rejection using provider-supplied `typicalValences`; positive-charge valence allowance is deliberately limited to elements with five or more valence electrons so H/C are not silently granted extra valence.
- Added immutable/copy-based graph transformations: bond add/remove/order change, graph merge/split, proton transfer, electron-transfer charge bookkeeping.
- Added candidate generators for `BOND_FORMATION`, `BOND_CLEAVAGE`, `PROTON_TRANSFER`, and `ELECTRON_TRANSFER`.
- Added family vocabulary for `ASSOCIATION`, `DISSOCIATION`, `SUBSTITUTION_GENERIC`, `COMBINATION`, and `DECOMPOSITION` without implementing reaction-specific lookup entries.
- Added hard conservation gate for element count, atom count, net charge, and optional explicit-electron bookkeeping before candidates can be returned to 02.
- Added deterministic candidate IDs/order, structural no-op elimination, structural deduplication, per-family caps, total cap, site caps, solid contact eligibility, and bounded pruning-reason samples.
- Candidate structural dedup identity includes authoritative Species/phase-state identity so same molecular structure in different phase states is not incorrectly collapsed.
- Added `docs/contracts/REACTION_CANDIDATE_V1.md` documenting executable guarantees and 02 handoff.

## Changed Files
- `src/simulation/reaction/types.ts`
- `src/simulation/reaction/analysis.ts`
- `src/simulation/reaction/transforms.ts`
- `src/simulation/reaction/engine.ts`
- `src/simulation/reaction/index.ts`
- `tests/reaction-candidate.test.ts`
- `docs/contracts/REACTION_CANDIDATE_V1.md`
- `docs/workstream-status/01-simulation-engine.md`

## Tests Added
- H2, O2, N2, H2O, CO, CO2, CH4, NH3 reactive-site/coarse-valence fixtures
- explicit charged-fragment/H+ compatible structures
- reactive-site determinism
- immutable add/remove bond primitives
- proton-transfer primitive
- candidate ID/order determinism
- conservation for every emitted candidate
- structural duplicate elimination
- structural no-op elimination check
- candidate family/total caps
- invalid graph rejection before candidate generation
- bounded candidate count over the MVP species set

## Validation Performed
- Local network clone / `npm ci`: BLOCKED in the execution environment because `github.com` DNS resolution failed.
- Exact new TypeScript source + strict repository-compatible compiler settings: PASS using available `tsc 5.8.3`.
- New Vitest source type/shape audit: PASS with a minimal local Vitest declaration because Vitest is not installed globally.
- Independent executable runtime harness over the same new reaction-engine source: PASS for water/ammonia generic proton-transfer candidate generation, deterministic ordering, duplicate pruning, and conservation.
- `npm run lint`: OPEN locally; ESLint is not globally installed and dependencies cannot be installed in this environment.
- `npm test`: OPEN locally; Vitest is not globally installed and dependencies cannot be installed in this environment.
- `npm run build`: OPEN locally; Vite is not globally installed and dependencies cannot be installed in this environment.

## PASS / FAIL / OPEN

### PASS
- Generic graph-derived candidate infrastructure exists without a stored reaction database.
- Existing molecular core types and conservation utilities are reused.
- Reactive-site detection is deterministic.
- Candidate transformations are copy-based and do not mutate vessel state.
- Every emitted candidate passes graph/coarse-valence sanity and conservation gates.
- Candidate generation is bounded and deterministic with explicit pruning diagnostics.
- 02 has a clean structurally validated handoff contract.

### FAIL
- None identified in the locally executable Phase 2A scope.

### OPEN
- Repository-native `npm ci`, lint, Vitest, and production build in a dependency-enabled environment.
- Full chemistry-aware valence, resonance/aromaticity, coordination, radical, stereochemical, implicit-H, hypervalent, solvent, and surface chemistry.
- `SUBSTITUTION_GENERIC` and higher semantic family generators.
- External electron/electrode reservoir bookkeeping.
- Thermodynamic/kinetic ranking and rejection by 02.
- Reaction extent / state mutation / competition resolution.
- 06 randomized/property/performance validation against candidate explosion and graph permutations.

## 02 Handoff
02 may consume emitted candidate IDs, family, reactant refs, validated product graphs, atom mapping, bond/charge changes, proton/electron metadata, stoichiometric coefficients, structural confidence, assumptions, rule ID, phase-bearing SpeciesState refs, and `conservation.valid === true`.

02 must independently evaluate thermodynamic direction, reaction enthalpy/free energy, activation/rate behavior, equilibrium, phase/rate corrections, and later competing-candidate resolution. `structuralConfidence` is not a thermodynamic or kinetic probability.

## 03 Handoff
01 only consumes `ElementProvider` fields already defined by the molecular core. Electronegativity and typical-valence data improve reactive-site detection, but authoritative values/provenance remain 03-owned.

## 06 Handoff
Run repository-native tests plus randomized graph-order/atom-ID permutations, conservation property tests, candidate-cap stress tests, duplicate/no-op checks, invalid/coarse-overvalence cases, and browser-relevant candidate-count/performance measurements.

## Next Actions
1. Run dependency-enabled repository validation for PR #21.
2. 06 validates determinism, conservation, candidate bounds, and randomized graph transformations.
3. 02 consumes `REACTION_CANDIDATE_V1.md` and defines/evaluates thermo/kinetics result interfaces without moving physical evaluation into 01.
4. After validation, refine generic substitution/bond-order transformations and atom mapping only where scientifically justified; do not add reaction lookup tables.
