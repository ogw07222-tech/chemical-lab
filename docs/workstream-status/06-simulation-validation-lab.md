# 06 — Simulation Validation Lab

- Owner: Chemistry Simulation Validation Engineer / Regression Test Developer / Scientific Model Auditor / Performance Validation Engineer
- Current phase: Dynamic Species Registry validation
- Overall state: STAGE_A_PREPARED / STAGE_B_PASS / PR39_INTEGRATION_APPROVED
- Last updated: 2026-09-12
- Latest production main SHA checked: `4c12c2b9be6053887f471c288618590114dc32b4`
- Validation-prep branch / PR: `feature/06-dynamic-species-validation-prep` / PR #38
- 01 Dynamic Species Registry PR: #39 — `feat(sim): add dynamic species registry and persistence`
- Exact 01 PR HEAD tested: `7003080a1381b1420274bcb4ab9cfc2b8c0cfc93`
- Independent validation branch: `validation/06-pr39-dynamic-species`
- Final validation HEAD: `993b06cde7d3cb3a80feaa56a3a4eca7b23c06b5`
- Final validation run: `34637612926` — SUCCESS

## Current Objective
Independently validate 01 Dynamic Species Registry & Generated Species Persistence without tuning or modifying 01 production implementation.

## Source of Truth
- Production baseline: latest `main` at `4c12c2b9be6053887f471c288618590114dc32b4`.
- Exact implementation under validation: PR #39 HEAD `7003080a1381b1420274bcb4ab9cfc2b8c0cfc93`.
- Scientific threshold authority: `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`.
- Final re-check confirmed PR #39 remained open, mergeable, and at the same exact HEAD after validation.

## Stage A — Validation Matrix / Failure Fixtures
Prepared on PR #38:
- canonical identity permutation invariance;
- duplicate suppression and duplicate-explosion checks;
- same-formula false-merge counterexamples;
- bond-order / formal-charge / net-charge distinction;
- malformed graph rejection;
- atomic registration failure / partial-mutation blocker;
- element / atom / charge conservation and finite/non-negative amounts;
- deterministic registry IDs/state/events/serialization;
- serialize/restore identity stability;
- timestep N -> N+1 participation and same-step cascade prohibition;
- known-species reuse;
- unknown-species no-fabricated-truth policy;
- performance baseline with no invented engineering threshold.

`docs/validation/DYNAMIC_SPECIES_REGISTRY_VALIDATION.md`, `src/validation/species-registry.ts`, and `tests/dynamic-species-registry.validation.test.ts` hold the reusable validation contract/helpers.

## Stage B — Exact PR #39 Validation
The independent validation branch was created directly from exact PR #39 HEAD `7003080a1381b1420274bcb4ab9cfc2b8c0cfc93`; 01 production files were not modified.

Added independent adversarial test coverage in `tests/validation.dynamic-species-registry.pr39.test.ts` and a branch-only validation workflow.

### Final strict run
Run `34637612926`, tested validation HEAD `993b06cde7d3cb3a80feaa56a3a4eca7b23c06b5`.
The validation branch ancestry is exact PR #39 HEAD plus 06-only test/type/workflow commits.
The workflow uses bash pipefail semantics so piped logging cannot hide command failures.

Results:
- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS / zero diagnostics
- `npm run lint`: PASS
- independent PR39 registry validation: **15/15 PASS**
- production dynamic registry tests: **11/11 PASS**
- reaction progression regression: **10/10 PASS**
- full `npm test`: **14 files / 163 tests PASS**
- `npm run build`: PASS

An earlier validation iteration exposed a 06-only test typing defect and a logging-pipeline masking risk. Both were corrected in the validation harness only; no PR #39 production behavior was changed. The final pipefail-enabled run is the authoritative evidence.

## Validation Matrix Results

### Canonicalization — PASS
- 128 deterministic pseudo-random atom/bond/runtime-ID permutations resolved to the same canonical representation, canonical key, and generated species identity.
- Bond-list and atom ordering did not affect identity in the tested current graph model.
- Different connectivity, bond order, formal charge, and resulting net charge remained distinct.

Limitations remain OPEN for full stereochemistry, resonance equivalence, chemically complete aromatic representation equivalence, and complete electronic/radical-state chemistry beyond the current graph model.

### Duplicate suppression — PASS
Repeated resolution of the same product graph at 10 / 100 / 1000 attempts retained one registry identity and stable generated ID.

### False merge / collision safety — PASS within current implementation contract
- Same molecular formula with different connectivity did not merge.
- Current registry indexes by canonical key but stores and verifies the exact canonical structural representation before reuse.
- Same-key / different-representation collision is rejected rather than merged.
- No true 64-bit FNV collision was brute-forced; collision-path safety is established by source/contract audit and explicit exact-verification logic rather than observed natural collision generation.

### Malformed graph rejection — PASS
Rejected adversarial fixtures include missing atom reference, self bond, duplicate contradictory semantic bond, zero/NaN bond order, non-integer formal charge, and coarse over-valence graph. Registry size remained unchanged after rejection.

