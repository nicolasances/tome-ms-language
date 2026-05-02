import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { SessionsStore } from "../../store/SessionsStore";

export class GetRollingSessionStats extends TotoDelegate<GetRollingSessionStatsRequest, GetRollingSessionStatsResponse> {

    parseRequest(req: Request): GetRollingSessionStatsRequest {
        const raw = req.query.days;
        if (raw === undefined) return { days: 7 };

        if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
            throw new ValidationError(400, "'days' must be a positive integer between 1 and 365");
        }
        const days = parseInt(raw, 10);
        if (days < 1 || days > 365) {
            throw new ValidationError(400, "'days' must be between 1 and 365");
        }
        return { days };
    }

    async do(req: GetRollingSessionStatsRequest, userContext?: UserContext): Promise<GetRollingSessionStatsResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const userId = userContext!.userId;

        const now = new Date();
        const to   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
        const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (req.days - 1), 0, 0, 0, 0));

        const store = new SessionsStore({ db, config });
        const counts = await store.countCompletedByDateRange({ userId, from, to });
        const countsMap = new Map(counts.map(c => [c.date, c.count]));

        const days = Array.from({ length: req.days }, (_, i) => {
            const d = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
            const date = dateToYYYYMMDD(d);
            return { date, count: countsMap.get(date) ?? 0 };
        });

        return { days };
    }
}

function dateToYYYYMMDD(d: Date): string {
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

interface GetRollingSessionStatsRequest {
    days: number;
}

interface GetRollingSessionStatsResponse {
    days: Array<{ date: string; count: number }>;
}
