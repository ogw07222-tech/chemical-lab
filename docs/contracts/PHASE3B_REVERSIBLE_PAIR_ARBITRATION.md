# Phase 3B — Reversible Pair Arbitration

Status: IMPLEMENTED — 01 executable wiring / independent 06 validation pending
Owner: 01 — Chemistry Simulation Engine
Upstream authority: 02 — Thermodynamics & Kinetics

## Source dependency

This implementation is intentionally stacked on the exact 02 Phase 3B source contract:

- PR #51: `feat(02): add Phase 3B equilibrium thermodynamics foundation`
- PR #51 source HEAD consumed by this branch: `116cfa30192556b3236f4f2814000ad971361bac`
- PR #51 validated executable/test HEAD: `5fcc62a05189ad7759596892ae30ab2a5b829998`
- production main checked before the stack was created: `e49b3f25eeb39d08a6c397c4869beceb6c5c8bbf`

01 does not duplicate PR #51 equilibrium equations or progression policy. It directly consumes `evaluateReactionEquilibrium()` and `recommendEquilibriumProgression()`.

## Authoritative timestep order

Phase 3B preserves the Phase 3A timestep/state authority:

`state(N)`
→ immutable reactant snapshot
→ candidate generation
→ thermo/kinetic evaluation
→ explicit reversible-pair arbitration
→ normal ranked/shared-reactant resolution
→ bounded extent commit
→ Dynamic Species Registry/product commit
→ vessel mutation
→ aggregate-once reaction thermal coupling
→ factual events/provider projection
→ `state(N+1)`

There is no second equilibrium solver and no persistent reaction graph authority.

## Explicit pair identity only

A candidate participates in pair arbitration only when it carries explicit 01 execution metadata:

- `reversible.pairId`
- `reversible.direction = FORWARD | REVERSE`

01 never infers pair membership from reactant/product similarity, formula, candidate id/name, graph similarity, or reaction family.

For an explicitly paired forward/reverse channel set, 01 validates that the represented product identities correspond to the opposite channel's reactants before using the pair projection. This validates an explicit pair; it does not discover a pair.

## 02 progression authority

For each complete explicit pair whose reactants are represented in the start-of-step snapshot, 01 supplies PR #51 with:

- the forward reaction evaluation view;
- current read-only composition through an explicit composition adapter;
- temperature and available environment context;
- 01 stoichiometric maximum feasible extent;
- a pure projected-composition callback for trial net extent.

PR #51 remains authoritative for:

- Q/K and ln(Q/K);
- equilibrium direction;
- `drivingStrength`;
- `maxNetProgressFraction`;
- `preventEquilibriumCrossing`;
- optional `maxExtentTowardEquilibriumMol`;
- scientific status and reason codes;
- near-equilibrium policy.

01 does not recreate the ln(Q/K) mapping, equilibrium tolerance, damping curve, crossing search, or thermodynamic formulas.

## Arbitration modes

### FORWARD

- forward is the surviving net pair channel;
- reverse is suppressed as a separate net reaction for the timestep;
- an already-numeric 02 kinetic request is multiplied by `drivingStrength`;
- request is additionally bounded by `maxNetProgressFraction` and, when supplied, `maxExtentTowardEquilibriumMol`;
- normal stoichiometric, per-step safety, and shared-reactant bounds still apply afterward.

### REVERSE

Symmetric to FORWARD.

### NEAR_EQUILIBRIUM

- both pair channels are suppressed from coarse net mutation;
- no composition is snapped to equilibrium;
- no claim is made that microscopic forward/reverse rates are zero;
- no arbitrary 01 hysteresis or extra deadband is added.

### INDETERMINATE

Equilibrium arbitration abstains completely:

- no pair channel is suppressed by Phase 3B;
- no equilibrium multiplier or cap is installed;
- no equilibrium-derived bias/boost is added;
- independently supported Phase 3A kinetics continue through the pre-existing resolver rules.

This does not assert a net equilibrium direction. It means 02 equilibrium evidence is insufficient for Phase 3B arbitration.

## Kinetic request composition

Equilibrium evidence never creates a rate or numeric extent request.

Resolver order is:

