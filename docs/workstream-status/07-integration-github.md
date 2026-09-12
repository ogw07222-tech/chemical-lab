# 07 — Integration & GitHub

- Owner: Lead Integration Developer / Repository Maintainer / GitHub Integration Engineer / CI / Deployment Coordinator
- Current phase: Phase 3B — Equilibrium Thermodynamics + Reversible Pair Arbitration
- Overall state: PASS — PHASE3B_PRODUCTION_INTEGRATION_PASS
- Last updated: 2026-09-12

## Source of Truth
- Repository: `ogw07222-tech/chemical-lab`
- Starting production main: `36b82d9b9101819768970c39694c9139b2ee47bc`
- Production merge order: `#51 -> #52`
- 06 validation branch: `validation/06-phase3b-reversible`
- 06 exact tested validation HEAD: `7a576ba74e72ab969ca7df4c837efb09aab2a771`
- 06 independent validation run: `34687958351` — SUCCESS / `PHASE3B_REVERSIBLE_VALIDATION_PASS`

## Current-main Advance Audit
The production main advance relevant to this integration was PR #53. Its only changed file was `docs/workstream-status/05-web-ui.md`; no `src`, tests, thermodynamics, progression, thermal coupling, registry, or Phase 3B runtime source changed. The Phase 3B source stack therefore remained executable/test compatible with the 06 validated stack.

## PR #51 — 02 Phase 3B Equilibrium Thermodynamics Foundation
- original 06-validated source HEAD: `116cfa30192556b3236f4f2814000ad971361bac`
- previously validated executable/test reference: `5fcc62a05189ad7759596892ae30ab2a5b829998`
- latest-main ancestry refresh PR: #55
- refresh merge commit on feature branch: `5676a3e2cf8167668d30d39c7681c2c2f0cc0c93`
- integration validation tested HEAD: `5140da3031e8aedeec60900334e708d0a6a7e282`
- integration validation run: `34688610031` — SUCCESS
  - install: PASS
  - typecheck: PASS
  - lint: PASS
  - equilibrium/progression + Phase 3A + thermal targeted regression: PASS
  - full test suite: PASS
  - build: PASS
- temporary integration workflow removed
- final refreshed PR HEAD: `fc67e5f419ddaea803dba7fff639389a9d7fc19c`
- executable/test equivalence: PASS — compare from `116cfa...` to `fc67e5...` contains only `docs/workstream-status/05-web-ui.md`; temporary workflow net removed
- production merge SHA: `e36303e962409ce26db1eba623025a357c67ec9e`
- post-#51 production main: `e36303e962409ce26db1eba623025a357c67ec9e`

Preserved #51 authority:
- Q/K, ln(Q/K), ΔG direction and equilibrium scientific status remain 02-owned
- `NEAR_EQUILIBRIUM` and `INDETERMINATE` behavior unchanged
- `drivingStrength` policy unchanged
- anti-crossing / anti-overshoot bound unchanged
- no fabricated dimensional rate or activation energy
- Phase 3A aggregate thermal semantics unchanged

## PR #52 — 01 Phase 3B Reversible Pair Arbitration
- original 06-validated source HEAD: `aadd8d28312f85e99903bc1b731faffd4ac7de94`
- previously validated executable/test reference: `888eb99b0a2e11988db63866505eabf9f9eb6026`
- old PR base: `feature/phase3b-equilibrium-foundation`
- new PR base after #51 integration: `main`
- post-#51 ancestry refresh PR: #56
- refresh merge commit on feature branch: `c70f94d738695ef0cf5ab8770059f1c7a77f0b70`
- PR delta after retarget/refresh remained the same eight arbitration-owned files; #51 implementation was not duplicated in the review delta
- integration validation tested HEAD: `741be1989e936955b454f179a700d0fdd0db1336`
- integration validation run: `34688751801` — SUCCESS
  - install/typecheck/lint: PASS
  - targeted Phase 3B stack: PASS
  - determinism repeat: PASS
  - full test suite: PASS
  - build: PASS
