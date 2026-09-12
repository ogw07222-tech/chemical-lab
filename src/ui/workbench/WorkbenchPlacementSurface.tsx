import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  ApparatusChildRenderer,
  ApparatusId,
  ApparatusInstance,
  ApparatusPlacement,
  WorkbenchPosition,
  WorkbenchSlot,
} from './types';
import './workbench.css';

export interface WorkbenchPlacementSurfaceProps {
  apparatus?: readonly ApparatusInstance[];
  placements?: readonly ApparatusPlacement[];
  slots?: readonly WorkbenchSlot[];
  selectedApparatusId?: ApparatusId;
  focusedApparatusId?: ApparatusId;
  onSelectedApparatusChange?: (apparatusId: ApparatusId) => void;
  onFocusedApparatusChange?: (apparatusId: ApparatusId) => void;
  renderApparatus?: ApparatusChildRenderer;
  baseLayer?: ReactNode;
  emptyState?: ReactNode;
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

function resolvePosition(placement: ApparatusPlacement, slots: readonly WorkbenchSlot[]): WorkbenchPosition | undefined {
  if (placement.position) return placement.position;
  if (!placement.slotId) return undefined;
  return slots.find((slot) => slot.id === placement.slotId)?.position;
}

function placementStyle(position: WorkbenchPosition | undefined, zIndex: number, focused: boolean): CSSProperties {
  if (!position) return { zIndex: zIndex + (focused ? 1000 : 0) };
  return {
    left: `${clampPercent(position.xPercent)}%`,
    top: `${clampPercent(position.yPercent)}%`,
    zIndex: zIndex + (focused ? 1000 : 0),
  };
}

export function WorkbenchPlacementSurface({
  apparatus = [],
  placements = [],
  slots = [],
  selectedApparatusId,
  focusedApparatusId,
  onSelectedApparatusChange,
  onFocusedApparatusChange,
  renderApparatus,
  baseLayer,
  emptyState,
}: WorkbenchPlacementSurfaceProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<ApparatusId>();
  const [internalFocusedId, setInternalFocusedId] = useState<ApparatusId>();
  const selectedId = selectedApparatusId ?? internalSelectedId;
  const focusedId = focusedApparatusId ?? internalFocusedId;
  const placementById = useMemo(() => new Map(placements.map((placement) => [placement.apparatusId, placement])), [placements]);

  const select = (apparatusId: ApparatusId) => {
    if (selectedApparatusId === undefined) setInternalSelectedId(apparatusId);
    onSelectedApparatusChange?.(apparatusId);
  };
  const focus = (apparatusId: ApparatusId) => {
    if (focusedApparatusId === undefined) setInternalFocusedId(apparatusId);
    onFocusedApparatusChange?.(apparatusId);
  };

  return (
    <section className="lab-wall workbench-placement-surface" aria-label="기구 배치 영역">
      <div className="workbench-base-layer">{baseLayer}</div>
      <div className="workbench-apparatus-layer">
        {apparatus.map((instance, index) => {
          const placement = placementById.get(instance.id) ?? { apparatusId: instance.id };
          const position = resolvePosition(placement, slots);
          const selected = selectedId === instance.id;
          const focused = focusedId === instance.id;
          const zIndex = placement.zIndex ?? index + 1;
          return (
            <div
              key={instance.id}
              role="group"
              aria-label={`${instance.type} 기구`}
              tabIndex={0}
              className={`apparatus-placement-item${selected ? ' selected' : ''}${focused ? ' focused' : ''}`}
              data-apparatus-id={instance.id}
              data-apparatus-type={instance.type}
              data-slot-id={placement.slotId}
              data-placement-resolved={position ? 'true' : 'false'}
              style={placementStyle(position, zIndex, focused)}
              onClick={() => select(instance.id)}
              onFocus={() => focus(instance.id)}
            >
              {renderApparatus?.({
                instance,
                placement,
                selected,
                focused,
                select: () => select(instance.id),
                focus: () => focus(instance.id),
              })}
            </div>
          );
        })}
        {apparatus.length === 0 && emptyState ? <div className="workbench-empty-state">{emptyState}</div> : null}
      </div>
    </section>
  );
}