1. obtain numeric kinetic request from existing 02 kinetics (`DIMENSIONED_RATE` or supported `RELATIVE_RATE` bridge);
2. if no numeric request exists, defer according to existing OPEN/qualitative rules;
3. only then apply the Phase 3B `drivingStrength` multiplier;
4. apply the 02 pair cap(s);
5. apply existing 01 per-step safety and stoichiometric bounds;
6. feed surviving requests into the existing deterministic shared-reactant allocator.

Therefore OPEN/QUALITATIVE kinetics cannot become numeric merely because equilibrium driving is known.

## Anti-crossing / anti-ping-pong

When PR #51 supplies `maxExtentTowardEquilibriumMol`, the pair request is capped so committed pair extent cannot exceed that value. It also remains bounded by stoichiometric feasibility and all existing 01 safety/competition limits.

No additional hysteresis, crossing tolerance, or damping constant is invented by 01.

For determinate FORWARD/REVERSE modes, only the surviving channel can contribute net composition change or reaction heat during that timestep. This prevents forward+reverse double consumption and duplicated heat.

## Shared reactants

Pair arbitration occurs before ordinary reaction competition. The surviving channel then enters the unchanged Phase 2E/3A shared-reactant allocator together with unrelated reactions.

The existing group allocation remains authoritative:

- no candidate-id-first inventory capture;
- no overconsumption;
- finite/non-negative species amounts;
- deterministic allocation.

## Generated species and timestep visibility

Same-step generated-species cascades remain prohibited.

If an explicit pair references a reactant SpeciesId that is not present in the immutable start-of-step snapshot, pair arbitration does not prematurely interpret that future species. The existing resolver/registry path then handles it through the established zero-initial-reactant rule.

A generated species committed at timestep N can participate normally from timestep N+1.

Dynamic-registry products initially have phase `unknown` / scientific status `OPEN`. Until the phase/equilibrium composition boundary is scientifically resolved, PR #51 may correctly return INDETERMINATE; Phase 3B then follows the abstention semantics above.

## Thermal coupling

01 performs no reaction-heat calculation in the arbitration layer.

The selected channel retains its original candidate/evaluation identity and therefore the 02 forward/reverse reaction enthalpy sign. Existing aggregate thermal coupling:

- derives event heat only from committed extent plus 02 thermochemical evidence;
- sums known contributions;
- applies aggregate reaction heat exactly once per timestep.

## Event / provider projection

Committed reaction facts may add:

- `reversiblePairId`
- `channelDirection`
- `equilibriumDirection`
- `equilibriumScientificStatus`
- optional `equilibriumDrivingStrength`
- optional `lnQOverK`
- optional `reactionQuotientQ`
- optional `equilibriumConstantK`

Pair-level provider diagnostics additionally expose the PR #51 recommendation limits/reason codes.

These are simulation facts, not player-facing identity. Existing `speciesRef` remains opaque and player knowledge/name/formula/graph disclosure continues through the 04/05 boundary.

05 must consume the supplied equilibrium direction/status and must not derive Q/K/direction itself.

## Determinism

Pair collections and public control records use deterministic ordering. With identical state/config/provider evidence, arbitration must produce identical:

- selected direction;
- extent request controls;
- committed extent;
- vessel state;
- event order/content;
- aggregate thermal result.

Input candidate/evaluation permutation must not change the pair result.

## Validation evidence

Exact executable/test HEAD validated by the branch-only workflow:

`888eb99b0a2e11988db63866505eabf9f9eb6026`

Workflow run: `34683568587` — SUCCESS

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS, 0 errors; one inherited UI hook warning remains outside 01 scope
- targeted Phase 3B/3A/progression/thermal/registry stack: 8 files / 99 tests PASS
- full `npm test`: 22 files / 261 tests PASS
- `npm run build`: PASS

## OPEN

- Independent 06 validation remains mandatory before production integration.
- PR #51 is an upstream stacked dependency until its exact source contract is integrated to main.
- General non-ideal activity/mixture equilibrium and broader phase fidelity remain 02/data responsibilities.
- Generated species with unresolved phase/reference thermodynamics may remain equilibrium-INDETERMINATE.
- INDETERMINATE intentionally permits independently supported Phase 3A kinetics and therefore makes no pair-level equilibrium-direction guarantee.
- Multi-pair coupled equilibrium, stiff-network integration, transport limitation, electrochemistry, and full equilibrium solving remain outside this slice.
