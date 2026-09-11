# 06 — Simulation Validation Lab

- Owner: Chemistry Simulation Validation Engineer / Regression Test Developer / Scientific Model Auditor / Performance Validation Engineer
- Current phase: Dynamic Species Registry validation preparation
- Overall state: STAGE_A_PREPARED / STAGE_B_WAITING_FOR_01_PR / INTEGRATION_APPROVAL_OPEN
- Last updated: 2026-09-12
- Latest production main SHA checked: `4c12c2b9be6053887f471c288618590114dc32b4`
- Validation-prep branch: `feature/06-dynamic-species-validation-prep`
- 01 Dynamic Species Registry branch observed: `feature/dynamic-species-registry`
- 01 Dynamic Species Registry PR: `NOT YET CREATED` at last check
- Exact 01 tested HEAD: `OPEN`

## Current Objective
Prepare and then execute independent validation for 01 Dynamic Species Registry & Generated Species Persistence without tuning or modifying 01 production implementation.

## Source of Truth
- Production baseline: latest `main` at `4c12c2b9be6053887f471c288618590114dc32b4`.
- Scientific threshold authority: `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`.
- Phase 2E reaction progression is already integrated on main and currently defers unresolved products rather than inventing IDs.
- Stage B may begin only after 01 opens a PR; the exact PR number and exact HEAD SHA must be rechecked before execution.

## Stage A — Prepared Validation Matrix
Added `docs/validation/DYNAMIC_SPECIES_REGISTRY_VALIDATION.md` and executable validation helpers/tests.

Priority risks covered:
- duplicate species explosion;
- atom/bond ordering dependent identity;
- isomer false merge;
- charge false merge;
- malformed graph registration;
- unstable generated IDs;
- save/load ID drift;
- partial state mutation;
- reactants consumed while products are missing;
- conservation failure;
- same-step hidden cascades;
- nondeterministic registry ordering;
- next-timestep product inaccessibility;
- registry lookup/resolve/timestep performance degradation.

## Executable Preparation
### Current-main canonical foundation tests
`tests/dynamic-species-registry.validation.test.ts` includes:
- 100 fixed-seed atom/bond/runtime-ID permutations of the same graph -> same structural representation/canonical key;
- same-formula different-connectivity fixture -> different canonical key;
- bond-order distinction;
- formal/net-charge distinction;
- malformed missing endpoint, self bond, duplicate semantic bond, zero/NaN bond order, non-integer formal charge rejection.

### Registry observation/handoff gates
`src/validation/species-registry.ts` defines adapter-independent validation for:
- canonical identity stability;
- false merge / hash collision safety;
- 10/100/1000 duplicate suppression observations;
- failed-registration atomic mutation;
- element/atom/charge conservation plus finite/non-negative amounts;
- timestep N/N+1 semantics and same-step cascade prohibition;
- deterministic replay;
- serialize/restore identity and behavior stability;
- known-species reuse;
- valid unknown-species internal identity without fabricated real-world truth/properties;
- performance samples with explicit OPEN when no canonical engineering threshold exists.

No fake production registry implementation is introduced.

## Failure Criteria / Absolute Blockers
The following are immediate integration-blocking FAIL conditions:
- distinct connectivity/bond-order/charge structures false-merged;
- malformed graph registered into authoritative state;
- registration failure leaves any partial registry/vessel mutation;
- reactants consumed when product registration fails;
- element/atom/applicable-charge conservation violation;
- negative, NaN, or infinite authoritative amount;
- generated species ID/canonical key nondeterministic for identical input/config;
- serialize/restore ID drift or duplicate creation;
- generated product participates in a hidden same-step cascade;
- generated product cannot participate in candidate generation on timestep N+1.

## Canonicalization / Collision Audit
Current molecular core canonical identity is based on deterministic structural representation plus a 64-bit FNV-1a hash key. Therefore Stage B requires evidence that registry identity resolution does not rely on hash equality alone when exact structures differ. Same-hash/different-structure merge is FAIL; exact-verified collision-safe disambiguation can PASS; unobservable collision handling is OPEN.

