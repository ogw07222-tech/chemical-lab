import {
  canonicalStructuralRepresentation,
  createMoleculeRecord,
  validateMoleculeRecord,
  type ElementProvider,
  type MoleculeRecord,
  type SpeciesId,
} from "../molecular";
import { validateCoarseValenceGraph } from "../reaction";
import type {
  DynamicSpeciesRecord,
  DynamicSpeciesRegistryLike,
  DynamicSpeciesRegistryOptions,
  GeneratedSpeciesProvenance,
  KnownSpeciesSeed,
  ResolveOrRegisterInput,
  SerializedDynamicSpeciesRegistry,
  SpeciesResolution,
} from "./types";

const CANONICALIZATION_VERSION = "mol-v1" as const;

function provenanceKey(value: GeneratedSpeciesProvenance): string {
  return [
    value.sourceReactionCandidateId,
    [...value.parentReactantSpeciesIds].sort().join(","),
    value.transformationFamily,
    value.creationTimestepId,
    value.productIndex,
    value.canonicalizationVersion,
  ].join("\u0000");
}

function normalizedProvenance(values: readonly GeneratedSpeciesProvenance[]): readonly GeneratedSpeciesProvenance[] {
  const unique = new Map<string, GeneratedSpeciesProvenance>();
  for (const value of values) {
    if (!value.sourceReactionCandidateId || !value.creationTimestepId) {
      throw new Error("Generated species provenance requires candidate and timestep ids.");
    }
    if (!Number.isInteger(value.productIndex) || value.productIndex < 0) {
      throw new Error("Generated species provenance productIndex must be a non-negative integer.");
    }
    if (value.canonicalizationVersion !== CANONICALIZATION_VERSION) {
      throw new Error(`Unsupported canonicalization version: ${value.canonicalizationVersion}`);
    }
    unique.set(provenanceKey(value), {
      ...value,
      parentReactantSpeciesIds: [...value.parentReactantSpeciesIds].sort(),
    });
  }
  return [...unique.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => value);
}

function cloneRecord(record: DynamicSpeciesRecord): DynamicSpeciesRecord {
  return Object.freeze({
    ...record,
    provenance: Object.freeze([...record.provenance]),
  });
}

function validateAndCanonicalize(
  molecule: MoleculeRecord,
  elements: ElementProvider,
): { molecule: MoleculeRecord; representation: string } | { reason: string } {
  const validation = validateMoleculeRecord(molecule, elements);
  if (!validation.valid) {
    return { reason: `INVALID_MOLECULE:${validation.issues.map((issue) => issue.code).join(",")}` };
  }
  const valenceIssues = validateCoarseValenceGraph(molecule.graph, elements);
  if (valenceIssues.length > 0) {
    return { reason: `COARSE_VALENCE_INVALID:${valenceIssues.join("|")}` };
  }

  let canonical: MoleculeRecord;
  let representation: string;
  try {
    canonical = createMoleculeRecord(molecule.graph, elements);
    representation = canonicalStructuralRepresentation(molecule.graph);
  } catch (error) {
    return { reason: `CANONICALIZATION_FAILED:${error instanceof Error ? error.message : String(error)}` };
  }

  if (canonical.canonicalKey !== molecule.canonicalKey) {
    return { reason: "CANONICAL_KEY_MISMATCH" };
  }
  return { molecule: canonical, representation };
}

function createKnownRecord(seed: KnownSpeciesSeed, elements: ElementProvider): DynamicSpeciesRecord {
  const checked = validateAndCanonicalize(seed.molecule, elements);
  if ("reason" in checked) {
    throw new Error(`Invalid known species seed ${seed.speciesId}: ${checked.reason}`);
  }
  if (!seed.speciesId) throw new Error("Known species seed id must be non-empty.");
  return cloneRecord({
    speciesId: seed.speciesId,
    canonicalKey: checked.molecule.canonicalKey,
    canonicalRepresentation: checked.representation,
    molecule: checked.molecule,
    origin: "KNOWN",
    validationState: "STRUCTURALLY_VALID",
    referenceMatchStatus: "KNOWN_SEED",
    scientificStatus: seed.scientificStatus ?? "OPEN",
    provenance: [],
  });
}

