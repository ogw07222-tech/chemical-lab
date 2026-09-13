import type {
  CompartmentId,
  MatterConnectionId,
  MatterTransferRequest,
} from "../compartment";
import type { ScientificStatus, SpeciesId } from "../molecular";

export type GasPressureModel = "IDEAL_GAS" | "OPEN";
export type GasTransportContributionKind = "BULK_PRESSURE" | "SPECIES_DIFFUSION";

export type GasThermodynamicReasonCode =
  | "IDEAL_GAS_SUPPORTED"
  | "MISSING_VOLUME"
  | "INVALID_VOLUME"
  | "MISSING_TEMPERATURE"
  | "INVALID_TEMPERATURE"
  | "NONFINITE_GAS_AMOUNT";

export interface GasCompartmentThermodynamicInput {
  compartmentId: CompartmentId;
  temperatureK: number;
}

export interface GasPressureEvaluation {
  compartmentId: CompartmentId;
  model: GasPressureModel;
  scientificStatus: ScientificStatus;
  reasonCodes: readonly GasThermodynamicReasonCode[];
  volumeM3?: number;
  temperatureK?: number;
  totalGasAmountMol?: number;
  pressurePa?: number;
  partialPressuresPa: Readonly<Record<SpeciesId, number>>;
  moleFractions: Readonly<Record<SpeciesId, number>>;
}

/**
 * Caller/provider supplied transport coefficients. No realistic-looking default
 * is invented by Phase 4A-2.
 *
 * bulkMolarConductanceMolPerSPaS: mol / (s Pa), driven by total pressure.
 * diffusiveMolarConductanceMolPerSPaS: mol / (s Pa), driven per species partial pressure.
 */
export interface GasConnectionTransportModel {
  connectionId: MatterConnectionId;
  bulkMolarConductanceMolPerSPaS?: number;
  diffusiveMolarConductanceMolPerSPaS?: number;
  speciesDiffusiveMolarConductanceMolPerSPaS?: Readonly<Record<SpeciesId, number>>;
  scientificStatus: ScientificStatus;
  source?: string;
}

export interface GasTransportSolverInput {
  system: import("../compartment").MatterSystemState;
  thermodynamicInputs: readonly GasCompartmentThermodynamicInput[];
  connectionModels: readonly GasConnectionTransportModel[];
  dtS: number;
}

export type GasTransportReasonCode =
  | "SUPPORTED_IDEAL_GAS_TRANSPORT"
  | "DISABLED_CONNECTION"
  | "NON_GAS_CONNECTION"
  | "MISSING_CONNECTION_MODEL"
  | "INVALID_CONDUCTANCE"
  | "OPEN_THERMODYNAMIC_ENDPOINT"
  | "ZERO_PRESSURE_GRADIENT"
  | "ZERO_DIFFUSION_GRADIENT"
  | "NO_GAS_SOURCE"
  | "SOURCE_AVAILABILITY_NORMALIZED";

export interface GasTransportConnectionDiagnostic {
  connectionId: MatterConnectionId;
  scientificStatus: ScientificStatus;
  reasonCodes: readonly GasTransportReasonCode[];
  sourcePressurePa?: number;
  destinationPressurePa?: number;
  desiredBulkAmountMol?: number;
  boundedBulkAmountMol?: number;
}

export interface GasTransportContribution {
  kind: GasTransportContributionKind;
  connectionId: MatterConnectionId;
  sourceCompartmentId: CompartmentId;
  destinationCompartmentId: CompartmentId;
  speciesId: SpeciesId;
  amountMol: number;
  scientificStatus: ScientificStatus;
}

export interface GasTransportEvaluation {
  scientificStatus: ScientificStatus;
  bulkTransfers: readonly MatterTransferRequest[];
  diffusiveTransfers: readonly MatterTransferRequest[];
  /** Canonical combined requests intended for 01 transferMatterBatch(). */
  transferRequests: readonly MatterTransferRequest[];
  contributions: readonly GasTransportContribution[];
  diagnostics: readonly GasTransportConnectionDiagnostic[];
}
