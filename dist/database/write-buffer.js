export class WriteBuffer {
    database;
    flushIntervalMs;
    maxBufferSize;
    crawlLogBuffer = [];
    scanQueueBuffer = [];
    flushTimer = null;
    isFlushing = false;
    constructor(database, options = {}) {
        this.database = database;
        this.flushIntervalMs = options.flushIntervalMs ?? 2000;
        this.maxBufferSize = options.maxBufferSize ?? 50;
    }
    start() {
        if (this.flushTimer)
            return;
        this.flushTimer = setInterval(() => {
            this.flush().catch((err) => {
                console.error('WriteBuffer flush error:', err instanceof Error ? err.message : err);
            });
        }, this.flushIntervalMs);
    }
    async stop() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        await this.flush();
    }
    bufferCrawlLog(entry) {
        this.crawlLogBuffer.push(entry);
        if (this.crawlLogBuffer.length >= this.maxBufferSize) {
            this.flush().catch((err) => {
                console.error('WriteBuffer flush error:', err instanceof Error ? err.message : err);
            });
        }
    }
    bufferScanQueueDomain(domain, priority) {
        this.scanQueueBuffer.push({ domain, priority });
        if (this.scanQueueBuffer.length >= this.maxBufferSize) {
            this.flush().catch((err) => {
                console.error('WriteBuffer flush error:', err instanceof Error ? err.message : err);
            });
        }
    }
    async flush() {
        if (this.isFlushing)
            return;
        this.isFlushing = true;
        try {
            await Promise.all([
                this.flushCrawlLogs(),
                this.flushScanQueue(),
            ]);
        }
        finally {
            this.isFlushing = false;
        }
    }
    async flushCrawlLogs() {
        if (this.crawlLogBuffer.length === 0)
            return;
        const entries = this.crawlLogBuffer.splice(0);
        const values = [];
        const params = [];
        for (let i = 0; i < entries.length; i++) {
            const offset = i * 7;
            values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`);
            const e = entries[i];
            params.push(e.url, e.status, e.statusCode, e.responseTime, e.contentLength, e.error, e.workerId);
        }
        const queryText = `
      INSERT INTO crawl_logs (url, status, status_code, response_time_ms, content_length, error_message, worker_id)
      VALUES ${values.join(',')}
    `;
        try {
            await this.database.query(queryText, params);
        }
        catch (err) {
            // On failure, put entries back so they aren't lost
            this.crawlLogBuffer.unshift(...entries);
            throw err;
        }
    }
    async flushScanQueue() {
        if (this.scanQueueBuffer.length === 0)
            return;
        const entries = this.scanQueueBuffer.splice(0);
        // Deduplicate by domain, keeping lowest priority
        const dedupMap = new Map();
        for (const e of entries) {
            const existing = dedupMap.get(e.domain);
            if (existing === undefined || e.priority < existing) {
                dedupMap.set(e.domain, e.priority);
            }
        }
        const deduped = Array.from(dedupMap.entries());
        const values = [];
        const params = [];
        for (let i = 0; i < deduped.length; i++) {
            const offset = i * 2;
            values.push(`($${offset + 1}, 'standard', $${offset + 2}, 'pending')`);
            params.push(deduped[i][0], deduped[i][1]);
        }
        const queryText = `
      INSERT INTO scan_queue (domain, profile, priority, status)
      VALUES ${values.join(',')}
      ON CONFLICT (domain) DO NOTHING
    `;
        try {
            await this.database.query(queryText, params);
        }
        catch (err) {
            // On failure, put entries back
            this.scanQueueBuffer.unshift(...entries);
            throw err;
        }
    }
}
//# sourceMappingURL=write-buffer.js.map