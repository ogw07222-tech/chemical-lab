export type ScientificStatus =
  | "VERIFIED"
  | "APPROXIMATED"
  | "EMPIRICAL"
  | "GAMEPLAY_SIMPLIFICATION"
  | "OPEN";

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "UNASSESSED";

export type DataQuality =
  | "CRITICALLY_EVALUATED"
  | "EVALUATED"
  | "PRIMARY_MEASUREMENT"
  | "COMPILED"
  | "SECONDARY"
  | "ESTIMATED"
  | "UNKNOWN";

export type SourceType =
  | "REFERENCE_DATABASE"
  | "STANDARD_OR_GOVERNMENT"
  | "PEER_REVIEWED"
  | "HANDBOOK_OR_INSTITUTION"
  | "SECONDARY_REFERENCE"
  | "INTERNAL_DERIVATION";

export type Phase =
  | "gas"
  | "liquid"
  | "solid"
  | "aqueous"
  | "plasma"
  | "supercritical"
  | "multiphase"
  | "unknown";

/** Authoritative machine-consumed units. Non-SI source units belong in SourceMeasurement. */
export type CanonicalSIUnit =
  | "1"
  | "kg"
  | "kg/mol"
  | "m"
  | "s"
  | "K"
  | "Pa"
  | "m^3"
  | "mol"
  | "mol/m^3"
  | "J"
  | "J/mol"
  | "J/K"
  | "J/(mol*K)"
  | "W"
  | "V"
  | "A"
  | "C";

export interface NumericInterval {
  min: number;
  max: number;
}

export type PropertyValue = number | NumericInterval | string | readonly number[];

export type Uncertainty =
  | { kind: "absolute"; plusMinus: number }
  | { kind: "relative"; fraction: number }
  | { kind: "interval"; min: number; max: number }
  | { kind: "not_reported" }
  | { kind: "not_applicable" };

export interface ReferenceConditions {
  temperatureK?: number;
  pressurePa?: number;
  phase?: Phase;
  solventId?: string;
  concentrationOrActivityConvention?: string;
  standardState?: string;
  polymorphOrAllotrope?: string;
  electronicOrSpinState?: string;
  ionicCharge?: number;
  qualifier?: string;
}

export interface SourceRecord {
  id: string;
  title: string;
  publisherOrAuthors: string;
  sourceType: SourceType;
  citation: string;
  url?: string;
  doi?: string;
  databaseName?: string;
  databaseVersion?: string;
  accessedDate: string;
  retrievedOrTableContext?: string;
  licenseOrUsageNotes?: string;
}

/** Exact representation reported by the source before normalization. */
export interface SourceMeasurement<T extends PropertyValue = PropertyValue> {
  sourceId: string;
  sourceValue: T;
  sourceUnit: string;
  sourceUncertainty?: Uncertainty;
  sourceConditions?: ReferenceConditions;
  conversionMethod?: string;
  conversionVersion?: string;
}

export interface PropertyRecord<
  T extends PropertyValue = PropertyValue,
  U extends CanonicalSIUnit = CanonicalSIUnit,
> {
  normalizedValue: T | null;
  normalizedUnit: U | null;
  sourceMeasurements: readonly SourceMeasurement<T>[];
  referenceConditions?: ReferenceConditions;
  uncertainty?: Uncertainty;
  dataQuality: DataQuality;
  confidence: Confidence;
  status: ScientificStatus;
  lastVerifiedDate: string | null;
  notes?: string;
  resolutionNote?: string;
}

export interface ElementData {
  symbol: string;
  atomicNumber: PropertyRecord<number, "1">;
  /** Per-particle mass in kg when an atomic-mass value is required. */
  atomicMass?: PropertyRecord<number | NumericInterval, "kg">;
  /** IUPAC/CIAAW relative standard atomic weight; dimensionless by definition. */
  standardAtomicWeight?: PropertyRecord<number | NumericInterval, "1">;
  molarMass?: PropertyRecord<number | NumericInterval, "kg/mol">;
  electronegativity?: PropertyRecord<number, "1"> & { scale: string };
  valenceElectrons: PropertyRecord<number, "1">;
  commonOxidationStates: PropertyRecord<readonly number[], "1">;
  covalentRadius?: PropertyRecord<number, "m"> & { convention: string };
  ionicRadii?: readonly IonicRadiusRecord[];
  firstIonizationEnergy?: PropertyRecord<number, "J">;
  electronAffinity?: PropertyRecord<number, "J">;
}

export interface IonicRadiusRecord extends PropertyRecord<number, "m"> {
  ionCharge: number;
  coordinationNumber?: number;
  spinState?: string;
  radiusConvention: string;
}

export type BondOrder = 1 | 2 | 3 | "aromatic" | "partial" | string;

export interface BondEnergyRecord extends PropertyRecord<number, "J/mol"> {
  bondType: string;
  bondOrder: BondOrder;
  energyKind: "MOLECULE_SPECIFIC_BDE" | "AVERAGE_BOND_ENTHALPY" | "OTHER";
  speciesId?: string;
  atomOrFragmentA: string;
  atomOrFragmentB: string;
  dissociationProducts?: readonly string[];
}

export interface CorrelationRecord {
  modelId: string;
  equation: string;
  coefficients: Readonly<Record<string, number>>;
  coefficientUnits?: Readonly<Record<string, string>>;
  validTemperatureRangeK?: NumericInterval;
  validPressureRangePa?: NumericInterval;
  sourceIds: readonly string[];
  uncertainty?: Uncertainty;
  dataQuality: DataQuality;
  status: ScientificStatus;
  confidence: Confidence;
  notes?: string;
}

