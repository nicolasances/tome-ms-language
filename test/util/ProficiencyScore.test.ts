import { assert } from "chai";
import { Exercise } from "../../src/model/Exercise";
import { ModuleTestAttempt, TestAnswer } from "../../src/model/ModuleTestAttempt";
import { PracticeAnswer, PracticeSession } from "../../src/model/PracticeSession";
import { PROFICIENCY_VERSION } from "../../src/Config";
import { buildProficiency, computeModuleProficiency, computePracticeScore, computeTestScore } from "../../src/util/ProficiencyScore";
import { ObjectId } from "mongodb";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a submitted module test attempt over `total` exercises of which the first `correct`
 * were answered correctly and the rest answered wrong.
 */
function makeAttempt(correct: number, total: number): ModuleTestAttempt {

    const exerciseIds = Array.from({ length: total }, (_, i) => `t-ex-${i}`);

    const answers: TestAnswer[] = exerciseIds.map((exerciseId, i) => ({
        exerciseId,
        isCorrect: i < correct,
        userAnswer: "hej",
        answeredAt: "2026-06-11T10:00:00.000Z",
    }));

    return new ModuleTestAttempt({ userId: "user-1", moduleId: "mod-1", exerciseIds, answers, startedAt: "2026-06-11T09:00:00.000Z", takenAt: "2026-06-11T10:00:00.000Z" });
}

function makeExercise(id: string, type: string): Exercise {
    return new Exercise({ id, moduleId: "mod-1", type, prompt: "p", answer: "a", vocabularyItemId: "voc-1" });
}

function makeAnswer(exerciseId: string, isCorrect: boolean): PracticeAnswer {
    return { exerciseId, isCorrect, userAnswer: "hej", answeredAt: "2026-06-10T10:00:00.000Z" };
}

function makeSession(answers: PracticeAnswer[], verifiedExerciseIds: string[] = []): PracticeSession {
    return new PracticeSession({ userId: "user-1", moduleId: "mod-1", answers, verifiedExerciseIds, startedAt: "2026-06-10T09:00:00.000Z", completedAt: "2026-06-10T10:00:00.000Z" });
}

// A rung-2 exercise (cued production) and a rung-3 one (free production).
const RUNG_1_EXERCISE = makeExercise("ex-r1", "multiple_choice");
const RUNG_2_EXERCISE = makeExercise("ex-r2", "fill_blank");
const RUNG_3_EXERCISE = makeExercise("ex-r3", "translation_active");

// ---------------------------------------------------------------------------
// computeTestScore
// ---------------------------------------------------------------------------

describe("ProficiencyScore.computeTestScore", () => {

    it("returns 100 for a flawless first attempt", () => {

        assert.equal(computeTestScore(makeAttempt(20, 20)), 100);
    });

    it("charges a wrong answer three times a correct one — 19/20 scores 86.4, not 95", () => {

        assert.equal(computeTestScore(makeAttempt(19, 20)), 86.4);
    });

    it("is convex — the second error costs less than the first", () => {

        const firstErrorCost = computeTestScore(makeAttempt(20, 20)) - computeTestScore(makeAttempt(19, 20));
        const secondErrorCost = computeTestScore(makeAttempt(19, 20)) - computeTestScore(makeAttempt(18, 20));

        assert.isAbove(firstErrorCost, secondErrorCost);
    });

    it("scores a bare pass (16/20) at 57.1, restoring the range the 80% threshold collapses", () => {

        assert.equal(computeTestScore(makeAttempt(16, 20)), 57.1);
    });

    it("counts an exercise that was never answered as wrong", () => {

        const attempt = makeAttempt(20, 20);
        attempt.exerciseIds.push("t-ex-unanswered");

        // 20 correct, 1 unanswered → 100 × 20 / (20 + 3) = 87.0
        assert.equal(computeTestScore(attempt), 87);
    });

    it("returns 0 when the attempt holds no exercises at all", () => {

        const attempt = new ModuleTestAttempt({ userId: "user-1", moduleId: "mod-1", exerciseIds: [], answers: [], startedAt: "2026-06-11T09:00:00.000Z", takenAt: "2026-06-11T10:00:00.000Z" });

        assert.equal(computeTestScore(attempt), 0);
    });
});

// ---------------------------------------------------------------------------
// computePracticeScore
// ---------------------------------------------------------------------------

