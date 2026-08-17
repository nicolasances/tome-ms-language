import { WithId } from "mongodb";
import { FIRST_PRACTICE_RUNG } from "../Config";

export const MODULE_STATUSES = ["locked", "available", "in_progress", "completed"] as const;
export type ModuleStatus = typeof MODULE_STATUSES[number];

/**
 * The set of practice items — vocabulary items *and* grammar concepts — the user has covered at
 * one rung of the practice ladder (F10), embedded in UserModuleProgress.rungCoverage[].
 *
 * One entry per rung the module has reached. Entries are never cleared when the module advances
 * to the next rung: keeping the history is what lets the recap render per-rung progress and what
 * makes the rung rings monotonic.
 *
 * Vocabulary item ids and grammar concept ids share this one array — the two id spaces are
 * disjoint, so no per-kind split is needed.
 */
export class RungCoverage {

    rung: number;                // The rung this entry covers (1–3).
    itemIds: string[];           // Ids of the practice items covered at this rung. Set-union semantics — no duplicates.
    completedAt: string | null;  // ISO-8601 timestamp of when this rung was fully covered; null while the phase is still running.

    constructor({ rung, itemIds, completedAt }: RungCoverageInput) {

        this.rung = rung;
        this.itemIds = itemIds ?? [];
        this.completedAt = completedAt ?? null;
    }

    /**
     * Creates a RungCoverage from a raw BSON sub-document.
     */
    static fromBSON(data: any): RungCoverage {

        return new RungCoverage({
            rung: data.rung,
            itemIds: data.itemIds ?? [],
            completedAt: data.completedAt ?? null,
        });
    }

    /**
     * Serializes the entry to a plain object for MongoDB storage (embedded in UserModuleProgress).
     */
    toBSON(): any {

        return {
            rung: this.rung,
            itemIds: this.itemIds,
            completedAt: this.completedAt,
        };
    }
}

export interface RungCoverageInput {
    rung: number;                 // The rung this entry covers (1–3).
    itemIds?: string[];           // Ids of the practice items covered at this rung. Defaults to [].
    completedAt?: string | null;  // ISO-8601 timestamp of when this rung was fully covered. Defaults to null.
}

/**
 * Lightweight summary of a completed Module Test attempt, embedded in UserModuleProgress.testAttempts[].
 * Holds only the grading outcome and timing needed for eligibility checks and history display.
 * The full stateful attempt document lives in the `moduleTestAttempts` collection (see ModuleTestAttempt model).
 */
export class TestAttemptRecord {

    id: string;         // The MongoDB _id (as hex string) of the full ModuleTestAttempt document
    score: number;      // Percentage correct (0–100)
    passed: boolean;    // Whether the attempt passed (score >= testPassThreshold)
    takenAt: string;    // ISO-8601 timestamp of when the attempt was submitted

    constructor({ id, score, passed, takenAt }: { id: string; score: number; passed: boolean; takenAt: string }) {

        this.id = id;
        this.score = score;
        this.passed = passed;
        this.takenAt = takenAt;
    }

    /**
     * Creates a TestAttemptRecord from a raw BSON document.
     */
    static fromBSON(data: any): TestAttemptRecord {

        return new TestAttemptRecord({
            id: data.id,
            score: data.score,
            passed: data.passed,
            takenAt: data.takenAt,
        });
    }

    /**
     * Serializes the record to a plain object for MongoDB storage (embedded in UserModuleProgress).
     */
    toBSON(): any {

        return {
            id: this.id,
            score: this.score,
            passed: this.passed,
            takenAt: this.takenAt,
        };
    }
}

/**
 * What the User Proficiency Score (UPS) could be computed from. Carried in the response so a
 * test-only score is never mistaken for a genuine flawless practice run.
 *
 * Modules completed before the practice ladder shipped may hold no answers at some rungs; rather
 * than inventing data, the practice component is renormalised over whatever exists.
 */
export const PROFICIENCY_BASES = ["full", "practice-rung2-only", "practice-rung3-only", "test-only"] as const;
export type ProficiencyBasis = typeof PROFICIENCY_BASES[number];

/**
 * The User Proficiency Score of one module for one user — how hard the module actually was —
 * embedded in UserModuleProgress.proficiency.
 *
 * Computed **once**, when the module transitions to `completed`, and frozen there: "keep
 * practising" runs on an already-completed module never move it. It is a snapshot of the first
 * pass through the module, not a current-standing metric.
 */
export class ModuleProficiency {

    score: number;                  // The UPS itself (0–100): the blend of testScore and practiceScore. Equals testScore when basis is "test-only".
    testScore: number;              // First submitted test attempt scored with errors charged ×3 (0–100).
    practiceScore: number | null;   // Rung-weighted accuracy over the completed practice sessions (0–100); null when no weighted practice answer exists.
    basis: ProficiencyBasis;        // Which inputs the score could be computed from.
    computedAt: string;             // ISO-8601 timestamp of when the score was computed.
    version: number;                // Formula version (PROFICIENCY_VERSION at computation time); drives recompute-on-read.

    constructor({ score, testScore, practiceScore, basis, computedAt, version }: ModuleProficiencyInput) {

        this.score = score;
        this.testScore = testScore;
        this.practiceScore = practiceScore ?? null;
        this.basis = basis;
        this.computedAt = computedAt;
        this.version = version;
    }

