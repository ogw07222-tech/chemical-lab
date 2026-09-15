# 02 — Thermodynamics & Kinetics

- Owner: Thermodynamics Simulation Developer / Chemical Kinetics Systems Developer / Equilibrium Model Architect / Energy Model Architect
- Current phase: Phase 4A-3 — 06D defect fix
- Overall state: FIX READY FOR 06D REVALIDATION / merge blocked pending independent PASS
- Last updated: 2026-09-15
- Latest checked main SHA: `28b85072ada9865d76d3e7874f926490558a198c`
- Active branch: `feature/phase4a3-thermal-apparatus`
- Active PR: #68 — `feat(02): add Phase 4A-3 thermal apparatus engine`
- Pre-fix PR HEAD: `b2b15d1fb05c8f7c0e98be39a78d97e0308cf3bf`
- Exact post-fix executable/test HEAD: `4251f23daddb287fe5040c2ca29a923ac14b05be`
- Fix validation workflow run: `34952609240` — SUCCESS

## Independent validation basis
06D independently reported `PHASE4A3_VALIDATION_FAIL / MERGE_ALLOWED_NO` against the pre-fix implementation. The reproduction evidence identified three narrow defects:
- DEF-01: multiple target-bearing actuators independently consumed the same snapshot target headroom;
- DEF-02: target semantics under concurrent reaction/reservoir sources were insufficiently explicit to callers;
- DEF-03: duplicate contact/reservoir/actuator IDs were accepted despite audit/replay identity ambiguity.

No broad Phase 4A-3 redesign was performed.

Canonical base contract remains `docs/contracts/PHASE4A3_THERMAL_APPARATUS.md`.
Defect-fix semantics: `docs/contracts/PHASE4A3_06D_DEFECT_FIX.md`.

## DEF-01 — multi-actuator setpoint overshoot
### Root cause
Each target-bearing actuator evaluated `C * |target - snapshotT|` independently. Those individually capped energies were then summed without a body-level actuator envelope, so N identical actuators could reuse the same headroom N times.

### Fix
Target-bearing actuators now use deterministic two-stage evaluation:
1. each actuator remains capped by its own snapshot target headroom;
2. target-bearing contributions are grouped by `(bodyId, mode)` and proportionally normalized if their aggregate request exceeds the directional snapshot envelope.

For HEATER groups the aggregate directional envelope ends at the highest participating target; for COOLER groups it ends at the lowest participating target. Because each actuator is individually capped first, mixed-target actuators retain their own constraints before a common scale is applied. No sequential first-actuator-wins behavior is used.

Target-less actuators remain ordinary explicit external sources/sinks and are not silently assigned a setpoint.

### Verified regressions
- 2 identical heaters at 300 K targeting 400 K: final 400 K, not 500 K;
- 3 and 5 identical heaters: no count-scaled overshoot;
- two identical coolers: no target undershoot;
- mixed 350 K / 400 K heater targets: deterministic proportional reconciliation;
- actuator input permutation: identical result.

## DEF-02 — actuator target semantics
Authoritative contract:

`targetTemperatureK` bounds the actuator system's own control contribution. It is **not** a hard clamp on final body temperature.

Therefore:
- reaction heat is never clipped to satisfy an apparatus target;
- a hotter reservoir/contact may drive final temperature above a heater target;
- an endothermic reaction or independent colder sink may drive final temperature below a control target;
- the setpoint remains a control request, not a natural-law temperature boundary.

For target-bearing actuators, informational diagnostics expose:
- `actuatorRequestedEnergyJ`;
- `actuatorAppliedEnergyJ`;
- `targetLimited`;
- `finalTemperatureMayCrossTargetDueToOtherSources=true`.

Regression cases cover heater + exothermic reaction, cooler + endothermic reaction, and heater + hotter reservoir while confirming the actuator's own energy remains capped.

## DEF-03 — duplicate IDs / atomicity
The evaluator now rejects duplicate IDs before transfer evaluation for each type-scoped namespace:
- body IDs;
- contact IDs;
- reservoir IDs;
- actuator IDs;
- reaction-source IDs.

