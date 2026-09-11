import { describe, expect, it } from "vitest";
import {
  addPlayerNote,
  confirmGeneratedSpeciesIdentity,
  createGeneratedSpeciesKnowledgeState,
  deserializeGeneratedSpeciesKnowledge,
  ingestGeneratedKnowledgeEvent,
  projectSpeciesForPlayer,
  serializeGeneratedSpeciesKnowledge,
  type InternalSpeciesDescriptor,
} from "../../src/game/generatedSpeciesKnowledge";
import {
  createInitialProgressionState,
  validateAddUnlockedMaterial,
} from "../../src/game/progression";

const generated: InternalSpeciesDescriptor = {
  speciesId: "species-generated-001",
  origin: "generated",
  scientificReferenceMatch: "GENERATED_UNVERIFIED",
  verifiedCommonName: "Internal Secret Name",
  molecularFormula: "C2H6O",
  molecularGraphRef: "graph-secret",
  registryMetadataRef: "registry-secret",
};

function observedState() {
  return ingestGeneratedKnowledgeEvent(createGeneratedSpeciesKnowledgeState(), {
    kind: "ObserveGeneratedSpecies",
    species: generated,
    experimentId: "exp-1",
  });
}

describe("generated species player knowledge boundary", () => {
  it("does not leak internal identity in normal projection", () => {
    const projection = projectSpeciesForPlayer(observedState(), generated, false);
    expect(projection.displayLabel).toBe("Unknown substance");
    expect(projection).not.toHaveProperty("internal");
    expect(JSON.stringify(projection)).not.toContain(generated.speciesId);
    expect(JSON.stringify(projection)).not.toContain("C2H6O");
    expect(JSON.stringify(projection)).not.toContain("graph-secret");
  });

  it("accumulates scientific records for an unknown species idempotently", () => {
    let state = observedState();
    const entry = state.bySpeciesId[generated.speciesId]!;
    const record = {
      recordId: "record-1",
      unknownRef: entry.unknownRef,
      experimentId: "exp-1",
      observationRef: "obs-1",
      fieldType: "temperature",
      value: 300,
      canonicalUnit: "K",
      simulationTimeS: 4,
    } as const;

    state = ingestGeneratedKnowledgeEvent(state, {
      kind: "RecordScientificObservation",
      speciesId: generated.speciesId,
      record,
    });
    state = ingestGeneratedKnowledgeEvent(state, {
      kind: "RecordScientificObservation",
      speciesId: generated.speciesId,
      record,
    });

    expect(state.bySpeciesId[generated.speciesId]!.records).toHaveLength(1);
  });

  it("attaches My Notes to the correct generated species", () => {
    let state = observedState();
    const unknownRef = state.bySpeciesId[generated.speciesId]!.unknownRef;
    state = addPlayerNote(state, generated.speciesId, {
      noteId: "note-1",
      unknownRef,
      experimentId: "exp-1",
      text: "가열하면 변화하는 것 같다",
      evidenceRefs: [],
    });

    expect(state.bySpeciesId[generated.speciesId]!.notes[0]?.text).toContain("가열하면");
  });

  it("analysis then confirmation reuses canonical discovery progression", () => {
    let knowledge = observedState();
    knowledge = ingestGeneratedKnowledgeEvent(knowledge, {
      kind: "RecordAnalysis",
      speciesId: generated.speciesId,
      analysisRef: "analysis-1",
    });

    const progression = createInitialProgressionState({
      id: "starter-v1",
      schemaVersion: 1,
      speciesKeys: ["H2"],
    });

    const confirmed = confirmGeneratedSpeciesIdentity(knowledge, progression, {
      kind: "IdentityConfirmed",
      eventId: "identity-1",
      speciesKey: generated.speciesId,
      experimentId: "exp-1",
      simulationTimeS: 10,
      confirmationMethod: "instrument-analysis",
      analysisResultId: "analysis-1",
      authoritative: true,
    });

    const entry = confirmed.knowledge.bySpeciesId[generated.speciesId]!;
    expect(entry.identityConfirmed).toBe(true);
    expect(entry.encyclopediaRegistered).toBe(true);
    expect(entry.materialAccessUnlocked).toBe(true);
    expect(confirmed.progression.firstDiscoveryEvent?.speciesKey).toBe(generated.speciesId);
  });

  it("unlocked generated species has unlimited entitlement but finite additions", () => {
    const progression0 = createInitialProgressionState({
      id: "starter-v1",
      schemaVersion: 1,
      speciesKeys: [],
    });
    const confirmed = confirmGeneratedSpeciesIdentity(observedState(), progression0, {
      kind: "IdentityConfirmed",
      eventId: "identity-1",
      speciesKey: generated.speciesId,
      experimentId: "exp-1",
      simulationTimeS: 10,
      confirmationMethod: "instrument-analysis",
      authoritative: true,
    });

    expect(
      validateAddUnlockedMaterial(confirmed.progression.state, {
        kind: "AddUnlockedMaterial",
        commandId: "add-1",
        vesselId: "vessel-1",
        speciesKey: generated.speciesId,
        amountMol: 0.01,
      }).ok,
    ).toBe(true);
    expect(
      validateAddUnlockedMaterial(confirmed.progression.state, {
        kind: "AddUnlockedMaterial",
        commandId: "bad-add",
        vesselId: "vessel-1",
        speciesKey: generated.speciesId,
        amountMol: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({ ok: false, error: "INVALID_AMOUNT" });
  });

  it("save/restore keeps notes and knowledge associated with stable speciesId", () => {
    let state = observedState();
    const unknownRef = state.bySpeciesId[generated.speciesId]!.unknownRef;
    state = addPlayerNote(state, generated.speciesId, {
      noteId: "note-1",
      unknownRef,
      experimentId: "exp-1",
      text: "same material as prior sample?",
      evidenceRefs: ["obs-1"],
    });

    const restored = deserializeGeneratedSpeciesKnowledge(
      serializeGeneratedSpeciesKnowledge(state),
    );
    expect(restored.bySpeciesId[generated.speciesId]!.unknownRef).toBe(unknownRef);
    expect(restored.bySpeciesId[generated.speciesId]!.notes[0]?.noteId).toBe("note-1");
    expect(serializeGeneratedSpeciesKnowledge(restored)).toBe(
      serializeGeneratedSpeciesKnowledge(state),
    );
  });

  it("developer projection reveals internals without changing normal progression", () => {
    const state = observedState();
    const normal = projectSpeciesForPlayer(state, generated, false);
    const developer = projectSpeciesForPlayer(state, generated, true);

    expect(normal).not.toHaveProperty("internal");
    expect(developer).toHaveProperty("internal.speciesId", generated.speciesId);
    expect(developer).toHaveProperty("internal.origin", "generated");
    expect(state.bySpeciesId[generated.speciesId]!.identityConfirmed).toBe(false);
  });

  it("duplicate internal references do not create duplicate knowledge entries", () => {
    let state = observedState();
    state = ingestGeneratedKnowledgeEvent(state, {
      kind: "ObserveGeneratedSpecies",
      species: generated,
      experimentId: "exp-2",
    });
    expect(Object.keys(state.bySpeciesId)).toEqual([generated.speciesId]);
  });
});
