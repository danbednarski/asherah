import type { Database } from './database.js';
interface CrawlLogEntry {
    url: string;
    status: 'success' | 'error';
    statusCode: number | null;
    responseTime: number | null;
    contentLength: number | null;
    error: string | null;
    workerId: string | null;
}
interface WriteBufferOptions {
    flushIntervalMs?: number;
    maxBufferSize?: number;
}
export declare class WriteBuffer {
    private readonly database;
    private readonly flushIntervalMs;
    private readonly maxBufferSize;
    private crawlLogBuffer;
    private scanQueueBuffer;
    private flushTimer;
    private isFlushing;
    constructor(database: Database, options?: WriteBufferOptions);
    start(): void;
    stop(): Promise<void>;
    bufferCrawlLog(entry: CrawlLogEntry): void;
    bufferScanQueueDomain(domain: string, priority: number): void;
    flush(): Promise<void>;
    private flushCrawlLogs;
    private flushScanQueue;
}
export {};
//# sourceMappingURL=write-buffer.d.ts.map