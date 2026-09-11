import {
  minimumBondEnergies,
  minimumChemistryDataBundle,
  minimumElementProvider,
  minimumPhaseEquilibrium,
  minimumThermodynamics,
} from "./minimum-pack";
import type {
  AcidBaseData,
  BondEnergyRecord,
  Confidence,
  DataQuality,
  MolecularThermodynamicData,
  PhaseEquilibriumData,
  PropertyRecord,
  RedoxCoupleData,
  ScientificStatus,
  SolubilityData,
  SourceRecord,
} from "./schema";

export type ReferenceMatchStatus =
  | "EXACT_REFERENCE_MATCH"
  | "POSSIBLE_REFERENCE_MATCH"
  | "NO_REFERENCE_MATCH"
  | "AMBIGUOUS"
  | "INSUFFICIENT_STRUCTURE_INFORMATION";

export type ReferenceStructuralDimension =
  | "MOLECULAR_FORMULA"
  | "ATOM_CONNECTIVITY"
  | "BOND_ORDER"
  | "FORMAL_CHARGE"
  | "NET_CHARGE"
  | "AROMATICITY"
  | "RADICAL_STATE"
  | "STEREOCHEMISTRY"
  | "ELECTRONIC_STATE";

/**
 * 03-owned matching shape. It is intentionally only structurally compatible
 * with 01 MolecularGraph and is NOT the canonical registry identity type.
 */
export interface ScientificMatchAtom {
  id: string;
  element: string;
  formalCharge: number;
  radicalElectrons?: number;
}

export interface ScientificMatchBond {
  id?: string;
  a: string;
  b: string;
  kind: "covalent" | "aromatic" | "ionic" | "coordination" | "other" | string;
  order: number;
}

export interface ScientificMatchGraph {
  atoms: readonly ScientificMatchAtom[];
  bonds: readonly ScientificMatchBond[];
}

export type ScientificMatchFormula = Readonly<Record<string, number>>;

export interface ScientificMatchInput {
  /** Opaque 01 registry/canonical identity. 03 records it for traceability but does not interpret it. */
  canonicalKey: string;
  molecularFormula: ScientificMatchFormula;
  netCharge: number;
  molecularGraph?: ScientificMatchGraph;
}

export interface ExternalReferenceIdentifiers {
  pubChemCid?: number;
  inchiKey?: string;
  casRegistryNumber?: string;
}

export interface KnownSpeciesReferenceRecord {
  /** 03 scientific-reference identity; never reuse as an 01 registry id or 04 player-knowledge id. */
  referenceSpeciesId: string;
  dataSpeciesId: string;
  commonName: string;
  canonicalFormula: string;
  molecularFormula: ScientificMatchFormula;
  netCharge: number;
  referenceGraph: ScientificMatchGraph;
  externalIdentifiers: ExternalReferenceIdentifiers;
  identitySourceIds: readonly string[];
  dataQuality: DataQuality;
  confidence: Confidence;
  scientificStatus: ScientificStatus;
  unresolvedStructuralDimensions?: readonly ReferenceStructuralDimension[];
  notes?: readonly string[];
}

export interface ScientificPropertyAvailability {
  molarMass: ScientificStatus;
  standardEnthalpyOfFormation: ScientificStatus;
  standardMolarEntropy: ScientificStatus;
  standardGibbsEnergyOfFormation: ScientificStatus;
  heatCapacity: ScientificStatus;
  meltingPoint: ScientificStatus;
  boilingPoint: ScientificStatus;
  acidBase: ScientificStatus;
  redox: ScientificStatus;
  solubility: ScientificStatus;
}

export interface ScientificPropertyEnrichment {
  dataSpeciesId: string;
  molarMass: PropertyRecord<number, "kg/mol"> | null;
  thermodynamics: readonly MolecularThermodynamicData[];
  phaseEquilibrium: PhaseEquilibriumData | null;
  bondReferences: readonly BondEnergyRecord[];
  acidBase: readonly AcidBaseData[];
  redox: readonly RedoxCoupleData[];
  solubility: readonly SolubilityData[];
  availability: ScientificPropertyAvailability;
  provenanceSourceIds: readonly string[];
}

export interface ScientificReferenceMatch {
  internalCanonicalKey: string;
  referenceMatchStatus: ReferenceMatchStatus;
  referenceSpeciesId?: string;
  candidateReferenceSpeciesIds: readonly string[];
  scientificStatus: ScientificStatus;
  confidence: Confidence;
  matchedDimensions: readonly ReferenceStructuralDimension[];
  unresolvedDimensions: readonly ReferenceStructuralDimension[];
  provenanceSourceIds: readonly string[];
  enrichment?: ScientificPropertyEnrichment;
  notes: readonly string[];
}

