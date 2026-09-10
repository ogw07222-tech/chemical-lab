export type AtomicNumber = number;
export type ElementSymbol = string;
export type AtomId = string;
export type BondId = string;
export type SpeciesId = string;

export type ScientificStatus =
  | "VERIFIED"
  | "APPROXIMATED"
  | "EMPIRICAL"
  | "GAMEPLAY_SIMPLIFICATION"
  | "OPEN";

export interface ElementDefinition {
  atomicNumber: AtomicNumber;
  symbol: ElementSymbol;
  atomicMolarMassKgPerMol: number;
  valenceElectrons: number;
  commonOxidationStates: readonly number[];
  electronegativity?: number;
  typicalValences: readonly number[];
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ElementProvider {
  getElement(symbol: ElementSymbol): ElementDefinition | undefined;
}

export interface AtomNode {
  id: AtomId;
  element: ElementSymbol;
  formalCharge: number;
  oxidationState?: number;
  radicalElectrons?: number;
  metadata?: Readonly<Record<string, unknown>>;
}

export type BondKind = "covalent" | "aromatic" | "ionic" | "coordination" | "other";

export interface BondEdge {
  id: BondId;
  a: AtomId;
  b: AtomId;
  kind: BondKind;
  order: number;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface MolecularGraph {
  atoms: readonly AtomNode[];
  bonds: readonly BondEdge[];
}

export type MolecularFormula = Readonly<Record<ElementSymbol, number>>;

export interface MoleculeRecord {
  graph: MolecularGraph;
  formula: MolecularFormula;
  netCharge: number;
  canonicalKey: string;
}

export type PhaseKind =
  | "gas"
  | "liquid"
  | "solid"
  | "aqueous"
  | "supercritical"
  | "plasma"
  | "multiphase"
  | "unknown";

export interface PhaseStateRef {
  phase: PhaseKind;
  source: string;
  phaseStateId: string;
  modelVersion?: string;
  confidence?: number;
  scientificStatus: ScientificStatus;
}

export interface SpeciesState {
  id: SpeciesId;
  molecule: MoleculeRecord;
  amountMol: number;
  phaseState: PhaseStateRef;
  concentrationMolPerM3?: number;
  activityHint?: number;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface ValidationIssue {
  code: string;
  message: string;
  atomId?: AtomId;
  bondId?: BondId;
}

export interface ValidationResult {
  valid: boolean;
  issues: readonly ValidationIssue[];
}

export interface ConservationVector {
  elements: Readonly<Record<ElementSymbol, number>>;
  atomCount: number;
  netCharge: number;
  explicitElectronCount?: number;
}

export interface ConservationDelta {
  elementDelta: Readonly<Record<ElementSymbol, number>>;
  atomCountDelta: number;
  netChargeDelta: number;
  explicitElectronDelta?: number;
}
