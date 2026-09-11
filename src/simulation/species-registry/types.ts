import type {
  ElementProvider,
  MolecularGraph,
  MoleculeRecord,
  ScientificStatus,
  SpeciesId,
  SpeciesState,
} from "../molecular";
import type { ReactionFamily } from "../reaction";

export type SpeciesRegistryOrigin = "KNOWN" | "GENERATED";
export type StructuralValidationState = "STRUCTURALLY_VALID";
export type ReferenceMatchStatus = "KNOWN_SEED" | "OPEN";

export interface GeneratedSpeciesProvenance {
  sourceReactionCandidateId: string;
  parentReactantSpeciesIds: readonly SpeciesId[];
  transformationFamily: ReactionFamily;
  creationTimestepId: string;
  productIndex: number;
  canonicalizationVersion: "mol-v1";
}

export interface DynamicSpeciesRecord {
  speciesId: SpeciesId;
  canonicalKey: string;
  canonicalRepresentation: string;
  molecule: MoleculeRecord;
  origin: SpeciesRegistryOrigin;
  validationState: StructuralValidationState;
  /** Real-world compound matching remains a 03 enrichment responsibility. */
  referenceMatchStatus: ReferenceMatchStatus;
  /** GENERATED records default to OPEN; structural validity is tracked separately. */
  scientificStatus: ScientificStatus;
  provenance: readonly GeneratedSpeciesProvenance[];
}

export interface KnownSpeciesSeed {
  speciesId: SpeciesId;
  molecule: MoleculeRecord;
  scientificStatus?: ScientificStatus;
}

export interface ResolveOrRegisterInput {
  graph?: MolecularGraph;
  molecule?: MoleculeRecord;
  provenance?: GeneratedSpeciesProvenance;
}

export type SpeciesResolution =
  | {
      status: "KNOWN" | "GENERATED";
      speciesId: SpeciesId;
      record: DynamicSpeciesRecord;
      registry: DynamicSpeciesRegistryLike;
    }
  | {
      status: "INVALID";
      reason: string;
      registry: DynamicSpeciesRegistryLike;
    };

export interface SerializedDynamicSpeciesRecord {
  speciesId: SpeciesId;
  canonicalKey: string;
  canonicalRepresentation: string;
  molecule: MoleculeRecord;
  origin: SpeciesRegistryOrigin;
  validationState: StructuralValidationState;
  referenceMatchStatus: ReferenceMatchStatus;
  scientificStatus: ScientificStatus;
  provenance: readonly GeneratedSpeciesProvenance[];
}

export interface SerializedDynamicSpeciesRegistry {
  schemaVersion: 1;
  canonicalizationVersion: "mol-v1";
  records: readonly SerializedDynamicSpeciesRecord[];
}

export interface DynamicSpeciesRegistryLike {
  readonly size: number;
  lookupByCanonicalKey(canonicalKey: string): DynamicSpeciesRecord | undefined;
  lookupBySpeciesId(speciesId: SpeciesId): DynamicSpeciesRecord | undefined;
  resolveOrRegister(input: ResolveOrRegisterInput): SpeciesResolution;
  serialize(): SerializedDynamicSpeciesRegistry;
}

export interface DynamicSpeciesRegistryOptions {
  elements: ElementProvider;
  knownSpecies?: readonly KnownSpeciesSeed[];
}

export interface RegistryBackedReactionResolutionResult<TResolution> {
  resolution: TResolution;
  registry: DynamicSpeciesRegistryLike;
  generatedSpeciesIds: readonly SpeciesId[];
  reusedSpeciesIds: readonly SpeciesId[];
}

export interface DynamicSpeciesStateFactoryInput {
  record: DynamicSpeciesRecord;
  currentSpecies: readonly SpeciesState[];
}
