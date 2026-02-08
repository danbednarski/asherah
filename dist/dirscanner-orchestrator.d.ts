interface DirScannerOrchestratorOptions {
    workerCount?: number;
    torHost?: string;
    torPort?: number;
    timeout?: number;
    pathDelay?: number;
}
export declare class DirScannerOrchestrator {
    private readonly workers;
    private readonly database;
    private readonly workerCount;
    private readonly options;
    private isRunning;
    constructor(options?: DirScannerOrchestratorOptions);
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
//# sourceMappingURL=dirscanner-orchestrator.d.ts.map