export interface ReferenceIndexValidationIssue {
  code:
    | "DUPLICATE_REFERENCE_ID"
    | "DUPLICATE_REFERENCE_STRUCTURE"
    | "DUPLICATE_EXTERNAL_ID"
    | "UNKNOWN_IDENTITY_SOURCE"
    | "INVALID_REFERENCE_GRAPH"
    | "FORMULA_GRAPH_MISMATCH"
    | "NET_CHARGE_GRAPH_MISMATCH";
  referenceSpeciesId: string;
  message: string;
}

export interface ReferenceSpeciesIndex {
  records: readonly PreparedReferenceRecord[];
  byFormula: ReadonlyMap<string, readonly PreparedReferenceRecord[]>;
}

interface PreparedReferenceRecord extends KnownSpeciesReferenceRecord {
  formulaKey: string;
  exactStructuralKey: string;
  topologyStructuralKey: string;
}

const LAST_VERIFIED_DATE = "2026-09-12";
const REFERENCE_FINGERPRINT_VERSION = "scientific-reference-fingerprint-v1";
const MAX_REFERENCE_CANONICAL_STATES = 20_000;

export const scientificReferenceSources: readonly SourceRecord[] = [
  {
    id: "pubchem-compound-identity-2026-09",
    title: "PubChem Compound",
    publisherOrAuthors: "National Center for Biotechnology Information, U.S. National Library of Medicine",
    sourceType: "REFERENCE_DATABASE",
    citation: "PubChem Compound identity records for Phase 2 generated-species reference matching",
    url: "https://pubchem.ncbi.nlm.nih.gov/",
    databaseName: "PubChem Compound",
    databaseVersion: "accessed 2026-09-12",
    accessedDate: LAST_VERIFIED_DATE,
    retrievedOrTableContext: "CID, molecular formula, common/IUPAC identity descriptors and InChIKey for seed species",
  },
  {
    id: "reference-molar-mass-derivation-v1",
    title: "Phase 2 generated-species molar-mass projection",
    publisherOrAuthors: "chemical-lab Chemistry Data layer",
    sourceType: "INTERNAL_DERIVATION",
    citation: "Sum of Phase 2C element molar-mass projections by molecular formula",
    databaseName: "chemical-lab internal derivation",
    databaseVersion: REFERENCE_FINGERPRINT_VERSION,
    accessedDate: LAST_VERIFIED_DATE,
    retrievedOrTableContext: "Uses the existing CIAAW-anchored H/C/N/O element molar masses; does not create isotope-specific exact masses",
  },
];

function graph(
  atoms: readonly [id: string, element: string, formalCharge?: number, radicalElectrons?: number][],
  bonds: readonly [a: string, b: string, order: number, kind?: ScientificMatchBond["kind"] ][],
): ScientificMatchGraph {
  return {
    atoms: atoms.map(([id, element, formalCharge = 0, radicalElectrons]) => ({
      id,
      element,
      formalCharge,
      radicalElectrons,
    })),
    bonds: bonds.map(([a, b, order, kind = "covalent"], index) => ({
      id: `r${index + 1}`,
      a,
      b,
      order,
      kind,
    })),
  };
}

