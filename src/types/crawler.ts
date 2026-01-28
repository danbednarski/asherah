export type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueueItem {
  url: string;
  domain: string;
  priority: number;
  attempts: number;
}

export interface CrawlResult {
  responseTime: number;
  contentLength: number;
  newLinksCount: number;
  textExtractedCount: number;
  totalLinksFound: number;
  onionLinksFound: number;
  /** HTTP status code */
  statusCode: number;
  /** True if content was truncated due to size limits */
  truncated?: boolean;
}

export interface CrawlerWorkerOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  crawlDelay?: number;
  maxContentSize?: number;
  database?: DatabaseConfig;
}

export interface DatabaseConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface CrawlerStatistics {
  totalDomains: number;
  totalPages: number;
  totalLinks: number;
  queueSize: number;
  activeCrawlers: number;
  recentCrawls: number;
  lockedDomains: number;
  domainStatus: { [status: string]: number };
}
