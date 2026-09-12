import type { ApparatusType } from '../../workbench';
import { APPARATUS_CATALOG } from '../catalog/catalog';
import { ApparatusVisual } from './ApparatusVisual';

export interface ApparatusCatalogProps {
  onCreateRequest?: (type: ApparatusType) => void;
}

export function ApparatusCatalog({ onCreateRequest }: ApparatusCatalogProps) {
  return (
    <aside className="apparatus-catalog" aria-label="Apparatus Catalog">
      <header><strong>APPARATUS</strong><small>placement request only</small></header>
      {[1, 2, 3].map((tier) => (
        <section key={tier} aria-label={`Tier ${tier}`}>
          <h3>TIER {tier}</h3>
          <div className="apparatus-catalog-grid">
            {APPARATUS_CATALOG.filter((entry) => entry.tier === tier).map((entry) => (
              <button key={entry.type} type="button" onClick={() => onCreateRequest?.(entry.type)} aria-label={`Add ${entry.label}`}>
                <ApparatusVisual type={entry.type} />
              </button>
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}
