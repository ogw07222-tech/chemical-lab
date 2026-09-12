import {
  conservationDelta,
  conservationVectorFromMolecule,
  validateSpeciesState,
  type ConservationVector,
  type ScientificStatus,
  type SpeciesId,
  type SpeciesState,
} from "../molecular";
import type { ReactionCandidate } from "../reaction";
import { kineticExtentInputOverDt, type RankedReactionEvaluation } from "../reaction-evaluation";
import type {
  DeferredReaction,
  ReactionProgressEvent,
  ReactionResolutionInput,
  ReactionResolutionReasonCode,
  ReactionResolutionResult,
  ResolvedReaction,
  SpeciesAmountDelta,
} from "./types";

const DEFAULT_MAX_FRACTION = 0.25;
const DEFAULT_TIMESCALE_S = 1;
const DEFAULT_AMOUNT_TOLERANCE_MOL = 1e-12;
const DEFAULT_CONSERVATION_TOLERANCE = 1e-10;

const STATUS_ORDER: Record<ScientificStatus, number> = {
  VERIFIED: 0,
  APPROXIMATED: 1,
  EMPIRICAL: 2,
  GAMEPLAY_SIMPLIFICATION: 3,
  OPEN: 4,
};

function worstStatus(...statuses: ScientificStatus[]): ScientificStatus {
  return statuses.reduce((worst, status) => STATUS_ORDER[status] > STATUS_ORDER[worst] ? status : worst, "VERIFIED");
}

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and > 0.`);
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and >= 0.`);
}

