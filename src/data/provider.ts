import type { ElementDefinition, ElementProvider } from "../simulation/molecular/types";
import type {
  BondEnergyRecord,
  CanonicalSIUnit,
  ChemistryDataBundle,
  ElementData,
  MolecularThermodynamicData,
  Phase,
  PhaseEquilibriumData,
  PropertyValue,
  SourceMeasurement,
} from "./schema";
import {
  minimumBondEnergies,
  minimumChemistryDataBundle,
  minimumElementRecords,
  minimumPhaseEquilibrium,
  minimumThermodynamics,
  type MinimumElementRecord,
} from "./minimum-pack";

export interface ChemistryDataProvider {
  getElementData(symbol: string): ElementData | undefined;
  getElementDefinition(symbol: string): ElementDefinition | undefined;
  getSpeciesThermodynamics(speciesId: string, phase?: Phase): MolecularThermodynamicData | undefined;
  getPhaseEquilibrium(speciesId: string): PhaseEquilibriumData | undefined;
  getBondEnergyById(id: string): (BondEnergyRecord & { id: string }) | undefined;
  findBondEnergies(query: {
    speciesId?: string;
    bondType?: string;
    bondOrder?: string | number;
  }): readonly (BondEnergyRecord & { id: string })[];
}

export interface DataValidationIssue {
  code:
    | "DUPLICATE_SOURCE_ID"
    | "DUPLICATE_ELEMENT_ID"
    | "DUPLICATE_THERMO_ID"
    | "DUPLICATE_PHASE_ID"
    | "DUPLICATE_BOND_ID"
    | "UNKNOWN_SOURCE_ID"
    | "NON_FINITE_NUMBER"
    | "NON_CANONICAL_UNIT"
    | "MISSING_NORMALIZED_UNIT"
    | "MISSING_SOURCE_MEASUREMENT"
    | "MISSING_SOURCE_UNIT"
    | "INVALID_INTERVAL"
    | "INVALID_TEMPERATURE"
    | "INVALID_PRESSURE";
  path: string;
  message: string;
}

export interface DataValidationResult {
  valid: boolean;
  issues: readonly DataValidationIssue[];
}

type NormalizedRecordView = {
  normalizedValue: PropertyValue | null;
  normalizedUnit: CanonicalSIUnit | null;
};

const CANONICAL_SI_UNITS: ReadonlySet<string> = new Set<CanonicalSIUnit>([
  "1",
  "kg",
  "kg/mol",
  "m",
  "s",
  "K",
  "Pa",
  "m^3",
  "mol",
  "mol/m^3",
  "J",
  "J/mol",
  "J/K",
  "J/(mol*K)",
  "W",
  "V",
  "A",
  "C",
]);

function getScalarNumber(record: NormalizedRecordView | undefined): number | undefined {
  return typeof record?.normalizedValue === "number" && Number.isFinite(record.normalizedValue)
    ? record.normalizedValue
    : undefined;
}

function getNumberArray(record: NormalizedRecordView | undefined): readonly number[] | undefined {
  const value = record?.normalizedValue;
  return Array.isArray(value) && value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    ? value
    : undefined;
}

function projectElement(record: MinimumElementRecord): ElementDefinition | undefined {
  const atomicNumber = getScalarNumber(record.element.atomicNumber);
  const molarMass = getScalarNumber(record.element.molarMass);
  const valenceElectrons = getScalarNumber(record.element.valenceElectrons);
  const commonOxidationStates = getNumberArray(record.element.commonOxidationStates);
  const typicalValences = getNumberArray(record.commonValences);
  const electronegativity = getScalarNumber(record.element.electronegativity);

  if (
    atomicNumber === undefined ||
    molarMass === undefined ||
    valenceElectrons === undefined ||
    commonOxidationStates === undefined ||
    typicalValences === undefined
  ) {
    return undefined;
  }

  return {
    atomicNumber,
    symbol: record.element.symbol,
    atomicMolarMassKgPerMol: molarMass,
    valenceElectrons,
    commonOxidationStates,
    typicalValences,
    electronegativity,
    metadata: {
      dataPack: minimumChemistryDataBundle.schemaVersion,
      scientificStatus: record.element.molarMass?.status ?? "OPEN",
      sourceIds: record.element.molarMass?.sourceMeasurements.map((measurement) => measurement.sourceId) ?? [],
    },
  };
}

