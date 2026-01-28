import type { PortScanWorkerOptions } from '../types/scanner.js';
export declare class PortScanWorker {
    private readonly workerId;
    private readonly scanner;
    private readonly serviceDetector;
    private readonly database;
    private readonly logger;
    private readonly maxConcurrent;
    private readonly minProbeDelay;
    private readonly scanDelay;
    private isRunning;
    private startTime;
    constructor(workerId: string, options?: PortScanWorkerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    private processBatch;
    private processScan;
    private storeResults;
    private isConnectionFailure;
    getStats(): {
        workerId: string;
        isRunning: boolean;
        uptime: number;
    };
}
//# sourceMappingURL=worker.d.ts.map