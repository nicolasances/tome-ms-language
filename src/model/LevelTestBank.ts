import { WithId } from "mongodb";

/**
 * A LevelTestBank is the pool of cross-module exercises for a single CEFR level.
 * Exercises in this bank carry moduleId = null and are submitted by an external tool at seeding time.
 * The Level Test (F21) draws from this pool.
 */
export class LevelTestBank {

    id: string;                 // Unique identifier. Hex string representation of the MongoDB ObjectId. Auto-generated.
    cefrLevel: string;          // The CEFR level this bank covers (one of A1, A2, B1, B2, C1, C2). One bank per level.
    exerciseIds: string[];      // Ids of the exercises in this bank. All referenced exercises have moduleId = null.
    generatedAt: string;        // ISO timestamp of when the bank was last updated (created or appended to).
    totalGenerated: number;     // Cumulative count of exercises ever added to this bank. Incremented on each append.

    constructor(input: LevelTestBankInput) {

        this.id = input.id;
        this.cefrLevel = input.cefrLevel;
        this.exerciseIds = input.exerciseIds ?? [];
        this.generatedAt = input.generatedAt;
        this.totalGenerated = input.totalGenerated ?? 0;
    }

    /**
     * Creates a LevelTestBank instance from a MongoDB BSON document.
     *
     * @param {WithId<any>} data - The BSON document read from MongoDB.
     *
     * @returns {LevelTestBank} The reconstructed LevelTestBank instance.
     */
    static fromBSON(data: WithId<any>): LevelTestBank {

        return new LevelTestBank({
            id: data.id,
            cefrLevel: data.cefrLevel,
            exerciseIds: data.exerciseIds ?? [],
            generatedAt: data.generatedAt,
            totalGenerated: data.totalGenerated ?? 0,
        });
    }

    /**
     * Serializes the LevelTestBank to a MongoDB BSON document.
     *
     * @returns {any} The BSON-ready plain object.
     */
    toBSON(): any {

        return {
            id: this.id,
            cefrLevel: this.cefrLevel,
            exerciseIds: this.exerciseIds,
            generatedAt: this.generatedAt,
            totalGenerated: this.totalGenerated,
        };
    }
}

export interface LevelTestBankInput {
    id: string;                 // Unique identifier. Hex string representation of the MongoDB ObjectId.
    cefrLevel: string;          // The CEFR level this bank covers.
    exerciseIds?: string[];     // Ids of the exercises in this bank. Defaults to an empty array.
    generatedAt: string;        // ISO timestamp of when the bank was last updated.
    totalGenerated?: number;    // Cumulative count of exercises ever added. Defaults to 0.
}
