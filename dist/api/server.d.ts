import type { ApiOptions } from '../types/index.js';
export declare class OnionSearchAPI {
    private readonly app;
    private readonly port;
    private readonly database;
    private server;
    constructor(options?: ApiOptions);
    private setupMiddleware;
    private setupRoutes;
    private parseQuery;
    private getStats;
    start(): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map