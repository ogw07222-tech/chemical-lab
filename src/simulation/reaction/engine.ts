import {
  conservationDelta,
  conservationVectorFromMolecule,
  createMoleculeRecord,
  validateGraph,
  validateSpeciesState,
  type ConservationVector,
  type ElementProvider,
  type MolecularGraph,
  type MoleculeRecord,
  type SpeciesState,
} from "../molecular";
import { detectReactiveSites, validateCoarseValence, validateCoarseValenceGraph } from "./analysis";
import { addBond, mergeGraphs, removeBond, splitGraph, transferElectronMetadata, transferProton } from "./transforms";
import type {
  CandidateAtomMapEntry,
  CandidateAtomRef,
  CandidateBondChange,
  CandidateChargeChange,
  CandidateConservationResult,
  CandidatePruningDiagnostics,
  CandidatePruningReason,
  CandidatePruningSample,
  ReactionCandidate,
  ReactionCandidateGenerationInput,
  ReactionCandidateGenerationResult,
  ReactionFamily,
  ReactiveSite,
} from "./types";

const DEFAULT_MAX_PER_FAMILY = 24;
const DEFAULT_MAX_TOTAL = 64;

interface DraftCandidate {
  family: ReactionFamily;
  reactants: readonly SpeciesState[];
  productRawGraphs: readonly MolecularGraph[];
  bondChanges: readonly CandidateBondChange[];
  chargeChanges: readonly CandidateChargeChange[];
  electronTransfer?: ReactionCandidate["electronTransfer"];
  protonTransfer?: ReactionCandidate["protonTransfer"];
  structuralConfidence: number;
  assumptions: readonly string[];
  ruleId: string;
  rulePriority: number;
  siteKeys: readonly string[];
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

function combine(vectors: readonly ConservationVector[]): ConservationVector {
  const elements: Record<string, number> = {};
  let atomCount = 0;
  let netCharge = 0;
  let explicitElectronCount: number | undefined;
  for (const vector of vectors) {
    for (const [symbol, count] of Object.entries(vector.elements)) elements[symbol] = (elements[symbol] ?? 0) + count;
    atomCount += vector.atomCount;
    netCharge += vector.netCharge;
    if (vector.explicitElectronCount !== undefined) explicitElectronCount = (explicitElectronCount ?? 0) + vector.explicitElectronCount;
  }
  return {
    elements: Object.freeze(Object.fromEntries(Object.entries(elements).sort(([a], [b]) => a.localeCompare(b)))),
    atomCount,
    netCharge,
    ...(explicitElectronCount === undefined ? {} : { explicitElectronCount }),
  };
}

function conservationFor(reactants: readonly SpeciesState[], products: readonly MoleculeRecord[]): CandidateConservationResult {
  const before = combine(reactants.map((species) => conservationVectorFromMolecule(species.molecule, 1)));
  const after = combine(products.map((product) => conservationVectorFromMolecule(product, 1)));
  const delta = conservationDelta(before, after);
  const reasons: string[] = [];
  if (Object.values(delta.elementDelta).some((value) => Math.abs(value) > 1e-12)) reasons.push("ELEMENT_COUNT_MISMATCH");
  if (Math.abs(delta.atomCountDelta) > 1e-12) reasons.push("ATOM_COUNT_MISMATCH");
  if (Math.abs(delta.netChargeDelta) > 1e-12) reasons.push("NET_CHARGE_MISMATCH");
  if (delta.explicitElectronDelta !== undefined && Math.abs(delta.explicitElectronDelta) > 1e-12) reasons.push("ELECTRON_BOOKKEEPING_MISMATCH");
  return { valid: reasons.length === 0, delta, reasons };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function accessible(a: SpeciesState, b: SpeciesState, input: ReactionCandidateGenerationInput): boolean {
  if (a.phaseState.phase !== "solid" && b.phaseState.phase !== "solid") return true;
  const contacts = new Set((input.environment?.contactPairs ?? []).map(([x, y]) => pairKey(x, y)));
  return contacts.has(pairKey(a.id, b.id));
}

function atomRef(speciesId: string, atomId: string): CandidateAtomRef {
  return { speciesId, atomId };
}

function buildAtomMapping(reactants: readonly SpeciesState[], productGraphs: readonly MoleculeRecord[]): readonly CandidateAtomMapEntry[] {
  const out: CandidateAtomMapEntry[] = [];
  const originalKeys = new Set<string>();
  for (const species of reactants) {
    for (const atom of species.molecule.graph.atoms) originalKeys.add(`${species.id}\u0000${atom.id}`);
  }
  for (let productIndex = 0; productIndex < productGraphs.length; productIndex += 1) {
    for (const atom of productGraphs[productIndex]!.graph.atoms) {
      const split = atom.id.indexOf("::");
      if (split >= 0) {
        const speciesId = atom.id.slice(0, split);
        const atomId = atom.id.slice(split + 2);
        if (originalKeys.has(`${speciesId}\u0000${atomId}`)) out.push({ reactant: { speciesId, atomId }, productIndex, productAtomId: atom.id });
      } else {
        for (const species of reactants) {
          if (species.molecule.graph.atoms.some((candidate) => candidate.id === atom.id)) {
            out.push({ reactant: { speciesId: species.id, atomId: atom.id }, productIndex, productAtomId: atom.id });
            break;
          }
        }
      }
    }
  }
  return out.sort((a, b) =>
    a.reactant.speciesId.localeCompare(b.reactant.speciesId) ||
    a.reactant.atomId.localeCompare(b.reactant.atomId) ||
    a.productIndex - b.productIndex ||
    a.productAtomId.localeCompare(b.productAtomId),
  );
}

function productMultisetKey(products: readonly MoleculeRecord[]): string {
  return products.map((product) => product.canonicalKey).sort().join("+");
}

function reactantMultisetKey(reactants: readonly SpeciesState[]): string {
  return reactants.map((species) => species.molecule.canonicalKey).sort().join("+");
}

function draftSortKey(draft: DraftCandidate): string {
  return [String(999 - draft.rulePriority).padStart(3, "0"), draft.family, draft.ruleId, ...draft.siteKeys].join("|");
}

function generateBondCleavage(species: SpeciesState, sites: readonly ReactiveSite[]): DraftCandidate[] {
  const out: DraftCandidate[] = [];
  const bondIds = [...new Set(sites.filter((site) => site.kind === "BREAKABLE_BOND" && site.bondId).map((site) => site.bondId!))].sort();
  for (const bondId of bondIds) {
    const bond = species.molecule.graph.bonds.find((candidate) => candidate.id === bondId);
    if (!bond) continue;
    const graph = removeBond(species.molecule.graph, bond.a, bond.b);
    out.push({
      family: "BOND_CLEAVAGE",
      reactants: [species],
      productRawGraphs: splitGraph(graph),
      bondChanges: [{ kind: "REMOVE", a: atomRef(species.id, bond.a), b: atomRef(species.id, bond.b), beforeOrder: bond.order, bondKind: bond.kind }],
      chargeChanges: [],
      structuralConfidence: 0.45,
      assumptions: ["Bond cleavage is a structural candidate only; thermodynamic and kinetic feasibility are unevaluated."],
      ruleId: "generic.bond-cleavage.v1",
      rulePriority: 30,
      siteKeys: [`${species.id}:${bond.id}`],
    });
  }
  return out;
}

function generateBondFormation(a: SpeciesState, aSites: readonly ReactiveSite[], b: SpeciesState, bSites: readonly ReactiveSite[]): DraftCandidate[] {
  const out: DraftCandidate[] = [];
  const aAtoms = new Set(aSites.filter((site) => site.kind === "UNDER_COORDINATED" || site.kind === "FORMAL_NEGATIVE").map((site) => site.atomId));
  const bAtoms = new Set(bSites.filter((site) => site.kind === "UNDER_COORDINATED" || site.kind === "FORMAL_POSITIVE").map((site) => site.atomId));
  for (const left of [...aAtoms].sort()) {
    for (const right of [...bAtoms].sort()) {
      const merged = mergeGraphs([a, b]);
      const leftScoped = merged.atomIdBySource.get(`${a.id}\u0000${left}`)!;
      const rightScoped = merged.atomIdBySource.get(`${b.id}\u0000${right}`)!;
      let graph: MolecularGraph;
      try {
        graph = addBond(merged.graph, leftScoped, rightScoped, 1, "covalent");
      } catch {
        continue;
      }
      out.push({
        family: "BOND_FORMATION",
        reactants: [a, b],
        productRawGraphs: splitGraph(graph),
        bondChanges: [{ kind: "ADD", a: atomRef(a.id, left), b: atomRef(b.id, right), afterOrder: 1, bondKind: "covalent" }],
        chargeChanges: [],
        structuralConfidence: 0.55,
        assumptions: ["Coarse unsatisfied-valence/charge pairing; no thermodynamic or kinetic claim."],
        ruleId: "generic.bond-formation.v1",
        rulePriority: 50,
        siteKeys: [`${a.id}:${left}`, `${b.id}:${right}`].sort(),
      });
    }
  }
  return out;
}

function donorHydrogens(species: SpeciesState, donorAtomId: string): string[] {
  const atoms = new Map(species.molecule.graph.atoms.map((atom) => [atom.id, atom]));
  return species.molecule.graph.bonds.flatMap((bond) => {
    const other = bond.a === donorAtomId ? bond.b : bond.b === donorAtomId ? bond.a : undefined;
    return other && atoms.get(other)?.element === "H" ? [other] : [];
  }).sort();
}

function generateProtonTransfer(donor: SpeciesState, donorSites: readonly ReactiveSite[], acceptor: SpeciesState, acceptorSites: readonly ReactiveSite[]): DraftCandidate[] {
  const out: DraftCandidate[] = [];
  const donors = [...new Set(donorSites.filter((site) => site.kind === "PROTON_DONOR").map((site) => site.atomId))].sort();
  const acceptors = [...new Set(acceptorSites.filter((site) => site.kind === "PROTON_ACCEPTOR").map((site) => site.atomId))].sort();
  for (const d of donors) {
    for (const h of donorHydrogens(donor, d)) {
      for (const a of acceptors) {
        const donorBefore = donor.molecule.graph.atoms.find((atom) => atom.id === d)!.formalCharge;
        const acceptorBefore = acceptor.molecule.graph.atoms.find((atom) => atom.id === a)!.formalCharge;
        let transformed;
        try {
          transformed = transferProton(donor, d, h, acceptor, a);
        } catch {
          continue;
        }
        out.push({
          family: "PROTON_TRANSFER",
          reactants: [donor, acceptor],
          productRawGraphs: splitGraph(transformed.graph),
          bondChanges: [
            { kind: "REMOVE", a: atomRef(donor.id, d), b: atomRef(donor.id, h), beforeOrder: 1, bondKind: "covalent" },
            { kind: "ADD", a: atomRef(acceptor.id, a), b: atomRef(donor.id, h), afterOrder: 1, bondKind: "covalent" },
          ],
          chargeChanges: [
            { atom: atomRef(donor.id, d), before: donorBefore, after: donorBefore - 1 },
            { atom: atomRef(acceptor.id, a), before: acceptorBefore, after: acceptorBefore + 1 },
          ],
          protonTransfer: { donorAtom: atomRef(donor.id, d), protonAtom: atomRef(donor.id, h), acceptorAtom: atomRef(acceptor.id, a) },
          structuralConfidence: 0.65,
          assumptions: ["Explicit hetero-bound proton transferred as H+; formal-charge bookkeeping is coarse structural bookkeeping."],
          ruleId: "generic.proton-transfer.v1",
          rulePriority: 80,
          siteKeys: [`${donor.id}:${d}:${h}`, `${acceptor.id}:${a}`].sort(),
        });
      }
    }
  }
  return out;
}

function generateElectronTransfer(source: SpeciesState, sourceSites: readonly ReactiveSite[], target: SpeciesState, targetSites: readonly ReactiveSite[]): DraftCandidate[] {
  const out: DraftCandidate[] = [];
  const sources = [...new Set(sourceSites.filter((site) => site.kind === "FORMAL_NEGATIVE").map((site) => site.atomId))].sort();
  const targets = [...new Set(targetSites.filter((site) => site.kind === "FORMAL_POSITIVE").map((site) => site.atomId))].sort();
  for (const s of sources) {
    for (const t of targets) {
      const sourceBefore = source.molecule.graph.atoms.find((atom) => atom.id === s)!.formalCharge;
      const targetBefore = target.molecule.graph.atoms.find((atom) => atom.id === t)!.formalCharge;
      const graph = transferElectronMetadata(source, s, target, t);
      out.push({
        family: "ELECTRON_TRANSFER",
        reactants: [source, target],
        productRawGraphs: splitGraph(graph),
        bondChanges: [],
        chargeChanges: [
          { atom: atomRef(source.id, s), before: sourceBefore, after: sourceBefore + 1 },
          { atom: atomRef(target.id, t), before: targetBefore, after: targetBefore - 1 },
        ],
        electronTransfer: { electronCount: 1, source: atomRef(source.id, s), target: atomRef(target.id, t), externalReservoir: false },
        structuralConfidence: 0.7,
        assumptions: ["Oppositely charged sites are a coarse electron-transfer eligibility signal; redox potential is not evaluated."],
        ruleId: "generic.electron-transfer.v1",
        rulePriority: 70,
        siteKeys: [`${source.id}:${s}`, `${target.id}:${t}`].sort(),
      });
    }
  }
  return out;
}

function toCandidate(draft: DraftCandidate, elements: ElementProvider): ReactionCandidate | { reject: "INVALID" | "CONSERVATION" | "NOOP" } {
  const products: MoleculeRecord[] = [];
  try {
    for (const graph of draft.productRawGraphs) {
      if (!validateGraph(graph, elements).valid) return { reject: "INVALID" };
      if (validateCoarseValenceGraph(graph, elements).length > 0) return { reject: "INVALID" };
      products.push(createMoleculeRecord(graph, elements));
    }
  } catch {
    return { reject: "INVALID" };
  }
  if (productMultisetKey(products) === reactantMultisetKey(draft.reactants)) return { reject: "NOOP" };
  const conservation = conservationFor(draft.reactants, products);
  if (!conservation.valid) return { reject: "CONSERVATION" };
  const reactantStateKey = draft.reactants
    .map((r) => `${r.id}@${r.phaseState.phaseStateId}:${r.molecule.canonicalKey}`)
    .sort()
    .join("+");
  const structuralKey = `${draft.family}|${draft.ruleId}|${reactantStateKey}|${productMultisetKey(products)}`;
  const id = `rxn-v1-${fnv1a64(structuralKey)}`;
  return {
    id,
    family: draft.family,
    reactantRefs: draft.reactants.map((species) => ({ speciesId: species.id, coefficient: 1 })).sort((a, b) => a.speciesId.localeCompare(b.speciesId)),
    productGraphs: products,
    atomMapping: buildAtomMapping(draft.reactants, products),
    bondChanges: draft.bondChanges,
    chargeChanges: draft.chargeChanges,
    ...(draft.electronTransfer ? { electronTransfer: draft.electronTransfer } : {}),
    ...(draft.protonTransfer ? { protonTransfer: draft.protonTransfer } : {}),
    stoichiometry: {
      reactants: draft.reactants.map((species) => ({ speciesId: species.id, coefficient: 1 })).sort((a, b) => a.speciesId.localeCompare(b.speciesId)),
      products: products.map((_, productIndex) => ({ productIndex, coefficient: 1 })),
    },
    structuralConfidence: draft.structuralConfidence,
    assumptions: draft.assumptions,
    ruleId: draft.ruleId,
    conservation,
    debug: { structuralKey, rulePriority: draft.rulePriority, siteKeys: draft.siteKeys },
  };
}

function zeroDiagnostics(): CandidatePruningDiagnostics {
  return {
    generatedBeforeValidation: 0,
    rejectedInvalidProduct: 0,
    rejectedConservation: 0,
    rejectedNoOp: 0,
    rejectedDuplicate: 0,
    rejectedInaccessible: 0,
    rejectedByFamilyCap: 0,
    rejectedByTotalCap: 0,
    sampledReasons: [],
  };
}

export function generateReactionCandidatesWithDiagnostics(input: ReactionCandidateGenerationInput): ReactionCandidateGenerationResult {
  const diagnostics = zeroDiagnostics();
  const samples = diagnostics.sampledReasons as CandidatePruningSample[];
  const sample = (reason: CandidatePruningReason, draft?: DraftCandidate) => {
    if (samples.length >= 32) return;
    samples.push({ reason, ...(draft ? { ruleId: draft.ruleId, siteKeys: draft.siteKeys } : {}) });
  };

  const species = [...input.species].sort((a, b) => a.id.localeCompare(b.id));
  for (const entry of species) {
    if (!validateSpeciesState(entry, input.elements).valid) throw new Error(`Invalid SpeciesState: ${entry.id}`);
    const valenceIssues = validateCoarseValence(entry, input.elements);
    if (valenceIssues.length > 0) throw new Error(`Invalid coarse valence for ${entry.id}: ${valenceIssues.join(",")}`);
  }

  const sites = new Map(species.map((entry) => [entry.id, detectReactiveSites(entry, input.elements, input.options)]));
  const drafts: DraftCandidate[] = [];
  for (const entry of species) drafts.push(...generateBondCleavage(entry, sites.get(entry.id) ?? []));

  for (let i = 0; i < species.length; i += 1) {
    for (let j = i + 1; j < species.length; j += 1) {
      const a = species[i]!;
      const b = species[j]!;
      if (!accessible(a, b, input)) {
        diagnostics.rejectedInaccessible += 1;
        sample("INACCESSIBLE");
        continue;
      }
      const aSites = sites.get(a.id) ?? [];
      const bSites = sites.get(b.id) ?? [];
      drafts.push(...generateBondFormation(a, aSites, b, bSites));
      drafts.push(...generateBondFormation(b, bSites, a, aSites));
      drafts.push(...generateProtonTransfer(a, aSites, b, bSites));
      drafts.push(...generateProtonTransfer(b, bSites, a, aSites));
      drafts.push(...generateElectronTransfer(a, aSites, b, bSites));
      drafts.push(...generateElectronTransfer(b, bSites, a, aSites));
    }
  }

  drafts.sort((a, b) => draftSortKey(a).localeCompare(draftSortKey(b)));
  diagnostics.generatedBeforeValidation = drafts.length;
  const unique = new Map<string, ReactionCandidate>();

  for (const draft of drafts) {
    const converted = toCandidate(draft, input.elements);
    if ("reject" in converted) {
      if (converted.reject === "INVALID") {
        diagnostics.rejectedInvalidProduct += 1;
        sample("INVALID_PRODUCT", draft);
      } else if (converted.reject === "CONSERVATION") {
        diagnostics.rejectedConservation += 1;
        sample("CONSERVATION", draft);
      } else {
        diagnostics.rejectedNoOp += 1;
        sample("NO_OP", draft);
      }
      continue;
    }
    if (unique.has(converted.debug.structuralKey)) {
      diagnostics.rejectedDuplicate += 1;
      sample("DUPLICATE", draft);
      continue;
    }
    unique.set(converted.debug.structuralKey, converted);
  }

  const perFamilyCap = input.options?.maxCandidatesPerFamily ?? DEFAULT_MAX_PER_FAMILY;
  const totalCap = input.options?.maxTotalCandidates ?? DEFAULT_MAX_TOTAL;
  const familyCounts = new Map<ReactionFamily, number>();
  const capped: ReactionCandidate[] = [];

  for (const candidate of [...unique.values()].sort((a, b) =>
    b.debug.rulePriority - a.debug.rulePriority || a.family.localeCompare(b.family) || a.id.localeCompare(b.id),
  )) {
    const count = familyCounts.get(candidate.family) ?? 0;
    if (count >= perFamilyCap) {
      diagnostics.rejectedByFamilyCap += 1;
      sample("FAMILY_CAP");
      continue;
    }
    if (capped.length >= totalCap) {
      diagnostics.rejectedByTotalCap += 1;
      sample("TOTAL_CAP");
      continue;
    }
    familyCounts.set(candidate.family, count + 1);
    capped.push(candidate);
  }

  return { candidates: capped, diagnostics };
}

export function generateReactionCandidates(input: ReactionCandidateGenerationInput): readonly ReactionCandidate[] {
  return generateReactionCandidatesWithDiagnostics(input).candidates;
}
