import type {
  BondEnergyRecord,
  CanonicalSIUnit,
  ChemistryDataBundle,
  ElementData,
  MolecularThermodynamicData,
  PhaseEquilibriumData,
  PropertyRecord,
  PropertyValue,
  SourceRecord,
} from "./schema";

export const MINIMUM_DATA_PACK_VERSION = "phase2c-minimum-v1";
export const REFERENCE_TEMPERATURE_K = 298.15;
export const REFERENCE_PRESSURE_PA = 100_000;
export const LAST_VERIFIED_DATE = "2026-09-11";

const AVOGADRO_CONSTANT = 6.02214076e23;
const EV_TO_J = 1.602176634e-19;

export const minimumSources: readonly SourceRecord[] = [
  {
    id: "ciaaw-atomic-weights-2024",
    title: "Standard Atomic Weights 2024",
    publisherOrAuthors: "Commission on Isotopic Abundances and Atomic Weights (CIAAW)",
    sourceType: "STANDARD_OR_GOVERNMENT",
    citation: "CIAAW, Standard Atomic Weights 2024",
    url: "https://ciaaw.org/atomic-weights.htm",
    databaseName: "CIAAW Standard Atomic Weights",
    databaseVersion: "2024",
    accessedDate: LAST_VERIFIED_DATE,
    retrievedOrTableContext: "H, C, N, O standard atomic-weight intervals",
  },
  {
    id: "ciaaw-abridged-atomic-weights-2024",
    title: "Abridged Standard Atomic Weights 2024",
    publisherOrAuthors: "Commission on Isotopic Abundances and Atomic Weights (CIAAW)",
    sourceType: "STANDARD_OR_GOVERNMENT",
    citation: "CIAAW, Abridged Standard Atomic Weights 2024",
    url: "https://ciaaw.org/abridged-atomic-weights.htm",
    databaseName: "CIAAW Abridged Standard Atomic Weights",
    databaseVersion: "2024",
    accessedDate: LAST_VERIFIED_DATE,
    retrievedOrTableContext: "H, C, N, O abridged values used for the Phase 2C runtime mass projection",
  },
  {
    id: "nist-asd-5.12",
    title: "NIST Atomic Spectra Database",
    publisherOrAuthors: "Kramida, Ralchenko, Reader, and NIST ASD Team",
    sourceType: "REFERENCE_DATABASE",
    citation: "NIST Atomic Spectra Database, version 5.12, 2024",
    url: "https://physics.nist.gov/asd",
    doi: "10.18434/T4W30F",
    databaseName: "NIST ASD SRD 78",
    databaseVersion: "5.12",
    accessedDate: LAST_VERIFIED_DATE,
    retrievedOrTableContext: "Neutral-atom first ionization energies for H, C, N, O",
  },
  {
    id: "nist-webbook-srd69",
    title: "NIST Chemistry WebBook",
    publisherOrAuthors: "National Institute of Standards and Technology",
    sourceType: "REFERENCE_DATABASE",
    citation: "NIST Chemistry WebBook, SRD 69",
    url: "https://webbook.nist.gov/chemistry/",
    databaseName: "NIST Chemistry WebBook SRD 69",
    databaseVersion: "accessed 2026-09-11",
    accessedDate: LAST_VERIFIED_DATE,
    retrievedOrTableContext: "Thermochemistry/reference phases for H2, O2, N2, H2O, CO, CO2, CH4, NH3",
  },
  ...(["h", "c", "n", "o"] as const).map(
    (symbol): SourceRecord => ({
      id: `rsc-periodic-${symbol}`,
      title: `${symbol.toUpperCase()} element information, properties and uses`,
      publisherOrAuthors: "Royal Society of Chemistry",
      sourceType: "HANDBOOK_OR_INSTITUTION",
      citation: `Royal Society of Chemistry Periodic Table: ${symbol.toUpperCase()}`,
      url: `https://periodic-table.rsc.org/element/${{ h: 1, c: 6, n: 7, o: 8 }[symbol]}`,
      accessedDate: LAST_VERIFIED_DATE,
      retrievedOrTableContext: "Pauling electronegativity, covalent radius, electron affinity where stable, oxidation states, bond enthalpies",
    }),
  ),
  {
    id: "thermochemical-reference-state-definition",
    title: "Standard enthalpy-of-formation reference-state convention",
    publisherOrAuthors: "Phase 2C data normalization rule based on standard thermochemical convention",
    sourceType: "INTERNAL_DERIVATION",
    citation: "Standard enthalpy of formation of an element in its reference state is zero by definition",
    accessedDate: LAST_VERIFIED_DATE,
    retrievedOrTableContext: "H2(g), O2(g), N2(g) reference-state formation enthalpies",
  },
];

