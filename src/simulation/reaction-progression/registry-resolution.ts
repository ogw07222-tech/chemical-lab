import type { SpeciesId, SpeciesState } from "../molecular";
import type { ReactionCandidate } from "../reaction";
import {
  createDynamicSpeciesRegistry,
  type DynamicSpeciesRecord,
  type DynamicSpeciesRegistryLike,
  type GeneratedSpeciesProvenance,
} from "../species-registry";
import { resolveReactionCandidates } from "./resolver";
import type {
  ReactionProductStateResolver,
  ReactionResolutionInput,
  ReactionResolutionResult,
} from "./types";

export interface RegistryReactionResolutionInput
  extends Omit<ReactionResolutionInput, "productStateResolver"> {
  registry: DynamicSpeciesRegistryLike;
}

export interface RegistryReactionResolutionResult {
  resolution: ReactionResolutionResult;
  registry: DynamicSpeciesRegistryLike;
  generatedSpeciesIds: readonly SpeciesId[];
  reusedSpeciesIds: readonly SpeciesId[];
}

interface PendingResolution {
  speciesId: SpeciesId;
  record: DynamicSpeciesRecord;
  provenance: GeneratedSpeciesProvenance;
}

function productKey(candidateId: string, productIndex: number): string {
  return `${candidateId}\u0000${productIndex}`;
}

function provenanceFor(candidate: ReactionCandidate, productIndex: number, timestepId: string): GeneratedSpeciesProvenance {
  return {
    sourceReactionCandidateId: candidate.id,
    parentReactantSpeciesIds: candidate.stoichiometry.reactants.map((term) => term.speciesId).sort(),
    transformationFamily: candidate.family,
    creationTimestepId: timestepId,
    productIndex,
    canonicalizationVersion: "mol-v1",
  };
}

function existingStateForCanonicalKey(
  species: readonly SpeciesState[],
  canonicalKey: string,
): SpeciesState | undefined {
  return [...species]
    .filter((state) => state.molecule.canonicalKey === canonicalKey)
    .sort((a, b) => a.id.localeCompare(b.id))[0];
}

function createZeroAmountRegistryState(record: DynamicSpeciesRecord): SpeciesState {
  return {
    id: record.speciesId,
    molecule: record.molecule,
    amountMol: 0,
    phaseState: {
      phase: "unknown",
      source: "dynamic-species-registry",
      phaseStateId: `phase:unknown:${record.speciesId}`,
      scientificStatus: "OPEN",
    },
    metadata: {
      registryOrigin: record.origin,
      referenceMatchStatus: record.referenceMatchStatus,
      structuralValidationState: record.validationState,
    },
  };
}

