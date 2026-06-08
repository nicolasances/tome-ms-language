import { Exercise } from "../model/Exercise";
import { DEPRIORITIZE_MASTERY_THRESHOLD, RECENT_MISS_BOOST } from "../Config";
import { weightedSample } from "./WeightedSampler";

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

/**
 * Splits scored candidates into a "primary" set (one randomly-chosen exercise
 * per linked item) and an "extra" set (the remaining exercises for items that
 * have more than one candidate).
 *
 * This is how F08 avoids testing the same item/concept twice: the primary set
 * is drawn from first, and the extras are only used as a fallback to fill the
 * session when there aren't enough distinct items to reach the target count.
 *
 * @param scored the scored candidates to split
 *
 * @return the primary (deduped) and extra (fallback) candidate sets
 */
function dedupByLinkedItem(scored: ScoredExercise[]): { primary: ScoredExercise[]; extra: ScoredExercise[] } {

    const candidatesByItem = new Map<string, ScoredExercise[]>();

    for (const candidate of scored) {
        const group = candidatesByItem.get(candidate.linkedItemId) ?? [];

        group.push(candidate);
        candidatesByItem.set(candidate.linkedItemId, group);
    }

    const primary: ScoredExercise[] = [];
    const extra: ScoredExercise[] = [];

    for (const group of candidatesByItem.values()) {
        const pickedIndex = Math.floor(Math.random() * group.length);

        group.forEach((candidate, index) => {
            if (index === pickedIndex) primary.push(candidate);
            else extra.push(candidate);
        });
    }

    return { primary, extra };
}

export interface SelectExercisesInput {
    pool: Exercise[];
    masteryByItemId: Map<string, number>;
    recentMisses: Set<string>;
    targetCount: number;
}

/**
 * Draws a session-sized, mastery-aware weighted sample of exercises from a pool (F08).
 *
 * Business logic:
 * - Each exercise's weight is derived from its linked item's mastery — see scoreExercisePool.
 * - When several exercises link to the same item, only one is considered per draw
 *   (deduped at random); the others are kept as a fallback to fill the session if
 *   there aren't enough distinct items to reach the target count.
 * - The final selection is a weighted random sample without replacement, so weaker
 *   areas are more likely to be picked without being deterministic.
 *
 * @param input the exercise pool, the mastery map (linked item id -> masteryScore),
 *              the ids of exercises missed in the most recent session, and the
 *              session's target exercise count
 *
 * @return the selected exercises, at most `targetCount` long
 */
export function selectExercises(input: SelectExercisesInput): Exercise[] {

    const { pool, masteryByItemId, recentMisses, targetCount } = input;

    const scored = scoreExercisePool({ pool, masteryByItemId, recentMisses, targetCount });
    const { primary, extra } = dedupByLinkedItem(scored);

    const selected = weightedSample(primary, candidate => candidate.weight, targetCount);

    if (selected.length < targetCount) {
        const stillNeeded = targetCount - selected.length;

        selected.push(...weightedSample(extra, candidate => candidate.weight, stillNeeded));
    }

    return selected.map(candidate => candidate.exercise);
}