describe("ProficiencyScore.computePracticeScore", () => {

    const exercisesById = new Map([RUNG_1_EXERCISE, RUNG_2_EXERCISE, RUNG_3_EXERCISE].map(e => [e.id, e]));

    it("returns 100 for a clean run with no retries", () => {

        const session = makeSession([makeAnswer("ex-r2", true), makeAnswer("ex-r3", true)]);

        assert.equal(computePracticeScore([session], exercisesById), 100);
    });

    it("ignores rung 1 answers entirely — recognition says nothing about proficiency", () => {

        const session = makeSession([makeAnswer("ex-r1", false), makeAnswer("ex-r1", true), makeAnswer("ex-r3", true)]);

        assert.equal(computePracticeScore([session], exercisesById), 100);
    });

    it("counts a rung 3 answer double a rung 2 one", () => {

        const rung2Miss = makeSession([makeAnswer("ex-r2", false), makeAnswer("ex-r2", true), makeAnswer("ex-r3", true)]);
        const rung3Miss = makeSession([makeAnswer("ex-r3", false), makeAnswer("ex-r3", true), makeAnswer("ex-r2", true)]);

        // rung 2 miss: (1 + 2×1) / (2 + 2×1) = 3/4 = 75 ; rung 3 miss: (1 + 2×1) / (1 + 2×2) = 3/5 = 60
        assert.equal(computePracticeScore([rung2Miss], exercisesById), 75);
        assert.equal(computePracticeScore([rung3Miss], exercisesById), 60);
    });

    it("charges every retry — an item fought over three times costs three errors", () => {

        const foughtOver = makeSession([makeAnswer("ex-r2", false), makeAnswer("ex-r2", false), makeAnswer("ex-r2", false), makeAnswer("ex-r2", true)]);

        assert.equal(computePracticeScore([foughtOver], exercisesById), 25);
    });

    it("pools answers across sessions rather than averaging session scores", () => {

        const longSession = makeSession([makeAnswer("ex-r2", true), makeAnswer("ex-r2", true), makeAnswer("ex-r2", true)]);
        const shortSession = makeSession([makeAnswer("ex-r2", false), makeAnswer("ex-r2", true)]);

        // Pooled: 4 correct of 5 answers = 80. Averaged per session it would be (100 + 50) / 2 = 75.
        assert.equal(computePracticeScore([longSession, shortSession], exercisesById), 80);
    });

    it("treats the first wrong answer to an F13-verified exercise as correct", () => {

        const session = makeSession([makeAnswer("ex-r3", false), makeAnswer("ex-r3", true)], ["ex-r3"]);

        assert.equal(computePracticeScore([session], exercisesById), 100);
    });

    it("only discounts the first wrong answer to a verified exercise, not every one", () => {

        const session = makeSession([makeAnswer("ex-r2", false), makeAnswer("ex-r2", false), makeAnswer("ex-r2", true)], ["ex-r2"]);

        // The first miss is pardoned, the second still counts: 2 correct of 3 = 66.7
        assert.equal(computePracticeScore([session], exercisesById), 66.7);
    });

    it("returns null when no answer belongs to a weighted rung", () => {

        const session = makeSession([makeAnswer("ex-r1", true), makeAnswer("ex-r1", false)]);

        assert.isNull(computePracticeScore([session], exercisesById));
    });

    it("returns null when there are no sessions at all", () => {

        assert.isNull(computePracticeScore([], exercisesById));
    });

    it("skips answers whose exercise can no longer be resolved", () => {

        const session = makeSession([makeAnswer("ex-deleted", false), makeAnswer("ex-r2", true)]);

        assert.equal(computePracticeScore([session], exercisesById), 100);
    });
});

// ---------------------------------------------------------------------------
// buildProficiency
// ---------------------------------------------------------------------------

