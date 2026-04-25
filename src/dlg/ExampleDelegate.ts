import { Request } from "express";
import { TotoDelegate, UserContext } from "totoms";

export class SayHello extends TotoDelegate<any, any> {
    
    parseRequest(req: Request) {
        return {}
    }

    async do(req: Request, userContext?: UserContext): Promise<any> {
        return { message: "Hello World!" };
    }

}