export const knownSpeciesReferenceRecords: readonly KnownSpeciesReferenceRecord[] = [
  {
    referenceSpeciesId: "ref:pubchem:783",
    dataSpeciesId: "H2",
    commonName: "Hydrogen",
    canonicalFormula: "H2",
    molecularFormula: { H: 2 },
    netCharge: 0,
    referenceGraph: graph([["h1", "H"], ["h2", "H"]], [["h1", "h2", 1]]),
    externalIdentifiers: { pubChemCid: 783, inchiKey: "UFHFLCQGNIYNRP-UHFFFAOYSA-N", casRegistryNumber: "1333-74-0" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"],
    dataQuality: "EVALUATED",
    confidence: "HIGH",
    scientificStatus: "VERIFIED",
  },
  {
    referenceSpeciesId: "ref:pubchem:977",
    dataSpeciesId: "O2",
    commonName: "Oxygen",
    canonicalFormula: "O2",
    molecularFormula: { O: 2 },
    netCharge: 0,
    referenceGraph: graph([["o1", "O"], ["o2", "O"]], [["o1", "o2", 2]]),
    externalIdentifiers: { pubChemCid: 977, inchiKey: "MYMOFIZGZYHOMD-UHFFFAOYSA-N", casRegistryNumber: "7782-44-7" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"],
    dataQuality: "EVALUATED",
    confidence: "HIGH",
    scientificStatus: "VERIFIED",
    unresolvedStructuralDimensions: ["ELECTRONIC_STATE"],
    notes: ["The current 2D graph identity does not resolve molecular-oxygen electronic/spin state; do not use this match as a state-resolved spectroscopy identity."],
  },
  {
    referenceSpeciesId: "ref:pubchem:947",
    dataSpeciesId: "N2",
    commonName: "Nitrogen",
    canonicalFormula: "N2",
    molecularFormula: { N: 2 },
    netCharge: 0,
    referenceGraph: graph([["n1", "N"], ["n2", "N"]], [["n1", "n2", 3]]),
    externalIdentifiers: { pubChemCid: 947, inchiKey: "IJGRMHOSHXDMSA-UHFFFAOYSA-N", casRegistryNumber: "7727-37-9" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"],
    dataQuality: "EVALUATED",
    confidence: "HIGH",
    scientificStatus: "VERIFIED",
  },
  {
    referenceSpeciesId: "ref:pubchem:962",
    dataSpeciesId: "H2O",
    commonName: "Water",
    canonicalFormula: "H2O",
    molecularFormula: { H: 2, O: 1 },
    netCharge: 0,
    referenceGraph: graph([["o", "O"], ["h1", "H"], ["h2", "H"]], [["o", "h1", 1], ["o", "h2", 1]]),
    externalIdentifiers: { pubChemCid: 962, inchiKey: "XLYOFNOQVPJJNP-UHFFFAOYSA-N", casRegistryNumber: "7732-18-5" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"],
    dataQuality: "EVALUATED",
    confidence: "HIGH",
    scientificStatus: "VERIFIED",
  },
  {
    referenceSpeciesId: "ref:pubchem:281",
    dataSpeciesId: "CO",
    commonName: "Carbon monoxide",
    canonicalFormula: "CO",
    molecularFormula: { C: 1, O: 1 },
    netCharge: 0,
    referenceGraph: graph([["c", "C", -1], ["o", "O", 1]], [["c", "o", 3]]),
    externalIdentifiers: { pubChemCid: 281, inchiKey: "UGFAIRIUMAVXCW-UHFFFAOYSA-N", casRegistryNumber: "630-08-0" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"],
    dataQuality: "EVALUATED",
    confidence: "HIGH",
    scientificStatus: "VERIFIED",
    notes: ["PubChem represents carbon monoxide as [C-]#[O+]. A neutral-formal-charge C#O graph is only a possible match under this contract, not an exact charge-aware match."],
  },
  {
    referenceSpeciesId: "ref:pubchem:280",
    dataSpeciesId: "CO2",
    commonName: "Carbon dioxide",
    canonicalFormula: "CO2",
    molecularFormula: { C: 1, O: 2 },
    netCharge: 0,
    referenceGraph: graph([["c", "C"], ["o1", "O"], ["o2", "O"]], [["c", "o1", 2], ["c", "o2", 2]]),
    externalIdentifiers: { pubChemCid: 280, inchiKey: "CURLTUGMZLYLDI-UHFFFAOYSA-N", casRegistryNumber: "124-38-9" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"],
    dataQuality: "EVALUATED",
    confidence: "HIGH",
    scientificStatus: "VERIFIED",
  },
  {
    referenceSpeciesId: "ref:pubchem:297",
    dataSpeciesId: "CH4",
    commonName: "Methane",
    canonicalFormula: "CH4",
    molecularFormula: { C: 1, H: 4 },
    netCharge: 0,
    referenceGraph: graph(
      [["c", "C"], ["h1", "H"], ["h2", "H"], ["h3", "H"], ["h4", "H"]],
      [["c", "h1", 1], ["c", "h2", 1], ["c", "h3", 1], ["c", "h4", 1]],
    ),
    externalIdentifiers: { pubChemCid: 297, inchiKey: "VNWKTOKETHGBQD-UHFFFAOYSA-N", casRegistryNumber: "74-82-8" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"],
    dataQuality: "EVALUATED",
    confidence: "HIGH",
    scientificStatus: "VERIFIED",
  },
  {
    referenceSpeciesId: "ref:pubchem:222",
    dataSpeciesId: "NH3",
    commonName: "Ammonia",
    canonicalFormula: "NH3",
    molecularFormula: { H: 3, N: 1 },
    netCharge: 0,
    referenceGraph: graph(
      [["n", "N"], ["h1", "H"], ["h2", "H"], ["h3", "H"]],
      [["n", "h1", 1], ["n", "h2", 1], ["n", "h3", 1]],
    ),
    externalIdentifiers: { pubChemCid: 222, inchiKey: "QGZKDVFQNNGYKY-UHFFFAOYSA-N", casRegistryNumber: "7664-41-7" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"],
    dataQuality: "EVALUATED",
    confidence: "HIGH",
    scientificStatus: "VERIFIED",
  },
];

function formulaKey(formula: ScientificMatchFormula): string {
  return Object.entries(formula)
    .filter(([, count]) => Number.isFinite(count) && count !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([element, count]) => `${element}:${count}`)
    .join("|");
}

function deriveFormula(graphValue: ScientificMatchGraph): ScientificMatchFormula {
  const counts: Record<string, number> = Object.create(null) as Record<string, number>;
  for (const atom of graphValue.atoms) {
    counts[atom.element] = (counts[atom.element] ?? 0) + 1;
  }
  return Object.freeze(Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))));
}

function deriveNetCharge(graphValue: ScientificMatchGraph): number {
  return graphValue.atoms.reduce((sum, atom) => sum + atom.formalCharge, 0);
}

function atomInvariant(atom: ScientificMatchAtom, ignoreChargeAndRadicals: boolean): string {
  return ignoreChargeAndRadicals
    ? atom.element
    : [atom.element, atom.formalCharge, atom.radicalElectrons ?? 0].join("|");
}

function bondInvariant(bond: ScientificMatchBond): string {
  return `${bond.kind}:${bond.order}`;
}

function buildAdjacency(graphValue: ScientificMatchGraph): Map<string, Array<{ neighbor: string; bond: ScientificMatchBond }>> {
  const adjacency = new Map<string, Array<{ neighbor: string; bond: ScientificMatchBond }>>();
  for (const atom of graphValue.atoms) adjacency.set(atom.id, []);
  for (const bond of graphValue.bonds) {
    adjacency.get(bond.a)?.push({ neighbor: bond.b, bond });
    adjacency.get(bond.b)?.push({ neighbor: bond.a, bond });
  }
  return adjacency;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [Array.from(items)];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += 1) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const suffix of permutations(rest)) result.push([items[i]!, ...suffix]);
  }
  return result;
}

function referenceStructuralKey(graphValue: ScientificMatchGraph, ignoreChargeAndRadicals = false): string {
  const atomIds = new Set(graphValue.atoms.map((atom) => atom.id));
  if (atomIds.size !== graphValue.atoms.length) throw new Error("Duplicate atom ids in scientific match graph.");
  for (const bond of graphValue.bonds) {
    if (!atomIds.has(bond.a) || !atomIds.has(bond.b) || bond.a === bond.b) {
      throw new Error("Invalid bond endpoint in scientific match graph.");
    }
    if (!Number.isFinite(bond.order) || bond.order <= 0) throw new Error("Invalid bond order in scientific match graph.");
  }

  const adjacency = buildAdjacency(graphValue);
  let colors = new Map(graphValue.atoms.map((atom) => [atom.id, atomInvariant(atom, ignoreChargeAndRadicals)]));

  for (let round = 0; round < graphValue.atoms.length; round += 1) {
    const signatures = new Map<string, string>();
    for (const atom of graphValue.atoms) {
      const neighborhood = (adjacency.get(atom.id) ?? [])
        .map(({ neighbor, bond }) => `${bondInvariant(bond)}>${colors.get(neighbor) ?? ""}`)
        .sort()
        .join(",");
      signatures.set(atom.id, `${colors.get(atom.id)}[${neighborhood}]`);
    }
    const unique = [...new Set(signatures.values())].sort();
    const rank = new Map(unique.map((value, index) => [value, String(index)]));
    const next = new Map(graphValue.atoms.map((atom) => [atom.id, rank.get(signatures.get(atom.id) ?? "") ?? ""]));
    if (graphValue.atoms.every((atom) => next.get(atom.id) === colors.get(atom.id))) {
      colors = next;
      break;
    }
    colors = next;
  }

  const groups = new Map<string, string[]>();
  for (const atom of graphValue.atoms) {
    const color = colors.get(atom.id) ?? "";
    const group = groups.get(color) ?? [];
    group.push(atom.id);
    groups.set(color, group);
  }
  const orderedGroups = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ids]) => ids);

  let stateCount = 1;
  for (const group of orderedGroups) {
    for (let n = 2; n <= group.length; n += 1) stateCount *= n;
    if (stateCount > MAX_REFERENCE_CANONICAL_STATES) throw new Error("Scientific reference fingerprint search budget exceeded.");
  }

  let candidates: string[][] = [[]];
  for (const group of orderedGroups) {
    const next: string[][] = [];
    for (const prefix of candidates) {
      for (const variant of permutations(group)) next.push([...prefix, ...variant]);
    }
    candidates = next;
  }

  const atomById = new Map(graphValue.atoms.map((atom) => [atom.id, atom]));
  let best: string | undefined;
  for (const order of candidates) {
    const index = new Map(order.map((id, i) => [id, i]));
    const atomPart = order.map((id) => atomInvariant(atomById.get(id)!, ignoreChargeAndRadicals)).join(";");
    const bondPart = graphValue.bonds
      .map((bond) => {
        const a = index.get(bond.a)!;
        const b = index.get(bond.b)!;
        const [x, y] = a < b ? [a, b] : [b, a];
        return `${x}-${y}:${bondInvariant(bond)}`;
      })
      .sort()
      .join(";");
    const encoded = `${REFERENCE_FINGERPRINT_VERSION}|${atomPart}||${bondPart}`;
    if (best === undefined || encoded < best) best = encoded;
  }
  return best ?? `${REFERENCE_FINGERPRINT_VERSION}|`;
}

