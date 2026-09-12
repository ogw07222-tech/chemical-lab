import type {
  PhaseKind,
  ScientificStatus,
  SpeciesId,
  SpeciesState,
} from "../molecular";

export type CompartmentId = string;
export type ApparatusId = string;
export type MatterConnectionId = string;

export type CompartmentKind =
  | "VESSEL_CONTENTS"
  | "VESSEL_HEADSPACE"
  | "LAB_ATMOSPHERE"
  | "GAS_COLLECTOR"
  | "FILTER_RETENTATE"
  | "FILTER_FILTRATE"
  | "BATH_MEDIUM"
  | "CHAMBER_ATMOSPHERE"
  | "EXHAUST_RESERVOIR"
  | "OTHER";

export interface CompartmentEnvironmentMetadata {
  phaseHint?: PhaseKind;
  scientificStatus?: ScientificStatus;
  metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Phase 4A-1 matter container. Species identity remains authoritative through
 * the existing SpeciesId/MoleculeRecord boundary; this contract does not
 * derive identity from formula/display text.
 */
export interface MatterCompartmentState {
  id: CompartmentId;
  kind: CompartmentKind;
  ownerApparatusId?: ApparatusId;
  species: readonly SpeciesState[];
  volumeM3?: number;
  environment?: CompartmentEnvironmentMetadata;
  scientificStatus?: ScientificStatus;
  metadata?: Readonly<Record<string, unknown>>;
}

export type MatterConnectionKind = "GAS" | "LIQUID";

/**
 * Topology only. Phase 4A-1 does not infer pressure-, diffusion-, pump-, or
 * valve-driven flow from this contract.
 */
export interface MatterConnectionState {
  id: MatterConnectionId;
  sourceCompartmentId: CompartmentId;
  destinationCompartmentId: CompartmentId;
  kind: MatterConnectionKind;
  enabled: boolean;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface MatterSystemState {
  compartments: readonly MatterCompartmentState[];
  connections?: readonly MatterConnectionState[];
}

export interface MatterTransferEntry {
  speciesId: SpeciesId;
  amountMol: number;
}

export interface MatterTransferRequest {
  sourceCompartmentId: CompartmentId;
  destinationCompartmentId: CompartmentId;
  species: readonly MatterTransferEntry[];
  connectionId?: MatterConnectionId;
}

export interface MatterTransferOptions {
  /** Reuses the established reaction-progression default amount tolerance. */
  amountToleranceMol?: number;
}

export type MatterTransferFailureReason =
  | "SOURCE_NOT_FOUND"
  | "DESTINATION_NOT_FOUND"
  | "INVALID_AMOUNT"
  | "INSUFFICIENT_AMOUNT"
  | "UNKNOWN_SPECIES"
  | "INVALID_CONNECTION"
  | "INVALID_CONNECTION_KIND"
  | "DUPLICATE_COMPARTMENT"
  | "DUPLICATE_CONNECTION"
  | "DUPLICATE_SPECIES"
  | "SPECIES_IDENTITY_CONFLICT"
  | "SAME_COMPARTMENT_TRANSFER"
  | "EMPTY_TRANSFER"
  | "NONFINITE_STATE"
  | "CONSERVATION_FAILURE";

export interface MatterTransferCommittedResult {
  status: "COMMITTED";
  state: MatterSystemState;
  transferred: readonly MatterTransferRequest[];
}

export interface MatterTransferRejectedResult {
  status: "REJECTED";
  state: MatterSystemState;
  reasonCode: MatterTransferFailureReason;
  message: string;
  requestIndex?: number;
  speciesId?: SpeciesId;
  compartmentId?: CompartmentId;
}

export type MatterTransferResult = MatterTransferCommittedResult | MatterTransferRejectedResult;

export interface SystemMatterInventory {
  speciesAmountsMol: Readonly<Record<SpeciesId, number>>;
  elementsMol: Readonly<Record<string, number>>;
  atomAmountMol: number;
  netChargeAmountMol: number;
}
