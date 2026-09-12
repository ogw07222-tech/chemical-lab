# 05 — Web UI

- Owner: Lead Game UI/UX Designer / Chemistry Visualization Developer / Frontend Integration Developer / Web Laboratory Interface Developer
- Current phase: Laboratory workbench refinement
- Overall state: PASS
- Last updated: 2026-09-12
- Original starting main: `9b83dfe08a3657ac920b0181a8aaac875623030f`
- Original failed refinement HEAD: `d28723987b43c257092a6591c510ef26f8b24fd4`
- Active branch: `feature/lab-ui-workbench-refinement`
- Refreshed main: `a434065afc967d08a538f6409d4e0ea955b143d3`
- Pre-refresh green HEAD: `0c58e4ce3621dd442eed7edbb4a4f89dd90c13d8`
- Pre-refresh green run: `34667346241`
- Post-refresh validated HEAD: `7555f4524511f2d17f82f611e425b33718d9e801`
- Post-refresh validation run: `34667533394`
- Active PR: pending final exact-head validation / creation

## Refinement scope
- Removed decorative background apparatus, secondary beaker/test-tube/stirrer/stand/bottle art, and sticky-note/background copy.
- Retained a clean wall, subtle scientific grid, simple counter, and the actual primary vessel interaction target.
- Added desktop/tablet catalog collapse/expand; collapsed catalog leaves a thin rail and materially widens the workspace.
- Added experiment-condition collapse/expand; collapsed state keeps readable temperature / pressure / volume summary.
- Replaced catalog decorative molecule thumbnails with compact structural notation (`H-H`, `O=O`, `N≡N`, `H-O-H`, `O=C=O`, etc.).
- Preserved persistent inspector, free-form notes, provider-backed AddSubstance / Mix / Stir / Stop / Reset / Disposal, discovery gating, Developer Mode separation, and responsive mobile navigation.

## Original CI failure and diagnosis
Original workflow run `34623795314` failed at:
`npm test -- tests/ui/LaboratoryWorkspace.test.tsx`.

A diagnostic-only workflow on branch `diagnostic/ui-targeted-d287239` isolated the failures without changing production code or test semantics.
Diagnostic run: `34665984054`.
Exact-output artifact run: `34666964822`, artifact `ui-vitest-failure-diagnostics`.

Three tests failed independently; all were proven **C3 — accessibility/query-scope mismatch**:
1. `collapses and restores the catalog without losing access state`
   - global `getByText('수소')` matched both catalog and persistent inspector.
2. `adds a finite mol amount through the provider`
   - global `/0.250 mol/` matched both primary vessel and Composition table.
3. `disposes selected vessel material only through provider command`
   - global `/1.000 mol/` matched both primary vessel and Composition table before disposal.

No provider or production UI regression was proven by these failures.

## Minimal test fix
Changed only semantic query scope in `tests/ui/LaboratoryWorkspace.test.tsx`:
- catalog reopen assertion is scoped with `within(도감)`.
- finite-add amount assertion is scoped to accessible `주 용기`.
- disposal precondition amount assertion is scoped to accessible `주 용기`.

No assertion was removed or weakened; Timeline/provider-event checks remain.

During the complete browser checkpoint, a separate smoke-only timing issue was observed: the script measured workspace width before the existing `.18s` grid transition completed. `tools/ui-smoke.mjs` now polls `boundingBox()` for the same >100px expansion criterion. Product layout/CSS semantics were not changed for this smoke fix.

## Pre-refresh validation — PASS
Exact HEAD: `0c58e4ce3621dd442eed7edbb4a4f89dd90c13d8`
Workflow run: `34667346241`

- install: PASS
- typecheck: PASS
- lint: PASS
- targeted UI: **13/13 PASS**
- full suite: **130/130 PASS across 11 files**
- build: PASS
- Chromium install: PASS
- browser smoke: PASS
  - Desktop 1536×900 / 1440×900
  - Tablet 1024×768
  - Mobile 390×844
- no horizontal overflow: PASS
- no blocking console/page errors: PASS

## Latest-main refresh
Authoritative main at refresh time: `a434065afc967d08a538f6409d4e0ea955b143d3`.

Refresh was performed as a merge commit so both feature history and latest-main ancestry are retained. Main remained authoritative for newly integrated Dynamic Species Registry / generated-species knowledge / scientific-reference validation files. The refinement only overlaid its UI, UI test, smoke, and branch-validation workflow surfaces.

Conflict/contract audit:
- `src/ui/provider.tsx` and `src/ui/types.ts`: latest-main versions preserved.
- generated-species / knowledge / validation implementation and tests: latest-main versions preserved.
- `vercel.json`: latest-main version preserved with `git.deploymentEnabled = false`.
- no diagnostic-only workflow entered the feature branch.
- no direct chemistry, phase truth, kinetics, thermodynamics, or generated-species identity inference was added to React.

## Post-refresh validation — PASS
Exact validated HEAD: `7555f4524511f2d17f82f611e425b33718d9e801`
Workflow run: `34667533394`

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- targeted UI: **13/13 PASS**
- full suite: **186/186 PASS across 16 files**
  - Dynamic Species Registry validation: PASS
  - generated-species reference enrichment: PASS
  - generated-species knowledge: PASS
  - reaction progression/regression stack: PASS
- `npm run build`: PASS
- Chromium install: PASS
- browser smoke: PASS
  - Desktop 1536×900 / 1440×900
  - Tablet 1024×768
  - Mobile 390×844
- decorative apparatus/sticky-note absence: PASS
- catalog collapse/expand + workspace widening: PASS
- collapsed T/P/V summary + restore: PASS
- structural notation: PASS
- AddSubstance / Mix / Stir / Stop / Reset / Disposal provider integration: PASS
- unknown identity gating / Developer Mode separation: PASS
- no horizontal overflow: PASS
- blocking console/page errors: none

## Deployment policy
No Vercel production deployment was performed. Automatic Git deployment remains disabled through `vercel.json`.

## Gate
**PASS** — workbench refinement is compatible with latest main and ready for final exact-head validation / PR creation.
