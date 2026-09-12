import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  WorkbenchPlacementSurface,
  type ApparatusId,
  type ApparatusInstance,
  type ApparatusPlacement,
  type WorkbenchSlot,
} from '../../workbench';
import type { ApparatusControlState, ApparatusProviderFacts, ApparatusUiIntent } from '../types';
import { ApparatusVisual } from './ApparatusVisual';
import { DeviceInspector } from '../inspector/DeviceInspector';

export interface ApparatusWorkspaceLayerProps {
  apparatus: readonly ApparatusInstance[];
  placements?: readonly ApparatusPlacement[];
  slots?: readonly WorkbenchSlot[];
  baseLayer?: ReactNode;
  selectedApparatusId?: ApparatusId;
  onSelectedApparatusChange?: (apparatusId: ApparatusId) => void;
  providerFactsById?: Readonly<Record<string, ApparatusProviderFacts | undefined>>;
  controlStateById?: Readonly<Record<string, ApparatusControlState | undefined>>;
  onControlStateChange?: (apparatusId: ApparatusId, next: ApparatusControlState) => void;
  onIntent?: (intent: ApparatusUiIntent) => void;
}

export function ApparatusWorkspaceLayer({
  apparatus,
  placements = [],
  slots = [],
  baseLayer,
  selectedApparatusId,
  onSelectedApparatusChange,
  providerFactsById,
  controlStateById,
  onControlStateChange,
  onIntent,
}: ApparatusWorkspaceLayerProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<ApparatusId>();
  const selectedId = selectedApparatusId ?? internalSelectedId;
  const selected = useMemo(() => apparatus.find((item) => item.id === selectedId), [apparatus, selectedId]);

  const select = (apparatusId: ApparatusId) => {
    if (selectedApparatusId === undefined) setInternalSelectedId(apparatusId);
    onSelectedApparatusChange?.(apparatusId);
  };

  return (
    <div className="apparatus-workspace-layer">
      <WorkbenchPlacementSurface
        apparatus={apparatus}
        placements={placements}
        slots={slots}
        baseLayer={baseLayer}
        selectedApparatusId={selectedId}
        onSelectedApparatusChange={select}
        renderApparatus={({ instance }) => <ApparatusVisual type={instance.type} />}
      />
      {selected ? (
        <DeviceInspector
          apparatusId={selected.id}
          type={selected.type}
          controlState={controlStateById?.[selected.id]}
          providerFacts={providerFactsById?.[selected.id]}
          onControlStateChange={(next) => onControlStateChange?.(selected.id, next)}
          onIntent={onIntent}
        />
      ) : null}
    </div>
  );
}
