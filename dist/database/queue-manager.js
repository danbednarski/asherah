export class QueueManager {
    database;
    fetchIntervalMs;
    batchSize;
    lowWaterMark;
    queue = [];
    fetchTimer = null;
    isFetching = false;
    isRunning = false;
    constructor(database, options = {}) {
        this.database = database;
        this.fetchIntervalMs = options.fetchIntervalMs ?? 5000;
        this.batchSize = options.batchSize ?? 50;
        this.lowWaterMark = options.lowWaterMark ?? 10;
    }
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        // Initial fetch
        this.refetch().catch((err) => {
            console.error('QueueManager initial fetch error:', err instanceof Error ? err.message : err);
        });
        this.fetchTimer = setInterval(() => {
            this.refetch().catch((err) => {
                console.error('QueueManager fetch error:', err instanceof Error ? err.message : err);
            });
        }, this.fetchIntervalMs);
    }
    stop() {
        this.isRunning = false;
        if (this.fetchTimer) {
            clearInterval(this.fetchTimer);
            this.fetchTimer = null;
        }
    }
    getUrls(_workerId, count) {
        const items = this.queue.splice(0, count);
        // Trigger refetch if below low water mark
        if (this.queue.length < this.lowWaterMark) {
            this.refetch().catch((err) => {
                console.error('QueueManager refetch error:', err instanceof Error ? err.message : err);
            });
        }
        return items;
    }
    get size() {
        return this.queue.length;
    }
    async refetch() {
        if (this.isFetching || !this.isRunning)
            return;
        this.isFetching = true;
        try {
            const items = await this.database.getNextUrls('queue-manager', this.batchSize);
            if (items.length > 0) {
                this.queue.push(...items);
            }
        }
        finally {
            this.isFetching = false;
        }
    }
}
//# sourceMappingURL=queue-manager.js.map