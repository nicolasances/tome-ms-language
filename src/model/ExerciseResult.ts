export class ExerciseResult {

    exerciseId: string;
    type: string;
    isCorrect: boolean;
    userAnswer: string;
    correctAnswer: string;
    timestamp: string;
    moduleId: string | null;

    constructor({ exerciseId, type, isCorrect, userAnswer, correctAnswer, timestamp, moduleId }: ExerciseResultInput) {
        this.exerciseId = exerciseId;
        this.type = type;
        this.isCorrect = isCorrect;
        this.userAnswer = userAnswer;
        this.correctAnswer = correctAnswer;
        this.timestamp = timestamp;
        this.moduleId = moduleId;
    }

    static fromBSON(data: any): ExerciseResult {
        return new ExerciseResult({
            exerciseId: data.exerciseId,
            type: data.type,
            isCorrect: data.isCorrect,
            userAnswer: data.userAnswer,
            correctAnswer: data.correctAnswer,
            timestamp: data.timestamp,
            moduleId: data.moduleId ?? null,
        });
    }

    toBSON(): any {
        return {
            exerciseId: this.exerciseId,
            type: this.type,
            isCorrect: this.isCorrect,
            userAnswer: this.userAnswer,
            correctAnswer: this.correctAnswer,
            timestamp: this.timestamp,
            moduleId: this.moduleId,
        };
    }
}

interface ExerciseResultInput {
    exerciseId: string;
    type: string;
    isCorrect: boolean;
    userAnswer: string;
    correctAnswer: string;
    timestamp: string;
    moduleId: string | null;
}
