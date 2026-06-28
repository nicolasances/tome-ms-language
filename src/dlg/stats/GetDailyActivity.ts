import { Request } from "express";
import * as moment from "moment-timezone";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig, REFERENCE_TIMEZONE } from "../../Config";
import { PracticeSessionStore } from "../../store/PracticeSessionStore";
import { ModuleTestAttemptStore } from "../../store/ModuleTestAttemptStore";
import { LevelTestAttemptStore } from "../../store/LevelTestAttemptStore";
import { UserStore } from "../../store/UserStore";

export class GetDailyActivity extends TotoDelegate<GetDailyActivityRequest, GetDailyActivityResponse> {

    parseRequest(req: Request): GetDailyActivityRequest {
        const from = req.query.from as string | undefined;
        return { from };
    }

    async do(req: GetDailyActivityRequest, userContext?: UserContext): Promise<GetDailyActivityResponse> {

        const config = this.config as ControllerConfig;
        const tz = REFERENCE_TIMEZONE;

        const fromDate = resolveFrom(req.from, tz);
        const toDate = moment.tz(fromDate, "YYYYMMDD", tz).add(6, "days").format("YYYYMMDD");

        const db = await config.getMongoDb(config.getDBName());
        
        const user = await new UserStore({ db, config }).findByEmail(userContext!.email); 

        if (!user) throw new ValidationError(404, "User not found");

        const [practiceMap, moduleTestMap, levelTestMap] = await Promise.all([
            new PracticeSessionStore({ db, config }).countCompletedByDay(user.id, fromDate, toDate, tz),
            new ModuleTestAttemptStore({ db, config }).countPassedByDay(user.id, fromDate, toDate, tz),
            new LevelTestAttemptStore({ db, config }).countPassedByDay(user.id, fromDate, toDate, tz),
        ]);

        const days: DayActivity[] = [];
        for (let i = 0; i < 7; i++) {
            const day = moment.tz(fromDate, "YYYYMMDD", tz).add(i, "days").format("YYYYMMDD");
            days.push({
                date: day,
                practiceSessions: practiceMap.get(day) ?? 0,
                successfulModuleTests: moduleTestMap.get(day) ?? 0,
                successfulLevelTests: levelTestMap.get(day) ?? 0,
            });
        }

        return { from: fromDate, to: toDate, days };
    }
}

function resolveFrom(from: string | undefined, tz: string): string {
    if (!from) {
        return moment.tz(tz).subtract(6, "days").format("YYYYMMDD");
    }
    const parsed = moment.tz(from, "YYYYMMDD", true, tz);
    if (!parsed.isValid()) {
        throw new ValidationError(400, "'from' must be a valid YYYYMMDD date");
    }
    return from;
}

interface GetDailyActivityRequest {
    from?: string;
}

interface DayActivity {
    date: string;
    practiceSessions: number;
    successfulModuleTests: number;
    successfulLevelTests: number;
}

interface GetDailyActivityResponse {
    from: string;
    to: string;
    days: DayActivity[];
}
