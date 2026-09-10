# 07 — Integration & GitHub

- Owner: Lead Integration Developer / Repository Maintainer / GitHub Integration Engineer / CI / Deployment Coordinator
- Current phase: Phase 0 — Architecture / Integration
- Overall state: IN_PROGRESS
- Last updated: 2026-09-11
- Last checked main SHA: ca48dbdd8bfd21a4a3448ef7ba0767d3c44f65e1
- Active branch: docs/07-phase0-integration-status
- Active PRs remaining from Phase 0 batch: #3, #4

## Current Objective
Integrate the Phase 0 contracts and runnable UI scaffold without bypassing runtime verification gates or changing chemistry/gameplay design.

## Completed
- Audited latest production `main`, PR #1–#6 HEADs/diffs, repository structure, required canonical contracts, workstream statuses, package scripts, and available GitHub CI evidence.
- Confirmed target PRs have no direct changed-file overlap; integration risk is primarily semantic/interface dependency rather than textual merge conflict.
- Integrated PR #1 Molecular / Reaction Core at merge commit `0f905cf5c5be7044f4a7de9d37556b77aed69f52` using expected-head protection.
- Integrated PR #5 Thermodynamics / Phase / Thermal Contract at merge commit `2d580b576ff6e7c3627a74ba2d3565ca534b4b77` after GitHub REST recomputed it as mergeable/clean.
- Integrated PR #6 Laboratory Gameplay Alignment at merge commit `62879c3d12fa61c91e8b70d037f563130d2c22eb` after mergeability recheck.
- Integrated PR #2 Validation Architecture at merge commit `ca48dbdd8bfd21a4a3448ef7ba0767d3c44f65e1` after mergeability recheck.
- Kept PR #3 unmerged because it adds TypeScript schema code and neither local full repository typecheck nor PR Actions evidence is available.
- Kept PR #4 unmerged because install/typecheck/lint/tests/build/browser smoke remain unexecuted in an environment with package/network access.
- Fixed one PR #4 UI boundary issue on its branch: undiscovered `confirmedSpeciesId` was removed from the UI-facing `UnknownObservation` snapshot and moved to a mock-provider-private resolver map. Current PR #4 HEAD after this fix is `90de7f176153076fdb366b22275375e45b72753b`.

## Integration Audit
- SI authoritative internal units: PASS at contract/interface audit level.
- Inventory/progression: PASS at contract/interface audit level — unlocked stock unlimited, vessel additions finite, one normal game, Developer Mode only all-access bypass, Premium non-authoritative.
- Phase ownership: PASS at contract/interface audit level — simulation-owned, no manual phase selector, phase transitions remain distinct from molecular graph reactions.
- Thermal semantics: PASS at contract/interface audit level — heater/cooler/thermostat are energy/power based; no direct temperature overwrite; reaction heat is retained in the energy ledger.
- Scientific status enum: PASS for canonical values `VERIFIED`, `APPROXIMATED`, `EMPIRICAL`, `GAMEPLAY_SIMPLIFICATION`, `OPEN`.
- Benchmark threshold authority: PASS — `docs/contracts/REAL_EXPERIMENT_VALIDATION.md` remains canonical and PR #2 does not redefine thresholds.
- Benchmark schema/runtime loader: OPEN — PR #3 schema and PR #2 loader architecture are semantically compatible, but no production loader/corpus/runtime execution exists yet.
- Phase type reconciliation: OPEN for implementation wiring — 01/03/04/05 expose richer lower-case phase values while 02 Phase 0 `BulkPhase` is intentionally narrower/upper-case. Use an explicit adapter at the boundary; do not force a shared package during Phase 0.
- ReactionProgressEvent -> thermal coupling: PASS at contract level for SI extent/time/sign coupling; stable production event/reaction version identity remains OPEN for implementation/replay hardening.
- UI provider boundary: PASS after the PR #4 identity-leak fix at source-audit level; runtime verification remains OPEN.

## Validation Evidence
- GitHub Actions workflows are not configured on current main.
- PR #3 HEAD had no pull-request workflow runs; its own status correctly leaves full TypeScript typecheck OPEN.
- PR #4 HEAD before/after integration fix has no runtime verification evidence available from this environment.
- Local GitHub checkout/package installation was blocked by external DNS resolution, so no false PASS is claimed.
- Typecheck: OPEN.
- Lint: OPEN.
- Unit/component tests: OPEN.
- Production build: OPEN.
- Browser smoke/responsive checks: OPEN.
- Scientific runtime benchmarks: OPEN; production chemistry runtime/corpus is not yet present.

## CI Strategy
For Phase 0, avoid adding or rerunning broad scientific workflows before runtime implementations and benchmark corpus exist. When #3/#4 are ready for a network-enabled checkpoint, use one consolidated verification path in this order: typecheck -> lint -> unit/component tests -> production build -> browser smoke. Prefer `npm ci` once a lockfile is committed; skip docs-only CI via path filters; reserve randomized/scientific benchmark suites for later runtime milestones.

## Blockers / OPEN
- PR #3 requires an actual repository TypeScript typecheck before production integration.
- PR #4 requires dependency installation, typecheck, lint, unit/component tests, production build, and browser/console responsive smoke before production integration.
- PR #4 currently has no package lockfile, so reproducible dependency installation policy should be resolved as part of its verification checkpoint.
- PR #4 thermostat command shape is a UI-provider adapter command, while gameplay defines Enable/Set/Disable thermostat commands; production wiring must use an explicit adapter rather than couple React directly to gameplay implementation types.
- Exact pressure/EOS ownership, apparatus heat capacity ownership, latent-heat fidelity tier, and production reaction/phase update orchestration remain design/implementation OPEN items owned by their designated workstreams/HQ.

## Next Actions
1. In a network-enabled local/Codespaces environment, verify PR #3 with repository typecheck; merge only if the audited HEAD is unchanged or re-audited.
2. Refresh PR #4 against the integrated main, generate/commit a reproducible lockfile if adopted, then run install/typecheck/lint/tests/build once as a bundled checkpoint.
3. Run browser smoke for app load, console errors, inventory finite addition, heater/cooler, thermostat, Phase tab, discovery, Developer Mode, and desktop/tablet/mobile layouts.
4. If #4 passes, recheck its exact HEAD/mergeability and merge with expected-head protection.
5. After #3/#4 integration, run one final main regression and only then introduce the minimal path-filtered CI workflow needed for continuing implementation.

## Handoffs
- 00: arbitrate only remaining cross-system design OPEN items; no redesign was introduced by 07.
- 03: obtain compile evidence for PR #3 and keep schema/data provenance semantics stable.
- 05: obtain real runtime/browser evidence for PR #4; preserve provider/adaptor boundary and the fixed unknown-identity gating.
- 06: keep scientific runtime verdict OPEN until production implementations and benchmark corpus are executable.
