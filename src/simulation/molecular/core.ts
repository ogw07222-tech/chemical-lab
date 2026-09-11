import type {
  AtomNode,
  BondEdge,
  ConservationDelta,
  ConservationVector,
  ElementDefinition,
  ElementProvider,
  ElementSymbol,
  MolecularFormula,
  MolecularGraph,
  MoleculeRecord,
  SpeciesState,
  ValidationIssue,
  ValidationResult,
} from "./types";

const ALLOWED_BOND_KINDS = new Set(["covalent", "aromatic", "ionic", "coordination", "other"] as const);
const MAX_CANONICAL_SEARCH_STATES = 20_000;

export function deriveFormula(graph: MolecularGraph): MolecularFormula {
  const counts: Record<ElementSymbol, number> = Object.create(null) as Record<ElementSymbol, number>;
  for (const atom of graph.atoms) {
    counts[atom.element] = (counts[atom.element] ?? 0) + 1;
  }
  return Object.freeze(Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))));
}

export function deriveNetCharge(graph: MolecularGraph): number {
  return graph.atoms.reduce((sum, atom) => sum + atom.formalCharge, 0);
}

export function validateElementDefinition(element: ElementDefinition): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!Number.isInteger(element.atomicNumber) || element.atomicNumber <= 0) {
    issues.push({ code: "INVALID_ATOMIC_NUMBER", message: "atomicNumber must be a positive integer." });
  }
  if (!element.symbol) {
    issues.push({ code: "INVALID_ELEMENT_SYMBOL", message: "symbol must be non-empty." });
  }
  if (!Number.isFinite(element.atomicMolarMassKgPerMol) || element.atomicMolarMassKgPerMol <= 0) {
    issues.push({ code: "INVALID_MOLAR_MASS", message: "atomicMolarMassKgPerMol must be finite and positive." });
  }
  if (!Number.isInteger(element.valenceElectrons) || element.valenceElectrons < 0) {
    issues.push({ code: "INVALID_VALENCE_ELECTRONS", message: "valenceElectrons must be a non-negative integer." });
  }
  if (element.commonOxidationStates.some((value) => !Number.isInteger(value))) {
    issues.push({ code: "INVALID_OXIDATION_STATE", message: "commonOxidationStates must contain integers." });
  }
  if (element.typicalValences.some((value) => !Number.isInteger(value) || value < 0)) {
    issues.push({ code: "INVALID_TYPICAL_VALENCE", message: "typicalValences must contain non-negative integers." });
  }
  if (element.electronegativity !== undefined && !Number.isFinite(element.electronegativity)) {
    issues.push({ code: "INVALID_ELECTRONEGATIVITY", message: "electronegativity must be finite when provided." });
  }
  return { valid: issues.length === 0, issues };
}

export function validateGraph(graph: MolecularGraph, elements: ElementProvider): ValidationResult {
  const issues: ValidationIssue[] = [];
  const atomIds = new Set<string>();

  for (const atom of graph.atoms) {
    if (!atom.id) {
      issues.push({ code: "EMPTY_ATOM_ID", message: "Atom id must be non-empty." });
    }
    if (atomIds.has(atom.id)) {
      issues.push({ code: "DUPLICATE_ATOM_ID", message: `Duplicate atom id: ${atom.id}`, atomId: atom.id });
    }
    atomIds.add(atom.id);
    if (!elements.getElement(atom.element)) {
      issues.push({ code: "UNKNOWN_ELEMENT", message: `Unknown element: ${atom.element}`, atomId: atom.id });
    }
    if (!Number.isInteger(atom.formalCharge)) {
      issues.push({ code: "INVALID_FORMAL_CHARGE", message: "Formal charge must be an integer.", atomId: atom.id });
    }
    if (atom.radicalElectrons !== undefined && (!Number.isInteger(atom.radicalElectrons) || atom.radicalElectrons < 0)) {
      issues.push({
        code: "INVALID_RADICAL_ELECTRONS",
        message: "Radical electron count must be a non-negative integer.",
        atomId: atom.id,
      });
    }
  }

  const bondIds = new Set<string>();
  const semanticEdges = new Set<string>();
  for (const bond of graph.bonds) {
    if (!bond.id) {
      issues.push({ code: "EMPTY_BOND_ID", message: "Bond id must be non-empty." });
    }
    if (bondIds.has(bond.id)) {
      issues.push({ code: "DUPLICATE_BOND_ID", message: `Duplicate bond id: ${bond.id}`, bondId: bond.id });
    }
    bondIds.add(bond.id);
    if (!atomIds.has(bond.a) || !atomIds.has(bond.b)) {
      issues.push({ code: "INVALID_BOND_ENDPOINT", message: `Bond ${bond.id} references a missing atom.`, bondId: bond.id });
    }
    if (bond.a === bond.b) {
      issues.push({ code: "SELF_BOND", message: `Bond ${bond.id} is a self bond.`, bondId: bond.id });
    }
    if (!ALLOWED_BOND_KINDS.has(bond.kind)) {
      issues.push({ code: "INVALID_BOND_KIND", message: `Unsupported bond kind: ${bond.kind}`, bondId: bond.id });
    }
    if (!Number.isFinite(bond.order) || bond.order <= 0) {
      issues.push({ code: "INVALID_BOND_ORDER", message: "Bond order must be finite and positive.", bondId: bond.id });
    }

    const [x, y] = bond.a < bond.b ? [bond.a, bond.b] : [bond.b, bond.a];
    const edgeKey = `${x}\u0000${y}\u0000${bond.kind}`;
    if (semanticEdges.has(edgeKey)) {
      issues.push({
        code: "DUPLICATE_SEMANTIC_BOND",
        message: `Duplicate semantic bond between ${x} and ${y}.`,
        bondId: bond.id,
      });
    }
    semanticEdges.add(edgeKey);
  }

  return { valid: issues.length === 0, issues };
}

