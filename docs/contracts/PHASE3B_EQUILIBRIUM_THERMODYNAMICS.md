# Phase 3B Equilibrium Thermodynamics Contract

Status: IMPLEMENTED FOUNDATION + PROGRESSION POLICY / independent 06 validation pending
Owner: 02 — Thermodynamics & Kinetics

## Purpose
Provide a scientifically honest thermodynamic direction and coarse reversible-pair progression policy without adding a second reaction engine or mutating composition.

For a reaction written as:

`sum(nu_r R) <=> sum(nu_p P)`

Phase 3B evaluates the dimensionless reaction quotient in log space:

`ln Q = sum(nu_i ln a_i)`

where product stoichiometric coefficients are positive and reactant coefficients are negative.

When a supported equilibrium constant exists:

`x = ln(Q/K) = ln Q - ln K`

Direction semantics:
- `x < -epsilon_eq` -> `FORWARD_FAVORED`
- `x > +epsilon_eq` -> `REVERSE_FAVORED`
- `|x| <= epsilon_eq` -> `NEAR_EQUILIBRIUM`
- insufficient/unsupported model or data -> `OPEN`

When finite and supported:

`DeltaG = R T x`

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

## Phase 3B-B progression recommendation
Phase 3B-B closes the policy gap between thermodynamic direction and 01 reversible-pair arbitration. It does not replace kinetics.

`EquilibriumProgressionRecommendation` supplies:
- `mode: FORWARD | REVERSE | NEAR_EQUILIBRIUM | INDETERMINATE`;
- `drivingStrength` in `[0,1]`;
- `maxNetProgressFraction` in `[0,1]`;
- `preventEquilibriumCrossing`;
- optional `maxExtentTowardEquilibriumMol` when a safe bound is calculable;
- scientific status and reason codes.

### Continuous driving-strength mapping
The authoritative coarse modulation is:

`d = max(0, |x| - epsilon_eq)`

`drivingStrength = 1 - exp(-d)`

implemented numerically as `-expm1(-d)`.

Properties:
- exactly zero throughout the engineering near-equilibrium band;
- continuous at `|x| = epsilon_eq`;
- monotonic in `|x|` outside the band;
- symmetric between forward and reverse magnitudes;
- bounded in `[0,1]` and asymptotically approaches 1;
- deterministic and numerically stable for very small/large finite `x`.

Scientific label: `APPROXIMATED`. This is a coarse thermodynamic driving-force modulation, not a fundamental kinetic law.

The conceptual 01 composition rule is:

`kineticRequestedExtent * drivingStrength`

followed by 01-owned:
- stoichiometric availability;
- shared-reactant competition;
- max fractional consumption safety bounds;
- conservation/state mutation.

The recommendation never creates a rate. If Phase 3A kinetics is `OPEN` or qualitative-only, Phase 3B-B does not fabricate a numeric kinetic request.

### Near-equilibrium semantics
When `|x| <= epsilon_eq`:
- mode = `NEAR_EQUILIBRIUM`;
- `drivingStrength = 0`;
- `maxNetProgressFraction = 0`;
- recommended coarse **net** pair progression is zero;
- there is no composition snap and no channel flip-flop.

This says nothing about microscopic forward/reverse rates. Microscopic bidirectional exchange is outside the current coarse model.

### OPEN / indeterminate semantics
If Q/K evidence is not supported:
- mode = `INDETERMINATE`;
- scientific status = `OPEN`;
- equilibrium arbitration contributes no direction bias, suppression or boost;
- `preventEquilibriumCrossing = false` because no thermodynamic crossing bound is known.

Existing independently-supported Phase 3A kinetics may continue under the pre-existing rules. 01 must not invent equilibrium behavior.

## Anti-overshoot contract
01 supplies only state/stoichiometric facts:
- `maxFeasibleExtentMol` in the thermodynamically favored direction;
- a pure read-only `projectComposition(netForwardExtentMol)` callback using 01-owned mutation/stoichiometry semantics.

02 owns the equilibrium crossing policy and solver.

For supported Q/K models, 02 searches for a bounded extent where:

`ln(Q(xi_eq)/K) = 0`

using deterministic bisection.

Rules:
- search interval is `[0, maxFeasibleExtentMol]` in the favored direction;
- forward projection uses positive net-forward extent, reverse projection uses negative net-forward extent;
- default maximum iterations = 48;
- default extent tolerance = `1e-12 mol`, explicitly an engineering numerical tolerance;
- both values are configurable;
- root search uses the sign of finite `ln(Q/K)`, not the wider near-equilibrium classification band;
- a zero-activity endpoint may still provide a bracketing thermodynamic direction even when finite `ln(Q/K)` is intentionally omitted;
- no projected vessel mutation is committed by 02;
- no returned bound can exceed 01's supplied feasible extent;
- invalid/OPEN projection evidence returns no anti-crossing bound rather than inventing one.

If equilibrium lies beyond the entire feasible interval, `maxExtentTowardEquilibriumMol = maxFeasibleExtentMol`; the full feasible step remains thermodynamically on the same side of equilibrium.

If a crossing is bracketed, `maxExtentTowardEquilibriumMol` is the deterministic bisection bound. 01 must cap the modulated kinetic request by this value before committing the pair extent.

## Forward/reverse pair arbitration order
Equilibrium arbitration happens **before** normal shared-reactant competition.

For an explicitly paired reversible process:
- `FORWARD`: only the forward channel represents the pair-level net path; reverse is not independently committed as a competing net path in the same arbitration step;
- `REVERSE`: symmetric reverse rule;
- `NEAR_EQUILIBRIUM`: zero coarse net pair progression;
- `INDETERMINATE`: equilibrium arbitration abstains and contributes no pair preference.

After pair-level arbitration, the surviving/modulated net request enters the ordinary 01 competition/allocation layer with unrelated reactions.

This prevents ordering-induced forward/reverse ping-pong without claiming detailed balance or exact equilibrium kinetics.

## Kinetics / 01 boundary
02 supplies:
- favored thermodynamic direction;
- `ln(Q/K)` when supported;
- current `DeltaG` when finite;
- near-equilibrium signal;
- reversible-pair metadata already established in Phase 3A;
- bounded coarse thermodynamic progression recommendation;
- anti-crossing bound where projection support exists.

02 does not:
- mutate species inventory;
- force exact equilibrium composition;
- snap extent to K;
- synthesize forward/reverse rates;
- implement a second network engine.

Kinetics still determines how fast either channel can progress. 01 combines independently-supported kinetics with the 02 thermodynamic modulation and then applies its own stoichiometric/network bounds.

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
- stiff reversible-network integration;
- 06 independent validation of timestep sensitivity and anti-ping-pong behavior after 01 integration.