function prepareRecord(record: KnownSpeciesReferenceRecord): PreparedReferenceRecord {
  return {
    ...record,
    formulaKey: formulaKey(record.molecularFormula),
    exactStructuralKey: referenceStructuralKey(record.referenceGraph, false),
    topologyStructuralKey: referenceStructuralKey(record.referenceGraph, true),
  };
}

export function buildReferenceSpeciesIndex(records: readonly KnownSpeciesReferenceRecord[]): ReferenceSpeciesIndex {
  const prepared = records.map(prepareRecord);
  const byFormulaMutable = new Map<string, PreparedReferenceRecord[]>();
  for (const record of prepared) {
    const bucket = byFormulaMutable.get(record.formulaKey) ?? [];
    bucket.push(record);
    byFormulaMutable.set(record.formulaKey, bucket);
  }
  return {
    records: prepared,
    byFormula: new Map([...byFormulaMutable.entries()].map(([key, bucket]) => [key, Object.freeze([...bucket])] as const)),
  };
}

export const knownSpeciesReferenceIndex = buildReferenceSpeciesIndex(knownSpeciesReferenceRecords);

function sameFormula(a: ScientificMatchFormula, b: ScientificMatchFormula): boolean {
  return formulaKey(a) === formulaKey(b);
}

function summarizeStatus(statuses: readonly ScientificStatus[]): ScientificStatus {
  if (statuses.includes("VERIFIED")) return "VERIFIED";
  if (statuses.includes("APPROXIMATED")) return "APPROXIMATED";
  if (statuses.includes("EMPIRICAL")) return "EMPIRICAL";
  if (statuses.includes("GAMEPLAY_SIMPLIFICATION")) return "GAMEPLAY_SIMPLIFICATION";
  return "OPEN";
}

