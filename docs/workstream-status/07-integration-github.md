# 07 — Integration & GitHub

- Owner: Lead Integration Developer / Repository Maintainer / GitHub Integration Engineer / CI / Deployment Coordinator
- Current phase: Unified Phase 4A + UI production integration
- Overall state: PASS — UNIFIED_INTEGRATION_PASS
- Last updated: 2026-09-20

## Source of Truth
- Starting production main: `28b85072ada9865d76d3e7874f926490558a198c`
- Integration branch: `integration/phase4a-ui-stack`
- Required feature order: #64 -> #66 -> #67 -> #68
- No individual feature PR was merged to main before unified integration.

Validated production feature HEADs:
- #64 Phase 3B Equilibrium Visualization: `c54ca1c0a6bf88d2e22add78b8b874bd1ffea85a`
- #66 Particle-Based Matter Visualization: `e1b7319bc4d80c47047ab82dd8485a029d34560c`
- #67 Phase 4A-2 Gas Transport: `18742befcc480eb0ee6de1ae1f72ffda0f3a8672`
- #68 Phase 4A-3 Thermal Apparatus: `63e7d36a8c7a51f254429b1fed2e5d02ec3b5398`

Independent validation evidence:
- #64: validation HEAD `17c854007a967cfc9496e813ae6d1dfb80d95237`, run `35496308861` — SUCCESS
- #66: validation HEAD `11c63ed5f5838722105387ebad883ec0b55fdad0`, run `34748701565` — SUCCESS
- #67: validation HEAD `892e5fb6610c338f3bee8cde112904464ba2a071`, run `35496274953` — SUCCESS
- #68: validation HEAD `b0cc9fc1665525b61986421647b3cf17da85c303`, run `35496142811` — SUCCESS

For all four features, the independent validation branch was the exact current feature HEAD plus validation-only workflow/tests/tools. No unvalidated production semantic delta was found.

## Integration Assembly
### #64
Staged first through temporary integration PR #69 and merged into the integration branch at:
`813dbb933cecfd29cfb3baf56ddeb8c1bee2ebb4`.

Preserved:
- equilibrium inline status;
- equilibrium details tab/panel;
- developer diagnostics;
- player privacy boundary;
- provider-projected equilibrium facts only.

### #66
The temporary staging PR #70 exposed the expected three-file conflict with #64:
- `src/ui/App.tsx`
- `src/ui/reactionProjection.ts`
- `src/ui/types.ts`

07 resolved this manually and mechanically:
- kept all #64 equilibrium UI/projection/DTO behavior;
- added the exact #66 particle renderer, model, CSS, and tests;
- added `MatterParticleCanvas` to the existing Workbench vessel;
- added player-safe deterministic `visualizationKey` to Phase 3A/3B composition projection;
- retained equilibrium DTOs and diagnostics.

No particle density, palette, motion, cap, or physics policy was retuned.

### #67
Staged through temporary integration PR #71 and merged into the integration branch at:
`cbc8c3744a6697dbc8af07bf5030ebdcb594abb7`.

The branch-only `.github/workflows/phase4a2-fix-validation.yml` was intentionally removed from the final integration surface. Gas transport executable/test files remain the independently validated #67 versions.

### #68
Temporary staging PR #72 conflicted only in:
`docs/workstream-status/02-thermodynamics-kinetics.md`.

There was no executable overlap with #67. All #68 thermal executable/test/contract files were copied byte-for-byte from the validated PR HEAD. The shared 02 status file was reconciled to record both Phase 4A-2 and Phase 4A-3 rather than dropping either feature.

No thermal formulas, target envelope, conservation policy, ID validation, or timestep behavior were modified by 07.

## Architecture Gates
### UI
- equilibrium UI and particle Canvas coexist in the same Workbench: PASS
- Reaction Activity / Timeline preserved: PASS
- existing 05A/05B/05D Workbench and apparatus accessibility preserved: PASS
- no React-side equilibrium, pressure, transport, phase, heat, density, or molecular-identity calculation added: PASS
- unknown/generated species privacy and player-safe visualization key preserved: PASS

