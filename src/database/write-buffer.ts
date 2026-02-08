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

interface ScanQueueEntry {
  domain: string;
  priority: number;
}

interface WriteBufferOptions {
  flushIntervalMs?: number;
  maxBufferSize?: number;
}

export class WriteBuffer {
  private readonly database: Database;
  private readonly flushIntervalMs: number;
  private readonly maxBufferSize: number;
  private crawlLogBuffer: CrawlLogEntry[] = [];
  private scanQueueBuffer: ScanQueueEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isFlushing = false;

  constructor(database: Database, options: WriteBufferOptions = {}) {
    this.database = database;
    this.flushIntervalMs = options.flushIntervalMs ?? 2000;
    this.maxBufferSize = options.maxBufferSize ?? 50;
  }

  start(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('WriteBuffer flush error:', err instanceof Error ? err.message : err);
      });
    }, this.flushIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  bufferCrawlLog(entry: CrawlLogEntry): void {
    this.crawlLogBuffer.push(entry);
    if (this.crawlLogBuffer.length >= this.maxBufferSize) {
      this.flush().catch((err) => {
        console.error('WriteBuffer flush error:', err instanceof Error ? err.message : err);
      });
    }
  }

  bufferScanQueueDomain(domain: string, priority: number): void {
    this.scanQueueBuffer.push({ domain, priority });
    if (this.scanQueueBuffer.length >= this.maxBufferSize) {
      this.flush().catch((err) => {
        console.error('WriteBuffer flush error:', err instanceof Error ? err.message : err);
      });
    }
  }

  async flush(): Promise<void> {
    if (this.isFlushing) return;
    this.isFlushing = true;

    try {
      await Promise.all([
        this.flushCrawlLogs(),
        this.flushScanQueue(),
      ]);
    } finally {
      this.isFlushing = false;
    }
  }

  private async flushCrawlLogs(): Promise<void> {
    if (this.crawlLogBuffer.length === 0) return;

    const entries = this.crawlLogBuffer.splice(0);

    const values: string[] = [];
    const params: unknown[] = [];
    for (let i = 0; i < entries.length; i++) {
      const offset = i * 7;
      values.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
      );
      const e = entries[i]!;
      params.push(e.url, e.status, e.statusCode, e.responseTime, e.contentLength, e.error, e.workerId);
    }

    const queryText = `
      INSERT INTO crawl_logs (url, status, status_code, response_time_ms, content_length, error_message, worker_id)
      VALUES ${values.join(',')}
    `;

    try {
      await this.database.query(queryText, params);
    } catch (err) {
      // On failure, put entries back so they aren't lost
      this.crawlLogBuffer.unshift(...entries);
      throw err;
    }
  }

  private async flushScanQueue(): Promise<void> {
    if (this.scanQueueBuffer.length === 0) return;

    const entries = this.scanQueueBuffer.splice(0);

    // Deduplicate by domain, keeping lowest priority
    const dedupMap = new Map<string, number>();
    for (const e of entries) {
      const existing = dedupMap.get(e.domain);
      if (existing === undefined || e.priority < existing) {
        dedupMap.set(e.domain, e.priority);
      }
    }

    const deduped = Array.from(dedupMap.entries());
    const values: string[] = [];
    const params: unknown[] = [];
    for (let i = 0; i < deduped.length; i++) {
      const offset = i * 2;
      values.push(`($${offset + 1}, 'standard', $${offset + 2}, 'pending')`);
      params.push(deduped[i]![0], deduped[i]![1]);
    }

    const queryText = `
      INSERT INTO scan_queue (domain, profile, priority, status)
      VALUES ${values.join(',')}
      ON CONFLICT (domain) DO NOTHING
    `;

    try {
      await this.database.query(queryText, params);
    } catch (err) {
      // On failure, put entries back
      this.scanQueueBuffer.unshift(...entries);
      throw err;
    }
  }
}
