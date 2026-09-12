# 07 — Integration & GitHub

- Owner: Lead Integration Developer / Repository Maintainer / GitHub Integration Engineer / CI / Deployment Coordinator
- Current phase: Phase 3A — Multi-step Reaction Network + Kinetics/Thermal + Workbench UI
- Overall state: PASS — PHASE3A_PRODUCTION_INTEGRATED
- Last updated: 2026-09-12

## Source of Truth
- Repository: `ogw07222-tech/chemical-lab`
- Starting production main: `3055ce6d2229806f4560a220ca835fb4b7f7c303`
- Production merge order: `#46 -> #45 -> #47`
- 06 validated stack HEAD: `8080128fb8c2c7dcd51a40a2fa7c90769f888a8a`
- 06 authoritative exact-stack run: `34673454682` — SUCCESS
- 06 authoritative determinism repeat: `34673454706` — SUCCESS

## PR #46 — 01 Phase 3A Multi-step Reaction Network
- original 06-validated source HEAD: `6d04b9aa96bfce02717cb9a233ded33d29960132`
- changed scope: Phase 3A network contract/status, integration export/orchestrator, network tests
- lint audit found the known inherited unused destructure in `src/integration/phase3a-reaction-network.ts`:
  - original: `const { amountToleranceMol: _amountToleranceMol, ...phase2eConfig } = config;`
  - 06 validation stack resolution: immediately consume it with `void _amountToleranceMol;`
- classification: **integration-only mechanical fix**, not a #45 overlay and not an ESLint suppression; no chemistry/runtime semantics changed
- same one-line fix applied to production source branch
- refreshed validated HEAD with temporary workflow: `a93030dc95b52198ec79b9001d879e7e6f3bef9d`
- integration validation run: `34673848563` — SUCCESS
  - npm ci: PASS
  - typecheck: PASS
  - lint: PASS
  - targeted Phase 3A network/reaction-progression/registry: PASS
  - full suite: PASS
  - build: PASS
- final PR HEAD after temporary workflow removal: `eb909fb85ceffe8e9790b0ca7ff77bf1f3292353`
- validated-head -> final-head delta: temporary workflow deletion only
- production merge SHA: `e79bcd72880c9d1809ca10c8608a5923b97d44ef`

## PR #45 — 02 Phase 3A Kinetics + Aggregate Thermal Coupling
- source HEAD at integration start: `92ca3ff39a1fc2616f8ab88df286575c15b298ea`
- previously validated executable/test HEAD: `74f60604bd3a5822140914b6dffaa9e3c72d6d65`
- `74f606... -> 92ca3f...` audit: executable/test source unchanged; only validation-workflow removal and documentation/status changes
- refreshed onto post-#46 production main via temporary integration PR #49
- ancestry refresh commit on feature branch: `a5e53101acc879eeddbadaca7e03001aa693dcb5`
- refreshed validated HEAD: `c24fcf93368523aca8d71bc6a2648b1d6f5e0015`
- integration validation run: `34673927888` — SUCCESS
  - npm ci/typecheck/lint: PASS
  - targeted kinetics + dimensioned resolver + evaluation + progression + thermal + network: PASS
  - full suite: PASS
  - build: PASS
- final PR HEAD after temporary workflow removal: `0d7af638dd39f7f9792c6a205b5bf016c385c982`
- production merge SHA: `eb87dd78f6870269210f7a38011e0ae1c2a47fe6`

Preserved 02 contracts:
- `DIMENSIONED_RATE | RELATIVE_RATE | QUALITATIVE_ONLY | OPEN`
- `kineticExtentInputOverDt()` boundary
- no fabricated activation energy or dimensional rate
- forward/reverse metadata remains explicit
- aggregate reaction heat is applied exactly once
- thermal coverage remains `COMPLETE | PARTIAL | OPEN`
- per-event heat facts remain available
- missing/non-finite ΔH remains OPEN rather than fabricated

## PR #47 — 05 Workbench Phase 3A Reaction Activity
- source HEAD at integration start: `70d0d68523c0a60ff65377833459eb2547bf82b5`
- prior UI validated code HEAD: `b149bf67b8f26a9e5440c0cb7fed68761039ca30`
- original source was stacked on exact PR #46
- retargeted to `main` after #46/#45 production integration
- refreshed onto production main via temporary integration PR #50
- ancestry refresh commit on UI branch: `eb8357d9a9fe2487304aee9a9439dd8c6d139f29`
- after retarget/refresh, PR #47 delta returned to exactly six UI/projection files:
  - `docs/workstream-status/05-web-ui.md`
  - `src/ui/App.tsx`
  - `src/ui/provider.tsx`
  - `src/ui/reactionProjection.ts`
  - `src/ui/types.ts`
  - `tests/ui/LaboratoryWorkspace.test.tsx`
