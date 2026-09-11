import type {
  BondEnergyRecord,
  ChemistryDataBundle,
  ElementData,
  MolecularThermodynamicData,
  PhaseEquilibriumData,
  PropertyRecord,
  PropertyValue,
  CanonicalSIUnit,
  SourceRecord,
} from "./schema";

export const MINIMUM_DATA_PACK_VERSION = "phase2c-minimum-v1";
export const REFERENCE_TEMPERATURE_K = 298.15;
export const REFERENCE_PRESSURE_PA = 100_000;
export const LAST_VERIFIED_DATE = "2026-09-11";

const AVOGADRO_CONSTANT = 6.02214076e23;

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
    retrievedOrTableContext: "H, C, N, O abridged values used for engine-facing molar mass",
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
    retrievedOrTableContext: "Gas/condensed thermochemistry for H2, O2, N2, H2O, CO, CO2, CH4, NH3",
  },
  {
    id: "rsc-periodic-h",
    title: "Hydrogen - Element information, properties and uses",
    publisherOrAuthors: "Royal Society of Chemistry",
    sourceType: "HANDBOOK_OR_INSTITUTION",
    citation: "Royal Society of Chemistry Periodic Table: Hydrogen",
    url: "https://periodic-table.rsc.org/element/1/hydrogen",
    accessedDate: LAST_VERIFIED_DATE,
    retrievedOrTableContext: "Pauling electronegativity, covalent radius, electron affinity, ionization energy, oxidation states, bond enthalpies",
  },
  {
    id: "rsc-periodic-c",
    title: "Carbon - Element information, properties and uses",
    publisherOrAuthors: "Royal Society of Chemistry",
    sourceType: "HANDBOOK_OR_INSTITUTION",
    citation: "Royal Society of Chemistry Periodic Table: Carbon",
    url: "https://periodic-table.rsc.org/element/6/carbon",
    accessedDate: LAST_VERIFIED_DATE,
    retrievedOrTableContext: "Pauling electronegativity, covalent radius, electron affinity, ionization energy, bond enthalpies",
  },
  {
    id: "rsc-periodic-n",
    title: "Nitrogen - Element information, properties and uses",
    publisherOrAuthors: "Royal Society of Chemistry",
    sourceType: "HANDBOOK_OR_INSTITUTION",
    citation: "Royal Society of Chemistry Periodic Table: Nitrogen",
    url: "https://periodic-table.rsc.org/element/7/nitrogen",
    accessedDate: LAST_VERIFIED_DATE,
    retrievedOrTableContext: "Pauling electronegativity, covalent radius, ionization energy, oxidation states, bond enthalpies",
  },
  {
    id: "rsc-periodic-o",
    title: "Oxygen - Element information, properties and uses",
    publisherOrAuthors: "Royal Society of Chemistry",
    sourceType: "HANDBOOK_OR_INSTITUTION",
    citation: "Royal Society of Chemistry Periodic Table: Oxygen",
    url: "https://periodic-table.rsc.org/element/8/oxygen",
    accessedDate: LAST_VERIFIED_DATE,
    retrievedOrTableContext: "Pauling electronegativity, covalent radius, electron affinity, ionization energy, oxidation states, bond enthalpies",
  },
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
    sourceMeasurements: [
      {
        sourceId: args.sourceId,
        sourceValue: args.sourceValue,
        sourceUnit: args.sourceUnit,
        sourceUncertainty: args.sourceUncertainty,
        sourceConditions: args.referenceConditions,
        conversionMethod: args.conversionMethod,
        conversionVersion: MINIMUM_DATA_PACK_VERSION,
      },
    ],
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

