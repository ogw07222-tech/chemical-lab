# 07 — Integration & GitHub

- Owner: Lead Integration Developer / Repository Maintainer / GitHub Integration Engineer / CI / Deployment Coordinator
- Current phase: Phase 1 — Executable Foundation Integration
- Overall state: PHASE0_UI_AND_PHASE1_FOUNDATIONS_INTEGRATED / FINAL_REGRESSION_PASS
- Last updated: 2026-09-11
- Last checked executable main SHA: `1678bcb5bcb041a485dd176701d2512aa8bc8ed8`
- Final validated executable tree SHA: `79e65d7c4689fab5e310e126c9be039081de2c39`

## Current Objective
Keep production integration deterministic after the validated Phase 0 UI scaffold and Phase 1 executable foundations are on `main`. Preserve specialist ownership and explicit provider/adapter boundaries; do not move chemistry, thermal physics, progression authority, or phase calculation into React for integration convenience.

## Completed — Phase 1 Foundations
- Confirmed PR #3 Chemistry Data Contract was integrated before the Phase 1 executable batch; starting production main for that batch was `122b8ffde306f077349eacfbf42eeafef0ebea5e`.
- Re-audited and integrated PR #10 Molecular Core, PR #9 Thermal State Primitives, PR #8 Gameplay Progression Runtime, and PR #11 Validation Harness in dependency order #10 -> #9 -> #8 -> #11.
- Used one consolidated integration branch and one repository-level Actions checkpoint rather than repeating full CI for all four PRs.
- Consolidated run `34522254283`: install PASS, typecheck PASS, 4 files / 64 tests PASS; lint/build were not yet configured in that pre-UI tree.
- Production merge SHAs:
  - PR #10 -> `93e9b5e55b3375cd66f0a5f5d315098645747b33`
  - PR #9 -> `6589dc4f5043e205c70705b173d43a2c40fa945c`
  - PR #8 -> `0aff1d35485ff826ef954d08fbf0b5d26fe6b66c`
  - PR #11 -> `ca7c0e36722a6475cfe9eb72379a5a0c4f33a0bb`
- Previous status-only merge advanced main to `27c32f93eb16d1061959bd02f8cf10bfe502b9f3` without changing executable code.

## Final PR #4 Integration
- Pre-merge latest `main`: `1c4037ece672cfe0612f111f0b5d63081ee1a735`.
- The two commits after `27c32f93eb16d1061959bd02f8cf10bfe502b9f3` only added and then reverted an accidental diagnostic workflow; their final tree remained `0daead8950d8d8023014ab84ce88d0a6107ac502`, identical to the prior production tree.
- PR #4 title: `feat(ui): runnable Phase 0 laboratory scaffold`.
- Exact validated PR HEAD: `c1f2205d82754f810fc08ab9525dab7830f092ca`.
- Rechecked before merge: PR open, base `main`, `mergeable=true`, exact HEAD unchanged.
- Validation run `34588525677` completed successfully on exact HEAD `c1f2205d82754f810fc08ab9525dab7830f092ca`.
- Merged PR #4 with expected-head SHA protection; merge SHA `1678bcb5bcb041a485dd176701d2512aa8bc8ed8`.
- Resulting production executable tree SHA `79e65d7c4689fab5e310e126c9be039081de2c39` exactly equals the validated PR #4 HEAD tree SHA. No product/source byte changed between validated tree and merged main tree.

## Final Main Regression Evidence
The final executable `main` tree is byte-identical to the tree tested by run `34588525677`, so the same tests were not rerun solely to reproduce identical evidence and consume additional Actions time.

Validated identical-tree evidence:
- `npm ci --no-audit --no-fund`: PASS.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- targeted UI `tests/ui/LaboratoryWorkspace.test.tsx`: 9/9 PASS.
- full `npm test`: 5 files / 73/73 PASS.
- `npm run build`: PASS.
- Chromium install: PASS.
- browser smoke: PASS at Desktop 1440x900, Tablet 1024x768, and Mobile 390x844.
- no blocking browser console/page errors.

Browser smoke coverage includes app load, starter inventory, finite AddSubstance, unlimited unlocked stock semantics, heater, cooler, thermostat request behavior without direct temperature teleport, Run/Pause, Phase view, unknown observation analysis, discovery, encyclopedia/inventory unlock, Developer Mode, responsive navigation, and overflow checks.

## Final Contract Audit
- Molecular/Data: PASS — molecular core and SI-normalized data schema are present; UI remains a provider/view-model consumer rather than a chemistry solver.
- Thermal: PASS — heater/cooler are power requests, thermostat is an explicit target/controller request, no `SetTemperature` command exists, and authoritative thermal physics remains outside React.
- Progression: PASS — starter access, one-time discovery, encyclopedia/inventory synchronization, unlimited unlocked Game Layer stock, finite vessel addition, and Developer Mode isolation remain intact.
- Phase: PASS — phase is supplied by provider/simulation state; no manual phase selector exists; the UI phase diagram is supplied-data rendering and the current mock diagram is explicitly marked non-scientific.
- Validation: PASS — PASS/FAIL/OPEN remains separate from scientific model status; integration did not alter canonical scientific acceptance thresholds.
- SI: PASS — authoritative UI/provider-facing implemented quantities remain K, Pa, m^3, mol, and W with display conversions centralized at the UI boundary.

## Integration Architecture
- SI remains authoritative at production boundaries.
- Vessel matter remains finite; unlimited stock exists only as Game Layer entitlement semantics.
- Molecular, thermal, progression, validation, data, and UI modules remain separated by provider/adapter boundaries.
- Phase transition remains distinct from chemical molecular-graph reaction semantics.
- The current UI provider is a mock integration surface. Real production data/thermal/reaction/progression adapters remain future work under their owner workstreams.

## Remaining OPEN Work
These are future capability work, not blockers to the completed PR #4 integration:
- scientific benchmark corpus and real-experiment execution;
- full reaction candidate/product runtime;
- full phase equilibrium, latent heat, EOS/vapor-pressure, detailed heat transfer, and production thermochemical property wiring;
- production adapters connecting 03 data providers, 01 reaction progress, 02 thermal/phase runtime, 04 progression authority, and 05 UI projections.

## Next Actions
1. Start the next parallel Phase 1 development batch only from the current integrated `main`.
2. Prioritize production adapter/runtime wiring without collapsing specialist ownership boundaries.
3. Add scientific benchmark corpus/runtime validation only when the corresponding chemistry capabilities exist.
4. Keep CI targeted and consolidated; avoid redundant identical-tree reruns.

## Handoffs
- 00: arbitrate cross-system design questions only.
- 01: continue reaction/runtime implementation and reaction-event adapter work.
- 02: continue thermal/phase capability expansion and authoritative adapters.
- 03: provide concrete SI-normalized production data providers.
- 04: preserve progression authority and expose provider projections.
- 05: PR #4 is integrated; continue UI only against production provider contracts.
- 06: build real scientific benchmark corpus/runtime validation on top of the merged validation harness.
