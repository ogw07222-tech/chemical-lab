# 07 — Integration & GitHub

- Owner: Lead Integration Developer / Repository Maintainer / GitHub Integration Engineer / CI / Deployment Coordinator
- Current phase: UI production chain — 05A Workbench & Layout -> 05B Apparatus UI -> 05D UI Integration & Accessibility
- Overall state: PASS_WITH_OPEN_ITEMS — UI_CHAIN_PRODUCTION_INTEGRATED
- Last updated: 2026-09-12

## Current Source of Truth
- Repository: `ogw07222-tech/chemical-lab`
- Starting production main for this integration: `555c6e74ef94a9c06416fb80ce703980ce6a1889`
- Required production merge order: `05A -> 05B -> 05D`
- 06 independent validation status: **ALL PASS**
- Phase 3B production baseline was already integrated before this UI chain and was preserved through all refreshes and regressions.

## 06 Validated UI Lineage
### 05A — Workbench & Layout
- branch: `feature/05a-workbench-placement-boundary`
- exact approved feature HEAD: `cb752bc7d91d7d871f965226e51ea94c57a00b85`
- 06 exact recheck lineage HEAD: `fbb58724f7e060932ea9bdf64817165ab9384ecc`
- 06 recheck run: `34692687668` — SUCCESS

### 05B — Apparatus UI
- branch: `feature/05b-apparatus-ui-shell`
- exact approved feature HEAD: `e64a5dad96705506f312ef90ff6b82291b6281cc`
- ancestry includes exact 05A validated feature lineage
- 06 exact recheck lineage HEAD: `b737814463b2808a1528d69bf7415ef98f61033a`
- 06 recheck run: `34692698190` — SUCCESS

### 05D — UI Integration & Accessibility
- PR: #54
- branch: `feature/05d-apparatus-provider-accessibility`
- exact approved branch checkpoint: `95764c1b6b703ac3f4b6bef3af8a23993aff3a81`
- validated executable/test reference: `e3345973ecfe97002a7bc72bf40f3275b3ed46c0`
- 06 current-main runtime-probe lineage HEAD: `0a41780778681028cde178664b83455f5c8900c0`
- 06 current-main runtime-probe run: `34692827001` — SUCCESS
- that 06 probe assembled the exact 05A -> 05B -> 05D lineage on the current Phase 3B production baseline and passed UI, Phase 3A, Phase 3B, full-suite, build, Chromium, and responsive smoke validation.

## 05A Production Integration
- original validated HEAD: `cb752bc7d91d7d871f965226e51ea94c57a00b85`
- latest-main ancestry refresh PR: #59
- integration-only refresh merge on feature branch: `121e70abbc189a113d574fc7c2cca6f9b0528a65`
- no behavioral conflict resolution was required
- integration validation tested HEAD: `c47a511dac1530cc1d0a2686006891766993d5f8`
- integration validation run: `34693199987` — SUCCESS
  - install/typecheck/lint: PASS
  - 05A + LaboratoryWorkspace targeted regression: PASS
  - full test suite: PASS
  - build: PASS
  - Chromium responsive smoke: PASS
- temporary workflow removed
- final refreshed feature HEAD: `0e8f576b3b4191e154ff6423717ebba53ee9a3a8`
- production PR: #60
- final PR delta: exactly seven 05A-owned Workbench/App/test files
- production merge SHA: `efe34b217aa0310b9bbe287c7fdec8a154c5616b`

Preserved 05A boundaries:
- existing Phase 3A/3B provider projection and reaction activity remained present
- legacy/global bottom controls remained present
- provider physics was not moved into layout code
- Workbench placement/layout ownership remained 05A-owned

## 05B Production Integration
- original validated HEAD: `e64a5dad96705506f312ef90ff6b82291b6281cc`
- post-05A ancestry refresh PR: #61
- integration-only refresh merge on feature branch: `8cc366a8899a8b0c3a077edf908787243b23c10c`
- integration validation tested HEAD: `32b3dcc32e354a00bcb553cf78f41255b15ee17b`
- integration validation run: `34693341910` — SUCCESS
  - install/typecheck/lint: PASS
  - 05A + 05B + LaboratoryWorkspace targeted regression: PASS
  - full test suite: PASS
  - build: PASS
  - Chromium responsive smoke: PASS
- temporary workflow removed
- final refreshed feature HEAD: `656056bd3a252b2b64770d595693ce7683714b61`
- production PR: #62
- final PR delta: exactly nine apparatus-specific UI/test files; 05A implementation was not duplicated
- production merge SHA: `5f6dd2b3cce4e919d4e3ec24490e9fbb2ef0d494`

Preserved 05B boundaries:
- apparatus catalog / simple apparatus geometry / Device Inspector: PASS
- typed apparatus intents: PASS
- requested setpoint vs authoritative current reading separation: PASS
- `UNAVAILABLE | UNSUPPORTED | OPEN` honesty: PASS
- no frontend temperature, pressure, gas, filtration, heat, equilibrium, or other scientific calculation added
- no fake current state or fake backend command added