const elementRecordMap = new Map(minimumElementRecords.map((record) => [record.element.symbol, record] as const));
const elementDataMap = new Map(minimumElementRecords.map((record) => [record.element.symbol, record.element] as const));
const elementDefinitionMap = new Map(
  minimumElementRecords.flatMap((record) => {
    const projected = projectElement(record);
    return projected ? [[record.element.symbol, projected] as const] : [];
  }),
);
const phaseMap = new Map(minimumPhaseEquilibrium.map((record) => [record.speciesId, record] as const));
const bondMap = new Map(minimumBondEnergies.map((record) => [record.id, record] as const));

/** Exact 01 ElementProvider projection. Provenance-rich records stay in the 03 data layer. */
export const minimumElementProvider: ElementProvider = {
  getElement: (symbol) => elementDefinitionMap.get(symbol),
};

/** Read-only deterministic lookup surface for 01/02 consumers. Missing values return undefined. */
export const minimumChemistryDataProvider: ChemistryDataProvider = {
  getElementData: (symbol) => elementDataMap.get(symbol),
  getElementDefinition: (symbol) => elementDefinitionMap.get(symbol),
  getSpeciesThermodynamics: (speciesId, phase) =>
    minimumThermodynamics.find(
      (record) => record.speciesId === speciesId && (phase === undefined || record.phase === phase),
    ),
  getPhaseEquilibrium: (speciesId) => phaseMap.get(speciesId),
  getBondEnergyById: (id) => bondMap.get(id),
  findBondEnergies: ({ speciesId, bondType, bondOrder }) =>
    minimumBondEnergies.filter(
      (record) =>
        (speciesId === undefined || record.speciesId === speciesId) &&
        (bondType === undefined || record.bondType === bondType) &&
        (bondOrder === undefined || record.bondOrder === bondOrder),
    ),
};

function addDuplicateIssues<T>(
  values: readonly T[],
  key: (value: T) => string,
  code: DataValidationIssue["code"],
  path: string,
  issues: DataValidationIssue[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    const id = key(value);
    if (seen.has(id)) {
      issues.push({ code, path: `${path}.${id}`, message: `Duplicate identifier: ${id}` });
    }
    seen.add(id);
  }
}

function validateFiniteValue(value: unknown, path: string, issues: DataValidationIssue[]): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      issues.push({ code: "NON_FINITE_NUMBER", path, message: "Authoritative numeric values must be finite." });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateFiniteValue(entry, `${path}[${index}]`, issues));
    return;
  }
  if (value !== null && typeof value === "object") {
    const maybeInterval = value as { min?: unknown; max?: unknown };
    if (typeof maybeInterval.min === "number" && typeof maybeInterval.max === "number") {
      validateFiniteValue(maybeInterval.min, `${path}.min`, issues);
      validateFiniteValue(maybeInterval.max, `${path}.max`, issues);
      if (maybeInterval.min > maybeInterval.max) {
        issues.push({ code: "INVALID_INTERVAL", path, message: "Interval min must not exceed max." });
      }
    }
  }
}

function validateSourceMeasurement(
  measurement: SourceMeasurement,
  path: string,
  sourceIds: ReadonlySet<string>,
  issues: DataValidationIssue[],
): void {
  if (!sourceIds.has(measurement.sourceId)) {
    issues.push({ code: "UNKNOWN_SOURCE_ID", path, message: `Unknown sourceId: ${measurement.sourceId}` });
  }
  if (measurement.sourceUnit.trim().length === 0) {
    issues.push({ code: "MISSING_SOURCE_UNIT", path, message: "Source measurements require the source-reported unit/convention." });
  }
  validateFiniteValue(measurement.sourceValue, `${path}.sourceValue`, issues);
  if (measurement.sourceConditions?.temperatureK !== undefined && measurement.sourceConditions.temperatureK <= 0) {
    issues.push({ code: "INVALID_TEMPERATURE", path, message: "Reference temperature must be > 0 K." });
  }
  if (measurement.sourceConditions?.pressurePa !== undefined && measurement.sourceConditions.pressurePa < 0) {
    issues.push({ code: "INVALID_PRESSURE", path, message: "Reference pressure must be >= 0 Pa." });
  }
}

