/**
 * Weighted random sampling without replacement using the Efraimidis-Spirakis
 * exponential-key method. Words with higher weights are selected with higher
 * probability. If fewer than n weighted items exist, zero-weight items fill
 * remaining slots via uniform random sampling (fallback for fully-mastered sets).
 */
export function weightedSample<T>(items: T[], getWeight: (item: T) => number, n: number): T[] {
    if (n >= items.length) return [...items];

    const weightedItems: T[] = [];
    const zeroWeightItems: T[] = [];

    for (const item of items) {
        if (getWeight(item) > 0) {
            weightedItems.push(item);
        } else {
            zeroWeightItems.push(item);
        }
    }

    // Assign each weighted item a key k = -log(U) / weight; pick lowest k values
    const keyed = weightedItems.map(item => ({
        item,
        key: -Math.log(Math.random()) / getWeight(item),
    }));
    keyed.sort((a, b) => a.key - b.key);

    const selected = keyed.slice(0, Math.min(n, keyed.length)).map(k => k.item);

    // Fill remaining slots from zero-weight items using uniform random sampling
    if (selected.length < n) {
        const needed = n - selected.length;
        const shuffled = [...zeroWeightItems].sort(() => Math.random() - 0.5);
        selected.push(...shuffled.slice(0, needed));
    }

    return selected;
}
