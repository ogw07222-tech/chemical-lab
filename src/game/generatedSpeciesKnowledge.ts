import {
  handleIdentityEvent,
  type IdentityConfirmedEvent,
  type PlayerProgressionState,
  type ProgressionTransitionResult,
  type SpeciesKey,
} from "./progression";

export const GENERATED_KNOWLEDGE_SCHEMA_VERSION = 1 as const;

export type GeneratedSpeciesOrigin = "known" | "generated";
export type ScientificReferenceMatchState =
  | "REFERENCE_BACKED"
  | "REFERENCE_MATCHED"
  | "GENERATED_UNVERIFIED"
  | "OPEN";

export interface InternalSpeciesDescriptor {
  speciesId: SpeciesKey;
  origin: GeneratedSpeciesOrigin;
  scientificReferenceMatch?: ScientificReferenceMatchState;
  verifiedCommonName?: string;
  molecularFormula?: string;
  molecularGraphRef?: string;
  registryMetadataRef?: string;
}

export interface UnknownSpeciesProjection {
  kind: "unknown-species";
  unknownRef: string;
  displayLabel: string;
  observed: boolean;
  analyzed: boolean;
  identityHypothesisAvailable: boolean;
  identityConfirmed: boolean;
}

export interface DeveloperSpeciesProjection extends UnknownSpeciesProjection {
  internal: {
    speciesId: SpeciesKey;
    origin: GeneratedSpeciesOrigin;
    scientificReferenceMatch?: ScientificReferenceMatchState;
    verifiedCommonName?: string;
    molecularFormula?: string;
    molecularGraphRef?: string;
    registryMetadataRef?: string;
  };
}

export interface ScientificRecordItem {
  recordId: string;
  unknownRef: string;
  experimentId: string;
  observationRef: string;
  fieldType: string;
  value: unknown;
  canonicalUnit?: string;
  uncertainty?: unknown;
  simulationTimeS: number;
}

export interface PlayerNote {
  noteId: string;
  unknownRef: string;
  experimentId: string;
  text: string;
  evidenceRefs: readonly string[];
}

export interface StructuredIdentityHypothesis {
  hypothesisId: string;
  unknownRef: string;
  experimentId: string;
  kind: "identity" | "formula" | "structure" | "quantitative";
  submittedValue: unknown;
  evidenceRefs: readonly string[];
  status: "HYPOTHESIZED" | "SUBMITTED" | "CONFIRMED" | "REJECTED" | "OPEN";
}

export interface GeneratedSpeciesKnowledgeEntry {
  speciesId: SpeciesKey;
  unknownRef: string;
  origin: GeneratedSpeciesOrigin;
  referenceMatch: ScientificReferenceMatchState;
  observed: boolean;
  analyzed: boolean;
  identityHypothesisAvailable: boolean;
  identityConfirmed: boolean;
  encyclopediaRegistered: boolean;
  materialAccessUnlocked: boolean;
  records: readonly ScientificRecordItem[];
  notes: readonly PlayerNote[];
  hypotheses: readonly StructuredIdentityHypothesis[];
  analysisRefs: readonly string[];
}

export interface GeneratedSpeciesKnowledgeState {
  schemaVersion: typeof GENERATED_KNOWLEDGE_SCHEMA_VERSION;
  bySpeciesId: Readonly<Record<SpeciesKey, GeneratedSpeciesKnowledgeEntry>>;
}

export interface ObserveGeneratedSpeciesEvent {
  kind: "ObserveGeneratedSpecies";
  species: InternalSpeciesDescriptor;
  experimentId: string;
}

export interface RecordScientificObservationEvent {
  kind: "RecordScientificObservation";
  speciesId: SpeciesKey;
  record: ScientificRecordItem;
}

export interface RecordAnalysisEvent {
  kind: "RecordAnalysis";
  speciesId: SpeciesKey;
  analysisRef: string;
}

export type GeneratedKnowledgeEvent =
  | ObserveGeneratedSpeciesEvent
  | RecordScientificObservationEvent
  | RecordAnalysisEvent;

