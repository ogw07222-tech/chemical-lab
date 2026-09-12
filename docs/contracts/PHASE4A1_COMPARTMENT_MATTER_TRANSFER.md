# Phase 4A-1 — Compartment & Matter Transfer Foundation

Status: implementation validated; independent 06 validation pending.

## Authority
Phase 4A-1 introduces a reusable matter-bookkeeping layer. It does not replace the existing Phase 3A/3B vessel reaction state yet.

Authoritative identities remain existing `SpeciesId` + `MoleculeRecord` / Dynamic Species Registry identities. Formula strings and display names are never inventory keys.

## Compartment state
`MatterCompartmentState` carries:
- stable compartment id;
- compartment kind;
- optional apparatus owner id;
- `SpeciesState[]` inventory;
- optional volume/environment/scientific metadata.

Prepared kinds include vessel contents/headspace, lab atmosphere, gas collector, filtration reservoirs, bath/chamber media, exhaust reservoir, and generic `OTHER`. No apparatus-specific physics is attached to these kinds.

`createPrimaryVesselContentsCompartment()` is an additive migration adapter from the current production vessel species snapshot. Phase 3A/3B remains unchanged and gas is not automatically moved into headspace.

## System inventory
System-wide helpers aggregate all compartments:
- species amount totals;
- elemental amount totals;
- atom amount;
- net-charge amount.

This lets later phases distinguish local compartment loss from actual system loss.

## Matter transfer transaction
`transferMatterBatch()` is the primary primitive.

Order:
1. validate complete system snapshot;
2. canonicalize request and species-entry order;
3. validate all source/destination/connection/species/amount facts;
4. aggregate all outgoing demand against the same start snapshot;
5. reject the whole batch if any demand is invalid or unavailable;
6. stage touched-compartment/species deltas only;
7. commit an immutable next state;
8. verify system-wide species/element/atom/charge conservation.

`transferMatter()` is a single-request wrapper over the same batch transaction.

Incoming matter in a transaction cannot fund another outgoing request in that same transaction. This prevents order-dependent hidden transfer cascades.

No silent limiting occurs. If 1 mol is requested and only 0.7 mol exists, the transaction rejects. A future transport solver must explicitly request 0.7 mol if that is its authoritative result.

## Atomicity
A failed batch returns the original `MatterSystemState` reference. No source or destination partial mutation is committed.

## Determinism
Requests and entries are canonicalized by stable ids before staging. Aggregate source demand is evaluated before mutation, so competing requests cannot capture inventory by caller array order.

## Numerical policy
Matter transfer reuses the existing reaction-progression default amount tolerance (`1e-12 mol`) for floating residual checks; no new chemistry threshold or transport physics policy is introduced.

## Connection topology
`MatterConnectionState` is topology only:
- connection id;
- source compartment;
- destination compartment;
- `GAS | LIQUID` kind;
- enabled flag.

A supplied connection must exist, be enabled, and match source/destination. No pressure, conductance, valve flow, diffusion, pumping, or phase-rate inference occurs.

## Reaction / transfer separation
Reaction progression may change chemical identity and species totals according to stoichiometry/conservation.

Matter transfer may only relocate an existing `SpeciesId` amount. It cannot:
- generate reaction candidates;
- alter bonds or stoichiometry;
- register a new SpeciesId;
- derive identity;
- apply heat.

Generated Dynamic Species Registry ids transfer through exactly the same path as known ids.

## Out of scope
Phase 4A-1 intentionally does not implement:
- pressure or ideal-gas calculations;
- heat/temperature transfer;
- pressure-driven flow or diffusion;
- evaporation/condensation/boiling;
- automatic gas escape;
- pump behavior;
- filtration/separation rates;
- apparatus-specific behavior;
- React/UI/provider DTO wiring.

## 4A-2 handoff
Future 4A-2/02/04 logic may decide *how much* matter should move based on apparatus/transport physics. It should emit explicit transfer requests into this 01-owned transaction primitive. 01 remains responsible for inventory validation, atomic commit, deterministic ordering, and system conservation.
