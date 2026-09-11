import type { LaboratoryProviderValue, SubstanceSummary } from './types';

export function selectVisibleInventory(lab: Pick<LaboratoryProviderValue, 'catalog' | 'snapshot'>): SubstanceSummary[] {
  if (lab.snapshot.developerMode) return lab.catalog;
  const unlocked = new Set(lab.snapshot.unlockedSpeciesIds);
  return lab.catalog.filter((species) => unlocked.has(species.speciesId));
}

export function selectSpecies(catalog: SubstanceSummary[], speciesId?: string) {
  return catalog.find((species) => species.speciesId === speciesId);
}

export function selectCurrentUnknown(lab: Pick<LaboratoryProviderValue, 'snapshot'>) {
  return lab.snapshot.unknownObservations.find((item) => item.analysisState !== 'confirmed');
}