export interface MolecularThermodynamicData {
  speciesId: string;
  phase: Phase;
  standardEnthalpyOfFormation?: PropertyRecord<number, "J/mol">;
  standardMolarEntropy?: PropertyRecord<number, "J/(mol*K)">;
  standardGibbsEnergyOfFormation?: PropertyRecord<number, "J/mol">;
  molarHeatCapacity?: PropertyRecord<number, "J/(mol*K)">;
  heatCapacityCorrelation?: CorrelationRecord;
  enthalpyOfFusion?: PropertyRecord<number, "J/mol">;
  enthalpyOfVaporization?: PropertyRecord<number, "J/mol">;
}

export interface PhasePoint {
  temperatureK: number;
  pressurePa: number;
  phase?: Phase;
  uncertainty?: Uncertainty;
}

export interface PhaseBoundarySample {
  temperatureK: number;
  pressurePa: number;
  uncertainty?: Uncertainty;
  sourceId: string;
}

export type PhaseBoundaryRepresentation =
  | {
      kind: "EXPERIMENTAL_SAMPLES";
      samples: readonly PhaseBoundarySample[];
    }
  | {
      kind: "FITTED_CORRELATION";
      correlation: CorrelationRecord;
      fittedToSourceIds: readonly string[];
    }
  | {
      kind: "TRUSTED_MODEL_REFERENCE";
      modelName: string;
      modelReferenceSourceIds: readonly string[];
      parameters?: Readonly<Record<string, number>>;
      parameterUnits?: Readonly<Record<string, string>>;
      validTemperatureRangeK?: NumericInterval;
      validPressureRangePa?: NumericInterval;
    }
  | {
      kind: "APPROXIMATION";
      method: string;
      assumptions: readonly string[];
      validTemperatureRangeK?: NumericInterval;
      validPressureRangePa?: NumericInterval;
    };

export interface PhaseBoundaryData {
  id: string;
  speciesId: string;
  fromPhase: Phase;
  toPhase: Phase;
  representation: PhaseBoundaryRepresentation;
  status: ScientificStatus;
  confidence: Confidence;
  dataQuality: DataQuality;
  uncertainty?: Uncertainty;
  notes?: string;
}

export interface CriticalPointData {
  temperature: PropertyRecord<number, "K">;
  pressure: PropertyRecord<number, "Pa">;
}

export interface TriplePointData {
  temperature: PropertyRecord<number, "K">;
  pressure: PropertyRecord<number, "Pa">;
}

export interface PhaseEquilibriumData {
  speciesId: string;
  phaseAtReferenceConditions?: PropertyRecord<string, "1">;
  meltingPoint?: PropertyRecord<number, "K">;
  boilingPoint?: PropertyRecord<number, "K">;
  triplePoint?: TriplePointData;
  criticalPoint?: CriticalPointData;
  vaporPressure?: PhaseBoundaryRepresentation;
  boundaries?: readonly PhaseBoundaryData[];
  transitionEnthalpies?: readonly PropertyRecord<number, "J/mol">[];
  validTemperatureRangeK?: NumericInterval;
  validPressureRangePa?: NumericInterval;
}

export interface AcidBaseData {
  acidSpeciesId: string;
  conjugateBaseSpeciesId?: string;
  pKa?: PropertyRecord<number, "1">;
  protonAffinity?: PropertyRecord<number, "J/mol">;
  classification?: PropertyRecord<string, "1">;
}

export interface RedoxCoupleData {
  coupleId: string;
  oxidizedSpeciesIds: readonly string[];
  reducedSpeciesIds: readonly string[];
  electronsTransferred: number;
  standardElectrodePotential?: PropertyRecord<number, "V">;
  referenceElectrode?: string;
}

export interface SolubilityData {
  speciesId: string;
  solventId: string;
  solubility?: PropertyRecord<number, "mol/m^3">;
  ksp?: PropertyRecord<number, "1">;
  dissolutionDefinition?: string;
}

export interface ChemistryDataQuery {
  speciesId?: string;
  elementSymbol?: string;
  property:
    | "THERMOCHEMISTRY"
    | "HEAT_CAPACITY"
    | "PHASE_POINT"
    | "PHASE_BOUNDARY"
    | "VAPOR_PRESSURE"
    | "LATENT_HEAT"
    | "BOND_ENERGY"
    | "ATOMIC_PROPERTY";
  temperatureK?: number;
  pressurePa?: number;
  phase?: Phase;
  requiredStatus?: readonly ScientificStatus[];
}

export interface ChemistryDataQueryResult<T> {
  found: boolean;
  record?: T;
  status: ScientificStatus;
  confidence: Confidence;
  applicability: "EXACT" | "WITHIN_VALID_RANGE" | "EXTRAPOLATED" | "INCOMPATIBLE" | "MISSING";
  notes?: string;
}

export interface ChemistryDataBundle {
  schemaVersion: string;
  sources: readonly SourceRecord[];
  elements: readonly ElementData[];
  bonds: readonly BondEnergyRecord[];
  thermodynamics: readonly MolecularThermodynamicData[];
  phaseEquilibrium: readonly PhaseEquilibriumData[];
  acidBase?: readonly AcidBaseData[];
  redox?: readonly RedoxCoupleData[];
  solubility?: readonly SolubilityData[];
}
