import { CrawlerWorker } from './crawler/worker.js';
import { Database } from './database/database.js';
import type { CrawlerWorkerOptions, CrawlerStatistics } from './types/index.js';
interface SearchEngineOptions extends CrawlerWorkerOptions {
    workerCount?: number;
    logLevel?: string;
}
declare class OnionSearchEngine {
    private workers;
    private readonly workerCount;
    private readonly database;
    private readonly writeBuffer;
    private readonly queueManager;
    private readonly logger;
    private isRunning;
    private statsInterval;
    private readonly options;
    constructor(options?: SearchEngineOptions);
    initialize(): Promise<void>;
    private ensureLogsDirectory;
    private initializeDatabase;
    addSeedUrls(urls: string | string[]): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    reportStatistics(): Promise<CrawlerStatistics | null>;
}
export { OnionSearchEngine, CrawlerWorker, Database };
//# sourceMappingURL=index.d.ts.map