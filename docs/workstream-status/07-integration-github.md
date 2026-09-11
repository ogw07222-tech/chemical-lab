# 07 — Integration & GitHub

- Owner: Lead Integration Developer / Repository Maintainer / GitHub Integration Engineer / CI / Deployment Coordinator
- Current phase: Phase 2 — Reaction Candidate/Data/Evaluation/Validation Foundation Integrated
- Overall state: PASS — PHASE2_REACTION_FOUNDATION_INTEGRATED
- Last updated: 2026-09-11
- Starting production main SHA: `a4606143e8f249e5b9a398f72c86c8171ca405b5`
- Final functional main SHA before this status-only closeout: `22ac5bca99b9512a79de703fd1440474a8544d5d`
- Final functional tree SHA: `102494e9ea60d9f3a1c39987897b031b0bc5aae2`

## Phase 2 Source of Truth
Exact owner PR HEADs used for integration:
- PR #22 — Chemistry Data Pack: `cd99247c169a21cbfe684934a08a643a7f9a1570`
- PR #21 — Reaction Candidate Engine: `2452ae3c28e15f14846784cea10ab6044e8b9a03`
- PR #19 — Reaction Evaluation: `acb63f36dab34f491d92fb5ed8a9be24e88ea785`
- PR #20 — Reaction Validation Matrix: `9370136bfe003e37c09d2d1eeb6d4c9c581b8d9d`

All four were rechecked against the task-start main, staged in dependency order `#22 -> #21 -> #19 -> #20`, validated together, and production-merged only from their exact HEADs using expected-head protection.

## Dependency / Interface Audit
- 03 -> 01: **PASS** — `minimumElementProvider` implements the existing `ElementProvider`; no duplicate Atom/Bond/Species domain types; SI/provenance/missing-data behavior preserved.
- 01 -> 02: **PASS** — actual `ReactionCandidate` is adapted through a narrow read-only projection; 02 does not duplicate candidate graph/reaction semantics.
- 03 -> 02: **PASS** — species thermochemistry and element data are projected through production providers. A later integration audit found the existing 02 bond-energy fallback hook was not yet wired to 03 bond references; PR #30 added a conservative provenance-backed adapter. Ambiguous, formed-bond, or incomplete cases remain OPEN rather than receiving partial/fabricated estimates.
- 01/02 -> 06: **PASS** — real production candidate/evaluation outputs are projected into the validation matrix. Validation logic is not copied into production chemistry and no tuning was introduced.

No direct source/test overlap conflict, incompatible duplicate interface, or circular dependency was found in the four owner PRs.

## Temporary Integration
Primary integration branch: `integration/phase2-reaction-foundation`.

Temporary staging PRs:
- #23 staged #22
- #24 staged #21
- #25 staged #19
- #26 staged #20

Production integration wiring added:
- `src/integration/phase2-reaction.ts`
- `tests/phase2-reaction-integration.test.ts`

The first two one-shot workflow attempts exposed integration-test assumptions about H2O phase/species-key spelling; owner production suites continued to pass. Canonical data keys from 03 are `H2`, `O2`, `N2`, `H2O`, `CO`, `CO2`, `CH4`, `NH3`. The proof was corrected to use the actual provider contract rather than invent an alias.

Successful consolidated tested commit: `2d0273aadeb92db41f01b06a6b65e0b57c98f381`.
GitHub Actions run: `34593811108` — **SUCCESS**.

Validation evidence:
- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS
- molecular core: 21/21 PASS
- chemistry data: 16/16 PASS
- reaction candidates: 16/16 PASS
- reaction evaluation: 9/9 PASS
- reaction validation matrix: 8/8 PASS
- Phase 2 end-to-end proof: 2/2 PASS
- full suite: 10 files / 124 tests PASS
- `npm run build`: PASS

After the four original PRs were merged to main, temporary PR #29 merged production main back into the integration branch only to normalize ancestry. PR #27 then contained exactly two integration-only files. Their blobs were byte-identical to the successful tested commit:
- `src/integration/phase2-reaction.ts`: `fa524a2f8ca66205f6800bb69a9b272a398d7c63`
- `tests/phase2-reaction-integration.test.ts`: `b14c5a831da73ffa292ff53dec1f892afe850ade`

## Production Merges
- PR #22 source `cd99247c169a21cbfe684934a08a643a7f9a1570` -> merge `3f68b2badb296d1d93c5498bc22aa892f157924e`
- PR #21 source `2452ae3c28e15f14846784cea10ab6044e8b9a03` -> merge `ba463e60819a4f423ac132f7e9ad23109f556b0f`
- PR #19 source `acb63f36dab34f491d92fb5ed8a9be24e88ea785` -> merge `e87a7706462bda918ce930e98d3ab64f97aa9ef6`
- PR #20 source `9370136bfe003e37c09d2d1eeb6d4c9c581b8d9d` -> merge `9c11c1c35d7a9c008c07811002229fa6528d7e75`
- PR #27 integration wiring source `86328f5c0c87b25742010d4d007e740f8b3ea5e2` -> merge `1bb93cb23cf421c8453866dd8fb943fc49dc0930`