describe("ProficiencyScore.buildProficiency", () => {

    const exercisesById = new Map([RUNG_1_EXERCISE, RUNG_2_EXERCISE, RUNG_3_EXERCISE].map(e => [e.id, e]));

    it("blends the two components 60/40 and reports basis 'full'", () => {

        // practiceScore: 23 correct of 25 weighted answers = 92
        const rung2 = makeSession(Array.from({ length: 13 }, () => makeAnswer("ex-r2", true)));
        const rung3 = makeSession([...Array.from({ length: 5 }, () => makeAnswer("ex-r3", true)), makeAnswer("ex-r3", false)]);

        const result = buildProficiency({ attempt: makeAttempt(19, 20), sessions: [rung2, rung3], exercisesById, computedAt: "2026-08-16T10:00:00.000Z" });

        assert.equal(result.testScore, 86.4);
        assert.equal(result.practiceScore, 92);
        assert.equal(result.score, 88.6);
        assert.equal(result.basis, "full");
    });

    it("reports basis 'practice-rung3-only' when the ladder produced no rung 2 answers", () => {

        const rung3Only = makeSession([makeAnswer("ex-r3", true), makeAnswer("ex-r3", true)]);

        const result = buildProficiency({ attempt: makeAttempt(20, 20), sessions: [rung3Only], exercisesById, computedAt: "2026-08-16T10:00:00.000Z" });

        assert.equal(result.basis, "practice-rung3-only");
        assert.equal(result.practiceScore, 100);
        assert.equal(result.score, 100);
    });

    it("reports basis 'practice-rung2-only' when the ladder produced no rung 3 answers", () => {

        const rung2Only = makeSession([makeAnswer("ex-r2", false), makeAnswer("ex-r2", true)]);

        const result = buildProficiency({ attempt: makeAttempt(20, 20), sessions: [rung2Only], exercisesById, computedAt: "2026-08-16T10:00:00.000Z" });

        assert.equal(result.basis, "practice-rung2-only");
        assert.equal(result.practiceScore, 50);
        assert.equal(result.score, 80);
    });

    it("falls back to the test score alone, with a null practiceScore, when no practice answers exist", () => {

        const result = buildProficiency({ attempt: makeAttempt(16, 20), sessions: [], exercisesById, computedAt: "2026-08-16T10:00:00.000Z" });

        assert.equal(result.basis, "test-only");
        assert.isNull(result.practiceScore);
        assert.equal(result.score, 57.1);
    });

    it("stamps the computation timestamp and the current formula version", () => {

        const result = buildProficiency({ attempt: makeAttempt(20, 20), sessions: [], exercisesById, computedAt: "2026-08-16T10:00:00.000Z" });

        assert.equal(result.computedAt, "2026-08-16T10:00:00.000Z");
        assert.equal(result.version, PROFICIENCY_VERSION);
    });

    it("scores a module whose practice looked fine but whose test did not far below one that went through cleanly", () => {

        const practice = makeSession([...Array.from({ length: 22 }, () => makeAnswer("ex-r3", true)), makeAnswer("ex-r3", false), makeAnswer("ex-r3", false), makeAnswer("ex-r3", false)]);

        const struggled = buildProficiency({ attempt: makeAttempt(8, 20), sessions: [practice], exercisesById, computedAt: "2026-08-16T10:00:00.000Z" });
        const clean = buildProficiency({ attempt: makeAttempt(20, 20), sessions: [practice], exercisesById, computedAt: "2026-08-16T10:00:00.000Z" });

        assert.equal(struggled.practiceScore, 88);
        assert.equal(struggled.score, 46.1);
        assert.equal(clean.score, 95.2);
    });
});

// ---------------------------------------------------------------------------
// computeModuleProficiency
// ---------------------------------------------------------------------------

/**
 * Builds a mock db whose three collections back the stores computeModuleProficiency reads:
 * the first submitted module test attempt, the completed practice sessions, and the exercises
 * the practice answers point at.
 */
function makeMockDb(attemptDocs: any[], sessionDocs: any[], exerciseDocs: any[]) {

    const calls = { exerciseFinds: 0, sessionFilter: null as any };

    const attemptCol = {
        findOne: async (filter: any, options: any = {}) => {
            let matching = attemptDocs.filter(d => d.userId === filter.userId && d.moduleId === filter.moduleId && d.takenAt !== null);
            if (options.sort?.takenAt === 1) matching = [...matching].sort((a, b) => a.takenAt > b.takenAt ? 1 : -1);
            return matching[0] ?? null;
        },
    };

    const sessionCol = {
        find: (filter: any) => {
            calls.sessionFilter = filter;
            return { toArray: async () => sessionDocs.filter(d => d.userId === filter.userId && d.moduleId === filter.moduleId && d.completedAt !== null) };
        },
    };

    const exerciseCol = {
        find: (filter: any) => {
            calls.exerciseFinds++;
            return { toArray: async () => exerciseDocs.filter(d => filter.id.$in.includes(d.id)) };
        },
    };

    const db = {
        collection: (name: string) => {
            if (name === "moduleTestAttempts") return attemptCol;
            if (name === "practiceSessions") return sessionCol;
            return exerciseCol;
        },
    } as any;

    return { db, calls };
}

