import type { RankedReactionEvaluation, ReactionEvaluation } from "./types";

const SCORE_EPSILON = 1e-12;

/**
 * Deterministic ranking. OPEN/unavailable scores sort last with rank=null.
 * Stable ties receive the same rank; candidateId is only a deterministic
 * ordering tiebreaker and does not change tie semantics.
 */
export function rankReactionEvaluations(
  evaluations: readonly ReactionEvaluation[],
): RankedReactionEvaluation[] {
  const sorted = [...evaluations].sort((a, b) => {
    if (a.rankScore === null && b.rankScore === null) {
      return a.candidateId.localeCompare(b.candidateId);
    }
    if (a.rankScore === null) return 1;
    if (b.rankScore === null) return -1;
    if (Math.abs(b.rankScore - a.rankScore) > SCORE_EPSILON) {
      return b.rankScore - a.rankScore;
    }
    return a.candidateId.localeCompare(b.candidateId);
  });

  let currentRank = 0;
  let previousScore: number | null | undefined;

  return sorted.map((evaluation, index) => {
    if (evaluation.rankScore === null) {
      return { ...evaluation, rank: null, tie: false };
    }

    if (
      previousScore === undefined ||
      previousScore === null ||
      Math.abs(evaluation.rankScore - previousScore) > SCORE_EPSILON
    ) {
      currentRank = index + 1;
    }

    const previous = sorted[index - 1];
    const next = sorted[index + 1];
    const tieWithPrevious =
      previous?.rankScore !== null &&
      previous?.rankScore !== undefined &&
      Math.abs(previous.rankScore - evaluation.rankScore) <= SCORE_EPSILON;
    const tieWithNext =
      next?.rankScore !== null &&
      next?.rankScore !== undefined &&
      Math.abs(next.rankScore - evaluation.rankScore) <= SCORE_EPSILON;

    previousScore = evaluation.rankScore;
    return {
      ...evaluation,
      rank: currentRank,
      tie: tieWithPrevious || tieWithNext,
    };
  });
}
