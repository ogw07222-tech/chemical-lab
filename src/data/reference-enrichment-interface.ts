import type {
  ReferenceMatchStatus,
  ScientificMatchInput,
  ScientificReferenceMatch,
} from "./reference-enrichment";

/**
 * Public 03 handoff name. 01 currently has its own registry-local
 * `ReferenceMatchStatus` placeholder (`KNOWN_SEED | OPEN`), so consumers
 * integrating the two workstreams should use this explicitly named alias
 * rather than conflating the two independent contracts.
 */
export type ScientificReferenceMatchStatus = ReferenceMatchStatus;

export interface ScientificReferenceMatcher {
  match(input: ScientificMatchInput): ScientificReferenceMatch;
}