function elementRecord(args: {
  symbol: string;
  atomicNumber: number;
  standardAtomicWeight: readonly [number, number];
  abridgedAtomicWeight: number;
  abridgedUncertainty: number;
  electronegativity: number;
  valenceElectrons: number;
  commonOxidationStates: readonly number[];
  commonValences: readonly number[];
  covalentRadiusAngstrom: number;
  rscSourceId: string;
  ionizationEv: number;
  ionizationUncertaintyEv: number;
  electronAffinityKjPerMol?: number;
}): MinimumElementRecord {
  const molarMassKgPerMol = args.abridgedAtomicWeight / 1000;
  const ionizationJ = args.ionizationEv * 1.602176634e-19;
  const ionizationUncertaintyJ = args.ionizationUncertaintyEv * 1.602176634e-19;

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
      normalizedValue: { min: args.standardAtomicWeight[0], max: args.standardAtomicWeight[1] },
      normalizedUnit: "1",
      sourceId: "ciaaw-atomic-weights-2024",
      sourceValue: { min: args.standardAtomicWeight[0], max: args.standardAtomicWeight[1] },
      sourceUnit: "1",
      uncertainty: { kind: "interval", min: args.standardAtomicWeight[0], max: args.standardAtomicWeight[1] },
      dataQuality: "CRITICALLY_EVALUATED",
      notes: "CIAAW interval reflects natural isotopic-composition variability in normal materials.",
    }),
    molarMass: property({
      normalizedValue: molarMassKgPerMol,
      normalizedUnit: "kg/mol",
      sourceId: "ciaaw-abridged-atomic-weights-2024",
      sourceValue: args.abridgedAtomicWeight,
      sourceUnit: "g/mol",
      sourceUncertainty: { kind: "absolute", plusMinus: args.abridgedUncertainty },
      uncertainty: { kind: "absolute", plusMinus: args.abridgedUncertainty / 1000 },
      dataQuality: "CRITICALLY_EVALUATED",
      conversionMethod: "g/mol -> kg/mol by factor 1e-3",
      notes: "Engine-facing molar mass uses CIAAW abridged standard atomic weight for a deterministic scalar projection.",
    }),
    electronegativity: {
      ...property({
        normalizedValue: args.electronegativity,
        normalizedUnit: "1",
        sourceId: args.rscSourceId,
        sourceValue: args.electronegativity,
        sourceUnit: "Pauling",
        dataQuality: "COMPILED",
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
      normalizedValue: args.commonOxidationStates,
      normalizedUnit: "1",
      sourceId: args.rscSourceId,
      sourceValue: args.commonOxidationStates,
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
        conversionMethod: "angstrom -> m by factor 1e-10",
      }),
      convention: "RSC typical covalent radius",
    },
    firstIonizationEnergy: property({
      normalizedValue: ionizationJ,
      normalizedUnit: "J",
      sourceId: "nist-asd-5.12",
      sourceValue: args.ionizationEv,
      sourceUnit: "eV",
      sourceUncertainty: { kind: "absolute", plusMinus: args.ionizationUncertaintyEv },
      uncertainty: { kind: "absolute", plusMinus: ionizationUncertaintyJ },
      dataQuality: "CRITICALLY_EVALUATED",
      conversionMethod: "eV -> J using exact elementary charge 1.602176634e-19 J/eV",
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
      confidence: "HIGH",
      notes: "Common neutral-covalent valence set used only for the Phase 2C runtime projection; not a complete valence model.",
    }),
  };
}

export interface MinimumElementRecord {
  element: ElementData;
  commonValences: PropertyRecord<readonly number[], "1">;
}

export const minimumElementRecords: readonly MinimumElementRecord[] = [
  elementRecord({
    symbol: "H",
    atomicNumber: 1,
    standardAtomicWeight: [1.00784, 1.00811],
    abridgedAtomicWeight: 1.0080,
    abridgedUncertainty: 0.0002,
    electronegativity: 2.20,
    valenceElectrons: 1,
    commonOxidationStates: [1, -1],
    commonValences: [1],
    covalentRadiusAngstrom: 0.32,
    rscSourceId: "rsc-periodic-h",
    ionizationEv: 13.598434599702,
    ionizationUncertaintyEv: 0.000000000012,
    electronAffinityKjPerMol: 72.769,
  }),
  elementRecord({
    symbol: "C",
    atomicNumber: 6,
    standardAtomicWeight: [12.0096, 12.0116],
    abridgedAtomicWeight: 12.011,
    abridgedUncertainty: 0.002,
    electronegativity: 2.55,
    valenceElectrons: 4,
    commonOxidationStates: [4, 2, -4],
    commonValences: [4],
    covalentRadiusAngstrom: 0.75,
    rscSourceId: "rsc-periodic-c",
    ionizationEv: 11.2602880,
    ionizationUncertaintyEv: 0.0000011,
    electronAffinityKjPerMol: 121.776,
  }),
  elementRecord({
    symbol: "N",
    atomicNumber: 7,
    standardAtomicWeight: [14.00643, 14.00728],
    abridgedAtomicWeight: 14.007,
    abridgedUncertainty: 0.001,
    electronegativity: 3.04,
    valenceElectrons: 5,
    commonOxidationStates: [5, 4, 3, 2, -3],
    commonValences: [3],
    covalentRadiusAngstrom: 0.71,
    rscSourceId: "rsc-periodic-n",
    ionizationEv: 14.53413,
    ionizationUncertaintyEv: 0.00004,
  }),
  elementRecord({
    symbol: "O",
    atomicNumber: 8,
    standardAtomicWeight: [15.99903, 15.99977],
    abridgedAtomicWeight: 15.999,
    abridgedUncertainty: 0.001,
    electronegativity: 3.44,
    valenceElectrons: 6,
    commonOxidationStates: [-2, -1],
    commonValences: [2],
    covalentRadiusAngstrom: 0.64,
    rscSourceId: "rsc-periodic-o",
    ionizationEv: 13.618055,
    ionizationUncertaintyEv: 0.000007,
    electronAffinityKjPerMol: 140.976,
  }),
];

