# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Architect / Energy Model Architect
- Current integration scope: Phase 4A-2 Gas Transport + Phase 4A-3 Thermal Apparatus
- Overall state: independently validated feature contracts coexisting on unified integration branch
- Last updated: 2026-09-20

## Phase 4A-2 — Gas Transport
- Source PR: #67
- Exact production feature HEAD: `18742befcc480eb0ee6de1ae1f72ffda0f3a8672`
- Independent validation branch: `validation/06b-phase4a2-gas-transport`
- Independent validation HEAD: `892e5fb6610c338f3bee8cde112904464ba2a071`
- Independent validation run: `35496274953` — SUCCESS
- Contract: `docs/contracts/PHASE4A2_GAS_HEADSPACE_TRANSPORT.md`

Preserved authority:
- pressure/partial-pressure and transport amount evaluation belongs to 02;
- output is explicit Phase 4A-1 matter-transfer requests;
- Phase 4A-1 remains the authoritative matter mutation/atomic commit boundary;
- directed GAS topology is not inferred as reversible;
- bulk and diffusion contributions retain validated large-dt stability and deterministic normalization;
- sealed/open routing semantics are preserved.

## Phase 4A-3 — Thermal Apparatus
- Source PR: #68
- Exact production feature HEAD: `63e7d36a8c7a51f254429b1fed2e5d02ec3b5398`
- Independent validation branch: `validation/06d-phase4a3-thermal`
- Independent validation HEAD: `b0cc9fc1665525b61986421647b3cf17da85c303`
- Independent validation run: `35496142811` — SUCCESS
- Contracts:
  - `docs/contracts/PHASE4A3_THERMAL_APPARATUS.md`
  - `docs/contracts/PHASE4A3_06D_DEFECT_FIX.md`

Preserved authority:
- multi-actuator target envelope and per-actuator target semantics remain as independently validated;
- duplicate stable IDs reject deterministically;
- finite-body internal transfer stays equal-and-opposite;
- reaction heat remains upstream-authoritative and is not clipped by apparatus targets;
- positive-Kelvin and large-dt stability guards remain intact;
- thermal evaluation does not directly mutate gas inventory.

## Cross-module boundary
The unified integration does not invent a new timestep/orchestration engine.

Current coexistence contract:
1. gas transport consumes explicit authoritative temperature input;
2. gas transport computes transport requests but does not integrate temperature;
3. thermal apparatus computes energy/temperature evolution but does not mutate gas/species inventory;
4. Phase 4A-1 remains the sole matter-transfer commit primitive;
5. no second pressure or temperature authority is introduced.

Production cross-module scheduling remains OPEN until an owning runtime/orchestration workstream explicitly defines it.

## UI boundary
05C/05D consume provider facts only. React/UI must not calculate pressure, gas transport, equilibrium, reaction extent/rate, phase, density, heat transfer, temperature evolution, or molecular identity.

## Integration status
The original #67 and #68 status documents both replaced this file from the same older baseline, creating a documentation-only merge conflict. 07 reconciled the status record without changing either validated executable/test implementation.

Final acceptance of the combined stack is owned by 07 integration regression and 00 HQ.