    /**
     * Creates a ModuleProficiency from a raw BSON sub-document.
     */
    static fromBSON(data: any): ModuleProficiency {

        return new ModuleProficiency({
            score: data.score,
            testScore: data.testScore,
            practiceScore: data.practiceScore ?? null,
            basis: data.basis,
            computedAt: data.computedAt,
            version: data.version,
        });
    }

    /**
     * Serializes the score to a plain object for MongoDB storage (embedded in UserModuleProgress).
     */
    toBSON(): any {

        return {
            score: this.score,
            testScore: this.testScore,
            practiceScore: this.practiceScore,
            basis: this.basis,
            computedAt: this.computedAt,
            version: this.version,
        };
    }
}

export interface ModuleProficiencyInput {
    score: number;                   // The UPS (0–100).
    testScore: number;               // Test component (0–100).
    practiceScore?: number | null;   // Practice component (0–100), or null when there is none. Defaults to null.
    basis: ProficiencyBasis;         // Which inputs the score was computed from.
    computedAt: string;              // ISO-8601 timestamp of computation.
    version: number;                 // Formula version.
}

export class UserModuleProgress {

    userId: string;
    moduleId: string;
    status: ModuleStatus;
    startedAt: string | null;
    completedAt: string | null;
    currentRung: number;
    rungCoverage: RungCoverage[];
    practiceCompletedAt: string | null;
    testAttempts: TestAttemptRecord[];
    proficiency: ModuleProficiency | null;

    constructor({ userId, moduleId, status, startedAt, completedAt, currentRung, rungCoverage, practiceCompletedAt, testAttempts, proficiency }: UserModuleProgressInput) {
        this.userId = userId;
        this.moduleId = moduleId;
        this.status = status;
        this.startedAt = startedAt;
        this.completedAt = completedAt;
        this.currentRung = currentRung ?? FIRST_PRACTICE_RUNG;
        this.rungCoverage = rungCoverage ?? [];
        this.practiceCompletedAt = practiceCompletedAt ?? null;
        this.testAttempts = testAttempts;
        this.proficiency = proficiency ?? null;
    }

    static fromBSON(data: WithId<any>): UserModuleProgress {
        return new UserModuleProgress({
            userId: data.userId,
            moduleId: data.moduleId,
            status: data.status,
            startedAt: data.startedAt ?? null,
            completedAt: data.completedAt ?? null,
            currentRung: data.currentRung ?? FIRST_PRACTICE_RUNG,
            rungCoverage: (data.rungCoverage ?? []).map((c: any) => RungCoverage.fromBSON(c)),
            practiceCompletedAt: data.practiceCompletedAt ?? null,
            testAttempts: (data.testAttempts ?? []).map((a: any) => TestAttemptRecord.fromBSON(a)),
            proficiency: data.proficiency ? ModuleProficiency.fromBSON(data.proficiency) : null,
        });
    }

    toBSON(): any {
        return {
            userId: this.userId,
            moduleId: this.moduleId,
            status: this.status,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            currentRung: this.currentRung,
            rungCoverage: this.rungCoverage.map(c => c.toBSON()),
            practiceCompletedAt: this.practiceCompletedAt,
            testAttempts: this.testAttempts.map(a => a.toBSON()),
            proficiency: this.proficiency ? this.proficiency.toBSON() : null,
        };
    }

    /**
     * Returns the coverage entry for a given rung, or null when the module has not yet
     * practised at that rung.
     *
     * @param {number} rung - The rung to look up (1–3).
     *
     * @returns {RungCoverage | null} The coverage entry, or null if the rung has no entry yet.
     */
    coverageAt(rung: number): RungCoverage | null {

        return this.rungCoverage.find(c => c.rung === rung) ?? null;
    }

    /**
     * Counts how many rungs of the ladder are fully covered. This is the outer progress ring
     * the practice recap renders (`1/3 → 3/3`); it only ever climbs.
     *
     * @returns {number} The number of rungs carrying a completedAt timestamp.
     */
    completedRungCount(): number {

        return this.rungCoverage.filter(c => c.completedAt !== null).length;
    }

    /**
     * Unions the practice items covered across every rung — the "have I met this item at all"
     * view, as opposed to the per-rung view. Used for the module-wide vocabulary coverage
     * reported on the dashboard and the practice recap's inner ring.
     *
     * @returns {Set<string>} The ids of every practice item covered at any rung.
     */
    coveredItemIds(): Set<string> {

        return new Set(this.rungCoverage.flatMap(c => c.itemIds));
    }
}

interface UserModuleProgressInput {
    userId: string;                    // The id of the user this progress record belongs to.
    moduleId: string;                  // The id of the module this progress record tracks.
    status: ModuleStatus;              // The current module status for this user.
    startedAt: string | null;          // ISO-8601 timestamp of the first in_progress transition.
    completedAt: string | null;        // ISO-8601 timestamp of when the module was passed.
    currentRung?: number;              // The practice-ladder rung the module is practising at. Defaults to FIRST_PRACTICE_RUNG.
    rungCoverage?: RungCoverage[];     // Per-rung covered-item sets, one entry per rung reached. Defaults to [].
    practiceCompletedAt?: string | null; // ISO-8601 timestamp of when the whole ladder completed. Defaults to null.
    testAttempts: TestAttemptRecord[]; // All module test attempts recorded for this user+module.
    proficiency?: ModuleProficiency | null; // The frozen User Proficiency Score, written when the module completes. Defaults to null.
}