export const minimumElements: readonly ElementData[] = minimumElementRecords.map((entry) => entry.element);

const STANDARD_GAS = { temperatureK: REFERENCE_TEMPERATURE_K, pressurePa: REFERENCE_PRESSURE_PA, phase: "gas" as const, standardState: "1 bar" };
const STANDARD_LIQUID = { temperatureK: REFERENCE_TEMPERATURE_K, pressurePa: REFERENCE_PRESSURE_PA, phase: "liquid" as const, standardState: "1 bar" };

function thermoProperty(valueJ: number, sourceValue: number, sourceUnit: string, uncertaintyJ: number, phase: "gas" | "liquid", notes?: string, resolutionNote?: string): PropertyRecord<number, "J/mol"> {
  return property({
    normalizedValue: valueJ,
    normalizedUnit: "J/mol",
    sourceId: "nist-webbook-srd69",
    sourceValue,
    sourceUnit,
    sourceUncertainty: { kind: "absolute", plusMinus: sourceUnit === "kJ/mol" ? uncertaintyJ / 1000 : uncertaintyJ },
    uncertainty: { kind: "absolute", plusMinus: uncertaintyJ },
    referenceConditions: phase === "gas" ? STANDARD_GAS : STANDARD_LIQUID,
    dataQuality: "EVALUATED",
    notes,
    resolutionNote,
    conversionMethod: sourceUnit === "kJ/mol" ? "kJ/mol -> J/mol by factor 1000" : "identity",
  });
}

function entropyProperty(value: number, uncertainty: number, phase: "gas" | "liquid", notes?: string): PropertyRecord<number, "J/(mol*K)"> {
  return property({
    normalizedValue: value,
    normalizedUnit: "J/(mol*K)",
    sourceId: "nist-webbook-srd69",
    sourceValue: value,
    sourceUnit: "J/(mol*K)",
    sourceUncertainty: { kind: "absolute", plusMinus: uncertainty },
    referenceConditions: phase === "gas" ? STANDARD_GAS : STANDARD_LIQUID,
    dataQuality: "EVALUATED",
    notes,
  });
}

function elementalReferenceEnthalpy(phase: "gas"): PropertyRecord<number, "J/mol"> {
  return property({
    normalizedValue: 0,
    normalizedUnit: "J/mol",
    sourceId: "thermochemical-reference-state-definition",
    sourceValue: 0,
    sourceUnit: "J/mol",
    referenceConditions: STANDARD_GAS,
    dataQuality: "EVALUATED",
    status: "VERIFIED",
    confidence: "HIGH",
    notes: "Zero is a thermochemical reference-state definition, not a missing value.",
  });
}

export const minimumThermodynamics: readonly MolecularThermodynamicData[] = [
  { speciesId: "H2", phase: "gas", standardEnthalpyOfFormation: elementalReferenceEnthalpy("gas"), standardMolarEntropy: entropyProperty(130.680, 0.003, "gas") },
  { speciesId: "O2", phase: "gas", standardEnthalpyOfFormation: elementalReferenceEnthalpy("gas"), standardMolarEntropy: entropyProperty(205.152, 0.005, "gas") },
  { speciesId: "N2", phase: "gas", standardEnthalpyOfFormation: elementalReferenceEnthalpy("gas"), standardMolarEntropy: entropyProperty(191.609, 0.004, "gas") },
  {
    speciesId: "H2O",
    phase: "gas",
    standardEnthalpyOfFormation: thermoProperty(-241_826, -241.826, "kJ/mol", 40, "gas"),
    standardMolarEntropy: entropyProperty(188.835, 0.010, "gas"),
  },
  {
    speciesId: "H2O",
    phase: "liquid",
    standardEnthalpyOfFormation: thermoProperty(-285_830, -285.830, "kJ/mol", 40, "liquid"),
    standardMolarEntropy: entropyProperty(69.95, 0.03, "liquid"),
  },
  {
    speciesId: "CO",
    phase: "gas",
    standardEnthalpyOfFormation: thermoProperty(-110_530, -110.53, "kJ/mol", 170, "gas"),
    standardMolarEntropy: entropyProperty(197.660, 0.004, "gas"),
  },
  {
    speciesId: "CO2",
    phase: "gas",
    standardEnthalpyOfFormation: thermoProperty(-393_510, -393.51, "kJ/mol", 130, "gas"),
    standardMolarEntropy: entropyProperty(213.785, 0.010, "gas"),
  },
  {
    speciesId: "CH4",
    phase: "gas",
    standardEnthalpyOfFormation: thermoProperty(
      -74_600,
      -74.6,
      "kJ/mol",
      300,
      "gas",
      "NIST WebBook lists multiple reviewed/experimental values.",
      "Selected the NIST-listed Manion (2002) adopted recommendation (-74.6 ± 0.3 kJ/mol) rather than averaging conflicting values.",
    ),
    standardMolarEntropy: entropyProperty(186.25, 0, "gas", "Chase (1998) review value; NIST notes historical entropy determinations differ."),
    molarHeatCapacity: property({
      normalizedValue: 35.69,
      normalizedUnit: "J/(mol*K)",
      sourceId: "nist-webbook-srd69",
      sourceValue: 35.69,
      sourceUnit: "J/(mol*K)",
      referenceConditions: STANDARD_GAS,
      dataQuality: "EVALUATED",
      status: "EMPIRICAL",
      notes: "Tabulated 298.15 K gas heat capacity from the NIST WebBook compilation; use only near the stated temperature unless a Cp(T) correlation is requested.",
    }),
  },
  {
    speciesId: "NH3",
    phase: "gas",
    standardEnthalpyOfFormation: thermoProperty(-45_940, -45.94, "kJ/mol", 350, "gas"),
    standardMolarEntropy: entropyProperty(192.77, 0.05, "gas"),
  },
];

