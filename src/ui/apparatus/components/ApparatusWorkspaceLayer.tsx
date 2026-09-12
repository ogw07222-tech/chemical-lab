import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  WorkbenchPlacementSurface,
  type ApparatusId,
  type ApparatusInstance,
  type ApparatusPlacement,
  type WorkbenchSlot,
} from '../../workbench';
import type { ApparatusControlState, ApparatusIntentSupportMap, ApparatusProviderFacts, ApparatusUiIntent } from '../types';
import { ApparatusVisual } from './ApparatusVisual';
import { DeviceInspector } from '../inspector/DeviceInspector';

export interface ApparatusWorkspaceLayerProps {
  apparatus: readonly ApparatusInstance[];
  placements?: readonly ApparatusPlacement[];
  slots?: readonly WorkbenchSlot[];
  baseLayer?: ReactNode;
  selectedApparatusId?: ApparatusId;
  onSelectedApparatusChange?: (apparatusId: ApparatusId) => void;
  onInspectorClose?: () => void;
  providerFactsById?: Readonly<Record<string, ApparatusProviderFacts | undefined>>;
  intentSupportById?: Readonly<Record<string, ApparatusIntentSupportMap | undefined>>;
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
  onInspectorClose,
  providerFactsById,
  intentSupportById,
  controlStateById,
  onControlStateChange,
  onIntent,
}: ApparatusWorkspaceLayerProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<ApparatusId>();
  const selectedId = selectedApparatusId ?? internalSelectedId;
  const selected = useMemo(() => apparatus.find((item) => item.id === selectedId), [apparatus, selectedId]);
  const inspectorRef = useRef<HTMLElement>(null);
  const apparatusElements = useRef(new Map<ApparatusId, HTMLButtonElement>());
  const previousSelectedId = useRef<ApparatusId>();

  const select = (apparatusId: ApparatusId) => {
    previousSelectedId.current = apparatusId;
    if (selectedApparatusId === undefined) setInternalSelectedId(apparatusId);
    onSelectedApparatusChange?.(apparatusId);
  };

  useEffect(() => {
    if (selected) inspectorRef.current?.focus();
  }, [selected]);

  const closeInspector = () => {
    const returnId = selected?.id ?? previousSelectedId.current;
    if (selectedApparatusId === undefined) setInternalSelectedId(undefined);
    onInspectorClose?.();
    queueMicrotask(() => { if (returnId) apparatusElements.current.get(returnId)?.focus(); });
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
        onApparatusElementChange={(apparatusId, element) => {
          if (element) apparatusElements.current.set(apparatusId, element);
          else apparatusElements.current.delete(apparatusId);
        }}
        renderApparatus={({ instance }) => <ApparatusVisual type={instance.type} />}
      />
      {selected ? (
        <DeviceInspector
          ref={inspectorRef}
          apparatusId={selected.id}
          type={selected.type}
          controlState={controlStateById?.[selected.id]}
          providerFacts={providerFactsById?.[selected.id]}
          intentSupport={intentSupportById?.[selected.id]}
          onControlStateChange={(next) => onControlStateChange?.(selected.id, next)}
          onIntent={onIntent}
          onRequestClose={closeInspector}
        />
      ) : null}
    </div>
  );
}
