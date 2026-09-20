# 02 — Thermodynamics & Kinetics

## Phase 4A-3 Runtime-Blocking Thermal Defect Fix — 2026-09-20

- Source main: `9b20efc90dae89ae6334e84cffb846d7386959d4`.
- Related runtime PR #74 HEAD: `a9280dff191e970fe61a404d83fd11ba2ac1a85f`.
- Independent 06F evidence: validation run `35505453765` failed only the inherited huge-dt passive-contact reversal gate while the other 13 runtime adversarial checks passed.
- Thermal-only pre-fix reproduction: workflow `35505727018` failed on the reduced Phase 4A-3 fixture without PR #74 orchestration.
- Root cause: pairwise closed-form contact requests were individually non-crossing, but the existing multi-contact envelope did not prevent aggregate simultaneous transfers from reversing a snapshot hot-to-cold edge.
- Fix branch: `fix/phase4a3-runtime-blocking-thermal`.
- Exact implementation/test HEAD: `e2a5916184f88a7cb8b35e1b63820a1348b65ccf`.
- Implementation validation run `35505805791`: SUCCESS.
  - exact thermal regression 2/2 PASS;
  - Phase 4A-3 + 06D + thermal 63/63 PASS;
  - Phase 3/reaction 77/77 PASS;
  - Phase 4A-1/4A-2 51/51 PASS;
  - registry 38/38 PASS;
  - full suite 34 files / 411 tests PASS;
  - typecheck/lint/build PASS (one pre-existing UI hook warning, zero lint errors).
- PR #74 compatibility validation branch `validation/02-phase4a3-pr74-compat` overlaid only the thermal fix onto exact PR #74 HEAD.
- Compatibility run `35505869648`: SUCCESS.
  - thermal-only regression 2/2 PASS;
  - copied 06F independent runtime validation 14/14 PASS;
  - PR #74 production orchestration regressions 17/17 PASS;
  - Phase 4A-3 regression stack 63/63 PASS;
  - build PASS.
- No PR #74 production change is required by this defect.
- Independent 06 revalidation of the actual fix PR remains required before merge.

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