function bondEnergy(args: { id: string; bondType: string; order: 1 | 2 | 3; speciesId?: string; a: string; b: string; kjPerMol: number; sourceId: string; notes: string }): BondEnergyRecord & { id: string } {
  return {
    id: args.id,
    ...property({
      normalizedValue: args.kjPerMol * 1000,
      normalizedUnit: "J/mol",
      sourceId: args.sourceId,
      sourceValue: args.kjPerMol,
      sourceUnit: "kJ/mol",
      dataQuality: "COMPILED",
      confidence: "MEDIUM",
      status: "EMPIRICAL",
      conversionMethod: "kJ/mol -> J/mol by factor 1000",
      notes: args.notes,
    }),
    bondType: args.bondType,
    bondOrder: args.order,
    energyKind: "AVERAGE_BOND_ENTHALPY",
    speciesId: args.speciesId,
    atomOrFragmentA: args.a,
    atomOrFragmentB: args.b,
  };
}

export const minimumBondEnergies: readonly (BondEnergyRecord & { id: string })[] = [
  bondEnergy({ id: "bond-H-H-H2", bondType: "H-H", order: 1, speciesId: "H2", a: "H", b: "H", kjPerMol: 435.9, sourceId: "rsc-periodic-h", notes: "RSC compiled bond enthalpy found in H2; retained as empirical fallback, not a spectroscopic D0 claim." }),
  bondEnergy({ id: "bond-O-O-O2", bondType: "O=O", order: 2, speciesId: "O2", a: "O", b: "O", kjPerMol: 498.3, sourceId: "rsc-periodic-o", notes: "RSC compiled O=O bond enthalpy found in O2; fallback only." }),
  bondEnergy({ id: "bond-N-N-N2", bondType: "N#N", order: 3, speciesId: "N2", a: "N", b: "N", kjPerMol: 944.7, sourceId: "rsc-periodic-n", notes: "RSC compiled N≡N bond enthalpy found in N2; fallback only." }),
  bondEnergy({ id: "bond-C-H-CH4", bondType: "C-H", order: 1, speciesId: "CH4", a: "C", b: "H", kjPerMol: 415.5, sourceId: "rsc-periodic-h", notes: "RSC compiled C-H bond enthalpy found in CH4; not an individual-step methane dissociation energy." }),
  bondEnergy({ id: "bond-N-H-NH3", bondType: "N-H", order: 1, speciesId: "NH3", a: "N", b: "H", kjPerMol: 390.8, sourceId: "rsc-periodic-h", notes: "RSC compiled N-H bond enthalpy found in NH3; fallback only." }),
  bondEnergy({ id: "bond-O-H-H2O", bondType: "O-H", order: 1, speciesId: "H2O", a: "O", b: "H", kjPerMol: 462.8, sourceId: "rsc-periodic-h", notes: "RSC compiled O-H bond enthalpy found in H2O; fallback only." }),
  bondEnergy({ id: "bond-C-O-CO2", bondType: "C=O", order: 2, speciesId: "CO2", a: "C", b: "O", kjPerMol: 803, sourceId: "rsc-periodic-c", notes: "RSC compiled C=O bond enthalpy found in CO2; fallback only." }),
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
    notes: "Reference phase only. This is not a substitute for a full phase-boundary model.",
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
