# Phase 3B Equilibrium Thermodynamics Contract

Status: IMPLEMENTED FOUNDATION / independent 06 validation pending
Owner: 02 — Thermodynamics & Kinetics

## Purpose
Provide a scientifically honest thermodynamic direction layer for explicit reversible reaction channels without adding a second reaction engine or mutating composition.

For a reaction written as:

`sum(nu_r R) <=> sum(nu_p P)`

Phase 3B evaluates the dimensionless reaction quotient in log space:

`ln Q = sum(nu_i ln a_i)`

where product stoichiometric coefficients are positive and reactant coefficients are negative.

When a supported equilibrium constant exists:

`ln(Q/K) = ln Q - ln K`

Direction semantics:
- `ln(Q/K) < -epsilon_eq` -> `FORWARD_FAVORED`
- `ln(Q/K) > +epsilon_eq` -> `REVERSE_FAVORED`
- `|ln(Q/K)| <= epsilon_eq` -> `NEAR_EQUILIBRIUM`
- insufficient/unsupported model or data -> `OPEN`

When finite and supported:

`DeltaG = R T ln(Q/K)`

This value is a thermodynamic driving measure only. It is not a reaction extent and does not mutate composition.

## Activity models
Only the following initial approximations are supported.

### IDEAL_GAS_PARTIAL_PRESSURE
`a_i = p_i / p_standard`

Default standard pressure: `p_standard = 100000 Pa` (1 bar).

### IDEAL_DILUTE_SOLUTION
`a_i = c_i / c_standard`

Default concentration standard: `c_standard = 1000 mol/m^3` (1 mol/L).

### PURE_PHASE_ACTIVITY_ONE
For an explicitly present pure solid or pure liquid phase:

`a_i ~= 1`

The caller must explicitly assert pure-phase applicability. Condensed phases are not silently treated as pure.

### OPEN
Unsupported phase/nonideal combinations remain `OPEN`. In particular, the foundation does not silently apply concentration quotients to gas, mixed gas/solution, nonideal solution, supercritical, plasma, multiphase or unknown systems.

## Numerical safety
- Q is accumulated in log space.
- Raw `Q` or `K` is emitted only when exponentiation is finite and representable.
- Very large/small values retain finite `lnQ`, `lnK` and `ln(Q/K)` when possible without emitting Infinity.
- zero product activity gives a forward-favored boundary when K is supported;
- zero reactant activity gives a reverse-favored boundary when K is supported;
- simultaneous zero activities on both sides are indeterminate and return `OPEN`;
- NaN/non-finite required inputs are rejected or return `OPEN`; they are never propagated into simulation state.

## Equilibrium constant support
K may come from:
1. authoritative dimensionless K under an explicit standard state and reference temperature;
2. supported standard reaction Gibbs energy under the same standard state and reference temperature, using `ln K = -DeltaG_standard/(RT)`.

No fallback K exists. K is never inferred from current composition.

Reference-temperature mismatch is `OPEN`; Phase 3B does not extrapolate K(T) without an explicit temperature model.

## Engineering near-equilibrium tolerance
Default:

`epsilon_eq = 1e-6` in dimensionless `ln(Q/K)`.

This is an engineering numerical decision boundary, not a claim about experimental equilibrium uncertainty. It is therefore tagged `APPROXIMATED`, exposed in result metadata and configurable.

06 validation guidance:
- sweep at least `1e-8`, `1e-6`, `1e-4`;
- verify direction stability away from the boundary;
- verify only the near-equilibrium classification changes inside the swept boundary;
- combine tolerance sensitivity with timestep sensitivity once 01 consumes the driving signal.

## Kinetics / 01 boundary
02 supplies:
- favored thermodynamic direction;
- `ln(Q/K)` when supported;
- current `DeltaG` when finite;
- near-equilibrium signal;
- reversible-pair metadata already established in Phase 3A.

02 does not:
- mutate species inventory;
- force exact equilibrium composition;
- snap extent to K;
- synthesize forward/reverse rates;
- implement a second network engine.

Kinetics still determines how fast either channel progresses. Near equilibrium should be consumed as a progressively small net driving signal by later 01/02 coupling, not as an instantaneous composition solve.

## Exact reverse thermochemistry
Sign derivation is permitted only with explicit provenance confirming exact reverse channels of the same physical process and the same reversible pair.

Then:
- `DeltaG_standard_reverse = -DeltaG_standard_forward`
- `DeltaH_standard_reverse = -DeltaH_standard_forward`

No reverse thermodynamic data is synthesized without that proof. Phase 3A aggregate-once thermal coupling remains authoritative; this contract does not add another heat application path.

## 03 data handoff
Minimum useful records for Phase 3B:
- dimensionless `K` or preferably `ln K` for a named reaction/reversible pair;
- reference temperature for every K;
- explicit standard-state convention (`p_standard`, `c_standard`, phase/solvent context);
- source/provenance, confidence and scientific status;
- standard reaction `DeltaG_standard` where K is unavailable;
- `DeltaG_f_standard` data only where a 03 adapter can reconstruct reaction `DeltaG_standard` with phase/standard-state consistency;
- `DeltaH_standard` for exact reverse heat-sign consistency and future K(T) work;
- explicit exact-reverse provenance when sign derivation is allowed.

Future/non-blocking data:
- K(T) correlations or validated van't Hoff inputs;
- activity coefficients, ionic-strength/solvent models;
- fugacity/nonideal gas corrections.

Missing records remain `OPEN` and do not block the foundation implementation.

## Explicit limitations
OPEN for this phase:
- nonideal solution activities;
- gas fugacity corrections;
- coupled gas/solution partition equilibrium;
- precipitation/dissolution phase-appearance solver;
- ionic-strength / Debye-Huckel / Pitzer models;
- K(T) extrapolation/interpolation without authoritative model data;
- full equilibrium composition solver;
- detailed-balance enforcement;
- stiff reversible-network integration.
