# Dynamic Species Registry Validation Matrix

## Status
Prepared by 06 - Simulation Validation Lab against production `main` before the 01 Dynamic Species Registry PR exists.

Scientific threshold authority remains `docs/contracts/REAL_EXPERIMENT_VALIDATION.md`. This document adds structural/integration failure gates; it does not tune chemistry or change scientific acceptance thresholds.

## Validation Stages

### Stage A — pre-01-PR preparation
Use latest production `main` only. Prepare fixtures, adapters, failure criteria, and baseline canonicalization tests. Do not certify the unreviewed feature branch.

### Stage B — exact 01 PR validation
After 01 opens a PR, record the exact PR number and exact HEAD SHA. Test that exact HEAD, not a historical branch state. If the HEAD changes, rerun affected validation before integration approval.

## Absolute Blockers
Any of the following is an integration-blocking `FAIL`:

- distinct molecular structures merged into one registry identity;
- charge-distinct structures merged into one identity;
- malformed graph accepted into authoritative registry state;
- failed product registration partially mutates registry or vessel state;
- reactants consumed while products are absent because product registration failed;
- element, atom, or applicable net-charge conservation failure on a successful mutation path;
- negative, NaN, or infinite authoritative species amount;
- generated identity or canonical key changes under identical deterministic replay;
- save/restore changes species identity or creates duplicates;
- newly generated product participates recursively inside the same timestep;
- generated product is unavailable to candidate generation on the following timestep.

## Canonicalization Matrix

Required PASS cases:

- atom permutation invariant;
- bond list permutation invariant;
- runtime atom/bond ID renaming invariant;
- identical graph -> same canonical identity;
- different connectivity -> different identity;
- different bond order -> different identity;
- different formal charge -> different identity;
- different net charge -> different identity.

The current molecular foundation includes stereochemistry/radical/aromatic/coordination fields or hooks, but dynamic-registry support for stereochemical identity, resonance-equivalent representations, aromatic representation equivalence, and complete radical-state identity is not assumed. Those capabilities are `OPEN` unless 01 explicitly implements and validates them.

## Collision / False-Merge Policy

Same formula is not sufficient for species identity. Synthetic same-formula connectivity isomers are mandatory fixtures.

The current molecular canonical key is a hash of a deterministic structural representation. Therefore the registry must not treat hash equality alone as proof of graph equality. If two distinct exact structural representations share a canonical hash/key, the registry must perform exact structural verification or otherwise disambiguate them. A same-hash/different-structure merge is `FAIL`. A collision-safe disambiguation path is `PASS`. Collision handling that cannot be observed is `OPEN`.

## Duplicate Suppression

For the same product graph resolved repeatedly at 10, 100, and 1000 attempts where practical:

- all resolutions must return one stable identity;
- registry size may grow by at most one when the graph was initially absent;
- registry size must not grow when the graph was already present;
- canonical key must remain stable.

Any unnecessary growth is `FAIL` for structural registry correctness.

## Malformed / Adversarial Fixtures

Mandatory rejection fixtures:

- missing atom reference;
- self bond;
- duplicate/contradictory semantic bond;
- invalid or non-finite bond order;
- non-integer/invalid formal charge;
- NaN/non-finite authoritative metadata when semantically numeric;
- impossible/unsupported graph forms defined by the 01 supported-domain contract.

Production main already rejects several low-level graph malformations. Full over-valence/unsupported-chemistry rejection remains a required Stage B check against the 01 implementation rather than an inferred PASS from the current molecular foundation.

## Atomic Mutation Gate

Force product registration to fail after a candidate would otherwise progress.

Record canonical snapshots of:

- registry before;
- vessel before;
- registry after failure;
- vessel after failure.

Expected result is exact state preservation. Any reactant decrement, product partial insertion, registry insertion, event emission implying applied extent, or other partial commit is an absolute `FAIL`.

## Conservation Gate

Every successful generated-product insertion path must preserve:

- element inventory;
- atom count;
- applicable net charge;
- finite non-negative mol amounts.

No later benchmark score can override a conservation failure.

## Timestep Semantics

Required ordering:

`timestep N candidate resolution -> generated product registration -> committed next state -> timestep N ends`

Then:

`timestep N+1 candidate generation` may consume the generated species.

A generated species must not enter a second reaction recursively inside timestep N. Same-step hidden cascade is `FAIL`; missing next-step accessibility is also `FAIL`.

## Determinism

For identical:

- initial registry;
- vessel state;
- ranked reaction candidates;
- dt;
- seed/config;

require identical:

- generated species IDs;
- canonical keys;
- final vessel amounts;
- ReactionProgressEvents and ordering;
- registry serialization and entry ordering.

## Serialization / Restore

`serialize -> restore -> resolve same graph` must preserve:

- species identity;
- canonical key;
- registry cardinality;
- deterministic serialization;
- no duplicate creation;
- next-step behavior.

Any ID drift is `FAIL`.

## Known Species Reuse

If a generated graph exactly matches an already registered canonical known species, resolution must reuse the existing species identity. The Stage B suite must derive the actual known canonical set from the tested PR/repository state; it must not hardcode assumptions from old branches.

A known H2O graph producing a second generated identity is a representative failure pattern.

## Unknown Species

A structurally valid but unmatched graph is not itself an error. If 01 supports that graph domain:

- create an internal generated identity;
- keep real-world identity status `OPEN` until 03 evidence exists;
- do not fabricate names, reference matches, thermochemical values, phase data, or kinetic properties.

Registry structural validity and 03 reference matching are separate concerns.

## Performance

Record at minimum versus registry size:

- lookup latency;
- resolve/register latency;
- timestep overhead;
- duplicate-attempt registry growth;
- candidate counts when reaction-candidate generation is combined with the registry.

Inspect implementation for naive full-registry graph-isomorphism scans. Until 00/01/07 commit an engineering budget, valid finite measurements are reported as baseline/WATCH and the performance gate remains `OPEN`; do not invent a PASS threshold.

Recommended measurement sizes where practical: 10, 100, 1000 entries/attempts, plus the largest cheap deterministic case available in CI.

## Randomized / Property-Style Validation

Use fixed reproducible seeds.

- repeatedly permute atom ordering, bond ordering, and runtime IDs for the same graph and require identical identity;
- generate malformed variants and require rejection/no crash/no partial state mutation;
- print failing seed/input when a randomized test fails.

No randomized fixture may be interpreted as real-world chemical evidence.

## Result Model

Validation verdict:

- `PASS`
- `FAIL`
- `OPEN`

Scientific model status remains separate:

- `VERIFIED`
- `APPROXIMATED`
- `EMPIRICAL`
- `GAMEPLAY_SIMPLIFICATION`
- `OPEN`

Structural registry correctness can PASS while real-world identity/property completeness remains OPEN.

## Owner Routing

- registry/canonicalization/persistence/atomic mutation/conservation/timestep semantics -> 01
- reference matching/provenance/real-world species identity -> 03
- player knowledge/discovery exposure -> 04
- thermo/kinetics/property evaluation of generated species -> 02
- UI presentation only -> 05
- integration/CI/merge sequencing -> 07

## No Tuning

06 must not change 01 canonicalization, reaction formulas, generated-species filtering, property data, thresholds, or failing fixtures to obtain a green result.