### Atomic mutation — PASS / absolute blocker cleared
Forced product-registration failure produced no selected reaction, no reactant consumption, and no authoritative registry mutation. `PRODUCT_REGISTRATION_FAILED` was surfaced explicitly.

### Conservation — PASS
Generated-product success path preserved element inventory, atom inventory, and applicable net charge. Final species amounts remained finite and non-negative.

### Determinism — PASS
Identical registry/state/candidates/dt/config produced identical generated IDs, final vessel species amounts, `ReactionProgressEvent` records, and serialized registry state.

### Persistence — PASS
`serialize -> restore -> resolve` preserved generated identity, canonical key, registry size, dedup behavior, and deterministic serialization. Registration order did not change serialized order.

### Timestep semantics — PASS
- Timestep N production makes the generated product exist at the end of N.
- Same-step downstream consumption is blocked via the existing zero-initial-reactant semantics.
- On timestep N+1 the generated species can participate normally.

### Known species reuse — PASS
Known canonical graph reuse returns the existing known species ID rather than inventing a generated duplicate.

### Unknown species handling — PASS structurally / OPEN scientifically
A valid unmatched structure receives a deterministic internal generated ID. Generated records remain `referenceMatchStatus: OPEN` and `scientificStatus: OPEN`; no real-world name or physical/thermochemical property is fabricated. 03 reference matching remains separate from registry validity.

### Performance — OPEN / WATCH, no blocker observed
No canonical engineering threshold exists, so no arbitrary performance PASS threshold was invented.

Final independent-run observation on GitHub runner:
- 1000 duplicate resolve/register operations: ~105.8 ms total
- 10000 canonical-key lookups: ~86.9 ms total
- registry size after repeated duplicate resolution: 1

Full-suite observation of the same synthetic performance fixture varied with shared-run load (~164.2 ms / ~177.4 ms respectively), so these numbers are environment-local baselines only.

Source audit found canonical-key lookup backed by `Map` rather than a naive full-registry graph-isomorphism scan. Canonicalization itself remains bounded by the molecular-core canonical search budget. Reaction progression still performs vessel-species searching for existing states; scaling at much larger vessel/registry workloads remains WATCH / OPEN pending a pre-committed engineering budget and larger stress matrix.

## Absolute Blockers
No absolute blocker was found on exact PR #39 HEAD.

Explicit blocker gates all PASS:
- distinct structures false-merged: NO
- malformed graph registered: NO
- registration failure partially mutates registry/vessel: NO
- reactants consumed while product registration fails: NO
- element/atom/applicable-charge conservation violation: NO
- negative/NaN/Infinity authoritative amount: NO
- identical input produces unstable generated identity/state/events: NO
- serialize/restore identity drift or duplicate creation: NO
- same-step hidden generated-species cascade: NO
- next-timestep generated species inaccessible: NO

## PASS / FAIL / OPEN
### PASS
- Structural registry correctness within the current molecular graph model.
- Canonical permutation stability for tested supported graphs.
- Duplicate suppression and false-merge prevention.
- Malformed rejection.
- Transactional product registration / atomic mutation.
- Conservation and finite/non-negative state.
- Determinism and persistence.
- Same-step cascade prevention and next-step participation.
- Known species reuse and honest unknown-species status.
- Repository typecheck/lint/tests/build on independent exact-head validation branch.

### FAIL
- None established on exact PR #39 HEAD.

### OPEN / WATCH
- Full stereochemical identity semantics.
- Resonance-equivalent and chemically complete aromatic representation equivalence.
- Complete radical/electronic-state chemistry semantics beyond the represented graph fields.
- Real-world generated-species identity and property completeness pending 03 evidence.
- Absolute performance acceptance threshold and large-scale registry/vessel stress behavior.
- Deliberate natural FNV-1a collision generation was not brute-forced; collision handling is source-audited safe by exact representation verification.

## Owner Handoffs
- 01: maintain canonicalization/registry/persistence/transaction semantics; investigate any future false-merge, mutation, determinism, or scaling regression.
- 03: generated-species reference matching, provenance, real-world identity, authoritative properties.
- 04: player knowledge/discovery; must not redefine registry identity.
- 02: thermo/kinetic evaluation and missing-property behavior for generated species.
- 05: presentation only; do not infer or fabricate identity/property truth.
- 07: integrate PR #39 using exact-head protection and preserve the validated executable/test tree relationship.

## Integration Decision
**PASS — 06 approves integration of PR #39 at exact HEAD `7003080a1381b1420274bcb4ab9cfc2b8c0cfc93`.**

Approval is scoped to the current Dynamic Species Registry & Generated Species Persistence contract and current molecular graph model. OPEN scientific identity/property/performance limitations do not constitute registry-correctness failures and must remain explicitly labeled.

If PR #39 HEAD changes after this record, this approval becomes stale and 06 must revalidate the new exact HEAD or prove executable/test equivalence before integration.

## No Tuning
**No tuning performed.**
