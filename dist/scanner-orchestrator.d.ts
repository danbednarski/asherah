interface ScannerOrchestratorOptions {
    workerCount?: number;
    torHost?: string;
    torPort?: number;
    timeout?: number;
    maxConcurrent?: number;
    minProbeDelay?: number;
}
export declare class ScannerOrchestrator {
    private readonly workers;
    private readonly database;
    private readonly workerCount;
    private readonly options;
    private isRunning;
    constructor(options?: ScannerOrchestratorOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    private startStatsReporter;
    getStats(): {
        isRunning: boolean;
        workerCount: number;
        workers: Array<{
            workerId: string;
            isRunning: boolean;
            uptime: number;
        }>;
    };
}
export {};
//# sourceMappingURL=scanner-orchestrator.d.ts.map