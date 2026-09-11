import type {
  DynamicSpeciesRegistryLike,
  DynamicSpeciesRegistryOptions,
} from "../src/simulation/species-registry";

declare module "../src/simulation/species-registry" {
  function createDynamicSpeciesRegistry(options: DynamicSpeciesRegistryOptions): DynamicSpeciesRegistryLike;
}
