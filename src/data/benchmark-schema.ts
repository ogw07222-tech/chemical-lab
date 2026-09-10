import type {
  Confidence,
  DataQuality,
  Phase,
  ScientificStatus,
  SourceMeasurement,
  Uncertainty,
} from "./schema";

export type BenchmarkTier = "A" | "B" | "C" | "D";

export type BenchmarkFamily =
  | "PHASE_POINT"
  | "PHASE_BOUNDARY"
  | "GAS_STATE"
  | "REACTION_DIRECTION"
  | "PRODUCT_IDENTITY"
  | "CALORIMETRY"
  | "EQUILIBRIUM"
  | "KINETICS"
  | "NON_REACTION";

export interface BenchmarkSpeciesInput {
  speciesId: string;
  amountMol?: number;
  concentrationMolPerM3?: number;
  phase?: Phase;
  role?: "REACTANT" | "SOLVENT" | "CATALYST" | "INERT" | "OTHER";
}

export interface ApparatusBoundaryAssumptions {
  vesselType?: string;
  sealed?: boolean;
  rigidVolume?: boolean;
  adiabatic?: boolean;
  heatLossModel?: string;
  headspaceVolumeM3?: number;
  mixing?: string;
  gasExchange?: string;
  pressureControl?: string;
  temperatureControl?: string;
  additionalAssumptions?: readonly string[];
}

export interface MeasuredSpeciesOutput {
  speciesId: string;
  amountMol?: number;
  concentrationMolPerM3?: number;
  moleFraction?: number;
  massFraction?: number;
  phase?: Phase;
  uncertainty?: Uncertainty;
}

export interface BenchmarkMeasurementSet {
  reactionOccurred?: boolean;
  dominantProductSpeciesIds?: readonly string[];
  products?: readonly MeasuredSpeciesOutput[];
  conversionFraction?: number;
  yieldFraction?: number;
  equilibriumComposition?: readonly MeasuredSpeciesOutput[];
  finalTemperatureK?: number;
  temperatureChangeK?: number;
  finalPressurePa?: number;
  pressureChangePa?: number;
  heatEffectJ?: number;
  reactionEnthalpyJPerMol?: number;
  characteristicTimescaleS?: number;
  timeSeriesRef?: string;
  uncertainty?: Uncertainty;
  notes?: string;
}

export interface ReferenceExperimentBenchmark {
  schemaVersion: string;
  benchmarkId: string;
  family: BenchmarkFamily;
  tier: BenchmarkTier;
  title: string;
  sourceIds: readonly string[];
  sourceMeasurements?: readonly SourceMeasurement[];
  reactants: readonly BenchmarkSpeciesInput[];
  initialTemperatureK?: number;
  initialPressurePa?: number;
  vesselVolumeM3?: number;
  solventSpeciesId?: string;
  catalystSpeciesIds?: readonly string[];
  apparatus?: ApparatusBoundaryAssumptions;
  measurementDurationS?: number;
  endpointDefinition?: string;
  measurements: BenchmarkMeasurementSet;
  uncertainty?: Uncertainty;
  dataQuality: DataQuality;
  confidence: Confidence;
  scientificStatus: ScientificStatus;
  applicabilityNotes?: readonly string[];
  exclusionReason?: string;
  lastVerifiedDate: string;
}

export interface BenchmarkManifestEntry {
  benchmarkId: string;
  file: string;
  family: BenchmarkFamily;
  tier: BenchmarkTier;
  enabled: boolean;
  tags?: readonly string[];
}

export interface BenchmarkManifest {
  schemaVersion: string;
  benchmarkSetId: string;
  entries: readonly BenchmarkManifestEntry[];
}
