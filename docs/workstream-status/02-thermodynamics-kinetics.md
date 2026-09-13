# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Architect / Energy Model Architect
- Current phase: Phase 4A-2 — Gas / Headspace / Diffusion Transport Engine
- Overall state: PASS — IMPLEMENTATION COMPLETE / independent validation pending
- Last updated: 2026-09-13
- Starting / latest checked main SHA: `28b85072ada9865d76d3e7874f926490558a198c`
- Active branch: `feature/phase4a2-gas-transport`
- Active PR: #67 — `feat(02): add Phase 4A-2 gas transport engine`
- Exact validated executable/test HEAD: `2eb5f38d5883f7cac5f7676af73d178452344d5e`
- Validation workflow run: `34746930169` — SUCCESS

## Objective
Implement the Phase 4A-2 well-mixed gas/headspace transport amount solver on top of the production-integrated Phase 4A-1 compartment foundation while preserving the boundary:

`02 gas transport amount evaluation → explicit MatterTransferRequest[] → 01 transferMatterBatch() atomic commit`.

Canonical contract: `docs/contracts/PHASE4A2_GAS_HEADSPACE_TRANSPORT.md`.

## Implemented

### Headspace / atmosphere foundation
- Reuses Phase 4A-1 `MatterCompartmentState`, `volumeM3`, `VESSEL_HEADSPACE`, `LAB_ATMOSPHERE`, and directed GAS connections.
- Does not redesign 01 inventory ownership.
- Temperature is explicit 02 thermodynamic input rather than inferred from arbitrary metadata.
- `LAB_ATMOSPHERE` is a finite modeled compartment in this slice; open-vessel gas is never deleted into an implicit reservoir.

### Ideal-gas pressure and partial pressure
`evaluateIdealGasCompartment()` supports gas-phase species only:

`P = nRT/V`

`p_i = n_i RT/V = y_i P`

Requirements:
- finite `V > 0`;
- finite `T > 0 K`;
- finite non-negative gas amount;
- zero gas is valid at 0 Pa.

Invalid/overflow conditions become `OPEN`; NaN/Infinity is not returned as transport state. The ideal-gas model is tagged `APPROXIMATED`.

### Parameterized transport coefficients
No realistic-looking default diffusion coefficient is hardcoded.

`GasConnectionTransportModel` accepts caller/provider-supplied:
- bulk molar conductance in mol/(s Pa);
- generic species diffusive molar conductance in mol/(s Pa);
- optional per-SpeciesId overrides;
- scientific status/provenance.

### Bulk pressure-driven transport
Bulk contribution uses total-pressure difference on an enabled directed GAS connection:

`dn_total/dt = G_bulk (P_source - P_destination)`.

The total moved amount is split by source gas mole fraction, preserving multi-species composition at the bulk-advection layer.

### Species diffusion
Diffusive contribution is separately represented:

`dn_i/dt = G_i (p_i,source - p_i,destination)`.

Therefore equal total pressure does not suppress composition diffusion. Bidirectional physical exchange requires two explicit directed GAS connections; no directed connection is silently treated as reversible.

### Timestep stability
Pairwise bulk and diffusion contributions use closed-form exponential relaxation instead of micro-substeps.

For pressure slope `s = RT/V`:

`xi_eq = DeltaP/(s_source+s_destination)`

`xi(dt) = xi_eq [1-exp(-G(s_source+s_destination)dt)]`.

This is deterministic, has a finite large-dt limit, and approaches the corresponding pairwise pressure/partial-pressure equality without crossing under the contribution model.

### Multiple-connection allocation
Desired contributions are evaluated from the same immutable snapshot, canonically sorted, then grouped by `(source compartment, SpeciesId)`.

If aggregate outgoing demand exceeds source availability, all competing contributions are proportionally normalized. 02 therefore never expects 01 to silently clamp an overdraw and does not use first-connection-wins ordering.

### Commit boundary / conservation
`GasTransportEvaluation` returns:
- `bulkTransfers`;
- `diffusiveTransfers`;
- canonical combined `transferRequests`;
- contribution/connection diagnostics and scientific status.

02 does not mutate `MatterSystemState`. Tests commit through production `transferMatterBatch()`, preserving Phase 4A-1 system-wide species, element, atom and net-charge conservation semantics.

### Open vs sealed
- Open headspace transport is explicit `VESSEL_HEADSPACE → LAB_ATMOSPHERE` over an enabled GAS connection.
- Disabled/missing connection means no gas escape.
- Sealed vessels never auto-delete headspace matter.
- Reaction-to-headspace and evaporation/condensation source terms are not fabricated in this slice.

