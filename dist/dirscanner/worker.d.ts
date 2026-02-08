import { Database } from '../database/database.js';
import type { DirScanWorkerOptions } from '../types/dirscanner.js';
export declare class DirScanWorker {
    private readonly workerId;
    private readonly torClient;
    private readonly classifier;
    private readonly database;
    private readonly ownsDatabase;
    private readonly logger;
    private readonly pathDelay;
    private readonly timeout;
    private readonly scanDelay;
    private isRunning;
    private startTime;
    constructor(workerId: string, options?: DirScanWorkerOptions, sharedDatabase?: Database);
    start(): Promise<void>;
    stop(): Promise<void>;
    private processBatch;
    private processScan;
    private captureBaseline;
    private probePath;
    private storeResults;
    private isConnectionFailure;
    getStats(): {
        workerId: string;
        isRunning: boolean;
        uptime: number;
    };
}
//# sourceMappingURL=worker.d.ts.map