function deriveMolarMass(formula: ScientificMatchFormula): PropertyRecord<number, "kg/mol"> | null {
  let total = 0;
  for (const [symbol, count] of Object.entries(formula)) {
    const element = minimumElementProvider.getElement(symbol);
    if (!element || !Number.isFinite(count) || count < 0) return null;
    total += element.atomicMolarMassKgPerMol * count;
  }
  return {
    normalizedValue: total,
    normalizedUnit: "kg/mol",
    sourceMeasurements: [{
      sourceId: "reference-molar-mass-derivation-v1",
      sourceValue: total,
      sourceUnit: "kg/mol",
      conversionMethod: "sum(element atomicMolarMassKgPerMol × atom count)",
      conversionVersion: REFERENCE_FINGERPRINT_VERSION,
    }],
    referenceConditions: { qualifier: "natural terrestrial isotopic composition projection inherited from Phase 2C element data" },
    uncertainty: { kind: "not_reported" },
    dataQuality: "EVALUATED",
    confidence: "HIGH",
    status: "APPROXIMATED",
    lastVerifiedDate: LAST_VERIFIED_DATE,
    notes: "Derived from CIAAW-anchored element molar-mass projections; this is not an isotope-specific exact molecular mass.",
  };
}

function createEnrichment(reference: PreparedReferenceRecord): ScientificPropertyEnrichment {
  const dataSpeciesId = reference.dataSpeciesId;
  const thermodynamics = minimumThermodynamics.filter((record) => record.speciesId === dataSpeciesId);
  const phaseEquilibrium = minimumPhaseEquilibrium.find((record) => record.speciesId === dataSpeciesId) ?? null;
  const bondReferences = minimumBondEnergies.filter((record) => record.speciesId === dataSpeciesId);
  const acidBase = (minimumChemistryDataBundle.acidBase ?? []).filter(
    (record) => record.acidSpeciesId === dataSpeciesId || record.conjugateBaseSpeciesId === dataSpeciesId,
  );
  const redox = (minimumChemistryDataBundle.redox ?? []).filter(
    (record) => record.oxidizedSpeciesIds.includes(dataSpeciesId) || record.reducedSpeciesIds.includes(dataSpeciesId),
  );
  const solubility = (minimumChemistryDataBundle.solubility ?? []).filter((record) => record.speciesId === dataSpeciesId);
  const molarMass = deriveMolarMass(reference.molecularFormula);

  const formationStatuses = thermodynamics
    .map((record) => record.standardEnthalpyOfFormation?.status)
    .filter((status): status is ScientificStatus => status !== undefined);
  const entropyStatuses = thermodynamics
    .map((record) => record.standardMolarEntropy?.status)
    .filter((status): status is ScientificStatus => status !== undefined);
  const gibbsStatuses = thermodynamics
    .map((record) => record.standardGibbsEnergyOfFormation?.status)
    .filter((status): status is ScientificStatus => status !== undefined);
  const cpStatuses = thermodynamics
    .flatMap((record) => [record.molarHeatCapacity?.status, record.heatCapacityCorrelation?.status])
    .filter((status): status is ScientificStatus => status !== undefined);

  const provenanceSourceIds = new Set<string>(reference.identitySourceIds);
  if (molarMass) provenanceSourceIds.add("reference-molar-mass-derivation-v1");
  for (const record of thermodynamics) {
    for (const property of [
      record.standardEnthalpyOfFormation,
      record.standardMolarEntropy,
      record.standardGibbsEnergyOfFormation,
      record.molarHeatCapacity,
    ]) {
      for (const measurement of property?.sourceMeasurements ?? []) provenanceSourceIds.add(measurement.sourceId);
    }
    for (const sourceId of record.heatCapacityCorrelation?.sourceIds ?? []) provenanceSourceIds.add(sourceId);
  }
  for (const record of bondReferences) {
    for (const measurement of record.sourceMeasurements) provenanceSourceIds.add(measurement.sourceId);
  }
  for (const property of [phaseEquilibrium?.meltingPoint, phaseEquilibrium?.boilingPoint]) {
    for (const measurement of property?.sourceMeasurements ?? []) provenanceSourceIds.add(measurement.sourceId);
  }

  return {
    dataSpeciesId,
    molarMass,
    thermodynamics,
    phaseEquilibrium,
    bondReferences,
    acidBase,
    redox,
    solubility,
    availability: {
      molarMass: molarMass?.status ?? "OPEN",
      standardEnthalpyOfFormation: summarizeStatus(formationStatuses),
      standardMolarEntropy: summarizeStatus(entropyStatuses),
      standardGibbsEnergyOfFormation: summarizeStatus(gibbsStatuses),
      heatCapacity: summarizeStatus(cpStatuses),
      meltingPoint: phaseEquilibrium?.meltingPoint?.status ?? "OPEN",
      boilingPoint: phaseEquilibrium?.boilingPoint?.status ?? "OPEN",
      acidBase: acidBase.length > 0 ? summarizeStatus(acidBase.flatMap((record) => [record.pKa?.status, record.protonAffinity?.status, record.classification?.status].filter((status): status is ScientificStatus => status !== undefined))) : "OPEN",
      redox: redox.length > 0 ? summarizeStatus(redox.map((record) => record.standardElectrodePotential?.status).filter((status): status is ScientificStatus => status !== undefined)) : "OPEN",
      solubility: solubility.length > 0 ? summarizeStatus(solubility.flatMap((record) => [record.solubility?.status, record.ksp?.status].filter((status): status is ScientificStatus => status !== undefined))) : "OPEN",
    },
    provenanceSourceIds: [...provenanceSourceIds].sort(),
  };
}