function atomInvariant(atom: AtomNode): string {
  return [atom.element, atom.formalCharge, atom.radicalElectrons ?? 0, atom.oxidationState ?? ""].join("|");
}

function bondInvariant(bond: BondEdge): string {
  return `${bond.kind}:${bond.order}`;
}

function buildAdjacency(graph: MolecularGraph): Map<string, Array<{ neighbor: string; bond: BondEdge }>> {
  const adjacency = new Map<string, Array<{ neighbor: string; bond: BondEdge }>>();
  for (const atom of graph.atoms) {
    adjacency.set(atom.id, []);
  }
  for (const bond of graph.bonds) {
    adjacency.get(bond.a)?.push({ neighbor: bond.b, bond });
    adjacency.get(bond.b)?.push({ neighbor: bond.a, bond });
  }
  return adjacency;
}

function refineColors(graph: MolecularGraph): Map<string, string> {
  const adjacency = buildAdjacency(graph);
  let colors = new Map(graph.atoms.map((atom) => [atom.id, atomInvariant(atom)]));

  for (let round = 0; round < graph.atoms.length; round += 1) {
    const signatures = new Map<string, string>();
    for (const atom of graph.atoms) {
      const neighborhood = (adjacency.get(atom.id) ?? [])
        .map(({ neighbor, bond }) => `${bondInvariant(bond)}>${colors.get(neighbor) ?? ""}`)
        .sort()
        .join(",");
      signatures.set(atom.id, `${colors.get(atom.id)}[${neighborhood}]`);
    }

    const unique = [...new Set(signatures.values())].sort();
    const rank = new Map(unique.map((value, index) => [value, String(index)]));
    const next = new Map<string, string>();
    for (const atom of graph.atoms) {
      next.set(atom.id, rank.get(signatures.get(atom.id) ?? "") ?? "");
    }
    if (graph.atoms.every((atom) => next.get(atom.id) === colors.get(atom.id))) {
      return next;
    }
    colors = next;
  }

  return colors;
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) {
    return [Array.from(items)];
  }
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += 1) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const suffix of permutations(rest)) {
      result.push([items[i]!, ...suffix]);
    }
  }
  return result;
}

function encodeOrder(graph: MolecularGraph, orderedIds: readonly string[]): string {
  const index = new Map(orderedIds.map((id, i) => [id, i]));
  const atomById = new Map(graph.atoms.map((atom) => [atom.id, atom]));
  const atomPart = orderedIds.map((id) => atomInvariant(atomById.get(id)!)).join(";");
  const bondPart = graph.bonds
    .map((bond) => {
      const a = index.get(bond.a)!;
      const b = index.get(bond.b)!;
      const [x, y] = a < b ? [a, b] : [b, a];
      return `${x}-${y}:${bondInvariant(bond)}`;
    })
    .sort()
    .join(";");
  return `${atomPart}||${bondPart}`;
}