### Simulation
- Phase 4A-1 remains sole matter-mutation / atomic transfer authority: PASS
- gas solver consumes explicit authoritative temperature and returns transfer requests: PASS
- gas solver does not integrate thermal evolution: PASS
- thermal apparatus does not directly mutate gas inventory: PASS
- no duplicate pressure/temperature authority introduced: PASS
- production cross-module timestep/orchestration wiring remains OPEN; 07 did not invent a new orchestrator.

## Unified Validation
Temporary workflow:
`.github/workflows/07-unified-phase4a-ui-validation.yml`

Exact green tested integration HEAD:
`7c37d706e5286805efbf41c3abb14f1832a4bc3c`

Run:
`35497520622` — SUCCESS

Results:
- install: PASS
- typecheck: PASS
- lint: PASS — 0 errors; one inherited non-blocking `src/ui/provider.tsx` hooks warning
- UI coexistence/static authority gate: PASS
- targeted UI stack: **7 files / 68 tests PASS**
- imported 06C + 06B independent adversarial regression: **4 files / 20 tests PASS**
- Phase 4A stack: **6 files / 114 tests PASS**
- Phase 3 + registry: **8 files / 94 tests PASS**
- gas/thermal authority-separation static gate: PASS
- full suite with imported validation-only tests: **37 files / 429 tests PASS**
- production build: PASS
- repository browser smoke: PASS
  - desktop 1536x900
  - desktop 1440x900
  - tablet 1024x768
  - mobile 390x844
- 06C particle browser smoke: PASS
- exact tested SHA recorded by workflow: `7c37d706e5286805efbf41c3abb14f1832a4bc3c`

The validation-only 06C/06B tests and browser fixture/tool were fetched into the runner workspace only; they were not committed to production.

The temporary unified workflow was removed after the successful run. Final integration HEAD differs from the green executable tree only by validation-workflow removal and status documentation.

## Preserved Scientific / UI Contracts
### PR #64
- equilibrium presentation consumes provider facts;
- no UI Q/K/ln(Q/K)/DeltaG/reaction-extent inference;
- OPEN evidence remains honest;
- no raw pair/candidate/species IDs leak into Normal Mode.

### PR #66
- particles are representative, never one particle per molecule;
- deterministic color / same species color across phases;
- GAS < LIQUID < SOLID visual density;
- microscopic point scale and vessel hard cap remain feature-owned and unchanged;
- deterministic seeded initialization;
- reduced-motion behavior and offscreen pause preserved;
- player-safe unknown identity;
- no transport or chemistry inference.

### PR #67
- diagnostics/final-request consistency;
- bulk + diffusion combined stability;
- large-dt no-crossing behavior;
- directed GAS topology;
- sealed/open routing;
- matter conservation;
- deterministic proportional normalization.

### PR #68
- multi-actuator target envelope;
- targetTemperature semantics;
- duplicate ID rejection;
- finite-body conservation;
- reaction heat preservation;
- large-dt stability;
- positive Kelvin;
- deterministic ordering.

## Validation Artifact Cleanup
- original validation branches remain evidence and are not merged wholesale;
- #67 branch-only feature validation workflow removed from integration output;
- 07 unified integration workflow removed after green run;
- imported independent validation tests/tools were runner-only.

## Known OPEN
- authoritative runtime orchestration ordering between gas transport and thermal apparatus remains a separate architecture/runtime task;
- provider wiring for future Phase 4A-2 transport visualization remains separate;
- no automatic Vercel deployment is permitted.

## Vercel Policy
Root `vercel.json` must remain:
`git.deploymentEnabled = false`.

07 did not request or perform a Vercel production deployment.

## Final Integration Gate
**PASS — unified Phase 4A transport, thermal, equilibrium UI, and particle UI stack validated on the integration branch.**

Integration PR #73 was merged to main with exact-head protection at `b6c41af3134dd60b6705d339ad1fd28c1547b32f`.

Production merge SHA: `45b78c6c30bde4c3f457b2920015ad989c3d24ad`.

Compare from the final integration HEAD to the production merge commit shows zero file delta; the merge commit tree is therefore identical to the validated integration branch tree. Source PRs #64/#66/#67/#68 were then closed as merged-equivalent/superseded with the production merge reference.