function baseResult(input: ScientificMatchInput, status: ReferenceMatchStatus, candidates: readonly PreparedReferenceRecord[], notes: readonly string[]): ScientificReferenceMatch {
  return {
    internalCanonicalKey: input.canonicalKey,
    referenceMatchStatus: status,
    candidateReferenceSpeciesIds: candidates.map((candidate) => candidate.referenceSpeciesId),
    scientificStatus:
      status === "EXACT_REFERENCE_MATCH" ? "VERIFIED" : status === "POSSIBLE_REFERENCE_MATCH" ? "APPROXIMATED" : "OPEN",
    confidence:
      status === "EXACT_REFERENCE_MATCH" ? "HIGH" : status === "POSSIBLE_REFERENCE_MATCH" ? "MEDIUM" : "UNASSESSED",
    matchedDimensions: ["MOLECULAR_FORMULA", "NET_CHARGE"],
    unresolvedDimensions: [],
    provenanceSourceIds: [],
    notes,
  };
}

export function matchScientificReference(
  input: ScientificMatchInput,
  index: ReferenceSpeciesIndex = knownSpeciesReferenceIndex,
): ScientificReferenceMatch {
  const bucket = index.byFormula.get(formulaKey(input.molecularFormula)) ?? [];
  if (bucket.length === 0) {
    return baseResult(input, "NO_REFERENCE_MATCH", [], ["No record exists in the currently loaded scientific reference index for this formula. This is not evidence that the species cannot exist in the real world."]);
  }

  const chargeCompatible = bucket.filter((record) => record.netCharge === input.netCharge);
  if (chargeCompatible.length === 0) {
    return baseResult(input, "NO_REFERENCE_MATCH", [], ["Formula bucket exists, but no loaded reference record has the same net charge."]);
  }

  if (!input.molecularGraph) {
    const result = baseResult(input, "INSUFFICIENT_STRUCTURE_INFORMATION", chargeCompatible, ["Formula and net charge are insufficient for a structure-level identity decision."]);
    result.unresolvedDimensions = ["ATOM_CONNECTIVITY", "BOND_ORDER", "FORMAL_CHARGE", "AROMATICITY", "RADICAL_STATE", "STEREOCHEMISTRY"];
    return result;
  }

  if (!sameFormula(input.molecularFormula, deriveFormula(input.molecularGraph)) || input.netCharge !== deriveNetCharge(input.molecularGraph)) {
    const result = baseResult(input, "INSUFFICIENT_STRUCTURE_INFORMATION", chargeCompatible, ["Scientific match input is internally inconsistent: supplied formula/net charge does not agree with the supplied graph."]);
    result.unresolvedDimensions = ["MOLECULAR_FORMULA", "NET_CHARGE"];
    return result;
  }

  let exactKey: string;
  let topologyKey: string;
  try {
    exactKey = referenceStructuralKey(input.molecularGraph, false);
    topologyKey = referenceStructuralKey(input.molecularGraph, true);
  } catch (error) {
    const result = baseResult(input, "INSUFFICIENT_STRUCTURE_INFORMATION", chargeCompatible, [error instanceof Error ? error.message : "Unable to construct a scientific reference fingerprint."]);
    result.unresolvedDimensions = ["ATOM_CONNECTIVITY", "BOND_ORDER"];
    return result;
  }

  const exact = chargeCompatible.filter((record) => record.exactStructuralKey === exactKey);
  if (exact.length > 1) {
    const result = baseResult(input, "AMBIGUOUS", exact, ["Multiple scientific reference records share the same represented structure. Reference data must be de-duplicated or further structural dimensions supplied."]);
    result.matchedDimensions = ["MOLECULAR_FORMULA", "ATOM_CONNECTIVITY", "BOND_ORDER", "FORMAL_CHARGE", "NET_CHARGE", "AROMATICITY", "RADICAL_STATE"];
    return result;
  }

  if (exact.length === 1) {
    const reference = exact[0]!;
    const unresolved = reference.unresolvedStructuralDimensions ?? [];
    if (unresolved.length > 0 && unresolved.some((dimension) => dimension === "STEREOCHEMISTRY")) {
      const result = baseResult(input, "INSUFFICIENT_STRUCTURE_INFORMATION", exact, ["Represented graph matches, but the reference identity requires a structural dimension that this matching input cannot establish."]);
      result.matchedDimensions = ["MOLECULAR_FORMULA", "ATOM_CONNECTIVITY", "BOND_ORDER", "FORMAL_CHARGE", "NET_CHARGE", "AROMATICITY", "RADICAL_STATE"];
      result.unresolvedDimensions = unresolved;
      result.provenanceSourceIds = reference.identitySourceIds;
      return result;
    }

    const enrichment = createEnrichment(reference);
    return {
      internalCanonicalKey: input.canonicalKey,
      referenceMatchStatus: "EXACT_REFERENCE_MATCH",
      referenceSpeciesId: reference.referenceSpeciesId,
      candidateReferenceSpeciesIds: [reference.referenceSpeciesId],
      scientificStatus: reference.scientificStatus,
      confidence: reference.confidence,
      matchedDimensions: ["MOLECULAR_FORMULA", "ATOM_CONNECTIVITY", "BOND_ORDER", "FORMAL_CHARGE", "NET_CHARGE", "AROMATICITY", "RADICAL_STATE"],
      unresolvedDimensions: unresolved,
      provenanceSourceIds: [...new Set([...reference.identitySourceIds, ...enrichment.provenanceSourceIds])].sort(),
      enrichment,
      notes: reference.notes ?? [],
    };
  }

  const topologyCompatible = chargeCompatible.filter((record) => record.topologyStructuralKey === topologyKey);
  if (topologyCompatible.length > 1) {
    const result = baseResult(input, "AMBIGUOUS", topologyCompatible, ["Multiple references share the same charge-insensitive topology; formal-charge/radical information is insufficient to select one safely."]);
    result.matchedDimensions = ["MOLECULAR_FORMULA", "ATOM_CONNECTIVITY", "BOND_ORDER", "NET_CHARGE", "AROMATICITY"];
    result.unresolvedDimensions = ["FORMAL_CHARGE", "RADICAL_STATE"];
    return result;
  }
  if (topologyCompatible.length === 1) {
    const result = baseResult(input, "POSSIBLE_REFERENCE_MATCH", topologyCompatible, ["Formula, net charge, connectivity and bond order match a loaded reference, but atom-level formal-charge/radical representation does not. No reference properties are attached until an exact match is established."]);
    result.matchedDimensions = ["MOLECULAR_FORMULA", "ATOM_CONNECTIVITY", "BOND_ORDER", "NET_CHARGE", "AROMATICITY"];
    result.unresolvedDimensions = ["FORMAL_CHARGE", "RADICAL_STATE"];
    result.provenanceSourceIds = topologyCompatible[0]!.identitySourceIds;
    return result;
  }

  return baseResult(input, "NO_REFERENCE_MATCH", chargeCompatible, ["Formula and net charge overlap a loaded reference bucket, but represented connectivity/bonding does not match any loaded reference structure."]);
}

