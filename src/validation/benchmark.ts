import { fail, open, pass, type ScientificModelStatus, type ValidationResult } from "./core";
import { median, p90, signedBias } from "./metrics";

export interface BenchmarkAdapterRecord {
  readonly benchmarkId: string;
  readonly tier: "A" | "B" | "C" | "D";
  readonly family: string;
  readonly enabled: boolean;
  readonly confidence?: string;
  readonly scientificStatus?: ScientificModelStatus;
  readonly sourceIds?: readonly string[];
  readonly exclusionReason?: string;
}

export interface BenchmarkManifestAdapter {
  readonly schemaVersion: string;
  readonly benchmarkSetId: string;
  readonly entries: readonly BenchmarkAdapterRecord[];
}

export interface ManifestSource<TManifest = BenchmarkManifestAdapter> {
  load(): Promise<TManifest> | TManifest;
}

export interface BenchmarkEligibilityContext {
  readonly requiredCapabilityAvailable: boolean;
  readonly sufficientlySpecified: boolean;
  readonly provenancePresent: boolean;
}

export function evaluateEligibility(
  benchmark: BenchmarkAdapterRecord,
  context: BenchmarkEligibilityContext,
): ValidationResult<BenchmarkAdapterRecord> {
  if (!benchmark.enabled) return open(benchmark.benchmarkId, "benchmark disabled", benchmark, benchmark.scientificStatus);
  if (benchmark.exclusionReason) return open(benchmark.benchmarkId, benchmark.exclusionReason, benchmark, benchmark.scientificStatus);
  if (!context.requiredCapabilityAvailable) return open(benchmark.benchmarkId, "required model capability unavailable", benchmark, benchmark.scientificStatus);
  if (!context.sufficientlySpecified) return open(benchmark.benchmarkId, "benchmark is insufficiently specified for like-with-like comparison", benchmark, benchmark.scientificStatus);
  if (!context.provenancePresent || !benchmark.sourceIds?.length) return open(benchmark.benchmarkId, "scientific provenance missing", benchmark, benchmark.scientificStatus);
  return pass(benchmark.benchmarkId, benchmark, benchmark.scientificStatus);
}

export interface NumericBenchmarkResult {
  readonly benchmarkId: string;
  readonly result: ValidationResult;
  readonly error?: number;
  readonly signedError?: number;
}

export interface AggregateMetrics {
  readonly totalCases: number;
  readonly eligibleCases: number;
  readonly openExcluded: number;
  readonly failedCases: number;
  readonly medianError?: number;
  readonly p90Error?: number;
  readonly maxError?: { benchmarkId: string; error: number };
  readonly signedBias?: number;
}

export function aggregateNumericResults(results: readonly NumericBenchmarkResult[]): AggregateMetrics {
  const included = results.filter((item) => item.result.verdict !== "OPEN");
  const numeric = included.filter((item): item is NumericBenchmarkResult & { error: number } => item.error !== undefined);
  const signed = included.filter((item): item is NumericBenchmarkResult & { signedError: number } => item.signedError !== undefined);
  const errors = numeric.map((item) => item.error);
  const max = numeric.reduce<NumericBenchmarkResult & { error: number } | undefined>(
    (current, item) => !current || item.error > current.error ? item : current,
    undefined,
  );
  return {
    totalCases: results.length,
    eligibleCases: included.length,
    openExcluded: results.length - included.length,
    failedCases: included.filter((item) => item.result.verdict === "FAIL").length,
    medianError: errors.length ? median(errors) : undefined,
    p90Error: errors.length ? p90(errors) : undefined,
    maxError: max ? { benchmarkId: max.benchmarkId, error: max.error } : undefined,
    signedBias: signed.length ? signedBias(signed.map((item) => item.signedError), signed.map(() => 0)) : undefined,
  };
}

export function validateManifest(manifest: BenchmarkManifestAdapter): ValidationResult<BenchmarkManifestAdapter> {
  if (!manifest.schemaVersion || !manifest.benchmarkSetId) return fail("manifest", "manifest identity/version missing", manifest);
  const ids = new Set<string>();
  for (const entry of manifest.entries) {
    if (!entry.benchmarkId || !entry.family) return fail("manifest", "benchmark entry identity/family missing", manifest);
    if (ids.has(entry.benchmarkId)) return fail("manifest", `duplicate benchmark id: ${entry.benchmarkId}`, manifest);
    ids.add(entry.benchmarkId);
  }
  return pass("manifest", manifest);
}
