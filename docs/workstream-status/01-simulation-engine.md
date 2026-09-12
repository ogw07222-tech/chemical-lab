# 01 — Chemistry Simulation Engine

- Owner: Lead Chemistry Simulation Engine Developer / Reaction Solver Architect / Stoichiometry Engine Developer
- Current phase: Phase 3B — Reversible Pair Arbitration Wiring
- Overall state: PASS — executable wiring validated / independent 06 validation pending
- Last updated: 2026-09-12
- Latest production main checked at task start: `e49b3f25eeb39d08a6c397c4869beceb6c5c8bbf`
- Active branch: `feature/phase3b-reversible-pair-arbitration`
- Upstream dependency: PR #51 — `feat(02): add Phase 3B equilibrium thermodynamics foundation`
- PR #51 source HEAD used as branch ancestry: `116cfa30192556b3236f4f2814000ad971361bac`
- PR #51 validated executable/test HEAD: `5fcc62a05189ad7759596892ae30ab2a5b829998`
- Exact 01 executable/test HEAD validated: `888eb99b0a2e11988db63866505eabf9f9eb6026`
- Validation workflow run: `34683568587` — SUCCESS

## Objective
Wire PR #51's authoritative Phase 3B equilibrium progression recommendation into the existing Phase 3A timestep/network execution so an explicitly paired forward/reverse process has one deterministic coarse net direction per determinate timestep, approaches equilibrium with 02-owned damping/crossing limits, and never receives invented Q/K/deltaG/rate physics from 01.

## Source of Truth / Dependency
This branch is intentionally stacked directly on exact PR #51 HEAD `116cfa30192556b3236f4f2814000ad971361bac` because the 01 implementation consumes new 02 runtime types/functions that are not yet on production main.

The consumed 02 authorities are:
- `evaluateReactionEquilibrium()`;
- `recommendEquilibriumProgression()`;
- `EquilibriumProgressionRecommendation` including mode, drivingStrength, maxNetProgressFraction, preventEquilibriumCrossing, optional maxExtentTowardEquilibriumMol, scientific status, and reason codes.

01 does not copy or recompute PR #51's Q/K, ln(Q/K), equilibrium direction, near-equilibrium policy, driving-strength mapping, or crossing-search logic.

## Architecture
Phase 3B preserves the existing Phase 3A authoritative timestep pipeline:

1. immutable `snapshot(N)`;
2. candidate generation;
3. 02 thermo/kinetic evaluation;
4. explicit reversible-pair arbitration;
5. existing deterministic competing-reaction/shared-reactant resolution;
6. bounded extent commit;
7. Dynamic Species Registry/product commit;
8. vessel mutation;
9. existing aggregate-once thermal coupling;
10. factual event/provider projection;
11. committed `state(N+1)` becomes the next timestep source.

No second equilibrium solver and no persistent reaction-network authority are introduced.

## Explicit Pair Identity
`ReactionCandidate` now supports optional execution metadata:
- `reversible.pairId`;
- `reversible.direction: FORWARD | REVERSE`.

Only this explicit metadata creates an arbitration pair. Pair membership is never inferred from formula, candidate name/id, graph similarity, reaction family, or reactant/product resemblance.

Once explicitly paired, 01 validates represented forward-product/opposite-reactant structural identity before constructing the 02 equilibrium view. This is pair validation, not pair discovery.

## Pair Arbitration
`src/integration/phase3b-reversible-arbitration.ts` directly consumes PR #51.

### FORWARD
- forward remains the only net pair channel eligible for ordinary competition;
- reverse is suppressed as a separate net channel;
- only an already-numeric 02 kinetic request is multiplied by PR #51 `drivingStrength`;
- request is bounded by `maxNetProgressFraction` and optional `maxExtentTowardEquilibriumMol`;
- existing 01 stoichiometric, per-step, finite-matter and shared-reactant bounds remain authoritative afterward.

### REVERSE
Symmetric to FORWARD.

### NEAR_EQUILIBRIUM
Both pair channels are suppressed from coarse net mutation. There is no composition snap and no claim that microscopic directional rates are zero.

