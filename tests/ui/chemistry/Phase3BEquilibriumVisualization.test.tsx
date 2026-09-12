import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Phase3BProviderProjection, Phase3BReactionFactProjection } from '../../../src/integration/phase3b-reversible-arbitration';
import { LaboratoryWorkspace } from '../../../src/ui/App';
import { EquilibriumDetails, EquilibriumInlineStatus } from '../../../src/ui/chemistry/equilibrium/EquilibriumPresentation';
import { projectEventEquilibrium, projectPairEquilibrium } from '../../../src/ui/chemistry/equilibrium/presentation';
import { MockLaboratoryProvider } from '../../../src/ui/provider';
import { projectPhase3BReactionUi, type PlayerSpeciesKnowledgeResolver } from '../../../src/ui/reactionProjection';

function event(overrides: Partial<Phase3BReactionFactProjection> = {}): Phase3BReactionFactProjection {
  return {
    eventId: 'event-1', timestepId: 'step-1', sequence: 0, candidateId: 'internal-candidate',
    startTimeS: 0, endTimeS: 1, extentMol: 0.1,
    consumed: [{ speciesRef: 'generated:hidden-a', amountMol: 0.1 }],
    produced: [{ speciesRef: 'known-b', amountMol: 0.1 }],
    scientificStatus: 'APPROXIMATED', reasonCodes: ['SELECTED'],
    reversiblePairId: 'internal:pair-secret', channelDirection: 'FORWARD',
    equilibriumDirection: 'FORWARD', equilibriumScientificStatus: 'APPROXIMATED',
    ...overrides,
  };
}

const resolveSpecies: PlayerSpeciesKnowledgeResolver = (speciesRef) => speciesRef === 'known-b'
  ? { unknownRef: 'known-b', displayLabel: 'B', identityConfirmed: true, knownSpeciesId: 'known-b' }
  : { unknownRef: 'opaque-a', displayLabel: 'Unknown α', identityConfirmed: false };

function providerWith(source: Phase3BReactionFactProjection): Phase3BProviderProjection {
  return {
    authoritativeVesselComposition: [
      { speciesRef: 'generated:hidden-a', amountMol: 0.4, phase: 'unknown', phaseStateId: 'hidden-phase-id' },
    ],
    activeReactionEvents: [source],
    timelineEvents: [source, source],
    reversiblePairs: [{
      reversiblePairId: 'internal:pair-secret',
      equilibriumDirection: source.equilibriumDirection ?? 'INDETERMINATE',
      equilibriumScientificStatus: source.equilibriumScientificStatus ?? 'OPEN',
      ...(source.equilibriumDirection === 'FORWARD' || source.equilibriumDirection === 'REVERSE'
        ? { selectedChannelDirection: source.equilibriumDirection }
        : {}),
      drivingStrength: source.equilibriumDrivingStrength ?? 0,
      maxNetProgressFraction: 0,
      preventEquilibriumCrossing: false,
      ...(source.lnQOverK === undefined ? {} : { lnQOverK: source.lnQOverK }),
      ...(source.reactionQuotientQ === undefined ? {} : { reactionQuotientQ: source.reactionQuotientQ }),
      ...(source.equilibriumConstantK === undefined ? {} : { equilibriumConstantK: source.equilibriumConstantK }),
      reasonCodes: source.equilibriumScientificStatus === 'OPEN'
        ? ['EQUILIBRIUM_ARBITRATION_ABSTAINS']
        : ['THERMODYNAMIC_DRIVE_SUPPORTED'],
    }],
  };
}

