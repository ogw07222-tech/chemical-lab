# 01 — Chemistry Simulation Engine

- Owner: Lead Chemistry Simulation Engine Developer / Reaction Solver Architect / Stoichiometry Engine Developer
- Current phase: Phase 4A-1 — Compartment & Conservation Foundation
- Overall state: PASS — independently validated and production-integrated
- Last updated: 2026-09-12
- Original implementation baseline: `555c6e74ef94a9c06416fb80ce703980ce6a1889`
- Feature branch: `feature/phase4a1-compartment-foundation`
- Exact fixed executable/test implementation HEAD: `a11fb3e24197a5c30ca19f0468cdacf1d6c20ad2`
- Implementation validation workflow: `34693370905` — SUCCESS
- 06A independent revalidation HEAD: `320c457c55503bad1f2523f311d82a5c6701d25e`
- 06A independent workflow: `34693888788` — SUCCESS / `PHASE4A1_INDEPENDENT_VALIDATION_PASS`
- Production merge SHA: `9fd2d6f37cf64c7bbf9ad73a89a7cba69cba2a82`

## Objective
Phase 4A-1 establishes reusable matter compartments, system-wide inventory/conservation accounting, and atomic deterministic matter transfer. It deliberately does not implement apparatus-specific behavior, pressure/headspace physics, automatic transport, or thermal transport.

## Compartment Authority
`src/simulation/compartment/` is an additive simulation-core subdomain. `MatterCompartmentState` owns matter-location bookkeeping only: compartment id/kind, optional apparatus owner, existing `SpeciesState[]` inventory, and optional non-authoritative metadata fields prepared for later phases.

Prepared compartment kinds do not imply transport or apparatus physics in Phase 4A-1.

## Species Identity
Compartment inventory reuses the existing `SpeciesId` / `SpeciesState` authority. Known and Dynamic Species Registry-generated ids follow the same path. The transfer layer does not infer identity from formula or display name and does not create molecular graphs or new SpeciesIds.

A single SpeciesId resolving to conflicting canonical molecular identities across compartments is rejected. Amounts must remain finite and non-negative.

## System Inventory / Conservation
The foundation provides system-wide aggregation for:
- species amount;
- element amount;
- atom amount;
- net-charge amount.

Aggregation uses a deterministic canonical contribution order by compartment id, SpeciesId, then molecular canonical key. This fixes the 06A-discovered floating-point order-dependence defect without adding an epsilon waiver for deterministic equality.

Pure transfer preserves system-wide species, element, atom, and charge inventories within the existing amount-tolerance policy.

## Transfer Authority
`transferMatterBatch()` is the authoritative Phase 4A-1 matter-commit primitive; `transferMatter()` is the single-request wrapper.

Transaction semantics remain:
1. validate the complete starting system;
2. canonicalize request/species-entry order;
3. validate source, destination, optional connection, species identity, and amounts;
4. aggregate all outgoing demand against the same starting snapshot;
5. reject the entire batch if any demand is invalid or insufficient;
6. stage all deltas;
7. conservation-check the staged state;
8. commit one immutable next state.

Consequences:
- no partial commit;
- no silent clamp / partial fulfillment;
- incoming matter cannot fund outgoing matter in the same transaction;
- competing demands cannot capture source inventory by caller order;
- failure returns the original authoritative state;
- no RNG is used.

## Connection Contract
Only runtime-supported Phase 4A-1 matter connection kinds are:
- `GAS`
- `LIQUID`

Runtime/deserialized values are explicitly validated. Unsupported values such as `SOLID`, empty string, or malformed values reject with `INVALID_CONNECTION_KIND`; there is no coercion or default.

A supplied connection must also exist, be enabled, and match the transfer source/destination. Connection type does not calculate flow amount.

## 06A Defects and Fixes
The old source HEAD `86dad8298be2997370fc529ab9e07179aba843d7` independently failed and is not merge-authorized.

06A found two blockers:
1. system aggregation depended on caller compartment/species order at IEEE-754 precision;
2. malformed runtime connection kinds could pass the TypeScript-only boundary.

Both were fixed in the executable/test lineage ending at `a11fb3e24197a5c30ca19f0468cdacf1d6c20ad2`:
- canonical accumulation order is explicit and deterministic;
- runtime connection-kind validation allows only `GAS | LIQUID`.

Implementation workflow `34693370905` passed after these fixes. Fresh independent branch `validation/06a-phase4a1-revalidation` tested the fixed implementation at validation HEAD `320c457c55503bad1f2523f311d82a5c6701d25e`; workflow `34693888788` completed SUCCESS and cleared the independent merge gate.

## Production Integration
07 refreshed the feature branch onto the later production main only after auditing the intervening changes as UI/docs-only with no simulation/registry/reaction/progression/thermal overlap.

- original PR checkpoint: `269c00fd56b8c19f9a08c783bf7198a95b052e2b`
- refresh PR: #65
- ancestry refresh commit: `09e0fb7e4dfc3349988313b4e9e041552845720e`
- refreshed integration-tested HEAD: `def738cb3567cb3c7c760bc3d5a2ed02204d094e`
- integration validation workflow: `34694318207` — SUCCESS
- final refreshed PR #57 HEAD after workflow cleanup: `f92a8fa3bca723f4c37e5a0f44fd2e97b6f51794`
- production merge SHA: `9fd2d6f37cf64c7bbf9ad73a89a7cba69cba2a82`

The refresh did not alter compartment/transfer executable semantics. The compartment core blob remained identical to the independently validated implementation lineage.

## Regression Evidence
Integration validation on refreshed PR #57:
- typecheck: PASS
- lint: PASS — 0 errors; one inherited non-blocking `src/ui/provider.tsx` hook warning
- Phase 4A-1: 17/17 PASS
- exact 06A independent + extended tests: 18/18 PASS
- cross-phase Phase 3A / Phase 3B / Dynamic Species / progression / thermal: 7 files / 86 tests PASS
- full suite including imported 06A tests: 29 files / 319 tests PASS
- build: PASS

Post-merge main regression repeated the same stack and again passed 17 Phase 4A-1 tests, 18 exact 06A tests, 86 cross-phase tests, full 29 files / 319 tests, and production build.

## Preserved Dependencies
PASS:
- Phase 3A reaction-network behavior unchanged;
- Phase 3B equilibrium/reversible arbitration unchanged;
- Dynamic Species Registry identity path unchanged;
- reaction progression unchanged;
- existing thermal coupling unchanged;
- generated species transfer uses the same SpeciesId authority as known species.

## Out of Scope / OPEN
Phase 4A-1 does not implement:
- pressure or ideal-gas calculations;
- headspace equilibrium or automatic gas routing;
- temperature evolution or heat/energy transport;
- diffusion, automatic gas escape, ventilation, pump flow, valve conductance, or filtration physics;
- apparatus-specific simulation behavior;
- UI/provider scientific derivation;
- reaction tuning.

These belong to later coordinated phases. Phase 4A-2 must decide why/how much matter moves and then use this atomic transfer foundation rather than bypassing it.

## Final Status
**PASS — Phase 4A-1 Compartment + Matter Transfer + Conservation Foundation is independently validated and production-integrated.**

## Next
00 HQ may proceed to Phase 4A-2 pressure/headspace/gas-transport design and validation without expanding Phase 4A-1 semantics retroactively.
