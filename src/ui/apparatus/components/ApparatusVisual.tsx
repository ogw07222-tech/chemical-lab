import type { ApparatusType } from '../../workbench';
import { getApparatusCatalogEntry } from '../catalog/catalog';

export interface ApparatusVisualProps {
  type: ApparatusType;
  label?: string;
}

export function ApparatusVisual({ type, label }: ApparatusVisualProps) {
  const entry = getApparatusCatalogEntry(type);
  const name = label ?? entry?.label ?? type;

  return (
    <div className={`apparatus-visual apparatus-${type.toLowerCase()}`} aria-label={`${name} visual`}>
      <div className="apparatus-shape" aria-hidden="true">
        {type === 'BEAKER' && <div className="shape-beaker" />}
        {type === 'FLASK' && <div className="shape-flask"><span /></div>}
        {type === 'SEALED_VESSEL' && <div className="shape-sealed-vessel"><span /></div>}
        {type === 'HOT_PLATE' && <div className="shape-hot-plate"><span /></div>}
        {type === 'MAGNETIC_STIRRER' && <div className="shape-stirrer"><span>↻</span></div>}
        {type === 'HEATING_BATH' && <div className="shape-bath">H</div>}
        {type === 'HOT_AIR_CHAMBER' && <div className="shape-chamber">AIR</div>}
        {type === 'COOLING_BATH' && <div className="shape-bath">C</div>}
        {type === 'VACUUM_PUMP' && <div className="shape-pump"><span /></div>}
        {type === 'GAS_COLLECTOR' && <div className="shape-collector"><span /></div>}
        {type === 'FILTER_APPARATUS' && <div className="shape-filter"><span /></div>}
        {type === 'CONDENSER' && <div className="shape-condenser"><span /></div>}
        {type === 'POWER_SUPPLY' && <div className="shape-power">±</div>}
        {type === 'TEMPERATURE_PROBE' && <div className="shape-probe"><span>T</span></div>}
        {type === 'PRESSURE_SENSOR' && <div className="shape-probe"><span>P</span></div>}
        {type === 'ANALYSIS_INSTRUMENT' && <div className="shape-analysis">A</div>}
      </div>
      <small>{name}</small>
    </div>
  );
}
