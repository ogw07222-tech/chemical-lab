# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Architect / Energy Model Architect
- Current phase: Phase 3B — Equilibrium Thermodynamics Foundation
- Overall state: PASS — FOUNDATION IMPLEMENTED / 06 independent validation pending
- Last updated: 2026-09-12
- Starting / latest checked main SHA: `e49b3f25eeb39d08a6c397c4869beceb6c5c8bbf`
- Active branch: `feature/phase3b-equilibrium-foundation`
- Active PR: #51 — `feat(02): add Phase 3B equilibrium thermodynamics foundation`
- Exact validated executable/test HEAD: `c2f65f11d43e3498ed2b78133b551a0c48f0ba5f`
- Validation workflow run: `34674889820` — SUCCESS

## Objective
Implement a provider-neutral, scientifically bounded Q/K/DeltaG thermodynamic direction layer for explicit reversible channels without creating a second reaction engine or an equilibrium-composition solver.

Canonical contract: `docs/contracts/PHASE3B_EQUILIBRIUM_THERMODYNAMICS.md`.

## Implemented

### Equilibrium result contract
`evaluateReactionEquilibrium()` returns a provider-neutral result with:
- `direction: FORWARD_FAVORED | REVERSE_FAVORED | NEAR_EQUILIBRIUM | OPEN`;
- `reactionQuotientQ` when representable;
- `equilibriumConstantK` when representable;
- `lnReactionQuotientQ`;
- `lnEquilibriumConstantK`;
- `lnQOverK` as the preferred driving coordinate;
- finite current `deltaG_J_per_mol = RT ln(Q/K)` when supported;
- `activityModel`;
- scientific status / confidence / reason codes;
- reference temperature, standard state and tolerance metadata.

Numeric fields are optional by design. Missing/unsupported evidence remains `OPEN`.

### Activity models
Supported initial models:
- `IDEAL_GAS_PARTIAL_PRESSURE`: `a = p_i / 1 bar`;
- `IDEAL_DILUTE_SOLUTION`: `a = c_i / 1 mol L^-1`;
- `PURE_PHASE_ACTIVITY_ONE`: explicit present pure solid/liquid phase only;
- `OPEN`: unsupported/nonideal/mixed models.

The implementation does not silently use concentration for gases or arbitrary condensed phases. Gas+aqueous mixed systems are `OPEN` in this foundation.

### Reaction quotient / numerical safety
`ln Q = sum(nu_i ln a_i)` is accumulated in log space.

- stoichiometric exponents are preserved;
- large/small Q can remain represented as finite `lnQ` even when raw Q cannot be exponentiated safely;
- zero product activity gives a forward-favored boundary if K is supported;
- zero reactant activity gives a reverse-favored boundary if K is supported;
- simultaneous zero activities on both sides are indeterminate -> `OPEN`;
- invalid/non-finite required inputs do not propagate NaN/Infinity into the result/state.

### K support
K is resolved only from:
1. authoritative dimensionless K/lnK with explicit reference T + standard state; or
2. supported standard reaction Gibbs energy via `ln K = -DeltaG_standard/(RT)` at the same reference T/standard state.

No fallback K exists. K is never inferred from current composition. Reference-temperature mismatch is `OPEN`; no K(T) extrapolation is performed.

### Near-equilibrium tolerance
Default engineering tolerance:

`|ln(Q/K)| <= 1e-6` -> `NEAR_EQUILIBRIUM`.

This threshold is exposed/configurable and tagged `APPROXIMATED`. It is explicitly an engineering numerical boundary, not experimental uncertainty or scientific truth.

06 guidance: sensitivity sweep at least `1e-8`, `1e-6`, `1e-4`, checking direction invariance outside the boundary and timestep sensitivity once 01 consumes the driving signal.

### Kinetics / 01 interface
02 now provides:
- favored direction;
- finite thermodynamic driving coordinate `lnQOverK` when available;
- current finite DeltaG when available;
- near-equilibrium signal;
- existing Phase 3A reversible-pair metadata.

No composition mutation, exact-equilibrium snap or reaction extent is produced here. Kinetics remains responsible for speed; 01 remains responsible for bounded extent/network mutation. The returned drive can later support progressively smaller net progression near equilibrium without forcing an exact solve.

### Exact reverse thermochemistry
`deriveExactReverseStandardThermo()` may negate standard DeltaG/DeltaH only when explicit exact-reverse provenance confirms the same reversible pair.

This supports:
- `DeltaG_standard_reverse = -DeltaG_standard_forward`;
- `DeltaH_standard_reverse = -DeltaH_standard_forward`.

No unrelated channel pairing or automatic reverse data synthesis occurs.

