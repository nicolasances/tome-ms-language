import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { SessionsStore } from "../../store/SessionsStore";

export class GetWeeklySessionStats extends TotoDelegate<GetWeeklySessionStatsRequest, GetWeeklySessionStatsResponse> {

    parseRequest(req: Request): GetWeeklySessionStatsRequest {
        const from = req.query.from as string | undefined;
        if (!from || !/^\d{8}$/.test(from)) throw new ValidationError(400, "Missing or invalid 'from' — expected YYYYMMDD");

        const parsed = yyyymmddToUTCDate(from);
        if (!parsed) throw new ValidationError(400, "Invalid 'from' date (YYYYMMDD)");
        if (parsed.getUTCDay() !== 1) throw new ValidationError(400, "'from' must be a Monday (YYYYMMDD)");

        return { from };
    }

    async do(req: GetWeeklySessionStatsRequest, userContext?: UserContext): Promise<GetWeeklySessionStatsResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const userId = userContext!.userId;

        const from = yyyymmddToUTCDate(req.from)!;
        const to = new Date(from.getTime() + 6 * 24 * 60 * 60 * 1000);
        to.setUTCHours(23, 59, 59, 999);

        const store = new SessionsStore({ db, config });
        const counts = await store.countCompletedByDateRange({ userId, from, to });
        const countsMap = new Map(counts.map(c => [c.date, c.count]));

        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
            const date = dateToYYYYMMDD(d);
            return { date, count: countsMap.get(date) ?? 0 };
        });

        return { days };
    }
}

/**
 * Parses a YYYYMMDD string into a UTC midnight Date.
 * Returns null if the input does not represent a valid calendar date.
 */
function yyyymmddToUTCDate(s: string): Date | null {
    const year  = parseInt(s.slice(0, 4), 10);
    const month = parseInt(s.slice(4, 6), 10);
    const day   = parseInt(s.slice(6, 8), 10);
    const d = new Date(Date.UTC(year, month - 1, day));
    // Round-trip check: rejects invalid dates like 20260230 that JS normalises
    if (dateToYYYYMMDD(d) !== s) return null;
    return d;
}

function dateToYYYYMMDD(d: Date): string {
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

interface GetWeeklySessionStatsRequest {
    from: string;
}

interface GetWeeklySessionStatsResponse {
    days: Array<{ date: string; count: number }>;
}