function property<T extends PropertyValue, U extends CanonicalSIUnit>(args: {
  normalizedValue: T;
  normalizedUnit: U;
  sourceId: string;
  sourceValue: T;
  sourceUnit: string;
  sourceUncertainty?: PropertyRecord<T, U>["uncertainty"];
  uncertainty?: PropertyRecord<T, U>["uncertainty"];
  referenceConditions?: PropertyRecord<T, U>["referenceConditions"];
  dataQuality?: PropertyRecord<T, U>["dataQuality"];
  confidence?: PropertyRecord<T, U>["confidence"];
  status?: PropertyRecord<T, U>["status"];
  notes?: string;
  resolutionNote?: string;
  conversionMethod?: string;
}): PropertyRecord<T, U> {
  return {
    normalizedValue: args.normalizedValue,
    normalizedUnit: args.normalizedUnit,
    sourceMeasurements: [{
      sourceId: args.sourceId,
      sourceValue: args.sourceValue,
      sourceUnit: args.sourceUnit,
      sourceUncertainty: args.sourceUncertainty,
      sourceConditions: args.referenceConditions,
      conversionMethod: args.conversionMethod,
      conversionVersion: MINIMUM_DATA_PACK_VERSION,
    }],
    referenceConditions: args.referenceConditions,
    uncertainty: args.uncertainty ?? args.sourceUncertainty,
    dataQuality: args.dataQuality ?? "EVALUATED",
    confidence: args.confidence ?? "HIGH",
    status: args.status ?? "VERIFIED",
    lastVerifiedDate: LAST_VERIFIED_DATE,
    notes: args.notes,
    resolutionNote: args.resolutionNote,
  };
}

export interface MinimumElementRecord {
  element: ElementData;
  commonValences: PropertyRecord<readonly number[], "1">;
}

interface ElementInput {
  symbol: string;
  atomicNumber: number;
  weightInterval: readonly [number, number];
  abridgedWeight: number;
  abridgedUncertainty: number;
  electronegativity: number;
  valenceElectrons: number;
  oxidationStates: readonly number[];
  commonValences: readonly number[];
  covalentRadiusAngstrom: number;
  rscSourceId: string;
  ionizationEv: number;
  ionizationUncertaintyEv: number;
  electronAffinityKjPerMol?: number;
}

