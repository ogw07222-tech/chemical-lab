# 07 — Integration & GitHub

- Owner: Lead Integration Developer / Repository Maintainer / GitHub Integration Engineer / CI / Deployment Coordinator
- Current phase: Phase 2 — Reaction Engine Integration Coordination
- Overall state: PHASE0_UI_AND_PHASE1_FOUNDATIONS_INTEGRATED / PHASE2_INPUTS_NOT_YET_SUBMITTED
- Last updated: 2026-09-11
- Last checked production main SHA: `901f812edad16b67c0382e1a30ce744f2e6cd234`
- Final validated Phase 0/1 executable tree SHA: `79e65d7c4689fab5e310e126c9be039081de2c39`

## Current Objective
Coordinate integration of the next reaction-engine batch without moving chemistry semantics into 07. Expected owner streams are 03 Chemistry Data Pack, 01 Reaction Candidate Engine, 02 Thermodynamic/Kinetic Evaluation, and 06 Reaction Validation Matrix. Integration order will be determined from actual imports/contracts when exact submitted branches/PRs exist.

## Completed — Phase 0/1 Baseline
- PR #3 Chemistry Data Contract is integrated on production main.
- PR #10 Molecular Core, PR #9 Thermal State Primitives, PR #8 Gameplay Progression Runtime, and PR #11 Validation Harness are integrated and were validated together.
- PR #4 runnable laboratory UI scaffold is integrated from exact validated HEAD `c1f2205d82754f810fc08ab9525dab7830f092ca` at merge commit `1678bcb5bcb041a485dd176701d2512aa8bc8ed8`.
- Final Phase 0/1 regression evidence covers `npm ci`, typecheck, lint, 73/73 tests, build, Chromium, and desktop/tablet/mobile browser smoke.
- Production architecture still preserves SI authority, finite vessel matter, Game Layer-only unlimited stock, simulation-owned phase, energy/controller-based thermal commands, validation/scientific-status separation, and no UI-side chemistry solving.

## Phase 2 Pre-Integration Audit — 2026-09-11
Starting production source of truth: `901f812edad16b67c0382e1a30ce744f2e6cd234`.

Repository recheck results:
- Open pull requests: none.
- Existing branches: only Phase 0/1, diagnostic, prior integration, and status branches are present; no submitted Phase 2 branch for 01/02/03/06 exists yet.
- No exact Phase 2 HEAD is therefore available for ancestry, mergeability, changed-file, API, circular-import, duplicated-type, package/tsconfig, test, or ownership audit.
- Existing main workstream status documents are stale relative to the requested Phase 2 parallel work: 01 and 02 still describe Phase 1 foundations, 03 still describes the already-integrated Phase 0 data contract, and 06 still describes the Phase 1 validation harness foundation.

### Current per-workstream integration status
- 03 Chemistry Data Pack: **OPEN / NOT SUBMITTED** — no Phase 2 branch/PR or exact HEAD exists. 03 remains constrained to data/provenance/provider work and must not decide reaction direction, kinetics, phase evolution, or products.
- 01 Reaction Candidate Engine: **OPEN / NOT SUBMITTED** — no Phase 2 branch/PR or exact HEAD exists. Future audit must confirm candidate generation/conservation/graph transformation does not reimplement thermodynamics or kinetics.
- 02 Thermodynamic/Kinetic Evaluation: **OPEN / NOT SUBMITTED** — no Phase 2 branch/PR or exact HEAD exists. Future audit must confirm it evaluates 01 candidates rather than duplicating graph-candidate generation.
- 06 Reaction Validation Matrix: **OPEN / NOT SUBMITTED** — no Phase 2 branch/PR or exact HEAD exists. Future audit must preserve validation-only ownership and forbid chemistry tuning or fabricated precision/data.

## Planned Integration Dependency Audit
Default candidate order remains:

`03 Data -> 01 Candidate Engine -> 02 Evaluation -> 06 Validation`

This is not yet an approved merge order. 07 will determine the actual order from submitted imports/contracts and may change it if the real dependency graph requires it.

For every submitted PR, 07 must recheck:
- exact HEAD and latest-main ancestry;
- base branch and mergeability;
- changed files and direct overlap;
- public API/type compatibility and duplicated incompatible types;
- circular imports;
- package.json / package-lock.json / tsconfig changes;
- repository tests and owner-specific tests;
- workstream status accuracy;
- scientific ownership boundary.

Hard blockers include conservation regression, interface divergence, nondeterministic candidate output, fabricated precision for missing data, duplicated reaction semantics across layers, Phase 1 regression, failing typecheck/tests/build, or invalid PASS/status claims.

## Planned Consolidated Validation
Once all merge-candidate HEADs exist, prefer one temporary integration branch from then-latest `main` and one dependency installation for:
- `npm ci`;
- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run build`;
- reaction-candidate tests;
- thermodynamic/kinetic evaluation tests;
- reaction validation-matrix tests.

Do not run one redundant full workflow per PR when one integrated checkpoint can prove cross-PR compatibility. Every production merge should use expected-head SHA protection where possible; a moved HEAD requires re-validation.

## Current Blocker
**BLOCKED FOR INTEGRATION INPUTS:** none of the four requested Phase 2 owner streams currently has a submitted GitHub branch/PR/exact HEAD. There is therefore no legitimate temporary integration branch composition or consolidated CI target yet. 07 will not manufacture domain implementations or treat stale Phase 1 branches as Phase 2 candidates.

## Next Actions
1. 03 submits the Chemistry Data Pack branch/PR and exact HEAD against current main.
2. 01 submits the Reaction Candidate Engine branch/PR and exact HEAD.
3. 02 submits the Thermodynamic/Kinetic Evaluation branch/PR and exact HEAD.
4. 06 submits the Reaction Validation Matrix branch/PR and exact HEAD.
5. After submissions exist, 07 performs the pre-integration audit, composes the temporary integration branch, runs the consolidated checkpoint, isolates failures by owner, and merges only validated exact HEADs.

## Handoffs
- 00: arbitrate only semantic conflicts that cross owner boundaries.
- 01: own reaction-site/candidate/graph-transform/conservation/stoichiometry semantics; do not implement thermo/kinetic scoring.
- 02: own thermodynamic/kinetic evaluation of candidate inputs; do not recreate candidate graph generation.
- 03: own sourced/normalized chemistry data and provider projections; do not decide reaction outcomes.
- 06: own validation matrix, invariants, regression and PASS/FAIL/OPEN reporting; do not tune production chemistry.
- 07: own branch/PR tracking, dependency ordering, temporary integration, CI/regression, conflict routing, expected-head-protected merges, and final main verification.