export class DynamicSpeciesRegistry implements DynamicSpeciesRegistryLike {
  private readonly byCanonicalKey: ReadonlyMap<string, DynamicSpeciesRecord>;
  private readonly bySpeciesId: ReadonlyMap<SpeciesId, DynamicSpeciesRecord>;

  private constructor(
    private readonly elements: ElementProvider,
    byCanonicalKey: ReadonlyMap<string, DynamicSpeciesRecord>,
    bySpeciesId: ReadonlyMap<SpeciesId, DynamicSpeciesRecord>,
  ) {
    this.byCanonicalKey = byCanonicalKey;
    this.bySpeciesId = bySpeciesId;
  }

  static create(options: DynamicSpeciesRegistryOptions): DynamicSpeciesRegistry {
    let registry = new DynamicSpeciesRegistry(options.elements, new Map(), new Map());
    const seeds = [...(options.knownSpecies ?? [])].sort((a, b) => a.speciesId.localeCompare(b.speciesId));
    for (const seed of seeds) registry = registry.withKnownSeed(seed);
    return registry;
  }

  static restore(serialized: SerializedDynamicSpeciesRegistry, elements: ElementProvider): DynamicSpeciesRegistry {
    if (serialized.schemaVersion !== 1) throw new Error(`Unsupported registry schema version: ${serialized.schemaVersion}`);
    if (serialized.canonicalizationVersion !== CANONICALIZATION_VERSION) {
      throw new Error(`Unsupported canonicalization version: ${serialized.canonicalizationVersion}`);
    }

    let registry = new DynamicSpeciesRegistry(elements, new Map(), new Map());
    const records = [...serialized.records].sort((a, b) =>
      a.canonicalKey.localeCompare(b.canonicalKey) || a.speciesId.localeCompare(b.speciesId),
    );
    for (const raw of records) {
      const checked = validateAndCanonicalize(raw.molecule, elements);
      if ("reason" in checked) throw new Error(`Invalid serialized species ${raw.speciesId}: ${checked.reason}`);
      if (raw.canonicalKey !== checked.molecule.canonicalKey || raw.canonicalRepresentation !== checked.representation) {
        throw new Error(`Serialized canonical identity mismatch for ${raw.speciesId}.`);
      }
      if (raw.validationState !== "STRUCTURALLY_VALID") throw new Error(`Invalid validation state for ${raw.speciesId}.`);
      if (raw.origin === "GENERATED" && raw.speciesId !== generatedSpeciesId(raw.canonicalKey)) {
        throw new Error(`Generated species id is not deterministic for ${raw.speciesId}.`);
      }
      const record = cloneRecord({
        ...raw,
        molecule: checked.molecule,
        provenance: normalizedProvenance(raw.provenance),
      });
      registry = registry.withRecord(record);
    }
    return registry;
  }

  get size(): number {
    return this.bySpeciesId.size;
  }

  lookupByCanonicalKey(canonicalKey: string): DynamicSpeciesRecord | undefined {
    return this.byCanonicalKey.get(canonicalKey);
  }

  lookupBySpeciesId(speciesId: SpeciesId): DynamicSpeciesRecord | undefined {
    return this.bySpeciesId.get(speciesId);
  }

