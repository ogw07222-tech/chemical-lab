# 07 — Integration & GitHub

- Owner: Lead Integration Developer / Repository Maintainer / GitHub Integration Engineer / CI / Deployment Coordinator
- Current phase: Phase 1 — Executable Foundation Integration
- Overall state: PHASE1_FOUNDATIONS_INTEGRATED / CONSOLIDATED_TESTS_PASS / UI_INTEGRATION_OPEN
- Last updated: 2026-09-11
- Last checked executable main SHA: `ca7c0e36722a6475cfe9eb72379a5a0c4f33a0bb`
- Consolidated validation branch: `integration/phase1-pr8-11-validation-20260911`
- PR #4: intentionally excluded from this integration batch; validation/fix owned separately by 05

## Current Objective
Maintain production integration integrity after merging the Phase 1 executable foundations while minimizing redundant GitHub Actions usage. Preserve specialist ownership and explicit adapter boundaries; do not redesign chemistry models for integration convenience.

## Completed
- Confirmed PR #3 Chemistry Data Contract was already integrated before this batch; starting production main was `122b8ffde306f077349eacfbf42eeafef0ebea5e`.
- Re-audited exact HEADs, mergeability, changed files, package/tsconfig coverage, and cross-PR file overlap for PR #8, #9, #10, and #11.
- Confirmed no direct `src/` or `tests/` path overlap between #8–#11. Each PR also updates only its own workstream status document.
- Confirmed current root `tsconfig.json` includes both `src` and `tests`; no Phase 1 PR requires an added npm dependency.
- Confirmed root `package.json` currently defines `typecheck` and `test`, but no `lint` or `build` script and no root `package-lock.json` is present.
- Created a temporary integration-only branch from starting main and composed exact audited heads in order #10 -> #9 -> #8 -> #11 using expected-head-protected staging merges.
- Consolidated pre-workflow integration commit: `5a1d5f4457038bb9e1ac3270cb7c37bbec6ad57b`.
- Added a branch-scoped one-shot validation workflow at `c5c93605742a396c0f19d3511388ed5b30646013`; it does not exist on production main.
- GitHub Actions run `34522254283` completed successfully with one dependency installation, repository typecheck, and the complete current Vitest suite.
- Merged production PR #10 Molecular Core using exact HEAD `e5c6044c1a9a5eda92d396b1e27a4276c3b47c61`; merge SHA `93e9b5e55b3375cd66f0a5f5d315098645747b33`.
- Merged production PR #9 Thermal State Primitives using exact HEAD `ecfef820d40b7fa7f01a95bf95c1d12da3a30195`; merge SHA `6589dc4f5043e205c70705b173d43a2c40fa945c`.
- Merged production PR #8 Gameplay Progression Runtime using exact HEAD `6d6cb32487e081e2b48a1e046f7f59c2c4f765f3`; merge SHA `0aff1d35485ff826ef954d08fbf0b5d26fe6b66c`.
- Merged production PR #11 Validation Harness using exact HEAD `fb0a348b17550bac452a7252a7a97debc7515246`; merge SHA `ca7c0e36722a6475cfe9eb72379a5a0c4f33a0bb`.
- Verified the final executable production tree SHA `17ab080ac8ee479cc5fe42bec03a3bb3549622b2` exactly equals the consolidated pre-workflow validation tree, so a redundant second full Actions run was not required.

## Consolidated Validation Evidence
- Install: PASS — `npm install --no-audit --no-fund`; 52 packages installed. `npm ci` was not applicable because the root repository has no lockfile.
- Typecheck: PASS — `npm run typecheck` / `tsc --noEmit`.
- Lint: OPEN / SKIPPED — no `lint` script exists in current root `package.json`.
- Tests: PASS — 4 files / 64 tests.
  - `tests/game/progression.test.ts`: 16 PASS.
  - `tests/thermal.test.ts`: 13 PASS.
  - `tests/molecular-core.test.ts`: 21 PASS.
  - `tests/validation.foundation.test.ts`: 14 PASS.
- Build: OPEN / SKIPPED — no `build` script exists in current root `package.json`; PR #4 UI was intentionally excluded.
- Browser smoke: NOT APPLICABLE to this batch because PR #4 UI remains outside production main.
- Scientific benchmark corpus: OPEN; no real benchmark execution was introduced or claimed.

