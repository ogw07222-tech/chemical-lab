import { fail, open, pass, stableSerialize, type ValidationResult } from "./core";
import { assertElementInventory, assertExactInvariant } from "./invariants";
import { validateAuthoritativeSIState } from "./core";

export interface RegistryResolutionObservation {
  readonly speciesId: string;
  readonly canonicalKey: string;
  readonly structuralRepresentation?: string;
  readonly created: boolean;
  readonly knownSpecies: boolean;
  readonly exactStructureVerified?: boolean;
}

export interface RegistrySizeObservation {
  readonly attempts: number;
  readonly initialSize: number;
  readonly finalSize: number;
  readonly resolvedSpeciesIds: readonly string[];
  readonly resolvedCanonicalKeys: readonly string[];
}

export interface CollisionSafetyObservation {
  readonly left: RegistryResolutionObservation;
  readonly right: RegistryResolutionObservation;
}

export interface FailedRegistrationAtomicityObservation {
  readonly registrationFailed: boolean;
  readonly beforeRegistry: unknown;
  readonly afterRegistry: unknown;
  readonly beforeVessel: unknown;
  readonly afterVessel: unknown;
}

export interface RegistryConservationObservation {
  readonly beforeElements: Readonly<Record<string, number>>;
  readonly afterElements: Readonly<Record<string, number>>;
  readonly beforeAtomCount: number;
  readonly afterAtomCount: number;
  readonly beforeCharge: number;
  readonly afterCharge: number;
  readonly amountsMol: readonly number[];
}

export interface RegistryTimestepObservation {
  readonly productSpeciesId: string;
  readonly existsAtEndOfStepN: boolean;
  readonly availableToStepNPlus1CandidateGeneration: boolean;
  readonly participatedInSameStepCascade: boolean;
}

export interface RegistryPersistenceObservation {
  readonly before: RegistryResolutionObservation;
  readonly afterRestore: RegistryResolutionObservation;
  readonly serializedBefore: unknown;
  readonly serializedAfterRestore: unknown;
  readonly nextStepBehaviorBefore?: unknown;
  readonly nextStepBehaviorAfter?: unknown;
}

export interface RegistryDeterminismObservation {
  readonly generatedSpeciesIds: readonly string[];
  readonly canonicalKeys: readonly string[];
  readonly finalVesselAmountsMol: readonly number[];
  readonly reactionProgressEvents: readonly unknown[];
  readonly registrySerialization: unknown;
}

export interface RegistryPerformanceSample {
  readonly registrySize: number;
  readonly lookupMs: number;
  readonly resolveRegisterMs: number;
  readonly timestepOverheadMs: number;
}

export interface RegistryPerformanceBudget {
  readonly maxLookupMs?: number;
  readonly maxResolveRegisterMs?: number;
  readonly maxTimestepOverheadMs?: number;
}

export interface UnknownSpeciesObservation {
  readonly structurallyAccepted: boolean;
  readonly generatedIdentityCreated: boolean;
  readonly fabricatedRealWorldIdentity: boolean;
  readonly fabricatedProperties: boolean;
}

export interface KnownSpeciesReuseObservation {
  readonly existingSpeciesId: string;
  readonly resolved: RegistryResolutionObservation;
}

export interface DynamicSpeciesRegistryValidationAdapter<TRegistry, TGraph, TVessel, TStepInput, TStepResult> {
  readonly createRegistry: () => TRegistry;
  readonly resolveOrRegister: (registry: TRegistry, graph: TGraph) => RegistryResolutionObservation;
  readonly registrySize: (registry: TRegistry) => number;
  readonly serializeRegistry: (registry: TRegistry) => unknown;
  readonly restoreRegistry: (serialized: unknown) => TRegistry;
  readonly snapshotVessel: (vessel: TVessel) => unknown;
  readonly step: (registry: TRegistry, vessel: TVessel, input: TStepInput) => TStepResult;
}

