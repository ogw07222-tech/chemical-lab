import type { AtomNode, BondEdge, ElementProvider, SpeciesState } from "../molecular";
import type { ReactionCandidateOptions, ReactiveSite } from "./types";

const DEFAULT_MAX_SITES = 16;
const DEFAULT_EN_THRESHOLD = 0.4;

function coordination(graph: SpeciesState["molecule"]["graph"], atomId: string): number {
  return graph.bonds.reduce((sum, bond) => {
    if (bond.a === atomId || bond.b === atomId) return sum + bond.order;
    return sum;
  }, 0);
}

function neighbors(graph: SpeciesState["molecule"]["graph"], atomId: string): Array<{ atom: AtomNode; bond: BondEdge }> {
  const atomById = new Map(graph.atoms.map((atom) => [atom.id, atom]));
  const out: Array<{ atom: AtomNode; bond: BondEdge }> = [];
  for (const bond of graph.bonds) {
    const other = bond.a === atomId ? bond.b : bond.b === atomId ? bond.a : undefined;
    if (other !== undefined) {
      const atom = atomById.get(other);
      if (atom) out.push({ atom, bond });
    }
  }
  return out.sort((x, y) => x.atom.id.localeCompare(y.atom.id) || x.bond.id.localeCompare(y.bond.id));
}

export function coarseMaximumValence(atom: AtomNode, elements: ElementProvider): number | undefined {
  const element = elements.getElement(atom.element);
  if (!element || element.typicalValences.length === 0) return undefined;
  const base = Math.max(...element.typicalValences);
  const positiveChargeAllowance = element.valenceElectrons >= 5 ? Math.max(0, atom.formalCharge) : 0;
  return base + positiveChargeAllowance;
}

export function validateCoarseValenceGraph(graph: SpeciesState["molecule"]["graph"], elements: ElementProvider): readonly string[] {
  const issues: string[] = [];
  for (const atom of graph.atoms) {
    const max = coarseMaximumValence(atom, elements);
    if (max === undefined) continue;
    const used = coordination(graph, atom.id);
    const incidentBonds = graph.bonds.filter((bond) => bond.a === atom.id || bond.b === atom.id);
    const coarseMultipleBondAllowance =
      atom.formalCharge === 0 &&
      incidentBonds.length === 1 &&
      incidentBonds[0]!.order >= 2 &&
      used <= max + 1 + 1e-9;
    if (!Number.isFinite(used) || (used > max + 1e-9 && !coarseMultipleBondAllowance)) {
      issues.push(`OVER_COORDINATED:${atom.id}:${used}>${max}`);
    }
  }
  return issues.sort();
}

export function validateCoarseValence(species: SpeciesState, elements: ElementProvider): readonly string[] {
  return validateCoarseValenceGraph(species.molecule.graph, elements);
}