function recomputeNetDeltas(
  before: readonly SpeciesState[],
  after: readonly SpeciesState[],
): Readonly<Record<SpeciesId, number>> {
  const beforeAmounts = new Map(before.map((state) => [state.id, state.amountMol] as const));
  return Object.fromEntries(
    after
      .map((state) => [state.id, state.amountMol - (beforeAmounts.get(state.id) ?? 0)] as const)
      .filter(([, delta]) => delta !== 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

/**
 * Transactional bridge from generated product graphs to persistent species.
 * The input registry is immutable. Candidate product registration is staged in
 * a working registry; only products belonging to actually selected reactions
 * are committed to the returned registry/state.
 */
export function resolveReactionCandidatesWithRegistry(
  input: RegistryReactionResolutionInput,
): RegistryReactionResolutionResult {
  let workingRegistry = input.registry;
  const workingSpecies: SpeciesState[] = [...input.species];
  const stateIds = new Map(workingSpecies.map((state) => [state.id, state.molecule.canonicalKey] as const));
  const pending = new Map<string, PendingResolution>();
  const invalidCandidates = new Map<string, string>();

  for (const candidate of [...input.candidates].sort((a, b) => a.id.localeCompare(b.id))) {
    const productIndices = [...new Set(candidate.stoichiometry.products.map((term) => term.productIndex))].sort((a, b) => a - b);
    for (const productIndex of productIndices) {
      const product = candidate.productGraphs[productIndex];
      if (!product) {
        invalidCandidates.set(candidate.id, `MISSING_PRODUCT_GRAPH:${productIndex}`);
        continue;
      }
      const provenance = provenanceFor(candidate, productIndex, input.timestepId);
      const resolution = workingRegistry.resolveOrRegister({ molecule: product, provenance });
      if (resolution.status === "INVALID") {
        invalidCandidates.set(candidate.id, resolution.reason);
        continue;
      }
      workingRegistry = resolution.registry;

      const existingState = existingStateForCanonicalKey(workingSpecies, resolution.record.canonicalKey);
      const speciesId = existingState?.id ?? resolution.speciesId;
      const collidingKey = stateIds.get(speciesId);
      if (collidingKey !== undefined && collidingKey !== resolution.record.canonicalKey) {
        invalidCandidates.set(candidate.id, `VESSEL_SPECIES_ID_COLLISION:${speciesId}`);
        continue;
      }
      if (!existingState) {
        workingSpecies.push(createZeroAmountRegistryState({ ...resolution.record, speciesId }));
        stateIds.set(speciesId, resolution.record.canonicalKey);
      }
      pending.set(productKey(candidate.id, productIndex), {
        speciesId,
        record: resolution.record,
        provenance,
      });
    }
  }

  const productStateResolver: ReactionProductStateResolver = {
    resolveProductState(candidate, productIndex) {
      if (invalidCandidates.has(candidate.id)) return undefined;
      const value = pending.get(productKey(candidate.id, productIndex));
      return value ? { speciesId: value.speciesId } : undefined;
    },
  };

  const raw = resolveReactionCandidates({
    ...input,
    species: workingSpecies,
    productStateResolver,
  });

  const selectedCandidateIds = new Set(raw.selected.map((reaction) => reaction.candidateId));
  const selectedProductStateIds = new Set<SpeciesId>();
  for (const event of raw.progressEvents) {
    for (const speciesId of Object.keys(event.productDeltasMol)) selectedProductStateIds.add(speciesId);
  }

  let committedRegistry = input.registry;
  const generatedSpeciesIds = new Set<SpeciesId>();
  const reusedSpeciesIds = new Set<SpeciesId>();

  for (const candidate of [...input.candidates].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!selectedCandidateIds.has(candidate.id)) continue;
    const productIndices = [...new Set(candidate.stoichiometry.products.map((term) => term.productIndex))].sort((a, b) => a - b);
    for (const productIndex of productIndices) {
      const product = candidate.productGraphs[productIndex];
      if (!product) throw new Error(`SELECTED_REACTION_MISSING_PRODUCT:${candidate.id}:${productIndex}`);
      const provenance = provenanceFor(candidate, productIndex, input.timestepId);
      const existedBefore = committedRegistry.lookupByCanonicalKey(product.canonicalKey);
      const committed = committedRegistry.resolveOrRegister({ molecule: product, provenance });
      if (committed.status === "INVALID") {
        // No externally visible state has been committed yet: fail atomically.
        throw new Error(`PRODUCT_REGISTRATION_FAILED:${candidate.id}:${productIndex}:${committed.reason}`);
      }
      committedRegistry = committed.registry;
      if (!existedBefore && committed.status === "GENERATED") generatedSpeciesIds.add(committed.speciesId);
      else reusedSpeciesIds.add(committed.speciesId);
    }
  }

  const originalIds = new Set(input.species.map((state) => state.id));
  const speciesAfter = raw.speciesAfter.filter(
    (state) => originalIds.has(state.id) || selectedProductStateIds.has(state.id),
  );

  const resolution: ReactionResolutionResult = {
    ...raw,
    speciesBefore: input.species,
    speciesAfter,
    netSpeciesAmountDeltaMol: recomputeNetDeltas(input.species, speciesAfter),
    deferred: raw.deferred.map((deferred) =>
      invalidCandidates.has(deferred.candidateId)
        ? {
            ...deferred,
            reasonCodes: ["PRODUCT_REGISTRATION_FAILED"],
          }
        : deferred,
    ),
  };

  return {
    resolution,
    registry: committedRegistry,
    generatedSpeciesIds: [...generatedSpeciesIds].sort(),
    reusedSpeciesIds: [...reusedSpeciesIds].sort(),
  };
}

/** Seed a registry from current vessel identities without asserting real-world verification. */
export function createDynamicSpeciesRegistryFromSpecies(
  elements: ReactionResolutionInput["elements"],
  species: readonly SpeciesState[],
): DynamicSpeciesRegistryLike {
  return createDynamicSpeciesRegistry({
    elements,
    knownSpecies: species.map((state) => ({
      speciesId: state.id,
      molecule: state.molecule,
    })),
  });
}
