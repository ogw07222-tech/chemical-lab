# 07 — Integration & GitHub

- Owner: Lead Integration Developer / Repository Maintainer / GitHub Integration Engineer / CI / Deployment Coordinator
- Current phase: Dynamic Species Registry stack integrated
- Overall state: PASS — DYNAMIC_SPECIES_REGISTRY_STACK_INTEGRATED
- Last updated: 2026-09-12

## Source of Truth
- Repository: `ogw07222-tech/chemical-lab`
- Starting main: `4c12c2b9be6053887f471c288618590114dc32b4`
- Merge order: `#39 -> #40 -> #37 -> #38`

### PR #39 — 01 Dynamic Species Registry & Persistence
- source/final PR HEAD: `7003080a1381b1420274bcb4ab9cfc2b8c0cfc93`
- independently validated by 06: run `34637612926` — SUCCESS
- executable/test source remained identical to the approved version; later delta was workflow/docs only
- merge SHA: `4f60627943524631bde87cce78a50e637241be87`

### PR #40 — 03 Generated Species Reference Matching
- original source HEAD: `45f3b1cc49e707b8f52fa3bb457cc0bfe54a0bd7`
- latest-main ancestry refresh: `45e38b71fd6a598541e70b233674fba8af68c6d9`
- refreshed validated HEAD: `45baac5c2098ed30ac944fb01685ad382724c5a1`
- validation run: `34643902746` — SUCCESS
- final PR HEAD after temporary-workflow removal: `7fd04308c16a9dc383095217f0c0d5c5973c1d11`
- merge SHA: `28e63fa8d39db7129c8ea13f290953bd9364f611`

### PR #37 — 04 Generated Species Player Knowledge
- original source HEAD: `cc212e6d71b7c98a3f16d89b05e776ea6d5e1f2b`
- latest-main ancestry refresh: `71ff276e2e46479474cda8db1c1a1115fb999e96`
- refreshed validated HEAD: `b088a86d890cfc3457ceadbd580db7c672e23f6c`
- validation run: `34644042168` — SUCCESS
- final PR HEAD after temporary-workflow removal: `d5f57be561d58066bf7741b6c33739dd963cdcb1`
- merge SHA: `834cf70aa98d0ea5a5242e7757aa18c5fa04263d`

### PR #38 — 06 Dynamic Species Validation Gates
- original source HEAD: `30eed6f7ac0908167a880f1b2aa241964e9cedb5`
- latest-main ancestry refresh: `123ce0ca626588cfb51f99c033366b7c1bdcb0e5`
- refreshed validated HEAD: `678528f6931ed326ce1c4e02042e9f6a312fe8ce`
- validation run: `34644188978` — SUCCESS
- final PR HEAD after temporary-workflow removal: `0c16fd6b1a53cd7959974b334c64df955c620a7d`
- merge SHA: `be92521ced8d0362b10ae65e9aac6c35f15a4c0f`

## Final Consolidated Regression
Temporary one-shot main workflow tested exact integrated stack at:
- tested main: `0199c434454c51362c0f78f62936d325bdfe4c46`
- run: `34644334907` — SUCCESS

Results:
- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- targeted integrated stack: **8 files / 102 tests PASS**
  - molecular core 21/21
  - reaction candidates 16/16
  - reaction evaluation 9/9
  - reaction progression 10/10
  - dynamic species registry 11/11
  - generated species reference matching 12/12
  - generated species player knowledge 8/8
  - 06 adversarial registry validation 15/15
- full `npm test`: **16 files / 183 tests PASS**
- `npm run build`: PASS

The temporary final workflow was then removed. The only delta from tested main `0199c434...` to post-validation main `f8aa65796...` was deletion of that workflow; production and test source remained byte-equivalent to the green run.

## Cross-layer Contract Audit
### 01 Simulation — PASS
`Generated graph -> DynamicSpeciesRegistry -> stable SpeciesId -> vessel SpeciesState -> next timestep` is production-owned by 01. Product registration is staged before externally visible mutation, invalid registration prevents selection, selected products are committed transactionally, generated identities are deterministic/persistent, known canonical species are reused, and generated product states begin with honest `OPEN` scientific phase/reference metadata. No same-step hidden cascade is introduced.

### 03 Data — PASS
03 consumes an opaque internal canonical identity plus graph/formula/charge for optional scientific reference matching. It does not reinterpret or replace 01 SpeciesId. Formula equality alone cannot establish identity. Missing/ambiguous reference evidence remains non-exact and unsupported properties remain OPEN. CO remains charge-aware **POSSIBLE_REFERENCE_MATCH**, not EXACT, for the production neutral-formal-charge `C#O` versus PubChem `[C-]#[O+]` representation. Provenance is retained.

### 04 Game Layer — PASS
Internal species existence is separate from player knowledge. Unknown species use stable opaque `unknownRef` projections; common name/formula/graph/internal registry metadata are not exposed through the normal unknown projection. Scientific Record, free-form My Notes, analysis, confirmation, encyclopedia registration, material unlock, persistence association, and Developer Mode isolation remain Game-Layer concerns. Unlimited unlocked stock does not imply infinite vessel amount.

### 06 Validation — PASS
06 adds validation adapters, invariants, fixtures, tests and documentation only. It does not own or tune production canonicalization, matching, chemistry truth, or player knowledge semantics.

## Absolute Blockers
No blocker found in the integrated exact-main validation:
- atom/element/applicable-charge conservation: PASS
- failed product registration atomicity / no partial reactant loss: PASS
- deterministic generated IDs: PASS
- duplicate suppression: PASS
- same-step cascade prohibition: PASS
- known-species reuse: PASS
- formula-only false identity prevention: PASS
- unknown identity leakage guard: PASS
- no fabricated scientific properties: PASS
- serialize/restore identity stability: PASS
- full-suite regression: PASS

## Scientific Limitations / OPEN
- complete stereochemistry identity semantics: OPEN
- resonance/aromatic representation completeness: OPEN
- complete electronic/spin-state identity: OPEN
- real-world identity coverage for arbitrary generated species: OPEN
- scientific properties absent from reference data: OPEN
- absolute large-registry performance threshold remains WATCH rather than an invented pass/fail threshold

## Vercel Policy
PR #35 remains authoritative. Root `vercel.json` still has `git.deploymentEnabled = false`.
No Vercel production or preview deployment was created during this integration task. Manual deployment remains prohibited until explicitly requested by the user.

## Final Status
**PASS — Dynamic Species Registry stack integrated into production main.**

## Next
**Reaction Network / Multi-step Chemistry Execution**