export function detectReactiveSites(
  species: SpeciesState,
  elements: ElementProvider,
  options: ReactionCandidateOptions = {},
): readonly ReactiveSite[] {
  const graph = species.molecule.graph;
  const sites: ReactiveSite[] = [];
  const enThreshold = options.electronegativityDifferenceThreshold ?? DEFAULT_EN_THRESHOLD;
  const maxSites = options.maxSitesPerSpecies ?? DEFAULT_MAX_SITES;

  for (const atom of [...graph.atoms].sort((a, b) => a.id.localeCompare(b.id))) {
    const used = coordination(graph, atom.id);
    const maxValence = coarseMaximumValence(atom, elements);
    const isHetero = atom.element !== "H" && atom.element !== "C";

    if (atom.formalCharge > 0) {
      sites.push({ speciesId: species.id, atomId: atom.id, kind: "FORMAL_POSITIVE", priority: 100, confidence: 0.95, evidence: [`formalCharge=${atom.formalCharge}`] });
      sites.push({ speciesId: species.id, atomId: atom.id, kind: "ELECTRON_POOR", priority: 95, confidence: 0.9, evidence: ["positive formal charge"] });
    }
    if (atom.formalCharge < 0) {
      sites.push({ speciesId: species.id, atomId: atom.id, kind: "FORMAL_NEGATIVE", priority: 100, confidence: 0.95, evidence: [`formalCharge=${atom.formalCharge}`] });
      sites.push({ speciesId: species.id, atomId: atom.id, kind: "ELECTRON_RICH", priority: 95, confidence: 0.9, evidence: ["negative formal charge"] });
    }
    if (isHetero) {
      sites.push({ speciesId: species.id, atomId: atom.id, kind: "HETERO_ATOM", priority: 40, confidence: 0.7, evidence: [`hetero element ${atom.element}`] });
    }
    if (maxValence !== undefined && used + 1e-9 < maxValence) {
      sites.push({ speciesId: species.id, atomId: atom.id, kind: "UNDER_COORDINATED", priority: 70, confidence: 0.75, evidence: [`coordination=${used}`, `coarseMax=${maxValence}`] });
      if (atom.formalCharge <= 0) {
        sites.push({ speciesId: species.id, atomId: atom.id, kind: "ELECTRON_RICH", priority: 55, confidence: 0.55, evidence: ["coarse unsatisfied valence"] });
      }
    }

    if (isHetero && atom.formalCharge <= 0) {
      sites.push({ speciesId: species.id, atomId: atom.id, kind: "PROTON_ACCEPTOR", priority: atom.formalCharge < 0 ? 90 : 60, confidence: atom.formalCharge < 0 ? 0.9 : 0.6, evidence: ["hetero atom with non-positive formal charge"] });
    }

    for (const { atom: neighbor, bond } of neighbors(graph, atom.id)) {
      if (neighbor.element === "H" && isHetero) {
        sites.push({ speciesId: species.id, atomId: atom.id, kind: "PROTON_DONOR", priority: atom.formalCharge > 0 ? 90 : 55, confidence: atom.formalCharge > 0 ? 0.9 : 0.55, evidence: [`hetero-H bond ${bond.id}`], bondId: bond.id });
      }
    }
  }

  for (const bond of [...graph.bonds].sort((a, b) => a.id.localeCompare(b.id))) {
    sites.push({ speciesId: species.id, atomId: bond.a, kind: "BREAKABLE_BOND", priority: 35, confidence: 0.45, evidence: [`bond=${bond.id}`, `order=${bond.order}`], bondId: bond.id });

    const a = graph.atoms.find((atom) => atom.id === bond.a);
    const b = graph.atoms.find((atom) => atom.id === bond.b);
    if (!a || !b) continue;
    const enA = elements.getElement(a.element)?.electronegativity;
    const enB = elements.getElement(b.element)?.electronegativity;
    if (enA === undefined || enB === undefined || Math.abs(enA - enB) < enThreshold) continue;
    const rich = enA > enB ? a : b;
    const poor = enA > enB ? b : a;
    sites.push({ speciesId: species.id, atomId: rich.id, kind: "POLARIZED_BOND_NEGATIVE_END", priority: 65, confidence: 0.7, evidence: [`ΔEN=${Math.abs(enA - enB).toFixed(3)}`, `bond=${bond.id}`], bondId: bond.id });
    sites.push({ speciesId: species.id, atomId: poor.id, kind: "POLARIZED_BOND_POSITIVE_END", priority: 65, confidence: 0.7, evidence: [`ΔEN=${Math.abs(enA - enB).toFixed(3)}`, `bond=${bond.id}`], bondId: bond.id });
  }

  const dedup = new Map<string, ReactiveSite>();
  for (const site of sites) {
    const key = `${site.speciesId}|${site.atomId}|${site.kind}|${site.bondId ?? ""}`;
    const prior = dedup.get(key);
    if (!prior || site.priority > prior.priority) dedup.set(key, site);
  }
  return [...dedup.values()]
    .sort((a, b) => b.priority - a.priority || a.kind.localeCompare(b.kind) || a.atomId.localeCompare(b.atomId) || (a.bondId ?? "").localeCompare(b.bondId ?? ""))
    .slice(0, Math.max(0, maxSites));
}