function elementRecord(args: ElementInput): MinimumElementRecord {
  const conditions = { qualifier: "neutral atom / natural terrestrial composition where applicable" };
  const element: ElementData = {
    symbol: args.symbol,
    atomicNumber: property({
      normalizedValue: args.atomicNumber,
      normalizedUnit: "1",
      sourceId: args.rscSourceId,
      sourceValue: args.atomicNumber,
      sourceUnit: "1",
      dataQuality: "COMPILED",
    }),
    standardAtomicWeight: property({
      normalizedValue: { min: args.weightInterval[0], max: args.weightInterval[1] },
      normalizedUnit: "1",
      sourceId: "ciaaw-atomic-weights-2024",
      sourceValue: { min: args.weightInterval[0], max: args.weightInterval[1] },
      sourceUnit: "1",
      uncertainty: { kind: "interval", min: args.weightInterval[0], max: args.weightInterval[1] },
      dataQuality: "CRITICALLY_EVALUATED",
      referenceConditions: conditions,
      notes: "CIAAW interval reflects natural isotopic-composition variability in normal materials.",
    }),
    molarMass: property({
      normalizedValue: args.abridgedWeight / 1000,
      normalizedUnit: "kg/mol",
      sourceId: "ciaaw-abridged-atomic-weights-2024",
      sourceValue: args.abridgedWeight,
      sourceUnit: "g/mol (numerical standard-atomic-weight projection)",
      sourceUncertainty: { kind: "absolute", plusMinus: args.abridgedUncertainty },
      uncertainty: { kind: "absolute", plusMinus: args.abridgedUncertainty / 1000 },
      dataQuality: "CRITICALLY_EVALUATED",
      confidence: "HIGH",
      status: "APPROXIMATED",
      referenceConditions: conditions,
      conversionMethod: "Abridged standard atomic-weight numerical value × 1e-3 kg/mol",
      notes: "Deterministic engine projection. Isotope-specific atomic mass remains intentionally OPEN.",
    }),
    electronegativity: {
      ...property({
        normalizedValue: args.electronegativity,
        normalizedUnit: "1",
        sourceId: args.rscSourceId,
        sourceValue: args.electronegativity,
        sourceUnit: "Pauling",
        dataQuality: "COMPILED",
        status: "EMPIRICAL",
        confidence: "HIGH",
      }),
      scale: "Pauling",
    },
    valenceElectrons: property({
      normalizedValue: args.valenceElectrons,
      normalizedUnit: "1",
      sourceId: args.rscSourceId,
      sourceValue: args.valenceElectrons,
      sourceUnit: "count",
      dataQuality: "COMPILED",
    }),
    commonOxidationStates: property({
      normalizedValue: args.oxidationStates,
      normalizedUnit: "1",
      sourceId: args.rscSourceId,
      sourceValue: args.oxidationStates,
      sourceUnit: "oxidation-state",
      dataQuality: "COMPILED",
    }),
    covalentRadius: {
      ...property({
        normalizedValue: args.covalentRadiusAngstrom * 1e-10,
        normalizedUnit: "m",
        sourceId: args.rscSourceId,
        sourceValue: args.covalentRadiusAngstrom,
        sourceUnit: "angstrom",
        dataQuality: "COMPILED",
        status: "EMPIRICAL",
        confidence: "MEDIUM",
        conversionMethod: "angstrom -> m by factor 1e-10",
        notes: "Convention-dependent RSC typical covalent radius.",
      }),
      convention: "RSC typical covalent radius",
    },
    firstIonizationEnergy: property({
      normalizedValue: args.ionizationEv * EV_TO_J,
      normalizedUnit: "J",
      sourceId: "nist-asd-5.12",
      sourceValue: args.ionizationEv,
      sourceUnit: "eV",
      sourceUncertainty: { kind: "absolute", plusMinus: args.ionizationUncertaintyEv },
      uncertainty: { kind: "absolute", plusMinus: args.ionizationUncertaintyEv * EV_TO_J },
      dataQuality: "CRITICALLY_EVALUATED",
      conversionMethod: "eV -> J using exact elementary charge",
    }),
  };

  if (args.electronAffinityKjPerMol !== undefined) {
    element.electronAffinity = property({
      normalizedValue: (args.electronAffinityKjPerMol * 1000) / AVOGADRO_CONSTANT,
      normalizedUnit: "J",
      sourceId: args.rscSourceId,
      sourceValue: args.electronAffinityKjPerMol,
      sourceUnit: "kJ/mol",
      dataQuality: "COMPILED",
      confidence: "MEDIUM",
      conversionMethod: "kJ/mol -> J/particle using exact Avogadro constant",
    });
  }

  return {
    element,
    commonValences: property({
      normalizedValue: args.commonValences,
      normalizedUnit: "1",
      sourceId: args.rscSourceId,
      sourceValue: args.commonValences,
      sourceUnit: "valence-count",
      dataQuality: "COMPILED",
      status: "EMPIRICAL",
      notes: "Restricted neutral-covalent MVP projection, not a complete valence model.",
    }),
  };
}

export const minimumElementRecords: readonly MinimumElementRecord[] = [
  elementRecord({ symbol: "H", atomicNumber: 1, weightInterval: [1.00784, 1.00811], abridgedWeight: 1.0080, abridgedUncertainty: 0.0002, electronegativity: 2.20, valenceElectrons: 1, oxidationStates: [1, -1], commonValences: [1], covalentRadiusAngstrom: 0.32, rscSourceId: "rsc-periodic-h", ionizationEv: 13.598434599702, ionizationUncertaintyEv: 0.000000000012, electronAffinityKjPerMol: 72.769 }),
  elementRecord({ symbol: "C", atomicNumber: 6, weightInterval: [12.0096, 12.0116], abridgedWeight: 12.011, abridgedUncertainty: 0.002, electronegativity: 2.55, valenceElectrons: 4, oxidationStates: [4, 3, 2, 1, 0, -1, -2, -3, -4], commonValences: [4], covalentRadiusAngstrom: 0.75, rscSourceId: "rsc-periodic-c", ionizationEv: 11.2602880, ionizationUncertaintyEv: 0.0000011, electronAffinityKjPerMol: 121.776 }),
  elementRecord({ symbol: "N", atomicNumber: 7, weightInterval: [14.00643, 14.00728], abridgedWeight: 14.007, abridgedUncertainty: 0.001, electronegativity: 3.04, valenceElectrons: 5, oxidationStates: [5, 4, 3, 2, -3], commonValences: [3], covalentRadiusAngstrom: 0.71, rscSourceId: "rsc-periodic-n", ionizationEv: 14.53413, ionizationUncertaintyEv: 0.00004 }),
  elementRecord({ symbol: "O", atomicNumber: 8, weightInterval: [15.99903, 15.99977], abridgedWeight: 15.999, abridgedUncertainty: 0.001, electronegativity: 3.44, valenceElectrons: 6, oxidationStates: [-1, -2], commonValences: [2], covalentRadiusAngstrom: 0.64, rscSourceId: "rsc-periodic-o", ionizationEv: 13.618055, ionizationUncertaintyEv: 0.000007, electronAffinityKjPerMol: 140.976 }),
];

