# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Architect / Energy Model Architect
- Current phase: Phase 3B-B — Equilibrium Progression Policy
- Overall state: PASS — 01 REVERSIBLE-PAIR ARBITRATION UNBLOCKED / 06 independent validation pending
- Last updated: 2026-09-12
- Starting / latest checked main SHA: `e49b3f25eeb39d08a6c397c4869beceb6c5c8bbf`
- Active branch: `feature/phase3b-equilibrium-foundation`
- Active PR: #51 — `feat(02): add Phase 3B equilibrium thermodynamics foundation`
- Exact validated executable/test HEAD: `5fcc62a05189ad7759596892ae30ab2a5b829998`
- Validation workflow run: `34682342429` — SUCCESS

## Objective
Close the remaining Phase 3B policy gap by converting supported `ln(Q/K)` evidence into a deterministic, bounded, scientifically-labeled net reversible-pair progression recommendation that 01 can consume without inventing damping, anti-overshoot or pair-arbitration rules.

Canonical contract: `docs/contracts/PHASE3B_EQUILIBRIUM_THERMODYNAMICS.md`.

## Implemented

### Equilibrium foundation retained
`evaluateReactionEquilibrium()` remains authoritative for:
- `Q`, `K`, `lnQ`, `lnK`, `ln(Q/K)`;
- `FORWARD_FAVORED | REVERSE_FAVORED | NEAR_EQUILIBRIUM | OPEN`;
- ideal-gas / ideal-dilute / explicit pure-phase activity semantics;
- standard-state/reference-temperature/provenance handling;
- finite `DeltaG = RT ln(Q/K)` when supported;
- OPEN propagation when the model/data is insufficient.

No fallback K or current-composition K inference was added.

### Authoritative progression recommendation
Added `EquilibriumProgressionRecommendation` with:
- `mode: FORWARD | REVERSE | NEAR_EQUILIBRIUM | INDETERMINATE`;
- `drivingStrength` in `[0,1]`;
- `maxNetProgressFraction` in `[0,1]`;
- `preventEquilibriumCrossing`;
- optional `maxExtentTowardEquilibriumMol`;
- scientific status + reason codes.

This recommendation does not contain or synthesize a reaction rate.

### Continuous thermodynamic driving modulation
For authoritative `x = ln(Q/K)` and existing `epsilon_eq`:

`d = max(0, |x| - epsilon_eq)`

`drivingStrength = 1 - exp(-d)`

implemented as `-expm1(-d)`.

Properties:
- zero throughout the near-equilibrium engineering band;
- continuous at the band edge;
- monotonic outside the band;
- symmetric forward/reverse magnitude;
- bounded and deterministic;
- stable for tiny/huge finite driving coordinates.

Scientific status is `APPROXIMATED`: this is a coarse thermodynamic driving-force modulation, not a fundamental kinetic law.

### Kinetic composition contract
01 conceptually applies:

`kineticRequestedExtent * drivingStrength`

then preserves 01 authority for:
- stoichiometric availability;
- shared-reactant allocation;
- max fractional consumption safety cap;
- conservation and species-state mutation.

If Phase 3A kinetic evidence is `OPEN` or qualitative-only, Phase 3B-B does not fabricate a numeric rate/extent.

### Near-equilibrium policy
For `|ln(Q/K)| <= epsilon_eq`:
- mode = `NEAR_EQUILIBRIUM`;
- `drivingStrength = 0`;
- `maxNetProgressFraction = 0`;
- coarse net pair progression recommendation = zero;
- no composition snap;
- no forward/reverse flip-flop.

This does not claim microscopic forward/reverse rates are zero.

### OPEN / indeterminate policy
When equilibrium evidence is unsupported:
- mode = `INDETERMINATE`;
- status = `OPEN`;
- equilibrium arbitration contributes no suppression, boost or direction bias;
- no anti-crossing bound is claimed.

Existing independently-supported Phase 3A kinetics may continue under existing rules; 01 must not infer equilibrium behavior.

### Deterministic anti-overshoot
Added an 02-owned bounded bisection policy.

01 supplies only:
- `maxFeasibleExtentMol` in the favored direction;
- a pure read-only `projectComposition(netForwardExtentMol)` callback using 01-owned stoichiometric/state semantics.

02 solves for the sign crossing:

`ln(Q(xi_eq)/K) = 0`

within the 01-supplied feasible interval.

Default engineering solver settings:
- maximum 48 bisection iterations;
- `1e-12 mol` extent tolerance;
- configurable;
- no vessel mutation;
- no global equilibrium solve;
- no frame-by-frame solver;
- returned bound never exceeds the supplied feasible extent.

The root search uses the actual sign of finite `ln(Q/K)`, not entry into the wider near-equilibrium tolerance band. Zero-activity endpoints may bracket the root using thermodynamic direction when finite `ln(Q/K)` is intentionally absent.

