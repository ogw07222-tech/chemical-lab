import { fail, open, pass, stableSerialize, type ScientificModelStatus, type ValidationResult } from "./core";
import { assertElementInventory, assertExactInvariant } from "./invariants";

export interface ReactionConservationSnapshot {
  reactantElements: Readonly<Record<string, number>>;
  productElements: Readonly<Record<string, number>>;
  reactantAtomCount: number;
  productAtomCount: number;
  reactantCharge: number;
  productCharge: number;
  reactantExplicitElectrons?: number;
  productExplicitElectrons?: number;
}

export interface ProductGraphSanity {
  overValence: boolean;
  invalidBond: boolean;
  danglingAtom: boolean;
  malformedGraph: boolean;
  duplicateAtomMapping: boolean;
  finiteNumericState: boolean;
}

export interface ThermodynamicSnapshot {
  deltaH_JPerMol?: number;
  deltaG_JPerMol?: number;
  direction?: "FORWARD" | "REVERSE" | "NEAR_EQUILIBRIUM" | "UNKNOWN";
  feasibility?: "FAVORABLE" | "UNFAVORABLE" | "UNKNOWN";
  scientificStatus: ScientificModelStatus;
  dataAvailable: boolean;
}

export interface KineticSnapshot {
  activationEnergy_JPerMol?: number;
  lowTemperatureK?: number;
  highTemperatureK?: number;
  lowTemperatureRate?: number;
  highTemperatureRate?: number;
  uncatalyzedRate?: number;
  catalyzedRate?: number;
  effectiveRate?: number;
  feasible?: boolean;
  equilibriumChangedByCatalyst?: boolean;
  scientificStatus: ScientificModelStatus;
  barrierKnown: boolean;
}

export interface CandidatePerformanceCounters {
  reactiveSites: number;
  eligiblePairs: number;
  rawCandidates: number;
  deduplicatedCandidates: number;
  prunedCandidates: number;
  runtimeMs: number;
}

export interface ReactionCandidateValidationView {
  id: string;
  canonicalKey: string;
  conservation: ReactionConservationSnapshot;
  structure: ProductGraphSanity;
  thermo?: ThermodynamicSnapshot;
  kinetics?: KineticSnapshot;
}

export interface ReactionGenerationResult {
  candidates: readonly ReactionCandidateValidationView[];
  performance: CandidatePerformanceCounters;
}

export interface ReactionValidationAdapter<TInput = unknown, TConfig = unknown> {
  generate(input: TInput, config: TConfig): Promise<ReactionGenerationResult> | ReactionGenerationResult;
}

export interface ReactionReferenceExpectation {
  expectCandidate?: boolean;
  expectedThermalSign?: "EXOTHERMIC" | "ENDOTHERMIC";
  expectedDirection?: "FORWARD" | "REVERSE";
  expectedRateOrder?: readonly string[];
}

export interface ReactionValidationCase<TInput = unknown, TConfig = unknown> {
  id: string;
  input: TInput;
  config: TConfig;
  reference?: ReactionReferenceExpectation;
  provenanceAvailable: boolean;
}

export function validateConservation(candidate: ReactionCandidateValidationView): ValidationResult {
  const checks = [
    assertElementInventory(`${candidate.id}.elements`, candidate.conservation.reactantElements, candidate.conservation.productElements),
    assertExactInvariant(`${candidate.id}.atoms`, candidate.conservation.reactantAtomCount, candidate.conservation.productAtomCount),
    assertExactInvariant(`${candidate.id}.charge`, candidate.conservation.reactantCharge, candidate.conservation.productCharge),
  ];
  if (candidate.conservation.reactantExplicitElectrons !== undefined || candidate.conservation.productExplicitElectrons !== undefined) {
    checks.push(assertExactInvariant(
      `${candidate.id}.electrons`,
      candidate.conservation.reactantExplicitElectrons ?? 0,
      candidate.conservation.productExplicitElectrons ?? 0,
    ));
  }
  const failed = checks.find((result) => result.verdict === "FAIL");
  return failed ? fail(candidate.id, `absolute conservation gate failed: ${failed.id}`) : pass(candidate.id);
}

export function validateStructure(candidate: ReactionCandidateValidationView): ValidationResult {
  const s = candidate.structure;
  if (!s.finiteNumericState) return fail(candidate.id, "invalid numeric state");
  if (s.overValence) return fail(candidate.id, "over-valence product graph");
  if (s.invalidBond) return fail(candidate.id, "invalid bond");
  if (s.danglingAtom) return fail(candidate.id, "dangling atom");
  if (s.duplicateAtomMapping) return fail(candidate.id, "duplicate atom mapping");
  if (s.malformedGraph) return fail(candidate.id, "malformed product graph");
  return pass(candidate.id);
}

