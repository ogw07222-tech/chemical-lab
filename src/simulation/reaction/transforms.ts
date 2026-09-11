import type { AtomId, AtomNode, BondEdge, BondKind, MolecularGraph, SpeciesState } from "../molecular";

function cloneGraph(graph: MolecularGraph): MolecularGraph {
  return {
    atoms: graph.atoms.map((atom) => ({ ...atom, metadata: atom.metadata ? { ...atom.metadata } : undefined })),
    bonds: graph.bonds.map((bond) => ({ ...bond, metadata: bond.metadata ? { ...bond.metadata } : undefined })),
  };
}

function stableBondId(a: string, b: string, kind: BondKind, order: number): string {
  const [x, y] = a < b ? [a, b] : [b, a];
  return `rxn-bond:${x}:${y}:${kind}:${order}`;
}

export function addBond(graph: MolecularGraph, a: AtomId, b: AtomId, order = 1, kind: BondKind = "covalent"): MolecularGraph {
  if (a === b) throw new Error("Cannot add a self bond.");
  const ids = new Set(graph.atoms.map((atom) => atom.id));
  if (!ids.has(a) || !ids.has(b)) throw new Error("Cannot add a bond with a missing atom endpoint.");
  if (graph.bonds.some((bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a))) {
    throw new Error("A bond already exists between the requested atoms.");
  }
  if (!Number.isFinite(order) || order <= 0) throw new Error("Bond order must be finite and positive.");
  const copy = cloneGraph(graph);
  return { ...copy, bonds: [...copy.bonds, { id: stableBondId(a, b, kind, order), a, b, kind, order }] };
}

export function removeBond(graph: MolecularGraph, a: AtomId, b: AtomId): MolecularGraph {
  const matches = graph.bonds.filter((bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a));
  if (matches.length !== 1) throw new Error("removeBond requires exactly one existing bond between endpoints.");
  const copy = cloneGraph(graph);
  return { ...copy, bonds: copy.bonds.filter((bond) => bond.id !== matches[0]!.id) };
}

export function changeBondOrder(graph: MolecularGraph, a: AtomId, b: AtomId, order: number): MolecularGraph {
  if (!Number.isFinite(order) || order <= 0) throw new Error("Bond order must be finite and positive.");
  const matches = graph.bonds.filter((bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a));
  if (matches.length !== 1) throw new Error("changeBondOrder requires exactly one existing bond between endpoints.");
  const copy = cloneGraph(graph);
  return { ...copy, bonds: copy.bonds.map((bond) => bond.id === matches[0]!.id ? { ...bond, order } : bond) };
}

export interface MergedGraph {
  graph: MolecularGraph;
  atomIdBySource: ReadonlyMap<string, AtomId>;
}

export function mergeGraphs(species: readonly SpeciesState[]): MergedGraph {
  const atoms: AtomNode[] = [];
  const bonds: BondEdge[] = [];
  const map = new Map<string, AtomId>();
  for (const entry of [...species].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const atom of entry.molecule.graph.atoms) {
      const id = `${entry.id}::${atom.id}`;
      map.set(`${entry.id}\u0000${atom.id}`, id);
      atoms.push({ ...atom, id });
    }
    for (const bond of entry.molecule.graph.bonds) {
      bonds.push({
        ...bond,
        id: `${entry.id}::${bond.id}`,
        a: `${entry.id}::${bond.a}`,
        b: `${entry.id}::${bond.b}`,
      });
    }
  }
  return { graph: { atoms, bonds }, atomIdBySource: map };
}

