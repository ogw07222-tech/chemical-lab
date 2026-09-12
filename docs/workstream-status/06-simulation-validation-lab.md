# 06 — Simulation Validation Lab

- Owner: Chemistry Simulation Validation Engineer / Regression Test Developer / Scientific Model Auditor / Performance Validation Engineer
- Current phase: Phase 3A exact-head stack validation
- Overall state: PASS — PHASE3A_VALIDATION_PASS / MERGE_ALLOWED_EXACT_HEADS_ONLY
- Last updated: 2026-09-12
- Production main baseline: `3055ce6d2229806f4560a220ca835fb4b7f7c303`
- PR #45 current HEAD: `92ca3ff39a1fc2616f8ab88df286575c15b298ea`
- PR #46 exact HEAD: `6d04b9aa96bfce02717cb9a233ded33d29960132`
- PR #47 current HEAD: `70d0d68523c0a60ff65377833459eb2547bf82b5`
- Validation branch: `validation/06-phase3a-stack`
- Final validation HEAD: `8080128fb8c2c7dcd51a40a2fa7c90769f888a8a`
- L1 validation/integration fix commit: `9c5c445d36e74a7f085fc99ac281c28268e2c27a`
- Final full-stack run: `34673454682` — SUCCESS
- Determinism repeat run: `34673454706` — SUCCESS

## Source-equivalence audit
### PR #45
Compared validated executable/test HEAD `74f60604bd3a5822140914b6dffaa9e3c72d6d65` with current HEAD `92ca3ff39a1fc2616f8ab88df286575c15b298ea`.
Differences are only removal of the temporary validation workflow and 02 workstream-status documentation. Executable/test blobs are unchanged.

### PR #47
Compared validated UI code HEAD `b149bf67b8f26a9e5440c0cb7fed68761039ca30` with current HEAD `70d0d68523c0a60ff65377833459eb2547bf82b5`.
Difference is 05 workstream-status documentation only. Executable/test blobs are unchanged.

PR #47 is stacked directly on exact PR #46 HEAD, so #46 was not duplicated during stack assembly.

## Lint blocker reproduction and classification
Exact PR #46 HEAD was tested before any fix.

Reproduced full-repository lint error:
- file: `src/integration/phase3a-reaction-network.ts`
- line/column: `241:31`
- rule: `@typescript-eslint/no-unused-vars`
- message: `'_amountToleranceMol' is assigned a value but never used`

Classification: **L1 — mechanical lint-only unused symbol**.

The binding exists only to omit Phase3A-only `amountToleranceMol` from the rest object passed to Phase2E. The tolerance is already read and enforced by the Phase3A event-contract checks for same-step cascade prevention and shared-reactant overconsumption.

Permitted validation/integration fix:
```ts
const { amountToleranceMol: _amountToleranceMol, ...phase2eConfig } = config;
void _amountToleranceMol;
```

Semantic effect: none. It preserves the omission behavior and does not change tolerance values, invariant logic, reaction selection, extent, state mutation, or event semantics.

## Stack assembly
Independent validation branch was assembled as:

`main baseline + PR #47 (already containing exact PR #46) + PR #45 + L1 fix + 06 validation-only tests/workflows`

PR #45 was overlaid through temporary validation-only PR #48; no production merge occurred.

## Validation results
### Multi-step / same-step boundary — PASS
- A→B / B→C: product B produced at N is unavailable as a reactant during N and eligible at N+1.
- A→B→C→D multi-timestep chain: deterministic timestep boundaries, event sequence, and final amounts.
- branching and generated-unknown next-step participation covered by Phase3A network tests.
- same-step generated-product consumption is rejected by initial-snapshot reactant checks.

### Shared-reactant competition — PASS
- aggregate demand is computed for the whole equal-rank proposal group before mutation;
- common species scaling prevents overconsumption;
- candidateId lexical ordering determines deterministic event order, not pre-emptive inventory capture;
- negative amounts are rejected.

### Registration atomicity — PASS
Existing Dynamic Species Registry / Phase2E regression plus Phase3A caller-level tests confirm failed product registration does not commit partial vessel/registry state or consume reactants. No authoritative progress event/heat is committed for a failed registration.

### Conservation / numerical sanity — PASS
Element/atom/applicable-charge conservation and finite/non-negative amounts remain enforced by progression/registry validation. NaN/Infinity/negative authoritative state is rejected.

