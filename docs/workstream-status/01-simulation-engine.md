# 01 — Chemistry Simulation Engine

- Owner: Lead Chemistry Simulation Engine Developer / Reaction Solver Architect / Stoichiometry Engine Developer
- Current phase: Phase 4A-1 — Compartment & Conservation Foundation
- Overall state: PASS — implementation validated / independent 06 validation pending
- Last updated: 2026-09-12
- Starting production main: `555c6e74ef94a9c06416fb80ce703980ce6a1889`
- Active branch: `feature/phase4a1-compartment-foundation`
- Exact executable/test HEAD validated: `6e7b45f62e0a6822b53a77b179e0445ba1f9b83e`
- Validation workflow run: `34691782906` — SUCCESS

## Objective
Phase 4A-1 establishes reusable matter containers, system-wide inventory/conservation accounting, and atomic deterministic matter transfer. It deliberately does not implement apparatus-specific or flow/thermal physics.

## Source of Truth
Production main was rechecked at task start and was `555c6e74ef94a9c06416fb80ce703980ce6a1889` (`docs(07): record Phase3B production integration PASS`). Phase 3B reversible arbitration, Phase 3A network execution, Dynamic Species Registry, reaction progression, and aggregate-once thermal coupling are therefore production-integrated dependencies.

The Phase 4A-1 branch starts directly from that main commit.

## Compartment Authority
Added `src/simulation/compartment/` as an additive simulation-core subdomain.

`MatterCompartmentState` owns only matter-location bookkeeping:
- compartment id;
- compartment kind;
- optional owner apparatus id;
- existing `SpeciesState[]` inventory;
- optional volume/environment/scientific metadata.

Prepared kinds cover vessel contents/headspace, lab atmosphere, gas collector, filter retentate/filtrate, bath medium, chamber atmosphere, exhaust reservoir, and generic other.

No kind has transport or apparatus physics attached in Phase 4A-1.

## Species Inventory / Identity
Compartment inventory continues to use the existing `SpeciesId`/`SpeciesState` boundary. Known and generated Dynamic Species Registry ids are handled identically.

The transfer layer does not use formula strings or display names as keys and does not create molecular graphs or new SpeciesIds. A single SpeciesId resolving to conflicting canonical molecular identities across compartments is rejected.

Amounts must remain finite and non-negative.

## Existing Vessel Migration
`createPrimaryVesselContentsCompartment()` adapts the existing production vessel species snapshot into a first `VESSEL_CONTENTS` compartment without changing current Phase 3A/3B authority.

No existing reaction state/pipeline was rewritten. No gas is automatically moved to headspace. The compartment model is currently additive infrastructure for later integration.

## Global System Inventory
Added helpers for system-wide totals across all compartments:
- `aggregateSystemSpeciesAmounts()`;
- `aggregateSystemElementInventory()`;
- `aggregateSystemAtomAmountMol()`;
- `aggregateSystemNetChargeAmountMol()`;
- `aggregateSystemMatterInventory()`.

These use existing molecular identity/formula/net-charge facts. They let future transport move matter locally while system-wide conservation remains observable.

## Transfer Authority
`transferMatterBatch()` is the authoritative 01 matter-commit primitive. `transferMatter()` is a one-request wrapper.

Transaction order:
1. validate the full start state;
2. canonicalize request and species-entry ordering;
3. validate source/destination/optional connection/species/amounts;
4. aggregate all outgoing demand against the same start snapshot;
5. reject the whole batch if any source is insufficient or invalid;
6. stage touched species/compartment deltas;
7. commit one immutable next state;
8. validate system-wide species/element/atom/charge conservation.

Incoming matter in the same batch cannot fund outgoing demand in that batch. This prevents hidden transport cascades and caller-order inventory capture.

No silent clamping/partial fulfillment is permitted. An upper transport solver must explicitly request the authoritative movable amount.

## Atomicity
Failure returns the original `MatterSystemState` reference. No partial source decrement or destination increment is externally committed.

A multi-species transfer with one insufficient species rejects the entire request. Competing requests whose aggregate demand exceeds one source snapshot also reject atomically.

## Determinism
Canonical request/entry ordering plus snapshot-wide aggregate-demand validation makes the result independent of caller batch order for equivalent inputs.

Production code uses no RNG.