describe("ProficiencyScore.computeModuleProficiency", () => {

    it("computes the score from the first submitted attempt and the completed practice sessions", async () => {

        const attemptDocs = [
            { _id: new ObjectId(), userId: "user-1", moduleId: "mod-1", exerciseIds: ["t-1", "t-2"], answers: [{ exerciseId: "t-1", isCorrect: true, userAnswer: "a", answeredAt: "x" }, { exerciseId: "t-2", isCorrect: false, userAnswer: "b", answeredAt: "x" }], startedAt: "2026-06-11T09:00:00.000Z", takenAt: "2026-06-11T10:00:00.000Z" },
            { _id: new ObjectId(), userId: "user-1", moduleId: "mod-1", exerciseIds: ["t-1", "t-2"], answers: [], startedAt: "2026-06-12T09:00:00.000Z", takenAt: "2026-06-12T10:00:00.000Z" },
        ];
        const sessionDocs = [{ _id: new ObjectId(), userId: "user-1", moduleId: "mod-1", answers: [makeAnswer("ex-r3", true)], verifiedExerciseIds: [], startedAt: "2026-06-10T09:00:00.000Z", completedAt: "2026-06-10T10:00:00.000Z" }];

        const { db } = makeMockDb(attemptDocs, sessionDocs, [RUNG_3_EXERCISE.toBSON()]);

        const result = await computeModuleProficiency({ db, config: {} as any, userId: "user-1", moduleId: "mod-1", completedAt: "2026-06-12T10:00:00.000Z" });

        // First attempt: 1 correct, 1 wrong → 100 × 1 / (1 + 3) = 25. Practice: 100. → 0.6×25 + 0.4×100 = 55
        assert.equal(result!.testScore, 25);
        assert.equal(result!.practiceScore, 100);
        assert.equal(result!.score, 55);
    });

    it("returns null when the user has no submitted test attempt for the module", async () => {

        const { db } = makeMockDb([], [], []);

        const result = await computeModuleProficiency({ db, config: {} as any, userId: "user-1", moduleId: "mod-1", completedAt: "2026-06-12T10:00:00.000Z" });

        assert.isNull(result);
    });

    it("bounds the practice sessions read by the module's completion timestamp", async () => {

        const attemptDocs = [{ _id: new ObjectId(), userId: "user-1", moduleId: "mod-1", exerciseIds: ["t-1"], answers: [{ exerciseId: "t-1", isCorrect: true, userAnswer: "a", answeredAt: "x" }], startedAt: "2026-06-11T09:00:00.000Z", takenAt: "2026-06-11T10:00:00.000Z" }];

        const { db, calls } = makeMockDb(attemptDocs, [], []);

        await computeModuleProficiency({ db, config: {} as any, userId: "user-1", moduleId: "mod-1", completedAt: "2026-06-12T10:00:00.000Z" });

        assert.equal(calls.sessionFilter.completedAt.$lte, "2026-06-12T10:00:00.000Z");
    });

    it("resolves every practice exercise in a single bulk read, not one per answer", async () => {

        const attemptDocs = [{ _id: new ObjectId(), userId: "user-1", moduleId: "mod-1", exerciseIds: ["t-1"], answers: [{ exerciseId: "t-1", isCorrect: true, userAnswer: "a", answeredAt: "x" }], startedAt: "2026-06-11T09:00:00.000Z", takenAt: "2026-06-11T10:00:00.000Z" }];
        const sessionDocs = [
            { _id: new ObjectId(), userId: "user-1", moduleId: "mod-1", answers: [makeAnswer("ex-r2", true), makeAnswer("ex-r3", true)], verifiedExerciseIds: [], startedAt: "2026-06-10T09:00:00.000Z", completedAt: "2026-06-10T10:00:00.000Z" },
            { _id: new ObjectId(), userId: "user-1", moduleId: "mod-1", answers: [makeAnswer("ex-r3", false), makeAnswer("ex-r3", true)], verifiedExerciseIds: [], startedAt: "2026-06-10T11:00:00.000Z", completedAt: "2026-06-10T12:00:00.000Z" },
        ];

        const { db, calls } = makeMockDb(attemptDocs, sessionDocs, [RUNG_2_EXERCISE.toBSON(), RUNG_3_EXERCISE.toBSON()]);

        await computeModuleProficiency({ db, config: {} as any, userId: "user-1", moduleId: "mod-1", completedAt: "2026-06-12T10:00:00.000Z" });

        assert.equal(calls.exerciseFinds, 1);
    });

    it("skips the practice read entirely when no session was ever completed", async () => {

        const attemptDocs = [{ _id: new ObjectId(), userId: "user-1", moduleId: "mod-1", exerciseIds: ["t-1"], answers: [{ exerciseId: "t-1", isCorrect: true, userAnswer: "a", answeredAt: "x" }], startedAt: "2026-06-11T09:00:00.000Z", takenAt: "2026-06-11T10:00:00.000Z" }];

        const { db, calls } = makeMockDb(attemptDocs, [], []);

        const result = await computeModuleProficiency({ db, config: {} as any, userId: "user-1", moduleId: "mod-1", completedAt: "2026-06-12T10:00:00.000Z" });

        assert.equal(calls.exerciseFinds, 0);
        assert.equal(result!.basis, "test-only");
    });
});