## Phase 1 Integration Audit
- PR #10 Molecular Core: PASS for this foundation scope — `ElementProvider` dependency inversion retained; finite/NaN/Infinity amount validation, deterministic graph representation foundation, formula/net-charge derivation, conservation primitives, and no scientific property/reaction lookup hardcoding. Full production canonicalization, advanced valence/aromatic/coordination chemistry, and the concrete 03 adapter remain OPEN.
- PR #9 Thermal State Primitives: PASS for this foundation scope — heater energy adds, cooler energy is explicitly removed, reaction heat follows `Q = -ΔH * extent`, thermostat exchanges bounded explicit energy rather than overwriting temperature, temperature must remain > 0 K, total sensible heat capacity must be > 0, timestep behavior is deterministic, and energy ledger fields remain explicit. Latent heat/full phase equilibrium/EOS remain OPEN.
- PR #8 Gameplay Progression Runtime: PASS for this foundation scope — authoritative discovery occurs once, first discovery updates encyclopedia/inventory atomically, unlocked stock is unlimited at Game Layer only, every actual vessel addition must be finite and positive, Developer Mode bypass is isolated, Premium does not bypass discovery, and schema-versioned deterministic persistence is present.
- PR #11 Validation Harness: PASS for this foundation scope — PASS/FAIL/OPEN is separate from scientific model status, tolerances/acceptance policy are centralized, SI/finite validators exist, OPEN cases are excluded from eligible aggregation, manifest loading is behind an adapter boundary, and no fake real benchmark corpus/data is introduced.

## Integration Architecture
- SI remains authoritative at production boundaries.
- Vessel matter remains finite; unlimited stock exists only as Game Layer entitlement semantics.
- Molecular, thermal, progression, and validation foundations remain separate modules with no circular cross-import introduced by this batch.
- Shared-type unification was not forced. Future 03 -> 02 phase, 01 reaction event -> 02 thermal, 04 progression -> 05 UI, and production provider wiring should use explicit adapters/projections where appropriate.
- Phase transition remains distinct from chemical molecular-graph reaction semantics.
- No chemistry logic was moved into React and PR #4 was not modified in this batch.

## CI Strategy
Use targeted/local checks before pushes and reserve repository-level Actions for meaningful integrated checkpoints. The Phase 1 #8–#11 batch used one consolidated Actions run rather than four per-PR full runs. Once a canonical lockfile is available, prefer reproducible `npm ci`. Do not run randomized/scientific/performance suites until their runtime/corpus prerequisites exist.

## Blockers / OPEN
- PR #4 runnable UI integration and browser smoke remain separate work under 05/07 handoff.
- Root reproducible npm lockfile policy remains unresolved on current production main.
- Root lint/build scripts are not configured yet; these gates are OPEN rather than PASS.
- Scientific benchmark corpus and real-experiment execution remain OPEN.
- Full reaction candidate/product engine remains OPEN.
- Full phase equilibrium, latent heat, EOS/vapor-pressure behavior, detailed heat transfer, and production thermochemical property wiring remain OPEN.
- Production runtime adapters remain OPEN, including 03 data -> molecular/thermal providers, 01 reaction progress -> 02 thermal input, and 04 progression -> 05 UI provider projection.

## Next Actions
1. Receive the separately validated/fixed PR #4 result from 05 without changing its UI/chemistry ownership boundaries.
2. Re-audit PR #4 exact HEAD against the new Phase 1 production main and run its required UI build/browser gates before merge.
3. After UI integration, establish the canonical reproducible frontend/root install strategy and only the minimum path-filtered CI needed for ongoing development.
4. Continue the next parallel Phase 1 specialist batch for reaction/runtime adapters, thermo/phase capability expansion, benchmark corpus preparation, and production provider wiring under the relevant owner workstreams.

## Handoffs
- 00: arbitrate cross-system design questions only; no new chemistry/gameplay model was introduced by this integration.
- 01: continue molecular/reaction runtime beyond the merged #10 foundation and define production reaction-event adapter details.
- 02: continue thermal/phase implementation beyond #9, including latent heat/phase equilibrium/EOS when designed.
- 03: provide concrete SI-normalized provider adapters/data without coupling molecular core to concrete tables.
- 04: preserve merged progression authority and expose projection/provider boundaries for UI.
- 05: return PR #4 only after actual tests/build/browser smoke satisfy its gate.
- 06: build real benchmark corpus/runtime validation on top of #11; keep unsupported scientific capabilities OPEN.
