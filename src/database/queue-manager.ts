import type { Database } from './database.js';
import type { QueueItem } from '../types/index.js';

interface QueueManagerOptions {
  fetchIntervalMs?: number;
  batchSize?: number;
  lowWaterMark?: number;
}

export class QueueManager {
  private readonly database: Database;
  private readonly fetchIntervalMs: number;
  private readonly batchSize: number;
  private readonly lowWaterMark: number;
  private queue: QueueItem[] = [];
  private fetchTimer: ReturnType<typeof setInterval> | null = null;
  private isFetching = false;
  private isRunning = false;

  constructor(database: Database, options: QueueManagerOptions = {}) {
    this.database = database;
    this.fetchIntervalMs = options.fetchIntervalMs ?? 5000;
    this.batchSize = options.batchSize ?? 50;
    this.lowWaterMark = options.lowWaterMark ?? 10;
  }

  start(): void {
    if (this.isRunning) return;
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

  stop(): void {
    this.isRunning = false;
    if (this.fetchTimer) {
      clearInterval(this.fetchTimer);
      this.fetchTimer = null;
    }
  }

  getUrls(_workerId: string, count: number): QueueItem[] {
    const items = this.queue.splice(0, count);

    // Trigger refetch if below low water mark
    if (this.queue.length < this.lowWaterMark) {
      this.refetch().catch((err) => {
        console.error('QueueManager refetch error:', err instanceof Error ? err.message : err);
      });
    }

    return items;
  }

  get size(): number {
    return this.queue.length;
  }

  private async refetch(): Promise<void> {
    if (this.isFetching || !this.isRunning) return;
    this.isFetching = true;

    try {
      const items = await this.database.getNextUrls('queue-manager', this.batchSize);
      if (items.length > 0) {
        this.queue.push(...items);
      }
    } finally {
      this.isFetching = false;
    }
  }
}
