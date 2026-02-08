import { Database } from '../database/database.js';
import type { WriteBuffer } from '../database/write-buffer.js';
import type { QueueManager } from '../database/queue-manager.js';
import type { CrawlerWorkerOptions } from '../types/index.js';
export declare class CrawlerWorker {
    private readonly workerId;
    private readonly torClient;
    private readonly linkExtractor;
    private readonly database;
    private readonly ownsDatabase;
    private readonly writeBuffer;
    private readonly queueManager;
    private readonly logger;
    private readonly crawlDelay;
    private readonly maxContentSize;
    private isRunning;
    private startTime;
    constructor(workerId: string, options?: CrawlerWorkerOptions, sharedDatabase?: Database, writeBuffer?: WriteBuffer, queueManager?: QueueManager);
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