### Kinetics — PASS within current Phase 3A contract
- `DIMENSIONED_RATE`: mol/s × dt reaches the bounded resolver extent path.
- `RELATIVE_RATE`: remains normalized/bounded APPROXIMATED progression.
- `QUALITATIVE_ONLY` / `OPEN`: do not fabricate numeric extent requests.
- missing activation barrier does not create fake activation energy.
- environment dependency metadata is descriptive unless provider support exists.

### Reversibility — PASS for metadata boundaries / science remains OPEN
Forward/reverse channel metadata is deterministic and independent. `detailedBalanceSupported` remains false without explicit evidence; no `K_eq`, reverse rate, or equilibrium solution is invented. General equilibrium/detailed-balance science remains OPEN.

### Thermal aggregation — PASS
- multiple known exothermic reactions;
- exothermic + endothermic partial and exact cancellation;
- all missing ΔH;
- mixed known + missing ΔH;
- event-order reversal;
- single-reaction regression.

Known reaction heat is aggregated from committed extents and available ΔH and applied to the thermal state once per timestep. Per-event heat facts do not independently mutate temperature.
Coverage metadata `knownContributionCount`, `committedContributionCount`, `openHeatCandidateIds`, and `thermalCoverage` behaved as specified. Mixed known+OPEN applies known heat while keeping overall scientific status OPEN/PARTIAL.

### Determinism — PASS
Same inputs reproduce composition, generated identities, reaction/event ordering, heat result, provider composition, and timeline order. Network/progression/UI projection determinism gates were rerun 10 times successfully.

### Provider/UI boundaries — PASS
`Phase3AProviderProjection` derives composition and reaction facts from simulation authority. UI projection does not recompute stoichiometry, extent, rate, equilibrium, reaction heat, or molecular identity.

Normal mode keeps generated SpeciesId/canonical/candidate internals opaque. Developer Mode exposes diagnostics separately. Unknown→confirmed transition occurs through the player-knowledge resolver boundary.

APPROXIMATED numeric facts are visibly marked approximate; OPEN/missing heat is not rendered as exact numeric heat. No player-facing rate is invented.

Timeline projection preserves provider order and timestepId+sequence metadata and de-duplicates repeated delivery using stable eventId.

### PR #44 workbench / responsive regression — PASS
Final browser smoke passed:
- 1536×900
- 1440×900
- 1024×768
- 390×844

No horizontal overflow or blocking console/page errors. Catalog/condition collapse, T/P/V summary, central workbench/vessel, structural notation, inspector/notes, mobile navigation, and minimal-decoration constraints remain intact. Reaction activity remains secondary to the workbench.

### Testing-library audit — PASS
UI tests use semantic-region scoping (`within(...)`) for legitimate repeated content. No new arbitrary `getAllByText(...)[0]`, first-element, or nth-child weakening was required for Phase3A validation.

## Final checkpoint
Final validation HEAD: `8080128fb8c2c7dcd51a40a2fa7c90769f888a8a`

Run `34673454682`:
- source ancestry checks: PASS
- `npm ci`: PASS
- typecheck: PASS
- lint: PASS with 0 errors / 1 non-blocking pre-existing React hook dependency warning in `src/ui/provider.tsx`
- targeted: **11 files / 122 tests PASS**
- full: **20 files / 222 tests PASS**
- build: PASS
- browser smoke: PASS at all four required dimensions

Run `34673454706`:
- deterministic network/progression/UI projection subset repeated 10×: PASS

## Scientific OPEN items
- general equilibrium solver and equilibrium convergence;
- guaranteed detailed balance / reverse-rate inference;
- general reaction-order inference and broad dimensioned rate-law data;
- non-ideal activity and pressure-dependent kinetic laws;
- diffusion/transport/surface-limited kinetics;
- composition-dependent heat capacity and full phase/latent-heat coupling;
- complete stereochemistry/resonance/aromatic/electronic-state identity semantics;
- real-world generated-species identity/property completeness where 03 evidence is absent.

These remain OPEN and are not converted into PASS.

## Final decision
**PHASE3A_VALIDATION_PASS**

**MERGE_ALLOWED_YES_FROM_EXACT_HEADS_ONLY**

Approved source heads:
- PR #45: `92ca3ff39a1fc2616f8ab88df286575c15b298ea`
- PR #46: `6d04b9aa96bfce02717cb9a233ded33d29960132`
- PR #47: `70d0d68523c0a60ff65377833459eb2547bf82b5`
- required L1 lint-only fix: semantic-equivalent change represented by validation commit `9c5c445d36e74a7f085fc99ac281c28268e2c27a`

If any source executable/test HEAD changes, or integration applies a different lint fix with semantic differences, this approval is stale and requires revalidation.

## No Tuning
**No tuning performed.**
