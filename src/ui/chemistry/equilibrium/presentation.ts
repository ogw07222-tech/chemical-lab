import type {
  Phase3BReactionFactProjection,
  ReversiblePairArbitrationFact,
} from '../../../integration/phase3b-reversible-arbitration';
import type {
  EquilibriumDisplayDirection,
  EquilibriumPresentationView,
  ReactionDeveloperEventDiagnostic,
  ReactionDeveloperPairDiagnostic,
  ReversiblePairPresentationView,
  ScientificStatus,
} from '../../types';

export function equilibriumDirectionLabel(direction: EquilibriumDisplayDirection): string {
  if (direction === 'FORWARD') return '정방향 우세';
  if (direction === 'REVERSE') return '역방향 우세';
  if (direction === 'NEAR_EQUILIBRIUM') return '평형 근처';
  return '평형 방향 미확정';
}

export function scientificStatusLabel(status: ScientificStatus): string {
  if (status === 'VERIFIED') return '검증됨';
  if (status === 'APPROXIMATED') return '≈ 근사';
  if (status === 'EMPIRICAL') return '경험값';
  if (status === 'GAMEPLAY_SIMPLIFICATION') return '모델 단순화';
  return '미확정';
}

function numericEvidence(
  status: ScientificStatus,
  source: Pick<
    Phase3BReactionFactProjection,
    'equilibriumDrivingStrength' | 'lnQOverK' | 'reactionQuotientQ' | 'equilibriumConstantK'
  >,
): Pick<EquilibriumPresentationView, 'drivingStrength' | 'lnQOverK' | 'reactionQuotientQ' | 'equilibriumConstantK'> {
  if (status === 'OPEN') return {};
  return {
    ...(source.equilibriumDrivingStrength === undefined ? {} : { drivingStrength: source.equilibriumDrivingStrength }),
    ...(source.lnQOverK === undefined ? {} : { lnQOverK: source.lnQOverK }),
    ...(source.reactionQuotientQ === undefined ? {} : { reactionQuotientQ: source.reactionQuotientQ }),
    ...(source.equilibriumConstantK === undefined ? {} : { equilibriumConstantK: source.equilibriumConstantK }),
  };
}

export function projectEventEquilibrium(
  event: Phase3BReactionFactProjection,
): EquilibriumPresentationView | undefined {
  if (event.equilibriumDirection === undefined || event.equilibriumScientificStatus === undefined) return undefined;
  const direction = event.equilibriumDirection as EquilibriumDisplayDirection;
  const scientificStatus = event.equilibriumScientificStatus as ScientificStatus;
  return {
    direction,
    directionLabel: equilibriumDirectionLabel(direction),
    scientificStatus,
    reversible: true,
    ...numericEvidence(scientificStatus, event),
  };
}

export function projectPairEquilibrium(
  pair: ReversiblePairArbitrationFact,
  index: number,
): ReversiblePairPresentationView {
  const direction = pair.equilibriumDirection as EquilibriumDisplayDirection;
  const scientificStatus = pair.equilibriumScientificStatus as ScientificStatus;
  const numericSource: Phase3BReactionFactProjection = {
    eventId: '', timestepId: '', sequence: 0, candidateId: '', startTimeS: 0, endTimeS: 0, extentMol: 0,
    consumed: [], produced: [], scientificStatus: scientificStatus, reasonCodes: [],
    equilibriumDrivingStrength: pair.drivingStrength,
    ...(pair.lnQOverK === undefined ? {} : { lnQOverK: pair.lnQOverK }),
    ...(pair.reactionQuotientQ === undefined ? {} : { reactionQuotientQ: pair.reactionQuotientQ }),
    ...(pair.equilibriumConstantK === undefined ? {} : { equilibriumConstantK: pair.equilibriumConstantK }),
  };
  return {
    label: `가역 반응 ${index + 1}`,
    direction,
    directionLabel: equilibriumDirectionLabel(direction),
    scientificStatus,
    reversible: true,
    ...numericEvidence(scientificStatus, numericSource),
  };
}

export function projectEventDeveloperDiagnostic(event: Phase3BReactionFactProjection): ReactionDeveloperEventDiagnostic {
  return {
    eventId: event.eventId,
    candidateId: event.candidateId,
    consumedSpeciesRefs: event.consumed.map((item) => item.speciesRef),
    producedSpeciesRefs: event.produced.map((item) => item.speciesRef),
    ...(event.reversiblePairId === undefined ? {} : { reversiblePairId: event.reversiblePairId }),
    ...(event.channelDirection === undefined ? {} : { channelDirection: event.channelDirection }),
    ...(event.equilibriumDirection === undefined ? {} : { equilibriumDirection: event.equilibriumDirection as EquilibriumDisplayDirection }),
    ...(event.equilibriumScientificStatus === undefined ? {} : { equilibriumScientificStatus: event.equilibriumScientificStatus as ScientificStatus }),
    ...(event.equilibriumDrivingStrength === undefined ? {} : { equilibriumDrivingStrength: event.equilibriumDrivingStrength }),
    ...(event.lnQOverK === undefined ? {} : { lnQOverK: event.lnQOverK }),
    ...(event.reactionQuotientQ === undefined ? {} : { reactionQuotientQ: event.reactionQuotientQ }),
    ...(event.equilibriumConstantK === undefined ? {} : { equilibriumConstantK: event.equilibriumConstantK }),
  };
}

export function projectPairDeveloperDiagnostic(pair: ReversiblePairArbitrationFact): ReactionDeveloperPairDiagnostic {
  return {
    reversiblePairId: pair.reversiblePairId,
    equilibriumDirection: pair.equilibriumDirection as EquilibriumDisplayDirection,
    equilibriumScientificStatus: pair.equilibriumScientificStatus as ScientificStatus,
    ...(pair.selectedChannelDirection === undefined ? {} : { selectedChannelDirection: pair.selectedChannelDirection }),
    drivingStrength: pair.drivingStrength,
    maxNetProgressFraction: pair.maxNetProgressFraction,
    preventEquilibriumCrossing: pair.preventEquilibriumCrossing,
    ...(pair.maxExtentTowardEquilibriumMol === undefined ? {} : { maxExtentTowardEquilibriumMol: pair.maxExtentTowardEquilibriumMol }),
    ...(pair.lnQOverK === undefined ? {} : { lnQOverK: pair.lnQOverK }),
    ...(pair.reactionQuotientQ === undefined ? {} : { reactionQuotientQ: pair.reactionQuotientQ }),
    ...(pair.equilibriumConstantK === undefined ? {} : { equilibriumConstantK: pair.equilibriumConstantK }),
    reasonCodes: pair.reasonCodes,
  };
}

export function formatProviderNumber(value: number, status: ScientificStatus): string {
  const prefix = status === 'APPROXIMATED' ? '≈ ' : '';
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
}
