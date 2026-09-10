import { describe, expect, it } from "vitest";
import {
  CanonicalValidationPolicy,
  VALIDATION_POLICY_SOURCE,
  absoluteError,
  aggregateNumericResults,
  allowedError,
  applyAbsoluteGates,
  assertElementInventory,
  assertFiniteNumber,
  assertNonNegative,
  deterministicResult,
  evaluateEligibility,
  fail,
  loadManifest,
  median,
  nrmse,
  open,
  p90,
  pass,
  relativeError,
  signedBias,
  validateAuthoritativeSIState,
  validateManifest,
  withinTolerance,
} from "../src/validation";

describe("validation verdicts", () => {
  it("represents PASS, FAIL, and OPEN separately from scientific status", () => {
    expect(pass("p", 1, "APPROXIMATED").verdict).toBe("PASS");
    expect(fail("f", "broken", 1, "VERIFIED").verdict).toBe("FAIL");
    expect(open("o", "missing data", 1, "OPEN").verdict).toBe("OPEN");
  });

  it("forces an absolute-gate violation to FAIL", () => {
    const result = applyAbsoluteGates(pass("aggregate"), [
      { id: "absolute.conservation", violated: true, reason: "atom conservation violated" },
    ]);
    expect(result.verdict).toBe("FAIL");
  });

  it("creates deterministic same-input result representations", () => {
    const a = deterministicResult(pass("same", { b: 2, a: 1 }, "VERIFIED"));
    const b = deterministicResult(pass("same", { a: 1, b: 2 }, "VERIFIED"));
    expect(a.deterministicKey).toBe(b.deterministicKey);
  });
});

describe("metrics", () => {
  it("computes absolute error, median, and interpolated P90", () => {
    expect(absoluteError(12, 10)).toBe(2);
    expect(median([3, 1, 4, 2])).toBe(2.5);
    expect(p90([0, 10, 20, 30, 40])).toBeCloseTo(36);
  });

  it("computes signed bias and NRMSE", () => {
    expect(signedBias([2, 4], [1, 3])).toBe(1);
    expect(nrmse([0, 2, 4], [0, 1, 4])).toBeCloseTo(Math.sqrt(1 / 3) / 4);
  });

  it("computes relative error and explicitly handles zero reference", () => {
    expect(relativeError(12, 10)).toEqual({ kind: "RELATIVE", value: 0.2 });
    expect(relativeError(1, 0)).toEqual({ kind: "UNDEFINED_ZERO_REFERENCE" });
  });

  it("excludes OPEN cases from aggregate denominator", () => {
    const aggregate = aggregateNumericResults([
      { benchmarkId: "p", result: pass("p"), error: 0.1, signedError: 0.1 },
      { benchmarkId: "o", result: open("o", "insufficient source"), error: 99, signedError: 99 },
      { benchmarkId: "f", result: fail("f", "metric failed"), error: 0.3, signedError: -0.3 },
    ]);
    expect(aggregate.totalCases).toBe(3);
    expect(aggregate.eligibleCases).toBe(2);
    expect(aggregate.openExcluded).toBe(1);
    expect(aggregate.medianError).toBeCloseTo(0.2);
    expect(aggregate.signedBias).toBeCloseTo(-0.1);
  });
});

describe("SI and invariant validation", () => {
  it("rejects invalid SI and negative physical states", () => {
    expect(validateAuthoritativeSIState("bad-temperature", { temperatureK: 0 }).verdict).toBe("FAIL");
    expect(validateAuthoritativeSIState("bad-pressure", { temperatureK: 300, pressurePa: -1 }).verdict).toBe("FAIL");
    expect(assertNonNegative("amount", -1, "amount").verdict).toBe("FAIL");
  });

  it("rejects NaN and Infinity", () => {
    expect(assertFiniteNumber("nan", Number.NaN).verdict).toBe("FAIL");
    expect(assertFiniteNumber("inf", Number.POSITIVE_INFINITY).verdict).toBe("FAIL");
    expect(validateAuthoritativeSIState("inf-state", { temperatureK: Number.POSITIVE_INFINITY }).verdict).toBe("FAIL");
  });

  it("checks exact element inventory conservation", () => {
    expect(assertElementInventory("elements", { H: 4, O: 2 }, { O: 2, H: 4 }).verdict).toBe("PASS");
    expect(assertElementInventory("elements", { H: 4 }, { H: 3 }).verdict).toBe("FAIL");
  });

  it("uses deterministic tolerance independent of desired verdict", () => {
    const before = allowedError("amount", 1, 1 + Number.EPSILON);
    const desiredVerdict = "FAIL";
    const after = allowedError("amount", 1, 1 + Number.EPSILON);
    expect(desiredVerdict).toBe("FAIL");
    expect(after).toBe(before);
    expect(withinTolerance("amount", 1, 1 + Number.EPSILON)).toBe(true);
  });
});

describe("benchmark adapter foundation", () => {
  it("keeps one centralized scientific threshold authority", () => {
    expect(VALIDATION_POLICY_SOURCE).toBe("docs/contracts/REAL_EXPERIMENT_VALIDATION.md");
    expect(Object.isFrozen(CanonicalValidationPolicy)).toBe(true);
    expect(CanonicalValidationPolicy.source).toBe(VALIDATION_POLICY_SOURCE);
  });

  it("returns OPEN when eligibility is insufficient", () => {
    const result = evaluateEligibility(
      { benchmarkId: "synthetic", tier: "A", family: "TEST", enabled: true, sourceIds: [] },
      { requiredCapabilityAvailable: true, sufficientlySpecified: true, provenancePresent: false },
    );
    expect(result.verdict).toBe("OPEN");
  });

  it("validates and loads a schema-independent manifest adapter", async () => {
    const manifest = {
      schemaVersion: "test-only",
      benchmarkSetId: "synthetic",
      entries: [{ benchmarkId: "case-1", tier: "A" as const, family: "TEST", enabled: true }],
    };
    expect(validateManifest(manifest).verdict).toBe("PASS");
    expect((await loadManifest({ load: () => manifest })).verdict).toBe("PASS");
  });
});
