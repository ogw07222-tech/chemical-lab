import {
  minimumChemistryDataProvider,
  minimumElementProvider,
  type ChemistryDataProvider,
  type MolecularThermodynamicData,
  type PropertyRecord,
} from "../data";
import {
  conservationVectorFromMolecule,
  validateGraph,
  type ConservationVector,
  type ElementProvider,
  type MoleculeRecord,
  type PhaseKind,
  type ScientificStatus,
  type SpeciesState,
} from "../simulation/molecular";
import {
  detectReactiveSites,
  generateReactionCandidatesWithDiagnostics,
  validateCoarseValenceGraph,
  type ReactionCandidate,
  type ReactionCandidateGenerationInput,
} from "../simulation/reaction";
import {
  evaluateReactionCandidate,
  rankReactionEvaluations,
  type EvaluatedQuantity,
  type ReactionCandidateAdapter,
  type ReactionCandidateEvaluationView,
  type ReactionEnvironment,
  type ReactionEvaluation,
  type ReactionEvaluationDataProvider,
  type SpeciesThermoData,
} from "../simulation/reaction-evaluation";
import type {
  CandidatePerformanceCounters,
  KineticSnapshot,
  ProductGraphSanity,
  ReactionCandidateValidationView,
  ReactionConservationSnapshot,
  ThermodynamicSnapshot,
} from "../validation";

export interface ResolvedReactionSpecies {
  speciesKey: string;
  phase: PhaseKind;
  scientificStatus: ScientificStatus;
}

export interface ReactionProductIdentityResolver {
  resolveProduct(candidate: ReactionCandidate, productIndex: number, product: MoleculeRecord): ResolvedReactionSpecies | undefined;
}

export interface Phase2ReactionDataBridge {
  elements: ElementProvider;
  chemistry: ChemistryDataProvider;
  evaluation: ReactionEvaluationDataProvider;
}

export interface Phase2ReactionPipelineConfig {
  environment: ReactionEnvironment;
  productIdentityResolver?: ReactionProductIdentityResolver;
  dataBridge?: Phase2ReactionDataBridge;
}

export interface Phase2ReactionPipelineResult {
  candidates: readonly ReactionCandidate[];
  evaluations: readonly ReactionEvaluation[];
  ranked: ReturnType<typeof rankReactionEvaluations>;
  validationCandidates: readonly ReactionCandidateValidationView[];
  performance: CandidatePerformanceCounters;
}

const SCIENTIFIC_STATUS_ORDER: Record<ScientificStatus, number> = {
  VERIFIED: 0,
  APPROXIMATED: 1,
  EMPIRICAL: 2,
  GAMEPLAY_SIMPLIFICATION: 3,
  OPEN: 4,
};

function worstScientificStatus(statuses: readonly ScientificStatus[]): ScientificStatus {
  return statuses.reduce(
    (worst, current) => SCIENTIFIC_STATUS_ORDER[current] > SCIENTIFIC_STATUS_ORDER[worst] ? current : worst,
    "VERIFIED",
  );
}

function toEvaluatedQuantity(
  record: PropertyRecord<number> | undefined,
  expectedUnit: string,
): EvaluatedQuantity | undefined {
  if (!record || typeof record.normalizedValue !== "number" || !Number.isFinite(record.normalizedValue)) return undefined;
  if (record.normalizedUnit !== expectedUnit) return undefined;
  return {
    value: record.normalizedValue,
    status: record.status,
    confidence: record.confidence,
    source: {
      sourceIds: record.sourceMeasurements.map((measurement) => measurement.sourceId).sort(),
      note: record.notes,
    },
  };
}

function projectSpeciesThermo(record: MolecularThermodynamicData | undefined): SpeciesThermoData | undefined {
  if (!record) return undefined;
  const enthalpyOfFormation_J_per_mol = toEvaluatedQuantity(record.standardEnthalpyOfFormation, "J/mol");
  const standardMolarEntropy_J_per_mol_K = toEvaluatedQuantity(record.standardMolarEntropy, "J/(mol*K)");
  const gibbsEnergyOfFormation_J_per_mol = toEvaluatedQuantity(record.standardGibbsEnergyOfFormation, "J/mol");
  if (!enthalpyOfFormation_J_per_mol && !standardMolarEntropy_J_per_mol_K && !gibbsEnergyOfFormation_J_per_mol) {
    return undefined;
  }
  return {
    enthalpyOfFormation_J_per_mol,
    standardMolarEntropy_J_per_mol_K,
    gibbsEnergyOfFormation_J_per_mol,
  };
}

export function createPhase2ReactionDataBridge(
  chemistry: ChemistryDataProvider = minimumChemistryDataProvider,
  elements: ElementProvider = minimumElementProvider,
): Phase2ReactionDataBridge {
  return {
    chemistry,
    elements,
    evaluation: {
      getSpeciesThermo: (speciesKey, phase) => projectSpeciesThermo(chemistry.getSpeciesThermodynamics(speciesKey, phase)),
    },
  };
}

