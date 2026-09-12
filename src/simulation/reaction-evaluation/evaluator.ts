import type { Confidence } from "../../data/schema";
import type { ScientificStatus } from "../molecular/types";
import type {
  CandidateSpeciesTerm,
  EnvironmentEvaluationResult,
  EvaluatedQuantity,
  Feasibility,
  KineticEnvironmentDependencies,
  KineticEvaluationResult,
  PhaseAccessibilityClass,
  PressureRelevance,
  RateClass,
  ReactionCandidateAdapter,
  ReactionCandidateEvaluationView,
  ReactionEnvironment,
  ReactionEvaluation,
  ReactionEvaluationDataProvider,
  ReasonCode,
  SourceMetadata,
  ThermodynamicDirection,
  ThermodynamicEvaluationResult,
} from "./types";

const GAS_CONSTANT_J_PER_MOL_K = 8.31446261815324;

const STATUS_ORDER: Record<ScientificStatus, number> = {
  VERIFIED: 0,
  APPROXIMATED: 1,
  EMPIRICAL: 2,
  GAMEPLAY_SIMPLIFICATION: 3,
  OPEN: 4,
};

const CONFIDENCE_ORDER: Record<Confidence, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
  UNASSESSED: 3,
};

const NO_DEPENDENCIES: KineticEnvironmentDependencies = {
  temperature: false,
  activityOrConcentration: false,
  pressure: false,
  catalyst: false,
  phase: false,
};

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and > 0.`);
}

function worstStatus(values: readonly ScientificStatus[]): ScientificStatus {
  return values.reduce((worst, value) => STATUS_ORDER[value] > STATUS_ORDER[worst] ? value : worst, "VERIFIED");
}

function worstConfidence(values: readonly Confidence[]): Confidence {
  return values.reduce((worst, value) => CONFIDENCE_ORDER[value] > CONFIDENCE_ORDER[worst] ? value : worst, "HIGH");
}

function mergeSources(values: readonly EvaluatedQuantity[], modelId?: string): SourceMetadata {
  return { sourceIds: [...new Set(values.flatMap((value) => value.source.sourceIds))].sort(), modelId };
}

function weightedSum(
  terms: readonly CandidateSpeciesTerm[],
  getter: (term: CandidateSpeciesTerm) => EvaluatedQuantity | undefined,
): { value: number; values: EvaluatedQuantity[] } | undefined {
  let sum = 0;
  const values: EvaluatedQuantity[] = [];
  for (const term of terms) {
    const quantity = getter(term);
    if (!quantity || !Number.isFinite(quantity.value) || !Number.isFinite(term.coefficient) || term.coefficient <= 0) return undefined;
    sum += term.coefficient * quantity.value;
    values.push(quantity);
  }
  return { value: sum, values };
}

function directionFromDeltaG(deltaG_J_per_mol: number | undefined): ThermodynamicDirection {
  if (deltaG_J_per_mol === undefined) return "INDETERMINATE";
  if (Math.abs(deltaG_J_per_mol) <= 1e-9) return "NEAR_EQUILIBRIUM";
  return deltaG_J_per_mol < 0 ? "FORWARD_FAVORED" : "REVERSE_FAVORED";
}

function evaluateThermodynamics(
  view: ReactionCandidateEvaluationView,
  environment: ReactionEnvironment,
  provider: ReactionEvaluationDataProvider,
  reasons: ReasonCode[],
): ThermodynamicEvaluationResult {
  const direct = provider.getDirectReactionThermo?.(view.candidateId, environment);
  if (direct && (direct.deltaH_J_per_mol || direct.deltaS_J_per_mol_K || direct.deltaG_J_per_mol)) {
    const quantities = [direct.deltaH_J_per_mol, direct.deltaS_J_per_mol_K, direct.deltaG_J_per_mol].filter(Boolean) as EvaluatedQuantity[];
    let deltaG = direct.deltaG_J_per_mol?.value;
    if (deltaG === undefined && direct.deltaH_J_per_mol && direct.deltaS_J_per_mol_K) {
      deltaG = direct.deltaH_J_per_mol.value - environment.temperatureK * direct.deltaS_J_per_mol_K.value;
    }
    reasons.push("DIRECT_THERMO_DATA");
    return {
      deltaH_J_per_mol: direct.deltaH_J_per_mol?.value,
      deltaS_J_per_mol_K: direct.deltaS_J_per_mol_K?.value,
      deltaG_J_per_mol: deltaG,
      direction: directionFromDeltaG(deltaG),
      confidence: quantities.length ? worstConfidence(quantities.map((q) => q.confidence)) : "UNASSESSED",
      approximationClass: quantities.length ? worstStatus(quantities.map((q) => q.status)) : "OPEN",
      source: mergeSources(quantities, "direct-reaction-thermo"),
    };
  }

  const getSpecies = (term: CandidateSpeciesTerm) => provider.getSpeciesThermo(term.speciesKey, term.phase);
  const reactantH = weightedSum(view.reactants, (term) => getSpecies(term)?.enthalpyOfFormation_J_per_mol);
  const productH = weightedSum(view.products, (term) => getSpecies(term)?.enthalpyOfFormation_J_per_mol);
  const reactantS = weightedSum(view.reactants, (term) => getSpecies(term)?.standardMolarEntropy_J_per_mol_K);
  const productS = weightedSum(view.products, (term) => getSpecies(term)?.standardMolarEntropy_J_per_mol_K);
  const reactantG = weightedSum(view.reactants, (term) => getSpecies(term)?.gibbsEnergyOfFormation_J_per_mol);
  const productG = weightedSum(view.products, (term) => getSpecies(term)?.gibbsEnergyOfFormation_J_per_mol);

  if (reactantH && productH) {
    const deltaH = productH.value - reactantH.value;
    let quantities = [...reactantH.values, ...productH.values];
    let deltaS: number | undefined;
    let deltaG: number | undefined;
    if (reactantS && productS) {
      deltaS = productS.value - reactantS.value;
      quantities = [...quantities, ...reactantS.values, ...productS.values];
      deltaG = deltaH - environment.temperatureK * deltaS;
    } else if (reactantG && productG) {
      deltaG = productG.value - reactantG.value;
      quantities = [...quantities, ...reactantG.values, ...productG.values];
      reasons.push("MISSING_ENTROPY");
    } else {
      reasons.push("MISSING_ENTROPY");
    }
    reasons.push("FORMATION_THERMO_DATA");
    return {
      deltaH_J_per_mol: deltaH,
      deltaS_J_per_mol_K: deltaS,
      deltaG_J_per_mol: deltaG,
      direction: directionFromDeltaG(deltaG),
      confidence: worstConfidence(quantities.map((q) => q.confidence)),
      approximationClass: worstStatus(quantities.map((q) => q.status)),
      source: mergeSources(quantities, "formation-thermo"),
    };
  }

  const bondApproximation = provider.getBondEnergyApproximation?.(view);
  if (bondApproximation) {
    reasons.push("BOND_ENERGY_APPROXIMATION", "MISSING_ENTROPY");
    return {
      deltaH_J_per_mol: bondApproximation.value,
      direction: "INDETERMINATE",
      confidence: bondApproximation.confidence,
      approximationClass: worstStatus([bondApproximation.status, "APPROXIMATED"]),
      source: mergeSources([bondApproximation], "bond-energy-approximation"),
    };
  }

  const structuralApproximation = provider.getStructuralEnthalpyApproximation?.(view);
  if (structuralApproximation) {
    reasons.push("STRUCTURAL_APPROXIMATION", "MISSING_ENTROPY");
    return {
      deltaH_J_per_mol: structuralApproximation.value,
      direction: "INDETERMINATE",
      confidence: structuralApproximation.confidence,
      approximationClass: worstStatus([structuralApproximation.status, "APPROXIMATED"]),
      source: mergeSources([structuralApproximation], "structural-approximation"),
    };
  }

  reasons.push("MISSING_THERMO_DATA", "OPEN_PROPAGATED");
  return { direction: "INDETERMINATE", confidence: "UNASSESSED", approximationClass: "OPEN", source: { sourceIds: [], modelId: "open" } };
}

function evaluatePhaseAccessibility(view: ReactionCandidateEvaluationView): EnvironmentEvaluationResult["phaseAccessibility"] {
  const phases = view.reactants.map((reactant) => reactant.phase);
  let classification: PhaseAccessibilityClass = "UNKNOWN";
  let factor = 0.5;
  let status: ScientificStatus = "APPROXIMATED";
  if (phases.length > 0 && phases.every((phase) => phase === "gas")) {
    classification = "GAS_GAS";
    factor = 1;
  } else if (phases.length > 0 && phases.every((phase) => phase === "aqueous" || phase === "liquid")) {
    classification = "SOLUTION";
    factor = 1;
  } else if (phases.length > 0 && phases.every((phase) => phase === "solid")) {
    classification = "SOLID_SOLID_LOW";
    factor = 0.1;
  } else if (phases.some((phase) => phase === "solid") && phases.some((phase) => phase !== "solid" && phase !== "unknown")) {
    classification = "HETEROGENEOUS";
    factor = 0.35;
  } else if (phases.some((phase) => phase === "unknown")) {
    classification = "UNKNOWN";
    factor = 0.5;
    status = "OPEN";
  }
  return { class: classification, factor, status };
}

function pressureRelevance(view: ReactionCandidateEvaluationView): PressureRelevance {
  return view.reactants.some((term) => term.phase === "gas") || view.products.some((term) => term.phase === "gas") ? "RELEVANT" : "NONE";
}

function classifyRate(relativeRate: number | undefined): RateClass {
  if (relativeRate === undefined || !Number.isFinite(relativeRate)) return "UNKNOWN";
  if (relativeRate < 1e-6) return "NEGLIGIBLE";
  if (relativeRate < 1e-3) return "SLOW";
  if (relativeRate < 0.1) return "MODERATE";
  if (relativeRate < 0.7) return "FAST";
  return "VERY_FAST";
}

function normalizedDependencies(partial: Partial<KineticEnvironmentDependencies> | undefined): KineticEnvironmentDependencies {
  return { ...NO_DEPENDENCIES, ...(partial ?? {}) };
}

function evaluateKinetics(
  view: ReactionCandidateEvaluationView,
  environment: ReactionEnvironment,
  provider: ReactionEvaluationDataProvider,
  phaseFactor: number,
  reasons: ReasonCode[],
): { kinetics: KineticEvaluationResult; catalystModifier: number; temperatureContribution: number } {
  const dimensioned = provider.getDimensionedExtentRate?.(view, environment);
  const qualitative = provider.getQualitativeRate?.(view, environment);
  const barrierData = provider.getActivationBarrier?.(view);

  if (dimensioned) {
    const rate = dimensioned.extentRateMolPerS.value;
    if (!Number.isFinite(rate) || rate < 0) throw new RangeError("extentRateMolPerS must be finite and >= 0.");
    reasons.push("DIMENSIONED_RATE_DATA");

    let relativeRate: number | undefined;
    let activationEnergy: number | undefined;
    let temperatureContribution = 1;
    let catalystModifier = 1;
    const statuses: ScientificStatus[] = [dimensioned.extentRateMolPerS.status];
    const confidences: Confidence[] = [dimensioned.extentRateMolPerS.confidence];

    if (barrierData) {
      activationEnergy = barrierData.activationEnergy_J_per_mol.value;
      if (!Number.isFinite(activationEnergy) || activationEnergy < 0) throw new RangeError("activationEnergy_J_per_mol must be finite and >= 0.");
      reasons.push("ACTIVATION_BARRIER_KNOWN");
      if (environment.catalyst) {
        const reduction = environment.catalyst.barrierReduction_J_per_mol ?? 0;
        if (!Number.isFinite(reduction) || reduction < 0) throw new RangeError("catalyst barrier reduction must be finite and >= 0.");
        activationEnergy = Math.max(0, activationEnergy - reduction);
        catalystModifier = environment.catalyst.rateMultiplier ?? 1;
        if (!Number.isFinite(catalystModifier) || catalystModifier <= 0) throw new RangeError("catalyst rate multiplier must be finite and > 0.");
        reasons.push("CATALYST_APPLIED");
        statuses.push(environment.catalyst.status);
        confidences.push(environment.catalyst.confidence);
      }
      temperatureContribution = Math.exp(-activationEnergy / (GAS_CONSTANT_J_PER_MOL_K * environment.temperatureK));
      const activityContribution = environment.activityScale ?? 1;
      if (!Number.isFinite(activityContribution) || activityContribution < 0) throw new RangeError("activityScale must be finite and >= 0.");
      relativeRate = temperatureContribution * phaseFactor * catalystModifier * activityContribution;
      statuses.push(barrierData.activationEnergy_J_per_mol.status);
      confidences.push(barrierData.activationEnergy_J_per_mol.confidence);
    }

    return {
      kinetics: {
        supportClass: "DIMENSIONED_RATE",
        extentRateMolPerS: rate,
        ...(activationEnergy === undefined ? {} : { activationEnergy_J_per_mol: activationEnergy }),
        ...(relativeRate === undefined ? {} : { relativeRate }),
        rateClass: qualitative?.rateClass ?? classifyRate(relativeRate),
        confidence: worstConfidence(confidences),
        approximationClass: worstStatus(statuses),
        dependencies: dimensioned.dependencies,
      },
      catalystModifier,
      temperatureContribution,
    };
  }

  if (barrierData) {
    let activationEnergy = barrierData.activationEnergy_J_per_mol.value;
    if (!Number.isFinite(activationEnergy) || activationEnergy < 0) throw new RangeError("activationEnergy_J_per_mol must be finite and >= 0.");
    reasons.push("ACTIVATION_BARRIER_KNOWN");
    let catalystModifier = 1;
    const statuses: ScientificStatus[] = [barrierData.activationEnergy_J_per_mol.status];
    const confidences: Confidence[] = [barrierData.activationEnergy_J_per_mol.confidence];
    if (environment.catalyst) {
      const reduction = environment.catalyst.barrierReduction_J_per_mol ?? 0;
      if (!Number.isFinite(reduction) || reduction < 0) throw new RangeError("catalyst barrier reduction must be finite and >= 0.");
      activationEnergy = Math.max(0, activationEnergy - reduction);
      catalystModifier = environment.catalyst.rateMultiplier ?? 1;
      if (!Number.isFinite(catalystModifier) || catalystModifier <= 0) throw new RangeError("catalyst rate multiplier must be finite and > 0.");
      reasons.push("CATALYST_APPLIED");
      statuses.push(environment.catalyst.status);
      confidences.push(environment.catalyst.confidence);
    }
    const temperatureContribution = Math.exp(-activationEnergy / (GAS_CONSTANT_J_PER_MOL_K * environment.temperatureK));
    const activityContribution = environment.activityScale ?? 1;
    if (!Number.isFinite(activityContribution) || activityContribution < 0) throw new RangeError("activityScale must be finite and >= 0.");
    const relativeRate = temperatureContribution * phaseFactor * catalystModifier * activityContribution;
    return {
      kinetics: {
        supportClass: "RELATIVE_RATE",
        activationEnergy_J_per_mol: activationEnergy,
        rateClass: classifyRate(relativeRate),
        relativeRate,
        confidence: worstConfidence(confidences),
        approximationClass: worstStatus(statuses),
        dependencies: { temperature: true, activityOrConcentration: true, pressure: false, catalyst: true, phase: true },
      },
      catalystModifier,
      temperatureContribution,
    };
  }

  if (qualitative) {
    reasons.push("QUALITATIVE_RATE_DATA", "ACTIVATION_BARRIER_UNKNOWN");
    return {
      kinetics: {
        supportClass: "QUALITATIVE_ONLY",
        rateClass: qualitative.rateClass,
        confidence: qualitative.confidence,
        approximationClass: qualitative.status,
        dependencies: normalizedDependencies(qualitative.dependencies),
      },
      catalystModifier: 1,
      temperatureContribution: 1,
    };
  }

  reasons.push("ACTIVATION_BARRIER_UNKNOWN", "OPEN_PROPAGATED");
  return {
    kinetics: {
      supportClass: "OPEN",
      rateClass: "UNKNOWN",
      confidence: "UNASSESSED",
      approximationClass: "OPEN",
      dependencies: NO_DEPENDENCIES,
    },
    catalystModifier: 1,
    temperatureContribution: 1,
  };
}

function determineFeasibility(thermo: ThermodynamicEvaluationResult, kinetics: KineticEvaluationResult): Feasibility {
  if (thermo.direction === "REVERSE_FAVORED" && thermo.approximationClass !== "OPEN") return "INFEASIBLE";
  const accessible =
    (kinetics.supportClass === "DIMENSIONED_RATE" && (kinetics.extentRateMolPerS ?? 0) > 0) ||
    (kinetics.supportClass === "RELATIVE_RATE" && (kinetics.relativeRate ?? 0) > 0 && kinetics.rateClass !== "NEGLIGIBLE") ||
    (kinetics.supportClass === "QUALITATIVE_ONLY" && kinetics.rateClass !== "UNKNOWN" && kinetics.rateClass !== "NEGLIGIBLE");
  if (thermo.direction === "FORWARD_FAVORED" && accessible) return "FEASIBLE";
  return "UNCERTAIN";
}

function computeRankScore(thermo: ThermodynamicEvaluationResult, kinetics: KineticEvaluationResult, phaseFactor: number): number | null {
  if (thermo.approximationClass === "OPEN" || kinetics.approximationClass === "OPEN" || kinetics.relativeRate === undefined) return null;
  const thermodynamicScore = thermo.deltaG_J_per_mol === undefined ? 0.5 : 1 / (1 + Math.exp(thermo.deltaG_J_per_mol / 10_000));
  return thermodynamicScore * Math.min(1, Math.max(0, kinetics.relativeRate)) * phaseFactor;
}

export function evaluateReactionCandidate<TCandidate>(
  candidate: TCandidate,
  adapter: ReactionCandidateAdapter<TCandidate>,
  environment: ReactionEnvironment,
  provider: ReactionEvaluationDataProvider,
): ReactionEvaluation {
  assertFinitePositive(environment.temperatureK, "temperatureK");
  if (environment.pressurePa !== undefined) assertFinitePositive(environment.pressurePa, "pressurePa");

  const view = adapter.toEvaluationView(candidate);
  const reasons: ReasonCode[] = [];
  const thermo = evaluateThermodynamics(view, environment, provider, reasons);
  const phaseAccessibility = evaluatePhaseAccessibility(view);
  if (phaseAccessibility.status === "OPEN") reasons.push("PHASE_ACCESSIBILITY_UNKNOWN");
  else if (phaseAccessibility.factor < 1) reasons.push("PHASE_ACCESSIBILITY_LIMITED");

  const kineticResult = evaluateKinetics(view, environment, provider, phaseAccessibility.factor, reasons);
  const environmentResult: EnvironmentEvaluationResult = {
    temperatureContribution: kineticResult.temperatureContribution,
    pressureRelevance: pressureRelevance(view),
    activityContribution: environment.activityScale ?? 1,
    catalystModifier: kineticResult.catalystModifier,
    phaseAccessibility,
  };

  if (thermo.direction === "FORWARD_FAVORED") reasons.push("THERMODYNAMICALLY_FAVORABLE");
  else if (thermo.direction === "REVERSE_FAVORED") reasons.push("THERMODYNAMICALLY_UNFAVORABLE");
  else reasons.push("THERMODYNAMIC_DIRECTION_UNKNOWN");

  const status = worstStatus([view.scientificStatus, thermo.approximationClass, kineticResult.kinetics.approximationClass, phaseAccessibility.status]);
  const pairKey = view.reversible?.pairKey;
  const detailedBalanceSupported = pairKey ? provider.supportsDetailedBalance?.(pairKey, environment) === true : false;

  return {
    candidateId: view.candidateId,
    thermo,
    kinetics: kineticResult.kinetics,
    environment: environmentResult,
    reversibility: {
      ...(pairKey ? { pairKey } : {}),
      direction: view.reversible?.direction ?? "UNSPECIFIED",
      detailedBalanceSupported,
    },
    feasible: determineFeasibility(thermo, kineticResult.kinetics),
    rankScore: computeRankScore(thermo, kineticResult.kinetics, phaseAccessibility.factor),
    status,
    reasonCodes: [...new Set(reasons)],
  };
}