export interface ConfirmationResult {
  knowledge: GeneratedSpeciesKnowledgeState;
  progression: ProgressionTransitionResult;
}

export function createGeneratedSpeciesKnowledgeState(): GeneratedSpeciesKnowledgeState {
  return { schemaVersion: GENERATED_KNOWLEDGE_SCHEMA_VERSION, bySpeciesId: {} };
}

function stableUnknownRef(speciesId: SpeciesKey): string {
  let hash = 2166136261;
  for (let i = 0; i < speciesId.length; i += 1) {
    hash ^= speciesId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `unknown-${(hash >>> 0).toString(36)}`;
}

function ensureEntry(
  state: GeneratedSpeciesKnowledgeState,
  species: InternalSpeciesDescriptor,
): GeneratedSpeciesKnowledgeEntry {
  return (
    state.bySpeciesId[species.speciesId] ?? {
      speciesId: species.speciesId,
      unknownRef: stableUnknownRef(species.speciesId),
      origin: species.origin,
      referenceMatch: species.scientificReferenceMatch ?? "OPEN",
      observed: false,
      analyzed: false,
      identityHypothesisAvailable: false,
      identityConfirmed: false,
      encyclopediaRegistered: false,
      materialAccessUnlocked: false,
      records: [],
      notes: [],
      hypotheses: [],
      analysisRefs: [],
    }
  );
}

export function ingestGeneratedKnowledgeEvent(
  state: GeneratedSpeciesKnowledgeState,
  event: GeneratedKnowledgeEvent,
): GeneratedSpeciesKnowledgeState {
  if (event.kind === "ObserveGeneratedSpecies") {
    const entry = ensureEntry(state, event.species);
    if (entry.observed) return state;
    return {
      ...state,
      bySpeciesId: {
        ...state.bySpeciesId,
        [event.species.speciesId]: { ...entry, observed: true },
      },
    };
  }

  const entry = state.bySpeciesId[event.speciesId];
  if (!entry) throw new Error("Knowledge entry must exist before record/analysis ingestion");

  if (event.kind === "RecordScientificObservation") {
    if (entry.records.some((record) => record.observationRef === event.record.observationRef)) {
      return state;
    }
    return {
      ...state,
      bySpeciesId: {
        ...state.bySpeciesId,
        [event.speciesId]: {
          ...entry,
          records: [...entry.records, event.record],
        },
      },
    };
  }

  if (entry.analysisRefs.includes(event.analysisRef)) return state;
  return {
    ...state,
    bySpeciesId: {
      ...state.bySpeciesId,
      [event.speciesId]: {
        ...entry,
        analyzed: true,
        identityHypothesisAvailable: true,
        analysisRefs: [...entry.analysisRefs, event.analysisRef].sort(),
      },
    },
  };
}

export function addPlayerNote(
  state: GeneratedSpeciesKnowledgeState,
  speciesId: SpeciesKey,
  note: PlayerNote,
): GeneratedSpeciesKnowledgeState {
  const entry = state.bySpeciesId[speciesId];
  if (!entry) throw new Error("Knowledge entry does not exist");
  if (entry.notes.some((item) => item.noteId === note.noteId)) return state;
  return {
    ...state,
    bySpeciesId: {
      ...state.bySpeciesId,
      [speciesId]: { ...entry, notes: [...entry.notes, note] },
    },
  };
}

export function addStructuredHypothesis(
  state: GeneratedSpeciesKnowledgeState,
  speciesId: SpeciesKey,
  hypothesis: StructuredIdentityHypothesis,
): GeneratedSpeciesKnowledgeState {
  const entry = state.bySpeciesId[speciesId];
  if (!entry) throw new Error("Knowledge entry does not exist");
  if (entry.hypotheses.some((item) => item.hypothesisId === hypothesis.hypothesisId)) return state;
  return {
    ...state,
    bySpeciesId: {
      ...state.bySpeciesId,
      [speciesId]: {
        ...entry,
        identityHypothesisAvailable: true,
        hypotheses: [...entry.hypotheses, hypothesis],
      },
    },
  };
}

export function confirmGeneratedSpeciesIdentity(
  knowledge: GeneratedSpeciesKnowledgeState,
  progression: PlayerProgressionState,
  event: IdentityConfirmedEvent,
): ConfirmationResult {
  const entry = knowledge.bySpeciesId[event.speciesKey];
  if (!entry) throw new Error("Knowledge entry does not exist for confirmed species");

  const progressionResult = handleIdentityEvent(progression, event);
  const nextEntry: GeneratedSpeciesKnowledgeEntry = {
    ...entry,
    identityConfirmed: true,
    encyclopediaRegistered: true,
    materialAccessUnlocked: true,
  };

  return {
    knowledge: {
      ...knowledge,
      bySpeciesId: { ...knowledge.bySpeciesId, [event.speciesKey]: nextEntry },
    },
    progression: progressionResult,
  };
}

export function projectSpeciesForPlayer(
  state: GeneratedSpeciesKnowledgeState,
  descriptor: InternalSpeciesDescriptor,
  developerModeEnabled = false,
): UnknownSpeciesProjection | DeveloperSpeciesProjection {
  const entry = ensureEntry(state, descriptor);
  const base: UnknownSpeciesProjection = {
    kind: "unknown-species",
    unknownRef: entry.unknownRef,
    displayLabel: entry.identityConfirmed
      ? descriptor.verifiedCommonName ?? "Confirmed substance"
      : "Unknown substance",
    observed: entry.observed,
    analyzed: entry.analyzed,
    identityHypothesisAvailable: entry.identityHypothesisAvailable,
    identityConfirmed: entry.identityConfirmed,
  };

  if (!developerModeEnabled) return base;
  return {
    ...base,
    internal: {
      speciesId: descriptor.speciesId,
      origin: descriptor.origin,
      ...(descriptor.scientificReferenceMatch === undefined
        ? {}
        : { scientificReferenceMatch: descriptor.scientificReferenceMatch }),
      ...(descriptor.verifiedCommonName === undefined
        ? {}
        : { verifiedCommonName: descriptor.verifiedCommonName }),
      ...(descriptor.molecularFormula === undefined
        ? {}
        : { molecularFormula: descriptor.molecularFormula }),
      ...(descriptor.molecularGraphRef === undefined
        ? {}
        : { molecularGraphRef: descriptor.molecularGraphRef }),
      ...(descriptor.registryMetadataRef === undefined
        ? {}
        : { registryMetadataRef: descriptor.registryMetadataRef }),
    },
  };
}

export function serializeGeneratedSpeciesKnowledge(
  state: GeneratedSpeciesKnowledgeState,
): string {
  const entries = Object.entries(state.bySpeciesId)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([speciesId, entry]) => [
      speciesId,
      {
        ...entry,
        records: [...entry.records].sort((a, b) => a.recordId.localeCompare(b.recordId)),
        notes: [...entry.notes].sort((a, b) => a.noteId.localeCompare(b.noteId)),
        hypotheses: [...entry.hypotheses].sort((a, b) =>
          a.hypothesisId.localeCompare(b.hypothesisId),
        ),
        analysisRefs: [...entry.analysisRefs].sort(),
      },
    ]);
  return JSON.stringify({ schemaVersion: GENERATED_KNOWLEDGE_SCHEMA_VERSION, entries });
}

export function deserializeGeneratedSpeciesKnowledge(
  serialized: string,
): GeneratedSpeciesKnowledgeState {
  const raw = JSON.parse(serialized) as { schemaVersion?: unknown; entries?: unknown };
  if (raw.schemaVersion !== GENERATED_KNOWLEDGE_SCHEMA_VERSION || !Array.isArray(raw.entries)) {
    throw new Error("Unsupported or invalid generated species knowledge save");
  }
  const bySpeciesId = Object.fromEntries(raw.entries as [SpeciesKey, GeneratedSpeciesKnowledgeEntry][]);
  return { schemaVersion: GENERATED_KNOWLEDGE_SCHEMA_VERSION, bySpeciesId };
}