function validatePropertyRecord(
  record: {
    normalizedValue: PropertyValue | null;
    normalizedUnit: CanonicalSIUnit | null;
    sourceMeasurements: readonly SourceMeasurement[];
    referenceConditions?: { temperatureK?: number; pressurePa?: number };
  },
  path: string,
  sourceIds: ReadonlySet<string>,
  issues: DataValidationIssue[],
): void {
  if (record.normalizedValue !== null && record.normalizedUnit === null) {
    issues.push({ code: "MISSING_NORMALIZED_UNIT", path, message: "Populated normalized values require a normalized SI unit." });
  }
  if (record.normalizedUnit !== null && !CANONICAL_SI_UNITS.has(record.normalizedUnit)) {
    issues.push({ code: "NON_CANONICAL_UNIT", path, message: `Unsupported normalized unit: ${record.normalizedUnit}` });
  }
  if (record.normalizedValue !== null && record.sourceMeasurements.length === 0) {
    issues.push({ code: "MISSING_SOURCE_MEASUREMENT", path, message: "Populated values require at least one provenance measurement or derivation source." });
  }
  if (record.referenceConditions?.temperatureK !== undefined && record.referenceConditions.temperatureK <= 0) {
    issues.push({ code: "INVALID_TEMPERATURE", path, message: "Reference temperature must be > 0 K." });
  }
  if (record.referenceConditions?.pressurePa !== undefined && record.referenceConditions.pressurePa < 0) {
    issues.push({ code: "INVALID_PRESSURE", path, message: "Reference pressure must be >= 0 Pa." });
  }
  validateFiniteValue(record.normalizedValue, `${path}.normalizedValue`, issues);
  record.sourceMeasurements.forEach((measurement, index) =>
    validateSourceMeasurement(measurement, `${path}.sourceMeasurements[${index}]`, sourceIds, issues),
  );
}

function walkPropertyRecords(value: unknown, path: string, sourceIds: ReadonlySet<string>, issues: DataValidationIssue[]): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walkPropertyRecords(entry, `${path}[${index}]`, sourceIds, issues));
    return;
  }
  const candidate = value as Record<string, unknown>;
  if (
    "normalizedValue" in candidate &&
    "normalizedUnit" in candidate &&
    Array.isArray(candidate.sourceMeasurements)
  ) {
    validatePropertyRecord(candidate as Parameters<typeof validatePropertyRecord>[0], path, sourceIds, issues);
    return;
  }
  for (const [key, child] of Object.entries(candidate)) {
    walkPropertyRecords(child, `${path}.${key}`, sourceIds, issues);
  }
}

export function validateChemistryDataBundle(bundle: ChemistryDataBundle): DataValidationResult {
  const issues: DataValidationIssue[] = [];
  addDuplicateIssues(bundle.sources, (source) => source.id, "DUPLICATE_SOURCE_ID", "sources", issues);
  addDuplicateIssues(bundle.elements, (element) => element.symbol, "DUPLICATE_ELEMENT_ID", "elements", issues);
  addDuplicateIssues(
    bundle.thermodynamics,
    (record) => `${record.speciesId}:${record.phase}`,
    "DUPLICATE_THERMO_ID",
    "thermodynamics",
    issues,
  );
  addDuplicateIssues(bundle.phaseEquilibrium, (record) => record.speciesId, "DUPLICATE_PHASE_ID", "phaseEquilibrium", issues);
  addDuplicateIssues(
    bundle.bonds as readonly (BondEnergyRecord & { id?: string })[],
    (record) => record.id ?? `${record.speciesId ?? "*"}:${record.bondType}:${String(record.bondOrder)}`,
    "DUPLICATE_BOND_ID",
    "bonds",
    issues,
  );

  const sourceIds = new Set(bundle.sources.map((source) => source.id));
  walkPropertyRecords(bundle, "bundle", sourceIds, issues);
  return { valid: issues.length === 0, issues };
}

export function validateMinimumChemistryDataPack(): DataValidationResult {
  return validateChemistryDataBundle(minimumChemistryDataBundle);
}

export function getMinimumElementRecord(symbol: string): MinimumElementRecord | undefined {
  return elementRecordMap.get(symbol);
}