export const minimumElements: readonly ElementData[] = minimumElementRecords.map((entry) => entry.element);

const STANDARD_GAS = { temperatureK: REFERENCE_TEMPERATURE_K, pressurePa: REFERENCE_PRESSURE_PA, phase: "gas" as const, standardState: "1 bar" };
const STANDARD_LIQUID = { temperatureK: REFERENCE_TEMPERATURE_K, pressurePa: REFERENCE_PRESSURE_PA, phase: "liquid" as const, standardState: "1 bar" };

function enthalpy(valueKjPerMol: number, uncertaintyKjPerMol: number | undefined, phase: "gas" | "liquid", resolutionNote?: string): PropertyRecord<number, "J/mol"> {
  return property({
    normalizedValue: valueKjPerMol * 1000,
    normalizedUnit: "J/mol",
    sourceId: "nist-webbook-srd69",
    sourceValue: valueKjPerMol,
    sourceUnit: "kJ/mol",
    sourceUncertainty: uncertaintyKjPerMol === undefined ? undefined : { kind: "absolute", plusMinus: uncertaintyKjPerMol },
    uncertainty: uncertaintyKjPerMol === undefined ? { kind: "not_reported" } : { kind: "absolute", plusMinus: uncertaintyKjPerMol * 1000 },
    referenceConditions: phase === "gas" ? STANDARD_GAS : STANDARD_LIQUID,
    dataQuality: "EVALUATED",
    conversionMethod: "kJ/mol -> J/mol by factor 1000",
    resolutionNote,
  });
}

function entropy(value: number, uncertainty: number | undefined, phase: "gas" | "liquid", notes?: string): PropertyRecord<number, "J/(mol*K)"> {
  return property({
    normalizedValue: value,
    normalizedUnit: "J/(mol*K)",
    sourceId: "nist-webbook-srd69",
    sourceValue: value,
    sourceUnit: "J/(mol*K)",
    sourceUncertainty: uncertainty === undefined ? undefined : { kind: "absolute", plusMinus: uncertainty },
    uncertainty: uncertainty === undefined ? { kind: "not_reported" } : { kind: "absolute", plusMinus: uncertainty },
    referenceConditions: phase === "gas" ? STANDARD_GAS : STANDARD_LIQUID,
    dataQuality: "EVALUATED",
    notes,
  });
}

function elementalReferenceEnthalpy(): PropertyRecord<number, "J/mol"> {
  return property({
    normalizedValue: 0,
    normalizedUnit: "J/mol",
    sourceId: "thermochemical-reference-state-definition",
    sourceValue: 0,
    sourceUnit: "J/mol",
    referenceConditions: STANDARD_GAS,
    dataQuality: "EVALUATED",
    notes: "Zero is a reference-state definition, not a missing value.",
  });
}

export const minimumThermodynamics: readonly MolecularThermodynamicData[] = [
  { speciesId: "H2", phase: "gas", standardEnthalpyOfFormation: elementalReferenceEnthalpy(), standardMolarEntropy: entropy(130.680, 0.003, "gas") },
  { speciesId: "O2", phase: "gas", standardEnthalpyOfFormation: elementalReferenceEnthalpy(), standardMolarEntropy: entropy(205.152, 0.005, "gas") },
  { speciesId: "N2", phase: "gas", standardEnthalpyOfFormation: elementalReferenceEnthalpy(), standardMolarEntropy: entropy(191.609, 0.004, "gas") },
  { speciesId: "H2O", phase: "gas", standardEnthalpyOfFormation: enthalpy(-241.826, 0.040, "gas"), standardMolarEntropy: entropy(188.835, 0.010, "gas") },
  { speciesId: "H2O", phase: "liquid", standardEnthalpyOfFormation: enthalpy(-285.830, 0.040, "liquid"), standardMolarEntropy: entropy(69.95, 0.03, "liquid") },
  { speciesId: "CO", phase: "gas", standardEnthalpyOfFormation: enthalpy(-110.53, 0.17, "gas"), standardMolarEntropy: entropy(197.660, 0.004, "gas") },
  { speciesId: "CO2", phase: "gas", standardEnthalpyOfFormation: enthalpy(-393.51, 0.13, "gas"), standardMolarEntropy: entropy(213.785, 0.010, "gas") },
  {
    speciesId: "CH4",
    phase: "gas",
    standardEnthalpyOfFormation: enthalpy(-74.6, 0.3, "gas", "Selected NIST/Manion (2002) adopted recommendation instead of averaging the multiple NIST-listed values."),
    standardMolarEntropy: entropy(186.25, undefined, "gas", "Chase (1998) review value; NIST discusses differing historical entropy determinations."),
    molarHeatCapacity: property({
      normalizedValue: 35.69,
      normalizedUnit: "J/(mol*K)",
      sourceId: "nist-webbook-srd69",
      sourceValue: 35.69,
      sourceUnit: "J/(mol*K)",
      referenceConditions: STANDARD_GAS,
      dataQuality: "EVALUATED",
      status: "EMPIRICAL",
      notes: "298.15 K tabulated gas Cp; do not extrapolate as a constant Cp without an explicit model.",
    }),
  },
  { speciesId: "NH3", phase: "gas", standardEnthalpyOfFormation: enthalpy(-45.94, 0.35, "gas"), standardMolarEntropy: entropy(192.77, 0.05, "gas") },
];