Duplicates throw deterministically. No entry is silently deduplicated. Physically parallel contacts/actuators require distinct stable IDs. Because these checks run before evaluation, duplicate-input failures cannot yield partial body updates.

Existing atomic OPEN behavior for a later invalid temperature update remains unchanged (`bodyUpdates: []`).

## Unchanged physics
The narrow fix does not change:
- mixture Cp evaluation;
- passive finite contact closed-form relaxation;
- reservoir closed-form relaxation;
- reaction enthalpy/extent authority;
- positive-Kelvin guard;
- Phase 4A-1 matter semantics;
- phase-transition boundary;
- gas transport;
- UI implementation.

## Energy accounting
The existing invariant remains:

`DeltaE_body = Q_internal + Q_reservoir + Q_heater - Q_cooler + Q_reaction`

and over modeled finite bodies:

`Sum(DeltaE_finite) = externalEnergyJ + reactionEnergyJ`.

Internal finite-body transfers remain equal-and-opposite. Actuator normalization scales explicit external contribution before accounting; it does not erase already-applied energy or reaction heat.

## Validation evidence
Exact executable/test HEAD: `4251f23daddb287fe5040c2ca29a923ac14b05be`.
Temporary workflow run `34952609240`: SUCCESS.

- `npm ci --no-audit --no-fund`: PASS
- `npm run typecheck`: PASS
- `npm run lint`: PASS with 0 errors; one pre-existing `src/ui/provider.tsx` hooks warning
- defect + existing Phase 4A-3 targeted: **2 files / 50 tests PASS**
  - 06D defect regressions: 16/16
  - existing Phase 4A-3: 34/34
- thermal / chemistry regression group: **8 files / 105 tests PASS**
  - thermal: 13
  - Phase 3A kinetics/thermal: 10
  - Phase 3B equilibrium: 15
  - Phase 3B progression: 13
  - Phase 3B reversible arbitration: 16
  - reaction progression: 10
  - Phase 4A-1: 17
  - Dynamic Species Registry: 11
- full `npm test`: **29 files / 351 tests PASS**
- `npm run build`: PASS

The temporary defect-fix workflow was removed after preserving successful run `34952609240`; executable/test blobs at the exact validated HEAD remain unchanged.

## PASS / FAIL / OPEN
### PASS — implementation fix scope
- same-target multi-heater and multi-cooler envelope;
- 3/5-actuator count scaling regression;
- mixed-target deterministic reconciliation;
- actuator order invariance;
- explicit own-contribution target semantics;
- diagnostic visibility for requested/applied target-bearing actuator energy;
- duplicate contact/reservoir/actuator/reaction-source rejection;
- closed-system/external/reaction energy accounting regressions;
- existing passive large-dt and multi-contact behavior regression;
- full main-baseline suite/build.

### FAIL
- No implementation failure remains in the narrow defect-fix regression set.

### OPEN
- independent 06D revalidation of the new exact HEAD;
- PR #68 merge permission remains NO until 06D changes verdict;
- Phase 4A-2 cross-PR compatibility unless/until #67 is integrated and rechecked;
- production cross-module reaction/apparatus orchestration wiring;
- authoritative apparatus conductance/thermal-mass calibration;
- phase-transition/latent-heat authority.

## Handoffs
- 06D: revalidate PR #68 at the updated exact source, concentrating on DEF-01/02/03 plus retained conservation/stability/determinism gates.
- 01: reaction heat remains upstream authoritative; do not add setpoint clipping to reaction energy.
- 04: setpoints are control requests, not final-body hard clamps.
- 05B/05C/05D: use authoritative backend diagnostics/facts; no frontend thermal integration.
- 07: do not merge before independent 06D PASS and required cross-PR integration checks.

## Next
06D Phase 4A-3 Thermal Validation recheck. No Phase 4B or unrelated thermal feature expansion belongs in this fix.