## Bond / Reference Data Wiring Completion
A final contract audit found that the first production bridge connected 03 species thermochemistry but not 03 bond references to 02's already-defined `getBondEnergyApproximation` hook. This was treated as an integration gap, not a new chemistry-model task.

Branch: `integration/phase2-bond-reference-bridge`.
Validated tested commit: `604191de71bec5e3c2ef6a8e97fc758945606763`.
Actions run: `34598617732` — **SUCCESS**.

Evidence:
- npm ci: PASS
- typecheck: PASS
- lint: PASS
- bond-reference integration: 2/2 PASS
- Phase 2 targeted regression: 6 files / 72 tests PASS
- full suite: 11 files / 126 tests PASS
- build: PASS

The adapter uses only exact reactant-species, bond-order and atom-element matches for complete cleavage-only transformations. It propagates existing 03 provenance/status/confidence. It refuses partial estimates for formed bonds, order changes, ambiguous records, or unresolved products, preserving OPEN semantics.

After validation, only the branch-scoped workflow was removed. Production blobs remained byte-identical to the successful run:
- `src/integration/phase2-bond-reference.ts`: `5c927ba1ae618d6300c7e7ae72014dd4b80dc462`
- `tests/phase2-bond-reference-integration.test.ts`: `ba30ce4f2903019eaef07165784564ac50135c76`

PR #30 source `a1afbc0f9d813ddd83fc99a13974bd3ded5924f9` -> merge `22ac5bca99b9512a79de703fd1440474a8544d5d`.
Production main was re-read after merge and both blobs matched the validated values exactly, so no redundant full Actions run was required.

## Scientific Integration Gates
- Conservation — atoms/elements/charge/explicit electrons where represented: **PASS**
- Structural sanity / invalid graph / current coarse over-valence checks / duplicate candidate removal: **PASS**
- Deterministic candidate IDs/order and deterministic evaluation ranking: **PASS**
- Thermodynamic sign/direction invariants: **PASS**; missing evidence remains OPEN and no fake precision is inserted
- Kinetic model invariants: **PASS** for positive-Ea temperature behavior and catalyst thermodynamic isolation; real candidates lacking activation-barrier data remain **OPEN**, correctly
- Provenance / SI / explicit missing values: **PASS**
- Validation verdict `PASS|FAIL|OPEN` separated from scientific model status: **PASS**
- Threshold authority remains `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`: **PASS**
- Real-experiment quantitative benchmark corpus/metrics: **OPEN** — no eligible populated corpus exists yet

## Minimum End-to-End Phase 2 Proof
**PASS**.

Production path now supports:
`known SpeciesState -> reactive-site detection -> ReactionCandidate[] -> conservation gate -> thermo/kinetic evaluation -> deterministic ranking -> production validation view/result`.

The integration proof uses actual 01 candidate generation, actual 02 evaluation, actual 03 providers, and actual 06 validation projections. Unknown product identity, absent barrier data, and unsupported bond-reference cases propagate OPEN.

The foundation intentionally does **not** perform reaction extent or state mutation.

## Explicitly Not Implemented in This Phase
- competing-reaction resolution / reaction extent
- species amount mutation
- timestep reaction network
- equilibrium solver
- dynamic species registry / generated-species persistence
- UI production wiring for reactions
- electrochemistry, Nernst, Faraday, Butler–Volmer, or electrode models

These remain outside this integration closeout.

## Owner Status Document Synchronization
Owner implementation content is broadly consistent with merged code, but operational metadata is stale after integration:
- 01 still describes PR #21 as active and repository-native validation as OPEN.
- 02 still describes PR #19 as active and the executable 01 candidate type as absent.
- 03 still describes PR #22 as active/ready for review.
- 06 still states the production Phase 2 reaction engine is absent; this is now directly stale after production integration.

This is a **documentation synchronization OPEN item**, not a functional/scientific integration blocker. Owners should refresh their own status documents from latest main rather than 07 rewriting domain status on their behalf.

## Final Status
**PASS — Phase 2 reaction candidate/data/evaluation/validation foundation integrated on main.**

## Next Action
Only after this PASS, proceed to **Phase 2E — Reaction Resolution & State Progression**:
`candidate ranking -> competing reaction resolution -> reaction extent -> species amount update -> reaction heat -> thermal feedback -> next timestep`.

Do not move to electrochemistry yet.
