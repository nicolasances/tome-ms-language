import { PRACTICE_RUNG_TYPES } from "../Config";
import { Exercise } from "../model/Exercise";

/**
 * Resolves the practice-ladder rung (F10) an exercise type belongs to.
 *
 * The rung is derived from the type via the fixed PRACTICE_RUNG_TYPES map — it is never stored
 * on the exercise, so re-tiering a type is a config change rather than a data migration.
 *
 * @param {string} type - The exercise type (see EXERCISE_TYPES).
 *
 * @returns {number | null} The rung (1–3), or null if the type is not mapped to any rung.
 */
export function rungOfType(type: string): number | null {

    for (const [rung, types] of Object.entries(PRACTICE_RUNG_TYPES)) {
        if (types.includes(type)) return Number(rung);
    }

    return null;
}

/**
 * Returns the id of the practice item an exercise tests: its vocabulary item or its grammar
 * concept. Every exercise links to exactly one of the two (F04), and the two id spaces are
 * disjoint, so the returned id is unambiguous across both.
 *
 * @param {Exercise} exercise - The exercise to resolve.
 *
 * @returns {string} The linked vocabulary item id or grammar concept id.
 */
export function linkedItemIdOf(exercise: Exercise): string {

    return (exercise.vocabularyItemId ?? exercise.grammarConceptId)!;
}

/**
 * Filters an exercise pool down to the exercises belonging to a given rung (F10).
 *
 * This is the rung pre-filter a practice session draws from: F08's selection is unchanged and
 * simply receives the already-filtered pool. Exercises of an unmapped type belong to no rung and
 * are therefore never drawn.
 *
 * @param {Exercise[]} pool - The full candidate exercise pool.
 * @param {number} rung - The rung to filter for (1–3).
 *
 * @returns {Exercise[]} The exercises whose type belongs to that rung.
 */
export function exercisesAtRung(pool: Exercise[], rung: number): Exercise[] {

    return pool.filter(exercise => rungOfType(exercise.type) === rung);
}