  resolveOrRegister(input: ResolveOrRegisterInput): SpeciesResolution {
    if ((input.graph === undefined) === (input.molecule === undefined)) {
      return { status: "INVALID", reason: "Provide exactly one of graph or molecule.", registry: this };
    }

    let molecule: MoleculeRecord;
    try {
      molecule = input.molecule ?? createMoleculeRecord(input.graph!, this.elements);
    } catch (error) {
      return {
        status: "INVALID",
        reason: `INVALID_GRAPH:${error instanceof Error ? error.message : String(error)}`,
        registry: this,
      };
    }

    const checked = validateAndCanonicalize(molecule, this.elements);
    if ("reason" in checked) return { status: "INVALID", reason: checked.reason, registry: this };

    const existing = this.byCanonicalKey.get(checked.molecule.canonicalKey);
    if (existing) {
      if (existing.canonicalRepresentation !== checked.representation) {
        return { status: "INVALID", reason: `CANONICAL_KEY_COLLISION:${checked.molecule.canonicalKey}`, registry: this };
      }
      if (existing.origin === "GENERATED" && input.provenance) {
        const updated = cloneRecord({
          ...existing,
          provenance: normalizedProvenance([...existing.provenance, input.provenance]),
        });
        const next = this.withRecord(updated, true);
        return { status: "GENERATED", speciesId: existing.speciesId, record: updated, registry: next };
      }
      return {
        status: existing.origin === "KNOWN" ? "KNOWN" : "GENERATED",
        speciesId: existing.speciesId,
        record: existing,
        registry: this,
      };
    }

    const speciesId = generatedSpeciesId(checked.molecule.canonicalKey);
    const idCollision = this.bySpeciesId.get(speciesId);
    if (idCollision && idCollision.canonicalRepresentation !== checked.representation) {
      return { status: "INVALID", reason: `GENERATED_ID_COLLISION:${speciesId}`, registry: this };
    }

    const provenance = input.provenance ? normalizedProvenance([input.provenance]) : [];
    const record = cloneRecord({
      speciesId,
      canonicalKey: checked.molecule.canonicalKey,
      canonicalRepresentation: checked.representation,
      molecule: checked.molecule,
      origin: "GENERATED",
      validationState: "STRUCTURALLY_VALID",
      referenceMatchStatus: "OPEN",
      scientificStatus: "OPEN",
      provenance,
    });
    const next = this.withRecord(record);
    return { status: "GENERATED", speciesId, record, registry: next };
  }

  serialize(): SerializedDynamicSpeciesRegistry {
    return {
      schemaVersion: 1,
      canonicalizationVersion: CANONICALIZATION_VERSION,
      records: [...this.bySpeciesId.values()]
        .sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey) || a.speciesId.localeCompare(b.speciesId))
        .map((record) => ({
          speciesId: record.speciesId,
          canonicalKey: record.canonicalKey,
          canonicalRepresentation: record.canonicalRepresentation,
          molecule: record.molecule,
          origin: record.origin,
          validationState: record.validationState,
          referenceMatchStatus: record.referenceMatchStatus,
          scientificStatus: record.scientificStatus,
          provenance: [...record.provenance],
        })),
    };
  }

  private withKnownSeed(seed: KnownSpeciesSeed): DynamicSpeciesRegistry {
    const record = createKnownRecord(seed, this.elements);
    const existing = this.byCanonicalKey.get(record.canonicalKey);
    if (existing) {
      if (existing.canonicalRepresentation !== record.canonicalRepresentation) {
        throw new Error(`Canonical-key collision while seeding ${seed.speciesId}.`);
      }
      // Molecular identity excludes phase/runtime instance identity. Sorted seed order
      // makes the canonical known species id deterministic when equivalent seeds repeat.
      return this;
    }
    return this.withRecord(record);
  }

  private withRecord(record: DynamicSpeciesRecord, replace = false): DynamicSpeciesRegistry {
    const canonicalExisting = this.byCanonicalKey.get(record.canonicalKey);
    if (canonicalExisting && !replace && canonicalExisting.speciesId !== record.speciesId) {
      if (canonicalExisting.canonicalRepresentation !== record.canonicalRepresentation) {
        throw new Error(`Canonical-key collision for ${record.canonicalKey}.`);
      }
      return this;
    }
    const idExisting = this.bySpeciesId.get(record.speciesId);
    if (idExisting && idExisting.canonicalKey !== record.canonicalKey) {
      throw new Error(`Species id collision for ${record.speciesId}.`);
    }
    const byCanonicalKey = new Map(this.byCanonicalKey);
    const bySpeciesId = new Map(this.bySpeciesId);
    byCanonicalKey.set(record.canonicalKey, record);
    bySpeciesId.set(record.speciesId, record);
    return new DynamicSpeciesRegistry(this.elements, byCanonicalKey, bySpeciesId);
  }
}

export function generatedSpeciesId(canonicalKey: string): SpeciesId {
  if (!canonicalKey) throw new Error("canonicalKey must be non-empty.");
  return `generated:${canonicalKey}`;
}

export function createDynamicSpeciesRegistry(options: DynamicSpeciesRegistryOptions): DynamicSpeciesRegistry {
  return DynamicSpeciesRegistry.create(options);
}

export function restoreDynamicSpeciesRegistry(
  serialized: SerializedDynamicSpeciesRegistry,
  elements: ElementProvider,
): DynamicSpeciesRegistry {
  return DynamicSpeciesRegistry.restore(serialized, elements);
}