If equilibrium lies beyond the feasible interval, the safe thermodynamic cap is simply the full supplied feasible extent. If projection/equilibrium evaluation becomes OPEN, no bound is fabricated.

### Pair arbitration order for 01
Phase 3B-B defines pair-level arbitration **before** ordinary shared-reactant competition:
- `FORWARD`: only the forward net channel survives pair arbitration;
- `REVERSE`: symmetric reverse rule;
- `NEAR_EQUILIBRIUM`: zero coarse net pair request;
- `INDETERMINATE`: equilibrium arbitration abstains.

The surviving/modulated request then enters normal 01 competition with unrelated reactions.

This prevents ordering-induced ping-pong without claiming detailed balance.

### Thermal consistency
No second heat path was introduced.
- Phase 3A aggregate-once reaction heat remains authoritative.
- Progression recommendation contains no `heatJ` or `deltaH` mutation semantics.
- exact reverse `DeltaH` sign derivation remains provenance-gated under the existing Phase 3B contract.

## Validation Evidence
Exact validated executable/test HEAD: `5fcc62a05189ad7759596892ae30ab2a5b829998`.
Temporary validation workflow run `34682342429`: SUCCESS.

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS with 0 errors; one pre-existing UI hooks warning
- targeted Phase 3B-B / equilibrium / Phase 3A / evaluation / thermal: **5 files / 60 tests PASS**
  - Phase 3B-B progression policy: 13/13
  - Phase 3B equilibrium: 15/15
  - Phase 3A kinetics/thermal: 10/10
  - reaction evaluation: 9/9
  - thermal: 13/13
- full `npm test`: **21 files / 245 tests PASS**
- `npm run build`: PASS

An earlier run `34682295232` exposed a real policy bug: bisection initially treated entry into the near-equilibrium band as the root. The implementation was corrected so anti-overshoot solves the actual `ln(Q/K)` sign crossing. Final run `34682342429` passed.

## Tested Phase 3B-B Cases
- driving strength exactly zero at/inside equilibrium tolerance;
- monotonic increase with `|lnQOverK|`;
- forward/reverse symmetry;
- `[0,1]` boundedness;
- continuity at the epsilon boundary;
- deterministic repeated recommendation;
- near-equilibrium zero net recommendation;
- missing K -> equilibrium arbitration abstains;
- supported forward `xi_eq` bound;
- supported reverse symmetric bound;
- anti-crossing bound never exceeds 01 feasible extent;
- one-step overshoot cap reaches the actual equilibrium sign crossing;
- tiny/huge driving coordinates remain finite;
- Phase 3A kinetics remains independently authoritative;
- OPEN kinetics does not become a fabricated rate;
- reverse thermochemical/heat semantics remain untouched.

## PASS / FAIL / OPEN
### PASS
- Q/K/DeltaG foundation remains executable and regression-safe.
- Thermodynamic progression mapping is deterministic, continuous, bounded and symmetric.
- Mapping is explicitly `APPROXIMATED`, not presented as kinetic law.
- Near-equilibrium coarse net progression is exactly zero without equilibrium snap.
- OPEN equilibrium evidence produces no thermodynamic bias.
- 01 no longer needs to invent damping/hysteresis/anti-overshoot policy.
- Deterministic fixed-budget bisection provides a safe equilibrium crossing cap when projection support exists.
- Pair-level forward/reverse arbitration order is explicit.
- Phase 3A kinetic and thermal ownership remains intact.
- Full repository regression/build pass on the validated HEAD.

### FAIL
- None identified in final implemented scope.

### OPEN
- 06 independent validation of anti-ping-pong behavior and timestep sensitivity after 01 consumes the recommendation.
- 01 production wiring of pair arbitration + modulation + anti-crossing cap.
- K(T) interpolation/extrapolation.
- nonideal activities / ionic strength / fugacity.
- gas-solution coupled equilibria / precipitation-dissolution phase appearance.
- full equilibrium composition solver.
- detailed-balance enforcement / stiff reversible-network integration.

## Handoffs
- 01: consume `EquilibriumProgressionRecommendation` before normal shared-reactant competition. Apply independently-supported kinetic request × `drivingStrength`, then cap by `maxExtentTowardEquilibriumMol` when `preventEquilibriumCrossing=true`, followed by normal 01 stoichiometric/network bounds.
- 03: continue supplying K/lnK, reference T, standard-state and standard reaction thermo/provenance. Missing data remains OPEN.
- 05: do not infer rates/equilibrium progression. Display simulation-provided direction/status only.
- 06: validate permutation stability, anti-ping-pong, timestep sensitivity and crossing-cap behavior once 01 wires the policy.
- 07: integrate only after 06 approval; PR #51 remains unmerged.

## Next
01 can now implement reversible-pair arbitration without inventing thermodynamic policy. The next gate is 01 wiring + 06 independent validation, not a full equilibrium solver or electrochemistry.
