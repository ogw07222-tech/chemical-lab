# 07 — Integration & GitHub

- Owner: Lead Integration Developer / Repository Maintainer / GitHub Integration Engineer / CI / Deployment Coordinator
- Current phase: Phase 2E — Reaction State Progression Integrated
- Overall state: PASS — PHASE2E_REACTION_PROGRESSION_INTEGRATED
- Last updated: 2026-09-12

## Current Source of Truth
- Repository: `ogw07222-tech/chemical-lab`
- Starting production main for this integration: `4baabda1bea03bbbef1b6f914cca075e0a7cf571`
- Target PR: #33 — `feat(sim): add Phase 2E reaction state progression`
- Original PR #33 source HEAD: `b2db3a9eb2128a8677b25193f1e8e91906715a53`
- Latest-main ancestry refresh merge on feature branch: `029b38990071e0a7e6c4dc8449603c57a15f8c52`
- Validated executable/test HEAD: `c57bcd03226acb270d2ef503030f43a3211d164a`
- Final PR #33 HEAD: `5de68123327a9c191a6e1ea8a4a7fa55675926e0`
- Consolidated validation run: `34633183345` — **SUCCESS**
- PR #33 production merge SHA: `fcea2fd11a16474dae0935589ab665e899af5d93`

## Refresh Audit
PR #33 had diverged from main after PR #34 (Clean Workbench UI) and PR #35 (disable automatic Vercel Git deployments). The Phase 2E PR changed simulation/thermal/integration files, while the recent main advancement changed UI, UI tests/smoke, status documentation, one historical UI workflow, and root `vercel.json`.

Direct changed-file overlap between the original PR #33 delta and the recent main delta was **zero**. No simulation/core, reaction-progression, thermal, provider/type, or UI provider-contract conflict was found. Temporary PR #36 merged current main into the Phase 2E feature branch without changing Phase 2E chemistry semantics.

The refresh and production merge preserved root `vercel.json` and its manual-deployment policy:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": false
  }
}
```

No Vercel production deployment was requested or performed as part of this integration.

## Phase 2E Contract Audit
Production now supports:

`candidate generation -> evaluation/ranking -> deterministic competing-reaction resolution -> bounded reaction extent -> stoichiometric species mutation -> ReactionProgressEvent -> actual-extent reaction heat -> next state`

Integration gates:
- finite species amounts / invalid NaN or Infinity rejection: **PASS**
- limiting-reactant bounded extent: **PASS**
- no negative amounts after mutation: **PASS**
- explicit atom/element conservation across applied mutation: **PASS**
- charge/conservation guard remains authoritative where represented: **PASS**
- deterministic repeated identical timesteps: **PASS**
- shared-reactant competition without overconsumption: **PASS**
- candidate ID is not allowed to capture shared inventory ahead of tied competitors: **PASS**
- unresolved product identity is deferred rather than assigned a fabricated species ID: **PASS**
- zero-extent candidates are not applied: **PASS**
- no newly produced product is recursively consumed in the same resolution step: **PASS**
- reaction heat uses actual applied extent and existing `deltaH_J_per_mol`: **PASS**
- missing/non-finite reaction enthalpy produces no fabricated heat and propagates `OPEN`: **PASS**
- aggregate reaction heat ledger / double-specification guard: **PASS**

The coarse kinetic extent model remains an approximation; that scientific approximation status is separate from the integration verdict.

## Validation
A temporary branch-scoped workflow was used only to validate the refreshed exact executable state, then removed before production merge.

Successful run: `34633183345`
Tested commit: `c57bcd03226acb270d2ef503030f43a3211d164a`

Results:
- `npm ci --no-audit --no-fund`: **PASS**
- `npm run typecheck`: **PASS**
- `npm run lint`: **PASS**
- targeted Phase 2E + candidate + evaluation + thermal: **4 files / 48 tests PASS**
  - reaction progression: 10/10
  - reaction candidates: 16/16
  - reaction evaluation: 9/9
  - thermal: 13/13
- full `npm test`: **12 files / 137 tests PASS**
- reaction validation matrix: 8/8 PASS within full suite
- UI workbench regression: 10/10 PASS within full suite
- `npm run build`: **PASS**

Two validation defects were corrected before the green run:
1. an unused type import in `thermal-coupling.ts` caused lint failure; removing it did not change runtime semantics;
2. the missing-DeltaH test helper initially could not represent explicit `undefined` because of JavaScript default-parameter behavior. The test fixture was corrected. Production missing-enthalpy handling already propagated `OPEN` without fabricating heat.

After the successful run, only the temporary validation workflow was removed and this integration status was updated; executable/test blobs remained those validated at `c57bcd03226acb270d2ef503030f43a3211d164a`.

## Explicitly Out of Scope
This integration does not add:
- DynamicSpeciesRegistry
- generated-species persistence
- equilibrium solver
- stiff ODE solver
- electrochemistry
- phase solver
- new UI reaction visualization
- new chemistry constants

## Vercel Deployment Policy
PR #35 remains authoritative. Automatic Git-triggered Vercel production and preview deployments are disabled by root `vercel.json`.

Do not deploy as part of ordinary GitHub push/merge work. Manual production deployment occurs only when the user explicitly requests deployment/Vercel publication.

## Integration Decision
**PASS — Phase 2E reaction state progression integrated into latest main.**

## Next Action
Proceed to **Dynamic Species Registry & Generated Species Persistence**. Do not mix that work back into the completed PR #33 integration.
