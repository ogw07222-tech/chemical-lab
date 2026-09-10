# 01 — Chemistry Simulation Engine

- Owner: Lead Chemistry Simulation Engine Developer / Molecular Graph Systems Developer / Reaction Solver Architect / Stoichiometry Engine Developer
- Current phase: Phase 1 — Molecular Core executable foundation
- Overall state: IN_PROGRESS
- Last updated: 2026-09-11
- Last checked main SHA: `567994693e56a7013cbcce0d95222a6cb98594af`
- Active branch: `feature/phase1-molecular-core`
- Active PR: #10 — `feat(sim): add Phase 1 molecular core foundation`
- PR #10 code HEAD before this status-only commit: `0ca067435f2f07aa107aaae8468a5de8fd777f1f`

## Current Objective
Implement the first executable TypeScript molecular core that safely and deterministically represents validated molecular graphs and finite vessel species without implementing the full reaction-candidate engine.

## Implemented Scope
- Added `src/simulation/molecular/types.ts` with `ElementDefinition`, `ElementProvider`, `AtomNode`, `BondEdge`, `MolecularGraph`, `MoleculeRecord`, `SpeciesState`, phase-state references, validation types, and conservation primitives.
- Kept SI field semantics explicit: atomic molar mass in kg/mol, amount in mol, concentration in mol/m^3; no UI-unit conversions are present in Simulation Core.
- Added dependency inversion through `ElementProvider`; PR #3 is still open/unmerged, so 01 has no compile-time dependency on 03 implementation types.
- Added molecular formula derivation and net formal-charge derivation.
- Added graph sanity validation for duplicate/empty atom and bond IDs, missing bond endpoints, self bonds, duplicate semantic bonds, unknown elements, invalid formal charge/radical metadata, and invalid/non-finite bond order.
- Added `createMoleculeRecord` and `validateMoleculeRecord` so derived formula/net charge and graph validity are checked before authoritative use.
- Added deterministic structural representation/key foundation that excludes runtime atom IDs, bond IDs, input ordering, phase, and vessel amount.
- Canonical search is explicitly bounded (`MAX_CANONICAL_SEARCH_STATES = 20_000`) so high-symmetry graphs fail explicitly rather than causing unbounded browser work.
- Added `validateSpeciesState` enforcing finite, non-negative `amountMol` and finite/non-negative optional SI concentration.
- Added `ConservationVector` / `ConservationDelta` primitives for element counts, total atoms, net charge, and optional explicit electron bookkeeping.
- No reaction lookup table, product hardcoding, thermodynamics, kinetics, phase calculation, UI, or gameplay logic was added.

## Tests Added
`tests/molecular-core.test.ts` covers:
- H2, O2, N2, H2O, CO, CO2, CH4, NH3 representation
- formula derivation
- net charge derivation
- invalid bond endpoint
- duplicate atom ID
- self bond
- negative amount
- NaN
- positive/negative Infinity
- valid finite amount
- deterministic identity under atom ID/order and bond ID/order changes
- element/atom/charge conservation delta
- explicit electron-bookkeeping extension

## Validation Performed
- Work began from main `c33f5e0bb6d30db63c4097edce30c4333a14b0c5`; main advanced during the task to `567994693e56a7013cbcce0d95222a6cb98594af`.
- The branch was merged forward onto `567994693e56a7013cbcce0d95222a6cb98594af` before final status recording; code HEAD before this status-only commit is `0ca067435f2f07aa107aaae8468a5de8fd777f1f`.
- Source TypeScript strict compile: PASS using available `tsc 5.8.3` against the same implementation source.
- Test TypeScript shape/type audit: PASS using strict compiler settings with a local minimal Vitest declaration because Vitest is not globally installed.
- Independent executable runtime harness over the same molecular-core implementation: PASS for the required MVP molecules, graph rejection cases, amount rejection, deterministic structural key, and conservation primitives.
- `npm test` / repository Vitest execution: OPEN. The current execution environment cannot resolve GitHub/npm hosts and has no global Vitest binary, so dependency installation and the actual repository test runner could not be executed here.

## PASS / FAIL / OPEN

### PASS
- Executable molecular graph/type foundation exists.
- Required H/C/N/O MVP molecule structures are representable.
- Formula and net-charge derivation are executable.
- Invalid endpoint, duplicate atom ID, self bond, invalid/negative/NaN/Infinity amount handling are implemented.
- Runtime atom/bond IDs and array ordering do not define molecular identity for the tested MVP graph class.
- Phase and vessel amount are excluded from canonical molecular identity.
- Conservation primitives support elements, atom count, charge, and optional electron bookkeeping.
- 03 compile-time dependency is avoided while PR #3 remains unmerged.

### FAIL
- None found in the implemented Phase 1 scope during the available compile/runtime harness validation.

### OPEN
- Actual `npm test`/Vitest execution in a dependency-enabled environment.
- Final production-grade canonical graph-labeling algorithm for larger, high-symmetry, aromatic, coordination, and isomer-rich graphs; current bounded implementation is an explicit Phase 1 foundation.
- Full chemistry-aware valence validation. Current graph sanity validation does not claim thermodynamic stability or complete valence chemistry.
- 03 adapter/provider implementation after PR #3 integration.
- Reaction candidates, atom mapping, graph transformations, stoichiometry, candidate pruning, and state-update solver remain future Phase 2 work.

## Next Actions
1. 06 runs the committed Vitest suite and adds randomized/property tests for graph validity, determinism, conservation, and canonical-search budget behavior.
2. After PR #3 integration, add a thin 03 -> `ElementProvider` adapter without changing the molecular-core dependency direction.
3. Refine canonical identity only when required by larger/isomer-rich chemistry; do not silently increase unbounded search.
4. Begin Phase 2 only after this molecular-core foundation is integrated and validated: reactive sites -> candidate generation -> atom mapping -> graph transformations -> conservation -> stoichiometry.

## Handoffs
- 02 — no thermodynamic/kinetic/phase computation dependency was introduced; future reaction candidate queries will consume 02 contracts only at the defined boundary.
- 03 — provide an adapter from normalized SI element/property records into `ElementProvider`; do not make 01 import provenance/storage implementation types directly.
- 06 — execute `tests/molecular-core.test.ts`, add randomized graph/order permutations and conservation tests, and validate bounded canonicalization performance/failure behavior.
- 07 — integrate PR #10 only after repository dependency-enabled typecheck/test verification and normal PR mergeability checks.
