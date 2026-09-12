# 07 — Integration & GitHub

- Owner: Lead Integration Developer / Repository Maintainer / GitHub Integration Engineer / CI / Deployment Coordinator
- Current phase: Phase 4A-1 — Compartment + Matter Transfer + Conservation Foundation production integration
- Overall state: PASS — PHASE4A1_PRODUCTION_INTEGRATION_PASS
- Last updated: 2026-09-12

## Source of Truth
- Repository: `ogw07222-tech/chemical-lab`
- Starting production main for Phase 4A-1 integration: `9619ec8f3042c2423127fa33f617f932c15eb88b`
- Target PR: #57 — `feat(sim): add Phase 4A compartment and matter transfer foundation`
- Old PR base: `555c6e74ef94a9c06416fb80ce703980ce6a1889`
- Old independently failed source HEAD: `86dad8298be2997370fc529ab9e07179aba843d7` — NOT MERGE AUTHORIZED
- Fixed executable/test implementation HEAD: `a11fb3e24197a5c30ca19f0468cdacf1d6c20ad2`
- Original final PR checkpoint before latest-main refresh: `269c00fd56b8c19f9a08c783bf7198a95b052e2b`
- 01 fix-validation workflow: `34693370905` — SUCCESS
- 06A revalidation branch: `validation/06a-phase4a1-revalidation`
- 06A validation HEAD: `320c457c55503bad1f2523f311d82a5c6701d25e`
- 06A workflow: `34693888788` — SUCCESS
- 06A verdict: `PHASE4A1_INDEPENDENT_VALIDATION_PASS` / merge allowed YES

## Exact-Lineage Audit
Compare from `a11fb3e24197a5c30ca19f0468cdacf1d6c20ad2` to the pre-refresh PR checkpoint `269c00fd56b8c19f9a08c783bf7198a95b052e2b` showed only removal of the temporary implementation validation workflow. No executable/test semantics changed.

The 06A validation branch is evidence only. Relative to the fixed implementation lineage it adds independent validation tests/workflow rather than mutating Phase 4A-1 production source.

## Current-Main Advance Audit
The PR base was behind production main. Audit from `555c6e74ef94a9c06416fb80ce703980ce6a1889` to starting main `9619ec8f3042c2423127fa33f617f932c15eb88b` found only the already validated 05A/05B/05D UI chain and integration-status documentation.

No overlapping simulation/runtime changes were present in:
- SpeciesId / SpeciesState authority;
- Dynamic Species Registry;
- reaction progression;
- Phase 3A reaction network;
- Phase 3B equilibrium/reversible arbitration;
- thermal coupling.

Therefore a behavior-neutral ancestry refresh was permitted.

## Refresh
- integration-only refresh PR: #65
- refresh source: production `main`
- refresh target: `feature/phase4a1-compartment-foundation`
- refresh merge commit on feature branch: `09e0fb7e4dfc3349988313b4e9e041552845720e`
- no semantic conflict resolution was required
- final PR #57 review delta remained exactly six Phase 4A-1-owned files
- `src/simulation/compartment/core.ts` retained the same blob as the independently validated fixed implementation (`7553e2e50eab7463e9c9e7670aa4523521f5fa2f`)

## Integration Validation
A temporary 07 workflow was run on the refreshed PR lineage.

Initial workflow run `34694275319` stopped only because the temporary runner script attempted to write imported 06A tests into a missing `tests/validation/` directory. Before that runner setup failure, install/typecheck/lint and the production Phase 4A-1 17-test suite were already green. No production source was changed to address this; only the temporary workflow added `mkdir -p tests/validation`.

Authoritative successful integration run:
- tested HEAD: `def738cb3567cb3c7c760bc3d5a2ed02204d094e`
- run: `34694318207` — SUCCESS

Results:
- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS — 0 errors; one inherited non-blocking React Hook warning in `src/ui/provider.tsx`
- Phase 4A-1 production tests: **17/17 PASS**
- exact 06A independent + extended regression imported from validation HEAD `320c457...`: **18/18 PASS**
- cross-phase regression: **7 files / 86 tests PASS**
  - Phase 3A reaction network: 11/11
  - Phase 3A kinetics/thermal: 10/10
  - Phase 3B equilibrium: 15/15
  - Phase 3B reversible arbitration: 16/16
  - Dynamic Species Registry: 11/11
  - reaction progression: 10/10
  - thermal: 13/13
- full suite with imported 06A tests: **29 files / 319 tests PASS**
- production build: PASS

The temporary integration workflow was then removed. Compare from green tested HEAD `def738cb...` to final refreshed PR HEAD `f92a8fa3bca723f4c37e5a0f44fd2e97b6f51794` showed only deletion of `.github/workflows/07-phase4a1-integration-validation.yml`.