### Thermal consistency
Phase 3A aggregate-once reaction heat path is unchanged. Phase 3B adds no second thermal application path. Exact reverse DeltaH sign derivation is provenance-gated, so paired heat signs can remain physically consistent without double application.

## 03 Data Handoff
Exact data useful to advance Phase 3B coverage:
- named reaction/reversible-pair `K` or preferably `lnK`;
- reference temperature for every K;
- explicit standard-state convention (pressure/concentration, phase, solvent context);
- source/provenance, confidence and scientific status;
- standard reaction DeltaG where K is unavailable;
- DeltaG_f data where 03 can reconstruct reaction DeltaG with phase/standard-state consistency;
- standard DeltaH for exact reverse heat-sign consistency and future K(T) work;
- explicit exact-reverse provenance for sign-derived reverse thermochemistry.

Not required to unblock this foundation:
- broad database completeness;
- K(T) correlation for every reaction;
- activity coefficients / ionic strength models;
- fugacity corrections.

Absent reference support remains `OPEN`.

## Validation Evidence
Validated executable/test HEAD: `c2f65f11d43e3498ed2b78133b551a0c48f0ba5f`.
Temporary GitHub Actions run `34674889820`: SUCCESS. The workflow was removed afterward; executable/test blobs remain the validated versions.

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS with 0 errors; one pre-existing UI hooks warning
- targeted Phase 3B equilibrium + Phase 3A regression: **6 files / 59 tests PASS**
  - Phase 3B equilibrium: 15/15
  - Phase 3A kinetics/thermal: 10/10
  - Phase 3A dimensioned resolver: 2/2
  - reaction evaluation: 9/9
  - reaction progression: 10/10
  - thermal: 13/13
- full `npm test`: **20 files / 232 tests PASS**
- `npm run build`: PASS

## Tested Phase 3B Cases
- A <=> B mostly-A -> forward favored;
- mostly-B -> reverse favored;
- near-equilibrium log-ratio classification;
- stoichiometric Q exponents;
- ideal-gas partial-pressure activity;
- ideal-dilute aqueous activity;
- explicit pure solid/liquid activity one;
- unsupported gas+aqueous model -> OPEN;
- zero/tiny activities without NaN/Infinity propagation;
- very large Q retained in log space;
- missing K/DeltaG_standard -> OPEN;
- standard DeltaG -> lnK conversion;
- deterministic repeated evaluation;
- exact forward/reverse DeltaG/DeltaH sign consistency;
- configurable near-equilibrium tolerance stability.

## PASS / FAIL / OPEN
### PASS
- Provider-neutral Q/K/DeltaG equilibrium direction foundation is executable.
- Q uses dimensionless activities and stoichiometric exponents.
- Supported ideal activity models are explicit; unsupported models remain OPEN.
- K provenance/reference temperature/standard state survive evaluation.
- No current-composition K inference or fallback K exists.
- Log-space implementation avoids raw Q/K overflow propagation.
- Near-equilibrium threshold is configurable and explicitly approximate.
- Thermodynamic direction is separated from kinetic speed and inventory mutation.
- Exact reverse sign derivation is provenance-gated.
- Phase 3A kinetic/thermal and full repository regression pass on validated HEAD.

### FAIL
- None identified in implemented Phase 3B foundation scope.

### OPEN
- 06 independent scientific/numerical validation of tolerance and reversible-network behavior.
- 01 integration policy for converting `lnQOverK` into progressively small forward/reverse net progression; no snap-to-equilibrium implementation exists.
- General K(T) interpolation/extrapolation.
- Nonideal solution activity coefficients / ionic strength.
- Gas fugacity / nonideal pressure corrections.
- Gas-solution coupled equilibria and phase-partition solving.
- Precipitation/dissolution phase-appearance solving.
- Full equilibrium composition solver.
- Detailed-balance enforcement and stiff reversible-network integration.

## Handoffs
- 01: consume equilibrium result as thermodynamic direction/driving evidence only; preserve authoritative stoichiometric bounds and mutation. Do not snap composition to K.
- 03: supply exact K/lnK, reference T, standard-state and standard reaction thermochemistry/provenance records described above.
- 05: display direction/Q/K only when provided; `OPEN` must remain unknown, not zero/equilibrium.
- 06: independently validate Q/K direction, tolerance sensitivity, permutation determinism and coupled forward/reverse timestep behavior.
- 07: integrate only after 06 approval; no merge was performed by 02.

## Next
Independent 06 Phase 3B validation, then an explicit 00/01/02 contract for how finite `lnQOverK` modulates net reversible progression across timesteps. Do not implement a full equilibrium solver yet.