export function splitGraph(graph: MolecularGraph): readonly MolecularGraph[] {
  if (graph.atoms.length === 0) return [];
  const adjacency = new Map(graph.atoms.map((atom) => [atom.id, [] as string[]]));
  for (const bond of graph.bonds) {
    adjacency.get(bond.a)?.push(bond.b);
    adjacency.get(bond.b)?.push(bond.a);
  }
  const unseen = new Set(graph.atoms.map((atom) => atom.id));
  const components: MolecularGraph[] = [];
  while (unseen.size > 0) {
    const start = [...unseen].sort()[0]!;
    const stack = [start];
    const ids = new Set<string>();
    unseen.delete(start);
    while (stack.length) {
      const id = stack.pop()!;
      ids.add(id);
      for (const next of (adjacency.get(id) ?? []).sort()) {
        if (unseen.delete(next)) stack.push(next);
      }
    }
    components.push({
      atoms: graph.atoms.filter((atom) => ids.has(atom.id)),
      bonds: graph.bonds.filter((bond) => ids.has(bond.a) && ids.has(bond.b)),
    });
  }
  return components.sort((a, b) => a.atoms.map((x) => x.id).sort().join("|").localeCompare(b.atoms.map((x) => x.id).sort().join("|")));
}

export function setFormalCharge(graph: MolecularGraph, atomId: AtomId, charge: number): MolecularGraph {
  if (!Number.isInteger(charge)) throw new Error("Formal charge must be an integer.");
  if (!graph.atoms.some((atom) => atom.id === atomId)) throw new Error("Unknown atom for formal-charge change.");
  const copy = cloneGraph(graph);
  return { ...copy, atoms: copy.atoms.map((atom) => atom.id === atomId ? { ...atom, formalCharge: charge } : atom) };
}

export interface ProtonTransferTransformResult {
  graph: MolecularGraph;
  scopedDonorAtomId: AtomId;
  scopedProtonAtomId: AtomId;
  scopedAcceptorAtomId: AtomId;
}

export function transferProton(
  donor: SpeciesState,
  donorAtomId: AtomId,
  protonAtomId: AtomId,
  acceptor: SpeciesState,
  acceptorAtomId: AtomId,
): ProtonTransferTransformResult {
  const merged = mergeGraphs([donor, acceptor]);
  const d = merged.atomIdBySource.get(`${donor.id}\u0000${donorAtomId}`);
  const h = merged.atomIdBySource.get(`${donor.id}\u0000${protonAtomId}`);
  const a = merged.atomIdBySource.get(`${acceptor.id}\u0000${acceptorAtomId}`);
  if (!d || !h || !a) throw new Error("Proton-transfer atom mapping failed.");
  let graph = removeBond(merged.graph, d, h);
  graph = addBond(graph, a, h, 1, "covalent");
  const donorCharge = graph.atoms.find((atom) => atom.id === d)!.formalCharge;
  const acceptorCharge = graph.atoms.find((atom) => atom.id === a)!.formalCharge;
  graph = setFormalCharge(graph, d, donorCharge - 1);
  graph = setFormalCharge(graph, a, acceptorCharge + 1);
  return { graph, scopedDonorAtomId: d, scopedProtonAtomId: h, scopedAcceptorAtomId: a };
}

export function transferElectronMetadata(
  source: SpeciesState,
  sourceAtomId: AtomId,
  target: SpeciesState,
  targetAtomId: AtomId,
): MolecularGraph {
  const merged = mergeGraphs([source, target]);
  const sourceScoped = merged.atomIdBySource.get(`${source.id}\u0000${sourceAtomId}`);
  const targetScoped = merged.atomIdBySource.get(`${target.id}\u0000${targetAtomId}`);
  if (!sourceScoped || !targetScoped) throw new Error("Electron-transfer atom mapping failed.");
  const sourceCharge = merged.graph.atoms.find((atom) => atom.id === sourceScoped)!.formalCharge;
  const targetCharge = merged.graph.atoms.find((atom) => atom.id === targetScoped)!.formalCharge;
  let graph = setFormalCharge(merged.graph, sourceScoped, sourceCharge + 1);
  graph = setFormalCharge(graph, targetScoped, targetCharge - 1);
  return graph;
}