- refreshed validated HEAD: `b510304be6e389703564ec735c2d1b0609e145b8`
- integration/UI validation run: `34674066039` — SUCCESS
  - npm ci/typecheck/full lint: PASS
  - targeted UI + Phase 3A stack: PASS
  - full suite: PASS
  - build: PASS
  - Chromium install: PASS
  - browser smoke: PASS at 1536x900, 1440x900, 1024x768, 390x844
  - no horizontal overflow / blocking console/page errors: PASS
- final PR HEAD after temporary workflow removal: `966f50c82edab41bbdd5374ba9b5a19807fa37de`
- production merge SHA: `c75aafd1eeb8373b7292a0cd6caa8ed994857ec4`

## Workbench Regression Gate
PR #44 Workbench direction remains intact:
- clean mostly-empty center and prominent main vessel: PASS
- catalog collapse: PASS
- conditions collapse and authoritative T/P/V summary: PASS
- structural notation: PASS
- inspector / free-form notes: PASS
- responsive desktop/tablet/mobile layout: PASS
- reaction activity remains compact/secondary to the Workbench: PASS
- no chemistry calculation moved into React: PASS
- unknown generated-species identity remains player-safe; internal refs stay Developer-Mode-only: PASS
- `APPROXIMATED`/`OPEN` heat and amount honesty preserved: PASS
- `eventId` deduplication and provider timestep/event ordering preserved: PASS

## 06 Validated-stack Equivalence
Validated stack: `8080128fb8c2c7dcd51a40a2fa7c90769f888a8a`
Production functional main after #47: `c75aafd1eeb8373b7292a0cd6caa8ed994857ec4`

The two histories diverge because 06 used a validation-only assembly, but effective production source equality is stronger than semantic inference:
- **entire `src` tree SHA is identical on both:** `dfcde14f9234f695c37e3cee095481e49ed9d2eb`
- key production/test blobs are byte-identical, including:
  - Phase 3A orchestrator
  - reaction evaluation / extent / ranking / shared types
  - reaction progression resolver / thermal coupling / types
  - Workbench `App.tsx`, provider, reaction projection, UI types
  - Phase 3A network, kinetics/thermal, dimensioned resolver, progression, evaluation, thermal, registry, knowledge/reference and Workbench tests
- production intentionally excludes validation-only artifacts:
  - `.github/workflows/validate-phase3a-stack.yml`
  - `.github/workflows/validate-phase3a-determinism-repeat.yml`
  - `tests/validation.phase3a-stack.test.ts`
- validation-only documentation/history differences do not alter production semantics

**Semantic/tree equivalence: PASS.**

## Final Production Regression
A temporary main-only workflow was added solely for final validation and removed immediately afterwards.

- exact tested main: `3b05ace9a691664dc1f4c9f62f849c3e267be8f3`
- functional production source parent: `c75aafd1eeb8373b7292a0cd6caa8ed994857ec4`
- run: `34674190373` — SUCCESS

Results:
- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS with 0 errors; one non-blocking existing React Hook dependency warning in `src/ui/provider.tsx`
- targeted final Phase 3A regression: **10 files / 107 tests PASS**
- determinism repeat subset: **4 files / 52 tests PASS**, then **4 files / 52 tests PASS** again
- full `npm test`: **19 files / 217 tests PASS**
- `npm run build`: PASS
- Chromium install: PASS
- `npm run smoke:ui`: PASS
  - desktop 1536x900
  - desktop 1440x900
  - tablet 1024x768
  - mobile 390x844
- tested SHA recorded by workflow: `3b05ace9a691664dc1f4c9f62f849c3e267be8f3`

The temporary final validation workflow was removed in commit `aaf048e95e33268f396b4cfb71bf75cc2bf92e84`; compare proves the sole delta from the green tested SHA was deletion of that workflow. Production executable/test source therefore remains byte-equivalent to the successful run.

## Absolute Contract Gates
- no same-step hidden cascade: PASS
- generated products participate beginning next timestep: PASS
- finite/non-negative material state: PASS
- atom/element/applicable-charge conservation: PASS
- deterministic ordering / IDs / events: PASS
- product registration failure atomicity: PASS
- no shared-reactant overconsumption: PASS
- aggregate reaction heat applied once: PASS
- no fabricated activation energy / kinetic dimensionality / equilibrium facts: PASS
- provider remains authoritative; UI does not compute chemistry: PASS
- unknown identity privacy: PASS
- PR #44 Workbench layout/interaction direction preserved: PASS

## Vercel Policy
Root `vercel.json` remains authoritative with:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": false
  }
}
```

No manual Vercel deployment is part of this integration. Production deployment remains prohibited until explicitly requested by the user.

## Final Status
**PASS — Phase 3A reaction network, kinetics/thermal, and Workbench UI integrated into production main.**
