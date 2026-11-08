import { ObjectId } from "mongodb";

/**
 * Minimal in-memory stand-in for a MongoDB Db, enough for the stores used by Words Practice:
 * find / findOne / insertOne / replaceOne with equality, ObjectId and `$in` filters.
 */
export class FakeDb {

    collections: Record<string, any[]>;

    constructor(collections: Record<string, any[]> = {}) {
        this.collections = collections;
    }

    private matches(doc: any, filter: any): boolean {

        return Object.entries(filter ?? {}).every(([key, expected]) => {
            const actual = doc[key];

            if (expected instanceof ObjectId) return actual?.toString() === expected.toString();
            if (expected && typeof expected === "object" && "$in" in (expected as any)) return (expected as any).$in.includes(actual);

            return actual === expected;
        });
    }

    collection(name: string): any {

        const docs = this.collections[name] ?? (this.collections[name] = []);
        const matches = this.matches.bind(this);

        return {
            find: (filter: any) => ({
                toArray: async () => docs.filter(d => matches(d, filter)),
                sort: () => ({ toArray: async () => docs.filter(d => matches(d, filter)) }),
            }),
            findOne: async (filter: any) => docs.find(d => matches(d, filter)) ?? null,
            insertOne: async (doc: any) => {
                const _id = doc._id ?? new ObjectId();

                docs.push({ ...doc, _id });

                return { insertedId: _id };
            },
            bulkWrite: async (operations: any[]) => {
                for (const op of operations) {
                    const { filter, replacement, upsert } = op.replaceOne;
                    const index = docs.findIndex(d => matches(d, filter));

                    if (index >= 0) docs[index] = { ...replacement, _id: docs[index]._id };
                    else if (upsert) docs.push({ ...replacement, _id: new ObjectId() });
                }

                return {};
            },
            replaceOne: async (filter: any, doc: any, options?: any) => {
                const index = docs.findIndex(d => matches(d, filter));

                if (index >= 0) docs[index] = { ...doc, _id: docs[index]._id };
                else if (options?.upsert) docs.push({ ...doc, _id: new ObjectId() });

                return {};
            },
        };
    }
}