describe('Phase 3B equilibrium presentation projection', () => {
  it.each([
    ['FORWARD', '정방향 우세'],
    ['REVERSE', '역방향 우세'],
    ['NEAR_EQUILIBRIUM', '평형 근처'],
    ['INDETERMINATE', '평형 방향 미확정'],
  ] as const)('displays authoritative %s direction without deriving it', (direction, label) => {
    const view = projectEventEquilibrium(event({ equilibriumDirection: direction, lnQOverK: direction === 'FORWARD' ? 10 : -10 }));
    expect(view?.direction).toBe(direction);
    expect(view?.directionLabel).toBe(label);
    render(<EquilibriumInlineStatus value={view}/>);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('preserves provider-supplied Q, K, ln(Q/K), drivingStrength including numeric zero', () => {
    const view = projectEventEquilibrium(event({
      equilibriumDrivingStrength: 0,
      lnQOverK: 0,
      reactionQuotientQ: 0,
      equilibriumConstantK: 0.5,
    }));
    expect(view).toMatchObject({ drivingStrength: 0, lnQOverK: 0, reactionQuotientQ: 0, equilibriumConstantK: 0.5 });
  });

  it('does not invent missing numeric fields', () => {
    const view = projectEventEquilibrium(event());
    expect(view).not.toHaveProperty('drivingStrength');
    expect(view).not.toHaveProperty('lnQOverK');
    expect(view).not.toHaveProperty('reactionQuotientQ');
    expect(view).not.toHaveProperty('equilibriumConstantK');
  });

  it('suppresses OPEN numeric evidence from the player presentation', () => {
    const view = projectEventEquilibrium(event({
      equilibriumDirection: 'INDETERMINATE', equilibriumScientificStatus: 'OPEN',
      equilibriumDrivingStrength: 0, lnQOverK: 0, reactionQuotientQ: 0, equilibriumConstantK: 1,
    }));
    expect(view?.scientificStatus).toBe('OPEN');
    expect(view).not.toHaveProperty('drivingStrength');
    expect(view).not.toHaveProperty('lnQOverK');
    expect(view).not.toHaveProperty('reactionQuotientQ');
    expect(view).not.toHaveProperty('equilibriumConstantK');
  });

  it('marks APPROXIMATED numeric evidence, preserves zero, and labels only missing values unavailable', () => {
    const pair = projectPairEquilibrium(providerWith(event({ reactionQuotientQ: 0.25, equilibriumConstantK: 0.5 })).reversiblePairs[0]!, 0);
    render(<EquilibriumDetails pairs={[pair]}/>);
    expect(screen.getByText('≈ 0.25')).toBeInTheDocument();
    expect(screen.getByText('≈ 0.5')).toBeInTheDocument();
    expect(screen.getByText('≈ 0')).toBeInTheDocument();
    expect(screen.getAllByText('제공되지 않음')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: '가역 반응 / 평형' })).toBeInTheDocument();
  });

  it('keeps hidden species, candidate and pair ids out of normal projection while DEV retains diagnostics', () => {
    const provider = providerWith(event({ reactionQuotientQ: 0.25 }));
    const normal = projectPhase3BReactionUi(provider, resolveSpecies, false);
    expect(normal.contents[0]?.opaqueLabel).toBe('Unknown α');
    expect(JSON.stringify(normal)).not.toContain('generated:hidden-a');
    expect(JSON.stringify(normal)).not.toContain('internal-candidate');
    expect(JSON.stringify(normal)).not.toContain('internal:pair-secret');

    const dev = projectPhase3BReactionUi(provider, resolveSpecies, true);
    expect(JSON.stringify(dev.developerDiagnostics)).toContain('generated:hidden-a');
    expect(JSON.stringify(dev.developerDiagnostics)).toContain('internal-candidate');
    expect(JSON.stringify(dev.developerDiagnostics)).toContain('internal:pair-secret');
  });

  it('deduplicates Phase 3B timeline delivery by eventId while preserving provider order', () => {
    const first = event({ eventId: 'event-a', endTimeS: 1 });
    const second = event({ eventId: 'event-b', endTimeS: 2, equilibriumDirection: 'REVERSE' });
    const initial = providerWith(first);
    const provider: Phase3BProviderProjection = { ...initial, timelineEvents: [first, second, first] };
    const view = projectPhase3BReactionUi(provider, resolveSpecies, false);
    expect(view.reactionEvents.map((item) => item.id)).toEqual(['event-a', 'event-b']);
    expect(view.reactionEvents.map((item) => item.timelineOrder)).toEqual([0, 1]);
  });
});

describe('Phase 3B production workspace integration', () => {
  it('enriches compact Reaction Activity and secondary equilibrium detail without exposing raw pair id', () => {
    render(<MockLaboratoryProvider scenario="reaction-network"><LaboratoryWorkspace /></MockLaboratoryProvider>);
    const main = screen.getByRole('main', { name: '실험실 작업대' });
    const activity = within(main).getByRole('region', { name: '반응 활동' });
    expect(within(activity).getByText('정방향 우세')).toBeInTheDocument();
    expect(activity).toHaveTextContent('≈ 근사');
    expect(main).not.toHaveTextContent('internal:fixture-reversible-pair');

    fireEvent.click(within(main).getByRole('button', { name: '평형' }));
    expect(within(main).getByRole('heading', { name: '가역 반응 / 평형' })).toBeInTheDocument();
    expect(within(main).getByText('≈ 0.25')).toBeInTheDocument();
    expect(within(main).getByText('≈ 0.667')).toBeInTheDocument();
    expect(main).not.toHaveTextContent('internal:fixture-reversible-pair');
  });

  it('keeps Developer equilibrium diagnostics on a separate DEV-only surface', () => {
    render(<MockLaboratoryProvider scenario="reaction-network"><LaboratoryWorkspace /></MockLaboratoryProvider>);
    const main = screen.getByRole('main', { name: '실험실 작업대' });
    fireEvent.click(within(main).getByRole('button', { name: '평형' }));
    expect(within(main).queryByLabelText('Developer equilibrium diagnostics')).not.toBeInTheDocument();
    const catalog = screen.getByRole('complementary', { name: '도감' });
    fireEvent.click(within(catalog).getByLabelText('Developer Mode'));
    const diagnostics = within(main).getByLabelText('Developer equilibrium diagnostics');
    expect(diagnostics).toBeInTheDocument();
    expect(within(diagnostics).getByText('internal:fixture-reversible-pair')).toBeInTheDocument();
  });

  it('keeps Phase 3A timeline dedupe and unknown identity privacy after Phase 3B enrichment', () => {
    render(<MockLaboratoryProvider scenario="reaction-network"><LaboratoryWorkspace /></MockLaboratoryProvider>);
    const main = screen.getByRole('main', { name: '실험실 작업대' });
    fireEvent.click(within(main).getByRole('button', { name: '타임라인' }));
    const timeline = within(main).getByRole('region', { name: '반응 타임라인' });
    expect(within(timeline).getAllByLabelText(/반응 단계/)).toHaveLength(2);
    expect(timeline).toHaveTextContent('Unknown α');
    expect(timeline).not.toHaveTextContent('generated:fixture-water');
    expect(timeline).not.toHaveTextContent('internal:fixture-reversible-pair');
  });
});