## Production Merge
Immediately before merge PR #57 was open, non-draft, mergeable, based on the current production main lineage, and at exact final refreshed HEAD:
`f92a8fa3bca723f4c37e5a0f44fd2e97b6f51794`.

PR #57 was merged with exact-head protection.

- production merge SHA: `9fd2d6f37cf64c7bbf9ad73a89a7cba69cba2a82`

## Post-Merge Production Regression
A temporary main-only workflow re-ran the integration gates on the actual merged production tree.

- exact tested main: `3798bbbbdc5c2327efdca1428fe79d2f4214373f`
- run: `34694401938` — SUCCESS

Results:
- install: PASS
- typecheck: PASS
- lint: PASS — 0 errors; same inherited non-blocking `src/ui/provider.tsx` warning
- Phase 4A-1: **17/17 PASS**
- exact 06A independent + extended tests: **18/18 PASS**
- cross-phase Phase 3A / Phase 3B / Dynamic Species / progression / thermal: **7 files / 86 tests PASS**
- full suite including imported independent tests: **29 files / 319 tests PASS**
- build: PASS
- workflow recorded `TESTED_SHA=3798bbbbdc5c2327efdca1428fe79d2f4214373f`

Temporary final-main workflow cleanup commit: `25ccdf2611eefee9308f91360b586e683ac3f8e9`.
Compare from the green tested main to this cleanup commit shows the sole delta was removal of `.github/workflows/07-phase4a1-final-main-validation.yml`; executable/test source therefore remains equivalent to the successful production regression.

## Phase 4A-1 Invariants
### Identity
- existing `SpeciesId` authority preserved: PASS
- known and Dynamic Species Registry-generated species use the same transfer identity path: PASS
- no formula/display-name identity inference: PASS
- conflicting SpeciesId/canonical identity is rejected: PASS

### Atomicity / Transfer
- batch is all-or-nothing: PASS
- no partial commit: PASS
- no silent clamp / partial fulfillment: PASS
- incoming matter cannot fund outgoing matter in the same transaction: PASS
- competing source demand does not depend on caller request order: PASS
- failed transfer returns the original state: PASS

### Conservation
Pure transfer preservation:
- SpeciesId amount inventory: PASS
- element inventory: PASS
- atom inventory: PASS
- net-charge inventory: PASS
- finite/non-negative authoritative matter: PASS

### Determinism
- canonical system aggregation order: PASS
- compartment-order invariance: PASS
- species-entry-order invariance: PASS
- request-order independence for equivalent batches: PASS
- deterministic replay / no RNG: PASS

### Connections
Runtime-supported Phase 4A-1 matter kinds remain exactly:
- `GAS`
- `LIQUID`

Invalid/deserialized runtime kinds reject with `INVALID_CONNECTION_KIND`: PASS.

## Scope Audit
Phase 4A-1 production integration did NOT add:
- pressure or ideal-gas calculations;
- temperature evolution;
- heat/energy transfer;
- automatic gas escape or headspace partitioning;
- diffusion;
- pump physics;
- filtration physics;
- valve conductance/flow physics;
- apparatus-specific simulation behavior;
- UI/provider scientific derivation;
- reaction tuning.

Phase 3A, Phase 3B, Dynamic Species Registry, reaction progression, and existing thermal behavior remained green in integration and post-merge regressions.

## Validation Artifacts
Validation branches were not merged wholesale:
- `validation/06a-phase4a1-compartment` remains historical failed evidence for old source `86dad829...`;
- `validation/06a-phase4a1-revalidation` remains independent PASS evidence for the fixed lineage.

07 temporary validation workflows were removed after preserving run evidence. The independent 06A tests were imported into runner workspaces for integration regression and were not committed into production by this task.

## Status Consistency
`docs/workstream-status/01-simulation-engine.md` was updated after production integration to replace the stale “independent validation pending” wording with the actual 06A PASS and production merge state. No 06/06A validation branch was rewritten or merged into production.

## Vercel Policy
Root `vercel.json` remains authoritative with `git.deploymentEnabled = false`.
No manual Vercel deployment is part of Phase 4A-1 integration. Deployment remains prohibited until explicitly requested.

## Historical Production Baselines Preserved
Before this task:
- Phase 3B equilibrium/reversible arbitration production integration: PASS
- 05A -> 05B -> 05D UI production chain: PASS_WITH_OPEN_ITEMS

Phase 4A-1 integration did not alter their authoritative runtime semantics.

## Final Status
**PASS — PHASE4A1_PRODUCTION_INTEGRATION_PASS**

Production scope is strictly **Compartment + Matter Transfer + Conservation Foundation**. Phase 4A-2 pressure/headspace/gas-transport physics is not implemented here.

## Next HQ Action
00 HQ may open Phase 4A-2 design/research/implementation work for pressure, headspace, and explicit gas-transport physics, using the Phase 4A-1 atomic transfer primitive as the commit boundary.