export function validateCanonicalIdentity(
  baseline: RegistryResolutionObservation,
  reordered: readonly RegistryResolutionObservation[],
): ValidationResult {
  for (const resolution of reordered) {
    if (resolution.canonicalKey !== baseline.canonicalKey) {
      return fail("registry.canonical-identity", "equivalent graph produced a different canonical key");
    }
    if (resolution.speciesId !== baseline.speciesId) {
      return fail("registry.canonical-identity", "equivalent graph produced a different species identity");
    }
  }
  return pass("registry.canonical-identity");
}

export function validateDistinctIdentity(
  left: RegistryResolutionObservation,
  right: RegistryResolutionObservation,
): ValidationResult {
  if (left.speciesId === right.speciesId) {
    return fail("registry.false-merge", "structurally distinct graphs resolved to the same species identity");
  }
  if (left.canonicalKey === right.canonicalKey) {
    const exactSafe = left.exactStructureVerified === true && right.exactStructureVerified === true;
    return exactSafe
      ? pass("registry.hash-collision-safe")
      : open("registry.hash-collision", "canonical-key collision observed without evidence of exact structural verification");
  }
  return pass("registry.false-merge");
}

export function validateDuplicateSuppression(observation: RegistrySizeObservation): ValidationResult {
  if (observation.attempts <= 0) return fail("registry.duplicate-suppression", "attempt count must be positive");
  if (observation.finalSize !== observation.initialSize + 1) {
    return fail("registry.duplicate-suppression", "repeated identical graph created more than one registry entry", observation);
  }
  if (new Set(observation.resolvedSpeciesIds).size !== 1 || new Set(observation.resolvedCanonicalKeys).size !== 1) {
    return fail("registry.duplicate-suppression", "repeated identical graph resolved inconsistently", observation);
  }
  return pass("registry.duplicate-suppression", observation);
}

export function validateFailedRegistrationAtomicity(
  observation: FailedRegistrationAtomicityObservation,
): ValidationResult {
  if (!observation.registrationFailed) {
    return open("registry.atomic-mutation", "fixture did not actually force registration failure");
  }
  if (stableSerialize(observation.beforeRegistry) !== stableSerialize(observation.afterRegistry)) {
    return fail("registry.atomic-mutation", "registry changed after failed product registration");
  }
  if (stableSerialize(observation.beforeVessel) !== stableSerialize(observation.afterVessel)) {
    return fail("registry.atomic-mutation", "vessel partially mutated after failed product registration");
  }
  return pass("registry.atomic-mutation");
}

export function validateGeneratedProductConservation(
  observation: RegistryConservationObservation,
): ValidationResult {
  const elements = assertElementInventory("registry.conservation.elements", observation.beforeElements, observation.afterElements);
  if (elements.verdict === "FAIL") return fail("registry.conservation", elements.reason ?? "element conservation failed");
  if (assertExactInvariant("registry.conservation.atoms", observation.beforeAtomCount, observation.afterAtomCount).verdict === "FAIL") {
    return fail("registry.conservation", "atom conservation failed");
  }
  if (assertExactInvariant("registry.conservation.charge", observation.beforeCharge, observation.afterCharge).verdict === "FAIL") {
    return fail("registry.conservation", "charge conservation failed");
  }
  for (const amountMol of observation.amountsMol) {
    const result = validateAuthoritativeSIState("registry.amount", { amountMol });
    if (result.verdict === "FAIL") return fail("registry.conservation", "non-finite or negative species amount");
  }
  return pass("registry.conservation");
}

export function validateTimestepSemantics(observation: RegistryTimestepObservation): ValidationResult {
  if (!observation.existsAtEndOfStepN) return fail("registry.timestep", "generated product is missing at end of producing timestep");
  if (!observation.availableToStepNPlus1CandidateGeneration) {
    return fail("registry.timestep", "generated product is inaccessible to next-timestep candidate generation");
  }
  if (observation.participatedInSameStepCascade) {
    return fail("registry.timestep", "newly generated species participated in a hidden same-step cascade");
  }
  return pass("registry.timestep");
}