## Validation Evidence
Exact validated executable/test HEAD: `2eb5f38d5883f7cac5f7676af73d178452344d5e`.
Temporary GitHub Actions workflow run `34746930169`: SUCCESS. The temporary workflow was removed afterward; executable/test blobs remain the validated versions.

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS with 0 errors; one pre-existing `src/ui/provider.tsx` hooks warning
- targeted Phase 4A-2 + Phase 4A-1 + Phase 3A + Phase 3B + Dynamic Species + thermal: **8 files / 117 tests PASS**
  - Phase 4A-2 gas transport: 22/22
  - Phase 4A-1 compartment foundation: 17/17
  - Phase 3A kinetics/thermal: 10/10
  - Phase 3B equilibrium: 15/15
  - Phase 3B progression: 13/13
  - Phase 3B reversible arbitration: 16/16
  - Dynamic Species Registry: 11/11
  - thermal: 13/13
- full `npm test`: **28 files / 323 tests PASS**
  - full suite additionally covers Phase 3A reaction network/dimensioned resolver and Dynamic Species Registry validation
- `npm run build`: PASS

The first validation run `34746846149` failed only on five test-fixture/assertion issues: invalid raw-volume fixtures were rejected by the Phase 4A-1 constructor before 02 evaluation, floating conservation was compared with exact object equality, and one intended overflow fixture remained finite. These fixtures were corrected without weakening scientific/transport assertions. Final run `34746930169` passed all stages.

## Tested Phase 4A-2 Cases
- ideal-gas pressure and partial pressure;
- invalid/zero/negative/non-finite thermodynamic input;
- pressure-driven high→low bulk transport;
- zero pressure-gradient bulk result;
- equal-pressure composition diffusion;
- disabled connection;
- directed topology not secretly reversible;
- source-composition multi-species bulk split;
- no source overdraw;
- competing-connection deterministic proportional normalization;
- input order invariance;
- huge-dt anti-overshoot behavior;
- repeated sealed two-chamber conservation/convergence;
- bidirectional per-species diffusion convergence/conservation;
- finite `LAB_ATMOSPHERE` open-headspace routing;
- sealed headspace no loss;
- trace gas without arbitrary threshold deletion;
- actual generated SpeciesId compatibility;
- deterministic replay;
- overflow/invalid conductance OPEN behavior without NaN/Infinity transfer output.

## PASS / FAIL / OPEN
### PASS
- Phase 4A-1 compartment/transfer contracts are reused rather than duplicated.
- Ideal-gas and partial-pressure baseline is executable and scientifically labeled.
- Bulk and diffusive gas transport are represented separately.
- Directed topology semantics are preserved.
- Large-dt transport uses deterministic closed-form relaxation, not micro-substepping.
- Multiple outgoing paths are order-invariant and source-safe.
- Open-vessel transport routes matter into finite atmosphere rather than deleting it.
- Generated SpeciesIds remain compatible.
- Full repository regression/build pass on exact executable/test HEAD.

### FAIL
- None identified in final implemented scope.

### OPEN
- Independent Phase 4A-2 validation of adversarial topology, long-run conservation and timestep sensitivity.
- Authoritative/species-specific diffusion or apparatus conductance data from 03.
- Apparatus-specific opening/valve geometry/calibration from 04.
- Reaction-to-headspace source terms and phase-change coupling.
- evaporation/condensation/boiling and other phase-transfer models.
- nonideal gas EOS/fugacity and detailed multicomponent diffusion.
- provider/UI projection of pressure/composition/transport activity.

## Handoffs
- 01: consume only `transferRequests` through `transferMatterBatch()`; do not duplicate pressure/diffusion formulas or silently clamp requests.
- 03: provide authoritative diffusion/conductance reference data with conditions, units, uncertainty/status and provenance where available.
- 04: provide apparatus topology and enabled/disabled valve/opening state; do not calculate gas physics in gameplay/UI.
- 05C/05D: consume simulation-provided pressure/composition/net transport facts only. Visualization particles are not physical state.
- 06A / Phase 4A validation: independently validate exact PR #67 branch/HEAD, especially competing paths, extreme dt, long-run conservation, open/sealed routing, and order invariance.
- 07: do not merge PR #67 before independent validation approval.

## Next
Hand PR #67 to independent Phase 4A validation. No Phase 4A-3 phase-change work should be folded into this PR.