export function validateKnownSpeciesReferenceRecords(
  records: readonly KnownSpeciesReferenceRecord[] = knownSpeciesReferenceRecords,
  sources: readonly SourceRecord[] = scientificReferenceSources,
): readonly ReferenceIndexValidationIssue[] {
  const issues: ReferenceIndexValidationIssue[] = [];
  const sourceIds = new Set(sources.map((source) => source.id));
  const referenceIds = new Set<string>();
  const externalIds = new Set<string>();
  const structures = new Set<string>();

  for (const record of records) {
    if (referenceIds.has(record.referenceSpeciesId)) {
      issues.push({ code: "DUPLICATE_REFERENCE_ID", referenceSpeciesId: record.referenceSpeciesId, message: `Duplicate referenceSpeciesId: ${record.referenceSpeciesId}` });
    }
    referenceIds.add(record.referenceSpeciesId);

    for (const sourceId of record.identitySourceIds) {
      if (!sourceIds.has(sourceId)) {
        issues.push({ code: "UNKNOWN_IDENTITY_SOURCE", referenceSpeciesId: record.referenceSpeciesId, message: `Unknown identity source: ${sourceId}` });
      }
    }

    const external = record.externalIdentifiers.pubChemCid !== undefined
      ? `pubchem:${record.externalIdentifiers.pubChemCid}`
      : record.externalIdentifiers.inchiKey
        ? `inchikey:${record.externalIdentifiers.inchiKey}`
        : undefined;
    if (external) {
      if (externalIds.has(external)) issues.push({ code: "DUPLICATE_EXTERNAL_ID", referenceSpeciesId: record.referenceSpeciesId, message: `Duplicate external identity: ${external}` });
      externalIds.add(external);
    }

    try {
      const graphFormula = deriveFormula(record.referenceGraph);
      const graphCharge = deriveNetCharge(record.referenceGraph);
      if (!sameFormula(record.molecularFormula, graphFormula)) {
        issues.push({ code: "FORMULA_GRAPH_MISMATCH", referenceSpeciesId: record.referenceSpeciesId, message: "Reference formula does not agree with the reference graph." });
      }
      if (record.netCharge !== graphCharge) {
        issues.push({ code: "NET_CHARGE_GRAPH_MISMATCH", referenceSpeciesId: record.referenceSpeciesId, message: "Reference net charge does not agree with the reference graph." });
      }
      const structuralIdentity = `${formulaKey(record.molecularFormula)}|q:${record.netCharge}|${referenceStructuralKey(record.referenceGraph, false)}`;
      if (structures.has(structuralIdentity)) {
        issues.push({ code: "DUPLICATE_REFERENCE_STRUCTURE", referenceSpeciesId: record.referenceSpeciesId, message: "Duplicate exact represented reference structure." });
      }
      structures.add(structuralIdentity);
    } catch (error) {
      issues.push({ code: "INVALID_REFERENCE_GRAPH", referenceSpeciesId: record.referenceSpeciesId, message: error instanceof Error ? error.message : "Invalid reference graph." });
    }
  }

  return issues;
}

export function getKnownReferenceById(referenceSpeciesId: string): KnownSpeciesReferenceRecord | undefined {
  return knownSpeciesReferenceIndex.records.find((record) => record.referenceSpeciesId === referenceSpeciesId);
}

export function getKnownReferencesByFormula(formula: ScientificMatchFormula): readonly KnownSpeciesReferenceRecord[] {
  return knownSpeciesReferenceIndex.byFormula.get(formulaKey(formula)) ?? [];
}