export function validateCandidateSet(result: ReactionGenerationResult): ValidationResult {
  const ids = new Set<string>();
  const canonical = new Set<string>();
  for (const candidate of result.candidates) {
    if (ids.has(candidate.id)) return fail("candidate-set", `duplicate candidate id: ${candidate.id}`);
    if (canonical.has(candidate.canonicalKey)) return fail("candidate-set", `duplicate canonical candidate: ${candidate.canonicalKey}`);
    ids.add(candidate.id);
    canonical.add(candidate.canonicalKey);
    const conservation = validateConservation(candidate);
    if (conservation.verdict === "FAIL") return conservation;
    const structure = validateStructure(candidate);
    if (structure.verdict === "FAIL") return structure;
  }
  const counters = Object.values(result.performance);
  if (counters.some((value) => !Number.isFinite(value) || value < 0)) return fail("candidate-set", "invalid performance counters");
  if (result.performance.deduplicatedCandidates > result.performance.rawCandidates) {
    return fail("candidate-set", "deduplicated candidate count exceeds raw candidate count");
  }
  if (result.performance.prunedCandidates > result.performance.deduplicatedCandidates) {
    return fail("candidate-set", "pruned candidate count exceeds deduplicated candidate count");
  }
  return pass("candidate-set");
}

export function validateThermodynamics(candidate: ReactionCandidateValidationView, reference?: ReactionReferenceExpectation): ValidationResult {
  const thermo = candidate.thermo;
  if (!thermo || !thermo.dataAvailable || thermo.scientificStatus === "OPEN") {
    return open(candidate.id, "thermodynamic data unavailable or OPEN", undefined, thermo?.scientificStatus ?? "OPEN");
  }
  if (thermo.deltaH_JPerMol !== undefined && !Number.isFinite(thermo.deltaH_JPerMol)) return fail(candidate.id, "non-finite deltaH");
  if (thermo.deltaG_JPerMol !== undefined && !Number.isFinite(thermo.deltaG_JPerMol)) return fail(candidate.id, "non-finite deltaG");
  if (thermo.deltaG_JPerMol !== undefined && thermo.direction && thermo.direction !== "UNKNOWN" && thermo.direction !== "NEAR_EQUILIBRIUM") {
    if (thermo.deltaG_JPerMol < 0 && thermo.direction === "REVERSE") return fail(candidate.id, "deltaG sign/direction internally inconsistent");
    if (thermo.deltaG_JPerMol > 0 && thermo.direction === "FORWARD") return fail(candidate.id, "deltaG sign/direction internally inconsistent");
  }
  if (reference?.expectedThermalSign && thermo.deltaH_JPerMol !== undefined) {
    const observed = thermo.deltaH_JPerMol < 0 ? "EXOTHERMIC" : "ENDOTHERMIC";
    if (observed !== reference.expectedThermalSign) return fail(candidate.id, "reaction enthalpy sign mismatch");
  }
  if (reference?.expectedDirection && thermo.direction && thermo.direction !== "UNKNOWN" && thermo.direction !== "NEAR_EQUILIBRIUM") {
    if (thermo.direction !== reference.expectedDirection) return fail(candidate.id, "major reaction direction reversed");
  }
  return pass(candidate.id, undefined, thermo.scientificStatus);
}

export function validateKinetics(candidate: ReactionCandidateValidationView): ValidationResult {
  const kinetics = candidate.kinetics;
  if (!kinetics || !kinetics.barrierKnown || kinetics.scientificStatus === "OPEN") {
    return open(candidate.id, "kinetic barrier unavailable or OPEN", undefined, kinetics?.scientificStatus ?? "OPEN");
  }
  const values = [
    kinetics.activationEnergy_JPerMol,
    kinetics.lowTemperatureK,
    kinetics.highTemperatureK,
    kinetics.lowTemperatureRate,
    kinetics.highTemperatureRate,
    kinetics.uncatalyzedRate,
    kinetics.catalyzedRate,
    kinetics.effectiveRate,
  ].filter((value): value is number => value !== undefined);
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return fail(candidate.id, "invalid kinetic numeric state");
  if (
    (kinetics.activationEnergy_JPerMol ?? 0) > 0 &&
    kinetics.lowTemperatureK !== undefined && kinetics.highTemperatureK !== undefined &&
    kinetics.lowTemperatureRate !== undefined && kinetics.highTemperatureRate !== undefined &&
    kinetics.highTemperatureK > kinetics.lowTemperatureK && kinetics.highTemperatureRate < kinetics.lowTemperatureRate
  ) return fail(candidate.id, "positive-Ea temperature response reversed");
  if (
    kinetics.uncatalyzedRate !== undefined && kinetics.catalyzedRate !== undefined &&
    kinetics.catalyzedRate < kinetics.uncatalyzedRate
  ) return fail(candidate.id, "catalyst reduced modeled rate in validation fixture");
  if (kinetics.equilibriumChangedByCatalyst) return fail(candidate.id, "catalyst altered equilibrium thermodynamics");
  return pass(candidate.id, undefined, kinetics.scientificStatus);
}