## Conservation
Pure transfer preserves, within the existing reaction-progression amount tolerance policy:
- every SpeciesId total amount;
- every element total;
- total atom amount;
- total net-charge amount.

Reaction and transfer semantics remain separate: reactions may change species identities/amounts under stoichiometric conservation, whereas transfers only relocate already-authoritative species amounts.

## Connection Contract
`MatterConnectionState` prepares minimal directed topology:
- connection id;
- source compartment;
- destination compartment;
- `GAS | LIQUID` kind;
- enabled flag.

If a transfer supplies a connection id, it must exist, be enabled, and match source/destination. Connection type does not calculate or imply flow amount.

## Headspace / Atmosphere Preparation
`VESSEL_HEADSPACE` and `LAB_ATMOSPHERE` are available compartment kinds only.

Phase 4A-1 does not implement automatic gas escape, gas-product routing, pressure, ventilation, diffusion, or headspace equilibrium.

## Thermal Boundary
Existing Phase 3A aggregate-once reaction thermal coupling is unchanged. Phase 4A-1 calculates no temperature, heat transfer, pressure, or energy transport.

## Files Added / Changed
- `src/simulation/compartment/types.ts`
- `src/simulation/compartment/core.ts`
- `src/simulation/compartment/index.ts`
- `tests/phase4a1-compartment-foundation.test.ts`
- `docs/contracts/PHASE4A1_COMPARTMENT_MATTER_TRANSFER.md`
- `docs/workstream-status/01-simulation-engine.md`

A temporary branch-only validation workflow was used to obtain exact-head evidence and is removed before final PR state.

## Validation Evidence
Exact executable/test HEAD: `6e7b45f62e0a6822b53a77b179e0445ba1f9b83e`

GitHub Actions run `34691782906`: **SUCCESS**.

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS — 0 errors; one inherited `src/ui/provider.tsx` hook-dependency warning
- targeted Phase 4A-1 + Phase 3A/3B/registry/progression/thermal: **7 files / 84 tests PASS**
- Phase 4A-1 compartment tests: **13/13 PASS**
- full `npm test`: **23 files / 274 tests PASS**
- `npm run build`: PASS

## Phase 3A / Phase 3B Regression
PASS:
- Phase 3A network 11/11;
- Phase 3B reversible arbitration 16/16;
- reaction progression 10/10;
- Phase 3A kinetics/thermal 10/10;
- thermal 13/13.

No Phase 3A/3B source file was modified by this implementation, so same-step generated-species prohibition and next-step generated-species participation stay on the existing production path.

## Dynamic Species Regression
PASS:
- Dynamic Species Registry targeted 11/11;
- full registry validation remains green in the 274-test full suite;
- an actual registry-generated SpeciesId is transferred successfully by the new primitive.

## PASS / FAIL / OPEN
### PASS
- reusable compartment state contract;
- deterministic empty/populated compartment creation;
- existing-vessel adapter without mass refactor;
- system-wide species/element/atom/charge aggregation;
- single and multi-species matter transfer;
- atomic rejection on invalid/insufficient requests;
- order-independent competing-request rejection;
- generated SpeciesId compatibility;
- explicit topology contract without flow physics;
- conservation-safe commit;
- Phase 3A/3B/registry/thermal regressions green;
- full suite/build green.

### FAIL
- None identified in Phase 4A-1 scope.

### OPEN
- independent 06 validation before merge;
- integration of compartment authority into the production laboratory runtime/provider remains a later coordinated step;
- 4A-2 transport solver must decide *why/how much* matter moves;
- headspace partitioning, automatic gas escape, diffusion, pressure-driven flow, valve conductance, pump behavior and filtration remain unimplemented;
- energy transfer remains 02/future Phase 4A responsibility;
- 05D owns eventual provider/UI projection.

## Handoffs
- 02/04/4A-2: calculate or decide explicit requested transfer amounts; do not mutate inventory directly.
- 01: validate and atomically commit those explicit requests through this transfer foundation.
- 05D: later project compartment facts through provider authority; no React/UI changes are part of this PR.
- 06: independently validate atomicity, order independence, system conservation, generated-id transfer, and Phase 3A/3B regressions.
- 07: integrate only after 06 approval.

## Next
**06 independent Phase 4A-1 validation, then 07 integration review.**
