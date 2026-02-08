import type { Database } from './database.js';
import type { QueueItem } from '../types/index.js';
interface QueueManagerOptions {
    fetchIntervalMs?: number;
    batchSize?: number;
    lowWaterMark?: number;
}
export declare class QueueManager {
    private readonly database;
    private readonly fetchIntervalMs;
    private readonly batchSize;
    private readonly lowWaterMark;
    private queue;
    private fetchTimer;
    private isFetching;
    private isRunning;
    constructor(database: Database, options?: QueueManagerOptions);
    start(): void;
    stop(): void;
    getUrls(_workerId: string, count: number): QueueItem[];
    get size(): number;
    private refetch;
}
export {};
//# sourceMappingURL=queue-manager.d.ts.map