export function validateRateOrdering(
  candidates: readonly ReactionCandidateValidationView[],
  expectedCanonicalOrder: readonly string[],
): ValidationResult {
  const rateRows = candidates
    .filter((candidate) => candidate.kinetics?.effectiveRate !== undefined)
    .map((candidate) => ({ key: candidate.canonicalKey, rate: candidate.kinetics!.effectiveRate! }));
  if (rateRows.some((row) => !Number.isFinite(row.rate) || row.rate < 0)) return fail("rate-order", "invalid effective rate");
  if (rateRows.length < expectedCanonicalOrder.length) return open("rate-order", "insufficient kinetic rates to evaluate expected ordering");
  const observed = [...rateRows].sort((a, b) => b.rate - a.rate || a.key.localeCompare(b.key)).map((row) => row.key);
  const expected = [...expectedCanonicalOrder];
  return stableSerialize(observed.slice(0, expected.length)) === stableSerialize(expected)
    ? pass("rate-order")
    : fail("rate-order", "relative kinetic ordering mismatch", { expected, observed });
}

export function validateNegativeControl(generation: ReactionGenerationResult): ValidationResult {
  if (generation.candidates.length === 0) return pass("negative-control");
  let hasOpen = false;
  for (const candidate of generation.candidates) {
    const thermo = candidate.thermo;
    const kinetics = candidate.kinetics;
    if (thermo?.feasibility === "UNFAVORABLE" || kinetics?.feasible === false) continue;
    const thermoOpen = !thermo || !thermo.dataAvailable || thermo.scientificStatus === "OPEN" || thermo.feasibility === "UNKNOWN";
    const kineticsOpen = !kinetics || !kinetics.barrierKnown || kinetics.scientificStatus === "OPEN";
    if (thermoOpen || kineticsOpen) {
      hasOpen = true;
      continue;
    }
    return fail("negative-control", `candidate ${candidate.id} remains feasible in negative control`);
  }
  return hasOpen
    ? open("negative-control", "negative control remains unresolved because candidate evaluation is OPEN")
    : pass("negative-control");
}

export function validateReferenceExpectation(
  generation: ReactionGenerationResult,
  reference: ReactionReferenceExpectation | undefined,
  provenanceAvailable: boolean,
): ValidationResult {
  if (!reference || !provenanceAvailable) return open("reference", "reference data/provenance insufficient");
  if (reference.expectCandidate === true && generation.candidates.length === 0) return fail("reference", "expected generic candidate missing");
  if (reference.expectCandidate === false) return validateNegativeControl(generation);
  return pass("reference");
}

export async function validateDeterminism<TInput, TConfig>(
  adapter: ReactionValidationAdapter<TInput, TConfig>,
  input: TInput,
  config: TConfig,
): Promise<ValidationResult> {
  const first = await adapter.generate(input, config);
  const second = await adapter.generate(input, config);
  return stableSerialize(first) === stableSerialize(second)
    ? pass("determinism")
    : fail("determinism", "same input/config produced different candidates/order/evaluation");
}

export interface ReactionPerformanceObservation extends CandidatePerformanceCounters {
  engineeringBudgetStatus: "WITHIN_BUDGET" | "OVER_BUDGET" | "UNSPECIFIED";
}

export function observePerformance(
  counters: CandidatePerformanceCounters,
  engineeringRuntimeBudgetMs?: number,
): ReactionPerformanceObservation {
  return {
    ...counters,
    engineeringBudgetStatus: engineeringRuntimeBudgetMs === undefined
      ? "UNSPECIFIED"
      : counters.runtimeMs <= engineeringRuntimeBudgetMs ? "WITHIN_BUDGET" : "OVER_BUDGET",
  };
}
