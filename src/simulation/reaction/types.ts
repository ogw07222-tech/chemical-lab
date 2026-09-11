import type {
  AtomId,
  BondKind,
  ConservationDelta,
  ElementProvider,
  MolecularGraph,
  MoleculeRecord,
  SpeciesId,
  SpeciesState,
} from "../molecular";

export type ReactionFamily =
  | "ASSOCIATION"
  | "DISSOCIATION"
  | "BOND_FORMATION"
  | "BOND_CLEAVAGE"
  | "PROTON_TRANSFER"
  | "ELECTRON_TRANSFER"
  | "SUBSTITUTION_GENERIC"
  | "COMBINATION"
  | "DECOMPOSITION";

export type ReactiveSiteKind =
  | "FORMAL_POSITIVE"
  | "FORMAL_NEGATIVE"
  | "HETERO_ATOM"
  | "UNDER_COORDINATED"
  | "ELECTRON_RICH"
  | "ELECTRON_POOR"
  | "PROTON_DONOR"
  | "PROTON_ACCEPTOR"
  | "POLARIZED_BOND_POSITIVE_END"
  | "POLARIZED_BOND_NEGATIVE_END"
  | "BREAKABLE_BOND";

export interface ReactiveSite {
  speciesId: SpeciesId;
  atomId: AtomId;
  kind: ReactiveSiteKind;
  priority: number;
  confidence: number;
  evidence: readonly string[];
  bondId?: string;
}

export interface CandidateAtomRef {
  speciesId: SpeciesId;
  atomId: AtomId;
}

export interface CandidateAtomMapEntry {
  reactant: CandidateAtomRef;
  productIndex: number;
  productAtomId: AtomId;
}

export interface CandidateBondChange {
  kind: "ADD" | "REMOVE" | "ORDER_CHANGE";
  a: CandidateAtomRef;
  b: CandidateAtomRef;
  beforeOrder?: number;
  afterOrder?: number;
  bondKind: BondKind;
}

export interface CandidateChargeChange {
  atom: CandidateAtomRef;
  before: number;
  after: number;
}

export interface ElectronTransferMetadata {
  electronCount: number;
  source: CandidateAtomRef;
  target: CandidateAtomRef;
  externalReservoir: false;
}

export interface ProtonTransferMetadata {
  donorAtom: CandidateAtomRef;
  protonAtom: CandidateAtomRef;
  acceptorAtom: CandidateAtomRef;
}

export interface ReactionStoichiometricTerm {
  speciesId: SpeciesId;
  coefficient: number;
}

export interface ProductStoichiometricTerm {
  productIndex: number;
  coefficient: number;
}

export interface CandidateConservationResult {
  valid: boolean;
  delta: ConservationDelta;
  reasons: readonly string[];
}

export interface ReactionCandidateDebugMetadata {
  structuralKey: string;
  rulePriority: number;
  siteKeys: readonly string[];
}

export interface ReactionCandidate {
  id: string;
  family: ReactionFamily;
  reactantRefs: readonly ReactionStoichiometricTerm[];
  productGraphs: readonly MoleculeRecord[];
  atomMapping: readonly CandidateAtomMapEntry[];
  bondChanges: readonly CandidateBondChange[];
  chargeChanges: readonly CandidateChargeChange[];
  electronTransfer?: ElectronTransferMetadata;
  protonTransfer?: ProtonTransferMetadata;
  stoichiometry: {
    reactants: readonly ReactionStoichiometricTerm[];
    products: readonly ProductStoichiometricTerm[];
  };
  structuralConfidence: number;
  assumptions: readonly string[];
  ruleId: string;
  conservation: CandidateConservationResult;
  debug: ReactionCandidateDebugMetadata;
}

export interface ReactionGenerationEnvironment {
  contactPairs?: readonly (readonly [SpeciesId, SpeciesId])[];
}

export interface ReactionCandidateOptions {
  maxSitesPerSpecies?: number;
  maxCandidatesPerFamily?: number;
  maxTotalCandidates?: number;
  electronegativityDifferenceThreshold?: number;
}

export type CandidatePruningReason =
  | "INVALID_PRODUCT"
  | "CONSERVATION"
  | "NO_OP"
  | "DUPLICATE"
  | "INACCESSIBLE"
  | "FAMILY_CAP"
  | "TOTAL_CAP";

export interface CandidatePruningSample {
  reason: CandidatePruningReason;
  ruleId?: string;
  siteKeys?: readonly string[];
}

export interface CandidatePruningDiagnostics {
  generatedBeforeValidation: number;
  rejectedInvalidProduct: number;
  rejectedConservation: number;
  rejectedNoOp: number;
  rejectedDuplicate: number;
  rejectedInaccessible: number;
  rejectedByFamilyCap: number;
  rejectedByTotalCap: number;
  sampledReasons: readonly CandidatePruningSample[];
}

export interface ReactionCandidateGenerationResult {
  candidates: readonly ReactionCandidate[];
  diagnostics: CandidatePruningDiagnostics;
}

export interface ReactionCandidateGenerationInput {
  species: readonly SpeciesState[];
  elements: ElementProvider;
  environment?: ReactionGenerationEnvironment;
  options?: ReactionCandidateOptions;
}

export interface GraphTransformResult {
  graph: MolecularGraph;
}