### INDETERMINATE
Phase 3B arbitration deliberately installs **no controls**:
- no channel suppression;
- no equilibrium multiplier/cap;
- no Phase 3B bias or boost.

Independently supported Phase 3A kinetics therefore continue through the pre-existing resolver. This is an explicit scientific abstention and makes no equilibrium-direction claim.

## Kinetic Request Boundary
`ReactionCandidateExtentControl` was added as an execution-only resolver boundary.

Order is:
1. existing 02 kinetics must first produce a numeric request (`DIMENSIONED_RATE` or supported relative-rate bridge);
2. OPEN/qualitative-only kinetics remain non-numeric and are deferred by existing rules;
3. only then does 01 apply PR #51 `drivingStrength`;
4. apply PR #51 net-fraction/crossing caps;
5. apply existing per-step safety and stoichiometric bounds;
6. enter unchanged shared-reactant allocation.

Equilibrium driving can therefore never fabricate a numeric extent from missing kinetics.

## Anti-Overshoot / No Ping-Pong
01 supplies PR #51 only a stoichiometric maximum and a pure projected-composition callback. PR #51 computes the authoritative anti-crossing recommendation.

When `maxExtentTowardEquilibriumMol` is present, 01 enforces it as a hard request ceiling. No extra 01 hysteresis, deadband, damping curve, or equilibrium tolerance is added.

Repeated high-driving tests show deterministic approach without persistent forward/reverse ping-pong.

## No Double Counting / Shared Reactants
For a determinate explicit pair, at most one net direction can enter normal competition in a timestep. The suppressed opposite channel cannot consume matter, emit a committed progress event, or contribute reaction heat.

The surviving request then enters the existing equal-rank/shared-pool allocator together with unrelated reactions. Existing candidate-id-first capture prevention and finite shared-reactant scaling are unchanged.

## Dynamic Species / Same-Step Semantics
Dynamic Species Registry authority and transactionality remain unchanged.

If one pair reactant SpeciesId is absent from the start-of-step snapshot, Phase 3B does not prematurely interpret that future species. Existing resolution then enforces `ZERO_INITIAL_REACTANT`, preserving the no-same-step-cascade rule.

A generated product committed at timestep N can participate from N+1.

Generated registry species initially have unknown/OPEN phase. Until phase/equilibrium data are resolved, 02 may return INDETERMINATE; Phase 3B correctly follows its abstention path rather than fabricating direction.

## Thermal
The arbitration layer does not calculate reaction heat.

The selected candidate/evaluation identity is preserved so 02 forward/reverse deltaH sign semantics remain intact. Existing aggregate thermal coupling applies known committed heat exactly once per timestep.

## Event / Provider Contract
`ReactionProgressEvent` remains backward compatible and may add:
- `reversiblePairId`;
- `channelDirection`;
- `equilibriumDirection`;
- `equilibriumScientificStatus`;
- optional `equilibriumDrivingStrength`;
- optional `lnQOverK`;
- optional `reactionQuotientQ`;
- optional `equilibriumConstantK`.

Phase 3B provider projection additionally exposes pair-level recommendation facts including net-fraction/crossing bounds and 02 reason codes.

05 must consume these supplied facts rather than deriving equilibrium direction itself. Existing `speciesRef` remains opaque; player-facing name/formula/graph knowledge still follows 04/05 boundaries.

## Files Changed in 01 Stack
- `src/simulation/reaction/types.ts` — explicit reversible pair execution metadata.
- `src/simulation/reaction-progression/types.ts` — extent-control/event metadata contracts.
- `src/simulation/reaction-progression/resolver.ts` — apply 02 pair controls after numeric kinetics and before normal competition.
- `src/integration/phase3b-reversible-arbitration.ts` — PR #51 consumer, pair arbitration and Phase 3A network wiring.
- `src/integration/index.ts` — public Phase 3B integration export.
- `tests/phase3b-reversible-arbitration.test.ts` — Phase 3B execution matrix.
- `docs/contracts/PHASE3B_REVERSIBLE_PAIR_ARBITRATION.md` — execution/provider contract.
- `docs/workstream-status/01-simulation-engine.md` — this status.

