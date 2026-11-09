import { CEFR_LEVELS } from "../model/CefrLevels";
import { UserVocabularyProgress } from "../model/UserVocabularyProgress";
import { VocabularyItem } from "../model/VocabularyItem";
import { normalizeWord } from "./WordAnswerChecker";
import { weightedSample } from "./WeightedSampler";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * One practice word (F26): every vocabulary item that shares a normalized Danish form.
 */
export interface WordGroup {
    wordKey: string;                // The normalized Danish form that identifies the group.
    items: VocabularyItem[];        // Every vocabulary item in the group; all receive mastery writes.
    promptItem: VocabularyItem;     // The deterministic representative used for the prompt and canonical answer.
    mastery: number;                // The minimum masteryScore across the group (missing record counts as 0).
    lastReviewed: string | null;    // The oldest lastReviewed across the group; null when any item was never reviewed.
}

export interface BuildWordGroupsInput {
    items: VocabularyItem[];                // The pool's vocabulary items.
    progress: UserVocabularyProgress[];     // The user's progress records for those items (may be incomplete).
}

export interface WordWeightInput {
    mastery: number;                // Group mastery in [0, 1].
    lastReviewed: string | null;    // Group lastReviewed, null for "never".
    masteryWeight: number;          // Weight of (1 − mastery).
    stalenessWeight: number;        // Weight of staleness.
    stalenessHorizonDays: number;   // Days after which staleness saturates at 1.
    now: Date;                      // The reference time.
}

export interface DrawWordsInput {
    groups: WordGroup[];            // The whole pool.
    size: number;                   // Maximum number of words to draw.
    masteryWeight: number;          // Weight of (1 − mastery).
    stalenessWeight: number;        // Weight of staleness.
    stalenessHorizonDays: number;   // Days after which staleness saturates at 1.
    now: Date;                      // The reference time.
}

/**
 * Groups vocabulary items into practice words by normalized Danish form.
 *
 * - Group mastery is the minimum across the group; an item with no progress record counts as 0.
 * - Group lastReviewed is the oldest across the group; an item with no record or a null
 *   lastReviewed makes the group "never reviewed" (null).
 * - The prompt item is the group's first item ordered by CEFR level (A1 first), then by id.
 *
 * @param {BuildWordGroupsInput} input - The items and the user's progress for them.
 *
 * @returns {WordGroup[]} One group per distinct word key, in order of first appearance.
 */
export function buildWordGroups(input: BuildWordGroupsInput): WordGroup[] {

    const progressByItemId = new Map(input.progress.map(p => [p.vocabularyItemId, p]));
    const itemsByKey = new Map<string, VocabularyItem[]>();

    for (const item of input.items) {
        const key = normalizeWord(item.danish);
        const bucket = itemsByKey.get(key) ?? [];

        bucket.push(item);
        itemsByKey.set(key, bucket);
    }

    const groups: WordGroup[] = [];

    for (const [wordKey, items] of itemsByKey) {
        const records = items.map(item => progressByItemId.get(item.id));
        const mastery = Math.min(...records.map(r => r?.masteryScore ?? 0));
        const reviewed = records.map(r => r?.lastReviewed ?? null);
        const lastReviewed = reviewed.some(r => r === null) ? null : (reviewed as string[]).reduce((oldest, current) => current < oldest ? current : oldest);
        const promptItem = [...items].sort((a, b) => CEFR_LEVELS.indexOf(a.cefrLevel as any) - CEFR_LEVELS.indexOf(b.cefrLevel as any) || a.id.localeCompare(b.id))[0];

        groups.push({ wordKey, items, promptItem, mastery, lastReviewed });
    }

    return groups;
}

/**
 * Computes the selection weight of a practice word:
 * `masteryWeight · (1 − mastery) + stalenessWeight · staleness`, where
 * `staleness = min(daysSince(lastReviewed) / stalenessHorizonDays, 1)` and "never" is 1.
 *
 * @param {WordWeightInput} input - The word's mastery and lastReviewed plus the tuning constants.
 *
 * @returns {number} The weight; 0 means the word is fully mastered and fresh.
 */
export function computeWordWeight(input: WordWeightInput): number {

    const staleness = input.lastReviewed === null
        ? 1
        : Math.min(Math.max((input.now.getTime() - new Date(input.lastReviewed).getTime()) / MS_PER_DAY, 0) / input.stalenessHorizonDays, 1);

    return input.masteryWeight * (1 - input.mastery) + input.stalenessWeight * staleness;
}

/**
 * Draws `min(size, pool)` practice words by weighted random sampling without replacement. The
 * drawn order is the presentation order. There is no mastery-threshold skip: a mastered but stale
 * word is exactly what Words Practice targets.
 *
 * @param {DrawWordsInput} input - The pool, the session size and the weighting constants.
 *
 * @returns {WordGroup[]} The drawn words in presentation order.
 */
export function drawWords(input: DrawWordsInput): WordGroup[] {

    const { groups, size, masteryWeight, stalenessWeight, stalenessHorizonDays, now } = input;

    return weightedSample(groups, group => computeWordWeight({ mastery: group.mastery, lastReviewed: group.lastReviewed, masteryWeight, stalenessWeight, stalenessHorizonDays, now }), size);
}