export function createReactionCandidateEvaluationAdapter(
  species: readonly SpeciesState[],
  productIdentityResolver?: ReactionProductIdentityResolver,
): ReactionCandidateAdapter<ReactionCandidate> {
  const reactants = new Map(species.map((entry) => [entry.id, entry] as const));
  return {
    toEvaluationView(candidate): ReactionCandidateEvaluationView {
      const reactantTerms = candidate.stoichiometry.reactants.map((term) => {
        const state = reactants.get(term.speciesId);
        return {
          speciesKey: term.speciesId,
          coefficient: term.coefficient,
          phase: state?.phaseState.phase ?? "unknown",
        };
      });

      const resolvedProducts = candidate.stoichiometry.products.map((term) => {
        const product = candidate.productGraphs[term.productIndex];
        const resolved = product ? productIdentityResolver?.resolveProduct(candidate, term.productIndex, product) : undefined;
        return {
          speciesKey: resolved?.speciesKey ?? product?.canonicalKey ?? `unknown-product-${term.productIndex}`,
          coefficient: term.coefficient,
          phase: resolved?.phase ?? "unknown",
          scientificStatus: resolved?.scientificStatus ?? "OPEN" as const,
        };
      });

      const statuses: ScientificStatus[] = [
        ...candidate.stoichiometry.reactants.map((term) => reactants.get(term.speciesId)?.phaseState.scientificStatus ?? "OPEN"),
        ...resolvedProducts.map((term) => term.scientificStatus),
      ];

      return {
        candidateId: candidate.id,
        family: candidate.family,
        reactants: reactantTerms,
        products: resolvedProducts.map(({ speciesKey, coefficient, phase }) => ({ speciesKey, coefficient, phase })),
        accessMode: "STRUCTURAL_CANDIDATE",
        scientificStatus: worstScientificStatus(statuses),
        bondChangeKey: candidate.bondChanges
          .map((change) => `${change.kind}:${change.a.speciesId}:${change.a.atomId}:${change.b.speciesId}:${change.b.atomId}:${change.beforeOrder ?? ""}:${change.afterOrder ?? ""}`)
          .sort()
          .join("|"),
      };
    },
  };
}

function combineConservation(vectors: readonly ConservationVector[]): ConservationVector {
  const elements: Record<string, number> = {};
  let atomCount = 0;
  let netCharge = 0;
  let explicitElectronCount: number | undefined;
  for (const vector of vectors) {
    for (const [symbol, count] of Object.entries(vector.elements)) elements[symbol] = (elements[symbol] ?? 0) + count;
    atomCount += vector.atomCount;
    netCharge += vector.netCharge;
    if (vector.explicitElectronCount !== undefined) explicitElectronCount = (explicitElectronCount ?? 0) + vector.explicitElectronCount;
  }
  return {
    elements: Object.fromEntries(Object.entries(elements).sort(([a], [b]) => a.localeCompare(b))),
    atomCount,
    netCharge,
    ...(explicitElectronCount === undefined ? {} : { explicitElectronCount }),
  };
}

function conservationSnapshot(candidate: ReactionCandidate, species: ReadonlyMap<string, SpeciesState>): ReactionConservationSnapshot {
  const reactants = candidate.stoichiometry.reactants.flatMap((term) => {
    const state = species.get(term.speciesId);
    return state ? [conservationVectorFromMolecule(state.molecule, term.coefficient)] : [];
  });
  const products = candidate.stoichiometry.products.flatMap((term) => {
    const product = candidate.productGraphs[term.productIndex];
    return product ? [conservationVectorFromMolecule(product, term.coefficient)] : [];
  });
  const before = combineConservation(reactants);
  const after = combineConservation(products);
  return {
    reactantElements: before.elements,
    productElements: after.elements,
    reactantAtomCount: before.atomCount,
    productAtomCount: after.atomCount,
    reactantCharge: before.netCharge,
    productCharge: after.netCharge,
    ...(before.explicitElectronCount === undefined ? {} : { reactantExplicitElectrons: before.explicitElectronCount }),
    ...(after.explicitElectronCount === undefined ? {} : { productExplicitElectrons: after.explicitElectronCount }),
  };
}

