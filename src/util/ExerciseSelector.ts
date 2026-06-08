import { Exercise } from "../model/Exercise";
import { DEPRIORITIZE_MASTERY_THRESHOLD, RECENT_MISS_BOOST } from "../Config";

/**
 * An exercise scored for selection (F08): its linked item, the mastery score
 * resolved from the mastery map, and the resulting selection weight.
 */
export interface ScoredExercise {
    exercise: Exercise;
    linkedItemId: string;
    masteryScore: number;
    weight: number;
}

export interface ScoreExercisePoolInput {
    pool: Exercise[];
    masteryByItemId: Map<string, number>;
    recentMisses: Set<string>;
    targetCount: number;
}

/**
 * Scores and filters an exercise pool for mastery-aware selection (F08).
 *
 * For each exercise, resolves the mastery score of its linked item (vocabulary
 * or grammar concept — every exercise links to exactly one) and computes a
 * selection weight as `(1 - masteryScore)`, boosted by RECENT_MISS_BOOST when
 * the exercise was answered incorrectly in the user's most recent session.
 *
 * Exercises whose linked item mastery exceeds DEPRIORITIZE_MASTERY_THRESHOLD
 * are deprioritized (excluded from the result), unless doing so would leave
 * fewer exercises than the session's target count — in which case the pool is
 * considered nearly empty and nothing is excluded.
 *
 * @param input the exercise pool, the mastery map (linked item id -> masteryScore),
 *              the ids of exercises missed in the most recent session, and the
 *              session's target exercise count
 *
 * @return the scored, filtered candidates ready for the final selection draw
 */
export function scoreExercisePool(input: ScoreExercisePoolInput): ScoredExercise[] {

    const { pool, masteryByItemId, recentMisses, targetCount } = input;

    const scored = pool.map(exercise => {

        const linkedItemId = (exercise.vocabularyItemId ?? exercise.grammarConceptId)!;
        const masteryScore = masteryByItemId.get(linkedItemId) ?? 0;
        const boost = recentMisses.has(exercise.id) ? RECENT_MISS_BOOST : 0;

        return { exercise, linkedItemId, masteryScore, weight: (1 - masteryScore) + boost };
    });

    const nonDeprioritized = scored.filter(s => s.masteryScore <= DEPRIORITIZE_MASTERY_THRESHOLD);

    if (nonDeprioritized.length < targetCount) return scored;

    return nonDeprioritized;
}
