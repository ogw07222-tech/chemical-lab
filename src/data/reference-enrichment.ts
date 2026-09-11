import {
  minimumBondEnergies,
  minimumChemistryDataBundle,
  minimumElementRecords,
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

/** 03-owned compatibility shape; this is not the 01 canonical-registry identity type. */
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
  /** Opaque 01 identity for traceability only. 03 never interprets it. */
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

export interface PreparedReferenceRecord extends KnownSpeciesReferenceRecord {
  formulaKey: string;
  exactStructuralKey: string;
  topologyStructuralKey: string;
}

export interface ReferenceSpeciesIndex {
  records: readonly PreparedReferenceRecord[];
  byFormula: ReadonlyMap<string, readonly PreparedReferenceRecord[]>;
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
    retrievedOrTableContext: "CID, formula, common identity metadata and InChIKey for seed species",
  },
  {
    id: "reference-molar-mass-derivation-v1",
    title: "Generated-species molar-mass projection",
    publisherOrAuthors: "chemical-lab Chemistry Data layer",
    sourceType: "INTERNAL_DERIVATION",
    citation: "Sum of Phase 2C element molar-mass projections by molecular formula",
    databaseName: "chemical-lab internal derivation",
    databaseVersion: REFERENCE_FINGERPRINT_VERSION,
    accessedDate: LAST_VERIFIED_DATE,
    retrievedOrTableContext: "Uses existing CIAAW-anchored H/C/N/O molar-mass projections; not isotope-specific exact mass",
  },
];

function graph(
  atoms: readonly [id: string, element: string, formalCharge?: number, radicalElectrons?: number][],
  bonds: readonly [a: string, b: string, order: number, kind?: ScientificMatchBond["kind"]][],
): ScientificMatchGraph {
  return {
    atoms: atoms.map(([id, element, formalCharge = 0, radicalElectrons]) => ({ id, element, formalCharge, radicalElectrons })),
    bonds: bonds.map(([a, b, order, kind = "covalent"], index) => ({ id: `r${index + 1}`, a, b, order, kind })),
  };
}