function structureSnapshot(candidate: ReactionCandidate, elements: ElementProvider): ProductGraphSanity {
  const validationIssues = candidate.productGraphs.flatMap((product) => validateGraph(product.graph, elements).issues);
  const overValence = candidate.productGraphs.some((product) => validateCoarseValenceGraph(product.graph, elements).length > 0);
  const mappedReactants = candidate.atomMapping.map((entry) => `${entry.reactant.speciesId}\u0000${entry.reactant.atomId}`);
  const duplicateAtomMapping = new Set(mappedReactants).size !== mappedReactants.length;
  const finiteNumericState = Number.isFinite(candidate.structuralConfidence)
    && candidate.stoichiometry.reactants.every((term) => Number.isFinite(term.coefficient) && term.coefficient > 0)
    && candidate.stoichiometry.products.every((term) => Number.isFinite(term.coefficient) && term.coefficient > 0);
  return {
    overValence,
    invalidBond: validationIssues.some((issue) => issue.code.includes("BOND")),
    danglingAtom: validationIssues.some((issue) => issue.code === "INVALID_BOND_ENDPOINT"),
    malformedGraph: validationIssues.length > 0,
    duplicateAtomMapping,
    finiteNumericState,
  };
}

function thermoSnapshot(evaluation: ReactionEvaluation): ThermodynamicSnapshot {
  const direction = evaluation.thermo.direction === "FORWARD_FAVORED"
    ? "FORWARD"
    : evaluation.thermo.direction === "REVERSE_FAVORED"
      ? "REVERSE"
      : evaluation.thermo.direction === "NEAR_EQUILIBRIUM"
        ? "NEAR_EQUILIBRIUM"
        : "UNKNOWN";
  const feasibility = evaluation.feasible === "FEASIBLE"
    ? "FAVORABLE"
    : evaluation.feasible === "INFEASIBLE"
      ? "UNFAVORABLE"
      : "UNKNOWN";
  return {
    deltaH_JPerMol: evaluation.thermo.deltaH_J_per_mol,
    deltaG_JPerMol: evaluation.thermo.deltaG_J_per_mol,
    direction,
    feasibility,
    scientificStatus: evaluation.thermo.approximationClass,
    dataAvailable: evaluation.thermo.approximationClass !== "OPEN"
      && (evaluation.thermo.deltaH_J_per_mol !== undefined || evaluation.thermo.deltaG_J_per_mol !== undefined),
  };
}

function kineticSnapshot(evaluation: ReactionEvaluation): KineticSnapshot {
  return {
    activationEnergy_JPerMol: evaluation.kinetics.activationEnergy_J_per_mol,
    effectiveRate: evaluation.kinetics.relativeRate,
    feasible: evaluation.feasible === "FEASIBLE" ? true : evaluation.feasible === "INFEASIBLE" ? false : undefined,
    equilibriumChangedByCatalyst: false,
    scientificStatus: evaluation.kinetics.approximationClass,
    barrierKnown: evaluation.kinetics.activationEnergy_J_per_mol !== undefined,
  };
}

export function toReactionValidationView(
  candidate: ReactionCandidate,
  evaluation: ReactionEvaluation,
  species: readonly SpeciesState[],
  elements: ElementProvider,
): ReactionCandidateValidationView {
  const speciesById = new Map(species.map((entry) => [entry.id, entry] as const));
  return {
    id: candidate.id,
    canonicalKey: candidate.debug.structuralKey,
    conservation: conservationSnapshot(candidate, speciesById),
    structure: structureSnapshot(candidate, elements),
    thermo: thermoSnapshot(evaluation),
    kinetics: kineticSnapshot(evaluation),
  };
}

export function runPhase2ReactionFoundation(
  input: ReactionCandidateGenerationInput,
  config: Phase2ReactionPipelineConfig,
): Phase2ReactionPipelineResult {
  const bridge = config.dataBridge ?? createPhase2ReactionDataBridge(undefined, input.elements);
  const adapter = createReactionCandidateEvaluationAdapter(input.species, config.productIdentityResolver);
  const started = performance.now();
  const generation = generateReactionCandidatesWithDiagnostics(input);
  const evaluations = generation.candidates.map((candidate) =>
    evaluateReactionCandidate(candidate, adapter, config.environment, bridge.evaluation),
  );
  const runtimeMs = performance.now() - started;
  const ranked = rankReactionEvaluations(evaluations);
  const validationCandidates = generation.candidates.map((candidate, index) =>
    toReactionValidationView(candidate, evaluations[index]!, input.species, bridge.elements),
  );
  const reactiveSites = input.species.reduce(
    (count, entry) => count + detectReactiveSites(entry, input.elements, input.options).length,
    0,
  );
  const speciesCount = input.species.length;
  const rawCandidates = generation.diagnostics.generatedBeforeValidation;
  const deduplicatedCandidates = Math.max(0, rawCandidates - generation.diagnostics.rejectedDuplicate);
  return {
    candidates: generation.candidates,
    evaluations,
    ranked,
    validationCandidates,
    performance: {
      reactiveSites,
      eligiblePairs: speciesCount < 2 ? 0 : (speciesCount * (speciesCount - 1)) / 2,
      rawCandidates,
      deduplicatedCandidates,
      prunedCandidates: generation.candidates.length,
      runtimeMs,
    },
  };
}