Current unsupported/uncertified identity semantics remain OPEN unless 01 explicitly implements them:
- stereochemistry;
- resonance-equivalent representations;
- aromatic representation equivalence;
- complete radical distinctions;
- complete unsupported/over-valence chemistry-domain rejection.

## Known / Unknown Species Policy
Known graph reuse must derive the actual canonical known set from the exact tested 01 PR/repository state. A known graph such as H2O must reuse its existing ID rather than create a generated duplicate.

A structurally valid unmatched graph is allowed to receive an internal generated identity if supported by 01. Real-world identity and property completeness remain OPEN without 03 evidence. Registry correctness and 03 reference matching are separate verdicts.

## Performance Plan
Stage B records versus registry size:
- lookup latency;
- resolve/register latency;
- timestep overhead;
- registry-size growth under duplicate attempts;
- candidate counts when combined with candidate generation.

Recommended sizes: 10, 100, 1000 plus the largest cheap deterministic case. No engineering threshold is currently canonical, so finite measurements are baseline/WATCH and performance remains OPEN unless a pre-committed budget exists. Inspect for naive full-registry graph-isomorphism scans.

## Test Execution
### Attempted on Stage A branch
- `git clone` of validation branch: BLOCKED in local execution environment because `github.com` DNS resolution failed.
- Therefore `npm ci`, repository-native `npm run typecheck`, Vitest, lint, and build were not executed locally in this task stage.
- Available global runtime: Node v22.16.0, npm 10.9.2, TypeScript 5.8.3; Vitest is not installed globally.

No runtime PASS is inferred from unexecuted repository tests.

### Stage B required exact-HEAD execution
After 01 PR creation, execute where environment permits:
- `npm ci`;
- `npm run typecheck`;
- `npm run lint`;
- dynamic-registry targeted tests;
- reaction-progression tests;
- randomized/property-style registry tests;
- full `npm test`;
- `npm run build`;
- targeted performance baseline.

Record exact test counts and exact tested HEAD.

## PASS / FAIL / OPEN
### PASS
- Stage A validation matrix, fixtures, adapter boundary, and failure criteria are prepared on latest main.
- Existing main molecular canonical foundation passes prior integrated tests and the new Stage A suite is written to attack permutation, false-merge, and malformed-graph risks.
- Validation verdict remains separate from scientific model/reference status.
- No tuning, property fabrication, threshold relaxation, or 01 production modification was performed.

### FAIL
- No Dynamic Species Registry implementation FAIL can be asserted before an exact 01 PR HEAD is tested.

### OPEN / BLOCKED
- Stage B exact-head validation: OPEN — no 01 PR exists yet.
- Integration approval: OPEN.
- Repository-native Stage A execution in current local environment: BLOCKED by DNS/dependency access.
- Stereochemistry/resonance/aromatic/radical identity completeness: OPEN unless implemented by 01.
- Real-world identity/property completeness: OPEN pending 03 evidence.
- Performance PASS threshold: OPEN; only baseline/WATCH is allowed without a committed budget.

## Owner Handoffs
- 01: registry identity/canonicalization, exact collision verification, malformed rejection, atomic commit, persistence, conservation, timestep semantics, performance.
- 03: reference matching, provenance, real-world identity, authoritative properties.
- 04: player discovery/knowledge semantics only; must not change registry identity.
- 02: thermo/kinetic evaluation of generated species and missing-property handling.
- 05: UI presentation only; generated IDs/properties must not be fabricated in UI.
- 07: exact-head CI/integration execution and merge sequencing.

## Integration Decision
`OPEN` — Stage A is prepared, but 01 integration is **not approved** until the exact Dynamic Species Registry PR HEAD completes Stage B validation without absolute blockers.

## No Tuning
**No tuning performed.**