- temporary integration workflow removed
- final refreshed PR HEAD: `9e2f5ca8a75fd8daf5a06a920505d2cd84aadf3c`
- executable/test equivalence: PASS — compare from `aadd8d...` to `9e2f5ca8...` contains only `docs/workstream-status/05-web-ui.md`; temporary workflow net removed
- production merge SHA: `d18359e12430f4e6a89903d87ad30a8ef64aeeda`

Preserved #52 arbitration semantics:
- order remains thermo/kinetic evaluation -> reversible pair arbitration -> normal shared-reactant competition
- pair identity remains explicit `pairId` + explicit channel direction only
- no equation/formula/graph/name-based implicit reverse inference
- FORWARD keeps forward channel; REVERSE keeps reverse channel
- NEAR_EQUILIBRIUM produces zero coarse net pair progression
- INDETERMINATE abstains from equilibrium arbitration
- 01 does not duplicate Q/K, ΔG direction, tolerance, hysteresis, damping, driving curve, or crossing solver
- only a supported numeric kinetic request can be modulated; OPEN/qualitative kinetics are not converted to a numeric extent
- opposite pair channel cannot consume matter, emit a committed net event, or contribute heat in the same timestep
- generated products remain next-timestep participants; same-step hidden cascade remains prohibited

## Final Production Regression
Functional production main after #52: `d18359e12430f4e6a89903d87ad30a8ef64aeeda`.
A temporary main-only workflow was added solely to validate the exact integrated source and then removed.

- exact tested main: `95471fd285c12e5f6e60c21c309c391ee153ae18`
- run: `34688815895` — SUCCESS

Results:
- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS, 0 errors; one inherited non-blocking React Hook dependency warning in `src/ui/provider.tsx`
- targeted final Phase 3B regression: **11 files / 128 tests PASS**
- determinism repeat: **3 files / 37 tests PASS**
- full `npm test`: **22 files / 261 tests PASS**
- `npm run build`: PASS
- tested SHA recorded by workflow: `95471fd285c12e5f6e60c21c309c391ee153ae18`

The temporary final workflow was removed in commit `9f9a840979274094ef68a5cb6951edbcbfec0d00`. Compare proves the sole delta from the green tested SHA was deletion of `.github/workflows/phase3b-final-main-validation.yml`; executable/test source remained byte-equivalent to the successful run.

## Scientific / Runtime Invariants
- equilibrium authority remains 02-owned: PASS
- anti-ping-pong / near-equilibrium zero coarse net behavior: PASS
- anti-overshoot / equilibrium crossing cap: PASS
- no forward/reverse double counting: PASS
- aggregate reaction heat applied exactly once: PASS
- atom/element/applicable-charge conservation and finite non-negative matter: PASS
- deterministic ordering / replay / candidate permutation handling: PASS
- generated species next-timestep semantics and registration atomicity: PASS
- no shared-reactant overconsumption: PASS
- no same-step hidden cascade: PASS
- no fabricated kinetics/equilibrium evidence: PASS
- no chemistry calculation migrated into UI: PASS

## Validation Artifact Cleanup
The following 07 temporary validation workflows were used only to obtain evidence and were removed after successful runs:
- `phase3b-pr51-integration.yml`
- `phase3b-pr52-integration.yml`
- `phase3b-final-main-validation.yml`

The 06 validation branch/workflow was not merged into production main. Cleanup commits were verified to be workflow-deletion-only, while ancestry refresh net deltas relative to the exact validated #51/#52 source heads were docs-only.

## Vercel Policy
Root `vercel.json` remains authoritative with `git.deploymentEnabled = false`.
No manual Vercel deployment is part of Phase 3B integration. Deployment remains prohibited until explicitly requested by the user.

## Final Status
**PASS — Phase 3B equilibrium thermodynamics foundation and reversible pair arbitration integrated into production main.**