function bondEnergy(id: string, bondType: string, order: 1 | 2 | 3, speciesId: string, kjPerMol: number, sourceId: string, a: string, b: string): BondEnergyRecord & { id: string } {
  return {
    id,
    ...property({
      normalizedValue: kjPerMol * 1000,
      normalizedUnit: "J/mol",
      sourceId,
      sourceValue: kjPerMol,
      sourceUnit: "kJ/mol",
      dataQuality: "COMPILED",
      confidence: "MEDIUM",
      status: "EMPIRICAL",
      conversionMethod: "kJ/mol -> J/mol by factor 1000",
      notes: "Compiled bond enthalpy retained only as a fallback; not promoted to a molecule-specific spectroscopic D0 value.",
    }),
    bondType,
    bondOrder: order,
    energyKind: "AVERAGE_BOND_ENTHALPY",
    speciesId,
    atomOrFragmentA: a,
    atomOrFragmentB: b,
  };
}

export const minimumBondEnergies: readonly (BondEnergyRecord & { id: string })[] = [
  bondEnergy("bond-H-H-H2", "H-H", 1, "H2", 435.9, "rsc-periodic-h", "H", "H"),
  bondEnergy("bond-O-O-O2", "O=O", 2, "O2", 498.3, "rsc-periodic-o", "O", "O"),
  bondEnergy("bond-N-N-N2", "N#N", 3, "N2", 944.7, "rsc-periodic-n", "N", "N"),
  bondEnergy("bond-C-H-CH4", "C-H", 1, "CH4", 415.5, "rsc-periodic-h", "C", "H"),
  bondEnergy("bond-N-H-NH3", "N-H", 1, "NH3", 390.8, "rsc-periodic-h", "N", "H"),
  bondEnergy("bond-O-H-H2O", "O-H", 1, "H2O", 462.8, "rsc-periodic-h", "O", "H"),
  bondEnergy("bond-C-O-CO2", "C=O", 2, "CO2", 803, "rsc-periodic-c", "C", "O"),
];

const referencePhases: Readonly<Record<string, "gas" | "liquid">> = {
  H2: "gas",
  O2: "gas",
  N2: "gas",
  H2O: "liquid",
  CO: "gas",
  CO2: "gas",
  CH4: "gas",
  NH3: "gas",
};

export const minimumPhaseEquilibrium: readonly PhaseEquilibriumData[] = Object.entries(referencePhases).map(([speciesId, phase]) => ({
  speciesId,
  phaseAtReferenceConditions: property({
    normalizedValue: phase,
    normalizedUnit: "1",
    sourceId: "nist-webbook-srd69",
    sourceValue: phase,
    sourceUnit: "phase-label",
    referenceConditions: { temperatureK: REFERENCE_TEMPERATURE_K, pressurePa: REFERENCE_PRESSURE_PA, phase },
    dataQuality: "EVALUATED",
    notes: "Reference-condition phase only; not a replacement for a pressure-aware phase boundary model.",
  }),
}));

export const minimumChemistryDataBundle: ChemistryDataBundle = {
  schemaVersion: MINIMUM_DATA_PACK_VERSION,
  sources: minimumSources,
  elements: minimumElements,
  bonds: minimumBondEnergies,
  thermodynamics: minimumThermodynamics,
  phaseEquilibrium: minimumPhaseEquilibrium,
};