export function canonicalStructuralRepresentation(graph: MolecularGraph): string {
  if (graph.atoms.length === 0) {
    return "atoms:||bonds:";
  }

  const colors = refineColors(graph);
  const groups = new Map<string, string[]>();
  for (const atom of graph.atoms) {
    const color = colors.get(atom.id) ?? "";
    const group = groups.get(color) ?? [];
    group.push(atom.id);
    groups.set(color, group);
  }

  const orderedGroups = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, ids]) => ids);

  let stateCount = 1;
  for (const group of orderedGroups) {
    for (let n = 2; n <= group.length; n += 1) {
      stateCount *= n;
    }
    if (stateCount > MAX_CANONICAL_SEARCH_STATES) {
      throw new Error(`Canonical search budget exceeded (${MAX_CANONICAL_SEARCH_STATES} states).`);
    }
  }

  let candidates: string[][] = [[]];
  for (const group of orderedGroups) {
    const variants = permutations(group);
    const next: string[][] = [];
    for (const prefix of candidates) {
      for (const variant of variants) {
        next.push([...prefix, ...variant]);
      }
    }
    candidates = next;
  }

  let best: string | undefined;
  for (const order of candidates) {
    const encoded = encodeOrder(graph, order);
    if (best === undefined || encoded < best) {
      best = encoded;
    }
  }
  return best ?? "";
}

function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

export function validateMoleculeRecord(molecule: MoleculeRecord, elements: ElementProvider): ValidationResult {
  const issues: ValidationIssue[] = [...validateGraph(molecule.graph, elements).issues];
  const expectedFormula = JSON.stringify(deriveFormula(molecule.graph));
  if (JSON.stringify(molecule.formula) !== expectedFormula) {
    issues.push({ code: "FORMULA_MISMATCH", message: "Stored formula does not match graph-derived formula." });
  }
  if (molecule.netCharge !== deriveNetCharge(molecule.graph)) {
    issues.push({ code: "NET_CHARGE_MISMATCH", message: "Stored netCharge does not match graph-derived charge." });
  }
  if (!molecule.canonicalKey) {
    issues.push({ code: "INVALID_CANONICAL_KEY", message: "canonicalKey must be non-empty." });
  }
  return { valid: issues.length === 0, issues };
}

export function createMoleculeRecord(graph: MolecularGraph, elements: ElementProvider): MoleculeRecord {
  const validation = validateGraph(graph, elements);
  if (!validation.valid) {
    throw new Error(`Invalid molecular graph: ${validation.issues.map((issue) => issue.code).join(", ")}`);
  }

  const canonical = canonicalStructuralRepresentation(graph);
  return Object.freeze({
    graph,
    formula: deriveFormula(graph),
    netCharge: deriveNetCharge(graph),
    canonicalKey: `mol-v1-${fnv1a64(canonical)}`,
  });
}

export function validateSpeciesState(species: SpeciesState, elements: ElementProvider): ValidationResult {
  const issues: ValidationIssue[] = [...validateMoleculeRecord(species.molecule, elements).issues];
  if (!Number.isFinite(species.amountMol)) {
    issues.push({ code: "INVALID_AMOUNT", message: "amountMol must be finite." });
  } else if (species.amountMol < 0) {
    issues.push({ code: "NEGATIVE_AMOUNT", message: "amountMol must be non-negative." });
  }
  if (
    species.concentrationMolPerM3 !== undefined &&
    (!Number.isFinite(species.concentrationMolPerM3) || species.concentrationMolPerM3 < 0)
  ) {
    issues.push({
      code: "INVALID_CONCENTRATION",
      message: "concentrationMolPerM3 must be finite and non-negative.",
    });
  }
  return { valid: issues.length === 0, issues };
}

export function conservationVectorFromMolecule(
  molecule: MoleculeRecord,
  coefficient = 1,
): ConservationVector {
  if (!Number.isFinite(coefficient) || coefficient < 0) {
    throw new Error("Coefficient must be finite and non-negative.");
  }

  return {
    elements: Object.freeze(
      Object.fromEntries(
        Object.entries(molecule.formula).map(([element, count]) => [element, count * coefficient]),
      ),
    ),
    atomCount: molecule.graph.atoms.length * coefficient,
    netCharge: molecule.netCharge * coefficient,
  };
}

export function conservationDelta(
  before: ConservationVector,
  after: ConservationVector,
): ConservationDelta {
  const symbols = [...new Set([...Object.keys(before.elements), ...Object.keys(after.elements)])].sort();
  const elementDelta = Object.freeze(
    Object.fromEntries(
      symbols.map((symbol) => [symbol, (after.elements[symbol] ?? 0) - (before.elements[symbol] ?? 0)]),
    ),
  );
  const explicitElectronDelta =
    before.explicitElectronCount === undefined && after.explicitElectronCount === undefined
      ? undefined
      : (after.explicitElectronCount ?? 0) - (before.explicitElectronCount ?? 0);

  return {
    elementDelta,
    atomCountDelta: after.atomCount - before.atomCount,
    netChargeDelta: after.netCharge - before.netCharge,
    ...(explicitElectronDelta === undefined ? {} : { explicitElectronDelta }),
  };
}
