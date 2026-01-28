import type { CrawlerWorkerOptions } from '../types/index.js';
export declare class CrawlerWorker {
    private readonly workerId;
    private readonly torClient;
    private readonly linkExtractor;
    private readonly database;
    private readonly logger;
    private readonly crawlDelay;
    private readonly maxContentSize;
    private isRunning;
    private startTime;
    constructor(workerId: string, options?: CrawlerWorkerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    private crawlBatch;
    private processUrl;
    private crawlUrl;
    getStats(): {
        workerId: string;
        isRunning: boolean;
        uptime: number;
    };
    private isConnectionFailure;
}
//# sourceMappingURL=worker.d.ts.map