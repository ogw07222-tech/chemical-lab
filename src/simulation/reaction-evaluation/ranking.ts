import type { RankedReactionEvaluation, ReactionEvaluation } from "./types";

const SCORE_EPSILON = 1e-12;

function effectiveScore(evaluation: ReactionEvaluation): number | null {
  if (evaluation.rankScore !== null) return evaluation.rankScore;
  if (
    evaluation.kinetics.supportClass !== "DIMENSIONED_RATE" ||
    evaluation.kinetics.extentRateMolPerS === undefined ||
    !Number.isFinite(evaluation.kinetics.extentRateMolPerS) ||
    evaluation.kinetics.extentRateMolPerS < 0 ||
    evaluation.kinetics.approximationClass === "OPEN" ||
    evaluation.thermo.approximationClass === "OPEN"
  ) {
    return null;
  }

  // All dimensioned extent rates share mol/s. This monotonic compression is only
  // a deterministic ordering score; authoritative extent still uses rate * dt.
  const rate = evaluation.kinetics.extentRateMolPerS;
  return rate / (1 + rate);
}

/**
 * Deterministic ranking. OPEN/unavailable scores sort last with rank=null.
 * Stable ties receive the same rank; candidateId is only a deterministic
 * ordering tiebreaker and does not change tie semantics.
 */
export function rankReactionEvaluations(
  evaluations: readonly ReactionEvaluation[],
): RankedReactionEvaluation[] {
  const decorated = evaluations.map((evaluation) => ({ evaluation, score: effectiveScore(evaluation) }));
  const sorted = [...decorated].sort((a, b) => {
    if (a.score === null && b.score === null) return a.evaluation.candidateId.localeCompare(b.evaluation.candidateId);
    if (a.score === null) return 1;
    if (b.score === null) return -1;
    if (Math.abs(b.score - a.score) > SCORE_EPSILON) return b.score - a.score;
    return a.evaluation.candidateId.localeCompare(b.evaluation.candidateId);
  });

  let currentRank = 0;
  let previousScore: number | null | undefined;

  return sorted.map(({ evaluation, score }, index) => {
    if (score === null) return { ...evaluation, rank: null, tie: false };

    if (previousScore === undefined || previousScore === null || Math.abs(score - previousScore) > SCORE_EPSILON) {
      currentRank = index + 1;
    }

    const previous = sorted[index - 1]?.score;
    const next = sorted[index + 1]?.score;
    const tieWithPrevious = previous !== null && previous !== undefined && Math.abs(previous - score) <= SCORE_EPSILON;
    const tieWithNext = next !== null && next !== undefined && Math.abs(next - score) <= SCORE_EPSILON;

    previousScore = score;
    return { ...evaluation, rank: currentRank, tie: tieWithPrevious || tieWithNext };
  });
}