## 05D Production Integration
- production PR: #54
- old stacked base: `feature/05b-apparatus-ui-shell`
- retargeted base after 05B production merge: `main`
- original validated branch checkpoint: `95764c1b6b703ac3f4b6bef3af8a23993aff3a81`
- validated executable/test reference: `e3345973ecfe97002a7bc72bf40f3275b3ed46c0`
- post-05B ancestry refresh PR: #63
- integration-only refresh merge on feature branch: `2065f58dae2e0feada4009fa8e35b479d9917a23`
- integration validation tested HEAD: `cd76786885de729edb294c07344ab585818147bd`
- integration validation run: `34693460384` — SUCCESS
  - install/typecheck/lint: PASS
  - 05A + 05B + 05D + Phase 3A/3B + registry/privacy targeted regression: PASS
  - full test suite: PASS
  - build: PASS
  - Chromium responsive smoke: PASS
- temporary workflow removed
- final refreshed PR HEAD: `893d65bc7bf029a46bff3c0476d9dc8bdba134f4`
- final PR delta: 12 provider/adapter/accessibility/integration-test-oriented files; no bulk 05A/05B duplication
- PR #54 moved from draft to ready only after successful integration validation
- production merge SHA: `414761bd8c9b2ab3f342da688379405a5dfa57f9`

Preserved provider/accessibility contract:
- flow remains `apparatus UI -> typed UI intent -> provider mapping -> simulation -> provider projection -> UI`
- no apparatus intent is force-mapped to vessel-global commands while apparatusId-addressed backend commands do not exist
- all eight apparatus runtime intents remain explicitly unsupported/open where appropriate
- no UI calculation of Q, K, ln(Q/K), ΔG, equilibrium direction/tolerance, drivingStrength, reaction extent, temperature evolution, pressure evolution, heat transfer, filtration, phase, or molecular identity
- Workbench remains a named region
- apparatus instances remain keyboard-focusable with unique accessible names and selected semantics
- Device Inspector heading relationship, selection focus transfer, Escape/close, focus restoration, visible focus, and disabled/unavailable reason behavior remain intact
- legacy/global bottom controls remain in production

## Final Production Regression
Functional production main after 05D merge: `414761bd8c9b2ab3f342da688379405a5dfa57f9`.
A temporary main-only workflow was added solely to validate the exact integrated source and then removed.

- exact tested main: `3e1805b47fd8cbc8a53d2047d1f868e73146bcd7`
- validation run: `34693557923` — SUCCESS

Results:
- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS — 0 errors; one inherited non-blocking `src/ui/provider.tsx` React Hook dependency warning
- targeted final UI/science/privacy regression: **12 files / 127 tests PASS**
- full `npm test`: **26 files / 284 tests PASS**
- `npm run build`: PASS
- Chromium install: PASS
- responsive browser smoke: PASS
  - desktop 1536x900
  - desktop 1440x900
  - tablet 1024x768
  - mobile 390x844
- browser smoke reported: `UI refinement smoke PASS: desktop 1536/1440x900, tablet 1024x768, mobile 390x844`
- tested SHA recorded by workflow: `3e1805b47fd8cbc8a53d2047d1f868e73146bcd7`

The temporary final validation workflow was removed in commit `3bc6f4fe03999246182a482339de91ddbe2f4452`. Compare from the green tested SHA proves the sole delta was deletion of `.github/workflows/07-ui-chain-final-production-validation.yml`; production executable/test source therefore remains equivalent to the successful run.

## Architecture / Regression Gates
- Workbench/layout boundary: PASS
- apparatus-specific UI boundary: PASS
- provider authority and pass-through adapter boundary: PASS
- accessibility/focus lifecycle: PASS
- Phase 3A reaction activity / Timeline / catalog / conditions preservation: PASS
- Phase 3B runtime/provider facts preserved without UI-side equilibrium calculation: PASS
- Dynamic/generated species identity privacy: PASS
- bottom/global legacy controls preserved: PASS
- responsive workspace/browser smoke: PASS

## Known OPEN — Non-blocking
- apparatusId-addressed backend runtime commands are not yet implemented by the simulation/gameplay backend
- authoritative apparatus runtime projections are not yet implemented for all apparatus-specific state
- mobile drawer/sheet-specific focus trap/restoration seam remains OPEN if/when that 05A mobile drawer integration is introduced
- Phase 3B player-facing reaction/equilibrium visualization remains 05C-owned and is not added by this chain
- inherited `src/ui/provider.tsx` exhaustive-deps warning remains non-blocking and unchanged

No current OPEN item blocks the validated UI chain integration completed here.

## Validation Artifact Cleanup
Temporary 07 integration workflows used for 05A, 05B, 05D, and final-main evidence were removed after successful runs. Validation-only workflows are not part of the production feature surface.

## Vercel Policy
Root `vercel.json` remains authoritative with `git.deploymentEnabled = false`.
No manual Vercel deployment is part of this UI integration. Deployment remains prohibited until explicitly requested by the user.

## Historical Phase 3B Baseline
Before this UI-chain task, Phase 3B production integration was already PASS:
- #51 equilibrium thermodynamics production merge: `e36303e962409ce26db1eba623025a357c67ec9e`
- #52 reversible pair arbitration production merge: `d18359e12430f4e6a89903d87ad30a8ef64aeeda`
- Phase 3B final regression run: `34688815895` — SUCCESS
- Phase 3B final tested main: `95471fd285c12e5f6e60c21c309c391ee153ae18`

The 05A -> 05B -> 05D integration preserved those runtime semantics and their provider facts.

## Final Status
**PASS_WITH_OPEN_ITEMS — 05A Workbench & Layout -> 05B Apparatus UI -> 05D UI Integration & Accessibility integrated into production main with validated lineage preserved.**