## Validation Evidence
Exact executable/test HEAD: `888eb99b0a2e11988db63866505eabf9f9eb6026`

GitHub Actions run `34683568587`: **SUCCESS**.

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS — 0 errors; one inherited `src/ui/provider.tsx` hook-dependency warning only
- targeted stack: **8 files / 99 tests PASS**
  - Phase 3B reversible arbitration: 16/16
  - Phase 3B equilibrium progression: 13/13
  - Phase 3B equilibrium: 15/15
  - reaction progression: 10/10
  - Phase 3A network: 11/11
  - Phase 3A kinetics/thermal: 10/10
  - thermal: 13/13
  - Dynamic Species Registry: 11/11
- full `npm test`: **22 files / 261 tests PASS**
- `npm run build`: PASS

The exact validated HEAD printed by the workflow was `888eb99b0a2e11988db63866505eabf9f9eb6026`.

## Test Matrix Result
PASS:
- mostly-reactant forward selection;
- mostly-product reverse selection;
- near-equilibrium zero coarse net mutation/no snap;
- repeated approach with shrinking extent;
- PR #51 anti-crossing extent enforcement;
- no persistent ping-pong;
- candidate/evaluation permutation determinism;
- determinate forward/reverse no double commit or duplicate heat;
- shared reactant with unrelated reaction;
- INDETERMINATE/OPEN exact abstention;
- OPEN kinetics no fabricated numeric extent;
- forward exothermic/reverse endothermic heat-sign path;
- generated species participation on later timestep;
- same-step generated-species cascade remains prohibited;
- deterministic replay;
- dt vs dt/2 finite/non-negative timestep-sensitivity guard.

## PASS / FAIL / OPEN
### PASS
- Explicit reversible pair grouping only.
- Direct use of PR #51 equilibrium/progression authority.
- No duplicated Q/K/deltaG or damping logic in 01.
- Determinate single-net-channel arbitration before ordinary competition.
- PR #51 driving/crossing bounds composed with existing kinetic requests.
- No numeric extent fabrication from OPEN/qualitative kinetics.
- Near-equilibrium zero coarse net mutation without state snap.
- INDETERMINATE scientific abstention.
- Existing shared-reactant fairness/finite matter/conservation path preserved.
- No forward/reverse double-consumption or duplicate heat in determinate modes.
- Same-step generated-product cascade prevention preserved.
- Dynamic Species Registry atomicity/stable identity path preserved.
- Deterministic replay/candidate-permutation behavior.
- Full repository regression/build at exact executable HEAD.

### FAIL
- None identified in the implemented/validated 01 scope.

### OPEN
- Independent 06 validation is mandatory before integration/merge.
- PR #51 remains a stacked upstream dependency until its exact contract lands on main.
- General non-ideal activities, mixture equilibrium and broader phase fidelity remain 02/03 responsibilities.
- Generated unknown-phase species may remain equilibrium-INDETERMINATE until phase re-resolution supplies adequate evidence.
- INDETERMINATE permits independently supported Phase 3A channels and therefore carries no pair-level net-equilibrium guarantee.
- Multi-pair coupled equilibrium, stiff integration, transport limitation, electrochemistry and a general equilibrium solver remain out of scope.

## Handoffs
- 02: PR #51 remains authoritative for equilibrium thermodynamics/progression recommendation and future activity/phase fidelity.
- 05: consume Phase 3B provider direction/status/diagnostics; do not calculate Q/K/direction or expose opaque internal species identity as player knowledge.
- 06: independently validate exact 01 Phase 3B HEAD/PR for direction, anti-crossing, no-ping-pong, no-double-counting, candidate permutation, shared reactants, OPEN abstention, generated-species semantics, conservation and thermal consistency.
- 07: do not integrate this stack until 06 approves it. After PR #51 lands, refresh/retarget the 01 PR onto current main without changing validated semantics.

## Next
**06 independent Phase 3B reversible arbitration validation, then 07 integration after PR #51 dependency is integrated.**