function combineVectors(vectors: readonly ConservationVector[]): ConservationVector {
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

function stateConservation(species: readonly SpeciesState[]): ConservationVector {
  return combineVectors(species.map((state) => conservationVectorFromMolecule(state.molecule, state.amountMol)));
}

function assertConserved(before: readonly SpeciesState[], after: readonly SpeciesState[], tolerance: number): void {
  const delta = conservationDelta(stateConservation(before), stateConservation(after));
  const badElement = Object.entries(delta.elementDelta).find(([, value]) => Math.abs(value) > tolerance);
  if (badElement || Math.abs(delta.atomCountDelta) > tolerance || Math.abs(delta.netChargeDelta) > tolerance ||
    (delta.explicitElectronDelta !== undefined && Math.abs(delta.explicitElectronDelta) > tolerance)) {
    throw new Error(`REACTION_STATE_CONSERVATION_FAILURE:${JSON.stringify(delta)}`);
  }
}

function clearDerivedConcentration(state: SpeciesState, amountMol: number): SpeciesState {
  const next: SpeciesState = { ...state, amountMol };
  delete (next as { concentrationMolPerM3?: number }).concentrationMolPerM3;
  return next;
}

function maxExtent(candidate: ReactionCandidate, amounts: ReadonlyMap<SpeciesId, number>, tolerance: number): {
  maxExtentMol: number;
  limitingReactantIds: SpeciesId[];
} {
  let maxExtentMol = Number.POSITIVE_INFINITY;
  for (const term of candidate.stoichiometry.reactants) {
    if (!Number.isFinite(term.coefficient) || term.coefficient <= 0) throw new Error(`INVALID_STOICHIOMETRY:${candidate.id}`);
    const available = amounts.get(term.speciesId);
    if (available === undefined) return { maxExtentMol: 0, limitingReactantIds: [term.speciesId] };
    maxExtentMol = Math.min(maxExtentMol, available / term.coefficient);
  }
  if (!Number.isFinite(maxExtentMol)) return { maxExtentMol: 0, limitingReactantIds: [] };
  const limitingReactantIds = candidate.stoichiometry.reactants
    .filter((term) => Math.abs((amounts.get(term.speciesId) ?? 0) / term.coefficient - maxExtentMol) <= tolerance)
    .map((term) => term.speciesId)
    .sort();
  return { maxExtentMol: Math.max(0, maxExtentMol), limitingReactantIds };
}

function resolveProducts(candidate: ReactionCandidate, input: ReactionResolutionInput): Map<number, SpeciesId> | undefined {
  const current = new Map(input.species.map((state) => [state.id, state] as const));
  const resolved = new Map<number, SpeciesId>();
  for (const term of candidate.stoichiometry.products) {
    const product = candidate.productGraphs[term.productIndex];
    if (!product) return undefined;
    const resolution = input.productStateResolver.resolveProductState(candidate, term.productIndex, product, input.species);
    if (!resolution) return undefined;
    const target = current.get(resolution.speciesId);
    if (!target || target.molecule.canonicalKey !== product.canonicalKey) return undefined;
    resolved.set(term.productIndex, resolution.speciesId);
  }
  return resolved;
}

interface Proposal {
  candidate: ReactionCandidate;
  evaluation: RankedReactionEvaluation;
  requestedExtentMol: number;
  maxAvailableExtentMol: number;
  limitingReactantIds: SpeciesId[];
  products: Map<number, SpeciesId>;
  reasons: ReactionResolutionReasonCode[];
}

export function resolveReactionCandidates(input: ReactionResolutionInput): ReactionResolutionResult {
  assertFinitePositive(input.dtS, "dtS");
  assertFiniteNonNegative(input.startTimeS, "startTimeS");
  assertFinitePositive(input.temperatureK, "temperatureK");
  if (input.pressurePa !== undefined) assertFinitePositive(input.pressurePa, "pressurePa");
  if (input.volumeM3 !== undefined) assertFinitePositive(input.volumeM3, "volumeM3");
  if (!input.timestepId) throw new Error("timestepId must be non-empty.");

  const maxFraction = input.options?.maxFractionalConsumptionPerStep ?? DEFAULT_MAX_FRACTION;
  const timescaleS = input.options?.coarseRateTimescaleS ?? DEFAULT_TIMESCALE_S;
  const amountTolerance = input.options?.amountToleranceMol ?? DEFAULT_AMOUNT_TOLERANCE_MOL;
  const conservationTolerance = input.options?.conservationTolerance ?? DEFAULT_CONSERVATION_TOLERANCE;
  if (!Number.isFinite(maxFraction) || maxFraction <= 0 || maxFraction > 1) throw new RangeError("maxFractionalConsumptionPerStep must be in (0, 1].");
  assertFinitePositive(timescaleS, "coarseRateTimescaleS");
  assertFiniteNonNegative(amountTolerance, "amountToleranceMol");
  assertFiniteNonNegative(conservationTolerance, "conservationTolerance");

  const speciesIds = new Set<string>();
  for (const state of input.species) {
    if (speciesIds.has(state.id)) throw new Error(`DUPLICATE_SPECIES_ID:${state.id}`);
    speciesIds.add(state.id);
    const validation = validateSpeciesState(state, input.elements);
    if (!validation.valid) throw new Error(`INVALID_SPECIES_STATE:${state.id}:${validation.issues.map((issue) => issue.code).join(",")}`);
  }

  const candidates = new Map(input.candidates.map((candidate) => [candidate.id, candidate] as const));
  if (candidates.size !== input.candidates.length) throw new Error("DUPLICATE_CANDIDATE_ID");
  const evaluations = [...input.rankedEvaluations].sort((a, b) => {
    const ar = a.rank ?? Number.POSITIVE_INFINITY;
    const br = b.rank ?? Number.POSITIVE_INFINITY;
    return ar - br || a.candidateId.localeCompare(b.candidateId);
  });

  const initialPositiveReactants = new Set(input.species.filter((state) => state.amountMol > amountTolerance).map((state) => state.id));
  const amounts = new Map(input.species.map((state) => [state.id, state.amountMol] as const));
  const selected: ResolvedReaction[] = [];
  const deferred: DeferredReaction[] = [];
  const events: ReactionProgressEvent[] = [];
  let sharedReactantScaled = 0;
  let unresolvedProducts = 0;

  const groups = new Map<number, RankedReactionEvaluation[]>();
  for (const evaluation of evaluations) {
    if (evaluation.rank === null) {
      deferred.push({ candidateId: evaluation.candidateId, evaluation, reasonCodes: ["UNRANKED_DEFERRED"] });
      continue;
    }
    const group = groups.get(evaluation.rank) ?? [];
    group.push(evaluation);
    groups.set(evaluation.rank, group);
  }

  for (const rank of [...groups.keys()].sort((a, b) => a - b)) {
    const proposals: Proposal[] = [];
    for (const evaluation of groups.get(rank)!.sort((a, b) => a.candidateId.localeCompare(b.candidateId))) {
      const candidate = candidates.get(evaluation.candidateId);
      if (!candidate) {
        deferred.push({ candidateId: evaluation.candidateId, evaluation, reasonCodes: ["UNRANKED_DEFERRED"] });
        continue;
      }
      if (evaluation.feasible === "INFEASIBLE") {
        deferred.push({ candidateId: candidate.id, evaluation, reasonCodes: ["INFEASIBLE"] });
        continue;
      }
      if (evaluation.feasible === "UNCERTAIN" && !input.options?.allowUncertainEvaluations) {
        deferred.push({ candidateId: candidate.id, evaluation, reasonCodes: ["UNCERTAIN_DEFERRED"] });
        continue;
      }
      if (candidate.stoichiometry.reactants.some((term) => !initialPositiveReactants.has(term.speciesId))) {
        deferred.push({ candidateId: candidate.id, evaluation, reasonCodes: ["ZERO_INITIAL_REACTANT"] });
        continue;
      }

      const products = resolveProducts(candidate, input);
      if (!products) {
        unresolvedProducts += 1;
        deferred.push({ candidateId: candidate.id, evaluation, reasonCodes: ["UNRESOLVED_PRODUCT_IDENTITY"] });
        continue;
      }
      const extentBound = maxExtent(candidate, amounts, amountTolerance);
      if (extentBound.maxExtentMol <= amountTolerance) {
        deferred.push({ candidateId: candidate.id, evaluation, reasonCodes: ["ZERO_EXTENT"] });
        continue;
      }

      const kineticInput = kineticExtentInputOverDt(evaluation.kinetics, input.dtS, {
        coarseRateTimescaleS: timescaleS,
        maxRelativeProgressFraction: maxFraction,
      });
      let requestedExtentMol: number | undefined;
      const reasons: ReactionResolutionReasonCode[] = [];

      if (kineticInput.requestedExtentMol !== undefined) {
        const perStepCap = extentBound.maxExtentMol * maxFraction;
        requestedExtentMol = Math.min(kineticInput.requestedExtentMol, perStepCap);
        reasons.push("DIMENSIONED_RATE_EXTENT");
        if (requestedExtentMol + Number.EPSILON < kineticInput.requestedExtentMol) reasons.push("MAX_FRACTION_BOUNDED");
      } else if (kineticInput.relativeProgressFraction !== undefined) {
        requestedExtentMol = extentBound.maxExtentMol * kineticInput.relativeProgressFraction;
        reasons.push("COARSE_RELATIVE_RATE_EXTENT");
      } else {
        deferred.push({ candidateId: candidate.id, evaluation, reasonCodes: ["MISSING_KINETIC_SIGNAL"] });
        continue;
      }

      if (!Number.isFinite(requestedExtentMol) || requestedExtentMol <= amountTolerance || evaluation.kinetics.rateClass === "NEGLIGIBLE") {
        deferred.push({ candidateId: candidate.id, evaluation, reasonCodes: ["NEGLIGIBLE_KINETICS", "ZERO_EXTENT"] });
        continue;
      }
      proposals.push({ candidate, evaluation, requestedExtentMol, maxAvailableExtentMol: extentBound.maxExtentMol, limitingReactantIds: extentBound.limitingReactantIds, products, reasons });
    }

    const demand = new Map<SpeciesId, number>();
    for (const proposal of proposals) {
      for (const term of proposal.candidate.stoichiometry.reactants) {
        demand.set(term.speciesId, (demand.get(term.speciesId) ?? 0) + term.coefficient * proposal.requestedExtentMol);
      }
    }
    const speciesScale = new Map<SpeciesId, number>();
    for (const [speciesId, totalDemand] of demand) {
      const available = amounts.get(speciesId) ?? 0;
      speciesScale.set(speciesId, totalDemand <= 0 ? 1 : Math.min(1, available / totalDemand));
    }

    const groupDeltas = new Map<SpeciesId, number>();
    for (const proposal of proposals) {
      const scale = proposal.candidate.stoichiometry.reactants.reduce((value, term) => Math.min(value, speciesScale.get(term.speciesId) ?? 0), 1);
      const appliedExtentMol = proposal.requestedExtentMol * scale;
      if (appliedExtentMol <= amountTolerance) {
        deferred.push({ candidateId: proposal.candidate.id, evaluation: proposal.evaluation, reasonCodes: ["ZERO_EXTENT"] });
        continue;
      }
      const reasons = [...proposal.reasons, "SELECTED"] as ReactionResolutionReasonCode[];
      if (scale < 1 - Number.EPSILON) {
        reasons.push("SHARED_REACTANT_SCALED");
        sharedReactantScaled += 1;
      }
      const perReaction = new Map<SpeciesId, number>();
      const reactantDeltas: Record<SpeciesId, number> = {};
      const productDeltas: Record<SpeciesId, number> = {};
      for (const term of proposal.candidate.stoichiometry.reactants) {
        const delta = -term.coefficient * appliedExtentMol;
        perReaction.set(term.speciesId, (perReaction.get(term.speciesId) ?? 0) + delta);
        reactantDeltas[term.speciesId] = (reactantDeltas[term.speciesId] ?? 0) + delta;
      }
      for (const term of proposal.candidate.stoichiometry.products) {
        const target = proposal.products.get(term.productIndex)!;
        const delta = term.coefficient * appliedExtentMol;
        perReaction.set(target, (perReaction.get(target) ?? 0) + delta);
        productDeltas[target] = (productDeltas[target] ?? 0) + delta;
      }
      for (const [speciesId, delta] of perReaction) groupDeltas.set(speciesId, (groupDeltas.get(speciesId) ?? 0) + delta);
      const speciesAmountDeltas: SpeciesAmountDelta[] = [...perReaction.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([speciesId, deltaMol]) => ({ speciesId, deltaMol }));
      const scientificStatus = worstStatus(proposal.evaluation.status, "APPROXIMATED");
      const resolved: ResolvedReaction = {
        candidateId: proposal.candidate.id,
        rank,
        requestedExtentMol: proposal.requestedExtentMol,
        maxAvailableExtentMol: proposal.maxAvailableExtentMol,
        appliedExtentMol,
        limitingReactantIds: proposal.limitingReactantIds,
        evaluation: proposal.evaluation,
        scientificStatus,
        reasonCodes: reasons,
        speciesAmountDeltas,
      };
      selected.push(resolved);
      const sequence = events.length;
      events.push({
        id: `${input.timestepId}:reaction:${String(sequence).padStart(4, "0")}:${proposal.candidate.id}`,
        timestepId: input.timestepId,
        candidateId: proposal.candidate.id,
        sequence,
        startTimeS: input.startTimeS,
        endTimeS: input.startTimeS + input.dtS,
        dtS: input.dtS,
        extentMol: appliedExtentMol,
        reactantDeltasMol: Object.fromEntries(Object.entries(reactantDeltas).sort(([a], [b]) => a.localeCompare(b))),
        productDeltasMol: Object.fromEntries(Object.entries(productDeltas).sort(([a], [b]) => a.localeCompare(b))),
        speciesAmountDeltaMol: Object.fromEntries([...perReaction.entries()].sort(([a], [b]) => a.localeCompare(b))),
        deltaH_JPerMolExtent: proposal.evaluation.thermo.deltaH_J_per_mol,
        scientificStatus,
        reasonCodes: reasons,
      });
    }

    for (const [speciesId, delta] of groupDeltas) {
      const next = (amounts.get(speciesId) ?? 0) + delta;
      if (!Number.isFinite(next)) throw new Error(`NONFINITE_SPECIES_AMOUNT:${speciesId}`);
      if (next < -amountTolerance) throw new Error(`NEGATIVE_SPECIES_AMOUNT:${speciesId}:${next}`);
      amounts.set(speciesId, next < 0 ? 0 : next);
    }
  }

  const speciesAfter = input.species.map((state) => clearDerivedConcentration(state, amounts.get(state.id) ?? state.amountMol));
  assertConserved(input.species, speciesAfter, conservationTolerance);
  const netSpeciesAmountDeltaMol = Object.fromEntries(
    input.species
      .map((state) => [state.id, (amounts.get(state.id) ?? state.amountMol) - state.amountMol] as const)
      .filter(([, delta]) => delta !== 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

  return {
    speciesBefore: input.species,
    speciesAfter,
    selected,
    deferred,
    progressEvents: events,
    netSpeciesAmountDeltaMol,
    diagnostics: {
      considered: input.rankedEvaluations.length,
      selected: selected.length,
      deferred: deferred.length,
      rankGroups: groups.size,
      sharedReactantScaled,
      unresolvedProducts,
    },
  };
}