export function validateRegistryDeterminism(
  first: RegistryDeterminismObservation,
  second: RegistryDeterminismObservation,
): ValidationResult {
  return stableSerialize(first) === stableSerialize(second)
    ? pass("registry.determinism")
    : fail("registry.determinism", "same inputs produced different registry/vessel/events/serialization");
}

export function validateRegistryPersistence(observation: RegistryPersistenceObservation): ValidationResult {
  if (observation.before.speciesId !== observation.afterRestore.speciesId) {
    return fail("registry.persistence", "species identity drifted across serialize/restore");
  }
  if (observation.before.canonicalKey !== observation.afterRestore.canonicalKey) {
    return fail("registry.persistence", "canonical key drifted across serialize/restore");
  }
  if (observation.afterRestore.created) {
    return fail("registry.persistence", "restored registry created a duplicate for an existing graph");
  }
  if (stableSerialize(observation.serializedBefore) !== stableSerialize(observation.serializedAfterRestore)) {
    return fail("registry.persistence", "registry serialization is not deterministic across restore");
  }
  if (
    observation.nextStepBehaviorBefore !== undefined &&
    observation.nextStepBehaviorAfter !== undefined &&
    stableSerialize(observation.nextStepBehaviorBefore) !== stableSerialize(observation.nextStepBehaviorAfter)
  ) {
    return fail("registry.persistence", "next-step behavior changed after registry restore");
  }
  return pass("registry.persistence");
}

export function validateKnownSpeciesReuse(observation: KnownSpeciesReuseObservation): ValidationResult {
  if (observation.resolved.speciesId !== observation.existingSpeciesId) {
    return fail("registry.known-reuse", "known species graph received a new generated identity");
  }
  if (observation.resolved.created) {
    return fail("registry.known-reuse", "known species graph was registered as a new species");
  }
  return pass("registry.known-reuse");
}

export function validateUnknownSpeciesHandling(observation: UnknownSpeciesObservation): ValidationResult {
  if (!observation.structurallyAccepted || !observation.generatedIdentityCreated) {
    return fail("registry.unknown-species", "valid unknown graph was not retained as an internal generated identity");
  }
  if (observation.fabricatedRealWorldIdentity) {
    return fail("registry.unknown-species", "registry fabricated a real-world identity without reference evidence");
  }
  if (observation.fabricatedProperties) {
    return fail("registry.unknown-species", "registry fabricated physical/chemical properties without evidence");
  }
  return pass("registry.unknown-species");
}

export function validateRegistryPerformance(
  samples: readonly RegistryPerformanceSample[],
  budget?: RegistryPerformanceBudget,
): ValidationResult<readonly RegistryPerformanceSample[]> {
  if (samples.length === 0) return open("registry.performance", "no performance samples", samples);
  for (const sample of samples) {
    if (
      !Number.isFinite(sample.registrySize) || sample.registrySize < 0 ||
      !Number.isFinite(sample.lookupMs) || sample.lookupMs < 0 ||
      !Number.isFinite(sample.resolveRegisterMs) || sample.resolveRegisterMs < 0 ||
      !Number.isFinite(sample.timestepOverheadMs) || sample.timestepOverheadMs < 0
    ) {
      return fail("registry.performance", "invalid performance sample", samples);
    }
  }
  if (!budget) {
    return open("registry.performance", "no canonical engineering performance threshold is committed; report baseline/WATCH only", samples);
  }
  for (const sample of samples) {
    if (budget.maxLookupMs !== undefined && sample.lookupMs > budget.maxLookupMs) return fail("registry.performance", "lookup budget exceeded", samples);
    if (budget.maxResolveRegisterMs !== undefined && sample.resolveRegisterMs > budget.maxResolveRegisterMs) return fail("registry.performance", "resolve/register budget exceeded", samples);
    if (budget.maxTimestepOverheadMs !== undefined && sample.timestepOverheadMs > budget.maxTimestepOverheadMs) return fail("registry.performance", "timestep overhead budget exceeded", samples);
  }
  return pass("registry.performance", samples);
}