export const knownSpeciesReferenceRecords: readonly KnownSpeciesReferenceRecord[] = [
  {
    referenceSpeciesId: "ref:pubchem:783", dataSpeciesId: "H2", commonName: "Hydrogen", canonicalFormula: "H2",
    molecularFormula: { H: 2 }, netCharge: 0,
    referenceGraph: graph([["h1", "H"], ["h2", "H"]], [["h1", "h2", 1]]),
    externalIdentifiers: { pubChemCid: 783, inchiKey: "UFHFLCQGNIYNRP-UHFFFAOYSA-N", casRegistryNumber: "1333-74-0" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"], dataQuality: "EVALUATED", confidence: "HIGH", scientificStatus: "VERIFIED",
  },
  {
    referenceSpeciesId: "ref:pubchem:977", dataSpeciesId: "O2", commonName: "Oxygen", canonicalFormula: "O2",
    molecularFormula: { O: 2 }, netCharge: 0,
    referenceGraph: graph([["o1", "O"], ["o2", "O"]], [["o1", "o2", 2]]),
    externalIdentifiers: { pubChemCid: 977, inchiKey: "MYMOFIZGZYHOMD-UHFFFAOYSA-N", casRegistryNumber: "7782-44-7" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"], dataQuality: "EVALUATED", confidence: "HIGH", scientificStatus: "VERIFIED",
    unresolvedStructuralDimensions: ["ELECTRONIC_STATE"],
    notes: ["The current 2D graph identity does not resolve molecular-oxygen electronic/spin state; this is not a state-resolved spectroscopy identity."],
  },
  {
    referenceSpeciesId: "ref:pubchem:947", dataSpeciesId: "N2", commonName: "Nitrogen", canonicalFormula: "N2",
    molecularFormula: { N: 2 }, netCharge: 0,
    referenceGraph: graph([["n1", "N"], ["n2", "N"]], [["n1", "n2", 3]]),
    externalIdentifiers: { pubChemCid: 947, inchiKey: "IJGRMHOSHXDMSA-UHFFFAOYSA-N", casRegistryNumber: "7727-37-9" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"], dataQuality: "EVALUATED", confidence: "HIGH", scientificStatus: "VERIFIED",
  },
  {
    referenceSpeciesId: "ref:pubchem:962", dataSpeciesId: "H2O", commonName: "Water", canonicalFormula: "H2O",
    molecularFormula: { H: 2, O: 1 }, netCharge: 0,
    referenceGraph: graph([["o", "O"], ["h1", "H"], ["h2", "H"]], [["o", "h1", 1], ["o", "h2", 1]]),
    externalIdentifiers: { pubChemCid: 962, inchiKey: "XLYOFNOQVPJJNP-UHFFFAOYSA-N", casRegistryNumber: "7732-18-5" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"], dataQuality: "EVALUATED", confidence: "HIGH", scientificStatus: "VERIFIED",
  },
  {
    referenceSpeciesId: "ref:pubchem:281", dataSpeciesId: "CO", commonName: "Carbon monoxide", canonicalFormula: "CO",
    molecularFormula: { C: 1, O: 1 }, netCharge: 0,
    referenceGraph: graph([["c", "C", -1], ["o", "O", 1]], [["c", "o", 3]]),
    externalIdentifiers: { pubChemCid: 281, inchiKey: "UGFAIRIUMAVXCW-UHFFFAOYSA-N", casRegistryNumber: "630-08-0" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"], dataQuality: "EVALUATED", confidence: "HIGH", scientificStatus: "VERIFIED",
    notes: ["PubChem represents carbon monoxide as [C-]#[O+]. A neutral-formal-charge C#O graph is a possible, not exact, charge-aware match."],
  },
  {
    referenceSpeciesId: "ref:pubchem:280", dataSpeciesId: "CO2", commonName: "Carbon dioxide", canonicalFormula: "CO2",
    molecularFormula: { C: 1, O: 2 }, netCharge: 0,
    referenceGraph: graph([["c", "C"], ["o1", "O"], ["o2", "O"]], [["c", "o1", 2], ["c", "o2", 2]]),
    externalIdentifiers: { pubChemCid: 280, inchiKey: "CURLTUGMZLYLDI-UHFFFAOYSA-N", casRegistryNumber: "124-38-9" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"], dataQuality: "EVALUATED", confidence: "HIGH", scientificStatus: "VERIFIED",
  },
  {
    referenceSpeciesId: "ref:pubchem:297", dataSpeciesId: "CH4", commonName: "Methane", canonicalFormula: "CH4",
    molecularFormula: { C: 1, H: 4 }, netCharge: 0,
    referenceGraph: graph(
      [["c", "C"], ["h1", "H"], ["h2", "H"], ["h3", "H"], ["h4", "H"]],
      [["c", "h1", 1], ["c", "h2", 1], ["c", "h3", 1], ["c", "h4", 1]],
    ),
    externalIdentifiers: { pubChemCid: 297, inchiKey: "VNWKTOKETHGBQD-UHFFFAOYSA-N", casRegistryNumber: "74-82-8" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"], dataQuality: "EVALUATED", confidence: "HIGH", scientificStatus: "VERIFIED",
  },
  {
    referenceSpeciesId: "ref:pubchem:222", dataSpeciesId: "NH3", commonName: "Ammonia", canonicalFormula: "NH3",
    molecularFormula: { H: 3, N: 1 }, netCharge: 0,
    referenceGraph: graph(
      [["n", "N"], ["h1", "H"], ["h2", "H"], ["h3", "H"]],
      [["n", "h1", 1], ["n", "h2", 1], ["n", "h3", 1]],
    ),
    externalIdentifiers: { pubChemCid: 222, inchiKey: "QGZKDVFQNNGYKY-UHFFFAOYSA-N", casRegistryNumber: "7664-41-7" },
    identitySourceIds: ["pubchem-compound-identity-2026-09"], dataQuality: "EVALUATED", confidence: "HIGH", scientificStatus: "VERIFIED",
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
  for (const atom of graphValue.atoms) counts[atom.element] = (counts[atom.element] ?? 0) + 1;
  return Object.freeze(Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))));
}

function deriveNetCharge(graphValue: ScientificMatchGraph): number {
  return graphValue.atoms.reduce((sum, atom) => sum + atom.formalCharge, 0);
}

function atomInvariant(atom: ScientificMatchAtom, ignoreChargeAndRadicals: boolean): string {
  return ignoreChargeAndRadicals ? atom.element : [atom.element, atom.formalCharge, atom.radicalElectrons ?? 0].join("|");
}

function bondInvariant(bond: ScientificMatchBond): string {
  return `${bond.kind}:${bond.order}`;
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

/** 03-only reference fingerprint; never expose this as an 01 registry identity. */
function referenceStructuralKey(graphValue: ScientificMatchGraph, ignoreChargeAndRadicals: boolean): string {
  const atomIds = new Set(graphValue.atoms.map((atom) => atom.id));
  if (atomIds.size !== graphValue.atoms.length) throw new Error("Duplicate atom ids in scientific match graph.");
  const adjacency = new Map<string, Array<{ neighbor: string; bond: ScientificMatchBond }>>(
    graphValue.atoms.map((atom) => [atom.id, []]),
  );
  for (const bond of graphValue.bonds) {
    if (!atomIds.has(bond.a) || !atomIds.has(bond.b) || bond.a === bond.b) throw new Error("Invalid bond endpoint in scientific match graph.");
    if (!Number.isFinite(bond.order) || bond.order <= 0) throw new Error("Invalid bond order in scientific match graph.");
    adjacency.get(bond.a)!.push({ neighbor: bond.b, bond });
    adjacency.get(bond.b)!.push({ neighbor: bond.a, bond });
  }

  let colors = new Map(graphValue.atoms.map((atom) => [atom.id, atomInvariant(atom, ignoreChargeAndRadicals)]));
  for (let round = 0; round < graphValue.atoms.length; round += 1) {
    const signatures = new Map<string, string>();
    for (const atom of graphValue.atoms) {
      const neighborhood = adjacency.get(atom.id)!
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

  let candidateOrders: string[][] = [[]];
  for (const group of orderedGroups) {
    const next: string[][] = [];
    for (const prefix of candidateOrders) for (const variant of permutations(group)) next.push([...prefix, ...variant]);
    candidateOrders = next;
  }

  const atomById = new Map(graphValue.atoms.map((atom) => [atom.id, atom]));
  let best: string | undefined;
  for (const order of candidateOrders) {
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
  const buckets = new Map<string, PreparedReferenceRecord[]>();
  for (const record of prepared) {
    const bucket = buckets.get(record.formulaKey) ?? [];
    bucket.push(record);
    buckets.set(record.formulaKey, bucket);
  }
  return {
    records: prepared,
    byFormula: new Map([...buckets.entries()].map(([key, bucket]) => [key, Object.freeze([...bucket])] as const)),
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
    const record = minimumElementRecords.find((entry) => entry.element.symbol === symbol);
    const value = record?.element.molarMass?.normalizedValue;
    if (typeof value !== "number" || !Number.isFinite(count) || count < 0) return null;
    total += value * count;
  }
  return {
    normalizedValue: total,
    normalizedUnit: "kg/mol",
    sourceMeasurements: [{
      sourceId: "reference-molar-mass-derivation-v1",
      sourceValue: total,
      sourceUnit: "kg/mol",
      conversionMethod: "sum(element molar-mass projection × atom count)",
      conversionVersion: REFERENCE_FINGERPRINT_VERSION,
    }],
    referenceConditions: { qualifier: "natural terrestrial isotopic-composition projection inherited from Phase 2C element data" },
    uncertainty: { kind: "not_reported" },
    dataQuality: "EVALUATED",
    confidence: "HIGH",
    status: "APPROXIMATED",
    lastVerifiedDate: LAST_VERIFIED_DATE,
    notes: "Derived from CIAAW-anchored element molar-mass projections; not an isotope-specific exact molecular mass.",
  };
}

function createEnrichment(reference: PreparedReferenceRecord): ScientificPropertyEnrichment {
  const id = reference.dataSpeciesId;
  const thermodynamics = minimumThermodynamics.filter((record) => record.speciesId === id);
  const phaseEquilibrium = minimumPhaseEquilibrium.find((record) => record.speciesId === id) ?? null;
  const bondReferences = minimumBondEnergies.filter((record) => record.speciesId === id);
  const acidBase = (minimumChemistryDataBundle.acidBase ?? []).filter((record) => record.acidSpeciesId === id || record.conjugateBaseSpeciesId === id);
  const redox = (minimumChemistryDataBundle.redox ?? []).filter((record) => record.oxidizedSpeciesIds.includes(id) || record.reducedSpeciesIds.includes(id));
  const solubility = (minimumChemistryDataBundle.solubility ?? []).filter((record) => record.speciesId === id);
  const molarMass = deriveMolarMass(reference.molecularFormula);

  const formation = thermodynamics.flatMap((record) => record.standardEnthalpyOfFormation ? [record.standardEnthalpyOfFormation.status] : []);
  const entropy = thermodynamics.flatMap((record) => record.standardMolarEntropy ? [record.standardMolarEntropy.status] : []);
  const gibbs = thermodynamics.flatMap((record) => record.standardGibbsEnergyOfFormation ? [record.standardGibbsEnergyOfFormation.status] : []);
  const cp = thermodynamics.flatMap((record) => [record.molarHeatCapacity?.status, record.heatCapacityCorrelation?.status].filter((status): status is ScientificStatus => status !== undefined));

  const provenance = new Set<string>(reference.identitySourceIds);
  if (molarMass) provenance.add("reference-molar-mass-derivation-v1");
  for (const record of thermodynamics) {
    for (const property of [record.standardEnthalpyOfFormation, record.standardMolarEntropy, record.standardGibbsEnergyOfFormation, record.molarHeatCapacity]) {
      for (const measurement of property?.sourceMeasurements ?? []) provenance.add(measurement.sourceId);
    }
    for (const sourceId of record.heatCapacityCorrelation?.sourceIds ?? []) provenance.add(sourceId);
  }
  for (const record of bondReferences) for (const measurement of record.sourceMeasurements) provenance.add(measurement.sourceId);
  for (const property of [phaseEquilibrium?.meltingPoint, phaseEquilibrium?.boilingPoint]) {
    for (const measurement of property?.sourceMeasurements ?? []) provenance.add(measurement.sourceId);
  }

  return {
    dataSpeciesId: id,
    molarMass,
    thermodynamics,
    phaseEquilibrium,
    bondReferences,
    acidBase,
    redox,
    solubility,
    availability: {
      molarMass: molarMass?.status ?? "OPEN",
      standardEnthalpyOfFormation: summarizeStatus(formation),
      standardMolarEntropy: summarizeStatus(entropy),
      standardGibbsEnergyOfFormation: summarizeStatus(gibbs),
      heatCapacity: summarizeStatus(cp),
      meltingPoint: phaseEquilibrium?.meltingPoint?.status ?? "OPEN",
      boilingPoint: phaseEquilibrium?.boilingPoint?.status ?? "OPEN",
      acidBase: acidBase.length > 0 ? summarizeStatus(acidBase.flatMap((record) => [record.pKa?.status, record.protonAffinity?.status, record.classification?.status].filter((status): status is ScientificStatus => status !== undefined))) : "OPEN",
      redox: redox.length > 0 ? summarizeStatus(redox.flatMap((record) => record.standardElectrodePotential ? [record.standardElectrodePotential.status] : [])) : "OPEN",
      solubility: solubility.length > 0 ? summarizeStatus(solubility.flatMap((record) => [record.solubility?.status, record.ksp?.status].filter((status): status is ScientificStatus => status !== undefined))) : "OPEN",
    },
    provenanceSourceIds: [...provenance].sort(),
  };
}

function baseResult(
  input: ScientificMatchInput,
  status: ReferenceMatchStatus,
  candidates: readonly PreparedReferenceRecord[],
  notes: readonly string[],
): ScientificReferenceMatch {
  return {
    internalCanonicalKey: input.canonicalKey,
    referenceMatchStatus: status,
    candidateReferenceSpeciesIds: candidates.map((candidate) => candidate.referenceSpeciesId),
    scientificStatus: status === "EXACT_REFERENCE_MATCH" ? "VERIFIED" : status === "POSSIBLE_REFERENCE_MATCH" ? "APPROXIMATED" : "OPEN",
    confidence: status === "EXACT_REFERENCE_MATCH" ? "HIGH" : status === "POSSIBLE_REFERENCE_MATCH" ? "MEDIUM" : "UNASSESSED",
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
    return baseResult(input, "NO_REFERENCE_MATCH", [], ["No record exists in the loaded reference index for this formula. This is not evidence that the species cannot exist."]);
  }

  const chargeCompatible = bucket.filter((record) => record.netCharge === input.netCharge);
  if (chargeCompatible.length === 0) {
    return baseResult(input, "NO_REFERENCE_MATCH", [], ["Formula bucket exists, but no loaded reference record has the same net charge."]);
  }

  if (!input.molecularGraph) {
    const result = baseResult(input, "INSUFFICIENT_STRUCTURE_INFORMATION", chargeCompatible, ["Formula and net charge alone cannot establish structure-level identity."]);
    result.unresolvedDimensions = ["ATOM_CONNECTIVITY", "BOND_ORDER", "FORMAL_CHARGE", "AROMATICITY", "RADICAL_STATE", "STEREOCHEMISTRY"];
    return result;
  }

  if (!sameFormula(input.molecularFormula, deriveFormula(input.molecularGraph)) || input.netCharge !== deriveNetCharge(input.molecularGraph)) {
    const result = baseResult(input, "INSUFFICIENT_STRUCTURE_INFORMATION", chargeCompatible, ["Supplied formula/net charge is inconsistent with the supplied graph."]);
    result.unresolvedDimensions = ["MOLECULAR_FORMULA", "NET_CHARGE"];
    return result;
  }

  let exactKey: string;
  let topologyKey: string;
  try {
    exactKey = referenceStructuralKey(input.molecularGraph, false);
    topologyKey = referenceStructuralKey(input.molecularGraph, true);
  } catch (error) {
    const result = baseResult(input, "INSUFFICIENT_STRUCTURE_INFORMATION", chargeCompatible, [error instanceof Error ? error.message : "Unable to fingerprint graph."]);
    result.unresolvedDimensions = ["ATOM_CONNECTIVITY", "BOND_ORDER"];
    return result;
  }

  const exact = chargeCompatible.filter((record) => record.exactStructuralKey === exactKey);
  if (exact.length > 1) {
    const result = baseResult(input, "AMBIGUOUS", exact, ["Multiple scientific reference records share the same represented exact structure."]);
    result.matchedDimensions = ["MOLECULAR_FORMULA", "ATOM_CONNECTIVITY", "BOND_ORDER", "FORMAL_CHARGE", "NET_CHARGE", "AROMATICITY", "RADICAL_STATE"];
    return result;
  }

  if (exact.length === 1) {
    const reference = exact[0]!;
    const unresolved = reference.unresolvedStructuralDimensions ?? [];
    if (unresolved.includes("STEREOCHEMISTRY")) {
      const result = baseResult(input, "INSUFFICIENT_STRUCTURE_INFORMATION", exact, ["Represented graph matches, but stereochemical identity is unresolved by the current graph contract."]);
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
    const result = baseResult(input, "AMBIGUOUS", topologyCompatible, ["Multiple references share this charge-insensitive topology; atom-level charge/radical information cannot select one safely."]);
    result.matchedDimensions = ["MOLECULAR_FORMULA", "ATOM_CONNECTIVITY", "BOND_ORDER", "NET_CHARGE", "AROMATICITY"];
    result.unresolvedDimensions = ["FORMAL_CHARGE", "RADICAL_STATE"];
    return result;
  }
  if (topologyCompatible.length === 1) {
    const result = baseResult(input, "POSSIBLE_REFERENCE_MATCH", topologyCompatible, ["Formula, net charge, connectivity and bond order match one reference, but atom-level charge/radical representation does not. No known-compound properties are attached."]);
    result.matchedDimensions = ["MOLECULAR_FORMULA", "ATOM_CONNECTIVITY", "BOND_ORDER", "NET_CHARGE", "AROMATICITY"];
    result.unresolvedDimensions = ["FORMAL_CHARGE", "RADICAL_STATE"];
    result.provenanceSourceIds = topologyCompatible[0]!.identitySourceIds;
    return result;
  }

  return baseResult(input, "NO_REFERENCE_MATCH", chargeCompatible, ["Formula and net charge overlap the loaded reference bucket, but represented connectivity/bonding does not match a loaded reference structure."]);
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
      if (!sourceIds.has(sourceId)) issues.push({ code: "UNKNOWN_IDENTITY_SOURCE", referenceSpeciesId: record.referenceSpeciesId, message: `Unknown identity source: ${sourceId}` });
    }

    const external = record.externalIdentifiers.pubChemCid !== undefined
      ? `pubchem:${record.externalIdentifiers.pubChemCid}`
      : record.externalIdentifiers.inchiKey ? `inchikey:${record.externalIdentifiers.inchiKey}` : undefined;
    if (external) {
      if (externalIds.has(external)) issues.push({ code: "DUPLICATE_EXTERNAL_ID", referenceSpeciesId: record.referenceSpeciesId, message: `Duplicate external identity: ${external}` });
      externalIds.add(external);
    }

    try {
      if (!sameFormula(record.molecularFormula, deriveFormula(record.referenceGraph))) {
        issues.push({ code: "FORMULA_GRAPH_MISMATCH", referenceSpeciesId: record.referenceSpeciesId, message: "Reference formula does not agree with reference graph." });
      }
      if (record.netCharge !== deriveNetCharge(record.referenceGraph)) {
        issues.push({ code: "NET_CHARGE_GRAPH_MISMATCH", referenceSpeciesId: record.referenceSpeciesId, message: "Reference net charge does not agree with reference graph." });
      }
      const identity = `${formulaKey(record.molecularFormula)}|q:${record.netCharge}|${referenceStructuralKey(record.referenceGraph, false)}`;
      if (structures.has(identity)) issues.push({ code: "DUPLICATE_REFERENCE_STRUCTURE", referenceSpeciesId: record.referenceSpeciesId, message: "Duplicate exact represented reference structure." });
      structures.add(identity);
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
