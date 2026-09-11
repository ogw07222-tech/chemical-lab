import {
  minimumChemistryDataProvider,
  type ChemistryDataProvider,
  type Confidence,
} from "../data";
import type { SpeciesState, ScientificStatus } from "../simulation/molecular";
import type { CandidateAtomRef, ReactionCandidate } from "../simulation/reaction";
import type {
  EvaluatedQuantity,
  ReactionEvaluationDataProvider,
} from "../simulation/reaction-evaluation";

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

function worstStatus(values: readonly ScientificStatus[]): ScientificStatus {
  return values.reduce(
    (worst, value) => STATUS_ORDER[value] > STATUS_ORDER[worst] ? value : worst,
    "VERIFIED",
  );
}

function worstConfidence(values: readonly Confidence[]): Confidence {
  return values.reduce(
    (worst, value) => CONFIDENCE_ORDER[value] > CONFIDENCE_ORDER[worst] ? value : worst,
    "HIGH",
  );
}

function atomElement(
  speciesById: ReadonlyMap<string, SpeciesState>,
  ref: CandidateAtomRef,
): string | undefined {
  return speciesById
    .get(ref.speciesId)
    ?.molecule.graph.atoms.find((atom) => atom.id === ref.atomId)
    ?.element;
}

function sameUnorderedPair(
  a: string,
  b: string,
  recordA: string,
  recordB: string,
): boolean {
  return (a === recordA && b === recordB) || (a === recordB && b === recordA);
}

/**
 * Conservative 03 -> 02 bond-reference bridge.
 *
 * A bond-energy approximation is emitted only when the whole candidate is a
 * cleavage-only transformation and every removed bond resolves uniquely to a
 * provenance-backed record for the exact reactant species, bond order, and
 * atom-element pair. Formed bonds, order changes, ambiguous records, and
 * unknown product identities stay OPEN rather than using a partial sum.
 */
export function createReactionCandidateBondEnergyProvider(
  candidates: readonly ReactionCandidate[],
  species: readonly SpeciesState[],
  chemistry: ChemistryDataProvider = minimumChemistryDataProvider,
): Pick<ReactionEvaluationDataProvider, "getBondEnergyApproximation"> {
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate] as const));
  const speciesById = new Map(species.map((entry) => [entry.id, entry] as const));

  return {
    getBondEnergyApproximation(view): EvaluatedQuantity | undefined {
      const candidate = candidateById.get(view.candidateId);
      if (!candidate || candidate.bondChanges.length === 0) return undefined;
      if (candidate.bondChanges.some((change) => change.kind !== "REMOVE")) return undefined;

      let value = 0;
      const statuses: ScientificStatus[] = [];
      const confidences: Confidence[] = [];
      const sourceIds = new Set<string>();

      for (const change of candidate.bondChanges) {
        if (change.a.speciesId !== change.b.speciesId || change.beforeOrder === undefined) return undefined;

        const elementA = atomElement(speciesById, change.a);
        const elementB = atomElement(speciesById, change.b);
        if (!elementA || !elementB) return undefined;

        const matches = chemistry.findBondEnergies({
          speciesId: change.a.speciesId,
          bondOrder: change.beforeOrder,
        }).filter((record) =>
          record.normalizedUnit === "J/mol" &&
          typeof record.normalizedValue === "number" &&
          Number.isFinite(record.normalizedValue) &&
          sameUnorderedPair(elementA, elementB, record.atomOrFragmentA, record.atomOrFragmentB),
        );

        if (matches.length !== 1) return undefined;
        const record = matches[0]!;
        value += record.normalizedValue as number;
        statuses.push(record.status);
        confidences.push(record.confidence);
        record.sourceMeasurements.forEach((measurement) => sourceIds.add(measurement.sourceId));
      }

      return {
        value,
        status: worstStatus(statuses),
        confidence: worstConfidence(confidences),
        source: {
          sourceIds: [...sourceIds].sort(),
          modelId: "exact-reactant-cleavage-bond-reference-sum",
          note: "Complete cleavage-only sum from exact reactant-species bond references; partial or formed-bond estimates are not emitted.",
        },
      };
    },
  };
}
