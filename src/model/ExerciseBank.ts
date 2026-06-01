import { WithId } from "mongodb";

export class ExerciseBank {

    id: string;
    moduleId: string;
    exerciseIds: string[];
    generatedAt: Date;
    totalGenerated: number;

    constructor(input: ExerciseBankInput) {

        this.id = input.id;
        this.moduleId = input.moduleId;
        this.exerciseIds = input.exerciseIds ?? [];
        this.generatedAt = input.generatedAt ?? new Date();
        this.totalGenerated = input.totalGenerated ?? 0;
    }

    /**
     * Creates an ExerciseBank instance from a MongoDB BSON document.
     */
    static fromBSON(data: WithId<any>): ExerciseBank {

        return new ExerciseBank({
            id: data.id,
            moduleId: data.moduleId,
            exerciseIds: data.exerciseIds ?? [],
            generatedAt: data.generatedAt,
            totalGenerated: data.totalGenerated ?? 0,
        });
    }

    /**
     * Serializes the ExerciseBank to a MongoDB BSON document.
     */
    toBSON(): any {

        return {
            id: this.id,
            moduleId: this.moduleId,
            exerciseIds: this.exerciseIds,
            generatedAt: this.generatedAt,
            totalGenerated: this.totalGenerated,
        };
    }
}

export interface ExerciseBankInput {
    id: string;
    moduleId: string;
    exerciseIds?: string[];
    generatedAt?: Date;
    totalGenerated?: number;
}
