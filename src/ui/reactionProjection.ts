import type {
  Phase3AProviderProjection,
  ReactionFactProjection,
  ReactionFactSpeciesAmount,
} from '../integration/phase3a-reaction-network';
import type {
  ReactionActivityView,
  ReactionDeveloperDiagnostics,
  ReactionHeatView,
  ReactionProgressView,
  ReactionSpeciesView,
  ScientificStatus,
  VesselContentView,
} from './types';

export interface PlayerSpeciesKnowledgeView {
  unknownRef: string;
  displayLabel: string;
  identityConfirmed: boolean;
  knownSpeciesId?: string;
}

export type PlayerSpeciesKnowledgeResolver = (speciesRef: string) => PlayerSpeciesKnowledgeView;

export interface Phase3AReactionUiProjection {
  contents: VesselContentView[];
  reactionEvents: ReactionProgressView[];
  reactionActivity?: ReactionActivityView;
  developerDiagnostics?: ReactionDeveloperDiagnostics;
}

function heatView(event: ReactionFactProjection): ReactionHeatView {
  const heatJ = event.reactionHeat_J;
  const missingHeat = heatJ === undefined || event.reasonCodes.includes('MISSING_REACTION_ENTHALPY');
  if (missingHeat || event.scientificStatus === 'OPEN') {
    return { status: 'unavailable', label: '열 데이터 미확정' };
  }
  const approximate = event.scientificStatus === 'APPROXIMATED';
  return {
    status: 'reported',
    valueJ: heatJ,
    label: `${approximate ? '≈ ' : ''}${heatJ.toFixed(1)} J`,
  };
}

function participantView(
  item: ReactionFactSpeciesAmount,
  resolveSpecies: PlayerSpeciesKnowledgeResolver,
): ReactionSpeciesView {
  const knowledge = resolveSpecies(item.speciesRef);
  return {
    unknownRef: knowledge.unknownRef,
    displayIdentity: knowledge.displayLabel,
    identityConfirmed: knowledge.identityConfirmed,
    ...(knowledge.knownSpeciesId === undefined ? {} : { knownSpeciesId: knowledge.knownSpeciesId }),
    amountMol: item.amountMol,
  };
}

function eventView(
  event: ReactionFactProjection,
  timelineOrder: number,
  resolveSpecies: PlayerSpeciesKnowledgeResolver,
): ReactionProgressView {
  return {
    id: event.eventId,
    timestepId: event.timestepId,
    sourceSequence: event.sequence,
    timelineOrder,
    startTimeS: event.startTimeS,
    endTimeS: event.endTimeS,
    scientificStatus: event.scientificStatus as ScientificStatus,
    activityLabel: '반응 커밋됨',
    consumed: event.consumed.map((item) => participantView(item, resolveSpecies)),
    produced: event.produced.map((item) => participantView(item, resolveSpecies)),
    reactionHeat: heatView(event),
  };
}

function dedupeTimeline(events: readonly ReactionFactProjection[]): ReactionFactProjection[] {
  const seen = new Set<string>();
  const unique: ReactionFactProjection[] = [];
  for (const event of events) {
    if (seen.has(event.eventId)) continue;
    seen.add(event.eventId);
    unique.push(event);
  }
  return unique;
}

export function projectPhase3AReactionUi(
  provider: Phase3AProviderProjection,
  resolveSpecies: PlayerSpeciesKnowledgeResolver,
  developerMode = false,
): Phase3AReactionUiProjection {
  const contents = provider.authoritativeVesselComposition.map((entry) => {
    const knowledge = resolveSpecies(entry.speciesRef);
    const visualizationKey = knowledge.identityConfirmed && knowledge.knownSpeciesId !== undefined
      ? `known:${knowledge.knownSpeciesId}`
      : `unknown:${knowledge.unknownRef}`;
    return {
      ...(knowledge.identityConfirmed && knowledge.knownSpeciesId !== undefined
        ? { speciesId: knowledge.knownSpeciesId }
        : {}),
      visualizationKey,
      displayIdentity: knowledge.identityConfirmed ? knowledge.displayLabel : '',
      ...(knowledge.identityConfirmed ? {} : { opaqueLabel: knowledge.displayLabel }),
      amountMol: entry.amountMol,
      phase: entry.phase,
      identityConfirmed: knowledge.identityConfirmed,
    } satisfies VesselContentView;
  });

  const uniqueTimeline = dedupeTimeline(provider.timelineEvents);
  const reactionEvents = uniqueTimeline.map((event, index) => eventView(event, index, resolveSpecies));

  const uniqueActive = dedupeTimeline(provider.activeReactionEvents);
  const latestActive = uniqueActive.at(-1);
  const reactionActivity = latestActive === undefined
    ? undefined
    : {
      eventId: latestActive.eventId,
      timestepId: latestActive.timestepId,
      simulationTimeS: latestActive.endTimeS,
      scientificStatus: latestActive.scientificStatus as ScientificStatus,
      label: '반응 커밋됨',
    } satisfies ReactionActivityView;

  const developerDiagnostics = developerMode
    ? {
      events: uniqueTimeline.map((event) => ({
        eventId: event.eventId,
        candidateId: event.candidateId,
        consumedSpeciesRefs: event.consumed.map((item) => item.speciesRef),
        producedSpeciesRefs: event.produced.map((item) => item.speciesRef),
      })),
    } satisfies ReactionDeveloperDiagnostics
    : undefined;

  return {
    contents,
    reactionEvents,
    ...(reactionActivity === undefined ? {} : { reactionActivity }),
    ...(developerDiagnostics === undefined ? {} : { developerDiagnostics }),
  };
}
