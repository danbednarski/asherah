import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { type DomainUpsertResult, type PageUpsertResult, type QueueItem, type SearchResultRow, type DomainDetailsRow, type IncomingLinkRow, type OutgoingLinkRow } from '../schemas/index.js';
import type { DatabaseConfig, CrawlerStatistics, PageData, ExtractedLink } from '../types/index.js';
export declare class Database {
    private readonly pool;
    constructor(config?: Partial<DatabaseConfig>);
    query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    upsertDomain(domain: string, title?: string | null, description?: string | null): Promise<DomainUpsertResult>;
    upsertPage(domainId: number, url: string, pageData: PageData): Promise<PageUpsertResult>;
    insertLinks(pageId: number, links: ExtractedLink[]): Promise<void>;
    insertHeaders(pageId: number, headers: Record<string, string>): Promise<void>;
    addToCrawlQueue(urls: string | string[], priority?: number): Promise<void>;
    getNextUrls(workerId: string, limit?: number): Promise<QueueItem[]>;
    markUrlCompleted(url: string, success?: boolean, error?: string | null): Promise<void>;
    markDomainConnectionFailed(domain: string, error: string): Promise<number>;
    logCrawl(url: string, status: 'success' | 'error', statusCode?: number | null, responseTime?: number | null, contentLength?: number | null, error?: string | null, workerId?: string | null): Promise<void>;
    acquireDomainLock(domain: string, workerId: string): Promise<boolean>;
    releaseDomainLock(domain: string, workerId: string): Promise<boolean>;
    extendDomainLock(domain: string, workerId: string): Promise<boolean>;
    updateDomainStatus(domain: string, status: string, workerId?: string | null): Promise<void>;
    getStatistics(): Promise<CrawlerStatistics>;
    searchCombined(textQuery?: string | null, headerName?: string | null, headerValue?: string | null, titleQuery?: string | null, limit?: number, offset?: number, port?: number | null): Promise<SearchResultRow[]>;
    getDomainDetails(domain: string): Promise<DomainDetailsRow | null>;
    getIncomingLinks(domain: string, limit?: number, offset?: number): Promise<IncomingLinkRow[]>;
    getOutgoingLinks(domain: string, limit?: number, offset?: number): Promise<OutgoingLinkRow[]>;
    close(): Promise<void>;
    getNextScans(workerId: string, limit?: number): Promise<Array<{
        id: number;
        domainId: number | null;
        domain: string;
        profile: 'quick' | 'standard' | 'full' | 'crypto';
        ports: number[] | null;
        priority: number;
        attempts: number;
    }>>;
    returnScanToQueue(scanId: number): Promise<void>;
    markScanCompleted(scanId: number): Promise<void>;
    markScanFailed(scanId: number, error: string): Promise<void>;
    acquireScanLock(domain: string, workerId: string): Promise<boolean>;
    releaseScanLock(domain: string, workerId: string): Promise<boolean>;
    insertPortScan(domainId: number, domain: string, port: number, state: string, responseTimeMs: number, banner: string | null): Promise<number>;
    getPortScanId(domain: string, port: number): Promise<number | null>;
    insertDetectedService(portScanId: number, domain: string, port: number, serviceName: string, serviceVersion: string | null, confidence: number, rawBanner: string | null): Promise<void>;
    addToScanQueue(domain: string, profile?: string, ports?: number[] | null, priority?: number): Promise<void>;
    getScannerStatistics(): Promise<{
        totalScans: number;
        activeWorkers: number;
        queueSize: number;
        openPorts: number;
        servicesDetected: number;
        recentScans: number;
    }>;
    getPortScanResults(domain: string): Promise<Array<{
        port: number;
        state: string;
        responseTimeMs: number | null;
        banner: string | null;
        scannedAt: Date;
        serviceName: string | null;
        serviceVersion: string | null;
    }>>;
    populateScanQueueFromDomains(limit?: number, profile?: string): Promise<number>;
    queueDomainForScan(domain: string, priority?: number): Promise<void>;
}
//# sourceMappingURL=database.d.ts.map